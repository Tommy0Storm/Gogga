# GOGGA BuddySystem Implementation

## Last Updated
December 4, 2025

## Overview
User relationship tracking with enhanced SA language detection, integrates with existing MemoryManager and chat interface.

## Files
- `gogga-frontend/src/lib/buddySystem.ts` - Core BuddySystem class with enhanced language detection
- `gogga-frontend/src/hooks/useBuddySystem.ts` - React hook with `detectLanguage()` method
- `gogga-frontend/src/components/dashboard/BuddyPanel.tsx` - Dashboard widget
- `gogga-frontend/src/components/LanguageBadge.tsx` - Subtle language indicator for chat messages

## Features

### 1. All 11 SA Languages
Codes: en, af, zu, xh, nso, tn, st, ts, ss, ve, nr

### 2. Enhanced Language Detection
- `detectLanguageWithConfidence(message)` returns:
  - `language`: Detected SALanguage code
  - `confidence`: 0-100% score
  - `matches`: Matched keywords
  - `source`: 'keyword' | 'default' | 'user_preference'
  - `alternatives`: Other possible languages with scores
- Weighted keyword patterns (90 for greetings, 60-85 for common phrases)
- Auto-updates user's preferred language when confidence > 60%

### 3. Relationship Levels
- stranger → acquaintance (50pts) → friend (200pts) → bestie (500pts)
- 5 buddy points per positive interaction

### 4. Time-Aware Greetings
- Morning/afternoon/evening/night in all 11 languages
- Authentic phrases: "Goeie môre" (AF), "Sawubona ekuseni" (ZU), etc.

### 5. Sarcastic Intros
- Relationship-scaled humor
- Toggleable via `setHumorEnabled()`

## Integration Points

### Chat Interface (page.tsx)
```typescript
// Language detection on user message
const langDetection = detectMessageLanguage(text);
const userMsg: ChatMessage = { 
  role: 'user', 
  content: text,
  detectedLanguage: langDetection.language,
  languageConfidence: langDetection.confidence,
};
await processBuddyMessage(text);
```

### LanguageBadge Display
- Shows 🇿🇦 + language code (e.g., "ZU", "AF") 
- Only visible for non-English languages
- Hover shows full language name + confidence

### Storage (SPOT Architecture)
- BuddyProfile in localStorage (`gogga_buddy_profile`) - preferences, points, relationship
- **User name is NOT stored in localStorage** - it's read from Dexie memories (SPOT)
- User memories in Dexie via MemoryManager (single source of truth for user data)

## Key APIs
```typescript
// Enhanced language detection
const result = buddySystem.detectLanguageWithConfidence(message);
// Returns: { language: 'zu', confidence: 90, matches: ['sawubona'], source: 'keyword' }

// React hook usage
const { detectLanguage, processMessage, getAIContext } = useBuddySystem();
```

## Location Detection Strategy
HTTPS GPS first, IP geolocation fallback:
1. Try navigator.geolocation (requires HTTPS + permission)
2. On failure → IP-based via ipapi.co (city-level accuracy)
3. Both fail → Manual entry prompt