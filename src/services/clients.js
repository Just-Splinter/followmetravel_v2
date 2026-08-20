// Merges two sources into one client list for ClientsManager.jsx:
//   - real records from the `clients` collection (prospects, walk-ins noted
//     before any booking — see ClientsContext.jsx)
//   - clients implicit in `reservations` (every reservation predates this
//     collection existing, and a customer can still book without ever being
//     explicitly "added" as a client)
// There's no foreign key between the two — reservations don't carry a
// clientId — so they're joined by normalized email, the one field both
// sides reliably share. A reservation with no email (an admin-created one
// where the field was left blank) falls back to userId, then its own id,
// so it still shows up as its own row instead of silently merging into the
// wrong client.

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

const parseJSON = (raw, fallback = []) => {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
};

export function mergeClients(clientDocs, reservations) {
  const map = new Map();

  for (const c of clientDocs || []) {
    const emailKey = normalizeEmail(c.email);
    const key = emailKey || `client:${c.$id}`;
    map.set(key, {
      key,
      clientId: c.$id,
      userId: "",
      userEmail: c.email || "",
      userName: c.name || "—",
      phone: c.phone || "",
      notes: c.notes || "",
      reservations: [],
    });
  }

  for (const r of reservations || []) {
    const emailKey = normalizeEmail(r.userEmail);
    const key = emailKey || r.userId || `res:${r.$id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        clientId: null,
        userId: r.userId || "",
        userEmail: r.userEmail || "",
        userName: r.userName || "—",
        phone: "",
        notes: "",
        reservations: [],
      });
    }
    const c = map.get(key);
    if (!c.phone) {
      const phone = parseJSON(r.participants, [])[0]?.phone;
      if (phone) c.phone = phone;
    }
    if (!c.userId && r.userId) c.userId = r.userId;
    if ((!c.userName || c.userName === "—") && r.userName) c.userName = r.userName;
    c.reservations.push(r);
  }

  return [...map.values()].map((c) => {
    const active = c.reservations.filter((r) => r.status !== "cancelled");
    const sorted = [...c.reservations].sort((a, b) => new Date(b.$createdAt) - new Date(a.$createdAt));
    return {
      ...c,
      count: c.reservations.length,
      totalEstimate: active.reduce((s, r) => s + Number(r.totalEstimate || 0), 0),
      lastReservation: sorted[0] || null,
      reservations: sorted,
    };
  });
}
