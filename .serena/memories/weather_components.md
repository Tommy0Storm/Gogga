# Gogga Weather Components

> **Last Updated:** December 21, 2025
> **Status:** ✅ Complete - WeatherAPI.com + GoggaForecast modal

## Overview
Weather feature for GOGGA using Open-Meteo API (free, no API key).

## Recent Fixes (Dec 5, 2025)
- **"Tmrw" → "Tomorrow"**: Fixed in `getDayName()` function
- **UV warning**: Now only shows orange left-border when `uvIndexMax >= 8` (correctly type-checked)
- **Grid layout**: Changed to CSS grid `grid-cols-[48px_36px_1fr_52px]` for proper alignment
- **Wind speed**: Added `wind_speed_10m_max` to daily forecast
- **Hail icon**: Added `CloudHail` from Lucide for weather codes 96/99
- **Panel width**: Increased to w-72 (288px) for more info
- **Storm indicator**: Purple left-border for thunderstorm days (code >= 95)

## Frontend Components

### WeatherSlidePanel (`src/components/ChatComponents/WeatherSlidePanel.tsx`)
- **Branding**: "Gogga Weather" 
- **Icons**: Lucide icons (Sun, Moon, Cloud, CloudRain, etc.) - guaranteed to render
- **Theme**: Monochrome grey gradient, black icons
- **Features**:
  - 7-day forecast with compact rows
  - UV Index with warnings (red for UV 8+)
  - Rain probability %
  - Auto-slides out when location determined (5 sec)
  - External location trigger from AI tool calls

### Props
```typescript
interface WeatherSlidePanelProps {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationJustDetermined?: boolean;  // triggers auto-show
  autoHideDelay?: number;  // default 5000ms
  externalLocation?: { lat: number; lon: number; name: string } | null;  // from AI
}
```

## Backend Service

### weather_service.py (`app/services/weather_service.py`)
- SA cities lookup (50+ cities)
- Open-Meteo API integration with UV index
- Tool definition for function calling
- `handle_weather_tool_call(location)` → returns panel_data for frontend

### Tool Definition
```python
WEATHER_TOOL = {
    "type": "function", 
    "function": {
        "name": "get_weather",
        "description": "Get weather for SA city. Panel auto-appears.",
        "parameters": { "location": "string" }
    }
}
```

## Integration Flow (AI Tool Call)
1. User asks "What's the weather in Durban?"
2. AI calls `get_weather("Durban")`
3. Backend returns `{ weather_panel: { lat, lon, name } }`
4. ChatClient sets `externalWeatherLocation`
5. WeatherSlidePanel auto-opens with that location's weather

## API Fields Used
- current: temperature_2m, apparent_temperature, humidity, wind, uv_index
- daily: weather_code, temp_max, temp_min, precipitation_probability, uv_index_max

---

## NEW: GoggaForecast 7-Day Modal (December 21, 2025)

### WeatherAPI.com Integration
Replaced Open-Meteo for richer data (icons, astro, conditions).

**API Key**: `NEXT_PUBLIC_WEATHER_API_KEY` (free tier: 1M calls/month)

### New Files Created

| File | Purpose |
|------|---------|
| `lib/weatherService.ts` | WeatherAPI client, localStorage caching, SA comments |
| `components/ChatComponents/GoggaForecast.tsx` | 7-day forecast modal with export |
| `lib/__tests__/weatherService.test.ts` | 28 unit tests |
| `components/__tests__/GoggaForecast.test.tsx` | Component/data structure tests |

### Modified Files

| File | Changes |
|------|---------|
| `components/LocationPrompt.tsx` | Added dropdown menu to LocationBadge with "7-Day Forecast" option |
| `components/ChatComponents/index.ts` | Added GoggaForecast export |
| `app/ChatClient.tsx` | Integrated forecast modal, daily weather greeting |

### Features

1. **7-Day Forecast Modal**
   - Access via location button dropdown → "7-Day Forecast"
   - Current weather with feels-like, humidity, wind
   - UV warning for high UV days (8+)
   - Sunrise/sunset times
   - Rain probability indicators
   - Storm warning borders (purple)

2. **Export as PNG**
   - Uses html2canvas
   - Downloads as `Gogga_Weather_[City]_[Region].png`

3. **Daily Caching (localStorage)**
   - Only 1 API call per location per day
   - Cache expires at midnight
   - Key format: `gogga_weather_cache_[lat]_[lon]`

4. **Daily Weather Greeting**
   - Shows once per day on app start
   - SA Afrikaans greeting: "Ek het jou [location] weer gekry!"
   - Random funny SA weather comment

### SA Weather Comments (weatherService.ts)

```typescript
SA_WEATHER_COMMENTS = {
  highUV: ["Eish, daai UV is hectic! Slap on the SPF 50, boet.", ...],
  storm: ["Jirre, donner coming! Don't stand under trees!", ...],
  rain: ["Bring your brolly, it's gonna bucket down!", ...],
  windy: ["Haai, die wind is mal today! Hold onto your hat.", ...],
  hot: ["Eish, dis 'n scorcher! Like a braai but you're the wors.", ...],
  cold: ["Brrrr! Cold like Joburg in winter without a heater.", ...],
  default: ["Lekker day ahead! Not too shabby, hey?", ...],
}
```

### LocationBadge Dropdown Menu

```tsx
<LocationBadge
  location={userLocation}
  onShowForecast={handleShowForecast}  // NEW
  onEdit={handleEditLocation}
  onClear={handleClearLocation}
/>
```

Menu items:
- ☁️ 7-Day Forecast
- ✏️ Edit Location  
- 🗑️ Clear Location

### API Key Setup (REQUIRED)

1. Get free API key from https://www.weatherapi.com/signup.aspx
2. Add to `.env.local`:
```bash
NEXT_PUBLIC_WEATHER_API_KEY=your_key_here
```

**Error Handling:**
- Missing key: "Weather API key not configured..."
- Invalid key: "Weather API key is invalid or expired..."
- Both show user-friendly messages with Close button

### Close Button Fix (December 21, 2025)

Fixed missing close buttons in error/loading/empty states:
- Error state: X button (top-right) + "Close" button (bottom)
- Loading state: X button (top-right)
- Empty state: X button (top-right) + "Close" button (bottom)

### Testing

```bash
# Run weather tests
cd gogga-frontend
pnpm vitest run src/lib/__tests__/weatherService.test.ts
pnpm vitest run src/components/__tests__/GoggaForecast.test.tsx
```

### Type Definitions (weatherService.ts)

```typescript
interface WeatherForecast {
  location: WeatherLocation;
  current: CurrentWeather;
  forecast: { forecastday: ForecastDay[] };
}

interface CachedWeatherData {
  forecast: WeatherForecast;
  fetchedAt: string;
  expiresAt: string;
  locationKey: string;
}
```