// Hafta içi her sabah GitHub tarafından çalıştırılır. Kişisel hatırlatmalar:
//  - Seminer sunacak kişiye: 1 hafta önce ve 1 gün önce (konu boşsa yazmasını hatırlatır)
//  - Uygulama anlatıcısına: 1 hafta önce (1 gün önceki hatırlatmayı gunluk.mjs gönderir)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { gunSonra, seminerMesaj, anlaticiHaftaMesaj, gozetmenMesaj, oturumlar } from './hatirlatma-mesaj.mjs';

const hesap = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!hesap.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlı değil.'); process.exit(1); }
initializeApp({ credential: cert(hesap) });
const db = getFirestore(), fcm = getMessaging();
const test = process.env.SADECE_YONETICI === 'true';
const kuru = process.env.KURU === 'true'; // sadece ekrana yaz, gönderme
// Test için "bugün" başka bir tarih olarak verilebilir
const kayma = process.env.BUGUN ? Math.round((Date.parse(process.env.BUGUN + 'T12:00:00Z') - Date.parse(gunSonra(0) + 'T12:00:00Z')) / 864e5) : 0;
const yarin = gunSonra(1 + kayma), haftaya = gunSonra(7 + kayma);
// Cuma günü, Pazartesi'nin hatırlatması da gönderilir (hafta sonu görev çalışmaz)
const cuma = new Date(gunSonra(kayma) + 'T12:00:00Z').getUTCDay() === 5;
const yakin = cuma ? [gunSonra(1 + kayma), gunSonra(2 + kayma), gunSonra(3 + kayma)] : [yarin];
console.log(`Bugün: ${gunSonra(kayma)} · yarın: ${yarin} · 1 hafta sonra: ${haftaya}${test ? ' (test: mesajlar yöneticilere gider)' : ''}`);

const users = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.onayli);
const adi = uid => users.find(u => u.id === uid)?.ad || uid;
const yoneticiler = users.filter(u => u.rol === 'yonetici').map(u => u.id);
const tokens = (await db.collection('tokens').get()).docs.map(d => ({ id: d.id, uid: d.data().uid }));
const events = (await db.collection('events').where('date', 'in', [...yakin, haftaya]).get()).docs.map(d => ({ id: d.id, ...d.data() }));

let gonderilen = 0;
async function gonder(uid, m, tag) {
  const hedef = test ? yoneticiler : [uid];
  const tk = tokens.filter(t => hedef.includes(t.uid));
  console.log(`→ ${adi(uid)}: ${m.title}\n${m.body}\n  (${tk.length} cihaz)`);
  if (!tk.length || kuru) return;
  const r = await fcm.sendEachForMulticast({
    tokens: tk.map(t => t.id),
    data: { title: (test ? `[Test → ${adi(uid).split(' ')[0]}] ` : '') + m.title, body: m.body, url: m.url, tag },
    webpush: { headers: { Urgency: 'high', TTL: '43200' } }
  });
  gonderilen += r.successCount;
  await Promise.all(r.responses.map((x, j) => {
    const kod = x.error?.code || '';
    if (kod.includes('registration-token-not-registered') || kod.includes('invalid-registration-token')) return db.collection('tokens').doc(tk[j].id).delete();
  }));
}

// Seminerler
for (const e of events.filter(x => x.k === 'M' && x.uid)) {
  const kac = e.date === yarin ? 1 : 7;
  await gonder(e.uid, seminerMesaj(e, kac), `seminer-${e.date}-${kac}`);
}

// Uygulama sınavı gözetmenleri: 1 hafta önce ve bir önceki iş günü
const VARSAYILAN_HOCALAR = ['Alpaslan Gökçimen, Gökçen Gökçe Tepeli', 'Esra Gökmen Yılmaz', 'Kemal Ergin', 'Erkan Gümüş']; // js/gozetmen.js ile aynı
const gozetmenli = e => e.k === 'S' && /uygulama sınav/i.test(e.topic || '');
// Aynı gün aynı kurulun oturumları tek sınav sayılır; kayıtlar ilk oturumun kimliğiyle tutulur
const sinavGunleri = new Map();
for (const e of events.filter(x => gozetmenli(x) && (x.date === haftaya || yakin.includes(x.date))).sort((a, b) => (a.t || '').localeCompare(b.t || ''))) {
  const k = e.date + '|' + e.s + '|' + e.topic;
  if (!sinavGunleri.has(k)) sinavGunleri.set(k, []);
  sinavGunleri.get(k).push(e);
}
for (const ots of sinavGunleri.values()) {
  const e = { ...ots[0], t: ots.map(o => o.t).join(' ve '), g: '' }, kac = e.date === haftaya ? 7 : 1;
  const gruplar = (await db.collection('sinavGruplari').doc(ots[0].id).get()).data()?.gruplar || [];
  const gonderildi = new Set();
  for (const o of ots) for (const a of (await db.collection('gozetmenler').where('ev', '==', o.id).get()).docs.map(d => d.data())) {
    if (gonderildi.has(a.uid)) continue; gonderildi.add(a.uid);
    await gonder(a.uid, gozetmenMesaj(e, a.grup, gruplar[a.grup]?.hoca ?? VARSAYILAN_HOCALAR[a.grup] ?? '', kac, e.date === yarin), `gozetmen-${ots[0].id}-${kac}`);
  }
}

// Anlatıcılar: 1 hafta sonraki uygulamalar
const ots = oturumlar(haftaya, events);
const kisiye = new Map();
for (const o of ots) {
  const a = await db.collection('anlaticilar').doc(o.id).get();
  const uid = a.exists ? a.data().uid : null;
  if (!uid) continue;
  if (!kisiye.has(uid)) kisiye.set(uid, []);
  kisiye.get(uid).push(o);
}
for (const [uid, liste] of kisiye) await gonder(uid, anlaticiHaftaMesaj(haftaya, liste), `anlatici-hafta-${haftaya}`);

console.log(`Gönderilen bildirim: ${gonderilen}`);
