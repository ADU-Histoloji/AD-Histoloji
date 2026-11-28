// Araçlar: seminer sırası, sınav kâğıtları, gözetmenlik ve kura tek ekranda
import { $, esc, state, onState } from './util.js';
import { gozetmenliSinav, kanonik, atananlar, gruplar, gozetmenFormu, onGozetmenDegis, oturumMetni } from './gozetmen.js';

let olaylar = [];
const bugun = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const tr = iso => iso.split('-').reverse().join('.');

const KARTLAR = [
  { h: '#seminer', ikon: '🎤', ad: 'Seminer sırası', ac: 'Salı seminerleri, kaydırma ve yer değiştirme' },
  { h: '#kagit', ikon: '📄', ad: 'Sınav kâğıtları', ac: 'Uygulama sınavı soruları, cevap anahtarı, preparat listesi' },
  { h: '#kura', ikon: '🎲', ad: 'Kura', ac: 'Kişi seç, sırala ya da görevlere dağıt' }
];

function render() {
  const el = $('#v-araclar'); if (!el) return;
  const ben = state.user?.uid, b = bugun();
  const gorulen = new Set();
  const sinavlar = olaylar.filter(e => e.date >= b && gozetmenliSinav(e)).sort((x, y) => (x.date + x.t).localeCompare(y.date + y.t))
    .filter(e => { const k = kanonik(e.id); if (gorulen.has(k)) return false; gorulen.add(k); return true; }).slice(0, 6);
  el.innerHTML = `<div class="arac-grid">${KARTLAR.map(k => `<a class="arac-k" href="${k.h}"><span class="arac-i">${k.ikon}</span><span><b>${k.ad}</b><small>${k.ac}</small></span></a>`).join('')}</div>
    ${state.approved ? `<div class="card" style="max-width:none"><h3>📝 Sınav gözetmenliği</h3>
      ${sinavlar.length ? `<div class="list">${sinavlar.map(e => {
        const at = atananlar(e.id), kap = gruplar(e.id).reduce((t, g) => t + g.kap, 0), benim = at.some(a => a.uid === ben);
        return `<div class="li"><span><span class="nm">${esc(tr(e.date))} · ${esc(e.s)}</span><br><span class="note">${esc(oturumMetni(e.id))} · ${at.length}/${kap} gözetmen${benim ? ' · sen de varsın' : ''}</span></span>
          <button class="btn sec" data-gzac="${esc(e.id)}">${benim || at.length >= kap ? 'Gör' : 'Gözetmen ol'}</button></div>`;
      }).join('')}</div>` : '<p class="note">Yaklaşan uygulama sınavı yok.</p>'}
    </div>` : ''}`;
}

export function initAraclar(onEventsFn) {
  const el = $('#v-araclar'); if (!el) return;
  onEventsFn(ev => { olaylar = ev.filter(e => e.id); render(); });
  el.addEventListener('click', e => { const b = e.target.closest('[data-gzac]'); if (b) gozetmenFormu(b.dataset.gzac); });
  onGozetmenDegis(render);
  onState(render);
}
