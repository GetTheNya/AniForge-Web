import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../hooks/useNavigation';
import QRCode from 'qrcode';

export default function AndroidDownloadView() {
  const { t } = useTranslation();
  const { search, navigate } = useNavigation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const downloadUrl = 'https://github.com/GetTheNya/AniForge/releases/latest';
  const repoUrl = 'https://github.com/GetTheNya/AniForge';

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        downloadUrl,
        {
          width: 180,
          margin: 1.5,
          color: {
            dark: '#F1F5F9', // light elements matching --color-text-primary
            light: '#131316', // dark background matching --color-bg-elevated
          },
        },
        (error) => {
          if (error) console.error('QR code generation error:', error);
        }
      );
    }
  }, [downloadUrl]);

  const handleContinue = () => {
    localStorage.setItem('aniforge_skip_mobile_prompt', 'true');
    const queryParams = new URLSearchParams(search);
    const returnTo = queryParams.get('returnTo') || '/';
    const safePath = returnTo.startsWith('/') ? returnTo : '/';

    const qIndex = safePath.indexOf('?');
    if (qIndex !== -1) {
      const path = safePath.substring(0, qIndex);
      const query = safePath.substring(qIndex);
      navigate(path, query);
    } else {
      navigate(safePath);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 animate-fade-in">
      <div className="glass-card relative overflow-hidden p-8 flex flex-col items-center text-center gap-6 backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)]">
        {/* Decorative subtle accent glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[var(--color-accent-primary)]/10 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[var(--color-accent-secondary)]/10 rounded-full filter blur-3xl pointer-events-none" />

        {/* Android visual badge / icon */}
        <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] flex items-center justify-center shadow-xl">
          <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16.621 17.778l1.321 2.287a.5.5 0 0 1-.865.5l-1.332-2.308c-1.229.467-2.612.723-4.108.723s-2.879-.256-4.108-.723L6.197 20.56a.5.5 0 0 1-.865-.5l1.321-2.287C4.195 16.035 2.656 13.568 2.52 10.75h18.96c-.136 2.818-1.675 5.285-4.129 7.028zM7.5 13.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm9 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM12 2.5a.5.5 0 0 1 .5.5v1.2c2.093.18 3.985.989 5.438 2.21l.732-.732a.5.5 0 0 1 .707.707l-.766.766A9.957 9.957 0 0 1 20.5 10H3.5c.026-1.077.299-2.093.789-3.009l-.766-.766a.5.5 0 0 1 .707-.707l.732.732A7.96 7.96 0 0 1 11.5 4.2V3a.5.5 0 0 1 .5-.5z" />
          </svg>
        </div>

        {/* Text descriptions */}
        <div className="space-y-2 relative z-10">
          <h2 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
            {t('download.title')}
          </h2>
          <p className="text-xs font-semibold text-[var(--color-accent-secondary)] tracking-wider uppercase">
            {t('download.subtitle')}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-sm mx-auto pt-2">
            {t('download.description')}
          </p>
        </div>

        {/* Custom premium QR code wrapper with dark background */}
        <div className="relative z-10 flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#131316] border border-[var(--color-border-glass)] shadow-2xl transition-all duration-300 hover:border-[var(--color-accent-primary)]/30 group">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--color-accent-primary)]/10 to-[var(--color-accent-secondary)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <canvas ref={canvasRef} className="w-[180px] h-[180px] rounded-lg relative z-10" />
          <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mt-1 select-none">
            {t('download.qrLabel')}
          </span>
        </div>

        {/* Call to Actions */}
        <div className="w-full space-y-3 relative z-10">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white transition-all duration-300 bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] shadow-[0_4px_20px_rgba(139,92,246,0.25)] hover:shadow-[0_6px_28px_rgba(139,92,246,0.35)] hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>🤖</span>
            <span>{t('download.buttonAndroid')}</span>
          </a>

          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold border border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] transition-all duration-200 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-border-glass-hover)]"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.646.64.699 1.026 1.592 1.026 2.683 0 3.842-2.337 4.687-4.565 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span>{t('download.githubRepo')}</span>
          </a>
        </div>

        <hr className="w-full border-[var(--color-border-glass)] relative z-10" />

        {/* Bypass link */}
        <button
          onClick={handleContinue}
          className="relative z-10 text-xs font-bold text-[var(--color-text-secondary)] hover:text-white transition-all cursor-pointer select-none underline decoration-[var(--color-border-glass)] hover:decoration-white underline-offset-4"
        >
          {t('download.continueToWeb')}
        </button>
      </div>
    </div>
  );
}
