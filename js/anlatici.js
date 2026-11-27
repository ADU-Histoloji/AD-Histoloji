// Uygulama anlatıcısı seçimi: asistan boş bir konuya "Anlatıcı ol" der ya da kendi konusunu bırakır;
// yönetici herhangi bir konuya anlatıcı atar ya da değiştirir. Takvim ve Masalar ekranı ortak kullanır.
import { esc, state, onState, toast, sheet, closeSheet, konuId, $ } from './util.js';
import { ready, db, F } from './fb.js';

let kayit = {}, kisiler = [], unsubU = null;
const dinleyiciler = new Set();
const haber = () => dinleyiciler.forEach(fn => fn());
export const onAnlaticiDegis = fn => dinleyiciler.add(fn);
export const anlaticiKaydi = (s, topic) => kayit[konuId(s, topic)] || null;

const bugun = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const veri = e => `data-s="${esc(e.s)}" data-topic="${esc(e.topic)}"`;

// Bir uygulama kartının altına konacak düğmeler
export function anlaticiDugmeleri(e) {
  if (!ready || !state.approved || !e.date || e.date < bugun()) return '';
  const a = anlaticiKaydi(e.s, e.topic), ben = state.user.uid;
  const d = [];
  if (!a?.uid && !a?.ad) d.push(`<button class="btn sec kucuk" data-anl="ol" ${veri(e)}>🎤 Anlatıcı ol</button>`);
  else if (a.uid === ben) d.push(`<button class="linkbtn" data-anl="birak" ${veri(e)}>Anlatıcılığı bırak</button>`);
  if (state.admin) d.push(`<button class="linkbtn" data-anl="ata" ${veri(e)}>${a?.uid || a?.ad ? 'Anlatıcıyı değiştir' : 'Anlatıcı ata'}</button>`);
  return d.length ? `<div class="anl-b">${d.join('')}</div>` : '';
}

async function ata(s, topic, uid) {
  const id = konuId(s, topic);
  if (!uid) return F.deleteDoc(F.doc(db, 'anlaticilar', id));
  const ad = uid === state.user.uid ? state.profile?.ad : kisiler.find(u => u.id === uid)?.ad;
  return F.setDoc(F.doc(db, 'anlaticilar', id), { s, topic, ad: ad || '', uid });
}

function ataFormu(s, topic) {
  const a = anlaticiKaydi(s, topic);
  sheet(`<div class="sh"><div><div class="date">${esc(s)} · Uygulama</div><h3>${esc(topic)}</h3></div><button class="x" type="button" aria-label="Kapat">×</button></div>
  <form id="anf">
    <label for="an-k">Anlatıcı</label>
    <select id="an-k"><option value="">Belirlenmedi</option>${kisiler.filter(u => u.onayli).sort((x, y) => x.ad.localeCompare(y.ad, 'tr')).map(u => `<option value="${esc(u.id)}"${a?.uid === u.id ? ' selected' : ''}>${esc(u.ad)}</option>`).join('')}</select>
    <p class="note">Anlatıcı bu konunun bütün gruplarında geçerlidir ve uygulamadan bir gün önce bildirim alır.</p>
    <div class="acts"><button class="btn" type="submit">Kaydet</button><button class="btn sec" data-close type="button">Vazgeç</button></div>
  </form>`);
  $('#anf').addEventListener('submit', async ev => {
    ev.preventDefault();
    try { await ata(s, topic, $('#an-k').value); closeSheet(); toast('Anlatıcı kaydedildi'); }
    catch (x) { console.error(x); toast('Kaydedilemedi'); }
  });
}

// Takvim ve Masalar ekranının tıklama dinleyicisinden çağrılır; düğme bu modülünse true döner
export async function anlaticiTikla(hedef) {
  const b = hedef.closest?.('[data-anl]'); if (!b) return false;
  const { s, topic } = b.dataset;
  try {
    if (b.dataset.anl === 'ata') ataFormu(s, topic);
    else if (b.dataset.anl === 'ol') {
      await ata(s, topic, state.user.uid);
      toast('Anlatıcı oldun · konunun bütün gruplarında geçerli');
    } else if (b.dataset.anl === 'birak') {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Emin misin? Tekrar bas'; return true; }
      await ata(s, topic, null); toast('Anlatıcılığı bıraktın');
    }
  } catch (x) { console.error(x); toast('Kaydedilemedi. Başka biri az önce almış olabilir.'); }
  return true;
}

export function initAnlatici() {
  if (!ready) return;
  F.onSnapshot(F.collection(db, 'anlaticilar'), q => { kayit = {}; q.docs.forEach(d => { kayit[d.id] = d.data(); }); haber(); }, () => { });
  onState(s => {
    if (s.approved && !unsubU) unsubU = F.onSnapshot(F.collection(db, 'users'), q => { kisiler = q.docs.map(d => ({ id: d.id, ...d.data() })); }, () => { });
    if (!s.approved && unsubU) { unsubU(); unsubU = null; kisiler = []; }
  });
}
