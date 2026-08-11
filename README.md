# காய்கறி பில்லிங் — Vegetable Billing System

ஒரு எளிய, தமிழ் மொழி பில்லிங் சாஃப்ட்வேர் — மொத்த காய்கறி வியாபாரிகளுக்காக.
A simple Tamil billing system for B2B vegetable wholesale shops.

---

## 🚀 எப்படி பயன்படுத்துவது / How to use

1. இந்த `veggie-billing` ஃபோல்டரை எங்கு வேண்டுமானாலும் (Desktop, Documents) வைக்கவும்.
2. `index.html` ஃபைலை **டபுள் கிளிக்** செய்து, எந்த browser-ல் (Chrome / Edge) வேண்டுமானாலும் திறக்கவும்.
3. அவ்வளவுதான் — இன்ஸ்டால் தேவையில்லை, இன்டர்நெட் தேவையில்லை (Tamil font-க்கு மட்டும் முதல் முறை இன்டர்நெட் இருந்தால் நல்லது).
4. பயன்படுத்த விரும்பும் கணினியின் Desktop-ல் `index.html` -க்கு ஒரு shortcut வைத்துக் கொள்ளலாம்.

> ⚠️ **முக்கியம்:** எல்லா தரவும் (பொருட்கள், வாடிக்கையாளர், பில்கள்) இந்த browser-ல் மட்டும் சேமிக்கப்படும் (localStorage).
> பிரவுசர் history/cache-ஐ "Clear" செய்தால் தரவு அழியக்கூடும். எனவே **அமைப்புகள் → தரவு காப்பு** பகுதியில் இருந்து
> அடிக்கடி (வாரம் ஒரு முறை) "தரவு பதிவிறக்கம் (JSON)" செய்து ஒரு பேக்அப் கோப்பை வைத்துக் கொள்ளுங்கள்.

---

## 📋 அம்சங்கள் / Features

### 1. முகப்பு (Dashboard)
- இன்றைய & இந்த மாத விற்பனை
- மொத்த நிலுவை (எல்லா வாடிக்கையாளர்களின் பாக்கி கூட்டுத்தொகை)
- சமீபத்திய பில்கள் பட்டியல்

### 2. புதிய பில் (New Bill)
- வாடிக்கையாளரை தேர்வு செய்யவும் (அல்லது "+ புதியவர்" மூலம் உடனே சேர்க்கவும்)
- பொருள், அளவு (கிலோ/எண்ணிக்கை/கட்டு) தேர்வு செய்ய, விலை தானாக நிரப்பப்படும் — தேவைப்பட்டால் மாற்றலாம்
- "+ வரிசை சேர்" மூலம் எத்தனை பொருட்களை வேண்டுமானாலும் சேர்க்கலாம்
- **முன் பாக்கி** வாடிக்கையாளரின் முந்தைய நிலுவையில் இருந்து தானாக கணக்கிடப்படும்
- **மொத்தம்** = இன்றைய தொகை + முன் பாக்கி
- "பில் சேமி & காண்பி" பொத்தானை அழுத்தினால் — மொத்த உண்மை பில் ஃபார்மட்டில் பில் தோன்றும்

### 3. பில் (Receipt) preview
- **🖨 பிரிண்ட் / PDF** — பிரிண்டர் இருந்தால் பிரிண்ட் செய்யலாம், இல்லையெனில் "Save as PDF" தேர்வு செய்து
  PDF ஆக சேமித்து வாடிக்கையாளருக்கு அனுப்பலாம்.
- **📲 WhatsApp அனுப்பு** — பில் விவரங்களுடன் WhatsApp திறந்து, வாடிக்கையாளரின் நம்பருக்கு
  (அவர் நம்பர் சேர்த்திருந்தால்) நேரடியாக அனுப்பலாம்.

### 4. பொருட்கள் (Items)
- 25 காய்கறி வகைகள் already சேர்க்கப்பட்டுள்ளன
- புதிய பொருள் சேர்க்கலாம் (எத்தனை வேண்டுமானாலும்)
- ஒவ்வொரு பொருளுக்கும் அலகு (கிலோ/எண்ணிக்கை/கட்டு/மூட்டை) மற்றும் தினசரி விலையை மாற்றலாம்
- தினமும் காலையில் இங்கு வந்து அன்றைய சந்தை விலையை புதுப்பிக்கலாம்

### 5. வாடிக்கையாளர் (Customers)
- கடைகளின் பெயர், WhatsApp நம்பர் மற்றும் நிலுவை (பாக்கி) நிர்வகிக்கலாம்
- ஒரு பில் சேமிக்கும்போது, அந்த வாடிக்கையாளரின் நிலுவை தானாக புதுப்பிக்கப்படும்

### 6. அறிக்கை (Reports)
- தொடக்க தேதி & முடிவு தேதியை தேர்வு செய்து "அறிக்கை காண்பி" அழுத்தவும்
- அந்த காலத்தில் உருவான எல்லா பில்களும், மொத்த விற்பனை, சராசரி பில் தொகை காண்பிக்கப்படும்
- "⬇ CSV பதிவிறக்கம்" மூலம் Excel-ல் திறக்கக்கூடிய ஃபைலாக பதிவிறக்கலாம்

### 7. அமைப்புகள் (Settings)
- பில்லில் தோன்றும் கடை பெயர், முகவரி, தொலைபேசி எண், உரிமையாளர் பெயர் மற்றும்
  அடுத்த பில் எண்ணை இங்கு மாற்றலாம்
- **தரவு காப்பு**: ஒரு JSON ஃபைல் பதிவிறக்கி வைத்துக் கொள்ளலாம், அல்லது மீட்டமைக்கலாம்

---

## 🔧 Akash-க்கு (Developer notes)

- **Tech stack**: Pure HTML + CSS + Vanilla JS — no build step, no backend, no dependencies (except Google Fonts via CDN, which gracefully falls back to system fonts if offline).
- **Storage**: `localStorage`, keys prefixed `vb_` (`vb_shop`, `vb_items`, `vb_customers`, `vb_bills`).
- **Files**:
  - `index.html` — structure & all tab markup
  - `style.css` — theme (cream/green/marigold, "torn paper" receipt motif)
  - `app.js` — all logic (rendering, billing, reports, print, WhatsApp)
- **To customize defaults** (shop name, starting bill number, default vegetable list & prices),
  edit the `DEFAULT_SHOP` and `DEFAULT_ITEMS` objects at the top of `app.js` — but note these only
  apply on a *fresh* browser with no existing `localStorage` data. Existing installs should use the
  **Settings → Items** tabs in the UI instead.
- **WhatsApp share** uses the public `wa.me` link (`https://wa.me/<number>?text=...`), which opens
  WhatsApp Web/Desktop/App with the message pre-filled — the user still has to tap "Send". This
  needs an internet connection at the moment of sharing (the rest of the app works fully offline).
- **PDF download** intentionally relies on the browser's native "Print → Save as PDF", which works
  100% offline and avoids adding a heavy library like html2canvas/jsPDF just for this.
- Possible future upgrades: multi-user login, server-side sync (e.g. Supabase) so the owner can
  access bills from a phone too, automatic daily WhatsApp summary, item categories/grouping.

---

## 📦 What's in this ZIP

```
veggie-billing/
├── index.html
├── style.css
├── app.js
└── README.md
```

Just unzip and open `index.html`. No installation required.
