// Uygulama sınavı kâğıdı: her oturum (ör. 09.30 ve 13.30) için soru, puan, cevap ve mikroskoba konacak preparat.
// Çıktılar: öğrenci kâğıdı ve cevap anahtarı (Word ya da yazdır), oturum oturum preparat listesi.
import { $, esc, state, onState, toast } from './util.js';
import { ready, db, F } from './fb.js';
import { gozetmenliSinav, kanonik, oturumlar } from './gozetmen.js';
import { preparatlar } from './arsiv.js';
import { docx, indir } from './docx.js';

const KURUM = 'AYDIN ADNAN MENDERES ÜNİVERSİTESİ TIP FAKÜLTESİ HİSTOLOJİ VE EMBRİYOLOJİ ANABİLİM DALI';
const NOTLAR = [
  'NOT 1: CEVAPLARDA KISALTMA KULLANMAYINIZ. KULLANILMASI DURUMUNDA PUAN __ALINAMAYACAKTIR.__',
  'NOT 2: CEVAPLARDA EKSİK YA DA YANLIŞ YAZIMLAR KABUL EDİLMEYECEKTİR, PUAN __ALINAMAYACAKTIR.__',
  'NOT 3: MİKROSKOPLARDA MİKROVİDA HARİÇ HERHANGİ BİR AYARLAMA __YAPILMAYACAKTIR.__',
  'NOT 4: SORULARIN PUANLAMASI SORU SONUNDA YAZMAKTADIR.'
];
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
  'MİKROSKOPTA OK İLE GÖSTERİLEN YAPININ ADINI YAZINIZ'
];
// Kurul sırası (başlıktaki "3. KURUL" için); bilinmiyorsa boş kalır, elle yazılır
const KURUL_NO = { 'Tıp D1': { 'hücre': 2, 'doku': 3, 'sistemlere giriş': 4 }, 'Tıp D2': { 'kan ve kas': 1, 'dolaşım ve solunum': 2, 'sindirim, endokrin ve metabolizma': 3, 'sinir ve duyu': 4, 'boşaltım ve üreme': 5 } };
const DONEM = { 'Tıp D1': 'DÖNEM 1', 'Tıp D2': 'DÖNEM 2', 'Tıp D3': 'DÖNEM 3' };
const buyuk = s => String(s || '').toLocaleUpperCase('tr');

let olaylar = [], kayitlar = {}, secili = null, taslak = null, degisti = false, unsub = null;

function varsayilan(evId) {
  const ots = oturumlar(evId), e = ots[0];
  const kurul = (e.topic.match(/^(.*?)\s+kurulu/i)?.[1] || '').trim();
  const no = KURUL_NO[e.s]?.[kurul.toLocaleLowerCase('tr')];
  const [y, m] = e.date.split('-').map(Number), yil = m >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
  return {
    ust: KURUM,
    ust2: `${DONEM[e.s] || buyuk(e.s)}  ${yil} ${no ? no + '. ' : ''}KURUL${kurul ? ` (${buyuk(kurul)} KURULU)` : ''}`,
    notlar: NOTLAR.join('\n'),
    oturumlar: ots.map(o => ({ saat: (o.t || '').replace(':', '.'), sorular: [] }))
  };
}
// Hazır kalıplar + daha önce kaydedilmiş kâğıtlarda kullanılan sorular (soru bankası)
const kaliplar = () => [...new Set([...KALIPLAR, ...Object.values(kayitlar).flatMap(k => (k.oturumlar || []).flatMap(o => o.sorular.map(s => s.metin)))].filter(Boolean))];
const yeniSoru = () => ({ metin: KALIPLAR[0], puan: 1, cevap: '', prep: '' });
const toplam = o => o.sorular.reduce((t, s) => t + (Number(String(s.puan).replace(',', '.')) || 0), 0);
const puanYazi = p => String(p ?? '').replace('.', ',');
const prepAd = id => { const p = preparatlar().find(x => x.id === id); return p ? `${p.sira ? p.kutu + '-' + p.sira : p.kutu} ${p.organ}${p.boya && p.boya !== 'H&E' ? ' (' + p.boya + ')' : ''}` : ''; };
const prepBul = metin => { const k = String(metin || '').trim().split(/\s+/)[0]; return preparatlar().find(p => (p.sira ? p.kutu + '-' + p.sira : String(p.kutu)) === k)?.id || ''; };

// "__altı çizili__" işaretli metni parçalara ayırır
const parcala = (t, ek = {}) => String(t || '').split('__').map((x, i) => ({ ...ek, t: x, u: i % 2 === 1 })).filter(x => x.t);

function sinavListesi() {
  const gorulen = new Set();
  return olaylar.filter(e => { const k = kanonik(e.id); if (gorulen.has(k)) return false; gorulen.add(k); return true; })
    .map(e => ({ id: kanonik(e.id), e })).sort((a, b) => a.e.date.localeCompare(b.e.date));
}

function render() {
  const el = $('#v-kagit'); if (!el) return;
  if (!ready || !state.approved) { el.innerHTML = '<div class="banner">Sınav kâğıtları bölüm üyelerine açık. <a href="#profil">Giriş yap</a>.</div>'; return; }
  const liste = sinavListesi(), bugun = new Date().toISOString().slice(0, 10);
  if (!secili) secili = (liste.find(x => x.e.date >= bugun) || liste[liste.length - 1])?.id || null;
  if (secili && !taslak) taslak = structuredClone(kayitlar[secili] || varsayilan(secili));
  const kayit = kayitlar[secili];
  el.innerHTML = `
    <div class="card" style="max-width:none">
      <label for="kg-sinav">Sınav</label>
      <select id="kg-sinav">${liste.map(x => `<option value="${esc(x.id)}"${x.id === secili ? ' selected' : ''}>${esc(x.e.date.split('-').reverse().join('.'))} · ${esc(x.e.s)} · ${esc(x.e.topic.replace(/ histoloji uygulama sınavı/i, ''))}${kayitlar[x.id] ? ' ✓' : ''}</option>`).join('')}</select>
      <p class="note">${kayit ? `Son kaydeden: ${esc(kayit.kaydedenAd || '')}${kayit.zaman?.toDate ? ' · ' + esc(kayit.zaman.toDate().toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) : ''}` : 'Bu sınav için henüz kâğıt hazırlanmadı.'} Cevaplar sadece bölüm üyelerine görünür.</p>
    </div>
    ${taslak ? `
    <details class="card" style="max-width:none"><summary><b>Başlık ve notlar</b></summary>
      <label>Kurum</label><input data-k="ust" value="${esc(taslak.ust)}">
      <label>Dönem · yıl · kurul</label><input data-k="ust2" value="${esc(taslak.ust2)}">
      <label>Notlar (her satıra bir not; __iki alt çizgi__ arası altı çizili basılır)</label><textarea data-k="notlar" rows="5">${esc(taslak.notlar)}</textarea>
    </details>
    ${taslak.oturumlar.map((o, oi) => `
    <div class="card kg-oturum" style="max-width:none">
      <div class="kg-bas"><h3>Başlangıç saati</h3><input data-o="${oi}" data-k="saat" value="${esc(o.saat)}" style="width:6em"><span class="pill">${o.sorular.length} soru · ${puanYazi(toplam(o))} puan</span></div>
      ${o.sorular.map((s, si) => `<div class="kg-soru" data-o="${oi}" data-s="${si}">
        <div class="kg-no">${si + 1}.</div>
        <div class="kg-alan">
          <textarea data-k="metin" rows="2" aria-label="Soru">${esc(s.metin)}</textarea>
          <select class="kg-kalip" aria-label="Hazır soru kalıbı"><option value="">Hazır soru seç…</option>${kaliplar().map(x => `<option>${esc(x)}</option>`).join('')}</select>
          <div class="kg-satir">
            <label>Puan<input data-k="puan" value="${esc(puanYazi(s.puan))}" inputmode="decimal"></label>
            <label class="kg-cevap">Cevap<input data-k="cevap" value="${esc(s.cevap)}"></label>
          </div>
          <label>Mikroskoptaki preparat<input data-k="prep" list="kg-prep" value="${esc(prepAd(s.prep))}" placeholder="Kod yaz, ör. 9-1"></label>
        </div>
        <div class="kg-dugme"><button type="button" class="linkbtn" data-is="yukari" aria-label="Yukarı">↑</button><button type="button" class="linkbtn" data-is="asagi" aria-label="Aşağı">↓</button><button type="button" class="linkbtn" data-is="sil" aria-label="Sil">×</button></div>
      </div>`).join('')}
      <div class="acts"><button type="button" class="btn sec" data-is="ekle" data-o="${oi}">+ Soru ekle</button>${taslak.oturumlar.length > 1 ? `<button type="button" class="btn sec" data-is="kopyala" data-o="${oi}">Diğer oturumun sorularını kopyala</button>` : ''}</div>
    </div>`).join('')}
    <div class="card kg-cikti" style="max-width:none">
      <div class="acts">
        <button class="btn" data-is="kaydet">${degisti ? 'Kaydet •' : 'Kaydedildi'}</button>
        <button class="btn sec" data-is="ogrenci">📄 Öğrenci kâğıdı (Word)</button>
        <button class="btn sec" data-is="anahtar">🔑 Cevap anahtarı (Word)</button>
        <button class="btn sec" data-is="yazdir-ogrenci">🖨️ Öğrenci kâğıdını yazdır</button>
        <button class="btn sec" data-is="yazdir-anahtar">🖨️ Cevap anahtarını yazdır</button>
      </div>
      <h3 style="margin-top:14px">Mikroskoplara konacak preparatlar</h3>
      <div id="kg-preplist">${prepListesi()}</div>
    </div>
    <datalist id="kg-prep">${preparatlar().slice().sort((a, b) => String(a.kutu).localeCompare(String(b.kutu), 'tr', { numeric: true }) || String(a.sira).localeCompare(String(b.sira), 'tr', { numeric: true })).map(p => `<option value="${esc(prepAd(p.id))}">`).join('')}</datalist>
    ` : '<p class="note">Takvimde uygulama sınavı yok.</p>'}`;
}

const prepListesi = () => taslak.oturumlar.map(o => `<div class="kg-prep"><b>${esc(o.saat)}</b>${o.sorular.length ? `<ol>${o.sorular.map(s => `<li>${s.prep ? esc(prepAd(s.prep)) : `<span class="mute">${s.cevap ? esc(s.cevap) + ' · ' : ''}preparat seçilmedi</span>`}</li>`).join('')}</ol>` : '<p class="note">Soru yok.</p>'}</div>`).join('');
// Yazarken ekranı yeniden çizmeden özetleri günceller (odak kaybolmasın)
function ozetGuncelle() {
  document.querySelectorAll('.kg-oturum').forEach((k, i) => { const o = taslak.oturumlar[i], p = k.querySelector('.kg-bas .pill'); if (o && p) p.textContent = `${o.sorular.length} soru · ${puanYazi(toplam(o))} puan`; });
  const l = $('#kg-preplist'); if (l) l.innerHTML = prepListesi();
}

function belge(anahtar) {
  const p = [];
  taslak.oturumlar.forEach((o, i) => {
    if (i) p.push({ sayfaSonu: true });
    p.push({ hiza: 'center', bosluk: 0, parcalar: [{ t: taslak.ust, b: true }] });
    p.push({ hiza: 'center', bosluk: 0, parcalar: [{ t: taslak.ust2, b: true }] });
    p.push({ hiza: 'center', bosluk: 0, parcalar: [{ t: 'UYGULAMA SINAVI', b: true }] });
    p.push({ hiza: 'center', bosluk: 6, parcalar: [{ t: `BAŞLANGIÇ SAATİ: ${o.saat}`, b: true }] });
    ['AD SOYAD:', 'NO:', 'GRUP:'].forEach((x, j) => p.push({ bosluk: j === 2 ? 14 : 2, parcalar: [{ t: x, b: true }] }));
    taslak.notlar.split('\n').filter(x => x.trim()).forEach((n, j, a) => {
      const m = n.match(/^(not\s*\d+\s*:)(.*)$/i);
      p.push({ bosluk: j === a.length - 1 ? 16 : 0, parcalar: m ? [{ t: m[1], b: true }, ...parcala(m[2])] : parcala(n) });
    });
    o.sorular.forEach((s, j) => {
      p.push({ bosluk: 4, parcalar: [{ t: `${j + 1}. `, b: true }, ...parcala(s.metin, { b: true }), { t: ` (${puanYazi(s.puan)} PUAN)`, b: true }] });
      p.push({ bosluk: 14, parcalar: anahtar ? [{ t: '……………………' }, { t: buyuk(s.cevap), b: true, renk: 'FF0000' }, { t: '……………………' }] : [{ t: '…'.repeat(80) }] });
    });
  });
  return p;
}

function yazdir(anahtar) {
  const w = window.open('', '_blank'); if (!w) { toast('Açılır pencereye izin ver'); return; }
  const html = belge(anahtar).map(x => x.sayfaSonu ? '<div style="page-break-after:always"></div>' : `<p style="margin:0 0 ${x.bosluk ?? 4}pt;text-align:${x.hiza || 'left'}">${x.parcalar.map(r => `<span style="${r.b ? 'font-weight:700;' : ''}${r.u ? 'text-decoration:underline;' : ''}${r.renk ? 'color:#' + r.renk : ''}">${esc(r.t)}</span>`).join('')}</p>`).join('');
  // Üstteki düğmeler kâğıda basılmaz; yazdırma menüsü kapatılsa da "Yazdır" ile yeniden açılır
  w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${anahtar ? 'Cevap anahtarı' : 'Sınav kâğıdı'}</title><style>
    body{font:11pt Calibri,Arial,sans-serif;margin:16px;max-width:17cm}@page{size:A4;margin:2cm}
    .arac{position:sticky;top:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#f4f2fb;border:1px solid #ddd;border-radius:10px;padding:8px;margin:0 0 20px;z-index:1}
    .arac button{font:600 16px system-ui,sans-serif;min-height:44px;padding:0 18px;border-radius:10px;border:0;cursor:pointer}
    .arac .y{background:#c2185b;color:#fff}.arac .k{background:#fff;border:1px solid #ccc;color:#222}.arac span{font:13px system-ui,sans-serif;color:#555}
    @media print{.arac{display:none}body{margin:0}}
  </style></head><body><div class="arac"><button class="y" onclick="print()">🖨️ Yazdır</button><button class="k" onclick="kapat()">Kapat</button><span>${anahtar ? 'Cevap anahtarı' : 'Öğrenci kâğıdı'} · kapanmazsa sol üstteki “Bitti”ye bas</span></div>${html}<script>function kapat(){close();setTimeout(function(){history.length>1?history.back():0},300)}onload=function(){setTimeout(print,300)}<\/script></body></html>`);
  w.document.close();
}

const dosyaAdi = ek => {
  const e = oturumlar(secili)[0];
  const tr = x => x.replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u');
  return tr(`${e.s}_${e.topic.match(/^(.*?)\s+kurulu/i)?.[1] || 'sinav'}_${ek}`).replace(/[^A-Za-z0-9]+/g, '_') + '.docx';
};

async function kaydet() {
  const temiz = { ...taslak, oturumlar: taslak.oturumlar.map(o => ({ saat: o.saat, sorular: o.sorular.map(s => ({ metin: s.metin, puan: Number(String(s.puan).replace(',', '.')) || 0, cevap: s.cevap, prep: s.prep || '' })) })) };
  await F.setDoc(F.doc(db, 'sinavKagitlari', secili), { ...temiz, kaydeden: state.user.uid, kaydedenAd: state.profile?.ad || '', zaman: F.serverTimestamp() });
  degisti = false; toast('Kaydedildi'); render();
}

function onInput(e) {
  const t = e.target, k = t.dataset.k; if (!k || !taslak) return;
  const kart = t.closest('[data-s]');
  if (kart) {
    const s = taslak.oturumlar[+kart.dataset.o].sorular[+kart.dataset.s];
    if (k === 'prep') s.prep = prepBul(t.value); else s[k] = t.value;
  } else if (t.dataset.o !== undefined) taslak.oturumlar[+t.dataset.o][k] = t.value;
  else taslak[k] = t.value;
  if (!degisti) { degisti = true; const b = document.querySelector('[data-is="kaydet"]'); if (b) b.textContent = 'Kaydet •'; }
  ozetGuncelle();
}

async function onClick(e) {
  const b = e.target.closest('[data-is]'); if (!b) return;
  const is = b.dataset.is, kart = b.closest('[data-s]');
  try {
    if (kart) {
      const l = taslak.oturumlar[+kart.dataset.o].sorular, i = +kart.dataset.s;
      if (is === 'sil') l.splice(i, 1);
      else if (is === 'yukari' && i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]];
      else if (is === 'asagi' && i < l.length - 1) [l[i + 1], l[i]] = [l[i], l[i + 1]];
      degisti = true; render(); return;
    }
    if (is === 'ekle') { taslak.oturumlar[+b.dataset.o].sorular.push(yeniSoru()); degisti = true; render(); document.querySelectorAll(`[data-o="${b.dataset.o}"][data-s]`).item(taslak.oturumlar[+b.dataset.o].sorular.length - 1)?.querySelector('input')?.focus(); }
    else if (is === 'kopyala') { const oi = +b.dataset.o, diger = taslak.oturumlar.find((_, j) => j !== oi); taslak.oturumlar[oi].sorular = structuredClone(diger.sorular); degisti = true; render(); toast('Sorular kopyalandı; cevapları ve preparatları değiştirmeyi unutma'); }
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
      const kart = e.target.closest('[data-s]'), ta = kart.querySelector('[data-k=metin]');
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
