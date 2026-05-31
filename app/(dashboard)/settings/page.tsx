import { supabaseServer } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";
import BillingButton from "./BillingButton";

export default async function SettingsPage() {
  const sb = await supabaseServer();
  const { data: agency } = await sb
    .from("agencies")
    .select("id, name, location_id, timezone, concurrency_cap, brand_name, brand_logo_url, subscription_status")
    .single();

  if (!agency) {
    return <p>No agency found.</p>;
  }

  // Show which secrets are set without exposing the values
  const { data: secrets } = await sb
    .from("agencies")
    .select("twilio_account_sid_enc, twilio_auth_token_enc, retell_api_key_enc, ghl_pit_enc")
    .eq("id", agency.id)
    .single();

  const status = {
    twilio: !!secrets?.twilio_account_sid_enc && !!secrets?.twilio_auth_token_enc,
    retell: !!secrets?.retell_api_key_enc,
    ghl_pit: !!secrets?.ghl_pit_enc,
  };

  return (
    <div className="max-w-2xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </header>

      <section>
        <h2 className="text-lg font-medium">Agency</h2>
        <SettingsForm agency={agency} status={status} />
      </section>

      <section>
        <h2 className="text-lg font-medium">Billing</h2>
        <p className="mt-1 text-sm text-neutral-600">Subscription status: <b className="capitalize">{agency.subscription_status}</b></p>
        <div className="mt-2">
          <BillingButton />
        </div>
      </section>
    </div>
  );
}
