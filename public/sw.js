// App-shell service worker: cache static assets, network-first for pages,
// offline fallback when a page can't be fetched. POSTs (SSE calcs) pass through.
const VERSION = 'v6'
const CACHE = `shippad-${VERSION}`
const SHELL = [
  '/offline',
  '/css/app.css',
  '/js/app.js',
  '/js/components/money-bar.js',
  '/js/components/copy-text.js',
  '/js/components/install-button.js',
  '/js/components/qr-button.js',
  '/fonts/barlow-semi-condensed-600.woff2',
  '/fonts/barlow-semi-condensed-700.woff2',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/manifest.webmanifest',
  'https://cdn.jsdelivr.net/gh/starfederation/datastar@1.0.4/bundles/datastar.js'
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.headers.get('accept')?.includes('text/event-stream')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(request)) ?? caches.match('/offline'))
    )
    return
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached ?? network
    })
  )
})
