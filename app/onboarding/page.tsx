"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Onboarding: collects agency name + GHL location_id, creates the agency row,
 * and links the signed-in user as owner. Stripe checkout is initiated from here
 * via the /api/billing/checkout route (sub-required to activate campaigns).
 */
export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agency/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, location_id: locationId, timezone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "create_failed");

      const co = await fetch("/api/billing/checkout", { method: "POST" });
      const coJson = await co.json();
      if (co.ok && coJson.url) {
        window.location.href = coJson.url;
        return;
      }
      window.location.href = "/campaigns";
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">Set up your agency</h1>
      <p className="mt-2 text-neutral-600">A few details and you&apos;ll be live in under a minute.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Agency name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">GoHighLevel location ID</span>
          <input
            required
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            placeholder="e.g. abc123xyz"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-neutral-500">
            Find this in GHL Settings → Company → Location ID.
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Default timezone</span>
          <input
            required
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand px-4 py-2 text-brand-fg disabled:opacity-50"
        >
          {loading ? "Creating..." : "Continue to billing"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}
