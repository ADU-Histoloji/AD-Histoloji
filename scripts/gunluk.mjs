// Her hafta içi sabah GitHub tarafından çalıştırılır: ertesi gün uygulama varsa
// herkese katılım sorusunu, anlatıcılara da hatırlatmayı gönderir.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

// Anlatıcısı uygulamaya kayıtlı olan konular
const anl = new Map();
for (const o of ots) {
  const a = await db.collection('anlaticilar').doc(o.id).get();
  if (a.exists && a.data().uid) { const uid = a.data().uid; if (!anl.has(uid)) anl.set(uid, []); anl.get(uid).push(o); }
}

const genel = genelMesaj(gun, ots);
console.log(genel.title + '\n' + genel.body);
let basarili = 0, basarisiz = 0;
async function gonder(liste, m) {
  if (!liste.length) return;
  const r = await fcm.sendEachForMulticast({
    tokens: liste.map(t => t.id),
    data: { title: (test ? '[Test] ' : '') + m.title, body: m.body, url: './#uygulama', tag: 'katilim-' + gun },
    webpush: { headers: { Urgency: 'high', TTL: '43200' } }
  });
  basarili += r.successCount; basarisiz += r.failureCount;
  await Promise.all(r.responses.map((x, j) => {
    const kod = x.error?.code || '';
    if (kod.includes('registration-token-not-registered') || kod.includes('invalid-registration-token') || kod.includes('invalid-argument'))
      return db.collection('tokens').doc(liste[j].id).delete();
  }));
}
await gonder(tokens.filter(t => !anl.has(t.uid)), genel);
for (const [uid, liste] of anl) await gonder(tokens.filter(t => t.uid === uid), anlaticiMesaj(gun, liste));
console.log(`${gun} · gönderildi: ${basarili}, başarısız: ${basarisiz}${test ? ' (test, sadece yöneticiler)' : ''}`);
