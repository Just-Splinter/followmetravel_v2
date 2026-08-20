/* Year-less "DD/MM" departure dates are evergreen: an entry whose day/month
   has already passed this year refers to next year's occurrence. The legacy
   viewer dropped past entries entirely, leaving packages unbookable for most
   of the year. Labels (and the reservation payload) keep the raw strings. */

export function daysInMonth(month) {
  if (month === 2) return 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

/**
 * Parse a "DD/MM" string, rejecting anything JS's `Date` would otherwise
 * silently overflow-normalize (e.g. "31/02" or "99/13" rolling into some
 * other month/year instead of being treated as invalid).
 */
export function parseDDMM(str) {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(String(str || "").trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(month)) return null;
  return { day, month };
}

export const formatDDMM = (day, month) =>
  `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;

export function upcomingDepartures(dates) {
  const today = new Date();
  const floor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (dates || [])
    .map((d) => {
      const parsed = parseDDMM(d.from);
      if (!parsed) return null;
      let when = new Date(today.getFullYear(), parsed.month - 1, parsed.day);
      if (when < floor) when = new Date(today.getFullYear() + 1, parsed.month - 1, parsed.day);
      return { ...d, when };
    })
    .filter(Boolean)
    .sort((a, b) => a.when - b.when);
}
