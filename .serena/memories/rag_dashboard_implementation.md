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

### Recent Fixes (December 2024)

1. **Dashboard Embedding Quality Calculation Fix**
   - Location: `calculateEmbeddingQuality()` function in `DesktopDashboard.tsx`
   - OLD BUG: Used `vectors.length > docIndex ? 1 : 0` which gave 1/63 = 1.5% coverage
   - NEW FIX: Uses `doc.hasEmbeddings ? 100 : 0` for proper 100% when complete
   - Root cause: The `vectors` array was only for heatmap visualization (1 per doc), not actual chunks

2. **"No embeddings yet" Badge Logic Fix**
   - Added `hasAnyEmbeddings` variable that checks:
     - `embeddingStats?.totalEmbeddings > 0` (Dexie-stored metrics)
     - `documents.some(doc => doc.hasEmbeddings)` (document status)
     - `isRealVectors` (in-memory cache for visualization)
   - Applied to both OverviewTab and EmbeddingsTab
   - Key insight: `doc.hasEmbeddings` in Dexie is the source of truth, not in-memory cache

4. **Vector Magnitude Fix (Dec 5, 2025)**
   - Problem: Vector Info showed "Magnitude 0.0000" despite "Embedding Quality 100%"
   - Root cause: `embeddingsCache` is ephemeral (cleared on page refresh)
   - `getCachedVectors()` returned empty array on dashboard load
   - Fix: Added `reloadEmbeddingsForDashboard()` method to RagManager
   - Dashboard now regenerates embeddings on load when:
     - Cache is empty (`cachedVectors.vectors.length === 0`)
     - But docs have `hasEmbeddings=true` or `embeddingStatus='complete'`
   - Files modified: `ragManager.ts`, `useRagDashboard.ts`

3. **Embedding Pre-generation on Upload**
   - `useRAG.ts` now initializes semantic engine on first JIGGA upload
   - Embeddings generated immediately (not lazily on query)
   - Status updates from "pending" to "complete" after upload