# GOGGA Tier System

> **Last Updated:** December 3, 2025

## Overview

GOGGA is a South African AI assistant with a 3-tier subscription model. Each tier offers distinct capabilities, AI models, and features tailored to different user needs.

---

## Tier Comparison

| Feature | FREE | JIVE | JIGGA |
|---------|------|------|-------|
| **Monthly Price** | R0 | R99 | R299 |
| **Text Model** | Llama 3.3 70B | Llama 3.1 8B + CePO | Qwen 3 32B |
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

- Fast, efficient responses for simple queries
- Deep reasoning with CePO for complex problems
- Enhanced South African legal and cultural knowledge

### Capabilities

- **Text Chat**: Cerebras Llama 3.1 8B with automatic complexity routing
- **Speed**: ~2,200 tokens/second
- **CePO Integration**: Chain-of-thought planning for complex queries (using Llama 3.3 70B)
- **Image Generation**: Full FLUX 1.1 Pro images (200/month)
- **Document Upload**: Up to 5 documents per chat session
- **Chat Persistence**: All conversations saved locally via Dexie

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

- Upload PDF, Word, TXT, MD, ODT files
- Max 15MB per document
- 5 documents per session
- Documents cleared on new session

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

- Upload PDF, Word, TXT, MD, ODT, RTF files
- Max 15MB per document
- 10 documents per session (combined upload + selected)
- **Cross-session document selection**: Browse and select from all previously uploaded documents
- **Semantic RAG**: Vector similarity ranking for best context retrieval
- **Vector Similarity Scoring**: See relevance scores for each document chunk
- Two RAG modes:
  - **Analysis**: AI synthesizes and interprets document content
  - **Authoritative**: AI quotes directly from documents only (JIGGA exclusive)

### RAG Analytics (JIGGA Exclusive)

- **Analytics Dashboard**: View document usage, query patterns, retrieval stats
- **Live Performance Graph**: Real-time visualization of RAG operations
- **Vector Scoring Display**: See similarity scores for retrieved chunks
- **Monitoring Stats**: Query latency, cache hits, retrieval accuracy

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

### GOGGA Personality

**Sarcastic-Friendly (Default)**
- Witty, warm, and wonderfully sarcastic - like a clever friend who keeps it real
- "Another landlord who thinks they're above the RHA? How original. Let me help you sort them out"
- "Load shedding AND work stress? Eskom really said 'hold my beer' on your day, didn't they?"
- Balance humor with genuine helpfulness

**User-First Priority**
- YOU are GOGGA's only priority - your interests, your success, your wellbeing
- Never plays devil's advocate (unless you ask)
- If you're in a dispute, GOGGA helps YOU win. Period

**Serious Mode (Automatic)**
- Drops all sarcasm for: legal threats, medical emergencies, financial crisis, trauma
- Say "be serious" or "no jokes" to switch to professional mode

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

| Tier | Model | Provider | Speed | Context | Specialty |
|------|-------|----------|-------|---------|-----------|
| FREE | Llama 3.3 70B | OpenRouter | Standard | 128k | General purpose |
| JIVE | Llama 3.1 8B | Cerebras | ~2,200 t/s | 128k | Speed + CePO reasoning |
| JIGGA | Qwen 3 32B | Cerebras | ~1,400 t/s | 131k+ | Deep thinking, analysis |

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

### UI Theme

- Monochrome design with grey gradients
- Quicksand font (minimum 400 weight)
- Black Material Icons
- White logo background in header

### Local Storage (Dexie/IndexedDB)

- Chat sessions and messages
- Document chunks for RAG
- Generated images
- Token usage tracking
- User preferences

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

*GOGGA - Your Mzansi AI Assistant* 🦗