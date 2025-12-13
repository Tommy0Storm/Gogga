/**
 * Admin Panel Component
 * Floating panel for tier switching and health monitoring
 * Toggle with Ctrl+Shift+A, Ctrl+Alt+A, or ?admin=true URL param
 */

'use client';

import { useState, useEffect, useCallback, useEffectEvent } from 'react';
import {
  X,
  RefreshCw,
  Check,
  AlertCircle,
  Zap,
  Brain,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SettingsGearIcon } from './GoggaIcons';
import type { Tier } from '@/hooks/useRAG';

interface ServiceStatus {
  status: string;
  latency_ms?: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    cerebras: ServiceStatus;
    cepo: ServiceStatus;
    openrouter: ServiceStatus;
    deepinfra: ServiceStatus;
  };
  system?: {
    cpu_percent: number;
    memory: { percent: number };
  };
}

// Define which services are relevant for each tier
const TIER_SERVICES: Record<Tier, string[]> = {
  free: ['openrouter'],                    // FREE uses OpenRouter only
  jive: ['cerebras', 'cepo', 'deepinfra'], // JIVE uses Cerebras + CePO + DeepInfra for images
  jigga: ['cerebras', 'deepinfra'],        // JIGGA uses Cerebras (Qwen) + DeepInfra for images
};

interface AdminPanelProps {
  tier: Tier;
  onTierChange: (tier: Tier) => void;
  onAdminChange?: (isAdmin: boolean) => void;
  documentCount?: number;
  ragEnabled?: boolean;
}

const TIER_INFO = {
  free: {
    name: 'FREE',
    icon: Zap,
    color: 'bg-gray-500',
    description: 'OpenRouter Llama 3.3 70B',
    features: ['Basic chat', '50 images/month'],
  },
  jive: {
    name: 'JIVE',
    icon: Brain,
    color: 'bg-gray-600',
    description: 'Cerebras Llama 3.1 8B',
    features: ['CePO reasoning', '200 images/month', 'File uploads'],
  },
  jigga: {
    name: 'JIGGA',
    icon: Sparkles,
    color: 'bg-gray-800',
    description: 'Cerebras Qwen 3 235B',
    features: ['Deep thinking mode', '1000 images/month', 'Local RAG'],
  },
};

export function AdminPanel({ tier, onTierChange, onAdminChange, documentCount = 0, ragEnabled = false }: AdminPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  // Check URL param or localStorage for admin mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin =
      urlParams.get('admin') === 'true' ||
      localStorage.getItem('gogga_admin') === 'true';
    setShowPanel(isAdmin);
    // Defer the callback to avoid setState during render
    if (onAdminChange) {
      queueMicrotask(() => onAdminChange(isAdmin));
    }
  }, [onAdminChange]);

  // Keyboard shortcuts: Ctrl+Alt+A or Ctrl+Shift+A (Fn key is hardware-level, cannot be detected)
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Check for Ctrl+Alt+A OR Ctrl+Shift+A
      const isCtrlAltA = e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a';
      const isCtrlShiftA =
        e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a';

      if (isCtrlAltA || isCtrlShiftA) {
        e.preventDefault();
        e.stopPropagation();
        setShowPanel((prev) => {
          const newValue = !prev;
          localStorage.setItem('gogga_admin', String(newValue));
          // Defer the callback to avoid setState during render
          if (onAdminChange) {
            queueMicrotask(() => onAdminChange(newValue));
          }
          console.log('[AdminPanel] Admin mode toggled:', newValue);
          return newValue;
        });
      }
    };

    window.addEventListener('keydown', handleKeydown, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleKeydown, true);
  }, [onAdminChange]);

  // React 19.2: useEffectEvent for stable health fetching
  // Always uses latest state setters without restarting effect
  const fetchHealth = useEffectEvent(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setIsLoading(false);
    }
  });

  // Fetch health on open - effect only runs when isOpen changes
  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]); // fetchHealth is stable, not in deps

  if (!showPanel) {
    return null;
  }

  const TierIcon = TIER_INFO[tier].icon;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-all ${
          isOpen
            ? 'bg-gray-800 text-white'
            : 'bg-white text-gray-800 border border-gray-300'
        }`}
        aria-label="Toggle admin panel"
      >
        {isOpen ? <X size={20} /> : <SettingsGearIcon size={20} />}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SettingsGearIcon size={16} />
              <span className="font-bold text-sm">Admin Panel</span>
            </div>
            <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
              Dev Mode
            </span>
          </div>

          {/* Tier Selector */}
          <div className="p-4 border-b border-gray-200">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">
              Active Tier
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['free', 'jive', 'jigga'] as Tier[]).map((t) => {
                const info = TIER_INFO[t];
                const Icon = info.icon;
                const isActive = tier === t;

                return (
                  <button
                    key={t}
                    onClick={() => onTierChange(t)}
                    className={`p-2 rounded-lg border-2 transition-all text-center ${
                      isActive
                        ? `${info.color} text-white border-transparent`
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <Icon size={16} className="mx-auto mb-1" />
                    <span className="text-xs font-bold">{info.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Tier Info */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <TierIcon size={14} />
              <span className="text-sm font-bold">{TIER_INFO[tier].name}</span>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              {TIER_INFO[tier].description}
            </p>
            <div className="flex flex-wrap gap-1">
              {TIER_INFO[tier].features.map((f, i) => (
                <span
                  key={i}
                  className="text-[10px] bg-gray-200 px-2 py-0.5 rounded"
                >
                  {f}
                </span>
              ))}
            </div>
            {tier === 'jigga' && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {ragEnabled ? (
                  <Eye size={12} className="text-green-600" />
                ) : (
                  <EyeOff size={12} className="text-gray-400" />
                )}
                <span
                  className={ragEnabled ? 'text-green-600' : 'text-gray-400'}
                >
                  RAG: {documentCount} docs indexed
                </span>
              </div>
            )}
          </div>

          {/* Health Status */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase">
                Service Health
              </span>
              <button
                onClick={fetchHealth}
                disabled={isLoading}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <RefreshCw
                  size={14}
                  className={isLoading ? 'animate-spin' : ''}
                />
              </button>
            </div>

            {health ? (
              <div className="space-y-2">
                {/* Only show services relevant to current tier */}
                {Object.entries(health.services)
                  .filter(([name]) => TIER_SERVICES[tier].includes(name))
                  .map(([name, svc]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="capitalize text-gray-600">{name}</span>
                      <div className="flex items-center gap-2">
                        {svc.latency_ms && (
                          <span className="text-gray-400">
                            {Math.round(svc.latency_ms)}ms
                          </span>
                        )}
                        {svc.status === 'healthy' ? (
                          <Check size={12} className="text-green-500" />
                        ) : svc.status === 'configured' ? (
                          <Check size={12} className="text-blue-500" />
                        ) : (
                          <AlertCircle size={12} className="text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}

                {health.system && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>CPU: {health.system.cpu_percent.toFixed(1)}%</span>
                      <span>
                        Memory: {health.system.memory.percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                {isLoading ? 'Loading...' : 'Click refresh to check health'}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-100 text-[10px] text-gray-400 text-center">
            Ctrl+Shift+A or Ctrl+Alt+A • ?admin=true in URL
          </div>
        </div>
      )}
    </>
  );
}

export default AdminPanel;
