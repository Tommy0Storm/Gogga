# GOGGA UI Components Documentation

## Last Updated
December 2025

---

## GoggaSpinner Component

**Location**: `gogga-frontend/src/components/GoggaSpinner.tsx`

### Features
- SVG-based spinner with animated floating balls
- **Overlay mode**: Fully transparent 3D floating effect (no screen dimming)
- **Inline mode**: Standard inline spinner for loading states
- Float3d keyframe animation with 3-axis rotation

### Overlay Mode Styling
```tsx
// Transparent background with drop shadow for depth
style={{
  position: 'fixed',
  top: 0, left: 0,
  width: '100vw', height: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999,
  pointerEvents: 'none',
  background: 'transparent', // No dimming
  filter: 'drop-shadow(0 25px 50px rgba(0, 0, 0, 0.25))',
}}
```

### Animation
```css
@keyframes float3d {
  0%, 100% { transform: translateY(0) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1); }
  25% { transform: translateY(-15px) rotateX(10deg) rotateY(-5deg) rotateZ(3deg) scale(1.02); }
  50% { transform: translateY(-20px) rotateX(5deg) rotateY(10deg) rotateZ(-3deg) scale(1.05); }
  75% { transform: translateY(-10px) rotateX(-5deg) rotateY(-10deg) rotateZ(5deg) scale(1.03); }
}
```

---

## PDF Export System

**Location**: `gogga-frontend/src/lib/pdfExporter.ts`

### Premium-Only Feature
- Requires `userTier: 'jive' | 'jigga'`
- Free tier users see toast notification and function returns early

### Sovereign AI Branding
Every exported PDF includes:
- **Banner**: "GOGGA - Sovereign AI for South Africa" with ZA flag
- **Footer**: "Proudly South African AI • Generated from IndexedDB (RxDB)"
- **Disclaimer**: User responsibility notice
- **Monochrome theme**: Follows app design system

### Data Source
- Pulls messages directly from RxDB via `getSessionMessages(sessionId)`
- Falls back to passed `messages` array if RxDB returns empty

---

## Optimistic Messages System

**Location**: `gogga-frontend/src/hooks/useOptimisticMessages.ts`

### Current Implementation (Simplified)
- **Removed**: React 19 `useOptimistic` hook - caused stuck spinners
- **Now**: Pass-through hook - returns base messages directly
- **Reason**: `useOptimistic` didn't reconcile properly with async RxDB updates

### Before (Broken)
```tsx
// useOptimistic added messages that never got cleaned up
const [optimisticMessages, addOptimisticMessage] = useOptimistic(...)
```

### After (Fixed)
```tsx
// Simple pass-through, no optimistic state
export function useOptimisticMessages(baseMessages: Message[]): UseOptimisticMessagesReturn {
  return {
    optimisticMessages: baseMessages,
    addOptimisticMessage: () => {},
    updateOptimisticMessage: () => {},
    removeOptimisticMessage: () => {},
    clearAllOptimistic: () => {},
    hasPendingOptimistic: false,
  };
}
```

---

## ChatClient Error Handling

**Location**: `gogga-frontend/src/app/ChatClient.tsx`

### Error Message Persistence
- Errors now persisted to RxDB message history
- Uses `persistMessage()` with role `'error'`
- Ensures error context is preserved for debugging

### Send Flow
1. User message persisted to RxDB immediately
2. Streaming response processed
3. Assistant message persisted on completion
4. No optimistic additions - RxDB is source of truth

---

## RightSidePanel (December 2025)

**Location**: `gogga-frontend/src/components/RightSidePanel.tsx`

### Unified Slide-Out Panel
Three-tab vertical navigation from the right edge:
| Tab | Purpose | Access |
|-----|---------|--------|
| Docs | Session documents + RAG Store | All tiers |
| Tools | ToolShed with category filtering | All tiers (locked features for FREE) |
| Smart | GoggaSmart stats/skills | All tiers (upgrade teaser for FREE) |

### Tools Tab Features
- **Category Filter Pills**: All, Math & Finance, Charts, Images, Memory
- **Tool Cards**: Icon, name, description, example usage
- **Force Tool**: Click to force next message to use specific tool
- **Forced Tool Banner**: Shows active forced tool with clear button

### Smart Tab - FREE Tier Upgrade Teaser
- Hero gradient card with "GoggaSmart™" branding
- Feature list (Personal AI Memory, Learns From Feedback, Gets Smarter)
- "Upgrade to JIVE" CTA button with R49/month pricing

### Smart Tab - Paid Tier
- Stats grid: Active Skills, Total Feedback
- Skills list with weight scores and usage counts
- Reset skillbook functionality

---

## ChatClient Header Improvements (December 2025)

**Location**: `gogga-frontend/src/app/ChatClient.tsx`

### Token Counter Display
- **Prominent badge style**: Gradient amber/orange background
- **Two-line layout**: "TOKENS" label + bold count
- **Hover popup**: Today/All Time stats + Input/Output breakdown

### Copy Button Feedback
- Check icon appears after successful copy
- 2-second timeout before reverting to copy icon
- State: `copiedMessageId` tracks which message was copied

### AI Power Dropdown
- Shows current tier with description
- Menu items for FREE, JIVE, JIGGA tiers
- Links to upgrade page for locked tiers

### Chat Options Dropdown
- New Chat, History, Export options
- Replaces individual header buttons
- Opens ExportModal for export action

### Beta Badge
- "Beta v3" with Smile icon
- Friendly, approachable branding

---

## Test Files (December 2025)

**Full documentation**: `TESTS/ux-improvements-tests.md`

| Test File | Location | Tests |
|-----------|----------|-------|
| `RightSidePanel.test.tsx` | `src/components/__tests__/` | 20 |
| `ChatClientUX.test.tsx` | `src/app/__tests__/` | 6 |
| `toolshedStore.test.ts` | `src/lib/__tests__/` | 16 |
| **Total** | | **42** |

Run all tests:
```bash
cd gogga-frontend
npx vitest run src/lib/__tests__/toolshedStore.test.ts src/app/__tests__/ChatClientUX.test.tsx src/components/__tests__/RightSidePanel.test.tsx
```

---

## Related Components

| Component | Purpose |
|-----------|---------|
| `ExportModal.tsx` | PDF/text export UI with premium check |
| `MessageItem.tsx` | Individual message rendering |
| `ThinkingDisplay.tsx` | CePO thinking block display |
| `SessionBrowser.tsx` | Session management for premium users |
| `RightSidePanel.tsx` | Unified Docs/Tools/Smart panel |
| `AccountMenu.tsx` | User account dropdown |
