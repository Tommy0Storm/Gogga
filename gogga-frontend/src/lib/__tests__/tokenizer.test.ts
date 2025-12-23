/**
 * Tokenizer Tests
 * 
 * Unit tests for token counting utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  countTokens,
  countTokensWithLimit,
  isWithinBudget,
  estimateTokens,
  canSendMessage,
  calculateContextUsage,
  formatTokenCount,
  TOKEN_BUDGETS,
} from '../tokenizer';

describe('Token Counting', () => {
  describe('countTokens', () => {
    it('should count tokens in simple text', () => {
      const count = countTokens('Hello, world!');
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });

    it('should return 0 for empty string', () => {
      expect(countTokens('')).toBe(0);
    });

    it('should handle longer text', () => {
      const text = 'The quick brown fox jumps over the lazy dog. ' +
        'This is a longer sentence to test token counting accuracy.';
      const count = countTokens(text);
      expect(count).toBeGreaterThan(10);
      expect(count).toBeLessThan(50);
    });

    it('should count tokens for South African content', () => {
      const text = 'Sawubona! Unjani? I need help with SASSA R350 grant application.';
      const count = countTokens(text);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('countTokensWithLimit', () => {
    it('should indicate when within limit', () => {
      const result = countTokensWithLimit('Hello', 100);
      expect(result.exceedsLimit).toBe(false);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should indicate when exceeding limit', () => {
      const longText = 'word '.repeat(100);
      const result = countTokensWithLimit(longText, 10);
      expect(result.exceedsLimit).toBe(true);
      expect(result.remaining).toBeLessThan(0);
    });
  });

  describe('isWithinBudget', () => {
    it('should check against tier budget', () => {
      const result = isWithinBudget('Hello!', 'free', 'volatile');
      expect(result.limit).toBe(TOKEN_BUDGETS.free.volatile);
      expect(result.exceedsLimit).toBe(false);
    });

    it('should use correct budget for JIGGA tier', () => {
      const result = isWithinBudget('Test', 'jigga', 'rag');
      expect(result.limit).toBe(TOKEN_BUDGETS.jigga.rag);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens and cost for free tier', () => {
      const estimate = estimateTokens('Hello, Gogga!', 500, 'free');
      expect(estimate.inputTokens).toBeGreaterThan(0);
      expect(estimate.outputTokens).toBe(500);
      expect(estimate.estimatedCostZar).toBe(0); // Free tier = no cost
    });

    it('should estimate cost for paid tier', () => {
      const estimate = estimateTokens('Hello, Gogga!', 1000, 'jive');
      expect(estimate.estimatedCostZar).toBeGreaterThan(0);
      expect(estimate.tier).toBe('jive');
    });
  });

  describe('canSendMessage', () => {
    it('should allow small message', () => {
      const result = canSendMessage('Hello!', 'jive', 0);
      expect(result.canSend).toBe(true);
      expect(result.remainingBudget).toBeGreaterThan(0);
    });

    it('should reject when budget exhausted', () => {
      const longText = 'word '.repeat(2000); // ~2000 tokens
      const result = canSendMessage(longText, 'free', 3500);
      expect(result.canSend).toBe(false);
      expect(result.reason).toContain('exceeds remaining budget');
    });
  });

  describe('calculateContextUsage', () => {
    it('should calculate total usage', () => {
      const usage = {
        systemPrompt: 400,
        state: 500,
        volatile: 1000,
      };
      const result = calculateContextUsage(usage, 'free');
      expect(result.totalUsed).toBe(1900);
      expect(result.utilizationPercent).toBeGreaterThan(0);
    });

    it('should detect over-budget categories', () => {
      const usage = {
        systemPrompt: 1000, // Over free tier limit of 500
      };
      const result = calculateContextUsage(usage, 'free');
      expect(result.categories.systemPrompt.exceedsLimit).toBe(true);
    });
  });

  describe('formatTokenCount', () => {
    it('should format small numbers', () => {
      expect(formatTokenCount(42)).toBe('42');
      expect(formatTokenCount(999)).toBe('999');
    });

    it('should format thousands with K suffix', () => {
      expect(formatTokenCount(1500)).toBe('1.5K');
      expect(formatTokenCount(15000)).toBe('15K');
    });
  });
});

describe('TOKEN_BUDGETS', () => {
  it('should have all tiers defined', () => {
    expect(TOKEN_BUDGETS.free).toBeDefined();
    expect(TOKEN_BUDGETS.jive).toBeDefined();
    expect(TOKEN_BUDGETS.jigga).toBeDefined();
  });

  it('should have increasing budgets for higher tiers', () => {
    expect(TOKEN_BUDGETS.jive.total).toBeGreaterThan(TOKEN_BUDGETS.free.total);
    expect(TOKEN_BUDGETS.jigga.total).toBeGreaterThan(TOKEN_BUDGETS.jive.total);
  });

  it('should have FREE tier with zero RAG budget', () => {
    expect(TOKEN_BUDGETS.free.rag).toBe(0);
  });
});
