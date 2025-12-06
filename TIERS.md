# GOGGA Tier System

> **Last Updated:** December 5, 2025

## Overview

GOGGA is a South African AI assistant with a 3-tier subscription model. Each tier offers distinct capabilities, AI models, and features tailored to different user needs.

---

## The Self-Hosted Stack (Implemented)

GOGGA runs on a fully self-contained, cloud-free architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOGGA SELF-HOSTED STACK                      │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 16 (App Router)     │ Frontend + API Routes           │
│  NextAuth.js v5 (beta.30)    │ Passwordless token auth         │
│  Prisma ORM                  │ Type-safe database access       │
│  SQLite (./prisma/dev.db)    │ Local database file             │
└─────────────────────────────────────────────────────────────────┘
              Everything lives inside the repo, no cloud dependencies
```

---

## Storage Architecture (Dual-Database)

GOGGA uses **two separate databases** that never connect directly:

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOGGA STORAGE ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SERVER-SIDE (SQLite + Prisma)          Per-Instance            │
│  ├── User identity (email, id)                                  │
│  ├── Login tokens (magic links)                                 │
│  ├── Auth logs (connection audit)                               │
│  └── Subscriptions (tier, status, PayFast token)                │
│                                                                 │
│  ─────────────────── session.user ───────────────────           │
│                         ↓                                       │
│  CLIENT-SIDE (Dexie/IndexedDB)          Per-User-Per-Device     │
│  ├── Chat sessions & messages                                   │
│  ├── RAG documents & chunks                                     │
│  ├── Generated images                                           │
│  ├── User preferences                                           │
│  ├── Long-term memories                                         │
│  └── Token usage tracking                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why Two Databases?

> **Dexie contains user-owned content only. SQLite contains system-owned identity only.**

| Database | Purpose | Scope | Persistence |
|----------|---------|-------|-------------|
| **SQLite** | Identity & billing (authoritative) | Server instance | Until deleted |
| **Dexie** | User content (local) | Per-browser, per-device | User controlled |

### Data Isolation (Per-User-Per-Device)

Each user's Dexie database is **automatically isolated** by the browser:

- **Same-origin policy**: Only `gogga.app` can access its IndexedDB
- **Per-browser**: Chrome, Firefox, Safari each have separate databases
- **Per-device**: Desktop and mobile are completely isolated
- **No sharing**: Multiple users on shared device = separate browser profiles

```
User A (Chrome Desktop)  → GoggaDB (isolated)
User A (Chrome Mobile)   → GoggaDB (isolated, different data)
User B (Chrome Desktop)  → GoggaDB (isolated, different data)
```

### What Goes Where?

| Data Type | Storage | Why |
|-----------|---------|-----|
| Email address | SQLite | Auth identity, PayFast subscription |
| Login tokens | SQLite | Server-side validation, expiry |
| Subscription tier | SQLite | Billing authoritative source |
| Chat history | Dexie | Local-first, no server round-trips |
| RAG documents | Dexie | User uploads stay on their device |
| Generated images | Dexie | Thumbnails + full images cached locally |
| User preferences | Dexie | UI settings, language, theme |
| BuddySystem profile | localStorage | Lightweight relationship tracking |

### The Bridge: `session.user`

The only connection between SQLite and Dexie is the session:

```typescript
// Server-side (auth.ts)
const session = await auth()  // From SQLite via NextAuth

// Client-side (ChatClient.tsx)
const { data: session } = useSession()
session.user.id      // Used to identify user
session.user.tier    // Used to gate features
```

The session **does not** store Dexie data - it only provides user identity and tier for feature gating.

### Stack Benefits

| Component | Why |
|-----------|-----|
| **Next.js App Router** | Server components, streaming, Turbopack |
| **NextAuth.js v5** | Passwordless token-based auth, JWT sessions |
| **Prisma 7** | Type-safe queries, driver adapters, improved performance |
| **SQLite** | Zero config, file-based, Git-friendly for dev |

### Prisma 7 Architecture

Prisma 7.1.0 uses the **Driver Adapter pattern** for database connections:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRISMA 7 DRIVER ADAPTER                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  prisma.config.ts (CLI)     │ Handles migrate/generate          │
│  ├── defineConfig()         │ Configuration function            │
│  ├── env('DATABASE_URL')    │ Read from .env.local              │
│  └── migrations.path        │ Where to store migrations         │
│                                                                 │
│  src/lib/prisma.ts (Runtime)│ Handles all database queries      │
│  ├── PrismaBetterSqlite3    │ SQLite adapter (native)           │
│  ├── PrismaClient({ adapter })│ Client with adapter injection   │
│  └── Connection pooling     │ Configurable min/max connections  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Prisma 7 Features Used:**
| Feature | Implementation |
|---------|----------------|
| Driver Adapters | `@prisma/adapter-better-sqlite3` for SQLite |
| Generated Client | Output to `./prisma/generated/prisma` |
| Type-safe Raw Queries | `$queryRaw` with template literals |
| Connection Pooling | Configurable via adapter options |
| Transaction Retry | Built-in retry logic for deadlocks |

**Dependencies:**
```json
{
  "@prisma/adapter-better-sqlite3": "^7.1.0",
  "@prisma/client": "^7.1.0",
  "better-sqlite3": "^12.5.0",
  "prisma": "^7.1.0"
}
```

### File Structure (Implemented)

```
gogga-frontend/
├── prisma/
│   ├── schema.prisma      # User, LoginToken, AuthLog, Subscription models
│   ├── generated/prisma/  # Prisma 7 generated client output
│   ├── dev.db             # SQLite database file
│   └── migrations/        # Version-controlled migrations
├── prisma.config.ts       # Prisma 7 CLI configuration
├── src/
│   ├── auth.ts            # NextAuth v5 configuration (root level)
│   ├── lib/
│   │   ├── prisma.ts      # Prisma client with driver adapter
│   │   └── db.ts          # Dexie (client-side RAG)
│   ├── components/
│   │   └── AuthProvider.tsx  # NextAuth SessionProvider wrapper
│   └── app/
│       ├── login/page.tsx    # Two-step login (email → token entry)
│       └── api/
│           ├── auth/
│           │   ├── [...nextauth]/route.ts  # NextAuth v5 handlers
│           │   └── request-token/route.ts  # Magic token generator + EmailJS
│           └── payfast/
│               └── notify/route.ts         # PayFast ITN webhook
```
gogga-frontend/
├── prisma/
│   ├── schema.prisma      # User, LoginToken, AuthLog, Subscription models
│   ├── dev.db             # SQLite database file
│   └── migrations/        # Version-controlled migrations
├── src/
│   ├── lib/
│   │   ├── auth.ts        # NextAuth Credentials provider config
│   │   ├── prisma.ts      # Prisma client singleton
│   │   └── db.ts          # Dexie (client-side RAG)
│   ├── components/
│   │   └── AuthProvider.tsx  # NextAuth SessionProvider wrapper
│   ├── types/
│   │   └── next-auth.d.ts    # NextAuth type extensions
│   └── app/
│       ├── login/page.tsx    # Login page (magic link + token)
│       └── api/
│           ├── auth/
│           │   ├── [...nextauth]/route.ts  # NextAuth handlers
│           │   └── request-token/route.ts  # Magic link generator
│           └── payfast/
│               └── notify/route.ts         # PayFast ITN webhook
```

### Auth + Tier Integration

**Tech Stack:**
- NextAuth.js v5.0.0-beta.30 (App Router compatible)
- Prisma v7.1.0 with SQLite (Driver Adapter pattern)
- EmailJS REST API (service_q6alymo)

```prisma
// Prisma Schema (gogga-frontend/prisma/schema.prisma)

generator client {
  provider = "prisma-client"
  output   = "./generated/prisma"
}

datasource db {
  provider = "sqlite"
  // URL handled by driver adapter in prisma.ts
}

model User {
  id           String        @id @default(cuid())
  email        String        @unique
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  tokens       LoginToken[]
  subscription Subscription?
}

// NOTE: No foreign key to User - allows token creation before user exists
model LoginToken {
  id        String   @id @default(cuid())
  token     String   @unique
  email     String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
}

model AuthLog {
  id        String   @id @default(cuid())
  email     String?  // Only for dispute investigation
  action    String   // token_requested, login_success, session_created
  ip        String?  // Connection logging for security
  meta      String?  // JSON string (non-personal data)
  createdAt DateTime @default(now())
}

model Subscription {
  id          String    @id @default(cuid())
  userId      String    @unique
  tier        String    // FREE, JIVE, JIGGA
  status      String    // pending, active, cancelled, expired
  payfastToken String?  // For cancellation via PayFast API
  startedAt   DateTime?
  nextBilling DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id])
}
```

### Authentication Flow (Token-Based Passwordless)

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOGGA TOKEN-BASED AUTH                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. USER ENTERS EMAIL (at /login)                               │
│     └─→ POST /api/auth/request-token                            │
│         └─→ Generate 32-byte hex token (crypto.randomBytes)     │
│         └─→ Store in LoginToken table (15 min expiry)           │
│         └─→ Send magic link via EmailJS REST API                │
│         └─→ Log 'token_requested' to AuthLog                    │
│                                                                 │
│  2. USER RECEIVES EMAIL                                         │
│     └─→ Email contains magic link: /login?token=xxx             │
│     └─→ Or user can paste 64-char token manually                │
│                                                                 │
│  3. NEXTAUTH VALIDATES (signIn('email-token', { token }))       │
│     └─→ Credentials provider authorize() checks:                │
│         • Token exists in LoginToken table                      │
│         • Token not marked as used                              │
│         • Token not expired (15 min limit)                      │
│     └─→ Mark token as used (prevents replay)                    │
│     └─→ Upsert User (create if new, update if returning)        │
│     └─→ Log 'login_success' to AuthLog                          │
│                                                                 │
│  4. SESSION CREATED                                             │
│     └─→ JWT created and stored in secure cookie (30 days)       │
│     └─→ Log 'session_created' to AuthLog                        │
│     └─→ Redirect to / (main app)                                │
│     └─→ useSession() hook available throughout app              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Session Management

| Aspect | Value |
|--------|-------|
| Strategy | JWT (stateless) |
| Max Age | 30 days |
| Cookie | `authjs.session-token` (secure, httpOnly) |
| Refresh | Automatic on activity |

**Access Patterns:**
```typescript
// Client-side (React components)
import { useSession } from 'next-auth/react'
const { data: session, status } = useSession()

// Server-side (App Router actions/pages)
import { auth } from '@/auth'
const session = await auth()
```

### Session Lifecycle (Fully Automatic)

> **You do not manage session connections. NextAuth handles everything.**

**What You Don't Do:**
- ❌ Create sessions manually
- ❌ Track active sessions
- ❌ Store session data
- ❌ Refresh tokens manually
- ❌ Clean up expired sessions
- ❌ Invalidate sessions manually

**What NextAuth Does Silently:**

| Phase | What Happens |
|-------|--------------|
| **Login** | JWT created → encrypted cookie → sent to browser |
| **Navigation** | Cookie sent → NextAuth verifies → `session.user` populated |
| **Expiry** | Auto-refresh on activity or invalidate after 30 days |
| **Logout** | Cookie wiped → session gone instantly |
| **Server Restart** | No problem. Sessions live in cookies, not server memory |
| **Multiple Devices** | Each device gets its own cookie. Same `userId` everywhere |

**Why This Works:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATELESS SESSION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HTTP is stateless. There is no persistent connection.         │
│                                                                 │
│  Browser Request                                                │
│     └─→ Cookie: authjs.session-token=xxx                        │
│         └─→ NextAuth reads cookie                               │
│             └─→ Verifies JWT signature                          │
│                 └─→ Populates session.user.id                   │
│                     └─→ Returns session object                  │
│                                                                 │
│  No sockets. No live connections. No session tables.           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Concurrency? Handled.**
- Isolated sessions per device (separate cookies)
- Stateless validation per request (no race conditions)
- No live session tables to manage
- SQLite only stores identity (`userId`), not session state

### Route Protection (Server-Side)

GOGGA uses server-side route protection for security. All protected routes check session on the server before rendering.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER-SIDE ROUTE PROTECTION                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  / (Main App)                                                   │
│  ├─→ Server: await auth()                                       │
│  ├─→ No session? → redirect('/login')                           │
│  └─→ Has session? → render ChatClient                           │
│                                                                 │
│  /login                                                         │
│  ├─→ Server: await auth()                                       │
│  ├─→ Has session? → redirect('/')                               │
│  └─→ No session? → render LoginClient                           │
│                                                                 │
│  /dashboard                                                     │
│  └─→ Currently unprotected (JIGGA-only features)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why Server-Side?**
- No flash of protected content
- No client-side redirect delays
- More secure (can't bypass with JS disabled)
- SEO-friendly (proper HTTP redirects)

**File Structure:**
```
src/app/
├── page.tsx           # Server component - auth check → ChatClient
├── ChatClient.tsx     # Client component - actual chat UI
├── login/
│   ├── page.tsx       # Server component - auth check → LoginClient
│   └── LoginClient.tsx # Client component - login form
```

### AuthLog Events (SQLite Logging)

All essential authentication events are logged to the `AuthLog` table for security and dispute investigation:

| Action | When | Logged Data |
|--------|------|-------------|
| `token_requested` | User requests magic link | email, IP, timestamp |
| `login_success` | Valid token verified | email, IP, isNewUser |
| `login_failed` | Invalid/expired token | email, IP, reason |
| `session_created` | JWT session established | email, sessionMaxAge |
| `logout` | User signs out | email, IP |
| `subscription_activated` | PayFast payment confirmed | email, tier |
| `subscription_cancelled` | User cancels | email, tier |

**Privacy Note:** Only connection-type logs are stored. No personal data beyond email (for dispute resolution) is logged.

### Privacy & Data Policy

| Data Type | Storage | Retention | Purpose |
|-----------|---------|-----------|---------|
| Email | SQLite | Until deletion request | Authentication |
| Login tokens | SQLite | Auto-expire 15 min | One-time use |
| Auth logs | SQLite | 90 days | Dispute investigation |
| Session | JWT cookie | 30 days | Active session |
| Chat/RAG | IndexedDB | User controlled | Local functionality |

**User Data Control:**
- User controls all chat and document data (stored locally in browser)
- Email is the only personal data stored server-side
- Auth logs contain connection info only (IP, action type, timestamp)
- No personal data logging beyond what's needed for disputes

### EmailJS Configuration

**API Settings:**
| Setting | Value |
|---------|-------|
| Service ID | `service_q6alymo` |
| Template ID | `template_k9ugryd` |
| API Method | REST API (`https://api.emailjs.com/api/v1.0/email/send`) |
| From Email | hello@vcb-ai.online (via Outlook) |

**Template Variables:**
- `{{email}}` - Recipient email address (used in "To Email" field)
- `{{token}}` - 64-character login token
- `{{magic_link}}` - Full magic link URL

### Email Templates

| Template ID | Purpose |
|-------------|---------|
| `template_k9ugryd` | Magic link for passwordless sign-in |
| `vcb_welcome_free` | Welcome email (FREE tier) |
| `vcb_subscription_activation_with_privacy` | Subscription confirmed |
| `vcb_payment_success` | Payment processed |
| `vcb_payment_failed` | Payment failed |
| `vcb_subscription_cancelled` | Subscription cancelled |

### Environment Variables

```bash
# .env.local (gogga-frontend)

# Base URL
NEXT_PUBLIC_BASE_URL=https://gogga.vcb-ai.online

# NextAuth v5
AUTH_SECRET=xxx  # openssl rand -base64 32
NEXTAUTH_URL=https://gogga.vcb-ai.online

# Database
DATABASE_URL="file:./dev.db"

# EmailJS (REST API - not SDK)
EMAILJS_PUBLIC_KEY=Z6bj2q-HzyhKlxNEA
EMAILJS_PRIVATE_KEY=xxx
EMAILJS_SERVICE_ID=service_q6alymo
EMAILJS_TEMPLATE_ID=template_k9ugryd
EMAIL_FROM_NAME="VCB-AI Support"
EMAIL_FROM=hello@vcb-ai.online

# PostHog Analytics (EU region)
NEXT_PUBLIC_POSTHOG_KEY=phc_yZekB4PmawZNhcDehM9C1hcjMtMcqG36xHZu6AveT33
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com

# PayFast (ZAR payments)
PAYFAST_MERCHANT_ID=xxx
PAYFAST_MERCHANT_KEY=xxx
PAYFAST_PASSPHRASE=xxx
PAYFAST_ENV=sandbox  # or production
```

---

## Tier Comparison

| Feature | FREE | JIVE | JIGGA |
|---------|------|------|-------|
| **Monthly Price** | R0 | R99 | R299 |
| **BuddySystem Emotional AI** | ✅ Basic | ✅ Full | ✅ Full |
| **11 SA Languages** | ✅ | ✅ | ✅ |
| **Text Model** | Llama 3.3 70B | Llama 3.3 70B | Qwen 3 32B |
| **Provider** | OpenRouter | Cerebras (~2,200 t/s) | Cerebras (~1,400 t/s) |
| **Image Generator** | LongCat Flash (text) | FLUX 1.1 Pro | FLUX 1.1 Pro |
| **Image Limit** | 50/month | 200/month | 1,000/month |
| **RAG Documents** | ❌ | 5 per session | 10 per session |
| **Cross-Session Docs** | ❌ | ❌ | ✅ |
| **Chat Persistence** | ❌ | ✅ | ✅ |
| **Thinking Mode** | ❌ | ❌ | ✅ (Collapsible UI) |
| **Token Tracking** | ✅ | ✅ | ✅ |
| **Prompt Enhancement** | ✅ | ✅ | ✅ |
| **Chat History** | ❌ | ✅ | ✅ |
| **File Upload/Delete** | ❌ | ✅ | ✅ |
| **Basic RAG (context only)** | ❌ | ✅ | ✅ |
| **Semantic RAG (ranked)** | ❌ | ❌ | ✅ |
| **RAG Authoritative Mode** | ❌ | ❌ | ✅ |
| **Image Generation** | ❌ Text only | ✅ FLUX 1.1 Pro | ✅ FLUX 1.1 Pro |
| **RAG Analytics Dashboard** | ❌ | ❌ | ✅ |
| **Live RAG Performance Graph** | ❌ | ❌ | ✅ |
| **Vector Similarity Scoring** | ❌ | ❌ | ✅ |
| **Monitoring / Performance Stats** | ❌ | ❌ | ✅ |
| **AI Search** | Basic (3/day) | Quick + Deep (50/day) | Unlimited |
| **Research Mode** | ❌ | ✅ (10/day) | ✅ (Unlimited) |
| **Multi-Source Research** | ❌ | 3 sources | 10 sources |
| **Research History** | ❌ | 7 days | Forever |

---

## FREE Tier

### Communication Style

- Quick, helpful responses
- General knowledge assistance
- Basic South African context awareness

### Capabilities

- **Text Chat**: Powered by OpenRouter Llama 3.3 70B FREE
- **Image Generation**: Text descriptions via LongCat Flash (no actual images)
- **Prompt Enhancement**: AI-powered prompt improvement (same as paid tiers)
- **Token Tracking**: Usage tracked and displayed in header

### Pipeline

```text
TEXT:  User → Llama 3.3 70B → Response
IMAGE: User → Prompt Enhancement → LongCat Flash → Text Description
```

### Limitations

- No document upload (RAG)
- No chat history persistence
- Image "generation" produces descriptions only
- 50 image requests/month

---

## JIVE Tier (R99/month)

### Communication Style

- **BuddySystem Emotional Intelligence** - Detects and responds to user emotional state
- Fast, efficient responses for simple queries
- Deep reasoning with CePO for complex problems
- Enhanced South African legal and cultural knowledge
- All 11 SA official languages (native-level responses)

### Capabilities

- **Text Chat**: Cerebras Llama 3.3 70B with automatic complexity routing
- **Speed**: ~2,200 tokens/second
- **CePO Integration**: Chain-of-thought planning for complex queries (using Llama 3.3 70B via OptiLLM)
- **Image Generation**: Full FLUX 1.1 Pro images (200/month)
- **Document Upload**: Up to 5 documents per chat session
- **Chat Persistence**: All conversations saved locally via Dexie

### Token Limits

| Mode | Max Tokens | Notes |
|------|------------|-------|
| Standard | 4,096 | Default for casual chat |
| Extended | 8,000 | Auto-triggers for reports, analysis, documents |
| Model Max | 40,000 | Available when ready (cost-controlled) |

**Extended output auto-triggers for:**
- Reports, drafts, analysis requests
- Legal documents, contracts, agreements
- Comprehensive explanations, detailed breakdowns
- Long-form content, essays, articles
- Use keywords like: "detailed", "comprehensive", "long format", "full report"

### Pipeline

```text
TEXT (simple):  User → Llama 3.1 8B → Response
TEXT (complex): User → Llama 3.1 8B + CePO → Enhanced Response
IMAGE:          User → Prompt Enhancement → FLUX 1.1 Pro → HD Image
```

### CePO (Cerebras Planning Optimization)

- Automatically activates for complex queries
- Uses Llama 3.3 70B for reasoning at ~2,000 tokens/second
- Ideal for:
  - Legal questions (South African law)
  - Code debugging and architecture
  - Multi-step problem solving
  - Business analysis

### Comprehensive Document Mode

When you request an **analysis**, **report**, or **professional document**, JIVE automatically provides:
- Verbose, well-structured output
- Executive summaries with key findings
- Detailed analysis with supporting evidence
- Actionable recommendations
- Professional formatting with headers and lists

**Your explicit requests always override defaults** - if you want something brief, just say so.

### RAG Features

- Upload PDF, Word, TXT, MD, ODT files (enterprise PDF extraction via unpdf)
- Max 15MB per document
- 5 documents per session
- Basic keyword retrieval for context injection
- Documents cleared on new session

### JIVE RAG Pipeline

```text
UPLOAD:   File → extractText() → chunkText() → Dexie (IndexedDB) + FlexSearch Index
QUERY:    User Query → RagManager.retrieveBasic() → Keyword Match + Recency Scoring → Top 3 Docs
CONTEXT:  Top Docs → Format for LLM → Inject into Chat Message
```

### AI Search (JIVE)

JIVE tier includes AI-powered search capabilities:

- **Quick Search**: Fast factual lookups (1-2 sources, <2s)
- **Deep Search**: Multi-source research (3 sources, 5-10s)
- **Daily Limits**: 50 searches/day, 10 deep research/day
- **Citations**: Source links included in responses
- **History**: 7-day research history retention

```text
SEARCH: Query → Intent Analysis → Multi-Source Retrieval → Ranked Results → Synthesized Answer
```

---

## JIGGA Tier (R299/month)

### Communication Style

- Deep, thoughtful analysis with extended reasoning
- Comprehensive responses for complex topics
- Expert-level South African context
- Optional fast mode for quick answers

### Capabilities

- **Text Chat**: Cerebras Qwen 3 32B with thinking mode
- **Speed**: ~1,400 tokens/second
- **Thinking Mode**: Extended reasoning with collapsible UI display
- **Fast Mode**: Append `/no_think` to disable reasoning
- **Image Generation**: Full FLUX 1.1 Pro images (1,000/month)
- **Document Upload**: Up to 10 documents per session
- **Cross-Session Selection**: Access documents from any past session
- **Chat Persistence**: Full history with session management

### Token Limits

| Mode | Max Tokens | Notes |
|------|------------|-------|
| Standard | 4,096 | Default for casual chat |
| Extended | 8,000 | Auto-triggers for reports, analysis, documents |
| Context | 131,000 | Full context window |

**Extended output auto-triggers for:**
- Reports, drafts, analysis requests
- Legal documents, contracts, agreements
- Comprehensive explanations, detailed breakdowns
- Long-form content, essays, articles
- Use keywords like: "detailed", "comprehensive", "long format", "full report"

**Long Context Tip:**
For prompts with >100k context tokens, use `/no_think` to disable reasoning and save context budget.

### Pipeline

```text
TEXT (thinking): User → Qwen 3 32B (temp=0.6) → <thinking>...</thinking> → Response
TEXT (fast):     User + /no_think → Qwen 3 32B → Quick Response
IMAGE:           User → Prompt Enhancement → FLUX 1.1 Pro → HD Image
```

### Thinking Mode UI

- Thinking blocks displayed with Brain icon
- Collapsible/expandable with click
- Backend parses both `<think>` and `<thinking>` tags
- Frontend fallback extraction if needed

### RAG Features

- Upload PDF, Word, TXT, MD, ODT, RTF files (enterprise PDF extraction via unpdf)
- Max 15MB per document
- 10 documents per session (combined upload + selected)
- **Cross-session document selection**: Browse and select from all previously uploaded documents
- **Semantic RAG**: Vector similarity ranking for best context retrieval
- **Vector Similarity Scoring**: See relevance scores for each document chunk
- Two RAG modes:
  - **Analysis**: AI synthesizes and interprets document content
  - **Authoritative**: AI quotes directly from documents only (JIGGA exclusive)

### JIGGA RAG Pipeline (Semantic)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                      JIGGA SEMANTIC RAG PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  UPLOAD FLOW:                                                               │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐                 │
│  │   File   │ → │ Extract  │ → │  Chunk   │ → │  Store   │                 │
│  │  Upload  │   │   Text   │   │ (500chr) │   │  Dexie   │                 │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘                 │
│                      │                             │                        │
│                      ▼                             ▼                        │
│                 unpdf (PDF)              IndexedDB + FlexSearch             │
│                 JSZip (DOCX)                                                │
│                                                                             │
│  QUERY FLOW:                                                                │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │  Query   │ → │ Embed    │ → │ Cosine   │ → │  Rank    │ → │ Context  │  │
│  │  Input   │   │ E5-small │   │Similarity│   │  Top K   │   │  Format  │  │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘  │
│       │              │              │              │              │        │
│       ▼              ▼              ▼              ▼              ▼        │
│   User query    384-dim vector   Score chunks   Filter >0.3   LLM inject  │
│                                  vs all docs    + top 5       + scores    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Embedding Model (VCB-AI Micro)

| Property | Value |
|----------|-------|
| Model | intfloat/e5-small-v2 (ONNX quantized) |
| Dimensions | 384 |
| Backend | WASM (browser) |
| Load Time | ~2-5s (first use, cached thereafter) |
| Memory | ~200MB (model + cache) |
| Chunk Latency | ~50-200ms per chunk |
| Search Latency | <10ms (cached embeddings) |

### RAG Analytics (JIGGA Exclusive)

- **Analytics Dashboard**: View document usage, query patterns, retrieval stats
- **Live Performance Graph**: Real-time visualization of RAG operations (no animation on refresh)
- **Vector Scoring Display**: See similarity scores for retrieved chunks
- **Monitoring Stats**: Query latency, cache hits, retrieval accuracy
- **Document Manager**: Upload, view, delete individual docs or all at once
- **Embedding Status**: Visual indicators for pending/complete embeddings
- **Real Vector Heatmap**: 384-dim E5 vectors visualized as color-coded heatmap

### AI Research Pipeline (JIGGA)

JIGGA tier includes the full AI Research Pipeline:

- **Unlimited Searches**: No daily limits
- **Comprehensive Research**: Up to 10 sources per query
- **Research Types**:
  - **Quick**: Fast factual lookup (<2s)
  - **Deep**: Multi-source research (5-10s)
  - **Comprehensive**: Full research report with citations (15-30s)
- **Thinking Integration**: Extended reasoning visible in research mode
- **Forever History**: All research sessions saved permanently
- **Export**: Research reports exportable to Markdown/PDF

**Research Pipeline:**
```text
Query → Intent Analysis → Search Strategy → Multi-Source Retrieval → Ranking → Synthesis
  │          │                  │                    │                  │          │
  ▼          ▼                  ▼                    ▼                  ▼          ▼
[User]   [Classify]      [Generate 5 queries]   [Parallel fetch]   [Score]   [Report]
                              [Select sources]    [10 sources max]  [Filter]  [Citations]
```

**Response includes:**
- Synthesized answer with confidence score
- Ranked source cards with snippets
- Related follow-up queries
- Full citation links
- Thinking process (collapsible)

### Thinking Mode Parameters

- Default: Extended reasoning ON
- Temperature: 0.6
- Top P: 0.95
- Max tokens: 8,000
- Ideal for:
  - Complex legal analysis
  - Technical architecture decisions
  - Research and synthesis
  - Strategic planning

### Comprehensive Document Mode

When you request an **analysis**, **report**, or **professional document**, JIGGA automatically provides:
- **Executive Summary**: Key findings upfront
- **Background/Context**: Relevant context and assumptions
- **Detailed Analysis**: Structured breakdown with evidence
- **Key Insights**: Important observations and patterns
- **Recommendations**: Prioritized action items
- **Risks & Considerations**: Potential challenges
- **Conclusion**: Synthesis and next steps

**Your explicit requests always override defaults** - ask for "brief" or "summary only" if you want concise output.

---

## Universal Features (All Tiers)

### BuddySystem & Language Detection

**User Relationship Tracking:**
- Relationship levels: stranger → acquaintance (50pts) → friend (200pts) → bestie (500pts)
- Buddy points earned through positive interactions
- Personalized greetings based on relationship level
- Sarcastic intros (toggleable per user preference)

**SA Language Detection:**
- Real-time detection of all 11 SA official languages
- Confidence scoring (0-100%) with weighted keyword matching
- Languages: English, Afrikaans, isiZulu, isiXhosa, Sepedi, Setswana, Sesotho, Xitsonga, siSwati, Tshivenda, isiNdebele
- Subtle language badge on user messages (🇿🇦 + code)
- Auto-updates preferred language based on detected usage

**Time-Aware Greetings:**
- Morning/afternoon/evening greetings in user's preferred language
- All 11 languages supported with authentic phrases

**Files:**
- `lib/buddySystem.ts` - Core BuddySystem class with language detection
- `hooks/useBuddySystem.ts` - React hook for component integration
- `components/dashboard/BuddyPanel.tsx` - Dashboard widget
- `components/LanguageBadge.tsx` - Subtle language indicator

### Memory & Personalization (JIVE/JIGGA)

GOGGA remembers you across conversations via the BuddySystem context injection:

**What GOGGA Remembers:**
| Field | Description | Example |
|-------|-------------|---------|
| USER NAME | Your name (if shared) | "Hey Tanya! Back with another question?" |
| RELATIONSHIP | How well GOGGA knows you | stranger → acquaintance → friend → bestie |
| PREFERRED LANGUAGE | Your SA language preference | Responds in isiZulu if you prefer |
| TONE | Communication style | formal, casual, or sarcastic |
| LOCATION | City/province for local context | "Since you're in Joburg..." |
| INTERESTS | Topics you've discussed | "Since you're into coding..." |
| USER MEMORIES | Things you asked GOGGA to remember | Custom notes and preferences |

**How It Works:**
1. BuddySystem profile stored in localStorage
2. Long-term memories stored in Dexie (IndexedDB)
3. Context injected into chat messages for JIVE/JIGGA tiers
4. GOGGA uses your name naturally (not every sentence, but when appropriate)

**Memory Source Tracking:**

Memories distinguish between user-created and AI-created entries:

| Source | Created By | Can Delete | UI Badge | Description |
|--------|-----------|------------|----------|-------------|
| `user` | User manually | User only | 👤 User icon | User explicitly saved memory |
| `gogga` | GOGGA AI | User or GOGGA | 🤖 "AI" badge | GOGGA inferred from conversation |

This prevents GOGGA from deleting user-created memories while allowing cleanup of its own inferences. The MemoryManager dashboard displays source badges and separate statistics (e.g., "4 You • 2 AI").

**Memory Context Format:**
```
USER CONTEXT:
USER NAME: Tanya
RELATIONSHIP: friend (215 buddy points)
PREFERRED LANGUAGE: English (en)
TONE: sarcastic, humor welcome
LOCATION: Johannesburg, Gauteng
INTERESTS: coding, photography, legal questions

---

[Your actual message here]
```

**Note:** FREE tier does not receive memory context - GOGGA treats you as a new user each time.

### Token Tracking

All tiers track token usage with local persistence:

- Displayed in header with `#` icon
- Daily aggregation by tier
- Stored in Dexie (IndexedDB)
- Shows all-time total tokens used

### Time Awareness

All AI models receive current South African time (SAST) in their system prompts:

```text
"Current date and time: Wednesday, 03 December 2025, 09:45 SAST"
```

### Prompt Enhancement

- Available via the ✨ Wand button
- Uses OpenRouter Llama 3.3 70B FREE
- Transforms simple prompts into detailed, structured requests
- Works for both text and image prompts
- **Cost: Always FREE**

### South African Context

All tiers understand:

- Local slang and expressions (Mzansi style)
- South African law and regulations
- Local business practices
- Cultural nuances
- 11 official languages

### Response Formatting

GOGGA follows consistent formatting rules:

| Rule | Description |
|------|-------------|
| **No Emojis** | Uses Material Icons `[icon_name]` format instead |
| **Bold** | For emphasis on key terms |
| **Numbered Lists** | For steps, options, procedures |
| **Headers** | Only for long structured content (reports, analysis) |
| **Casual Chat** | No headers, no structure - just natural conversation |

**Material Icons Examples:**
- `[check]` instead of ✅
- `[warning]` instead of ⚠️
- `[info]` instead of ℹ️
- `[error]` instead of ❌

### GOGGA Personality

> **Full documentation:** See `PERSONA.md` in repo root

**The BuddySystem - Emotional Intelligence (All Tiers)**

GOGGA is not just an AI. GOGGA is a BUDDY. A china. A bru. Someone who genuinely cares.

| User State | GOGGA Response |
|------------|----------------|
| **Crisis/Grief** | Drop ALL sarcasm. Be gentle, present, supportive. Provide SADAG (011 234 4837) |
| **Angry/Frustrated** | Validate first: "That's seriously not okay". Get on their side. Help channel into action |
| **Anxious/Worried** | Acknowledge without dismissing. Provide actionable steps. Calm but not condescending |
| **Happy/Excited** | CELEBRATE! "Yoh! That's amazing, china!" Match their energy |
| **Neutral/Casual** | Default witty, sarcastic-friendly personality |

**Sarcastic-Friendly (Default Mode)**
- Witty, warm, and wonderfully sarcastic - like a clever friend who keeps it real
- "Another landlord who thinks they're above the RHA? How original. Let me help you sort them out"
- "Load shedding AND work stress? Eskom really said 'hold my beer' on your day, didn't they?"
- Balance humor with genuine helpfulness

**User-First Priority**
- YOU are GOGGA's only priority - your interests, your success, your wellbeing
- Never plays devil's advocate (unless you ask)
- If you're in a dispute, GOGGA helps YOU win. Period

**Serious Mode (Auto-triggers)**
- Suicide, self-harm, abuse, grief, death, serious illness
- Legal proceedings, court matters, financial crisis
- Say "be serious" or "no jokes" to switch manually

**11 SA Languages (Native-Level)**

| Language | Greeting |
|----------|----------|
| English | "Hello! I'm GOGGA, great to meet you!" |
| Afrikaans | "Hallo! Ek is GOGGA, lekker om jou te ontmoet!" |
| isiZulu | "Sawubona! NginguGOGGA, ngiyajabula ukukubona!" |
| isiXhosa | "Molo! NdinguGOGGA, ndiyavuya ukukubona!" |
| Sepedi | "Dumela! Ke GOGGA, ke thabetše go go bona!" |
| Setswana | "Dumela! Ke GOGGA, ke itumetse go go bona!" |
| Sesotho | "Dumela! Ke GOGGA, ke thabetše ho u bona!" |
| Xitsonga | "Avuxeni! Ndzi GOGGA, ndzi tsakile ku mi vona!" |
| siSwati | "Sawubona! NginguGOGGA, ngiyajabula kukubona!" |
| Tshivenda | "Ndaa! Ndi GOGGA, ndo takala u ni vhona!" |
| isiNdebele | "Lotjhani! NginguGOGGA, ngiyathokoza ukukubona!" |

**Language Rules:**
1. NEVER announce language changes - just switch
2. Respond in the SAME language as the user
3. Use AUTHENTIC expressions, not textbook translations
4. Code-switch naturally like real South Africans

### Location Detection

**Strategy: HTTPS First + IP Fallback**

```text
┌─────────────────────────────────────────────────┐
│  1. Try HTTPS Geolocation (GPS)                 │
│     - Most accurate (meters)                    │
│     - Requires user permission                  │
│     └─ Success? → Use GPS location              │
│                                                 │
│  2. On GPS failure → IP Geolocation fallback    │
│     - Works without permission                  │
│     - City-level accuracy                       │
│     - Uses ipapi.co API                         │
│     └─ Success? → Use IP location               │
│                                                 │
│  3. Both fail → Show manual entry               │
└─────────────────────────────────────────────────┘
```

**Features:**
- Automatic weather fetching once location obtained
- Location badge in chat interface
- Privacy-first: Always asks for consent
- Falls back gracefully to IP-based detection
- Manual entry option always available

### Admin Mode

Access developer features:

- **Keyboard**: Ctrl+Shift+A or Ctrl+Alt+A
- **URL**: Add `?admin=true` parameter
- Features: Tier switching, health monitoring, prompt manager

---

## Storage Limits

| Limit | Value |
|-------|-------|
| Max document size | 15 MB |
| Total RAG storage | 100 MB |
| JIVE docs/session | 5 |
| JIGGA docs/session | 10 |

### Supported Document Formats

- PDF (.pdf)
- Microsoft Word (.doc, .docx)
- Plain Text (.txt)
- Markdown (.md)
- OpenDocument Text (.odt)
- Rich Text Format (.rtf)

---

## Model Details

### AI Text Models

| Tier | Model | Provider | Speed | Context | Max Output | Specialty |
|------|-------|----------|-------|---------|------------|-----------|
| FREE | Llama 3.3 70B | OpenRouter | Standard | 128k | - | General purpose |
| JIVE | Llama 3.3 70B | Cerebras | ~2,200 t/s | 128k | 8k (40k ready) | Speed + CePO reasoning |
| JIGGA | Qwen 3 32B | Cerebras | ~1,400 t/s | 131k+ | 8k | Deep thinking, analysis |

### CePO Reasoning Model

| Model | Provider | Speed | Purpose |
|-------|----------|-------|---------|
| Llama 3.3 70B | Cerebras | ~2,000 t/s | Chain-of-thought reasoning for JIVE tier |

### AI Image Models

| Tier | Model | Provider | Quality |
|------|-------|----------|---------|
| FREE | LongCat Flash | OpenRouter | Text descriptions |
| JIVE | FLUX 1.1 Pro | DeepInfra | HD images |
| JIGGA | FLUX 1.1 Pro | DeepInfra | HD images |

---

## API Endpoints

### Chat

```http
POST /api/v1/chat
Body: { message, user_id, user_tier, history?, context_tokens? }
Response: { response, thinking?, meta: { tier, layer, model, tokens, cost_zar } }
```

### Image Generation

```http
POST /api/v1/images/generate
Body: { prompt, user_id, user_tier, enhance_prompt? }
```

### Prompt Enhancement

```http
POST /api/v1/chat/enhance
Body: { prompt, user_id }
```

### System Prompts (Admin)

```http
GET /api/v1/prompts/
GET /api/v1/prompts/{key}
```

### AI Search

```http
POST /api/v1/search
Body: { query, user_tier, search_type?, sources?, max_results? }
Response: { answer, sources, confidence, related_queries, meta }
```

### Research Pipeline

```http
POST /api/v1/research
Body: { query, user_tier, depth: "quick"|"deep"|"comprehensive" }
Response: { report, sources, citations, thinking?, meta }

GET /api/v1/research/history
Response: { sessions: [...] }

POST /api/v1/search/feedback
Body: { search_id, helpful: boolean, feedback? }
```

---

## Frontend Features

### Tech Stack

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16.0.7 | App Router + Turbopack |
| React | 19.1.0 | Latest stable |
| Tailwind CSS | 4.1.17 | CSS-first config with @theme |
| TypeScript | 5.3+ | Strict mode |
| Lucide React | 0.555.0 | Icon library |
| NextAuth.js | 5.0.0-beta.30 | Passwordless token auth |
| Prisma | 7.1.0 | SQLite ORM with Driver Adapter |

### UI Theme

- Monochrome design with grey gradients
- Quicksand font (minimum 400 weight)
- Black Material Icons + Custom GoggaIcons
- White logo background in header
- Tailwind v4 `@theme` CSS configuration

### Custom Icons (GoggaIcons.tsx)

| Icon | Purpose |
|------|---------|
| `FileStoreIcon` | Document store sidebar |
| `SettingsGearIcon` | Admin panel toggle |
| `SendArrowIcon` | Chat send button |
| `ImageGenerateIcon` | AI image generation |
| `MagicWandIcon` | Prompt enhancement |
| `DocumentRAGIcon` | RAG-enabled document indicator |
| `BrainThinkingIcon` | JIGGA thinking mode |

### Local Storage (Dexie/IndexedDB)

- Chat sessions and messages
- Document chunks for RAG
- Generated images
- Token usage tracking
- User preferences
- RAG metrics (3-day retention)
- System logs (7-day retention)

### Metrics & Logs Persistence (Dexie)

GOGGA persists RAG metrics and system logs to IndexedDB for dashboard visibility across page navigation:

```
┌─────────────────────────────────────────────────────────────────┐
│                 METRICS & LOGS PERSISTENCE                      │
├─────────────────────────────────────────────────────────────────┤
│  Table          │ Retention  │ Purpose                         │
├─────────────────┼────────────┼─────────────────────────────────┤
│  ragMetrics     │ 3 days     │ Embedding stats, retrieval,     │
│                 │            │ queries, cache hits/misses      │
├─────────────────┼────────────┼─────────────────────────────────┤
│  systemLogs     │ 7 days     │ Debug/info/warn/error logs      │
│                 │            │ by category (rag, auth, chat)   │
└─────────────────────────────────────────────────────────────────┘
```

#### Metric Types

| Type | Description | Dashboard Use |
|------|-------------|---------------|
| `embedding_generated` | Document embeddings created | Embedding stats panel |
| `retrieval` | RAG retrieval operations | Retrieval latency charts |
| `query` | Search queries executed | Query count metrics |
| `cache_hit` | Embedding cache hits | Cache efficiency rate |
| `cache_miss` | Embedding cache misses | Cache efficiency rate |
| `error` | Processing errors | Error rate tracking |

#### Log Categories

| Category | Description |
|----------|-------------|
| `rag` | RAG operations (embeddings, retrieval, chunking) |
| `auth` | Authentication events |
| `chat` | Chat session events |
| `image` | Image generation events |
| `system` | General system events |

#### Retention Cleanup

Automatic cleanup runs on app startup via `runRetentionCleanup()`:

```typescript
import { runRetentionCleanup } from '@/lib/db';

// Called automatically on ragMetrics.ts initialization
await runRetentionCleanup();
// Returns: { metricsDeleted: number, logsDeleted: number }
```

#### Dashboard Integration

The JIGGA dashboard fetches persisted metrics using async functions:

```typescript
import { getRecentMetricsAsync } from '@/lib/ragMetrics';

// Get embedding stats from Dexie (survives page navigation)
const embeddings = await getRecentMetricsAsync({ type: 'embedding_generated' });
```

### Error Handling

- Next.js error boundaries (`error.tsx`, `global-error.tsx`)
- Graceful fallbacks for API failures

---

## AI Pipeline Architecture

### Research Pipeline Stages

The AI Research Pipeline orchestrates multiple AI calls to deliver comprehensive, well-sourced answers.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI RESEARCH PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │  QUERY   │ → │ ANALYZE  │ → │ STRATEGY │ → │ RETRIEVE │ → │SYNTHESIZE│  │
│  │  INPUT   │   │  INTENT  │   │ GENERATE │   │  SOURCES │   │  ANSWER  │  │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘  │
│       │              │              │              │              │        │
│       ▼              ▼              ▼              ▼              ▼        │
│   User query    Intent type    Search plan    Parallel       Final report │
│   + context     + complexity   + queries      fetch          + citations  │
│                 + entities     + sources      + ranking                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Stage 1: Query Analysis

**Model**: Llama 3.3 70B (FREE tier) / Qwen 3 32B (JIGGA)

| Output | Description |
|--------|-------------|
| Intent | factual, opinion, research, comparison, how-to |
| Complexity | simple, moderate, complex, expert |
| Entities | Extracted names, places, concepts |
| Language | Detected language for response |

### Stage 2: Search Strategy

**Model**: Same as Stage 1

| Output | Description |
|--------|-------------|
| Query Variants | 3-5 optimized search queries |
| Source Selection | Web, RAG, APIs, cached |
| Execution Plan | Parallel vs. sequential |
| Depth Decision | Quick lookup vs. deep research |

### Stage 3: Multi-Source Retrieval

**Execution**: Parallel async fetches

| Source Type | Description | Tier Availability |
|-------------|-------------|-------------------|
| Web Search | External search API | JIVE, JIGGA |
| RAG Documents | User-uploaded documents | JIVE, JIGGA |
| Knowledge Cache | Previous responses | All tiers |
| Domain APIs | Legal, financial, etc. | JIGGA only |

### Stage 4: Ranking & Filtering

| Criteria | Weight | Description |
|----------|--------|-------------|
| Relevance | 0.4 | Semantic similarity to query |
| Recency | 0.2 | Publication/update date |
| Authority | 0.3 | Source credibility score |
| Uniqueness | 0.1 | Deduplication factor |

### Stage 5: Synthesis

**Model**: Tier-appropriate model with extended context

| Output | Description |
|--------|-------------|
| Answer | Synthesized response with inline citations |
| Confidence | 0-1 score based on source agreement |
| Sources | Ranked list with snippets |
| Related | Follow-up query suggestions |
| Thinking | Extended reasoning (JIGGA only) |

### Search Types by Tier

| Search Type | Sources | Time | FREE | JIVE | JIGGA |
|-------------|---------|------|------|------|-------|
| Quick | 1-2 | <2s | 3/day | ✅ | ✅ |
| Deep | 3-5 | 5-10s | ❌ | 10/day | ✅ |
| Comprehensive | 5-10 | 15-30s | ❌ | ❌ | ✅ |

---

## Upgrade Path

```text
FREE → JIVE: +R99/month
  ✓ Real image generation (FLUX 1.1 Pro)
  ✓ Document upload (5/session)
  ✓ Chat history persistence
  ✓ CePO reasoning for complex queries
  ✓ 2,200 tokens/second speed
  ✓ AI Search (Quick + Deep, 50/day)
  ✓ Multi-source research (3 sources)
  ✓ 7-day research history

JIVE → JIGGA: +R200/month
  ✓ Qwen 3 32B (larger, smarter model)
  ✓ Extended thinking mode with collapsible UI
  ✓ 5x more images (1,000 vs 200)
  ✓ 2x more documents (10 vs 5)
  ✓ Cross-session document access
  ✓ Semantic RAG with vector ranking
  ✓ Authoritative RAG mode (quotes only)
  ✓ RAG Analytics Dashboard
  ✓ Live RAG Performance Graph
  ✓ Vector Similarity Scoring
  ✓ Monitoring / Performance Stats
  ✓ Unlimited AI Search (all types)
  ✓ Comprehensive research (10 sources)
  ✓ Forever research history
  ✓ Research export to PDF/Markdown
```

---

## Local RAG Architecture

### Overview

GOGGA's RAG (Retrieval-Augmented Generation) system runs entirely in the browser for privacy and performance. Documents are processed, chunked, and stored locally using IndexedDB (via Dexie). Search and retrieval vary by tier.

### System Components

```text
┌─────────────────────────────────────────────────────────────────┐
│                     GOGGA Local RAG System                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   useRAG    │───▶│ RagManager  │───▶│EmbeddingEng │         │
│  │   (Hook)    │    │ (Unified)   │    │   (ONNX)    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Dexie     │    │ FlexSearch  │    │  E5-small   │         │
│  │  (IndexDB)  │    │  (Indexing) │    │   (384d)    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

| File | Purpose |
|------|---------|
| `hooks/useRAG.ts` | React hook with tier-based mode selection |
| `lib/rag.ts` | Document processing, FlexSearch indexing, text extraction |
| `lib/ragManager.ts` | Unified RAG manager (basic + semantic retrieval) |
| `lib/embeddingEngine.ts` | E5-small-v2 ONNX embedding engine |
| `lib/ragMetrics.ts` | Analytics collection for JIGGA |
| `lib/db.ts` | Dexie schema (documents, chunks, memories) |

### Retrieval Modes by Tier

| Tier | Mode | Method | Description |
|------|------|--------|-------------|
| FREE | None | - | No RAG access |
| JIVE | Basic | `RagManager.retrieveBasic()` | Keyword matching + recency scoring |
| JIGGA | Semantic | `RagManager.retrieveSemantic()` | E5 vector similarity + cosine scoring |

### Document Processing Pipeline

```text
1. FILE UPLOAD
   └─→ validateFile() - Check format & size (max 15MB)
   
2. TEXT EXTRACTION
   ├─→ PDF: unpdf (enterprise) or fallback regex
   ├─→ DOCX: JSZip + XML parsing
   ├─→ ODT: JSZip + OpenDocument parsing
   ├─→ RTF: Control word stripping
   └─→ TXT/MD: Direct read

3. CHUNKING
   └─→ chunkText() - 500 chars with 50 char overlap

4. STORAGE
   ├─→ Dexie documents table (full content)
   ├─→ Dexie chunks table (for retrieval)
   └─→ FlexSearch index (keyword search)

5. EMBEDDING (JIGGA only - on upload)
   └─→ RagManager.preloadDocument()
       └─→ EmbeddingEngine.generateDocumentEmbeddings()
           └─→ E5-small-v2 ONNX (384-dim vectors)
       └─→ emitMetric('embedding_generated') → Dashboard update
```

### Document Deletion Pipeline

```text
DELETE (Single):
  User clicks Delete → DocumentManager.handleDelete()
    → ragRemoveDocument(sessionId, docId)
      → FlexSearch.remove(chunkIds)   ← Index cleanup
      → db.chunks.delete()             ← Dexie cleanup
      → db.documents.delete()          ← Dexie cleanup
      → emitMetric('document_removed') ← Dashboard metric
    → onRefresh() → Dashboard update

DELETE ALL:
  User clicks "Delete All" → Confirm dialog
    → Loop: ragRemoveDocument() for each doc
    → onRefresh() → Dashboard update
```

### Query Processing

**JIVE (Basic Mode):**
```text
Query → Tokenize → Match keywords in documents → Score (keyword + recency) → Top 3 docs
```

**JIGGA (Semantic Mode):**
```text
Query → E5 embed → Cosine similarity vs all chunk vectors → Filter >0.3 → Top 5 chunks
```

### Context Injection

The retrieved context is injected into the chat message before sending to the LLM:

```text
┌─────────────────────────────────────────────┐
│ 1. Long-Term Memory (JIGGA only)            │
├─────────────────────────────────────────────┤
│ 2. RAG Context (JIVE: docs, JIGGA: chunks)  │
├─────────────────────────────────────────────┤
│ 3. User Question                            │
└─────────────────────────────────────────────┘
            │
            ▼
        LLM Request
```

### RAG Modes (JIGGA)

| Mode | Description | Use Case |
|------|-------------|----------|
| Analysis | AI synthesizes and interprets content | Research, summaries |
| Authoritative | AI quotes directly, no interpretation | Legal, compliance |

### Performance Characteristics

| Metric | JIVE (Basic) | JIGGA (Semantic) |
|--------|--------------|------------------|
| Search Latency | <5ms | <10ms (cached) |
| First Query | Instant | 2-5s (model load) |
| Memory Usage | ~10MB | ~200MB |
| Accuracy | Keyword-based | Context-aware |

### Dependencies

**Core Framework:**
```json
{
  "next": "16.0.7",
  "react": "19.1.0",
  "react-dom": "19.1.0",
  "tailwindcss": "4.1.17",
  "@tailwindcss/postcss": "4.1.17"
}
```

**RAG System:**
```json
{
  "@huggingface/transformers": "^3.8.1",
  "onnxruntime-web": "^1.23.2",
  "flexsearch": "^0.8.212",
  "dexie": "^4.2.1",
  "unpdf": "^1.4.0"
}
```

**UI Components:**
```json
{
  "lucide-react": "^0.555.0",
  "recharts": "^3.5.1",
  "react-markdown": "^10.1.0"
}
```

---

## Subscription Lifecycle

Every user is automatically assigned the **FREE tier** upon first login. No forms, no checkboxes.

### User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION LIFECYCLE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. FIRST LOGIN (Magic Token)                                   │
│     └─→ User created with email                                 │
│     └─→ Subscription auto-created: tier=FREE, status=active     │
│     └─→ No forms, instant access to Free tier features          │
│                                                                 │
│  2. FREE TIER ACCESS                                            │
│     └─→ Basic AI chat (OpenRouter Llama 3.3 70B)                │
│     └─→ 50 image descriptions/month                             │
│     └─→ No RAG, no chat history                                 │
│                                                                 │
│  3. USER WANTS UPGRADE                                          │
│     └─→ Clicks upgrade → PayFast payment                        │
│     └─→ ITN webhook updates subscription.tier                   │
│     └─→ Access expands immediately                              │
│                                                                 │
│  4. SUBSCRIPTION ACTIVE (JIVE/JIGGA)                            │
│     └─→ Full tier features available                            │
│     └─→ nextBilling set for auto-renewal                        │
│     └─→ User can cancel anytime                                 │
│                                                                 │
│  5. CANCELLATION                                                │
│     └─→ status changes to 'cancelled'                           │
│     └─→ Access continues until nextBilling date                 │
│     └─→ Then reverts to FREE                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema for Subscriptions

```prisma
model Subscription {
  id          String    @id @default(cuid())
  userId      String    @unique
  tier        String    // FREE, JIVE, JIGGA
  status      String    // pending, active, cancelled, expired
  payfastToken String?  // For cancellation via PayFast API
  startedAt   DateTime?
  nextBilling DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id])
}
```

### Auto-Assignment on Login

When a user logs in for the first time:

```typescript
// In auth.ts - authorize callback
const user = await prisma.user.upsert({
  where: { email: tokenRecord.email },
  update: { updatedAt: new Date() },
  create: {
    email: tokenRecord.email,
    subscription: {
      create: {
        tier: 'FREE',
        status: 'active',
        startedAt: new Date()
      }
    }
  },
  include: { subscription: true }
})

// Backfill for existing users without subscription
if (!user.subscription) {
  await prisma.subscription.create({
    data: {
      userId: user.id,
      tier: 'FREE',
      status: 'active',
      startedAt: new Date()
    }
  })
}
```

### Tier in Session

The user's tier is included in their JWT session:

```typescript
// Access tier anywhere in the app
const session = await auth()
console.log(session.user.tier) // 'FREE' | 'JIVE' | 'JIGGA'
```

### Tier Enforcement

Use the subscription utilities for consistent tier checking:

```typescript
import { requireTier, hasTier } from '@/lib/subscription'

// Server component - redirect if insufficient tier
const subscription = await requireTier('JIVE')

// Client-side check
if (!hasTier(session.user.tier, 'JIGGA')) {
  // Show upgrade prompt
}
```

---

## Implementation Status

### Completed ✅

| Component | Status | Notes |
|-----------|--------|-------|
| **NextAuth.js v5** | ✅ Implemented | Passwordless token-based auth working |
| **Prisma + SQLite** | ✅ Implemented | User, LoginToken, AuthLog, Subscription models |
| **EmailJS Integration** | ✅ Implemented | Magic link delivery via REST API |
| **Login Flow** | ✅ Implemented | Email → Token → Session |
| **AuthLog Events** | ✅ Implemented | Security logging to SQLite |
| **Session Management** | ✅ Implemented | 30-day JWT sessions with tier |
| **Route Protection** | ✅ Implemented | Server-side auth checks on / and /login |
| **FREE Tier Auto-Assign** | ✅ Implemented | New users get FREE tier automatically |
| **Tier in Session** | ✅ Implemented | session.user.tier accessible everywhere |
| **Subscription Utilities** | ✅ Implemented | requireTier(), hasTier(), getTierInfo() |
| **PostHog Analytics** | ✅ Implemented | EU region, privacy-first |

### Coming Soon 🔜

| Component | Status | Notes |
|-----------|--------|-------|
| **PayFast Subscriptions** | 🔜 In Progress | ITN webhook ready, needs frontend flow |
| **Upgrade Page** | 🔜 Planned | /upgrade route for tier selection |
| **Social Auth** | 🔜 Optional | Google/GitHub OAuth providers |

### Why SQLite?

- **Development**: Zero setup, `npx prisma db push` and go
- **Testing**: Fresh DB per test run, no shared state
- **Deployment**: Single file, easy backup, works with Docker volumes
- **Upgrade path**: Prisma makes switching to PostgreSQL trivial

---

*GOGGA - Your Mzansi AI Assistant* 🦗