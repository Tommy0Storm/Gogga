'use client';

import React, { useState } from 'react';

// ============================================================================
// TYPES (shared with WeatherForecast)
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

interface WeatherWidgetProps {
  /** Weather data from useWeather hook */
  weather: WeatherData | null;
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Refresh callback */
  onRefresh?: () => void;
  /** Click to expand callback */
  onExpand?: () => void;
  /** Custom className */
  className?: string;
}

// ============================================================================
// WEATHER CODE MAPPING
// ============================================================================

interface WeatherInfo {
  description: string;
  icon: string;
  gradient: string;
}

const getWeatherInfo = (code: number, isNight = false): WeatherInfo => {
  const weatherMap: Record<number, WeatherInfo> = {
    0: { description: 'Clear', icon: isNight ? 'nights_stay' : 'wb_sunny', gradient: 'from-amber-400 to-orange-500' },
    1: { description: 'Mainly clear', icon: isNight ? 'nights_stay' : 'wb_sunny', gradient: 'from-amber-300 to-orange-400' },
    2: { description: 'Partly cloudy', icon: 'partly_cloudy_day', gradient: 'from-blue-400 to-slate-500' },
    3: { description: 'Overcast', icon: 'cloud', gradient: 'from-slate-500 to-slate-700' },
    45: { description: 'Foggy', icon: 'foggy', gradient: 'from-gray-400 to-gray-600' },
    48: { description: 'Rime fog', icon: 'foggy', gradient: 'from-gray-300 to-gray-500' },
    51: { description: 'Light drizzle', icon: 'grain', gradient: 'from-blue-400 to-blue-600' },
    53: { description: 'Drizzle', icon: 'grain', gradient: 'from-blue-500 to-blue-700' },
    55: { description: 'Dense drizzle', icon: 'grain', gradient: 'from-blue-600 to-blue-800' },
    61: { description: 'Light rain', icon: 'rainy', gradient: 'from-blue-500 to-indigo-600' },
    63: { description: 'Rain', icon: 'rainy', gradient: 'from-blue-600 to-indigo-700' },
    65: { description: 'Heavy rain', icon: 'rainy', gradient: 'from-blue-700 to-indigo-800' },
    80: { description: 'Light showers', icon: 'rainy_light', gradient: 'from-blue-400 to-teal-500' },
    81: { description: 'Showers', icon: 'rainy_heavy', gradient: 'from-blue-500 to-teal-600' },
    82: { description: 'Heavy showers', icon: 'rainy_heavy', gradient: 'from-blue-600 to-teal-700' },
    95: { description: 'Thunderstorm', icon: 'thunderstorm', gradient: 'from-purple-700 to-gray-900' },
    96: { description: 'Thunderstorm + hail', icon: 'thunderstorm', gradient: 'from-purple-800 to-gray-900' },
    99: { description: 'Severe storm', icon: 'thunderstorm', gradient: 'from-red-800 to-gray-900' },
  };

  return weatherMap[code] || { description: 'Unknown', icon: 'help', gradient: 'from-gray-500 to-gray-700' };
};

const isNightTime = (isoString?: string): boolean => {
  const date = isoString ? new Date(isoString) : new Date();
  const hour = date.getHours();
  return hour < 6 || hour >= 18;
};

// ============================================================================
// COMPONENT
// ============================================================================

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  weather,
  isLoading = false,
  error = null,
  onRefresh,
  onExpand,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Loading state
  if (isLoading && !weather) {
    return (
      <div className={`${className}`}>
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-600 rounded-xl" />
            <div className="flex-1">
              <div className="h-3 bg-gray-600 rounded w-20 mb-2" />
              <div className="h-6 bg-gray-600 rounded w-12" />
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
        <div className="bg-gradient-to-br from-red-900/30 to-gray-900 rounded-2xl p-3 border border-red-500/20">
          <div className="flex items-center gap-2 text-red-400">
            <span className="material-icons text-lg">cloud_off</span>
            <span className="text-xs flex-1">Weather unavailable</span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <span className="material-icons text-sm">refresh</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!weather) {
    return (
      <div className={`${className}`}>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-3 border border-gray-700/50">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="material-icons text-lg">location_off</span>
            <span className="text-xs">Location required</span>
          </div>
        </div>
      </div>
    );
  }

  const info = getWeatherInfo(weather.current.weatherCode, isNightTime(weather.current.time));
  const nextDay = weather.daily[1];

  return (
    <div className={`${className}`}>
      <button
        onClick={onExpand}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          w-full text-left
          bg-gradient-to-br ${info.gradient}
          rounded-2xl p-4 shadow-lg
          hover:shadow-xl hover:scale-[1.02]
          active:scale-[0.98]
          transition-all duration-300 ease-out
          relative overflow-hidden group
        `}
      >
        {/* Decorative circle */}
        <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full transition-transform duration-500 group-hover:scale-150" />
        
        {/* Refresh indicator */}
        {isLoading && (
          <div className="absolute top-2 right-2">
            <span className="material-icons text-white/50 text-sm animate-spin">refresh</span>
          </div>
        )}

        <div className="relative z-10">
          {/* Main row */}
          <div className="flex items-center gap-3">
            {/* Weather icon */}
            <div className="relative">
              <span className={`material-icons text-5xl text-white drop-shadow-lg ${
                weather.current.weatherCode >= 95 ? 'animate-pulse' : ''
              }`}>
                {info.icon}
              </span>
            </div>

            {/* Temperature & location */}
            <div className="flex-1 min-w-0">
              <div className="text-3xl font-bold text-white leading-none">
                {weather.current.temperature}°
              </div>
              <div className="text-white/70 text-xs truncate mt-0.5">
                {weather.location.name}
              </div>
            </div>

            {/* Expand hint */}
            <div className={`transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
              <span className="material-icons text-white/50 text-lg">open_in_full</span>
            </div>
          </div>

          {/* Details row (shows on hover) */}
          <div className={`
            mt-3 pt-3 border-t border-white/20
            grid grid-cols-3 gap-2
            transition-all duration-300
            ${isHovered ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0 overflow-hidden'}
          `}>
            <div className="text-center">
              <div className="text-white/60 text-[10px] uppercase tracking-wider">Feels</div>
              <div className="text-white font-semibold text-sm">{weather.current.feelsLike}°</div>
            </div>
            <div className="text-center">
              <div className="text-white/60 text-[10px] uppercase tracking-wider">Humidity</div>
              <div className="text-white font-semibold text-sm">{weather.current.humidity}%</div>
            </div>
            <div className="text-center">
              <div className="text-white/60 text-[10px] uppercase tracking-wider">Wind</div>
              <div className="text-white font-semibold text-sm">{weather.current.windSpeed}km/h</div>
            </div>
          </div>

          {/* Tomorrow preview (shows when not hovered) */}
          {nextDay && (
            <div className={`
              mt-2 flex items-center gap-2 text-white/60 text-xs
              transition-opacity duration-300
              ${isHovered ? 'opacity-0' : 'opacity-100'}
            `}>
              <span className="material-icons text-sm">{getWeatherInfo(nextDay.weatherCode).icon}</span>
              <span>Tomorrow: {nextDay.tempMax}° / {nextDay.tempMin}°</span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
};

export default WeatherWidget;
