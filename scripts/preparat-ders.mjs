// data/preparat-ders.json'daki eşleştirmeye göre preparatları uygulama konularına bağlar.
// Sadece ekler (arrayUnion); uygulamada elle yapılan bağlantılara dokunmaz.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, appendFileSync } from 'node:fs';
import { konuId } from './gunluk-mesaj.mjs';

const hesap = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!hesap.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlı değil.'); process.exit(1); }
initializeApp({ credential: cert(hesap) });
const db = getFirestore();
const kuru = process.env.KURU === 'true';
const oneri = JSON.parse(readFileSync(new URL('../data/preparat-ders.json', import.meta.url), 'utf8'));
const preps = (await db.collection('preps').get()).docs.map(d => ({ ref: d.ref, ...d.data() }));
const ekle = new Map(), satir = [];
for (const o of oneri) {
  const k = konuId(o.s, o.topic);
  const sec = preps.filter(p => o.kodlar.includes(p.kutu) || (p.kutu === '?' && o.kodlar.includes(p.organ)));
  sec.forEach(p => { if (!ekle.has(p.ref.path)) ekle.set(p.ref.path, { ref: p.ref, k: [] }); ekle.get(p.ref.path).k.push(k); });
  satir.push(`- ${o.s} · ${o.topic}: ${sec.length} seri`);
}
if (!kuru) {
  const liste = [...ekle.values()];
  for (let i = 0; i < liste.length; i += 400) {
    const b = db.batch();
    liste.slice(i, i + 400).forEach(x => b.update(x.ref, { dersler: FieldValue.arrayUnion(...x.k) }));
    await b.commit();
  }
}
const rapor = `${ekle.size} preparat serisi ${oneri.length} uygulama konusuna ${kuru ? 'bağlanacak (kuru deneme)' : 'bağlandı'}\n\n${satir.join('\n')}`;
console.log(rapor);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Preparat–ders eşleştirmesi\n\n' + rapor + '\n');
