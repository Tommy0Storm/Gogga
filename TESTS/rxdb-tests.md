# RxDB Test Suite Documentation

> **Last Updated:** December 21, 2025
> **Total Tests:** 66 passing
> **Location:** `gogga-frontend/src/lib/rxdb/__tests__/`

## Test Files

### 1. `memoryStorage.test.ts` (15 tests)
Tests the in-memory storage layer for ephemeral data.

| Test Suite | Tests | Description |
|------------|-------|-------------|
| Database Initialization | 2 | Verify storage initializes and is idempotent |
| Active Session | 2 | Session state updates and retrieval |
| Embedding Cache | 4 | LRU cache with 500 item limit, stats, clearing |
| Pending Operations | 4 | Optimistic UI queue add/update/cleanup |
| App Settings | 3 | localStorage-backed settings persistence |

**Architecture Note:** This module was refactored from RxDB to pure JavaScript Maps/localStorage on December 21, 2025 to fix COL23 (16-collection limit) and DB8 (duplicate database) errors.

### 2. `rxdb.test.ts` (24 tests)
Tests core RxDB database operations.

| Test Suite | Tests | Description |
|------------|-------|-------------|
| Database Initialization | 2 | Singleton pattern, collection creation |
| Document CRUD | 5 | Create, read, update, delete operations |
| Vector Storage | 4 | Embedding storage and retrieval |
| Vector Search | 3 | Similarity search with threshold filtering |
| Pipeline Stats | 2 | Embedding pipeline status monitoring |
| Chat Sessions | 4 | Session lifecycle management |
| Offline Queue | 4 | Message queueing for offline support |

### 3. `advancedFeatures.test.ts` (27 tests)
Tests advanced RxDB features and utilities.

| Test Suite | Tests | Description |
|------------|-------|-------------|
| Cleanup Utilities | 8 | Collection cleanup, purging, maintenance |
| Vector Search Methods | 6 | Index-range, similarity, full-scan search |
| Schema Migration | 5 | Field add/remove/rename/transform |
| Population Refs | 4 | Cross-collection document relationships |
| Conflict Resolution | 4 | Timestamp-based merge strategies |

## Running Tests

```bash
# Run all RxDB tests
cd gogga-frontend
pnpm vitest run src/lib/rxdb/__tests__/

# Run specific test file
pnpm vitest run src/lib/rxdb/__tests__/memoryStorage.test.ts

# Run with coverage
pnpm vitest run src/lib/rxdb/__tests__/ --coverage

# Run in watch mode
pnpm vitest src/lib/rxdb/__tests__/
```

## Test Configuration

Tests use Vitest with the following setup:
- **Environment:** jsdom (browser simulation)
- **Mocking:** fake-indexeddb for IndexedDB simulation
- **Timeout:** 30 seconds for async operations

## Key Test Patterns

### Database Cleanup
```typescript
beforeAll(async () => {
  await destroyMemoryDatabase();
});

afterAll(async () => {
  await destroyMemoryDatabase();
});
```

### Async Operations
```typescript
it('should handle async operations', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

### Observable Testing
```typescript
it('should emit values', (done) => {
  const sub = observable$.subscribe(value => {
    expect(value).toBeDefined();
    sub.unsubscribe();
    done();
  });
});
```

## Related Documentation

- **Full RxDB Implementation:** `.serena/memories/rxdb_implementation.md`
- **Collection Limit Fix:** `docs/RXDB_COLLECTION_LIMIT_FIX.md`
- **Performance Utilities:** `gogga-frontend/src/lib/rxdb/performanceUtils.ts`
