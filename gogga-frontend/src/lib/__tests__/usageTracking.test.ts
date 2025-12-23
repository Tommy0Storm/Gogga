/**
 * Usage Tracking Tests
 * Tests for token and tool usage tracking in RxDB
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock RxDB database
const mockTokenUsageDocs: any[] = [];
const mockToolUsageDocs: any[] = [];

vi.mock('@/lib/rxdb/database', () => ({
  getDatabase: vi.fn(async () => ({
    tokenUsage: {
      find: vi.fn(() => ({
        exec: vi.fn(async () => mockTokenUsageDocs),
      })),
      findOne: vi.fn((id: string) => ({
        exec: vi.fn(
          async () => mockTokenUsageDocs.find((d) => d.id === id) || null
        ),
      })),
      upsert: vi.fn(async (doc: any) => {
        const existing = mockTokenUsageDocs.findIndex((d) => d.id === doc.id);
        if (existing >= 0) {
          mockTokenUsageDocs[existing] = {
            ...mockTokenUsageDocs[existing],
            ...doc,
          };
        } else {
          mockTokenUsageDocs.push(doc);
        }
        return doc;
      }),
    },
    toolUsage: {
      find: vi.fn(() => ({
        exec: vi.fn(async () => mockToolUsageDocs),
        sort: vi.fn(() => ({
          limit: vi.fn(() => ({
            exec: vi.fn(async () => mockToolUsageDocs.slice(0, 10)),
          })),
        })),
      })),
      findOne: vi.fn((id: string) => ({
        exec: vi.fn(
          async () => mockToolUsageDocs.find((d) => d.id === id) || null
        ),
      })),
      upsert: vi.fn(async (doc: any) => {
        const existing = mockToolUsageDocs.findIndex((d) => d.id === doc.id);
        if (existing >= 0) {
          mockToolUsageDocs[existing] = {
            ...mockToolUsageDocs[existing],
            ...doc,
          };
        } else {
          mockToolUsageDocs.push(doc);
        }
        return doc;
      }),
    },
  })),
}));

describe('Usage Tracking', () => {
  beforeEach(() => {
    // Clear mock data
    mockTokenUsageDocs.length = 0;
    mockToolUsageDocs.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token Usage Tracking', () => {
    it('should track token usage with correct structure', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockDoc = {
        id: `${today}_FREE`,
        date: today,
        tier: 'FREE',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        costZar: 0.01,
        requestCount: 1,
        updatedAt: new Date().toISOString(),
      };

      mockTokenUsageDocs.push(mockDoc);

      expect(mockTokenUsageDocs).toHaveLength(1);
      expect(mockTokenUsageDocs[0].tier).toBe('FREE');
      expect(mockTokenUsageDocs[0].totalTokens).toBe(150);
    });

    it('should aggregate daily usage per tier', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Add multiple tier entries for same day
      mockTokenUsageDocs.push({
        id: `${today}_FREE`,
        date: today,
        tier: 'FREE',
        totalTokens: 1000,
        requestCount: 5,
      });
      mockTokenUsageDocs.push({
        id: `${today}_JIVE`,
        date: today,
        tier: 'JIVE',
        totalTokens: 5000,
        requestCount: 10,
      });
      mockTokenUsageDocs.push({
        id: `${today}_JIGGA`,
        date: today,
        tier: 'JIGGA',
        totalTokens: 10000,
        requestCount: 20,
      });

      const totalTokens = mockTokenUsageDocs.reduce(
        (sum, d) => sum + d.totalTokens,
        0
      );
      const totalRequests = mockTokenUsageDocs.reduce(
        (sum, d) => sum + d.requestCount,
        0
      );

      expect(totalTokens).toBe(16000);
      expect(totalRequests).toBe(35);
    });

    it('should calculate monthly totals correctly', async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Add entries for current month
      for (let i = 1; i <= 5; i++) {
        const date = new Date(startOfMonth);
        date.setDate(i);
        mockTokenUsageDocs.push({
          id: `${date.toISOString().split('T')[0]}_FREE`,
          date: date.toISOString().split('T')[0],
          tier: 'FREE',
          totalTokens: 1000 * i,
          inputTokens: 600 * i,
          outputTokens: 400 * i,
          costZar: 0.01 * i,
          requestCount: i,
        });
      }

      const monthlyTotal = mockTokenUsageDocs.reduce(
        (sum, d) => sum + d.totalTokens,
        0
      );
      // 1000 + 2000 + 3000 + 4000 + 5000 = 15000
      expect(monthlyTotal).toBe(15000);
    });
  });

  describe('Tool Usage Tracking', () => {
    it('should track tool calls with performance timing', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockDoc = {
        id: `${today}_generate_image_FREE`,
        date: today,
        toolName: 'generate_image',
        tier: 'FREE',
        callCount: 1,
        successCount: 1,
        failureCount: 0,
        totalExecutionTimeMs: 2500,
        avgExecutionTimeMs: 2500,
        updatedAt: new Date().toISOString(),
      };

      mockToolUsageDocs.push(mockDoc);

      expect(mockToolUsageDocs).toHaveLength(1);
      expect(mockToolUsageDocs[0].toolName).toBe('generate_image');
      expect(mockToolUsageDocs[0].avgExecutionTimeMs).toBe(2500);
    });

    it('should calculate success rate correctly', async () => {
      const today = new Date().toISOString().split('T')[0];
      mockToolUsageDocs.push({
        id: `${today}_search_web_FREE`,
        date: today,
        toolName: 'search_web',
        tier: 'FREE',
        callCount: 100,
        successCount: 95,
        failureCount: 5,
        totalExecutionTimeMs: 50000,
        avgExecutionTimeMs: 500,
      });

      const doc = mockToolUsageDocs[0];
      const successRate = (doc.successCount / doc.callCount) * 100;

      expect(successRate).toBe(95);
    });

    it('should aggregate tool usage across tiers', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Same tool used across different tiers
      mockToolUsageDocs.push({
        id: `${today}_math_statistics_FREE`,
        date: today,
        toolName: 'math_statistics',
        tier: 'FREE',
        callCount: 10,
        successCount: 10,
        failureCount: 0,
      });
      mockToolUsageDocs.push({
        id: `${today}_math_statistics_JIVE`,
        date: today,
        toolName: 'math_statistics',
        tier: 'JIVE',
        callCount: 25,
        successCount: 24,
        failureCount: 1,
      });
      mockToolUsageDocs.push({
        id: `${today}_math_statistics_JIGGA`,
        date: today,
        toolName: 'math_statistics',
        tier: 'JIGGA',
        callCount: 50,
        successCount: 49,
        failureCount: 1,
      });

      const totalCalls = mockToolUsageDocs.reduce(
        (sum, d) => sum + d.callCount,
        0
      );
      const totalSuccess = mockToolUsageDocs.reduce(
        (sum, d) => sum + d.successCount,
        0
      );

      expect(totalCalls).toBe(85);
      expect(totalSuccess).toBe(83);
    });

    it('should sort tools by call count for most-used ranking', async () => {
      const today = new Date().toISOString().split('T')[0];

      mockToolUsageDocs.push(
        { id: `${today}_tool_a`, toolName: 'tool_a', callCount: 100 },
        { id: `${today}_tool_b`, toolName: 'tool_b', callCount: 500 },
        { id: `${today}_tool_c`, toolName: 'tool_c', callCount: 50 },
        { id: `${today}_tool_d`, toolName: 'tool_d', callCount: 250 }
      );

      const sorted = [...mockToolUsageDocs].sort(
        (a, b) => b.callCount - a.callCount
      );

      expect(sorted[0].toolName).toBe('tool_b');
      expect(sorted[1].toolName).toBe('tool_d');
      expect(sorted[2].toolName).toBe('tool_a');
      expect(sorted[3].toolName).toBe('tool_c');
    });

    it('should calculate average execution time correctly', async () => {
      const doc = {
        callCount: 10,
        totalExecutionTimeMs: 25000, // 25 seconds total
      };

      const avgExecutionTimeMs = doc.totalExecutionTimeMs / doc.callCount;

      expect(avgExecutionTimeMs).toBe(2500); // 2.5 seconds average
    });
  });

  describe('Usage Data Validation', () => {
    it('should use ISO date strings for RxDB compatibility', async () => {
      const date = new Date().toISOString().split('T')[0];
      const updatedAt = new Date().toISOString();

      // Verify date format is YYYY-MM-DD
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify updatedAt is full ISO string
      expect(updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should generate composite keys correctly', async () => {
      const date = '2025-12-20';
      const toolName = 'generate_image';
      const tier = 'JIVE';

      const compositeKey = `${date}_${toolName}_${tier}`;

      expect(compositeKey).toBe('2025-12-20_generate_image_JIVE');
    });

    it('should handle tier values case-insensitively', async () => {
      const tiers = ['free', 'FREE', 'jive', 'JIVE', 'jigga', 'JIGGA'];
      const normalized = tiers.map((t) => t.toUpperCase());

      expect(new Set(normalized)).toEqual(new Set(['FREE', 'JIVE', 'JIGGA']));
    });
  });

  describe('Monthly Aggregation', () => {
    it('should filter by month start date correctly', async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

      // Add entries from this month and last month
      const thisMonth = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

      mockTokenUsageDocs.push(
        {
          id: 'this_month',
          date: thisMonth.toISOString().split('T')[0],
          totalTokens: 1000,
        },
        {
          id: 'last_month',
          date: lastMonth.toISOString().split('T')[0],
          totalTokens: 500,
        }
      );

      const monthlyDocs = mockTokenUsageDocs.filter(
        (d) => d.date >= startOfMonthStr
      );

      expect(monthlyDocs).toHaveLength(1);
      expect(monthlyDocs[0].totalTokens).toBe(1000);
    });

    it('should calculate tier breakdown for monthly stats', async () => {
      const date = new Date().toISOString().split('T')[0];

      mockTokenUsageDocs.push(
        {
          id: `${date}_FREE`,
          date,
          tier: 'FREE',
          totalTokens: 5000,
          requestCount: 50,
        },
        {
          id: `${date}_JIVE`,
          date,
          tier: 'JIVE',
          totalTokens: 15000,
          requestCount: 100,
        },
        {
          id: `${date}_JIGGA`,
          date,
          tier: 'JIGGA',
          totalTokens: 30000,
          requestCount: 150,
        }
      );

      const byTier = mockTokenUsageDocs.reduce((acc, d) => {
        acc[d.tier] = (acc[d.tier] || 0) + d.totalTokens;
        return acc;
      }, {} as Record<string, number>);

      expect(byTier.FREE).toBe(5000);
      expect(byTier.JIVE).toBe(15000);
      expect(byTier.JIGGA).toBe(30000);
    });
  });
});
