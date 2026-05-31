"use client";
import { useState } from "react";

export default function BillingButton() {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const json = await res.json();
    setLoading(false);
    if (json.url) window.location.href = json.url;
  }

  return (
    <button onClick={openPortal} disabled={loading} className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50">
      {loading ? "Opening..." : "Manage subscription"}
    </button>
  );
}
