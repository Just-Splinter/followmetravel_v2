import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Hotel, Package, Users, X } from "lucide-react";
import db, { Collections } from "../../services/database";
import { DetailModalContext } from "../../services/detailModal";
import { sendTriggerEmail } from "../../services/emailSender";
import { STATUS_TRIGGER, useInjectStyles } from "../../services/reservationShared";
import { useOpsStyles } from "../../services/opsFormat";
import { ClientQuickView, HotelQuickView, PackageQuickView } from "./QuickViews";
import "./detail-modal.css";

// Détail complet d'une réservation (onglets, paiements, documents…), chargé
// à la première ouverture seulement.
const DetailDrawer = lazy(() => import("../ReservationsManager").then((m) => ({ default: m.DetailDrawer })));

const KIND_META = {
  package: { title: "Package", icon: Package },
  hotel: { title: "Hôtel", icon: Hotel },
  client: { title: "Client", icon: Users },
};

/** Fenêtre de synthèse (package, hôtel, client) — même gabarit que le détail réservation. */
function QuickSheet({ kind, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const { title, icon: Icon } = KIND_META[kind];
  return (
    <>
      <div className="res-drawer-backdrop" onClick={onClose} />
      <div className="res-drawer" role="dialog" aria-modal="true" aria-label={title}
        style={{ "--sheet-w": "760px", transform: "translate(-50%, -50%)" }}>
        <div className="res-drawer-header">
          <span className="res-drawer-title"><Icon size={20} />{title}</span>
          <button className="res-modal-close" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="res-drawer-body">{children}</div>
      </div>
    </>
  );
}

/**
 * Modale de détail commune du dashboard (montée dans Layout). Une pile :
 * ouvrir une réservation depuis la fiche d'un client, puis la fermer,
 * revient à la fiche du client.
 */
export default function DetailModalProvider({ children }) {
  useInjectStyles();
  useOpsStyles();
  const [stack, setStack] = useState([]); // [{ kind, id, email, name }]
  const [reservation, setReservation] = useState(null);
  const top = stack[stack.length - 1] || null;

  const push = useCallback((entry) => setStack((s) => [...s, entry]), []);
  const close = useCallback(() => setStack((s) => s.slice(0, -1)), []);

  // Chargement de la réservation au sommet de la pile.
  const topReservationId = top?.kind === "reservation" ? top.id : null;
  useEffect(() => {
    if (!topReservationId) return;
    let alive = true;
    db.get(Collections.RESERVATIONS, topReservationId)
      .then((doc) => alive && setReservation(doc))
      .catch((e) => {
        if (!alive) return;
        toast.error(e.message || "Réservation introuvable.");
        close();
      });
    return () => {
      alive = false;
    };
  }, [topReservationId, close]);

  const notify = useCallback((msg, type = "success") => (type === "error" ? toast.error(msg) : toast.success(msg)), []);

  const saveReservation = useCallback(async (data) => {
    const patch = Object.fromEntries(Object.entries(data).filter(([k]) => !k.startsWith("$")));
    const updated = await db.update(Collections.RESERVATIONS, data.$id, patch);
    setReservation((r) => ({ ...r, ...updated }));
    return updated;
  }, []);

  const changeStatus = useCallback(async (id, status) => {
    try {
      const updated = await db.update(Collections.RESERVATIONS, id, { status });
      setReservation((r) => ({ ...r, ...updated }));
      toast.success("Statut mis à jour.");
      if (STATUS_TRIGGER[status]) sendTriggerEmail(STATUS_TRIGGER[status], { reservationId: id });
    } catch (e) {
      toast.error(e.message || "Changement de statut impossible.");
    }
  }, []);

  const api = useMemo(
    () => ({
      openReservation: (id) => id && push({ kind: "reservation", id }),
      openPackage: (id) => id && push({ kind: "package", id }),
      openHotel: (id) => id && push({ kind: "hotel", id }),
      openClient: ({ email, name } = {}) => (email || name) && push({ kind: "client", email, name }),
    }),
    [push],
  );

  const shownReservation = top?.kind === "reservation" && reservation?.$id === top.id ? reservation : null;

  return (
    <DetailModalContext.Provider value={api}>
      {children}
      {top?.kind === "reservation" && (
        <Suspense fallback={null}>
          <DetailDrawer
            open={!!shownReservation}
            res={shownReservation}
            onClose={close}
            onSave={saveReservation}
            onStatusChange={changeStatus}
            onLocalUpdate={(doc) => setReservation((r) => ({ ...r, ...doc }))}
            notify={notify}
          />
        </Suspense>
      )}
      {top?.kind === "package" && (
        <QuickSheet kind="package" onClose={close}><PackageQuickView id={top.id} onClose={() => setStack([])} /></QuickSheet>
      )}
      {top?.kind === "hotel" && (
        <QuickSheet kind="hotel" onClose={close}><HotelQuickView id={top.id} onClose={() => setStack([])} /></QuickSheet>
      )}
      {top?.kind === "client" && (
        <QuickSheet kind="client" onClose={close}>
          <ClientQuickView email={top.email} name={top.name} onOpenReservation={api.openReservation} onClose={() => setStack([])} />
        </QuickSheet>
      )}
    </DetailModalContext.Provider>
  );
}
