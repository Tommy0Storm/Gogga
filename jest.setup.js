jest.mock('jszip', () => ({
  __esModule: true,
  default: class JSZipMock {
    file() { return this; }
    loadAsync() { return Promise.resolve({}); }
  }
}));

jest.mock('@huggingface/transformers', () => ({
  __esModule: true,
  pipeline: async () => async (input) => {
    const makeVec = () => ({ data: new Float32Array(384).fill(0.1) });
    if (Array.isArray(input)) return input.map(() => makeVec());
    return makeVec();
  },
}));

jest.mock('flexsearch', () => {
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
  const flexsearchDefault = { Index: MockIndex };
  return {
    __esModule: true,
    Index: MockIndex,
    default: flexsearchDefault,
  };
});
