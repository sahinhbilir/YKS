# Grafikler: ölçme ve çizgi biçimi (Etütler, Deneme panosu)

Etütler ve Deneme panosu grafikleri iki şeyi ortak kullanır: **sürükleyerek ölçme** ve **Çizgi: Köşeli / Yumuşak**. Kod `src/grafik.js` ve `src/grafik.css` içindedir.

## Sürükleyerek ölçme

Google Finance’teki gibi, yalnızca bakmak için:

- Zaman eksenli bir grafiğe basınca en yakın noktada bir işaret (dikey çizgi ve nokta) çıkar. Sürükleyince ikinci işaret imleci izler ve en yakın noktaya oturur. İki işaretin arası hafifçe renklenir (artışta yeşil, düşüşte kırmızı, değişim yoksa gri), dışı soluklaşır.
- Grafiğin üstünde okuma durur: “14 Eyl → 12 Eki · 2 → 11 etüt ▲ +9 (+%450,0)”. Her zaman erken noktadan geç noktaya ölçülür; sürükleme yönü fark etmez. Başlangıç 0 ise yüzde yazmaz; Deneme panosunda birim **net**, Etütler’de **etüt** (Farklı öğrenci sayısı grafiğinde **öğrenci**).
- Ölçerken üzerine gelme ipucu gizlenir. Birden çok çizgili grafikte üzerine gelinmiş (öne çıkmış) çizgi ölçülür ve adı okumanın başında yazar; öne çıkmış çizgi yoksa ana çizgi: Etütler’de dönemin toplamı (“Tüm dersler”, “Tüm öğretmenler”), panoda ortalama (“TYT toplam ortalaması”, “Ortalama”).
- Aynı tarihler sayfanın bütün grafiklerinde ve küçük grafiklerinde de gölgelenir; ders ve öğretmen kartlarının küçük grafikleri o aralıktaki kendi değişimini (ör. ▲ +2) gösterir.
- Bırakınca her şey eski haline döner. Hiçbir şey seçilmez ya da kaydedilmez: Seç haftaları/denemeleri (`EK.etSecA/etSecB`, `EK.dpOnceki/dpSimdiki`) değişmez.
- 4 pikselden az kayan basış tıklamadır: çizgiye tıklayınca ders, öğretmen ya da öğrenci yine açılır. **Esc** ölçmeyi iptal eder; ardından bırakmak tıklama sayılmaz.
- Dokunmatik ekranda ölçme 300 ms basılı tutunca başlar (tutulan nokta gösterilir); tutmadan kaydırmak sayfayı kaydırır. Ölçerken sayfa kaymaz.
- Seç’in **Önceki / Şimdiki** tutamakları kendi sürüklemesini korur. Net dağılımı grafiğinin zaman ekseni olmadığı için ölçülmez.

## Çizgi: Köşeli / Yumuşak

Araç çubuğundaki **Çizgi** seçimi grafik çizgilerini köşeli (noktalar arası düz) ya da yumuşak çizer. Yumuşak çizgi aynı noktalardan geçen tekdüze (monoton) bir eğridir: noktaların üstüne ya da altına taşmaz, sayılar 0’ın altına inmez, ortadaki %50 gölgesi sırasını korur. Küçük grafikler de aynı biçimi alır. Seçim cihazda saklanır (`localStorage` `yks_grafik_cizgi`), iki sayfada ortaktır; varsayılan köşelidir.

## Kod ve testler

- `src/grafik.js`, `src/grafik.css` → `node scripts/embed-grafik.cjs` ile `index.html` içine, Etütler’in önüne gömülür (`--check` yalnızca denetler). `GRAFIK_CIZGI.yol(noktalar)` çizgiyi, `GRAFIK_OLCUM.kur({...})` bir sayfanın ölçmesini kurar: her grafik `olc` ile neyi ölçtüğünü (dönemler, değerler, birim, çizgiler) verir; küçük grafikler `data-olc-donem`, `data-olc-uzunluk`, `data-olc-v` taşır.
- `test/grafik-regression.cjs`: köşeli ve yumuşak çizgiler (noktalardan geçer, taşmaz, gölge ve dikey adım), aralık ve en yakın nokta. Sayfaların ölçme bilgileri `test/etut-regression.cjs` ve `test/denemepano-regression.cjs` içinde.
- `test/grafik-browser.cjs`: masaüstü (açık tema) ve 390 px (koyu tema, dokunmatik); okuma, iki yönde sürükleme, soluklaşma ve renk, öbür grafikler ve küçük grafikler, bırakma, Esc, kısa basışın tıklama kalması, basılı tutma ve kaydırma, Seç tutamakları, net dağılımı, hiçbir şeyin kaydedilmemesi, Köşeli / Yumuşak.
