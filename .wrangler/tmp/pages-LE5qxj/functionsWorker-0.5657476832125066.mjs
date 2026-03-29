var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../.wrangler/tmp/bundle-MBi559/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// api/exhibitions.js
async function handleExhibitions(request, env) {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  switch (request.method) {
    case "GET":
      if (id && id !== "exhibitions") {
        return getExhibition(env, id);
      }
      return listExhibitions(env);
    case "POST":
      return saveExhibition(request, env);
    case "DELETE":
      if (id && id !== "exhibitions") {
        return deleteExhibition(env, id);
      }
      return new Response("ID required", { status: 400 });
    default:
      return new Response("Method not allowed", { status: 405 });
  }
}
__name(handleExhibitions, "handleExhibitions");
async function listExhibitions(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM exhibitions ORDER BY created_at DESC"
  ).all();
  const exhibitions = (results || []).map((row) => ({
    id: row.id,
    title: row.title,
    artist: row.artist,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    location: row.location,
    category: row.category,
    description: row.description
  }));
  return new Response(JSON.stringify(exhibitions), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(listExhibitions, "listExhibitions");
async function getExhibition(env, id) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM exhibitions WHERE id = ?"
  ).bind(id).all();
  if (!results || results.length === 0) {
    return new Response("Not found", { status: 404 });
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
    description: row.description
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(getExhibition, "getExhibition");
async function saveExhibition(request, env) {
  const body = await request.json();
  const id = body.id || Date.now().toString();
  const title = body.title || "";
  const artist = body.artist || "";
  const startDate = body.startDate || "";
  const endDate = body.endDate || "";
  const status = body.status || "upcoming";
  const location = body.location || "";
  const category = body.category || "";
  const description = body.description || "";
  const { results } = await env.DB.prepare(
    "SELECT id FROM exhibitions WHERE id = ?"
  ).bind(id).all();
  if (results && results.length > 0) {
    await env.DB.prepare(
      `UPDATE exhibitions SET
        title = ?, artist = ?, start_date = ?, end_date = ?,
        status = ?, location = ?, category = ?, description = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(title, artist, startDate, endDate, status, location, category, description, id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO exhibitions (id, title, artist, start_date, end_date, status, location, category, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, title, artist, startDate, endDate, status, location, category, description).run();
  }
  return new Response(JSON.stringify({ ok: true, id }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(saveExhibition, "saveExhibition");
async function deleteExhibition(env, id) {
  await env.DB.prepare("DELETE FROM exhibitions WHERE id = ?").bind(id).run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(deleteExhibition, "deleteExhibition");

// api/content.js
async function handleContent(request, env) {
  switch (request.method) {
    case "GET":
      return getAllContent(env);
    case "POST":
      return saveContent(request, env);
    default:
      return new Response("Method not allowed", { status: 405 });
  }
}
__name(handleContent, "handleContent");
async function getAllContent(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM page_content"
  ).all();
  const content = {};
  (results || []).forEach((row) => {
    try {
      content[row.page_key] = JSON.parse(row.content);
    } catch {
      content[row.page_key] = row.content;
    }
  });
  return new Response(JSON.stringify(content), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(getAllContent, "getAllContent");
async function saveContent(request, env) {
  const body = await request.json();
  for (const [pageKey, pageData] of Object.entries(body)) {
    const content = JSON.stringify(pageData);
    const id = `${pageKey}_${Date.now()}`;
    const { results } = await env.DB.prepare(
      "SELECT id FROM page_content WHERE page_key = ?"
    ).bind(pageKey).all();
    if (results && results.length > 0) {
      await env.DB.prepare(
        `UPDATE page_content SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE page_key = ?`
      ).bind(content, pageKey).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO page_content (id, page_key, content) VALUES (?, ?, ?)`
      ).bind(id, pageKey, content).run();
    }
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(saveContent, "saveContent");

// api/artworks.js
async function handleArtworks(request, env) {
  const url = new URL(request.url);
  switch (request.method) {
    case "GET":
      return listArtworks(env);
    case "DELETE":
      return deleteArtwork(request, env);
    default:
      return new Response("Method not allowed", { status: 405 });
  }
}
__name(handleArtworks, "handleArtworks");
async function listArtworks(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM artworks ORDER BY artist, category, created_at DESC"
  ).all();
  return new Response(JSON.stringify(results || []), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(listArtworks, "listArtworks");
async function deleteArtwork(request, env) {
  const body = await request.json().catch(() => ({}));
  const { artist, category, filename } = body;
  if (!artist || !category || !filename) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { results } = await env.DB.prepare(
    "SELECT r2_key FROM artworks WHERE artist = ? AND category = ? AND filename = ?"
  ).bind(artist, category, filename).all();
  if (results && results.length > 0) {
    const r2Key = results[0].r2_key;
    await env.IMAGES_BUCKET.delete(r2Key);
    await env.DB.prepare(
      "DELETE FROM artworks WHERE artist = ? AND category = ? AND filename = ?"
    ).bind(artist, category, filename).run();
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(deleteArtwork, "deleteArtwork");

// api/upload.js
async function handleUpload(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const url = new URL(request.url);
    const uploadType = url.searchParams.get("type") || "artwork";
    if (uploadType === "artwork") {
      return uploadArtworkImage(request, env);
    } else if (uploadType === "hero") {
      return uploadHeroImage(request, env);
    }
    return new Response(JSON.stringify({ error: "Invalid upload type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleUpload, "handleUpload");
async function uploadArtworkImage(request, env) {
  const formData = await request.formData();
  const artist = formData.get("artist");
  const category = formData.get("category") || "Artworks";
  const medium = formData.get("medium") || "Contemporary Work";
  const size = formData.get("size") || "Inquire for Size";
  const year = formData.get("year") || "2026";
  const description = formData.get("description") || "Recently added to our collection.";
  const files = formData.getAll("images");
  if (!artist) {
    return new Response(JSON.stringify({ error: "Artist name required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!files || files.length === 0) {
    return new Response(JSON.stringify({ error: "No files uploaded" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const uploadedFiles = [];
  for (const file of files) {
    if (!(file instanceof File)) continue;
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const timestamp = Date.now();
    const r2Key = `artists/${artist}/${category}/${timestamp}_${safeName}`;
    const publicUrl = `https://${env.IMAGES_BUCKET.bucketId}.r2.dev/${r2Key}`;
    await env.IMAGES_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `inline; filename="${safeName}"`
      }
    });
    const artworkId = `${artist}_${category}_${timestamp}`;
    await env.DB.prepare(
      `INSERT INTO artworks (id, artist, category, filename, r2_key, r2_url, medium, size, year, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(artworkId, artist, category, safeName, r2Key, publicUrl, medium, size, year, description).run();
    uploadedFiles.push({
      filename: safeName,
      r2Key,
      url: publicUrl
    });
  }
  return new Response(JSON.stringify({
    ok: true,
    files: uploadedFiles,
    message: `${uploadedFiles.length} image(s) uploaded successfully`
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(uploadArtworkImage, "uploadArtworkImage");
async function uploadHeroImage(request, env) {
  const formData = await request.formData();
  const page = formData.get("page") || "home";
  const file = formData.get("image");
  const fixedName = formData.get("fixedName");
  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ error: "No file uploaded" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const safeName = fixedName ? fixedName.replace(/[^a-zA-Z0-9.-]/g, "_") : file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const r2Key = `hero/${page}/${safeName}`;
  const publicUrl = `https://${env.IMAGES_BUCKET.bucketId}.r2.dev/${r2Key}`;
  await env.IMAGES_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      contentDisposition: `inline; filename="${safeName}"`
    }
  });
  return new Response(JSON.stringify({
    ok: true,
    file: safeName,
    r2Key,
    url: publicUrl
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(uploadHeroImage, "uploadHeroImage");

// api/artists.js
async function handleArtists(request, env) {
  switch (request.method) {
    case "GET":
      return listArtists(env);
    case "POST":
      return createArtistFolder(request, env);
    default:
      return new Response("Method not allowed", { status: 405 });
  }
}
__name(handleArtists, "handleArtists");
async function listArtists(env) {
  const { results } = await env.DB.prepare(
    `SELECT artist, category, filename, r2_key
     FROM artworks
     ORDER BY artist, category, created_at DESC`
  ).all();
  const artistsMap = /* @__PURE__ */ new Map();
  (results || []).forEach((row) => {
    if (!artistsMap.has(row.artist)) {
      artistsMap.set(row.artist, {
        name: row.artist,
        categories: /* @__PURE__ */ new Map()
      });
    }
    const artistData = artistsMap.get(row.artist);
    if (!artistData.categories.has(row.category)) {
      artistData.categories.set(row.category, {
        name: row.category,
        images: []
      });
    }
    const proxiedUrl = `/api/media/${row.r2_key}`;
    artistData.categories.get(row.category).images.push(proxiedUrl);
  });
  const artists = Array.from(artistsMap.values()).map((artist) => ({
    name: artist.name,
    categories: Array.from(artist.categories.values()).map((cat) => ({
      name: cat.name,
      imageCount: cat.images.length,
      images: cat.images
    }))
  }));
  return new Response(JSON.stringify(artists), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(listArtists, "listArtists");
async function createArtistFolder(request, env) {
  const body = await request.json();
  const artist = body.artist?.trim();
  const category = body.category?.trim() || "Artworks";
  if (!artist) {
    return new Response(JSON.stringify({ error: "Artist name required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response(JSON.stringify({ ok: true, artist, category }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(createArtistFolder, "createArtistFolder");

// api/auth.js
var COOKIE_NAME = "artgalzim_session";
async function checkAuth(request, env) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) {
    return { authenticated: false };
  }
  const sessionMatch = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!sessionMatch) {
    return { authenticated: false };
  }
  const token = sessionMatch[1];
  const expectedToken = await generateSessionToken(env);
  if (token !== expectedToken) {
    return { authenticated: false };
  }
  return { authenticated: true };
}
__name(checkAuth, "checkAuth");
async function login(request, env) {
  try {
    const body = await request.json();
    const { password } = body;
    if (password !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Invalid password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    const token = await generateSessionToken(env);
    const cookie = `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`;
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookie
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(login, "login");
async function logout(env) {
  const cookie = `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`;
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie
    }
  });
}
__name(logout, "logout");
async function generateSessionToken(env) {
  const data = `${env.ADMIN_PASSWORD}_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}
__name(generateSessionToken, "generateSessionToken");
async function withAuth(handler, request, env, ...args) {
  const auth = await checkAuth(request, env);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  return handler(request, env, ...args);
}
__name(withAuth, "withAuth");

// [[path]].js
async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    let response;
    if (path === "/api/auth/login") {
      response = await login(request, env);
    } else if (path === "/api/auth/logout") {
      response = await logout(env);
    } else if (path === "/api/public-gallery") {
      response = await handlePublicGallery(request, env);
    } else if (path.startsWith("/api/media/")) {
      return handleMediaProxy(request, env);
    } else if (path.startsWith("/api/exhibitions")) {
      response = await withAuth(handleExhibitions, request, env);
    } else if (path.startsWith("/api/content")) {
      response = await withAuth(handleContent, request, env);
    } else if (path.startsWith("/api/artworks")) {
      response = await withAuth(handleArtworks, request, env);
    } else if (path.startsWith("/api/upload")) {
      response = await withAuth(handleUpload, request, env);
    } else if (path.startsWith("/api/artists")) {
      response = await withAuth(handleArtists, request, env);
    } else if (path === "/api/sync") {
      response = await withAuth(handleSync, request, env);
    } else {
      return new Response("Not Found", { status: 404 });
    }
    const newHeaders = new Headers(response.headers);
    Object.keys(corsHeaders).forEach((key) => {
      newHeaders.set(key, corsHeaders[key]);
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
__name(onRequest, "onRequest");
async function handleSync(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const artists = await getArtistsWithArtworks(env);
  const exhibitions = await getExhibitionsData(env);
  const content = await getPageContentData(env);
  return new Response(JSON.stringify({
    ok: true,
    message: "Gallery synced",
    data: { artists, exhibitions, content }
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleSync, "handleSync");
async function getArtistsWithArtworks(env) {
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT artist FROM artworks ORDER BY artist"
  ).all();
  return results || [];
}
__name(getArtistsWithArtworks, "getArtistsWithArtworks");
async function getExhibitionsData(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM exhibitions ORDER BY start_date DESC"
  ).all();
  return results || [];
}
__name(getExhibitionsData, "getExhibitionsData");
async function getPageContentData(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM page_content"
  ).all();
  const content = {};
  (results || []).forEach((row) => {
    try {
      content[row.page_key] = JSON.parse(row.content);
    } catch {
      content[row.page_key] = row.content;
    }
  });
  return content;
}
__name(getPageContentData, "getPageContentData");
async function handlePublicGallery(request, env) {
  const { results: artworks } = await env.DB.prepare(
    `SELECT artist, category, filename, r2_url, r2_key, medium, size, year, description
     FROM artworks 
     ORDER BY artist, category, created_at DESC`
  ).all();
  const artistsCollections = {};
  artworks.forEach((art) => {
    const key = `${art.artist}/${art.category}`;
    if (!artistsCollections[key]) {
      artistsCollections[key] = { images: [], cover: null };
    }
    const artObj = {
      src: art.r2_key.startsWith("http") ? art.r2_key : `/api/media/${art.r2_key}`,
      medium: art.medium || "Contemporary Work",
      size: art.size || "Inquire for Size",
      year: art.year || "2026",
      description: art.description || "Recently added to our collection."
    };
    artistsCollections[key].images.push(artObj);
    if (!artistsCollections[key].cover) artistsCollections[key].cover = artObj.src;
  });
  return new Response(JSON.stringify({
    ok: true,
    data: {
      artistsCollections,
      artworks: artworks.map((a) => ({
        src: a.r2_key.startsWith("http") ? a.r2_key : `/api/media/${a.r2_key}`,
        artist: a.artist,
        category: a.category,
        medium: a.medium,
        size: a.size,
        year: a.year,
        description: a.description
      }))
    }
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handlePublicGallery, "handlePublicGallery");
async function handleMediaProxy(request, env) {
  const url = new URL(request.url);
  const key = url.pathname.replace("/api/media/", "");
  if (!key) return new Response("Empty key", { status: 400 });
  const object = await env.IMAGES_BUCKET.get(key);
  if (object === null) {
    return new Response("Not Found", { status: 404 });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000");
  return new Response(object.body, {
    headers
  });
}
__name(handleMediaProxy, "handleMediaProxy");

// ../.wrangler/tmp/pages-LE5qxj/functionsRoutes-0.49835918548360103.mjs
var routes = [
  {
    routePath: "/:path*",
    mountPath: "/",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-MBi559/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-MBi559/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.5657476832125066.mjs.map
