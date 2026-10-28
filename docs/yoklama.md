# Yoklama (rehber öğretmen)

Rehber öğretmenin **Yoklama** sayfası okulun “Yoklama Raporu” PDF’ini okur ve kimin gelmediğini, kimin geç geldiğini ayrı ayrı gösterir. Menüde Öğrenciler altında, Etüt planı ile Öğrenci raporları arasındadır. Görünüş Etütler’le aynıdır (renkler ve parçalar `src/etutler.css` içinde `#etKok`, `#dpKok`, `#epKok` ve `#ykKok` için ortaktır); günün durum renkleri `src/yoklama.css` içindedir.

## Rapor

- **PDF ekle** bir ya da birkaç raporu ekler. PDF tarayıcıda okunur, hiçbir yere gönderilmez.
- Raporda her şube yeni sayfada “205 12/C Yoklama Raporu” başlığıyla başlar; her satır bir öğrencinin bir günüdür: tarih ve “1. Ders” … “8. Ders” altında Geldi, Gelmedi, Gecikti, Mazeretli (Diğer) ya da Mazeretli (Raporlu). Öğrencinin adı satırlarının ortasındadır, uzun adlar iki satırdır; satırlar sonraki sayfaya geçer.
- **14 Eylül 2026’dan önceki günler alınmaz** (öğretim yılı o gün başlar).
- Yeni rapor, içindeki şubelerin kendi tarih aralığındaki günlerinin yerine geçer; diğer günler ve şubeler kalır. Aynı raporu yeniden eklemek bir şey değiştirmez.
- Rapor, son gününün içinde basıldıysa (alttaki tarih son günse) o gün **eksik olabilir**: grafikte soluk, takvimde kesik çizgili gösterilir, Gün bölümünde not düşülür. Sonraki rapor o günü tamamlar.
- Veri `D.yoklama` olarak defterde, öğretmenin bulut yedeğiyle durur; öğrenci paketlerine girmez. **Öğrenci raporları** devamı bu veriden hesaplar (docs/ogrenci-raporlari.md). **Yoklama verisini sil** hepsini siler. İzleyen öğretmen sayfayı görür, ekleyemez ve silemez.

## Günün durumu

Her öğrencinin her günü tek bir renk alır:

| Durum | Renk | Ne zaman |
|---|---|---|
| Geldi | griye yakın beyaz | Okula geldi. Erken çıkma ve arada ders kaçırma da Geldi sayılır. |
| Geç geldi | sarı | Bir derste “Gecikti” yazıyor ya da ilk derslere Gelmedi yazıp sonra geldi. |
| Gelmedi | kırmızı | Hiçbir derse gelmedi; mazeretsiz dersler mazeretlilerden çok. |
| Raporlu | mavi | Hiçbir derse gelmedi; mazeretli dersler mazeretsizlerden az değil, Raporlu olanlar Diğer’den az değil. |
| Diğer | yeşil | Hiçbir derse gelmedi; mazeretli dersler mazeretsizlerden az değil, çoğu Mazeretli (Diğer). |

**Gelme oranı** = (Geldi + Geç geldi) ÷ bütün günler.

**3+ ders kaçırılan** gün: en az üç dersi Gelmedi, Mazeretli ya da Raporlu olan gün (okula gelip dört dersi kaçırmak da). **Öğrenci raporları** devamsız günü aynı kuralla sayar (`YOKLAMA.kacirma`: hiç derse gelmediyse tam, geldiyse yarım gün). Gelme oranı kartının altında aralıktaki bu günlerin ve öğrencilerin sayısı, öğrenci kartında öğrencinin sayısı yazar; günün rengi yukarıdaki tablodaki durumdur.
 Hiçbir sayı işaretli (+/−) yazılmaz; renkler yalnızca durumu gösterir.

## Sayfa

- **Başlangıç / Bitiş:** iki tarih seçilir, sayfanın her bölümü bu aralığa göre değişir. **Tümü**, **Son 4 hafta**, **Son hafta** hazır aralıklardır.
- **Öğrenciler:** tüm okul, bir sınıf düzeyi (ör. 12. sınıflar) ya da bir şube.
- **Renkler:** beş durumun tanımı en üstte durur.
- **Kartlar:** gelme oranı; Gelmedi, Geç geldi, Raporlu, Diğer kaç kez ve kaç öğrencide.
- **Haftalara göre / Günlere göre:** Gelmedi, Geç geldi, Raporlu ve Diğer üst üste çubuklar (Geldi çubuğa girmez, ipucunda yazar). **Göster: Sınıf düzeyleri / Şubeler** her biri için aynı ölçekte ayrı grafik çizer; adına basınca o şube ya da sınıf düzeyi açılır. Grafik seçiliyken ←/→, Home/End ipucunu gezdirir, Esc kapatır.
- **En çok gelmeyenler** ve **En çok geç gelenler:** iki ayrı sıralama (eşitler aynı sırayı alır, sonra yaşanan öne geçer).
- **Şubeler:** sınıf düzeyleri ve şubeleri; gelme oranı, Gelmedi ve Geç geldi (kaç kez · kaç öğrenci), Raporlu, Diğer ve günlerin dağılımı.
- **Gün:** seçilen günde gelmeyenler, geç gelenler, raporlular ve diğerleri, her birinin dersleri. Gelmedi ya da Geç geldi, öğrencinin önceki en az 5 gününün en çok %3’ünde olduysa **Beklenmedik** yazar.
- **Her gün gelenler:** aralıktaki her günü Geldi olanlar.
- **Çizelge:** her öğrenci bir satır, her gün bir kare; karenin üzerinde günün dersleri yazar (ör. “1–2. ders gelmedi · 3–8. ders geldi”).
- **Tüm öğrenciler** ve **öğrenci kartı:** tabloda gelme oranı ve dört durum ayrı sütunlardır (başlığa basınca sıralanır), son on gün kare kare. Kartta sayılar, aralığın takvimi, gelmediği ve geç geldiği günlerin haftanın hangi gününe düştüğü ve tam gün gelmediği günler dersleriyle yazar. Defterdeki öğrenciyle eşleşen ad öğrenci gözüyle açılır.

## Kod ve testler

- `src/yoklama.js`, `src/yoklama.css` → `node scripts/embed-yoklama.cjs` ile `index.html` içine gömülür (`--check` yalnızca denetler).
- `test/yoklama-regression.cjs`: rapor okuma (şubeler, iki satırlı adlar, sayfa geçişleri, art arda iki öğrenci, tanınmayan ders), günün durumu, saklama ve birleştirme, 14 Eylül sınırı, bozuk veri, kayıt hatası ve bulut sınırı, model (aralık, kapsam, haftalar, şubeler, sıralamalar, Her gün gelenler, Gün ve Beklenmedik), sayfa, grafik, izleyen öğretmen ve gizlilik.
- `test/yoklama-browser.cjs`: masaüstü (açık tema) ve 390 px (koyu tema); renkler, ipucu ve klavye, Haftalık/Günlük, şube grafikleri, aralık ve kapsam, sıralamalar, öğrenci kartı, Gün, Çizelge, sıralama ve arama, telefonda yana kaymama, silme.
- Sentetik rapor `test/fixtures/yoklama-pdf.cjs` içindedir; gerçek öğrenci verisi yoktur.
