# Memory & Tool Retry Workflow Tests - December 2025

## Overview

Tests for the improved memory save behavior and tool retry workflow. These changes address user feedback about:
1. Unwanted `save_memory` calls during debugging/retry workflows
2. Auto-retry logic for `python_execute` with max 5 attempts
3. Better UX with brief progress messages during retries

## Issue Reference

**User Feedback (Dec 27, 2025)**:
- AI was creating duplicate memories like "SA ID validation debugging" during code retry workflows
- User wanted auto-retry until correct, with max 5 attempts before asking for manual retry
- User appreciated seeing the retry process (good UX)

## Changes Made

### 1. `gogga-backend/app/prompts.py` - TOOL_INSTRUCTIONS_MEMORY

Added explicit "WHEN NOT TO USE" rules:
- NEVER save memories during tool debugging/retry workflows
- NEVER save memories about code execution failures/fixes/solutions
- NEVER save "progress updates" about current task
- Added MEMORY TEST question: "Did the USER explicitly ask me to remember something about THEM?"
- Added ✅/❌ examples for correct vs incorrect behavior

### 2. `gogga-backend/app/prompts.py` - MATH_TOOL_INSTRUCTIONS

Added "TOOL RETRY RULES":
- Auto-retry up to 5 attempts maximum
- Brief progress messages ("Fixing...", "Almost...")
- After 5 fails, ask user for guidance
- Applies to ALL tools, not just python_execute

---

## Test Cases

### TC-MEM-001: No Memory Save During Code Debugging

**Scenario**: User asks for Python code that fails initially and requires retries

**Steps**:
1. Send: "Write a Python function to validate SA ID numbers"
2. If python_execute fails, observe AI behavior
3. Send: "retry" or "try again"
4. Observe AI behavior

**Expected**:
- ✅ AI retries with fixed code
- ✅ AI shows brief progress message ("Fixing...", "Let me fix that...")
- ❌ AI does NOT call `save_memory` with debugging info
- ❌ No memories created about "SA ID validation" or "debugging"

**Validation**:
- Check console logs for `[ToolHandler] Executing tool: save_memory`
- Should NOT see save_memory calls during retry workflow

---

### TC-MEM-002: Memory Only When User Explicitly Asks

**Scenario**: User explicitly asks to remember something

**Steps**:
1. Send: "My name is Thabo, please remember it"
2. Observe AI behavior

**Expected**:
- ✅ AI calls `save_memory(title="My name is Thabo", ...)`
- ✅ AI confirms: "Sharp, Thabo! I'll remember that!"
- ✅ Memory appears in user's memory list

---

### TC-MEM-003: No Memory For Successful Solutions

**Scenario**: User asks for code, it works on first try

**Steps**:
1. Send: "Calculate 25 * 4 using python"
2. AI executes python_execute successfully

**Expected**:
- ✅ AI shows the calculation result
- ❌ AI does NOT save memory about the calculation
- ❌ No memory created about "calculation approach"

---

### TC-RETRY-001: Auto-Retry Up To 5 Times

**Scenario**: Tool fails repeatedly

**Steps**:
1. Send a complex request that might fail (e.g., advanced math edge case)
2. Observe retry behavior

**Expected**:
- ✅ AI auto-retries with fixes
- ✅ Shows brief progress messages (one line each)
- ✅ After 5 attempts, asks user: "Want me to try a different approach?"
- ❌ Does NOT retry indefinitely

---

### TC-RETRY-002: Success Before 5 Attempts

**Scenario**: Tool succeeds after 2-3 retries

**Steps**:
1. Send: "Write a function with deliberate minor issue that AI will fix"
2. Observe retry and success

**Expected**:
- ✅ AI retries and succeeds
- ✅ Shows the working solution
- ✅ Explains the code when successful
- ❌ No memory saved about debugging process

---

### TC-RETRY-003: Brief Progress Messages (UX)

**Scenario**: During retries, user should see progress

**Steps**:
1. Trigger a retry scenario
2. Observe progress messages

**Expected**:
- ✅ Messages like "Eish, fixing...", "Let me try again...", "Almost..."
- ✅ Messages are brief (one line)
- ✅ Messages maintain GOGGA personality (SA slang OK)
- ❌ Messages are NOT verbose paragraphs

---

## Manual Testing Checklist

| Test ID | Description | PASS/FAIL | Notes |
|---------|-------------|-----------|-------|
| TC-MEM-001 | No memory during debugging | | |
| TC-MEM-002 | Memory when user asks | | |
| TC-MEM-003 | No memory for solutions | | |
| TC-RETRY-001 | Max 5 retry attempts | | |
| TC-RETRY-002 | Success before 5 | | |
| TC-RETRY-003 | Brief progress messages | | |

---

## Console Log Verification

When testing, check browser console for these patterns:

### ❌ Should NOT see (during retry workflow):
```
[ToolHandler] Executing tool: save_memory {
  "title": "SA ID validation...",
  ...
}
```

### ✅ Should see (during retry workflow):
```
[GOGGA] SSE received tool_calls: [{ "name": "python_execute", ... }]
[GOGGA] Tool execution...
```

### ✅ Should see (when user asks to remember):
```
[ToolHandler] Executing tool: save_memory {
  "title": "My name is Thabo",
  ...
}
```

---

## Related Files

| File | Purpose |
|------|---------|
| `gogga-backend/app/prompts.py` | Tool instructions with memory/retry rules |
| `gogga-frontend/src/lib/toolHandler.ts` | Frontend tool execution |
| `gogga-frontend/src/app/ChatClient.tsx` | Chat interface with tool handling |

---

## Notes

- The 5-retry limit is **prompt-based** (not code-enforced)
- In very long conversations, LLM might lose track - this is acceptable edge case
- Frontend doesn't track retry count - it's entirely LLM-driven

---

## Author

Chat Interface Audit - December 27, 2025
