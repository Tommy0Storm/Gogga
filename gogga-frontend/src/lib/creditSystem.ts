/**
 * GOGGA Credit System (Frontend)
 * 
 * Handles credit checks, tier limit displays, and deduction tracking.
 * Works with RxDB for offline state and syncs with backend.
 * 
 * Credit Flow:
 * 1. Subscription limits checked first
 * 2. If exceeded → use credit balance (with tier restrictions)
 * 3. If no credits → fall back to free tier for chat only
 * 4. Non-chat actions denied if no credits
 * 
 * @see .serena/memories/credit_token_system.md
 */

// ============================================
// PRICING CONSTANTS (Verified Dec 2025)
// ============================================

/** USD costs per action (used for display only, actual billing is backend) */
export const COSTS = {
  // Cerebras Qwen 32B ($0.40 input + $0.80 output per M)
  CHAT_32B_PER_M_INPUT: 0.40,
  CHAT_32B_PER_M_OUTPUT: 0.80,
  
  // Cerebras Qwen 235B ($0.60 input + $1.20 output per M)
  CHAT_235B_PER_M_INPUT: 0.60,
  CHAT_235B_PER_M_OUTPUT: 1.20,
  
  // Vertex AI Imagen
  IMAGE_CREATE: 0.04,  // Imagen 3 generate
  IMAGE_EDIT: 0.04,    // Imagen 3 edit
  UPSCALE: 0.06,       // Imagen 4 upscale
  
  // Vertex AI Veo
  VIDEO_PER_SEC: 0.20, // Veo 2 video only
  
  // Gemini Live (GoggaTalk)
  GOGGA_TALK_PER_MIN: 0.0225, // Estimated from audio token costs
} as const;

/** Exchange rate: ZAR per 1 USD */
export const ZAR_USD_RATE = 19;

/** Credit value: 1 credit = $0.10 USD */
export const CREDIT_VALUE_USD = 0.10;

// ============================================
// CREDIT COSTS PER ACTION
// ============================================

export const CREDIT_COSTS = {
  CHAT_10K_TOKENS: 1,    // 1 credit per 10K tokens
  IMAGE_CREATE: 1,       // 1 credit per image
  IMAGE_EDIT: 1,         // 1 credit per edit
  UPSCALE: 1,            // 1 credit per upscale
  VIDEO_SECOND: 2,       // 2 credits per second
  GOGGA_TALK_MIN: 1,     // 1 credit per minute
} as const;

// ============================================
// TIER LIMITS (Monthly)
// ============================================

export type Tier = 'FREE' | 'JIVE' | 'JIGGA';

export interface TierLimits {
  price_zar: number;
  chat_tokens: number;
  images: number;
  image_edits: number;
  upscales: number;
  video_seconds: number;
  gogga_talk_mins: number;
  credit_pack_restrictions: ActionType[] | null;  // null = no restrictions
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  FREE: {
    price_zar: 0,
    chat_tokens: Infinity,  // Unlimited but slow
    images: 50,             // Pollinations free tier
    image_edits: 0,
    upscales: 0,
    video_seconds: 0,
    gogga_talk_mins: 0,
    credit_pack_restrictions: null, // Cannot purchase
  },
  JIVE: {
    price_zar: 99,
    chat_tokens: 500_000,
    images: 20,
    image_edits: 0,
    upscales: 0,
    video_seconds: 5,
    gogga_talk_mins: 30,
    // Can only use credits for: chat, image_create, gogga_talk
    credit_pack_restrictions: ['chat_10k_tokens', 'image_create', 'gogga_talk_min'],
  },
  JIGGA: {
    price_zar: 299,
    chat_tokens: 2_000_000,
    images: 70,
    image_edits: 30,
    upscales: 10,
    video_seconds: 16,
    gogga_talk_mins: 25,
    credit_pack_restrictions: null,  // No restrictions
  },
};

// ============================================
// CREDIT PACKS
// ============================================

export interface CreditPack {
  id: string;
  credits: number;
  price_zar: number;
  bonus?: number;  // e.g., 0.17 = 17% bonus credits
  tier: 'JIVE' | 'JIGGA';
}

export const CREDIT_PACKS: CreditPack[] = [
  // JIVE packs (restricted features)
  { id: 'jive_starter', credits: 50, price_zar: 49, tier: 'JIVE' },
  { id: 'jive_standard', credits: 100, price_zar: 89, tier: 'JIVE' },
  { id: 'jive_plus', credits: 175, price_zar: 129, bonus: 0.17, tier: 'JIVE' },
  
  // JIGGA packs (all features)
  { id: 'jigga_pro', credits: 150, price_zar: 149, tier: 'JIGGA' },
  { id: 'jigga_business', credits: 320, price_zar: 279, bonus: 0.07, tier: 'JIGGA' },
  { id: 'jigga_enterprise', credits: 700, price_zar: 549, bonus: 0.17, tier: 'JIGGA' },
];

// ============================================
// ACTION TYPES
// ============================================

export type ActionType = 
  | 'chat_10k_tokens'
  | 'image_create'
  | 'image_edit'
  | 'upscale'
  | 'video_second'
  | 'gogga_talk_min';

export type DeductionSource = 'subscription' | 'credits' | 'free';

// ============================================
// USAGE STATE
// ============================================

export interface UsageState {
  tier: Tier;
  creditBalance: number;
  usageChatTokens: number;
  usageImages: number;
  usageImageEdits: number;
  usageUpscales: number;
  usageVideoSeconds: number;
  usageGoggaTalkMins: number;
}

export interface ActionCheckResult {
  allowed: boolean;
  source: DeductionSource | null;
  creditsNeeded: number;
  reason?: string;
  fallbackModel?: string;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Check if action is allowed and determine billing source.
 */
export function checkActionAllowed(
  state: UsageState,
  action: ActionType,
  quantity: number = 1
): ActionCheckResult {
  const limits = TIER_LIMITS[state.tier];
  const creditCost = getCreditCost(action);
  const creditsNeeded = creditCost * quantity;
  
  // Map action to usage field
  const usageMap: Record<ActionType, { limit: number; used: number; increment: number }> = {
    chat_10k_tokens: { 
      limit: limits.chat_tokens, 
      used: state.usageChatTokens, 
      increment: quantity * 10_000 
    },
    image_create: { 
      limit: limits.images, 
      used: state.usageImages, 
      increment: quantity 
    },
    image_edit: { 
      limit: limits.image_edits, 
      used: state.usageImageEdits, 
      increment: quantity 
    },
    upscale: { 
      limit: limits.upscales, 
      used: state.usageUpscales, 
      increment: quantity 
    },
    video_second: { 
      limit: limits.video_seconds, 
      used: state.usageVideoSeconds, 
      increment: quantity 
    },
    gogga_talk_min: { 
      limit: limits.gogga_talk_mins, 
      used: state.usageGoggaTalkMins, 
      increment: quantity 
    },
  };
  
  const { limit, used, increment } = usageMap[action];
  
  // Step 1: Check subscription limit
  if (used + increment <= limit) {
    return {
      allowed: true,
      source: 'subscription',
      creditsNeeded: 0,
    };
  }
  
  // Step 2: Check tier restrictions for credits
  if (limits.credit_pack_restrictions !== null) {
    if (!limits.credit_pack_restrictions.includes(action)) {
      // JIVE can't use credits for this action
      if (action === 'chat_10k_tokens') {
        return {
          allowed: true,
          source: 'free',
          creditsNeeded: 0,
          fallbackModel: 'qwen/qwen3-235b-a22b:free',
        };
      }
      return {
        allowed: false,
        source: null,
        creditsNeeded,
        reason: `${state.tier} credits cannot be used for ${action}. Upgrade to JIGGA.`,
      };
    }
  }
  
  // Step 3: Check credit balance
  if (state.creditBalance >= creditsNeeded) {
    return {
      allowed: true,
      source: 'credits',
      creditsNeeded,
    };
  }
  
  // Step 4: Fall back to free tier for chat only
  if (action === 'chat_10k_tokens') {
    return {
      allowed: true,
      source: 'free',
      creditsNeeded: 0,
      fallbackModel: 'qwen/qwen3-235b-a22b:free',
    };
  }
  
  // Step 5: Deny non-chat actions
  return {
    allowed: false,
    source: null,
    creditsNeeded,
    reason: `Insufficient credits. Need ${creditsNeeded}, have ${state.creditBalance}.`,
  };
}

/**
 * Get credit cost for an action.
 */
export function getCreditCost(action: ActionType): number {
  const costs: Record<ActionType, number> = {
    chat_10k_tokens: CREDIT_COSTS.CHAT_10K_TOKENS,
    image_create: CREDIT_COSTS.IMAGE_CREATE,
    image_edit: CREDIT_COSTS.IMAGE_EDIT,
    upscale: CREDIT_COSTS.UPSCALE,
    video_second: CREDIT_COSTS.VIDEO_SECOND,
    gogga_talk_min: CREDIT_COSTS.GOGGA_TALK_MIN,
  };
  return costs[action];
}

/**
 * Calculate credits needed for token count.
 * 1 credit per 10K tokens, rounded up.
 */
export function calculateTokenCredits(totalTokens: number): number {
  if (totalTokens <= 0) return 0;
  return Math.ceil(totalTokens / 10_000);
}

/**
 * Format credit balance for display.
 */
export function formatCredits(credits: number): string {
  if (credits < 0) {
    return `-${Math.abs(credits).toLocaleString()}`;
  }
  return credits.toLocaleString();
}

/**
 * Calculate estimated cost in ZAR for display.
 */
export function estimateCostZAR(action: ActionType, quantity: number = 1): number {
  const costUSD = getCreditCost(action) * quantity * CREDIT_VALUE_USD;
  return Math.round(costUSD * ZAR_USD_RATE * 100) / 100;
}

/**
 * Get available credit packs for a tier.
 */
export function getAvailablePacks(tier: Tier): CreditPack[] {
  if (tier === 'FREE') return [];
  return CREDIT_PACKS.filter(pack => pack.tier === tier);
}

/**
 * Calculate remaining usage for display.
 */
export function getRemainingUsage(state: UsageState): {
  chatTokens: number | 'unlimited';
  images: number;
  imageEdits: number;
  upscales: number;
  videoSeconds: number;
  goggaTalkMins: number;
} {
  const limits = TIER_LIMITS[state.tier];
  
  return {
    chatTokens: limits.chat_tokens === Infinity 
      ? 'unlimited' 
      : Math.max(0, limits.chat_tokens - state.usageChatTokens),
    images: Math.max(0, limits.images - state.usageImages),
    imageEdits: Math.max(0, limits.image_edits - state.usageImageEdits),
    upscales: Math.max(0, limits.upscales - state.usageUpscales),
    videoSeconds: Math.max(0, limits.video_seconds - state.usageVideoSeconds),
    goggaTalkMins: Math.max(0, limits.gogga_talk_mins - state.usageGoggaTalkMins),
  };
}

/**
 * Check if user needs to purchase credits soon.
 */
export function shouldShowCreditWarning(state: UsageState): boolean {
  const remaining = getRemainingUsage(state);
  const limits = TIER_LIMITS[state.tier];
  
  // Warn when below 20% of any limit
  const warningThreshold = 0.2;
  
  if (remaining.chatTokens !== 'unlimited' && 
      remaining.chatTokens < limits.chat_tokens * warningThreshold) {
    return true;
  }
  
  if (remaining.images < limits.images * warningThreshold) {
    return true;
  }
  
  return false;
}
