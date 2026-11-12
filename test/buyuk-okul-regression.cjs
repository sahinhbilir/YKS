'use strict';
// A school-sized notebook through the app's own stores (school lists, etüt report, timetables): the shared student base
// (Öğrenci raporları, Etüt etkisi, Öğretmen raporu) must not do work per student that it can do once. The Öğretmen raporu
// froze the browser when the base copied every list for every student and compared every etüt row with every student, and the
// report rebuilt that base for every block. Synthetic students only ('SENTETİK …').
const fs = require('node:fs'), assert = require('node:assert/strict');
const fixture = fs.readFileSync('test/cloud-sync-resilience.js', 'utf8').split('// ---------------------------------------------------------------- test koşucusu')[0].replace(/^#![^\n]*\n/, '');
const load = new Function('require', 'process', fixture + '\nreturn loadAppSandbox;')(require, { argv: ['node', 'buyuk-okul', process.argv[2] || 'index.html'] });
const hash = (...v) => { let h = 2166136261; for (const x of v) { h ^= x; h = Math.imul(h, 16777619); h ^= h >>> 13 } return h >>> 0 };
const iso = g => new Date(g * 86400000).toISOString().slice(0, 10), display = g => iso(g).split('-').reverse().join('.');
const BASE = Math.floor(Date.UTC(2026, 8, 14) / 86400000), LESSONS = ['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'Biyoloji', 'Tarih'];
const N = 60, W = 4;
// 60 students in 12-A and 12-B; two of them share a name in different classes.
const people = Array.from({ length: N }, (_, i) => ({ no: i + 1, ad: i === 1 || i === 31 ? 'SENTETİK AYNI AD' : 'SENTETİK ÖĞRENCİ ' + String(i + 1).padStart(3, '0'), sube: '12-' + (i < 30 ? 'A' : 'B'), alan: 'SAY', sinif: 12, aktif: true, kap: 6, off: [] }));
const study = w => { const bas = BASE + w * 7, satirlar = []; people.forEach((o, i) => { for (let j = 0; j < 2; j++) { const h = hash(i, w, j); satirlar.push({ g: bas + (h % 5), brans: LESSONS[h % 6] + (h % 2 ? ' TYT' : ' AYT'), ogretmen: 'Sentetik Öğretmen ' + (1 + (h % 4)), ad: o.ad, sinif: o.sube, saat: 540 + (h % 12) * 30, sure: 40 }) } }); return satirlar };
function lists(w, K, T) {
  const day = BASE + w * 7 + 4, ad = 'Deneme ' + String(w + 1).padStart(2, '0');
  const make = tur => ({ tur, ad, okul: 'Sentetik Lisesi', tarih: display(day), katilim: [String(N), String(N), String(N)], kurum: null, ogr: people.map((o, i) => {
    const n = [], dy = [], len = tur === 'T' ? K : T;
    for (let j = 0; j < len; j++) { const h = hash(i, w, j, 1), max = [40, 5, 5, 5, 5, 5, 30, 10, 7, 7, 6, 24, 10, 6, 11, 11, 12, 6, 6, 30, 10, 14, 13, 13][j], d = (j === 5 || j === 18) ? 0 : h % (max + 1), y = (j === 5 || j === 18) ? 0 : (h >>> 6) % (max - d + 1); n.push(d - y / 4); dy.push(d + '/' + y) }
    return { no: String(o.no), ad: o.ad, snf: (i < 30 ? '301 12/A' : '302 12/B'), n, dy, p: [250, 260, 240, 230], r: ['1 1 1 100', '1 1 1 100', '1 1 1 100', '1 1 1 100'] } }) });
  const t = make('T'); t.ad += ' TYT'; if (w % 2) return [t]; const a = make('F'); a.ad += ' TYT AYT'; return [t, a];
}
let passed = 0;
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name) } catch (e) { console.error('FAIL', name, e); process.exitCode = 1 } }
(async () => {
  const { sandbox, run } = load();
  sandbox.people = people;
  run("D=varsayilan();D.rol='rehber';D.kurum='Sentetik Lisesi';D.ogr=people;kaydet=async()=>true;");
  const K = run('SIRALAMA.TYT_KEYS.length'), T = K + run('SIRALAMA.AYT_KEYS.length');
  sandbox.allStudy = Array.from({ length: W }, (_, w) => study(w)).flat();
  sandbox.studySources = Array.from({ length: W }, (_, w) => ({ bas: BASE + w * 7, bit: BASE + w * 7 + 4, n: N * 2, ts: 1790000000000 + w }));
  sandbox.allLists = Array.from({ length: W }, (_, w) => lists(w, K, T));
  run("D.etut=ETUT.paketle(allStudy,studySources,1790000000035);const r={surum:1,sinavlar:[],tercih:{}};allLists.forEach(ls=>ls.forEach(l=>SIRALAMA.ekle(r,l)));D.siralama=r;");
  const SA = ['09.00', '10.00'], plan = {};
  for (const [c, kod] of [['12/A', '301'], ['12/B', '302']]) plan[c] = { kod, ts: 1, saatler: SA, dersler: [[0, '09.00', 'MATEMATİK', 'SENTETİK ÖĞRETMEN 1'], [0, '10.00', 'TÜRK DİLİ VE EDEBİYATI', 'SENTETİK ÖĞRETMEN 2']] };
  run(`(()=>{const p=ETUTPLANI.oku().plan;p.programlar=${JSON.stringify(plan)};D.etutPlani=ETUTPLANI.dogrula(JSON.parse(JSON.stringify(p)))})()`);

  await check('the student base copies the school lists once, not once per student', () => {
    run('__okuSay=0;{const o=SIRALAMA.oku;__okuAsil=o;SIRALAMA.oku=(...a)=>{__okuSay++;return o(...a)}}');
    try {
      const t = run('OGRENCI_RAPOR.temelOgrenciler()');
      assert.equal(t.students.length, N, 'every student');
      const n = run('__okuSay'); assert(n <= 3, 'SIRALAMA.oku called ' + n + ' times for ' + N + ' students');
    } finally { run('SIRALAMA.oku=__okuAsil'); }
  });
  await check('a combined TYT+AYT list: the TYT row carries TYT lessons and the AYT row AYT lessons (one student table, two sessions)', () => {
    const satir = JSON.parse(JSON.stringify(run('denemeListe(0)'))).filter(r => r.okulListe && /TYT AYT/.test(r.ad));
    assert.equal(satir.length, 4, 'two combined lists, two sessions each');
    for (const r of satir) {
      const kodlar = r.dersler.map(d => d.kod);
      if (r.oturum === 'TYT') { assert(kodlar.includes('turkce') && !kodlar.includes('edebiyat'), JSON.stringify(kodlar)); assert.equal(r.dersler.find(d => d.kod === 'turkce').soru, 40) }
      else { assert(kodlar.includes('edebiyat') && !kodlar.includes('turkce'), JSON.stringify(kodlar)); assert.equal(r.dersler.find(d => d.kod === 'edebiyat').soru, 24) }
    }
  });
  await check('etüt rows (no school number) reach the student of that name and class; the same name in two classes stays two students', () => {
    const t = JSON.parse(JSON.stringify(run('OGRENCI_RAPOR.temelOgrenciler()')));
    for (const [i, o] of people.entries()) {
      const s = t.students.find(x => String(x.no) === String(o.no)); assert(s, o.ad);
      const beklenen = sandbox.allStudy.filter(r => r.ad === o.ad && r.sinif === o.sube).length;
      assert.equal(s.sessions.length, beklenen, o.ad + ' ' + o.sube + ' (' + i + ')');
    }
    const ayni = t.students.filter(s => s.name === 'SENTETİK AYNI AD').map(s => [s.cls, s.sessions.length]).sort();
    assert.deepEqual(ayni.map(x => x[0]), ['12/A', '12/B']); assert(ayni.every(x => x[1] === 2 * W), JSON.stringify(ayni));
  });
  await check('Öğretmen raporu over the whole school builds the student base once', () => {
    run("__temelSay=0;{const f=OGRENCI_RAPOR.temelOgrenciler;__temelAsil=f;OGRENCI_RAPOR.temelOgrenciler=(...a)=>{__temelSay++;return f(...a)}};EK.sekme='ogretmenrapor';EK.ogrHoca=undefined");
    try {
      const h = run('OGRETMEN_RAPOR.gorunum()');
      assert.equal((h.match(/<section class="ogr-ogretmen"/g) || []).length, 2);
      assert((h.match(/<section class="et-panel ogr-blok"/g) || []).length >= 3, 'blocks for both teachers');
      assert.equal(run('__temelSay'), 1);
      assert.match(h, /etüt katılımı/);
    } finally { run('OGRENCI_RAPOR.temelOgrenciler=__temelAsil'); }
  });
  console.log(passed + ' school-sized checks passed');
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1) });
