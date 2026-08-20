import { useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import Header from "./Header";
import { Footer } from "./Sections";
import { usePageMeta } from "./usePageMeta";
import "./marketing.css";

// Starting-point legal text for a Moroccan travel agency taking online
// reservations. Placeholder company details (RC/ICE/patente) are marked
// [À COMPLÉTER] — this content has NOT been reviewed by a lawyer and must
// be before going live; it exists so the footer links go somewhere real
// instead of href="#", not as a finished legal document.
const LEGAL_CONTENT = {
  cgv: {
    title: "Conditions générales de vente",
    sections: [
      {
        heading: "1. Objet",
        body: [
          "Les présentes conditions générales de vente (CGV) régissent les relations contractuelles entre Follow Me Travel (\"l'Agence\") et toute personne (\"le Client\") effectuant une réservation de voyage, séjour ou prestation associée via le site followmetravel.ma.",
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
          "Les prix affichés sont exprimés en dirhams marocains (DH), par personne sauf indication contraire, et peuvent varier selon la période de départ, la disponibilité hôtelière et le nombre de participants.",
          "Un acompte peut être demandé à la réservation, le solde étant exigible avant le départ selon l'échéancier communiqué par l'Agence.",
        ],
      },
      {
        heading: "4. Annulation et modification",
        body: [
          "Toute demande d'annulation doit être adressée à l'Agence par écrit (email ou formulaire de contact) ou via l'espace client.",
          "Des frais d'annulation peuvent s'appliquer selon le délai restant avant le départ et les conditions propres à chaque prestataire (hôtel, transporteur). Le barème applicable est communiqué au Client avant confirmation de la réservation.",
          "Le remboursement, lorsqu'il est dû, est effectué selon le même moyen de paiement utilisé, dans un délai raisonnable après traitement de la demande.",
        ],
      },
      {
        heading: "5. Responsabilité",
        body: [
          "L'Agence agit en tant qu'intermédiaire entre le Client et les prestataires (hôtels, transporteurs, guides). Sa responsabilité ne saurait être engagée pour les faits imputables à un tiers, un cas de force majeure, ou au Client lui-même.",
        ],
      },
      {
        heading: "6. Litiges",
        body: [
          "Les présentes CGV sont soumises au droit marocain. Tout litige relatif à leur interprétation ou leur exécution relève de la compétence exclusive des tribunaux de Casablanca, à défaut de résolution amiable.",
        ],
      },
    ],
  },
  confidentialite: {
    title: "Politique de confidentialité",
    sections: [
      {
        heading: "1. Données collectées",
        body: [
          "Dans le cadre de l'utilisation du site et de la création d'une réservation, l'Agence collecte : identité et coordonnées (nom, email, téléphone), informations de réservation (destination, dates, participants), et des données de navigation à des fins statistiques (pages consultées, appareil, provenance).",
        ],
      },
      {
        heading: "2. Finalités du traitement",
        body: [
          "Ces données sont utilisées pour : traiter les demandes de réservation, assurer le suivi client (confirmation, facturation, communication liée au voyage), et améliorer le service via des statistiques de navigation anonymisées.",
          "Aucune donnée n'est vendue à des tiers. Elle peut être partagée avec les prestataires strictement nécessaires à l'exécution du voyage réservé (hôtel, transporteur).",
        ],
      },
      {
        heading: "3. Conservation",
        body: [
          "Les données sont conservées pendant la durée nécessaire à la gestion de la relation commerciale, augmentée des délais légaux de conservation applicables (comptabilité, garanties).",
        ],
      },
      {
        heading: "4. Droits du Client",
        body: [
          "Conformément à la loi 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel, le Client dispose d'un droit d'accès, de rectification et de suppression de ses données, exerçable en écrivant à contact@followmetravel.ma.",
          "Le traitement des données de Follow Me Travel est déclaré auprès de la Commission Nationale de contrôle de la protection des Données à caractère Personnel (CNDP) sous le numéro [À COMPLÉTER].",
        ],
      },
      {
        heading: "5. Sécurité",
        body: [
          "L'Agence met en œuvre les mesures techniques raisonnables (accès restreint, hébergement sécurisé) pour protéger les données contre l'accès non autorisé, la perte ou l'altération.",
        ],
      },
    ],
  },
  cookies: {
    title: "Politique des cookies",
    sections: [
      {
        heading: "1. Qu'est-ce qu'un cookie ?",
        body: [
          "Un cookie est un petit fichier déposé sur votre appareil lors de la navigation, permettant au site de fonctionner correctement ou de mesurer sa fréquentation.",
        ],
      },
      {
        heading: "2. Cookies utilisés sur ce site",
        body: [
          "Cookies essentiels : nécessaires à la navigation et à la session (connexion, panier de réservation en cours). Ils ne peuvent pas être désactivés sans altérer le fonctionnement du site.",
          "Cookies de mesure d'audience : utilisés pour comprendre l'usage du site (pages consultées, parcours, appareil) afin d'améliorer l'expérience proposée. Ces données sont utilisées à des fins internes et ne sont pas partagées à des fins publicitaires par l'Agence.",
        ],
      },
      {
        heading: "3. Gestion des cookies",
        body: [
          "Vous pouvez à tout moment configurer votre navigateur pour refuser les cookies ou être averti avant leur dépôt. Le refus des cookies non essentiels n'empêche pas la navigation ou la réservation sur le site.",
        ],
      },
    ],
  },
};

export default function LegalPage() {
  const { slug } = useParams();
  const content = LEGAL_CONTENT[slug];

  const updatedLabel = useMemo(
    () => new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    []
  );

  usePageMeta(content?.title);

  if (!content) return <Navigate to="/" replace />;

  return (
    <div className="mk">
      <Header light />
      <main style={{ minHeight: "60vh" }}>
        <div className="mk-wrap mk-page-head" style={{ paddingBottom: 28 }}>
          <span className="mk-eyebrow">Follow Me Travel</span>
          <h1 className="mk-h2" style={{ marginTop: 16 }}>{content.title}</h1>
        </div>

        <div className="mk-wrap mk-legal">
          <p className="mk-legal-notice">
            Dernière mise à jour : {updatedLabel}. Ce document est fourni à titre indicatif — pour toute question,
            contactez-nous à <a href="mailto:contact@followmetravel.ma">contact@followmetravel.ma</a>.
          </p>

          {content.sections.map((s) => (
            <section key={s.heading} className="mk-legal-section">
              <h2>{s.heading}</h2>
              {s.body.map((p, i) => <p key={i}>{p}</p>)}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
