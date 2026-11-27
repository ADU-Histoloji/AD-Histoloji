// Histoloji uygulama sınavlarında gözetmenlik. Her oturumda 4 grup var, her grubun bir hocası olur ve
// her hocaya (genelde) 2 gözetmen verilir. Asistan boş bir gruba "Gözetmen ol" der; yönetici hoca adını,
// gruptaki gözetmen sayısını ve kişileri düzenler.
import { $, esc, state, onState, toast, sheet, closeSheet } from './util.js';
import { ready, db, F } from './fb.js';

export const GRUP_SAYISI = 4, VARSAYILAN_KAP = 2;
export const gozetmenliSinav = e => e.k === 'S' && /uygulama sınav/i.test(e.topic || '');
const bugun = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const tr = iso => iso.split('-').reverse().join('.');

let atama = [], ayar = {}, kisiler = [], olaylar = [], acikEv = null, unsub = null;
const dinleyiciler = new Set();
const haber = () => { dinleyiciler.forEach(fn => fn()); if (acikEv) formuCiz(); };
export const onGozetmenDegis = fn => dinleyiciler.add(fn);

export const gruplar = evId => {
  const g = ayar[evId]?.gruplar || [];
  return Array.from({ length: GRUP_SAYISI }, (_, i) => ({ hoca: g[i]?.hoca || '', kap: Number(g[i]?.kap ?? VARSAYILAN_KAP) }));
};
export const atananlar = evId => atama.filter(a => a.ev === evId);
export const benimGozetmenliklerim = () => {
  const ben = state.user?.uid; if (!ben) return [];
  return atama.filter(a => a.uid === ben).map(a => ({ a, e: olaylar.find(e => e.id === a.ev) })).filter(x => x.e && x.e.date >= bugun())
    .sort((x, y) => (x.e.date + x.e.t).localeCompare(y.e.date + y.e.t));
};
export function eksikSayisi(evId) {
  const g = gruplar(evId), at = atananlar(evId);
  return g.reduce((t, x, i) => t + Math.max(0, x.kap - at.filter(a => a.grup === i).length), 0);
}
// Bu öğretim yılında kişinin kaç gözetmenlik aldığı (adil dağılım için)
const sayac = uid => atama.filter(a => a.uid === uid).length;
const adi = uid => kisiler.find(u => u.id === uid)?.ad || 'Bilinmeyen kişi';

// Takvimdeki sınav kartının altına konan özet ve düğme
export function gozetmenKarti(e) {
  if (!ready || !state.approved || !e.id || !gozetmenliSinav(e)) return '';
  const at = atananlar(e.id), kap = gruplar(e.id).reduce((t, g) => t + g.kap, 0), ben = at.some(a => a.uid === state.user.uid);
  return `<div class="anl-b"><span class="who">Gözetmen: <b>${at.length}/${kap}</b>${ben ? ' · <span class="pill">Sen de varsın</span>' : ''}</span>
    <button class="btn sec kucuk" data-gozetmen="${esc(e.id)}">${ben || e.date < bugun() ? 'Gözetmenler' : at.length < kap ? '📝 Gözetmen ol' : 'Gözetmenler'}</button></div>`;
}

export function gozetmenFormu(evId) { acikEv = evId; formuCiz(true); }

function formuCiz(ilk = false) {
  const e = olaylar.find(x => x.id === acikEv);
  if (!e) { acikEv = null; return; }
  if (!ilk && !$('#gz-form')) { acikEv = null; return; } // sayfa kapatılmış
  const ben = state.user.uid, admin = state.admin, gecmis = e.date < bugun();
  const at = atananlar(e.id), benimki = at.find(a => a.uid === ben);
  const g = gruplar(e.id);
  const html = `<div class="sh"><div><div class="date">${esc(tr(e.date))} · ${esc(e.t)}${e.g ? ' · ' + esc(e.g) + ' grupları' : ''}</div><h3>Gözetmenler</h3></div><button class="x" type="button" aria-label="Kapat">×</button></div>
  <div id="gz-form">
    <p class="note">${esc(e.s)} · ${esc(e.topic)}</p>
    ${g.map((x, i) => {
      const kisi = at.filter(a => a.grup === i), dolu = kisi.length >= x.kap;
      return `<div class="gz-grup">
        <div class="gz-bas"><b>${i + 1}. grup</b>${x.hoca ? ` · ${esc(x.hoca)}` : ''} <span class="pill${kisi.length < x.kap ? ' wait' : ''}">${kisi.length}/${x.kap}</span></div>
        <div class="gz-kisiler">${kisi.map(a => `<span class="gz-k${a.uid === ben ? ' ben' : ''}">${esc(adi(a.uid))}${(admin || a.uid === ben) && !gecmis ? ` <button class="gz-sil" data-gzsil="${esc(a.uid)}" aria-label="Çıkar">×</button>` : ''}</span>`).join('') || '<span class="mute">Henüz kimse yok</span>'}</div>
        ${!gecmis && !benimki && !dolu ? `<button class="btn sec kucuk" data-gzol="${i}">Bu gruba gözetmen ol</button>` : ''}
        ${!gecmis && benimki && benimki.grup !== i && !dolu ? `<button class="linkbtn" data-gzol="${i}">Bu gruba geç</button>` : ''}
        ${admin && !gecmis ? `<details class="gz-ayar"><summary>Düzenle</summary>
          <label>Hoca<input data-gzhoca="${i}" value="${esc(x.hoca)}" maxlength="60" placeholder="Ör. Prof. Dr. …"></label>
          <label>Gözetmen sayısı<span class="gz-kap"><button type="button" class="btn sec kucuk" data-gzkap="${i}" data-d="-1">−</button><b>${x.kap}</b><button type="button" class="btn sec kucuk" data-gzkap="${i}" data-d="1">+</button></span></label>
          <label>Kişi ekle<select data-gzekle="${i}"><option value="">Seç…</option>${kisiler.filter(u => u.onayli && !at.some(a => a.uid === u.id)).sort((a, b) => sayac(a.id) - sayac(b.id) || a.ad.localeCompare(b.ad, 'tr')).map(u => `<option value="${esc(u.id)}">${esc(u.ad)} (${sayac(u.id)} görev)</option>`).join('')}</select></label>
        </details>` : ''}
      </div>`;
    }).join('')}
    ${admin ? '<p class="note">Kişi eklerken parantezde bu yıl aldığı gözetmenlik sayısı yazar; liste en az görev alandan başlar.</p>' : ''}
  </div>`;
  const acik = [...document.querySelectorAll('#gz-form details[open]')].map(d => d.querySelector('[data-gzhoca]')?.dataset.gzhoca);
  if (!ilk && document.activeElement?.matches?.('#gz-form input')) return; // hoca adı yazılırken yeniden çizme
  const kaydirma = ilk ? 0 : ($('.sheet')?.scrollTop || 0);
  sheet(html);
  if (kaydirma && $('.sheet')) $('.sheet').scrollTop = kaydirma;
  document.querySelectorAll('#gz-form details').forEach(d => { if (acik.includes(d.querySelector('[data-gzhoca]')?.dataset.gzhoca)) d.open = true; });
}

async function ayarKaydet(evId, i, patch) {
  const g = gruplar(evId).map((x, j) => j === i ? { ...x, ...patch } : x);
  await F.setDoc(F.doc(db, 'sinavGruplari', evId), { gruplar: g });
}
const atamaRef = (evId, uid) => F.doc(db, 'gozetmenler', `${evId}_${uid}`);
async function ata(evId, uid, grup) { await F.setDoc(atamaRef(evId, uid), { ev: evId, uid, grup, t: F.serverTimestamp() }); }

async function onClick(ev) {
  const b = ev.target.closest('button'); if (!b) return;
  const evId = acikEv;
  try {
    if (b.dataset.gzol !== undefined) {
      const i = Number(b.dataset.gzol), g = gruplar(evId)[i], dolu = atananlar(evId).filter(a => a.grup === i).length >= g.kap;
      if (dolu) { toast('Bu grup doldu'); return; }
      await ata(evId, state.user.uid, i); toast('Gözetmen olarak yazıldın');
    } else if (b.dataset.gzsil) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Emin misin?'; return; }
      await F.deleteDoc(atamaRef(evId, b.dataset.gzsil)); toast('Çıkarıldı');
    } else if (b.dataset.gzkap !== undefined) {
      const i = Number(b.dataset.gzkap), k = Math.max(0, Math.min(8, gruplar(evId)[i].kap + Number(b.dataset.d)));
      await ayarKaydet(evId, i, { kap: k });
    }
  } catch (x) { console.error(x); toast('Kaydedilemedi'); }
}
async function onChange(ev) {
  const evId = acikEv, t = ev.target;
  try {
    if (t.dataset.gzekle !== undefined && t.value) { await ata(evId, t.value, Number(t.dataset.gzekle)); toast('Eklendi'); }
    else if (t.dataset.gzhoca !== undefined) { await ayarKaydet(evId, Number(t.dataset.gzhoca), { hoca: t.value.trim() }); t.blur(); toast('Kaydedildi'); }
  } catch (x) { console.error(x); toast('Kaydedilemedi'); }
}

export function initGozetmen(onEventsFn) {
  onEventsFn(ev => { olaylar = ev.filter(gozetmenliSinav); });
  $('#ovl').addEventListener('click', e => { if (e.target.closest('#gz-form')) onClick(e); });
  $('#ovl').addEventListener('change', e => { if (e.target.closest('#gz-form')) onChange(e); });
  if (!ready) return;
  onState(s => {
    if (s.approved && !unsub) {
      const u1 = F.onSnapshot(F.collection(db, 'gozetmenler'), q => { atama = q.docs.map(d => d.data()); haber(); }, () => { });
      const u2 = F.onSnapshot(F.collection(db, 'sinavGruplari'), q => { ayar = {}; q.docs.forEach(d => { ayar[d.id] = d.data(); }); haber(); }, () => { });
      const u3 = F.onSnapshot(F.collection(db, 'users'), q => { kisiler = q.docs.map(d => ({ id: d.id, ...d.data() })); haber(); }, () => { });
      unsub = () => { u1(); u2(); u3(); };
    }
    if (!s.approved && unsub) { unsub(); unsub = null; atama = []; ayar = {}; }
  });
}
