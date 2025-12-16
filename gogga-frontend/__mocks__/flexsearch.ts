/**
 * Mock for flexsearch
 * Used by vitest for RAG tests
 */

class MockIndex {
  private storage: Map<string | number, string> = new Map();

  add(id: string | number, content: string): this {
    this.storage.set(id, content);
    return this;
  }

  search(query: string, options?: { limit?: number } | number): Array<string | number> {
    const results: Array<string | number> = [];
    const limit = typeof options === 'number' ? options : (options?.limit ?? 10);
    
    for (const [id, content] of this.storage.entries()) {
      if (content.toLowerCase().includes(query.toLowerCase())) {
        results.push(id);
        if (results.length >= limit) break;
      }
    }
    
    return results;
  }

  remove(id: string | number): this {
    this.storage.delete(id);
    return this;
  }

  update(id: string | number, content: string): this {
    this.storage.set(id, content);
    return this;
  }
}

class MockDocument {
  private storage: Map<string | number, string> = new Map();

  add(id: string | number, content: string) {
    this.storage.set(id, content);
  }

  search(query: string, options?: { limit?: number }): Array<{ id: string | number; content: string }> {
    const results: Array<{ id: string | number; content: string }> = [];
    const limit = options?.limit ?? 10;
    
    for (const [id, content] of this.storage.entries()) {
      if (content.toLowerCase().includes(query.toLowerCase())) {
        results.push({ id, content });
        if (results.length >= limit) break;
      }
    }
    
    return results;
  }

  remove(id: string | number) {
    this.storage.delete(id);
  }

  update(id: string | number, content: string) {
    this.storage.set(id, content);
  }
}

// Export as both named and default for different import styles
export const Index = MockIndex;
export const Document = MockDocument;
export default { Index: MockIndex, Document: MockDocument };
