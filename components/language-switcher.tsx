"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className={cn("language-switch", className)} role="group" aria-label={t("language")}>
      <button type="button" lang="fr" aria-pressed={language === "fr"} onClick={() => setLanguage("fr")}>{t("frenchShort")}</button>
      <button type="button" lang="ar" aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>{t("arabicShort")}</button>
      <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>{t("englishShort")}</button>
    </div>
  );
}