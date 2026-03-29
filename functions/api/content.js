// Page Content API Handler

export async function handleContent(request, env) {
  switch (request.method) {
    case 'GET':
      return getAllContent(env);

    case 'POST':
      return saveContent(request, env);

    default:
      return new Response('Method not allowed', { status: 405 });
  }
}

async function getAllContent(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM page_content'
  ).all();

  const content = {};
  (results || []).forEach(row => {
    try {
      content[row.page_key] = JSON.parse(row.content);
    } catch {
      content[row.page_key] = row.content;
    }
  });

  return new Response(JSON.stringify(content), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function saveContent(request, env) {
  const body = await request.json();

  // body can have multiple page keys, handle each
  for (const [pageKey, pageData] of Object.entries(body)) {
    const content = JSON.stringify(pageData);
    const id = `${pageKey}_${Date.now()}`;

    // Check if exists
    const { results } = await env.DB.prepare(
      'SELECT id FROM page_content WHERE page_key = ?'
    ).bind(pageKey).all();

    if (results && results.length > 0) {
      // Update
      await env.DB.prepare(
        `UPDATE page_content SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE page_key = ?`
      ).bind(content, pageKey).run();
    } else {
      // Insert
      await env.DB.prepare(
        `INSERT INTO page_content (id, page_key, content) VALUES (?, ?, ?)`
      ).bind(id, pageKey, content).run();
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
