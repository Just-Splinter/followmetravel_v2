-- Journal d'audit (qui a modifié quoi, quand) + notes internes sur un
-- dossier : l'historique d'une réservation est la liste de ses entrées.
CREATE TABLE audit_log (
  id           bigserial   PRIMARY KEY,
  at           timestamptz NOT NULL DEFAULT now(),
  user_id      text,
  user_name    text,
  collection   text        NOT NULL,
  document_id  text        NOT NULL,
  -- create | update | delete | note | email | document | job
  action       text        NOT NULL,
  -- update : { attribut: [avant, après] } ; autres : contexte libre
  changes      jsonb,
  message      text
);
CREATE INDEX audit_log_document_idx ON audit_log (collection, document_id, at DESC);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);

-- Numérotation continue des factures, par année (obligation légale : pas de
-- trou ni de doublon). Incrémentée dans la même transaction que l'émission.
CREATE TABLE counters (
  name   text    NOT NULL,
  year   integer NOT NULL,
  value  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (name, year)
);
