# İzleyici ve ortak öğretmen

Bir rehber öğretmenin defterine başka bir öğretmen iki biçimde erişebilir:

- **İzleyici:** yalnızca görüntüler (aşağıda).
- **Ortak öğretmen:** sahibi gibi düzenler; defteri aynı anda tek kişi düzenler (bkz. “Ortak öğretmen”).

İkisi de Firebase konsolunda aynı `izleyiciler/{UID}` belgesiyle verilir; ortak öğretmende belgeye ayrıca `yetki: "ortak"` yazılır.

## İzleyici (yalnızca görüntüleme)

Bir rehber öğretmen, başka bir öğretmenin defterini **yalnızca görüntüleyebilir**: öğrenciler, planlar, sonuçlar, Denemeler ve Sıralamalar sahibinin gördüğü gibi görünür ve sahibi yedek aldıkça güncellenir. İzleyici hiçbir şeyi değiştiremez, öğrencilere bir şey yayınlayamaz ve kendi defterine kopya yazmaz.

### İzin verme (Firebase konsolu)

İzin yalnızca konsoldan verilir; uygulama bu listeye yazamaz.

1. Güncel `firestore.rules` dosyasını yayınlayın (Firestore Database → Rules → Publish) ve güncel `index.html` yayında olsun.
2. İzleyici öğretmen ykstekrar.com’u bir kez açıp **Rehber öğretmenim** ile Google hesabıyla girer. İzni henüz olmadığı için bulut defteri açılmaz; bu beklenen durumdur.
3. Firebase konsolu → Authentication → Users: izleyicinin ve defter sahibinin **User UID** değerlerini kopyalayın.
4. Firestore Database → Data → `izleyiciler` koleksiyonu → belge kimliği: **izleyicinin UID’si**. Alanlar:
   - `sahipUid` (string): defter sahibinin UID’si
   - `ad` (string, isteğe bağlı): şeritte görünecek ad, ör. `Şahin Bilir`
5. İzleyici **Ayarlar → Buluta bağlan**’a basar (ya da yeniden **Rehber öğretmenim** ile girer). Paylaşılan defter açılır.

Bir izleyici bir defteri görebilir. İzni kaldırmak için `izleyiciler/{UID}` belgesini silin. Sunucu izin hatası verdiği anda (sayfa açıksa hemen, değilse bir sonraki açılışta bağlantı kurulunca) cihazdaki kopya silinir ve izleyicinin kendi defteri açılır. Cihaz çevrimdışıyken ya da Google oturumu kapalıyken son kopya görünmeye devam eder; uygulamanın kendi cihaz kayıtları gibi.

### Uygulamada

- Sayfanın üstünde “Yalnızca görüntüleme” şeridi görünür; menüdeki düğme **Çıkış yap** olur.
- `kaydet()` hiçbir yere yazmaz, bulut yedeği gönderilmez, Firebase modülü veri yazan çağrıları sunucuya göndermeden reddeder. Ekranda yapılan bir değişiklik kaydedilmez ve sahibin bir sonraki yedeğiyle silinir.
- Denemeler’de PDF aktarımı ve yayınlama, Sıralamalar’da PDF ekleme ve silme gizlenir. Sıralamalar raporları önizlenir ve indirilir; şube sıralaması seçimi yalnızca o oturumda geçerlidir.
- Defter `ogretmenYedek/{sahipUid}` belgesinden okunur ve onu dinler. Öğrenci yuvaları (`ogrenciler/{syncId}`) de dinlenir; öğrencinin son çalışması, sahibi siteyi açmamış olsa da ekranda görünür (kaydedilmeden).
- Hızlı açılış için son kopya bu cihazda `yks_izleme_veri` olarak tutulur. **Çıkış yap** oturumu kapatır ve yalnızca bu kopyayı siler; izleyicinin kendi defteri (`yks_veri`) olduğu gibi kalır. Bu modda çıkış sunucu kaydı beklemez; kaydedilecek bir şey yoktur.
- Allowlist’teki (`ogretmenler`) bir öğretmene izin verilirse girişte paylaşılan defter açılır; kendi defterine dönmek için izin belgesi silinmelidir.

## Ortak öğretmen (sahibi gibi düzenler)

### İzin verme

İzleyici adımlarının aynısı; yalnızca 4. adımda belgeye üçüncü bir alan eklenir:

- `yetki` (string): `ortak`

Ortak öğretmen allowlist’e (`ogretmenler`) eklenmez. Sahip allowlist’ten çıkarılırsa ortak öğretmenin yetkisi de biter. Ortak defter yalnızca **başka defter açık olmayan** bir cihazda açılır (“Rehber öğretmenim” ile girilmiş boş cihaz); cihazda başka bir defter varsa önce “Kaydet ve çıkış yap” istenir. Böylece kimsenin kendi defteri sahibin defterine karışmaz.

### Uygulamada

- Ortak öğretmen sahibin defterini açar ve sahibi gibi çalışır: plan, sonuç, öğrenci girişlerini yayınlama, PDF aktarımı, Denemeler, Sıralamalar, şifre talepleri. Sayfanın üstünde mavi “Ortak defter · {ad}” şeridi görünür.
- Bütün yazılar sahibin uid’siyle yapılır (`defterUid`): `ogretmenYedek/{sahipUid}` (günlük geçmiş ve geri yükleme noktaları dahil), öğrenci yuvalarının `ogretmenUid` alanı ve öğrenci hesapları. Öğrenciler hiçbir fark görmez; sahip, ortak öğretmenin açtığı öğrencileri de kendi defterinde görür.
- Cihazdaki kopya `yks_veri`de durur, ortaklık bilgisi `yks_ortak`ta. “Kaydet ve çıkış yap” ikisini de siler. Aynı cihazda başka bir Google hesabı açılırsa sahibin defterine yazılmaz.
- İzin kaldırılır ya da değişirse (kilit okunamayınca izin yeniden okunur) cihazdaki kopya silinir ve sayfa yenilenir. İzin hâlâ duruyorsa geçici bir hata kopyayı silmez.

### Tek kişi düzenler (kilit)

Defteri aynı anda yalnızca bir kişi (sahip ya da ortak öğretmen) düzenler. Kilit `defterKilidi/{sahipUid}` = `{uid, ad, ts}` belgesidir; `ts` sunucu saatidir.

- Defteri açan ve işlem yapan kişi kilidi alır ve dakikada bir tazeler. 5 dakika işlem yapılmazsa (ya da sekme gizliyse) tazelemez; 2 dakika tazelenmeyen kilit **bayattır** ve işlem yapan diğer kişi devralır. “Kaydet ve çıkış yap” ve sayfayı kapatmak kilidi hemen bırakır.
- Kilit başkasındayken bu cihaz **yalnızca görüntüler**: üstte turuncu “{ad} düzenliyor · Yalnızca görüntüleme” şeridi görünür, hiçbir şey kaydedilmez, öğrenci çalışması bu cihazda uygulanmaz, menüdeki düğme “Çıkış yap” olur. Buluttaki defter canlı izlenir; düzenleyen kaydettikçe ekran ve cihazdaki kopya güncellenir.
- Sıra bu cihaza geçince (30 saniyede bir ve her işlemde denetlenir) şerit kalkar, “Düzenleme sırası sizde.” görünür ve buluttaki son defterle devam edilir.
- Bu cihazda buluta gitmemiş bir kayıt varsa buluttaki defter üzerine yazılmaz (şeritte belirtilir); sıra gelince mevcut “Bulutta farklı bir defter var” çakışma akışı devralır.
- Kurallar henüz yayınlanmadıysa (kilit okunamıyorsa) sahip eskisi gibi kilitsiz çalışır.
- Aynı hesabın iki cihazı aynı kişi sayılır; aralarındaki koruma eskisi gibi bulut temeli (çakışma uyarısı) ile yapılır.

## Kurallar

`firestore.rules` içindeki `izleyici(sahipUid)`: oturum anonim değil, `izleyiciler/{uid}` var ve `sahipUid` eşleşiyor. Buna göre izleyici yalnızca:

- `izleyiciler/{kendi uid}` belgesini okur (listeleme ve yazma kapalı),
- `ogretmenYedek/{sahipUid}` belgesini okur (günlük geçmiş ve geri yükleme noktaları kapalı),
- sahibine ait **mevcut** `ogrenciler/{syncId}` belgelerini okur.

İzleyici `ogretmenler` listesinde olmadığı için öğrenci yuvası oluşturamaz, öğrenci hesabı yayınlayamaz, kendi adına bile yedek yazamaz.

Ortak öğretmen için:

- `ortakOgretmen(sahipUid)`: izin belgesinde `yetki == 'ortak'`, `sahipUid` eşleşiyor ve sahip allowlist’te.
- `defterYetkilisi(sahipUid)`: sahip (allowlist’te) ya da ortak öğretmeni. Sahibin defteri, günlük geçmişi, geri yükleme noktaları ve öğrenci yuvaları bununla okunur ve yazılır; yeni yuvanın `ogretmenUid` alanı sahibin uid’si olmalıdır.
- `ogretmenYetkisi()`: allowlist ya da herhangi bir ortak öğretmen. Sahibe bağlı olmayan öğretmen işlemleri (öğrenci hesapları, şifre talepleri, kurtarma, giriş yönü, devir) bununla açılır.
- `defterKilidi/{sahipUid}`: yalnızca defter yetkilileri okur; yazan kendi uid’sini ve sunucu saatini (`request.time`) yazar. Taze bir kilidi yalnızca sahibi tazeler; 2 dakikadır bayat kilit devralınabilir; yalnızca sahibi siler.
- `kilitUygun(sahipUid)`: başkası taze kilidi tutarken defter ve günlük geçmiş yazılamaz. Eski bir sekme ya da uygulama sürümü bile düzenleyenin yazdığını ezemez.

## Testler

- `test/ortak-ogretmen-regression.cjs`: ortak defter düzenlenir ve sahibin uid’sine kaydedilir (günlük kopya dahil); öğrenci yuvası sahibin uid’siyle açılır; başka defteri açık cihaz ortak olamaz; tek kişi düzenler (sahip bekler, bulutu canlı izler, eski sürüm bile yazamaz; ortak çıkınca kilit bırakılır ve sıra sahibe geçer); bayat kilit işlem yapana geçer, boştaki sekme kilit almaz; kilit dakikada bir ve yalnızca işlem varken tazelenir; izin kalkınca kopya silinir, geçici hata silmez; yeniden açılış ve başka Google hesabı; kurallar yayınlanmadan sahip kilitsiz çalışır; düz izleyici kilit almaz.
- `test/firebase/firestore.test.mjs` (emülatör): ortak öğretmenin sahibin defterini, geçmişini, yuvalarını ve öğretmen işlemlerini yazması; kendi uid’sine ya da başka öğretmene yazamaması; allowlist dışı sahibin ortağının yetkisizliği; kilidin tek yazara izin vermesi, sunucu saati, bayat kilidin devri; iznin kaldırılması.

- `test/izleyici-regression.cjs`: izinsiz öğretmen eski akışta kalır; izinle defter salt okunur açılır; hiçbir yazı yapılmaz; öğrenci yuvaları ve sahibin yeni yedeği ekrana yansır; başka öğretmenin yuvası alınmaz; izin kalkınca kopya silinir; yeniden açılış, bozuk kopya, çıkış ve gizlenen düğmeler.
- `test/firebase/firestore.test.mjs` (emülatör): izin belgesinin yalnızca konsoldan yazılması, yalnızca sahibin defterinin ve yuvalarının okunması, hiçbir yazmanın geçmemesi, iznin kaldırılması.
