/**
 * GoggaToolShed Panel
 *
 * Slide-out panel for browsing and forcing tools.
 * Monochrome design with category tabs.
 * Uses CSS transitions for reliability.
 */

'use client';

import { useState, useEffect } from 'react';
import {
  useToolShed,
  TOOL_CATEGORIES,
  type ToolCategory,
  getFilteredTools,
} from '@/lib/toolshedStore';
import { ToolCard } from './ToolCard';

interface ToolShedPanelProps {
  tier: 'free' | 'jive' | 'jigga';
  isOpen?: boolean;
  onClose?: () => void;
}

export function ToolShedPanel({ tier, isOpen: isOpenProp, onClose }: ToolShedPanelProps) {
  const {
    isOpen: isOpenStore,
    closePanel,
    tools,
    isLoadingTools,
    fetchTools,
    forcedTool,
    forceTool,
    activeCategory,
    setActiveCategory,
  } = useToolShed();

  // Use props if provided, otherwise use store
  const isOpen = isOpenProp !== undefined ? isOpenProp : isOpenStore;
  const handleClose = onClose || closePanel;

  // Fetch tools when panel opens
  useEffect(() => {
    if (isOpen && tools.length === 0) {
      fetchTools(tier);
    }
  }, [isOpen, tools.length, tier, fetchTools]);

  const filteredTools = getFilteredTools(tools, activeCategory, tier);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-50 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-96 max-w-[90vw] bg-white dark:bg-neutral-900 
                   border-l border-neutral-200 dark:border-neutral-800 z-50
                   shadow-2xl overflow-hidden flex flex-col
                   transition-transform duration-300 ease-out ${
                     isOpen ? 'translate-x-0' : 'translate-x-full'
                   }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚙</span>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                GoggaToolShed
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg
                       text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300
                       transition-colors"
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Force a specific tool for your next message
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          {TOOL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-1 min-w-[80px] py-3 px-2 text-center text-sm transition-colors whitespace-nowrap
                ${
                  activeCategory === cat.id
                    ? 'border-b-2 border-neutral-900 dark:border-white font-medium text-neutral-900 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              title={cat.description}
            >
              <span className="mr-1">{cat.icon}</span>
              <span className="hidden sm:inline">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Tool List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoadingTools ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-600 dark:border-t-white rounded-full" />
            </div>
          ) : filteredTools.length > 0 ? (
            filteredTools.map((tool) => (
              <ToolCard
                key={tool.name}
                tool={tool}
                onForce={(params) => forceTool(tool, params)}
                isForced={forcedTool?.tool.name === tool.name}
              />
            ))
          ) : (
            <div className="text-center text-neutral-500 dark:text-neutral-400 py-12">
              <p className="text-lg mb-2">◇</p>
              <p>No tools available in this category</p>
              <p className="text-sm mt-1">
                {tier === 'free'
                  ? 'Upgrade to JIVE for more tools'
                  : 'Check back soon for new tools'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center justify-between text-sm text-neutral-500">
            <span>
              {tools.length} tools available • {tier.toUpperCase()} tier
            </span>
            {forcedTool && (
              <span className="text-neutral-900 dark:text-white font-medium">
                ◉ {forcedTool.tool.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default ToolShedPanel;
