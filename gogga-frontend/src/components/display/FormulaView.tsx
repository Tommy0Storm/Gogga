'use client';

/**
 * FormulaView Component
 * 
 * Displays mathematical formulas with proper formatting.
 * Uses KaTeX for rendering when available, falls back to styled text.
 */

import React from 'react';

interface FormulaViewProps {
  formula: string;
  label?: string;
  showSteps?: boolean;
  steps?: Array<{
    description: string;
    formula: string;
    result?: string;
  }>;
}

/**
 * Simple formula formatting (without KaTeX dependency)
 * Converts basic math notation to styled HTML
 */
function formatFormula(formula: string): React.ReactNode {
  // Replace common patterns
  let formatted = formula
    .replace(/\^(\d+)/g, '<sup>$1</sup>')          // Exponents
    .replace(/R(\d)/g, 'R$1')                       // Currency
    .replace(/×/g, ' × ')                           // Multiplication
    .replace(/÷/g, ' ÷ ')                           // Division
    .replace(/\+/g, ' + ')                          // Addition
    .replace(/-/g, ' − ')                           // Subtraction (use proper minus)
    .replace(/=/g, ' = ')                           // Equals
    .replace(/\s+/g, ' ')                           // Normalize spaces
    .trim();
  
  return (
    <span 
      className="font-mono text-primary-800"
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  );
}

export function FormulaView({ formula, label, showSteps, steps }: FormulaViewProps) {
  return (
    <div className="w-full space-y-4">
      {/* Main Formula */}
      <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
        {label && (
          <p className="text-xs uppercase tracking-wide text-primary-500 mb-2">
            {label}
          </p>
        )}
        <div className="text-lg">
          {formatFormula(formula)}
        </div>
      </div>

      {/* Calculation Steps */}
      {showSteps && steps && steps.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-primary-700">Calculation Steps:</p>
          <ol className="list-decimal list-inside space-y-2">
            {steps.map((step, index) => (
              <li key={index} className="text-sm text-primary-700">
                <span className="text-primary-600">{step.description}</span>
                <div className="ml-5 mt-1 font-mono text-primary-800 bg-primary-50 rounded px-2 py-1 inline-block">
                  {formatFormula(step.formula)}
                  {step.result && (
                    <span className="text-primary-900 font-semibold">
                      {' = '}{step.result}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default FormulaView;
