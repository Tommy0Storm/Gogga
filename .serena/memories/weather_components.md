# Gogga Weather Components

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