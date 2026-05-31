import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Geist, JetBrains_Mono } from "next/font/google";
import { APP } from "@/config";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: APP.branding.name,
  description: `${APP.branding.name} — voice retargeting for Facebook leads`,
};

const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Queue" },
  { href: "/config", label: "Settings" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeStyle = {
    ["--brand-rgb" as string]: APP.branding.primaryRgb,
    ["--brand-fg-rgb" as string]: APP.branding.primaryFgRgb,
  } as React.CSSProperties;

  return (
    <html lang="en" className={`${geist.variable} ${fraunces.variable} ${mono.variable}`} style={themeStyle}>
      <body style={{ fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
        <div className="min-h-screen flex flex-col">
          <SiteHeader />
          <main className="flex-1 px-6 md:px-12 lg:px-16 py-10 md:py-14">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-[rgb(var(--line))] bg-[rgb(var(--paper))]">
      <div className="mx-auto max-w-6xl px-6 md:px-12 lg:px-16">
        <div className="flex items-center justify-between py-5">
          <Link href="/" className="flex items-center gap-3 group">
            {APP.branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={APP.branding.logoUrl} alt={APP.branding.name} className="h-7" />
            ) : (
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: "rgb(var(--brand-rgb))" }}
                aria-hidden
              />
            )}
            <span
              className="text-[1.05rem] tracking-tight"
              style={{ fontFamily: "var(--font-fraunces)", fontWeight: 500 }}
            >
              {APP.branding.name}
            </span>
            <span className="hidden md:inline text-[rgb(var(--ink-3))] text-sm">
              · voice retargeting
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-4 py-2 text-sm rounded-full hover:bg-[rgb(var(--paper-deep))] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[rgb(var(--line))] py-8 bg-[rgb(var(--paper))]">
      <div className="mx-auto max-w-6xl px-6 md:px-12 lg:px-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <span className="eyebrow">{APP.branding.name} · operations console</span>
        <span className="text-xs text-[rgb(var(--ink-3))]">
          Powered by GoHighLevel · Retell AI · Twilio
        </span>
      </div>
    </footer>
  );
}
