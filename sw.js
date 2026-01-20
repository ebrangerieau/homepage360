const CACHE_NAME = 'hp360-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/manifest.json',
    '/icon-512.png',
    '/js/main.js',
    '/js/modules/store.js',
    '/js/modules/ui.js',
    '/js/modules/background.js',
    '/js/modules/widgets.js',
    '/js/modules/rss.js',
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@400;600&display=swap',
    'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Network first strategy for API calls (RSS, Weather)
    if (event.request.url.includes('api.rss2json.com') ||
        event.request.url.includes('api.open-meteo.com') ||
        event.request.url.includes('geocoding-api.open-meteo.com')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Fallback for API? Maybe just fail.
                return new Response(JSON.stringify({ error: 'Offline' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Stale-while-revalidate for static assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                });
                return networkResponse;
            });
            return cachedResponse || fetchPromise;
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
