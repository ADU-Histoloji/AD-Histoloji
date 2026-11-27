// Seminer sırası ekranı: her Salı 09:30. Sınav olan ya da "seminer yok" denen Salılar atlanır;
// yönetici bir haftayı boş geçince, birini sıradan çıkarınca ya da araya boşluk kapatınca
// sonraki seminerler bir sonraki uygun Salıya kendiliğinden kayar.
import { $, esc, state, onState, toast, sheet, closeSheet } from './util.js';
import { ready, db, F } from './fb.js';
import { onEvents, konuFormu, bosKonu } from './takvim.js';

const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const gunEkle = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const kisa = s => { const d = parse(s); return `${d.getDate()} ${AY[d.getMonth()]}`; };
const tamTarih = s => s.split('-').reverse().join('.');
const bugun = () => iso(new Date());
const sonrakiSali = s => { const d = parse(s); d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7)); return iso(d); };
// Listenin başladığı Salı: bugün Salıysa bugün, değilse gelecek Salı
const buSali = () => sonrakiSali(bugun());
const pzt = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };

let seminerler = [], sinavGunleri = new Map(), atla = {}, users = [];
let degistir = null, gecmisAcik = false, unsub = null;

const sinavMi = g => sinavGunleri.has(g);
const uygun = g => !sinavMi(g) && !atla[g];

// fromDate'ten (dahil) başlayarak uygun Salıları sırayla verir
function uygunSalilar(fromDate, adet) {
  const out = []; let g = sonrakiSali(fromDate);
  for (let i = 0; out.length < adet && i < 400; i++, g = gunEkle(g, 7)) if (uygun(g)) out.push(g);
  return out;
}

// Verilen seminerleri (sıralı) fromDate'ten itibaren art arda uygun Salılara yerleştirir
async function yerlestir(fromDate, liste) {
  const tarihler = uygunSalilar(fromDate, liste.length);
  const b = F.writeBatch(db); let n = 0;
  liste.forEach((e, i) => { if (e.date !== tarihler[i]) { b.update(F.doc(db, 'events', e.id), { date: tarihler[i] }); n++; } });
  if (n) await b.commit();
  return n;
}
const sonrakiler = g => seminerler.filter(e => e.date >= g);

function satirlar() {
  const bas = buSali(), son = seminerler.length ? seminerler[seminerler.length - 1].date : bas;
  const out = [];
  for (let g = bas; g <= son; g = gunEkle(g, 7)) {
    const sem = seminerler.filter(e => e.date === g);
    if (sem.length) sem.forEach(e => out.push({ g, tur: 'sem', e, cakisma: sinavMi(g) ? 'Bu Salı histoloji sınavı var' : atla[g] ? `Bu Salı seminer yok olarak işaretli${atla[g] !== true ? ' (' + atla[g] + ')' : ''}` : '' }));
    else if (sinavMi(g)) out.push({ g, tur: 'sinav', neden: sinavGunleri.get(g) });
    else if (atla[g]) out.push({ g, tur: 'atla', neden: atla[g] === true ? '' : atla[g] });
    else out.push({ g, tur: 'bos' });
  }
  return out;
}

function semKart(r) {
  const e = r.e, ben = state.user && e.uid === state.user.uid, gecti = e.date < bugun();
  const fark = Math.round((pzt(e.date) - pzt(bugun())) / 864e5 / 7);
  const etiket = gecti ? '' : fark === 0 ? '<span class="pill wait">Bu hafta</span>' : fark === 1 ? '<span class="pill">Gelecek hafta</span>' : '';
  const danisman = (e.note || '').replace(/^Danışman:\s*/i, '');
  const adminBtn = state.admin && !gecti ? (degistir
    ? (degistir === e.id ? '<button class="btn sec" data-sx="vazgec">Vazgeç</button>' : `<button class="btn" data-sx="takas" data-id="${esc(e.id)}">Bununla yer değiştir</button>`)
    : `<details class="diger"><summary>Düzenle</summary><div class="diger-ic">
        <button class="btn sec" data-sx="atla" data-g="${esc(e.date)}">Bu hafta seminer yok</button>
        <button class="btn sec" data-sx="degistir" data-id="${esc(e.id)}">Yer değiştir</button>
        <button class="btn del" data-sx="cikar" data-id="${esc(e.id)}">Sıradan çıkar</button></div></details>`) : '';
  return `<div class="sem-k${ben ? ' ben' : ''}${gecti ? ' gecti' : ''}${degistir === e.id ? ' secili' : ''}">
    <div class="sem-t"><b>${esc(kisa(e.date))}</b><span>Salı</span></div>
    <div class="sem-ic">
      <div class="nm">${esc(e.who || 'Belirlenmedi')} ${ben ? '<span class="pill">Sen</span>' : ''} ${etiket}</div>
      <div class="${bosKonu(e.topic) ? 'mute' : ''}">${bosKonu(e.topic) ? 'Konu henüz yazılmadı' : esc(e.topic)}</div>
      ${danisman ? `<div class="note">Danışman: ${esc(danisman)}</div>` : ''}
      ${r.cakisma ? `<div class="warn">⚠️ ${esc(r.cakisma)}${state.admin ? ` <button class="linkbtn" data-sx="kaydir" data-g="${esc(e.date)}">Sonrakileri kaydır</button>` : ''}</div>` : ''}
      ${ben && !gecti ? `<button class="btn sec" style="margin-top:6px" data-sx="konu" data-id="${esc(e.id)}">${bosKonu(e.topic) ? 'Konunu yaz' : 'Konunu düzenle'}</button>` : ''}
    </div>
    <div class="sem-a">${adminBtn}</div>
  </div>`;
}

function render() {
  const el = $('#v-seminer'); if (!el) return;
  const s = satirlar(), gecmis = seminerler.filter(e => e.date < buSali()).reverse();
  el.innerHTML = `
    <p class="note" style="margin:4px 0 12px">Seminerler her Salı 09:30'da. Histoloji sınavı olan ya da "seminer yok" denen Salılar atlanır, sonraki seminerler bir hafta kayar.${state.admin ? '' : ' Değişiklik için yöneticiye yaz.'}</p>
    ${degistir ? '<div class="banner">Yer değiştireceğin seminere dokun.</div>' : ''}
    <div class="sem-liste">${s.map(r => r.tur === 'sem' ? semKart(r)
      : `<div class="sem-k bosluk"><div class="sem-t"><b>${esc(kisa(r.g))}</b><span>Salı</span></div>
          <div class="sem-ic">${r.tur === 'sinav' ? `📝 Histoloji sınavı · seminer yok` : r.tur === 'atla' ? `Seminer yok${r.neden ? ' · ' + esc(r.neden) : ''}` : 'Boş'}</div>
          <div class="sem-a">${state.admin && r.g >= bugun() && !degistir ? (r.tur === 'atla' ? `<button class="linkbtn" data-sx="geri" data-g="${esc(r.g)}">Geri al</button>` : r.tur === 'bos' ? `<button class="linkbtn" data-sx="cek" data-g="${esc(r.g)}">Sonrakileri buraya çek</button>` : '') : ''}</div></div>`).join('') || '<p class="note">Yaklaşan seminer yok.</p>'}</div>
    ${state.admin && !degistir ? '<button class="btn" data-sx="ekle" style="margin-top:12px">+ Sıranın sonuna ekle</button>' : ''}
    ${gecmis.length ? `<button class="linkbtn" data-sx="gecmis" style="display:block;margin-top:8px">${gecmisAcik ? 'Geçmiş seminerleri gizle' : `Geçmiş seminerler (${gecmis.length})`}</button>
      ${gecmisAcik ? `<div class="sem-liste">${gecmis.map(e => semKart({ e })).join('')}</div>` : ''}` : ''}`;
}

function atlaFormu(g) {
  sheet(`<div class="sh"><div><div class="date">${esc(tamTarih(g))} Salı</div><h3>Bu hafta seminer yok</h3></div><button class="x" type="button" aria-label="Kapat">×</button></div>
  <form id="af">
    <label for="a-neden">Neden (isteğe bağlı)</label>
    <input id="a-neden" maxlength="60" placeholder="Resmi tatil, kongre…">
    <p class="note">Bu Salı boş geçilir; bu haftanın ve sonraki seminerlerin hepsi birer uygun Salı ileri kayar.</p>
    <div class="acts"><button class="btn" type="submit">Kaydır</button><button class="btn sec" data-close type="button">Vazgeç</button></div>
  </form>`);
  $('#af').addEventListener('submit', async e => {
    e.preventDefault();
    const neden = $('#a-neden').value.trim(), liste = sonrakiler(g);
    try {
      await F.setDoc(F.doc(db, 'config', 'seminer'), { atla: { ...atla, [g]: neden || true } });
      atla = { ...atla, [g]: neden || true };
      const n = await yerlestir(g, liste); closeSheet(); toast(`${n} seminer kaydırıldı`);
    } catch (x) { console.error(x); toast('Kaydedilemedi'); }
  });
}

function ekleFormu() {
  const son = seminerler.filter(e => e.date >= bugun()).pop();
  const tarih = uygunSalilar(son ? gunEkle(son.date, 1) : bugun(), 1)[0];
  sheet(`<div class="sh"><div><div class="date">${esc(tamTarih(tarih))} Salı 09:30</div><h3>Sıraya ekle</h3></div><button class="x" type="button" aria-label="Kapat">×</button></div>
  <form id="ef">
    <label for="e-kisi">Sunacak kişi</label>
    <select id="e-kisi"><option value="">Listeden seç…</option>${users.filter(u => u.onayli).sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(u => `<option value="${esc(u.id)}">${esc(u.ad)}</option>`).join('')}<option value="-">Uygulamada kayıtlı değil</option></select>
    <div id="e-ad-k" class="hide"><label for="e-ad">Ad soyad</label><input id="e-ad" maxlength="60"></div>
    <label for="e-dan">Danışman</label><input id="e-dan" maxlength="60" placeholder="Prof. Dr. …">
    <label for="e-konu">Konu (isteğe bağlı)</label><input id="e-konu" maxlength="200">
    <p class="err" id="e-msg"></p>
    <div class="acts"><button class="btn" type="submit">Ekle</button><button class="btn sec" data-close type="button">Vazgeç</button></div>
  </form>`);
  $('#e-kisi').addEventListener('change', e => $('#e-ad-k').classList.toggle('hide', e.target.value !== '-'));
  $('#ef').addEventListener('submit', async e => {
    e.preventDefault();
    const sec = $('#e-kisi').value, u = users.find(x => x.id === sec);
    const who = u ? u.ad : $('#e-ad').value.trim();
    if (!who) { $('#e-msg').textContent = 'Sunacak kişiyi seç.'; return; }
    const dan = $('#e-dan').value.trim(), topic = $('#e-konu').value.trim();
    const ev = { s: 'Seminer', c: 'seminer', k: 'M', date: tarih, t: '09:30', who, topic: topic || 'Konu henüz belirlenmedi' };
    if (dan) ev.note = 'Danışman: ' + dan;
    if (u) ev.uid = u.id;
    try { await F.addDoc(F.collection(db, 'events'), ev); closeSheet(); toast(`${tamTarih(tarih)} tarihine eklendi`); }
    catch (x) { console.error(x); $('#e-msg').textContent = 'Eklenemedi.'; }
  });
}

async function onClick(ev) {
  const b = ev.target.closest('[data-sx]'); if (!b) return;
  const x = b.dataset.sx, e = seminerler.find(s => s.id === b.dataset.id), g = b.dataset.g;
  try {
    if (x === 'gecmis') { gecmisAcik = !gecmisAcik; render(); }
    else if (x === 'konu') konuFormu(e);
    else if (x === 'ekle') ekleFormu();
    else if (x === 'atla') atlaFormu(g);
    else if (x === 'degistir') { degistir = e.id; render(); }
    else if (x === 'vazgec') { degistir = null; render(); }
    else if (x === 'takas') {
      const a = seminerler.find(s => s.id === degistir), alan = ['who', 'uid', 'topic', 'note'];
      const al = s => Object.fromEntries(alan.map(k => [k, s[k] ?? F.deleteField()]));
      const b2 = F.writeBatch(db);
      b2.update(F.doc(db, 'events', a.id), al(e)); b2.update(F.doc(db, 'events', e.id), al(a));
      await b2.commit(); degistir = null; toast(`${a.who} ↔ ${e.who} yer değiştirdi`); render();
    }
    else if (x === 'cikar') {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Emin misin? Sonrakiler öne kayar'; return; }
      const liste = seminerler.filter(s => s.date >= e.date && s.id !== e.id);
      await F.deleteDoc(F.doc(db, 'events', e.id));
      seminerler = seminerler.filter(s => s.id !== e.id);
      const n = await yerlestir(e.date, liste); toast(`Sıradan çıkarıldı${n ? `, ${n} seminer öne kaydı` : ''}`);
    }
    else if (x === 'geri') {
      const yeni = { ...atla }; delete yeni[g];
      await F.setDoc(F.doc(db, 'config', 'seminer'), { atla: yeni }); atla = yeni;
      const n = await yerlestir(g, sonrakiler(g)); toast(`Geri alındı${n ? `, ${n} seminer öne kaydı` : ''}`);
    }
    else if (x === 'cek') { const n = await yerlestir(g, sonrakiler(g)); toast(`${n} seminer öne kaydı`); }
    else if (x === 'kaydir') { const n = await yerlestir(g, sonrakiler(g)); toast(`${n} seminer kaydırıldı`); }
  } catch (err) { console.error(err); toast('İşlem yapılamadı'); }
}

export function initSeminer() {
  onEvents(ev => {
    seminerler = ev.filter(e => e.k === 'M').sort((a, b) => (a.date + (a.t || '')).localeCompare(b.date + (b.t || '')));
    sinavGunleri = new Map(ev.filter(e => e.k === 'S').map(e => [e.date, e.topic]));
    render();
  });
  $('#v-seminer').addEventListener('click', onClick);
  onState(s => {
    if (ready && s.approved && !unsub) {
      const u1 = F.onSnapshot(F.doc(db, 'config', 'seminer'), q => { atla = q.exists() ? (q.data().atla || {}) : {}; render(); }, () => { });
      const u2 = F.onSnapshot(F.collection(db, 'users'), q => { users = q.docs.map(d => ({ id: d.id, ...d.data() })); }, () => { });
      unsub = () => { u1(); u2(); };
    }
    if (!s.approved && unsub) { unsub(); unsub = null; atla = {}; }
    if (!$('#v-seminer').contains(document.activeElement)) render();
  });
}
