"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { Check, LoaderCircle, Moon, NotebookPen, ScreenShare, Sparkles, Timer, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { dateKey } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";

const schema = z.object({
  mood: z.number().min(1).max(10), energy: z.number().min(1).max(10), sleep_hours: z.number().min(0).max(24),
  work_minutes: z.number().min(0).max(1440), exercise_minutes: z.number().min(0).max(1440),
  screen_minutes: z.number().min(0).max(1440), notes: z.string().max(5000),
});

type Values = z.infer<typeof schema>;
const initial: Values = { mood: 5, energy: 5, sleep_hours: 7, work_minutes: 0, exercise_minutes: 0, screen_minutes: 0, notes: "" };
const sliders = [
  { key: "mood", labelKey: "mood", unitKey: "scoreUnit", min: 1, max: 10, step: 1, icon: Sparkles, helpKey: "moodHelp" },
  { key: "energy", labelKey: "energy", unitKey: "scoreUnit", min: 1, max: 10, step: 1, icon: Zap, helpKey: "energyHelp" },
  { key: "sleep_hours", labelKey: "sleep", unitKey: "hours", min: 0, max: 14, step: 0.5, icon: Moon, helpKey: "sleepHelp" },
  { key: "work_minutes", labelKey: "workStudy", unitKey: "minutes", min: 0, max: 720, step: 15, icon: Timer, helpKey: "workStudyHelp" },
  { key: "exercise_minutes", labelKey: "movement", unitKey: "minutes", min: 0, max: 300, step: 5, icon: Zap, helpKey: "movementHelp" },
  { key: "screen_minutes", labelKey: "screenTime", unitKey: "minutes", min: 0, max: 900, step: 15, icon: ScreenShare, helpKey: "screenTimeHelp" },
] as const;

export default function TodayPage() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const [values, setValues] = useState<Values>(initial);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [reflectionStatus, setReflectionStatus] = useState<"idle" | "done" | "error">("idle");

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    client.from("daily_entries").select("mood,energy,sleep_hours,work_minutes,exercise_minutes,screen_minutes,notes").eq("entry_date", dateKey()).maybeSingle().then(({ data, error: loadError }) => {
      if (loadError) setError(loadError.message);
      if (data) setValues({ ...initial, ...data, mood: data.mood ?? initial.mood, energy: data.energy ?? initial.energy, sleep_hours: Number(data.sleep_hours ?? initial.sleep_hours), notes: data.notes ?? "" });
      setLoading(false);
    });
  }, [user]);

  async function save() {
    const parsed = schema.safeParse(values);
    if (!parsed.success) { setState("error"); setError(t("checkValues")); return; }
    const client = supabaseBrowser();
    if (!client || !user) { setState("error"); setError(t("signInToSave")); return; }
    setState("saving");
    setError("");
    const { error: saveError } = await client.from("daily_entries").upsert(
      { ...parsed.data, user_id: user.id, entry_date: dateKey(), updated_at: new Date().toISOString() },
      { onConflict: "user_id,entry_date" },
    );
    if (saveError) { setState("error"); setError(saveError.message); return; }
    setState("saved");
  }

  async function enhanceReflection() {
    const notes = values.notes.trim();
    if (!notes || enhancing) return;
    setState("idle");
    setEnhancing(true);
    setReflectionStatus("idle");
    try {
      const response = await fetch("/api/ai/reflection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes, language }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.reflection !== "string") throw new Error("Reflection generation failed");
      setValues((current) => ({ ...current, notes: result.reflection }));
      setState("idle");
      setReflectionStatus("done");
    } catch {
      setReflectionStatus("error");
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <div className="page-enter today-page">
      <header className="page-heading"><div><p className="eyebrow">{new Date().toLocaleDateString(language === "ar" ? "ar" : language === "en" ? "en-US" : "fr-FR", { weekday: "long", month: "long", day: "numeric" })}</p><h1 className="page-title">{t("todayTitle")}</h1><p className="page-subtitle">{t("todaySubtitle")}</p></div>{!loading && <span className="tag">{values.notes || values.work_minutes > 0 ? t("inProgress") : t("todayFresh")}</span>}</header>
      {error && state !== "error" && <div className="status-message status-error today-load-error">{t("loadTodayError")} {error}</div>}
      {loading ? <div className="surface today-loading"><LoaderCircle className="animate-spin" size={20} /> {t("loadingToday")}</div> : <>
        <section className="checkin-layout">
          <div className="checkin-fields">
            {sliders.map(({ key, labelKey, unitKey, min, max, step, icon: Icon, helpKey }) => {
              const label = t(labelKey);
              const unit = t(unitKey);
              const value = values[key];
              return <label className="surface checkin-slider" key={key}>
                <span className="checkin-icon"><Icon size={17} /></span>
                <span className="checkin-label"><strong>{label}</strong><small>{t(helpKey)}</small></span>
                <span className="checkin-number">{value}<small>{unit}</small></span>
                <input aria-label={`${label}, ${value} ${unit}`} type="range" min={min} max={max} step={step} value={value} onChange={(event) => { setValues({ ...values, [key]: Number(event.target.value) }); setState("idle"); }} />
                <span className="range-ends"><small>{min}</small><small>{max} {key === "sleep_hours" ? t("hoursShort") : ""}</small></span>
              </label>;
            })}
          </div>
          <aside className="today-aside">
            <section className="surface reflection-panel">
              <label className="reflection-heading" htmlFor="daily-reflection"><NotebookPen size={17} /><strong>{t("smallReflection")}</strong></label>
              <span className="muted-copy reflection-prompt">{t("reflectionPrompt")}</span>
              <textarea id="daily-reflection" className="field reflection-field" rows={7} maxLength={5000} placeholder={t("reflectionPlaceholder")} value={values.notes} onChange={(event) => { setValues({ ...values, notes: event.target.value }); setState("idle"); setReflectionStatus("idle"); }} />
              <div className="reflection-tools">
                <span className="character-count">{values.notes.length} / 5000</span>
                <Button type="button" variant="secondary" size="sm" onClick={() => void enhanceReflection()} disabled={!values.notes.trim() || enhancing} aria-busy={enhancing}>
                  {enhancing ? <LoaderCircle className="animate-spin" size={15} /> : <Sparkles size={15} />}
                  {enhancing ? t("enhancingReflection") : t("enhanceReflection")}
                </Button>
              </div>
              {reflectionStatus === "done" && <p className="reflection-feedback" role="status">{t("reflectionEnhanced")}</p>}
              {reflectionStatus === "error" && <p className="reflection-feedback reflection-feedback-error" role="alert">{t("reflectionEnhanceError")}</p>}
            </section>
            <div className="privacy-callout"><span className="privacy-dot" /><span>{t("privateCheckin")}</span></div>
            <Button className="save-checkin" onClick={() => void save()} disabled={state === "saving" || enhancing}>{state === "saving" ? <LoaderCircle className="animate-spin" size={16} /> : state === "saved" ? <Check size={16} /> : null}{state === "saving" ? t("savingCheckin") : state === "saved" ? t("savedToday") : t("saveToday")}</Button>
            {state === "error" && <div className="status-message status-error" role="alert">{error || t("couldNotSave")}</div>}
            {state === "saved" && <div className="status-message status-info" role="status">{t("savedCanEdit")}</div>}
          </aside>
        </section>
      </>}
    </div>
  );
}
