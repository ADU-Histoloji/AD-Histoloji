// Kişisel görev hatırlatmalarının metinleri (seminer sunacak kişi ve uygulama anlatıcısı)
import { isaret, kisalt, gunKisa, gunUzun } from './bicim.mjs';
import { oturumlar } from './gunluk-mesaj.mjs';

export const bosKonu = t => !t || /henüz belirlenmedi/i.test(t);
// Türkiye tarihine göre bugün + n gün (YYYY-AA-GG)
export function gunSonra(n, simdi = new Date()) {
  const tr = new Date(simdi.getTime() + 3 * 3600e3);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() + n)).toISOString().slice(0, 10);
}
const grup = o => o.gruplar.length ? ` (${o.gruplar.length === 4 && o.gruplar.join('') === 'ABCD' ? 'A–D' : o.gruplar.join(', ')})` : '';

// kac: 1 = yarın, 7 = gelecek hafta
export function seminerMesaj(e, kac) {
  const danisman = String(e.note || '').replace(/^Danışman:\s*/i, '');
  const bos = bosKonu(e.topic);
  return {
    title: kac === 1 ? `🎤 Yarın seminerin var · ${e.t}` : `🎤 Gelecek hafta seminerin var · ${gunKisa(e.date)}`,
    body: [
      `${gunUzun(e.date)} ${e.t}`,
      bos ? 'Konunu henüz yazmadın. Seminer ekranından ya da Profil\'den yazabilirsin.' : kisalt(e.topic, 80),
      danisman ? `Danışman: ${danisman}` : '',
      kac === 1 && !bos ? 'Başarılar!' : ''
    ].filter(Boolean).join('\n'),
    url: kac === 1 || !bos ? './#seminer' : './#profil'
  };
}

export function anlaticiHaftaMesaj(gun, ots) {
  return {
    title: `🔬 Gelecek hafta anlatıcısın · ${gunKisa(gun)}`,
    body: [...ots.map(o => `${o.ilk}–${o.son} ${isaret(o)} ${o.s} · ${kisalt(o.topic, 32)}${grup(o)}`), 'Hazırlık için bir hafta var. Bir gün önce yeniden hatırlatılacak.'].join('\n'),
    url: './#uygulama'
  };
}
export { oturumlar };

// Uygulama sınavı gözetmenliği. kac: 1 = bir sonraki iş günü, 7 = gelecek hafta
export function gozetmenMesaj(e, grup, hoca, kac, yarinMi) {
  const ne = kac === 1 ? (yarinMi ? 'Yarın' : gunUzun(e.date).split(' ')[0]) : 'Gelecek hafta';
  return {
    title: `📝 ${ne} sınav gözetmenliğin var · ${kac === 1 ? e.t : gunKisa(e.date)}`,
    body: [`${gunUzun(e.date)} ${e.t}`, `${e.s} · ${kisalt(e.topic, 60)}${e.g ? ' (' + e.g + ')' : ''}`, hoca ? `${hoca} grubu` : `${grup + 1}. grup`].join('\n'),
    url: './#takvim'
  };
}
