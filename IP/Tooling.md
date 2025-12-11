# GoggaToolShed - Enterprise Tool Calling Architecture v2.0

## Executive Summary

GoggaToolShed is GOGGA's enterprise-grade tool calling framework designed for:
- **Scalability**: Handle 2000+ concurrent users
- **Reliability**: Graceful fallbacks, automatic retries
- **Accuracy**: Deterministic math execution, verified results
- **Extensibility**: Plugin architecture for new tools
- **User Control**: Manual tool forcing via UI ToolShed panel

---

## Part 1: Cerebras Tool Calling Requirements

### Critical Schema Requirements

Based on Cerebras documentation, tool schemas MUST include:

```python
{
    "type": "function",
    "function": {
        "name": "tool_name",
        "strict": True,  # REQUIRED by Cerebras
        "description": "Clear description for LLM",
        "parameters": {
            "type": "object",
            "properties": {...},
            "required": [...],
            "additionalProperties": False  # REQUIRED for nested objects
        }
    }
}
```

### Model-Specific Behavior

| Model | Multi-turn | Tool Calls Array | Notes |
|-------|------------|------------------|-------|
| **Qwen 3 32B** | ✅ Full support | Can be non-empty | Recommended for complex tool chains |
| **Llama 3.3 70B** | ⚠️ Limited | Must be `[]` on assistant turns | Clear array after each turn |
| **Llama 3.1 8B** | ✅ Via CePO | CePO handles | Reasoning through CePO |

### Llama 3.3 70B Workaround

When using Llama 3.3 70B, assistant messages must have empty tool_calls:

```python
# After tool execution, for Llama 3.3 70B:
messages.append({
    "role": "assistant",
    "content": response_content,
    "tool_calls": []  # MUST be empty for Llama 3.3
})

messages.append({
    "role": "tool",
    "tool_call_id": call_id,
    "content": json.dumps(result)
})
```

---

## Part 2: Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GoggaToolShed                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     USER INTERFACE LAYER                             │    │
│  │                                                                      │    │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │    │
│  │   │  ToolShed    │  │   Chat       │  │  GoggaSolve  │              │    │
│  │   │   Panel      │  │   Input      │  │   Terminal   │              │    │
│  │   │ (Force Tool) │  │              │  │              │              │    │
│  │   └──────────────┘  └──────────────┘  └──────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     ORCHESTRATION LAYER                              │    │
│  │                                                                      │    │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │    │
│  │   │   Tool       │  │   Context    │  │   Force      │              │    │
│  │   │  Registry    │  │   Builder    │  │   Handler    │              │    │
│  │   └──────────────┘  └──────────────┘  └──────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     EXECUTION LAYER                                  │    │
│  │                                                                      │    │
│  │   ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │    │
│  │   │   Math     │ │   Chart    │ │   Image    │ │   Memory   │       │    │
│  │   │  Engine    │ │  Engine    │ │  Engine    │ │  Engine    │       │    │
│  │   │ (Backend)  │ │ (Frontend) │ │  (Hybrid)  │ │ (Frontend) │       │    │
│  │   └────────────┘ └────────────┘ └────────────┘ └────────────┘       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: ToolShed UI Component

### 3.1 Design Specifications

The ToolShed panel appears as a slide-out drawer or modal, allowing users to:
1. **Browse available tools** by category
2. **Force a specific tool** for the next message
3. **Configure tool parameters** before execution
4. **View tool execution history**

### 3.2 Component Structure

```
gogga-frontend/src/components/
├── toolshed/
│   ├── ToolShedPanel.tsx        # Main panel container
│   ├── ToolCategoryList.tsx     # Category navigation
│   ├── ToolCard.tsx             # Individual tool display
│   ├── ToolParameterForm.tsx    # Parameter input form
│   ├── ToolExecutionLog.tsx     # Execution history
│   ├── ForcedToolBadge.tsx      # Shows active forced tool
│   └── index.ts                 # Exports
```

### 3.3 ToolShed Panel UI (Monochrome Theme)

```tsx
// ToolShedPanel.tsx - Main container
interface ToolShedPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onForceToolSelect: (tool: ToolDefinition | null) => void;
  forcedTool: ToolDefinition | null;
  tier: 'free' | 'jive' | 'jigga';
}

const TOOL_CATEGORIES = [
  { id: 'math', label: 'Math & Finance', icon: '∑' },
  { id: 'visualization', label: 'Charts & Graphs', icon: '◷' },
  { id: 'creative', label: 'Images', icon: '◐' },
  { id: 'memory', label: 'Memory', icon: '◉' },
] as const;
```

### 3.4 Tool Card Design

```
┌────────────────────────────────────────────┐
│ ∑  math_financial                    JIVE+ │
├────────────────────────────────────────────┤
│ Financial calculations including compound  │
│ interest, NPV, IRR, loan payments.         │
│                                            │
│ Operations:                                │
│ • compound_interest  • future_value        │
│ • loan_payment       • npv                 │
│ • goal_savings       • irr                 │
│                                            │
│ ┌────────────────┐  ┌────────────────────┐ │
│ │   Force Tool   │  │  Configure Params  │ │
│ └────────────────┘  └────────────────────┘ │
└────────────────────────────────────────────┘
```

### 3.5 Force Tool Flow

```
User clicks "Force Tool" on math_financial
        │
        ▼
┌─────────────────────────────────────┐
│  Parameter Form (Optional)           │
│  ─────────────────────────────       │
│  Operation: [compound_interest ▼]    │
│  Principal: [____________]           │
│  Rate (%):  [____________]           │
│  Periods:   [____________]           │
│                                      │
│  [ Cancel ]        [ Force & Send ]  │
└─────────────────────────────────────┘
        │
        ▼
Badge appears above chat input:
┌─────────────────────────────────────┐
│ [×] Forcing: math_financial          │
│     (compound_interest)              │
└─────────────────────────────────────┘
        │
        ▼
User types message, tool is GUARANTEED to be called
```

---

## Part 4: Backend Force Tool Implementation

### 4.1 API Endpoint Extension

```python
# gogga-backend/app/api/v1/endpoints/chat.py

class ChatRequest(BaseModel):
    message: str
    user_id: str
    user_tier: str = "free"
    history: list[dict] | None = None
    
    # NEW: Force tool parameters
    force_tool: str | None = None  # Tool name to force
    force_tool_params: dict | None = None  # Pre-filled parameters

@router.post("/chat/stream-with-tools")
async def chat_stream_with_tools(request: ChatRequest):
    # If force_tool is specified, inject into system prompt
    if request.force_tool:
        return await AIService.generate_with_forced_tool(
            user_id=request.user_id,
            message=request.message,
            forced_tool=request.force_tool,
            forced_params=request.force_tool_params,
            tier=request.user_tier
        )
    # Normal flow
    ...
```

### 4.2 Forced Tool Execution

```python
# gogga-backend/app/services/ai_service.py

@staticmethod
async def generate_with_forced_tool(
    user_id: str,
    message: str,
    forced_tool: str,
    forced_params: dict | None,
    tier: str
):
    """
    Execute a forced tool call without LLM decision.
    
    Flow:
    1. Execute the tool directly with provided/inferred params
    2. Send results to LLM for interpretation
    3. Return formatted response
    """
    from app.tools.executor import execute_math_tool, execute_backend_tool
    
    # Get tool definition
    tool_def = get_tool_by_name(forced_tool)
    if not tool_def:
        raise ValueError(f"Unknown tool: {forced_tool}")
    
    # If params not provided, ask LLM to infer from message
    if not forced_params:
        forced_params = await infer_tool_params(message, tool_def)
    
    # Execute the tool
    if forced_tool.startswith("math_"):
        result = await execute_math_tool(forced_tool, forced_params, tier)
    else:
        result = await execute_backend_tool(forced_tool, forced_params)
    
    # Now ask LLM to interpret and present results
    interpretation_prompt = f"""
    The user asked: "{message}"
    
    I executed {forced_tool} with parameters: {json.dumps(forced_params)}
    
    Result: {json.dumps(result)}
    
    Please explain this result to the user in a friendly, conversational way.
    Include the key numbers and what they mean.
    """
    
    # Get LLM interpretation (can also call chart tool here)
    return await generate_response_with_tools_stream(...)
```

### 4.3 Parameter Inference

```python
async def infer_tool_params(message: str, tool_def: dict) -> dict:
    """
    Use LLM to extract tool parameters from natural language.
    
    Example:
    Message: "calculate compound interest on R50,000 at 10% for 5 years"
    Tool: math_financial
    
    Inferred params: {
        "operation": "compound_interest",
        "principal": 50000,
        "rate": 0.10,
        "periods": 5
    }
    """
    schema = tool_def["function"]["parameters"]
    
    prompt = f"""
    Extract parameters for the {tool_def["function"]["name"]} tool from this message:
    "{message}"
    
    Required schema:
    {json.dumps(schema, indent=2)}
    
    Return ONLY valid JSON matching the schema.
    """
    
    response = await client.chat.completions.create(
        model="qwen-3-32b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,  # Low temperature for precise extraction
        response_format={"type": "json_object"}
    )
    
    return json.loads(response.choices[0].message.content)
```

---

## Part 5: Tool Registry System

### 5.1 Centralized Tool Registry

```python
# gogga-backend/app/tools/registry.py

from typing import TypedDict, Callable, Any
from enum import Enum

class ToolCategory(str, Enum):
    MATH = "math"
    VISUALIZATION = "visualization"
    CREATIVE = "creative"
    MEMORY = "memory"
    DATA = "data"  # Future
    INTEGRATION = "integration"  # Future

class ToolMetadata(TypedDict):
    name: str
    category: ToolCategory
    description: str
    tier_required: str  # "free", "jive", "jigga"
    execution_location: str  # "backend", "frontend", "hybrid"
    avg_latency_ms: int
    parameters: dict
    examples: list[dict]

class ToolRegistry:
    """Singleton registry for all GoggaToolShed tools."""
    
    _instance = None
    _tools: dict[str, ToolMetadata] = {}
    _executors: dict[str, Callable] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def register(
        self, 
        name: str, 
        metadata: ToolMetadata, 
        executor: Callable
    ) -> None:
        """Register a new tool."""
        self._tools[name] = metadata
        self._executors[name] = executor
    
    def get_tools_for_tier(self, tier: str) -> list[ToolMetadata]:
        """Get all tools available for a tier."""
        tier_order = {"free": 0, "jive": 1, "jigga": 2}
        user_level = tier_order.get(tier.lower(), 0)
        
        return [
            tool for tool in self._tools.values()
            if tier_order.get(tool["tier_required"], 0) <= user_level
        ]
    
    def get_tools_by_category(
        self, 
        category: ToolCategory, 
        tier: str
    ) -> list[ToolMetadata]:
        """Get tools in a category for a tier."""
        available = self.get_tools_for_tier(tier)
        return [t for t in available if t["category"] == category]
    
    def execute(
        self, 
        name: str, 
        arguments: dict, 
        tier: str
    ) -> Any:
        """Execute a tool by name."""
        if name not in self._tools:
            raise ValueError(f"Unknown tool: {name}")
        
        tool = self._tools[name]
        if not self._is_tier_allowed(tier, tool["tier_required"]):
            raise PermissionError(
                f"Tool {name} requires {tool['tier_required']} tier"
            )
        
        executor = self._executors[name]
        return executor(arguments)
    
    def _is_tier_allowed(self, user_tier: str, required_tier: str) -> bool:
        tier_order = {"free": 0, "jive": 1, "jigga": 2}
        return tier_order.get(user_tier.lower(), 0) >= tier_order.get(required_tier, 0)

# Global registry instance
tool_registry = ToolRegistry()
```

### 5.2 Tool Registration Pattern

```python
# gogga-backend/app/tools/math_tools.py

from app.tools.registry import tool_registry, ToolCategory

# Register math_financial
tool_registry.register(
    name="math_financial",
    metadata={
        "name": "math_financial",
        "category": ToolCategory.MATH,
        "description": "Financial calculations including compound interest, NPV, IRR, loan payments, and savings goals.",
        "tier_required": "jive",
        "execution_location": "backend",
        "avg_latency_ms": 50,
        "parameters": {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["compound_interest", "simple_interest", "loan_payment", 
                             "future_value", "present_value", "npv", "irr", "goal_savings"]
                },
                "principal": {"type": "number"},
                "rate": {"type": "number"},
                "periods": {"type": "integer"},
                "payment": {"type": "number"}
            },
            "required": ["operation"]
        },
        "examples": [
            {
                "description": "Calculate compound interest",
                "params": {"operation": "compound_interest", "principal": 10000, "rate": 0.08, "periods": 10}
            },
            {
                "description": "Monthly loan payment",
                "params": {"operation": "loan_payment", "principal": 500000, "rate": 0.105, "periods": 240}
            }
        ]
    },
    executor=execute_math_financial
)
```

---

## Part 6: Frontend ToolShed Implementation

### 6.1 ToolShed State Management

```typescript
// gogga-frontend/src/lib/toolshedStore.ts

import { create } from 'zustand';

interface ToolDefinition {
  name: string;
  category: 'math' | 'visualization' | 'creative' | 'memory';
  description: string;
  tierRequired: 'free' | 'jive' | 'jigga';
  parameters: Record<string, unknown>;
  examples: Array<{ description: string; params: Record<string, unknown> }>;
}

interface ForcedTool {
  tool: ToolDefinition;
  params: Record<string, unknown> | null;
}

interface ToolShedState {
  // Panel state
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  
  // Available tools (fetched from backend)
  tools: ToolDefinition[];
  setTools: (tools: ToolDefinition[]) => void;
  
  // Forced tool
  forcedTool: ForcedTool | null;
  forceTool: (tool: ToolDefinition, params?: Record<string, unknown>) => void;
  clearForcedTool: () => void;
  
  // Execution history
  executionHistory: ToolExecution[];
  addExecution: (execution: ToolExecution) => void;
}

interface ToolExecution {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  result: unknown;
  latencyMs: number;
  timestamp: Date;
  success: boolean;
}

export const useToolShed = create<ToolShedState>((set) => ({
  isOpen: false,
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  
  tools: [],
  setTools: (tools) => set({ tools }),
  
  forcedTool: null,
  forceTool: (tool, params = null) => set({ 
    forcedTool: { tool, params },
    isOpen: false  // Close panel after selection
  }),
  clearForcedTool: () => set({ forcedTool: null }),
  
  executionHistory: [],
  addExecution: (execution) => set((state) => ({
    executionHistory: [execution, ...state.executionHistory].slice(0, 50)
  })),
}));
```

### 6.2 ToolShed Panel Component

```tsx
// gogga-frontend/src/components/toolshed/ToolShedPanel.tsx

'use client';

import { useToolShed } from '@/lib/toolshedStore';
import { ToolCard } from './ToolCard';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  { id: 'math', label: 'Math & Finance', icon: '∑' },
  { id: 'visualization', label: 'Charts', icon: '◷' },
  { id: 'creative', label: 'Images', icon: '◐' },
  { id: 'memory', label: 'Memory', icon: '◉' },
] as const;

export function ToolShedPanel() {
  const { isOpen, closePanel, tools, forceTool, forcedTool } = useToolShed();
  const [activeCategory, setActiveCategory] = useState<string>('math');
  
  const filteredTools = tools.filter(t => t.category === activeCategory);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={closePanel}
            className="fixed inset-0 bg-black z-40"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-neutral-900 
                       border-l border-neutral-200 dark:border-neutral-800 z-50
                       shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                  GoggaToolShed
                </h2>
                <button
                  onClick={closePanel}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-neutral-500 mt-1">
                Force a specific tool for your next message
              </p>
            </div>
            
            {/* Category Tabs */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-800">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-1 py-3 text-center text-sm transition-colors
                    ${activeCategory === cat.id 
                      ? 'border-b-2 border-neutral-900 dark:border-white font-medium' 
                      : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                  <span className="mr-1">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
            
            {/* Tool List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredTools.map(tool => (
                <ToolCard
                  key={tool.name}
                  tool={tool}
                  onForce={(params) => forceTool(tool, params)}
                  isForced={forcedTool?.tool.name === tool.name}
                />
              ))}
              
              {filteredTools.length === 0 && (
                <div className="text-center text-neutral-500 py-8">
                  No tools in this category for your tier
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### 6.3 Tool Card Component

```tsx
// gogga-frontend/src/components/toolshed/ToolCard.tsx

interface ToolCardProps {
  tool: ToolDefinition;
  onForce: (params?: Record<string, unknown>) => void;
  isForced: boolean;
}

export function ToolCard({ tool, onForce, isForced }: ToolCardProps) {
  const [showParams, setShowParams] = useState(false);
  const [params, setParams] = useState<Record<string, unknown>>({});
  
  const tierBadge = {
    free: 'FREE',
    jive: 'JIVE+',
    jigga: 'JIGGA',
  }[tool.tierRequired];
  
  return (
    <div className={`
      border rounded-lg p-4 transition-all
      ${isForced 
        ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800' 
        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-mono text-sm font-medium text-neutral-900 dark:text-white">
            {tool.name}
          </h3>
          <span className="text-xs text-neutral-500">{tierBadge}</span>
        </div>
        {isForced && (
          <span className="text-xs bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 
                         px-2 py-1 rounded font-medium">
            FORCED
          </span>
        )}
      </div>
      
      {/* Description */}
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
        {tool.description}
      </p>
      
      {/* Examples */}
      {tool.examples && tool.examples.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-neutral-500 mb-1">Examples:</p>
          <div className="flex flex-wrap gap-1">
            {tool.examples.slice(0, 3).map((ex, i) => (
              <button
                key={i}
                onClick={() => {
                  setParams(ex.params);
                  setShowParams(true);
                }}
                className="text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 
                         rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                {ex.description}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Parameter Form (expandable) */}
      <AnimatePresence>
        {showParams && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <ToolParameterForm
              schema={tool.parameters}
              values={params}
              onChange={setParams}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setShowParams(!showParams)}
          className="flex-1 text-sm py-2 border border-neutral-300 dark:border-neutral-600 
                   rounded hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          {showParams ? 'Hide Params' : 'Configure'}
        </button>
        <button
          onClick={() => onForce(showParams ? params : undefined)}
          className="flex-1 text-sm py-2 bg-neutral-900 dark:bg-white 
                   text-white dark:text-neutral-900 rounded font-medium
                   hover:bg-neutral-800 dark:hover:bg-neutral-100"
        >
          Force Tool
        </button>
      </div>
    </div>
  );
}
```

### 6.4 Forced Tool Badge (Chat Input)

```tsx
// gogga-frontend/src/components/toolshed/ForcedToolBadge.tsx

export function ForcedToolBadge() {
  const { forcedTool, clearForcedTool } = useToolShed();
  
  if (!forcedTool) return null;
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 
                    rounded-t-lg border-b border-neutral-200 dark:border-neutral-700">
      <span className="text-sm text-neutral-600 dark:text-neutral-400">
        Forcing:
      </span>
      <span className="text-sm font-mono font-medium text-neutral-900 dark:text-white">
        {forcedTool.tool.name}
      </span>
      {forcedTool.params && (
        <span className="text-xs text-neutral-500">
          ({Object.keys(forcedTool.params).length} params set)
        </span>
      )}
      <button
        onClick={clearForcedTool}
        className="ml-auto text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        ✕
      </button>
    </div>
  );
}
```

---

## Part 7: API Endpoints

### 7.1 Tool Registry Endpoint

```python
# gogga-backend/app/api/v1/endpoints/tools.py

@router.get("/tools")
async def list_tools(tier: str = Query("free")):
    """
    List all tools available for a tier.
    Used by frontend ToolShed panel.
    """
    from app.tools.registry import tool_registry
    
    tools = tool_registry.get_tools_for_tier(tier)
    
    return {
        "tools": [
            {
                "name": t["name"],
                "category": t["category"],
                "description": t["description"],
                "tierRequired": t["tier_required"],
                "parameters": t["parameters"],
                "examples": t["examples"],
                "avgLatencyMs": t["avg_latency_ms"]
            }
            for t in tools
        ],
        "tier": tier,
        "total": len(tools)
    }

@router.get("/tools/{tool_name}")
async def get_tool_details(tool_name: str):
    """Get detailed information about a specific tool."""
    from app.tools.registry import tool_registry
    
    tool = tool_registry._tools.get(tool_name)
    if not tool:
        raise HTTPException(404, f"Tool not found: {tool_name}")
    
    return tool

@router.post("/tools/execute-forced")
async def execute_forced_tool(
    request: ForcedToolRequest,
    user_tier: str = Header(..., alias="X-User-Tier")
):
    """
    Execute a tool with forced parameters.
    Bypasses LLM tool selection.
    """
    from app.tools.registry import tool_registry
    
    try:
        result = await tool_registry.execute(
            name=request.tool_name,
            arguments=request.arguments,
            tier=user_tier
        )
        return {"success": True, "result": result}
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))
```

---

## Part 8: Tool Execution Monitoring

### 8.1 Metrics Collection

```python
# gogga-backend/app/tools/metrics.py

from prometheus_client import Counter, Histogram, Gauge
import time

# Counters
tool_calls_total = Counter(
    'gogga_tool_calls_total',
    'Total tool calls',
    ['tool_name', 'tier', 'forced', 'success']
)

# Histograms
tool_latency = Histogram(
    'gogga_tool_latency_seconds',
    'Tool execution latency',
    ['tool_name'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# Gauges
active_tool_executions = Gauge(
    'gogga_active_tool_executions',
    'Currently executing tools',
    ['tool_name']
)

class ToolMetrics:
    @staticmethod
    def track_execution(tool_name: str, tier: str, forced: bool = False):
        """Context manager to track tool execution."""
        class Tracker:
            def __enter__(self):
                self.start = time.perf_counter()
                active_tool_executions.labels(tool_name=tool_name).inc()
                return self
            
            def __exit__(self, exc_type, exc_val, exc_tb):
                latency = time.perf_counter() - self.start
                success = exc_type is None
                
                tool_calls_total.labels(
                    tool_name=tool_name,
                    tier=tier,
                    forced=str(forced),
                    success=str(success)
                ).inc()
                
                tool_latency.labels(tool_name=tool_name).observe(latency)
                active_tool_executions.labels(tool_name=tool_name).dec()
        
        return Tracker()
```

### 8.2 Execution Logging

```python
# gogga-backend/app/tools/logging.py

import structlog
from typing import Any

logger = structlog.get_logger("gogga.tools")

def log_tool_execution(
    tool_name: str,
    arguments: dict,
    result: Any,
    latency_ms: float,
    user_id: str,
    tier: str,
    forced: bool = False
):
    """Log tool execution for audit trail."""
    logger.info(
        "tool_executed",
        tool_name=tool_name,
        arguments=_sanitize_args(arguments),
        result_type=type(result).__name__,
        latency_ms=round(latency_ms, 2),
        user_id=user_id,
        tier=tier,
        forced=forced
    )

def _sanitize_args(args: dict) -> dict:
    """Remove sensitive data from arguments for logging."""
    sensitive_keys = {"password", "token", "secret", "key"}
    return {
        k: "***" if k.lower() in sensitive_keys else v
        for k, v in args.items()
    }
```

---

## Part 9: Future Tool Roadmap

### Phase 1: Current (December 2025)
- ✅ Math Engine (6 tools)
- ✅ Chart Engine (1 tool, 10 chart types)
- ✅ Image Engine (1 tool, dual providers)
- ✅ Memory Engine (2 tools)

### Phase 2: Q1 2026 - Data Tools
- `data_csv_parse` - Parse and analyze CSV files
- `data_aggregate` - Group by, pivot tables
- `data_filter` - SQL-like filtering
- `data_export` - Export to various formats

### Phase 3: Q2 2026 - SA-Specific Tools
- `sa_company_lookup` - CIPC company search
- `sa_municipal_rates` - Property rates calculator
- `sa_uja_lookup` - UIF calculator
- `sa_credit_score` - Credit score estimation

### Phase 4: Q3 2026 - Integration Tools
- `web_search` - Real-time web search
- `api_call` - Call external REST APIs
- `email_send` - Send emails (authenticated users)
- `calendar_check` - Check availability

### Phase 5: Q4 2026 - Advanced Tools
- `code_execute` - Sandboxed Python execution
- `document_ocr` - Extract text from images
- `audio_transcribe` - Speech to text
- `translate` - Multi-language translation

---

## Part 10: Security Considerations

### 10.1 Input Validation
- All tool arguments validated against JSON schema
- SQL injection prevention (parameterized queries)
- XSS prevention (output sanitization)
- Rate limiting per user and per tool

### 10.2 Tier Enforcement
- Tools check tier before execution
- Cannot bypass via direct API calls
- Audit log for attempted tier violations

### 10.3 Forced Tool Safety
- Forced tools still validate parameters
- Cannot force tools above user's tier
- Forced executions logged separately

---

**Document Version**: 2.0
**Last Updated**: December 2025
**Owner**: GOGGA Engineering Team
