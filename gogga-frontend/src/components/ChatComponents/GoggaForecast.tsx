/**
 * Gogga 7-Day Forecast Component
 * SA-themed weather display with funny comments and export functionality
 * 
 * Features:
 * - Monochrome Gogga theme (grey gradients, black icons)
 * - Dynamic SA-themed weather comments
 * - Export as PNG using html2canvas
 * - Responsive design
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudSun,
  CloudMoon,
  CloudHail,
  Wind,
  Droplets,
  Thermometer,
  X,
  Download,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Sunrise,
  Sunset,
  Calendar,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import type { WeatherForecast, ForecastDay } from '@/lib/weatherService';
import { getWeatherComment, getDayName, getUVLevel } from '@/lib/weatherService';

// ============================================================================
// Types
// ============================================================================

interface GoggaForecastProps {
  forecast: WeatherForecast | null;
  isLoading?: boolean;
  error?: string | null;
  onClose?: () => void;
  onRefresh?: () => void;
  showCloseButton?: boolean;
  /** Compact mode for embedding in sidebars */
  compact?: boolean;
}

// ============================================================================
// Weather Icon Component
// ============================================================================

const WeatherIcon: React.FC<{ 
  code: number; 
  isDay?: number;
  size?: number; 
  className?: string;
}> = ({ code, isDay = 1, size = 24, className = '' }) => {
  const props = { size, className };
  
  // WeatherAPI condition codes
  // Clear/Sunny
  if (code === 1000) return isDay ? <Sun {...props} /> : <Moon {...props} />;
  
  // Partly cloudy
  if (code === 1003) return isDay ? <CloudSun {...props} /> : <CloudMoon {...props} />;
  
  // Cloudy/Overcast
  if (code >= 1006 && code <= 1009) return <Cloud {...props} />;
  
  // Mist/Fog
  if (code >= 1030 && code <= 1147) return <CloudFog {...props} />;
  
  // Thunderstorm (check before rain)
  if (code === 1087 || (code >= 1273 && code <= 1282)) {
    return <CloudLightning {...props} />;
  }
  
  // Hail/Ice
  if (
    (code >= 1237 && code <= 1264) ||
    code === 1069 || code === 1072 ||
    code === 1198 || code === 1201
  ) {
    return <CloudHail {...props} />;
  }
  
  // Snow
  if (
    code === 1066 || code === 1114 || code === 1117 ||
    (code >= 1210 && code <= 1225) ||
    (code >= 1255 && code <= 1258)
  ) {
    return <CloudSnow {...props} />;
  }
  
  // Rain/Drizzle
  if (
    code === 1063 ||
    (code >= 1150 && code <= 1195) ||
    (code >= 1240 && code <= 1246)
  ) {
    return <CloudRain {...props} />;
  }
  
  // Default
  return <Cloud {...props} />;
};

// ============================================================================
// Main Component
// ============================================================================

export const GoggaForecast: React.FC<GoggaForecastProps> = ({
  forecast,
  isLoading = false,
  error = null,
  onClose,
  onRefresh,
  showCloseButton = true,
  compact = false,
}) => {
  const forecastRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [funnyComment, setFunnyComment] = useState<string>('');
  
  // Generate a random comment when forecast changes
  useEffect(() => {
    if (forecast) {
      setFunnyComment(getWeatherComment(forecast));
    }
  }, [forecast]);
  
  /**
   * Export the forecast as PNG
   */
  const handleExport = useCallback(async () => {
    if (!forecastRef.current || !forecast) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(forecastRef.current, {
        backgroundColor: '#f9fafb', // Match bg-gray-50
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
      });
      
      // Create download link
      const link = document.createElement('a');
      link.download = `gogga-weather-${forecast.location.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('[GoggaForecast] Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [forecast]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-gradient-to-b from-gray-50 to-gray-100 rounded-2xl p-6 ${compact ? 'min-h-[200px]' : 'min-h-[400px]'} relative`}>
        {/* Close button - always visible */}
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 hover:bg-gray-200 rounded-lg transition-colors z-10"
            title="Close"
          >
            <X size={18} className="text-gray-600" />
          </button>
        )}
        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
          <RefreshCw size={32} className="animate-spin" />
          <span className="text-sm">Fetching weather...</span>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className={`bg-gradient-to-b from-gray-50 to-gray-100 rounded-2xl p-6 ${compact ? 'min-h-[200px]' : 'min-h-[400px]'} relative`}>
        {/* Close button - always visible */}
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 hover:bg-gray-200 rounded-lg transition-colors z-10"
            title="Close"
          >
            <X size={18} className="text-gray-600" />
          </button>
        )}
        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 text-center">
          <AlertTriangle size={32} className="text-amber-500" />
          <span className="text-sm font-medium">Weather Unavailable</span>
          <span className="text-xs text-gray-400 max-w-[250px]">
            {error.includes('API') ? 'Weather service temporarily unavailable. Please try again later.' : error}
          </span>
          <div className="flex gap-2 mt-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Try Again
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // No forecast data
  if (!forecast) {
    return (
      <div className={`bg-gradient-to-b from-gray-50 to-gray-100 rounded-2xl p-6 ${compact ? 'min-h-[200px]' : 'min-h-[400px]'} relative`}>
        {/* Close button - always visible */}
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 hover:bg-gray-200 rounded-lg transition-colors z-10"
            title="Close"
          >
            <X size={18} className="text-gray-600" />
          </button>
        )}
        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 text-center">
          <Cloud size={32} />
          <span className="text-sm">No weather data available</span>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }
  
  const current = forecast.current;
  const location = forecast.location;
  const days = forecast.forecast.forecastday;
  const today = days[0];
  const uvLevel = getUVLevel(current.uv);
  
  // Guard against empty forecast data
  if (!today) {
    return (
      <div className={`bg-gradient-to-b from-gray-50 to-gray-100 rounded-2xl p-6 ${compact ? 'min-h-[200px]' : 'min-h-[400px]'} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-3 text-gray-500 text-center">
          <Cloud size={32} />
          <span className="text-sm">No forecast data available</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-b from-gray-50 via-gray-100 to-gray-200 rounded-2xl shadow-xl overflow-hidden">
      {/* Header with controls */}
      <div className="px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
            <Cloud size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm font-quicksand tracking-tight">
              Gogga Weather
            </h2>
            <p className="text-gray-400 text-xs">7-Day Forecast</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Export as PNG"
          >
            {isExporting ? (
              <RefreshCw size={16} className="text-white animate-spin" />
            ) : (
              <Download size={16} className="text-white" />
            )}
          </button>
          
          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className="text-white" />
            </button>
          )}
          
          {/* Close button */}
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Close"
            >
              <X size={16} className="text-white" />
            </button>
          )}
        </div>
      </div>
      
      {/* Exportable content area */}
      <div ref={forecastRef} className="bg-gradient-to-b from-gray-50 via-gray-100 to-gray-200 p-4">
        {/* Location */}
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={16} className="text-gray-600" />
          <span className="text-gray-800 font-semibold">{location.name}</span>
          <span className="text-gray-500 text-sm">{location.region}, {location.country}</span>
        </div>
        
        {/* Funny SA Comment */}
        <div className="mb-4 px-3 py-2 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl border-l-4 border-gray-900">
          <p className="text-gray-800 text-sm font-medium italic">
            "{funnyComment}"
          </p>
          <p className="text-gray-500 text-xs mt-1">— Gogga</p>
        </div>
        
        {/* Current Weather Card */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <div className="flex items-start justify-between">
            {/* Left: Icon + Temp */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                <WeatherIcon 
                  code={current.condition.code} 
                  isDay={current.is_day} 
                  size={40} 
                  className="text-gray-800" 
                />
              </div>
              <div>
                <div className="text-4xl font-light text-gray-900">
                  {Math.round(current.temp_c)}°C
                </div>
                <div className="text-gray-600 text-sm">
                  {current.condition.text}
                </div>
                <div className="text-gray-500 text-xs">
                  Feels like {Math.round(current.feelslike_c)}°C
                </div>
              </div>
            </div>
            
            {/* Right: Details */}
            <div className="text-right space-y-1.5 text-sm">
              <div className="flex items-center justify-end gap-1.5 text-gray-600">
                <Droplets size={14} className="text-gray-500" />
                <span>{current.humidity}%</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 text-gray-600">
                <Wind size={14} className="text-gray-500" />
                <span>{Math.round(current.wind_kph)} km/h {current.wind_dir}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 text-gray-600">
                <Thermometer size={14} className="text-gray-500" />
                <span>{today.day.maxtemp_c}° / {today.day.mintemp_c}°</span>
              </div>
            </div>
          </div>
          
          {/* UV Warning */}
          {uvLevel.isWarning && (
            <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${uvLevel.color}`}>
              <AlertTriangle size={14} />
              UV Index: {current.uv} ({uvLevel.label}) - Sun protection essential!
            </div>
          )}
          
          {/* Sunrise/Sunset */}
          <div className="mt-3 flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Sunrise size={14} />
              <span>{today.astro.sunrise}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sunset size={14} />
              <span>{today.astro.sunset}</span>
            </div>
          </div>
        </div>
        
        {/* 7-Day Forecast Grid */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
            <Calendar size={14} className="text-gray-600" />
            <span className="text-sm font-semibold text-gray-700">7-Day Forecast</span>
          </div>
          
          <div className="divide-y divide-gray-100">
            {days.map((day, index) => {
              const dayName = getDayName(day.date, index);
              const isToday = index === 0;
              const uvHigh = day.day.uv >= 8;
              const rainLikely = day.day.daily_chance_of_rain >= 50;
              const isStormy = day.day.condition.code === 1087 || 
                (day.day.condition.code >= 1273 && day.day.condition.code <= 1282);
              
              return (
                <div
                  key={day.date}
                  className={`
                    flex items-center px-4 py-3 gap-3
                    ${isToday ? 'bg-gray-50' : 'hover:bg-gray-50'}
                    ${isStormy ? 'border-l-4 border-purple-500' : 
                      uvHigh ? 'border-l-4 border-orange-400' : 
                      rainLikely ? 'border-l-4 border-blue-400' : ''}
                    transition-colors
                  `}
                >
                  {/* Day Name */}
                  <div className={`w-20 text-sm font-semibold ${isToday ? 'text-gray-900' : 'text-gray-700'}`}>
                    {dayName}
                  </div>
                  
                  {/* Weather Icon */}
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                    <WeatherIcon code={day.day.condition.code} size={22} className="text-gray-800" />
                  </div>
                  
                  {/* Condition + Details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700 truncate">
                      {day.day.condition.text}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {rainLikely && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Droplets size={10} />
                          {day.day.daily_chance_of_rain}%
                        </span>
                      )}
                      {day.day.maxwind_kph > 30 && (
                        <span className="flex items-center gap-1">
                          <Wind size={10} />
                          {Math.round(day.day.maxwind_kph)}km/h
                        </span>
                      )}
                      {uvHigh && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <AlertTriangle size={10} />
                          UV {day.day.uv}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Temperature */}
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">
                      {Math.round(day.day.maxtemp_c)}°
                    </span>
                    <span className="text-sm text-gray-400 mx-1">/</span>
                    <span className="text-sm text-gray-500">
                      {Math.round(day.day.mintemp_c)}°
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
          <span>Last updated: {new Date(current.last_updated).toLocaleTimeString('en-ZA', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}</span>
          <span className="flex items-center gap-1">
            Powered by WeatherAPI
          </span>
        </div>
        
        {/* Gogga Branding Watermark */}
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-400 font-quicksand">
            🦗 Gogga Weather • South Africa
          </span>
        </div>
      </div>
    </div>
  );
};

export default GoggaForecast;
