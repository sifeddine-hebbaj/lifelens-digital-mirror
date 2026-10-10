"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { fetchCurrency } from "@/lib/budget/api";
import { currentMonth } from "@/lib/budget/calc";
import { budgetMessages, formatText, type BudgetKey } from "@/lib/budget/i18n";

type BudgetContextValue = {
  month: string;
  setMonth: (month: string) => void;
  currency: string;
  currencyRate: { from: string; value: number; date: string } | null;
  locale: string;
  money: (amount: number) => string;
  monthLabel: (month: string) => string;
  tb: (key: BudgetKey, vars?: Record<string, string | number>) => string;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [month, setMonth] = useState(() => currentMonth());
  const [currency, setCurrency] = useState("USD");
  const [currencyRate, setCurrencyRate] = useState<BudgetContextValue["currencyRate"]>(null);
  // Latin digits in Arabic so amounts and dates stay easy to compare across languages.
  const locale = language === "ar" ? "ar-MA-u-nu-latn" : language === "en" ? "en-US" : "fr-FR";

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchCurrency(user.id).then((preference) => {
      if (alive) { setCurrency(preference.currency); setCurrencyRate(preference.rate); }
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [user]);

  const money = useCallback((amount: number) => {
    try { return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
    catch { return `${amount.toFixed(2)} ${currency}`; }
  }, [currency, locale]);

  const monthLabel = useCallback((value: string) => new Date(`${value}-01T12:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" }), [locale]);
  const tb = useCallback((key: BudgetKey, vars?: Record<string, string | number>) => formatText(budgetMessages[language][key], vars), [language]);

  const value = useMemo(() => ({ month, setMonth, currency, currencyRate, locale, money, monthLabel, tb }), [month, currency, currencyRate, locale, money, monthLabel, tb]);
  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) throw new Error("useBudget must be used inside BudgetProvider");
  return context;
}
