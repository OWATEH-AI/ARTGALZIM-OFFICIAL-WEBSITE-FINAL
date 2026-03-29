/**
 * ARTGALZIM Admin Server
 * Local backend for uploading artworks, managing exhibitions & page content.
 * Run: node admin-server.cjs
 * Listens on http://localhost:3747
 */

const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const { exec } = require('child_process');

const app  = express();
const PORT = 3747;
const ROOT = __dirname;

/* ── Middleware ────────────────────────────────── */
app.use(cors());
app.use(express.json());
// Serve the entire project as static files (for reading images paths)
app.use(express.static(ROOT));

/* ── Paths ─────────────────────────────────────── */
const ARTISTS_DIR   = path.join(ROOT, 'ARTISTS');
const MAIN_IMG_DIR  = path.join(ROOT, 'images', 'MAIN IMAGES');
const CONTENT_FILE  = path.join(ROOT, 'js', 'admin-content.json');
const EXHIBITIONS_F = path.join(ROOT, 'js', 'exhibitions-data.json');

/* ── Helpers ────────────────────────────────────── */
function readJSON(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function runSync(cb) {
  exec('node sync-gallery.cjs', { cwd: ROOT }, (err, stdout) => {
    if (cb) cb(err, stdout);
  });
}
function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

/* ── Multer config for artist artwork uploads ──── */
const artworkStorage = multer.diskStorage({
  destination(req, file, cb) {
    const artist   = (req.body.artist   || req.query.artist || 'Unknown Artist').trim();
    const category = (req.body.category || req.query.category || 'Artworks').trim();
    const dest = path.join(ARTISTS_DIR, artist, category);
    ensureDir(dest);
    cb(null, dest);
  },
  filename(req, file, cb) {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, safe);
  }
});
const artworkUpload = multer({ storage: artworkStorage });

/* ── Multer config for page/hero image uploads ── */
const heroStorage = multer.diskStorage({
  destination(req, file, cb) {
    const page = (req.body.page || req.query.page || 'home').trim();
    const dest = path.join(MAIN_IMG_DIR, page);
    ensureDir(dest);
    cb(null, dest);
  },
  filename(req, file, cb) {
    const fix = req.body.fixedName || req.query.fixedName;
    cb(null, fix || file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_'));
  }
});
const heroUpload = multer({ storage: heroStorage });

/* ══════════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════════ */

/* ── GET /api/artists ─── list artist folders */
app.get('/api/artists', (req, res) => {
  if (!fs.existsSync(ARTISTS_DIR)) return res.json([]);
  const artists = fs.readdirSync(ARTISTS_DIR).filter(f => {
    return fs.lstatSync(path.join(ARTISTS_DIR, f)).isDirectory();
  }).map(artist => {
    const artistPath = path.join(ARTISTS_DIR, artist);
    const categories = fs.readdirSync(artistPath).filter(c =>
      fs.lstatSync(path.join(artistPath, c)).isDirectory()
    ).map(cat => {
      const catPath = path.join(artistPath, cat);
      const files = fs.readdirSync(catPath).filter(f =>
        ['.png','.jpg','.jpeg','.webp','.gif'].includes(path.extname(f).toLowerCase())
      );
      return { name: cat, imageCount: files.length, images: files.map(f => `ARTISTS/${artist}/${cat}/${f}`) };
    });
    return { name: artist, categories };
  });
  res.json(artists);
});

/* ── POST /api/upload-artwork ─── upload images to artist folder */
app.post('/api/upload-artwork', (req, res, next) => {
  // multer needs body fields before file, so parse body first via busboy-style approach
  // We use fields() to accept both text and files
  const upload = multer({ storage: artworkStorage }).array('images', 20);
  upload(req, res, err => {
    if (err) return res.status(500).json({ error: err.message });
    runSync(() => {
      res.json({ ok: true, files: req.files.map(f => f.filename), message: 'Uploaded & gallery synced.' });
    });
  });
});

/* ── DELETE /api/delete-artwork ─── remove image from artist folder */
app.delete('/api/delete-artwork', (req, res) => {
  const { artist, category, filename } = req.body;
  if (!artist || !category || !filename) return res.status(400).json({ error: 'Missing fields' });
  const target = path.join(ARTISTS_DIR, artist, category, filename);
  if (!fs.existsSync(target)) return res.status(404).json({ error: 'File not found' });
  fs.unlinkSync(target);
  runSync(() => res.json({ ok: true }));
});

/* ── POST /api/create-artist-folder ─── create new artist + category */
app.post('/api/create-artist-folder', (req, res) => {
  const { artist, category } = req.body;
  if (!artist) return res.status(400).json({ error: 'artist required' });
  const dir = path.join(ARTISTS_DIR, artist.trim(), (category || 'Artworks').trim());
  ensureDir(dir);
  res.json({ ok: true, path: dir });
});

/* ── POST /api/upload-hero ─── upload a page hero/banner image */
app.post('/api/upload-hero', heroUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  runSync(() => res.json({ ok: true, file: req.file.filename }));
});

/* ── GET /api/exhibitions ─── list all exhibitions */
app.get('/api/exhibitions', (req, res) => {
  res.json(readJSON(EXHIBITIONS_F, []));
});

/* ── POST /api/exhibitions ─── add or update exhibition */
app.post('/api/exhibitions', (req, res) => {
  const list = readJSON(EXHIBITIONS_F, []);
  const item = req.body;
  if (!item.id) item.id = Date.now().toString();
  const idx = list.findIndex(e => e.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  writeJSON(EXHIBITIONS_F, list);
  // Write frontend JS too
  const jsOut = `window.ExhibitionsData = ${JSON.stringify(list, null, 2)};\n`;
  fs.writeFileSync(path.join(ROOT, 'js', 'exhibitions-data.js'), jsOut);
  res.json({ ok: true, id: item.id });
});

/* ── DELETE /api/exhibitions/:id ─── remove exhibition */
app.delete('/api/exhibitions/:id', (req, res) => {
  let list = readJSON(EXHIBITIONS_F, []);
  list = list.filter(e => e.id !== req.params.id);
  writeJSON(EXHIBITIONS_F, list);
  const jsOut = `window.ExhibitionsData = ${JSON.stringify(list, null, 2)};\n`;
  fs.writeFileSync(path.join(ROOT, 'js', 'exhibitions-data.js'), jsOut);
  res.json({ ok: true });
});

/* ── GET /api/content ─── get page content config */
app.get('/api/content', (req, res) => {
  res.json(readJSON(CONTENT_FILE, {}));
});

/* ── POST /api/content ─── update page content config */
app.post('/api/content', (req, res) => {
  const existing = readJSON(CONTENT_FILE, {});
  const updated  = { ...existing, ...req.body };
  writeJSON(CONTENT_FILE, updated);
  // Also expose as JS global
  const jsOut = `window.AdminContent = ${JSON.stringify(updated, null, 2)};\n`;
  fs.writeFileSync(path.join(ROOT, 'js', 'admin-content.js'), jsOut);
  res.json({ ok: true });
});

/* ── POST /api/sync ─── manually trigger gallery sync */
app.post('/api/sync', (req, res) => {
  runSync((err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, output: stdout });
  });
});

/* ── Start ─────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n🎨 ARTGALZIM Admin Server running at http://localhost:${PORT}`);
  console.log(`   Open admin panel at: http://localhost:5299/admin.html\n`);
});
