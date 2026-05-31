import { sendSmsViaGhl } from "@/lib/ghl/client";

interface SendSmsOpts {
  contactId: string;
  body: string;
}

/**
 * Send an SMS via GHL's conversations API. GHL routes through the location's
 * connected SMS provider and handles STOP/DND compliance.
 */
export async function sendSms(opts: SendSmsOpts): Promise<{ messageId: string }> {
  return sendSmsViaGhl({ contactId: opts.contactId, message: opts.body });
}

export function renderTemplate(body: string, vars: Record<string, string | undefined>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}
