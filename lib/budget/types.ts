export type Expense = { id: string; name: string; amount: number; category: string; expense_date: string };
export type Income = { id: string; amount: number; source: string; note: string; income_date: string };
export type MonthSettings = { month: string; spend_budget: number; annual_budget: number; savings_goal: number };
export type ResolvedSettings = MonthSettings & { inherited: boolean; saved: boolean };
export type Frequency = "monthly" | "yearly";
export type Recurring = {
  id: string; name: string; amount: number; category: string; frequency: Frequency;
  due_date: string; reminder_days_before: number; email_reminder_enabled: boolean; active: boolean; notes: string;
};
