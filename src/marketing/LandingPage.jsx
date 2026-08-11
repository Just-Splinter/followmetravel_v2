import { useEffect, useMemo } from "react";
import { useTravelData } from "../context/TravelDataContext";
import { heroSlidesFromPackages, fallbackHeroSlides, isHeroSlideDoc } from "../services/heroSlides";
import Header from "./Header";
import Hero from "./Hero";
import HeroSearch from "./HeroSearch";
import {
  Destinations,
  Trips,
  Values,
  Stats,
  Adventures,
  Testimonials,
  CtaBand,
  Footer,
} from "./Sections";
import "./marketing.css";

export default function LandingPage() {
  const { packages, destinations, adventures, testimonials } = useTravelData();

  const heroSlides = useMemo(() => {
    const fromDb = heroSlidesFromPackages(packages);
    return fromDb.length ? fromDb : fallbackHeroSlides();
  }, [packages]);

  const realPackages = useMemo(
    () => (packages || []).filter((p) => !isHeroSlideDoc(p)),
    [packages]
  );

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
          <HeroSearch destinations={destinations} heroSlides={heroSlides} />
        </div>
        <Destinations destinations={destinations} heroSlides={heroSlides} />
        <Trips packages={realPackages} />
        <Values />
        <Stats />
        <Adventures adventures={adventures} heroSlides={heroSlides} />
        <Testimonials testimonials={testimonials} />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
