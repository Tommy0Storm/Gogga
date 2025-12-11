'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sun, Moon, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Wind, Droplets, Thermometer, RefreshCw, X, ChevronLeft, AlertTriangle, CloudHail } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface DailyForecast {
  date: string;
  dayName: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability?: number;
  uvIndexMax?: number;
  windSpeedMax?: number;
}

interface WeatherData {
  location: {
    name: string;
    lat: number;
    lon: number;
  };
  current: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    uvIndex?: number;
  };
  daily: DailyForecast[];
  lastUpdated: number;
}

interface WeatherSlidePanelProps {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationJustDetermined?: boolean;
  autoHideDelay?: number;
  onVisibilityChange?: (visible: boolean) => void;
  /** External trigger to show weather for a specific location (from AI tool call) */
  externalLocation?: { lat: number; lon: number; name: string } | null;
}

// ============================================================================
// WEATHER ICONS (Lucide - guaranteed to render)
// ============================================================================

const WeatherIcon: React.FC<{ code: number; size?: number; className?: string; isNight?: boolean }> = ({ 
  code, 
  size = 20, 
  className = '',
  isNight = false 
}) => {
  const props = { size, className };
  
  // Clear
  if (code === 0 || code === 1) {
    return isNight ? <Moon {...props} /> : <Sun {...props} />;
  }
  // Cloudy
  if (code === 2 || code === 3) {
    return <Cloud {...props} />;
  }
  // Fog
  if (code >= 45 && code <= 48) {
    return <CloudFog {...props} />;
  }
  // Drizzle/Rain
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return <CloudRain {...props} />;
  }
  // Snow
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return <CloudSnow {...props} />;
  }
  // Hail storms
  if (code === 96 || code === 99) {
    return <CloudHail {...props} />;
  }
  // Thunderstorm
  if (code >= 95) {
    return <CloudLightning {...props} />;
  }
  
  return <Cloud {...props} />;
};

const getWeatherDescription = (code: number): string => {
  const descMap: Record<number, string> = {
    0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Rime Fog',
    51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
    61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
    66: 'Freezing Rain', 67: 'Heavy Freezing Rain',
    71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
    80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
    85: 'Snow Showers', 86: 'Heavy Snow Showers',
    95: 'Thunderstorm', 96: 'Hail Storm', 99: 'Severe Storm',
  };
  return descMap[code] || 'Unknown';
};

const getDayName = (dateStr: string, index: number): string => {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return new Date(dateStr).toLocaleDateString('en-ZA', { weekday: 'short' });
};

const isNightTime = (): boolean => {
  const hour = new Date().getHours();
  return hour < 6 || hour >= 19;
};

// UV Index severity
const getUVLevel = (uv: number): { label: string; color: string; isWarning: boolean } => {
  if (uv >= 11) return { label: 'Extreme', color: 'text-red-600 bg-red-100', isWarning: true };
  if (uv >= 8) return { label: 'Very High', color: 'text-red-500 bg-red-50', isWarning: true };
  if (uv >= 6) return { label: 'High', color: 'text-orange-500 bg-orange-50', isWarning: true };
  if (uv >= 3) return { label: 'Moderate', color: 'text-yellow-600 bg-yellow-50', isWarning: false };
  return { label: 'Low', color: 'text-green-600 bg-green-50', isWarning: false };
};

// ============================================================================
// COMPONENT
// ============================================================================

export const WeatherSlidePanel: React.FC<WeatherSlidePanelProps> = ({
  latitude,
  longitude,
  locationName,
  locationJustDetermined = false,
  autoHideDelay = 5000,
  onVisibilityChange,
  externalLocation,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoHideTimer = useRef<NodeJS.Timeout | null>(null);
  const hasAutoShown = useRef(false);

  // Determine effective coordinates (external takes priority)
  const effectiveLat = externalLocation?.lat ?? latitude;
  const effectiveLon = externalLocation?.lon ?? longitude;
  const effectiveName = externalLocation?.name ?? locationName;

  const fetchWeather = useCallback(async (lat: number, lon: number, name?: string) => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', lat.toString());
      url.searchParams.set('longitude', lon.toString());
      url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index');
      url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max');
      url.searchParams.set('timezone', 'auto');
      url.searchParams.set('forecast_days', '7');

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();

      setWeather({
        location: {
          name: name || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
          lat,
          lon,
        },
        current: {
          temperature: Math.round(data.current.temperature_2m),
          feelsLike: Math.round(data.current.apparent_temperature),
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m),
          weatherCode: data.current.weather_code,
          uvIndex: data.current.uv_index,
        },
        daily: data.daily.time.map((date: string, i: number) => ({
          date,
          dayName: getDayName(date, i),
          weatherCode: data.daily.weather_code[i],
          tempMax: Math.round(data.daily.temperature_2m_max[i]),
          tempMin: Math.round(data.daily.temperature_2m_min[i]),
          precipitationProbability: data.daily.precipitation_probability_max?.[i],
          uvIndexMax: data.daily.uv_index_max?.[i],
          windSpeedMax: data.daily.wind_speed_10m_max?.[i],
        })),
        lastUpdated: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weather');
    } finally {
      setLoading(false);
    }
  }, []);

  const openPanel = useCallback(() => {
    setIsOpen(true);
    onVisibilityChange?.(true);
  }, [onVisibilityChange]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    onVisibilityChange?.(false);
  }, [onVisibilityChange]);

  // Auto-show when location is determined
  useEffect(() => {
    if (locationJustDetermined && effectiveLat && effectiveLon && !hasAutoShown.current) {
      hasAutoShown.current = true;
      fetchWeather(effectiveLat, effectiveLon, effectiveName).then(() => {
        openPanel();
        autoHideTimer.current = setTimeout(() => closePanel(), autoHideDelay);
      });
    }
    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, [locationJustDetermined, effectiveLat, effectiveLon, effectiveName, fetchWeather, openPanel, closePanel, autoHideDelay]);

  // External location trigger (from AI tool call)
  useEffect(() => {
    if (externalLocation) {
      fetchWeather(externalLocation.lat, externalLocation.lon, externalLocation.name).then(() => {
        openPanel();
        autoHideTimer.current = setTimeout(() => closePanel(), autoHideDelay);
      });
    }
  }, [externalLocation, fetchWeather, openPanel, closePanel, autoHideDelay]);

  // Fetch weather when coordinates change
  useEffect(() => {
    if (effectiveLat && effectiveLon && !weather) {
      fetchWeather(effectiveLat, effectiveLon, effectiveName);
    }
  }, [effectiveLat, effectiveLon, effectiveName, fetchWeather, weather]);

  const handleMouseEnter = () => {
    if (autoHideTimer.current) {
      clearTimeout(autoHideTimer.current);
      autoHideTimer.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (isOpen && !autoHideTimer.current) {
      autoHideTimer.current = setTimeout(() => closePanel(), 2000);
    }
  };

  const night = isNightTime();
  const hasUVWarning = weather?.current.uvIndex && weather.current.uvIndex >= 8;

  return (
    <>
      {/* Toggle Tab - Right Edge */}
      <button
        onClick={() => (isOpen ? closePanel() : openPanel())}
        className={`
          fixed right-0 top-1/2 -translate-y-1/2 z-50
          w-8 h-20
          bg-gradient-to-b from-gray-100 to-gray-200
          border-l border-t border-b border-gray-300
          rounded-l-lg shadow-md
          flex flex-col items-center justify-center gap-0.5
          transition-all duration-300 ease-out
          hover:w-10 hover:shadow-lg
          ${isOpen ? 'opacity-40' : 'opacity-100'}
          ${hasUVWarning ? 'border-l-red-400' : ''}
        `}
        title={isOpen ? 'Close Gogga Weather' : 'Show 7-day forecast'}
      >
        {weather ? (
          <>
            <WeatherIcon code={weather.current.weatherCode} size={16} className="text-gray-800" isNight={night} />
            <span className="text-gray-900 text-[12px] font-bold">
              {weather.current.temperature}°
            </span>
            {hasUVWarning && <AlertTriangle size={10} className="text-red-500" />}
          </>
        ) : (
          <Cloud size={16} className={`text-gray-400 ${loading ? 'animate-pulse' : ''}`} />
        )}
        <ChevronLeft size={12} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Slide Panel */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          fixed right-0 top-0 h-full z-40
          w-80
          transform transition-transform duration-500 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="h-full bg-gradient-to-b from-gray-50 via-gray-100 to-gray-200 shadow-2xl flex flex-col border-l border-gray-300">
          
          {/* Header */}
          <div className="px-3 pt-3 pb-2 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-gray-900 tracking-tight">
                  Gogga Weather
                </h2>
                <p className="text-[13px] text-gray-500">
                  {weather?.location.name || 'Loading...'}
                </p>
              </div>
              <button
                onClick={closePanel}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X size={14} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Current Weather - Compact */}
          {weather && (
            <div className="px-3 py-2 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center flex-shrink-0">
                  <WeatherIcon code={weather.current.weatherCode} size={28} className="text-gray-800" isNight={night} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-3xl font-light text-gray-900 leading-none">
                    {weather.current.temperature}°
                  </div>
                  <div className="text-[12px] text-gray-600 truncate">
                    {getWeatherDescription(weather.current.weatherCode)}
                  </div>
                </div>
                <div className="text-right text-[13px] text-gray-500 space-y-0.5 flex-shrink-0">
                  <div className="flex items-center justify-end gap-1">
                    <Thermometer size={10} />
                    <span>{weather.current.feelsLike}°</span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Droplets size={10} />
                    <span>{weather.current.humidity}%</span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Wind size={10} />
                    <span>{weather.current.windSpeed}km/h</span>
                  </div>
                </div>
              </div>
              
              {/* UV Index - Always show */}
              {weather.current.uvIndex !== undefined && (
                <div className={`mt-2 px-2 py-1 rounded text-[13px] font-medium flex items-center gap-1 ${getUVLevel(weather.current.uvIndex).color}`}>
                  {getUVLevel(weather.current.uvIndex).isWarning && <AlertTriangle size={10} />}
                  UV Index: {Math.round(weather.current.uvIndex)} ({getUVLevel(weather.current.uvIndex).label})
                </div>
              )}
            </div>
          )}

          {/* 7-Day Forecast */}
          <div className="flex-1 overflow-y-auto">
            {loading && !weather && (
              <div className="flex items-center justify-center h-20 text-gray-400 text-[12px]">
                <RefreshCw size={12} className="animate-spin mr-1" />
                Loading...
              </div>
            )}

            {error && (
              <div className="m-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-[12px]">
                {error}
              </div>
            )}

            {weather && (
              <div className="divide-y divide-gray-200">
                {weather.daily.map((day, index) => {
                  const isToday = index === 0;
                  const uvHigh = typeof day.uvIndexMax === 'number' && day.uvIndexMax >= 8;
                  const isWindy = typeof day.windSpeedMax === 'number' && day.windSpeedMax >= 25;
                  const isStormy = day.weatherCode >= 95;
                  const isHail = day.weatherCode === 96 || day.weatherCode === 99;
                  
                  return (
                    <div
                      key={day.date}
                      className={`
                        flex items-center justify-between px-4 py-2 gap-3
                        ${isToday ? 'bg-gray-100' : 'hover:bg-gray-50'}
                        ${isStormy ? 'border-l-2 border-l-purple-500' : uvHigh ? 'border-l-2 border-l-orange-400' : ''}
                        transition-colors duration-150
                      `}
                    >
                      {/* Day Name */}
                      <div className={`text-[13px] font-semibold flex-shrink-0 w-auto min-w-[52px] ${isToday ? 'text-gray-900' : 'text-gray-700'}`}>
                        {day.dayName}
                      </div>

                      {/* Weather Icon - Fixed size */}
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center relative flex-shrink-0">
                        <WeatherIcon code={day.weatherCode} size={18} className="text-gray-800" />
                        {isWindy && !isStormy && (
                          <Wind size={8} className="absolute -top-0.5 -right-0.5 text-gray-600" />
                        )}
                        {isHail && (
                          <span className="absolute -bottom-0.5 -right-0.5 text-[13px]">❄</span>
                        )}
                      </div>

                      {/* Weather Details - Middle (flexible) */}
                      <div className="flex-1 flex items-center gap-2 text-[13px] text-gray-500 min-w-0">
                        {day.precipitationProbability !== undefined && day.precipitationProbability > 0 && (
                          <span className="flex items-center gap-0.5 flex-shrink-0">
                            <Droplets size={8} className="flex-shrink-0" />
                            {day.precipitationProbability}%
                          </span>
                        )}
                        {day.windSpeedMax !== undefined && (
                          <span className={`flex items-center gap-0.5 flex-shrink-0 ${isWindy ? 'text-gray-700 font-medium' : ''}`}>
                            <Wind size={8} className="flex-shrink-0" />
                            {Math.round(day.windSpeedMax)}
                          </span>
                        )}
                        {uvHigh && (
                          <span className="flex items-center gap-0.5 text-orange-600 flex-shrink-0">
                            <AlertTriangle size={8} className="flex-shrink-0" />
                            UV{Math.round(day.uvIndexMax!)}
                          </span>
                        )}
                      </div>

                      {/* Temperature - Right */}
                      <div className="flex items-center justify-end gap-0.5 text-right flex-shrink-0">
                        <span className="text-[13px] font-bold text-gray-900">
                          {day.tempMax}°
                        </span>
                        <span className="text-[13px] text-gray-400">/</span>
                        <span className="text-[12px] text-gray-500">
                          {day.tempMin}°
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-gray-200 bg-gray-100">
            <div className="flex items-center justify-between text-[13px] text-gray-400">
              <span>Open-Meteo API</span>
              {weather && (
                <button
                  onClick={() => effectiveLat && effectiveLon && fetchWeather(effectiveLat, effectiveLon, effectiveName)}
                  disabled={loading}
                  className="flex items-center gap-0.5 hover:text-gray-600 transition-colors"
                >
                  <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={closePanel}
          className="fixed inset-0 bg-black/10 z-30 transition-opacity duration-300"
        />
      )}
    </>
  );
};

export default WeatherSlidePanel;
