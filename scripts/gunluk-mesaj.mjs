// Ertesi günün uygulamaları için bildirim metinleri. Türkiye saati sabit UTC+3'tür.
const GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export const konuId = (s, topic) => (s + '-' + topic).toLocaleLowerCase('tr')
  .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);

export function yarin(simdi = new Date()) {
  const tr = new Date(simdi.getTime() + 3 * 3600e3);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() + 1)).toISOString().slice(0, 10);
}

// Günün uygulamalarını konu bazında toplar
export function oturumlar(gun, events) {
  const m = new Map();
  events.filter(e => e.date === gun && e.k === 'U').sort((a, b) => (a.t || '').localeCompare(b.t || '')).forEach(e => {
    const id = konuId(e.s, e.topic);
    if (!m.has(id)) m.set(id, { id, s: e.s, topic: e.topic, ilk: e.t, son: e.e || e.t, gruplar: [] });
    const o = m.get(id); o.son = e.e || e.t; if (e.g) o.gruplar.push(e.g);
  });
  return [...m.values()];
}

const gunAdi = gun => { const d = new Date(gun + 'T00:00:00Z'); return `${GUN[d.getUTCDay()]} ${d.getUTCDate()} ${AY[d.getUTCMonth()]}`; };
const satir = o => `${o.ilk} ${o.s} ${o.topic}${o.gruplar.length ? ` (${o.gruplar.join(', ')})` : ''}`;

export function genelMesaj(gun, ots) {
  return { title: `Yarın uygulama var · ${gunAdi(gun)}`, body: ots.map(satir).join('\n') + '\nKatılıyor musun? Dokun ve cevapla.' };
}
export function anlaticiMesaj(gun, ots) {
  return { title: `Yarın anlatıcısın · ${gunAdi(gun)}`, body: ots.map(o => `${o.topic} (${o.s}), ${o.ilk}–${o.son}`).join('\n') + '\nKatılımını uygulamadan onayla.' };
}
