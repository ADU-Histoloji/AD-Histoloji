// Şifresi çözülmüş yedek dosyasını (yedek.json.gz) veritabanına geri yazar.
// Yedekteki belgeler yedekteki haliyle yazılır; yedekte olmayan belgelere dokunulmaz.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, appendFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { coz } from './yedek-ortak.mjs';

const hesap = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!hesap.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlı değil.'); process.exit(1); }
initializeApp({ credential: cert(hesap) });
const db = getFirestore();
const kuru = process.env.KURU !== 'false';
const sadece = (process.env.KOLEKSIYON || '').split(',').map(s => s.trim()).filter(Boolean);

const y = JSON.parse(gunzipSync(readFileSync('yedek.json.gz')).toString('utf8'));
const yollar = Object.keys(y.belgeler).filter(p => !sadece.length || sadece.includes(p.split('/')[0]));
const rapor = [`Yedek zamanı: ${y.zaman}`, `${sadece.length ? 'Seçilen koleksiyonlar: ' + sadece.join(', ') : 'Tüm koleksiyonlar'} · ${yollar.length} belge`];
if (kuru) rapor.push('ℹ️ Kuru deneme: hiçbir şey yazılmadı. Gerçekten geri yüklemek için "kuru" işaretini kaldırıp tekrar çalıştırın.');
else {
  for (let i = 0; i < yollar.length; i += 400) {
    const b = db.batch();
    yollar.slice(i, i + 400).forEach(p => b.set(db.doc(p), coz(y.belgeler[p], db)));
    await b.commit();
  }
  rapor.push(`✅ ${yollar.length} belge geri yüklendi.`);
}
console.log(rapor.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Yedekten geri yükleme\n\n' + rapor.join('\n\n') + '\n');
