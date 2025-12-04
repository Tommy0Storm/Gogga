# GOGGA Feature Upgrade Plan

## 📊 Comprehensive UX/Workflow Analysis & Code Sweep Results

**Analysis Date:** December 4, 2025
**Prepared for:** User Approval

---

## 🔍 CODE DUPLICATIONS IDENTIFIED

### 1. **HTTP Client Pattern Duplication**
**Location:** Multiple service files
- `openrouter_service.py` - `_get_client()` method (lines 46-58)
- `cepo_service.py` - `_get_client()` method (lines 50-58)
- `image_service.py` - `flux_client` property (lines 65-76)

**Issue:** Each service implements its own lazy HTTP client initialization with nearly identical code.

**Enhancement:** Create a shared `BaseHTTPService` class with common client management.

---

### 2. **Logger Initialization Duplication**
**Location:** 10 files across the backend
- `main.py`, `exceptions.py`, `chat.py`, `images.py`, `openrouter_service.py`, `cost_tracker.py`, `payfast_service.py`, `image_service.py`, `cepo_service.py`, `ai_service.py`

**Issue:** Each file has `logger = logging.getLogger(__name__)` - same pattern repeated.

**Enhancement:** Create a centralized logging utility with structured logging support.

---

### 3. **Health Check Pattern Duplication**
**Location:** 
- `main.py`: `/health`, `/health/live`, `/health/ready` (3 endpoints)
- `ai_service.py`: `health_check()` method
- `cepo_service.py`: `health_check()` method
- `openrouter_service.py`: `health_check()` method
- `images.py`: `/health` endpoint

**Issue:** Health check implementations scattered across services with inconsistent patterns.

**Enhancement:** Create unified `HealthManager` service with centralized health aggregation.

---

### 4. **Prompt Enhancement Duplication**
**Location:**
- `openrouter_service.py`: `enhance_prompt()` method (lines 174-237)
- `image_service.py`: Calls `openrouter_service.enhance_prompt()` twice - in `_generate_free()` AND in `_generate_flux()`

**Issue:** Prompt enhancement is called from `openrouter_service.generate_image_free()` but the `_generate_free()` method in `image_service.py` calls it again.

**Enhancement:** Consolidate prompt enhancement flow to avoid potential double-enhancement.

---

### 5. **Response Metadata Pattern Duplication**
**Location:** Multiple response building patterns
- `ai_service.py`: Lines 316-339 (ResponseDict construction)
- `openrouter_service.py`: Lines 155-168 (result dict construction)
- `cepo_service.py`: Lines 171-183 (result dict construction)
- `image_service.py`: Lines 157-172, 256-271 (ImageGenerationResponse)

**Issue:** Each service builds similar metadata structures with slightly different keys.

**Enhancement:** Create a unified `ResponseMetadata` builder class.

---

## 🎨 USER EXPERIENCE ANALYSIS

### Current UX Flow
```
User → Tier Selection → Input Message → [Enhancement?] → AI Processing → Response Display
                                      → [Image Gen?]  → Image Pipeline → Image Display
```

### UX Pain Points Identified

1. **Tier Selection Visibility**
   - Current: Tier badge in header, no quick-switch option
   - Issue: Users must scroll to admin panel to change tiers
   - Enhancement: Add tier dropdown in header

2. **RAG Document Management**
   - Current: Sidebar hidden on mobile, requires navigation
   - Issue: Mobile users can't easily access document management
   - Enhancement: Add mobile-friendly document drawer

3. **Loading States**
   - Current: Generic "Thinking..." animation
   - Issue: No progress indication for long-running requests
   - Enhancement: Add step-based progress for multi-stage operations

4. **Error Recovery**
   - Current: Error messages displayed in chat
   - Issue: No retry mechanism, user must re-type
   - Enhancement: Add "Retry" button on failed messages

5. **Token Tracking UI**
   - Current: All-time token count in header
   - Issue: No breakdown by tier or daily/weekly view
   - Enhancement: Add token usage dashboard with breakdown

---

## 🚀 FEATURE UPGRADE PROPOSALS

### Priority 1: Critical Enhancements (Immediate Impact)

#### 1.1 **Unified HTTP Client Base Class**
```python
class BaseAsyncService:
    """Base class for async HTTP services with client management."""
    _client: httpx.AsyncClient | None = None
    _base_url: str
    _timeout: float = 120.0
    
    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                headers=self._get_headers()
            )
        return self._client
    
    def _get_headers(self) -> dict[str, str]:
        """Override in subclass for service-specific headers."""
        return {"Content-Type": "application/json"}
    
    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
```
**Impact:** Reduces code duplication ~40 lines, standardizes error handling.

#### 1.2 **Centralized Logging Factory**
```python
# app/core/logging.py
from typing import Final

def get_logger(name: str, level: str = "INFO") -> logging.Logger:
    """Get a configured logger with structured output."""
    logger = logging.getLogger(name)
    # Add structured formatting, filters, etc.
    return logger

# Usage: from app.core.logging import get_logger
```
**Impact:** Consistent logging, easier to add tracing/monitoring.

#### 1.3 **Unified Health Check Manager**
```python
class HealthManager:
    """Centralized health check aggregation."""
    
    async def check_all(self) -> dict:
        results = await asyncio.gather(
            self._check_cerebras(),
            self._check_cepo(),
            self._check_openrouter(),
            return_exceptions=True
        )
        return self._aggregate(results)
```
**Impact:** Single source of truth for service health, easier monitoring.

---

### Priority 2: UX Improvements (User Experience)

#### 2.1 **Quick Tier Switcher in Header**
- Add dropdown/toggle for tier selection in header
- Preserve current tier in localStorage (already done)
- Show tier capabilities tooltip on hover

#### 2.2 **Mobile Document Drawer**
- Slide-up drawer for RAG documents on mobile
- Swipe gestures for document selection
- Compact document cards

#### 2.3 **Progressive Loading States**
```typescript
interface LoadingStep {
  name: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  duration?: number;
}
```
- Show steps: "Enhancing prompt..." → "Generating response..." → "Complete"

#### 2.4 **Message Retry Functionality**
- Add "Retry" button on failed messages
- Re-send with same parameters
- Track retry count

#### 2.5 **Token Usage Dashboard**
- Daily/weekly/monthly views
- Breakdown by tier
- Cost estimates in ZAR
- Export functionality

---

### Priority 3: Architecture Improvements (Technical Debt)

#### 3.1 **FastAPI Dependency Injection Pattern**
```python
# Current: Singleton services at module level
# Proposed: Use FastAPI's Depends() system

async def get_ai_service() -> AIService:
    return AIService()

@router.post("/chat")
async def chat(
    request: TieredChatRequest,
    ai: AIService = Depends(get_ai_service)
):
    return await ai.generate_response(...)
```
**Benefit:** Easier testing, cleaner separation, proper lifecycle management.

#### 3.2 **Response Builder Pattern**
```python
class ResponseBuilder:
    """Unified response building for all AI services."""
    
    def __init__(self, tier: str, layer: str, provider: str):
        self.meta = {"tier": tier, "layer": layer, "provider": provider}
    
    def with_tokens(self, input: int, output: int) -> "ResponseBuilder":
        self.meta["tokens"] = {"input": input, "output": output}
        return self
    
    def with_cost(self, usd: float, zar: float) -> "ResponseBuilder":
        self.meta["cost_usd"] = usd
        self.meta["cost_zar"] = zar
        return self
    
    def build(self, content: str, thinking: str | None = None) -> dict:
        return {"response": content, "thinking": thinking, "meta": self.meta}
```

#### 3.3 **Config Cleanup**
- Remove legacy pricing variables (COST_SPEED_*, COST_COMPLEX_*)
- Consolidate model settings into typed dataclasses
- Add validation for tier-model mappings

---

### Priority 4: New Feature Additions

#### 4.1 **Streaming Responses**
- The `chat_stream` endpoint exists but is incomplete
- Implement Server-Sent Events (SSE) for real-time responses
- Add streaming toggle in UI

#### 4.2 **Conversation Export**
- Export chat history as Markdown/PDF
- Include token usage and cost summary
- Support for image embedding

#### 4.3 **Prompt Library**
- Save and reuse favorite prompts
- Categorize by use case (Legal, Coding, Creative)
- Share prompts between sessions

#### 4.4 **Keyboard Shortcuts**
- Cmd/Ctrl + Enter: Send message
- Cmd/Ctrl + E: Enhance prompt
- Cmd/Ctrl + I: Generate image
- Cmd/Ctrl + N: New chat

---

### Priority 5: AI Research & Search Pipeline (Advanced AI Features)

#### 5.1 **AI Research Pipeline**

A multi-stage research system that orchestrates multiple AI calls to deliver comprehensive, well-sourced answers.

**Architecture:**
```
User Query → Query Analysis → Search Strategy → Multi-Source Retrieval → Synthesis → Response
     │              │               │                    │                  │
     ▼              ▼               ▼                    ▼                  ▼
  [Intent]     [Keywords]     [Source Selection]   [Parallel Fetch]   [Final Answer]
```

**Pipeline Stages:**

1. **Query Analysis** (Llama 3.3 70B)
   - Intent classification: factual, opinion, research, comparison, how-to
   - Topic extraction and entity recognition
   - Complexity scoring (simple → deep research)
   - Language detection for multi-lingual support

2. **Search Strategy Generation**
   - Generate optimal search queries (3-5 variants)
   - Select appropriate sources based on query type
   - Determine depth: quick lookup vs. deep research
   - Plan parallel vs. sequential execution

3. **Multi-Source Retrieval** (Parallel)
   - Web search (via API integration)
   - Knowledge base lookup (RAG documents)
   - Cached previous responses
   - Domain-specific APIs (legal, financial, etc.)

4. **Source Ranking & Filtering**
   - Relevance scoring (0-1)
   - Recency weighting
   - Authority/credibility scoring
   - Deduplication

5. **Synthesis & Response Generation**
   - Combine sources with citations
   - Generate structured response
   - Include confidence indicators
   - Provide source links

**Tier Availability:**
| Feature | FREE | JIVE | JIGGA |
|---------|------|------|-------|
| Basic Search | ✅ (3 queries/day) | ✅ (50/day) | ✅ (Unlimited) |
| Deep Research | ❌ | ✅ (10/day) | ✅ (Unlimited) |
| Multi-Source | ❌ | ✅ (3 sources) | ✅ (10 sources) |
| Citations | ❌ | ✅ | ✅ |
| Research History | ❌ | ✅ (7 days) | ✅ (Forever) |

#### 5.2 **AI Search Service**

Intelligent search that understands context and provides AI-enhanced results.

**Components:**

```python
class AISearchService:
    """AI-powered search with semantic understanding."""
    
    async def search(
        self,
        query: str,
        user_tier: str,
        search_type: Literal["quick", "deep", "comprehensive"] = "quick",
        sources: list[str] | None = None,
        max_results: int = 10
    ) -> SearchResponse:
        # 1. Analyze query intent
        intent = await self._analyze_intent(query)
        
        # 2. Generate search variants
        variants = await self._generate_search_queries(query, intent)
        
        # 3. Execute parallel searches
        raw_results = await self._parallel_search(variants, sources)
        
        # 4. Rank and filter
        ranked = self._rank_results(raw_results, query)
        
        # 5. Synthesize answer
        return await self._synthesize(query, ranked[:max_results])
```

**Search Types:**

| Type | Description | Sources | Response Time |
|------|-------------|---------|---------------|
| Quick | Fast factual lookup | 1-2 | < 2s |
| Deep | Multi-source research | 3-5 | 5-10s |
| Comprehensive | Full research report | 5-10 | 15-30s |

**Search Response Structure:**
```typescript
interface SearchResponse {
  query: string;
  intent: 'factual' | 'opinion' | 'research' | 'comparison' | 'how-to';
  answer: string;
  confidence: number;  // 0-1
  sources: Source[];
  related_queries: string[];
  thinking?: string;  // JIGGA only
  meta: {
    search_type: string;
    sources_queried: number;
    response_time_ms: number;
    tokens_used: number;
  };
}

interface Source {
  title: string;
  url: string;
  snippet: string;
  relevance: number;
  authority: number;
  date?: string;
}
```

#### 5.3 **Research Mode UI**

New UI mode for research-heavy workflows.

**Features:**
- Research panel with source cards
- Citation hover previews
- Save research sessions
- Export to Markdown/PDF with citations
- Research history browser
- Source credibility indicators

**UI Components:**
```typescript
// New components for research mode
<ResearchPanel>
  <QueryInput onSearch={handleResearch} />
  <SearchTypeSelector type={searchType} onChange={setType} />
  <SourceFilter sources={availableSources} selected={selectedSources} />
  
  <ResultsArea>
    <SynthesizedAnswer answer={response.answer} confidence={response.confidence} />
    <SourceCards sources={response.sources} onCite={handleCite} />
    <RelatedQueries queries={response.related_queries} onSelect={handleFollowUp} />
  </ResultsArea>
  
  <ResearchHistory sessions={pastSessions} onLoad={loadSession} />
</ResearchPanel>
```

#### 5.4 **Pipeline Orchestration**

Backend orchestration for complex multi-step AI workflows.

**Pipeline Definition:**
```python
class ResearchPipeline:
    """Orchestrates multi-stage research workflows."""
    
    stages = [
        ("analyze", QueryAnalyzer),
        ("strategize", SearchStrategist),
        ("retrieve", MultiSourceRetriever),
        ("rank", ResultRanker),
        ("synthesize", ResponseSynthesizer),
    ]
    
    async def execute(
        self,
        query: str,
        context: PipelineContext
    ) -> PipelineResult:
        result = {"query": query}
        
        for stage_name, stage_class in self.stages:
            stage = stage_class(context)
            result[stage_name] = await stage.run(result)
            
            # Early exit if simple query
            if stage_name == "analyze" and result["analyze"].complexity == "simple":
                return await self._quick_answer(query, context)
        
        return PipelineResult(**result)
```

**Pipeline Features:**
- Stage-based execution with early exit
- Parallel stage execution where possible
- Caching at each stage
- Retry with backoff
- Progress streaming to frontend
- Cost tracking per stage

#### 5.5 **Search Integration Points**

**API Endpoints:**
```http
POST /api/v1/search
Body: { query, user_tier, search_type?, sources?, max_results? }
Response: { answer, sources, confidence, related_queries, meta }

POST /api/v1/research
Body: { query, user_tier, depth: "quick"|"deep"|"comprehensive" }
Response: { report, sources, citations, meta }

GET /api/v1/research/history
Response: { sessions: [...] }

POST /api/v1/search/feedback
Body: { search_id, helpful: boolean, feedback? }
```

**Frontend Hooks:**
```typescript
// New hooks for research features
const { search, isSearching, results } = useAISearch();
const { startResearch, progress, report } = useResearchPipeline();
const { history, loadSession, deleteSession } = useResearchHistory();
```

---

## 📋 IMPLEMENTATION PRIORITY MATRIX

| Enhancement | Impact | Effort | Priority |
|------------|--------|--------|----------|
| Unified HTTP Client | High | Low | P1 |
| Centralized Logging | Medium | Low | P1 |
| Health Check Manager | High | Medium | P1 |
| FastAPI Depends Pattern | High | Medium | P2 |
| Response Builder | Medium | Low | P2 |
| Quick Tier Switcher | High | Low | P2 |
| Mobile Document Drawer | High | Medium | P2 |
| Progressive Loading | Medium | Medium | P3 |
| Message Retry | High | Low | P3 |
| Token Dashboard | Medium | Medium | P3 |
| Streaming Responses | High | High | P4 |
| Conversation Export | Medium | Medium | P4 |
| Prompt Library | Medium | High | P4 |
| Keyboard Shortcuts | Low | Low | P4 |
| AI Search Service | High | High | P5 |
| Research Pipeline | High | High | P5 |
| Research Mode UI | Medium | Medium | P5 |
| Pipeline Orchestration | High | Medium | P5 |
| Search Integration | Medium | Medium | P5 |

---

## ✅ RECOMMENDED IMPLEMENTATION ORDER

### Phase 1 (Week 1-2): Foundation
1. ✅ Create `BaseAsyncService` class
2. ✅ Implement centralized logging
3. ✅ Build `HealthManager` service
4. ✅ Clean up config.py legacy variables

### Phase 2 (Week 3-4): UX Quick Wins
1. ✅ Add quick tier switcher in header
2. ✅ Implement message retry
3. ✅ Add keyboard shortcuts
4. ✅ Improve loading states

### Phase 3 (Week 5-6): Architecture
1. ✅ Migrate to FastAPI Depends pattern
2. ✅ Implement Response Builder
3. ✅ Refactor services to use base class
4. ✅ Add comprehensive test coverage

### Phase 4 (Week 7-8): Advanced Features
1. ✅ Streaming responses
2. ✅ Token usage dashboard
3. ✅ Mobile document drawer
4. ✅ Conversation export

### Phase 5 (Week 9-12): AI Research & Search Pipeline
1. ✅ AI Search Service backend
2. ✅ Research Pipeline orchestration
3. ✅ Multi-source retrieval system
4. ✅ Research Mode UI components
5. ✅ Search history & caching
6. ✅ Citation & export system

---

## 🔐 APPROVAL CHECKLIST

Please review and approve/modify:

- [ ] **P1 Enhancements**: Unified HTTP, Logging, Health Manager
- [ ] **P2 Enhancements**: FastAPI Depends, Response Builder, Tier Switcher
- [ ] **P3 Enhancements**: Loading States, Message Retry, Token Dashboard
- [ ] **P4 Features**: Streaming, Export, Prompt Library, Shortcuts

**Notes for implementation:**
- All changes will maintain backward compatibility
- Each phase can be deployed independently
- Test coverage will be added for all new code

---

*Awaiting approval to proceed with implementation.*

---

## 🔧 TOOL USE & MULTI-TOOL IMPLEMENTATION PATTERNS

### Recommended Tool Patterns for Each Enhancement

#### P1 Enhancements - Foundation

**1.1 Unified HTTP Client Base Class**
```
Tools: mcp_serena_create_text_file → mcp_serena_find_symbol → mcp_serena_replace_symbol_body (parallel refactors)
```
- Create `app/core/http_client.py` with `BaseAsyncService`
- Refactor `OpenRouterService`, `CepoService`, `ImageService` in parallel

**1.2 Centralized Logging Factory**
```
Tools: mcp_serena_create_text_file → mcp_serena_replace_content (multi-file)
```
- Create `app/core/logging.py`
- Use `multi_replace_string_in_file` to update all 10 files simultaneously

**1.3 Health Check Manager**
```
Tools: mcp_serena_create_text_file → mcp_serena_find_referencing_symbols → mcp_serena_replace_symbol_body
```
- Create `app/core/health.py`
- Find all health_check references
- Update `main.py` to use centralized manager

---

### Multi-Tool Execution Strategy

#### Parallel Execution Groups

**Group A: Backend Refactoring (Independent)**
```python
# These can run in parallel - no dependencies
1. Create base HTTP client class
2. Create logging factory
3. Create health manager
4. Create response builder
```

**Group B: Service Refactoring (Sequential after Group A)**
```python
# Must wait for Group A, then can parallelize
1. Refactor OpenRouterService (extends BaseAsyncService)
2. Refactor CepoService (extends BaseAsyncService)
3. Refactor ImageService (extends BaseAsyncService)
```

**Group C: Frontend Enhancements (Independent)**
```typescript
// Can run in parallel with backend work
1. Add tier switcher component
2. Add retry button component
3. Add keyboard shortcuts hook
4. Add loading progress component
```

---

### Implementation Commands (Serena Tools)

#### Phase 1 Execution Script
```bash
# Step 1: Create new core modules (parallel)
mcp_serena_create_text_file: app/core/http_client.py
mcp_serena_create_text_file: app/core/logging.py  
mcp_serena_create_text_file: app/core/health.py
mcp_serena_create_text_file: app/core/response.py

# Step 2: Refactor services (parallel after step 1)
mcp_serena_replace_symbol_body: OpenRouterService (add inheritance)
mcp_serena_replace_symbol_body: CepoService (add inheritance)
mcp_serena_replace_symbol_body: ImageService (add inheritance)

# Step 3: Update imports (multi-file parallel)
mcp_serena_replace_content: mode=regex, pattern="logger = logging.getLogger.*"
  → Replace in all 10 files with: "from app.core.logging import get_logger; logger = get_logger(__name__)"
```

#### Phase 2 Execution Script
```bash
# Frontend enhancements (parallel)
mcp_serena_replace_content: gogga-frontend/src/app/page.tsx (add tier switcher)
mcp_serena_create_text_file: gogga-frontend/src/components/TierSwitcher.tsx
mcp_serena_create_text_file: gogga-frontend/src/components/RetryButton.tsx
mcp_serena_create_text_file: gogga-frontend/src/hooks/useKeyboardShortcuts.ts
```

---

### Multi-Tool Call Optimization

When implementing, use these patterns for efficiency:

#### Pattern 1: Parallel File Creation
```json
{
  "parallel_operations": [
    {"tool": "create_text_file", "path": "app/core/http_client.py"},
    {"tool": "create_text_file", "path": "app/core/logging.py"},
    {"tool": "create_text_file", "path": "app/core/health.py"}
  ]
}
```

#### Pattern 2: Multi-Replace for Bulk Updates
```json
{
  "tool": "multi_replace_string_in_file",
  "replacements": [
    {"file": "services/ai_service.py", "old": "logger = ...", "new": "..."},
    {"file": "services/cepo_service.py", "old": "logger = ...", "new": "..."},
    {"file": "services/openrouter_service.py", "old": "logger = ...", "new": "..."}
  ]
}
```

#### Pattern 3: Symbol-Based Refactoring
```json
{
  "sequence": [
    {"tool": "find_symbol", "name": "OpenRouterService", "depth": 1},
    {"tool": "replace_symbol_body", "target": "_get_client", "new_body": "..."},
    {"tool": "insert_before_symbol", "target": "OpenRouterService", "content": "from app.core.http_client import BaseAsyncService"}
  ]
}
```

---

### Dependency Graph for Tool Execution

```
┌─────────────────┐
│ Create Core     │
│ Modules (P)     │──────┐
└─────────────────┘      │
         │               │
         ▼               ▼
┌─────────────────┐  ┌─────────────────┐
│ Refactor        │  │ Create Frontend │
│ Services (S)    │  │ Components (P)  │
└─────────────────┘  └─────────────────┘
         │               │
         ▼               ▼
┌─────────────────┐  ┌─────────────────┐
│ Update Imports  │  │ Update Page.tsx │
│ (Multi-Replace) │  │ (Replace)       │
└─────────────────┘  └─────────────────┘
         │               │
         └───────┬───────┘
                 ▼
         ┌─────────────────┐
         │ Integration     │
         │ Testing         │
         └─────────────────┘

(P) = Parallel execution possible
(S) = Sequential execution required
```

---

### Tool Selection Guidelines

| Task Type | Recommended Tool | When to Use |
|-----------|------------------|-------------|
| New file | `create_text_file` | Creating modules, components |
| Symbol edit | `replace_symbol_body` | Changing function/class definitions |
| Bulk text | `multi_replace_string_in_file` | Updating patterns across many files |
| Single edit | `replace_content` | Targeted regex replacements |
| Add code | `insert_after_symbol` | Adding new methods to classes |
| Imports | `insert_before_symbol` | Adding imports at file top |
| Find refs | `find_referencing_symbols` | Before renaming/refactoring |
| Overview | `get_symbols_overview` | Understanding file structure |

---

### Execution Checkpoints

After each phase, verify with:
```bash
# Backend health check
curl -s http://localhost:8000/health | jq .

# Frontend build check
cd gogga-frontend && npm run build

# Python syntax check
python -m py_compile gogga-backend/app/core/*.py

# Run tests
cd gogga-backend && pytest tests/ -v
```
