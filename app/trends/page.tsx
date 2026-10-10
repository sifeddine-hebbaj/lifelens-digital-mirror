"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, LoaderCircle, Moon, Sparkles, Zap } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { summarize } from "@/lib/analysis";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { DailyEntry } from "@/lib/types";

export default function TrendsPage() {
  const { language, t } = useLanguage();
  const locale = language === "ar" ? "ar" : language === "en" ? "en-US" : "fr-FR";
  const { user } = useAuth();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    client.from("daily_entries").select("*").gte("entry_date", since).order("entry_date").then(({ data, error: queryError }) => {
      if (queryError) setError(queryError.message);
      else setEntries((data ?? []) as DailyEntry[]);
      setLoading(false);
    });
  }, [user]);
  const stats = summarize(entries);
  const data = entries.map((entry) => ({ date: new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric" }), mood: entry.mood, energy: entry.energy, sleep: entry.sleep_hours }));
  const cards = [
    { labelKey: "mood", value: stats.averages.mood, suffix: t("scoreUnit"), icon: Sparkles, color: "coral" },
    { labelKey: "energy", value: stats.averages.energy, suffix: t("scoreUnit"), icon: Zap, color: "green" },
    { labelKey: "sleep", value: stats.averages.sleep_hours, suffix: t("hoursShort"), icon: Moon, color: "blue" },
    { labelKey: "movement", value: stats.averages.exercise_minutes, suffix: t("minutes"), icon: Activity, color: "gold" },
  ] as const;

  return <div className="page-enter">
    <header className="page-heading"><div><p className="eyebrow">{t("last90Days")}</p><h1 className="page-title">{t("trendsTitle")}</h1><p className="page-subtitle">{t("trendsSubtitle")}</p></div><span className="tag">{entries.length} {t("daysLogged")}</span></header>
    {error && <div className="status-message status-error" role="alert">{t("trendsLoadError")} {error}</div>}
    <section className="trend-stat-grid">{cards.map(({ labelKey, value, suffix, icon: Icon, color }) => <article className="surface trend-stat" key={labelKey}><span className={`stat-icon ${color}`}><Icon size={17} /></span><span className="trend-stat-value">{loading ? "—" : value ?? "—"}<small>{value == null || loading ? "" : suffix}</small></span><span className="stat-label">{t("averagePrefix")} {t(labelKey).toLowerCase()}</span></article>)}</section>
    <section className="surface trend-chart-panel"><div><h2 className="section-title">{t("dailyRhythm")}</h2><p className="muted-copy small-copy">{t("recordedOverTime")}</p></div>
      {loading ? <div className="chart-loading"><LoaderCircle className="animate-spin" size={20} /></div> : data.length > 1 ? <div className="trend-chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="trendMood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ca7656" stopOpacity={.19} /><stop offset="100%" stopColor="#ca7656" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#e8ece5" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#849086", fontSize: 10 }} minTickGap={25} /><YAxis yAxisId="feel" domain={[0, 10]} ticks={[0, 5, 10]} tickLine={false} axisLine={false} tick={{ fill: "#849086", fontSize: 10 }} /><YAxis yAxisId="sleep" orientation="right" domain={[0, 14]} hide /><Tooltip contentStyle={{ border: "1px solid #e2e8de", borderRadius: 6, fontSize: 12 }} /><Area yAxisId="feel" type="monotone" dataKey="mood" name={t("mood")} stroke="#ca7656" strokeWidth={2} fill="url(#trendMood)" connectNulls /><Area yAxisId="feel" type="monotone" dataKey="energy" name={t("energy")} stroke="#5b8c65" strokeWidth={2} fill="transparent" connectNulls /><Area yAxisId="sleep" type="monotone" dataKey="sleep" name={`${t("sleep")} (${t("hoursShort")})`} stroke="#648893" strokeWidth={1.8} fill="transparent" connectNulls /></AreaChart></ResponsiveContainer></div> : <div className="status-empty trend-empty"><p>{data.length === 1 ? t("anotherCheckin") : t("startTracking")}</p></div>}
      <div className="chart-legend trend-legend"><span><i className="legend-dot mood-dot" />{t("mood")}</span><span><i className="legend-dot energy-dot" />{t("energy")}</span><span><i className="legend-dot sleep-dot" />{t("sleep")}</span></div>
    </section>
    <section className="trend-note-grid"><article className="surface trend-note-panel"><p className="eyebrow">{t("weekOverWeek")}</p><h2 className="section-title">{t("smallComparison")}</h2><p className="muted-copy trend-note-copy">{t("comparisonDescription")}</p><div className="change-list">{(["mood", "energy", "sleep_hours", "work_minutes"] as const).map((key) => { const value = stats.week_over_week[key]; const label = key === "sleep_hours" ? t("sleep") : key === "work_minutes" ? t("workStudy") : t(key); return <div className="change-row" key={key}><span>{label}</span><b className={value == null ? "change-unknown" : value > 0 ? "change-up" : value < 0 ? "change-down" : "change-flat"}>{loading ? "—" : value == null ? t("notEnoughData") : `${value > 0 ? "+" : ""}${value}`}</b></div>; })}</div></article>
      <article className="insight-note"><span className="insight-note-icon"><Sparkles size={17} /></span><h2>{t("patternsNeedContext")}</h2><p>{t("contextDescription")}</p></article></section>
  </div>;
}