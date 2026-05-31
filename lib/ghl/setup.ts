import spec from "@/snapshot/ghl-snapshot-spec.json";
import { createCustomField, createTag, listCustomFields, listTags } from "./client";

type SpecField = { key: string; name: string; type: "TEXT" | "NUMBER" | "DATE" | "CHECKBOX"; group?: string };
type SpecTag = { name: string };

const TYPE_TO_GHL = {
  TEXT: "TEXT",
  NUMBER: "NUMERICAL",
  DATE: "DATE",
  CHECKBOX: "CHECKBOX",
} as const;

export interface ProvisionResult {
  fields: {
    created: string[];
    existed: string[];
    failed: Array<{ name: string; error: string }>;
  };
  tags: {
    created: string[];
    existed: string[];
    failed: Array<{ name: string; error: string }>;
  };
}

/**
 * Idempotent: lists what's already in the location, creates only what's
 * missing. Safe to run repeatedly.
 */
export async function provisionFromSpec(): Promise<ProvisionResult> {
  const result: ProvisionResult = {
    fields: { created: [], existed: [], failed: [] },
    tags: { created: [], existed: [], failed: [] },
  };

  // ─── Custom fields ──────────────────────────────────────────────────────
  const specFields = (spec.customFields ?? []) as SpecField[];
  const existing = await listCustomFields().catch(() => [] as Awaited<ReturnType<typeof listCustomFields>>);
  const existingKeys = new Set(
    existing.map((f) => normaliseKey(f.fieldKey ?? f.name))
  );

  for (const f of specFields) {
    const wantKey = normaliseKey(f.key);
    if (existingKeys.has(wantKey)) {
      result.fields.existed.push(f.key);
      continue;
    }
    try {
      await createCustomField({
        name: f.name,
        dataType: TYPE_TO_GHL[f.type],
        fieldKey: f.key,
        group: f.group,
      });
      result.fields.created.push(f.key);
    } catch (err) {
      result.fields.failed.push({ name: f.key, error: String(err).slice(0, 300) });
    }
  }

  // ─── Tags ──────────────────────────────────────────────────────────────
  const specTags = (spec.tags ?? []) as SpecTag[];
  const existingTags = await listTags().catch(() => [] as Awaited<ReturnType<typeof listTags>>);
  const existingTagNames = new Set(existingTags.map((t) => t.name.toLowerCase()));

  for (const t of specTags) {
    if (existingTagNames.has(t.name.toLowerCase())) {
      result.tags.existed.push(t.name);
      continue;
    }
    try {
      await createTag(t.name);
      result.tags.created.push(t.name);
    } catch (err) {
      result.tags.failed.push({ name: t.name, error: String(err).slice(0, 300) });
    }
  }

  return result;
}

function normaliseKey(s: string): string {
  // GHL sometimes prefixes fieldKey with "contact." — compare loosely.
  return s.replace(/^contact\./, "").toLowerCase();
}
