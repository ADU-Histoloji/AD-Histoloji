import { state } from './util.js';
import { ready, app, db, F } from './fb.js';
import { VAPID_KEY, FIREBASE_SDK } from './config.js';

const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// Bu cihazda bildirimlerin durumu: 'acik', 'kapali', 'engelli', 'ios-ana-ekran', 'desteklenmiyor', 'ayar-yok'
export function durum() {
  if (!ready || String(VAPID_KEY).startsWith('BURAYA')) return 'ayar-yok';
  if (isIOS && !standalone) return 'ios-ana-ekran';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'desteklenmiyor';
  if (Notification.permission === 'denied') return 'engelli';
  let kayitli = false;
  try { kayitli = !!localStorage.getItem('hp-push-token'); } catch (e) { }
  return Notification.permission === 'granted' && kayitli ? 'acik' : 'kapali';
}

export async function bildirimAc() {
  const d = durum();
  if (d !== 'kapali' && d !== 'acik') return d;
  const izin = await Notification.requestPermission();
  if (izin !== 'granted') return izin === 'denied' ? 'engelli' : 'kapali';
  const M = await import(`${FIREBASE_SDK}/firebase-messaging.js`);
  if (!(await M.isSupported())) return 'desteklenmiyor';
  const reg = await navigator.serviceWorker.ready;
  const token = await M.getToken(M.getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) return 'kapali';
  await F.setDoc(F.doc(db, 'tokens', token), { uid: state.user.uid, t: F.serverTimestamp(), cihaz: navigator.userAgent.slice(0, 150) });
  try { localStorage.setItem('hp-push-token', token); } catch (e) { }
  return 'acik';
}

export async function bildirimKapat() {
  let token = null;
  try { token = localStorage.getItem('hp-push-token'); localStorage.removeItem('hp-push-token'); } catch (e) { }
  if (token) await F.deleteDoc(F.doc(db, 'tokens', token)).catch(() => { });
  return 'kapali';
}

export const DURUM_METNI = {
  'acik': 'Bu cihazda bildirimler açık.',
  'kapali': 'Bu cihazda bildirimler kapalı.',
  'engelli': 'Bildirim izni reddedilmiş. Telefonun ayarlarından bu site/uygulama için bildirimlere izin verip tekrar dene.',
  'ios-ana-ekran': "iPhone'da bildirim alabilmek için uygulamayı önce ana ekrana eklemelisin: Safari'de Paylaş → Ana Ekrana Ekle. Sonra uygulamayı ana ekrandaki ikondan açıp buraya tekrar gel.",
  'desteklenmiyor': 'Bu tarayıcı bildirimleri desteklemiyor. Android\'de Chrome, iPhone\'da ana ekrana eklenmiş uygulama kullan.',
  'ayar-yok': 'Bildirimler henüz kurulmadı.'
};
