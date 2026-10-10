"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Lightbulb, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { messages, type TranslationKey } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase/client";

type Insight = { id: string; kind: string; title: string; explanation: string | null; evidence: string | null; confidence: string | null; suggested_action: string | null; created_at: string };
const kindTranslation: Record<string, TranslationKey> = { observed_fact: "observedFact", pattern: "pattern", correlation: "correlation", interpretation: "interpretation", suggestion: "suggestion" };
const confidenceTranslation: Record<string, TranslationKey> = { low: "confidenceLow", medium: "confidenceMedium", high: "confidenceHigh" };

function isInsight(value: unknown): value is Omit<Insight, "id" | "created_at"> {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.kind === "string" && typeof row.title === "string" && typeof row.explanation === "string" &&
    typeof row.evidence === "string" && typeof row.confidence === "string" && typeof row.suggested_action === "string";
}

export default function InsightsPage() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadInsights = useCallback(async () => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    const { data, error: queryError } = await client.from("ai_reports").select("id,content,created_at").eq("period", "90d").order("created_at", { ascending: false }).limit(30);
    if (queryError) setError(messages[language].insightsLoadError);
    else {
      const report = (data ?? []).find((item) => {
        if (!item.content || typeof item.content !== "object") return false;
        const content = item.content as { language?: string; insights?: unknown };
        return content.language === language && Array.isArray(content.insights);
      });
      const content = report?.content as { insights?: unknown[] } | null;
      setInsights((content?.insights ?? []).filter(isInsight).map((insight, index) => ({ ...insight, id: `${report?.id}-${index}`, created_at: report?.created_at ?? "" })));
    }
    setLoading(false);
  }, [language, user]);

  useEffect(() => { void loadInsights(); }, [loadInsights]);

  async function generate() {
    setGenerating(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/insights", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language }) });
      const result = await response.json();
      if (!response.ok) throw new Error(t("insightsGenerateError"));
      if (result.insufficient) setNotice(t("insightsNeedMoreDays").replace("{count}", String(result.remaining_days)));
      else {
        setNotice(result.insights?.length ? t("createdInsights").replace("{count}", String(result.insights.length)) : t("analysisComplete"));
        await loadInsights();
      }
    } catch {
      setError(t("insightsGenerateError"));
    } finally { setGenerating(false); }
  }

  return <div className="page-enter">
    <header className="page-heading"><div><p className="eyebrow">{t("evidenceNote")}</p><h1 className="page-title">{t("insights")}</h1><p className="page-subtitle">{t("insightsSubtitle")}</p></div><Button onClick={() => void generate()} disabled={generating}>{generating ? <LoaderCircle className="animate-spin" size={16} /> : insights.length ? <RefreshCw size={15} /> : <Sparkles size={16} />}{generating ? t("analyzing") : t("generateInsights")}</Button></header>
    {error && <div className="status-message status-error" role="alert">{error}</div>}
    {notice && <div className="status-message status-info insight-notice" role="status">{notice}</div>}
    {loading ? <div className="surface insight-loading"><LoaderCircle className="animate-spin" size={19} /> {t("loadingInsights")}</div> : insights.length ? <section className="insight-list">{insights.map((insight) => <article className="surface insight-card" key={insight.id}>
      <div className="insight-card-top"><span className="insight-type"><Sparkles size={14} />{t(kindTranslation[insight.kind] ?? "insights")}</span><span className="insight-confidence">{insight.confidence ? t(confidenceTranslation[insight.confidence] ?? "confidence") : ""}</span></div>
      <h2>{insight.title}</h2>
      {insight.explanation && <p className="insight-explanation">{insight.explanation}</p>}
      {insight.evidence && <div className="insight-evidence"><span>{t("inYourData")}</span><p>{insight.evidence}</p></div>}
      {insight.suggested_action && <div className="insight-action"><Lightbulb size={15} /><span>{insight.suggested_action}</span></div>}
      <time className="insight-date" dateTime={insight.created_at}>{new Date(insight.created_at).toLocaleDateString(language === "ar" ? "ar" : language === "en" ? "en-US" : "fr-FR", { month: "long", day: "numeric", year: "numeric" })}</time>
    </article>)}</section> : <section className="surface insight-welcome"><span className="insight-welcome-icon"><Sparkles size={20} /></span><h2 className="section-title">{t("longerView")}</h2><p className="muted-copy">{t("insightEmpty")}</p><Button variant="secondary" onClick={() => void generate()} disabled={generating}>{generating ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowRight size={15} />}{t("checkReadiness")}</Button></section>}
  </div>;
}