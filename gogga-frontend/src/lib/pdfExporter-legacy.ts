/**
 * GOGGA PDF Export Service
 * 
 * Comprehensive PDF export functionality using html2pdf.js
 * 
 * Features:
 * - Export current chat session
 * - Export specific chat by session ID
 * - Export full chat history across all sessions
 * - Include charts/graphs as embedded images
 * - Include generated AI images (thumbnails or full)
 * - Support for flowcharts (Mermaid diagrams)
 * - Styled with Gogga branding
 * - Sovereign AI privacy messaging
 * 
 * NOTE: PDF Export is a PREMIUM feature (JIVE/JIGGA only)
 * 
 * @see https://ekoopmans.github.io/html2pdf.js/
 */

// html2pdf.js is browser-only (uses 'self'), must be dynamically imported
// import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';
import {
  type ChatSession,
  type ChatMessage,
  type GeneratedImage,
  getChatSessions,
  getSessionMessages,
  getSession,
  getImage,
} from './db';

// Dynamic import helper for html2pdf (browser-only)
const getHtml2Pdf = async () => {
  if (typeof window === 'undefined') {
    throw new Error('html2pdf can only be used in browser environment');
  }
  const html2pdf = (await import('html2pdf.js')).default;
  return html2pdf;
};

// ============================================================================
// Types
// ============================================================================

export type ExportMode = 
  | 'current-session'      // Export current active chat session
  | 'single-session'       // Export a specific session by ID
  | 'full-history'         // Export all chat sessions
  | 'charts-only'          // Export only charts/graphs from session
  | 'transcript-only';     // Export plain text transcript

export interface ExportOptions {
  mode: ExportMode;
  sessionId?: string;              // For single-session mode
  includeCharts?: boolean;         // Include rendered charts (default: true)
  includeImages?: boolean;         // Include AI-generated images (default: true)
  includeThinking?: boolean;       // Include JIGGA thinking blocks (default: false)
  includeTimestamps?: boolean;     // Show message timestamps (default: true)
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  filename?: string;
  margin?: number | number[];      // In mm: single number, [v, h], or [top, left, bottom, right]
  userName?: string;               // User's name/email for export header
  userTier?: 'jive' | 'jigga';     // User's subscription tier (required - premium only)
}

export interface ExportResult {
  success: boolean;
  filename?: string;
  error?: string;
  pageCount?: number;
}

interface ChartCapture {
  messageIndex: number;
  imageData: string;
  title?: string;
}

// ============================================================================
// Constants
// ============================================================================

const GOGGA_STYLES = `
<style>
  /* Note: @import may not load in dynamically created containers
     Using a web-safe fallback font stack for reliability */
  
  * {
    font-family: 'Quicksand', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    box-sizing: border-box;
  }
  
  body {
    margin: 0;
    padding: 20px;
    background: #ffffff;
    color: #1a1a1a;
    line-height: 1.6;
  }
  
  .pdf-container {
    max-width: 100%;
    margin: 0 auto;
  }
  
  .pdf-header {
    text-align: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e5e5e5;
  }
  
  .pdf-logo {
    font-size: 28px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 5px;
  }
  
  .pdf-subtitle {
    font-size: 14px;
    color: #666;
  }
  
  .pdf-session-info {
    background: #f9fafb;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  
  .pdf-session-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  
  .pdf-session-meta {
    font-size: 12px;
    color: #666;
  }
  
  .message {
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  
  .message-user {
    display: flex;
    justify-content: flex-end;
  }
  
  .message-assistant {
    display: flex;
    justify-content: flex-start;
  }
  
  .message-content {
    max-width: 85%;
    padding: 12px 16px;
    border-radius: 12px;
    position: relative;
  }
  
  .message-user .message-content {
    background: #1a1a1a;
    color: #ffffff;
    border-bottom-right-radius: 4px;
  }
  
  .message-assistant .message-content {
    background: #f3f4f6;
    color: #1a1a1a;
    border-bottom-left-radius: 4px;
  }
  
  .message-role {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 4px;
    opacity: 0.7;
  }
  
  .message-timestamp {
    font-size: 10px;
    opacity: 0.5;
    margin-top: 6px;
  }
  
  .thinking-block {
    background: #fef3c7;
    border-left: 3px solid #f59e0b;
    padding: 10px;
    margin-top: 10px;
    font-size: 12px;
    font-style: italic;
  }
  
  .thinking-label {
    font-weight: 600;
    font-size: 11px;
    color: #b45309;
    margin-bottom: 5px;
  }
  
  .chart-container {
    page-break-inside: avoid;
    margin: 15px 0;
    text-align: center;
  }
  
  .chart-image {
    max-width: 100%;
    height: auto;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
  }
  
  .chart-title {
    font-size: 12px;
    color: #666;
    margin-top: 8px;
  }
  
  .ai-image-container {
    page-break-inside: avoid;
    margin: 15px 0;
    text-align: center;
  }
  
  .ai-image {
    max-width: 100%;
    max-height: 400px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  .ai-image-caption {
    font-size: 11px;
    color: #666;
    margin-top: 8px;
    font-style: italic;
  }
  
  .session-divider {
    page-break-before: always;
    margin: 40px 0 20px;
    padding-top: 20px;
    border-top: 3px solid #e5e5e5;
  }
  
  .page-footer {
    position: fixed;
    bottom: 10px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 10px;
    color: #999;
  }
  
  .sovereign-banner {
    background: linear-gradient(135deg, #1a1a1a 0%, #374151 100%);
    color: #ffffff;
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 25px;
    text-align: center;
  }
  
  .sovereign-banner h2 {
    margin: 0 0 10px 0;
    font-size: 16px;
    color: #10b981;
  }
  
  .sovereign-banner p {
    margin: 5px 0;
    font-size: 12px;
    opacity: 0.9;
  }
  
  .sovereign-badge {
    display: inline-block;
    background: #10b981;
    color: #ffffff;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    margin-top: 10px;
  }
  
  .export-meta {
    text-align: right;
    font-size: 11px;
    color: #666;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px dashed #e5e5e5;
  }
  
  code {
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.9em;
  }
  
  pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.5;
  }
  
  pre code {
    background: transparent;
    padding: 0;
    color: inherit;
  }
  
  blockquote {
    border-left: 4px solid #e5e5e5;
    margin: 10px 0;
    padding-left: 15px;
    color: #666;
    font-style: italic;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
  }
  
  th, td {
    border: 1px solid #e5e5e5;
    padding: 8px 12px;
    text-align: left;
  }
  
  th {
    background: #f9fafb;
    font-weight: 600;
  }
  
  h1, h2, h3, h4, h5, h6 {
    margin: 15px 0 10px;
    font-weight: 600;
  }
  
  ul, ol {
    margin: 10px 0;
    padding-left: 25px;
  }
  
  li {
    margin: 5px 0;
  }
  
  a {
    color: #2563eb;
    text-decoration: underline;
  }
</style>
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m] ?? m);
}

/**
 * Convert markdown to simple HTML for PDF rendering
 * Note: This is a simplified converter - for complex markdown, 
 * consider using marked.js or react-markdown's output
 */
function markdownToHtml(markdown: string): string {
  let html = escapeHtml(markdown);
  
  // Code blocks (```code```)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  
  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Italic (*text* or _text_)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Headers (# to ######)
  html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  
  // Blockquotes (> text)
  html = html.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
  
  // Unordered lists (- item or * item)
  html = html.replace(/^[\-\*] (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in paragraph if not already wrapped
  if (!html.startsWith('<')) {
    html = '<p>' + html + '</p>';
  }
  
  return html;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Extract chart data from message content
 */
function extractChartData(content: string): { chartJson: string; textContent: string }[] {
  const results: { chartJson: string; textContent: string }[] = [];
  
  // Normalize chart markers
  const normalizedContent = content.replace(/TOOL_CHART:/g, '__TOOL_CHART__:');
  const parts = normalizedContent.split('__TOOL_CHART__:');
  
  parts.forEach((part, idx) => {
    if (idx === 0) return; // Skip text before first marker
    
    const newlineIdx = part.indexOf('\n');
    const jsonStr = newlineIdx > 0 ? part.slice(0, newlineIdx) : part;
    const textAfter = newlineIdx > 0 ? part.slice(newlineIdx + 1).trim() : '';
    
    results.push({
      chartJson: jsonStr,
      textContent: textAfter,
    });
  });
  
  return results;
}

/**
 * Capture chart elements from DOM as images
 */
export async function captureChartElements(containerSelector: string = '.recharts-wrapper'): Promise<ChartCapture[]> {
  const captures: ChartCapture[] = [];
  const elements = document.querySelectorAll(containerSelector);
  
  for (let i = 0; i < elements.length; i++) {
    try {
      const element = elements[i] as HTMLElement;
      const canvas = await html2canvas(element, {
        scale: 2, // High quality
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      captures.push({
        messageIndex: i,
        imageData: canvas.toDataURL('image/png'),
        title: element.closest('.chart-container')?.querySelector('.chart-title')?.textContent || undefined,
      });
    } catch (err) {
      console.warn(`Failed to capture chart ${i}:`, err);
    }
  }
  
  return captures;
}

/**
 * Clean message content of tool markers for transcript
 */
function cleanMessageContent(content: string): string {
  // Remove tool markers
  let cleaned = content.replace(/__TOOL_CHART__:[^\n]*/g, '[Chart]');
  cleaned = cleaned.replace(/TOOL_CHART:[^\n]*/g, '[Chart]');
  cleaned = cleaned.replace(/__TOOL_IMAGES__:[^\n]*/g, '[Generated Image]');
  cleaned = cleaned.replace(/__TOOL_MATH__:[^\n]*/g, '[Math Result]');
  
  return cleaned.trim();
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Build HTML content for PDF export
 */
async function buildPdfHtml(
  sessions: ChatSession[],
  messages: Map<string, ChatMessage[]>,
  images: Map<number, GeneratedImage>,
  chartCaptures: Map<string, ChartCapture[]>,
  options: ExportOptions
): Promise<string> {
  const {
    includeCharts = true,
    includeImages = true,
    includeThinking = false,
    includeTimestamps = true,
    userName = 'GOGGA User',
    userTier = 'jive',
  } = options;
  
  console.log('[PDF buildPdfHtml] Building HTML for', sessions.length, 'sessions');
  console.log('[PDF buildPdfHtml] Messages map size:', messages.size);
  
  // Log message counts per session
  sessions.forEach(s => {
    const msgs = messages.get(s.id!) || [];
    console.log(`[PDF buildPdfHtml] Session "${s.title}" (${s.id}): ${msgs.length} messages`);
  });
  
  const exportDate = formatTimestamp(new Date());
  const tierDisplay = userTier.toUpperCase();
  
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gogga Chat Export</title>
  ${GOGGA_STYLES}
</head>
<body>
  <div class="pdf-container">
    <!-- Sovereign AI Banner -->
    <div class="sovereign-banner">
      <h2>🔒 Your Data, Your Control</h2>
      <p>This chat history was extracted directly from your browser's local storage.</p>
      <p>GOGGA never stores your conversations on external servers.</p>
      <p><strong>Congratulations on choosing Sovereign AI! 🇿🇦</strong></p>
      <span class="sovereign-badge">100% Privacy-First South African AI</span>
    </div>
    
    <!-- Export Metadata -->
    <div class="export-meta">
      <strong>Exported by:</strong> ${escapeHtml(userName)} | 
      <strong>Tier:</strong> ${tierDisplay} | 
      <strong>Date:</strong> ${exportDate}
    </div>
    
    <div class="pdf-header">
      <div class="pdf-logo">🦗 GOGGA</div>
      <div class="pdf-subtitle">South Africa's AI Assistant</div>
      <div class="pdf-subtitle">Chat Export - ${formatTimestamp(new Date())}</div>
    </div>
`;
  
  // Add each session
  sessions.forEach((session, sessionIdx) => {
    const sessionMessages = messages.get(session.id!) || [];
    const sessionCharts = chartCaptures.get(session.id!) || [];
    
    if (sessionIdx > 0) {
      html += '<div class="session-divider"></div>';
    }
    
    // Session info
    html += `
    <div class="pdf-session-info">
      <div class="pdf-session-title">${escapeHtml(session.title)}</div>
      <div class="pdf-session-meta">
        Tier: ${session.tier.toUpperCase()} | 
        Messages: ${sessionMessages.length} | 
        Created: ${formatTimestamp(session.createdAt)}
      </div>
    </div>
`;
    
    // Messages
    sessionMessages.forEach((msg, msgIdx) => {
      const isUser = msg.role === 'user';
      const roleLabel = isUser ? 'You' : 'Gogga';
      const cleanedContent = cleanMessageContent(msg.content);
      
      html += `
    <div class="message message-${msg.role}">
      <div class="message-content">
        <div class="message-role">${roleLabel}</div>
        <div class="message-text">${markdownToHtml(cleanedContent)}</div>
`;
      
      // Include thinking block for JIGGA
      if (includeThinking && msg.thinking) {
        html += `
        <div class="thinking-block">
          <div class="thinking-label">💭 Thinking Process</div>
          ${markdownToHtml(msg.thinking)}
        </div>
`;
      }
      
      // Include charts
      if (includeCharts && (msg.content.includes('__TOOL_CHART__:') || msg.content.includes('TOOL_CHART:'))) {
        const charts = extractChartData(msg.content);
        const relevantCaptures = sessionCharts.filter(c => c.messageIndex === msgIdx);
        
        relevantCaptures.forEach((capture, chartIdx) => {
          html += `
        <div class="chart-container">
          <img src="${capture.imageData}" alt="Chart ${chartIdx + 1}" class="chart-image" />
          ${capture.title ? `<div class="chart-title">${escapeHtml(capture.title)}</div>` : ''}
        </div>
`;
        });
      }
      
      // Include AI-generated images
      if (includeImages && msg.imageId) {
        const image = images.get(msg.imageId);
        if (image && !image.isDeleted) {
          html += `
        <div class="ai-image-container">
          <img src="${image.thumbnailData}" alt="AI Generated" class="ai-image" />
          <div class="ai-image-caption">${escapeHtml(image.prompt)}</div>
        </div>
`;
        }
      }
      
      // Timestamp
      if (includeTimestamps) {
        html += `
        <div class="message-timestamp">${formatTimestamp(msg.timestamp)}</div>
`;
      }
      
      html += `
      </div>
    </div>
`;
    });
  });
  
  // Check if we actually have any message content
  const totalMessages = Array.from(messages.values()).flat().length;
  if (totalMessages === 0) {
    console.warn('[PDF buildPdfHtml] No messages found in any session!');
    html += `
    <div class="message">
      <div class="message-content" style="text-align: center; color: #666;">
        <p>No messages found in this chat session.</p>
      </div>
    </div>
`;
  }
  
  html += `
  </div>
</body>
</html>
`;
  
  console.log('[PDF buildPdfHtml] Final HTML length:', html.length);
  
  return html;
}

/**
 * Export chat to PDF
 */
export async function exportChatToPdf(options: ExportOptions): Promise<ExportResult> {
  try {
    const {
      mode,
      sessionId,
      pageSize = 'a4',
      orientation = 'portrait',
      filename,
      margin = 10,
      userTier,
    } = options;
    
    // Premium tier check - PDF export is JIVE/JIGGA only
    if (!userTier || (userTier !== 'jive' && userTier !== 'jigga')) {
      console.error('[PDF Export] Premium feature - tier required');
      return { 
        success: false, 
        error: 'PDF Export is a premium feature. Upgrade to JIVE or JIGGA to export your chats.' 
      };
    }
    
    console.log('[PDF Export] Starting export with options:', { mode, sessionId, pageSize, orientation, userTier });
    
    // Collect sessions based on mode
    let sessions: ChatSession[] = [];
    
    if (mode === 'current-session' || mode === 'single-session') {
      if (!sessionId) {
        console.error('[PDF Export] No sessionId provided');
        return { success: false, error: 'Session ID required for this export mode' };
      }
      console.log('[PDF Export] Fetching session:', sessionId);
      const session = await getSession(sessionId);
      console.log('[PDF Export] Session result:', session);
      if (!session) {
        console.error('[PDF Export] Session not found:', sessionId);
        return { success: false, error: 'Session not found' };
      }
      sessions = [session];
    } else if (mode === 'full-history') {
      sessions = await getChatSessions();
      console.log('[PDF Export] Full history sessions count:', sessions.length);
      if (sessions.length === 0) {
        return { success: false, error: 'No chat sessions found' };
      }
    }
    
    // Collect messages for each session
    const messagesMap = new Map<string, ChatMessage[]>();
    for (const session of sessions) {
      const sessionMessages = await getSessionMessages(session.id!);
      console.log(`[PDF Export] Session ${session.id} has ${sessionMessages.length} messages`);
      messagesMap.set(session.id!, sessionMessages);
    }
    
    // Collect images referenced in messages
    const imagesMap = new Map<number, GeneratedImage>();
    for (const [, msgs] of messagesMap) {
      for (const msg of msgs) {
        if (msg.imageId) {
          const image = await getImage(msg.imageId);
          if (image) {
            imagesMap.set(msg.imageId, image);
          }
        }
      }
    }
    
    // Try to capture charts from DOM (if currently displayed)
    const chartCaptures = new Map<string, ChartCapture[]>();
    if (options.includeCharts !== false) {
      try {
        // Capture all visible charts
        const captures = await captureChartElements();
        console.log('[PDF Export] Captured charts:', captures.length);
        // Associate with current session if single session mode
        const firstSession = sessions[0];
        if (sessions.length === 1 && captures.length > 0 && firstSession?.id) {
          chartCaptures.set(firstSession.id, captures);
        }
      } catch (err) {
        console.warn('Could not capture charts from DOM:', err);
      }
    }
    
    // Build HTML
    const html = await buildPdfHtml(sessions, messagesMap, imagesMap, chartCaptures, options);
    console.log('[PDF Export] Generated HTML length:', html.length);
    console.log('[PDF Export] HTML preview (first 500 chars):', html.substring(0, 500));
    
    // Generate filename
    const firstSession = sessions[0];
    const defaultFilename = mode === 'full-history'
      ? `gogga-chat-history-${new Date().toISOString().split('T')[0]}.pdf`
      : `gogga-chat-${(firstSession?.title ?? 'chat').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
    
    const finalFilename = filename || defaultFilename;
    
    // Configure html2pdf options
    const pdfOptions = {
      margin: margin,
      filename: finalFilename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 1, // Reduce scale to avoid canvas size limits
        useCORS: true,
        logging: true, // Enable logging for debugging
        letterRendering: true,
        backgroundColor: '#ffffff',
        // Critical: Set window dimensions to match content
        // This prevents blank PDFs from canvas size limitations
        windowWidth: orientation === 'portrait' ? 794 : 1123,
        windowHeight: 1000, // Will be calculated per-page by html2pdf
      },
      jsPDF: {
        unit: 'mm' as const,
        format: pageSize,
        orientation: orientation,
      },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy'],
        before: '.session-divider',
        avoid: ['.message', '.chart-container', '.ai-image-container'],
      },
    };
    
    // Create temporary container for HTML
    const container = document.createElement('div');
    container.innerHTML = html;
    // Position off-screen but still in the render flow
    // Using opacity:0 instead of visibility:hidden since html2canvas
    // needs the element to be in the render tree
    container.style.position = 'absolute';
    container.style.top = '-99999px';
    container.style.left = '0';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    container.style.width = orientation === 'portrait' ? '794px' : '1123px'; // A4 at 96dpi
    container.style.background = '#ffffff';
    document.body.appendChild(container);
    
    // Wait for fonts to load and layout to complete
    await new Promise<void>((resolve) => {
      // Use requestAnimationFrame to ensure layout is done
      requestAnimationFrame(() => {
        // Additional small delay for font loading
        setTimeout(resolve, 100);
      });
    });
    
    console.log('[PDF Export] Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);
    console.log('[PDF Export] Container childNodes:', container.childNodes.length);
    console.log('[PDF Export] Container first child:', container.firstChild?.nodeName);
    
    // Generate PDF (dynamic import for browser-only library)
    const html2pdf = await getHtml2Pdf();
    await html2pdf()
      .set(pdfOptions)
      .from(container)
      .save();
    
    // Cleanup
    document.body.removeChild(container);
    
    return {
      success: true,
      filename: finalFilename,
    };
  } catch (error) {
    console.error('PDF export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during PDF export',
    };
  }
}

/**
 * Export only charts from current view as PDF
 */
export async function exportChartsToPdf(
  filename: string = 'gogga-charts.pdf'
): Promise<ExportResult> {
  try {
    const captures = await captureChartElements();
    
    if (captures.length === 0) {
      return { success: false, error: 'No charts found to export' };
    }
    
    // Build HTML with just charts
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Gogga Charts Export</title>
  ${GOGGA_STYLES}
</head>
<body>
  <div class="pdf-container">
    <div class="pdf-header">
      <div class="pdf-logo">🦗 GOGGA</div>
      <div class="pdf-subtitle">Charts Export - ${formatTimestamp(new Date())}</div>
    </div>
`;
    
    captures.forEach((capture, idx) => {
      html += `
    <div class="chart-container" style="page-break-inside: avoid; margin: 20px 0;">
      <img src="${capture.imageData}" alt="Chart ${idx + 1}" class="chart-image" style="max-width: 100%;" />
      ${capture.title ? `<div class="chart-title">${escapeHtml(capture.title)}</div>` : ''}
    </div>
`;
    });
    
    html += `
  </div>
</body>
</html>
`;
    
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '210mm';
    document.body.appendChild(container);
    
    const html2pdf = await getHtml2Pdf();
    await html2pdf()
      .set({
        margin: 15,
        filename: filename,
        image: { type: 'png' as const, quality: 1 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: 'avoid-all' },
      })
      .from(container)
      .save();
    
    document.body.removeChild(container);
    
    return {
      success: true,
      filename: filename,
      pageCount: captures.length,
    };
  } catch (error) {
    console.error('Charts export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export plain text transcript (no formatting)
 */
export async function exportTranscript(
  sessionId: string,
  filename?: string
): Promise<ExportResult> {
  try {
    const session = await getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    const messages = await getSessionMessages(sessionId);
    
    let transcript = `GOGGA CHAT TRANSCRIPT\n`;
    transcript += `${'='.repeat(50)}\n`;
    transcript += `Session: ${session.title}\n`;
    transcript += `Tier: ${session.tier.toUpperCase()}\n`;
    transcript += `Date: ${formatTimestamp(session.createdAt)}\n`;
    transcript += `${'='.repeat(50)}\n\n`;
    
    messages.forEach((msg) => {
      const role = msg.role === 'user' ? 'YOU' : 'GOGGA';
      const cleanContent = cleanMessageContent(msg.content);
      transcript += `[${formatTimestamp(msg.timestamp)}] ${role}:\n`;
      transcript += `${cleanContent}\n\n`;
    });
    
    transcript += `${'='.repeat(50)}\n`;
    transcript += `Exported: ${formatTimestamp(new Date())}\n`;
    
    // Create downloadable text file
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `gogga-transcript-${session.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      filename: a.download,
    };
  } catch (error) {
    console.error('Transcript export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Capture specific element to PDF (for custom exports)
 */
export async function captureElementToPdf(
  element: HTMLElement,
  filename: string = 'gogga-export.pdf',
  options?: Partial<ExportOptions>
): Promise<ExportResult> {
  try {
    const {
      pageSize = 'a4',
      orientation = 'portrait',
      margin = 10,
    } = options || {};
    
    const html2pdf = await getHtml2Pdf();
    await html2pdf()
      .set({
        margin: margin,
        filename: filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
        },
        jsPDF: {
          unit: 'mm' as const,
          format: pageSize,
          orientation: orientation,
        },
        pagebreak: { mode: 'avoid-all' },
      })
      .from(element)
      .save();
    
    return {
      success: true,
      filename: filename,
    };
  } catch (error) {
    console.error('Element capture failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick export of current session with all content
 */
export async function quickExportCurrentSession(sessionId: string): Promise<ExportResult> {
  return exportChatToPdf({
    mode: 'current-session',
    sessionId,
    includeCharts: true,
    includeImages: true,
    includeThinking: false,
    includeTimestamps: true,
    pageSize: 'a4',
    orientation: 'portrait',
  });
}

/**
 * Export full chat history to PDF
 */
export async function exportFullHistory(): Promise<ExportResult> {
  return exportChatToPdf({
    mode: 'full-history',
    includeCharts: true,
    includeImages: true,
    includeThinking: false,
    includeTimestamps: true,
    pageSize: 'a4',
    orientation: 'portrait',
  });
}
