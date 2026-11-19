#!/usr/bin/env node
'use strict';
// Öğretmen raporu: teachers from the timetables, a teacher's classes taken together (never class by class, never a student),
// the subject's mean net against the Türkiye average, the topic grid against Türkiye on the same questions (hand-worked d, b,
// gap and z), the run of three, the colours, the page as a teacher reads it on paper (labelled headline boxes, reading notes,
// the source of the numbers; formulas and raw numbers folded; no ranking, no student or class figures, no etüts), and
// teacher-only access. Synthetic school and students only ('SENTETİK …').
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
sandbox.__agAsil = run('KONU_TAKIBI.agNet');
// The network's mean net comes from the Performans analizi (KONU_TAKIBI.agNet); the fixtures give it as the lists' Türkiye figure
// (K.trFn), so the page's figures are the same ones the hand-worked checks use. One check below uses the real agNet.
const reset = () => run(`D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='ogretmenrapor';EK.ogrHoca=undefined;ANALIZ.kaynak=__kaynak;OGRENCI_RAPOR.temelOgrenciler=__temel;kaydet=async()=>true;
  KONU_TAKIBI.agNet=(v,ad,kod)=>{const t=typeof K!=='undefined'&&K&&K.trFn?K.trFn(ad):null,g=t?t.genel(kod):null;return Number.isFinite(g)?g:null}`);
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
  await check('the list’s yardstick stays in the model, never estimated; the page shows the two nets, where the students stand, and the school’s İlk 100 place exam by exam with its move (hand-worked)', () => {
    kaynakKur();
    // MATEMATİK-T in 1201: the list's last row 18,5 net (Türkiye 12 → +6,5), 1st school 26; the school 40th. In 1202: last row 19 (+6), the school outside.
    // Then 1203 brings it back at 31st.
    run(`(()=>{const li={'27-YKS-1201':{n:100,ilk:{ad:'A',net:26},son:{ad:'B',net:18.5},sira:40},'27-YKS-1202':{n:100,ilk:{ad:'A',net:27},son:{ad:'B',net:19},sira:null}};
      const tr={'27-YKS-1201':{'MATEMATİK-T':12},'27-YKS-1202':{'MATEMATİK-T':13}};
      K.trFn=ad=>tr[ad]?{genel:k=>tr[ad][k]??null,dersListesi:k=>k==='MATEMATİK-T'&&li[ad]?{...li[ad],genel:tr[ad][k]}:null}:null})()`);
    const s = get(`OGRETMEN_RAPOR.netSerisi(K,['12/A'],'TYT','MAT','MATEMATİK-T')`);
    assert.deepEqual(s.map(p => [p.sinir, p.birinci, p.listeN, p.sira]), [[18.5, 26, 100, 40], [19, 27, 100, null]]);
    const b = { dersAd: 'TYT Matematik', duzey: 12, kod: 'MATEMATİK-T', siniflar: ['12/A'], seri: s, izgara: null };
    put('__B', b); const h = run('OGRETMEN_RAPOR.blokHtml(__B,0)'), svg = run('OGRETMEN_RAPOR.netGrafigi(__B,700)');
    const yazi = h.replace(/<[^>]+>/g, '');
    // The page keeps to two numbers and coloured words: the students' mean and the Türkiye average in the newest exam (nets);
    // where they stand, and the gap since the exam before (+3 → +9 net ahead: widening, good).
    assert.match(h, /<div class="ogr-skor"><div class="ogr-skor-sayi"><span>Öğrencileriniz<\/span><strong class="ogr-y">22,0<\/strong><\/div><div class="ogr-skor-sayi"><span>Türkiye<\/span><strong>13,0<\/strong><\/div><div class="ogr-skor-durum"><div class="ogr-rozetler"><b class="ogr-durum ogr-y">▲ Türkiye’nin üstünde<\/b><b class="ogr-durum ogr-egilim ogr-y">Fark açılıyor<\/b><b class="ogr-durum ogr-egilim ogr-sira-durum ogr-k">Sıralama düştü<\/b><\/div><span>27-YKS-1202<\/span><\/div><\/div>/);
    // The school's place in the İlk 100 list under each exam: 40th, then outside (▼ red).
    assert.deepEqual([...svg.matchAll(/<text class="ogr-tik ogr-sira([^"]*)"[^>]*>([^<]*)<\/text>/g)].map(m => [m[1].trim(), m[2]]), [['', '40.'], ['ogr-k', '▼ 100+']]);
    assert.deepEqual(s.map(p => p.soru), [30, 30], 'TYT Matematik: 30 questions (YKS), the lists print no blanks');
    // The list's yardstick and the gap boxes are not on the page (they stay in the model and the raw numbers).
    assert(!/İlk 100 sınırı|Fark nasıl|ogr-kutu/.test(h.slice(0, h.indexOf('<details'))), 'no yardstick, no difference box');
    assert(!svg.includes('ogr-sinir') && !/ilk 100/i.test(svg) && !svg.includes('ogr-cubuk'), 'one picture: two lines, no bars, no yardstick');
    // What the block covers: the classes and the number of exams.
    assert.match(h, /<p class="ogr-kapsam">12\/A · 2 deneme<\/p>/);
    assert(!/≈|tahmini|dilim|ilk %/.test(yazi + svg), 'nothing estimated');
    // Raw numbers: the nets, the Türkiye averages and the gaps.
    const ham = h.slice(h.indexOf('<table'));assert.match(ham, /<td>27-YKS-1201<\/td><td class="sayi">2<\/td><td class="sayi">15,00<\/td><td class="sayi">12,00<\/td><td class="sayi">\+3,00<\/td><\/tr>/);
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
    // The topic's kazanımlar, measured the same way (12/A, each exam): T.12.1.1 (p .5 .5) 0 correct of 4 against 2 → −50;
    // T.12.1.2 (p .9 .9) 1 of 4 against 3,6 → −65. Together they are the topic's own cell (−57,5).
    assert.deepEqual(s.alt.map(a => a.kod), ['T.12.1.1', 'T.12.1.2']); near(s.alt[0].hucre[0].fark, -50); near(s.alt[1].hucre[0].fark, -65); near(s.alt[1].ortFark, -65);
    assert.deepEqual(s.alt.map(a => [a.hucre[0].d, a.hucre[0].n]), [[0, 4], [1, 4]]); assert.equal(s.alt[0].degisim, 0);
    // On the page (12/A): a coloured square per exam and no number in it; the figures are in the square's tooltip. Sözcükte Anlam
    // −57,5 behind beyond chance: deep red; the whole subject −20 within chance: nearer the middle (orange); Cümlede Anlam +55: deep green.
    put('__Z', { dersAd: 'TYT Türkçe', duzey: 12, kod: 'TÜRKÇE-T', siniflar: ['12/A'], seri: [], izgara: z }); const zh = run('OGRETMEN_RAPOR.izgaraHtml(__Z)');
    assert.match(zh, /<tbody class="ogr-iz-grup"><tr><th scope="row" class="ogr-iz-konu">Sözcükte Anlam<\/th><td class="ogr-iz-h" title="Sözcükte Anlam · SENTETİK-KONU-1: öğrencileriniz %13, Türkiye %70"><i style="background:#a82022"><\/i><\/td>/);
    assert.match(zh, /<th scope="row" class="ogr-iz-konu">Cümlede Anlam<\/th><td class="ogr-iz-h" title="Cümlede Anlam · SENTETİK-KONU-1: öğrencileriniz %75, Türkiye %20"><i style="background:#1a764e"/);
    assert.match(zh, /<tr class="ogr-iz-toplam"><th scope="row" class="ogr-iz-konu">Bütün konular<\/th><td class="ogr-iz-h ogr-iz-soluk" title="SENTETİK-KONU-1 · bütün konular"><i style="background:#[0-9a-f]{6}"><\/i><\/td>/);
    assert.equal(run(`__Z.izgara.sinavlar[0].durum`), 'belirsiz');
    assert.equal(run(`OGRETMEN_RAPOR.hucreRengi(__Z.izgara.sinavlar[0])`), 'background:' + run(`GRAFIK_RENK.spektrum(Math.max(-1,Math.min(1,__Z.izgara.sinavlar[0].fark/20))*GRAFIK_RENK.SANS)`), 'within chance: nearer the middle of the spectrum (× 0,3)');
    const metin = zh.replace(/<[^>]+>/g, ' ');
    assert(!/[−+]\d|\d+ puan|Ortalama|İlk → son|Son 3 denemede|fark/i.test(metin), 'no number, no gap, no run label on the page');
    // Under the topic's row: a row per kazanım with its number and name, smaller squares, hidden until "Kazanımlar" is ticked.
    assert.match(zh, /<tbody class="ogr-iz-grup"><tr><th scope="row" class="ogr-iz-konu">Sözcükte Anlam[\s\S]*?<\/tr><tr class="ogr-iz-alt"><th scope="row" class="ogr-iz-konu"><span class="ogr-kod">T\.12\.1\.1<\/span>a<\/th><td class="ogr-iz-kh ogr-iz-soluk" title="T\.12\.1\.1 · SENTETİK-KONU-1: öğrencileriniz %0, Türkiye %50"><i style="background:[^"]*"><\/i><\/td>/);
    assert.match(zh, /<div class="ogr-konular ogr-iz-kazanimli"><div class="ogr-konu-bas"><h4 class="ogr-alt-baslik">Konular<\/h4><label class="ogr-iz-ac ogr-ekran"><input type="checkbox"> Kazanımlar<\/label><\/div>/);
    // The key: four squares from red to green between two words, and the empty square.
    assert.match(zh, /<div class="ogr-olcek"><span class="ogr-olcek-serit"><em>Türkiye’nin gerisinde<\/em><i class="ogr-spektrum" style="background:linear-gradient\(90deg,#a82022 0%,#cc3a30 20%,#ea8a5f 35%,#f2c86b 50%,#9ccf86 65%,#3e9e68 80%,#1a764e 100%\)"><\/i><em>Türkiye’nin önünde<\/em><\/span><span class="ogr-olcek-bos"><i><\/i>soru yok<\/span><\/div>/);
    put('__Z2', { dersAd: 'TYT Türkçe', duzey: 12, kod: 'TÜRKÇE-T', siniflar: ['12/A'], seri: [], izgara: { sinavlar: z.sinavlar, satir: z.satir.map((r, i) => i ? r : { ...r, alt: [], hucre: [null, ...r.hucre.slice(1)] }) } });
    assert.match(run('OGRETMEN_RAPOR.izgaraHtml(__Z2)'), /<td class="ogr-iz-h ogr-iz-bos" title="SENTETİK-KONU-1: soru yok"><\/td>/);
    // No kazanımlar: no toggle.
    put('__Z3', { siniflar: [], seri: [], izgara: { sinavlar: [{ ad: 'S', ogr: 1, fark: -.3, z: -.1, durum: 'belirsiz' }], satir: [{ ad: 'K', alt: [], hucre: [{ d: 1, b: 1.01, n: 3, fark: -.3, z: -.1, durum: 'belirsiz' }], seri: null, ortFark: -.3, olcum: 1, degisim: null }] } });
    assert(!run('OGRETMEN_RAPOR.izgaraHtml(__Z3)').includes('Kazanımlar'));
    // Rows: in the order taught (T.12.1 before T.12.3). The exam column carries the whole topic set's gap: (4 − (5,6 + ,8)) / 12 = −20 points.
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
  await check('topic rows in the şube’s own plan order (Müfredat), matched by shared words; an unmatched topic after the one before it in the codes; no plan: the codes', () => {
    planKur(); konuKur();
    const sira = () => get(`OGRETMEN_RAPOR.konuIzgarasi(D.konutakibi,['12/A'],'TYT','TÜRKÇE-T')`).satir.map(r => r.ad);
    assert.deepEqual(sira(), ['Sözcükte Anlam', 'Cümlede Anlam'], 'no plan: the kazanım codes');
    // 12/A is şube 301 in the timetables; its plan teaches "Cümlede Anlam ve Anlatım" first, "Sözcükte Anlam" two weeks later.
    run(`D.konuPlani={'301':[{'Türkçe':['Cümlede Anlam ve Anlatım'],'Matematik TYT':['Sayılar']},{'Türkçe':['Ses Bilgisi']},{'Türkçe':['Sözcükte Anlam']}]}`);
    assert.deepEqual(sira(), ['Cümlede Anlam', 'Sözcükte Anlam'], 'the plan’s order');
    // A topic the plan does not name stays after the topic before it in the codes (here: first, nothing comes before it).
    run(`D.konuPlani={'301':[{'Türkçe':['Cümlede Anlam ve Anlatım','Genel Tekrar']}]}`);
    assert.deepEqual(sira(), ['Sözcükte Anlam', 'Cümlede Anlam']);
    // Another şube's plan, or another lesson's, does not count.
    run(`D.konuPlani={'201':[{'Türkçe':['Cümlede Anlam ve Anlatım','Sözcükte Anlam']}],'301':[{'Geometri':['Cümlede Anlam']}]}`);
    assert.deepEqual(sira(), ['Sözcükte Anlam', 'Cümlede Anlam']);
    run('D.konuPlani={}');
  });
  await check('the page’s Türkiye is the publisher’s whole network, from the same Performans analizi as the squares: Σ (p − w / 4); no file, no Türkiye value', () => {
    planKur(); kaynakKur(); konuKur(); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:[]})');
    run('KONU_TAKIBI.agNet=__agAsil');
    // 27-YKS-1202, TYT Matematik, 30 questions: every p .5, every wrong share .2 → 30 · (.5 − .05) = 13,5. 27-YKS-1201 has no file.
    run(`D.konutakibi.zorluk=D.konutakibi.zorluk||{};D.konutakibi.zorluk[KONU_TAKIBI.ek('27-YKS-1202')]={ad:'27-YKS-1202',oturum:'TYT',ogrenci:null,ts:1,ozet:null,madde:null,turkiye:{'MATEMATİK-T':Array(30).fill(.5)},turkiyeY:{'MATEMATİK-T':Array(30).fill(.2)}}`);
    const o = get(`(()=>{const t=OGRETMEN_RAPOR.ogretmenler().find(x=>x.ad.endsWith('AY'));return OGRETMEN_RAPOR.ogretmenModeli(t).bloklar.find(b=>b.kod==='MATEMATİK-T').seri})()`);
    assert.deepEqual(o.map(p => [p.ad, p.genel === null ? null : Math.round(p.genel * 1e6) / 1e6, p.ilk100]), [['27-YKS-1201', null, 12], ['27-YKS-1202', 13.5, 13]]);
    near(o[1].fark, 26 - 13.5);
    // The file read before the wrong shares were kept: no Türkiye value.
    run(`delete D.konutakibi.zorluk[KONU_TAKIBI.ek('27-YKS-1202')].turkiyeY`);
    assert.equal(get(`(()=>{const t=OGRETMEN_RAPOR.ogretmenler().find(x=>x.ad.endsWith('AY'));return OGRETMEN_RAPOR.ogretmenModeli(t).bloklar.find(b=>b.kod==='MATEMATİK-T').seri[1].genel})()`), null);
  });
  await check('the school’s İlk 100 place: under each exam with an arrow against the exam before, and “Sıralama yükseldi / düştü / aynı” beside where the students stand; never on a student’s sheet', () => {
    const p = (ad, sira, fark = 1) => ({ ad, g: 1, n: 1, soru: 30, net: 10 + fark, genel: 10, fark, sira, listeN: 100 });
    const h = seri => { put('__S', { dersAd: 'TYT Matematik', duzey: 12, kod: 'MATEMATİK-T', siniflar: ['12/A'], seri, izgara: null }); return run('OGRETMEN_RAPOR.blokHtml(__S,0)') };
    const rozet = x => (x.match(/ogr-sira-durum ([^"]*)">([^<]*)</) || []).slice(1);
    assert.deepEqual(rozet(h([p('A', 40), p('B', 31)])), ['ogr-y', 'Sıralama yükseldi']);
    assert.deepEqual(rozet(h([p('A', 31), p('B', null)])), ['ogr-k', 'Sıralama düştü'], 'outside the list counts as 101st');
    assert.deepEqual(rozet(h([p('A', 31), p('B', 31)])), ['ogr-sabit', 'Sıralama aynı']);
    assert.deepEqual(rozet(h([p('A', null), p('B', null)])), [], 'outside both times: nothing');
    assert.deepEqual(rozet(h([p('A', undefined), p('B', undefined)])), [], 'no school followed: nothing');
    // An exam without a Türkiye value still shows the place.
    assert.deepEqual(rozet(h([{ ...p('A', 40), genel: null, fark: null }, { ...p('B', 31), genel: null, fark: null }])), ['ogr-y', 'Sıralama yükseldi']);
    put('__S2', { dersAd: 'TYT Matematik', kod: 'MATEMATİK-T', seri: [p('A', 40), p('B', 31)], izgara: null, y: get('({ogrenci:true,biz:"Netin",bizK:"sen"})') });
    assert(!/Sıralama|ogr-sira/.test(run('OGRETMEN_RAPOR.blokHtml(__S2,0)') + run('OGRETMEN_RAPOR.netGrafigi(__S2,700)')), 'a student’s sheet has no school place');
  });
  await check('topic grid columns in date order: an exam with no date of its own takes the one the school lists give it; no date anywhere goes last', () => {
    // Most karneler print no date. Sorted by '' they all came before the one dated exam, and by name an AYT exam named
    // "27_AYT_…" came before "27-YKS-…" even though it was the newest.
    const kt = run('KONU_TAKIBI'), reps = [], parts = [], adlar = ['27_AYT_ÖZEL_1', 'SENTETİK-TARİHSİZ', '27-YKS-1203', '27-YKS-1201'];
    for (const ad of adlar) {
      reps.push({ ad, blocks: [F.block(satirlar(1, 1, 1), 'outcome', 'TÜRKÇE-T', A)] });
      parts.push({ tur: 'ozet', ad, oturum: 'TYT', dersler: { 'TÜRKÇE-T': [['T.12.1.1'], ['T.12.1.1'], ['T.12.1.2'], ['T.12.1.2'], ['T.12.3.1'], ['T.12.3.1']] } },
        { tur: 'turkiye', ad, oturum: 'TYT', dersler: { 'TÜRKÇE-T': [.5, .5, .9, .9, .2, .2] } });
    }
    const v = kt.merge(kt.blank(), reps, parts); v.exams.forEach(x => x.date = x.ad === '27-YKS-1203' ? '2026-10-24' : null); put('KV3', v);
    run(`__sirAsil=SIRALAMA.oku;SIRALAMA.oku=()=>({veri:{sinavlar:[{ad:'27-YKS-1201',F:{tarih:'25.09.2026'}},{ad:'27-YKS-1203',F:{tarih:'30.10.2026'}},{ad:'27_AYT_ÖZEL_1',F:{tarih:'11.11.2026'}}]}})`);
    try {
      const z = get(`OGRETMEN_RAPOR.konuIzgarasi(KV3,['12/A'],'TYT','TÜRKÇE-T')`);
      assert.deepEqual(z.sinavlar.map(e => e.ad), ['27-YKS-1201', '27-YKS-1203', '27_AYT_ÖZEL_1', 'SENTETİK-TARİHSİZ']);
      assert.deepEqual(z.sinavlar.map(e => e.g), [get("gunNo('2026-09-25')"), get("gunNo('2026-10-24')"), get("gunNo('2026-11-11')"), null], 'Konu Takibi’s own date wins over the lists');
    } finally { run('SIRALAMA.oku=__sirAsil'); }
  });
  await check('topic rows in the order taught: by the earliest kazanım code (grade, unit, topic), not by the gap; kazanım rows the same; the student’s snapshot keeps it', () => {
    // Geometri: Cümlede-style mix of grades given out of order and with the largest gap on the latest-taught topic. Each code's own
    // number decides: 9.4.1 < 9.4.3 < 10.5.1 < 11.5.2; a kazanım with no topic (ZZ.10.2.1) sits by its number too.
    const kt = run('KONU_TAKIBI'), ad = 'SENTETİK-GEO-1', K = ['E.GEO.11.5.2', 'E.GEO.9.4.3.2', 'E.GEO.10.5.1', 'E.GEO.9.4.3.1', 'E.GEO.9.4.1', 'ZZ.10.2.1'];
    const v = kt.merge(kt.blank(), [{ ad, blocks: [F.block(K.map((k, i) => F.row(k, 'k' + i, [1, i % 2, 1 - i % 2, 0])), 'outcome', 'GEOMETRİ-T', A)] }],
      [{ tur: 'ozet', ad, oturum: 'TYT', dersler: { 'GEOMETRİ-T': K.map(k => [k]) } }, { tur: 'turkiye', ad, oturum: 'TYT', dersler: { 'GEOMETRİ-T': K.map(() => .5) } }]);
    v.exams.forEach(x => x.date = '2026-10-01'); put('KV4', v);
    const z = get(`OGRETMEN_RAPOR.konuIzgarasi(KV4,['12/A'],'TYT','GEOMETRİ-T')`);
    assert.deepEqual(z.satir.map(r => r.ad), ['Üçgenlerde Temel Kavramlar', 'Üçgenin Yardımcı Elemanları', 'k5', 'Çokgenler', 'Çemberde Açılar']);
    assert.deepEqual(z.satir[1].alt.map(a => a.kod), ['E.GEO.9.4.3.1', 'E.GEO.9.4.3.2']);
    // The student's own page: the rows come back in the same order, whatever their gaps.
    put('__OZ', { v: 1, sinif: '12/A', b: [{ k: 'GEOMETRİ-T', o: 'TYT', s: [], z: { e: [[ad, null]], r: [['C', [[0, .5, 1]], []], ['A', [[1, .5, 1]], []], ['B', [[0, .5, 1]], []]] } }] });
    assert.deepEqual(get('OGRETMEN_RAPOR.kiyasAc(__OZ)[0].izgara.satir.map(r=>r.ad)'), ['C', 'A', 'B']);
  });
  await check('a kazanım without a topic is a row under its own name: no question and no exam is dropped; every grade’s codes and the publisher’s AYT Edebiyat codes have a topic', () => {
    // One exam, ADA (12/A): Sözcükte Anlam ×2 (p .5, .5; 1 correct) and a code outside every map ×1 (p .4; correct).
    const kt = run('KONU_TAKIBI'), ad = 'SENTETİK-KONU-9';
    const v = kt.merge(kt.blank(), [{ ad, blocks: [F.block([F.row('T.12.1.1', 'a', [2, 1, 1, 0]), F.row('ZZ.11.1.1', 'Sentetik kazanımı uygular', [1, 1, 0, 0])], 'outcome', 'TÜRKÇE-T', A)] }],
      [{ tur: 'ozet', ad, oturum: 'TYT', dersler: { 'TÜRKÇE-T': [['T.12.1.1'], ['T.12.1.1'], ['ZZ.11.1.1']] } }, { tur: 'turkiye', ad, oturum: 'TYT', dersler: { 'TÜRKÇE-T': [.5, .5, .4] } }]);
    v.exams.forEach(x => x.date = '2026-10-01'); put('KV2', v);
    const z = get(`OGRETMEN_RAPOR.konuIzgarasi(KV2,['12/A'],'TYT','TÜRKÇE-T')`);
    assert.deepEqual(z.satir.map(r => r.ad).sort(), ['Sentetik kazanımı uygular', 'Sözcükte Anlam']);
    // 1 correct against ,4 expected over 1 answer → +60 points; the whole subject counts all three questions: (2 − 1,4) / 3 = +20.
    near(z.satir.find(r => r.ad === 'Sentetik kazanımı uygular').hucre[0].fark, 60); near(z.sinavlar[0].fark, 20);
    // The 10th–12th grade maths topics come from the MEB programme number inside the code, whatever its prefix; the student's
    // own mapping and the built-in list still come first; another ders or an unknown number has no topic.
    const tf = (c, k, m) => run(`KONU_TAKIBI.topicFor(${JSON.stringify(c)},${JSON.stringify(k)}${m ? ',' + JSON.stringify(m) : ''})`);
    assert.equal(tf('MATEMATİK-A', 'M.12.5.2.3'), 'Anlık Değişim Oranı ve Türev'); assert.equal(tf('MATEMATİK-A', 'E.M.11.1.2.1'), 'Trigonometrik Fonksiyonlar');
    assert.equal(tf('GEOMETRİ-A', 'GEO.12.7.1.1'), 'Çemberin Analitik İncelenmesi'); assert.equal(tf('MATEMATİK-A', 'E.M.10.3.2'), 'Polinomların Çarpanlara Ayrılması');
    assert.equal(tf('MATEMATİK-T', 'E.M.10.2.1.4'), 'Fonksiyon Kavramı ve Gösterimi', 'the built-in list first'); assert.equal(tf('MATEMATİK-A', 'M.12.5.2.3', { 'MATEMATİK-A|M.12.5.2.3': 'Türev' }), 'Türev', 'an own mapping first');
    // The 9th–11th grades follow the new programme (codes like MAT.11.1.1): its numbers mean other topics, so the earlier
    // programme's list never answers for them. The 11th grade's unit comes from the app's curriculum; a grade without codes
    // there has no topic (the report shows the kazanım itself).
    const unite = run("MUFREDAT_2026.siniflar['11'].find(d=>d.uniteler.some(u=>(u.ciktiKodlari||[]).includes('MAT.11.1.1'))).uniteler.find(u=>u.ciktiKodlari.includes('MAT.11.1.1')).ad");
    assert.equal(tf('MATEMATİK-T', 'MAT.11.1.1'), unite); assert.equal(tf('MATEMATİK-T', 'MAT.11.1.1.2'), unite); assert.notEqual(unite, 'Yönlü Açılar');
    assert.equal(tf('MATEMATİK-A', 'MAT.10.3.1'), null, 'not the earlier programme’s Polinomlar');
    // The new programme has not reached the 12th grade: a 12th-grade code with a new-style prefix is the earlier programme's
    // (the publisher's 27-YKS-1202 AYT: BİY.12.1.1.2 Nükleik asitler, TDE.12.…).
    assert.equal(tf('MATEMATİK-A', 'MAT.12.5.2'), 'Anlık Değişim Oranı ve Türev'); assert.equal(tf('BİYOLOJİ-A', 'BİY.12.1.1.2'), 'Genden Proteine');
    // AYT Edebiyat: the publisher's own AYT order (TDE.12.2 is şiir, not the MEB 12th-grade Hikâye), part by part, else the unit;
    // an unknown unit has no topic (never a MEB unit name); Seçmeli Felsefe reads the Felsefe grubu codes.
    for (const [k, t] of [['TDE.12.1.1.3', 'Sanat ve Edebiyat'], ['TDE.12.1.3.1', 'Türk Dilinin ve Edebiyatının Tarihî Dönemleri'], ['TDE.12.1.5.2', 'Sanat ve Edebiyat'],
      ['TDE.12.2.1.6', 'Coşku ve Heyecanı Dile Getiren Metinler (Şiir Bilgisi)'], ['TDE.12.2.1.12', 'Coşku ve Heyecanı Dile Getiren Metinler (Şiir Bilgisi)'], ['TDE.12.2.2.3', 'Coşku ve Heyecanı Dile Getiren Metinler (Şiir Dili / Söz Sanatları)'],
      ['TDE.12.3.1.1', 'Tarihsel Süreç İçinde Türk Şiiri (İslamiyet Öncesi / Geçiş Dönemi 11-12.yy / Halk Edebiyatı)'], ['TDE.12.2.7.1', 'Coşku ve Heyecanı Dile Getiren Metinler (Şiir Bilgisi)'], ['TDE.12.9.1.1', null]])
      assert.equal(tf('TÜRK DİLİ VE EDB-A', k), t, k);
    // Checked against MEB's published programmes: Biyoloji 12.2.1 is Canlılık ve Enerji (Fotosentez is 12.2.2), Fizik 12.1.4
    // Kütle Çekim Kuvveti and 12.1.5 Kepler; Tarih's 11th grade follows the 2023 programme; Din 11.5 is Yahudilik ve Hıristiyanlık;
    // Felsefe 10.4 Felsefi Okuma ve Yazma; E.M.9.2.1.5 is the publisher's own code for Sayı Basamakları (MEB 9.2.1 ends at 9.2.1.3).
    for (const [c, k, t] of [['BİYOLOJİ-A', 'BİY.12.2.1.1', 'Canlılık ve Enerji'], ['BİYOLOJİ-A', 'BİY.12.2.2.3', 'Fotosentez'], ['BİYOLOJİ-A', 'B.12.2.3.1', 'Kemosentez'],
      ['BİYOLOJİ-A', 'B.12.2.4.2', 'Hücresel Solunum'], ['FİZİK-A', 'F.12.1.4.1', 'Kütle Çekim Kuvveti'], ['FİZİK-A', 'F.12.1.5.1', 'Kepler Kanunları'],
      ['TARİH.2-A', 'E.TAR.11.3.2', 'Devrimler Çağında Değişen Devlet-Toplum İlişkileri'], ['TARİH.2-A', 'E.TAR.11.4.1', 'Uluslararası İlişkilerde Denge Stratejisi (1774-1914)'],
      ['TARİH.2-A', 'E.TAR.11.5.1', 'XIX ve XX. Yüzyılda Değişen Sosyoekonomik Hayat'], ['TARİH.2-A', 'E.TAR.11.6.1', null], ['TARİH.1-A', 'E.TAR.9.3.4', 'Orta Çağ’da Dünya'],
      ['DİN KÜLTÜRÜ-A', 'E.DİN.11.5.1', 'Yahudilik ve Hıristiyanlık'], ['DİN KÜLTÜRÜ-A', 'D.12.4.1', 'Güncel Dinî Meseleler'], ['FELSEFE GR.-A', 'E.FEL.10.4.1', 'Felsefi Okuma ve Yazma'],
      ['KİMYA-A', 'K.9.4.1', 'Maddenin Hâlleri'], ['MATEMATİK-A', 'E.M.9.2.1.5', 'Sayı Basamakları'], ['MATEMATİK-A', 'E.M.9.2.1.2', 'Kümelerde Temel Kavramlar']])
      assert.equal(tf(c, k), t, c + ' ' + k);
    // Built-in names display as written, never title-cased ("Sanat Ve Edebiyat", "Iı. Dünya Savaşı").
    for (const n of ['Sanat ve Edebiyat', 'Coşku ve Heyecanı Dile Getiren Metinler (Şiir Bilgisi)', 'II. Dünya Savaşı Sürecinde Türkiye ve Dünya', 'XIX ve XX. Yüzyılda Değişen Sosyoekonomik Hayat'])
      assert.equal(run('KONU_TAKIBI.topicName(' + JSON.stringify(n.toLocaleUpperCase('tr-TR')) + ')'), n);
    assert.equal(tf('S.FELSEFE-A', 'PSK.12.2.1'), 'Psikolojinin Temel Süreçleri'); assert.equal(tf('FELSEFE GR.-A', 'PSK.12.2.1'), 'Psikolojinin Temel Süreçleri');
    // The other lessons of the earlier programme: the unit by grade.unit, a topic where the unit is broad; the ders comes from
    // the course code (12.2 is Basit Harmonik Hareket in Fizik, Karbon Kimyasına Giriş in Kimya).
    assert.equal(tf('FİZİK-A', 'F.12.2.1.3'), 'Basit Harmonik Hareket'); assert.equal(tf('KİMYA-A', 'K.12.2.1.3'), 'Karbon Kimyasına Giriş'); assert.equal(tf('FİZİK-A', 'E.FİZ.11.1.8.2'), 'Tork');
    assert.equal(tf('BİYOLOJİ-A', 'B.11.1.4.1'), 'Dolaşım Sistemleri'); assert.equal(tf('COĞRAFYA.2-A', 'C.12.2.3'), 'Beşerî Sistemler'); assert.equal(tf('TARİH.1-A', 'İTA.12.3.1'), 'Atatürkçülük ve Türk İnkılabı');
    assert.equal(tf('FELSEFE GR.-A', 'MAN.11.2.1'), 'Klasik Mantık'); assert.equal(tf('DİN KÜLTÜRÜ-A', 'D.12.1.2'), 'İslam ve Bilim'); assert.equal(tf('TÜRK DİLİ VE EDB-A', 'EDB.11.4.2'), 'Makale');
    assert.notEqual(tf('FİZİK-A', 'FİZ.11.1.1'), 'Vektörler', 'a new-programme code is never read from the earlier lists (it takes the app’s own curriculum unit)'); assert.equal(tf('FİZİK-A', 'F.12.9.1'), null); assert.equal(tf('MATEMATİK-A', 'M.12.9.9.1'), null); assert.equal(tf('TÜRKÇE-T', 'ZZ.11.1.1'), null);
    // Konu Takibi's own page keeps its pooled row: the option is the report's.
    assert(get(`KONU_TAKIBI.ogrenciFark(KV2,{session:'TYT'}).ogrenciler[0].konular`) !== null);
    assert.deepEqual(run(`[...KONU_TAKIBI.ogrenciFark(KV2,{session:'TYT'}).ogrenciler[0].konular.values()].map(t=>t.ad).sort().join('|')`), 'Konusu eşleşmeyen kazanımlar|Sözcükte Anlam');
  });
  await check('colours: the chance test decides red and green, the gap only how deep; a gap within chance is never redder than orange (one shared, squashed spectrum)', () => {
    const c = (fark, durum) => run(`OGRETMEN_RAPOR.hucreRengi({fark:${fark},durum:'${durum}'})`);
    assert.equal(c(-20, 'geride'), 'background:#a82022'); assert.equal(c(20, 'onde'), 'background:#1a764e'); assert.equal(c(0, 'belirsiz'), 'background:#f2c86b');
    // a real gap (|z| ≥ 1,96) starts at the clear red or green (GRAFIK_RENK.KESIN) whatever its size, and deepens up to 20 points
    assert.equal(c(-0.5, 'geride'), 'background:' + run('GRAFIK_RENK.spektrum(-0.61)'), 'a small but real gap is clear red');
    assert.equal(c(-10, 'geride'), 'background:' + run('GRAFIK_RENK.spektrum(-0.8)')); assert.equal(c(10, 'onde'), 'background:' + run('GRAFIK_RENK.spektrum(0.8)'));
    // within chance: × 0,3 of the gap's place, orange and light green at most
    assert.equal(c(-20, 'belirsiz'), 'background:#ea8a5f'); assert.equal(c(-60, 'belirsiz'), 'background:#ea8a5f'); assert.equal(c(20, 'belirsiz'), 'background:#9ccf86');
    assert.equal(c(-10, 'belirsiz'), 'background:' + run('GRAFIK_RENK.spektrum(-0.15)'));
    const rgbK = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), kirmizi = h => { const [r, g, b] = rgbK(h.slice(11)); return r > 150 && g < 70 && b < 60 };
    for (const f of [-1, -3, -6, -12, -20, -30]) { assert(kirmizi(c(f, 'geride')), 'a real gap is red at ' + f); }
    for (const f of [-6, -12, -20, -40]) { assert(!kirmizi(c(f, 'belirsiz')), 'not red within chance at ' + f); }
    assert.equal(c(-40, 'geride'), c(-20, 'geride'), 'capped at 20 points');
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    for (const f of [-20, -12, -6, -1, 1, 6, 12, 20]) { const [r, g, b] = rgb(c(f, 'geride').slice(11)); assert(Math.max(r, g, b) - Math.min(r, g, b) >= 60, 'never greyish: ' + f); }
    assert.doesNotMatch(c(-3, 'belirsiz'), /transparent|color-mix/);
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
  await check('Sınıf düzeyi: always one grade, chosen with a button (no "Bütün düzeyler"), the highest first; its teachers, classes and blocks only', () => {
    planKur(); kaynakKur(); konuKur(); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:[]})');
    let h = run('OGRETMEN_RAPOR.gorunum()');
    assert.match(h, /<div class="ogr-duzeyler" role="group" aria-label="Sınıf düzeyi" id="ogrDuzey"><button type="button" class="ogr-duzey" data-duzey-alan="ogrDuzey" data-duzey="12" aria-pressed="true">12\. sınıf<\/button><button type="button" class="ogr-duzey" data-duzey-alan="ogrDuzey" data-duzey="9" aria-pressed="false">9\. sınıf<\/button><\/div>/);
    assert(!/Bütün düzeyler/.test(h), 'no all-grades choice');
    assert.match(h, /<h1 class="et-baslik">Öğretmen raporu · 12\. sınıf<\/h1>/, 'the highest grade first');
    run('EK.ogrDuzey=12'); h = run('OGRETMEN_RAPOR.gorunum()');
    assert.match(h, /<h1 class="et-baslik">Öğretmen raporu · 12\. sınıf<\/h1>/);
    assert.match(h, /<h2>Sentetik Öğretmen Ay<\/h2><p class="mini">Matematik · 12\/A, 12\/B<\/p>/, 'the 9th grade is not listed');
    run('EK.ogrDuzey=9'); h = run('OGRETMEN_RAPOR.gorunum()');
    assert.equal((h.match(/<section class="ogr-ogretmen"/g) || []).length, 1, 'only the teacher of the 9th grade'); assert.match(h, /<h2>Sentetik Öğretmen Ay<\/h2><p class="mini">Matematik · 9\/C<\/p>/);
    assert.match(h, /Bütün öğretmenler \(1\)/); assert.match(h, /henüz deneme ya da konu verisi yok/);
    run('EK.ogrDuzey=undefined');
  });
  await check('the chart: the students’ nets written on it, the Türkiye line dashed, the room between shaded green above and red below (split where they cross); the headline: two numbers and where the students stand', () => {
    kaynakKur();
    const seri = get(`OGRETMEN_RAPOR.netSerisi(K,['12/A','12/B'],'TYT','MAT','MATEMATİK-T')`);
    run(`OGRETMEN_RAPOR.netSerisi(K,['12/A','12/B','12/C'],'TYT','MAT','MATEMATİK-T',__g=new Set())`); assert.deepEqual(get('[...__g].sort()'), ['12/A', '12/B'], 'the classes that had a net');
    sandbox.__b = { seri, kod: 'MATEMATİK-T', dersAd: 'TYT Matematik' };
    const svg = run('OGRETMEN_RAPOR.netGrafigi(__b,720)'), t = [...svg.matchAll(/<text class="ogr-deger ([^"]*)"[^>]*>([^<]*)<\/text>/g)].map(m => [m[1], m[2]]);
    // Nets 20 and 26 written as nets (Türkiye 12 and 13, in the tooltips); no difference panel. The axis is the whole test, 0 to 30
    // questions, so every subject's areas are drawn on the same share of the test.
    assert.deepEqual(t, [['ogr-deger-okul', '20,0'], ['ogr-deger-okul', '26,0']]);
    assert.deepEqual([...svg.matchAll(/<text class="ogr-tik" x="[^"]*" y="[^"]*" text-anchor="end">([^<]*)<\/text>/g)].map(m => m[1]), ['0', '7,5', '15', '22,5', '30'], 'the whole test, marked in nets');
    // Placed by the share of the test: 2,5 of 5 questions sits where 15 of 30 does.
    sandbox.__f = { seri: [{ ad: 'A', g: 1, n: 1, soru: 5, net: 2.5, genel: 2, fark: .5 }], kod: 'DİN KÜLTÜRÜ-T', dersAd: 'TYT Din' }; sandbox.__g = { seri: [{ ad: 'A', g: 1, n: 1, soru: 30, net: 15, genel: 12, fark: 3 }], kod: 'MATEMATİK-T', dersAd: 'TYT Matematik' };
    const cy = k => +run(`OGRETMEN_RAPOR.netGrafigi(${k},720)`).match(/<circle class="ogr-okul-nokta" cx="[^"]*" cy="([\d.]+)"/)[1];
    assert.equal(cy('__f'), cy('__g'), 'the same height for the same share');
    assert(!svg.includes('ogr-cubuk') && !svg.includes('ogr-sifir') && !/fark/i.test(svg.replace(/<title>[^<]*<\/title>/g, '')), 'one picture');
    assert.match(svg, /<circle class="ogr-tr-nokta"[^>]*><title>27-YKS-1201 · Türkiye 12,00 net<\/title>/);
    assert.deepEqual([...svg.matchAll(/<text class="ogr-tik ogr-sinav-adi"[^>]*aria-label="([^"]*)"/g)].map(m => m[1]), ['27-YKS-1201', '27-YKS-1202']);
    // Above Türkiye in both: one green band.
    assert.deepEqual([...svg.matchAll(/<path class="ogr-alan ([^"]*)"/g)].map(m => m[1]), ['ogr-alan-ust']);
    // Below then above: red up to where the lines cross, green after it; the two meet at the crossing.
    sandbox.__c = { seri: [{ ad: 'A', g: 1, n: 1, net: 9, genel: 10, fark: -1 }, { ad: 'B', g: 2, n: 1, net: 11, genel: 10, fark: 1 }], kod: 'MATEMATİK-T', dersAd: 'TYT Matematik' };
    const svg2 = run('OGRETMEN_RAPOR.netGrafigi(__c,720)'), alan = [...svg2.matchAll(/<path class="ogr-alan ([^"]*)" d="M([\d.]+),[\d.]+ L([\d.]+),/g)].map(m => [m[1], +m[2], +m[3]]);
    assert.deepEqual(alan.map(a => a[0]), ['ogr-alan-alt', 'ogr-alan-ust']); assert.equal(alan[0][2], alan[1][1], 'split at the crossing');
    near(alan[0][2], (alan[0][1] + alan[1][2]) / 2, 'halfway: −1 to +1');
    // A negative mean net stays inside the chart: the axis goes below 0 (it was cut at 0 and the point fell off).
    sandbox.__e = { seri: [{ ad: 'A', g: 1, n: 1, net: .8, genel: 4, fark: -3.2 }, { ad: 'B', g: 2, n: 1, net: -1, genel: 3.1, fark: -4.1 }], kod: 'BİYOLOJİ-A', dersAd: 'AYT Biyoloji' };
    const svg3 = run('OGRETMEN_RAPOR.netGrafigi(__e,720)'), H = +svg3.match(/height="([\d.]+)"/)[1], ad0 = svg3.indexOf('ogr-sinav-adi');
    const ny = [...svg3.matchAll(/<circle class="ogr-okul-nokta" cx="[^"]*" cy="([\d.]+)"/g)].map(m => +m[1]), etiketY = +svg3.slice(ad0).match(/y="([\d.]+)"/)[1];
    assert(Math.max(...ny) < etiketY - 10, 'the −1 point sits above the exam names: ' + ny + ' / ' + etiketY);
    assert.match(svg3, /text-anchor="end">[−-][12]<\/text>/, 'a tick below zero');
    // An exam without a Türkiye average: no shading next to it.
    sandbox.__d = { seri: [{ ad: 'A', g: 1, n: 1, net: 9, genel: null, fark: null }, { ad: 'B', g: 2, n: 1, net: 11, genel: 10, fark: 1 }], kod: 'MATEMATİK-T', dersAd: 'TYT Matematik' };
    assert(!run('OGRETMEN_RAPOR.netGrafigi(__d,720)').includes('ogr-alan'));
    planKur(); konuKur(); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:[]})'); const h = run('OGRETMEN_RAPOR.gorunum()');
    assert.match(h, /<div class="ogr-skor"><div class="ogr-skor-sayi"><span>Öğrencileriniz<\/span><strong class="ogr-y">26,0<\/strong><\/div><div class="ogr-skor-sayi"><span>Türkiye<\/span><strong>13,0<\/strong><\/div>/);
    assert(!/ogr-degisim|İlk → son|ogr-ozet|ogr-kpi/.test(h), 'no change box, no first → last column, no sentence, no boxes');
  });
  await check('the headline words: where the students stand in the newest exam with a Türkiye average, and whether the gap closes (good when behind, bad when ahead) or opens; never a guess', () => {
    planKur(); kaynakKur(); konuKur(); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:[]})');
    const durum = () => { const m = run('OGRETMEN_RAPOR.gorunum()').match(/<div class="ogr-rozetler"><b class="ogr-durum ([^"]*)">([^<]*)<\/b>(?:<b class="ogr-durum ogr-egilim ([^"]*)">([^<]*)<\/b>)?<\/div><span>([^<]*)<\/span>/); return m && [m[1], m[2], m[3] || null, m[4] || null, m[5]]; };
    // Gaps in nets against a Türkiye average of 10 (TYT Matematik, 30 questions: 1 net = 3,3 points).
    for (const [gaps, expected] of [
      [[1, .5], ['ogr-y', '▲ Türkiye’nin üstünde', 'ogr-k', 'Fark daralıyor']],
      [[1, 2], ['ogr-y', '▲ Türkiye’nin üstünde', 'ogr-y', 'Fark açılıyor']],
      [[-2, -1], ['ogr-k', '▼ Türkiye’nin altında', 'ogr-y', 'Fark daralıyor']],
      [[.5, -1], ['ogr-k', '▼ Türkiye’nin altında', 'ogr-k', 'Fark açılıyor']],
      [[-1, -1.1], ['ogr-k', '▼ Türkiye’nin altında', 'ogr-sabit', 'Fark değişmedi']],
      [[1, 0], ['ogr-sabit', '■ Türkiye ile aynı', null, null]]]) {
      put('GAPS', gaps);
      run('K.trFn=()=>({genel:()=>10});K.t.sinavlar.forEach((s,i)=>Object.values(s.tyt).forEach(o=>o.net.MAT=10+GAPS[i]))');
      assert.deepEqual(durum(), [...expected, '27-YKS-1202'], JSON.stringify(gaps));
    }
    // The latest exam has no Türkiye figure: the one before is named, with no trend.
    run("K.trFn=ad=>ad==='27-YKS-1201'?{genel:()=>10}:null"); assert.deepEqual(durum(), ['ogr-y', '▲ Türkiye’nin üstünde', null, null, '27-YKS-1201']);
    run('K.trFn=()=>null'); assert.equal(durum(), null, 'no Türkiye average: no headline');
  });
  await check('the page: one section per teacher, classes together, two numbers, a picture and coloured squares; reading notes, formulas and raw numbers folded, no student names, no class figures, no ranking, no etüts; the teacher filter', () => {
    planKur(); kaynakKur(); konuKur(); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:[]})');
    let h = run('OGRETMEN_RAPOR.gorunum()');
    assert.match(h, /<h1 class="et-baslik">Öğretmen raporu · 12\. sınıf<\/h1>/); assert.match(h, /aynı denemelerde Türkiye ortalamasıyla karşılaştırılır/);
    assert.equal((h.match(/<section class="ogr-ogretmen"/g) || []).length, 2);
    assert.match(h, /<h2>Sentetik Öğretmen Ay<\/h2><p class="mini">Matematik · 12\/A, 12\/B<\/p>/, 'the 12th grade (the highest) first');
    // AY: TYT Matematik for the 12th grade (12/A and 12/B together); the 9th grade has no data. DE: TYT Türkçe with the topic grid.
    assert.match(h, /TYT Matematik · 12\. sınıf/); assert(!/12\/A ·|12\/B ·/.test(h.replace(/<p class="(mini|ogr-kapsam)">[^<]*<\/p>/g, '').replace(/<details[\s\S]*?<\/details>/g, '')), 'no figure per class');
    assert.match(h, /<p class="ogr-kapsam">12\/A, 12\/B · 2 deneme<\/p>/, 'the classes taken together, named once');
    assert.match(h, /TYT Türkçe · 12\. sınıf/); assert.match(h, /<table class="ogr-iz" style="--ogr-en:340px;--ogr-ust:548px">/, 'three exams: the table’s least and greatest width');
    // No words to decode: no run labels, no average column, no long explanation, no number in a square; one key under the table.
    assert(!/Son 3 denemede|ogr-iz-ort|ogr-iz-aciklama|Koyu kutu|Soluk kutu|▼▼▼|▲▲▲/.test(h), 'nothing to decode');
    assert.match(h, /<em>Türkiye’nin gerisinde<\/em>[\s\S]*?<em>Türkiye’nin önünde<\/em>/);
    // Headline: the newest exam with a Türkiye average, 12/A and 12/B together: 1202 → (22 + 30) / 2 = 26 against 13.
    assert.match(h, /<span>Öğrencileriniz<\/span><strong class="ogr-y">26,0<\/strong><\/div><div class="ogr-skor-sayi"><span>Türkiye<\/span><strong>13,0<\/strong>/);
    // What a reader needs before the first figure, once, folded, on screen: whom the report covers, where the numbers come from,
    // how to read a colour. On paper the chart's legend and the squares' key are enough.
    assert.equal((h.match(/<div class="ogr-baski ogr-rehber">/g) || []).length, 0, 'no paragraphs of notes on paper: the keys are the notes');
    assert.match(h, /<details class="ogr-rehber ogr-rehber-ekran"><summary>Bu rapor nasıl okunur\?<\/summary>/);
    for (const yazi of ['Kimleri kapsıyor?', 'Veriler nereden geliyor?', 'Nasıl okunur?', 'okulda uygulanan denemelerin sonuç listelerinden', 'yayınevinin aynı denemeler için açıkladığı Türkiye geneli sonuçlarından', 'Hiçbir değer tahmin edilmez.', 'Yeşil, Türkiye ortalamasının üzerinde; kırmızı, altında']) assert(h.includes(yazi), yazi);
    // On paper each teacher's sheets say what they are and when they were printed (the test clock is not set: today).
    assert.match(h, /<p class="ogr-baski ogr-ust-yazi">Öğretmen raporu · 12\. sınıf · \d{1,2} [A-ZÇŞ][a-zğşuü]{2} \d{4}<\/p><h2>Sentetik Öğretmen Ay<\/h2>/);
    // A teacher's lessons in class only: etüts (one-to-one sessions after school) are not part of the report.
    assert(!/etüt/i.test(h), 'no etüts');
    // Formulas and the raw numbers, folded.
    assert.match(h, /<summary>Hesaplama ayrıntıları ve ham veriler<\/summary>/); assert.match(h, /Fark = 100 · \(d − b\) \/ n puan/); assert.match(h, /z = \(d − b\) \/ √\(Σ n·p·\(1 − p\) · \(1 \+ \(soru − 1\) · 0,2\)\)/);
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
    // No ranking of students, classes or teachers (the school's own İlk 100 place shows only when the Türkiye geneli page follows
    // a school; not here).
    assert(!/sıra|Sıra|\d+\. sıra/.test(h.replace(/<select[\s\S]*?<\/select>/, '').replace(/<details[\s\S]*?<\/details>/g, '')), 'no ranking');
    // One teacher.
    run(`EK.ogrHoca=${JSON.stringify(get('OGRETMEN_RAPOR.ogretmenler()')[1].key)}`); h = run('OGRETMEN_RAPOR.gorunum()');
    assert.equal((h.match(/<section class="ogr-ogretmen"/g) || []).length, 1); assert.match(h, /<h2>Sentetik Öğretmen De<\/h2>/);
    // Empty: no timetables.
    run('delete D.etutPlani'); assert.match(run('OGRETMEN_RAPOR.gorunum()'), /<b>Ders programı yok<\/b>[\s\S]*data-sekme="etutplani"/);
  });
  await check('Öğrenci raporu (Türkiye): the same blocks for one student, in the student’s words; no school place; the filters (hand-worked)', () => {
    planKur(); kaynakKur(); konuKur();
    // ADA (1001, 12/A): TYT Matematik 20 and 22 against 12 and 13 → +8 and +9; her Türkçe topics alone.
    const m = get(`OGRETMEN_RAPOR.ogrenciModeli(K.t.kisi.get('1001'),{k:K,v:D.konutakibi,fark:new Map(),dersSinav:new Map()})`);
    const mat = m.bloklar.find(b => b.kod === 'MATEMATİK-T');
    assert.deepEqual(mat.seri.map(p => [p.n, p.net, p.fark]), [[1, 20, 8], [1, 22, 9]]);
    // Sözcükte Anlam (p .5 .5 .9 .9): ADA 0 + 1 correct of 4 against 2,8 → 100 · (1 − 2,8) / 4 = −45 points each exam.
    const tr = m.bloklar.find(b => b.kod === 'TÜRKÇE-T'); near(tr.izgara.satir.find(r => r.ad === 'Sözcükte Anlam').hucre[0].fark, -45); assert.deepEqual(tr.izgara.sinavlar.map(e => e.ogr), [1, 1, 1]);
    assert(m.bloklar.findIndex(b => b.oturum === 'AYT') < 0 || m.bloklar.findIndex(b => b.oturum === 'AYT') > m.bloklar.findIndex(b => b.oturum === 'TYT'), 'TYT before AYT');
    // The page: grade → şube → student; each student a section of their own; the student’s words; no school place or list yardstick.
    run("EK.osDuzey=12;EK.osSube='12/A';EK.osOgr='1001'");
    const h = run('OGRETMEN_RAPOR.gorunumOgrenci()');
    assert.match(h, /<h1 class="et-baslik">Türkiye ortalaması karşılaştırması<\/h1>/); assert.equal((h.match(/<section class="ogr-ogretmen" data-ogr-ogrenci=/g) || []).length, 1);
    assert.match(h, /<h2>Sentetik Ada<\/h2><p class="mini">12\/A · okul no 1001<\/p>/); assert.match(h, /<span>Senin netin<\/span><strong class="ogr-y">22,0<\/strong><\/div><div class="ogr-skor-sayi"><span>Türkiye<\/span><strong>13,0<\/strong>/);
    assert.match(h, /<b class="ogr-durum ogr-y">▲ Türkiye’nin üstünde<\/b>/); assert.match(h, /<h4 class="ogr-alt-baslik">Konular/); assert.match(h, /Kimi kapsıyor\?/);
    assert(!/öğrencileriniz|Öğrencileriniz|Okulun Türkiye sırası|İlk 100 sınırı/.test(h), 'no teacher wording, no school figures');
    assert(!/SENTETİK BORA|Sentetik Bora|SENTETİK CEMRE|Sentetik Cemre/.test(h.replace(/<select id="osOgr">[\s\S]*?<\/select>/, '')), 'no other student on the report');
    run("EK.osOgr=undefined"); assert.equal((run('OGRETMEN_RAPOR.gorunumOgrenci()').match(/data-ogr-ogrenci=/g) || []).length, 2, 'the whole şube: ADA and BORA, each on their own sheets');
    run("EK.osDuzey=undefined;EK.osSube=undefined");
    // The teacher's report keeps its own words.
    assert.match(run('OGRETMEN_RAPOR.gorunum()'), /<span>Öğrencileriniz<\/span>/);
  });
  await check('AYT: another field’s test the student left blank is no result: no 0 net in the box, no red topics; the student’s own field stays (hand-worked)', () => {
    planKur(); kaynakKur(); konuKur();
    // The lists: ADA (SAY) answered the MAT and FEN tests and left TDE-SB1 (Edebiyat, Tarih-1, Coğrafya-1) blank, so her Edebiyat
    // net prints as 0; CEMRE (EA) answered TDE-SB1 and MAT and left FEN blank. Every student gets the whole AYT booklet.
    run(`(()=>{const a=(no,net,dy)=>({no,net,dy});
      K.t.sinavlar[0].ayt={1001:a('1001',{EDB:0,AMAT:15,AFİZ:8},{EDB:'0/0',TAR1:'0/0',COĞ1:'0/0',AMAT:'16/4',AGEO:'2/1',AFİZ:'9/4',AKİM:'5/2',ABİY:'4/1'}),
        1003:a('1003',{EDB:12,AMAT:10,AFİZ:0},{EDB:'13/4',TAR1:'5/2',COĞ1:'3/1',AMAT:'11/4',AGEO:'1/0',AFİZ:'0/0',AKİM:'0/0',ABİY:'0/0'})};
      const tr=K.trFn;K.trFn=ad=>{const t=tr(ad);return t?{genel:k=>({'TÜRK DİLİ VE EDB-A':10,'MATEMATİK-A':12,'FİZİK-A':6})[k]??t.genel(k)}:null}})()`);
    // Konu Takibi, one AYT exam: ADA's Edebiyat rows are all blank (2 questions, 0 correct, 0 wrong); CEMRE answered (1 correct, 1 wrong).
    const kt = run('KONU_TAKIBI'), ad = 'SENTETİK-AYT-1', rows = c => [F.row('EDB.11.4.2', 'e', c)];
    let v = kt.merge(run('D.konutakibi'), [{ ad, blocks: [F.block(rows([2, 0, 0, 2]), 'outcome', 'TÜRK DİLİ VE EDB-A', A), F.block(rows([2, 1, 1, 0]), 'outcome', 'TÜRK DİLİ VE EDB-A', C)] }],
      [{ tur: 'ozet', ad, oturum: 'AYT', dersler: { 'TÜRK DİLİ VE EDB-A': [['EDB.11.4.2'], ['EDB.11.4.2']] } }, { tur: 'turkiye', ad, oturum: 'AYT', dersler: { 'TÜRK DİLİ VE EDB-A': [.5, .5] } }]);
    v.exams.find(x => x.ad === ad).date = '2026-10-04'; put('KV2', v); run('D.konutakibi=KV2');
    const model = no => get(`OGRETMEN_RAPOR.ogrenciModeli(K.t.kisi.get('${no}'),{k:K,v:D.konutakibi,fark:new Map(),dersSinav:new Map()})`), blok = (m, kod) => m.bloklar.find(b => b.kod === kod);
    const ada = model('1001'), cemre = model('1003');
    assert.equal(blok(ada, 'TÜRK DİLİ VE EDB-A'), undefined, 'ADA (SAY) has no AYT Edebiyat: neither the 0 net nor red topics');
    assert.deepEqual(blok(ada, 'MATEMATİK-A').seri.map(p => [p.net, p.fark]), [[15, 3]], 'her own field stays');
    assert.equal(blok(cemre, 'FİZİK-A'), undefined, 'CEMRE (EA) has no AYT Fizik');
    const edb = blok(cemre, 'TÜRK DİLİ VE EDB-A'); assert.deepEqual(edb.seri.map(p => [p.net, p.fark]), [[12, 2]]);
    near(edb.izgara.satir[0].hucre[0].fark, 0, 'CEMRE: 1 correct of 2 against Türkiye 2 · ,5 = 1 → 0 points');
    // The exam with a net but no topic data is named in one quiet line under the topic table (27-YKS-1201 has no AYT kazanım
    // karnesi here), on the teacher's and the student's page alike.
    run("EK.osDuzey=12;EK.osSube='12/B';EK.osOgr='1003'"); const sayfa = run('OGRETMEN_RAPOR.gorunumOgrenci()');
    assert.match(sayfa, /<p class="mini ogr-iz-eksik ogr-ekran">Konu verisi henüz yok: 27-YKS-1201<\/p>/, 'the student’s sheet');
    assert.match(run('OGRETMEN_RAPOR.gorunum()'), /<p class="mini ogr-iz-eksik ogr-ekran">Konu verisi henüz yok: 27-YKS-1201<\/p>/, 'Öğretmen raporu');
    put('__OZ3', get(`OGRETMEN_RAPOR.kiyasOzeti({no:'1003'})`)); run(`D.turkiyeKiyas=__OZ3;D.ogr=[{no:'1003',ad:'SENTETİK CEMRE',sube:'12/B',sinif:12,alan:'EA',kap:6,off:[6],aktif:true}];D.rol='ogrenci'`);
    assert.match(run('OGRETMEN_RAPOR.gorunumKendi()'), /Konu verisi henüz yok: 27-YKS-1201/);
    run("D.rol='rehber';EK.osDuzey=undefined;EK.osSube=undefined;EK.osOgr=undefined");
    // The Dikkat card's "konuda geride" reads the same per-student gaps: ADA is not behind in topics she never answered.
    assert.equal(get(`KONU_TAKIBI.ogrenciFark(D.konutakibi,{session:'AYT'}).ogrenciler.map(o=>o.student.no)`).join(), '1003');
  });
  await check('Türkiye karşılaştırması on the student’s own device: the teacher’s package carries a compact snapshot; the same figures come back (hand-worked)', () => {
    planKur(); kaynakKur(); konuKur();
    const oz = get(`OGRETMEN_RAPOR.kiyasOzeti({no:'1001'})`);
    assert.equal(oz.v, 1); assert.equal(oz.sinif, '12/A'); assert(JSON.stringify(oz).length < 250000);
    assert.equal(get(`OGRETMEN_RAPOR.kiyasOzeti({no:'9999'})`), null, 'a student not in the lists has none');
    // Back on the student's side: the same nets, gaps and topic cells (Sözcükte Anlam −45 each exam; TYT Matematik +8, +9).
    put('__OZ', oz); const b = get('OGRETMEN_RAPOR.kiyasAc(__OZ)');
    assert.deepEqual(b.find(x => x.kod === 'MATEMATİK-T').seri.map(p => p.fark), [8, 9]);
    const tr = b.find(x => x.kod === 'TÜRKÇE-T'), sa = tr.izgara.satir.find(r => r.ad === 'Sözcükte Anlam');
    near(sa.hucre[0].fark, -45); assert.deepEqual(sa.alt.map(a => a.kod), ['T.12.1.1', 'T.12.1.2']);
    // Its chance test is the student's own: n·p·(1 − p)·(1 + (n − 1)·0,2) with p = b / n (4 answers, b = 2,8).
    near(sa.hucre[0].z, (1 - 2.8) / Math.sqrt(4 * .7 * .3 * (1 + 3 * .2)));
    // The package carries it and the student's notebook keeps it; the student's own tab draws it.
    run(`D.ogr=[{no:'1001',ad:'SENTETİK ADA',sube:'12/A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,syncId:'s',ogrenciBulutId:'b'}]`);
    const pk = run('ogrenciPaketi(0)'); assert.equal(pk.turkiyeKiyas.v, 1);
    run(`D.turkiyeKiyas=${JSON.stringify(oz)};D.rol='ogrenci'`);
    assert.deepEqual(run("MENU_OGRENCI.map(m=>m[0])").includes('kiyas'), true);
    const h = run('OGRETMEN_RAPOR.gorunumKendi()');
    assert.match(h, /<h1 class="et-baslik">Türkiye ortalaması karşılaştırması<\/h1>/); assert.match(h, /<span>Senin netin<\/span>/); assert.match(h, /<h4 class="ogr-alt-baslik">Konular/);
    run('delete D.turkiyeKiyas'); assert.match(run('OGRETMEN_RAPOR.gorunumKendi()'), /Henüz karşılaştırma yok/); run("D.rol='rehber';D.ogr=[]");
  });
  await check('one page reads each source once, whatever the number of teachers and blocks (the page froze when every block rebuilt them)', () => {
    planKur(); kaynakKur(); konuKur();
    run(`__say={temel:0,oku:0,fark:0};OGRENCI_RAPOR.temelOgrenciler=()=>{__say.temel++;return {students:[]}};
      __okuAsil=__okuAsil||KONU_TAKIBI.oku;__farkAsil=__farkAsil||KONU_TAKIBI.ogrenciFark;
      KONU_TAKIBI.oku=(...a)=>{__say.oku++;return __okuAsil(...a)};KONU_TAKIBI.ogrenciFark=(...a)=>{__say.fark++;return __farkAsil(...a)}`);
    try {
      const h = run('OGRETMEN_RAPOR.gorunum()'); assert.equal((h.match(/<section class="et-panel ogr-blok"/g) || []).length, 2, 'two blocks');
      // One Konu Takibi read and one comparison per exam (three TYT exams), shared by every block; the student base (the
      // etüts' source) is not built at all.
      assert.deepEqual(get('__say'), { temel: 0, oku: 1, fark: 3 });
    } finally { run('KONU_TAKIBI.oku=__okuAsil;KONU_TAKIBI.ogrenciFark=__farkAsil'); }
  });
  await check('PDF indir: a page per teacher with data, drawn like the Öğrenci raporu (white soft cards on a warm page); no site name or address; the same squares and words', () => {
    planKur(); kaynakKur(); konuKur(); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:[]})');
    const sayfalar = get(`OGRETMEN_RAPOR.pdfSayfalari(OGRETMEN_RAPOR.ogretmenler().map(o=>OGRETMEN_RAPOR.ogretmenModeli(o)),'Öğretmen raporu · Türkiye karşılaştırması','18 Kas 2026')`);
    assert.equal(sayfalar.length, 2, 'AY (nets only) and DE (nets and topics)');
    for (const svg of sayfalar) {
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1190\.55" height="841\.89"/, 'A4 landscape, one picture');
      assert.match(svg, /<rect width="1190\.55" height="841\.89" fill="#f6f5f0"\/>/, 'the warm page');
      assert.match(svg, /<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" rx="14" fill="#fff"\/>/, 'white soft-cornered cards');
      assert(!/ykstekrar|YKS Tekrar|http:\/\/(?!www\.w3\.org)/i.test(svg), 'no site name or address');
      assert.match(svg, />ÖĞRETMEN RAPORU · TÜRKİYE KARŞILAŞTIRMASI<\/text>/); assert.match(svg, />18 Kas 2026<\/text>/);
      assert(!/sıra|İlk 100|Fark nasıl|Okulun/.test(svg.replace(/<[^>]+>/g, ' ')), 'no place, no yardstick, no difference box');
    }
    const [ay, de] = sayfalar;
    assert.match(ay, />Sentetik Öğretmen Ay<\/text>/); assert.match(ay, />TYT Matematik · 12\. sınıf<\/text>/);
    // DE: the two numbers and the word, the topic rows in the order taught, Sözcükte Anlam deep red (the spectrum's end, #a82022).
    assert.match(de, />Öğrencileriniz<\/text><text[^>]*>[\d,]+<\/text>/, 'the net');
    assert.match(de, />Türkiye<\/text>[\s\S]*?>▲ Türkiye’nin üstünde<\/text>[\s\S]*?>Fark (açılıyor|daralıyor|değişmedi)<\/text>/, 'where they stand and the gap’s move');
    assert(de.indexOf('>Sözcükte Anlam<') < de.indexOf('>Cümlede Anlam<') && de.indexOf('>Cümlede Anlam<') < de.indexOf('>Bütün konular<'), 'rows in the order taught, the whole subject last');
    assert.match(de, /fill="#a82022"/, 'a deep red square'); assert.match(de, /<linearGradient id="ogrSpektrum">/, 'the key: the spectrum as one bar');
    assert.match(de, />Türkiye’nin gerisinde<\/text>[\s\S]*>Türkiye’nin önünde<\/text>[\s\S]*>soru yok<\/text>/, 'one key at the foot');
    // The kazanımlar: under their topics when the rows stay readable (DE: three topics, three kazanımlar), else on the pages after.
    assert.match(de, />T\.12\.1\.1<\/text>[\s\S]*?>a<\/text>/, 'a kazanım row on the teacher’s page');
    const k = get(`OGRETMEN_RAPOR.kazanimSayfalari(OGRETMEN_RAPOR.ogretmenModeli(OGRETMEN_RAPOR.ogretmenler().find(o=>o.ad.endsWith('DE'))),'Öğretmen raporu · Türkiye karşılaştırması','18 Kas 2026')`);
    assert.equal(k.length, 1); assert.match(k[0], />ÖĞRETMEN RAPORU · TÜRKİYE KARŞILAŞTIRMASI · KAZANIMLAR<\/text>/);
    assert(k[0].indexOf('>Sözcükte Anlam<') < k[0].indexOf('>T.12.1.1<') && k[0].indexOf('>T.12.1.2<') < k[0].indexOf('>Cümlede Anlam<'), 'each topic, its kazanımlar under it');
    // A teacher without data is not a page.
    run('EK.ogrDuzey=9'); assert.equal(get(`OGRETMEN_RAPOR.pdfSayfalari(OGRETMEN_RAPOR.ogretmenler().filter(o=>o.ad.endsWith('AY')).map(o=>OGRETMEN_RAPOR.ogretmenModeli(o,undefined,9)),'x')`).length, 0); run('EK.ogrDuzey=undefined');
  });
  await check('teacher only; the menu and the route; nothing is stored', () => {
    planKur(); kaynakKur(); konuKur(); const once = run('JSON.stringify(D)');
    run('OGRETMEN_RAPOR.gorunum()'); assert.equal(run('JSON.stringify(D)'), once, 'nothing written');
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='denemeler')[1]"), ['siralamalar', 'turkiye', 'konutakibi', 'ogretmenrapor', 'ogrencitr', 'yanlislar', 'universite']);
    assert.equal(get("SEKME_REHBER.find(s=>s[0]==='ogretmenrapor')[1]"), 'Öğretmen raporu');
    run("D.rol='ogrenci'"); assert.match(run('OGRETMEN_RAPOR.gorunum()'), /Bu sayfa rehber öğretmen içindir/); assert(!get('SEKMELER().map(s=>s[0])').includes('ogretmenrapor'));
  });
  console.log(passed + ' Öğretmen raporu checks passed');
})();
