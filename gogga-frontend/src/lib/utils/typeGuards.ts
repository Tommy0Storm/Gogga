/**
 * Type Guards with TypeScript 5.5 Inferred Type Predicates
 * 
 * These use arrow function syntax for automatic type predicate inference.
 * TypeScript 5.5+ automatically infers return type as `value is Type`.
 */

import type { Document } from '@/lib/db';

/**
 * Validates that a document has required fields.
 * TypeScript 5.5 automatically infers: (doc: Document | null) => doc is Document
 */
export const isValidDocument = (doc: Document | null) =>
  doc !== null && 
  doc.content !== undefined && 
  doc.filename !== undefined;

/**
 * Validates that a document has chunks for RAG retrieval.
 */
export const isValidRAGDocument = (doc: Document | null) =>
  doc !== null && 
  doc.chunks !== undefined && 
  Array.isArray(doc.chunks) && 
  doc.chunks.length > 0;

/**
 * Validates message structure for chat history.
 */
export const isValidMessage = (msg: any): msg is { role: string; content: string } =>
  msg !== null &&
  typeof msg === 'object' &&
  typeof msg.role === 'string' &&
  typeof msg.content === 'string';

/**
 * Validates chat session structure.
 */
export const isValidSession = (session: any) =>
  session !== null &&
  typeof session === 'object' &&
  typeof session.id === 'string' &&
  typeof session.title === 'string';
