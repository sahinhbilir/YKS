# İzleyici öğretmen (yalnızca görüntüleme)

Bir rehber öğretmen, başka bir öğretmenin defterini **yalnızca görüntüleyebilir**: öğrenciler, planlar, sonuçlar, Denemeler ve Sıralamalar sahibinin gördüğü gibi görünür ve sahibi yedek aldıkça güncellenir. İzleyici hiçbir şeyi değiştiremez, öğrencilere bir şey yayınlayamaz ve kendi defterine kopya yazmaz.

## İzin verme (Firebase konsolu)

İzin yalnızca konsoldan verilir; uygulama bu listeye yazamaz.

1. Güncel `firestore.rules` dosyasını yayınlayın (Firestore Database → Rules → Publish) ve güncel `index.html` yayında olsun.
2. İzleyici öğretmen ykstekrar.com’u bir kez açıp **Rehber öğretmenim** ile Google hesabıyla girer. İzni henüz olmadığı için bulut defteri açılmaz; bu beklenen durumdur.
3. Firebase konsolu → Authentication → Users: izleyicinin ve defter sahibinin **User UID** değerlerini kopyalayın.
4. Firestore Database → Data → `izleyiciler` koleksiyonu → belge kimliği: **izleyicinin UID’si**. Alanlar:
   - `sahipUid` (string): defter sahibinin UID’si
   - `ad` (string, isteğe bağlı): şeritte görünecek ad, ör. `Şahin Bilir`
5. İzleyici **Ayarlar → Buluta bağlan**’a basar (ya da yeniden **Rehber öğretmenim** ile girer). Paylaşılan defter açılır.

Bir izleyici bir defteri görebilir. İzni kaldırmak için `izleyiciler/{UID}` belgesini silin. Sunucu izin hatası verdiği anda (sayfa açıksa hemen, değilse bir sonraki açılışta bağlantı kurulunca) cihazdaki kopya silinir ve izleyicinin kendi defteri açılır. Cihaz çevrimdışıyken ya da Google oturumu kapalıyken son kopya görünmeye devam eder; uygulamanın kendi cihaz kayıtları gibi.

## Uygulamada

- Sayfanın üstünde “Yalnızca görüntüleme” şeridi görünür; menüdeki düğme **Çıkış yap** olur.
- `kaydet()` hiçbir yere yazmaz, bulut yedeği gönderilmez, Firebase modülü veri yazan çağrıları sunucuya göndermeden reddeder. Ekranda yapılan bir değişiklik kaydedilmez ve sahibin bir sonraki yedeğiyle silinir.
- Denemeler’de PDF aktarımı ve yayınlama, Sıralamalar’da PDF ekleme ve silme gizlenir. Sıralamalar raporları önizlenir ve indirilir; şube sıralaması seçimi yalnızca o oturumda geçerlidir.
- Defter `ogretmenYedek/{sahipUid}` belgesinden okunur ve onu dinler. Öğrenci yuvaları (`ogrenciler/{syncId}`) de dinlenir; öğrencinin son çalışması, sahibi siteyi açmamış olsa da ekranda görünür (kaydedilmeden).
- Hızlı açılış için son kopya bu cihazda `yks_izleme_veri` olarak tutulur. **Çıkış yap** oturumu kapatır ve yalnızca bu kopyayı siler; izleyicinin kendi defteri (`yks_veri`) olduğu gibi kalır. Bu modda çıkış sunucu kaydı beklemez; kaydedilecek bir şey yoktur.
- Allowlist’teki (`ogretmenler`) bir öğretmene izin verilirse girişte paylaşılan defter açılır; kendi defterine dönmek için izin belgesi silinmelidir.

## Kurallar

`firestore.rules` içindeki `izleyici(sahipUid)`: oturum anonim değil, `izleyiciler/{uid}` var ve `sahipUid` eşleşiyor. Buna göre izleyici yalnızca:

- `izleyiciler/{kendi uid}` belgesini okur (listeleme ve yazma kapalı),
- `ogretmenYedek/{sahipUid}` belgesini okur (günlük geçmiş ve geri yükleme noktaları kapalı),
- sahibine ait **mevcut** `ogrenciler/{syncId}` belgelerini okur.

İzleyici `ogretmenler` listesinde olmadığı için öğrenci yuvası oluşturamaz, öğrenci hesabı yayınlayamaz, kendi adına bile yedek yazamaz.

## Testler

- `test/izleyici-regression.cjs`: izinsiz öğretmen eski akışta kalır; izinle defter salt okunur açılır; hiçbir yazı yapılmaz; öğrenci yuvaları ve sahibin yeni yedeği ekrana yansır; başka öğretmenin yuvası alınmaz; izin kalkınca kopya silinir; yeniden açılış, bozuk kopya, çıkış ve gizlenen düğmeler.
- `test/firebase/firestore.test.mjs` (emülatör): izin belgesinin yalnızca konsoldan yazılması, yalnızca sahibin defterinin ve yuvalarının okunması, hiçbir yazmanın geçmemesi, iznin kaldırılması.
