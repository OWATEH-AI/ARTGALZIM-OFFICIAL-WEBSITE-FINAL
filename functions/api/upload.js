// Upload API Handler - Handles image uploads to R2

export async function handleUpload(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const uploadType = url.searchParams.get('type') || 'artwork';

    if (uploadType === 'artwork') {
      return uploadArtworkImage(request, env);
    } else if (uploadType === 'hero') {
      return uploadHeroImage(request, env);
    }

    return new Response(JSON.stringify({ error: 'Invalid upload type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function uploadArtworkImage(request, env) {
  const formData = await request.formData();
  const artist = formData.get('artist');
  const category = formData.get('category') || 'Artworks';
  const medium = formData.get('medium') || 'Contemporary Work';
  const size = formData.get('size') || 'Inquire for Size';
  const year = formData.get('year') || '2026';
  const description = formData.get('description') || 'Recently added to our collection.';
  const files = formData.getAll('images');

  if (!artist) {
    return new Response(JSON.stringify({ error: 'Artist name required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!files || files.length === 0) {
    return new Response(JSON.stringify({ error: 'No files uploaded' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const uploadedFiles = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;

    // Generate safe filename
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const r2Key = `artists/${artist}/${category}/${timestamp}_${safeName}`;
    const publicUrl = `https://${env.IMAGES_BUCKET.bucketId}.r2.dev/${r2Key}`;

    // Upload to R2
    await env.IMAGES_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `inline; filename="${safeName}"`,
      },
    });

    // Save metadata to D1
    const artworkId = `${artist}_${category}_${timestamp}`;
    await env.DB.prepare(
      `INSERT INTO artworks (id, artist, category, filename, r2_key, r2_url, medium, size, year, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(artworkId, artist, category, safeName, r2Key, publicUrl, medium, size, year, description).run();

    uploadedFiles.push({
      filename: safeName,
      r2Key: r2Key,
      url: publicUrl,
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    files: uploadedFiles,
    message: `${uploadedFiles.length} image(s) uploaded successfully`,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function uploadHeroImage(request, env) {
  const formData = await request.formData();
  const page = formData.get('page') || 'home';
  const file = formData.get('image');
  const fixedName = formData.get('fixedName');

  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'No file uploaded' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Generate filename
  const safeName = fixedName ? fixedName.replace(/[^a-zA-Z0-9.-]/g, '_') : file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const r2Key = `hero/${page}/${safeName}`;
  const publicUrl = `https://${env.IMAGES_BUCKET.bucketId}.r2.dev/${r2Key}`;

  // Upload to R2
  await env.IMAGES_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      contentDisposition: `inline; filename="${safeName}"`,
    },
  });

  return new Response(JSON.stringify({
    ok: true,
    file: safeName,
    r2Key: r2Key,
    url: publicUrl,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
