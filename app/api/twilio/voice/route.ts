import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Inbound voice webhook fired by Twilio when a lead calls back the agency's
 * Twilio number. Returns TwiML that redirects the call to Retell's inbound
 * SIP endpoint. Retell takes over and answers using the campaign's agent.
 *
 * The agency configures their Twilio number's "A CALL COMES IN" webhook to
 * point at:  https://<clone>/api/twilio/voice?campaign_id=<id>
 *
 * Retell exposes an inbound SIP endpoint per agent — we look it up via the
 * agency's Retell key and TwiML-Dial into it.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaign_id");
  if (!campaignId) {
    return new Response(twimlReject("missing_campaign"), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // For v1 we route inbound to a Retell-configured SIP URI. The dashboard
  // tells the agency to set Twilio's voice webhook → this route, AND
  // ensure their Retell agent has an inbound phone number registered.
  // Retell will then answer using the same agent that placed outbound calls.

  const sipTarget = `sip:${campaignId}@retell-sip.com`;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Sip>${sipTarget}</Sip>
  </Dial>
</Response>`;
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}

function twimlReject(reason: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Reject reason="${reason}"/>
</Response>`;
}
