ALTER TABLE users ADD COLUMN address_line TEXT NOT NULL DEFAULT '';
CREATE TABLE account_verification_limits (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 failures INTEGER NOT NULL DEFAULT 0,
 locked_until TIMESTAMPTZ
);
