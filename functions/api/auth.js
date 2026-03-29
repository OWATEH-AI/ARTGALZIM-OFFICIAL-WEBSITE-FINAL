// Auth Middleware for Admin Dashboard

const COOKIE_NAME = 'artgalzim_session';

export async function checkAuth(request, env) {
  // For Cloudflare Workers, we'll use a simple cookie-based auth
  // In production, you should use a proper JWT implementation

  const cookie = request.headers.get('Cookie');
  if (!cookie) {
    return { authenticated: false };
  }

  const sessionMatch = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!sessionMatch) {
    return { authenticated: false };
  }

  const token = sessionMatch[1];

  // Verify token against stored session (could be in KV)
  // For simplicity, we check if the token matches our expected format
  const expectedToken = await generateSessionToken(env);

  if (token !== expectedToken) {
    return { authenticated: false };
  }

  return { authenticated: true };
}

export async function login(request, env) {
  try {
    const body = await request.json();
    const { password } = body;

    // Check password against environment variable
    if (password !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate session token
    const token = await generateSessionToken(env);

    // Set cookie with the token
    const cookie = `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`;

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function logout(env) {
  // Clear the cookie
  const cookie = `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`;

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
}

// Simple session token generation
// In production, use a proper crypto library
async function generateSessionToken(env) {
  // Create a simple hash of password + date
  const data = `${env.ADMIN_PASSWORD}_${new Date().toISOString().split('T')[0]}`;

  // Use Web Crypto API for hashing
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

// Middleware wrapper for protected routes
export async function withAuth(handler, request, env, ...args) {
  const auth = await checkAuth(request, env);

  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return handler(request, env, ...args);
}
