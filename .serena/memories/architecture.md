# GOGGA Architecture Details

## Storage Architecture (Dual-Database)

GOGGA uses **two separate databases** that never connect directly:

| Database | Purpose | Scope | Persistence |
|----------|---------|-------|-------------|
| **SQLite** (Prisma) | Identity & billing | Server instance | Until deleted |
| **Dexie** (IndexedDB) | User content | Per-browser, per-device | User controlled |

### SQLite (Server-Side)
- User identity (email, id)
- Login tokens (magic links)
- Auth logs (connection audit)
- Subscriptions (tier, status, PayFast token)

### Dexie (Client-Side, Per-User-Per-Device)
- Chat sessions & messages
- RAG documents & chunks
- Generated images
- User preferences
- Long-term memories
- Token usage tracking

### Data Isolation
Each user's Dexie database is **automatically isolated** by the browser:
- Same-origin policy: Only `gogga.app` can access its IndexedDB
- Per-browser: Chrome, Firefox, Safari each have separate databases
- Per-device: Desktop and mobile are completely isolated
- No sharing: Multiple users on shared device = separate browser profiles

### The Bridge: `session.user`
The only connection between SQLite and Dexie is the session:
- `session.user.id` - Identifies user
- `session.user.tier` - Gates features (FREE/JIVE/JIGGA)

---

# GOGGA Architecture Details

## Tier-Based Cognitive Routing

GOGGA uses a 3-tier subscription model with distinct routing logic and pricing.

### Tier Overview

| Tier | Text Model | Image Generator | Prompt Enhancement | Cost (Text) | Cost (Image) |
|------|------------|-----------------|-------------------|-------------|--------------|
| FREE | OpenRouter Llama 3.3 70B FREE | OpenRouter LongCat Flash FREE | Llama 3.3 70B FREE | $0.00 | $0.00 |
| JIVE | Cerebras Llama 3.3 70B (+CePO) | DeepInfra FLUX 1.1 Pro (200/mo) | Llama 3.3 70B FREE | $0.10/$0.10 per M | $0.04/image |
| JIGGA | Cerebras Qwen 3 32B (think/no_think) | DeepInfra FLUX 1.1 Pro (1000/mo) | Llama 3.3 70B FREE | $0.40/$0.80 per M | $0.04/image |

### Pricing Summary (USD)

**Text (per Million Tokens):**
- FREE: $0.00 input, $0.00 output
- JIVE (Llama 3.3 70B): $0.10 input, $0.10 output
- JIGGA (Qwen 3 32B): $0.40 input, $0.80 output

**Images (per image):**
- FREE (LongCat): $0.00
- JIVE/JIGGA (FLUX 1.1 Pro): $0.04

### FREE Tier Pipeline
```
TEXT:  User → Llama 3.3 70B FREE → Response
IMAGE: User → Llama 3.3 (enhance) → LongCat Flash → Image
```

### JIVE Tier Pipeline
```
TEXT (simple):  User → Llama 3.3 70B → Response
TEXT (complex): User → Llama 3.3 70B + CePO → Response
IMAGE:          User → Llama 3.3 (enhance) → FLUX 1.1 Pro → Image
```

### JIGGA Tier Pipeline
```
TEXT (thinking): User → Qwen 3 32B (temp=0.6, top_p=0.95, top_k=20, min_p=0) → Deep reasoning
TEXT (fast):     User → Qwen 3 32B + /no_think (temp=0.7, top_p=0.8, top_k=20, min_p=0) → Fast response
IMAGE:           User → Llama 3.3 (enhance) → FLUX 1.1 Pro → Image
```

### Qwen Thinking Mode (JIGGA)
- **Thinking ON** (default): temp=0.6, top_p=0.95, top_k=20, min_p=0, max_tokens=8000
- **Fast mode** (/no_think): temp=0.7, top_p=0.8, top_k=20, min_p=0, max_tokens=8000
- **Thinking block**: Output wrapped in `<think>...</think>` tags, parsed and returned separately
- **UI display**: Thinking block shown collapsed, main response shown expanded
- **NEVER use greedy decoding (temp=0)** - causes performance degradation and endless repetitions
- **Language rule**: Model MUST respond in same language as user prompt
- Long context (131k+): Auto-disable thinking for accuracy

### Token Tracking
- ALL tiers track token usage (tied to user email)
- FREE tier: No cost but still counted for usage limits
- JIVE/JIGGA: Costs calculated and tracked per-request

### Streaming Responses (JIVE/JIGGA Only)
- **Endpoint**: `POST /api/v1/chat/stream`
- **Transport**: Server-Sent Events (SSE)
- **Implementation**: `AIService.generate_stream()` async generator
- **Headers**: `Cache-Control: no-cache`, `X-Accel-Buffering: no`

**SSE Event Types:**
| Type | Description |
|------|-------------|
| `meta` | Initial metadata (tier, layer, model, thinking_mode) |
| `content` | Main response text chunks |
| `thinking_start` | Start of JIGGA thinking block |
| `thinking` | Thinking block content (JIGGA only) |
| `thinking_end` | End of JIGGA thinking block |
| `done` | Final metadata with tokens, costs |
| `error` | Error message |

**Frontend Integration:**
```javascript
const response = await fetch('/api/v1/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, user_id, user_tier })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  // Parse SSE: "data: {...}\n\n"
}
```

### Universal Prompt Enhancement
- Available to ALL tiers via "Enhance" button
- Uses OpenRouter Llama 3.3 70B FREE
- Works for both text and image prompts
- Cost: FREE

### Image Generation Limits
| Tier | Limit | Generator | Cost |
|------|-------|-----------|------|
| FREE | 50/month | LongCat Flash | $0.00 |
| JIVE | 200/month | FLUX 1.1 Pro | $0.04/image |
| JIGGA | 1000/month | FLUX 1.1 Pro | $0.04/image |

### Separation Rule
- TEXT → Cerebras (JIVE/JIGGA) or OpenRouter (FREE)
- IMAGE → OpenRouter (prompt) + LongCat/FLUX (generation)
- ENHANCEMENT → OpenRouter Llama 3.3 FREE (universal)

### JIGGA-Exclusive Features
| Feature | Description |
|---------|-------------|
| Semantic RAG | Vector similarity ranking for context retrieval |
| RAG Authoritative | Quotes directly from documents only |
| RAG Analytics Dashboard | Document usage, query patterns, retrieval stats |
| Live RAG Performance Graph | Real-time visualization of RAG operations |
| Vector Similarity Scoring | Relevance scores for retrieved chunks |
| Monitoring / Performance Stats | Query latency, cache hits, retrieval accuracy |