# Thinking & CePO Display Architecture

## Overview

This document describes the architecture for displaying AI reasoning/thinking content in the GOGGA chat interface, ensuring that thinking blocks from both Qwen32B (thinking mode) and CePO-enhanced responses are ALWAYS displayed verbosely in the ChatTerminal.

## Architecture Summary

### Key Requirements
- **ONLY Qwen32B does reasoning** (thinking mode with temp=0.6, top_p=0.95)
- **CePO is used by both non-reasoning Qwen32B and non-reasoning Qwen235B**
- **Thinking content must ALWAYS be visible** in the same terminal as math tools
- **Robust implementation with testing** required

## Backend Implementation (ai_service.py)

### 1. Enhanced Thinking Detection

**Constants Added:**
```python
# All reasoning tags supported by OptiLLM/CePO (cot_reflection approach)
REASONING_OPEN_TAGS: Final[tuple[str, ...]] = (
    "<think", "<thinking", "<reflection", "<plan"
)
REASONING_CLOSE_TAGS: Final[tuple[str, ...]] = (
    "</think", "</thinking", "</reflection", "</plan"
)
```

**Streaming Logic Enhancement:**
- **Before**: Only detected `<think` tags in JIGGA thinking_mode
- **After**: Detects ALL reasoning tags (`<thinking>`, `<reflection>`, `<plan>`, `<think>`) for both thinking_mode AND CePO responses
- **Streaming Events**: `thinking_start`, `thinking`, `thinking_end` sent to frontend

**CePO Response Processing:**
- **Before**: CePO responses returned `"thinking": None`
- **After**: Uses `parse_enhanced_response()` to extract thinking sections from CePO response
- **Extracts**: `<thinking>`, `<reflection>`, `<plan>` sections and combines them
- **Stores**: Combined thinking content in message metadata for display

### 2. OptiLLM Integration

**Enhancement Levels:**
- **FREE**: LIGHT (re-read only)
- **JIVE**: MODERATE (CoT + re-read) 
- **JIGGA**: FULL (CoT + re-read + planning)

**Tag Injection:**
- `cot_reflection` approach outputs: `<thinking>`, `<reflection>`, `<output>` tags
- `planning` approach adds: `<plan>` tags
- `re2` approach wraps user message for re-reading

**Response Parsing:**
```python
def parse_enhanced_response(content: str) -> dict[str, str]:
    # Extracts <thinking>, <reflection>, <plan>, <output> sections
    # Returns clean output with tags removed
```

## Frontend Implementation (ChatClient.tsx)

### 1. Streaming Event Handling

**Enhanced Content Event Detection:**
```typescript
case 'content':
  accumulatedContent += eventData.content || '';
  // Check for ALL reasoning tags (think, thinking, reflection, plan)
  const reasoningOpenTags = ['<think', '<thinking>', '<reflection>', '<plan>'];
  const reasoningCloseTags = ['</think', '</thinking>', '</reflection>', '</plan>'];
  
  if (hasOpenTag && !isStreamingThinking) {
    setIsStreamingThinking(true);
  }
  if (hasCloseTag && isStreamingThinking) {
    setIsStreamingThinking(false);
    // Extract all reasoning sections
    const thinkingPatterns = [
      /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi,
      /<reflection>([\s\S]*?)<\/reflection>/gi,
      /<plan>([\s\S]*?)<\/plan>/gi,
    ];
    // ... extract and combine
  }
```

**Thinking State Management:**
- `streamingThinking`: Accumulates thinking content during streaming
- `isStreamingThinking`: Boolean flag for active thinking
- `lastGoggaSolveThinking`: Saved for completed messages

### 2. ChatTerminal Rendering

**Always Visible Logic:**
```typescript
// Before: Only showed with math tools
{(tier === 'jive' || tier === 'jigga') &&
  (terminalActive || terminalLogs.length > 0) && (
    <ChatTerminal ... />
  )}

// After: Shows for thinking OR math tools
{(tier === 'jive' || tier === 'jigga') &&
  (terminalActive || terminalLogs.length > 0 || isStreamingThinking || streamingThinking) && (
    <ChatTerminal ... />
  )}
```

**Completed Message Display:**
```typescript
// Before: Only with math tools
{m.role === 'assistant' &&
  m.meta?.math_tool_count &&
  m.meta.math_tool_count > 0 &&
  lastGoggaSolveLogs.length > 0 &&
  i === displayMessages.length - 1 && (
    <ChatTerminal ... />
  )}

// After: With math tools OR thinking content
{m.role === 'assistant' &&
  ((m.meta?.math_tool_count && m.meta.math_tool_count > 0 && lastGoggaSolveLogs.length > 0) ||
   lastGoggaSolveThinking) &&
  i === displayMessages.length - 1 && (
    <ChatTerminal ... />
  )}
```

### 3. Content Cleaning

**Enhanced Regex Patterns:**
```typescript
// Clean ALL reasoning tags from content
let cleanContent = accumulatedContent
  // Complete blocks for all reasoning tag types
  .replace(/<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi, '')
  .replace(/<reflection>([\s\S]*?)<\/reflection>/gi, '')
  .replace(/<plan>([\s\S]*?)<\/plan>/gi, '')
  .replace(/<output>([\s\S]*?)<\/output>/gi, (_, content) => content) // Keep output content
  // ... handle unclosed/orphaned tags
```

## ChatTerminal Component (ChatTerminal.tsx)

### 1. Collapsible Thinking Block

**Design:**
- Positioned above GoggaSolve terminal
- Brain icon with "AI Thinking" label
- Processing indicator when active
- Collapsible with smooth animations

**Props:**
- `thinkingContent`: The accumulated thinking text
- `isThinking`: Boolean for active processing

### 2. Premium Design System Integration

**Color Palette:**
- **Before**: Hardcoded gray colors (`bg-gray-800`, `text-gray-300`)
- **After**: Design system colors (`bg-primary-800`, `text-primary-100`, `text-accent-gold`)

**Typography:**
- **Before**: Fixed sizes (`text-xs`, `text-sm`)
- **After**: Fluid typography (`text-sm`, `text-xs` with design system)

**Spacing & Shadows:**
- **Before**: Default Tailwind spacing (`px-3`, `py-2`)
- **After**: Premium spacing (`px-4`, `py-3`) with `shadow-elevated`

**Border Radius:**
- **Before**: `rounded-lg`
- **After**: `rounded-xl` (premium feel)

### 3. Status Indicators

**Thinking Status:**
- Brain icon (purple → gold)
- "Processing..." text when active
- Chevron up/down for expand/collapse

**Terminal Status:**
- Terminal icon with "GoggaSolve" label
- Live/Complete indicators
- Tool running badges
- Auto-scroll controls

## Data Flow

### Streaming Path (Qwen32B Thinking Mode)
```
Backend (ai_service.py)
  ↓ (SSE events)
  thinking_start
  thinking (content chunks)
  thinking_end
  content (main response)
  done
  ↓
Frontend (ChatClient.tsx)
  ↓
  setIsStreamingThinking(true)
  setStreamingThinking(accumulated)
  setIsStreamingThinking(false)
  ↓
  ChatTerminal renders with thinkingContent
```

### CePO Path (Non-Streaming)
```
Backend (ai_service.py)
  ↓
  CePO.generate_with_cepo()
  parse_enhanced_response()
  Extract thinking sections
  ↓
  Return { response, thinking, meta }
  ↓
Frontend (ChatClient.tsx)
  ↓
  Set lastGoggaSolveThinking(data.thinking)
  ↓
  ChatTerminal renders with thinkingContent
```

## Testing

### Backend Tests
- ✅ `test_optillm_enhancements.py`: 37 tests pass
- ✅ `test_router_infrastructure.py`: 63 tests pass
- ✅ `test_usage_monitoring.py`: 36 tests pass (34 passed, 2 skipped)
- ✅ `parse_enhanced_response()` function tests all tag types
- ✅ Empty response bug fixed (Dec 21, 2025)

### Frontend Tests
- TypeScript compilation (with Next.js build system)
- Component rendering with thinking content
- State management for streaming thinking
- ✅ Empty response fallback in ChatClient.tsx

### December 21, 2025 Bug Fix
**Issue**: Empty responses for math/reasoning queries
- Backend: Fixed `any()` pattern bug in `ai_service.py:1769-1790`
- Frontend: Added empty response fallback in `ChatClient.tsx:921`
- Symptom: `logsCount: 14` but `responseLength: 0`

## Key Files Modified

### Backend
- `gogga-backend/app/services/ai_service.py`
  - Enhanced thinking detection constants
  - Updated streaming logic for all reasoning tags
  - CePO response parsing for thinking content

### Frontend
- `gogga-frontend/src/app/ChatClient.tsx`
  - Enhanced content event handling
  - Always-visible terminal logic
  - Content cleaning for all tag types
  - Non-streaming CePO thinking storage

- `gogga-frontend/src/components/ChatTerminal.tsx`
  - Premium design system integration
  - Collapsible thinking block
  - Enhanced status indicators

## Serena Memory Integration

This document should be linked from:
- `architecture.md` - Core architecture reference
- `optillm_enhancements.md` - OptiLLM implementation details
- `cepo_configuration.md` - CePO sidecar configuration
- `tech_stack.md` - Technology stack documentation

## Future Enhancements

1. **Real-time Thinking Visualization**: Animated flow diagrams showing reasoning steps
2. **Thinking Analytics**: Track thinking time vs. response quality
3. **User Control**: Allow users to expand/collapse thinking sections
4. **Export Thinking**: Save reasoning process for documentation
5. **Thinking Search**: Search through historical thinking content

## Troubleshooting

### Common Issues
1. **Thinking not displaying**: Check if `isStreamingThinking` or `streamingThinking` is set
2. **CePO thinking missing**: Verify `parse_enhanced_response()` is extracting sections
3. **Terminal not showing**: Ensure tier is JIVE/JIGGA and thinking OR math tools are active
4. **Content cleaning issues**: Check regex patterns for tag removal

### Debug Commands
```bash
# Backend logs
tail -f gogga-backend/logs/app.log | grep -i "thinking\|cepo"

# Frontend console
console.log('[GOGGA] thinking state:', { streamingThinking, isStreamingThinking, lastGoggaSolveThinking })
```