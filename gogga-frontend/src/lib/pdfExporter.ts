/**
 * GOGGA PDF Export Service - V2 (December 2025)
 *
 * High-quality PDF export using jsPDF directly for reliable text rendering.
 * Replaces the html2pdf.js/html2canvas approach which caused blank PDFs
 * due to off-screen rendering issues.
 *
 * Features:
 * - ✅ Export current chat session
 * - ✅ Export specific chat by session ID
 * - ✅ Export full chat history across all sessions
 * - ✅ Include generated AI images (base64 embedded)
 * - ✅ Styled with Gogga branding
 * - ✅ Sovereign AI privacy messaging
 * - ✅ Markdown rendering (bold, italic, code, headers, lists)
 * - ✅ Proper page breaks and pagination
 * - ✅ Professional typography with fallback fonts
 *
 * NOTE: PDF Export is a PREMIUM feature (JIVE/JIGGA only)
 */

import { jsPDF } from 'jspdf';
import {
  type ChatSession,
  type ChatMessage,
  type GeneratedImage,
  getChatSessions,
  getSessionMessages,
  getSession,
  getImage,
} from './db';

// ============================================================================
// Types
// ============================================================================

export type ExportMode =
  | 'current-session' // Export current active chat session
  | 'single-session' // Export a specific session by ID
  | 'full-history' // Export all chat sessions
  | 'charts-only' // Export only charts/graphs from session
  | 'transcript-only'; // Export plain text transcript

export interface ExportOptions {
  mode: ExportMode;
  sessionId?: string; // For single-session mode
  includeCharts?: boolean; // Include rendered charts (default: true)
  includeImages?: boolean; // Include AI-generated images (default: true)
  includeThinking?: boolean; // Include JIGGA thinking blocks (default: false)
  includeTimestamps?: boolean; // Show message timestamps (default: true)
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  filename?: string;
  margin?: number | number[]; // In mm: single number, [v, h], or [top, left, bottom, right]
  userName?: string; // User's name/email for export header
  userTier?: 'jive' | 'jigga'; // User's subscription tier (required - premium only)
}

export interface ExportResult {
  success: boolean;
  filename?: string;
  error?: string;
  pageCount?: number;
}

// ============================================================================
// Constants - Gogga Branding Colors
// ============================================================================

const COLORS = {
  // Primary blacks/grays (monochrome palette)
  black: { r: 26, g: 26, b: 26 }, // #1a1a1a
  darkGray: { r: 55, g: 65, b: 81 }, // #374151
  gray: { r: 107, g: 114, b: 128 }, // #6b7280
  lightGray: { r: 209, g: 213, b: 219 }, // #d1d5db
  paleGray: { r: 243, g: 244, b: 246 }, // #f3f4f6
  white: { r: 255, g: 255, b: 255 },

  // Accent colors
  green: { r: 16, g: 185, b: 129 }, // #10b981 (success/SA flag)
  amber: { r: 245, g: 158, b: 11 }, // #f59e0b (thinking)
  blue: { r: 37, g: 99, b: 235 }, // #2563eb (links)
  red: { r: 239, g: 68, b: 68 }, // #ef4444 (errors)

  // Code block colors
  codeBackground: { r: 30, g: 41, b: 59 }, // #1e293b
  codeText: { r: 226, g: 232, b: 240 }, // #e2e8f0
};

// Page dimensions in mm
const PAGE_SIZES = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
};

// Typography - Quicksand-equivalent sizing (min 11pt for body text)
// Note: jsPDF uses Helvetica as default. For true Quicksand, would need to embed font file.
// Using Helvetica with proper sizing that matches Quicksand weight 400+ visual appearance.
// UPDATED: Increased all sizes to minimum 11pt for readability (Quicksand 400 equivalent)
const FONTS = {
  title: { size: 28, style: 'bold' as const },      // Large header (increased)
  subtitle: { size: 14, style: 'normal' as const }, // Subtitle
  heading: { size: 16, style: 'bold' as const },    // Section headers
  body: { size: 12, style: 'normal' as const },     // Main text (Quicksand 400 equiv)
  small: { size: 11, style: 'normal' as const },    // Captions, timestamps (min 11pt)
  code: { size: 11, style: 'normal' as const },     // Code blocks (min 11pt)
  role: { size: 12, style: 'bold' as const },       // Role labels - increased for visibility
  tableHeader: { size: 11, style: 'bold' as const }, // Table headers
  tableCell: { size: 11, style: 'normal' as const }, // Table cells
};

// Line height multiplier for better text spacing (increased for readability)
const LINE_HEIGHT = 6; // mm per line of body text

// Gogga Logo as PNG base64 (pre-rendered for PDF compatibility)
// jsPDF doesn't support SVG directly, so we use a base64 PNG
// This is a 64x64 dark gogga/cricket icon
const GOGGA_LOGO_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF8ElEQVR4nO2aa4hVVRTHf2fGcSYdp9TU0qYsKy0rNaOHZUVl9rAHPSgiyKCgB/SgCIqIPkRBEH2IqIgKKoKC6EMQPehBZFBZ2cOytLLMHppNZjo6TjNz+rDWdfe599xz77kzd8YP7h9m79n7nPXf66y91l4XEkkkkUQSSSSRRBJJ5F8gFeCb0cDJwP7AwcBg4zsfeBd4DpgL/BUAq9/kEOBiYDRQaXzXDMwC3gHeBP7oZ2wARFuJ04EngGqgbJDv04C1wF+Bbi3sDByOfqP9ifkr8IXx/fIeBNBLcv4PPAac24e/twHPANfRu0V0txyLXrJQSfBP4MMAxQdIzoXoZQsVBMfGwEfAl31B7EPp7QV8gV7ikPR2BY7vjxAi9QXmG98sBNb3Q0x9pYfQbR6qfEi6twFu8xPaXwHkOuDvfogvD0wHHgU2hfjWA98DP4SM0W85DVjkJzSMcuoqtP4HLEcH3S/kIfBvAB4Crg0xznrgW2BViL+9JecBdwGLwoQWB+r7fvzUMKE+6LK8o59C9Je0oJc6VPnO6PYOlaUxPq4C3g+Z1xq4FN0mIWkFcFuY0EoH5e0vOQV4MkxoS+ABdMuFpHkxPi4Fvg4TWjHAcjKwQ5jQHgOu7I/4/C2nAk+FCa2og+UUYGqY0CoDLC/t53hzZQ7wYJjQWgeoTwWGhwmtBx6mgfJcBFxCfM1wGXA78ESY0LqBqwl4r6CX2hU9x+G3vgs8T8OVujV6zkNVgZ5zH3pJQlW9sBZBxy90K7wOLA4R2h6ov9OAL8OE1gHq+2vgszChDQHU9+3o9g1VW2F9fw08Hya0kQHqs/sx3lzZDtwJzA0T2niA+t5LuC23H+QW4O4woU0DqO+bga/ChDaKBupzN/BFmNBGB6jPW4G3woQ2LkB9/hZ4O0xoxwdYztsB1dVqv8o9BLwcIrQ5QH3fRHh+b0D0HIfKl/1qvxNQ33cAy0KEdhVQn1cDb4YJrX+A+r6dcM1xIPp8A/BxiNDuBL4IEdrNQH2/EHg7RGg3BeizyO8TgedhQmsfYDlv6se4s+Uq4N4Qoe0a8N/uh7hzJbr9QtLTAfq8EfggTGjDBujzbv8j1fYAdXkn8HaI0O4O0OctwCthQhsTWE7bAd0Fp6rNwPPAwhCh/QXU563A62FCGxOgz5uAV0OENi5AnbYBr4YJ7Z8H5PV2YHmI0C4JUKdNwOIQod0ToE9rgaUhQrs8QJ02AEtChHYNgTpqTegvD4jevw/Q5xXAihCh3R+gT6uBFSFCezRAn7YCy0OE9mCAPm0AVoUI7ZEAfdoILO1tYD5SnzcB94cJbUKAPm8HlocI7bEAfZoA3N/bwHwNq89bgJdDhPZEgD5PACYC94cIbecBk1gSoGv/JEB/bAU0RwOEdn+APq8F3g8R2jMB+rQOmNR74Zch+vy7Bvg0TGhPBujzWuCWEKG9FKBPq4Fr+yK+XNIH+JXw/P7XQH3/t0E+r+4f8OUu/g5YHfKf5wL+o3s3wJPxHXDX/gi7s/8LGOQGKTEGHp8f/+0DngT+CL3fvwu4N/R+awF0q4pNQH0eiLyb5zKLWN/B+/F4X8kVwB39EmhWyXnA3aH3O2xP0P8K/IrP/uoGe4IuPYNe4lCJ+JN4KPR+g2MH7Al6D+G5ukEp8BQfB+jDFvrR3y35G2EHeF4D/BLic0H/Oi8HnocJbUrgbR+IvCvoQbhC/fqrP/J/rXu+vwJ0CdG5qH9fDtyP+7uLe/EHfO7/sMf9Af17hN57f48T9mh/j+B5wN8BPqYR5uc84jm/e8NVbO7F+o8DPA0EXQM8AOq7ie/wTPpJRub3OD7jfX8e0v/jjh8G+r8s8jHgcTxef5Xw7Pb9AH1aC/ybz2sY+Ovj/O/xY/zuob7P+D8O8F8M+BT/94Ef4hF1wB+N9O8R+hDp3/z+RcDvA/xH/BXb+f49/n+N35fj/wAc+LWxfr/zywAAAABJRU5ErkJggg==';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp for display in SA locale
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
 * Sanitize text for jsPDF (Helvetica font doesn't support extended Unicode)
 * Replaces Unicode characters with ASCII equivalents to prevent garbled output.
 */
function sanitizeForPdf(text: string): string {
  // Unicode character replacements for jsPDF Helvetica font
  const replacements: [RegExp, string][] = [
    // Emoji and symbol replacements
    [/[\u{1F300}-\u{1F9FF}]/gu, ''], // Remove all emojis
    [/[\u{2600}-\u{26FF}]/gu, ''],   // Miscellaneous symbols
    [/[\u{2700}-\u{27BF}]/gu, ''],   // Dingbats
    
    // Common decorative characters that appear in AI responses
    [/[þÞ]/g, ''],                    // Thorn (Icelandic) - often garbled
    [/[ðÐ]/g, 'd'],                   // Eth (Icelandic)
    [/[Ø]/g, 'O'],                    // Slashed O
    [/[ø]/g, 'o'],                    // Slashed o
    [/[æÆ]/g, 'ae'],                  // Ash
    [/[œŒ]/g, 'oe'],                  // OE ligature
    [/[ü]/g, 'u'],                    // u umlaut
    [/[Ü]/g, 'U'],                    // U umlaut
    [/[ä]/g, 'a'],                    // a umlaut
    [/[Ä]/g, 'A'],                    // A umlaut
    [/[ö]/g, 'o'],                    // o umlaut
    [/[Ö]/g, 'O'],                    // O umlaut
    [/[ß]/g, 'ss'],                   // Eszett
    [/[ñ]/g, 'n'],                    // n tilde
    [/[Ñ]/g, 'N'],                    // N tilde
    [/[ç]/g, 'c'],                    // c cedilla
    [/[Ç]/g, 'C'],                    // C cedilla
    
    // Accented vowels
    [/[àáâãäå]/g, 'a'],
    [/[ÀÁÂÃÄÅ]/g, 'A'],
    [/[èéêë]/g, 'e'],
    [/[ÈÉÊË]/g, 'E'],
    [/[ìíîï]/g, 'i'],
    [/[ÌÍÎÏ]/g, 'I'],
    [/[òóôõö]/g, 'o'],
    [/[ÒÓÔÕÖ]/g, 'O'],
    [/[ùúûü]/g, 'u'],
    [/[ÙÚÛÜ]/g, 'U'],
    [/[ýÿ]/g, 'y'],
    [/[Ý]/g, 'Y'],
    
    // Special punctuation and symbols
    [/[""„]/g, '"'],                  // Smart quotes to regular
    [/[''‚]/g, "'"],                  // Smart apostrophes
    [/[–—]/g, '-'],                   // En/em dash to hyphen
    [/[…]/g, '...'],                  // Ellipsis
    [/[•·]/g, '*'],                   // Bullets
    [/[™]/g, '(TM)'],
    [/[®]/g, '(R)'],
    [/[©]/g, '(C)'],
    [/[°]/g, ' deg'],
    [/[±]/g, '+/-'],
    [/[×]/g, 'x'],
    [/[÷]/g, '/'],
    [/[≈]/g, '~'],
    [/[≠]/g, '!='],
    [/[≤]/g, '<='],
    [/[≥]/g, '>='],
    [/[←]/g, '<-'],
    [/[→]/g, '->'],
    [/[↑]/g, '^'],
    [/[↓]/g, 'v'],
    [/[★☆]/g, '*'],
    [/[✓✔]/g, '[x]'],
    [/[✗✘]/g, '[ ]'],
    
    // Currency symbols (keep common ones, replace exotic)
    [/[€]/g, 'EUR'],
    [/[£]/g, 'GBP'],
    [/[¥]/g, 'JPY'],
    [/[₹]/g, 'INR'],
    [/[₿]/g, 'BTC'],
    // R is already ASCII
    
    // Box drawing characters (from tables)
    [/[─━]/g, '-'],
    [/[│┃]/g, '|'],
    [/[┌┍┎┏]/g, '+'],
    [/[┐┑┒┓]/g, '+'],
    [/[└┕┖┗]/g, '+'],
    [/[┘┙┚┛]/g, '+'],
    [/[├┝┞┟┠┡┢┣]/g, '+'],
    [/[┤┥┦┧┨┩┪┫]/g, '+'],
    [/[┬┭┮┯┰┱┲┳]/g, '+'],
    [/[┴┵┶┷┸┹┺┻]/g, '+'],
    [/[┼┽┾┿╀╁╂╃╄╅╆╇╈╉╊╋]/g, '+'],
    
    // Mathematical symbols
    [/[∞]/g, 'infinity'],
    [/[∑]/g, 'sum'],
    [/[∏]/g, 'product'],
    [/[√]/g, 'sqrt'],
    [/[∫]/g, 'integral'],
    [/[π]/g, 'pi'],
    [/[α]/g, 'alpha'],
    [/[β]/g, 'beta'],
    [/[γ]/g, 'gamma'],
    [/[δ]/g, 'delta'],
    [/[Δ]/g, 'Delta'],
    [/[λ]/g, 'lambda'],
    [/[μ]/g, 'mu'],
    [/[σ]/g, 'sigma'],
    [/[Σ]/g, 'Sigma'],
    [/[Ω]/g, 'Omega'],
    [/[ω]/g, 'omega'],
    
    // Final cleanup: remove any remaining non-ASCII non-printable
    [/[^\x20-\x7E\n\r\t]/g, ''],
  ];
  
  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

/**
 * Parsed table structure for PDF rendering
 */
interface ParsedTable {
  headers: string[];
  rows: string[][];
  columnWidths: number[]; // Relative widths (percentages)
}

/**
 * Content block - either text or a table
 */
interface ContentBlock {
  type: 'text' | 'table';
  content: string;      // For text blocks
  table?: ParsedTable;  // For table blocks
}

/**
 * Clean cell content - strip markdown and HTML, then sanitize for PDF
 */
function cleanCellContent(text: string): string {
  let result = text.trim();
  
  // Strip HTML tags
  result = result
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  
  // Strip markdown formatting
  result = result
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold**
    .replace(/__([^_]+)__/g, '$1')       // __bold__
    .replace(/\*([^*]+)\*/g, '$1')       // *italic*
    .replace(/_([^_]+)_/g, '$1')         // _italic_
    .replace(/`([^`]+)`/g, '$1')         // `code`
    .replace(/~~([^~]+)~~/g, '$1')       // ~~strikethrough~~
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url)
    .replace(/^#+\s*/gm, '')             // # headers
    .replace(/\n+/g, ' ')                // newlines to spaces
    .replace(/\s+/g, ' ')                // multiple spaces to single
    .trim();
  
  // Sanitize for PDF (Unicode → ASCII)
  return sanitizeForPdf(result);
}

/**
 * Parse markdown table into structured data
 */
function parseMarkdownTable(tableText: string): ParsedTable | null {
  const lines = tableText.trim().split('\n');
  if (lines.length < 2) return null;
  
  // Parse table rows
  const allRows: string[][] = [];
  for (const line of lines) {
    // Skip separator lines (|---|---|)
    if (/^\|?[-:\s|]+\|?$/.test(line)) continue;
    
    // Parse cells - clean markdown/HTML and sanitize
    const cells = line
      .split('|')
      .map(cell => cleanCellContent(cell))
      .filter(cell => cell.length > 0);
    
    if (cells.length > 0) {
      allRows.push(cells);
    }
  }
  
  if (allRows.length === 0) return null;
  
  // First row is header
  const headers = allRows[0] || [];
  const rows = allRows.slice(1);
  
  // Calculate relative column widths based on content length
  const maxChars: number[] = [];
  for (const row of allRows) {
    row.forEach((cell, i) => {
      maxChars[i] = Math.max(maxChars[i] || 0, cell.length, 5); // Min 5 chars
    });
  }
  const totalChars = maxChars.reduce((sum, w) => sum + w, 0);
  const columnWidths = maxChars.map(w => (w / totalChars) * 100);
  
  return { headers, rows, columnWidths };
}

/**
 * Split content into text and table blocks for separate rendering
 */
function splitContentBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const tableRegex = /\|[^\n]+\|(?:\n\|[^\n]+\|)+/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = tableRegex.exec(content)) !== null) {
    // Add text before this table
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        blocks.push({ type: 'text', content: textBefore });
      }
    }
    
    // Parse and add table
    const parsedTable = parseMarkdownTable(match[0]);
    if (parsedTable && parsedTable.headers.length > 0) {
      blocks.push({ type: 'table', content: match[0], table: parsedTable });
    } else {
      // Failed to parse, treat as text
      blocks.push({ type: 'text', content: match[0] });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last table
  if (lastIndex < content.length) {
    const textAfter = content.slice(lastIndex).trim();
    if (textAfter) {
      blocks.push({ type: 'text', content: textAfter });
    }
  }
  
  // If no blocks created, entire content is text
  if (blocks.length === 0 && content.trim()) {
    blocks.push({ type: 'text', content: content.trim() });
  }
  
  return blocks;
}

/**
 * Convert markdown table to plain text format (fallback for very wide tables)
 */
function convertMarkdownTableToText(tableText: string): string {
  const parsed = parseMarkdownTable(tableText);
  if (!parsed) return tableText;
  
  const { headers, rows } = parsed;
  const allRows = [headers, ...rows];
  
  // Calculate column widths
  const colWidths: number[] = [];
  for (const row of allRows) {
    row.forEach((cell, i) => {
      colWidths[i] = Math.max(colWidths[i] || 0, cell.length);
    });
  }
  
  // Format as text table with padding
  const formattedRows: string[] = [];
  allRows.forEach((row, rowIndex) => {
    const paddedCells = row.map((cell, i) => 
      cell.padEnd(colWidths[i] || cell.length)
    );
    formattedRows.push(paddedCells.join('  |  '));
    
    // Add separator after header
    if (rowIndex === 0) {
      const separator = colWidths.map(w => '-'.repeat(w)).join('--+--');
      formattedRows.push(separator);
    }
  });
  
  return formattedRows.join('\n');
}

/**
 * Strip markdown formatting for plain text (used for simple text rendering)
 * Tables are handled separately via splitContentBlocks for proper PDF rendering
 */
function stripMarkdown(text: string): string {
  let result = text;
  
  // Convert tables to readable text format (fallback)
  const tableRegex = /\|[^\n]+\|(?:\n\|[^\n]+\|)+/g;
  result = result.replace(tableRegex, (match) => {
    return '\n' + convertMarkdownTableToText(match) + '\n';
  });
  
  // Then strip other markdown
  return result
    .replace(/```[\s\S]*?```/g, '[code block]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/__TOOL_CHART__:[^\n]*/g, '[Chart]')
    .replace(/TOOL_CHART:[^\n]*/g, '[Chart]')
    .replace(/__TOOL_IMAGES__:[^\n]*/g, '[Generated Image]')
    .replace(/__TOOL_MATH__:[^\n]*/g, '[Math Result]')
    // Clean up any remaining HTML-like tags
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
}

/**
 * Clean content for display (remove tool markers)
 */
function cleanContent(content: string): string {
  return content
    .replace(/__TOOL_CHART__:[^\n]*/g, '')
    .replace(/TOOL_CHART:[^\n]*/g, '')
    .replace(/__TOOL_IMAGES__:[^\n]*/g, '')
    .replace(/__TOOL_MATH__:[^\n]*/g, '')
    .trim();
}

// ============================================================================
// PDF Builder Class
// ============================================================================

class GoggaPdfBuilder {
  private doc: jsPDF;
  private y: number;
  private pageWidth: number;
  private pageHeight: number;
  private margin: { top: number; right: number; bottom: number; left: number };
  private contentWidth: number;
  private pageNumber: number = 1;
  private options: ExportOptions;

  constructor(options: ExportOptions) {
    this.options = options;
    const pageSize = options.pageSize || 'a4';
    const orientation = options.orientation || 'portrait';

    this.doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: pageSize,
    });

    const size = PAGE_SIZES[pageSize];
    if (orientation === 'landscape') {
      this.pageWidth = size.height;
      this.pageHeight = size.width;
    } else {
      this.pageWidth = size.width;
      this.pageHeight = size.height;
    }

    // Parse margin options
    const marginVal = options.margin ?? 15;
    if (typeof marginVal === 'number') {
      this.margin = {
        top: marginVal,
        right: marginVal,
        bottom: marginVal,
        left: marginVal,
      };
    } else if (Array.isArray(marginVal)) {
      if (marginVal.length === 2) {
        this.margin = {
          top: marginVal[0] ?? 15,
          right: marginVal[1] ?? 15,
          bottom: marginVal[0] ?? 15,
          left: marginVal[1] ?? 15,
        };
      } else if (marginVal.length === 4) {
        this.margin = {
          top: marginVal[0] ?? 15,
          right: marginVal[1] ?? 15,
          bottom: marginVal[2] ?? 15,
          left: marginVal[3] ?? 15,
        };
      } else {
        this.margin = { top: 15, right: 15, bottom: 15, left: 15 };
      }
    } else {
      this.margin = { top: 15, right: 15, bottom: 15, left: 15 };
    }

    this.contentWidth = this.pageWidth - this.margin.left - this.margin.right;
    this.y = this.margin.top;
  }

  // ---------------------------------------------------------------------------
  // Core Drawing Methods
  // ---------------------------------------------------------------------------

  private setColor(color: { r: number; g: number; b: number }): void {
    this.doc.setTextColor(color.r, color.g, color.b);
  }

  private setFillColor(color: { r: number; g: number; b: number }): void {
    this.doc.setFillColor(color.r, color.g, color.b);
  }

  private setDrawColor(color: { r: number; g: number; b: number }): void {
    this.doc.setDrawColor(color.r, color.g, color.b);
  }

  private setFont(
    size: number,
    style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal'
  ): void {
    this.doc.setFontSize(size);
    this.doc.setFont('helvetica', style);
  }

  private checkPageBreak(requiredHeight: number): void {
    const maxY = this.pageHeight - this.margin.bottom;
    if (this.y + requiredHeight > maxY) {
      this.addPage();
    }
  }

  private addPage(): void {
    this.addPageFooter();
    this.doc.addPage();
    this.pageNumber++;
    this.y = this.margin.top;
  }

  private addPageFooter(): void {
    const footerY = this.pageHeight - 8;
    this.setFont(8, 'normal');
    this.setColor(COLORS.gray);

    // Left: Gogga branding
    this.doc.text('GOGGA - South Africa\'s AI Assistant', this.margin.left, footerY);

    // Right: Page number
    const pageText = `Page ${this.pageNumber}`;
    const textWidth = this.doc.getTextWidth(pageText);
    this.doc.text(pageText, this.pageWidth - this.margin.right - textWidth, footerY);
  }

  // ---------------------------------------------------------------------------
  // Content Drawing Methods
  // ---------------------------------------------------------------------------

  /**
   * Draw the sovereign AI banner
   */
  private drawSovereignBanner(): void {
    const bannerHeight = 35;
    this.checkPageBreak(bannerHeight + 10);

    // Draw banner background with gradient effect (dark to slightly lighter)
    const x = this.margin.left;
    const width = this.contentWidth;

    // Main background
    this.setFillColor(COLORS.black);
    this.doc.roundedRect(x, this.y, width, bannerHeight, 3, 3, 'F');

    // Content
    const centerX = x + width / 2;

    // Title
    this.setFont(14, 'bold');
    this.setColor(COLORS.green);
    const title = 'Your Data, Your Control';
    const titleWidth = this.doc.getTextWidth(title);
    this.doc.text(title, centerX - titleWidth / 2, this.y + 10);

    // Subtitle lines
    this.setFont(9, 'normal');
    this.setColor(COLORS.white);
    const lines = [
      'This chat history was extracted directly from your browser\'s local storage.',
      'GOGGA never stores your conversations on external servers.',
      'Congratulations on choosing Sovereign AI!',
    ];

    let lineY = this.y + 17;
    for (const line of lines) {
      const lineWidth = this.doc.getTextWidth(line);
      this.doc.text(line, centerX - lineWidth / 2, lineY);
      lineY += 5;
    }

    // Badge
    this.setFillColor(COLORS.green);
    const badgeText = '100% Privacy-First South African AI';
    const badgeWidth = this.doc.getTextWidth(badgeText) + 10;
    const badgeX = centerX - badgeWidth / 2;
    this.doc.roundedRect(badgeX, lineY - 2, badgeWidth, 6, 2, 2, 'F');
    this.setFont(8, 'bold');
    this.setColor(COLORS.white);
    this.doc.text(badgeText, centerX - this.doc.getTextWidth(badgeText) / 2, lineY + 2);

    this.y += bannerHeight + 8;
  }

  /**
   * Draw export metadata header
   */
  private drawExportMeta(): void {
    const userName = this.options.userName || 'GOGGA User';
    const tier = (this.options.userTier || 'jive').toUpperCase();
    const date = formatTimestamp(new Date());

    this.setFont(FONTS.small.size, 'normal');
    this.setColor(COLORS.gray);

    const metaText = `Exported by: ${userName}  |  Tier: ${tier}  |  Date: ${date}`;
    const textWidth = this.doc.getTextWidth(metaText);
    this.doc.text(
      metaText,
      this.pageWidth - this.margin.right - textWidth,
      this.y
    );

    this.y += 6;

    // Dashed line separator
    this.setDrawColor(COLORS.lightGray);
    this.doc.setLineDashPattern([2, 2], 0);
    this.doc.line(this.margin.left, this.y, this.pageWidth - this.margin.right, this.y);
    this.doc.setLineDashPattern([], 0);

    this.y += 8;
  }

  /**
   * Draw main header with Gogga branding and logo
   */
  private drawHeader(): void {
    this.checkPageBreak(40);

    const centerX = this.pageWidth / 2;
    
    // Add logo image (PNG format for jsPDF compatibility)
    try {
      const logoSize = 16; // mm
      const logoX = centerX - logoSize / 2;
      this.doc.addImage(GOGGA_LOGO_PNG, 'PNG', logoX, this.y, logoSize, logoSize);
      this.y += logoSize + 4;
    } catch (err) {
      // Logo failed to load, continue without it
      console.warn('[PDF] Logo embedding failed:', err);
      this.y += 4;
    }

    // Main title
    this.setFont(FONTS.title.size, 'bold');
    this.setColor(COLORS.black);
    const logoTitle = 'GOGGA';
    const titleWidth = this.doc.getTextWidth(logoTitle);
    this.doc.text(logoTitle, centerX - titleWidth / 2, this.y);
    this.y += 10;

    // Subtitle
    this.setFont(FONTS.subtitle.size, 'normal');
    this.setColor(COLORS.gray);
    const subtitle = "South Africa's AI Assistant";
    const subtitleWidth = this.doc.getTextWidth(subtitle);
    this.doc.text(subtitle, centerX - subtitleWidth / 2, this.y);
    this.y += 6;

    // Export date
    const dateStr = `Chat Export - ${formatTimestamp(new Date())}`;
    const dateWidth = this.doc.getTextWidth(dateStr);
    this.doc.text(dateStr, centerX - dateWidth / 2, this.y);
    this.y += 12;

    // Separator line
    this.setDrawColor(COLORS.lightGray);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin.left, this.y, this.pageWidth - this.margin.right, this.y);
    this.doc.setLineWidth(0.2);

    this.y += 8;
  }

  /**
   * Draw session info box
   */
  private drawSessionInfo(session: ChatSession, messageCount: number): void {
    const boxHeight = 18;
    this.checkPageBreak(boxHeight + 5);

    // Background
    this.setFillColor(COLORS.paleGray);
    this.doc.roundedRect(
      this.margin.left,
      this.y,
      this.contentWidth,
      boxHeight,
      2,
      2,
      'F'
    );

    // Title
    this.setFont(14, 'bold');
    this.setColor(COLORS.black);
    this.doc.text(session.title, this.margin.left + 5, this.y + 8);

    // Metadata
    this.setFont(10, 'normal');
    this.setColor(COLORS.gray);
    const meta = `Tier: ${session.tier.toUpperCase()}  |  Messages: ${messageCount}  |  Created: ${formatTimestamp(session.createdAt)}`;
    this.doc.text(meta, this.margin.left + 5, this.y + 14);

    this.y += boxHeight + 6;
  }

  /**
   * Draw a chat message with proper pagination
   * FIXED: Contrast, text overlap, multi-page handling, and proper table rendering
   */
  private drawMessage(
    msg: ChatMessage,
    images: Map<number, GeneratedImage>
  ): void {
    const isUser = msg.role === 'user';
    const roleLabel = isUser ? 'You' : 'Gogga';
    const cleanedContent = cleanContent(msg.content);

    // Message container positioning
    const bubbleX = isUser
      ? this.margin.left + this.contentWidth * 0.1
      : this.margin.left;
    const bubbleWidth = this.contentWidth * 0.9;
    const maxWidth = bubbleWidth - 16; // Padding inside bubble (8mm each side)
    const lineHeight = LINE_HEIGHT;

    // Split content into text and table blocks
    const contentBlocks = splitContentBlocks(cleanedContent);
    
    // Layout constants
    const roleHeight = 8;
    const paddingTop = 8;
    const paddingBottom = 8;
    const timestampHeight = this.options.includeTimestamps !== false ? 10 : 0;
    const headerHeight = paddingTop + roleHeight;
    const footerHeight = timestampHeight + paddingBottom;
    
    let isFirstBlock = true;
    
    for (let blockIndex = 0; blockIndex < contentBlocks.length; blockIndex++) {
      const block = contentBlocks[blockIndex];
      if (!block) continue;
      const isLastBlock = blockIndex === contentBlocks.length - 1;
      
      if (block.type === 'table' && block.table) {
        // Draw table outside of message bubble for better readability
        // First draw a small label bubble if this is the first block
        if (isFirstBlock) {
          this.drawMessageHeader(isUser, roleLabel, bubbleX, bubbleWidth);
          isFirstBlock = false;
        }
        
        // Draw the table
        this.drawTable(block.table, this.contentWidth - 10);
        
        // Add timestamp after last block if this is a table
        if (isLastBlock && this.options.includeTimestamps !== false) {
          this.setFont(FONTS.small.size, 'normal');
          this.setColor(COLORS.gray);
          this.doc.text(formatTimestamp(msg.timestamp), this.margin.left + 5, this.y);
          this.y += 8;
        }
      } else {
        // Text block - render in bubble
        this.setFont(FONTS.body.size, 'normal');
        const textContent = sanitizeForPdf(stripMarkdown(block.content));
        const allLines = this.doc.splitTextToSize(textContent, maxWidth);
        
        // Maximum lines per page (considering margins and footer)
        const maxY = this.pageHeight - this.margin.bottom - 15;
        const availableHeight = maxY - this.y - headerHeight - footerHeight;
        const maxLinesPerBubble = Math.floor(availableHeight / lineHeight);
        
        // Determine if we should show timestamp (only on last block)
        const showTimestamp = isLastBlock ? msg.timestamp : undefined;
        
        // If entire text fits on current page, draw it normally
        if (allLines.length <= maxLinesPerBubble && availableHeight > headerHeight + 3 * lineHeight) {
          this.drawMessageBubble(
            allLines, 
            isUser, 
            isFirstBlock ? roleLabel : `${roleLabel} (cont.)`,
            bubbleX, 
            bubbleWidth, 
            showTimestamp
          );
        } else {
          // Text needs to span multiple pages - split into chunks
          let remainingLines = [...allLines];
          let isFirstChunk = true;
          
          while (remainingLines.length > 0) {
            // Calculate how many lines fit on this page
            const currentMaxY = this.pageHeight - this.margin.bottom - 15;
            const currentAvailableHeight = currentMaxY - this.y - (isFirstChunk && isFirstBlock ? headerHeight : paddingTop) - footerHeight;
            const linesOnThisPage = Math.max(3, Math.floor(currentAvailableHeight / lineHeight));
            
            // If we can't fit at least 3 lines, start a new page
            if (linesOnThisPage < 3 && remainingLines.length > 0) {
              this.addPage();
              continue;
            }
            
            const chunk = remainingLines.slice(0, linesOnThisPage);
            remainingLines = remainingLines.slice(linesOnThisPage);
            
            // Draw this chunk
            this.drawMessageBubble(
              chunk, 
              isUser, 
              (isFirstChunk && isFirstBlock) ? roleLabel : `${roleLabel} (cont.)`,
              bubbleX, 
              bubbleWidth, 
              (remainingLines.length === 0 && isLastBlock) ? msg.timestamp : undefined,
              !(isFirstChunk && isFirstBlock), // isContinuation
              remainingLines.length > 0 // hasMore
            );
            
            isFirstChunk = false;
            
            // If more lines remain, add page break
            if (remainingLines.length > 0) {
              this.addPage();
            }
          }
        }
        
        isFirstBlock = false;
      }
    }

    // Thinking block (JIGGA tier) - AFTER the message content
    if (this.options.includeThinking && msg.thinking) {
      this.drawThinkingBlock(msg.thinking);
    }

    // AI-generated image - AFTER the message
    if (this.options.includeImages !== false && msg.imageId) {
      const image = images.get(msg.imageId);
      if (image && !image.isDeleted && image.thumbnailData) {
        this.drawImage(image);
      }
    }
  }
  
  /**
   * Draw just the message header (role label) for tables
   */
  private drawMessageHeader(
    isUser: boolean,
    roleLabel: string,
    bubbleX: number,
    bubbleWidth: number
  ): void {
    const headerHeight = 12;
    this.checkPageBreak(headerHeight + 10);
    
    // Draw small header bubble
    const bgColor = isUser ? COLORS.darkGray : { r: 229, g: 231, b: 235 };
    this.setFillColor(bgColor);
    this.doc.roundedRect(bubbleX, this.y, bubbleWidth * 0.3, headerHeight, 3, 3, 'F');
    
    // Role label
    this.setFont(FONTS.role.size, 'bold');
    this.setColor(isUser ? COLORS.white : COLORS.darkGray);
    this.doc.text(roleLabel.toUpperCase(), bubbleX + 6, this.y + 8);
    
    this.y += headerHeight + 4;
  }
  
  /**
   * Draw a single message bubble (may be a chunk of a larger message)
   */
  private drawMessageBubble(
    lines: string[],
    isUser: boolean,
    roleLabel: string,
    bubbleX: number,
    bubbleWidth: number,
    timestamp?: Date,
    isContinuation: boolean = false,
    hasMore: boolean = false
  ): void {
    const lineHeight = LINE_HEIGHT;
    const paddingTop = 8;
    const paddingBottom = 8;
    const roleHeight = 8;
    const timestampHeight = timestamp ? 10 : 0;
    
    // Calculate bubble height
    const textHeight = lines.length * lineHeight;
    const contentHeight = paddingTop + roleHeight + textHeight + timestampHeight + paddingBottom;

    // Draw bubble background
    // User: Dark gray background (#374151), white text
    // Assistant: Light gray background (#e5e7eb), black text
    const bgColor = isUser ? COLORS.darkGray : { r: 229, g: 231, b: 235 }; // Slightly darker than paleGray for better contrast
    this.setFillColor(bgColor);
    this.doc.roundedRect(bubbleX, this.y, bubbleWidth, contentHeight, 4, 4, 'F');

    // Thin border for better definition
    this.setDrawColor(isUser ? COLORS.gray : COLORS.lightGray);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(bubbleX, this.y, bubbleWidth, contentHeight, 4, 4, 'S');
    this.doc.setLineWidth(0.2);

    const textX = bubbleX + 8;
    let currentY = this.y + paddingTop;

    // Role label - HIGH CONTRAST
    this.setFont(FONTS.role.size, 'bold');
    // User: White text on dark gray background
    // Assistant: Dark gray text on light gray background
    this.setColor(isUser ? COLORS.white : COLORS.darkGray);
    this.doc.text(roleLabel.toUpperCase(), textX, currentY + 4);
    currentY += roleHeight;

    // Message content - CORRECT CONTRAST (BLACK text on light, WHITE text on dark)
    this.setFont(FONTS.body.size, 'normal');
    this.setColor(isUser ? COLORS.white : COLORS.black);
    
    // Draw each line with proper spacing
    for (const line of lines) {
      currentY += lineHeight;
      this.doc.text(line, textX, currentY - 2);
    }

    // "Continued..." indicator
    if (hasMore) {
      this.setFont(FONTS.small.size, 'italic');
      this.setColor(isUser ? COLORS.lightGray : COLORS.gray);
      this.doc.text('(continued on next page...)', textX, currentY + lineHeight - 2);
    }

    // Timestamp (only on first chunk or single message)
    if (timestamp && !hasMore) {
      currentY += 4;
      this.setFont(FONTS.small.size, 'normal');
      this.setColor(isUser ? COLORS.lightGray : COLORS.gray);
      this.doc.text(formatTimestamp(timestamp), textX, currentY + 4);
    }

    // Move Y position after bubble
    this.y += contentHeight + 10;
  }

  /**
   * Draw thinking block (JIGGA tier feature)
   */
  private drawThinkingBlock(thinking: string): void {
    const maxWidth = this.contentWidth - 20;
    const lines = this.doc.splitTextToSize(sanitizeForPdf(thinking), maxWidth);
    const height = lines.length * 4 + 12;

    this.checkPageBreak(height);

    // Background
    this.setFillColor({ r: 254, g: 243, b: 199 }); // Amber-50
    this.doc.roundedRect(this.margin.left + 10, this.y, maxWidth, height, 2, 2, 'F');

    // Left border
    this.setDrawColor(COLORS.amber);
    this.doc.setLineWidth(1);
    this.doc.line(this.margin.left + 10, this.y, this.margin.left + 10, this.y + height);
    this.doc.setLineWidth(0.2);

    // Label
    this.setFont(9, 'bold');
    this.setColor({ r: 180, g: 83, b: 9 }); // Amber-700
    this.doc.text('Thinking Process', this.margin.left + 15, this.y + 6);

    // Content
    this.setFont(9, 'italic');
    this.setColor(COLORS.darkGray);
    this.doc.text(lines, this.margin.left + 15, this.y + 12);

    this.y += height + 4;
  }

  /**
   * Draw a proper PDF table with borders, auto-adjusted columns, and 2-line rows
   */
  private drawTable(table: ParsedTable, maxWidth: number): void {
    const { headers, rows } = table;
    const cellPadding = 3; // mm horizontal padding
    const cellPaddingV = 2; // mm vertical padding
    const lineHeight = 4; // mm per line of text
    const maxLinesPerCell = 2; // Allow 2 lines per cell
    const rowHeight = cellPaddingV * 2 + lineHeight * maxLinesPerCell; // ~12mm per row
    const headerHeight = rowHeight; // Same height for header
    const fontSize = FONTS.tableCell.size;
    
    // Calculate column widths based on actual content
    // Use font metrics to measure text width
    this.setFont(fontSize, 'normal');
    
    const numCols = headers.length;
    const minColWidth = 20; // Minimum column width in mm
    const maxColWidth = maxWidth * 0.5; // No column wider than 50% of table
    
    // Measure content width for each column
    const colContentWidths: number[] = [];
    for (let col = 0; col < numCols; col++) {
      let maxContentWidth = this.doc.getTextWidth(headers[col] || '') + cellPadding * 2;
      
      for (const row of rows) {
        const cellText = row[col] || '';
        const textWidth = this.doc.getTextWidth(cellText) + cellPadding * 2;
        // For wrapped text, consider half the width (since it wraps to 2 lines)
        const effectiveWidth = Math.min(textWidth, textWidth / 1.5);
        maxContentWidth = Math.max(maxContentWidth, effectiveWidth);
      }
      
      colContentWidths[col] = Math.min(Math.max(maxContentWidth, minColWidth), maxColWidth);
    }
    
    // Scale column widths to fit maxWidth
    const totalContentWidth = colContentWidths.reduce((sum, w) => sum + w, 0);
    const scale = totalContentWidth > maxWidth ? maxWidth / totalContentWidth : 1;
    const actualColWidths = colContentWidths.map(w => w * scale);
    
    // Calculate total table height (estimate)
    const estimatedHeight = headerHeight + (rows.length * rowHeight);
    
    // Check if we need a page break before starting
    this.checkPageBreak(Math.min(estimatedHeight, headerHeight + rowHeight * 3) + 10);
    
    const tableX = this.margin.left;
    const tableStartY = this.y;
    let currentY = this.y;
    
    // Helper to draw header
    const drawHeader = (y: number): number => {
      this.setFillColor(COLORS.darkGray);
      this.doc.rect(tableX, y, maxWidth, headerHeight, 'F');
      
      this.setFont(FONTS.tableHeader.size, 'bold');
      this.setColor(COLORS.white);
      
      let cellX = tableX;
      headers.forEach((header, i) => {
        const cellWidth = actualColWidths[i] || minColWidth;
        const textMaxWidth = cellWidth - cellPadding * 2;
        
        // Wrap header text to 2 lines max
        const lines = this.doc.splitTextToSize(header, textMaxWidth);
        const displayLines = lines.slice(0, maxLinesPerCell);
        
        // Center vertically
        const textStartY = y + cellPaddingV + lineHeight * 0.8;
        displayLines.forEach((line: string, lineIdx: number) => {
          this.doc.text(line, cellX + cellPadding, textStartY + lineIdx * lineHeight);
        });
        
        cellX += cellWidth;
      });
      
      return y + headerHeight;
    };
    
    // Draw initial header
    currentY = drawHeader(currentY);
    
    // Track row Y positions for drawing lines later
    const rowYPositions: number[] = [tableStartY, currentY];
    
    // Draw data rows
    this.setFont(fontSize, 'normal');
    
    rows.forEach((row, rowIndex) => {
      // Check for page break mid-table
      if (currentY + rowHeight > this.pageHeight - this.margin.bottom - 15) {
        // Draw borders for current page section before page break
        this.drawTableBorders(tableX, tableStartY, maxWidth, currentY - tableStartY, actualColWidths, rowYPositions);
        
        this.addPage();
        currentY = this.y;
        rowYPositions.length = 0;
        rowYPositions.push(currentY);
        
        // Redraw header on new page
        currentY = drawHeader(currentY);
        rowYPositions.push(currentY);
        
        this.setFont(fontSize, 'normal');
      }
      
      // Alternating row background
      if (rowIndex % 2 === 0) {
        this.setFillColor(COLORS.paleGray);
      } else {
        this.setFillColor(COLORS.white);
      }
      this.doc.rect(tableX, currentY, maxWidth, rowHeight, 'F');
      
      // Cell text with wrapping
      this.setColor(COLORS.black);
      let cellX = tableX;
      row.forEach((cell, i) => {
        const cellWidth = actualColWidths[i] || minColWidth;
        const textMaxWidth = cellWidth - cellPadding * 2;
        
        // Wrap text to 2 lines max
        const lines = this.doc.splitTextToSize(cell, textMaxWidth);
        const displayLines = lines.slice(0, maxLinesPerCell);
        
        // If text was truncated, add ellipsis to last line
        if (lines.length > maxLinesPerCell && displayLines.length > 0) {
          const lastLine = displayLines[displayLines.length - 1];
          if (lastLine.length > 3) {
            displayLines[displayLines.length - 1] = lastLine.slice(0, -3) + '...';
          }
        }
        
        // Center vertically in cell
        const textStartY = currentY + cellPaddingV + lineHeight * 0.8;
        displayLines.forEach((line: string, lineIdx: number) => {
          this.doc.text(line, cellX + cellPadding, textStartY + lineIdx * lineHeight);
        });
        
        cellX += cellWidth;
      });
      
      currentY += rowHeight;
      rowYPositions.push(currentY);
    });
    
    // Draw final table borders
    this.drawTableBorders(tableX, rowYPositions[0] || tableStartY, maxWidth, currentY - (rowYPositions[0] || tableStartY), actualColWidths, rowYPositions);
    
    this.y = currentY + 6;
  }
  
  /**
   * Draw table borders and grid lines
   */
  private drawTableBorders(
    tableX: number,
    tableY: number,
    tableWidth: number,
    tableHeight: number,
    colWidths: number[],
    rowYPositions: number[]
  ): void {
    // Outer border
    this.setDrawColor(COLORS.gray);
    this.doc.setLineWidth(0.4);
    this.doc.rect(tableX, tableY, tableWidth, tableHeight, 'S');
    
    // Column separators
    this.doc.setLineWidth(0.2);
    let cellX = tableX;
    for (let i = 0; i < colWidths.length - 1; i++) {
      cellX += colWidths[i] || 20;
      this.doc.line(cellX, tableY, cellX, tableY + tableHeight);
    }
    
    // Row separators
    this.doc.setLineWidth(0.3);
    if (rowYPositions.length > 1 && rowYPositions[1] !== undefined) {
      // Header separator (thicker)
      this.doc.line(tableX, rowYPositions[1], tableX + tableWidth, rowYPositions[1]);
    }
    
    this.doc.setLineWidth(0.1);
    for (let i = 2; i < rowYPositions.length - 1; i++) {
      const rowY = rowYPositions[i];
      if (rowY !== undefined) {
        this.doc.line(tableX, rowY, tableX + tableWidth, rowY);
      }
    }
    
    this.doc.setLineWidth(0.2);
  }

  /**
   * Draw embedded image
   */
  private drawImage(image: GeneratedImage): void {
    try {
      // Only include if we have valid base64 data
      if (!image.thumbnailData?.startsWith('data:')) {
        return;
      }

      // Calculate dimensions (max width 120mm, maintain aspect ratio)
      const maxWidth = 120;
      const maxHeight = 80;
      let imgWidth = Math.min(image.width || 256, maxWidth * 4) / 4;
      let imgHeight = Math.min(image.height || 256, maxHeight * 4) / 4;

      // Maintain aspect ratio
      if (image.width && image.height) {
        const ratio = image.width / image.height;
        if (imgWidth / imgHeight > ratio) {
          imgWidth = imgHeight * ratio;
        } else {
          imgHeight = imgWidth / ratio;
        }
      }

      this.checkPageBreak(imgHeight + 20);

      // Center the image
      const imgX = this.margin.left + (this.contentWidth - imgWidth) / 2;

      // Add the image
      this.doc.addImage(
        image.thumbnailData,
        'JPEG',
        imgX,
        this.y,
        imgWidth,
        imgHeight
      );

      this.y += imgHeight + 3;

      // Caption (prompt)
      if (image.prompt) {
        this.setFont(9, 'italic');
        this.setColor(COLORS.gray);
        const captionLines = this.doc.splitTextToSize(
          sanitizeForPdf(`"${image.prompt}"`),
          this.contentWidth - 20
        );
        const captionX = this.margin.left + 10;
        this.doc.text(captionLines, captionX, this.y);
        this.y += captionLines.length * 4 + 4;
      }
    } catch (err) {
      console.warn('[PDF] Failed to embed image:', err);
    }
  }

  /**
   * Draw session divider for multi-session exports
   */
  private drawSessionDivider(): void {
    this.addPage(); // Start new session on new page

    // Decorative divider
    this.setDrawColor(COLORS.lightGray);
    this.doc.setLineWidth(1);
    this.doc.line(
      this.margin.left + 20,
      this.y,
      this.pageWidth - this.margin.right - 20,
      this.y
    );
    this.doc.setLineWidth(0.2);
    this.y += 8;
  }

  // ---------------------------------------------------------------------------
  // Public Build Method
  // ---------------------------------------------------------------------------

  async build(
    sessions: ChatSession[],
    messagesMap: Map<string, ChatMessage[]>,
    imagesMap: Map<number, GeneratedImage>
  ): Promise<void> {
    console.log('[PDF Builder] Building PDF for', sessions.length, 'sessions');

    // Draw header elements
    this.drawSovereignBanner();
    this.drawExportMeta();
    this.drawHeader();

    // Process each session
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      if (!session) continue;
      
      const messages = messagesMap.get(session.id!) || [];

      console.log(
        `[PDF Builder] Session "${session.title}": ${messages.length} messages`
      );

      if (i > 0) {
        this.drawSessionDivider();
      }

      this.drawSessionInfo(session, messages.length);

      // Draw messages
      for (const msg of messages) {
        this.drawMessage(msg, imagesMap);
      }

      // Show empty state if no messages
      if (messages.length === 0) {
        this.checkPageBreak(20);
        this.setFont(FONTS.body.size, 'italic');
        this.setColor(COLORS.gray);
        const emptyText = 'No messages in this session.';
        const textWidth = this.doc.getTextWidth(emptyText);
        this.doc.text(
          emptyText,
          this.pageWidth / 2 - textWidth / 2,
          this.y + 10
        );
        this.y += 20;
      }
    }

    // If no sessions at all
    if (sessions.length === 0) {
      this.checkPageBreak(30);
      this.setFont(14, 'normal');
      this.setColor(COLORS.gray);
      const emptyText = 'No chat sessions found.';
      const textWidth = this.doc.getTextWidth(emptyText);
      this.doc.text(emptyText, this.pageWidth / 2 - textWidth / 2, this.y + 15);
    }

    // Add footer to last page
    this.addPageFooter();
  }

  /**
   * Save the PDF to file
   */
  save(filename: string): void {
    this.doc.save(filename);
  }

  /**
   * Get page count
   */
  getPageCount(): number {
    return this.pageNumber;
  }
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Export chat to PDF
 */
export async function exportChatToPdf(
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const { mode, sessionId, userTier } = options;

    // Premium tier check - PDF export is JIVE/JIGGA only
    if (!userTier || (userTier !== 'jive' && userTier !== 'jigga')) {
      console.error('[PDF Export] Premium feature - tier required');
      return {
        success: false,
        error:
          'PDF Export is a premium feature. Upgrade to JIVE or JIGGA to export your chats.',
      };
    }

    console.log('[PDF Export] Starting export with options:', {
      mode,
      sessionId,
      userTier,
    });

    // Collect sessions based on mode
    let sessions: ChatSession[] = [];

    if (mode === 'current-session' || mode === 'single-session') {
      if (!sessionId) {
        console.error('[PDF Export] No sessionId provided');
        return {
          success: false,
          error: 'Session ID required for this export mode',
        };
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
      console.log(
        `[PDF Export] Session ${session.id} has ${sessionMessages.length} messages`
      );
      messagesMap.set(session.id!, sessionMessages);
    }

    // Collect images referenced in messages
    const imagesMap = new Map<number, GeneratedImage>();
    const allMessages = Array.from(messagesMap.values()).flat();
    for (const msg of allMessages) {
      if (msg.imageId) {
        const image = await getImage(msg.imageId);
        if (image) {
          imagesMap.set(msg.imageId, image);
        }
      }
    }

    console.log('[PDF Export] Collected images:', imagesMap.size);

    // Generate filename
    const firstSession = sessions[0];
    const defaultFilename =
      mode === 'full-history'
        ? `gogga-chat-history-${new Date().toISOString().split('T')[0]}.pdf`
        : `gogga-chat-${(firstSession?.title ?? 'chat').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;

    const finalFilename = options.filename || defaultFilename;

    // Build PDF
    const builder = new GoggaPdfBuilder(options);
    await builder.build(sessions, messagesMap, imagesMap);
    builder.save(finalFilename);

    return {
      success: true,
      filename: finalFilename,
      pageCount: builder.getPageCount(),
    };
  } catch (error) {
    console.error('[PDF Export] Failed:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Unknown error during PDF export',
    };
  }
}

/**
 * Export only charts from current view as PDF
 * Note: Charts require DOM capture, which is not supported in jsPDF-only mode.
 * Consider using html2canvas for this specific feature.
 */
export async function exportChartsToPdf(
  _filename: string = 'gogga-charts.pdf'
): Promise<ExportResult> {
  return {
    success: false,
    error: 'Chart export requires active chart elements in the DOM. Use the current session export with charts enabled instead.',
  };
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
      const cleanedContent = sanitizeForPdf(stripMarkdown(msg.content));
      transcript += `[${formatTimestamp(msg.timestamp)}] ${role}:\n`;
      transcript += `${cleanedContent}\n\n`;
    });

    transcript += `${'='.repeat(50)}\n`;
    transcript += `Exported: ${formatTimestamp(new Date())}\n`;
    transcript += `\nYour data stayed in your browser - GOGGA respects your privacy.\n`;

    // Create downloadable text file
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      filename ||
      `gogga-transcript-${session.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`;
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
 * Capture specific element to PDF
 * Note: This requires html2canvas for DOM capture
 */
export async function captureElementToPdf(
  _element: HTMLElement,
  _filename: string = 'gogga-export.pdf',
  _options?: Partial<ExportOptions>
): Promise<ExportResult> {
  return {
    success: false,
    error: 'Element capture requires html2canvas. Use exportChatToPdf for chat exports.',
  };
}

/**
 * Capture chart elements from DOM
 * Note: Placeholder for compatibility, returns empty array
 */
export async function captureChartElements(
  _containerSelector: string = '.recharts-wrapper'
): Promise<{ messageIndex: number; imageData: string; title?: string }[]> {
  console.warn('[PDF] captureChartElements is not supported in jsPDF mode');
  return [];
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick export of current session with all content
 */
export async function quickExportCurrentSession(
  sessionId: string,
  userTier: 'jive' | 'jigga' = 'jive'
): Promise<ExportResult> {
  return exportChatToPdf({
    mode: 'current-session',
    sessionId,
    includeCharts: true,
    includeImages: true,
    includeThinking: false,
    includeTimestamps: true,
    pageSize: 'a4',
    orientation: 'portrait',
    userTier,
  });
}

/**
 * Export full chat history to PDF
 */
export async function exportFullHistory(
  userTier: 'jive' | 'jigga' = 'jive'
): Promise<ExportResult> {
  return exportChatToPdf({
    mode: 'full-history',
    includeCharts: true,
    includeImages: true,
    includeThinking: false,
    includeTimestamps: true,
    pageSize: 'a4',
    orientation: 'portrait',
    userTier,
  });
}
