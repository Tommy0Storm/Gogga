# RAG Implementation Progress

## Status: Phases 1-8 + 14 Complete (Token Counting)

### Files Created

1. **`lib/rag/documentPool.ts`** - DocumentPoolManager singleton
   - Pool limits: 100 docs per user
   - Session activation/deactivation
   - Cleanup suggestions (LRU-based)
   - Uses `getDatabase()` from `rxdb/database.ts`

2. **`lib/rag/sessionContext.ts`** - SessionContextManager 
   - Per-session RAG context
   - Token budgets per tier:
     - FREE: 8K total (no RAG)
     - JIVE: 16K total (3K RAG)
     - JIGGA: 24K total (6K RAG)
   - Mode: 'analysis' (default) or 'authoritative' (strict citation)

3. **`lib/rag/deletionService.ts`** - Cascade deletion
   - Deletes doc → chunks → embeddings
   - Session activation/deactivation helpers
   - Orphaned document cleanup

4. **`lib/rag/index.ts`** - Central exports
   - Re-exports all RAG modules
   - Type exports: Tier, RagMode, TierConfig

5. **`components/rag/RAGUploadButton.tsx`** - Persistent RAG store upload
   - FREE: Shows upgrade prompt
   - JIVE: 1 doc enticement
   - JIGGA: Full 200 docs

6. **`components/rag/SessionDocUpload.tsx`** - Session doc upload (paperclip)
   - Compact mode for inline use
   - Drop zone for full UI
   - All tiers can upload session docs

7. **`components/rag/index.ts`** - Component exports

### Pre-existing Files (Reviewed, No Changes Needed)

- `lib/embeddingEngine.ts` - Transformers.js pipeline (Xenova/e5-small-v2)
- `lib/ragManager.ts` - RagManager class
- `lib/rxdb/embeddingPipeline.ts` - Background embedding with progress
- `lib/rag/invariants.ts` - Runtime assertions
- `hooks/useRAG.ts` - Comprehensive React hook (802 lines)

### Key Architecture Decisions

1. **Two Upload Mechanisms**:
   - 📎 Paperclip: Session docs (ephemeral)
   - 📚 RAG Button: Persistent store

2. **Session Scoping**:
   - Documents belong to USER pool
   - Sessions BORROW documents via `activeSessions[]`
   - NEVER filter by `originSessionId` for RAG retrieval

3. **Tier Limits**:
   - FREE: 1 session doc, 2MB, no RAG store
   - JIVE: 10 session docs, 50MB + 1 RAG doc enticement
   - JIGGA: 10 session docs, 50MB + 200 RAG docs, 250MB

4. **Database Access**:
   - Import `getDatabase` from `../rxdb/database`
   - Collection names: `vectorEmbeddings`, `documentChunks`, `documents`
   - Use `db.collections.X` pattern

### Phase 2 Completed

### RightSidePanel Integration
- Updated `DocumentsTabContent` with Session/RAG toggle tabs
- Added `RAGUploadButton` integration in RAG Store section
- Added Clear All RAG button with confirmation dialog (JIGGA only)
- Added new props: `ragDocuments`, `onRAGUpload`, `onRAGRemove`, `onClearAllRAG`

### Files Modified
- `components/RightSidePanel.tsx` - Split Documents tab into Session (📎) and RAG Store (📚) sections
- `hooks/useRAG.ts` - Fixed RagMode type mismatch with getTierConfig

### TypeScript Status
- All new RAG files compile clean ✅
- Pre-existing test file (`rag.test.ts`) has outdated mock data (not related to new code)

## Phase 6-8: UI Components Complete

### Created Components
- `DragDropZone.tsx` - Animated drag-and-drop upload with validation
- `ModelLoadingProgress.tsx` - E5 model loading indicator
- `RAGActivityIndicator.tsx` - Pulse animation during search
- `ChunkVisualization.tsx` - Expandable source citations with confidence badges
- `StorageMeter.tsx` - Document/storage usage visualization
- `DocumentPoolModal.tsx` - Cross-session document selection (JIGGA)
- `RAGDebugPanel.tsx` - Token budget visualization

### Utilities Created
- `lib/utils.ts` - cn() utility (clsx + tailwind-merge)

### Auth Integration
- `DocumentManager.tsx` - Uses `useSession()` for real userId

## Phase 14: Token Counting Complete

### Created Files
1. **`lib/tokenizer.ts`** - Client-side token counting with gpt-tokenizer
   - `countTokens()` - Basic token counting
   - `countTokensWithLimit()` - Check against specific limit
   - `isWithinBudget()` - Check against tier budget category
   - `estimateTokens()` - Estimate with ZAR cost calculation
   - `canSendMessage()` - Pre-flight check for volatile budget
   - `calculateContextUsage()` - Total context breakdown
   - `formatTokenCount()` - Display formatting (e.g., "1.5K")
   - Exports `TOKEN_BUDGETS` with tier allocations

2. **`components/rag/TokenCounter.tsx`** - UI components
   - `TokenCounter` - Full counter with bar and cost estimate
   - `TokenCounterInline` - Minimal inline counter
   - `CanSendIndicator` - Pre-send validation warning

3. **`lib/__tests__/tokenizer.test.ts`** - 19 tests (all passing)

### Token Budget Allocation (Synchronized)
```typescript
TOKEN_BUDGETS = {
  free: { systemPrompt: 500, state: 1000, sessionDoc: 2000, rag: 0, volatile: 4000, response: 4000, total: 11500 },
  jive: { systemPrompt: 1000, state: 2000, sessionDoc: 4000, rag: 3000, volatile: 6000, response: 5000, total: 21000 },
  jigga: { systemPrompt: 1500, state: 3000, sessionDoc: 4000, rag: 6000, volatile: 8000, response: 8000, total: 30500 },
}
```

### Pricing (ZAR per 1M tokens)
- Cerebras (JIVE/JIGGA): R0.10 input, R0.40 output
- OpenRouter FREE: R0.00
- OpenRouter 235B: R1.50 input, R2.00 output

## Phase 15: Token Counting (Backend) Complete

### Updated Files

1. **`gogga-backend/app/config.py`** - Updated pricing constants
   - Cerebras Qwen 32B: $0.10 input, $0.10 output per 1M tokens
   - OpenRouter Qwen 235B: $0.80 input, $1.10 output per 1M tokens
   - Added `OPTILLM_BASIC_MULTIPLIER`: 1.1
   - Added `OPTILLM_STANDARD_MULTIPLIER`: 1.3
   - Added `OPTILLM_ADVANCED_MULTIPLIER`: 1.5

2. **`gogga-backend/app/services/cost_tracker.py`** - Enhanced `track_usage()`
   - New params: `optillm_level`, `reasoning_tokens`
   - Applies OptiLLM multiplier to output tokens
   - Returns `adjusted_output_tokens` in breakdown
   - Persists to frontend API with new fields

3. **`gogga-frontend/prisma/schema.prisma`** - Updated Usage model
   - Added `adjustedCompletionTokens Int?`
   - Added `reasoningTokens Int?`
   - Added `optillmLevel String?`
   - Added `optillmMultiplier Float?`

4. **`gogga-frontend/src/app/api/usage/log/route.ts`** - Updated endpoint
   - Synchronized pricing with backend
   - Accepts new OptiLLM fields
   - Uses input/output separate pricing calculation

5. **`gogga-frontend/src/lib/tokenizer.ts`** - Updated frontend pricing
   - Changed from ZAR to USD base (converted to ZAR for display)
   - Added `ZAR_USD_RATE = 18.50`
   - Added `TOKEN_PRICING_USD` (synced with backend)
   - Added `OPTILLM_MULTIPLIERS` constant

### Remaining Phases

### Phase 16-18: Admin Panel & Dynamic Pricing
- ModelPricing table for dynamic rates
- FeatureCost and ExchangeRate tables
- Admin panel token tab
- Dynamic pricing integration

### E2E Testing
- Full flow tests for RAG upload, embedding, retrieval