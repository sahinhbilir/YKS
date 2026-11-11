# Tasarım denetimi: koyu tema ve gösterge şeritleri

Öğretmenin kuralı: **“Görselleştirileni okumak için kılavuz gerekiyorsa iyi iş çıkarmamışız demektir.”** Açık tema olduğu gibi kaldı; baskı, rapor SVG’leri ve PDF çıktısına, hiçbir hesaba dokunulmadı.

## İlkeler

1. Tek bir ana gösterge, görünür biçimde daha büyük.
2. 3–5 başlık göstergesi.
3. Sade dil: kısaltma ve jargon yok, etiket okunur boyutta.
4. Her göstergenin bir bağlamı (kıyas ya da eğilim) aynı kutuda.
5. Tekrar eden ya da örtüşen sayı yok.
6. Boşluk grupları ayırır, tek sayıyı şişirmez.
7. Tutarlı kart ızgarası, 8 px tabanlı aralık ölçeği.
8. Yüksek veri/mürekkep oranı: süs çerçevesi ve simge yok.
9. Trafik ışığı renkleri yalnız gerçek uyarıda.
10. Yanıltıcı 0 yerine “veri yok”.
11. Koyu tema (Material): koyu gri taban (#121212 civarı), yükseklik daha açık yüzeyle gösterilir (gölgeyle değil), vurgu soluk, geniş yüzeyde parlak renk yok, metin WCAG AA.

Kaynaklar: [Material koyu tema](https://m2.material.io/design/color/dark-theme), [Material Android tema](https://material.io/develop/android/theming/dark), [Au Fait UX](https://www.aufaitux.com/blog/good-dashboard-design/), [Setproduct](https://www.setproduct.com/blog/effective-dashboard-design-principles), [Geckoboard](https://www.geckoboard.com/uploads/geckoboard-dashboard-design-and-build-a-great-dashboard.pdf).

## Koyu tema: yeşil filtrenin kaldırılması

Yüzeyler ve çizgiler artık tonsuz gridir (R, G, B farkı ≤ 3). Teal yalnız birincil eylemde, seçili durumda, ana grafik serisinde ve odak halkasında kalır. `--vurgu-yumusak` ve `--marka-acik` (çip, seçili, rozet) nötr yüksek gridir; metin ya da çerçeve vurgudur. KPI sayıları `--murekkep` ile yazılır. Belirteçler `src/report-theme.css` içinde `prefers-color-scheme:dark` ve `[data-theme="dark"]` altında birebir aynıdır; `test/dark-theme-contrast.cjs` bunu, tonsuzluğu ve AA oranlarını denetler.

| Belirteç | Eski | Yeni |
|---|---|---|
| `--zemin` | #101e20 | #111213 |
| `--kagit` | #1a2d30 | #1a1b1d |
| `--kagit-yuksek` (açılır menü, pencere, ipucu) | yok | #222326 |
| `--cizgi` | #344c4b | #2c2e31 |
| `--murekkep` / `--soluk` | #e8f1ed / #afc3bd | #ececec / #a5a7aa |
| `--vurgu` | #76cfb9 | #72b9ab |
| `--vurgu-yumusak`, `--marka-acik` | #213f3b | #27282b |
| `--iyi` / `--uyari` / `--kritik` | #76cfb9 / #ebbb70 / #f1a18e | #84bf8f / #d9b36c / #e0907f |
| ızgara / eksen / soluk seri | #304744 / #76938a / #607e75 | #2a2c2f / #808285 / #5f6063 |

## Sin → yer → düzeltme

| Sin | Yer | Düzeltme |
|---|---|---|
| Yedi eşit ağırlıklı kutu, 4 + 3 eşitsiz ızgara | Deneme panosu şeridi | Bir ana (iki kat büyük) + üç yardımcı kutu, tek satır; 390 px’te ana tam genişlik, yardımcılar 2 sütun, tek kalan tam genişlik |
| Geniş kutuda tek sayı, ölü boşluk | aynı | Kutu içeriği: etiket, sayı, bağlam; 8 px ölçek; dar kutular içerikle sınırlı |
| Soluk `.mini` jargon etiketler (“Katılımcı ortalaması · tüm dönem”, “Sırası yükselen”) | aynı | .875 rem düz etiketler: “Aynı öğrencilerin net değişimi”, “Ortalama”, “Ortadaki yarı”, “Katılım”; ekran teması `.mini` altyazıları gizlediği için bağlam artık görünür metindir |
| Kıyassız çıplak sayı (En yüksek net, Yükselen öğrenci, Katılım) | aynı | Her kutuda kıyas: ilk/önceki denemeye göre ▲▼, medyan + başlangıç aralığı, önceki katılım |
| Örtüşen ölçüler (katılımcı ort. değişimi ↔ aynı öğrenciler; yükselen öğrenci ↔ sırası yükselen) | aynı | Ana kutu aynı öğrencilerin değişimi; yükselen/düşen sayısı onun altına katlandı; “Sırası yükselen” ve “En yüksek net” kutudan çıktı (tabloda ▲▼ ve Net sırası) |
| Sıfır / çizgi yerine veri yokluğu | şerit, öğrenci panosu | “veri yok” |
| Her KPI sayısı vurgu renginde | tüm `.et-ozet-kart`, `.kutu .sayi`, `.dn-detay-bas` | `--murekkep`; trend rengi yalnız ▲▼ çipinde |
| Çok sayıda dolu teal blok (seçili segmentler) | koyu tema, Deneme panosu üst şeridi | Seçili segment nötr yüksek gri + vurgu yazı/çerçeve (`--secili-*`); dolu vurgu yalnız birincil düğmede |
| Teal yüzey ve çizgiler | tüm koyu ekranlar | Nötr gri belirteçler; açılır yüzeyler `--kagit-yuksek` |
| Aynı öğrencinin sınavı iki ayrı, birbirinden kopuk ekranda (eski “Öğrenci bazında”) | Denemeler | Eski sayfa silindi; öğrencinin kendi panosu sınıf panosundan, Öğrenci kartından ve Kademeler’den açılır |
| Öğrenci panosunda beş eşit çıplak kutu | Denemelerim / öğretmenin öğrenci panosu | Ana “Son net” (önceki denemeye göre fark renksiz; renk öğrencinin kendi olağan aralığına göre, bkz. docs/mock-exams.md) + Ortalama, En yüksek (son denemeye göre, oksuz), İlk denemeden değişim; tek denemede “veri yok” |
| Tekrar eden ölü CSS | `report-theme.css`, `denemeler.css` | `.dn-stats` kişisel kuralları kaldırıldı |

Denetlenen ve değişiklik gerektirmeyen ekranlar (1280 ve 390, açık ve koyu): öğretmen ana sayfası, Öğrenci kartı, Etüt etkisi, Yoklama, Konu takibi, Yanlışlar defteri, Kademeler (mavi ölçek ve kontrast denetimleri aynen geçer), Üniversite hedefi, Günlük raporlar, öğrenci planı. Bunlardaki KPI sayıları ortak `.et-ozet-kart`/`.kutu` kuralıyla artık yazı renginde, yüzeyleri nötr gridir. Kademeler’in mavi ölçeği ve Yoklama’nın durum renkleri bilinçli olarak korunmuştur.

Açık sorular: Üniversite hedefi ve Konu takibi sayfalarının kendi dönüşüm/ısı renkleri durum renkleri sayıldığı için değiştirilmedi.
