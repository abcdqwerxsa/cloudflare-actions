import { RunnerContainer } from './runner-container';
import { handleCron } from './cron-handler';
import { handleApi } from './api-handler';
import type { Env } from './types';

export { RunnerContainer };

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleCron(env));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // API routes: accept both /api/... and /tasks, /executions, /keys directly
    const isApiRoute = url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/tasks') ||
      url.pathname.startsWith('/executions') ||
      url.pathname.startsWith('/keys');

    if (isApiRoute) {
      // Normalize: strip /api prefix so handler sees /tasks, /executions, /keys
      if (url.pathname.startsWith('/api/')) {
        url.pathname = '/' + url.pathname.slice(5);
      }

      // API key validation for non-GET requests
      if (request.method !== 'GET') {
        const apiKey = request.headers.get('x-api-key');
        if (apiKey && apiKey !== env.API_KEY) {
          return new Response(JSON.stringify({ error: 'Invalid API key' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      return handleApi(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
