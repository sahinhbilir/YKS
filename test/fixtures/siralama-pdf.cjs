'use strict';
// Synthetic school result lists as pdf.js text items ({s,x,y,w,h,z}, y from the page bottom).
// Positions and font sizes follow the school's "DENEME SINAVI TOPLU SONUÇ LİSTESİ" layout, so
// both the Denemeler and the Sıralamalar parsers read them. All names and scores are invented.
const H = 595.28;
const TYT = ['TÜR','TAR','COĞ','FEL','DİN KÜL','S.F','MAT','GEO','FİZ','KİM','BİY'];
const AYT = ['EDB','TAR','COĞ','TAR','COĞ','FEL GR.','DİN KÜL','S.F','MAT','GEO','FİZ','KİM','BİY'];
const f2 = x => x.toFixed(2);
const net = ([d, y]) => d - y / 4;

// One text item centred (or left-aligned) at x with its vertical middle (cy) as the parser sees it.
function yazi(items, s, x, cy, size, hiza = 'c') {
  s = String(s);
  const w = s.length * size * 0.5;
  items.push({ s, x: hiza === 'c' ? x - w / 2 : x, y: H - cy - 0.34 * size, w, h: size, z: size });
}

// liste: {tur:'T'|'F', ad, tarih:'dd.mm.yyyy', okul, katilim:[toplam,kampus,kurum],
//   kurum:{n:[...], dy:['d.d/y.y',...], p:[4]} | null,
//   ogr:[{no, ad, sinif:['205 12/','C'], dy:[[d,y]|null,...], p:[4], r:[4]}]}
// dy has 11 (T) or 24 (F) entries; null prints "-" and "-/-" (session not taken).
function okulListesi(liste) {
  const F = liste.tur === 'F', items = [];
  const n = F ? 24 : 11;
  const kolon = F ? Array.from({ length: n + 1 }, (_, i) => 135.3 + i * 24.56) : Array.from({ length: n + 1 }, (_, i) => i < n ? 148.8 + i * 51.5055 : 699.79);
  const puan = F ? [745.5, 770, 794, 817.8] : [724.95, 754.89, 784.83, 814.77];
  const ust = F ? 90.9 : 83.23, kurumY = F ? 107.9 : 97.59, ilk = F ? 121.4 : 111.03;
  yazi(items, 'DENEME SINAVI TOPLU SONUÇ LİSTESİ ' + (F ? 'Öğrenci Adı Sıralı' : 'Net Sayısı Sıralı'), 420, 19.9, 10);
  const meta = (cy, cells) => cells.forEach(([etiket, deger, x]) => { yazi(items, etiket, x, cy, 9, 'l'); yazi(items, deger, x + etiket.length * 4.5 + 2.5, cy, 9, 'l'); });
  meta(33.6, [['Okul:', liste.okul, 55.45], ['Sınav Adı:', liste.ad, 385.07], ['Sınav Tarihi:', liste.tarih, 659.85]]);
  meta(48.5, [['Toplam Katılımcı:', liste.katilim[0], 70], ['Kampüs Katılımcı:', liste.katilim[1], 345], ['Kurum Katılımcı:', liste.katilim[2], 615]]);
  yazi(items, 'Sıra', 17.19, ust - 8, 6, 'l'); yazi(items, 'NO/İsim', 32.6, ust - 8, 6, 'l'); yazi(items, 'Snf', 108.42, ust - 8, 6, 'l');
  [...TYT, ...(F ? AYT : [])].forEach((etiket, i) => yazi(items, etiket, kolon[i], ust - 9.5, 4.5));
  yazi(items, 'Toplam', kolon[n], ust - 9.5, 6);
  kolon.forEach(x => { yazi(items, 'N', x, ust, 4.5); yazi(items, 'D/Y', x, ust + 5.3, 4.5); });
  puan.forEach(x => { yazi(items, 'Puan', x, ust, 6); yazi(items, 'Şb. Kr. Km. Gn.', x, ust + 5.6, 4.5); });
  if (liste.kurum) {
    yazi(items, 'Kurum Ortalamaları', 45.88, kurumY, 5, 'l');
    liste.kurum.n.forEach((v, i) => { yazi(items, v === null ? '-' : f2(v), kolon[i], kurumY - 2.34, 5); yazi(items, liste.kurum.dy[i], kolon[i], kurumY + 2.93, 4); });
    yazi(items, '-', kolon[n], kurumY - 2.34, 5); yazi(items, '-/-', kolon[n], kurumY + 2.93, 4);
    liste.kurum.p.forEach((v, i) => yazi(items, v === null ? '-' : f2(v), puan[i], kurumY, 5));
  }
  liste.ogr.forEach((o, sira) => {
    const cy = ilk + sira * 16.019;
    yazi(items, String(sira + 1), 22.3, cy, 5);
    const ad = o.no + ' / ' + o.ad;
    if (ad.length > 26) { const k = ad.lastIndexOf(' ', 26); yazi(items, ad.slice(0, k), 32.6, cy - 2.93, 5, 'l'); yazi(items, ad.slice(k + 1), 32.6, cy + 2.93, 5, 'l'); }
    else yazi(items, ad, 32.6, cy, 5, 'l');
    yazi(items, o.sinif[0], 112.9, cy - 2.93, 5); yazi(items, o.sinif[1], 112.9, cy + 2.93, 5);
    let toplam = 0, dSum = 0, ySum = 0;
    o.dy.forEach((p, i) => {
      if (p) { toplam += net(p); dSum += p[0]; ySum += p[1]; }
      yazi(items, p ? f2(net(p)) : '-', kolon[i], cy - 2.35, 5);
      yazi(items, p ? p[0] + '/' + p[1] : '-/-', kolon[i], cy + 2.92, 4);
    });
    yazi(items, f2(toplam), kolon[n], cy - 2.35, 5); yazi(items, dSum + '/' + ySum, kolon[n], cy + 2.92, 4);
    o.p.forEach((v, i) => { yazi(items, v === null ? '-' : f2(v), puan[i], cy - 2.64, 5); yazi(items, o.r[i], puan[i], cy + 2.92, 4.5); });
  });
  return { pages: [items], boylar: [H] };
}

// Two invented exams. EGE joins in the second; BORA answers TDE-SB1 only in the second.
const Z = [0, 0];
const tyt = (...p) => p;
const SINAVLAR = {
  once: {
    T: { tur: 'T', ad: 'Sentetik Deneme 1', tarih: '18.09.2026', okul: 'SENTETİK ANADOLU LİSESİ', katilim: ['1200', '400', '4'],
      kurum: { n: [20, 2, 1.5, 2, 3, 0, 9, 2, 3, 3, 1.5], dy: ['22.0/8.0', '2.5/2.0', '2.0/2.0', '2.5/2.0', '3.5/2.0', '0.0/0.0', '10.0/4.0', '2.5/2.0', '3.5/2.0', '3.5/2.0', '2.0/2.0'], p: [250, null, null, null] },
      ogr: [
        { no: '1001', ad: 'SENTETİK ADA', sinif: ['301 12/', 'A'], dy: tyt([30, 8], [3, 1], [4, 0], [3, 2], [4, 0], Z, [12, 4], [4, 0], [3, 1], [2, 2], [3, 0]), p: [300.5, 280, 310.25, 270], r: ['1 1 5 900', '2 2 9 2000', '1 1 4 800', '1 1 3 700'] },
        { no: '1002', ad: 'SENTETİK BORA', sinif: ['301 12/', 'A'], dy: tyt([25, 10], [2, 2], [2, 2], [2, 2], [3, 1], Z, [8, 4], [2, 2], [2, 2], [2, 2], [2, 2]), p: [240, 200, 210, 205], r: ['2 3 40 5000', '3 4 50 9000', '2 3 45 6000', '2 4 44 6100'] },
        { no: '1003', ad: 'SENTETİK CEMRE UZUNADLI İKİNCİ', sinif: ['201 12/', 'B'], dy: tyt([28, 6], [3, 0], [3, 1], [3, 1], [4, 1], Z, [20, 4], [6, 2], [5, 1], [5, 1], [4, 0]), p: [320, 330, 300, 280], r: ['1 2 3 600', '1 1 2 400', '1 2 6 1000', '1 2 8 1200'] },
        { no: '1004', ad: 'SENTETİK DOĞA', sinif: ['201 12/', 'B'], dy: tyt([20, 12], [1, 3], [2, 2], [1, 3], [2, 2], Z, [10, 8], [3, 3], [2, 2], [3, 2], [2, 2]), p: [210, 190, 180, 175], r: ['2 4 80 9000', '2 5 70 9900', '3 4 82 9800', '3 4 90 9900'] }
      ] },
    F: { tur: 'F', ad: 'Sentetik Deneme 1', tarih: '18.09.2026', okul: 'SENTETİK ANADOLU LİSESİ', katilim: ['TYT: 1200 | AYT: 1100', 'TYT: 400 | AYT: 380', 'TYT: 4 | AYT: 4'],
      kurum: { n: [20, 2, 1.5, 2, 3, 0, 9, 2, 3, 3, 1.5, 10, 3, 2, 0, 0, 0, 0, 0, 12, 4, 3, 2, 2], dy: ['22.0/8.0', '2.5/2.0', '2.0/2.0', '2.5/2.0', '3.5/2.0', '0.0/0.0', '10.0/4.0', '2.5/2.0', '3.5/2.0', '3.5/2.0', '2.0/2.0', '11.0/4.0', '3.5/2.0', '2.5/2.0', '0.0/0.0', '0.0/0.0', '0.0/0.0', '0.0/0.0', '0.0/0.0', '13.0/4.0', '4.5/2.0', '3.5/2.0', '2.5/2.0', '2.5/2.0'], p: [250, 230, 240, 220] },
      ogr: [
        { no: '1001', ad: 'SENTETİK ADA', sinif: ['301 12/', 'A'], dy: [[30, 8], [3, 1], [4, 0], [3, 2], [4, 0], Z, [12, 4], [4, 0], [3, 1], [2, 2], [3, 0], [16, 4], [5, 1], [3, 1], Z, Z, Z, Z, Z, [14, 6], [5, 2], Z, Z, Z], p: [300.5, 280, 310.25, 270], r: ['1 1 5 900', '2 2 9 2000', '1 1 4 800', '1 1 3 700'] },
        { no: '1002', ad: 'SENTETİK BORA', sinif: ['301 12/', 'A'], dy: [[25, 10], [2, 2], [2, 2], [2, 2], [3, 1], Z, [8, 4], [2, 2], [2, 2], [2, 2], [2, 2], Z, Z, Z, Z, Z, Z, Z, Z, [10, 4], [3, 1], Z, Z, Z], p: [240, 200, 210, 205], r: ['2 3 40 5000', '3 4 50 9000', '2 3 45 6000', '2 4 44 6100'] },
        { no: '1003', ad: 'SENTETİK CEMRE UZUNADLI İKİNCİ', sinif: ['201 12/', 'B'], dy: [[28, 6], [3, 0], [3, 1], [3, 1], [4, 1], Z, [20, 4], [6, 2], [5, 1], [5, 1], [4, 0], Z, Z, Z, Z, Z, Z, Z, Z, [22, 4], [6, 2], [8, 2], [7, 2], [6, 2]], p: [320, 330, 300, 280], r: ['1 2 3 600', '1 1 2 400', '1 2 6 1000', '1 2 8 1200'] },
        { no: '1004', ad: 'SENTETİK DOĞA', sinif: ['201 12/', 'B'], dy: [[20, 12], [1, 3], [2, 2], [1, 3], [2, 2], Z, [10, 8], [3, 3], [2, 2], [3, 2], [2, 2], Z, Z, Z, Z, Z, Z, Z, Z, [8, 8], [2, 2], [3, 3], [2, 3], [3, 2]], p: [210, 190, 180, 175], r: ['2 4 80 9000', '2 5 70 9900', '3 4 82 9800', '3 4 90 9900'] }
      ] }
  },
  sonra: {
    T: { tur: 'T', ad: 'Sentetik Deneme 2', tarih: '02.10.2026', okul: 'SENTETİK ANADOLU LİSESİ', katilim: ['1250', '410', '5'],
      kurum: { n: [21.5, 2.25, 1.5, 2.5, 3, 0, 10.75, 2.5, 3.25, 2.75, 1.75], dy: ['23.0/6.0', '2.8/2.2', '2.0/2.0', '2.9/1.6', '3.4/1.6', '0.0/0.0', '12.0/5.0', '3.0/2.0', '3.6/1.4', '3.2/1.8', '2.1/1.4'], p: [262.4, null, null, null] },
      ogr: [
        { no: '1001', ad: 'SENTETİK ADA', sinif: ['301 12/', 'A'], dy: tyt([33, 4], [3, 1], [4, 0], [4, 1], [4, 0], Z, [14, 4], [4, 0], [3, 1], [3, 1], [3, 0]), p: [320, 300, 330, 290], r: ['1 1 3 600', '1 2 8 1500', '1 1 2 500', '1 1 2 600'] },
        { no: '1002', ad: 'SENTETİK BORA', sinif: ['301 12/', 'A'], dy: tyt([24, 12], [2, 2], [2, 2], [3, 1], [3, 1], Z, [8, 4], [2, 2], [2, 2], [2, 2], [2, 2]), p: [235, 220, 230, 215], r: ['3 4 45 5400', '3 3 40 8000', '2 3 40 5500', '2 3 40 5600'] },
        { no: '1003', ad: 'SENTETİK CEMRE UZUNADLI İKİNCİ', sinif: ['201 12/', 'B'], dy: tyt([30, 4], [3, 0], [3, 1], [3, 1], [4, 1], Z, [22, 2], [7, 1], [5, 1], [6, 0], [4, 0]), p: [340, 350, 310, 290], r: ['1 2 2 500', '1 1 1 300', '1 2 5 900', '1 2 7 1100'] },
        { no: '1004', ad: 'SENTETİK DOĞA', sinif: ['201 12/', 'B'], dy: tyt([19, 14], [1, 3], [2, 2], [1, 3], [2, 2], Z, [9, 10], [3, 3], [2, 2], [3, 2], [2, 2]), p: [200, 185, 170, 170], r: ['2 4 90 9500', '2 5 75 9950', '3 4 85 9900', '3 4 95 9950'] },
        { no: '1005', ad: 'SENTETİK EGE', sinif: ['205 12/', 'C'], dy: tyt([26, 8], [3, 1], [3, 1], [3, 1], [3, 1], Z, [15, 5], [5, 1], [4, 2], [4, 2], [3, 1]), p: [270, 260, 250, 240], r: ['1 3 20 3000', '1 3 20 3500', '1 3 22 3600', '1 3 25 3800'] }
      ] },
    F: { tur: 'F', ad: 'Sentetik Deneme 2', tarih: '09.10.2026', okul: 'SENTETİK ANADOLU LİSESİ', katilim: ['TYT: 1250 | AYT: 1150', 'TYT: 410 | AYT: 390', 'TYT: 5 | AYT: 5'],
      kurum: { n: [21.5, 2.25, 1.5, 2.5, 3, 0, 10.75, 2.5, 3.25, 2.75, 1.75, 11.5, 3.75, 2.25, 0, 0, 0, 0, 0, 13.5, 4.25, 3.5, 2.25, 2.75], dy: ['23.0/6.0', '2.8/2.2', '2.0/2.0', '2.9/1.6', '3.4/1.6', '0.0/0.0', '12.0/5.0', '3.0/2.0', '3.6/1.4', '3.2/1.8', '2.1/1.4', '12.5/4.0', '4.0/1.0', '2.8/2.2', '0.0/0.0', '0.0/0.0', '0.0/0.0', '0.0/0.0', '0.0/0.0', '14.5/4.0', '4.8/2.2', '3.8/1.2', '2.6/1.4', '3.0/1.0'], p: [262.4, 240.1, 250.3, 228.5] },
      ogr: [
        { no: '1001', ad: 'SENTETİK ADA', sinif: ['301 12/', 'A'], dy: [[33, 4], [3, 1], [4, 0], [4, 1], [4, 0], Z, [14, 4], [4, 0], [3, 1], [3, 1], [3, 0], [18, 2], [6, 2], [4, 0], Z, Z, Z, Z, Z, [16, 4], [6, 2], Z, Z, Z], p: [320, 300, 330, 290], r: ['1 1 3 600', '1 2 8 1500', '1 1 2 500', '1 1 2 600'] },
        { no: '1002', ad: 'SENTETİK BORA', sinif: ['301 12/', 'A'], dy: [[24, 12], [2, 2], [2, 2], [3, 1], [3, 1], Z, [8, 4], [2, 2], [2, 2], [2, 2], [2, 2], [12, 4], [4, 2], [2, 2], Z, Z, Z, Z, Z, [10, 4], [3, 1], Z, Z, Z], p: [235, 220, 230, 215], r: ['3 4 45 5400', '3 3 40 8000', '2 3 40 5500', '2 3 40 5600'] },
        { no: '1003', ad: 'SENTETİK CEMRE UZUNADLI İKİNCİ', sinif: ['201 12/', 'B'], dy: [[30, 4], [3, 0], [3, 1], [3, 1], [4, 1], Z, [22, 2], [7, 1], [5, 1], [6, 0], [4, 0], Z, Z, Z, Z, Z, Z, Z, Z, [24, 4], [7, 1], [9, 1], [8, 2], [6, 1]], p: [340, 350, 310, 290], r: ['1 2 2 500', '1 1 1 300', '1 2 5 900', '1 2 7 1100'] },
        { no: '1004', ad: 'SENTETİK DOĞA', sinif: ['201 12/', 'B'], dy: [[19, 14], [1, 3], [2, 2], [1, 3], [2, 2], Z, [9, 10], [3, 3], [2, 2], [3, 2], [2, 2], Z, Z, Z, Z, Z, Z, Z, Z, [7, 9], [2, 3], [3, 3], [2, 4], [3, 3]], p: [200, 185, 170, 170], r: ['2 4 90 9500', '2 5 75 9950', '3 4 85 9900', '3 4 95 9950'] },
        { no: '1005', ad: 'SENTETİK EGE', sinif: ['205 12/', 'C'], dy: [[26, 8], [3, 1], [3, 1], [3, 1], [3, 1], Z, [15, 5], [5, 1], [4, 2], [4, 2], [3, 1], Z, Z, Z, Z, Z, Z, Z, Z, [15, 5], [5, 1], [6, 2], [5, 1], [4, 2]], p: [270, 260, 250, 240], r: ['1 3 20 3000', '1 3 20 3500', '1 3 22 3600', '1 3 25 3800'] }
      ] }
  }
};
module.exports = { okulListesi, SINAVLAR, H };
