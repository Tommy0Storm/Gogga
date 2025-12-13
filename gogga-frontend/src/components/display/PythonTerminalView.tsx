'use client';

/**
 * PythonTerminalView Component
 * 
 * Displays Python code execution results in a terminal-style view
 * with syntax highlighting and formatted output.
 * 
 * Designed for the python_execute tool that leverages Python 3.14 features:
 * - Decimal.from_number() for precise arithmetic
 * - Fraction.from_number() for rational numbers
 * - Template strings (t-strings)
 * - Improved number formatting
 */

import React, { useState } from 'react';

interface PythonTerminalViewProps {
  code: string;
  output: string;
  error?: string | null;
  executionTimeMs?: number;
  description?: string;
  success?: boolean;
  className?: string;
}

// Simple syntax highlighting for Python
function highlightPython(code: string): React.ReactNode[] {
  const lines = code.split('\n');
  return lines.map((line, lineIndex) => (
    <div key={lineIndex} className="flex">
      <span className="text-gray-600 select-none w-8 text-right pr-3 shrink-0">
        {lineIndex + 1}
      </span>
      <span className="flex-1">
        {highlightLine(line)}
      </span>
    </div>
  ));
}

function highlightLine(line: string): React.ReactNode {
  // Pattern-based syntax highlighting
  const patterns: Array<{ regex: RegExp; className: string; group?: number }> = [
    // Comments
    { regex: /(#.*)$/, className: 'text-gray-500 italic' },
    // Strings (single and double quoted)
    { regex: /(["'])(?:(?=(\\?))\2.)*?\1/, className: 'text-amber-400' },
    // f-strings
    { regex: /f(["'])(?:(?=(\\?))\2.)*?\1/, className: 'text-amber-300' },
    // Keywords
    { regex: /\b(from|import|as|def|class|return|if|elif|else|for|while|try|except|finally|with|in|is|not|and|or|True|False|None|lambda|yield|async|await|pass|break|continue|raise)\b/, className: 'text-purple-400' },
    // Built-in functions
    { regex: /\b(print|len|range|enumerate|zip|map|filter|sum|min|max|abs|round|sorted|list|dict|set|tuple|str|int|float|bool|type|isinstance)\b/, className: 'text-cyan-400' },
    // Numbers
    { regex: /\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/, className: 'text-orange-400' },
    // Module names after import/from
    { regex: /(?:from|import)\s+(\w+)/, className: 'text-green-400', group: 1 },
    // Function calls
    { regex: /(\w+)\s*\(/, className: 'text-blue-400', group: 1 },
    // Operators
    { regex: /([+\-*/%=<>!&|^~]+)/, className: 'text-gray-400' },
  ];

  // For simplicity, just apply basic keyword highlighting
  let result = line;
  
  // Replace keywords with styled spans
  const keywords = ['from', 'import', 'as', 'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'in', 'is', 'not', 'and', 'or', 'True', 'False', 'None', 'lambda', 'yield', 'async', 'await', 'pass', 'break', 'continue', 'raise'];
  const builtins = ['print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sum', 'min', 'max', 'abs', 'round', 'sorted', 'list', 'dict', 'set', 'tuple', 'str', 'int', 'float', 'bool', 'type', 'isinstance', 'Decimal', 'Fraction'];

  // Split into tokens while preserving whitespace
  const tokens = line.split(/(\s+|[()[\]{},:.=+\-*/%<>!&|^~]+)/);
  
  return (
    <>
      {tokens.map((token, i) => {
        if (keywords.includes(token)) {
          return <span key={i} className="text-purple-400">{token}</span>;
        }
        if (builtins.includes(token)) {
          return <span key={i} className="text-cyan-400">{token}</span>;
        }
        if (/^\d+\.?\d*$/.test(token)) {
          return <span key={i} className="text-orange-400">{token}</span>;
        }
        if (token.startsWith('#')) {
          return <span key={i} className="text-gray-500 italic">{token}</span>;
        }
        if (token.startsWith('"') || token.startsWith("'") || token.startsWith('f"') || token.startsWith("f'")) {
          return <span key={i} className="text-amber-400">{token}</span>;
        }
        return <span key={i}>{token}</span>;
      })}
    </>
  );
}

export default function PythonTerminalView({
  code,
  output,
  error,
  executionTimeMs,
  description,
  success = true,
  className = '',
}: PythonTerminalViewProps) {
  const [showCode, setShowCode] = useState(true);

  return (
    <div className={`rounded-lg border border-gray-700 bg-gray-900 overflow-hidden font-mono text-sm ${className}`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {/* Python logo style dots */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" title="Python" />
            <div className="w-3 h-3 rounded-full bg-blue-500/70" />
            <div className="w-3 h-3 rounded-full bg-gray-600" />
          </div>
          <span className="text-gray-400 text-xs font-medium ml-2 flex items-center gap-2">
            <span className="text-yellow-400">🐍</span>
            Python 3.14
            {description && (
              <span className="text-gray-500">— {description}</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {executionTimeMs !== undefined && (
            <span className="text-gray-500 text-xs">
              ⏱ {executionTimeMs.toFixed(0)}ms
            </span>
          )}
          <button
            onClick={() => setShowCode(!showCode)}
            className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
          >
            {showCode ? '▼ Code' : '▶ Code'}
          </button>
        </div>
      </div>

      {/* Code Section (collapsible) */}
      {showCode && code && (
        <div className="border-b border-gray-700/50 bg-gray-900/50">
          <div className="px-3 py-1 text-xs text-gray-500 bg-gray-800/30 border-b border-gray-700/30">
            Input
          </div>
          <div className="p-3 overflow-x-auto">
            <pre className="text-gray-300 leading-relaxed">
              {highlightPython(code.trim())}
            </pre>
          </div>
        </div>
      )}

      {/* Output Section */}
      <div className={success ? '' : 'bg-red-900/10'}>
        <div className="px-3 py-1 text-xs text-gray-500 bg-gray-800/30 border-b border-gray-700/30 flex items-center gap-2">
          <span>{success ? 'Output' : 'Error'}</span>
          {success ? (
            <span className="text-green-400">✓</span>
          ) : (
            <span className="text-red-400">✖</span>
          )}
        </div>
        <div className="p-3 overflow-x-auto">
          {error ? (
            <pre className="text-red-400 whitespace-pre-wrap">{error}</pre>
          ) : output ? (
            <pre className="text-green-300 whitespace-pre-wrap leading-relaxed">
              {output}
            </pre>
          ) : (
            <span className="text-gray-600 italic">No output</span>
          )}
        </div>
      </div>

      {/* Footer with Python 3.14 features hint */}
      <div className="px-3 py-1.5 bg-gray-800/30 border-t border-gray-700/30 text-xs text-gray-600 flex items-center justify-between">
        <span>
          Available: math, decimal, fractions, statistics, numpy, scipy
        </span>
        <span className="text-gray-500">
          Decimal.from_number() • Fraction.from_number()
        </span>
      </div>
    </div>
  );
}

// Export types
export type { PythonTerminalViewProps };
