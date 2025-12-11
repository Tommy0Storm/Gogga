# GOGGA Cognitive System Architecture

## Overview
The GOGGA Cognitive System is designed to provide a robust, scalable, and intelligent AI assistant platform tailored for South African users. This architecture integrates various services, including language detection, user relationship management, and AI model routing, to deliver a seamless user experience.

## Architecture Components

### 1. **Frontend (Next.js 16)**
- **Port**: :3000  
- **Responsibilities**: User interface, session management, and client-side data handling.
- **Key Files**:
  - `gogga-frontend/src/app/page.tsx`: Main entry point for the application.
  - `gogga-frontend/src/app/ChatClient.tsx`: Core chat UI component.

### 2. **Backend (FastAPI)**
- **Port**: :8000  
- **Responsibilities**: API endpoints, business logic, and integration with AI services.
- **Key Files**:
  - `gogga-backend/app/main.py`: FastAPI application setup.
  - `gogga-backend/app/core/router.py`: Tier-based routing logic for AI model selection.
  - `gogga-backend/app/services/ai_service.py`: Integration with AI models and handling requests.

### 3. **CePO (OptiLLM)**
- **Port**: :8080  
- **Responsibilities**: Advanced AI processing and reasoning capabilities.

## Dual Database Strategy
- **SQLite (Prisma)**: Used for server-side authentication and subscription management.
- **Dexie (IndexedDB)**: Client-side storage for chat history, RAG (Retrieval-Augmented Generation), and images.

## Key Services

### 1. **Language Detection Plugin**
- **Functionality**: Automatically detects user language and enriches requests with language metadata.
- **Performance**: < 15ms overhead, supports all 11 SA official languages.
- **Integration**: Works seamlessly with the AI service to provide culturally relevant responses.

### 2. **Buddy System**
- **Functionality**: Tracks user relationships and adapts responses based on the user's familiarity level (stranger, acquaintance, friend, bestie).
- **Storage**: User profiles stored in localStorage and memories in Dexie.

### 3. **RAG System**
- **Functionality**: Provides authoritative and analytical context for user queries, enhancing the AI's ability to respond accurately.
- **Configuration**: Supports different retrieval strategies based on user tier (JIVE vs. JIGGA).

## API Endpoints
All endpoints are prefixed with `/api/v1`:
- **`/chat`**: Main chat endpoint (requires `user_tier`).
- **`/chat/enhance`**: Enhances prompts for all tiers.
- **`/images/generate`**: Generates images based on user requests.
- **`/payments/subscribe`**: Handles subscription payments via PayFast.
- **`/payments/notify`**: Webhook for PayFast notifications.

## Development and Testing Commands
```bash
# Start the full stack
docker-compose up -d

# Start the frontend
cd gogga-frontend && pnpm dev

# Start the backend
cd gogga-backend && uvicorn app.main:app --reload

# Run backend tests
cd gogga-backend && pytest tests/ -v
```

## Critical Patterns
### Backend Service Pattern (Lazy Singleton)
```python
_client: httpx.AsyncClient | None = None
async def _get_client(self) -> httpx.AsyncClient:
    if self._client is None or self._client.is_closed:
        self._client = httpx.AsyncClient(timeout=120.0)
    return self._client
```

### Qwen Thinking Mode
```python
QWEN_THINKING_SETTINGS = {"temperature": 0.6, "top_p": 0.95, "top_k": 20}
```

## SA-Specific Requirements
- **Currency**: Always ZAR (R).
- **Languages**: Support for all 11 official languages, with seamless switching.
- **Contextual Awareness**: Understand local issues such as load shedding, SASSA, and legal frameworks.

## Conclusion
The GOGGA Cognitive System is designed to be an enterprise-level solution that integrates various services to provide a comprehensive AI assistant experience. By leveraging a dual database strategy, robust API endpoints, and a focus on South African context, GOGGA aims to deliver a user-centric platform that evolves with user needs and preferences.