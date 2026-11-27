// Veritabanının tamamını (bildirim cihaz adresleri hariç) şifreli bir dosyaya yedekler.
// GitHub her pazar gece çalıştırır; dosya 90 gün saklanır.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, appendFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { HARIC, topla } from './yedek-ortak.mjs';

const hesap = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!hesap.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlı değil.'); process.exit(1); }
initializeApp({ credential: cert(hesap) });
const db = getFirestore();

const belgeler = {};
for (const kol of await db.listCollections()) if (!HARIC.has(kol.id)) await topla(kol, belgeler);
const sayim = {};
Object.keys(belgeler).forEach(p => { const k = p.split('/').filter((_, i) => i % 2 === 0).join('/'); sayim[k] = (sayim[k] || 0) + 1; });
const json = JSON.stringify({ surum: 1, zaman: new Date().toISOString(), proje: hesap.project_id, belgeler });
writeFileSync('yedek.json.gz', gzipSync(json));
const satirlar = Object.entries(sayim).sort().map(([k, n]) => `| ${k} | ${n} |`).join('\n');
const ozet = `Toplam ${Object.keys(belgeler).length} belge · ${(json.length / 1048576).toFixed(1)} MB (sıkıştırmadan önce)\n\n| Koleksiyon | Belge |\n|---|---|\n${satirlar}\n`;
console.log(ozet);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Veritabanı yedeği\n\n' + ozet);
