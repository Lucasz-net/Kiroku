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

// Same reasoning as malDevProxy above, for the /api/account/* endpoints.
function accountDevProxy(): Plugin {
  return {
    name: 'account-api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.url !== '/api/account/delete') return next();
        try {
          const mod = await server.ssrLoadModule('/api/account/delete.ts');
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
  // Same reasoning, for api/account/delete.ts's service-role client.
  if (env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;

  return {
    plugins: [
      react(),
      tailwindcss(),
      malDevProxy(),
      accountDevProxy(),
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
