CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS postgis;      -- recherche géographique
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- requis pour l'anti-double-booking
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()

CREATE TYPE user_role AS ENUM ('client', 'artisan', 'admin');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role            user_role   NOT NULL,
    email           CITEXT      NOT NULL UNIQUE,   -- CITEXT = insensible à la casse
    password_hash   TEXT        NOT NULL,          -- argon2id ou bcrypt
    first_name      TEXT        NOT NULL,
    last_name       TEXT        NOT NULL,
    phone           TEXT        NOT NULL UNIQUE,
    email_verified_at TIMESTAMPTZ,
    -- suspension immédiate (litige, fraude) sans supprimer le compte
    suspended_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
