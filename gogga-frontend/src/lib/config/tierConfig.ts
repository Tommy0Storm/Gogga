/**
 * Tier Configuration with TypeScript 5.5 Control Flow Narrowing
 * 
 * Centralizes tier-based routing logic to mirror backend router.py structure.
 * Uses `as const` for TypeScript to properly narrow config access.
 * 
 * TWO UPLOAD MECHANISMS:
 * - 📎 Paperclip (Session Docs): Temporary docs for current chat (all tiers)
 * - 📚 RAG Button: Persistent document store with semantic search (JIVE/JIGGA)
 */

export type Tier = 'free' | 'jive' | 'jigga';
export type RagMode = 'analysis' | 'authoritative';  // analysis = default, authoritative = strict citation

export interface TierConfig {
  // 📚 RAG Document Store (JIVE limited, JIGGA full)
  readonly ragEnabled: boolean;
  readonly ragMaxDocs: number;           // Max docs in RAG store
  readonly ragMaxStorageMB: number;      // Max RAG storage
  readonly ragMaxFileSizeMB: number;     // Max file size for RAG
  
  // 📎 Paperclip - Session Documents (all tiers)
  readonly sessionDocsEnabled: boolean;
  readonly sessionMaxDocs: number;       // Max docs per chat session
  readonly sessionMaxStorageMB: number;  // Max session storage
  readonly sessionMaxFileSizeMB: number; // Max file size for session
  
  // Features
  readonly semantic: boolean;
  readonly embeddingModel?: string;
  readonly imageLimit: number;
  readonly modelName: string;
}

/**
 * TypeScript 5.9: Using Record type for compile-time tier validation
 */
type TierConfigMap = Record<Tier, TierConfig>;

/**
 * Tier configurations matching backend router.py limits.
 * TypeScript 5.9: Using `satisfies` for type checking without losing literal types.
 * 
 * 📎 Paperclip (Session Docs):
 *   - FREE: 1 doc, 2MB (enticement)
 *   - JIVE/JIGGA: 10 docs, 50MB
 * 
 * 📚 RAG Store:
 *   - FREE: Disabled (shows upgrade promo)
 *   - JIVE: 1 doc, 5MB (enticement)
 *   - JIGGA: 200 docs, 250MB (full)
 */
const TIER_CONFIGS = {
  free: {
    // 📚 RAG disabled - shows upgrade promo
    ragEnabled: false,
    ragMaxDocs: 0,
    ragMaxStorageMB: 0,
    ragMaxFileSizeMB: 0,
    // 📎 Paperclip enabled - 1 doc enticement!
    sessionDocsEnabled: true,
    sessionMaxDocs: 1,              // Just 1 doc to taste the feature
    sessionMaxStorageMB: 2,         // 2MB max
    sessionMaxFileSizeMB: 2,        // 2MB max file size
    // Features - no semantic, uses OpenRouter
    semantic: false,
    imageLimit: 50,
    modelName: 'Qwen 235B (OpenRouter)',
  },
  jive: {
    // 📚 RAG enabled - LIMITED (1 doc enticement to upgrade)
    ragEnabled: true,
    ragMaxDocs: 1,              // Only 1 RAG doc - taste of the feature
    ragMaxStorageMB: 5,         // 5MB max RAG storage
    ragMaxFileSizeMB: 5,        // 5MB max file size
    // 📎 Paperclip enabled (chat upload)
    sessionDocsEnabled: true,
    sessionMaxDocs: 10,
    sessionMaxStorageMB: 50,
    sessionMaxFileSizeMB: 10,
    // Features - JIVE gets keyword + semantic search on their 1 RAG doc
    semantic: true,             // Enable semantic search for enticement
    imageLimit: 200,
    modelName: 'Qwen 32B',
  },
  jigga: {
    // 📚 RAG enabled (full semantic document store)
    ragEnabled: true,
    ragMaxDocs: 200,
    ragMaxStorageMB: 250,
    ragMaxFileSizeMB: 25,
    // 📎 Paperclip also enabled
    sessionDocsEnabled: true,
    sessionMaxDocs: 10,
    sessionMaxStorageMB: 50,
    sessionMaxFileSizeMB: 10,
    // Features - full semantic + authoritative mode
    semantic: true,
    imageLimit: 1000,
    modelName: 'Qwen 32B',
  },
} satisfies TierConfigMap;

/**
 * Get tier-specific configuration with mode overrides.
 * TypeScript 5.9: const type parameter for better type inference.
 */
export function getTierConfig<const T extends Tier>(tier: T, mode?: RagMode): TierConfig {
  const baseConfig = TIER_CONFIGS[tier];

  // TypeScript 5.5: Knows tier is 'jigga' in this branch
  if (baseConfig.semantic && mode === 'analysis') {
    return {
      ...baseConfig,
      embeddingModel: 'e5-small-v2',
    };
  }

  // Authoritative mode is semantic + strict citation requirements (JIGGA only)
  if (baseConfig.semantic && mode === 'authoritative') {
    return {
      ...baseConfig,
      embeddingModel: 'e5-small-v2',
    };
  }

  return baseConfig;
}

/**
 * Check if user can upload RAG documents (JIGGA only).
 */
export function canUploadRAGDocuments(tier: Tier): boolean {
  return TIER_CONFIGS[tier].ragEnabled;
}

/**
 * Check if user can upload session documents (chat upload - JIVE & JIGGA).
 */
export function canUploadSessionDocuments(tier: Tier): boolean {
  return TIER_CONFIGS[tier].sessionDocsEnabled;
}

/**
 * Check if user can upload any documents (session or RAG).
 * @deprecated Use canUploadSessionDocuments or canUploadRAGDocuments instead
 */
export function canUploadDocuments(tier: Tier): boolean {
  return TIER_CONFIGS[tier].sessionDocsEnabled || TIER_CONFIGS[tier].ragEnabled;
}

/**
 * Check if user can select documents across sessions (JIGGA only).
 */
export function canSelectAcrossSessions(tier: Tier): boolean {
  return tier === 'jigga';
}

/**
 * Check if user can use semantic RAG (JIGGA only).
 */
export function canUseSemanticRAG(tier: Tier): boolean {
  return TIER_CONFIGS[tier].semantic;
}

/**
 * Check if user can generate more images this month.
 */
export function canGenerateImages(tier: Tier, usedThisMonth: number): boolean {
  return usedThisMonth < TIER_CONFIGS[tier].imageLimit;
}

/**
 * Get remaining image generation quota.
 */
export function getRemainingImageQuota(tier: Tier, usedThisMonth: number): number {
  const limit = TIER_CONFIGS[tier].imageLimit;
  return Math.max(0, limit - usedThisMonth);
}

/**
 * Get max RAG documents allowed (JIGGA only).
 */
export function getMaxRAGDocs(tier: Tier): number {
  return TIER_CONFIGS[tier].ragMaxDocs;
}

/**
 * Get max session documents per chat.
 */
export function getMaxSessionDocs(tier: Tier): number {
  return TIER_CONFIGS[tier].sessionMaxDocs;
}

/**
 * Get max documents allowed per session.
 * @deprecated Use getMaxSessionDocs or getMaxRAGDocs instead
 */
export function getMaxDocsPerSession(tier: Tier): number {
  // For backward compatibility, return session docs limit
  return TIER_CONFIGS[tier].sessionMaxDocs;
}

/**
 * Calculate remaining RAG document slots.
 */
export function getRemainingRAGSlots(tier: Tier, currentRAGDocCount: number): number {
  const max = TIER_CONFIGS[tier].ragMaxDocs;
  return Math.max(0, max - currentRAGDocCount);
}

/**
 * Calculate remaining session document slots.
 */
export function getRemainingSessionSlots(tier: Tier, currentSessionDocCount: number): number {
  const max = TIER_CONFIGS[tier].sessionMaxDocs;
  return Math.max(0, max - currentSessionDocCount);
}

/**
 * Calculate remaining document slots.
 * @deprecated Use getRemainingRAGSlots or getRemainingSessionSlots instead
 */
export function getRemainingDocSlots(
  tier: Tier,
  currentDocCount: number,
  selectedDocCount: number = 0
): number {
  const max = TIER_CONFIGS[tier].ragMaxDocs || TIER_CONFIGS[tier].sessionMaxDocs;
  const used = currentDocCount + selectedDocCount;
  return Math.max(0, max - used);
}

/**
 * Get storage limits for a tier.
 */
export function getStorageLimits(tier: Tier): {
  ragMaxMB: number;
  ragMaxFileMB: number;
  sessionMaxMB: number;
  sessionMaxFileMB: number;
} {
  const config = TIER_CONFIGS[tier];
  return {
    ragMaxMB: config.ragMaxStorageMB,
    ragMaxFileMB: config.ragMaxFileSizeMB,
    sessionMaxMB: config.sessionMaxStorageMB,
    sessionMaxFileMB: config.sessionMaxFileSizeMB,
  };
}

/**
 * Blocked file extensions (executables, binaries, media).
 */
export const BLOCKED_EXTENSIONS = [
  // Executables
  '.exe', '.dll', '.so', '.dylib', '.bin', '.app', '.dmg', '.msi', '.deb', '.rpm',
  // Potentially dangerous scripts
  '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.wsf',
  // Archives (not directly text-extractable)
  '.zip', '.tar', '.gz', '.7z', '.rar',
  // Media (not text-extractable)
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.ogg',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico',
  // Database files
  '.db', '.sqlite', '.mdb',
  // Compiled/Binary
  '.class', '.pyc', '.o', '.obj', '.wasm',
] as const;

/**
 * Check if a file extension is blocked.
 */
export function isBlockedExtension(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return BLOCKED_EXTENSIONS.includes(ext as typeof BLOCKED_EXTENSIONS[number]);
}
