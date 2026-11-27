import { $, esc, state, onState, toast } from './util.js';
import { ready, db, F } from './fb.js';
import { onEvents, setAnlatici } from './takvim.js';

export const MASA_SAYISI = 8;
export const MASA_KAP = 2; // her masada en fazla 2 kişi
const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// Bir uygulama konusunun anlatıcı kaydı için kimlik: "Tıp D2|Solunum..." → "tip-d2-solunum-..."
export const konuId = (s, topic) => (s + '-' + topic).toLocaleLowerCase('tr')
  .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);

let EV = [], gunler = [], gun = null;
let users = [], anlatici = {}, katilim = {};
let unsubK = null, unsubU = null, unsubM = null;

const ad = uid => users.find(u => u.id === uid)?.ad || '';
const kisaAd = a => { const p = String(a).split(' '); return p.length > 1 ? p[0] + ' ' + p[p.length - 1][0] + '.' : a; };
const etkinMasa = u => { const k = katilim[u.id]; return k?.masa ?? u.masa ?? null; };

function gunSec(d) {
  gun = d;
  if (unsubK) { unsubK(); unsubK = null; }
  katilim = {};
  if (ready && state.approved && gun) {
    unsubK = F.onSnapshot(F.collection(db, 'katilim', gun, 'kisiler'), s => {
      katilim = {}; s.docs.forEach(x => { katilim[x.id] = x.data(); }); render();
    }, () => { });
  }
  render();
}

function oturumlar() {
  // Günün uygulamalarını konu bazında grupla
  const ev = EV.filter(e => e.date === gun && e.k === 'U').sort((a, b) => (a.t || '').localeCompare(b.t || ''));
  const m = new Map();
  ev.forEach(e => {
    const id = konuId(e.s, e.topic);
    if (!m.has(id)) m.set(id, { id, s: e.s, c: e.c, topic: e.topic, who: e.who, saatler: [] });
    m.get(id).saatler.push(e.t + (e.g ? ' ' + e.g : ''));
  });
  return [...m.values()];
}

function masaHtml(n) {
  const cap = MASA_KAP;
  const sabit = users.filter(u => Number(u.masa) === n);
  const burada = users.filter(u => Number(etkinMasa(u)) === n && katilim[u.id]?.durum !== 'hayir');
  const gelmeyen = sabit.filter(u => katilim[u.id]?.durum === 'hayir');
  const bos = cap - burada.length;
  const me = katilim[state.user?.uid];
  const benimMasam = Number(etkinMasa(users.find(u => u.id === state.user?.uid) || {})) === n;
  const kisi = u => {
    const d = katilim[u.id]?.durum;
    const tasindi = katilim[u.id]?.masa != null && Number(u.masa) !== n;
    return `<div class="${d === 'evet' ? 'ok' : 'mute'}">${esc(kisaAd(u.ad))}${d ? '' : ' · cevap yok'}${tasindi ? ' · bugün buraya geçti' : ''}</div>`;
  };
  const cls = burada.some(u => katilim[u.id]?.durum === 'evet') ? 'dolu' : burada.length ? 'bekliyor' : 'bos';
  return `<div class="masa ${cls}">
    <div class="mno">Masa ${n}</div>
    ${burada.map(kisi).join('')}
    ${gelmeyen.map(u => `<div class="mute"><s>${esc(kisaAd(u.ad))}</s> gelemiyor</div>`).join('')}
    ${bos > 0 && !burada.length && !gelmeyen.length ? '<div class="mute">Boş</div>' : ''}
    ${bos > 0 && me?.durum === 'evet' && !benimMasam ? `<button class="linkbtn" data-gec="${n}">Bu masaya geç</button>` : ''}
  </div>`;
}

function render() {
  const el = $('#v-uygulama'); if (!el) return;
  if (!gunler.length) { el.innerHTML = '<p class="note">Programda uygulama günü bulunamadı.</p>'; return; }
  const i = gunler.indexOf(gun), d = parse(gun);
  const ots = oturumlar();
  let h = `<div class="whead" style="margin:6px 0 10px">
      <button class="nav" id="u-prev" aria-label="Önceki uygulama günü"${i <= 0 ? ' disabled' : ''}>‹</button>
      <div><h2>${GUN[d.getDay()]}, ${d.getDate()} ${AY[d.getMonth()]}</h2><div class="date">${iso(new Date()) === gun ? 'Bugün' : ''}</div></div>
      <button class="nav" id="u-next" aria-label="Sonraki uygulama günü"${i >= gunler.length - 1 ? ' disabled' : ''}>›</button>
    </div>`;
  h += ots.map(o => {
    const a = anlatici[o.id];
    const aAd = (a?.uid && ad(a.uid)) || a?.ad || '';
    const aDurum = a?.uid && state.approved ? katilim[a.uid]?.durum : null;
    return `<div class="ev ${o.c === 'dis' ? 'kDU' : 'kU'}" style="grid-template-columns:minmax(0,1fr)">
      <div><div class="meta"><span class="c">${esc(o.s)}</span><span class="kind">Uygulama</span></div>
      <div class="topic">${esc(o.topic)}</div>
      <div class="who">${o.saatler.map(esc).join(' · ')}${o.who ? ' · Öğretim üyesi: ' + esc(o.who) : ''}</div>
      <div class="anl">${aAd ? `Anlatıcı: <b>${esc(aAd)}</b>${aDurum === 'hayir' ? ' <span class="pill wait">gelemiyor</span>' : aDurum === 'evet' ? ' <span class="pill">onayladı</span>' : ''}` : '<span class="mute">Anlatıcı belirlenmedi</span>'}</div></div>
    </div>`;
  }).join('');
  if (!ready) { el.innerHTML = h; return; }
  if (!state.user) { el.innerHTML = h + '<div class="banner">Masaları görmek ve katılımını bildirmek için <a href="#profil">giriş yap</a>.</div>'; return; }
  if (!state.approved) { el.innerHTML = h + '<div class="banner">Hesabın onaylandığında masaları görebileceksin.</div>'; return; }
  const me = katilim[state.user.uid], ben = users.find(u => u.id === state.user.uid);
  const evet = users.filter(u => katilim[u.id]?.durum === 'evet').length, hayir = users.filter(u => katilim[u.id]?.durum === 'hayir').length;
  const masasiz = users.filter(u => etkinMasa(u) == null && katilim[u.id]?.durum !== 'hayir');
  h += `<div class="katil">
      <div><b>Bu güne katılıyor musun?</b> <span class="note">${me?.durum === 'evet' ? 'Katılıyorum dedin.' : me?.durum === 'hayir' ? 'Katılamıyorum dedin.' : 'Henüz cevap vermedin.'}</span></div>
      <div class="acts" style="margin:8px 0 0">
        <button class="btn${me?.durum === 'evet' ? '' : ' sec'}" data-durum="evet">Katılıyorum</button>
        <button class="btn${me?.durum === 'hayir' ? ' del' : ' sec'}" data-durum="hayir">Katılamıyorum</button>
        ${me?.masa != null ? '<button class="btn sec" data-gec="kendi">Kendi masama dön</button>' : ''}
      </div>
      ${ben?.masa == null ? '<p class="note">Sabit bir masan yok. Katılıyorsan aşağıdan boş bir masa seç.</p>' : ''}
    </div>
    <div class="stats"><span><b>${evet}</b>katılıyor</span><span><b>${hayir}</b>gelemiyor</span><span><b>${users.length - evet - hayir}</b>cevap vermedi</span></div>
    <div class="masalar">${Array.from({ length: MASA_SAYISI }, (_, k) => masaHtml(k + 1)).join('')}</div>
    ${masasiz.length ? `<p class="note">Masası olmayanlar: ${masasiz.map(u => esc(kisaAd(u.ad)) + (katilim[u.id]?.durum ? '' : ' (cevap yok)')).join(', ')}</p>` : ''}`;
  el.innerHTML = h;
}

async function yaz(patch) {
  const uid = state.user.uid, eski = katilim[uid] || {};
  const body = { durum: patch.durum ?? eski.durum ?? 'evet', masa: 'masa' in patch ? patch.masa : (eski.masa ?? null), t: F.serverTimestamp() };
  if (body.durum === 'hayir') body.masa = null;
  try { await F.setDoc(F.doc(db, 'katilim', gun, 'kisiler', uid), body); }
  catch (x) { console.error(x); toast('Kaydedilemedi'); }
}

function onClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'u-prev') return gunSec(gunler[Math.max(0, gunler.indexOf(gun) - 1)]);
  if (b.id === 'u-next') return gunSec(gunler[Math.min(gunler.length - 1, gunler.indexOf(gun) + 1)]);
  if (b.dataset.durum) return yaz({ durum: b.dataset.durum });
  if (b.dataset.gec) {
    const n = b.dataset.gec === 'kendi' ? null : Number(b.dataset.gec);
    const ben = users.find(u => u.id === state.user.uid);
    return yaz({ durum: 'evet', masa: n != null && Number(ben?.masa) === n ? null : n });
  }
}

// Bildirimdeki "Katılıyorum / Katılamıyorum" düğmesinden gelen cevap (adres: ?katil=evet&gun=2026-12-03)
const bekleyen = (() => {
  const q = new URLSearchParams(location.search), k = q.get('katil'), g = q.get('gun');
  return (k === 'evet' || k === 'hayir') && /^\d{4}-\d{2}-\d{2}$/.test(g || '') ? { durum: k, gun: g } : null;
})();
let bekleyenIslendi = false;
async function bekleyeniIsle() {
  if (!bekleyen || bekleyenIslendi || !state.approved) return;
  bekleyenIslendi = true;
  history.replaceState(null, '', location.pathname + '#uygulama');
  try {
    const ref = F.doc(db, 'katilim', bekleyen.gun, 'kisiler', state.user.uid);
    const eski = await F.getDoc(ref).catch(() => null);
    const masa = bekleyen.durum === 'hayir' ? null : (eski?.exists() ? eski.data().masa ?? null : null);
    await F.setDoc(ref, { durum: bekleyen.durum, masa, t: F.serverTimestamp() });
    toast(bekleyen.durum === 'evet' ? 'Katılacağın kaydedildi' : 'Katılamayacağın kaydedildi');
    if (gunler.includes(bekleyen.gun)) gunSec(bekleyen.gun);
  } catch (x) { console.error(x); toast('Cevabın kaydedilemedi, buradan tekrar dene'); }
}

export function initUygulamalar() {
  $('#v-uygulama').addEventListener('click', onClick);
  onEvents(ev => {
    EV = ev;
    gunler = [...new Set(ev.filter(e => e.k === 'U').map(e => e.date))].sort();
    if (!gun || !gunler.includes(gun)) {
      const bugun = iso(new Date());
      gunSec(gunler.find(g => g >= bugun) || gunler[gunler.length - 1] || null);
    } else render();
  });
  if (ready) F.onSnapshot(F.collection(db, 'anlaticilar'), s => { anlatici = {}; s.docs.forEach(x => { anlatici[x.id] = x.data(); }); setAnlatici(e => anlatici[konuId(e.s, e.topic)]?.ad || ''); render(); }, () => { });
  onState(s => {
    if (ready && s.approved && !unsubU) {
      unsubU = F.onSnapshot(F.collection(db, 'users'), q => { users = q.docs.map(x => ({ id: x.id, ...x.data() })).filter(u => u.onayli); render(); }, () => { });
      gunSec(gun);
    }
    if (s.approved) bekleyeniIsle();
    if (!s.approved && unsubU) { unsubU(); unsubU = null; unsubM && unsubM(); unsubM = null; users = []; gunSec(gun); }
    render();
  });
}
