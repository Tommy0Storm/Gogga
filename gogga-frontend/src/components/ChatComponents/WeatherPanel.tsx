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

interface WeatherPanelProps {
  /** User's latitude */
  latitude?: number;
  /** User's longitude */
  longitude?: number;
  /** Location name to display */
  locationName?: string;
  /** Whether user has granted location permission */
  hasLocationPermission?: boolean;
  /** Callback to request location permission */
  onRequestLocation?: () => void;
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
  bgPattern?: string;
}

const getWeatherInfo = (code: number, isNight = false): WeatherInfo => {
  const weatherMap: Record<number, WeatherInfo> = {
    // Clear
    0: {
      description: 'Clear sky',
      icon: isNight ? 'nights_stay' : 'wb_sunny',
      gradient: isNight 
        ? 'from-indigo-900 via-purple-900 to-slate-900' 
        : 'from-amber-400 via-orange-400 to-yellow-500',
      textColor: 'text-white',
    },
    1: {
      description: 'Mainly clear',
      icon: isNight ? 'bedtime' : 'light_mode',
      gradient: isNight 
        ? 'from-indigo-800 via-slate-800 to-slate-900'
        : 'from-amber-300 via-yellow-400 to-orange-400',
      textColor: 'text-white',
    },
    2: {
      description: 'Partly cloudy',
      icon: isNight ? 'nights_stay' : 'partly_cloudy_day',
      gradient: 'from-sky-400 via-blue-500 to-slate-600',
      textColor: 'text-white',
    },
    3: {
      description: 'Overcast',
      icon: 'cloud',
      gradient: 'from-slate-500 via-gray-600 to-slate-700',
      textColor: 'text-white',
    },
    // Fog
    45: {
      description: 'Foggy',
      icon: 'foggy',
      gradient: 'from-gray-400 via-slate-500 to-gray-600',
      textColor: 'text-white',
    },
    48: {
      description: 'Rime fog',
      icon: 'mist',
      gradient: 'from-gray-300 via-slate-400 to-gray-500',
      textColor: 'text-gray-900',
    },
    // Drizzle
    51: {
      description: 'Light drizzle',
      icon: 'grain',
      gradient: 'from-blue-400 via-sky-500 to-blue-600',
      textColor: 'text-white',
    },
    53: {
      description: 'Drizzle',
      icon: 'water_drop',
      gradient: 'from-blue-500 via-sky-600 to-blue-700',
      textColor: 'text-white',
    },
    55: {
      description: 'Dense drizzle',
      icon: 'water_drop',
      gradient: 'from-blue-600 via-indigo-600 to-blue-800',
      textColor: 'text-white',
    },
    // Rain
    61: {
      description: 'Light rain',
      icon: 'rainy',
      gradient: 'from-blue-500 via-indigo-500 to-purple-600',
      textColor: 'text-white',
    },
    63: {
      description: 'Moderate rain',
      icon: 'rainy',
      gradient: 'from-blue-600 via-indigo-600 to-purple-700',
      textColor: 'text-white',
    },
    65: {
      description: 'Heavy rain',
      icon: 'rainy',
      gradient: 'from-blue-700 via-indigo-700 to-purple-800',
      textColor: 'text-white',
    },
    // Freezing rain
    66: {
      description: 'Light freezing rain',
      icon: 'weather_mix',
      gradient: 'from-cyan-500 via-blue-600 to-indigo-700',
      textColor: 'text-white',
    },
    67: {
      description: 'Freezing rain',
      icon: 'severe_cold',
      gradient: 'from-cyan-600 via-blue-700 to-indigo-800',
      textColor: 'text-white',
    },
    // Snow
    71: {
      description: 'Light snow',
      icon: 'ac_unit',
      gradient: 'from-slate-200 via-blue-200 to-indigo-300',
      textColor: 'text-gray-800',
    },
    73: {
      description: 'Moderate snow',
      icon: 'weather_snowy',
      gradient: 'from-slate-300 via-blue-300 to-indigo-400',
      textColor: 'text-gray-800',
    },
    75: {
      description: 'Heavy snow',
      icon: 'weather_snowy',
      gradient: 'from-slate-400 via-blue-400 to-indigo-500',
      textColor: 'text-white',
    },
    77: {
      description: 'Snow grains',
      icon: 'grain',
      gradient: 'from-slate-300 via-gray-400 to-slate-500',
      textColor: 'text-white',
    },
    // Rain showers
    80: {
      description: 'Light showers',
      icon: 'rainy_light',
      gradient: 'from-teal-400 via-cyan-500 to-blue-500',
      textColor: 'text-white',
    },
    81: {
      description: 'Moderate showers',
      icon: 'rainy',
      gradient: 'from-teal-500 via-cyan-600 to-blue-600',
      textColor: 'text-white',
    },
    82: {
      description: 'Heavy showers',
      icon: 'rainy_heavy',
      gradient: 'from-teal-600 via-cyan-700 to-blue-700',
      textColor: 'text-white',
    },
    // Snow showers
    85: {
      description: 'Light snow showers',
      icon: 'weather_snowy',
      gradient: 'from-slate-300 via-indigo-300 to-purple-400',
      textColor: 'text-gray-800',
    },
    86: {
      description: 'Heavy snow showers',
      icon: 'snowing_heavy',
      gradient: 'from-slate-400 via-indigo-400 to-purple-500',
      textColor: 'text-white',
    },
    // Thunderstorm
    95: {
      description: 'Thunderstorm',
      icon: 'thunderstorm',
      gradient: 'from-purple-700 via-gray-800 to-slate-900',
      textColor: 'text-white',
    },
    96: {
      description: 'Thunderstorm with hail',
      icon: 'thunderstorm',
      gradient: 'from-purple-800 via-red-900 to-gray-900',
      textColor: 'text-white',
    },
    99: {
      description: 'Severe thunderstorm',
      icon: 'thunderstorm',
      gradient: 'from-red-800 via-purple-900 to-gray-900',
      textColor: 'text-white',
    },
  };

  return (
    weatherMap[code] || {
      description: 'Unknown',
      icon: 'question_mark',
      gradient: 'from-gray-500 via-gray-600 to-gray-700',
      textColor: 'text-white',
    }
  );
};

// ============================================================================
// HELPERS
// ============================================================================

const getDayName = (dateStr: string, index: number): string => {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZA', { weekday: 'short' });
};

const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-ZA', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

const isNightTime = (isoString?: string): boolean => {
  const date = isoString ? new Date(isoString) : new Date();
  const hour = date.getHours();
  return hour < 6 || hour >= 19;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const WeatherIcon: React.FC<{ 
  code: number; 
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isNight?: boolean;
  animated?: boolean;
}> = ({ code, size = 'md', isNight = false, animated = false }) => {
  const { icon } = getWeatherInfo(code, isNight);
  
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
    xl: 'text-7xl',
    '2xl': 'text-9xl',
  };

  const animationClass = animated
    ? code >= 95
      ? 'animate-pulse'
      : code >= 61 && code <= 82
      ? 'animate-bounce-slow'
      : ''
    : '';

  return (
    <span className={`material-icons ${sizeClasses[size]} ${animationClass} drop-shadow-lg`}>
      {icon}
    </span>
  );
};

// Skeleton loader for the panel
const WeatherSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-3xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 w-32 bg-gray-600 rounded" />
        <div className="h-8 w-8 bg-gray-600 rounded-full" />
      </div>
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 bg-gray-600 rounded-full" />
        <div>
          <div className="h-16 w-32 bg-gray-600 rounded mb-2" />
          <div className="h-4 w-24 bg-gray-600 rounded" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-600 rounded-xl" />
        ))}
      </div>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const WeatherPanel: React.FC<WeatherPanelProps> = ({
  latitude,
  longitude,
  locationName,
  hasLocationPermission = false,
  onRequestLocation,
  className = '',
}) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Fetch weather data
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
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();

      setWeather({
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
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weather');
      console.error('[WeatherPanel] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, locationName]);

  // Auto-fetch when coordinates available
  useEffect(() => {
    if (latitude && longitude) {
      fetchWeather();
    }
  }, [latitude, longitude, fetchWeather]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    if (!latitude || !longitude) return;
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [latitude, longitude, fetchWeather]);

  // No location permission state
  if (!hasLocationPermission) {
    return (
      <div className={`${className}`}>
        <button
          onClick={onRequestLocation}
          className="w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 
                     border border-gray-700 hover:border-gray-600 
                     transition-all duration-300 hover:shadow-lg group"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center
                          group-hover:bg-gray-600 transition-colors">
              <span className="material-icons text-2xl text-gray-400 group-hover:text-white">
                location_off
              </span>
            </div>
            <div className="text-left flex-1">
              <div className="text-white font-medium">Enable Weather</div>
              <div className="text-gray-400 text-sm">Grant location access</div>
            </div>
            <span className="material-icons text-gray-500 group-hover:text-white transition-colors">
              arrow_forward
            </span>
          </div>
        </button>
      </div>
    );
  }

  // Loading state
  if (loading && !weather) {
    return (
      <div className={`${className}`}>
        <WeatherSkeleton />
      </div>
    );
  }

  // Error state
  if (error && !weather) {
    return (
      <div className={`${className}`}>
        <div className="bg-gradient-to-br from-red-900/30 to-gray-900 rounded-2xl p-4 
                       border border-red-500/30">
          <div className="flex items-center gap-3">
            <span className="material-icons text-2xl text-red-400">cloud_off</span>
            <div className="flex-1">
              <div className="text-red-400 font-medium">Weather Unavailable</div>
              <div className="text-red-400/70 text-sm">{error}</div>
            </div>
            <button
              onClick={fetchWeather}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <span className="material-icons text-red-400">refresh</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  const currentInfo = getWeatherInfo(
    weather.current.weatherCode,
    isNightTime(weather.current.time)
  );
  const isNight = isNightTime(weather.current.time);

  return (
    <div className={`${className}`}>
      <div 
        className={`
          bg-gradient-to-br ${currentInfo.gradient}
          rounded-3xl shadow-2xl overflow-hidden
          transition-all duration-500 ease-out
          ${expanded ? 'max-h-[600px]' : 'max-h-[200px]'}
        `}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-black/10 rounded-full blur-2xl" />
        </div>

        {/* Main content */}
        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-lg font-semibold ${currentInfo.textColor}`}>
                {weather.location.name}
              </h3>
              <p className={`text-sm ${currentInfo.textColor} opacity-70`}>
                {formatTime(weather.current.time)} · {currentInfo.description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchWeather}
                disabled={loading}
                className={`p-2 hover:bg-white/10 rounded-full transition-colors ${
                  loading ? 'animate-spin' : ''
                }`}
              >
                <span className={`material-icons ${currentInfo.textColor}`}>refresh</span>
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <span className={`material-icons ${currentInfo.textColor} transition-transform duration-300 ${
                  expanded ? 'rotate-180' : ''
                }`}>
                  expand_more
                </span>
              </button>
            </div>
          </div>

          {/* Current weather display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <WeatherIcon 
                code={weather.current.weatherCode} 
                size="xl" 
                isNight={isNight}
                animated
              />
              <div>
                <div className={`text-6xl font-extralight ${currentInfo.textColor} leading-none`}>
                  {weather.current.temperature}°
                </div>
                <div className={`text-sm ${currentInfo.textColor} opacity-70 mt-1`}>
                  Feels like {weather.current.feelsLike}°
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className={`grid gap-3 ${currentInfo.textColor}`}>
              <div className="flex items-center gap-2">
                <span className="material-icons text-lg opacity-70">water_drop</span>
                <span className="font-medium">{weather.current.humidity}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-icons text-lg opacity-70">air</span>
                <span className="font-medium">{weather.current.windSpeed} km/h</span>
              </div>
            </div>
          </div>

          {/* Expanded forecast section */}
          <div className={`
            overflow-hidden transition-all duration-500
            ${expanded ? 'opacity-100 mt-6' : 'opacity-0 mt-0 h-0'}
          `}>
            <div className="border-t border-white/20 pt-4">
              <h4 className={`text-xs font-semibold uppercase tracking-wider ${currentInfo.textColor} opacity-70 mb-3`}>
                7-Day Forecast
              </h4>
              
              <div className="space-y-2">
                {weather.daily.map((day, index) => {
                  const dayInfo = getWeatherInfo(day.weatherCode);
                  const isToday = index === 0;

                  return (
                    <div
                      key={day.date}
                      className={`
                        flex items-center gap-3 p-3 rounded-xl
                        ${isToday ? 'bg-white/10' : 'hover:bg-white/5'}
                        transition-colors
                      `}
                    >
                      {/* Day name */}
                      <span className={`w-20 font-medium ${currentInfo.textColor} ${
                        isToday ? 'opacity-100' : 'opacity-80'
                      }`}>
                        {day.dayName}
                      </span>

                      {/* Weather icon with gradient background */}
                      <div className={`
                        w-10 h-10 rounded-xl 
                        bg-gradient-to-br ${dayInfo.gradient}
                        flex items-center justify-center
                        shadow-lg
                      `}>
                        <WeatherIcon code={day.weatherCode} size="sm" />
                      </div>

                      {/* Precipitation */}
                      <div className={`w-12 flex items-center gap-1 ${currentInfo.textColor} opacity-70`}>
                        {day.precipitationProbability !== undefined && day.precipitationProbability > 0 && (
                          <>
                            <span className="material-icons text-sm">water_drop</span>
                            <span className="text-sm">{day.precipitationProbability}%</span>
                          </>
                        )}
                      </div>

                      {/* Temperature range */}
                      <div className="flex-1 flex items-center justify-end gap-3">
                        <span className={`font-semibold ${currentInfo.textColor}`}>
                          {day.tempMax}°
                        </span>
                        
                        {/* Temperature bar */}
                        <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-gradient-to-r from-blue-400 via-green-400 to-orange-400 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, ((day.tempMax - day.tempMin) / 20) * 100)}%`,
                              marginLeft: `${Math.max(0, ((day.tempMin) / 40) * 100)}%`,
                            }}
                          />
                        </div>

                        <span className={`${currentInfo.textColor} opacity-60`}>
                          {day.tempMin}°
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className={`mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs ${currentInfo.textColor} opacity-50`}>
              <span>Data: Open-Meteo (Free API)</span>
              <span>Updated {new Date(weather.lastUpdated).toLocaleTimeString('en-ZA')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherPanel;
