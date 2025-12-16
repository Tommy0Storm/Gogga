/**
 * Mock for @huggingface/transformers
 * Used by vitest for RAG tests
 */
import { vi } from 'vitest';

const mockPipelineInstance = vi.fn().mockImplementation(async (input: string | string[]) => {
  const makeVec = () => ({ data: new Float32Array(384).fill(0.1) });
  if (Array.isArray(input)) return input.map(() => makeVec());
  return makeVec();
});

export const pipeline = vi.fn().mockResolvedValue(mockPipelineInstance);
export const AutoTokenizer = { from_pretrained: vi.fn().mockResolvedValue({}) };
export const AutoModel = { from_pretrained: vi.fn().mockResolvedValue({}) };
