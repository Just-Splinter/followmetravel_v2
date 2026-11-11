import { Injectable, Logger } from "@nestjs/common";
import { AgencyService } from "../agency/agency";
import { DocumentsService, Row, toDocument } from "../collections/documents.service";
import { EmailsService } from "../mail/emails.service";
import { PackageData, parseJSON } from "../reservations/pricing";
import { daysBetween, nextOccurrence, todayIso, travelPeriod } from "../reservations/travel-dates";
import { financeOf, reservationTravel } from "./schedule";

/** Statuts qui occupent des places et attendent des paiements. */
export const ACTIVE_STATUSES = ["pending", "confirmed", "paid", "completed"];
const DUE_STATUSES = ["confirmed"];

const SINGLETON_KINDS = ["hero-slide", "omra", "site-contact", "email-settings", "agency"];

function packageBlob(row: Row): PackageData & Record<string, any> {
  return parseJSON<PackageData & Record<string, any>>(row.data.data, {});
}

/** Un « vrai » package (pas un singleton de réglages rangé dans products). */
export function isPackageRow(row: Row) {
  const kind = packageBlob(row).kind;
  return !kind || !SINGLETON_KINDS.includes(String(kind));
}

/**
 * Relance due aujourd'hui pour une échéance, d'après celles déjà envoyées
 * pour elle ; null si rien à envoyer.
 */
export function reminderKind(
  daysToDue: number,
  history: { key: string; at: string }[],
  today: string,
  agency: { reminderDaysBefore: number; overdueReminderEveryDays: number; maxOverdueReminders: number },
): string | null {
  if (daysToDue >= 0) {
    const upcomingSent = history.some((h) => h.key.endsWith(":upcoming"));
    return daysToDue <= agency.reminderDaysBefore && !upcomingSent ? "upcoming" : null;
  }
  const overdue = history.filter((h) => h.key.includes(":overdue-")).sort((a, b) => a.at.localeCompare(b.at));
  if (overdue.length >= agency.maxOverdueReminders) return null;
  const last = overdue[overdue.length - 1];
  if (last && daysBetween(last.at.slice(0, 10), today) < Math.max(1, agency.overdueReminderEveryDays)) return null;
  return `overdue-${overdue.length + 1}`;
}

const costsTotal = (r: Record<string, unknown>) =>
  parseJSON<{ amount?: unknown }[]>(r.costs, []).reduce((s, c) => s + (Number(c.amount) || 0), 0);

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly docs: DocumentsService,
    private readonly agency: AgencyService,
    private readonly emails: EmailsService,
  ) {}

  private async activeReservations(): Promise<Row[]> {
    return this.docs.allRows("reservations", `data->>'status' = ANY($2::text[])`, [ACTIVE_STATUSES]);
  }

  /** Voyageurs déjà vendus par départ (AAAA-MM-JJ) d'un package. */
  async bookedByDeparture(packageId: string): Promise<Map<string, number>> {
    const rows = await this.docs.allRows(
      "reservations",
      `data->>'packageId' = $2 AND data->>'status' = ANY($3::text[])`,
      [packageId, ACTIVE_STATUSES],
    );
    const map = new Map<string, number>();
    for (const row of rows) {
      const start = reservationTravel(row.data, row.created_at)?.travelStart;
      if (start) map.set(start, (map.get(start) ?? 0) + (Number(row.data.totalPax) || 0));
    }
    return map;
  }

  /** Disponibilité publique d'un package : aucune donnée client, seulement des comptes. */
  async availability(packageId: string) {
    const row = await this.docs.findRow("products", packageId);
    const blob = packageBlob(row);
    const booked = await this.bookedByDeparture(packageId);
    const today = new Date();
    return {
      packageId,
      departures: (blob.departureDates || []).map((d) => {
        const period = travelPeriod(d.from, d.to, today);
        const capacity = Number(d.capacity) > 0 ? Number(d.capacity) : null;
        const sold = period ? (booked.get(period.travelStart) ?? 0) : 0;
        return {
          id: d.id ?? null,
          from: d.from,
          to: d.to,
          start: period?.travelStart ?? null,
          end: period?.travelEnd ?? null,
          supplement: Number(d.supplement) || 0,
          capacity,
          booked: sold,
          remaining: capacity === null ? null : Math.max(0, capacity - sold),
          closed: !!d.closed || (capacity !== null && sold >= capacity),
          guaranteed: !!d.guaranteed,
        };
      }),
    };
  }

  /**
   * Prochains départs publics (home du site) : packages visibles (statut
   * publié, fenêtre de publication), occurrences des N prochains jours, prix
   * « dès » supplément compris et places restantes — aucune donnée client.
   */
  async upcomingDepartures(days: number, limit: number) {
    const today = todayIso();
    const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    const products = (await this.docs.allRows("products", `data->>'status' = ANY($2::text[])`, [["active", "published"]]))
      .filter(isPackageRow)
      .filter((p) => (!p.data.publishAt || String(p.data.publishAt).slice(0, 10) <= today) && (!p.data.unpublishAt || String(p.data.unpublishAt).slice(0, 10) > today));
    // Voyageurs vendus par (package, date de départ), en une seule requête.
    const sold = new Map<string, number>();
    for (const row of await this.activeReservations()) {
      const start = reservationTravel(row.data, row.created_at)?.travelStart;
      if (start) sold.set(`${row.data.packageId}|${start}`, (sold.get(`${row.data.packageId}|${start}`) ?? 0) + (Number(row.data.totalPax) || 0));
    }
    const out = [];
    for (const p of products) {
      const blob = packageBlob(p);
      const base = Number(p.data.basePrice) || Number(blob.basePrice) || 0;
      for (const d of blob.departureDates || []) {
        const period = travelPeriod(d.from, d.to, new Date());
        if (!period || period.travelStart > until) continue;
        const capacity = Number(d.capacity) > 0 ? Number(d.capacity) : null;
        const booked = sold.get(`${p.id}|${period.travelStart}`) ?? 0;
        const remaining = capacity === null ? null : Math.max(0, capacity - booked);
        out.push({
          packageId: p.id,
          title: String(p.data.title ?? ""),
          country: String(p.data.country ?? blob.country ?? ""),
          image: String(blob.heroBg ?? ""),
          durationLabel: String(blob.durationLabel ?? ""),
          from: d.from,
          to: d.to,
          start: period.travelStart,
          end: period.travelEnd,
          price: base + (Number(d.supplement) || 0),
          supplement: Number(d.supplement) || 0,
          capacity,
          remaining,
          guaranteed: !!d.guaranteed,
          closed: !!d.closed || remaining === 0,
          featured: !!p.data.featured,
        });
      }
    }
    return out.sort((a, b) => a.start.localeCompare(b.start)).slice(0, limit);
  }

  /** Financement d'un dossier (échéancier + paiements). */
  async reservationFinance(id: string) {
    const row = await this.docs.findRow("reservations", id);
    const agency = await this.agency.get();
    return { reservationId: id, ...financeOf(row.data, row.created_at, agency, todayIso()), costs: costsTotal(row.data) };
  }

  /** Créances : tous les dossiers avec un reste à payer, du plus urgent au moins urgent. */
  async receivables() {
    const agency = await this.agency.get();
    const today = todayIso();
    const rows = await this.docs.allRows("reservations", `data->>'status' = ANY($2::text[])`, [["pending", "confirmed", "paid"]]);
    const items = rows
      .map((row) => {
        const f = financeOf(row.data, row.created_at, agency, today);
        const r = row.data as Record<string, any>;
        return {
          reservationId: row.id,
          ref: r.ref,
          status: r.status,
          client: r.userName,
          email: r.userEmail,
          packageTitle: r.packageTitle,
          travelStart: f.travel?.travelStart ?? null,
          assignedTo: r.assignedTo ?? null,
          total: f.total,
          paid: f.paid,
          remaining: f.remaining,
          overdue: f.overdue,
          next: f.next,
          mismatch: f.mismatch,
        };
      })
      .filter((i) => i.remaining > 0)
      .sort((a, b) => (b.overdue > 0 ? 1 : 0) - (a.overdue > 0 ? 1 : 0) || String(a.next?.dueDate ?? "9").localeCompare(String(b.next?.dueDate ?? "9")));
    return {
      total: items.length,
      summary: {
        remaining: items.reduce((s, i) => s + i.remaining, 0),
        overdue: items.reduce((s, i) => s + i.overdue, 0),
        overdueCount: items.filter((i) => i.overdue > 0).length,
      },
      items,
    };
  }

  /**
   * Planning des départs : une ligne par (package, date de départ) sur la
   * période, avec remplissage, chiffre d'affaires, encaissé, reste, marge.
   * Les départs du catalogue sans réservation apparaissent aussi (à vendre).
   */
  async planning(fromIso: string, toIso: string) {
    const agency = await this.agency.get();
    const today = todayIso();
    const products = (await this.docs.allRows("products")).filter(isPackageRow);
    const reservations = await this.activeReservations();
    type Line = {
      key: string; packageId: string; packageTitle: string; packageStatus: string;
      from: string; to: string; start: string; end: string;
      capacity: number | null; closed: boolean; guaranteed: boolean; supplement: number;
      pax: number; dossiers: number; reservationIds: string[];
      revenue: number; paid: number; remaining: number; overdue: number; costs: number; margin: number;
    };
    const lines = new Map<string, Line>();
    const inRange = (d: string) => d >= fromIso && d <= toIso;

    for (const p of products) {
      const blob = packageBlob(p);
      for (const d of blob.departureDates || []) {
        // Occurrences de la date JJ/MM dans la fenêtre (une par an).
        for (let ref = new Date(`${fromIso}T00:00:00Z`); ; ) {
          const start = nextOccurrence(d.from, ref);
          if (!start) break;
          const startIso = start.toISOString().slice(0, 10);
          if (!inRange(startIso)) break;
          const end = nextOccurrence(d.to || d.from, start)?.toISOString().slice(0, 10) ?? startIso;
          const key = `${p.id}|${startIso}`;
          lines.set(key, {
            key, packageId: p.id, packageTitle: String(p.data.title ?? ""), packageStatus: String(p.data.status ?? ""),
            from: String(d.from), to: String(d.to ?? d.from), start: startIso, end,
            capacity: Number(d.capacity) > 0 ? Number(d.capacity) : null, closed: !!d.closed, guaranteed: !!d.guaranteed,
            supplement: Number(d.supplement) || 0,
            pax: 0, dossiers: 0, reservationIds: [], revenue: 0, paid: 0, remaining: 0, overdue: 0, costs: 0, margin: 0,
          });
          ref = new Date(start.getTime() + 86_400_000);
        }
      }
    }

    for (const row of reservations) {
      const r = row.data as Record<string, any>;
      const f = financeOf(r, row.created_at, agency, today);
      const start = f.travel?.travelStart;
      if (!start || !inRange(start)) continue;
      const key = `${r.packageId}|${start}`;
      if (!lines.has(key)) {
        lines.set(key, {
          key, packageId: String(r.packageId ?? ""), packageTitle: String(r.packageTitle ?? "Sur mesure"), packageStatus: "",
          from: String(r.dateFrom ?? ""), to: String(r.dateTo ?? ""), start, end: f.travel?.travelEnd ?? start,
          capacity: null, closed: false, guaranteed: false, supplement: 0,
          pax: 0, dossiers: 0, reservationIds: [], revenue: 0, paid: 0, remaining: 0, overdue: 0, costs: 0, margin: 0,
        });
      }
      const line = lines.get(key)!;
      const costs = costsTotal(r);
      line.pax += Number(r.totalPax) || 0;
      line.dossiers += 1;
      line.reservationIds.push(row.id);
      line.revenue += f.total;
      line.paid += f.paid;
      line.remaining += f.remaining;
      line.overdue += f.overdue;
      line.costs += costs;
      line.margin += f.total - costs;
    }

    return {
      from: fromIso,
      to: toIso,
      departures: [...lines.values()].sort((a, b) => a.start.localeCompare(b.start) || a.packageTitle.localeCompare(b.packageTitle)),
    };
  }

  /**
   * Relances de paiement (CronJob quotidien), décidées d'après l'historique
   * des relances déjà envoyées (remindersSent) — un jour où la tâche n'a pas
   * tourné est rattrapé le lendemain, et deux passages n'envoient rien en double :
   *   - un rappel quand l'échéance est à N jours ou moins (une seule fois) ;
   *   - en retard : une relance, puis une tous les X jours, au plus M au total.
   */
  async sendPaymentReminders(dryRun = false) {
    const agency = await this.agency.get();
    const today = todayIso();
    const rows = await this.docs.allRows("reservations", `data->>'status' = ANY($2::text[])`, [DUE_STATUSES]);
    const report: { reservationId: string; ref: unknown; installment: string; kind: string; sent: boolean; reason?: string }[] = [];

    for (const row of rows) {
      const r = row.data as Record<string, any>;
      const f = financeOf(r, row.created_at, agency, today);
      const sent: { key: string; at: string }[] = parseJSON(r.remindersSent, []);
      const newly: { key: string; at: string }[] = [];
      for (const inst of f.installments) {
        if (inst.remaining <= 0) continue;
        const prefix = `${inst.id}:${inst.dueDate}:`;
        const kind = reminderKind(inst.daysToDue, sent.filter((s) => s.key.startsWith(prefix)), today, agency);
        if (!kind) continue;
        const key = `${prefix}${kind}`;
        if (dryRun) {
          report.push({ reservationId: row.id, ref: r.ref, installment: inst.label, kind, sent: false, reason: "dry-run" });
          continue;
        }
        try {
          const result = await this.emails.sendForReservation("payment_reminder", toDocument(row), {
            installment_label: inst.label,
            installment_amount: String(inst.remaining),
            installment_due_date: inst.dueDate.split("-").reverse().join("/"),
            installment_days_late: inst.daysToDue < 0 ? String(-inst.daysToDue) : "0",
          });
          report.push({ reservationId: row.id, ref: r.ref, installment: inst.label, kind, sent: result.sent, reason: (result as { reason?: string }).reason });
          if (result.sent) newly.push({ key, at: new Date().toISOString() });
        } catch (err) {
          report.push({ reservationId: row.id, ref: r.ref, installment: inst.label, kind, sent: false, reason: (err as Error).message });
        }
      }
      if (newly.length) await this.docs.patch("reservations", row.id, { remindersSent: JSON.stringify([...sent, ...newly]) });
    }
    if (!dryRun) this.logger.log(`relances : ${report.filter((x) => x.sent).length} envoyée(s), ${report.length} candidate(s)`);
    return { date: today, dryRun, count: report.length, sent: report.filter((x) => x.sent).length, report };
  }

  /** Jours restants avant le départ (pour les tableaux de bord). */
  static daysToDeparture(travelStart: string | null) {
    return travelStart ? daysBetween(todayIso(), travelStart) : null;
  }
}
