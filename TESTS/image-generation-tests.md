# Image Generation Tests - January 2025

## Overview

Tests for the image generation feature fixes implemented in January 2025.

**Bug Report**: User on JIGGA tier asked Jive for a "festive season greeting from VCB-AI team" and after a long wait got "something went wrong" with no retry option.

**Root Cause**: 
1. `generateImage` function created bot message but never persisted it to chat
2. No error handling - failures were completely silent
3. No loading indicator during image generation
4. `enhancePrompt` function silently failed (console.error only)

---

## Fixes Applied

| File | Function | Fix Description |
|------|----------|-----------------|
| `ChatClient.tsx` | `generateImage()` | Added proper try/catch, bot message persistence, user-friendly error messages with retry button |
| `ChatClient.tsx` | `generateImage()` | Added tier-specific error guidance |
| `ChatClient.tsx` | `enhancePrompt()` | Changed from silent console.error to toast notification |
| `ChatClient.tsx` | render | Added `isGeneratingImage` loading indicator |

---

## Manual Test Cases

### TC-IMG-001: Image Generation Success Flow
**Preconditions**: User logged in on JIVE or JIGGA tier

**Steps**:
1. Click image generation button (camera icon)
2. Enter prompt: "A beautiful sunset over Table Mountain"
3. Click generate

**Expected Results**:
- ✅ Loading indicator appears ("Generating image...")
- ✅ Bot message appears with "Generating image..." placeholder
- ✅ Image appears in chat when complete
- ✅ Message persists (visible after page refresh)

---

### TC-IMG-002: Image Generation Error Handling
**Preconditions**: User logged in on JIVE or JIGGA tier, backend unavailable or network error simulated

**Steps**:
1. Click image generation button
2. Enter any prompt
3. Click generate (with backend down)

**Expected Results**:
- ✅ Error message appears in chat (not silent failure)
- ✅ Message includes "🖼️ Image Generation Failed"
- ✅ Message includes user-friendly explanation
- ✅ Retry button is displayed
- ✅ Error message persists in chat history

---

### TC-IMG-003: Image Generation Timeout
**Preconditions**: User logged in on JIGGA tier

**Steps**:
1. Click image generation button
2. Enter complex prompt
3. Wait for generation (Vertex AI Imagen can take up to 60s)

**Expected Results**:
- ✅ Loading indicator stays visible during wait
- ✅ User sees "Generating image..." message
- ✅ Image eventually appears (or timeout error with retry option)
- ✅ No "something went wrong" generic error

---

### TC-IMG-004: FREE Tier Image Limit
**Preconditions**: User on FREE tier with 50/month limit reached

**Steps**:
1. Click image generation button
2. Enter prompt

**Expected Results**:
- ✅ Clear error message about limit reached
- ✅ Suggestion to upgrade to JIVE/JIGGA for more images
- ✅ Retry button NOT shown (upgrade is the solution)

---

### TC-IMG-005: Enhance Prompt Error Handling
**Preconditions**: User has prompt text, backend unavailable

**Steps**:
1. Enter prompt text
2. Click "Enhance" button

**Expected Results**:
- ✅ Toast notification appears on failure (NOT silent)
- ✅ Toast shows "Failed to enhance prompt"
- ✅ Original prompt text preserved
- ✅ User can retry or proceed with original prompt

---

### TC-IMG-006: Loading State UI
**Preconditions**: User initiates image generation

**Steps**:
1. Start image generation
2. Observe UI during generation

**Expected Results**:
- ✅ Loading indicator visible in chat area
- ✅ Message shows "Generating image..." with animated dots
- ✅ UI remains responsive during generation
- ✅ Cancel button available (if implemented)

---

### TC-IMG-007: Message Persistence After Error
**Preconditions**: Image generation fails

**Steps**:
1. Trigger image generation failure
2. Note error message in chat
3. Refresh page

**Expected Results**:
- ✅ Error message persists in chat history
- ✅ Retry button still functional after refresh
- ✅ No duplicate error messages

---

## Tier-Specific Test Matrix

| Test | FREE | JIVE | JIGGA |
|------|------|------|-------|
| Image generation | Pollinations (50/mo) | Imagen 3.0 (200/mo) | Imagen 3.0 (1000/mo) |
| Error message | Generic + upgrade CTA | Retry button | Retry button |
| Loading indicator | ✅ | ✅ | ✅ |
| Enhance prompt | ✅ | ✅ | ✅ |

---

## Code Coverage

### Key Functions Modified

```typescript
// ChatClient.tsx - generateImage (lines 1519-1695)
- Added try/catch wrapper
- Added setIsGeneratingImage state management
- Added botMsg persistence with addMessage()
- Added user-friendly error messages with retry button
- Added tier-specific guidance

// ChatClient.tsx - enhancePrompt (lines 1499-1524)  
- Changed console.error to toast.error notification
- Added "Failed to enhance prompt" message

// ChatClient.tsx - render (lines 2987-3015)
- Added isGeneratingImage loading indicator
- Shows "Generating image..." with animated dots
```

---

## Regression Checks

- [ ] Normal text chat still works
- [ ] SSE streaming still works for JIVE/JIGGA
- [ ] Non-SSE responses work for FREE tier
- [ ] Image generation success flow unaffected
- [ ] Other premium features (voice, Smart) unaffected

---

## Related Documentation

- `docs/MEDIA_GENERATION_SYSTEM.md` - Image generation architecture
- `.serena/memories/tier_routing.md` - Tier-based provider routing
- `gogga-backend/app/api/v1/endpoints/images.py` - Backend image API

---

## Test Status

| Test Case | Status | Last Tested | Notes |
|-----------|--------|-------------|-------|
| TC-IMG-001 | 🟡 Pending | - | Needs manual verification |
| TC-IMG-002 | 🟡 Pending | - | Needs manual verification |
| TC-IMG-003 | 🟡 Pending | - | Needs manual verification |
| TC-IMG-004 | 🟡 Pending | - | Needs manual verification |
| TC-IMG-005 | 🟡 Pending | - | Needs manual verification |
| TC-IMG-006 | 🟡 Pending | - | Needs manual verification |
| TC-IMG-007 | 🟡 Pending | - | Needs manual verification |

**Legend**: ✅ Passed | ❌ Failed | 🟡 Pending
