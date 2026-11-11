import { describe, expect, it } from "vitest";
import {
  addressOf,
  buildReservationParams,
  emailSettingsFromProducts,
  renderTemplate,
  reservationClientEmail,
  templateEnvelope,
} from "../src/mail/templates";

describe("renderTemplate", () => {
  it("remplace les variables et échappe le HTML venu du client", () => {
    const out = renderTemplate(
      { subject: "Réservation {{reservation_ref}}", html: "<p>Bonjour {{client_name}}</p>" },
      { reservation_ref: "FMT-1", client_name: "<script>x</script>" },
    );
    expect(out.subject).toBe("Réservation FMT-1");
    expect(out.html).toBe("<p>Bonjour &lt;script&gt;x&lt;/script&gt;</p>");
  });

  it("variable inconnue → vide ; pas de retour à la ligne dans le sujet (injection d'en-tête)", () => {
    const out = renderTemplate({ subject: "A {{x}}\r\nBcc: evil@x.com", html: "{{nope}}" }, {});
    expect(out.subject).toBe("A  Bcc: evil@x.com");
    expect(out.html).toBe("");
  });

  it("préfixe le preheader masqué", () => {
    expect(renderTemplate({ preheader: "Hi", html: "<p/>" }, {}).html).toMatch(/^<div style="display:none.*>Hi<\/div><p\/>$/);
  });
});

describe("paramètres de réservation", () => {
  const r = {
    ref: "FMT-20260101-ABCD",
    status: "paid",
    userName: "",
    participants: JSON.stringify([{ fullName: "Sara", email: "s@x.ma", phone: "06" }]),
    payments: JSON.stringify([{ amount: 1000 }, { amount: 500 }]),
    totalEstimate: 4000,
    $createdAt: "2026-03-12T10:00:00.000Z",
  };

  it("reprend buildReservationParams du front", () => {
    const p = buildReservationParams(r);
    expect(p.client_name).toBe("Sara");
    expect(p.reservation_status).toBe("Payée");
    expect(p.reservation_paid).toBe("1500");
    expect(p.reservation_remaining).toBe("2500");
  });

  it("email client : compte, sinon participant principal", () => {
    expect(reservationClientEmail({ ...r, userEmail: "u@x.ma" })).toBe("u@x.ma");
    expect(reservationClientEmail(r)).toBe("s@x.ma");
  });
});

describe("emailSettingsFromProducts", () => {
  it("trouve le singleton email-settings parmi les produits", () => {
    const settings = emailSettingsFromProducts([
      { data: JSON.stringify({ kind: "hero-slide" }) },
      { data: JSON.stringify({ kind: "email-settings", adminEmails: "a@x.ma" }) },
    ]);
    expect(settings?.adminEmails).toBe("a@x.ma");
  });
});

describe("templateEnvelope", () => {
  const SENDER = "noreply@followmetravel.ma";

  it("nom d'expéditeur du template, Cc/Cci validés un par un", () => {
    const env = templateEnvelope(
      { fromName: "Follow Me Travel", ccEmails: "a@x.ma, pas-une-adresse", bccEmails: "archive@followmetravel.ma" },
      SENDER,
    );
    expect(env).toEqual({ fromName: "Follow Me Travel", replyTo: undefined, cc: ["a@x.ma"], bcc: ["archive@followmetravel.ma"] });
  });

  it("replyTo explicite, sinon le fromEmail du template s'il diffère de la boîte d'envoi", () => {
    expect(templateEnvelope({ replyTo: "contact@followmetravel.ma", fromEmail: "hello@followmetravel.ma" }, SENDER).replyTo).toBe("contact@followmetravel.ma");
    expect(templateEnvelope({ fromEmail: "hello@followmetravel.ma" }, SENDER).replyTo).toBe("hello@followmetravel.ma");
    expect(templateEnvelope({ fromEmail: SENDER }, SENDER).replyTo).toBeUndefined();
  });

  it("nom d'expéditeur nettoyé (pas d'injection d'en-tête)", () => {
    expect(templateEnvelope({ fromName: 'Evil"\r\nBcc: x@y.z <a>' }, SENDER).fromName).toBe("EvilBcc: x@y.z a");
  });
});

describe("addressOf", () => {
  it("extrait l'adresse d'un en-tête From", () => {
    expect(addressOf("Follow Me Travel <noreply@followmetravel.ma>")).toBe("noreply@followmetravel.ma");
    expect(addressOf("noreply@followmetravel.ma")).toBe("noreply@followmetravel.ma");
  });
});
