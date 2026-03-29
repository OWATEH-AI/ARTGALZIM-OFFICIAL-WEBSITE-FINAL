// Cloudflare Pages Function - Catch-all Router
// This router handles all routes starting with /api/ by calling the sub-handlers

import { handleExhibitions } from './api/exhibitions.js';
import { handleContent } from './api/content.js';
import { handleArtworks } from './api/artworks.js';
import { handleUpload } from './api/upload.js';
import { handleArtists } from './api/artists.js';
import { login, logout, withAuth } from './api/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let response;

    // Auth routes (no auth required)
    if (path === '/api/auth/login') {
      response = await login(request, env);
    } else if (path === '/api/auth/logout') {
      response = await logout(env);
    }
    // Public gallery data (required for frontend syncing)
    else if (path === '/api/public-gallery') {
      response = await handlePublicGallery(request, env);
    }
    // Media Proxy (Serves images from R2 bucket)
    else if (path.startsWith('/api/media/')) {
      return handleMediaProxy(request, env);
    }
    // Protected API routes
    else if (path.startsWith('/api/exhibitions')) {
      response = await withAuth(handleExhibitions, request, env);
    } else if (path.startsWith('/api/content')) {
      response = await withAuth(handleContent, request, env);
    } else if (path.startsWith('/api/artworks')) {
      response = await withAuth(handleArtworks, request, env);
    } else if (path.startsWith('/api/upload')) {
      response = await withAuth(handleUpload, request, env);
    } else if (path.startsWith('/api/artists')) {
      response = await withAuth(handleArtists, request, env);
    } else if (path === '/api/sync') {
      response = await withAuth(handleSync, request, env);
    } else {
      // If no route matches, return 404
      return new Response('Not Found', { status: 404 });
    }

    // Add CORS headers to response
    const newHeaders = new Headers(response.headers);
    Object.keys(corsHeaders).forEach(key => {
      newHeaders.set(key, corsHeaders[key]);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

async function handleSync(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const artists = await getArtistsWithArtworks(env);
  const exhibitions = await getExhibitionsData(env);
  const content = await getPageContentData(env);

  return new Response(JSON.stringify({
    ok: true,
    message: 'Gallery synced',
    data: { artists, exhibitions, content }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getArtistsWithArtworks(env) {
  const { results } = await env.DB.prepare(
    'SELECT DISTINCT artist FROM artworks ORDER BY artist'
  ).all();
  return results || [];
}

async function getExhibitionsData(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM exhibitions ORDER BY start_date DESC'
  ).all();
  return results || [];
}

async function getPageContentData(env) {
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
  return content;
}

async function handlePublicGallery(request, env) {
  // Aggregate all artwork data into one object
  const { results: artworks } = await env.DB.prepare(
    `SELECT artist, category, filename, r2_url, r2_key, medium, size, year, description
     FROM artworks 
     ORDER BY artist, category, created_at DESC`
  ).all();

  const artistsCollections = {};
  artworks.forEach(art => {
    const key = `${art.artist}/${art.category}`;
    if (!artistsCollections[key]) {
      artistsCollections[key] = { images: [], cover: null };
    }
    const artObj = {
      src: art.r2_key.startsWith('http') ? art.r2_key : `/api/media/${art.r2_key}`,
      medium: art.medium || 'Contemporary Work',
      size: art.size || 'Inquire for Size',
      year: art.year || '2026',
      description: art.description || 'Recently added to our collection.'
    };
    artistsCollections[key].images.push(artObj);
    if (!artistsCollections[key].cover) artistsCollections[key].cover = artObj.src;
  });

  return new Response(JSON.stringify({
    ok: true,
    data: {
      artistsCollections,
      artworks: artworks.map(a => ({
        src: a.r2_key.startsWith('http') ? a.r2_key : `/api/media/${a.r2_key}`,
        artist: a.artist,
        category: a.category,
        medium: a.medium,
        size: a.size,
        year: a.year,
        description: a.description
      }))
    }
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleMediaProxy(request, env) {
  const url = new URL(request.url);
  const key = url.pathname.replace('/api/media/', '');

  if (!key) return new Response('Empty key', { status: 400 });

  const object = await env.IMAGES_BUCKET.get(key);

  if (object === null) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

  return new Response(object.body, {
    headers,
  });
}
