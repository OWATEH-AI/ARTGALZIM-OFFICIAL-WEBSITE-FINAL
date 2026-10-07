import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function showArtworks() {
  try {
    const artists = await sql`
      SELECT id, name, tier, cover_image FROM artists ORDER BY id ASC;
    `;
    console.log('🏛️ ARTISTS IN NEON DB:');
    console.log(JSON.stringify(artists, null, 2));

    const fmRows = await sql`
      SELECT id, title, artist, artist_tier, category, image_url 
      FROM artworks 
      WHERE artist = 'FLORAH MAPHOSA' 
      ORDER BY id ASC;
    `;
    console.log('\n🎨 FLORAH MAPHOSA ARTWORKS IN NEON DB:');
    console.log(JSON.stringify(fmRows, null, 2));
  } catch (err) {
    console.error('Error fetching artworks:', err);
  }
}

showArtworks();
