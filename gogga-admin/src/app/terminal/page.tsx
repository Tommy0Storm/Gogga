'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  MdTerminal,
  MdApi,
  MdWeb,
  MdPsychology,
  MdDashboard,
  MdFullscreen,
  MdFullscreenExit,
  MdGridView,
  MdViewStream,
  MdCode,
} from 'react-icons/md';

// Dynamic import to avoid SSR issues with xterm
const LiveTerminal = dynamic(() => import('@/components/LiveTerminal'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-[#0a0a0a]">
      <div className="text-green-500 font-mono animate-pulse">Loading terminal...</div>
    </div>
  ),
});

interface ServiceTab {
  id: string;
  name: string;
  icon: React.ReactNode;
}

const SERVICES: ServiceTab[] = [
  { id: 'backend', name: 'Backend API', icon: <MdApi className="w-5 h-5" /> },
  { id: 'python', name: 'Python', icon: <MdCode className="w-5 h-5" /> },
  { id: 'cepo', name: 'OptiLLM', icon: <MdPsychology className="w-5 h-5" /> },
  { id: 'frontend', name: 'Frontend', icon: <MdWeb className="w-5 h-5" /> },
  { id: 'admin', name: 'Admin', icon: <MdDashboard className="w-5 h-5" /> },
  { id: 'sqlite', name: 'SQLite', icon: <MdTerminal className="w-5 h-5" /> },
];

type ViewMode = 'single' | 'split' | 'quad';

export default function TerminalPage() {
  const [activeService, setActiveService] = useState<string>('backend');
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>(['backend', 'frontend']);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(s => s !== serviceId);
      }
      // Max 4 for quad view
      if (prev.length >= 4) {
        return [...prev.slice(1), serviceId];
      }
      return [...prev, serviceId];
    });
  };

  const renderSingleTerminal = () => (
    <div className="h-full">
      <LiveTerminal service={activeService} />
    </div>
  );

  const renderSplitTerminals = () => (
    <div className="grid grid-cols-2 gap-1 h-full">
      {selectedServices.slice(0, 2).map(service => (
        <div key={service} className="border border-[#333] rounded overflow-hidden">
          <LiveTerminal service={service} />
        </div>
      ))}
    </div>
  );

  const renderQuadTerminals = () => (
    <div className="grid grid-cols-2 grid-rows-2 gap-1 h-full">
      {SERVICES.map(service => (
        <div key={service.id} className="border border-[#333] rounded overflow-hidden">
          <LiveTerminal service={service.id} />
        </div>
      ))}
    </div>
  );

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'h-[calc(100vh-4rem)]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--admin-surface)] border-b border-[var(--admin-border)]">
        <div className="flex items-center gap-3">
          <MdTerminal className="w-6 h-6 text-green-500" />
          <h1 className="text-lg font-semibold text-[var(--admin-text)]">
            Live Terminal
          </h1>
          <span className="text-sm text-[var(--admin-text-muted)]">
            Real-time service logs
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-[var(--admin-surface-2)] rounded-lg p-1">
            <button
              onClick={() => setViewMode('single')}
              className={`p-2 rounded ${viewMode === 'single' ? 'bg-[var(--admin-border)] text-white' : 'text-[var(--admin-text-muted)] hover:text-white'}`}
              title="Single view"
            >
              <MdViewStream className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`p-2 rounded ${viewMode === 'split' ? 'bg-[var(--admin-border)] text-white' : 'text-[var(--admin-text-muted)] hover:text-white'}`}
              title="Split view (2)"
            >
              <MdGridView className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('quad')}
              className={`p-2 rounded ${viewMode === 'quad' ? 'bg-[var(--admin-border)] text-white' : 'text-[var(--admin-text-muted)] hover:text-white'}`}
              title="Quad view (4)"
            >
              <MdDashboard className="w-5 h-5" />
            </button>
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-[var(--admin-surface-2)] rounded-lg hover:bg-[var(--admin-border)] transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <MdFullscreenExit className="w-5 h-5 text-[var(--admin-text)]" />
            ) : (
              <MdFullscreen className="w-5 h-5 text-[var(--admin-text)]" />
            )}
          </button>
        </div>
      </div>

      {/* Service tabs (for single/split view) */}
      {viewMode !== 'quad' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--admin-surface-2)] border-b border-[var(--admin-border)]">
          {SERVICES.map(service => {
            const isActive = viewMode === 'single' 
              ? activeService === service.id 
              : selectedServices.includes(service.id);
            
            return (
              <button
                key={service.id}
                onClick={() => {
                  if (viewMode === 'single') {
                    setActiveService(service.id);
                  } else {
                    toggleServiceSelection(service.id);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : 'bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] border border-transparent'
                }`}
              >
                {service.icon}
                <span className="text-sm font-medium">{service.name}</span>
              </button>
            );
          })}
          
          {viewMode === 'split' && (
            <span className="ml-auto text-xs text-[var(--admin-text-muted)]">
              Select 2 services for split view
            </span>
          )}
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 bg-[#0a0a0a] overflow-hidden">
        {viewMode === 'single' && renderSingleTerminal()}
        {viewMode === 'split' && renderSplitTerminals()}
        {viewMode === 'quad' && renderQuadTerminals()}
      </div>
    </div>
  );
}
