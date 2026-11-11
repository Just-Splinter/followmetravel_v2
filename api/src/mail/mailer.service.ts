import { Inject, Injectable, Logger } from "@nestjs/common";
import { createTransport, Transporter } from "nodemailer";
import { CONFIG, Config } from "../config";
import { ApiError } from "../common/errors";
import { addressOf, validEmails } from "./templates";

export interface OutgoingMail {
  to: string | string[];
  subject: string;
  html: string;
  /** Nom affiché de l'expéditeur ; l'adresse reste celle de MAIL_FROM. */
  fromName?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: { filename: string; content: Buffer }[];
}

/** Envoi SMTP (boîte noreply du cPanel) — remplace Appwrite Messaging. */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transport: Transporter | null;

  constructor(@Inject(CONFIG) private readonly config: Config) {
    this.transport = config.smtp.url ? createTransport(config.smtp.url) : null;
    if (!this.transport) this.logger.warn("SMTP_URL absent : aucun email ne sera envoyé.");
    else if (config.smtp.redirectTo) this.logger.warn(`MAIL_REDIRECT_TO actif : tous les emails partent vers ${config.smtp.redirectTo}.`);
  }

  get configured() {
    return this.transport !== null;
  }

  /** Adresse de la boîte d'envoi (MAIL_FROM). */
  get senderAddress() {
    return addressOf(this.config.smtp.from);
  }

  async send({ fromName, ...message }: OutgoingMail) {
    if (!this.transport) {
      throw new ApiError(503, "general_smtp_disabled", "Envoi d'emails non configuré sur le serveur (SMTP_URL).");
    }
    // Adresses revalidées ici : une adresse saisie par un client (participant)
    // ne doit jamais atteindre le parseur d'adresses SMTP telle quelle.
    const to = validEmails((Array.isArray(message.to) ? message.to : [message.to]).join(","));
    if (!to.length) throw new ApiError(400, "general_argument_invalid", "Aucune adresse de destination valide.");
    const from = fromName ? { name: fromName, address: this.senderAddress } : this.config.smtp.from;
    const cc = validEmails((message.cc ?? []).join(","));
    const bcc = validEmails((message.bcc ?? []).join(","));
    // Phase de test : aucun email ne part chez un vrai client ; tout va à
    // MAIL_REDIRECT_TO, avec les destinataires d'origine dans le sujet.
    const redirect = validEmails(this.config.smtp.redirectTo)[0];
    if (redirect) {
      const original = [...to, ...cc.map((c) => `cc:${c}`), ...bcc.map((b) => `cci:${b}`)].join(", ");
      await this.transport.sendMail({ ...message, from, to: [redirect], cc: [], bcc: [], subject: `[TEST → ${original}] ${message.subject}` });
      return;
    }
    await this.transport.sendMail({ ...message, from, to, cc, bcc });
  }
}
