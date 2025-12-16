# GoggaSmart - Self-Improving AI Learning System

> **Last Updated:** December 15, 2025
> **Status:** ✅ RxDB Migration Complete

## Overview
GoggaSmart is Gogga's implementation of a self-improving AI learning system, inspired by the Agentic Context Engine (ACE) skillbook architecture. It stores learned strategies and user preferences in **RxDB** (IndexedDB-backed), creating a personalized AI experience that improves over time.

## Architecture

### Core Components

| File | Purpose |
|------|---------|
| `src/lib/db.ts` | **RxDB database** (NOT Dexie) - exports `db` and `generateId()` |
| `src/lib/rxdb/schemas.ts` | GoggaSmartSkillDoc schema definition |
| `src/lib/goggaSmart.ts` | GoggaSmartManager class - skill CRUD & prompt generation |
| `src/hooks/useGoggaSmart.ts` | React hook for skill management |
| `src/components/GoggaSmartUI.tsx` | UI: Button, Modal, FeedbackButtons |

**IMPORTANT (December 16, 2025):**
- `goggaSmart.ts` imports `generateId` from `db.ts` for RxDB primary key
- All Date fields must use `.toISOString()` (RxDB requires JSON-serializable data)
- `skillId` includes timestamp for uniqueness: `output-m5x7k2j-001`
- React key in GoggaSmartUI uses `skill.id` (RxDB primary key), not `skillId`

### Data Model

```typescript
interface GoggaSmartSkill {
  id?: number;               // Auto-increment primary key
  skillId: string;           // Unique skill identifier
  userId: string;            // User ownership
  section: SkillSection;     // Category
  content: string;           // The learned strategy/preference
  helpful: number;           // Thumbs up count
  harmful: number;           // Thumbs down count
  neutral: number;           // No feedback count
  status: 'active' | 'draft' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}
```

### Skill Sections (Updated December 2025)
- `tool_selection` - Which tools/approaches work best
- `legal_sa` - South African legal context preferences
- `user_preferences` - User communication preferences
- `error_avoidance` - Mistakes to avoid
- `response_style` - Formatting and tone preferences
- `output_format` - Structure and formatting patterns
- `search_analysis` - Search/research strategies
- `conversation_flow` - Dialogue management patterns
- `general` - Catch-all category

> **Removed:** `domain_knowledge` (replaced by memory context), `sassa_grants` (factual data belongs in memory)

## Implementation Details

### Tier Availability
- **FREE**: GoggaSmart disabled
- **JIVE/JIGGA**: Full GoggaSmart functionality

### Limits (GOGGA_SMART_LIMITS)
```typescript
MAX_SKILLS_PER_USER: 100      // Total skills per user
MAX_SKILLS_IN_PROMPT: 15      // Skills injected per request
MIN_SCORE_THRESHOLD: -3       // Skills below this are pruned
```

### Skill Scoring
Skills are ranked by effectiveness score: `helpful - harmful`

Top 15 highest-scoring active skills are injected into the system prompt.

### Prompt Injection
GoggaSmart context is injected into the message in ChatClient.tsx:
```
LEARNED SKILLS:
You have learned these effective strategies from past interactions:
[Section: domain_knowledge]
- Use Python for data analysis tasks (score: +5)
[Section: response_style]
- Keep explanations concise for this user (score: +3)
```

## User Interface

### GoggaSmartButton
- Brain icon in header (JIVE/JIGGA only)
- Badge shows skill count
- Opens GoggaSmartModal

### GoggaSmartModal
- Info section explaining how it works
- Stats display: total skills, helpful/harmful/neutral counts
- Skills list with ability to delete individual skills
- Reset confirmation to clear all learned data

### FeedbackButtons
- Thumbs up/down on each assistant message
- Increments helpful/harmful counters on used skills
- Shows submitted state to prevent duplicate votes

## Usage Flow

1. User asks a question
2. GoggaSmart injects top 15 skills into system prompt
3. AI responds using learned strategies
4. User gives thumbs up/down feedback
5. Skill scores update based on feedback
6. Low-scoring skills get pruned automatically

## Integration Points

### ChatClient.tsx
- Hook initialization after useBuddySystem
- GoggaSmartButton in header
- GoggaSmartModal at component level
- FeedbackButtons on assistant messages
- Context injection in sendMessage()

### RxDB GoggaSmartSkillDoc Schema
```typescript
export const goggaSmartSkillSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    skillId: { type: 'string' },
    userId: { type: 'string' },
    section: { type: 'string' },
    content: { type: 'string' },
    helpful: { type: 'number' },
    harmful: { type: 'number' },
    neutral: { type: 'number' },
    status: { type: 'string', enum: ['active', 'invalid'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: ['id', 'skillId', 'userId', 'section', 'content'],
  indexes: ['skillId', ['userId', 'section']],
};
```

## Refinements (Dec 2025)

### Bug Fixes Applied
1. **FeedbackButtons callback** - Fixed to use proper `(skillIds[], feedback)` signature
2. **GoggaSmartButton props** - Aligned with component interface (`isEnabled`, `stats`)
3. **Skill tracking** - Added `asPromptWithIds()` to return skill IDs with prompt
4. **Bootstrap mechanism** - Uses `useRef` to prevent re-bootstrapping

### SA Starter Skills
New users are automatically bootstrapped with 9 South African-specific skills:
- CCMA 30-day referral deadline
- POPIA consent requirements
- CPA 6-month implied warranty
- Use ZAR currency
- Switch SA languages seamlessly
- Be direct and practical
- Solution-focused load shedding responses
- SASSA grant amounts
- SA tax year dates

### Files Modified
- `goggaSmart.ts` - Added `asPromptWithIds()`, `SA_STARTER_SKILLS`, `bootstrapStarterSkills()`
- `useGoggaSmart.ts` - Added `useRef` for bootstrap tracking, uses `asPromptWithIds()`
- `GoggaSmartUI.tsx` - Added `isLoading` prop, removed unused `messageId`
- `ChatClient.tsx` - Fixed button/modal props, proper feedback callback

### Documentation
Full documentation at `docs/GOGGA_SMART.md`

## Future Enhancements

1. **Auto-skill generation**: AI suggests new skills based on successful interactions
2. **Skill categories UI**: Filter/group skills by section
3. **Export/Import**: Backup and restore skillbook
4. **Skill suggestions**: AI can propose new skills mid-conversation
5. **Decay system**: Skills not used for long periods lose score