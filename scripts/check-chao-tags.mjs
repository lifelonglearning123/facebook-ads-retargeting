import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      const k = l.slice(0, i).trim();
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      else v = v.split(/\s+/)[0];
      return [k, v];
    })
);
const PIT = env.GHL_PIT;
const ID = "x1oTH1YrFUKeUk3qimuW";
const res = await fetch(`https://services.leadconnectorhq.com/contacts/${ID}`, {
  headers: { Authorization: `Bearer ${PIT}`, Version: "2021-07-28", Accept: "application/json" },
});
const d = await res.json();
console.log("tags:", d.contact?.tags);
