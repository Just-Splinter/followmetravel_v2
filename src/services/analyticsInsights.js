// Constats « à retenir » du tableau de bord business : transforme les
// agrégats de /v1/analytics/summary en phrases actionnables, classées par
// importance. Pur (testé dans analyticsInsights.test.js).

const pct = (x) => `${Math.round((x || 0) * 100)} %`;

/** Période [from, to[ (AAAA-MM-JJ) des N derniers jours, aujourd'hui inclus (0 = aujourd'hui). */
export function periodFor(days, now = new Date()) {
  const to = new Date(now);
  to.setUTCHours(0, 0, 0, 0);
  to.setUTCDate(to.getUTCDate() + 1);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - Math.max(1, days));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/** Variation relative (null si la période précédente est vide). */
export function change(current, previous) {
  if (!previous) return null;
  return (current - previous) / previous;
}

/**
 * @returns {{ level: "good" | "warn" | "bad" | "info", text: string }[]}
 */
export function buildInsights(summary) {
  if (!summary?.kpis) return [];
  const k = summary.kpis;
  const p = summary.previous || {};
  const out = [];

  if (k.sessions === 0) {
    return [{ level: "info", text: "Aucune visite enregistrée sur la période : le suivi démarre dès les premières visites du site." }];
  }

  // Évolution des demandes
  const dReq = change(k.requests, p.requests);
  if (dReq !== null && Math.abs(dReq) >= 0.2) {
    out.push({
      level: dReq > 0 ? "good" : "bad",
      text: `Demandes de réservation ${dReq > 0 ? "en hausse" : "en baisse"} de ${pct(Math.abs(dReq))} par rapport à la période précédente (${p.requests} → ${k.requests}).`,
    });
  }

  // Conversion globale
  if (k.conversion !== null && k.sessions >= 50) {
    out.push(
      k.conversion < 0.01
        ? { level: "warn", text: `Seulement ${(k.conversion * 100).toFixed(1)} % des visites aboutissent à une demande : vérifier les prix affichés, les dates disponibles et la clarté du bouton « Réserver ».` }
        : { level: "info", text: `${(k.conversion * 100).toFixed(1)} % des visites aboutissent à une demande de réservation.` },
    );
  }

  // Plus grosse perte dans l'entonnoir
  const f = summary.funnel || [];
  let worst = null;
  for (let i = 1; i < f.length; i++) {
    if (!f[i - 1].value) continue;
    const kept = f[i].value / f[i - 1].value;
    if (!worst || kept < worst.kept) worst = { from: f[i - 1], to: f[i], kept };
  }
  if (worst && worst.from.value >= 20 && worst.kept < 0.5) {
    out.push({
      level: "warn",
      text: `Plus grosse perte du parcours : entre « ${worst.from.label} » et « ${worst.to.label} » (${pct(1 - worst.kept)} des visiteurs s'arrêtent).`,
    });
  }

  // Voyages très vus sans demande
  const stuck = (summary.packages || []).filter((x) => x.views >= 15 && x.requests === 0).slice(0, 2);
  for (const x of stuck) {
    out.push({ level: "warn", text: `« ${x.title} » : ${x.views} visiteurs l'ont consulté, aucune demande. Revoir le prix, les dates ou les photos.` });
  }

  // Meilleur voyage
  const best = (summary.packages || []).find((x) => x.revenue > 0);
  if (best) out.push({ level: "good", text: `Meilleur voyage de la période : « ${best.title} » (${best.confirmed} réservation(s) confirmée(s)).` });

  // Meilleure source (avec un volume minimal)
  const sources = (summary.sources || []).filter((s) => s.sessions >= 20 && !["inconnu", "direct"].includes(s.source));
  const topSource = [...sources].sort((a, b) => b.conversion - a.conversion)[0];
  if (topSource && topSource.requests > 0) {
    out.push({ level: "good", text: `Canal le plus rentable : ${topSource.source}${topSource.medium ? ` (${topSource.medium})` : ""}, ${pct(topSource.conversion)} des visites deviennent des demandes.` });
  }
  const untracked = (summary.sources || []).find((s) => s.source === "inconnu");
  if (untracked && untracked.sessions / k.sessions > 0.5) {
    out.push({ level: "info", text: "La provenance de la plupart des visites est inconnue (visites antérieures au suivi des sources). Utilisez des liens avec utm_source / utm_campaign dans vos publicités." });
  }

  // Mobile
  if (k.mobileShare >= 0.6) {
    out.push({ level: "info", text: `${pct(k.mobileShare)} des visites se font sur mobile : tester la réservation sur téléphone en priorité.` });
  }

  // Clientèle à l'étranger (MRE)
  if (k.abroadShare >= 0.15) {
    out.push({ level: "info", text: `${pct(k.abroadShare)} des visiteurs se connectent depuis l'étranger (MRE notamment) : pensez aux départs depuis l'Europe et aux horaires de rappel.` });
  }

  // Recherches sans résultat
  const missed = (summary.searches || []).filter((s) => s.noResult > 0).slice(0, 3);
  if (missed.length) {
    out.push({ level: "warn", text: `Recherches sans résultat : ${missed.map((s) => `« ${s.term} » (${s.noResult})`).join(", ")} — une demande à laquelle le catalogue ne répond pas.` });
  }

  // Abandons
  if (k.bookingOpens >= 10 && k.abandons / k.bookingOpens >= 0.5) {
    out.push({ level: "warn", text: `${k.abandons} réservations abandonnées en cours de saisie : à relancer depuis la page Relances.` });
  }

  // Délai de réservation
  if (k.leadDays > 0) {
    out.push({ level: "info", text: `Les clients réservent en moyenne ${k.leadDays} jours avant le départ : lancez la promotion d'un départ au moins ${Math.max(15, Math.round(k.leadDays * 0.8))} jours avant.` });
  }

  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]).slice(0, 8);
}
