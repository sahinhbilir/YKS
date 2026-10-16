# Öğrenci gözüyle (rehber öğretmen)

Rehber öğretmen bir öğrencinin adına basınca, o öğrencinin uygulamada gördüğü ekran açılır: ana sayfası (haftalar haritası, deneme gelişimi), Planım, Sonuç gir, Denemelerim, Müfredat ve Ayarlar, öğrenci menüsüyle. Üstte “Öğrenci gözüyle · ad · şube · numara” şeridi ve **Kapat** vardır; Esc de kapatır.

## Nerede

Ad düğmesi (`ogrAdDugmesi`) şu yerlerde: ana sayfada bu hafta planı verilenlerin adları, Haftalık öğrenci takibi satırları, haftalık plan kartının başlığı, Denemeler ve Haftalar haritası başlıkları, Sıralamalar’daki sıralama tablosu (defterdeki öğrenciyle numara ve ad eşleşirse). Öğrenciler sayfasında ad düzenlenebilir bir kutu olduğu için yanında göz düğmesi vardır. Öğrenci kendi uygulamasında adları düz yazı olarak görür.

## Nasıl çalışır

- Öğretmen defterinden öğrencinin paketi kurulur: `ogrenciPaketi(si)` → `paketiYukle` (öğrenciye dosyayla verilen paketin aynısı; yalnızca o öğrencinin verisi). `tamBelge` bu defterle uygulamanın bağımsız bir kopyasını yazar; Firebase modülü yoktur.
- Kopya `sandbox="allow-scripts allow-modals allow-downloads"` bir çerçevede, `allow-same-origin` olmadan çalışır: kökeni yoktur, bu sayfanın depolamasına, oturumuna, bulutuna erişemez.
- Uygulamadan önce çalışan küçük bir betik (`ONIZLEME_HAZIRLIK`) `localStorage` ve `sessionStorage`’ı bellekte tutar ve `window.YKS_ONIZLEME`’yi açar (`ONIZLEME_MODU`): sunucu verisi okunmaz, “Kaydet ve çıkış yap” gösterilmez.
- Çerçevede yapılan her şey (sonuç girme, ayar değiştirme) yalnızca o çerçevenin belleğindedir; kapatınca kaybolur, öğretmen defterine ve öğrenciye gitmez.
- Gösterilen, öğretmen defterindeki bilgidir: öğrencinin cihazında olup henüz eşitlenmemiş değişiklikler görünmez.

## Testler

- `test/teacher-home-regression.cjs`: belge yalnızca o öğrencinin verisini taşır, öğrenci rolündedir, bellek betiği uygulamadan önce gelir, Firebase modülü yoktur; öğrencide adlar düz yazıdır.
- `test/student-view-browser.cjs`: 1280 ve 390 px; her sayfadan açılış, çerçevenin kendi belleği, öğretmen defterinin değişmemesi, Kapat ve Esc.
