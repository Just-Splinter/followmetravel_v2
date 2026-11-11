import { Injectable } from "@nestjs/common";
import { DbService } from "../db/db.service";

/**
 * Tableau de bord « business » : agrégats SQL sur toute la période (pas de
 * plafond de 5 000 événements), comparés à la période précédente de même
 * durée. Le trafic de l'équipe (comptes admin / conseiller / comptable) et
 * les pages du dashboard sont exclus.
 */

// Événements d'une période, hors équipe. $1 = début, $2 = fin (exclue).
const EVENTS_CTE = `
  staff AS (
    SELECT id AS key FROM users WHERE labels && ARRAY['admin','agent','accounting']::text[]
    UNION SELECT lower(email) FROM users WHERE labels && ARRAY['admin','agent','accounting']::text[]
  ),
  ev AS (
    SELECT data, created_at,
           data->>'sessionId' AS sid,
           data->>'event' AS event,
           COALESCE(NULLIF(data->>'source', ''), 'inconnu') AS source
    FROM documents
    WHERE collection = 'events'
      AND created_at >= $1 AND created_at < $2
      AND COALESCE(data->>'page', '') NOT LIKE '/dashboard%'
      AND (data->>'userId' IS NULL OR lower(data->>'userId') NOT IN (SELECT key FROM staff))
  )`;

// Réservations créées sur la période (source de vérité des demandes et du CA).
const RES_CTE = `
  res AS (
    SELECT id, data, created_at,
           data->>'status' AS status,
           COALESCE((data->>'totalEstimate')::numeric, 0) AS total
    FROM documents
    WHERE collection = 'reservations' AND created_at >= $1 AND created_at < $2
  )`;

const CONFIRMED = `('confirmed','paid','completed')`;

export interface Period {
  from: Date;
  to: Date;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DbService) {}

  private async one<T>(sql: string, p: Period): Promise<T> {
    const { rows } = await this.db.query(sql, [p.from, p.to]);
    return rows[0] as T;
  }

  private async many<T>(sql: string, p: Period): Promise<T[]> {
    const { rows } = await this.db.query(sql, [p.from, p.to]);
    return rows as T[];
  }

  /** Indicateurs clés d'une période. */
  async kpis(p: Period) {
    const traffic = await this.one<Record<string, string>>(
      `WITH ${EVENTS_CTE}
       SELECT
         count(DISTINCT sid) AS sessions,
         count(DISTINCT data->>'userId') FILTER (WHERE data->>'userId' IS NOT NULL) AS identified,
         count(*) FILTER (WHERE event = 'page_view') AS page_views,
         count(*) FILTER (WHERE event = 'view' AND data->>'category' = 'package') AS package_views,
         count(DISTINCT sid) FILTER (WHERE event = 'view' AND data->>'category' = 'package') AS sessions_viewing,
         count(*) FILTER (WHERE event = 'click' AND data->>'action' = 'reserve') AS booking_opens,
         count(*) FILTER (WHERE event = 'abandon') AS abandons,
         count(*) FILTER (WHERE event = 'search') AS searches,
         count(*) FILTER (WHERE event = 'favorite' AND data->>'action' = 'add') AS favorites,
         count(*) FILTER (WHERE event = 'contact' AND data->>'action' = 'whatsapp'
                          OR event = 'click' AND data->>'category' = 'whatsapp') AS whatsapp,
         count(*) FILTER (WHERE event = 'contact' AND data->>'action' = 'phone') AS phone,
         count(*) FILTER (WHERE event = 'contact' AND data->>'action' = 'email') AS email,
         count(*) FILTER (WHERE event = 'lead' AND data->>'action' = 'contact') AS contact_forms,
         count(*) FILTER (WHERE event = 'lead' AND data->>'action' = 'newsletter') AS newsletter,
         count(DISTINCT sid) FILTER (WHERE event = 'payment' OR event = 'booking_step' AND data->>'action' = 'success') AS converted_sessions,
         count(DISTINCT sid) FILTER (WHERE data->>'device' = 'mobile') AS mobile_sessions,
         count(DISTINCT sid) FILTER (WHERE COALESCE(data->>'tz', '') NOT IN ('', 'Africa/Casablanca')) AS abroad_sessions
       FROM ev`,
      p,
    );
    const sales = await this.one<Record<string, string>>(
      `WITH ${RES_CTE}
       SELECT
         count(*) AS requests,
         count(*) FILTER (WHERE COALESCE(data->>'userId', '') <> '') AS online_requests,
         COALESCE(sum(total), 0) AS requested_value,
         count(*) FILTER (WHERE status IN ${CONFIRMED}) AS confirmed,
         COALESCE(sum(total) FILTER (WHERE status IN ${CONFIRMED}), 0) AS revenue,
         count(*) FILTER (WHERE status = 'cancelled') AS cancelled,
         COALESCE(avg(((data->>'travelStart')::date - created_at::date)) FILTER (WHERE data->>'travelStart' ~ '^\\d{4}-\\d{2}-\\d{2}$'), 0) AS lead_days,
         COALESCE(sum((data->>'totalPax')::numeric), 0) AS travelers
       FROM res`,
      p,
    );
    const n = (v: unknown) => Number(v) || 0;
    const t = Object.fromEntries(Object.entries(traffic).map(([k, v]) => [k, n(v)]));
    const s = Object.fromEntries(Object.entries(sales).map(([k, v]) => [k, n(v)]));
    return {
      sessions: t.sessions,
      identified: t.identified,
      pageViews: t.page_views,
      packageViews: t.package_views,
      sessionsViewing: t.sessions_viewing,
      bookingOpens: t.booking_opens,
      abandons: t.abandons,
      searches: t.searches,
      favorites: t.favorites,
      contacts: { whatsapp: t.whatsapp, phone: t.phone, email: t.email, forms: t.contact_forms, newsletter: t.newsletter },
      mobileShare: t.sessions ? t.mobile_sessions / t.sessions : 0,
      abroadShare: t.sessions ? t.abroad_sessions / t.sessions : 0,
      requests: s.requests,
      // Demandes reçues via le site (compte client) vs saisies par l'agence (téléphone, agence).
      onlineRequests: s.online_requests,
      webConversions: t.converted_sessions,
      requestedValue: s.requested_value,
      confirmed: s.confirmed,
      revenue: s.revenue,
      cancelled: s.cancelled,
      travelers: s.travelers,
      avgBasket: s.confirmed ? s.revenue / s.confirmed : 0,
      leadDays: Math.round(s.lead_days),
      // Taux clés (null si dénominateur nul).
      // Conversion du site : visites qui envoient une demande (les dossiers
      // saisis par l'agence n'ont pas de visite et ne comptent pas ici).
      conversion: t.sessions ? t.converted_sessions / t.sessions : null,
      confirmationRate: s.requests ? s.confirmed / s.requests : null,
    };
  }

  /** Entonnoir par session : chaque étape compte les sessions qui l'ont atteinte. */
  async funnel(p: Period) {
    const r = await this.one<Record<string, string>>(
      `WITH ${EVENTS_CTE}
       SELECT
         count(DISTINCT sid) AS visit,
         count(DISTINCT sid) FILTER (WHERE event = 'view' AND data->>'category' = 'package' OR event = 'page_view' AND data->>'page' = '/omra') AS view,
         count(DISTINCT sid) FILTER (WHERE event = 'click' AND data->>'action' = 'reserve') AS open,
         count(DISTINCT sid) FILTER (WHERE event = 'booking_step' AND (data->>'action') IN ('travelers', 'submit')) AS details,
         count(DISTINCT sid) FILTER (WHERE event = 'payment' OR event = 'booking_step' AND data->>'action' = 'success') AS request
       FROM ev`,
      p,
    );
    return [
      { key: "visit", label: "Visites", value: Number(r.visit) || 0 },
      { key: "view", label: "Ont consulté un voyage", value: Number(r.view) || 0 },
      { key: "open", label: "Ont ouvert la réservation", value: Number(r.open) || 0 },
      { key: "details", label: "Ont saisi les voyageurs", value: Number(r.details) || 0 },
      { key: "request", label: "Ont envoyé une demande", value: Number(r.request) || 0 },
    ];
  }

  /** Une ligne par jour : visites, voyages consultés, demandes reçues. */
  async daily(p: Period) {
    return this.many<{ day: string; sessions: number; views: number; requests: number; revenue: number }>(
      `WITH ${EVENTS_CTE}, ${RES_CTE},
       days AS (SELECT generate_series(date_trunc('day', $1::timestamptz), date_trunc('day', $2::timestamptz - interval '1 second'), interval '1 day') AS day),
       e AS (SELECT date_trunc('day', created_at) AS day, count(DISTINCT sid) AS sessions,
                    count(*) FILTER (WHERE event = 'view' AND data->>'category' = 'package') AS views
             FROM ev GROUP BY 1),
       r AS (SELECT date_trunc('day', created_at) AS day, count(*) AS requests,
                    COALESCE(sum(total) FILTER (WHERE status IN ${CONFIRMED}), 0) AS revenue
             FROM res GROUP BY 1)
       SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
              COALESCE(e.sessions, 0)::int AS sessions, COALESCE(e.views, 0)::int AS views,
              COALESCE(r.requests, 0)::int AS requests, COALESCE(r.revenue, 0)::float AS revenue
       FROM days LEFT JOIN e ON e.day = days.day LEFT JOIN r ON r.day = days.day
       ORDER BY 1`,
      p,
    );
  }

  /** Provenance des visites (source utm / référent) et ce qu'elle rapporte. */
  async sources(p: Period) {
    return this.many<{ source: string; medium: string; sessions: number; requests: number; conversion: number }>(
      `WITH ${EVENTS_CTE},
       first AS (
         SELECT DISTINCT ON (sid) sid, source, COALESCE(NULLIF(data->>'medium', ''), '') AS medium
         FROM ev ORDER BY sid, created_at
       ),
       converted AS (SELECT DISTINCT sid FROM ev WHERE event = 'payment' OR event = 'booking_step' AND data->>'action' = 'success')
       SELECT source, medium, count(*)::int AS sessions,
              count(converted.sid)::int AS requests,
              CASE WHEN count(*) > 0 THEN count(converted.sid)::float / count(*) ELSE 0 END AS conversion
       FROM first LEFT JOIN converted USING (sid)
       GROUP BY source, medium ORDER BY sessions DESC LIMIT 15`,
      p,
    );
  }

  /** Performance par voyage : vues, réservations ouvertes, demandes, CA. */
  async packages(p: Period) {
    return this.many<{ packageId: string; title: string; views: number; opens: number; requests: number; confirmed: number; revenue: number }>(
      `WITH ${EVENTS_CTE}, ${RES_CTE},
       v AS (SELECT data->>'targetId' AS pid,
                    count(DISTINCT sid) FILTER (WHERE event = 'view') AS views,
                    count(DISTINCT sid) FILTER (WHERE event = 'click' AND data->>'action' = 'reserve') AS opens,
                    max(data->>'label') AS label
             FROM ev WHERE data->>'targetId' IS NOT NULL AND (event = 'view' OR event = 'click')
             GROUP BY 1),
       r AS (SELECT data->>'packageId' AS pid, count(*) AS requests,
                    count(*) FILTER (WHERE status IN ${CONFIRMED}) AS confirmed,
                    COALESCE(sum(total) FILTER (WHERE status IN ${CONFIRMED}), 0) AS revenue,
                    max(data->>'packageTitle') AS title
             FROM res GROUP BY 1)
       SELECT COALESCE(v.pid, r.pid) AS "packageId",
              COALESCE(prod.data->>'title', r.title, v.label, COALESCE(v.pid, r.pid)) AS title,
              COALESCE(v.views, 0)::int AS views, COALESCE(v.opens, 0)::int AS opens,
              COALESCE(r.requests, 0)::int AS requests, COALESCE(r.confirmed, 0)::int AS confirmed,
              COALESCE(r.revenue, 0)::float AS revenue
       FROM v FULL OUTER JOIN r ON r.pid = v.pid
       LEFT JOIN documents prod ON prod.collection = 'products' AND prod.id = COALESCE(v.pid, r.pid)
       ORDER BY revenue DESC, requests DESC, views DESC LIMIT 20`,
      p,
    );
  }

  /** Audience : appareils, langue, Maroc / étranger (fuseau horaire du navigateur). */
  async audience(p: Period) {
    const devices = await this.many<{ key: string; sessions: number; requests: number }>(
      `WITH ${EVENTS_CTE},
       s AS (SELECT sid, (array_agg(COALESCE(data->>'device', 'inconnu') ORDER BY created_at))[1] AS device,
                    bool_or(event = 'payment' OR event = 'booking_step' AND data->>'action' = 'success') AS converted
             FROM ev GROUP BY sid)
       SELECT device AS key, count(*)::int AS sessions, count(*) FILTER (WHERE converted)::int AS requests
       FROM s GROUP BY 1 ORDER BY 2 DESC`,
      p,
    );
    const zones = await this.many<{ key: string; sessions: number }>(
      `WITH ${EVENTS_CTE},
       s AS (SELECT sid, (array_agg(COALESCE(NULLIF(data->>'tz', ''), 'inconnu') ORDER BY created_at))[1] AS tz FROM ev GROUP BY sid)
       SELECT CASE WHEN tz = 'Africa/Casablanca' THEN 'Maroc'
                   WHEN tz = 'inconnu' THEN 'Non renseigné'
                   WHEN tz LIKE 'Europe/%' THEN 'Europe (MRE)'
                   WHEN tz LIKE 'America/%' THEN 'Amériques'
                   WHEN tz LIKE 'Asia/%' THEN 'Golfe & Asie'
                   ELSE 'Autre' END AS key,
              count(*)::int AS sessions
       FROM s GROUP BY 1 ORDER BY 2 DESC`,
      p,
    );
    const langs = await this.many<{ key: string; sessions: number }>(
      `WITH ${EVENTS_CTE},
       s AS (SELECT sid, (array_agg(COALESCE(NULLIF(data->>'lang', ''), 'inconnu') ORDER BY created_at))[1] AS lang FROM ev GROUP BY sid)
       SELECT lang AS key, count(*)::int AS sessions FROM s GROUP BY 1 ORDER BY 2 DESC`,
      p,
    );
    return { devices, zones, langs };
  }

  /** Ce que les visiteurs cherchent, dont les recherches sans résultat. */
  async searches(p: Period) {
    return this.many<{ term: string; count: number; noResult: number }>(
      `WITH ${EVENTS_CTE}
       SELECT lower(trim(data->>'label')) AS term, count(*)::int AS count,
              count(*) FILTER (WHERE (data->>'data') LIKE '%"results":0%')::int AS "noResult"
       FROM ev WHERE event = 'search' AND COALESCE(trim(data->>'label'), '') <> ''
       GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
      p,
    );
  }

  async summary(current: Period, previous: Period) {
    const [kpis, previousKpis, funnel, daily, sources, packages, audience, searches] = await Promise.all([
      this.kpis(current),
      this.kpis(previous),
      this.funnel(current),
      this.daily(current),
      this.sources(current),
      this.packages(current),
      this.audience(current),
      this.searches(current),
    ]);
    return {
      from: current.from.toISOString(),
      to: current.to.toISOString(),
      previousFrom: previous.from.toISOString(),
      kpis,
      previous: previousKpis,
      funnel,
      daily,
      sources,
      packages,
      audience,
      searches,
    };
  }
}
