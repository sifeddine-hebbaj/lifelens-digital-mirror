import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isBudgetEmailConfigured, sendBudgetEmail } from "@/lib/budget/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClaimedReminder = {
  recurring_id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  due_date: string;
  reminder_days_before: number;
  currency: string;
  days_until_due: number;
};

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

async function releaseClaim(admin: SupabaseClient, reminder: ClaimedReminder) {
  await admin.from("budget_recurring").update({ email_reminder_claimed_for: null, email_reminder_claimed_at: null })
    .eq("id", reminder.recurring_id).eq("email_reminder_claimed_for", reminder.due_date);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey || !isBudgetEmailConfigured())
    return Response.json({ error: "Budget email reminders are not configured" }, { status: 503 });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.rpc("budget_claim_due_email_reminders", { p_limit: 100 });
  if (error) return Response.json({ error: "Could not claim due reminders" }, { status: 500 });

  let sent = 0;
  let failed = 0;
  const reminders = (data ?? []) as ClaimedReminder[];
  for (const reminder of reminders) {
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(reminder.user_id);
    const recipient = userResult.user?.email;
    if (userError || !recipient) {
      await releaseClaim(admin, reminder);
      failed += 1;
      continue;
    }

    const dueDate = new Date(`${reminder.due_date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    const paymentName = reminder.name.replace(/[\r\n]+/g, " ").slice(0, 120);
    const timing = reminder.days_until_due === 0 ? "arrive à échéance aujourd’hui" : `arrive à échéance dans ${reminder.days_until_due} jour${reminder.days_until_due > 1 ? "s" : ""}`;
    const subject = `Rappel Budget : ${paymentName} ${timing}`;
    const text = `Bonjour,\n\nVotre paiement récurrent « ${paymentName} » ${timing} (${dueDate}).\nMontant : ${Number(reminder.amount).toFixed(2)} ${reminder.currency}.\n\nLifeLens`;
    const html = `<p>Bonjour,</p><p>Votre paiement récurrent « <strong>${escapeHtml(paymentName)}</strong> » ${timing} (${escapeHtml(dueDate)}).</p><p>Montant : <strong>${Number(reminder.amount).toFixed(2)} ${escapeHtml(reminder.currency)}</strong></p><p>LifeLens</p>`;

    try {
      await sendBudgetEmail({
        to: recipient,
        subject,
        text,
        html,
        idempotencyKey: `budget-reminder-${reminder.recurring_id}-${reminder.due_date}`,
      });

      const { error: updateError } = await admin.from("budget_recurring").update({
        email_reminder_last_sent_for: reminder.due_date,
        email_reminder_claimed_for: null,
        email_reminder_claimed_at: null,
      }).eq("id", reminder.recurring_id).eq("email_reminder_claimed_for", reminder.due_date);
      if (updateError) throw new Error("Could not record sent reminder");
      sent += 1;
    } catch {
      await releaseClaim(admin, reminder);
      failed += 1;
    }
  }

  return Response.json({ claimed: reminders.length, sent, failed });
}