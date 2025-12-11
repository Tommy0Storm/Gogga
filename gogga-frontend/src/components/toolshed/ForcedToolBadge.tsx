/**
 * Forced Tool Badge
 *
 * Displays above the chat input when a tool is forced.
 * Allows user to clear the forced tool.
 */

'use client';

import { useToolShed } from '@/lib/toolshedStore';

interface ForcedToolBadgeProps {
  toolName?: string;
  onClear?: () => void;
}

export function ForcedToolBadge({ toolName, onClear }: ForcedToolBadgeProps) {
  const { forcedTool, clearForcedTool } = useToolShed();

  // Use props if provided, otherwise use store
  const displayName = toolName || forcedTool?.tool?.name;
  const handleClear = onClear || clearForcedTool;
  
  if (!displayName) return null;

  const paramCount = forcedTool?.params ? Object.keys(forcedTool.params).length : 0;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 
                    rounded-t-lg border border-b-0 border-neutral-200 dark:border-neutral-700
                    text-sm"
    >
      <span className="text-neutral-500 dark:text-neutral-400">◉ Forcing:</span>
      <span className="font-mono font-medium text-neutral-900 dark:text-white">
        {displayName}
      </span>
      {paramCount > 0 && (
        <span className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded">
          {paramCount} param{paramCount !== 1 ? 's' : ''} set
        </span>
      )}
      <button
        onClick={handleClear}
        className="ml-auto p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300
                 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Clear forced tool"
      >
        ✕
      </button>
    </div>
  );
}

export default ForcedToolBadge;
