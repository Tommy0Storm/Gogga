# Token Tracking System

## Overview
Token tracking has been implemented to display token usage in the header and persist it locally using RxDB (IndexedDB). Includes both token usage and tool usage analytics.

## Database Schema (RxDB - schemas.ts)

### TokenUsage Schema
```typescript
interface TokenUsageDoc {
  id: string;
  date: string;           // YYYY-MM-DD for daily aggregation
  tier: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costZar: number;
  requestCount: number;
  updatedAt: string;
}
```

### ToolUsage Schema (NEW - Dec 2025)
```typescript
interface ToolUsageDoc {
  id: string;             // date_toolName_tier composite key
  date: string;           // YYYY-MM-DD
  toolName: string;       // e.g., "generate_image", "search_web"
  tier: string;           // FREE, JIVE, JIGGA
  callCount: number;
  successCount: number;
  failureCount: number;
  totalExecutionTimeMs: number;
  avgExecutionTimeMs: number;
  updatedAt: string;
}
```

## Functions in db.ts

### Token Tracking
- `trackTokenUsage(tier, inputTokens, outputTokens, costZar)` - Records token usage, aggregated daily per tier
- `getTodayTokenUsage()` - Gets today's usage with per-tier breakdown
- `getTokenUsageHistory(days)` - Gets historical usage for specified number of days
- `getTotalTokenUsage()` - Gets all-time totals
- `getMonthlyTokenUsage()` - **NEW**: Gets current month totals with tier breakdown

### Tool Usage (NEW - Dec 2025)
- `trackToolUsage({ toolName, tier, success, executionTimeMs })` - Records tool calls with performance timing
- `getMostUsedTools(limit)` - Returns top N tools sorted by call count
- `getMonthlyToolUsage()` - Returns monthly tool stats with per-tool breakdown

## Hook: useTokenTracking.ts
Custom hook providing:
- `stats.today` - Today's usage by tier
- `stats.allTime` - All-time cumulative usage
- `stats.monthly` - **NEW**: Current month's usage with tier breakdown
- `toolStats.mostUsed` - **NEW**: Top tools by call count
- `toolStats.monthly` - **NEW**: Monthly tool usage breakdown
- `track(tier, inputTokens, outputTokens, costZar)` - Record token usage
- `refreshStats()` - Reload all stats
- `refreshToolStats()` - **NEW**: Reload tool stats
- `getHistory(days)` - Get historical token data

Utility functions:
- `formatTokenCount(tokens)` - Formats as 1.2K, 15.3K, 1.5M
- `formatCostZar(cost)` - Formats as R0.00

## Tool Tracking Integration (toolHandler.ts)
Tool calls are tracked with performance timing:
```typescript
const startTime = performance.now();
// ... tool execution ...
const executionTimeMs = Math.round(performance.now() - startTime);
await trackToolUsage({
  toolName: toolCall.name,
  tier: tier || 'free',
  success: result.success,
  executionTimeMs,
});
```

## Admin Panel Integration (Dec 2025)

### API Endpoint: /api/usage
- **GET**: Returns comprehensive usage stats
  - Period filtering: today, week, month, year, all
  - Token usage by tier
  - Tool usage with success rates
  - Provider breakdown
  - Daily trend (last 30 days)
- **POST**: Records tool usage events

### Dashboard: /usage
Features:
- Period selector (today/week/month/year/all)
- Auto-refresh toggle (30 second interval)
- **Ticker cards**: Total Tokens, Requests, Active Users, Est. Cost
- **Line chart**: Daily usage trend
- **Pie chart**: Usage by tier
- **Table**: Tool usage with success rate and avg duration
- **Bar chart**: Provider breakdown

## Backend Data
Backend returns tokens in `response.data.meta.tokens`:
- `input`: prompt tokens
- `output`: completion tokens
Also returns `cost_zar` for cost tracking.
