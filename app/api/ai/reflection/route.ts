import { NextResponse } from "next/server";
import { z } from "zod";
import { geminiClient } from "@/lib/gemini";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  notes: z.string().trim().min(1).max(5000),
  language: z.enum(["fr", "ar", "en"]),
});

const responseSchema = z.object({ reflection: z.string().trim().min(1).max(5000) });

const systemInstruction = `Rewrite the user's rough notes about today as a natural, personal first-person daily reflection. Use only facts explicitly present in the notes. Preserve events, names, activities, quantities, and any order explicitly stated. If the user gives several different activities, you may add a brief factual summary such as "It was a varied day" or group the activities by topic, but do not imply chronology unless the notes state it. Add simple transitions and natural phrasing; do not add an event, emotion, outcome, reason, place, time, conversation, or reaction. Never infer that the user enjoyed something, felt productive, relaxed, or made progress unless they explicitly said so. Keep the reflection proportional: for several distinct notes, use 2-3 concise sentences; for one or two facts, use one short sentence and do not pad it. Keep named games/projects in their original spelling. Use plain text without headings, bullets, or Markdown. Write only in the requested language and return the requested JSON.`;

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reflection request" }, { status: 400 });
  const gemini = geminiClient();
  if (!gemini) return NextResponse.json({ error: "AI is unavailable" }, { status: 503 });

  try {
    const response = await gemini.interactions.create({
      model: "gemini-3.5-flash-lite",
      system_instruction: `${systemInstruction}\nTarget language: ${parsed.data.language === "ar" ? "Moroccan Darija written in Arabic script" : parsed.data.language === "fr" ? "French" : "English"}.`,
      input: JSON.stringify({ user_notes: parsed.data.notes }),
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: { reflection: { type: "string" } },
          required: ["reflection"],
        },
      },
      generation_config: { max_output_tokens: 700 },
      store: false,
    });
    const raw = response.output_text?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const decoded: unknown = JSON.parse(cleaned);
    const result = responseSchema.safeParse(decoded);
    if (!result.success) {
      console.error("Daily reflection response did not match its schema", { issues: result.error.issues.map(({ path, code }) => ({ path, code })) });
      return NextResponse.json({ error: "Could not prepare the reflection" }, { status: 502 });
    }
    return NextResponse.json({ reflection: result.data.reflection });
  } catch (error) {
    console.error("Daily reflection generation failed", { name: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Could not prepare the reflection" }, { status: 502 });
  }
}