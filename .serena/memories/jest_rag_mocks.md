# Jest RAG Pipeline Mocks

> **Created:** December 4, 2025

## Purpose

Manual mocks for testing browser-only RAG components in Node/Jest environment. These mocks simulate:
- `@huggingface/transformers` - E5 embedding pipeline
- `flexsearch` - Keyword search index
- `jszip` - Document extraction (DOCX, ODT)

## Mock Locations

All mocks are in `/__mocks__/` at project root:

```
/home/ubuntu/Dev-Projects/Gogga/
├── __mocks__/
│   ├── @huggingface/
│   │   └── transformers.js    # Embedding pipeline mock
│   ├── flexsearch.js          # FlexSearch.Index mock
│   └── jszip.js               # JSZip mock
├── jest.config.js             # Jest configuration
└── jest.setup.js              # Global mock setup
```

## Mock Implementations

### @huggingface/transformers.js
```javascript
module.exports = {
  __esModule: true,
  pipeline: async () => async (input) => {
    const makeVec = () => ({ data: new Float32Array(384).fill(0.1) });
    if (Array.isArray(input)) return input.map(() => makeVec());
    return makeVec();
  },
};
```

### flexsearch.js
```javascript
class MockIndex {
  constructor() {
    this.data = {};
  }
  add(id, text) {
    this.data[id] = text;
  }
  search(query, opts) {
    return Object.keys(this.data).slice(0, (opts && opts.limit) || 5);
  }
  remove(id) {
    delete this.data[id];
  }
}

module.exports = {
  __esModule: true,
  Index: MockIndex,
  default: { Index: MockIndex },
};
```

### jszip.js
```javascript
module.exports = {
  __esModule: true,
  default: class JSZipMock {
    file() { return this; }
    loadAsync() { return Promise.resolve({}); }
  }
};
```

## Test File

Test file location: `gogga-frontend/src/lib/rag.test.ts`

```typescript
jest.mock('flexsearch');
jest.mock('jszip');
jest.mock('@huggingface/transformers');

import { embeddingEngine } from './embeddingEngine';
import { ragManager } from './ragManager';
import rag from './rag';
import { Document } from './db';

describe('Enterprise RAG Pipeline', () => {
  const TEST_DOC: Document = {
    id: 1,
    sessionId: 'jest-session',
    filename: 'RHA_Overview.txt',
    content: 'South African law protects tenants...',
    chunks: [],
    chunkCount: 1,
    size: 120,
    mimeType: 'text/plain',
    createdAt: new Date(),
    updatedAt: new Date(),
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
    const context = await ragManager.getContextForLLM(...);
    expect(typeof context).toBe('string');
    expect(context.length).toBeGreaterThan(0);
  });

  it('should retrieve basic context with FlexSearch', async () => {
    const chunks = rag.chunkText(TEST_DOC.content);
    const index = rag.getSessionIndex(TEST_DOC.sessionId);
    chunks.forEach((chunk, i) => index.add(i, chunk));
    const searchResults = index.search('tenant', { limit: 3 });
    expect(Array.isArray(searchResults)).toBe(true);
  });
});
```

## Jest Configuration

### jest.config.js
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
```

## Usage

Run tests:
```bash
npx jest gogga-frontend/src/lib/rag.test.ts --verbose
```

## Key Points

1. **esModuleInterop**: Add `"esModuleInterop": true` to `tsconfig.json` for default import compatibility
2. **Mock placement**: Node module mocks go in `<rootDir>/__mocks__/` (not inside src)
3. **Scoped packages**: Use directory structure for scoped packages (`@huggingface/transformers.js`)
4. **jest.mock()**: Call at top of test file before imports

## Test Results

```
✓ should generate semantic embeddings (36 ms)
✓ should retrieve semantic context with RagManager (3 ms)
✓ should retrieve basic context with FlexSearch (2 ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```
