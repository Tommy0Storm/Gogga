module.exports = {
  __esModule: true,
  pipeline: async () => async (input) => {
    const makeVec = () => ({ data: new Float32Array(384).fill(0.1) });
    if (Array.isArray(input)) return input.map(() => makeVec());
    return makeVec();
  },
};
