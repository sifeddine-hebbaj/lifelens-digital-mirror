"use client";

import { useMemo, useState, type FormEvent } from "react";
import { LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useBudget } from "@/components/budget/budget-provider";
import { MonthSwitcher } from "@/components/budget/month-switcher";
import { CategorySelect, CategoryTile, Messages } from "@/components/budget/ui";
import { addExpense, addIncome, deleteExpense, deleteIncome, updateExpense } from "@/lib/budget/api";
import { currentMonth, isoDate, monthBounds } from "@/lib/budget/calc";
import { CATEGORIES, categoryMeta } from "@/lib/budget/categories";
import { useMonthData } from "@/lib/budget/use-month-data";
import type { Expense } from "@/lib/budget/types";

const PAGE = 40;
const dateRule = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const expenseSchema = z.object({ name: z.string().trim().max(120), amount: z.number().positive().max(1_000_000_000), category: z.string().min(1).max(60), expense_date: dateRule });
const incomeSchema = z.object({ amount: z.number().positive().max(1_000_000_000), source: z.string().trim().max(120), income_date: dateRule });

export default function BudgetTransactionsPage() {
  const { user } = useAuth();
  const { month, money, monthLabel, locale, tb } = useBudget();
  const data = useMonthData();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Default date for a new entry: today when viewing the current month, otherwise the 1st of the viewed month.
  const defaultDate = month === currentMonth() ? isoDate() : monthBounds(month).start;
  const formDate = date || defaultDate;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.expenses.filter((expense) => (filter === "all" || expense.category === filter) && (!needle || expense.name.toLowerCase().includes(needle)));
  }, [data.expenses, query, filter]);

  function resetForm() { setEditing(null); setName(""); setAmount(""); setDate(""); }
  function startEdit(expense: Expense) {
    setKind("expense"); setEditing(expense); setName(expense.name); setAmount(String(expense.amount)); setCategory(expense.category); setDate(expense.expense_date);
    setError(""); setNotice("");
  }

  async function run(id: string, task: () => Promise<void>, success: string) {
    setError(""); setNotice(""); setBusy(id);
    try { await task(); setNotice(success); data.reload(); }
    catch (reason) { setError(`${tb("saveError")} ${reason instanceof Error ? reason.message : String(reason)}`); }
    finally { setBusy(""); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const value = Number(amount.replace(",", "."));
    if (kind === "expense") {
      const parsed = expenseSchema.safeParse({ name, amount: value, category, expense_date: formDate });
      if (!parsed.success) { setError(tb("invalidForm")); return; }
      const input = parsed.data;
      void run("form", async () => { if (editing) await updateExpense(editing.id, input); else await addExpense(user.id, input); resetForm(); }, editing ? tb("expenseUpdated") : tb("expenseAdded"));
    } else {
      const parsed = incomeSchema.safeParse({ amount: value, source: name, income_date: formDate });
      if (!parsed.success) { setError(tb("invalidForm")); return; }
      void run("form", async () => { await addIncome(user.id, { ...parsed.data, note: "" }); resetForm(); }, tb("incomeAdded"));
    }
  }

  function remove(id: string, label: string, task: () => Promise<void>, success: string) {
    if (!window.confirm(tb("confirmDelete", { name: label }))) return;
    void run(id, task, success);
  }

  const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });

  return <div className="page-enter">
    <header className="page-heading"><div><p className="eyebrow">{monthLabel(month)}</p><h1 className="page-title">{tb("navExpenses")}</h1></div><MonthSwitcher /></header>
    <Messages error={error || (data.error ? `${tb("loadError")} ${data.error}` : "")} notice={notice} />

    <div className="bd-segment bd-segment-wide" role="group">
      <button type="button" aria-pressed={kind === "expense"} onClick={() => { setKind("expense"); resetForm(); }}>{tb("expensesTab")} · {money(data.totalExpenses)}</button>
      <button type="button" aria-pressed={kind === "income"} onClick={() => { setKind("income"); resetForm(); }}>{tb("incomeTab")} · {money(data.totalIncome)}</button>
    </div>

    <div className="bd-grid">
      <section className="surface bd-panel">
        {kind === "expense" ? <>
          <label className="bd-search"><Search size={16} /><input className="field" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE); }} placeholder={tb("searchPlaceholder")} aria-label={tb("searchPlaceholder")} /></label>
          <div className="bd-chips" role="group">
            <button type="button" aria-pressed={filter === "all"} onClick={() => { setFilter("all"); setLimit(PAGE); }}>{tb("allCategories")}</button>
            {CATEGORIES.filter((item) => data.categoryTotals[item.key]).map((item) => <button type="button" key={item.key} aria-pressed={filter === item.key} onClick={() => { setFilter(item.key); setLimit(PAGE); }}>{tb(item.labelKey)}</button>)}
          </div>
          {data.loading ? <div className="chart-loading"><LoaderCircle className="animate-spin" size={20} /></div> : visible.length ? <>
            <ul className="bd-list">{visible.slice(0, limit).map((expense) => <li key={expense.id} className="bd-row">
              <CategoryTile category={expense.category} />
              <div className="bd-row-main"><strong>{expense.name || tb(categoryMeta(expense.category).labelKey)}</strong><small>{shortDate(expense.expense_date)} · {tb(categoryMeta(expense.category).labelKey)}</small></div>
              <b className="bd-amount">{money(expense.amount)}</b>
              <button className="icon-button" type="button" onClick={() => startEdit(expense)} aria-label={`${tb("edit")} ${expense.name}`} title={tb("edit")}><Pencil size={15} /></button>
              <button className="icon-button delete-goal" type="button" disabled={busy === expense.id} onClick={() => remove(expense.id, expense.name || tb(categoryMeta(expense.category).labelKey), () => deleteExpense(expense.id), tb("expenseDeleted"))} aria-label={`${tb("remove")} ${expense.name}`} title={tb("remove")}><Trash2 size={15} /></button>
            </li>)}</ul>
            {visible.length > limit && <Button variant="outline" className="bd-more" onClick={() => setLimit(limit + PAGE)}>{tb("showMore")}</Button>}
          </> : <div className="status-empty">{data.expenses.length ? tb("noResults") : tb("noExpensesMonth")}</div>}
        </> : (
          data.loading ? <div className="chart-loading"><LoaderCircle className="animate-spin" size={20} /></div> : data.income.length ? <ul className="bd-list">{data.income.map((item) => <li key={item.id} className="bd-row">
            <span className="bd-tile" style={{ background: "#e5eee3", color: "#4f7a58" }} aria-hidden="true"><Plus size={18} /></span>
            <div className="bd-row-main"><strong>{item.source || tb("income")}</strong><small>{shortDate(item.income_date)}</small></div>
            <b className="bd-amount bd-positive">+{money(item.amount)}</b>
            <button className="icon-button delete-goal" type="button" disabled={busy === item.id} onClick={() => remove(item.id, item.source || tb("income"), () => deleteIncome(item.id), tb("incomeDeleted"))} aria-label={`${tb("remove")} ${item.source}`} title={tb("remove")}><Trash2 size={15} /></button>
          </li>)}</ul> : <div className="status-empty">{tb("noIncomeMonth")}</div>
        )}
      </section>

      <aside className="surface bd-panel bd-sticky">
        <div className="panel-heading"><h2 className="section-title">{kind === "income" ? tb("addIncome") : editing ? tb("editExpense") : tb("addExpense")}</h2>{editing && <button type="button" className="icon-button" onClick={resetForm} aria-label={tb("cancel")}><X size={16} /></button>}</div>
        {kind === "income" && <p className="muted-copy small-copy">{tb("incomeHint")}</p>}
        <form className="bd-form" onSubmit={submit}>
          <label className="field-label">{kind === "income" ? tb("source") : tb("name")} <span className="optional-label">{tb("optional")}</span><input className="field" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "income" ? tb("sourcePlaceholder") : tb("namePlaceholder")} /></label>
          <label className="field-label">{tb("amount")}<input className="field" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label>
          {kind === "expense" && <label className="field-label">{tb("category")}<CategorySelect value={category} onChange={setCategory} /></label>}
          <label className="field-label">{tb("date")}<input className="field" type="date" required value={formDate} onChange={(event) => setDate(event.target.value)} /></label>
          <Button type="submit" disabled={busy === "form"}>{busy === "form" ? <LoaderCircle className="animate-spin" size={15} /> : <Plus size={15} />}{busy === "form" ? tb("saving") : kind === "income" ? tb("addIncome") : tb("saveExpense")}</Button>
          {editing && <Button type="button" variant="ghost" onClick={resetForm}>{tb("cancel")}</Button>}
        </form>
      </aside>
    </div>
  </div>;
}
