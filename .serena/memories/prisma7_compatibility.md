# Prisma 7 Compatibility Guide

## CRITICAL: Relation Field Naming (Dec 2025)

Prisma 7 uses **PascalCase** for relation fields in `include` statements and property access.
This matches the **model names**, not camelCase.

### ❌ WRONG (Prisma 6 style - WILL CAUSE TYPESCRIPT ERRORS)
```typescript
// Include statement - lowercase
const user = await prisma.user.findUnique({
  where: { id },
  include: { subscription: true },  // ❌ WRONG
});

// Property access - lowercase
if (user.subscription) {  // ❌ WRONG
  console.log(user.subscription.tier);  // ❌ WRONG
}
```

### ✅ CORRECT (Prisma 7 style)
```typescript
// Include statement - PascalCase (matches model name)
const user = await prisma.user.findUnique({
  where: { id },
  include: { Subscription: true },  // ✅ CORRECT
});

// Property access - PascalCase
if (user.Subscription) {  // ✅ CORRECT
  console.log(user.Subscription.tier);  // ✅ CORRECT
}
```

## Common Relation Mappings

| Model | Schema Relation Field | Include/Access Name |
|-------|----------------------|---------------------|
| User → Subscription | `Subscription` | `include: { Subscription: true }` |
| Subscription → User | `User` | `include: { User: true }` |
| DebugSubmission → User | `User` | `include: { User: true }` |
| Usage → User | `User` | `include: { User: true }` |
| UsageSummary → User | `User` | `include: { User: true }` |

## Schema Reference Pattern

When the schema defines:
```prisma
model User {
  id            String        @id @default(cuid())
  Subscription  Subscription? // Relation field uses PascalCase
  Usage         Usage[]
}

model Subscription {
  id     String @id @default(cuid())
  userId String @unique
  User   User   @relation(fields: [userId], references: [id])
}
```

The **relation field name in the schema** (`Subscription`, `User`) is what you use in code.

## exactOptionalPropertyTypes Compatibility

When using `exactOptionalPropertyTypes: true` in tsconfig, optional properties 
cannot be assigned `undefined` directly unless the type includes `| undefined`.

### ❌ WRONG
```typescript
interface Status {
  metrics?: { latency: number };  // Cannot assign undefined
}
const s: Status = { metrics: undefined };  // ❌ ERROR
```

### ✅ CORRECT
```typescript
interface Status {
  metrics?: { latency: number } | undefined;  // Allows undefined
}
const s: Status = { metrics: undefined };  // ✅ OK
```

## Audit Trail Best Practices

For PricingAudit table:
- Use `previousValues` and `newValues` (not `oldValue`/`newValue`)
- Always JSON.stringify the values

```typescript
await prisma.pricingAudit.create({
  data: {
    tableName: 'ModelPricing',
    recordId: id,
    action: 'UPDATE',
    previousValues: JSON.stringify({ rate: oldRate }),  // ✅
    newValues: JSON.stringify({ rate: newRate }),        // ✅
    changedBy: 'admin@example.com',
  },
});
```

## Admin Panel Files Fixed (Dec 2025)

These files were updated for Prisma 7 compatibility:
- `src/app/api/users/route.ts` - User → Subscription relation
- `src/app/api/users/action/route.ts` - User → Subscription relation
- `src/app/api/subscriptions/action/route.ts` - Subscription → User relation
- `src/app/api/debug/[id]/route.ts` - DebugSubmission → User relation
- `src/app/api/tokens/exchange/route.ts` - PricingAudit field names
- `src/app/api/tokens/features/route.ts` - FeatureCost + PricingAudit fields
- `src/app/api/tokens/models/route.ts` - PricingAudit field names
- `src/app/api/services/route.ts` - exactOptionalPropertyTypes fix
- `src/app/api/logs/route.ts` - exactOptionalPropertyTypes fix
