-- Short URL schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS urls (
  id           BIGSERIAL PRIMARY KEY,
  short_code   VARCHAR(32)  NOT NULL UNIQUE,
  original_url TEXT         NOT NULL,
  title        VARCHAR(255),
  is_custom    BOOLEAN      NOT NULL DEFAULT FALSE,
  click_count  INTEGER      NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_urls_created_at ON urls (created_at DESC);

CREATE TABLE IF NOT EXISTS clicks (
  id          BIGSERIAL PRIMARY KEY,
  url_id      BIGINT       NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  clicked_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  source      VARCHAR(16)  NOT NULL DEFAULT 'link',   -- 'link' | 'qr'
  referrer    TEXT,
  user_agent  TEXT,
  browser     VARCHAR(64),
  os          VARCHAR(64),
  device      VARCHAR(32),
  ip_hash     VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_clicks_url_time ON clicks (url_id, clicked_at DESC);
