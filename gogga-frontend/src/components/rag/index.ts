/**
 * GOGGA RAG Components
 * 
 * UI components for the two-mechanism RAG system:
 * - 📎 SessionDocUpload (Paperclip): Temporary docs for current chat
 * - 📚 RAGUploadButton: Persistent document store
 * 
 * Visual feedback components:
 * - DragDropZone: Animated upload zone with validation
 * - ModelLoadingProgress: E5 model loading indicator
 * - RAGActivityIndicator: Pulse animation during search
 * - ChunkVisualization: Expandable source citations
 * - StorageMeter: Document/storage usage visualization
 * 
 * Pool management:
 * - DocumentPoolModal: Cross-session document selection (JIGGA)
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md
 */

// Upload components
export { RAGUploadButton } from './RAGUploadButton';
export { SessionDocUpload } from './SessionDocUpload';
export { DragDropZone } from './DragDropZone';

// Feedback & visualization components
export { ModelLoadingProgress } from './ModelLoadingProgress';
export { RAGActivityIndicator } from './RAGActivityIndicator';
export { ChunkVisualization, type UsedChunk } from './ChunkVisualization';
export { StorageMeter } from './StorageMeter';
export { RAGDebugPanel, TOKEN_BUDGETS } from './RAGDebugPanel';

// Token counting components
export { TokenCounter, TokenCounterInline, CanSendIndicator } from './TokenCounter';

// Pool management (JIGGA feature)
export { DocumentPoolModal } from './DocumentPoolModal';
