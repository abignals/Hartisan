CREATE TABLE calendar_settings (
    artisan_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    diagnostic_minutes INTEGER NOT NULL DEFAULT 60 CHECK (diagnostic_minutes BETWEEN 15 AND 240 AND diagnostic_minutes % 15 = 0),
    buffer_minutes INTEGER NOT NULL DEFAULT 30 CHECK (buffer_minutes BETWEEN 0 AND 120 AND buffer_minutes % 15 = 0)
);

CREATE TABLE availability_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439 AND start_minute % 15 = 0),
    end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 1 AND 1440 AND end_minute % 15 = 0),
    CHECK (start_minute < end_minute),
    EXCLUDE USING gist (artisan_id WITH =, weekday WITH =, int4range(start_minute, end_minute, '[)') WITH &&)
);

CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('diagnostic', 'absence', 'external')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'expired')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    busy_until TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
    description TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    postal_code TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    contact_name TEXT NOT NULL DEFAULT '',
    contact_phone TEXT NOT NULL DEFAULT '',
    change_reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (starts_at < ends_at AND ends_at <= busy_until),
    CHECK ((kind = 'diagnostic' AND client_id IS NOT NULL AND expires_at IS NOT NULL)
        OR (kind <> 'diagnostic' AND client_id IS NULL AND status IN ('confirmed','cancelled'))),
    CHECK (expires_at IS NULL OR expires_at <= starts_at),
    CONSTRAINT calendar_events_no_overlap EXCLUDE USING gist (
        artisan_id WITH =,
        tstzrange(starts_at, busy_until, '[)') WITH &&
    ) WHERE (status IN ('pending', 'confirmed'))
);
CREATE INDEX calendar_events_client ON calendar_events(client_id, starts_at);
CREATE INDEX calendar_events_artisan ON calendar_events(artisan_id, starts_at);
CREATE INDEX calendar_events_expiry ON calendar_events(expires_at) WHERE status = 'pending';
