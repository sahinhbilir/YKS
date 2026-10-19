# Etütler (rehber öğretmen)

**Etütler** sekmesi okulun **Tarih Bazlı Etüt Raporu** PDF’ini borsa grafiği gibi gösterir: etüt sayısının zaman içindeki değişimi, her dersin etütleri, etüt alan farklı öğrenci sayısı ve her öğrencinin etüt almayı artırıp azalttığı. Sekme yalnızca rehber öğretmen menüsünde, **Öğrenciler** grubunun altındadır.

## Rapor ekleme

- **PDF ekle** ile bir ya da birkaç rapor seçilir (en çok 10). PDF tarayıcıda okunur; hiçbir şey yüklenmez.
- Rapor, başlığındaki tarih aralığının (ör. `16.08.2026 / 19.10.2026 Tarihleri Arasında`) yerine geçer: bu aralıktaki eski kayıtlar silinir, raporun satırları eklenir; aralık dışındaki kayıtlar kalır. Okulun her seferinde dönem başından bugüne aldığı birikimli rapor eklendikçe veri yenilenir; aynı rapor ikinci kez eklenince satırlar değişmez.
- Her günün sayfası tarihle başlar; sonraki sayfaya taşan satırlar o günde kalır. İki satıra bölünen uzun öğretmen ve öğrenci adları birleştirilir.
- Okunamayan satır atlanır ve durum satırında sayısı yazar. Rapora benzemeyen PDF eklenmez.

## Gösterim

- **Karşılaştır: 1 / 2 / 4 hafta.** Son tam haftalar, hemen önceki aynı sayıda tam haftayla karşılaştırılır. Hafta pazartesi başlar. Rapor cuma gününden önce bitiyorsa son hafta **devam ediyor** sayılır: grafikte kesikli çizilir, karşılaştırmaya girmez. Yeterli tam hafta yoksa düğme kapalıdır.
- **Grafik: Haftalık / Günlük.** Haftalıkta etüt olmayan hafta 0’dır; günlükte yalnızca etüt olan günler gösterilir ve 5 günlük ortalama çizilir.
- **Tüm etütler:** etüt sayısı çizgisi, son tam dönemin değeri sağdaki etikette. Alttaki çubuklar etüt alan farklı öğrenci sayısıdır: bir önceki döneme göre artış yeşil, azalış kırmızı.
- **Dersler:** branşlar derse toplanır (MATEMATİK TYT + MATEMATİK AYT + Matematik → Matematik; FİZİK 1 → Fizik; Türkçe ve Türk Dili ve Edebiyatı → Türkçe; T.C. İnkılap Tarihi → Tarih). Her ders kartı son penceredeki etüt sayısını, değişimini ve haftalık küçük grafiği gösterir; karta basınca ders grafiği yalnızca o derse geçer.
- **Farklı öğrenci sayısı:** ilk kez gelen ve tekrar gelen öğrenciler.
- **En çok değişenler** ve **Tüm öğrenciler:** öğrencinin önceki ve son penceredeki etüt sayısı ve durumu: **Artıyor**, **Azalıyor**, **Bıraktı** (son pencerede hiç yok), **Yeni** (ilk etüdü son pencerede), **Döndü** (önceki pencerede yoktu, daha önce vardı), **Aynı**, **Etüt yok**. Tablo aranır, şubeye göre süzülür ve sütun başlığıyla sıralanır.
- Seçilen öğrencinin kartı haftalık etütlerini derslere göre yığılmış çubuklarla gösterir. Defterdeki bir öğrenciyle adı eşleşirse ad, o öğrencinin gözüyle açılır (docs/ogrenci-gozuyle.md).
- Grafiklerin üzerine gelince ya da grafik seçiliyken ←/→ ile o dönemin sayıları görünür.

## Saklama ve gizlilik

- Veri öğretmen defterinde `D.etut` alanında, sözlüklerle sıkıştırılmış olarak durur: `{surum:1, ts, kaynak:[{bas,bit,n,ts}], brans:[], ogretmen:[], ogrenci:[[ad,şube]], satir:[[gün,branş,öğretmen,öğrenci,saat,süre]]}`. Gün, uygulamanın gün numarasıdır; saat ve süre dakikadır. Derslik saklanmaz.
- Defterle birlikte cihaza ve öğretmenin bulut yedeğine yazılır. Öğrenci paketleri alan listesiyle kurulduğu için öğrencilere gitmez.
- Okuma ve yazmada `dogrula` yapıyı denetler. Okunamayan veri sayfada uyarıyla gösterilir ve üzerine yazılmaz.
- Sınırlar: en çok 15 000 etüt ve 300 KB. Defteri bulut yedeği sınırının (900 KB) üstüne çıkaracak ekleme yapılmaz. **Etüt verisini sil** bütün kayıtları kaldırır.
- İzleyici öğretmen grafikleri görür; rapor ekleyemez ve silemez.

## Kod ve testler

- `src/etutler.js`, `src/etutler.css` → `node scripts/embed-etutler.cjs` ile `index.html` içine gömülür (`--check` yalnızca denetler).
- PDF metni Denemeler’deki `denemePdfSayfalari` (`pdfjs-dist@5.6.205`) ile okunur.
- `test/etut-regression.cjs`: rapor okuma, saklama ve birleştirme, haftalık model, durumlar, sayfa, sınırlar, gizlilik.
- `test/etut-browser.cjs`: masaüstü (açık tema) ve 390 px (koyu tema); PDF ekle, grafikler, ipucu ve klavye, pencere ve dönem seçimi, ders seçimi, öğrenci seçimi, arama, sıralama, silme.
- `test/fixtures/etut-pdf.cjs`: okulun düzeninde sentetik PDF metin öğeleri; gerçek öğrenci verisi yoktur.
