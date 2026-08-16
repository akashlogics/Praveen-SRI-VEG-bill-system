-- ============================================================
--  காய்கறி பில்லிங் v4 — Supabase Schema
--  Run this entire file in Supabase → SQL Editor → New Query
-- ============================================================

-- 1. Shop configuration (single row, id always = 1)
CREATE TABLE IF NOT EXISTS shop_config (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  name            TEXT    NOT NULL DEFAULT 'சபரி மொத்தம் காய்கறி',
  sub             TEXT    NOT NULL DEFAULT 'மொத்த காய்கறி வியாபாரம்',
  address         TEXT    NOT NULL DEFAULT '',
  phone           TEXT    NOT NULL DEFAULT '91 91590 72444',
  owner           TEXT    NOT NULL DEFAULT 'சபரி',
  next_bill_no    INTEGER NOT NULL DEFAULT 1095,
  app_password    TEXT    NOT NULL DEFAULT 'billing123'
);

-- 2. Items (vegetables catalogue)
CREATE TABLE IF NOT EXISTS items (
  id    BIGSERIAL   PRIMARY KEY,
  name  TEXT        NOT NULL,
  unit  TEXT        NOT NULL DEFAULT 'கிலோ',
  price NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- 3. Customers (B2B shops)
CREATE TABLE IF NOT EXISTS customers (
  id           BIGSERIAL    PRIMARY KEY,
  name         TEXT         NOT NULL,
  phone        TEXT         NOT NULL DEFAULT '',
  bank_details TEXT         NOT NULL DEFAULT '',
  balance      NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 4. Bills (sales invoices)
CREATE TABLE IF NOT EXISTS bills (
  id             BIGSERIAL    PRIMARY KEY,
  bill_no        INTEGER      NOT NULL,
  date_iso       TEXT         NOT NULL,   -- 'YYYY-MM-DD'
  time_display   TEXT         NOT NULL DEFAULT '',
  created_at     BIGINT       NOT NULL,   -- JS timestamp ms
  customer_id    BIGINT       REFERENCES customers(id) ON DELETE SET NULL,
  customer_name  TEXT         NOT NULL,
  customer_phone TEXT         NOT NULL DEFAULT '',
  items          JSONB        NOT NULL DEFAULT '[]',  -- [{name,unit,qty,price,value}]
  total          NUMERIC(10,2) NOT NULL DEFAULT 0,    -- today's goods total
  prev_balance   NUMERIC(10,2) NOT NULL DEFAULT 0,
  kuli           NUMERIC(10,2) NOT NULL DEFAULT 0,    -- கூலி (delivery charge)
  grand_total    NUMERIC(10,2) NOT NULL DEFAULT 0     -- total + prev_balance + kuli
);

-- 5. Payments received from customers
CREATE TABLE IF NOT EXISTS payments (
  id             BIGSERIAL    PRIMARY KEY,
  customer_id    BIGINT       REFERENCES customers(id) ON DELETE SET NULL,
  customer_name  TEXT         NOT NULL,
  date_iso       TEXT         NOT NULL,
  time_display   TEXT         NOT NULL DEFAULT '',
  created_at     BIGINT       NOT NULL,
  amount         NUMERIC(10,2) NOT NULL,
  mode           TEXT         NOT NULL DEFAULT 'பணம் (Cash)',
  reference      TEXT         NOT NULL DEFAULT '',
  balance_after  NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ============================================================
--  Disable Row Level Security (single-user app, uses service key)
-- ============================================================
ALTER TABLE shop_config  DISABLE ROW LEVEL SECURITY;
ALTER TABLE items        DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers    DISABLE ROW LEVEL SECURITY;
ALTER TABLE bills        DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments     DISABLE ROW LEVEL SECURITY;

-- ============================================================
--  Seed default shop config (insert only if empty)
-- ============================================================
INSERT INTO shop_config (id, name, sub, address, phone, owner, next_bill_no, app_password)
VALUES (1, 'சபரி மொத்தம் காய்கறி', 'மொத்த காய்கறி வியாபாரம்', '', '91 91590 72444', 'சபரி', 1095, 'billing123')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
--  Seed default vegetables (insert only if table is empty)
-- ============================================================
INSERT INTO items (name, unit, price)
SELECT name, unit, price FROM (VALUES
  ('தேங்காய்',        'எண்ணிக்கை', 23),
  ('தக்காளி',         'கிலோ',       30),
  ('வெங்காயம்',       'கிலோ',       35),
  ('உருளைக்கிழங்கு', 'கிலோ',       47),
  ('கேரட்',           'கிலோ',       82),
  ('பீன்ஸ்',          'கிலோ',       60),
  ('காலிஃபிளவர்',    'கிலோ',       45),
  ('முட்டைகோஸ்',      'கிலோ',       46),
  ('கத்தரிக்காய்',    'கிலோ',       25),
  ('வாழைக்காய்',      'கிலோ',       30),
  ('கோவைக்காய்',      'கிலோ',       35),
  ('பீர்க்கங்காய்',   'கிலோ',       25),
  ('சுரக்காய்',        'கிலோ',       28),
  ('பாவக்காய்',        'கிலோ',       14),
  ('முள்ளங்கி',        'கிலோ',       22),
  ('பூசணிக்காய்',      'கிலோ',       20),
  ('கேப்சிகம்',        'கிலோ',       45),
  ('வெள்ளரிக்காய்',   'கிலோ',       20),
  ('கொத்தவரங்காய்',   'கிலோ',       50),
  ('அவரைக்காய்',       'கிலோ',       40),
  ('பச்சை மிளகாய்',   'கிலோ',       33),
  ('கொத்தமல்லி',       'கட்டு',       5),
  ('கறிவேப்பிலை',      'கட்டு',       5),
  ('இஞ்சி',            'கிலோ',       80),
  ('பூண்டு',           'கிலோ',       90)
) AS v(name, unit, price)
WHERE NOT EXISTS (SELECT 1 FROM items LIMIT 1);

-- ============================================================
--  Useful indexes for faster queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bills_date      ON bills     (date_iso);
CREATE INDEX IF NOT EXISTS idx_bills_customer  ON bills     (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date   ON payments  (date_iso);
CREATE INDEX IF NOT EXISTS idx_payments_cust   ON payments  (customer_id);

-- Done! You should see 5 tables in your Supabase dashboard.
-- Next step: copy your Supabase URL and service_role key into Render env vars.
