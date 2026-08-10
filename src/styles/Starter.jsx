import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import '../styles/variables.css'

import { AuthProvider } from "../context/AuthContext";
import LoginPage from "../pages/LoginPage";
import Layout from "../components/Layout.jsx";
import PackagesManager from "../pages/PackagesPage.jsx";
import { PackageProvider } from "../context/PackagesContext.jsx";
import { getUserData } from "../services/appwrite.js";
import { useEffect, useState } from "react";
import PackageViewerPage from "../pages/PackageViewerPage.jsx";
import { PackageViewerProvider } from "../context/PackageViewerContext.jsx";
import { ReservationProvider } from "../context/ReservationContext.jsx";
import TravelCMS from "../pages/TravelCMS.jsx";
import { TravelDataProvider } from "../context/TravelDataContext.jsx";
import TravelPage from "../components/TravelPageSite.jsx";
import ReservationsManager from "../components/ReservationsManager.jsx";
import ToursFilterPage from "../pages/ToursFilterPage.jsx";
import AuthError from "../communs/AuthError.jsx";
import AuthCallback from "../communs/AuthCallback.jsx";
import AnalyticsDashboard from "../pages/Analyticsdashboard.jsx";
import { useEvents } from "../context/EventsContext.jsx";
import UserProfilePage from "../pages/Userprofilepage.jsx";
import { ToastContainer } from 'react-toastify';
import MetaAds from "../components/MetaAds.jsx";
import EmailManager from "../pages/Emailmanager.jsx";
import { MailProvider } from "../context/MailContext.jsx";
import HotelManager from "../pages/Hotelsmanager.jsx";

const EXCLUDED_ROUTES = [
  "/dashboard",
  "/login",
  "/packages/view",
  "/auth",
];

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
function ProtectedRoute({ children }) {
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const { setUserId } = useEvents();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const account = await getUserData();
        setUser(account);
        setUserId(account.email);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [setUserId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return user ? children : <Navigate to="/login" replace />;
}
const TravelLayout = ({ children }) => (
  <TravelDataProvider>
    <ReservationProvider>
      {children}
    </ReservationProvider>
  </TravelDataProvider>
);

const PackageLayout = ({ children }) => (
  <PackageProvider>
    {children}
  </PackageProvider>
);

const ReservationLayout = ({ children }) => (
  <PackageProvider>
    <ReservationProvider>
      {children}
    </ReservationProvider>
  </PackageProvider>
);

const PackageViewerLayout = ({ children }) => (
  <PackageViewerProvider>
    {children}
  </PackageViewerProvider>
);

export default function Starter() {
  return (
    <AuthProvider>
      <ToastContainer></ToastContainer>
      <BrowserRouter>
        <AnalyticsTracker></AnalyticsTracker>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/error" element={<AuthError />} />
          <Route
            path="/packages/view"
            element={
              <PackageViewerLayout>
                <PackageViewerPage />
              </PackageViewerLayout>
            }
          />
          <Route
            path="/"
            element={
              <TravelLayout>
                <TravelPage />
              </TravelLayout>
            }
          />
          <Route
            path="/search"
            element={
              <TravelLayout>
                <ToursFilterPage />
              </TravelLayout>
            }
          />
           <Route
            path="/profil"
            element={
              <TravelLayout>
                <UserProfilePage />
              </TravelLayout>
            }
          />
          {/* Protected layout */}
          <Route path="/dashboard" element={<Layout />}>
            <Route
              path="home"
              element={
                <AnalyticsDashboard></AnalyticsDashboard>
              }
            />
             <Route
              path="hotel"
              element={
                <HotelManager></HotelManager>
              }
            />
            <Route
              path="ads"
              element={
                <MetaAds></MetaAds>
              }
            />

            <Route
              path="mail"
              element={
                <MailProvider>
                  <EmailManager></EmailManager>
                </MailProvider>
              }
            />
            <Route
              path="settings"
              element={
                <TravelLayout>
                  <TravelCMS />
                </TravelLayout>
              }
            />
            <Route
              path="reservations"
              element={
                <ProtectedRoute>
                  <ReservationLayout>
                    <ReservationsManager />
                  </ReservationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="packages"
              element={
                <ProtectedRoute>
                  <PackageLayout>
                    <PackagesManager />
                  </PackageLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard/home" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}