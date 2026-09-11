-- Index prevus dans schema_pour_front.txt mais absents des migrations 2 et 3
CREATE INDEX IF NOT EXISTS idx_sessions_user        ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires     ON sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_artisan_trades_trade ON artisan_trades(trade_id);
