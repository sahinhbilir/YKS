#!/usr/bin/env node
'use strict';
// Öğretmen raporu: teachers from the timetables, a teacher's classes taken together (never class by class, never a student),
// the subject's mean net against the Türkiye average, the topic grid against Türkiye on the same questions (hand-worked d, b,
// gap and z), the run of three, the colours, the teacher's own etüts (each counted once), the page (formulas, raw numbers,
// no ranking, no student or class figures), and teacher-only access. Synthetic school and students only ('SENTETİK …').
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const F = require('./konutakibi-fixtures.cjs');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,TextDecoder,DecompressionStream,DOMParser:F.DOMParserShim,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const put = (name, value) => sandbox[name] = JSON.parse(JSON.stringify(value));
const get = code => JSON.parse(JSON.stringify(run(code)));
sandbox.__kaynak = run('ANALIZ.kaynak'); sandbox.__temel = run('OGRENCI_RAPOR.temelOgrenciler'); sandbox.__okuAsil = null; sandbox.__farkAsil = null; sandbox.__say = null;
const reset = () => run(`D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='ogretmenrapor';EK.ogrHoca=undefined;ANALIZ.kaynak=__kaynak;OGRENCI_RAPOR.temelOgrenciler=__temel;kaydet=async()=>true`);
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-6, (msg || '') + ' ' + a + ' != ' + b);
let passed = 0;
async function check(name, fn) { reset(); try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

// Timetables: two 12th-grade classes and a 9th grade; Beden eğitimi has no exam subject.
const SA = ['09.00', '10.00'];
const PLAN = { '12/A': { kod: '301', ts: 1, saatler: SA, dersler: [[0, '09.00', 'TYT MATEMATİK', 'SENTETİK ÖĞRETMEN AY'], [0, '10.00', 'TÜRK DİLİ VE EDEBİYATI', 'SENTETİK ÖĞRETMEN DE'], [1, '09.00', 'BEDEN EĞİTİMİ', 'SENTETİK ÖĞRETMEN SPOR']] },
  '12/B': { kod: '201', ts: 1, saatler: SA, dersler: [[0, '09.00', 'MATEMATİK', 'SENTETİK ÖĞRETMEN AY'], [0, '10.00', 'TÜRK DİLİ VE EDEBİYATI', 'SENTETİK ÖĞRETMEN DE']] },
  '9/C': { kod: '105', ts: 1, saatler: SA, dersler: [[2, '09.00', 'MATEMATİK', 'SENTETİK ÖĞRETMEN AY']] } };
const planKur = () => run(`(()=>{const p=ETUTPLANI.oku().plan;p.programlar=${JSON.stringify(PLAN)};D.etutPlani=ETUTPLANI.dogrula(JSON.parse(JSON.stringify(p)))})()`);
// Konu Takibi: three TYT exams; students SENTETİK ADA and BORA in 12/A, CEMRE in 12/B. Türkçe questions: T.12.1.1 ×2 (Türkiye p .5, .5)
// and T.12.1.2 ×2 (p .9, .9) are Sözcükte Anlam; T.12.3.1 ×2 (p .2, .2) is Cümlede Anlam (the built-in kazanım map).
const A = { name: 'SENTETİK ADA', no: '1001', cls: '301 12/A' }, B = { name: 'SENTETİK BORA', no: '1002', cls: '301 12/A' }, C = { name: 'SENTETİK CEMRE', no: '1003', cls: '201 12/B' };
const satirlar = (s11, s12, s31) => [F.row('T.12.1.1', 'a', [2, s11, 2 - s11, 0]), F.row('T.12.1.2', 'b', [2, s12, 2 - s12, 0]), F.row('T.12.3.1', 'c', [2, s31, 2 - s31, 0])];
const konuKur = () => {
  const kt = run('KONU_TAKIBI'), reps = [], parts = [];
  for (const e of [1, 2, 3]) {
    const ad = 'SENTETİK-KONU-' + e;
    reps.push({ ad, blocks: [F.block(satirlar(0, 1, 2), 'outcome', 'TÜRKÇE-T', A), F.block(satirlar(0, 0, 1), 'outcome', 'TÜRKÇE-T', B), F.block(satirlar(0, 0, 0), 'outcome', 'TÜRKÇE-T', C)] });
    parts.push({ tur: 'ozet', ad, oturum: 'TYT', dersler: { 'TÜRKÇE-T': [['T.12.1.1'], ['T.12.1.1'], ['T.12.1.2'], ['T.12.1.2'], ['T.12.3.1'], ['T.12.3.1']] } },
      { tur: 'turkiye', ad, oturum: 'TYT', dersler: { 'TÜRKÇE-T': [.5, .5, .9, .9, .2, .2] } });
  }
  const v = kt.merge(kt.blank(), reps, parts); v.exams.forEach((x, i) => x.date = '2026-10-0' + (i + 1)); put('KV', v); run('D.konutakibi=KV');
};
// The school's lists, as ANALIZ.kaynak gives them: two exams; 12/A students 1001 (MAT 20, 22), 1002 (MAT 10, blank), 12/B 1003 (MAT 30, 30).
const kaynakKur = () => run(`(()=>{const kisi=new Map([['1001',{no:'1001',ad:'SENTETİK ADA',sinif:'12/A'}],['1002',{no:'1002',ad:'SENTETİK BORA',sinif:'12/A'}],['1003',{no:'1003',ad:'SENTETİK CEMRE',sinif:'12/B'}]]);
  const o=(no,mat,tur)=>({no,net:{MAT:mat,TÜR:tur}});
  const sinavlar=[{id:'s1',ad:'27-YKS-1201',g:gunNo('2026-10-01'),tyt:{1001:o('1001',20,30),1002:o('1002',10,20),1003:o('1003',30,35)},ayt:{}},
    {id:'s2',ad:'27-YKS-1202',g:gunNo('2026-10-15'),tyt:{1001:o('1001',22,31),1002:o('1002',null,22),1003:o('1003',30,36)},ayt:{}}];
  const tr={'27-YKS-1201':{'MATEMATİK-T':12,'TÜRKÇE-T':24},'27-YKS-1202':{'MATEMATİK-T':13,'TÜRKÇE-T':25}};
  K={t:{sinavlar,kisi},trFn:ad=>tr[ad]?{genel:k=>tr[ad][k]??null}:null};ANALIZ.kaynak=()=>K})()`);

(async () => {
  await check('teachers from the timetables: subjects, the classes of each, lessons without an exam subject left out', () => {
    planKur();
    const l = get('OGRETMEN_RAPOR.ogretmenler()');
    assert.deepEqual(l.map(o => [o.ad, o.dersler.map(d => [d.ad, d.siniflar, d.kodlar.map(k => k[2])])]), [
      ['SENTETİK ÖĞRETMEN AY', [['Matematik', ['9/C', '12/A', '12/B'], ['MATEMATİK-T', 'MATEMATİK-A']]]],
      ['SENTETİK ÖĞRETMEN DE', [['Türk dili ve edebiyatı', ['12/A', '12/B'], ['TÜRKÇE-T', 'TÜRK DİLİ VE EDB-A']]]]]);
    assert.equal(get("OGRETMEN_RAPOR.sinifK('301 12/A')"), '12/A'); assert.equal(get("OGRETMEN_RAPOR.sinifK('9-C')"), '9/C');
    run('delete D.etutPlani'); assert.deepEqual(get('OGRETMEN_RAPOR.ogretmenler()'), []);
  });
  await check('the subject’s mean net of the teacher’s classes together against the Türkiye average; a blank is not a 0; another class is not counted (hand-worked)', () => {
    kaynakKur();
    const s = get(`OGRETMEN_RAPOR.netSerisi(K,['12/A'],'TYT','MAT','MATEMATİK-T')`);
    // 1201: (20 + 10) / 2 = 15 against 12 → +3. 1202: BORA is blank → 22 alone against 13 → +9.
    assert.deepEqual(s.map(p => [p.ad, p.n, p.net, p.genel, p.fark]), [['27-YKS-1201', 2, 15, 12, 3], ['27-YKS-1202', 1, 22, 13, 9]]);
    const ab = get(`OGRETMEN_RAPOR.netSerisi(K,['12/A','12/B'],'TYT','MAT','MATEMATİK-T')`);
    assert.deepEqual(ab.map(p => [p.n, p.net]), [[3, 20], [2, 26]], 'both classes taken together, one figure');
    assert.deepEqual(get(`OGRETMEN_RAPOR.netSerisi(K,['11/A'],'TYT','MAT','MATEMATİK-T')`), []);
    run(`K.trFn=()=>null`); assert.deepEqual(get(`OGRETMEN_RAPOR.netSerisi(K,['12/A'],'TYT','MAT','MATEMATİK-T')`).map(p => [p.genel, p.fark]), [[null, null], [null, null]], 'no Türkiye list: no gap, never a guess');
  });
  await check('topic grid: correct answers against Türkiye on the same questions, gap in points, z with the design effect, three in a row (hand-worked)', () => {
    konuKur();
    const z = get(`OGRETMEN_RAPOR.konuIzgarasi(D.konutakibi,['12/A'],'TYT','TÜRKÇE-T')`);
    assert.equal(z.sinavlar.length, 3); assert.deepEqual(z.sinavlar.map(e => e.ogr), [2, 2, 2], 'ADA and BORA; CEMRE (12/B) is not counted');
    const r = ad => z.satir.find(x => x.ad === ad);
    // Sözcükte Anlam (4 questions, p .5 .5 .9 .9): ADA 0 + 1, BORA 0 + 0 = 1 correct; b = 2 · 2,8 = 5,6; n = 8 → 100 · (1 − 5,6) / 8 = −57,5 points.
    // Each student: p = 2,8 / 4 = ,7, n = 4 → 4 · ,7 · ,3 · (1 + 3 · ,2) = 1,344; Σ = 2,688 → z = −4,6 / √2,688 = −2,806 → behind.
    const s = r('Sözcükte Anlam'), c0 = s.hucre[0];
    assert.deepEqual([c0.d, c0.n], [1, 8]); near(c0.b, 5.6); near(c0.fark, -57.5); near(c0.z, -4.6 / Math.sqrt(2.688)); assert.equal(c0.durum, 'geride');
    assert.equal(s.seri, 'geride', 'behind on three measured exams in a row');
    // Cümlede Anlam (p .2 .2): ADA 2 + BORA 1 = 3 correct; b = 2 · ,4 = ,8 → 100 · 2,2 / 4 = +55; var = 2 · (2 · ,2 · ,8 · 1,2) = ,768 → z = 2,51 → ahead.
    const c = r('Cümlede Anlam'); near(c.hucre[0].fark, 55); near(c.hucre[0].z, 2.2 / Math.sqrt(0.768)); assert.equal(c.hucre[0].durum, 'onde'); assert.equal(c.seri, 'onde');
    // Rows: most behind first. The exam column carries the whole topic set's gap: (4 − (5,6 + ,8)) / 12 = −20 points.
    assert.deepEqual(z.satir.map(x => x.ad), ['Sözcükte Anlam', 'Cümlede Anlam']); near(z.sinavlar[0].fark, -20);
    // Its z adds the two topics' variances: −2,4 / √(2,688 + ,768) = −1,29, within chance.
    near(z.sinavlar[0].z, -2.4 / Math.sqrt(3.456)); assert.equal(z.sinavlar[0].durum, 'belirsiz');
    // A topic within chance: one point fewer than expected over the three students of 12/A + 12/B is not marked.
    const ab = get(`OGRETMEN_RAPOR.konuIzgarasi(D.konutakibi,['12/A','12/B'],'TYT','TÜRKÇE-T')`); assert.deepEqual(ab.sinavlar.map(e => e.ogr), [3, 3, 3]);
    // 12/B alone: CEMRE has no correct answer anywhere.
    const b = get(`OGRETMEN_RAPOR.konuIzgarasi(D.konutakibi,['12/B'],'TYT','TÜRKÇE-T')`); assert.deepEqual(b.sinavlar.map(e => e.ogr), [1, 1, 1]);
    assert.equal(get(`OGRETMEN_RAPOR.konuIzgarasi(D.konutakibi,['12/A'],'TYT','MATEMATİK-T')`), null, 'no Matematik in Konu Takibi');
    assert.equal(get(`OGRETMEN_RAPOR.konuIzgarasi(null,['12/A'],'TYT','TÜRKÇE-T')`), null);
  });
  await check('colours: red behind, green ahead, deeper with the gap (full at ±20 points), pale within chance, white text on the deepest', () => {
    const c = (fark, durum) => run(`OGRETMEN_RAPOR.hucreRengi({fark:${fark},durum:'${durum}'})`);
    assert.equal(c(-20, 'geride'), 'background:color-mix(in srgb,var(--kritik) 85%,transparent);color:#fff');
    assert.equal(c(10, 'onde'), 'background:color-mix(in srgb,var(--iyi) 55%,transparent)');
    assert.equal(c(-40, 'geride'), c(-20, 'geride'), 'capped at 20 points');
    assert.equal(c(-10, 'belirsiz'), 'background:color-mix(in srgb,var(--kritik) 21%,transparent)', 'within chance: pale');
    assert.equal(run('OGRETMEN_RAPOR.hucreRengi(null)'), '');
    assert.deepEqual(get('OGRETMEN_RAPOR.olc({d:2,b:2,n:4,v:0})'), { fark: 0, z: null, durum: 'belirsiz' });
  });
  await check('TYT / AYT from the timetable, class by class: a lesson that names its session is that session alone, an unmarked one takes the rest; Türkçe beside Edebiyat (EA); mixed lessons are both', () => {
    const PL = { '12/C': { kod: '303', ts: 1, saatler: SA, dersler: [[0, '09.00', 'TYT MATEMATİK', 'SENTETİK ÖĞRETMEN TE'], [0, '10.00', 'AYT MATEMATİK', 'SENTETİK ÖĞRETMEN AY'], [1, '09.00', 'GEOMETRİ', 'SENTETİK ÖĞRETMEN GE'], [1, '10.00', 'TÜRK DİLİ VE EDEBİYATI', 'SENTETİK ÖĞRETMEN ED']] },
      '11/A': { kod: '201', ts: 1, saatler: SA, dersler: [[0, '09.00', 'TÜRKÇE', 'SENTETİK ÖĞRETMEN TU'], [0, '10.00', 'TÜRK DİLİ VE EDEBİYATI', 'SENTETİK ÖĞRETMEN ED'], [1, '09.00', 'MATEMATİK', 'SENTETİK ÖĞRETMEN TE']] } };
    run(`(()=>{const p=ETUTPLANI.oku().plan;p.programlar=${JSON.stringify(PL)};D.etutPlani=ETUTPLANI.dogrula(JSON.parse(JSON.stringify(p)))})()`);
    const l = get('OGRETMEN_RAPOR.ogretmenler()'), o = ad => l.find(x => x.ad === 'SENTETİK ÖĞRETMEN ' + ad).dersler.map(d => [d.ad, d.kodSinif]);
    assert.deepEqual(o('TE'), [['Matematik', { 'MATEMATİK-T': ['11/A', '12/C'], 'MATEMATİK-A': ['11/A'] }]], 'TYT Matematik in 12/C; 11/A’s unmarked Matematik is both');
    assert.deepEqual(o('AY'), [['Matematik', { 'MATEMATİK-A': ['12/C'] }]], 'AYT Matematik: a second teacher, AYT only');
    assert.deepEqual(o('GE'), [['Geometri', { 'GEOMETRİ-T': ['12/C'], 'GEOMETRİ-A': ['12/C'] }]], 'Geometri is TYT and AYT');
    assert.deepEqual(o('TU'), [['Türkçe', { 'TÜRKÇE-T': ['11/A'] }]]);
    assert.deepEqual(o('ED'), [['Türk dili ve edebiyatı', { 'TÜRKÇE-T': ['12/C'], 'TÜRK DİLİ VE EDB-A': ['11/A', '12/C'] }]], 'beside Türkçe (11/A) Türk dili ve edebiyatı is AYT Edebiyat; alone (12/C) both');
    // The page says which session a one-session subject is.
    kaynakKur(); run(`D.ogr=[];EK.ogrHoca=undefined;EK.ogrDuzey=undefined`); const h = run('OGRETMEN_RAPOR.gorunum()');
    assert.match(h, /<h2>Sentetik Öğretmen Ay<\/h2><p class="mini">Matematik \(AYT\) · 12\/C<\/p>/);
    assert.match(h, /<h2>Sentetik Öğretmen Ge<\/h2><p class="mini">Geometri · 12\/C<\/p>/);
  });
  await check('Sınıf düzeyi: one grade’s teachers, classes and blocks only', () => {
    planKur(); kaynakKur(); konuKur(); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:[]})');
    let h = run('OGRETMEN_RAPOR.gorunum()');
    assert.match(h, /<select id="ogrDuzey"><option value="">Bütün düzeyler<\/option><option value="12">12\. sınıf<\/option><option value="9">9\. sınıf<\/option><\/select>/);
    run('EK.ogrDuzey=12'); h = run('OGRETMEN_RAPOR.gorunum()');
    assert.match(h, /<h1 class="et-baslik">Öğretmen raporu · 12\. sınıf<\/h1>/); assert.match(h, /<option value="12" selected>/);
    assert.match(h, /<h2>Sentetik Öğretmen Ay<\/h2><p class="mini">Matematik · 12\/A, 12\/B<\/p>/, 'the 9th grade is not listed');
    run('EK.ogrDuzey=9'); h = run('OGRETMEN_RAPOR.gorunum()');
    assert.equal((h.match(/<section class="ogr-ogretmen"/g) || []).length, 1, 'only the teacher of the 9th grade'); assert.match(h, /<h2>Sentetik Öğretmen Ay<\/h2><p class="mini">Matematik · 9\/C<\/p>/);
    assert.match(h, /Bütün öğretmenler \(1\)/); assert.match(h, /henüz deneme ya da konu verisi yok/);
    run('EK.ogrDuzey=undefined');
  });
  await check('the chart writes every value (a printout has no tooltips); the headline says how the gap moved; the grid’s first → last column', () => {
    kaynakKur();
    const seri = get(`OGRETMEN_RAPOR.netSerisi(K,['12/A','12/B'],'TYT','MAT','MATEMATİK-T')`);
    run(`OGRETMEN_RAPOR.netSerisi(K,['12/A','12/B','12/C'],'TYT','MAT','MATEMATİK-T',__g=new Set())`); assert.deepEqual(get('[...__g].sort()'), ['12/A', '12/B'], 'the classes that had a net');
    sandbox.__b = { seri, kod: 'MATEMATİK-T', dersAd: 'TYT Matematik' };
    const svg = run('OGRETMEN_RAPOR.netGrafigi(__b,720)'), t = [...svg.matchAll(/<text class="ogr-deger ([^"]*)"[^>]*>([^<]*)<\/text>/g)].map(m => [m[1], m[2]]);
    // Gaps +8 and +13; nets 20 and 26 against 12 and 13: all written, gap labels green.
    assert.deepEqual(t, [['ogr-y', '+8,0'], ['ogr-y', '+13,0'], ['ogr-deger-okul', '20,0'], ['ogr-deger-tr', '12,0'], ['ogr-deger-okul', '26,0'], ['ogr-deger-tr', '13,0']]);
    assert.match(svg, /Türkiye’ye göre fark \(net\)/); assert.match(svg, /<rect class="ogr-cubuk ogr-cubuk-ust"/); assert.match(svg, /<line class="ogr-sifir"/);
    // The gap panel's scale is the gaps' own: 0 to 13 + 22 % of 13, not 0 to the nets.
    const yuk = [...svg.matchAll(/<rect class="ogr-cubuk[^"]*" x="[^"]*" y="([^"]*)" width="[^"]*" height="([^"]*)"/g)].map(m => +m[2]);
    assert(Math.abs(yuk[0] / yuk[1] - 8 / 13) < 0.005, 'bars in proportion to the gaps (heights rounded to 0,1 px)');
    planKur(); konuKur(); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:[]})'); const h = run('OGRETMEN_RAPOR.gorunum()');
    // 1201: +8 → 1202: +13: five nets better than the exam before.
    assert.match(h, /<span class="ogr-degisim"><b class="ogr-y">▲ \+5,0<\/b> önceki denemeye göre<\/span>/);
    assert.match(h, /<th scope="col" class="ogr-iz-degisim"[^>]*>İlk → son<\/th>/);
    // The synthetic topics answer alike in every exam: no change.
    assert.match(h, /<td class="ogr-iz-degisim ogr-sabit"[^>]*>■ 0<\/td>/);
  });
  await check('the teacher’s own etüts: attendances and students once per session; their gap to Türkiye before the first etüt and on the latest exam (hand-worked)', () => {
    kaynakKur();
    put('OG', [{ no: '1001', name: 'SENTETİK ADA', cls: '12/A', sessions: [{ date: '2026-10-05', course: 'MATEMATİK TYT', teacher: 'SENTETİK ÖĞRETMEN AY' }, { date: '2026-10-08', course: 'MATEMATİK TYT', teacher: 'Sentetik Öğretmen Ay' }, { date: '2026-10-09', course: 'AYT MATEMATİK', teacher: 'SENTETİK ÖĞRETMEN AY' }],
        exams: [{ exam: '27-YKS-1201', date: '2026-10-01', session: 'TYT', nets: { mat: 20 } }, { exam: '27-YKS-1202', date: '2026-10-15', session: 'TYT', nets: { mat: 22 } }] },
      { no: '1002', name: 'SENTETİK BORA', cls: '12/A', sessions: [{ date: '2026-10-20', course: 'MATEMATİK', teacher: 'SENTETİK ÖĞRETMEN AY' }, { date: '2026-10-21', course: 'FİZİK', teacher: 'SENTETİK ÖĞRETMEN AY' }],
        exams: [{ exam: '27-YKS-1201', date: '2026-10-01', session: 'TYT', nets: { mat: 10 } }] },
      { no: '1009', name: 'SENTETİK CAN', cls: '11/B', sessions: [{ date: '2026-10-20', course: 'MATEMATİK', teacher: 'SENTETİK ÖĞRETMEN AY' }], exams: [] }]);
    run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:OG})');
    const d = '{ad:"Matematik"}';
    const t = get(`OGRETMEN_RAPOR.etutOzeti(${JSON.stringify(run("'SENTETİK ÖĞRETMEN AY'.toLocaleUpperCase('tr-TR').normalize('NFD').replace(/\\p{M}/gu,'')"))},${d},'TYT','MATEMATİK-T',K.trFn)`);
    // ADA: 2 TYT etüts (the name in any spelling), BORA 1 (no session named: counted in TYT and in AYT). Fizik is another subject.
    // CAN (11/B) counts for every grade but not in the 12th grade's block. ADA: 1201 (before her first etüt) 20 − 12 = +8 → 1202
    // 22 − 13 = +9. BORA has no exam after his etüt: not measured.
    const hk = JSON.stringify(run("'SENTETİK ÖĞRETMEN AY'.toLocaleUpperCase('tr-TR').normalize('NFD').replace(/\\p{M}/gu,'')"));
    assert.deepEqual(get(`OGRETMEN_RAPOR.etutOzeti(${hk},${d},'TYT','MATEMATİK-T',K.trFn,undefined,12)`), { etut: 3, ogrenci: 2, olculen: 1, once: 8, sonra: 9, ayrilmamis: 1 });
    assert.deepEqual([t.etut, t.ogrenci], [4, 3], 'no grade given: CAN too');
    const a = get(`OGRETMEN_RAPOR.etutOzeti(${hk},${d},'AYT','MATEMATİK-A',K.trFn,undefined,12)`);
    assert.deepEqual([a.etut, a.ogrenci, a.olculen, a.ayrilmamis], [2, 2, 0, 1], 'AYT: ADA’s AYT etüt and BORA’s unnamed one');
  });
  await check('the page: one section per teacher, classes together, formulas and raw numbers, no student names, no class figures, no ranking; the teacher filter', () => {
    planKur(); kaynakKur(); konuKur(); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:[]})');
    let h = run('OGRETMEN_RAPOR.gorunum()');
    assert.match(h, /<h1 class="et-baslik">Öğretmen raporu<\/h1>/); assert.match(h, /Sınıflar ve öğrenciler birbiriyle karşılaştırılmaz/);
    assert.equal((h.match(/<section class="ogr-ogretmen"/g) || []).length, 2);
    assert.match(h, /<h2>Sentetik Öğretmen Ay<\/h2><p class="mini">Matematik · 9\/C, 12\/A, 12\/B<\/p>/);
    // AY: TYT Matematik for the 12th grade (12/A and 12/B together); the 9th grade has no data. DE: TYT Türkçe with the topic grid.
    assert.match(h, /TYT Matematik · 12\. sınıf/); assert(!/12\/A ·|12\/B ·/.test(h.replace(/<p class="mini">[^<]*<\/p>/g, '').replace(/<details[\s\S]*?<\/details>/g, '')), 'no figure per class');
    assert.match(h, /TYT Türkçe · 12\. sınıf/); assert.match(h, /<table class="ogr-iz">/); assert.match(h, /▼▼▼/); assert.match(h, /▲▲▲/);
    // Headline: the newest exam with a Türkiye average, 12/A and 12/B together: 1202 → (22 + 30) / 2 = 26 against 13 → +13.
    assert.match(h, /<span class="ogr-kpi-ad">Son deneme · Türkiye’ye göre<\/span><strong class="ogr-y">\+13,0<small> net<\/small><\/strong><span class="mini">27-YKS-1202 · 2 öğrenci<\/span>/);
    // Formulas in plain words and the raw numbers.
    assert.match(h, /<summary>Nasıl hesaplanır · ham veriler<\/summary>/); assert.match(h, /Fark = 100 · \(d − b\) \/ n puan/); assert.match(h, /z = \(d − b\) \/ √\(Σ n·p·\(1 − p\) · \(1 \+ \(soru − 1\) · 0,2\)\)/);
    assert.match(h, /<td>27-YKS-1201<\/td><td class="sayi">3<\/td><td class="sayi">20,00<\/td><td class="sayi">12,00<\/td><td class="sayi">\+8,00<\/td>/, 'raw exam row: n, mean, Türkiye, gap');
    // Raw topic row (12/A and 12/B together): Sözcükte Anlam, n = 3 · 4 = 12, d = 1, b = 3 · 2,8 = 8,4 → 100 · (1 − 8,4) / 12 = −61,7.
    // The topic table is built when its box opens: the page carries its place, the module its rows.
    const tr = h.match(/<details class="ogr-formul" data-ogr-ham="(\d+)">(?:(?!<\/details>)[\s\S])*<div class="ogr-ham-konu" data-ogr-ham-konu="\1"><\/div>/g) || [];
    assert.equal(tr.length, 1, 'one topic table to fill (TYT Türkçe)');
    const i = +tr[0].match(/data-ogr-ham="(\d+)"/)[1], ham = run(`OGRETMEN_RAPOR.hamKonu(OGRETMEN_RAPOR.bloklar()[${i}])`);
    assert.match(run(`OGRETMEN_RAPOR.bloklar()[${i}].dersAd`), /^TYT Türkçe$/);
    assert.match(ham, /<td>Sözcükte Anlam<\/td><td>SENTETİK-KONU-1<\/td><td class="sayi">12<\/td><td class="sayi">1<\/td><td class="sayi">8,40<\/td><td class="sayi">−61,7<\/td>/, 'raw topic row');
    assert(!h.includes('<td>Sözcükte Anlam</td>'), 'the topic rows are not in the page until opened');
    // Never a student's name, never a rank.
    for (const ad of ['SENTETİK ADA', 'SENTETİK BORA', 'SENTETİK CEMRE', 'Sentetik Ada']) assert(!h.includes(ad), ad);
    assert(!/sıra|Sıra|\d+\. sıra/.test(h.replace(/<select[\s\S]*?<\/select>/, '')), 'no ranking');
    // One teacher.
    run(`EK.ogrHoca=${JSON.stringify(get('OGRETMEN_RAPOR.ogretmenler()')[1].key)}`); h = run('OGRETMEN_RAPOR.gorunum()');
    assert.equal((h.match(/<section class="ogr-ogretmen"/g) || []).length, 1); assert.match(h, /<h2>Sentetik Öğretmen De<\/h2>/);
    // Empty: no timetables.
    run('delete D.etutPlani'); assert.match(run('OGRETMEN_RAPOR.gorunum()'), /<b>Ders programı yok<\/b>[\s\S]*data-sekme="etutplani"/);
  });
  await check('one page reads each source once, whatever the number of teachers and blocks (the page froze when every block rebuilt them)', () => {
    planKur(); kaynakKur(); konuKur();
    run(`__say={temel:0,oku:0,fark:0};OGRENCI_RAPOR.temelOgrenciler=()=>{__say.temel++;return {students:[]}};
      __okuAsil=__okuAsil||KONU_TAKIBI.oku;__farkAsil=__farkAsil||KONU_TAKIBI.ogrenciFark;
      KONU_TAKIBI.oku=(...a)=>{__say.oku++;return __okuAsil(...a)};KONU_TAKIBI.ogrenciFark=(...a)=>{__say.fark++;return __farkAsil(...a)}`);
    try {
      const h = run('OGRETMEN_RAPOR.gorunum()'); assert.equal((h.match(/<section class="et-panel ogr-blok"/g) || []).length, 2, 'two blocks');
      // One student base, one Konu Takibi read, one comparison per exam (three TYT exams), shared by every block.
      assert.deepEqual(get('__say'), { temel: 1, oku: 1, fark: 3 });
    } finally { run('KONU_TAKIBI.oku=__okuAsil;KONU_TAKIBI.ogrenciFark=__farkAsil'); }
  });
  await check('teacher only; the menu and the route; nothing is stored', () => {
    planKur(); kaynakKur(); konuKur(); const once = run('JSON.stringify(D)');
    run('OGRETMEN_RAPOR.gorunum()'); assert.equal(run('JSON.stringify(D)'), once, 'nothing written');
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='denemeler')[1]"), ['siralamalar', 'turkiye', 'konutakibi', 'ogretmenrapor', 'yanlislar', 'universite']);
    assert.equal(get("SEKME_REHBER.find(s=>s[0]==='ogretmenrapor')[1]"), 'Öğretmen raporu');
    run("D.rol='ogrenci'"); assert.match(run('OGRETMEN_RAPOR.gorunum()'), /Bu sayfa rehber öğretmen içindir/); assert(!get('SEKMELER().map(s=>s[0])').includes('ogretmenrapor'));
  });
  console.log(passed + ' Öğretmen raporu checks passed');
})();
