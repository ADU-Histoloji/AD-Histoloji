// Haftalık program bildiriminin metnini hazırlar. Türkiye saati sabit UTC+3'tür.
import { AY, isaret, kisalt, sadeceGun } from './bicim.mjs';

export function haftaBasi(simdi = new Date()) {
  const tr = new Date(simdi.getTime() + 3 * 3600e3);
  const g = (tr.getUTCDay() + 6) % 7;                        // 0 = pazartesi
  const pzt = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() - g + (g >= 5 ? 7 : 0)));
  return pzt;
}
const iso = d => d.toISOString().slice(0, 10);
export const gunler = pzt => [0, 1, 2, 3, 4].map(i => iso(new Date(pzt.getTime() + i * 864e5)));

// events: {date, t, s, c, k, topic, g}[]  →  {title, body}
export function mesaj(pzt, events, notices = []) {
  const gs = gunler(pzt), cum = new Date(pzt.getTime() + 4 * 864e5);
  const aralik = pzt.getUTCMonth() === cum.getUTCMonth()
    ? `${pzt.getUTCDate()}–${cum.getUTCDate()} ${AY[cum.getUTCMonth()]}`
    : `${pzt.getUTCDate()} ${AY[pzt.getUTCMonth()]} – ${cum.getUTCDate()} ${AY[cum.getUTCMonth()]}`;
  const satirlar = [];
  let ders = 0, uyg = 0, sinav = 0;
  gs.forEach(g => {
    const ev = events.filter(e => e.date === g).sort((a, b) => (a.t || '').localeCompare(b.t || ''));
    // Aynı ders/tür/konudaki grupları birleştir: "Per 08:30 🔴 Tıp D1 · Hücre … (A–D)"
    const parca = [];
    for (const e of ev) {
      const key = `${e.s}|${e.k}|${e.topic}`;
      const son = parca[parca.length - 1];
      if (son && son.key === key) { if (e.g) son.g.push(e.g); continue; }
      parca.push({ key, e, g: e.g ? [e.g] : [] });
    }
    for (const p of parca) {
      ders++; if (p.e.k === 'U') uyg++; if (p.e.k === 'S') sinav++;
      const gr = p.g.length > 1 ? ` (${p.g.length === 4 && p.g.join('') === 'ABCD' ? 'A–D' : p.g.join(', ')})` : '';
      const konu = kisalt(p.e.topic, 28) + (p.e.k === 'U' && !/uygulama/i.test(p.e.topic) ? ' uyg.' : '');
      satirlar.push(`${sadeceGun(g)} ${p.e.t} ${isaret(p.e)} ${p.e.s} · ${konu}${gr}`);
    }
  });
  const notlar = notices.filter(n => n.week === iso(pzt));
  for (const n of notlar) {
    if (n.k === 'S') { sinav++; satirlar.push(`📝 ${n.s}: histoloji uygulama sınavı bu hafta`); }
    else if (n.k === 'U') { uyg++; satirlar.push(`🔴 ${n.s}: uygulama bu hafta (gün teyit edilecek)`); }
  }
  const ozet = [ders ? `${ders} ders` : '', uyg ? `${uyg} uygulama` : '', sinav ? `${sinav} sınav` : ''].filter(Boolean).join(' · ');
  return {
    title: `📅 Bu hafta · ${aralik}`,
    body: satirlar.length ? [ozet, ...satirlar].join('\n') : 'Bu hafta histoloji dersi yok. İyi haftalar!'
  };
}
