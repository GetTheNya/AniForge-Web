/**
 * Layout — App shell with glassmorphic header, Google auth button,
 * and database status indicator.
 */

import type { ReactNode } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { status, version, recordCount, progress } = useDatabase();
  const { user, isLoading: authLoading, signInWithGoogle, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border-glass)] bg-[var(--color-bg-base)]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-sm">A</span>
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] bg-clip-text text-transparent">
                  AniForge Web
                </h1>
              </div>
            </div>

            {/* Status + Auth */}
            <div className="flex items-center gap-4">
              {/* Database status pill */}
              <DatabaseStatusPill
                status={status}
                version={version}
                recordCount={recordCount}
                progress={progress}
              />

              {/* Auth button */}
              {authLoading ? (
                <div className="w-8 h-8 rounded-full skeleton" />
              ) : user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-medium text-[var(--color-text-primary)]">
                      {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={signOut}
                    className="glass-badge bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] border-[var(--color-border-glass)] hover:border-[var(--color-accent-rose)]/40 hover:text-[var(--color-accent-rose)] transition-all cursor-pointer text-xs py-1.5 px-3"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-2 glass-button text-sm"
                  id="google-sign-in-btn"
                >
                  {/* Google icon */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#fff"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="#fff"
                      opacity=".8"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#fff"
                      opacity=".6"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#fff"
                      opacity=".4"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Download progress bar */}
        {(status === 'downloading' || status === 'processing') && (
          <div className="h-0.5 bg-[var(--color-bg-elevated)]">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] progress-glow transition-all duration-300 ease-out"
              style={{ width: `${Math.max(progress * 100, status === 'processing' ? 95 : 2)}%` }}
            />
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border-glass)] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-muted)]">
            AniForge Web • Offline-First Anime Catalog
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Powered by SQLite WASM + Supabase
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Database Status Pill ───────────────────────────────────────────────────────

function DatabaseStatusPill({
  status,
  version,
  recordCount,
  progress,
}: {
  status: string;
  version: number | null;
  recordCount: number | null;
  progress: number;
}) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    idle: { color: 'text-[var(--color-text-muted)]', label: 'Idle' },
    loading: { color: 'text-[var(--color-status-upcoming)]', label: 'Loading...' },
    ready: { color: 'text-[var(--color-status-releasing)]', label: 'Ready' },
    checking: { color: 'text-[var(--color-accent-secondary)]', label: 'Checking...' },
    downloading: {
      color: 'text-[var(--color-accent-primary)]',
      label: `Downloading ${Math.round(progress * 100)}%`,
    },
    processing: { color: 'text-[var(--color-status-upcoming)]', label: 'Processing...' },
    error: { color: 'text-[var(--color-status-cancelled)]', label: 'Error' },
  };

  const cfg = statusConfig[status] || statusConfig.idle;

  return (
    <div className="hidden sm:flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${status === 'ready' ? 'bg-[var(--color-status-releasing)]' : status === 'error' ? 'bg-[var(--color-status-cancelled)]' : 'bg-[var(--color-status-upcoming)] animate-pulse'}`} />
      <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
      {version !== null && (
        <span className="text-[var(--color-text-muted)]">
          v{version}
          {recordCount !== null && ` • ${recordCount.toLocaleString()}`}
        </span>
      )}
    </div>
  );
}
