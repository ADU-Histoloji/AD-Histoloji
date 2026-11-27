// data/events.json'daki programı veritabanıyla karşılaştırır; eksik dersleri ekler,
// "kaldir" listesindekileri siler, notları yeniler. Elle yapılmış düzeltmelere dokunmaz.
// Yönetim → Program → "Yeni dersleri ekle" düğmesinin sunucu tarafındaki karşılığıdır.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, appendFileSync } from 'node:fs';

const hesap = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!hesap.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlı değil.'); process.exit(1); }
initializeApp({ credential: cert(hesap) });
const db = getFirestore();
const sadeceRapor = process.env.SADECE_RAPOR === 'true';
const j = JSON.parse(readFileSync(new URL('../data/events.json', import.meta.url), 'utf8'));
const anahtar = e => ['date', 't', 's', 'k', 'topic', 'g'].map(k => e[k] ?? '').join('|');

const mevcut = (await db.collection('events').get()).docs.map(d => ({ ref: d.ref, d: d.data(), k: anahtar(d.data()) }));
const var_ = new Set(mevcut.map(x => x.k)), kaldir = new Set(j.kaldir || []);
const eksik = (j.events || []).filter(e => !var_.has(anahtar(e)));
const silinecek = mevcut.filter(x => kaldir.has(x.k));
const dosyada = new Set((j.events || []).map(anahtar));
const sadeceVeritabaninda = mevcut.filter(x => !dosyada.has(x.k) && !kaldir.has(x.k));

const tr = e => `${e.date.split('-').reverse().join('.')} ${e.t || ''} · ${e.s} · ${e.k} · ${e.topic}${e.g ? ' · ' + e.g : ''}`;
const rapor = [
  `Veritabanında ${mevcut.length} ders, dosyada ${(j.events || []).length} ders var.`,
  `**Eklenecek (${eksik.length}):**\n` + (eksik.map(e => '- ' + tr(e)).join('\n') || '- yok'),
  `**Silinecek (${silinecek.length}):**\n` + (silinecek.map(x => '- ' + tr(x.d)).join('\n') || '- yok'),
  `**Sadece veritabanında olanlar (elle eklenmiş/düzeltilmiş, dokunulmadı) (${sadeceVeritabaninda.length}):**\n` + (sadeceVeritabaninda.map(x => '- ' + tr(x.d)).join('\n') || '- yok'),
];
if (!sadeceRapor) {
  const ops = [];
  eksik.forEach(e => ops.push(b => b.set(db.collection('events').doc(), e)));
  silinecek.forEach(x => ops.push(b => b.delete(x.ref)));
  (await db.collection('notices').get()).forEach(d => ops.push(b => b.delete(d.ref)));
  (j.notices || []).forEach(n => ops.push(b => b.set(db.collection('notices').doc(), n)));
  for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); ops.slice(i, i + 400).forEach(f => f(b)); await b.commit(); }
  rapor.push(`✅ ${eksik.length} ders eklendi, ${silinecek.length} ders silindi, notlar yenilendi.`);
} else rapor.push('ℹ️ Sadece rapor: hiçbir şey değiştirilmedi.');
const metin = rapor.join('\n\n');
console.log(metin);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Programı yükle\n\n' + metin + '\n');
