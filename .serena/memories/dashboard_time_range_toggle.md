# Dashboard Time Range Toggle

## Feature Added: December 5, 2025

A global time range toggle has been added to the Dashboard header that allows users to switch between:
- **Today**: Shows stats for the current day only
- **7 Days**: Shows stats for the past 7 days

### Implementation Details

#### TimeRangeToggle Component
Located in `DesktopDashboard.tsx`:
```tsx
export type TimeRange = 'today' | '7days';

const TimeRangeToggle: React.FC<TimeRangeToggleProps> = ({ value, onChange }) => {
  // Pill-style toggle with Today / 7 Days buttons
};
```

#### Props Added to All Tabs
All dashboard tabs now receive `timeRange: TimeRange` prop:
- OverviewTab
- StorageTab
- EmbeddingsTab
- MemoryTab
- PerformanceTab
- LLMMonitor

#### LLMMonitor Time Range Support
The LLMMonitor component (`LLMMonitor.tsx`) has been updated to:
1. Accept `timeRange?: 'today' | '7days'` prop
2. Query Dexie's `tokenUsage` table filtered by date range:
   - `today`: `db.tokenUsage.where('date').equals(today)`
   - `7days`: `db.tokenUsage.where('date').aboveOrEqual(sevenDaysAgo)`
3. Display dynamic labels: "Tokens Today" vs "Tokens (7 Days)"

#### Toggle Location
The toggle appears in the dashboard header, between the page title and the refresh controls:
```
[Overview]  [Time: Today | 7 Days]  [Live/Paused]  [Refresh]
```

### Future Extensions
All tabs receive the `timeRange` prop but currently only LLMMonitor uses it.
Other tabs can be extended to filter by time range when needed.

### Dexie Tables Supporting Time Filtering
- `tokenUsage`: Has `date` column (YYYY-MM-DD format)
- `messages`: Has `timestamp` column
- `documents`: Has `createdAt` column
