# Next.js 16 Caching APIs Reference

## Overview
Next.js 16 introduces explicit caching with the `'use cache'` directive and three functions for cache management:
- `cacheTag()`: Mark cached data with tags
- `updateTag()`: Immediately expire cache (read-your-own-writes)
- `revalidateTag()`: Eventually expire cache (stale-while-revalidate)

## Core API Reference

### 1. `'use cache'` Directive
**Location**: Top of async functions (Server Components, Server Actions, Route Handlers)

```typescript
async function getData(id: string) {
  'use cache'
  cacheTag('posts', `post-${id}`)
  
  const data = await fetch(`https://api.example.com/posts/${id}`)
  return data.json()
}
```

**Rules**:
- ✅ Can be used in Server Components
- ✅ Can be used in standalone async functions
- ✅ Works with Route Handlers
- ❌ Cannot be used in Client Components
- ❌ Must be first statement (like 'use server')

### 2. `cacheTag()`
**Purpose**: Associate tags with cached data for targeted invalidation

```typescript
import { cacheTag } from 'next/cache'

async function getUser(userId: string) {
  'use cache'
  cacheTag('users', `user-${userId}`, `profile-${userId}`)
  
  const user = await db.users.findUnique({ where: { id: userId } })
  return user
}
```

**Signature**:
```typescript
function cacheTag(...tags: string[]): void
```

**Best Practices**:
- Use hierarchical tags: `users`, `user-${id}`, `user-${id}-profile`
- Multiple tags allow fine-grained invalidation
- Tag naming convention: `{resource}-{id}-{scope}`

### 3. `updateTag()`
**Purpose**: Immediately expire and refresh cache (read-your-own-writes semantics)

```typescript
'use server'
import { updateTag } from 'next/cache'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string
  
  await db.posts.create({ data: { title, content } })
  
  // Immediate cache expiration + client router refresh
  updateTag('posts')
  
  // Can invalidate multiple tags
  updateTag('posts', 'homepage', 'feed')
}
```

**Signature**:
```typescript
function updateTag(...tags: string[]): void
```

**Key Characteristics**:
- ⚡ **Immediate**: Expires cache AND refreshes client router
- 🔒 **Server Action only**: Throws error if used in Route Handlers
- 📝 **Read-your-own-writes**: User sees their changes instantly
- 🔄 **Synchronous**: Blocks until cache invalidated

**Use Cases**:
- User profile updates
- Form submissions where user expects instant feedback
- Message sending in chat applications
- Settings changes

**Error Handling**:
```typescript
// ❌ This will throw an error
export async function POST(request: Request) {
  await updateData()
  updateTag('data') // ERROR: Can only be called in Server Actions
}

// ✅ Correct: Use in Server Action
'use server'
export async function updateData() {
  await db.update()
  updateTag('data') // Works correctly
}
```

### 4. `revalidateTag()`
**Purpose**: Eventually expire cache (stale-while-revalidate)

```typescript
'use server'
import { revalidateTag } from 'next/cache'

export async function syncDataFromBackend() {
  await fetch('https://backend.example.com/sync')
  
  // Stale-while-revalidate: Serve cached version, revalidate in background
  revalidateTag('posts', 'max')
}
```

**Signature**:
```typescript
function revalidateTag(tag: string, profile?: 'min' | 'max'): void
```

**Parameters**:
- `tag`: Cache tag to invalidate
- `profile`: Revalidation profile
  - `'max'`: Maximum stale time (default)
  - `'min'`: Minimum stale time

**Key Characteristics**:
- ⏱️ **Eventual**: Cache expires asynchronously
- 📡 **Works everywhere**: Server Actions, Route Handlers, middleware
- 🔄 **Stale-while-revalidate**: Serve old data while fetching new
- 🚀 **Non-blocking**: Returns immediately

**Use Cases**:
- Background data synchronization
- Non-critical updates (analytics, view counts)
- Webhook handlers
- Scheduled jobs

**Comparison with `updateTag()`**:
```typescript
// User creates a post and expects to see it immediately
'use server'
export async function createPost(formData: FormData) {
  await db.posts.create({ data: extractData(formData) })
  updateTag('posts') // ✅ Immediate feedback
}

// Background job syncs view counts from analytics
'use server'
export async function syncViewCounts() {
  await analyticsApi.sync()
  revalidateTag('view-counts', 'max') // ✅ Eventual consistency
}
```

### 5. `refresh()`
**Purpose**: Refresh client router without cache invalidation

```typescript
'use server'
import { refresh } from 'next/cache'

export async function updateUserPreference(preference: string) {
  await db.preferences.update({ preference })
  
  // Refresh client router (re-render current page)
  refresh()
}
```

**Signature**:
```typescript
function refresh(): void
```

**Key Characteristics**:
- 🔄 **Client-only**: Refreshes React state, not cache
- ⚡ **Fast**: No network request, just re-render
- 🔒 **Server Action only**: Same restriction as `updateTag()`

**When to Use**:
- Component state needs refresh without cache invalidation
- URL parameters changed but page needs re-render
- Optimistic UI rollback after server error

**When NOT to Use**:
- If you need to invalidate cached data → use `updateTag()` or `revalidateTag()`
- If you want stale-while-revalidate → use `revalidateTag()`

## Migration from Next.js 15

### Old Pattern (Automatic Caching)
```typescript
// Next.js 15: Everything cached by default
export default async function Page() {
  const data = await fetch('https://api.example.com/data')
  return <div>{data.title}</div>
}

// Invalidation was unclear
export async function createData() {
  await db.create()
  revalidatePath('/') // Nuclear option: invalidate entire route
}
```

### New Pattern (Explicit Caching)
```typescript
// Next.js 16: Opt-in caching with tags
async function getData() {
  'use cache'
  cacheTag('data', 'homepage')
  
  const data = await fetch('https://api.example.com/data')
  return data.json()
}

export default async function Page() {
  const data = await getData()
  return <div>{data.title}</div>
}

// Targeted invalidation
'use server'
export async function createData() {
  await db.create()
  updateTag('data') // Only invalidate 'data' tag
}
```

## Gogga-Specific Patterns

### Pattern 1: Chat Message Caching
```typescript
// lib/chatCache.ts
'use cache'
export async function getMessages(chatId: string, userId: string) {
  cacheTag('messages', `chat-${chatId}`, `user-${userId}`)
  
  // Check Dexie first (client-side cache)
  const localMessages = await db.messages
    .where('chatId')
    .equals(chatId)
    .toArray()
  
  // Fallback to backend
  if (localMessages.length === 0) {
    const response = await fetch(`${process.env.BACKEND_URL}/api/v1/chat/${chatId}/messages`)
    return response.json()
  }
  
  return localMessages
}

// actions/chat.ts
'use server'
export async function sendMessage(chatId: string, content: string, userId: string) {
  // Save to backend
  await fetch(`${process.env.BACKEND_URL}/api/v1/chat`, {
    method: 'POST',
    body: JSON.stringify({ chatId, content, userId })
  })
  
  // Immediate invalidation for read-your-own-writes
  updateTag(`chat-${chatId}`, `user-${userId}`)
}
```

### Pattern 2: RAG Document Caching
```typescript
// lib/ragCache.ts
'use cache'
export async function getRagContext(query: string, chatId: string) {
  cacheTag('rag', `chat-${chatId}`, 'documents')
  
  const embeddings = await computeE5Embeddings(query)
  const results = await searchDexieDocuments(embeddings)
  
  return {
    documents: results,
    query,
    timestamp: new Date()
  }
}

// actions/documents.ts
'use server'
export async function uploadDocument(formData: FormData, chatId: string) {
  const file = formData.get('file') as File
  
  // Process document and store in Dexie
  await processAndStoreDocument(file, chatId)
  
  // Invalidate RAG cache for this chat
  updateTag(`chat-${chatId}`, 'documents')
}
```

### Pattern 3: Tier-Based Caching
```typescript
// lib/tierCache.ts
'use cache'
export async function getTierFeatures(userTier: 'FREE' | 'JIVE' | 'JIGGA') {
  cacheTag('tiers', `tier-${userTier}`)
  
  const features = {
    FREE: { imageGen: 50, ragDocs: 5, model: 'Llama 3.3 70B' },
    JIVE: { imageGen: 200, ragDocs: 5, model: 'Llama 3.1 8B + CePO' },
    JIGGA: { imageGen: 1000, ragDocs: 10, model: 'Qwen 3 32B' }
  }
  
  return features[userTier]
}

// actions/subscription.ts
'use server'
export async function upgradeSubscription(userId: string, newTier: string) {
  await db.subscriptions.update({ userId, tier: newTier })
  
  // Invalidate user's tier cache
  updateTag(`tier-${newTier}`, `user-${userId}`)
}
```

### Pattern 4: Authentication State Caching
```typescript
// lib/authCache.ts
'use cache'
export async function getSession(userId: string) {
  cacheTag('auth', `session-${userId}`)
  
  const session = await db.sessions.findUnique({
    where: { userId }
  })
  
  return session
}

// actions/auth.ts
'use server'
export async function logout(userId: string) {
  await db.sessions.delete({ where: { userId } })
  
  // Immediate invalidation for security
  updateTag(`session-${userId}`, 'auth')
}
```

## Performance Optimization Tips

### 1. Hierarchical Tagging
```typescript
// ✅ Good: Hierarchical tags allow granular invalidation
'use cache'
cacheTag('users', `user-${userId}`, `user-${userId}-profile`)

// Can invalidate just profile
updateTag(`user-${userId}-profile`)

// Or invalidate all user data
updateTag(`user-${userId}`)

// Or invalidate all users
updateTag('users')
```

### 2. Avoid Over-Invalidation
```typescript
// ❌ Bad: Invalidates entire chat app
updateTag('messages')

// ✅ Good: Only invalidate specific chat
updateTag(`chat-${chatId}`)
```

### 3. Batch Tag Updates
```typescript
// ❌ Bad: Multiple separate calls
updateTag('posts')
updateTag('homepage')
updateTag('feed')

// ✅ Good: Single call with multiple tags
updateTag('posts', 'homepage', 'feed')
```

### 4. Use `revalidateTag` for Background Updates
```typescript
// ❌ Bad: Blocking update for non-critical data
'use server'
export async function syncAnalytics() {
  await analyticsApi.sync()
  updateTag('analytics') // Blocks user request
}

// ✅ Good: Non-blocking eventual consistency
'use server'
export async function syncAnalytics() {
  await analyticsApi.sync()
  revalidateTag('analytics', 'max') // Returns immediately
}
```

## Debugging & Monitoring

### Enable Cache Debugging
```javascript
// next.config.js
module.exports = {
  logging: {
    fetches: {
      fullUrl: true
    }
  },
  experimental: {
    logging: {
      level: 'verbose'
    }
  }
}
```

### Cache Hit Rate Monitoring
```typescript
// middleware.ts
import { NextResponse } from 'next/server'

export function middleware(request: Request) {
  const start = Date.now()
  
  const response = NextResponse.next()
  
  const duration = Date.now() - start
  const cacheStatus = response.headers.get('x-nextjs-cache')
  
  console.log({
    url: request.url,
    cacheStatus, // 'HIT', 'MISS', 'STALE'
    duration
  })
  
  return response
}
```

### Cache Tag Audit
```typescript
// scripts/audit-cache-tags.ts
import { db } from '@/lib/db'

async function auditCacheTags() {
  const users = await db.users.count()
  const chats = await db.chats.count()
  const messages = await db.messages.count()
  
  console.log(`
Cache Tag Inventory:
- users: ${users} tags
- chats: ${chats} tags
- messages: ${messages} tags
- Total potential tags: ${users + chats + messages}
  `)
}
```

## Common Pitfalls

### 1. Forgetting 'use cache' Directive
```typescript
// ❌ Wrong: cacheTag without 'use cache'
async function getData() {
  cacheTag('data') // This does nothing!
  return fetch('...')
}

// ✅ Correct
async function getData() {
  'use cache'
  cacheTag('data')
  return fetch('...')
}
```

### 2. Using updateTag in Route Handlers
```typescript
// ❌ Wrong: updateTag in Route Handler
export async function POST(request: Request) {
  await updateData()
  updateTag('data') // ERROR!
}

// ✅ Correct: Use Server Action
'use server'
export async function updateData() {
  await db.update()
  updateTag('data')
}

// Then call from Route Handler
export async function POST(request: Request) {
  await updateData() // Calls Server Action
  return new Response('OK')
}
```

### 3. Cache Tag Typos
```typescript
// ❌ Wrong: Inconsistent tag naming
'use cache'
cacheTag('user-profile') // Cached with this tag

updateTag('userProfile') // Different tag! Won't invalidate

// ✅ Correct: Use constants
const CACHE_TAGS = {
  USER_PROFILE: 'user-profile'
} as const

'use cache'
cacheTag(CACHE_TAGS.USER_PROFILE)

updateTag(CACHE_TAGS.USER_PROFILE) // Guaranteed match
```

### 4. Circular Dependencies
```typescript
// ❌ Wrong: Cached function calls another cached function
'use cache'
async function getCachedUser() {
  return getCachedProfile() // Also has 'use cache'
}

// ✅ Correct: Extract shared logic
async function fetchUserData() {
  return fetch('...')
}

'use cache'
async function getCachedUser() {
  cacheTag('user')
  return fetchUserData()
}
```

## Testing Cache Behavior

### Unit Test Example
```typescript
// __tests__/caching.test.ts
import { cacheTag, updateTag } from 'next/cache'
import { getMessages, sendMessage } from '@/lib/chat'

jest.mock('next/cache')

test('cache tags applied correctly', async () => {
  await getMessages('chat-123', 'user-456')
  
  expect(cacheTag).toHaveBeenCalledWith(
    'messages',
    'chat-chat-123',
    'user-user-456'
  )
})

test('updateTag called after message send', async () => {
  await sendMessage('chat-123', 'Hello', 'user-456')
  
  expect(updateTag).toHaveBeenCalledWith('chat-chat-123', 'user-user-456')
})
```

### Integration Test Example
```typescript
// e2e/cache-invalidation.spec.ts
import { test, expect } from '@playwright/test'

test('cache invalidated after form submission', async ({ page }) => {
  await page.goto('/chat/123')
  
  // Check initial cached response
  const initialResponse = await page.waitForResponse((resp) => 
    resp.url().includes('/api/messages')
  )
  expect(initialResponse.headers()['x-nextjs-cache']).toBe('HIT')
  
  // Submit form (triggers updateTag)
  await page.fill('[name="message"]', 'Test')
  await page.click('button[type="submit"]')
  
  // Verify cache miss on next request
  const updatedResponse = await page.waitForResponse((resp) => 
    resp.url().includes('/api/messages')
  )
  expect(updatedResponse.headers()['x-nextjs-cache']).toBe('MISS')
})
```

## References
- Next.js 16 Caching Documentation: https://nextjs.org/docs/app/building-your-application/caching
- Vercel Blog - Explicit Caching: https://nextjs.org/blog/next-16#explicit-caching
- React Server Components RFC: https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md
