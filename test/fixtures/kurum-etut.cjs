'use strict';
// Synthetic students for the Kurum raporu's Etüt etkisi block (no real names or numbers). Each student has three TYT exams
// (and three AYT exams) with a net per ders, and etüts of that ders between the first and the second exam. The change of
// the Türkiye farkı d is planted exactly as  change = a + b·d_start + kat·e  (e = the etüts of the ders), so ETUT_ETKI's
// pooled model recovers kat. Türkiye averages are given by exam name: TR = {examName: {listCode: average}}.
const TARIH = ['2026-10-07', '2026-10-14', '2026-10-21'];
const ETUT_GUN = ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'];
const adTyt = k => '27-YKS-12' + String(k + 1).padStart(2, '0');
const adAyt = k => '27-YKS-12' + String(k + 11);
// mod: artis = every student takes 1–5 etüts and gains kat per etüt; sifir = low starters take more etüts and rise anyway
// (no effect); azalan = a negative effect; sabit = everybody takes exactly two etüts (the effect cannot be told).
const TYT_DERS = [
  { ders: 'Matematik', course: 'MATEMATİK TYT', key: 'mat', kod: 'MATEMATİK-T', kat: 0.4, mod: 'artis' },
  { ders: 'Fizik', course: 'FİZİK', key: 'fizik', kod: 'FİZİK-T', kat: 0, mod: 'sifir' },
  { ders: 'Kimya', course: 'KİMYA', key: 'kimya', kod: 'KİMYA-T', kat: -0.5, mod: 'azalan' },
  { ders: 'Biyoloji', course: 'BİYOLOJİ', key: 'biyoloji', kod: 'BİYOLOJİ-T', kat: 0.3, mod: 'sabit' }];
const AYT_DERS = [{ ders: 'Matematik', course: 'MATEMATİK TYT', key: 'mat', kod: 'MATEMATİK-A', kat: 0.3, mod: 'artis' }];
// Ten TYT dersler, for the layout of a long table.
const TYT_UZUN = [
  ['Matematik', 'MATEMATİK TYT', 'mat', 'MATEMATİK-T'], ['Türkçe', 'TÜRKÇE', 'turkce', 'TÜRKÇE-T'], ['Fizik', 'FİZİK', 'fizik', 'FİZİK-T'], ['Kimya', 'KİMYA', 'kimya', 'KİMYA-T'],
  ['Biyoloji', 'BİYOLOJİ', 'biyoloji', 'BİYOLOJİ-T'], ['Tarih', 'TARİH', 'tarih', 'TARİH-T'], ['Coğrafya', 'COĞRAFYA', 'cografya', 'COĞRAFYA-T'], ['Felsefe', 'FELSEFE', 'felsefe', 'FELSEFE-T'],
  ['Din Kültürü', 'DİN KÜLTÜRÜ', 'din', 'DİN KÜLTÜRÜ-T'], ['Geometri', 'GEOMETRİ', 'geo', 'GEOMETRİ-T']]
  .map(([ders, course, key, kod], i) => ({ ders, course, key, kod, kat: 0.2 + 0.1 * (i % 4), mod: 'artis' }));
const AYT_UZUN = [['Matematik', 'MATEMATİK TYT', 'mat', 'MATEMATİK-A'], ['Fizik', 'FİZİK', 'fizik', 'FİZİK-A'], ['Kimya', 'KİMYA', 'kimya', 'KİMYA-A'], ['Biyoloji', 'BİYOLOJİ', 'biyoloji', 'BİYOLOJİ-A']]
  .map(([ders, course, key, kod], i) => ({ ders, course, key, kod, kat: 0.2 + 0.1 * (i % 3), mod: 'artis' }));
const ortalama = (kod, k) => 8 + (kod.length % 5) + [0, 3, -2][k];
// {examName: {code: average}} for every ders of the lists given.
function tr(...listeler) {
  const o = {};
  for (const [oturum, L] of [['TYT', listeler[0] || []], ['AYT', listeler[1] || []]]) for (let k = 0; k < 3; k++) { const ad = oturum === 'TYT' ? adTyt(k) : adAyt(k); o[ad] = o[ad] || {}; for (const c of L) o[ad][c.kod] = ortalama(c.kod, k); }
  return o;
}
function plan(c, i) {
  const x0 = (i % 7) - 3;
  if (c.mod === 'sifir') return { x0, e: x0 <= -2 ? 3 : x0 <= 0 ? 2 : x0 <= 1 ? 1 : 0, degisim: 2 - 0.5 * x0 };
  const e = c.mod === 'sabit' ? 2 : c.mod === 'azalan' ? 1 + ((i * 3) % 4) : 1 + ((i * 2) % 5);
  return { x0, e, degisim: 1.5 - 0.3 * x0 + c.kat * e };
}
// n students of one grade in two şubes. tyt / ayt: the ders plans above (a ders can be left out).
function ogrenciler({ sinif = 12, n = 21, tyt = TYT_DERS, ayt = AYT_DERS, ucret = true } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const cls = sinif + '/' + (i % 2 ? 'B' : 'A'), exams = [], sessions = [], gor = new Map();
    for (const [oturum, L] of [['TYT', tyt], ['AYT', ayt]]) {
      if (!L.length) continue;
      const planlar = L.map(c => ({ c, ...plan(c, i) }));
      for (const p of planlar) if (!gor.has(p.c.course)) gor.set(p.c.course, p.e);
      for (let k = 0; k < 3; k++) {
        const nets = {};
        for (const p of planlar) { const d = [p.x0, p.x0 + p.degisim / 2, p.x0 + p.degisim][k]; nets[p.c.key] = Math.round((d + ortalama(p.c.kod, k)) * 100) / 100; }
        exams.push({ exam: oturum === 'TYT' ? adTyt(k) : adAyt(k), date: TARIH[k], session: oturum, nets });
      }
    }
    if (ucret) for (const [course, e] of gor) for (let j = 0; j < e; j++) sessions.push({ date: ETUT_GUN[j], course, teacher: i % 2 ? 'SENTETİK ÖĞRETMEN B' : 'SENTETİK ÖĞRETMEN A', minutes: 40, time: '16:00' });
    return { id: 'S' + sinif + '-' + i, no: String(sinif * 100 + i), name: 'SENTETİK ÖĞRENCİ ' + sinif + '-' + i, cls, grade: sinif, school: 'Sentetik Kartal Anadolu Lisesi', exams, sessions, homework: [], attendance: [], daily: { days: 0, unknown: 0, missed: 0, present: 0, full: 0, half: 0 } };
  });
}
module.exports = { ogrenciler, tr, TYT_DERS, AYT_DERS, TYT_UZUN, AYT_UZUN, adTyt, adAyt, TARIH };
