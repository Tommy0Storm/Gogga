'use client';

/**
 * GOGGA PDF Export Modal
 * 
 * Provides UI for exporting chat sessions to PDF with various options
 */

import React, { useState } from 'react';
import {
  FileDown,
  X,
  FileText,
  Image,
  BarChart2,
  Brain,
  Clock,
  Download,
  Loader2,
  Check,
  AlertCircle,
  History,
  FileJson,
} from 'lucide-react';
import {
  exportChatToPdf,
  exportChartsToPdf,
  exportTranscript,
  exportFullHistory,
  quickExportCurrentSession,
  type ExportMode,
  type ExportOptions,
  type ExportResult,
} from '@/lib/pdfExporter';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ============================================================================
// Types
// ============================================================================

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  sessionTitle?: string;
  tier: 'free' | 'jive' | 'jigga';
  userName?: string;
}

interface ExportState {
  isExporting: boolean;
  result: ExportResult | null;
}

// ============================================================================
// Export Option Card Component
// ============================================================================

interface ExportOptionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const ExportOptionCard: React.FC<ExportOptionCardProps> = ({
  icon,
  title,
  description,
  onClick,
  disabled = false,
  loading = false,
}) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`
      flex items-start gap-3 p-4 w-full rounded-lg border transition-all
      ${disabled
        ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
        : 'bg-white border-gray-200 hover:border-gray-400 hover:shadow-sm cursor-pointer'
      }
    `}
  >
    <div className={`
      p-2 rounded-lg shrink-0
      ${disabled ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 text-gray-700'}
    `}>
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
    </div>
    <div className="text-left">
      <div className={`font-semibold ${disabled ? 'text-gray-400' : 'text-gray-800'}`}>
        {title}
      </div>
      <div className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
        {description}
      </div>
    </div>
  </button>
);

// ============================================================================
// Main Component
// ============================================================================

const ExportModalContent: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  sessionTitle = 'Chat Session',
  tier,
  userName = 'GOGGA User',
}) => {
  const [exportState, setExportState] = useState<ExportState>({
    isExporting: false,
    result: null,
  });
  const [activeExport, setActiveExport] = useState<string | null>(null);
  
  // Advanced options state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState<Partial<ExportOptions>>({
    includeCharts: true,
    includeImages: true,
    includeThinking: false,
    includeTimestamps: true,
    pageSize: 'a4',
    orientation: 'portrait',
  });
  
  const isPersistenceEnabled = tier === 'jive' || tier === 'jigga';
  const premiumTier = tier === 'jive' || tier === 'jigga' ? tier : undefined;
  
  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setExportState({ isExporting: false, result: null });
      setActiveExport(null);
    }
  }, [isOpen]);
  
  // Export handlers
  const handleQuickExport = async () => {
    if (!sessionId || !premiumTier) return;
    setActiveExport('quick');
    setExportState({ isExporting: true, result: null });
    
    const result = await exportChatToPdf({
      mode: 'current-session',
      sessionId,
      includeCharts: true,
      includeImages: true,
      includeThinking: false,
      includeTimestamps: true,
      pageSize: 'a4',
      orientation: 'portrait',
      userName,
      userTier: premiumTier,
    });
    setExportState({ isExporting: false, result });
    setActiveExport(null);
  };
  
  const handleCustomExport = async () => {
    if (!sessionId || !premiumTier) return;
    setActiveExport('custom');
    setExportState({ isExporting: true, result: null });
    
    const result = await exportChatToPdf({
      mode: 'current-session',
      sessionId,
      ...options,
      userName,
      userTier: premiumTier,
    } as ExportOptions);
    
    setExportState({ isExporting: false, result });
    setActiveExport(null);
  };
  
  const handleFullHistoryExport = async () => {
    if (!premiumTier) return;
    setActiveExport('history');
    setExportState({ isExporting: true, result: null });
    
    const result = await exportChatToPdf({
      mode: 'full-history',
      includeCharts: true,
      includeImages: true,
      includeThinking: false,
      includeTimestamps: true,
      pageSize: 'a4',
      orientation: 'portrait',
      userName,
      userTier: premiumTier,
    });
    setExportState({ isExporting: false, result });
    setActiveExport(null);
  };
  
  const handleChartsExport = async () => {
    setActiveExport('charts');
    setExportState({ isExporting: true, result: null });
    
    const result = await exportChartsToPdf();
    setExportState({ isExporting: false, result });
    setActiveExport(null);
  };
  
  const handleTranscriptExport = async () => {
    if (!sessionId) return;
    setActiveExport('transcript');
    setExportState({ isExporting: true, result: null });
    
    const result = await exportTranscript(sessionId);
    setExportState({ isExporting: false, result });
    setActiveExport(null);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-800">Export Chat</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Result message */}
          {exportState.result && (
            <div className={`
              flex items-center gap-2 p-3 rounded-lg
              ${exportState.result.success
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
              }
            `}>
              {exportState.result.success
                ? <Check className="w-5 h-5 shrink-0" />
                : <AlertCircle className="w-5 h-5 shrink-0" />
              }
              <span className="text-sm">
                {exportState.result.success
                  ? `Exported: ${exportState.result.filename}`
                  : exportState.result.error || 'Export failed'
                }
              </span>
            </div>
          )}
          
          {/* Session info */}
          {sessionId && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <span className="font-medium">Current session:</span> {sessionTitle}
            </div>
          )}
          
          {/* Quick export options */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Quick Export
            </h3>
            
            <ExportOptionCard
              icon={<Download className="w-5 h-5" />}
              title="Export Current Chat"
              description="Full PDF with messages, charts, and images"
              onClick={handleQuickExport}
              disabled={!sessionId || !isPersistenceEnabled}
              loading={activeExport === 'quick'}
            />
            
            <ExportOptionCard
              icon={<History className="w-5 h-5" />}
              title="Export All Chats"
              description="Complete chat history across all sessions"
              onClick={handleFullHistoryExport}
              disabled={!isPersistenceEnabled}
              loading={activeExport === 'history'}
            />
          </div>
          
          {/* Specialized exports */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Specialized Exports
            </h3>
            
            <ExportOptionCard
              icon={<BarChart2 className="w-5 h-5" />}
              title="Charts Only"
              description="Export visible charts and graphs as PDF"
              onClick={handleChartsExport}
              loading={activeExport === 'charts'}
            />
            
            <ExportOptionCard
              icon={<FileText className="w-5 h-5" />}
              title="Plain Transcript"
              description="Text-only transcript without formatting"
              onClick={handleTranscriptExport}
              disabled={!sessionId || !isPersistenceEnabled}
              loading={activeExport === 'transcript'}
            />
          </div>
          
          {/* Advanced options */}
          <div className="space-y-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <span>Advanced Options</span>
              <span className="text-xs">{showAdvanced ? '▲' : '▼'}</span>
            </button>
            
            {showAdvanced && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {/* Include options */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      id="export-include-charts"
                      name="export-include-charts"
                      type="checkbox"
                      checked={options.includeCharts}
                      onChange={(e) => setOptions(o => ({ ...o, includeCharts: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <BarChart2 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">Include Charts & Graphs</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      id="export-include-images"
                      name="export-include-images"
                      type="checkbox"
                      checked={options.includeImages}
                      onChange={(e) => setOptions(o => ({ ...o, includeImages: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <Image className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">Include AI-Generated Images</span>
                  </label>
                  
                  {tier === 'jigga' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        id="export-include-thinking"
                        name="export-include-thinking"
                        type="checkbox"
                        checked={options.includeThinking}
                        onChange={(e) => setOptions(o => ({ ...o, includeThinking: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <Brain className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">Include Thinking Process</span>
                    </label>
                  )}
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      id="export-include-timestamps"
                      name="export-include-timestamps"
                      type="checkbox"
                      checked={options.includeTimestamps}
                      onChange={(e) => setOptions(o => ({ ...o, includeTimestamps: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">Include Timestamps</span>
                  </label>
                </div>
                
                {/* Page settings */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Page Size
                    </label>
                    <select
                      id="export-page-size"
                      name="export-page-size"
                      value={options.pageSize}
                      onChange={(e) => setOptions(o => ({ ...o, pageSize: e.target.value as 'a4' | 'letter' | 'legal' }))}
                      className="w-full text-sm border border-gray-200 rounded-md p-2"
                    >
                      <option value="a4">A4</option>
                      <option value="letter">Letter</option>
                      <option value="legal">Legal</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Orientation
                    </label>
                    <select
                      id="export-orientation"
                      name="export-orientation"
                      value={options.orientation}
                      onChange={(e) => setOptions(o => ({ ...o, orientation: e.target.value as 'portrait' | 'landscape' }))}
                      className="w-full text-sm border border-gray-200 rounded-md p-2"
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </div>
                
                {/* Custom export button */}
                <button
                  onClick={handleCustomExport}
                  disabled={!sessionId || !isPersistenceEnabled || exportState.isExporting}
                  className={`
                    w-full py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2
                    ${(!sessionId || !isPersistenceEnabled)
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                    }
                  `}
                >
                  {activeExport === 'custom' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      Export with Options
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          
          {/* FREE tier notice */}
          {!isPersistenceEnabled && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
              <strong>Note:</strong> Chat export is only available for JIVE and JIGGA tiers.
              Upgrade to save and export your chat history.
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Export Button Component (for toolbar integration)
// ============================================================================

interface ExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'header' | 'standalone';
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onClick,
  disabled = false,
  variant = 'header',
}) => {
  // Header variant matches the header-btn styling
  if (variant === 'header') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title="Export chat to PDF"
        className={`
          header-btn
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <FileDown size={16} />
        <span>Export</span>
      </button>
    );
  }
  
  // Standalone variant for other contexts
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="Export chat to PDF"
      className={`
        flex items-center gap-2 p-2 text-sm rounded-lg border transition-all
        ${disabled
          ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
        }
      `}
    >
      <FileDown className="w-4 h-4" />
      <span className="hidden sm:inline">Export</span>
    </button>
  );
};

// Wrapped with error boundary
export const ExportModal: React.FC<ExportModalProps> = (props) => {
  return (
    <ErrorBoundary fallback={() => (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
          <p className="text-red-500 font-medium">Error loading export modal</p>
          <button
            onClick={props.onClose}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    )}>
      <ExportModalContent {...props} />
    </ErrorBoundary>
  );
};

export default ExportModal;
