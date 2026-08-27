import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * Serves the `api/` folder during `npm run dev`.
 *
 * Vercel runs those files as serverless functions in production, but the plain
 * Vite dev server knows nothing about them and answers `/api/*` with a 404.
 * This middleware maps the same URL -> file convention Vercel uses, so dev and
 * production exercise identical handler code.
 *
 * Dev only — it is never part of the client bundle, and `vercel dev` bypasses it.
 */
function apiDevServer(env) {
  return {
    name: 'stonezen-api-dev',
    apply: 'serve',
    configureServer(server) {
      // Server-side secrets (DATABASE_URL, AUTH_SECRET) come from .env files.
      // Assigned to process.env for the dev process only; Vite never inlines
      // these into client code because they carry no VITE_ prefix.
      for (const [k, v] of Object.entries(env)) {
        if (!k.startsWith('VITE_') && process.env[k] === undefined) process.env[k] = v
      }

      const notFound = (res) => {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Not found' }))
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()

        const pathname = req.url.split('?')[0].replace(/\/+$/, '')
        const route = pathname.slice('/api/'.length)

        // Anything under /api that is not a real handler gets a JSON 404 and is
        // never passed to Vite. Falling through would let Vite's transform
        // pipeline serve api/_lib/*.js — i.e. hand out server-side source.
        const unsafe =
          !route || route.split('/').some((s) => !s || s.startsWith('_') || s === '.' || s === '..')
        if (unsafe) return notFound(res)

        const file = resolve(process.cwd(), 'api', `${route}.js`)
        const apiRoot = resolve(process.cwd(), 'api')
        if (!file.startsWith(apiRoot + '/') || !existsSync(file)) return notFound(res)

        try {
          const body = await readJsonBody(req)
          const mod = await server.ssrLoadModule(file)
          const handler = mod.default
          if (typeof handler !== 'function') return notFound(res)

          req.body = body
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          await handler(req, res)
        } catch (err) {
          server.config.logger.error(`[api-dev] ${route}: ${err?.stack || err}`)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
          }
          res.end(JSON.stringify({ ok: false, error: 'Dev API handler failed. See terminal.' }))
        }
      })
    },
  }
}

function readJsonBody(req) {
  return new Promise((resolvePromise) => {
    if (req.method === 'GET' || req.method === 'HEAD') return resolvePromise(undefined)
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1e6) req.destroy() // basic guard against runaway payloads
    })
    req.on('end', () => {
      if (!raw) return resolvePromise(undefined)
      try {
        resolvePromise(JSON.parse(raw))
      } catch {
        resolvePromise(undefined)
      }
    })
    req.on('error', () => resolvePromise(undefined))
  })
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' prefix loads every key, not just VITE_ — used server-side only, above.
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), apiDevServer(env)] }
})
