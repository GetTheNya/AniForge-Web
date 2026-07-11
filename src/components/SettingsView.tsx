import { useSettings } from '../context/SettingsContext';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', flagCode: 'us', labelKey: 'settings.english' },
  { code: 'uk', flagCode: 'ua', labelKey: 'settings.ukrainian' },
] as const;

export default function SettingsView() {
  const { t } = useTranslation();
  const { language, setLanguage, preferUkTitles, setPreferUkTitles } = useSettings();

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-[var(--color-text-primary)]">
          {t('settings.title')}
        </h2>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
          {t('settings.subtext')}
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="glass-card p-6 space-y-6 relative overflow-hidden backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)]">
        {/* Glow effect in background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-accent-primary)]/5 rounded-full filter blur-3xl pointer-events-none -mr-32 -mt-32" />

        {/* Language Selection */}
        <div className="space-y-3 relative z-10">
          <label className="text-sm font-bold text-[var(--color-text-primary)]">
            {t('settings.language')}
          </label>
          <div className="flex gap-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer select-none flex items-center justify-center gap-2 ${
                  language === lang.code
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] shadow-[0_0_12px_rgba(var(--color-accent-primary-rgb),0.25)]'
                    : 'border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card-hover)]'
                }`}
              >
                <img
                  src={`https://flagcdn.com/${lang.flagCode}.svg`}
                  className="w-5 h-3.5 rounded-sm object-cover shadow-sm border border-white/10 shrink-0"
                  alt={`${lang.flagCode} flag`}
                  loading="lazy"
                />
                <span>{t(lang.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <hr className="border-[var(--color-border-glass)] relative z-10" />

        {/* Prefer Ukrainian Titles Toggle */}
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <label className="text-sm font-bold text-[var(--color-text-primary)] cursor-pointer" htmlFor="prefer-uk-toggle">
              {t('settings.preferUk')}
            </label>
            <p className="text-xs text-[var(--color-text-tertiary)] max-w-lg leading-relaxed">
              {t('settings.preferUkSubtext')}
            </p>
          </div>
          
          <label htmlFor="prefer-uk-toggle" className="relative inline-flex items-center cursor-pointer mt-1">
            <input
              type="checkbox"
              id="prefer-uk-toggle"
              checked={preferUkTitles}
              onChange={(e) => setPreferUkTitles(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-[var(--color-text-secondary)] peer-checked:after:bg-[var(--color-accent-primary)] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-accent-primary)]/10 peer-checked:border-[var(--color-accent-primary)]"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
