'use strict';
// Synthetic "Tarih Bazlı Etüt Raporu" in the school's PDF layout, as pdf.js text items
// ({s,x,y,w,h,z}, y from the page bottom, A4 portrait). No real student or teacher data.
// Each day starts a new page with its date; a day longer than SATIR_SAYFA rows continues on the
// next page under the table header only. "|" in a name wraps it onto two lines, as the school's
// PDF does for long names.
const SATIR_SAYFA = 8;
const genislik = s => s.length * 5;
const yazi = (s, x, y, z = 9) => ({ s, x, y, w: genislik(s), h: z, z });
const KOLON = { no: 29.6, brans: 50, ogretmen: 160, ogrenci: 270, sube: 379.6, derslik: 441.4, saat: 487, sure: 535.4 };
function hucre(out, s, x, y) {
  const p = String(s).split('|');
  if (p.length === 1) { out.push(yazi(p[0], x, y)); return; }
  out.push(yazi(p[0], x, y + 5.2), yazi(p[1], x, y - 5.3));
}
function baslik(out, y) {
  for (const [s, x] of [['#', 28.7], ['Branş', 50], ['Öğretmen Ad Soyad', 160], ['Öğrenci Ad Soyad', 270], ['Şube', 387.3], ['Derslik', 432.3], ['Saat', 488.5], ['Süre', 538.3]]) out.push(yazi(s, x, y));
}
// gunler: [{tarih:'dd.mm.yyyy', satirlar:[[branş, öğretmen, öğrenci, şube, derslik, saat, süre]]}]
function etutRaporu(gunler, { bas = '16.08.2026', bit = '19.10.2026' } = {}) {
  const pages = [], boylar = [];
  let sayfa = 1;
  gunler.forEach((gun, gi) => {
    for (let i = 0; i < gun.satirlar.length || i === 0; i += SATIR_SAYFA) {
      const out = [], ilk = pages.length === 0;
      let y = 806;
      if (ilk) {
        out.push(yazi('Tarih Bazlı Etüt Raporu', 247.3, 798.5, 10), yazi(bas + ' / ' + bit + ' Tarihleri Arasında', 191.9, 778.5, 10),
          yazi('2026-2027 Eğitim Öğretim', 45, 790.9, 8), yazi('Yılı', 45, 781.6, 8));
        y = 720;
      }
      if (i === 0) out.push(yazi(gun.tarih, 265.9, y, 10));
      baslik(out, y - 22.1);
      gun.satirlar.slice(i, i + SATIR_SAYFA).forEach((r, k) => {
        const ry = y - 42.1 - 20 * k, [brans, ogretmen, ogrenci, sube, derslik, saat, sure] = r;
        out.push(yazi(String(i + k + 1), KOLON.no, ry));
        hucre(out, brans, KOLON.brans, ry); hucre(out, ogretmen, KOLON.ogretmen, ry); hucre(out, ogrenci, KOLON.ogrenci, ry);
        out.push(yazi(sube, KOLON.sube, ry));
        if (derslik) out.push(yazi(derslik, KOLON.derslik, ry));
        if (saat) out.push(yazi(saat, KOLON.saat, ry));
        if (sure) out.push(yazi(sure, KOLON.sure, ry));
      });
      out.push(yazi('Sayfa ' + sayfa++, 30, 30.7, 10), yazi('19 Eki 2026', 515.6, 30.7, 10));
      pages.push(out); boylar.push(842);
      if (!gun.satirlar.length) break;
    }
  });
  return { pages, boylar };
}

// Six full weeks (7 Eyl – 18 Eki 2026) and Monday 19 Eki, so the last week is partial.
// Designed students (2-week window: last = 5 Eki + 12 Eki weeks, before = 21 Eyl + 28 Eyl):
// ADA rises 2 → 6, BORA falls 5 → 1, CEM stops 3 → 0, DENİZ is new (first etüt in the last
// window), EGE stays 2 → 2, FERİDE returns (7 Eyl only, then 1 in the last window).
const T = {
  mat: ['MATEMATİK TYT', 'SENTETİK ÖĞRETMEN BİR'], geo: ['Geometri', 'SENTETİK UZUNADLI|ÖĞRETMEN İKİ'],
  fiz: ['FİZİK 1', 'SENTETİK ÖĞRETMEN ÜÇ'], kim: ['KİMYA TYT', 'SENTETİK ÖĞRETMEN DÖRT'], kim2: ['Kimya', 'SENTETİK ÖĞRETMEN DÖRT'],
  tur: ['Türkçe', 'SENTETİK ÖĞRETMEN BEŞ'], biy: ['BİYOLOJİ AYT', 'SENTETİK ÖĞRETMEN ALTI'],
};
const O = { ada: ['SENTETİK ADA', '301 12/A'], bora: ['SENTETİK BORA', '201 12/B'], cem: ['SENTETİK CEM', '205 12/C'],
  deniz: ['SENTETİK DENİZ', '302 11/A'], ege: ['SENTETİK EGE', '101 10/A'], feride: ['SENTETİK UZUNADLI|FERİDE İKİNCİ', '301 12/A'] };
const satir = (d, o, saat = '14:40', sure = '20 Dk.', derslik = '101') => [T[d][0], T[d][1], O[o][0], O[o][1], derslik, saat, sure];
const GUNLER = [
  { tarih: '08.09.2026', satirlar: [satir('mat', 'feride'), satir('fiz', 'cem', '15:00'), satir('tur', 'feride', '15:20', '40 Dk.')] },
  { tarih: '15.09.2026', satirlar: [satir('mat', 'bora'), satir('geo', 'ada', '15:00', '30 Dk.')] },
  { tarih: '22.09.2026', satirlar: [satir('mat', 'bora'), satir('kim', 'bora', '15:00'), satir('fiz', 'cem'), satir('mat', 'ada', '15:20'), satir('tur', 'ege')] },
  { tarih: '24.09.2026', satirlar: [satir('biy', 'bora'), satir('fiz', 'cem', '15:00')] },
  { tarih: '29.09.2026', satirlar: [satir('mat', 'bora'), satir('kim2', 'bora', '15:00'), satir('fiz', 'cem'), satir('geo', 'ada'), satir('tur', 'ege', '15:20')] },
  { tarih: '06.10.2026', satirlar: [satir('mat', 'ada'), satir('fiz', 'ada', '15:00'), satir('kim', 'ada', '15:20'), satir('mat', 'deniz'), satir('tur', 'ege'), satir('mat', 'bora', '15:40')] },
  // A long day: rows 9–11 continue on the next page with no date line.
  { tarih: '13.10.2026', satirlar: [satir('mat', 'ada'), satir('geo', 'ada', '15:00'), satir('kim2', 'ada', '15:20'), satir('mat', 'deniz', '15:00'), satir('fiz', 'deniz', '15:20'),
    satir('tur', 'ege', '15:00'), satir('mat', 'feride', '16:00', '25 Dk.'), satir('tur', 'deniz', '16:20'), satir('geo', 'deniz', '16:40'), satir('biy', 'ada', '16:40'), satir('fiz', 'deniz', '17:00')] },
  { tarih: '19.10.2026', satirlar: [satir('mat', 'ada', '16:20'), satir('fiz', 'bora', '16:20')] },
];
module.exports = { etutRaporu, GUNLER, SATIR_SAYFA };
