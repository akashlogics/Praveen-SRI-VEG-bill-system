-- ============================================================
-- SRI K.M. VEGETABLES — Supabase schema
-- Run this once in Supabase Dashboard → SQL Editor → New query.
-- Safe to re-run: every statement uses IF NOT EXISTS / ON CONFLICT.
-- ============================================================

-- ---------- shop_settings (single row, id = 1) ----------
create table if not exists shop_settings (
  id int primary key default 1,
  tagline text default '',
  name text not null default 'SRI',
  name_mid text default 'K.M.',
  name_bottom text default 'VEGETABLES',
  sub text default 'Wholesale Suppliers',
  address text default '29/434 U.M.C. Market, Ooty.',
  phone text default '94434 06210, 84383 85779',
  next_bill_no int not null default 1001,
  updated_at timestamptz default now(),
  constraint shop_settings_singleton check (id = 1)
);

insert into shop_settings (id) values (1)
  on conflict (id) do nothing;

-- ---------- items (vegetable price list) ----------
create table if not exists items (
  id text primary key,
  name text not null,
  unit text not null default 'கிலோ',
  price numeric not null default 0
);

insert into items (id, name, unit, price) values
  ('it1',  'சுரக்காய்',        'கிலோ', 28),
  ('it2',  'பாவக்காய்',        'கிலோ', 14),
  ('it3',  'தக்காளி',          'கிலோ', 30),
  ('it4',  'வெங்காயம்',        'கிலோ', 35),
  ('it5',  'உருளைக்கிழங்கு',   'கிலோ', 32),
  ('it6',  'கேரட்',            'கிலோ', 40),
  ('it7',  'பீன்ஸ்',           'கிலோ', 60),
  ('it8',  'கத்தரிக்காய்',     'கிலோ', 25),
  ('it9',  'வாழைக்காய்',       'கிலோ', 30),
  ('it10', 'கோவைக்காய்',       'கிலோ', 35),
  ('it11', 'பீர்க்கங்காய்',    'கிலோ', 25),
  ('it12', 'முள்ளங்கி',        'கிலோ', 22),
  ('it13', 'பூசணிக்காய்',      'கிலோ', 20),
  ('it14', 'கேப்சிகம்',        'கிலோ', 45),
  ('it15', 'காலிஃபிளவர்',      'கிலோ', 35),
  ('it16', 'முட்டைகோஸ்',       'கிலோ', 25),
  ('it17', 'வெள்ளரிக்காய்',    'கிலோ', 20),
  ('it18', 'கொத்தவரங்காய்',    'கிலோ', 50),
  ('it19', 'அவரைக்காய்',       'கிலோ', 40),
  ('it20', 'பச்சை மிளகாய்',    'கிலோ', 50),
  ('it21', 'கொத்தமல்லி',       'கட்டு', 5),
  ('it22', 'கறிவேப்பிலை',      'கட்டு', 5),
  ('it23', 'இஞ்சி',            'கிலோ', 80),
  ('it24', 'பூண்டு',           'கிலோ', 90),
  ('it25', 'கீரை',             'கட்டு', 10)
on conflict (id) do nothing;

-- ---------- customers ----------
create table if not exists customers (
  id text primary key,
  name text not null,
  phone text default '',
  opening_balance numeric not null default 0,
  created_at timestamptz default now()
);

-- ---------- bills (one row per bill; line items kept as JSON,
--            matching the app's in-memory bill shape exactly) ----------
create table if not exists bills (
  id text primary key,
  bill_no int not null,
  customer_id text references customers(id) on delete set null,
  customer_name text,
  customer_phone text default '',
  date_iso date not null,
  time_display text,
  created_at_ms bigint not null,
  items_json jsonb not null default '[]',
  total numeric not null default 0,
  prev_balance numeric not null default 0,
  grand_total numeric not null default 0,
  paid_on_bill_date numeric not null default 0
);
create index if not exists bills_customer_idx on bills(customer_id);
create index if not exists bills_date_idx on bills(date_iso);

-- Migration for an already-deployed database (safe to run even if the
-- column already exists — this whole schema.sql can always be re-run).
alter table bills add column if not exists paid_on_bill_date numeric not null default 0;

-- ---------- payments ("ரூ. கொடுத்தது") ----------
create table if not exists payments (
  id text primary key,
  customer_id text references customers(id) on delete set null,
  date_iso date not null,
  amount numeric not null,
  note text default '',
  created_at_ms bigint not null
);
create index if not exists payments_customer_idx on payments(customer_id);
create index if not exists payments_date_idx on payments(date_iso);

-- ============================================================
-- Row Level Security
-- One shared shop login (the PIN screen signs in as a single
-- Supabase Auth user) — so every table just requires "you are
-- signed in", not per-row ownership.
-- ============================================================
alter table shop_settings enable row level security;
alter table items enable row level security;
alter table customers enable row level security;
alter table bills enable row level security;
alter table payments enable row level security;

drop policy if exists "shop_settings_auth_all" on shop_settings;
create policy "shop_settings_auth_all" on shop_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "items_auth_all" on items;
create policy "items_auth_all" on items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "customers_auth_all" on customers;
create policy "customers_auth_all" on customers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "bills_auth_all" on bills;
create policy "bills_auth_all" on bills
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "payments_auth_all" on payments;
create policy "payments_auth_all" on payments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- After running this file, create the ONE shared login user:
-- Dashboard → Authentication → Users → Add user
--   Email:    shop@sri-km-vegetables.local  (must match config.js loginEmail)
--   Password: <the shop PIN>
--   Auto Confirm User: ON
-- See README.md for the full setup walkthrough.
-- ============================================================
