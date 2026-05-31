import { NextResponse } from "next/server";
import { APP } from "@/config";

export const runtime = "nodejs";

/**
 * Inbound voice webhook. When a lead calls back the Twilio number, dial them
 * into the same Retell agent. The agency configures the Twilio number's
 * "A call comes in" webhook to point here.
 *
 * Retell's standard inbound SIP URI is: sip:<agent_id>@retell-sip.com
 */
export async function POST() {
  const sip = `sip:${APP.retell.agentId}@retell-sip.com`;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Sip>${sip}</Sip>
  </Dial>
</Response>`;
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}

export const GET = POST;
