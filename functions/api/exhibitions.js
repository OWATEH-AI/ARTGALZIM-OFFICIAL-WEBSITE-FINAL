// Exhibitions API Handler

export async function handleExhibitions(request, env) {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop();

  switch (request.method) {
    case 'GET':
      if (id && id !== 'exhibitions') {
        return getExhibition(env, id);
      }
      return listExhibitions(env);

    case 'POST':
      return saveExhibition(request, env);

    case 'DELETE':
      if (id && id !== 'exhibitions') {
        return deleteExhibition(env, id);
      }
      return new Response('ID required', { status: 400 });

    default:
      return new Response('Method not allowed', { status: 405 });
  }
}

async function listExhibitions(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM exhibitions ORDER BY created_at DESC'
  ).all();

  const exhibitions = (results || []).map(row => ({
    id: row.id,
    title: row.title,
    artist: row.artist,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    location: row.location,
    category: row.category,
    description: row.description,
  }));

  return new Response(JSON.stringify(exhibitions), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getExhibition(env, id) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM exhibitions WHERE id = ?'
  ).bind(id).all();

  if (!results || results.length === 0) {
    return new Response('Not found', { status: 404 });
  }

  const row = results[0];
  return new Response(JSON.stringify({
    id: row.id,
    title: row.title,
    artist: row.artist,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    location: row.location,
    category: row.category,
    description: row.description,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function saveExhibition(request, env) {
  const body = await request.json();

  const id = body.id || Date.now().toString();
  const title = body.title || '';
  const artist = body.artist || '';
  const startDate = body.startDate || '';
  const endDate = body.endDate || '';
  const status = body.status || 'upcoming';
  const location = body.location || '';
  const category = body.category || '';
  const description = body.description || '';

  // Check if exists
  const { results } = await env.DB.prepare(
    'SELECT id FROM exhibitions WHERE id = ?'
  ).bind(id).all();

  if (results && results.length > 0) {
    // Update
    await env.DB.prepare(
      `UPDATE exhibitions SET
        title = ?, artist = ?, start_date = ?, end_date = ?,
        status = ?, location = ?, category = ?, description = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(title, artist, startDate, endDate, status, location, category, description, id).run();
  } else {
    // Insert
    await env.DB.prepare(
      `INSERT INTO exhibitions (id, title, artist, start_date, end_date, status, location, category, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, title, artist, startDate, endDate, status, location, category, description).run();
  }

  return new Response(JSON.stringify({ ok: true, id }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function deleteExhibition(env, id) {
  await env.DB.prepare('DELETE FROM exhibitions WHERE id = ?').bind(id).run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
