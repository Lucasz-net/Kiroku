/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'http'

// `vite dev` doesn't run the /api serverless functions Vercel uses in
// production, so this mirrors them locally: it loads the same handler
// modules (api/mal/*.ts) through Vite's own SSR module loader and wires
// them up as dev-server middleware, instead of requiring `vercel dev` or
// duplicating the proxy logic.
const MAL_ROUTES = new Set(['anime', 'ranking', 'characters']);

function malDevProxy(): Plugin {
  return {
    name: 'mal-api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith('/api/mal/')) return next();
        // Vercel resolves /api/mal/<route> to api/mal/<route>.ts by path;
        // mirror that here instead of hardcoding one route per branch.
        const route = req.url.slice('/api/mal/'.length).split(/[?#/]/)[0];
        if (!MAL_ROUTES.has(route)) return next();
        const modulePath = `/api/mal/${route}.ts`;
        try {
          const mod = await server.ssrLoadModule(modulePath);
          await mod.default(req, res);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
    },
  };
}

// Same reasoning as malDevProxy above, for the rest of the /api endpoints.
// The POST ones take bodies, which the Vercel runtime pre-parses into
// `req.body` and the dev server doesn't — the handlers read either shape (see
// readJsonBody in api/_lib/auth.ts), so the raw stream is passed through
// untouched here.
const SERVERLESS_ROUTES: Record<string, string> = {
  '/api/account/delete':      '/api/account/delete.ts',
  '/api/auth/login':          '/api/auth/login.ts',
  '/api/auth/reset-password': '/api/auth/reset-password.ts',
  // Portadas. En dev no hay CDN delante, así que cada miss del caché del
  // navegador llega hasta Jikan de verdad — en producción lo normal es que
  // ni siquiera se ejecute esta función (ver api/jikan/media.ts).
  '/api/jikan/media':         '/api/jikan/media.ts',
  // En producción sólo lo alcanzan los bots (ver las reescrituras de
  // vercel.json); acá se puede abrir a mano para ver la vista previa.
  '/api/og':                  '/api/og.ts',
};

function serverlessDevProxy(): Plugin {
  return {
    name: 'serverless-api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const path = req.url?.split('?')[0] ?? '';
        const modulePath = SERVERLESS_ROUTES[path];
        if (!modulePath) return next();
        try {
          const mod = await server.ssrLoadModule(modulePath);
          await mod.default(req, res);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix = load every var from .env into `env`, not just VITE_*
  // ones, so MAL_CLIENT_ID (deliberately unprefixed, server-only) reaches
  // the dev proxy above the same way it reaches the Vercel function.
  const env = loadEnv(mode, process.cwd(), '');
  if (env.MAL_CLIENT_ID) process.env.MAL_CLIENT_ID = env.MAL_CLIENT_ID;
  // Same reasoning, for the service-role clients in api/account/delete.ts and
  // api/auth/*. The anon key is needed server-side too: /api/auth/login signs
  // in through a plain anon client so the session it hands back is an ordinary
  // user session, not a privileged one.
  if (env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
  if (env.VITE_SUPABASE_ANON_KEY) process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

  return {
    plugins: [
      react(),
      tailwindcss(),
      malDevProxy(),
      serverlessDevProxy(),
    ],
    server: {
      headers: {
        // Desactiva toda forma de caché en el servidor de desarrollo.
        // Evita que F5 sirva módulos JS/CSS desactualizados.
        'Cache-Control': 'no-store',
      },
    },
    preview: {
      headers: {
        // Lo mismo para `npm run preview` (build local).
        // Para producción real, el servidor de hosting gestiona estas cabeceras.
        'Cache-Control': 'no-store',
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
    },
  };
})
