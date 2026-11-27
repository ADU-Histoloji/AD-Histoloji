// Uygulama içi bildirim kutusu: gönderilen bildirimlerin tamamı burada kalır.
import { $, esc, state, onState, sheet, closeSheet } from './util.js';
import { ready, db, F } from './fb.js';

let genel = [], yonetici = [], unsubG = null, unsubY = null;
const ANAHTAR = 'hp-duyuru-son';
const son = () => { try { return Number(localStorage.getItem(ANAHTAR)) || 0; } catch (e) { return 0; } };
const ms = d => d.t?.toMillis ? d.t.toMillis() : 0;
const liste = () => [...genel, ...yonetici].sort((a, b) => ms(b) - ms(a));

function zil() {
  const n = liste().filter(d => ms(d) > son()).length;
  const b = $('#zil');
  b.classList.toggle('hide', !state.approved);
  b.querySelector('.rozet').textContent = n > 9 ? '9+' : n || '';
  b.querySelector('.rozet').classList.toggle('hide', !n);
  b.setAttribute('aria-label', n ? `Bildirimler, ${n} yeni` : 'Bildirimler');
}

function ac() {
  const l = liste(), s = son();
  sheet(`<div class="sh"><h3>Bildirimler</h3><button class="x" aria-label="Kapat">×</button></div>
    ${l.length ? l.map(d => `<a class="duyuru${ms(d) > s ? ' yeni' : ''}" href="${esc(String(d.url || '').startsWith('./#') ? d.url : './#takvim')}">
      <div class="dtarih">${d.t?.toDate ? d.t.toDate().toLocaleString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' }) : ''}</div>
      <div class="dbas">${esc(d.title)}</div>
      <div class="dmetin">${esc(d.body).replace(/\n/g, '<br>')}</div>
    </a>`).join('') : '<p class="note">Henüz bildirim yok. Pazartesi programı ve uygulama soruları geldikçe burada birikir.</p>'}`);
  $('#ovl').addEventListener('click', e => { if (e.target.closest('.duyuru')) closeSheet(); });
  try { localStorage.setItem(ANAHTAR, String(Date.now())); } catch (e) { }
  zil();
}

export function initDuyurular() {
  $('#zil').addEventListener('click', ac);
  onState(s => {
    if (ready && s.approved && !unsubG) {
      unsubG = F.onSnapshot(F.query(F.collection(db, 'duyurular'), F.orderBy('t', 'desc'), F.limit(30)), q => { genel = q.docs.map(d => ({ id: d.id, ...d.data() })); zil(); }, () => { });
    }
    if (ready && s.admin && !unsubY) {
      unsubY = F.onSnapshot(F.query(F.collection(db, 'yoneticiDuyurulari'), F.orderBy('t', 'desc'), F.limit(20)), q => { yonetici = q.docs.map(d => ({ id: d.id, ...d.data() })); zil(); }, () => { });
    }
    if (!s.approved) { unsubG && unsubG(); unsubG = null; genel = []; }
    if (!s.admin) { unsubY && unsubY(); unsubY = null; yonetici = []; }
    zil();
  });
}
