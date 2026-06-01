import { APP } from "@/config";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

interface ReqOpts extends RequestInit {
  query?: Record<string, string | number | boolean | undefined>;
}

async function req<T>(path: string, opts: ReqOpts = {}): Promise<T> {
  const { query, ...rest } = opts;
  let url = `${GHL_BASE}${path}`;
  if (query) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined) usp.set(k, String(v));
    url += `?${usp.toString()}`;
  }
  const res = await fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${APP.ghl.pitToken}`,
      Version: GHL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL ${path} -> ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// ─── Contacts ─────────────────────────────────────────────────────────────

export interface GhlContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  tags?: string[];
  customFields?: Array<{ id?: string; key?: string; value?: string | number | boolean }>;
}

export async function getContact(contactId: string): Promise<GhlContact | null> {
  try {
    const data = await req<{ contact: GhlContact }>(`/contacts/${contactId}`);
    return data.contact ?? null;
  } catch {
    return null;
  }
}

export async function updateContactCustomFields(
  contactId: string,
  fields: Record<string, unknown>
): Promise<void> {
  // GHL's PUT /contacts/{id} rejects locationId in the body with 422; the
  // location is implicit from the PIT.
  const customFields = Object.entries(fields).map(([key, value]) => ({ key, field_value: value }));
  await req(`/contacts/${contactId}`, {
    method: "PUT",
    body: JSON.stringify({ customFields }),
  });
}

export async function addTag(contactId: string, tag: string): Promise<void> {
  await req(`/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags: [tag] }),
  });
}

export async function removeTag(contactId: string, tag: string): Promise<void> {
  await req(`/contacts/${contactId}/tags`, {
    method: "DELETE",
    body: JSON.stringify({ tags: [tag] }),
  });
}

export async function addNote(contactId: string, body: string): Promise<void> {
  await req(`/contacts/${contactId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function listNotes(contactId: string, limit = 50): Promise<Array<{ id: string; body: string; createdAt: string }>> {
  const data = await req<{ notes: Array<{ id: string; body: string; createdAt: string }> }>(
    `/contacts/${contactId}/notes`,
    { query: { limit } }
  );
  return data.notes ?? [];
}

// ─── Conversations (SMS / Email) ──────────────────────────────────────────

interface SendSmsViaGhlOpts {
  contactId: string;
  message: string;
}

interface SendEmailViaGhlOpts {
  contactId: string;
  subject: string;
  html: string;
  emailFrom?: string;       // override sender — optional
}

/**
 * Send an SMS through GHL's conversations API. GHL routes via the location's
 * connected SMS provider (Twilio under the hood) and handles compliance
 * (STOP keywords, do-not-disturb) automatically.
 */
export async function sendSmsViaGhl(opts: SendSmsViaGhlOpts): Promise<{ messageId: string }> {
  const data = await req<{ messageId: string; conversationId?: string }>("/conversations/messages", {
    method: "POST",
    body: JSON.stringify({
      type: "SMS",
      contactId: opts.contactId,
      message: opts.message,
    }),
  });
  return { messageId: data.messageId };
}

/**
 * Send an email through GHL's conversations API. GHL handles bounces and
 * unsubscribe links natively.
 */
export async function sendEmailViaGhl(opts: SendEmailViaGhlOpts): Promise<{ messageId: string }> {
  const body: Record<string, unknown> = {
    type: "Email",
    contactId: opts.contactId,
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.emailFrom) body.emailFrom = opts.emailFrom;
  const data = await req<{ messageId: string }>("/conversations/messages", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { messageId: data.messageId };
}

// ─── Custom Values (location-level key/value, used for runtime config) ───

export interface GhlCustomValue {
  id: string;
  name: string;
  value: string;
  key?: string;
  fieldKey?: string;
  locationId?: string;
}

async function listCustomValues(): Promise<GhlCustomValue[]> {
  const data = await req<{ customValues: GhlCustomValue[] }>(
    `/locations/${APP.ghl.locationId}/customValues`
  );
  return data.customValues ?? [];
}

/** Returns the raw `value` for a named custom value, or null if not found. */
export async function getCustomValue(name: string): Promise<string | null> {
  try {
    const all = await listCustomValues();
    const lower = name.toLowerCase();
    const hit = all.find((v) => v.name?.toLowerCase() === lower);
    return hit?.value ?? null;
  } catch {
    return null;
  }
}

/** Upsert a custom value by name. Creates if missing, updates if present. */
export async function upsertCustomValue(name: string, value: string): Promise<void> {
  const all = await listCustomValues().catch(() => [] as GhlCustomValue[]);
  const lower = name.toLowerCase();
  const existing = all.find((v) => v.name?.toLowerCase() === lower);
  if (existing) {
    await req(`/locations/${APP.ghl.locationId}/customValues/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ name, value }),
    });
    return;
  }
  await req(`/locations/${APP.ghl.locationId}/customValues`, {
    method: "POST",
    body: JSON.stringify({ name, value }),
  });
}

// ─── Custom fields + tags (provisioning) ─────────────────────────────────

export interface GhlCustomField {
  id: string;
  name: string;
  fieldKey?: string;       // GHL stores this as "fieldKey" sometimes; sometimes "key"
  dataType: string;
  parentId?: string;
}

export async function listCustomFields(): Promise<GhlCustomField[]> {
  const data = await req<{ customFields: GhlCustomField[] }>(
    `/locations/${APP.ghl.locationId}/customFields`
  );
  return data.customFields ?? [];
}

export async function createCustomField(input: {
  name: string;
  dataType: "TEXT" | "NUMERICAL" | "DATE" | "CHECKBOX";
  fieldKey?: string;
  model?: "contact";
  group?: string;
}): Promise<GhlCustomField> {
  const body: Record<string, unknown> = {
    locationId: APP.ghl.locationId,
    name: input.name,
    dataType: input.dataType,
    model: input.model ?? "contact",
  };
  if (input.fieldKey) body.fieldKey = input.fieldKey;
  if (input.group) body.placeholder = input.group;
  // GHL CHECKBOX is a multi-option type (not a boolean) so it requires an
  // options array. We use a single "Yes" option so a ticked box stores the
  // string "Yes", which the app's toBool() helper recognises.
  if (input.dataType === "CHECKBOX") body.options = ["Yes"];

  const data = await req<{ customField: GhlCustomField }>(
    `/locations/${APP.ghl.locationId}/customFields`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return data.customField;
}

export interface GhlTag {
  id?: string;
  name: string;
}

export async function listTags(): Promise<GhlTag[]> {
  const data = await req<{ tags: GhlTag[] }>(`/locations/${APP.ghl.locationId}/tags`);
  return data.tags ?? [];
}

export async function createTag(name: string): Promise<GhlTag> {
  const data = await req<{ tag: GhlTag }>(`/locations/${APP.ghl.locationId}/tags`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.tag;
}

// ─── Pipelines & opportunities ────────────────────────────────────────────

export interface GhlPipelineStage {
  id: string;
  name: string;
  position?: number;
}

export interface GhlPipeline {
  id: string;
  name: string;
  stages: GhlPipelineStage[];
}

/**
 * Lists all opportunity pipelines (and their stages) for the location.
 * Used by the config UI to populate the "stop calling when stage =" picker.
 */
export async function listPipelines(): Promise<GhlPipeline[]> {
  const data = await req<{ pipelines: GhlPipeline[] }>("/opportunities/pipelines", {
    query: { locationId: APP.ghl.locationId },
  });
  return (data.pipelines ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    stages: (p.stages ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
  }));
}

export interface GhlOpportunity {
  id: string;
  name?: string;
  pipelineId: string;
  pipelineStageId: string;
  status?: string;
}

/**
 * Returns the opportunities attached to a contact. Used by the pre-call guard
 * to check the current pipeline stage before dialling. GHL returns 0..N.
 */
export async function getContactOpportunities(contactId: string): Promise<GhlOpportunity[]> {
  try {
    const data = await req<{ opportunities: GhlOpportunity[] }>("/opportunities/search", {
      query: { location_id: APP.ghl.locationId, contact_id: contactId },
    });
    return data.opportunities ?? [];
  } catch {
    return [];
  }
}

// ─── Contact search by tag ────────────────────────────────────────────────

export interface SearchOpts {
  tag: string;
  pageLimit?: number;
}

/**
 * Returns up to pageLimit contacts that carry the given tag. Used by the
 * /api/tick endpoint to find leads currently in the cadence ("ai-active").
 * At ≤100 leads/day a single page (max 100) is plenty.
 */
export async function searchByTag(opts: SearchOpts): Promise<GhlContact[]> {
  const data = await req<{ contacts: GhlContact[] }>("/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      locationId: APP.ghl.locationId,
      pageLimit: opts.pageLimit ?? 100,
      filters: [
        {
          field: "tags",
          operator: "contains",
          value: opts.tag,
        },
      ],
    }),
  });
  return data.contacts ?? [];
}
