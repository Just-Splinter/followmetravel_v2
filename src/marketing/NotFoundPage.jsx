import { useNavigate } from "react-router-dom";
import Header from "./Header";
import { Footer } from "./Sections";
import { Button } from "./ui";
import { usePageMeta } from "./usePageMeta";
import { useLocale } from "./i18n";
import "./marketing.css";

/** Page introuvable : vraie page (non indexée) au lieu d'un écran vide. */
export default function NotFoundPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  usePageMeta(t("nf_title"), t("nf_text"), { noindex: true });
  return (
    <div className="mk">
      <Header />
      <main className="mk-section mk-notfound">
        <div className="mk-wrap mk-notfound-grid">
          <div>
            <span className="mk-eyebrow">404</span>
            <h1 className="mk-h2" style={{ margin: "20px 0 18px" }}>{t("nf_title")}</h1>
            <p className="mk-lead" style={{ marginBottom: 32 }}>{t("nf_text")}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button onClick={() => navigate("/")}>{t("nf_home")}</Button>
              <Button variant="paper" onClick={() => navigate("/search")}>{t("trips_all")}</Button>
            </div>
          </div>
          <img className="mk-notfound-img" src="/not-found.jpg" alt="" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
