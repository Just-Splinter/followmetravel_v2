import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import '../styles/variables.css'

import { AuthProvider, useAuth } from "../context/AuthContext";
import { FavoritesProvider } from "../context/FavoritesContext.jsx";
import { HotelsProvider } from "../context/HotelsContext.jsx";
import { PackageProvider } from "../context/PackagesContext.jsx";
import { PackageViewerProvider } from "../context/PackageViewerContext.jsx";
import { ReservationProvider } from "../context/ReservationContext.jsx";
import { ClientsProvider } from "../context/ClientsContext.jsx";
import { TravelDataProvider } from "../context/TravelDataContext.jsx";
import { MailProvider } from "../context/MailContext.jsx";
import { LocaleProvider } from "../marketing/i18n.jsx";
import { useEvents } from "../context/EventsContext.jsx";
import { hasRole, isStaff } from "../services/roles";
import WhatsAppButton from "../marketing/WhatsAppButton.jsx";

import { ToastContainer, toast } from 'react-toastify';

// Public marketing pages are the first paint — keep them in the entry chunk.
import LandingPage from "../marketing/LandingPage.jsx";
import MarketingContactPage from "../marketing/ContactPage.jsx";
import SearchPage from "../marketing/SearchPage.jsx";
import OmraPage from "../marketing/OmraPage.jsx";
import PackagePage from "../marketing/PackagePage.jsx";
import BookingPage from "../marketing/BookingPage.jsx";
import OmraBookingPage from "../marketing/OmraBookingPage.jsx";
import ProfilePage from "../marketing/ProfilePage.jsx";
import LegalPage from "../marketing/LegalPage.jsx";
import NotFoundPage from "../marketing/NotFoundPage.jsx";
import ComingSoonGate from "../marketing/ComingSoonGate.jsx";
import { reloadIfOutdated } from "../services/appVersion";

// Écrans de l'équipe et de connexion : hors du bundle des visiteurs.
const Layout       = lazy(() => import("../components/Layout.jsx"));
const LoginPage    = lazy(() => import("../pages/LoginPage"));
const AuthError    = lazy(() => import("../communs/AuthError.jsx"));
const AuthCallback = lazy(() => import("../communs/AuthCallback.jsx"));
const AuthRecovery = lazy(() => import("../communs/AuthRecovery.jsx"));

// The back-office is never seen by a visitor, so it must not ship to one.
// recharts alone (AnalyticsDashboard) is a few hundred kB.
const AnalyticsDashboard = lazy(() => import("../pages/Analyticsdashboard.jsx"));
const PackagesManager    = lazy(() => import("../pages/PackagesPage.jsx"));
const TravelCMS          = lazy(() => import("../pages/TravelCMS.jsx"));
const ReservationsManager = lazy(() => import("../components/ReservationsManager.jsx"));
const ClientsManager     = lazy(() => import("../components/ClientsManager.jsx"));
const MetaAds            = lazy(() => import("../components/MetaAds.jsx"));
const EmailManager       = lazy(() => import("../pages/Emailmanager.jsx"));
const HotelManager       = lazy(() => import("../pages/Hotelsmanager.jsx"));
const PlanningPage       = lazy(() => import("../pages/ops/PlanningPage.jsx"));
const ReceivablesPage    = lazy(() => import("../pages/ops/ReceivablesPage.jsx"));
const PipelinePage       = lazy(() => import("../pages/ops/PipelinePage.jsx"));
const FollowupsPage      = lazy(() => import("../pages/ops/FollowupsPage.jsx"));
const TeamPage           = lazy(() => import("../pages/ops/TeamPage.jsx"));
const AuditPage          = lazy(() => import("../pages/ops/AuditPage.jsx"));

const EXCLUDED_ROUTES = [
  "/dashboard",
  "/login",
  "/packages/view",
  "/voyages", // la fiche voyage envoie son propre événement (trackPackageView)
  "/auth",
];

function ScrollReset() {
  const { pathname } = useLocation();
  // instant: the global scroll-behavior:smooth turns plain scrollTo into an
  // animation that async page loads abort mid-flight
  useEffect(() => {
    // Nouvelle version en ligne : la page demandée est chargée depuis le serveur.
    if (reloadIfOutdated()) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function AnalyticsTracker() {
  const location = useLocation();
  const { trackPageView } = useEvents();

  useEffect(() => {
    const excluded = EXCLUDED_ROUTES.some(route =>
      location.pathname.startsWith(route)
    );

    if (excluded) return;

    trackPageView(location.pathname);
  }, [location.pathname, trackPageView]);

  return null;
}

/**
 * Session gate. Reads AuthContext rather than calling account.get() again —
 * this component used to fire its own duplicate request on every mount.
 *
 * This is a UX guard, not a security boundary: it only stops the dashboard
 * UI from rendering for a logged-in-but-non-admin visitor. Anyone can still
 * call the API directly from a browser console — the actual enforcement
 * lives in the API (api/src/collections/policies.ts, admin label checks),
 * which this component cannot see or affect.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { setUserId } = useEvents();
  const staff = isStaff(user);

  useEffect(() => {
    if (user?.$id) setUserId(user.$id);
  }, [user, setUserId]);

  useEffect(() => {
    if (user && !staff) toast.error("Accès réservé à l'équipe de l'agence.");
  }, [user, staff]);

  if (loading) return <div className="app-booting">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!staff) return <Navigate to="/" replace />;

  return children;
}

/** Page du dashboard réservée à certains rôles (le menu les masque déjà). */
function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  return hasRole(user, ...roles) ? children : <Navigate to="/dashboard/home" replace />;
}

/**
 * Identifie le visiteur connecté dans l'analytics du site public (événements
 * « abandon » → page Relances du dashboard).
 */
function EventsIdentity() {
  const { user } = useAuth();
  const { setUserId } = useEvents();
  useEffect(() => {
    setUserId(user?.$id ?? null);
  }, [user, setUserId]);
  return null;
}

/**
 * Pathless layout route for the public site.
 *
 * This has to be a layout route, not a wrapper repeated in every `element`:
 * a per-route wrapper gives each page its *own* TravelDataProvider, so
 * navigating / → /omra → /search remounted the provider and re-ran the six
 * bootstrap collection fetches every single time. As a layout route the
 * providers mount once and survive navigation between their children.
 */
function PublicShell() {
  return (
    <TravelDataProvider>
      <ReservationProvider>
        <EventsIdentity />
        <ComingSoonGate>
          <Outlet />
          <WhatsAppButton />
        </ComingSoonGate>
      </ReservationProvider>
    </TravelDataProvider>
  );
}

/**
 * Nested layout route for the two back-office pages that need the CMS data
 * layer: TravelCMS directly, and PackagesManager through CreatePackageModal.
 *
 * Deliberately *not* hoisted onto /dashboard itself — TravelDataProvider
 * bootstraps six collection fetches on mount, and the analytics, hotels, ads
 * and mail pages never read any of it.
 */
function CmsShell() {
  return (
    <TravelDataProvider>
      <PackageProvider>
        <Outlet />
      </PackageProvider>
    </TravelDataProvider>
  );
}

export default function Starter() {
  return (
    <AuthProvider>
      <FavoritesProvider>
      <ToastContainer />
      <BrowserRouter>
        <LocaleProvider>
          <ScrollReset />
          <AnalyticsTracker />
          <Suspense fallback={<div className="app-booting">Chargement…</div>}>
          <Routes>
            {/* ── Public ─────────────────────────────────────────────── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/error" element={<AuthError />} />
            <Route path="/auth/recovery" element={<AuthRecovery />} />

            {/* Fiche voyage : URL canonique /voyages/<id>/<slug> ; l'ancienne
                /packages/view?pkgId= reste valide (liens partagés, emails). */}
            {["/voyages/:id/:slug?", "/packages/view"].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <ComingSoonGate>
                    <PackageViewerProvider>
                      <PackagePage />
                    </PackageViewerProvider>
                  </ComingSoonGate>
                }
              />
            ))}

            {/* Réservation d'un voyage : page à part (plus de fenêtre modale). */}
            <Route
              path="/reserver/:id"
              element={
                <ComingSoonGate>
                  <PackageViewerProvider>
                    <BookingPage />
                  </PackageViewerProvider>
                </ComingSoonGate>
              }
            />

            <Route element={<PublicShell />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/contact" element={<MarketingContactPage />} />
              <Route path="/omra" element={<OmraPage />} />
              <Route path="/omra/reserver/:id" element={<OmraBookingPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profil" element={<ProfilePage />} />
              <Route path="/legal/:slug" element={<LegalPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* ── Back-office (authenticated) ─────────────────────────
                The guard belongs here, on the parent. It used to sit on two
                children only, which left /dashboard/home, /hotel, /ads, /mail
                and /settings — the CMS — reachable without a session. */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <HotelsProvider>
                    <Layout />
                  </HotelsProvider>
                </ProtectedRoute>
              }
            >
              <Route path="home" element={<AnalyticsDashboard />} />
              <Route path="hotel" element={<RoleRoute roles={["admin", "agent"]}><HotelManager /></RoleRoute>} />
              <Route path="ads" element={<RoleRoute roles={["admin"]}><MetaAds /></RoleRoute>} />
              <Route
                path="mail"
                element={
                  <RoleRoute roles={["admin"]}>
                    <MailProvider>
                      <EmailManager />
                    </MailProvider>
                  </RoleRoute>
                }
              />
              <Route path="planning" element={<PlanningPage />} />
              <Route path="echeancier" element={<ReceivablesPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="relances" element={<FollowupsPage />} />
              <Route path="equipe" element={<RoleRoute roles={["admin"]}><TeamPage /></RoleRoute>} />
              <Route path="journal" element={<RoleRoute roles={["admin"]}><AuditPage /></RoleRoute>} />
              <Route
                path="reservations"
                element={
                  <ReservationProvider>
                    <ClientsProvider>
                      <ReservationsManager />
                    </ClientsProvider>
                  </ReservationProvider>
                }
              />
              <Route
                path="clients"
                element={
                  <ReservationProvider>
                    <ClientsProvider>
                      <ClientsManager />
                    </ClientsProvider>
                  </ReservationProvider>
                }
              />

              <Route element={<RoleRoute roles={["admin", "agent"]}><CmsShell /></RoleRoute>}>
                <Route path="settings" element={<TravelCMS />} />
                <Route path="packages" element={<PackagesManager />} />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard/home" replace />} />
            </Route>
          </Routes>
          </Suspense>
        </LocaleProvider>
      </BrowserRouter>
      </FavoritesProvider>
    </AuthProvider>
  );
}
