// Artists API Handler

export async function handleArtists(request, env) {
  switch (request.method) {
    case 'GET':
      return listArtists(env);

    case 'POST':
      return createArtistFolder(request, env);

    default:
      return new Response('Method not allowed', { status: 405 });
  }
}

async function listArtists(env) {
  // Get all unique artists with their categories and images
  const { results } = await env.DB.prepare(
    `SELECT artist, category, filename, r2_key
     FROM artworks
     ORDER BY artist, category, created_at DESC`
  ).all();

  // Group by artist and category
  const artistsMap = new Map();

  (results || []).forEach(row => {
    if (!artistsMap.has(row.artist)) {
      artistsMap.set(row.artist, {
        name: row.artist,
        categories: new Map(),
      });
    }

    const artistData = artistsMap.get(row.artist);
    if (!artistData.categories.has(row.category)) {
      artistData.categories.set(row.category, {
        name: row.category,
        images: [],
      });
    }

    const proxiedUrl = `/api/media/${row.r2_key}`;
    artistData.categories.get(row.category).images.push(proxiedUrl);
  });

  // Convert to expected format
  const artists = Array.from(artistsMap.values()).map(artist => ({
    name: artist.name,
    categories: Array.from(artist.categories.values()).map(cat => ({
      name: cat.name,
      imageCount: cat.images.length,
      images: cat.images,
    })),
  }));

  return new Response(JSON.stringify(artists), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function createArtistFolder(request, env) {
  const body = await request.json();
  const artist = body.artist?.trim();
  const category = body.category?.trim() || 'Artworks';

  if (!artist) {
    return new Response(JSON.stringify({ error: 'Artist name required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // In R2, folders are virtual - we just need to ensure the path exists
  // by uploading a placeholder or just returning success

  return new Response(JSON.stringify({ ok: true, artist, category }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
