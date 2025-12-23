/**
 * Weather Service Tests
 * 
 * Unit tests for Gogga weather integration.
 * Tests SA weather comments, helpers, and icon mapping.
 * 
 * Note: localStorage caching tests are limited because vitest
 * isolates modules - integration tests should cover full caching flow.
 */

import { describe, it, expect } from 'vitest';
import {
  getWeatherComment,
  getDayName,
  getWeatherIconName,
  getUVLevel,
  isWeatherConfigured,
  type WeatherForecast,
} from '../weatherService';

// Sample weather data for testing
const mockWeatherResponse: WeatherForecast = {
  location: {
    lat: -26.2041,
    lon: 28.0473,
    name: 'Johannesburg',
    region: 'Gauteng',
    country: 'South Africa',
    localtime: '2025-12-21 12:00',
  },
  current: {
    temp_c: 28,
    feelslike_c: 30,
    humidity: 45,
    wind_kph: 15,
    wind_dir: 'NE',
    uv: 10,
    condition: {
      text: 'Sunny',
      icon: '//cdn.weatherapi.com/weather/64x64/day/113.png',
      code: 1000,
    },
    is_day: 1,
    last_updated: '2025-12-21 12:00',
  },
  forecast: {
    forecastday: [
      {
        date: '2025-12-21',
        date_epoch: 1703116800,
        day: {
          maxtemp_c: 32,
          mintemp_c: 18,
          avgtemp_c: 25,
          maxwind_kph: 20,
          totalprecip_mm: 0,
          avghumidity: 50,
          daily_will_it_rain: 0,
          daily_chance_of_rain: 10,
          daily_will_it_snow: 0,
          daily_chance_of_snow: 0,
          uv: 10,
          condition: {
            text: 'Sunny',
            icon: '//cdn.weatherapi.com/weather/64x64/day/113.png',
            code: 1000,
          },
        },
        astro: {
          sunrise: '05:15 AM',
          sunset: '07:00 PM',
          moonrise: '10:30 PM',
          moonset: '08:45 AM',
          moon_phase: 'Waning Gibbous',
        },
        hour: [],
      },
      {
        date: '2025-12-22',
        date_epoch: 1703203200,
        day: {
          maxtemp_c: 30,
          mintemp_c: 17,
          avgtemp_c: 24,
          maxwind_kph: 18,
          totalprecip_mm: 0,
          avghumidity: 55,
          daily_will_it_rain: 0,
          daily_chance_of_rain: 30,
          daily_will_it_snow: 0,
          daily_chance_of_snow: 0,
          uv: 8,
          condition: {
            text: 'Partly cloudy',
            icon: '//cdn.weatherapi.com/weather/64x64/day/116.png',
            code: 1003,
          },
        },
        astro: {
          sunrise: '05:16 AM',
          sunset: '07:00 PM',
          moonrise: '11:30 PM',
          moonset: '09:45 AM',
          moon_phase: 'Waning Gibbous',
        },
        hour: [],
      },
    ],
  },
};

describe('Weather Service', () => {
  describe('API Configuration', () => {
    it('isWeatherConfigured returns boolean', () => {
      const result = isWeatherConfigured();
      expect(typeof result).toBe('boolean');
    });

    it('isWeatherConfigured checks for valid key length', () => {
      // Function checks if key exists and length > 10
      // Without env var set, should return false
      // With valid env var, should return true
      const result = isWeatherConfigured();
      // In test environment, likely no key set
      expect(result).toBe(false);
    });
  });

  describe('SA Weather Comments', () => {
    it('should return a comment for high UV weather', () => {
      const highUVForecast = {
        ...mockWeatherResponse,
        current: { ...mockWeatherResponse.current, uv: 11 },
      };
      const comment = getWeatherComment(highUVForecast);
      expect(comment).toBeTruthy();
      expect(typeof comment).toBe('string');
    });

    it('should return a comment for hot weather', () => {
      const hotForecast = {
        ...mockWeatherResponse,
        current: { ...mockWeatherResponse.current, temp_c: 38, uv: 5 },
      };
      const comment = getWeatherComment(hotForecast);
      expect(comment).toBeTruthy();
    });

    it('should return a comment for cold weather', () => {
      const coldForecast = {
        ...mockWeatherResponse,
        current: { ...mockWeatherResponse.current, temp_c: 5, uv: 2 },
      };
      const comment = getWeatherComment(coldForecast);
      expect(comment).toBeTruthy();
    });

    it('should return a comment for rainy weather', () => {
      const rainyForecast = {
        ...mockWeatherResponse,
        current: {
          ...mockWeatherResponse.current,
          uv: 3,
          temp_c: 18,
          condition: { text: 'Light rain', icon: '', code: 1183 },
        },
      };
      const comment = getWeatherComment(rainyForecast);
      expect(comment).toBeTruthy();
    });

    it('should return a comment for storm weather', () => {
      const stormForecast = {
        ...mockWeatherResponse,
        current: {
          ...mockWeatherResponse.current,
          uv: 2,
          temp_c: 20,
          condition: { text: 'Thunderstorm', icon: '', code: 1087 },
        },
      };
      const comment = getWeatherComment(stormForecast);
      expect(comment).toBeTruthy();
    });

    it('should return default comment for normal weather', () => {
      const normalForecast = {
        ...mockWeatherResponse,
        current: {
          ...mockWeatherResponse.current,
          uv: 5,
          temp_c: 22,
          condition: { text: 'Partly cloudy', icon: '', code: 1003 },
        },
      };
      const comment = getWeatherComment(normalForecast);
      expect(comment).toBeTruthy();
    });
  });

  describe('Day Name Helper', () => {
    it('should return "Today" for index 0', () => {
      expect(getDayName('2025-12-21', 0)).toBe('Today');
    });

    it('should return "Tomorrow" for index 1', () => {
      expect(getDayName('2025-12-22', 1)).toBe('Tomorrow');
    });

    it('should return weekday name for other days', () => {
      const dayName = getDayName('2025-12-23', 2);
      expect(dayName).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/);
    });
  });

  describe('Weather Icon Mapping', () => {
    it('should return Sun for clear day (code 1000)', () => {
      expect(getWeatherIconName(1000, 1)).toBe('Sun');
    });

    it('should return Moon for clear night (code 1000)', () => {
      expect(getWeatherIconName(1000, 0)).toBe('Moon');
    });

    it('should return CloudSun for partly cloudy day', () => {
      expect(getWeatherIconName(1003, 1)).toBe('CloudSun');
    });

    it('should return CloudMoon for partly cloudy night', () => {
      expect(getWeatherIconName(1003, 0)).toBe('CloudMoon');
    });

    it('should return Cloud for overcast', () => {
      expect(getWeatherIconName(1009)).toBe('Cloud');
    });

    it('should return CloudRain for rain codes', () => {
      expect(getWeatherIconName(1183)).toBe('CloudRain');
    });

    it('should return CloudLightning for thunderstorm', () => {
      expect(getWeatherIconName(1087)).toBe('CloudLightning');
    });

    it('should return CloudSnow for snow codes', () => {
      expect(getWeatherIconName(1213)).toBe('CloudSnow');
    });
  });

  describe('UV Level Classification', () => {
    it('should return Extreme for UV 11+', () => {
      const level = getUVLevel(11);
      expect(level.label).toBe('Extreme');
      expect(level.isWarning).toBe(true);
    });

    it('should return Very High for UV 8-10', () => {
      const level = getUVLevel(9);
      expect(level.label).toBe('Very High');
      expect(level.isWarning).toBe(true);
    });

    it('should return High for UV 6-7', () => {
      const level = getUVLevel(6);
      expect(level.label).toBe('High');
      expect(level.isWarning).toBe(true);
    });

    it('should return Moderate for UV 3-5', () => {
      const level = getUVLevel(4);
      expect(level.label).toBe('Moderate');
      expect(level.isWarning).toBe(false);
    });

    it('should return Low for UV 0-2', () => {
      const level = getUVLevel(2);
      expect(level.label).toBe('Low');
      expect(level.isWarning).toBe(false);
    });
  });
});
