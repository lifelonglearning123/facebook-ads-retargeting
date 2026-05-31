import { sendEmailViaGhl } from "@/lib/ghl/client";
import { APP } from "@/config";

interface SendEmailOpts {
  contactId: string;
  subject: string;
  html: string;
}

/**
 * Send an email via GHL's conversations API. GHL routes through their
 * email provider (Mailgun) and handles bounce + unsubscribe handling
 * automatically.
 */
export async function sendEmail(opts: SendEmailOpts): Promise<{ messageId: string }> {
  return sendEmailViaGhl({
    contactId: opts.contactId,
    subject: opts.subject,
    html: opts.html,
    emailFrom: APP.email.fromAddress || undefined,
  });
}
