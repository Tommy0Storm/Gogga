# GOGGA Tech Stack

## Backend
- **Framework**: FastAPI (Python 3.12)
- **Runtime**: Uvicorn ASGI server
- **AI Provider**: Cerebras Cloud SDK (Tricameral Architecture)
  - Speed Layer: `llama3.1-8b` (~2,200 tokens/sec, $0.10/M)
  - Complex Layer: `qwen-3-235b-a22b-instruct-2507` (~1,400 tokens/sec, $0.60-1.20/M)
  - Reasoning Layer: Qwen 3 235B + CePO (multi-step planning via OptiLLM sidecar)
- **CePO**: Cerebras Planning Optimization via OptiLLM
  - Model: `llama3.3-70b` at **2,000 reasoning tokens/s**
  - Status: Direct API works; OptiLLM has `reasoning_effort` parameter issue
- **Database**: PostgreSQL 15 with SQLModel ORM
- **HTTP Client**: HTTPX (async)
- **Validation**: Pydantic v2 with pydantic-settings
- **Payments**: PayFast (South African gateway)

## Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **UI**: React 18
- **Styling**: Tailwind CSS (Monochrome theme)
- **Icons**: Lucide React (black only)
- **Font**: Quicksand (400, 700)
- **HTTP**: Axios

## Infrastructure
- **Containers**: Docker with multi-stage builds
- **Orchestration**: Docker Compose (local), Azure Container Apps (prod)
- **Database**: PostgreSQL 15 Alpine
- **Cache**: Redis 7 Alpine (optional)
- **Region**: Azure South Africa North (Johannesburg)

## Dependencies (Backend)
```
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.6.0
pydantic-settings>=2.1.0
cerebras_cloud_sdk>=1.0.0
httpx>=0.26.0
sqlmodel>=0.0.14
asyncpg>=0.29.0
```

## Dependencies (Frontend)
```json
{
  "next": "14.0.4",
  "react": "^18.2.0",
  "axios": "^1.6.2",
  "lucide-react": "^0.294.0",
  "tailwindcss": "^3.3.6"
}
```
