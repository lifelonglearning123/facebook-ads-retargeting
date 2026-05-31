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
  const customFields = Object.entries(fields).map(([key, value]) => ({ key, field_value: value }));
  await req(`/contacts/${contactId}`, {
    method: "PUT",
    body: JSON.stringify({ customFields, locationId: APP.ghl.locationId }),
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
