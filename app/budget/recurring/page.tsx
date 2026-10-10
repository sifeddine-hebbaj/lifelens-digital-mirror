"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, LoaderCircle, MailCheck, Pause, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useBudget } from "@/components/budget/budget-provider";
import { CategorySelect, CategoryTile, Messages } from "@/components/budget/ui";
import { addRecurring, deleteRecurring, listRecurring, markRecurringPaid, updateRecurring } from "@/lib/budget/api";
import { dueStatus, isoDate, monthlyEquivalent } from "@/lib/budget/calc";
import type { Frequency, Recurring } from "@/lib/budget/types";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(1_000_000_000),
  category: z.string().min(1).max(60),
  frequency: z.enum(["monthly", "yearly"]),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reminder_days_before: z.number().int().min(0).max(60),
  email_reminder_enabled: z.boolean(),
  notes: z.string().trim().max(255),
});

export default function BudgetRecurringPage() {
  const { user } = useAuth();
  const { money, locale, tb } = useBudget();
  const [items, setItems] = useState<Recurring[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("subscriptions");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [dueDate, setDueDate] = useState("");
  const [remind, setRemind] = useState("3");
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try { setItems(await listRecurring()); setError(""); }
    catch (reason) { setError(`${tb("loadError")} ${reason instanceof Error ? reason.message : String(reason)}`); }
    finally { setLoading(false); }
  }, [tb]);

  useEffect(() => { if (user) void load(); }, [user, load]);

  const active = useMemo(() => items.filter((item) => item.active), [items]);
  const formDue = dueDate || isoDate();

  function resetForm() { setEditing(null); setName(""); setAmount(""); setCategory("subscriptions"); setFrequency("monthly"); setDueDate(""); setRemind("3"); setEmailReminderEnabled(false); setNotes(""); }
  function startEdit(item: Recurring) {
    setEditing(item); setName(item.name); setAmount(String(item.amount)); setCategory(item.category); setFrequency(item.frequency);
    setDueDate(item.due_date); setRemind(String(item.reminder_days_before)); setEmailReminderEnabled(item.email_reminder_enabled); setNotes(item.notes); setError(""); setNotice("");
  }

  async function run(id: string, task: () => Promise<void>, success: string) {
    setError(""); setNotice(""); setBusy(id);
    try { await task(); setNotice(success); await load(); }
    catch (reason) { setError(`${tb("saveError")} ${reason instanceof Error ? reason.message : String(reason)}`); }
    finally { setBusy(""); }
  }

  async function sendTestEmail() {
    setError(""); setNotice(""); setBusy("test-email");
    try {
      const response = await fetch("/api/budget/email-test", { method: "POST" });
      const result = await response.json() as { error?: string; accepted?: boolean };
      if (!response.ok) {
        const message = result.error?.includes("Budget email migration") ? tb("emailTestMigrationMissing")
          : result.error === "Email is not configured" ? tb("emailTestEmailNotConfigured")
            : response.status === 503 ? tb("emailTestUnavailable")
          : response.status === 429 ? tb("emailTestCooldown")
            : result.error ?? tb("emailTestFailed");
        throw new Error(message);
      }
      setNotice(tb("emailTestSent"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tb("emailTestFailed"));
    } finally {
      setBusy("");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ name, amount: Number(amount.replace(",", ".")), category, frequency, due_date: formDue, reminder_days_before: Number(remind), email_reminder_enabled: emailReminderEnabled, notes });
    if (!parsed.success) { setError(tb("invalidForm")); return; }
    const input = parsed.data;
    void run("form", async () => { if (editing) await updateRecurring(editing.id, input); else await addRecurring(user.id, input); resetForm(); }, editing ? tb("recurringUpdated") : tb("recurringAdded"));
  }

  function remove(item: Recurring) {
    if (!window.confirm(tb("confirmDelete", { name: item.name }))) return;
    void run(item.id, () => deleteRecurring(item.id), tb("recurringDeleted"));
  }

  const dueText = (item: Recurring) => {
    const { status, days } = dueStatus(item);
    if (status === "overdue") return tb("overdue", { days: -days });
    if (status === "today") return tb("dueToday");
    return tb("dueIn", { days });
  };

  return <div className="page-enter">
    <header className="page-heading"><div><p className="eyebrow">{tb("title")}</p><h1 className="page-title">{tb("recurringTitle")}</h1><p className="page-subtitle">{tb("recurringSubtitle")}</p></div>
      <div className="bd-heading-stats"><span className="tag">{tb("activeCount", { count: active.length })}</span><span className="tag">{tb("monthlyCost")} · {money(monthlyEquivalent(items))}</span><Button variant="outline" disabled={busy === "test-email"} onClick={() => void sendTestEmail()}>{busy === "test-email" ? <LoaderCircle className="animate-spin" size={15} /> : <MailCheck size={15} />}{busy === "test-email" ? tb("sendingTestEmail") : tb("sendTestEmail")}</Button></div></header>
    <Messages error={error} notice={notice} />

    <div className="bd-grid">
      <section className="surface bd-panel">
        {loading ? <div className="chart-loading"><LoaderCircle className="animate-spin" size={20} /></div> : items.length ? <ul className="bd-list">{items.map((item) => {
          const { status } = dueStatus(item);
          const highlighted = item.active && status !== "later";
          return <li key={item.id} className={`bd-row bd-row-wrap${item.active ? "" : " bd-row-paused"}`}>
            <CategoryTile category={item.category} />
            <div className="bd-row-main">
              <strong>{item.name}{!item.active && <span className="tag bd-inline-tag">{tb("paused")}</span>}</strong>
              <small className={status === "overdue" && item.active ? "bd-over" : highlighted ? "bd-soon" : undefined}>
                {tb("every", { frequency: item.frequency === "yearly" ? tb("yearly") : tb("monthly"), date: new Date(`${item.due_date}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })}{item.active && ` · ${dueText(item)}`}
              </small>
              {item.notes && <small>{item.notes}</small>}
            </div>
            <b className="bd-amount">{money(item.amount)}</b>
            <div className="bd-row-actions">
              {item.active && <Button size="sm" variant="secondary" disabled={busy === item.id} onClick={() => void run(item.id, () => markRecurringPaid(item.id), tb("paidDone"))}>{busy === item.id ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />}{tb("markPaid")}</Button>}
              <button className="icon-button" type="button" disabled={busy === item.id} onClick={() => void run(item.id, () => updateRecurring(item.id, { active: !item.active }), tb("recurringUpdated"))} aria-label={item.active ? tb("pause") : tb("resume")} title={item.active ? tb("pause") : tb("resume")}>{item.active ? <Pause size={15} /> : <Play size={15} />}</button>
              <button className="icon-button" type="button" onClick={() => startEdit(item)} aria-label={`${tb("edit")} ${item.name}`} title={tb("edit")}><Pencil size={15} /></button>
              <button className="icon-button delete-goal" type="button" disabled={busy === item.id} onClick={() => remove(item)} aria-label={`${tb("remove")} ${item.name}`} title={tb("remove")}><Trash2 size={15} /></button>
            </div>
          </li>;
        })}</ul> : <div className="status-empty">{tb("noRecurring")}</div>}
      </section>

      <aside className="surface bd-panel bd-sticky">
        <div className="panel-heading"><h2 className="section-title">{editing ? tb("editRecurring") : tb("addRecurring")}</h2>{editing && <button type="button" className="icon-button" onClick={resetForm} aria-label={tb("cancel")}><X size={16} /></button>}</div>
        <form className="bd-form" onSubmit={submit}>
          <label className="field-label">{tb("name")}<input className="field" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field-label">{tb("amount")}<input className="field" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label>
          <label className="field-label">{tb("category")}<CategorySelect value={category} onChange={setCategory} /></label>
          <label className="field-label">{tb("frequency")}<select className="field" value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}><option value="monthly">{tb("monthly")}</option><option value="yearly">{tb("yearly")}</option></select></label>
          <label className="field-label">{tb("nextDue")}<input className="field" type="date" required value={formDue} onChange={(event) => setDueDate(event.target.value)} /></label>
          <label className="field-label">{tb("remindDays")}<input className="field" type="number" min={0} max={60} value={remind} onChange={(event) => setRemind(event.target.value)} /><small className="field-hint">{tb("remindHint")}</small></label>
          <label className="field-label bd-email-reminder"><span>{tb("emailReminder")}</span><span className="bd-email-reminder-control"><input type="checkbox" checked={emailReminderEnabled} onChange={(event) => setEmailReminderEnabled(event.target.checked)} /><span>{tb("emailReminderHint")}</span></span></label>
          <label className="field-label">{tb("notes")} <span className="optional-label">{tb("optional")}</span><input className="field" maxLength={255} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <Button type="submit" disabled={busy === "form"}>{busy === "form" ? <LoaderCircle className="animate-spin" size={15} /> : <Plus size={15} />}{busy === "form" ? tb("saving") : tb("saveRecurring")}</Button>
          {editing && <Button type="button" variant="ghost" onClick={resetForm}>{tb("cancel")}</Button>}
        </form>
      </aside>
    </div>
  </div>;
}
