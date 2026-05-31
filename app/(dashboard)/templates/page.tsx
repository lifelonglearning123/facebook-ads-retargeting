import { supabaseServer } from "@/lib/supabase/server";
import TemplateForm from "./TemplateForm";

export default async function TemplatesPage() {
  const sb = await supabaseServer();
  const { data: templates } = await sb
    .from("templates")
    .select("id, name, channel, subject, body, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="mt-1 text-neutral-600">SMS and email content reused across campaigns. Variables: <code>{"{{first_name}}"}</code>, <code>{"{{last_name}}"}</code>, <code>{"{{full_name}}"}</code>.</p>
      </header>

      <section>
        <h2 className="text-lg font-medium">Create new</h2>
        <TemplateForm />
      </section>

      <section>
        <h2 className="text-lg font-medium">Library</h2>
        <ul className="mt-2 space-y-2">
          {(templates ?? []).map((t) => (
            <li key={t.id} className="rounded-md border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.name}</div>
                <span className="text-xs uppercase tracking-wide text-neutral-500">{t.channel}</span>
              </div>
              {t.subject && <div className="mt-1 text-sm text-neutral-600">Subject: {t.subject}</div>}
              <div className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{t.body}</div>
            </li>
          ))}
          {(!templates || templates.length === 0) && <li className="text-neutral-500">No templates yet.</li>}
        </ul>
      </section>
    </div>
  );
}
