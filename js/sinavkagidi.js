// Uygulama sınavı kâğıdı: her oturum (ör. 09.30 ve 13.30) için sorular, puanlar, cevaplar ve mikroskoba konacak preparat.
// Bir soru tek parça olabilir ya da alt sorulara ayrılabilir:
//   - harfli alt sorular: "1. A) ORGANIN ADINI YAZINIZ ... B) OK İLE İŞARETLİ YAPININ ..."
//   - numaralı bölgeler: öncül cümlesinin altında "1 --- …MİNE…  (2 PUAN)"
// Takvimdeki uygulama sınavlarının yanında takvimde olmayan sınavlar (ör. Diş bütünleme) için de kâğıt açılabilir.
import { $, esc, state, onState, toast } from './util.js';
import { ready, db, F } from './fb.js';
import { gozetmenliSinav, kanonik, oturumlar } from './gozetmen.js';
import { preparatlar } from './arsiv.js';
import { docx, indir } from './docx.js';

const KURUM = { tip: 'AYDIN ADNAN MENDERES ÜNİVERSİTESİ TIP FAKÜLTESİ HİSTOLOJİ VE EMBRİYOLOJİ ANABİLİM DALI', dis: 'AYDIN ADNAN MENDERES ÜNİVERSİTESİ DİŞ HEKİMLİĞİ FAKÜLTESİ HİSTOLOJİ VE EMBRİYOLOJİ ANABİLİM DALI' };
const NOTLAR = {
  tip: ['NOT 1: CEVAPLARDA KISALTMA KULLANMAYINIZ. KULLANILMASI DURUMUNDA PUAN __ALINAMAYACAKTIR.__', 'NOT 2: CEVAPLARDA EKSİK YA DA YANLIŞ YAZIMLAR KABUL EDİLMEYECEKTİR, PUAN __ALINAMAYACAKTIR.__', 'NOT 3: MİKROSKOPLARDA MİKROVİDA HARİÇ HERHANGİ BİR AYARLAMA __YAPILMAYACAKTIR.__', 'NOT 4: SORULARIN PUANLAMASI SORU SONUNDA YAZMAKTADIR.'],
  dis: ['NOT 1: CEVAPLARDA KISALTMA KULLANMAYINIZ. AYRICA CEVAPLARDA EKSİK YA DA YANLIŞ YAZIMLAR KABUL EDİLMEYECEKTİR, PUAN ALINAMAYACAKTIR.', 'NOT 2: MİKROSKOPLARDA MİKROVİDA HARİÇ HERHANGİ BİR AYARLAMA YAPILMAYACAKTIR.']
};
const KALIPLAR = [
  'MİKROSKOPTA GÖRDÜĞÜNÜZ DOKUNUN ADINI YAZINIZ',
  'MİKROSKOPTA GÖRDÜĞÜNÜZ PREPARATIN ADINI YAZINIZ',
  'MİKROSKOPTA GÖRDÜĞÜNÜZ DOKUNUN ADINI VE ÇEŞİDİNİ YAZINIZ.',
  'MİKROSKOPTA GÖRDÜĞÜNÜZ PREPARATIN EPİTELİNİN __TAM ADINI__ YAZINIZ',
  'MİKROSKOPTA GÖRDÜĞÜNÜZ DOKUNUN HANGİ BAĞ DOKUSU ÖZELLİĞİ GÖSTERDİĞİNİ YAZINIZ',
  'MİKROSKOPTA GÖRDÜĞÜNÜZ PREPARATTAKİ BAĞ DOKUSU ÇEŞİDİNİN ÖZEL ADINI YAZINIZ.',
  'MİKROSKOPTA GÖRDÜĞÜNÜZ DOKUNUN YOĞUNLUKLU OLARAK İÇERDİĞİ LİF ÖZELLİĞİNİ YAZINIZ',
  'MİKROSKOPTA GÖRDÜĞÜNÜZ ALANDAKİ EN BÜYÜK HÜCRENİN ADINI YAZINIZ',
  'MİKROSKOPTA OK İLE GÖSTERİLEN HÜCRENİN ADINI YAZINIZ',
  'MİKROSKOPTA OK İLE GÖSTERİLEN YAPININ ADINI YAZINIZ',
  'ORGANIN ADINI YAZINIZ.',
  'MİKROSKOPTA OK İLE İŞARETLİ YAPININ __TAM ADINI__ YAZINIZ.',
  'MİKROSKOPTA GÖRÜLEN ORGANA AİT EPİTELİN TAM ADINI YAZINIZ.',
  'OK İLE İŞARETLİ TABAKANIN ADINI YAZINIZ.',
  'OK İLE İŞARETLİ HÜCRELERİN ADINI YAZINIZ.',
  'PREPARAT ÜZERİNDE İŞARETLENİP NUMARALANDIRILAN BÖLGELERİN TAM ADLARINI YAZINIZ.'
];
const KURUL_NO = { 'Tıp D1': { 'hücre': 2, 'doku': 3, 'sistemlere giriş': 4 }, 'Tıp D2': { 'kan ve kas': 1, 'dolaşım ve solunum': 2, 'sindirim, endokrin ve metabolizma': 3, 'sinir ve duyu': 4, 'boşaltım ve üreme': 5 } };
const DONEM = { 'Tıp D1': 'DÖNEM 1', 'Tıp D2': 'DÖNEM 2', 'Tıp D3': 'DÖNEM 3', 'Diş D1': 'DÖNEM 1', 'Diş D2': 'DÖNEM 2', 'Diş D3': 'DÖNEM 3' };
const HARF = 'ABCDEFGHIJ';
const buyuk = s => String(s || '').toLocaleUpperCase('tr');
const sayi = p => Number(String(p ?? '').replace(',', '.')) || 0;
const puanYazi = p => String(p ?? '').replace('.', ',');
const egitimYili = iso => { const [y, m] = iso.split('-').map(Number); return m >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`; };

let olaylar = [], kayitlar = {}, secili = null, taslak = null, degisti = false, unsub = null;

function varsayilan(evId) {
  const ots = oturumlar(evId), e = ots[0];
  const kurul = (e.topic.match(/^(.*?)\s+kurulu/i)?.[1] || '').trim();
  const no = KURUL_NO[e.s]?.[kurul.toLocaleLowerCase('tr')], fak = e.c === 'dis' ? 'dis' : 'tip';
  return {
    ust: KURUM[fak],
    ust2: `${DONEM[e.s] || buyuk(e.s)}  ${egitimYili(e.date)} ${no ? no + '. ' : ''}KURUL${kurul ? ` (${buyuk(kurul)} KURULU)` : ''}`,
    ust3: 'UYGULAMA SINAVI',
    notlar: NOTLAR[fak].join('\n'),
    oturumlar: ots.map(o => ({ saat: (o.t || '').replace(':', '.'), sorular: [] }))
  };
}

const kaliplar = () => [...new Set([...KALIPLAR, ...Object.values(kayitlar).flatMap(k => (k.oturumlar || []).flatMap(o => o.sorular.flatMap(s => [s.metin, ...(s.altlar || []).map(a => a.metin)])))].filter(x => x && !x.includes('\n')))];
const yeniSoru = () => ({ metin: KALIPLAR[0], puan: 1, cevap: '', prep: '', altTip: '', altlar: [] });
const soruPuani = s => s.altlar?.length ? s.altlar.reduce((t, a) => t + sayi(a.puan), 0) : sayi(s.puan);
const toplam = o => o.sorular.reduce((t, s) => t + soruPuani(s), 0);
const altEtiket = (s, i) => s.altTip === 'numara' ? `${i + 1} ---` : `${HARF[i] || i + 1})`;
const prepAd = id => { const p = preparatlar().find(x => x.id === id); return p ? `${p.sira ? p.kutu + '-' + p.sira : p.kutu} ${p.organ}${p.boya && p.boya !== 'H&E' ? ' (' + p.boya + ')' : ''}` : ''; };
const prepBul = metin => { const k = String(metin || '').trim().split(/\s+/)[0]; return preparatlar().find(p => (p.sira ? p.kutu + '-' + p.sira : String(p.kutu)) === k)?.id || ''; };
const parcala = (t, ek = {}) => String(t || '').split('__').map((x, i) => ({ ...ek, t: x, u: i % 2 === 1 })).filter(x => x.t);
const kalipSec = () => `<select class="kg-kalip" aria-label="Hazır soru kalıbı"><option value="">Hazır soru seç…</option>${kaliplar().map(x => `<option>${esc(x)}</option>`).join('')}</select>`;

function sinavListesi() {
  const gorulen = new Set(), liste = [];
  olaylar.forEach(e => { const k = kanonik(e.id); if (gorulen.has(k)) return; gorulen.add(k); liste.push({ id: k, tarih: e.date, ad: `${e.s} · ${e.topic.replace(/ histoloji uygulama sınavı/i, '')}` }); });
  Object.entries(kayitlar).filter(([, k]) => k.serbest).forEach(([id, k]) => liste.push({ id, tarih: k.tarih || '', ad: k.ad || 'Takvim dışı sınav', serbest: true }));
  return liste.sort((a, b) => (a.tarih || '9').localeCompare(b.tarih || '9'));
}

function soruHtml(s, oi, si) {
  const alt = s.altlar?.length > 0;
  return `<div class="kg-soru" data-o="${oi}" data-s="${si}">
    <div class="kg-no">${si + 1}.</div>
    <div class="kg-alan">
      <textarea data-k="metin" rows="2" aria-label="Soru" placeholder="${alt ? 'Öncül / giriş cümlesi (boş bırakılabilir)' : 'Soru'}">${esc(s.metin)}</textarea>
      ${kalipSec()}
      ${alt ? s.altlar.map((a, ai) => `<div class="kg-alt" data-a="${ai}">
        <div class="kg-alt-bas"><b>${esc(altEtiket(s, ai))}</b>${s.altTip === 'numara' ? '<span class="note">numaralı bölge</span>' : ''}<button type="button" class="linkbtn" data-is="alt-sil" aria-label="Sil">×</button></div>
        ${s.altTip === 'numara' ? '' : `<textarea data-k="altmetin" rows="2" placeholder="Alt soru">${esc(a.metin)}</textarea>${kalipSec()}`}
        <div class="kg-satir"><label>Puan<input data-k="altpuan" value="${esc(puanYazi(a.puan))}" inputmode="decimal"></label><label>Cevap<input data-k="altcevap" value="${esc(a.cevap)}"></label></div>
      </div>`).join('') : `<div class="kg-satir">
        <label>Puan<input data-k="puan" value="${esc(puanYazi(s.puan))}" inputmode="decimal"></label>
        <label>Cevap<input data-k="cevap" value="${esc(s.cevap)}"></label>
      </div>`}
      <div class="kg-alt-ekle">${!alt || s.altTip !== 'numara' ? `<button type="button" class="linkbtn" data-is="alt-harf">+ ${alt ? HARF[s.altlar.length] + ')' : 'A) B)'} alt soru</button>` : ''}${!alt || s.altTip === 'numara' ? `<button type="button" class="linkbtn" data-is="alt-numara">+ ${alt ? s.altlar.length + 1 + ' ---' : 'Numaralı bölge (1 --- 2 ---)'}</button>` : ''}</div>
      <label>Mikroskoptaki preparat<input data-k="prep" list="kg-prep" value="${esc(prepAd(s.prep))}" placeholder="Kod yaz, ör. 9-1"></label>
    </div>
    <div class="kg-dugme"><button type="button" class="linkbtn" data-is="yukari" aria-label="Yukarı">↑</button><button type="button" class="linkbtn" data-is="asagi" aria-label="Aşağı">↓</button><button type="button" class="linkbtn" data-is="sil" aria-label="Soruyu sil">×</button></div>
  </div>`;
}

function render() {
  const el = $('#v-kagit'); if (!el) return;
  if (!ready || !state.approved) { el.innerHTML = '<div class="banner">Sınav kâğıtları bölüm üyelerine açık. <a href="#profil">Giriş yap</a>.</div>'; return; }
  const liste = sinavListesi(), bugun = new Date().toISOString().slice(0, 10);
  if (!secili || !liste.some(x => x.id === secili)) { secili = (liste.find(x => !x.serbest && x.tarih >= bugun) || liste[liste.length - 1])?.id || null; taslak = null; }
  if (secili && !taslak) taslak = normal(structuredClone(kayitlar[secili] || varsayilan(secili)));
  const kayit = kayitlar[secili], sx = liste.find(x => x.id === secili);
  el.innerHTML = `
    <div class="card" style="max-width:none">
      <label for="kg-sinav">Sınav</label>
      <select id="kg-sinav">${liste.map(x => `<option value="${esc(x.id)}"${x.id === secili ? ' selected' : ''}>${x.tarih ? esc(x.tarih.split('-').reverse().join('.')) + ' · ' : ''}${esc(x.ad)}${kayitlar[x.id] ? ' ✓' : ''}</option>`).join('')}</select>
      <p class="note">${kayit ? `Son kaydeden: ${esc(kayit.kaydedenAd || '')}${kayit.zaman?.toDate ? ' · ' + esc(kayit.zaman.toDate().toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) : ''}` : 'Bu sınav için henüz kâğıt hazırlanmadı.'} Cevaplar sadece bölüm üyelerine görünür.</p>
      <details class="kg-yeni"><summary>+ Takvimde olmayan bir sınav için kâğıt (ör. Diş bütünleme)</summary>
        <div class="kg-satir" style="grid-template-columns:1fr auto"><input id="kg-yeni-ad" placeholder="Ör. Diş Dönem 2 bütünleme"><select id="kg-yeni-fak"><option value="dis">Diş</option><option value="tip">Tıp</option></select></div>
        <div class="kg-satir" style="grid-template-columns:1fr auto;margin-top:6px"><input id="kg-yeni-tarih" type="date"><button type="button" class="btn sec" data-is="yeni">Oluştur</button></div>
      </details>
    </div>
    ${taslak ? `
    <details class="card" style="max-width:none"><summary><b>Başlık ve notlar</b></summary>
      ${sx?.serbest ? `<label>Sınavın adı (listede görünen)</label><input data-k="ad" value="${esc(taslak.ad || '')}">` : ''}
      <label>Kurum</label><input data-k="ust" value="${esc(taslak.ust)}">
      <label>Dönem · yıl · kurul</label><input data-k="ust2" value="${esc(taslak.ust2)}">
      <label>Sınav</label><input data-k="ust3" value="${esc(taslak.ust3)}">
      <label>Notlar (her satıra bir not; __iki alt çizgi__ arası altı çizili basılır)</label><textarea data-k="notlar" rows="5">${esc(taslak.notlar)}</textarea>
    </details>
    ${taslak.oturumlar.map((o, oi) => `
    <div class="card kg-oturum" style="max-width:none">
      <div class="kg-bas"><h3>Başlangıç saati</h3><input data-o="${oi}" data-k="saat" value="${esc(o.saat)}" style="width:6em"><span class="pill">${o.sorular.length} soru · ${puanYazi(toplam(o))} puan</span>${taslak.oturumlar.length > 1 ? `<button type="button" class="linkbtn" data-is="oturum-sil" data-o="${oi}">Oturumu sil</button>` : ''}</div>
      ${o.sorular.map((s, si) => soruHtml(s, oi, si)).join('')}
      <div class="acts"><button type="button" class="btn sec" data-is="ekle" data-o="${oi}">+ Soru ekle</button>${taslak.oturumlar.length > 1 ? `<button type="button" class="btn sec" data-is="kopyala" data-o="${oi}">Diğer oturumun sorularını kopyala</button>` : ''}</div>
    </div>`).join('')}
    <button type="button" class="linkbtn" data-is="oturum-ekle">+ Oturum ekle</button>
    <div class="card kg-cikti" style="max-width:none">
      <div class="acts">
        <button class="btn" data-is="kaydet">${degisti ? 'Kaydet •' : 'Kaydedildi'}</button>
        <button class="btn sec" data-is="yazdir-ogrenci">📄 Öğrenci kâğıdını aç</button>
        <button class="btn sec" data-is="yazdir-anahtar">🔑 Cevap anahtarını aç</button>
      </div>
      <p class="note" style="margin:6px 0 0">Açılan sayfadan yazdırabilirsin. Word dosyası gerekirse: <button class="linkbtn" data-is="ogrenci" style="min-height:0">öğrenci kâğıdı</button> · <button class="linkbtn" data-is="anahtar" style="min-height:0">cevap anahtarı</button>${sx?.serbest ? ` · <button class="linkbtn" data-is="kagit-sil" style="min-height:0">bu kâğıdı sil</button>` : ''}</p>
      <h3 style="margin-top:14px">Mikroskoplara konacak preparatlar</h3>
      <div id="kg-preplist">${prepListesi()}</div>
    </div>
    <datalist id="kg-prep">${preparatlar().slice().sort((a, b) => String(a.kutu).localeCompare(String(b.kutu), 'tr', { numeric: true }) || String(a.sira).localeCompare(String(b.sira), 'tr', { numeric: true })).map(p => `<option value="${esc(prepAd(p.id))}">`).join('')}</datalist>
    ` : '<p class="note">Takvimde uygulama sınavı yok. Yukarıdan takvim dışı bir sınav için kâğıt oluşturabilirsin.</p>'}`;
}

// Eski kayıtları yeni biçime uydurur
function normal(t) {
  t.ust3 = t.ust3 || 'UYGULAMA SINAVI';
  (t.oturumlar || []).forEach(o => o.sorular.forEach(s => { s.altlar = s.altlar || []; s.altTip = s.altTip || ''; }));
  return t;
}

const prepListesi = () => taslak.oturumlar.map(o => `<div class="kg-prep"><b>${esc(o.saat)}</b>${o.sorular.length ? `<ol>${o.sorular.map(s => { const c = s.altlar?.length ? s.altlar[0].cevap : s.cevap; return `<li>${s.prep ? esc(prepAd(s.prep)) : `<span class="mute">${c ? esc(c) + ' · ' : ''}preparat seçilmedi</span>`}</li>`; }).join('')}</ol>` : '<p class="note">Soru yok.</p>'}</div>`).join('');
function ozetGuncelle() {
  document.querySelectorAll('.kg-oturum').forEach((k, i) => { const o = taslak.oturumlar[i], p = k.querySelector('.kg-bas .pill'); if (o && p) p.textContent = `${o.sorular.length} soru · ${puanYazi(toplam(o))} puan`; });
  const l = $('#kg-preplist'); if (l) l.innerHTML = prepListesi();
}

const cevapSatiri = (anahtar, cevap) => anahtar ? [{ t: '……………………' }, { t: buyuk(cevap), b: true, renk: 'FF0000' }, { t: '……………………………………' }] : [{ t: '…'.repeat(80) }];

function belge(anahtar) {
  const p = [];
  taslak.oturumlar.forEach((o, i) => {
    if (i) p.push({ sayfaSonu: true });
    [taslak.ust, taslak.ust2, taslak.ust3].filter(x => String(x || '').trim()).forEach(x => p.push({ hiza: 'center', bosluk: 0, parcalar: [{ t: x, b: true }] }));
    p.push({ hiza: 'center', bosluk: 6, parcalar: [{ t: `BAŞLANGIÇ SAATİ: ${o.saat}`, b: true }] });
    ['AD SOYAD:', 'NO:', 'GRUP:'].forEach((x, j) => p.push({ bosluk: j === 2 ? 14 : 2, parcalar: [{ t: x, b: true }] }));
    taslak.notlar.split('\n').filter(x => x.trim()).forEach((n, j, a) => {
      const m = n.match(/^(not\s*\d+\s*:)(.*)$/i);
      p.push({ bosluk: j === a.length - 1 ? 16 : 0, parcalar: m ? [{ t: m[1], b: true }, ...parcala(m[2])] : parcala(n) });
    });
    o.sorular.forEach((s, j) => {
      const no = { t: `${j + 1}. `, b: true }, satirlar = String(s.metin || '').split('\n').map(x => x.trim()).filter(Boolean);
      if (!s.altlar?.length) {
        satirlar.forEach((x, k) => p.push({ girinti: k ? 360 : 0, bosluk: k === satirlar.length - 1 ? 4 : 0, parcalar: [...(k ? [] : [no]), ...parcala(x, { b: true }), ...(k === satirlar.length - 1 ? [{ t: ` (${puanYazi(s.puan)} PUAN)`, b: true }] : [])] }));
        if (!satirlar.length) p.push({ bosluk: 4, parcalar: [no, { t: `(${puanYazi(s.puan)} PUAN)`, b: true }] });
        p.push({ bosluk: 14, parcalar: cevapSatiri(anahtar, s.cevap) });
        return;
      }
      const numara = s.altTip === 'numara';
      // Öncül satırları; numaralı bölgelerde toplam puan öncülün sonuna yazılır
      satirlar.forEach((x, k) => p.push({ girinti: k ? 360 : 0, bosluk: k === satirlar.length - 1 ? 6 : 0, parcalar: [...(k ? [] : [no]), ...parcala(x, { b: true }), ...(numara && k === satirlar.length - 1 ? [{ t: ` (${puanYazi(soruPuani(s))} PUAN)`, b: true }] : [])] }));
      s.altlar.forEach((a, ai) => {
        const ilkSatir = !satirlar.length && ai === 0;
        if (numara) {
          p.push({ girinti: 360, bosluk: ai === s.altlar.length - 1 ? 14 : 6, parcalar: [...(ilkSatir ? [no] : []), { t: `${ai + 1} --- `, b: true }, ...(anahtar ? [{ t: '…………' }, { t: buyuk(a.cevap), b: true, renk: 'FF0000' }, { t: '……………………………' }] : [{ t: '…'.repeat(60) }]), { t: `   (${puanYazi(a.puan)} PUAN)`, b: true }] });
        } else {
          p.push({ girinti: ilkSatir ? 0 : 360, bosluk: 4, parcalar: [...(ilkSatir ? [no] : []), { t: `${altEtiket(s, ai)} `, b: true }, ...parcala(a.metin, { b: true }), { t: ` (${puanYazi(a.puan)} PUAN)`, b: true }] });
          p.push({ bosluk: ai === s.altlar.length - 1 ? 14 : 8, parcalar: cevapSatiri(anahtar, a.cevap) });
        }
      });
    });
  });
  return p;
}

function yazdir(anahtar) {
  const w = window.open('', '_blank'); if (!w) { toast('Açılır pencereye izin ver'); return; }
  const html = belge(anahtar).map(x => x.sayfaSonu ? '<div style="page-break-after:always"></div>' : `<p style="margin:0 0 ${x.bosluk ?? 4}pt ${x.girinti ? x.girinti / 20 + 'pt' : '0'};text-align:${x.hiza || 'left'}">${x.parcalar.map(r => `<span style="${r.b ? 'font-weight:700;' : ''}${r.u ? 'text-decoration:underline;' : ''}${r.renk ? 'color:#' + r.renk : ''}">${esc(r.t)}</span>`).join('')}</p>`).join('');
  // Üstteki düğmeler kâğıda basılmaz; yazdırma menüsü kapatılsa da "Yazdır" ile yeniden açılır
  w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${anahtar ? 'Cevap anahtarı' : 'Sınav kâğıdı'}</title><style>
    body{font:11pt Calibri,Arial,sans-serif;margin:16px;max-width:17cm}@page{size:A4;margin:2cm}p{overflow-wrap:anywhere}
    .arac{position:sticky;top:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#f4f2fb;border:1px solid #ddd;border-radius:10px;padding:8px;margin:0 0 20px;z-index:1}
    .arac button{font:600 16px system-ui,sans-serif;min-height:44px;padding:0 18px;border-radius:10px;border:0;cursor:pointer}
    .arac .y{background:#c2185b;color:#fff}.arac .k{background:#fff;border:1px solid #ccc;color:#222}.arac span{font:13px system-ui,sans-serif;color:#555}
    @media print{.arac{display:none}body{margin:0}}
  </style></head><body><div class="arac"><button class="y" onclick="print()">🖨️ Yazdır</button><button class="k" onclick="kapat()">Kapat</button><span>${anahtar ? 'Cevap anahtarı' : 'Öğrenci kâğıdı'} · Kapat çalışmazsa sol üstteki “Bitti”ye bas</span></div>${html}<script>function kapat(){close();setTimeout(function(){history.length>1?history.back():0},300)}<\/script></body></html>`);
  w.document.close();
}

const dosyaAdi = ek => {
  const k = kayitlar[secili], e = oturumlar(secili)[0];
  const ad = k?.serbest || !e ? (taslak.ad || 'sinav') : `${e.s}_${e.topic.match(/^(.*?)\s+kurulu/i)?.[1] || 'sinav'}`;
  const tr = x => x.replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u');
  return tr(`${ad}_${ek}`).replace(/[^A-Za-z0-9]+/g, '_') + '.docx';
};

async function kaydet() {
  const temiz = {
    ...taslak,
    oturumlar: taslak.oturumlar.map(o => ({
      saat: o.saat, sorular: o.sorular.map(s => ({
        metin: s.metin || '', puan: sayi(s.puan), cevap: s.cevap || '', prep: s.prep || '', altTip: s.altlar?.length ? s.altTip : '',
        altlar: (s.altlar || []).map(a => ({ metin: a.metin || '', puan: sayi(a.puan), cevap: a.cevap || '' }))
      }))
    }))
  };
  await F.setDoc(F.doc(db, 'sinavKagitlari', secili), { ...temiz, kaydeden: state.user.uid, kaydedenAd: state.profile?.ad || '', zaman: F.serverTimestamp() });
  degisti = false; toast('Kaydedildi'); render();
}

function isaretle() { if (!degisti) { degisti = true; const b = document.querySelector('[data-is="kaydet"]'); if (b) b.textContent = 'Kaydet •'; } }

function onInput(e) {
  const t = e.target, k = t.dataset.k; if (!k || !taslak) return;
  const kart = t.closest('[data-s]'), altEl = t.closest('[data-a]');
  if (kart) {
    const s = taslak.oturumlar[+kart.dataset.o].sorular[+kart.dataset.s];
    if (altEl) { const a = s.altlar[+altEl.dataset.a]; a[{ altmetin: 'metin', altpuan: 'puan', altcevap: 'cevap' }[k]] = t.value; }
    else if (k === 'prep') s.prep = prepBul(t.value); else s[k] = t.value;
  } else if (t.dataset.o !== undefined) taslak.oturumlar[+t.dataset.o][k] = t.value;
  else taslak[k] = t.value;
  isaretle(); ozetGuncelle();
}

async function onClick(e) {
  const b = e.target.closest('[data-is]'); if (!b) return;
  const is = b.dataset.is, kart = b.closest('[data-s]');
  try {
    if (kart) {
      const l = taslak.oturumlar[+kart.dataset.o].sorular, i = +kart.dataset.s, s = l[i];
      if (is === 'alt-harf' || is === 'alt-numara') {
        const tip = is === 'alt-harf' ? 'harf' : 'numara';
        if (!s.altlar.length) {
          // İlk alt soru: tek parça sorunun metni, puanı ve cevabı alt soruya taşınır
          s.altTip = tip;
          if (tip === 'harf') { s.altlar.push({ metin: s.metin, puan: s.puan, cevap: s.cevap }, { metin: '', puan: s.puan, cevap: '' }); s.metin = ''; }
          else { s.metin = s.metin || 'PREPARAT ÜZERİNDE İŞARETLENİP NUMARALANDIRILAN BÖLGELERİN TAM ADLARINI YAZINIZ.'; s.altlar.push({ metin: '', puan: s.puan, cevap: s.cevap }); }
          s.cevap = '';
        } else s.altlar.push({ metin: '', puan: s.altlar[s.altlar.length - 1].puan, cevap: '' });
        isaretle(); render(); return;
      }
      if (is === 'alt-sil') {
        s.altlar.splice(+b.closest('[data-a]').dataset.a, 1);
        if (!s.altlar.length) s.altTip = '';
        isaretle(); render(); return;
      }
      if (is === 'sil') { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '?'; b.title = 'Silmek için tekrar bas'; return; } l.splice(i, 1); }
      else if (is === 'yukari' && i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]];
      else if (is === 'asagi' && i < l.length - 1) [l[i + 1], l[i]] = [l[i], l[i + 1]];
      isaretle(); render(); return;
    }
    if (is === 'ekle') { taslak.oturumlar[+b.dataset.o].sorular.push(yeniSoru()); isaretle(); render(); }
    else if (is === 'kopyala') { const oi = +b.dataset.o, diger = taslak.oturumlar.find((_, j) => j !== oi); taslak.oturumlar[oi].sorular = structuredClone(diger.sorular); isaretle(); render(); toast('Sorular kopyalandı; cevapları ve preparatları değiştirmeyi unutma'); }
    else if (is === 'oturum-ekle') { taslak.oturumlar.push({ saat: taslak.oturumlar.length ? '' : '09.30', sorular: [] }); isaretle(); render(); }
    else if (is === 'oturum-sil') { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Emin misin? Tekrar bas'; return; } taslak.oturumlar.splice(+b.dataset.o, 1); isaretle(); render(); }
    else if (is === 'yeni') {
      const ad = $('#kg-yeni-ad').value.trim(), fak = $('#kg-yeni-fak').value, tarih = $('#kg-yeni-tarih').value;
      if (!ad) { toast('Sınavın adını yaz'); return; }
      if (degisti && !confirm('Kaydedilmemiş değişiklikler var. Yine de yeni kâğıda geçilsin mi?')) return;
      const ref = F.doc(F.collection(db, 'sinavKagitlari'));
      await F.setDoc(ref, { serbest: true, ad, tarih, ust: KURUM[fak], ust2: `DÖNEM   ${egitimYili(tarih || new Date().toISOString().slice(0, 10))}`, ust3: 'UYGULAMA SINAVI', notlar: NOTLAR[fak].join('\n'), oturumlar: [{ saat: '09.30', sorular: [] }], kaydeden: state.user.uid, kaydedenAd: state.profile?.ad || '', zaman: F.serverTimestamp() });
      secili = ref.id || ref.path.split('/').pop(); taslak = null; degisti = false; render(); toast('Kâğıt oluşturuldu; başlıktaki dönemi ve sınav adını kontrol et');
    }
    else if (is === 'kagit-sil') { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'emin misin? tekrar bas'; return; } await F.deleteDoc(F.doc(db, 'sinavKagitlari', secili)); secili = null; taslak = null; degisti = false; toast('Silindi'); }
    else if (is === 'kaydet') await kaydet();
    else if (is === 'ogrenci' || is === 'anahtar') { if (degisti) await kaydet(); await indir(docx(belge(is === 'anahtar')), dosyaAdi(is === 'anahtar' ? 'cevap_anahtari' : 'sinav_kagidi')); }
    else if (is === 'yazdir-ogrenci' || is === 'yazdir-anahtar') yazdir(is === 'yazdir-anahtar');
  } catch (x) { console.error(x); toast('İşlem yapılamadı'); }
}

export const sinavKagidiAc = evId => { secili = kanonik(evId); taslak = null; degisti = false; location.hash = 'kagit'; render(); };

export function initSinavKagidi(onEventsFn) {
  const el = $('#v-kagit'); if (!el) return;
  onEventsFn(ev => { olaylar = ev.filter(e => gozetmenliSinav(e) && e.id); if (!degisti) render(); });
  el.addEventListener('input', onInput);
  el.addEventListener('click', onClick);
  el.addEventListener('change', e => {
    if (e.target.classList.contains('kg-kalip') && e.target.value) {
      const kutu = e.target.closest('[data-a]') || e.target.closest('.kg-alan'), ta = kutu.querySelector(':scope > textarea');
      ta.value = e.target.value; e.target.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (e.target.id === 'kg-sinav') {
      if (degisti && !confirm('Kaydedilmemiş değişiklikler var. Yine de başka sınava geçilsin mi?')) { e.target.value = secili; return; }
      secili = e.target.value; taslak = null; degisti = false; render();
    }
  });
  addEventListener('hashchange', () => { if (location.hash === '#kagit' && !degisti) render(); });
  addEventListener('beforeunload', e => { if (degisti) { e.preventDefault(); e.returnValue = ''; } });
  onState(s => {
    if (ready && s.approved && !unsub) unsub = F.onSnapshot(F.collection(db, 'sinavKagitlari'), q => { kayitlar = {}; q.docs.forEach(d => { kayitlar[d.id] = d.data(); }); if (!degisti) { taslak = null; render(); } }, () => { });
    if (!s.approved && unsub) { unsub(); unsub = null; kayitlar = {}; }
    render();
  });
}
