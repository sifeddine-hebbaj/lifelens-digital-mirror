"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, CirclePlus, LoaderCircle, Target, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { dateKey, friendlyDate } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";

type Goal = { id: string; title: string; target: string | null; due_date: string | null; status: string; progress: number | null; progress_note: string | null };
const goalSchema = z.object({ title: z.string().trim().min(2).max(100), target: z.string().trim().max(160), due_date: z.string() });

export default function GoalsPage() {
  const { language, t } = useLanguage();
  const locale = language === "ar" ? "ar" : language === "en" ? "en-US" : "fr-FR";
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadGoals = useCallback(async () => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    const { data, error: queryError } = await client.from("goals").select("id,title,target,due_date,status").order("created_at", { ascending: false });
    if (queryError) { setError(queryError.message); setLoading(false); return; }
    const rows = data ?? [];
    if (!rows.length) { setGoals([]); setLoading(false); return; }
    const { data: progressRows, error: progressError } = await client.from("goal_progress").select("goal_id,progress,note,entry_date").in("goal_id", rows.map((goal) => goal.id)).order("entry_date", { ascending: false });
    if (progressError) setError(progressError.message);
    const latest = new Map<string, { progress: number; note: string | null }>();
    for (const row of progressRows ?? []) if (!latest.has(row.goal_id)) latest.set(row.goal_id, { progress: row.progress ?? 0, note: row.note });
    setGoals(rows.map((goal) => ({ ...goal, progress: latest.get(goal.id)?.progress ?? null, progress_note: latest.get(goal.id)?.note ?? null })) as Goal[]);
    setProgress(Object.fromEntries(rows.map((goal) => [goal.id, latest.get(goal.id)?.progress ?? 0])));
    setLoading(false);
  }, [user]);

  useEffect(() => { void loadGoals(); }, [loadGoals]);

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const parsed = goalSchema.safeParse({ title, target, due_date: dueDate });
    if (!parsed.success || !user) { setError(t("goalNameError")); return; }
    const client = supabaseBrowser();
    if (!client) return;
    setBusy("create");
    const { error: insertError } = await client.from("goals").insert({ user_id: user.id, title: parsed.data.title, target: parsed.data.target || null, due_date: parsed.data.due_date || null, status: "active" });
    setBusy("");
    if (insertError) { setError(insertError.message); return; }
    setTitle(""); setTarget(""); setDueDate(""); setNotice(t("goalAdded"));
    await loadGoals();
  }

  async function saveProgress(goalId: string) {
    const client = supabaseBrowser();
    if (!client || !user) return;
    setError(""); setNotice(""); setBusy(goalId);
    const { error: saveError } = await client.from("goal_progress").upsert({ user_id: user.id, goal_id: goalId, entry_date: dateKey(), progress: progress[goalId] ?? 0 }, { onConflict: "goal_id,entry_date" });
    setBusy("");
    if (saveError) { setError(saveError.message); return; }
    setNotice(t("todaysProgressSaved"));
    await loadGoals();
  }

  async function updateStatus(goalId: string, status: "active" | "completed") {
    const client = supabaseBrowser(); if (!client) return;
    setError(""); setBusy(goalId);
    const { error: updateError } = await client.from("goals").update({ status }).eq("id", goalId);
    setBusy("");
    if (updateError) { setError(updateError.message); return; }
    await loadGoals();
  }

  async function deleteGoal(goalId: string) {
    if (!window.confirm(t("deleteGoalConfirm"))) return;
    const client = supabaseBrowser(); if (!client) return;
    setError(""); setBusy(goalId);
    const { error: deleteError } = await client.from("goals").delete().eq("id", goalId);
    setBusy("");
    if (deleteError) { setError(deleteError.message); return; }
    await loadGoals();
  }

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const completedGoals = goals.filter((goal) => goal.status === "completed");

  return <div className="page-enter">
    <header className="page-heading"><div><p className="eyebrow">{t("directionNotDeadline")}</p><h1 className="page-title">{t("goals")}</h1><p className="page-subtitle">{t("goalsSubtitle")}</p></div><span className="tag">{t("activeCount").replace("{count}", String(activeGoals.length))}</span></header>
    {error && <div className="status-message status-error goal-message" role="alert">{t("goalLoadError")} {error}</div>}{notice && <div className="status-message status-info goal-message" role="status">{notice}</div>}
    <div className="goals-layout">
      <section className="goals-main">
        {loading ? <div className="surface goal-load"><LoaderCircle className="animate-spin" size={19} /> {t("loadGoals")}</div> : activeGoals.length ? <div className="goal-list">{activeGoals.map((goal) => <article className="surface goal-card" key={goal.id}>
          <div className="goal-card-heading"><span className="goal-card-icon"><Target size={18} /></span><div className="goal-card-title"><h2>{goal.title}</h2><p>{goal.target || (goal.due_date ? `${t("targetDate")} · ${friendlyDate(goal.due_date, locale)}` : t("noDeadline"))}</p></div><button className="icon-button delete-goal" title={t("deleteGoal").replace("{title}", goal.title)} aria-label={t("deleteGoal").replace("{title}", goal.title)} onClick={() => void deleteGoal(goal.id)} disabled={busy === goal.id}><Trash2 size={16} /></button></div>
          {goal.due_date && <p className="goal-deadline">{t("targetDate")} · {friendlyDate(goal.due_date, locale)}</p>}
          <div className="goal-progress-head"><span>{t("howClose")}</span><b>{progress[goal.id] ?? 0}%</b></div>
          <input className="goal-range" aria-label={`${goal.title} progress`} type="range" min={0} max={100} step={5} value={progress[goal.id] ?? 0} onChange={(event) => setProgress({ ...progress, [goal.id]: Number(event.target.value) })} />
          <div className="goal-progress-ends"><span>{t("justBeginning")}</span><span>{t("there")}</span></div>
          <div className="goal-card-actions"><Button variant="secondary" size="sm" onClick={() => void saveProgress(goal.id)} disabled={busy === goal.id}>{busy === goal.id ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />}{t("saveGoalProgress")}</Button><Button variant="ghost" size="sm" onClick={() => void updateStatus(goal.id, "completed")} disabled={busy === goal.id}>{t("markComplete")}</Button></div>
        </article>)}</div> : <div className="surface status-empty goal-empty"><Target size={22} /><h2 className="section-title">{t("nothingToChase")}</h2><p>{t("chooseDirection")}</p></div>}
        {completedGoals.length > 0 && <section className="completed-section"><p className="eyebrow">{t("doneInOwnTime")}</p>{completedGoals.map((goal) => <div className="completed-goal" key={goal.id}><span><Check size={15} /></span><div><strong>{goal.title}</strong><small>{goal.target || t("goalCompleted")}</small></div><button className="icon-button" title={t("deleteGoal").replace("{title}", goal.title)} aria-label={t("deleteGoal").replace("{title}", goal.title)} onClick={() => void deleteGoal(goal.id)}><Trash2 size={15} /></button></div>)}</section>}
      </section>
      <aside className="surface goal-create-panel"><div className="goal-form-title"><span className="goal-card-icon"><CirclePlus size={18} /></span><div><h2>{t("addGoal")}</h2><p>{t("keepItYours")}</p></div></div>
        <form className="goal-form" onSubmit={(event) => void createGoal(event)}><label className="field-label">{t("workToward")}<input className="field" required minLength={2} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("goalPlaceholder")} /></label><label className="field-label">{t("moreDetail")} <span className="optional-label">{t("optional")}</span><input className="field" maxLength={160} value={target} onChange={(event) => setTarget(event.target.value)} placeholder={t("detailPlaceholder")} /></label><label className="field-label">{t("targetDate")} <span className="optional-label">{t("optional")}</span><input className="field" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><Button type="submit" disabled={busy === "create"}>{busy === "create" ? <LoaderCircle className="animate-spin" size={15} /> : <CirclePlus size={15} />}{t("addGoal")}</Button></form>
        <p className="goal-form-footnote">{t("goalFootnote")}</p>
      </aside>
    </div>
  </div>;
}