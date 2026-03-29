/**
 * ARTGALZIM Asset Compression Script
 * Compresses all images in-place using sharp.
 * - PNGs → WebP (quality 82, lossless=false)
 * - JPEGs → JPEG (quality 80, progressive)
 * - Skips files already under 80KB
 * - Skips node_modules, recycle, .git
 * Run: node scripts/compress-assets.cjs
 */
const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const ROOT    = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules','recycle','.git','.wrangler','dist','scripts']);
const MIN_SIZE = 80 * 1024; // skip files already < 80 KB

let totalSaved = 0;
let totalFiles = 0;
let skipped    = 0;

function walk(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results = results.concat(walk(full));
    else if (/\.(png|jpg|jpeg)$/i.test(e.name)) results.push(full);
  }
  return results;
}

async function compress(file) {
  const stat = fs.statSync(file);
  if (stat.size < MIN_SIZE) { skipped++; return; }

  const ext  = path.extname(file).toLowerCase();
  const tmp  = file + '.tmp';

  try {
    let pipeline = sharp(file, { failOn: 'none' });

    if (ext === '.png') {
      // Convert PNG → WebP
      const newFile = file.replace(/\.png$/i, '.webp');
      await pipeline
        .webp({ quality: 82, effort: 4 })
        .toFile(tmp);
      const newStat = fs.statSync(tmp);
      const saved = stat.size - newStat.size;
      if (newStat.size < stat.size) {
        fs.renameSync(tmp, newFile);
        // Remove old PNG if a new .webp was created with a different name
        if (newFile !== file) fs.unlinkSync(file);
        console.log(`✓ PNG→WebP  ${path.relative(ROOT, file).padEnd(60)} ${kb(stat.size)} → ${kb(newStat.size)}  saved ${kb(saved)}`);
        totalSaved += saved;
        totalFiles++;
      } else {
        fs.unlinkSync(tmp);
        console.log(`  skip PNG  ${path.relative(ROOT, file)} (WebP would be larger)`);
        skipped++;
      }
    } else {
      // JPEG → optimized JPEG (progressive)
      await pipeline
        .jpeg({ quality: 80, progressive: true, mozjpeg: true })
        .toFile(tmp);
      const newStat = fs.statSync(tmp);
      const saved = stat.size - newStat.size;
      if (newStat.size < stat.size) {
        fs.renameSync(tmp, file); // overwrite in-place
        console.log(`✓ JPEG opt  ${path.relative(ROOT, file).padEnd(60)} ${kb(stat.size)} → ${kb(newStat.size)}  saved ${kb(saved)}`);
        totalSaved += saved;
        totalFiles++;
      } else {
        fs.unlinkSync(tmp);
        console.log(`  skip JPG  ${path.relative(ROOT, file)} (already optimal)`);
        skipped++;
      }
    }
  } catch (e) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    console.error(`✗ Error: ${file} — ${e.message}`);
  }
}

function kb(bytes) {
  return Math.round(bytes / 1024) + 'KB';
}

(async () => {
  console.log('=== ARTGALZIM Asset Compressor ===\n');
  const files = walk(ROOT);
  console.log(`Found ${files.length} image files. Processing (skipping <${MIN_SIZE/1024}KB)...\n`);

  for (const f of files) {
    await compress(f);
  }

  console.log(`\n=== DONE ===`);
  console.log(`Compressed : ${totalFiles} files`);
  console.log(`Skipped    : ${skipped} files`);
  console.log(`Total saved: ${Math.round(totalSaved / 1024)}KB  (${(totalSaved / 1024 / 1024).toFixed(1)}MB)`);

  // Clean up temp file we used for analysis
  const tmpFile = path.join(ROOT, 'tmp_sizes.txt');
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
})();
