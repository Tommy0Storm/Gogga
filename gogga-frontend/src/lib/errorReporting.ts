/**
 * GOGGA Enhanced Error Reporting System
 * 
 * TypeScript 5.9 + Python 3.14 Compatible Error Handling
 * 
 * Features:
 * - Structured error types matching backend FastAPI exceptions
 * - Rich context for debugging (stack traces, request IDs, metadata)
 * - Type-safe error handling with discriminated unions
 * - Automatic error recovery and retry logic
 * - Error analytics and reporting
 */

import type { APIError, Tier, CognitiveLayer, AIProvider } from '../types/api';

// ============================================================================
// Error Context Types
// ============================================================================

/**
 * Request context for error tracking
 */
export interface ErrorContext {
  requestId?: string;
  timestamp: Date;
  tier: Tier;
  layer?: CognitiveLayer;
  provider?: AIProvider;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Stack frame information (enhanced with TypeScript 5.9 inference)
 */
export interface StackFrame {
  readonly fileName: string;
  readonly lineNumber: number;
  readonly columnNumber?: number;
  readonly functionName?: string;
  readonly source?: string;
}

/**
 * Enhanced error with context and recovery options
 */
export class GoggaError extends Error {
  readonly code: string;
  readonly context: ErrorContext;
  readonly stack?: string;
  readonly stackFrames: readonly StackFrame[];
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly userMessage: string;
  
  constructor(
    message: string,
    code: string,
    context: ErrorContext,
    options: {
      recoverable?: boolean;
      retryable?: boolean;
      userMessage?: string;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'GoggaError';
    this.code = code;
    this.context = context;
    this.recoverable = options.recoverable ?? true;
    this.retryable = options.retryable ?? false;
    this.userMessage = options.userMessage ?? 'Something went wrong. Please try again.';
    
    // Enhanced stack trace parsing (TypeScript 5.9 improved error handling)
    this.stackFrames = this.parseStackTrace(this.stack || '');
    
    // Maintain proper prototype chain
    Object.setPrototypeOf(this, GoggaError.prototype);
  }
  
  /**
   * Parse stack trace into structured frames
   * TypeScript 5.9: Better inference for array operations
   */
  private parseStackTrace(stack: string): readonly StackFrame[] {
    const frames: StackFrame[] = [];
    const lines = stack.split('\n').slice(1); // Skip error message line
    
    for (const line of lines) {
      const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)/);
      if (match) {
        const fileName = match[2] ?? 'unknown';
        const lineNum = match[3] ?? '0';
        const colNum = match[4] ?? '0';
        frames.push({
          functionName: match[1]?.trim(),
          fileName: fileName,
          lineNumber: parseInt(lineNum, 10),
          columnNumber: parseInt(colNum, 10),
          source: line.trim(),
        });
      }
    }
    
    return frames;
  }
  
  /**
   * Convert to API error format for backend communication
   */
  toAPIError(): APIError {
    return {
      type: 'internal_error',
      error: this.message,
      detail: this.userMessage,
      request_id: this.context.requestId,
      timestamp: this.context.timestamp.toISOString(),
      error_code: this.code,
    };
  }
  
  /**
   * Convert to JSON for logging/analytics
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      stackFrames: this.stackFrames,
      recoverable: this.recoverable,
      retryable: this.retryable,
    };
  }
}

// ============================================================================
// Specific Error Classes (TypeScript 5.9 Discriminated Unions)
// ============================================================================

export class ValidationError extends GoggaError {
  readonly fieldErrors: Record<string, string[]>;
  
  constructor(
    message: string,
    fieldErrors: Record<string, string[]>,
    context: ErrorContext
  ) {
    super(message, 'VALIDATION_ERROR', context, {
      recoverable: true,
      retryable: false,
      userMessage: 'Please check your input and try again.',
    });
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export class AuthenticationError extends GoggaError {
  readonly requiredTier?: Tier;
  
  constructor(message: string, requiredTier: Tier | undefined, context: ErrorContext) {
    super(message, 'AUTH_ERROR', context, {
      recoverable: false,
      retryable: false,
      userMessage: requiredTier 
        ? `This feature requires ${requiredTier.toUpperCase()} tier.`
        : 'Authentication required.',
    });
    this.name = 'AuthenticationError';
    this.requiredTier = requiredTier;
  }
}

export class RateLimitError extends GoggaError {
  readonly retryAfter: number; // seconds
  readonly limitReset: Date;
  
  constructor(
    message: string,
    retryAfter: number,
    limitReset: Date,
    context: ErrorContext
  ) {
    super(message, 'RATE_LIMIT', context, {
      recoverable: true,
      retryable: true,
      userMessage: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
    });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.limitReset = limitReset;
  }
}

export class TierLimitError extends GoggaError {
  readonly currentUsage: number;
  readonly tierLimit: number;
  readonly upgradeTier?: Tier;
  
  constructor(
    message: string,
    currentUsage: number,
    tierLimit: number,
    upgradeTier: Tier | undefined,
    context: ErrorContext
  ) {
    super(message, 'TIER_LIMIT', context, {
      recoverable: false,
      retryable: false,
      userMessage: upgradeTier
        ? `You've reached your tier limit. Upgrade to ${upgradeTier.toUpperCase()} for more.`
        : 'You\'ve reached your tier limit.',
    });
    this.name = 'TierLimitError';
    this.currentUsage = currentUsage;
    this.tierLimit = tierLimit;
    this.upgradeTier = upgradeTier;
  }
}

export class ServiceError extends GoggaError {
  readonly service: AIProvider;
  readonly fallbackUsed: boolean;
  
  constructor(
    message: string,
    service: AIProvider,
    fallbackUsed: boolean,
    context: ErrorContext
  ) {
    super(message, 'SERVICE_ERROR', context, {
      recoverable: true,
      retryable: true,
      userMessage: fallbackUsed
        ? 'Using backup service. Response may be slower.'
        : 'AI service temporarily unavailable. Please try again.',
    });
    this.name = 'ServiceError';
    this.service = service;
    this.fallbackUsed = fallbackUsed;
  }
}

export class NetworkError extends GoggaError {
  readonly statusCode?: number;
  readonly responseBody?: string;
  
  constructor(
    message: string,
    statusCode: number | undefined,
    responseBody: string | undefined,
    context: ErrorContext
  ) {
    super(message, 'NETWORK_ERROR', context, {
      recoverable: true,
      retryable: true,
      userMessage: 'Network error. Please check your connection.',
    });
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

// ============================================================================
// Error Factory Functions (TypeScript 5.9 Type Safety)
// ============================================================================

/**
 * Create error from API response
 * TypeScript 5.9: Better type narrowing for discriminated unions
 */
export function createErrorFromAPI(
  apiError: APIError,
  context: Partial<ErrorContext>
): GoggaError {
  const fullContext: ErrorContext = {
    requestId: apiError.request_id,
    timestamp: new Date(apiError.timestamp),
    tier: context.tier ?? 'free',
    ...context,
  };
  
  switch (apiError.type) {
    case 'validation_error':
      return new ValidationError(
        apiError.error,
        apiError.field_errors ?? {},
        fullContext
      );
      
    case 'authentication_error':
      return new AuthenticationError(
        apiError.error,
        apiError.required_tier,
        fullContext
      );
      
    case 'rate_limit_error':
      return new RateLimitError(
        apiError.error,
        apiError.retry_after ?? 60,
        apiError.limit_reset ? new Date(apiError.limit_reset) : new Date(),
        fullContext
      );
      
    case 'tier_limit_error':
      return new TierLimitError(
        apiError.error,
        apiError.current_usage,
        apiError.tier_limit,
        apiError.upgrade_tier,
        fullContext
      );
      
    case 'service_error':
      return new ServiceError(
        apiError.error,
        apiError.service,
        apiError.fallback_used ?? false,
        fullContext
      );
      
    case 'internal_error':
    default:
      return new GoggaError(apiError.error, apiError.error_code ?? 'UNKNOWN', fullContext, {
        userMessage: apiError.detail,
      });
  }
}

/**
 * Create error from fetch failure
 */
export function createNetworkError(
  error: Error,
  statusCode: number | undefined,
  responseBody: string | undefined,
  context: Partial<ErrorContext>
): NetworkError {
  return new NetworkError(
    error.message,
    statusCode,
    responseBody,
    {
      timestamp: new Date(),
      tier: context.tier ?? 'free',
      ...context,
    }
  );
}

// ============================================================================
// Error Recovery Utilities
// ============================================================================

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // ms
  maxDelay: number; // ms
  exponentialBackoff: boolean;
  retryableErrors: string[]; // error codes
}

/**
 * Default retry configuration
 * TypeScript 5.9: satisfies ensures type safety
 */
export const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  exponentialBackoff: true,
  retryableErrors: ['NETWORK_ERROR', 'SERVICE_ERROR', 'RATE_LIMIT'],
} satisfies RetryConfig;

/**
 * Execute function with retry logic
 * TypeScript 5.9: const type parameter for better inference
 */
export async function withRetry<const T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: GoggaError | undefined;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof GoggaError) {
        lastError = error;
        
        // Check if error is retryable
        if (!error.retryable || !config.retryableErrors.includes(error.code)) {
          throw error;
        }
        
        // Check if max attempts reached
        if (attempt >= config.maxAttempts) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = config.exponentialBackoff
          ? Math.min(config.baseDelay * Math.pow(2, attempt - 1), config.maxDelay)
          : config.baseDelay;
          
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Non-GoggaError, wrap and throw
        throw new GoggaError(
          error instanceof Error ? error.message : String(error),
          'UNKNOWN',
          { timestamp: new Date(), tier: 'free' },
          { cause: error instanceof Error ? error : undefined }
        );
      }
    }
  }
  
  throw lastError;
}

// ============================================================================
// Error Logging and Analytics
// ============================================================================

/**
 * Error logger interface
 */
export interface ErrorLogger {
  log(error: GoggaError): void;
  flush(): Promise<void>;
}

/**
 * Console error logger (development)
 */
export class ConsoleErrorLogger implements ErrorLogger {
  log(error: GoggaError): void {
    console.error('[GoggaError]', {
      code: error.code,
      message: error.message,
      context: error.context,
      stackFrames: error.stackFrames.slice(0, 5), // First 5 frames
    });
  }
  
  async flush(): Promise<void> {
    // No-op for console logger
  }
}

/**
 * Batch error logger (production)
 */
export class BatchErrorLogger implements ErrorLogger {
  private queue: GoggaError[] = [];
  private readonly batchSize = 10;
  private readonly flushInterval = 5000; // 5 seconds
  private timer?: NodeJS.Timeout;
  
  constructor(private endpoint: string) {
    this.startTimer();
  }
  
  log(error: GoggaError): void {
    this.queue.push(error);
    
    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }
  
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0);
    
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errors: batch.map(e => e.toJSON()),
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to send error batch:', error);
      // Re-queue errors
      this.queue.unshift(...batch);
    }
  }
  
  private startTimer(): void {
    this.timer = setInterval(() => void this.flush(), this.flushInterval);
  }
  
  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    void this.flush();
  }
}

/**
 * Global error logger instance
 */
let globalLogger: ErrorLogger = new ConsoleErrorLogger();

export function setErrorLogger(logger: ErrorLogger): void {
  globalLogger = logger;
}

export function logError(error: GoggaError): void {
  globalLogger.log(error);
}
