// Ertesi günün uygulamaları için bildirim metinleri. Türkiye saati sabit UTC+3'tür.
import { isaret, kisalt, gunKisa } from './bicim.mjs';

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
    if (!m.has(id)) m.set(id, { id, s: e.s, c: e.c, k: e.k, topic: e.topic, who: e.who || '', ilk: e.t, son: e.e || e.t, gruplar: [] });
    const o = m.get(id); o.son = e.e || e.t; if (e.g) o.gruplar.push(e.g);
  });
  return [...m.values()];
}

const grup = o => o.gruplar.length ? ` (${o.gruplar.length === 4 && o.gruplar.join('') === 'ABCD' ? 'A–D' : o.gruplar.join(', ')})` : '';
const satir = o => `${o.ilk} ${isaret(o)} ${o.s} · ${kisalt(o.topic, 32)}${grup(o)}`;
// Anlatıcılar asistanlardan seçilir; seçilmemişse programdaki öğretim üyesi anlatıcı sayılmaz
const anlaticiSatiri = (ots, adlar) => {
  const a = [...new Set(ots.map(o => adlar[o.id]).filter(Boolean))];
  return a.length ? `Anlatıcı${a.length > 1 ? 'lar' : ''}: ${a.join(', ')}` : '';
};

// kisi: { masa } ya da null (genel duyuru için)
export function genelMesaj(gun, ots, adlar = {}, kisi = null) {
  const masa = kisi ? (kisi.masa != null && kisi.masa !== '' ? `Masan: ${kisi.masa}` : 'Sabit masan yok, uygulamadan boş bir masa seç') : '';
  return {
    title: `🔬 Yarın uygulama · ${gunKisa(gun)}`,
    body: [...ots.map(satir), anlaticiSatiri(ots, adlar), masa, 'Katılıyor musun?'].filter(Boolean).join('\n')
  };
}
export function anlaticiMesaj(gun, ots) {
  return {
    title: `🎤 Yarın anlatıcısın · ${gunKisa(gun)}`,
    body: [...ots.map(o => `${o.ilk}–${o.son} ${isaret(o)} ${o.s} · ${kisalt(o.topic, 32)}${grup(o)}`), 'Katılımını onaylamayı unutma.'].join('\n')
  };
}
