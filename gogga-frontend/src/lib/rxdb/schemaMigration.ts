/**
 * RxDB Migration Strategies
 * 
 * When schema versions change, these strategies transform old documents to new format.
 */

import type { MigrationStrategies } from 'rxdb';

// Document Migrations
export const documentMigrationStrategies: MigrationStrategies = {
  // v0 -> v1: No data transformation needed (schema structure same)
  1: (oldDoc: any) => oldDoc,
};

// Empty migration strategies for collections at version 0
export const documentChunkMigrationStrategies: MigrationStrategies = {};
export const chatSessionMigrationStrategies: MigrationStrategies = {};
export const chatMessageMigrationStrategies: MigrationStrategies = {};
export const generatedImageMigrationStrategies: MigrationStrategies = {};
export const userPreferenceMigrationStrategies: MigrationStrategies = {};
export const memoryContextMigrationStrategies: MigrationStrategies = {};
export const tokenUsageMigrationStrategies: MigrationStrategies = {};
export const toolUsageMigrationStrategies: MigrationStrategies = {};
export const ragMetricMigrationStrategies: MigrationStrategies = {};
export const systemLogMigrationStrategies: MigrationStrategies = {};
export const vectorEmbeddingMigrationStrategies: MigrationStrategies = {};
export const offlineQueueMigrationStrategies: MigrationStrategies = {};
export const goggaSmartSkillMigrationStrategies: MigrationStrategies = {
  // v0 -> v1: Added context field and updated indexes
  1: (oldDoc: any) => ({
    ...oldDoc,
    context: oldDoc.context || '',
  }),
  // v1 -> v2: No data changes, just force re-creation after schema hash mismatch
  2: (oldDoc: any) => oldDoc,
};

// Icon Generation Migrations
export const iconGenerationMigrationStrategies: MigrationStrategies = {
  // v0 -> v1: Added maxLength to tier field (no data transformation needed)
  1: (oldDoc: any) => {
    return oldDoc; // No changes to document structure, just schema constraint
  },
};

// All migration strategies combined for easy access
export const allMigrationStrategies = {
  documents: documentMigrationStrategies,
  documentChunks: documentChunkMigrationStrategies,
  chatSessions: chatSessionMigrationStrategies,
  chatMessages: chatMessageMigrationStrategies,
  generatedImages: generatedImageMigrationStrategies,
  userPreferences: userPreferenceMigrationStrategies,
  memoryContexts: memoryContextMigrationStrategies,
  tokenUsage: tokenUsageMigrationStrategies,
  toolUsage: toolUsageMigrationStrategies,
  ragMetrics: ragMetricMigrationStrategies,
  systemLogs: systemLogMigrationStrategies,
  vectorEmbeddings: vectorEmbeddingMigrationStrategies,
  offlineQueue: offlineQueueMigrationStrategies,
  goggaSmartSkills: goggaSmartSkillMigrationStrategies,
  iconGenerations: iconGenerationMigrationStrategies,
};

// Migration helper functions for common transformations
export function addFieldMigration<T extends Record<string, unknown>>(
  fieldName: string,
  defaultValue: unknown
): (oldDoc: T) => T {
  return (oldDoc: T) => ({ ...oldDoc, [fieldName]: defaultValue });
}

export function removeFieldMigration<T extends Record<string, unknown>>(
  fieldName: string
): (oldDoc: T) => Omit<T, typeof fieldName> {
  return (oldDoc: T) => {
    const { [fieldName]: _, ...rest } = oldDoc;
    return rest as Omit<T, typeof fieldName>;
  };
}

export function renameFieldMigration<T extends Record<string, unknown>>(
  oldFieldName: string,
  newFieldName: string
): (oldDoc: T) => T {
  return (oldDoc: T) => {
    const { [oldFieldName]: value, ...rest } = oldDoc;
    return { ...rest, [newFieldName]: value } as T;
  };
}

export function transformFieldMigration<T extends Record<string, unknown>>(
  fieldName: string,
  transformer: (value: unknown) => unknown
): (oldDoc: T) => T {
  return (oldDoc: T) => ({
    ...oldDoc,
    [fieldName]: transformer(oldDoc[fieldName]),
  });
}
