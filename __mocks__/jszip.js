module.exports = {
  __esModule: true,
  default: class JSZipMock {
    file() { return this; }
    loadAsync() { return Promise.resolve({}); }
  }
};
