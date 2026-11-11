-- Schéma initial — remplace la base Appwrite.
--
-- Les 12 collections Appwrite vivent dans une seule table `documents` en
-- JSONB : mêmes ids, mêmes attributs, aucune transformation à la migration,
-- et le front garde son contrat Appwrite ($id, $createdAt, documents/total).
-- Les règles d'accès par collection sont dans src/collections/policies.ts.

CREATE TABLE documents (
  collection  text        NOT NULL,
  id          text        NOT NULL,
  data        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);

-- Ordre par défaut (création) + pagination.
CREATE INDEX documents_collection_created_idx ON documents (collection, created_at, id);
-- Filtres Query.equal / contains sur les attributs.
CREATE INDEX documents_data_gin_idx ON documents USING gin (data jsonb_path_ops);
-- Filtres les plus fréquents du front : réservations par client / statut,
-- analytics par date d'événement.
CREATE INDEX documents_user_id_idx ON documents (collection, (data->>'userId'));
CREATE INDEX documents_status_idx ON documents (collection, (data->>'status'));
CREATE INDEX documents_event_created_idx ON documents (collection, (data->>'createdAt'));

CREATE TABLE users (
  id                 text        PRIMARY KEY,
  email              text        NOT NULL,
  name               text        NOT NULL DEFAULT '',
  -- argon2 (format PHC). NULL pour un compte uniquement Google.
  password_hash      text,
  google_sub         text        UNIQUE,
  labels             text[]      NOT NULL DEFAULT '{}',
  prefs              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  email_verification boolean     NOT NULL DEFAULT false,
  status             boolean     NOT NULL DEFAULT true,
  password_updated_at timestamptz,
  accessed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

-- Sessions opaques : le cookie contient un jeton aléatoire, la table n'en
-- garde que le sha256 (une fuite de la base ne donne aucune session valide).
CREATE TABLE sessions (
  token_hash  text        PRIMARY KEY,
  user_id     text        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider    text        NOT NULL,
  user_agent  text,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE password_recoveries (
  secret_hash text        PRIMARY KEY,
  user_id     text        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
CREATE INDEX password_recoveries_user_idx ON password_recoveries (user_id);
