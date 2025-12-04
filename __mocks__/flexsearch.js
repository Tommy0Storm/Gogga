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
