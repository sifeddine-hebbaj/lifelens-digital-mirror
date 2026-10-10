import { supabaseServer } from "@/lib/supabase/server";
import { isBudgetEmailConfigured, sendBudgetEmail } from "@/lib/budget/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await supabaseServer();
  if (!supabase) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.email) return Response.json({ error: "Your account has no email address" }, { status: 400 });

  if (!isBudgetEmailConfigured()) return Response.json({ error: "Email is not configured" }, { status: 503 });

  const { data: canSend, error: cooldownError } = await supabase.rpc("budget_claim_email_test");
  if (cooldownError) return Response.json({ error: "Apply the Budget email migration before testing" }, { status: 503 });
  if (!canSend) return Response.json({ error: "Wait one minute before sending another test email" }, { status: 429 });

  try {
    await sendBudgetEmail({
      to: user.email,
      subject: "Test de rappel Budget LifeLens",
      text: "Ceci est un e-mail de test des rappels Budget LifeLens. L’envoi vers votre adresse de compte fonctionne.",
      html: "<p>Ceci est un e-mail de test des rappels Budget LifeLens.</p><p>L’envoi vers votre adresse de compte fonctionne.</p>",
      idempotencyKey: `budget-email-test-${user.id}-${Math.floor(Date.now() / 60_000)}`,
    });
    return Response.json({ accepted: true });
  } catch {
    return Response.json({ error: "Could not reach Resend" }, { status: 502 });
  }
}