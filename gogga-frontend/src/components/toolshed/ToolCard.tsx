/**
 * Tool Card Component
 *
 * Displays a single tool with its description, examples, and force button.
 * Uses CSS transitions instead of framer-motion for reliability.
 */

'use client';

import { useState } from 'react';
import type { ToolDefinition } from '@/lib/toolshedStore';

interface ToolCardProps {
  tool: ToolDefinition;
  onForce: (params?: Record<string, unknown>) => void;
  isForced?: boolean;
}

export function ToolCard({ tool, onForce, isForced = false }: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [params, setParams] = useState<Record<string, unknown>>({});

  const handleForce = () => {
    onForce(Object.keys(params).length > 0 ? params : undefined);
  };

  const requiredParams = tool.parameters?.required || [];
  const properties = tool.parameters?.properties || {};

  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${
        isForced
          ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800'
          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-500'
      }`}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 text-left flex items-start justify-between gap-2"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-neutral-900 dark:text-white">
              {tool.name}
            </span>
            {isForced && (
              <span className="text-[10px] bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-1.5 py-0.5 rounded">
                FORCED
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
            {tool.description}
          </p>
        </div>
        <span
          className={`text-neutral-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {/* Expanded content */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-3 pb-3 space-y-3 border-t border-neutral-100 dark:border-neutral-800 pt-3">
          {/* Examples */}
          {tool.examples && tool.examples.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">
                Examples
              </span>
              <div className="mt-1 space-y-1">
                {tool.examples.slice(0, 2).map((example, i) => (
                  <div
                    key={i}
                    className="text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800 rounded px-2 py-1"
                  >
                    {example.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parameters (simplified - just show required ones) */}
          {requiredParams.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">
                Parameters
              </span>
              <div className="mt-1 space-y-2">
                {requiredParams.map((paramName) => {
                  const paramDef = properties[paramName] as Record<string, unknown> | undefined;
                  const description = typeof paramDef?.description === 'string' ? paramDef.description : null;
                  return (
                    <div key={paramName}>
                      <label className="text-xs text-neutral-600 dark:text-neutral-300 block mb-1">
                        {paramName}
                        {description && (
                          <span className="text-neutral-400 ml-1">
                            - {description}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder={`Enter ${paramName}...`}
                        value={String(params[paramName] || '')}
                        onChange={(e) =>
                          setParams((p) => ({ ...p, [paramName]: e.target.value }))
                        }
                        className="w-full text-xs px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 
                                 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                                 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Force Button */}
          <button
            onClick={handleForce}
            className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              isForced
                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-neutral-200'
            }`}
          >
            {isForced ? '✓ Tool Forced' : 'Force This Tool'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ToolCard;
