// Yedek dosyası biçimi: { surum, zaman, belgeler: { "koleksiyon/belge[/alt/belge]": veri } }
// Firestore'a özgü değerler (zaman damgası, belge referansı) JSON'a etiketli olarak yazılır.
import { Timestamp, GeoPoint } from 'firebase-admin/firestore';

export const HARIC = new Set(['tokens']); // cihaz bildirim adresleri yedeklenmez, telefonlar yeniden kaydeder

export function kodla(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Timestamp) return { __t: 'ts', v: v.toDate().toISOString() };
  if (v instanceof GeoPoint) return { __t: 'geo', v: [v.latitude, v.longitude] };
  if (v?.constructor?.name === 'DocumentReference') return { __t: 'ref', v: v.path };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __t: 'bytes', v: Buffer.from(v).toString('base64') };
  if (Array.isArray(v)) return v.map(kodla);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, kodla(x)]));
}

export function coz(v, db) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(x => coz(x, db));
  if (v.__t === 'ts') return Timestamp.fromDate(new Date(v.v));
  if (v.__t === 'geo') return new GeoPoint(v.v[0], v.v[1]);
  if (v.__t === 'ref') return db.doc(v.v);
  if (v.__t === 'bytes') return Buffer.from(v.v, 'base64');
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, coz(x, db)]));
}

// Bir koleksiyonu alt koleksiyonlarıyla birlikte dolaşır
export async function topla(kol, belgeler) {
  const q = await kol.get();
  for (const d of q.docs) {
    belgeler[d.ref.path] = kodla(d.data());
    for (const alt of await d.ref.listCollections()) await topla(alt, belgeler);
  }
  // Kendisi olmayan ama alt koleksiyonu olan belgeler (ör. katilim/2026-12-03/kisiler/…)
  for (const ref of await kol.listDocuments()) {
    if (belgeler[ref.path] !== undefined) continue;
    for (const alt of await ref.listCollections()) await topla(alt, belgeler);
  }
}
