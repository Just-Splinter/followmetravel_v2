// Test de bout en bout de l'API (auth, permissions, requêtes, fichiers,
// réservations). Crée ses propres données de test, préfixées "smoke-".
//
//   node scripts/smoke.mjs <API_URL> <adminEmail> <adminPassword> <userEmail> <userPassword>
//
// Les deux comptes doivent exister (dist/cli/create-user.js), l'admin avec --admin.
// Ne pas lancer sur la production une fois les vraies données migrées : le
// script crée et supprime des documents.

const [API, ADMIN_EMAIL, ADMIN_PASSWORD, USER_EMAIL, USER_PASSWORD] = process.argv.slice(2);
if (!USER_PASSWORD) {
  console.error("usage: node scripts/smoke.mjs <API_URL> <adminEmail> <adminPassword> <userEmail> <userPassword>");
  process.exit(1);
}

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
};

/** Client minimal qui garde son cookie de session, comme un navigateur. */
function client() {
  let cookie = "";
  return async (method, path, body, { header = true, raw = false } = {}) => {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (header) headers["X-Fmt-Client"] = "web";
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(API + path, { method, headers, body: payload, redirect: "manual" });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.startsWith("fmt_session=")) cookie = pair.endsWith("=") ? "" : pair;
    }
    if (raw) return res;
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  };
}

const Q = (method, attribute, values) =>
  JSON.stringify({ method, ...(attribute ? { attribute } : {}), ...(values ? { values } : {}) });
const qs = (...queries) => "?" + queries.map((q) => `queries=${encodeURIComponent(q)}`).join("&");

const anon = client();
const admin = client();
const user = client();

// ── Auth ─────────────────────────────────────────────────────────
check("health", (await anon("GET", "/health")).status === 200);
check("account anonyme → 401", (await anon("GET", "/v1/account")).status === 401);
check(
  "écriture sans X-Fmt-Client → 403 (anti-CSRF)",
  (await anon("POST", "/v1/account/sessions/email", { email: "x", password: "y" }, { header: false })).status === 403,
);
const bad = await admin("POST", "/v1/account/sessions/email", { email: ADMIN_EMAIL, password: "mauvais-mdp" });
check("mauvais mot de passe → 401 user_invalid_credentials", bad.status === 401 && bad.body?.type === "user_invalid_credentials");
check("login admin", (await admin("POST", "/v1/account/sessions/email", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).status === 201);
check("login client", (await user("POST", "/v1/account/sessions/email", { email: USER_EMAIL, password: USER_PASSWORD })).status === 201);
const me = await admin("GET", "/v1/account");
check("account admin au format Appwrite ($id, labels)", me.status === 200 && me.body.$id && me.body.labels.includes("admin"));
const userMe = (await user("GET", "/v1/account")).body;

// ── Catalogue public ─────────────────────────────────────────────
const product = await admin("POST", "/v1/collections/products/documents", {
  documentId: "unique()",
  data: {
    title: "smoke-package",
    status: "draft",
    basePrice: 900,
    data: JSON.stringify({ basePrice: 900 }),
  },
});
check("admin crée un produit", product.status === 201 && product.body.$id && product.body.$createdAt, JSON.stringify(product.body));
const pid = product.body.$id;
// Vue publique : un brouillon n'existe pas pour un visiteur ni pour un client.
check("brouillon : anonyme → 404", (await anon("GET", `/v1/collections/products/documents/${pid}`)).status === 404);
check("brouillon : client → 404", (await user("GET", `/v1/collections/products/documents/${pid}`)).status === 404);
check("brouillon : admin le lit", (await admin("GET", `/v1/collections/products/documents/${pid}`)).body?.title === "smoke-package");
const anonList = await anon("GET", `/v1/collections/products/documents${qs(Q("limit", null, [5000]))}`);
check(
  "liste publique : ni brouillon ni réglages email",
  anonList.status === 200 && !anonList.body.documents.some((d) => d.$id === pid || String(d.data).includes('"kind":"email-settings"')),
);
check("liste publique : réglages du site (agence) toujours lisibles", anonList.body?.documents?.some((d) => String(d.data).includes('"kind":"agency"')));
const anonDest = await anon("GET", "/v1/collections/destinations/documents");
check("destinations : brouillons cachés aux visiteurs", anonDest.status === 200 && anonDest.body.documents.every((d) => d.status !== "draft"));
await admin("PATCH", `/v1/collections/products/documents/${pid}`, { data: { status: "active" } });
check("lecture publique d'un produit publié", (await anon("GET", `/v1/collections/products/documents/${pid}`)).body?.title === "smoke-package");
check("anonyme ne crée pas de produit → 401", (await anon("POST", "/v1/collections/products/documents", { data: {} })).status === 401);
check("client ne crée pas de produit → 403", (await user("POST", "/v1/collections/products/documents", { data: {} })).status === 403);
const upd = await admin("PATCH", `/v1/collections/products/documents/${pid}`, { data: { $id: "ignoré", subtitle: "s" } });
check("mise à jour partielle (fusion, $-champs ignorés)", upd.body?.title === "smoke-package" && upd.body?.subtitle === "s");
check("collection inconnue → 404", (await admin("GET", "/v1/collections/nope/documents")).status === 404);

// ── Requêtes / pagination ────────────────────────────────────────
const ids = [];
for (const n of [1, 2, 3]) {
  const c = await admin("POST", "/v1/collections/clients/documents", { data: { name: `smoke-${n}`, rank: n } });
  ids.push(c.body.$id);
}
const page1 = await admin(
  "GET",
  "/v1/collections/clients/documents" + qs(Q("search", "name", ["smoke-"]), Q("orderDesc", "rank"), Q("limit", null, [2])),
);
check("search + orderDesc + limit", page1.body?.documents?.map((d) => d.rank).join() === "3,2" && page1.body.total === 3, JSON.stringify(page1.body));
const page2 = await admin(
  "GET",
  "/v1/collections/clients/documents" +
    qs(Q("search", "name", ["smoke-"]), Q("orderDesc", "rank"), Q("limit", null, [2]), Q("cursorAfter", null, [page1.body.documents[1].$id])),
);
check("cursorAfter", page2.body?.documents?.map((d) => d.rank).join() === "1", JSON.stringify(page2.body));
const eq = await admin("GET", "/v1/collections/clients/documents" + qs(Q("equal", "rank", [2])));
check("equal sur un nombre", eq.body?.documents?.length === 1 && eq.body.documents[0].rank === 2);
check("clients : client non admin → 403", (await user("GET", "/v1/collections/clients/documents")).status === 403);

// ── Réservations : isolation par propriétaire ────────────────────
const mine = await admin("POST", "/v1/collections/reservations/documents", {
  data: { userId: userMe.$id, userEmail: USER_EMAIL, status: "pending", ref: "smoke-mine" },
});
const other = await admin("POST", "/v1/collections/reservations/documents", {
  data: { userId: "quelqu-un-d-autre", status: "pending", ref: "smoke-other" },
});
const listed = await user(
  "GET",
  "/v1/collections/reservations/documents" + qs(Q("equal", "userId", ["quelqu-un-d-autre"])),
);
check("client : filtre forcé sur ses réservations", listed.status === 200 && listed.body.documents.every((d) => d.userId === userMe.$id));
check("client : réservation d'un autre → 404", (await user("GET", `/v1/collections/reservations/documents/${other.body.$id}`)).status === 404);
check(
  "client : passer sa réservation en paid → 403",
  (await user("PATCH", `/v1/collections/reservations/documents/${mine.body.$id}`, { data: { status: "paid" } })).status === 403,
);
const cancelled = await user("PATCH", `/v1/collections/reservations/documents/${mine.body.$id}`, {
  data: { status: "cancelled", cancelledAt: new Date().toISOString() },
});
check("client : annuler sa réservation", cancelled.status === 200 && cancelled.body.status === "cancelled");
const trig = await user("POST", "/v1/emails/trigger", { triggerKey: "reservation_confirmed", reservationId: mine.body.$id });
check("client : déclencheur email autre qu'annulation → 403", trig.status === 403);
const trigOk = await user("POST", "/v1/emails/trigger", { triggerKey: "reservation_cancelled", reservationId: mine.body.$id });
// 201 (envoyé ou déclencheur désactivé) ou 503 (SMTP pas encore configuré) : la permission est accordée.
check("client : email d'annulation de sa réservation accepté", trigOk.status === 201 || trigOk.body?.type === "general_smtp_disabled", JSON.stringify(trigOk.body));
const count = await admin("GET", "/v1/collections/reservations/documents" + qs(Q("equal", "status", ["pending"]), Q("limit", null, [1])));
check("admin : count (total) des réservations pending", count.status === 200 && count.body.total >= 1);

// ── Hôtels : seul bookedSnapshot est modifiable par un client ────
const hotel = await admin("POST", "/v1/collections/hotels/documents", { data: { name: "smoke-hotel" } });
check(
  "client : met à jour bookedSnapshot",
  (await user("PATCH", `/v1/collections/hotels/documents/${hotel.body.$id}`, { data: { bookedSnapshot: "{}" } })).status === 200,
);
check(
  "client : ne renomme pas l'hôtel → 403",
  (await user("PATCH", `/v1/collections/hotels/documents/${hotel.body.$id}`, { data: { name: "pirate" } })).status === 403,
);

// ── Analytics ────────────────────────────────────────────────────
const ev = await anon("POST", "/v1/collections/events/documents", { data: { event: "smoke", createdAt: new Date().toISOString() } });
check("événement anonyme accepté", ev.status === 201);
check("lecture des événements : anonyme → 401", (await anon("GET", "/v1/collections/events/documents")).status === 401);

// ── Réservation publique (captcha désactivable en local) ─────────
const pub = await user("POST", "/v1/reservations", {
  packageId: pid,
  packageTitle: "smoke-package",
  dateFrom: "2026-11-01",
  dateTo: "2026-11-08",
  totalPax: 2,
  totalEstimate: 1,
  supplements: [],
  recaptchaToken: "local",
});
check(
  "POST /v1/reservations : prix recalculé serveur, identité de la session",
  pub.status === 201 && pub.body.reservation?.totalEstimate === 1800 && pub.body.reservation.userId === userMe.$id,
  JSON.stringify(pub.body),
);
check("POST /v1/reservations anonyme → 401", (await anon("POST", "/v1/reservations", { packageId: pid })).status === 401);

// ── Fichiers ─────────────────────────────────────────────────────
// PNG 1×1 transparent.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const form = () => {
  const f = new FormData();
  f.append("fileId", "unique()");
  f.append("file", new Blob([png], { type: "image/png" }), "smoke.png");
  return f;
};
check("client : upload → 403", (await user("POST", "/v1/storage/files", form())).status === 403);
const up = await admin("POST", "/v1/storage/files", form());
check("admin : upload", up.status === 201 && up.body.$id && up.body.url, JSON.stringify(up.body));
if (up.body?.url) {
  const img = await fetch(up.body.url);
  check("image lisible publiquement via MinIO", img.status === 200 && img.headers.get("content-type") === "image/png");
}
const bad2 = new FormData();
bad2.append("file", new Blob(["<svg/>"], { type: "image/svg+xml" }), "x.svg");
check("upload SVG refusé", (await admin("POST", "/v1/storage/files", bad2)).status === 400);
check("admin : suppression du fichier", (await admin("DELETE", `/v1/storage/files/${up.body.$id}`)).status === 204);

// ── Prefs ────────────────────────────────────────────────────────
await user("PATCH", "/v1/account/prefs", { prefs: { favorites: ["a", "b"] } });
check("prefs (favoris)", (await user("GET", "/v1/account/prefs")).body?.favorites?.join() === "a,b");

// ── Récupération de mot de passe ─────────────────────────────────
check(
  "récupération : URL hors origines autorisées → 400",
  (await anon("POST", "/v1/account/recovery", { email: USER_EMAIL, url: "https://evil.example/r" })).status === 400,
);
const rec = await anon("POST", "/v1/account/recovery", { email: "inconnu@example.com", url: "http://localhost:5173/auth/recovery" });
check("récupération : même réponse pour un compte inconnu", rec.status === 201);

// ── Équipe : rôles conseiller / comptable ────────────────────────
const tag = Math.random().toString(36).slice(2, 8);
const staffPassword = `Smoke-${tag}-pass`;
const mkStaff = async (role) => {
  const res = await admin("POST", "/v1/users", { email: `smoke-${role}-${tag}@followmetravel.invalid`, name: `Smoke ${role}`, password: staffPassword, roles: [role] });
  const c = client();
  await c("POST", "/v1/account/sessions/email", { email: res.body.email, password: staffPassword });
  return { id: res.body.$id, c };
};
check("utilisateurs : création réservée à l'admin", (await user("POST", "/v1/users", { email: "x@y.ma", password: "12345678", roles: ["admin"] })).status === 403);
const agentAcc = await mkStaff("agent");
const comptaAcc = await mkStaff("accounting");
check("conseiller : lit toutes les réservations", (await agentAcc.c("GET", `/v1/collections/reservations/documents/${other.body.$id}`)).status === 200);
check("conseiller : ne supprime pas une réservation", (await agentAcc.c("DELETE", `/v1/collections/reservations/documents/${other.body.$id}`)).status === 403);
check("comptable : ne modifie pas le catalogue", (await comptaAcc.c("PATCH", `/v1/collections/products/documents/${pid}`, { data: { title: "x" } })).status === 403);
check("comptable : liste de l'équipe accessible", (await comptaAcc.c("GET", "/v1/users")).status === 200);
check("comptable : tous les comptes (scope=all) → 403", (await comptaAcc.c("GET", "/v1/users?scope=all")).status === 403);

// ── Champs internes, voyageurs, documents, historique ────────────
const own = await admin("POST", "/v1/collections/reservations/documents", {
  data: { userId: userMe.$id, userEmail: USER_EMAIL, userName: "Client", status: "confirmed", ref: "smoke-own", packageId: pid,
    packageTitle: "smoke-package", totalPax: 2, totalEstimate: 1800, dateFrom: "01/11", dateTo: "08/11",
    costs: JSON.stringify([{ amount: 900 }]), internalNotes: "interne", assignedTo: agentAcc.id,
    participants: JSON.stringify([{ fullName: "Client" }]), payments: JSON.stringify([{ id: "p1", amount: 500, date: "2026-10-01", method: "cash" }]) },
});
check("dates de voyage figées à la création (travelStart)", /^\d{4}-11-01$/.test(own.body.travelStart ?? ""), JSON.stringify(own.body.travelStart));
const seen = (await user("GET", `/v1/collections/reservations/documents/${own.body.$id}`)).body;
check("client : coûts, notes internes et conseiller masqués", seen && !("costs" in seen) && !("internalNotes" in seen) && !("assignedTo" in seen));
check(
  "client : complète ses voyageurs (passeports)",
  (await user("PATCH", `/v1/collections/reservations/documents/${own.body.$id}`, { data: { participants: JSON.stringify([{ fullName: "Client", passportNumber: "AB1" }, { fullName: "Second" }]) } })).status === 200,
);
check(
  "client : ne modifie pas ses coûts",
  (await user("PATCH", `/v1/collections/reservations/documents/${own.body.$id}`, { data: { costs: "[]" } })).status === 403,
);
const fin = await user("GET", `/v1/reservations/${own.body.$id}/finance`);
check("client : son échéancier, sans les coûts", fin.status === 200 && fin.body.paid === 500 && !("costs" in fin.body) && fin.body.installments.length > 0, JSON.stringify(fin.body));
check("équipe : finance avec marge", (await agentAcc.c("GET", `/v1/reservations/${own.body.$id}/finance`)).body?.margin === 900);
const pdf = await user("GET", `/v1/reservations/${own.body.$id}/documents/devis`, undefined, { raw: true });
check("client : télécharge son devis (PDF)", pdf.status === 200 && pdf.headers.get("content-type") === "application/pdf");
// Documents remis au client : fiche de réservation, facture (proforma avant émission) et CGV.
for (const type of ["reservation", "facture", "cgv"]) {
  const doc = await user("GET", `/v1/reservations/${own.body.$id}/documents/${type}`, undefined, { raw: true });
  check(`client : télécharge ${type} (PDF)`, doc.status === 200 && doc.headers.get("content-type") === "application/pdf");
}
check("conseiller : ne valide pas à la place du client", (await agentAcc.c("POST", `/v1/reservations/${own.body.$id}/validate`)).status === 403);
const validated = await user("POST", `/v1/reservations/${own.body.$id}/validate`);
check("client : valide sa fiche de réservation", validated.status === 201 && !!validated.body?.clientValidatedAt, JSON.stringify(validated.body));
check("client : validation non modifiable par mise à jour directe", (await user("PATCH", `/v1/collections/reservations/documents/${own.body.$id}`, { data: { clientValidatedAt: null } })).status === 403);
const xlsx = await admin("GET", `/v1/planning/export?from=2020-01-01&to=2030-12-31`, undefined, { raw: true });
check("équipe : planning Excel", xlsx.status === 200 && /spreadsheetml/.test(xlsx.headers.get("content-type") || ""));
check("client : pas de planning Excel", (await user("GET", "/v1/planning/export")).status === 403);
check("client : document d'un autre dossier → 404", (await user("GET", `/v1/reservations/${other.body.$id}/documents/devis`)).status === 404);
check("conseiller : n'émet pas de facture", (await agentAcc.c("POST", `/v1/reservations/${own.body.$id}/invoice`)).status === 403);
const inv = await comptaAcc.c("POST", `/v1/reservations/${own.body.$id}/invoice`);
check("comptable : émet la facture (numéro continu)", inv.status === 201 && /^F\d{4}-\d{4}$/.test(inv.body.invoiceNumber ?? ""), JSON.stringify(inv.body));
check("client : facture émise téléchargeable", (await user("GET", `/v1/reservations/${own.body.$id}/documents/facture`, undefined, { raw: true })).status === 200);
check("conseiller : note interne", (await agentAcc.c("POST", "/v1/audit/notes", { collection: "reservations", documentId: own.body.$id, message: "Client rappelé" })).status === 201);
const history = await agentAcc.c("GET", `/v1/audit?collection=reservations&documentId=${own.body.$id}`);
check("historique du dossier (création, modification, note)", ["create", "update", "note"].every((a) => history.body?.entries?.some((e) => e.action === a)), JSON.stringify(history.body?.entries?.map((e) => e.action)));
check("journal complet : réservé à l'admin", (await agentAcc.c("GET", "/v1/audit")).status === 403);

// ── Places par départ ────────────────────────────────────────────
const capPkg = await admin("POST", "/v1/collections/products/documents", {
  data: { title: "smoke-capacity", status: "published", basePrice: 1000,
    data: JSON.stringify({ basePrice: 1000, departureDates: [{ id: 1, from: "10/12", to: "17/12", capacity: 3, supplement: 200 }, { id: 2, from: "20/12", to: "27/12", closed: true }] }) },
});
const avail = await anon("GET", `/v1/packages/${capPkg.body.$id}/availability`);
check("disponibilité publique par départ", avail.status === 200 && avail.body.departures[0].remaining === 3 && avail.body.departures[1].closed === true);
const book = (pax, from, to) => user("POST", "/v1/reservations", { packageId: capPkg.body.$id, packageTitle: "smoke-capacity", dateFrom: from, dateTo: to, totalPax: pax, recaptchaToken: "local" });
const b1 = await book(2, "10/12", "17/12");
check("réservation : supplément de départ ajouté (2 × (1000 + 200))", b1.status === 201 && b1.body.reservation?.totalEstimate === 2400, JSON.stringify(b1.body));
const b2 = await book(2, "10/12", "17/12");
check("réservation : plus assez de places → 409", b2.status === 409 && b2.body?.type === "departure_full", JSON.stringify(b2.body));
check("réservation : départ fermé → 409", (await book(1, "20/12", "27/12")).body?.type === "departure_closed");

// ── Nettoyage + logout ───────────────────────────────────────────
await admin("PATCH", `/v1/users/${agentAcc.id}`, { status: false });
await admin("PATCH", `/v1/users/${comptaAcc.id}`, { status: false });
check("compte désactivé : session coupée", (await agentAcc.c("GET", "/v1/account")).status === 401);
check("suppression de compte : réservée à l'admin", (await user("DELETE", `/v1/users/${comptaAcc.id}`)).status === 403);
check("suppression de son propre compte refusée", (await admin("DELETE", `/v1/users/${me.body.$id}`)).status === 400);
const delAgent = await admin("DELETE", `/v1/users/${agentAcc.id}`);
check("suppression d'un compte : dossiers désassignés", delAgent.status === 200 && delAgent.body.unassigned >= 1, JSON.stringify(delAgent.body));
check("compte supprimé : introuvable", (await admin("PATCH", `/v1/users/${agentAcc.id}`, { name: "x" })).status === 404);
await admin("DELETE", `/v1/users/${comptaAcc.id}`);
for (const [c, id] of [
  ["reservations", own.body.$id],
  ["reservations", b1.body.reservation?.$id],
  ["products", capPkg.body.$id],
  ["products", pid],
  ["hotels", hotel.body.$id],
  ["reservations", mine.body.$id],
  ["reservations", other.body.$id],
  ["reservations", pub.body.reservation?.$id],
  ["events", ev.body?.$id],
  ...ids.map((id) => ["clients", id]),
]) {
  if (id) await admin("DELETE", `/v1/collections/${c}/documents/${id}`);
}
check("logout", (await user("DELETE", "/v1/account/sessions/current")).status === 204);
check("après logout → 401", (await user("GET", "/v1/account")).status === 401);

console.log(failures ? `\n${failures} échec(s)` : "\ntout est ok");
process.exit(failures ? 1 : 0);
