/**
 * Service worker for the installed app.
 *
 * Its job is to make the shell open without the network — the records
 * themselves are already in localStorage, and `src/lib/sync.js` reconciles
 * them with the server when the connection returns.
 *
 * What it must never do is cache the API. A cached `GET /state` would hand
 * sync.js a stale version number, and the version check refusing a stale push
 * is the only thing standing between two devices and silent data loss. Hence
 * the exclusions below: non-GET bypasses entirely (so the keepalive PUT on
 * visibilitychange is untouched), cross-origin bypasses, and `/api/` bypasses
 * even same-origin — which is the documented single-domain deployment.
 */
const VERSION = 'v1'
const SHELL = `stonezen-shell-${VERSION}`
const RUNTIME = `stonezen-runtime-${VERSION}`
const SHELL_URL = '/index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // `reload` bypasses the HTTP cache: nginx sends index.html as no-store
      // precisely so a deploy cannot strand clients on an old bundle, and the
      // precache has to honour that rather than store whatever was lying around.
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL, RUNTIME])
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

/** Everything the worker must keep its hands off. */
function bypass(request, url) {
  return (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/healthz'
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (bypass(request, url)) return

  // Navigation: network first, so a deploy is picked up on the next load, with
  // the cached shell as the offline answer. The SPA routes from there.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put(SHELL_URL, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(SHELL_URL).then((r) => r || Response.error())),
    )
    return
  }

  // Vite fingerprints /assets/, so a hit is always the right file and a miss is
  // always a new build — cache first, no revalidation needed.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(RUNTIME).then((c) => c.put(request, copy)).catch(() => {})
            }
            return res
          }),
      ),
    )
    return
  }

  // Icons, the manifest, fonts: serve what we have, refresh in the background.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(RUNTIME).then((c) => c.put(request, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => hit || Response.error())
      return hit || network
    }),
  )
})

// Lets a future in-app "update now" button activate a waiting worker.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})
