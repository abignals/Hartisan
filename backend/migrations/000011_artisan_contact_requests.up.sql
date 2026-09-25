CREATE TABLE artisan_contact_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 first_name TEXT NOT NULL,
 last_name TEXT NOT NULL,
 company_name TEXT NOT NULL DEFAULT '',
 email CITEXT NOT NULL,
 phone TEXT NOT NULL,
 trade TEXT NOT NULL,
 postal_code TEXT NOT NULL,
 message TEXT NOT NULL DEFAULT '',
 availability TEXT NOT NULL DEFAULT '',
 consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','closed'))
);
CREATE INDEX artisan_contact_requests_email_date ON artisan_contact_requests(email,created_at);
