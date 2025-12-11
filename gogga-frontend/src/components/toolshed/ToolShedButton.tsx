/**
 * ToolShed Button
 *
 * Button to open the ToolShed panel.
 * Shows indicator when a tool is forced.
 */

'use client';

import { useToolShed } from '@/lib/toolshedStore';

interface ToolShedButtonProps {
  className?: string;
  onClick?: () => void;
  hasForcedTool?: boolean;
}

export function ToolShedButton({ 
  className = '',
  onClick,
  hasForcedTool 
}: ToolShedButtonProps) {
  const { togglePanel, forcedTool } = useToolShed();
  
  // Use prop if provided, otherwise use store
  const handleClick = onClick || togglePanel;
  const showIndicator = hasForcedTool !== undefined ? hasForcedTool : !!forcedTool;

  return (
    <button
      onClick={handleClick}
      className={`header-btn relative ${className}`}
      title="Open ToolShed"
      aria-label="Open ToolShed panel"
    >
      {/* Wrench/tool icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
      <span>Tools</span>

      {/* Indicator dot when tool is forced */}
      {showIndicator && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
      )}
    </button>
  );
}

export default ToolShedButton;
