# Deneme panosu (rehber öğretmen)

Rehber öğretmenin **Denemeler** sayfası artık bir panodur: okulun deneme sonuç listeleri borsa grafiği gibi gösterilir. Görünüş Etütler’le aynıdır (renkler ve parçalar `src/etutler.css` içinde `#etKok` ve `#dpKok` için ortaktır). Öğrencinin kendi **Denemelerim** sayfası değişmez.

## Veri nereden gelir

Pano yeni bir şey saklamaz. Denemeler ve Sıralamalar’ın zaten tuttuğu okul listelerini (`D.siralama`, docs/siralamalar.md) okur.

- **PDF’den toplu aktar** bilinen aktarımdır: önizleme, öğrenci eşleştirme, “Seçilen sonuçları kaydet ve yayınla” ve listelerin Sıralamalar’a eklenmesi aynen çalışır. Önizleme panonun içinde açılır.
- Daha önceki sınavlar, tarih düzeltme ve PDF raporları için **Sıralamalar ve raporlar** düğmesi Sıralamalar’ı açar.
- **Öğrenci bazında** eski öğrenci sayfasını açar (öğrenci seçimi, elle deneme ekleme, deneme ortalaması ve hedefi). Oradaki **← Deneme panosu** panoya döner.

## Gösterim

- **Oturum:** TYT, AYT · SAY, AYT · EA, AYT · SÖZ, AYT · Toplam. Alan neti, alanın iki testi de cevaplanmışsa sayılır (Sıralamalar’daki kural). Verisi olmayan oturum kapalıdır.
- **Karşılaştır:** son deneme ya da son 2 / son 3 denemenin ortalaması, hemen önceki aynı sayıda denemeyle. Yeterli deneme yoksa düğme kapalıdır.
  **Seç** (Sıralamalar’daki gibi) iki denemeyi elle seçtirir: **Önceki → Şimdiki** (ör. son denemeyi son genel denemeyle). Seçeneklerde tarih ve tür yazar. Kartlar, net dağılımı, sıra ve cümle şimdiki denemeye göre olur.
- **Tür:** Tümü, Genel ya da Tarama. Adında “tarama” geçen sınav taramadır, diğerleri genel denemedir. Öğretmen en alttaki deneme tablosundaki **Tür** kutusundan değiştirebilir; bu seçim tarih düzeltmesi gibi listelerden ayrı saklanır (`D.siralama.sinavlar[].tur`, yalnızca adın söylediğinden farklıysa), aynı liste yeniden eklenince kaybolmaz. İzleyen öğretmen türü yalnızca görür.
- **Öğrenciler:** bir sınıf düzeyi (ör. “12. sınıflar”, sınıflar karışmaz) ya da tek şube. Varsayılan, son denemede en çok öğrencisi olan sınıf düzeyidir. Listede şubesi hiç yazmayan öğrenci varsa “Tüm öğrenciler” de çıkar. Öğrencinin şubesi, numarasına basılmış son şubedir.
- **Ana grafik:** her deneme bir nokta; çizgi ortalama net, gölge ortadaki %50 (25. ile 75. yüzdelik arası), alttaki çubuklar katılım (önceki denemeye göre artış yeşil, azalış kırmızı). Son değer sağdaki etikettedir.
- **Dersler:** her dersin ortalama neti, değişimi ve deneme deneme küçük grafiği; karta basınca ders grafiği yalnızca o derse geçer. Tüm dersler birlikteyken başarı yüzdesi (net / soru) gösterilir.
- **Öğrenciler bölümü:** **Net** kutusu bu bölümü (öğrenci çizgileri, dağılım, değişenler, tablo) oturum toplamından tek bir dersin netine geçirir (Sıralamalar’daki ders sıralaması gibi); üstteki kartlar ve grafikler toplamda kalır. **Sırala:** Net, Net artışı, % artış (önceki net 0’dan büyükse) ya da Kapanan fark (log) = ln((tam net − önceki + 1) / (tam net − şimdiki + 1)); seçilen ölçüte göre sıra yeniden verilir (eşitler aynı sırayı alır) ve tablo o sıraya dizilir.
- **Öğrencilere göre:** her öğrenci bir çizgi (sınıf düzeyinde şube rengiyle), kesik çizgi ortalama. Üzerine gelinen çizgi öne çıkar, diğerleri rengini kaybedip soluklaşır; grafik seçiliyken ↑/↓ öğrenciden öğrenciye geçer, tıklama ya da Enter öğrenci kartını açar. **Derslere göre başarı** grafiğinde de üzerine gelinen ders öne çıkar ve ipucunda kalın yazılır.
- **Net dağılımı:** şimdiki (son) denemenin netleri aralıklara göre; çizgi önceki deneme.
- **En çok değişenler** ve **Tüm öğrenciler:** pencereler arası net değişimi. **Yükseliyor** / **Düşüyor** en az 1 net değişimdir; **Yeni** önceki pencerede girmeyen, **Girmedi** son pencerede girmeyen öğrencidir. Sıra, şimdiki denemedeki sıradır (eşitler aynı sırayı alır). Tablonun başında seçili kapsamın ve sınıf düzeyinde her şubenin ortalaması durur (Sıralamalar’daki gibi: şimdiki ortalama eksi önceki neti olanların ortalaması).
- **Öğrenci kartı:** denemelerdeki neti (ortalama ve ortadaki %50 ile), son girdiği denemede ders ders net, önceki denemesine göre değişim ve çizgiyle seçili öğrencilerin ortalaması. Defterdeki öğrenciyle (numara ve ad) eşleşen ad, öğrenci gözüyle açılır.
- Grafiklerin üzerine gelince ya da grafik seçiliyken ←/→ ile o denemenin sayıları görünür.

## Kod ve testler

- `src/denemepano.js`, `src/denemepano.css` → `node scripts/embed-denemepano.cjs` ile `index.html` içine gömülür (`--check` yalnızca denetler).
- `src/denemeler.js`: öğretmen için `gorunumDenemeler` panoyu açar (`EK.denemeKlasik` eski sayfayı gösterir). `src/siralamalar.js`: pano için `hasTYT`, `hasAYT`, `took`, `fnet`, `tytTotal`, `aytTotal`, `FCOLS`, `SIRA_DERS`, `SIRA_UST` ile deneme türü için `SINAV_TURLERI`, `addanTur`, `turDegistir` dışarı verilir.
- `test/denemepano-regression.cjs`: ortalama, ortadaki %50, katılım, sıra, pencereler, durumlar, sınıf kapsamı, AYT alanları, bütün grafikler, izleyici öğretmen, okunamayan liste, gizlilik; genel/tarama (addan, elle, yeniden eklemede korunur, doğrulama), Seç, Sırala ölçütleri ve şube ortalamaları, ders neti, öğrenci çizgileri.
- `test/denemepano-browser.cjs`: masaüstü (açık tema) ve 390 px (koyu tema); grafikler, ipucu ve klavye, oturum / karşılaştırma / öğrenciler, ders seçimi, öğrenci seçimi, arama, sıralama, öğrenci bazında sayfa ve geri dönüş; çizgi üzerine gelince öne çıkma ve soluklaşma, ↑/↓ ve Enter, çizgiye tıklama, Tür, Seç, deneme türü değiştirme, Sırala, Net.
- Sentetik listeler `test/fixtures/siralama-pdf.cjs` içindedir; gerçek öğrenci verisi yoktur.
