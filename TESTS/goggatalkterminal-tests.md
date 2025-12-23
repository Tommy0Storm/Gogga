# GoggaTalk Voice Modal Enhancement - Test Plan

**Date**: December 21, 2025  
**Version**: 2.1.0  
**Author**: GitHub Copilot  
**Location**: `/TESTS/goggatalkterminal-tests.md`

## Overview

This test plan covers the GoggaTalk voice chat interface enhancements including:
- HD quality sinewave audio visualizer
- Real-time audio amplitude visualization
- Voice activity indicator
- Transcript/logs display fixes
- Session recovery improvements

## Components Modified

| File | Purpose |
|------|---------|
| `gogga-frontend/src/components/AudioWaveVisualizer.tsx` | HD sinewave visualizer with real-time audio levels |
| `gogga-frontend/src/components/GoggaTalkTerminal.tsx` | Voice chat modal interface |
| `gogga-frontend/src/hooks/useGoggaTalkDirect.ts` | Gemini Live API hook with audio analysis |

## Changes Made

### 1. Audio Sinewave Visualizer (`AudioWaveVisualizer.tsx`)
- **NEW**: HD quality SVG-based sinewave animation
- **NEW**: Real-time audio amplitude via `audioLevel` prop (0-1 range)
- **NEW**: Voice activity indicator with pulsing dot
- Three states with distinct colors:
  - **White wave**: Gogga speaking (AI response)
  - **Blue wave**: User speaking (microphone active)
  - **Gray wave**: Idle/muted state
- CSS animations for smooth 60fps performance
- Multiple size variants: compact, standard, large

### 2. Audio Level Analysis (`useGoggaTalkDirect.ts`)
- **NEW**: `AnalyserNode` for input (user) audio
- **NEW**: `AnalyserNode` for output (Gogga) audio
- **NEW**: Exports `userAudioLevel` and `goggaAudioLevel` (0-1 range)
- Uses `requestAnimationFrame` for smooth level updates
- Proper cleanup on disconnect

### 3. Transcript vs Logs Display (`GoggaTalkTerminal.tsx`)
- **CHANGED**: `showLogs` now defaults to `false` (was `true`)
- **NEW**: `showActivityIndicator={true}` on visualizers
- **NEW**: `audioLevel` passed to visualizers
- Logs button now shows chevron indicator (up/down)
- Enhanced empty state when connected shows large visualizer

### 4. Session Recovery (`useGoggaTalkDirect.ts`)
- **FIXED**: Session handle no longer aggressively cleared during mid-turn
- Server sends `resumable: false` during active turns - now handled correctly
- Idle timeout detection (code 1001) with user-friendly message
- Improved debug logging for session state

---

## Test Cases

### TC-001: Audio Visualizer - Idle State
**Steps:**
1. Open GoggaTalk modal
2. Observe visualizer before connecting

**Expected:**
- Visualizer shows gray, subtle wave animation
- Low amplitude movement
- Voice activity indicator shows "Silent"

---

### TC-002: Audio Visualizer - User Speaking (Real-time Amplitude)
**Steps:**
1. Connect to GoggaTalk
2. Unmute microphone
3. Speak loudly then softly

**Expected:**
- Visualizer turns blue
- **Wave amplitude responds to voice volume in real-time**
- Loud speech = larger waves, quiet speech = smaller waves
- Voice activity indicator shows "Speaking" and pulses

---

### TC-003: Audio Visualizer - Gogga Speaking (Real-time Amplitude)
**Steps:**
1. Speak a question to Gogga
2. Wait for response

**Expected:**
- Visualizer turns white when Gogga responds
- **Wave amplitude follows Gogga's voice intensity**
- Voice activity indicator shows "Speaking" and pulses
- Smooth transition from user-speaking to gogga-speaking

---

### TC-004: Voice Activity Indicator
**Steps:**
1. Connect to GoggaTalk
2. Speak into microphone
3. Stop speaking but remain unmuted

**Expected:**
- Indicator dot pulses and shows "Speaking" when voice detected
- Indicator shows "Silent" during pauses
- Indicator color matches visualizer state (blue for user, white for Gogga)

---

### TC-005: Transcripts Default Display
**Steps:**
1. Open GoggaTalk modal
2. Connect and have a conversation

**Expected:**
- Chat transcripts visible by default
- Logs section hidden by default
- Logs button shows down-chevron (collapsed)

---

### TC-006: Logs Toggle
**Steps:**
1. Click "Logs" button to expand
2. Click again to collapse

**Expected:**
- Logs expand/collapse smoothly
- Chevron icon flips (up when expanded, down when collapsed)
- Debug logs visible when expanded

---

### TC-007: Session Resumption Handle Preservation
**Steps:**
1. Connect and have a conversation
2. Monitor console/logs for session handle updates

**Expected:**
- No "Session not resumable - cleared handle" during active conversation
- Handle updated when new handle received
- "Session temporarily non-resumable (mid-turn)" logged during turns

---

### TC-008: Idle Timeout Behavior
**Steps:**
1. Connect to GoggaTalk
2. Wait without speaking for ~30-60 seconds
3. Observe disconnect behavior

**Expected:**
- Friendly message: "Session timed out due to inactivity"
- No auto-reconnection attempts for idle timeouts
- Clean disconnect

---

### TC-009: Reconnection on Unexpected Disconnect
**Steps:**
1. Connect to GoggaTalk
2. Simulate network interruption (if possible)

**Expected:**
- Auto-reconnection attempts (up to 5)
- Exponential backoff between attempts
- Context preservation attempt on successful reconnect

---

### TC-010: Empty State with Visualizer
**Steps:**
1. Connect to GoggaTalk (no transcripts yet)
2. Observe empty state

**Expected:**
- Large visualizer (240x48) centered in empty state
- Real-time audio level responsive
- Voice activity indicator visible
- Clear instructions below visualizer
- Mute status correctly reflected

---

### TC-011: Multi-language Voice Chat
**Steps:**
1. Connect to GoggaTalk
2. Speak in Afrikaans, isiZulu, or other SA language

**Expected:**
- Transcription works for SA languages
- Gogga responds appropriately
- Visualizer colors correct

---

### TC-012: Audio Level Cleanup on Disconnect
**Steps:**
1. Connect to GoggaTalk
2. Speak (verify audio levels working)
3. Disconnect

**Expected:**
- `userAudioLevel` resets to 0
- `goggaAudioLevel` resets to 0
- AnalyserNodes properly disconnected
- Animation frame cancelled
- No memory leaks

---

## Sanity Checks

- [ ] No TypeScript errors in modified files
- [ ] No console errors on page load
- [ ] Modal opens/closes correctly
- [ ] All buttons responsive
- [ ] Microphone permission prompt works
- [ ] Screen sharing works (optional feature)
- [ ] Component cleanup on unmount

## Performance Verification

- [ ] Visualizer animation is smooth (60fps)
- [ ] Audio level updates are responsive (<50ms latency)
- [ ] No memory leaks on connect/disconnect cycles
- [ ] Audio contexts properly closed on disconnect
- [ ] AnalyserNodes properly cleaned up

## Browser Compatibility

Test on:
- [ ] Chrome (primary)
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Edge

## Code Quality Verification

- [x] No TypeScript errors
- [x] Consistent code style
- [x] Proper component documentation
- [x] Clean separation of concerns
- [x] No unused imports
- [x] Proper error handling
- [x] Audio analysers properly cleaned up

---

## Run Instructions

### Manual Testing
```bash
# Start frontend dev server
cd gogga-frontend && pnpm dev

# Open https://192.168.0.130:3000
# Click microphone icon to open GoggaTalk modal
# Run through test cases TC-001 to TC-018
```

### Related Files for Reference
- Component: `gogga-frontend/src/components/AudioWaveVisualizer.tsx`
- Terminal: `gogga-frontend/src/components/GoggaTalkTerminal.tsx`
- Hook: `gogga-frontend/src/hooks/useGoggaTalkDirect.ts`

---

## UX Audit Changes (December 23, 2025)

### Changes Made

#### 1. Improved Audio Level Sensitivity (`useGoggaTalkDirect.ts`)
- **CHANGED**: Normalization divisor from 128 to 48 for better voice level detection
- **NEW**: Power curve (0.7) applied to amplify mid-range voice levels
- **RESULT**: Wave now moves more visibly when speaking at normal volume

#### 2. Enhanced Wave Responsiveness (`AudioWaveVisualizer.tsx`)
- **CHANGED**: Smoothing factors: rise 0.6→0.75, fall 0.25→0.35 for faster response
- **CHANGED**: Base amplitude multiplier from 0.45 to 0.55 for more visible movement
- **CHANGED**: Minimum audio level from 0.1 to 0.2 for better baseline wave visibility
- **NEW**: 1.3x audio level boost in `generateSinePath` for more dramatic wave movement

#### 3. Simplified Status UI (`GoggaTalkTerminal.tsx`)
- **REMOVED**: Redundant text status indicators ("Listening...", "Mic muted", "Gogga speaking")
- **KEPT**: VoiceActivityIndicator (pulsing dot) as the single source of status truth
- **RESULT**: Cleaner UI, no visual "duplication"

#### 4. Contextual Status Text (`AudioWaveVisualizer.tsx`)
- **CHANGED**: VoiceActivityIndicator now shows contextual status based on state:
  - `gogga-speaking` + active → "Gogga speaking..."
  - `user-speaking` + active → "Listening..."
  - `idle` → "Muted"
  - When not active → "Ready" / "Gogga" / "Muted"

---

### TC-013: Improved Wave Sensitivity - Quiet Speech
**Steps:**
1. Connect to GoggaTalk
2. Speak quietly (normal conversational volume)
3. Observe wave amplitude

**Expected:**
- Wave amplitude noticeably increases when speaking quietly
- More visible movement than before (previous version had minimal movement at low volumes)
- Wave should fill ~40-60% of height during normal speech

---

### TC-014: Improved Wave Sensitivity - Loud Speech
**Steps:**
1. Connect to GoggaTalk
2. Speak loudly
3. Observe wave amplitude

**Expected:**
- Wave amplitude reaches near-maximum (80-100% of height)
- No clipping or distortion in visualization
- Smooth response to volume changes

---

### TC-015: Contextual Status Text - User Speaking
**Steps:**
1. Connect to GoggaTalk
2. Unmute microphone
3. Speak into microphone
4. Observe status indicator above wave

**Expected:**
- Shows "Listening..." when voice detected (blue dot pulsing)
- Shows "Ready" during pauses when unmuted but not speaking
- Dot color is blue

---

### TC-016: Contextual Status Text - Gogga Speaking
**Steps:**
1. Ask Gogga a question
2. Wait for response
3. Observe status indicator above wave

**Expected:**
- Shows "Gogga speaking..." during AI audio response (white dot pulsing)
- Shows "Gogga" when response ends
- Dot color is white

---

### TC-017: Contextual Status Text - Muted State
**Steps:**
1. Connect to GoggaTalk
2. Click "Mute" button
3. Observe status indicator

**Expected:**
- Shows "Muted" (gray dot, not pulsing)
- Wave is gray/idle
- Status persists until unmuted

---

### TC-018: No Redundant Status Indicators
**Steps:**
1. Connect to GoggaTalk
2. Observe the control bar area

**Expected:**
- Only ONE status indicator visible (the VoiceActivityIndicator above the wave)
- No separate "Listening...", "Mic muted", or "Gogga speaking" text badges
- Cleaner, less cluttered interface

---

### TC-019: Transcript Source Verification (API vs Built-in)
**Steps:**
1. Connect to GoggaTalk
2. Speak a sentence with unusual words or names
3. Observe transcript accuracy
4. Compare what you said vs what was transcribed

**Expected:**
- Transcripts come from Google Gemini's inputTranscription (not browser's Web Speech API)
- May have slight accuracy variations (this is expected from Google's STT)
- Transcripts appear after brief buffering delay (1-1.5 seconds)

---

## UX Audit Findings Summary

| Issue | Status | Notes |
|-------|--------|-------|
| Transcript uses built-in vs Google API | ✅ Verified | Using Google LiveAPI `inputTranscription`/`outputTranscription` |
| Duplicate sine wave | ✅ Fixed | Only ONE wave - removed redundant status indicators |
| Wave doesn't move enough | ✅ Fixed | Increased sensitivity, amplitude, responsiveness |
| Status text clarity | ✅ Improved | Contextual text based on state |

