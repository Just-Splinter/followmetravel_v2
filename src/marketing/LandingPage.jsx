import { useEffect, useMemo, useState } from "react";
import { useTravelData } from "../context/TravelDataContext";
import { heroSlidesFromPackages, fallbackHeroSlides } from "../services/heroSlides";
import { isSiteDoc } from "../services/siteDocs";
import { getUpcomingDepartures } from "../services/operations";
import { useAgency } from "../services/useAgency";
import { OmraTeaser } from "./OmraPage";
import Header from "./Header";
import Hero from "./Hero";
import HeroSearch from "./HeroSearch";
import { Values, Testimonials, CtaBand, Footer } from "./Sections";
import { UpcomingDepartures, TripsShowcase, HowItWorks, AgencyStats, DestinationsBand, CustomTrip } from "./HomeSections";
import { packageCards, packageHeroSlides } from "./homeData";
import { useLocale } from "./i18n";
import { usePageMeta } from "./usePageMeta";
import { agencyJsonLd, websiteJsonLd } from "./seo";
import "./marketing.css";

const MAX_SLIDES = 6;

export default function LandingPage() {
  const { packages, destinations, testimonials } = useTravelData();
  const { locale } = useLocale();
  const agency = useAgency();
  const [departures, setDepartures] = useState([]);

  // Titre et description par défaut du site + l'agence en données structurées.
  const jsonLd = useMemo(() => [agencyJsonLd(agency), websiteJsonLd()], [agency]);
  usePageMeta(undefined, undefined, { path: "/", jsonLd });

  // Dates réelles (places restantes) — sans elles, la home reste complète
  // avec les dates calculées depuis les packages.
  useEffect(() => {
    let alive = true;
    getUpcomingDepartures(365, 50)
      .then((d) => alive && setDepartures(Array.isArray(d) ? d : []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const realPackages = useMemo(() => (packages || []).filter((p) => !isSiteDoc(p)), [packages]);
  const cards = useMemo(() => packageCards(realPackages, departures, locale), [realPackages, departures, locale]);

  // Hero : packages « À la une » d'abord, puis les diapositives du CMS.
  const cmsSlides = useMemo(() => heroSlidesFromPackages(packages), [packages]);
  const heroSlides = useMemo(() => {
    const slides = [...packageHeroSlides(cards), ...cmsSlides].slice(0, MAX_SLIDES);
    return slides.length ? slides : fallbackHeroSlides();
  }, [cards, cmsSlides]);

  // `?at=<section-id|y>` — deterministic landing position (deep links, headless shots)
  useEffect(() => {
    const at = new URLSearchParams(window.location.search).get("at");
    if (!at) return;
    const jump = () => {
      const el = document.getElementById(at);
      window.scrollTo({ top: el ? el.offsetTop - 72 : Number(at) || 0, behavior: "instant" });
    };
    jump();
    const tid = setTimeout(jump, 700);
    return () => clearTimeout(tid);
  }, []);

  const flat = new URLSearchParams(window.location.search).has("flat");

  return (
    <div className={`mk ${flat ? "mk--flat" : ""}`}>
      <Header light />
      <main>
        <div className="mk-hero-zone">
          <Hero slides={heroSlides} />
          <HeroSearch destinations={destinations} heroSlides={cmsSlides.length ? cmsSlides : fallbackHeroSlides()} />
        </div>
        <UpcomingDepartures departures={departures} />
        <TripsShowcase cards={cards} />
        <OmraTeaser packages={packages} />
        <HowItWorks agency={agency} />
        <Values />
        <AgencyStats agency={agency} />
        <Testimonials testimonials={testimonials} agency={agency} />
        <DestinationsBand destinations={destinations} cards={cards} />
        <CustomTrip agency={agency} />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
