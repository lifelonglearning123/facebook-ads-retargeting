import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

const NAV = [
  { href: "/campaigns", label: "Campaigns" },
  { href: "/leads", label: "Leads" },
  { href: "/templates", label: "Templates" },
  { href: "/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb.from("users").select("agency_id, email, role").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/onboarding");

  const { data: agency } = await sb.from("agencies").select("name, brand_logo_url, subscription_status").eq("id", profile.agency_id).maybeSingle();

  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? agency?.name ?? "AI Retargeting";
  const logo = process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? agency?.brand_logo_url ?? null;

  const isBlocked = agency && !["active", "trialing"].includes(agency.subscription_status ?? "");

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r border-neutral-200 bg-neutral-50 p-4">
        <div className="mb-8 flex items-center gap-2">
          {logo ? <img src={logo} alt={brandName} className="h-6" /> : null}
          <span className="font-semibold">{brandName}</span>
        </div>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-8 text-xs text-neutral-500">
          {profile.email} · {profile.role}
        </div>
      </aside>
      <main className="flex-1 p-8">
        {isBlocked ? (
          <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Your subscription is inactive. Please update payment in Settings to resume campaigns.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
