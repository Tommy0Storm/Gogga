'use client';

/**
 * StatCards Component
 * 
 * Displays key-value statistics in a grid of cards.
 * Used for math tool results like summaries, tax calculations, etc.
 */

import React from 'react';
import * as LucideIcons from 'lucide-react';

export interface StatCardItem {
  label: string;
  value: string | number;
  highlight?: boolean;
  icon?: string;
}

interface StatCardsProps {
  items: StatCardItem[];
  title?: string;
  columns?: 2 | 3 | 4;
}

/**
 * Get Lucide icon component by name
 */
function getIcon(name: string): React.ElementType | null {
  // Convert kebab-case to PascalCase
  const pascalCase = name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  
  // @ts-expect-error - Dynamic icon lookup
  const IconComponent = LucideIcons[pascalCase];
  return IconComponent || null;
}

export function StatCards({ items, title, columns = 3 }: StatCardsProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-primary-900 mb-4">{title}</h3>
      )}
      <div className={`grid ${gridCols[columns]} gap-3`}>
        {items.map((item, index) => {
          const IconComponent = item.icon ? getIcon(item.icon) : null;
          
          return (
            <div
              key={index}
              className={`
                p-4 rounded-lg border transition-all
                ${item.highlight 
                  ? 'bg-primary-100 border-primary-300 shadow-sm' 
                  : 'bg-white border-primary-200 hover:border-primary-300'
                }
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wide text-primary-500 mb-1 truncate">
                    {item.label}
                  </p>
                  <p className={`
                    font-semibold truncate
                    ${item.highlight ? 'text-lg text-primary-900' : 'text-base text-primary-800'}
                  `}>
                    {item.value}
                  </p>
                </div>
                {IconComponent && (
                  <div className={`
                    p-2 rounded-full shrink-0
                    ${item.highlight ? 'bg-primary-200' : 'bg-primary-100'}
                  `}>
                    <IconComponent 
                      className={`w-4 h-4 ${item.highlight ? 'text-primary-700' : 'text-primary-500'}`} 
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StatCards;
