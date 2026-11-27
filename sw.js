// Uygulamanın internet zayıfken de açılması için dosyaları önbellekte tutar.
// Her zaman önce ağdan güncel sürümü dener (tarayıcı önbelleğini atlayarak), olmazsa önbellektekini gösterir.
const CACHE = 'histoloji-v22';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'data/events.json',
  'js/app.js', 'js/config.js', 'js/fb.js', 'js/util.js', 'js/takvim.js', 'js/arsiv.js', 'js/hesap.js', 'js/yonetim.js', 'js/bildirim.js', 'js/uygulamalar.js', 'js/duyurular.js',
  'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});

// Bildirim geldiğinde gösterir (pazartesi programı, katılım sorusu vb.)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { data: { body: e.data && e.data.text() } }; }
  const p = d.data || d.notification || d;
  const title = p.title || 'Histoloji bölümü';
  const opts = {
    body: p.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    tag: p.tag || 'histoloji', renotify: true,
    data: { url: p.url || './#takvim', tip: p.tip || '', gun: p.gun || '' }
  };
  // Android'de bildirimin altında cevap düğmeleri (iPhone düğmeleri göstermez)
  if (p.tip === 'katilim' && p.gun) opts.actions = [{ action: 'evet', title: '✅ Katılıyorum' }, { action: 'hayir', title: '❌ Katılamıyorum' }];
  e.waitUntil(self.registration.showNotification(title, opts));
});

// Bildirime ya da düğmesine dokununca uygulamayı ilgili ekranda açar
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {};
  let yol = d.url || './';
  if ((e.action === 'evet' || e.action === 'hayir') && d.gun) yol = `./?katil=${e.action}&gun=${d.gun}#uygulama`;
  const url = new URL(yol, self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ('focus' in w) { w.navigate(url).catch(() => { }); return w.focus(); }
    return clients.openWindow(url);
  }));
});
