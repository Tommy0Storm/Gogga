# Places Search & Location Fix - December 21, 2025

## Issue Report
- **User:** mgt.f3r@gmail.com
- **Report:** "Asked for nearest petrol station and it bombed out"
- **URL:** https://192.168.0.130:3002/
- **User Location:** Pretoriuspark (suburb of Pretoria)

## Root Cause Analysis

### Primary Issues

1. **Missing `additionalProperties: false`** in all search tool definitions
   - Cerebras API requires this for strict mode
   - Without it, tool calls fail with 422 errors
   - Affected: `web_search`, `legal_search`, `shopping_search`, `places_search`

2. **Unsafe `.toFixed()` call** in `getLocationContext()`
   - Could crash if `lat`/`lon` were not valid numbers
   - No validation before calling number methods

3. **Location source inconsistency**
   - Multiple sources (GPS, IP, cache, manual) without clear tracking
   - Race conditions between async operations
   - No debug logging to trace which source was used

4. **Suburb not recognized** by Open-Meteo geocoding API
   - "Pretoriuspark" doesn't exist in the geocoding database
   - Weather lookup was failing silently

5. **Poor location context for places_search**
   - AI wasn't being instructed to extract location from user context
   - Location parameter often defaulted to "South Africa"

### Secondary Issues

6. **SSE stream error handling** was too aggressive
   - JSON parse errors could crash the stream
   - No distinction between parse errors and stream errors

7. **IP geolocation displayName** was suboptimal
   - Using city + country_name, missing region
   - Less specific than GPS-based location

## Fixes Applied

### 1. Backend: search_definitions.py
- Added `"additionalProperties": False` to all 4 search tools
- Cerebras-compatible tool schemas

### 2. Backend: search_service.py
- Enhanced `search_places()` method:
  - Better location fallback handling (empty/unknown → "South Africa")
  - Query enhancement with location context when appropriate
  - Specific exception handling (TimeoutException, HTTPStatusError)
  - More informative error messages

### 3. Frontend: useLocation.ts

**Major Enhancements:**
- Added `source` field to `UserLocation` interface: `'gps' | 'ip' | 'manual' | 'cache' | 'suggestion'`
- Added comprehensive debug logging system with categories:
  - `[Location:IP]` - IP geolocation
  - `[Location:GPS]` - Native geolocation
  - `[Location:CACHE]` - Loading from localStorage
  - `[Location:GEOCODE]` - Reverse geocoding
  - `[Location:MANUAL]` - Manual entry
  - `[Location:SUGGEST]` - Autocomplete selection
  - `[Location:CONTEXT]` - Context sent to LLM

**Debug Mode:**
```javascript
// Enable in browser console:
localStorage.setItem('gogga_debug_location', 'true')
```

**Safety Fixes:**
- Type-safe `lat`/`lon` validation before `.toFixed()`
- Null checks for missing location data
- Enhanced output format with `displayName` for better AI context

**Suburb Mappings (50+ SA suburbs):**
```typescript
const suburbMappings: Record<string, string> = {
  'pretoriuspark': 'Pretoria',
  'sandton': 'Johannesburg',
  'centurion': 'Pretoria',
  'umhlanga': 'Durban',
  // ... 50+ more mappings
};
```

### 4. Frontend: ChatClient.tsx
- Improved SSE stream error handling:
  - Added guard against malformed JSON in SSE data
  - Added type check for `eventData.type`
  - Better error logging with `SyntaxError` detection
  - Graceful degradation for unknown event types

## Files Modified
- `/gogga-backend/app/tools/search_definitions.py`
- `/gogga-backend/app/services/search_service.py`
- `/gogga-frontend/src/hooks/useLocation.ts`
- `/gogga-frontend/src/app/ChatClient.tsx`

## Test Documentation
- Created: `/TESTS/location-tests.md`
- Covers: Location sources, suburb mapping, places search, error handling

## Recommendations

### Coding Standards
1. **Always include `"additionalProperties": False`** for Cerebras tool definitions
2. **Always validate data types** before calling methods like `.toFixed()`, `.toString()`
3. **Always track data source** for debugging async/multi-source data flows
4. **Use debug logging** with categories for complex hooks

### Testing
1. Test location features with SA suburb names, not just major cities
2. Test places_search with various location contexts
3. Test error scenarios (API timeout, 4xx/5xx errors)
4. Enable debug mode when troubleshooting location issues

### Monitoring
- Watch for `[Location:*]` logs in development
- Monitor Serper API response times
- Track places_search success/failure rates

## Prevention Checklist
- [ ] Cerebras tool definitions have `additionalProperties: false`
- [ ] Number methods have type guards
- [ ] Async data sources are tracked with `source` field
- [ ] Error handlers distinguish error types
- [ ] SA suburbs are mapped to parent cities for geocoding
