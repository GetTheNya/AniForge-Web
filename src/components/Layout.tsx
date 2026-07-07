import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../hooks/useNavigation';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { status, version, recordCount, progress } = useDatabase();
  const { user, profile, isLoading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { pathname, navigate } = useNavigation();
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  const handleNav = (path: string) => {
    setIsSidebarOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border-glass)] bg-[var(--color-bg-base)]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Nav */}
            <div className="flex items-center gap-4 lg:gap-6">
              {/* Hamburger Button */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-input)] border border-transparent hover:border-[var(--color-border-glass)] transition-all cursor-pointer"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => navigate('/')}
              >
                <img
                  src="/favicon.svg"
                  alt="AniForge Web Logo"
                  className="w-8 h-8 rounded-lg object-contain shadow-lg"
                />
                <div>
                  <h1 className="text-lg font-bold text-white">
                    AniForge Web
                  </h1>
                </div>
              </div>

              {/* Navigation links (Desktop) */}
              <nav className="hidden lg:flex items-center gap-2">
                <button
                  onClick={() => navigate('/')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    pathname === '/' || pathname === '/anime'
                      ? 'text-white bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:text-white'
                  }`}
                >
                  {t('nav.catalog')}
                </button>
                <button
                  onClick={() => navigate('/library')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    pathname === '/library' || pathname === '/collection'
                      ? 'text-white bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:text-white'
                  }`}
                >
                  {t('nav.library')}
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    pathname === '/settings'
                      ? 'text-white bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:text-white'
                  }`}
                >
                  <span>⚙️</span>
                  <span>{t('nav.settings')}</span>
                </button>
                <button
                  onClick={() => navigate('/android')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    pathname === '/android'
                      ? 'text-white bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:text-white'
                  }`}
                >
                  <span className="text-[14px]">🤖</span>
                  <span>{t('nav.androidApp')}</span>
                </button>
              </nav>
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

              {/* Auth button (Desktop only) */}
              <div className="hidden lg:block">
                {authLoading ? (
                  <div className="w-8 h-8 rounded-full skeleton" />
                ) : user ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-medium text-[var(--color-text-primary)]">
                        {profile?.username || user.email?.split('@')[0] || 'User'}
                      </p>
                    </div>
                    <button
                      onClick={signOut}
                      className="glass-badge bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] border-[var(--color-border-glass)] hover:border-[var(--color-accent-rose)]/40 hover:text-[var(--color-accent-rose)] transition-all cursor-pointer text-xs py-1.5 px-3"
                    >
                      {t('common.signOut')}
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
                    {t('common.signInGoogle')}
                  </button>
                )}
              </div>
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

      {/* Sidebar Drawer for Mobile */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Glassmorphic Backdrop Overlay */}
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="absolute inset-0 bg-black/40 backdrop-blur-md"
        />

        {/* Sidebar Panel */}
        <aside
          className={`absolute top-0 left-0 bottom-0 w-72 bg-[var(--color-bg-base)]/95 border-r border-[var(--color-border-glass)] backdrop-blur-2xl p-6 flex flex-col gap-6 shadow-2xl transition-transform duration-300 ease-out ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-glass)]">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => {
                setIsSidebarOpen(false);
                navigate('/');
              }}
            >
              <img
                src="/favicon.svg"
                alt="AniForge Web Logo"
                className="w-8 h-8 rounded-lg object-contain shadow-lg"
              />
              <span className="text-md font-bold text-white">AniForge Web</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-input)] border border-transparent hover:border-[var(--color-border-glass)] transition-all cursor-pointer"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Sidebar Navigation */}
          <nav className="flex flex-col gap-2 flex-1">
            <button
              onClick={() => handleNav('/')}
              className={`w-full text-left text-sm font-semibold px-4 py-3 rounded-xl transition-all cursor-pointer ${
                pathname === '/' || pathname === '/anime'
                  ? 'text-white bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-input)]/30 border border-transparent'
              }`}
            >
              {t('nav.catalog')}
            </button>
            <button
              onClick={() => handleNav('/library')}
              className={`w-full text-left text-sm font-semibold px-4 py-3 rounded-xl transition-all cursor-pointer ${
                pathname === '/library' || pathname === '/collection'
                  ? 'text-white bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-input)]/30 border border-transparent'
              }`}
            >
              {t('nav.library')}
            </button>
            <button
              onClick={() => handleNav('/settings')}
              className={`w-full text-left text-sm font-semibold px-4 py-3 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                pathname === '/settings'
                  ? 'text-white bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-input)]/30 border border-transparent'
              }`}
            >
              <span>⚙️</span>
              <span>{t('nav.settings')}</span>
            </button>
            <button
              onClick={() => handleNav('/android')}
              className={`w-full text-left text-sm font-semibold px-4 py-3 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                pathname === '/android'
                  ? 'text-white bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-input)]/30 border border-transparent'
              }`}
            >
              <span className="text-[14px]">🤖</span>
              <span>{t('nav.androidApp')}</span>
            </button>
          </nav>

          {/* Auth section for mobile (inside sidebar) */}
          <div className="pt-4 border-t border-[var(--color-border-glass)] flex flex-col gap-2">
            {authLoading ? (
              <div className="w-full h-10 rounded-xl skeleton" />
            ) : user ? (
              <div className="flex flex-col gap-3 px-1">
                <div className="flex flex-col">
                  <span className="text-[var(--color-text-tertiary)] text-[10px] font-bold uppercase tracking-wider">{t('common.signedInAs', 'Signed in as')}</span>
                  <span className="text-xs font-bold text-[var(--color-text-primary)] truncate mt-0.5">
                    {profile?.username || user.email?.split('@')[0] || 'User'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setIsSidebarOpen(false);
                    signOut();
                  }}
                  className="w-full justify-center flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-rose)]/40 hover:text-[var(--color-accent-rose)] transition-all cursor-pointer"
                >
                  🚪 {t('common.signOut')}
                </button>
              </div>
            ) : (
              <div className="px-1">
                <button
                  onClick={() => {
                    setIsSidebarOpen(false);
                    signInWithGoogle();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border-glass)] bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-card-hover)] text-xs font-semibold text-white transition-all cursor-pointer"
                >
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
                  <span>{t('common.signInGoogle')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Database status for mobile (inside sidebar) */}
          <div className="pt-4 border-t border-[var(--color-border-glass)] flex flex-col gap-2">
            <div className="text-[var(--color-text-secondary)] text-xs font-semibold px-1">
              {t('common.status')}
            </div>
            <DatabaseStatusPill
              status={status}
              version={version}
              recordCount={recordCount}
              progress={progress}
              className="flex items-center gap-2 text-xs"
            />
          </div>
        </aside>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border-glass)] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-muted)]">
            AniForge Web {import.meta.env.VITE_APP_VERSION || 'v0.0.0-dev'} • {t('library.subtext')}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t('common.poweredBy')}
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
  className = "hidden sm:flex items-center gap-2 text-xs",
}: {
  status: string;
  version: number | null;
  recordCount: number | null;
  progress: number;
  className?: string;
}) {
  const { t } = useTranslation();

  const statusConfig: Record<string, { color: string; label: string }> = {
    idle: { color: 'text-[var(--color-text-muted)]', label: t('dbStatus.idle') },
    loading: { color: 'text-[var(--color-status-upcoming)]', label: t('dbStatus.loading') },
    ready: { color: 'text-[var(--color-status-releasing)]', label: t('dbStatus.ready') },
    checking: { color: 'text-[var(--color-accent-secondary)]', label: t('dbStatus.checking') },
    downloading: {
      color: 'text-[var(--color-accent-primary)]',
      label: `${t('dbStatus.downloading')} ${Math.round(progress * 100)}%`,
    },
    processing: { color: 'text-[var(--color-status-upcoming)]', label: t('dbStatus.processing') },
    error: { color: 'text-[var(--color-status-cancelled)]', label: t('dbStatus.error') },
  };

  const cfg = statusConfig[status] || statusConfig.idle;

  return (
    <div className={className}>
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
