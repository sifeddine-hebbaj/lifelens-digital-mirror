"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CircleHelp, Moon, Sparkles, Target } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { summarize } from "@/lib/analysis";
import { friendlyDate } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { DailyEntry } from "@/lib/types";

type Goal = { id: string; title: string; target: string | null; due_date: string | null };

export default function DashboardPage() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    let alive = true;
    Promise.all([
      client.from("daily_entries").select("*").order("entry_date", { ascending: false }).limit(30),
      client.from("goals").select("id,title,target,due_date").eq("status", "active").order("created_at", { ascending: false }).limit(3),
    ]).then(([entryResult, goalResult]) => {
      if (!alive) return;
      if (entryResult.error) setError(entryResult.error.message);
      else setEntries((entryResult.data ?? []) as DailyEntry[]);
      if (!goalResult.error) setGoals((goalResult.data ?? []) as Goal[]);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user]);

  const stats = summarize([...entries].reverse());
  const locale = language === "ar" ? "ar" : language === "en" ? "en-US" : "fr-FR";
  const chartData = [...entries].reverse().map((entry) => ({ date: new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric" }), mood: entry.mood, energy: entry.energy }));
  const name = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? t("greetingThere");

  return (
    <div className="page-enter">
      <header className="page-heading dashboard-heading"><div><p className="eyebrow">{new Date().toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })}</p><h1 className="page-title">{t("dashboardHello").replace("{name}", name)}</h1><p className="page-subtitle">{t("dashboardSubtitle")}</p></div><Button asChild><Link href="/today">{t("logToday")} <ArrowRight size={16} /></Link></Button></header>
      {error && <div className="status-message status-error" role="alert">{t("recentLoadError")} {error}</div>}
      <section className="stat-grid" aria-label={t("averages")}>
        <article className="surface stat-card"><span className="stat-icon coral"><Sparkles size={17} /></span><span className="stat-value">{loading ? "—" : stats.averages.mood ?? "—"}<small>{t("scoreUnit")}</small></span><span className="stat-label">{t("averageMood")}</span></article>
        <article className="surface stat-card"><span className="stat-icon green"><Moon size={17} /></span><span className="stat-value">{loading ? "—" : stats.averages.sleep_hours ?? "—"}<small>{t("hoursShort")}</small></span><span className="stat-label">{t("averageSleep")}</span></article>
        <article className="surface stat-card"><span className="stat-icon gold"><CalendarDays size={17} /></span><span className="stat-value">{loading ? "—" : entries.length}</span><span className="stat-label">{t("daysRecorded")}</span></article>
        <article className="surface stat-card"><span className="stat-icon blue"><Target size={17} /></span><span className="stat-value">{loading ? "—" : goals.length}</span><span className="stat-label">{t("activeGoals")}</span></article>
      </section>
      <section className="dashboard-grid">
        <article className="surface chart-panel"><div className="panel-heading"><div><h2 className="section-title">{t("moodEnergy")}</h2><p className="muted-copy small-copy">{t("last30")}</p></div><Link className="text-link" href="/trends">{t("seeTrends")} <ArrowRight size={14} /></Link></div>
          {loading ? <div className="chart-loading"><div className="loading-mark" /></div> : chartData.length > 1 ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d17a5c" stopOpacity={.19} /><stop offset="100%" stopColor="#d17a5c" stopOpacity={0} /></linearGradient><linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b8c65" stopOpacity={.16} /><stop offset="100%" stopColor="#5b8c65" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#e8ece5" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#849086", fontSize: 10 }} minTickGap={28} /><YAxis domain={[0, 10]} ticks={[0, 5, 10]} tickLine={false} axisLine={false} tick={{ fill: "#849086", fontSize: 10 }} /><Tooltip contentStyle={{ border: "1px solid #e2e8de", borderRadius: 6, fontSize: 12 }} /><Area type="monotone" dataKey="mood" name={t("mood")} stroke="#c87557" strokeWidth={2} fill="url(#moodFill)" connectNulls /><Area type="monotone" dataKey="energy" name={t("energy")} stroke="#5b8c65" strokeWidth={2} fill="url(#energyFill)" connectNulls /></AreaChart></ResponsiveContainer></div> : <div className="status-empty chart-empty"><CircleHelp size={20} /><p>{chartData.length === 1 ? t("logAnotherDay") : t("firstCheckin")}</p><Button asChild variant="secondary" size="sm"><Link href="/today">{t("addCheckin")}</Link></Button></div>}
          <div className="chart-legend"><span><i className="legend-dot mood-dot" />{t("mood")}</span><span><i className="legend-dot energy-dot" />{t("energy")}</span></div>
        </article>
        <article className="surface goals-panel"><div className="panel-heading"><div><h2 className="section-title">{t("inMotion")}</h2><p className="muted-copy small-copy">{t("workingToward")}</p></div><Link className="icon-link" href="/goals" aria-label={t("manageGoals")}><ArrowRight size={17} /></Link></div>
          {loading ? <div className="loading-line" /> : goals.length ? <div className="goal-preview-list">{goals.map((goal) => <div key={goal.id} className="goal-preview"><span className="goal-check"><Target size={15} /></span><div><strong>{goal.title}</strong><span>{goal.target || (goal.due_date ? t("byDate").replace("{date}", friendlyDate(goal.due_date, locale)) : t("ongoing"))}</span></div></div>)}</div> : <div className="goals-empty"><p className="muted-copy">{t("intentionPrompt")}</p><Button asChild variant="outline" size="sm"><Link href="/goals">{t("setGoal")}</Link></Button></div>}
          <hr className="divider goals-divider" /><Link className="all-goals-link" href="/goals">{t("allGoals")} <ArrowRight size={14} /></Link>
        </article>
      </section>
      <section className="surface recent-panel"><div className="panel-heading"><div><h2 className="section-title">{t("recentlyRecorded")}</h2><p className="muted-copy small-copy">{t("latestDays")}</p></div><Link className="text-link" href="/timeline">{t("fullTimeline")} <ArrowRight size={14} /></Link></div>
        {loading ? <div className="loading-line" /> : entries.length ? <div className="recent-list">{entries.slice(0, 4).map((entry) => <Link key={entry.id} href="/timeline" className="recent-row"><div className="recent-date"><span>{friendlyDate(entry.entry_date, locale)}</span><small>{entry.notes?.trim() ? entry.notes.slice(0, 72) : t("noReflection")}</small></div><div className="recent-metrics"><span><i className="mini-dot mood-dot" />{entry.mood ?? "—"}</span><span><i className="mini-dot energy-dot" />{entry.energy ?? "—"}</span></div></Link>)}</div> : <div className="status-empty recent-empty">{t("nothingYet")}</div>}
      </section>
    </div>
  );
}