import { describe, it, expect, vi } from 'vitest';

vi.mock('flexsearch');
vi.mock('jszip');
vi.mock('@huggingface/transformers');

import { embeddingEngine } from './embeddingEngine';
import { ragManager } from './ragManager';
import rag from './rag';
import { Document } from './db';

describe('Enterprise RAG Pipeline', () => {
  const TEST_DOC: Document = {
    id: 1,
    sessionId: 'jest-session',
    filename: 'RHA_Overview.txt',
    content: 'South African law protects tenants from unfair eviction. The Rental Housing Act (RHA) outlines tenant rights and dispute resolution.',
    chunks: [],
    chunkCount: 1,
    size: 120,
    mimeType: 'text/plain',
    createdAt: new Date(),
    updatedAt: new Date(),
    // v8 Session-Scoped RAG fields
    userId: 'test-user',
    originSessionId: 'jest-session',
    activeSessions: ['jest-session'],
    accessCount: 1,
    lastAccessedAt: new Date(),
  };

  it('should generate semantic embeddings', async () => {
    await embeddingEngine.init();
    const result = await embeddingEngine.generateDocumentEmbeddings(TEST_DOC);
    expect(result.vectors.length).toBeGreaterThan(0);
    expect(result.metadata.dimension).toBe(384);
  });

  it('should retrieve semantic context with RagManager', async () => {
    ragManager.setDocuments('jest-session', [TEST_DOC]);
    await ragManager.ensureEmbeddings('jest-session');
    const context = await ragManager.getContextForLLM('jest-session', 'tenant eviction rights', 'semantic', { topK: 3, maxTokens: 500 });
    expect(context).not.toBeNull();
    expect(typeof context).toBe('string');
    expect(context!.length).toBeGreaterThan(0);
  });

  it('should chunk text correctly', async () => {
    // Test chunking operations
    const chunks = rag.chunkText(TEST_DOC.content);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.length).toBeGreaterThan(0);
    
    // Verify chunk contains expected content
    const allText = chunks.join(' ');
    expect(allText.toLowerCase()).toContain('tenant');
    expect(allText.toLowerCase()).toContain('eviction');
  });
});
