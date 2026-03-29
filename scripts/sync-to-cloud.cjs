/**
 * Cloud Sync Script - Moves local images from ARTISTS/ folder to Cloudflare R2 and D1.
 * Usage: node scripts/sync-to-cloud.cjs
 * Requires: Wrangler CLI logged in (npx wrangler login)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ARTISTS_DIR = path.join(__dirname, '..', 'ARTISTS');
const D1_NAME = 'artgalzim-db';
const R2_NAME = 'artgalzim-images';

function getArtistArtworks() {
    const list = [];
    if (!fs.existsSync(ARTISTS_DIR)) return list;

    fs.readdirSync(ARTISTS_DIR).forEach(artist => {
        const artistPath = path.join(ARTISTS_DIR, artist);
        if (fs.lstatSync(artistPath).isDirectory()) {
            fs.readdirSync(artistPath).forEach(category => {
                const categoryPath = path.join(artistPath, category);
                if (fs.lstatSync(categoryPath).isDirectory()) {
                    fs.readdirSync(categoryPath).forEach(file => {
                        const ext = path.extname(file).toLowerCase();
                        if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
                            list.push({ artist, category, file, fullPath: path.join(categoryPath, file) });
                        }
                    });
                }
            });
        }
    });
    return list;
}

async function sync() {
    console.log('--- Starting Cloud Sync ---');
    const artworks = getArtistArtworks();
    console.log(`Found ${artworks.length} local artworks to sync.`);

    for (const art of artworks) {
        const r2Key = `artists/${art.artist}/${art.category}/${art.file}`;
        const artworkId = `${art.artist}_${art.category}_${Date.now()}_${art.file.replace(/[^a-zA-Z]/g, '')}`;

        console.log(`Syncing: ${art.artist} | ${art.file}...`);

        try {
            // 1. Upload to R2 (Remote)
            // Using wrangler CLI directly for simplicity
            console.log(` > Uploading to R2...`);
            execSync(`npx wrangler r2 object put ${R2_NAME}/${r2Key} --file="${art.fullPath}" --remote`, { stdio: 'inherit' });

            // 2. Generate Public URL (Assume default R2 dev domain or custom domain)
            // Note: Replace with actual R2 public URL if known, or let backend resolve it.
            const publicUrl = `/${r2Key}`; // Relative path for now, functions will resolve it.

            // 3. Insert into D1 (Remote)
            console.log(` > Inserting metadata into D1...`);
            const sql = `INSERT INTO artworks (id, artist, category, filename, r2_key, r2_url) VALUES ('${artworkId}', '${art.artist}', '${art.category}', '${art.file}', '${r2Key}', 'CLOUD_SYNCED:${r2Key}')`;
            execSync(`npx wrangler d1 execute ${D1_NAME} --command="${sql}" --remote`, { stdio: 'inherit' });

        } catch (e) {
            console.error(`Failed to sync ${art.file}:`, e.message);
        }
    }

    console.log('--- Sync Completed ---');
}

sync();
