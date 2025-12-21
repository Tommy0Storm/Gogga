# GoggaTalk Voice Modal - Technical Implementation

**Last Updated**: December 21, 2025  
**Version**: 2.1.0

## Overview

GoggaTalk is the real-time voice chat interface powered by Gemini Live API. Key components:

| File | Purpose |
|------|---------|
| `AudioWaveVisualizer.tsx` | SVG-based sinewave visualizer with real-time audio levels |
| `GoggaTalkTerminal.tsx` | Modal interface for voice chat |
| `useGoggaTalkDirect.ts` | Gemini Live API hook (1300+ lines) |

## Audio Visualizer Features

### Component: `AudioWaveVisualizer`

```tsx
// Props interface
interface AudioWaveVisualizerProps {
  state: 'idle' | 'user-speaking' | 'gogga-speaking';
  audioLevel?: number;           // 0-1 real-time amplitude
  width?: number;
  height?: number;
  showActivityIndicator?: boolean; // Show pulsing voice activity dot
}
```

### Color States
- **White**: Gogga speaking (AI response)
- **Blue**: User speaking (microphone active)  
- **Gray**: Idle/muted

### Technical Details
- SVG-based (HD quality, scales to any resolution)
- CSS keyframe animations (60fps smooth)
- Multiple layered waves with glow effects
- Exponential smoothing for audio level (prevents jitter)

## Audio Level Analysis

### In `useGoggaTalkDirect.ts`

```typescript
// Exposed from hook:
userAudioLevel: number;   // 0-1, user's microphone level
goggaAudioLevel: number;  // 0-1, Gogga's playback level

// Implementation uses:
- AnalyserNode on input gain (user mic)
- AnalyserNode on output gain (Gogga playback)
- requestAnimationFrame loop for updates
- getByteFrequencyData() for level calculation
```

### Audio Chain
```
User Mic → MediaStreamSource → InputGain (2.2x) → [InputAnalyser] → Processor → Gemini
Gemini → DecodeAudio → BufferSource → OutputGain → [OutputAnalyser] → Speakers
```

## Session Management

### Session Resumption
- Handles stored in `lastHandleRef`
- NOT cleared during mid-turn (server sends `resumable: false` temporarily)
- Idle timeout (code 1001) shows user-friendly message

### Reconnection Logic
- Up to 5 retry attempts
- Exponential backoff
- Preserves conversation context when possible

## UI Defaults
- `showLogs = false` (transcripts shown by default)
- `showActivityIndicator = true` in terminal
- Large visualizer (240x48) in empty state

## Test Plan Location
`/TESTS/goggatalkterminal-tests.md`

## Common Issues

1. **Visualizer not animating**: Check if `state` is correctly derived
2. **Audio levels always 0**: Ensure AnalyserNodes connected to gain nodes
3. **Session not resumable errors**: Normal during mid-turn, ignore
4. **Echo/feedback**: Auto-mutes mic while Gogga speaking
