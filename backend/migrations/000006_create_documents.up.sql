CREATE TABLE properties (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
 UNIQUE (user_id, name), UNIQUE (id, user_id)
);
CREATE TABLE documents (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 property_id UUID NOT NULL,
 title TEXT NOT NULL,
 original_filename TEXT NOT NULL,
 category TEXT NOT NULL CHECK (category IN ('devis','facture','assurance','garantie','diagnostic','photo','video','autre')),
 mime_type TEXT NOT NULL,
 size BIGINT NOT NULL CHECK (size > 0),
 storage_key TEXT NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 document_date DATE,
 FOREIGN KEY (property_id, user_id) REFERENCES properties(id, user_id)
);
CREATE INDEX documents_user_idx ON documents(user_id, created_at DESC);
