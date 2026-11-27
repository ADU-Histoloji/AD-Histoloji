import { $, $$, esc, state, onState, sheet, closeSheet, toast } from './util.js';
import { ready, db, F } from './fb.js';

const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUN = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const KIND = { T: 'Teorik', U: 'Uygulama', S: 'Sınav', M: 'Seminer' };
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
let fromDb = false;
const duzenle = () => ready && fromDb && state.admin;
const evSubs = new Set();
export const onEvents = fn => { evSubs.add(fn); if (loaded) fn(EV); };
const emit = () => { if (loaded) evSubs.forEach(fn => fn(EV)); };
export const setLinked = fn => { linkedFn = fn; render(); };

const show = e => f === 'all' || (f === 'u' ? e.k === 'U' : f === 'dis' ? e.c === 'dis' : e.s === (f === 'd1' ? 'Tıp D1' : 'Tıp D2'));
const kcls = e => e.k === 'M' ? 'kM' : e.k === 'S' ? 'kS' : e.c === 'dis' ? (e.k === 'U' ? 'kDU' : 'kD') : 'k' + e.k;
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
  $('#stats').innerHTML = `<span><b>${all.filter(e => e.k === 'T').length}</b>teorik</span><span><b>${all.filter(e => e.k === 'U').length}</b>uygulama</span><span><b>${all.filter(e => e.k === 'S').length}</b>sınav</span>${all.some(e => e.k === 'M') ? '<span><b>1</b>seminer</span>' : ''}`;
  const nos = NO.filter(n => n.week === iso(wk) && (f === 'all' || (f === 'u' ? n.k === 'U' : f === 'dis' ? false : n.s === (f === 'd1' ? 'Tıp D1' : 'Tıp D2'))));
  $('#notices').innerHTML = nos.map(n => `<div class="notice ${n.k === 'S' ? 'kS' : 'kU'}"><b>${esc(n.s)}:</b> ${esc(n.text)}</div>`).join('');
  if (!loaded) return;
  const seen = new Set();
  $('#week').innerHTML = days.map(d => {
    const ev = d.ev.filter(show), today = d.di === todayIso, nU = d.ev.filter(e => e.k === 'U').length;
    return `<div class="day${today ? ' is-today' : ''}">
      <div class="dh"><h2>${d.g}</h2><span class="date">${d.d.getDate()} ${AY[d.d.getMonth()]}</span>${today ? '<span class="tag">Bugün</span>' : ''}${nU >= 4 ? '<span class="tag" style="background:var(--d1)">Yoğun gün</span>' : ''}${duzenle() ? `<button class="linkbtn" data-ekle="${d.di}" style="margin-left:auto">+ Ders</button>` : ''}</div>
      ${ev.length ? ev.map(e => {
        const first = e.ders && !seen.has(e.ders); if (e.ders) seen.add(e.ders);
        return `<div class="ev ${kcls(e)}">
        <div class="time">${esc(e.t)}${e.e ? `<small>${esc(e.e)}</small>` : ''}</div>
        <div>
          <div class="meta"><span class="c">${esc(e.s)}</span>${e.k === 'M' && e.s === 'Seminer' ? '' : `<span class="kind">${KIND[e.k] || ''}</span>`}${e.g ? `<span class="grp">${esc(e.g)}${String(e.g).length === 1 ? ' grubu' : ''}</span>` : ''}</div>
          <div class="topic">${esc(e.topic)}</div>
          ${e.who || e.yer || e.note ? `<div class="who">${[e.who, e.yer, e.note].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
          ${e.prep ? `<div class="prep">${esc(e.prep)}</div>` : ''}
          ${e.warn ? `<div class="warn">${esc(e.warn)}</div>` : ''}
          ${first ? linkedFn(e.ders) : ''}
          ${duzenle() && e.id ? `<button class="linkbtn" data-duzenle="${esc(e.id)}">Düzenle</button>` : ''}
          ${!state.admin && fromDb && e.k === 'M' && e.id && e.uid && e.uid === state.user?.uid ? `<button class="linkbtn" data-konu="${esc(e.id)}">${bosKonu(e.topic) ? 'Konunu yaz' : 'Konunu düzenle'}</button>` : ''}
        </div></div>`;
      }).join('') : `<p class="empty">${d.ev.length ? 'Bu filtrede ders yok.' : 'Histoloji dersi yok.'}</p>`}
    </div>`;
  }).join('');
}

function render() { emit(); if (!$('#mgrid')) return; renderMonth(); renderWeek(); $$('.chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === f)); }
function goWeek(d) { wk = monday(d); const m = addD(wk, 2); mon = new Date(m.getFullYear(), m.getMonth(), 1); render(); }


/* ---------- Seminer sunan kişinin kendi konusunu yazması ---------- */
export const bosKonu = t => !t || /henüz belirlenmedi/i.test(t);
export function konuFormu(ev) {
  sheet(`<div class="sh"><div><div class="date">Seminer · ${esc(ev.date.split('-').reverse().join('.'))} ${esc(ev.t)}</div><h3>Seminer konun</h3></div><button class="x" type="button" aria-label="Kapat">×</button></div>
  <form id="kf">
    <label for="k-konu">Konu başlığı</label>
    <textarea id="k-konu" maxlength="200" required placeholder="Doku ve organlar neden kıvrılır?">${esc(bosKonu(ev.topic) ? '' : ev.topic)}</textarea>
    <p class="note">Takvimde ve pazartesi bildiriminde bu başlık görünecek.</p>
    <p class="err" id="k-msg"></p>
    <div class="acts"><button class="btn" type="submit">Kaydet</button><button class="btn sec" data-close type="button">Vazgeç</button></div>
  </form>`);
  $('#kf').addEventListener('submit', async e => {
    e.preventDefault();
    const topic = $('#k-konu').value.trim().replace(/\s+/g, ' ');
    if (topic.length < 3) { $('#k-msg').textContent = 'Konu başlığını yaz.'; return; }
    try { await F.updateDoc(F.doc(db, 'events', ev.id), { topic }); closeSheet(); toast('Seminer konun kaydedildi'); }
    catch (x) { console.error(x); $('#k-msg').textContent = 'Kaydedilemedi. Bu seminer senin hesabınla eşleştirilmemiş olabilir; bir yöneticiye haber ver.'; }
  });
}
export const etkinlikler = () => EV;

/* ---------- Yöneticiler için ders ekleme/düzenleme ---------- */
const SINIF = ['Tıp D1', 'Tıp D2', 'Diş D1', 'Diş D2', 'Diş D3', 'Seminer'];
function dersFormu(ev, tarih) {
  const yeni = !ev;
  ev = ev || { s: 'Tıp D1', k: 'T', date: tarih, t: '08:30', e: '10:15', topic: '', who: '', g: '', yer: '', note: '', prep: '', warn: '' };
  const v = k => esc(ev[k] ?? '');
  sheet(`<div class="sh"><h3>${yeni ? 'Ders ekle' : 'Dersi düzenle'}</h3><button class="x" type="button" aria-label="Kapat">×</button></div>
  <form id="df">
    <div class="row">
      <div><label for="d-s">Sınıf</label><select id="d-s">${SINIF.map(x => `<option${x === ev.s ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
      <div><label for="d-k">Tür</label><select id="d-k">${[['T', 'Teorik'], ['U', 'Uygulama'], ['S', 'Sınav'], ['M', 'Seminer']].map(([k, l]) => `<option value="${k}"${k === ev.k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label for="d-g">Grup</label><input id="d-g" value="${v('g')}" placeholder="A"></div>
    </div>
    <div class="row">
      <div><label for="d-date">Tarih</label><input id="d-date" type="date" required value="${v('date')}"></div>
      <div><label for="d-t">Başlangıç</label><input id="d-t" type="time" required value="${v('t')}"></div>
      <div><label for="d-e">Bitiş</label><input id="d-e" type="time" value="${v('e')}"></div>
    </div>
    <div class="row"><div><label for="d-topic">Konu</label><input id="d-topic" required value="${v('topic')}"></div></div>
    <div class="row"><div><label for="d-who">Öğretim üyesi</label><input id="d-who" value="${v('who')}"></div><div><label for="d-yer">Yer</label><input id="d-yer" value="${v('yer')}" placeholder="Derslik-4"></div></div>
    <label for="d-note">Not</label><input id="d-note" value="${v('note')}">
    <label for="d-prep" style="margin-top:10px">Hazırlık notu</label><input id="d-prep" value="${v('prep')}">
    <label for="d-warn" style="margin-top:10px">Uyarı</label><input id="d-warn" value="${v('warn')}">
    <p class="err" id="d-msg"></p>
    <div class="acts"><button class="btn" type="submit">Kaydet</button><button class="btn sec" data-close type="button">Vazgeç</button>${yeni ? '' : '<button class="btn del" type="button" id="d-del">Sil</button>'}</div>
  </form>`);
  $('#df').addEventListener('submit', async e => {
    e.preventDefault();
    const s = $('#d-s').value, body = { s, c: s === 'Seminer' ? 'seminer' : s.startsWith('Diş') ? 'dis' : 'tip', k: $('#d-k').value, date: $('#d-date').value, t: $('#d-t').value, e: $('#d-e').value, topic: $('#d-topic').value.trim() };
    for (const k of ['who', 'g', 'yer', 'note', 'prep', 'warn']) { const x = $('#d-' + k).value.trim(); if (x) body[k] = x; }
    if (!yeni && ev.ders) body.ders = ev.ders;
    if (!yeni && ev.uid && body.k === 'M') body.uid = ev.uid;
    try {
      if (yeni) await F.addDoc(F.collection(db, 'events'), body); else await F.setDoc(F.doc(db, 'events', ev.id), body);
      closeSheet(); toast('Kaydedildi'); goWeek(parse(body.date));
    } catch (x) { $('#d-msg').textContent = 'Kaydedilemedi. Yönetici olarak giriş yaptığından emin ol.'; }
  });
  const del = $('#d-del');
  if (del) del.addEventListener('click', async () => {
    if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Emin misin? Tekrar bas'; return; }
    try { await F.deleteDoc(F.doc(db, 'events', ev.id)); closeSheet(); toast('Silindi'); } catch (x) { $('#d-msg').textContent = 'Silinemedi.'; }
  });
}

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
  $('#week').addEventListener('click', e => {
    const b = e.target.closest('[data-duzenle],[data-ekle],[data-konu]'); if (!b) return;
    if (b.dataset.konu) return konuFormu(EV.find(x => x.id === b.dataset.konu));
    if (b.dataset.ekle) dersFormu(null, b.dataset.ekle); else dersFormu(EV.find(x => x.id === b.dataset.duzenle));
  });
  onState(() => render());
  $$('.chip').forEach(b => b.addEventListener('click', () => { f = b.dataset.f; try { localStorage.setItem('hp-filter', f); } catch (e) { } render(); }));
  render();

  if (ready) {
    let gotE = false, gotN = false;
    // Veritabanında program yoksa uygulamayla gelen dosyadaki program gösterilir
    const done = () => { if (!(gotE && gotN)) return; if (!EV.length) loadStatic(); else { loaded = true; fromDb = true; render(); } };
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
