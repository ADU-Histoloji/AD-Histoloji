import { $, esc, state, onState, toast, sha256 } from './util.js';
import { ready, db, F } from './fb.js';
import { onEvents } from './takvim.js';
import { konuId, MASA_SAYISI, MASA_KAP } from './uygulamalar.js';

const trAd = a => String(a || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
const DTUR = { yeni: 'Yeni program eklendi', guncel: 'Güncellenmiş program yüklendi', icerik: 'Dosyanın içeriği değişti', kaldirildi: 'Program sayfadan kaldırıldı' };
let users = [], unsub = null, eventCount = null;
let anl = {}, konular = [], seminerler = [], degisiklik = [], eskileriGoster = false;

const bugunISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const gunEkle = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const trTarih = iso => iso.split('-').reverse().join('.');
const SEKMELER = [['yap', 'Yapılacak'], ['kisi', 'Kişiler'], ['uyg', 'Uygulama'], ['prog', 'Program']];
let sekme = 'yap', gecmisAnl = false, gecmisSem = false;
const otoEslesen = new Set();
// Kullanıcı bir alana yazı yazarken ekranı yeniden çizme
const yaziyor = () => !!document.activeElement?.matches?.('#v-yonetim input, #v-yonetim textarea');

const kisiSecici = (tip, secili, bos, ek = '') => `<select data-oto="${tip}" ${ek} style="width:auto;max-width:15em"><option value="">${bos}</option>${users.filter(u => u.onayli).sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(u => `<option value="${esc(u.id)}"${u.id === secili ? ' selected' : ''}>${esc(u.ad)}</option>`).join('')}</select>`;

const anlSatir = k => `<div class="li" data-k="${esc(k.id)}" data-s="${esc(k.s)}" data-topic="${esc(k.topic)}">
  <span style="flex:1 1 16em"><span class="nm">${esc(k.topic)}</span><br><span class="note">${esc(k.s)} · ${esc(trTarih(k.sonraki || k.son))}${k.who ? ' · öğretim üyesi: ' + esc(k.who) : ''}</span></span>
  ${kisiSecici('anl', (anl[k.id] || {}).uid, 'Belirlenmedi')}</div>`;

const semSatir = e => `<div class="li" data-sem="${esc(e.id)}">
  <span style="flex:1 1 16em"><span class="nm">${esc(trTarih(e.date))} · ${esc(e.who || '')}</span><br><span class="note">${esc(e.topic || 'Konu henüz yazılmadı')}</span></span>
  ${kisiSecici('sem', e.uid, 'Eşleştirilmedi')}</div>`;

function yapilacaklar() {
  const bugun = bugunISO(), sinir = gunEkle(bugun, 21);
  const wait = users.filter(u => !u.onayli);
  const yeniDeg = degisiklik.filter(d => d.durum !== 'bakildi');
  const anlEksik = konular.filter(k => k.sonraki && k.sonraki <= sinir && !(anl[k.id] || {}).uid);
  const semEksik = seminerler.filter(e => e.date >= bugun && !e.uid);
  const say = {}; users.filter(u => u.onayli && u.masa).forEach(u => { say[u.masa] = (say[u.masa] || 0) + 1; });
  const tasan = Object.entries(say).filter(([m, n]) => n > MASA_KAP).map(([m]) => m);
  const masasiz = users.filter(u => u.onayli && !u.masa);
  const parcalar = [];
  if (wait.length) parcalar.push(`<div class="card" style="max-width:none"><h3>Onay bekleyenler</h3><div class="list">${wait.map(u => `<div class="li"><span class="nm">${esc(u.ad)}</span><span><button class="btn" data-onay="${esc(u.id)}">Onayla</button> <button class="btn del" data-sil="${esc(u.id)}">Reddet</button></span></div>`).join('')}</div></div>`);
  if (yeniDeg.length) parcalar.push(`<div class="card" style="max-width:none"><h3>Program değişikliği</h3><p>Fakülte programında ${yeniDeg.length} değişiklik bulundu.</p><button class="btn" data-git="prog">Değişikliklere bak</button></div>`);
  if (anlEksik.length) parcalar.push(`<div class="card" style="max-width:none"><h3>Anlatıcısı olmayan uygulamalar</h3><p class="note">Önümüzdeki 3 hafta. Seçtiğin anda kaydedilir.</p><div class="list">${anlEksik.map(anlSatir).join('')}</div></div>`);
  if (semEksik.length) parcalar.push(`<div class="card" style="max-width:none"><h3>Eşleşmemiş seminerler</h3><p class="note">Sunan kişiyi seç; kendi konusunu yazabilsin ve hatırlatma alsın.</p><div class="list">${semEksik.map(semSatir).join('')}</div></div>`);
  if (tasan.length || masasiz.length) parcalar.push(`<div class="card" style="max-width:none"><h3>Masalar</h3>${tasan.length ? `<p>2'den fazla kişi olan masa: <b>${tasan.join(', ')}</b></p>` : ''}${masasiz.length ? `<p>Masasını henüz seçmemiş: ${masasiz.map(u => esc(u.ad)).join(', ')}</p>` : ''}<button class="btn sec" data-git="kisi">Kişilere git</button></div>`);
  return { html: parcalar.join('') || '<div class="card" style="max-width:none"><h3>Her şey yolunda ✓</h3><p class="note">Bekleyen onay, program değişikliği, anlatıcısız uygulama ya da eşleşmemiş seminer yok.</p></div>', sayi: wait.length + yeniDeg.length + anlEksik.length + semEksik.length + tasan.length + masasiz.length };
}

function kisilerHtml() {
  const ok = users.filter(u => u.onayli).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  return `<div class="card" style="max-width:none"><h3>Kişiler</h3>
    <p class="note">Herkes masasını Profil'den kendisi seçer; gerekirse buradan değiştirebilirsin. PIN'ini unutan kişi için Diğer → "Kaydı sıfırla"; kişi aynı adla yeniden kayıt olur.</p>
    <div class="list">${ok.map(u => `<div class="li" data-u="${esc(u.id)}">
      <span class="nm" style="flex:1 1 10em">${esc(u.ad)} ${u.rol === 'yonetici' ? '<span class="pill">Yönetici</span>' : ''}</span>
      <span style="display:flex;gap:8px;align-items:center">
        <select data-oto="masa" aria-label="Masa" style="width:auto"><option value="">Masa yok</option>${Array.from({ length: MASA_SAYISI }, (_, i) => `<option value="${i + 1}"${Number(u.masa) === i + 1 ? ' selected' : ''}>Masa ${i + 1}</option>`).join('')}</select>
        ${u.id === state.user.uid ? '' : `<details class="diger"><summary>Diğer</summary><div class="diger-ic">
          <button class="btn sec" data-rol="${u.rol === 'yonetici' ? 'asistan' : 'yonetici'}">${u.rol === 'yonetici' ? 'Yöneticilikten al' : 'Yönetici yap'}</button>
          <button class="btn del" data-sil="${esc(u.id)}">Kaydı sıfırla</button></div></details>`}
      </span></div>`).join('') || '<p class="note">Henüz onaylı kişi yok.</p>'}</div></div>
    <form class="card" id="f-kod"><h3>Bölüm kodu</h3>
      <p class="note">Yeni kayıtlar için gereken kod. Değiştirirsen yeni kodu WhatsApp grubunda paylaş.</p>
      <div class="field"><label for="y-kod">Yeni bölüm kodu</label><input id="y-kod" required autocomplete="off"></div>
      <button class="btn sec" type="submit">Kodu değiştir</button></form>`;
}

function uygulamalarHtml() {
  const liste = konular.filter(k => gecmisAnl || k.sonraki);
  return `<div class="card" style="max-width:none"><h3>Anlatıcılar</h3>
    <p class="note">Her uygulama konusunu anlatacak asistanı seç; seçtiğin anda kaydedilir. Anlatıcı takvimde ve Masalar ekranında görünür, bir gün önce bildirim alır.</p>
    <div class="list">${liste.map(anlSatir).join('') || '<p class="note">Yaklaşan uygulama yok.</p>'}</div>
    <button class="linkbtn" data-gecmis="anl">${gecmisAnl ? 'Geçmiş uygulamaları gizle' : 'Geçmiş uygulamaları da göster'}</button></div>`;
}

function programHtml() {
  const bugun = bugunISO();
  const degListe = degisiklik.filter(d => eskileriGoster || d.durum !== 'bakildi');
  const semListe = seminerler.filter(e => gecmisSem || e.date >= bugun);
  return `<div class="card" style="max-width:none" id="c-degisiklik"><h3>Program değişiklikleri</h3>
      <p class="note">Fakülte sayfaları her hafta içi öğlen kontrol edilir. Değişikliği takvimde düzeltip "Baktım" de. Satır karşılaştırması ipucudur; kesin bilgi için PDF'i aç.</p>
      ${degListe.length ? `<div class="list">${degListe.map(d => `<div class="li" style="display:block">
        <div><span class="nm">${esc(d.sayfa)} – ${esc(d.etiket)}</span> ${d.durum === 'bakildi' ? '<span class="pill">bakıldı</span>' : '<span class="pill wait">yeni</span>'}</div>
        <div class="note">${esc(DTUR[d.tur] || d.tur)}${d.t?.toDate ? ' · ' + d.t.toDate().toLocaleDateString('tr-TR') : ''} · ${/^https:\/\//.test(d.url || '') ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">PDF'i aç</a>` : ''}</div>
        ${(d.cikan || []).map(x => `<div class="fark eksi">− ${esc(x)}</div>`).join('')}
        ${(d.eklenen || []).map(x => `<div class="fark arti">+ ${esc(x)}</div>`).join('')}
        ${d.tur !== 'kaldirildi' && !(d.cikan || []).length && !(d.eklenen || []).length ? '<div class="note">Histoloji satırlarında fark bulunamadı; değişiklik başka dersleri ilgilendiriyor olabilir.</div>' : ''}
        ${d.durum !== 'bakildi' ? `<button class="btn sec" style="margin-top:6px" data-bak="${esc(d.id)}">Baktım</button>` : ''}
      </div>`).join('')}</div>` : '<p class="note">Bekleyen değişiklik yok.</p>'}
      <button class="linkbtn" data-eski>${eskileriGoster ? 'Bakılanları gizle' : 'Bakılanları da göster'}</button></div>
    <div class="card" style="max-width:none"><h3>Seminerler</h3>
      <p class="note">Sunan kişiyi uygulamadaki hesabıyla eşleştir; seçtiğin anda kaydedilir. Adı kayıtla birebir aynı olanlar kendiliğinden eşleşir.</p>
      <div class="list">${semListe.map(semSatir).join('') || '<p class="note">Yaklaşan seminer yok.</p>'}</div>
      <button class="linkbtn" data-gecmis="sem">${gecmisSem ? 'Geçmiş seminerleri gizle' : 'Geçmiş seminerleri de göster'}</button></div>
    <details class="card" style="max-width:none"><summary><b>Ders programını yükle</b> <span class="note">· veritabanında ${eventCount ?? '…'} ders</span></summary>
      <p class="note"><b>Yeni dersleri ekle:</b> Uygulamayla gelen programda olup takvimde olmayan dersleri ekler; elle yaptığın düzeltmelere dokunmaz.<br><b>Tümünü değiştir:</b> Takvimi silip baştan yazar; sadece yeni öğretim yılı başında kullan.</p>
      <div class="acts"><button class="btn" id="y-ekle">Yeni dersleri ekle</button><button class="btn del" id="y-import">Tümünü değiştir</button></div>
      <p class="err" id="y-msg"></p></details>`;
}

function render() {
  const el = $('#v-yonetim');
  if (!state.admin) { el.innerHTML = '<div class="banner">Bu bölüm sadece yöneticiler içindir.</div>'; return; }
  const acik = [...el.querySelectorAll('details[open]')].map(d => d.closest('[data-u]')?.dataset.u || d.querySelector('summary')?.textContent);
  const y = yapilacaklar();
  const icerik = { yap: () => y.html, kisi: kisilerHtml, uyg: uygulamalarHtml, prog: programHtml }[sekme]();
  el.innerHTML = `<div class="chips ysekme" role="tablist">${SEKMELER.map(([k, ad]) => `<button class="chip" role="tab" data-sekme="${k}" aria-pressed="${k === sekme}">${ad}${k === 'yap' && y.sayi ? ` <span class="rozet-ic">${y.sayi}</span>` : ''}</button>`).join('')}</div>${icerik}`;
  el.querySelectorAll('details').forEach(d => { if (acik.includes(d.closest('[data-u]')?.dataset.u || d.querySelector('summary')?.textContent)) d.open = true; });
}

function otoEslestir() {
  if (!users.length) return;
  seminerler.filter(e => !e.uid && !otoEslesen.has(e.id)).forEach(e => {
    const u = users.find(x => x.onayli && trAd(x.ad) === trAd(e.who));
    if (!u) return;
    otoEslesen.add(e.id);
    F.updateDoc(F.doc(db, 'events', e.id), { uid: u.id }).catch(x => console.error(x));
  });
}

async function onChange(e) {
  const s = e.target.closest('select[data-oto]'); if (!s) return;
  const v = s.value, tip = s.dataset.oto;
  try {
    if (tip === 'masa') await F.updateDoc(F.doc(db, 'users', s.closest('[data-u]').dataset.u), { masa: v ? Number(v) : null });
    else if (tip === 'sem') await F.updateDoc(F.doc(db, 'events', s.closest('[data-sem]').dataset.sem), { uid: v || F.deleteField() });
    else if (tip === 'anl') {
      const row = s.closest('[data-k]');
      if (!v) await F.deleteDoc(F.doc(db, 'anlaticilar', row.dataset.k));
      else await F.setDoc(F.doc(db, 'anlaticilar', row.dataset.k), { s: row.dataset.s, topic: row.dataset.topic, ad: users.find(u => u.id === v)?.ad || '', uid: v });
    }
    toast('Kaydedildi');
  } catch (x) { console.error(x); toast('Kaydedilemedi'); }
}

async function onClick(e) {
  const b = e.target.closest('button'); if (!b || !$('#v-yonetim').contains(b)) return;
  try {
    if (b.dataset.sekme) { sekme = b.dataset.sekme; render(); window.scrollTo(0, 0); }
    else if (b.dataset.git) { sekme = b.dataset.git; render(); window.scrollTo(0, 0); }
    else if (b.dataset.gecmis) { if (b.dataset.gecmis === 'anl') gecmisAnl = !gecmisAnl; else gecmisSem = !gecmisSem; render(); }
    else if (b.dataset.onay) {
      await F.updateDoc(F.doc(db, 'users', b.dataset.onay), { onayli: true });
      await F.updateDoc(F.doc(db, 'people', b.dataset.onay), { onayli: true }); toast('Onaylandı');
    } else if (b.dataset.sil) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Emin misin?'; return; }
      await F.deleteDoc(F.doc(db, 'people', b.dataset.sil)); await F.deleteDoc(F.doc(db, 'users', b.dataset.sil)); toast('Kayıt silindi');
    } else if (b.dataset.rol) {
      await F.updateDoc(F.doc(db, 'users', b.closest('[data-u]').dataset.u), { rol: b.dataset.rol }); toast('Kaydedildi');
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
    const bugun = bugunISO(), m = new Map();
    ev.filter(e => e.k === 'U').sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
      const id = konuId(e.s, e.topic);
      if (!m.has(id)) m.set(id, { id, s: e.s, topic: e.topic, who: e.who, son: e.date, sonraki: null });
      const k = m.get(id); k.son = e.date;
      if (!k.sonraki && e.date >= bugun) k.sonraki = e.date;
    });
    const yeni = [...m.values()].sort((a, b) => (a.sonraki || a.son).localeCompare(b.sonraki || b.son));
    const sem = ev.filter(e => e.k === 'M' && e.id).sort((a, b) => a.date.localeCompare(b.date));
    const degisti = JSON.stringify(yeni) !== JSON.stringify(konular) || JSON.stringify(sem.map(e => [e.id, e.uid, e.topic, e.who])) !== JSON.stringify(seminerler.map(e => [e.id, e.uid, e.topic, e.who]));
    konular = yeni; seminerler = sem;
    if (state.admin) otoEslestir();
    if (degisti && !yaziyor()) render();
  });
  $('#v-yonetim').addEventListener('click', onClick);
  $('#v-yonetim').addEventListener('change', onChange);
  $('#v-yonetim').addEventListener('submit', async e => {
    if (e.target.id !== 'f-kod') return; e.preventDefault();
    const k = $('#y-kod').value.trim(); if (k.length < 4) { toast('Kod en az 4 karakter olmalı'); return; }
    try { await F.updateDoc(F.doc(db, 'config', 'public'), { kodHash: await sha256(k) }); e.target.reset(); toast('Bölüm kodu değişti'); }
    catch (x) { toast('Kod değiştirilemedi'); }
  });
  if (!ready) return;
  const yeniden = () => { if (!yaziyor()) render(); };
  onState(s => {
    if (s.admin && !unsub) {
      unsub = F.onSnapshot(F.collection(db, 'users'), q => { users = q.docs.map(d => ({ id: d.id, ...d.data() })); otoEslestir(); yeniden(); });
      F.onSnapshot(F.collection(db, 'events'), q => { eventCount = q.size; yeniden(); });
      F.onSnapshot(F.query(F.collection(db, 'degisiklikler'), F.orderBy('t', 'desc'), F.limit(60)), q => { degisiklik = q.docs.map(d => ({ id: d.id, ...d.data() })); yeniden(); }, () => { });
      F.onSnapshot(F.collection(db, 'anlaticilar'), q => { anl = {}; q.docs.forEach(d => { anl[d.id] = d.data(); }); yeniden(); }, () => { });
    }
    if (!s.admin && unsub) { unsub(); unsub = null; }
    yeniden();
  });
}
