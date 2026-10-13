# Sıralamalar (rehber öğretmen)

**Sıralamalar** sekmesi okulun toplu sonuç listelerini iki sınav arasında karşılaştırır. Liste okulun kendi düzeninde yeniden çizilir ve her netin yanına önceki sınava göre değişim kutusu eklenir: artış yeşil, düşüş kırmızı, değişim büyüdükçe renk koyulaşır. `0.00` değişmedi, `N/A` karşılaştırılacak sonuç yok demektir (ör. öğrenci önceki sınava girmedi). Sekme yalnızca rehber öğretmen menüsündedir.

## Listeler nereden gelir

- **Denemeler → PDF’den toplu aktar:** “Seçilen sonuçları kaydet ve yayınla”ya basıldığında okunan PDF’lerin tam okul listesi Sıralamalar’a da eklenir. Öğrenci satırı seçilmese de liste eklenir; durum satırı bunu yazar. Liste eklenemezse öğrenci aktarımı yine yapılır.
- **Sıralamalar → PDF ekle:** daha önceki sınavlar için. Bu yol öğrencilere sonuç yayınlamaz.

İki liste türü okunur: **Net Sayısı Sıralı** (TYT) ve **Öğrenci Adı Sıralı** (TYT + AYT). Aynı sınavın (aynı sınav adı) listeleri birleşir. Aynı listenin yeniden eklenmesi öğrenci numarasına göre satırları yeniler; listede olmayan öğrenciler kalır, böylece şube listeleri okul listesine eklenebilir. TYT raporu varsa Net Sayısı Sıralı listeyi, yoksa Öğrenci Adı Sıralı listenin TYT bölümünü kullanır; AYT raporu Öğrenci Adı Sıralı listeyi ister.

## Raporlar

Önceki ve şimdiki sınav seçilir (önceki, şimdikinden hemen önceki sınavdır). Her rapor **Önizle** ile sayfada görülür, **PDF indir** ile kaydedilir; **Hepsini tek PDF’te indir** dört raporu tek dosyada verir.

| Rapor | İçerik | Dosya |
| --- | --- | --- |
| TYT · Toplu | Tüm öğrenciler, toplam nete göre; Kurum ortalamaları | `<sınav>_Toplu.pdf` |
| TYT · Sınıf | Her şube ayrı sayfada; Kurum ve Şube ortalamaları | `<sınav>_Sınıf.pdf` |
| AYT · Toplu | Tüm AYT öğrencileri, AYT toplamına göre; Toplam’dan sonra SAY, EA, SÖZ netleri | `<sınav>_AYT_Toplu.pdf` |
| AYT · Sınıf | Her şube ayrı sayfada, seçilen nete göre | `<sınav>_AYT_Sınıf.pdf` |

Kurallar:

- Öğrenci kutusu: şimdiki net − önceki net. Kurum kutusu: iki listedeki basılı Kurum ortalamalarının farkı. Şube kutusu: şubenin şimdiki ortalaması − aynı öğrencilerin önceki ortalaması.
- Değişimler yarım yukarı yuvarlanır; basılı ortalamalar okulun listesindeki gibi yuvarlanır.
- AYT testleri (TDE-SB1, SB2, MAT, FEN) iki sınavda da cevaplanmışsa (D + Y > 0) karşılaştırılır; aksi hâlde o testin dersleri `N/A`.
- SAY = MAT + FEN, EA = TDE-SB1 + MAT, SÖZ = TDE-SB1 + SB2. Alan neti, iki test de şimdiki sınavda cevaplanmışsa yazılır. **Alan kutusu, alanın ders kutularının toplamıdır** (`N/A` olanlar katılmaz). Kurum ve Şube alan değerleri de basılı ders değerlerinin toplamıdır.
- AYT · Sınıf’ta her şubenin sıralaması seçilebilir (SAY net, EA net, SÖZ net, AYT toplam). Varsayılan, şubede en çok öğrencinin girdiği alandır. Seçim deftere kaydedilir.

## Saklama ve gizlilik

- Listeler öğretmen defterinde `D.siralama` alanında, sıkıştırılmış olarak durur: `{surum:1, sinavlar:[{id, ad, okul, ts, T, F}], tercih:{şube: alan}}`. `T` Net Sayısı Sıralı, `F` Öğrenci Adı Sıralı listedir: `{tarih, katilim:[toplam,kampüs,kurum], kurum:{n,dy,p}, ogr:[{no, ad, snf, n, dy, p, r}]}`; `n` netler, `dy` D/Y yazıları, `p` dört puan, `r` dört sıralama yazısıdır. Dizi sırası `T` için 11 TYT dersi, `F` için 11 TYT + 13 AYT dersidir.
- Defterle birlikte cihaza ve öğretmenin bulut yedeğine yazılır; çıkışta cihazdan silinir, Google ile yeniden girişte buluttan gelir. Öğrenci paketleri alan listesiyle kurulduğu için öğrencilere gitmez.
- Okuma ve yazmada `dogrula` yapıyı denetler. Okunamayan (bozuk ya da daha yeni sürümün yazdığı) veri sayfada uyarıyla gösterilir ve üzerine yazılmaz; defterin geri kalanı etkilenmez.
- Sınırlar: en çok 40 sınav ve 350 KB. Defteri bulut yedeği sınırının (900 KB) üstüne çıkaracak ekleme yapılmaz; eski sınavlar **Sil** ile kaldırılır. Silmek öğrencilerin deneme sonuçlarını değiştirmez.
- PDF’ler tarayıcıda okunur ve raporlar tarayıcıda çizilir; hiçbir şey yüklenmez.

## Kütüphaneler

Raporlar ilk kez çizilirken jsDelivr’dan sabit sürümler yüklenir: `pdf-lib@1.17.1` ve `@pdf-lib/fontkit@1.1.1` (SRI ile), Roboto Regular/Medium (`roboto-fontface@0.10.0`, SHA-256 denetimiyle). Önizleme ve PDF okuma Denemeler’deki `pdfjs-dist@5.6.205` ile yapılır.

## Kod ve testler

- `src/siralamalar.js`, `src/siralamalar.css` → `node scripts/embed-siralamalar.cjs` ile `index.html` içine gömülür (`--check` yalnızca denetler).
- `src/denemeler.js`: `denemePdfSayfalari` sayfa yüksekliğini ve yazı boyutunu da verir; `denemePdfOku` listeyi `rapor.siralama` olarak ekler.
- `test/siralama-regression.cjs`: liste okuma, birleştirme, kutular, alan toplamları, sınırlar, gizlilik.
- `test/siralama-browser.cjs`: masaüstü ve 390 px; içe aktarma, PDF ekle, dört rapor, önizleme, şube sıralaması, silme. Kütüphaneler `NODE_PATH` üzerindeki npm kopyalarından verilir.
- `test/fixtures/siralama-pdf.cjs`: okul düzeninde sentetik PDF metin öğeleri; gerçek öğrenci verisi yoktur.
