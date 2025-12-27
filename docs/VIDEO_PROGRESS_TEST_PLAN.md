# VideoProgress Crash Fix - Test Plan

**Date:** 2025-06-13  
**Bug Report:** "waiting for video and then crashes, not good service"  
**Reporter:** mgt.f3r@gmail.com  
**URL:** https://192.168.0.130:3002/

## Root Cause Analysis

The crash occurred when users left the video generation page while polling was active. The component continued attempting to update state on an unmounted component, causing React errors and app instability.

## Changes Made

### 1. VideoProgress.tsx
- Added `isMountedRef` to track component mount state
- Added retry logic with `MAX_RETRIES=3` and `RETRY_DELAY_MS=2000`
- Added timeout warning after 10 minutes with cancel option
- Fixed cleanup in `useEffect` return function
- Added defensive null checks for `response.duration_seconds` and `response.prompt`

### 2. VideoStudio/index.tsx
- Added `VideoStudioErrorBoundary` class component
- Wrapped `VideoStudioInner` with error boundary
- Added reset mechanism with `resetKey` increment

### 3. RightSidePanel.tsx
- Added `MediaErrorBoundary` class component
- Wrapped `ImageStudio` and `VideoStudio` with error boundaries
- Added recovery UI with "Try Again" option

---

## Unit Test Cases

### VideoProgress Component

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| VP-001 | Component mounts and sets isMountedRef | `isMountedRef.current === true` | High |
| VP-002 | Component unmounts and sets isMountedRef | `isMountedRef.current === false` | High |
| VP-003 | Polling stops when unmounted | No state updates after unmount | Critical |
| VP-004 | Retry on first poll failure | Retries with delay, retryCount++ | High |
| VP-005 | Retry exhausted after 3 attempts | Shows error state with retry option | High |
| VP-006 | Manual retry resets retryCount | `retryCount === 0` after click | Medium |
| VP-007 | Timeout warning shows after 10 min | `isTimedOut === true`, warning visible | Medium |
| VP-008 | Cancel button on timeout calls onCancel | `onCancel()` invoked | Medium |
| VP-009 | Null duration_seconds uses fallback | `durationSeconds === 5` | Medium |
| VP-010 | Null prompt handled gracefully | No TypeError thrown | High |
| VP-011 | Progress bar reflects actual progress | Width matches progress state | Low |
| VP-012 | Shows retry count when retrying | "Retrying (1/3)..." visible | Low |

### VideoStudioErrorBoundary

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| EB-001 | Catches thrown error | Shows error UI, not crashed | Critical |
| EB-002 | Try Again resets error state | `hasError === false`, resetKey++ | High |
| EB-003 | Error message displayed | "Something went wrong" visible | Medium |
| EB-004 | Stack trace not exposed to user | No raw error in DOM | Medium |

### MediaErrorBoundary (RightSidePanel)

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| ME-001 | Catches ImageStudio error | Shows fallback, view reset option | High |
| ME-002 | Catches VideoStudio error | Shows fallback, view reset option | High |
| ME-003 | Reset navigates to home view | `setView('home')` called | Medium |
| ME-004 | Error boundary isolation | One studio error doesn't affect other | Medium |

---

## Integration Test Cases

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| INT-001 | Complete video generation flow | 1. Generate video 2. Wait for complete | Video displays, no errors |
| INT-002 | Cancel during generation | 1. Start generation 2. Click cancel | Returns to form, no crash |
| INT-003 | Navigate away during polling | 1. Start generation 2. Change tab | No errors in console |
| INT-004 | API returns error status | Mock `status: 'failed'` response | Error UI shown, retry available |
| INT-005 | Network failure during poll | Mock fetch rejection | Retry logic triggers |
| INT-006 | Timeout recovery | Wait 10+ minutes (mock) | Warning shown, cancel works |

---

## Manual Test Cases

### Critical Path Testing

1. **Happy Path - Video Generation**
   - Login as JIVE/JIGGA user
   - Navigate to Media → Video Studio
   - Enter prompt, submit
   - Wait for video to complete
   - Verify video plays correctly
   - Verify quota updated

2. **Crash Prevention - Navigation During Poll**
   - Start video generation
   - While "Generating..." is shown:
     - Click "Back to Media"
     - Switch to Documents tab
     - Close the panel entirely
   - Open console, verify no React errors

3. **Error Recovery - ErrorBoundary**
   - Temporarily add `throw new Error()` to VideoStudio
   - Navigate to Video Studio
   - Verify error fallback shows
   - Click "Try Again"
   - Verify component resets

4. **Timeout Handling**
   - Start video generation
   - Wait 10+ minutes (or modify `TIMEOUT_MS`)
   - Verify warning appears
   - Click "Cancel & Start Over"
   - Verify returns to form

5. **Retry Logic**
   - Mock API to return errors 3 times
   - Start video generation
   - Verify "Retrying (1/3)...", "(2/3)...", "(3/3)..."
   - Verify error state after 3 failures
   - Click "Try Again"
   - Verify retryCount resets

---

## Automated Test Implementation

### To add to `src/components/__tests__/VideoProgress.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock the API
vi.mock('@/lib/shared/api', () => ({
  getVideoStatus: vi.fn(),
}));

import { VideoProgress } from '../MediaCreator/VideoStudio/VideoProgress';
import { getVideoStatus } from '@/lib/shared/api';

describe('VideoProgress', () => {
  const mockJobId = 'test-job-123';
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not update state after unmount (VP-002, VP-003)', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    
    (getVideoStatus as vi.Mock).mockResolvedValue({
      status: 'processing',
      progress: 50,
      prompt: 'Test prompt',
    });

    const { unmount } = render(
      <VideoProgress 
        jobId={mockJobId}
        tier="jive"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Unmount immediately
    unmount();

    // Advance timers to trigger any pending state updates
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Should not have React state update warnings
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Can't perform a React state update")
    );
  });

  it('should retry on poll failure (VP-004, VP-005)', async () => {
    let callCount = 0;
    (getVideoStatus as vi.Mock).mockImplementation(() => {
      callCount++;
      if (callCount <= 3) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        status: 'processing',
        progress: 50,
      });
    });

    render(
      <VideoProgress 
        jobId={mockJobId}
        tier="jive"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Wait for initial call + 3 retries
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  it('should show timeout warning after configured duration (VP-007)', async () => {
    (getVideoStatus as vi.Mock).mockResolvedValue({
      status: 'processing',
      progress: 50,
    });

    render(
      <VideoProgress 
        jobId={mockJobId}
        tier="jive"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Advance past timeout (10 minutes)
    await act(async () => {
      vi.advanceTimersByTime(11 * 60 * 1000);
    });

    expect(screen.getByText(/taking longer than expected/i)).toBeInTheDocument();
  });

  it('should handle null duration_seconds (VP-009)', async () => {
    (getVideoStatus as vi.Mock).mockResolvedValue({
      status: 'completed',
      video_url: 'https://example.com/video.mp4',
      prompt: 'Test prompt',
      duration_seconds: null, // Null value
    });

    render(
      <VideoProgress 
        jobId={mockJobId}
        tier="jive"
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(3500);
    });

    // Should not throw, should use fallback
    expect(mockOnComplete).toHaveBeenCalled();
  });
});
```

---

## Coverage Requirements

| Area | Target | Current |
|------|--------|---------|
| VideoProgress.tsx | 80% | TBD |
| VideoStudio/index.tsx | 75% | TBD |
| RightSidePanel.tsx | 70% | ~70% |

---

## Sign-off

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing complete on JIVE tier
- [ ] Manual testing complete on JIGGA tier
- [ ] No console errors during video generation
- [ ] No console errors when navigating away
- [ ] Error boundaries catch and recover from crashes
- [ ] TypeScript compilation clean for modified files ✅ (verified 2025-06-13)

---

## Related Files

- `gogga-frontend/src/components/MediaCreator/VideoStudio/VideoProgress.tsx`
- `gogga-frontend/src/components/MediaCreator/VideoStudio/index.tsx`
- `gogga-frontend/src/components/RightSidePanel.tsx`
- `gogga-frontend/src/components/__tests__/MediaTabContent.test.tsx`
