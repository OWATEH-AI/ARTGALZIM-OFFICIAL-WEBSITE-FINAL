import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function dedup() {
  console.log('🧹 Deduplicating artworks table on Neon DB...');
  
  // Keep the row with the lowest id for each distinct image_url
  await sql`
    DELETE FROM artworks a
    USING artworks b
    WHERE a.id > b.id AND a.image_url = b.image_url;
  `;

  const count = await sql`SELECT count(*)::int as count FROM artworks;`;
  console.log(`✅ Artworks table deduplicated! Total clean rows: ${count[0].count}`);

  const rows = await sql`SELECT id, title, artist, artist_tier, category, image_url FROM artworks ORDER BY artist, category, id;`;
  console.log(JSON.stringify(rows, null, 2));
}

dedup();
