import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      const k = l.slice(0, i).trim();
      let v = l.slice(i + 1).trim();
      // Strip optional surrounding quotes, then take only the first token
      // (the .env in this repo appends descriptive labels after the value).
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      } else {
        v = v.split(/\s+/)[0];
      }
      return [k, v];
    })
);
const PIT = env.GHL_PIT;
const LOC = env.GHL_LOCATION_ID;
const BASE = "https://services.leadconnectorhq.com";
const H = {
  Authorization: `Bearer ${PIT}`,
  Version: "2021-07-28",
  "Content-Type": "application/json",
  Accept: "application/json",
};

async function j(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// 1) Search contacts
const search = await j("/contacts/search", {
  method: "POST",
  body: JSON.stringify({ locationId: LOC, pageLimit: 25, query: "Chao" }),
});
const matches = (search.contacts ?? []).map((c) => ({
  id: c.id,
  name: [c.firstName, c.lastName].filter(Boolean).join(" "),
  phone: c.phone,
  tags: c.tags,
}));
console.log("--- contacts matching 'Chao' ---");
for (const m of matches) console.log(m);

if (matches.length === 0) process.exit(0);

// 2) Runtime config (stopStageIds)
const cv = await j(`/locations/${LOC}/customValues`);
const store = (cv.customValues ?? []).find(
  (v) => (v.name ?? "").toLowerCase() === "ai_retargeting_config"
);
const cfg = store ? JSON.parse(store.value) : {};
console.log("\n--- runtime config (relevant slice) ---");
console.log({ stopStageIds: cfg.stopStageIds ?? [] });

// 3) Pipelines (so we can name stages)
const pipes = await j(`/opportunities/pipelines?locationId=${LOC}`);
const stageName = new Map();
const pipeOfStage = new Map();
for (const p of pipes.pipelines ?? []) {
  for (const s of p.stages ?? []) {
    stageName.set(s.id, s.name);
    pipeOfStage.set(s.id, p.name);
  }
}
console.log("\n--- stop list resolved ---");
for (const sid of cfg.stopStageIds ?? []) {
  console.log(`  ${sid}  →  ${pipeOfStage.get(sid) ?? "?"} / ${stageName.get(sid) ?? "?"}`);
}

// 4) For each matched contact, pull opportunities + AI status fields
for (const m of matches) {
  console.log(`\n=== ${m.name} (${m.id}) ===`);
  const full = await j(`/contacts/${m.id}`);
  const cf = full.contact?.customFields ?? [];
  // We have to map field IDs → keys via the location's customFields listing.
  const aiKeys = ["ai_status", "ai_next_attempt_at", "ai_step_index", "ai_last_outcome"];
  const fieldsList = await j(`/locations/${LOC}/customFields`);
  const idToKey = new Map(
    (fieldsList.customFields ?? []).map((f) => [f.id, f.fieldKey ?? f.key ?? ""])
  );
  const aiState = {};
  for (const f of cf) {
    const key = (f.key ?? idToKey.get(f.id) ?? "").replace(/^contact\./, "");
    if (aiKeys.includes(key)) aiState[key] = f.value ?? f.field_value;
  }
  console.log("  AI state:", aiState);
  console.log("  Tags:", m.tags);

  const opps = await j(`/opportunities/search?location_id=${LOC}&contact_id=${m.id}`);
  console.log("  Opportunities:");
  for (const o of opps.opportunities ?? []) {
    const inStop = (cfg.stopStageIds ?? []).includes(o.pipelineStageId);
    console.log(
      `    • ${o.name ?? "(unnamed)"}  status=${o.status}  pipeline=${pipeOfStage.get(o.pipelineStageId) ?? "?"} / stage=${stageName.get(o.pipelineStageId) ?? o.pipelineStageId}  ${inStop ? "🛑 IN STOP LIST" : ""}`
    );
  }
}
