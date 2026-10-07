import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function addPaymentCols() {
  try {
    await sql`
      ALTER TABLE artworks
      ADD COLUMN IF NOT EXISTS price_display VARCHAR(100) DEFAULT 'Price on Request',
      ADD COLUMN IF NOT EXISTS purchase_type VARCHAR(50) DEFAULT 'inquire',
      ADD COLUMN IF NOT EXISTS payment_link_url VARCHAR(1024);
    `;
    console.log('✅ Added payment_link_url, purchase_type, price_display to artworks table in Neon!');
  } catch (err) {
    console.error('Error adding columns:', err);
  }
}

addPaymentCols();
