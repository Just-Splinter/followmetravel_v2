// Fiche agence côté site public, chargée une fois par session (une seule
// requête, partagée par le bouton WhatsApp, le pied de page, la page package,
// la réservation et la page CGV).
import { useEffect, useState } from "react";
import db, { Collections, Query } from "./database";
import { DEFAULT_AGENCY, agencyFromPackages } from "./agency";

let agencyPromise = null;

export function loadAgency() {
  agencyPromise ??= db
    .list(Collections.PRODUCTS, [Query.search("data", '"kind":"agency"'), Query.limit(1)])
    .then((res) => agencyFromPackages(res.documents))
    .catch(() => ({ ...DEFAULT_AGENCY }));
  return agencyPromise;
}

/** Fiche agence + `loaded` (faux tant que la vraie fiche n'est pas arrivée). */
export function useAgencyState() {
  const [state, setState] = useState({ agency: DEFAULT_AGENCY, loaded: false });
  useEffect(() => {
    let alive = true;
    loadAgency().then((a) => alive && setState({ agency: a, loaded: true }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export function useAgency() {
  const [agency, setAgency] = useState(DEFAULT_AGENCY);
  useEffect(() => {
    let alive = true;
    loadAgency().then((a) => alive && setAgency(a));
    return () => {
      alive = false;
    };
  }, []);
  return agency;
}
