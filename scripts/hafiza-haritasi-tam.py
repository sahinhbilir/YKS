#!/usr/bin/env python3
"""Builds data/hafiza-haritasi-tam.json: the full map (every subject of the SAY and EA plans) from the reviewed pilot
plus every remaining plan topic. Checks that names match the app's plan topics, that links form no
cycle, that every id exists and that exam shares do not exceed a row. Embedded by scripts/embed-haritam.cjs.
Usage: python3 scripts/hafiza-haritasi-tam.py"""
import ast, json, re, sys
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
   ('fizGoruntu','Görüntüleme Teknikleri'),('fizYariIletken','Yarı İletken Teknolojisi'),('fizSuperIletken','Süper İletkenler'),('fizNano','Nanoteknoloji'),('fizLazer','Lazer')],
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
satir('AYT','Fizik','Modern Fiziğin Teknolojideki Uygulamaları',yillar(1,1,0,1,1,0,1),{'fizGoruntu':.3,'fizYariIletken':.25,'fizSuperIletken':.05,'fizNano':.2,'fizLazer':.2})
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
 167:['fizModern'],168:['fizModern'],169:['fizModern'],170:['fizModern'],171:['fizGoruntu'],172:['fizYariIletken'],173:['fizSuperIletken'],174:['fizNano'],175:['fizLazer']}

# ---- every other subject of the SAY and EA plans (2026-11-17: "all topics of all lessons") ----
# A "(devamı)" / "- devamı" plan topic is the same topic continued: it feeds the topic's node (the app matches it).
def ters(*v): return yillar(*reversed(v))  # kitapsec AYT tables list 2024 first; 2018–2024
DERS.update({
 'Türkçe': [('trkSozcukAnlam','Sözcükte Anlam'),('trkSozObek','Söz Öbeklerinde Anlam'),('trkYapi','Sözcükte Yapı'),('trkCumleAnlam','Cümlede Anlam ve Anlatım'),
   ('trkAnlatimNit','Anlatımın Temel Nitelikleri ve Anlamla İlgili Anlatım Bozuklukları'),('trkSes','Ses Bilgisi'),('trkYazim','Yazım Kuralları'),('trkNoktalama','Noktalama İşaretleri'),
   ('trkParagrafAnlatim','Paragrafta Anlatım'),('trkParagrafYapi','Paragrafta Yapı'),('trkParagrafAnlam','Paragrafta Anlam'),('trkAd','Adlar (İsimler)'),('trkSifat','Ön Adlar (Sıfatlar)'),
   ('trkZamir','Adıllar (Zamirler)'),('trkZarf','Zarflar (Belirteçler)'),('trkEdat','Edat (İlgeç) - Bağlaç - Ünlem'),('trkFiil','Fiiller (Eylemler)'),('trkFiilimsi','Fiilimsiler (Eylemsiler)'),
   ('trkOge','Cümlenin Ögeleri'),('trkCati','Fiilde (Eylemde) Çatı'),('trkKelimeGrup','Kelime Grupları (Sözcük Öbekleri)'),('trkCumleTur','Cümle Türleri'),
   ('trkDilBozuk','Dil Bilgisiyle İlgili Anlatım Bozuklukları'),('trkIletisim','İletişim, Dil ve Kültür')],
 'Kimya': [('kimBilim','Kimya Bilimi'),('kimAtom','Atom Modelleri, Atomun Temel Tanecikleri'),('kimKuantum','Atomun Kuantum Modeli'),('kimPeriyodik','Periyodik Sistem ve Periyodik Özellikler'),
   ('kimRedoks','Redoks Tepkimelerinin Denkleştirilmesi / Aktiflik'),('kimPil','Piller'),('kimElektroliz','Elektroliz / Korozyon'),('kimKanun','Kimyanın Temel Kanunları'),('kimMol','Mol Kavramı'),
   ('kimTepkime','Kimyasal Tepkimeler ve Denklemler'),('kimHesap','Kimyasal Hesaplamalar'),('kimTur','Kimyasal Türler / Türler Arası Etkileşimlerin Sınıflandırılması'),
   ('kimEtkilesim','Güçlü ve Zayıf Etkileşimler'),('kimDegisim','Fiziksel ve Kimyasal Değişimler'),('kimKarbon','Karbon Kimyasına Giriş'),('kimAlkan','Alkanlar'),('kimAlken','Alkenler'),
   ('kimAlkin','Alkinler'),('kimAromatik','Aromatik Bileşikler'),('kimHal','Maddenin Hâlleri'),('kimKarisim','Karışımlar'),('kimAsitBaz','Asitler, Bazlar ve Tuzlar'),('kimAlkol','Alkoller ve Eterler'),
   ('kimAldehit','Aldehitler ve Ketonlar'),('kimKarboksil','Karboksilik Asitler ve Esterler'),('kimGaz','Gazlar'),('kimDoga','Doğa ve Kimya'),('kimHerYer','Kimya Her Yerde'),
   ('kimCozelti','Sıvı Çözeltiler ve Çözünürlük'),('kimEnerji','Kimyasal Tepkimelerde Enerji'),('kimHiz','Kimyasal Tepkimelerde Hız'),('kimDenge','Kimyasal Tepkimelerde Denge'),
   ('kimAsitBazDenge','Sulu Ortamlarda Asit-Baz Dengesi'),('kimCozunurluk','Tuzların Çözünürlük Dengesi'),('kimEnerjiKaynak','Enerji Kaynakları ve Bilimsel Gelişmeler')],
 'Biyoloji': [('bioOrtak','Canlıların Ortak Özellikleri'),('bioBilesen','Canlıların Temel Bileşenleri'),('bioNukleik','Nükleik Asitlerin Yapısı ve Çeşitleri'),('bioReplikasyon','DNA Replikasyonu'),
   ('bioProtein','Genden Proteine (Protein Sentezi)'),('bioBiyotek','Genden Proteine (Genetik Mühendisliği ve Biyoteknoloji)'),('bioHucre','Hücre'),('bioSiniflandirma','Canlı Çeşitliliği ve Sınıflandırılması'),
   ('bioAlem','Canlı Âlemleri ve Virüsler'),('bioEnerji','Canlılık ve Enerji (Fotosentez - Kemosentez - Hücresel Solunum - Fermantasyon)'),('bioEkosistem','Ekosistem Ekolojisi'),
   ('bioKomunite','Komünite Ekolojisi'),('bioPopulasyon','Popülasyon Ekolojisi'),('bioBolunme','Hücre Bölünmeleri ve Üreme'),('bioKalitim','Kalıtım ve Biyolojik Çeşitlilik'),('bioCevre','Canlılar ve Çevre'),
   ('bioBitkiYapi','Bitkilerin Yapısı'),('bioBitkiTasima','Bitkilerde Madde Taşınması'),('bioBitkiUreme','Bitkilerde Eşeyli Üreme'),('bioSinir','Sinir Sistemi'),('bioEndokrin','Endokrin Sistem'),
   ('bioDuyu','Duyu Organları'),('bioDolasim','Dolaşım Sistemi'),('bioLenf','Lenf ve Bağışıklık Sistemi'),('bioSindirim','Sindirim Sistemi'),('bioDestek','Destek ve Hareket Sistemi'),
   ('bioSolunum','Solunum Sistemi'),('bioUriner','Üriner Sistem'),('bioUreme','Üreme Sistemi ve Embriyonik Gelişim')],
 'Türk Dili ve Edebiyatı': [('edSanat','Sanat ve Edebiyat'),('edDonem','Türk Dilinin ve Edebiyatının Tarihî Dönemleri'),
   ('edSiirDili','Coşku ve Heyecanı Dile Getiren Metinler (Şiir Dili / Söz Sanatları)'),('edSiirBilgi','Coşku ve Heyecanı Dile Getiren Metinler (Şiir Bilgisi)'),
   ('edSiirTarih1','Tarihsel Süreç İçinde Türk Şiiri (İslamiyet Öncesi / Geçiş Dönemi 11-12.yy / Halk Edebiyatı)'),('edSiirTarih2','Tarihsel Süreç İçinde Şiir (Halk Edebiyatı / Divan Edebiyatı)'),
   ('edSiirAkim','Şiirde Edebî Akımlar'),('edBatiSiir','Batı Etkisindeki Türk Şiiri (Tanzimat, Servetifünun, Fecriati Dönemlerinde Şiir)'),('edMilliSiir',"Millî Edebiyat Dönemi'nde Şiir"),
   ('edCumSiir',"Cumhuriyet Dönemi'nde Şiir"),('edAnlatTur','Anlatmaya Bağlı Metin Türleri'),('edAnlatAkim','Anlatmaya Bağlı Metinlerde Edebî Akımlar'),
   ('edAnlatUnsur','Anlatmaya Bağlı Metinlerde Unsurlar ve Teknikler'),('edAnlatBati','Anlatmaya Bağlı Metinler (Tanzimat, Servetifünun, Millî Edebiyat Dönemlerinde Hikâye ve Roman)'),
   ('edAnlatCum',"Anlatmaya Bağlı Metinler (Cumhuriyet Dönemi'nde Hikâye ve Roman)"),('edTiyatro','Göstermeye Bağlı Metinler (Tiyatro / Tiyatronun Özellikleri, Unsurları)'),
   ('edTiyatroTarih','Göstermeye Bağlı Metinler (Geleneksel Türk Tiyatrosu / Tanzimat, Millî Edebiyat, Cumhuriyet Dönemlerinde Tiyatro)'),('edOgretici','Öğretici Metinler'),('edSozlu','Sözlü Anlatım Türleri')],
 'T.C. İnkılap Tarihi ve Atatürkçülük': [('inkMK',"Mustafa Kemal'in Hayatı"),('ink20','XX. Yüzyıl Başlarında Osmanlı Devleti'),('inkWW1','I. Dünya Savaşı ve Sonrası Gelişmeler'),
   ('inkHazirlik',"Millî Mücadele'nin Hazırlık Çalışmaları"),('inkTBMM',"Büyük Millet Meclisi'nin Açılması"),('inkSevr','Sevr Antlaşması'),('inkDoguGuney','Doğu ve Güney Cephesi'),
   ('inkBati','Batı Cephesi'),('inkLozan','Lozan Barış Antlaşması'),('inkInkilap','Atatürkçülük ve Türk İnkılabı'),('inkIkiSavas','İki Savaş Arasındaki Dönemde Türkiye ve Dünya'),
   ('inkWW2','II. Dünya Savaşı Sürecinde Türkiye ve Dünya'),('inkWW2Sonra','II. Dünya Savaşı Sonrasında Türkiye ve Dünya'),('inkToplumsal','Toplumsal Devrim Çağında Dünya ve Türkiye'),
   ('ink21','XXI. Yüzyılın Eşiğinde Türkiye ve Dünya')],
 'Coğrafya': [('cogDoga','Doğa ve İnsan Etkileşimi (TYT)'),('cogKonu','Coğrafyanın Konusu, Bölümleri ve Gelişimi (TYT)'),('cogDunyaSekil',"Dünya'nın Şekli ve Hareketleri (TYT)"),
   ('cogEkosistem','Ekosistemlerin Özellikleri ve İşleyişi (AYT)'),('cogEkstrem','Ekstrem Doğa Olayları - Küresel İklim Değişimi (AYT)'),('cogKoordinat','Koordinat Sistemi ve Coğrafi Konum (TYT)'),
   ('cogHarita','Harita Bilgisi (TYT)'),('cogEkoSosyal','Ekonomik Faaliyetlerin Sosyal ve Kültürel Etkileri (AYT)'),('cogSehirEko','Geçmişten Geleceğe Şehir ve Ekonomi (AYT)'),
   ('cogIslevsel',"Türkiye'nin İşlevsel Bölgeleri ve Kalkınma Projeleri (AYT)"),('cogUlasimTr',"Türkiye'de Ulaşım, Enerji Güzergâhları ve Etkileri (AYT)"),
   ('cogTicaretTr',"Küresel Ticaret ve Türkiye'de Ticaret (AYT)"),('cogAtmosfer','Atmosfer ve Özellikleri (TYT)'),('cogIklimEleman',"Dünyada ve Türkiye'de İklim Elemanları (TYT)"),
   ('cogNufusPol','Nüfus Politikaları (AYT)'),('cogSehirler',"Şehirler ve Etki Alanları - Türkiye'de Yerleşmeler (AYT)"),('cogEkoKaynak','Ekonomik Faaliyetler (Üretim-Dağıtım-Tüketim) ve Doğal Kaynaklar (AYT)'),
   ('cogIklimTip','İklim Tipleri ve Bitki Örtüsü (TYT)'),('cogIklimTr',"Türkiye'de İklim Tipleri (TYT)"),('cogYapi',"Dünya'nın Yapısı ve Oluşum Süreci (TYT)"),('cogIc',"Dünyada ve Türkiye'de İç Kuvvetler (TYT)"),
   ('cogEkoPol',"Türkiye'nin Ekonomi Politikaları ve Ekonominin Sektörel Dağılımı (AYT)"),('cogTarim',"Türkiye'de Tarım, Ormancılık ve Hayvancılık (AYT)"),
   ('cogMaden',"Türkiye'de Madenler ve Enerji Kaynakları (AYT)"),('cogSanayi',"Türkiye'de Sanayi (AYT)"),('cogToprak',"Dünyada ve Türkiye'de Topraklar (TYT)"),
   ('cogSu',"Dünyada ve Türkiye'de Su Kaynakları (TYT)"),('cogDis',"Dünyada ve Türkiye'de Dış Kuvvetler (TYT)"),('cogHammadde','Küresel Ticaret - Hammadde-Üretim-Pazar (AYT)'),
   ('cogTurizm',"Dünyada ve Türkiye'de Turizm (AYT)"),('cogKulturMerkez','İlk Kültür Merkezleri ve Kültür Bölgeleri (AYT)'),('cogTurkKultur','Türk Kültürü ve Özellikleri (AYT)'),
   ('cogJeopolitik','Jeopolitik Konum (AYT)'),('cogNufus',"Dünya'da ve Türkiye'de Nüfusun Özellikleri, Değişim ve Dağılışı (TYT)"),('cogPiramit','Nüfus Piramitleri (TYT)'),
   ('cogGoc',"Dünyada ve Türkiye'de Göçler (TYT)"),('cogEkoFaal','Ekonomik Faaliyetler (TYT)'),('cogYerlesme','Yerleşmeler (TYT)'),('cogBolge','Bölgeler ve Ülkeler (TYT)'),
   ('cogUlasimDunya','Uluslararası Ulaşım Hatları (TYT)'),('cogAfet','Afetler (TYT)'),('cogDogalOrtam','İnsanların Doğal Ortamı Kullanma Şekilleri (TYT)'),
   ('cogTeknoloji','Teknolojik Gelişmelerin Kültürel ve Ekonomik Etkileri (AYT)'),('cogGelisme','Ülkelerin Gelişmesinde Etkili Olan Faktörler (AYT)'),
   ('cogCatisma','Sıcak Çatışma Bölgeleri ve Ülkeler (AYT)'),('cogOrgut','Küresel Bölgeler ve Örgütler (AYT)'),('cogCevre','Çevre Sorunları ve Türleri (AYT)'),
   ('cogCevreCozum','Çevre Sorunlarının Çözümüne Yönelik Yaklaşımlar (AYT)')],
 'Felsefe (+ Felsefe Grubu)': [('felTanima','Felsefeyi Tanıma'),('felDusunme','Felsefe ile Düşünme'),('psiTanima','Psikoloji Bilimini Tanıyalım'),('psiSurec','Psikolojinin Temel Süreçleri'),
   ('felKonular','Felsefenin Temel Konuları ve Problemleri'),('psiOgrenme','Öğrenme, Bellek, Düşünme'),('psiRuh','Ruh Sağlığının Temelleri'),('felOkuma','Felsefi Okuma ve Yazma'),
   ('felMO6','MÖ 6. Yüzyıl - MS 2. Yüzyıl Felsefesi'),('felMS2','MS 2. Yüzyıl - 15. Yüzyıl Felsefesi'),('sosGiris','Sosyolojiye Giriş'),('sosBirey','Birey ve Toplum'),('sosYapi','Toplumsal Yapı'),
   ('fel15','15. Yüzyıl - 17. Yüzyıl Felsefesi'),('sosDegisme','Toplumsal Değişme ve Gelişme'),('sosKultur','Toplum ve Kültür'),('sosKurum','Toplumsal Kurumlar'),
   ('fel18','18. Yüzyıl - 19. Yüzyıl Felsefesi'),('fel20','20. Yüzyıl Felsefesi'),('manGiris','Mantığa Giriş'),('manKlasik','Klasik Mantık'),('manDil','Mantık ve Dil'),('manSembolik','Sembolik Mantık')],
})
Y += [
 # Türkçe: meaning, then paragraphs; grammar from word structure up to sentences
 ('trkSozcukAnlam','trkSozObek','cok','Öbeğin anlamı sözcüklerin anlamından kurulur.'),('trkSozcukAnlam','trkCumleAnlam','cok','Cümlenin anlamı sözcüklerin anlamına dayanır.'),
 ('trkSozObek','trkCumleAnlam','az','Deyim ve ikilemeler cümlede.'),('trkCumleAnlam','trkParagrafAnlam','cok','Ana düşünce cümleleri yorumlayarak bulunur.'),
 ('trkCumleAnlam','trkParagrafAnlatim','cok','Anlatım biçimleri cümlelerden tanınır.'),('trkCumleAnlam','trkParagrafYapi','az','Cümlelerin bağlantısı.'),
 ('trkCumleAnlam','trkAnlatimNit','cok','Anlamla ilgili bozukluk cümlede aranır.'),('trkSozcukAnlam','trkAnlatimNit','cok','Sözcüğün yanlış anlamda kullanılması.'),
 ('trkParagrafAnlatim','trkParagrafAnlam','az','Anlatım biçimi ana düşünceyi taşır.'),('trkParagrafYapi','trkParagrafAnlam','az','Giriş, gelişme ve sonuç.'),('trkAnlatimNit','trkParagrafAnlatim','az','Açıklık, duruluk, akıcılık.'),
 ('trkSes','trkYazim','cok','Ses olayları yazımı belirler.'),('trkYapi','trkYazim','az','Eklerin yazımı.'),('trkEdat','trkYazim','az','"de", "ki", "mi"nin yazımı.'),
 ('trkYapi','trkAd','cok','Kök, ek, basit, türemiş ve birleşik sözcük.'),('trkYapi','trkFiil','cok','Fiil kök ve ekleri.'),('trkYapi','trkFiilimsi','cok','Fiilimsi ekleri yapım ekidir.'),('trkYapi','trkSifat','az','Türemiş sıfatlar.'),
 ('trkAd','trkSifat','cok','Sıfat adı niteler.'),('trkAd','trkZamir','cok','Zamir adın yerini tutar.'),('trkSifat','trkZarf','az','Zarf ve sıfatın ayrımı.'),
 ('trkFiil','trkFiilimsi','cok','Fiilimsi fiilden türer.'),('trkFiil','trkCati','cok','Çatı fiilin özelliğidir.'),('trkFiil','trkOge','cok','Yüklem.'),('trkAd','trkOge','az','Özne ve nesne ad soyludur.'),
 ('trkOge','trkCati','cok','Özne ve nesneye göre çatı.'),('trkOge','trkCumleTur','cok','Yüklemin türü ve yeri.'),('trkFiilimsi','trkCumleTur','cok','Fiilimsili birleşik cümle.'),
 ('trkFiilimsi','trkKelimeGrup','cok','Fiilimsi grubu.'),('trkSifat','trkKelimeGrup','cok','Sıfat tamlaması.'),('trkAd','trkKelimeGrup','cok','İsim tamlaması.'),('trkKelimeGrup','trkOge','az','Ögeler kelime gruplarından oluşur.'),
 ('trkEdat','trkCumleTur','az','Bağlaçla bağlı cümleler.'),('trkZamir','trkOge','az','Zamirle kurulan özne ve nesne.'),
 ('trkOge','trkDilBozuk','cok','Öge eksikliği ve uyumsuzluğu.'),('trkCati','trkDilBozuk','az','Çatı uyuşmazlığı.'),('trkKelimeGrup','trkDilBozuk','az','Tamlama yanlışları.'),('trkEdat','trkDilBozuk','az','Bağlaç ve edat yanlışları.'),
 ('trkOge','trkNoktalama','az','Ögeleri ayıran virgül.'),
 # Edebiyat
 ('edSanat','edDonem','az','Edebiyatın sanatla ilişkisi.'),('edSanat','edAnlatTur','az','Metin türleri.'),('edSanat','edOgretici','az','Metin türleri.'),('edSanat','edSozlu','az','Sözlü ve yazılı anlatım.'),
 ('edSiirBilgi','edSiirTarih1','cok','Hece ölçüsü, nazım biçimleri.'),('edSiirBilgi','edSiirTarih2','cok','Aruz ölçüsü, nazım biçimleri.'),('edSiirDili','edSiirTarih2','cok','Divan şiirinde söz sanatları.'),
 ('edSiirDili','edSiirTarih1','az','Halk şiirinde söz sanatları.'),('edDonem','edSiirTarih1','cok','Dönemler.'),('edDonem','edSiirTarih2','cok','Dönemler.'),('edSiirTarih1','edSiirTarih2','cok','Halk edebiyatı sürer.'),
 ('edSiirAkim','edBatiSiir','cok','Servetifünunda sembolizm ve parnasizm.'),('edSiirAkim','edCumSiir','cok','Cumhuriyet şiirinde akımlar.'),('edSiirTarih2','edBatiSiir','az','Tanzimat şiiri divan biçimlerini sürdürür.'),
 ('edDonem','edBatiSiir','az','Dönemler.'),('edBatiSiir','edMilliSiir','cok','Millî Edebiyat ona tepkidir.'),('edMilliSiir','edCumSiir','cok','Beş Hececiler ve Memleketçiler.'),('edSiirTarih1','edMilliSiir','az','Hece ölçüsü ve halk şiiri.'),
 ('edSiirBilgi','edBatiSiir','az','Ölçü ve kafiye.'),('edSiirBilgi','edCumSiir','az','Serbest ölçü.'),
 ('edAnlatTur','edAnlatUnsur','cok','Türün unsurları.'),('edAnlatTur','edAnlatAkim','az','Türler ve akımlar.'),('edAnlatUnsur','edAnlatBati','cok','Hikâye ve romanda unsurlar.'),('edAnlatUnsur','edAnlatCum','cok','Hikâye ve romanda unsurlar.'),
 ('edAnlatAkim','edAnlatBati','cok','Realizm ve natüralizm.'),('edAnlatAkim','edAnlatCum','cok','Modernizm ve bilinç akışı.'),('edSiirAkim','edAnlatAkim','az','Aynı akımlar.'),
 ('edBatiSiir','edAnlatBati','cok','Aynı dönemlerin bilgisi.'),('edMilliSiir','edAnlatBati','az','Millî Edebiyat dönemi.'),('edCumSiir','edAnlatCum','cok','Cumhuriyet dönemi topluluklarının bilgisi.'),
 ('edAnlatBati','edAnlatCum','az','Dönemlerin sırası.'),('edTiyatro','edTiyatroTarih','cok','Tiyatronun unsurları.'),('edAnlatBati','edTiyatroTarih','az','Tanzimat yazarlarının tiyatrosu.'),
 ('edOgretici','edSozlu','az','Öğretici ve sözlü anlatım.'),
 ('trkParagrafAnlam','edOgretici','az','Metni anlama.'),('trkSozcukAnlam','edSiirDili','az','Mecaz ve yan anlam.'),('trkCumleAnlam','edSiirDili','az','Cümlede söz sanatı.'),('trkIletisim','edDonem','az','Türk dilinin tarihî dönemleri.'),
 # Kimya
 ('kimAtom','kimKuantum','cok','Atom modelleri.'),('kimAtom','kimPeriyodik','cok','Proton ve elektron sayısı.'),('kimKuantum','kimPeriyodik','cok','Elektron dizilimi.'),
 ('kimPeriyodik','kimTur','cok','Elektronegatiflik ve bağ türü.'),('kimTur','kimEtkilesim','cok','Kimyasal türler.'),('kimEtkilesim','kimHal','cok','Moleküller arası kuvvetler.'),
 ('kimEtkilesim','kimCozelti','cok','Benzer benzeri çözer.'),('kimHal','kimGaz','cok','Gaz hâli.'),('kimHal','kimKarisim','az','Karışımın bileşenleri.'),('kimKarisim','kimCozelti','cok','Çözelti bir karışımdır.'),
 ('kimDegisim','kimTepkime','az','Kimyasal değişim tepkimedir.'),('kimKanun','kimMol','cok','Kütlenin korunumu ve sabit oranlar.'),('kimMol','kimHesap','tam','Hesaplamalar mol üzerinden yapılır.'),
 ('kimTepkime','kimHesap','cok','Denkleştirilmiş denklem.'),('kimMol','kimGaz','cok','Mol ve hacim.'),('kimMol','kimCozelti','cok','Molarite.'),
 ('kimTepkime','kimRedoks','cok','Denkleştirme.'),('kimPeriyodik','kimRedoks','az','Aktiflik.'),('kimRedoks','kimPil','cok','Pil bir redoks tepkimesidir.'),('kimRedoks','kimElektroliz','cok','Elektroliz redokstur.'),
 ('kimPil','kimElektroliz','cok','Elektrot ve hücre.'),('kimTepkime','kimEnerji','cok','Tepkime ısısı.'),('kimEnerji','kimHiz','az','Aktifleşme enerjisi.'),('kimTepkime','kimHiz','cok','Tepkime hızı.'),
 ('kimHiz','kimDenge','cok','İleri ve geri hız eşitliği.'),('kimEnerji','kimDenge','az','Sıcaklığın dengeye etkisi.'),('kimDenge','kimAsitBazDenge','cok','Denge sabiti.'),('kimAsitBaz','kimAsitBazDenge','cok','Asit ve baz.'),
 ('kimDenge','kimCozunurluk','cok','Çözünürlük çarpımı bir denge sabitidir.'),('kimCozelti','kimCozunurluk','cok','Çözünürlük.'),('kimTepkime','kimAsitBaz','az','Nötrleşme tepkimesi.'),
 ('kimTur','kimKarbon','az','Kovalent bağ.'),('kimKarbon','kimAlkan','cok','Hidrokarbonlar.'),('kimAlkan','kimAlken','cok','Adlandırma.'),('kimAlken','kimAlkin','cok','Katılma tepkimeleri.'),
 ('kimAlken','kimAromatik','az','Çift bağ.'),('kimAlkan','kimAlkol','cok','Adlandırma.'),('kimAlkol','kimAldehit','cok','Yükseltgenme.'),('kimAldehit','kimKarboksil','cok','Yükseltgenme.'),('kimAlkol','kimKarboksil','az','Esterleşme.'),
 ('kimBilim','kimHerYer','az','Kimyanın alanları.'),('kimBilim','kimDoga','az','Kimyanın alanları.'),('kimEnerji','kimEnerjiKaynak','az','Yakıtların enerjisi.'),('kimAsitBaz','kimHerYer','az','Temizlik maddeleri.'),
 ('tytOran','kimHesap','az','Orantı kurma.'),('tytYuzdeP','kimCozelti','az','Kütlece yüzde.'),('aytLog','kimAsitBazDenge','az','pH = −log[H⁺].'),('fizBasinc','kimGaz','az','Gaz basıncı.'),
 ('kimAtom','fizAtom','az','Atomun yapısı.'),('kimPil','fizUretec','az','Pil bir üreteçtir.'),
 # Biyoloji
 ('bioBilesen','bioNukleik','cok','Nükleik asitler temel bileşiktir.'),('bioNukleik','bioReplikasyon','cok','DNA yapısı.'),('bioNukleik','bioProtein','cok','DNA ve RNA.'),('bioReplikasyon','bioBiyotek','az','DNA kopyalama.'),
 ('bioProtein','bioBiyotek','cok','Gen ifadesi.'),('bioBilesen','bioHucre','cok','Zarın ve organellerin yapısı.'),('bioHucre','bioBolunme','cok','Hücre yapısı.'),('bioReplikasyon','bioBolunme','cok','Bölünmeden önce DNA eşlenir.'),
 ('bioBolunme','bioKalitim','cok','Mayoz ve gamet.'),('bioNukleik','bioKalitim','az','Gen ve kromozom.'),('bioOrtak','bioSiniflandirma','az','Canlılık özellikleri.'),('bioSiniflandirma','bioAlem','cok','Sınıflandırma ölçütleri.'),
 ('bioHucre','bioAlem','az','Prokaryot ve ökaryot hücre.'),('bioBilesen','bioEnerji','cok','ATP ve enzimler.'),('bioHucre','bioEnerji','cok','Mitokondri ve kloroplast.'),
 ('bioEkosistem','bioKomunite','cok','Ekosistem kavramları.'),('bioEkosistem','bioPopulasyon','az','Ekosistem kavramları.'),('bioEnerji','bioEkosistem','az','Enerji akışı.'),('bioEkosistem','bioCevre','cok','Madde döngüleri.'),
 ('bioHucre','bioBitkiYapi','az','Bitki hücresi ve doku.'),('bioBitkiYapi','bioBitkiTasima','cok','İletim demetleri.'),('bioBitkiYapi','bioBitkiUreme','cok','Çiçeğin yapısı.'),('bioBolunme','bioBitkiUreme','cok','Döl almaşı ve mayoz.'),
 ('bioHucre','bioBitkiTasima','az','Madde geçişleri.'),('bioHucre','bioSinir','az','Nöron bir hücredir.'),('bioSinir','bioDuyu','cok','Uyartı iletimi.'),('bioSinir','bioEndokrin','cok','Hipotalamus ve hipofiz.'),
 ('bioBilesen','bioSindirim','cok','Besinlerin yapısı.'),('bioDolasim','bioLenf','cok','Kan ve lenf.'),('bioDolasim','bioSolunum','az','Gazların kanla taşınması.'),('bioEnerji','bioSolunum','az','Hücresel solunum.'),
 ('bioDolasim','bioUriner','az','Böbrekte kanın süzülmesi.'),('bioEndokrin','bioUreme','cok','Üreme hormonları.'),('bioBolunme','bioUreme','cok','Gametlerin oluşumu.'),('bioSinir','bioDestek','az','Kas kasılmasının denetimi.'),
 ('bioEndokrin','bioUriner','az','ADH ve aldosteron.'),('tytOlasilik','bioKalitim','az','Çaprazlamada olasılık.'),('kimEtkilesim','bioBilesen','az','Su ve hidrojen bağı.'),
 # İnkılap Tarihi: each period needs the one before it
 ('ink20','inkWW1','cok','Savaşa giden süreç.'),('inkWW1','inkHazirlik','cok','Mondros ve işgaller.'),('inkMK','inkHazirlik','az','Mustafa Kemal’in Samsun’a çıkışı.'),('inkHazirlik','inkTBMM','cok','Kongreler.'),
 ('inkTBMM','inkSevr','az','Sevr’e karşı TBMM.'),('inkWW1','inkSevr','cok','Savaşın sonu.'),('inkTBMM','inkDoguGuney','cok','TBMM orduları.'),('inkTBMM','inkBati','cok','Düzenli ordu.'),('inkDoguGuney','inkBati','az','Cephelerin sırası.'),
 ('inkBati','inkLozan','cok','Mudanya.'),('inkSevr','inkLozan','cok','Sevr ile karşılaştırma.'),('inkLozan','inkInkilap','az','Bağımsızlık.'),('inkTBMM','inkInkilap','az','Saltanatın kaldırılması.'),('inkMK','inkInkilap','az','Atatürk’ün ilkeleri.'),
 ('inkInkilap','inkIkiSavas','az','Yeni devlet.'),('inkLozan','inkIkiSavas','cok','Musul ve Boğazlar.'),('inkIkiSavas','inkWW2','cok','Savaşa giden süreç.'),('inkWW2','inkWW2Sonra','cok','Savaş sonrası düzen.'),
 ('inkWW2Sonra','inkToplumsal','cok','Soğuk Savaş.'),('inkToplumsal','ink21','cok','Soğuk Savaş’ın sonu.'),
 # Coğrafya
 ('cogKonu','cogDoga','az','Coğrafyanın konusu.'),('cogDunyaSekil','cogKoordinat','cok','Enlem, boylam ve yerel saat.'),('cogKoordinat','cogHarita','cok','Koordinatlar haritada.'),('tytOran','cogHarita','cok','Ölçek bir orandır.'),
 ('cogDunyaSekil','cogAtmosfer','az','Güneş ışınlarının geliş açısı.'),('cogAtmosfer','cogIklimEleman','cok','Atmosferin özellikleri.'),('cogKoordinat','cogIklimEleman','cok','Enlemin iklime etkisi.'),
 ('cogIklimEleman','cogIklimTip','cok','İklim elemanları.'),('cogIklimTip','cogIklimTr','cok','İklim tipleri.'),('cogIklimEleman','cogIklimTr','cok','İklim elemanları.'),('cogIklimTip','cogEkosistem','cok','Biyomlar.'),
 ('cogIklimEleman','cogEkstrem','cok','İklim elemanlarının uç değerleri.'),('cogYapi','cogIc','cok','Levhalar ve tektonik.'),('cogIc','cogDis','az','Yer şekilleri.'),('cogYapi','cogDis','az','Kayaçlar.'),
 ('cogDis','cogToprak','cok','Ayrışma.'),('cogIklimTip','cogToprak','cok','İklim ve toprak tipleri.'),('cogIklimEleman','cogSu','cok','Yağış ve akarsu rejimi.'),('cogDis','cogSu','az','Akarsu ve göller.'),
 ('cogIc','cogAfet','cok','Deprem ve volkanizma.'),('cogIklimEleman','cogAfet','az','Sel ve kuraklık.'),('cogAfet','cogEkstrem','az','Doğal afetler.'),
 ('cogNufus','cogPiramit','cok','Nüfusun yapısı.'),('cogNufus','cogGoc','cok','Nüfusun dağılışı.'),('cogNufus','cogNufusPol','cok','Nüfus artışı.'),('cogPiramit','cogNufusPol','cok','Piramitten politika okuma.'),
 ('cogNufus','cogYerlesme','az','Nüfus ve yerleşme.'),('cogYerlesme','cogSehirler','cok','Yerleşme tipleri.'),('cogGoc','cogSehirler','az','Göç ve şehirleşme.'),('cogSehirler','cogSehirEko','az','Şehrin ekonomisi.'),
 ('cogEkoFaal','cogEkoKaynak','cok','Ekonomik faaliyet türleri.'),('cogEkoKaynak','cogEkoPol','cok','Doğal kaynaklar.'),('cogEkoPol','cogTarim','cok','Sektörler.'),('cogEkoPol','cogMaden','az','Sektörler.'),
 ('cogEkoPol','cogSanayi','cok','Sektörler.'),('cogMaden','cogSanayi','cok','Hammadde ve enerji.'),('cogIklimTr','cogTarim','cok','Tarım ürünleri iklime bağlıdır.'),('cogToprak','cogTarim','az','Toprak verimliliği.'),
 ('cogEkoFaal','cogEkoSosyal','cok','Ekonomik faaliyetler.'),('cogEkoKaynak','cogHammadde','cok','Hammadde ve üretim.'),('cogHammadde','cogTicaretTr','cok','Ticaret akışları.'),('cogUlasimDunya','cogTicaretTr','az','Ticaret yolları.'),
 ('cogUlasimDunya','cogUlasimTr','cok','Ulaşım hatları.'),('cogMaden','cogUlasimTr','az','Enerji nakil hatları.'),('cogBolge','cogIslevsel','cok','Bölge kavramı.'),('cogEkoPol','cogIslevsel','cok','Kalkınma.'),
 ('cogIklimTr','cogTurizm','az','Turizmde iklim.'),('cogEkoFaal','cogTurizm','az','Hizmet sektörü.'),('cogKulturMerkez','cogTurkKultur','az','Kültür bölgeleri.'),('cogBolge','cogJeopolitik','cok','Bölgeler ve ülkeler.'),
 ('cogJeopolitik','cogCatisma','cok','Jeopolitik konum.'),('cogBolge','cogOrgut','cok','Bölgeler ve ülkeler.'),('cogBolge','cogGelisme','az','Ülkeler.'),('cogEkoFaal','cogGelisme','cok','Sektörlerin payı.'),
 ('cogEkoFaal','cogTeknoloji','az','Ekonomi.'),('cogGelisme','cogTeknoloji','az','Gelişmişlik.'),('cogDogalOrtam','cogCevre','cok','İnsan etkisi.'),('cogEkosistem','cogCevre','cok','Ekosistem.'),
 ('cogCevre','cogCevreCozum','cok','Sorunların türleri.'),('cogDoga','cogDogalOrtam','cok','Doğa ve insan.'),
 # Felsefe, psikoloji, sosyoloji, mantık
 ('felTanima','felDusunme','cok','Felsefenin anlamı.'),('felDusunme','felKonular','cok','Felsefi düşünme.'),('felTanima','felKonular','cok','Felsefenin alanları.'),
 ('felKonular','felMO6','cok','Varlık ve bilgi problemleri.'),('felKonular','felMS2','cok','Varlık ve bilgi problemleri.'),('felKonular','fel15','cok','Bilgi problemi.'),('felKonular','fel18','cok','Bilgi ve ahlak problemi.'),
 ('felKonular','fel20','cok','Problemler.'),('felMO6','felMS2','az','Antik felsefe sürer.'),('felMS2','fel15','az','Dönemlerin sırası.'),('fel15','fel18','cok','Rasyonalizmden Kant’a.'),('fel18','fel20','az','Dönemlerin sırası.'),
 ('felDusunme','felOkuma','cok','Felsefi metin.'),('felTanima','manGiris','az','Mantık felsefenin dalıdır.'),
 ('manGiris','manKlasik','cok','Kavram, terim, önerme.'),('manKlasik','manDil','az','Önerme.'),('manGiris','manDil','az','Kavram.'),('manKlasik','manSembolik','cok','Önermeler.'),
 ('tytMantik','manSembolik','cok','Önermeler mantığı ve doğruluk tablosu.'),('tytMantik','manKlasik','az','Önerme ve niceleyici.'),
 ('psiTanima','psiSurec','cok','Psikolojinin yöntemleri.'),('psiSurec','psiOgrenme','cok','Duyum ve algı.'),('psiTanima','psiRuh','az','Psikolojinin alanları.'),('psiOgrenme','psiRuh','az','Stres ve başa çıkma.'),
 ('sosGiris','sosBirey','cok','Sosyolojinin kavramları.'),('sosBirey','sosYapi','cok','Toplumsal ilişkiler.'),('sosYapi','sosKurum','cok','Toplumsal yapının unsurları.'),('sosYapi','sosDegisme','cok','Toplumsal yapı.'),
 ('sosGiris','sosKultur','az','Kültür kavramı.'),('sosKultur','sosDegisme','az','Kültür değişmesi.'),
]
# TYT (2018–2025, the school's table)
satir('TYT','Türkçe','Ses Bilgisi',yillar(3,1,0,1,0,1,0,0),{'trkSes':1})
satir('TYT','Türkçe','Dil Bilgisi',yillar(1,8,3,2,3,2,3,3),{'trkYapi':.17,'trkAd':.07,'trkSifat':.07,'trkZamir':.06,'trkZarf':.06,'trkEdat':.06,'trkFiil':.07,'trkFiilimsi':.1,'trkOge':.1,'trkCati':.07,'trkKelimeGrup':.07,'trkCumleTur':.1})
satir('TYT','Türkçe','Noktalama İşaretleri',yillar(1,1,2,2,2,2,2,2),{'trkNoktalama':1})
satir('TYT','Türkçe','Yazım Kuralları',yillar(2,2,2,2,2,2,2,2),{'trkYazim':1})
satir('TYT','Türkçe','Anlatım Bozukluğu',yillar(1,0,0,0,0,0,0,0),{'trkAnlatimNit':.5,'trkDilBozuk':.5})
satir('TYT','Türkçe','Paragraf',yillar(22,22,26,25,26,26,26,26),{'trkParagrafAnlam':.6,'trkParagrafYapi':.2,'trkParagrafAnlatim':.2})
satir('TYT','Türkçe','Cümlede Anlam',yillar(7,3,6,3,3,4,3,3),{'trkCumleAnlam':1})
satir('TYT','Türkçe','Sözcükte Anlam',yillar(3,3,1,5,4,3,4,4),{'trkSozcukAnlam':.75,'trkSozObek':.25})
satir('TYT','Kimya','Kimya Bilimi',yillar(2,0,1,1,1,1,1,1),{'kimBilim':1})
satir('TYT','Kimya','Atomun Yapısı',yillar(0,1,1,0,0,0,1,1),{'kimAtom':1})
satir('TYT','Kimya','Periyodik Tablo',yillar(1,1,0,1,1,1,0,0),{'kimPeriyodik':1})
satir('TYT','Kimya','Maddenin Halleri',yillar(1,1,1,1,1,1,1,1),{'kimHal':1})
satir('TYT','Kimya','Kimyasal Türler Arası Etkileşimler',yillar(1,1,1,1,1,1,1,1),{'kimTur':.5,'kimEtkilesim':.5})
satir('TYT','Kimya','Kimyasal Hesaplamalar',yillar(0,0,1,1,0,0,1,0),{'kimMol':.3,'kimTepkime':.3,'kimHesap':.4})
satir('TYT','Kimya','Kimyanın Temel Kanunları',yillar(1,0,0,0,1,1,0,0),{'kimKanun':1})
satir('TYT','Kimya','Asit, Baz ve Tuzlar',yillar(0,1,1,1,1,1,1,1),{'kimAsitBaz':1})
satir('TYT','Kimya','Karışımlar',yillar(0,1,1,1,1,1,1,1),{'kimKarisim':1})
satir('TYT','Kimya','Kimya Her Yerde',yillar(1,1,0,0,0,0,0,0),{'kimHerYer':1})
satir('TYT','Biyoloji','Canlıların Ortak Özellikleri',yillar(0,1,0,0,1,0,0,1),{'bioOrtak':1})
satir('TYT','Biyoloji','Canlıların Temel Bileşenleri',yillar(1,1,1,1,0,1,1,0),{'bioBilesen':1})
satir('TYT','Biyoloji','Hücre ve Organelleri',yillar(0,0,1,1,1,1,1,0),{'bioHucre':1})
satir('TYT','Biyoloji','Madde Geçişleri',yillar(1,0,0,0,0,0,0,1),{'bioHucre':1})
satir('TYT','Biyoloji','Canlıların Sınıflandırılması',yillar(1,1,1,1,1,1,1,1),{'bioSiniflandirma':.5,'bioAlem':.5})
satir('TYT','Biyoloji','Hücre Bölünmeleri ve Üreme',yillar(1,1,1,1,1,1,1,1),{'bioBolunme':1})
satir('TYT','Biyoloji','Ekosistem Ekoloji',yillar(1,1,0,1,0,1,1,0),{'bioEkosistem':1})
# MEB 10.3 "Ekosistem Ekolojisi ve Güncel Çevre Sorunları": the plan's TYT topic Ekosistem Ekolojisi (not 12.4 Canlılar ve Çevre)
satir('TYT','Biyoloji','Güncel Çevre Sorunları',yillar(1,0,1,0,1,0,0,1),{'bioEkosistem':1})
satir('TYT','Biyoloji','Kalıtım',yillar(0,1,1,1,1,1,1,1),{'bioKalitim':1})
satir('TYT','Tarih','XX. Yüzyıl Başlarında Osmanlı Devleti ve Dünya',yillar(1,0,1,0,0,0,0,0),{'ink20':.5,'inkWW1':.5})
MM = {'inkHazirlik':.2,'inkTBMM':.2,'inkSevr':.1,'inkDoguGuney':.15,'inkBati':.2,'inkLozan':.15}
satir('TYT','Tarih','Milli Mücadele',yillar(0,1,1,1,1,2,1,1),MM)
satir('TYT','Tarih','Atatürkçülük ve Türk İnkılabı',yillar(0,1,0,1,1,0,1,1),{'inkInkilap':1})
satir('TYT','Coğrafya','Doğa ve İnsan',yillar(1,1,0,0,0,0,0,0),{'cogDoga':.6,'cogKonu':.2,'cogDogalOrtam':.2})
satir('TYT','Coğrafya','Dünyanın Şekli ve Hareketleri',yillar(0,0,0,1,0,0,0,0),{'cogDunyaSekil':1})
satir('TYT','Coğrafya','Coğrafi Konum',yillar(0,0,0,0,0,0,0,0),{'cogKoordinat':1})
satir('TYT','Coğrafya','Harita Bilgisi',yillar(1,0,1,0,1,0,1,1),{'cogHarita':1})
satir('TYT','Coğrafya','İklim Bilgisi',yillar(1,1,1,1,1,1,1,1),{'cogAtmosfer':.15,'cogIklimEleman':.35,'cogIklimTip':.25,'cogIklimTr':.25})
satir('TYT','Coğrafya','İç ve Dış Kuvvetler',yillar(0,0,1,1,1,1,0,0),{'cogYapi':.2,'cogIc':.4,'cogDis':.4})
satir('TYT','Coğrafya','Nüfus ve Yerleşme',yillar(1,2,1,1,0,1,1,1),{'cogNufus':.35,'cogPiramit':.15,'cogGoc':.2,'cogYerlesme':.3})
satir('TYT','Coğrafya','Ekonomik Faaliyetler',yillar(0,0,0,0,1,0,0,0),{'cogEkoFaal':1})
satir('TYT','Coğrafya','Bölgeler',yillar(0,0,1,1,0,1,1,1),{'cogBolge':1})
satir('TYT','Coğrafya','Uluslar Arası Ulaşım Hatları',yillar(0,0,0,0,0,0,0,0),{'cogUlasimDunya':1})
satir('TYT','Coğrafya','Doğal Afetler',yillar(1,1,0,0,1,1,1,1),{'cogAfet':1})
satir('TYT','Felsefe','Felsefe Alanı',yillar(0,1,0,2,1,2,1,0),{'felTanima':.5,'felDusunme':.5})
for ad, v in [('Bilgi Felsefesi',(2,1,1,0,2,2,1,3)),('Bilim Felsefesi',(0,1,0,0,0,0,0,1)),('Varlık Felsefesi',(1,0,1,1,0,0,1,0)),('Ahlak Felsefesi',(1,1,2,0,1,1,1,1)),
              ('Siyaset Felsefesi',(0,1,0,1,1,0,0,0)),('Din Felsefesi',(1,0,1,0,0,0,1,0)),('Sanat Felsefesi',(0,0,0,1,0,0,0,0))]:
    satir('TYT','Felsefe',ad,yillar(*v),{'felKonular':1})
# AYT (kitapsec.com; 2018–2024, given newest first)
satir('AYT','Edebiyat','Anlam Bilgisi',ters(6,6,6,3,6,4,4),{'trkParagrafAnlam':.5,'trkCumleAnlam':.25,'trkSozcukAnlam':.25})
satir('AYT','Edebiyat','Metinlerin Sınıflandırılması',ters(1,1,0,0,0,0,0),{'edAnlatTur':.4,'edOgretici':.3,'edSanat':.3})
satir('AYT','Edebiyat','Şiir Bilgisi',ters(2,3,3,2,3,3,3),{'edSiirBilgi':1})
satir('AYT','Edebiyat','Edebi Sanatlar',ters(2,1,2,2,1,1,1),{'edSiirDili':1})
satir('AYT','Edebiyat','İslamiyet Öncesi Türk Edebiyatı ve Geçiş Dönemi',ters(1,0,1,1,1,1,0),{'edSiirTarih1':.7,'edDonem':.3})
satir('AYT','Edebiyat','Halk Edebiyatı',ters(1,2,1,2,2,2,1),{'edSiirTarih1':.4,'edSiirTarih2':.4,'edTiyatroTarih':.2})
satir('AYT','Edebiyat','Divan Edebiyatı',ters(4,5,4,6,4,3,5),{'edSiirTarih2':.7,'edDonem':.1,'edOgretici':.2})
satir('AYT','Edebiyat','Tanzimat Edebiyatı',ters(1,1,1,2,1,2,3),{'edBatiSiir':.4,'edAnlatBati':.4,'edTiyatroTarih':.2})
satir('AYT','Edebiyat','Servet-i Fünun ve Fecr-i Ati Edebiyatı',ters(1,1,1,1,2,1,1),{'edBatiSiir':.5,'edAnlatBati':.5})
satir('AYT','Edebiyat','Milli Edebiyat',ters(1,1,1,1,1,1,1),{'edMilliSiir':.5,'edAnlatBati':.3,'edTiyatroTarih':.2})
satir('AYT','Edebiyat','Cumhuriyet Dönemi Edebiyatı',ters(3,2,3,3,2,5,4),{'edCumSiir':.45,'edAnlatCum':.45,'edTiyatroTarih':.1})
satir('AYT','Edebiyat','Batı Edebiyat Akımları',ters(1,1,1,1,1,1,1),{'edSiirAkim':.5,'edAnlatAkim':.5})
satir('AYT','Tarih-1','XX. Yüzyıl Başlarında Osmanlı Devleti ve Dünya',ters(3,1,0,1,2,4,3),{'ink20':.5,'inkWW1':.5})
satir('AYT','Tarih-1','Milli Mücadele',ters(3,1,5,4,4,3,1),MM)
satir('AYT','Tarih-1','Atatürkçülük ve Türk İnkılabı',ters(2,5,1,3,2,2,2),{'inkInkilap':1})
satir('AYT','Tarih-1','İki Savaş Arasındaki Dönemde Türkiye ve Dünya',ters(0,1,0,0,0,0,1),{'inkIkiSavas':1})
satir('AYT','Tarih-1','II. Dünya Savaşı Sürecinde – Sonrasında Türkiye ve Dünya',ters(1,0,2,0,0,0,1),{'inkWW2':.5,'inkWW2Sonra':.5})
satir('AYT','Tarih-1','XXI. Yüzyılın Eşiğinde Türkiye ve Dünya',ters(0,0,0,0,0,0,1),{'ink21':1})
satir('AYT','Coğrafya-1','İklim ve Yer Şekilleri',ters(0,0,0,0,2,1,1),{'cogIklimTip':.3,'cogIklimTr':.3,'cogIc':.2,'cogDis':.2})
satir('AYT','Coğrafya-1','Coğrafi Konum',ters(0,0,0,0,0,0,2),{'cogKoordinat':1})
satir('AYT','Coğrafya-1','Harita Bilgisi',ters(0,0,0,0,0,0,1),{'cogHarita':1})
satir('AYT','Coğrafya-1','İç ve Dış Kuvvetler',ters(0,0,0,0,0,0,1),{'cogIc':.5,'cogDis':.5})
satir('AYT','Coğrafya-1','Ekosistem',ters(2,6,4,3,3,3,0),{'cogEkosistem':1})
satir('AYT','Coğrafya-1','Nüfus Politikaları',ters(1,1,0,0,2,1,1),{'cogNufusPol':1})
satir('AYT','Coğrafya-1','Yerleşmenin Özellikleri',ters(2,1,1,0,0,1,4),{'cogSehirler':.6,'cogYerlesme':.4})
satir('AYT','Coğrafya-1','Ekonomik Faaliyetler ve Doğal Kaynaklar',ters(1,0,2,1,1,1,1),{'cogEkoKaynak':1})
satir('AYT','Coğrafya-1','Göç ve Şehirleşme',ters(1,0,1,0,1,1,0),{'cogGoc':.5,'cogSehirEko':.5})
satir('AYT','Coğrafya-1','Türkiye Ekonomisi',ters(0,5,2,3,1,2,4),{'cogEkoPol':.25,'cogTarim':.25,'cogMaden':.2,'cogSanayi':.2,'cogTurizm':.1})
satir('AYT','Coğrafya-1',"Türkiye'nin İşlevsel Bölgeleri ve Kalkınma Projeleri",ters(1,0,1,1,1,0,1),{'cogIslevsel':1})
satir('AYT','Coğrafya-1','Küresel Ticaret',ters(1,0,1,1,0,0,0),{'cogTicaretTr':.5,'cogHammadde':.5})
satir('AYT','Coğrafya-1','İlk Uygarlıklar',ters(1,1,0,1,0,2,0),{'cogKulturMerkez':.8,'cogTurkKultur':.2})
satir('AYT','Coğrafya-1','Küresel ve Bölgesel Örgütler',ters(1,1,0,1,1,2,0),{'cogOrgut':1})
satir('AYT','Coğrafya-1','Ülkeler Arası Etkileşimler',ters(0,0,0,1,0,1,0),{'cogJeopolitik':.5,'cogCatisma':.5})
satir('AYT','Coğrafya-1','Bölgeler ve Ülkeler',ters(1,0,4,2,2,1,1),{'cogGelisme':.4,'cogBolge':.3,'cogTeknoloji':.3})
satir('AYT','Coğrafya-1','Çevre ve Toplum',ters(4,1,1,3,3,1,0),{'cogCevre':.5,'cogCevreCozum':.3,'cogEkstrem':.2})
for ad, v, p in [('Felsefe ve Bilim',(0,0,0,0,0,0,1),{'felKonular':1}),('Bilgi Felsefesi',(1,1,1,1,0,2,1),{'felKonular':1}),('Varlık Felsefesi',(0,0,0,0,2,1,1),{'felKonular':1}),
    ('Ahlak Felsefesi',(0,1,1,1,0,0,0),{'felKonular':1}),('Din Felsefesi',(1,0,0,0,1,0,0),{'felKonular':1}),('20. Yüzyıl Felsefesi',(0,1,1,1,0,0,0),{'fel20':1}),
    ('Mantığa Giriş',(1,1,1,1,2,1,1),{'manGiris':1}),('Klasik Mantık',(2,1,1,1,1,2,2),{'manKlasik':1}),('Mantık ve Dil',(0,1,1,1,0,0,0),{'manDil':1}),
    ('Psikoloji Bilimini Tanıyalım',(1,0,0,0,3,1,0),{'psiTanima':1}),('Psikolojinin Temel Süreçleri',(0,1,1,1,0,1,0),{'psiSurec':1}),('Öğrenme Bellek Düşünme',(1,1,1,1,0,1,2),{'psiOgrenme':1}),
    ('Ruh Sağlığının Temelleri',(1,1,1,1,0,0,0),{'psiRuh':1}),('Sosyolojiye Giriş',(1,1,1,1,0,1,0),{'sosGiris':1}),('Birey ve Toplum',(0,0,0,0,2,1,1),{'sosBirey':1}),
    ('Toplumsal Yapı',(1,0,0,0,1,0,1),{'sosYapi':1}),('Toplumsal Değişme ve Gelişme',(0,1,1,1,0,0,1),{'sosDegisme':1}),('Toplum ve Kültür',(1,0,0,1,0,1,0),{'sosKultur':1}),
    ('Toplumsal Kurumlar',(0,1,1,0,0,0,1),{'sosKurum':1})]:
    satir('AYT','Felsefe Grubu',ad,ters(*v),p)
for ad, v, p in [('Atom ve Yapısı',(0,0,0,0,0,1,0),{'kimAtom':1}),('Periyodik Sistem',(0,0,0,1,0,0,1),{'kimPeriyodik':1}),('Kimyasal Hesaplamalar',(0,0,0,0,0,1,1),{'kimMol':.3,'kimTepkime':.3,'kimHesap':.4}),
    ('Modern Atom Teorisi',(1,1,1,0,2,0,0),{'kimKuantum':1}),('Gazlar',(1,2,1,1,1,1,1),{'kimGaz':1}),('Sıvı Çözeltiler',(2,2,2,2,2,1,1),{'kimCozelti':1}),
    ('Kimyasal Tepkimelerde Enerji',(1,1,1,1,1,1,1),{'kimEnerji':1}),('Kimyasal Tepkimelerde Hız',(1,1,1,1,1,1,1),{'kimHiz':1}),('Kimyasal Tepkimelerde Denge',(1,2,1,1,1,0,0),{'kimDenge':1}),
    ('Asit-Baz Dengesi',(1,0,0,1,1,2,1),{'kimAsitBazDenge':1}),('Çözünürlük Dengesi',(0,0,1,0,0,0,0),{'kimCozunurluk':1}),('Kimya ve Elektrik',(2,3,2,2,3,2,2),{'kimRedoks':.3,'kimPil':.4,'kimElektroliz':.3}),
    ('Organik Kimya',(3,1,3,3,1,3,4),{'kimKarbon':.15,'kimAlkan':.15,'kimAlken':.12,'kimAlkin':.1,'kimAromatik':.08,'kimAlkol':.15,'kimAldehit':.12,'kimKarboksil':.13})]:
    satir('AYT','Kimya',ad,ters(*v),p)
for ad, v, p in [('Sinir Sistemi',(1,1,0,0,0,0,1),{'bioSinir':1}),('Endokrin Sistem',(1,2,0,1,1,1,0),{'bioEndokrin':1}),('Duyu Organları',(0,0,1,0,1,0,0),{'bioDuyu':1}),
    ('Destek ve Hareket Sistemi',(0,0,1,1,0,0,1),{'bioDestek':1}),('Sindirim Sistemi',(1,1,0,0,1,1,0),{'bioSindirim':1}),('Dolaşım ve Bağışıklık Sistemi',(1,1,1,1,1,1,1),{'bioDolasim':.6,'bioLenf':.4}),
    ('Solunum Sistemi',(1,1,1,1,1,1,0),{'bioSolunum':1}),('Üriner Sistem',(0,1,0,0,1,1,1),{'bioUriner':1}),('Üreme Sistemi ve Embriyonik Gelişim',(0,0,1,0,0,0,0),{'bioUreme':1}),
    ('Komünite ve Popülasyon Ekolojisi',(2,2,2,2,2,0,2),{'bioKomunite':.5,'bioPopulasyon':.5}),('Nükleik Asitler',(0,0,0,0,1,1,0),{'bioNukleik':.6,'bioReplikasyon':.4}),
    ('Genetik Şifre ve Protein Sentezi',(2,1,2,2,2,1,3),{'bioProtein':.8,'bioBiyotek':.2}),('Canlılık ve Enerji',(1,1,1,0,0,0,0),{'bioEnerji':1}),
    ('Fotosentez ve Kemosentez',(1,0,1,1,1,1,1),{'bioEnerji':1}),('Hücresel Solunum',(0,1,0,1,1,1,0),{'bioEnerji':1}),
    ('Bitki Biyolojisi',(2,0,2,2,0,3,2),{'bioBitkiYapi':.35,'bioBitkiTasima':.35,'bioBitkiUreme':.3}),('Canlılar ve Çevre',(0,1,0,1,0,1,1),{'bioCevre':1})]:
    satir('AYT','Biyoloji',ad,ters(*v),p)
# School units (grades 9–12): catalogue index → the topics they cover. Tarih (grades 9–11) has no plan topic yet.
def ayni(ixler, kap): return {i: kap for i in ixler}
B.update({0:['edSanat'],9:['edDonem'],18:['edSanat'],27:['edSanat'],1:['edAnlatTur','edAnlatUnsur'],2:['edSiirBilgi','edSiirDili'],3:['edAnlatTur'],4:['edAnlatUnsur'],5:['edTiyatro'],
 6:['edOgretici'],7:['edOgretici'],8:['edOgretici'],10:['edAnlatTur'],11:['edSiirTarih1','edSiirTarih2'],12:['edSiirTarih1'],13:['edAnlatBati'],14:['edTiyatroTarih'],15:['edOgretici'],16:['edOgretici'],
 17:['edOgretici'],19:['edAnlatBati'],20:['edBatiSiir','edMilliSiir'],21:['edOgretici'],22:['edOgretici','edSozlu'],23:['edAnlatBati'],24:['edTiyatroTarih'],25:['edOgretici'],26:['edSozlu'],
 28:['edAnlatCum'],29:['edCumSiir'],30:['edAnlatCum'],31:['edTiyatroTarih'],32:['edOgretici'],33:['edSozlu']})
B.update(ayni(range(176, 180), ['kimBilim'])); B.update({180:['kimAtom'],181:['kimAtom'],182:['kimPeriyodik'],183:['kimTur'],184:['kimTur'],185:['kimEtkilesim'],186:['kimEtkilesim'],187:['kimDegisim']})
B.update(ayni(range(188, 192), ['kimHal'])); B.update({192:['kimDoga'],193:['kimDoga'],194:['kimKanun'],195:['kimMol'],196:['kimTepkime'],197:['kimHesap'],198:['kimKarisim'],199:['kimKarisim']})
B.update(ayni(range(200, 204), ['kimAsitBaz'])); B.update({204:['kimHerYer'],205:['kimHerYer'],206:['kimKuantum'],207:['kimKuantum','kimPeriyodik'],208:['kimPeriyodik'],209:['kimPeriyodik'],210:['kimRedoks']})
B.update(ayni(range(211, 216), ['kimGaz'])); B.update(ayni(range(216, 221), ['kimCozelti'])); B.update(ayni(range(221, 225), ['kimEnerji']))
B.update({225:['kimHiz'],226:['kimHiz'],227:['kimDenge'],228:['kimDenge'],229:['kimAsitBazDenge','kimCozunurluk'],230:['kimRedoks'],231:['kimPil'],232:['kimPil'],233:['kimPil'],234:['kimElektroliz'],235:['kimElektroliz']})
B.update(ayni(range(236, 241), ['kimKarbon'])); B.update({241:['kimAlkan','kimAlken','kimAlkin','kimAromatik'],242:['kimAlkol','kimAldehit','kimKarboksil'],243:['kimAlkol'],244:['kimAlkol'],245:['kimAldehit'],246:['kimKarboksil'],247:['kimKarboksil']})
B.update(ayni(range(248, 252), ['kimEnerjiKaynak']))
B.update({252:['bioOrtak'],253:['bioBilesen'],254:['bioHucre'],255:['bioSiniflandirma'],256:['bioAlem'],257:['bioBolunme'],258:['bioBolunme'],259:['bioKalitim'],260:['bioEkosistem'],261:['bioCevre'],262:['bioCevre'],
 263:['bioSinir','bioEndokrin','bioDuyu'],264:['bioDestek'],265:['bioSindirim'],266:['bioDolasim','bioLenf'],267:['bioSolunum'],268:['bioUriner'],269:['bioUreme'],270:['bioKomunite'],271:['bioPopulasyon'],
 272:['bioNukleik','bioReplikasyon'],273:['bioProtein','bioBiyotek'],274:['bioEnerji'],275:['bioEnerji'],276:['bioEnerji'],277:['bioEnerji'],278:['bioBitkiYapi'],279:['bioBitkiTasima'],280:['bioBitkiUreme'],281:['bioCevre']})
B.update({299:['ink20','inkWW1'],300:['inkHazirlik','inkTBMM','inkSevr','inkDoguGuney','inkBati','inkLozan'],301:['inkInkilap'],302:['inkIkiSavas'],303:['inkWW2'],304:['inkWW2Sonra']})
COG = {'cogDoga':[305],'cogKonu':[306,307],'cogDunyaSekil':[308],'cogKoordinat':[309],'cogHarita':[310,311,312],'cogAtmosfer':[313],'cogIklimEleman':[314,315],'cogIklimTip':[316,341,342],'cogIklimTr':[317,343],
 'cogYerlesme':[318,319,320,321],'cogBolge':[322,323,324],'cogDogalOrtam':[325,326],'cogYapi':[327,328],'cogIc':[329,330,331],'cogDis':[332,333,334],'cogSu':[335,336,337],'cogToprak':[338,339,340],
 'cogNufus':[344,345,347,348,349],'cogPiramit':[346],'cogGoc':[350,351,352],'cogEkoFaal':[353],'cogUlasimDunya':[354],'cogAfet':[355,356,357,358],'cogEkosistem':[359,360,361,362],'cogNufusPol':[363,364,365],
 'cogSehirler':[366,367,368,369],'cogEkoKaynak':[370,371,372,373],'cogEkoPol':[374,375],'cogTarim':[376,377],'cogMaden':[378,379],'cogSanayi':[380,381],'cogKulturMerkez':[382,383,385],'cogTurkKultur':[384,418],
 'cogHammadde':[386],'cogTurizm':[387,411,412,413],'cogGelisme':[388,389,420,421],'cogOrgut':[390],'cogCevre':[391,392,393,394,395,396],'cogCevreCozum':[397,424,425,426,427],'cogEkstrem':[398],
 'cogSehirEko':[399,400],'cogIslevsel':[401,402],'cogEkoSosyal':[403],'cogUlasimTr':[404,405,406,423],'cogTicaretTr':[407,408,409,410],'cogJeopolitik':[414,415,416,417],'cogTeknoloji':[419],'cogCatisma':[422]}
for kid, ixler in COG.items():
    for ix in ixler: B[ix] = [kid]
B.update({428:['felTanima'],429:['felDusunme'],430:['felKonular'],431:['felOkuma'],432:['felMO6'],433:['felMS2'],434:['fel15'],435:['fel18'],436:['fel20']})

# ---- 2026-11-18: every YKS topic ("did you really check all the topics of YKS?") ----
# Tarih (grades 9–11) and Din Kültürü are in every YKS plan the app builds (YKS_EK_DERSLER; yeniYksKonuPlani), named as the
# MEB programmes this year's 12th grade was taught (Tarih 2023, DKAB 2018; checked against mufredat.meb.gov.tr).
i = html.index('const YKS_EK_DERSLER = '); EK = json.loads(html[i + 23:html.index(';\n', i)])
TAR_ID = ['tarZaman','tarIlk','tarOrta','tarTurkDunya','tarIslam','tarTurkIslam','tarSelcuklu','tarOsmSiyaset','tarAsker','tarOsmMedeniyet','tarDunyaGucu',
          'tarSultan','tarToplum','tarDengeler','tarDegisim','tarDevrim','tarDenge','tarSosyo']
DIN_ID = ['din91','din92','din93','din94','din95','din101','din102','din103','din104','din105','din111','din112','din113','din114','din115',
          'din121','din122','din123','din124','din125']
assert len(EK['Tarih']) == len(TAR_ID) and len(EK['Din Kültürü']) == len(DIN_ID), 'YKS_EK_DERSLER changed: update the ids'
DERS['Tarih'] = list(zip(TAR_ID, EK['Tarih'])); DERS['Din Kültürü'] = list(zip(DIN_ID, EK['Din Kültürü']))
# Felsefe: the plan's one topic "Felsefenin Temel Konuları ve Problemleri" is MEB unit 10.3, whose kazanımlar are the seven
# branches (10.3.1 Varlık … 10.3.7 Sanat). They are parts of it (one memory: its lessons and tests), drawn as topics (dal).
FEL_DAL = [('felVarlik','Varlık Felsefesi'),('felBilgi','Bilgi Felsefesi'),('felBilim','Bilim Felsefesi'),('felAhlak','Ahlak Felsefesi'),
           ('felDin','Din Felsefesi'),('felSiyaset','Siyaset Felsefesi'),('felSanat','Sanat Felsefesi')]
for i_, a in FEL_DAL: GIZLI.append({'id': i_, 'ders': 'Felsefe (+ Felsefe Grubu)', 'ad': a, 'gizli': True, 'parcasi': 'felKonular', 'dal': True})
Y += [
 # Tarih: the 2023 programme's order; a unit uses the one before it where the story continues
 ('tarZaman','tarIlk','cok','Kronoloji ve takvimler; tarihin kaynakları.'),('tarIlk','tarOrta','az','İlk Çağ’ın sonundan Orta Çağ’a (hukuk, devlet).'),
 ('tarIlk','tarTurkDunya','az','İlk Çağ medeniyet havzaları ve İç Asya.'),('tarOrta','tarTurkDunya','az','Kavimler Göçü.'),
 ('tarTurkDunya','tarTurkIslam','cok','İslamiyet öncesi Türk devlet yapısı.'),('tarIslam','tarTurkIslam','cok','Abbasiler ve İslam medeniyeti.'),
 ('tarTurkIslam','tarSelcuklu','cok','Büyük Selçuklu’dan Türkiye Selçuklu Devleti’ne.'),('tarSelcuklu','tarOsmSiyaset','cok','Beylikler dönemi ve Osmanlı’nın kuruluşu.'),
 ('tarOsmSiyaset','tarAsker','az','Osmanlı ordusunun kuruluşu.'),('tarOsmSiyaset','tarOsmMedeniyet','az','Kuruluş döneminin kurumları.'),
 ('tarOsmSiyaset','tarDunyaGucu','cok','1453’e kadarki büyüme.'),('tarDunyaGucu','tarSultan','az','Klasik çağın merkez teşkilatı.'),('tarSultan','tarToplum','az','Klasik çağın düzeni.'),
 ('tarDunyaGucu','tarDengeler','cok','1595 sonrasının siyaseti.'),('tarDengeler','tarDegisim','az','Avrupa’daki değişim ve Osmanlı.'),
 ('tarDegisim','tarDevrim','cok','Aydınlanmadan devrimlere.'),('tarDengeler','tarDenge','cok','1774 sonrasının siyaseti.'),('tarDevrim','tarDenge','az','Milliyetçilik ve dağılma.'),
 ('tarDevrim','tarSosyo','az','Sanayi Devrimi ve gündelik hayat.'),('tarDenge','ink20','cok','1914’e gelinen süreç.'),('tarDevrim','ink20','az','Meşrutiyet ve Jön Türkler.'),
 ('tarTurkIslam','din122','az','Türklerin İslamiyet’i kabulü ve Anadolu’da İslam.'),
 # Din Kültürü: 9th grade foundations, then their 10th–12th grade continuations
 ('din91','din92','cok','İman ve İslam kavramları.'),('din92','din93','cok','İslam’ın esasları ve ibadet.'),('din91','din101','az','Bilginin kaynakları; akli ve naklî deliller.'),
 ('din94','din102','az','Gençlik ve örnek davranış.'),('din94','din104','az','Değerler ve ahlak.'),('din102','din112','cok','Hz. Muhammed’in örnekliği.'),
 ('din92','din105','az','Din ve dinin yorumu.'),('din105','din123','cok','Yorumlar ve tasavvufi yorumlar.'),('din105','din124','az','Dinî meselelerin çözümünde yöntem.'),
 ('din95','din122','cok','İslam medeniyeti ve Anadolu.'),('din95','din121','az','İslam medeniyetinde bilim.'),('din101','din111','az','Allah inancı ve ahiret.'),
 ('din101','din114','az','İnançla ilgili yaklaşımlar.'),('din91','din113','az','Kur’an’daki kavramlar.'),('din92','din103','az','Din ve hayat.'),
 ('din92','din115','az','Din tanımları ve dinler.'),('din115','din125','az','Dinler.'),
 # Süper İletkenler (MEB 12.6.3): every SAY plan has it after Yarı İletken Teknolojisi (yeniYksKonuPlani)
 ('fizYariIletken','fizSuperIletken','az','İletkenlik ve enerji bantları.'),('fizAkim','fizSuperIletken','az','Direnç ve akım.'),
 # Felsefe's branches: the history-of-philosophy units use them
 ('felVarlik','felMO6','cok','Arkhe: varlığın ana maddesi.'),('felBilgi','fel15','cok','Rasyonalizm ve empirizm: bilginin kaynağı.'),('felBilgi','fel18','cok','Kant’ın eleştirel felsefesi.'),
 ('felBilgi','felBilim','az','Bilimsel bilginin değeri.'),('felBilim','fel20','cok','Popper ve Kuhn.'),('felDin','felMS2','cok','Tanrı’nın varlığına ilişkin kanıtlar.'),
 ('felAhlak','fel18','az','Ödev ahlakı ve faydacılık.'),('felAhlak','felSiyaset','az','Adalet ve iyi yaşam.'),('felSiyaset','fel15','az','Toplum sözleşmesi.'),
 ('felSanat','fel18','az','Estetik yargı.'),('felBilgi','psiSurec','az','Duyum ve bilginin başlangıcı.'),
]
# TYT (the school's table, 2018–2025)
satir('TYT','Tarih','Tarih ve Zaman',yillar(0,0,0,0,0,0,0,0),{'tarZaman':1})
satir('TYT','Tarih','İlk ve Orta Çağlarda Türk Dünyası',yillar(1,1,1,1,1,1,1,1),{'tarTurkDunya':1})
satir('TYT','Tarih','İslam Medeniyetinin Doğuşu',yillar(1,0,0,0,0,0,0,0),{'tarIslam':1})
satir('TYT','Tarih','Türklerin İslamiyet’i Kabulü ve İlk Türk İslam Devletleri',yillar(1,1,1,1,1,1,1,1),{'tarTurkIslam':1})
satir('TYT','Tarih','Beylikten Devlete Osmanlı',yillar(1,1,0,0,1,0,0,1),{'tarOsmSiyaset':.5,'tarOsmMedeniyet':.5})
satir('TYT','Tarih','Dünya Gücü Osmanlı',yillar(0,0,0,0,0,0,1,0),{'tarDunyaGucu':1})
satir('TYT','Tarih','Değişim Çağında Avrupa ve Osmanlı',yillar(0,0,0,0,0,0,0,0),{'tarDegisim':1})
satir('TYT','Tarih','Uluslararası İlişkilerde Denge Stratejisi (1774-1914)',yillar(1,0,1,1,0,1,0,0),{'tarDenge':1})
for ad, v, p in [('Bilgi ve İnanç',(1,2,1,1,1,1,1,1),{'din91':1}),('Din ve İslam',(0,0,0,0,1,1,1,1),{'din92':1}),('İslam ve İbadet',(1,1,0,1,1,0,0,0),{'din93':1}),
    ('Gençlik ve Değerler',(1,1,1,1,0,0,0,0),{'din94':1}),('Allah İnsan İlişkisi',(0,0,0,0,1,0,1,1),{'din101':1}),('Hz. Muhammed (S.A.V)',(1,1,1,0,0,1,1,1),{'din102':.5,'din112':.5}),
    # MEB 9.1.1 (bilginin kaynakları: vahiy, akıl) and 10.1.2 (akli ve naklî deliller)
    ('Vahiy ve Akıl',(1,0,2,1,0,0,0,0),{'din91':.7,'din101':.3}),('İslam Düşüncesinde Yorumlar, Mezhepler',(0,0,0,0,0,1,1,0),{'din105':1}),
    # MEB 9.5.1 (kültür ve medeniyet; İslam medeniyeti), 12.1 and 12.2
    ('Din, Kültür ve Medeniyet',(0,0,0,1,1,1,0,1),{'din95':.5,'din122':.25,'din121':.25})]:
    satir('TYT','Din Kültürü',ad,yillar(*v),p)
# Rows of the school's TYT table the map lacked (2026-11-18; a blank cell, as in Basit Eşitsizlikler, is 2024 with no question)
satir('TYT','Matematik','Oran-Orantı',yillar(0,0,1,1,1,1,0,1),{'tytOran':1})
satir('TYT','Matematik','Denklem Çözme',yillar(0,2,0,0,1,1,0,1),{'tytDenklem':1})
satir('TYT','Matematik','Köklü İfadeler',yillar(2,1,0,1,1,1,1,1),{'tytKok':1})
satir('TYT','Matematik','Çarpanlara Ayırma',yillar(0,1,0,0,0,0,0,0),{'tytCarpan':1})
satir('TYT','Matematik','İşlem',yillar(0,1,0,0,0,0,0,0),{'tytTemel':1})
satir('TYT','Geometri','Analitik Geometri',yillar(1,1,0,1,1,0,0,0),{'geoNokta':.4,'geoDogru':.6})
# 9th-grade Hareket ve Kuvvet (motion, force, Newton's laws: the plan's Newton'un Hareket Yasaları; vectors are 11.1.1, AYT) and
# Enerji are TYT topics though the plan listed them under AYT
satir('TYT','Fizik','Hareket ve Kuvvet',yillar(1,1,1,1,1,1,0,1),{'fizNewton':1})
satir('TYT','Fizik','İş, Güç, Enerji',yillar(0,1,0,0,0,0,0,0),{'fizIs':1})
# AYT Tarih-1 (kitapsec.com, 2018–2024, given newest first); "Sermaye ve Emek" is the 2018 programme's unit, in 11.5 since 2023
for ad, v, p in [('Tarih ve Zaman',(1,1,1,1,1,1,1),{'tarZaman':1}),('İnsanlığın İlk Dönemleri',(1,1,1,1,1,1,1),{'tarIlk':1}),("Orta Çağ'da Dünya",(0,0,0,0,0,0,0),{'tarOrta':1}),
    ('İlk ve Orta Çağlarda Türk Dünyası',(2,2,2,1,2,2,3),{'tarTurkDunya':1}),('İslam Medeniyetinin Doğuşu',(1,1,1,1,2,1,1),{'tarIslam':1}),
    ("Türklerin İslamiyet'i Kabulü ve İlk Türk İslam Devletleri",(2,1,1,3,1,1,1),{'tarTurkIslam':1}),('Yerleşme ve Devletleşme Sürecinde Selçuklu Türkiyesi',(0,0,1,0,0,1,0),{'tarSelcuklu':1}),
    ('Beylikten Devlete Osmanlı',(2,2,3,0,1,1,2),{'tarOsmSiyaset':.5,'tarOsmMedeniyet':.5}),('Devletleşme Sürecinde Savaşçılar ve Askerler',(0,0,1,0,1,0,0),{'tarAsker':1}),
    ('Dünya Gücü Osmanlı',(0,2,0,1,0,1,2),{'tarDunyaGucu':1}),('Sultan ve Osmanlı Merkez Teşkilatı',(0,1,1,1,0,0,0),{'tarSultan':1}),
    ('Değişen Dünya Dengeleri Karşısında Osmanlı Siyaseti',(0,0,1,1,1,0,0),{'tarDengeler':1}),('Değişim Çağında Avrupa ve Osmanlı',(0,1,0,1,2,2,0),{'tarDegisim':1}),
    ('Uluslararası İlişkilerde Denge Stratejisi (1774-1914)',(2,1,0,1,0,0,1),{'tarDenge':1}),('Devrimler Çağında Değişen Devlet-Toplum İlişkileri',(1,0,0,1,0,0,0),{'tarDevrim':1}),
    ('Sermaye ve Emek',(0,0,0,0,1,1,0),{'tarSosyo':1})]:
    satir('AYT','Tarih-1',ad,ters(*v),p)
# The Felsefe rows that name a branch count for that branch (they counted for the whole unit before).
DAL_AD = {a: i_ for i_, a in FEL_DAL}; DAL_AD['Felsefe ve Bilim'] = 'felBilim'
for r in S:
    if r['ders'] in ('Felsefe', 'Felsefe Grubu') and r['konu'] in DAL_AD and r['paylar'] == {'felKonular': 1}: r['paylar'] = {DAL_AD[r['konu']]: 1}
# School units (catalogue: Tarih 282–298, Din Kültürü 438–460; a broad duplicate row is matched by its name instead)
B.update({282:['tarZaman'],283:['tarIlk'],284:['tarOrta'],285:['tarTurkDunya'],286:['tarIslam'],287:['tarTurkIslam'],288:['tarSelcuklu'],289:['tarOsmSiyaset'],
 290:['tarAsker'],291:['tarOsmMedeniyet'],292:['tarDunyaGucu'],293:['tarSultan','tarToplum'],294:['tarDengeler'],295:['tarDegisim'],296:['tarDevrim'],297:['tarDenge'],298:['tarSosyo']})
B.update({438:['din91'],439:['din92'],440:['din93'],441:['din94'],442:['din95'],444:['din101'],445:['din102'],446:['din103'],447:['din104'],448:['din105'],
 450:['din111'],451:['din112'],452:['din113'],453:['din114'],454:['din115'],456:['din121'],457:['din122'],458:['din123'],459:['din124'],460:['din125']})
# Which exam asks each topic: TYT for every YKS student, AYT for the fields whose AYT has its subject (the page decides).
i = html.index('const PLAN_FEN_SINAVI = '); j = html.index('const out = {};', i)
FEN_TYT = {d: ast.literal_eval('[' + m + ']') for d, m in re.findall(r'(Fizik|Kimya|Biyoloji):\[(.*?)\],?\n', html[i:j])}
INK_TYT = {'inkMK','ink20','inkWW1','inkHazirlik','inkTBMM','inkSevr','inkDoguGuney','inkBati','inkLozan','inkInkilap'}
SATIR_SINAV = defaultdict(set)
for r in S:
    for x in r['paylar']: SATIR_SINAV[x].add(r['sinav'])
def sinavi(k):
    # the subject's rule, and every exam whose rows count the topic
    return sorted(set(sinav_kurali(k)) | SATIR_SINAV[k['id']], key=['TYT', 'AYT'].index)
def sinav_kurali(k):
    d, a = k['ders'], k['ad']
    if d in ('Matematik TYT', 'Türkçe'): return ['TYT']
    if d in ('Matematik AYT', 'Türk Dili ve Edebiyatı'): return ['AYT']
    if d in ('Geometri', 'Tarih', 'Din Kültürü'): return ['TYT', 'AYT']
    if d in FEN_TYT: return ['TYT'] if a in FEN_TYT[d] else ['AYT']
    if d == 'T.C. İnkılap Tarihi ve Atatürkçülük': return ['TYT', 'AYT'] if k['id'] in INK_TYT else ['AYT']
    if d == 'Coğrafya': return ['TYT'] if a.endswith('(TYT)') else ['AYT']
    if d == 'Felsefe (+ Felsefe Grubu)': return ['TYT', 'AYT'] if re.search('Felsef', a) else ['AYT']
    raise SystemExit('sınavı belirsiz ders: ' + d)

# ---- assemble and check ----
hata = []
konular, ids = [], set()
for ders, liste in DERS.items():
    for i, a in liste:
        if i in ids: hata.append('tekrar konu ' + i)
        ids.add(i); konular.append({'id': i, 'ders': ders, 'ad': a})
for g in GIZLI: konular.append(g); ids.add(g['id'])
ana = {k['id']: k for k in konular}
for k in konular: k['sinav'] = sinavi(ana[k['parcasi']] if k.get('gizli') else k)
# names must be the app's plan topics (SAY and EA)
i = html.index('const VARSAYILAN_KONU_PLANI = '); plan = json.loads(re.sub(r'([{,])([A-Z]+):', r'\1"\2":', html[i + 30:html.index(';\n', i)]))
DEVAM = re.compile(r'\s*(?:\(devamı\)|- devamı)$', re.I)
adlar = {(d, DEVAM.sub('', a)) for alan in ('SAY', 'EA') for hafta in plan[alan] for d, l in hafta.items() for a in l} | {(d, a) for d, l in EK.items() for a in l} | {('Fizik', 'Süper İletkenler')}
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
cikti = {'surum': '2026-11-18-yks', 'not': 'Tam harita: YKS planlarının bütün dersleri (Geometri, Matematik TYT ve AYT, Fizik, Kimya, Biyoloji, Türkçe, Türk Dili ve Edebiyatı, Tarih, İnkılap Tarihi, Coğrafya, Felsefe grubu, Din Kültürü); her konunun hangi sınavda sorulduğu (sinav). Pilot olduğu gibi korunur. "Genel Tekrar" bir konu değil; "(devamı)" konuları kendi konusunu besler (uygulama eşler).',
         'konular': konular, 'baglar': baglar, 'sinavSatirlari': S, 'birimler': birimler}
json.dump(cikti, open('data/hafiza-haritasi-tam.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(json.dumps({'konu': len(konular), 'bag': len(baglar), 'sinav_satiri': len(S), 'birim': len(birimler), 'baglantisiz': yalniz}, ensure_ascii=False))
