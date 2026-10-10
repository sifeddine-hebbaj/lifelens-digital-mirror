"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useBudget } from "@/components/budget/budget-provider";
import { fetchSavingsBalance, listExpenses, listIncome, listMonthSettings, listRecurring } from "./api";
import { monthBounds, resolveSettings, sumBy, totalsByCategory } from "./calc";
import type { Expense, Income, MonthSettings, Recurring } from "./types";

type State = { loading: boolean; error: string; expenses: Expense[]; income: Income[]; settingsRows: MonthSettings[]; balance: number; recurring: Recurring[] };
const initial: State = { loading: true, error: "", expenses: [], income: [], settingsRows: [], balance: 0, recurring: [] };

/** Everything the selected month needs, loaded together and reloadable after a change. */
export function useMonthData() {
  const { user } = useAuth();
  const { month } = useBudget();
  const [state, setState] = useState<State>(initial);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const { start, end } = monthBounds(month);
    setState((current) => ({ ...current, loading: true, error: "" }));
    Promise.all([listExpenses(start, end), listIncome(start, end), listMonthSettings(), fetchSavingsBalance(month), listRecurring()])
      .then(([expenses, income, settingsRows, balance, recurring]) => { if (alive) setState({ loading: false, error: "", expenses, income, settingsRows, balance, recurring }); })
      .catch((reason: unknown) => { if (alive) setState((current) => ({ ...current, loading: false, error: reason instanceof Error ? reason.message : String(reason) })); });
    return () => { alive = false; };
  }, [user, month, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  const derived = useMemo(() => {
    const totalExpenses = sumBy(state.expenses, (item) => item.amount);
    const totalIncome = sumBy(state.income, (item) => item.amount);
    const settings = resolveSettings(state.settingsRows, month);
    return { totalExpenses, totalIncome, net: totalIncome - totalExpenses, settings, categoryTotals: totalsByCategory(state.expenses), remaining: settings.spend_budget - totalExpenses };
  }, [state.expenses, state.income, state.settingsRows, month]);

  return { ...state, ...derived, reload };
}
