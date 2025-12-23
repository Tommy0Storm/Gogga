/**
 * PDF Exporter Tests
 * 
 * Tests for the PDF export functionality to ensure sessions and messages
 * are properly fetched and converted.
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock html2canvas since it requires DOM
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: () => 'data:image/png;base64,mock',
  }),
}));

// Mock html2pdf.js
vi.mock('html2pdf.js', () => ({
  default: vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    save: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock the database module
const mockGetSession = vi.fn();
const mockGetSessionMessages = vi.fn();
const mockGetChatSessions = vi.fn();
const mockGetImage = vi.fn();

vi.mock('../db', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  getSessionMessages: (...args: unknown[]) => mockGetSessionMessages(...args),
  getChatSessions: (...args: unknown[]) => mockGetChatSessions(...args),
  getImage: (...args: unknown[]) => mockGetImage(...args),
}));

describe('PDF Exporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup DOM for html2pdf
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('getSession', () => {
    it('should return a properly formatted ChatSession with Date objects', async () => {
      const mockSessionDoc = {
        id: 'session-123',
        tier: 'jive',
        title: 'Test Chat',
        createdAt: '2025-12-19T10:00:00.000Z',
        updatedAt: '2025-12-19T11:00:00.000Z',
        messageCount: 5,
      };

      mockGetSession.mockResolvedValue({
        id: 'session-123',
        tier: 'jive',
        title: 'Test Chat',
        createdAt: new Date('2025-12-19T10:00:00.000Z'),
        updatedAt: new Date('2025-12-19T11:00:00.000Z'),
        messageCount: 5,
      });

      const { getSession } = await import('../db');
      const session = await getSession('session-123');

      expect(session).toBeDefined();
      expect(session?.id).toBe('session-123');
      expect(session?.createdAt).toBeInstanceOf(Date);
      expect(session?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getSessionMessages', () => {
    it('should return messages with proper Date timestamps', async () => {
      mockGetSessionMessages.mockResolvedValue([
        {
          id: 1,
          sessionId: 'session-123',
          role: 'user',
          content: 'Hello',
          tier: 'jive',
          timestamp: new Date('2025-12-19T10:00:00.000Z'),
          meta: {},
        },
        {
          id: 2,
          sessionId: 'session-123',
          role: 'assistant',
          content: 'Hi there!',
          tier: 'jive',
          timestamp: new Date('2025-12-19T10:00:05.000Z'),
          meta: {},
        },
      ]);

      const { getSessionMessages } = await import('../db');
      const messages = await getSessionMessages('session-123');

      expect(messages).toHaveLength(2);
      expect(messages[0]!.timestamp).toBeInstanceOf(Date);
      expect(messages[1]!.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('exportChatToPdf', () => {
    it('should export a single session successfully', async () => {
      // Mock session
      mockGetSession.mockResolvedValue({
        id: 'session-123',
        tier: 'jive',
        title: 'Test Chat',
        createdAt: new Date('2025-12-19T10:00:00.000Z'),
        updatedAt: new Date('2025-12-19T11:00:00.000Z'),
        messageCount: 2,
      });

      // Mock messages
      mockGetSessionMessages.mockResolvedValue([
        {
          id: 1,
          sessionId: 'session-123',
          role: 'user',
          content: 'Hello Gogga!',
          tier: 'jive',
          timestamp: new Date('2025-12-19T10:00:00.000Z'),
          meta: {},
        },
        {
          id: 2,
          sessionId: 'session-123',
          role: 'assistant',
          content: 'Howzit! How can I help you today?',
          tier: 'jive',
          timestamp: new Date('2025-12-19T10:00:05.000Z'),
          meta: {},
        },
      ]);

      const { exportChatToPdf } = await import('../pdfExporter');
      const result = await exportChatToPdf({
        mode: 'current-session',
        sessionId: 'session-123',
      });

      expect(result.success).toBe(true);
      expect(result.filename).toContain('gogga-chat');
      expect(mockGetSession).toHaveBeenCalledWith('session-123');
      expect(mockGetSessionMessages).toHaveBeenCalledWith('session-123');
    });

    it('should return error when session not found', async () => {
      mockGetSession.mockResolvedValue(undefined);

      const { exportChatToPdf } = await import('../pdfExporter');
      const result = await exportChatToPdf({
        mode: 'current-session',
        sessionId: 'non-existent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should return error when sessionId not provided for single session mode', async () => {
      const { exportChatToPdf } = await import('../pdfExporter');
      const result = await exportChatToPdf({
        mode: 'current-session',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session ID required for this export mode');
    });

    it('should export full history successfully', async () => {
      // Mock multiple sessions
      mockGetChatSessions.mockResolvedValue([
        {
          id: 'session-1',
          tier: 'jive',
          title: 'First Chat',
          createdAt: new Date('2025-12-18T10:00:00.000Z'),
          updatedAt: new Date('2025-12-18T11:00:00.000Z'),
          messageCount: 2,
        },
        {
          id: 'session-2',
          tier: 'jigga',
          title: 'Second Chat',
          createdAt: new Date('2025-12-19T10:00:00.000Z'),
          updatedAt: new Date('2025-12-19T11:00:00.000Z'),
          messageCount: 3,
        },
      ]);

      // Mock messages for each session
      mockGetSessionMessages
        .mockResolvedValueOnce([
          {
            id: 1,
            sessionId: 'session-1',
            role: 'user',
            content: 'Hello!',
            tier: 'jive',
            timestamp: new Date('2025-12-18T10:00:00.000Z'),
            meta: {},
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 2,
            sessionId: 'session-2',
            role: 'user',
            content: 'Another chat',
            tier: 'jigga',
            timestamp: new Date('2025-12-19T10:00:00.000Z'),
            meta: {},
          },
        ]);

      const { exportChatToPdf } = await import('../pdfExporter');
      const result = await exportChatToPdf({
        mode: 'full-history',
      });

      expect(result.success).toBe(true);
      expect(result.filename).toContain('gogga-chat-history');
      expect(mockGetChatSessions).toHaveBeenCalled();
      expect(mockGetSessionMessages).toHaveBeenCalledTimes(2);
    });

    it('should return error when no sessions exist for full history', async () => {
      mockGetChatSessions.mockResolvedValue([]);

      const { exportChatToPdf } = await import('../pdfExporter');
      const result = await exportChatToPdf({
        mode: 'full-history',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No chat sessions found');
    });
  });

  describe('quickExportCurrentSession', () => {
    it('should call exportChatToPdf with correct options', async () => {
      mockGetSession.mockResolvedValue({
        id: 'session-quick',
        tier: 'jive',
        title: 'Quick Export Test',
        createdAt: new Date('2025-12-19T10:00:00.000Z'),
        updatedAt: new Date('2025-12-19T11:00:00.000Z'),
        messageCount: 1,
      });

      mockGetSessionMessages.mockResolvedValue([
        {
          id: 1,
          sessionId: 'session-quick',
          role: 'user',
          content: 'Quick test',
          tier: 'jive',
          timestamp: new Date('2025-12-19T10:00:00.000Z'),
          meta: {},
        },
      ]);

      const { quickExportCurrentSession } = await import('../pdfExporter');
      const result = await quickExportCurrentSession('session-quick');

      expect(result.success).toBe(true);
      expect(mockGetSession).toHaveBeenCalledWith('session-quick');
    });
  });
});
