# HistoApp

ADÜ Histoloji ve Embriyoloji Anabilim Dalı uygulaması.

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

## Profil ekranı

Her asistan Profil'deki **Görevlerim** kartında masasını görür; kayıt olunca masasını kendisi seçer, gerekirse **Değiştir** ile değiştirir (her masa en fazla 2 kişilik, dolu masalar seçilemez; yönetici Yönetim → Kişiler'den de değiştirebilir). Ayrıca yaklaşan seminerini (konusunu buradan yazabilir) ve anlatıcı olarak atandığı yaklaşan uygulamaları görür.

## Seminer sırası

Alt menüdeki **Seminer** ekranı herkese yaklaşan seminerleri Salı Salı gösterir; histoloji sınavı olan ve "seminer yok" denen Salılar da listede görünür. Sunan kişi kendi seminerine konusunu buradan da yazabilir.

Yöneticiler her seminerin **Düzenle** menüsünden:
- **Bu hafta seminer yok:** O Salı boş geçilir (neden yazılabilir: tatil, kongre…), o haftanın semineri bir sonraki uygun Salıya geçer; orası doluysa oradaki de bir sonrakine itilir. Arada boş bir Salı varsa kayma orada durur, boşluktan sonraki seminerlere dokunulmaz. Boş geçilen Salıdaki **Geri al** sadece o sırada kayan seminerleri eski yerlerine döndürür.
- **Yer değiştir:** İki seminerin sunucuları (konu ve danışmanıyla) yer değiştirir, tarihler aynı kalır.
- **Sıradan çıkar:** Seminer silinir, hemen arkasındaki seminerler öne kayar; arada boş Salı varsa kayma orada durur.
- **+ Sıranın sonuna ekle:** Yeni kişi sıradaki ilk uygun Salıya eklenir.
- Araya boş bir Salı düşmüşse **Sonrakileri buraya çek** sadece o boşluğu kapatır (bir sonraki boşlukta durur).

Programa sonradan bir Salı günü histoloji sınavı eklenirse o Salıdaki seminer uyarıyla gösterilir (Yönetim → Yapılacak'ta da çıkar); **Sonrakileri kaydır** ile düzeltilir. "Seminer yok" Salıları `config/seminer` belgesinde tutulur.

## Preparat arşivi

Her preparat **kod** (ilk numara, ör. 28 = Böbrek) ve **seri** ile tutulur: farklı seriler rakamla (28-1, 28-2…), özel boyalar harfle (33-a Verhoeff…). Birleşik kodlar (8-9 Trakea-Özofagus, 47-48, 50-51, 55-56) kendi başına koddur. Kalite bölümün ölçeğiyle girilir (Çok iyi, İyi, Orta-iyi, Orta, Orta-kötü, Kötü); kırık lam sayısı ayrı alandır. "Sorunlu" filtresi kalitesi kötü ya da kırığı olanları gösterir. Aramaya rakam yazılırsa kod olarak aranır (9 → kod 9'un serileri).

Bölümün preparat listesi (`data/preparatlar.json`, kaynak: Preparat_listesi_2025.docx) Actions → **Preparat listesini yükle** ile arşive aktarılır; arşivde zaten olan satırlar atlanır, uygulamada yapılan düzeltmelerin üzerine yazılmaz.

Preparatlar uygulama konularına bağlıdır (takvimde uygulama kartının altında "Preparatlar: 28 Böbrek · 14…" olarak görünür, dokununca arşiv o kodla açılır). Toplu eşleştirme `data/preparat-ders.json`'dadır ve Actions → **Preparatları derslere bağla** ile uygulanır (sadece ekler); tek tek değişiklik preparatın Düzenle → Kullanıldığı uygulamalar kısmından yapılır.

## Sınav gözetmenleri

Histoloji uygulama sınavlarının her oturumunda 4 grup vardır; her grubun bir hocası, her hocanın (varsayılan) 2 gözetmeni olur. Gruplar ve hocaları sabittir: 1. Alpaslan Gökçimen ve Gökçen Gökçe Tepeli, 2. Esra Gökmen Yılmaz, 3. Kemal Ergin, 4. Erkan Gümüş (`js/gozetmen.js` → `VARSAYILAN_HOCALAR`; bir sınav için farklıysa Düzenle'den değiştirilir).
- Aynı gün aynı kurulun iki oturumu (ör. 09:30 ve 13:30) tek sınav sayılır: gözetmen bir kez seçilir ve günün bütün oturumlarında görevlidir.
- Takvimdeki sınav kartında "Gözetmen: 3/8" gibi doluluk görünür. **📝 Gözetmen ol** ile açılan pencerede asistan boş bir gruba yazılır, istersen başka gruba geçer ya da kendini çıkarır (×).
- Yönetici aynı pencerede her grubun **Düzenle** kısmından hoca adını yazar, gözetmen sayısını −/+ ile değiştirir ve **Kişi ekle** ile atama yapar. Listede herkesin bu yıl aldığı gözetmenlik sayısı yazar, en az görev alan en üstte durur.
- Önümüzdeki 3 haftada gözetmeni eksik sınavlar Yönetim → Yapılacak'ta görünür.
- Kişi Profil → Görevlerim'de kendi gözetmenliklerini görür; **1 hafta önce** ve **bir önceki iş günü** hatırlatma bildirimi gelir (Pazartesi sınavları için Cuma).

## Uygulama sınavı kâğıdı

Takvimdeki uygulama sınavı kartında **📄 Sınav kâğıdı** (ya da Yönetim → Program → Sınav kâğıtlarını aç) sınavın kâğıt ekranını açar. Her oturum (ör. 09.30 ve 13.30) için ayrı sorular girilir: soru metni (hazır kalıplardan seçilebilir; daha önce kaydedilmiş kâğıtlardaki sorular da listeye eklenir), puan, cevap ve mikroskoba konacak preparat (arşivden kodla, ör. 9-1). Başlık (dönem, yıl, kurul) ve notlar sınavdan otomatik doldurulur, düzenlenebilir; `__iki alt çizgi__` arasındaki metin altı çizili basılır.
- Bir soru alt sorulara ayrılabilir: **+ A) B) alt soru** (her alt sorunun kendi metni, puanı ve cevabı olur: "1. A) ORGANIN ADINI YAZINIZ … B) OK İLE İŞARETLİ YAPININ …") ya da **+ Numaralı bölge** (öncül cümlesinin altında "1 --- …MİNE… (2 PUAN)" satırları; öncülün sonuna toplam puan yazılır). Soru metninde alt satıra geçilerek çok satırlı öncül yazılabilir.
- Takvimde olmayan sınavlar (ör. Diş bütünleme, final) için **+ Takvimde olmayan bir sınav için kâğıt** ile Tıp ya da Diş başlıklı boş kâğıt açılır; oturum eklenip silinebilir. Başlıktaki "UYGULAMA SINAVI" satırı da düzenlenebilir (ör. BÜTÜNLEME UYGULAMA SINAVI).
- **Öğrenci kâğıdını aç** ve **Cevap anahtarını aç** kâğıdı indirmeden ayrı bir sayfada gösterir (her oturum ayrı sayfa, cevaplar kırmızı); sayfanın üstündeki **Yazdır** ile yazdırılır. Word dosyası gerekirse altındaki bağlantılarla iner.
- Altta oturum oturum **mikroskoplara konacak preparatlar** listesi çıkar.
- Kâğıtlar `sinavKagitlari` koleksiyonunda tutulur, sadece onaylı üyeler görür; haftalık yedeğe girer.

## Kura

Üst banttaki 🎲 düğmesi (onaylı üyelere görünür) kura ekranını açar. Üç tür kura var:
- **Kişi seç:** seçilenler arasından istenen sayıda kişi.
- **Sırala:** herkesi rastgele sıraya dizer (ör. nöbet ya da seminer sırası).
- **Görevlere dağıt:** her satıra bir görev yazılır, her göreve istenen sayıda kişi düşer.

Katılanlar üye listesinden işaretlenir; listede olmayan adlar da eklenebilir. Kura tarayıcının güvenli rastgele sayı üreteciyle çekilir, çekildiği anda kimin çektiği ve saatiyle kaydedilir ve herkes görür. Kayıtlar değiştirilemez (sadece yönetici silebilir); böylece bir kuranın tekrar çekilip çekilmediği de görülür.

## Yönetim ekranı

**Yapılacak** sekmesi açılışta gelir ve sadece iş bekleyen şeyleri gösterir: onay bekleyen kayıtlar, fakülte programındaki değişiklikler, önümüzdeki 3 haftada anlatıcısı olmayan uygulamalar, eşleşmemiş seminerler, masasını seçmemiş kişiler ya da 2'den fazla kişi olan masalar. Hiçbiri yoksa "Her şey yolunda ✓" yazar. Tüm seçimler (masa, anlatıcı, seminer kişisi) seçildiği anda kaydedilir.

## Klasördeki dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `index.html`, `style.css` | Sayfanın kendisi ve görünümü |
| `js/config.js` | Firebase proje ayarları (**kurulumda bir kere doldurulur**) |
| `js/takvim.js` | Takvim ekranı |
| `js/arsiv.js` | Preparat arşivi |
| `js/hesap.js` | Kayıt, giriş, profil |
| `js/yonetim.js` | Yönetim ekranı (sekmeler: Yapılacak · Kişiler · Uygulama · Program) |
| `data/events.json` | Öğretim yılının ders programı |
| `firestore.rules` | Veritabanı güvenlik kuralları (değiştiğinde GitHub otomatik olarak Firebase'e yayınlar) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Telefonda "ana ekrana ekle" ile uygulama gibi çalışması için |

---

## İlk kurulum (bir kere)

1. **Firebase ayarları:** Firebase konsolu → Proje ayarları → Genel → Uygulamalarınız → web uygulaması. `firebaseConfig` bloğundaki değerleri `js/config.js` dosyasına yazın.
2. **Güvenlik kuralları:** Firebase konsolu → Firestore Database → **Kurallar** sekmesi. `firestore.rules` dosyasının içeriğini olduğu gibi yapıştırıp **Yayınla**'ya basın. Sonrasında elle yapmaya gerek yok: dosya GitHub'da her değiştiğinde **Firestore kurallarını yayınla** görevi kuralları kendisi yayınlar (Actions'tan elle de çalıştırılabilir).
3. **GitHub'a yükleme:** Organizasyonda `histoloji` adında **public** bir depo (repository) açın. Bu klasördeki bütün dosyaları **Add file → Upload files** ile yükleyin.
4. **Yayına alma:** Depo → Settings → Pages → *Build and deployment* → Source: **Deploy from a branch**, Branch: **main** / **(root)** → Save. Birkaç dakika sonra adres görünür (örneğin `https://adu-histoloji.github.io/histoloji/`).
5. **Firebase'e adresi tanıtma:** Firebase konsolu → Authentication → Settings → **Authorized domains** → `adu-histoloji.github.io` adresini ekleyin.
6. **İlk kayıt:** Uygulamayı açın → Profil → **Kayıt ol**. İlk kaydolan kişi otomatik olarak **yönetici** olur ve bölüm kodunu belirler.
7. **Programı yükleme:** Yönetim → Program → **Ders programını yükle** → **Tümünü değiştir**.
8. Bölüm kodunu ve uygulama adresini asistanlarla paylaşın.

---

## Günlük kullanım

**Yeni asistan:** Uygulamada Profil → Kayıt ol (bölüm kodu + ad soyad + 6 haneli PIN). Ardından bir yönetici Yönetim → **Yapılacak** sekmesinden onaylar, Yönetim → Kişiler'den masasını seçer.

**PIN unutulursa:** Yönetim → Kişiler → kişinin yanındaki **Diğer** → **Kaydı sıfırla**. Kişi aynı adla yeniden kayıt olur, yönetici tekrar onaylar ve masasını yeniden seçer.

**Bölümden ayrılan kişi:** Yönetim → Kişiler → Diğer → Kaydı sıfırla.

**Yöneticiliği devretmek:** Yönetim → Kişiler → Diğer → **Yönetici yap**. Bölümde her zaman en az iki yönetici olsun.

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
| `k` | `T` teorik, `U` uygulama, `S` sınav, `M` seminer (`s` = `Seminer`, `who` = sunan kişi) |
| `topic`, `who` | Konu ve öğretim üyesi |
| `g` | Grup (A, B, C, D), varsa |
| `yer`, `note`, `prep`, `warn` | İsteğe bağlı: derslik, not, hazırlık notu, uyarı |

Yıl içindeki tek tük değişiklikler için dosyaya dokunmayın: uygulamada yönetici olarak takvimde ilgili güne gidip **Düzenle** ya da **+ Ders** kullanın. Dosya sadece yeni öğretim yılının programı için düzenlenir; ardından Yönetim → Program → Ders programını yükle → **Tümünü değiştir** (bu işlem takvimdeki elle yapılmış düzeltmeleri siler).

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

- Herkes sabit masasını Profil'den kendisi seçer; yönetici gerekirse **Yönetim → Kişiler**'den değiştirir. Her masa en fazla 2 kişiliktir (`js/uygulamalar.js` → `MASA_KAP`).
- Asistan "Katılıyorum / Katılamıyorum" der. Gelemeyen birinin masası boş görünür; katılan başka biri o günlüğüne **Bu masaya geç** ile alabilir.
- Anlatıcılar asistanlar arasından seçilir. Her asistan takvimdeki ya da Masalar ekranındaki uygulama kartında anlatıcısı olmayan bir konuya **🎤 Anlatıcı ol** diyebilir, kendi aldığını **Anlatıcılığı bırak** ile bırakabilir; başkasının aldığı konuyu alamaz. Yönetici kartlardaki **Anlatıcı ata / değiştir** ile ya da **Yönetim → Uygulama → Anlatıcılar**'dan herkesi atayabilir. Anlatıcı konu başına bir kere seçilir, bütün grupları kapsar. Programdaki öğretim üyesi ayrıca gösterilir; anlatıcı seçilmemişse "Anlatıcı belirlenmedi" yazar.
- **Bildirim:** Uygulamadan bir gün önce 08:50 civarında herkese "Yarın uygulama var, katılıyor musun?" gider; anlatıcı uygulamaya kayıtlıysa ona "Yarın anlatıcısın" gider. Görev: `.github/workflows/gunluk.yml`, betik: `scripts/gunluk.mjs`. Elle test: Actions → *Uygulama katılım sorusu* → Run workflow.

---

## Ders programı değişiklik kontrolü

Hafta içi her gün 13:20 civarında `.github/workflows/program-kontrol.yml` fakültenin ders programı sayfalarını kontrol eder (adresler: `data/program-sayfalari.json`). Yeni, güncellenmiş ya da içeriği değişmiş bir PDF bulursa:

- PDF'teki histoloji satırlarını öncekiyle karşılaştırır,
- yöneticilere "Ders programı güncellendi" bildirimi gönderir,
- ayrıntıyı **Yönetim → Program** sekmesine yazar.

Satır karşılaştırması PDF tablosundan otomatik çıkarıldığı için ipucudur; kesin bilgi için PDF açılmalıdır. Takvim otomatik değişmez: yönetici takvimde ilgili güne gidip **Düzenle** / **+ Ders** ile düzeltir, sonra **Baktım** der.

**Her yıl başında:** `data/program-sayfalari.json` içindeki adresleri fakültenin yeni yıl sayfalarıyla değiştirin (GitHub'da dosyayı açıp kalem simgesiyle). Sayfa okunamazsa yöneticilere "Program sayfası okunamadı" bildirimi gider.

Kontrolün son durumu `data/program-durumu.json` dosyasında tutulur; elle değiştirmeyin.

---

## Görev hatırlatmaları

**Görev hatırlatmaları** görevi hafta içi her sabah 08:55'te çalışır:
- Seminer sunacak kişiye **1 hafta önce** ve **1 gün önce** (Pazartesi) bildirim gider; konusunu yazmamışsa yazmasını hatırlatır.
- Uygulama anlatıcısına **1 hafta önce** bildirim gider; **1 gün önceki** "Yarın anlatıcısın" bildirimini katılım sorusu görevi gönderir.

Denemek için: Actions → **Görev hatırlatmaları** → Run workflow. **bugun** alanına bir tarih yazılırsa o gün çalışmış gibi davranır (ör. 08.12 seminerinin bir gün öncesi için `2026-12-07`). **test** işaretliyse mesajlar asıl kişiye değil yöneticilere gider; **kuru** işaretliyse hiçbir şey gönderilmez, sadece kime ne gideceği görev kaydına yazılır.

## Tema

Profil → **Tema**'dan uygulamanın renkleri bir histolojik boyaya göre seçilir: H&E (varsayılan), Masson trikrom, PAS, Toluidin mavisi, Gümüşleme, Giemsa. Ders türü renkleri (teorik, uygulama, Diş, seminer) seçilen boyanın renklerine uyar. Aynı yerden görünüm Otomatik / Açık / Koyu seçilir. Seçim cihazda saklanır (`hp-boya`, `hp-gorunum`); renkler `style.css` sonundaki `:root[data-boya=…]` bloklarındadır.

## Gizlilik ve erişim

- Giriş ekranında isim listesi yoktur: kişi adını ve PIN'ini yazarak girer (büyük/küçük harf, fazladan boşluk ve Türkçe harf farkı önemsizdir). Adın özetinden türetilen bir adreste sadece o kişinin giriş için kullanılan teknik adresi durur (`girisler`); isim tutulmaz ve liste alınamaz.
- **Bölüm kodu** sadece kayıt olurken sorulur.
- Takvim (veritabanındaki hali), seminerler, anlatıcılar, preparat arşivi, masalar, katılımlar ve doğum günleri sadece **onaylanmış üyelere** açıktır. Giriş yapmamış biri sadece fakültenin zaten yayımladığı ders programını (`data/events.json`) görür; seminer sunanların adları bu dosyada tutulmaz.
- Bölüm kodu Yönetim → Kişiler → **Bölüm kodu**'ndan değiştirilir (en az 6 karakter, harf ve rakam karışık). Kayıtlı kişilerin girişi bundan etkilenmez.
- PIN'ler Google'ın giriş sisteminde şifreli tutulur; yöneticiler dahil kimse göremez. Çok sayıda hatalı denemede Google hesabı geçici olarak kilitler.

## Yedekleme

**Veritabanı yedeği** görevi her pazar gece 04:30'da veritabanının tamamını (kişiler, takvim, preparat arşivi ve fotoğrafları, anlatıcılar, katılımlar, seminer ayarları; telefonların bildirim adresleri hariç) şifreleyip GitHub'da saklar. Her yedek 90 gün tutulur, yani geriye dönük yaklaşık 13 haftalık yedek hep vardır. Actions → Veritabanı yedeği → bir çalıştırma → en alttaki **Artifacts** kısmında görünür. Depo herkese açık olduğu için yedekler şifrelidir; şifresiz hali hiçbir yerde durmaz.

**Kurulum (bir kere):** GitHub → depo → Settings → Secrets and variables → Actions → **New repository secret**. Name: `YEDEK_SIFRE`, Secret: en az 16 karakterlik rastgele bir şifre. Bu şifreyi bölümün ortak bir yerine (ör. kilitli dolaptaki kurulum notları) de yazın: GitHub'daki gizli değer okunamaz, sadece değiştirilebilir. Şifre değiştirilirse eski yedekler yeni şifreyle açılmaz.

**Geri yükleme:** Actions → **Yedekten geri yükle** → Run workflow.
- Önce **kuru** işaretli haliyle çalıştırın: hangi yedeğin kullanılacağını ve kaç belge yazılacağını gösterir, hiçbir şey değiştirmez.
- Gerçekten geri yüklemek için **kuru** işaretini kaldırın ve **onay** alanına `GERİ YÜKLE` yazın.
- **calistirma** boşsa en son yedek kullanılır; eski bir yedek için Veritabanı yedeği görevinin o çalıştırmasını açıp adres çubuğundaki `/runs/` sonrasındaki sayıyı yazın.
- **koleksiyon** ile sadece bir bölüm geri yüklenebilir (ör. silinen preparatlar için `preps`).
- Yedekteki belgeler yedekteki haliyle yazılır; yedekte olmayan (sonradan eklenmiş) belgelere dokunulmaz.

## Test bildirimi

Bir kişiye bildirim gidip gitmediğini denemek için: GitHub → **Actions** → **Test bildirimi** → **Run workflow** → kişinin adını yaz → **Run workflow**. Görev bitince açıp özet kısmına bakın: kişinin onaylı olup olmadığı, kaç cihazının kayıtlı olduğu ve gönderimin başarılı olup olmadığı yazar. Ad boş bırakılırsa tüm onaylı kişilere gider.

## Bildirim biçimi ve bildirim kutusu

Bildirimler takvimdeki renkleri emojiyle taşır: 🟣 teorik, 🔴 uygulama, 🟢 Diş teorik, 🟠 Diş uygulama, 📝 sınav. Metinler `scripts/bicim.mjs`, `scripts/mesaj.mjs` (haftalık) ve `scripts/gunluk-mesaj.mjs` (katılım sorusu) dosyalarında hazırlanır.

- Katılım sorusu herkese kendi masa numarasıyla gider. Android'de bildirimin altında **Katılıyorum / Katılamıyorum** düğmeleri çıkar; iPhone düğme göstermez, bildirime dokununca Masalar ekranı açılır.
- Gönderilen her bildirim uygulamada sağ üstteki 🔔 simgesinde (bildirim kutusu) saklanır; okunmamışların sayısı simgede görünür. Program değişikliği bildirimleri sadece yöneticilerin kutusuna düşer.

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
- [x] Seminerler takvimde ve pazartesi bildiriminde (2026-2027 güz listesi, sınav günleri atlanarak)
- [x] Seminer sunan kişinin kendi konusunu yazması (Yönetim → Program → Seminerler; adı kayıtla aynı olanlar kendiliğinden eşleşir; pazartesi hatırlatması)
- [x] Seminer sırası ekranı (tatil/sınav haftalarında kayma, yer değiştirme, ekleme/çıkarma)
- [ ] Doğum günleri ve özel günler takvimde
