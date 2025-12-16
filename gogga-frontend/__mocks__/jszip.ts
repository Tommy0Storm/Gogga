/**
 * Mock for jszip
 * Used by vitest for RAG tests
 */
import { vi } from 'vitest';

class MockJSZip {
  private files: Map<string, string> = new Map();

  file(path: string, content?: string): this | string | null {
    if (content !== undefined) {
      this.files.set(path, content);
      return this;
    }
    return this.files.get(path) ?? null;
  }

  async generateAsync(_options?: Record<string, unknown>): Promise<Blob> {
    return new Blob([JSON.stringify(Object.fromEntries(this.files))], { type: 'application/zip' });
  }

  async loadAsync(_data: Blob | ArrayBuffer): Promise<MockJSZip> {
    return this;
  }
}

export default MockJSZip;
