/**
 * GOGGA BuddySystem React Hook
 * Easy integration for components
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  buddySystem,
  type BuddyProfile,
  type SALanguage,
  type RelationshipStatus,
  type PersonalityMode,
  type LanguageDetectionResult,
  SA_LANGUAGES,
} from '@/lib/buddySystem';

interface BuddyStats {
  buddyPoints: number;
  relationshipStatus: RelationshipStatus;
  totalInteractions: number;
  daysSinceFirst: number;
  preferredLanguage: string;
  name?: string;
}

interface UseBuddySystemReturn {
  // Profile state
  profile: BuddyProfile | null;
  stats: BuddyStats | null;
  isLoading: boolean;

  // Greetings
  greeting: string;
  sarcasticIntro: string;

  // Actions
  setUserName: (name: string) => Promise<void>;
  setLanguage: (lang: SALanguage) => Promise<void>;
  setPersonalityMode: (mode: PersonalityMode) => Promise<void>;
  setHumorEnabled: (enabled: boolean) => Promise<void>;
  processMessage: (message: string) => Promise<void>;
  recordInteraction: (
    quality?: 'positive' | 'neutral' | 'negative'
  ) => Promise<number>;
  getAIContext: () => Promise<string>;
  refreshProfile: () => Promise<void>;

  // Language detection
  detectLanguage: (message: string) => LanguageDetectionResult;

  // Utilities
  languages: typeof SA_LANGUAGES;
}

export function useBuddySystem(): UseBuddySystemReturn {
  const [profile, setProfile] = useState<BuddyProfile | null>(null);
  const [stats, setStats] = useState<BuddyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [sarcasticIntro, setSarcasticIntro] = useState('');

  // Initialize and load profile
  const refreshProfile = useCallback(async () => {
    try {
      const p = await buddySystem.initialize();
      setProfile(p);

      const s = await buddySystem.getStats();
      setStats(s);

      const greet = buddySystem.getTimeGreeting();
      setGreeting(`${greet.greeting}!`);

      // getSarcasticIntro is now async (reads name from Dexie)
      const intro = await buddySystem.getSarcasticIntro();
      setSarcasticIntro(intro);
    } catch (err) {
      console.error('[useBuddySystem] Failed to load:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Actions
  const setUserName = useCallback(async (name: string) => {
    await buddySystem.setUserName(name);
    await refreshProfile();
  }, [refreshProfile]);

  const setLanguage = useCallback(async (lang: SALanguage) => {
    await buddySystem.setPreferredLanguage(lang);
    await refreshProfile();
  }, [refreshProfile]);

  const setPersonalityMode = useCallback(
    async (mode: PersonalityMode) => {
      await buddySystem.setPersonalityMode(mode);
      await refreshProfile();
    },
    [refreshProfile]
  );

  const setHumorEnabled = useCallback(async (enabled: boolean) => {
    await buddySystem.setHumorEnabled(enabled);
    await refreshProfile();
  }, [refreshProfile]);

  const processMessage = useCallback(async (message: string) => {
    await buddySystem.processUserMessage(message);
    await refreshProfile();
  }, [refreshProfile]);

  const recordInteraction = useCallback(async (quality: 'positive' | 'neutral' | 'negative' = 'positive') => {
    const points = await buddySystem.recordInteraction(quality);
    await refreshProfile();
    return points;
  }, [refreshProfile]);

  const getAIContext = useCallback(async () => {
    return buddySystem.getAIContext();
  }, []);

  // Language detection (synchronous, no profile update)
  const detectLanguage = useCallback((message: string): LanguageDetectionResult => {
    return buddySystem.detectLanguageWithConfidence(message);
  }, []);

  return {
    profile,
    stats,
    isLoading,
    greeting,
    sarcasticIntro,
    setUserName,
    setLanguage,
    setPersonalityMode,
    setHumorEnabled,
    processMessage,
    recordInteraction,
    getAIContext,
    refreshProfile,
    detectLanguage,
    languages: SA_LANGUAGES,
  };
}
