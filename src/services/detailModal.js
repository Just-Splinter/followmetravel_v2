// Modale de détail commune du dashboard : n'importe quel tableau ouvre le
// détail d'une réservation, d'un package, d'un hôtel ou d'un client sans
// quitter la page. Fournie par components/detail/DetailModalProvider (Layout).
import { createContext, useContext } from "react";

export const DetailModalContext = createContext(null);

const noop = () => {};
const FALLBACK = { openReservation: noop, openPackage: noop, openHotel: noop, openClient: noop };

/** { openReservation(id), openPackage(id), openHotel(id), openClient({ email, name }) } */
export function useDetailModal() {
  return useContext(DetailModalContext) || FALLBACK;
}
