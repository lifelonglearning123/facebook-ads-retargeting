import { DateTime } from "luxon";
import type { CadenceStep, QuietHours, StepWhen } from "./types";
import { nextBusinessDay, parseDelay } from "./business-days";

interface ComputeOpts {
  /** Last attempt time, or campaign trigger time for step 0 */
  baseline: Date;
  /** Lead's timezone (IANA, e.g. "Europe/London", "America/New_York") */
  leadTz: string;
  /** Quiet hours (campaign-level) interpreted in lead tz */
  quietHours: QuietHours;
  /** Optional list of recent attempt hours (0-23) for "spread" mode */
  recentHours?: number[];
  /** Whether spread mode is enabled on the campaign */
  spread?: boolean;
  /**
   * If true, the computed time is NOT clamped to quiet hours. Used for the
   * very first call to a FB lead: they just clicked, they're clearly awake,
   * so we ring them regardless of the time of day. All subsequent retries
   * leave this false (default) so they respect working hours.
   */
  bypassQuietHours?: boolean;
}

/**
 * Compute the next_attempt_at timestamp for a cadence step.
 *
 * Returns a UTC Date. The caller persists this to scheduled_calls/scheduled_messages.
 * Quiet hours are enforced (unless bypassQuietHours is true): if the computed
 * time falls outside the window, we slide forward to the next valid moment.
 */
export function nextAttemptAt(step: CadenceStep, opts: ComputeOpts): Date {
  const tz = opts.leadTz;
  const base = DateTime.fromJSDate(opts.baseline, { zone: tz });
  const raw = applyWhen(step, base, opts);
  const adjusted = opts.bypassQuietHours ? raw : clampToQuietHours(raw, opts.quietHours);
  return adjusted.toUTC().toJSDate();
}

function applyWhen(when: StepWhen, base: DateTime, opts: ComputeOpts): DateTime {
  // 1) {delay}
  if ("delay" in when && !("at" in when) && !("random_between" in when) && !("at_one_of" in when)) {
    const { value, unit } = parseDelay(when.delay);
    return base.plus({ [unit]: value });
  }

  // 2/3/4) {after, at|random_between|at_one_of}
  if ("after" in when) {
    const { value, unit } = parseDelay(when.after);
    const dayTarget = base.plus({ [unit]: value }).startOf("day");
    return applyTimeWithinDay(dayTarget, when, opts);
  }

  // 5/6/7) {rule: next_business_day, ...}
  if ("rule" in when && when.rule === "next_business_day") {
    const dayTarget = nextBusinessDay(base);
    return applyTimeWithinDay(dayTarget, when, opts);
  }

  throw new Error(`Unrecognised step when: ${JSON.stringify(when)}`);
}

type TimeMod =
  | { at: string }
  | { random_between: [string, string] }
  | { at_one_of: string[] };

function applyTimeWithinDay(day: DateTime, mod: TimeMod | StepWhen, opts: ComputeOpts): DateTime {
  if ("at" in mod && typeof (mod as { at: string }).at === "string") {
    const [h, m] = (mod as { at: string }).at.split(":").map(Number);
    return day.set({ hour: h, minute: m });
  }
  if ("random_between" in mod) {
    const [lo, hi] = (mod as { random_between: [string, string] }).random_between;
    const [lh, lm] = lo.split(":").map(Number);
    const [hh, hm] = hi.split(":").map(Number);
    const loMin = lh * 60 + lm;
    let hiMin = hh * 60 + hm;
    if (hiMin <= loMin) hiMin = loMin + 1;

    // Spread mode: bias toward the least-tried 2-hour band within the window
    let pickedMin: number;
    if (opts.spread && opts.recentHours && opts.recentHours.length > 0) {
      pickedMin = pickLeastTriedMinute(loMin, hiMin, opts.recentHours);
    } else {
      pickedMin = loMin + Math.floor(Math.random() * (hiMin - loMin));
    }
    return day.set({ hour: Math.floor(pickedMin / 60), minute: pickedMin % 60 });
  }
  if ("at_one_of" in mod) {
    const slots = (mod as { at_one_of: string[] }).at_one_of;
    // Pick slot that doesn't collide with recent hours if spread is on; else random.
    let chosen = slots[Math.floor(Math.random() * slots.length)];
    if (opts.spread && opts.recentHours && opts.recentHours.length > 0) {
      const sorted = [...slots].sort((a, b) => {
        const ha = Number(a.split(":")[0]);
        const hb = Number(b.split(":")[0]);
        const ca = opts.recentHours!.filter((h) => h === ha).length;
        const cb = opts.recentHours!.filter((h) => h === hb).length;
        return ca - cb;
      });
      chosen = sorted[0];
    }
    const [h, m] = chosen.split(":").map(Number);
    return day.set({ hour: h, minute: m });
  }
  // No time modifier — leave at start of day
  return day;
}

function pickLeastTriedMinute(loMin: number, hiMin: number, recentHours: number[]): number {
  // Bucket window into 2-hour bands; pick band with fewest recent hits; random minute inside.
  const bands: { start: number; end: number; count: number }[] = [];
  for (let s = loMin; s < hiMin; s += 120) {
    const e = Math.min(s + 120, hiMin);
    const startHour = Math.floor(s / 60);
    const endHour = Math.floor(e / 60);
    const count = recentHours.filter((h) => h >= startHour && h < endHour).length;
    bands.push({ start: s, end: e, count });
  }
  bands.sort((a, b) => a.count - b.count);
  const chosen = bands[0];
  return chosen.start + Math.floor(Math.random() * (chosen.end - chosen.start));
}

function clampToQuietHours(dt: DateTime, qh: QuietHours): DateTime {
  const [sh, sm] = qh.start.split(":").map(Number);
  const [eh, em] = qh.end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  let cursor = dt;
  for (let i = 0; i < 14; i++) {
    if (!qh.days.includes(cursor.weekday)) {
      cursor = cursor.plus({ days: 1 }).startOf("day").set({ hour: sh, minute: sm });
      continue;
    }
    const curMin = cursor.hour * 60 + cursor.minute;
    if (curMin < startMin) {
      cursor = cursor.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
      return cursor;
    }
    if (curMin >= endMin) {
      cursor = cursor.plus({ days: 1 }).startOf("day").set({ hour: sh, minute: sm });
      continue;
    }
    return cursor;
  }
  return cursor;
}
