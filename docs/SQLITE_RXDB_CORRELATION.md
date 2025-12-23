# SQLite ↔ RxDB Correlation Design Document

> **Created:** December 24, 2025
> **Purpose:** Document the dual-database architecture and data correlation patterns

## Architecture Overview

GOGGA uses a **dual-database architecture** with intentional separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT BROWSER                             │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                        RxDB (IndexedDB)                          │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │ │
│  │  │ chatSessions │ │   documents  │ │ tokenUsage   │ ...14 more   │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                               ▲                                       │
│                               │ localStorage.gogga_tier               │
│                               │ session.user.id                       │
└───────────────────────────────│───────────────────────────────────────┘
                                │
                     ┌──────────┴──────────┐
                     │   NextAuth Session  │
                     │   (JWT in cookie)   │
                     └──────────┬──────────┘
                                │
┌───────────────────────────────│───────────────────────────────────────┐
│                           SERVER                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     SQLite (Prisma 7)                            │ │
│  │  ┌──────┐ ┌──────────────┐ ┌───────┐ ┌──────────────┐           │ │
│  │  │ User │ │ Subscription │ │ Usage │ │ UsageSummary │ ...20 more │ │
│  │  └──────┘ └──────────────┘ └───────┘ └──────────────┘           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

## Data Ownership

### SQLite (Server-Side) - Authoritative for:
| Model | Purpose | Key Fields |
|-------|---------|------------|
| `User` | Identity | `id`, `email`, `isAdmin`, `isTester` |
| `Subscription` | Billing | `tier`, `credits`, `imagesUsed`, `imagesLimit` |
| `Usage` | Cost tracking | `promptTokens`, `completionTokens`, `costCents` |
| `UsageSummary` | Monthly rollup | `totalTokens`, `totalCostCents` |
| `LoginToken` | Passwordless auth | `token`, `email`, `expiresAt` |
| `AuthLog` | Audit trail | `email`, `action`, `ip` |
| `ProcessedPayment` | PayFast dedup | `pfPaymentId`, `amount` |
| `Voucher` | Credit grants | `code`, `value`, `redeemed` |
| `CreditAdjustment` | Audit trail | `amount`, `reason`, `adminEmail` |
| `UsageEvent` | Idempotent billing | `idempotencyKey`, `creditsDeducted` |

### RxDB (Client-Side) - Authoritative for:
| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `documents` | RAG uploads | `userId`, `originSessionId`, `content` |
| `documentChunks` | Search index | `documentId`, `chunkIndex`, `text` |
| `chatSessions` | Chat history | `id`, `tier`, `title`, `messageCount` |
| `chatMessages` | Messages | `sessionId`, `role`, `content` |
| `generatedImages` | Image storage | `prompt`, `fullImageData`, `tier` |
| `userPreferences` | Settings | `key`, `value` |
| `memoryContexts` | Long-term memory | `title`, `content`, `priority` |
| `goggaSmartSkills` | Learned skills | `skillId`, `content`, `helpful` |
| `tokenUsage` | Local dashboard | `date`, `tier`, `totalTokens` |
| `vectorEmbeddings` | E5 vectors | `embedding`, `idx0-idx4` |
| `iconGenerations` | Premium icons | `svgContent`, `prompt` |

## Correlation Points

### 1. User Identity
```
SQLite.User.id ──────────────────────────────────────────────────────►
                         │
                         ▼
              NextAuth JWT token.id
                         │
                         ▼
              session.user.id (client)
                         │
                   ┌─────┴─────┐
                   ▼           ▼
         RxDB.documents.userId   RxDB.goggaSmartSkills.userId
```

**Implementation:**
```typescript
// useGoggaSmart.ts:61
const userId = session?.user?.id || session?.user?.email || 'anonymous';

// DocumentManager.tsx:80
const userId = authSession?.user?.id ?? authSession?.user?.email ?? 'anonymous';
```

### 2. Tier Synchronization
```
SQLite.Subscription.tier ──► auth.ts session callback ──► session.user.tier
                                                                 │
                                                                 ▼
                                                   localStorage.gogga_tier
                                                                 │
                                                    ┌────────────┴────────────┐
                                                    ▼                         ▼
                                          ChatClient.tsx:tier        RxDB.chatSessions.tier
```

**Why localStorage?**
- PayFast ITN webhook can update tier before session refreshes
- localStorage provides immediate tier visibility after payment
- Session callback always fetches fresh tier from DB

**Implementation:**
```typescript
// auth.ts:197-207 - Session callback fetches fresh tier
const user = await prisma.user.findUnique({
  where: { id: token.id as string },
  include: { Subscription: true },
});
session.user.tier = user?.Subscription?.tier || 'FREE';

// ChatClient.tsx:528-562 - Tier loading with localStorage fallback
const rawTier = localStorage.getItem('gogga_tier');
const sessionTier = userTier?.toLowerCase().trim() as Tier;
```

### 3. Usage Tracking (Dual-Write)
```
Backend cost_tracker.py
        │
        ├──► POST /api/usage/log ──► SQLite.Usage (authoritative)
        │                       └──► SQLite.UsageSummary
        │
        └──► (return response)
                    │
                    ▼
            ChatClient receives cost
                    │
                    ▼
            RxDB.tokenUsage (local dashboard)
```

**Why dual-write?**
- SQLite: Authoritative billing, admin visibility, compliance
- RxDB: Offline-capable dashboard, instant local analytics

### 4. Session IDs
```
RxDB-only concept ─────────────────────────────────────────────────────►
                                                                         
generateSessionId() ──► "session-{base36_timestamp}-{random}"
        │
        ▼
RxDB.chatSessions.id
RxDB.chatMessages.sessionId  
RxDB.documents.originSessionId
```

**Note:** SQLite has no session concept. Uses `userId` + `conversationId` for request tracking.

## ID Generation (Consolidated Dec 24, 2025)

### Canonical Format
All IDs now use consistent format across both implementations:

```typescript
// Session IDs: session-{base36_timestamp}-{random}
// Example: "session-m5xk2j7-a1b2c3d4"

// Document IDs: {base36_timestamp}-{random}
// Example: "m5xk2j7-a1b2c3d4"
```

### Canonical Implementations
| Function | Canonical Location | Purpose |
|----------|-------------------|---------|
| `generateSessionId()` | `lib/db.ts:943` | Chat session IDs |
| `generateId()` | `lib/db.ts:58` | Document/message IDs |

The `lib/rxdb/database.ts` versions mirror these formats for consistency.

## Data NOT Correlated (By Design)

| RxDB Data | Why Not in SQLite |
|-----------|-------------------|
| Chat messages | Privacy - user content stays on device |
| RAG documents | Size - potentially large files |
| Generated images | Size - base64 image data |
| User preferences | Privacy - device-specific settings |
| Vector embeddings | Size/compute - 384-dim vectors |

| SQLite Data | Why Not in RxDB |
|-------------|-----------------|
| Credit balance | Security - must be server-authoritative |
| Admin flags | Security - server-side only |
| Payment tokens | Security - never expose to client |
| Auth logs | Compliance - server-side audit trail |

## Deprecated Fields

| Field | Location | Replacement | Notes |
|-------|----------|-------------|-------|
| `sessionId` | `DocumentDoc` | `originSessionId` | Legacy compatibility |
| `JIVE_MAX_DOCS_PER_SESSION` | `db.ts` | Session limits | JIVE no longer has RAG |

## Missing Email Notifications (TODOs)

These SQLite-triggered events need EmailJS implementation:

| Event | Location | Email Type |
|-------|----------|------------|
| Subscription cancelled | `payfast/notify/route.ts:379` | `subscription_cancelled` |
| Payment failed | `payfast/notify/route.ts:403` | `payment_failed` |
| Subscription expired | `subscription-reset/route.ts:134` | `subscription_expired` |
| Subscription cancelled | `subscription-reset/route.ts:163` | `subscription_cancelled` |
| Cancel confirmed | `subscription/cancel/route.ts:146` | `subscription_cancelled` |
| Credits low | `credits-warning/route.ts:56` | `credits_low` |

## Testing Considerations

### Integration Tests Needed
1. **Tier sync test**: Change tier in SQLite → verify localStorage updates
2. **Usage dual-write test**: Backend log → verify both DBs updated
3. **Session ID format test**: Verify consistent format across files
4. **User ID propagation test**: Login → verify RxDB uses correct userId

### Existing Tests
- `lib/rxdb/__tests__/rxdb.test.ts` - 24 tests
- `lib/rxdb/__tests__/advancedFeatures.test.ts` - 27 tests
- `lib/rxdb/__tests__/memoryStorage.test.ts` - 15 tests

## Future Considerations

### Potential Enhancements
1. **RxDB Replication**: Sync chat history to server for cross-device access
2. **Offline Queue**: Use `offlineQueue` collection for pending operations
3. **Server-side RAG**: Move embeddings to server for team sharing

### Scaling Concerns
- RxDB collection limit: 16 max (currently at 15)
- IndexedDB storage: ~100MB typical limit
- Consider server-side backup for premium users
