# Deneme takibi ve PDF aktarımı

Öğrenci **Denemelerim**, öğretmen **Denemeler** sekmesini kullanır. TYT, AYT ve branş denemeleri ayrı grafiklerde gösterilir. Branş seçimi oturuma bağlıdır; TYT/AYT Matematik ve Geometri birbirinden ayrıdır. AYT grafiğinde SAY, EA ve SÖZ seçilir; öğrencinin elle girdiği diğer alan denemeleri ilgili alanın grafiğinde kalır.

**+ Deneme ekle** formu açılır pencerede açar; tür, oturum ve branş açık sekmeden gelir ve pencerede değiştirilebilir. Pencere **Vazgeç**, **×** veya Esc ile kapanır. Sayfadaki Oturum, Branş, Alan, **Grafikte göster**, **Şu tarihten** ve **Şu tarihe kadar** alanları deneme eklemek için değil, yalnızca grafik ve geçmişi filtrelemek içindir; **Tarihleri temizle** tarih filtresini kaldırır.

Deneme adı, tarih, derslerin doğru/yanlış/soru sayıları girilir. Net doğru − yanlış / 4 olarak hesaplanır. Tamamlama süresi ve **yayınevi puanı** (yayınevinin sonuç raporunda yazan puan, ör. TYT puanı) isteğe bağlıdır. Grafikte net, süre veya yayınevi puanı seçilir. **Branş denemelerinde** ayrıca **net/dk** (net ÷ tamamlama süresi) seçilebilir; yalnızca süresi girilmiş branş denemeleri bu grafikte yer alır, eksikler grafiğin altında sayılır ve bu grafik seçiliyken özet kartları da net/dk gösterir. Branş denemesi ayrıntısı ve geçmiş tablosu net/dk değerini gösterir. TYT ve AYT’de net/dk gösterilmez; Branş sekmesine dönülünce seçim korunur. Nokta üzerine gelmek, dokunmak veya klavyeyle odaklanmak ders ayrıntılarını gösterir. Düzenleme aynı kaydı günceller; silme, eski cihazların sonucu yeniden getirmesini önleyen bir silme işareti bırakır.

## Genel denemelerdeki ders bölümleri

**Branş denemeleri** grafiği seçilen dersin TYT/AYT denemelerindeki bölümlerini de gösterir (ör. TYT Türkçe: her TYT denemesinin 40 soruluk Türkçe bölümü). Bu noktalar içi boş daire olarak çizilir. Geçmiş tablosunda ve ayrıntıda “TYT denemesinden” ya da “AYT denemesinden” etiketiyle görünür. Özet kartları birlikte sayar; “Deneme (TYT/AYT’den N)” kaçının genel denemeden geldiğini söyler. **TYT/AYT bölümleri → Göster** kutusu bunları gizler.

- Bölümler kaydedilmez. Her çizimde kaynak denemeden türetilir (`denemeGenelBolumleri`, kimlik `g:`). `denemeDogrula` bu kimliği reddeder, bu yüzden deftere, pakete veya buluta yazılamazlar. Kaynak deneme düzenlenir ya da silinirse bölüm de değişir.
- Soru sayıları sabittir. Bu yüzden öğrencinin girdiği testte boş bırakılan bölüm (0 D / 0 Y) 0 net olarak sayılır, ör. Geometri: 0 D / 0 Y / 10 B. TYT’nin bütün testleri herkes için sayılır. AYT’de öğrencinin alanının testleri sayılır (okul aktarımında öğrencinin alanı, öğrencinin kendi girdiği denemede o denemenin alanı); alan dışındaki ders yalnızca cevaplanmışsa sayılır. Din Kültürü ile Ek Felsefe birbirinin yerine çözülür: cevaplanan sayılır, ikisi de boşsa Din Kültürü 0 net sayılır. Oturuma hiç katılmayan öğrencinin o oturum kaydı olmadığı için nokta eklenmez.
- Soru sayısı denemede yoksa (PDF aktarımı) sınavdaki standart soru sayısı kullanılır, ör. TYT Türkçe 40, Matematik 30, Geometri 10.
- Süre ve yayınevi puanı bütün denemeye aittir. Bu yüzden bölümler yalnızca **Net** grafiğinde yer alır; Net/dk, Süre ve Yayınevi puanı grafiklerinde gösterilmez.
- Bölümün ayrıntısında düzenleme/silme/süre düğmesi yoktur; **TYT denemesini aç** kaynak denemeye gider.
- TYT/AYT denemesinin ayrıntısındaki her ders kutusu (“Ders gelişimi →”) o dersin Branş grafiğini, bu denemenin bölümü seçili olarak açar.

## Ana sayfadaki deneme gelişimi

Öğrencinin Haftalar haritası (girişten sonra açılan sayfa) yanında **Deneme gelişimi** grafiğini gösterir (`denemeYolGrafigi`, yalnızca YKS öğrencisi).

- x ekseni baştan sabittir: dönem başının haftasından YKS tarihine kadar. Deneme eklendikçe eksen uzamaz; her deneme kendi tarihine düşer ve çizgi zamanla sağdaki YKS çizgisine yaklaşır. Hiç deneme yokken de eksen ve YKS çizgisi görünür.
- TYT ve AYT neti ayrı çizgilerdir. AYT, öğrencinin alanına göre hesaplanır. Okul aktarımı her zaman sayılır; öğrencinin kendi girdiği AYT ise yalnızca kendi alanındaysa sayılır.
- “Bugün” kesikli bir çizgiyle gösterilir. Dönem başından önceki denemeler (ör. eski bir hazırbulunuşluk) grafikte yer almaz; alttaki not bunları sayar, Denemelerim’de görünürler.
- Bir noktaya tıklamak ya da Enter’a basmak o denemeyi Denemelerim’de kendi sekmesinde seçili açar.

## Öğretmen aktarımı

1. **PDF’den toplu aktar** ile bir veya birkaç metin içeren toplu sonuç PDF’si seçin.
2. Önizlemede sınav adı, tarih ve öğrenci eşleşmelerini kontrol edin. Numara **ve** ad tam eşleşirse otomatik seçilir; sınıf/şube eşleşmede kullanılmaz. Eşleşmeyen veya belirsiz satırları doğru öğrenciye elle atayın; hedef öğrenci değiştirildiğinde tekrar/silinmiş sonuç denetimi o öğrenci için yeniden yapılır. Öğrenci hesabı otomatik oluşturulmaz.
3. **Seçilen sonuçları kaydet ve yayınla** sonuçları yerel deftere ve öğrencilerin korumalı bulut kayıtlarına aktarır. Öğrenci açık oturumunda veya sonraki girişinde alır; kendi giriş yapması gerekmez.
4. Ağ/izin hatası olan öğrenciler açıkça listelenir. Sonuçları yeniden okumaya gerek yoktur: **Bekleyen sonuçları yayınla** ile tekrar deneyin.

Desteklenen ilk düzen, sağlanan **DENEME SINAVI TOPLU SONUÇ LİSTESİ** raporlarının TYT ve birleşik TYT+AYT biçimidir. Her sayfada sütun sırası, D/Y, ders neti ve toplam net denetlenir. Taranmış resim PDF’leri/OCR ve farklı yayınevi düzenleri otomatik yorumlanmaz; açık hata verilir. PDF sınırları: dosya başına 15 MB / 100 sayfa, seçim başına 10 dosya. Ayrıştırma tarayıcıda yapılır; PDF’ler bir işleme sunucusuna yüklenmez. PDF.js 5.6.205 uyumluluk modülü ilk kullanımda jsDelivr üzerinden yüklenir.

Birleşik raporun TYT tekrarları, başka tarihe sahip olsalar bile aynı sınav adı ve aynı ders D/Y değerleriyle tanınır ve önizlemede seçilmez. TYT-only rapor aynı yükleme grubundaysa onun tarihi tercih edilir. Farklı tarihte gerçekten yeniden çözülmüş aynı sonuç gerekiyorsa öğretmen satırı elle seçebilir. Öğretmenin daha önce sildiği sonuç tekrar olarak değil, “daha önce silindi” uyarısıyla seçilmemiş gelir; yeniden eklemek için elle seçilir. Sınavı boş bırakan ile o oturuma katılmayan öğrenci ayırt edilir. Birleşik rapordaki YKS-SAY/EA/SÖZ puanları AYT-only puanı olarak kullanılmaz. PDF’de tamamlama süresi olmadığı için süre boş kalır; öğrenci sonradan ekler. Yeniden aktarım süreyi boş yayınlasa da öğrencinin girdiği süre korunur; öğretmenin sonradan girdiği daha yeni bir süre ise görünür.

## Veri ve yayınlama

- `ogr[].denemeler`: öğrenci girişleri; sonuç paketi v4 ile birleştirilir. v1–v3 paketleri okunmaya devam eder. Açık eski sekmeler güncellenmelidir.
- `ogr[].denemeOkul`: öğretmenin aktardığı sonuçlar. Firestore `ogrenciler/{syncId}.denemeOkul` alanına ayrı JSON olarak yazılır. Yalnızca yuvanın yetkili öğretmeni değiştirebilir. Silinen sonuç silme işareti olarak kalır; öğrencinin aynı sınav için kendi girdiği sonucu gizlemez. Bu alan okunamazsa (ör. daha yeni uygulama sürümü) öğrenci girişi ve plan/sonuç eşitlemesi durmaz; hata Denemeler sayfasında gösterilir.
- `ogr[].denemeSure`: öğrencinin kendi tamamlama süreleri; öğretmen sonucunun D/Y değerlerini değiştirmez.
- Kayıtlar öğrenciye aittir; eşleşme yayınlanırken kalıcı bulut kimliğiyle tekrar denetlenir. Yuva rotasyonu öğretmen sonuçlarını taşır.
- Tam yedekler ve öğrenci dosya paketleri denemeleri içerir. JSON kopyaları ve sonuç kanalları aynı veriyi çalışma yedeğinde gereksiz yere çoğaltmaz.
- En fazla 1500 kayıt/kanal ve 3000 süre; okul deneme alanı 300 KB ile, toplam bulut yazısı mevcut 900 KB sınırıyla kontrol edilir. Öğrenci yazısı, aynı belgede duran okul deneme alanıyla birlikte ölçülür. Öğretmen silme veya süre düzeltmesi yayınlanamazsa cihazda kalır ve “yayın bekliyor” olarak gösterilir. Eski kayıtlar sessizce atılmaz.

**Dağıtım sırası:** önce bu dalın `firestore.rules` dosyasını mevcut Firebase projesine `firebase deploy --only firestore:rules --project <mevcut-proje>` ile yayınlayın; sonra `index.html` değişikliğini siteye alın. Kurallar yayınlanmadan öğretmen aktarımı cihazda kalır ve yayınlama hatası gösterilir. Bu PR üretim verisini değiştirmez veya ekli PDF’leri otomatik olarak üretime aktarmaz.

## Geliştirme ve doğrulama

Kaynaklar `src/denemeler.js` ve `src/denemeler.css`. `node scripts/embed-denemeler.cjs` bunları tek dosyalı uygulamaya gömer; `--check` eşitliği denetler; Windows (CRLF) çalışma kopyalarında da aynı sonucu verir. Elle gömülü kopyayı değiştirmeyin.

- `node test/mock-exam-regression.cjs`: ana sayfa grafiğinin sabit ekseni (yeni deneme eski noktaları kaydırmaz, dönem öncesi denemeler, AYT alanı, noktadan Denemelerim’e geçiş), alan toplamları, branş net/dk, genel deneme bölümleri (türetme, boş bölümün 0 net sayılması, alan ve Din/Ek Felsefe kuralı, kayda girmeme, gizleme, yalnızca net, geçişler), sayısal sınırlar, sürüm uyumu, silme/birleştirme, silinmiş sonuçlar, süre önceliği, tam öğrenci eşleşmesi, tekrarlar, sentetik PDF koordinatları ve CRLF gömme.
- `node test/mock-exam-browser.cjs` (Playwright): masaüstü/telefon formu, grafik, düzenleme, branş/AYT ayrımı, genel deneme bölümlerinin Branş grafiğinde gösterilmesi ve ders kutusundan geçiş, kalıcı kayıt, toplu aktarım ve yayınlama hatası/yeniden deneme.
- Mevcut Firestore emulator testleri: öğretmen/öğrenci erişimi, alan korunması, hesap ve yuva rotasyonu; gerçek iki istemciyle anlık teslim, yeni cihaz, kişisel süre ve eski cihazdan silinen sonucun geri gelmemesi.
- Sağlanan üç PDF ayrıca yerel PDF.js ve Chromium ile sınandı: 29 TYT; birleşik raporda 29 TYT + 22 AYT; hazırlık raporunda 29 TYT. Birleşik dosyadaki 29 TYT tekrarı işaretlenmedi. Gerçek öğrenci PDF’leri veya çıkartılan öğrenci verileri repoya eklenmedi.
