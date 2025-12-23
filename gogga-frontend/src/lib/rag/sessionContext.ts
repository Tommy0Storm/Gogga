/**
 * GOGGA Session Context Manager
 * 
 * Manages RAG context for a single chat session with:
 * - Token budgeting (state vs RAG vs volatile)
 * - Document activation from user's pool
 * - Context building for LLM prompts
 * 
 * Key invariants:
 * - State tokens are NEVER evicted for RAG
 * - RAG retrieval ONLY returns docs where activeSessions.includes(sessionId)
 * - Context is rebuilt on each query
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md
 */

import type { DocumentDoc } from '../rxdb/schemas';
import type { Tier, RagMode } from '../config/tierConfig';

// Token budgets per tier
export const TOKEN_BUDGETS = {
  free: { state: 1000, rag: 0, volatile: 4000, response: 4000, total: 8000 },
  jive: { state: 2000, rag: 3000, volatile: 6000, response: 5000, total: 16000 },
  jigga: { state: 3000, rag: 6000, volatile: 8000, response: 8000, total: 24000 },
} as const;

// RAG chunk from retrieval
export interface RagChunk {
  docId: string;
  documentName: string;
  chunkIndex: number;
  text: string;
  score: number;
  page?: number;
}

// Session context state
export interface SessionContextState {
  sessionId: string;
  tier: Tier;
  mode: RagMode;
  activeDocIds: string[];        // Document IDs active for this session
  stateTokens: number;           // Authoritative state tokens used
  ragTokens: number;             // RAG context tokens used
  volatileTokens: number;        // Chat history tokens used
}

// Context building result
export interface BuiltContext {
  systemPrompt: string;          // Full system prompt with RAG context
  ragChunks: RagChunk[];         // Chunks included in context
  tokensUsed: {
    state: number;
    rag: number;
    volatile: number;
    total: number;
  };
  truncated: boolean;            // True if chunks were dropped due to budget
}

/**
 * SessionContextManager - Per-session RAG context management
 */
export class SessionContextManager {
  private sessionId: string;
  private tier: Tier;
  private mode: RagMode;
  private activeDocIds: Set<string> = new Set();
  private stateContext: string = '';
  private lastRagChunks: RagChunk[] = [];
  
  constructor(sessionId: string, tier: Tier, mode: RagMode = 'analysis') {
    this.sessionId = sessionId;
    this.tier = tier;
    this.mode = mode;
  }
  
  /**
   * Get token budget for this tier
   */
  getBudget() {
    return TOKEN_BUDGETS[this.tier];
  }
  
  /**
   * Set authoritative state context (user facts, preferences)
   * This is NEVER evicted for RAG
   */
  setStateContext(context: string): void {
    this.stateContext = context;
  }
  
  /**
   * Get authoritative state context
   */
  getStateContext(): string {
    return this.stateContext;
  }
  
  /**
   * Activate documents for this session
   */
  activateDocuments(docIds: string[]): void {
    for (const id of docIds) {
      this.activeDocIds.add(id);
    }
  }
  
  /**
   * Deactivate a document from this session
   */
  deactivateDocument(docId: string): void {
    this.activeDocIds.delete(docId);
  }
  
  /**
   * Get active document IDs for this session
   */
  getActiveDocIds(): string[] {
    return Array.from(this.activeDocIds);
  }
  
  /**
   * Check if a document is active for this session
   */
  isDocActive(docId: string): boolean {
    return this.activeDocIds.has(docId);
  }
  
  /**
   * Build RAG context prompt from retrieved chunks
   * Respects token budget, drops lowest-ranked chunks if over budget
   */
  buildRagContext(
    chunks: RagChunk[],
    maxTokens?: number
  ): { prompt: string; usedChunks: RagChunk[]; truncated: boolean } {
    const budget = maxTokens ?? this.getBudget().rag;
    
    // FREE tier has no RAG budget
    if (budget === 0) {
      return { prompt: '', usedChunks: [], truncated: false };
    }
    
    // Sort by score (highest first)
    const sortedChunks = [...chunks].sort((a, b) => b.score - a.score);
    
    const usedChunks: RagChunk[] = [];
    let currentTokens = 0;
    let truncated = false;
    
    // Estimate tokens per chunk (rough: 4 chars = 1 token)
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);
    
    // Header tokens
    const headerTokens = this.mode === 'authoritative' ? 80 : 50;
    currentTokens += headerTokens;
    
    for (const chunk of sortedChunks) {
      const chunkTokens = estimateTokens(chunk.text) + 20; // +20 for metadata
      
      if (currentTokens + chunkTokens > budget) {
        truncated = true;
        break;
      }
      
      usedChunks.push(chunk);
      currentTokens += chunkTokens;
    }
    
    // Build prompt
    const prompt = this.formatRagPrompt(usedChunks);
    this.lastRagChunks = usedChunks;
    
    return { prompt, usedChunks, truncated };
  }
  
  /**
   * Format RAG chunks as prompt context
   */
  private formatRagPrompt(chunks: RagChunk[]): string {
    if (chunks.length === 0) {
      return '';
    }
    
    const lines: string[] = [];
    
    // Mode-specific header
    if (this.mode === 'authoritative') {
      lines.push('[AUTHORITATIVE DOCUMENT CONTEXT]');
      lines.push('CRITICAL: Base your response ONLY on these documents.');
      lines.push('Do NOT use external knowledge. Always cite sources.');
    } else {
      lines.push('[DOCUMENT CONTEXT]');
      lines.push('Use these excerpts to inform your response.');
      lines.push('You may also draw on general knowledge when appropriate.');
    }
    
    lines.push('');
    
    // Add chunks
    for (const chunk of chunks) {
      lines.push('---');
      const pageInfo = chunk.page ? ` (page ${chunk.page})` : '';
      lines.push(`Source: ${chunk.documentName}${pageInfo}`);
      lines.push(`"${chunk.text}"`);
    }
    
    lines.push('---');
    lines.push('');
    
    if (this.mode === 'authoritative') {
      lines.push('[END AUTHORITATIVE DOCUMENT CONTEXT]');
    } else {
      lines.push('[END DOCUMENT CONTEXT]');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Get last RAG chunks used (for citation tracking)
   */
  getLastRagChunks(): RagChunk[] {
    return this.lastRagChunks;
  }
  
  /**
   * Build full context with token budgeting
   * Priority: System > State > Volatile > RAG
   */
  buildFullContext(
    systemPrompt: string,
    chatHistory: Array<{ role: string; content: string }>,
    ragChunks: RagChunk[]
  ): BuiltContext {
    const budget = this.getBudget();
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);
    
    // 1. System prompt (fixed, never cut)
    const systemTokens = estimateTokens(systemPrompt);
    
    // 2. State context (never evicted for RAG)
    const stateTokens = estimateTokens(this.stateContext);
    
    // 3. Volatile memory (chat history) - may be summarized
    let volatileTokens = 0;
    for (const msg of chatHistory) {
      volatileTokens += estimateTokens(msg.content);
    }
    
    // 4. RAG context (drops lowest-ranked if over budget)
    const remainingForRag = Math.max(0, budget.total - systemTokens - stateTokens - volatileTokens - budget.response);
    const ragResult = this.buildRagContext(ragChunks, Math.min(remainingForRag, budget.rag));
    
    // Build final system prompt
    const parts: string[] = [systemPrompt];
    
    if (this.stateContext) {
      parts.push('');
      parts.push('[USER CONTEXT]');
      parts.push(this.stateContext);
      parts.push('[END USER CONTEXT]');
    }
    
    if (ragResult.prompt) {
      parts.push('');
      parts.push(ragResult.prompt);
    }
    
    return {
      systemPrompt: parts.join('\n'),
      ragChunks: ragResult.usedChunks,
      tokensUsed: {
        state: stateTokens,
        rag: estimateTokens(ragResult.prompt),
        volatile: volatileTokens,
        total: systemTokens + stateTokens + volatileTokens + estimateTokens(ragResult.prompt),
      },
      truncated: ragResult.truncated,
    };
  }
  
  /**
   * Get session state for persistence
   */
  getState(): SessionContextState {
    const budget = this.getBudget();
    
    return {
      sessionId: this.sessionId,
      tier: this.tier,
      mode: this.mode,
      activeDocIds: this.getActiveDocIds(),
      stateTokens: Math.ceil(this.stateContext.length / 4),
      ragTokens: this.lastRagChunks.reduce((sum, c) => sum + Math.ceil(c.text.length / 4), 0),
      volatileTokens: 0, // Set by caller
    };
  }
  
  /**
   * Restore session state
   */
  restoreState(state: Partial<SessionContextState>): void {
    if (state.mode) {
      this.mode = state.mode;
    }
    if (state.activeDocIds) {
      this.activeDocIds = new Set(state.activeDocIds);
    }
  }
  
  /**
   * Set RAG mode (analysis or authoritative)
   */
  setMode(mode: RagMode): void {
    this.mode = mode;
  }
  
  /**
   * Get current RAG mode
   */
  getMode(): RagMode {
    return this.mode;
  }
  
  /**
   * Check if authoritative mode is available for this tier
   */
  canUseAuthoritativeMode(): boolean {
    return this.tier === 'jigga';
  }
  
  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
  
  /**
   * Get tier
   */
  getTier(): Tier {
    return this.tier;
  }
}

// Session context cache
const sessionContexts = new Map<string, SessionContextManager>();

/**
 * Get or create session context manager
 */
export function getSessionContext(
  sessionId: string, 
  tier: Tier, 
  mode: RagMode = 'analysis'
): SessionContextManager {
  const existing = sessionContexts.get(sessionId);
  if (existing) {
    return existing;
  }
  
  const context = new SessionContextManager(sessionId, tier, mode);
  sessionContexts.set(sessionId, context);
  return context;
}

/**
 * Remove session context (on session delete)
 */
export function removeSessionContext(sessionId: string): void {
  sessionContexts.delete(sessionId);
}

/**
 * Clear all session contexts (for testing)
 */
export function clearAllSessionContexts(): void {
  sessionContexts.clear();
}
