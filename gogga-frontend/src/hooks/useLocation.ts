/**
 * useLocation Hook
 * Handles geolocation with user consent for directions and location-aware features
 * Always requests permission - never tracks without explicit consent
 */

import { useState, useEffect, useCallback } from 'react';

// Location data structure
export interface UserLocation {
  lat: number;
  lon: number;
  city?: string;
  street?: string;
  country?: string;
  displayName?: string;
  isManual: boolean;
  isApproximate?: boolean; // True when using IP-based location (less accurate)
  timestamp: number;
  source?: 'gps' | 'ip' | 'manual' | 'cache' | 'suggestion'; // Track location source for debugging
}

// Weather data structure (optional integration)
export interface WeatherData {
  temperature: number;
  description: string;
  icon: string;
  humidity?: number;
  windSpeed?: number;
}

// Debug logging utility
const DEBUG_LOCATION = process.env.NODE_ENV === 'development' || 
  (typeof window !== 'undefined' && window.localStorage?.getItem('gogga_debug_location') === 'true');

function debugLog(category: string, message: string, data?: unknown) {
  if (!DEBUG_LOCATION) return;
  const isoString = new Date().toISOString();
  const timePart = isoString.split('T')[1] ?? '00:00:00.000Z';
  const timestamp = timePart.split('.')[0] ?? '00:00:00';
  const prefix = `[Location:${category}] ${timestamp}`;
  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

// Hook return type
interface UseLocationReturn {
  userLocation: UserLocation | null;
  weatherData: WeatherData | null;
  showLocationPrompt: boolean;
  showManualLocation: boolean;
  manualLocationInput: string;
  isLoadingLocation: boolean;
  locationError: string | null;
  hasConsented: boolean;
  retryCount: number;
  canRetry: boolean;
  
  // Actions
  requestLocation: () => void;
  retryLocation: () => void;
  declineLocation: () => void;
  promptLocation: () => void;
  setManualLocation: (locationText: string) => Promise<void>;
  setLocationFromSuggestion: (suggestion: {
    lat: string;
    lon: string;
    display_name: string;
    address?: {
      city?: string;
      town?: string;
      village?: string;
      road?: string;
      country?: string;
    };
  }) => Promise<void>;
  setManualLocationInput: (input: string) => void;
  setShowManualLocation: (show: boolean) => void;
  clearLocation: () => void;
  refreshLocation: () => void;
  getLocationContext: () => string | null;
}

// Storage keys
const LOCATION_CONSENT_KEY = 'gogga_location_consent';
const LOCATION_DATA_KEY = 'gogga_user_location';

/**
 * Check if we're in a secure context where geolocation is allowed
 * Geolocation API requires HTTPS, localhost, or 127.0.0.1
 */
function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

/**
 * Get location from IP address (fallback when geolocation unavailable)
 * Uses a free IP geolocation service
 */
async function getLocationFromIP(): Promise<UserLocation | null> {
  try {
    debugLog('IP', 'Attempting IP-based geolocation...');
    const response = await fetch('https://ipapi.co/json/', {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      debugLog('IP', `IP geolocation failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    debugLog('IP', 'IP geolocation response:', { 
      city: data.city, 
      region: data.region, 
      country: data.country_name,
      lat: data.latitude,
      lon: data.longitude,
      ip: data.ip?.substring(0, 8) + '...' // Partial IP for privacy
    });

    if (data.latitude && data.longitude) {
      const location: UserLocation = {
        lat: data.latitude,
        lon: data.longitude,
        city: data.city,
        country: data.country_name,
        displayName: data.city
          ? `${data.city}, ${data.region || data.country_name}`
          : data.country_name,
        isManual: false,
        isApproximate: true, // IP-based location is less accurate
        timestamp: Date.now(),
        source: 'ip',
      };
      debugLog('IP', 'IP location resolved:', location.displayName);
      return location;
    }

    debugLog('IP', 'IP response missing coordinates');
    return null;
  } catch (err) {
    debugLog('IP', 'IP geolocation error:', err);
    return null;
  }
}

/**
 * Fetch weather data using coordinates directly (most reliable)
 */
async function getWeatherByCoords(
  lat: number,
  lon: number
): Promise<WeatherData | null> {
  try {
    console.log('[Weather] Fetching by coordinates:', lat, lon);
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
    );
    const weatherData = await weatherResponse.json();

    if (!weatherData.current) {
      console.warn('[Weather] No current weather data');
      return null;
    }

    // Map WMO weather codes to descriptions and icons
    const weatherCode = weatherData.current.weather_code;
    const { description, icon } = mapWeatherCode(weatherCode);

    console.log(
      '[Weather] Success:',
      weatherData.current.temperature_2m + '°C',
      description
    );

    return {
      temperature: Math.round(weatherData.current.temperature_2m),
      description,
      icon,
      humidity: weatherData.current.relative_humidity_2m,
      windSpeed: weatherData.current.wind_speed_10m,
    };
  } catch (error) {
    console.error('[Weather] Failed to fetch by coords:', error);
    return null;
  }
}

/**
 * Sanitize city name for geocoding API
 * Removes ward numbers, district suffixes, and other noise
 * Falls back to parent city for SA suburbs that may not be found
 */
function sanitizeCityName(city: string): string {
  // Remove "Ward X", "Ward XX", "District X" patterns
  let cleaned = city.replace(/\s+(Ward|District|Section|Block)\s+\d+/gi, '');
  
  // SA municipality name mappings to major cities
  const cityMappings: Record<string, string> = {
    'tshwane': 'Pretoria',
    'city of tshwane': 'Pretoria',
    'ekurhuleni': 'Johannesburg East',
    'city of ekurhuleni': 'Germiston',
    'ethekwini': 'Durban',
    'city of johannesburg': 'Johannesburg',
    'city of cape town': 'Cape Town',
    'nelson mandela bay': 'Port Elizabeth',
    'buffalo city': 'East London',
    'mangaung': 'Bloemfontein',
  };
  
  // SA suburb to city mappings for weather (suburb names that geocoding APIs might not find)
  const suburbMappings: Record<string, string> = {
    // Pretoria suburbs
    'pretoriuspark': 'Pretoria',
    'centurion': 'Pretoria',
    'faerie glen': 'Pretoria',
    'lynnwood': 'Pretoria',
    'menlyn': 'Pretoria',
    'waterkloof': 'Pretoria',
    'hatfield': 'Pretoria',
    'brooklyn': 'Pretoria',
    'sunnyside': 'Pretoria',
    'arcadia': 'Pretoria',
    // Johannesburg suburbs
    'sandton': 'Johannesburg',
    'rosebank': 'Johannesburg',
    'fourways': 'Johannesburg',
    'midrand': 'Johannesburg',
    'bryanston': 'Johannesburg',
    'randburg': 'Johannesburg',
    'roodepoort': 'Johannesburg',
    'bedfordview': 'Johannesburg',
    'edenvale': 'Johannesburg',
    'boksburg': 'Johannesburg',
    'kempton park': 'Johannesburg',
    'benoni': 'Johannesburg',
    'alberton': 'Johannesburg',
    'soweto': 'Johannesburg',
    // Cape Town suburbs
    'sea point': 'Cape Town',
    'claremont': 'Cape Town',
    'constantia': 'Cape Town',
    'camps bay': 'Cape Town',
    'bellville': 'Cape Town',
    'stellenbosch': 'Cape Town',
    'paarl': 'Cape Town',
    // Durban suburbs
    'umhlanga': 'Durban',
    'ballito': 'Durban',
    'hillcrest': 'Durban',
    'pinetown': 'Durban',
    'westville': 'Durban',
  };
  
  const lowerCleaned = cleaned.toLowerCase().trim();
  
  // Check municipality mappings first
  if (cityMappings[lowerCleaned]) {
    return cityMappings[lowerCleaned];
  }
  
  // Check suburb mappings
  if (suburbMappings[lowerCleaned]) {
    console.log(`[Weather] Suburb '${cleaned}' mapped to '${suburbMappings[lowerCleaned]}'`);
    return suburbMappings[lowerCleaned];
  }
  
  return cleaned.trim() || city;
}

/**
 * Fetch weather data for a city (fallback if no coordinates)
 */
async function getWeatherForecast(city: string): Promise<WeatherData | null> {
  try {
    // Sanitize city name for better geocoding results
    const sanitizedCity = sanitizeCityName(city);

    // Using Open-Meteo API (free, no API key required)
    // First geocode the city to get coordinates
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        sanitizedCity
      )}&count=1`
    );
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      console.warn(
        '[Weather] City not found:',
        city,
        '(sanitized:',
        sanitizedCity,
        ')'
      );
      return null;
    }

    const { latitude, longitude } = geoData.results[0];
    return getWeatherByCoords(latitude, longitude);
  } catch (error) {
    console.error('[Weather] Failed to fetch:', error);
    return null;
  }
}

/**
 * Map WMO weather codes to Material Icons and descriptions
 */
function mapWeatherCode(code: number): { description: string; icon: string } {
  const weatherMap: Record<number, { description: string; icon: string }> = {
    0: { description: 'Clear sky', icon: 'wb_sunny' },
    1: { description: 'Mainly clear', icon: 'wb_sunny' },
    2: { description: 'Partly cloudy', icon: 'cloud' },
    3: { description: 'Overcast', icon: 'cloud' },
    45: { description: 'Foggy', icon: 'foggy' },
    48: { description: 'Depositing rime fog', icon: 'foggy' },
    51: { description: 'Light drizzle', icon: 'grain' },
    53: { description: 'Moderate drizzle', icon: 'grain' },
    55: { description: 'Dense drizzle', icon: 'grain' },
    61: { description: 'Slight rain', icon: 'rainy' },
    63: { description: 'Moderate rain', icon: 'rainy' },
    65: { description: 'Heavy rain', icon: 'rainy' },
    71: { description: 'Slight snow', icon: 'ac_unit' },
    73: { description: 'Moderate snow', icon: 'ac_unit' },
    75: { description: 'Heavy snow', icon: 'ac_unit' },
    77: { description: 'Snow grains', icon: 'ac_unit' },
    80: { description: 'Slight showers', icon: 'rainy' },
    81: { description: 'Moderate showers', icon: 'rainy' },
    82: { description: 'Violent showers', icon: 'thunderstorm' },
    85: { description: 'Slight snow showers', icon: 'ac_unit' },
    86: { description: 'Heavy snow showers', icon: 'ac_unit' },
    95: { description: 'Thunderstorm', icon: 'thunderstorm' },
    96: { description: 'Thunderstorm with hail', icon: 'thunderstorm' },
    99: { description: 'Thunderstorm with heavy hail', icon: 'thunderstorm' },
  };

  return weatherMap[code] || { description: 'Unknown', icon: 'cloud' };
}

/**
 * Main location hook
 */
export function useLocation(autoPrompt: boolean = true): UseLocationReturn {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasConsented, setHasConsented] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Max retries before suggesting manual entry
  const MAX_RETRIES = 3;
  const canRetry = retryCount < MAX_RETRIES && !isLoadingLocation;

  // Load saved location and consent on mount
  useEffect(() => {
    try {
      const savedConsent = localStorage.getItem(LOCATION_CONSENT_KEY);
      const savedLocation = localStorage.getItem(LOCATION_DATA_KEY);

      debugLog('CACHE', 'Loading saved location...', { 
        hasConsent: savedConsent, 
        hasLocation: !!savedLocation 
      });

      if (savedConsent === 'true') {
        setHasConsented(true);

        if (savedLocation) {
          const parsed = JSON.parse(savedLocation) as UserLocation;
          // Only use cached location if less than 1 hour old
          const oneHour = 60 * 60 * 1000;
          const ageMinutes = Math.round((Date.now() - parsed.timestamp) / 60000);
          
          debugLog('CACHE', `Cached location age: ${ageMinutes} minutes`, {
            city: parsed.city,
            source: parsed.source,
            isExpired: Date.now() - parsed.timestamp >= oneHour
          });
          
          if (Date.now() - parsed.timestamp < oneHour) {
            // Mark as loaded from cache for debugging
            const cachedLocation: UserLocation = {
              ...parsed,
              source: 'cache',
            };
            setUserLocation(cachedLocation);
            debugLog('CACHE', 'Using cached location:', cachedLocation.displayName);
            
            // Fetch weather for cached location using coordinates if available
            if (parsed.lat && parsed.lon) {
              getWeatherByCoords(parsed.lat, parsed.lon).then(setWeatherData);
            } else if (parsed.city) {
              getWeatherForecast(parsed.city).then(setWeatherData);
            }
          } else {
            debugLog('CACHE', 'Cached location expired, will request fresh');
          }
        }
      }
    } catch (e) {
      debugLog('CACHE', 'Failed to load saved location:', e);
    }
  }, []);

  // Show location prompt on app load (if autoPrompt enabled and no consent yet)
  useEffect(() => {
    if (!autoPrompt) return;

    const savedConsent = localStorage.getItem(LOCATION_CONSENT_KEY);
    if (savedConsent === 'true' || savedConsent === 'declined') {
      return; // Already answered
    }

    const timer = setTimeout(() => {
      setShowLocationPrompt(true);
    }, 1500); // Show prompt after 1.5 seconds

    return () => clearTimeout(timer);
  }, [autoPrompt]);

  /**
   * Request location permission and get current position
   * Strategy: Try HTTPS geolocation first, fallback to IP geolocation
   */
  const requestLocation = useCallback(() => {
    console.log('[Location] requestLocation called');

    setIsLoadingLocation(true);
    setLocationError(null);

    // Helper to try IP-based geolocation as fallback
    const tryIPFallback = async (reason: string) => {
      console.log(`[Location] Trying IP fallback: ${reason}`);
      const ipLocation = await getLocationFromIP();

      if (ipLocation) {
        setUserLocation(ipLocation);
        setShowLocationPrompt(false);
        setHasConsented(true);
        localStorage.setItem(LOCATION_CONSENT_KEY, 'true');
        localStorage.setItem(LOCATION_DATA_KEY, JSON.stringify(ipLocation));

        debugLog('IP', 'IP-based location obtained:', ipLocation.city);

        // Fetch weather if we have coordinates
        if (ipLocation.lat && ipLocation.lon) {
          const weather = await getWeatherByCoords(
            ipLocation.lat,
            ipLocation.lon
          );
          setWeatherData(weather);
        }
        setIsLoadingLocation(false);
      } else {
        debugLog('IP', 'IP fallback failed, prompting manual entry');
        setLocationError('Could not detect location. Please enter manually.');
        setShowLocationPrompt(false);
        setShowManualLocation(true);
        setIsLoadingLocation(false);
      }
    };

    // Check if we're in a secure context (HTTPS, localhost, or 127.0.0.1)
    if (!isSecureContext()) {
      debugLog('GPS', 'Not in secure context - trying IP fallback');
      tryIPFallback('not_secure_context');
      return;
    }

    if (!('geolocation' in navigator)) {
      debugLog('GPS', 'Geolocation API not supported - trying IP fallback');
      tryIPFallback('geolocation_not_supported');
      return;
    }

    debugLog('GPS', 'Requesting HTTPS geolocation permission...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        debugLog('GPS', `GPS coordinates received (accuracy: ${accuracy?.toFixed(0) || '?'}m)`, { latitude, longitude });

        const newLocation: UserLocation = {
          lat: latitude,
          lon: longitude,
          isManual: false,
          timestamp: Date.now(),
          source: 'gps',
        };

        setUserLocation(newLocation);
        setShowLocationPrompt(false);
        setHasConsented(true);
        localStorage.setItem(LOCATION_CONSENT_KEY, 'true');

        debugLog('GPS', 'GPS location obtained:', { latitude, longitude });

        // Reverse geocode to get full address
        try {
          debugLog('GEOCODE', 'Reverse geocoding coordinates...');
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'Gogga-App/1.0' } }
          );
          const data = await response.json();
          
          debugLog('GEOCODE', 'Nominatim response address:', data.address);

          // For display, prefer suburb/town for more specific location
          const displayCity =
            data.address?.suburb ||
            data.address?.town ||
            data.address?.city ||
            data.address?.village;
          const street = data.address?.road || data.address?.street;
          const country = data.address?.country;

          const updatedLocation: UserLocation = {
            ...newLocation,
            city: displayCity,
            street,
            country,
            displayName: data.display_name,
            source: 'gps', // Confirm source is GPS
          };

          setUserLocation(updatedLocation);
          localStorage.setItem(
            LOCATION_DATA_KEY,
            JSON.stringify(updatedLocation)
          );

          debugLog('GEOCODE', 'Address resolved:', {
            street,
            city: displayCity,
            country,
            displayName: data.display_name?.substring(0, 50) + '...'
          });

          // Fetch weather using coordinates directly (most reliable)
          const weather = await getWeatherByCoords(latitude, longitude);
          setWeatherData(weather);
        } catch (err) {
          debugLog('GEOCODE', 'Reverse geocode failed:', err);
          // Still save the coordinates even if geocoding fails
          localStorage.setItem(LOCATION_DATA_KEY, JSON.stringify(newLocation));
        }

        setIsLoadingLocation(false);
      },
      async (error) => {
        debugLog('GPS', `GPS error code ${error.code}:`, error.message);

        // Try IP fallback for position unavailable or timeout
        if (
          error.code === error.POSITION_UNAVAILABLE ||
          error.code === error.TIMEOUT
        ) {
          debugLog('GPS', 'GPS failed, trying IP fallback...');
          await tryIPFallback(`gps_error_${error.code}`);
          return;
        }

        setIsLoadingLocation(false);

        // Permission denied - show manual entry
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError(
            'Location permission denied. You can enter your location manually.'
          );
          setShowLocationPrompt(false);
          setShowManualLocation(true);
        } else {
          setLocationError('Failed to get location. Please try again.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000, // 10 second timeout before IP fallback
        maximumAge: 0, // No cache - fresh location
      }
    );
  }, []);

  /**
   * Retry location detection (with reduced accuracy for faster result)
   */
  const retryLocation = useCallback(() => {
    // Check if we're on a secure origin
    const isSecureOrigin =
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (!isSecureOrigin) {
      // Try IP-based geolocation instead
      console.log('[Location] Retrying with IP-based location...');
      setIsLoadingLocation(true);

      getLocationFromIP().then(async (ipLocation) => {
        if (ipLocation) {
          setUserLocation(ipLocation);
          setShowLocationPrompt(false);
          setHasConsented(true);
          setRetryCount(0);
          localStorage.setItem(LOCATION_CONSENT_KEY, 'true');
          localStorage.setItem(LOCATION_DATA_KEY, JSON.stringify(ipLocation));

          if (ipLocation.city) {
            const weather = await getWeatherForecast(ipLocation.city);
            setWeatherData(weather);
          }
        } else {
          setLocationError('Could not detect location. Please enter manually.');
          setShowManualLocation(true);
        }
        setIsLoadingLocation(false);
      });
      return;
    }

    if (!('geolocation' in navigator) || retryCount >= MAX_RETRIES) {
      setLocationError(
        'Maximum retries reached. Please enter your location manually.'
      );
      return;
    }

    setIsLoadingLocation(true);
    setLocationError(null);

    console.log(`[Location] Retry attempt ${retryCount + 1}/${MAX_RETRIES}`);

    // Use lower accuracy for retries - often faster
    const useHighAccuracy = retryCount === 0;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        const newLocation: UserLocation = {
          lat: latitude,
          lon: longitude,
          isManual: false,
          timestamp: Date.now(),
        };

        setUserLocation(newLocation);
        setShowLocationPrompt(false);
        setHasConsented(true);
        setRetryCount(0); // Reset retry count on success
        localStorage.setItem(LOCATION_CONSENT_KEY, 'true');

        console.log('[Location] Retry successful:', latitude, longitude);

        // Reverse geocode to get full address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'Gogga-App/1.0' } }
          );
          const data = await response.json();

          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.suburb ||
            data.address?.village;
          const street = data.address?.road || data.address?.street;
          const country = data.address?.country;

          const updatedLocation: UserLocation = {
            ...newLocation,
            city,
            street,
            country,
            displayName: data.display_name,
          };

          setUserLocation(updatedLocation);
          localStorage.setItem(
            LOCATION_DATA_KEY,
            JSON.stringify(updatedLocation)
          );

          if (city) {
            const weather = await getWeatherForecast(city);
            setWeatherData(weather);
          }
        } catch (err) {
          console.error('[Location] Reverse geocode failed:', err);
          localStorage.setItem(LOCATION_DATA_KEY, JSON.stringify(newLocation));
        }

        setIsLoadingLocation(false);
      },
      (error) => {
        console.warn('[Location] Retry failed:', error.code, error.message);
        setIsLoadingLocation(false);
        setRetryCount((prev) => prev + 1);

        if (retryCount + 1 >= MAX_RETRIES) {
          setLocationError(
            'Could not detect location after multiple attempts. Please enter manually.'
          );
        } else {
          setLocationError(
            `Attempt ${retryCount + 1} failed. Tap "Retry" to try again.`
          );
        }
      },
      {
        enableHighAccuracy: useHighAccuracy,
        timeout: useHighAccuracy ? 15000 : 20000, // More time for low accuracy
        maximumAge: 60000, // Allow 1 minute cache on retries
      }
    );
  }, [retryCount]);

  /**
   * User declined location permission
   */
  const declineLocation = useCallback(() => {
    setShowLocationPrompt(false);
    setRetryCount(0); // Reset retry count
    localStorage.setItem(LOCATION_CONSENT_KEY, 'declined');
    console.log('[Location] User declined location permission');
  }, []);

  /**
   * Reset declined state and re-prompt for location permission
   * Called when user clicks "Add location" button after previously declining
   */
  const promptLocation = useCallback(() => {
    // Clear the declined state so we can prompt again
    const savedConsent = localStorage.getItem(LOCATION_CONSENT_KEY);
    if (savedConsent === 'declined') {
      localStorage.removeItem(LOCATION_CONSENT_KEY);
      debugLog('PROMPT', 'Cleared declined state, re-prompting for permission');
    }
    
    setLocationError(null);
    setRetryCount(0);
    
    // Show the location prompt modal
    setShowLocationPrompt(true);
    console.log('[Location] Re-prompting for location permission');
  }, []);

  /**
   * Set location manually by address/city name
   */
  const setManualLocation = useCallback(async (locationText: string) => {
    if (!locationText.trim()) return;

    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      // Geocode the manual location using Nominatim
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          locationText
        )}&format=json&limit=1&addressdetails=1`,
        { headers: { 'User-Agent': 'Gogga-App/1.0' } }
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];

        const newLocation: UserLocation = {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          city:
            result.address?.city ||
            result.address?.town ||
            result.address?.village ||
            result.display_name.split(',')[0],
          street: result.address?.road || locationText,
          country: result.address?.country,
          displayName: result.display_name,
          isManual: true,
          timestamp: Date.now(),
          source: 'manual',
        };

        setUserLocation(newLocation);
        setShowManualLocation(false);
        setManualLocationInput('');
        setHasConsented(true);
        localStorage.setItem(LOCATION_CONSENT_KEY, 'true');
        localStorage.setItem(LOCATION_DATA_KEY, JSON.stringify(newLocation));

        debugLog('MANUAL', 'Manual location set:', result.display_name);

        // Fetch weather for manual location using coordinates
        if (newLocation.lat && newLocation.lon) {
          const weather = await getWeatherByCoords(newLocation.lat, newLocation.lon);
          setWeatherData(weather);
        } else if (newLocation.city) {
          const weather = await getWeatherForecast(newLocation.city);
          setWeatherData(weather);
        }
      } else {
        setLocationError(
          'Location not found. Please try a different address or city name.'
        );
      }
    } catch (error) {
      debugLog('MANUAL', 'Manual geocoding failed:', error);
      setLocationError('Failed to find location. Please try again.');
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  /**
   * Set location directly from autocomplete suggestion
   * Uses pre-fetched coordinates to skip geocoding step
   */
  const setLocationFromSuggestion = useCallback(
    async (suggestion: {
      lat: string;
      lon: string;
      display_name: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        road?: string;
        country?: string;
      };
    }) => {
      setIsLoadingLocation(true);
      setLocationError(null);

      debugLog('SUGGEST', 'Setting location from suggestion:', suggestion.display_name);

      try {
        const cityName =
          suggestion.address?.city ||
          suggestion.address?.town ||
          suggestion.address?.village ||
          suggestion.display_name.split(',')[0];

        const newLocation: UserLocation = {
          lat: parseFloat(suggestion.lat),
          lon: parseFloat(suggestion.lon),
          city: cityName,
          street: suggestion.address?.road,
          country: suggestion.address?.country,
          displayName: suggestion.display_name,
          source: 'suggestion',
          isManual: true,
          timestamp: Date.now(),
        };

        setUserLocation(newLocation);
        setShowManualLocation(false);
        setManualLocationInput('');
        setHasConsented(true);
        localStorage.setItem(LOCATION_CONSENT_KEY, 'true');
        localStorage.setItem(LOCATION_DATA_KEY, JSON.stringify(newLocation));

        console.log('[Location] Set from suggestion:', suggestion.display_name);

        // Fetch weather for location
        if (cityName) {
          console.log('[Location] Fetching weather for:', cityName);
          const weather = await getWeatherForecast(cityName);
          console.log('[Location] Weather data:', weather);
          setWeatherData(weather);
        }
      } catch (error) {
        console.error(
          '[Location] Failed to set location from suggestion:',
          error
        );
        setLocationError('Failed to set location. Please try again.');
      } finally {
        setIsLoadingLocation(false);
      }
    },
    []
  );

  /**
   * Clear saved location data
   */
  const clearLocation = useCallback(() => {
    setUserLocation(null);
    setWeatherData(null);
    setHasConsented(false);
    localStorage.removeItem(LOCATION_CONSENT_KEY);
    localStorage.removeItem(LOCATION_DATA_KEY);
    console.log('[Location] Location data cleared');
  }, []);

  /**
   * Refresh current location (re-request)
   */
  const refreshLocation = useCallback(() => {
    if (hasConsented) {
      requestLocation();
    }
  }, [hasConsented, requestLocation]);

  /**
   * Get location context string for LLM prompts
   * Enhanced with safety checks and better formatting for places_search tool
   */
  const getLocationContext = useCallback((): string | null => {
    if (!userLocation) return null;

    // Safety check: Ensure lat/lon are valid numbers
    const lat = typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) 
      ? userLocation.lat 
      : null;
    const lon = typeof userLocation.lon === 'number' && !isNaN(userLocation.lon) 
      ? userLocation.lon 
      : null;

    // If we have no valid location data, return null
    if (lat === null && lon === null && !userLocation.city && !userLocation.displayName) {
      return null;
    }

    const parts: string[] = [];

    // Include full display name for better context (e.g., "Pretoriuspark, Pretoria, South Africa")
    if (userLocation.displayName) {
      parts.push(`Location: ${userLocation.displayName}`);
    } else if (userLocation.city) {
      // Fallback to city if no display name
      const cityWithCountry = userLocation.country 
        ? `${userLocation.city}, ${userLocation.country}` 
        : userLocation.city;
      parts.push(`Location: ${cityWithCountry}`);
    }

    if (userLocation.street && !userLocation.displayName?.includes(userLocation.street)) {
      parts.push(`Street/Area: ${userLocation.street}`);
    }

    // Only add coordinates if we have valid lat/lon (safe .toFixed call)
    if (lat !== null && lon !== null) {
      parts.push(`Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    }

    // Add accuracy note for IP-based locations
    if (userLocation.isApproximate) {
      parts.push(`(Note: Approximate location based on IP address)`);
    }

    if (weatherData) {
      parts.push(
        `Current weather: ${weatherData.temperature}°C, ${weatherData.description}`
      );
    }

    // Add instruction for AI to use this for places_search tool
    const context = `[User Location Context - Use for places_search tool 'location' parameter]\n${parts.join('\n')}`;
    
    // Debug log the context being sent to the LLM
    debugLog('CONTEXT', 'getLocationContext called:', {
      source: userLocation.source,
      city: userLocation.city,
      isApproximate: userLocation.isApproximate,
      contextLength: context.length,
    });
    
    return context;
  }, [userLocation, weatherData]);

  return {
    userLocation,
    weatherData,
    showLocationPrompt,
    showManualLocation,
    manualLocationInput,
    isLoadingLocation,
    locationError,
    hasConsented,
    retryCount,
    canRetry,

    requestLocation,
    retryLocation,
    declineLocation,
    promptLocation,
    setManualLocation,
    setLocationFromSuggestion,
    setManualLocationInput,
    setShowManualLocation,
    clearLocation,
    refreshLocation,
    getLocationContext,
  };
}

export default useLocation;
