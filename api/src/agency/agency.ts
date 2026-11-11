import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service";

// Fiche agence (singleton `products`, data.kind = "agency") — miroir de
// src/services/agency.js : garder les valeurs par défaut alignées.

export interface CancellationTier {
  daysBefore: number;
  feePercent: number;
}

export interface Agency {
  tradeName: string;
  legalName: string;
  address: string;
  city: string;
  phones: string[];
  whatsapp: string;
  email: string;
  website: string;
  licenceNumber: string;
  ice: string;
  rc: string;
  taxId: string;
  patente: string;
  capital: string;
  bankName: string;
  rib: string;
  invoiceMention: string;
  depositPercent: number;
  depositDueDays: number;
  balanceDaysBeforeDeparture: number;
  reminderDaysBefore: number;
  overdueReminderEveryDays: number;
  maxOverdueReminders: number;
  cancellationPolicy: CancellationTier[];
  cgvText: string;
  /** Passeport valable au moins N mois après le retour (0 = pas de contrôle). */
  passportValidityMonths: number;
  /** Valeurs par défaut de la fiche de réservation (modifiables par dossier). */
  refundable: boolean;
  modifiable: boolean;
  /** Mention « N.B. » de la fiche de réservation. */
  reservationNote: string;
}

export const DEFAULT_CANCELLATION: CancellationTier[] = [
  { daysBefore: 30, feePercent: 10 },
  { daysBefore: 15, feePercent: 30 },
  { daysBefore: 7, feePercent: 50 },
  { daysBefore: 0, feePercent: 100 },
];

export const DEFAULT_AGENCY: Agency = {
  tradeName: "Follow Me Travel",
  legalName: "",
  address: "",
  city: "",
  phones: ["+212 664 586 425", "+212 520 655 575"],
  whatsapp: "+212664586425",
  email: "contact@followmetravel.ma",
  website: "www.followmetravel.ma",
  licenceNumber: "",
  ice: "",
  rc: "",
  taxId: "",
  patente: "",
  capital: "",
  bankName: "",
  rib: "",
  invoiceMention: "",
  depositPercent: 30,
  depositDueDays: 3,
  balanceDaysBeforeDeparture: 30,
  reminderDaysBefore: 7,
  overdueReminderEveryDays: 7,
  maxOverdueReminders: 3,
  cancellationPolicy: DEFAULT_CANCELLATION,
  cgvText: "",
  passportValidityMonths: 6,
  refundable: false,
  modifiable: false,
  reservationNote: "Selon la loi du bureau de change, l'agence déduit un montant de la dotation touristique des clients pour régler le paiement des hôtels et des services internationaux.",
};

const NUMERIC: (keyof Agency)[] = [
  "depositPercent", "depositDueDays", "balanceDaysBeforeDeparture",
  "reminderDaysBefore", "overdueReminderEveryDays", "maxOverdueReminders", "passportValidityMonths",
];

export function parseAgencyData(raw: unknown): Agency | null {
  let data: Record<string, unknown> | null = null;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
  } catch {
    return null;
  }
  if (data?.kind !== "agency") return null;
  const agency = { ...DEFAULT_AGENCY, ...data } as Agency & Record<string, unknown>;
  for (const k of NUMERIC) {
    const n = Number(agency[k]);
    (agency as Record<string, unknown>)[k] = Number.isFinite(n) && n >= 0 ? n : DEFAULT_AGENCY[k];
  }
  agency.depositPercent = Math.min(agency.depositPercent, 100);
  if (!Array.isArray(agency.phones)) agency.phones = DEFAULT_AGENCY.phones;
  if (!Array.isArray(agency.cancellationPolicy) || !agency.cancellationPolicy.length) {
    agency.cancellationPolicy = DEFAULT_CANCELLATION;
  }
  return agency;
}

export function cancellationTiers(policy: unknown): CancellationTier[] {
  const list = Array.isArray(policy) && policy.length ? policy : DEFAULT_CANCELLATION;
  return list
    .map((t: Record<string, unknown>) => ({ daysBefore: Number(t.daysBefore) || 0, feePercent: Number(t.feePercent) || 0 }))
    .sort((a, b) => b.daysBefore - a.daysBefore);
}

/** Lignes lisibles de la politique d'annulation (PDF contrat, emails). */
export function cancellationLines(policy: unknown): string[] {
  const tiers = cancellationTiers(policy);
  return tiers.map((t, i) => {
    const prev = tiers[i - 1];
    const range =
      i === 0
        ? `Plus de ${t.daysBefore} jours avant le départ`
        : t.daysBefore === 0
          ? `Moins de ${prev.daysBefore} jours avant le départ`
          : `De ${prev.daysBefore} à ${t.daysBefore} jours avant le départ`;
    return `${range} : ${t.feePercent === 100 ? "100 % du prix (aucun remboursement)" : `${t.feePercent} % du prix`}`;
  });
}

@Injectable()
export class AgencyService {
  constructor(private readonly db: DbService) {}

  async get(): Promise<Agency> {
    const { rows } = await this.db.query<{ data: Record<string, unknown> }>(
      `SELECT data FROM documents WHERE collection = 'products' AND data->>'data' LIKE '%"kind":"agency"%' ORDER BY created_at LIMIT 1`,
    );
    return (rows[0] && parseAgencyData(rows[0].data.data)) || { ...DEFAULT_AGENCY };
  }
}
