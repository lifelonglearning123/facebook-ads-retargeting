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
