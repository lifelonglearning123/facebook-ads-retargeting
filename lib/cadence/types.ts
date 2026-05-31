import { z } from "zod";

export const ChannelSchema = z.enum(["voice", "sms", "email"]);
export type Channel = z.infer<typeof ChannelSchema>;

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM");
const Delay = z.string().regex(/^\d+(min|h|d)$/i, "Expected e.g. 1min, 2h, 1d");

const WhenDelay = z.object({ delay: Delay });
const WhenAfterAt = z.object({ after: Delay, at: HHMM });
const WhenAfterRandom = z.object({ after: Delay, random_between: z.tuple([HHMM, HHMM]) });
const WhenAfterOneOf = z.object({ after: Delay, at_one_of: z.array(HHMM).min(1) });
const WhenNextBdayAt = z.object({ rule: z.literal("next_business_day"), at: HHMM });
const WhenNextBdayRandom = z.object({ rule: z.literal("next_business_day"), random_between: z.tuple([HHMM, HHMM]) });
const WhenNextBdayOneOf = z.object({ rule: z.literal("next_business_day"), at_one_of: z.array(HHMM).min(1) });

export const StepWhenSchema = z.union([
  WhenDelay,
  WhenAfterAt,
  WhenAfterRandom,
  WhenAfterOneOf,
  WhenNextBdayAt,
  WhenNextBdayRandom,
  WhenNextBdayOneOf,
]);
export type StepWhen = z.infer<typeof StepWhenSchema>;

export const VoiceStepSchema = z.object({ channel: z.literal("voice") }).and(StepWhenSchema);
export const SmsStepSchema = z.object({ channel: z.literal("sms"), template_id: z.string().uuid() }).and(StepWhenSchema);
export const EmailStepSchema = z.object({ channel: z.literal("email"), template_id: z.string().uuid() }).and(StepWhenSchema);

export const CadenceStepSchema = z.union([VoiceStepSchema, SmsStepSchema, EmailStepSchema]);
export type CadenceStep = z.infer<typeof CadenceStepSchema>;

export const CadenceSchema = z.array(CadenceStepSchema);
export type Cadence = z.infer<typeof CadenceSchema>;

export const QuietHoursSchema = z.object({
  start: HHMM,                                  // "09:00"
  end: HHMM,                                    // "20:00"
  days: z.array(z.number().int().min(1).max(7)) // ISO weekday numbers, Mon=1..Sun=7
});
export type QuietHours = z.infer<typeof QuietHoursSchema>;
