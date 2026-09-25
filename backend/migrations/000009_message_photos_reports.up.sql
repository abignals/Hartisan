CREATE TABLE message_photos (
 message_id UUID PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
 storage_key TEXT NOT NULL UNIQUE
);
CREATE TABLE message_reports (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
 reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 1000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(message_id, reporter_id)
);
INSERT INTO conversations(client_id,artisan_id)
SELECT DISTINCT client_id,artisan_id FROM calendar_events WHERE kind='diagnostic'
ON CONFLICT(client_id,artisan_id) DO NOTHING;
