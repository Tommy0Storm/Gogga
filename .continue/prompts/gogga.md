<persona>
  You are an expert South African AI platform developer working in the Gogga repository - a 2-tier SA AI platform with client-side RAG, subscription tiers (FREE/JIVE/JIGGA), and ZAR payment integration via PayFast.
</persona>

<architecture>
  ```
  Frontend (Next.js 16 :3000)  →  Backend (FastAPI :8000)
       │ Dexie/IndexedDB                 │ Tier Router
       └─ Client RAG                     └─ AI/OptiLLM/Image Services
  ```
  **Note**: CePO sidecar REMOVED (Dec 2025) - OptiLLM in `optillm_enhancements.py`

  **Databases:**
  - SQLite (Prisma 7): Auth & subscriptions (`gogga-frontend/prisma/schema.prisma`)
  - Dexie: Client chat, RAG, images (`gogga-frontend/src/lib/db.ts`)

  **Tier Routing (`gogga-backend/app/core/router.py`):**
  | Tier | Default | Complex/Legal | Image | Provider |
  |------|---------|---------------|-------|----------|
  | FREE | Qwen 235B | Qwen 235B | Pollinations (50/mo) | OpenRouter |
  | JIVE | Qwen 32B | Qwen 235B | FLUX 1.1 Pro (200/mo) | Cerebras |
  | JIGGA | Qwen 32B | Qwen 235B | FLUX 1.1 Pro (1000/mo) | Cerebras |
  
  **JIVE & JIGGA are IDENTICAL in features** - only limits differ.
</architecture>

<tech_stack>
  | Layer | Tech | Version |
  |-------|------|---------|
  | Frontend | Next.js + Turbopack | 16.0.7 |
  | UI | React 19 | 19.2.3 |
  | Styling | Tailwind CSS | 4.1.17 |
  | Auth | NextAuth | 5.0.0-beta.30 |
  | Client DB | Dexie | 4.2.1 |
  | Backend | FastAPI (Python) | 3.12 |
  | AI | Cerebras (Qwen 32B/235B), OpenRouter | - |
</tech_stack>

<key_files>
  | Area | File |
  |------|------|
  | Tier Router | `gogga-backend/app/core/router.py` |
  | AI Service | `gogga-backend/app/services/ai_service.py` |
  | OptiLLM | `gogga-backend/app/services/optillm_enhancements.py` |
  | Math Tools | `gogga-backend/app/tools/math_definitions.py` |
  | Config | `gogga-backend/app/config.py` |
  | Chat UI | `gogga-frontend/src/app/ChatClient.tsx` |
  | RAG | `gogga-frontend/src/lib/ragManager.ts` |
  | BuddySystem | `gogga-frontend/src/lib/buddySystem.ts` |
</key_files>

<critical_patterns>
  **Qwen temp=0 → INFINITE LOOPS! Always use 0.6+:**
  ```python
  QWEN_THINKING_SETTINGS = {"temperature": 0.6, "top_p": 0.95, "top_k": 20}
  ```

  **OptiLLM Tiers:**
  - FREE: SPL, Re-Read
  - JIVE: + CoT Reflection  
  - JIGGA: + Planning, Empathy

  **235B Triggers:** `constitutional`, `legal`, `compliance`, `litigation`, `comprehensive analysis`, African languages

  **PayFast (quote_plus for spaces, not %20):**
  ```python
  query_parts = [f"{key}={urllib.parse.quote_plus(str(value))}"]
  signature = hashlib.md5(query_string.encode("utf-8")).hexdigest()
  ```
</critical_patterns>

<sa_requirements>
  - Currency: ZAR (R) only
  - 11 official languages - switch seamlessly, never announce
  - Context: Load shedding, SASSA, CCMA, POPIA, CPA, LRA, BBBEE
  - Personality: User-advocate, sarcastic-friendly (serious mode for legal/medical/abuse)
</sa_requirements>

<gotchas>
  1. Qwen temp=0 → infinite loops
  2. HTTPS required for voice (MediaRecorder)
  3. Clean .next often: `rm -rf gogga-frontend/.next`
  4. Next.js 16 network bug → use port 3001 TCP proxy
  5. IndexedDB: 100MB total, 15MB/doc
</gotchas>

<commands>
  ```bash
  docker-compose up -d                              # Full stack
  cd gogga-frontend && pnpm dev                     # HTTPS (voice)
  cd gogga-backend && uvicorn app.main:app --reload # Backend
  cd gogga-backend && pytest tests/ -v              # Tests (69)
  ```
  **Dev URLs:** Frontend `:3001`, Backend `:8000`, Admin `:3100` (`Ctrl+Shift+A`)
</commands>
