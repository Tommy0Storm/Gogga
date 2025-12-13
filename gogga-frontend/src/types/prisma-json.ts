/**
 * GOGGA - Prisma JSON Field Types
 * 
 * Prisma 7 introduces stricter JSON typing.
 * These interfaces define the structured shapes for all JSON fields
 * stored in the database. Use these types when:
 * 
 * 1. Creating log entries with meta fields
 * 2. Reading/parsing JSON data from Prisma queries
 * 3. Validating JSON structure at runtime
 * 
 * Note: The schema stores these as String? (JSON serialized).
 * Always use JSON.stringify() when writing and JSON.parse() when reading.
 */

// ============================================================================
// AuthLog Meta Types
// ============================================================================

/**
 * Metadata for auth-related log entries (AuthLog.meta)
 */
export interface AuthLogMeta {
  // Login events
  token_expiry?: string;
  login_method?: 'magic_link' | 'token';
  
  // Usage events
  tokensUsed?: number;
  imageGenerated?: boolean;
  remainingCredits?: number;
  tier?: string;
  
  // Error events
  error?: string;
  errorCode?: string;
  
  // Subscription events
  subscription_tier?: 'FREE' | 'JIVE' | 'JIGGA';
  previous_tier?: 'FREE' | 'JIVE' | 'JIGGA';
  
  // Payment events
  payment_id?: string;
  amount_cents?: number;
  
  // Generic context
  user_agent?: string;
  [key: string]: unknown;
}

// ============================================================================
// VoucherLog Meta Types
// ============================================================================

/**
 * Metadata for voucher-related log entries (VoucherLog.meta)
 */
export interface VoucherLogMeta {
  // Creation context
  batch_size?: number;
  batch_id?: string;
  voucher_type?: string;
  
  // Redemption context
  user_email?: string;
  applied_tier?: 'FREE' | 'JIVE' | 'JIGGA';
  credits_applied?: number;
  
  // Void context
  void_reason?: string;
  previous_state?: {
    redeemed: boolean;
    redeemedBy?: string;
  };
  
  // Admin context
  admin_ip?: string;
  
  [key: string]: unknown;
}

// ============================================================================
// AdminLog Meta Types
// ============================================================================

/**
 * Metadata for admin action log entries (AdminLog.meta)
 */
export interface AdminLogMeta {
  // Subscription override
  from_tier?: 'FREE' | 'JIVE' | 'JIGGA';
  to_tier?: 'FREE' | 'JIVE' | 'JIGGA';
  from_status?: string;
  to_status?: string;
  credits_adjusted?: number;
  
  // User actions
  action_type?: 'upgrade' | 'downgrade' | 'reset' | 'grant_credits' | 'revoke_credits';
  
  // Voucher actions
  voucher_code?: string;
  voucher_count?: number;
  
  // Service actions
  service_name?: string;
  service_action?: 'start' | 'stop' | 'restart';
  exit_code?: number;
  
  // Query/browse actions
  query?: string;
  table_name?: string;
  rows_affected?: number;
  
  // Error context
  error?: string;
  
  [key: string]: unknown;
}

// ============================================================================
// SubscriptionEvent Meta Types
// ============================================================================

/**
 * Metadata for subscription event log entries (SubscriptionEvent.meta)
 */
export interface SubscriptionEventMeta {
  // Activation context
  payfast_token?: string;
  monthly_credits?: number;
  images_limit?: number;
  
  // Payment context
  payment_id?: string;
  payment_amount_cents?: number;
  payment_method?: 'payfast' | 'voucher' | 'admin';
  
  // Failure context
  failure_reason?: string;
  retry_count?: number;
  
  // Credit operations
  credits_before?: number;
  credits_after?: number;
  
  // Admin override context
  admin_email?: string;
  override_reason?: string;
  
  // Billing cycle
  billing_period_start?: string;
  billing_period_end?: string;
  
  [key: string]: unknown;
}

// ============================================================================
// RecurringSchedule Meta Types
// ============================================================================

/**
 * Metadata for recurring payment schedule (RecurringSchedule.metadata)
 */
export interface RecurringScheduleMeta {
  // Original subscription context
  subscription_id?: string;
  original_payment_id?: string;
  
  // Upgrade/downgrade history
  tier_changes?: Array<{
    from_tier: string;
    to_tier: string;
    changed_at: string;
    reason?: string;
  }>;
  
  // Retry context
  last_failure_reason?: string;
  last_failure_at?: string;
  
  // PayFast specific
  payfast_subscription_id?: string;
  
  [key: string]: unknown;
}

// ============================================================================
// Chat Message Meta Types (Dexie/IndexedDB)
// ============================================================================

/**
 * Metadata for chat messages (ChatMessage.meta in Dexie)
 * This aligns with the Message interface in useChatHistory.ts
 */
export interface ChatMessageMeta {
  // Cost tracking
  cost_zar?: number;
  
  // Model info
  model?: string;
  layer?: 'speed' | 'complex' | 'free_text' | 'jive_speed' | 'jive_reasoning' | 'jigga_think' | 'jigga_fast' | 'jigga_multilingual' | 'reasoning';
  provider?: 'cerebras' | 'openrouter' | 'groq' | 'deepinfra' | 'cerebras+cepo' | 'openrouter_fallback' | string;
  
  // Performance
  latency_seconds?: number;
  
  // Tier context
  tier?: 'FREE' | 'JIVE' | 'JIGGA' | 'free' | 'jive' | 'jigga';
  
  // RAG context flags
  rag_context?: boolean;
  
  // Memory context flags
  memory_context?: boolean;
  buddy_context?: boolean;
  location_context?: boolean;
  
  // Thinking mode
  has_thinking?: boolean;
  
  // Tool calling
  tools_executed?: boolean;
  
  // Math tool execution (GoggaSolve)
  math_tool_count?: number;
  math_tools_executed?: string[];
  
  // Response timestamp (ISO string)
  timestamp?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Parse a JSON string to typed meta object with validation
 * TypeScript 5.9: const type parameter preserves exact object shape
 */
export function parseMetaJson<const T extends Record<string, unknown>>(
  jsonString: string | null | undefined,
  defaultValue: T = {} as T
): T {
  if (!jsonString) return defaultValue;
  
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    console.warn('Failed to parse meta JSON:', jsonString);
    return defaultValue;
  }
}

/**
 * Stringify meta object for database storage
 * TypeScript 5.9: const type parameter for exact type preservation
 */
export function stringifyMeta<const T extends Record<string, unknown>>(
  meta: T | null | undefined
): string | null {
  if (!meta || Object.keys(meta).length === 0) return null;
  return JSON.stringify(meta);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for AuthLogMeta
 */
export function isAuthLogMeta(value: unknown): value is AuthLogMeta {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard for ChatMessageMeta
 */
export function isChatMessageMeta(value: unknown): value is ChatMessageMeta {
  if (typeof value !== 'object' || value === null) return false;
  
  const meta = value as Record<string, unknown>;
  
  // Check known optional properties have correct types if present
  if ('cost_zar' in meta && typeof meta.cost_zar !== 'number') return false;
  if ('model' in meta && typeof meta.model !== 'string') return false;
  if ('latency_seconds' in meta && typeof meta.latency_seconds !== 'number') return false;
  
  return true;
}
