import nodemailer from "nodemailer";

export type BudgetEmail = { to: string; subject: string; text: string; html: string; idempotencyKey?: string };

export function isBudgetEmailConfigured() {
  const smtpReady = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  const resendReady = Boolean(process.env.RESEND_API_KEY && process.env.BUDGET_REMINDER_FROM);
  return smtpReady || resendReady;
}

export async function sendBudgetEmail(email: BudgetEmail) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASS;
  if (smtpUser && smtpPassword) {
    const port = Number(process.env.SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: { user: smtpUser, pass: smtpPassword },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await transporter.sendMail({
      from: process.env.BUDGET_REMINDER_FROM || smtpUser,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      messageId: email.idempotencyKey ? `<${email.idempotencyKey}@lifelens.local>` : undefined,
    });
    await transporter.close();
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BUDGET_REMINDER_FROM;
  if (!apiKey || !from) throw new Error("Budget email provider is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
    },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Email provider rejected the message");
}