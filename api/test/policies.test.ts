import { describe, expect, it } from "vitest";
import { NOT_DRAFT, POLICIES, PUBLIC_PRODUCTS, allows, hasFullAccess, type Caller, type Role } from "../src/collections/policies";

const as = (...roles: Role[]): Caller => ({ id: roles.join("-") || "client", roles, isAdmin: roles.includes("admin"), isStaff: roles.length > 0 });
const admin = as("admin");
const agent = as("agent");
const accounting = as("accounting");
const client = as();

describe("policies", () => {
  it("couvre exactement les 13 collections du front (services/database.js)", () => {
    expect(Object.keys(POLICIES).sort()).toEqual([
      "adventures", "clients", "destinations", "email_templates", "events", "hotels",
      "messages", "news", "products", "reservations", "team", "testimonials", "tours",
    ]);
  });

  it("catalogue : lecture publique, édition admin + conseiller, suppression admin", () => {
    const p = POLICIES.products;
    expect(allows(p.read, null)).toBe(true);
    expect(allows(p.create, client)).toBe(false);
    expect(allows(p.update, agent)).toBe(true);
    expect(allows(p.update, accounting)).toBe(false);
    expect(allows(p.delete, agent)).toBe(false);
    expect(allows(p.delete, admin)).toBe(true);
  });

  it("réservations : toute l'équipe a l'accès complet, le client seulement les siennes", () => {
    const p = POLICIES.reservations;
    expect(allows(p.read, null)).toBe(false);
    expect(allows(p.read, client)).toBe(true);
    expect(hasFullAccess(p.read, client, p.privileged)).toBe(false);
    for (const staff of [admin, agent, accounting]) expect(hasFullAccess(p.read, staff, p.privileged)).toBe(true);
    expect(allows(p.delete, accounting)).toBe(false);
  });

  it("réservations : attributs internes (coûts, notes, conseiller) cachés au client", () => {
    expect(POLICIES.reservations.privateFields).toEqual(expect.arrayContaining(["costs", "internalNotes", "assignedTo"]));
  });

  it("réservations : un client annule ou complète ses voyageurs, rien d'autre, dossier ouvert seulement", () => {
    const check = POLICIES.reservations.restrictedUpdate!.check!;
    const open = { status: "confirmed", totalPax: 2 };
    expect(check({ status: "cancelled", cancelledAt: "x" }, open)).toBe(true);
    expect(check({ status: "paid" }, open)).toBe(false);
    expect(check({ participants: JSON.stringify([{ fullName: "A" }, { fullName: "B" }]) }, open)).toBe(true);
    expect(check({ participants: JSON.stringify([{}, {}, {}]) }, open)).toBe(false); // plus de voyageurs que réservé
    expect(check({ participants: "pas du json" }, open)).toBe(false);
    expect(check({ status: "cancelled" }, { status: "completed" })).toBe(false);
  });

  it("hôtels : le client ne touche qu'à bookedSnapshot, le conseiller à tout", () => {
    const p = POLICIES.hotels;
    expect(hasFullAccess(p.update, client, p.privileged)).toBe(false);
    expect(hasFullAccess(p.update, agent, p.privileged)).toBe(true);
    expect(p.restrictedUpdate!.fields).toEqual(["bookedSnapshot"]);
  });

  it("events : écriture anonyme, lecture équipe, pas d'audit", () => {
    expect(allows(POLICIES.events.create, null)).toBe(true);
    expect(allows(POLICIES.events.read, client)).toBe(false);
    expect(allows(POLICIES.events.read, agent)).toBe(true);
    expect(POLICIES.events.noAudit).toBe(true);
  });

  it("templates : lus par l'équipe, modifiés par l'admin ; clients : équipe", () => {
    expect(allows(POLICIES.email_templates.read, agent)).toBe(true);
    expect(allows(POLICIES.email_templates.update, agent)).toBe(false);
    expect(allows(POLICIES.clients.update, accounting)).toBe(true);
    expect(allows(POLICIES.clients.read, client)).toBe(false);
  });

  describe("vue publique (hors équipe)", () => {
    const today = "2026-10-16";
    const blob = (kind: string) => JSON.stringify({ kind, x: 1 });
    const visible = (data: Record<string, unknown>) => PUBLIC_PRODUCTS.visible(data, today);

    it("packages : publiés seulement, dans leur fenêtre de publication", () => {
      expect(visible({ status: "active" })).toBe(true);
      expect(visible({ status: "published", publishAt: "2026-10-16", unpublishAt: "2026-10-17" })).toBe(true);
      expect(visible({ status: "draft" })).toBe(false);
      expect(visible({ status: "archived" })).toBe(false);
      expect(visible({ status: "active", publishAt: "2026-10-17" })).toBe(false);
      expect(visible({ status: "active", unpublishAt: "2026-10-16" })).toBe(false);
    });

    it("réglages : hero, omra, contact, agence lisibles ; réglages email cachés", () => {
      for (const kind of ["hero-slide", "omra", "site-contact", "agency"]) expect(visible({ status: "draft", data: blob(kind) })).toBe(true);
      expect(visible({ status: "draft", data: blob("email-settings") })).toBe(false);
    });

    it("contenu éditorial : tout sauf les brouillons", () => {
      expect(NOT_DRAFT.visible({ status: "published" }, today)).toBe(true);
      expect(NOT_DRAFT.visible({}, today)).toBe(true);
      expect(NOT_DRAFT.visible({ status: "draft" }, today)).toBe(false);
      for (const c of ["destinations", "tours", "adventures", "team", "testimonials", "news"]) expect(POLICIES[c].publicView).toBe(NOT_DRAFT);
      expect(POLICIES.products.publicView).toBe(PUBLIC_PRODUCTS);
    });
  });
});

import { packagePath, slugify } from "../src/common/slug";

describe("slug des fiches voyage (aligné sur le site)", () => {
  it("translittère accents et esperluette", () => {
    expect(slugify("Grand Tour de Thaïlande")).toBe("grand-tour-de-thailande");
    expect(slugify("Singapour & Kuala Lumpur")).toBe("singapour-et-kuala-lumpur");
    expect(slugify("  Omra 2026 — Ramadan !  ")).toBe("omra-2026-ramadan");
    expect(packagePath("seed-pkg-bali", "Bali Évasion")).toBe("/voyages/seed-pkg-bali/bali-evasion");
    expect(packagePath("abc", "")).toBe("/voyages/abc");
  });
});
