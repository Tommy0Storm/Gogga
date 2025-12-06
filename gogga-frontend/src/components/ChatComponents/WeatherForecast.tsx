'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface CurrentWeather {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
}

interface DailyForecast {
  date: string;
  dayName: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability?: number;
}

interface WeatherData {
  location: {
    name: string;
    lat: number;
    lon: number;
  };
  current: CurrentWeather;
  daily: DailyForecast[];
  lastUpdated: number;
}

interface WeatherForecastProps {
  /** Latitude coordinate */
  latitude?: number;
  /** Longitude coordinate */
  longitude?: number;
  /** Location name to display */
  locationName?: string;
  /** Auto-fetch on mount if coordinates provided */
  autoFetch?: boolean;
  /** Compact mode for sidebar */
  compact?: boolean;
  /** Show/hide component */
  visible?: boolean;
  /** Callback when weather data is loaded */
  onWeatherLoad?: (data: WeatherData) => void;
  /** Custom className */
  className?: string;
}

// ============================================================================
// WEATHER CODE MAPPING (WMO Standard)
// ============================================================================

interface WeatherInfo {
  description: string;
  icon: string;
  gradient: string;
  textColor: string;
}

const getWeatherInfo = (code: number, isNight = false): WeatherInfo => {
  const weatherMap: Record<number, WeatherInfo> = {
    // Clear
    0: {
      description: 'Clear sky',
      icon: isNight ? 'nights_stay' : 'wb_sunny',
      gradient: isNight ? 'from-indigo-900 to-purple-900' : 'from-amber-400 to-orange-500',
      textColor: 'text-white',
    },
    // Partly cloudy
    1: {
      description: 'Mainly clear',
      icon: isNight ? 'nights_stay' : 'wb_sunny',
      gradient: isNight ? 'from-indigo-800 to-slate-800' : 'from-amber-300 to-orange-400',
      textColor: 'text-white',
    },
    2: {
      description: 'Partly cloudy',
      icon: 'partly_cloudy_day',
      gradient: 'from-blue-400 to-slate-500',
      textColor: 'text-white',
    },
    3: {
      description: 'Overcast',
      icon: 'cloud',
      gradient: 'from-slate-500 to-slate-700',
      textColor: 'text-white',
    },
    // Fog
    45: {
      description: 'Foggy',
      icon: 'foggy',
      gradient: 'from-gray-400 to-gray-600',
      textColor: 'text-white',
    },
    48: {
      description: 'Rime fog',
      icon: 'foggy',
      gradient: 'from-gray-300 to-gray-500',
      textColor: 'text-gray-900',
    },
    // Drizzle
    51: {
      description: 'Light drizzle',
      icon: 'grain',
      gradient: 'from-blue-400 to-blue-600',
      textColor: 'text-white',
    },
    53: {
      description: 'Drizzle',
      icon: 'grain',
      gradient: 'from-blue-500 to-blue-700',
      textColor: 'text-white',
    },
    55: {
      description: 'Dense drizzle',
      icon: 'grain',
      gradient: 'from-blue-600 to-blue-800',
      textColor: 'text-white',
    },
    // Rain
    61: {
      description: 'Light rain',
      icon: 'rainy',
      gradient: 'from-blue-500 to-indigo-600',
      textColor: 'text-white',
    },
    63: {
      description: 'Rain',
      icon: 'rainy',
      gradient: 'from-blue-600 to-indigo-700',
      textColor: 'text-white',
    },
    65: {
      description: 'Heavy rain',
      icon: 'rainy',
      gradient: 'from-blue-700 to-indigo-800',
      textColor: 'text-white',
    },
    // Freezing rain
    66: {
      description: 'Light freezing rain',
      icon: 'weather_mix',
      gradient: 'from-cyan-500 to-blue-700',
      textColor: 'text-white',
    },
    67: {
      description: 'Freezing rain',
      icon: 'weather_mix',
      gradient: 'from-cyan-600 to-blue-800',
      textColor: 'text-white',
    },
    // Snow
    71: {
      description: 'Light snow',
      icon: 'ac_unit',
      gradient: 'from-slate-200 to-blue-300',
      textColor: 'text-gray-900',
    },
    73: {
      description: 'Snow',
      icon: 'ac_unit',
      gradient: 'from-slate-300 to-blue-400',
      textColor: 'text-gray-900',
    },
    75: {
      description: 'Heavy snow',
      icon: 'ac_unit',
      gradient: 'from-slate-400 to-blue-500',
      textColor: 'text-white',
    },
    77: {
      description: 'Snow grains',
      icon: 'grain',
      gradient: 'from-slate-300 to-slate-500',
      textColor: 'text-white',
    },
    // Rain showers
    80: {
      description: 'Light showers',
      icon: 'rainy_light',
      gradient: 'from-blue-400 to-teal-500',
      textColor: 'text-white',
    },
    81: {
      description: 'Showers',
      icon: 'rainy_heavy',
      gradient: 'from-blue-500 to-teal-600',
      textColor: 'text-white',
    },
    82: {
      description: 'Heavy showers',
      icon: 'rainy_heavy',
      gradient: 'from-blue-600 to-teal-700',
      textColor: 'text-white',
    },
    // Snow showers
    85: {
      description: 'Light snow showers',
      icon: 'weather_snowy',
      gradient: 'from-slate-300 to-indigo-400',
      textColor: 'text-white',
    },
    86: {
      description: 'Snow showers',
      icon: 'weather_snowy',
      gradient: 'from-slate-400 to-indigo-500',
      textColor: 'text-white',
    },
    // Thunderstorm
    95: {
      description: 'Thunderstorm',
      icon: 'thunderstorm',
      gradient: 'from-purple-700 to-gray-900',
      textColor: 'text-white',
    },
    96: {
      description: 'Thunderstorm + hail',
      icon: 'thunderstorm',
      gradient: 'from-purple-800 to-gray-900',
      textColor: 'text-white',
    },
    99: {
      description: 'Severe thunderstorm',
      icon: 'thunderstorm',
      gradient: 'from-red-800 to-gray-900',
      textColor: 'text-white',
    },
  };

  return (
    weatherMap[code] || {
      description: 'Unknown',
      icon: 'help',
      gradient: 'from-gray-500 to-gray-700',
      textColor: 'text-white',
    }
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getDayName = (dateStr: string, index: number): string => {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZA', { weekday: 'short' });
};

const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
};

const isNightTime = (isoString?: string): boolean => {
  const date = isoString ? new Date(isoString) : new Date();
  const hour = date.getHours();
  return hour < 6 || hour >= 18;
};

// ============================================================================
// WEATHER ICON COMPONENT
// ============================================================================

interface WeatherIconProps {
  code: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  isNight?: boolean;
}

const WeatherIcon: React.FC<WeatherIconProps> = ({
  code,
  size = 'md',
  animated = false,
  isNight = false,
}) => {
  const { icon } = getWeatherInfo(code, isNight);

  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
    xl: 'text-8xl',
  };

  const animationClass = animated
    ? code >= 95
      ? 'animate-pulse'
      : code >= 61
      ? 'animate-bounce-slow'
      : ''
    : '';

  return (
    <span
      className={`material-icons ${sizeClasses[size]} ${animationClass} transition-all duration-300`}
    >
      {icon}
    </span>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const WeatherForecast: React.FC<WeatherForecastProps> = ({
  latitude,
  longitude,
  locationName,
  autoFetch = true,
  compact = false,
  visible = true,
  onWeatherLoad,
  className = '',
}) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  // Fetch weather from Open-Meteo
  const fetchWeather = useCallback(async () => {
    if (!latitude || !longitude) return;

    setLoading(true);
    setError(null);

    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', latitude.toString());
      url.searchParams.set('longitude', longitude.toString());
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

      const weatherData: WeatherData = {
        location: {
          name: locationName || `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
          lat: latitude,
          lon: longitude,
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
        lastUpdated: Date.now(),
      };

      setWeather(weatherData);
      onWeatherLoad?.(weatherData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch weather');
      console.error('[Weather] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, locationName, onWeatherLoad]);

  // Auto-fetch on mount or when coordinates change
  useEffect(() => {
    if (autoFetch && latitude && longitude) {
      fetchWeather();
    }
  }, [autoFetch, latitude, longitude, fetchWeather]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    if (!autoFetch || !latitude || !longitude) return;

    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoFetch, latitude, longitude, fetchWeather]);

  if (!visible) return null;

  // Loading state
  if (loading && !weather) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-600 rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-gray-600 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-600 rounded w-16" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !weather) {
    return (
      <div className={`${className}`}>
        <div className="bg-gradient-to-br from-red-900/50 to-gray-900 rounded-2xl p-4 border border-red-500/30">
          <div className="flex items-center gap-3 text-red-400">
            <span className="material-icons">error_outline</span>
            <span className="text-sm">{error}</span>
            <button
              onClick={fetchWeather}
              className="ml-auto p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <span className="material-icons text-lg">refresh</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className={`${className}`}>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 border border-gray-700">
          <div className="flex items-center gap-3 text-gray-400">
            <span className="material-icons">location_off</span>
            <span className="text-sm">Enable location for weather</span>
          </div>
        </div>
      </div>
    );
  }

  const currentInfo = getWeatherInfo(weather.current.weatherCode, isNightTime(weather.current.time));

  // Compact view
  if (compact && !expanded) {
    return (
      <div className={`${className}`}>
        <button
          onClick={() => setExpanded(true)}
          className={`w-full bg-gradient-to-br ${currentInfo.gradient} rounded-2xl p-4 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WeatherIcon
                code={weather.current.weatherCode}
                size="md"
                isNight={isNightTime(weather.current.time)}
              />
              <div className="text-left">
                <div className={`text-3xl font-bold ${currentInfo.textColor}`}>
                  {weather.current.temperature}°
                </div>
                <div className={`text-sm ${currentInfo.textColor} opacity-80`}>
                  {weather.location.name}
                </div>
              </div>
            </div>
            <span className="material-icons text-white/50 group-hover:text-white/80 transition-colors">
              expand_more
            </span>
          </div>
        </button>
      </div>
    );
  }

  // Full view
  return (
    <div className={`${className}`}>
      <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl shadow-2xl overflow-hidden border border-gray-800">
        {/* Header with current weather */}
        <div className={`bg-gradient-to-br ${currentInfo.gradient} p-6 relative overflow-hidden`}>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          {/* Collapse button for compact mode */}
          {compact && (
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-3 right-3 p-1.5 hover:bg-white/20 rounded-lg transition-colors z-10"
            >
              <span className="material-icons text-white/70 hover:text-white">expand_less</span>
            </button>
          )}

          <div className="relative z-10">
            {/* Location & time */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-semibold ${currentInfo.textColor}`}>
                  {weather.location.name}
                </h3>
                <p className={`text-sm ${currentInfo.textColor} opacity-70`}>
                  {formatTime(weather.current.time)} · {currentInfo.description}
                </p>
              </div>
              <button
                onClick={fetchWeather}
                disabled={loading}
                className={`p-2 hover:bg-white/20 rounded-full transition-colors ${
                  loading ? 'animate-spin' : ''
                }`}
              >
                <span className={`material-icons ${currentInfo.textColor}`}>refresh</span>
              </button>
            </div>

            {/* Main temperature display */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <WeatherIcon
                  code={weather.current.weatherCode}
                  size="xl"
                  animated
                  isNight={isNightTime(weather.current.time)}
                />
                <div>
                  <div className={`text-7xl font-extralight ${currentInfo.textColor}`}>
                    {weather.current.temperature}°
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className={`grid gap-2 text-right ${currentInfo.textColor}`}>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm opacity-70">Feels</span>
                  <span className="font-semibold">{weather.current.feelsLike}°</span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span className="material-icons text-sm opacity-70">water_drop</span>
                  <span className="font-semibold">{weather.current.humidity}%</span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span className="material-icons text-sm opacity-70">air</span>
                  <span className="font-semibold">{weather.current.windSpeed} km/h</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 7-Day Forecast Table */}
        <div className="p-4">
          <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3 px-2">
            7-Day Forecast
          </h4>

          <div className="bg-gray-800/50 rounded-2xl overflow-hidden">
            <table className="w-full">
              <tbody>
                {weather.daily.map((day, index) => {
                  const dayInfo = getWeatherInfo(day.weatherCode);
                  const isToday = index === 0;

                  return (
                    <tr
                      key={day.date}
                      className={`
                        border-b border-gray-700/50 last:border-0
                        ${isToday ? 'bg-gray-700/30' : 'hover:bg-gray-700/20'}
                        transition-colors duration-200
                      `}
                    >
                      {/* Day */}
                      <td className="py-3 px-4 w-24">
                        <span
                          className={`font-medium ${isToday ? 'text-white' : 'text-gray-300'}`}
                        >
                          {day.dayName}
                        </span>
                      </td>

                      {/* Weather icon + description */}
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${dayInfo.gradient} flex items-center justify-center shadow-lg`}
                          >
                            <WeatherIcon code={day.weatherCode} size="sm" />
                          </div>
                          <span className="text-gray-400 text-sm hidden sm:inline">
                            {dayInfo.description}
                          </span>
                        </div>
                      </td>

                      {/* Precipitation */}
                      <td className="py-3 px-2 text-center hidden sm:table-cell">
                        {day.precipitationProbability !== undefined && (
                          <div className="flex items-center justify-center gap-1 text-blue-400">
                            <span className="material-icons text-sm">water_drop</span>
                            <span className="text-sm">{day.precipitationProbability}%</span>
                          </div>
                        )}
                      </td>

                      {/* Temperature range */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-white font-semibold">{day.tempMax}°</span>
                          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-orange-500 rounded-full"
                              style={{
                                width: `${((day.tempMax - day.tempMin) / 30) * 100}%`,
                                marginLeft: `${((day.tempMin + 5) / 45) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-gray-500">{day.tempMin}°</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 px-2 text-xs text-gray-500">
            <span>Data: Open-Meteo</span>
            <span>Updated {new Date(weather.lastUpdated).toLocaleTimeString('en-ZA')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherForecast;
