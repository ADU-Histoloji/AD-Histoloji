import { $, esc, state, onState, toast, sha256 } from './util.js';
import { ready, db, F } from './fb.js';

let users = [], unsub = null, eventCount = null;

function render() {
  const el = $('#v-yonetim');
  if (!state.admin) { el.innerHTML = '<div class="banner">Bu bölüm sadece yöneticiler içindir.</div>'; return; }
  const wait = users.filter(u => !u.onayli), ok = users.filter(u => u.onayli).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  el.innerHTML = `
    <div class="card" style="max-width:none"><h3>Onay bekleyenler</h3>
      ${wait.length ? `<div class="list">${wait.map(u => `<div class="li"><span class="nm">${esc(u.ad)}</span><span><button class="btn" data-onay="${esc(u.id)}">Onayla</button> <button class="btn del" data-sil="${esc(u.id)}">Reddet</button></span></div>`).join('')}</div>` : '<p class="note">Onay bekleyen kayıt yok.</p>'}
    </div>
    <div class="card" style="max-width:none"><h3>Kişiler</h3>
      <p class="note">Masa no ve seminer sırasını buradan atayın. PIN'ini unutan kişi için "Kaydı sıfırla" deyin; kişi aynı adla yeniden kayıt olur.</p>
      <div class="list">${ok.map(u => `<div class="li" data-u="${esc(u.id)}">
        <span class="nm" style="flex:1 1 12em">${esc(u.ad)} ${u.rol === 'yonetici' ? '<span class="pill">Yönetici</span>' : ''}</span>
        <label style="margin:0">Masa <input data-f="masa" value="${esc(u.masa ?? '')}" inputmode="numeric" style="width:5em;min-height:40px"></label>
        <label style="margin:0">Seminer sırası <input data-f="seminerSira" value="${esc(u.seminerSira ?? '')}" inputmode="numeric" style="width:5em;min-height:40px"></label>
        <span>
          <button class="btn sec" data-kaydet>Kaydet</button>
          ${u.id === state.user.uid ? '' : `<button class="btn sec" data-rol="${u.rol === 'yonetici' ? 'asistan' : 'yonetici'}">${u.rol === 'yonetici' ? 'Yöneticilikten al' : 'Yönetici yap'}</button>
          <button class="btn del" data-sil="${esc(u.id)}">Kaydı sıfırla</button>`}
        </span></div>`).join('')}</div>
    </div>
    <form class="card" id="f-kod"><h3>Bölüm kodu</h3>
      <p class="note">Yeni kayıtlar için gereken kod. Değiştirirsen yeni kodu WhatsApp grubunda paylaş.</p>
      <div class="field"><label for="y-kod">Yeni bölüm kodu</label><input id="y-kod" required autocomplete="off"></div>
      <button class="btn sec" type="submit">Kodu değiştir</button></form>
    <div class="card"><h3>Ders programı</h3>
      <p class="note">Uygulamayla gelen <code>data/events.json</code> dosyasındaki programı veritabanına yükler. Mevcut program silinip yerine yenisi yazılır.</p>
      <p>Veritabanındaki ders sayısı: <b>${eventCount ?? '…'}</b></p>
      <button class="btn" id="y-import">Programı içe aktar</button><p class="err" id="y-msg"></p></div>`;
}

async function onClick(e) {
  const b = e.target.closest('button'); if (!b || !$('#v-yonetim').contains(b)) return;
  try {
    if (b.dataset.onay) {
      await F.updateDoc(F.doc(db, 'users', b.dataset.onay), { onayli: true });
      await F.updateDoc(F.doc(db, 'people', b.dataset.onay), { onayli: true }); toast('Onaylandı');
    } else if (b.dataset.sil) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Emin misin?'; return; }
      await F.deleteDoc(F.doc(db, 'people', b.dataset.sil)); await F.deleteDoc(F.doc(db, 'users', b.dataset.sil)); toast('Kayıt silindi');
    } else if ('kaydet' in b.dataset || b.dataset.rol) {
      const row = b.closest('[data-u]'), id = row.dataset.u, patch = {};
      if (b.dataset.rol) patch.rol = b.dataset.rol;
      else row.querySelectorAll('[data-f]').forEach(i => { patch[i.dataset.f] = i.value.trim() === '' ? null : Number(i.value) || i.value.trim(); });
      await F.updateDoc(F.doc(db, 'users', id), patch); toast('Kaydedildi');
    } else if (b.id === 'y-import') await importProgram();
  } catch (x) { console.error(x); toast('İşlem yapılamadı'); }
}

async function importProgram() {
  const msg = $('#y-msg'), btn = $('#y-import');
  if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Mevcut program silinecek. Emin misin?'; return; }
  btn.disabled = true; msg.textContent = 'Yükleniyor…';
  const j = await (await fetch('data/events.json', { cache: 'no-store' })).json();
  const ops = [];
  for (const c of ['events', 'notices']) (await F.getDocs(F.collection(db, c))).forEach(d => ops.push(['del', d.ref]));
  (j.events || []).forEach(ev => ops.push(['set', F.doc(F.collection(db, 'events')), ev]));
  (j.notices || []).forEach(n => ops.push(['set', F.doc(F.collection(db, 'notices')), n]));
  for (let i = 0; i < ops.length; i += 400) {
    const b = F.writeBatch(db);
    ops.slice(i, i + 400).forEach(([t, r, d]) => t === 'del' ? b.delete(r) : b.set(r, d));
    await b.commit();
  }
  msg.textContent = `${(j.events || []).length} ders ve ${(j.notices || []).length} not yüklendi.`;
  btn.disabled = false; btn.dataset.sure = ''; btn.textContent = 'Programı içe aktar';
}

export function initYonetim() {
  $('#v-yonetim').addEventListener('click', onClick);
  $('#v-yonetim').addEventListener('submit', async e => {
    if (e.target.id !== 'f-kod') return; e.preventDefault();
    const k = $('#y-kod').value.trim(); if (k.length < 4) { toast('Kod en az 4 karakter olmalı'); return; }
    try { await F.updateDoc(F.doc(db, 'config', 'public'), { kodHash: await sha256(k) }); e.target.reset(); toast('Bölüm kodu değişti'); }
    catch (x) { toast('Kod değiştirilemedi'); }
  });
  if (!ready) return;
  onState(s => {
    if (s.admin && !unsub) {
      unsub = F.onSnapshot(F.collection(db, 'users'), q => { users = q.docs.map(d => ({ id: d.id, ...d.data() })); render(); });
      F.onSnapshot(F.collection(db, 'events'), q => { eventCount = q.size; if (!document.activeElement?.closest('#v-yonetim')) render(); });
    }
    if (!s.admin && unsub) { unsub(); unsub = null; }
    if (!document.activeElement?.closest('#v-yonetim')) render();
  });
}
