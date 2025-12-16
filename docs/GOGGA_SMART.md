# GoggaSmart - Self-Improving AI Learning System

> **Status**: Production Ready (RxDB Migration Complete - Dec 2025)  
> **Tier Availability**: JIVE, JIGGA (Disabled for FREE)  
> **Inspired By**: [Agentic Context Engine (ACE)](https://github.com/kayba-ai/agentic-context-engine)

## Overview

GoggaSmart is Gogga's implementation of a self-improving AI learning system. It learns from user feedback to enhance response quality over time, creating a personalized AI experience that adapts to each user's preferences and needs.

### Key Features

| Feature | Description |
|---------|-------------|
| **User Feedback Loop** | Thumbs up/down on responses to reinforce effective strategies |
| **Skill-Based Learning** | Organized strategies in sections (legal, preferences, style, etc.) |
| **Automatic Pruning** | Low-scoring skills are automatically removed |
| **SA-Specific Starter Skills** | New users get bootstrapped with South African context |
| **Local Storage** | All learning data stored in RxDB (IndexedDB), never leaves the device |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ChatClient.tsx                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ useGoggaSmart()  │  │ GoggaSmartButton │  │FeedbackButtons│  │
│  │    hook          │  │    (header)      │  │  (messages)   │  │
│  └────────┬─────────┘  └─────────┬────────┘  └───────┬───────┘  │
└───────────┼──────────────────────┼────────────────────┼─────────┘
            │                      │                    │
            ▼                      ▼                    │
┌─────────────────────────────────────────────────────────────────┐
│                      GoggaSmartManager                          │
│  • addSkill()           • getSkillsForPrompt()                  │
│  • tagSkill()           • asPromptWithIds()                     │
│  • removeSkill()        • pruneLowestScoringSkills()            │
│  • resetSkillbook()     • bootstrapStarterSkills()              │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RxDB (goggaSmartSkills)                      │
│  skills: id, skillId, userId, section, status, [userId+section] │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Skill Structure

```typescript
interface GoggaSmartSkill {
  id?: number;               // Auto-increment primary key
  skillId: string;           // Unique skill identifier (e.g., "lega-00001")
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

| Section | Description | Example |
|---------|-------------|---------|
| `tool_selection` | When to use which tools | "Use GoggaSolve for math problems" |
| `legal_sa` | SA legal patterns | "CCMA has 30-day referral deadline" |
| `user_preferences` | Formatting/language preferences | "Always use ZAR, never USD" |
| `error_avoidance` | Things that failed before | "Avoid giving legal advice directly" |
| `response_style` | How to structure responses | "Keep explanations concise" |
| `output_format` | Structure and formatting patterns | "Use bullet points for lists" |
| `search_analysis` | Search/research strategies | "Cross-reference multiple sources" |
| `conversation_flow` | Dialogue management patterns | "Ask clarifying questions first" |
| `general` | Catch-all category | Any general strategy |

> **Note**: `domain_knowledge` and `sassa_grants` sections were removed in Dec 2025.
> These skills are now handled via authoritative memory context instead.

## Configuration

### Limits

```typescript
export const GOGGA_SMART_LIMITS = {
  MAX_SKILLS_PER_USER: 100,      // Maximum skills per user
  MAX_SKILLS_IN_PROMPT: 15,      // Skills injected per request
  MIN_SCORE_THRESHOLD: -3,       // Skills below this are pruned
};
```

### Skill Scoring

Skills are ranked by effectiveness score:
```
score = helpful - harmful
```

- **Positive score**: Skill is effective, prioritized in prompts
- **Negative score**: Skill is counterproductive, eventually pruned
- **Threshold**: Skills with score < -3 are automatically deleted

## User Interface

### GoggaSmartButton (Header)

- **Location**: Header, next to tier badge
- **Appearance**: Brain icon with skill count badge
- **States**: 
  - No skills: Gray, no badge
  - Has skills: Purple gradient, green pulse indicator

### GoggaSmartModal

Opens when clicking the brain button. Contains:

1. **How It Works** - Brief explanation of the system
2. **Learning Stats** - Active skills, helpful/harmful counts
3. **Skills List** - View all skills with:
   - Skill ID and section
   - Content preview
   - Score indicator
   - Delete button (on hover)
4. **Reset Button** - Clear all learning data (with confirmation)

### FeedbackButtons (Messages)

- **Location**: After each assistant message
- **Options**: Thumbs up (👍) / Thumbs down (👎)
- **Behavior**: 
  - Click increments helpful/harmful counter on used skills
  - Shows submitted state to prevent duplicate votes
  - Disabled after feedback submitted

## SA Starter Skills

New users are bootstrapped with these South African-specific skills:

```typescript
const SA_STARTER_SKILLS = [
  // Legal SA
  { section: 'legal_sa', content: 'For CCMA cases, always mention the 30-day referral deadline...' },
  { section: 'legal_sa', content: 'When discussing POPIA compliance, emphasize voluntary consent...' },
  { section: 'legal_sa', content: 'For CPA issues, mention the 6-month implied warranty...' },
  
  // User Preferences
  { section: 'user_preferences', content: 'Use South African Rand (R), never USD' },
  { section: 'user_preferences', content: 'Switch seamlessly between SA languages' },
  
  // Response Style
  { section: 'response_style', content: 'Be direct and practical - SA values straight answers' },
  { section: 'response_style', content: 'When mentioning load shedding, be solution-focused' },
  
  // Domain Knowledge
  { section: 'domain_knowledge', content: 'SASSA grants: SRD R370, Child Support R530, Older Persons R2180' },
  { section: 'domain_knowledge', content: 'SA tax year runs March-February' },
];
```

## Prompt Injection

When a message is sent, GoggaSmart injects the top 15 skills:

```
[GOGGA SMART - LEARNED STRATEGIES]
These are strategies learned from past interactions. Apply them when relevant:

## LEGAL SA
- [lega-00001] For CCMA cases, always mention the 30-day referral deadline (score: +3)
- [lega-00002] When discussing POPIA compliance, emphasize voluntary consent (score: +2)

## USER PREFERENCES
- [user-00001] Use South African Rand (R), never USD (score: +5)

## RESPONSE STYLE
- [resp-00001] Be direct and practical (score: +4)
```

## Usage Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. User asks a question                                          │
├──────────────────────────────────────────────────────────────────┤
│ 2. GoggaSmart retrieves top 15 skills by score                   │
│    → Sets usedSkillIds for feedback tracking                     │
├──────────────────────────────────────────────────────────────────┤
│ 3. Skills injected into system prompt                            │
├──────────────────────────────────────────────────────────────────┤
│ 4. AI responds using learned strategies                          │
├──────────────────────────────────────────────────────────────────┤
│ 5. User gives feedback (👍 or 👎)                                │
│    → Increments helpful/harmful on all used skills               │
├──────────────────────────────────────────────────────────────────┤
│ 6. Skill scores update                                           │
│    → High-scoring skills stay, low-scoring pruned                │
└──────────────────────────────────────────────────────────────────┘
```

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/db.ts` | Dexie schema v9 with `skills` table |
| `src/lib/goggaSmart.ts` | GoggaSmartManager class, starter skills |
| `src/hooks/useGoggaSmart.ts` | React hook for skill management |
| `src/components/GoggaSmartUI.tsx` | UI: Button, Modal, FeedbackButtons |
| `src/app/ChatClient.tsx` | Integration with chat interface |

## API Reference

### GoggaSmartManager

```typescript
class GoggaSmartManager {
  // CRUD Operations
  addSkill(section, content, metadata?): Promise<GoggaSmartSkill>
  updateSkill(skillId, content?, metadata?): Promise<GoggaSmartSkill | null>
  tagSkill(skillId, tag, increment?): Promise<GoggaSmartSkill | null>
  removeSkill(skillId, hard?): Promise<void>
  
  // Prompt Generation
  getSkillsForPrompt(maxSkills?): Promise<GoggaSmartSkill[]>
  asPromptWithIds(): Promise<{ prompt: string; skillIds: string[] }>
  asPrompt(): Promise<string>
  
  // Maintenance
  pruneLowestScoringSkills(count?): Promise<number>
  resetSkillbook(): Promise<void>
  getStats(): Promise<SkillbookStats>
  
  // Serialization
  toJSON(): Promise<string>
  fromJSON(json): Promise<number>
}
```

### useGoggaSmart Hook

```typescript
function useGoggaSmart({ tier, enabled? }): {
  // State
  isEnabled: boolean;
  isLoading: boolean;
  skills: GoggaSmartSkill[];
  stats: SkillbookStats | null;
  promptContext: string;
  
  // Actions
  addSkill: (section, content) => Promise<GoggaSmartSkill | null>;
  tagSkill: (skillId, tag) => Promise<void>;
  removeSkill: (skillId) => Promise<void>;
  resetSkillbook: () => Promise<void>;
  applyFeedback: (skillIds, feedback) => Promise<void>;
  refreshSkills: () => Promise<void>;
  
  // Skill Tracking
  getUsedSkillIds: () => string[];
  setUsedSkillIds: (ids) => void;
}
```

## Future Enhancements

1. **Auto-Skill Generation** - AI suggests new skills based on successful interactions
2. **Skill Categories UI** - Filter/group skills by section in modal
3. **Export/Import** - Backup and restore skillbook
4. **Skill Suggestions** - AI can propose new skills mid-conversation
5. **Decay System** - Skills not used for long periods lose score
6. **Per-Session Skills** - Temporary skills for specific conversation contexts
7. **Skill Conflict Resolution** - Detect and merge similar skills

## Testing

### Manual Testing Checklist

1. ✅ New JIVE/JIGGA user sees starter skills bootstrapped
2. ✅ Brain button appears in header with skill count
3. ✅ Clicking brain opens modal with correct stats
4. ✅ Thumbs up on response increases helpful count
5. ✅ Thumbs down on response increases harmful count
6. ✅ Skills appear in system prompt (check console logs)
7. ✅ Delete skill from modal removes it
8. ✅ Reset clears all skills (with confirmation)
9. ✅ FREE tier users don't see GoggaSmart UI

### Console Logs

When debugging, look for these log prefixes:
- `[GoggaSmart]` - Manager operations
- `[useGoggaSmart]` - Hook operations
- `[GOGGA] GoggaSmart context found:` - Prompt injection

## Privacy

- All skill data is stored **locally** in IndexedDB
- Skills are **never** sent to servers (only injected into prompts)
- Users can **reset** all learning data at any time
- Data is tied to userId (email or session)

## Related Documentation

- [ACE Skillbook](https://github.com/kayba-ai/agentic-context-engine) - Original inspiration
- [BuddySystem](../PERSONALITY_MODES_IMPLEMENTATION.md) - User relationship tracking
- [Session-Scoped RAG](./SESSION_SCOPED_RAG_DESIGN.md) - Document context system
