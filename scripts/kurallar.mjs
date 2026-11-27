// firestore.rules dosyasını Firebase'e yayınlar. GitHub, dosya her değiştiğinde bunu kendisi çalıştırır;
// böylece kuralları Firebase konsoluna elle yapıştırmaya gerek kalmaz.
import { initializeApp, cert } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { readFileSync } from 'node:fs';

const hesap = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!hesap.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlı değil.'); process.exit(1); }
initializeApp({ credential: cert(hesap) });
const kaynak = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const r = await getSecurityRules().releaseFirestoreRulesetFromSource(kaynak);
console.log('Firestore kuralları yayınlandı:', r.name, r.createTime);
