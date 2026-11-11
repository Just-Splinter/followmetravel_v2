import type { Agency } from "../agency/agency";
import { addDays, daysBetween, travelPeriod } from "../reservations/travel-dates";

/**
 * Échéancier d'un dossier : acompte à la confirmation, solde N jours avant
 * le départ (fiche agence). Un échéancier saisi à la main sur la réservation
 * (`schedule`) remplace le calcul par défaut.
 *
 * Les paiements reçus (`payments`) sont affectés aux échéances dans l'ordre
 * des dates : on sait ainsi ce qui reste dû, et quand.
 */

export interface Installment {
  id: string;
  label: string;
  dueDate: string; // AAAA-MM-JJ
  amount: number;
}

export type InstallmentStatus = "paid" | "partial" | "overdue" | "due" | "upcoming";

export interface InstallmentState extends Installment {
  paid: number;
  remaining: number;
  status: InstallmentStatus;
  daysToDue: number; // < 0 : en retard
}

const round = (n: number) => Math.round(n);

function parseList<T>(raw: unknown): T[] {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/** Dates de voyage figées de la réservation (ou recalculées depuis JJ/MM et la date de création). */
export function reservationTravel(r: Record<string, unknown>, createdAt: Date) {
  if (typeof r.travelStart === "string" && r.travelStart) {
    return { travelStart: r.travelStart, travelEnd: String(r.travelEnd || r.travelStart) };
  }
  return travelPeriod(r.dateFrom, r.dateTo, createdAt);
}

export function defaultSchedule(total: number, createdIso: string, travelStart: string | null, agency: Agency): Installment[] {
  if (!(total > 0)) return [];
  const depositDue = addDays(createdIso, agency.depositDueDays);
  const balanceDue = travelStart ? addDays(travelStart, -agency.balanceDaysBeforeDeparture) : null;
  const deposit = round((total * agency.depositPercent) / 100);
  // Départ trop proche (ou acompte à 100 %) : un seul règlement.
  if (!balanceDue || balanceDue <= depositDue || deposit >= total || deposit <= 0) {
    const due = travelStart && travelStart < depositDue ? travelStart : depositDue;
    return [{ id: "total", label: "Règlement total", dueDate: due, amount: round(total) }];
  }
  return [
    { id: "deposit", label: `Acompte ${agency.depositPercent} %`, dueDate: depositDue, amount: deposit },
    { id: "balance", label: "Solde", dueDate: balanceDue, amount: round(total) - deposit },
  ];
}

export function paymentsOf(r: Record<string, unknown>): { id?: string; amount: number; date?: string }[] {
  return parseList<Record<string, unknown>>(r.payments).map((p) => ({
    id: p.id as string | undefined,
    amount: Number(p.amount) || 0,
    date: p.date as string | undefined,
  }));
}

export function totalPaid(r: Record<string, unknown>): number {
  return paymentsOf(r).reduce((s, p) => s + p.amount, 0);
}

/** Échéancier en vigueur : saisi sur le dossier, sinon calculé. */
export function scheduleOf(r: Record<string, unknown>, createdAt: Date, agency: Agency): { installments: Installment[]; custom: boolean } {
  const custom = parseList<Installment>(r.schedule).filter((i) => i && i.dueDate && Number(i.amount) > 0);
  if (custom.length) {
    return {
      custom: true,
      installments: custom.map((i, n) => ({ id: String(i.id || `i${n + 1}`), label: String(i.label || `Échéance ${n + 1}`), dueDate: String(i.dueDate).slice(0, 10), amount: Number(i.amount) })),
    };
  }
  const travel = reservationTravel(r, createdAt);
  return {
    custom: false,
    installments: defaultSchedule(Number(r.totalEstimate) || 0, createdAt.toISOString().slice(0, 10), travel?.travelStart ?? null, agency),
  };
}

/** Affecte les paiements aux échéances, par date d'échéance croissante. */
export function allocate(installments: Installment[], paid: number, today: string): InstallmentState[] {
  let pool = paid;
  return [...installments]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((i) => {
      const take = Math.max(0, Math.min(pool, i.amount));
      pool -= take;
      const remaining = round(i.amount - take);
      const daysToDue = daysBetween(today, i.dueDate);
      const status: InstallmentStatus =
        remaining <= 0 ? "paid" : daysToDue < 0 ? "overdue" : daysToDue === 0 ? "due" : take > 0 ? "partial" : "upcoming";
      return { ...i, paid: round(take), remaining: Math.max(0, remaining), status, daysToDue };
    });
}

/** Vue complète du financement d'un dossier. */
export function financeOf(r: Record<string, unknown>, createdAt: Date, agency: Agency, today: string) {
  const { installments, custom } = scheduleOf(r, createdAt, agency);
  const paid = totalPaid(r);
  const total = Number(r.totalEstimate) || 0;
  const states = allocate(installments, paid, today);
  const scheduled = installments.reduce((s, i) => s + i.amount, 0);
  const overdue = states.filter((s) => s.status === "overdue").reduce((s, i) => s + i.remaining, 0);
  const next = states.find((s) => s.remaining > 0) ?? null;
  return {
    total,
    paid,
    remaining: Math.max(0, total - paid),
    overdue,
    custom,
    // Échéancier saisi dont la somme ne correspond plus au prix (prix modifié depuis).
    mismatch: custom && Math.abs(scheduled - total) >= 1,
    next,
    installments: states,
    travel: reservationTravel(r, createdAt),
  };
}
