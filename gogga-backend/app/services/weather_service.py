"""
GOGGA Weather Service - Open-Meteo Integration.

Provides weather data for AI tool calling.
The frontend can receive location from AI and display weather panel.
"""
import logging
import httpx
from typing import Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Open-Meteo API (free, no API key needed)
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


@dataclass
class WeatherLocation:
    """Location for weather lookup."""
    lat: float
    lon: float
    name: str


# South African cities for quick lookup
SA_CITIES: dict[str, WeatherLocation] = {
    # Major cities
    "johannesburg": WeatherLocation(-26.2041, 28.0473, "Johannesburg"),
    "joburg": WeatherLocation(-26.2041, 28.0473, "Johannesburg"),
    "jhb": WeatherLocation(-26.2041, 28.0473, "Johannesburg"),
    "cape town": WeatherLocation(-33.9249, 18.4241, "Cape Town"),
    "capetown": WeatherLocation(-33.9249, 18.4241, "Cape Town"),
    "durban": WeatherLocation(-29.8587, 31.0218, "Durban"),
    "pretoria": WeatherLocation(-25.7479, 28.2293, "Pretoria"),
    "pta": WeatherLocation(-25.7479, 28.2293, "Pretoria"),
    "port elizabeth": WeatherLocation(-33.9608, 25.6022, "Gqeberha"),
    "gqeberha": WeatherLocation(-33.9608, 25.6022, "Gqeberha"),
    "bloemfontein": WeatherLocation(-29.0852, 26.1596, "Bloemfontein"),
    "bloem": WeatherLocation(-29.0852, 26.1596, "Bloemfontein"),
    "east london": WeatherLocation(-33.0153, 27.9116, "East London"),
    "polokwane": WeatherLocation(-23.9045, 29.4688, "Polokwane"),
    "pietersburg": WeatherLocation(-23.9045, 29.4688, "Polokwane"),
    "nelspruit": WeatherLocation(-25.4753, 30.9694, "Mbombela"),
    "mbombela": WeatherLocation(-25.4753, 30.9694, "Mbombela"),
    "kimberley": WeatherLocation(-28.7323, 24.7623, "Kimberley"),
    
    # Smaller cities
    "centurion": WeatherLocation(-25.8603, 28.1894, "Centurion"),
    "sandton": WeatherLocation(-26.1076, 28.0567, "Sandton"),
    "soweto": WeatherLocation(-26.2678, 27.8585, "Soweto"),
    "midrand": WeatherLocation(-25.9891, 28.1278, "Midrand"),
    "randburg": WeatherLocation(-26.0936, 28.0064, "Randburg"),
    "roodepoort": WeatherLocation(-26.1625, 27.8725, "Roodepoort"),
    "benoni": WeatherLocation(-26.1883, 28.3206, "Benoni"),
    "boksburg": WeatherLocation(-26.2125, 28.2567, "Boksburg"),
    "krugersdorp": WeatherLocation(-26.0858, 27.7694, "Krugersdorp"),
    "stellenbosch": WeatherLocation(-33.9346, 18.8664, "Stellenbosch"),
    "paarl": WeatherLocation(-33.7244, 18.9728, "Paarl"),
    "george": WeatherLocation(-33.9631, 22.4617, "George"),
    "knysna": WeatherLocation(-34.0356, 23.0488, "Knysna"),
    "mossel bay": WeatherLocation(-34.1825, 22.1458, "Mossel Bay"),
    "plettenberg bay": WeatherLocation(-34.0526, 23.3716, "Plettenberg Bay"),
    "plett": WeatherLocation(-34.0526, 23.3716, "Plettenberg Bay"),
    "umhlanga": WeatherLocation(-29.7333, 31.0833, "Umhlanga"),
    "ballito": WeatherLocation(-29.5392, 31.2142, "Ballito"),
    "pietermaritzburg": WeatherLocation(-29.6006, 30.3794, "Pietermaritzburg"),
    "pmb": WeatherLocation(-29.6006, 30.3794, "Pietermaritzburg"),
    "richards bay": WeatherLocation(-28.7830, 32.0377, "Richards Bay"),
    "rustenburg": WeatherLocation(-25.6715, 27.2420, "Rustenburg"),
    "potchefstroom": WeatherLocation(-26.7167, 27.1000, "Potchefstroom"),
    "klerksdorp": WeatherLocation(-26.8667, 26.6667, "Klerksdorp"),
    "witbank": WeatherLocation(-25.8700, 29.2333, "Emalahleni"),
    "emalahleni": WeatherLocation(-25.8700, 29.2333, "Emalahleni"),
    "secunda": WeatherLocation(-26.5167, 29.1667, "Secunda"),
    "upington": WeatherLocation(-28.4478, 21.2561, "Upington"),
    "springbok": WeatherLocation(-29.6667, 17.8833, "Springbok"),
    "hermanus": WeatherLocation(-34.4128, 19.2378, "Hermanus"),
    "franschhoek": WeatherLocation(-33.9128, 19.1181, "Franschhoek"),
    "oudtshoorn": WeatherLocation(-33.5989, 22.2028, "Oudtshoorn"),
    "grahamstown": WeatherLocation(-33.3114, 26.5311, "Makhanda"),
    "makhanda": WeatherLocation(-33.3114, 26.5311, "Makhanda"),
    "queenstown": WeatherLocation(-31.8975, 26.8753, "Queenstown"),
    "mthatha": WeatherLocation(-31.5889, 28.7844, "Mthatha"),
    "umtata": WeatherLocation(-31.5889, 28.7844, "Mthatha"),
    "welkom": WeatherLocation(-27.9833, 26.7333, "Welkom"),
}


def resolve_location(query: str) -> WeatherLocation | None:
    """
    Resolve a location query to coordinates.
    First tries SA cities lookup, then could use geocoding.
    """
    normalized = query.lower().strip()
    
    # Direct city lookup
    if normalized in SA_CITIES:
        return SA_CITIES[normalized]
    
    # Partial match
    for city_key, location in SA_CITIES.items():
        if normalized in city_key or city_key in normalized:
            return location
    
    return None


async def fetch_weather(lat: float, lon: float) -> dict[str, Any]:
    """
    Fetch weather data from Open-Meteo API.
    
    Returns:
        Dict with current weather and 7-day forecast
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max",
        "timezone": "auto",
        "forecast_days": 7,
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(OPEN_METEO_URL, params=params)
        response.raise_for_status()
        return response.json()


def format_weather_for_ai(data: dict[str, Any], location_name: str) -> str:
    """
    Format weather data as text for AI response.
    """
    current = data.get("current", {})
    daily = data.get("daily", {})
    
    temp = current.get("temperature_2m", "?")
    feels = current.get("apparent_temperature", "?")
    humidity = current.get("relative_humidity_2m", "?")
    wind = current.get("wind_speed_10m", "?")
    uv = current.get("uv_index", 0)
    
    # UV warning
    uv_warning = ""
    if uv >= 8:
        uv_warning = f" ⚠️ UV Index is {uv:.0f} (Very High/Extreme) - sun protection essential!"
    elif uv >= 6:
        uv_warning = f" UV Index is {uv:.0f} (High) - wear sunscreen!"
    
    # 7-day summary
    days_text = []
    times = daily.get("time", [])
    max_temps = daily.get("temperature_2m_max", [])
    min_temps = daily.get("temperature_2m_min", [])
    precip = daily.get("precipitation_probability_max", [])
    
    for i, date in enumerate(times[:7]):
        day_name = "Today" if i == 0 else ("Tomorrow" if i == 1 else date)
        rain = precip[i] if i < len(precip) else 0
        rain_text = f", {rain}% rain" if rain > 20 else ""
        days_text.append(f"• {day_name}: {max_temps[i]:.0f}°/{min_temps[i]:.0f}°{rain_text}")
    
    return f"""**{location_name} Weather**

🌡️ Currently: {temp:.0f}°C (feels like {feels:.0f}°C)
💧 Humidity: {humidity}% | 💨 Wind: {wind:.0f} km/h{uv_warning}

**7-Day Forecast:**
{chr(10).join(days_text)}"""


# Tool definition for Cerebras/OpenRouter function calling
WEATHER_TOOL = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather and 7-day forecast for a South African city. Use this when the user asks about weather, temperature, or if they should take an umbrella. The weather panel will automatically appear on screen.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The South African city name (e.g., 'Johannesburg', 'Cape Town', 'Durban', 'Pretoria')"
                }
            },
            "required": ["location"]
        }
    }
}


async def handle_weather_tool_call(location: str) -> dict[str, Any]:
    """
    Handle a weather tool call from the AI.
    
    Returns:
        Dict with weather data and location info for frontend panel
    """
    # Resolve location
    loc = resolve_location(location)
    if not loc:
        return {
            "success": False,
            "error": f"I don't recognize '{location}' as a South African city. Try Johannesburg, Cape Town, Durban, Pretoria, etc.",
            "panel_data": None
        }
    
    try:
        # Fetch weather
        data = await fetch_weather(loc.lat, loc.lon)
        
        # Format for AI text response
        text_response = format_weather_for_ai(data, loc.name)
        
        # Data for frontend panel
        panel_data = {
            "lat": loc.lat,
            "lon": loc.lon,
            "name": loc.name,
        }
        
        return {
            "success": True,
            "text": text_response,
            "panel_data": panel_data,
            "raw_data": data
        }
        
    except Exception as e:
        logger.error(f"Weather fetch failed: {e}")
        return {
            "success": False,
            "error": f"Failed to fetch weather for {loc.name}: {str(e)}",
            "panel_data": None
        }
