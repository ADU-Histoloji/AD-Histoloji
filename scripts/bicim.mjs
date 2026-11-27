// Bildirim metinleri için ortak biçimlendirme yardımcıları
export const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const GUN_UZUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// Uygulamadaki renklerle aynı: teorik mor, uygulama pembe/kırmızı, Diş teorik yeşil, Diş uygulama turuncu, sınav
export const isaret = e => e.k === 'S' ? '📝' : e.c === 'dis' ? (e.k === 'U' ? '🟠' : '🟢') : (e.k === 'U' ? '🔴' : '🟣');

export const kisalt = (s, n = 30) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

const tarih = iso => new Date(iso + 'T00:00:00Z');
export const gunKisa = iso => { const d = tarih(iso); return `${GUN_KISA[d.getUTCDay()]} ${d.getUTCDate()} ${AY[d.getUTCMonth()]}`; };
export const gunUzun = iso => { const d = tarih(iso); return `${GUN_UZUN[d.getUTCDay()]} ${d.getUTCDate()} ${AY[d.getUTCMonth()]}`; };
export const sadeceGun = iso => GUN_KISA[tarih(iso).getUTCDay()];

// "DOLAŞIM VE SOLUNUM SİSTEMLERİ DERS KURULU" → "Dolaşım ve Solunum Sistemleri"
export function kurulKisa(ad) {
  const kucuk = new Set(['ve', 'ile', 'veya']);
  return String(ad || '').replace(/\s*ders kurulu\s*/i, '').toLocaleLowerCase('tr').split(/\s+/).filter(Boolean)
    .map((w, i) => i && kucuk.has(w) ? w : w.charAt(0).toLocaleUpperCase('tr') + w.slice(1)).join(' ');
}

// PDF'ten gelen ham satırı okunur hale getirir:
// "24.12.2026 08:30–09:15 T Histoloji ve Embriyoloji Karaciğer, Safra ... Esra GÖKMEN YILMAZ" → "24 Ara 08:30 Karaciğer, Safra …"
export function satirSade(ham, n = 42) {
  let s = String(ham).replace(/\s+/g, ' ');
  const dm = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  s = s.replace(/\d{1,2}[./]\d{1,2}[./]\d{4}/g, '');
  const tm = s.match(/\b(\d{1,2}[:.]\d{2})\b/);
  s = s
    .replace(/\d{1,2}[:.]\d{2}(\s*[-–]\s*\d{1,2}[:.]\d{2})?/g, '')
    .replace(/histoloji\s+ve\s+embriyoloji/gi, '')
    .replace(/\b(pazartesi|salı|çarşamba|perşembe|cuma)\b/gi, '')
    .replace(/(\s+[A-ZÇĞİÖŞÜ]{2,})+\s*$/u, '')                 // sondaki BÜYÜK HARFLİ soyadları
    .replace(/^\s*[TU]\s+|\s+[TU]\s+/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const bas = [dm ? `${+dm[1]} ${AY[+dm[2] - 1]}` : '', tm ? tm[1].replace('.', ':') : ''].filter(Boolean).join(' ');
  return kisalt([bas, s].filter(Boolean).join(' '), n) || kisalt(ham, n);
}
