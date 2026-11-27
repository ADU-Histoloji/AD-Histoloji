// Her hafta içi sabah GitHub tarafından çalıştırılır: ertesi gün uygulama varsa
// herkese katılım sorusunu, anlatıcılara da hatırlatmayı gönderir.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { yarin, oturumlar, genelMesaj, anlaticiMesaj } from './gunluk-mesaj.mjs';

const hesap = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!hesap.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlı değil.'); process.exit(1); }
initializeApp({ credential: cert(hesap) });
const db = getFirestore(), fcm = getMessaging();
const test = process.env.SADECE_YONETICI === 'true';

const events = (await db.collection('events').where('k', '==', 'U').get()).docs.map(d => d.data());
let gun = (process.env.TARIH || '').trim() || yarin();
if (test && !process.env.TARIH) gun = events.map(e => e.date).filter(d => d >= yarin()).sort()[0] || gun;
const ots = oturumlar(gun, events);
if (!ots.length) { console.log(`${gun}: uygulama yok, bildirim gönderilmedi.`); process.exit(0); }

const users = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.onayli);
const izinli = new Set(users.filter(u => !test || u.rol === 'yonetici').map(u => u.id));
const tokens = (await db.collection('tokens').get()).docs.map(d => ({ id: d.id, uid: d.data().uid })).filter(t => izinli.has(t.uid));

// Anlatıcılar: adlar (gösterim için) ve uygulamaya kayıtlı olanların kimlikleri
const adlar = {}, anl = new Map();
for (const o of ots) {
  const a = await db.collection('anlaticilar').doc(o.id).get();
  if (!a.exists) continue;
  if (a.data().ad) adlar[o.id] = a.data().ad;
  const uid = a.data().uid; if (uid) { if (!anl.has(uid)) anl.set(uid, []); anl.get(uid).push(o); }
}

const genel = genelMesaj(gun, ots, adlar);
console.log(genel.title + '\n' + genel.body);
let basarili = 0, basarisiz = 0;
async function gonder(liste, m, tip) {
  if (!liste.length) return;
  const r = await fcm.sendEachForMulticast({
    tokens: liste.map(t => t.id),
    data: { title: (test ? '[Test] ' : '') + m.title, body: m.body, url: './#uygulama', tag: 'katilim-' + gun, tip, gun },
    webpush: { headers: { Urgency: 'high', TTL: '43200' } }
  });
  basarili += r.successCount; basarisiz += r.failureCount;
  await Promise.all(r.responses.map((x, j) => {
    const kod = x.error?.code || '';
    if (kod.includes('registration-token-not-registered') || kod.includes('invalid-registration-token') || kod.includes('invalid-argument'))
      return db.collection('tokens').doc(liste[j].id).delete();
  }));
}
// Herkese kendi masasıyla kişisel mesaj; anlatıcılara ayrıca anlatıcı mesajı
for (const u of users) {
  const tk = tokens.filter(t => t.uid === u.id);
  if (!tk.length) continue;
  if (anl.has(u.id)) await gonder(tk, anlaticiMesaj(gun, anl.get(u.id)), 'katilim');
  else await gonder(tk, genelMesaj(gun, ots, adlar, u), 'katilim');
}
if (!test) await db.collection('duyurular').add({ ...genel, url: './#uygulama', tur: 'katilim', t: FieldValue.serverTimestamp() });
console.log(`${gun} · gönderildi: ${basarili}, başarısız: ${basarisiz}${test ? ' (test, sadece yöneticiler)' : ''}`);
