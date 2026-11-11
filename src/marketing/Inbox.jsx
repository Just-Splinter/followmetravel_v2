import { useState } from "react";
import { documentUrl, markMessageRead } from "../services/operations";
import { invalidateUnread } from "../services/inboxUnread";

const DOC_LABEL = { reservation: "pf_doc_fiche", facture: "pf_doc_facture", cgv: "pf_doc_cgv" };

/**
 * Boîte de réception de l'espace client : les emails envoyés par l'agence
 * (confirmations, dossier, rappels), lisibles ici même sans les retrouver
 * dans sa messagerie. Ouvrir un message le marque comme lu.
 */
export default function Inbox({ messages, setMessages, t, dateFmt, onBrowse }) {
  const [open, setOpen] = useState(null);

  if (!messages.length) {
    return (
      <div className="mk-sr-empty">
        <p className="mk-quote" style={{ fontSize: 26 }}>{t("inbox_empty_t")}</p>
        <p style={{ color: "var(--ink-2)", margin: "10px 0 22px" }}>{t("inbox_empty_d")}</p>
        <button className="mk-btn mk-btn--sm" onClick={onBrowse}>{t("pf_browse")}</button>
      </div>
    );
  }

  const toggle = (m) => {
    const next = open === m.$id ? null : m.$id;
    setOpen(next);
    if (next && !m.readAt) {
      const readAt = new Date().toISOString();
      setMessages((list) => list.map((x) => (x.$id === m.$id ? { ...x, readAt } : x)));
      markMessageRead(m.$id).then(invalidateUnread).catch(() => {});
    }
  };

  return (
    <ul className="mk-inbox">
      {messages.map((m) => {
        const isOpen = open === m.$id;
        return (
          <li key={m.$id} className={`mk-inbox-item ${m.readAt ? "" : "is-unread"} ${isOpen ? "is-open" : ""}`}>
            <button className="mk-inbox-head" aria-expanded={isOpen} onClick={() => toggle(m)}>
              <i className="mk-inbox-dot" aria-hidden="true" />
              <span className="mk-inbox-subject">{m.subject || "—"}</span>
              <time dateTime={m.$createdAt}>{dateFmt.format(new Date(m.$createdAt))}</time>
            </button>
            {isOpen && (
              <div className="mk-inbox-body">
                {/* HTML des templates d'email : isolé dans une iframe sans scripts. */}
                <iframe title={m.subject || "message"} sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={`<base target="_blank">${m.html}`} />
                {m.reservationId && m.attachments.length > 0 && (
                  <div className="mk-inbox-files">
                    <span>{t("inbox_attach")}</span>
                    {m.attachments.map((type) => (
                      <a key={type} href={documentUrl(m.reservationId, type)} target="_blank" rel="noreferrer">
                        {DOC_LABEL[type] ? t(DOC_LABEL[type]) : type}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
