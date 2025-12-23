// RAG Test Script for Enterprise Validation
import { embeddingEngine } from './embeddingEngine';
import { ragManager } from './ragManager';
import rag from './rag';


import { Document } from './db';

const TEST_DOC: Document = {
  id: 'test-doc-1',
  sessionId: 'test-session',
  filename: 'RHA_Overview.txt',
  content: 'South African law protects tenants from unfair eviction. The Rental Housing Act (RHA) outlines tenant rights and dispute resolution.',
  chunks: [],
  chunkCount: 1,
  size: 120,
  mimeType: 'text/plain',
  userId: 'test-user',
  originSessionId: 'test-session',
  activeSessions: ['test-session'],
  accessCount: 0,
  lastAccessedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function testEmbeddings() {
  console.log('Testing EmbeddingEngine...');
  await embeddingEngine.init();
  const result = await embeddingEngine.generateDocumentEmbeddings(TEST_DOC);
  console.log('Embedding result:', result.metadata, result.vectors.length);
}

async function testSemanticRAG() {
  console.log('Testing RagManager semantic retrieval...');
  ragManager.setDocuments('test-session', [TEST_DOC]);
  await ragManager.ensureEmbeddings('test-session');
  const context = await ragManager.getContextForLLM('test-session', 'tenant eviction rights', 'semantic', { topK: 3, maxTokens: 500 });
  console.log('Semantic context:', context);
}

async function testBasicRAG() {
  console.log('Testing FlexSearch basic retrieval...');
  // Manually chunk and index for basic RAG
  const chunks = rag.chunkText(TEST_DOC.content);
  const index = (rag as any).getSessionIndex(TEST_DOC.sessionId);
  chunks.forEach((chunk: string, i: number) => {
    index.add(i, chunk);
  });
  const context = await rag.getRAGContext('test-session', 'tenant eviction rights', 3, 500);
  console.log('Basic context:', context);
}

export async function runRAGTests() {
  await testEmbeddings();
  await testSemanticRAG();
  await testBasicRAG();
  console.log('RAG tests completed.');
}
