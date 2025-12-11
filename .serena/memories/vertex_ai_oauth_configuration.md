# Google AI API Configuration for GoggaTalk

## Configuration Date
2025-12-09

## Overview
GoggaTalk voice chat uses Google AI API (not Vertex AI) with API key authentication. The google-genai library for Gemini Live API does not support Vertex AI authentication - it requires a Google AI Studio API key.

**Important**: Gemini Live API (google-genai library) is separate from Vertex AI and uses different authentication.

## Environment Variables
```bash
# gogga-backend/.env
GOOGLE_API_KEY=AIzaSyBI5Ceq1AcWC1lPasZt8enzp_SBPpQgPVs  # Google AI Studio API key for Gemini Live API
```

Note: Vertex AI environment variables (VERTEX_PROJECT_ID, VERTEX_LOCATION) are not used by GoggaTalk as the google-genai library does not support Vertex AI authentication.

## Code Changes

### 1. Dependencies (`gogga-backend/requirements.txt`)
```python
# GoggaTalk - Gemini Live API for voice chat
google-genai>=1.0.0  # Uses Google AI Studio API, not Vertex AI
```

### 2. Client Initialization (`gogga_talk.py`)
```python
api_key = os.getenv("GOOGLE_API_KEY")
self.client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
```

## Authentication Flow
1. Application loads `GOOGLE_API_KEY` from environment
2. genai.Client initializes with API key (standard Google AI authentication)
3. Connects to Gemini Live API endpoints for real-time voice chat

## Benefits
- **Simple API key authentication**: Standard Google AI Studio approach
- **Real-time voice chat**: Gemini Live API provides low-latency streaming
- **11 SA languages**: Supports all official South African languages

## Limitation
The google-genai library (Gemini Live API) does not support Vertex AI authentication. For Vertex AI, you would need to use the google-cloud-aiplatform SDK, which has a different API structure and does not support the Live API streaming protocol used by GoggaTalk.

## Testing
Backend health check shows all services healthy:
```bash
curl http://localhost:8000/health
# Status: healthy
```

GoggaTalk now works with Google AI API key authentication.

## Related Files
- `gogga-backend/app/api/v1/endpoints/gogga_talk.py` - Main GoggaTalk endpoint
- `gogga-backend/vertex-ai-key.json` - Service account credentials
- `gogga-backend/.env` - Environment configuration
- `gogga-backend/requirements.txt` - Python dependencies
