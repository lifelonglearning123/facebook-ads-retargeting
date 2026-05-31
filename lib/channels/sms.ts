import { decrypt } from "@/lib/crypto";

interface SendSmsOpts {
  twilioAccountSidEnc: string;
  twilioAuthTokenEnc: string;
  fromNumber: string;
  toNumber: string;
  body: string;
}

/**
 * Send an SMS via the agency's Twilio account.
 */
export async function sendSms(opts: SendSmsOpts): Promise<{ sid: string }> {
  const sid = decrypt(opts.twilioAccountSidEnc);
  const token = decrypt(opts.twilioAuthTokenEnc);
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const form = new URLSearchParams({
    From: opts.fromNumber,
    To: opts.toNumber,
    Body: opts.body,
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio SMS send failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { sid: string };
  return { sid: json.sid };
}

/**
 * Render template body with simple {{var}} substitution.
 */
export function renderTemplate(body: string, vars: Record<string, string | undefined>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}
