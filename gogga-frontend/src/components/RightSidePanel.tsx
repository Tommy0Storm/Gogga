/**
 * RightSidePanel
 * 
 * Unified slide-out panel from the right edge with VERTICAL tabs:
 * - Tools (ToolShed)
 * - Documents (RAG Document Store)  
 * - Weather (Gogga Weather with 7-day forecast)
 * 
 * Monochrome design with grey gradients, Quicksand font.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Wrench, FileText, Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudFog, Wind, Upload, Trash2 } from 'lucide-react';
import { useDocumentStore } from '@/lib/documentStore';
import { useToolShed, ToolDefinition, ForcedTool } from '@/lib/toolshedStore';
import { useRightPanel } from '@/hooks/useRightPanel';

// Weather types
interface DayForecast {
  date: string;
  dayName: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  precipitation: number;
  windSpeed: number;
}

interface WeatherData {
  current: {
    temp: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    description: string;
  };
  daily: DayForecast[];
  location: string;
}

// Weather code to description mapping
function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight showers',
    81: 'Moderate showers',
    82: 'Violent showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with heavy hail',
  };
  return descriptions[code] || 'Unknown';
}

// Weather icon component
function WeatherIcon({ code, size = 24, className = '' }: { code: number; size?: number; className?: string }) {
  const iconProps = { size, className };
  
  if (code === 0 || code === 1) return <Sun {...iconProps} />;
  if (code >= 2 && code <= 3) return <Cloud {...iconProps} />;
  if (code >= 45 && code <= 48) return <CloudFog {...iconProps} />;
  if (code >= 51 && code <= 67) return <CloudRain {...iconProps} />;
  if (code >= 71 && code <= 86) return <CloudSnow {...iconProps} />;
  if (code >= 95) return <CloudLightning {...iconProps} />;
  return <Wind {...iconProps} />;
}

// Tools Tab Content
interface ToolsTabContentProps {
  tools: ToolDefinition[];
  isLoading: boolean;
  forcedTool: ForcedTool | null;
  onForceTool: (tool: ToolDefinition) => void;
  onClearForcedTool: () => void;
}

function ToolsTabContent({ tools, isLoading, forcedTool, onForceTool, onClearForcedTool }: ToolsTabContentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-400 border-t-transparent"></div>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <Wrench size={32} className="mx-auto mb-2 opacity-50" />
        <p>No tools available for your tier</p>
      </div>
    );
  }

  const forcedToolName = forcedTool?.tool?.name;

  return (
    <div className="space-y-2">
      {tools.map((tool) => {
        const isForced = forcedToolName === tool.name;
        return (
          <div
            key={tool.name}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              isForced
                ? 'border-gray-600 bg-gray-800 text-white'
                : 'border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50'
            }`}
            onClick={() => isForced ? onClearForcedTool() : onForceTool(tool)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{tool.name}</span>
              {isForced && (
                <span className="text-xs bg-gray-600 text-white px-2 py-0.5 rounded">FORCED</span>
              )}
            </div>
            <p className={`text-xs mt-1 ${isForced ? 'text-gray-300' : 'text-gray-500'}`}>{tool.description}</p>
            <div className={`text-xs mt-1 ${isForced ? 'text-gray-400' : 'text-gray-400'}`}>
              {tool.tierRequired.toUpperCase()} tier
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Documents Tab Content
interface DocumentsTabContentProps {
  documents: import('@/lib/db').Document[];
  selectedDocIds: number[];
  isLoading: boolean;
  isEmbedding: boolean;
  isRAGEnabled: boolean;
  canUpload: boolean;
  tier: 'free' | 'jive' | 'jigga';
  maxDocsPerSession: number;
  storageUsage: { totalMB: number; maxMB: number; usedPercent: number; remainingMB: number };
  onUpload: (file: File) => Promise<void>;
  onRemove: (docId: number) => Promise<void>;
}

function DocumentsTabContent({
  documents,
  selectedDocIds,
  isLoading,
  isEmbedding,
  isRAGEnabled,
  canUpload,
  tier,
  maxDocsPerSession,
  storageUsage,
  onUpload,
  onRemove,
}: DocumentsTabContentProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadError(null);
    try {
      await onUpload(file);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // FREE tier - show upgrade message
  if (!isRAGEnabled) {
    return (
      <div className="text-center text-gray-500 py-8">
        <FileText size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Document Store</p>
        <p className="text-xs mt-2">Upgrade to JIVE or JIGGA for document uploads</p>
        <div className="mt-4 p-3 bg-gray-100 rounded-lg text-xs text-gray-600">
          <p><strong>JIVE:</strong> 5 docs, keyword search</p>
          <p><strong>JIGGA:</strong> 20 docs, semantic search</p>
        </div>
      </div>
    );
  }

  const remainingSlots = maxDocsPerSession - documents.length;
  const totalActive = documents.length + selectedDocIds.length;

  return (
    <div className="space-y-4">
      {/* Storage Usage Bar */}
      <div className="text-xs text-gray-500">
        <div className="flex justify-between mb-1">
          <span>Storage</span>
          <span>{storageUsage.totalMB.toFixed(1)}MB / {storageUsage.maxMB}MB</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all ${storageUsage.usedPercent > 80 ? 'bg-red-400' : 'bg-gray-600'}`}
            style={{ width: `${Math.min(storageUsage.usedPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Document Count */}
      <div className="text-sm text-gray-600">
        <span className="font-medium">{documents.length}</span>/{maxDocsPerSession} documents
        {tier === 'jigga' && selectedDocIds.length > 0 && (
          <span className="text-xs text-gray-400 ml-2">
            (+{selectedDocIds.length} from other sessions)
          </span>
        )}
      </div>

      {/* Upload Button */}
      {canUpload && remainingSlots > 0 && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf,.md,.json,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isEmbedding}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isLoading || isEmbedding ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                {isEmbedding ? 'Processing...' : 'Uploading...'}
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload Document
              </>
            )}
          </button>
          {uploadError && (
            <p className="text-xs text-red-500 mt-1">{uploadError}</p>
          )}
          <p className="text-xs text-gray-400 mt-1 text-center">
            {remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} remaining • .txt, .pdf, .md, .json, .csv
          </p>
        </div>
      )}

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="text-center text-gray-400 py-6">
          <FileText size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-xs">No documents in this session</p>
          <p className="text-xs mt-1">Upload documents for RAG-enhanced responses</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800 truncate" title={doc.filename}>
                    {doc.filename}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {(doc.size / 1024).toFixed(1)}KB • {doc.chunkCount} chunks
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(doc.id!)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove document"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tier Info */}
      <div className="text-xs text-gray-400 border-t border-gray-100 pt-3 mt-3">
        {tier === 'jive' && (
          <p>JIVE: Keyword-based search. Upgrade to JIGGA for semantic search.</p>
        )}
        {tier === 'jigga' && (
          <p>JIGGA: Semantic search with E5 embeddings enabled.</p>
        )}
      </div>
    </div>
  );
}


// Weather Tab Content with 7-day forecast
interface WeatherTabContentProps {
  weather: WeatherData | null;
  isLoading: boolean;
  selectedDay: number;
  onSelectDay: (index: number) => void;
}

function WeatherTabContent({ weather, isLoading, selectedDay, onSelectDay }: WeatherTabContentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-400 border-t-transparent"></div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="text-center text-gray-500 py-8">
        <Cloud size={32} className="mx-auto mb-2 opacity-50" />
        <p>Unable to load weather</p>
      </div>
    );
  }

  // Get selected day data (0 = today/current)
  const displayData = selectedDay === 0 
    ? {
        temp: weather.current.temp,
        tempMax: weather.daily[0]?.tempMax ?? weather.current.temp,
        tempMin: weather.daily[0]?.tempMin ?? weather.current.temp,
        weatherCode: weather.current.weatherCode,
        description: weather.current.description,
        dayName: 'Today',
        windSpeed: weather.current.windSpeed,
      }
    : {
        temp: weather.daily[selectedDay]?.tempMax ?? 0,
        tempMax: weather.daily[selectedDay]?.tempMax ?? 0,
        tempMin: weather.daily[selectedDay]?.tempMin ?? 0,
        weatherCode: weather.daily[selectedDay]?.weatherCode ?? 0,
        description: getWeatherDescription(weather.daily[selectedDay]?.weatherCode ?? 0),
        dayName: weather.daily[selectedDay]?.dayName ?? '',
        windSpeed: weather.daily[selectedDay]?.windSpeed ?? 0,
      };

  return (
    <div className="space-y-4">
      {/* Main Weather Display (Header Image Area) */}
      <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-6 text-center">
        <div className="flex items-center justify-center mb-2">
          <WeatherIcon code={displayData.weatherCode} size={64} className="text-gray-700" />
        </div>
        <div className="text-4xl font-bold text-gray-800">
          {Math.round(displayData.temp)}°C
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {displayData.description}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {displayData.dayName} • {weather.location}
        </div>
        <div className="flex justify-center gap-4 mt-3 text-xs text-gray-600">
          <span>H: {Math.round(displayData.tempMax)}°</span>
          <span>L: {Math.round(displayData.tempMin)}°</span>
          <span>Wind: {Math.round(displayData.windSpeed)} km/h</span>
        </div>
      </div>

      {/* 7-Day Forecast - Vertical List */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">7-Day Forecast</div>
        {weather.daily.map((day, index) => (
          <div
            key={day.date}
            onClick={() => onSelectDay(index)}
            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
              selectedDay === index
                ? 'bg-gray-800 text-white'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <WeatherIcon 
                code={day.weatherCode} 
                size={20} 
                className={selectedDay === index ? 'text-white' : 'text-gray-600'} 
              />
              <span className="text-sm font-medium w-16">{day.dayName}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className={selectedDay === index ? 'text-gray-300' : 'text-gray-500'}>
                {Math.round(day.tempMin)}°
              </span>
              <div className="w-12 h-1 bg-gradient-to-r from-blue-400 to-orange-400 rounded-full opacity-50"></div>
              <span className="font-medium">{Math.round(day.tempMax)}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Vertical Tab Button - Stacked with vertical text
interface VerticalTabProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function VerticalTab({ icon, label, isActive, onClick }: VerticalTabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-4 px-2 rounded-l-lg transition-all w-10 ${
        isActive
          ? 'bg-white text-gray-800 shadow-lg -translate-x-1'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
      }`}
      title={label}
    >
      {icon}
      {/* Vertical text - rotated 180deg so it reads top-to-bottom */}
      <span 
        className="text-[9px] font-medium mt-2 whitespace-nowrap"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      >
        {label}
      </span>
    </button>
  );
}

// Main Panel Component
export function RightSidePanel() {
  const { isOpen, activeTab, closePanel, setActiveTab } = useRightPanel();
  const { tools, isLoadingTools, fetchTools, forcedTool, forceTool, clearForcedTool } = useToolShed();
  
  // Document store for synced document state
  const {
    documents,
    selectedDocIds,
    isLoading: isLoadingDocs,
    isEmbedding,
    isRAGEnabled,
    canUpload,
    tier,
    maxDocsPerSession,
    storageUsage,
    onUploadDocument,
    onRemoveDocument,
  } = useDocumentStore();
  
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

  // Fetch weather data
  const fetchWeather = useCallback(async () => {
    setIsLoadingWeather(true);
    try {
      // Get user location or use Cape Town as default
      let lat = -33.9249;
      let lon = 18.4241;
      let locationName = 'Cape Town';

      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          lat = position.coords.latitude;
          lon = position.coords.longitude;
          locationName = 'Your Location';
        } catch {
          // Use default location
        }
      }

      // Fetch from Open-Meteo API (free, no key required)
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`
      );
      
      const data = await response.json();
      
      // Parse daily forecast
      const daily: DayForecast[] = data.daily.time.slice(0, 7).map((date: string, i: number) => {
        const d = new Date(date);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return {
          date,
          dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayNames[d.getDay()],
          tempMax: data.daily.temperature_2m_max[i],
          tempMin: data.daily.temperature_2m_min[i],
          weatherCode: data.daily.weather_code[i],
          precipitation: data.daily.precipitation_sum[i],
          windSpeed: data.daily.wind_speed_10m_max[i],
        };
      });

      setWeather({
        current: {
          temp: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          windSpeed: data.current.wind_speed_10m,
          weatherCode: data.current.weather_code,
          description: getWeatherDescription(data.current.weather_code),
        },
        daily,
        location: locationName,
      });
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    } finally {
      setIsLoadingWeather(false);
    }
  }, []);

  // Fetch data when panel opens
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'tools') {
        // fetchTools requires a tier, but we'll let it use the default
        // The tools should already be fetched by ChatClient on tier change
      } else if (activeTab === 'weather' && !weather) {
        fetchWeather();
      }
    }
  }, [isOpen, activeTab, fetchWeather, weather]);

  // Reset selected day when weather tab opens
  useEffect(() => {
    if (activeTab === 'weather') {
      setSelectedDay(0);
    }
  }, [activeTab]);

  return (
    <>
      {/* Vertical Tab Strip (Always Visible on Right Edge) - Stacked tabs with vertical text */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex flex-col">
        <VerticalTab
          icon={<Wrench size={18} />}
          label="Tools"
          isActive={isOpen && activeTab === 'tools'}
          onClick={() => {
            if (isOpen && activeTab === 'tools') {
              closePanel();
            } else {
              setActiveTab('tools');
            }
          }}
        />
        <VerticalTab
          icon={<FileText size={18} />}
          label="Docs"
          isActive={isOpen && activeTab === 'documents'}
          onClick={() => {
            if (isOpen && activeTab === 'documents') {
              closePanel();
            } else {
              setActiveTab('documents');
            }
          }}
        />
        <VerticalTab
          icon={<Cloud size={18} />}
          label="Weather"
          isActive={isOpen && activeTab === 'weather'}
          onClick={() => {
            if (isOpen && activeTab === 'weather') {
              closePanel();
            } else {
              setActiveTab('weather');
            }
          }}
        />
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={closePanel}
        />
      )}

      {/* Panel - slides from right, tabs stay on edge */}
      <div
        className={`fixed top-0 h-full w-80 bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-out ${
          isOpen ? 'right-10' : '-right-80'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 font-quicksand">
            {activeTab === 'tools' && 'Tool Shed'}
            {activeTab === 'documents' && 'Documents'}
            {activeTab === 'weather' && 'Weather'}
          </h2>
          <button
            onClick={closePanel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto h-[calc(100%-64px)]">
          {activeTab === 'tools' && (
            <ToolsTabContent
              tools={tools}
              isLoading={isLoadingTools}
              forcedTool={forcedTool}
              onForceTool={forceTool}
              onClearForcedTool={clearForcedTool}
            />
          )}
          {activeTab === 'documents' && (
            <DocumentsTabContent
              documents={documents}
              selectedDocIds={selectedDocIds}
              isLoading={isLoadingDocs}
              isEmbedding={isEmbedding}
              isRAGEnabled={isRAGEnabled}
              canUpload={canUpload}
              tier={tier}
              maxDocsPerSession={maxDocsPerSession}
              storageUsage={storageUsage}
              onUpload={async (file) => {
                if (onUploadDocument) await onUploadDocument(file);
              }}
              onRemove={async (docId) => {
                if (onRemoveDocument) await onRemoveDocument(docId);
              }}
            />
          )}
          {activeTab === 'weather' && (
            <WeatherTabContent
              weather={weather}
              isLoading={isLoadingWeather}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default RightSidePanel;
