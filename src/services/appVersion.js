// Mise à jour du site sans vider le cache : chaque build publie /version.json
// (identifiant du build, jamais mis en cache — public/.htaccess). Un onglet
// resté ouvert, ou rouvert depuis le cache du navigateur, compare cet
// identifiant au sien et se recharge au prochain changement de page.
//
// Filet de sécurité : si un fichier JS d'une ancienne version n'existe plus
// sur le serveur (chargement à la demande d'un écran), la page se recharge
// une fois pour récupérer la nouvelle version.

const BUILD_ID = import.meta.env.VITE_BUILD_ID || "dev";
let outdated = false;
let lastCheck = 0;

async function check() {
  if (BUILD_ID === "dev" || Date.now() - lastCheck < 60_000) return;
  lastCheck = Date.now();
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const { build } = await res.json();
    if (build && build !== BUILD_ID) outdated = true;
  } catch {
    // hors ligne : on réessaiera plus tard
  }
}

/** Démarre la surveillance (au chargement, au retour sur l'onglet, toutes les 10 min). */
export function watchAppVersion() {
  // Arrivée via public/stale-asset.js : on retire le paramètre de rechargement.
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("_v")) {
      url.searchParams.delete("_v");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  } catch {
    // URL non modifiable : sans incidence
  }
  check();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  setInterval(check, 10 * 60_000);

  // Ancien fichier JS introuvable après une mise en ligne : un seul rechargement.
  window.addEventListener("vite:preloadError", (event) => {
    let reloaded = null;
    try {
      reloaded = sessionStorage.getItem("fmt_reloaded_for");
      sessionStorage.setItem("fmt_reloaded_for", BUILD_ID);
    } catch {
      // stockage indisponible : on recharge quand même, une fois par page
    }
    if (reloaded === BUILD_ID) return;
    event.preventDefault();
    window.location.reload();
  });
}

/**
 * À chaque changement de page : si une nouvelle version est en ligne, on
 * charge la page demandée depuis le serveur (rien n'est perdu, l'utilisateur
 * changeait de page de toute façon).
 */
export function reloadIfOutdated() {
  if (!outdated) return false;
  window.location.reload();
  return true;
}
