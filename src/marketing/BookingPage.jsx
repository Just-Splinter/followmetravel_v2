import { useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { RECAPTCHA_SITE_KEY } from "../services/recaptcha";
import { usePackages } from "../context/PackageViewerContext";
import { ReservationProvider } from "../context/ReservationContext";
import { useLocale } from "./i18n";
import Header from "./Header";
import { Footer } from "./Sections";
import BookingFlow from "./BookingFlow";
import { packageFromDoc } from "./packageDoc";
import { packagePath } from "./seo";
import { usePageMeta } from "./usePageMeta";
import "./marketing.css";

/**
 * Page de réservation d'un voyage : /reserver/<id>?depart=<n>&adults=<n>&date=<aaaa-mm-jj>
 * (ouverte depuis la fiche voyage). Non indexée.
 */
export default function BookingPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const { fetchById, selectedPkg, loading } = usePackages();

  useEffect(() => {
    if (id) fetchById(id).catch(() => {});
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // selectedPkg peut encore être le voyage précédent pendant le chargement.
  const doc = selectedPkg?.$id === id ? selectedPkg : null;
  const pkg = useMemo(() => packageFromDoc(doc, locale), [doc, locale]);

  usePageMeta(pkg ? `${t("pk_book")} — ${pkg.title || pkg.destination}` : t("pk_book"), undefined, { noindex: true });

  if (!pkg) {
    return (
      <div className="mk">
        <Header />
        <main className="mk-wrap mk-page-head" style={{ minHeight: "60vh" }}>
          {!loading && <h1 className="mk-h2">{t("pk_notfound")}</h1>}
        </main>
        {!loading && <Footer />}
      </div>
    );
  }

  const depart = searchParams.get("depart");
  const back = () => navigate(packagePath(pkg.$id, pkg.title));

  return (
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <ReservationProvider>
        <BookingFlow
          pkg={pkg}
          prefill={{ adults: searchParams.get("adults"), date: searchParams.get("date"), formule: searchParams.get("formule") }}
          initialDateIdx={depart !== null && depart !== "" && !isNaN(Number(depart)) ? Number(depart) : null}
          onClose={back}
        />
      </ReservationProvider>
    </GoogleReCaptchaProvider>
  );
}
