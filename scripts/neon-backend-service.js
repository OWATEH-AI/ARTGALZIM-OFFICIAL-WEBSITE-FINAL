import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

/**
 * ═══════════════════════════════════════════════════════════════
 * ARTGALZIM NEON BACKEND SERVICE LAYER
 * Complete backend controller for Open Calls, Exhibitions,
 * Contracts, Video Ads, Artwork Media & Payment Links
 * ═══════════════════════════════════════════════════════════════
 */

// ── 1. OPEN CALLS CONTROLLER ────────────────────────────────────
export const OpenCallsService = {
  async createOpenCall(data) {
    const { title, slug, theme, description, eligibility, startDate, endDate, submissionFee, currency, bannerUrl, guidelinesUrl } = data;
    const cleanSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const result = await sql`
      INSERT INTO open_calls (
        title, slug, theme, description, eligibility, start_date, end_date, submission_fee, currency, banner_url, guidelines_doc_url
      ) VALUES (
        ${title}, ${cleanSlug}, ${theme || ''}, ${description || ''}, ${eligibility || ''}, 
        ${startDate || new Date()}, ${endDate || null}, ${submissionFee || 0.00}, ${currency || 'USD'}, 
        ${bannerUrl || ''}, ${guidelinesUrl || ''}
      )
      RETURNING *;
    `;
    return result[0];
  },

  async getAllOpenCalls(status = null) {
    if (status) {
      return await sql`SELECT * FROM open_calls WHERE status = ${status} ORDER BY created_at DESC;`;
    }
    return await sql`SELECT * FROM open_calls ORDER BY created_at DESC;`;
  },

  async getOpenCallById(id) {
    const rows = await sql`SELECT * FROM open_calls WHERE id = ${id};`;
    return rows[0] || null;
  },

  async submitApplication(data) {
    const { openCallId, artistName, artistEmail, artistPhone, artistCountry, artistBio, artistStatement, portfolioUrl, artworks } = data;
    const result = await sql`
      INSERT INTO open_call_submissions (
        open_call_id, artist_name, artist_email, artist_phone, artist_country,
        artist_bio, artist_statement, portfolio_url, submitted_artworks
      ) VALUES (
        ${openCallId}, ${artistName}, ${artistEmail}, ${artistPhone || ''}, ${artistCountry || ''},
        ${artistBio || ''}, ${artistStatement || ''}, ${portfolioUrl || ''}, ${JSON.stringify(artworks || [])}
      )
      RETURNING *;
    `;
    return result[0];
  },

  async getSubmissionsByCall(openCallId) {
    return await sql`
      SELECT * FROM open_call_submissions 
      WHERE open_call_id = ${openCallId} 
      ORDER BY created_at DESC;
    `;
  },

  async updateSubmissionStatus(submissionId, status, reviewNotes = '') {
    const result = await sql`
      UPDATE open_call_submissions
      SET status = ${status}, review_notes = ${reviewNotes}, updated_at = NOW()
      WHERE id = ${submissionId}
      RETURNING *;
    `;
    return result[0];
  }
};

// ── 2. CONTRACTS & DOCUMENTS CONTROLLER ─────────────────────────
export const ContractsService = {
  async createDocument(data) {
    const { title, documentType, artistName, relatedArtworkId, relatedExhibitionId, fileUrl, bucketName, metadata } = data;
    const result = await sql`
      INSERT INTO contracts_documents (
        title, document_type, artist_name, related_artwork_id, related_exhibition_id,
        file_url, bucket_name, status, metadata
      ) VALUES (
        ${title}, ${documentType}, ${artistName || null}, ${relatedArtworkId || null}, 
        ${relatedExhibitionId || null}, ${fileUrl}, ${bucketName || 'documents'}, 
        'draft', ${JSON.stringify(metadata || {})}
      )
      RETURNING *;
    `;
    return result[0];
  },

  async listDocuments(type = null) {
    if (type) {
      return await sql`SELECT * FROM contracts_documents WHERE document_type = ${type} ORDER BY created_at DESC;`;
    }
    return await sql`SELECT * FROM contracts_documents ORDER BY created_at DESC;`;
  },

  async updateDocumentStatus(id, status, signatureDate = null) {
    const result = await sql`
      UPDATE contracts_documents
      SET status = ${status}, signature_date = ${signatureDate ? new Date(signatureDate) : null}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    return result[0];
  }
};

// ── 3. EXHIBITIONS & VIDEO ADVERTS CONTROLLER ───────────────────
export const ExhibitionsService = {
  async createOrUpdateExhibition(exhibition) {
    const { id, title, subtitle, dateRange, location, description, imageUrl, videoAdUrl, virtualTourUrl, curator, status } = exhibition;
    const exhId = id || Date.now().toString();
    const result = await sql`
      INSERT INTO exhibitions (
        id, title, subtitle, date_range, location, description, image_url, video_ad_url, virtual_tour_url, curator, status
      ) VALUES (
        ${exhId}, ${title}, ${subtitle || ''}, ${dateRange || ''}, ${location || ''}, 
        ${description || ''}, ${imageUrl || ''}, ${videoAdUrl || ''}, ${virtualTourUrl || ''}, 
        ${curator || 'ARTGALZIM Curatorial Team'}, ${status || 'upcoming'}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        date_range = EXCLUDED.date_range,
        location = EXCLUDED.location,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        video_ad_url = EXCLUDED.video_ad_url,
        virtual_tour_url = EXCLUDED.virtual_tour_url,
        curator = EXCLUDED.curator,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *;
    `;
    return result[0];
  },

  async listExhibitions() {
    return await sql`SELECT * FROM exhibitions ORDER BY created_at DESC;`;
  }
};

// ── 4. MEDIA ASSETS & STORAGE BUCKET CATALOG ────────────────────
export const MediaStorageService = {
  async registerAsset(asset) {
    const { bucketName, fileKey, fileUrl, fileType, mimeType, fileSizeBytes, title, description, tags } = asset;
    const result = await sql`
      INSERT INTO media_assets (
        bucket_name, file_key, file_url, file_type, mime_type, file_size_bytes, title, description, tags
      ) VALUES (
        ${bucketName}, ${fileKey}, ${fileUrl}, ${fileType}, ${mimeType || ''}, 
        ${fileSizeBytes || 0}, ${title || fileKey}, ${description || ''}, ${tags || []}
      )
      ON CONFLICT (file_key) DO UPDATE SET
        file_url = EXCLUDED.file_url,
        file_size_bytes = EXCLUDED.file_size_bytes,
        title = EXCLUDED.title,
        tags = EXCLUDED.tags,
        updated_at = NOW()
      RETURNING *;
    `;
    return result[0];
  },

  async listAssetsByBucket(bucketName) {
    return await sql`SELECT * FROM media_assets WHERE bucket_name = ${bucketName} ORDER BY created_at DESC;`;
  },

  async listAssetsByType(fileType) {
    return await sql`SELECT * FROM media_assets WHERE file_type = ${fileType} ORDER BY created_at DESC;`;
  }
};

// ── 5. ARTWORKS & PAYMENT LINKS CONTROLLER ──────────────────────
export const ArtworksService = {
  async getAllArtworks() {
    return await sql`SELECT * FROM artworks ORDER BY id ASC;`;
  },

  async createPaymentLink(linkData) {
    const { artworkId, artworkTitle, artist, amount, currency, paymentUrl, qrCodeUrl, customerEmail, customerName, notes } = linkData;
    const result = await sql`
      INSERT INTO payment_links (
        artwork_id, artwork_title, artist, amount, currency, payment_url, qr_code_url, customer_email, customer_name, notes
      ) VALUES (
        ${artworkId || null}, ${artworkTitle || ''}, ${artist || ''}, ${amount}, 
        ${currency || 'USD'}, ${paymentUrl}, ${qrCodeUrl || ''}, ${customerEmail || ''}, 
        ${customerName || ''}, ${notes || ''}
      )
      RETURNING *;
    `;
    return result[0];
  },

  async listPaymentLinks() {
    return await sql`SELECT * FROM payment_links ORDER BY created_at DESC;`;
  }
};

export default {
  OpenCallsService,
  ContractsService,
  ExhibitionsService,
  MediaStorageService,
  ArtworksService
};
