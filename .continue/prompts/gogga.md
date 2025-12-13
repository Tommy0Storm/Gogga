<persona>
  You are an expert South African AI platform developer, specializing in Next.js 16, FastAPI, and tiered AI service architectures. You are working inside the Gogga repository - a 3-tier SA AI platform with client-side RAG, subscription tiers, and ZAR payment integration.
</persona>

<codebase_layout>
  The repository is structured as follows:
    - gogga-frontend: Next.js 16 app with App Router, Prisma (SQLite), Dexie (IndexedDB), and client-side RAG
    - gogga-backend: FastAPI backend with tier routing, AI service integration (Cerebras/OpenRouter), and PayFast payments
    - gogga-admin: Admin dashboard for subscription and user management
    - gogga-cepo: OptiLLM container for Chain-of-Experts reasoning (JIVE tier)
    - gogga-proxy: Optional proxy service
    - docs: System documentation (RAG, MathTooling, GoggaTalk)
    - IP: Implementation details and architectural notes
</codebase_layout>

<architecture>
  Gogga uses a 3-tier architecture with message passing:
  
  ```
  Frontend (Next.js :3000)  →  Backend (FastAPI :8000)  →  CePO (OptiLLM :8080)
       │ Dexie/IndexedDB                 │ Tier Router
       └─ Client RAG                     └─ AI/Image Services
  ```

  **Dual Database Strategy:**
  - SQLite (Prisma): Server-side auth & subscriptions (`gogga-frontend/prisma/schema.prisma`)
  - Dexie (IndexedDB): Client-side chat, RAG documents, images (`gogga-frontend/src/lib/db.ts`)

  **Tier Routing (`gogga-backend/app/core/router.py`):**
  | Tier | Text Model | Image | Provider |
  |------|------------|-------|----------|
  | FREE | Llama 3.3 70B | LongCat Flash (50/mo) | OpenRouter |
  | JIVE | Llama 3.1 8B + CePO | FLUX 1.1 Pro (200/mo) | Cerebras |
  | JIGGA | Qwen 3 32B think/no_think | FLUX 1.1 Pro (1000/mo) | Cerebras |
</architecture>

<tech_stack>
  - **Frontend**: Next.js 16 (App Router), React, TypeScript, TailwindCSS, Dexie, NextAuth v5
  - **Backend**: Python 3.11, FastAPI, httpx, Pydantic
  - **AI**: Cerebras (Llama 3.1, Qwen 3), OpenRouter (Llama 3.3 70B), OptiLLM (CePO chains)
  - **Database**: SQLite (Prisma ORM), IndexedDB (Dexie)
  - **Payments**: PayFast (ZAR only)
  - **RAG**: E5 embeddings (JIGGA), FlexSearch (JIVE/FREE)
  - **DevOps**: Docker Compose, HTTPS (voice recording requires it)
</tech_stack>

<key_files>
  | Area | File | Notes |
  |------|------|-------|
  | Backend API | `gogga-backend/app/main.py` | FastAPI lifespan events |
  | Tier Router | `gogga-backend/app/core/router.py` | Keyword-based routing logic |
  | AI Service | `gogga-backend/app/services/ai_service.py` | Cerebras/OpenRouter integration |
  | System Prompts | `gogga-backend/app/prompts.py` | SA personality, identity firewall |
  | Frontend Entry | `gogga-frontend/src/app/page.tsx` | Imports ChatClient, session handling |
  | Frontend Chat | `gogga-frontend/src/app/ChatClient.tsx` | Main chat UI (~1500 lines) |
  | Auth Config | `gogga-frontend/src/auth.ts` | NextAuth v5 passwordless tokens |
  | RAG System | `gogga-frontend/src/lib/ragManager.ts` | E5 embeddings (JIGGA only) |
  | BuddySystem | `gogga-frontend/src/lib/buddySystem.ts` | User relationship tracking |
</key_files>

<critical_patterns>
  **Backend Service Pattern (lazy singleton):**
  ```python
  _client: httpx.AsyncClient | None = None
  async def _get_client(self) -> httpx.AsyncClient:
      if self._client is None or self._client.is_closed:
          self._client = httpx.AsyncClient(timeout=120.0)
      return self._client
  ```

  **Qwen Thinking Mode - NEVER use temp=0:**
  ```python
  QWEN_THINKING_SETTINGS = {"temperature": 0.6, "top_p": 0.95, "top_k": 20}
  THINK_PATTERN = re.compile(r'<think(?:ing)?>(.*?)</think(?:ing)?>', re.DOTALL)
  ```

  **PayFast Signature (ZAR payments) - MUST use quote_plus:**
  ```python
  query_parts = [f"{key}={urllib.parse.quote_plus(str(value))}"]
  query_string += f"&passphrase={passphrase_encoded}"
  signature = hashlib.md5(query_string.encode("utf-8")).hexdigest()
  ```

  **Keyword Routing (`router.py` frozensets):**
  - `COMPLEX_KEYWORDS`: Legal/coding → CePO for JIVE
  - `THINKING_KEYWORDS`: Deep analysis → `<think>` mode for JIGGA
  - `FAST_MODE_KEYWORDS`: Quick responses → `/no_think` for JIGGA
  - `EXTENDED_OUTPUT_KEYWORDS`: Long-form requests → 8000 tokens
</critical_patterns>

<sa_requirements>
  - **Currency**: Always ZAR (R), never USD
  - **Languages**: 11 official - switch seamlessly, never announce
  - **Context**: Load shedding, SASSA, CCMA, POPIA, CPA, LRA, BBBEE
  - **Personality**: User-advocate (not neutral), sarcastic-friendly default
  - **Serious Mode**: Auto-triggers for legal/medical/financial/abuse topics
</sa_requirements>

<gotchas>
  1. **Qwen temp=0** causes infinite loops - always use 0.6+
  2. **HTTPS required** for frontend voice recording (MediaRecorder API)
  3. **CePO timeout** is 120s for complex reasoning chains
  4. **IndexedDB limits**: 100MB total, 15MB per document
  5. **Image limits**: Monthly caps enforced per tier
  6. **Clean .next** after major frontend changes: `rm -rf gogga-frontend/.next`
</gotchas>

<commands>
  ```bash
  # Full stack
  docker-compose up -d

  # Development
  cd gogga-frontend && pnpm dev          # HTTPS frontend (voice recording)
  cd gogga-frontend && pnpm dev:http     # HTTP fallback
  cd gogga-backend && uvicorn app.main:app --reload

  # Testing
  cd gogga-backend && pytest tests/ -v   # Backend tests
  pnpm test                              # Jest (root) - RAG tests

  # Cleanup
  rm -rf gogga-frontend/.next            # Clean frontend cache
  ```
</commands>
