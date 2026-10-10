import type { Expense, Income, MonthSettings, Recurring, ResolvedSettings } from "./types";

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const pad = (n: number) => String(n).padStart(2, "0");
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const sumBy = <T,>(items: T[], pick: (item: T) => number) => round2(items.reduce((total, item) => total + pick(item), 0));

/** Local-time ISO date (YYYY-MM-DD), never shifted by the timezone. */
export function isoDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

export function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}

export function monthBounds(month: string) {
  const [year, m] = month.split("-").map(Number);
  return { start: `${month}-01`, end: `${month}-${pad(daysInMonth(year, m))}` };
}

export function yearBounds(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/** Adds months to an ISO date, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsISO(iso: string, months: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  const newYear = Math.floor(index / 12);
  const newMonth = (index % 12) + 1;
  return `${newYear}-${pad(newMonth)}-${pad(Math.min(day, daysInMonth(newYear, newMonth)))}`;
}

/** Whole days from today to an ISO date (negative when overdue). */
export function daysUntil(iso: string, today = new Date()) {
  const [year, month, day] = iso.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86400000);
}

/**
 * Settings that apply to `month`: its own saved row, otherwise the values of
 * the nearest earlier month, otherwise zeros ("not set yet"). Nothing is
 * written when reading, and editing one month never rewrites another.
 */
export function resolveSettings(rows: MonthSettings[], month: string): ResolvedSettings {
  const own = rows.find((row) => row.month === month);
  if (own) return { ...own, inherited: false, saved: true };
  const earlier = rows.filter((row) => row.month < month).sort((a, b) => (a.month < b.month ? 1 : -1))[0];
  if (earlier) return { month, spend_budget: earlier.spend_budget, annual_budget: earlier.annual_budget, savings_goal: earlier.savings_goal, inherited: true, saved: false };
  return { month, spend_budget: 0, annual_budget: 0, savings_goal: 0, inherited: false, saved: false };
}

/** Annual budget of a year = latest value set within that same year (never leaks from another year). */
export function effectiveAnnualBudget(rows: MonthSettings[], year: number) {
  const inYear = rows.filter((row) => row.month.startsWith(`${year}-`)).sort((a, b) => (a.month < b.month ? 1 : -1));
  return inYear[0]?.annual_budget ?? 0;
}

export function totalsByCategory(expenses: Expense[]) {
  const totals: Record<string, number> = {};
  for (const expense of expenses) totals[expense.category] = round2((totals[expense.category] ?? 0) + expense.amount);
  return totals;
}

export type MonthBucket = { month: string; income: number; expenses: number };

/** Income and expenses per calendar month between two ISO dates (inclusive, empty months included). */
export function bucketsByMonth(expenses: Expense[], income: Income[], startISO: string, endISO: string): MonthBucket[] {
  const first = startISO.slice(0, 7);
  const last = endISO.slice(0, 7);
  const buckets = new Map<string, MonthBucket>();
  for (let month = first; month <= last; month = shiftMonth(month, 1)) buckets.set(month, { month, income: 0, expenses: 0 });
  for (const expense of expenses) { const bucket = buckets.get(expense.expense_date.slice(0, 7)); if (bucket) bucket.expenses = round2(bucket.expenses + expense.amount); }
  for (const item of income) { const bucket = buckets.get(item.income_date.slice(0, 7)); if (bucket) bucket.income = round2(bucket.income + item.amount); }
  return [...buckets.values()];
}

/** Share of a limit already used, as a rounded percentage (not capped). */
export function percentUsed(spent: number, limit: number) {
  return limit > 0 ? Math.round((spent / limit) * 100) : 0;
}

/** Average monthly cost of the active recurring payments (yearly ones divided by twelve). */
export function monthlyEquivalent(payments: Recurring[]) {
  return round2(payments.filter((p) => p.active).reduce((total, p) => total + (p.frequency === "yearly" ? p.amount / 12 : p.amount), 0));
}

export type DueStatus = "overdue" | "today" | "soon" | "later";
export function dueStatus(payment: Recurring, today = new Date()): { status: DueStatus; days: number } {
  const days = daysUntil(payment.due_date, today);
  if (days < 0) return { status: "overdue", days };
  if (days === 0) return { status: "today", days };
  if (days <= payment.reminder_days_before) return { status: "soon", days };
  return { status: "later", days };
}

/** Prevents spreadsheet formula injection when a CSV is opened in Excel/Sheets. */
export function csvCell(value: string | number) {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
