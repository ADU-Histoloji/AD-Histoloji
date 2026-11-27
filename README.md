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

Yıl içindeki tek tük değişiklikler için dosyaya dokunmayın: uygulamada yönetici olarak takvimde ilgili güne gidip **Düzenle** ya da **+ Ders** kullanın. Dosya sadece yeni öğretim yılının programı için düzenlenir; ardından Yönetim → **Programı içe aktar** (bu işlem takvimdeki elle yapılmış düzeltmeleri siler).

---

## Pazartesi bildirimi

Her pazartesi 08:50 civarında (GitHub birkaç dakika geç başlatabilir) haftanın programı, bildirimleri açmış herkesin telefonuna gider.

**Nasıl çalışır:** `.github/workflows/pazartesi.yml` GitHub'ın zamanlanmış görevidir. `scripts/pazartesi.mjs` dosyasını çalıştırır; bu betik veritabanından haftanın derslerini okur, `scripts/mesaj.mjs` ile kısa bir metin hazırlar ve kayıtlı cihazlara gönderir. Her gönderimden sonra `data/son-bildirim.json` güncellenir (GitHub 60 gün hareketsiz kalan depolarda zamanlanmış görevleri kapattığı için bu dosya görevi açık tutar).

**Kurulum (bir kere):**
1. Firebase → Proje ayarları → Cloud Messaging → Web Push certificates → **Generate key pair**. Anahtarı `js/config.js` içindeki `VAPID_KEY` satırına yazın.
2. Firebase → Proje ayarları → Service accounts → **Generate new private key**. İnen dosyanın içeriğini GitHub'da Settings → Secrets and variables → Actions → **New repository secret** ile `FIREBASE_SERVICE_ACCOUNT` adıyla kaydedin. Dosyayı kimseyle paylaşmayın, sonra silin.
3. GitHub → Settings → Actions → General → Workflow permissions → **Read and write permissions**.

**Kullanıcı tarafı:** Profil → **Bildirimleri aç**. iPhone'da önce uygulamanın ana ekrana eklenmesi ve oradan açılması gerekir (iOS 16.4 ve sonrası).

**Elle test:** GitHub → Actions → *Pazartesi bildirimi* → **Run workflow**. "Test" kutusu işaretliyse sadece yöneticilere gider.

**Gönderilmediyse:** Actions sekmesinde son çalıştırmanın kaydına bakın. "FIREBASE_SERVICE_ACCOUNT tanımlı değil" yazıyorsa 2. adım eksiktir.

---

## Uygulama masaları

Alttaki **Masalar** sekmesi her uygulama gününü gösterir: günün oturumları, anlatıcı, 8 masalık kroki ve kimin katılıp katılmadığı.

- Herkesin sabit masası **Yönetim → Kişiler**'den, masaların 1 veya 2 kişilik olduğu **Yönetim → Masa kapasiteleri**'nden girilir.
- Asistan "Katılıyorum / Katılamıyorum" der. Gelemeyen birinin masası boş görünür; katılan başka biri o günlüğüne **Bu masaya geç** ile alabilir.
- Anlatıcılar **Yönetim → Anlatıcılar**'dan her uygulama konusu için bir kere girilir. Boş bırakılırsa programdaki öğretim üyesi gösterilir.
- **Bildirim:** Uygulamadan bir gün önce 08:50 civarında herkese "Yarın uygulama var, katılıyor musun?" gider; anlatıcı uygulamaya kayıtlıysa ona "Yarın anlatıcısın" gider. Görev: `.github/workflows/gunluk.yml`, betik: `scripts/gunluk.mjs`. Elle test: Actions → *Uygulama katılım sorusu* → Run workflow.

---

## Ders programı değişiklik kontrolü

Hafta içi her gün 13:20 civarında `.github/workflows/program-kontrol.yml` fakültenin ders programı sayfalarını kontrol eder (adresler: `data/program-sayfalari.json`). Yeni, güncellenmiş ya da içeriği değişmiş bir PDF bulursa:

- PDF'teki histoloji satırlarını öncekiyle karşılaştırır,
- yöneticilere "Ders programı güncellendi" bildirimi gönderir,
- ayrıntıyı **Yönetim → Program değişiklikleri** bölümüne yazar.

Satır karşılaştırması PDF tablosundan otomatik çıkarıldığı için ipucudur; kesin bilgi için PDF açılmalıdır. Takvim otomatik değişmez: yönetici takvimde ilgili güne gidip **Düzenle** / **+ Ders** ile düzeltir, sonra **Baktım** der.

**Her yıl başında:** `data/program-sayfalari.json` içindeki adresleri fakültenin yeni yıl sayfalarıyla değiştirin (GitHub'da dosyayı açıp kalem simgesiyle). Sayfa okunamazsa yöneticilere "Program sayfası okunamadı" bildirimi gider.

Kontrolün son durumu `data/program-durumu.json` dosyasında tutulur; elle değiştirmeyin.

---

## Sorun çıkarsa

- **Sayfa açılıyor ama giriş/arşiv çalışmıyor:** `js/config.js` doğru dolduruldu mu, adres Firebase'de *Authorized domains* listesinde mi, kurallar yayınlandı mı?
- **"Kaydetme izniniz yok":** Kişinin hesabı onaylanmamış olabilir.
- **Telefonda eski sürüm görünüyor:** Uygulamayı tamamen kapatıp yeniden açın.

## Yol haritası

- [x] Takvim, preparat arşivi, kayıt/giriş, yönetim
- [x] Pazartesi bildirimi (haftalık program)
- [ ] Bildirime seminer bilgisinin eklenmesi
- [x] Uygulama masaları: 8 masa, sabit masa, bir gün önce katılım sorusu, anlatıcı
- [ ] Seminer sırası (tatil/sınav haftalarında kayma, takas)
- [ ] Doğum günleri ve özel günler takvimde
