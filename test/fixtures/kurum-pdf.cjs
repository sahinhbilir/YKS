'use strict';
// Synthetic "Ders Ortalamaları İlk 100 Kurum (Kolej)" report in the publisher's PDF layout, as pdf.js
// text items ({s,x,y,w,h,z}, y from the page bottom, A4 portrait). Synthetic school names only.
// Every subject starts a new page under its title ("27-YKS-1201, TÜRKÇE-T Dersi Net Sıralı Liste
// _40 Soru_ (İlk 100 Okul)") and the headers Sıralama · Okul Adı · Okul Net · Okul Başarı · Genel Net;
// its rows run on to the next page under the headers only. The footer holds the print date and page.
const yazi = (s, x, y, w, z = 7) => ({ s, x, y, w, h: z, z });
const say = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
const BIZ = 'SENTETİK KARTAL ANADOLU LİSESİ';
const UZUN = 'SENTETİK KOLEJİ DOĞU KAMPÜSÜ (YAMAÇ) FEN/ANADOLU LİSESİ';
const okul = i => i === 7 ? UZUN : 'SENTETİK KOLEJ ' + String(i + 1).padStart(3, '0') + ' ANADOLU LİSESİ';
const KURS = ['SENTETİK İLERİ KURS 001', 'SENTETİK İLERİ KURS 002'];
const DERSLER = [['TÜRKÇE-T', 40], ['MATEMATİK-T', 30], ['FİZİK-T', 7], ['S.FELSEFE-T', 5], ['TÜRK DİLİ VE EDB-A', 24], ['MATEMATİK-A', 30]];
// The followed school's nets by exam (1, 2, 3). FİZİK-T in exam 2 is too low for the list; MATEMATİK-T in
// exam 1 ties with five other schools. S.FELSEFE-T (Ek Felsefe) is printed but never kept.
const BIZIM = {
  'TÜRKÇE-T': [24.1, 25.3, 26], 'MATEMATİK-T': [12, 11.2, 14.5], 'FİZİK-T': [2.1, 0.2, 2.9], 'S.FELSEFE-T': [3, 3.1, 3.3],
  'TÜRK DİLİ VE EDB-A': [13.2, 12.1, 14], 'MATEMATİK-A': [10, 12.5, 13]
};
// One exam's list: {ad, yazdirma, dersler:[{kod, soru, genel, satir:[[ad, net], …]}]}, each subject's
// schools by net (ties keep the generated order), the first 100 kept. kurum adds two courses.
function kurumListesi(e, { ad = '27-YKS-120' + e, liste = 'kolej', dersler = DERSLER, okulSayisi = 120, ilk = 100 } = {}) {
  const yazdirma = String(e * 7).padStart(2, '0') + '.10.2026';
  return {
    ad, yazdirma, dersler: dersler.map(([kod, soru]) => {
      const rows = [];
      for (let i = 0; i < okulSayisi; i++) {
        let net = Math.round((soru * (0.82 - 0.0055 * i) + 0.15 * e + ((i * 13 + e * 7 + soru) % 9 - 4) * 0.01) * 100) / 100;
        if (kod === 'MATEMATİK-T' && e === 1 && i >= 60 && i <= 64) net = 12;
        rows.push([okul(i), net, i]);
      }
      rows.push([BIZ, BIZIM[kod] ? BIZIM[kod][e - 1] : soru * 0.3, 1000]);
      if (liste === 'kurum') KURS.forEach((k, j) => rows.push([k, soru * 0.8 - j, -1 - j]));
      rows.sort((a, b) => b[1] - a[1] || a[2] - b[2]);
      return { kod, soru, genel: Math.round((soru * 0.5 + e * 0.1) * 100) / 100, satir: rows.slice(0, ilk).map(([a, n]) => [a, n]) };
    })
  };
}
// The report's pages. ilkSatir / sonraki: rows on a subject's first page and on the pages after it.
function kurumRaporu(L, { ilkSatir = 73, sonraki = 76, baslikEki = ' (İlk 100 Okul)' } = {}) {
  const sayfaSayisi = L.dersler.reduce((t, d) => t + 1 + Math.ceil(Math.max(0, d.satir.length - ilkSatir) / sonraki), 0);
  const pages = [];
  let out = null, y = 0, kalan = 0;
  const kapat = () => { if (!out) return; out.push(yazi('Sayfa ' + (pages.length + 1) + ' / ' + sayfaSayisi, 499.74, 25.57, 47.97, 8), yazi(L.yazdirma, 20, 25.57, 45.78, 8)); pages.push(out); out = null; };
  const basliklar = yy => out.push(yazi('Sıralama', 42.2, yy, 49.6, 10), yazi('Okul Adı', 193.27, yy, 47.46, 10), yazi('Okul Net', 352.46, yy, 49.08, 10),
    yazi('Okul Başarı', 414.72, yy, 64.56, 10), yazi('Genel Net', 489.15, yy, 55.69, 10));
  const sag = (s, x, yy) => { const w = Math.round(s.length * 4.006 * 100) / 100; out.push(yazi(s, Math.round((x - w) * 100) / 100, yy, w)); };
  for (const d of L.dersler) {
    kapat();
    out = [yazi(L.ad + ', ' + d.kod + ' Dersi Net Sıralı Liste _' + d.soru + ' Soru_' + baslikEki, 101.76, 808.54, 391.48, 10)];
    basliklar(778.54); y = 764.58; kalan = ilkSatir;
    d.satir.forEach(([ad, net], j) => {
      if (!kalan) { kapat(); out = []; basliklar(808.54); y = 794.58; kalan = sonraki; }
      const sira = String(j + 1), w = Math.round(sira.length * 4.45 * 100) / 100;
      out.push(yazi(sira, Math.round((69.22 - w) * 100) / 100, y, w), yazi(ad, 97, y, Math.round(ad.length * 4.1 * 100) / 100));
      sag(say(net), 387.02, y); sag(say(net / d.soru * 100), 457.02, y); sag(say(d.genel), 527.02, y);
      y = Math.round((y - 10) * 100) / 100; kalan--;
    });
  }
  kapat();
  return { pages };
}
module.exports = { kurumListesi, kurumRaporu, BIZ, UZUN, KURS, DERSLER };
