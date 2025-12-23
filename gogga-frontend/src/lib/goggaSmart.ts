/**
 * GoggaSmart - Self-Improving AI Learning System
 * 
 * Inspired by ACE (Agentic Context Engine) skillbook system.
 * Learns from user feedback to improve response quality over time.
 * 
 * Features:
 * - Per-user skill storage in Dexie/IndexedDB
 * - Helpful/harmful/neutral counters for each skill
 * - Automatic skill injection into system prompts
 * - User feedback loop with thumbs up/down
 * - Section-based organization (tool_selection, legal_sa, etc.)
 * 
 * @see https://github.com/kayba-ai/agentic-context-engine
 */

import { db, generateId, type GoggaSmartSkill, GOGGA_SMART_LIMITS } from './db';

// Skill sections for categorization
export type SkillSection = 
  | 'tool_selection'      // When to use which tools
  | 'output_format'       // How user prefers outputs (tables, bullets, code blocks)
  | 'user_preferences'    // User's language/style preferences
  | 'search_analysis'     // How to analyze and present search results
  | 'error_avoidance'     // Things that failed before
  | 'response_style'      // How to structure responses
  | 'conversation_flow'   // User's preferred interaction patterns
  | 'domain_knowledge'    // Specific domain insights
  | 'general';            // Catch-all

// Feedback types for skill tagging
export type FeedbackTag = 'helpful' | 'harmful' | 'neutral';

// Update operation types
export type UpdateOperationType = 'ADD' | 'UPDATE' | 'TAG' | 'REMOVE';

export interface UpdateOperation {
  type: UpdateOperationType;
  section: SkillSection;
  content?: string;
  skillId?: string;
  metadata?: { helpful?: number; harmful?: number; neutral?: number };
}

export interface UpdateBatch {
  reasoning: string;
  operations: UpdateOperation[];
}

// Stats for UI display
export interface SkillbookStats {
  totalSkills: number;
  activeSkills: number;
  sectionCounts: Record<string, number>;
  totalHelpful: number;
  totalHarmful: number;
  totalNeutral: number;
}

/**
 * GoggaSmart Skillbook Manager
 * Manages learned strategies in Dexie/IndexedDB
 */
export class GoggaSmartManager {
  private userId: string;
  private nextIdCounter: number = 0;

  constructor(userId: string) {
    this.userId = userId;
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Generate a unique skill ID
   */
  private generateSkillId(section: SkillSection): string {
    this.nextIdCounter++;
    const prefix = section.split('_')[0];
    const timestamp = Date.now().toString(36);
    return `${prefix}-${timestamp}-${String(this.nextIdCounter).padStart(3, '0')}`;
  }

  /**
   * Add a new skill to the skillbook
   */
  async addSkill(
    section: SkillSection,
    content: string,
    metadata?: { helpful?: number; harmful?: number; neutral?: number }
  ): Promise<GoggaSmartSkill> {
    // Check limit
    const count = await db.skills.where('userId').equals(this.userId).count();
    if (count >= GOGGA_SMART_LIMITS.MAX_SKILLS_PER_USER) {
      // Prune lowest-scoring skills first
      await this.pruneLowestScoringSkills(10);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const skillId = this.generateSkillId(section);
    const id = generateId(); // RxDB requires a primary key id
    
    const skill: GoggaSmartSkill = {
      id: undefined, // Will be set after insert
      skillId,
      userId: this.userId,
      section,
      content,
      helpful: metadata?.helpful ?? 0,
      harmful: metadata?.harmful ?? 0,
      neutral: metadata?.neutral ?? 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    
    // For RxDB insertion, we need ISO strings and an id
    const skillForDb = {
      id,
      skillId,
      userId: this.userId,
      section,
      content,
      helpful: metadata?.helpful ?? 0,
      harmful: metadata?.harmful ?? 0,
      neutral: metadata?.neutral ?? 0,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.skills.add(skillForDb as unknown as GoggaSmartSkill);
    
    console.log('[GoggaSmart] Added skill:', skill.skillId, section);
    return skill;
  }

  /**
   * Update an existing skill's content
   */
  async updateSkill(
    skillId: string,
    content?: string,
    metadata?: { helpful?: number; harmful?: number; neutral?: number }
  ): Promise<GoggaSmartSkill | null> {
    const skill = await this.getSkill(skillId);
    if (!skill) return null;

    // Use ISO string for RxDB compatibility
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (content !== undefined) {
      updates.content = content;
    }

    if (metadata) {
      if (metadata.helpful !== undefined) updates.helpful = metadata.helpful;
      if (metadata.harmful !== undefined) updates.harmful = metadata.harmful;
      if (metadata.neutral !== undefined) updates.neutral = metadata.neutral;
    }

    await db.skills.where('skillId').equals(skillId).modify(updates);
    
    return { ...skill, ...updates };
  }

  /**
   * Tag a skill with feedback (increments counter)
   */
  async tagSkill(skillId: string, tag: FeedbackTag, increment: number = 1): Promise<GoggaSmartSkill | null> {
    const skill = await this.getSkill(skillId);
    if (!skill) return null;

    // Use ISO string for RxDB compatibility
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    switch (tag) {
      case 'helpful':
        updates.helpful = (skill.helpful || 0) + increment;
        break;
      case 'harmful':
        updates.harmful = (skill.harmful || 0) + increment;
        break;
      case 'neutral':
        updates.neutral = (skill.neutral || 0) + increment;
        break;
    }

    await db.skills.where('skillId').equals(skillId).modify(updates);
    
    console.log('[GoggaSmart] Tagged skill:', skillId, tag, '+' + increment);
    return { ...skill, ...updates };
  }

  /**
   * Remove a skill (soft delete by default)
   */
  async removeSkill(skillId: string, hard: boolean = false): Promise<void> {
    if (hard) {
      await db.skills.where('skillId').equals(skillId).delete();
    } else {
      await db.skills.where('skillId').equals(skillId).modify({
        status: 'invalid',
        updatedAt: new Date().toISOString(),
      });
    }
    console.log('[GoggaSmart] Removed skill:', skillId, hard ? '(hard)' : '(soft)');
  }

  /**
   * Get a skill by ID
   */
  async getSkill(skillId: string): Promise<GoggaSmartSkill | null> {
    const skills = await db.skills
      .where('skillId')
      .equals(skillId)
      .and((s: GoggaSmartSkill) => s.userId === this.userId)
      .toArray() as GoggaSmartSkill[];
    return skills[0] || null;
  }

  /**
   * Get all active skills for user
   */
  async getActiveSkills(): Promise<GoggaSmartSkill[]> {
    return db.skills
      .where('userId')
      .equals(this.userId)
      .and((s: GoggaSmartSkill) => s.status === 'active')
      .toArray() as Promise<GoggaSmartSkill[]>;
  }

  /**
   * Get skills by section
   */
  async getSkillsBySection(section: SkillSection): Promise<GoggaSmartSkill[]> {
    return db.skills
      .where('[userId+section]')
      .equals([this.userId, section])
      .and((s: GoggaSmartSkill) => s.status === 'active')
      .toArray() as Promise<GoggaSmartSkill[]>;
  }

  // ============================================================================
  // Prompt Generation
  // ============================================================================

  /**
   * Get top skills for system prompt injection
   * Returns skills sorted by score (helpful - harmful)
   */
  async getSkillsForPrompt(maxSkills?: number): Promise<GoggaSmartSkill[]> {
    const limit = maxSkills ?? GOGGA_SMART_LIMITS.MAX_SKILLS_IN_PROMPT;
    
    const skills = await this.getActiveSkills();
    
    // Sort by effectiveness score (helpful - harmful)
    const sorted = skills
      .map(s => ({
        ...s,
        score: (s.helpful || 0) - (s.harmful || 0),
      }))
      .filter(s => s.score >= GOGGA_SMART_LIMITS.MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return sorted;
  }

  /**
   * Format skills as a prompt section for the LLM
   * Returns both the prompt text and the skill IDs used
   */
  async asPromptWithIds(): Promise<{ prompt: string; skillIds: string[] }> {
    const skills = await this.getSkillsForPrompt();
    
    if (skills.length === 0) {
      return { prompt: '', skillIds: [] };
    }

    const skillIds = skills.map(s => s.skillId);
    const lines: string[] = [
      '[GOGGA SMART - LEARNED STRATEGIES]',
      'These are strategies learned from past interactions. Apply them when relevant:',
      '',
    ];

    // Group by section
    const bySection = new Map<string, GoggaSmartSkill[]>();
    for (const skill of skills) {
      const existing = bySection.get(skill.section) || [];
      existing.push(skill);
      bySection.set(skill.section, existing);
    }

    for (const [section, sectionSkills] of bySection) {
      lines.push(`## ${section.replace('_', ' ').toUpperCase()}`);
      for (const skill of sectionSkills) {
        const score = (skill.helpful || 0) - (skill.harmful || 0);
        lines.push(`- [${skill.skillId}] ${skill.content} (score: ${score > 0 ? '+' : ''}${score})`);
      }
      lines.push('');
    }

    return { prompt: lines.join('\n'), skillIds };
  }

  /**
   * Alias for backward compatibility
   */
  async asPrompt(): Promise<string> {
    const { prompt } = await this.asPromptWithIds();
    return prompt;
  }

  // ============================================================================
  // Batch Updates
  // ============================================================================

  /**
   * Apply a batch of updates (ACE-style delta operations)
   */
  async applyUpdateBatch(batch: UpdateBatch): Promise<void> {
    console.log('[GoggaSmart] Applying batch:', batch.reasoning);
    
    for (const op of batch.operations) {
      switch (op.type) {
        case 'ADD':
          if (op.content) {
            await this.addSkill(op.section, op.content, op.metadata);
          }
          break;
        case 'UPDATE':
          if (op.skillId) {
            await this.updateSkill(op.skillId, op.content, op.metadata);
          }
          break;
        case 'TAG':
          if (op.skillId && op.metadata) {
            for (const [tag, increment] of Object.entries(op.metadata)) {
              if (tag === 'helpful' || tag === 'harmful' || tag === 'neutral') {
                await this.tagSkill(op.skillId, tag, increment);
              }
            }
          }
          break;
        case 'REMOVE':
          if (op.skillId) {
            await this.removeSkill(op.skillId);
          }
          break;
      }
    }
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  /**
   * Prune skills with consistently negative scores
   */
  async pruneLowestScoringSkills(count: number = 5): Promise<number> {
    const skills = await this.getActiveSkills();
    
    const sorted = skills
      .map(s => ({
        ...s,
        score: (s.helpful || 0) - (s.harmful || 0),
      }))
      .sort((a, b) => a.score - b.score);

    let pruned = 0;
    for (const skill of sorted.slice(0, count)) {
      if (skill.score < GOGGA_SMART_LIMITS.MIN_SCORE_THRESHOLD) {
        await this.removeSkill(skill.skillId, true); // Hard delete
        pruned++;
      }
    }

    console.log('[GoggaSmart] Pruned', pruned, 'low-scoring skills');
    return pruned;
  }

  /**
   * Reset all skills for user (clear skillbook)
   */
  async resetSkillbook(): Promise<void> {
    await db.skills.where('userId').equals(this.userId).delete();
    this.nextIdCounter = 0;
    console.log('[GoggaSmart] Reset skillbook for user:', this.userId);
  }

  /**
   * Get skillbook statistics
   */
  async getStats(): Promise<SkillbookStats> {
    const allSkills = await db.skills.where('userId').equals(this.userId).toArray() as GoggaSmartSkill[];
    const activeSkills = allSkills.filter((s: GoggaSmartSkill) => s.status === 'active');

    const sectionCounts: Record<string, number> = {};
    let totalHelpful = 0;
    let totalHarmful = 0;
    let totalNeutral = 0;

    for (const skill of activeSkills) {
      sectionCounts[skill.section] = (sectionCounts[skill.section] || 0) + 1;
      totalHelpful += skill.helpful || 0;
      totalHarmful += skill.harmful || 0;
      totalNeutral += skill.neutral || 0;
    }

    return {
      totalSkills: allSkills.length,
      activeSkills: activeSkills.length,
      sectionCounts,
      totalHelpful,
      totalHarmful,
      totalNeutral,
    };
  }

  // ============================================================================
  // Serialization (for export/import)
  // ============================================================================

  /**
   * Export skillbook as JSON
   */
  async toJSON(): Promise<string> {
    const skills = await db.skills.where('userId').equals(this.userId).toArray() as GoggaSmartSkill[];
    return JSON.stringify({
      userId: this.userId,
      exportedAt: new Date().toISOString(),
      skills: skills.map((s: GoggaSmartSkill) => ({
        skillId: s.skillId,
        section: s.section,
        content: s.content,
        helpful: s.helpful,
        harmful: s.harmful,
        neutral: s.neutral,
        status: s.status,
      })),
    }, null, 2);
  }

  /**
   * Import skillbook from JSON
   */
  async fromJSON(json: string): Promise<number> {
    const data = JSON.parse(json);
    let imported = 0;

    for (const skill of data.skills) {
      await this.addSkill(skill.section, skill.content, {
        helpful: skill.helpful,
        harmful: skill.harmful,
        neutral: skill.neutral,
      });
      imported++;
    }

    console.log('[GoggaSmart] Imported', imported, 'skills');
    return imported;
  }
}

// ============================================================================
// Factory function
// ============================================================================

let managerInstance: GoggaSmartManager | null = null;
let currentUserId: string | null = null;

/**
 * Get or create GoggaSmart manager for user
 */
export function getGoggaSmartManager(userId: string): GoggaSmartManager {
  if (!managerInstance || currentUserId !== userId) {
    managerInstance = new GoggaSmartManager(userId);
    currentUserId = userId;
  }
  return managerInstance;
}

/**
 * Quick helper to add a skill from LLM reflection
 */
export async function learnFromInteraction(
  userId: string,
  section: SkillSection,
  insight: string
): Promise<GoggaSmartSkill> {
  const manager = getGoggaSmartManager(userId);
  return manager.addSkill(section, insight);
}

/**
 * Quick helper to tag a skill based on user feedback
 */
export async function applyFeedback(
  userId: string,
  skillId: string,
  feedback: 'thumbs_up' | 'thumbs_down'
): Promise<void> {
  const manager = getGoggaSmartManager(userId);
  const tag: FeedbackTag = feedback === 'thumbs_up' ? 'helpful' : 'harmful';
  await manager.tagSkill(skillId, tag);
}

// ============================================================================
// SA-Specific Starter Skills
// ============================================================================

/**
 * Default starter skills for South African users.
 * These bootstrap the skillbook with SA-specific knowledge.
 */
export const SA_STARTER_SKILLS: { section: SkillSection; content: string }[] = [
  // Output format preferences
  {
    section: 'output_format',
    content: 'For comparisons, use markdown tables with clear headers and aligned columns.',
  },
  {
    section: 'output_format',
    content: 'For step-by-step instructions, use numbered lists with clear action verbs.',
  },
  {
    section: 'output_format',
    content: 'When showing code, always include the filename as a comment and use syntax highlighting.',
  },
  // Search analysis patterns
  {
    section: 'search_analysis',
    content: 'When analyzing search results, summarize key findings first, then provide source links.',
  },
  {
    section: 'search_analysis',
    content: 'For web research, cross-reference multiple sources and note conflicting information.',
  },
  // User preferences (SA context)
  {
    section: 'user_preferences',
    content: 'Use South African Rand (R) for all monetary amounts, never USD.',
  },
  {
    section: 'user_preferences',
    content: 'Switch seamlessly between South African languages without announcing the switch.',
  },
  // Response style
  {
    section: 'response_style',
    content: 'Be direct and practical - South Africans value straight answers over lengthy disclaimers.',
  },
  {
    section: 'response_style',
    content: 'When mentioning load shedding, be empathetic but solution-focused.',
  },
  // Conversation flow
  {
    section: 'conversation_flow',
    content: 'Ask clarifying questions upfront if the request is ambiguous rather than guessing.',
  },
  {
    section: 'conversation_flow',
    content: 'Remember context from earlier in the conversation - no need to re-explain.',
  },
  // Domain knowledge
  {
    section: 'domain_knowledge',
    content: 'For SA tax queries, remember the tax year runs March-February and PAYE thresholds differ by age.',
  },
  {
    section: 'domain_knowledge',
    content: 'For legal questions, mention the 30-day CCMA deadline and 6-month CPA warranty.',
  },
];

/**
 * Bootstrap a new user with SA starter skills
 */
export async function bootstrapStarterSkills(userId: string): Promise<number> {
  const manager = getGoggaSmartManager(userId);
  
  // Check if user already has skills (don't duplicate)
  const stats = await manager.getStats();
  if (stats.activeSkills > 0) {
    console.log('[GoggaSmart] User already has skills, skipping bootstrap');
    return 0;
  }
  
  let added = 0;
  for (const starter of SA_STARTER_SKILLS) {
    await manager.addSkill(starter.section, starter.content, { neutral: 1 });
    added++;
  }
  
  console.log('[GoggaSmart] Bootstrapped', added, 'starter skills for user:', userId);
  return added;
}
