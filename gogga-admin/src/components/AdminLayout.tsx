'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MdDashboard,
  MdCloud,
  MdStorage,
  MdPeople,
  MdCardGiftcard,
  MdReceipt,
  MdHistory,
  MdSettings,
  MdMenu,
  MdClose,
  MdTerminal,
  MdBugReport,
  MdGeneratingTokens,
  MdKey,
  MdPayment,
  MdInsights,
} from 'react-icons/md';

const navItems = [
  { href: '/', label: 'Dashboard', icon: MdDashboard },
  { href: '/usage', label: 'Usage Analytics', icon: MdInsights },
  { href: '/services', label: 'Services', icon: MdCloud },
  { href: '/api-keys', label: 'API Keys', icon: MdKey },
  { href: '/terminal', label: 'Terminal', icon: MdTerminal },
  { href: '/database', label: 'Database', icon: MdStorage },
  { href: '/users', label: 'Users', icon: MdPeople },
  { href: '/subscriptions', label: 'Subscriptions', icon: MdReceipt },
  { href: '/transactions', label: 'Transactions', icon: MdPayment },
  { href: '/tokens', label: 'Token Pricing', icon: MdGeneratingTokens },
  { href: '/vouchers', label: 'Vouchers', icon: MdCardGiftcard },
  { href: '/debug-submissions', label: 'Debug Reports', icon: MdBugReport },
  { href: '/logs', label: 'Logs & Audit', icon: MdHistory },
  { href: '/settings', label: 'Settings', icon: MdSettings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-(--admin-bg)">
      {/* Sidebar - fixed position */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-64 bg-(--admin-surface) border-r border-(--admin-border) transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-(--admin-border)">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-(--admin-surface-2) flex items-center justify-center">
              <span className="text-lg font-bold">G</span>
            </div>
            <span className="text-lg font-bold tracking-tight">GOGGA Admin</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                    ? 'bg-(--admin-surface-2) text-(--admin-text)'
                    : 'text-(--admin-text-secondary) hover:bg-(--admin-surface-2) hover:text-(--admin-text)'
                  }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-(--admin-border)">
          <div className="text-xs text-(--admin-text-muted)">
            <p>GOGGA Admin v1.0.0</p>
            <p className="mt-1">Port 3100</p>
          </div>
        </div>
      </aside>

      {/* Main content wrapper - uses inline style for reliable margin */}
      <div
        className="min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? '256px' : '0' }}
      >
        {/* Header */}
        <header className="sticky top-0 z-20 h-16 bg-(--admin-bg) border-b border-(--admin-border) flex items-center px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-(--admin-surface) transition-colors"
          >
            <MdMenu size={24} />
          </button>
          <div className="ml-4">
            <h1 className="text-lg font-semibold">
              {navItems.find((item) => item.href === pathname)?.label || 'Dashboard'}
            </h1>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
