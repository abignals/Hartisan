CREATE TABLE sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- on stocke un HASH du token, jamais le token en clair :
    -- une fuite de la base ne permet pas d'usurper une session
    token_hash    BYTEA       NOT NULL UNIQUE,
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent    TEXT,
    ip_address    INET,
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);