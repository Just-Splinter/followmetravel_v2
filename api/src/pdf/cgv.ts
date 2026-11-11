import { cancellationLines, type Agency } from "../agency/agency";
import { GOLD, Layout, frDate } from "./layout";

// Conditions générales de vente en PDF à part. Texte : Paramètres → Agence
// (Markdown) s'il est renseigné, sinon le texte par défaut du site
// (src/marketing/LegalPage.jsx), complété par le barème d'annulation et la
// règle de validité des passeports configurés.

export const DEFAULT_CGV: { heading: string; body: string[] }[] = [
  {
    heading: "1. Objet",
    body: [
      "Les présentes conditions générales de vente (CGV) régissent les relations contractuelles entre l'Agence et toute personne (le Client) effectuant une réservation de voyage, séjour ou prestation associée.",
      "Toute réservation implique l'acceptation sans réserve des présentes CGV.",
    ],
  },
  {
    heading: "2. Réservation et confirmation",
    body: [
      "Une demande de réservation soumise sur le site constitue une demande, pas une confirmation ferme : l'Agence contacte le Client pour valider la disponibilité, le prix définitif et les modalités de paiement.",
      "La réservation est réputée confirmée à réception d'un acompte ou du règlement intégral, selon les modalités communiquées par l'Agence pour chaque offre.",
    ],
  },
  {
    heading: "3. Prix et paiement",
    body: [
      "Les prix sont exprimés en dirhams marocains (DH), par personne sauf indication contraire, et peuvent varier selon la période de départ, la disponibilité hôtelière et le nombre de participants.",
      "Un acompte peut être demandé à la réservation, le solde étant exigible avant le départ selon l'échéancier communiqué par l'Agence.",
    ],
  },
  {
    heading: "4. Annulation et modification",
    body: [
      "Toute demande d'annulation doit être adressée à l'Agence par écrit (email) ou via l'espace client.",
      "Des frais d'annulation s'appliquent selon le délai restant avant le départ (barème ci-dessous) et les conditions propres à chaque prestataire (hôtel, transporteur).",
      "Le remboursement, lorsqu'il est dû, est effectué selon le même moyen de paiement utilisé, dans un délai raisonnable après traitement de la demande.",
    ],
  },
  {
    heading: "5. Documents de voyage",
    body: [
      "Le Client est responsable de la validité de ses documents de voyage (passeport, visas, autorisations, vaccins). L'Agence ne peut être tenue responsable d'un refus d'embarquement ou d'entrée sur le territoire.",
    ],
  },
  {
    heading: "6. Responsabilité",
    body: [
      "L'Agence agit en tant qu'intermédiaire entre le Client et les prestataires (hôtels, transporteurs, guides). Sa responsabilité ne saurait être engagée pour les faits imputables à un tiers, un cas de force majeure, ou au Client lui-même.",
    ],
  },
  {
    heading: "7. Litiges",
    body: [
      "Les présentes CGV sont soumises au droit marocain. Tout litige relatif à leur interprétation ou leur exécution relève de la compétence exclusive des tribunaux de Casablanca, à défaut de résolution amiable.",
    ],
  },
];

/** Markdown simple de Paramètres → Agence : titres (#), puces (- / *), paragraphes. */
function renderMarkdown(l: Layout, text: string) {
  let para: string[] = [];
  const flush = () => {
    if (para.length) l.paragraph(para.join(" ").replace(/[*_`]/g, ""), { size: 9 });
    para = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (/^#{1,6}\s/.test(line)) {
      flush();
      l.section(line.replace(/^#+\s*/, ""));
    } else if (/^[-*]\s/.test(line)) {
      flush();
      l.paragraph(`•  ${line.replace(/^[-*]\s*/, "").replace(/[*_`]/g, "")}`, { size: 9 });
    } else {
      para.push(line);
    }
  }
  flush();
}

export async function renderCgv(agency: Agency, r: Record<string, any>, pkgPolicy: unknown, travelEnd?: string | null): Promise<Buffer> {
  const l = new Layout(agency, "Conditions de vente", [
    { label: "Dossier", value: String(r.ref || "") },
    { label: "Client", value: String(r.userName || "") },
  ], { brand: GOLD.brand, brandFooter: "DES VOYAGES QUI RAPPROCHENT" });

  l.paragraph(
    `Conditions applicables au dossier ${r.ref || ""}${r.packageTitle ? ` (${r.packageTitle})` : ""}, conclu avec ${agency.legalName || agency.tradeName}${agency.licenceNumber ? `, agence de voyages titulaire de la licence n° ${agency.licenceNumber}` : ""}.`,
    { muted: true },
  );

  if (agency.cgvText?.trim()) renderMarkdown(l, agency.cgvText);
  else
    for (const s of DEFAULT_CGV) {
      l.section(s.heading);
      for (const p of s.body) l.paragraph(p, { size: 9 });
    }

  l.section("Barème des frais d'annulation");
  l.table(
    [{ header: "Date de l'annulation", width: 60 }, { header: "Frais retenus", width: 40 }],
    cancellationLines(pkgPolicy ?? agency.cancellationPolicy).map((line) => {
      const [when, fee] = line.split(" : ");
      return [when, fee ?? ""];
    }),
  );
  if (agency.passportValidityMonths) {
    l.section("Passeports");
    l.paragraph(
      `Chaque voyageur doit présenter un passeport valable au moins ${agency.passportValidityMonths} mois après la date de retour${travelEnd ? ` (soit après le ${frDate(travelEnd)} pour ce voyage)` : ""}. Une réservation avec un passeport ne respectant pas cette règle ne peut pas être acceptée.`,
      { size: 9 },
    );
  }
  l.section("Acceptation");
  l.paragraph(
    r.clientValidatedAt
      ? `Conditions acceptées par le client le ${frDate(String(r.clientValidatedAt).slice(0, 10))} lors de la validation de sa réservation dans son espace client.`
      : "La validation de la réservation depuis l'espace client vaut acceptation des présentes conditions générales de vente.",
    { size: 9 },
  );
  return l.finish();
}
