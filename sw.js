// Uygulamanın internet zayıfken de açılması için dosyaları önbellekte tutar.
// Her zaman önce ağdan güncel sürümü dener (tarayıcı önbelleğini atlayarak), olmazsa önbellektekini gösterir.
const CACHE = 'histoloji-v4';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'data/events.json',
  'js/app.js', 'js/config.js', 'js/fb.js', 'js/util.js', 'js/takvim.js', 'js/arsiv.js', 'js/hesap.js', 'js/yonetim.js', 'js/bildirim.js',
  'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});

// Bildirim geldiğinde gösterir (pazartesi programı vb.)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { data: { body: e.data && e.data.text() } }; }
  const p = d.data || d.notification || d;
  const title = p.title || 'Histoloji bölümü';
  e.waitUntil(self.registration.showNotification(title, {
    body: p.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    tag: p.tag || 'histoloji', data: { url: p.url || './#takvim' }
  }));
});

// Bildirime dokununca uygulamayı ilgili ekranda açar
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ('focus' in w) { w.navigate(url).catch(() => { }); return w.focus(); }
    return clients.openWindow(url);
  }));
});
