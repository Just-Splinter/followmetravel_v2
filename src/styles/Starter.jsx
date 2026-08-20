import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { lazy, useEffect } from "react";
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

import Layout from "../components/Layout.jsx";
import LoginPage from "../pages/LoginPage";
import AuthError from "../communs/AuthError.jsx";
import AuthCallback from "../communs/AuthCallback.jsx";
import AuthRecovery from "../communs/AuthRecovery.jsx";
import { ToastContainer, toast } from 'react-toastify';

// Public marketing pages are the first paint — keep them in the entry chunk.
import LandingPage from "../marketing/LandingPage.jsx";
import MarketingContactPage from "../marketing/ContactPage.jsx";
import SearchPage from "../marketing/SearchPage.jsx";
import OmraPage from "../marketing/OmraPage.jsx";
import PackagePage from "../marketing/PackagePage.jsx";
import ProfilePage from "../marketing/ProfilePage.jsx";
import LegalPage from "../marketing/LegalPage.jsx";

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

const EXCLUDED_ROUTES = [
  "/dashboard",
  "/login",
  "/packages/view",
  "/auth",
];

function ScrollReset() {
  const { pathname } = useLocation();
  // instant: the global scroll-behavior:smooth turns plain scrollTo into an
  // animation that async page loads abort mid-flight
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, [pathname]);
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
 * call the Appwrite API directly from a browser console — the actual
 * enforcement has to live in Appwrite's collection/document permissions
 * (Role.label("admin")), which this component cannot see or affect.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { setUserId } = useEvents();
  const isAdmin = !!user?.labels?.includes("admin");

  useEffect(() => {
    if (user?.email) setUserId(user.email);
  }, [user, setUserId]);

  useEffect(() => {
    if (user && !isAdmin) toast.error("Accès réservé aux administrateurs.");
  }, [user, isAdmin]);

  if (loading) return <div className="app-booting">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return children;
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
        <Outlet />
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
          <Routes>
            {/* ── Public ─────────────────────────────────────────────── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/error" element={<AuthError />} />
            <Route path="/auth/recovery" element={<AuthRecovery />} />

            <Route
              path="/packages/view"
              element={
                <PackageViewerProvider>
                  <PackagePage />
                </PackageViewerProvider>
              }
            />

            <Route element={<PublicShell />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/contact" element={<MarketingContactPage />} />
              <Route path="/omra" element={<OmraPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profil" element={<ProfilePage />} />
              <Route path="/legal/:slug" element={<LegalPage />} />
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
              <Route path="hotel" element={<HotelManager />} />
              <Route path="ads" element={<MetaAds />} />
              <Route
                path="mail"
                element={
                  <MailProvider>
                    <EmailManager />
                  </MailProvider>
                }
              />
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

              <Route element={<CmsShell />}>
                <Route path="settings" element={<TravelCMS />} />
                <Route path="packages" element={<PackagesManager />} />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard/home" replace />} />
            </Route>
          </Routes>
        </LocaleProvider>
      </BrowserRouter>
      </FavoritesProvider>
    </AuthProvider>
  );
}
