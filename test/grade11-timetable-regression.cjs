'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const source = readFileSync('index.html', 'utf8').split('<script id="uygulama">')[1]
  .split('// ---------------------------------------------------------------- başlangıç')[0];

function app() {
  const listeners = {}, nodes = {};
  const context = vm.createContext({
    console, Date, JSON, Math, Intl, Blob, URL, URLSearchParams, TextEncoder, crypto,
    setTimeout() { return 1; }, clearTimeout() {}, location: { search: '?dev=1' }, navigator: {},
    alert(message) { throw Error(message); }, confirm() { return true; }, fetch: async () => ({ ok: false }),
    localStorage: { getItem() { return null; }, setItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    window: { addEventListener() {}, scrollTo() {} },
    document: { addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
      getElementById(id) { return nodes[id] || null; }, querySelector() { return null; }, querySelectorAll() { return []; } }
  });
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  const json = code => JSON.parse(run('JSON.stringify(' + code + ')'));
  run(`D=varsayilan(); D.rol='rehber'; D.ayar.testTarih='2026-09-23'; D.ayar.gecmisSerbest=true;
    D.ogr=[{ad:'Grade Eleven',no:11,sube:'11-A',alan:'SAY',sinif:11,mufredatBaslangic:'2026-09-21',kap:6,off:[],aktif:false},
      {ad:'Other Branch',no:12,sube:'11-B',alan:'EA',sinif:11,mufredatBaslangic:'2026-09-07',aktif:false},
      {ad:'Grade Twelve',no:13,sube:'12-A',alan:'SAY',sinif:12,aktif:false}];
    D.konuPlani['11-A']=okulKonuPlani(11); D.konuPlani['11-B']=okulKonuPlani(11);
    D.elle={}; EK.ogr=0; EK.sube='11-A'; EK.sekme='program'; EK.hafta=null;
    kaydet=async()=>true; ciz=()=>{}; bilgiVer=()=>{};`);
  function schedule(days, date = '2026-09-21') {
    context.table = { saatler: ['09:00', '10:00'], gunler: Array.from({ length: 7 }, (_, i) => days[i] || []) };
    context.scheduleDate = date;
    run(`programYaz('11-A',gunNo(scheduleDate),table); programDegistiTetikle('11-A');`);
  }
  async function change(id, value) {
    const target = { id, value, classList: { contains() { return false; } } };
    for (const fn of listeners.change || []) await fn({ target });
  }
  return { run, json, schedule, change, nodes, listeners };
}

test('AYT mathematics aliases Grade 11 school mathematics', () => {
  const a = app(); a.schedule([['AYT MATEMATİK'], ['TYT MATEMATİK'], ['MATEMATİK']]);
  assert.equal(a.run("planDersAnahtari('11-A','AYT MATEMATİK')"), 'Matematik');
  const rows = a.json("haftaYerlesim('11-A',1,gunNo('2026-09-21'))");
  assert(rows.some(x => x.dersAd === 'Matematik' && x.gi === 0 && x.ad.startsWith('11. sınıf')));
  assert(rows.some(x => x.dersAd === 'Matematik TYT' && x.gi === 1 && !x.ad.startsWith('11. sınıf')));
  assert(!rows.some(x => x.dersAd === 'Matematik' && x.gi === 1));
});

test('bare mathematics and TYT mathematics keep different topic sequences', () => {
  const a = app(), school = a.json("D.konuPlani['11-A'].map(h=>h.Matematik||[])");
  a.schedule([['MATEMATİK'], ['TYT MATEMATİK']]);
  assert.deepEqual(a.json("D.konuPlani['11-A'].map(h=>h.Matematik||[])"), school);
  assert.deepEqual(a.json("D.konuPlani['11-A'].flatMap(h=>h['Matematik TYT']||[])"),
    a.json("VARSAYILAN_KONU_PLANI.SAY.flatMap(h=>h['Matematik TYT']||[])"));
  const id = a.run("+Object.keys(D.subeIslenis['11-A']).find(k=>D.konuDers[k]==='Matematik')");
  assert.equal(a.run(`konuSinavTuru(${id})`), 'AYT');
  assert.equal(a.run(`alanUygun(0,${id})`), true);
  assert.equal(a.run(`alanUygun(2,${id})`), false);
});

test('same-day TYT, regular math and geometry never borrow one another’s topics', () => {
  const a = app(); a.schedule([['MATEMATİK', 'TYT MATEMATİK']]);
  const school = a.json("hucreKonulari('11-A',gunNo('2026-09-21'),0,'MATEMATİK').map(k=>konuAl(k)[3])");
  const tyt = a.json("hucreKonulari('11-A',gunNo('2026-09-21'),0,'TYT MATEMATİK').map(k=>konuAl(k)[3])");
  assert(school.length && tyt.length);
  assert(school.every(x => x.startsWith('11. sınıf')));
  assert(tyt.every(x => !school.includes(x)));
  assert.deepEqual(a.json("oneriKonulari('11-A',1,0,'GEOMETRİ',gunNo('2026-09-21'))"), []);
  assert.equal(a.run("planDersAnahtari('11-A','GEOMETRİ')"), null);
});

test('upload labels remain selected and regular mathematics is editable', () => {
  const a = app(); a.schedule([['MATEMATİK'], ['TYT MATEMATİK']]);
  const html = a.run('gorunumProgram()');
  assert.match(html, /<option selected>MATEMATİK<\/option>/);
  assert.match(html, /<option selected>TYT MATEMATİK<\/option>/);
  assert(!html.includes('value="2026-08-24"'), 'show the Grade 11 branch start, not the Grade 12 term');
});

test('week selector aligns only the selected lower-grade branch', async () => {
  const a = app(); a.schedule([['MATEMATİK'], ['TYT MATEMATİK']]);
  const globalStart = a.run('D.ayar.donemBasi');
  await a.change('haftaSec', '3');
  assert.equal(a.run("planHaftasi('11-A',gunNo('2026-09-21'))"), 3);
  assert.equal(a.run('D.ogr[0].mufredatBaslangic'), '2026-09-07');
  assert.equal(a.run('D.ogr[1].mufredatBaslangic'), '2026-09-07');
  assert.equal(a.run('D.ayar.donemBasi'), globalStart);
});

test('term date control uses the same branch start as topic planning', async () => {
  const a = app(); a.schedule([['MATEMATİK']]);
  const globalStart = a.run('D.ayar.donemBasi');
  await a.change('donemBasi', '2026-09-14');
  assert.equal(a.run("planHaftasi('11-A',gunNo('2026-09-21'))"), 2);
  assert.equal(a.run('D.ayar.donemBasi'), globalStart);
  assert.equal(a.run('D.ogr[1].mufredatBaslangic'), '2026-09-07');
});

test('missing Grade 11 topic plan is created with the branch grade', () => {
  const a = app(); a.run("delete D.konuPlani['11-A']; varsayilanKonuPlaniniHazirla('11-A','SAY')");
  assert(a.run("D.konuPlani['11-A'][0].Matematik[0].startsWith('11. sınıf')"));
});

test('existing uploaded TYT schedule is repaired on automatic distribution without replacing school edits', () => {
  const a = app();
  a.run(`D.dersProgrami['11-A']={saatler:['09:00'],gunler:[['TYT MATEMATİK'],['AYT MATEMATİK'],[],[],[],[],[]]};
    D.konuPlani['11-A'][0].Matematik=['Öğretmenin özel 11. sınıf konusu'];
    programUygula(gunNo('2026-09-21'),'11-A');`);
  assert(a.run("D.konuPlani['11-A'].some(h=>h['Matematik TYT']?.length)"));
  assert.equal(a.run("D.konuPlani['11-A'][0].Matematik[0]"), 'Öğretmenin özel 11. sınıf konusu');
  const first = a.json('D'); a.run("programUygula(gunNo('2026-09-21'),'11-A')");
  assert.deepEqual(a.json('D'), first);
});

test('explicitly empty or edited TYT plans and grades 9, 10, 12 are preserved', () => {
  for (const grade of [9, 10, 12]) {
    const a = app(); a.run(`D.ogr[0].sinif=${grade}; D.konuPlani['11-A']=sinifaGoreKonuPlani(${grade},'SAY')`);
    const plan = a.json("D.konuPlani['11-A']"); a.schedule([['TYT MATEMATİK']]);
    assert.deepEqual(a.json("D.konuPlani['11-A']"), plan);
  }
  for (const list of [[], ['Özel TYT konusu']]) {
    const a = app(); a.run(`D.konuPlani['11-A'][0]['Matematik TYT']=${JSON.stringify(list)}`);
    const plan = a.json("D.konuPlani['11-A']"); a.schedule([['TYT MATEMATİK']]);
    assert.deepEqual(a.json("D.konuPlani['11-A']"), plan);
  }
});

test('dated uploads move ungraded topics to their new day and preserve real results', () => {
  const a = app(); a.schedule([['MATEMATİK'], ['TYT MATEMATİK']]);
  a.run(`const done=+Object.keys(D.subeIslenis['11-A']).find(k=>D.konuDers[k]==='Matematik');
    D.log=[[gunNo('2026-09-21'),0,done,null,null,4]];
    D.kart['0:'+done]={s:4,d:5,son:gunNo('2026-09-21'),due:gunNo('2026-09-28'),n:1};`);
  const history = a.json('({log:D.log,kart:D.kart})');
  a.schedule([[], [], ['TYT MATEMATİK'], ['AYT MATEMATİK']]);
  assert.deepEqual(a.json('({log:D.log,kart:D.kart})'), history);
  assert(a.run("hucreKonulari('11-A',gunNo('2026-09-21'),2,'TYT MATEMATİK').length>0"));
  assert.equal(a.run("hucreKonulari('11-A',gunNo('2026-09-21'),1,'TYT MATEMATİK').length"), 0);
});

test('TYT and Grade 11 identities survive student package export', () => {
  const a = app(); a.schedule([['MATEMATİK'], ['TYT MATEMATİK']]);
  a.run('D=paketiYukle(ogrenciPaketi(0))');
  assert.equal(a.run('ogrenciSinifi(D.ogr[0])'), 11);
  assert(a.run("hucreKonulari('11-A',gunNo('2026-09-21'),1,'TYT MATEMATİK').length>0"));
  assert(a.run("hucreKonulari('11-A',gunNo('2026-09-21'),0,'MATEMATİK').every(k=>konuAl(k)[1]===11)"));
});

test('ASCII and reversed TYT/AYT labels work in placement and visible topic cells', () => {
  const a = app(); a.schedule([['AYT MATEMATIK'], ['MATEMATIK TYT']]);
  assert.equal(a.run("dersEsle('AYT MATEMATIK')"), 1);
  assert.equal(a.run("dersEsle('MATEMATIK TYT')"), 1);
  assert(a.run("hucreKonulari('11-A',gunNo('2026-09-21'),0,'AYT MATEMATIK').length>0"));
  assert(a.run("hucreKonulari('11-A',gunNo('2026-09-21'),1,'MATEMATIK TYT').length>0"));
});

test('school-only schedules do not introduce an unscheduled TYT course', () => {
  const a = app(); const plan = a.json("D.konuPlani['11-A']");
  a.schedule([['MATEMATİK'], ['AYT MATEMATİK']]);
  assert.deepEqual(a.json("D.konuPlani['11-A']"), plan);
});

test('the actual upload handler creates a missing school plan and assigns topics', async () => {
  const a = app(); a.run("delete D.konuPlani['11-A']");
  a.nodes.dpCiktiYapistir = { value: JSON.stringify({ saatler: ['09:00'],
    gunler: [['MATEMATİK'], ['TYT MATEMATİK'], [], [], [], [], []] }) };
  const target = { id: 'dpCiktiUygula', dataset: {}, closest() { return null; },
    classList: { contains() { return false; } } };
  for (const fn of a.listeners.click || []) await fn({ target });
  assert(a.run("D.konuPlani['11-A'][0].Matematik[0].startsWith('11. sınıf')"));
  assert(a.run("hucreKonulari('11-A',gunNo('2026-09-21'),0,'MATEMATİK').length>0"));
  assert(a.run("hucreKonulari('11-A',gunNo('2026-09-21'),1,'TYT MATEMATİK').length>0"));
});

test('later weekly schedules inherit correctly without moving protected results or issued plans', () => {
  const a = app(); a.schedule([['MATEMATİK'], ['TYT MATEMATİK']]);
  a.run(`D.elle['0|'+gunNo('2026-09-21')]={sabit:gunNo('2026-09-21'),plan:{sentinel:'issued'}};`);
  const issued = a.json('D.elle');
  a.schedule([[], [], ['TYT MATEMATİK'], ['MATEMATİK AYT']], '2026-09-28');
  assert.equal(a.run("programAl('11-A',gunNo('2026-09-21')).prog.gunler[1][0]"), 'TYT MATEMATİK');
  assert.equal(a.run("programAl('11-A',gunNo('2026-10-05')).prog.gunler[2][0]"), 'TYT MATEMATİK');
  assert.deepEqual(a.json('D.elle'), issued);
  const rows = a.json("haftaYerlesim('11-A',2,gunNo('2026-09-28'))");
  assert(rows.filter(x => x.dersAd === 'Matematik TYT').every(x => x.gi === 2));
});

// Anonymous reproduction of a schedule added after the student's initial freeze.
function staleStudentWeek() {
  const a=app();
  a.run(`D.ogr=D.ogr.slice(0,1);D.ogr[0].alan='EA';D.ogr[0].off=[6];D.ogr[0].aktif=true;
    D.ayar.testTarih='2026-09-25';D.ayar.gecmisSerbest=false;D.rol='ogrenci';EK.sekme='plan';`);
  a.schedule([['TÜRK DİLİ VE EDEBİYATI','TARİH','COĞRAFYA'],['MATEMATİK'],['FELSEFE','MATEMATİK TYT'],
    ['DİN KÜLTÜRÜ'],['GEOMETRİ','TÜRKÇE']]);
  a.run(`const staleKi=+Object.keys(D.subeIslenis['11-A']).find(k=>konuAl(+k)[3].includes('Web Tabanlı'));
    const h=buHafta();D.ogr[0].cikti=h;
    D.elle['0|'+h]={ek:[],sil:[],yer:{[staleKi]:[3,0]},soru:{[staleKi]:24},degisim:{},konuSlot:{},
      sabit:h,ogrenciOtomatik:true,plan:{surum:2,slotlar:[[],[],[],[String(staleKi)],[],[],[]],off:[6],kap:6,devreden:0,tasan:[]}};`);
  return a;
}

test('current student view detects a frozen one-topic week after timetable upload',()=>{
  const a=staleStudentWeek(),before=a.run('JSON.stringify(D)');
  assert.equal(a.run('planHesapla(0,buHafta()).toplam'),1);
  const r=a.json('(()=>{const r=ogrenciProgramYenileOnizleme(0,buHafta());return {n:r.plan.toplam,ads:r.eklenen.map(x=>x.ad)};})()');
  assert(r.n>1);assert(r.ads.some(x=>x.includes('İki Nicel Değişkenli')));
  assert.match(a.run('gorunumOgrenciPlan()'),/id="ogrProgramYenile"/);
  assert.equal(a.run('JSON.stringify(D)'),before,'preview and rendering do not change stored plans');
});

test('explicit rebuild uses current topics, is repeatable, and preserves other weeks and results',()=>{
  const a=staleStudentWeek();
  a.run(`D.elle['0|'+(buHafta()-7)]={sabit:buHafta()-7,plan:{sentinel:'historical'}};
    D.log=[[bugunNo()-10,0,0,3,20,0,0]];D.kart['0:0']={due:bugunNo()+30};`);
  const records=a.run('JSON.stringify([D.log,D.kart,D.elle["0|"+(buHafta()-7)]])');
  assert(a.run('ogrenciPrograminiYenile(0,buHafta()).toplam')>1);
  const plan=a.json('planHesapla(0,buHafta()).gunler.map(g=>g.map(x=>x.ad))');
  assert(!plan.flat().some(x=>x.includes('Web Tabanlı')),'future curriculum topic leaves current week');
  assert(plan.slice(0,4).every(g=>g.length===0),'do not invent completed work earlier this week');
  assert(plan.flat().some(x=>x.includes('İki Nicel Değişkenli')));
  assert.equal(a.run('JSON.stringify([D.log,D.kart,D.elle["0|"+(buHafta()-7)]])'),records);
  assert.equal(a.run('ogrenciProgramYenileOnizleme(0,buHafta())'),null);
});

test('scored weeks, historical weeks, and explicitly issued weeks cannot be rebuilt',()=>{
  const a=staleStudentWeek();
  assert.equal(a.run('ogrenciProgramYenileOnizleme(0,buHafta()-7)'),null);
  a.run('D.log=[[bugunNo(),0,staleKi,3,20,0,0]]');
  assert.equal(a.run('ogrenciPrograminiYenile(0,buHafta())'),null);
  a.run('D.log=[];delete D.elle["0|"+buHafta()].ogrenciOtomatik');
  assert.equal(a.run('ogrenciProgramYenileOnizleme(0,buHafta())'),null);
});

test('a failed recovery-backup write leaves the original notebook untouched',()=>{
  const a=staleStudentWeek(),before=a.run('JSON.stringify(D)');
  a.run('localStorage.setItem=()=>{throw Error("quota")}');
  assert.throws(()=>a.run('ogrenciPrograminiYenile(0,buHafta())'),/quota/);
  assert.equal(a.run('JSON.stringify(D)'),before);
});

test('missing geometry and Turkish plans are visible and editable without borrowing other subjects',()=>{
  const a=staleStudentWeek();
  assert.deepEqual(a.json("programEksikDersleri('11-A',buHafta())"),['GEOMETRİ','TÜRKÇE']);
  const html=a.run('gorunumOgrenciPlan()');
  assert.match(html,/Konu planı eksik/);assert.match(html,/GEOMETRİ, TÜRKÇE/);
  const editor=a.run('gorunumKonuPlani()');
  assert.match(editor,/class="kpYeniAd" data-ders="GEOMETRİ"/);
});

test('school overview carries ongoing topics for display without scheduling duplicate reviews',()=>{
  const a=staleStudentWeek(),before=a.run('JSON.stringify(D)');
  const html=a.run('ogrenciProgramKapsami(0,buHafta()+7)');
  assert.match(html,/İki Nicel Değişkenli Veriler/);
  assert.match(html,/önceki başlık devam ediyor/);
  assert.equal(a.run('JSON.stringify(D)'),before);
  a.run("D.konuPlani['11-A'][1].Matematik=[]");
  assert(!a.run('ogrenciProgramKapsami(0,buHafta()+7)').includes('İki Nicel Değişkenli Veriler'),'explicit empty weeks stop continuation');
});

test('topic display omits curriculum bookkeeping while saved identities remain intact',()=>{
  const a=staleStudentWeek();a.run('ogrenciPrograminiYenile(0,buHafta())');
  const before=a.run('JSON.stringify(D)');
  for(const code of ['gorunumOgrenciPlan()','gorunumGiris()','yazdirSayfa(0,buHafta())','gorunumKonuPlani()']) {
    const html=a.run(code);assert(!/11\. sınıf · \d+\.\d+ · /.test(html),code);
  }
  assert.equal(a.run('JSON.stringify(D)'),before);
  assert(a.run("D.konuPlani['11-A'][0].Matematik[0].startsWith('11. sınıf · 1.1 · ')"));
  assert.equal(a.run("konuDuzenlemeAdi('11. sınıf · 1.1 · Eski','Yeni')"),'11. sınıf · 1.1 · Yeni');
  assert.equal(a.run("konuHtml('11. sınıf · 1.1 · <script>')"),'&lt;script&gt;');
});
