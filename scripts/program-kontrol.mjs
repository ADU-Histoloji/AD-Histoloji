// Her hafta içi GitHub tarafından çalıştırılır: fakültenin ders programı sayfalarını kontrol eder,
// yeni ya da değişmiş PDF varsa yöneticilere bildirim gönderir ve Yönetim ekranına not düşer.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pdfLinkleri, histolojiSatirlari, kurulAdi, farklar } from './program-fark.mjs';
import { kurulKisa, satirSade } from './bicim.mjs';

const kok = new URL('../', import.meta.url);
const DURUM = new URL('data/program-durumu.json', kok);
const { sayfalar } = JSON.parse(readFileSync(new URL('data/program-sayfalari.json', kok)));
const deneme = process.env.DENEME === 'true';

const hesap = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!hesap.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlı değil.'); process.exit(1); }
initializeApp({ credential: cert(hesap) });
const db = getFirestore(), fcm = getMessaging();

const UA = { 'User-Agent': 'Mozilla/5.0 (histoloji-program-kontrol)' };
async function getir(url) {
  const r = await fetch(url, { headers: UA, redirect: 'follow' });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r;
}

const once = existsSync(DURUM) ? JSON.parse(readFileSync(DURUM)) : null;
const simdi = {}, hatalar = [];
for (const s of sayfalar) {
  try {
    const html = await (await getir(s.url)).text();
    const linkler = pdfLinkleri(html, s.url);
    if (!linkler.length) throw new Error(`${s.ad}: sayfada hiç PDF bulunamadı`);
    for (const l of linkler) {
      try {
        const buf = Buffer.from(await (await getir(l.url)).arrayBuffer());
        const hash = createHash('sha256').update(buf).digest('hex').slice(0, 20);
        // Dosya değişmediyse metni yeniden çıkarmaya gerek yok
        const eski = once?.dosyalar?.[l.url];
        let satirlar = eski?.satirlar || [], kurul = eski?.kurul || '';
        if (!eski || eski.hash !== hash) {
          const yol = join(tmpdir(), 'p.pdf'); writeFileSync(yol, buf);
          const metin = execFileSync('pdftotext', ['-layout', yol, '-'], { maxBuffer: 64 << 20 }).toString();
          satirlar = histolojiSatirlari(metin); kurul = kurulAdi(metin);
        }
        simdi[l.url] = { sayfa: s.ad, etiket: kurul || l.etiket, link: l.etiket, kurul, hash, satirlar };
      } catch (e) { console.warn('PDF okunamadı:', l.url, e.message); }
    }
  } catch (e) { hatalar.push(e.message); console.error(e.message); }
}

const yoneticiler = (await db.collection('users').where('rol', '==', 'yonetici').get()).docs.map(d => d.id);
const tokens = (await db.collection('tokens').get()).docs.map(d => ({ id: d.id, uid: d.data().uid })).filter(t => yoneticiler.includes(t.uid));
async function bildir(title, body) {
  if (!tokens.length) return console.log('Bildirim açmış yönetici yok.');
  const r = await fcm.sendEachForMulticast({ tokens: tokens.map(t => t.id), data: { title, body, url: './#yonetim', tag: 'program' }, webpush: { headers: { Urgency: 'high' } } });
  console.log(`Bildirim: ${r.successCount} başarılı, ${r.failureCount} başarısız`);
}

let degisen = [];
if (!once) console.log('İlk kontrol: mevcut programlar kaydedildi, karşılaştırma bir sonraki kontrolde başlayacak.');
else {
  // Bir sayfa okunamadıysa o sayfadaki dosyaları "kaldırıldı" sayma
  const okunamayan = new Set(sayfalar.filter(s => !Object.values(simdi).some(d => d.sayfa === s.ad)).map(s => s.ad));
  const onceFilt = Object.fromEntries(Object.entries(once.dosyalar || {}).filter(([, d]) => !okunamayan.has(d.sayfa)));
  // Histolojiyle ilgisi olmayan PDF'lerdeki (grup listesi, rehber vb.) değişiklikleri bildirme
  degisen = farklar(onceFilt, simdi).filter(f =>
    f.eklenen.length || f.cikan.length ||
    (f.tur !== 'kaldirildi' && (simdi[f.url]?.satirlar || []).length) ||
    (f.tur === 'kaldirildi' && (onceFilt[f.url]?.satirlar || []).length));
  for (const f of degisen) {
    await db.collection('degisiklikler').add({
      ...f, eklenen: f.eklenen.slice(0, 40), cikan: f.cikan.slice(0, 40), durum: 'yeni', t: FieldValue.serverTimestamp()
    });
  }
}
console.log(`${Object.keys(simdi).length} PDF kontrol edildi, ${degisen.length} değişiklik, ${hatalar.length} hata.`);

if (degisen.length) {
  const sinif = a => a.replace('Tıp Dönem II', 'Tıp D2').replace('Tıp Dönem I', 'Tıp D1');
  const bloklar = degisen.slice(0, 3).map(f => {
    const bas = `${sinif(f.sayfa)} · ${kurulKisa(f.etiket) || f.etiket}`;
    if (f.tur === 'kaldirildi') return `${bas}\n🗑️ Program sayfadan kaldırıldı`;
    const satir = [...f.cikan.slice(0, 2).map(x => '❌ ' + satirSade(x)), ...f.eklenen.slice(0, 2).map(x => '✅ ' + satirSade(x))];
    const fazla = f.cikan.length + f.eklenen.length - satir.length;
    if (!satir.length) satir.push(f.tur === 'yeni' ? '🆕 Yeni program yüklendi' : '🔄 Güncellenmiş program yüklendi');
    if (fazla > 0) satir.push(`… ve ${fazla} satır daha`);
    return bas + '\n' + satir.join('\n');
  });
  if (degisen.length > 3) bloklar.push(`+${degisen.length - 3} değişiklik daha`);
  const title = '🗓️ Ders programı güncellendi', body = bloklar.join('\n') + '\nTakvimde düzeltmek için dokun.';
  await bildir(title, body);
  await db.collection('yoneticiDuyurulari').add({ title, body, url: './#yonetim', tur: 'program', t: FieldValue.serverTimestamp() });
}
// Hata bildirimi sadece durum ilk bozulduğunda gider, her gün tekrarlanmaz
const hataMetni = hatalar.join(' | ');
if (hataMetni && hataMetni !== (once?.hata || '')) await bildir('⚠️ Program sayfası okunamadı', hataMetni.slice(0, 300) + '\nFakülte sitesi değişmiş olabilir; data/program-sayfalari.json adreslerini kontrol edin.');
if (deneme && !degisen.length) await bildir('[Test] ✅ Program kontrolü çalışıyor', `${Object.keys(simdi).length} PDF kontrol edildi, değişiklik yok.${hatalar.length ? '\nHata: ' + hataMetni.slice(0, 200) : ''}`);

// Okunamayan sayfaların eski kayıtlarını koru
const birlesik = { ...(once?.dosyalar || {}) };
for (const [u, d] of Object.entries(birlesik)) if (!Object.values(simdi).some(x => x.sayfa === d.sayfa)) continue; else delete birlesik[u];
Object.assign(birlesik, simdi);
writeFileSync(DURUM, JSON.stringify({ kontrol: new Date().toISOString(), hata: hataMetni, dosyalar: birlesik }, null, 1) + '\n');
