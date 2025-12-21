# Location & Places Search Test Suite

> **Last Updated:** December 21, 2025
> **Related Files:**
> - `gogga-frontend/src/hooks/useLocation.ts`
> - `gogga-backend/app/tools/search_definitions.py`
> - `gogga-backend/app/services/search_service.py`
> - `gogga-frontend/src/app/ChatClient.tsx`

## Test Categories

### 1. Location Source Tests

| Test ID | Description | Expected Behavior |
|---------|-------------|-------------------|
| LOC-001 | GPS location acquisition | Coordinates obtained with `source: 'gps'` |
| LOC-002 | IP fallback when GPS fails | Falls back to IP geolocation with `source: 'ip'`, `isApproximate: true` |
| LOC-003 | Manual location entry | User-entered location with `source: 'manual'`, `isManual: true` |
| LOC-004 | Suggestion autocomplete | Pre-geocoded result with `source: 'suggestion'` |
| LOC-005 | Cache loading | Cached location loaded with `source: 'cache'` |
| LOC-006 | Cache expiry (1 hour) | Expired cache triggers fresh location request |

### 2. Suburb Mapping Tests (South Africa)

| Test ID | Suburb | Expected City | Notes |
|---------|--------|---------------|-------|
| SUB-001 | Pretoriuspark | Pretoria | User-reported issue |
| SUB-002 | Sandton | Johannesburg | Major business district |
| SUB-003 | Centurion | Pretoria | Large suburb |
| SUB-004 | Umhlanga | Durban | Coastal suburb |
| SUB-005 | Bellville | Cape Town | Northern suburb |
| SUB-006 | Midrand | Johannesburg | Between JHB and PTA |

### 3. Places Search Tool Tests

| Test ID | Query | Location Context | Expected Behavior |
|---------|-------|------------------|-------------------|
| PLC-001 | "nearest petrol station" | Pretoriuspark | Uses location from context for places_search |
| PLC-002 | "restaurants near me" | No location | Falls back to "South Africa" |
| PLC-003 | "pharmacies in Sandton" | Any | Uses "Sandton" from query, not user location |
| PLC-004 | "petrol stations" | Cape Town | Enhances query with location context |

### 4. Error Handling Tests

| Test ID | Scenario | Expected Behavior |
|---------|----------|-------------------|
| ERR-001 | Invalid lat/lon (NaN) | `getLocationContext()` returns null, no crash |
| ERR-002 | Serper API timeout | Friendly error message, no crash |
| ERR-003 | Serper API 4xx/5xx | Specific HTTP error in response |
| ERR-004 | Malformed SSE JSON | Logged warning, stream continues |
| ERR-005 | Missing eventData.type | Logged warning, event skipped |
| ERR-006 | Nominatim geocode fails | Coordinates saved, city may be missing |

### 5. Debug Logging Tests

Enable debug mode by setting `localStorage.setItem('gogga_debug_location', 'true')` in browser console.

| Log Category | Sample Log | When Triggered |
|--------------|------------|----------------|
| `[Location:IP]` | IP geolocation details | IP-based location fallback |
| `[Location:GPS]` | GPS coordinates + accuracy | Native geolocation |
| `[Location:CACHE]` | Cache age in minutes | Loading saved location |
| `[Location:GEOCODE]` | Nominatim address response | Reverse geocoding |
| `[Location:MANUAL]` | Manual entry result | User types location |
| `[Location:SUGGEST]` | Autocomplete selection | User picks suggestion |
| `[Location:CONTEXT]` | Context sent to LLM | Each chat message with location |

## Manual Testing Procedure

### Test 1: Petrol Station Query (Original Issue)

1. Clear localStorage: `localStorage.clear()`
2. Reload page
3. Allow location permission (or use IP fallback)
4. Type: "what is nearest petrol station and directions"
5. Verify:
   - Location context appears in logs: `[Location:CONTEXT]`
   - `places_search` tool is called (check terminal logs)
   - Results include petrol stations near user's location
   - No crash or error message

### Test 2: Location Source Consistency

1. Enable debug: `localStorage.setItem('gogga_debug_location', 'true')`
2. Clear location: `localStorage.removeItem('gogga_user_location')`
3. Reload page
4. Accept location permission
5. Check console for `[Location:GPS]` or `[Location:IP]` logs
6. Reload page again
7. Check console for `[Location:CACHE]` log with source info
8. Verify location displays consistently

### Test 3: Suburb Weather Lookup

1. Set location to "Pretoriuspark" manually
2. Verify weather widget shows Pretoria weather
3. Check logs for `[Weather] Suburb 'Pretoriuspark' mapped to 'Pretoria'`

## Running Automated Tests

```bash
# Backend search tool tests
cd gogga-backend
pytest tests/test_search_tools.py -v

# Frontend location hook tests (if available)
cd gogga-frontend
pnpm vitest run src/hooks/__tests__/useLocation.test.ts
```

## Known Issues & Workarounds

### Issue: Different locations on refresh
**Cause:** Cache expiry or multiple location sources racing
**Fix:** Added `source` field to UserLocation, improved cache handling

### Issue: Weather not showing for suburbs
**Cause:** Open-Meteo geocoding doesn't recognize SA suburb names
**Fix:** Added suburb-to-city mapping in `sanitizeCityName()`

### Issue: places_search returns generic results
**Cause:** Location parameter defaulting to "South Africa"
**Fix:** Enhanced location context with explicit instruction for AI

## Cerebras Tool Compatibility

All search tools now include `"additionalProperties": False` as required by Cerebras API.

| Tool | Has additionalProperties | Status |
|------|-------------------------|--------|
| web_search | ✅ | Fixed Dec 21, 2025 |
| legal_search | ✅ | Fixed Dec 21, 2025 |
| shopping_search | ✅ | Fixed Dec 21, 2025 |
| places_search | ✅ | Fixed Dec 21, 2025 |
