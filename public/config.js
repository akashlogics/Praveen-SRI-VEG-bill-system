/* ============================================================
   config.js — Supabase project settings for SRI K.M. VEGETABLES
   ============================================================
   Fill these in after creating the Supabase project (see README.md,
   step "Create the Supabase project"). Both values are meant to be
   public — the anon key is safe to ship in the browser because the
   database's Row Level Security (RLS) policies (supabase/schema.sql)
   are what actually decide who can read/write, not this key.

   LOGIN_EMAIL is NOT shown to the shop owner anywhere in the UI —
   he only ever types the PIN. It's just the "username" half of the
   one shared Supabase Auth account behind the PIN screen. It can be
   any syntactically valid email; it doesn't need to be real or
   receive mail. Create the matching user in the Supabase dashboard
   under Authentication → Users (see README.md).
   ============================================================ */

const SUPABASE_CONFIG = {
  url: 'https://llhjsrfipnndjmbxywuu.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaGpzcmZpcG5uZGptYnh5d3V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTI5MjcsImV4cCI6MjEwMjYyODkyN30.ARFURBO0XtACTSziPOmjULR4ajd56BWLGbU5nQ4h0OY',
  loginEmail: 'mk7740361@gmail.com'
};
