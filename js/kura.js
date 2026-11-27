// Kura: üyeler (ve istenirse listede olmayan adlar) arasından kişi seçme, sıralama ya da görevlere dağıtma.
// Kura tarayıcının güvenli rastgele sayı üreteciyle çekilir ve sonuç herkesin görebileceği şekilde kaydedilir;
// kayıtlar sonradan değiştirilemez, böylece "tekrar çekildi mi" herkes görebilir.
import { $, esc, state, onState, toast } from './util.js';
import { ready, db, F } from './fb.js';

let kisiler = [], gecmis = [], tur = 'sec', unsub = null, sonGoster = null;

// 0 ≤ r < n, modulo sapması olmadan
function rastgele(n) {
  const s = new Uint32Array(1), sinir = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(s); while (s[0] >= sinir);
  return s[0] % n;
}
function karistir(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rastgele(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const TURLER = { sec: 'Kişi seç', sirala: 'Sırala', dagit: 'Görevlere dağıt' };
const tarihSaat = t => t?.toDate ? t.toDate().toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';

function sonucHtml(k) {
  if (k.tur === 'sec') return `<ol class="kura-son">${k.sonuc.map(x => `<li><b>${esc(x)}</b></li>`).join('')}</ol>`;
  if (k.tur === 'sirala') return `<ol class="kura-son">${k.sonuc.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;
  return `<div class="kura-son">${k.sonuc.map(x => `<div class="kura-g"><span>${esc(x.gorev)}</span><b>${x.kisiler.map(esc).join(', ') || '—'}</b></div>`).join('')}</div>`;
}

function render() {
  const el = $('#v-kura'); if (!el) return;
  if (!ready || !state.approved) { el.innerHTML = '<div class="banner">Kura çekmek için onaylı bir hesapla <a href="#profil">giriş yap</a>.</div>'; return; }
  const uyeler = kisiler.filter(u => u.onayli).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  el.innerHTML = `
    ${sonGoster ? `<div class="card kura-yeni" style="max-width:none"><div class="date">Az önce çekildi</div><h3>${esc(sonGoster.baslik)}</h3>${sonucHtml(sonGoster)}</div>` : ''}
    <form class="card" id="f-kura" style="max-width:none">
      <h3>Yeni kura</h3>
      <div class="field"><label for="ku-bas">Ne için?</label><input id="ku-bas" required maxlength="80" placeholder="Ör. Ocak nöbet sırası"></div>
      <div class="chips" role="tablist">${Object.entries(TURLER).map(([k, ad]) => `<button type="button" class="chip" data-kutur="${k}" aria-pressed="${tur === k}">${ad}</button>`).join('')}</div>
      ${tur === 'sec' ? `<div class="field"><label for="ku-n">Kaç kişi seçilsin?</label><input id="ku-n" type="number" min="1" value="1" inputmode="numeric" style="max-width:8em"></div>` : ''}
      ${tur === 'dagit' ? `<div class="field"><label for="ku-gorev">Görevler (her satıra bir tane)</label><textarea id="ku-gorev" rows="4" placeholder="1. masa\n2. masa\n3. masa"></textarea></div>
        <div class="field"><label for="ku-gn">Her göreve kaç kişi?</label><input id="ku-gn" type="number" min="1" value="1" inputmode="numeric" style="max-width:8em"></div>` : ''}
      ${tur === 'sirala' ? '<p class="note">Seçili kişilerin hepsi rastgele sıraya dizilir.</p>' : ''}
      <fieldset class="kura-kisi"><legend>Kimler katılıyor? <button type="button" class="linkbtn" data-kuhep="1">Hepsi</button> · <button type="button" class="linkbtn" data-kuhep="0">Hiçbiri</button></legend>
        ${uyeler.map(u => `<label><input type="checkbox" value="${esc(u.ad)}" checked> ${esc(u.ad)}</label>`).join('')}
      </fieldset>
      <div class="field"><label for="ku-ek">Listede olmayanlar (isteğe bağlı, virgülle ya da alt alta)</label><textarea id="ku-ek" rows="2"></textarea></div>
      <button class="btn" type="submit">🎲 Kurayı çek</button>
      <p class="err" id="ku-err"></p>
      <p class="note">Kura çekildiği anda kaydedilir ve herkes görür; sonradan değiştirilemez.</p>
    </form>
    <h3 style="margin:22px 0 8px">Çekilen kuralar</h3>
    ${gecmis.length ? gecmis.map(k => `<div class="card kura-kayit" style="max-width:none">
      <div class="date">${esc(tarihSaat(k.t))} · ${esc(k.cekenAd || '')} çekti · ${esc(TURLER[k.tur] || '')} · ${k.katilimcilar?.length || 0} kişi arasından</div>
      <h3>${esc(k.baslik)}</h3>${sonucHtml(k)}
      <details><summary>Katılanlar</summary><p class="note">${(k.katilimcilar || []).map(esc).join(', ')}</p></details>
      ${state.admin ? `<button class="linkbtn" data-kusil="${esc(k.id)}">Sil</button>` : ''}
    </div>`).join('') : '<p class="note">Henüz kura çekilmedi.</p>'}`;
}

async function cek(e) {
  e.preventDefault();
  const err = $('#ku-err'), baslik = $('#ku-bas').value.trim();
  const ek = $('#ku-ek').value.split(/[,\n]/).map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const katilimcilar = [...new Set([...[...document.querySelectorAll('.kura-kisi input:checked')].map(i => i.value), ...ek])];
  if (katilimcilar.length < 2) { err.textContent = 'En az 2 kişi seç.'; return; }
  let sonuc;
  if (tur === 'sec') {
    const n = Number($('#ku-n').value);
    if (!(n >= 1 && n < katilimcilar.length)) { err.textContent = `1 ile ${katilimcilar.length - 1} arasında bir sayı gir.`; return; }
    sonuc = karistir(katilimcilar).slice(0, n);
  } else if (tur === 'sirala') sonuc = karistir(katilimcilar);
  else {
    const gorevler = $('#ku-gorev').value.split('\n').map(x => x.trim()).filter(Boolean), gn = Number($('#ku-gn').value) || 1;
    if (!gorevler.length) { err.textContent = 'En az bir görev yaz.'; return; }
    if (gorevler.length * gn > katilimcilar.length) { err.textContent = `${gorevler.length} görev × ${gn} kişi için ${gorevler.length * gn} kişi gerekiyor, ${katilimcilar.length} kişi seçili.`; return; }
    const k = karistir(katilimcilar);
    sonuc = gorevler.map((g, i) => ({ gorev: g, kisiler: k.slice(i * gn, i * gn + gn) }));
  }
  const kayit = { baslik, tur, katilimcilar, sonuc, ceken: state.user.uid, cekenAd: state.profile?.ad || '', t: F.serverTimestamp() };
  try {
    $('#f-kura button[type=submit]').disabled = true; err.textContent = '🎲 Çekiliyor…';
    await new Promise(r => setTimeout(r, 700));
    await F.addDoc(F.collection(db, 'kuralar'), kayit);
    sonGoster = { ...kayit }; render(); scrollTo(0, 0); toast('Kura çekildi');
  } catch (x) { console.error(x); err.textContent = 'Kaydedilemedi, kura geçersiz sayıldı. Tekrar dene.'; $('#f-kura button[type=submit]').disabled = false; }
}

export function initKura() {
  const el = $('#v-kura'); if (!el) return;
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.kutur) { tur = b.dataset.kutur; sonGoster = null; const bas = $('#ku-bas')?.value; render(); if (bas) $('#ku-bas').value = bas; }
    else if (b.dataset.kuhep) document.querySelectorAll('.kura-kisi input').forEach(i => { i.checked = b.dataset.kuhep === '1'; });
    else if (b.dataset.kusil) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Emin misin? Tekrar bas'; return; }
      try { await F.deleteDoc(F.doc(db, 'kuralar', b.dataset.kusil)); toast('Silindi'); } catch (x) { toast('Silinemedi'); }
    }
  });
  el.addEventListener('submit', e => { if (e.target.id === 'f-kura') cek(e); });
  const yeniden = () => { if (!el.contains(document.activeElement) || document.activeElement.tagName === 'BUTTON') render(); };
  onState(s => {
    if (ready && s.approved && !unsub) {
      const u1 = F.onSnapshot(F.query(F.collection(db, 'kuralar'), F.orderBy('t', 'desc'), F.limit(30)), q => { gecmis = q.docs.map(d => ({ id: d.id, ...d.data() })); yeniden(); }, () => { });
      const u2 = F.onSnapshot(F.collection(db, 'users'), q => { kisiler = q.docs.map(d => ({ id: d.id, ...d.data() })); yeniden(); }, () => { });
      unsub = () => { u1(); u2(); };
    }
    if (!s.approved && unsub) { unsub(); unsub = null; }
    render();
  });
}
