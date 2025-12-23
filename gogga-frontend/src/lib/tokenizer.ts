/**
 * GOGGA Token Counting Utility
 * 
 * Client-side token counting using gpt-tokenizer for accurate context management.
 * Uses cl100k_base encoding (compatible with Qwen via OpenAI tiktoken approximation).
 * 
 * Features:
 * - countTokens: Count tokens in text or chat messages
 * - estimateTokens: Estimate with cost calculation
 * - canSendMessage: Pre-flight check against tier budgets
 * - isWithinBudget: Check specific budget category
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md - Token Budget Allocation
 */

import { encode, isWithinTokenLimit, countTokens as gptCountTokens } from 'gpt-tokenizer';

// Token budget allocation per tier (synchronized with RAGDebugPanel)
export const TOKEN_BUDGETS = {
  free: { systemPrompt: 500, state: 1000, sessionDoc: 2000, rag: 0, volatile: 4000, response: 4000, total: 11500 },
  jive: { systemPrompt: 1000, state: 2000, sessionDoc: 4000, rag: 3000, volatile: 6000, response: 5000, total: 21000 },
  jigga: { systemPrompt: 1500, state: 3000, sessionDoc: 4000, rag: 6000, volatile: 8000, response: 8000, total: 30500 },
} as const;

// Exchange rate ZAR/USD (December 2025)
export const ZAR_USD_RATE = 18.50;

// Pricing per 1M tokens (in USD) - synchronized with backend config.py
// Converted to ZAR using ZAR_USD_RATE for display
export const TOKEN_PRICING_USD = {
  // Cerebras Qwen 32B (JIVE/JIGGA)
  cerebras: {
    input: 0.10,   // $0.10 per 1M input tokens
    output: 0.10,  // $0.10 per 1M output tokens
  },
  // OpenRouter FREE tier fallback
  openrouter_free: {
    input: 0.00,
    output: 0.00,
  },
  // OpenRouter Qwen 235B (complex queries)
  openrouter_235b: {
    input: 0.80,   // $0.80 per 1M input tokens
    output: 1.10,  // $1.10 per 1M output tokens
  },
} as const;

// OptiLLM reasoning multipliers (synchronized with backend config.py)
export const OPTILLM_MULTIPLIERS = {
  none: 1.0,
  basic: 1.1,    // FREE: SPL + Re-Read only
  standard: 1.3, // JIVE: + CoT Reflection
  advanced: 1.5, // JIGGA: + Planning + Empathy
} as const;

export type Tier = keyof typeof TOKEN_BUDGETS;
export type BudgetCategory = keyof Omit<typeof TOKEN_BUDGETS.free, 'total'>;

interface TokenCountResult {
  count: number;
  exceedsLimit: boolean;
  limit: number;
  remaining: number;
}

interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostZar: number;
  tier: Tier;
}

interface CanSendResult {
  canSend: boolean;
  reason?: string;
  inputTokens: number;
  remainingBudget: number;
  budgetCategory: BudgetCategory;
}

/**
 * Count tokens in text using gpt-tokenizer
 * 
 * @param text - Text to count tokens for
 * @returns Number of tokens
 */
export function countTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return gptCountTokens(text);
}

/**
 * Count tokens with limit check
 * 
 * @param text - Text to count tokens for
 * @param limit - Maximum allowed tokens
 * @returns Token count result with limit info
 */
export function countTokensWithLimit(text: string, limit: number): TokenCountResult {
  const result = isWithinTokenLimit(text, limit);
  
  if (result === false) {
    // Exceeded limit - count actual tokens
    const count = countTokens(text);
    return {
      count,
      exceedsLimit: true,
      limit,
      remaining: limit - count,
    };
  }
  
  return {
    count: result,
    exceedsLimit: false,
    limit,
    remaining: limit - result,
  };
}

/**
 * Check if text fits within a specific budget category
 * 
 * @param text - Text to check
 * @param tier - User tier (free, jive, jigga)
 * @param category - Budget category to check against
 * @returns TokenCountResult with budget info
 */
export function isWithinBudget(
  text: string,
  tier: Tier,
  category: BudgetCategory
): TokenCountResult {
  const budget = TOKEN_BUDGETS[tier][category];
  return countTokensWithLimit(text, budget);
}

/**
 * Estimate tokens and cost for a message
 * 
 * @param inputText - User input text
 * @param estimatedOutputTokens - Expected output tokens (default: 500)
 * @param tier - User tier
 * @returns Token estimate with cost in ZAR
 */
export function estimateTokens(
  inputText: string,
  estimatedOutputTokens: number = 500,
  tier: Tier = 'free'
): TokenEstimate {
  const inputTokens = countTokens(inputText);
  const totalTokens = inputTokens + estimatedOutputTokens;
  
  // Select pricing based on tier (in USD)
  const pricing = tier === 'free' 
    ? TOKEN_PRICING_USD.openrouter_free
    : TOKEN_PRICING_USD.cerebras;
  
  // Calculate cost in USD (price is per 1M tokens), then convert to ZAR
  const inputCostUsd = (inputTokens / 1_000_000) * pricing.input;
  const outputCostUsd = (estimatedOutputTokens / 1_000_000) * pricing.output;
  const estimatedCostZar = (inputCostUsd + outputCostUsd) * ZAR_USD_RATE;
  
  return {
    inputTokens,
    outputTokens: estimatedOutputTokens,
    totalTokens,
    estimatedCostZar,
    tier,
  };
}

/**
 * Pre-flight check: Can this message be sent within budget?
 * 
 * Checks the message against the volatile memory budget (conversation history).
 * 
 * @param messageText - The message to check
 * @param tier - User tier
 * @param currentVolatileTokens - Tokens already used in conversation
 * @returns Whether the message can be sent and details
 */
export function canSendMessage(
  messageText: string,
  tier: Tier,
  currentVolatileTokens: number = 0
): CanSendResult {
  const messageTokens = countTokens(messageText);
  const budget = TOKEN_BUDGETS[tier].volatile;
  const remaining = budget - currentVolatileTokens;
  
  if (messageTokens > remaining) {
    return {
      canSend: false,
      reason: `Message (${messageTokens} tokens) exceeds remaining budget (${remaining} tokens). Consider starting a new session.`,
      inputTokens: messageTokens,
      remainingBudget: remaining,
      budgetCategory: 'volatile',
    };
  }
  
  return {
    canSend: true,
    inputTokens: messageTokens,
    remainingBudget: remaining - messageTokens,
    budgetCategory: 'volatile',
  };
}

/**
 * Calculate total context usage across all categories
 * 
 * @param usage - Token usage per category
 * @param tier - User tier
 * @returns Total usage stats
 */
export function calculateContextUsage(
  usage: Partial<Record<BudgetCategory, number>>,
  tier: Tier
): {
  totalUsed: number;
  totalBudget: number;
  utilizationPercent: number;
  categories: Record<BudgetCategory, TokenCountResult>;
} {
  const budgets = TOKEN_BUDGETS[tier];
  const categories = {} as Record<BudgetCategory, TokenCountResult>;
  let totalUsed = 0;
  
  // Only iterate over the budget categories (not 'total')
  const budgetCategories: BudgetCategory[] = ['systemPrompt', 'state', 'sessionDoc', 'rag', 'volatile', 'response'];
  
  for (const category of budgetCategories) {
    const used = usage[category] || 0;
    const limit = budgets[category];
    totalUsed += used;
    
    categories[category] = {
      count: used,
      exceedsLimit: used > limit,
      limit,
      remaining: limit - used,
    };
  }
  
  const totalBudget = budgets.total;
  const utilizationPercent = Math.round((totalUsed / totalBudget) * 100);
  
  return {
    totalUsed,
    totalBudget,
    utilizationPercent,
    categories,
  };
}

/**
 * Encode text to tokens (for advanced use cases)
 * 
 * @param text - Text to encode
 * @returns Array of token IDs
 */
export function encodeText(text: string): number[] {
  return encode(text);
}

/**
 * Estimate cost for a given number of tokens
 * 
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param tier - User tier
 * @returns Cost in ZAR
 */
export function calculateCostZar(
  inputTokens: number,
  outputTokens: number,
  tier: Tier
): number {
  const pricing = tier === 'free'
    ? TOKEN_PRICING_USD.openrouter_free
    : TOKEN_PRICING_USD.cerebras;
  
  const inputCostUsd = (inputTokens / 1_000_000) * pricing.input;
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.output;
  
  return (inputCostUsd + outputCostUsd) * ZAR_USD_RATE;
}

/**
 * Format token count for display
 * 
 * @param count - Token count
 * @returns Formatted string (e.g., "1.2K", "15K")
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}K`;
  return `${Math.round(count / 1000)}K`;
}
