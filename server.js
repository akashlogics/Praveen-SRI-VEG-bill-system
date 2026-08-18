/* ============================================================
   SRI K.M. VEGETABLES — static file server for Render
   All actual data lives in Supabase; this server just serves the
   front-end (public/) so the app has a URL. No API routes needed —
   the browser talks to Supabase directly using the anon key in
   public/config.js, protected by Row Level Security (see
   supabase/schema.sql).
   ============================================================ */
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Any unknown path falls back to index.html (keeps things working
// even if a link gets bookmarked with a trailing path).
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SRI K.M. VEGETABLES billing app running on port ${PORT}`);
});
