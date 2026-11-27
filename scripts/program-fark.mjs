// Fakülte sayfalarındaki ders programı PDF'lerinin değişip değişmediğini bulan yardımcılar.
// Ağ ve Firebase kullanmaz; böylece ayrı ayrı test edilebilir.

// HTML karakter kodlarını (&ouml; &#252; gibi) harfe çevirir
const VARLIK = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç', iacute: 'í', ndash: '–', mdash: '—' };
export const varlik = t => t
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (x, n) => VARLIK[n] ?? x);

// Sayfadaki bütün PDF linklerini {url, etiket} olarak çıkarır
export function pdfLinkleri(html, taban) {
  const sonuc = [], gorulen = new Set();
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+?\.pdf)(?:[?#][^"']*)?["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    let url;
    try { url = new URL(m[1].replace(/&amp;/g, '&'), taban).href; } catch { continue; }
    if (gorulen.has(url)) continue;
    gorulen.add(url);
    const etiket = varlik(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
      || decodeURIComponent(url.split('/').pop());
    sonuc.push({ url, etiket });
  }
  return sonuc;
}

// PDF metninden histoloji geçen satırları (boşlukları sadeleştirilmiş) çıkarır
export function histolojiSatirlari(metin) {
  return [...new Set(metin.split(/\r?\n/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => /histoloji|embriyoloji/i.test(s.toLocaleLowerCase('tr')) && s.length > 12))];
}

// Önceki ve şimdiki durumu karşılaştırır.
// once/simdi: { [url]: { etiket, sayfa, hash, satirlar } }
export function farklar(once, simdi) {
  const out = [];
  const eskiEtiket = {};
  for (const [url, d] of Object.entries(once)) eskiEtiket[d.sayfa + '|' + d.etiket] = url;
  for (const [url, d] of Object.entries(simdi)) {
    const eski = once[url];
    if (eski) {
      if (eski.hash && d.hash && eski.hash !== d.hash) out.push(fark('icerik', url, d, eski));
      continue;
    }
    // Aynı etiketle daha önce başka bir dosya varsa "güncellenmiş", yoksa "yeni"
    const oncekiUrl = eskiEtiket[d.sayfa + '|' + d.etiket];
    out.push(fark(oncekiUrl ? 'guncel' : 'yeni', url, d, oncekiUrl ? once[oncekiUrl] : null));
  }
  for (const [url, d] of Object.entries(once))
    if (!simdi[url] && !Object.values(simdi).some(x => x.sayfa === d.sayfa && x.etiket === d.etiket))
      out.push({ tur: 'kaldirildi', url, sayfa: d.sayfa, etiket: d.etiket, eklenen: [], cikan: [] });
  return out;
}

function fark(tur, url, d, eski) {
  const a = new Set(eski?.satirlar || []), b = new Set(d.satirlar || []);
  return {
    tur, url, sayfa: d.sayfa, etiket: d.etiket,
    eklenen: eski ? [...b].filter(x => !a.has(x)) : [],
    cikan: eski ? [...a].filter(x => !b.has(x)) : []
  };
}

export const TUR = { yeni: 'yeni program eklendi', guncel: 'güncellenmiş program yüklendi', icerik: 'dosyanın içeriği değişti', kaldirildi: 'program sayfadan kaldırıldı' };

// PDF metninden ders kurulunun adını bulmaya çalışır ("Dolaşım ve Solunum Sistemleri Ders Kurulu" gibi)
export function kurulAdi(metin) {
  const satirlar = metin.split(/\r?\n/).slice(0, 60).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const s = satirlar.find(x => /kurul/i.test(x.toLocaleLowerCase('tr')) && x.length < 120);
  return s ? s.replace(/^\d+\.\s*/, '') : '';
}
