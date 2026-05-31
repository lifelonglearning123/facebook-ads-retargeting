import { decrypt } from "@/lib/crypto";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

interface CtorOpts {
  pitEnc: string;          // encrypted Private Integration Token
  locationId: string;
}

/**
 * Thin GHL v2 client. Uses a Private Integration Token (PIT) issued by the
 * agency from within their location. We use it for:
 *   - installing/patching the snapshot (Phase 2 onboarding)
 *   - pushing post-call/SMS/email outcomes to contact custom fields + notes
 *   - reading contact data on demand
 */
export class GhlClient {
  private token: string;
  private locationId: string;

  constructor(opts: CtorOpts) {
    this.token = decrypt(opts.pitEnc);
    this.locationId = opts.locationId;
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${GHL_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Version: GHL_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GHL ${path} -> ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  // ---- contacts ----

  async updateContactCustomFields(contactId: string, fields: Record<string, unknown>) {
    return this.req(`/contacts/${contactId}`, {
      method: "PUT",
      body: JSON.stringify({ customFields: fields, locationId: this.locationId }),
    });
  }

  async addNote(contactId: string, body: string) {
    return this.req(`/contacts/${contactId}/notes`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  async addTag(contactId: string, tag: string) {
    return this.req(`/contacts/${contactId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags: [tag] }),
    });
  }

  // ---- snapshot installer (Phase 2) ----

  /**
   * Installer entrypoint. Creates custom fields + tags, then attempts workflow
   * provisioning. If workflow CREATE / PATCH is not exposed for the agency's
   * plan, the caller falls back to the copy-paste UI.
   */
  async installSnapshot(spec: unknown): Promise<{ fieldsCreated: number; tagsCreated: number; workflowsCreated: number }> {
    // TODO: implement when wiring Phase 2. Stub returns zeros so the dashboard
    // can fall back to manual workflow setup.
    return { fieldsCreated: 0, tagsCreated: 0, workflowsCreated: 0 };
  }
}
