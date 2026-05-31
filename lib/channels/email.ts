import { Resend } from "resend";

interface SendEmailOpts {
  apiKey: string;        // per-agency Resend key (read from env in per-clone deployment)
  from: string;          // "Acme Agency <hello@acme.com>"
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl?: string;
}

/**
 * Send an email via the agency's Resend domain. Adds the List-Unsubscribe
 * header so providers like Gmail surface a native unsubscribe link.
 */
export async function sendEmail(opts: SendEmailOpts): Promise<{ id: string }> {
  const resend = new Resend(opts.apiKey);
  const headers: Record<string, string> = {};
  if (opts.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${opts.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const { data, error } = await resend.emails.send({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    headers,
  });
  if (error || !data) throw new Error(`Resend send failed: ${error?.message ?? "unknown"}`);
  return { id: data.id };
}
