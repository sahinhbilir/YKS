# Deneme takibi ve PDF aktarımı

Öğrenci **Denemelerim**, öğretmen **Denemeler** sekmesini kullanır. TYT, AYT ve branş denemeleri ayrı grafiklerde gösterilir. Branş seçimi oturuma bağlıdır; TYT/AYT Matematik ve Geometri birbirinden ayrıdır. AYT grafiğinde SAY, EA ve SÖZ seçilir; öğrencinin elle girdiği diğer alan denemeleri ilgili alanın grafiğinde kalır.

Deneme adı, tarih, derslerin doğru/yanlış/soru sayıları girilir. Net doğru − yanlış / 4 olarak hesaplanır. Tamamlama süresi ve yayınevinin rapor puanı isteğe bağlıdır. Grafikte net, süre veya rapor puanı seçilir. Nokta üzerine gelmek, dokunmak veya klavyeyle odaklanmak ders ayrıntılarını gösterir. Düzenleme aynı kaydı günceller; silme, eski cihazların sonucu yeniden getirmesini önleyen bir silme işareti bırakır.

## Öğretmen aktarımı

1. **PDF’den toplu aktar** ile bir veya birkaç metin içeren toplu sonuç PDF’si seçin.
2. Önizlemede sınav adı, tarih ve öğrenci eşleşmelerini kontrol edin. Numara **ve** ad tam eşleşirse otomatik seçilir. Eşleşmeyen veya belirsiz satırları doğru öğrenciye elle atayın; öğrenci hesabı otomatik oluşturulmaz.
3. **Seçilen sonuçları kaydet ve yayınla** sonuçları yerel deftere ve öğrencilerin korumalı bulut kayıtlarına aktarır. Öğrenci açık oturumunda veya sonraki girişinde alır; kendi giriş yapması gerekmez.
4. Ağ/izin hatası olan öğrenciler açıkça listelenir. Sonuçları yeniden okumaya gerek yoktur: **Bekleyen sonuçları yayınla** ile tekrar deneyin.

Desteklenen ilk düzen, sağlanan **DENEME SINAVI TOPLU SONUÇ LİSTESİ** raporlarının TYT ve birleşik TYT+AYT biçimidir. Her sayfada sütun sırası, D/Y, ders neti ve toplam net denetlenir. Taranmış resim PDF’leri/OCR ve farklı yayınevi düzenleri otomatik yorumlanmaz; açık hata verilir. PDF sınırları: dosya başına 15 MB / 100 sayfa, seçim başına 10 dosya. Ayrıştırma tarayıcıda yapılır; PDF’ler bir işleme sunucusuna yüklenmez. PDF.js 5.6.205 uyumluluk modülü ilk kullanımda jsDelivr üzerinden yüklenir.

Birleşik raporun TYT tekrarları, başka tarihe sahip olsalar bile aynı sınav adı ve aynı ders D/Y değerleriyle tanınır ve önizlemede seçilmez. TYT-only rapor aynı yükleme grubundaysa onun tarihi tercih edilir. Farklı tarihte gerçekten yeniden çözülmüş aynı sonuç gerekiyorsa öğretmen satırı elle seçebilir. Sınavı boş bırakan ile o oturuma katılmayan öğrenci ayırt edilir. Birleşik rapordaki YKS-SAY/EA/SÖZ puanları AYT-only puanı olarak kullanılmaz. PDF’de tamamlama süresi olmadığı için süre boş kalır; öğrenci sonradan ekler.

## Veri ve yayınlama

- `ogr[].denemeler`: öğrenci girişleri; sonuç paketi v4 ile birleştirilir. v1–v3 paketleri okunmaya devam eder. Açık eski sekmeler güncellenmelidir.
- `ogr[].denemeOkul`: öğretmenin aktardığı sonuçlar. Firestore `ogrenciler/{syncId}.denemeOkul` alanına ayrı JSON olarak yazılır. Yalnızca yuvanın yetkili öğretmeni değiştirebilir.
- `ogr[].denemeSure`: öğrencinin kendi tamamlama süreleri; öğretmen sonucunun D/Y değerlerini değiştirmez.
- Kayıtlar öğrenciye aittir; eşleşme yayınlanırken kalıcı bulut kimliğiyle tekrar denetlenir. Yuva rotasyonu öğretmen sonuçlarını taşır.
- Tam yedekler ve öğrenci dosya paketleri denemeleri içerir. JSON kopyaları ve sonuç kanalları aynı veriyi çalışma yedeğinde gereksiz yere çoğaltmaz.
- En fazla 1500 kayıt/kanal ve 3000 süre; okul deneme alanı 300 KB ile, toplam bulut yazısı mevcut 900 KB sınırıyla kontrol edilir. Eski kayıtlar sessizce atılmaz.

**Dağıtım sırası:** önce bu dalın `firestore.rules` dosyasını mevcut Firebase projesine `firebase deploy --only firestore:rules --project <mevcut-proje>` ile yayınlayın; sonra `index.html` değişikliğini siteye alın. Kurallar yayınlanmadan öğretmen aktarımı cihazda kalır ve yayınlama hatası gösterilir. Bu PR üretim verisini değiştirmez veya ekli PDF’leri otomatik olarak üretime aktarmaz.

## Geliştirme ve doğrulama

Kaynaklar `src/denemeler.js` ve `src/denemeler.css`. `node scripts/embed-denemeler.cjs` bunları tek dosyalı uygulamaya gömer; `--check` eşitliği denetler. Elle gömülü kopyayı değiştirmeyin.

- `node test/mock-exam-regression.cjs`: alan toplamları, sayısal sınırlar, sürüm uyumu, silme/birleştirme, tam öğrenci eşleşmesi, tekrarlar ve sentetik PDF koordinatları.
- `node test/mock-exam-browser.cjs` (Playwright): masaüstü/telefon formu, grafik, düzenleme, branş/AYT ayrımı, kalıcı kayıt, toplu aktarım ve yayınlama hatası/yeniden deneme.
- Mevcut Firestore emulator testleri: öğretmen/öğrenci erişimi, alan korunması, hesap ve yuva rotasyonu; gerçek iki istemciyle anlık teslim, yeni cihaz, kişisel süre ve eski cihazdan silinen sonucun geri gelmemesi.
- Sağlanan üç PDF ayrıca yerel PDF.js ve Chromium ile sınandı: 29 TYT; birleşik raporda 29 TYT + 22 AYT; hazırlık raporunda 29 TYT. Birleşik dosyadaki 29 TYT tekrarı işaretlenmedi. Gerçek öğrenci PDF’leri veya çıkartılan öğrenci verileri repoya eklenmedi.
