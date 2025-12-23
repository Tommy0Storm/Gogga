/**
 * GOGGA Local RAG System - Enterprise Grade
 * Client-side document chunking and search using FlexSearch + Semantic
 * Per-session RAG for JIVE (keyword) and JIGGA (semantic) tiers
 * 
 * Features:
 * - PDF extraction via pdfjs-dist (industry standard, browser-compatible)
 * - Hybrid search: keyword (FlexSearch) + semantic (E5 embeddings)
 * - Smart chunking with sentence boundary preservation
 * - Query preprocessing and expansion
 * 
 * Supports: PDF, Word (.doc, .docx), TXT, MD, ODT, RTF
 */

import FlexSearch from 'flexsearch';
import db, { 
  type Document, 
  type DocumentChunk,
  isSupportedFormat,
  SUPPORTED_RAG_FORMATS,
  getSessionDocuments,
  clearSessionDocuments,
  generateId,
} from './db';

// Lazy-loaded pdfjs-dist for browser PDF extraction
let pdfjsModule: typeof import('pdfjs-dist') | null = null;
let pdfjsLoading: Promise<typeof import('pdfjs-dist')> | null = null;

/**
 * Lazy load pdfjs-dist for PDF extraction
 * Uses the official Mozilla PDF.js library - industry standard for browser PDF rendering
 */
async function getPdfjs(): Promise<typeof import('pdfjs-dist')> {
  // Only run in browser
  if (typeof window === 'undefined') {
    throw new Error('pdfjs-dist can only be used in browser environment');
  }
  
  if (pdfjsModule) return pdfjsModule;
  
  if (pdfjsLoading) return pdfjsLoading;
  
  pdfjsLoading = (async () => {
    try {
      const pdfjs = await import('pdfjs-dist');
      
      // Set up the worker using jsDelivr CDN for maximum browser compatibility
      // jsDelivr syncs with npm, so it has the latest versions immediately
      const pdfjsVersion = '5.4.449'; // Match installed version
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
      
      pdfjsModule = pdfjs;
      console.log('[RAG] PDF.js extraction initialized (v' + pdfjsVersion + ')');
      return pdfjs;
    } catch (error) {
      console.warn('[RAG] pdfjs-dist not available:', error);
      throw error;
    }
  })();
  
  return pdfjsLoading;
}

// FlexSearch index configuration - per session
// Using 'any' for FlexSearch.Index due to type definition issues
const sessionIndexes = new Map<string, any>();
const indexedDocs = new Map<string, Set<string>>();

// Chunk configuration
const CHUNK_SIZE = 500; // characters
const CHUNK_OVERLAP = 50; // characters

/**
 * Get or create index for a session
 */
function getSessionIndex(sessionId: string): any {
  if (!sessionIndexes.has(sessionId)) {
    sessionIndexes.set(sessionId, new FlexSearch.Index({
      tokenize: 'forward',
      resolution: 9,
      cache: 100,
    }));
    indexedDocs.set(sessionId, new Set());
  }
  return sessionIndexes.get(sessionId)!;
}

/**
 * Split text into overlapping chunks
 */
export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Extract text from various document formats
 */
export async function extractText(file: File): Promise<string> {
  const mimeType = file.type || getMimeTypeFromExtension(file.name);
  
  // Plain text formats - direct read
  if (mimeType === 'text/plain' || 
      mimeType === 'text/markdown' || 
      mimeType === 'application/x-markdown') {
    return await file.text();
  }
  
  // PDF - use pdf.js or simple extraction
  if (mimeType === 'application/pdf') {
    return await extractPdfText(file);
  }
  
  // Word documents
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return await extractDocxText(file);
  }
  
  if (mimeType === 'application/msword') {
    // Legacy .doc format - limited support
    return await extractDocText(file);
  }
  
  // OpenDocument Text
  if (mimeType === 'application/vnd.oasis.opendocument.text') {
    return await extractOdtText(file);
  }
  
  // RTF
  if (mimeType === 'application/rtf' || mimeType === 'text/rtf') {
    return await extractRtfText(file);
  }
  
  // Fallback - try as text
  try {
    return await file.text();
  } catch {
    throw new Error(`Unsupported file format: ${mimeType}`);
  }
}

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeMap: Record<string, string> = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'odt': 'application/vnd.oasis.opendocument.text',
    'rtf': 'application/rtf',
  };
  return mimeMap[ext || ''] || 'text/plain';
}

/**
 * Validate extracted text quality - detects garbled/garbage output
 */
function isValidExtractedText(text: string): boolean {
  if (!text || text.length < 50) return false;
  
  // Check for garbled text patterns
  const garbledPatterns = [
    /[^\x20-\x7E\n\t\u00A0-\u00FF\u0100-\u017F]{20,}/, // Long non-printable sequences
    /(.)\1{15,}/, // 15+ repeated characters
    /^[\d\s.,;:]+$/, // Only numbers and punctuation
    /[\\x][0-9a-fA-F]{2}/, // Escape sequences in output
    /%[0-9A-Fa-f]{2}/, // URL encoding in output
  ];
  
  if (garbledPatterns.some(p => p.test(text))) {
    return false;
  }
  
  // Check word ratio - valid text should have reasonable word structure
  const words = text.split(/\s+/).filter(w => w.length >= 2);
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / (words.length || 1);
  
  // Average word length between 2-15 chars is reasonable
  if (avgWordLength < 2 || avgWordLength > 20) {
    return false;
  }
  
  // At least 10 words for valid content
  if (words.length < 10) {
    return false;
  }
  
  return true;
}

/**
 * Extract text from PDF using pdfjs-dist (Mozilla PDF.js)
 * Industry-standard browser PDF extraction
 * NO SILENT FALLBACK - throws clear errors for unusable PDFs
 */
async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  let lastError: Error | null = null;
  
  // Try extraction with pdfjs-dist
  try {
    const pdfjs = await getPdfjs();
    
    // Load the PDF document
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    console.log(`[RAG] PDF.js loading: ${pdf.numPages} pages`);
    
    // Extract text from all pages
    const textParts: string[] = [];
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items with proper spacing
      const pageText = textContent.items
        .map((item: any) => {
          // Handle both TextItem and TextMarkedContent
          if ('str' in item) {
            return item.str;
          }
          return '';
        })
        .join(' ');
      
      if (pageText.trim()) {
        textParts.push(`--- Page ${pageNum} ---\n${pageText}`);
      }
    }
    
    const fullText = textParts.join('\n\n').replace(/\s+/g, ' ').trim();
    
    console.log(`[RAG] PDF.js extraction: ${pdf.numPages} pages, ${fullText.length} chars`);
    
    if (fullText && isValidExtractedText(fullText)) {
      return fullText;
    }
    
    // PDF.js succeeded but text quality is poor (likely scanned/image PDF)
    lastError = new Error('PDF text extraction produced low-quality output - may be scanned/image-based');
  } catch (error) {
    console.warn('[RAG] pdfjs-dist extraction failed:', error);
    lastError = error instanceof Error ? error : new Error(String(error));
  }
  
  // Try MinerU backend for complex/scanned PDFs (OCR support)
  try {
    // Check if backend is available
    const healthCheck = await fetch('/api/v1/documents/health', { method: 'GET' });
    if (healthCheck.ok) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('enable_ocr', 'true');
      
      const response = await fetch('/api/v1/documents/parse-upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.text && isValidExtractedText(result.text)) {
          console.log('[RAG] MinerU backend extraction successful');
          return result.text;
        }
      }
    }
  } catch (backendError) {
    console.warn('[RAG] MinerU backend not available:', backendError);
  }
  
  // NO SILENT GARBAGE FALLBACK - throw clear error
  throw new Error(
    `Could not extract readable text from "${file.name}". ` +
    `The PDF may be scanned, encrypted, or image-based. ` +
    `Please try: 1) Converting to searchable PDF with OCR, 2) Copying text to a .txt file, ` +
    `or 3) Using a different document format.` +
    (lastError ? ` (Technical: ${lastError.message})` : '')
  );
}

/**
 * Extract text from DOCX (Office Open XML)
 */
async function extractDocxText(file: File): Promise<string> {
  try {
    const JSZip = (await import('jszip') as any).default;
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Get document.xml content
    const docXml = await zip.file('word/document.xml')?.async('string');
    if (!docXml) {
      throw new Error('Invalid DOCX: No document.xml found');
    }
    
    // Parse XML and extract text
    const parser = new DOMParser();
    const doc = parser.parseFromString(docXml, 'application/xml');
    
    // Extract text from w:t elements
    const textNodes = doc.getElementsByTagName('w:t');
    let text = '';
    
    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes[i];
      if (node) {
        text += (node.textContent ?? '') + ' ';
      }
    }
    
    // Also check for w:p (paragraphs) to add line breaks
    return text.replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error('DOCX extraction error:', error);
    return `[Could not extract text from ${file.name}. The document may be encrypted or corrupted.]`;
  }
}

/**
 * Extract text from legacy DOC format (limited support)
 */
async function extractDocText(file: File): Promise<string> {
  // Legacy .doc files are complex binary format
  // Basic extraction of readable strings
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const content = decoder.decode(bytes);
  
  // Extract readable ASCII sequences
  const asciiRegex = /[\x20-\x7E]{15,}/g;
  const matches = content.match(asciiRegex) || [];
  
  const text = matches
    .filter(s => 
      !s.includes('Microsoft') && 
      !s.includes('xmlns') &&
      s.split(' ').length > 2
    )
    .join(' ');
  
  return text.trim() || 
    `[Legacy .doc format from: ${file.name}. For best results, convert to .docx or .txt]`;
}

/**
 * Extract text from ODT (OpenDocument Text)
 */
async function extractOdtText(file: File): Promise<string> {
  try {
    const JSZip = (await import('jszip') as any).default;
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Get content.xml
    const contentXml = await zip.file('content.xml')?.async('string');
    if (!contentXml) {
      throw new Error('Invalid ODT: No content.xml found');
    }
    
    // Parse XML and extract text
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentXml, 'application/xml');
    
    // Extract text from text:p elements
    const textNodes = doc.getElementsByTagName('text:p');
    let text = '';
    
    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes[i];
      if (node) {
        text += (node.textContent ?? '') + '\n';
      }
    }
    
    return text.replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error('ODT extraction error:', error);
    return `[Could not extract text from ${file.name}]`;
  }
}

/**
 * Extract text from RTF
 */
async function extractRtfText(file: File): Promise<string> {
  const content = await file.text();
  
  // Remove RTF control words and groups
  let text = content
    .replace(/\\[a-z]+\d*\s?/g, '') // Remove control words
    .replace(/[{}]/g, '') // Remove braces
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => 
      String.fromCharCode(parseInt(hex, 16))
    ) // Convert hex chars
    .replace(/\s+/g, ' ')
    .trim();
  
  return text;
}

/**
 * Validate file format
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const mimeType = file.type || getMimeTypeFromExtension(file.name);
  
  if (!isSupportedFormat(mimeType)) {
    const supported = Object.values(SUPPORTED_RAG_FORMATS).map(f => f.name).join(', ');
    return { 
      valid: false, 
      error: `Unsupported format. Supported: ${supported}` 
    };
  }
  
  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'File too large. Maximum 10MB.' };
  }
  
  return { valid: true };
}

/**
 * Add a document to the per-session RAG system
 */
export async function addDocument(
  sessionId: string,
  file: File
): Promise<Document> {
  // Validate
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Extract text
  const content = await extractText(file);
  if (content.length < 10) {
    throw new Error('Could not extract meaningful text from document');
  }
  
  const chunks = chunkText(content);
  const now = new Date().toISOString(); // RxDB requires ISO strings, not Date objects
  const mimeType = file.type || getMimeTypeFromExtension(file.name);

  // Store document with v8 session-scoped RAG fields
  const docId = await db.documents.add({
    // RxDB requires id to be provided
    id: generateId(),
    // v8 Session-Scoped RAG fields
    userId: sessionId.split('_')[0] || 'anonymous', // Extract user from session or use anonymous
    originSessionId: sessionId,     // Where doc was originally uploaded
    activeSessions: [sessionId],    // Initially active in upload session
    accessCount: 1,                 // First access
    lastAccessedAt: now,
    // Legacy field (deprecated but kept for compatibility)
    sessionId,
    // Document content
    filename: file.name,
    content,
    chunks,
    chunkCount: chunks.length,
    size: file.size,
    mimeType,
    createdAt: now,
    updatedAt: now,
  });

  // Store chunks for indexing
  const chunkRecords = chunks.map((text, i) => ({
    id: generateId(),
    documentId: docId, // RxDB requires string
    sessionId,
    chunkIndex: i,
    text,
    tokenCount: estimateTokens(text),
  }));

  await db.chunks.bulkAdd(chunkRecords as DocumentChunk[]);

  // Index chunks in FlexSearch
  const index = getSessionIndex(sessionId);
  const docSet = indexedDocs.get(sessionId)!;

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = `${docId}_${i}`;
    index.add(chunkId as unknown as number, chunks[i] ?? '');
  }
  docSet.add(docId);

  // Emit document_added metric for dashboard
  const { emitMetric } = await import('./ragMetrics');
  emitMetric({
    type: 'query', // Using 'query' type to track document events
    sessionId,
    docId,
    value: {
      event: 'document_added',
      filename: file.name,
      size: file.size,
      chunkCount: chunks.length,
      mimeType,
    },
  });

  const result = await db.documents.get(docId) as Document | undefined;
  if (!result) {
    throw new Error('Document not found after adding');
  }
  return result;
}

/**
 * Add a document to the RAG Store (persistent, cross-session)
 * RAG Store documents have originSessionId = '' to indicate they're not session-scoped.
 * They're automatically available in all sessions for JIVE/JIGGA users.
 * 
 * @param userId - The user's ID (for ownership)
 * @param file - The file to add
 * @returns The created Document
 */
export async function addRAGStoreDocument(
  userId: string,
  file: File
): Promise<Document> {
  // Validate
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Extract text
  const content = await extractText(file);
  if (content.length < 10) {
    throw new Error('Could not extract meaningful text from document');
  }
  
  const chunks = chunkText(content);
  const now = new Date().toISOString(); // RxDB requires ISO strings, not Date objects
  const mimeType = file.type || getMimeTypeFromExtension(file.name);

  // Store document with RAG Store semantics (no session scope)
  const docId = await db.documents.add({
    // RxDB requires id to be provided
    id: generateId(),
    // RAG Store: Not session-scoped
    userId,
    originSessionId: '',           // Empty = RAG Store document (not session-scoped)
    activeSessions: [],            // RAG Store docs are always available, no session tracking
    accessCount: 0,
    lastAccessedAt: now,
    // Legacy field (empty for RAG Store)
    sessionId: '',
    // Document content
    filename: file.name,
    content,
    chunks,
    chunkCount: chunks.length,
    size: file.size,
    mimeType,
    createdAt: now,
    updatedAt: now,
  });

  // Store chunks for indexing
  const chunkRecords = chunks.map((text, i) => ({
    id: generateId(),
    documentId: docId, // RxDB requires string
    sessionId: '', // No session for RAG Store chunks
    chunkIndex: i,
    text,
    tokenCount: estimateTokens(text),
  }));

  await db.chunks.bulkAdd(chunkRecords as DocumentChunk[]);

  // Emit document_added metric for dashboard
  const { emitMetric } = await import('./ragMetrics');
  emitMetric({
    type: 'query',
    sessionId: 'rag_store', // Special session ID for RAG Store metrics
    docId,
    value: {
      event: 'rag_store_document_added',
      filename: file.name,
      size: file.size,
      chunkCount: chunks.length,
      mimeType,
      userId,
    },
  });

  const result = await db.documents.get(docId) as Document | undefined;
  if (!result) {
    throw new Error('Document not found after adding');
  }
  return result;
}

/**
 * Remove a document from the RAG Store (permanent deletion)
 * Unlike session documents, RAG Store docs are fully deleted.
 */
export async function removeRAGStoreDocument(docId: string): Promise<void> {
  const doc = await db.documents.get(docId) as Document | undefined;
  if (!doc) return;

  // Only allow deletion of RAG Store documents (originSessionId is empty)
  if (doc.originSessionId !== '') {
    throw new Error('Cannot delete session document using RAG Store deletion. Use removeDocument instead.');
  }

  // Delete chunks
  await db.chunks.where('documentId').equals(docId).delete();
  
  // Delete document
  await db.documents.delete(docId);

  // Emit deletion metric
  const { emitMetric } = await import('./ragMetrics');
  emitMetric({
    type: 'query',
    sessionId: 'rag_store',
    docId,
    value: {
      event: 'rag_store_document_removed',
      filename: doc.filename,
    },
  });
}

/**
 * Get all RAG Store documents (persistent, cross-session) for a user
 */
export async function getRAGStoreDocuments(userId: string): Promise<Document[]> {
  const allDocs = await db.documents.toArray() as Document[];
  // RAG Store documents have empty originSessionId
  return allDocs.filter(doc => doc.originSessionId === '' && doc.userId === userId);
}

/**
 * Remove a document from the session RAG system
 * Session-Scoped RAG v8: Deactivates from current session, only deletes if orphaned
 */
export async function removeDocument(sessionId: string, docId: string): Promise<void> {
  console.log('[RAG] removeDocument called:', { sessionId, docId });
  const doc = await db.documents.get(docId) as Document | undefined;
  console.log('[RAG] Document found:', doc ? doc.filename : 'NOT FOUND');
  // v8: Check if doc exists and is active in this session
  if (!doc || !doc.activeSessions?.includes(sessionId)) {
    console.log('[RAG] Document not found or not active in session, returning');
    return;
  }

  // Remove from FlexSearch index for this session
  const index = getSessionIndex(sessionId);
  const docSet = indexedDocs.get(sessionId);
  
  for (let i = 0; i < doc.chunkCount; i++) {
    const chunkId = `${docId}_${i}`;
    index.remove(chunkId as unknown as number);
  }
  docSet?.delete(docId);

  // v8: Deactivate from this session
  const newActiveSessions = doc.activeSessions.filter((id: string) => id !== sessionId);
  
  try {
    if (newActiveSessions.length === 0) {
      // No more active sessions - delete completely from pool
      await db.chunks.where('documentId').equals(docId).delete();
      await db.documents.delete(docId);
    } else {
      // Still active in other sessions - just update activeSessions
      await db.documents.update(docId, { 
        activeSessions: newActiveSessions,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    // Handle RxDB conflicts gracefully - document may have been deleted by another operation
    if (error && typeof error === 'object' && 'code' in error && error.code === 'CONFLICT') {
      console.log('[RAG] Document already removed or modified, ignoring conflict');
    } else {
      throw error;
    }
  }

  // Emit document_removed metric for dashboard
  const { emitMetric } = await import('./ragMetrics');
  emitMetric({
    type: 'query',
    sessionId,
    docId,
    value: {
      event: 'document_removed',
      filename: doc.filename,
    },
  });
}

/**
 * Search documents in a session and return relevant chunks
 */
export async function searchDocuments(
  sessionId: string,
  query: string,
  maxResults: number = 5
): Promise<{ docId: string; chunkIndex: number; text: string; score: number }[]> {
  // Ensure index is loaded
  await ensureIndexLoaded(sessionId);

  const index = getSessionIndex(sessionId);
  const results = index.search(query, { limit: maxResults * 2 });
  const uniqueResults: { docId: string; chunkIndex: number; text: string; score: number }[] = [];
  const seenDocs = new Set<string>();

  for (const resultId of results) {
    const parts = String(resultId).split('_');
    const docId = parts[0] ?? '';
    const chunkIndexStr = parts[1] ?? '0';
    const chunkIndex = parseInt(chunkIndexStr, 10);

    // Get unique results per document (prefer first match)
    if (docId && !seenDocs.has(docId) && uniqueResults.length < maxResults) {
      const chunk = await db.chunks
        .where({ documentId: docId, chunkIndex })
        .first() as DocumentChunk | undefined;

      if (chunk) {
        uniqueResults.push({
          docId,
          chunkIndex,
          text: chunk.text,
          score: 1 - uniqueResults.length * 0.1, // Simple ranking
        });
        seenDocs.add(docId);
      }
    }
  }

  return uniqueResults;
}

/**
 * Get context string for chat injection
 */
export async function getRAGContext(
  sessionId: string,
  query: string,
  maxChunks: number = 3,
  maxTokens: number = 1500
): Promise<string | null> {
  const results = await searchDocuments(sessionId, query, maxChunks);
  
  if (results.length === 0) return null;

  let context = '';
  let totalTokens = 0;

  for (const result of results) {
    const doc = await db.documents.get(result.docId) as Document | undefined;
    const chunkTokens = estimateTokens(result.text);
    
    if (totalTokens + chunkTokens > maxTokens) break;
    
    context += `\n\n[From: ${doc?.filename}]\n${result.text}`;
    totalTokens += chunkTokens;
  }

  if (context.trim().length === 0) return null;

  return `The following context from the user's documents may be relevant:\n${context}`;
}

/**
 * Ensure all session documents are indexed
 */
export async function ensureIndexLoaded(sessionId: string): Promise<void> {
  const docs = await getSessionDocuments(sessionId);
  const index = getSessionIndex(sessionId);
  const docSet = indexedDocs.get(sessionId)!;
  
  for (const doc of docs) {
    if (doc.id && !docSet.has(doc.id)) {
      for (let i = 0; i < doc.chunks.length; i++) {
        const chunkId = `${doc.id}_${i}`;
        index.add(chunkId as unknown as number, doc.chunks[i]);
      }
      docSet.add(doc.id);
    }
  }
}

/**
 * Get all documents for a session
 */
export async function getAllDocuments(sessionId: string): Promise<Document[]> {
  return getSessionDocuments(sessionId);
}

/**
 * Clear all RAG data for a session
 */
export async function clearRAGData(sessionId: string): Promise<void> {
  // Clear FlexSearch index
  sessionIndexes.delete(sessionId);
  indexedDocs.delete(sessionId);
  
  // Clear database
  await clearSessionDocuments(sessionId);
}

/**
 * Clear session index from memory (when switching sessions)
 */
export function unloadSession(sessionId: string): void {
  sessionIndexes.delete(sessionId);
  indexedDocs.delete(sessionId);
}

/**
 * Index an external document (from another session) into the current session's search index
 * This allows searching across selected documents from other sessions
 */
export async function indexExternalDocument(
  sessionId: string,
  doc: Document
): Promise<void> {
  if (!doc.id || !doc.chunks || doc.chunks.length === 0) {
    return;
  }

  const index = getSessionIndex(sessionId);
  const docSet = indexedDocs.get(sessionId)!;
  
  // Skip if already indexed
  if (docSet.has(doc.id)) {
    return;
  }

  // Index all chunks from the external document
  for (let i = 0; i < doc.chunks.length; i++) {
    const chunkId = `${doc.id}_${i}`;
    index.add(chunkId as unknown as number, doc.chunks[i]);
  }
  
  docSet.add(doc.id);
}

// RAG module exports
const ragModule = {
  addDocument,
  removeDocument,
  searchDocuments,
  getRAGContext,
  getAllDocuments,
  clearRAGData,
  ensureIndexLoaded,
  unloadSession,
  indexExternalDocument,
  chunkText,
  estimateTokens,
  extractText,
  validateFile,
  getSessionIndex, // Exported for test access
  // RAG Store (persistent, cross-session) functions
  addRAGStoreDocument,
  removeRAGStoreDocument,
  getRAGStoreDocuments,
};

export default ragModule;
