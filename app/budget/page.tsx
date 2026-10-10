"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, LoaderCircle, PiggyBank, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useBudget } from "@/components/budget/budget-provider";
import { CategoryDonut } from "@/components/budget/category-donut";
import { MonthSwitcher } from "@/components/budget/month-switcher";
import { CategoryTile, Messages, ProgressBar } from "@/components/budget/ui";
import { correctSavings, markRecurringPaid, saveMonthSettings } from "@/lib/budget/api";
import { dueStatus, percentUsed } from "@/lib/budget/calc";
import { categoryMeta } from "@/lib/budget/categories";
import { useMonthData } from "@/lib/budget/use-month-data";

const amountSchema = z.number().finite().min(0).max(1_000_000_000);

export default function BudgetOverviewPage() {
  const { user } = useAuth();
  const { month, money, monthLabel, currency, locale, tb } = useBudget();
  const data = useMonthData();
  const { settings } = data;
  const [limit, setLimit] = useState("");
  const [annual, setAnnual] = useState("");
  const [goal, setGoal] = useState("");
  const [savingsMode, setSavingsMode] = useState<"add" | "correct">("add");
  const [savingsValue, setSavingsValue] = useState("");
  const [savingsNote, setSavingsNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Keep the settings form in sync with the month being viewed.
  const [syncedFor, setSyncedFor] = useState("");
  const syncKey = `${month}|${settings.spend_budget}|${settings.annual_budget}|${settings.savings_goal}|${data.loading}`;
  if (!data.loading && syncedFor !== syncKey) {
    setSyncedFor(syncKey);
    setLimit(settings.spend_budget ? String(settings.spend_budget) : "");
    setAnnual(settings.annual_budget ? String(settings.annual_budget) : "");
    setGoal(settings.savings_goal ? String(settings.savings_goal) : "");
  }

  const used = percentUsed(data.totalExpenses, settings.spend_budget);
  const over = settings.spend_budget > 0 && data.remaining < 0;
  const goalPercent = settings.savings_goal > 0 ? percentUsed(data.balance, settings.savings_goal) : 0;
  const upcoming = data.recurring.filter((payment) => payment.active).map((payment) => ({ payment, due: dueStatus(payment) })).filter(({ due }) => due.status !== "later").sort((a, b) => a.due.days - b.due.days).slice(0, 4);

  async function run(name: string, task: () => Promise<void>, success: string) {
    setError(""); setNotice(""); setBusy(name);
    try { await task(); setNotice(success); data.reload(); }
    catch (reason) { setError(`${tb("saveError")} ${reason instanceof Error ? reason.message : String(reason)}`); }
    finally { setBusy(""); }
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = [limit, annual, goal].map((value) => (value.trim() === "" ? 0 : Number(value.replace(",", "."))));
    if (!user || !values.every((value) => amountSchema.safeParse(value).success)) { setError(tb("invalidForm")); return; }
    void run("settings", () => saveMonthSettings(user.id, { month, spend_budget: values[0], annual_budget: values[1], savings_goal: values[2] }), tb("settingsSaved"));
  }

  function saveSavings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(savingsValue.replace(",", "."));
    const valid = savingsMode === "add" ? z.number().finite().positive().safeParse(value).success : z.number().finite().safeParse(value).success;
    if (!savingsValue.trim() || !valid) { setError(tb("invalidForm")); return; }
    const target = savingsMode === "add" ? data.balance + value : value;
    const note = savingsNote.trim() || (savingsMode === "add" ? tb("addToSavings") : tb("correctSavings"));
    void run("savings", async () => { await correctSavings(month, target, note); setSavingsValue(""); setSavingsNote(""); }, tb("savingsUpdated"));
  }

  return <div className="page-enter">
    <header className="page-heading"><div><p className="eyebrow">{monthLabel(month)}</p><h1 className="page-title">{tb("title")}</h1><p className="page-subtitle">{tb("subtitle")}</p></div><MonthSwitcher /></header>
    <Messages error={error || (data.error ? `${tb("loadError")} ${data.error}` : "")} notice={notice} />

    <section className="surface bd-overview-summary" aria-label={tb("title")}>
      <div className="bd-overview-net">
        <span className="bd-summary-label">{tb("net")}</span>
        <strong className={`bd-summary-value${data.net < 0 ? " bd-over" : ""}`}>{data.loading ? "—" : money(data.net)}</strong>
        <div className="bd-overview-flows">
          <div className="bd-overview-flow"><TrendingUp size={16} /><span>{tb("income")}</span><b>{data.loading ? "—" : money(data.totalIncome)}</b></div>
          <div className="bd-overview-flow bd-overview-flow-expense"><TrendingDown size={16} /><span>{tb("expenses")}</span><b>{data.loading ? "—" : money(data.totalExpenses)}</b></div>
        </div>
      </div>
      <div className="bd-overview-budget">
        <div className="bd-overview-budget-main"><span>{tb("remaining")}</span><strong>{data.loading || settings.spend_budget <= 0 ? "—" : money(data.remaining)}</strong></div>
        {settings.spend_budget > 0 ? <>
          <ProgressBar percent={used} tone={over ? "coral" : "green"} />
          <small>{money(data.totalExpenses)} / {money(settings.spend_budget)} · {tb("budgetUsed", { percent: used })}</small>
        </> : <small>{tb("noBudget")}</small>}
      </div>
    </section>

    <section className="bd-grid">
      <article className="surface bd-panel">
        <div className="panel-heading"><div><h2 className="section-title">{tb("byCategory")}</h2><p className="muted-copy small-copy">{monthLabel(month)}</p></div><Button asChild size="sm"><Link href="/budget/expenses"><Plus size={15} />{tb("addExpense")}</Link></Button></div>
        {data.loading ? <div className="chart-loading"><LoaderCircle className="animate-spin" size={20} /></div> : <CategoryDonut totals={data.categoryTotals} />}
      </article>

      <aside className="surface bd-panel bd-overview-controls">
        <section className="bd-overview-control">
          <div className="bd-card-title"><span className="stat-icon green"><PiggyBank size={17} /></span><div><h2 className="section-title">{tb("savings")}</h2><p className="muted-copy small-copy">{tb("savingsHint")}</p></div></div>
          <div className="bd-savings-value">{data.loading ? "—" : money(data.balance)}</div>
          {settings.savings_goal > 0 ? <><ProgressBar percent={goalPercent} /><p className="bd-hint">{tb("goalProgress", { percent: goalPercent })} · {money(settings.savings_goal)}</p></> : <p className="bd-hint">{tb("noGoal")}</p>}
          <div className="bd-segment" role="group"><button type="button" aria-pressed={savingsMode === "add"} onClick={() => setSavingsMode("add")}>{tb("addToSavings")}</button><button type="button" aria-pressed={savingsMode === "correct"} onClick={() => setSavingsMode("correct")}>{tb("correctSavings")}</button></div>
          <form className="bd-form" onSubmit={saveSavings}>
            <label className="field-label">{savingsMode === "add" ? tb("amountToAdd") : tb("targetBalance")}<input className="field" inputMode="decimal" value={savingsValue} onChange={(event) => setSavingsValue(event.target.value)} placeholder="0" required /></label>
            <label className="field-label">{tb("note")} <span className="optional-label">{tb("optional")}</span><input className="field" maxLength={255} value={savingsNote} onChange={(event) => setSavingsNote(event.target.value)} /></label>
            <Button type="submit" variant="secondary" disabled={busy === "savings"}>{busy === "savings" ? <LoaderCircle className="animate-spin" size={15} /> : <Check size={15} />}{tb("save")}</Button>
          </form>
        </section>

        <hr className="bd-overview-divider" />

        <section className="bd-overview-control">
          <h2 className="section-title">{tb("budgetSettings")}</h2>
          <p className="muted-copy small-copy">{settings.inherited ? tb("settingsInherited") : tb("settingsHint")}</p>
          <form className="bd-form" onSubmit={saveSettings}>
            <label className="field-label">{tb("monthlyLimit")}<input className="field" inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="0" /></label>
            <label className="field-label">{tb("annualBudget")}<input className="field" inputMode="decimal" value={annual} onChange={(event) => setAnnual(event.target.value)} placeholder="0" /></label>
            <label className="field-label">{tb("savingsGoal")}<input className="field" inputMode="decimal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="0" /></label>
            <Button type="submit" disabled={busy === "settings"}>{busy === "settings" ? <LoaderCircle className="animate-spin" size={15} /> : <Check size={15} />}{busy === "settings" ? tb("saving") : tb("save")}</Button>
            <p className="bd-hint">{tb("currencyNote", { currency })}</p>
          </form>
        </section>
      </aside>
    </section>

    <section className="bd-grid bd-grid-even">
      <article className="bd-overview-list">
        <div className="panel-heading"><h2 className="section-title">{tb("upcoming")}</h2><Link className="text-link" href="/budget/recurring">{tb("viewAll")} <ArrowRight className="bd-flip" size={14} /></Link></div>
        {upcoming.length ? <ul className="bd-list">{upcoming.map(({ payment, due }) => <li key={payment.id} className="bd-row">
          <CategoryTile category={payment.category} />
          <div className="bd-row-main"><strong>{payment.name}</strong><small className={due.status === "overdue" ? "bd-over" : undefined}>{due.status === "overdue" ? tb("overdue", { days: -due.days }) : due.status === "today" ? tb("dueToday") : tb("dueIn", { days: due.days })} · {new Date(`${payment.due_date}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })}</small></div>
          <b className="bd-amount">{money(payment.amount)}</b>
          <Button size="sm" variant="secondary" disabled={busy === payment.id} onClick={() => void run(payment.id, () => markRecurringPaid(payment.id), tb("paidDone"))}>{busy === payment.id ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />}{tb("markPaid")}</Button>
        </li>)}</ul> : <div className="status-empty">{tb("noUpcoming")}</div>}
      </article>
      <article className="bd-overview-list">
        <div className="panel-heading"><h2 className="section-title">{tb("recentExpenses")}</h2><Link className="text-link" href="/budget/expenses">{tb("viewAll")} <ArrowRight className="bd-flip" size={14} /></Link></div>
        {data.expenses.length ? <ul className="bd-list">{data.expenses.slice(0, 5).map((expense) => <li key={expense.id} className="bd-row">
          <CategoryTile category={expense.category} />
          <div className="bd-row-main"><strong>{expense.name || tb(categoryMeta(expense.category).labelKey)}</strong><small>{new Date(`${expense.expense_date}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })} · {tb(categoryMeta(expense.category).labelKey)}</small></div>
          <b className="bd-amount">{money(expense.amount)}</b>
        </li>)}</ul> : <div className="status-empty">{data.loading ? tb("loading") : tb("noExpensesMonth")}</div>}
      </article>
    </section>
  </div>;
}
