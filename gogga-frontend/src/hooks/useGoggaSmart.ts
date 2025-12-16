/**
 * useGoggaSmart Hook
 * React hook for GoggaSmart self-improving AI system
 * 
 * Features:
 * - Manages skill CRUD operations
 * - Provides prompt context for system messages
 * - Handles user feedback (thumbs up/down)
 * - Exposes stats for UI display
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  GoggaSmartManager,
  getGoggaSmartManager,
  bootstrapStarterSkills,
  type SkillSection,
  type FeedbackTag,
  type SkillbookStats,
  type UpdateBatch,
} from '@/lib/goggaSmart';
import type { GoggaSmartSkill } from '@/lib/db';

export type Tier = 'free' | 'jive' | 'jigga';

interface UseGoggaSmartOptions {
  tier: Tier;
  enabled?: boolean;
}

interface UseGoggaSmartReturn {
  // State
  isEnabled: boolean;
  isLoading: boolean;
  skills: GoggaSmartSkill[];
  stats: SkillbookStats | null;
  promptContext: string;
  
  // Actions
  addSkill: (section: SkillSection, content: string) => Promise<GoggaSmartSkill | null>;
  tagSkill: (skillId: string, tag: FeedbackTag) => Promise<void>;
  removeSkill: (skillId: string) => Promise<void>;
  resetSkillbook: () => Promise<void>;
  applyFeedback: (skillIds: string[], feedback: 'thumbs_up' | 'thumbs_down') => Promise<void>;
  applyUpdateBatch: (batch: UpdateBatch) => Promise<void>;
  refreshSkills: () => Promise<void>;
  
  // For tracking which skills were used in a response
  getUsedSkillIds: () => string[];
  setUsedSkillIds: (ids: string[]) => void;
}

// Skills used in the current response (for feedback tracking)
let usedSkillIds: string[] = [];

export function useGoggaSmart({ tier, enabled = true }: UseGoggaSmartOptions): UseGoggaSmartReturn {
  const { data: session } = useSession();
  const userId = session?.user?.id || session?.user?.email || 'anonymous';
  
  // Only enable for JIVE and JIGGA tiers
  const isEnabled = enabled && (tier === 'jive' || tier === 'jigga');
  
  const [isLoading, setIsLoading] = useState(true);
  const [skills, setSkills] = useState<GoggaSmartSkill[]>([]);
  const [stats, setStats] = useState<SkillbookStats | null>(null);
  const [promptContext, setPromptContext] = useState('');
  
  // Memoize manager instance
  const manager = useMemo(() => {
    if (!isEnabled) return null;
    return getGoggaSmartManager(userId);
  }, [userId, isEnabled]);

  // Load skills on mount and when userId changes
  // Track if we've bootstrapped to avoid re-running
  const bootstrappedRef = useRef(false);

  const refreshSkills = useCallback(async () => {
    if (!manager) {
      setSkills([]);
      setStats(null);
      setPromptContext('');
      usedSkillIds = [];
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Bootstrap starter skills for new users (only once per session)
      if (!bootstrappedRef.current) {
        await bootstrapStarterSkills(userId);
        bootstrappedRef.current = true;
      }

      const [activeSkills, skillStats, promptData] = await Promise.all([
        manager.getActiveSkills(),
        manager.getStats(),
        manager.asPromptWithIds(),
      ]);
      
      setSkills(activeSkills);
      setStats(skillStats);
      setPromptContext(promptData.prompt);
      // Store used skill IDs for feedback tracking
      usedSkillIds = promptData.skillIds;
    } catch (error) {
      console.error('[useGoggaSmart] Error loading skills:', error);
    } finally {
      setIsLoading(false);
    }
  }, [manager, userId]);

  useEffect(() => {
    refreshSkills();
  }, [refreshSkills]);

  // Add a new skill
  const addSkill = useCallback(async (
    section: SkillSection,
    content: string
  ): Promise<GoggaSmartSkill | null> => {
    if (!manager) return null;
    
    try {
      const skill = await manager.addSkill(section, content);
      await refreshSkills();
      return skill;
    } catch (error) {
      console.error('[useGoggaSmart] Error adding skill:', error);
      return null;
    }
  }, [manager, refreshSkills]);

  // Tag a skill with feedback
  const tagSkill = useCallback(async (
    skillId: string,
    tag: FeedbackTag
  ): Promise<void> => {
    if (!manager) return;
    
    try {
      await manager.tagSkill(skillId, tag);
      await refreshSkills();
    } catch (error) {
      console.error('[useGoggaSmart] Error tagging skill:', error);
    }
  }, [manager, refreshSkills]);

  // Remove a skill
  const removeSkill = useCallback(async (skillId: string): Promise<void> => {
    if (!manager) return;
    
    try {
      await manager.removeSkill(skillId);
      await refreshSkills();
    } catch (error) {
      console.error('[useGoggaSmart] Error removing skill:', error);
    }
  }, [manager, refreshSkills]);

  // Reset entire skillbook
  const resetSkillbook = useCallback(async (): Promise<void> => {
    if (!manager) return;
    
    try {
      await manager.resetSkillbook();
      await refreshSkills();
    } catch (error) {
      console.error('[useGoggaSmart] Error resetting skillbook:', error);
    }
  }, [manager, refreshSkills]);

  // Apply feedback from thumbs up/down button
  const applyFeedback = useCallback(async (
    skillIds: string[],
    feedback: 'thumbs_up' | 'thumbs_down'
  ): Promise<void> => {
    if (!manager || skillIds.length === 0) return;
    
    const tag: FeedbackTag = feedback === 'thumbs_up' ? 'helpful' : 'harmful';
    
    try {
      for (const skillId of skillIds) {
        await manager.tagSkill(skillId, tag);
      }
      await refreshSkills();
    } catch (error) {
      console.error('[useGoggaSmart] Error applying feedback:', error);
    }
  }, [manager, refreshSkills]);

  // Apply a batch of updates (from LLM reflection)
  const applyUpdateBatch = useCallback(async (batch: UpdateBatch): Promise<void> => {
    if (!manager) return;
    
    try {
      await manager.applyUpdateBatch(batch);
      await refreshSkills();
    } catch (error) {
      console.error('[useGoggaSmart] Error applying update batch:', error);
    }
  }, [manager, refreshSkills]);

  // Track which skills were used in a response
  const getUsedSkillIds = useCallback(() => usedSkillIds, []);
  
  const setUsedSkillIds = useCallback((ids: string[]) => {
    usedSkillIds = ids;
  }, []);

  return {
    isEnabled,
    isLoading,
    skills,
    stats,
    promptContext,
    addSkill,
    tagSkill,
    removeSkill,
    resetSkillbook,
    applyFeedback,
    applyUpdateBatch,
    refreshSkills,
    getUsedSkillIds,
    setUsedSkillIds,
  };
}

// Export skill section options for UI
export const SKILL_SECTIONS: { value: SkillSection; label: string; description: string }[] = [
  { value: 'tool_selection', label: 'Tool Selection', description: 'When to use which tools' },
  { value: 'output_format', label: 'Output Format', description: 'Tables, bullets, code blocks preferences' },
  { value: 'user_preferences', label: 'Preferences', description: 'Your language and style preferences' },
  { value: 'search_analysis', label: 'Search Analysis', description: 'How to analyze and present research' },
  { value: 'error_avoidance', label: 'Error Avoidance', description: 'Things that failed before' },
  { value: 'response_style', label: 'Response Style', description: 'How to structure responses' },
  { value: 'conversation_flow', label: 'Conversation Flow', description: 'Your preferred interaction patterns' },
  { value: 'domain_knowledge', label: 'Domain Knowledge', description: 'Specific domain insights' },
  { value: 'general', label: 'General', description: 'General strategies' },
];
