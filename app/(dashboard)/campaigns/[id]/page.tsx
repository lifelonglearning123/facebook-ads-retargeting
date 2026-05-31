import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import CampaignForm from "./CampaignForm";
import WebhookUrls from "./WebhookUrls";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();

  const { data: campaign } = await sb
    .from("campaigns")
    .select("id, name, enabled, retell_agent_id, retell_phone_number, cadence_json, max_attempts, quiet_hours_json, spread_hours, source_tag, start_token, stop_token")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) notFound();

  const { data: templates } = await sb.from("templates").select("id, name, channel");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const startUrl = `${appUrl}/api/ghl/start/${campaign.start_token}`;
  const stopUrl = `${appUrl}/api/ghl/stop/${campaign.stop_token}`;

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
        <p className="mt-1 text-neutral-600">{campaign.enabled ? "Active" : "Disabled"}</p>
      </header>

      <section>
        <h2 className="text-lg font-medium">GHL webhook URLs</h2>
        <WebhookUrls startUrl={startUrl} stopUrl={stopUrl} sourceTag={campaign.source_tag} />
      </section>

      <section>
        <h2 className="text-lg font-medium">Campaign settings</h2>
        <div className="mt-4">
          <CampaignForm campaign={campaign} templates={templates ?? []} />
        </div>
      </section>
    </div>
  );
}
