import { whatsappLink } from "../services/agency";
import { useAgency } from "../services/useAgency";

const STYLE = {
  // --mk-wa-bottom : relevé au-dessus de la barre d'onglets mobile (marketing.css).
  position: "fixed", right: 20, bottom: "var(--mk-wa-bottom, 20px)", zIndex: 900, display: "flex", alignItems: "center", gap: 10,
  background: "#25D366", color: "#fff", borderRadius: 999, padding: "12px 18px 12px 14px",
  boxShadow: "0 10px 28px rgba(37,211,102,.35), 0 2px 6px rgba(0,0,0,.15)", fontWeight: 700, fontSize: 14,
  textDecoration: "none", fontFamily: "inherit",
};

/**
 * Bouton WhatsApp flottant du site — principal canal de vente au Maroc.
 * Le message est pré-rempli avec le voyage consulté (et le départ choisi)
 * pour que le conseiller sache tout de suite de quoi il s'agit.
 */
export default function WhatsAppButton({ packageTitle, departure, pax }) {
  const agency = useAgency();
  const parts = ["Bonjour Follow Me Travel,"];
  if (packageTitle) {
    parts.push(`je suis intéressé(e) par « ${packageTitle} »${departure ? `, départ du ${departure}` : ""}${pax ? `, ${pax} voyageur(s)` : ""}.`);
  } else {
    parts.push("je souhaite des informations sur vos voyages.");
  }
  const href = whatsappLink(agency, parts.join(" "));
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={STYLE}
      aria-label="Discuter avec un conseiller sur WhatsApp"
      // Suivi automatique des liens WhatsApp (EventsContext) : ce libellé précise le contexte.
      data-track-label={packageTitle ? `Bouton flottant — ${packageTitle}` : "Bouton flottant"}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.5 9.5 0 0 1-4.84-1.33l-.35-.2-3.6.94.96-3.5-.23-.36a9.46 9.46 0 0 1-1.45-5.05c0-5.24 4.27-9.5 9.52-9.5a9.46 9.46 0 0 1 6.73 2.79 9.43 9.43 0 0 1 2.78 6.72c0 5.25-4.27 9.5-9.51 9.5m8.1-17.6A11.37 11.37 0 0 0 12.05.5C5.73.5.59 5.64.59 11.96c0 2.02.53 3.99 1.53 5.73L.5 23.5l5.94-1.56a11.44 11.44 0 0 0 5.6 1.43h.01c6.32 0 11.46-5.14 11.46-11.46 0-3.06-1.19-5.94-3.36-8.1" />
      </svg>
      <span className="mk-wa-label">WhatsApp</span>
    </a>
  );
}
