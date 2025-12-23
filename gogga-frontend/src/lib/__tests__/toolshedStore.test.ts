/**
 * ToolShed Store Tests
 * 
 * Tests for tool category icons and filtering
 * 
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { TOOL_CATEGORIES, getFilteredTools, type ToolCategory, type ToolDefinition } from '../toolshedStore';

describe('TOOL_CATEGORIES', () => {
  it('has 5 categories', () => {
    expect(TOOL_CATEGORIES).toHaveLength(5);
  });

  it('each category has unique id', () => {
    const ids = TOOL_CATEGORIES.map(cat => cat.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('each category has unique icon (no duplicates)', () => {
    const icons = TOOL_CATEGORIES.map(cat => cat.icon);
    const uniqueIcons = new Set(icons);
    expect(uniqueIcons.size).toBe(icons.length);
  });

  it('has correct category structure', () => {
    TOOL_CATEGORIES.forEach(cat => {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('label');
      expect(cat).toHaveProperty('icon');
      expect(cat).toHaveProperty('description');
    });
  });

  it('includes all expected categories', () => {
    const expectedIds: ToolCategory[] = ['all', 'math', 'visualization', 'creative', 'memory'];
    const actualIds = TOOL_CATEGORIES.map(cat => cat.id);
    expect(actualIds).toEqual(expectedIds);
  });

  describe('icon uniqueness', () => {
    it('all icon is ⊕', () => {
      const all = TOOL_CATEGORIES.find(c => c.id === 'all');
      expect(all?.icon).toBe('⊕');
    });

    it('math icon is Σ', () => {
      const math = TOOL_CATEGORIES.find(c => c.id === 'math');
      expect(math?.icon).toBe('Σ');
    });

    it('visualization icon is ◱', () => {
      const viz = TOOL_CATEGORIES.find(c => c.id === 'visualization');
      expect(viz?.icon).toBe('◱');
    });

    it('creative icon is ◈', () => {
      const creative = TOOL_CATEGORIES.find(c => c.id === 'creative');
      expect(creative?.icon).toBe('◈');
    });

    it('memory icon is ⬡', () => {
      const memory = TOOL_CATEGORIES.find(c => c.id === 'memory');
      expect(memory?.icon).toBe('⬡');
    });
  });
});

describe('getFilteredTools', () => {
  const mockTools: ToolDefinition[] = [
    { 
      name: 'calculator', 
      category: 'math', 
      description: 'Math', 
      tierRequired: 'free',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    { 
      name: 'generate_image', 
      category: 'creative', 
      description: 'Images', 
      tierRequired: 'jigga',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    { 
      name: 'memory_store', 
      category: 'memory', 
      description: 'Memory', 
      tierRequired: 'jive',
      parameters: { type: 'object', properties: {}, required: [] }
    },
  ];

  it('returns all tools when category is "all" for jigga tier', () => {
    const filtered = getFilteredTools(mockTools, 'all', 'jigga');
    expect(filtered).toHaveLength(3);
  });

  it('filters by math category', () => {
    const filtered = getFilteredTools(mockTools, 'math', 'jigga');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('calculator');
  });

  it('filters by creative category', () => {
    const filtered = getFilteredTools(mockTools, 'creative', 'jigga');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('generate_image');
  });

  it('filters by memory category', () => {
    const filtered = getFilteredTools(mockTools, 'memory', 'jigga');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('memory_store');
  });

  it('returns empty array for category with no tools', () => {
    const filtered = getFilteredTools(mockTools, 'visualization', 'jigga');
    expect(filtered).toHaveLength(0);
  });

  it('filters tools by tier access', () => {
    // FREE tier can only access free tools
    const freeFiltered = getFilteredTools(mockTools, 'all', 'free');
    expect(freeFiltered).toHaveLength(1);
    expect(freeFiltered[0].name).toBe('calculator');

    // JIVE tier can access free and jive tools
    const jiveFiltered = getFilteredTools(mockTools, 'all', 'jive');
    expect(jiveFiltered).toHaveLength(2);
    
    // JIGGA tier can access all tools
    const jiggaFiltered = getFilteredTools(mockTools, 'all', 'jigga');
    expect(jiggaFiltered).toHaveLength(3);
  });
});
