import { temaKarti } from './tema.js';
import { $, esc, state, onState, toast, listeKimligi, girisKimligi, KOD_MIN } from './util.js';
import { ready, auth, db, A, F } from './fb.js';
import { EMAIL_DOMAIN } from './config.js';
import { durum, bildirimAc, bildirimKapat, DURUM_METNI } from './bildirim.js';
import { onEvents, etkinlikler, konuFormu, bosKonu } from './takvim.js';
import { konuId, MASA_SAYISI, MASA_KAP } from './uygulamalar.js';
import { benimGozetmenliklerim, gruplar as gzGruplar, gozetmenFormu, onGozetmenDegis, oturumMetni } from './gozetmen.js';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const pinOk = p => /^\d{6}$/.test(p);
let mode = 'giris';
let girisKontrol = false;
let config = null, configLoaded = false;
let anlaticilar = {}, kisiler = [], unsubK = null, masaDegis = false;
const GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const tarihGun = iso => { const d = new Date(iso + 'T12:00:00'); return `${iso.split('-').reverse().join('.')} ${GUN[d.getDay()]}`; };

const dogumFields = (g = '', a = '', goster = true) => `
  <div class="row2">
    <div class="field"><label for="dg">Doğum günü</label><select id="dg"><option value="">Gün</option>${Array.from({ length: 31 }, (_, i) => `<option${+g === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></div>
    <div class="field"><label for="da">Ay</label><select id="da"><option value="">Ay</option>${AYLAR.map((m, i) => `<option value="${i + 1}"${+a === i + 1 ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
  </div>
  <div class="cks"><label><input type="checkbox" id="dgos"${goster ? ' checked' : ''}> Doğum günüm takvimde görünsün</label></div>`;

function renderGuest() {
  const el = $('#v-profil');
  if (!configLoaded) { el.innerHTML = '<p class="note">Yükleniyor…</p>'; return; }
  const kurulum = !config;
  el.innerHTML = `
    <div class="chips" role="tablist">
      <button class="chip" data-m="giris" aria-pressed="${mode === 'giris'}">Giriş yap</button>
      <button class="chip" data-m="kayit" aria-pressed="${mode === 'kayit'}">Kayıt ol</button>
    </div>
    ${mode === 'giris' ? `
    <form class="card" id="f-giris">
      <h3>Giriş yap</h3>
      <div class="field"><label for="g-ad">Ad soyad</label><input id="g-ad" required autocomplete="username" autocapitalize="words" placeholder="Kayıt olurken yazdığın gibi"></div>
      <div class="field"><label for="g-pin">PIN</label><input id="g-pin" class="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" required></div>
      <button class="btn" type="submit">Giriş yap</button>
      <p class="err" id="g-err"></p>
      <p class="note">Henüz hesabın yoksa önce "Kayıt ol". PIN'ini unuttuysan bir yöneticiye haber ver.</p>
    </form>` : `
    <form class="card" id="f-kayit">
      <h3>${kurulum ? 'İlk kurulum' : 'Kayıt ol'}</h3>
      ${kurulum ? '<p class="banner">Uygulamaya ilk kaydolan sensin. Hesabın yönetici olarak açılacak. Aşağıda belirlediğin bölüm kodunu diğer asistanlarla paylaşacaksın.</p>' : ''}
      <div class="field"><label for="k-kod">${kurulum ? `Bölüm kodunu belirle (en az ${KOD_MIN} karakter)` : 'Bölüm kodu'}</label><input id="k-kod" required autocomplete="off" autocapitalize="off" placeholder="${kurulum ? 'histo2027' : 'WhatsApp grubunda paylaşılan kod'}"></div>
      <div class="field"><label for="k-ad">Ad soyad</label><input id="k-ad" required autocomplete="name" placeholder="Ayşe Kaya"></div>
      <div class="row2">
        <div class="field"><label for="k-pin">6 haneli PIN</label><input id="k-pin" class="pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required></div>
        <div class="field"><label for="k-pin2">PIN tekrar</label><input id="k-pin2" class="pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required></div>
      </div>
      ${dogumFields()}
      <button class="btn" type="submit">${kurulum ? 'Kurulumu tamamla' : 'Kayıt ol'}</button>
      <p class="err" id="k-err"></p>
    </form>`}`;
  el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.m; renderGuest(); }));
  if (mode === 'giris') $('#f-giris').addEventListener('submit', giris);
  else $('#f-kayit').addEventListener('submit', kayit);
}

async function giris(e) {
  e.preventDefault();
  const ad = $('#g-ad').value, pin = $('#g-pin').value.trim(), err = $('#g-err');
  if (!pinOk(pin)) { err.textContent = 'PIN 6 rakamdan oluşmalı.'; return; }
  err.textContent = 'Giriş yapılıyor…';
  try {
    const g = await F.getDoc(F.doc(db, 'girisler', await girisKimligi(ad)));
    if (!g.exists()) throw { code: 'ad' };
    await A.signInWithEmailAndPassword(auth, g.data().email, pin);
    err.textContent = ''; location.hash = 'takvim'; location.reload();
  }
  catch (x) { err.textContent = x?.code === 'auth/too-many-requests' ? 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.' : 'Ad ya da PIN hatalı. Adını kayıt olurken yazdığın gibi yaz.'; }
}

async function kayit(e) {
  e.preventDefault();
  const err = $('#k-err'), kod = ($('#k-kod')?.value || '').trim(), ad = $('#k-ad').value.trim().replace(/\s+/g, ' '),
    pin = $('#k-pin').value.trim(), pin2 = $('#k-pin2').value.trim();
  const dg = +$('#dg').value || null, da = +$('#da').value || null, dgos = $('#dgos').checked;
  if (ad.length < 3) { err.textContent = 'Adını ve soyadını yaz.'; return; }
  if (!pinOk(pin)) { err.textContent = 'PIN 6 rakamdan oluşmalı.'; return; }
  if (pin !== pin2) { err.textContent = 'İki PIN aynı değil.'; return; }
  if ((dg && !da) || (!dg && da)) { err.textContent = 'Doğum gününü gün ve ay olarak birlikte seç ya da ikisini de boş bırak.'; return; }
  const kurulum = !config;
  if (kurulum && kod.length < KOD_MIN) { err.textContent = `Bölüm kodu en az ${KOD_MIN} karakter olmalı.`; return; }
  err.textContent = 'Kontrol ediliyor…';
  const liste = await listeKimligi(kod);
  try {
    if (!kurulum && !(await F.getDoc(F.doc(db, 'kodlar', liste))).exists()) { err.textContent = 'Bölüm kodu yanlış.'; return; }
    if ((await F.getDoc(F.doc(db, 'girisler', await girisKimligi(ad)))).exists()) { err.textContent = 'Bu adla bir kayıt zaten var. Giriş yapmayı dene.'; return; }
  } catch (x) { console.error(x); err.textContent = 'Kontrol edilemedi. İnternet bağlantını kontrol et.'; return; }
  err.textContent = 'Hesap oluşturuluyor…';
  const email = 'u' + crypto.getRandomValues(new Uint32Array(2)).join('') + '@' + EMAIL_DOMAIN;
  let cred;
  try { cred = await A.createUserWithEmailAndPassword(auth, email, pin); }
  catch (x) {
    console.error(x);
    err.textContent = x?.code === 'auth/operation-not-allowed' ? 'Firebase\'de E-posta/Şifre giriş yöntemi açık değil.'
      : x?.code === 'auth/unauthorized-domain' || x?.code === 'auth/requests-from-referer-are-blocked' ? 'Bu adres Firebase\'de yetkili alan adı olarak eklenmemiş.'
      : 'Hesap oluşturulamadı. İnternet bağlantını kontrol edip tekrar dene.';
    return;
  }
  await writeProfile(cred.user.uid, email, { ad, dg, da, dgos, kurulum, liste }, err);
}

// Veritabanı kayıtlarını yazar. Yarım kalmış bir kaydı tamamlamak için de kullanılır.
async function writeProfile(uid, email, { ad, dg, da, dgos, kurulum, liste }, err) {
  try {
    if (kurulum) await F.setDoc(F.doc(db, 'config', 'public'), { kurucu: uid });
    await F.setDoc(F.doc(db, 'users', uid), {
      ad, rol: kurulum ? 'yonetici' : 'asistan', onayli: kurulum, dogumGun: dg, dogumAy: da, dogumGoster: dgos,
      masa: null, seminerSira: null, kayit: F.serverTimestamp()
    });
    if (kurulum) {
      await F.setDoc(F.doc(db, 'kodlar', liste), { t: F.serverTimestamp() });
      await F.setDoc(F.doc(db, 'config', 'uye'), { kid: liste });
    }
    const gRef = F.doc(db, 'girisler', await girisKimligi(ad));
    if (!(await F.getDoc(gRef)).exists()) await F.setDoc(gRef, { email, uid });
    err.textContent = '';
    toast(kurulum ? 'Kurulum tamam, yönetici hesabın açıldı' : 'Kaydın alındı, yönetici onayı bekleniyor');
    return true;
  } catch (x) {
    console.error(x);
    err.textContent = x?.code === 'permission-denied'
      ? 'Veritabanı kaydı reddedildi. Firestore güvenlik kurallarının yayınlandığından emin olun, sonra Profil ekranından kaydı tamamlayın.'
      : 'Kayıt tamamlanamadı. Profil ekranından tekrar deneyin.';
    return false;
  }
}

// Giriş hesabı açılmış ama veritabanı kaydı yazılamamışsa bu form çıkar
function renderComplete() {
  const el = $('#v-profil'), kurulum = !config;
  el.innerHTML = `
    <form class="card" id="f-tamam">
      <h3>Kaydını tamamla</h3>
      <p class="banner">Hesabın oluşturuldu ama kaydın yarım kaldı. Bilgilerini tekrar girip tamamla.${kurulum ? ' İlk kaydolan sen olduğun için hesabın yönetici olarak açılacak.' : ''}</p>
      <div class="field"><label for="k-kod">${kurulum ? `Bölüm kodunu belirle (en az ${KOD_MIN} karakter)` : 'Bölüm kodu'}</label><input id="k-kod" required autocomplete="off"></div>
      <div class="field"><label for="k-ad">Ad soyad</label><input id="k-ad" required autocomplete="name" placeholder="Ayşe Kaya"></div>
      ${dogumFields()}
      <button class="btn" type="submit">Kaydı tamamla</button>
      <p class="err" id="k-err"></p>
    </form>
    <button class="btn del" id="cikis">Çıkış yap</button>`;
  $('#cikis').addEventListener('click', () => A.signOut(auth).then(() => location.reload()));
  $('#f-tamam').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#k-err'), kod = $('#k-kod').value.trim(), ad = $('#k-ad').value.trim().replace(/\s+/g, ' ');
    const dg = +$('#dg').value || null, da = +$('#da').value || null, dgos = $('#dgos').checked;
    if (ad.length < 3) { err.textContent = 'Adını ve soyadını yaz.'; return; }
    if ((dg && !da) || (!dg && da)) { err.textContent = 'Doğum gününü gün ve ay olarak birlikte seç.'; return; }
    const k = !config, liste = await listeKimligi(kod);
    if (k && kod.length < KOD_MIN) { err.textContent = `Bölüm kodu en az ${KOD_MIN} karakter olmalı.`; return; }
    if (!k) { let var_ = false; try { var_ = (await F.getDoc(F.doc(db, 'kodlar', liste))).exists(); } catch (x) { } if (!var_) { err.textContent = 'Bölüm kodu yanlış.'; return; } }
    try { const g = await F.getDoc(F.doc(db, 'girisler', await girisKimligi(ad))); if (g.exists() && g.data().uid !== state.user.uid) { err.textContent = 'Bu adla bir kayıt zaten var.'; return; } } catch (x) { }
    err.textContent = 'Kaydediliyor…';
    await writeProfile(state.user.uid, state.user.email, { ad, dg, da, dgos, kurulum: k, liste }, err);
  });
}

function masaSecici(p) {
  if (p.masa && !masaDegis) return `<dl class="kv"><dt>Masa</dt><dd>${esc(p.masa)} <button class="linkbtn" data-masadegis style="min-height:0;padding:0 0 0 8px">Değiştir</button></dd></dl>`;
  const ben = state.user.uid;
  return `<div class="field"><label>${p.masa ? 'Yeni masanı seç' : 'Masanı seç'}</label>
    <div class="masasec">${Array.from({ length: MASA_SAYISI }, (_, i) => {
      const n = i + 1, oturan = kisiler.filter(u => u.onayli && Number(u.masa) === n && u.id !== ben).map(u => u.ad.split(' ')[0]);
      const dolu = oturan.length >= MASA_KAP;
      return `<button class="masa-b${Number(p.masa) === n ? ' sec' : ''}" data-masasec="${n}"${dolu ? ' disabled' : ''}><b>${n}</b><span>${dolu ? 'dolu' : oturan.length ? esc(oturan.join(', ')) : 'boş'}</span></button>`;
    }).join('')}</div>
    ${masaDegis ? '<button class="linkbtn" data-masavazgec>Vazgeç</button>' : ''}</div>`;
}

function gorevlerim(p) {
  const d = new Date(), bugun = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ev = etkinlikler();
  const sem = ev.filter(e => e.k === 'M' && e.uid === state.user.uid && e.date >= bugun).sort((a, b) => a.date.localeCompare(b.date));
  const anl = ev.filter(e => e.k === 'U' && e.date >= bugun && anlaticilar[konuId(e.s, e.topic)]?.uid === state.user.uid)
    .sort((a, b) => (a.date + a.t).localeCompare(b.date + b.t));
  const GOSTER = 6;
  return `<div class="card"><h3>Görevlerim</h3>
    ${masaSecici(p)}
    <h4 class="gorev-bas">🎤 Seminer</h4>
    ${sem.length ? sem.map(e => `<div class="li" style="display:block">
      <div class="nm">${esc(tarihGun(e.date))} · ${esc(e.t)}</div>
      <div class="${bosKonu(e.topic) ? 'warn' : ''}">${bosKonu(e.topic) ? 'Konu henüz yazılmadı' : esc(e.topic)}</div>
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}
      <button class="btn sec" style="margin-top:6px" data-konu="${esc(e.id)}">${bosKonu(e.topic) ? 'Konunu yaz' : 'Konunu düzenle'}</button>
    </div>`).join('') : '<p class="note">Yaklaşan seminerin yok.</p>'}
    ${(() => { const gz = benimGozetmenliklerim(); return gz.length ? `<h4 class="gorev-bas">📝 Sınav gözetmenliği</h4>${gz.map(({ a, e }) => { const h = gzGruplar(e.id)[a.grup]?.hoca; return `<div class="li" style="display:block">
      <div class="nm">${esc(tarihGun(e.date))} · ${esc(oturumMetni(e.id))}</div>
      <div>${esc(e.topic)}</div>
      <div class="note">${h ? esc(h) + ' grubu' : `${a.grup + 1}. grup`} <button class="linkbtn" data-gzac="${esc(e.id)}" style="min-height:0;padding:0 0 0 6px">Ayrıntı</button></div>
    </div>`; }).join('')}` : ''; })()}
    <h4 class="gorev-bas">🔬 Anlatacağın uygulamalar</h4>
    ${anl.length ? anl.slice(0, GOSTER).map(e => `<div class="li" style="display:block">
      <div class="nm">${esc(tarihGun(e.date))} · ${esc(e.t)}${e.g ? ' · ' + esc(e.g) : ''}</div>
      <div>${esc(e.topic)}</div>
      <div class="note">${esc(e.s)}${e.yer ? ' · ' + esc(e.yer) : ''}</div>
    </div>`).join('') + (anl.length > GOSTER ? `<p class="note">ve ${anl.length - GOSTER} uygulama daha</p>` : '') : '<p class="note">Şu an anlatıcı olarak atandığın uygulama yok.</p>'}
  </div>`;
}

function renderMe() {
  const p = state.profile || {}, el = $('#v-profil');
  el.innerHTML = `
    <div class="card">
      <h3>${esc(p.ad || 'Hesabım')}</h3>
      <p>${p.onayli ? `<span class="pill">${p.rol === 'yonetici' ? 'Yönetici' : 'Asistan'}</span>` : '<span class="pill wait">Onay bekliyor</span>'}</p>
      ${p.onayli ? '' : '<p class="note">Bir yönetici kaydını onayladığında preparat ekleyebilir, görevlerini görebilirsin.</p>'}
    </div>
    ${p.onayli ? gorevlerim(p) : ''}
    ${temaKarti()}
    <div class="card" id="c-bildirim"><h3>Bildirimler</h3>
      <p class="note">Her pazartesi 09:00'da haftanın programı telefonuna bildirim olarak gelir.</p>
      <p id="b-durum"></p>
      <button class="btn" id="b-ac">Bildirimleri aç</button> <button class="btn sec hide" id="b-kapat">Kapat</button>
    </div>
    <form class="card" id="f-dogum"><h3>Doğum günü</h3>${dogumFields(p.dogumGun || '', p.dogumAy || '', p.dogumGoster !== false)}
      <button class="btn sec" type="submit">Kaydet</button><p class="err" id="d-err"></p></form>
    <form class="card" id="f-pin"><h3>PIN değiştir</h3>
      <div class="field"><label for="p-old">Şu anki PIN</label><input id="p-old" class="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password" required></div>
      <div class="field"><label for="p-new">Yeni PIN</label><input id="p-new" class="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required></div>
      <button class="btn sec" type="submit">PIN'i değiştir</button><p class="err" id="p-err"></p></form>
    <button class="btn del" id="cikis">Çıkış yap</button>`;
  $('#v-profil').querySelectorAll('[data-gzac]').forEach(b => b.addEventListener('click', () => gozetmenFormu(b.dataset.gzac)));
  $('#v-profil').querySelector('[data-masadegis]')?.addEventListener('click', () => { masaDegis = true; render(); });
  $('#v-profil').querySelector('[data-masavazgec]')?.addEventListener('click', () => { masaDegis = false; render(); });
  $('#v-profil').querySelectorAll('[data-masasec]').forEach(b => b.addEventListener('click', async () => {
    const v = Number(b.dataset.masasec);
    try { await F.updateDoc(F.doc(db, 'users', state.user.uid), { masa: v }); masaDegis = false; toast(`Masa ${v} kaydedildi`); }
    catch (x) { console.error(x); toast('Kaydedilemedi'); }
    render();
  }));
  $('#f-dogum').addEventListener('submit', async e => {
    e.preventDefault();
    const dg = +$('#dg').value || null, da = +$('#da').value || null;
    if ((dg && !da) || (!dg && da)) { $('#d-err').textContent = 'Gün ve ayı birlikte seç.'; return; }
    try { await F.updateDoc(F.doc(db, 'users', state.user.uid), { dogumGun: dg, dogumAy: da, dogumGoster: $('#dgos').checked }); toast('Kaydedildi'); }
    catch (x) { $('#d-err').textContent = 'Kaydedilemedi.'; }
  });
  $('#f-pin').addEventListener('submit', async e => {
    e.preventDefault();
    const o = $('#p-old').value.trim(), n = $('#p-new').value.trim(), er = $('#p-err');
    if (!pinOk(n)) { er.textContent = 'Yeni PIN 6 rakamdan oluşmalı.'; return; }
    try {
      await A.reauthenticateWithCredential(state.user, A.EmailAuthProvider.credential(state.user.email, o));
      await A.updatePassword(state.user, n); er.textContent = ''; e.target.reset(); toast('PIN değişti');
    } catch (x) { er.textContent = 'Şu anki PIN hatalı.'; }
  });
  $('#cikis').addEventListener('click', () => A.signOut(auth).then(() => location.reload()));
  $('#v-profil').querySelectorAll('[data-konu]').forEach(b => b.addEventListener('click', () => konuFormu(etkinlikler().find(x => x.id === b.dataset.konu))));
  const bd = d => {
    $('#b-durum').textContent = DURUM_METNI[d] || '';
    $('#b-ac').classList.toggle('hide', !(d === 'kapali'));
    $('#b-kapat').classList.toggle('hide', d !== 'acik');
  };
  bd(durum());
  $('#b-ac').addEventListener('click', async () => {
    $('#b-durum').textContent = 'Bildirim izni isteniyor…';
    try { bd(await bildirimAc()); if (durum() === 'acik') toast('Bildirimler açıldı'); }
    catch (x) { console.error(x); $('#b-durum').textContent = 'Bildirimler açılamadı. Uygulamayı kapatıp açarak tekrar dene.'; }
  });
  $('#b-kapat').addEventListener('click', async () => { bd(await bildirimKapat()); });
}

function render() {
  if (!ready) { $('#v-profil').innerHTML = '<div class="banner">Uygulama henüz Firebase projesine bağlanmadı. <code>js/config.js</code> dosyasına proje ayarları girildiğinde giriş ve kayıt açılır.</div>'; return; }
  if (!state.user) return renderGuest();
  if (!state.profileLoaded || !configLoaded) { $('#v-profil').innerHTML = '<p class="note">Yükleniyor…</p>'; return; }
  state.profile ? renderMe() : renderComplete();
}

export function initHesap() {
  render();
  onEvents(() => { if (state.user && !$('#v-profil').contains(document.activeElement)) render(); });
  onGozetmenDegis(() => { if (state.profile && !$('#v-profil').contains(document.activeElement)) render(); });
  onState(() => { if (!document.activeElement || !$('#v-profil').contains(document.activeElement)) render(); });
  $('#who').addEventListener('click', () => { location.hash = 'profil'; });
  onState(s => { $('#who').textContent = s.user ? (s.profile?.ad?.split(' ')[0] || 'Hesabım') : 'Giriş yap'; });
  if (!ready) return;
  onState(st => {
    if (st.approved && !unsubK) {
      const yenile = () => { if (state.profile && !$('#v-profil').contains(document.activeElement)) render(); };
      const u1 = F.onSnapshot(F.collection(db, 'users'), q => { kisiler = q.docs.map(d => ({ id: d.id, ...d.data() })); yenile(); }, () => { });
      unsubK = u1;
    }
    if (!st.approved && unsubK) { unsubK(); unsubK = null; }
  });
  F.onSnapshot(F.collection(db, 'anlaticilar'), q => { anlaticilar = {}; q.docs.forEach(d => { anlaticilar[d.id] = d.data(); }); if (state.profile && !$('#v-profil').contains(document.activeElement)) render(); }, () => { });
  // Giriş kaydı eksik olan (eski sürümde kaydolmuş) kişi için kendi giriş kaydını oluşturur
  onState(async st => {
    if (girisKontrol || !st.user || !st.profile?.ad) return;
    girisKontrol = true;
    try {
      const ref = F.doc(db, 'girisler', await girisKimligi(st.profile.ad));
      if (!(await F.getDoc(ref)).exists()) await F.setDoc(ref, { email: st.user.email, uid: st.user.uid });
    } catch (x) { console.error(x); }
  });
  F.onSnapshot(F.doc(db, 'config', 'public'), s => { config = s.exists() ? s.data() : null; configLoaded = true; render(); }, () => { configLoaded = true; render(); });
}
