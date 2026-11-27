// Firebase proje ayarları. Firebase konsolu → Proje ayarları → Genel → Uygulamalarınız
// bölümündeki "firebaseConfig" bloğunu buraya yapıştırın. Bu bilgiler gizli değildir.
export const firebaseConfig = {
  apiKey: "AIzaSyD0QjKj8ffiixVm_WgkCrbYLRyRyft8khs",
  authDomain: "adu-histoloji.firebaseapp.com",
  projectId: "adu-histoloji",
  storageBucket: "adu-histoloji.firebasestorage.app",
  messagingSenderId: "551846265821",
  appId: "1:551846265821:web:9c8d8a18fb495c748c2c34"
};

// Kullanıcılar e-posta yerine "ad + PIN" ile giriş yapar. Arka planda her kullanıcıya
// bu alan adıyla sahte bir e-posta adresi verilir; değiştirmeyin.
export const EMAIL_DOMAIN = "kullanici.histoloji-uygulama.app";

export const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/13.1.0";

// Bildirimler için Web Push anahtarı. Firebase konsolu → Proje ayarları → Cloud Messaging →
// Web Push certificates → "Key pair". Gizli değildir.
export const VAPID_KEY = "BAlCYH0nJDQZRMBN7wi6PKmNQioBYUZ3eZhurjlU8jiO_dK7i6MIzQgkU3wzvGj1Df0k9_7ogSvXYGm-p_sPw-g";
