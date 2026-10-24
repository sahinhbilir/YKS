'use strict';
// Synthetic "Yoklama Raporu" in the school's PDF layout, as pdf.js text items ({s,x,y,w,h,z}, y from
// the page bottom, A4 portrait). No real student data.
// Each class starts a new page under its header ("205 12/C Yoklama Raporu"); a student's days follow
// one another, one row per day, and run on to the next page under the lesson headers only. The
// student's name sits in the middle of their rows on every page; "|" wraps it onto two lines.
// Lesson codes: P Geldi · A Gelmedi · G Gecikti · M Mazeretli (Diğer) · R Mazeretli (Raporlu) · . empty.
const yazi = (s, x, y, w, z = 8) => ({ s, x, y, w, h: z, z });
const genislik = s => Math.round(s.length * 5.2 * 10) / 10;
const DERS_X = i => 176.4 + 45 * i;
function hucre(out, kod, i, y) {
  const d = 45 * i;
  if (kod === 'P') out.push(yazi('Geldi', 182.2 + d, y, 20.6));
  else if (kod === 'A') out.push(yazi('Gelmedi', 175.8 + d, y, 33.3));
  else if (kod === 'G') out.push(yazi('Gecikti', 178.6 + d, y, 27.7));
  else if (kod === 'M') out.push(yazi('Mazeretli', 174.2 + d, y + 4.7, 36.7), yazi('(Diğer)', 178.6 + d, y - 4.7, 27.9));
  else if (kod === 'R') out.push(yazi('Mazeretli', 174.2 + d, y + 4.7, 36.7), yazi('(Raporlu)', 173.9 + d, y - 4.7, 37.2));
}
function ad(out, s, y) {
  const p = String(s).split('|');
  const koy = (t, yy) => { const w = genislik(t); out.push(yazi(t, 62.5 - w / 2, yy, w)); };
  if (p.length === 1) koy(p[0], y); else { koy(p[0], y + 4.65); koy(p[1], y - 4.65); }
}
// siniflar: [{no:'205', sinif:'12/C', ogrenciler:[{ad:'SENTETİK ADA', gunler:[['15/09/2026','PPPPPPPP'], …]}]}]
// yazdirma: the print date in the footer. dersler: lesson columns. ilkSatir/sonraki: rows on a class's
// first page and on the pages after it.
function yoklamaRaporu(siniflar, { yazdirma = '19 Eki 2026', dersler = 8, ilkSatir = 33, sonraki = 38, okul = 'SENTETİK ANADOLU LİSESİ' } = {}) {
  const pages = [];
  let out = null, y = 0, kalan = 0;
  const kapat = () => { if (!out) return; out.push(yazi('Sayfa ' + (pages.length + 1), 30, 30.72, 43.9), yazi(yazdirma, 515.63, 30.72, 50)); pages.push(out); out = null; };
  const basliklar = yy => { for (let i = 0; i < dersler; i++) out.push(yazi((i + 1) + '. Ders', DERS_X(i), yy, 32.1)); };
  for (const s of siniflar) {
    kapat();
    out = [yazi(okul, 206.3, 798.5, 212.4, 10), yazi('2026-2027 Eğitim Öğretim', 45, 790.9, 119), yazi('Yılı', 45, 781.6, 14),
      yazi(s.no + ' ' + s.sinif + ' Yoklama Raporu', 240.1, 778.5, 144.7, 10)];
    basliklar(723.2); y = 703.2; kalan = ilkSatir;
    for (const o of s.ogrenciler) {
      let parca = [];
      const bitir = () => { if (parca.length) ad(out, o.ad, (parca[0] + parca[parca.length - 1]) / 2); parca = []; };
      for (const [tarih, kodlar] of o.gunler) {
        if (!kalan) { bitir(); kapat(); out = []; basliklar(809.2); y = 789.2; kalan = sonraki; }
        out.push(yazi(tarih, 114.5, y, 46.1));
        [...kodlar].forEach((k, i) => hucre(out, k, i, y));
        parca.push(y); y -= 20; kalan--;
      }
      bitir();
    }
  }
  kapat();
  return { pages };
}
// Weekdays from a to b (dd/mm/yyyy, inclusive), for building a student's days.
function okulGunleri(a, b) {
  const g = s => { const [d, m, y] = s.split('/').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
  const out = [];
  for (let t = g(a); t <= g(b); t++) { const d = new Date(t * 864e5), w = d.getUTCDay(); if (w === 0 || w === 6) continue;
    out.push(String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear()); }
  return out;
}
// The test school: 7 Eyl – 16 Eki 2026, printed on 16 Eki (that day is incomplete). From 14 Eyl:
// ADA (12/A) absent once, late twice (Gecikti; missed the first two lessons), left early and missed one
// lesson in between once each (both Geldi). FERİDE (12/A, wrapped name, six lessons) excused (Diğer)
// twice, Raporlu once, absent three times. BORA (12/A) every day. CEM (11/B) absent every Monday, late
// once. DENİZ (11/B) left on 25 Eyl and EGE (11/B) joined on 28 Eyl, so their rows run on as one rising
// list. FİLİZ (9/A) excused once.
function ornekSiniflar() {
  const gunler = okulGunleri('07/09/2026', '16/10/2026');
  const ogr = (ad, varsayilan, ozel = {}, ilk = '07/09/2026', son = '16/10/2026') => {
    const g = s => s.split('/').reverse().join('');
    return { ad, gunler: gunler.filter(t => g(t) >= g(ilk) && g(t) <= g(son)).map(t => [t, ozel[t] ?? varsayilan]) };
  };
  const pazartesi = Object.fromEntries(gunler.filter(t => new Date(t.split('/').reverse().join('-')).getUTCDay() === 1).map(t => [t, 'AAAAAAAA']));
  return [
    { no: '205', sinif: '12/A', ogrenciler: [
      ogr('SENTETİK ADA', 'PPPPPPPP', { '10/09/2026': 'AAAAAAAA', '22/09/2026': 'AAAAAAAA', '29/09/2026': 'GPPPPPPP', '06/10/2026': 'AAPPPPPP', '08/10/2026': 'PPPPAAAA', '13/10/2026': 'PPAPPPPP' }),
      ogr('SENTETİK UZUNADLI|FERİDE İKİNCİ', 'PPPPPP', { '15/09/2026': 'MMMMMM', '16/09/2026': 'RRRRRR', '17/09/2026': 'AAMMMM', '18/09/2026': 'AAAAMM', '01/10/2026': 'AAAAAA', '16/10/2026': 'AAA' }),
      ogr('SENTETİK BORA', 'PPPPPPPP', { '16/10/2026': 'PPP' }),
    ] },
    { no: '303', sinif: '11/B', ogrenciler: [
      ogr('SENTETİK CEM', 'PPPPPPPP', { ...pazartesi, '15/09/2026': 'GPPPPPPP', '16/10/2026': 'PPP' }),
      ogr('SENTETİK DENİZ', 'PPPPPPPP', {}, '07/09/2026', '25/09/2026'),
      ogr('SENTETİK EGE', 'PPPPPPPP', { '16/10/2026': 'AA' }, '28/09/2026'),
    ] },
    { no: '102', sinif: '9/A', ogrenciler: [ogr('SENTETİK FİLİZ', 'PPPPPPPP', { '30/09/2026': 'MMMMMMMM', '16/10/2026': 'PPP' })] },
  ];
}
const ornekRapor = (secenek = {}) => yoklamaRaporu(ornekSiniflar(), { yazdirma: '16 Eki 2026', ilkSatir: 12, sonraki: 14, ...secenek });
module.exports = { yoklamaRaporu, okulGunleri, ornekSiniflar, ornekRapor };
