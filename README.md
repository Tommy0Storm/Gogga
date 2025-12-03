# GOGGA - Sovereign Bicameral AI Architecture for South Africa

🦗 **Project GOGGA** is a high-performance, cost-optimized conversational AI platform tailored specifically for the South African market.

## Architecture Overview

GOGGA implements a **Bicameral Cognitive Strategy** that routes traffic between two distinct neural processing layers:

| Layer | Model | Speed | Use Cases |
|-------|-------|-------|-----------|
| **Speed Layer** | Llama 3.1 8B | ~2,200 tok/s | Greetings, simple queries, UI help |
| **Complex Layer** | Qwen 3 235B | ~1,400 tok/s | Legal analysis, coding, translation |

## Tech Stack

### Backend (FastAPI)
- Python 3.11+ with async processing
- Cerebras Cloud SDK for inference
- PayFast integration for ZAR payments
- PostgreSQL for persistence

### Frontend (Next.js 14)
- React with App Router
- Voice-first interactions (MediaRecorder API)
- Tailwind CSS with Monochrome theme

### Infrastructure
- Docker with multi-stage builds
- Azure Container Apps (South Africa North region)
- POPIA compliant data handling

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Cerebras API Key
- PayFast Sandbox Credentials

### Development Setup

1. Clone and configure environment:
```bash
cp gogga-backend/.env.example gogga-backend/.env
# Edit .env with your credentials
```

2. Start all services:
```bash
docker-compose up -d
```

3. Access the application:
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

## Project Structure

```
Gogga/
├── gogga-backend/          # FastAPI Backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── core/           # Routing, security, exceptions
│   │   ├── models/         # Pydantic & SQLModel schemas
│   │   └── services/       # AI, payments, cost tracking
│   ├── tests/              # Pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
├── gogga-frontend/         # Next.js Frontend
│   ├── src/
│   │   ├── app/            # Pages and layouts
│   │   └── components/     # React components
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml      # Local orchestration
└── project.txt             # Full specification
```

## API Endpoints

### Chat
- `POST /api/v1/chat` - Send message (auto-routes to Speed/Complex layer)
- `GET /api/v1/chat/models` - List available models

### Payments
- `GET /api/v1/payments/tiers` - List subscription tiers
- `POST /api/v1/payments/subscribe` - Create subscription
- `POST /api/v1/payments/notify` - PayFast ITN webhook
- `POST /api/v1/payments/cancel/{token}` - Cancel subscription

## Cost Model (USD per Million Tokens)

| Layer | Input | Output |
|-------|-------|--------|
| Speed | $0.10 | $0.10 |
| Complex | $0.60 | $1.20 |

## Subscription Tiers (ZAR)

| Tier | Price | Tokens/Month |
|------|-------|--------------|
| Starter | R49 | 50,000 |
| Professional | R149 | 200,000 |
| Enterprise | R499 | 1,000,000 |

## Design Guidelines

- **Theme**: Monochrome with grey gradients
- **Font**: Quicksand (400 & Bold)
- **Icons**: Black Material Icons only

## License

Proprietary - All rights reserved.

---

*"Howzit! Ready to help you with anything from legal questions to code."* 🇿🇦
