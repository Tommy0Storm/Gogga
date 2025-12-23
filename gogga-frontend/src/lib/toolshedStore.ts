/**
 * GoggaToolShed State Management
 *
 * Zustand store for managing tool selection, forced tools, and execution history.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Tool category types
export type ToolCategory = 'all' | 'math' | 'visualization' | 'creative' | 'memory';
export type TierRequired = 'free' | 'jive' | 'jigga';

// Tool definition from backend
export interface ToolDefinition {
  name: string;
  category: ToolCategory;
  description: string;
  tierRequired: TierRequired;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  examples?: Array<{
    description: string;
    params: Record<string, unknown>;
  }>;
  avgLatencyMs?: number;
}

// Forced tool state
export interface ForcedTool {
  tool: ToolDefinition;
  params: Record<string, unknown> | null;
}

// Tool execution record
export interface ToolExecution {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  result: unknown;
  latencyMs: number;
  timestamp: Date;
  success: boolean;
  forced: boolean;
}

// Store state interface
interface ToolShedState {
  // Panel state
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;

  // Available tools (fetched from backend)
  tools: ToolDefinition[];
  isLoadingTools: boolean;
  setTools: (tools: ToolDefinition[]) => void;
  fetchTools: (tier: string) => Promise<void>;

  // Forced tool
  forcedTool: ForcedTool | null;
  forceTool: (tool: ToolDefinition, params?: Record<string, unknown>) => void;
  clearForcedTool: () => void;

  // Active category filter
  activeCategory: ToolCategory;
  setActiveCategory: (category: ToolCategory) => void;

  // Execution history (persisted)
  executionHistory: ToolExecution[];
  addExecution: (execution: Omit<ToolExecution, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
}

// Category metadata - unique icons for each category (no duplicates)
export const TOOL_CATEGORIES = [
  { id: 'all' as const, label: 'All', icon: '⊕', description: 'All available tools' },
  { id: 'math' as const, label: 'Math & Finance', icon: 'Σ', description: 'Calculations, statistics, and financial tools' },
  { id: 'visualization' as const, label: 'Charts', icon: '◱', description: 'Data visualization and graphs' },
  { id: 'creative' as const, label: 'Images', icon: '◈', description: 'AI image generation' },
  { id: 'memory' as const, label: 'Memory', icon: '⬡', description: 'Store and recall information' },
] as const;

// Create the store
export const useToolShed = create<ToolShedState>()(
  persist(
    (set, get) => ({
      // Panel state
      isOpen: false,
      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),
      togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

      // Tools
      tools: [],
      isLoadingTools: false,
      setTools: (tools) => set({ tools }),
      fetchTools: async (tier: string) => {
        set({ isLoadingTools: true });
        try {
          const response = await fetch(`/api/v1/tools?tier=${tier}`);
          if (response.ok) {
            const data = await response.json();
            set({ tools: data.tools || [] });
          }
        } catch (error) {
          console.error('[ToolShed] Failed to fetch tools:', error);
        } finally {
          set({ isLoadingTools: false });
        }
      },

      // Forced tool
      forcedTool: null,
      forceTool: (tool, params = undefined) => {
        set({
          forcedTool: { tool, params: params || null },
          isOpen: false, // Close panel after selection
        });
        console.log('[ToolShed] Tool forced:', tool.name, params);
      },
      clearForcedTool: () => {
        set({ forcedTool: null });
        console.log('[ToolShed] Forced tool cleared');
      },

      // Category filter
      activeCategory: 'math',
      setActiveCategory: (category) => set({ activeCategory: category }),

      // Execution history
      executionHistory: [],
      addExecution: (execution) => {
        const newExecution: ToolExecution = {
          ...execution,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        };
        set((state) => ({
          executionHistory: [newExecution, ...state.executionHistory].slice(0, 100),
        }));
      },
      clearHistory: () => set({ executionHistory: [] }),
    }),
    {
      name: 'gogga-toolshed',
      partialize: (state) => ({
        // Only persist execution history
        executionHistory: state.executionHistory.slice(0, 50),
      }),
    }
  )
);

// Helper to check if a tool is available for a tier
export function isToolAvailable(tool: ToolDefinition, userTier: string): boolean {
  const tierOrder: Record<string, number> = { free: 0, jive: 1, jigga: 2 };
  const userLevel = tierOrder[userTier.toLowerCase()] ?? 0;
  const requiredLevel = tierOrder[tool.tierRequired] ?? 0;
  return userLevel >= requiredLevel;
}

// Get tools filtered by category and tier
export function getFilteredTools(
  tools: ToolDefinition[],
  category: ToolCategory,
  tier: string
): ToolDefinition[] {
  return tools.filter(
    (tool) => (category === 'all' || tool.category === category) && isToolAvailable(tool, tier)
  );
}
