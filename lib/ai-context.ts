import type { SupabaseClient } from "@supabase/supabase-js";
import { summarize, type Entry } from "@/lib/analysis";
import { bucketsByMonth, currentMonth, effectiveAnnualBudget, isoDate, monthlyEquivalent, monthBounds, percentUsed, resolveSettings, sumBy, totalsByCategory } from "@/lib/budget/calc";
import type { Expense, Income, MonthSettings, Recurring } from "@/lib/budget/types";

const DAY_MS = 86400000;
const truncate = (value: unknown, limit: number) => typeof value === "string" ? value.slice(0, limit) : value;
const missingBudgetSchemaCodes = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

export async function loadLifeLensContext(supabase: SupabaseClient, userId: string) {
  const since = new Date(Date.now() - 90 * DAY_MS).toISOString().slice(0, 10);
  const today = isoDate();
  const month = currentMonth();
  const sinceTimestamp = `${since}T00:00:00.000Z`;
  const [dailyResult, activityResult, habitResult, goalResult, progressResult, journalResult, insightResult, patternResult, expenseResult, incomeResult, settingsResult, savingsResult, recurringResult, currencyResult] = await Promise.all([
    supabase.from("daily_entries").select("entry_date,mood,energy,sleep_hours,work_minutes,exercise_minutes,screen_minutes,money_spent,tasks_done,tasks_open,events,notes").gte("entry_date", since).order("entry_date").limit(120),
    supabase.from("activities").select("entry_date,label,minutes").gte("entry_date", since).order("entry_date", { ascending: false }).limit(200),
    supabase.from("habits").select("name,active,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("goals").select("title,target,due_date,status,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("goal_progress").select("goal_id,entry_date,progress,note").gte("entry_date", since).order("entry_date", { ascending: false }).limit(200),
    supabase.from("journal_entries").select("entry_date,body,created_at").gte("entry_date", since).order("entry_date", { ascending: false }).limit(30),
    supabase.from("insights").select("kind,title,explanation,evidence,confidence,period_start,period_end,suggested_action,created_at").gte("created_at", sinceTimestamp).order("created_at", { ascending: false }).limit(20),
    supabase.from("detected_patterns").select("key,stats,updated_at").order("updated_at", { ascending: false }).limit(30),
    supabase.from("budget_expenses").select("id,name,amount,category,expense_date", { count: "exact" }).eq("user_id", userId).gte("expense_date", since).lte("expense_date", today).order("expense_date", { ascending: false }).limit(300),
    supabase.from("budget_income").select("id,amount,source,income_date", { count: "exact" }).eq("user_id", userId).gte("income_date", since).lte("income_date", today).order("income_date", { ascending: false }).limit(300),
    supabase.from("budget_months").select("month,spend_budget,annual_budget,savings_goal", { count: "exact" }).eq("user_id", userId).order("month", { ascending: false }).limit(120),
    supabase.rpc("budget_savings_balance", { p_month: month }),
    supabase.from("budget_recurring").select("id,name,amount,category,frequency,due_date,reminder_days_before,active,notes", { count: "exact" }).eq("user_id", userId).order("due_date").limit(100),
    supabase.from("user_preferences").select("currency").eq("user_id", userId).maybeSingle(),
  ]);

  const firstError = [dailyResult, activityResult, habitResult, goalResult, progressResult, journalResult, insightResult, patternResult].find((result) => result.error)?.error;
  if (firstError) return { context: null, error: firstError };
  const budgetResults = [expenseResult, incomeResult, settingsResult, savingsResult, recurringResult, currencyResult];
  const budgetError = budgetResults.find((result) => result.error)?.error;
  const budgetUnavailable = Boolean(budgetError && missingBudgetSchemaCodes.has(budgetError.code ?? ""));
  if (budgetError && !budgetUnavailable) return { context: null, error: budgetError };

  const dailyEntries = (dailyResult.data ?? []) as (Entry & { notes: string | null; events: string | null; tasks_done: number | null; tasks_open: number | null })[];
  let budgetContext: Record<string, unknown>;
  if (budgetUnavailable) {
    budgetContext = { available: false, reason: "The Budget module is not installed." };
  } else {
    const expenses = ((expenseResult.data ?? []) as Expense[]).map((item) => ({ ...item, amount: Number(item.amount) }));
    const income = ((incomeResult.data ?? []) as Income[]).map((item) => ({ ...item, amount: Number(item.amount) }));
    const settings = ((settingsResult.data ?? []) as MonthSettings[]).map((item) => ({
      ...item,
      spend_budget: Number(item.spend_budget),
      annual_budget: Number(item.annual_budget),
      savings_goal: Number(item.savings_goal),
    }));
    const recurring = ((recurringResult.data ?? []) as Recurring[]).map((item) => ({ ...item, amount: Number(item.amount) }));
    const currentSettings = resolveSettings(settings, month);
    const currentBounds = monthBounds(month);
    const currentMonthExpenses = expenses.filter((item) => item.expense_date >= currentBounds.start && item.expense_date <= today);
    const currentMonthIncome = income.filter((item) => item.income_date >= currentBounds.start && item.income_date <= today);
    const monthBuckets = bucketsByMonth(expenses, income, since, today);
    const availableExpenseCount = expenseResult.count ?? expenses.length;
    const availableIncomeCount = incomeResult.count ?? income.length;
    const availableRecurringCount = recurringResult.count ?? recurring.length;
    const savingsBalance = Number(savingsResult.data ?? 0);
    budgetContext = {
      available: true,
      currency: currencyResult.data?.currency ?? "USD",
      reporting_period: { start: since, end: today, days: 90 },
      statistics: {
        expenses_total: sumBy(expenses, (item) => item.amount),
        income_total: sumBy(income, (item) => item.amount),
        net: sumBy(income, (item) => item.amount) - sumBy(expenses, (item) => item.amount),
        expenses_by_category: totalsByCategory(expenses),
        monthly_breakdown: monthBuckets,
        transaction_coverage: {
          expenses_returned: expenses.length,
          expenses_available: availableExpenseCount,
          expenses_truncated: availableExpenseCount > expenses.length,
          income_returned: income.length,
          income_available: availableIncomeCount,
          income_truncated: availableIncomeCount > income.length,
        },
      },
      current_month: {
        month,
        expenses_total: sumBy(currentMonthExpenses, (item) => item.amount),
        income_total: sumBy(currentMonthIncome, (item) => item.amount),
        spend_budget: currentSettings.spend_budget,
        spend_budget_inherited: currentSettings.inherited,
        annual_budget: effectiveAnnualBudget(settings, new Date().getFullYear()),
        savings_goal: currentSettings.savings_goal,
        spend_budget_used_percent: currentSettings.spend_budget > 0 ? percentUsed(sumBy(currentMonthExpenses, (item) => item.amount), currentSettings.spend_budget) : null,
        savings_goal_progress_percent: currentSettings.savings_goal > 0 ? percentUsed(savingsBalance, currentSettings.savings_goal) : null,
      },
      savings: { balance: savingsBalance, as_of: today },
      recurring: {
        active_count_returned: recurring.filter((item) => item.active).length,
        monthly_equivalent_returned: monthlyEquivalent(recurring),
        entries_returned: recurring.length,
        entries_available: availableRecurringCount,
        entries_truncated: availableRecurringCount > recurring.length,
        entries: recurring.map((item) => ({ ...item, notes: truncate(item.notes, 240) })),
      },
      expenses: expenses.map((item) => ({ ...item, name: truncate(item.name, 120) })),
      income: income.map((item) => ({ id: item.id, source: truncate(item.source, 120), amount: item.amount, income_date: item.income_date })),
      recent_month_settings: settings.slice(0, 24),
      month_settings_truncated: (settingsResult.count ?? settings.length) > settings.length,
    };
  }

  const context = {
    period: { start: since, end: dailyEntries.at(-1)?.entry_date ?? since },
    summary: summarize(dailyEntries),
    daily_metrics: dailyEntries.map((entry) => ({ ...entry, notes: truncate(entry.notes, 1200), events: truncate(entry.events, 500) })),
    activities: (activityResult.data ?? []).map((activity) => ({ ...activity, label: truncate(activity.label, 160) })),
    habits: habitResult.data ?? [],
    goals: (goalResult.data ?? []).map((goal) => ({ ...goal, title: truncate(goal.title, 160), target: truncate(goal.target, 240) })),
    goal_progress: (progressResult.data ?? []).map((progress) => ({ ...progress, note: truncate(progress.note, 800) })),
    journal_entries: (journalResult.data ?? []).map((journal) => ({ ...journal, body: truncate(journal.body, 3000) })),
    previous_insights: (insightResult.data ?? []).map((insight) => ({ ...insight, title: truncate(insight.title, 200), explanation: truncate(insight.explanation, 1200), evidence: truncate(insight.evidence, 600), suggested_action: truncate(insight.suggested_action, 500) })),
    detected_patterns: patternResult.data ?? [],
    budget: budgetContext,
  };

  return { context, error: null };
}
