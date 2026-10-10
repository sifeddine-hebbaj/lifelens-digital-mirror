import { NextResponse } from "next/server";
import { z } from "zod";
import { geminiClient } from "@/lib/gemini";
import { searchPublicWeb, webSearchTopicSchema } from "@/lib/web-search";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({ topic: webSearchTopicSchema });

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gemini = geminiClient();
  if (!gemini) return NextResponse.json({ error: "Gemini is not configured" }, { status: 503 });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Unsupported public search topic" }, { status: 400 });
  const result = await searchPublicWeb(gemini, body.data.topic);
  if (!result) return NextResponse.json({ searched: false, error: "No reliable web sources were returned" }, { status: 502 });
  return NextResponse.json({ searched: true, ...result });
}
