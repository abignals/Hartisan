CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artisan_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- denormalise pour trier la liste sans agreger les messages a chaque affichage
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (client_id, artisan_id),
    CHECK (client_id <> artisan_id)
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body            TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 5000),
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conv        ON messages(conversation_id, created_at);
CREATE INDEX idx_conversations_client ON conversations(client_id,  last_message_at DESC);
CREATE INDEX idx_conversations_artisan ON conversations(artisan_id, last_message_at DESC);