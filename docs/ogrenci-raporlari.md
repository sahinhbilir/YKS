# Öğrenci raporları

Rehber öğretmen menüsünde **Öğrenciler → Öğrenci raporları** bölümünü açın.
Sitedeki deneme ve etüt kayıtları otomatik kullanılır. **Rapor PDF’lerini ekle** ile
deneme, tarih bazlı etüt, yoklama ve öğrenci ev ödev durum raporlarını birlikte seçin.
Sınıfı ve öğrenciyi seçip **Öğrenci PDF** veya **Sınıf / tümü PDF** düğmesine basın.
Her öğrenci A3 yatay tek sayfadır; önizleme ve indirilen PDF aynı çizimi kullanır.

## İçerik ve tarihler

- TYT ve AYT toplam net grafikleri yan yana, ders grafikleri altında yer alır.
  Kaynaktaki bütün sınav tarihleri, önceki yıllar dahil, korunur. Sınavlar tarih
  sırasıyla eşit aralıkta gösterilir. AYT toplamı kaynakta bulunan tüm AYT derslerinin
  netidir; SAY/EA/SÖZ puanı değildir. Eksik oturum sıfır sonuç olarak çizilmez.
- Öğrenci yalnızca kendi sonuçlarını görür. Sıralama, sınıf ortalaması ve öneri yoktur.
- Devam yüzdesi gün bazındadır. En az 3 dersin kaydı bulunan ve kayıtlı derslerin
  tamamında gelmeyen öğrenci tam gün yok sayılır. Diğer günlerde en az 3 ders yoksa
  yarım gün; 0–2 ders yoksa okulda sayılır. Mazeretli kayıtlar da yok kabul edilir.
  Boş hücreler yok sayılmaz. Tümü boş günler yüzdeye dahil edilmez.
  Yüzde = 100 × (okulda gün + yarım gün / 2) / durumu bilinen gün.
- Ödev çubukları her ders için tamamlanan/toplam sayısını gösterir. Desteklenen
  toplu ödev raporu görev veya teslim tarihi içermediğinden **rapor tarihi** açıkça
  ayrılır; ödev tarihi uydurulmaz. Aynı öğrenci için en yeni ödev özeti kullanılır.
- Etüt sütunları pazartesi başlayan haftalardaki kayıt sayısıdır. Altındaki ders/hafta
  çizelgesi ders dağılımını gösterir. Tarih aralığı ve hafta başlangıçları görünür.
  Etüt kaydı, katılımın ayrıca doğrulandığı anlamına gelmez.

## Kaynaklar ve saklama

PDF’ler tarayıcıda okunur; sunucuya veya öğrenci defterine yazılmaz. İçe aktarılan
raporlar sayfa yenilenince, temizlenince veya başka defter açılınca kaldırılır.
Sitedeki mevcut kayıtlar etkilenmez. Aynı dosya adı tekrar eklenirse önceki içe
aktarımın yerini alır. Aynı sınav adı/tarih/oturum tekrar sayılmaz. Etüt raporu kendi
tarih aralığındaki önceki etüt kayıtlarının yerini alır.

Öğrenci numarası ve adıyla eşleştirme yapılır; yalnızca adı bulunan yoklama/etüt
kayıtlarında ad ve sınıfın tek bir öğrenciyle eşleşmesi gerekir. Belirsiz eşleşmeler
bildirilir. Okunamayan veya net toplamı doğrulanamayan dosya eklenmez; hata diğer
dosyaların başarıyla eklenmesini engellemez.

Desteklenen deneme tabloları: 8 dersli TYT (9. sınıf), 11 dersli TYT ve 24 dersli
birleşik TYT/AYT. PDF metin içermelidir; taranmış görüntülere OCR uygulanmaz.
Her seçimde en fazla 30 kaynak dosya, her indirmede en fazla 300 öğrenci desteklenir.
PDF çizimleri yüksek çözünürlüklü görsel olarak yerleştirilir; metin araması içermez.
İlk PDF indirmesinde mevcut Sıralamalar modülünün bütünlüğü doğrulanmış PDF
kütüphaneleri yüklenir; ilk yükleme internet bağlantısı gerektirir.

## Geliştirme ve doğrulama

Kaynak: `src/ogrencirapor.js` ve `src/ogrencirapor.css`.
Değişikliklerden sonra `node scripts/embed-ogrencirapor.cjs` çalıştırın.

```
node scripts/embed-ogrencirapor.cjs --check
node test/ogrencirapor-regression.cjs
node test/ogrencirapor-browser.cjs
```

Tarayıcı testi Verify iş akışındaki Playwright ve sabit sürümlü PDF bağımlılıklarını
`NODE_PATH` üzerinden kullanır. Masaüstü ve telefonda içe aktarma, hatadan sonra
yeniden indirme, öğrenci/sınıf/tüm öğrenciler PDF sayfa sayısı, filtreleme, temizleme
ve rol sınırını kontrol eder. Test verileri sentetiktir; gerçek öğrenci belgeleri
depoya eklenmemelidir.
