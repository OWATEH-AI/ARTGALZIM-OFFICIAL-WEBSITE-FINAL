import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const sql = neon(process.env.DATABASE_URL);

function getArtworkMetadata(metaStore, src, artist, category, filename) {
  const cleanSrc = src.startsWith('/') ? src : '/' + src;
  if (metaStore[cleanSrc]) return metaStore[cleanSrc];
  if (metaStore[src]) return metaStore[src];

  const relKey = `ARTISTS/${artist}/${category}/${filename}`;
  if (metaStore[relKey] || metaStore['/' + relKey]) {
    return metaStore[relKey] || metaStore['/' + relKey];
  }

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

async function syncAllToNeon() {
  console.log('🔄 Real-time synchronizing Frontend & Neon Database...');
  
  try {
    const metaPath = path.join(ROOT, 'js', 'artworks-metadata.json');
    let metaStore = {};
    if (fs.existsSync(metaPath)) {
      try { metaStore = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) {}
    }

    const tierPath = path.join(ROOT, 'js', 'artists-tier.json');
    let tierStore = {};
    if (fs.existsSync(tierPath)) {
      try { tierStore = JSON.parse(fs.readFileSync(tierPath, 'utf8')); } catch (e) {}
    }

    // Default tier getter
    const getArtistTier = (name) => {
      if (tierStore[name]) return tierStore[name];
      if (name.toUpperCase().includes('KEITH ZENDA')) return 'Keith Zenda';
      return 'Emerging Artists';
    };

    // 1. Fetch existing artworks once
    let existingMap = new Map();
    try {
      const existingRows = await sql`SELECT id, image_url FROM artworks`;
      for (const row of existingRows) {
        existingMap.set(row.image_url, row.id);
      }
    } catch (e) {
      console.warn('Initial artworks fetch:', e.message);
    }

    // 2. Scan filesystem for all artists and artworks in ARTISTS directory
    const artistsDir = path.join(ROOT, 'ARTISTS');
    let artCount = 0;
    let artistCount = 0;
    const activeSrcs = new Set();

    if (fs.existsSync(artistsDir)) {
      const artistFolders = fs.readdirSync(artistsDir);
      for (const artist of artistFolders) {
        const artistPath = path.join(artistsDir, artist);
        if (fs.lstatSync(artistPath).isDirectory()) {
          const artistTier = getArtistTier(artist);
          let artistCover = null;
          const entries = fs.readdirSync(artistPath);

          // 1. Direct files inside artist directory (e.g. for student artists)
          const directFiles = entries.filter(f => {
            const full = path.join(artistPath, f);
            if (fs.lstatSync(full).isDirectory()) return false;
            return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(path.extname(f).toLowerCase());
          });

          for (const f of directFiles) {
            const src = `/ARTISTS/${artist}/${f}`;
            const meta = getArtworkMetadata(metaStore, src, artist, 'Artworks', f);
            if (!artistCover) artistCover = src;

            if (existingMap.has(src)) {
              await sql`
                UPDATE artworks 
                SET title = ${meta.title || f.replace(/\.[^/.]+$/, "")},
                    artist = ${meta.artist || artist},
                    artist_tier = ${artistTier},
                    category = ${meta.category || 'Artworks'},
                    medium = ${meta.medium || 'Contemporary Work'},
                    size = ${meta.size || 'Inquire for Size'},
                    year = ${meta.year || '2026'},
                    price_display = ${meta.price || 'Price on Request'},
                    purchase_type = ${meta.purchaseType || (meta.paymentLink ? 'direct' : 'inquire')},
                    payment_link_url = ${meta.paymentLink || ''},
                    description = ${meta.description || meta.desc || ''},
                    updated_at = NOW()
                WHERE image_url = ${src};
              `;
            } else {
              await sql`
                INSERT INTO artworks (title, artist, artist_tier, category, medium, size, year, price_display, purchase_type, payment_link_url, description, image_url)
                VALUES (
                  ${meta.title || f.replace(/\.[^/.]+$/, "")},
                  ${meta.artist || artist},
                  ${artistTier},
                  ${meta.category || 'Artworks'},
                  ${meta.medium || 'Contemporary Work'},
                  ${meta.size || 'Inquire for Size'},
                  ${meta.year || '2026'},
                  ${meta.price || 'Price on Request'},
                  ${meta.purchaseType || (meta.paymentLink ? 'direct' : 'inquire')},
                  ${meta.paymentLink || ''},
                  ${meta.description || meta.desc || ''},
                  ${src}
                );
              `;
              existingMap.set(src, true);
            }
            activeSrcs.add(src);
            artCount++;
          }

          // 2. Subcategory folders
          const categories = entries.filter(c => fs.lstatSync(path.join(artistPath, c)).isDirectory());
          for (const cat of categories) {
            const catPath = path.join(artistPath, cat);
            const files = fs.readdirSync(catPath);
            for (const f of files) {
              const ext = path.extname(f).toLowerCase();
              if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
                const src = `/ARTISTS/${artist}/${cat}/${f}`;
                const meta = getArtworkMetadata(metaStore, src, artist, cat, f);
                if (!artistCover) artistCover = src;

                if (existingMap.has(src)) {
                  await sql`
                    UPDATE artworks 
                    SET title = ${meta.title || f.replace(/\.[^/.]+$/, "")},
                        artist = ${meta.artist || artist},
                        artist_tier = ${artistTier},
                        category = ${meta.category || cat},
                        medium = ${meta.medium || 'Contemporary Work'},
                        size = ${meta.size || 'Inquire for Size'},
                        year = ${meta.year || '2026'},
                        price_display = ${meta.price || 'Price on Request'},
                        purchase_type = ${meta.purchaseType || (meta.paymentLink ? 'direct' : 'inquire')},
                        payment_link_url = ${meta.paymentLink || ''},
                        description = ${meta.description || meta.desc || ''},
                        updated_at = NOW()
                    WHERE image_url = ${src};
                  `;
                } else {
                  await sql`
                    INSERT INTO artworks (title, artist, artist_tier, category, medium, size, year, price_display, purchase_type, payment_link_url, description, image_url)
                    VALUES (
                      ${meta.title || f.replace(/\.[^/.]+$/, "")},
                      ${meta.artist || artist},
                      ${artistTier},
                      ${meta.category || cat},
                      ${meta.medium || 'Contemporary Work'},
                      ${meta.size || 'Inquire for Size'},
                      ${meta.year || '2026'},
                      ${meta.price || 'Price on Request'},
                      ${meta.purchaseType || (meta.paymentLink ? 'direct' : 'inquire')},
                      ${meta.paymentLink || ''},
                      ${meta.description || meta.desc || ''},
                      ${src}
                    );
                  `;
                  existingMap.set(src, true);
                }
                activeSrcs.add(src);
                artCount++;
              }
            }
          }

          // Sync artist to artists table
          await sql`
            INSERT INTO artists (name, tier, cover_image, updated_at)
            VALUES (${artist}, ${artistTier}, ${artistCover || ''}, NOW())
            ON CONFLICT (name) DO UPDATE
            SET tier = EXCLUDED.tier,
                cover_image = COALESCE(NULLIF(EXCLUDED.cover_image, ''), artists.cover_image),
                updated_at = NOW();
          `;
          artistCount++;
        }
      }

      // Clean up any stale artworks in Neon DB whose files were moved or deleted
      try {
        const allDbArts = await sql`SELECT id, image_url FROM artworks WHERE image_url LIKE '/ARTISTS/%'`;
        for (const dbArt of allDbArts) {
          if (!activeSrcs.has(dbArt.image_url)) {
            await sql`DELETE FROM artworks WHERE id = ${dbArt.id}`;
            console.log(`  🗑️ Cleaned up moved/obsolete artwork from DB: ${dbArt.image_url}`);
          }
        }
      } catch (cleanErr) {
        console.warn('Artwork cleanup warning:', cleanErr.message);
      }

      console.log(`✅ Synced & validated ${artistCount} artists and ${artCount} artworks in Neon DB.`);
    }

    // 3. Sync Exhibitions
    const exhPath = path.join(ROOT, 'js', 'exhibitions-data.json');
    if (fs.existsSync(exhPath)) {
      const exhibitions = JSON.parse(fs.readFileSync(exhPath, 'utf8'));
      let exhCount = 0;
      for (const exh of exhibitions) {
        await sql`
          INSERT INTO exhibitions (id, title, date_range, location, description, image_url, status)
          VALUES (
            ${exh.id || Date.now().toString()},
            ${exh.title || 'Untitled Exhibition'},
            ${exh.date_range || exh.dates || ''},
            ${exh.location || ''},
            ${exh.description || ''},
            ${exh.image_url || exh.cover || ''},
            ${exh.status || 'upcoming'}
          )
          ON CONFLICT (id) DO UPDATE 
          SET title = EXCLUDED.title,
              date_range = EXCLUDED.date_range,
              location = EXCLUDED.location,
              description = EXCLUDED.description,
              image_url = EXCLUDED.image_url,
              status = EXCLUDED.status;
        `;
        exhCount++;
      }
      console.log(`✅ Synced ${exhCount} exhibitions in Neon DB.`);
    }

    // 4. Sync Admin Site Content
    const contentPath = path.join(ROOT, 'js', 'admin-content.json');
    if (fs.existsSync(contentPath)) {
      const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
      await sql`
        INSERT INTO site_content (key, data, updated_at)
        VALUES ('main_config', ${JSON.stringify(content)}, NOW())
        ON CONFLICT (key) DO UPDATE
        SET data = EXCLUDED.data,
            updated_at = NOW();
      `;
      console.log('✅ Synced admin site content in Neon DB.');
    }

    console.log('⚡ Frontend & Neon Backend are 100% in sync!');
  } catch (err) {
    console.error('❌ Sync failed:', err);
  }
}

syncAllToNeon();
