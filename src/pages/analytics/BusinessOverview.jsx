import { useEffect, useMemo, useState } from "react";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Globe2, Info, Mail, MessageCircle, Phone, Search,
  ShoppingBag, Smartphone, Target, TrendingDown, Users, Wallet, Inbox, Clock,
} from "lucide-react";
import { request } from "../../services/api";
import { buildInsights, change, periodFor } from "../../services/analyticsInsights";
import "./BusinessOverview.css";
import { useDetailModal } from "../../services/detailModal";

const nf = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const money = (n) => `${nf(n)} DH`;
const pct = (x, digits = 0) => (x === null || x === undefined ? "—" : `${(x * 100).toFixed(digits)} %`);

function Delta({ current, previous, invert = false }) {
  const d = change(current, previous);
  if (d === null || !Number.isFinite(d)) return <span className="bo-delta muted" title="Pas de données sur la période précédente">nouveau</span>;
  const good = invert ? d < 0 : d > 0;
  const Icon = d >= 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`bo-delta ${Math.abs(d) < 0.005 ? "muted" : good ? "good" : "bad"}`} title={`Période précédente : ${nf(previous)}`}>
      <Icon size={11} /> {d >= 0 ? "+" : ""}{Math.round(d * 100)} %
    </span>
  );
}

function Kpi({ icon: Icon, label, value, hint, current, previous, color }) {
  return (
    <div className="bo-kpi" style={{ "--c": color }}>
      <div className="bo-kpi-top">
        <span className="bo-kpi-icon"><Icon size={17} /></span>
        {current !== undefined && <Delta current={current} previous={previous} />}
      </div>
      <div className="bo-kpi-value">{value}</div>
      <div className="bo-kpi-label">{label}</div>
      {hint && <div className="bo-kpi-hint">{hint}</div>}
    </div>
  );
}

function Card({ title, sub, children, className = "" }) {
  return (
    <section className={`bo-card ${className}`}>
      <header>
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
      </header>
      {children}
    </section>
  );
}

const LEVEL_ICON = { good: CheckCircle2, warn: AlertTriangle, bad: TrendingDown, info: Info };

/**
 * Vue business du tableau de bord Analytics : ce que le site rapporte
 * (demandes, réservations, CA), d'où viennent les clients et où ils
 * décrochent — calculé côté serveur sur toute la période, comparé à la
 * période précédente, sans le trafic de l'équipe.
 */
export default function BusinessOverview({ days, rangeLabel }) {
  const { openPackage } = useDetailModal();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const { from, to } = periodFor(days);
    request("GET", "/v1/analytics/summary", { query: { from, to } })
      .then((d) => {
        if (!alive) return;
        setError(null);
        setData(d);
      })
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [days]);

  const insights = useMemo(() => buildInsights(data), [data]);

  if (error) return <div className="bo-error">Impossible de charger la vue business : {error.message}</div>;
  if (!data) return <div className="bo-loading"><span className="an-spinner" /> Calcul des indicateurs…</div>;

  const k = data.kpis;
  const p = data.previous;
  const contacts = k.contacts.whatsapp + k.contacts.phone + k.contacts.email + k.contacts.forms;
  const contactsPrev = p.contacts.whatsapp + p.contacts.phone + p.contacts.email + p.contacts.forms;
  const funnelMax = data.funnel[0]?.value || 1;
  const chart = data.daily.map((d) => ({ ...d, label: new Date(`${d.day}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) }));

  return (
    <div className="bo-root">
      <p className="bo-period">
        {rangeLabel} — comparé à la période précédente de même durée. Trafic de l'équipe exclu ; demandes et chiffre d'affaires lus dans les réservations.
      </p>

      <div className="bo-kpis">
        <Kpi icon={Users} color="#7c3aed" label="Visites" value={nf(k.sessions)} current={k.sessions} previous={p.sessions}
          hint={`${pct(k.mobileShare)} sur mobile · ${nf(k.identified)} clients connectés`} />
        <Kpi icon={Inbox} color="#ff750e" label="Demandes de réservation" value={nf(k.requests)} current={k.requests} previous={p.requests}
          hint={`${nf(k.onlineRequests)} en ligne · ${nf(k.requests - k.onlineRequests)} saisies par l'agence · ${money(k.requestedValue)}`} />
        <Kpi icon={Target} color="#2563eb" label="Taux de conversion" value={pct(k.conversion, 1)} current={k.conversion ?? 0} previous={p.conversion ?? 0}
          hint={`${nf(k.webConversions)} visites sur ${nf(k.sessions)} ont envoyé une demande en ligne`} />
        <Kpi icon={CheckCircle2} color="#16a34a" label="Réservations confirmées" value={nf(k.confirmed)} current={k.confirmed} previous={p.confirmed}
          hint={`${pct(k.confirmationRate)} des demandes confirmées`} />
        <Kpi icon={Wallet} color="#0891b2" label="Chiffre d'affaires confirmé" value={money(k.revenue)} current={k.revenue} previous={p.revenue}
          hint={k.confirmed ? `Panier moyen ${money(k.avgBasket)}` : "Aucune confirmation sur la période"} />
        <Kpi icon={MessageCircle} color="#25d366" label="Contacts directs" value={nf(contacts)} current={contacts} previous={contactsPrev}
          hint="WhatsApp, téléphone, email, formulaire" />
      </div>

      {insights.length > 0 && (
        <Card title="À retenir" sub="Constats calculés automatiquement à partir des chiffres de la période.">
          <ul className="bo-insights">
            {insights.map((i) => {
              const Icon = LEVEL_ICON[i.level];
              return <li key={i.text} className={i.level}><Icon size={16} /> <span>{i.text}</span></li>;
            })}
          </ul>
        </Card>
      )}

      <div className="bo-grid">
        <Card title="Parcours de réservation" sub="Visiteurs atteignant chaque étape (sessions) — la barre rouge montre où ils décrochent.">
          <div className="bo-funnel">
            {data.funnel.map((s, i) => {
              const prev = data.funnel[i - 1];
              const kept = prev?.value ? s.value / prev.value : null;
              return (
                <div key={s.key} className="bo-funnel-row">
                  <div className="bo-funnel-label">
                    <span>{s.label}</span>
                    <strong>{nf(s.value)}</strong>
                  </div>
                  <div className="bo-funnel-bar"><span style={{ width: `${Math.max(2, (s.value / funnelMax) * 100)}%` }} /></div>
                  {kept !== null && (
                    <div className={`bo-funnel-step ${kept < 0.3 ? "bad" : kept < 0.6 ? "warn" : ""}`}>
                      {pct(kept)} passent à cette étape · {nf(Math.max(0, prev.value - s.value))} perdus
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Évolution" sub="Visites (barres) et demandes de réservation (ligne) par jour.">
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} minTickGap={14} />
                <YAxis yAxisId="s" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "#ff750e" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="s" dataKey="sessions" name="Visites" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" dataKey="requests" name="Demandes" stroke="#ff750e" strokeWidth={2.5} dot={{ r: 3 }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Performance des voyages" sub="De la consultation à la vente. « À travailler » : beaucoup vu, rien demandé.">
        {data.packages.length === 0 ? <p className="bo-empty">Aucune donnée sur la période.</p> : (
          <div className="bo-table-wrap">
            <table className="bo-table">
              <thead>
                <tr><th>Voyage</th><th>Visiteurs</th><th>Ouvrent la réservation</th><th>Demandes</th><th>Taux vue → demande</th><th>Confirmées</th><th>CA confirmé</th></tr>
              </thead>
              <tbody>
                {data.packages.map((x) => {
                  const rate = x.views ? x.requests / x.views : null;
                  return (
                    <tr key={x.packageId} className="is-clickable" onClick={() => openPackage(x.packageId)}>
                      <td>
                        <button className="adm-link" onClick={(e) => { e.stopPropagation(); openPackage(x.packageId); }}>{x.title}</button>
                        {x.views >= 15 && x.requests === 0 && <span className="bo-tag warn">À travailler</span>}
                      </td>
                      <td>{nf(x.views)}</td>
                      <td>{nf(x.opens)}</td>
                      <td>{nf(x.requests)}</td>
                      <td>{rate === null ? "—" : pct(rate, 1)}</td>
                      <td>{nf(x.confirmed)}</td>
                      <td><strong>{money(x.revenue)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="bo-grid">
        <Card title="Provenance des visites" sub="Premier contact de chaque visite (liens utm, Facebook, Google, sites référents).">
          {data.sources.length === 0 ? <p className="bo-empty">Aucune donnée.</p> : (
            <table className="bo-table compact">
              <thead><tr><th>Source</th><th>Visites</th><th>Demandes</th><th>Conversion</th></tr></thead>
              <tbody>
                {data.sources.map((s) => (
                  <tr key={`${s.source}-${s.medium}`}>
                    <td><strong>{s.source}</strong>{s.medium && <span className="bo-muted"> · {s.medium}</span>}</td>
                    <td>{nf(s.sessions)}</td>
                    <td>{nf(s.requests)}</td>
                    <td>{pct(s.conversion, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="bo-note">Astuce : ajoutez <code>?utm_source=facebook&amp;utm_campaign=bali-ete</code> aux liens de vos publicités pour comparer les campagnes.</p>
        </Card>

        <Card title="Contacts directs" sub="Clics vers WhatsApp, téléphone, email, et formulaires envoyés.">
          <div className="bo-contacts">
            {[
              [MessageCircle, "WhatsApp", k.contacts.whatsapp, p.contacts.whatsapp, "#25d366"],
              [Phone, "Téléphone", k.contacts.phone, p.contacts.phone, "#2563eb"],
              [Mail, "Email", k.contacts.email, p.contacts.email, "#7c3aed"],
              [Inbox, "Formulaire de contact", k.contacts.forms, p.contacts.forms, "#ff750e"],
              [ShoppingBag, "Inscriptions newsletter", k.contacts.newsletter, p.contacts.newsletter, "#0891b2"],
            ].map(([Icon, label, v, prev, color]) => (
              <div key={label} className="bo-contact">
                <span className="bo-contact-icon" style={{ background: `${color}18`, color }}><Icon size={16} /></span>
                <span className="bo-contact-label">{label}</span>
                <strong>{nf(v)}</strong>
                <Delta current={v} previous={prev} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="bo-grid three">
        <Card title="Appareils" sub="Visites et taux de demande par appareil.">
          {data.audience.devices.map((d) => (
            <div key={d.key} className="bo-split">
              <span><Smartphone size={13} /> {({ mobile: "Mobile", desktop: "Ordinateur", tablet: "Tablette" })[d.key] || d.key}</span>
              <strong>{nf(d.sessions)}</strong>
              <span className="bo-muted">{pct(d.sessions ? d.requests / d.sessions : 0, 1)} de demandes</span>
            </div>
          ))}
        </Card>
        <Card title="D'où se connectent-ils ?" sub="D'après le fuseau horaire du navigateur.">
          {data.audience.zones.map((z) => (
            <div key={z.key} className="bo-split">
              <span><Globe2 size={13} /> {z.key}</span>
              <strong>{nf(z.sessions)}</strong>
              <span className="bo-muted">{pct(k.sessions ? z.sessions / k.sessions : 0)}</span>
            </div>
          ))}
          <div className="bo-split muted-top">
            <span><Clock size={13} /> Réservation avant départ</span>
            <strong>{k.leadDays ? `${k.leadDays} j` : "—"}</strong>
            <span className="bo-muted">en moyenne</span>
          </div>
        </Card>
        <Card title="Ce qu'ils cherchent" sub="Recherches et filtres — en rouge, sans résultat.">
          {data.searches.length === 0 ? <p className="bo-empty">Aucune recherche.</p> : data.searches.map((s) => (
            <div key={s.term} className={`bo-split ${s.noResult ? "bad" : ""}`}>
              <span><Search size={13} /> {s.term}</span>
              <strong>{nf(s.count)}</strong>
              <span className="bo-muted">{s.noResult ? `${s.noResult} sans résultat` : ""}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
