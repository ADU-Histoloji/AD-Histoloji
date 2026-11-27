// data/preparatlar.json'daki preparat listesini arşive yükler. Her satırın sabit bir kimliği var (liste-001…);
// arşivde zaten olanlar atlanır, böylece uygulamada yapılan düzeltmelerin üzerine yazılmaz.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, appendFileSync } from 'node:fs';

const hesap = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!hesap.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlı değil.'); process.exit(1); }
initializeApp({ credential: cert(hesap) });
const db = getFirestore();
const kuru = process.env.KURU === 'true';
const { kaynak, preparatlar } = JSON.parse(readFileSync(new URL('../data/preparatlar.json', import.meta.url), 'utf8'));
const mevcut = new Set((await db.collection('preps').listDocuments()).map(d => d.id));
const yeni = preparatlar.filter(p => !mevcut.has(p.id));
// İstenirse belirli satırlar dosyadaki haliyle güncellenir (fotoğraf, ders bağlantısı ve yapılar korunur)
const guncelle = (process.env.GUNCELLE || '').split(',').map(s => s.trim()).filter(Boolean);
for (const id of guncelle) {
  const p = preparatlar.find(x => x.id === id); if (!p || !mevcut.has(id)) { console.log(`${id}: bulunamadı`); continue; }
  const { id: _, ...alan } = p;
  if (!kuru) await db.collection('preps').doc(id).update(alan);
  console.log(`${id}: ${kuru ? 'güncellenecek' : 'güncellendi'} → ${p.kutu}-${p.sira} ${p.organ}`);
}
if (!kuru) for (let i = 0; i < yeni.length; i += 400) {
  const b = db.batch();
  yeni.slice(i, i + 400).forEach(({ id, ...p }) => b.set(db.collection('preps').doc(id), { ...p, yapilar: '', dersler: [], kapak: '', zaman: FieldValue.serverTimestamp() }));
  await b.commit();
}
const rapor = `${kaynak}: ${preparatlar.length} satır · arşivde zaten olan ${preparatlar.length - yeni.length} · ${kuru ? 'eklenecek' : 'eklenen'} ${yeni.length}${kuru ? ' (kuru deneme, hiçbir şey yazılmadı)' : ''}`;
console.log(rapor);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Preparat listesi\n\n' + rapor + '\n');
