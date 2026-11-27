import { $, $$, esc, state, onState, sheet, closeSheet, shrink, toast, trLower } from './util.js';
import { ready, db, F } from './fb.js';

export const DERS = [
  { k: 'tip1-hucre-organel', l: 'Tıp D1 · Hücre sitoplazması ve organelleri' },
  { k: 'tip2-solunum', l: 'Tıp D2 · Solunum sistemi histolojisi' },
  { k: 'dis1-bag', l: 'Diş D1 · Bağ dokusu histolojisi' },
  { k: 'dis2-urogenital', l: 'Diş D2 · Ürogenital sistem histolojisi' },
  { k: 'dis3-oral', l: 'Diş D3 · Oral kavite histolojisi' }
];
const BOYA = ['H&E', 'PAS', 'Masson trikrom', 'Gümüş', 'Orsein', 'Toluidin mavisi', 'Alcian mavisi', 'Sudan', 'Diğer'];
const DURUM = ['Sağlam', 'Solmuş', 'Kırık', 'Kayıp'];
const dersL = k => (DERS.find(d => d.k === k) || { l: k }).l;
const bad = p => p.durum && p.durum !== 'Sağlam';

let PREPS = [];
let onChange = () => { };
export const onPrepsChange = fn => { onChange = fn; };

// Takvimde bir uygulamanın altında o derse bağlı preparatları gösterir
export function linkedHtml(k) {
  const ps = PREPS.filter(p => (p.dersler || []).includes(k));
  if (!ps.length) return ready ? '<div class="note">Arşivde bu derse bağlı preparat yok.</div>' : '';
  return `<div class="linked">${ps.map(p => `<button class="lk" data-open="${esc(p.id)}">${esc(p.kutu)}/${esc(p.sira)} ${esc(p.organ)}${bad(p) ? ' ⚠' : ''}</button>`).join('')}</div>`;
}

function render() {
  const q = trLower($('#q').value.trim()), fd = $('#fd').value, fb = $('#fb').value, fs = $('#fs').value;
  const list = PREPS.filter(p => {
    if (fd && !(p.dersler || []).includes(fd)) return false;
    if (fb && p.boya !== fb) return false;
    if (fs === 'sorun' && !bad(p)) return false;
    if (q && !trLower([p.organ, p.boya, p.yapilar, p.kutu + '/' + p.sira, p.notlar].join(' ')).includes(q)) return false;
    return true;
  });
  $('#astats').innerHTML = PREPS.length ? `<span><b>${PREPS.length}</b>preparat</span><span><b>${new Set(PREPS.map(p => p.kutu)).size}</b>kutu</span><span><b>${PREPS.filter(bad).length}</b>sorunlu</span>` : '';
  const groups = {};
  list.forEach(p => (groups[p.kutu || '?'] = groups[p.kutu || '?'] || []).push(p));
  const keys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
  $('#boxes').innerHTML = keys.map(k => `<div class="box"><h4>Kutu ${esc(k)}</h4>${groups[k].sort((a, b) => String(a.sira).localeCompare(String(b.sira), 'tr', { numeric: true })).map(p => `
    <button class="slide" data-open="${esc(p.id)}">
      ${p.kapak && String(p.kapak).startsWith('data:image/') ? `<img class="thumb" alt="" src="${esc(p.kapak)}">` : '<span class="thumb"></span>'}
      <span><span class="sname">${esc(p.organ)}</span><br><span class="ssub">${esc(p.boya)} · ${esc(p.adet ?? 1)} adet · ${(p.dersler || []).map(d => esc(dersL(d).split(' · ')[0])).join(', ') || 'derse bağlı değil'}</span></span>
      <span class="no">${esc(k)}/${esc(p.sira)}<br><span class="st ${bad(p) ? 'bad' : 'ok'}">${esc(p.durum || 'Sağlam')}</span></span>
    </button>`).join('')}</div>`).join('');
  $('#amsg').textContent = !ready ? 'Arşiv için Firebase ayarlarının girilmesi gerekiyor.' : PREPS.length ? (list.length ? '' : 'Aramaya uyan preparat yok.') : 'Arşiv boş. İlk preparatı "+ Preparat ekle" ile ekleyin.';
}

async function loadPhotos(id) {
  const s = await F.getDocs(F.query(F.collection(db, 'preps', id, 'photos'), F.orderBy('t')));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
const safeImg = u => String(u || '').startsWith('data:image/') ? u : '';

async function openDetail(id) {
  const p = PREPS.find(x => x.id === id); if (!p) return;
  sheet(`<div class="sh"><div><div class="date">Kutu ${esc(p.kutu)} · Sıra ${esc(p.sira)}</div><h3>${esc(p.organ)}</h3></div><button class="x" aria-label="Kapat">×</button></div>
   <div class="photos" id="dph"><p class="note">Fotoğraflar yükleniyor…</p></div>
   ${p.yapilar ? `<h4 style="margin:10px 0 4px">Görülecek yapılar</h4><ul class="plain">${String(p.yapilar).split(/\n|;/).filter(s => s.trim()).map(s => `<li>${esc(s.trim())}</li>`).join('')}</ul>` : ''}
   <dl class="kv"><dt>Boya</dt><dd>${esc(p.boya)}</dd><dt>Adet</dt><dd>${esc(p.adet ?? 1)}</dd><dt>Durum</dt><dd>${esc(p.durum || 'Sağlam')}</dd>${p.notlar ? `<dt>Not</dt><dd>${esc(p.notlar)}</dd>` : ''}</dl>
   <div class="dtags">${(p.dersler || []).map(d => `<span class="dt">${esc(dersL(d))}</span>`).join('')}</div>
   <div class="acts">${state.approved ? '<button class="btn" id="ed">Düzenle</button>' : ''}<button class="btn sec" data-close>Kapat</button></div>`);
  if (state.approved) $('#ed').addEventListener('click', () => openForm(p));
  try {
    const ph = await loadPhotos(id);
    const el = $('#dph'); if (!el) return;
    el.innerHTML = ph.length ? ph.map(x => `<img alt="${esc(p.organ)}" src="${esc(safeImg(x.data))}">`).join('') : '<p class="note">Henüz fotoğraf yok.</p>';
  } catch (e) { const el = $('#dph'); if (el) el.innerHTML = '<p class="note">Fotoğraflar yüklenemedi.</p>'; }
}

async function openForm(p) {
  const isNew = !p;
  p = p || { kutu: '', sira: '', organ: '', boya: 'H&E', adet: 1, durum: 'Sağlam', yapilar: '', notlar: '', dersler: [] };
  let photos = isNew ? [] : await loadPhotos(p.id).catch(() => []);
  const removed = [], added = [];
  sheet(`<div class="sh"><h3>${isNew ? 'Yeni preparat' : 'Preparatı düzenle'}</h3><button class="x" type="button" aria-label="Kapat">×</button></div>
  <form id="pf">
   <div class="row"><div><label for="p-kutu">Kutu no</label><input id="p-kutu" required value="${esc(p.kutu)}" inputmode="numeric"></div>
   <div><label for="p-sira">Sıra no</label><input id="p-sira" required value="${esc(p.sira)}" inputmode="numeric"></div>
   <div><label for="p-adet">Adet</label><input id="p-adet" type="number" min="0" value="${esc(p.adet)}"></div></div>
   <div class="row"><div><label for="p-organ">Organ / doku</label><input id="p-organ" required value="${esc(p.organ)}" placeholder="Trakea"></div></div>
   <div class="row"><div><label for="p-boya">Boya</label><select id="p-boya">${BOYA.map(b => `<option${b === p.boya ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>
   <div><label for="p-durum">Durum</label><select id="p-durum">${DURUM.map(b => `<option${b === p.durum ? ' selected' : ''}>${b}</option>`).join('')}</select></div></div>
   <label for="p-yap">Görülecek yapılar (her satıra bir tane)</label><textarea id="p-yap">${esc(p.yapilar)}</textarea>
   <label style="margin-top:10px">Kullanıldığı uygulamalar</label>
   <div class="cks">${DERS.map(d => `<label><input type="checkbox" value="${d.k}"${(p.dersler || []).includes(d.k) ? ' checked' : ''}> ${d.l}</label>`).join('')}</div>
   <label for="p-not">Not</label><input id="p-not" value="${esc(p.notlar)}" placeholder="Lamel kenarı çatlak">
   <label style="margin-top:10px">Fotoğraflar</label>
   <div class="photos" id="pp"></div>
   <input type="file" id="p-file" accept="image/*" multiple aria-label="Fotoğraf ekle">
   <p class="err" id="pmsg"></p>
   <div class="acts"><button class="btn" id="psave">Kaydet</button><button class="btn sec" data-close type="button">Vazgeç</button>${isNew ? '' : '<button class="btn del" type="button" id="pdel">Sil</button>'}</div>
  </form>`);
  const draw = () => {
    const all = [...photos.filter(x => !removed.includes(x.id)).map(x => ({ key: x.id, data: x.data })), ...added.map((d, i) => ({ key: 'n' + i, data: d }))];
    $('#pp').innerHTML = all.map(x => `<div><img alt="" src="${esc(safeImg(x.data))}"><button type="button" class="btn sec" style="width:100%;margin-top:4px" data-rm="${x.key}">Kaldır</button></div>`).join('');
  };
  draw();
  $('#pp').addEventListener('click', e => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    const k = b.dataset.rm; if (k.startsWith('n')) added.splice(+k.slice(1), 1); else removed.push(k); draw();
  });
  $('#p-file').addEventListener('change', async e => {
    $('#pmsg').textContent = 'Fotoğraf hazırlanıyor…';
    try { for (const fl of e.target.files) added.push(await shrink(fl)); $('#pmsg').textContent = ''; }
    catch (err) { $('#pmsg').textContent = 'Fotoğraf okunamadı.'; }
    e.target.value = ''; draw();
  });
  $('#pf').addEventListener('submit', async e => {
    e.preventDefault();
    const body = {
      kutu: $('#p-kutu').value.trim(), sira: $('#p-sira').value.trim(), organ: $('#p-organ').value.trim(),
      boya: $('#p-boya').value, adet: Number($('#p-adet').value) || 0, durum: $('#p-durum').value,
      yapilar: $('#p-yap').value.trim(), notlar: $('#p-not').value.trim(),
      dersler: $$('.cks input:checked').map(i => i.value),
      guncelleyen: state.user.uid, zaman: F.serverTimestamp()
    };
    $('#psave').disabled = true; $('#pmsg').textContent = 'Kaydediliyor…';
    try {
      const ref = isNew ? F.doc(F.collection(db, 'preps')) : F.doc(db, 'preps', p.id);
      const kept = photos.filter(x => !removed.includes(x.id));
      const first = kept[0]?.data || added[0];
      body.kapak = first ? await thumb(first) : '';
      await F.setDoc(ref, body);
      for (const id of removed) await F.deleteDoc(F.doc(db, 'preps', ref.id, 'photos', id));
      for (const d of added) await F.addDoc(F.collection(db, 'preps', ref.id, 'photos'), { data: d, t: Date.now(), ekleyen: state.user.uid });
      closeSheet(); toast('Kaydedildi');
    } catch (err) {
      $('#psave').disabled = false;
      $('#pmsg').textContent = err?.code === 'permission-denied' ? 'Kaydetme izniniz yok. Hesabınızın onaylanmış olması gerekiyor.' : 'Kaydedilemedi, tekrar deneyin.';
    }
  });
  const del = $('#pdel');
  if (del) del.addEventListener('click', async () => {
    if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Emin misin? Tekrar bas'; return; }
    try {
      for (const x of photos) await F.deleteDoc(F.doc(db, 'preps', p.id, 'photos', x.id));
      await F.deleteDoc(F.doc(db, 'preps', p.id)); closeSheet(); toast('Silindi');
    } catch (err) { $('#pmsg').textContent = 'Silinemedi.'; }
  });
}

// Liste için küçük kapak görseli (yaklaşık 10 KB)
function thumb(dataUrl) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'), s = 160 / Math.max(im.width, im.height); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.6)); };
    im.onerror = () => res('');
    im.src = dataUrl;
  });
}

export function initArsiv() {
  $('#fd').insertAdjacentHTML('beforeend', DERS.map(d => `<option value="${d.k}">${d.l}</option>`).join(''));
  $('#fb').insertAdjacentHTML('beforeend', BOYA.map(b => `<option>${esc(b)}</option>`).join(''));
  ['#q', '#fd', '#fb', '#fs'].forEach(s => $(s).addEventListener('input', render));
  document.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) openDetail(b.dataset.open); });
  $('#add').addEventListener('click', () => {
    if (state.approved) openForm(null);
    else { location.hash = 'profil'; toast(state.user ? 'Hesabınız onay bekliyor.' : 'Preparat eklemek için giriş yapın.'); }
  });
  onState(s => { $('#add').textContent = s.approved ? '+ Preparat ekle' : '+ Preparat ekle (giriş gerekir)'; });
  render();
  if (!ready) return;
  F.onSnapshot(F.collection(db, 'preps'), s => { PREPS = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); onChange(); },
    () => { $('#amsg').textContent = 'Arşiv yüklenemedi.'; });
}
