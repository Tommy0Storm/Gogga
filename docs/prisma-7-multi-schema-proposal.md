# Prisma 7 Multi-Schema Proposal for GOGGA

## Status: 📋 PROPOSAL (Not Implemented)

This document outlines a potential multi-schema architecture for the GOGGA platform using Prisma 7's new capabilities.

---

## Current Architecture

```
Single SQLite Database (dev.db)
├── User
├── LoginToken
├── AuthLog
├── Subscription
├── CreditPurchase
├── ProcessedPayment
├── RecurringSchedule
├── Voucher
├── VoucherLog
├── AdminLog
└── SubscriptionEvent
```

All tables exist in a single SQLite file, shared between:
- **gogga-frontend** (primary user-facing app)
- **gogga-admin** (admin dashboard)

---

## Proposed Multi-Schema Architecture

### Option A: Logical Separation (Recommended for SQLite)

Since SQLite doesn't support true schemas like PostgreSQL, we would use **separate database files**:

```
┌─────────────────────────────────────────────────────────────────┐
│  identity.db (Auth & Identity)                                  │
│  ├── User                                                       │
│  ├── LoginToken                                                 │
│  └── AuthLog                                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  billing.db (Subscriptions & Payments)                          │
│  ├── Subscription                                               │
│  ├── CreditPurchase                                             │
│  ├── ProcessedPayment                                           │
│  ├── RecurringSchedule                                          │
│  └── SubscriptionEvent                                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  admin.db (Admin Panel Only)                                    │
│  ├── Voucher                                                    │
│  ├── VoucherLog                                                 │
│  └── AdminLog                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Option B: Single DB with Prisma Views (Current)

Keep single database but use Prisma 7 views for read-only aggregations:

```prisma
// Example: Add computed views for analytics
view SubscriptionStats {
  tier        String
  userCount   Int
  totalCredits Int
}
```

---

## Benefits of Multi-Schema

| Benefit | Impact |
|---------|--------|
| **Security Isolation** | Admin data separate from user data |
| **Backup Granularity** | Can backup billing data more frequently |
| **Performance** | Smaller files = faster queries per domain |
| **Disaster Recovery** | Can restore identity without billing |
| **Compliance** | POPIA: Separate PII from transaction logs |

## Drawbacks

| Drawback | Mitigation |
|----------|------------|
| **Cross-DB Queries** | Application-level joins required |
| **Transaction Complexity** | Cannot span multiple SQLite files |
| **Maintenance Overhead** | Multiple migrations to manage |
| **Prisma Complexity** | Need multiple PrismaClient instances |

---

## Implementation Steps (If Approved)

### Phase 1: Schema Separation

1. Create separate `schema-identity.prisma`, `schema-billing.prisma`, `schema-admin.prisma`
2. Update `prisma.config.ts` to use multi-schema configuration:

```typescript
// prisma.config.ts
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: {
    kind: 'multiple',
    schemas: [
      { schema: 'prisma/identity.prisma', datasource: { url: env('IDENTITY_DB_URL') } },
      { schema: 'prisma/billing.prisma', datasource: { url: env('BILLING_DB_URL') } },
      { schema: 'prisma/admin.prisma', datasource: { url: env('ADMIN_DB_URL') } },
    ],
  },
})
```

### Phase 2: Client Updates

Create domain-specific Prisma clients:

```typescript
// src/lib/prisma/identity.ts
export const identityDb = new PrismaClient({ adapter: identityAdapter })

// src/lib/prisma/billing.ts
export const billingDb = new PrismaClient({ adapter: billingAdapter })

// src/lib/prisma/admin.ts
export const adminDb = new PrismaClient({ adapter: adminAdapter })
```

### Phase 3: Migration

1. Export data from current unified database
2. Create new database files with proper tables
3. Import data into respective databases
4. Update all imports across codebase
5. Run comprehensive test suite

---

## Recommendation

**For GOGGA's current scale: DO NOT implement multi-schema.**

### Reasons:

1. **Scale**: Current user base doesn't require database-level separation
2. **Complexity**: SQLite works well as a single file for self-hosted deployments
3. **Risk**: Breaking changes to auth/subscription flows
4. **Docker**: Single DB file is easier to volume-mount and backup

### When to Reconsider:

- Database exceeds 1GB
- Need RBAC at database level
- Compliance audit requires data isolation
- Performance issues with large AuthLog table

---

## Alternative: Table-Level Prefixes

If logical grouping is desired without separate files, use table prefixes:

```prisma
model auth_User { ... }
model auth_LoginToken { ... }
model billing_Subscription { ... }
model admin_Voucher { ... }
```

This provides conceptual separation without the overhead of multi-database management.

---

## Conclusion

The current single-database architecture is appropriate for GOGGA's self-hosted model. 
Multi-schema can be revisited when scaling requirements change.

**Decision: Maintain current architecture. Proposal archived for future reference.**

---

*Document created: December 6, 2025*
*Last updated: December 6, 2025*
