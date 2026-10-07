const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const sharp   = require('sharp');
const { exec } = require('child_process');

const app  = express();
const PORT = 3747;
const ROOT = __dirname;

/* ── Middleware ────────────────────────────────── */
require('dotenv').config({ override: true });
const sanityGateway = import('./sanity-gateway.js').then(({ createSanityGateway }) => createSanityGateway(process.env));
app.use('/api', async (req, res, next) => {
  try {
    const headers = new Headers(req.headers);
    ['connection', 'content-length', 'host', 'transfer-encoding'].forEach(name => headers.delete(name));
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const request = new Request(`http://${req.headers.host || 'localhost'}${req.originalUrl}`, {
      method: req.method,
      headers,
      ...(hasBody ? { body: req, duplex: 'half' } : {})
    });
    const response = await (await sanityGateway)(request);
    if (!response) return next();
    res.status(response.status);
    response.headers.forEach((value, name) => {
      if (name.toLowerCase() !== 'set-cookie') res.setHeader(name, value);
    });
    if (response.headers.get('set-cookie')) res.setHeader('set-cookie', response.headers.get('set-cookie'));
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('[Sanity API]', error);
    res.status(500).json({ error: 'Sanity API request failed.' });
  }
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Serve the entire project as static files (for reading images paths)
app.use(express.static(ROOT));

/* ── Paths ─────────────────────────────────────── */
const ARTISTS_DIR    = path.join(ROOT, 'ARTISTS');
const MAIN_IMG_DIR   = path.join(ROOT, 'images', 'MAIN IMAGES');
const CONTENT_FILE   = path.join(ROOT, 'js', 'admin-content.json');
const EXHIBITIONS_F  = path.join(ROOT, 'js', 'exhibitions-data.json');
const METADATA_FILE  = path.join(ROOT, 'js', 'artworks-metadata.json');
const ALBUM_COVERS_F = path.join(ROOT, 'js', 'album-covers.json');
const ARTISTS_TIER_F = path.join(ROOT, 'js', 'artists-tier.json');

/* ── Automatic Lossless-Quality Image Compressor ─ */
async function optimizeImageInPlace(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.size < 50 * 1024) return; // skip already tiny files (<50KB)

    const ext = path.extname(filePath).toLowerCase();
    const tmp = filePath + '.opt.tmp';

    let pipeline = sharp(filePath, { failOn: 'none' })
      .rotate()
      .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true });

    if (ext === '.png') {
      await pipeline.png({ quality: 85, compressionLevel: 8 }).toFile(tmp);
    } else if (ext === '.webp') {
      await pipeline.webp({ quality: 84, effort: 4 }).toFile(tmp);
    } else {
      // JPEG / JPG
      await pipeline.jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(tmp);
    }

    if (fs.existsSync(tmp)) {
      const newStat = fs.statSync(tmp);
      if (newStat.size < stat.size) {
        fs.renameSync(tmp, filePath);
        console.log(`⚡ Auto-Compressed ${path.basename(filePath)}: ${(stat.size/1024).toFixed(0)}KB → ${(newStat.size/1024).toFixed(0)}KB (saved ${((stat.size-newStat.size)/1024).toFixed(0)}KB)`);
      } else {
        fs.unlinkSync(tmp);
      }
    }
  } catch (e) {
    console.warn(`[Auto-Compress] Skipped optimization for ${path.basename(filePath)}:`, e.message);
  }
}

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

function getArtworkMetadata(src, artist, category, filename) {
  const metaStore = readJSON(METADATA_FILE, {});
  const cleanSrc = src.startsWith('/') ? src : '/' + src;
  
  // 1. Direct match by path
  if (metaStore[cleanSrc]) return metaStore[cleanSrc];
  if (metaStore[src]) return metaStore[src];

  // 2. Lookup by relative key without leading slash
  const relKey = `ARTISTS/${artist}/${category}/${filename}`;
  if (metaStore[relKey] || metaStore['/' + relKey]) {
    return metaStore[relKey] || metaStore['/' + relKey];
  }

  // 3. Fallback to clean name formatting
  const baseName = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
  const formattedTitle = baseName.charAt(0).toUpperCase() + baseName.slice(1);

  return {
    title: formattedTitle,
    artist: artist,
    category: category,
    medium: 'Contemporary Work',
    size: 'Inquire for Size',
    year: '2026',
    price: 'Price on Request',
    purchaseType: 'inquire',
    paymentLink: '',
    description: 'Recently added to our collection.'
  };
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
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_ ()`]/g, '_');
    cb(null, safe);
  }
});
const artworkUpload = multer({ storage: artworkStorage });

/* ── Multer config for artwork replacement ──── */
const tempStorage = multer.diskStorage({
  destination(req, file, cb) {
    const tempDir = path.join(ROOT, 'tmp_uploads');
    ensureDir(tempDir);
    cb(null, tempDir);
  },
  filename(req, file, cb) {
    const safe = Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9.\-_ ()`]/g, '_');
    cb(null, safe);
  }
});
const replaceUpload = multer({ storage: tempStorage });

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

/* ── GET /api/artists ─── list artist folders with full artwork details */
app.get('/api/artists', (req, res) => {
  if (!fs.existsSync(ARTISTS_DIR)) return res.json([]);
  const customCovers = readJSON(ALBUM_COVERS_F, {});
  const tierStore    = readJSON(ARTISTS_TIER_F, {});

  const getTier = (name) => {
    if (tierStore[name]) return tierStore[name];
    if (name.toUpperCase().includes('KEITH ZENDA')) return 'Keith Zenda';
    return 'Emerging Artists';
  };

  const artists = fs.readdirSync(ARTISTS_DIR).filter(f => {
    return fs.lstatSync(path.join(ARTISTS_DIR, f)).isDirectory();
  }).map(artist => {
    const artistPath = path.join(ARTISTS_DIR, artist);
    const artistTier = getTier(artist);
    const entries = fs.readdirSync(artistPath);

    // Subdirectories
    const subDirs = entries.filter(c => fs.lstatSync(path.join(artistPath, c)).isDirectory());
    
    // Direct image files in artist folder
    const directFiles = entries.filter(f => {
      const full = path.join(artistPath, f);
      if (fs.lstatSync(full).isDirectory()) return false;
      return ['.png','.jpg','.jpeg','.webp','.gif','.JPG','.JPEG','.PNG'].includes(path.extname(f));
    });

    let categories = subDirs.map(cat => {
      const catPath = path.join(artistPath, cat);
      const files = fs.readdirSync(catPath).filter(f =>
        ['.png','.jpg','.jpeg','.webp','.gif','.JPG','.JPEG','.PNG'].includes(path.extname(f))
      );
      
      const artworks = files.map(f => {
        const src = `/ARTISTS/${artist}/${cat}/${f}`;
        const meta = getArtworkMetadata(src, artist, cat, f);
        return {
          filename: f,
          src: src,
          artist: meta.artist || artist,
          artist_tier: artistTier,
          category: meta.category || cat,
          title: meta.title || f.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
          medium: meta.medium || 'Contemporary Work',
          size: meta.size || 'Inquire for Size',
          year: meta.year || '2026',
          price: meta.price || 'Price on Request',
          purchaseType: meta.purchaseType || (meta.paymentLink ? 'direct' : 'inquire'),
          paymentLink: meta.paymentLink || '',
          description: meta.description || meta.desc || 'Recently added to our collection.'
        };
      });

      // Find cover image (custom chosen cover first)
      const folderKey = `${artist}/${cat}`;
      const imagePaths = files.map(f => `/ARTISTS/${artist}/${cat}/${f}`);
      let coverPath = null;

      if (customCovers[folderKey] && imagePaths.includes(customCovers[folderKey])) {
        coverPath = customCovers[folderKey];
      } else {
        const coverFile = files.find(f => f.toLowerCase().startsWith('cover'));
        coverPath = coverFile ? `/ARTISTS/${artist}/${cat}/${coverFile}` : (files.length > 0 ? `/ARTISTS/${artist}/${cat}/${files[0]}` : null);
      }

      return { 
        name: cat, 
        imageCount: files.length, 
        cover: coverPath,
        images: imagePaths,
        artworks: artworks
      };
    });

    // If direct image files exist inside artist folder
    if (directFiles.length > 0) {
      const directArtworks = directFiles.map(f => {
        const src = `/ARTISTS/${artist}/${f}`;
        const meta = getArtworkMetadata(src, artist, 'Artworks', f);
        return {
          filename: f,
          src: src,
          artist: meta.artist || artist,
          artist_tier: artistTier,
          category: meta.category || 'Artworks',
          title: meta.title || f.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
          medium: meta.medium || 'Contemporary Work',
          size: meta.size || 'Inquire for Size',
          year: meta.year || '2026',
          price: meta.price || 'Price on Request',
          purchaseType: meta.purchaseType || (meta.paymentLink ? 'direct' : 'inquire'),
          paymentLink: meta.paymentLink || '',
          description: meta.description || meta.desc || 'Recently added to our collection.'
        };
      });

      const folderKey = `${artist}/Artworks`;
      const altKey = artist;
      const imagePaths = directFiles.map(f => `/ARTISTS/${artist}/${f}`);
      let coverPath = customCovers[folderKey] || customCovers[altKey] || (directFiles.length > 0 ? `/ARTISTS/${artist}/${directFiles[0]}` : null);

      categories.unshift({
        name: 'Artworks',
        imageCount: directFiles.length,
        cover: coverPath,
        images: imagePaths,
        artworks: directArtworks
      });
    }

    // Default container for empty artist folder
    if (categories.length === 0) {
      categories = [{
        name: 'Artworks',
        imageCount: 0,
        cover: null,
        images: [],
        artworks: []
      }];
    }

    // Find artist primary cover image
    let artistCover = null;
    for (const c of categories) {
      if (c.cover) { artistCover = c.cover; break; }
    }

    return { name: artist, tier: artistTier, cover: artistCover, categories, isStudent: (artistTier === 'Student Artists') };
  });

  res.json(artists);
});

/* ── POST /api/set-album-cover ─── set artwork as album cover ── */
app.post('/api/set-album-cover', (req, res) => {
  const { artist, category, src } = req.body;
  if (!artist || !category || !src) return res.status(400).json({ error: 'Missing artist, category or src' });
  
  const covers = readJSON(ALBUM_COVERS_F, {});
  const cleanSrc = src.startsWith('/') ? src : '/' + src;
  covers[`${artist.trim()}/${category.trim()}`] = cleanSrc;
  writeJSON(ALBUM_COVERS_F, covers);

  runSync(() => {
    res.json({ ok: true, message: `Cover updated for ${artist}/${category}`, cover: cleanSrc });
  });
});

/* ── GET /api/artworks-metadata ─── get raw metadata json */
app.get('/api/artworks-metadata', (req, res) => {
  res.json(readJSON(METADATA_FILE, {}));
});

/* ── POST /api/artworks-metadata ─── save raw metadata */
app.post('/api/artworks-metadata', (req, res) => {
  writeJSON(METADATA_FILE, req.body);
  res.json({ ok: true });
});

/* ── POST /api/upload-artwork ─── upload images to artist folder with metadata */
app.post('/api/upload-artwork', artworkUpload.array('images', 20), async (req, res) => {
  const artist = (req.body.artist || 'Unknown Artist').trim();
  const category = (req.body.category || 'Artworks').trim();
  const title = (req.body.title || '').trim();
  const medium = (req.body.medium || 'Contemporary Work').trim();
  const size = (req.body.size || 'Inquire for Size').trim();
  const year = (req.body.year || '2026').trim();
  const price = (req.body.price || 'Price on Request').trim();
  const purchaseType = (req.body.purchaseType || (req.body.paymentLink ? 'direct' : 'inquire')).trim();
  const paymentLink = (req.body.paymentLink || '').trim();
  const description = (req.body.description || req.body.desc || 'Recently added to our collection.').trim();

  if (purchaseType === 'direct' && !paymentLink) {
    return res.status(400).json({ error: 'Payment link is mandatory when Direct Purchase is selected.' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  // Automatically compress each uploaded image
  for (const file of req.files) {
    await optimizeImageInPlace(file.path);
  }

  const metaStore = readJSON(METADATA_FILE, {});

  req.files.forEach((file) => {
    const src = `/ARTISTS/${artist}/${category}/${file.filename}`;
    const artTitle = (title && req.files.length === 1) ? title : file.filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    metaStore[src] = {
      title: artTitle,
      artist: artist,
      category: category,
      medium: medium,
      size: size,
      year: year,
      price: price,
      purchaseType: purchaseType,
      paymentLink: paymentLink,
      description: description
    };
  });

  writeJSON(METADATA_FILE, metaStore);

  runSync(() => {
    res.json({ 
      ok: true, 
      files: req.files.map(f => f.filename), 
      message: 'Artwork uploaded, optimized, and gallery updated.' 
    });
  });
});

/* ── POST /api/edit-artwork ─── edit artwork metadata or replace artwork image */
app.post('/api/edit-artwork', replaceUpload.single('imageFile'), async (req, res) => {
  const { originalSrc, artist, category, title, medium, size, year, price, purchaseType, paymentLink, description } = req.body;
  if (!originalSrc) return res.status(400).json({ error: 'originalSrc is required' });

  const effectivePurchaseType = (purchaseType || (paymentLink ? 'direct' : 'inquire')).trim();
  const effectivePaymentLink = (paymentLink || '').trim();
  if (effectivePurchaseType === 'direct' && !effectivePaymentLink) {
    return res.status(400).json({ error: 'Payment link is mandatory when Direct Purchase is selected.' });
  }

  const metaStore = readJSON(METADATA_FILE, {});
  const cleanOriginalSrc = originalSrc.startsWith('/') ? originalSrc : '/' + originalSrc;
  
  let targetSrc = cleanOriginalSrc;
  const currentRelPath = cleanOriginalSrc.replace(/^\//, '');
  const currentFullPath = path.join(ROOT, currentRelPath);

  // Check if a replacement file was uploaded
  if (req.file) {
    const ext = path.extname(req.file.originalname) || path.extname(currentFullPath);
    const safeBaseName = (title || path.basename(currentFullPath, path.extname(currentFullPath))).replace(/[^a-zA-Z0-9.\-_ ()`]/g, '_');
    const newFilename = `${safeBaseName}${ext}`;
    const destDir = path.join(ARTISTS_DIR, (artist || 'Unknown Artist').trim(), (category || 'Artworks').trim());
    ensureDir(destDir);
    const newFullPath = path.join(destDir, newFilename);

    // If source file exists and is different, remove it
    if (fs.existsSync(currentFullPath) && currentFullPath !== newFullPath) {
      try { fs.unlinkSync(currentFullPath); } catch (e) {}
    }

    // Move uploaded file to target
    fs.renameSync(req.file.path, newFullPath);

    // Automatically optimize replacement image
    await optimizeImageInPlace(newFullPath);

    // Update targetSrc and clean up old metadata key
    targetSrc = `/ARTISTS/${(artist || 'Unknown Artist').trim()}/${(category || 'Artworks').trim()}/${newFilename}`;
    if (cleanOriginalSrc !== targetSrc) {
      delete metaStore[cleanOriginalSrc];
      delete metaStore[originalSrc];
    }
  } else {
    // If no new file, but artist/category changed, move existing file
    if (artist && category) {
      const targetDir = path.join(ARTISTS_DIR, artist.trim(), category.trim());
      ensureDir(targetDir);
      const currentFileName = path.basename(currentFullPath);
      const newFullPath = path.join(targetDir, currentFileName);
      
      if (fs.existsSync(currentFullPath) && currentFullPath !== newFullPath) {
        fs.renameSync(currentFullPath, newFullPath);
        targetSrc = `/ARTISTS/${artist.trim()}/${category.trim()}/${currentFileName}`;
        delete metaStore[cleanOriginalSrc];
        delete metaStore[originalSrc];
      }
    }
  }

  // Update metadata entry
  metaStore[targetSrc] = {
    title: (title || '').trim(),
    artist: (artist || '').trim(),
    category: (category || '').trim(),
    medium: (medium || 'Contemporary Work').trim(),
    size: (size || 'Inquire for Size').trim(),
    year: (year || '2026').trim(),
    price: (price || 'Price on Request').trim(),
    purchaseType: (purchaseType || (paymentLink ? 'direct' : 'inquire')).trim(),
    paymentLink: (paymentLink || '').trim(),
    description: (description || '').trim()
  };

  writeJSON(METADATA_FILE, metaStore);

  runSync(() => {
    res.json({
      ok: true,
      src: targetSrc,
      metadata: metaStore[targetSrc],
      message: 'Artwork updated successfully.'
    });
  });
});

/* ── POST /api/upload-proof ─── upload customer proof of payment screenshot */
const proofStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dest = path.join(ROOT, 'images', 'proofs');
    ensureDir(dest);
    cb(null, dest);
  },
  filename(req, file, cb) {
    const safe = 'proof_' + Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, safe);
  }
});
const proofUpload = multer({ storage: proofStorage, limits: { fileSize: 25 * 1024 * 1024 } });

app.post('/api/upload-proof', proofUpload.single('proofFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No proof file provided' });
  const relPath = `/images/proofs/${req.file.filename}`;
  res.json({ ok: true, url: relPath });
});

/* ── DELETE /api/delete-artwork ─── remove image from artist folder */
app.delete('/api/delete-artwork', (req, res) => {
  const { artist, category, filename, src } = req.body;
  let targetPath = null;
  let targetSrc = src;

  if (src) {
    const rel = src.replace(/^\//, '');
    targetPath = path.join(ROOT, rel);
  } else if (artist && category && filename) {
    targetPath = path.join(ARTISTS_DIR, artist, category, filename);
    targetSrc = `/ARTISTS/${artist}/${category}/${filename}`;
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Artwork file not found' });
  }

  try {
    fs.unlinkSync(targetPath);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete file: ' + err.message });
  }

  // Remove from metadata store
  const metaStore = readJSON(METADATA_FILE, {});
  if (targetSrc) {
    delete metaStore[targetSrc];
    delete metaStore[targetSrc.replace(/^\//, '')];
    delete metaStore['/' + targetSrc.replace(/^\//, '')];
    writeJSON(METADATA_FILE, metaStore);
  }

  runSync(() => {
    res.json({ ok: true, message: 'Artwork deleted.' });
  });
});

/* ── POST /api/create-artist-folder ─── create new artist + category with tier */
app.post('/api/create-artist-folder', (req, res) => {
  const { artist, category, tier } = req.body;
  if (!artist) return res.status(400).json({ error: 'Artist name is required' });
  const trimmedArtist = artist.trim();
  const assignedTier = tier || (trimmedArtist.toUpperCase().includes('KEITH ZENDA') ? 'Keith Zenda' : 'Emerging Artists');

  let defaultFolders = [];
  if (assignedTier === 'Student Artists') {
    defaultFolders = ['Artworks'];
  } else if (assignedTier === 'Emerging Artists') {
    defaultFolders = ['Abstract', 'Portraits', 'Commissions'];
    if (category && !['Artworks', 'Abstract', 'Portraits', 'Commissions'].includes(category.trim())) {
      defaultFolders.push(category.trim());
    }
  } else {
    const trimmedCat = (category && category.trim() !== 'Artworks') ? category.trim() : 'Abstract';
    defaultFolders = [trimmedCat];
  }

  // Create all required directories
  defaultFolders.forEach(folder => {
    ensureDir(path.join(ARTISTS_DIR, trimmedArtist, folder));
  });

  const mainCategory = defaultFolders[0];
  const dir = path.join(ARTISTS_DIR, trimmedArtist, mainCategory);
  
  // Save to persistent artists-tier.json
  const tierStore = readJSON(ARTISTS_TIER_F, {});
  tierStore[trimmedArtist] = assignedTier;
  writeJSON(ARTISTS_TIER_F, tierStore);

  runSync(() => {
    res.json({ 
      ok: true, 
      path: dir, 
      artist: trimmedArtist, 
      category: mainCategory,
      folders: defaultFolders,
      tier: assignedTier 
    });
  });
});

/* ── POST /api/update-artist-tier ─── update category demarcation tier for an artist */
app.post('/api/update-artist-tier', (req, res) => {
  const { artist, tier } = req.body;
  if (!artist || !tier) return res.status(400).json({ error: 'Artist and tier are required' });
  
  const trimmedArtist = artist.trim();
  const tierStore = readJSON(ARTISTS_TIER_F, {});
  tierStore[trimmedArtist] = tier.trim();
  writeJSON(ARTISTS_TIER_F, tierStore);

  runSync(() => {
    res.json({ ok: true, artist: trimmedArtist, tier: tier.trim(), message: 'Artist tier updated successfully.' });
  });
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
