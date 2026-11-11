import { useAuth } from "../context/AuthContext";
import { isStaff } from "../services/roles";
import { useAgencyState } from "../services/useAgency";
import ComingSoonPage from "./ComingSoonPage";

// Aperçus pendant la période « Bientôt en ligne », mémorisés pour l'onglet :
//   ?apercu  → le site complet (lien à donner à un testeur, sans compte)
//   ?attente → la page d'attente (même connecté en équipe, ou avant activation)
// Le site reste servi par l'API : ce n'est pas une protection, seulement
// ce que voient les visiteurs.
function previewMode() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has("apercu")) sessionStorage.setItem("fmt_cs_preview", "site");
    if (q.has("attente")) sessionStorage.setItem("fmt_cs_preview", "attente");
    return sessionStorage.getItem("fmt_cs_preview");
  } catch {
    return null;
  }
}

/**
 * Pages publiques : page « Bientôt en ligne » tant que le lancement n'est pas
 * activé (Paramètres → Agence). L'équipe connectée voit le site complet, avec
 * un rappel discret.
 */
export default function ComingSoonGate({ children }) {
  const { agency, loaded } = useAgencyState();
  const { user, loading } = useAuth();
  const preview = previewMode();

  // Fiche agence pas encore chargée : rien plutôt qu'un aperçu du site à masquer.
  if (!loaded) return <div className="mk" style={{ minHeight: "100vh" }} />;
  // Aperçu demandé (?attente) : visible même avant d'activer le mode, pour relire la page.
  if (preview === "attente") {
    return (
      <>
        <ComingSoonPage agency={agency} />
        <a className="mk-cs-flag" href="?apercu">Aperçu de la page d'attente — revenir au site</a>
      </>
    );
  }
  if (!agency.comingSoon) return children;
  if (loading) return <div className="mk" style={{ minHeight: "100vh" }} />;
  if (!isStaff(user) && preview !== "site") return <ComingSoonPage agency={agency} />;

  return (
    <>
      {children}
      <a className="mk-cs-flag" href="?attente" title="Voir la page d'attente">
        Mode « Bientôt en ligne » actif — les visiteurs voient la page d'attente
      </a>
    </>
  );
}
