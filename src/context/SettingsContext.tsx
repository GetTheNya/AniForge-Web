import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import i18n from '../i18n';

export type Language = 'uk' | 'en';

interface SettingsContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  preferUkTitles: boolean;
  setPreferUkTitles: (prefer: boolean) => void;
  getAnimeTitle: (anime: {
    title_uk: string | null;
    title_en: string | null;
    title_romaji: string;
  }) => string;
}

const getBrowserLanguage = (): Language => {
  const lang = navigator.language || 'en';
  return lang.toLowerCase().startsWith('uk') ? 'uk' : 'en';
};

const getInitialLanguage = (): Language => {
  const saved = localStorage.getItem('aniforge_lang');
  if (saved === 'uk' || saved === 'en') return saved;
  return getBrowserLanguage();
};

const getInitialPreferUk = (): boolean => {
  const saved = localStorage.getItem('aniforge_prefer_uk');
  return saved !== null ? saved === 'true' : false;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const [preferUkTitles, setPreferUkTitlesState] = useState<boolean>(getInitialPreferUk);

  // Sync language with i18n instance programmatically
  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('aniforge_lang', lang);
  }, []);

  const setPreferUkTitles = useCallback((prefer: boolean) => {
    setPreferUkTitlesState(prefer);
    localStorage.setItem('aniforge_prefer_uk', String(prefer));
  }, []);

  const getAnimeTitle = useCallback((anime: {
    title_uk: string | null;
    title_en: string | null;
    title_romaji: string;
  }) => {
    if (preferUkTitles && anime.title_uk) {
      return anime.title_uk;
    }
    return anime.title_en || anime.title_romaji || '';
  }, [preferUkTitles]);

  return (
    <SettingsContext.Provider
      value={{
        language,
        setLanguage,
        preferUkTitles,
        setPreferUkTitles,
        getAnimeTitle,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
