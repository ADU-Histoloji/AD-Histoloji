import { firebaseConfig, FIREBASE_SDK } from './config.js';

// Ayarlar girilmemişse uygulama sadece takvimi (data/events.json) gösterir.
export const ready = !String(firebaseConfig.apiKey).startsWith('BURAYA');
let app = null, auth = null, db = null, A = null, F = null;
if (ready) {
  const { initializeApp } = await import(`${FIREBASE_SDK}/firebase-app.js`);
  A = await import(`${FIREBASE_SDK}/firebase-auth.js`);
  F = await import(`${FIREBASE_SDK}/firebase-firestore.js`);
  app = initializeApp(firebaseConfig);
  auth = A.getAuth(app);
  db = F.initializeFirestore(app, { localCache: F.persistentLocalCache() });
}
export { app, auth, db, A, F };
