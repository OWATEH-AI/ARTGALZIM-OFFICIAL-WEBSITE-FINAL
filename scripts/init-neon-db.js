import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function initSchema() {
  console.log('🚀 Initializing ARTGALZIM Database Schema on Neon...');
  
  try {
    // 1. Artists Table
    await sql`
      CREATE TABLE IF NOT EXISTS artists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        bio TEXT,
        cover_image VARCHAR(1024),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 2. Artworks Table
    await sql`
      CREATE TABLE IF NOT EXISTS artworks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        medium VARCHAR(255) DEFAULT 'Contemporary Work',
        size VARCHAR(100) DEFAULT 'Inquire for Size',
        year VARCHAR(20) DEFAULT '2026',
        description TEXT,
        image_url VARCHAR(1024) NOT NULL,
        price NUMERIC(12, 2),
        currency VARCHAR(10) DEFAULT 'USD',
        is_available BOOLEAN DEFAULT TRUE,
        is_featured BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 3. Payment Links & Invoices Table
    await sql`
      CREATE TABLE IF NOT EXISTS payment_links (
        id SERIAL PRIMARY KEY,
        artwork_id INT REFERENCES artworks(id) ON DELETE SET NULL,
        artwork_title VARCHAR(255),
        artist VARCHAR(255),
        amount NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        payment_url VARCHAR(1024) NOT NULL,
        qr_code_url VARCHAR(1024),
        status VARCHAR(50) DEFAULT 'active', -- active, paid, expired, cancelled
        customer_email VARCHAR(255),
        customer_name VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 4. Exhibitions Table
    await sql`
      CREATE TABLE IF NOT EXISTS exhibitions (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date_range VARCHAR(255),
        location VARCHAR(255),
        description TEXT,
        image_url VARCHAR(1024),
        status VARCHAR(50) DEFAULT 'upcoming',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 5. Site Configuration & Content Table
    await sql`
      CREATE TABLE IF NOT EXISTS site_content (
        key VARCHAR(100) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    console.log('✅ All ARTGALZIM database tables created successfully in Neon DB!');
  } catch (err) {
    console.error('❌ Failed to initialize schema:', err);
  }
}

initSchema();
