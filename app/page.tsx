export default function HomePage() {
  const name = process.env.NEXT_PUBLIC_BRAND_NAME ?? "AI Retargeting";
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-4xl font-semibold">{name}</h1>
      <p className="mt-4 text-neutral-600">
        AI voice + SMS + email retargeting for Facebook ad leads. Triggered from GoHighLevel.
      </p>
      <div className="mt-10 flex gap-3">
        <a
          href="/login"
          className="rounded-md bg-brand px-4 py-2 text-brand-fg hover:opacity-90"
        >
          Sign in
        </a>
        <a
          href="/onboarding"
          className="rounded-md border border-neutral-300 px-4 py-2 hover:bg-neutral-50"
        >
          Get started
        </a>
      </div>
    </main>
  );
}
