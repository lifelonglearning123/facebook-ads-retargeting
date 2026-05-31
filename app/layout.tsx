import type { Metadata } from "next";
import "./globals.css";

const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "AI Retargeting";
const brandPrimary = process.env.NEXT_PUBLIC_BRAND_PRIMARY ?? "14 165 233";
const brandPrimaryFg = process.env.NEXT_PUBLIC_BRAND_PRIMARY_FG ?? "255 255 255";
const brandFont = process.env.NEXT_PUBLIC_BRAND_FONT ?? "Inter";

export const metadata: Metadata = {
  title: brandName,
  description: `${brandName} — AI retargeting for Facebook ads`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeStyle = {
    ["--brand-rgb" as string]: brandPrimary,
    ["--brand-fg-rgb" as string]: brandPrimaryFg,
    ["--brand-font" as string]: brandFont,
  } as React.CSSProperties;

  return (
    <html lang="en" style={themeStyle}>
      <body className="min-h-screen bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
