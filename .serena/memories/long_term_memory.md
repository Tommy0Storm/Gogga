# GOGGA Long-Term Memory System

## Last Updated
December 6, 2025

## Overview
User-controlled memory persistence with source tracking. Distinguishes between user-created and AI-created memories.

## Key Files
- `gogga-frontend/src/lib/db.ts` - Database schema and memory functions
- `gogga-frontend/src/components/dashboard/MemoryManager.tsx` - UI component

## Schema (Version 7)
```typescript
interface MemoryContext {
  id?: number;
  title: string;
  content: string;
  category: 'personal' | 'project' | 'reference' | 'custom';
  source: 'user' | 'gogga';  // WHO created: user or AI
  isActive: boolean;
  priority: number;  // 1-10
  tokenCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Source Field
- `'user'`: Created by the user via UI (default)
- `'gogga'`: Created by the AI assistant

### Rules
- User can edit/delete ALL memories
- AI can only delete/modify memories it created (`source === 'gogga'`)
- Use `deleteGoggaMemory(id)` for AI-safe deletion

## API Functions
```typescript
// Create memory (default source='user')
await createMemory(title, content, category, priority, source);

// Delete any memory (user action)
await deleteMemory(id);

// Safe delete for AI (only gogga-created)
const success = await deleteGoggaMemory(id);

// Get by source
await getMemoriesBySource('user');  // User memories
await getMemoriesBySource('gogga'); // AI memories
```

## Stats
```typescript
const stats = await getMemoryStats();
// Returns: { total, active, totalTokens, byCategory, bySource }
// bySource: { user: number, gogga: number }
```

## UI Indicators
- User memories: Small user icon badge
- Gogga memories: "AI" badge with Bot icon
- Stats show "You / AI" split

## Limits
- MAX_MEMORIES: 20
- MAX_CONTENT_LENGTH: 10000 chars
- MAX_TOTAL_TOKENS: 4000

## JIGGA Only
Long-term memory is only available for JIGGA tier users. JIVE users see a locked preview.