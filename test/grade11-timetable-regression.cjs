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
  a.run(`D.konuPlani['11-A']=okulKonuPlani(11,false);D.ogr=D.ogr.slice(0,1);D.ogr[0].alan='EA';D.ogr[0].off=[6];D.ogr[0].aktif=true;
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

test('every Grade 11 school week has a distinct, sourced subtopic with its main topic',()=>{
  const a=app(),data=JSON.parse(readFileSync('data/curriculum-2026-2027.json','utf8'));
  const plan=a.json('okulKonuPlani(11)');
  assert.equal(plan.length,36);
  for(const c of data.siniflar[11]) {
    const titles=plan.flatMap(w=>w[c.ad]||[]);
    assert.equal(titles.length,36,c.ad);assert.equal(new Set(titles).size,36,c.ad);
    for(const title of titles) {
      assert(title.length<=160,title);
      const m=a.json(`mufredatKonuBilgisi(${c.ders},${JSON.stringify(title)})`);
      assert(m?.anaKonu&&m.altKonu&&m.ciktilar.length,title);
      assert(a.run(`konuGorunenAdi(${JSON.stringify(title)})`).startsWith(m.anaKonu+' — '));
      const u=c.uniteler.find(u=>u.kaynak===m.kaynak);
      assert(m.ciktilar.every(k=>u.ciktiKodlari.includes(k)));
    }
    let hours=0,weeks=0;const total=c.uniteler.reduce((s,u)=>s+u.saat,0);
    for(const u of c.uniteler) {
      hours+=u.saat;weeks+=u.haftalikKazanimlar.length;
      assert.equal(weeks,Math.round(36*hours/total),'unit boundaries follow instructional hours');
      assert.deepEqual([...new Set(u.haftalikKazanimlar.flatMap(x=>x.ciktilar))].sort(),[...u.ciktiKodlari].sort(),'all official unit outcomes covered');
    }
  }
  assert.deepEqual(plan.slice(0,4).map(w=>a.run(`konuGorunenAdi(${JSON.stringify(w.Matematik[0])})`)),[
    'İstatistiksel Araştırma Süreci — Araştırma sorusu ve veri toplama planı',
    'İstatistiksel Araştırma Süreci — Veriyi hazırlama ve gösterim aracını seçme',
    'İstatistiksel Araştırma Süreci — Veriyi analiz etme ve bulguları yorumlama',
    'İstatistiksel Araştırma Süreci — Sonuçları değerlendirme; hata ve yanlılıkları ayırt etme'
  ]);
  assert(plan[4].Matematik[0].includes('Geometrik Şekiller'));
});

test('successive subtopics get separate timetable identities and keep TYT independent',()=>{
  const a=app();a.schedule([['MATEMATİK'],['TYT MATEMATİK']]);
  const ids=[];
  for(let w=0;w<4;w++) {
    ids.push(a.json(`hucreKonulari('11-A',gunNo('2026-09-21')+${w}*7,0,'MATEMATİK')`)[0]);
  }
  assert.equal(new Set(ids).size,4);
  assert(ids.every(id=>a.run(`konuSinavTuru(${id})`)==='AYT'));
  assert(ids.every(id=>a.run(`konuAl(${id})[3].includes('İstatistiksel Araştırma Süreci')`)));
  const before=a.json('({log:D.log,kart:D.kart})');
  a.run('D=paketiYukle(ogrenciPaketi(0))');
  assert.deepEqual(a.json('({log:D.log,kart:D.kart})'),before);
  for(const id of ids)assert(a.run(`!!mufredatKonuBilgisi(1,konuAl(${id})[3])`));
});

test('outcome upgrade preview is pure and rebuilding the stale automatic week needs one action',()=>{
  const a=staleStudentWeek(),before=a.run('JSON.stringify(D)'),tyt=a.json("D.konuPlani['11-A'].map(w=>w['Matematik TYT'])");
  const r=a.json("kazanimPlaniOnizleme('11-A')");
  assert.equal(r.degisimler.length,9);assert(r.degisimler.every(x=>!x.ozel));
  assert.match(a.run('gorunumOgrenciPlan()'),/Seçili derslere haftalık alt konuları uygula/);
  assert.equal(a.run('JSON.stringify(D)'),before);
  a.run(`let savedOutcomeBackup;localStorage.setItem=(k,v)=>{if(k==='yks_kazanim_plani_oncesi')savedOutcomeBackup=v};
    kazanimPlaniniUygula('11-A',kazanimPlaniOnizleme('11-A').degisimler.map(x=>x.ders))`);
  assert.equal(a.run('savedOutcomeBackup'),before);
  assert.equal(a.run("kazanimPlaniOnizleme('11-A')"),null);
  assert(a.run('planHesapla(0,buHafta()).toplam')>1);
  assert(a.json('planHesapla(0,buHafta()).gunler.flat().map(x=>x.ad)').some(t=>t.includes('İstatistiksel Araştırma Süreci —')));
  assert.deepEqual(a.json("D.konuPlani['11-A'].map(w=>w['Matematik TYT'])"),tyt);
  const after=a.run('JSON.stringify(D)');a.run("kazanimPlaniniUygula('11-A',['Matematik'])");
  assert.equal(a.run('JSON.stringify(D)'),after);
});

test('outcome upgrade leaves recorded, historical and issued future weeks unchanged',()=>{
  const a=staleStudentWeek();
  a.run(`D.ayar.testTarih='2026-09-30';const weekTwo=buHafta();
    D.log=[[weekTwo,0,staleKi,3,20,0,0]];D.kart['0:'+staleKi]={due:weekTwo+28,n:1};
    D.elle['0|'+(weekTwo+7)]={sabit:weekTwo+7,plan:{sentinel:'issued future'}};`);
  const records=a.json('({log:D.log,kart:D.kart,elle:D.elle,ek:D.ekKonular})');
  const original=a.json("D.konuPlani['11-A']");
  const dates=a.json("D.subeIslenis['11-A']");
  a.run("kazanimPlaniniUygula('11-A',kazanimPlaniOnizleme('11-A').degisimler.map(x=>x.ders))");
  const updated=a.json("D.konuPlani['11-A']");
  for(let w=0;w<3;w++)assert.deepEqual(updated[w],original[w],'protected week '+w);
  assert(updated[3].Matematik[0].includes('hata ve yanlılıkları'));
  assert.deepEqual(a.json('({log:D.log,kart:D.kart,elle:D.elle})'),{log:records.log,kart:records.kart,elle:records.elle});
  assert.deepEqual(a.json('D.ekKonular').slice(0,records.ek.length),records.ek,'existing topic indexes retain identity');
  for(const [id,date] of Object.entries(dates))if(date<a.run('weekTwo+14'))assert.equal(a.run(`D.subeIslenis['11-A'][${id}]`),date);
});

test('edited and empty courses are opt-in, and selecting one course preserves the others',()=>{
  const a=staleStudentWeek();
  a.run("D.konuPlani['11-A'][0].Matematik=['Özel okul konusu'];D.konuPlani['11-A'].forEach(w=>w.Felsefe=[])");
  const before=a.json("D.konuPlani['11-A']"),r=a.json("kazanimPlaniOnizleme('11-A')");
  assert(r.degisimler.find(x=>x.ders==='Matematik').ozel);assert(r.degisimler.find(x=>x.ders==='Felsefe').ozel);
  const html=a.run("kazanimPlaniUyarisi('11-A')");
  assert.match(html,/data-ders="Matematik">/);assert(!html.includes('data-ders="Matematik" checked'));
  assert.equal(a.run("kazanimPlaniniUygula('11-A',[])"),null);
  a.run("kazanimPlaniniUygula('11-A',['Matematik'])");
  const after=a.json("D.konuPlani['11-A']");
  assert(after[0].Matematik[0].includes('Araştırma sorusu'));
  for(let w=0;w<36;w++) {
    delete before[w].Matematik;delete after[w].Matematik;assert.deepEqual(after[w],before[w]);
  }
  assert.equal(a.run("kazanimPlaniOnizleme('12-A')"),null);
});

test('failed outcome backup is atomic and a changed reporting cycle protects overlapping weeks',()=>{
  const a=staleStudentWeek(),before=a.run('JSON.stringify(D)');
  a.run('localStorage.setItem=()=>{throw Error("quota")}');
  assert.throws(()=>a.run("kazanimPlaniniUygula('11-A',['Matematik'])"),/quota/);
  assert.equal(a.run('JSON.stringify(D)'),before);
  a.run(`D.ogr[0].haftaDuzeni={at:1,donemler:[{bas:gunNo('2026-09-23'),gun:2}]};
    D.elle['0|'+gunNo('2026-09-23')]={sabit:gunNo('2026-09-23'),plan:{sentinel:'issued Wednesday'}};`);
  const r=a.json("kazanimPlaniOnizleme('11-A')");
  assert(r.korunan.includes(0));assert(r.korunan.includes(1),'Wednesday cycle protects following Monday and Tuesday');
});

test('retired broad-topic catch-up dates cannot crowd out the weekly subtopics',()=>{
  const a=staleStudentWeek();
  a.run(`const oldMath=+Object.keys(D.subeIslenis['11-A']).find(k=>D.konuDers[k]==='Matematik');
    D.ogrIslenis={0:{[oldMath]:buHafta()-7}};
    D.ogr.push({ad:'Independent branch',sube:'11-C',sinif:11,alan:'EA'});
    D.subeIslenis['11-C']={[oldMath]:buHafta()-7};`);
  const row=a.json('konuAl(oldMath)');
  a.run("kazanimPlaniniUygula('11-A',['Matematik'])");
  assert.equal(a.run('D.ogrIslenis[0][oldMath]'),undefined);
  assert.equal(a.run("D.subeIslenis['11-A'][oldMath]"),undefined);
  assert.equal(a.run("D.subeIslenis['11-C'][oldMath]"),a.run('buHafta()-7'));
  assert.deepEqual(a.json('konuAl(oldMath)'),row);
  assert(!a.json('planHesapla(0,buHafta()).gunler.flat().map(x=>x.ki)').includes(a.run('oldMath')));
});

test('retiring old headings retains scored and explicitly added personal topics',()=>{
  for(const protection of ['card','manual']) {
    const a=staleStudentWeek();
    a.run(`const oldMath=+Object.keys(D.subeIslenis['11-A']).find(k=>D.konuDers[k]==='Matematik');
      D.subeIslenis['11-A'][oldMath]=buHafta()-7;D.ogrIslenis={0:{[oldMath]:buHafta()-7}};`);
    if(protection==='card')a.run('D.kart["0:"+oldMath]={due:buHafta()+14,n:1}');
    else a.run('D.elle["0|"+buHafta()].ek.push(oldMath)');
    const before=a.run('JSON.stringify(D.ogrIslenis)');
    a.run("kazanimPlaniniUygula('11-A',['Matematik'])");
    assert.equal(a.run('JSON.stringify(D.ogrIslenis)'),before,protection);
    assert.equal(a.run("D.subeIslenis['11-A'][oldMath]"),a.run('buHafta()-7'));
  }
});
