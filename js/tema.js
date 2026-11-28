// Histolojik boya temaları: uygulamanın ana renkleri seçilen boyanın renklerinden gelir.
export const TEMALAR = [
  { k: 'he', ad: 'H&E', aciklama: 'hematoksilen moru, eozin pembesi', renk: ['#3a2c86', '#c8326b'], band: '#3a2c86' },
  { k: 'masson', ad: 'Masson trikrom', aciklama: 'kollajen mavisi, kas kırmızısı', renk: ['#1f5fa8', '#c62828'], band: '#173a6b' },
  { k: 'pas', ad: 'PAS', aciklama: 'magenta, hematoksilen zemin', renk: ['#b0167a', '#3b3f8f'], band: '#7a0f57' },
  { k: 'toluidin', ad: 'Toluidin mavisi', aciklama: 'ortokromazi ve metakromazi', renk: ['#1d4e9e', '#8e3aa8'], band: '#163c7a' },
  { k: 'gumus', ad: 'Gümüşleme', aciklama: 'siyah lifler, altın zemin', renk: ['#2b2118', '#b7791f'], band: '#2b2118' },
  { k: 'giemsa', ad: 'Giemsa', aciklama: 'mor çekirdek, pembe sitoplazma', renk: ['#5b2a86', '#d0476b'], band: '#4a1f73' }
];
export const GORUNUMLER = [['', 'Otomatik'], ['light', 'Açık'], ['dark', 'Koyu']];

export const seciliTema = () => { try { return localStorage.getItem('hp-boya') || 'he'; } catch (e) { return 'he'; } };
export const seciliGorunum = () => { try { return localStorage.getItem('hp-gorunum') || ''; } catch (e) { return ''; } };

export function temaUygula(k = seciliTema(), g = seciliGorunum()) {
  const h = document.documentElement;
  if (k && k !== 'he') h.dataset.boya = k; else delete h.dataset.boya;
  if (g) h.dataset.theme = g; else delete h.dataset.theme;
  try { k && k !== 'he' ? localStorage.setItem('hp-boya', k) : localStorage.removeItem('hp-boya'); g ? localStorage.setItem('hp-gorunum', g) : localStorage.removeItem('hp-gorunum'); } catch (e) { }
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = (TEMALAR.find(t => t.k === k) || TEMALAR[0]).band;
}

export const temaKarti = () => `<div class="card" id="c-tema"><h3>Tema</h3>
  <p class="note">Uygulamanın renkleri bir histolojik boyadan gelir. Seçim bu cihazda saklanır.</p>
  <div class="temalar">${TEMALAR.map(t => `<button type="button" class="tema-b" data-tema="${t.k}" aria-pressed="${seciliTema() === t.k}"><i style="background:linear-gradient(135deg,${t.renk[0]} 0 50%,${t.renk[1]} 50% 100%)"></i><span>${t.ad}<small>${t.aciklama}</small></span></button>`).join('')}</div>
  <div class="chips" role="group" aria-label="Görünüm">${GORUNUMLER.map(([k, ad]) => `<button type="button" class="chip" data-gorunum="${k}" aria-pressed="${seciliGorunum() === k}">${ad}</button>`).join('')}</div>
</div>`;

// Tıklamaları belge düzeyinde yakalar; kart hangi ekranda olursa olsun çalışır
export function initTema() {
  temaUygula();
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tema]'), g = e.target.closest('[data-gorunum]');
    if (!t && !g) return;
    temaUygula(t ? t.dataset.tema : seciliTema(), g ? g.dataset.gorunum : seciliGorunum());
    document.querySelectorAll('[data-tema]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tema === seciliTema()));
    document.querySelectorAll('[data-gorunum]').forEach(b => b.setAttribute('aria-pressed', b.dataset.gorunum === seciliGorunum()));
  });
}
