/**
 * GOGGA BuddySystem - User Relationship & Personalization Layer
 * 
 * Elegant, quirky, sarcastic but user-first.
 * Supports all 11 SA official languages.
 * Integrates with existing MemoryContext system.
 */

import { db, createMemory, getActiveMemories, deleteMemory, deleteGoggaMemory, type MemoryContext } from './db';

// ============================================================================
// South African Language Support (All 11 Official Languages)
// ============================================================================

export type SALanguage = 
  | 'en' | 'af' | 'zu' | 'xh' | 'nso' | 'tn' 
  | 'st' | 'ts' | 'ss' | 've' | 'nr';

/**
 * TypeScript 5.9: Structured language info type
 */
type LanguageInfo = {
  name: string;
  greeting: string;
  thanks: string;
  goodbye: string;
};

/**
 * TypeScript 5.9: Using `satisfies` to ensure all 11 SA languages are defined
 */
export const SA_LANGUAGES = {
  en: { name: 'English', greeting: 'Hello', thanks: 'Thank you', goodbye: 'Goodbye' },
  af: { name: 'Afrikaans', greeting: 'Hallo', thanks: 'Dankie', goodbye: 'Totsiens' },
  zu: { name: 'isiZulu', greeting: 'Sawubona', thanks: 'Ngiyabonga', goodbye: 'Hamba kahle' },
  xh: { name: 'isiXhosa', greeting: 'Molo', thanks: 'Enkosi', goodbye: 'Hamba kakuhle' },
  nso: { name: 'Sepedi', greeting: 'Dumela', thanks: 'Ke a leboga', goodbye: 'Šala gabotse' },
  tn: { name: 'Setswana', greeting: 'Dumela', thanks: 'Ke a leboga', goodbye: 'Sala sentle' },
  st: { name: 'Sesotho', greeting: 'Dumela', thanks: 'Kea leboha', goodbye: 'Sala hantle' },
  ts: { name: 'Xitsonga', greeting: 'Avuxeni', thanks: 'Ndza khensa', goodbye: 'Sala kahle' },
  ss: { name: 'siSwati', greeting: 'Sawubona', thanks: 'Ngiyabonga', goodbye: 'Sala kahle' },
  ve: { name: 'Tshivenda', greeting: 'Ndaa', thanks: 'Ndo livhuwa', goodbye: 'Kha vha sale zwavhudi' },
  nr: { name: 'isiNdebele', greeting: 'Lotjhani', thanks: 'Ngiyathokoza', goodbye: 'Sala kuhle' },
} satisfies Record<SALanguage, LanguageInfo>;

/**
 * TypeScript 5.9: Time greetings with satisfies validation
 */
type TimeGreeting = {
  morning: string;
  afternoon: string;
  evening: string;
  night: string;
};

// Time-based greetings with SA flair
const TIME_GREETINGS = {
  en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: "Late night vibes" },
  af: { morning: 'Goeie môre', afternoon: 'Goeie middag', evening: 'Goeie aand', night: 'Laatnag stemming' },
  zu: { morning: 'Sawubona ekuseni', afternoon: 'Sawubona ntambama', evening: 'Sawubona kusihlwa', night: 'Usebenza kuze kube sebusuku' },
  xh: { morning: 'Molo kusasa', afternoon: 'Molo emini', evening: 'Molo ngokuhlwa', night: 'Usebenza ubusuku' },
  nso: { morning: 'Dumela ka mosong', afternoon: 'Dumela thapama', evening: 'Dumela mantšiboa', night: 'O šoma bošego' },
  tn: { morning: 'Dumela mo mosong', afternoon: 'Dumela mo thapama', evening: 'Dumela maitseboa', night: 'O bereka bosigo' },
  st: { morning: 'Dumela hoseng', afternoon: 'Dumela motsheare', evening: 'Dumela mantsiboea', night: 'O sebetsa bosiu' },
  ts: { morning: 'Avuxeni nimixo', afternoon: 'Avuxeni nhlamulo', evening: 'Avuxeni nivusiku', night: 'U tirha vusiku' },
  ss: { morning: 'Sawubona ekuseni', afternoon: 'Sawubona emini', evening: 'Sawubona ebusuku', night: 'Usebenta ebusuku' },
  ve: { morning: 'Ndaa nga matsheloni', afternoon: 'Ndaa masiari', evening: 'Ndaa madekwana', night: 'Ni khou shuma vhusiku' },
  nr: { morning: 'Lotjhani ekuseni', afternoon: 'Lotjhani emini', evening: 'Lotjhani ntambama', night: 'Usebenza ebusuku' },
} satisfies Record<SALanguage, TimeGreeting>;

// ============================================================================
// Buddy Profile Types
// ============================================================================

export type RelationshipStatus = 'stranger' | 'acquaintance' | 'friend' | 'bestie';
export type PreferredTone = 'formal' | 'casual' | 'sarcastic';
export type PersonalityMode = 'system' | 'dark' | 'goody';

export interface LanguageDetectionResult {
  language: SALanguage;
  confidence: number;
  matches: string[];
  source: 'keyword' | 'default' | 'user_preference';
  alternatives?: { language: SALanguage; score: number }[];
}

export interface BuddyProfile {
  id: string;
  // name is stored in Dexie memories (SPOT), not here
  preferredLanguage: SALanguage;
  preferredTone: PreferredTone;
  personalityMode: PersonalityMode; // 'system' | 'dark' | 'goody' - Default: 'goody'
  buddyPoints: number;
  totalInteractions: number;
  relationshipStatus: RelationshipStatus;
  humorEnabled: boolean; // Legacy field, now personality-aware
  lastInteraction: number;
  firstInteraction: number;
  location?: { city?: string; province?: string };
  interests: string[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Configuration
// ============================================================================

export const BUDDY_CONFIG = {
  CONTEXT_SIZE_LIMIT: 6000,  // Keep under 8K with headroom
  MAX_INTERESTS: 15,
  POINTS_PER_INTERACTION: 5,
  POINTS_MILESTONE_ACQUAINTANCE: 50,
  POINTS_MILESTONE_FRIEND: 200,
  POINTS_MILESTONE_BESTIE: 500,
  STORAGE_KEY: 'gogga_buddy_profile',
} as const;

// ============================================================================
// BuddySystem Class
// ============================================================================

class BuddySystem {
  private profile: BuddyProfile | null = null;
  private initialized = false;

  /**
   * Initialize or load the buddy profile
   */
  async initialize(): Promise<BuddyProfile> {
    if (this.initialized && this.profile) {
      return this.profile;
    }

    // Try to load from localStorage (simpler than separate Dexie table)
    const stored = localStorage.getItem(BUDDY_CONFIG.STORAGE_KEY);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        
        // Migration: Ensure personalityMode exists (for profiles created before this field)
        if (!parsed.personalityMode) {
          parsed.personalityMode = parsed.humorEnabled ? 'goody' : 'system';
          console.log('[BuddySystem] Migrated legacy profile, set personalityMode:', parsed.personalityMode);
        }
        
        this.profile = parsed;
        this.initialized = true;
        
        // Save migrated profile
        this.save();
        
        return this.profile!;
      } catch {
        console.warn('[BuddySystem] Failed to parse stored profile, creating new');
      }
    }

    // Create default profile
    this.profile = {
      id: `buddy_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      preferredLanguage: 'en',
      preferredTone: 'casual',
      personalityMode: 'goody', // Default: Goody Gogga (positive & uplifting)
      buddyPoints: 0,
      totalInteractions: 0,
      relationshipStatus: 'stranger',
      humorEnabled: true, // Legacy: now controlled via personalityMode
      lastInteraction: Date.now(),
      firstInteraction: Date.now(),
      interests: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.save();
    this.initialized = true;
    return this.profile;
  }

  /**
   * Save profile to localStorage
   */
  private save(): void {
    if (this.profile) {
      this.profile.updatedAt = Date.now();
      localStorage.setItem(BUDDY_CONFIG.STORAGE_KEY, JSON.stringify(this.profile));
    }
  }

  /**
   * Get current profile
   */
  getProfile(): BuddyProfile | null {
    return this.profile;
  }

  /**
   * Update user's name - saves to Dexie (SPOT)
   * This is called when user explicitly sets name via Dashboard or when AI detects it.
   * For AI-detected names, the AI should use the save_memory tool instead.
   */
  async setUserName(name: string, source: 'user' | 'gogga' = 'user'): Promise<void> {
    await this.initialize();
    if (name.trim()) {
      const cleanName = name.trim().replace(/[^a-zA-Z\s\-']/g, '').slice(0, 50);
      if (cleanName.length >= 2) {
        // Delete any existing name memories first (only gogga-created ones if source is gogga)
        const memories = await getActiveMemories();
        for (const mem of memories) {
          if (mem.title.toLowerCase().includes('my name is') || 
              mem.title.toLowerCase().includes('name is')) {
            // Delete the old name memory to replace it
            if (mem.id) {
              if (source === 'gogga' && mem.source === 'gogga') {
                await deleteGoggaMemory(mem.id);
              } else if (source === 'user') {
                // User can delete their own or gogga memories
                await deleteMemory(mem.id);
              }
            }
          }
        }
        
        // Save to Dexie only (SPOT for user name)
        await createMemory({
          title: `My name is ${cleanName}`,
          content: `The user's name is ${cleanName}. Always address them by name when appropriate.`,
          category: 'personal',
          priority: 10,
          source,
          isActive: true,
          tokenCount: 0,
        });
      }
    }
  }
  
  /**
   * Get user's name from Dexie memories (SPOT)
   */
  async getUserName(): Promise<string | undefined> {
    const memories = await getActiveMemories();
    // Look for name-related memories (highest priority first since memories are sorted)
    const nameMem = memories.find(
      m => m.category === 'personal' && 
           (m.title.toLowerCase().includes('my name is') ||
            m.title.toLowerCase().includes('name is') ||
            m.content.toLowerCase().includes("user's name is"))
    );
    
    if (nameMem) {
      // Extract name from title "My name is X" or content
      const titleMatch = nameMem.title.match(/name is\s+([\w\s\-']+)/i);
      if (titleMatch?.[1]) {
        return titleMatch[1].trim();
      }
      const contentMatch = nameMem.content.match(/name is\s+([\w\s\-']+)/i);
      if (contentMatch?.[1]) {
        return contentMatch[1].trim().split('.')[0]; // Stop at period
      }
    }
    return undefined;
  }

  /**
   * Update preferred language
   */
  async setPreferredLanguage(lang: SALanguage): Promise<void> {
    await this.initialize();
    if (this.profile && SA_LANGUAGES[lang]) {
      this.profile.preferredLanguage = lang;
      this.save();
    }
  }

  /**
   * Record an interaction and update buddy points
   */
  async recordInteraction(quality: 'positive' | 'neutral' | 'negative' = 'positive'): Promise<number> {
    await this.initialize();
    if (!this.profile) return 0;

    const points = quality === 'positive' ? BUDDY_CONFIG.POINTS_PER_INTERACTION 
                 : quality === 'neutral' ? 2 
                 : 0;

    this.profile.buddyPoints += points;
    this.profile.totalInteractions++;
    this.profile.lastInteraction = Date.now();

    // Update relationship status based on points
    if (this.profile.buddyPoints >= BUDDY_CONFIG.POINTS_MILESTONE_BESTIE) {
      this.profile.relationshipStatus = 'bestie';
    } else if (this.profile.buddyPoints >= BUDDY_CONFIG.POINTS_MILESTONE_FRIEND) {
      this.profile.relationshipStatus = 'friend';
    } else if (this.profile.buddyPoints >= BUDDY_CONFIG.POINTS_MILESTONE_ACQUAINTANCE) {
      this.profile.relationshipStatus = 'acquaintance';
    }

    this.save();
    return this.profile.buddyPoints;
  }

  /**
   * Add an interest (auto-extracted from conversations)
   */
  async addInterest(interest: string): Promise<void> {
    await this.initialize();
    if (!this.profile) return;

    const clean = interest.toLowerCase().trim();
    if (clean.length >= 3 && !this.profile.interests.includes(clean)) {
      this.profile.interests.push(clean);
      
      // Keep only recent interests
      if (this.profile.interests.length > BUDDY_CONFIG.MAX_INTERESTS) {
        this.profile.interests = this.profile.interests.slice(-BUDDY_CONFIG.MAX_INTERESTS);
      }
      
      this.save();
    }
  }

  /**
   * Update location
   */
  async setLocation(city?: string, province?: string): Promise<void> {
    await this.initialize();
    if (this.profile) {
      this.profile.location = { city, province };
      this.save();
    }
  }

  /**
   * Set personality mode
   * @param mode 'system' (balanced), 'dark' (sarcastic), 'goody' (positive)
   */
  async setPersonalityMode(mode: PersonalityMode): Promise<void> {
    await this.initialize();
    if (this.profile) {
      this.profile.personalityMode = mode;
      // Update legacy humorEnabled for backward compatibility
      this.profile.humorEnabled = mode !== 'system';
      this.save();
    }
  }

  /**
   * Get current personality mode
   */
  getPersonalityMode(): PersonalityMode {
    return this.profile?.personalityMode || 'goody';
  }

  /**
   * Toggle humor preference (Legacy method - now uses personality modes)
   * @deprecated Use setPersonalityMode() instead
   */
  async setHumorEnabled(enabled: boolean): Promise<void> {
    await this.initialize();
    if (this.profile) {
      // Map legacy boolean to personality modes
      if (enabled) {
        // If enabling humor and current mode is system, switch to goody (default)
        if (this.profile.personalityMode === 'system') {
          this.profile.personalityMode = 'goody';
        }
      } else {
        // Disabling humor means system mode
        this.profile.personalityMode = 'system';
      }
      this.profile.humorEnabled = enabled;
      this.save();
    }
  }

  /**
   * Get time-appropriate greeting in user's preferred language
   */
  getTimeGreeting(): { greeting: string; timeOfDay: string; emoji: string } {
    const hour = new Date().getHours();
    const lang = this.profile?.preferredLanguage || 'en';
    const greetings = TIME_GREETINGS[lang];
    
    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    let emoji: string;
    
    if (hour >= 5 && hour < 12) {
      timeOfDay = 'morning';
      emoji = '☀️';
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = 'afternoon';
      emoji = '🌤️';
    } else if (hour >= 17 && hour < 21) {
      timeOfDay = 'evening';
      emoji = '🌆';
    } else {
      timeOfDay = 'night';
      emoji = '🌙';
    }

    return {
      greeting: greetings[timeOfDay],
      timeOfDay,
      emoji,
    };
  }

  /**
   * Get personality-aware intro based on relationship level and personality mode
   */
  async getSarcasticIntro(): Promise<string> {
    if (!this.profile) return '';

    const { relationshipStatus, totalInteractions, personalityMode } = this.profile;
    // Read name from Dexie (SPOT)
    const name = await this.getUserName();
    const userName = name ? `, ${name}` : '';

    // System mode: neutral, professional greeting
    if (personalityMode === 'system') {
      return name ? `Hello ${name}, how can I help you today?` : 'Hello, how can I help you today?';
    }

    // Dark Gogga mode: sarcastic/witty
    if (personalityMode === 'dark') {
      const darkIntros: Record<RelationshipStatus, string[]> = {
        stranger: [
          `Howzit${userName}! I'm GOGGA - your new favorite AI. Don't worry, I don't bite... much.`,
          `Hey${userName}! First time? Buckle up, I'm GOGGA and I'm about to make your life easier.`,
          `Sawubona${userName}! I'm GOGGA. Yes, like the bug. No, I won't crawl into your ears.`,
        ],
        acquaintance: [
          `Back again${userName}? Starting to like me, aren't you?`,
          `Oh hey${userName}! Missed me? Don't lie, I can tell.`,
          `Look who's back${userName}! Let's get you sorted.`,
        ],
        friend: [
          `${name || 'Friend'}! My favorite human (don't tell the others).`,
          `Ayy${userName}! Ready to tackle the world together?`,
          `${name || 'Hey'}! Let's do this. What's cooking?`,
        ],
        bestie: [
          `${name || 'Bestie'}! My ride-or-die human is here!`,
          `Finally${userName}! I was getting bored without you.`,
          `${name || 'Legend'}! ${totalInteractions}+ chats and still going strong!`,
        ],
      };
      const options = darkIntros[relationshipStatus] ?? darkIntros.stranger;
      return options[Math.floor(Math.random() * options.length)] ?? options[0] ?? '';
    }

    // Goody Gogga mode (default): positive, uplifting, friendly
    const goodyIntros: Record<RelationshipStatus, string[]> = {
      stranger: [
        `Hello${userName}! I'm so happy to meet you! I'm GOGGA, and I'm here to help make your day amazing!`,
        `Welcome${userName}! What a wonderful opportunity to assist you today! I'm GOGGA, ready to help!`,
        `Hi there${userName}! I'm GOGGA, and I'm absolutely thrilled to work with you today!`,
      ],
      acquaintance: [
        `Great to see you again${userName}! I always love our conversations!`,
        `Welcome back${userName}! You brighten my day every time you're here!`,
        `Hello again${userName}! I'm excited to help you today!`,
      ],
      friend: [
        `${name || 'My friend'}! It's wonderful to see you! How can I help make your day even better?`,
        `Hey ${name || 'friend'}! I'm so glad you're here! Let's create something amazing together!`,
        `${name || 'Friend'}! Your visits always make my day! What can I help you with?`,
      ],
      bestie: [
        `${name || 'Bestie'}! You're here! This is going to be great - we always make the best team!`,
        `${name || 'My favorite person'}! ${totalInteractions}+ conversations and each one is a joy!`,
        `${name || 'Best friend'}! I'm so excited to help you today! Let's make magic happen!`,
      ],
    };
    const options = goodyIntros[relationshipStatus] ?? goodyIntros.stranger;
    return options[Math.floor(Math.random() * options.length)] ?? options[0] ?? '';
  }

  /**
   * Get AI context string combining buddy profile + user memories
   */
  async getAIContext(): Promise<string> {
    await this.initialize();
    const parts: string[] = [];

    if (this.profile) {
      const { preferredLanguage, preferredTone, relationshipStatus, personalityMode,
              buddyPoints, location, interests, totalInteractions } = this.profile;

      // Debug log for personality mode
      console.log('[BuddySystem] getAIContext - personalityMode:', personalityMode);

      // User identity - read from Dexie (SPOT)
      const name = await this.getUserName();
      if (name) {
        parts.push(`USER NAME: ${name}`);
      }

      // Relationship
      parts.push(`RELATIONSHIP: ${relationshipStatus} (${buddyPoints} buddy points, ${totalInteractions} interactions)`);
      
      // Language preference
      const langInfo = SA_LANGUAGES[preferredLanguage];
      parts.push(`PREFERRED LANGUAGE: ${langInfo.name} (${preferredLanguage})`);
      
      // Personality mode (the AI should follow this)
      const personalityDesc = {
        system: 'System Default (balanced, professional)',
        dark: 'Dark Gogga (sarcastic, witty)',
        goody: 'Goody Gogga (positive, uplifting)'
      }[personalityMode] || `Unknown (${personalityMode})`;
      parts.push(`PERSONALITY MODE: ${personalityDesc}`);
      parts.push(`TONE: ${preferredTone}`);

      // Location
      if (location?.city) {
        parts.push(`LOCATION: ${location.city}${location.province ? `, ${location.province}` : ''}`);
      }

      // Interests
      if (interests.length > 0) {
        parts.push(`INTERESTS: ${interests.slice(0, 10).join(', ')}`);
      }

      // Time awareness
      const time = this.getTimeGreeting();
      parts.push(`TIME CONTEXT: ${time.timeOfDay} in SA`);
    }

    // Get user-defined memories from the existing system
    try {
      const memories = await getActiveMemories();
      if (memories.length > 0) {
        parts.push('\nUSER MEMORIES:');
        for (const mem of memories.slice(0, 10)) {
          parts.push(`- [${mem.category}] ${mem.title}: ${mem.content.slice(0, 200)}${mem.content.length > 200 ? '...' : ''}`);
        }
      }
    } catch (err) {
      console.warn('[BuddySystem] Could not load memories:', err);
    }

    return parts.join('\n');
  }

  /**
   * Get buddy stats for display
   */
  async getStats(): Promise<{
    buddyPoints: number;
    relationshipStatus: RelationshipStatus;
    totalInteractions: number;
    daysSinceFirst: number;
    preferredLanguage: string;
    name?: string;
  }> {
    await this.initialize();
    
    if (!this.profile) {
      return {
        buddyPoints: 0,
        relationshipStatus: 'stranger',
        totalInteractions: 0,
        daysSinceFirst: 0,
        preferredLanguage: 'English',
      };
    }

    const daysSinceFirst = Math.floor(
      (Date.now() - this.profile.firstInteraction) / (1000 * 60 * 60 * 24)
    );

    // Read name from Dexie (SPOT)
    const name = await this.getUserName();

    return {
      buddyPoints: this.profile.buddyPoints,
      relationshipStatus: this.profile.relationshipStatus,
      totalInteractions: this.profile.totalInteractions,
      daysSinceFirst,
      preferredLanguage: SA_LANGUAGES[this.profile.preferredLanguage].name,
      name,
    };
  }

  /**
   * Detect language from user message with confidence scoring
   */
  detectLanguage(message: string): SALanguage | null {
    const result = this.detectLanguageWithConfidence(message);
    return result.confidence >= 60 ? result.language : null;
  }

  /**
   * Enhanced language detection with confidence scoring
   * Returns language, confidence (0-100), and matched keywords
   */
  detectLanguageWithConfidence(message: string): LanguageDetectionResult {
    const lower = message.toLowerCase().trim();
    
    if (!lower) {
      return { language: 'en', confidence: 100, matches: [], source: 'default' };
    }

    // Comprehensive keyword patterns with weights
    const languagePatterns: Record<SALanguage, { patterns: RegExp[]; weight: number }[]> = {
      af: [
        { patterns: [/\b(dankie|asseblief|baie|goeie)\b/], weight: 90 },
        { patterns: [/\b(ek is|ek het|ek wil|ek kan)\b/], weight: 85 },
        { patterns: [/\b(wat is|hoe gaan|lekker|nee|ja)\b/], weight: 70 },
        { patterns: [/\b(môre|middag|aand|naand)\b/], weight: 80 },
        { patterns: [/\b(dis|dit is|daar is|hier is)\b/], weight: 75 },
        { patterns: [/\b(eish|ag|sjoe|yoh)\b/], weight: 50 }, // SA slang (shared)
      ],
      zu: [
        { patterns: [/\b(sawubona|sanibonani|ngiyabonga|siyabonga)\b/], weight: 95 },
        { patterns: [/\b(yebo|cha|kunjani|unjani)\b/], weight: 85 },
        { patterns: [/\b(ngingu|ngifuna|angazi|ngiyakuthanda)\b/], weight: 90 },
        { patterns: [/\b(inkosi|umuntu|abantu|ubuntu)\b/], weight: 80 },
        { patterns: [/\b(hamba|sala|kahle|ngaphandle)\b/], weight: 75 },
      ],
      xh: [
        { patterns: [/\b(molo|molweni|enkosi|siyabulela)\b/], weight: 95 },
        { patterns: [/\b(ewe|hayi|kunjani|unjani)\b/], weight: 85 },
        { patterns: [/\b(ndingu|ndifuna|andazi|ndiyakuthanda)\b/], weight: 90 },
        { patterns: [/\b(ukuxolisa|uxolo|nceda)\b/], weight: 85 },
        { patterns: [/\b(hamba|sala|kakuhle)\b/], weight: 75 },
      ],
      nso: [
        { patterns: [/\b(dumela|thobela|ke a leboga)\b/], weight: 95 },
        { patterns: [/\b(ee|aowa|bjang|o kae)\b/], weight: 80 },
        { patterns: [/\b(ke|o|re|ba)\s+[a-z]/], weight: 60 },
        { patterns: [/\b(gabotse|gabonolo)\b/], weight: 85 },
      ],
      tn: [
        { patterns: [/\b(dumela|dumelang|ke a leboga)\b/], weight: 95 },
        { patterns: [/\b(ee rra|ee mma|nnyaa)\b/], weight: 90 },
        { patterns: [/\b(o kae|ke|re|ba)\b/], weight: 70 },
        { patterns: [/\b(sentle|thata|jaanong)\b/], weight: 80 },
      ],
      st: [
        { patterns: [/\b(dumela|dumelang|kea leboha)\b/], weight: 95 },
        { patterns: [/\b(e|che|u kae|ke)\b/], weight: 70 },
        { patterns: [/\b(hantle|haholo|jwale)\b/], weight: 85 },
        { patterns: [/\b(ntate|mme|ngwana)\b/], weight: 80 },
      ],
      ts: [
        { patterns: [/\b(avuxeni|xewani|ndza khensa)\b/], weight: 95 },
        { patterns: [/\b(ina|e-e|u kona|hi kona)\b/], weight: 85 },
        { patterns: [/\b(ndzi|hi|va|mi)\s+[a-z]/], weight: 65 },
        { patterns: [/\b(kahle|swinene)\b/], weight: 80 },
      ],
      ss: [
        { patterns: [/\b(sawubona|sanibonani|ngiyabonga)\b/], weight: 90 },
        { patterns: [/\b(yebo|cha|unjani|kunjani)\b/], weight: 80 },
        { patterns: [/\b(ngingu|make|babe)\b/], weight: 85 },
        { patterns: [/\b(kahle|kakhulu)\b/], weight: 75 },
      ],
      ve: [
        { patterns: [/\b(ndaa|matsheloni|ndo livhuwa)\b/], weight: 95 },
        { patterns: [/\b(ee|hai|ni khou|vho)\b/], weight: 85 },
        { patterns: [/\b(ndi|ri|vha|u)\s+[a-z]/], weight: 65 },
        { patterns: [/\b(zwavhudi|vhukuma)\b/], weight: 85 },
      ],
      nr: [
        { patterns: [/\b(lotjhani|salibonani|ngiyathokoza)\b/], weight: 95 },
        { patterns: [/\b(yebo|awa|unjani)\b/], weight: 80 },
        { patterns: [/\b(ngingu|baba|mama)\b/], weight: 85 },
        { patterns: [/\b(kuhle|khulu)\b/], weight: 75 },
      ],
      en: [
        { patterns: [/\b(hello|hi|hey|thanks|please|sorry)\b/], weight: 60 },
        { patterns: [/\b(the|is|are|was|were|have|has)\b/], weight: 40 },
        { patterns: [/\b(howzit|lekker|eish|yoh|shame)\b/], weight: 50 }, // SA English
      ],
    };

    // Calculate scores for each language
    const scores: { lang: SALanguage; score: number; matches: string[] }[] = [];
    
    for (const [lang, patternGroups] of Object.entries(languagePatterns) as [SALanguage, typeof languagePatterns.af][]) {
      let totalScore = 0;
      const matches: string[] = [];
      
      for (const { patterns, weight } of patternGroups) {
        for (const pattern of patterns) {
          const match = lower.match(pattern);
          if (match) {
            totalScore += weight;
            matches.push(match[0]);
          }
        }
      }
      
      if (totalScore > 0) {
        scores.push({ lang, score: totalScore, matches });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // If no matches, default to English
    if (scores.length === 0) {
      return { language: 'en', confidence: 50, matches: [], source: 'default' };
    }

    const best = scores[0];
    if (!best) {
      return { language: 'en', confidence: 50, matches: [], source: 'default' };
    }
    const secondBest = scores[1];

    // Calculate confidence based on score difference and absolute score
    let confidence = Math.min(best.score, 100);
    
    // Reduce confidence if scores are close
    if (secondBest && best.score - secondBest.score < 20) {
      confidence = Math.max(confidence - 15, 50);
    }

    return {
      language: best.lang,
      confidence: Math.round(confidence),
      matches: best.matches,
      source: 'keyword',
      alternatives: scores.slice(1, 3).map(s => ({ language: s.lang, score: s.score })),
    };
  }

  /**
   * Detect and extract user name from message
   */
  detectUserName(message: string): string | null {
    const patterns = [
      /(?:my name is|i'm|i am|call me|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /^([A-Z][a-z]+)\s+here/i,
      /(?:^|\s)(?:ek is|ngingu|ndingu|ke)\s+([A-Z][a-z]+)/i, // SA language patterns
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Filter out common false positives
        const excluded = ['hello', 'hi', 'hey', 'good', 'fine', 'okay', 'thanks', 'sorry'];
        if (!excluded.includes(name.toLowerCase()) && name.length >= 2 && name.length <= 30) {
          return name;
        }
      }
    }

    return null;
  }

  /**
   * Process a user message - detect language, update stats
   * NOTE: Name detection removed - AI handles name storage via tool calling
   * This prevents race conditions and ensures Dexie is the true SPOT
   */
  async processUserMessage(message: string): Promise<void> {
    await this.initialize();

    // Detect and update language if found
    const detectedLang = this.detectLanguage(message);
    if (detectedLang) {
      await this.setPreferredLanguage(detectedLang);
    }

    // NOTE: Name detection removed - AI uses save_memory tool to store names
    // This ensures only one system (tool calling) manages the memories in Dexie

    // Record the interaction
    await this.recordInteraction('positive');
  }

  /**
   * Clear all buddy data (for testing/reset)
   */
  async clearAllData(): Promise<void> {
    localStorage.removeItem(BUDDY_CONFIG.STORAGE_KEY);
    this.profile = null;
    this.initialized = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const buddySystem = new BuddySystem();

// Initialize on import (non-blocking)
if (typeof window !== 'undefined') {
  buddySystem.initialize().catch(console.error);
}
