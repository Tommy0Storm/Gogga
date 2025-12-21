# PDF Export V2 Implementation (December 2025)

> **Status:** ✅ COMPLETE - Rewritten to use jsPDF directly
> **Location:** `gogga-frontend/src/lib/pdfExporter.ts`
> **Legacy backup:** `gogga-frontend/src/lib/pdfExporter-legacy.ts`

## Problem Solved

The original html2pdf.js/html2canvas approach caused **blank PDFs** because:
1. Off-screen rendering with `top: -99999px` and `opacity: 0` doesn't work with html2canvas
2. Canvas size limits caused issues with large documents
3. Font loading timing issues

## New Implementation

Uses **jsPDF directly** for reliable text rendering:

```typescript
import { jsPDF } from 'jspdf';

class GoggaPdfBuilder {
  private doc: jsPDF;
  // ... renders content directly to PDF using jsPDF API
}
```

## Features

| Feature | Status |
|---------|--------|
| Export current session | ✅ |
| Export specific session by ID | ✅ |
| Export full chat history | ✅ |
| Include AI-generated images | ✅ |
| Gogga branding (logo, footer) | ✅ |
| Sovereign AI privacy banner | ✅ |
| Proper page breaks | ✅ |
| Thinking blocks (JIGGA) | ✅ |
| Timestamps | ✅ |
| Unicode text sanitization | ✅ |
| Chart capture (DOM) | ❌ (requires html2canvas) |

## Unicode Sanitization (Added December 21, 2025)

jsPDF's Helvetica font doesn't support extended Unicode characters. The `sanitizeForPdf()` function converts unsupported characters to ASCII equivalents:

```typescript
function sanitizeForPdf(text: string): string {
  // Handles:
  // - Emojis (removed)
  // - Accented characters (àáâ → a)
  // - Smart quotes ("" → "")
  // - Em/en dashes (— → -)
  // - Box drawing characters (│ → |)
  // - Greek letters (π → pi)
  // - Currency symbols (€ → EUR)
  // - Final cleanup: removes any remaining non-ASCII
}
```

Applied to:
- Main message content
- Thinking blocks
- Image captions
- Transcript exports

## Key Functions

```typescript
// Main export function
export async function exportChatToPdf(options: ExportOptions): Promise<ExportResult>

// Quick export (current session)
export async function quickExportCurrentSession(
  sessionId: string,
  userTier: 'jive' | 'jigga' = 'jive'
): Promise<ExportResult>

// Full history export
export async function exportFullHistory(
  userTier: 'jive' | 'jigga' = 'jive'
): Promise<ExportResult>

// Plain text transcript
export async function exportTranscript(
  sessionId: string,
  filename?: string
): Promise<ExportResult>
```

## Export Options

```typescript
interface ExportOptions {
  mode: 'current-session' | 'single-session' | 'full-history';
  sessionId?: string;
  includeCharts?: boolean;    // Default: true (but no DOM capture)
  includeImages?: boolean;    // Default: true
  includeThinking?: boolean;  // Default: false (JIGGA only)
  includeTimestamps?: boolean; // Default: true
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  filename?: string;
  margin?: number | number[];
  userName?: string;
  userTier: 'jive' | 'jigga'; // REQUIRED - premium only
}
```

## PDF Styling (Updated December 21, 2025)

- **Colors:** Monochrome palette matching Gogga UI
- **Fonts:** Helvetica (built into jsPDF), minimum 11pt for all text (Quicksand 400 equivalent)
- **User messages:** Dark gray (#374151) background with WHITE text (right-aligned)
- **Assistant messages:** Light gray (#e5e7eb) background with BLACK text (left-aligned)
- **Thinking blocks:** Amber background with left border
- **Images:** Centered with caption (prompt text)
- **Gogga Logo:** SVG embedded in header (with fallback text)
- **Tables:** Converted to plain text format with proper column alignment
- **Page breaks:** Improved multi-page message handling with continuation indicators
- **Text sanitization:** Unicode → ASCII for Helvetica compatibility

## Dependencies

- `jspdf: ^3.0.4` (added December 2025)
- Fetches chat data from RxDB via `./db` imports

## Usage in ExportModal

```tsx
import { exportChatToPdf, ExportOptions } from '@/lib/pdfExporter';

const result = await exportChatToPdf({
  mode: 'current-session',
  sessionId,
  userTier: premiumTier,
  includeImages: true,
  includeTimestamps: true,
});

if (result.success) {
  console.log(`Exported: ${result.filename}`);
}
```

## Chart Export Limitation

Chart DOM capture (via html2canvas) is **not supported** in the jsPDF-only implementation. To export charts:
1. Use "Export Current Session" with charts visible
2. Charts are embedded as base64 images if captured separately

## Testing

1. Start frontend: `cd gogga-frontend && pnpm dev`
2. Open chat interface with JIVE/JIGGA tier
3. Click Export button in header
4. Test "Export Current Chat" and "Export All Chats"
5. Verify Unicode characters (emojis, accents, symbols) render as ASCII equivalents
