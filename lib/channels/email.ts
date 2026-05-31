import { Resend } from "resend";
import { APP } from "@/config";

interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl?: string;
}

export async function sendEmail(opts: SendEmailOpts): Promise<{ id: string }> {
  const resend = new Resend(APP.email.apiKey);
  const headers: Record<string, string> = {};
  if (opts.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${opts.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const from = APP.email.fromName ? `${APP.email.fromName} <${APP.email.fromAddress}>` : APP.email.fromAddress;
  const { data, error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    headers,
  });
  if (error || !data) throw new Error(`Resend send failed: ${error?.message ?? "unknown"}`);
  return { id: data.id };
}
