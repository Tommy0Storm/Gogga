# Token Tracking System

## Overview
Token tracking has been implemented to display token usage in the header and persist it locally using Dexie.js (IndexedDB).

## Database Schema (db.ts)
Added `TokenUsage` interface:
```typescript
interface TokenUsage {
  id?: number;
  date: string;  // YYYY-MM-DD for daily aggregation
  tier: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costZar: number;
  requestCount: number;
  updatedAt: Date;
}
```

Database version upgraded to 3 with `tokenUsage` table.

## Functions Added to db.ts
- `trackTokenUsage(tier, inputTokens, outputTokens, costZar)` - Records token usage, aggregated daily per tier
- `getTodayTokenUsage()` - Gets today's usage with per-tier breakdown
- `getTokenUsageHistory(days)` - Gets historical usage for specified number of days
- `getTotalTokenUsage()` - Gets all-time totals

## Hook: useTokenTracking.ts
Custom hook providing:
- `stats.today` - Today's usage by tier
- `stats.allTime` - All-time cumulative usage
- `track(tier, inputTokens, outputTokens, costZar)` - Record usage
- `refreshStats()` - Reload stats
- `getHistory(days)` - Get historical data

Utility functions:
- `formatTokenCount(tokens)` - Formats as 1.2K, 15.3K, 1.5M
- `formatCostZar(cost)` - Formats as R0.00

## Integration in page.tsx
- Token tracking hook initialized
- Tokens tracked after each API response (from `data.meta.tokens`)
- Header displays all-time token count with Hash icon
- Tooltip shows today + all-time breakdown

## Backend Data
Backend returns tokens in `response.data.meta.tokens`:
- `input`: prompt tokens
- `output`: completion tokens
Also returns `cost_zar` for cost tracking.
