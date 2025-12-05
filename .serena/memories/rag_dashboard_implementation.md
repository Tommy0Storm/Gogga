# RAG Dashboard Implementation

## Status: ✅ FULLY IMPLEMENTED (December 2024)

---

## Dashboard Structure

### Components (`gogga-frontend/src/components/dashboard/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `index.tsx` | Barrel export | `RagDashboard` (main entry) |
| `DesktopDashboard.tsx` | Desktop layout with sidebar | `DesktopDashboard`, `DataFreshnessIndicator` |
| `MobileDashboard.tsx` | Mobile responsive layout | `MobileDashboard`, `MobileFreshnessIndicator`, `CollapsibleSection` |
| `Charts.tsx` | Recharts visualizations | `LatencyChart`, `StorageChart`, `QueryModePie`, `PerformanceChart`, `GaugeChart`, `ScoreHistogram`, `Sparkline` |
| `StatCard.tsx` | Stat display components | `StatCard`, `MetricCard`, `ProgressRing`, `StatusBadge`, `TierBadge`, `InfoRow` |
| `VectorHeatmap.tsx` | Vector visualizations | `VectorHeatmap`, `VectorPreview`, `SimilarityScore`, `VectorStats` |
| `DocumentManager.tsx` | Document CRUD | `DocumentManager`, `QuickDocList` |
| `MemoryManager.tsx` | Long-term memory CRUD | `MemoryManager` |
| `useRagDashboard.ts` | Data fetching hook | `useRagDashboard`, `useContextMemory`, `VectorData` |
| `types.ts` | TypeScript types | All dashboard interfaces |

---

## Tab Structure (DesktopDashboard)

1. **Overview** - Health gauge, quick stats, latency chart, storage chart
2. **Storage** - Dexie storage breakdown, session documents, size by table
3. **Embeddings** - Model status, vector heatmap, embedding stats (JIGGA only)
4. **Memory** - Long-term memory manager + session documents
5. **Performance** - Query stats, latency charts, score histogram

---

## Data Flow

```
useRagDashboard (hook)
  ├── fetchStorageStats() → Dexie db stats
  ├── fetchModelStatus() → RagManager state + metrics
  ├── fetchEmbeddingStats() → getRecentMetricsAsync() (Dexie)  ← ASYNC NOW
  ├── fetchRetrievalStats() → getModeStats(), getAggregatedMetrics()
  ├── fetchDocuments() → getAllDocuments()
  ├── fetchLatencyChartData() → getTimeSeriesMetrics()
  └── vectorData → ragManager.getCachedVectors()
```

## Metrics Persistence (December 5, 2025)

RAG metrics are now persisted to Dexie to survive page navigation:

- **Table**: `ragMetrics` (schema version 6)
- **Retention**: 3 days (automatic cleanup on startup)
- **Dashboard**: Uses `getRecentMetricsAsync()` for persistent data
- **Real-time**: Still uses `subscribeToMetrics()` for live updates

---

## Real-time Features

- **Auto-refresh**: 5-second interval (configurable)
- **Metrics subscription**: `subscribeToMetrics()` for live updates
- **Data Freshness Indicator**: Color-coded status
  - 🟢 Green: < 10 seconds (fresh)
  - 🟡 Yellow: 10-30 seconds (stale)
  - 🔴 Red: > 30 seconds (outdated)

---

## Tier Gating

| Feature | FREE | JIVE | JIGGA |
|---------|------|------|-------|
| Storage Stats | ✅ | ✅ | ✅ |
| Document List | ❌ | ✅ | ✅ |
| Embedding Stats | ❌ | ❌ | ✅ |
| Vector Heatmap | ❌ | ❌ | ✅ |
| Long-term Memory | ❌ | ❌ | ✅ |
| Performance Charts | ❌ | ✅ | ✅ |

---

## Color Palette (Monochrome)

```typescript
const COLORS = ['#1f1f1f', '#4a4a4a', '#7a7a7a', '#a0a0a0', '#c0c0c0'];
const PIE_COLORS = ['#2d2d2d', '#5a5a5a'];
// SA flag colors for accents:
// sa-green: #007A4D, sa-gold: #FFB612, sa-red: #DE3831
```

---

## Key Files

### Recent Fixes (Dec 2024)

1. **Embedding Pre-generation on Upload**
   - `useRAG.ts` now initializes semantic engine on first JIGGA upload
   - Embeddings generated immediately (not lazily on query)
   - Status updates from "pending" to "complete" after upload

2. **Chart Animations on First Mount Only**
   - All charts use `useAnimateOnMount()` hook
   - Animates on initial load (1 second duration)
   - Disables animation on 5-second refresh (no "video-like" effect)
   - Affects: LatencyChart, StorageChart, QueryModePie, PerformanceChart, ScoreHistogram, Sparkline, GaugeChart, BrowserLoadChart

3. **Document Delete Flow Fixed**
   - `DocumentManager.tsx` now uses `ragRemoveDocument()` instead of direct Dexie delete
   - `useRagDashboard.ts` `deleteDocument` also uses `ragRemoveDocument()`
   - Properly removes from FlexSearch index
   - Emits `document_removed` metric for dashboard updates
   - Added "Delete All" button with confirmation

4. **Real Vector Display**
   - Dashboard shows actual 384-dimension E5-small-v2 embeddings
   - Green "Real embeddings" badge indicates authentic data
   - VectorStats computes real magnitude/sparsity

5. **Complete Metrics System (Dec 2024)**
   - Added `cache_hit` / `cache_miss` metrics to `ensureEmbeddings()`
   - Added `error` metric on embedding generation failure
   - All metrics now emitted properly for dashboard consumption

---

## Complete Metrics Reference

### Metrics Emitted

| Metric Type | Location | Trigger | Data |
|-------------|----------|---------|------|
| `embedding_generated` | `ragManager.ts` | Embedding creation | chunkCount, dimension, latencyMs, filename |
| `retrieval` (basic) | `ragManager.ts` | Keyword search | mode, queryLength, docsRetrieved, latencyMs |
| `retrieval` (semantic) | `ragManager.ts` | Vector search | mode, chunksRetrieved, topScore, averageScore, latencyMs |
| `query` (document_added) | `rag.ts` | Doc upload | filename, size, chunkCount, mimeType |
| `query` (document_removed) | `rag.ts` | Doc delete | filename |
| `cache_hit` | `ragManager.ts` | Cache found | source, filename |
| `cache_miss` | `ragManager.ts` | Cache miss | source, filename |
| `error` | `ragManager.ts` | Embedding fails | operation, message, filename |

### Chart Data Sources

| Chart | Function | Metric Types |
|-------|----------|--------------|
| LatencyChart | getTimeSeriesMetrics() | retrieval |
| StorageChart | getStorageStats() | Dexie |
| QueryModePie | getModeStats() | retrieval |
| PerformanceChart | getTimeSeriesMetrics() | retrieval |
| ScoreHistogram | getScoreDistribution() | retrieval (semantic) |
| GaugeChart | Computed | Multiple |
| BrowserLoadChart | Browser API | performance.memory |
| VectorHeatmap | getCachedVectors() | Embeddings cache |