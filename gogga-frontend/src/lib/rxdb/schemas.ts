/**
 * GOGGA RxDB Schemas
 * Defines all collection schemas with TypeScript interfaces
 * Migrated from Dexie with enhanced features:
 * - Distance-to-Samples vector indexing
 * - RxJS observables for reactive queries
 * - Cross-tab leader election
 */

import type { RxJsonSchema, RxDocument, RxCollection, RxDatabase } from 'rxdb';

// ============================================================================
// Type Definitions (matching Dexie interface structure)
// ============================================================================

// Document stored for RAG
export interface DocumentDoc {
  id: string;
  // Session-Scoped RAG fields (v8)
  userId: string; // Owner of the document (user's pool)
  originSessionId: string; // Session where doc was originally uploaded
  activeSessions: string[]; // Sessions where doc is currently active for RAG
  accessCount: number; // Usage tracking for pool management
  lastAccessedAt: string; // Last time doc was used in RAG
  // Legacy field - frozen at upload time, use activeSessions for filtering
  sessionId: string; // @deprecated Use originSessionId instead
  // Document content
  filename: string;
  content: string;
  chunks: string[];
  chunkCount: number;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

// Chunk for search index
export interface DocumentChunkDoc {
  id: string;
  documentId: string;
  sessionId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
}

// Chat session for JIVE/JIGGA persistence
export interface ChatSessionDoc {
  id: string;
  tier: 'jive' | 'jigga';
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  // Advanced feature: Session embedding for similarity search
  titleEmbedding?: number[];
}

// Chat message (persisted for JIVE/JIGGA)
export interface ChatMessageDoc {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  tier: string;
  timestamp: string;
  imageId?: string;
  thinking?: string;
  meta?: Record<string, unknown>;
}

// Generated image storage
export interface GeneratedImageDoc {
  id: string;
  sessionId: string;
  prompt: string;
  enhancedPrompt: string;
  thumbnailData: string;
  fullImageData: string;
  mimeType: string;
  width: number;
  height: number;
  tier: string;
  model: string;
  isDeleted: boolean;
  createdAt: string;
}

// User preferences
export interface UserPreferenceDoc {
  key: string;
  value: string;
}

// Long-term memory context
export interface MemoryContextDoc {
  id: string;
  title: string;
  content: string;
  category: 'personal' | 'project' | 'reference' | 'custom';
  source: 'user' | 'gogga';
  isActive: boolean;
  priority: number;
  tokenCount: number;
  createdAt: string;
  updatedAt: string;
  // Advanced feature: Memory embedding for semantic retrieval
  embedding?: number[];
}

// Token usage tracking
export interface TokenUsageDoc {
  id: string;
  date: string;
  tier: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costZar: number;
  requestCount: number;
  updatedAt: string;
}

// Tool usage analytics - tracks which tools are used most frequently
export interface ToolUsageDoc {
  id: string; // Composite: date_toolName_tier
  date: string; // YYYY-MM-DD
  toolName: string; // e.g., "search_web", "generate_image"
  tier: string; // FREE, JIVE, JIGGA
  callCount: number; // Total calls for this day/tool/tier
  successCount: number; // Successful executions
  failureCount: number; // Failed executions
  totalExecutionTimeMs: number; // Total time spent
  avgExecutionTimeMs: number; // Average execution time
  updatedAt: string;
}

// RAG Metrics
export interface RagMetricDoc {
  id: string;
  metricId: string;
  type:
    | 'retrieval'
    | 'embedding_generated'
    | 'query'
    | 'cache_hit'
    | 'cache_miss'
    | 'error';
  timestamp: number;
  sessionId?: string;
  docId?: string;
  value: Record<string, unknown>;
  createdAt: string;
}

// System Logs
export interface SystemLogDoc {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'rag' | 'auth' | 'chat' | 'image' | 'system';
  message: string;
  data?: Record<string, unknown>;
  sessionId?: string;
  timestamp: number;
  createdAt: string;
}

// Vector Embedding document (NEW - persistent embeddings)
export interface VectorEmbeddingDoc {
  id: string;
  documentId: string;
  chunkIndex: number;
  sessionId: string;
  text: string;
  embedding: number[];
  // Distance-to-Samples index fields (5 indexes for fast vector search)
  idx0: string;
  idx1: string;
  idx2: string;
  idx3: string;
  idx4: string;
  createdAt: string;
}

// Offline Queue (NEW - for pending messages when offline)
export interface OfflineQueueDoc {
  id: string;
  type: 'message' | 'image_request';
  payload: Record<string, unknown>;
  status: 'pending' | 'sending' | 'failed';
  retryCount: number;
  createdAt: string;
  lastAttempt?: string;
  error?: string;
}

// GoggaSmart Skill - learned strategy for self-improving AI
// Inspired by ACE (Agentic Context Engine) playbook/skillbook system
export interface GoggaSmartSkillDoc {
  id: string;
  skillId: string;
  userId: string;
  section: string; // Flexible section types: tool_selection, output_format, user_preferences, etc.
  content: string;
  helpful: number;
  harmful: number;
  neutral: number;
  context?: string;
  status: 'active' | 'archived' | 'under_review';
  createdAt: string;
  updatedAt: string;
}

// Icon Generation - Premium SA-themed 3D SVG icons via Gemini 3 Flash
export interface IconGenerationDoc {
  id: string;
  userId: string;
  svgContent: string; // Full SVG markup
  prompt: string; // User's original prompt
  tier: 'JIVE' | 'JIGGA'; // FREE tier cannot generate icons
  tokensPrompt: number; // From usageMetadata.promptTokenCount
  tokensCandidates: number; // From usageMetadata.candidatesTokenCount
  tokensTotal: number; // Total tokens used
  costZar: number; // Cost in ZAR
  lighting: string; // studio, dramatic, neon, golden_hour, cinematic, rembrandt, bioluminescent, soft
  complexity: string; // minimalist, balanced, intricate
  backing: string; // none, circle, square
  createdAt: string; // ISO timestamp
  downloaded: boolean; // Has user downloaded this icon?
}

// GoggaSmart limits
export const GOGGA_SMART_LIMITS = {
  MAX_SKILLS_PER_USER: 100, // Max skills in user's skillbook
  MAX_SKILLS_IN_PROMPT: 15, // Max skills to inject in system prompt
  MIN_SCORE_THRESHOLD: -3, // Skills with (helpful - harmful) < this are pruned
} as const;

// ============================================================================
// Schema Definitions
// ============================================================================

const indexSchema = {
  type: 'string',
  maxLength: 10,
} as const;

export const documentSchema: RxJsonSchema<DocumentDoc> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    // Session-Scoped RAG fields (v8)
    userId: { type: 'string', maxLength: 100 },
    originSessionId: { type: 'string', maxLength: 100 },
    activeSessions: { type: 'array', items: { type: 'string' } },
    accessCount: {
      type: 'number',
      minimum: 0,
      maximum: 1000000,
      multipleOf: 1,
    },
    lastAccessedAt: { type: 'string', maxLength: 30 },
    // Legacy field
    sessionId: { type: 'string', maxLength: 100 },
    // Document content
    filename: { type: 'string', maxLength: 255 },
    content: { type: 'string' },
    chunks: { type: 'array', items: { type: 'string' } },
    chunkCount: { type: 'number', minimum: 0, maximum: 10000, multipleOf: 1 },
    size: { type: 'number', minimum: 0, maximum: 100000000, multipleOf: 1 },
    mimeType: { type: 'string', maxLength: 100 },
    createdAt: { type: 'string', maxLength: 30 },
    updatedAt: { type: 'string', maxLength: 30 },
  },
  required: [
    'id',
    'userId',
    'originSessionId',
    'activeSessions',
    'accessCount',
    'lastAccessedAt',
    'sessionId',
    'filename',
    'content',
    'chunks',
    'chunkCount',
    'size',
    'mimeType',
    'createdAt',
    'updatedAt',
  ],
  indexes: [
    'userId',
    'originSessionId',
    'sessionId',
    'filename',
    'createdAt',
    'lastAccessedAt',
  ],
};

export const documentChunkSchema: RxJsonSchema<DocumentChunkDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    documentId: { type: 'string', maxLength: 100, ref: 'documents' }, // Population: reference to documents collection
    sessionId: { type: 'string', maxLength: 100 },
    chunkIndex: { type: 'number', minimum: 0, maximum: 10000, multipleOf: 1 },
    text: { type: 'string' },
    tokenCount: { type: 'number', minimum: 0, maximum: 100000, multipleOf: 1 },
  },
  required: [
    'id',
    'documentId',
    'sessionId',
    'chunkIndex',
    'text',
    'tokenCount',
  ],
  indexes: ['documentId', 'sessionId', 'chunkIndex'],
};

export const chatSessionSchema: RxJsonSchema<ChatSessionDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    tier: { type: 'string', maxLength: 10 },
    title: { type: 'string', maxLength: 500 },
    createdAt: { type: 'string', maxLength: 30 },
    updatedAt: { type: 'string', maxLength: 30 },
    messageCount: {
      type: 'number',
      minimum: 0,
      maximum: 100000,
      multipleOf: 1,
    },
    titleEmbedding: { type: 'array', items: { type: 'number' } },
  },
  required: ['id', 'tier', 'title', 'createdAt', 'updatedAt', 'messageCount'],
  indexes: ['tier', 'createdAt', 'updatedAt'],
};

export const chatMessageSchema: RxJsonSchema<ChatMessageDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    sessionId: { type: 'string', maxLength: 100, ref: 'chatSessions' }, // Population: reference to chatSessions collection
    role: { type: 'string', maxLength: 20 },
    content: { type: 'string' },
    tier: { type: 'string', maxLength: 20 },
    timestamp: { type: 'string', maxLength: 30 },
    imageId: { type: 'string', maxLength: 100, ref: 'generatedImages' }, // Population: reference to generatedImages collection
    thinking: { type: 'string' },
    meta: { type: 'object' },
  },
  required: ['id', 'sessionId', 'role', 'content', 'tier', 'timestamp'],
  indexes: ['sessionId', 'role', 'tier', 'timestamp'],
};

export const generatedImageSchema: RxJsonSchema<GeneratedImageDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    sessionId: { type: 'string', maxLength: 100 },
    prompt: { type: 'string' },
    enhancedPrompt: { type: 'string' },
    thumbnailData: { type: 'string' },
    fullImageData: { type: 'string' },
    mimeType: { type: 'string', maxLength: 50 },
    width: { type: 'number', minimum: 0, maximum: 10000, multipleOf: 1 },
    height: { type: 'number', minimum: 0, maximum: 10000, multipleOf: 1 },
    tier: { type: 'string', maxLength: 20 },
    model: { type: 'string', maxLength: 100 },
    isDeleted: { type: 'boolean' },
    createdAt: { type: 'string', maxLength: 30 },
  },
  required: [
    'id',
    'sessionId',
    'prompt',
    'enhancedPrompt',
    'thumbnailData',
    'fullImageData',
    'mimeType',
    'width',
    'height',
    'tier',
    'model',
    'isDeleted',
    'createdAt',
  ],
  indexes: ['sessionId', 'isDeleted', 'createdAt'],
};

export const userPreferenceSchema: RxJsonSchema<UserPreferenceDoc> = {
  version: 0,
  primaryKey: 'key',
  type: 'object',
  properties: {
    key: { type: 'string', maxLength: 100 },
    value: { type: 'string' },
  },
  required: ['key', 'value'],
};

export const memoryContextSchema: RxJsonSchema<MemoryContextDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    title: { type: 'string', maxLength: 500 },
    content: { type: 'string' },
    category: { type: 'string', maxLength: 20 },
    source: { type: 'string', maxLength: 20 },
    isActive: { type: 'boolean' },
    priority: { type: 'number', minimum: 1, maximum: 10, multipleOf: 1 },
    tokenCount: { type: 'number', minimum: 0, maximum: 100000, multipleOf: 1 },
    createdAt: { type: 'string', maxLength: 30 },
    updatedAt: { type: 'string', maxLength: 30 },
    embedding: { type: 'array', items: { type: 'number' } },
  },
  required: [
    'id',
    'title',
    'content',
    'category',
    'source',
    'isActive',
    'priority',
    'tokenCount',
    'createdAt',
    'updatedAt',
  ],
  indexes: ['category', 'source', 'isActive', 'priority', 'createdAt'],
};

export const tokenUsageSchema: RxJsonSchema<TokenUsageDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    date: { type: 'string', maxLength: 20 },
    tier: { type: 'string', maxLength: 20 },
    inputTokens: {
      type: 'number',
      minimum: 0,
      maximum: 1000000000,
      multipleOf: 1,
    },
    outputTokens: {
      type: 'number',
      minimum: 0,
      maximum: 1000000000,
      multipleOf: 1,
    },
    totalTokens: {
      type: 'number',
      minimum: 0,
      maximum: 1000000000,
      multipleOf: 1,
    },
    costZar: { type: 'number', minimum: 0, maximum: 1000000, multipleOf: 0.01 },
    requestCount: {
      type: 'number',
      minimum: 0,
      maximum: 1000000,
      multipleOf: 1,
    },
    updatedAt: { type: 'string', maxLength: 30 },
  },
  required: [
    'id',
    'date',
    'tier',
    'inputTokens',
    'outputTokens',
    'totalTokens',
    'costZar',
    'requestCount',
    'updatedAt',
  ],
  indexes: ['date', 'tier', ['date', 'tier']],
};

export const toolUsageSchema: RxJsonSchema<ToolUsageDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 150 }, // Composite: date_toolName_tier
    date: { type: 'string', maxLength: 20 },
    toolName: { type: 'string', maxLength: 100 },
    tier: { type: 'string', maxLength: 20 },
    callCount: { type: 'number', minimum: 0, maximum: 1000000, multipleOf: 1 },
    successCount: {
      type: 'number',
      minimum: 0,
      maximum: 1000000,
      multipleOf: 1,
    },
    failureCount: {
      type: 'number',
      minimum: 0,
      maximum: 1000000,
      multipleOf: 1,
    },
    totalExecutionTimeMs: {
      type: 'number',
      minimum: 0,
      maximum: 1000000000,
      multipleOf: 1,
    },
    avgExecutionTimeMs: {
      type: 'number',
      minimum: 0,
      maximum: 1000000000,
      multipleOf: 1,
    },
    updatedAt: { type: 'string', maxLength: 30 },
  },
  required: [
    'id',
    'date',
    'toolName',
    'tier',
    'callCount',
    'successCount',
    'failureCount',
    'totalExecutionTimeMs',
    'avgExecutionTimeMs',
    'updatedAt',
  ],
  indexes: ['date', 'toolName', 'tier', ['date', 'toolName']],
};

export const ragMetricSchema: RxJsonSchema<RagMetricDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    metricId: { type: 'string', maxLength: 100 },
    type: { type: 'string', maxLength: 30 },
    timestamp: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    sessionId: { type: 'string', maxLength: 100 },
    docId: { type: 'string', maxLength: 100 },
    value: { type: 'object' },
    createdAt: { type: 'string', maxLength: 30 },
  },
  required: ['id', 'metricId', 'type', 'timestamp', 'value', 'createdAt'],
  indexes: ['type', 'timestamp', 'metricId'],
};

export const systemLogSchema: RxJsonSchema<SystemLogDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    level: { type: 'string', maxLength: 10 },
    category: { type: 'string', maxLength: 20 },
    message: { type: 'string' },
    data: { type: 'object' },
    sessionId: { type: 'string', maxLength: 100 },
    timestamp: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    createdAt: { type: 'string', maxLength: 30 },
  },
  required: ['id', 'level', 'category', 'message', 'timestamp', 'createdAt'],
  indexes: ['level', 'timestamp', 'category'],
};

// Vector embedding schema with Distance-to-Samples indexing
export const vectorEmbeddingSchema: RxJsonSchema<VectorEmbeddingDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    documentId: { type: 'string', maxLength: 100, ref: 'documents' }, // Population: reference to documents collection
    chunkIndex: { type: 'number', minimum: 0, maximum: 10000, multipleOf: 1 },
    sessionId: { type: 'string', maxLength: 100 },
    text: { type: 'string' },
    embedding: { type: 'array', items: { type: 'number' } },
    // Distance-to-Samples index fields for fast vector search
    idx0: indexSchema,
    idx1: indexSchema,
    idx2: indexSchema,
    idx3: indexSchema,
    idx4: indexSchema,
    createdAt: { type: 'string', maxLength: 30 },
  },
  required: [
    'id',
    'documentId',
    'chunkIndex',
    'sessionId',
    'text',
    'embedding',
    'idx0',
    'idx1',
    'idx2',
    'idx3',
    'idx4',
    'createdAt',
  ],
  indexes: ['documentId', 'sessionId', 'idx0', 'idx1', 'idx2', 'idx3', 'idx4'],
};

// Offline queue schema
export const offlineQueueSchema: RxJsonSchema<OfflineQueueDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    type: { type: 'string', maxLength: 30 },
    payload: { type: 'object' },
    status: { type: 'string', maxLength: 20 },
    retryCount: { type: 'number', minimum: 0, maximum: 100, multipleOf: 1 },
    createdAt: { type: 'string', maxLength: 30 },
    lastAttempt: { type: 'string', maxLength: 30 },
    error: { type: 'string' },
  },
  required: ['id', 'type', 'payload', 'status', 'retryCount', 'createdAt'],
  indexes: ['type', 'status', 'createdAt'],
};

// GoggaSmart skill schema
export const goggaSmartSkillSchema: RxJsonSchema<GoggaSmartSkillDoc> = {
  version: 2, // Bumped again: Force migration after schema hash mismatch
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    skillId: { type: 'string', maxLength: 100 },
    userId: { type: 'string', maxLength: 100 },
    section: { type: 'string', maxLength: 100 },
    content: { type: 'string' },
    helpful: { type: 'number', minimum: 0, maximum: 1000000, multipleOf: 1 },
    harmful: { type: 'number', minimum: 0, maximum: 1000000, multipleOf: 1 },
    neutral: { type: 'number', minimum: 0, maximum: 1000000, multipleOf: 1 },
    context: { type: 'string' },
    status: { type: 'string', maxLength: 20 },
    createdAt: { type: 'string', maxLength: 30 },
    updatedAt: { type: 'string', maxLength: 30 },
  },
  required: [
    'id',
    'skillId',
    'userId',
    'section',
    'content',
    'helpful',
    'harmful',
    'neutral',
    'status',
    'createdAt',
    'updatedAt',
  ],
  indexes: [
    'skillId',
    'userId',
    'section',
    'status',
    ['userId', 'section'],
    'createdAt',
    'updatedAt',
  ],
};

// Icon Generation Schema
export const iconGenerationSchema: RxJsonSchema<IconGenerationDoc> = {
  version: 1, // Bumped: Added maxLength to tier field for index compatibility
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    userId: {
      type: 'string',
      maxLength: 255,
    },
    svgContent: {
      type: 'string',
      maxLength: 50000, // SVG can be large
    },
    prompt: {
      type: 'string',
      maxLength: 500,
    },
    tier: {
      type: 'string',
      enum: ['JIVE', 'JIGGA'],
      maxLength: 10, // Required for indexed fields
    },
    tokensPrompt: {
      type: 'number',
      minimum: 0,
    },
    tokensCandidates: {
      type: 'number',
      minimum: 0,
    },
    tokensTotal: {
      type: 'number',
      minimum: 0,
    },
    costZar: {
      type: 'number',
      minimum: 0,
    },
    lighting: {
      type: 'string',
      maxLength: 50,
    },
    complexity: {
      type: 'string',
      maxLength: 50,
    },
    backing: {
      type: 'string',
      maxLength: 50,
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      maxLength: 50,
    },
    downloaded: {
      type: 'boolean',
      default: false,
    },
  },
  required: [
    'id',
    'userId',
    'svgContent',
    'prompt',
    'tier',
    'tokensPrompt',
    'tokensCandidates',
    'tokensTotal',
    'costZar',
    'lighting',
    'complexity',
    'backing',
    'createdAt',
  ],
  indexes: [
    'userId',
    'tier',
    'createdAt',
    ['userId', 'createdAt'], // For user's icon history sorted by date
  ],
};

// ============================================================================
// Collection Types
// ============================================================================

export type DocumentDocument = RxDocument<DocumentDoc>;
export type DocumentChunkDocument = RxDocument<DocumentChunkDoc>;
export type ChatSessionDocument = RxDocument<ChatSessionDoc>;
export type ChatMessageDocument = RxDocument<ChatMessageDoc>;
export type GeneratedImageDocument = RxDocument<GeneratedImageDoc>;
export type UserPreferenceDocument = RxDocument<UserPreferenceDoc>;
export type MemoryContextDocument = RxDocument<MemoryContextDoc>;
export type TokenUsageDocument = RxDocument<TokenUsageDoc>;
export type ToolUsageDocument = RxDocument<ToolUsageDoc>;
export type RagMetricDocument = RxDocument<RagMetricDoc>;
export type SystemLogDocument = RxDocument<SystemLogDoc>;
export type VectorEmbeddingDocument = RxDocument<VectorEmbeddingDoc>;
export type OfflineQueueDocument = RxDocument<OfflineQueueDoc>;
export type GoggaSmartSkillDocument = RxDocument<GoggaSmartSkillDoc>;
export type IconGenerationDocument = RxDocument<IconGenerationDoc>;

export type DocumentCollection = RxCollection<DocumentDoc>;
export type DocumentChunkCollection = RxCollection<DocumentChunkDoc>;
export type ChatSessionCollection = RxCollection<ChatSessionDoc>;
export type ChatMessageCollection = RxCollection<ChatMessageDoc>;
export type GeneratedImageCollection = RxCollection<GeneratedImageDoc>;
export type UserPreferenceCollection = RxCollection<UserPreferenceDoc>;
export type MemoryContextCollection = RxCollection<MemoryContextDoc>;
export type TokenUsageCollection = RxCollection<TokenUsageDoc>;
export type ToolUsageCollection = RxCollection<ToolUsageDoc>;
export type RagMetricCollection = RxCollection<RagMetricDoc>;
export type SystemLogCollection = RxCollection<SystemLogDoc>;
export type VectorEmbeddingCollection = RxCollection<VectorEmbeddingDoc>;
export type OfflineQueueCollection = RxCollection<OfflineQueueDoc>;
export type GoggaSmartSkillCollection = RxCollection<GoggaSmartSkillDoc>;
export type IconGenerationCollection = RxCollection<IconGenerationDoc>;

// Database collections type
export interface GoggaRxCollections {
  documents: DocumentCollection;
  documentChunks: DocumentChunkCollection;
  chatSessions: ChatSessionCollection;
  chatMessages: ChatMessageCollection;
  generatedImages: GeneratedImageCollection;
  userPreferences: UserPreferenceCollection;
  memoryContexts: MemoryContextCollection;
  tokenUsage: TokenUsageCollection;
  toolUsage: ToolUsageCollection;
  ragMetrics: RagMetricCollection;
  systemLogs: SystemLogCollection;
  vectorEmbeddings: VectorEmbeddingCollection;
  offlineQueue: OfflineQueueCollection;
  goggaSmartSkills: GoggaSmartSkillCollection;
  iconGenerations: IconGenerationCollection;
}

export type GoggaRxDatabase = RxDatabase<GoggaRxCollections>;
