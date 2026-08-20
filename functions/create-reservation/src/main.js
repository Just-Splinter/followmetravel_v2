import { Client, Databases, ID } from "node-appwrite";

// Appwrite Function id: 6a312ae3000737bbe2ac
// Called by src/context/ReservationContext.jsx's createReservation() for
// every public booking (BookingFlow.jsx, OmraBooking.jsx).
//
// Deploy checklist — read before pushing this version:
//   1. The `reservations` collection needs two NEW attributes this version
//      writes: `clientEstimate` (float) and `priceVerified` (boolean).
//      `userEmail` (string) is already read elsewhere in the app — this
//      version fixes this function to actually populate it, no schema
//      change needed for that one.
//   2. Confirmation email is intentionally NOT sent from here anymore (see
//      bottom of the handler) — it now goes through the
//      reservation_created_client / reservation_created_admin triggers
//      configured in the dashboard (Paramètres → Notifications). Turn that
//      trigger on and pick a template before this goes live, or bookings
//      will go through with zero confirmation email sent to the customer.

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const DB_ID = "6a235cbd002838f30b11";
const RESERVATION_COLLECTION = "reservations";
const EVENTS_COLLECTION = "events";
const PRODUCTS_COLLECTION = "products";

// Canonical room-type vocabulary — MUST stay in sync with
// src/services/roomTypes.js in the main app repo. BookingFlow.jsx computes
// the displayed price client-side with this exact table; computeServerPrice
// below re-derives the same number from the package's own catalog data so
// a reservation's stored total is never taken from the client at face
// value. If a room type is ever added/renamed there, mirror it here too.
const ROOM_TYPES = [
  { label: "Triple", colIdx: 0, paxPerRoom: 3 },
  { label: "Double", colIdx: 1, paxPerRoom: 2 },
  { label: "Single", colIdx: 2, paxPerRoom: 1 },
  { label: "2–5 ans", colIdx: 3, paxPerRoom: 1 },
];

// Mirrors BookingFlow.jsx's DEFAULT_SUPPLEMENTS — used only when a package
// doesn't define its own `suppliments` array.
const DEFAULT_SUPPLEMENTS = [
  { key: "excursions", pricePerPax: 800 },
  { key: "princes", pricePerPax: 350 },
  { key: "bursa", pricePerPax: 250 },
  { key: "shopping", pricePerPax: 200 },
  { key: "bosphore", pricePerPax: 300 },
];

const REQUIRED_FIELDS = ["packageId", "dateFrom", "dateTo", "totalPax", "userId", "userName"];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function parseBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
}

function parseJSON(val, fallback) {
  if (val == null) return fallback;
  if (typeof val !== "string") return val;
  try {
    const parsed = JSON.parse(val);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

const parsePrice = (str) => parseFloat(String(str ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;

/** Every case this rejects on gets a specific message instead of a generic 400/500 further down. */
function validateBody(body) {
  const missing = REQUIRED_FIELDS.filter((f) => body[f] === undefined || body[f] === null || body[f] === "");
  if (missing.length) return `Champs manquants : ${missing.join(", ")}`;
  if (!Number.isFinite(Number(body.totalPax)) || Number(body.totalPax) <= 0) return "totalPax invalide";
  return null;
}

async function verifyCaptcha(token) {
  const verify = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET,
      response: token,
    }),
  });
  return verify.json();
}

function createDbClient(req) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers["x-appwrite-key"] ?? "");

  return { client, databases: new Databases(client) };
}

/**
 * Recomputes the reservation total from the package's own catalog data,
 * mirroring BookingFlow.jsx's pricing exactly:
 *   - per-person mode (no priced rooms on the package): basePrice × pax
 *   - room mode: sum(roomType price × qty × paxPerRoom) across selected
 *     hotels, matched by hotelId within the claimed category
 * plus enabled supplements × total pax either way.
 *
 * Never throws. Returns { total, verified, reason }. `verified: false`
 * means the data shape didn't match anything this function recognizes
 * (unknown room label, category not found, malformed hotels payload) — the
 * booking still goes through (this is a quote request the agency confirms
 * by phone before any payment is taken, never an auto-charge), but the
 * reservation is flagged priceVerified:false so admin knows to check that
 * one by hand instead of trusting the number silently.
 */
function computeServerPrice(pkgData, body) {
  const hotelCategories = pkgData.hotelCategories || [];
  const hasPricedRooms = hotelCategories.some((c) =>
    (c.hotels || []).some((h) => ROOM_TYPES.some((rt) => parsePrice(h.cols?.[rt.colIdx]) > 0))
  );

  const suppList =
    Array.isArray(pkgData.suppliments) && pkgData.suppliments.length
      ? pkgData.suppliments.map((s) => ({ key: s.key || s.label, pricePerPax: Number(s.pricePerPax) || 0 }))
      : DEFAULT_SUPPLEMENTS;
  const suppKeys = Array.isArray(body.supplements) ? body.supplements : [];
  const suppPerPax = suppList.reduce((a, s) => (suppKeys.includes(s.key) ? a + s.pricePerPax : a), 0);

  if (!hasPricedRooms) {
    const ppPrice = Number(pkgData.basePrice) || 0;
    const pax = Number(body.totalPax) || 0;
    return { total: ppPrice * pax + suppPerPax * pax, verified: true };
  }

  const bodyHotels = parseJSON(body.hotels, []);
  if (!Array.isArray(bodyHotels) || !bodyHotels.length) {
    return { total: null, verified: false, reason: "hotels payload vide ou invalide" };
  }

  const category = hotelCategories.find((c) => c.label === body.category);
  if (!category) return { total: null, verified: false, reason: `catégorie "${body.category}" introuvable` };

  let baseTotal = 0;
  let totalPax = 0;
  for (const bh of bodyHotels) {
    const hotel = (category.hotels || []).find((h) => h.hotelId === bh.hotelId);
    if (!hotel) return { total: null, verified: false, reason: `hôtel ${bh.hotelId} absent de la catégorie` };
    for (const line of bh.rooms || []) {
      const rt = ROOM_TYPES.find((r) => r.label === line.type);
      if (!rt) return { total: null, verified: false, reason: `type de chambre "${line.type}" inconnu` };
      const price = parsePrice(hotel.cols?.[rt.colIdx]);
      const pax = (Number(line.qty) || 0) * rt.paxPerRoom;
      baseTotal += price * pax;
      totalPax += pax;
    }
  }

  return { total: baseTotal + suppPerPax * totalPax, verified: true };
}

/**
 * Analytics is a side effect of a successful booking, never allowed to turn
 * a successful booking into a reported failure — catches its own errors
 * instead of letting them bubble into the handler's try/catch.
 */
async function logEventSafe(databases, body, reservation, event) {
  try {
    return await databases.createDocument(DB_ID, EVENTS_COLLECTION, ID.unique(), {
      userId: body.userId,
      sessionId: body.sessionId,
      event: event.event,
      category: event.category,
      action: event.action,
      label: event.label,
      targetId: reservation.$id,
      page: event.page,
      data: JSON.stringify(event.data || {}),
      device: body.device,
      country: body.country || "MA",
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[create-reservation] event logging failed", err);
    return null;
  }
}

function generateRef() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FMT-${y}${m}${d}-${random}`;
}

// ─────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────

export default async ({ req, res }) => {
  try {
    const body = parseBody(req);

    // 1. INPUT VALIDATION
    const validationError = validateBody(body);
    if (validationError) {
      return res.json({ success: false, message: validationError }, 400);
    }

    // 2. TOKEN CHECK
    if (!body.recaptchaToken) {
      return res.json({ success: false, message: "Token manquant" }, 400);
    }
    if (!process.env.RECAPTCHA_SECRET) {
      console.error("[create-reservation] RECAPTCHA_SECRET is not configured");
      return res.json({ success: false, message: "Configuration serveur incomplète" }, 500);
    }

    // 3. CAPTCHA
    const captcha = await verifyCaptcha(body.recaptchaToken);
    if (!captcha.success || captcha.score < 0.5) {
      return res.json({ success: false, message: "Captcha invalide" }, 403);
    }

    // 4. CLIENT INIT
    const { databases } = createDbClient(req);

    // 5. SERVER-SIDE PRICE CHECK — see computeServerPrice's docstring.
    let pkgDoc;
    try {
      pkgDoc = await databases.getDocument(DB_ID, PRODUCTS_COLLECTION, body.packageId);
    } catch {
      return res.json({ success: false, message: "Package introuvable" }, 404);
    }
    const pkgData = parseJSON(pkgDoc.data, {});
    const priceCheck = computeServerPrice(pkgData, body);
    if (!priceCheck.verified) {
      console.error(`[create-reservation] price unverified: ${priceCheck.reason}`);
    }
    const totalEstimate = priceCheck.verified ? priceCheck.total : Number(body.totalEstimate) || 0;

    // 6. CREATE RESERVATION
    // status is always "pending" here — never taken from the client. This
    // is the only place a public reservation gets created; every later
    // status transition (confirmed/paid/cancelled/completed) goes through
    // the admin dashboard's own update path, not this function.
    const reservation = await databases.createDocument(DB_ID, RESERVATION_COLLECTION, ID.unique(), {
      packageId: body.packageId,
      packageTitle: body.packageTitle,
      hotels: body.hotels,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      totalPax: body.totalPax,
      participants: body.participants,
      supplements: body.supplements,
      totalEstimate,
      clientEstimate: Number(body.totalEstimate) || 0,
      priceVerified: priceCheck.verified,
      userId: body.userId,
      userEmail: body.userEmail,
      userName: body.userName,
      status: "pending",
      ref: generateRef(),
    });

    // 7. EVENTS (best-effort — see logEventSafe)
    const createdEvent = await logEventSafe(databases, body, reservation, {
      event: "reservation_created",
      category: "reservation",
      action: "create",
      label: body.packageTitle,
      page: "/reservation/confirm",
      data: { packageId: body.packageId, totalEstimate },
    });

    // 8. RESPONSE — no email sent from here, see the deploy checklist
    // comment at the top of this file.
    return res.json({
      success: true,
      reservation,
      events: createdEvent ? [createdEvent.$id] : [],
    });
  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: "Erreur serveur" }, 500);
  }
};
