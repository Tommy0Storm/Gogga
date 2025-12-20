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
- **Framework**: Next.js 16.0.7 with App Router + Turbopack
- **Language**: TypeScript
- **UI**: React 19.1.0
- **Styling**: Tailwind CSS 4.1.17 (Monochrome theme, @theme CSS config)
- **Icons**: Lucide React 0.555.0 + Custom GoggaIcons (black only)
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
  "next": "16.0.7",
  "react": "19.2.1",
  "tailwindcss": "4.1.17",
  "@tailwindcss/postcss": "4.1.17",
  "@huggingface/transformers": "^3.8.1",
  "onnxruntime-web": "^1.23.2",
  "lucide-react": "0.556.0",
  "posthog-js": "1.302.2",
  "next-auth": "5.0.0-beta.30",
  "@prisma/client": "5.22.0",
  "axios": "^1.6.2",
  "recharts": "^3.5.1",
  "rxdb": "^16.21.1"  // PRIMARY - replaced Dexie
  // "dexie": "^4.2.1" - DEPRECATED, legacy backup only
}
```

## Browser LLM Performance Optimizations
- **WebGPU auto-detection**: 10-50x faster inference when available
- **Adaptive quantization**: q4 for WebGPU, q8 for WASM
- **Singleton pipeline**: Load model once, reuse across requests
- **Browser Cache API**: Persist ~50MB model between sessions
- **Batched processing**: 3 docs at a time with `requestIdlePromise()`
- See `browser_rag_llm_performance.md` for full details

## Turbopack Configuration Notes
The frontend uses Turbopack (Next.js 16 default). Key configuration for browser-only ML libraries:
- Node.js modules (`fs`, `path`, `crypto`) aliased to `./src/empty.ts` 
- `sharp` and `onnxruntime-node` also aliased to empty module
- `@huggingface/transformers` uses browser-specific build via `{ browser: '...' }` condition

