import { $, $$, setState, state } from './util.js';
import { ready, auth, db, A, F } from './fb.js';
import { initTakvim, setLinked, rerenderTakvim, onEvents } from './takvim.js';
import { initArsiv, linkedHtml, onPrepsChange } from './arsiv.js';
import { initHesap } from './hesap.js';
import { initYonetim } from './yonetim.js';
import { initUygulamalar } from './uygulamalar.js';
import { initDuyurular } from './duyurular.js';
import { initSeminer } from './seminer.js';
import { initAnlatici } from './anlatici.js';
import { initGozetmen } from './gozetmen.js';
import { initKura } from './kura.js';
import { initTema } from './tema.js';
import { initSinavKagidi } from './sinavkagidi.js';

const VIEWS = ['takvim', 'uygulama', 'arsiv', 'seminer', 'profil', 'yonetim', 'kura', 'kagit'];
const TITLES = { takvim: 'ADÜ Histoloji ve Embriyoloji', uygulama: 'Uygulama masaları', arsiv: 'Preparat arşivi', seminer: 'Seminer sırası', kura: 'Kura', kagit: 'Sınav kâğıdı', profil: 'Hesabım', yonetim: 'Yönetim' };
function route() {
  let v = location.hash.slice(1);
  if (!VIEWS.includes(v) || (v === 'yonetim' && !state.admin)) v = 'takvim';
  VIEWS.forEach(x => $('#v-' + x).classList.toggle('hide', x !== v));
  $$('.bnav a').forEach(a => a.dataset.v === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  $('#title').textContent = TITLES[v];
  scrollTo(0, 0);
}
addEventListener('hashchange', route);

initTema();
initAnlatici();
initGozetmen(onEvents);
initTakvim();
initArsiv();
initUygulamalar();
setLinked(linkedHtml);
onPrepsChange(rerenderTakvim);
initHesap();
initYonetim();
initDuyurular();
initSeminer();
initKura();
initSinavKagidi(onEvents);
route();

if (ready) {
  let unsubMe = null;
  A.onAuthStateChanged(auth, user => {
    if (unsubMe) { unsubMe(); unsubMe = null; }
    if (!user) { setState({ user: null, profile: null, profileLoaded: false, approved: false, admin: false }); $('#nav-yonetim').classList.add('hide'); route(); return; }
    setState({ user, profileLoaded: false });
    unsubMe = F.onSnapshot(F.doc(db, 'users', user.uid), s => {
      const p = s.exists() ? s.data() : null;
      const approved = !!p?.onayli, admin = approved && p.rol === 'yonetici';
      // Onay bekleyen kişi onaylanınca, üye verilerini okuyabilmesi için sayfa yenilenir
      if (approved && state.profileLoaded && state.profile && !state.approved) { location.reload(); return; }
      setState({ profile: p, profileLoaded: true, approved, admin });
      $('#nav-yonetim').classList.toggle('hide', !admin);
      $('#kura-btn').classList.toggle('hide', !approved);
      route();
    }, () => setState({ profile: null, profileLoaded: true, approved: false, admin: false }));
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
