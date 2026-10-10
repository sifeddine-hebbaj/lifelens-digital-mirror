"use client";

import { useEffect, useState } from "react";
import { BookOpenText, LoaderCircle } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { friendlyDate } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { DailyEntry } from "@/lib/types";

export default function TimelinePage() {
  const { language, t } = useLanguage();
  const locale = language === "ar" ? "ar" : language === "en" ? "en-US" : "fr-FR";
  const { user } = useAuth();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    let alive = true;
    client.from("daily_entries").select("*").order("entry_date", { ascending: false }).limit(120).then(({ data, error: queryError }) => {
      if (!alive) return;
      if (queryError) setError(queryError.message);
      else setEntries((data ?? []) as DailyEntry[]);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user]);

  return <div className="page-enter">
    <header className="page-heading"><div><p className="eyebrow">{t("yourRecord")}</p><h1 className="page-title">{t("timeline")}</h1><p className="page-subtitle">{t("timelineSubtitle")}</p></div><span className="tag">{entries.length} {entries.length === 1 ? t("entry") : t("entries")}</span></header>
    {error && <div className="status-message status-error" role="alert">{t("timelineLoadError")} {error}</div>}
    <section className="surface timeline-panel">
      {loading ? <div className="timeline-loading"><LoaderCircle className="animate-spin" size={19} /> {t("loadingEntries")}</div> : entries.length ? <div className="timeline-list">{entries.map((entry) => <article className="timeline-row" key={entry.id}>
        <div className="timeline-date"><span className="timeline-date-dot" /><time dateTime={entry.entry_date}>{friendlyDate(entry.entry_date, locale)}</time></div>
        <div className="timeline-content"><div className="timeline-metrics">{entry.mood != null && <span className="metric-chip mood-chip">{t("mood")} <b>{entry.mood}{t("scoreUnit")}</b></span>}{entry.energy != null && <span className="metric-chip energy-chip">{t("energy")} <b>{entry.energy}{t("scoreUnit")}</b></span>}{entry.sleep_hours != null && <span className="metric-chip">{t("sleep")} <b>{entry.sleep_hours}{t("hoursShort")}</b></span>}</div>{entry.notes ? <p className="timeline-note">{entry.notes}</p> : <p className="timeline-note timeline-note-empty">{t("noWrittenReflection")}</p>}</div>
      </article>)}</div> : <div className="status-empty timeline-empty"><BookOpenText size={22} /><h2 className="section-title">{t("storyStartsHere")}</h2><p className="muted-copy">{t("timelineEmpty")}</p></div>}
    </section>
  </div>;
}