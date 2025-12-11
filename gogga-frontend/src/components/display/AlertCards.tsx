'use client';

/**
 * AlertCards Component
 * 
 * Displays warnings, success messages, and alerts for math results.
 * Used for fraud detection warnings, outlier alerts, etc.
 */

import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

export interface AlertItem {
  type: 'warning' | 'success' | 'danger' | 'info';
  title: string;
  message: string;
}

interface AlertCardsProps {
  alerts: AlertItem[];
}

const alertConfig = {
  warning: {
    icon: AlertTriangle,
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    iconColor: 'text-yellow-600',
    titleColor: 'text-yellow-800',
    textColor: 'text-yellow-700',
  },
  success: {
    icon: CheckCircle,
    bg: 'bg-green-50',
    border: 'border-green-300',
    iconColor: 'text-green-600',
    titleColor: 'text-green-800',
    textColor: 'text-green-700',
  },
  danger: {
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-300',
    iconColor: 'text-red-600',
    titleColor: 'text-red-800',
    textColor: 'text-red-700',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-800',
    textColor: 'text-blue-700',
  },
};

export function AlertCards({ alerts }: AlertCardsProps) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => {
        const config = alertConfig[alert.type];
        const IconComponent = config.icon;

        return (
          <div
            key={index}
            className={`
              flex items-start gap-3 p-4 rounded-lg border
              ${config.bg} ${config.border}
            `}
          >
            <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconColor}`} />
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold ${config.titleColor}`}>
                {alert.title}
              </h4>
              <p className={`text-sm mt-1 ${config.textColor}`}>
                {alert.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AlertCards;
