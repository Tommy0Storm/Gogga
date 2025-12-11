'use client';

import { useState, useEffect } from 'react';
import {
    MdBugReport,
    MdRefresh,
    MdDelete,
    MdCheck,
    MdHourglassEmpty,
    MdPlayArrow,
    MdExpandMore,
    MdExpandLess,
    MdComputer,
    MdLink,
    MdPerson,
    MdAccessTime,
    MdNotes,
} from 'react-icons/md';

interface DebugSubmission {
    id: string;
    userId: string | null;
    user: { email: string } | null;
    reason: string;
    consoleLogs: string;
    networkLogs: string | null;
    errorStack: string | null;
    userAgent: string;
    url: string;
    screenSize: string | null;
    status: string;
    adminNotes: string | null;
    resolvedAt: string | null;
    resolvedBy: string | null;
    createdAt: string;
}

interface LogEntry {
    type: string;
    message: string;
    timestamp: string;
    stack?: string;
}

interface NetworkEntry {
    url: string;
    method: string;
    status: number;
    duration: number;
    error?: string;
    timestamp: string;
}

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const statusIcons: Record<string, React.ElementType> = {
    pending: MdHourglassEmpty,
    in_progress: MdPlayArrow,
    resolved: MdCheck,
};

export default function DebugSubmissionsPage() {
    const [submissions, setSubmissions] = useState<DebugSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [expandedLogs, setExpandedLogs] = useState(false);
    const [expandedNetwork, setExpandedNetwork] = useState(false);
    const [updating, setUpdating] = useState(false);

    const loadSubmissions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/debug?status=${filter}`);
            if (res.ok) {
                const data = await res.json();
                setSubmissions(data);
            }
        } catch (error) {
            console.error('Failed to load submissions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSubmissions();
    }, [filter]);

    const updateStatus = async (id: string, newStatus: string) => {
        setUpdating(true);
        try {
            const res = await fetch(`/api/debug/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, adminNotes }),
            });
            if (res.ok) {
                loadSubmissions();
                if (newStatus === 'resolved') {
                    setSelectedId(null);
                    setAdminNotes('');
                }
            }
        } catch (error) {
            console.error('Failed to update:', error);
        } finally {
            setUpdating(false);
        }
    };

    const deleteSubmission = async (id: string) => {
        if (!confirm('Delete this submission permanently?')) return;
        try {
            const res = await fetch(`/api/debug/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadSubmissions();
                setSelectedId(null);
            }
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const selected = submissions.find((s) => s.id === selectedId);
    const consoleLogs: LogEntry[] = selected ? JSON.parse(selected.consoleLogs || '[]') : [];
    const networkLogs: NetworkEntry[] = selected && selected.networkLogs ? JSON.parse(selected.networkLogs) : [];

    const pendingCount = submissions.filter(s => s.status === 'pending').length;

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <MdBugReport size={28} className="text-yellow-400" />
                    <h1 className="text-2xl font-bold">Debug Reports</h1>
                    {pendingCount > 0 && filter !== 'pending' && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                            {pendingCount} pending
                        </span>
                    )}
                </div>
                <button
                    onClick={loadSubmissions}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--admin-surface-2)] rounded-lg hover:bg-[var(--admin-surface)] transition-colors disabled:opacity-50"
                >
                    <MdRefresh size={18} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
                {['pending', 'in_progress', 'resolved', 'all'].map((f) => {
                    const count = f === 'all'
                        ? submissions.length
                        : submissions.filter(s => s.status === f).length;
                    return (
                        <button
                            key={f}
                            onClick={() => {
                                setFilter(f);
                                setSelectedId(null);
                            }}
                            className={`px-4 py-2 rounded-lg capitalize transition-colors ${filter === f
                                    ? 'bg-[var(--admin-accent)] text-white'
                                    : 'bg-[var(--admin-surface)] text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]'
                                }`}
                        >
                            {f.replace('_', ' ')}
                            {count > 0 && (
                                <span className="ml-2 px-1.5 py-0.5 text-xs bg-black/20 rounded">
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* List Panel */}
                <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
                    <div className="p-4 border-b border-[var(--admin-border)]">
                        <h2 className="font-semibold">Submissions</h2>
                    </div>
                    <div className="divide-y divide-[var(--admin-border)] max-h-[600px] overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-[var(--admin-text-muted)]">
                                Loading...
                            </div>
                        ) : submissions.length === 0 ? (
                            <div className="p-8 text-center text-[var(--admin-text-muted)]">
                                No submissions found
                            </div>
                        ) : (
                            submissions.map((sub) => {
                                const StatusIcon = statusIcons[sub.status] || MdHourglassEmpty;
                                return (
                                    <button
                                        key={sub.id}
                                        onClick={() => {
                                            setSelectedId(sub.id);
                                            setAdminNotes(sub.adminNotes || '');
                                            setExpandedLogs(false);
                                            setExpandedNetwork(false);
                                        }}
                                        className={`w-full p-4 text-left hover:bg-[var(--admin-surface-2)] transition-colors ${selectedId === sub.id ? 'bg-[var(--admin-surface-2)]' : ''
                                            }`}
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <MdPerson size={14} className="text-[var(--admin-text-muted)]" />
                                                    <span className="text-sm font-medium truncate">
                                                        {sub.user?.email || 'Anonymous'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-[var(--admin-text-secondary)] line-clamp-2">
                                                    {sub.reason}
                                                </p>
                                            </div>
                                            <span
                                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${statusColors[sub.status]}`}
                                            >
                                                <StatusIcon size={12} />
                                                {sub.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 text-xs text-[var(--admin-text-muted)]">
                                            <MdAccessTime size={12} />
                                            {new Date(sub.createdAt).toLocaleString()}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Detail Panel */}
                {selected ? (
                    <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
                        <div className="p-4 border-b border-[var(--admin-border)] flex justify-between items-center">
                            <h2 className="font-semibold">Details</h2>
                            <button
                                onClick={() => setSelectedId(null)}
                                className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                            {/* User & Reason */}
                            <div>
                                <label className="text-xs text-[var(--admin-text-muted)] uppercase tracking-wider">User</label>
                                <p className="text-sm">{selected.user?.email || 'Anonymous'}</p>
                            </div>
                            <div>
                                <label className="text-xs text-[var(--admin-text-muted)] uppercase tracking-wider">Reason</label>
                                <p className="text-sm bg-[var(--admin-surface-2)] p-3 rounded-lg mt-1">
                                    {selected.reason}
                                </p>
                            </div>

                            {/* Context */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-[var(--admin-text-muted)] uppercase tracking-wider flex items-center gap-1">
                                        <MdLink size={12} /> URL
                                    </label>
                                    <p className="text-xs text-[var(--admin-text-secondary)] truncate mt-1">
                                        {selected.url}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--admin-text-muted)] uppercase tracking-wider flex items-center gap-1">
                                        <MdComputer size={12} /> Screen
                                    </label>
                                    <p className="text-xs text-[var(--admin-text-secondary)] mt-1">
                                        {selected.screenSize || 'Unknown'}
                                    </p>
                                </div>
                            </div>

                            {/* Error Stack */}
                            {selected.errorStack && (
                                <div>
                                    <label className="text-xs text-[var(--admin-text-muted)] uppercase tracking-wider">
                                        Last Error
                                    </label>
                                    <pre className="text-xs bg-red-500/10 text-red-400 p-3 rounded-lg mt-1 overflow-auto max-h-32 font-mono">
                                        {selected.errorStack}
                                    </pre>
                                </div>
                            )}

                            {/* Console Logs */}
                            <div>
                                <button
                                    onClick={() => setExpandedLogs(!expandedLogs)}
                                    className="flex items-center justify-between w-full text-xs text-[var(--admin-text-muted)] uppercase tracking-wider hover:text-[var(--admin-text)]"
                                >
                                    <span>Console Logs ({consoleLogs.length})</span>
                                    {expandedLogs ? <MdExpandLess size={16} /> : <MdExpandMore size={16} />}
                                </button>
                                {expandedLogs && (
                                    <pre className="text-xs bg-[var(--admin-surface-2)] p-3 rounded-lg mt-1 overflow-auto max-h-48 font-mono">
                                        {consoleLogs.length > 0
                                            ? consoleLogs
                                                .map(
                                                    (l) =>
                                                        `[${l.type.toUpperCase()}] ${l.timestamp.slice(11, 19)} ${l.message}`
                                                )
                                                .join('\n')
                                            : 'No logs captured'}
                                    </pre>
                                )}
                            </div>

                            {/* Network Logs */}
                            {networkLogs.length > 0 && (
                                <div>
                                    <button
                                        onClick={() => setExpandedNetwork(!expandedNetwork)}
                                        className="flex items-center justify-between w-full text-xs text-[var(--admin-text-muted)] uppercase tracking-wider hover:text-[var(--admin-text)]"
                                    >
                                        <span>Failed Network ({networkLogs.length})</span>
                                        {expandedNetwork ? <MdExpandLess size={16} /> : <MdExpandMore size={16} />}
                                    </button>
                                    {expandedNetwork && (
                                        <pre className="text-xs bg-orange-500/10 text-orange-400 p-3 rounded-lg mt-1 overflow-auto max-h-32 font-mono">
                                            {networkLogs
                                                .map(
                                                    (n) =>
                                                        `${n.method} ${n.status} ${n.url}${n.error ? ` - ${n.error}` : ''}`
                                                )
                                                .join('\n')}
                                        </pre>
                                    )}
                                </div>
                            )}

                            {/* Admin Notes */}
                            <div>
                                <label className="text-xs text-[var(--admin-text-muted)] uppercase tracking-wider flex items-center gap-1">
                                    <MdNotes size={12} /> Admin Notes
                                </label>
                                <textarea
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    className="w-full mt-1 p-3 bg-[var(--admin-surface-2)] border border-[var(--admin-border)] rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]"
                                    rows={3}
                                    placeholder="Add notes about this issue..."
                                />
                            </div>

                            {/* Resolved Info */}
                            {selected.resolvedAt && (
                                <div className="text-xs text-[var(--admin-text-muted)] bg-green-500/10 p-2 rounded">
                                    Resolved by {selected.resolvedBy} on{' '}
                                    {new Date(selected.resolvedAt).toLocaleString()}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-4 border-t border-[var(--admin-border)]">
                                {selected.status !== 'in_progress' && (
                                    <button
                                        onClick={() => updateStatus(selected.id, 'in_progress')}
                                        disabled={updating}
                                        className="flex-1 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 text-sm"
                                    >
                                        In Progress
                                    </button>
                                )}
                                {selected.status !== 'resolved' && (
                                    <button
                                        onClick={() => updateStatus(selected.id, 'resolved')}
                                        disabled={updating}
                                        className="flex-1 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 text-sm"
                                    >
                                        Resolve
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteSubmission(selected.id)}
                                    className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                                >
                                    <MdDelete size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] flex items-center justify-center text-[var(--admin-text-muted)]">
                        <div className="text-center p-8">
                            <MdBugReport size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Select a submission to view details</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
