import { supabaseServer } from "@/lib/supabase/server";
import CampaignForm from "../[id]/CampaignForm";

export default async function NewCampaignPage() {
  const sb = await supabaseServer();
  const { data: templates } = await sb.from("templates").select("id, name, channel");
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">New campaign</h1>
      <p className="mt-2 text-neutral-600">Configure the cadence, agent, and templates. Webhook URLs appear after save.</p>
      <div className="mt-6">
        <CampaignForm templates={templates ?? []} />
      </div>
    </div>
  );
}
