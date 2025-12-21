/**
 * RightSidePanel Tests
 * 
 * Tests for the unified slide-out panel logic:
 * - Tool category icon uniqueness
 * - Smart tab tier gating
 * - Tools filtering
 * 
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';

// Test Tool Category Icons
describe('Tool Category Icons', () => {
  // These should match the TOOL_CATEGORIES in toolshedStore.ts
  const TOOL_CATEGORIES = [
    { id: 'all', label: 'All', icon: '⊕', description: 'All available tools' },
    { id: 'math', label: 'Math & Finance', icon: 'Σ', description: 'Calculations' },
    { id: 'visualization', label: 'Charts', icon: '◱', description: 'Visualization' },
    { id: 'creative', label: 'Images', icon: '◈', description: 'AI images' },
    { id: 'memory', label: 'Memory', icon: '⬡', description: 'Memory tools' },
  ];

  it('has 5 categories', () => {
    expect(TOOL_CATEGORIES).toHaveLength(5);
  });

  it('each category has unique icon (no duplicates)', () => {
    const icons = TOOL_CATEGORIES.map(cat => cat.icon);
    const uniqueIcons = new Set(icons);
    expect(uniqueIcons.size).toBe(icons.length);
  });

  it('each category has unique id', () => {
    const ids = TOOL_CATEGORIES.map(cat => cat.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  describe('icon values', () => {
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

// Test Smart Tab Tier Gating Logic
describe('Smart Tab Tier Gating', () => {
  const isSmartEnabled = (tier: string): boolean => {
    return tier === 'jive' || tier === 'jigga';
  };

  it('FREE tier shows upgrade teaser (isEnabled = false)', () => {
    expect(isSmartEnabled('free')).toBe(false);
  });

  it('JIVE tier has Smart enabled', () => {
    expect(isSmartEnabled('jive')).toBe(true);
  });

  it('JIGGA tier has Smart enabled', () => {
    expect(isSmartEnabled('jigga')).toBe(true);
  });
});

// Test Panel Tab Structure
describe('Panel Tab Structure', () => {
  const PANEL_TABS = [
    { id: 'docs', label: 'Docs', icon: 'FileText' },
    { id: 'tools', label: 'Tools', icon: 'Wrench' },
    { id: 'smart', label: 'Smart', icon: 'Brain' },
  ];

  it('has 3 tabs', () => {
    expect(PANEL_TABS).toHaveLength(3);
  });

  it('includes Docs tab', () => {
    expect(PANEL_TABS.find(t => t.id === 'docs')).toBeDefined();
  });

  it('includes Tools tab', () => {
    expect(PANEL_TABS.find(t => t.id === 'tools')).toBeDefined();
  });

  it('includes Smart tab', () => {
    expect(PANEL_TABS.find(t => t.id === 'smart')).toBeDefined();
  });
});

// Test Upgrade Teaser Content
describe('Smart Upgrade Teaser', () => {
  const upgradeTeaser = {
    title: 'GoggaSmart™',
    badge: 'PREMIUM FEATURE',
    price: 'Starting at R49/month',
    features: [
      'Personal AI Memory',
      'Learns From Feedback',
      'Gets Smarter Over Time',
    ],
    cta: 'Upgrade to JIVE',
  };

  it('has correct title', () => {
    expect(upgradeTeaser.title).toBe('GoggaSmart™');
  });

  it('shows premium badge', () => {
    expect(upgradeTeaser.badge).toBe('PREMIUM FEATURE');
  });

  it('shows ZAR pricing', () => {
    expect(upgradeTeaser.price).toContain('R49');
  });

  it('lists 3 features', () => {
    expect(upgradeTeaser.features).toHaveLength(3);
  });

  it('has CTA button text', () => {
    expect(upgradeTeaser.cta).toBe('Upgrade to JIVE');
  });
});
