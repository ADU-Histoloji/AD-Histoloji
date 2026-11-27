# Histoloji Bölümü Uygulaması

ADÜ Tıp Fakültesi Histoloji ve Embriyoloji Anabilim Dalı için ders takvimi, preparat arşivi ve (ileride) uygulama masaları, seminer sırası ve bildirimler.

Uygulama ücretsiz servislerde çalışır ve bir kişiye bağlı değildir:

| Parça | Servis | Ücret |
|---|---|---|
| Uygulama dosyaları ve adresi | GitHub Pages | Ücretsiz |
| Kullanıcılar (ad + 6 haneli PIN) | Firebase Authentication | Ücretsiz |
| Program, arşiv, fotoğraflar | Firebase Firestore (Spark planı) | Ücretsiz |

Bütün hesaplar bölüm Gmail hesabına aittir. En az iki kişi hem GitHub organizasyonunda hem Firebase projesinde **Sahip** olmalıdır.

> Firebase'de **Storage**'ı açmayın ve projeyi **Blaze** planına yükseltmeyin: kredi kartı ister. Fotoğraflar küçültülüp veritabanında tutulur.

---

## Klasördeki dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `index.html`, `style.css` | Sayfanın kendisi ve görünümü |
| `js/config.js` | Firebase proje ayarları (**kurulumda bir kere doldurulur**) |
| `js/takvim.js` | Takvim ekranı |
| `js/arsiv.js` | Preparat arşivi |
| `js/hesap.js` | Kayıt, giriş, profil |
| `js/yonetim.js` | Yönetim ekranı |
| `data/events.json` | Öğretim yılının ders programı |
| `firestore.rules` | Veritabanı güvenlik kuralları |
| `manifest.webmanifest`, `sw.js`, `icons/` | Telefonda "ana ekrana ekle" ile uygulama gibi çalışması için |

---

## İlk kurulum (bir kere)

1. **Firebase ayarları:** Firebase konsolu → Proje ayarları → Genel → Uygulamalarınız → web uygulaması. `firebaseConfig` bloğundaki değerleri `js/config.js` dosyasına yazın.
2. **Güvenlik kuralları:** Firebase konsolu → Firestore Database → **Kurallar** sekmesi. `firestore.rules` dosyasının içeriğini olduğu gibi yapıştırıp **Yayınla**'ya basın.
3. **GitHub'a yükleme:** Organizasyonda `histoloji` adında **public** bir depo (repository) açın. Bu klasördeki bütün dosyaları **Add file → Upload files** ile yükleyin.
4. **Yayına alma:** Depo → Settings → Pages → *Build and deployment* → Source: **Deploy from a branch**, Branch: **main** / **(root)** → Save. Birkaç dakika sonra adres görünür (örneğin `https://adu-histoloji.github.io/histoloji/`).
5. **Firebase'e adresi tanıtma:** Firebase konsolu → Authentication → Settings → **Authorized domains** → `adu-histoloji.github.io` adresini ekleyin.
6. **İlk kayıt:** Uygulamayı açın → Profil → **Kayıt ol**. İlk kaydolan kişi otomatik olarak **yönetici** olur ve bölüm kodunu belirler.
7. **Programı yükleme:** Yönetim → **Programı içe aktar**.
8. Bölüm kodunu ve uygulama adresini asistanlarla paylaşın.

---

## Günlük kullanım

**Yeni asistan:** Uygulamada Profil → Kayıt ol (bölüm kodu + ad soyad + 6 haneli PIN). Ardından bir yönetici Yönetim → **Onay bekleyenler** bölümünden onaylar, masa no ve seminer sırasını girer.

**PIN unutulursa:** Yönetim → Kişiler → **Kaydı sıfırla**. Kişi aynı adla yeniden kayıt olur, yönetici tekrar onaylar ve masa/sıra bilgisini yeniden girer.

**Bölümden ayrılan kişi:** Yönetim → Kişiler → Kaydı sıfırla.

**Yöneticiliği devretmek:** Yönetim → Kişiler → **Yönetici yap**. Bölümde her zaman en az iki yönetici olsun.

---

## Yeni öğretim yılı / program değişikliği

Program `data/events.json` dosyasındadır. Her ders bir satırdır:

```json
{"s":"Tıp D2","c":"tip","date":"2026-11-24","t":"13:30","e":"15:15","k":"U","topic":"Solunum Sistemi Histolojisi","who":"Kemal Ergin","g":"A"}
```

| Alan | Anlamı |
|---|---|
| `s` | Sınıf: `Tıp D1`, `Tıp D2`, `Diş D1`, `Diş D2`, `Diş D3` |
| `c` | `tip` veya `dis` |
| `date` | Tarih, YIL-AY-GÜN biçiminde |
| `t`, `e` | Başlangıç ve bitiş saati |
| `k` | `T` teorik, `U` uygulama, `S` sınav |
| `topic`, `who` | Konu ve öğretim üyesi |
| `g` | Grup (A, B, C, D), varsa |
| `yer`, `note`, `prep`, `warn` | İsteğe bağlı: derslik, not, hazırlık notu, uyarı |

Değişiklik için: GitHub'da dosyayı açın → kalem simgesi (Edit) → düzenleyin → **Commit changes**. Ardından uygulamada Yönetim → **Programı içe aktar**.

---

## Sorun çıkarsa

- **Sayfa açılıyor ama giriş/arşiv çalışmıyor:** `js/config.js` doğru dolduruldu mu, adres Firebase'de *Authorized domains* listesinde mi, kurallar yayınlandı mı?
- **"Kaydetme izniniz yok":** Kişinin hesabı onaylanmamış olabilir.
- **Telefonda eski sürüm görünüyor:** Uygulamayı tamamen kapatıp yeniden açın.

## Yol haritası

- [x] Takvim, preparat arşivi, kayıt/giriş, yönetim
- [ ] Pazartesi 09:00 bildirimi (haftalık program + seminer)
- [ ] Uygulama masaları: 8 masa, sabit masa, bir gün önce katılım sorusu, anlatıcı
- [ ] Seminer sırası (tatil/sınav haftalarında kayma, takas)
- [ ] Doğum günleri ve özel günler takvimde
