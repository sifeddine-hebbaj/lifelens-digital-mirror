import { supabaseBrowser } from "@/lib/supabase/client";
import type { Expense, Frequency, Income, MonthSettings, Recurring } from "./types";

function client() {
  const supabase = supabaseBrowser();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

type Failure = { message: string } | null;
const fail = (error: Failure) => { if (error) throw new Error(error.message); };

/** PostgREST returns at most 1000 rows per request, so long ranges are read page by page. */
async function pageAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: Failure }>) {
  const rows: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await query(from, from + size - 1);
    fail(error);
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}

const num = (value: unknown) => Number(value ?? 0);
const missingReminderColumn = (error: unknown) => error instanceof Error && /(?:column|field).{0,80}email_reminder_enabled|email_reminder_enabled.{0,80}(?:column|field)/i.test(error.message);

/* ----------------------------- preferences ----------------------------- */
export async function fetchCurrency(userId: string) {
  const { data, error } = await client().from("user_preferences")
    .select("currency,last_currency_rate_from,last_currency_rate,last_currency_rate_date")
    .eq("user_id", userId).maybeSingle();
  fail(error);
  const rate = Number(data?.last_currency_rate);
  const rateFrom = data?.last_currency_rate_from as string | null | undefined;
  const rateDate = data?.last_currency_rate_date as string | null | undefined;
  return {
    currency: (data?.currency as string | undefined) ?? "USD",
    rate: rateFrom && rateDate && Number.isFinite(rate) && rate > 0 ? { from: rateFrom, value: rate, date: rateDate } : null,
  };
}

/* ------------------------------- expenses ------------------------------ */
export type ExpenseInput = { name: string; amount: number; category: string; expense_date: string };

export async function listExpenses(start: string, end: string): Promise<Expense[]> {
  const rows = await pageAll<Expense>((from, to) => client().from("budget_expenses")
    .select("id,name,amount,category,expense_date").gte("expense_date", start).lte("expense_date", end)
    .order("expense_date", { ascending: false }).order("created_at", { ascending: false }).range(from, to));
  return rows.map((row) => ({ ...row, amount: num(row.amount) }));
}
export async function addExpense(userId: string, input: ExpenseInput) {
  fail((await client().from("budget_expenses").insert({ user_id: userId, ...input })).error);
}
export async function updateExpense(id: string, input: ExpenseInput) {
  fail((await client().from("budget_expenses").update(input).eq("id", id)).error);
}
export async function deleteExpense(id: string) {
  fail((await client().from("budget_expenses").delete().eq("id", id)).error);
}

/* -------------------------------- income ------------------------------- */
export type IncomeInput = { amount: number; source: string; note: string; income_date: string };

export async function listIncome(start: string, end: string): Promise<Income[]> {
  const rows = await pageAll<Income>((from, to) => client().from("budget_income")
    .select("id,amount,source,note,income_date").gte("income_date", start).lte("income_date", end)
    .order("income_date", { ascending: false }).order("created_at", { ascending: false }).range(from, to));
  return rows.map((row) => ({ ...row, amount: num(row.amount) }));
}
export async function addIncome(userId: string, input: IncomeInput) {
  fail((await client().from("budget_income").insert({ user_id: userId, ...input })).error);
}
export async function deleteIncome(id: string) {
  fail((await client().from("budget_income").delete().eq("id", id)).error);
}

/* ------------------------- monthly settings & savings ------------------- */
export async function listMonthSettings(): Promise<MonthSettings[]> {
  const rows = await pageAll<MonthSettings>((from, to) => client().from("budget_months")
    .select("month,spend_budget,annual_budget,savings_goal").order("month", { ascending: false }).range(from, to));
  return rows.map((row) => ({ month: row.month, spend_budget: num(row.spend_budget), annual_budget: num(row.annual_budget), savings_goal: num(row.savings_goal) }));
}
export async function saveMonthSettings(userId: string, settings: MonthSettings) {
  fail((await client().from("budget_months").upsert(
    { user_id: userId, ...settings, updated_at: new Date().toISOString() },
    { onConflict: "user_id,month" },
  )).error);
}
export async function fetchSavingsBalance(month: string) {
  const { data, error } = await client().rpc("budget_savings_balance", { p_month: month });
  fail(error);
  return num(data);
}
export async function correctSavings(month: string, target: number, note: string) {
  const { error } = await client().rpc("budget_correct_savings", { p_month: month, p_target: target, p_note: note });
  fail(error);
}

/* ------------------------------- recurring ----------------------------- */
export type RecurringInput = {
  name: string; amount: number; category: string; frequency: Frequency;
  due_date: string; reminder_days_before: number; email_reminder_enabled: boolean; notes: string;
};

export async function listRecurring(): Promise<Recurring[]> {
  const supabase = client();
  try {
    const rows = await pageAll<Recurring>((from, to) => supabase.from("budget_recurring")
      .select("id,name,amount,category,frequency,due_date,reminder_days_before,email_reminder_enabled,active,notes")
      .order("due_date", { ascending: true }).range(from, to));
    return rows.map((row) => ({ ...row, amount: num(row.amount), reminder_days_before: num(row.reminder_days_before) }));
  } catch (error) {
    if (!missingReminderColumn(error)) throw error;
    const rows = await pageAll<Omit<Recurring, "email_reminder_enabled">>((from, to) => supabase.from("budget_recurring")
      .select("id,name,amount,category,frequency,due_date,reminder_days_before,active,notes")
      .order("due_date", { ascending: true }).range(from, to));
    return rows.map((row) => ({ ...row, amount: num(row.amount), reminder_days_before: num(row.reminder_days_before), email_reminder_enabled: false }));
  }
}
export async function addRecurring(userId: string, input: RecurringInput) {
  const supabase = client();
  try { fail((await supabase.from("budget_recurring").insert({ user_id: userId, ...input })).error); }
  catch (error) {
    if (!missingReminderColumn(error) || input.email_reminder_enabled) throw error;
    const legacyInput = { ...input };
    Reflect.deleteProperty(legacyInput, "email_reminder_enabled");
    fail((await supabase.from("budget_recurring").insert({ user_id: userId, ...legacyInput })).error);
  }
}
export async function updateRecurring(id: string, input: Partial<RecurringInput> & { active?: boolean }) {
  const supabase = client();
  try { fail((await supabase.from("budget_recurring").update(input).eq("id", id)).error); }
  catch (error) {
    if (!missingReminderColumn(error) || input.email_reminder_enabled) throw error;
    const legacyInput = { ...input };
    Reflect.deleteProperty(legacyInput, "email_reminder_enabled");
    fail((await supabase.from("budget_recurring").update(legacyInput).eq("id", id)).error);
  }
}
export async function deleteRecurring(id: string) {
  fail((await client().from("budget_recurring").delete().eq("id", id)).error);
}
export async function markRecurringPaid(id: string) {
  const { error } = await client().rpc("budget_mark_recurring_paid", { p_id: id });
  fail(error);
}
