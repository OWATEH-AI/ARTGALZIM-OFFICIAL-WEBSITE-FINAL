import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectId = process.env.SANITY_PROJECT_ID || '2a274c3r';
const dataset = process.env.SANITY_DATASET || 'production';
const token = process.env.SANITY_API_TOKEN;
const apiRoot = `https://${projectId}.api.sanity.io/v2025-02-19`;
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff']);

if (!token) throw new Error('Set SANITY_API_TOKEN in .env before running this migration.');

function slug(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'untitled';
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(path.join(root, file), 'utf8')); }
  catch { return fallback; }
}

async function listImages(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return []; }
  const found = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await listImages(fullPath));
    else if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) found.push(fullPath);
  }
  return found;
}

async function uploadImage(filePath) {
  const file = await fs.readFile(filePath);
  const filename = path.basename(filePath);
  const mime = filename.toLowerCase().endsWith('.png') ? 'image/png'
    : filename.toLowerCase().endsWith('.webp') ? 'image/webp'
      : filename.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/jpeg';
  const response = await fetch(`${apiRoot}/assets/images/${dataset}?filename=${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': mime },
    body: file
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Asset upload failed for ${filePath}: ${result.message || response.status}`);
  return result.document;
}

async function mutate(documents) {
  for (let index = 0; index < documents.length; index += 50) {
    const mutations = documents.slice(index, index + 50).map(document => ({ createOrReplace: document }));
    const response = await fetch(`${apiRoot}/data/mutate/${dataset}?returnIds=true`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ mutations })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`Document import failed: ${result.message || response.status}`);
  }
}

const [metadata, artistTiers, customCovers] = await Promise.all([
  readJson('js/artworks-metadata.json', {}),
  readJson('js/artists-tier.json', {}),
  readJson('js/album-covers.json', {})
]);
const files = await listImages(path.join(root, 'ARTISTS'));
const artworkDocs = [];
const artistDocs = new Map();
const albumDocs = new Map();
const albumImages = new Map();
let completed = 0;
let nextFile = 0;

async function migrateFile(filePath) {
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  const parts = relative.split('/');
  const artist = parts[1];
  const category = parts.length > 3 ? parts[2] : 'Artworks';
  const filename = path.basename(filePath);
  const sourceKey = `/${relative}`;
  const meta = metadata[sourceKey] || metadata[relative] || {};
  const tier = artistTiers[artist] || (artist.toUpperCase().includes('KEITH ZENDA') ? 'Keith Zenda' : 'Emerging Artists');
  const rawTitle = String(meta.title || '').trim();
  const hasGeneratedWhatsAppTitle = /^whats?ap(?:p|ge)?(?:\s|$)/i.test(rawTitle)
    || /^whats?ap(?:p|ge)?(?:\s|[-_]|$)/i.test(filename);
  const asset = await uploadImage(filePath);
  const id = `artwork-${slug(artist)}-${slug(category)}-${createHash('sha1').update(relative).digest('hex').slice(0, 10)}`;
  const sourcePath = relative;
  const item = {
    _id: id,
    _type: 'artwork',
    title: hasGeneratedWhatsAppTitle ? 'Untitled Artwork' : rawTitle || filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    artist: meta.artist || artist,
    artistTier: tier,
    category: meta.category || category,
    medium: meta.medium || 'Contemporary Work',
    size: meta.size || 'Inquire for Size',
    year: String(meta.year || '2026'),
    price: meta.price || 'Price on Request',
    purchaseType: meta.purchaseType || (meta.paymentLink ? 'direct' : 'inquire'),
    paymentLink: meta.paymentLink || '',
    description: meta.description || meta.desc || 'Recently added to our collection.',
    filename,
    sourcePath,
    imageUrl: asset.url,
    image: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } }
  };
  artworkDocs.push(item);
  artistDocs.set(artist, { _id: `artist-${slug(artist)}`, _type: 'artist', name: artist, tier });
  const albumKey = `${artist}/${category}`;
  albumImages.set(albumKey, [...(albumImages.get(albumKey) || []), { sourcePath, url: asset.url }]);
  completed++;
  if (completed % 20 === 0 || completed === files.length) console.log(`Uploaded ${completed}/${files.length} artwork images`);
}

const workers = Array.from({ length: 4 }, async () => {
  while (nextFile < files.length) {
    const filePath = files[nextFile++];
    await migrateFile(filePath);
  }
});
await Promise.all(workers);

for (const [key, images] of albumImages) {
  const [artist, name] = key.split('/');
  const coverPath = String(customCovers[key] || '').replace(/^\/+/, '');
  const cover = images.find(image => image.sourcePath === coverPath) || images[0];
  albumDocs.set(key, {
    _id: `album-${slug(artist)}-${slug(name)}`,
    _type: 'album', artist, name, coverSrc: cover?.url || ''
  });
}

await mutate([...artistDocs.values(), ...albumDocs.values(), ...artworkDocs]);
console.log(`Imported ${artistDocs.size} artists, ${albumDocs.size} albums, and ${artworkDocs.length} published artworks.`);