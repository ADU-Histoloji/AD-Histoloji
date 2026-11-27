// Elle çalıştırılır (GitHub → Actions → Test bildirimi): adı verilen kişinin
// kayıtlı cihazlarına kısa bir deneme bildirimi gönderir ve sonucu raporlar.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { appendFileSync } from 'node:fs';

const hesap = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!hesap.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlı değil.'); process.exit(1); }
initializeApp({ credential: cert(hesap) });
const db = getFirestore(), fcm = getMessaging();

const satirlar = [];
const yaz = s => { console.log(s); satirlar.push(s); };
const bitir = kod => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Test bildirimi\n\n' + satirlar.join('\n\n') + '\n'); process.exit(kod); };
const sade = s => String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();

const aranan = sade(process.env.KISI);
const users = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const bulunan = aranan ? users.filter(u => sade(u.ad).includes(aranan)) : users.filter(u => u.onayli);
if (!bulunan.length) { yaz(`❌ "${process.env.KISI}" adında kayıtlı kişi bulunamadı. Kayıtlı kişiler: ${users.map(u => u.ad).join(', ')}`); bitir(1); }

const tokens = (await db.collection('tokens').get()).docs.map(d => ({ id: d.id, ...d.data() }));
let hata = false;
for (const u of bulunan) {
  const tk = tokens.filter(t => t.uid === u.id);
  if (!u.onayli) yaz(`⚠️ **${u.ad}**: kaydı henüz onaylanmamış. Onaylanmadan pazartesi ve uygulama bildirimleri gitmez.`);
  if (!tk.length) { yaz(`❌ **${u.ad}**: kayıtlı cihaz yok. Kişi telefonunda uygulamayı açıp Profil → **Bildirimleri aç** demeli (iPhone'da önce Safari'de "Ana Ekrana Ekle" yapıp uygulamayı oradan açmalı).`); hata = true; continue; }
  const r = await fcm.sendEachForMulticast({
    tokens: tk.map(t => t.id),
    data: { title: '🔔 Test bildirimi', body: `Merhaba ${u.ad.split(' ')[0]}, bildirimler çalışıyor. Bu bir denemedir.`, url: './#profil', tag: 'test' },
    webpush: { headers: { Urgency: 'high', TTL: '3600' } }
  });
  const silinen = [];
  await Promise.all(r.responses.map((x, j) => {
    const kod = x.error?.code || '';
    if (kod.includes('registration-token-not-registered') || kod.includes('invalid-registration-token')) { silinen.push(j); return db.collection('tokens').doc(tk[j].id).delete(); }
  }));
  const cihazlar = tk.map(t => t.cihaz || 'cihaz').join(', ');
  if (r.successCount) yaz(`✅ **${u.ad}**: ${tk.length} cihazdan ${r.successCount} tanesine gönderildi (${cihazlar}).`);
  else { yaz(`❌ **${u.ad}**: ${tk.length} cihaza gönderilemedi (${cihazlar}).`); hata = true; }
  if (silinen.length) yaz(`ℹ️ ${silinen.length} cihaz kaydı artık geçersizdi ve silindi; kişi Profil → Bildirimleri aç ile yeniden açmalı.`);
}
bitir(hata ? 1 : 0);
