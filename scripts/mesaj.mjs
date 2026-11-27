// Haftalık program bildiriminin metnini hazırlar. Türkiye saati sabit UTC+3'tür.
const GUN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TUR = { T: 'teorik', U: 'uygulama', S: 'sınav' };

export function haftaBasi(simdi = new Date()) {
  const tr = new Date(simdi.getTime() + 3 * 3600e3);
  const g = (tr.getUTCDay() + 6) % 7;                        // 0 = pazartesi
  const pzt = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() - g + (g >= 5 ? 7 : 0)));
  return pzt;
}
const iso = d => d.toISOString().slice(0, 10);
export const gunler = pzt => [0, 1, 2, 3, 4].map(i => iso(new Date(pzt.getTime() + i * 864e5)));

// events: {date, t, s, k, topic, g}[]  →  {title, body}
export function mesaj(pzt, events, notices = []) {
  const gs = gunler(pzt), cum = new Date(pzt.getTime() + 4 * 864e5);
  const aralik = pzt.getUTCMonth() === cum.getUTCMonth()
    ? `${pzt.getUTCDate()}–${cum.getUTCDate()} ${AY[cum.getUTCMonth()]}`
    : `${pzt.getUTCDate()} ${AY[pzt.getUTCMonth()]} – ${cum.getUTCDate()} ${AY[cum.getUTCMonth()]}`;
  const satirlar = [];
  gs.forEach((g, i) => {
    const ev = events.filter(e => e.date === g).sort((a, b) => (a.t || '').localeCompare(b.t || ''));
    if (!ev.length) return;
    // Aynı ders/tür/konudaki grupları birleştir: "13:30 Tıp D2 uygulama (A–D)"
    const parca = [];
    for (const e of ev) {
      const key = `${e.s}|${e.k}|${e.topic}`;
      const son = parca[parca.length - 1];
      if (son && son.key === key) { if (e.g) son.g.push(e.g); continue; }
      parca.push({ key, t: e.t, s: e.s, k: e.k, g: e.g ? [e.g] : [] });
    }
    const metin = parca.map(p => {
      const gr = p.g.length > 1 ? ` (${p.g.join(', ')})` : '';
      return `${p.t} ${p.s} ${TUR[p.k] || ''}${gr}`.trim();
    }).join(', ');
    satirlar.push(`${GUN[i]}: ${metin}`);
  });
  const notlar = notices.filter(n => n.week === iso(pzt));
  if (notlar.some(n => n.k === 'S')) satirlar.push('Bu hafta sınav notu var, takvime bak.');
  return {
    title: `Bu hafta · ${aralik}`,
    body: satirlar.length ? satirlar.join('\n') : 'Bu hafta histoloji dersi yok.'
  };
}
