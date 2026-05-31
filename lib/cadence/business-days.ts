import { DateTime } from "luxon";

export function isBusinessDay(d: DateTime, weekdays: number[] = [1, 2, 3, 4, 5]): boolean {
  return weekdays.includes(d.weekday);
}

export function nextBusinessDay(from: DateTime, weekdays: number[] = [1, 2, 3, 4, 5]): DateTime {
  let cursor = from.plus({ days: 1 }).startOf("day");
  for (let i = 0; i < 14; i++) {
    if (isBusinessDay(cursor, weekdays)) return cursor;
    cursor = cursor.plus({ days: 1 });
  }
  return cursor;
}

export function parseDelay(str: string): { value: number; unit: "minutes" | "hours" | "days" } {
  const m = str.match(/^(\d+)(min|h|d)$/i);
  if (!m) throw new Error(`Invalid delay: ${str}`);
  const value = Number(m[1]);
  const unit = m[2].toLowerCase() === "min" ? "minutes" : m[2].toLowerCase() === "h" ? "hours" : "days";
  return { value, unit };
}
