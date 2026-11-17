#!/usr/bin/env python3
"""Builds data/hafiza-haritasi-tam.json: the full draft map (Geometri, Matematik TYT, Matematik AYT, Fizik) from the
reviewed pilot plus every remaining plan topic. Checks that names match the app's SAY plan topics, that links form no
cycle, that every id exists and that exam shares do not exceed a row. A draft for review; the app still uses the pilot.
Usage: python3 scripts/hafiza-haritasi-tam.py"""
import json, re, sys
from collections import defaultdict

pilot = json.load(open('data/hafiza-haritasi-pilot.json', encoding='utf8'))
html = open('index.html', encoding='utf8').read()
i = html.index('const KATALOG = '); KATALOG = json.loads(html[i + 16:html.index(';\n', i)])
KISA = ['Edebiyat', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Tarih', 'İnkılap', 'Coğrafya', 'Felsefe', 'Din Kültürü']

# ---- topics (id, plan name) per course; pilot ids are kept ----
DERS = {
 'Geometri': [('geoAci','Temel Kavramlar ve Düzlemde Açılar'),('geoUcgenAci','Üçgende Açılar'),('geoEslik','Üçgende Eşlik'),('geoBenzer','Üçgende Benzerlik'),
   ('geoDik','Dik Üçgen'),('geoIkiz','İkizkenar Üçgen'),('geoEskenar','Eşkenar Üçgen'),('geoAciortay','Üçgende Açıortay'),('geoKenarortay','Üçgende Kenarortay'),
   ('geoAciKenar','Üçgende Açı-Kenar Bağıntıları'),('geoAlan','Üçgende Alan'),('geoCokgen','Çokgenler'),('geoDortgen','Dörtgenler'),('geoYamuk','Yamuk'),
   ('geoParalel','Paralelkenar'),('geoEskDortgen','Eşkenar Dörtgen'),('geoDeltoid','Deltoid'),('geoDikdortgen','Dikdörtgen'),('geoKare','Kare'),
   ('geoNokta','Noktanın Analitiği'),('geoDogru','Doğrunun Analitiği'),('geoDonusum','Dönüşüm Geometrisi'),('geoCember','Çemberde Temel Elemanlar'),
   ('geoCemberAci','Çemberde Açı'),('geoCemberUzunluk','Çemberde Uzunluk'),('geoDaire','Dairenin Çevresi ve Alanı'),('geoKati','Katı Cisimler'),('geoCemberAnalitik','Çemberin Analitiği')],
 'Matematik TYT': [('tytTemel','Temel Kavramlar, Tek-Çift ve Negatif-Pozitif Sayılar'),('tytAsal','Asal Sayılar, Ardışık Sayılar, Faktöriyel'),('tytBasamak','Basamak Kavramı, Asal Çarpanlara Ayırma'),
   ('tytBolme','Bölme ve Bölünebilme'),('tytEbob','EBOB-EKOK ve Periyodik Tekrar Eden Durumların Problemleri'),('tytRasyonel','Rasyonel Sayılar'),('tytDenklem','Birinci Dereceden Denklemler'),
   ('tytEsitsizlik','Basit Eşitsizlikler'),('tytMutlak','Mutlak Değer'),('tytCarpan','Çarpanlara Ayırma'),('tytUslu','Üslü İfadeler'),('tytKok','Köklü İfadeler'),('tytOran','Oran-Orantı'),
   ('tytSayiP','Sayı Problemleri'),('tytKesirP','Kesir Problemleri'),('tytYasP','Yaş Problemleri'),('tytYuzdeP','Yüzde Problemleri'),('tytKarP','Kâr-Zarar Problemleri'),
   ('tytKarisimP','Karışım Problemleri'),('tytHareketP','Hareket Problemleri'),('tytIsciP','İşçi Problemleri'),('tytGrafikP','Grafik Problemleri'),('tytPolinom','Polinomlar'),
   ('tytVeri','Veri Analizi'),('tytMantik','Mantık'),('tytKume','Kümeler'),('tytPerm','Permütasyon'),('tytKomb','Kombinasyon'),('tytBinom','Binom Açılımı'),('tytOlasilik','Olasılık')],
 'Matematik AYT': [('aytFonk','Fonksiyon Kavramı - Tanım ve Görüntü Kümesi'),('aytFonkCesit','Fonksiyon Çeşitleri'),('aytFonkIslem','Fonksiyonlarda İşlemler'),('aytParcali','Parçalı ve Mutlak Değer Fonksiyonu'),
   ('aytGrafik','Grafik Yorumlama'),('aytTers','Bir Fonksiyonun Tersi'),('aytBileske','Bileşke Fonksiyon ve Özellikleri'),('aytBileskeTers','Bileşke ve Ters Fonksiyon'),('aytPeriyodik','Periyodik Fonksiyon'),
   ('aytArtanAzalan','Artan - Azalan Fonksiyon'),('aytOrtDegisim','Ortalama Değişim Hızı'),('aytFonkDonusum','Dönüşüm - Ötelenme - Simetri'),('aytUstel','Üstel Fonksiyon ve Tersi'),
   ('aytLog','Logaritma Fonksiyonu ve Grafiği'),('aytLogOzellik','Logaritma Fonksiyonunun Özellikleri'),('aytUstelLogDenklem','Üstel-Logaritmik Denklem ve Eşitsizlikler'),
   ('aytUstelLogProblem','Gerçek Hayat Durumları İle İlgili Üstel ve Logaritmik Fonksiyon Problemleri'),('aytDiziFonk','Dizi ve Fonksiyon Kavramı Arasındaki İlişki'),
   ('aytDiziTerim','Genel Terimi ve İndirgenme Bağıntısı Verilen Bir Dizinin Terimleri'),('aytAritmetik','Aritmetik Dizi'),('aytGeometrik','Geometrik Dizi'),
   ('aytDiskriminant','Diskriminant Kavramı ve Denklemlerin Kökleri'),('aytKarmasik','Karmaşık Sayılar'),('aytKokKatsayi','Kök-Katsayı Bağıntıları'),('aytTepe','Tepe Noktası ve Simetri Ekseni'),
   ('aytEnBuyuk','En Büyük - En Küçük Değer'),('aytParabolDenklem','Parabol Denklemini Yazma'),('aytParabolDogru','Parabol ve Doğrunun Birbirlerine Göre Durumları'),
   ('aytIkinciEsitsizlik','İkinci Dereceden Bir Bilinmeyenli Eşitsizlikler'),('aytEsitsizlikSistem','Eşitsizlik Sistemleri'),('aytAciOlcu','Açı Ölçü Birimleri'),('aytEsas','Esas Ölçü'),
   ('aytBirim','Birim Çemberde Trigonometrik Oranlar'),('aytOzdeslik','Trigonometrik Özdeşlikler'),('aytIsaret','Sıralama ve İşaret İncelemesi'),('aytDonusum','Trigonometrik Dönüşümler'),
   ('aytPeriyot','Periyot ve Grafik'),('aytTersTrig','Ters Trigonometrik Fonksiyonlar'),('aytSinCos','Sinüs ve Cosinüs Teoremi'),('aytToplamFark','Toplam-Fark ve Yarım Açı'),
   ('aytDenklem','Trigonometrik Denklemler'),('aytLimitSagSol','Bir Fonksiyonun Sağdan ve Soldan Limit Kavramı'),('aytLimitOzellik','Limitin Özellikleri ve Uygulamaları'),
   ('aytLimitParcali','Parçalı Fonksiyonların Limiti'),('aytBelirsizlik','Belirsizlik Durumu'),('aytLimitUyg','Limit Uygulamaları'),('aytSureklilik','Süreklilik Kavramı'),
   ('aytAnlik','Anlık Değişim Hızı - Ortalama Değişim Hızı'),('aytTurevSagSol','Soldan ve Sağdan Türev'),('aytTurevKural','Türev Alma Kuralları'),('aytBileskeTurev','Bileşke Fonksiyonun Türevi'),
   ('aytZincir','Zincir Kuralı'),('aytIkinciTurev','İkinci Mertebeden Türev ve Türevin Limit Uygulamaları'),('aytTurevGeo','Birinci Türevin Geometrik Yorumu'),
   ('aytArtanAzalanTurev','Artan ve Azalan Fonksiyonlar'),('aytEkstremum','Yerel Ekstremum Noktaları'),('aytPolinomGrafik','Polinom Fonksiyonlarının Grafikleri'),('aytMaxMin','Maksimum - Minimum Problemleri'),
   ('aytBelirsizInt','Belirsiz İntegral ve İntegral Alma Kuralları'),('aytDegiskenDegistirme','Değişken Değiştirme Metodu'),('aytRiemann','Riemann Toplamı'),('aytBelirliInt','Belirli İntegral ve Özellikleri'),
   ('aytIntAlan','Belirli İntegral ve Alan Hesabı')],
 'Fizik': [('fizGiris','Fizik Bilimine Giriş'),('fizMadde','Madde ve Özellikleri'),('fizBasinc','Basınç'),('fizVektor','Vektörler ve Kuvvet'),('fizTork','Tork ve Tork Dengesi'),
   ('fizKesisen','Kesişen Kuvvetlerin Dengesi'),('fizKutleMerkezi','Kütle ve Ağırlık Merkezi'),('fizBasitMakine','Basit Makineler'),('fizKaldirma','Kaldırma Kuvveti'),('fizIsi','Isı ve Sıcaklık'),
   ('fizAydinlanma','Aydınlanma'),('fizGolge','Tam ve Yarı Gölge'),('fizYansima','Yansıma'),('fizKuresel','Küresel Aynalar'),('fizCembersel','Çembersel Hareket'),('fizBHH','Basit Harmonik Hareket'),
   ('fizDalgaMek','Dalga Mekaniği (su dalgalarında kırınım ve girişim)'),('fizKirilma','Kırılma'),('fizPrizma','Prizmalar'),('fizRenk','Renk'),('fizMercek','Mercekler'),
   ('fizDalgaTemel','Dalgalar (dalgaların temel özellikleri ve yay dalgaları)'),('fizIsikTeori','Işık Teorileri'),('fizEMDalga','Elektromanyetik Dalgalar'),('fizBagil','Bağıl Hareket'),
   ('fizNewton',"Newton'un Hareket Yasaları"),('fizDalgaSu','Dalgalar (su dalgaları, ses dalgaları ve deprem dalgaları)'),('fizElektrostatik','Elektrostatik'),('fizAkim','Elektrik Akımı'),
   ('fizUretec','Üreteçler'),('fizElGuc','Elektriksel Enerji ve Güç'),('fizLamba','Lambalar'),('fizAtom','Atom Modelleri'),('fizBuyukPatlama','Büyük Patlama ve Evrenin Oluşumu'),
   ('fizRadyo','Radyoaktivite'),('fizModern','Modern Fizik'),('fizElKuvvet','Elektriksel Kuvvet'),('fizElAlan','Elektrik Alan'),('fizPotansiyel','Elektrik Potansiyel Enerjisi ve Elektrik Potansiyeli'),
   ('fizDuzgunAlan','Düzgün Elektrik Alan'),('fizSigac','Sığaçlar'),('fizAtis','Atışlar'),('fizIs','İş-Güç-Enerji'),('fizMiknatis','Mıknatıslar'),('fizManyetikAlan','Manyetik Alan'),
   ('fizManyetikKuvvet','Manyetik Kuvvet'),('fizIndukleme','Elektromanyetik İndüklenme'),('fizAC','Alternatif Akım'),('fizTrafo','Transformatör'),('fizMomentum','İtme ve Momentum'),
   ('fizGoruntu','Görüntüleme Teknikleri'),('fizYariIletken','Yarı İletken Teknolojisi'),('fizNano','Nanoteknoloji'),('fizLazer','Lazer')],
}
GIZLI = [p for p in pilot['konular'] if p.get('gizli')]

# ---- new links (alt → ust, use level, reason); pilot links are kept as reviewed ----
Y = [
 # Geometri: triangles
 ('geoUcgenAci','geoEslik','cok','Eşlik koşulları açı-kenar eşitliğiyle kurulur.'),('geoEslik','geoBenzer','cok','Eşlik, benzerlik oranının 1 olduğu hâldir.'),
 ('geoUcgenAci','geoBenzer','cok','Açı-açı benzerliği.'),('geoUcgenAci','geoIkiz','cok','Taban açıları eşit.'),('geoEslik','geoIkiz','az','Yüksekliğin ayırdığı eş üçgenler.'),
 ('geoIkiz','geoEskenar','tam','Eşkenar üçgen özel bir ikizkenar üçgendir.'),('pPisagor','geoEskenar','cok','Yükseklik a√3/2.'),
 ('geoUcgenAci','geoAciortay','cok','Açıortay açıyı ikiye böler.'),('geoBenzer','geoAciortay','cok','Açıortay teoremi oranla kurulur.'),
 ('geoBenzer','geoKenarortay','cok','Kenarortaylar ve ağırlık merkezi oranları.'),('pPisagor','geoKenarortay','az','Kenarortay uzunluk bağıntısı.'),
 ('geoBenzer','geoAlan','az','Benzer üçgenlerde alanlar oranı.'),
 # Geometri: polygons and quadrilaterals
 ('geoUcgenAci','geoCokgen','cok','İç açılar toplamı üçgenlere bölerek bulunur.'),('geoCokgen','geoDortgen','cok','Dörtgen, dört kenarlı çokgendir.'),
 ('geoAlan','geoDortgen','cok','Dörtgen alanları üçgen alanlarından.'),('geoDortgen','geoYamuk','cok','Yamuk özel bir dörtgendir.'),('geoAlan','geoYamuk','cok','Yamukta alan.'),
 ('geoBenzer','geoYamuk','az','Köşegenlerin ayırdığı benzer üçgenler.'),('geoDortgen','geoParalel','cok','Paralelkenar özel bir dörtgendir.'),('geoAlan','geoParalel','cok','Paralelkenarda alan.'),
 ('geoParalel','geoEskDortgen','tam','Eşkenar dörtgen özel bir paralelkenardır.'),('pPisagor','geoEskDortgen','cok','Köşegenler dik kesişir.'),
 ('geoParalel','geoDikdortgen','tam','Dikdörtgen özel bir paralelkenardır.'),('pPisagor','geoDikdortgen','az','Köşegen uzunluğu.'),
 ('geoDikdortgen','geoKare','tam','Kare özel bir dikdörtgendir.'),('geoEskDortgen','geoKare','cok','Kare aynı zamanda eşkenar dörtgendir.'),('pPisagor','geoKare','az','Köşegen a√2.'),
 ('geoDortgen','geoDeltoid','cok','Deltoid özel bir dörtgendir.'),('geoIkiz','geoDeltoid','cok','Deltoid iki ikizkenar üçgenden oluşur.'),
 # Geometri: circle, solids, analytic
 ('geoCember','geoCemberAci','cok','Merkez ve çevre açılar çemberin elemanlarıyla.'),('geoUcgenAci','geoCemberAci','cok','Çevre açı, üçgende açılarla.'),
 ('geoCember','geoCemberUzunluk','cok','Kiriş, teğet ve kesen uzunlukları.'),('geoBenzer','geoCemberUzunluk','cok','Kuvvet bağıntıları benzerlikten gelir.'),('pPisagor','geoCemberUzunluk','cok','Teğet uzunluğu Pisagor ile.'),
 ('geoCember','geoDaire','cok','Çevre ve alan yarıçapla.'),('geoCemberAci','geoDaire','az','Daire diliminde merkez açı.'),
 ('geoDaire','geoKati','cok','Silindir, koni ve küre daireyle kurulur.'),('pPisagor','geoKati','cok','Cisim köşegeni, koninin ana doğrusu.'),('geoAlan','geoKati','az','Taban alanları.'),('geoDortgen','geoKati','az','Prizmaların yüzleri.'),
 ('geoNokta','geoDonusum','cok','Öteleme, yansıma ve dönme koordinatlarla yapılır.'),('geoDogru','geoDonusum','az','Bir doğruya göre simetri.'),
 ('geoDogru','geoCemberAnalitik','cok','Teğet ve kesen doğrular.'),('geoCember','geoCemberAnalitik','cok','Merkez ve yarıçap.'),('pPisagor','geoCemberAnalitik','cok','Çember denklemi uzaklıktan gelir.'),
 # Matematik TYT
 ('tytTemel','tytAsal','cok','Sayı türleri.'),('tytTemel','tytBasamak','cok','Rakam ve sayı kavramı.'),('tytAsal','tytBasamak','cok','Asal çarpanlara ayırma asallarla.'),
 ('tytBasamak','tytBolme','cok','Bölünebilme kuralları basamaklarla.'),('tytAsal','tytBolme','cok','Asal bölenler.'),('tytBolme','tytEbob','tam','EBOB-EKOK bölünebilme üzerine kurulur.'),
 ('tytAsal','tytEbob','cok','Asal çarpanlarla EBOB-EKOK.'),('tytTemel','tytRasyonel','cok','Sayı kümeleri.'),('tytEbob','tytRasyonel','az','Payda eşitleme EKOK ile.'),
 ('tytRasyonel','tytDenklem','cok','Kesirli katsayılar.'),('tytTemel','tytDenklem','cok','İşlem önceliği, işaretler.'),('tytDenklem','tytEsitsizlik','tam','Eşitsizlik denklem çözümünün devamıdır.'),
 ('tytEsitsizlik','tytMutlak','cok','Mutlak değerli eşitsizlikler.'),('tytTemel','tytMutlak','cok','Sayının işareti.'),('tytTemel','tytUslu','cok','Negatif tabanlar, tek-çift kuvvetler.'),
 ('tytUslu','tytKok','tam','Kök, rasyonel üstür.'),('tytUslu','tytCarpan','az','Kuvvetli ifadelerde ortak çarpan.'),('tytDenklem','tytCarpan','az','Çarpanlara ayırarak denklem çözme.'),
 ('tytCarpan','tytPolinom','cok','Polinomlarda çarpanlara ayırma.'),('tytUslu','tytPolinom','az','Derece kavramı.'),('tytRasyonel','tytOran','cok','Oran bir kesirdir.'),
 ('tytDenklem','tytSayiP','tam','Sayı problemleri denklem kurmaktır.'),('tytDenklem','tytKesirP','tam','Denklem kurma.'),('tytRasyonel','tytKesirP','cok','Kesirlerle işlem.'),
 ('tytDenklem','tytYasP','tam','Denklem kurma.'),('tytOran','tytYuzdeP','cok','Yüzde, 100 tabanlı orandır.'),('tytDenklem','tytYuzdeP','cok','Denklem kurma.'),
 ('tytYuzdeP','tytKarP','tam','Kâr-zarar yüzde problemidir.'),('tytYuzdeP','tytKarisimP','cok','Karışım oranı yüzdeyle.'),('tytOran','tytKarisimP','cok','Oranla karıştırma.'),
 ('tytOran','tytHareketP','cok','Hız = yol / zaman.'),('tytDenklem','tytHareketP','cok','Denklem kurma.'),('tytOran','tytIsciP','cok','İş hızı oranı.'),('tytRasyonel','tytIsciP','cok','1/a + 1/b biçimi.'),
 ('tytOran','tytGrafikP','cok','Grafikten oran okuma.'),('tytHareketP','tytGrafikP','az','Konum-zaman grafikleri.'),('tytYuzdeP','tytVeri','az','Yüzdelik dağılımlar.'),('tytRasyonel','tytVeri','az','Ortalama hesabı.'),
 ('tytKume','tytMantik','az','Önermeler ve kümeler.'),('tytAsal','tytPerm','cok','Faktöriyel.'),('tytPerm','tytKomb','tam','Kombinasyon permütasyondan türetilir.'),
 ('tytKomb','tytBinom','cok','Binom katsayıları kombinasyondur.'),('tytKomb','tytOlasilik','cok','Örnek uzayı sayma.'),('tytPerm','tytOlasilik','cok','Sıralı sayma.'),
 ('tytKume','tytOlasilik','az','Olay = kümedir.'),('tytRasyonel','tytOlasilik','az','Olasılık bir kesirdir.'),
 # Matematik TYT → Geometri
 ('tytDenklem','geoAlan','az','Alan problemlerinde denklem kurma.'),
 # Matematik AYT: functions
 ('tytKume','aytFonk','cok','Fonksiyon, kümeler arasında bir bağıntıdır.'),('aytFonk','aytFonkCesit','tam','Fonksiyon çeşitleri tanımdan ayrılır.'),('aytFonk','aytFonkIslem','cok','Tanım ve görüntü kümeleri.'),
 ('aytFonk','aytParcali','cok','Parçalı tanım.'),('tytMutlak','aytParcali','cok','Mutlak değer fonksiyonu.'),('aytFonk','aytGrafik','cok','Grafik fonksiyonun gösterimidir.'),
 ('aytFonkCesit','aytTers','cok','Birebir ve örten fonksiyon tersinirdir.'),('aytFonkIslem','aytBileske','cok','Bileşke bir işlemdir.'),('aytFonk','aytBileske','cok','Tanım kümesi uyumu.'),
 ('aytBileske','aytBileskeTers','tam','Bileşke ve ters birlikte.'),('aytTers','aytBileskeTers','tam','Bileşke ve ters birlikte.'),
 ('aytGrafik','aytArtanAzalan','cok','Grafikten artanlık okuma.'),('aytFonk','aytArtanAzalan','cok','Tanım.'),('aytGrafik','aytOrtDegisim','cok','Eğimle değişim hızı.'),('tytOran','aytOrtDegisim','az','Değişim oranı.'),
 ('aytGrafik','aytFonkDonusum','cok','Grafiği öteleme ve yansıtma.'),('aytFonk','aytFonkDonusum','cok','f(x−a), −f(x) gösterimi.'),
 # exponential, logarithm
 ('tytUslu','aytUstel','tam','Üstel fonksiyon üslü ifade üzerine kurulur.'),('aytFonk','aytUstel','cok','Fonksiyon kavramı.'),('aytTers','aytLog','cok','Logaritma üstelin tersidir.'),
 ('aytUstel','aytLog','tam','Logaritma üstel fonksiyondan tanımlanır.'),('aytLog','aytLogOzellik','tam','Özellikler tanımdan çıkar.'),('tytUslu','aytLogOzellik','cok','Üs kurallarının karşılığı.'),
 ('aytLogOzellik','aytUstelLogDenklem','cok','Denklemde logaritma kuralları.'),('aytUstel','aytUstelLogDenklem','cok','Üstel denklemler.'),('tytEsitsizlik','aytUstelLogDenklem','az','Eşitsizlik çözümü.'),
 ('aytUstelLogDenklem','aytUstelLogProblem','cok','Problemler denklem kurmaktır.'),('tytYuzdeP','aytUstelLogProblem','az','Faiz ve büyüme yüzdeyle.'),
 # sequences
 ('aytFonk','aytDiziFonk','cok','Dizi, doğal sayılarda tanımlı fonksiyondur.'),('aytDiziFonk','aytDiziTerim','cok','Genel terim.'),('aytDiziTerim','aytAritmetik','cok','Ortak fark.'),
 ('aytDiziTerim','aytGeometrik','cok','Ortak çarpan.'),('tytUslu','aytGeometrik','cok','Genel terim üslüdür.'),('tytDenklem','aytAritmetik','az','Terimlerden denklem kurma.'),
 # quadratics
 ('tytCarpan','aytDiskriminant','cok','Çarpanlara ayırarak kök bulma.'),('tytDenklem','aytDiskriminant','cok','Denklem çözme.'),('tytKok','aytDiskriminant','cok','Kökler köklü ifadedir.'),
 ('tytPolinom','aytDiskriminant','az','İkinci dereceden polinom.'),('aytDiskriminant','aytKarmasik','cok','Δ<0 iken karmaşık kökler.'),('tytKok','aytKarmasik','az','i = √−1.'),
 ('aytDiskriminant','aytKokKatsayi','cok','Köklerin toplamı ve çarpımı.'),('tytPolinom','aytKokKatsayi','az','Katsayılar.'),('aytDiskriminant','aytTepe','cok','Tepe noktası −b/2a.'),('aytFonk','aytTepe','az','İkinci dereceden fonksiyon.'),
 ('aytTepe','aytEnBuyuk','tam','En büyük/küçük değer tepe noktasındadır.'),('aytTepe','aytParabolDenklem','cok','Tepe noktasından denklem.'),('aytKokKatsayi','aytParabolDenklem','cok','Köklerden denklem.'),
 ('aytDiskriminant','aytParabolDogru','cok','Kesişim, ortak denklemin diskriminantıdır.'),('aytParabolDenklem','aytParabolDogru','az','Parabolün denklemi.'),('geoDogru','aytParabolDogru','az','Doğru denklemi.'),
 ('tytEsitsizlik','aytIkinciEsitsizlik','cok','Eşitsizlik kuralları.'),('aytDiskriminant','aytIkinciEsitsizlik','cok','Kökler ve işaret tablosu.'),('aytIkinciEsitsizlik','aytEsitsizlikSistem','tam','Sistem, eşitsizliklerin ortak çözümüdür.'),
 # limit
 ('aytFonk','aytLimitSagSol','cok','Fonksiyon değerlerine yaklaşma.'),('aytGrafik','aytLimitSagSol','cok','Grafikten limit okuma.'),('aytLimitSagSol','aytLimitOzellik','tam','Özellikler limit tanımı üzerine.'),
 ('aytLimitSagSol','aytLimitParcali','cok','Sağdan-soldan limit.'),('aytParcali','aytLimitParcali','cok','Parçalı fonksiyon.'),('aytLimitOzellik','aytBelirsizlik','cok','Limit kuralları.'),
 ('tytCarpan','aytBelirsizlik','cok','0/0 belirsizliğinde sadeleştirme.'),('tytKok','aytBelirsizlik','az','Eşlenikle çarpma.'),('aytLimitOzellik','aytLimitUyg','cok','Limit kuralları.'),
 ('aytBelirsizlik','aytLimitUyg','cok','Belirsizlik giderme.'),('aytBirim','aytLimitUyg','az','Trigonometrik limitler.'),('aytLimitSagSol','aytSureklilik','cok','Süreklilik limitle tanımlanır.'),('aytParcali','aytSureklilik','az','Parçalı fonksiyonda süreklilik.'),
 # derivative
 ('aytOrtDegisim','aytAnlik','cok','Anlık hız ortalama hızın limitidir.'),('aytLimitOzellik','aytAnlik','cok','Türev bir limittir.'),('aytAnlik','aytTurevSagSol','cok','Türev tanımı.'),
 ('aytLimitParcali','aytTurevSagSol','cok','Sağdan-soldan limit.'),('aytSureklilik','aytTurevSagSol','az','Türevlenebilirlik ve süreklilik.'),('aytAnlik','aytTurevKural','cok','Kurallar tanımdan çıkar.'),
 ('tytUslu','aytTurevKural','az','xⁿ türevi.'),('aytOzdeslik','aytTurevKural','az','Trigonometrik türevler.'),('aytLogOzellik','aytTurevKural','az','Logaritmik türev.'),
 ('aytTurevKural','aytBileskeTurev','cok','Türev kuralları.'),('aytBileske','aytBileskeTurev','cok','Bileşke fonksiyon.'),('aytBileskeTurev','aytZincir','tam','Zincir kuralı bileşkenin türevidir.'),
 ('aytTurevKural','aytIkinciTurev','cok','Türevin türevi.'),('aytBelirsizlik','aytIkinciTurev','az','L’Hospital ile limit.'),('aytTurevKural','aytTurevGeo','cok','Türev eğimdir.'),('geoDogru','aytTurevGeo','cok','Teğet doğrusunun denklemi.'),
 ('aytTurevKural','aytArtanAzalanTurev','cok','Türevin işareti.'),('aytArtanAzalan','aytArtanAzalanTurev','cok','Artan-azalan kavramı.'),('aytIkinciEsitsizlik','aytArtanAzalanTurev','az','İşaret tablosu.'),
 ('aytArtanAzalanTurev','aytEkstremum','cok','İşaret değişimi ekstremumdur.'),('aytIkinciTurev','aytEkstremum','az','İkinci türev testi.'),('aytEkstremum','aytPolinomGrafik','cok','Ekstremumlarla grafik çizme.'),
 ('aytArtanAzalanTurev','aytPolinomGrafik','cok','Artan-azalan aralıklar.'),('aytEkstremum','aytMaxMin','cok','Maksimum-minimum problemleri ekstremumdur.'),('aytEnBuyuk','aytMaxMin','az','Parabolde en büyük değer.'),('geoAlan','aytMaxMin','az','Alan en büyükleme.'),
 # integral
 ('aytTurevKural','aytBelirsizInt','tam','İntegral türevin tersidir.'),('aytBelirsizInt','aytDegiskenDegistirme','cok','İntegral kuralları.'),('aytZincir','aytDegiskenDegistirme','cok','Değişken değiştirme zincir kuralının tersidir.'),
 ('aytAritmetik','aytRiemann','az','Toplam sembolü.'),('aytLimitOzellik','aytRiemann','az','Toplamın limiti.'),('geoAlan','aytRiemann','az','Dikdörtgenlerle alan.'),
 ('aytBelirsizInt','aytBelirliInt','cok','Belirli integral ters türevle hesaplanır.'),('aytRiemann','aytBelirliInt','cok','Tanım Riemann toplamıdır.'),('aytDegiskenDegistirme','aytBelirliInt','cok','Sınırlı değişken değiştirme.'),
 ('aytBelirliInt','aytIntAlan','tam','Alan belirli integraldir.'),('aytPolinomGrafik','aytIntAlan','az','Eğrinin konumu.'),
 # Fizik
 ('fizGiris','fizMadde','az','Nicelikler ve birimler.'),('tytOran','fizMadde','cok','Özkütle oranı.'),('fizMadde','fizBasinc','cok','Özkütle.'),('fizBasinc','fizKaldirma','cok','Kaldırma kuvveti basınç farkıdır.'),
 ('fizMadde','fizKaldirma','cok','Özkütle.'),('fizMadde','fizIsi','az','Maddenin halleri.'),('fizVektor','fizTork','az','Kuvvet vektörü.'),('fizTork','fizKutleMerkezi','cok','Tork dengesiyle ağırlık merkezi.'),
 ('fizTork','fizBasitMakine','cok','Kaldıraç tork dengesidir.'),('fizKesisen','fizBasitMakine','az','Makaralarda kuvvet dengesi.'),
 ('fizAydinlanma','fizGolge','cok','Işığın doğrusal yayılması.'),('fizYansima','fizKuresel','tam','Küresel aynada yansıma.'),('geoBenzer','fizKuresel','cok','Görüntü boyu oranı benzerlikle.'),
 ('fizYansima','fizKirilma','az','Sınır yüzeyinde ışık.'),('fizKirilma','fizPrizma','cok','Prizmada kırılma.'),('fizKirilma','fizMercek','cok','Mercekte kırılma.'),('geoBenzer','fizMercek','cok','Görüntü boyu oranı.'),
 ('fizPrizma','fizRenk','cok','Beyaz ışığın ayrışması.'),('fizKirilma','fizRenk','az','Renklere göre kırılma.'),
 ('fizDalgaTemel','fizDalgaSu','cok','Dalga kavramları.'),('fizDalgaTemel','fizDalgaMek','cok','Dalga kavramları.'),('fizDalgaSu','fizDalgaMek','cok','Su dalgalarında kırınım ve girişim.'),
 ('pOranlar','fizDalgaMek','az','Girişimde d·sin θ.'),('fizDalgaMek','fizIsikTeori','cok','Girişim ışığın dalga modelini destekler.'),('fizRenk','fizIsikTeori','az','Renk ve dalga boyu.'),
 ('fizIsikTeori','fizEMDalga','cok','Işık elektromanyetik dalgadır.'),('fizDalgaTemel','fizEMDalga','cok','Dalga kavramları.'),
 ('fizNewton','fizIs','az','Kuvvet ve hareket.'),('fizNewton','fizMomentum','cok','İtme = kuvvet × zaman.'),('fizIs','fizMomentum','az','Çarpışmada enerji.'),('fizNewton','fizCembersel','cok','Merkezcil kuvvet.'),
 ('fizVektor','fizCembersel','az','Hız vektörünün yön değiştirmesi.'),('fizCembersel','fizBHH','cok','Referans çember.'),('fizIs','fizBHH','az','Enerji korunumu.'),
 ('fizElektrostatik','fizElKuvvet','cok','Yükler arası kuvvet.'),('fizElKuvvet','fizElAlan','tam','Elektrik alan birim yüke etki eden kuvvettir.'),('fizVektor','fizElAlan','cok','Alanlar vektörel toplanır.'),
 ('fizElAlan','fizPotansiyel','cok','Potansiyel alanla ilişkilidir.'),('fizIs','fizPotansiyel','cok','Potansiyel enerji iştir.'),('fizElAlan','fizDuzgunAlan','cok','Paralel levhalarda alan.'),
 ('fizPotansiyel','fizDuzgunAlan','cok','Potansiyel farkı.'),('fizAtis','fizDuzgunAlan','az','Yüklü parçacığın sapması atış gibidir.'),('fizDuzgunAlan','fizSigac','cok','Sığaç paralel levhadır.'),
 ('fizElektrostatik','fizAkim','az','Yük ve akım.'),('fizAkim','fizUretec','cok','Devrede akım.'),('fizAkim','fizElGuc','cok','Güç = akım × gerilim.'),('fizIs','fizElGuc','az','Enerji ve güç.'),
 ('fizAkim','fizLamba','cok','Devre çözümleri.'),('fizElGuc','fizLamba','cok','Lambanın parlaklığı güçtür.'),
 ('fizMiknatis','fizManyetikAlan','cok','Manyetik alan çizgileri.'),('fizAkim','fizManyetikAlan','cok','Akımın oluşturduğu alan.'),('fizManyetikAlan','fizManyetikKuvvet','cok','Alan içinde kuvvet.'),
 ('fizVektor','fizManyetikKuvvet','az','Sağ el kuralı, vektörel yön.'),('fizCembersel','fizManyetikKuvvet','az','Yüklü parçacığın çembersel hareketi.'),('fizManyetikAlan','fizIndukleme','cok','Akı değişimi.'),
 ('fizManyetikKuvvet','fizIndukleme','az','Hareketli iletkende kuvvet.'),('fizIndukleme','fizAC','cok','Alternatif akım indüksiyonla üretilir.'),('aytPeriyot','fizAC','az','Sinüsel gerilim.'),
 ('fizAC','fizTrafo','cok','Transformatör alternatif akımla çalışır.'),('fizIndukleme','fizTrafo','cok','Karşılıklı indüksiyon.'),
 ('fizAtom','fizRadyo','cok','Çekirdek yapısı.'),('fizAtom','fizModern','cok','Atom modelleri.'),('fizIsikTeori','fizModern','cok','Fotoelektrik ışığın tanecik modelidir.'),
 ('fizEMDalga','fizModern','cok','Işığın enerjisi.'),('fizBuyukPatlama','fizAtom','az','Temel parçacıklar.'),('fizModern','fizGoruntu','az','Görüntüleme fiziği.'),('fizModern','fizYariIletken','az','Enerji bantları.'),
 ('fizAkim','fizYariIletken','az','Diyot ve transistörde akım.'),('fizModern','fizLazer','cok','Uyarılmış ışıma.'),('fizIsikTeori','fizLazer','az','Işığın doğası.'),('fizModern','fizNano','az','Nano ölçekte fizik.'),
]

# ---- exam rows: pilot rows are replaced where new topics share them ----
def yillar(*v, bas=2018): return {str(bas + i): n for i, n in enumerate(v)}
S = []
def satir(sinav, ders, konu, y, paylar): S.append({'sinav': sinav, 'ders': ders, 'konu': konu, 'yillar': y, 'paylar': paylar})
# TYT Matematik (school table 2018–2025)
satir('TYT','Matematik','Problemler',yillar(11,12,13,13,13,10,11,12),{'tytSayiP':.18,'tytKesirP':.1,'tytYasP':.1,'tytYuzdeP':.12,'tytKarP':.12,'tytKarisimP':.08,'tytHareketP':.12,'tytIsciP':.08,'tytGrafikP':.1})
satir('TYT','Matematik','Temel Kavramlar',yillar(4,1,1,3,3,2,1,3),{'tytTemel':.5,'tytAsal':.5})
satir('TYT','Matematik','Sayı Basamakları',yillar(1,2,1,2,1,1,2,1),{'tytBasamak':1})
satir('TYT','Matematik','Bölünebilme Kuralları',yillar(0,0,0,1,1,1,1,1),{'tytBolme':1})
satir('TYT','Matematik','OBEB-OKEK',yillar(0,0,2,0,0,0,1,0),{'tytEbob':1})
satir('TYT','Matematik','Rasyonel Sayılar',yillar(1,0,3,3,1,2,2,1),{'tytRasyonel':1})
satir('TYT','Matematik','Basit Eşitsizlikler',yillar(1,1,1,1,1,3,0,1),{'tytEsitsizlik':1})
satir('TYT','Matematik','Mutlak Değer',yillar(1,1,1,1,1,1,2,1),{'tytMutlak':1})
satir('TYT','Matematik','Üslü İfadeler',yillar(2,0,0,1,1,1,1,1),{'tytUslu':1})
satir('TYT','Matematik','Kümeler- Kartezyen Çarpım',yillar(2,2,1,1,1,1,1,1),{'tytKume':1})
satir('TYT','Matematik','Mantık',yillar(0,0,0,0,1,1,1,1),{'tytMantik':1})
satir('TYT','Matematik','Fonksiyonlar',yillar(1,2,2,1,1,1,1,1),{'aytFonk':.6,'aytFonkIslem':.2,'aytGrafik':.2})
satir('TYT','Matematik','Polinomlar',yillar(1,1,0,0,0,0,0,0),{'tytPolinom':1})
satir('TYT','Matematik','Permütasyon-Kombinasyon',yillar(1,1,2,0,0,1,3,1),{'tytPerm':.5,'tytKomb':.5})
satir('TYT','Matematik','Olasılık',yillar(2,1,1,1,1,1,1,1),{'tytOlasilik':1})
satir('TYT','Matematik','İstatistik',yillar(0,0,1,0,1,1,1,1),{'tytVeri':1})
# TYT Geometri
satir('TYT','Geometri','Açılar ve Üçgenler',yillar(3,1,2,4,4,5,5,4),{'geoAci':.1,'geoUcgenAci':.15,'geoEslik':.05,'geoBenzer':.12,'geoDik':.15,'geoIkiz':.08,'geoEskenar':.05,'geoAciortay':.07,'geoKenarortay':.07,'geoAciKenar':.04,'geoAlan':.12})
satir('TYT','Geometri','Çokgenler',yillar(1,1,1,1,1,1,1,1),{'geoCokgen':1})
satir('TYT','Geometri','Yamuk',yillar(1,0,2,0,0,1,1,1),{'geoYamuk':1})
satir('TYT','Geometri','Eşkenar Dörtgen',yillar(0,0,0,1,1,0,0,0),{'geoEskDortgen':1})
satir('TYT','Geometri','Kare',yillar(1,1,1,0,0,0,0,1),{'geoKare':1})
satir('TYT','Geometri','Dikdörtgen',yillar(2,2,2,1,1,1,1,1),{'geoDikdortgen':1})
satir('TYT','Geometri','Çember-Daire',yillar(1,2,0,0,0,0,0,0),{'geoCember':.25,'geoCemberAci':.3,'geoCemberUzunluk':.2,'geoDaire':.25})
satir('TYT','Geometri','Katı Cisimler',yillar(1,2,2,2,2,2,2,2),{'geoKati':1})
# TYT Fizik
satir('TYT','Fizik','Fizik Bilimine Giriş',yillar(1,0,1,0,0,0,0,0),{'fizGiris':1})
satir('TYT','Fizik','Madde ve Özellikleri',yillar(0,1,0,1,1,1,1,1),{'fizMadde':1})
satir('TYT','Fizik','Isı, Sıcaklık ve Genleşme',yillar(1,1,0,1,1,1,1,1),{'fizIsi':1})
satir('TYT','Fizik','Elektrostatik',yillar(1,0,0,0,1,0,0,1),{'fizElektrostatik':1})
satir('TYT','Fizik','Elektrik ve Manyetizma',yillar(0,1,1,1,0,2,2,0),{'fizAkim':.4,'fizUretec':.1,'fizElGuc':.15,'fizLamba':.15,'fizMiknatis':.2})
satir('TYT','Fizik','Basınç',yillar(0,0,1,1,1,0,0,0),{'fizBasinc':1})
satir('TYT','Fizik','Kaldırma Kuvveti',yillar(1,0,1,0,0,0,1,1),{'fizKaldirma':1})
satir('TYT','Fizik','Dalgalar',yillar(0,0,1,1,1,0,1,1),{'fizDalgaTemel':.5,'fizDalgaSu':.5})
satir('TYT','Fizik','Optik',yillar(2,2,1,1,1,2,1,1),{'fizAydinlanma':.1,'fizGolge':.1,'fizYansima':.2,'fizKuresel':.15,'fizKirilma':.2,'fizMercek':.15,'fizPrizma':.05,'fizRenk':.05})
# AYT Matematik (kitapsec.com, 2018–2025)
satir('AYT','Matematik','Temel Kavramlar',yillar(1,2,2,3,2,4,2,3),{'tytTemel':1})
satir('AYT','Matematik','Sayı Basamakları',yillar(0,0,3,0,0,0,1,0),{'tytBasamak':1})
satir('AYT','Matematik','Bölme ve Bölünebilme',yillar(0,1,0,0,0,1,0,0),{'tytBolme':1})
satir('AYT','Matematik','EBOB – EKOK',yillar(0,0,0,1,1,0,0,0),{'tytEbob':1})
satir('AYT','Matematik','Basit Eşitsizlikler',yillar(0,1,1,1,0,1,1,0),{'tytEsitsizlik':1})
satir('AYT','Matematik','Mutlak Değer',yillar(0,1,1,0,0,1,0,0),{'tytMutlak':1})
satir('AYT','Matematik','Üslü Sayılar',yillar(0,0,1,1,0,1,0,0),{'tytUslu':1})
satir('AYT','Matematik','Kümeler ve Kartezyen Çarpım',yillar(0,1,2,1,1,1,1,1),{'tytKume':1})
satir('AYT','Matematik','Mantık',yillar(4,1,0,1,1,1,1,1),{'tytMantik':1})
satir('AYT','Matematik','Fonksiyonlar',yillar(2,2,2,2,2,2,2,2),{'aytFonk':.15,'aytFonkCesit':.1,'aytFonkIslem':.1,'aytParcali':.1,'aytGrafik':.15,'aytTers':.1,'aytBileske':.1,'aytBileskeTers':.05,'aytPeriyodik':.03,'aytArtanAzalan':.05,'aytOrtDegisim':.03,'aytFonkDonusum':.04})
satir('AYT','Matematik','Polinomlar',yillar(1,2,2,1,1,2,0,0),{'tytPolinom':1})
satir('AYT','Matematik','2.Dereceden Denklemler ve Eşitsizlikler',yillar(1,0,1,1,2,2,1,1),{'aytDiskriminant':.4,'aytKokKatsayi':.3,'aytIkinciEsitsizlik':.2,'aytEsitsizlikSistem':.1})
satir('AYT','Matematik','Parabol',yillar(1,1,1,1,0,1,1,0),{'aytTepe':.3,'aytEnBuyuk':.2,'aytParabolDenklem':.3,'aytParabolDogru':.2})
satir('AYT','Matematik','Permütasyon-Kombinasyon-Olasılık – Binom',yillar(2,2,3,2,3,3,3,3),{'tytPerm':.25,'tytKomb':.3,'tytBinom':.15,'tytOlasilik':.3})
satir('AYT','Matematik','Karmaşık Sayılar',yillar(1,1,2,0,0,0,0,0),{'aytKarmasik':1})
satir('AYT','Matematik','Logaritma',yillar(2,3,3,1,2,3,1,2),{'aytUstel':.15,'aytLog':.2,'aytLogOzellik':.3,'aytUstelLogDenklem':.25,'aytUstelLogProblem':.1})
satir('AYT','Matematik','Diziler',yillar(1,1,2,1,1,2,1,2),{'aytDiziFonk':.1,'aytDiziTerim':.2,'aytAritmetik':.35,'aytGeometrik':.35})
satir('AYT','Matematik','Limit',yillar(2,2,0,2,2,0,2,1),{'aytLimitSagSol':.2,'aytLimitOzellik':.2,'aytLimitParcali':.15,'aytBelirsizlik':.2,'aytLimitUyg':.15,'aytSureklilik':.1})
satir('AYT','Matematik','Türev',yillar(4,4,0,3,4,0,3,5),{'aytAnlik':.05,'aytTurevSagSol':.05,'aytTurevKural':.15,'aytBileskeTurev':.05,'aytZincir':.1,'aytIkinciTurev':.05,'aytTurevGeo':.15,'aytArtanAzalanTurev':.1,'aytEkstremum':.1,'aytPolinomGrafik':.1,'aytMaxMin':.1})
satir('AYT','Matematik','İntegral',yillar(4,4,0,4,4,0,5,3),{'aytBelirsizInt':.25,'aytDegiskenDegistirme':.15,'aytRiemann':.1,'aytBelirliInt':.25,'aytIntAlan':.25})
# AYT Geometri
satir('AYT','Geometri','Özel Üçgenler',yillar(2,0,2,0,0,0,0,0),{'geoDik':.4,'geoIkiz':.3,'geoEskenar':.3})
satir('AYT','Geometri','Açıortay – Kenarortay',yillar(0,0,0,0,0,0,0,0),{'geoAciortay':.5,'geoKenarortay':.5})
satir('AYT','Geometri','Çokgenler',yillar(1,2,1,0,0,0,0,0),{'geoCokgen':1})
satir('AYT','Geometri','Özel Dörtgenler',yillar(1,0,0,0,0,1,0,0),{'geoDortgen':.2,'geoYamuk':.2,'geoParalel':.2,'geoEskDortgen':.1,'geoDeltoid':.1,'geoDikdortgen':.1,'geoKare':.1})
satir('AYT','Geometri','Çember ve Daire',yillar(1,2,2,3,2,2,2,2),{'geoCember':.25,'geoCemberAci':.3,'geoCemberUzunluk':.2,'geoDaire':.25})
satir('AYT','Geometri','Dönüşüm Geometrisi',yillar(1,1,1,0,1,0,0,1),{'geoDonusum':1})
satir('AYT','Geometri','Katı Cisimler',yillar(1,1,1,1,2,1,1,1),{'geoKati':1})
satir('AYT','Geometri','Çemberin Analitiği',yillar(1,0,0,1,1,0,1,2),{'geoCemberAnalitik':1})
# AYT Fizik (2018–2024)
satir('AYT','Fizik','Kuvvet, Tork ve Denge',yillar(1,1,1,1,0,0,0),{'fizKesisen':.35,'fizTork':.35,'fizKutleMerkezi':.15,'fizBasitMakine':.15})
satir('AYT','Fizik','Basit Makineler',yillar(0,0,0,0,1,0,0),{'fizBasitMakine':1})
satir('AYT','Fizik','İtme ve Momentum',yillar(1,1,1,0,1,1,1),{'fizMomentum':1})
satir('AYT','Fizik','Elektrik Alan ve Potansiyel',yillar(1,1,1,2,0,1,1),{'fizElKuvvet':.2,'fizElAlan':.4,'fizPotansiyel':.4})
satir('AYT','Fizik','Paralel Levhalar ve Sığa',yillar(0,0,0,0,0,0,0),{'fizDuzgunAlan':.5,'fizSigac':.5})
satir('AYT','Fizik','Manyetik Alan ve Manyetik Kuvvet',yillar(0,0,0,1,1,1,1),{'fizManyetikAlan':.5,'fizManyetikKuvvet':.5})
satir('AYT','Fizik','İndüksiyon, Alternatif Akım ve Transformatörler',yillar(2,2,2,1,1,1,1),{'fizIndukleme':.5,'fizAC':.3,'fizTrafo':.2})
satir('AYT','Fizik','Çembersel Hareket',yillar(1,1,2,1,1,1,0),{'fizCembersel':1})
satir('AYT','Fizik','Dalga Mekaniği ve Elektromanyetik Dalgalar',yillar(1,1,1,1,1,1,1),{'fizDalgaMek':.5,'fizEMDalga':.3,'fizIsikTeori':.2})
satir('AYT','Fizik','Atom Modelleri',yillar(0,0,0,0,0,0,1),{'fizAtom':1})
satir('AYT','Fizik','Büyük Patlama ve Parçacık Fiziği',yillar(0,0,0,0,1,0,0),{'fizBuyukPatlama':1})
satir('AYT','Fizik','Atom Fiziğine Giriş ve Radyoaktivite',yillar(1,1,0,1,0,0,1),{'fizRadyo':.6,'fizAtom':.4})
satir('AYT','Fizik','Özel Görelilik',yillar(0,0,0,0,1,0,0),{'fizModern':1})
satir('AYT','Fizik','Fotoelektrik Olay ve Compton Olayı',yillar(1,1,0,1,1,0,0),{'fizModern':1})
satir('AYT','Fizik','Modern Fiziğin Teknolojideki Uygulamaları',yillar(1,1,0,1,1,0,1),{'fizGoruntu':.3,'fizYariIletken':.3,'fizNano':.2,'fizLazer':.2})
DEGISEN = {('TYT','Geometri','Açılar ve Üçgenler'),('TYT','Fizik','Optik'),('TYT','Geometri','Çember-Daire'),('AYT','Geometri','Özel Üçgenler'),('AYT','Geometri','Çember ve Daire'),('AYT','Matematik','Fonksiyonlar'),('AYT','Fizik','Kuvvet, Tork ve Denge')}
for r in pilot['sinavSatirlari']:
    if (r['sinav'], r['ders'], r['konu']) not in DEGISEN: S.append(r)

# ---- school units by catalogue index → the YKS topics they cover (pilot units kept) ----
B = {35:['tytMantik'],36:['tytKume'],37:['tytKume'],38:['tytTemel'],39:['tytBolme'],40:['tytUslu'],44:['geoAciortay','geoKenarortay'],47:['tytVeri'],48:['tytVeri','tytGrafikP'],
 49:['tytPerm','tytKomb'],50:['tytOlasilik'],53:['tytPolinom'],55:['aytDiskriminant','aytKokKatsayi'],56:['geoCokgen'],57:['geoDortgen'],58:['geoYamuk','geoParalel','geoEskDortgen','geoDeltoid','geoDikdortgen','geoKare'],
 59:['geoKati'],61:['tytTemel'],63:['tytBolme'],66:['aytGrafik','aytOrtDegisim'],67:['tytDenklem','tytEsitsizlik'],68:['aytTepe','aytEnBuyuk','aytParabolDenklem'],69:['tytYuzdeP','tytKarP'],
 70:['aytFonkDonusum'],71:['aytParabolDogru'],73:['geoCemberAci'],74:['geoDaire'],76:['geoCemberAci'],77:['geoCemberUzunluk'],78:['geoDaire'],79:['geoKati'],80:['tytOlasilik'],81:['tytOlasilik'],
 82:['aytUstel'],83:['tytUslu','tytKok'],84:['aytLog','aytLogOzellik'],86:['aytUstelLogDenklem'],87:['aytDiziFonk','aytDiziTerim','aytAritmetik','aytGeometrik'],91:['geoDonusum'],
 93:['aytLimitSagSol','aytLimitOzellik','aytLimitParcali','aytBelirsizlik','aytLimitUyg','aytSureklilik'],94:['aytAnlik','aytTurevSagSol','aytTurevKural','aytBileskeTurev','aytZincir'],
 95:['aytIkinciTurev','aytTurevGeo','aytArtanAzalanTurev','aytEkstremum','aytPolinomGrafik','aytMaxMin'],96:['aytBelirsizInt','aytDegiskenDegistirme'],97:['aytRiemann','aytBelirliInt','aytIntAlan'],98:['geoCemberAnalitik'],
 99:['fizGiris'],100:['fizGiris'],101:['fizGiris'],102:['fizGiris'],103:['fizMadde'],104:['fizMadde'],105:['fizMadde'],109:['fizNewton'],111:['fizIs'],112:['fizIs'],113:['fizIs'],114:['fizIs'],
 115:['fizIsi'],116:['fizIsi'],117:['fizIsi'],118:['fizIsi'],119:['fizIsi'],120:['fizElektrostatik'],121:['fizAkim'],122:['fizAkim','fizUretec','fizElGuc','fizLamba'],123:['fizMiknatis'],124:['fizManyetikAlan'],
 125:['fizBasinc'],126:['fizKaldirma'],127:['fizDalgaTemel'],128:['fizDalgaTemel'],129:['fizDalgaSu'],130:['fizDalgaSu'],131:['fizAydinlanma'],132:['fizGolge'],133:['fizYansima'],134:['fizYansima'],
 135:['fizKuresel'],137:['fizMercek'],138:['fizPrizma'],139:['fizRenk'],146:['fizMomentum'],149:['fizBasitMakine'],150:['fizElKuvvet','fizElAlan'],151:['fizPotansiyel'],152:['fizDuzgunAlan','fizSigac'],
 153:['fizManyetikAlan','fizManyetikKuvvet','fizIndukleme'],154:['fizAC'],155:['fizTrafo'],156:['fizCembersel'],162:['fizDalgaMek'],163:['fizEMDalga'],164:['fizAtom'],165:['fizBuyukPatlama'],166:['fizRadyo'],
 167:['fizModern'],168:['fizModern'],169:['fizModern'],170:['fizModern'],171:['fizGoruntu'],172:['fizYariIletken'],174:['fizNano'],175:['fizLazer']}

# ---- assemble and check ----
hata = []
konular, ids = [], set()
for ders, liste in DERS.items():
    for i, a in liste:
        if i in ids: hata.append('tekrar konu ' + i)
        ids.add(i); konular.append({'id': i, 'ders': ders, 'ad': a})
for g in GIZLI: konular.append(g); ids.add(g['id'])
# names must be the app's SAY plan topics
i = html.index('const VARSAYILAN_KONU_PLANI = '); plan = json.loads(re.sub(r'([{,])([A-Z]+):', r'\1"\2":', html[i + 30:html.index(';\n', i)]))
adlar = {(d, a) for hafta in plan['SAY'] for d, l in hafta.items() for a in l}
for k in konular:
    if not k.get('gizli') and (k['ders'], k['ad']) not in adlar: hata.append('plan adı yok: ' + k['ders'] + ' / ' + k['ad'])
eksik = sorted({(d, a) for d, a in adlar if d in DERS and a != 'Genel Tekrar'} - {(k['ders'], k['ad']) for k in konular})
if eksik: hata.append('haritada olmayan plan konuları: ' + str(eksik))
baglar = list(pilot['baglar']); var = {(b['alt'], b['ust']) for b in baglar}
for alt, ust, kul, ger in Y:
    if alt not in ids or ust not in ids: hata.append('bağın konusu yok: %s → %s' % (alt, ust)); continue
    if (alt, ust) in var: hata.append('tekrar bağ: %s → %s' % (alt, ust)); continue
    var.add((alt, ust)); baglar.append({'alt': alt, 'ust': ust, 'kullanim': kul, 'gerekce': ger})
# no cycles (containment included)
kenar = defaultdict(list)
for b in baglar: kenar[b['alt']].append(b['ust'])
for g in GIZLI: kenar[g['id']].append(g['parcasi'])
renk = {}
def dfs(u, yol):
    renk[u] = 1
    for v in kenar[u]:
        if renk.get(v) == 1: hata.append('döngü: ' + ' → '.join(yol + [v]))
        elif not renk.get(v): dfs(v, yol + [v])
    renk[u] = 2
for u in list(ids):
    if not renk.get(u): dfs(u, [u])
for r in S:
    for k in r['paylar']:
        if k not in ids: hata.append('satırın konusu yok: %s %s' % (r['konu'], k))
    if sum(r['paylar'].values()) > 1.0001: hata.append('pay 1’i aşıyor: ' + r['konu'])
birimler = list(pilot['birimler']); var_b = {(b['ders'], b['sinif'], b['ad']) for b in birimler}
for ix, kap in B.items():
    k = KATALOG[ix]; anahtar = (KISA[k[0]], k[1], k[3])
    for x in kap:
        if x not in ids: hata.append('birimin konusu yok: %d %s' % (ix, x))
    if anahtar not in var_b: var_b.add(anahtar); birimler.append({'ders': KISA[k[0]], 'sinif': k[1], 'ad': k[3], 'kapsar': kap})
yalniz = [k['id'] for k in konular if not any(b['alt'] == k['id'] or b['ust'] == k['id'] for b in baglar) and not k.get('gizli')]
if hata: print('\n'.join(hata)); sys.exit(1)
cikti = {'surum': '2026-11-17-taslak-tam', 'not': 'Tam taslak: Geometri, Matematik TYT, Matematik AYT, Fizik (SAY plan konuları). Pilot olduğu gibi korunur; yeni konu, bağ, sınav payı ve okul ünitesi eklendi. Gözden geçirilecek; uygulama şimdilik pilotu kullanır. "Genel Tekrar" (Geometri) bir konu değil, haritada yok.',
         'konular': konular, 'baglar': baglar, 'sinavSatirlari': S, 'birimler': birimler}
json.dump(cikti, open('data/hafiza-haritasi-tam.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(json.dumps({'konu': len(konular), 'bag': len(baglar), 'sinav_satiri': len(S), 'birim': len(birimler), 'baglantisiz': yalniz}, ensure_ascii=False))
