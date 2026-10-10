import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const requestSchema = z.object({ targetCurrency: z.enum(["MAD", "USD", "CAD", "EUR", "GBP", "AUD", "JPY"]) });
const ratesSchema = z.object({
  result: z.literal("success"),
  time_last_update_utc: z.string(),
  rates: z.record(z.number()),
});

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) return NextResponse.json({ error: "Invalid currency" }, { status: 400 });

  const { data: preferences, error: preferenceError } = await supabase.from("user_preferences")
    .select("currency").eq("user_id", user.id).maybeSingle();
  if (preferenceError) return NextResponse.json({ error: "Could not read currency preference" }, { status: 500 });
  const from = preferences?.currency ?? "USD";
  const to = parsedRequest.data.targetCurrency;
  if (from === to) return NextResponse.json({ from, to, rate: 1, rateDate: new Date().toISOString() });

  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return NextResponse.json({ error: "Exchange-rate service is unavailable" }, { status: 502 });
    const parsedRates = ratesSchema.safeParse(await response.json());
    const rate = parsedRates.success ? parsedRates.data.rates[to] : undefined;
    const rateDate = parsedRates.success ? new Date(parsedRates.data.time_last_update_utc) : null;
    if (!rate || !Number.isFinite(rate) || !rateDate || !Number.isFinite(rateDate.getTime()))
      return NextResponse.json({ error: "A current exchange rate is unavailable" }, { status: 502 });

    const { error } = await supabase.rpc("budget_convert_currency", {
      p_target_currency: to,
      p_rate: rate,
      p_rate_date: rateDate.toISOString(),
    });
    if (error) return NextResponse.json({ error: "Budget currency conversion failed" }, { status: 500 });
    return NextResponse.json({ from, to, rate, rateDate: rateDate.toISOString() });
  } catch {
    return NextResponse.json({ error: "Exchange-rate service is unavailable" }, { status: 502 });
  }
}