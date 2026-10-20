# Etüt planı (rehber öğretmen)

**Etüt planı** okulun kâğıttaki **“<GÜN> — ETÜT PLANI”** çizelgesidir: her hafta günü için branş, öğretmen ve her öğretmenin yanında dört öğrenci. Rehber öğretmen öğretmenleri bir kez yazar, öğrenci adlarını doldurur ve kâğıttaki gibi yazdırır. Sayfa yalnızca rehber öğretmen menüsünde, **Öğrenciler** grubunda **Etütler**’in altındadır.

## Sayfa

- **Gün:** Pazartesi – Cuma ya da **Tümü**. Sayfa bugünün gününde açılır (hafta sonu Pazartesi).
- Çizelge kâğıttaki sütunlarla görünür: **BRANŞ · ÖĞRETMEN · ÖĞRENCİ 1–4**. Aynı branşın öğretmenleri tek gri hücrenin altında toplanır; branşlar kâğıttaki sırayla dizilir (Matematik, Geometri, Türkçe, Edebiyat, Fizik, Kimya, Biyoloji, Tarih, Coğrafya, Felsefe, Din Kültürü, İngilizce), diğerleri yazıldıkları sırayla sonra gelir.
- **Düzenle: Öğrenciler.** Öğrenci hücrelerine doğrudan yazılır; liste defterdeki öğrencileri ve etüt raporundaki öğrencileri önerir, liste dışı ad da yazılabilir. Her hücre bırakılınca kaydedilir. Aynı gün iki kez yazılan öğrenci iki hücrede de kırmızı görünür.
- **Düzenle: Öğretmenler.** Her satırda branş ve öğretmen yazılır, **×** satırı siler (öğrenci adı varsa sorar). **Satır ekle** yeni satır açar; branşı boş bırakılan öğretmenin branşı plandan ya da etüt raporundan doldurulur. **Etüt raporundan ekle**, Etütler’e eklenen raporun son dört haftasında o gün etüt veren öğretmenleri ekler; **Başka günden ekle** başka günün öğretmenlerini öğrencisiz ekler. Gün zaten olan öğretmeni ikinci kez almaz. Öğrenciler görünümüne dönünce boş satırlar atılır.
- **Öğrencileri sil** görünen gün(ler)in öğrenci adlarını siler; öğretmenler kalır. Yeni haftaya böyle başlanır.
- Telefonda her öğretmen bir blok olur: branş başlığı, öğretmen adı ve iki sütunda dört öğrenci.

## Yazdırma

- **Yazdır** görünen günü (Tümü’nde öğretmeni olan her günü) yazdırır: her gün ayrı bir A4 dikey sayfa, ortada **PAZARTESİ — ETÜT PLANI** başlığı, siyah başlık satırı, gri branş hücreleri, el yazısına yetecek yükseklikte boş hücreler. Ekran teması yazıya karışmaz; kâğıt siyah beyazdır.
- Yazdırma sırasında yalnızca çizelgeler basılır; menü ve düğmeler görünmez. Uygulamanın diğer çıktılarının yatay sayfa ayarı bu çıktıyı etkilemez.

## Saklama ve gizlilik

- Plan öğretmen defterinde `D.etutPlani` alanındadır: `{surum:1, ts, gunler:[Pazartesi … Cuma: [[branş, öğretmen, [öğrenci 1 … 4]]]]}`. Satırlar yazıldıkları sırada saklanır; gruplama yalnızca görünüştedir.
- Defterle birlikte cihaza ve öğretmenin bulut yedeğine yazılır. Öğrenci paketleri alan listesiyle kurulduğu için öğrencilere gitmez.
- Her yazmada `dogrula` yapıyı denetler: beş gün, günde en çok 40 satır, satırda dört öğrenci; branş 40, ad 60 karakter. Kaydedilemeyen değişiklik geri alınır ve sayfa eski planı gösterir; okunamayan kayıtlı plan uyarıyla gösterilir ve üzerine yazılmaz. Defteri bulut yedeği sınırının üstüne çıkaracak değişiklik yapılmaz.
- İzleyici öğretmen planı görür ve yazdırır; değiştiremez.
- Depoda gerçek öğretmen ya da öğrenci adı yoktur; adları rehber öğretmen uygulamada yazar.

## Kod ve testler

- `src/etutplani.js`, `src/etutplani.css` → `node scripts/embed-etutplani.cjs` ile `index.html` içine gömülür (`--check` yalnızca denetler). Görünüş Etütler’in renk ve parçalarıdır (`src/etutler.css`, `#epKok`).
- `test/etutplani-regression.cjs`: boş plan ve gün seçimi, gruplama ve kâğıt sırası, iki kez yazılan öğrenci, etüt raporundan ve başka günden ekleme, branş doldurma, öğretmen görünümü ve boş satırlar, izleyici öğretmen, denetim ve kaydedilemeyen değişiklik, kaçış, gizlilik, menü.
- `test/etutplani-browser.cjs`: masaüstü (açık tema) ve 390 px (koyu tema); raporla doldurma, satır ekleme ve silme, gün kopyalama, öğrenci yazma, yazdırma (yalnızca çizelgeler, gün başına bir dikey sayfa), öğrencileri silme, yatay kaydırma yok.
