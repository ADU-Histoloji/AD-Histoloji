import { $, $$, setState, state } from './util.js';
import { ready, auth, db, A, F } from './fb.js';
import { initTakvim, setLinked, rerenderTakvim } from './takvim.js';
import { initArsiv, linkedHtml, onPrepsChange } from './arsiv.js';
import { initHesap } from './hesap.js';
import { initYonetim } from './yonetim.js';
import { initUygulamalar } from './uygulamalar.js';

const VIEWS = ['takvim', 'uygulama', 'arsiv', 'profil', 'yonetim'];
const TITLES = { takvim: 'Histoloji bölümü', uygulama: 'Uygulama masaları', arsiv: 'Preparat arşivi', profil: 'Hesabım', yonetim: 'Yönetim' };
function route() {
  let v = location.hash.slice(1);
  if (!VIEWS.includes(v) || (v === 'yonetim' && !state.admin)) v = 'takvim';
  VIEWS.forEach(x => $('#v-' + x).classList.toggle('hide', x !== v));
  $$('.bnav a').forEach(a => a.dataset.v === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  $('#title').textContent = TITLES[v];
  scrollTo(0, 0);
}
addEventListener('hashchange', route);

initTakvim();
initArsiv();
initUygulamalar();
setLinked(linkedHtml);
onPrepsChange(rerenderTakvim);
initHesap();
initYonetim();
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
      setState({ profile: p, profileLoaded: true, approved, admin });
      $('#nav-yonetim').classList.toggle('hide', !admin);
      route();
    }, () => setState({ profile: null, profileLoaded: true, approved: false, admin: false }));
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
