"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { messages, type Language, type TranslationKey } from "@/lib/i18n";

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("fr");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("lifelens-language");
    if (saved === "fr" || saved === "ar" || saved === "en") setLanguage(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("lifelens-language", language);
  }, [language, ready]);

  function t(key: TranslationKey) {
    return messages[language][key];
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}