// Her pazartesi sabah GitHub tarafından çalıştırılır: haftanın programını bildirim olarak gönderir.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { writeFileSync } from 'node:fs';
import { haftaBasi, gunler, mesaj } from './mesaj.mjs';

const hesap = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!hesap.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlı değil.'); process.exit(1); }
initializeApp({ credential: cert(hesap) });
const db = getFirestore(), fcm = getMessaging();
const sadeceYonetici = process.env.SADECE_YONETICI === 'true';

const pzt = haftaBasi();
const gs = gunler(pzt);
const evSnap = await db.collection('events').where('date', '>=', gs[0]).where('date', '<=', gs[4]).get();
const noSnap = await db.collection('notices').where('week', '==', gs[0]).get();
const { title, body } = mesaj(pzt, evSnap.docs.map(d => d.data()), noSnap.docs.map(d => d.data()));
console.log(title + '\n' + body);

let tokens = (await db.collection('tokens').get()).docs.map(d => ({ id: d.id, uid: d.data().uid }));
if (sadeceYonetici) {
  const yon = new Set((await db.collection('users').where('rol', '==', 'yonetici').get()).docs.map(d => d.id));
  tokens = tokens.filter(t => yon.has(t.uid));
  console.log('Test modu: sadece yöneticilere gönderiliyor.');
}
let basarili = 0, basarisiz = 0;
for (let i = 0; i < tokens.length; i += 500) {
  const parca = tokens.slice(i, i + 500);
  const r = await fcm.sendEachForMulticast({
    tokens: parca.map(t => t.id),
    data: { title: sadeceYonetici ? '[Test] ' + title : title, body, url: './#takvim', tag: 'haftalik' },
    webpush: { headers: { Urgency: 'high', TTL: '43200' } }
  });
  basarili += r.successCount; basarisiz += r.failureCount;
  // Artık geçersiz olan cihaz adreslerini temizle
  await Promise.all(r.responses.map((x, j) => {
    const kod = x.error?.code || '';
    if (kod.includes('registration-token-not-registered') || kod.includes('invalid-registration-token') || kod.includes('invalid-argument'))
      return db.collection('tokens').doc(parca[j].id).delete();
  }));
}
// Seminer ve anlatıcı kişisel hatırlatmaları hatirlatma.mjs'te
if (!sadeceYonetici) await db.collection('duyurular').add({ title, body, url: './#takvim', tur: 'haftalik', t: FieldValue.serverTimestamp() });
console.log(`Gönderildi: ${basarili}, başarısız: ${basarisiz}, cihaz sayısı: ${tokens.length}`);
writeFileSync(new URL('../data/son-bildirim.json', import.meta.url),
  JSON.stringify({ zaman: new Date().toISOString(), hafta: gs[0], test: sadeceYonetici, basarili, basarisiz }, null, 2) + '\n');
