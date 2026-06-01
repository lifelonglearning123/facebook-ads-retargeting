import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      const k = l.slice(0, i).trim();
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      } else {
        v = v.split(/\s+/)[0];
      }
      return [k, v];
    })
);

const APP_URL = env.NEXT_PUBLIC_APP_URL;
const CONTACT_ID = "x1oTH1YrFUKeUk3qimuW";

const res = await fetch(`${APP_URL}/api/ghl/stop`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contact_id: CONTACT_ID,
    reason: "pipeline:TheAutomate.io → Wrong-Lead (manual force-stop)",
  }),
});
const body = await res.text();
console.log("status:", res.status);
console.log("body:", body);
