import type { Metadata } from "next";
import Link from "next/link";
import { APP } from "@/config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP.branding.name,
  description: `${APP.branding.name} — AI retargeting for Facebook ad leads`,
};

const NAV = [
  { href: "/", label: "Queue" },
  { href: "/config", label: "Config" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeStyle = {
    ["--brand-rgb" as string]: APP.branding.primaryRgb,
    ["--brand-fg-rgb" as string]: APP.branding.primaryFgRgb,
    ["--brand-font" as string]: APP.branding.font,
  } as React.CSSProperties;

  return (
    <html lang="en" style={themeStyle}>
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <div className="flex min-h-screen">
          <aside className="w-56 border-r border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-6 flex items-center gap-2">
              {APP.branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={APP.branding.logoUrl} alt={APP.branding.name} className="h-6" />
              ) : null}
              <span className="font-semibold">{APP.branding.name}</span>
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
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
