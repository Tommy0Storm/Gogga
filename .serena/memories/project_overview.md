# GOGGA Project Overview

## Purpose
GOGGA (named after the South African colloquial term for "insect") is a **Sovereign Bicameral AI Architecture** for the South African digital ecosystem. It's a high-performance, cost-optimized conversational AI chat application that implements:

- **Bicameral Routing**: Routes requests between a Speed Layer (Llama 3.1 8B) and Complex Layer (Qwen 3 235B) based on query complexity
- **Local Payment Integration**: PayFast for ZAR subscription billing
- **POPIA Compliance**: Data sovereignty with Azure South Africa North deployment
- **Voice-First Design**: Supports vernacular language users via voice input

## Target Market
- South African users requiring AI assistance
- Legal professionals (POPIA, Consumer Protection Act)
- Developers needing coding help
- Multilingual support for 11 official SA languages

## Key Features
1. Automatic intent classification for model routing
2. Cost tracking with ZAR conversion
3. Subscription tiers (Starter R49, Professional R149, Enterprise R499)
4. Voice recording and transcription
5. Real-time cost transparency

## Current Status (Updated: December 3, 2025)

✅ **Backend**: Running on http://localhost:8000
✅ **Frontend**: Running on http://localhost:3000  
✅ **Cerebras API**: Connected and healthy (710ms latency)
✅ **Bicameral Router**: Tested and working (Speed/Complex layer routing)

### Environment Setup Complete
- Python 3.12 virtual environment created at `gogga-backend/venv/`
- All backend dependencies installed
- All frontend dependencies installed (npm)
- `.env` configured with Cerebras API key

## Project Structure
```
Gogga/
├── gogga-backend/          # FastAPI Python Backend
│   ├── app/
│   │   ├── api/v1/endpoints/  # REST endpoints (chat, payments)
│   │   ├── core/              # Router, security, exceptions
│   │   ├── models/            # Pydantic & SQLModel schemas
│   │   └── services/          # AI, PayFast, cost tracking
│   ├── tests/                 # Pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
├── gogga-frontend/         # Next.js 14 Frontend
│   ├── src/app/            # App Router pages
│   ├── src/components/     # React components
│   └── Dockerfile
├── docker-compose.yml
└── project.txt             # Full specification document
```
