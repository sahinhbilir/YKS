# Etütler (rehber öğretmen)

**Etütler** sekmesi okulun **Tarih Bazlı Etüt Raporu** PDF’ini borsa grafiği gibi gösterir: etüt sayısının zaman içindeki değişimi, her dersin etütleri, etüt alan farklı öğrenci sayısı ve her öğrencinin etüt almayı artırıp azalttığı. Sekme yalnızca rehber öğretmen menüsünde, **Öğrenciler** grubunun altındadır.

## Rapor ekleme

- **PDF ekle** ile bir ya da birkaç rapor seçilir (en çok 10). PDF tarayıcıda okunur; hiçbir şey yüklenmez.
- Rapor, başlığındaki tarih aralığının (ör. `16.08.2026 / 19.10.2026 Tarihleri Arasında`) yerine geçer: bu aralıktaki eski kayıtlar silinir, raporun satırları eklenir; aralık dışındaki kayıtlar kalır. Okulun her seferinde dönem başından bugüne aldığı birikimli rapor eklendikçe veri yenilenir; aynı rapor ikinci kez eklenince satırlar değişmez.
- Her günün sayfası tarihle başlar; sonraki sayfaya taşan satırlar o günde kalır. İki satıra bölünen uzun öğretmen ve öğrenci adları birleştirilir.
- Okunamayan satır atlanır ve durum satırında sayısı yazar. Rapora benzemeyen PDF eklenmez.

## Gösterim

- **Karşılaştır: 1 / 2 / 4 hafta / Seç.** Son tam haftalar, hemen önceki aynı sayıda tam haftayla karşılaştırılır. Hafta pazartesi başlar. Rapor cuma gününden önce bitiyorsa son hafta **devam ediyor** sayılır: grafikte kesikli çizilir, karşılaştırmaya girmez. Yeterli tam hafta yoksa düğme kapalıdır.
- **Seç** herhangi iki tam haftayı karşılaştırır (borsa grafiğindeki gibi): haftalık **Tüm etütler** grafiğinde **Önceki** ve **Şimdiki** iki dikey çizgidir; tutamaklarından sürüklenen çizgi en yakın tam haftaya oturur, öbür çizginin üstüne ya da ötesine geçmez. Sürüklerken “7 Eyl → 12 Eki: 3 → 11 etüt ▲8 · %267” gibi bir okuma ve o haftanın ipucu görünür; bırakınca sayfanın tamamı (cümle, kartlar, dersler, öğretmenler, öğrenciler, sıralar) bu iki haftayı karşılaştırır. İki hafta araç çubuğundaki **Önceki** / **Şimdiki** listelerinden de seçilir (klavye, telefon ve günlük grafik için). Varsayılan son tam hafta ile dört hafta öncesidir. **Yeni**, ilk etüdü Önceki haftadan sonra olan öğrencidir.
- **Grafik: Haftalık / Günlük.** Haftalıkta etüt olmayan hafta 0’dır; günlükte yalnızca etüt olan günler gösterilir ve 5 günlük ortalama çizilir.
- **Tüm etütler:** etüt sayısı çizgisi, son tam dönemin değeri sağdaki etikette. Alttaki çubuklar etüt alan farklı öğrenci sayısıdır: bir önceki döneme göre artış yeşil, azalış kırmızı.
- **Dersler:** branşlar derse toplanır (MATEMATİK TYT + MATEMATİK AYT + Matematik → Matematik; FİZİK 1 → Fizik; Türkçe ve Türk Dili ve Edebiyatı → Türkçe; T.C. İnkılap Tarihi → Tarih). Her ders kartı son penceredeki etüt sayısını, değişimini ve haftalık küçük grafiği gösterir; karta basınca ders grafiği yalnızca o derse geçer.
- **Öğretmenler:** her öğretmen ayrı bir kartta, en çok etüt verdiği dersin renginde ve dersler sırasıyla: son penceredeki etüt sayısı, değişimi, toplamı ve haftalık küçük grafik. Öğretmen seçili değilken grafik her öğretmenin çizgisini gösterir; üzerine gelince o dönemin en çok etüt veren on öğretmeni yazar, kalanlar “+N öğretmen” olarak toplanır. Karta basınca grafik yalnızca o öğretmene geçer ve yanında öğretmenin öğrencileri (etüt sayısı ve son etüt günüyle) listelenir; listeden bir öğrenci seçilince öğrenci kartı açılır. Aynı ada sahip satırlar (büyük/küçük harf farkı olsa da) tek öğretmendir. Öğretmen seçili değilken grafiğin yanında **Sıralama** durur: öğretmenler son penceredeki etüt sayısına göre, önceki penceredeki yerlerine göre kaç sıra yükseldikleri (▲) ya da düştükleri (▼) ile; satıra basınca o öğretmen seçilir. Kartlarda da öğretmenin sırası ve değişimi yazar.
- **Farklı öğrenci sayısı:** ilk kez gelen ve tekrar gelen öğrenciler.
- **En çok değişenler** ve **Tüm öğrenciler:** öğrencinin önceki ve son penceredeki etüt sayısı ve durumu: **Artıyor**, **Azalıyor**, **Bıraktı** (son pencerede hiç yok), **Yeni** (ilk etüdü son pencerede), **Döndü** (önceki pencerede yoktu, daha önce vardı), **Aynı**, **Etüt yok**. Tablo aranır, şubeye göre süzülür ve sütun başlığıyla sıralanır. **Sıra** sütunu öğrencinin son penceredeki etüt sayısına göre yeridir (1 en çok; eşit sayılar aynı sırayı alır; o pencerede etüdü olmayanın sırası yoktur) ve önceki penceredeki yerine göre ▲ kaç sıra yükseldiğini, ▼ kaç sıra düştüğünü gösterir; öğrenci kartında da yazar.
- Seçilen öğrencinin kartı haftalık etütlerini derslere göre yığılmış çubuklarla gösterir; altında derslere ve öğretmenlere göre etüt sayıları vardır. Defterdeki bir öğrenciyle adı eşleşirse ad, o öğrencinin gözüyle açılır (docs/ogrenci-gozuyle.md).
- Grafiklerin üzerine gelince ya da grafik seçiliyken ←/→ ile o dönemin sayıları görünür. Birden çok çizgili grafiklerde (Derslere göre, Öğretmenlere göre) üzerine gelinen çizgi öne çıkar, diğerleri rengini kaybedip soluklaşır ve ipucu o çizgiyle başlar; grafik seçiliyken ↑/↓ çizgiden çizgiye geçer, tıklama ya da Enter o dersi ya da öğretmeni açar (Deneme panosundaki gibi).

## Saklama ve gizlilik

- Veri öğretmen defterinde `D.etut` alanında, sözlüklerle sıkıştırılmış olarak durur: `{surum:1, ts, kaynak:[{bas,bit,n,ts}], brans:[], ogretmen:[], ogrenci:[[ad,şube]], satir:[[gün,branş,öğretmen,öğrenci,saat,süre]]}`. Gün, uygulamanın gün numarasıdır; saat ve süre dakikadır. Derslik saklanmaz.
- Defterle birlikte cihaza ve öğretmenin bulut yedeğine yazılır. Öğrenci paketleri alan listesiyle kurulduğu için öğrencilere gitmez.
- Okuma ve yazmada `dogrula` yapıyı denetler. Okunamayan veri sayfada uyarıyla gösterilir ve üzerine yazılmaz.
- Sınırlar: en çok 15 000 etüt ve 300 KB. Defteri bulut yedeği sınırının (900 KB) üstüne çıkaracak ekleme yapılmaz. **Etüt verisini sil** bütün kayıtları kaldırır.
- **Yedekten geri getir:** Defter etüt verisi olmadan açıldıysa (başka bir cihazdan ya da etüt verisi olmayan bir bulut kopyasından), Google hesabıyla bağlı öğretmen boş Etütler sayfasından etüt kayıtlarını geri alabilir. Bulut yedek geçmişindeki günlük kopyalar yeniden eskiye taranır (en çok 30), etüt verisi okunabilen ilk kopya gösterilir ve onaylanınca yalnızca `D.etut` yazılır; defterin geri kalanı değişmez. Kopyalarda etüt verisi yoksa son rapor “PDF ekle” ile eklenir; okulun raporu dönem başından bugüne olduğu için tek PDF yeter.
- İzleyici öğretmen grafikleri görür; rapor ekleyemez ve silemez.

## Kod ve testler

- `src/etutler.js`, `src/etutler.css` → `node scripts/embed-etutler.cjs` ile `index.html` içine gömülür (`--check` yalnızca denetler).
- PDF metni Denemeler’deki `denemePdfSayfalari` (`pdfjs-dist@5.6.205`) ile okunur.
- `test/etut-regression.cjs`: rapor okuma, saklama ve birleştirme, haftalık model, durumlar, öğretmenler, sıra değişimi, Seç penceresi, çok çizgili grafikler, Etüt planı önerileri, sayfa, yedekten geri getirme, sınırlar, gizlilik.
- `test/etut-browser.cjs`: masaüstü (açık tema) ve 390 px (koyu tema); PDF ekle, grafikler, ipucu ve klavye, pencere ve dönem seçimi, ders ve öğretmen seçimi, Seç çizgilerini sürükleme ve listeler, çizgi vurgusu, öğrenci seçimi, arama, sıralama, silme, yedekten geri getirme.
- Etüt planı (docs/etut-plani.md) her hafta günü için raporun son dört haftasında o gün etüt veren öğretmenleri `ETUT.planIcin()` ile alır.
- `test/fixtures/etut-pdf.cjs`: okulun düzeninde sentetik PDF metin öğeleri; gerçek öğrenci verisi yoktur.
