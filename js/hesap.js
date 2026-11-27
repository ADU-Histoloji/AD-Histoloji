import { $, esc, state, onState, toast, sha256 } from './util.js';
import { ready, auth, db, A, F } from './fb.js';
import { EMAIL_DOMAIN } from './config.js';
import { durum, bildirimAc, bildirimKapat, DURUM_METNI } from './bildirim.js';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const pinOk = p => /^\d{6}$/.test(p);
let mode = 'giris';
let people = [];
let config = null, configLoaded = false;

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
  const names = people.slice().sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  el.innerHTML = `
    <div class="chips" role="tablist">
      <button class="chip" data-m="giris" aria-pressed="${mode === 'giris'}">Giriş yap</button>
      <button class="chip" data-m="kayit" aria-pressed="${mode === 'kayit'}">Kayıt ol</button>
    </div>
    ${mode === 'giris' ? `
    <form class="card" id="f-giris">
      <h3>Giriş yap</h3>
      <div class="field"><label for="g-ad">Adın</label>
        <select id="g-ad" required><option value="">Listeden seç</option>${names.map(p => `<option value="${esc(p.id)}">${esc(p.ad)}${p.onayli ? '' : ' (onay bekliyor)'}</option>`).join('')}</select></div>
      <div class="field"><label for="g-pin">PIN</label><input id="g-pin" class="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" required></div>
      <button class="btn" type="submit">Giriş yap</button>
      <p class="err" id="g-err"></p>
      <p class="note">Listede adın yoksa önce "Kayıt ol". PIN'ini unuttuysan bir yöneticiye haber ver.</p>
    </form>` : `
    <form class="card" id="f-kayit">
      <h3>${kurulum ? 'İlk kurulum' : 'Kayıt ol'}</h3>
      ${kurulum ? '<p class="banner">Uygulamaya ilk kaydolan sensin. Hesabın yönetici olarak açılacak. Aşağıda belirlediğin bölüm kodunu diğer asistanlarla paylaşacaksın.</p>' : ''}
      <div class="field"><label for="k-kod">${kurulum ? 'Bölüm kodunu belirle' : 'Bölüm kodu'}</label><input id="k-kod" required autocomplete="off" placeholder="${kurulum ? 'histo2027' : 'WhatsApp grubunda paylaşılan kod'}"></div>
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
  const p = people.find(x => x.id === $('#g-ad').value), pin = $('#g-pin').value.trim(), err = $('#g-err');
  if (!p) { err.textContent = 'Listeden adını seç.'; return; }
  if (!pinOk(pin)) { err.textContent = 'PIN 6 rakamdan oluşmalı.'; return; }
  err.textContent = 'Giriş yapılıyor…';
  try { await A.signInWithEmailAndPassword(auth, p.email, pin); err.textContent = ''; toast('Hoş geldin'); location.hash = 'takvim'; }
  catch (x) { err.textContent = x?.code === 'auth/too-many-requests' ? 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.' : 'PIN hatalı.'; }
}

async function kayit(e) {
  e.preventDefault();
  const err = $('#k-err'), kod = $('#k-kod').value.trim(), ad = $('#k-ad').value.trim().replace(/\s+/g, ' '),
    pin = $('#k-pin').value.trim(), pin2 = $('#k-pin2').value.trim();
  const dg = +$('#dg').value || null, da = +$('#da').value || null, dgos = $('#dgos').checked;
  if (ad.length < 3) { err.textContent = 'Adını ve soyadını yaz.'; return; }
  if (!pinOk(pin)) { err.textContent = 'PIN 6 rakamdan oluşmalı.'; return; }
  if (pin !== pin2) { err.textContent = 'İki PIN aynı değil.'; return; }
  if ((dg && !da) || (!dg && da)) { err.textContent = 'Doğum gününü gün ve ay olarak birlikte seç ya da ikisini de boş bırak.'; return; }
  if (people.some(p => p.ad.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'))) { err.textContent = 'Bu adla bir kayıt zaten var. Giriş yapmayı dene.'; return; }
  const kurulum = !config;
  const hash = await sha256(kod);
  if (!kurulum && hash !== config.kodHash) { err.textContent = 'Bölüm kodu yanlış.'; return; }
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
  await writeProfile(cred.user.uid, email, { ad, dg, da, dgos, kurulum, hash }, err);
}

// Veritabanı kayıtlarını yazar. Yarım kalmış bir kaydı tamamlamak için de kullanılır.
async function writeProfile(uid, email, { ad, dg, da, dgos, kurulum, hash }, err) {
  try {
    if (kurulum) await F.setDoc(F.doc(db, 'config', 'public'), { kurucu: uid, kodHash: hash });
    await F.setDoc(F.doc(db, 'users', uid), {
      ad, rol: kurulum ? 'yonetici' : 'asistan', onayli: kurulum, dogumGun: dg, dogumAy: da, dogumGoster: dgos,
      masa: null, seminerSira: null, kayit: F.serverTimestamp()
    });
    await F.setDoc(F.doc(db, 'people', uid), { ad, email, onayli: kurulum });
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
      <div class="field"><label for="k-kod">${kurulum ? 'Bölüm kodunu belirle' : 'Bölüm kodu'}</label><input id="k-kod" required autocomplete="off"></div>
      <div class="field"><label for="k-ad">Ad soyad</label><input id="k-ad" required autocomplete="name" placeholder="Ayşe Kaya"></div>
      ${dogumFields()}
      <button class="btn" type="submit">Kaydı tamamla</button>
      <p class="err" id="k-err"></p>
    </form>
    <button class="btn del" id="cikis">Çıkış yap</button>`;
  $('#cikis').addEventListener('click', () => A.signOut(auth));
  $('#f-tamam').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#k-err'), kod = $('#k-kod').value.trim(), ad = $('#k-ad').value.trim().replace(/\s+/g, ' ');
    const dg = +$('#dg').value || null, da = +$('#da').value || null, dgos = $('#dgos').checked;
    if (ad.length < 3) { err.textContent = 'Adını ve soyadını yaz.'; return; }
    if ((dg && !da) || (!dg && da)) { err.textContent = 'Doğum gününü gün ve ay olarak birlikte seç.'; return; }
    const hash = await sha256(kod), k = !config;
    if (!k && hash !== config.kodHash) { err.textContent = 'Bölüm kodu yanlış.'; return; }
    err.textContent = 'Kaydediliyor…';
    await writeProfile(state.user.uid, state.user.email, { ad, dg, da, dgos, kurulum: k, hash }, err);
  });
}

function renderMe() {
  const p = state.profile || {}, el = $('#v-profil');
  el.innerHTML = `
    <div class="card">
      <h3>${esc(p.ad || 'Hesabım')}</h3>
      <p>${p.onayli ? `<span class="pill">${p.rol === 'yonetici' ? 'Yönetici' : 'Asistan'}</span>` : '<span class="pill wait">Onay bekliyor</span>'}</p>
      ${p.onayli ? `<dl class="kv"><dt>Masa</dt><dd>${p.masa ? esc(p.masa) : 'Henüz atanmadı'}</dd><dt>Seminer sırası</dt><dd>${p.seminerSira ? esc(p.seminerSira) + '.' : 'Henüz atanmadı'}</dd></dl>` : '<p class="note">Bir yönetici kaydını onayladığında preparat ekleyebilir, masa ve seminer bilgilerini görebilirsin.</p>'}
    </div>
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
  $('#cikis').addEventListener('click', () => A.signOut(auth));
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
  onState(() => { if (!document.activeElement || !$('#v-profil').contains(document.activeElement)) render(); });
  $('#who').addEventListener('click', () => { location.hash = 'profil'; });
  onState(s => { $('#who').textContent = s.user ? (s.profile?.ad?.split(' ')[0] || 'Hesabım') : 'Giriş yap'; });
  if (!ready) return;
  F.onSnapshot(F.collection(db, 'people'), s => { people = s.docs.map(d => ({ id: d.id, ...d.data() })); if (!state.user) render(); });
  F.onSnapshot(F.doc(db, 'config', 'public'), s => { config = s.exists() ? s.data() : null; configLoaded = true; render(); }, () => { configLoaded = true; render(); });
}
