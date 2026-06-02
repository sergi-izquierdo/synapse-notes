"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { translations, Language } from "@/lib/translations";

type Translations = typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

// Persist for a year. SameSite=Lax is enough: the cookie only drives UI
// language, it carries no auth, and we want it sent on top-level
// navigations so the server renders in the right language.
function writeLangCookie(lang: Language) {
  document.cookie = `synapse-lang=${lang}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageProvider({
  children,
  initialLanguage = "ca",
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  // Initial value comes from the cookie read server-side (passed as a
  // prop), so SSR and the first client render agree and there is no flash.
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  // One-time migration for users who set the language before the cookie
  // existed (it lived only in localStorage). Adopt the stored choice and
  // mirror it into the cookie so future server renders match.
  useEffect(() => {
    const saved = localStorage.getItem("synapse-lang") as Language | null;
    if (saved && saved !== initialLanguage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage->cookie migration
      setLanguageState(saved);
      writeLangCookie(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // Keep <html lang> in sync with the active language for screen readers
  // and hreflang signals.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("synapse-lang", lang);
    writeLangCookie(lang);
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
