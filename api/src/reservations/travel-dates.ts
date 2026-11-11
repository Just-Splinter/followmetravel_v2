// Les départs sont saisis en « JJ/MM » sans année (dates « perpétuelles »,
// cf. src/marketing/dates.js) : une date déjà passée désigne l'occurrence de
// l'année suivante. Le serveur fige l'année au moment de la réservation
// (travelStart / travelEnd, AAAA-MM-JJ) : planning, échéancier, relances et
// places restantes par départ en dépendent.

const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function parseDayMonth(value: unknown): { day: number; month: number; year?: number } | null {
  const s = String(value ?? "").trim();
  let m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(s);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > DAYS[month - 1]) return null;
    return { day, month, year: m[3] ? Number(m[3]) : undefined };
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Prochaine occurrence (≥ jour de référence) d'une date JJ/MM ; année explicite respectée. */
export function nextOccurrence(value: unknown, reference: Date): Date | null {
  const p = parseDayMonth(value);
  if (!p) return null;
  const ref = utcDay(reference);
  if (p.year) return new Date(Date.UTC(p.year, p.month - 1, p.day));
  // 29/02 hors année bissextile → 28/02.
  const build = (y: number) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return new Date(Date.UTC(y, p.month - 1, p.month === 2 && p.day === 29 && !leap ? 28 : p.day));
  };
  const thisYear = build(ref.getUTCFullYear());
  return thisYear >= ref ? thisYear : build(ref.getUTCFullYear() + 1);
}

/** Période réelle d'un voyage : départ figé par rapport à `reference`, retour ≥ départ. */
export function travelPeriod(dateFrom: unknown, dateTo: unknown, reference: Date) {
  const start = nextOccurrence(dateFrom, reference);
  if (!start) return null;
  const end = nextOccurrence(dateTo || dateFrom, start) ?? start;
  return { travelStart: iso(start), travelEnd: iso(end) };
}

export const todayIso = () => iso(new Date());

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}
