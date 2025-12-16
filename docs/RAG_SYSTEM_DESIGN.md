# GOGGA RAG System Design

> **Last Updated:** December 16, 2025  
> **Status:** 🔄 IN PROGRESS  
> **Database:** RxDB 16.21.1 (NOT Dexie - Dexie is deprecated)

## Executive Summary

GOGGA implements a **client-side RAG (Retrieval-Augmented Generation)** system that runs entirely in the browser using RxDB for storage and TransformersJS for embeddings. This design ensures privacy, offline capability, and low latency.

### Tier Access Matrix

> **Two Upload Mechanisms:**
> - **📎 Paperclip** = Session documents (temporary, in-chat context only, cleared on new session)
> - **📚 RAG Button** = Persistent document store (semantic search, cross-session)

| Feature | FREE | JIVE | JIGGA |
|---------|------|------|-------|
| **📎 Paperclip (Session Docs)** | ✅ 1 doc, 2MB (enticement) | ✅ 10 docs, 50MB | ✅ 10 docs, 50MB |
| **📚 RAG Document Store** | ❌ (shows upgrade promo) | ✅ 1 doc, 5MB | ✅ 200 docs, 250MB |
| **RAG Toggle** | ❌ | ✅ On/Off | ✅ On/Off |
| **RAG Modes** | ❌ | Analysis only | Analysis + Authoritative |
| **Keyword Search** | ❌ | ✅ | ✅ |
| **Semantic Search** | ❌ | ✅ E5-small-v2 | ✅ E5-small-v2 |
| **Cross-Session Docs** | ❌ | ❌ | ✅ Pull from any session |
| **RAG Analytics** | ❌ | ❌ | ✅ Dashboard metrics |

> **FREE Tier Enticement:** Users get 1 session doc via paperclip to taste document-in-chat. After upload, they see "Want semantic search? Upgrade to JIVE!"

---

## Document Limits

### 📎 Paperclip - Session Documents (Chat Upload)

Temporary documents attached to current chat session. Cleared when starting a new session.
Content is injected directly into LLM context (no vector search).

| Limit | FREE | JIVE | JIGGA |
|-------|------|------|-------|
| Max documents per session | 1 | 10 | 10 |
| Max total storage | 2 MB | 50 MB | 50 MB |
| Max file size per document | 2 MB | 10 MB | 10 MB |
| Document lifetime | Session only | Session only | Session only |
| Keyword search | ❌ | ❌ | ❌ |
| Semantic search | ❌ | ❌ | ❌ |
| Context injection | ✅ Full text | ✅ Full text | ✅ Full text |

> **FREE Tier Enticement:** 1 session doc lets users taste document-in-chat. After upload: "Love this? Upgrade to JIVE for 10 docs + semantic RAG!"

### 📚 RAG Button - Persistent Document Store

Persistent documents with embeddings for semantic search. Survives across sessions.

| Limit | FREE | JIVE | JIGGA |
|-------|------|------|-------|
| Max documents per user | ❌ | 1 | 200 |
| Max total storage | ❌ | 5 MB | 250 MB |
| Max file size per document | ❌ | 5 MB | 25 MB |
| Max chunks per document | ❌ | 500 | 2000 |
| Chunk size | ❌ | 512 tokens | 512 tokens |
| Keyword search | ❌ | ✅ | ✅ |
| Semantic search | ❌ | ✅ | ✅ |
| RAG modes | ❌ | Analysis only | Analysis + Authoritative |
| Cross-session access | ❌ | ❌ | ✅ |

> **JIVE Enticement:** 1 RAG doc lets users experience semantic search power. At limit: "Upgrade to JIGGA for 200 docs!"

---

## Supported File Types

### Allowed Extensions

| Category | Extensions | Extraction Method |
|----------|------------|-------------------|
| **Text** | `.txt`, `.md`, `.markdown` | Direct read |
| **Documents** | `.pdf` | PDF.js / UnPDF with OCR fallback |
| **Spreadsheets** | `.xlsx`, `.xls`, `.csv`, `.ods` | SheetJS (xlsx) |
| **Data** | `.json`, `.xml`, `.yaml`, `.yml` | Native parsing |
| **Code** | `.js`, `.ts`, `.py`, `.java`, `.cpp`, `.c`, `.h`, `.cs`, `.go`, `.rs`, `.rb`, `.php`, `.swift`, `.kt` | Direct read |
| **Web** | `.html`, `.htm`, `.css` | DOM parsing / text extraction |
| **Rich Text** | `.rtf` | RTF parser |
| **Apple** | `.pages`, `.numbers`, `.keynote` | Zip extraction + XML parsing |
| **Office** | `.docx`, `.pptx` | Zip extraction + XML parsing |

### Blocked Extensions (Executables & Binaries)

```typescript
const BLOCKED_EXTENSIONS = [
  // Executables
  '.exe', '.dll', '.so', '.dylib', '.bin', '.app', '.dmg', '.msi', '.deb', '.rpm',
  // Scripts (potentially dangerous)
  '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.wsf',
  // Archives (except for document extraction)
  '.zip', '.tar', '.gz', '.7z', '.rar',
  // Media (not text-extractable)
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.ogg',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico',
  // Database files
  '.db', '.sqlite', '.mdb',
  // Compiled/Binary
  '.class', '.pyc', '.o', '.obj', '.wasm',
];
```

---

## Document Extraction Pipeline

### 1. PDF Extraction

```typescript
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

async function extractPdfText(file: File): Promise<string> {
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += `\n--- Page ${i} ---\n${pageText}`;
  }
  
  return fullText;
}
```

### 2. Excel/Spreadsheet Extraction

```typescript
import * as XLSX from 'xlsx';

async function extractSpreadsheetText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  let fullText = '';
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    fullText += `\n--- Sheet: ${sheetName} ---\n`;
    fullText += json.map((row: any[]) => row.join('\t')).join('\n');
  }
  
  return fullText;
}
```

### 3. Office Document Extraction (DOCX, PPTX)

```typescript
import JSZip from 'jszip';

async function extractDocxText(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const docXml = await zip.file('word/document.xml')?.async('string');
  
  if (!docXml) throw new Error('Invalid DOCX file');
  
  // Parse XML and extract text nodes
  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, 'application/xml');
  const textNodes = doc.getElementsByTagName('w:t');
  
  return Array.from(textNodes)
    .map(node => node.textContent)
    .join(' ');
}
```

### 4. Apple iWork Extraction (Pages, Numbers, Keynote)

```typescript
async function extractAppleDocText(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  
  // Apple iWork files are ZIP archives with XML content
  const indexXml = await zip.file('index.xml')?.async('string');
  if (!indexXml) {
    // Try newer format
    const documentXml = await zip.file('Index/Document.iwa')?.async('string');
    // Parse protobuf format (more complex)
    return parseIwaFormat(documentXml);
  }
  
  // Parse older XML format
  return extractTextFromXml(indexXml);
}
```

---

## LLM Context Management

### Token Budget Allocation

```typescript
const TOKEN_BUDGETS = {
  // FREE: OpenRouter (smaller context), 1 session doc
  FREE:  { systemPrompt: 500,  state: 1000, sessionDoc: 2000, rag: 0,    volatile: 4000, response: 4000 },
  // JIVE: Cerebras Qwen 32B, 10 session docs + 1 RAG doc
  JIVE:  { systemPrompt: 1000, state: 2000, sessionDoc: 4000, rag: 3000, volatile: 6000, response: 5000 },
  // JIGGA: Cerebras Qwen 32B, 10 session docs + 200 RAG docs
  JIGGA: { systemPrompt: 1500, state: 3000, sessionDoc: 4000, rag: 6000, volatile: 8000, response: 8000 },
};

// Total context window: 131k tokens (Qwen) / ~16k (OpenRouter FREE)
// Priority (never violate): System Prompt > State > Session Docs > Volatile > RAG > Response
```

### Context Assembly Order

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SYSTEM PROMPT (fixed, never evicted)                        │
│    - Persona, instructions, tool definitions                   │
│    - 500-1500 tokens                                           │
├─────────────────────────────────────────────────────────────────┤
│ 2. AUTHORITATIVE STATE (never evicted)                         │
│    - User facts, preferences, BuddySystem memories             │
│    - 1000-3000 tokens                                          │
├─────────────────────────────────────────────────────────────────┤
│ 3. 📎 SESSION DOCUMENTS (paperclip uploads, full text)         │
│    - Current chat's attached documents                         │
│    - FREE: 2000 tokens, JIVE/JIGGA: 4000 tokens                │
├─────────────────────────────────────────────────────────────────┤
│ 4. VOLATILE MEMORY (conversation history, evict oldest first)  │
│    - Recent chat turns                                         │
│    - 4000-8000 tokens                                          │
├─────────────────────────────────────────────────────────────────┤
│ 5. 📚 RAG CONTEXT (JIVE/JIGGA, evict lowest-scored first)      │
│    - Retrieved document chunks via semantic search             │
│    - FREE: 0, JIVE: 3000, JIGGA: 6000 tokens                   │
├─────────────────────────────────────────────────────────────────┤
│ 6. RESPONSE BUDGET (reserved for model output)                 │
│    - 4000-8000 tokens                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## RAG Modes (JIGGA Only)

### Analysis Mode (Default)

- RAG context is used to **augment** model knowledge
- Model can combine RAG content with training data
- Suitable for: research, exploration, general questions

```
[DOCUMENT CONTEXT]
The following excerpts are from your uploaded documents. Use them to inform your response,
but you may also draw on your general knowledge where appropriate.

---
Source: report-2024.pdf (page 3)
"The quarterly revenue increased by 15% compared to Q3..."
---
[END DOCUMENT CONTEXT]
```

### Authoritative Mode (Toggle)

- Model MUST cite only from RAG documents
- No external knowledge allowed
- Suitable for: legal, compliance, audits, fact-checking

```
[AUTHORITATIVE DOCUMENT CONTEXT]
IMPORTANT: You MUST base your response ONLY on the following documents.
Do NOT use any external knowledge. If the answer is not in the documents, say so.
Always cite the source document and page number.

---
Source: contract-v2.pdf (page 7)
"The liability cap is set at $500,000 for direct damages..."
---
[END AUTHORITATIVE DOCUMENT CONTEXT]
```

---

## Prompt Templates

### System Prompt (Base)

```typescript
const SYSTEM_PROMPT_BASE = `You are Gogga, a South African AI assistant.

## Core Behaviors
- Be helpful, friendly, and culturally aware
- Use South African context where appropriate (Rand, load shedding, local references)
- Switch languages seamlessly (11 official languages supported)
- Never announce language switches

## Response Guidelines
- Be concise unless detail is requested
- Use markdown formatting for structure
- Cite sources when using RAG context
`;
```

### RAG Injection Template

```typescript
const RAG_TEMPLATE = {
  analysis: `
[DOCUMENT CONTEXT]
The following excerpts are from the user's uploaded documents. Use them to inform your response.

{chunks}
[END DOCUMENT CONTEXT]
`,
  
  authoritative: `
[AUTHORITATIVE DOCUMENT CONTEXT]
CRITICAL: Base your response ONLY on these documents. No external knowledge.
Always cite: "Source: {filename} (page {page})"

{chunks}
[END AUTHORITATIVE DOCUMENT CONTEXT]

If the answer is not in the documents, respond:
"I could not find information about that in your documents. The documents contain: {summary}"
`,
};
```

### Chunk Format

```typescript
interface RAGChunk {
  content: string;
  source: {
    filename: string;
    page?: number;
    section?: string;
  };
  score: number;  // Similarity score (0-1)
  tokens: number; // Estimated token count
}

function formatChunk(chunk: RAGChunk): string {
  const pageInfo = chunk.source.page ? ` (page ${chunk.source.page})` : '';
  return `---
Source: ${chunk.source.filename}${pageInfo}
"${chunk.content}"
---`;
}
```

---

## Embedding Engine

### Model Configuration

```typescript
const EMBEDDING_CONFIG = {
  model: 'intfloat/e5-small-v2',  // Via Xenova/Transformers.js
  displayName: 'VCB-AI Micro',    // User-facing name
  dimensions: 384,
  backend: 'wasm',                // WebGPU disabled for stability
  pooling: 'mean',
  normalize: true,
};
```

### Distance-to-Samples Indexing (RxDB)

```typescript
// 5 sample vectors for spatial partitioning
// Each document embedding stores distance to each sample (idx0-idx4)
// Enables fast similarity search without full table scan

const SAMPLE_VECTORS = generateRandomVectors(5, 384);

async function storeEmbedding(docId: string, embedding: number[]): Promise<void> {
  const distances = SAMPLE_VECTORS.map(sample => 
    euclideanDistance(embedding, sample)
  );
  
  await db.vectorEmbeddings.insert({
    id: generateId(),
    documentId: docId,
    embedding,
    idx0: distanceToString(distances[0]),
    idx1: distanceToString(distances[1]),
    idx2: distanceToString(distances[2]),
    idx3: distanceToString(distances[3]),
    idx4: distanceToString(distances[4]),
    createdAt: new Date().toISOString(),
  });
}
```

---

## Web Worker Architecture (Non-Blocking Embeddings)

> **Critical UX Pattern:** Embedding generation blocks main thread. Use Web Worker with Singleton pattern.

### Embedding Worker (`embeddingWorker.ts`)

```typescript
// gogga-frontend/src/workers/embeddingWorker.ts
import { pipeline, env } from '@huggingface/transformers';

// Skip local model check for browser
env.allowLocalModels = false;

// Singleton pattern for lazy pipeline initialization
class EmbeddingSingleton {
  static task = 'feature-extraction' as const;
  static model = 'intfloat/e5-small-v2';
  static instance: any = null;

  static async getInstance(progressCallback?: (progress: any) => void) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, {
        progress_callback: progressCallback,
        dtype: 'fp32',  // or 'q8' for quantized (smaller, faster)
      });
    }
    return this.instance;
  }
}

// Listen for messages from main thread
self.addEventListener('message', async (event) => {
  const { type, data, id } = event.data;

  if (type === 'embed') {
    try {
      // Get or create embedding pipeline
      const embedder = await EmbeddingSingleton.getInstance((progress) => {
        self.postMessage({ type: 'progress', id, data: progress });
      });

      // Generate embedding
      const output = await embedder(data.text, {
        pooling: 'mean',
        normalize: true,
      });

      // Send result back
      self.postMessage({
        type: 'result',
        id,
        data: { embedding: Array.from(output.data) },
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        id,
        data: { message: (error as Error).message },
      });
    }
  }
});
```

### Worker Hook (`useEmbeddingWorker.ts`)

```typescript
// gogga-frontend/src/hooks/useEmbeddingWorker.ts
import { useRef, useEffect, useCallback, useState } from 'react';

interface EmbeddingResult {
  embedding: number[];
}

export function useEmbeddingWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const pendingRequests = useRef<Map<string, (result: EmbeddingResult) => void>>(new Map());

  useEffect(() => {
    // Create worker on mount
    workerRef.current = new Worker(
      new URL('../workers/embeddingWorker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.addEventListener('message', (event) => {
      const { type, id, data } = event.data;

      switch (type) {
        case 'progress':
          if (data.status === 'progress') {
            setLoadingProgress(Math.round(data.progress));
          } else if (data.status === 'done') {
            setIsReady(true);
          }
          break;
        case 'result':
          pendingRequests.current.get(id)?.(data);
          pendingRequests.current.delete(id);
          break;
        case 'error':
          console.error('Embedding error:', data.message);
          pendingRequests.current.delete(id);
          break;
      }
    });

    return () => workerRef.current?.terminate();
  }, []);

  const embed = useCallback(async (text: string): Promise<number[]> => {
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      pendingRequests.current.set(id, (result) => resolve(result.embedding));
      workerRef.current?.postMessage({ type: 'embed', id, data: { text } });
    });
  }, []);

  return { embed, isReady, loadingProgress };
}
```

---

## React 19 / Next.js 16 Patterns

### Optimistic UI for Document Upload

```tsx
// gogga-frontend/src/components/rag/DocumentUploader.tsx
'use client';

import { useOptimistic, useActionState, startTransition } from 'react';
import { uploadDocument } from '@/app/actions/rag';

interface Document {
  id: string;
  filename: string;
  status: 'uploading' | 'indexing' | 'ready' | 'error';
  progress?: number;
}

export function DocumentUploader({ documents }: { documents: Document[] }) {
  // Optimistic state - shows immediately before server confirms
  const [optimisticDocs, addOptimisticDoc] = useOptimistic<Document[], File>(
    documents,
    (state, file) => [
      ...state,
      {
        id: `temp-${Date.now()}`,
        filename: file.name,
        status: 'uploading' as const,
        progress: 0,
      },
    ]
  );

  // Action state for pending/error handling
  const [state, formAction, isPending] = useActionState(uploadDocument, null);

  const handleUpload = async (file: File) => {
    startTransition(() => {
      addOptimisticDoc(file);
    });
    
    const formData = new FormData();
    formData.append('file', file);
    await formAction(formData);
  };

  return (
    <div className="space-y-2">
      {optimisticDocs.map((doc) => (
        <DocumentRow 
          key={doc.id} 
          doc={doc} 
          isOptimistic={doc.id.startsWith('temp-')}
        />
      ))}
    </div>
  );
}
```

### Streaming Suspense for RAG Search

```tsx
// gogga-frontend/src/components/rag/RAGSearchResults.tsx
import { Suspense } from 'react';

// Skeleton component for loading state
function RAGResultsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 border rounded-lg">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-full mb-1" />
          <div className="h-3 bg-gray-100 rounded w-4/5" />
        </div>
      ))}
    </div>
  );
}

// Page with Suspense boundary
export function RAGSearchPage({ query }: { query: string }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Search Results</h2>
      <Suspense fallback={<RAGResultsSkeleton count={5} />}>
        <RAGSearchResults query={query} />
      </Suspense>
    </section>
  );
}

// Async component that fetches data
async function RAGSearchResults({ query }: { query: string }) {
  const results = await searchRAGDocuments(query);
  
  if (results.length === 0) {
    return <EmptyState query={query} />;
  }
  
  return (
    <div className="space-y-3">
      {results.map((result) => (
        <RAGResultCard key={result.id} result={result} />
      ))}
    </div>
  );
}
```

---

## Clear All RAG Documents (JIGGA Only)

### RxDB Bulk Delete with Cleanup Plugin

```typescript
// gogga-frontend/src/lib/rag/clearAllRAG.ts
import { db } from '@/lib/db';
import { addRxPlugin } from 'rxdb';
import { RxDBCleanupPlugin } from 'rxdb/plugins/cleanup';

// Add cleanup plugin (do this once at app init)
addRxPlugin(RxDBCleanupPlugin);

/**
 * Clear all RAG documents and embeddings for the current user.
 * Uses RxDB best practices:
 * 1. RxQuery.remove() to mark documents as deleted
 * 2. cleanup(0) to immediately purge from storage
 */
export async function clearAllRAGDocuments(userId: string): Promise<{ 
  deletedDocs: number; 
  deletedEmbeddings: number;
}> {
  // Step 1: Get count before deletion (for return value)
  const ragDocs = await db.documents.find({
    selector: { userId, isRAGDocument: true }
  }).exec();
  const docIds = ragDocs.map(d => d.id);
  const docCount = ragDocs.length;

  // Step 2: Delete all RAG documents
  await db.documents.find({
    selector: { userId, isRAGDocument: true }
  }).remove();

  // Step 3: Delete associated embeddings
  const embeddingCount = await db.vectorEmbeddings.find({
    selector: { documentId: { $in: docIds } }
  }).exec().then(e => e.length);
  
  await db.vectorEmbeddings.find({
    selector: { documentId: { $in: docIds } }
  }).remove();

  // Step 4: CRITICAL - Immediately purge from IndexedDB storage
  // The 0 means purge all deleted docs regardless of when they were deleted
  await db.documents.cleanup(0);
  await db.vectorEmbeddings.cleanup(0);

  return { deletedDocs: docCount, deletedEmbeddings: embeddingCount };
}

/**
 * RxDB post-remove hook for cascading embedding deletion.
 * Register this once at database initialization.
 */
export function registerRAGCleanupHooks(): void {
  db.documents.postRemove(async (doc) => {
    if (doc.isRAGDocument) {
      await db.vectorEmbeddings.find({
        selector: { documentId: doc.id }
      }).remove();
    }
  }, false); // false = don't run in parallel
}

/**
 * Background cleanup using requestIdlePromise.
 * Purges documents deleted more than 24 hours ago.
 */
export async function scheduleIdleCleanup(): Promise<void> {
  await db.requestIdlePromise();
  const oneDayMs = 24 * 60 * 60 * 1000;
  await db.documents.cleanup(oneDayMs);
  await db.vectorEmbeddings.cleanup(oneDayMs);
}
```

### Clear All RAG Button Component

```tsx
// gogga-frontend/src/components/rag/ClearAllRAGButton.tsx
'use client';

import { useState, useTransition } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { clearAllRAGDocuments } from '@/lib/rag/clearAllRAG';
import { toast } from 'sonner';

interface ClearAllRAGButtonProps {
  userId: string;
  documentCount: number;
  onCleared: () => void;
}

export function ClearAllRAGButton({ userId, documentCount, onCleared }: ClearAllRAGButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleClear = () => {
    startTransition(async () => {
      try {
        const result = await clearAllRAGDocuments(userId);
        toast.success(
          `Cleared ${result.deletedDocs} documents and ${result.deletedEmbeddings} embeddings`
        );
        onCleared();
      } catch (error) {
        toast.error('Failed to clear RAG documents');
      } finally {
        setShowConfirm(false);
      }
    });
  };

  if (documentCount === 0) return null;

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        disabled={isPending}
      >
        <Trash2 size={16} />
        Clear All RAG ({documentCount})
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-semibold">Clear All RAG Documents?</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              This will permanently delete <strong>{documentCount}</strong> documents 
              and all their embeddings. This cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                disabled={isPending}
              >
                {isPending ? (
                  <><Loader2 className="animate-spin" size={16} /> Clearing...</>
                ) : (
                  <><Trash2 size={16} /> Clear All</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## RxDB Schema (Documents)

```typescript
const documentSchema: RxJsonSchema<DocumentDoc> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    userId: { type: 'string' },
    filename: { type: 'string' },
    mimeType: { type: 'string' },
    size: { type: 'number' },  // bytes
    content: { type: 'string' },
    chunkCount: { type: 'number' },
    
    // Session scoping
    originSessionId: { type: 'string' },
    activeSessions: { type: 'array', items: { type: 'string' } },
    
    // RAG metadata
    isRAGDocument: { type: 'boolean' },  // true = RAG store, false = session doc
    isActive: { type: 'boolean' },
    isBlocked: { type: 'boolean' },
    
    // Tracking
    accessCount: { type: 'number' },
    lastAccessedAt: { type: 'string' },
    createdAt: { type: 'string' },
  },
  required: ['id', 'userId', 'filename', 'size', 'createdAt'],
  indexes: ['userId', 'originSessionId', 'isRAGDocument'],
};
```

---

## User Interface Components

### RAG Toggle (JIGGA)

```tsx
interface RAGControlsProps {
  ragEnabled: boolean;
  ragMode: 'analysis' | 'authoritative';
  onToggleRAG: (enabled: boolean) => void;
  onModeChange: (mode: 'analysis' | 'authoritative') => void;
}

function RAGControls({ ragEnabled, ragMode, onToggleRAG, onModeChange }: RAGControlsProps) {
  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
      {/* RAG Toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={ragEnabled}
          onChange={(e) => onToggleRAG(e.target.checked)}
          className="toggle toggle-primary"
        />
        <span className="text-sm font-medium">RAG</span>
      </label>
      
      {/* Mode Selector (only when RAG enabled) */}
      {ragEnabled && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onModeChange('analysis')}
            className={`px-3 py-1 rounded text-sm ${
              ragMode === 'analysis' 
                ? 'bg-gray-800 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Analysis
          </button>
          <button
            onClick={() => onModeChange('authoritative')}
            className={`px-3 py-1 rounded text-sm ${
              ragMode === 'authoritative' 
                ? 'bg-amber-600 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            <Shield size={14} className="inline mr-1" />
            Authoritative
          </button>
        </div>
      )}
    </div>
  );
}
```

### JIVE Upgrade Enticement

```tsx
function RAGUpgradePromo() {
  const router = useRouter();
  
  return (
    <div className="text-center py-8 px-4">
      <div className="relative inline-block mb-4">
        <FileText size={48} className="text-gray-300" />
        <Lock size={20} className="absolute -bottom-1 -right-1 text-amber-500" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Unlock RAG Document Store
      </h3>
      
      <ul className="text-sm text-gray-600 mb-4 text-left max-w-xs mx-auto">
        <li className="flex items-center gap-2 py-1">
          <Sparkles size={16} className="text-amber-500" />
          Upload up to 200 documents
        </li>
        <li className="flex items-center gap-2 py-1">
          <Search size={16} className="text-amber-500" />
          Semantic search across your files
        </li>
        <li className="flex items-center gap-2 py-1">
          <Shield size={16} className="text-amber-500" />
          Authoritative mode for compliance
        </li>
        <li className="flex items-center gap-2 py-1">
          <Database size={16} className="text-amber-500" />
          Cross-session document access
        </li>
      </ul>
      
      <button
        onClick={() => router.push('/upgrade')}
        className="px-6 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-full font-medium hover:from-amber-600 hover:to-amber-700 transition-all"
      >
        Upgrade to JIGGA
      </button>
      
      <p className="text-xs text-gray-400 mt-2">R299/month</p>
    </div>
  );
}
```

---

## File Processing Utilities

### File Validation

```typescript
const FILE_LIMITS = {
  RAG: {
    maxFileSize: 25 * 1024 * 1024,       // 25 MB
    maxTotalStorage: 250 * 1024 * 1024,  // 250 MB
    maxDocuments: 200,
  },
  SESSION: {
    maxFileSize: 10 * 1024 * 1024,       // 10 MB
    maxTotalStorage: 50 * 1024 * 1024,   // 50 MB
    maxDocuments: 10,
  },
};

function validateFileUpload(
  file: File,
  mode: 'rag' | 'session',
  currentUsage: { count: number; bytes: number }
): { valid: boolean; error?: string } {
  const limits = mode === 'rag' ? FILE_LIMITS.RAG : FILE_LIMITS.SESSION;
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  
  // Check blocked extensions
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `File type ${ext} is not supported` };
  }
  
  // Check file size
  if (file.size > limits.maxFileSize) {
    const maxMB = limits.maxFileSize / (1024 * 1024);
    return { valid: false, error: `File exceeds ${maxMB}MB limit` };
  }
  
  // Check total storage
  if (currentUsage.bytes + file.size > limits.maxTotalStorage) {
    return { valid: false, error: 'Storage limit exceeded. Delete some documents first.' };
  }
  
  // Check document count
  if (currentUsage.count >= limits.maxDocuments) {
    return { valid: false, error: `Maximum ${limits.maxDocuments} documents reached` };
  }
  
  return { valid: true };
}
```

### MIME Type Detection

```typescript
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  // Text
  'text/plain': ['.txt'],
  'text/markdown': ['.md', '.markdown'],
  'text/csv': ['.csv'],
  'text/html': ['.html', '.htm'],
  'text/css': ['.css'],
  
  // Documents
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
  'application/rtf': ['.rtf'],
  
  // Data
  'application/json': ['.json'],
  'application/xml': ['.xml'],
  'text/xml': ['.xml'],
  'application/x-yaml': ['.yaml', '.yml'],
  
  // Apple iWork
  'application/x-iwork-pages-sffpages': ['.pages'],
  'application/x-iwork-numbers-sffnumbers': ['.numbers'],
  'application/x-iwork-keynote-sffkey': ['.keynote'],
  
  // Code (text/plain fallback)
  'text/javascript': ['.js'],
  'text/typescript': ['.ts'],
  'text/x-python': ['.py'],
};
```

---

## User Experience Enhancements

### Drag & Drop Upload Zone

```tsx
// gogga-frontend/src/components/rag/DropZone.tsx
'use client';

import { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  onFilesAccepted: (files: File[]) => void;
  maxFiles?: number;
  accept?: string[];
  disabled?: boolean;
}

export function DropZone({ onFilesAccepted, maxFiles = 10, accept, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setDragError(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > maxFiles) {
      setDragError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    onFilesAccepted(files);
  }, [maxFiles, onFilesAccepted]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
        isDragging && 'border-primary-500 bg-primary-50 scale-[1.02]',
        !isDragging && 'border-gray-300 hover:border-gray-400',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Animated upload icon */}
      <div className={cn(
        'mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all',
        isDragging ? 'bg-primary-100 scale-110' : 'bg-gray-100'
      )}>
        <Upload className={cn(
          'transition-all',
          isDragging ? 'text-primary-600 scale-125' : 'text-gray-400'
        )} size={28} />
      </div>

      <p className="text-lg font-medium text-gray-700 mb-1">
        {isDragging ? 'Drop files here' : 'Drag & drop files'}
      </p>
      <p className="text-sm text-gray-500">
        or <button className="text-primary-600 hover:underline">browse</button> to upload
      </p>

      {dragError && (
        <p className="mt-2 text-sm text-red-600 flex items-center justify-center gap-1">
          <X size={14} /> {dragError}
        </p>
      )}
    </div>
  );
}
```

### Model Loading Progress Indicator

```tsx
// gogga-frontend/src/components/rag/ModelLoadingProgress.tsx
'use client';

import { Cpu, Loader2, Check } from 'lucide-react';

interface ModelLoadingProgressProps {
  isLoading: boolean;
  progress: number;  // 0-100
  modelName?: string;
}

export function ModelLoadingProgress({ 
  isLoading, 
  progress, 
  modelName = 'VCB-AI Micro' 
}: ModelLoadingProgressProps) {
  if (!isLoading && progress === 100) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check size={16} />
        <span>{modelName} ready</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {isLoading ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Cpu size={16} />
        )}
        <span>Loading {modelName}...</span>
        <span className="text-gray-400">{progress}%</span>
      </div>
      
      {/* Animated progress bar */}
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
```

### RAG Activity Indicator (Pulse Animation)

```tsx
// gogga-frontend/src/components/rag/RAGActivityIndicator.tsx
'use client';

import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RAGActivityIndicatorProps {
  isSearching: boolean;
  resultCount?: number;
}

export function RAGActivityIndicator({ isSearching, resultCount }: RAGActivityIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Database 
          size={18} 
          className={cn(
            'transition-colors',
            isSearching ? 'text-primary-600' : 'text-gray-400'
          )} 
        />
        
        {/* Pulse animation when searching */}
        {isSearching && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
          </span>
        )}
      </div>
      
      {resultCount !== undefined && (
        <span className="text-xs text-gray-500">
          {isSearching ? 'Searching...' : `${resultCount} matches`}
        </span>
      )}
    </div>
  );
}
```

### Chunk Visualization (Which Chunks Were Used)

```tsx
// gogga-frontend/src/components/rag/ChunkVisualization.tsx
'use client';

import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface UsedChunk {
  id: string;
  source: string;
  page?: number;
  content: string;
  score: number;  // 0-1 similarity score
}

interface ChunkVisualizationProps {
  chunks: UsedChunk[];
  title?: string;
}

export function ChunkVisualization({ chunks, title = 'Sources Used' }: ChunkVisualizationProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (chunks.length === 0) return null;

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText size={16} />
          {title} ({chunks.length})
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="divide-y">
          {chunks.map((chunk) => (
            <div key={chunk.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-800">
                  {chunk.source}
                  {chunk.page && <span className="text-gray-500"> (p. {chunk.page})</span>}
                </span>
                
                {/* Confidence badge */}
                <ConfidenceBadge score={chunk.score} />
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{chunk.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Confidence badge component
function ConfidenceBadge({ score }: { score: number }) {
  const level = score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';
  const colors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  };
  const labels = { high: 'High', medium: 'Medium', low: 'Low' };

  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-medium',
      colors[level]
    )}>
      {labels[level]} ({Math.round(score * 100)}%)
    </span>
  );
}
```

### Storage Usage Meter (Animated)

```tsx
// gogga-frontend/src/components/rag/StorageMeter.tsx
'use client';

import { Database, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StorageMeterProps {
  usedDocs: number;
  maxDocs: number;
  usedMB: number;
  maxMB: number;
}

export function StorageMeter({ usedDocs, maxDocs, usedMB, maxMB }: StorageMeterProps) {
  const docPercent = (usedDocs / maxDocs) * 100;
  const storagePercent = (usedMB / maxMB) * 100;
  const isNearLimit = docPercent > 80 || storagePercent > 80;

  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-3">
      {/* Documents */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="flex items-center gap-1.5 text-gray-600">
            <Database size={14} />
            Documents
          </span>
          <span className={cn('font-medium', isNearLimit && 'text-amber-600')}>
            {usedDocs} / {maxDocs}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              docPercent > 90 ? 'bg-red-500' :
              docPercent > 70 ? 'bg-amber-500' : 'bg-primary-500'
            )}
            style={{ width: `${docPercent}%` }}
          />
        </div>
      </div>

      {/* Storage */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="flex items-center gap-1.5 text-gray-600">
            <HardDrive size={14} />
            Storage
          </span>
          <span className={cn('font-medium', isNearLimit && 'text-amber-600')}>
            {usedMB.toFixed(1)} / {maxMB} MB
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              storagePercent > 90 ? 'bg-red-500' :
              storagePercent > 70 ? 'bg-amber-500' : 'bg-primary-500'
            )}
            style={{ width: `${storagePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Keyboard Shortcuts

### RAG-Specific Hotkeys

| Shortcut | Action | Tier |
|----------|--------|------|
| `Ctrl+Shift+D` | Toggle RAG on/off | JIVE/JIGGA |
| `Ctrl+Shift+A` | Switch to Authoritative mode | JIGGA |
| `Ctrl+Shift+N` | Switch to Analysis mode | JIGGA |
| `Ctrl+Shift+U` | Open upload dialog | JIVE/JIGGA |
| `Ctrl+Shift+R` | Clear all RAG (with confirmation) | JIGGA |
| `Ctrl+Shift+S` | Open RAG search | JIVE/JIGGA |
| `Escape` | Close RAG panel/modal | All |

### Keyboard Handler Hook

```tsx
// gogga-frontend/src/hooks/useRAGKeyboardShortcuts.ts
import { useEffect, useCallback } from 'react';
import { useRAGStore } from '@/stores/ragStore';
import { useTierConfig } from '@/hooks/useTierConfig';

export function useRAGKeyboardShortcuts() {
  const { toggleRAG, setMode, openUploadDialog, openSearch, requestClearAll } = useRAGStore();
  const { tier, config } = useTierConfig();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only process if Ctrl+Shift is held
    if (!e.ctrlKey || !e.shiftKey) return;

    switch (e.key.toUpperCase()) {
      case 'D': // Toggle RAG
        if (config.ragEnabled) {
          e.preventDefault();
          toggleRAG();
        }
        break;

      case 'A': // Authoritative mode (JIGGA only)
        if (tier === 'jigga') {
          e.preventDefault();
          setMode('authoritative');
        }
        break;

      case 'N': // Analysis mode
        if (config.ragEnabled) {
          e.preventDefault();
          setMode('analysis');
        }
        break;

      case 'U': // Upload dialog
        if (config.ragEnabled) {
          e.preventDefault();
          openUploadDialog();
        }
        break;

      case 'R': // Clear all (JIGGA only)
        if (tier === 'jigga') {
          e.preventDefault();
          requestClearAll();
        }
        break;

      case 'S': // Search
        if (config.ragEnabled) {
          e.preventDefault();
          openSearch();
        }
        break;
    }
  }, [tier, config, toggleRAG, setMode, openUploadDialog, openSearch, requestClearAll]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

---

## Toast Notifications

```tsx
// gogga-frontend/src/lib/rag/notifications.ts
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';

export function showDocumentIndexed(filename: string, onUndo?: () => void) {
  toast.success(
    <div className="flex items-center justify-between gap-4">
      <span>📄 <strong>{filename}</strong> indexed successfully!</span>
      {onUndo && (
        <button
          onClick={() => {
            onUndo();
            toast.dismiss();
          }}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <Undo2 size={12} /> Undo
        </button>
      )}
    </div>,
    { duration: 5000 }
  );
}

export function showRAGSearchComplete(count: number, latencyMs: number) {
  toast.info(`Found ${count} matches in ${latencyMs}ms`, { duration: 2000 });
}

export function showEmbeddingModelLoaded() {
  toast.success('🧠 Embedding model loaded - semantic search ready!', { duration: 3000 });
}

export function showStorageWarning(percentUsed: number) {
  toast.warning(
    `⚠️ RAG storage ${percentUsed}% full. Consider deleting old documents.`,
    { duration: 5000 }
  );
}
```

---

## Error Handling

### Error Types

```typescript
enum RAGErrorCode {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  STORAGE_EXCEEDED = 'STORAGE_EXCEEDED',
  DOCUMENT_LIMIT = 'DOCUMENT_LIMIT',
  UNSUPPORTED_TYPE = 'UNSUPPORTED_TYPE',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  SEARCH_FAILED = 'SEARCH_FAILED',
}

class RAGError extends Error {
  constructor(
    public code: RAGErrorCode,
    message: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'RAGError';
  }
}
```

---

## Performance Metrics

### Target Latencies

| Operation | Target | Max Acceptable |
|-----------|--------|----------------|
| File upload (10MB) | < 2s | 5s |
| Embedding generation (per chunk) | < 200ms | 500ms |
| Semantic search (10 results) | < 100ms | 300ms |
| Context assembly | < 50ms | 100ms |

### Storage Metrics (RxDB)

```typescript
interface RAGMetrics {
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
  storageSizeMB: number;
  averageChunksPerDoc: number;
  lastRetrievalLatencyMs: number;
  cacheHitRate: number;
}
```

---

## Implementation Checklist (Full TODO)

### Phase 1: Core Infrastructure ✅
- [x] RxDB schema for documents and embeddings
- [x] Distance-to-Samples vector indexing (idx0-idx4)
- [x] E5-small-v2 embedding engine integration
- [x] Basic RAG retrieval pipeline
- [x] Update tierConfig.ts (FREE session, JIVE limited, JIGGA full)

### Phase 2: Web Worker Architecture 🔄
- [ ] Create `embeddingWorker.ts` with Singleton pattern
- [ ] Implement `useEmbeddingWorker` hook
- [ ] Add progress callback for model download
- [ ] Model loading progress UI component
- [ ] Handle WASM backend fallback gracefully
- [ ] Worker termination on component unmount

### Phase 3: Document Extraction 🔄
- [ ] PDF extraction with PDF.js (+ OCR fallback)
- [ ] Excel/CSV extraction with SheetJS
- [ ] DOCX/PPTX extraction with JSZip
- [ ] Apple iWork extraction (.pages, .numbers, .keynote)
- [ ] RTF extraction
- [ ] Code file syntax preservation
- [ ] Blocked file extension filter
- [ ] MIME type validation
- [ ] Empty file detection
- [ ] Filename sanitization

### Phase 4: RAG Modes (JIVE/JIGGA) 🔄
- [ ] Analysis mode prompt template
- [ ] Authoritative mode prompt template (JIGGA only)
- [ ] RAG toggle UI component
- [ ] Mode switching logic with state persistence
- [ ] "Source not found" authoritative response

### Phase 5: Session Documents (Paperclip) 📎
- [ ] Session document upload (all tiers)
- [ ] FREE tier: 1 doc, 2MB limit
- [ ] JIVE/JIGGA tier: 10 docs, 50MB limit
- [ ] Session doc content injection (no embeddings)
- [ ] Session docs cleared on new session
- [ ] Paperclip button UI

### Phase 6: Clear All RAG (JIGGA) 🗑️
- [ ] `clearAllRAGDocuments()` function with RxDB cleanup
- [ ] Post-remove hook for cascading embedding deletion
- [ ] Clear All button with confirmation modal
- [ ] Background idle cleanup (`requestIdlePromise`)
- [ ] Bulk selection for multi-delete

### Phase 7: React 19 / Next.js 16 Patterns ⚛️
- [ ] `useOptimistic` for document upload feedback
- [ ] `useActionState` for pending/error states
- [ ] `Suspense` boundaries for RAG search results
- [ ] Skeleton loading components
- [ ] Streaming partial results
- [ ] Server Actions for file operations

### Phase 8: User Experience Enhancements 🎨
- [ ] Drag & drop upload zone
- [ ] Document preview modal
- [ ] Search filters (date, type, size)
- [ ] Storage usage meter (animated)
- [ ] Toast notifications with undo
- [ ] RAG activity indicator (pulse animation)
- [ ] Chunk visualization (sources used)
- [ ] Confidence badges (High/Medium/Low)
- [ ] Keyboard shortcuts implementation
- [ ] Export RAG docs as ZIP (JIGGA)

### Phase 9: Tier Integration & Enticement 💎
- [ ] FREE tier upgrade promo (after paperclip use)
- [ ] JIVE upgrade enticement UI (at 1/1 docs)
- [ ] JIGGA features showcase
- [ ] Storage limit enforcement with upgrade CTA
- [ ] Authoritative mode upgrade prompt (JIVE→JIGGA)
- [ ] Analytics upgrade prompt

### Phase 10: Analytics & Metrics (JIGGA) 📊
- [ ] RAG metrics dashboard component
- [ ] Document usage statistics
- [ ] Search latency tracking
- [ ] Cache hit rate monitoring
- [ ] Popular search terms
- [ ] Document access counts

### Phase 11: Performance Optimization 🚀
- [ ] Web Worker embedding (non-blocking main thread)
- [ ] IndexedDB storage quota monitoring
- [ ] Distance-to-Samples query optimization
- [ ] Chunk deduplication
- [ ] Embedding cache layer
- [ ] Lazy model loading (on first use)

### Phase 12: Error Handling & Recovery 🛡️
- [ ] RAGError class with error codes
- [ ] Graceful RxDB connection failure handling
- [ ] Embedding model load failure fallback
- [ ] WASM backend detection and warning
- [ ] IndexedDB quota exceeded handling
- [ ] PDF extraction failure with user message
- [ ] Retry logic for transient errors
- [ ] Corrupt RxDB state recovery

### Phase 13: Testing 🧪
- [ ] JIVE tier tests (37 tests)
- [ ] JIGGA tier tests (52 tests)
- [ ] Shared tests (21 tests)
- [ ] Performance benchmark tests
- [ ] E2E upload/search flow tests
- [ ] Web Worker integration tests

---

## Test Plan

### Overview

This test plan covers RAG functionality for both JIVE (limited) and JIGGA (full) tiers. Tests are organized by feature area and tier-specific behaviors.

**Test Files Location:** `gogga-frontend/src/lib/__tests__/rag/`

---

### 1. Document Upload Tests

#### 1.1 JIVE Tier - Limited RAG (8 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIVE-UP-01 | Upload 1 valid PDF (< 5MB) | ✅ Upload succeeds, document stored in RAG |
| JIVE-UP-02 | Upload 2nd document when 1 exists | ❌ Error: "Maximum 1 RAG document. Upgrade to JIGGA for 200 docs" |
| JIVE-UP-03 | Upload file > 5MB | ❌ Error: "File exceeds 5MB limit for JIVE tier" |
| JIVE-UP-04 | Upload blocked extension (.exe) | ❌ Error: "File type .exe is not supported" |
| JIVE-UP-05 | Upload after deleting existing doc | ✅ Upload succeeds (slot freed) |
| JIVE-UP-06 | Upload DOCX file | ✅ Text extracted via JSZip |
| JIVE-UP-07 | Upload XLSX file | ✅ Data extracted via SheetJS |
| JIVE-UP-08 | Upload .pages (Apple iWork) | ✅ Text extracted from ZIP/XML |

#### 1.2 JIGGA Tier - Full RAG (12 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIGGA-UP-01 | Upload 1 valid PDF (< 25MB) | ✅ Upload succeeds |
| JIGGA-UP-02 | Upload 200 documents | ✅ All uploads succeed |
| JIGGA-UP-03 | Upload 201st document | ❌ Error: "Maximum 200 documents reached" |
| JIGGA-UP-04 | Upload file > 25MB | ❌ Error: "File exceeds 25MB limit" |
| JIGGA-UP-05 | Upload when total storage > 250MB | ❌ Error: "Storage limit exceeded" |
| JIGGA-UP-06 | Upload blocked extension (.dll) | ❌ Error: "File type .dll is not supported" |
| JIGGA-UP-07 | Upload corrupt PDF | ❌ Error: "Failed to extract text from file" |
| JIGGA-UP-08 | Upload empty file (0 bytes) | ❌ Error: "File is empty" |
| JIGGA-UP-09 | Upload with special chars in name | ✅ Filename sanitized, upload succeeds |
| JIGGA-UP-10 | Upload duplicate filename | ✅ Appends suffix: "doc (2).pdf" |
| JIGGA-UP-11 | Upload .numbers (Apple iWork) | ✅ Spreadsheet data extracted |
| JIGGA-UP-12 | Upload .keynote (Apple iWork) | ✅ Slide text extracted |

---

### 2. Keyword Search Tests

#### 2.1 JIVE Tier (6 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIVE-KW-01 | Search exact word in document | ✅ Returns matching chunks with highlights |
| JIVE-KW-02 | Search partial word (prefix) | ✅ Matches words starting with query |
| JIVE-KW-03 | Search case-insensitive | ✅ "HELLO" matches "hello" |
| JIVE-KW-04 | Search word not in document | ✅ Returns empty results |
| JIVE-KW-05 | Search with special characters | ✅ Escapes regex, finds literal match |
| JIVE-KW-06 | Search in deleted document | ✅ Returns no results |

#### 2.2 JIGGA Tier (8 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIGGA-KW-01 | Search across 10 documents | ✅ Returns results from all matching docs |
| JIGGA-KW-02 | Search with pagination | ✅ Returns first 10 results, then next 10 |
| JIGGA-KW-03 | Search with document filter | ✅ Only searches specified document |
| JIGGA-KW-04 | Search returns source metadata | ✅ Includes filename, page number |
| JIGGA-KW-05 | Search performance (100 docs) | ✅ < 100ms response time |
| JIGGA-KW-06 | Search with boolean AND | ✅ "apple AND banana" matches both |
| JIGGA-KW-07 | Search with boolean OR | ✅ "apple OR banana" matches either |
| JIGGA-KW-08 | Search in authoritative mode | ✅ Same results, different prompt injection |

---

### 3. Semantic Search Tests

#### 3.1 JIVE Tier (6 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIVE-SEM-01 | Search semantically similar text | ✅ Returns related content not just keyword matches |
| JIVE-SEM-02 | Search synonym (car → vehicle) | ✅ Finds "vehicle" when searching "car" |
| JIVE-SEM-03 | Search concept (happy → positive emotions) | ✅ Finds "joyful", "excited" content |
| JIVE-SEM-04 | Search with low similarity threshold | ✅ Returns more results with lower scores |
| JIVE-SEM-05 | Search returns similarity scores | ✅ Each result has score 0-1 |
| JIVE-SEM-06 | Embedding generation < 500ms | ✅ Query embedding under latency target |

#### 3.2 JIGGA Tier (10 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIGGA-SEM-01 | Search across 50 documents | ✅ Returns top-K most similar |
| JIGGA-SEM-02 | Search with top-K = 5 | ✅ Returns exactly 5 results |
| JIGGA-SEM-03 | Search with top-K = 20 | ✅ Returns up to 20 results |
| JIGGA-SEM-04 | Search performance (100 docs) | ✅ < 300ms with Distance-to-Samples |
| JIGGA-SEM-05 | Search in different languages (Zulu) | ✅ E5 handles multilingual |
| JIGGA-SEM-06 | Search in authoritative mode | ✅ Retrieves but strict citation prompt |
| JIGGA-SEM-07 | Search with RAG disabled | ✅ Returns empty (respects toggle) |
| JIGGA-SEM-08 | Distance-to-Samples indexing | ✅ Uses idx0-idx4 for fast filtering |
| JIGGA-SEM-09 | Cosine similarity refinement | ✅ Candidates refined with exact cosine |
| JIGGA-SEM-10 | Cross-session document access | ✅ Finds docs from other sessions |

---

### 4. RAG Toggle & Mode Tests

#### 4.1 JIVE Tier (4 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIVE-TOG-01 | Toggle RAG on | ✅ Document context injected |
| JIVE-TOG-02 | Toggle RAG off | ✅ No document context in prompt |
| JIVE-TOG-03 | Attempt authoritative mode | ❌ Disabled: "Upgrade to JIGGA for authoritative mode" |
| JIVE-TOG-04 | RAG state persists across sessions | ✅ Remembers on/off preference |

#### 4.2 JIGGA Tier (8 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIGGA-TOG-01 | Toggle RAG on | ✅ Document context injected |
| JIGGA-TOG-02 | Toggle RAG off | ✅ No document context |
| JIGGA-TOG-03 | Switch to authoritative mode | ✅ Prompt changes to strict citation |
| JIGGA-TOG-04 | Switch to analysis mode | ✅ Prompt allows general knowledge |
| JIGGA-TOG-05 | Authoritative with no matching docs | ✅ "I could not find that in your documents" |
| JIGGA-TOG-06 | Mode state persists | ✅ Remembers analysis/authoritative |
| JIGGA-TOG-07 | RAG toggle visible in UI | ✅ Shows in RightSidePanel |
| JIGGA-TOG-08 | Mode switch during conversation | ✅ Next message uses new mode |

---

### 5. Context Injection Tests

#### 5.1 JIVE Tier (4 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIVE-CTX-01 | Context includes source citation | ✅ "Source: filename.pdf (page X)" |
| JIVE-CTX-02 | Context respects token budget | ✅ Max 3000 tokens injected |
| JIVE-CTX-03 | Multiple chunks from same doc | ✅ Grouped by source |
| JIVE-CTX-04 | Context in analysis mode format | ✅ Uses analysis prompt template |

#### 5.2 JIGGA Tier (6 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIGGA-CTX-01 | Context from multiple documents | ✅ Mixed sources in context |
| JIGGA-CTX-02 | Context respects 6000 token budget | ✅ Evicts lowest-scored chunks |
| JIGGA-CTX-03 | Authoritative mode template | ✅ "MUST base response ONLY on documents" |
| JIGGA-CTX-04 | Analysis mode template | ✅ "May also draw on general knowledge" |
| JIGGA-CTX-05 | Context assembly < 50ms | ✅ Under latency target |
| JIGGA-CTX-06 | Chunks sorted by relevance | ✅ Highest scored first |

---

### 6. Document Management Tests

#### 6.1 JIVE Tier (4 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIVE-DOC-01 | Delete RAG document | ✅ Document and chunks removed |
| JIVE-DOC-02 | View document list | ✅ Shows 1 document with metadata |
| JIVE-DOC-03 | Document storage meter | ✅ Shows "1/1 docs, X/5 MB used" |
| JIVE-DOC-04 | Upgrade prompt when at limit | ✅ "Upgrade to JIGGA for 200 docs" |

#### 6.2 JIGGA Tier (8 tests)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIGGA-DOC-01 | Delete single document | ✅ Document and embeddings removed |
| JIGGA-DOC-02 | Bulk delete documents | ✅ Multiple docs removed |
| JIGGA-DOC-03 | View document list (pagination) | ✅ 20 per page, paginated |
| JIGGA-DOC-04 | Document storage meter | ✅ Shows "X/200 docs, X/250 MB" |
| JIGGA-DOC-05 | Pull doc from another session | ✅ activeSessions updated |
| JIGGA-DOC-06 | Remove doc from current session | ✅ Removed from activeSessions |
| JIGGA-DOC-07 | Document access count tracking | ✅ accessCount incremented |
| JIGGA-DOC-08 | Last accessed timestamp | ✅ lastAccessedAt updated |

---

### 7. Session Document Tests (Both Tiers)

| ID | Test Case | Tier | Expected Result |
|----|-----------|------|-----------------|
| SESS-01 | Upload 10 session docs | JIVE/JIGGA | ✅ All succeed |
| SESS-02 | Upload 11th session doc | JIVE/JIGGA | ❌ Error: "Max 10 per session" |
| SESS-03 | Session docs not in RAG search | JIVE/JIGGA | ✅ Only RAG docs searched |
| SESS-04 | Session docs cleared on new session | JIVE/JIGGA | ✅ Not persisted |
| SESS-05 | Session doc > 10MB | JIVE/JIGGA | ❌ Error: "Exceeds 10MB limit" |
| SESS-06 | Session docs respect blocked exts | JIVE/JIGGA | ❌ Blocked extensions rejected |

---

### 8. Upgrade Enticement Tests (JIVE Only)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| JIVE-ENT-01 | Show upgrade prompt at 1/1 docs | ✅ Displays upgrade modal |
| JIVE-ENT-02 | Upgrade prompt shows JIGGA benefits | ✅ "200 docs, authoritative mode, analytics" |
| JIVE-ENT-03 | Upgrade CTA links to /upgrade | ✅ Navigates to upgrade page |
| JIVE-ENT-04 | Authoritative mode shows upgrade | ✅ "Upgrade to unlock" message |
| JIVE-ENT-05 | Analytics menu shows upgrade | ✅ "Upgrade for RAG analytics" |

---

### 9. Error Handling Tests

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| ERR-01 | RxDB connection failure | ✅ Graceful degradation, retry logic |
| ERR-02 | Embedding model load failure | ✅ Fallback to keyword search only |
| ERR-03 | WASM backend not supported | ✅ Warning, disable semantic search |
| ERR-04 | IndexedDB quota exceeded | ❌ Error: "Storage full. Delete documents." |
| ERR-05 | PDF extraction failure | ✅ Document marked as failed, error shown |
| ERR-06 | Network timeout during upload | ✅ Retry up to 3 times |
| ERR-07 | Corrupt RxDB state | ✅ Recovery migration runs |

---

### 10. Performance Tests

| ID | Test Case | Target | Tier |
|----|-----------|--------|------|
| PERF-01 | Upload 5MB file | < 2s | Both |
| PERF-02 | Embedding generation (1 chunk) | < 200ms | Both |
| PERF-03 | Keyword search (1 doc) | < 50ms | JIVE |
| PERF-04 | Keyword search (100 docs) | < 100ms | JIGGA |
| PERF-05 | Semantic search (1 doc) | < 100ms | JIVE |
| PERF-06 | Semantic search (100 docs) | < 300ms | JIGGA |
| PERF-07 | Context assembly | < 50ms | Both |
| PERF-08 | RAG toggle state change | < 10ms | Both |

---

### 11. Web Worker Tests

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| WORK-01 | Worker initializes singleton pipeline | ✅ Only one instance created |
| WORK-02 | Progress callback fires during model load | ✅ Progress events received |
| WORK-03 | Embedding request returns 384 dimensions | ✅ Correct vector size |
| WORK-04 | Multiple concurrent requests handled | ✅ All requests resolved |
| WORK-05 | Worker terminates on component unmount | ✅ No memory leaks |
| WORK-06 | Main thread not blocked during embedding | ✅ UI remains responsive |
| WORK-07 | Error handling for invalid input | ✅ Error message returned |
| WORK-08 | Worker reconnects after crash | ✅ New worker spawned |

---

### 12. Clear All RAG Tests (JIGGA Only)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| CLEAR-01 | Clear button shows document count | ✅ "Clear All RAG (50)" |
| CLEAR-02 | Confirmation modal appears on click | ✅ Warning dialog shown |
| CLEAR-03 | Cancel button dismisses modal | ✅ No deletion occurs |
| CLEAR-04 | Confirm clears all RAG documents | ✅ All docs removed |
| CLEAR-05 | Associated embeddings deleted | ✅ Vector index cleared |
| CLEAR-06 | Storage immediately reclaimed | ✅ cleanup(0) called |
| CLEAR-07 | Toast notification on success | ✅ "Cleared X docs" shown |
| CLEAR-08 | Document count resets to 0 | ✅ UI updates |
| CLEAR-09 | Keyboard shortcut (Ctrl+Shift+R) | ✅ Opens confirmation |
| CLEAR-10 | Post-remove hook cascades deletion | ✅ Embeddings auto-deleted |

---

### 13. Optimistic UI Tests

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| OPT-01 | Document appears immediately on upload | ✅ Status: "uploading" |
| OPT-02 | Progress bar shows during upload | ✅ 0% → 100% animation |
| OPT-03 | Status changes to "indexing" | ✅ After file received |
| OPT-04 | Status changes to "ready" on success | ✅ Final state |
| OPT-05 | Optimistic doc removed on error | ✅ Rollback occurs |
| OPT-06 | Error toast shown on failure | ✅ User notified |

---

### 14. Keyboard Shortcut Tests

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| KEY-01 | Ctrl+Shift+D toggles RAG | ✅ On → Off → On |
| KEY-02 | Ctrl+Shift+A sets authoritative (JIGGA) | ✅ Mode changes |
| KEY-03 | Ctrl+Shift+N sets analysis mode | ✅ Mode changes |
| KEY-04 | Ctrl+Shift+U opens upload dialog | ✅ Dialog appears |
| KEY-05 | Ctrl+Shift+R opens clear confirmation | ✅ Modal appears |
| KEY-06 | Ctrl+Shift+S opens search | ✅ Search panel opens |
| KEY-07 | Escape closes modal/panel | ✅ Dismissed |
| KEY-08 | Shortcuts disabled when modal open | ✅ No conflicts |

---

### 15. UX Enhancement Tests

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| UX-01 | Drag & drop zone highlights on drag | ✅ Visual feedback |
| UX-02 | Drop zone shows error for >max files | ✅ Error message |
| UX-03 | Storage meter animates on change | ✅ Smooth transition |
| UX-04 | Storage meter turns amber at 70% | ✅ Warning color |
| UX-05 | Storage meter turns red at 90% | ✅ Critical color |
| UX-06 | Chunk visualization expands/collapses | ✅ Toggle works |
| UX-07 | Confidence badges show correct level | ✅ High/Med/Low |
| UX-08 | Toast with undo reverts action | ✅ Document restored |
| UX-09 | RAG activity indicator pulses | ✅ Animation plays |
| UX-10 | Model loading progress shows % | ✅ 0-100 progress |

---

### Test Summary

| Tier | Category | Test Count |
|------|----------|------------|
| JIVE | Upload | 8 |
| JIVE | Keyword Search | 6 |
| JIVE | Semantic Search | 6 |
| JIVE | Toggle/Mode | 4 |
| JIVE | Context | 4 |
| JIVE | Document Mgmt | 4 |
| JIVE | Enticement | 5 |
| **JIVE Total** | | **37** |
| JIGGA | Upload | 12 |
| JIGGA | Keyword Search | 8 |
| JIGGA | Semantic Search | 10 |
| JIGGA | Toggle/Mode | 8 |
| JIGGA | Context | 6 |
| JIGGA | Document Mgmt | 8 |
| JIGGA | Clear All RAG | 10 |
| **JIGGA Total** | | **62** |
| Shared | Session Docs | 6 |
| Shared | Error Handling | 7 |
| Shared | Performance | 8 |
| Shared | Web Worker | 8 |
| Shared | Optimistic UI | 6 |
| Shared | Keyboard Shortcuts | 8 |
| Shared | UX Enhancements | 10 |
| **Shared Total** | | **53** |
| **GRAND TOTAL** | | **152** |

---

## Related Documentation

- [Session-Scoped RAG Design](./SESSION_SCOPED_RAG_DESIGN.md) - Document lifecycle
- [RxDB Implementation](../.serena/memories/rxdb_implementation.md) - Database details
- [Subscription System](../.serena/memories/subscription_system.md) - Tier definitions

---

# APPENDIX: Token Counting & Cost Administration

> **Status:** 📋 PLANNING  
> **Database:** Prisma (SQLite) in `gogga-admin/prisma/schema.prisma`  
> **Admin Panel:** Port 3100 (`gogga-admin`)

---

## Token Counting Architecture

### Why Client-Side Token Counting?

| Approach | Pros | Cons |
|----------|------|------|
| **Backend (current)** | Uses API response `usage` field | Only available AFTER request, no pre-flight check |
| **Client-side (proposed)** | Pre-flight validation, real-time UI | Slight overhead, must match model tokenizer |
| **Hybrid (recommended)** | Best of both - client estimates, backend confirms | Complexity |

### Recommended: `gpt-tokenizer` (TypeScript)

```typescript
// gogga-frontend/src/lib/tokenizer.ts
import { countTokens, isWithinTokenLimit, encodeChat } from 'gpt-tokenizer';

/**
 * Qwen 3 models use the same tokenizer as Llama/GPT-4 (cl100k_base).
 * gpt-tokenizer is lightweight (15KB gzipped) and runs entirely client-side.
 */

interface TokenEstimate {
  promptTokens: number;
  estimatedOutputTokens: number;  // Based on historical average
  totalTokens: number;
  withinBudget: boolean;
  estimatedCostUSD: number;
}

export function estimateTokens(
  messages: Array<{ role: string; content: string }>,
  tier: 'free' | 'jive' | 'jigga',
  ragContext?: string
): TokenEstimate {
  // Count chat tokens
  const chatTokens = countTokens(messages);
  
  // Add RAG context tokens if present
  const ragTokens = ragContext ? countTokens(ragContext) : 0;
  
  // Total prompt tokens
  const promptTokens = chatTokens + ragTokens;
  
  // Estimate output based on historical average (JIGGA users get longer responses)
  const avgOutputMultiplier = tier === 'jigga' ? 2.5 : tier === 'jive' ? 2.0 : 1.5;
  const estimatedOutputTokens = Math.min(
    Math.round(promptTokens * avgOutputMultiplier),
    tier === 'jigga' ? 8000 : tier === 'jive' ? 5000 : 4000
  );
  
  const totalTokens = promptTokens + estimatedOutputTokens;
  
  // Get budget for tier
  const budgets = {
    free: 16000,   // OpenRouter smaller context
    jive: 131072,  // Qwen 32B full context
    jigga: 131072, // Qwen 32B full context
  };
  
  // Calculate estimated cost
  const pricing = TIER_PRICING[tier];
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerM;
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.outputPerM;
  
  return {
    promptTokens,
    estimatedOutputTokens,
    totalTokens,
    withinBudget: totalTokens <= budgets[tier],
    estimatedCostUSD: inputCost + outputCost,
  };
}

/**
 * Pre-flight check before sending to API.
 * Returns false if message would exceed context window.
 */
export function canSendMessage(
  messages: Array<{ role: string; content: string }>,
  tier: 'free' | 'jive' | 'jigga'
): boolean {
  const limit = tier === 'free' ? 14000 : 120000; // Leave room for response
  const result = isWithinTokenLimit(messages, limit);
  return result !== false;
}

/**
 * Encode chat for Qwen models (same as GPT-4 encoding).
 */
export function encodeForQwen(
  messages: Array<{ role: string; content: string }>
): number[] {
  return encodeChat(messages);
}
```

### Cerebras Token Response Format

```typescript
// Response from Cerebras API includes usage field
interface CerebrasUsage {
  prompt_tokens: number;        // Input tokens
  completion_tokens: number;    // Output tokens  
  total_tokens: number;         // Sum of above
  // Note: Cerebras does NOT separate reasoning tokens yet
  // All thinking/planning is included in completion_tokens
}

// Example response
const response = {
  id: "chatcmpl-xxx",
  choices: [{ message: { content: "..." } }],
  usage: {
    prompt_tokens: 1234,
    completion_tokens: 567,
    total_tokens: 1801
  }
};
```

### CePO / Reasoning Token Handling

> **Important:** When CePO (Cerebras Planning & Optimization) is enabled, the pipeline makes MULTIPLE LLM calls:
> 1. **Planning** - Generate plan (Qwen 32B)
> 2. **Execution** - Execute plan steps
> 3. **Best-of-N** - Generate N responses, pick best
> 4. **Refinement** - Polish final response

```typescript
// CePO multiplier for cost estimation
const CEPO_TOKEN_MULTIPLIER = {
  planning: 1.5,      // Extra tokens for plan generation
  bestOfN: 3,         // Default N=3 responses generated
  refinement: 1.2,    // Polish pass
  total: 1.5 * 3 * 1.2  // ~5.4x more tokens than simple request
};

// Adjust cost estimate for CePO-enabled requests
function estimateCePOCost(baseTokens: number, tier: 'jive' | 'jigga'): number {
  const pricing = TIER_PRICING[tier];
  const effectiveTokens = baseTokens * CEPO_TOKEN_MULTIPLIER.total;
  return (effectiveTokens / 1_000_000) * (pricing.inputPerM + pricing.outputPerM) / 2;
}
```

---

## Pricing Configuration

### Current Pricing (Cerebras - December 2025)

| Model | Input ($/M) | Output ($/M) | Used By |
|-------|-------------|--------------|---------|
| **Qwen 3 32B** (`qwen-3-32b`) | $0.40 | $0.80 | JIVE, JIGGA (default) |
| **Qwen 3 235B** (`qwen-3-235b-a22b-instruct-2507`) | $0.60 | $1.20 | JIGGA (complex/multilingual), FREE via OpenRouter |
| **FLUX 1.1 Pro** | - | $0.04/image | JIVE, JIGGA |
| **Pollinations.ai** | - | $0.00/image | FREE |

### Prisma Schema for Pricing Configuration

```prisma
// gogga-admin/prisma/schema.prisma (NEW)

// Admin-configurable pricing per model
model ModelPricing {
  id              String   @id @default(cuid())
  modelId         String   @unique  // e.g., "qwen-3-32b", "qwen-3-235b-a22b-instruct-2507"
  displayName     String   // e.g., "Qwen 3 32B"
  provider        String   // "cerebras", "openrouter", "pollinations"
  
  // Token pricing (USD per million tokens)
  inputPricePerM  Float    @default(0)
  outputPricePerM Float    @default(0)
  
  // Image pricing (USD per image) - only for image models
  imagePricePerUnit Float  @default(0)
  
  // Which tiers can use this model
  allowedTiers    String   @default("free,jive,jigga")  // Comma-separated
  
  // Is this model active?
  isActive        Boolean  @default(true)
  
  // Audit
  updatedBy       String?  // Admin email
  updatedAt       DateTime @updatedAt
  createdAt       DateTime @default(now())
  
  @@index([provider])
  @@index([isActive])
}

// Feature-level cost configuration
model FeatureCost {
  id              String   @id @default(cuid())
  featureKey      String   @unique  // e.g., "rag_search", "cepo_planning", "image_gen"
  displayName     String   // e.g., "RAG Semantic Search"
  description     String?
  
  // Cost basis
  costType        String   // "per_request", "per_token", "per_image", "per_mb"
  costAmountUSD   Float    @default(0)
  
  // Tier overrides (JSON: { "free": 0, "jive": 0.001, "jigga": 0.0005 })
  tierOverrides   String?  // JSON string
  
  // Multipliers
  cepoMultiplier  Float    @default(1.0)  // Extra cost when CePO is enabled
  
  // Is this feature billable?
  isBillable      Boolean  @default(true)
  
  // Audit
  updatedBy       String?
  updatedAt       DateTime @updatedAt
  createdAt       DateTime @default(now())
}

// Exchange rate configuration
model ExchangeRate {
  id              String   @id @default(cuid())
  fromCurrency    String   // "USD"
  toCurrency      String   // "ZAR"
  rate            Float    // e.g., 18.50
  
  updatedBy       String?
  updatedAt       DateTime @updatedAt
  createdAt       DateTime @default(now())
  
  @@unique([fromCurrency, toCurrency])
}
```

---

## Admin Panel: Token Administration Tab

### Route: `/admin/tokens` (Port 3100)

```
gogga-admin/src/app/
├── tokens/
│   ├── page.tsx              # Main token admin page
│   ├── pricing/
│   │   └── page.tsx          # Model pricing configuration
│   ├── features/
│   │   └── page.tsx          # Feature cost configuration
│   └── exchange/
│       └── page.tsx          # Exchange rate management
```

### Token Admin Dashboard (`tokens/page.tsx`)

```tsx
// gogga-admin/src/app/tokens/page.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Cpu, Sparkles, RefreshCw } from 'lucide-react';
import { ModelPricingTable } from './pricing/ModelPricingTable';
import { FeatureCostTable } from './features/FeatureCostTable';
import { ExchangeRateCard } from './exchange/ExchangeRateCard';
import { UsageSummaryChart } from './UsageSummaryChart';

export default function TokenAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Token & Cost Administration</h1>
        <p className="text-muted-foreground">
          Configure model pricing, feature costs, and exchange rates
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens (Today)</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.4M</div>
            <p className="text-xs text-muted-foreground">+15% from yesterday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cost (Today)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$4.82</div>
            <p className="text-xs text-muted-foreground">R89.17 at current rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Images (Today)</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">$1.88 FLUX cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">USD/ZAR Rate</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R18.50</div>
            <p className="text-xs text-muted-foreground">Last updated 2h ago</p>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Tabs */}
      <Tabs defaultValue="pricing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pricing">Model Pricing</TabsTrigger>
          <TabsTrigger value="features">Feature Costs</TabsTrigger>
          <TabsTrigger value="exchange">Exchange Rates</TabsTrigger>
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing">
          <ModelPricingTable />
        </TabsContent>

        <TabsContent value="features">
          <FeatureCostTable />
        </TabsContent>

        <TabsContent value="exchange">
          <ExchangeRateCard />
        </TabsContent>

        <TabsContent value="usage">
          <UsageSummaryChart />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Model Pricing Editor

```tsx
// gogga-admin/src/app/tokens/pricing/ModelPricingTable.tsx
'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface ModelPricing {
  id: string;
  modelId: string;
  displayName: string;
  provider: string;
  inputPricePerM: number;
  outputPricePerM: number;
  imagePricePerUnit: number;
  allowedTiers: string;
  isActive: boolean;
}

const DEFAULT_PRICING: ModelPricing[] = [
  {
    id: '1',
    modelId: 'qwen-3-32b',
    displayName: 'Qwen 3 32B',
    provider: 'cerebras',
    inputPricePerM: 0.40,
    outputPricePerM: 0.80,
    imagePricePerUnit: 0,
    allowedTiers: 'jive,jigga',
    isActive: true,
  },
  {
    id: '2',
    modelId: 'qwen-3-235b-a22b-instruct-2507',
    displayName: 'Qwen 3 235B Instruct',
    provider: 'cerebras',
    inputPricePerM: 0.60,
    outputPricePerM: 1.20,
    imagePricePerUnit: 0,
    allowedTiers: 'free,jive,jigga',
    isActive: true,
  },
  {
    id: '3',
    modelId: 'flux-1.1-pro',
    displayName: 'FLUX 1.1 Pro',
    provider: 'bfl',
    inputPricePerM: 0,
    outputPricePerM: 0,
    imagePricePerUnit: 0.04,
    allowedTiers: 'jive,jigga',
    isActive: true,
  },
  {
    id: '4',
    modelId: 'pollinations',
    displayName: 'Pollinations.ai',
    provider: 'pollinations',
    inputPricePerM: 0,
    outputPricePerM: 0,
    imagePricePerUnit: 0,
    allowedTiers: 'free',
    isActive: true,
  },
];

export function ModelPricingTable() {
  const [pricing, setPricing] = useState<ModelPricing[]>(DEFAULT_PRICING);
  const [isDirty, setIsDirty] = useState(false);

  const handlePriceChange = (id: string, field: keyof ModelPricing, value: number) => {
    setPricing(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      // Save to database via API
      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing }),
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      toast.success('Pricing updated successfully');
      setIsDirty(false);
    } catch (error) {
      toast.error('Failed to save pricing');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Model Pricing</h2>
          <p className="text-sm text-muted-foreground">
            Configure token costs per model (USD per million tokens)
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPricing(DEFAULT_PRICING)} disabled={!isDirty}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!isDirty}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Input ($/M)</TableHead>
            <TableHead>Output ($/M)</TableHead>
            <TableHead>Image ($/unit)</TableHead>
            <TableHead>Tiers</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pricing.map((model) => (
            <TableRow key={model.id}>
              <TableCell className="font-medium">{model.displayName}</TableCell>
              <TableCell>
                <Badge variant="outline">{model.provider}</Badge>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={model.inputPricePerM}
                  onChange={(e) => handlePriceChange(model.id, 'inputPricePerM', parseFloat(e.target.value))}
                  className="w-24"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={model.outputPricePerM}
                  onChange={(e) => handlePriceChange(model.id, 'outputPricePerM', parseFloat(e.target.value))}
                  className="w-24"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={model.imagePricePerUnit}
                  onChange={(e) => handlePriceChange(model.id, 'imagePricePerUnit', parseFloat(e.target.value))}
                  className="w-24"
                />
              </TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {model.allowedTiers.split(',').map(tier => (
                    <Badge key={tier} variant="secondary" className="text-xs">
                      {tier.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={model.isActive ? 'default' : 'destructive'}>
                  {model.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### Feature Cost Editor

```tsx
// gogga-admin/src/app/tokens/features/FeatureCostTable.tsx
'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface FeatureCost {
  id: string;
  featureKey: string;
  displayName: string;
  costType: 'per_request' | 'per_token' | 'per_image' | 'per_mb';
  costAmountUSD: number;
  cepoMultiplier: number;
  isBillable: boolean;
}

const FEATURES: FeatureCost[] = [
  { id: '1', featureKey: 'chat_basic', displayName: 'Basic Chat', costType: 'per_token', costAmountUSD: 0, cepoMultiplier: 1.0, isBillable: true },
  { id: '2', featureKey: 'chat_cepo', displayName: 'CePO Enhanced Chat', costType: 'per_token', costAmountUSD: 0, cepoMultiplier: 5.4, isBillable: true },
  { id: '3', featureKey: 'rag_search', displayName: 'RAG Semantic Search', costType: 'per_request', costAmountUSD: 0.0001, cepoMultiplier: 1.0, isBillable: true },
  { id: '4', featureKey: 'rag_embedding', displayName: 'RAG Embedding Gen', costType: 'per_request', costAmountUSD: 0, cepoMultiplier: 1.0, isBillable: false },
  { id: '5', featureKey: 'image_flux', displayName: 'FLUX Image Gen', costType: 'per_image', costAmountUSD: 0.04, cepoMultiplier: 1.0, isBillable: true },
  { id: '6', featureKey: 'image_pollinations', displayName: 'Pollinations Image', costType: 'per_image', costAmountUSD: 0, cepoMultiplier: 1.0, isBillable: false },
  { id: '7', featureKey: 'web_search', displayName: 'Web Search (Serper)', costType: 'per_request', costAmountUSD: 0.001, cepoMultiplier: 1.0, isBillable: true },
  { id: '8', featureKey: 'math_tools', displayName: 'Math Tool Execution', costType: 'per_request', costAmountUSD: 0, cepoMultiplier: 1.0, isBillable: false },
];

export function FeatureCostTable() {
  const [features, setFeatures] = useState<FeatureCost[]>(FEATURES);

  const handleChange = (id: string, field: keyof FeatureCost, value: any) => {
    setFeatures(prev => prev.map(f => 
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  const costTypeLabels = {
    per_request: 'Per Request',
    per_token: 'Per Token',
    per_image: 'Per Image',
    per_mb: 'Per MB',
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Feature Costs</h2>
        <p className="text-sm text-muted-foreground">
          Configure per-feature costs and CePO multipliers
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Feature</TableHead>
            <TableHead>Cost Type</TableHead>
            <TableHead>Base Cost ($)</TableHead>
            <TableHead>CePO Multiplier</TableHead>
            <TableHead>Billable</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((feature) => (
            <TableRow key={feature.id}>
              <TableCell className="font-medium">{feature.displayName}</TableCell>
              <TableCell>
                <Badge variant="outline">{costTypeLabels[feature.costType]}</Badge>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={feature.costAmountUSD}
                  onChange={(e) => handleChange(feature.id, 'costAmountUSD', parseFloat(e.target.value))}
                  className="w-28"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  value={feature.cepoMultiplier}
                  onChange={(e) => handleChange(feature.id, 'cepoMultiplier', parseFloat(e.target.value))}
                  className="w-20"
                />
              </TableCell>
              <TableCell>
                <Switch
                  checked={feature.isBillable}
                  onCheckedChange={(checked) => handleChange(feature.id, 'isBillable', checked)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## Implementation TODO: Token Administration

### Phase 14: Token Counting (Client-Side) 🔢
- [ ] Install `gpt-tokenizer` package in frontend
- [ ] Create `tokenizer.ts` utility module
- [ ] Add `countTokens()` wrapper for Qwen models
- [ ] Add `estimateTokens()` with cost calculation
- [ ] Add `canSendMessage()` pre-flight check
- [ ] Add token counter UI in chat input area
- [ ] Show "X tokens remaining" based on context budget
- [ ] Add real-time cost estimate tooltip

### Phase 15: Token Counting (Backend Verification) ✅
- [ ] Verify backend returns `usage` from Cerebras API
- [ ] Update `cost_tracker.py` with new pricing constants
- [ ] Add CePO token multiplier to cost calculation
- [ ] Track reasoning tokens separately (when Cerebras supports)
- [ ] Persist actual vs estimated tokens to Usage table
- [ ] Add usage reconciliation job (hourly)

### Phase 16: Prisma Schema Updates 🗃️
- [ ] Add `ModelPricing` table to schema
- [ ] Add `FeatureCost` table to schema
- [ ] Add `ExchangeRate` table to schema
- [ ] Run Prisma migration
- [ ] Seed default pricing data
- [ ] Add admin API routes for CRUD

### Phase 17: Admin Panel - Token Tab 🖥️
- [ ] Create `/tokens` route in gogga-admin
- [ ] Create `/tokens/pricing` sub-route
- [ ] Create `/tokens/features` sub-route
- [ ] Create `/tokens/exchange` sub-route
- [ ] Add summary dashboard cards
- [ ] Add usage analytics chart
- [ ] Add pricing edit form with validation
- [ ] Add feature cost edit form
- [ ] Add exchange rate update form
- [ ] Add audit logging for price changes

### Phase 18: Dynamic Pricing Integration 🔄
- [ ] Load pricing from database on backend startup
- [ ] Cache pricing with 5-minute TTL
- [ ] Update `cost_tracker.py` to use dynamic pricing
- [ ] Add pricing version field for audit
- [ ] Add rollback capability for pricing changes
- [ ] Notify users of pricing changes (email/in-app)
