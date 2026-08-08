CREATE TABLE trades (
    id          SMALLSERIAL PRIMARY KEY,
    slug        TEXT NOT NULL UNIQUE,    -- 'plombier', 'electricien'
    label       TEXT NOT NULL,           -- 'Plombier'
    is_active   BOOLEAN NOT NULL DEFAULT true
);

CREATE TYPE artisan_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');

CREATE TABLE artisan_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    company_name        TEXT NOT NULL,
    siret               TEXT UNIQUE,
    description         TEXT,

    -- Adresse de base + point géographique (PostGIS)
    address_line        TEXT,
    postal_code         TEXT NOT NULL,
    city                TEXT NOT NULL,
    location            GEOGRAPHY(Point, 4326) NOT NULL,
    -- rayon d'intervention en mètres
    service_radius_m    INTEGER NOT NULL DEFAULT 20000
                        CHECK (service_radius_m BETWEEN 1000 AND 100000),

    -- durée par défaut d'un RDV, sert à générer les créneaux
    default_slot_minutes SMALLINT NOT NULL DEFAULT 60
                        CHECK (default_slot_minutes BETWEEN 15 AND 480),

    -- Validation manuelle par l'admin (assurance décennale, identité)
    status              artisan_status NOT NULL DEFAULT 'pending',
    insurance_doc_url   TEXT,
    insurance_expires_at DATE,
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    rejection_reason    TEXT,

    -- Dénormalisé pour le tri des résultats de recherche (recalculé sur nouvel avis)
    rating_avg          NUMERIC(2,1),
    rating_count        INTEGER NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index géographique : indispensable pour "artisans à moins de X km"
CREATE INDEX idx_artisan_location ON artisan_profiles USING GIST (location);
CREATE INDEX idx_artisan_status   ON artisan_profiles(status) WHERE status = 'approved';

-- Un artisan peut exercer plusieurs métiers
CREATE TABLE artisan_trades (
    artisan_id  UUID     NOT NULL REFERENCES artisan_profiles(id) ON DELETE CASCADE,
    trade_id    SMALLINT NOT NULL REFERENCES trades(id),
    PRIMARY KEY (artisan_id, trade_id)
);

INSERT INTO trades (slug, label) VALUES
    ('plombier',    'Plombier'),
    ('electricien', 'Électricien'),
    ('serrurier',   'Serrurier'),
    ('chauffagiste','Chauffagiste');