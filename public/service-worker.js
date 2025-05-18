// public/service-worker.js

// Nazwa cache'a dla App Shell - zmieniamy ją przy każdej aktualizacji zasobów
const CACHE_NAME = 'finassist-cache-v1'; // Zaktualizuj tę wersję przy zmianie zasobów

// Lista zasobów do precache'owania podczas instalacji Service Workera
const urlsToCache = [
  '/', // Strona główna
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/storage.js', // Potrzebne do działania offline
  '/js/manifest.json',
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-512x512.png',
  // TODO: Dodaj inne statyczne zasoby, np. fonty, inne obrazy, jeśli są używane
];

// Service Worker nasłuchuje na zdarzenie 'install'
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker...', event);
  // Precache'owanie zasobów statycznych (App Shell)
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching App Shell:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Natychmiastowa aktywacja nowego SW
      .catch(error => {
        console.error('[Service Worker] Cache addAll failed:', error);
      })
  );
});

// Service Worker nasłuchuje na zdarzenie 'activate'
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker...', event);
  // Usunięcie starych cache'ów
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        }).filter(Boolean) // Usuń undefined z listy
      );
    }).then(() => self.clients.claim()) // Przejmij kontrolę nad stronami
  );
});

// Service Worker nasłuchuje na zdarzenie 'fetch' - obsługa żądań sieciowych i cacheowania
self.addEventListener('fetch', (event) => {
  console.log('[Service Worker] Fetching:', event.request.url);

  // Strategia Cache-first z fallbackiem do sieci dla zasobów statycznych App Shell
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Zwróć zasób z cache'a, jeśli znaleziono
        if (response) {
          console.log('[Service Worker] Found in cache:', event.request.url);
          return response;
        }

        // Jeśli zasób nie znaleziono w cache'u, spróbuj pobrać z sieci
        console.log('[Service Worker] Not found in cache. Fetching:', event.request.url);
        return fetch(event.request)
          .then((networkResponse) => {
            // Opcjonalnie: Cache'uj nowe zasoby, które nie były precache'owane (np. dynamiczne)
            // Ale dla API nie cache'ujemy w SW, bo dane idą do IndexedDB
            const isApi = event.request.url.startsWith(self.location.origin + '/api/');
            const isChromeExtension = event.request.url.startsWith('chrome-extension:');
            const isNavigation = event.request.mode === 'navigate';

             if (!isApi && networkResponse.ok && networkResponse.type === 'basic' && !isChromeExtension) {
                console.log('[Service Worker] Caching new resource:', event.request.url);
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, responseToCache);
                    });
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback dla żądań nawigacji w trybie offline - można zwrócić stronę offline
            if (event.request.mode === 'navigate') {
                console.log('[Service Worker] Fetch failed, returning offline fallback.');
                // Można zwrócić precache'owany index.html jako fallback
                 return caches.match('/index.html');
            }
             // Dla innych typów żądań, które nie są w cache'u i fetch się nie udał - można zwrócić błąd lub pusty response
            console.log('[Service Worker] Fetch failed for non-navigation request.');
            // Zwróć błąd lub pusty response, w zależności od potrzeb
             return new Response(null, { status: 404, statusText: 'Not Found' });
          });
      })
  );
});

// Service Worker nasłuchuje na zdarzenie 'push' - KLUCZOWE dla powiadomień push
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Received a push event.'); // Log push event received
  // Sprawdź, czy dane powiadomienia istnieją
  if (!event.data) {
    console.log('[Service Worker] Push event had no data.');
    return;
  }

  // Parsuj dane powiadomienia jako JSON
  const pushData = event.data.json();
  console.log('[Service Worker] Push data parsed:', pushData); // Log parsed data

  const title = pushData.title || 'FinAssist Powiadomienie'; // Użyj tytułu z danych lub domyślnego
  const options = {
    body: pushData.body || 'Otrzymano nowe powiadomienie.', // Użyj treści z danych lub domyślnej
    icon: '/images/icons/icon-512x512.png', // Dodaj ikonę (założenie, że istnieje w public/images/icons)
    badge: '/images/icons/icon-192x192.png', // Dodaj badge (założenie, że istnieje)
    data: { // Przekaż dodatkowe dane, np. URL, które będą dostępne w notificationclick
      url: pushData.url || '/' // Użyj URL z danych lub strony głównej
    }
    // Można dodać więcej opcji, np. wibracje, tagi, akcje
  };

  // Wyświetl powiadomienie
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Service Worker nasłuchuje na zdarzenie 'notificationclick' - obsługa kliknięcia w powiadomienie
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.'); // Log notification click
  event.notification.close(); // Zamknij powiadomienie po kliknięciu

  // Otwórz okno przeglądarki na URL z danych powiadomienia
  const urlToOpen = event.notification.data ? event.notification.data.url : '/ ';

  event.waitUntil(
    clients.openWindow(urlToOpen)
  );
}); 