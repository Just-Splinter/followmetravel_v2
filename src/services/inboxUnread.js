import { useEffect, useState } from "react";
import { getInbox } from "./operations";

// Nombre de messages non lus de la boîte de réception du client connecté.
// Un seul appel partagé (header + barre d'onglets mobile), gardé 60 s ;
// `invalidateUnread()` le rafraîchit (message ouvert dans l'espace client).
const TTL = 60_000;
let cache = { key: null, at: 0, p: null };

function load(key) {
  if (cache.key === key && cache.p && Date.now() - cache.at < TTL) return cache.p;
  cache = {
    key,
    at: Date.now(),
    p: getInbox()
      .then((r) => (r?.messages || []).filter((m) => !m.readAt).length)
      .catch(() => 0),
  };
  return cache.p;
}

export function invalidateUnread() {
  cache.at = 0;
  window.dispatchEvent(new Event("fmt:inbox"));
}

export function useUnreadMessages(user) {
  const [count, setCount] = useState(0);
  const key = user?.$id || null;
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    const run = () => load(key).then((n) => alive && setCount(n));
    run();
    window.addEventListener("fmt:inbox", run);
    return () => {
      alive = false;
      window.removeEventListener("fmt:inbox", run);
    };
  }, [key]);
  return key ? count : 0;
}
