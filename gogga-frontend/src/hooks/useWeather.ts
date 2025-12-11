/**
 * useWeather Hook
 * Auto-fetches weather when user grants location permission
 * Integrates with useLocation hook for seamless weather data
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface CurrentWeather {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
}

export interface DailyForecast {
  date: string;
  dayName: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability?: number;
}

export interface WeatherData {
  location: {
    name: string;
    lat: number;
    lon: number;
  };
  current: CurrentWeather;
  daily: DailyForecast[];
  lastUpdated: number;
}

export interface UseWeatherOptions {
  /** Auto-fetch when location is available */
  autoFetch?: boolean;
  /** Refresh interval in milliseconds (default: 10 minutes) */
  refreshInterval?: number;
  /** Cache duration in milliseconds (default: 5 minutes) */
  cacheDuration?: number;
}

export interface UseWeatherReturn {
  /** Weather data (null if not loaded) */
  weather: WeatherData | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Last successful fetch time */
  lastUpdated: number | null;
  /** Manually trigger refresh */
  refresh: () => Promise<void>;
  /** Fetch weather for specific coordinates */
  fetchWeatherAt: (lat: number, lon: number, locationName?: string) => Promise<void>;
  /** Clear weather data */
  clear: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'gogga_weather_cache';
const DEFAULT_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
const DEFAULT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// HELPERS
// ============================================================================

const getDayName = (dateStr: string, index: number): string => {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZA', { weekday: 'short' });
};

const getCachedWeather = (): WeatherData | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as WeatherData;
    const age = Date.now() - data.lastUpdated;
    
    // Return cached data if less than cache duration
    if (age < DEFAULT_CACHE_DURATION) {
      return data;
    }
    
    return null;
  } catch {
    return null;
  }
};

const setCachedWeather = (data: WeatherData): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[Weather] Failed to cache weather data:', e);
  }
};

// ============================================================================
// HOOK
// ============================================================================

export function useWeather(options: UseWeatherOptions = {}): UseWeatherReturn {
  const {
    autoFetch = true,
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
  } = options;

  const [weather, setWeather] = useState<WeatherData | null>(() => getCachedWeather());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(weather?.lastUpdated || null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number; name?: string } | null>(null);

  // Fetch weather from Open-Meteo API
  const fetchWeatherAt = useCallback(async (lat: number, lon: number, locationName?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', lat.toString());
      url.searchParams.set('longitude', lon.toString());
      url.searchParams.set(
        'current',
        'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m'
      );
      url.searchParams.set(
        'daily',
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
      );
      url.searchParams.set('timezone', 'auto');
      url.searchParams.set('forecast_days', '7');

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      const now = Date.now();

      const weatherData: WeatherData = {
        location: {
          name: locationName || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
          lat,
          lon,
        },
        current: {
          time: data.current.time,
          temperature: Math.round(data.current.temperature_2m),
          feelsLike: Math.round(data.current.apparent_temperature),
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m),
          weatherCode: data.current.weather_code,
        },
        daily: data.daily.time.map((date: string, i: number) => ({
          date,
          dayName: getDayName(date, i),
          weatherCode: data.daily.weather_code[i],
          tempMax: Math.round(data.daily.temperature_2m_max[i]),
          tempMin: Math.round(data.daily.temperature_2m_min[i]),
          precipitationProbability: data.daily.precipitation_probability_max?.[i],
        })),
        lastUpdated: now,
      };

      setWeather(weatherData);
      setLastUpdated(now);
      setCachedWeather(weatherData);
      setCoordinates({ lat, lon, name: locationName });

      console.log('[Weather] Fetched weather for', locationName || `${lat}, ${lon}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch weather';
      setError(message);
      console.error('[Weather] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh using stored coordinates
  const refresh = useCallback(async () => {
    if (coordinates) {
      await fetchWeatherAt(coordinates.lat, coordinates.lon, coordinates.name);
    } else if (weather) {
      await fetchWeatherAt(weather.location.lat, weather.location.lon, weather.location.name);
    }
  }, [coordinates, weather, fetchWeatherAt]);

  // Clear weather data
  const clear = useCallback(() => {
    setWeather(null);
    setLastUpdated(null);
    setCoordinates(null);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoFetch || !coordinates) return;

    const interval = setInterval(() => {
      fetchWeatherAt(coordinates.lat, coordinates.lon, coordinates.name);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoFetch, coordinates, refreshInterval, fetchWeatherAt]);

  return {
    weather,
    isLoading,
    error,
    lastUpdated,
    refresh,
    fetchWeatherAt,
    clear,
  };
}

export default useWeather;
