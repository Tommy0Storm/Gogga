/**
 * GOGGA RAG Dashboard Page
 * Standalone page for monitoring RAG, embeddings, and context memory
 */

'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { PageErrorBoundary } from '@/components/ErrorBoundary';

// Dynamic import to avoid SSR issues with Recharts
const RAGDashboard = dynamic(
  () => import('@/components/dashboard').then(mod => mod.RAGDashboard),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-primary-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-primary-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    ),
  }
);

export default function DashboardPage() {
  // Use state to avoid hydration mismatch - only read localStorage after mount
  const [sessionId, setSessionId] = useState<string>('default-session');
  const [tier, setTier] = useState<'free' | 'jive' | 'jigga'>('free');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedSessionId = localStorage.getItem('gogga_session_id') || 'default-session';
    setSessionId(storedSessionId);
    
    // Get actual tier from localStorage (set by ChatClient from session)
    const storedTier = localStorage.getItem('gogga_tier') as 'free' | 'jive' | 'jigga' | null;
    if (storedTier && ['free', 'jive', 'jigga'].includes(storedTier)) {
      setTier(storedTier);
    }
  }, []);

  // Don't render dashboard until client-side mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-primary-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-primary-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <PageErrorBoundary pageName="RAG Dashboard">
      <main>
        <RAGDashboard 
          tier={tier} 
          sessionId={sessionId}
        />
      </main>
    </PageErrorBoundary>
  );
}
