import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function upgradeArchitecture() {
  console.log('🏛️ Initializing Full ARTGALZIM Backend Architecture on Neon...');

  try {
    // 1. Media Assets Catalog (Maps to Neon Storage Buckets)
    await sql`
      CREATE TABLE IF NOT EXISTS media_assets (
        id SERIAL PRIMARY KEY,
        bucket_name VARCHAR(100) NOT NULL, -- uploads, assets, media, documents, backups, exports
        file_key VARCHAR(1024) NOT NULL UNIQUE,
        file_url VARCHAR(1024) NOT NULL,
        file_type VARCHAR(50) NOT NULL, -- image, video, document, audio
        mime_type VARCHAR(100),
        file_size_bytes BIGINT,
        title VARCHAR(255),
        description TEXT,
        tags TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 2. Open Calls for Artists & Curators
    await sql`
      CREATE TABLE IF NOT EXISTS open_calls (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        theme TEXT,
        description TEXT,
        eligibility TEXT,
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        submission_fee NUMERIC(10,2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'USD',
        banner_url VARCHAR(1024),
        guidelines_doc_url VARCHAR(1024),
        status VARCHAR(50) DEFAULT 'active', -- draft, active, closed, reviewing, completed
        max_submissions INT DEFAULT 500,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 3. Open Call Submissions & Portfolios
    await sql`
      CREATE TABLE IF NOT EXISTS open_call_submissions (
        id SERIAL PRIMARY KEY,
        open_call_id INT REFERENCES open_calls(id) ON DELETE CASCADE,
        artist_name VARCHAR(255) NOT NULL,
        artist_email VARCHAR(255) NOT NULL,
        artist_phone VARCHAR(100),
        artist_country VARCHAR(100),
        artist_bio TEXT,
        artist_statement TEXT,
        portfolio_url VARCHAR(1024),
        status VARCHAR(50) DEFAULT 'pending', -- pending, under_review, shortlisted, accepted, rejected
        payment_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, paid, waived
        payment_ref VARCHAR(255),
        submitted_artworks JSONB DEFAULT '[]', -- Array of uploaded artworks with media bucket keys
        review_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 4. Contracts, Agreements & Legal Documents
    await sql`
      CREATE TABLE IF NOT EXISTS contracts_documents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        document_type VARCHAR(100) NOT NULL, -- artist_agreement, consignment_contract, exhibition_agreement, authenticity_certificate, sales_invoice, other
        artist_name VARCHAR(255),
        related_artwork_id INT REFERENCES artworks(id) ON DELETE SET NULL,
        related_exhibition_id VARCHAR(100),
        file_url VARCHAR(1024) NOT NULL,
        bucket_name VARCHAR(100) DEFAULT 'documents',
        status VARCHAR(50) DEFAULT 'draft', -- draft, sent, pending_signature, signed, archived
        signature_date TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 5. Enhance Exhibitions Table with Video Adverts & Virtual Tours
    await sql`
      ALTER TABLE exhibitions
      ADD COLUMN IF NOT EXISTS subtitle VARCHAR(255),
      ADD COLUMN IF NOT EXISTS video_ad_url VARCHAR(1024),
      ADD COLUMN IF NOT EXISTS virtual_tour_url VARCHAR(1024),
      ADD COLUMN IF NOT EXISTS curator VARCHAR(255),
      ADD COLUMN IF NOT EXISTS open_call_id INT,
      ADD COLUMN IF NOT EXISTS catalog_doc_url VARCHAR(1024),
      ADD COLUMN IF NOT EXISTS press_release_url VARCHAR(1024),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `;

    // 7. Enhance Artists & Artworks Tables with Category Demarcation Tiers (Keith Zenda, Emerging Artists, Student Artists)
    await sql`
      ALTER TABLE artists
      ADD COLUMN IF NOT EXISTS tier VARCHAR(100) DEFAULT 'Emerging Artists',
      ADD COLUMN IF NOT EXISTS active_status VARCHAR(50) DEFAULT 'active';
    `;

    await sql`
      ALTER TABLE artworks
      ADD COLUMN IF NOT EXISTS artist_tier VARCHAR(100) DEFAULT 'Emerging Artists';
    `;

    console.log('✅ Successfully provisioned all Open Calls, Video Media, Contracts, Artist Tiers, and Storage tables in Neon DB!');
  } catch (err) {
    console.error('❌ Error provisioning schema:', err);
  }
}

upgradeArchitecture();
