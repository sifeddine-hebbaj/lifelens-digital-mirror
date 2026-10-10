import { NextResponse } from "next/server";
import { z } from "zod";
import { geminiClient } from "@/lib/gemini";
import { supabaseServer } from "@/lib/supabase/server";
import { summarize, MIN_DAYS, type Entry } from "@/lib/analysis";

const SYSTEM = `You analyze a person's self-tracking statistics. Use ONLY the provided statistics; quote numbers exactly; never claim causation; never diagnose or use medical/psychological labels; no motivational quotes. All user-facing text MUST be written only in the requested language, including every title, explanation, evidence, suggested_action, and priority. Do not mix languages or include English labels/headings. Use plain text only: no Markdown, code fences, prefixes, or labels such as "IN YOUR DATA". The kind and confidence fields are machine-readable enum values and must use the exact allowed codes. Return ONLY the requested JSON object. Max 6 insights.`;

const metricLabels = {
  ar: { period: "الفترة", start: "البداية", days: "الأيام المسجلة", averages: "المتوسطات", mood: "المزاج", energy: "الطاقة", sleep: "ساعات النوم", work: "دقائق العمل", exercise: "دقائق التمارين", screen: "دقائق استخدام الشاشة", spending: "الإنفاق", sleepEnergy: "مقارنة النوم والطاقة", shortSleepDays: "أيام النوم أقل من 6 ساعات", lowEnergyAfterShortSleep: "أيام النوم القصير والطاقة المنخفضة", otherDays: "الأيام الأخرى", lowEnergyOnOtherDays: "الأيام الأخرى ذات الطاقة المنخفضة", weeklyChange: "التغير مقارنة بالأسبوع السابق" },
  fr: { period: "période", start: "début", days: "jours enregistrés", averages: "moyennes", mood: "humeur", energy: "énergie", sleep: "heures de sommeil", work: "minutes de travail", exercise: "minutes d’exercice", screen: "minutes d’écran", spending: "dépenses", sleepEnergy: "comparaison sommeil-énergie", shortSleepDays: "jours avec moins de 6 heures de sommeil", lowEnergyAfterShortSleep: "jours de sommeil court avec une énergie basse", otherDays: "autres jours", lowEnergyOnOtherDays: "autres jours avec une énergie basse", weeklyChange: "évolution par rapport à la semaine précédente" },
  en: { period: "period", start: "start", days: "days recorded", averages: "averages", mood: "mood", energy: "energy", sleep: "sleep hours", work: "work minutes", exercise: "exercise minutes", screen: "screen minutes", spending: "spending", sleepEnergy: "sleep and energy comparison", shortSleepDays: "days with less than 6 hours of sleep", lowEnergyAfterShortSleep: "short-sleep days with low energy", otherDays: "other days", lowEnergyOnOtherDays: "other days with low energy", weeklyChange: "change compared with the previous week" },
};

const responseSchema = z.object({
  insights: z.array(z.object({
    kind: z.enum(["observed_fact", "pattern", "correlation", "interpretation", "suggestion"]),
    title: z.string().min(1).max(120), explanation: z.string().max(1200), evidence: z.string().max(500),
    confidence: z.enum(["low", "medium", "high"]), suggested_action: z.string().max(500),
  })).max(6),
  priorities: z.array(z.string().max(240)).max(2),
});

const requestSchema = z.object({ language: z.enum(["fr", "ar", "en"]).default("fr") });

export async function POST(request: Request) {
  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gemini = geminiClient();
  if (!gemini) return NextResponse.json({ error: "Gemini is not configured. Add GEMINI_API_KEY to .env.local." }, { status: 503 });
  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedRequest.success) return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const { data, error } = await sb.from("daily_entries").select("entry_date,mood,energy,sleep_hours,work_minutes,exercise_minutes,screen_minutes,money_spent").gte("entry_date", since).order("entry_date");
  if (error) return NextResponse.json({ error: "Could not load entries" }, { status: 500 });
  const entries = (data ?? []) as Entry[];
  if (entries.length < MIN_DAYS)
    return NextResponse.json({ insufficient: true, remaining_days: MIN_DAYS - entries.length });
  const stats = summarize(entries);
  const languageInstruction = parsedRequest.data.language === "ar"
    ? "Language lock: Arabic only. Write every human-readable string in title, explanation, evidence, suggested_action, and priorities in clear Modern Standard Arabic. Translate all labels and wording; do not include English words, headings, or Markdown. Keep only numbers, proper names, and the required machine enum codes unchanged."
    : parsedRequest.data.language === "en"
      ? "Language lock: English only. Write every human-readable string in title, explanation, evidence, suggested_action, and priorities in clear English. Do not include French or Arabic wording or Markdown. Keep only numbers, proper names, and the required machine enum codes unchanged."
      : "Language lock: French only. Write every human-readable string in title, explanation, evidence, suggested_action, and priorities in clear French. Do not include English or Arabic wording or Markdown. Keep only numbers, proper names, and the required machine enum codes unchanged.";
  const labels = metricLabels[parsedRequest.data.language];
  const promptStats = {
    [labels.period]: { [labels.start]: since, [labels.days]: stats.days_logged },
    [labels.averages]: {
      [labels.mood]: stats.averages.mood,
      [labels.energy]: stats.averages.energy,
      [labels.sleep]: stats.averages.sleep_hours,
      [labels.work]: stats.averages.work_minutes,
      [labels.exercise]: stats.averages.exercise_minutes,
      [labels.screen]: stats.averages.screen_minutes,
      [labels.spending]: stats.averages.money_spent,
    },
    [labels.sleepEnergy]: {
      [labels.shortSleepDays]: stats.sleep_energy.short_sleep_days,
      [labels.lowEnergyAfterShortSleep]: stats.sleep_energy.short_sleep_low_energy,
      [labels.otherDays]: stats.sleep_energy.other_days,
      [labels.lowEnergyOnOtherDays]: stats.sleep_energy.other_low_energy,
    },
    [labels.weeklyChange]: {
      [labels.mood]: stats.week_over_week.mood,
      [labels.energy]: stats.week_over_week.energy,
      [labels.sleep]: stats.week_over_week.sleep_hours,
      [labels.work]: stats.week_over_week.work_minutes,
      [labels.screen]: stats.week_over_week.screen_minutes,
    },
  };
  let response;
  try {
    response = await gemini.interactions.create({
      model: "gemini-3.5-flash-lite",
      system_instruction: `${SYSTEM}\n${languageInstruction}`,
      input: JSON.stringify(promptStats),
      response_format: { type: "text", mime_type: "application/json", schema: {
        type: "object",
        properties: {
          insights: { type: "array", items: { type: "object", properties: { kind: { type: "string", enum: ["observed_fact", "pattern", "correlation", "interpretation", "suggestion"] }, title: { type: "string" }, explanation: { type: "string" }, evidence: { type: "string" }, confidence: { type: "string", enum: ["low", "medium", "high"] }, suggested_action: { type: "string" } }, required: ["kind", "title", "explanation", "evidence", "confidence", "suggested_action"] }, maxItems: 6 },
          priorities: { type: "array", items: { type: "string" }, maxItems: 2 },
        },
        required: ["insights", "priorities"],
      } },
      generation_config: { max_output_tokens: 1500 },
      store: false,
    });
  } catch (cause) {
    const error = typeof cause === "object" && cause !== null ? cause as { name?: unknown; status?: unknown; code?: unknown; message?: unknown } : {};
    const apiKey = process.env.GEMINI_API_KEY;
    const message = typeof error.message === "string" ? error.message.slice(0, 800).replace(apiKey || /$^/, "[REDACTED]") : undefined;
    console.error("Insights Gemini request failed", { name: error.name, status: error.status, code: error.code, message });
    return NextResponse.json({ error: "Gemini is temporarily unavailable. Please try again." }, { status: 502 });
  }

  const rawText = response.output_text?.trim() ?? "";
  const text = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    console.error("Insights Gemini response was not valid JSON", { hasOutput: Boolean(rawText) });
    return NextResponse.json({ error: "The AI returned an invalid response. Please try again." }, { status: 502 });
  }

  const parsed = responseSchema.safeParse(decoded);
  if (!parsed.success) {
    console.error("Insights Gemini response did not match the expected schema", { issues: parsed.error.issues.map(({ path, code }) => ({ path, code })) });
    return NextResponse.json({ error: "The AI returned an unexpected response. Please try again." }, { status: 502 });
  }

  const out = parsed.data;
  const periodEnd = entries[entries.length - 1].entry_date;
  const rows = out.insights.map((insight) => ({ ...insight, user_id: user.id, period_start: since, period_end: periodEnd }));
  if (rows.length) {
    const { error: insertError } = await sb.from("insights").insert(rows);
    if (insertError) return NextResponse.json({ error: "Could not save generated insights" }, { status: 500 });
  }
  const { error: patternError } = await sb.from("detected_patterns").upsert({ user_id: user.id, key: "summary_90d", stats, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" });
  if (patternError) return NextResponse.json({ error: "Could not save analysis summary" }, { status: 500 });
  const { error: reportError } = await sb.from("ai_reports").insert({ user_id: user.id, period: "90d", period_start: since, period_end: periodEnd, content: { language: parsedRequest.data.language, insights: out.insights, priorities: out.priorities, stats } });
  if (reportError) return NextResponse.json({ error: "Could not save generated report" }, { status: 500 });
  return NextResponse.json({ insights: rows, priorities: out.priorities, stats });
}
