import { RunnerContainer } from './runner-container';
import { handleCron } from './cron-handler';
import { handleApi } from './api-handler';
import type { Env } from './types';

export { RunnerContainer };

const AUTH_COOKIE = '__auth_token';
const AUTH_MAX_AGE = 86400;
const INTERNAL_LOG_HEADER = 'x-internal-log-token';

async function computeHmac(secret: string, value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret || 'default-secret'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function computeAuthToken(env: Env): Promise<string> {
  return computeHmac(env.AUTH_SECRET || 'default-secret', env.AUTH_PASSWORD || '');
}

async function computeInternalLogToken(env: Env, executionId: string): Promise<string> {
  return computeHmac(env.AUTH_SECRET || 'default-secret', `execution-logs:${executionId}`);
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(name + '=')) return trimmed.slice(name.length + 1);
  }
  return null;
}

async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
  const token = getCookieValue(request.headers.get('cookie'), AUTH_COOKIE);
  if (!token) return false;
  return token === await computeAuthToken(env);
}

async function validateApiKey(env: Env, apiKey: string): Promise<boolean> {
  if (apiKey === env.API_KEY) return true;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(apiKey));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  const key = await env.DB.prepare('SELECT id FROM api_keys WHERE key_hash = ?').bind(hashHex).first();
  if (key) {
    await env.DB.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), (key as any).id).run();
    return true;
  }
  return false;
}

async function validateInternalLogToken(request: Request, env: Env, executionId: string): Promise<boolean> {
  const token = request.headers.get(INTERNAL_LOG_HEADER);
  if (!token) return false;
  return token === await computeInternalLogToken(env, executionId);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleCron(env, ctx));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Normalize: strip /api prefix so handler sees /tasks, /executions, /keys
    if (path.startsWith('/api/')) {
      url.pathname = '/' + path.slice(5);
    }

    const isApiRoute = path.startsWith('/api/') ||
      path.startsWith('/tasks') ||
      path.startsWith('/executions') ||
      path.startsWith('/keys');

    if (isApiRoute) {
      // Login endpoint
      if (path === '/api/auth/login' && request.method === 'POST') {
        let password = '';
        const ct = request.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          try { const body: any = await request.json(); password = body.password || ''; } catch {}
        } else {
          const formBody = await request.text();
          const params = new URLSearchParams(formBody);
          password = params.get('password') || '';
        }
        if (password === (env.AUTH_PASSWORD || '')) {
          const token = await computeAuthToken(env);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': `${AUTH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${AUTH_MAX_AGE}`,
            },
          });
        }
        return new Response(JSON.stringify({ error: 'Invalid password' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Logout endpoint
      if (path === '/api/auth/logout' && request.method === 'POST') {
        return new Response(null, {
          status: 303,
          headers: {
            'Location': '/login',
            'Set-Cookie': `${AUTH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
          },
        });
      }

      // Auth check endpoint
      if (path === '/api/auth/check') {
        const authed = await isAuthenticated(request, env);
        return new Response(JSON.stringify({ authenticated: authed }), {
          status: authed ? 200 : 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Container log reporting (internal, no auth)
      const execLogsMatch = url.pathname.match(/^\/executions\/([a-f0-9-]+)\/logs$/);
      if (execLogsMatch && request.method === 'PUT') {
        const executionId = execLogsMatch[1];
        const validInternalToken = await validateInternalLogToken(request, env, executionId);
        if (!validInternalToken) {
          return new Response(JSON.stringify({ error: 'Invalid internal log token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return handleApi(request, env, ctx);
      }

      // Require auth for all other API routes
      const authed = await isAuthenticated(request, env);
      const apiKey = request.headers.get('x-api-key');
      const keyValid = apiKey ? await validateApiKey(env, apiKey) : false;

      if (!authed && !keyValid) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return handleApi(request, env, ctx);
    }

    // Non-API routes: serve static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
