'use client';

import { useState } from 'react';
import { Bug, X, Send, CheckCircle2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface ReportIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string | null;
    getCapture: () => {
        consoleLogs: unknown[];
        networkLogs: unknown[];
        lastError: string | null;
    };
}

function ReportIssueModalContent({ isOpen, onClose, userEmail, getCapture }: ReportIssueModalProps) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!reason.trim()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const capture = getCapture();

            const response = await fetch('/api/debug/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: reason.trim(),
                    consoleLogs: JSON.stringify(capture.consoleLogs),
                    networkLogs: JSON.stringify(capture.networkLogs),
                    errorStack: capture.lastError,
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    screenSize: `${window.innerWidth}x${window.innerHeight}`,
                }),
            });

            if (response.ok) {
                setSubmitted(true);
                setTimeout(() => {
                    onClose();
                    setSubmitted(false);
                    setReason('');
                }, 2000);
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to submit report');
            }
        } catch (err) {
            console.error('Failed to submit debug report:', err);
            setError('Network error - please try again');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            onClose();
            setReason('');
            setError(null);
            setSubmitted(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
                {submitted ? (
                    <div className="text-center py-8">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white">
                            Report Submitted
                        </h3>
                        <p className="text-zinc-400 mt-2">
                            Thank you! We&apos;ll look into this.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Bug className="w-5 h-5 text-yellow-500" />
                                <h2 className="text-lg font-semibold text-white">
                                    Report an Issue
                                </h2>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-sm text-zinc-400 mb-4">
                            This will capture your browser&apos;s console logs and any errors to help us debug the issue.
                            {userEmail && (
                                <span className="block mt-1 text-zinc-500">
                                    Submitting as: <span className="text-zinc-300">{userEmail}</span>
                                </span>
                            )}
                        </p>

                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Describe what went wrong or what you expected to happen..."
                            className="w-full h-32 p-3 border border-zinc-700 rounded-lg 
                         bg-zinc-800 text-white
                         placeholder-zinc-500
                         focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500
                         resize-none outline-none"
                            autoFocus
                        />

                        {error && (
                            <p className="text-red-400 text-sm mt-2">{error}</p>
                        )}

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={handleClose}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2.5 text-zinc-300 
                           bg-zinc-800 border border-zinc-700 rounded-lg
                           hover:bg-zinc-700 disabled:opacity-50 
                           transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!reason.trim() || isSubmitting}
                                className="flex-1 px-4 py-2.5 text-black font-medium 
                           bg-yellow-500 rounded-lg
                           hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Submit Report
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export function ReportIssueModal(props: ReportIssueModalProps) {
    return (
        <ErrorBoundary fallback={
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
                    <p className="text-red-500 font-medium">Error loading report modal</p>
                    <button
                        onClick={props.onClose}
                        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg"
                    >
                        Close
                    </button>
                </div>
            </div>
        }>
            <ReportIssueModalContent {...props} />
        </ErrorBoundary>
    );
}
