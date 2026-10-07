/**
 * update-refs.cjs
 * Scans all .html, .js, .css files and replaces .png references with .webp
 * ONLY for files that were actually converted to WebP.
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'recycle', '.git', '.wrangler', 'dist', 'scripts']);

// These basenames were converted PNG → WebP
const CONVERTED = new Set([
  'about_hero','artists_hero','artwork_1','artwork_2','artwork_3',
  'artwork_4','artwork_5','artwork_6','artwork_7','artworks_hero',
  'contact_hero','domboshava','exhibitions_hero','hero_gallery'
]);

// Regex: match filename.png where filename is in CONVERTED set
// We do a global replace on each matched .png reference
function replaceRefs(content) {
  // Match things like  filename.png  inside src="", url(''), href="", etc.
  return content.replace(/(['"(])([^'"()]*?)(about_hero|artists_hero|artwork_1|artwork_2|artwork_3|artwork_4|artwork_5|artwork_6|artwork_7|artworks_hero|contact_hero|domboshava|exhibitions_hero|hero_gallery)(\.png)(['")\s])/g,
    (match, open, prefix, base, ext, close) => {
      return `${open}${prefix}${base}.webp${close}`;
    }
  );
}

function walkSrc(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results = results.concat(walkSrc(full));
    else if (/\.(html|js|css|cjs)$/i.test(e.name)) results.push(full);
  }
  return results;
}

let changedFiles = 0;
let totalChanges = 0;

const files = walkSrc(ROOT);
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const updated  = replaceRefs(original);
  if (updated !== original) {
    fs.writeFileSync(file, updated, 'utf8');
    const count = (original.match(/\.(about_hero|artists_hero|artwork_[1-7]|artworks_hero|contact_hero|domboshava|exhibitions_hero|hero_gallery)\.png/g) || []).length;
    console.log(`✓ Updated ${count} ref(s) in: ${path.relative(ROOT, file)}`);
    changedFiles++;
    totalChanges += count;
  }
}

console.log(`\nDone. Updated ${totalChanges} reference(s) across ${changedFiles} file(s).`);
