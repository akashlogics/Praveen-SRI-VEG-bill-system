# SRI K.M. VEGETABLES — பில்லிங் & கணக்கு (Supabase + Render)

இது localStorage பதிப்பில் இருந்து Supabase-க்கு மாற்றப்பட்ட பதிப்பு. மொபைலிலும்
லேப்டாப்பிலும் ஒரே தரவை, தானாக sync ஆகும் நிலையில் பார்க்கலாம். ஒரே ஒரு
கடை PIN மூலம் பாதுகாக்கப்பட்டுள்ளது.

---

## 📦 என்ன மாறியது

| | பழைய பதிப்பு (localStorage) | இந்த பதிப்பு (Supabase) |
|---|---|---|
| தரவு எங்கே | ஒவ்வொரு பிரவுசரிலும் தனித்தனியாக | ஒரே Supabase database, எல்லா சாதனங்களுக்கும் common |
| மொபைல் ↔ லேப்டாப் sync | இல்லை (manual JSON export/import) | தானாக (இரண்டும் ஒரே DB-யை பார்க்கும்) |
| Login | இல்லை | ஒரே கடை PIN (Supabase Auth மூலம்) |
| Hosting | எந்த static host-லும் (Netlify போன்றவை) | Render (Node/Express சர்வர்) |
| Bill logo | Text-ஆல் உருவாக்கப்பட்டது | உங்கள் அசல் letterhead படம் (`assets/logo.png`) |
| Bill share | WhatsApp + Print பொத்தான்கள் | "பில் சேமி" (image download) + "பகிர் (Share)" — 3-inch thermal printer app உட்பட எந்த app-க்கும் |

---

## 🗂 திட்ட அமைப்பு

```
skv-supabase/
├── server.js              ← Render-க்கான Express static server
├── package.json
├── public/                 ← முழு front-end (இதுவே பயனர் பார்ப்பது)
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── db.js                ← Supabase-உடன் பேசும் அடுக்கு
│   ├── config.js            ← Supabase URL/Key இங்கு நிரப்பவும் (கீழே பாருங்கள்)
│   └── assets/logo.png      ← அசல் letterhead படம்
└── supabase/
    └── schema.sql           ← Database அட்டவணைகள் + பாதுகாப்பு விதிகள் (RLS)
```

---

## 🚀 Setup — படிப்படியாக

### படி 1: Supabase project உருவாக்கவும்

1. [supabase.com](https://supabase.com) → New Project.
2. திட்டம் உருவானதும், இடதுபுறம் **SQL Editor** → New query.
3. `supabase/schema.sql` கோப்பின் முழு உள்ளடக்கத்தையும் நகலெடுத்து, ஒட்டி, **Run** செய்யவும்.
   - இது 5 அட்டவணைகளை (shop_settings, items, customers, bills, payments)
     உருவாக்கும், default காய்கறி பட்டியலை சேர்க்கும், மற்றும் பாதுகாப்பு
     விதிகளையும் (RLS) அமைக்கும்.
   - மீண்டும் ரன் செய்தாலும் பிரச்சனை இல்லை (`IF NOT EXISTS` / `ON CONFLICT`).

### படி 2: ஒரே கடை PIN-ஐ உருவாக்கவும்

1. Supabase Dashboard → **Authentication** → **Providers** → Email-ஐ கண்டுபிடித்து,
   **"Confirm email"** என்ற setting-ஐ **OFF** செய்யவும் (இல்லையெனில் login வேலை செய்யாது,
   ஏனெனில் இது ஒரு real email address அல்ல).
2. **Authentication** → **Users** → **Add user** → **Create new user**.
   - Email: `shop@sri-km-vegetables.local` (இதே மாதிரி வேறு எதுவும் பயன்படுத்தலாம்,
     ஆனால் `public/config.js`-ல் உள்ள `loginEmail`-உடன் **சரியாக பொருந்த வேண்டும்**).
   - Password: **இதுவே கடை PIN்** — உதாரணமாக `2580` அல்லது `SriKM2026` — அவர் எதை
     கடையில் பயன்படுத்த வேண்டுமோ அதை இங்கே டைப் செய்யவும்.
   - "Auto Confirm User" ✅ ஆக்கவும்.
3. PIN-ஐ பின்னாளில் மாற்ற வேண்டுமெனில்: இதே Users பட்டியலில் அந்த user-ஐ க்ளிக்
   செய்து "Reset Password" செய்யலாம்.

### படி 3: `public/config.js`-ஐ நிரப்பவும்

Supabase Dashboard → **Project Settings** → **API**-ல் இருந்து:

```js
const SUPABASE_CONFIG = {
  url: 'https://xxxxxxxxxxxx.supabase.co',   // "Project URL"
  anonKey: 'eyJhbGciOiJI...',                 // "anon" "public" key (Project API keys)
  loginEmail: 'shop@sri-km-vegetables.local'  // படி 2-ல் உருவாக்கிய அதே email
};
```

> ⚠️ **`service_role` key-ஐ ஒருபோதும் இங்கு பயன்படுத்த வேண்டாம்** — அது
> முழு database-க்கும் நிர்வாக அனுமதி கொண்டது, மறைவாக மட்டுமே server-side
> பயன்படுத்தப்பட வேண்டும். `anon` key மட்டுமே frontend-க்கு பாதுகாப்பானது
> (RLS விதிகள்தான் இங்கே பாதுகாப்பை கொடுக்கின்றன, key அல்ல).

### படி 4: Render-ல் Deploy செய்யவும்

1. இந்த `skv-supabase` ஃபோல்டரை ஒரு புதிய GitHub repo-வாக push செய்யவும்
   (உங்கள் `akashlogics` account-ல்).
2. [render.com](https://render.com) → **New** → **Web Service** → அந்த repo-வை select செய்யவும்.
3. அமைப்புகள்:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
4. Deploy ஆனதும், Render ஒரு URL தரும் (எ.கா. `https://sri-km-vegetables.onrender.com`) —
   அதையே கடைக்காரருக்கு கொடுக்கலாம் (Home screen-ல் "Add to Home Screen" செய்ய சொல்லுங்கள்,
   ஒரு app போல தெரியும்).

> 💡 **Render free tier note**: இயங்காமல் சிறிது நேரம் இருந்தால் "cold start" ஆகி
> முதல் load சற்று மெதுவாக இருக்கும் (உங்கள் மற்ற Render projects போலவே). வேண்டுமெனில்
> cron-job.org மூலம் ஒவ்வொரு 10-14 நிமிடங்களுக்கும் ping வைக்கலாம்.
> **Supabase free tier**: 7 நாட்கள் யாரும் பயன்படுத்தாவிட்டால் project pause
> ஆகிவிடும் — cron-job.org மூலம் 2-3 நாட்களுக்கு ஒருமுறை ping வைத்தால் தடுக்கலாம்.

---

## 🔑 எப்படி பயன்படுத்துவது (கடைக்காரருக்கு)

1. URL-ஐ திறக்கவும் (மொபைல் அல்லது லேப்டாப்) — ஒரு PIN கேட்கும்.
2. Setup-ல் நீங்கள் வைத்த PIN-ஐ டைப் செய்யவும் → "நுழை".
3. இதற்குப் பிறகு, மொபைலில் போட்ட பில் உடனே லேப்டாப்பிலும் தெரியும் — refresh
   செய்தால் போதும்.
4. வெளியேற "🔒 வெளியேறு" பொத்தானை Sidebar-ல் காணலாம்.

### பில் → Save/Share flow

- ஒரு பில் போட்டு "பில் சேமி & காண்பி" அழுத்தினதும், preview தெரியும்.
- **✕ மூடு**: preview-ஐ மூடும் (மேலே மூலையில் இருந்த சிறிய "✕"-க்கு பதிலாக,
  மொபைலில் தெளிவாக தெரியும் ஒரு பெரிய பொத்தானாக இப்போது கீழே சேர்க்கப்பட்டுள்ளது).
- **💾 பில் சேமி**: பில்லை ஒரு படமாக (PNG) மொபைலில்/கணினியில் பதிவிறக்குகிறது.
- **📤 பகிர் (Share)**: மொபைலின் native "Share" sheet-ஐ திறக்கும் — இதிலிருந்து
  WhatsApp, Bluetooth, அல்லது 3-inch thermal printer app (எ.கா. RawBT) எதை
  வேண்டுமானாலும் தேர்வு செய்யலாம். Printer app பில்லை படமாக பெற்று, நேரடியாக
  பிரிண்ட் செய்யும்.
- Desktop Chrome-ல் "Share" கிடைக்காவிட்டால், தானாக படமாக பதிவிறக்கும் —
  பிறகு அதை manual-ஆக இணைக்கலாம்.

### பில் நீக்குதல் (Delete a bill) — தவறாக போட்ட பில்லை நீக்க
- **Dashboard**-ல் "சமீபத்திய பில்கள்" பட்டியலிலும், **அறிக்கை (Reports)** தாவலிலும்
  ஒவ்வொரு பில் வரிசையிலும் ஒரு 🗑 பொத்தான் உண்டு.
- "காண்க" அழுத்தி பில்லை திறந்தாலும், அந்த preview-ன் அடியில் "🗑 இந்த பில்லை
  நீக்கு" என்ற சிறிய இணைப்பு உண்டு.
- நீக்கும் முன் உறுதிப்படுத்தல் கேட்கும் (பில் எண், வாடிக்கையாளர் பெயர், தொகை
  காட்டி). நீக்கியதும் அந்த வாடிக்கையாளரின் பாக்கி தொகை தானாகவே சரியாக
  மாறும் (ஏனெனில் பாக்கி எப்போதும் "opening + பில்கள் − பணம் பெற்றது" மூலம்
  கணக்கிடப்படுகிறது, எந்த extra adjustment தேவையில்லை).
- பில் எண் மீண்டும் பயன்படுத்தப்படாது (நீக்கப்பட்ட எண் ஒரு இடைவெளியாக
  இருக்கும் — இதுவே சரியான கணக்கு நடைமுறை).
- ஏற்கனவே deploy செய்த Render site-ல் **இந்த `public/` கோப்புகளை மட்டும்
  மாற்றி மறு-deploy செய்தால் போதும்** — Supabase schema-வில் எந்த மாற்றமும்
  தேவையில்லை (already உள்ள `bills` table-லேயே ஒரு row delete செய்யப்படுகிறது).

### "Back" பொத்தான் அழுத்தினால் Log out ஆனது போல் தெரிந்த பிரச்சனை — சரி செய்யப்பட்டது
இது cookie பிரச்சனை **இல்லை** (Supabase session localStorage-ல்தான்
வைக்கப்படுகிறது, page reload செய்தாலும் இழக்காது). உண்மையான காரணம்: பில்
preview / பணம் பெறுதல் போன்ற modal-கள் திறக்கும்போது browser-க்கு அது
"ஒரு புதிய பக்கம்" என தெரியாது — எனவே Back அழுத்தும்போது browser நேரடியாக
app-ஐ விட்டு வெளியேறிவிடும் (login திரைக்கு போவதாக அல்ல, முழுவதுமாக
வெளியேறியது போல் தோன்றும்). இப்போது ஒரு modal திறக்கும்போது browser
history-ல் ஒரு entry சேர்க்கப்படுகிறது — Back அழுத்தினால் (அல்லது Back
gesture செய்தால்) அந்த modal மட்டும் மூடிக்கொள்ளும், app-ஐ விட்டு
வெளியேறாது. (See `openModal()` / `closeModal()` / the `popstate`
listener near the bottom of `app.js`.)

### நாள் கணக்கு (Daily Ledger) — இப்போது Excel (.xlsx) பதிவிறக்கம்
முன்பு CSV-ஆக இருந்தது — Tamil எழுத்துக்கள் CSV-ல் Excel-ல் திறக்கும்போது
சில நேரம் garbled ஆக தெரியும் பிரச்சனை இருந்தது. இப்போது ஒரு உண்மையான
`.xlsx` பைலாக பதிவிறக்கப்படுகிறது (SheetJS மூலம், client-side-லேயே
உருவாக்கப்படுகிறது — server தேவையில்லை):
- அன்று பொருள் வாங்காத / பணம் தராத வாடிக்கையாளர்களும் **0-ஆக பட்டியலில்
  அப்படியே இருப்பார்கள்** — யாரும் பட்டியலில் இருந்து விடுபடமாட்டார்கள்,
  இது தினமும் அனைவரையும் ஒரு பார்வையில் சரிபார்க்க (verify) உதவும்.
  (இது தானாகவே Daily Ledger-ன் இயல்பான நடத்தை — புதிதாக மாற்றியதில்லை,
  ஏற்கனவே ஒவ்வொரு வாடிக்கையாளரும் அன்றைய வாங்கல்/பணம் இல்லாவிட்டாலும்
  பட்டியலில் இருப்பார்கள்.)
- தொகைகள் Excel-ல் **உண்மையான எண்களாக** (text-ஆக அல்ல) இருக்கும் — எனவே
  ஒரு column-ஐ select செய்தால் Excel-ன் status bar-ல் தானாகவே கூட்டுத்தொகை
  (sum) தெரியும், app-ல் காட்டும் மொத்தத்துடன் ஒப்பிட்டு சரிபார்க்கலாம்.
- கடைசி வரிசையில் மொத்தம் (column totals) உள்ளது.

---

## 🔧 Akash-க்கு (Developer notes)

### Auth design — ஏன் இப்படி?
ஒரே shared "shop PIN" வேண்டும் என்பதால், ஒரே Supabase Auth user (`config.js`-ல்
உள்ள `loginEmail`) உருவாக்கப்பட்டு, அவரது password-ஆகவே PIN வைக்கப்பட்டுள்ளது.
RLS policies எல்லா அட்டவணைகளுக்கும் `auth.role() = 'authenticated'` — அதாவது,
யாராவது login ஆகியிருந்தால் (yes/no மட்டும், ownership கிடையாது) படிக்க/எழுத
முடியும். இது ஒரு single-shop, single-shared-login app-க்கு போதுமான
பாதுகாப்பு நிலை; தனி தனி staff logins தேவைப்பட்டால் பின்னர் table-க்கு
`user_id` column சேர்த்து per-row RLS-ஆக மாற்றலாம்.

`anon` key-ஐ frontend-ல் வெளிப்படையாக வைத்திருப்பது intentional — Supabase
design-ல் அதுதான் expected pattern; பாதுகாப்பு RLS policies-ல் இருக்கிறது,
key-ஐ மறைப்பதில் இல்லை.

### Data layer design
`app.js`-ன் render logic-ஐ **மாற்றவே இல்லை** — `shop`, `items`, `customers`,
`bills`, `payments` இன்னும் அதே பெயரில் in-memory arrays-ஆக இருக்கின்றன.
Login ஆனதும் `DB.fetchAll()` இந்த arrays-ஐ நிரப்புகிறது; ஒவ்வொரு
add/edit/delete-லும் `DB.upsertX()` / `DB.deleteX()` அழைக்கப்பட்டு, பிறகு
local array-யும் புதுப்பிக்கப்படுகிறது (optimistic — Supabase call
succeed ஆனதும் UI update ஆகும்).

- `bills`, `payments` — insert-only from the UI (edit/delete கிடையாது,
  பழையதைப் போலவே). Data Cleanup மட்டும் bulk delete செய்யும்
  (`DB.deleteBillsBefore` / `deletePaymentsBefore`).
- Balance model **அப்படியே**: `openingBalance + Σ bills − Σ payments`,
  ஏற்கனவே localStorage பதிப்பில் விளக்கியது போலவே.
- `createdAt` ms-timestamp `bills.created_at_ms` / `payments.created_at_ms`
  columns-ல் அப்படியே சேமிக்கப்படுகிறது, dashboard/report-ல் உள்ள sort
  order மாறாமல் இருக்க.

### Files touched for this migration
- `public/config.js` — **புதியது**, Supabase project settings.
- `public/db.js` — **புதியது**, முழு Supabase read/write layer.
- `public/app.js` — localStorage `load()`/`save()` calls நீக்கப்பட்டு,
  அதற்கு பதிலாக `DB.*` async calls; ஒரு login/boot flow சேர்க்கப்பட்டது
  (கடைசி பகுதி, "AUTH / BOOT").
- `public/index.html` — login gate markup, `#appShell` wrapper,
  Supabase-js CDN script tag.
- `server.js`, `package.json` — **புதியது**, Render deployment-க்கான
  minimal Express static server (data layer-க்கு தேவையில்லை, ஆனால் உங்கள்
  மற்ற Render projects-ஐ போலவே `public/` subfolder convention-ஐ
  பின்பற்ற வைக்கிறது).

### Local testing
```bash
npm install
npm start
# http://localhost:3000
```
`public/config.js`-ல் சரியான Supabase URL/key இல்லாவிட்டால் login screen
"இணைய பிழை" காட்டும் — அதுவே சரியாக wiring செய்யப்படவில்லை என்பதற்கான signal.

### Client isolation (உங்கள் மற்ற projects-ஐ போலவே)
இந்த Supabase project-ஐ SRI K.M. VEGETABLES-க்கு மட்டும் என தனி Organization/
Workspace-ஆக வைத்து, அவரை Owner-ஆக day 1-லேயே invite செய்யுங்கள் — உங்கள்
established pattern படி.
