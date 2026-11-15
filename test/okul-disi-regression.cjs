#!/usr/bin/env node
'use strict';
// Okul dışı öğrenci: a student under the rehber öğretmen who sits the school's mock exams but follows no class timetable or school
// topic plan, and does their own konu anlatımı with their own plan (o.okul === false, şube OKUL_DISI_SUBE). Synthetic students only.
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
const run = code => vm.runInContext(code, sandbox), get = code => JSON.parse(JSON.stringify(run(code)));
let passed = 0;
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }
const kur = () => run(`D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-11-11';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
  D.ogr=[{no:1,ad:'SENTETİK OKULDA',sube:'12-A',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,maddeler:[],rutin:{}},
         {no:2,ad:'SENTETİK DIŞARIDA',sube:'12-A',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,maddeler:[],rutin:{}}];
  varsayilanKonuPlaniniHazirla('12-A','SAY',12);kaydet=async()=>true`);

(async () => {
  await check('a student becomes okul dışı: no class, no school topic plan; the şube lists stay the classes', () => {
    kur();
    assert.equal(run('okulDisiYap(1,true)'), true);
    assert.deepEqual(get('[D.ogr[1].okul,D.ogr[1].sube,D.ogr[1].sinif]'), [false, 'Okul dışı', 12]);
    assert.deepEqual(get('subeListesi()'), ['12-A'], 'Okul dışı is not a class');
    assert.deepEqual(get("varsayilanKonuPlaniniHazirla(OKUL_DISI_SUBE,'SAY',12)"), { olustu: false }); assert.equal(run("D.konuPlani[OKUL_DISI_SUBE]"), undefined);
    assert.equal(run('okulDisiYap(1,true)'), false, 'already');
  });
  await check('its week holds no school topic; its own plan (Kendi YKS planın) gives the konu anlatımları', () => {
    kur(); run('okulDisiYap(1,true)');
    const bu = run('buHafta(1)'), okulda = get(`planHesapla(0,${bu}).gunler.flat().map(x=>x.ki)`), disarida = get(`planHesapla(1,${bu}).gunler.flat().filter(x=>!x.serbest).map(x=>x.ki)`);
    void okulda; assert.deepEqual(disarida, [], 'no school topic before the own plan starts');
    assert.equal(run('kendiPlanTuru(D.ogr[1])'), 'YKS', 'the full YKS plan, like a student who does not go to school');
    run(`kendiPlanKur(1,Object.fromEntries(kendiPlanDersleri('SAY','YKS').map(d=>[d,'biraz'])),'2027-06-19')`);
    const hafta = get(`planHesapla(1,${bu}).gunler.flat()`);
    // The own plan starts as for any student who does not go to school: its genel tekrar weeks first, then the konu anlatımları.
    assert(hafta.length && hafta.every(x => x.gt || x.anlatim || x.serbest || run(`D.ogr[1].kendiPlan.sira.includes(${+x.ki})`)), 'every study of the week comes from the own plan');
    const sonra = get(`(()=>{for(let h=${bu},i=0;i<40;h=sonrakiHafta(1,h),i++){const l=kendiPlanHaftasi(1,h);if(l.length)return l}return []})()`);
    assert(sonra.length && sonra.every(k => run(`D.ogr[1].kendiPlan.sira.includes(${+(k.ki ?? k)})`)), 'its konu anlatımları come from the own plan');
  });
  await check('the student keeps the school number for the mock exam lists; the package carries okul: false; back to a class', () => {
    kur(); run('okulDisiYap(1,true)');
    assert.equal(run('D.ogr[1].no'), 2, 'the school number stays: the exam lists match by it');
    run("D.ogr[1].syncId='s';D.ogr[1].ogrenciBulutId='b'"); const pk = run('ogrenciPaketi(1)');
    assert.equal(pk.ogr.okul, false); assert.equal(pk.konuPlani, null, 'no school topic plan in the package');
    assert.equal(run("okulDisiYap(1,false,'12-A')"), true);
    assert.equal(run('D.ogr[1].okul'), undefined); assert.equal(run('D.ogr[1].sube'), '12-A');
  });
  await check('the Öğrenciler page offers it when adding and on each row; only the teacher can change it', () => {
    kur(); run('okulDisiYap(1,true)'); const h = run('gorunumOgrenciler()');
    assert.match(h, /<input type="checkbox" id="yOkulDisi"> Okul dışı<\/label>/);
    assert.match(h, /<span class="mini"[^>]*>Okul dışı<\/span><label[^>]*><input type="checkbox" class="oOkulDisi" data-i="1" checked> okul dışı<\/label>/);
    assert.match(h, /<input class="oSube" data-i="0" value="12-A"[^>]*><label[^>]*><input type="checkbox" class="oOkulDisi" data-i="0"> okul dışı<\/label>/);
    run("D.rol='ogrenci'"); assert.equal(run('okulDisiYap(0,true)'), false); run("D.rol='rehber'");
    run('yedekDogrula(JSON.parse(JSON.stringify(D)))');
  });
  // Tasarlanmış müfredatlar: the teacher's designed curricula travel to an okul dışı student as topic orders; the student picks one.
  const mufredatKur = () => { kur(); run(`okulDisiYap(1,true);
    D.konuPlani['12-C']=JSON.parse(JSON.stringify(D.konuPlani['12-A']));
    D.konuPlani['12-B']=JSON.parse(JSON.stringify(D.konuPlani['12-A']));D.konuPlani['12-B'].reverse();
    D.konuPlani['9-Z']=sinifaGoreKonuPlani(9,'SAY');D.mufredatSinif={'12-B':12,'12-C':12,'9-Z':9};
    D.ogr[1].syncId='s';D.ogr[1].ogrenciBulutId='b';D.ogr[0].syncId='s0';D.ogr[0].ogrenciBulutId='b0'`); };
  await check('the package carries the designed curricula to an okul dışı student only; the same curriculum is one choice', () => {
    mufredatKur();
    assert.equal(run('ogrenciPaketi(0).mufredatlar'), null, 'a student at school follows the class curriculum');
    const m = get('ogrenciPaketi(1).mufredatlar');
    assert.deepEqual(m.map(x => [x.ad, x.sinif, x.alanlar]), [['12-A, 12-C', 12, ['SAY']], ['12-B', 12, []], ['9-Z', 9, []]],
      'same content once; the student’s field and grade 12 first');
    assert(m.every(x => run('mufredatSecenegiGecerli(' + JSON.stringify(x) + ')')));
    const ilk = get(`planKonuSirasi(D.konuPlani['12-A']).filter(x=>dersEsle(x.dersAd)>=0).map(x=>x.dersAd+'|'+x.ad)`);
    assert.deepEqual(m[0].k.map(([d, ad]) => m[0].d[d] + '|' + ad), ilk, 'the topic order of the curriculum, week by week');
    assert(run('baytBoyu(JSON.stringify(ogrenciPaketi(1).mufredatlar))') <= run('OKUL_DISI_MUFREDAT_BAYT'));
  });
  await check('the student picks one in Ayarlar: the plan follows its topics in its order; switching keeps the plan going', () => {
    mufredatKur(); const pk = JSON.stringify(run('ogrenciPaketi(1)'));
    run(`D=paketiYukle(${pk});EK.ogr=0;kaydet=async()=>true`);
    assert.equal(run('ogrenciMi()'), true);
    assert.match(run('kendiPlanKarti(0)'), /<select id="kpMufredat" style="max-width:100%"><option value="">Hazır YKS planı<\/option><option value="12-A, 12-C">12-A, 12-C müfredatı · 12\. sınıf · SAY<\/option>/);
    run(`EK.kpMufredat='12-B'`); assert.match(run('kendiPlanKarti(0)'), /<option value="12-B" selected>12-B müfredatı · 12\. sınıf<\/option>/);
    run(`kendiPlanKur(0,{},'2027-06-19',mufredatSecenegiAl('12-B'))`);
    assert.equal(run('D.ogr[0].kendiPlan.mufredat'), '12-B');
    // Each topic of the curriculum in its order (a catalog topic may carry its own, slightly different name).
    const ilk12B = get('D.ogr[0].kendiPlan.sira');
    assert(get(`(()=>{const m=mufredatSecenegiAl('12-B');return m.k.slice(0,30).map(([d,ad],i)=>{const a=iskelet(konuAl(D.ogr[0].kendiPlan.sira[i])[3]),b=iskelet(ad);
      return a===b||a.startsWith(b)||b.startsWith(a)})})()`).every(Boolean), 'the topics come in the curriculum’s order');
    assert.match(run('kendiPlanKarti(0)'), /<option value="12-B" selected>/);
    run(`kendiPlanMufredatDegistir(0,mufredatSecenegiAl('9-Z'))`);
    assert.equal(run('D.ogr[0].kendiPlan.mufredat'), '9-Z');
    assert(run('D.ogr[0].kendiPlan.sira.length>50 && D.ogr[0].kendiPlan.sira.every(ki=>konuAl(ki)[1]===9)'), 'grade-9 topics, as the 9th grade curriculum names them');
    assert.equal(run(`D.ogr[0].kendiPlan.hedef`), '2027-06-19', 'the target date stays');
    run('kendiPlanMufredatDegistir(0,null)');
    assert.equal(run('D.ogr[0].kendiPlan.mufredat'), undefined);
    assert.deepEqual(get('D.ogr[0].kendiPlan.sira'), get('kendiPlanSirasi(0,null)'), 'back to the ready YKS plan');
    assert.equal(run('D.ogr[0].kendiPlan.sira.length'), run(`kendiPlanKonulari('SAY','YKS').length`));
    const konuSayisi = run('konuSayisi()');
    run(`kendiPlanMufredatDegistir(0,mufredatSecenegiAl('12-B'))`);
    assert.deepEqual(get('D.ogr[0].kendiPlan.sira'), ilk12B, 'switching back finds the same topics');
    assert.equal(run('konuSayisi()'), konuSayisi, 'no duplicate topic is opened when the plan is rebuilt');
    run('yedekDogrula(JSON.parse(JSON.stringify(D)))');
    assert.equal(JSON.parse(run('ogrenciCalismaPaketi().veri')).mufredatSecenek, undefined, 'the curricula do not travel back with the work');
    assert.throws(() => run(`(()=>{const y=JSON.parse(JSON.stringify(D));y.ogr[0].kendiPlan.mufredat='x'.repeat(121);yedekDogrula(y)})()`), /Geçersiz kendi TYT planı/);
    assert.throws(() => run(`(()=>{const y=JSON.parse(JSON.stringify(D));y.mufredatSecenek[0].k[0][0]=99;yedekDogrula(y)})()`), /Geçersiz müfredat seçenekleri/);
  });
  await check('a student at school gets no choice; the teacher sees the chosen curriculum on the student row', () => {
    mufredatKur(); const okulda = JSON.stringify(run('ogrenciPaketi(0)')), secenek = JSON.stringify(run('ogrenciPaketi(1).mufredatlar'));
    run(`D=paketiYukle(${okulda});EK.ogr=0;D.mufredatSecenek=${secenek}`);
    assert.doesNotMatch(run('kendiPlanKarti(0)'), /kpMufredat/, 'the school student’s own TYT plan has no curriculum choice');
    run(`kendiPlanKur(0,{},'2027-06-19',mufredatSecenegiAl('12-B'))`); assert.equal(run('D.ogr[0].kendiPlan.mufredat'), undefined);
    mufredatKur(); run(`D.ogr[1].kendiPlan={tur:'YKS',hedef:'2027-06-19',seviye:{},sira:[],anlatimGerek:{},mufredat:'12-B'}`);
    assert.match(run('gorunumOgrenciler()'), />Okul dışı · 12-B müfredatı<\/span>/);
  });
  await check('a grade-12 curriculum without some YKS lessons (old SAY plans: no TYT sosyal) gets them from the ready YKS plan, spread through it', () => {
    mufredatKur(); run(`D.konuPlani['12-ESKI']=JSON.parse(JSON.stringify(VARSAYILAN_KONU_PLANI.SAY));D.mufredatSinif['12-ESKI']=12`);
    const pk = JSON.stringify(run('ogrenciPaketi(1)'));
    run(`D=paketiYukle(${pk});EK.ogr=0;kaydet=async()=>true`);
    const m = get(`mufredatSecenegiAl('12-ESKI')`);
    assert.deepEqual(m.d.slice().sort(), ['Biyoloji', 'Fizik', 'Geometri', 'Kimya', 'Matematik AYT', 'Matematik TYT', 'Türkçe'], 'the old plan has no TYT sosyal');
    const dersler = get(`kendiPlanDersleri('SAY','YKS',mufredatSecenegiAl('12-ESKI'))`);
    for (const d of ['Tarih', 'Coğrafya', 'Felsefe', 'Din Kültürü']) assert(dersler.includes(d), d + ' is added');
    const liste = get(`kendiPlanKonulari('SAY','YKS',mufredatSecenegiAl('12-ESKI'))`);
    assert.deepEqual(liste.filter(x => m.d.includes(x.dersAd)).map(x => x.dersAd + '|' + x.ad), m.k.map(([d, ad]) => m.d[d] + '|' + ad), 'the curriculum keeps its own order');
    const sosyal = liste.map((x, i) => ['Tarih', 'Coğrafya', 'Felsefe', 'Din Kültürü'].includes(x.dersAd) ? i : -1).filter(i => i >= 0);
    assert(sosyal[0] < liste.length / 4 && sosyal[sosyal.length - 1] > liste.length * 3 / 4, 'spread through the order, not piled at the end');
    const kart = run(`EK.kpMufredat='12-ESKI';kendiPlanKarti(0)`);
    assert.match(kart, /araya eklenir: <b>[^<]*Tarih[^<]*<\/b>/); for (const d of ['Coğrafya', 'Felsefe', 'Din Kültürü']) assert(kart.includes(d));
    // A complete grade-12 curriculum and a grade-9 one are taken as they are.
    assert.equal(get(`kendiPlanKonulari('SAY','YKS',mufredatSecenegiAl('12-A, 12-C')).length`), get(`mufredatSecenegiAl('12-A, 12-C').k.length`));
    assert.equal(get(`kendiPlanKonulari('SAY','YKS',mufredatSecenegiAl('9-Z')).length`), get(`mufredatSecenegiAl('9-Z').k.length`));
    assert.doesNotMatch(run(`EK.kpMufredat='12-A, 12-C';kendiPlanKarti(0)`), /araya eklenir/);
    run(`kendiPlanKur(0,{},'2027-06-19',mufredatSecenegiAl('12-ESKI'))`);
    assert(run(`D.ogr[0].kendiPlan.sira.some(ki=>dersEsle(konuDersAdi(ki))===5)`), 'the plan holds Tarih topics');
  });
  await check('the teacher’s package carries the own plan’s topics (outside the catalog too), so the student view opens', () => {
    mufredatKur(); run(`kendiPlanKur(1,{},'2027-06-19',null);D.ogr[1].kendiPlan.anlatimGerek={[D.ogr[1].kendiPlan.sira.find(ki=>ki>=KATALOG.length)]:bugunNo()}`);
    assert(run('D.ogr[1].kendiPlan.sira.some(ki=>ki>=KATALOG.length)'), 'the plan holds topics outside the catalog');
    const adlar = get('D.ogr[1].kendiPlan.sira.map(ki=>konuAl(ki)[3])');
    run(`y=paketiYukle(JSON.parse(JSON.stringify(ogrenciPaketi(1))));yedekDogrula(y);D=y`);
    assert.deepEqual(get('D.ogr[0].kendiPlan.sira.map(ki=>konuAl(ki)[3])'), adlar, 'the same topics, renumbered');
    assert(run('Object.keys(D.ogr[0].kendiPlan.anlatimGerek).every(k=>konuAl(+k))'));
    // A package published before this carried no such topics: it still opens, the missing topics drop out of the plan.
    mufredatKur(); run(`kendiPlanKur(1,{},'2027-06-19',null);eski=JSON.parse(JSON.stringify(ogrenciPaketi(1)));
      eski.ekKonular={};eski.ogr.kendiPlan.sira.push(KATALOG.length+5000);y=paketiYukle(eski);yedekDogrula(y)`);
    assert(run('y.ogr[0].kendiPlan.sira.length>0&&y.ogr[0].kendiPlan.sira.every(ki=>konuAl.call(null,ki)!==undefined||ki<KATALOG.length)'));
    run(`D.ogr[1].kendiPlan.sira.push(KATALOG.length+5000)`); assert.doesNotThrow(() => run('ogrenciPaketi(1)'), 'a missing topic does not stop the teacher’s package');
  });
  console.log(passed + ' okul dışı checks passed');
})();
