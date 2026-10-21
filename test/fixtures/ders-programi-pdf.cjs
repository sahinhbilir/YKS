'use strict';
// Synthetic "<kod> <sınıf> Haftalık Ders Programı" in the school's PDF layout, as pdf.js text items
// ({s,x,y,w,h,z,f}, y from the page bottom, A4 portrait, f the font: 'K' bold, 'D' plain). Days run
// across, lesson times down; in each cell the lesson is bold and the teacher plain, both wrapping
// at about fourteen characters, as the school's PDF does. No real teacher or class data.
const KALIN = 'K', DUZ = 'D';
const GUN = [['Pazartesi', 115.9, 47.2], ['Salı', 197.2, 18.7], ['Çarşamba', 248.3, 50.4], ['Perşembe', 315.3, 50.5], ['Cuma', 393.3, 28.4], ['Cumartesi', 448.7, 51.7], ['Pazar', 527.3, 28.4]];
const SAAT = [['09.00', '09.40'], ['09.55', '10.35'], ['10.45', '11.25'], ['11.35', '12.15'], ['12.25', '13.05'], ['13.00', '13.40'], ['13.50', '14.30'], ['14.40', '15.20'], ['15.30', '16.10']];
const genislik = (s, z) => s.length * z * 0.62;
const yazi = (s, x, y, z, f) => ({ s, x, y, w: genislik(s, z), h: z, z, f });
const sar = (s, n = 14) => s.split(' ').reduce((l, w) => { if (l.length && (l[l.length - 1] + ' ' + w).length <= n) l[l.length - 1] += ' ' + w; else l.push(w); return l; }, []);
// hucreler: [[gün 0–6, saat sırası 0–8, ders, öğretmen]]
function dersProgrami({ kod = '302', sinif = '11/A', hucreler = [] }) {
  const out = [yazi(kod + ' ' + sinif + ' Haftalık Ders Programı', 221.4, 778.5, 10, KALIN), yazi('2026-2027 Eğitim Öğretim Yılı', 45, 795.6, 7, KALIN),
    yazi('Haftalık Ders Saati: ' + hucreler.length, 45, 783.6, 7, KALIN), yazi('SENTETİK ANADOLU LİSESİ', 206.3, 798.5, 10, KALIN)];
  for (const [g, x] of GUN) out.push(yazi(g, x, 728.9, 9, KALIN));
  const satirY = SAAT.map((_, i) => 703.9 - 37 * i);
  SAAT.forEach(([a, b], i) => out.push(yazi(a, 27.3, satirY[i], 9, KALIN), yazi(b, 70.3, satirY[i], 9, KALIN)));
  for (const [g, s, ders, hoca] of hucreler) {
    const satirlar = sar(ders).map(t => [t, KALIN]).concat(hoca ? sar(hoca).map(t => [t, DUZ]) : []), orta = GUN[g][1] + GUN[g][2] / 2;
    satirlar.forEach(([t, f], k) => out.push(yazi(t, orta - genislik(t, 7) / 2, satirY[s] + (satirlar.length - 1) * 4.08 - k * 8.15, 7, f)));
  }
  out.push(yazi('Sayfa 1', 30, 28.3, 10, DUZ), yazi('21 Eki 2026', 515.6, 28.3, 10, DUZ));
  return [out];
}
module.exports = { dersProgrami, SAAT };
