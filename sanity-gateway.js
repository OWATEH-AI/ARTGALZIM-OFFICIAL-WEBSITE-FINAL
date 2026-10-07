const API_VERSION = '2025-02-19';
const SESSION_COOKIE = 'ag_admin_session';
const encoder = new TextEncoder();
const ARTIST_TIERS = ['Keith Zenda', 'Emerging Artists', 'Student Artists'];

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
});

function slug(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'untitled';
}

function validateJournalMediaUrl(value, mediaType) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Enter a complete HTTPS video or document URL.');
  }
  if (url.protocol !== 'https:') throw new Error('Media links must use HTTPS.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const videoHosts = ['youtube.com', 'm.youtube.com', 'youtu.be'];
  const documentHosts = ['drive.google.com', 'docs.google.com'];
  const videoFile = /\.(mp4|webm|ogv|m3u8)$/i.test(url.pathname);
  const pdfFile = /\.pdf$/i.test(url.pathname);
  const instagramPost = host === 'instagram.com' && /^\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?/.test(url.pathname);
  const supported = mediaType === 'video'
    ? videoHosts.includes(host) || videoFile
    : mediaType === 'document'
      ? documentHosts.includes(host) || pdfFile
      : mediaType === 'social' && instagramPost;
  if (!supported) {
    throw new Error('This media type needs a YouTube link or direct video file, a Google Drive or PDF link, or an Instagram post/reel URL.');
  }
  return url.href;
}

function isDirectVideoUpload(file) {
  return file instanceof File && file.size > 0 && /\.(mp4|webm|ogv)$/i.test(file.name);
}

function cleanArtwork(doc) {
  const src = doc.imageUrl || doc.sourcePath || '';
  const filename = doc.filename || src.split('/').pop() || '';
  const storedTitle = String(doc.title || '').trim();
  const title = /^whats?ap(?:p|ge)?(?:\s|$)/i.test(storedTitle) || /^whats?ap(?:p|ge)?(?:\s|[-_]|$)/i.test(filename)
    ? 'Untitled Artwork'
    : storedTitle || 'Untitled';
  return {
    filename, src,
    artist: doc.artist || '', artist_tier: doc.artistTier || 'Emerging Artists',
    category: doc.category || 'Artworks', title,
    medium: doc.medium || 'Contemporary Work', size: doc.size || 'Inquire for Size',
    year: String(doc.year || '2026'), price: doc.price || 'Price on Request',
    purchaseType: doc.purchaseType || 'inquire', paymentLink: doc.paymentLink || '',
    description: doc.description || ''
  };
}

export function createSanityGateway(env) {
  const projectId = env.SANITY_PROJECT_ID || '2a274c3r';
  const dataset = env.SANITY_DATASET || 'production';
  const apiRoot = `https://${projectId}.api.sanity.io/v${API_VERSION}`;

  async function query(groq, { privateRead = false } = {}) {
    const url = new URL(`${apiRoot}/data/query/${dataset}`);
    url.searchParams.set('query', groq);
    if (privateRead) url.searchParams.set('perspective', 'raw');
    const headers = privateRead ? { authorization: `Bearer ${env.SANITY_API_TOKEN}` } : {};
    const response = await fetch(url, { headers });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `Sanity query failed (${response.status})`);
    if (Array.isArray(result.result)) return result.result;
    return result.result == null ? [] : [result.result];
  }

  async function mutate(mutations) {
    const response = await fetch(`${apiRoot}/data/mutate/${dataset}?returnIds=true`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.SANITY_API_TOKEN}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ mutations })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `Sanity mutation failed (${response.status})`);
    return result;
  }

  async function upload(file) {
    if (!file || !file.size) return null;
      const assetType = file.type.startsWith('image/') ? 'images' : 'files';
      const response = await fetch(`${apiRoot}/assets/${assetType}/${dataset}?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.SANITY_API_TOKEN}`,
        'content-type': file.type || 'application/octet-stream'
      },
      body: await file.arrayBuffer()
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `Sanity asset upload failed (${response.status})`);
    return result.document;
  }

  async function sign(value) {
    const key = await crypto.subtle.importKey('raw', encoder.encode(env.ADMIN_SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
    return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  async function sessionValid(request) {
    if (!env.ADMIN_SESSION_SECRET) return false;
    const cookie = request.headers.get('cookie') || '';
    const token = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    if (!token) return false;
    const [expiry, signature] = token.split('.');
    if (!expiry || !signature || Number(expiry) < Date.now()) return false;
    return signature === await sign(expiry);
  }

  async function getAllDocuments() {
    const docs = await query('*[_type in ["artwork", "artist", "album", "exhibition", "siteContent", "post", "libraryItem", "journalFolder", "journalEntry"] && !(_id in path("versions.**"))]{..., "imageUrl": coalesce(image.asset->url, poster.asset->url, imageUrl), "coverUrl": coalesce(cover.asset->url, coverUrl), "attachmentUrl": coalesce(attachment.asset->url, attachmentUrl)}', { privateRead: true });
    const latest = new Map();
    for (const doc of docs) {
      const id = doc._id.replace(/^drafts\./, '');
      if (doc._id.startsWith('drafts.') || !latest.has(id)) {
        const normalized = { ...doc, _id: id, _draft: doc._id.startsWith('drafts.') };
        if (['artist', 'album', 'siteContent', 'post'].includes(doc._type) && !doc.imageUrl) delete normalized.imageUrl;
        latest.set(id, normalized);
      }
    }
    return [...latest.values()].filter(doc => !doc.isDeleted);
  }

  async function getDocBySource(sourcePath) {
    const docs = await query(`*[_type == "artwork" && sourcePath == ${JSON.stringify(sourcePath)}]`, { privateRead: true });
    return docs.find(doc => doc._id.startsWith('drafts.')) || docs[0] || null;
  }

  async function getDocById(type, id, includeDocumentId = false) {
    const idMatch = `_id == ${JSON.stringify(id)} || _id == ${JSON.stringify(`drafts.${id}`)}`;
    const queryMatch = includeDocumentId ? ` || id == ${JSON.stringify(id)}` : '';
    const docs = await query(`*[_type == ${JSON.stringify(type)} && (${idMatch}${queryMatch})]`, { privateRead: true });
    return docs.find(doc => doc._id.startsWith('drafts.')) || docs[0] || null;
  }

  async function saveDraft(type, id, data) {
    const draftId = `drafts.${id}`;
    const current = (await query(`*[_id == ${JSON.stringify(draftId)}][0]`, { privateRead: true }))[0]
      || (await query(`*[_id == ${JSON.stringify(id)}][0]`, { privateRead: true }))[0]
      || {};
    const doc = { ...current, ...data, _id: draftId, _type: type };
    delete doc._rev;
    delete doc._createdAt;
    delete doc._updatedAt;
    if (data.isDeleted !== true) delete doc.isDeleted;
    await mutate([{ createOrReplace: doc }]);
    return doc;
  }

  async function saveDraftBatch(type, documents) {
    const drafts = documents.map(document => {
      const { _id, _rev, _createdAt, _updatedAt, _draft, ...fields } = document;
      return { ...fields, _id: `drafts.${_id}`, _type: type };
    });
    for (let index = 0; index < drafts.length; index += 100) {
      await mutate(drafts.slice(index, index + 100).map(document => ({ createOrReplace: document })));
    }
  }

  async function findArtistDoc(name) {
    const normalizedName = String(name).trim().toLocaleLowerCase();
    const docs = await getAllDocuments();
    return docs.find(doc => doc._type === 'artist' && String(doc.name || '').trim().toLocaleLowerCase() === normalizedName) || null;
  }

  async function ensureArtistAndAlbum(artistName, categoryName) {
    const requestedArtist = String(artistName || '').trim();
    const category = String(categoryName || '').trim();
    if (!requestedArtist || !category) throw new Error('Artist and album names are required.');

    const existingArtist = await findArtistDoc(requestedArtist);
    const artist = existingArtist?.name || requestedArtist;
    const existingDocs = await getAllDocuments();
    const existingArtwork = existingDocs.find(doc => doc._type === 'artwork'
      && String(doc.artist || '').trim().toLocaleLowerCase() === artist.toLocaleLowerCase());
    const tier = existingArtist?.tier || existingArtwork?.artistTier
      || (artist.toUpperCase().includes('KEITH ZENDA') ? 'Keith Zenda' : 'Emerging Artists');
    const artistId = existingArtist?._id || `artist-${slug(artist)}`;
    if (!existingArtist) await saveDraft('artist', artistId, { name: artist, tier });

    const existingAlbum = existingDocs.find(doc => doc._type === 'album'
      && String(doc.artist || '').trim().toLocaleLowerCase() === artist.toLocaleLowerCase()
      && String(doc.name || '').trim().toLocaleLowerCase() === category.toLocaleLowerCase());
    if (!existingAlbum) {
      await saveDraft('album', `album-${slug(artist)}-${slug(category)}`, { artist, name: category, coverSrc: '' });
    }
    return { artist, category, tier };
  }

  async function artistData() {
    const docs = await getAllDocuments();
    const artists = new Map();
    const albums = docs.filter(doc => doc._type === 'album');
    const artworks = docs.filter(doc => doc._type === 'artwork');
    const getArtist = name => {
      if (!artists.has(name)) {
        const artist = docs.find(doc => doc._type === 'artist' && doc.name === name);
        artists.set(name, { name, tier: artist?.tier || (name.toUpperCase().includes('KEITH ZENDA') ? 'Keith Zenda' : 'Emerging Artists'), cover: null, categories: [] });
      }
      return artists.get(name);
    };
    for (const doc of docs.filter(item => item._type === 'artist')) {
      if (!doc.name) continue;
      artists.set(doc.name, {
        name: doc.name,
        tier: doc.tier || (doc.name.toUpperCase().includes('KEITH ZENDA') ? 'Keith Zenda' : 'Emerging Artists'),
        cover: null,
        categories: []
      });
    }
    for (const doc of albums) {
      const artistName = String(doc.artist || '').trim();
      if (!artistName) continue;
      const artist = getArtist(artistName);
      const category = doc.name || 'Artworks';
      let album = artist.categories.find(item => item.name === category);
      if (!album) {
        album = { name: category, imageCount: 0, cover: doc.coverSrc || null, images: [], artworks: [] };
        artist.categories.push(album);
      } else if (doc.coverSrc) {
        album.cover = doc.coverSrc;
      }
    }
    for (const doc of artworks) {
      const artistName = String(doc.artist || '').trim();
      if (!artistName) continue;
      const artist = getArtist(artistName);
      const category = doc.category || 'Artworks';
      let album = artist.categories.find(item => item.name === category);
      if (!album) {
        album = { name: category, imageCount: 0, cover: null, images: [], artworks: [] };
        artist.categories.push(album);
      }
      const item = cleanArtwork(doc);
      album.artworks.push(item);
      album.images.push(item.src);
      album.imageCount++;
      if (!album.cover) album.cover = item.src;
      if (!artist.cover) artist.cover = item.src;
    }
    return [...artists.values()].map(artist => ({ ...artist, isStudent: artist.tier === 'Student Artists' }));
  }

  async function publicGallery() {
    const docs = await query('*[_type == "artwork" && (!defined(isDeleted) || isDeleted == false)]{title, artist, artistTier, category, medium, size, year, price, purchaseType, paymentLink, description, "imageUrl": coalesce(image.asset->url, imageUrl), sourcePath, filename}');
    const artistsCollections = {};
    const artworks = [];
    for (const doc of docs) {
      const item = cleanArtwork(doc);
      const key = `${item.artist}/${item.category}`;
      if (!artistsCollections[key]) artistsCollections[key] = { images: [], cover: null };
      artistsCollections[key].images.push(item);
      artistsCollections[key].cover ||= item.src;
      artworks.push(item);
    }
    return { artistsCollections, artworks };
  }

  async function authenticatedRoute(request, url) {
    const method = request.method;
    const path = url.pathname;
    const body = async () => request.json();
    if (!await sessionValid(request)) return json({ error: 'Authentication required.' }, 401);

    if (method === 'GET' && path === '/api/artists') return json(await artistData());
    if (method === 'GET' && path === '/api/artworks-metadata') {
      const docs = (await getAllDocuments()).filter(doc => doc._type === 'artwork');
      return json(Object.fromEntries(docs.map(doc => [doc.imageUrl || doc.sourcePath, cleanArtwork(doc)])));
    }
    if (method === 'POST' && path === '/api/set-album-cover') {
      const { artist, category, src } = await body();
      if (!artist || !category || !src) return json({ error: 'Missing artist, category or src' }, 400);
      await saveDraft('album', `album-${slug(artist)}-${slug(category)}`, { artist, name: category, coverSrc: src });
      return json({ ok: true, cover: src });
    }
    if (method === 'POST' && path === '/api/upload-artwork') {
      const form = await request.formData();
      const artist = String(form.get('artist') || 'Unknown Artist').trim();
      const category = String(form.get('category') || 'Artworks').trim();
      if (!artist || !category) return json({ error: 'Artist and album names are required.' }, 400);
      const files = form.getAll('images').filter(file => file instanceof File && file.size);
      if (!files.length) return json({ error: 'No files uploaded' }, 400);
      const purchaseType = String(form.get('purchaseType') || 'inquire');
      const paymentLink = String(form.get('paymentLink') || '');
      if (!['inquire', 'direct'].includes(purchaseType)) return json({ error: 'Invalid purchase type.' }, 400);
      if (purchaseType === 'direct' && !paymentLink) return json({ error: 'Payment link is mandatory when Direct Purchase is selected.' }, 400);
      if (purchaseType === 'direct') {
        try {
          const paymentUrl = new URL(paymentLink);
          if (!['http:', 'https:'].includes(paymentUrl.protocol)) throw new Error();
        } catch {
          return json({ error: 'Enter a valid http or https payment link.' }, 400);
        }
      }
      const artistRecord = await ensureArtistAndAlbum(artist, category);
      for (const file of files) {
        const asset = await upload(file);
        const filename = file.name;
        const sourcePath = `ARTISTS/${artist}/${category}/${filename}`;
        const existing = await getDocBySource(sourcePath);
        const id = existing?._id.replace(/^drafts\./, '') || `artwork-${slug(artist)}-${slug(category)}-${slug(filename)}`;
        const imageUrl = asset?.url || '';
        const suppliedTitle = String(form.get('title') || '').trim();
        const isFilenameTitle = /^whats?ap(?:p|ge)?(?:\s|$)/i.test(suppliedTitle);
        await saveDraft('artwork', id, {
          title: suppliedTitle && !isFilenameTitle ? suppliedTitle : /^whats?ap(?:p|ge)?(?:\s|[-_]|$)/i.test(filename) ? 'Untitled Artwork' : filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
          artist, category, artistTier: artistRecord.tier, medium: String(form.get('medium') || 'Contemporary Work'),
          size: String(form.get('size') || 'Inquire for Size'), year: String(form.get('year') || '2026'),
          price: String(form.get('price') || 'Price on Request'), purchaseType, paymentLink,
          description: String(form.get('description') || ''), filename, sourcePath, imageUrl,
          ...(asset?._id ? { image: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } } } : {})
        });
      }
      return json({ ok: true, files: files.map(file => file.name), message: 'Artwork staged in Sanity. Publish to make it public.' });
    }
    if (method === 'POST' && path === '/api/edit-artwork') {
      const form = await request.formData();
      const originalSrc = String(form.get('originalSrc') || '');
      const existing = await getDocBySource(originalSrc.replace(/^\//, ''))
        || (await query(`*[_type == "artwork" && imageUrl == ${JSON.stringify(originalSrc)}][0]`, { privateRead: true }))[0];
      if (!existing) return json({ error: 'Artwork not found in Sanity.' }, 404);
      const artistInput = String(form.get('artist') || existing.artist).trim();
      const category = String(form.get('category') || existing.category).trim();
      if (!artistInput || !category) return json({ error: 'Artist and album names are required.' }, 400);
      const artistRecord = await ensureArtistAndAlbum(artistInput, category);
      const artist = artistRecord.artist;
      const file = form.get('imageFile');
      const asset = file instanceof File && file.size ? await upload(file) : null;
      const sourcePath = `ARTISTS/${artist}/${category}/${file?.name || existing.filename || 'artwork'}`;
      const purchaseType = String(form.get('purchaseType') || 'inquire');
      const paymentLink = String(form.get('paymentLink') || '');
      if (!['inquire', 'direct'].includes(purchaseType)) return json({ error: 'Invalid purchase type.' }, 400);
      if (purchaseType === 'direct' && !paymentLink) return json({ error: 'Payment link is mandatory when Direct Purchase is selected.' }, 400);
      if (purchaseType === 'direct') {
        try {
          const paymentUrl = new URL(paymentLink);
          if (!['http:', 'https:'].includes(paymentUrl.protocol)) throw new Error();
        } catch {
          return json({ error: 'Enter a valid http or https payment link.' }, 400);
        }
      }
      const id = existing._id.replace(/^drafts\./, '');
      const saved = await saveDraft('artwork', id, {
        title: String(form.get('title') || ''), artist, category, artistTier: artistRecord.tier, medium: String(form.get('medium') || ''),
        size: String(form.get('size') || ''), year: String(form.get('year') || '2026'), price: String(form.get('price') || ''),
        purchaseType, paymentLink, description: String(form.get('description') || ''), sourcePath,
        filename: file instanceof File && file.size ? file.name : existing.filename,
        imageUrl: asset?.url || existing.imageUrl || existing.sourcePath,
        ...(asset?._id ? { image: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } } } : {})
      });
      return json({ ok: true, src: saved.imageUrl, metadata: cleanArtwork(saved), message: 'Artwork draft saved in Sanity.' });
    }
    if (method === 'DELETE' && path === '/api/delete-artwork') {
      const data = await body();
      const src = String(data.src || '').replace(/^\//, '');
      const doc = await getDocBySource(src) || (await query(`*[_type == "artwork" && imageUrl == ${JSON.stringify(data.src)}][0]`, { privateRead: true }))[0];
      if (!doc) return json({ error: 'Artwork not found in Sanity.' }, 404);
      await saveDraft('artwork', doc._id.replace(/^drafts\./, ''), { ...doc, isDeleted: true });
      return json({ ok: true, message: 'Artwork removal staged in Sanity.' });
    }
    if (method === 'POST' && path === '/api/create-artist-folder') {
      const data = await body();
      const artist = String(data.artist || '').trim();
      const category = String(data.category || '').trim();
      const requestedTier = String(data.tier || '').trim();
      if (!artist) return json({ error: 'Artist name is required.' }, 400);

      const existingArtist = await findArtistDoc(artist);
      if (!requestedTier) {
        if (!category) return json({ error: 'Album name is required.' }, 400);
        const existingAlbums = await getAllDocuments();
        const collision = existingAlbums.find(doc => doc._type === 'album'
          && String(doc.artist || '').trim().toLocaleLowerCase() === artist.toLocaleLowerCase()
          && String(doc.name || '').trim().toLocaleLowerCase() === category.toLocaleLowerCase());
        if (collision) return json({ error: `The album "${collision.name}" already exists for ${artist}.` }, 409);
        const existingArtwork = existingAlbums.find(doc => doc._type === 'artwork' && doc.artist === artist);
        const assignedTier = existingArtist?.tier || existingArtwork?.artistTier
          || (artist.toUpperCase().includes('KEITH ZENDA') ? 'Keith Zenda' : 'Emerging Artists');
        const canonicalName = existingArtist?.name || artist;
        if (!existingArtist) await saveDraft('artist', `artist-${slug(canonicalName)}`, { name: canonicalName, tier: assignedTier });
        await saveDraft('album', `album-${slug(canonicalName)}-${slug(category)}`, { artist: canonicalName, name: category, coverSrc: '' });
        return json({ ok: true, artist: canonicalName, category, folders: [category], tier: assignedTier });
      }
      if (existingArtist) return json({ error: `Artist "${existingArtist.name}" already exists.` }, 409);
      if (!requestedTier || !ARTIST_TIERS.includes(requestedTier)) {
        return json({ error: `Choose a valid artist tier: ${ARTIST_TIERS.join(', ')}.` }, 400);
      }

      const baseCategory = category || 'Artworks';
      const folders = requestedTier === 'Student Artists' ? ['Artworks'] : requestedTier === 'Emerging Artists'
        ? [...new Set(['Abstract', 'Portraits', 'Commissions', ...(baseCategory !== 'Artworks' && !['Abstract', 'Portraits', 'Commissions'].includes(baseCategory) ? [baseCategory] : [])])]
        : [baseCategory === 'Artworks' ? 'Abstract' : baseCategory];
      await saveDraft('artist', `artist-${slug(artist)}`, { name: artist, tier: requestedTier });
      for (const name of folders) {
        await saveDraft('album', `album-${slug(artist)}-${slug(name)}`, { artist, name, coverSrc: '' });
      }
      return json({ ok: true, artist, category: folders[0], folders, tier: requestedTier });
    }
    if (method === 'POST' && path === '/api/update-artist-tier') {
      const data = await body();
      const artist = String(data.artist || '').trim();
      const tier = String(data.tier || '').trim();
      if (!artist || !tier) return json({ error: 'Artist and tier are required.' }, 400);
      if (!ARTIST_TIERS.includes(tier)) return json({ error: `Choose a valid artist tier: ${ARTIST_TIERS.join(', ')}.` }, 400);
      const artistDoc = await findArtistDoc(artist);
      const canonicalName = artistDoc?.name || artist;
      await saveDraft('artist', artistDoc?._id || `artist-${slug(canonicalName)}`, { name: canonicalName, tier });
      const artworks = (await getAllDocuments()).filter(doc => doc._type === 'artwork' && doc.artist === canonicalName);
      await saveDraftBatch('artwork', artworks.map(doc => ({ ...doc, artistTier: tier })));
      return json({ ok: true, artist: canonicalName, tier });
    }
    if (method === 'GET' && path === '/api/exhibitions') {
      const exhibitions = (await getAllDocuments())
        .filter(doc => doc._type === 'exhibition')
        .map(doc => ({ ...doc, id: doc.id || doc._id }));
      return json(exhibitions);
    }
    if (method === 'POST' && path === '/api/exhibitions') {
      let item;
      let image = null;
      if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
        const form = await request.formData();
        item = Object.fromEntries([...form.entries()].filter(([key]) => key !== 'image'));
        const file = form.get('image');
        if (file instanceof File && file.size) image = await upload(file);
      } else {
        item = await body();
      }
      const id = String(item.id || `ex-${Date.now()}`).replace(/^drafts\./, '');
      const imageRef = image?._id ? { _type: 'image', asset: { _type: 'reference', _ref: image._id } } : undefined;
      const normalizedItem = { ...item, id };
      if (item.isPlaceholder !== undefined) {
        normalizedItem.isPlaceholder = item.isPlaceholder === true || item.isPlaceholder === 'true';
      }
      await saveDraft('exhibition', id, {
        ...normalizedItem,
        ...(image ? { imageUrl: image.url } : {}),
        ...(imageRef ? { poster: imageRef } : {})
      });
      return json({ ok: true, id });
    }
    if (method === 'DELETE' && path.startsWith('/api/exhibitions/')) {
      const id = decodeURIComponent(path.split('/').pop());
      const doc = await getDocById('exhibition', id, true);
      if (!doc) return json({ error: 'Exhibition not found.' }, 404);
      await saveDraft('exhibition', doc._id.replace(/^drafts\./, ''), { ...doc, isDeleted: true });
      return json({ ok: true });
    }
    if (method === 'GET' && path === '/api/content') {
      const doc = (await getAllDocuments()).find(item => item._type === 'siteContent' && item._id === 'site-content');
      if (!doc) return json({});
      if (typeof doc.payload === 'string') {
        try { return json(JSON.parse(doc.payload)); }
        catch { return json({ error: 'Saved site content is not valid JSON.' }, 500); }
      }
      const { _id, _type, _draft, _rev, _createdAt, _updatedAt, ...legacyPayload } = doc;
      return json(legacyPayload);
    }
      if (method === 'GET' && path === '/api/posts') {
        return json((await getAllDocuments()).filter(doc => doc._type === 'post'));
      }
      if (method === 'POST' && path === '/api/posts') {
        const item = await body();
        if (!String(item.title || '').trim()) return json({ error: 'Post title is required.' }, 400);
        const id = String(item.id || `post-${slug(item.title)}`).replace(/^drafts\./, '');
        await saveDraft('post', id, {
          title: String(item.title).trim(), slug: { _type: 'slug', current: slug(item.slug || item.title) },
          excerpt: String(item.excerpt || ''), body: String(item.body || ''),
          publishedAt: item.publishedAt || new Date().toISOString()
        });
        return json({ ok: true, id });
      }
      if (method === 'DELETE' && path.startsWith('/api/posts/')) {
        const id = decodeURIComponent(path.split('/').pop());
        const doc = await getDocById('post', id);
        if (!doc) return json({ error: 'Post not found.' }, 404);
        await saveDraft('post', doc._id.replace(/^drafts\./, ''), { ...doc, isDeleted: true });
        return json({ ok: true });
      }
      if (method === 'GET' && path === '/api/library') {
        return json((await getAllDocuments()).filter(doc => doc._type === 'libraryItem'));
      }
      if (method === 'POST' && path === '/api/library/update') {
        const data = await body();
        const id = String(data.id || '');
        const current = (await query(`*[_id == ${JSON.stringify(id)}][0]`, { privateRead: true }))[0]
          || (await query(`*[_id == ${JSON.stringify(`drafts.${id}`)}][0]`, { privateRead: true }))[0];
        if (!current) return json({ error: 'Media item not found.' }, 404);
        await saveDraft('libraryItem', id, { ...current, title: String(data.title || ''), description: String(data.description || '') });
        return json({ ok: true, id });
      }
      if (method === 'POST' && path === '/api/library') {
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File) || !file.size) return json({ error: 'Choose a file to upload.' }, 400);
        const title = String(form.get('title') || file.name).trim();
        const kind = String(form.get('kind') || (file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'document'));
        const asset = await upload(file);
        const id = `library-${slug(title)}-${Date.now()}`;
        const ref = { _type: kind === 'image' ? 'image' : 'file', asset: { _type: 'reference', _ref: asset._id } };
        await saveDraft('libraryItem', id, {
          title, kind, description: String(form.get('description') || ''),
          ...(kind === 'image' ? { image: ref } : { file: ref }), assetUrl: asset.url
        });
        return json({ ok: true, id, assetUrl: asset.url });
      }
      if (method === 'GET' && path === '/api/journal/folders') {
        return json((await getAllDocuments()).filter(doc => doc._type === 'journalFolder' && !doc.isDeleted));
      }
      if (method === 'POST' && path === '/api/journal/folders') {
        const form = await request.formData();
        const title = String(form.get('title') || '').trim();
        if (!title) return json({ error: 'Folder name is required.' }, 400);
        const id = String(form.get('id') || `journal-folder-${slug(title)}-${Date.now()}`).replace(/^drafts\./, '');
        const existing = form.get('id') ? await getDocById('journalFolder', id) : null;
        if (form.get('id') && !existing) return json({ error: 'Journal folder not found.' }, 404);
        const file = form.get('cover');
        const coverAsset = file instanceof File && file.size ? await upload(file) : null;
        const folderSlug = slug(form.get('slug') || title);
        await saveDraft('journalFolder', id, {
          title,
          slug: folderSlug,
          category: String(form.get('category') || 'Other'),
          organization: String(form.get('organization') || '').trim(),
          description: String(form.get('description') || '').trim(),
          ...(coverAsset?._id ? {
            cover: { _type: 'image', asset: { _type: 'reference', _ref: coverAsset._id } },
            coverUrl: coverAsset.url
          } : {})
        });
        return json({ ok: true, id, slug: folderSlug });
      }
      if (method === 'DELETE' && path.startsWith('/api/journal/folders/')) {
        const id = decodeURIComponent(path.slice('/api/journal/folders/'.length));
        const folder = await getDocById('journalFolder', id);
        if (!folder || folder.isDeleted) return json({ error: 'Journal folder not found.' }, 404);
        const hasEntries = (await getAllDocuments()).some(doc => doc._type === 'journalEntry' && doc.folderId === id);
        if (hasEntries) return json({ error: 'Move or delete this folder’s entries before deleting the folder.' }, 409);
        await saveDraft('journalFolder', folder._id.replace(/^drafts\./, ''), { ...folder, isDeleted: true });
        return json({ ok: true });
      }
      if (method === 'GET' && path === '/api/journal/entries') {
        return json((await getAllDocuments()).filter(doc => doc._type === 'journalEntry' && !doc.isDeleted));
      }
      if (method === 'POST' && path === '/api/journal/entries') {
        const form = await request.formData();
        const title = String(form.get('title') || '').trim();
        const folderId = String(form.get('folderId') || '').trim();
        if (!title) return json({ error: 'Entry title is required.' }, 400);
        const requestedDestination = String(form.get('destination') || '');
        const destination = requestedDestination || (form.get('entryType') === 'ARTGALZIM TV' ? 'tv' : 'journal');
        if (!['journal', 'tv'].includes(destination)) return json({ error: 'Choose a valid publishing section.' }, 400);
        if (destination === 'journal' && !folderId) return json({ error: 'Choose a journal folder.' }, 400);
        const folder = folderId ? await getDocById('journalFolder', folderId) : null;
        if (folderId && (!folder || folder.isDeleted)) return json({ error: 'Journal folder not found.' }, 404);
        if (destination === 'journal' && !folder) return json({ error: 'Choose a journal folder.' }, 400);
        const id = String(form.get('id') || `journal-entry-${slug(title)}-${Date.now()}`).replace(/^drafts\./, '');
        const existing = form.get('id') ? await getDocById('journalEntry', id) : null;
        if (form.get('id') && !existing) return json({ error: 'Journal entry not found.' }, 404);
        const entryType = String(form.get('entryType') || 'Story');
        const allowedTypes = ['News', 'Program', 'Event', 'Partnership', 'Collaboration', 'Story', 'Newsletter', 'ARTGALZIM TV'];
        if (!allowedTypes.includes(entryType)) return json({ error: 'Choose a valid journal entry type.' }, 400);
        const imageFile = form.get('image');
        const attachmentFile = form.get('attachment');
        const uploadedVideo = isDirectVideoUpload(attachmentFile);
        const attachmentLooksLikeVideo = attachmentFile instanceof File
          && attachmentFile.size > 0
          && (attachmentFile.type.startsWith('video/') || /\.(mp4|webm|ogv|mov|m4v)$/i.test(attachmentFile.name));
        if (destination === 'tv' && attachmentLooksLikeVideo && !uploadedVideo) {
          return json({ error: 'Upload videos as MP4, WebM, or Ogg files so they play in the built-in player.' }, 400);
        }
        const submittedMediaType = String(form.get('mediaType') || '');
        if (uploadedVideo && submittedMediaType && submittedMediaType !== 'video') {
          return json({ error: 'A directly uploaded video must use the Video media format.' }, 400);
        }
        const mediaType = submittedMediaType || (uploadedVideo ? 'video' : '');
        if (mediaType && !['video', 'document', 'social'].includes(mediaType)) {
          return json({ error: 'Choose a valid media format.' }, 400);
        }
        let mediaUrl;
        try {
          mediaUrl = validateJournalMediaUrl(form.get('mediaUrl'), mediaType);
        } catch (error) {
          return json({ error: error.message }, 400);
        }
        if (!mediaUrl && mediaType && !uploadedVideo) return json({ error: 'Enter a URL for the selected media format.' }, 400);
        if (destination === 'tv' && !uploadedVideo && (!mediaUrl || !['video', 'social'].includes(mediaType))) {
          return json({ error: 'ARTGALZIM TV entries need a supported video link or an MP4, WebM, or Ogg video upload.' }, 400);
        }
        const imageAsset = imageFile instanceof File && imageFile.size ? await upload(imageFile) : null;
        const attachmentAsset = attachmentFile instanceof File && attachmentFile.size ? await upload(attachmentFile) : null;
        const entrySlug = slug(form.get('slug') || title);
        await saveDraft('journalEntry', id, {
          title,
          slug: entrySlug,
          folderId: folder ? folderId : '',
          folderTitle: folder?.title || '',
          entryType,
          destination,
          mediaType,
          mediaUrl,
          excerpt: String(form.get('excerpt') || '').trim(),
          body: String(form.get('body') || '').trim(),
          ...(form.get('eventDate') ? { eventDate: String(form.get('eventDate')) } : {}),
          ...(form.get('endDate') ? { endDate: String(form.get('endDate')) } : {}),
          location: String(form.get('location') || '').trim(),
          author: String(form.get('author') || '').trim(),
          publishedAt: existing?.publishedAt || new Date().toISOString(),
          ...(imageAsset?._id ? {
            image: { _type: 'image', asset: { _type: 'reference', _ref: imageAsset._id } },
            imageUrl: imageAsset.url
          } : {}),
          ...(attachmentAsset?._id ? {
            attachment: { _type: 'file', asset: { _type: 'reference', _ref: attachmentAsset._id } },
            attachmentUrl: attachmentAsset.url,
            attachmentName: attachmentFile.name
          } : {})
        });
        return json({ ok: true, id, slug: entrySlug });
      }
      if (method === 'DELETE' && path.startsWith('/api/journal/entries/')) {
        const id = decodeURIComponent(path.slice('/api/journal/entries/'.length));
        const entry = await getDocById('journalEntry', id);
        if (!entry || entry.isDeleted) return json({ error: 'Journal entry not found.' }, 404);
        await saveDraft('journalEntry', entry._id.replace(/^drafts\./, ''), { ...entry, isDeleted: true });
        return json({ ok: true });
      }
      if (method === 'DELETE' && path.startsWith('/api/library/')) {
        const id = decodeURIComponent(path.split('/').pop());
        const doc = await getDocById('libraryItem', id);
        if (!doc) return json({ error: 'Media item not found.' }, 404);
        await saveDraft('libraryItem', doc._id.replace(/^drafts\./, ''), { ...doc, isDeleted: true });
        return json({ ok: true });
      }
    if (method === 'POST' && path === '/api/content') {
      const payload = await body();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return json({ error: 'Site content must be a JSON object.' }, 400);
      }
      await saveDraft('siteContent', 'site-content', {
        payload: JSON.stringify(payload, null, 2),
        updatedAt: new Date().toISOString()
      });
      return json({ ok: true });
    }
    if (method === 'POST' && path === '/api/upload-hero') {
      const form = await request.formData();
      const file = form.get('image');
      if (!(file instanceof File) || !file.size) return json({ error: 'No file' }, 400);
      const asset = await upload(file);
      const page = String(form.get('page') || 'home');
      const id = `hero-${slug(page)}-${slug(form.get('fixedName') || file.name)}`;
      await saveDraft('libraryItem', id, {
        title: file.name, kind: 'image', page, assetRef: asset?._id, assetUrl: asset?.url,
        ...(asset?._id ? { image: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } } } : {})
      });
      return json({ ok: true, file: file.name });
    }
    if (method === 'POST' && path === '/api/sync') {
      const drafts = await query('*[_id match "drafts.*"]', { privateRead: true });
      const mutations = [];
      for (const draft of drafts) {
        const publishedId = draft._id.slice('drafts.'.length);
        if (draft.isDeleted) mutations.push({ delete: { id: publishedId } });
        else {
          const published = { ...draft, _id: publishedId };
          delete published._rev;
          delete published._createdAt;
          delete published._updatedAt;
          delete published.isDeleted;
          mutations.push({ createOrReplace: published });
        }
        mutations.push({ delete: { id: draft._id } });
      }
      for (let index = 0; index < mutations.length; index += 100) await mutate(mutations.slice(index, index + 100));
      return json({ ok: true, published: drafts.length, output: `Published ${drafts.length} Sanity document(s).` });
    }
    return json({ error: 'API route not found.' }, 404);
  }

  return async function handle(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return null;
    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        const configured = Boolean(env.SANITY_API_TOKEN && env.ADMIN_PASSWORD && env.ADMIN_SESSION_SECRET);
        if (!configured) return json({ ok: true, provider: 'sanity', configured, connected: false });
        await query('*[_type == "exhibition"][0]._id', { privateRead: true });
        return json({ ok: true, provider: 'sanity', configured, connected: true });
      }
      if (url.pathname === '/api/public-gallery' && request.method === 'GET') return json({ data: await publicGallery() });
      if (url.pathname === '/api/public-content' && request.method === 'GET') {
        const docs = await query('*[_type in ["post", "libraryItem", "exhibition", "journalFolder", "journalEntry"] && (!defined(isDeleted) || isDeleted == false)]{_id, _type, id, title, slug, excerpt, body, description, conditions, publishedAt, kind, assetUrl, artist, category, organization, folderId, folderTitle, entryType, destination, mediaType, mediaUrl, eventDate, endDate, author, attachmentName, location, startDate, startTime, endTime, theme, status, contactLink, registrationLink, ctaText, registrationFee, timeRange, isPlaceholder, displayDateOverride, "fileUrl": coalesce(file.asset->url, attachment.asset->url, attachmentUrl), "imageUrl": coalesce(image.asset->url, poster.asset->url, imageUrl), "coverUrl": coalesce(cover.asset->url, coverUrl)} | order(publishedAt desc)');
        return json({ data: docs });
      }
      if (url.pathname === '/api/login' && request.method === 'POST') {
        if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) return json({ error: 'Admin authentication is not configured.' }, 503);
        const data = await request.json();
        const submitted = String(data.password || '');
        if (submitted.length !== env.ADMIN_PASSWORD.length) return json({ error: 'Incorrect password.' }, 401);
        let diff = 0;
        for (let index = 0; index < submitted.length; index++) diff |= submitted.charCodeAt(index) ^ env.ADMIN_PASSWORD.charCodeAt(index);
        if (diff) return json({ error: 'Incorrect password.' }, 401);
        const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
        const signature = await sign(expiry);
        return json({ ok: true }, 200, { 'set-cookie': `${SESSION_COOKIE}=${expiry}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800` });
      }
      if (url.pathname === '/api/session' && request.method === 'GET') return json({ authenticated: await sessionValid(request) });
      if (url.pathname === '/api/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
      if (url.pathname === '/api/upload-proof' && request.method === 'POST') {
        if (!env.SANITY_API_TOKEN) return json({ error: 'Sanity write token is not configured.' }, 503);
        if (!await sessionValid(request)) return json({ error: 'Authentication required.' }, 401);
        const form = await request.formData();
        const file = form.get('proofFile');
        if (!(file instanceof File) || !file.size) return json({ error: 'No proof file provided' }, 400);
        const asset = await upload(file);
        return json({ ok: true, url: asset?.url });
      }
      if (!env.SANITY_API_TOKEN) return json({ error: 'Sanity write token is not configured.' }, 503);
      return await authenticatedRoute(request, url);
    } catch (error) {
      console.error('[Sanity API]', error);
      return json({ error: error.message || 'Sanity request failed.' }, 500);
    }
  };
}