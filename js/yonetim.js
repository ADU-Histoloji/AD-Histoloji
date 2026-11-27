import { $, esc, state, onState, toast, sha256 } from './util.js';
import { ready, db, F } from './fb.js';
import { onEvents } from './takvim.js';
import { konuId, MASA_SAYISI } from './uygulamalar.js';

const trAd = a => String(a || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
const DTUR = { yeni: 'Yeni program eklendi', guncel: 'Güncellenmiş program yüklendi', icerik: 'Dosyanın içeriği değişti', kaldirildi: 'Program sayfadan kaldırıldı' };
let users = [], unsub = null, eventCount = null;
let kap = {}, anl = {}, konular = [], seminerler = [], degisiklik = [], eskileriGoster = false;

function render() {
  const el = $('#v-yonetim');
  if (!state.admin) { el.innerHTML = '<div class="banner">Bu bölüm sadece yöneticiler içindir.</div>'; return; }
  const wait = users.filter(u => !u.onayli), ok = users.filter(u => u.onayli).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  el.innerHTML = `
    <div class="card" style="max-width:none"><h3>Onay bekleyenler</h3>
      ${wait.length ? `<div class="list">${wait.map(u => `<div class="li"><span class="nm">${esc(u.ad)}</span><span><button class="btn" data-onay="${esc(u.id)}">Onayla</button> <button class="btn del" data-sil="${esc(u.id)}">Reddet</button></span></div>`).join('')}</div>` : '<p class="note">Onay bekleyen kayıt yok.</p>'}
    </div>
    <div class="card" style="max-width:none" id="c-degisiklik"><h3>Program değişiklikleri</h3>
      <p class="note">Fakültenin ders programı sayfaları her hafta içi öğlen kontrol edilir. Bulunan değişiklikleri takvimde düzeltip "Baktım" deyin. Satır karşılaştırması PDF'ten otomatik çıkarılır, ipucu niteliğindedir; kesin bilgi için PDF'i açın.</p>
      ${(() => { const liste = degisiklik.filter(d => eskileriGoster || d.durum !== 'bakildi'); return liste.length ? `<div class="list">${liste.map(d => `<div class="li" style="display:block">
        <div><span class="nm">${esc(d.sayfa)} – ${esc(d.etiket)}</span> ${d.durum === 'bakildi' ? '<span class="pill">bakıldı</span>' : '<span class="pill wait">yeni</span>'}</div>
        <div class="note">${esc(DTUR[d.tur] || d.tur)}${d.t?.toDate ? ' · ' + d.t.toDate().toLocaleDateString('tr-TR') : ''} · ${/^https:\/\//.test(d.url || '') ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">PDF'i aç</a>` : ''}</div>
        ${(d.cikan || []).map(x => `<div class="fark eksi">− ${esc(x)}</div>`).join('')}
        ${(d.eklenen || []).map(x => `<div class="fark arti">+ ${esc(x)}</div>`).join('')}
        ${d.tur !== 'kaldirildi' && !(d.cikan || []).length && !(d.eklenen || []).length ? '<div class="note">Histoloji satırlarında fark bulunamadı; değişiklik başka dersleri ilgilendiriyor olabilir.</div>' : ''}
        ${d.durum !== 'bakildi' ? `<button class="btn sec" style="margin-top:6px" data-bak="${esc(d.id)}">Baktım</button>` : ''}
      </div>`).join('')}</div>` : '<p class="note">Bekleyen değişiklik yok.</p>'; })()}
      <button class="linkbtn" data-eski>${eskileriGoster ? 'Bakılanları gizle' : 'Bakılanları da göster'}</button>
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
    <form class="card" id="f-sem" style="max-width:none"><h3>Seminerler</h3>
      <p class="note">Her seminerin sunan kişisini uygulamadaki hesabıyla eşleştir. Eşleşen kişi takvimde ve Profil ekranında kendi seminer konusunu yazabilir; konusu boşsa pazartesi sabahı hatırlatma alır. Adı listedeki kayıtla aynı olanlar önceden seçili gelir.</p>
      ${seminerler.length ? `<div class="list">${seminerler.map(e => {
        const sec = e.uid || users.find(u => u.onayli && trAd(u.ad) === trAd(e.who))?.id || '';
        return `<div class="li" data-sem="${esc(e.id)}">
          <span style="flex:1 1 16em"><span class="nm">${esc(e.date.split('-').reverse().join('.'))} · ${esc(e.who || '')}</span><br><span class="note">${esc(e.topic || '')}</span></span>
          <select data-f="uid" style="width:auto;max-width:15em"><option value="">Eşleştirilmedi</option>${users.filter(u => u.onayli).map(u => `<option value="${esc(u.id)}"${u.id === sec ? ' selected' : ''}>${esc(u.ad)}</option>`).join('')}</select>
          ${e.uid ? '<span class="pill">eşleşti</span>' : sec ? '<span class="pill wait">kaydedilmedi</span>' : ''}
        </div>`; }).join('')}</div>` : '<p class="note">Takvimde seminer yok.</p>'}
      <button class="btn sec" type="submit">Eşleştirmeleri kaydet</button></form>
    <form class="card" id="f-masa" style="max-width:none"><h3>Masa kapasiteleri</h3>
      <p class="note">Her masaya kaç kişinin oturduğunu seç. Kişilerin sabit masa numaralarını yukarıdaki "Kişiler" bölümünden gir.</p>
      <div class="masalar">${Array.from({ length: MASA_SAYISI }, (_, i) => `<label class="masa" style="min-height:0">Masa ${i + 1}
        <select data-masa="${i + 1}"><option value="1"${Number(kap[i + 1] || 1) === 1 ? ' selected' : ''}>1 kişi</option><option value="2"${Number(kap[i + 1]) === 2 ? ' selected' : ''}>2 kişi</option></select></label>`).join('')}</div>
      <button class="btn sec" type="submit">Kaydet</button></form>
    <form class="card" id="f-anl" style="max-width:none"><h3>Anlatıcılar</h3>
      <p class="note">Her uygulama konusunun anlatıcısı. Boş bırakılırsa programdaki öğretim üyesi gösterilir. Anlatıcı uygulamaya kayıtlıysa listeden seç, bir gün önce ona da bildirim gider.</p>
      <div class="list">${konular.map(k => { const a = anl[k.id] || {}; return `<div class="li" data-k="${esc(k.id)}" data-s="${esc(k.s)}" data-topic="${esc(k.topic)}">
        <span style="flex:1 1 16em"><span class="nm">${esc(k.topic)}</span><br><span class="note">${esc(k.s)} · ${esc(k.ilk)}${k.who ? ' · programda: ' + esc(k.who) : ''}</span></span>
        <select data-f="uid" style="width:auto;max-width:14em"><option value="">Kayıtlı değil</option>${users.filter(u => u.onayli).map(u => `<option value="${esc(u.id)}"${a.uid === u.id ? ' selected' : ''}>${esc(u.ad)}</option>`).join('')}</select>
        <input data-f="ad" value="${esc(a.ad || '')}" placeholder="${esc(k.who || 'Anlatıcının adı')}" style="width:auto;max-width:14em"></div>`; }).join('') || '<p class="note">Programda uygulama yok.</p>'}</div>
      <button class="btn sec" type="submit">Anlatıcıları kaydet</button></form>
    <form class="card" id="f-kod"><h3>Bölüm kodu</h3>
      <p class="note">Yeni kayıtlar için gereken kod. Değiştirirsen yeni kodu WhatsApp grubunda paylaş.</p>
      <div class="field"><label for="y-kod">Yeni bölüm kodu</label><input id="y-kod" required autocomplete="off"></div>
      <button class="btn sec" type="submit">Kodu değiştir</button></form>
    <div class="card"><h3>Ders programı</h3>
      <p class="note">Uygulamayla gelen <code>data/events.json</code> dosyasındaki programı veritabanına yükler.</p>
      <p>Veritabanındaki ders sayısı: <b>${eventCount ?? '…'}</b></p>
      <p class="note"><b>Yeni dersleri ekle:</b> Dosyada olup takvimde olmayan dersleri ekler, dosyada kaldırılması istenenleri siler. Takvimde elle yaptığın düzeltmelere dokunmaz.<br><b>Tümünü değiştir:</b> Takvimi silip dosyadakini baştan yazar; sadece yeni öğretim yılı başında kullan.</p>
      <div class="acts"><button class="btn" id="y-ekle">Yeni dersleri ekle</button><button class="btn del" id="y-import">Tümünü değiştir</button></div>
      <p class="err" id="y-msg"></p></div>`;
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
    } else if (b.dataset.bak) {
      await F.updateDoc(F.doc(db, 'degisiklikler', b.dataset.bak), { durum: 'bakildi' });
    } else if ('eski' in b.dataset) { eskileriGoster = !eskileriGoster; render();
    } else if (b.id === 'y-import') await importProgram();
    else if (b.id === 'y-ekle') await eksikleriEkle();
  } catch (x) { console.error(x); toast('İşlem yapılamadı'); }
}

const anahtar = e => ['date', 't', 's', 'k', 'topic', 'g'].map(k => e[k] ?? '').join('|');
async function eksikleriEkle() {
  const msg = $('#y-msg'), btn = $('#y-ekle');
  btn.disabled = true; msg.textContent = 'Karşılaştırılıyor…';
  try {
    const j = await (await fetch('data/events.json', { cache: 'no-store' })).json();
    const mevcut = (await F.getDocs(F.collection(db, 'events'))).docs.map(d => ({ ref: d.ref, k: anahtar(d.data()) }));
    const var_ = new Set(mevcut.map(x => x.k)), kaldir = new Set(j.kaldir || []);
    const ops = [];
    (j.events || []).filter(e => !var_.has(anahtar(e))).forEach(e => ops.push(['set', F.doc(F.collection(db, 'events')), e]));
    mevcut.filter(x => kaldir.has(x.k)).forEach(x => ops.push(['del', x.ref]));
    const eklenen = ops.filter(o => o[0] === 'set').length, silinen = ops.length - eklenen;
    // Notlar (tarihi belli olmayan uygulamalar vb.) her zaman dosyadakiyle değiştirilir
    (await F.getDocs(F.collection(db, 'notices'))).forEach(d => ops.push(['del', d.ref]));
    (j.notices || []).forEach(n => ops.push(['set', F.doc(F.collection(db, 'notices')), n]));
    for (let i = 0; i < ops.length; i += 400) {
      const b = F.writeBatch(db);
      ops.slice(i, i + 400).forEach(([t, r, d]) => t === 'del' ? b.delete(r) : b.set(r, d));
      await b.commit();
    }
    msg.textContent = eklenen || silinen ? `${eklenen} ders eklendi${silinen ? `, ${silinen} ders silindi` : ''}.` : 'Takvim zaten güncel.';
  } catch (x) { console.error(x); msg.textContent = 'Yüklenemedi.'; }
  btn.disabled = false;
}

async function importProgram() {
  const msg = $('#y-msg'), btn = $('#y-import');
  if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Takvim silinip baştan yazılacak. Emin misin?'; return; }
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
  btn.disabled = false; btn.dataset.sure = ''; btn.textContent = 'Tümünü değiştir';
}

export function initYonetim() {
  onEvents(ev => {
    const m = new Map();
    ev.filter(e => e.k === 'U').sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
      const id = konuId(e.s, e.topic);
      if (!m.has(id)) m.set(id, { id, s: e.s, topic: e.topic, who: e.who, ilk: e.date.split('-').reverse().join('.') });
    });
    const yeni = [...m.values()];
    const sem = ev.filter(e => e.k === 'M' && e.id).sort((a, b) => a.date.localeCompare(b.date));
    const degisti = yeni.length !== konular.length || JSON.stringify(sem.map(e => [e.id, e.uid, e.topic, e.who])) !== JSON.stringify(seminerler.map(e => [e.id, e.uid, e.topic, e.who]));
    konular = yeni; seminerler = sem;
    if (degisti && !document.activeElement?.closest('#v-yonetim')) render();
  });
  $('#v-yonetim').addEventListener('click', onClick);
  $('#v-yonetim').addEventListener('submit', async e => {
    if (e.target.id === 'f-sem') {
      e.preventDefault();
      try {
        for (const row of e.target.querySelectorAll('[data-sem]')) {
          const uid = row.querySelector('[data-f=uid]').value || null, ev = seminerler.find(x => x.id === row.dataset.sem);
          if (!ev || (ev.uid || null) === uid) continue;
          await F.updateDoc(F.doc(db, 'events', ev.id), { uid: uid || F.deleteField() });
        }
        toast('Seminer eşleştirmeleri kaydedildi');
      } catch (x) { console.error(x); toast('Kaydedilemedi'); }
      return;
    }
    if (e.target.id === 'f-masa') {
      e.preventDefault();
      const k = {}; e.target.querySelectorAll('[data-masa]').forEach(x => { k[x.dataset.masa] = Number(x.value); });
      try { await F.setDoc(F.doc(db, 'config', 'masalar'), { kap: k }); toast('Masa kapasiteleri kaydedildi'); } catch (x) { toast('Kaydedilemedi'); }
      return;
    }
    if (e.target.id === 'f-anl') {
      e.preventDefault();
      try {
        for (const row of e.target.querySelectorAll('[data-k]')) {
          const uid = row.querySelector('[data-f=uid]').value || null;
          let ad = row.querySelector('[data-f=ad]').value.trim();
          if (!ad && uid) ad = users.find(u => u.id === uid)?.ad || '';
          const eski = anl[row.dataset.k] || {};
          if ((eski.uid || null) === uid && (eski.ad || '') === ad) continue;
          if (!uid && !ad) await F.deleteDoc(F.doc(db, 'anlaticilar', row.dataset.k));
          else await F.setDoc(F.doc(db, 'anlaticilar', row.dataset.k), { s: row.dataset.s, topic: row.dataset.topic, ad, uid });
        }
        toast('Anlatıcılar kaydedildi');
      } catch (x) { console.error(x); toast('Kaydedilemedi'); }
      return;
    }
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
      F.onSnapshot(F.doc(db, 'config', 'masalar'), q => { kap = q.exists() ? (q.data().kap || {}) : {}; if (!document.activeElement?.closest('#v-yonetim')) render(); }, () => { });
      F.onSnapshot(F.query(F.collection(db, 'degisiklikler'), F.orderBy('t', 'desc'), F.limit(60)), q => { degisiklik = q.docs.map(d => ({ id: d.id, ...d.data() })); if (!document.activeElement?.closest('#v-yonetim')) render(); }, () => { });
      F.onSnapshot(F.collection(db, 'anlaticilar'), q => { anl = {}; q.docs.forEach(d => { anl[d.id] = d.data(); }); if (!document.activeElement?.closest('#v-yonetim')) render(); }, () => { });
    }
    if (!s.admin && unsub) { unsub(); unsub = null; }
    if (!document.activeElement?.closest('#v-yonetim')) render();
  });
}
