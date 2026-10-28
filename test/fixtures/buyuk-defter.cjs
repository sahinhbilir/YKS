'use strict';
// Synthetic teacher-notebook parts at a chosen size, for the cloud-backup size tests. Names are
// invented ("SENTETİK ÖĞRENCİ 0001"). The row shapes are the ones the Sıralamalar, Etütler, Yoklama
// and Konu Takibi pages store in the notebook; every number is pseudo-random (seeded, so a run is
// repeatable), so the compression ratio is not flattered by rows that simply repeat.

function rastgele(tohum) {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n, g = 4) => String(n).padStart(g, '0');
const ad = i => 'SENTETİK ÖĞRENCİ ' + pad(i);
const sinifOf = i => ['12/A', '12/B', '12/C', '11/A', '11/B', '10/A'][i % 6];
const ders = ['TÜRKÇE-T', 'MATEMATİK-T', 'FİZİK', 'KİMYA', 'BİYOLOJİ', 'TARİH-1', 'COĞRAFYA-1'];

function parcalar(olcek, tohum = 7) {
  const r = rastgele(tohum), tam = (a, b) => a + Math.floor(r() * (b - a + 1));
  const ceyrek = x => Math.round(x * 4) / 4;

  // Sıralamalar: sınav başına T (TYT) ve F (fen/AYT) listeleri; satır başına 11 ve 24 ders neti.
  const siralamaSatiri = (i, f) => {
    const nn = f ? 24 : 11, n = Array.from({ length: nn }, () => ceyrek(r() * 30));
    return { no: String(1000 + i), ad: ad(i), snf: '30' + tam(1, 4) + ' ' + sinifOf(i), n,
      dy: n.map(x => Math.round(x) + '/' + tam(0, 9)), p: [0, 1, 2, 3].map(() => Math.round(r() * 50000) / 100),
      r: [0, 1, 2, 3].map(() => tam(1, 9) + ' ' + tam(1, 9) + ' ' + tam(1, 40) + ' ' + tam(100, 2500)) };
  };
  const kurum = n => ({ n: Array.from({ length: n }, () => ceyrek(r() * 30)), dy: Array.from({ length: n }, () => tam(1, 40) + '.0/' + tam(1, 9) + '.0'), p: [Math.round(r() * 50000) / 100, null, null, null] });
  const siralamaOgr = Math.round(146 * olcek);
  const siralama = { surum: 1, sinavlar: Array.from({ length: 6 }, (_, e) => ({
    id: 'SENTETİK DENEME ' + (e + 1), ad: 'Sentetik Deneme ' + (e + 1), okul: 'SENTETİK ANADOLU LİSESİ', ts: 1760000000000 + e,
    T: { tarih: '1' + e + '.09.2026', katilim: ['1200', '400', '4'], kurum: kurum(11), ogr: Array.from({ length: siralamaOgr }, (_, i) => siralamaSatiri(i, false)) },
    F: { tarih: '1' + e + '.09.2026', katilim: ['TYT: 1250 | AYT: 1150'], kurum: kurum(24), ogr: Array.from({ length: siralamaOgr }, (_, i) => siralamaSatiri(i, true)) } })) };

  // Etütler: kaynak, sözlükler ve [gün, branş, öğretmen, öğrenci, saat, süre] satırları.
  const etutOgr = Math.round(300 * olcek), etutSatir = Math.round(23800 * olcek);
  const etut = { surum: 1, ts: 1760000000000, kaynak: [{ bas: 20681, bit: 20745, n: etutSatir, ts: 1760000000000 }],
    brans: ['BİYOLOJİ AYT', 'FİZİK 1', 'Geometri', 'Kimya', 'KİMYA TYT', 'MATEMATİK TYT', 'Türkçe'],
    ogretmen: Array.from({ length: 14 }, (_, i) => 'SENTETİK ÖĞRETMEN ' + pad(i, 2)),
    ogrenci: Array.from({ length: etutOgr }, (_, i) => [ad(i), sinifOf(i)]),
    satir: Array.from({ length: etutSatir }, () => [20681 + tam(0, 64), tam(0, 6), tam(0, 13), tam(0, etutOgr - 1), 880 + 20 * tam(0, 5), 10 * tam(2, 5)]) };

  // Yoklama: gün listesi ve öğrenci başına "8P,8A,GPPPPPPP,…" günlük dizesi.
  const gunSayisi = 100, parca = ['8P', '8P', '8P', '8P', '8A', '8P', 'GPPPPPPP', 'AAPPPPPP', 'PPPPAAAA', '6P', '6M', '8R', 'PPAPPPPP'];
  const yoklama = { surum: 1, ts: 1760000000000, kaynak: [{ bas: 20600, bit: 20740, n: 150, yaz: 20740, ts: 1760000000000 }],
    gunler: Array.from({ length: gunSayisi }, (_, i) => 20600 + i + 2 * Math.floor(i / 5)),
    ogrenci: Array.from({ length: Math.round(830 * olcek) }, (_, i) => [ad(i), sinifOf(i), Array.from({ length: gunSayisi }, () => parca[tam(0, parca.length - 1)]).join(',')]) };

  // Konu Takibi: kazanım sözlüğü ve sınav → öğrenci blokları → [kazanım, toplam, doğru, yanlış, boş] satırları.
  const kazanimlar = Array.from({ length: 60 }, (_, i) => ['T.12.' + (1 + (i % 9)) + '.' + (1 + Math.floor(i / 9)), 'Sentetik kazanım ' + (i + 1) + ' için bir cümle açıklaması yazılır.']);
  const ktOgr = Math.round(515 * olcek);
  const konutakibi = { surum: 1, ts: 1760000000000, labels: kazanimlar,
    exams: Array.from({ length: 6 }, (_, e) => ({ ad: 'SENTETİK-' + (e + 1), date: null,
      blocks: Array.from({ length: ktOgr }, (_, i) => ({ student: { name: ad(i), no: String(9000 + i), cls: '205 ' + sinifOf(i) },
        course: ders[(i + e) % ders.length], kind: 'outcome',
        rows: Array.from({ length: 6 }, (_, k) => { const t = tam(1, 12), d = tam(0, t), y = tam(0, t - d); return [(i * 3 + k * 7 + e) % 60, t, d, y, t - d - y]; }) })) })),
    maps: {} };

  // Öğrenciler: kayıt başına birkaç okul denemesi.
  const dersler = [['turkce', 40], ['tarih', 5], ['cografya', 5], ['felsefe', 5], ['din', 5], ['sf', 5], ['mat', 30], ['geo', 10], ['fizik', 7], ['kimya', 7], ['biyoloji', 6]];
  const ogr = Array.from({ length: Math.round(70 * olcek) }, (_, i) => ({ ad: ad(i), no: 1000 + i, sube: sinifOf(i).replace('/', '-'), sinif: +sinifOf(i).slice(0, 2),
    alan: ['SAY', 'EA', 'SÖZ'][i % 3], kap: 6, off: [6], aktif: true, cikti: null,
    denemeOkul: Array.from({ length: 6 }, (_, e) => ({ id: 'p:' + i + ':' + e, ad: 'Sentetik Deneme ' + (e + 1), tarih: '2026-09-' + pad(10 + e, 2), tur: 'TYT', oturum: 'TYT', brans: '', alan: 'SAY',
      dersler: dersler.map(([kod, soru]) => { const ust = Math.floor(soru * 0.8), dg = tam(0, ust), yn = tam(0, ust - dg); return { kod, soru, dogru: dg, yanlis: yn }; }), sure: null, puan: Math.round(r() * 50000) / 100, ts: 1 })) }));

  return { siralama, etut, yoklama, konutakibi, ogr };
}

// `defter`e (sandbox'taki D'ye ya da düz bir nesneye) parçaları ekler; ham JSON boyutu hedefe ±%4 yaklaşana
// kadar ölçeği ayarlar. Dönen: { olcek, hamBayt }.
function hedefeBuyut(defter, hedefBayt, bayt = s => Buffer.byteLength(s, 'utf8')) {
  const taban = JSON.parse(JSON.stringify(defter));
  let olcek = hedefBayt / 2400000, hamBayt = 0;
  for (let i = 0; i < 12; i++) {
    const p = parcalar(olcek);
    Object.keys(defter).forEach(k => { if (!(k in taban)) delete defter[k]; });
    Object.assign(defter, taban, p);
    hamBayt = bayt(JSON.stringify(defter));
    if (Math.abs(hamBayt - hedefBayt) / hedefBayt < 0.04) break;
    olcek *= hedefBayt / hamBayt;
  }
  return { olcek, hamBayt };
}

module.exports = { parcalar, hedefeBuyut, rastgele };
