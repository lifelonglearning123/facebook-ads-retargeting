import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Map of country code -> default IANA timezone (rough, "first major city").
 * Acceptable as a last-resort fallback; never overrides a GHL-provided tz.
 */
const COUNTRY_FALLBACK_TZ: Record<string, string> = {
  GB: "Europe/London",
  IE: "Europe/Dublin",
  US: "America/New_York",
  CA: "America/Toronto",
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  ES: "Europe/Madrid",
  IT: "Europe/Rome",
  NL: "Europe/Amsterdam",
  IN: "Asia/Kolkata",
  AE: "Asia/Dubai",
  ZA: "Africa/Johannesburg",
  SG: "Asia/Singapore",
};

const DEFAULT_TZ = "Europe/London";

export function resolveLeadTimezone(opts: {
  ghlTimezone?: string | null;
  phoneE164?: string | null;
  agencyTimezone?: string | null;
}): string {
  if (opts.ghlTimezone && isValidIanaTz(opts.ghlTimezone)) return opts.ghlTimezone;

  if (opts.phoneE164) {
    const parsed = parsePhoneNumberFromString(opts.phoneE164);
    const country = parsed?.country;
    if (country && COUNTRY_FALLBACK_TZ[country]) return COUNTRY_FALLBACK_TZ[country];
  }

  return opts.agencyTimezone ?? DEFAULT_TZ;
}

function isValidIanaTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
