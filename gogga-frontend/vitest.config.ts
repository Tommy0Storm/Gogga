import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
    setupFiles: [],
    testTimeout: 30000,
    pool: 'forks',
    // @ts-expect-error - poolOptions may not exist in newer Vitest types
    poolOptions: {
      forks: {
        singleFork: true, // Use single process to avoid duplicate database creation
      },
    },
    sequence: {
      hooks: 'list', // Run hooks in order
    },
    // Environment overrides for specific test patterns
    environmentMatchGlobs: [
      // React component tests use jsdom (including __tests__ subdirs)
      ['**/*.test.tsx', 'jsdom'],
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@huggingface/transformers': path.resolve(__dirname, './__mocks__/@huggingface/transformers.ts'),
      'flexsearch': path.resolve(__dirname, './__mocks__/flexsearch.ts'),
      'jszip': path.resolve(__dirname, './__mocks__/jszip.ts'),
    },
  },
});
