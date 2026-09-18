# İTÜ tanıtım başvurusu takibi

İTÜ'nün liseler için tanıtım programı başvurusu açıldığında Telegram'dan bildirim gönderir.
5 dakikada bir GitHub Actions üzerinde çalışır; hiçbir bilgisayarın açık olması gerekmez.

## Ne izleniyor

| Hedef | Adres | Neden |
| --- | --- | --- |
| Başvuru uygulaması | `uygulama-bidb.itu.edu.tr/tanitim-ofisi/kampus-turu/` | Formun kendisi burada. Şu an tek cümle: "Kampüs turu başvuruları kapalıdır." |
| Tanıtım sayfası | `tanitim.itu.edu.tr/ituye-gel/liseler-icin-tanitim-programi` | Duyuru metni burada; başvuru uygulamasını iframe ile gösteriyor. |

Tanıtım sayfasının tamamı 79 KB ve menüsü sık değişiyor; bu yüzden yalnızca
`container subPage` içindeki içerik bloğu alınır. Başvuru uygulaması ASP.NET WebForms
olduğu için `__VIEWSTATE` alanı **her istekte** değişir. Ham HTML hash'lenseydi her
kontrolde yanlış alarm gelirdi; betik bu alanları temizledikten sonra hash alır.
`test/itu-tanitim-watch-regression.js` bunu iki farklı `__VIEWSTATE` örneğiyle doğrular.

## Açılmayı nasıl anlıyor

Tek bir işarete güvenilmiyor. Bunlardan herhangi biri olursa acil bildirim gider:

- Başvuru uygulamasında "kapalıdır" ifadesi kaybolursa
- Başvuru formunda gerçek alanlar (input / select / textarea) belirirse
- "başvurular açıldı / başlayacaktır" benzeri bir ifade çıkarsa
- Tanıtım sayfasındaki "randevu takvimimiz planlanmaktadır" cümlesi kalkarsa

Bunların dışındaki her metin değişikliği için de daha sakin bir bilgi mesajı gelir,
öncesi ve sonrasıyla birlikte. Sayfa baştan tasarlanır da içerik bloğu bulunamazsa
betik sessizce devam etmez, iş günlüğüne uyarı yazar.

## Kurulum

### 1. Telegram botu

1. Telegram'da **@BotFather**'a yazın, `/newbot` deyin, bir isim verin.
2. Size verilen **token**'ı saklayın (`123456:ABC-DEF...` biçiminde).
3. Kendi botunuza bir mesaj atın (bot, kendisine hiç yazmamış birine mesaj gönderemez).
4. Şu adresi tarayıcıda açıp `chat.id` değerini bulun:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`

### 2. Depo secret'ları

GitHub'da depo → **Settings → Secrets and variables → Actions → New repository secret**:

| Ad | Değer |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | BotFather'ın verdiği token |
| `TELEGRAM_CHAT_ID` | `getUpdates` çıktısındaki `chat.id` |

### 3. Varsayılan dala almak

**Bu adım şart:** GitHub zamanlanmış (`schedule`) akışları yalnızca varsayılan dalda
çalıştırır. Akış varsayılan dala (`main`) birleşmeden 5 dakikalık kontrol başlamaz.

### 4. Denemek

Depo → **Actions → ITU tanıtım başvuru takibi → Run workflow**. İlk çalıştırmada
"takip başladı" mesajı Telegram'a düşer; bu geldiyse kurulum tamamdır.

## Bilinmesi gerekenler

- **Gecikme:** GitHub yoğunlukta zamanlanmış işleri 5-15 dakika geciktirebilir.
  Yani "5 dakika" pratikte "çoğunlukla 5, bazen 20 dakika" demek.
- **60 gün kuralı:** GitHub, 60 gün işlem görmeyen depolarda zamanlanmış akışları
  durdurur. Betik 20 günde bir durum dosyasına zaman damgası yazıp commit atarak
  depoyu canlı tutar.
- **Sessiz arıza:** Site 6 kontrol üst üste (yaklaşık 30 dakika) açılmazsa bir kez
  uyarı mesajı gelir, düzelince de "yeniden çalışıyor" mesajı gelir.
- **Durum geçmişi:** `.watch/itu-tanitim.json` her değişiklikte commit edilir, yani
  sayfanın ne zaman ne yazdığı git geçmişinden okunabilir.
- **Kesinlik:** Bu bir tahmin sistemi değil ama garanti de değil. Başvurunun açıldığını
  haber aldığınızda sayfayı elle de açıp doğrulayın.

## Elle çalıştırmak

```sh
# Bildirim göndermeden, ne olacağını yazdırır
node tools/itu-tanitim-watch.js --dry-run

# Gerçek kontrol (secret'lar ortam değişkeni olarak gerekir)
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node tools/itu-tanitim-watch.js

# Mantık testleri
node test/itu-tanitim-watch-regression.js
```
