// Artworks API Handler

export async function handleArtworks(request, env) {
  const url = new URL(request.url);

  switch (request.method) {
    case 'GET':
      return listArtworks(env);

    case 'DELETE':
      return deleteArtwork(request, env);

    default:
      return new Response('Method not allowed', { status: 405 });
  }
}

async function listArtworks(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM artworks ORDER BY artist, category, created_at DESC'
  ).all();

  return new Response(JSON.stringify(results || []), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function deleteArtwork(request, env) {
  const body = await request.json().catch(() => ({}));
  const { artist, category, filename } = body;

  if (!artist || !category || !filename) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Find the artwork in DB
  const { results } = await env.DB.prepare(
    'SELECT r2_key FROM artworks WHERE artist = ? AND category = ? AND filename = ?'
  ).bind(artist, category, filename).all();

  if (results && results.length > 0) {
    const r2Key = results[0].r2_key;

    // Delete from R2
    await env.IMAGES_BUCKET.delete(r2Key);

    // Delete from DB
    await env.DB.prepare(
      'DELETE FROM artworks WHERE artist = ? AND category = ? AND filename = ?'
    ).bind(artist, category, filename).run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
