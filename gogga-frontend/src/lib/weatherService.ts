/**
 * Gogga Weather Service
 * Handles weather API calls with daily caching to localStorage
 * Uses WeatherAPI.com for 7-day forecast data
 * 
 * Features:
 * - Only 1 API call per location per day
 * - Caches full 7-day forecast data in localStorage
 * - SA-themed funny weather comments
 * 
 * Setup:
 * 1. Get free API key from https://www.weatherapi.com/
 * 2. Add to .env.local: NEXT_PUBLIC_WEATHER_API_KEY=your_key_here
 */

// WeatherAPI.com configuration
// Free tier: 1M calls/month, 7-day forecast
// Get your free key at: https://www.weatherapi.com/signup.aspx
const WEATHER_API_KEY = process.env.NEXT_PUBLIC_WEATHER_API_KEY || '';
const WEATHER_API_BASE = 'https://api.weatherapi.com/v1';

// Check if API key is configured
export function isWeatherConfigured(): boolean {
  return Boolean(WEATHER_API_KEY && WEATHER_API_KEY.length > 10);
}

// ============================================================================
// Types
// ============================================================================

export interface WeatherLocation {
  lat: number;
  lon: number;
  name: string;
  region?: string;
  country?: string;
}

export interface WeatherCondition {
  text: string;
  icon: string;
  code: number;
}

export interface CurrentWeather {
  temp_c: number;
  feelslike_c: number;
  humidity: number;
  wind_kph: number;
  wind_dir: string;
  uv: number;
  condition: WeatherCondition;
  is_day: number;
  last_updated: string;
}

export interface ForecastDay {
  date: string;
  date_epoch: number;
  day: {
    maxtemp_c: number;
    mintemp_c: number;
    avgtemp_c: number;
    maxwind_kph: number;
    totalprecip_mm: number;
    avghumidity: number;
    daily_will_it_rain: number;
    daily_chance_of_rain: number;
    daily_will_it_snow: number;
    daily_chance_of_snow: number;
    uv: number;
    condition: WeatherCondition;
  };
  astro: {
    sunrise: string;
    sunset: string;
    moonrise: string;
    moonset: string;
    moon_phase: string;
  };
  hour: Array<{
    time: string;
    temp_c: number;
    condition: WeatherCondition;
    wind_kph: number;
    wind_dir: string;
    humidity: number;
    feelslike_c: number;
    chance_of_rain: number;
    uv: number;
  }>;
}

export interface WeatherForecast {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    localtime: string;
  };
  current: CurrentWeather;
  forecast: {
    forecastday: ForecastDay[];
  };
}

export interface CachedWeatherData {
  forecast: WeatherForecast;
  fetchedAt: string;
  expiresAt: string;
  locationKey: string;
}

// ============================================================================
// SA-Themed Funny Weather Comments
// ============================================================================

/**
 * Dynamic, funny South African weather comments
 * Randomly selected based on weather conditions
 */
const SA_WEATHER_COMMENTS = {
  // Hot weather (> 30°C)
  hot: [
    "Eish, it's lekker warm today! 🥵",
    "Perfect braai weather, get the boerewors ready!",
    "Time to find shade and a cold Castle 🍺",
    "Hotter than a potjie on full gas!",
    "Even the hadedas are complaining about this heat",
    "Your tannie's aircon is working overtime today",
    "Keep hydrated, it's proper Highveld hot!",
    "Swimming pool time! Or just the garden hose...",
  ],
  
  // Warm weather (20-30°C)
  warm: [
    "Lovely weather for a braai, nè?",
    "T-shirt weather, lekker lekker!",
    "Perfect for sitting on the stoep",
    "Not too shabby, not too shabby at all",
    "Your tannie would approve of this weather",
    "Good weather for a jol outside",
  ],
  
  // Cool weather (10-20°C)
  cool: [
    "Bit nippy, grab your jersey",
    "Hot chocolate weather is here ☕",
    "Time to dig out the puffer jacket",
    "Cuddle weather, find your bae",
    "Soup and bread kinda day",
  ],
  
  // Cold weather (< 10°C)
  cold: [
    "Ja nee, it's properly cold today! 🥶",
    "Don't forget your beanie, tannie says so",
    "Layer up like an onion, my friend",
    "Brr! Cape Town winter vibes",
    "Hot water bottle territory now",
    "Even the meerkats are staying underground",
  ],
  
  // Rainy
  rain: [
    "Pack your brolly, the rain is coming!",
    "Joburg afternoon thunder incoming ⛈️",
    "Good for the garden, bad for the washing",
    "Traffic is going to be chaos, just saying",
    "Stay cozy indoors today",
    "The dams will thank us for this rain",
    "Load shedding AND rain? Double whammy!",
  ],
  
  // Sunny/Clear
  sunny: [
    "Sunglasses on, it's beautiful out there! ☀️",
    "Blue skies and good vibes",
    "Perfect day for Table Mountain",
    "The hadedas are singing in approval",
    "Get your vitamin D, lekker sunshine!",
    "Sunscreen alert - UV is hectic",
  ],
  
  // Cloudy
  cloudy: [
    "Bit overcast, but we're not complaining",
    "Grey skies but warm hearts ☁️",
    "Might rain, might not - classic SA weather",
    "Photography weather - soft light everywhere",
  ],
  
  // Windy
  windy: [
    "Hold onto your hats, it's wild out there! 💨",
    "Cape Town showing off its southeaster",
    "Kite surfing weather in Langebaan!",
    "Your hairdo is not surviving this wind",
    "Braai smoke going in ALL directions",
  ],
  
  // Storm/Thunder
  storm: [
    "Get the pets inside, storm's coming! ⚡",
    "Joburg highveld thunder vibes",
    "Lightning show tonight, free entertainment",
    "Unplug your electronics, just to be safe",
    "Thunder and load shedding - the SA experience",
  ],
  
  // UV warnings
  highUV: [
    "UV is hectic today, sunscreen is non-negotiable! 🧴",
    "Slip, slop, slap - your skin will thank you",
    "The ozone hole is doing its thing, cover up",
    "Dermatologist-approved advice: seek shade!",
  ],
};

/**
 * Get a random item from an array safely
 */
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/**
 * Get a random funny comment based on weather conditions
 */
export function getWeatherComment(weather: WeatherForecast): string {
  const current = weather.current;
  const today = weather.forecast.forecastday[0];
  const temp = current.temp_c;
  const uv = current.uv;
  const conditionCode = current.condition.code;
  const windKph = current.wind_kph;
  
  // Check for specific conditions first
  
  // High UV warning (UV >= 8)
  if (uv >= 8) {
    return randomItem(SA_WEATHER_COMMENTS.highUV);
  }
  
  // Storm/Thunder (codes 1087, 1273-1282)
  if (conditionCode === 1087 || (conditionCode >= 1273 && conditionCode <= 1282)) {
    return randomItem(SA_WEATHER_COMMENTS.storm);
  }
  
  // Rain (codes 1063, 1150-1201, 1240-1246)
  if (
    conditionCode === 1063 ||
    (conditionCode >= 1150 && conditionCode <= 1201) ||
    (conditionCode >= 1240 && conditionCode <= 1246) ||
    (today && today.day.daily_chance_of_rain >= 50)
  ) {
    return randomItem(SA_WEATHER_COMMENTS.rain);
  }
  
  // Very windy (> 40 km/h)
  if (windKph > 40) {
    return randomItem(SA_WEATHER_COMMENTS.windy);
  }
  
  // Cloudy (codes 1003-1009)
  if (conditionCode >= 1003 && conditionCode <= 1009) {
    return randomItem(SA_WEATHER_COMMENTS.cloudy);
  }
  
  // Temperature-based comments
  if (temp >= 30) {
    return randomItem(SA_WEATHER_COMMENTS.hot);
  } else if (temp >= 20) {
    return randomItem(SA_WEATHER_COMMENTS.warm);
  } else if (temp >= 10) {
    return randomItem(SA_WEATHER_COMMENTS.cool);
  } else {
    return randomItem(SA_WEATHER_COMMENTS.cold);
  }
}

// ============================================================================
// Caching Helpers
// ============================================================================

/**
 * Generate a unique key for a location (rounded to 2 decimal places)
 */
function getLocationKey(lat: number, lon: number): string {
  return `weather_${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

/**
 * Get the start of today in ISO string format (for cache expiry)
 */
function getTodayStart(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

/**
 * Get the end of today in ISO string format (for cache expiry)
 */
function getTodayEnd(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

/**
 * Check if cached data is still valid (not expired)
 */
function isCacheValid(cachedData: CachedWeatherData): boolean {
  const now = new Date();
  const expiresAt = new Date(cachedData.expiresAt);
  return now < expiresAt;
}

// ============================================================================
// LocalStorage Caching (simple key-value, no RxDB schema complexity)
// ============================================================================

const WEATHER_CACHE_PREFIX = 'gogga_weather_cache_';

/**
 * Get cached weather data from localStorage
 */
function getCachedWeather(locationKey: string): CachedWeatherData | null {
  if (typeof window === 'undefined') return null; // SSR guard
  
  try {
    const cacheKey = `${WEATHER_CACHE_PREFIX}${locationKey}`;
    const stored = localStorage.getItem(cacheKey);
    
    if (stored) {
      const cached = JSON.parse(stored) as CachedWeatherData;
      if (isCacheValid(cached)) {
        console.log(`[WeatherService] Cache hit for ${locationKey}`);
        return cached;
      }
      console.log(`[WeatherService] Cache expired for ${locationKey}`);
      // Clean up expired cache
      localStorage.removeItem(cacheKey);
    }
    return null;
  } catch (error) {
    console.error('[WeatherService] Error reading cache:', error);
    return null;
  }
}

/**
 * Store weather data in localStorage cache
 */
function setCachedWeather(locationKey: string, forecast: WeatherForecast): void {
  if (typeof window === 'undefined') return; // SSR guard
  
  try {
    const cachedData: CachedWeatherData = {
      forecast,
      fetchedAt: new Date().toISOString(),
      expiresAt: getTodayEnd(),
      locationKey,
    };
    
    const cacheKey = `${WEATHER_CACHE_PREFIX}${locationKey}`;
    localStorage.setItem(cacheKey, JSON.stringify(cachedData));
    
    console.log(`[WeatherService] Cached weather for ${locationKey}`);
  } catch (error) {
    console.error('[WeatherService] Error writing cache:', error);
  }
}

// ============================================================================
// Track last weather shown date (for daily prompt)
// ============================================================================

const LAST_WEATHER_SHOWN_KEY = 'gogga_last_weather_shown';

/**
 * Check if we've shown weather to the user today
 */
export function hasShownWeatherToday(): boolean {
  if (typeof window === 'undefined') return true; // SSR guard
  
  const lastShown = localStorage.getItem(LAST_WEATHER_SHOWN_KEY);
  if (!lastShown) return false;
  
  const lastShownDate = new Date(lastShown);
  const today = new Date();
  
  return (
    lastShownDate.getFullYear() === today.getFullYear() &&
    lastShownDate.getMonth() === today.getMonth() &&
    lastShownDate.getDate() === today.getDate()
  );
}

/**
 * Mark that we've shown weather today
 */
export function markWeatherShownToday(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_WEATHER_SHOWN_KEY, new Date().toISOString());
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch 7-day weather forecast from WeatherAPI
 * Uses cache if available and not expired
 */
export async function fetchWeatherForecast(
  lat: number,
  lon: number,
  forceRefresh = false
): Promise<WeatherForecast> {
  // Check if API key is configured
  if (!isWeatherConfigured()) {
    throw new Error('Weather API key not configured. Add NEXT_PUBLIC_WEATHER_API_KEY to your .env.local file.');
  }
  
  const locationKey = getLocationKey(lat, lon);
  
  // Check cache first (unless forced refresh)
  if (!forceRefresh) {
    const cached = getCachedWeather(locationKey);
    if (cached) {
      return cached.forecast;
    }
  }
  
  // Fetch from API
  console.log(`[WeatherService] Fetching fresh weather for ${lat}, ${lon}`);
  
  const url = `${WEATHER_API_BASE}/forecast.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&days=7&aqi=no&alerts=no`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[WeatherService] API error:', error);
    
    // Provide user-friendly error messages
    if (response.status === 401 || response.status === 403) {
      throw new Error('Weather API key is invalid or expired. Please check your configuration.');
    }
    throw new Error(`Weather service error (${response.status}). Please try again later.`);
  }
  
  const forecast: WeatherForecast = await response.json();
  
  // Cache the result
  setCachedWeather(locationKey, forecast);
  
  return forecast;
}

/**
 * Get weather by city name (uses WeatherAPI geocoding)
 */
export async function fetchWeatherByCity(cityName: string): Promise<WeatherForecast> {
  const url = `${WEATHER_API_BASE}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(cityName)}&days=7&aqi=no&alerts=no`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[WeatherService] API error:', error);
    throw new Error(`Weather API error: ${response.status}`);
  }
  
  const forecast: WeatherForecast = await response.json();
  
  // Cache with location key from response
  const locationKey = getLocationKey(forecast.location.lat, forecast.location.lon);
  setCachedWeather(locationKey, forecast);
  
  return forecast;
}

/**
 * Get cached weather without API call (for offline/quick access)
 */
export function getCachedWeatherData(lat: number, lon: number): WeatherForecast | null {
  const locationKey = getLocationKey(lat, lon);
  const cached = getCachedWeather(locationKey);
  return cached?.forecast ?? null;
}

/**
 * Check if we need to fetch weather (for determining when to show daily prompt)
 */
export function needsWeatherFetch(lat: number, lon: number): boolean {
  const locationKey = getLocationKey(lat, lon);
  const cached = getCachedWeather(locationKey);
  return cached === null;
}

// ============================================================================
// Day Name Helper
// ============================================================================

export function getDayName(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZA', { weekday: 'short' });
}

// ============================================================================
// Weather Icon Mapping (WeatherAPI codes to Lucide icons)
// ============================================================================

export function getWeatherIconName(code: number, isDay: number = 1): string {
  // WeatherAPI condition codes: https://www.weatherapi.com/docs/weather_conditions.json
  
  // Clear/Sunny
  if (code === 1000) return isDay ? 'Sun' : 'Moon';
  
  // Partly cloudy
  if (code === 1003) return isDay ? 'CloudSun' : 'CloudMoon';
  
  // Cloudy/Overcast
  if (code >= 1006 && code <= 1009) return 'Cloud';
  
  // Thunderstorm (check before mist/fog since 1087 is in that range)
  if (code === 1087 || (code >= 1273 && code <= 1282)) {
    return 'CloudLightning';
  }
  
  // Mist/Fog
  if (code >= 1030 && code <= 1147) return 'CloudFog';
  
  // Rain/Drizzle
  if (
    (code >= 1063 && code <= 1072) ||
    (code >= 1150 && code <= 1201) ||
    (code >= 1240 && code <= 1246)
  ) {
    return 'CloudRain';
  }
  
  // Snow
  if (
    (code >= 1066 && code <= 1072) ||
    (code >= 1114 && code <= 1117) ||
    (code >= 1210 && code <= 1225) ||
    (code >= 1255 && code <= 1264)
  ) {
    return 'CloudSnow';
  }
  
  // Sleet/Ice
  if (code >= 1069 && code <= 1072) return 'CloudHail';
  if (code >= 1198 && code <= 1201) return 'CloudHail';
  if (code >= 1237 && code <= 1264) return 'CloudHail';
  
  return 'Cloud';
}

/**
 * Get UV level severity
 */
export function getUVLevel(uv: number): { label: string; color: string; isWarning: boolean } {
  if (uv >= 11) return { label: 'Extreme', color: 'text-red-600 bg-red-100', isWarning: true };
  if (uv >= 8) return { label: 'Very High', color: 'text-red-500 bg-red-50', isWarning: true };
  if (uv >= 6) return { label: 'High', color: 'text-orange-500 bg-orange-50', isWarning: true };
  if (uv >= 3) return { label: 'Moderate', color: 'text-yellow-600 bg-yellow-50', isWarning: false };
  return { label: 'Low', color: 'text-green-600 bg-green-50', isWarning: false };
}
