# React 19.2 Features and Gogga Integration

## Overview
React 19.2 introduces critical performance and DX improvements for Gogga's chat application, building on React 19.0/19.1 with enhanced SSR, new hooks, and performance profiling tools.

**Current Version**: React 19.2.0 (package.json) ✅ UPGRADED
**Status**: All React 19.2 features available

### Latest Context7 Docs (December 2025)
- Activity: `import { unstable_Activity as Activity } from 'react'`
- useEffectEvent: `import { useEffectEvent } from 'react'` (experimental)
- Install experimental: `react@experimental react-dom@experimental eslint-plugin-react-hooks@experimental`

## Core React 19.2 Features

### 1. `<Activity />` Component ⭐ NEW
**Status**: Experimental in react@19.2.0
**Purpose**: Manage visibility and resource usage of UI sections

#### How It Works
```typescript
import { Activity } from 'react'

function DashboardTabs() {
  return (
    <>
      <Activity mode="visible">
        <ActiveTab />
      </Activity>
      
      <Activity mode="hidden">
        {/* Visually hidden via CSS */}
        {/* Effects unmounted, updates deferred */}
        {/* State preserved */}
        <InactiveTab />
      </Activity>
    </>
  )
}
```

**Modes**:
- `visible`: Normal rendering, effects mounted, updates immediate
- `hidden`: CSS hidden, effects unmounted, updates deferred to idle, state preserved

**Benefits for Gogga**:
- **Chat history panel**: Keep old sessions hidden but state-preserving
- **Multi-tab dashboard**: Hide inactive tabs without unmounting
- **RAG document browser**: Background panels stay ready
- **Performance**: Unmounted effects = no timers, subscriptions, network requests

**Implementation Opportunity**:
```typescript
// In ChatClient.tsx
<Activity mode={showHistory ? 'visible' : 'hidden'}>
  <HistoryPanel sessions={sessions} />
</Activity>

<Activity mode={ragSessionActive ? 'visible' : 'hidden'}>
  <RAGPanel documents={documents} />
</Activity>
```

**Estimated Impact**: 30-50% reduction in background CPU usage for multi-panel UIs

---

### 2. `useEffectEvent()` Hook ⭐ NEW
**Status**: Available in React 19.1+
**Purpose**: Stable event handlers that access latest props/state without dependency array issues

#### Problem It Solves
```typescript
// ❌ Old way: Stale closures or effect re-runs
function Chat({ userId, theme }) {
  useEffect(() => {
    // If theme changes, entire effect re-runs (websocket reconnect!)
    const socket = connectToChat(userId, theme)
    return () => socket.disconnect()
  }, [userId, theme]) // theme causes unnecessary reconnect
}

// ✅ New way: Stable function, latest values
function Chat({ userId, theme }) {
  const onMessage = useEffectEvent((msg) => {
    showNotification(msg, theme) // Always uses latest theme
  })
  
  useEffect(() => {
    const socket = connectToChat(userId)
    socket.on('message', onMessage) // Stable reference
    return () => socket.disconnect()
  }, [userId]) // Only reconnect when userId changes
}
```

#### Gogga Use Cases

**1. Chat WebSocket with Theme/Settings**
```typescript
// ChatClient.tsx
function ChatClient({ userId, userTier, theme }) {
  const onChatMessage = useEffectEvent((message) => {
    // Always uses latest userTier, theme
    addMessage(message)
    playNotificationSound(theme.soundEnabled)
  })
  
  useEffect(() => {
    const ws = new WebSocket(`wss://backend.gogga.ai/chat/${userId}`)
    ws.onmessage = (e) => onChatMessage(JSON.parse(e.data))
    return () => ws.close()
  }, [userId]) // Only reconnect on user change, not tier/theme
}
```

**2. Auto-save with Debounce**
```typescript
// useAutoSave.ts
function useAutoSave(data, saveEndpoint) {
  const onSave = useEffectEvent(async () => {
    await fetch(saveEndpoint, {
      method: 'POST',
      body: JSON.stringify(data) // Always latest data
    })
  })
  
  useEffect(() => {
    const timer = setInterval(onSave, 30000) // Auto-save every 30s
    return () => clearInterval(timer)
  }, []) // No dependencies! onSave is stable
}
```

**3. Analytics Tracking**
```typescript
// useAnalytics.ts
function useAnalytics(userId, sessionId) {
  const trackEvent = useEffectEvent((event) => {
    analytics.track(event, {
      userId,      // Latest userId
      sessionId,   // Latest sessionId
      timestamp: new Date()
    })
  })
  
  return trackEvent // Stable function for entire component tree
}
```

**Benefits**:
- ✅ Eliminates stale closure bugs
- ✅ Reduces unnecessary effect re-runs
- ✅ Cleaner code (no useCallback/useMemo wrapper hell)
- ✅ Better WebSocket/interval patterns

---

### 3. `cacheSignal` API ⭐ NEW
**Status**: Experimental (React Server Components)
**Purpose**: Automatic cancellation of server-side fetches

#### How It Works
```typescript
'use server'
import { cacheSignal } from 'react'

async function fetchUserData(userId: string) {
  'use cache'
  const signal = cacheSignal()
  
  const response = await fetch(`https://api.example.com/users/${userId}`, {
    signal // Automatically aborted if user navigates away
  })
  
  return response.json()
}
```

**Benefits**:
- Saves server resources (aborted requests stop processing)
- Reduces bandwidth waste
- Works with Next.js Server Actions

**Gogga Use Case**:
```typescript
// app/actions/chat.ts
'use server'
import { cacheSignal } from 'react'

export async function getRagContext(query: string, chatId: string) {
  'use cache'
  cacheTag(`rag-${chatId}`)
  
  const signal = cacheSignal()
  
  // If user navigates away, this request is aborted
  const response = await fetch(`${BACKEND_URL}/api/v1/rag/query`, {
    method: 'POST',
    signal,
    body: JSON.stringify({ query, chatId })
  })
  
  return response.json()
}
```

**Estimated Impact**: 20-30% reduction in wasted server-side fetch processing

---

### 4. Automatic Memoization (React Compiler) ⚡
**Status**: Stable in React 19.2
**Purpose**: Eliminate manual useMemo/useCallback

#### Before vs After
```typescript
// ❌ Manual memoization (React 18/19.0)
function ExpensiveComponent({ items, filter }) {
  const filtered = useMemo(() => {
    return items.filter(item => item.category === filter)
  }, [items, filter])
  
  const handleClick = useCallback((item) => {
    console.log('Clicked', item)
  }, [])
  
  return <List items={filtered} onClick={handleClick} />
}

// ✅ Automatic memoization (React Compiler)
function ExpensiveComponent({ items, filter }) {
  const filtered = items.filter(item => item.category === filter)
  
  const handleClick = (item) => {
    console.log('Clicked', item)
  }
  
  return <List items={filtered} onClick={handleClick} />
}
// Compiler automatically memoizes both!
```

**Enable in Gogga**:
```javascript
// next.config.js
module.exports = {
  experimental: {
    reactCompiler: true // Enable React Compiler
  }
}
```

**Benefits**:
- ✅ 50-70% reduction in useMemo/useCallback boilerplate
- ✅ Fewer bugs (no forgotten dependencies)
- ✅ Automatic optimization of all components

---

## React DOM / SSR Improvements

### 5. Partial Pre-rendering (PPR) ✅ IMPLEMENTED
**Status**: Already implemented in Next.js 16 config
**Location**: `gogga-frontend/next.config.js`

```javascript
const nextConfig = {
  cacheComponents: true // Next.js 16 PPR
}
```

**How It Works**:
1. Static shell (layout, header) pre-rendered → served instantly from CDN
2. Dynamic parts (user data, chat messages) streamed in later
3. Best of both: instant paint + dynamic content

**Already Active in Gogga** ✅

---

### 6. Batched Suspense Boundaries (SSR Fix) ⚡
**Status**: Automatic in React 19.2
**Purpose**: Smoother SSR experience

**Before (React 18/19.0)**:
```
[Loading] → [Header]
           ↓
[Header] → [Sidebar Loading]
           ↓
[Header + Sidebar] → [Content Loading]
```
One-by-one appearance (janky)

**After (React 19.2)**:
```
[Loading] → [Header + Sidebar + Content]
```
Batch reveal before first paint (smooth)

**Benefit for Gogga**: Smoother initial page load, especially on chat page with multiple Suspense boundaries (RAG panel, message list, sidebar)

---

### 7. Web Streams for Node.js ⚡
**Status**: Automatic in React 19.2
**Purpose**: Standard Web Streams API for SSR

```typescript
// Now available in Node.js environments
import { renderToReadableStream } from 'react-dom/server'

async function handleRequest(req: Request) {
  const stream = await renderToReadableStream(<App />, {
    signal: req.signal
  })
  
  return new Response(stream, {
    headers: { 'Content-Type': 'text/html' }
  })
}
```

**Already Works in Next.js 16** ✅

---

## Developer Experience Improvements

### 8. Performance Tracks in Chrome DevTools 🔍
**Status**: Available in React 19.2 + Chrome Canary
**Purpose**: Unprecedented visibility into React internals

#### New Tracks
1. **Scheduler Track**: Shows task priorities (blocking vs transition)
2. **Components Track**: Shows which components render, how long, which effects run

**How to Use**:
1. Open Chrome DevTools → Performance tab
2. Record interaction (e.g., send message in chat)
3. See React-specific tracks alongside browser tracks

**Example Analysis**:
```
Scheduler Track:
├─ Blocking Task: Input onChange (2ms)
├─ Transition: Message send (150ms)
│  ├─ ChatClient render (50ms)
│  ├─ MessageList render (80ms)
│  └─ RAG context fetch (20ms)
└─ Idle: Cleanup effects (5ms)

Components Track:
├─ ChatClient (50ms)
│  ├─ useOptimisticMessages (2ms)
│  ├─ useRAG (15ms)
│  └─ useChatHistory (3ms)
└─ MessageList (80ms)
    ├─ MessageBubble × 50 (60ms)
    └─ ScrollToBottom effect (20ms)
```

**Benefit**: Identify performance bottlenecks in Gogga chat (e.g., "MessageBubble takes 60ms to render 50 messages → virtualize!")

---

### 9. Updated `useId` Prefix ⚠️ BREAKING CHANGE
**Status**: Automatic in React 19.2
**Purpose**: CSS View Transitions + XML compatibility

**Change**:
- Old prefix: `:r1:`, `:r2:`
- New prefix: `_r1_`, `_r2_`

**Impact on Gogga**: Minimal
- IDs generated by `useId()` now use underscores
- Compatible with CSS `view-transition-name` property
- No action needed unless you have CSS selectors targeting `[id^=":r"]`

**Check**:
```bash
cd gogga-frontend
grep -r "\\[id\\^=\":r" src/  # Search for old ID selectors
```

---

### 10. Improved ESLint Plugin ⚡
**Status**: eslint-plugin-react-hooks v6
**Purpose**: Better linting for React 19 hooks

**New Rules**:
- ✅ Supports `useEffectEvent` (doesn't require in dependencies)
- ✅ Flat config format support
- ✅ Better `useOptimistic` / `useActionState` checks

**Upgrade**:
```json
// package.json
{
  "devDependencies": {
    "eslint-plugin-react-hooks": "^6.0.0"
  }
}
```

---

## Gogga-Specific Integration Plan

### Phase 1: useEffectEvent Migration (High Impact)
**Target Files**:
1. `ChatClient.tsx` - WebSocket message handling
2. `useRAG.ts` - Document embedding effects
3. `useChatHistory.ts` - Auto-save timer
4. `useLocation.ts` - Geolocation watch

**Example Migration**:
```typescript
// Before
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => {
    addMessage(JSON.parse(e.data))
    playSound(theme.soundEnabled) // Causes reconnect if theme changes!
  }
  return () => ws.close()
}, [url, theme.soundEnabled, addMessage])

// After
const onMessage = useEffectEvent((data) => {
  addMessage(data)
  playSound(theme.soundEnabled) // Always latest, no reconnect
})

useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = (e) => onMessage(JSON.parse(e.data))
  return () => ws.close()
}, [url]) // Only url in dependencies
```

**Estimated Impact**: 40% reduction in unnecessary WebSocket reconnections

---

### Phase 2: Activity Component (Medium Impact)
**Target Components**:
1. `ChatClient.tsx` - History panel
2. `RightSidePanel.tsx` - RAG/Documents panel
3. `AdminPanel.tsx` - Admin interface
4. `Dashboard` - Multiple tabs

**Example**:
```typescript
<div className="layout">
  <ChatMessages /> {/* Always visible */}
  
  <Activity mode={showHistory ? 'visible' : 'hidden'}>
    <HistoryPanel />
  </Activity>
  
  <Activity mode={showRAG ? 'visible' : 'hidden'}>
    <RAGPanel />
  </Activity>
</div>
```

**Estimated Impact**: 30% reduction in background CPU when panels hidden

---

### Phase 3: cacheSignal (Low Impact, Future)
**Target**: Server Actions in `app/actions/`
**Requirement**: Wait for React 19.2 stable
**Benefit**: Automatic request cancellation for server-side operations

---

### Phase 4: React Compiler (High Impact)
**Enable**:
```javascript
// next.config.js
module.exports = {
  experimental: {
    reactCompiler: true
  }
}
```

**Test**:
```bash
cd gogga-frontend
pnpm build  # Check for compiler warnings
```

**Estimated Impact**: 
- 10-15% faster renders
- 50% less useMemo/useCallback boilerplate

---

## Migration Checklist

### Immediate (React 19.1 → 19.2)
- [ ] Upgrade to React 19.2.0 when stable
- [ ] Update package.json: `react@^19.2.0`, `react-dom@^19.2.0`
- [ ] Test existing hooks (useOptimistic, useActionState, useTransition)

### Quick Wins (Week 1-2)
- [ ] Migrate WebSocket effects to `useEffectEvent` in ChatClient.tsx
- [ ] Migrate auto-save effects to `useEffectEvent` in useRAG.ts
- [ ] Enable React Compiler in next.config.js

### Medium Term (Week 3-4)
- [ ] Wrap hidden panels in `<Activity mode="hidden">`
- [ ] Add Performance Tracks profiling to CI/CD
- [ ] Audit and remove unnecessary useMemo/useCallback

### Long Term (Month 2+)
- [ ] Add `cacheSignal` to all Server Actions
- [ ] Implement concurrent stores for external state (if needed)
- [ ] Monitor Performance Tracks for regressions

---

## Performance Expectations

| Feature | Improvement | Affected Area |
|---------|-------------|---------------|
| useEffectEvent | 40% fewer effect re-runs | WebSocket, timers, analytics |
| Activity | 30-50% CPU reduction | Hidden panels |
| React Compiler | 10-15% faster renders | All components |
| cacheSignal | 20-30% less server waste | Server Actions |
| Batched Suspense | Smoother initial paint | SSR pages |
| Performance Tracks | 50% faster debugging | Dev experience |

**Overall Estimated Impact**: 20-30% performance improvement + 50% better DX

---

## Testing Strategy

### 1. useEffectEvent Testing
```typescript
// __tests__/useEffectEvent.test.tsx
test('event handler uses latest theme without effect re-run', () => {
  let effectRunCount = 0
  
  function TestComponent({ theme }) {
    const onEvent = useEffectEvent(() => {
      logTheme(theme) // Latest theme
    })
    
    useEffect(() => {
      effectRunCount++
      window.addEventListener('custom', onEvent)
      return () => window.removeEventListener('custom', onEvent)
    }, []) // No theme dependency
    
    return null
  }
  
  const { rerender } = render(<TestComponent theme="light" />)
  expect(effectRunCount).toBe(1)
  
  rerender(<TestComponent theme="dark" />)
  expect(effectRunCount).toBe(1) // Still 1! Effect didn't re-run
  
  window.dispatchEvent(new Event('custom'))
  expect(logTheme).toHaveBeenCalledWith('dark') // But uses latest theme
})
```

### 2. Activity Testing
```typescript
// __tests__/Activity.test.tsx
test('hidden mode unmounts effects', () => {
  let effectCleanupCalled = false
  
  function Panel() {
    useEffect(() => {
      return () => { effectCleanupCalled = true }
    }, [])
    return <div>Panel</div>
  }
  
  const { rerender } = render(
    <Activity mode="visible"><Panel /></Activity>
  )
  expect(effectCleanupCalled).toBe(false)
  
  rerender(<Activity mode="hidden"><Panel /></Activity>)
  expect(effectCleanupCalled).toBe(true) // Effect unmounted!
})
```

### 3. Performance Profiling
```typescript
// scripts/profile-chat.js
import { Profiler } from 'react'

<Profiler id="ChatClient" onRender={(id, phase, actualDuration) => {
  console.log(`${id} ${phase} took ${actualDuration}ms`)
}}>
  <ChatClient />
</Profiler>

// Expected after optimizations:
// ChatClient mount took 45ms (down from 65ms)
// ChatClient update took 12ms (down from 20ms)
```

---

## Breaking Changes

### 1. useId Prefix Change
**Impact**: Low
**Action**: Audit CSS selectors for `[id^=":r"]` patterns

### 2. Stricter Hook Rules
**Impact**: Medium
**Action**: Fix ESLint warnings with new react-hooks v6 plugin

### 3. Activity Requires Effects Cleanup
**Impact**: Medium
**Action**: Ensure all effects have proper cleanup (return function)

---

## Resources

### Official Docs
- React 19.2 Blog: https://react.dev/blog/2025/10/01/react-19-2
- Activity API: https://react.dev/reference/react/Activity
- useEffectEvent: https://react.dev/reference/react/useEffectEvent
- Performance Tracks: https://react.dev/reference/dev-tools/react-performance-tracks

### Gogga-Specific
- Current Hooks: `.serena/memories/tech_stack.md`
- Next.js 16: `.serena/memories/nextjs_16_features_chat_integration.md`
- TypeScript 5.9: `.serena/memories/typescript_5.7-5.9_implementation.md`

---

## Summary

React 19.2 brings critical tools for Gogga's performance:

**🎯 High Priority**:
1. `useEffectEvent` - Fix WebSocket/timer patterns (40% fewer re-runs)
2. React Compiler - Automatic optimization (10-15% faster)
3. Performance Tracks - Debug bottlenecks

**🎯 Medium Priority**:
4. `<Activity />` - Reduce background CPU (30-50%)
5. Upgrade to React 19.2 stable

**🎯 Low Priority (Future)**:
6. `cacheSignal` - Server-side request cancellation

**Total Expected Gain**: 20-30% performance + 50% better DX

**Risk Level**: Low (mostly additive features)
**Implementation Time**: 2-4 weeks for high-priority items
