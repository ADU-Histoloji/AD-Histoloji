import { $, $$, esc } from './util.js';
import { ready, db, F } from './fb.js';

const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUN = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const KIND = { T: 'Teorik', U: 'Uygulama', S: 'Sınav' };
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addD(x, -((x.getDay() + 6) % 7)); };

const now = new Date(), todayIso = iso(now);
let thisWeek = monday(now); if (now.getDay() === 6 || now.getDay() === 0) thisWeek = addD(thisWeek, 7);
let wk = thisWeek, mon = new Date(wk.getFullYear(), wk.getMonth(), 1);
let EV = [], NO = [], loaded = false;
let f = 'all';
try { f = localStorage.getItem('hp-filter') || 'all'; } catch (e) { }

let linkedFn = () => '';
const evSubs = new Set();
export const onEvents = fn => { evSubs.add(fn); if (loaded) fn(EV); };
const emit = () => { if (loaded) evSubs.forEach(fn => fn(EV)); };
export const setLinked = fn => { linkedFn = fn; render(); };

const show = e => f === 'all' || (f === 'u' ? e.k === 'U' : f === 'dis' ? e.c === 'dis' : e.s === (f === 'd1' ? 'Tıp D1' : 'Tıp D2'));
const kcls = e => e.k === 'S' ? 'kS' : e.c === 'dis' ? (e.k === 'U' ? 'kDU' : 'kD') : 'k' + e.k;
const fmtR = (a, b) => a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${AY[a.getMonth()]} ${a.getFullYear()}` : `${a.getDate()} ${AY[a.getMonth()]} – ${b.getDate()} ${AY[b.getMonth()]} ${b.getFullYear()}`;

function renderMonth() {
  $('#mtitle').textContent = AY[mon.getMonth()] + ' ' + mon.getFullYear();
  const start = monday(mon), wkIso = iso(wk);
  let h = '<div class="mrow mdow">' + ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(x => `<span>${x}</span>`).join('') + '</div>';
  for (let r = 0; r < 6; r++) {
    const ws = addD(start, r * 7); if (r > 0 && ws.getMonth() !== mon.getMonth() && ws > mon) break;
    h += `<div class="mrow${iso(ws) === wkIso ? ' sel' : ''}">`;
    for (let c = 0; c < 7; c++) {
      const d = addD(ws, c), di = iso(d), evs = EV.filter(e => e.date === di && show(e));
      const kinds = [...new Set(evs.map(kcls))];
      h += `<button class="mday${d.getMonth() !== mon.getMonth() ? ' out' : ''}${di === todayIso ? ' tdy' : ''}" data-day="${di}" aria-label="${d.getDate()} ${AY[d.getMonth()]}, ${evs.length} ders"><span>${d.getDate()}</span><span class="dots">${kinds.map(k => `<i class="${k}"></i>`).join('')}</span></button>`;
    }
    h += '</div>';
  }
  $('#mgrid').innerHTML = h;
}

function renderWeek() {
  const end = addD(wk, 4);
  $('#wtitle').textContent = fmtR(wk, end);
  const diff = Math.round((wk - thisWeek) / 6048e5);
  $('#wsub').textContent = diff === 0 ? 'Bu hafta' : diff === 1 ? 'Gelecek hafta' : diff === -1 ? 'Geçen hafta' : diff > 0 ? diff + ' hafta sonra' : (-diff) + ' hafta önce';
  const days = GUN.map((g, i) => { const d = addD(wk, i), di = iso(d); return { g, d, di, ev: EV.filter(e => e.date === di).sort((a, b) => (a.t || '').localeCompare(b.t || '')) }; });
  const all = days.flatMap(d => d.ev).filter(show);
  $('#stats').innerHTML = `<span><b>${all.filter(e => e.k === 'T').length}</b>teorik</span><span><b>${all.filter(e => e.k === 'U').length}</b>uygulama</span><span><b>${all.filter(e => e.k === 'S').length}</b>sınav</span>`;
  const nos = NO.filter(n => n.week === iso(wk) && (f === 'all' || (f === 'u' ? n.k === 'U' : f === 'dis' ? false : n.s === (f === 'd1' ? 'Tıp D1' : 'Tıp D2'))));
  $('#notices').innerHTML = nos.map(n => `<div class="notice ${n.k === 'S' ? 'kS' : 'kU'}"><b>${esc(n.s)}:</b> ${esc(n.text)}</div>`).join('');
  if (!loaded) return;
  const seen = new Set();
  $('#week').innerHTML = days.map(d => {
    const ev = d.ev.filter(show), today = d.di === todayIso, nU = d.ev.filter(e => e.k === 'U').length;
    return `<div class="day${today ? ' is-today' : ''}">
      <div class="dh"><h2>${d.g}</h2><span class="date">${d.d.getDate()} ${AY[d.d.getMonth()]}</span>${today ? '<span class="tag">Bugün</span>' : ''}${nU >= 4 ? '<span class="tag" style="background:var(--d1)">Yoğun gün</span>' : ''}</div>
      ${ev.length ? ev.map(e => {
        const first = e.ders && !seen.has(e.ders); if (e.ders) seen.add(e.ders);
        return `<div class="ev ${kcls(e)}">
        <div class="time">${esc(e.t)}${e.e ? `<small>${esc(e.e)}</small>` : ''}</div>
        <div>
          <div class="meta"><span class="c">${esc(e.s)}</span><span class="kind">${KIND[e.k] || ''}</span>${e.g ? `<span class="grp">${esc(e.g)}${String(e.g).length === 1 ? ' grubu' : ''}</span>` : ''}</div>
          <div class="topic">${esc(e.topic)}</div>
          ${e.who || e.yer || e.note ? `<div class="who">${[e.who, e.yer, e.note].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
          ${e.prep ? `<div class="prep">${esc(e.prep)}</div>` : ''}
          ${e.warn ? `<div class="warn">${esc(e.warn)}</div>` : ''}
          ${first ? linkedFn(e.ders) : ''}
        </div></div>`;
      }).join('') : `<p class="empty">${d.ev.length ? 'Bu filtrede ders yok.' : 'Histoloji dersi yok.'}</p>`}
    </div>`;
  }).join('');
}

function render() { emit(); if (!$('#mgrid')) return; renderMonth(); renderWeek(); $$('.chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === f)); }
function goWeek(d) { wk = monday(d); const m = addD(wk, 2); mon = new Date(m.getFullYear(), m.getMonth(), 1); render(); }

export function initTakvim() {
  $('#wprev').addEventListener('click', () => goWeek(addD(wk, -7)));
  $('#wnext').addEventListener('click', () => goWeek(addD(wk, 7)));
  $('#today').addEventListener('click', () => goWeek(thisWeek));
  $('#mprev').addEventListener('click', () => { mon = new Date(mon.getFullYear(), mon.getMonth() - 1, 1); renderMonth(); });
  $('#mnext').addEventListener('click', () => { mon = new Date(mon.getFullYear(), mon.getMonth() + 1, 1); renderMonth(); });
  $('#mgrid').addEventListener('click', e => {
    const b = e.target.closest('[data-day]'); if (!b) return;
    const d = parse(b.dataset.day); wk = monday(d); render();
    const t = document.querySelector('.day:nth-child(' + Math.min(5, ((d.getDay() + 6) % 7) + 1) + ')');
    if (t && innerWidth < 1000) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  $$('.chip').forEach(b => b.addEventListener('click', () => { f = b.dataset.f; try { localStorage.setItem('hp-filter', f); } catch (e) { } render(); }));
  render();

  if (ready) {
    let gotE = false, gotN = false;
    // Veritabanında program yoksa uygulamayla gelen dosyadaki program gösterilir
    const done = () => { if (!(gotE && gotN)) return; if (!EV.length) loadStatic(); else { loaded = true; render(); } };
    F.onSnapshot(F.collection(db, 'events'), s => { EV = s.docs.map(d => ({ id: d.id, ...d.data() })); gotE = true; done(); },
      () => loadStatic());
    F.onSnapshot(F.collection(db, 'notices'), s => { NO = s.docs.map(d => ({ id: d.id, ...d.data() })); gotN = true; done(); },
      () => { gotN = true; done(); });
  } else loadStatic();
}

// Firestore boşsa ya da ayarlanmamışsa, programı uygulamayla gelen dosyadan gösterir
function loadStatic() {
  fetch('data/events.json').then(r => r.json()).then(j => { EV = j.events || []; NO = j.notices || []; loaded = true; render(); })
    .catch(() => { $('#week').innerHTML = '<p class="note">Program yüklenemedi. Sayfayı yenileyin.</p>'; });
}
export const rerenderTakvim = render;
