/**
 * LocationPrompt Component
 * Modal dialog for requesting location permission with user consent
 * Monochrome design with grey gradients, Quicksand font, black Material Icons
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { UserLocation, WeatherData } from '@/hooks/useLocation';

// Autocomplete suggestion type
interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    road?: string;
    country?: string;
  };
}

interface LocationPromptProps {
  show: boolean;
  isLoading: boolean;
  error: string | null;
  canRetry: boolean;
  retryCount: number;
  onAllow: () => void;
  onRetry: () => void;
  onDeny: () => void;
  onManualEntry: () => void;
}

/**
 * Initial location permission prompt with retry support
 */
export const LocationPrompt: React.FC<LocationPromptProps> = ({
  show,
  isLoading,
  error,
  canRetry,
  retryCount,
  onAllow,
  onRetry,
  onDeny,
  onManualEntry,
}) => {
  if (!show) return null;

  // Show retry UI if there's an error and we can retry
  const showRetryMode = error && canRetry && retryCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in duration-200">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            showRetryMode ? 'bg-amber-50' : 'bg-gray-100'
          }`}>
            <span className={`material-icons text-3xl ${
              showRetryMode ? 'text-amber-600' : 'text-gray-700'
            }`}>
              {showRetryMode ? 'location_searching' : 'location_on'}
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2 font-quicksand">
          {showRetryMode ? 'Location Detection Failed' : 'Enable Location Services'}
        </h2>

        {/* Description */}
        <p className="text-gray-600 text-center mb-6 text-sm leading-relaxed">
          {showRetryMode 
            ? 'We couldn\'t detect your location automatically. You can try again or enter your location manually.'
            : 'Gogga can use your location to provide directions, local weather, and location-aware assistance. Your location data stays on your device and is only shared when you ask location-related questions.'
          }
        </p>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
            <span className="material-icons text-amber-500 text-lg flex-shrink-0">warning</span>
            <div>
              <p>{error}</p>
              {retryCount > 0 && retryCount < 3 && (
                <p className="text-xs mt-1 text-amber-600">
                  Attempt {retryCount} of 3
                </p>
              )}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          {showRetryMode ? (
            /* Retry Mode Buttons */
            <>
              <button
                onClick={onRetry}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gray-900 text-white rounded-xl font-medium 
                         hover:bg-gray-800 transition-colors disabled:opacity-50 
                         disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-icons animate-spin text-lg">sync</span>
                    Detecting location...
                  </>
                ) : (
                  <>
                    <span className="material-icons text-lg">refresh</span>
                    Retry Auto-Detect
                  </>
                )}
              </button>

              <button
                onClick={onManualEntry}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium 
                         hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-icons text-lg">edit_location</span>
                Enter Manually Instead
              </button>
            </>
          ) : (
            /* Initial Prompt Buttons */
            <>
              <button
                onClick={onAllow}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gray-900 text-white rounded-xl font-medium 
                         hover:bg-gray-800 transition-colors disabled:opacity-50 
                         disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-icons animate-spin text-lg">sync</span>
                    Getting location...
                  </>
                ) : (
                  <>
                    <span className="material-icons text-lg">my_location</span>
                    Allow Location Access
                  </>
                )}
              </button>

              <button
                onClick={onManualEntry}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium 
                         hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-icons text-lg">edit_location</span>
                Enter Location Manually
              </button>
            </>
          )}

          <button
            onClick={onDeny}
            disabled={isLoading}
            className="w-full py-2 px-4 text-gray-500 text-sm hover:text-gray-700 transition-colors"
          >
            {showRetryMode ? 'Skip for now' : 'Not now'}
          </button>
        </div>

        {/* Privacy note */}
        <p className="text-xs text-gray-400 text-center mt-4">
          <span className="material-icons text-xs align-middle mr-1">lock</span>
          Your privacy is important. Location data is never sold or shared.
        </p>
      </div>
    </div>
  );
};

interface ManualLocationInputProps {
  show: boolean;
  value: string;
  isLoading: boolean;
  isDetecting?: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onAutoDetect: () => void;
  onSelectSuggestion?: (suggestion: LocationSuggestion) => void;
  onCancel: () => void;
}

/**
 * Manual location entry modal with autocomplete suggestions
 * Prioritizes South Africa results
 */
export const ManualLocationInput: React.FC<ManualLocationInputProps> = ({
  show,
  value,
  isLoading,
  isDetecting = false,
  error,
  onChange,
  onSubmit,
  onAutoDetect,
  onSelectSuggestion,
  onCancel,
}) => {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch autocomplete suggestions - prioritize South Africa
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search with South Africa country code bias
      const searchQuery = query.toLowerCase().includes('south africa') 
        ? query 
        : `${query}, South Africa`;
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=8&addressdetails=1&countrycodes=za`,
        { headers: { 'User-Agent': 'Gogga-App/1.0' } }
      );
      let data = await response.json();
      
      // If no results with ZA country code, try without restriction but still append SA
      if ((!data || data.length === 0) && !query.toLowerCase().includes('south africa')) {
        const fallbackResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'User-Agent': 'Gogga-App/1.0' } }
        );
        data = await fallbackResponse.json();
      }
      
      setSuggestions(data || []);
      setShowSuggestions(data && data.length > 0);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('[Location] Autocomplete failed:', err);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, fetchSuggestions]);

  // Reset state when modal closes
  useEffect(() => {
    if (!show) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  }, [show]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !isLoading && value.trim() && selectedIndex < 0) {
      onSubmit();
    }
    if (e.key === 'Escape' && !showSuggestions) {
      onCancel();
    }
  };

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    const displayText = suggestion.address?.city || 
                       suggestion.address?.town || 
                       suggestion.address?.village ||
                       suggestion.display_name.split(',')[0];
    onChange(displayText);
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Call the suggestion handler if provided - this will set location directly
    // and close the modal via setLocationFromSuggestion
    if (onSelectSuggestion) {
      onSelectSuggestion(suggestion);
    } else {
      // If no suggestion handler, just submit with the text
      // Small delay to let onChange update the value
      setTimeout(() => onSubmit(), 50);
    }
  };

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="material-icons text-gray-700 text-3xl">edit_location</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2 font-quicksand">
          Enter Your Location
        </h2>

        {/* Description */}
        <p className="text-gray-600 text-center mb-4 text-sm">
          Start typing to see suggestions
        </p>

        {/* Input with autocomplete */}
        <div className="mb-4 relative">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="e.g. Cape Town, Johannesburg, Durban..."
              className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-gray-900 
                       placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300
                       transition-all"
              autoFocus
              disabled={isLoading}
              autoComplete="off"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons text-gray-400 animate-spin text-lg">
                sync
              </span>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {suggestions.map((suggestion, index) => {
                const city = suggestion.address?.city || suggestion.address?.town || suggestion.address?.village;
                const country = suggestion.address?.country;
                const displayParts = suggestion.display_name.split(',').slice(0, 3);
                
                return (
                  <button
                    type="button"
                    key={`${suggestion.lat}-${suggestion.lon}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectSuggestion(suggestion);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full px-4 py-3 text-left flex items-start gap-3 transition-colors ${
                      index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="material-icons text-gray-400 text-lg flex-shrink-0 mt-0.5">
                      location_on
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {city || displayParts[0]}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {country ? `${displayParts.slice(1).join(', ')}` : suggestion.display_name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
            <span className="material-icons text-amber-500 text-lg">error</span>
            {error}
          </div>
        )}

        {/* Auto-detect button */}
        <button
          type="button"
          onClick={onAutoDetect}
          disabled={isLoading || isDetecting}
          className="w-full mb-3 py-2.5 px-4 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl font-medium 
                   hover:bg-gray-100 hover:border-gray-300 transition-colors disabled:opacity-50 
                   disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isDetecting ? (
            <>
              <span className="material-icons animate-spin text-lg">my_location</span>
              Detecting your location...
            </>
          ) : (
            <>
              <span className="material-icons text-lg">my_location</span>
              Auto-detect my location
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-400">or confirm manually</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading || isDetecting}
            className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium 
                     hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isLoading || isDetecting || !value.trim()}
            className="flex-1 py-3 px-4 bg-gray-900 text-white rounded-xl font-medium 
                     hover:bg-gray-800 transition-colors disabled:opacity-50 
                     disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="material-icons animate-spin text-lg">sync</span>
                Finding...
              </>
            ) : (
              <>
                <span className="material-icons text-lg">check</span>
                Confirm
              </>
            )}
          </button>
        </div>

        {/* Tip */}
        <p className="text-xs text-gray-400 text-center mt-4">
          <span className="material-icons text-xs align-middle mr-1">info</span>
          Searching in South Africa. Type city, suburb, or street name.
        </p>
      </div>
    </div>
  );
};

interface LocationBadgeProps {
  location: UserLocation | null;
  weather: WeatherData | null;
  onClick?: () => void;
  onEdit?: () => void;
  onClear?: () => void;
}

/**
 * Compact location display badge for header/toolbar
 * Click to edit location, X to clear
 */
export const LocationBadge: React.FC<LocationBadgeProps> = ({
  location,
  weather,
  onClick,
  onEdit,
  onClear,
}) => {
  if (!location) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 
                 rounded-full text-sm text-gray-600 transition-colors"
        title="Set your location"
      >
        <span className="material-icons text-base">location_off</span>
        <span className="hidden sm:inline">Add location</span>
      </button>
    );
  }

  const displayLocation = location.city || location.street || 'Unknown location';

  return (
    <div className="flex items-center gap-1">
      {/* Main location button - click to edit */}
      <button
        onClick={onEdit || onClick}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 
                 rounded-full text-sm text-gray-700 transition-colors group cursor-pointer"
        title={`${location.displayName || displayLocation} — Click to change`}
      >
        <span className="material-icons text-base text-gray-500 group-hover:text-gray-700">
          {location.isManual ? 'edit_location' : 'my_location'}
        </span>
        <span className="max-w-[100px] truncate">{displayLocation}</span>
        
        {weather && (
          <>
            <span className="text-gray-300 mx-0.5">|</span>
            <span className="material-icons text-base text-gray-500">{weather.icon}</span>
            <span className="text-gray-600">{weather.temperature}°C</span>
          </>
        )}
        
        {/* Edit indicator on hover */}
        <span className="material-icons text-xs text-gray-400 group-hover:text-gray-600 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          edit
        </span>
      </button>
      
      {/* Clear button */}
      {onClear && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
          title="Clear location"
        >
          <span className="material-icons text-sm text-gray-400 hover:text-gray-600">close</span>
        </button>
      )}
    </div>
  );
};

export default LocationPrompt;
