// Client HTTP de l'API followmetravel (api/ — NestJS), qui remplace le SDK
// Appwrite. Session par cookie httpOnly posé par l'API : chaque requête part
// avec credentials: "include", rien n'est stocké côté JS.

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * Même forme qu'une AppwriteException : `message`, `code`, `type`, et
 * `cause.type` (lu par LoginPage) — les appelants n'ont rien à changer.
 */
export class ApiError extends Error {
  constructor(message, { code = 0, type = "general_unknown" } = {}) {
    super(message, { cause: { code, type } });
    this.name = "ApiError";
    this.code = code;
    this.type = type;
  }
}

/**
 * @param {string} method
 * @param {string} path  ex. "/v1/collections/products/documents"
 * @param {{ body?: unknown, query?: Record<string, string | string[]> }} [options]
 */
export async function request(method, path, { body, query } = {}) {
  const url = new URL(API_URL + path);
  for (const [key, value] of Object.entries(query || {})) {
    for (const v of Array.isArray(value) ? value : [value]) url.searchParams.append(key, v);
  }

  // X-Fmt-Client : exigé par l'API sur toute écriture (anti-CSRF).
  const headers = { "X-Fmt-Client": "web" };
  let payload;
  if (body instanceof FormData) {
    payload = body; // le navigateur pose le Content-Type multipart et sa boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, credentials: "include" });
  } catch {
    throw new ApiError("Serveur injoignable. Vérifiez votre connexion.", { code: 0, type: "network_error" });
  }

  if (res.status === 204) return null;
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = (data && typeof data === "object" && data.message) || `Erreur ${res.status}`;
    throw new ApiError(Array.isArray(message) ? message.join(", ") : message, {
      code: res.status,
      type: (data && data.type) || "general_unknown",
    });
  }
  return data;
}
