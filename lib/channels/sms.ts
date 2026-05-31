import { APP } from "@/config";

interface SendSmsOpts {
  toNumber: string;
  body: string;
}

export async function sendSms(opts: SendSmsOpts): Promise<{ sid: string }> {
  const auth = Buffer.from(`${APP.twilio.accountSid}:${APP.twilio.authToken}`).toString("base64");
  const form = new URLSearchParams({
    From: APP.twilio.phoneNumber,
    To: opts.toNumber,
    Body: opts.body,
  });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${APP.twilio.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio SMS send failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { sid: string };
  return { sid: json.sid };
}

export function renderTemplate(body: string, vars: Record<string, string | undefined>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}
