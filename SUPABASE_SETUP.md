# Supabase + Render Setup Guide
## காய்கறி பில்லிங் v4 — Cloud Database Setup

---

## Why Supabase?
Render's free plan has **no persistent disk** — your data disappears every time Render redeploys.
Supabase gives you a free PostgreSQL cloud database that keeps all your bills, customers, and payments safe permanently.

---

## PART 1 — Create Supabase Account & Database

### Step 1: Create Supabase Account
1. Go to **https://supabase.com**
2. Click **"Start your project"**
3. Sign in with **GitHub** (easiest) or create an email account
4. Click **"New Project"**

### Step 2: Create Your Project
Fill in the form:
- **Organization**: Your name (e.g., "Sabari")
- **Project name**: `veggie-billing`
- **Database Password**: Choose a strong password — **SAVE THIS SOMEWHERE** (you'll need it)
- **Region**: `Southeast Asia (Singapore)` → closest to India for speed
- Click **"Create new project"**
- Wait 2–3 minutes for the project to be ready ⏳

---

## PART 2 — Create the Database Tables

### Step 3: Open SQL Editor
1. In your Supabase project dashboard, click **"SQL Editor"** on the left menu
2. Click **"New Query"**
3. Open the file `supabase-schema.sql` (from this zip) in Notepad
4. **Select All** (Ctrl+A), **Copy** (Ctrl+C)
5. **Paste** it into the Supabase SQL Editor
6. Click the **"Run"** button (▶)
7. You should see: *"Success. No rows returned"*

### Step 4: Verify Tables Were Created
1. Click **"Table Editor"** on the left menu
2. You should see 5 tables:
   - `shop_config` — 1 row (your shop details)
   - `items` — 25 rows (default vegetables)
   - `customers` — empty
   - `bills` — empty
   - `payments` — empty

✅ **Database is ready!**

---

## PART 3 — Get Your Supabase Keys

### Step 5: Copy Your API Keys
1. Click **"Project Settings"** (⚙ gear icon, bottom-left)
2. Click **"API"** tab
3. You need TWO values:

**Value 1 — Project URL:**
```
https://xxxxxxxxxxxxxxxxxxxx.supabase.co
```
(Copy the full URL under "Project URL")

**Value 2 — service_role key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
```
(Click "Reveal" under "Project API keys → service_role → Secret")

> ⚠️ The `service_role` key is powerful — never share it publicly or put it in your frontend code.
> It's safe here because it's only used on the server side (server.js).

---

## PART 4 — Add Keys to Render

### Step 6: Open Your Render Dashboard
1. Go to **https://dashboard.render.com**
2. Click your **veggie-billing** service
3. Click **"Environment"** tab on the left

### Step 7: Add Environment Variables
Click **"Add Environment Variable"** and add these one by one:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` (your Project URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` (your service_role key) |
| `APP_PASSWORD` | `yourshoppassword` (optional — if not set, uses the one in DB) |
| `AUTH_SECRET` | Any random string, e.g., `sabari-veggie-2024` |

Click **"Save Changes"**

### Step 8: Redeploy
1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Wait 1–2 minutes for deploy to complete
3. Open your Render URL (e.g., `https://veggie-billing.onrender.com`)
4. You should see the **login screen** 🎉

---

## PART 5 — First Login & Setup

### Step 9: Log In
- Default password: **`billing123`**
- Or whatever you set as `APP_PASSWORD` in Render

### Step 10: Update Shop Details
1. Go to **அமைப்புகள் (Settings)**
2. Update the shop name, address, phone, owner name
3. Click **"சேமி"**

### Step 11: Change Your Password
1. Still in **அமைப்புகள்**
2. Scroll to **"கடவுச்சொல் மாற்று"**
3. Enter `billing123` as current password
4. Enter your new password (remember it!)
5. Click **"கடவுச்சொல் மாற்று"**

---

## PART 6 — Migrating Old Data (If You Had Bills in v3)

If you had data in the old app and downloaded a backup JSON file:

1. Open the app and login
2. Go to **அமைப்புகள் → தரவு மீட்டமை**
3. Upload your old `veggie-backup_*.json` file
4. Confirm — your old data will be restored to Supabase

---

## Troubleshooting

### "சர்வருடன் இணைக்க முடியவில்லை" error on Render
- Check Render logs: Dashboard → your service → "Logs"
- Verify SUPABASE_URL doesn't have a trailing slash
- Make sure SUPABASE_SERVICE_ROLE_KEY is the **service_role** key, NOT the anon key

### Render app takes 30 seconds to load (first time)
- Render free tier "sleeps" after 15 min of no traffic
- First visit wakes it up — normal behaviour
- To fix: upgrade to Render paid plan ($7/month) OR upgrade Supabase

### Data not saving
- Open browser console (F12) → check for error messages
- Verify in Supabase → Table Editor that rows are being inserted

### Forgot password
- Go to Render → Environment → change `APP_PASSWORD` to a new value
- Redeploy → login with the new password

---

## Monthly Cost Estimate

| Service | Free Tier | Paid |
|---------|-----------|------|
| **Render** (Node.js hosting) | Free (sleeps after 15 min) | $7/month (always on) |
| **Supabase** (database) | Free (500MB, 50,000 rows) | $25/month (8GB) |
| **Total for free** | ₹0/month | — |
| **Total paid (recommended)** | — | ~₹2,700/month |

For a single vegetable shop, the **free tier is more than enough** for years.
Supabase free tier supports ~50,000 bills — that's 136 bills per day for a year.

---

## Quick Reference

| What | Where |
|------|-------|
| Your app URL | `https://[your-service].onrender.com` |
| Supabase dashboard | `https://supabase.com/dashboard` |
| Render dashboard | `https://dashboard.render.com` |
| Default login password | `billing123` |
| Change password | App → Settings → கடவுச்சொல் மாற்று |
| Backup data | App → Settings → தரவு காப்பு |
