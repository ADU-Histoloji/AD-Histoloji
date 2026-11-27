export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Ortak durum: giriş yapan kişi ve profili
export const state = { user: null, profile: null, approved: false, admin: false };
const subs = new Set();
export const onState = fn => { subs.add(fn); fn(state); };
export const setState = patch => { Object.assign(state, patch); subs.forEach(fn => fn(state)); };

let tt;
export function toast(msg) {
  const t = $('#toast');
  t.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
  clearTimeout(tt); tt = setTimeout(() => { t.innerHTML = ''; }, 3200);
}

export function sheet(html) {
  $('#ovl').innerHTML = `<div class="ov" id="ov"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  $('#ov').addEventListener('click', e => { if (e.target.id === 'ov' || e.target.closest('.x, [data-close]')) closeSheet(); });
}
export function closeSheet() { $('#ovl').innerHTML = ''; }
addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

export async function sha256(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.trim().toLocaleLowerCase('tr')));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Fotoğrafı küçültüp JPEG data-URL olarak döndürür
export async function shrink(file, max = 1280, q = 0.72) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
export const trLower = s => String(s || '').toLocaleLowerCase('tr');

// Bir uygulama konusunun anlatıcı kaydı için kimlik: "Tıp D2|Solunum..." → "tip-d2-solunum-..."
export const konuId = (s, topic) => (s + '-' + topic).toLocaleLowerCase('tr')
  .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);

// Bölüm kodundan isim listesinin gizli adresi türetilir. Kodu bilmeyen liste adresini bulamaz.
export const listeKimligi = async kod => sha256('histoloji-liste:' + String(kod).trim().toLocaleLowerCase('tr'));
export const KOD_MIN = 6;
