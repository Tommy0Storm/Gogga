# GOGGA Personality Modes System

## Last Updated
December 13, 2025

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

## Frontend PersonalitySettings Component (NEW Dec 13, 2025)

### New File: `gogga-frontend/src/components/PersonalitySettings.tsx`
- Compact personality settings for embedding in AccountMenu dropdown
- Full standalone mode for dedicated settings page
- Props: `compact?: boolean`, `onSettingsChange?: () => void`

### Modified File: `gogga-frontend/src/components/AccountMenu.tsx`
- Added "Personality & Language" expandable section with Brain icon
- Integrates `<PersonalitySettings compact />` inline in dropdown
- User can now change personality mode directly from main chat page
- No need to navigate to dashboard for basic settings

## Test Files

### Backend Tests (`gogga-backend/tests/test_personality_modes.py`)
- **60 comprehensive pytest tests** covering:
  - Personality mode definitions (3 modes + serious mode)
  - Dark Gogga characteristics (sarcasm, load shedding humor, helpful)
  - Goody Gogga characteristics (positive, encouraging, authentic)
  - System neutral mode (professional, balanced, warm)
  - Empathetic reasoning instruction components
  - Tier enhancement integration (FREE/JIVE/JIGGA)
  - SA context awareness (slang, institutions, laws)
  - User advocacy stance
  - Language support (11 SA languages)
  - Serious mode override for sensitive topics

### Empathetic Reasoning (NEW)
Added to `app/services/optillm_enhancements.py`:
```python
EMPATHETIC_REASONING_INSTRUCTION = """
EMPATHETIC THINKING - UNDERSTAND THE HUMAN:
1. WHY is the user asking this?
2. WHAT is the underlying human need?
3. WHAT can I offer beyond the literal answer?
4. HOW should I tailor my response?
"""
```
- Included by default in `enhance_system_prompt()`
- Can be excluded with `include_empathy=False`
- Makes LLM think about user motivation and proactive offerings

## Testing Recommendations
1. Test each personality mode with various prompts
2. Verify Dark Gogga maintains sarcasm but drops it for serious topics
3. Verify Goody Gogga is consistently positive and uplifting
4. Verify System mode is balanced and professional
5. Test personality mode persistence across sessions
6. Test UI controls switch modes correctly and update greetings
7. Verify AI context includes personality mode and AI follows it
8. Test PersonalitySettings component in AccountMenu dropdown
9. Run: `pytest tests/test_personality_modes.py -v` (60 tests)
