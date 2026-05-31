import { markStopped, recordAttempt, writeLeadState } from "@/lib/state";
import { APP } from "@/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;

  try {
    await writeLeadState(contactId, { emailConsent: false });
    await recordAttempt(contactId, { channel: "email", outcome: "unsubscribed" });
    await markStopped(contactId, "email_unsubscribed");
  } catch {
    // best-effort — fall through to confirmation regardless
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">You&apos;ve been unsubscribed</h1>
      <p className="mt-3 text-neutral-600">
        We won&apos;t send you any more emails from {APP.branding.name}.
      </p>
    </main>
  );
}
