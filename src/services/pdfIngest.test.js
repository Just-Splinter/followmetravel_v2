// Runs with plain `node --test src/services/pdfIngest.test.js` (node:test,
// no vitest APIs — excluded from the vitest glob in vite.config.js).
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { analyzePdf, diffTaxonomy, buildPackageData, normalizeName } from "./pdfIngest.js";

const VALID = {
  basic: { title: "Séjour test", country: "Turquie", continent: "Asie", destinations: ["Istanbul"], tours: [], adventures: [], basePrice: 7600 },
  data: { destination: "ISTANBUL", sections: [], days: [], hotelCategories: [], departureDates: [], suppliments: [] },
};

const ok = (content) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});
const httpErr = (status, message) => ({
  ok: false,
  status,
  json: async () => ({ error: { message, code: status } }),
});

/** fetch stub returning queued responses (last one repeats); counts calls. */
function stubFetch(queue) {
  const state = { calls: 0 };
  globalThis.fetch = async () => {
    const res = queue[Math.min(state.calls, queue.length - 1)];
    state.calls++;
    return typeof res === "function" ? res() : res;
  };
  return state;
}

describe("analyzePdf failure handling", () => {
  const saved = {};
  beforeEach(() => {
    saved.fetch = globalThis.fetch;
    saved.log = console.log;
    saved.warn = console.warn;
    console.log = () => {};
    console.warn = () => {};
  });
  afterEach(() => {
    globalThis.fetch = saved.fetch;
    console.log = saved.log;
    console.warn = saved.warn;
  });

  const opts = { apiKey: "test-key", models: ["model-a", "model-b"] };

  it("falls through to the next model on malformed JSON, then succeeds", async () => {
    const state = stubFetch([
      ok('{"basic": {"title": "tronqué'), // truncated
      ok('{"basic": {"title": "tronqué'), // retry, same
      ok(JSON.stringify(VALID)), // model-b
    ]);
    const res = await analyzePdf({ text: "contenu" }, opts);
    assert.equal(res.basic.title, "Séjour test");
    assert.equal(res._model, "model-b");
    assert.equal(state.calls, 3);
  });

  it("throws a clear French error when every model fails", async () => {
    stubFetch([ok("Désolé, je ne peux pas produire de JSON.")]);
    await assert.rejects(
      analyzePdf({ text: "contenu" }, opts),
      /tous les modèles ont échoué/
    );
  });

  it("treats an empty-choices 200 body as a retryable failure, not a hang", async () => {
    stubFetch([
      { ok: true, status: 200, json: async () => ({}) },
      { ok: true, status: 200, json: async () => ({}) },
      ok(JSON.stringify(VALID)),
    ]);
    const res = await analyzePdf({ text: "contenu" }, opts);
    assert.equal(res._model, "model-b");
  });

  it("treats a stalled/aborted body read as a next-model failure", async () => {
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    stubFetch([
      { ok: true, status: 200, json: () => Promise.reject(timeout) },
      ok(JSON.stringify(VALID)),
    ]);
    const res = await analyzePdf({ text: "contenu" }, opts);
    assert.equal(res._model, "model-b");
  });

  it("falls through on 402 (no credits) and strips code fences on success", async () => {
    stubFetch([
      httpErr(402, "Insufficient credits"),
      ok("```json\n" + JSON.stringify(VALID) + "\n```"),
    ]);
    const res = await analyzePdf({ text: "contenu" }, opts);
    assert.equal(res._model, "model-b");
  });

  it("stops the chain on a non-retryable error (401) with a French message", async () => {
    const state = stubFetch([httpErr(401, "Unauthorized")]);
    await assert.rejects(analyzePdf({ text: "contenu" }, opts), /Analyse IA échouée/);
    assert.equal(state.calls, 1);
  });
});

describe("diffTaxonomy", () => {
  const ctx = {
    countryOptions: ["Maroc", "Turquie", "Émirats Arabes Unis"],
    continents: ["Europe", "Asie", "Afrique"],
    destinations: [{ $id: "d1", name: "Istanbul" }],
    tours: [],
    adventures: [],
  };

  it("matches case/accent-insensitively and lists only true misses", () => {
    const { matches, missing } = diffTaxonomy(
      { country: "turquie", continent: "ASIE", destinations: ["ISTANBUL", "Bursa"], tours: [], adventures: [] },
      ctx
    );
    assert.equal(matches.country, "Turquie");
    assert.equal(matches.continent, "Asie");
    assert.equal(matches.destinationId, "d1");
    assert.deepEqual(missing, [{ type: "destinations", typeLabel: "Destination", name: "Bursa" }]);
  });

  it("dedupes repeated missing values", () => {
    const { missing } = diffTaxonomy(
      { destinations: ["Dubaï", "dubai"], tours: [], adventures: [] },
      ctx
    );
    // "Dubaï" vs "dubai" normalize identically — one checklist entry only
    assert.equal(missing.filter((m) => normalizeName(m.name) === "dubai").length, 1);
  });
});

describe("buildPackageData", () => {
  it("assembles an editor-shaped blob with ids and defaults", () => {
    const data = buildPackageData({
      basic: { title: "Test", basePrice: 1000 },
      data: {
        destination: "TEST",
        sections: [{ title: "Inclus", items: [{ text: "Vol" }] }],
        days: [{ title: "Jour 1", activities: [{ label: "Arrivée" }] }],
        hotelCategories: [{ label: "4★", tableHeaders: ["Hôtel", "Ville", "Nuits", "★", "Double"], hotels: [{ name: "H1", cols: ["500"] }] }],
        departureDates: [{ from: "01/06", to: "08/06" }, { from: "bad", to: "date" }],
        suppliments: [{ label: "Excursion", pricePerPax: 300 }],
      },
    });
    assert.equal(typeof data.sections[0].id, "number");
    assert.equal(data.days[0].image, null);
    assert.deepEqual(data.hotelCategories[0].hotels[0].allotment, []);
    assert.equal(data.hotelCategories[0].hotels[0].blockWhenFull, false);
    assert.deepEqual(data.hotelCategories[0].hotels[0].cols, ["500"]);
    assert.equal(data.departureDates.length, 1); // invalid DD/MM dropped
    assert.equal(data.tabs.length, 4);
    assert.equal(data.basePrice, 1000);
  });
});
