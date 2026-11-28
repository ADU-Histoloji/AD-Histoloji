// "Bugün" kartı: takvimin en üstünde kişinin bugünkü ve bir sonraki iş günündeki işleri.
// Anlatıcılık, sınav gözetmenliği, seminer (1 hafta içinde) ve uygulama katılım sorusu tek yerde.
import { $, esc, state, onState, toast, konuId } from './util.js';
import { ready, db, F } from './fb.js';
import { anlaticiKaydi, onAnlaticiDegis } from './anlatici.js';
import { gozetmenliSinav, kanonik, atananlar, gruplar, onGozetmenDegis, oturumMetni, gozetmenFormu } from './gozetmen.js';
import { konuFormu, bosKonu } from './takvim.js';

const GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
// Bugün ve bir sonraki iş günü (Cuma'dan sonra Pazartesi)
function gunler() {
  const b = new Date(), s = new Date(b); s.setDate(b.getDate() + 1);
  while (s.getDay() === 0 || s.getDay() === 6) s.setDate(s.getDate() + 1);
  return [iso(b), iso(s)];
}
const gunAdi = g => { const [b, s] = gunler(); if (g === b) return 'Bugün'; const d = parse(g); const yarin = new Date(); yarin.setDate(yarin.getDate() + 1); return g === iso(yarin) ? 'Yarın' : GUN[d.getDay()]; };

let EV = [], katilim = null, katGun = null, unsubK = null;

function katilimDinle(gun) {
  if (gun === katGun) return;
  if (unsubK) { unsubK(); unsubK = null; }
  katGun = gun; katilim = null;
  if (!gun || !ready || !state.approved) return;
  unsubK = F.onSnapshot(F.doc(db, 'katilim', gun, 'kisiler', state.user.uid), d => { katilim = d.exists() ? d.data() : {}; render(); }, () => { });
}

function render() {
  const el = $('#bugun'); if (!el) return;
  if (!ready || !state.approved || !state.user) { el.innerHTML = ''; return; }
  const ben = state.user.uid, [bg, sg] = gunler(), yakin = [bg, sg];
  const satir = [];
  // Anlatıcılık
  const anl = new Map();
  EV.filter(e => e.k === 'U' && yakin.includes(e.date) && anlaticiKaydi(e.s, e.topic)?.uid === ben).forEach(e => {
    const k = e.date + konuId(e.s, e.topic); if (!anl.has(k)) anl.set(k, []); anl.get(k).push(e);
  });
  [...anl.values()].forEach(ots => { const e = ots[0]; satir.push({ g: e.date, t: e.t, html: `🔬 <b>${gunAdi(e.date)} ${esc(e.t)}</b> anlatıcısın · ${esc(e.topic)}<span class="note"> · ${esc(e.s)}${ots.some(o => o.g) ? ' · ' + esc(ots.map(o => o.g).filter(Boolean).join(', ')) : ''}</span>` }); });
  // Sınav gözetmenliği
  const gorulen = new Set();
  EV.filter(e => gozetmenliSinav(e) && yakin.includes(e.date)).forEach(e => {
    const k = kanonik(e.id); if (gorulen.has(k)) return; gorulen.add(k);
    const a = atananlar(k).find(x => x.uid === ben); if (!a) return;
    const h = gruplar(k)[a.grup]?.hoca;
    satir.push({ g: e.date, t: e.t, html: `📝 <b>${gunAdi(e.date)} ${esc(oturumMetni(k))}</b> sınav gözetmenliği${h ? ' · ' + esc(h) + ' grubu' : ''} <button class="linkbtn" data-bgz="${esc(k)}">Ayrıntı</button>` });
  });
  // Seminer: 1 hafta içinde
  const hafta = iso(new Date(Date.now() + 7 * 864e5));
  EV.filter(e => e.k === 'M' && e.uid === ben && e.date >= bg && e.date <= hafta).forEach(e => {
    satir.push({ g: e.date, t: e.t, html: `🎤 <b>${gunAdi(e.date)} ${esc(e.t)}</b> seminerin var${bosKonu(e.topic) ? ' · <span class="warn">konunu henüz yazmadın</span>' : ' · ' + esc(e.topic)} <button class="linkbtn" data-bkonu="${esc(e.id)}">${bosKonu(e.topic) ? 'Konunu yaz' : 'Düzenle'}</button>` });
  });
  satir.sort((a, b) => (a.g + a.t).localeCompare(b.g + b.t));
  // Uygulama katılım sorusu: bir sonraki iş gününde uygulama varsa
  const uyg = EV.filter(e => e.k === 'U' && e.date === sg);
  katilimDinle(uyg.length ? sg : null);
  let soru = '';
  if (uyg.length && state.profile?.masa) {
    const d = katilim?.durum;
    soru = `<div class="bg-soru"><span>🔬 <b>${gunAdi(sg)}</b> uygulama var (${[...new Set(uyg.map(e => e.s))].map(esc).join(', ')}). Katılacak mısın? <span class="note">Masa ${esc(katilim?.masa ?? state.profile.masa)}</span></span>
      <span class="acts"><button class="btn${d === 'evet' ? '' : ' sec'} kucuk" data-bkat="evet">${d === 'evet' ? '✓ ' : ''}Katılacağım</button><button class="btn${d === 'hayir' ? '' : ' sec'} kucuk" data-bkat="hayir">${d === 'hayir' ? '✓ ' : ''}Katılmayacağım</button></span></div>`;
  }
  // Bu hafta seminer (herkes için bilgi)
  const sem = EV.find(e => e.k === 'M' && e.uid !== ben && e.date >= bg && e.date <= iso(new Date(Date.now() + 6 * 864e5)));
  el.innerHTML = `<div class="bugun">
    <div class="bg-bas"><h3>${GUN[new Date().getDay()]}, ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</h3>${state.profile?.masa ? `<span class="pill">Masa ${esc(state.profile.masa)}</span>` : '<a class="pill wait" href="#profil">Masanı seç</a>'}</div>
    ${satir.length ? `<ul>${satir.map(s => `<li>${s.html}</li>`).join('')}</ul>` : `<p class="note" style="margin:4px 0">${GUN[parse(sg).getDay()]} gününe kadar sana ait bir görev yok.</p>`}
    ${soru}
    ${sem ? `<p class="note" style="margin:6px 0 0">🎤 ${gunAdi(sem.date)} ${esc(sem.t)} seminer: ${esc(sem.who || '')}${bosKonu(sem.topic) ? '' : ' · ' + esc(sem.topic)}</p>` : ''}
  </div>`;
}

export function initBugun(onEventsFn) {
  const el = $('#bugun'); if (!el) return;
  onEventsFn(ev => { EV = ev; render(); });
  onAnlaticiDegis(render); onGozetmenDegis(render); onState(render);
  el.addEventListener('click', async e => {
    const gz = e.target.closest('[data-bgz]'); if (gz) return gozetmenFormu(gz.dataset.bgz);
    const kn = e.target.closest('[data-bkonu]'); if (kn) { const ev = EV.find(x => x.id === kn.dataset.bkonu); if (ev) konuFormu(ev); return; }
    const kt = e.target.closest('[data-bkat]'); if (!kt || !katGun) return;
    try {
      await F.setDoc(F.doc(db, 'katilim', katGun, 'kisiler', state.user.uid), { durum: kt.dataset.bkat, masa: kt.dataset.bkat === 'hayir' ? null : (katilim?.masa ?? null), t: F.serverTimestamp() });
      toast(kt.dataset.bkat === 'evet' ? 'Katılacağın kaydedildi' : 'Katılmayacağın kaydedildi');
    } catch (x) { console.error(x); toast('Kaydedilemedi'); }
  });
}
