import { useEffect } from "react";

/**
 * useScrollReveal
 * Observe tous les éléments avec .reveal, .reveal-left, .reveal-right, .reveal-scale
 * et ajoute .visible quand ils entrent dans le viewport.
 */
export function useScrollReveal(deps = []) {
  useEffect(() => {
    const selectors = [".reveal", ".reveal-left", ".reveal-right", ".reveal-scale"];
    const elements = document.querySelectorAll(selectors.join(", "));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, deps);
}