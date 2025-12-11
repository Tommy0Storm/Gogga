# GOGGA Personality Modes System

## Last Updated
December 9, 2025

## Overview
Three distinct personality modes for user choice: System (default balanced), Dark Gogga (sarcastic), and Goody Gogga (positive - DEFAULT).

## Files Modified

### Backend (`gogga-backend/app/prompts.py`)
- Replaced all `[SARCASTIC]` references with `[DARK GOGGA]`
- Added `[GOODY GOGGA]` mode (always positive, uplifting, encouraging)
- Made System Default the neutral mode
- Updated three locations:
  1. `CEPO_IDENTITY_PROMPT` (line ~290)
  2. `QWEN_IDENTITY_PROMPT` (line ~413)
  3. `GOGGA_BASE_PROMPT` (line ~561)

### Frontend (`gogga-frontend/src/lib/buddySystem.ts`)
- Added `PersonalityMode` type: `'system' | 'dark' | 'goody'`
- Updated `BuddyProfile` interface with `personalityMode: PersonalityMode`
- Default personality changed from `sarcastic` to `'goody'`
- Added `setPersonalityMode(mode: PersonalityMode)` method
- Added `getPersonalityMode()` method
- Updated `setHumorEnabled()` to map to personality modes (legacy support)
- Updated `getSarcasticIntro()` to support all three modes:
  - **System**: Professional, neutral greeting
  - **Dark Gogga**: Sarcastic, witty intros (old behavior)
  - **Goody Gogga**: Positive, uplifting, encouraging intros (NEW DEFAULT)
- Updated `getAIContext()` to include personality mode in context sent to AI

### Frontend Hook (`gogga-frontend/src/hooks/useBuddySystem.ts`)
- Added `PersonalityMode` import
- Added `setPersonalityMode` to interface and export

### UI Component (`gogga-frontend/src/components/dashboard/BuddyPanel.tsx`)
- Replaced "Sarcastic humor" toggle with "Personality Mode" selector
- Three-button grid layout for mode selection:
  - **System**: Gray/neutral styling - "Balanced"
  - **Dark Gogga**: Dark styling - "Sarcastic"
  - **Goody Gogga**: Green styling - "Positive" (default)
- Shows description below buttons based on selected mode

## Personality Descriptions

### System Default
- Balanced, professional, naturally warm
- No forced personality traits
- Follows core GOGGA system prompt
- Use when user wants neutral, professional tone

### Dark Gogga (formerly "Sarcastic")
- Witty, warm, wonderfully sarcastic
- Examples:
  - "Another landlord who thinks the RHA doesn't apply to them? Delightful."
  - "Your employer's interpretation of labour law is... creative."
  - "Load shedding AND work stress? Eskom really said 'hold my beer'."
- Still drops sarcasm for serious situations (legal, medical, crisis)

### Goody Gogga (NEW - DEFAULT)
- Always happy, positive, encouraging
- Seeks bright side and uplifts spirits
- Examples:
  - "That's wonderful! Let me help you make it even better!"
  - "Every challenge is an opportunity - let's tackle this together!"
  - "You're doing great! Here's how we can make this amazing!"
- Maintains professionalism - positive doesn't mean unrealistic
- For serious situations: supportive and warm while being appropriately serious

## AI Context Format
The personality mode is sent to the AI in the user context:
```
PERSONALITY MODE: Goody Gogga (positive, uplifting)
```

The AI reads this and adjusts its response style accordingly, following the detailed personality guidelines in the system prompts.

## Migration Notes
- Existing users with `humorEnabled: true` will see personality mode as `'goody'` (default)
- Existing users with `humorEnabled: false` will see personality mode as `'system'`
- New users default to `'goody'` personality mode
- Legacy `humorEnabled` field maintained for backward compatibility
- `setHumorEnabled(true)` now switches to 'goody' if in 'system' mode
- `setHumorEnabled(false)` now switches to 'system' mode

## Testing Recommendations
1. Test each personality mode with various prompts
2. Verify Dark Gogga maintains sarcasm but drops it for serious topics
3. Verify Goody Gogga is consistently positive and uplifting
4. Verify System mode is balanced and professional
5. Test personality mode persistence across sessions
6. Test UI controls switch modes correctly and update greetings
7. Verify AI context includes personality mode and AI follows it
