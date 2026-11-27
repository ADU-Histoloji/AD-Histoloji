// Uygulamanın internet zayıfken de açılması için dosyaları önbellekte tutar.
// Her zaman önce ağdan güncel sürümü dener, olmazsa önbellektekini gösterir.
const CACHE = 'histoloji-v1';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'data/events.json',
  'js/app.js', 'js/config.js', 'js/fb.js', 'js/util.js', 'js/takvim.js', 'js/arsiv.js', 'js/hesap.js', 'js/yonetim.js',
  'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
