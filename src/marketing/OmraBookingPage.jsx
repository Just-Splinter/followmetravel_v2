import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { RECAPTCHA_SITE_KEY } from "../services/recaptcha";
import { useTravelData } from "../context/TravelDataContext";
import { omraFromPackages } from "../services/omra";
import { useLocale } from "./i18n";
import Header from "./Header";
import { Footer } from "./Sections";
import OmraBooking from "./OmraBooking";
import { usePageMeta } from "./usePageMeta";
import "./marketing.css";
import "./omra.css";

/** Réservation d'un forfait Omra : /omra/reserver/<id> (ouverte depuis /omra). Non indexée. */
export default function OmraBookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLocale();
  const { packages, loading } = useTravelData();
  const pkg = useMemo(() => omraFromPackages(packages).find((o) => o.$id === id) || null, [packages, id]);

  usePageMeta(pkg ? `${t("om_pk_book")} — ${pkg.title}` : t("om_pk_book"), undefined, { noindex: true });

  if (!pkg) {
    return (
      <div className="mk">
        <Header />
        <main className="mk-wrap mk-page-head" style={{ minHeight: "60vh" }}>
          {!loading && packages?.length > 0 && <h1 className="mk-h2">{t("pk_notfound")}</h1>}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <OmraBooking pkg={pkg} onClose={() => navigate("/omra#om-forfaits")} />
    </GoogleReCaptchaProvider>
  );
}
