# GOGGA Unique Voice & Identity System

## Last Updated
December 17, 2025

## Overview
This document defines GOGGA's unique voice architecture following Google Gemini best practices for system instructions with multi-persona support, 11 SA languages, and user-first advocacy.

## Architecture: Dynamic System Instruction Builder

### Core Principle (Google Best Practice)
System instructions should be **dynamically constructed** based on:
1. User's personality mode preference (system/dark/goody)
2. User's preferred language (11 SA official languages)
3. User's relationship level (stranger → bestie)
4. User's location and context
5. User memories and interests

### Current Implementation (Working Well)
```
Frontend (BuddySystem)  →  getAIContext()  →  USER CONTEXT block
         ↓
ChatClient.tsx prepends: "USER CONTEXT:\n{context}\n\n---\n\n{message}"
         ↓
Backend receives: context + message together
         ↓
prompts.py MEMORY_AWARENESS tells AI how to parse and use the context
```

## Google Gemini Recommended Structure

### 1. Layered System Instruction
```python
SYSTEM_INSTRUCTION = """
[CORE IDENTITY - IMMUTABLE]
{identity_firewall}

[PERSONALITY MODE - USER SELECTED]
{personality_block}

[LANGUAGE CAPABILITY - ALL 11 SA LANGUAGES]
{multilingual_block}

[USER CONTEXT - DYNAMIC]
{memory_awareness}

[TOOLS & CAPABILITIES]
{tool_instructions}

[FORMATTING]
{output_rules}
"""
```

### 2. Personality Mode Blocks (Pre-built)

#### System Default Block
```
PERSONALITY: System Default (Balanced Professional)
- Friendly, helpful, user-focused
- Natural SA warmth without forced personality
- Automatically serious for legal/medical/crisis topics
```

#### Dark Gogga Block
```
PERSONALITY: Dark Gogga (Sarcastic Edge)
- Witty, warm, wonderfully sarcastic - like a clever friend
- "Eish, another landlord who thinks the RHA doesn't apply? Delightful."
- Balance sarcasm with genuine helpfulness
- DROP sarcasm for: legal threats, medical, abuse, trauma, grief
```

#### Goody Gogga Block (DEFAULT)
```
PERSONALITY: Goody Gogga (Positive & Uplifting)
- Always happy, positive, encouraging
- Sees bright side, uplifts spirits
- "Every challenge is an opportunity - let's tackle this together!"
- Maintains professionalism - positive doesn't mean unrealistic
```

### 3. Language Mode Blocks (Dynamic per Detected Language)
```
CURRENT USER LANGUAGE: {detected_language}
You are responding in {language_name}. Speak NATIVELY:
- Use authentic expressions, not textbook translations
- Code-switch naturally like real South Africans
- Never announce language changes
- Match user's formality level in this language
```

## Implementation Status (December 17, 2025)

### Backend Changes ✅

1. **`gogga-backend/app/api/v1/endpoints/chat.py`**
   - Added `personality_mode: str` parameter (default: "goody")
   - Added `detected_language: str` parameter (default: "en")

2. **`gogga-backend/app/prompts.py`**
   - Added `SA_LANGUAGES_METADATA` constant with all 11 SA languages
   - Added `get_language_instruction(lang_code)` function for native language responses
   - Added `build_personality_block(mode)` function for personality switching

### Frontend Changes ✅

1. **`gogga-frontend/src/app/ChatClient.tsx`**
   - Now extracts `profile` from `useBuddySystem()` hook
   - Detects language from user message using `detectMessageLanguage(text)`
   - Passes `personality_mode` and `detected_language` in API request payload

### Data Flow
```
User types message (isiZulu)
        ↓
detectMessageLanguage(text) → { language: 'zu', confidence: 90 }
        ↓
profile.personalityMode → 'goody' (or 'dark', 'system')
        ↓
API Request includes:
  - personality_mode: 'goody'
  - detected_language: 'zu'
        ↓
Backend builds language-specific + personality-specific prompt
        ↓
GOGGA responds in isiZulu with Goody Gogga personality
```

## Testing Checklist

1. [ ] Test all 3 personality modes with same question
2. [ ] Test language switching (ask in Zulu, get Zulu response)
3. [ ] Test relationship progression (stranger → bestie greetings)
4. [ ] Test memory recall (name, preferences)
5. [ ] Test serious mode override (crisis detection)
6. [ ] Test identity firewall (try to change persona)
