/**
 * GOGGA API Type Definitions
 * 
 * Shared type definitions that match FastAPI backend schemas.
 * These types ensure type safety between TypeScript frontend and Python backend.
 * 
 * TypeScript 5.9 Features Used:
 * - `satisfies` operator for config validation
 * - `const` type parameters for better inference
 * - Improved discriminated unions
 * 
 * Python 3.14 Compatibility:
 * - Matches Pydantic v2 models in backend
 * - Aligns with TypedDict structures
 * - Compatible with FastAPI response schemas
 */

// ============================================================================
// Core API Types
// ============================================================================

/**
 * User subscription tiers (matches Python UserTier enum)
 */
export type Tier = 'free' | 'jive' | 'jigga';

/**
 * Cognitive layers for routing (matches Python CognitiveLayer enum)
 */
export type CognitiveLayer =
  // FREE tier
  | 'free_text'
  | 'free_image'
  // JIVE tier
  | 'jive_speed'
  | 'jive_reasoning'
  | 'jive_image'
  // JIGGA tier
  | 'jigga_think'
  | 'jigga_fast'
  | 'jigga_multilingual'
  | 'jigga_image'
  // Universal
  | 'enhance_prompt'
  | 'multimodal';

/**
 * AI service providers (matches backend)
 */
export type AIProvider = 
  | 'cerebras'
  | 'openrouter'
  | 'groq'
  | 'deepinfra'
  | 'cerebras+cepo'
  | 'openrouter_fallback'
  | 'pollinations'
  | 'flux';

// ============================================================================
// Request/Response Types (FastAPI Pydantic Models)
// ============================================================================

/**
 * Chat request payload (matches ChatRequest Pydantic model)
 */
export interface ChatRequestPayload {
  message: string;
  conversation_id: string;
  user_tier: Tier;
  model_preference?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  rag_context?: string;
  memory_context?: string;
  buddy_context?: string;
}

/**
 * Chat response from backend (matches ChatResponse Pydantic model)
 */
export interface ChatResponse {
  response: string;
  model: string;
  layer: CognitiveLayer;
  provider: AIProvider;
  latency_seconds: number;
  cost_zar: number;
  has_thinking?: boolean;
  thinking_content?: string;
  rag_context?: boolean;
  memory_context?: boolean;
  buddy_context?: boolean;
  error?: string;
}

/**
 * Prompt enhancement request (all tiers)
 */
export interface EnhancePromptRequest {
  prompt: string;
  context?: string;
  target_layer?: CognitiveLayer;
}

/**
 * Prompt enhancement response
 */
export interface EnhancePromptResponse {
  enhanced_prompt: string;
  original_prompt: string;
  model: string;
  latency_seconds: number;
}

/**
 * Image generation request (matches ImageGenerationRequest Pydantic model)
 */
export interface ImageGenerationRequest {
  prompt: string;
  user_tier: Tier;
  width?: number;
  height?: number;
  num_images?: number;
  guidance_scale?: number;
  seed?: number;
}

/**
 * Image generation response
 */
export interface ImageGenerationResponse {
  images: Array<{
    url: string;
    width: number;
    height: number;
    seed?: number;
  }>;
  model: string;
  provider: AIProvider;
  latency_seconds: number;
  cost_zar: number;
  images_remaining?: number;
  limit_reset_date?: string;
  error?: string;
}

// ============================================================================
// Error Response Types (FastAPI HTTPException)
// ============================================================================

/**
 * Standard API error response
 * Enhanced with TypeScript 5.9 discriminated unions
 */
export type APIError = 
  | ValidationError
  | AuthenticationError
  | RateLimitError
  | TierLimitError
  | ServiceError
  | InternalError;

interface BaseError {
  error: string;
  detail: string;
  request_id?: string;
  timestamp: string;
}

export interface ValidationError extends BaseError {
  type: 'validation_error';
  field_errors?: Record<string, string[]>;
}

export interface AuthenticationError extends BaseError {
  type: 'authentication_error';
  required_tier?: Tier;
}

export interface RateLimitError extends BaseError {
  type: 'rate_limit_error';
  retry_after?: number;
  limit_reset?: string;
}

export interface TierLimitError extends BaseError {
  type: 'tier_limit_error';
  current_usage: number;
  tier_limit: number;
  upgrade_tier?: Tier;
}

export interface ServiceError extends BaseError {
  type: 'service_error';
  service: AIProvider;
  fallback_used?: boolean;
}

export interface InternalError extends BaseError {
  type: 'internal_error';
  error_code?: string;
}

// ============================================================================
// Type Guards for Runtime Type Checking
// ============================================================================

/**
 * TypeScript 5.9: Improved type predicate inference
 */
export function isAPIError(response: unknown): response is APIError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'type' in response &&
    'error' in response &&
    'detail' in response
  );
}

export function isChatResponse(response: unknown): response is ChatResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'response' in response &&
    'model' in response &&
    'layer' in response
  );
}

export function isImageResponse(response: unknown): response is ImageGenerationResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'images' in response &&
    Array.isArray((response as any).images)
  );
}

// ============================================================================
// Tier Configuration (matches backend router.py)
// ============================================================================

/**
 * Tier limits and capabilities
 * TypeScript 5.9: Using `satisfies` for compile-time validation
 */
export interface TierLimits {
  readonly maxDocs: number;
  readonly semantic: boolean;
  readonly embeddingModel?: string;
  readonly imageLimit: number;
  readonly modelName: string;
  readonly ragEnabled: boolean;
  readonly reasoningEnabled: boolean;
  readonly multilingualSupport: boolean;
}

type TierLimitsMap = Record<Tier, TierLimits>;

export const TIER_LIMITS = {
  free: {
    maxDocs: 0,
    semantic: false,
    imageLimit: 50,
    modelName: 'Llama 3.3 70B',
    ragEnabled: false,
    reasoningEnabled: false,
    multilingualSupport: false,
  },
  jive: {
    maxDocs: 50,
    semantic: false,
    imageLimit: 200,
    modelName: 'Llama 3.1 8B + CePO',
    ragEnabled: true,
    reasoningEnabled: true,
    multilingualSupport: false,
  },
  jigga: {
    maxDocs: 200,
    semantic: true,
    embeddingModel: 'e5-small-v2',
    imageLimit: 1000,
    modelName: 'Qwen 3 32B',
    ragEnabled: true,
    reasoningEnabled: true,
    multilingualSupport: true,
  },
} satisfies TierLimitsMap;

/**
 * Get tier limits with const parameter for better type inference
 * TypeScript 5.9: const type parameters eliminate need for type assertions
 */
export function getTierLimits<const T extends Tier>(tier: T): TierLimits {
  return TIER_LIMITS[tier];
}

// ============================================================================
// Payment Types (matches PayFast webhook schemas)
// ============================================================================

/**
 * PayFast ITN (Instant Transaction Notification) payload
 */
export interface PayFastITN {
  m_payment_id: string;
  pf_payment_id: string;
  payment_status: 'COMPLETE' | 'FAILED' | 'PENDING';
  item_name: string;
  item_description?: string;
  amount_gross: string; // ZAR amount
  amount_fee: string;
  amount_net: string;
  custom_str1?: string; // user_email
  custom_str2?: string; // tier
  custom_int1?: string;
  name_first?: string;
  name_last?: string;
  email_address?: string;
  merchant_id: string;
  signature: string;
}

/**
 * Subscription activation result
 */
export interface SubscriptionResult {
  success: boolean;
  tier: Tier;
  user_email: string;
  expires_at?: string;
  monthly_credits?: number;
  images_limit?: number;
  error?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * TypeScript 5.9: Better inference for API response wrappers
 */
export type APIResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: APIError };

/**
 * Helper to create type-safe API response
 */
export function createSuccessResponse<const T>(data: T): APIResponse<T> {
  return { success: true, data };
}

export function createErrorResponse<T>(error: APIError): APIResponse<T> {
  return { success: false, error };
}

/**
 * Extract successful response data
 * TypeScript 5.9: Using assertion function for better narrowing
 */
export function unwrapResponse<T>(response: APIResponse<T>): T {
  if (response.success) {
    return response.data;
  }
  // TypeScript knows this is the error branch
  const errorResponse = response as { success: false; error: APIError };
  throw new Error(errorResponse.error.detail);
}

// ============================================================================
// WebSocket Types (for streaming responses)
// ============================================================================

export type StreamEvent =
  | { type: 'start'; conversation_id: string }
  | { type: 'token'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'done'; model: string; latency_seconds: number; cost_zar: number }
  | { type: 'error'; error: string; detail: string };

// ============================================================================
// Constants (matches backend)
// ============================================================================

/**
 * TypeScript 5.9: satisfies ensures all values are valid CognitiveLayer types
 */
export const DEFAULT_MODELS = {
  free: 'meta-llama/llama-3.3-70b-instruct:free',
  jive: 'llama-3.1-8b',
  jigga: 'qwen/qwen-3-32b',
} satisfies Record<Tier, string>;

export const API_ENDPOINTS = {
  chat: '/api/v1/chat',
  enhance: '/api/v1/chat/enhance',
  image: '/api/v1/images/generate',
  subscribe: '/api/v1/payments/subscribe',
  webhook: '/api/v1/payments/notify',
} satisfies Record<string, string>;

/**
 * Rate limiting (matches backend)
 */
export const RATE_LIMITS = {
  free: { requests_per_minute: 10, requests_per_hour: 100 },
  jive: { requests_per_minute: 30, requests_per_hour: 500 },
  jigga: { requests_per_minute: 60, requests_per_hour: 2000 },
} satisfies Record<Tier, { requests_per_minute: number; requests_per_hour: number }>;
