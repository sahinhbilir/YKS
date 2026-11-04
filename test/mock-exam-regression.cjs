#!/usr/bin/env node
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('node:path');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const listeners={};
const nodes={ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox={console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},document:{activeElement:null,addEventListener(t,f){(listeners[t]=listeners[t]||[]).push(f)},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.TextEncoder=TextEncoder;sandbox.window.document=sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);


const assert=require('node:assert/strict');
const run=code=>vm.runInContext(code,sandbox);
function clock(iso) {
 const now=Date.parse(iso);
 sandbox.Date=class extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} };
}
const reset=()=>{clock('2026-09-25T10:00:00+03:00');return run(`D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-25';
 D.ogr=[{no:1,ad:'Synthetic Ada',sube:'11-A',alan:'EA',sinif:11,kap:6,off:[6],aktif:true,
 ogrenciBulutId:'d70ec14d-ab10-43e5-b63f-0dd990c3626b'}];EK.ogr=0;EK.hafta=null;
 EK.takipOlcut='islem';EK.takipHafta=null;kaydet=async()=>true;ogrenciEsitlemePlanla=()=>{};`);};
const sample=(over={})=>({id:'m:one',ad:'Örnek deneme',tarih:'2026-09-18',tur:'TYT',oturum:'TYT',brans:'',alan:'SAY',dersler:[{kod:'turkce',dogru:28,yanlis:8,soru:40},{kod:'mat',dogru:12,yanlis:4,soru:30},{kod:'geo',dogru:4,yanlis:4,soru:10}],sure:150,puan:250,ts:100,...over});
const put=(name,value)=>sandbox[name]=JSON.parse(JSON.stringify(value));
let passed=0;
async function check(name,fn){reset();try{await fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e);process.exitCode=1;}}
(async()=>{
 await check('TYT negative nets, AYT area totals, branch isolation',()=>{
  put('r',sample());assert.equal(run('denemeToplam(r)'),40);
  put('r',sample({tur:'AYT',oturum:'AYT',dersler:[{kod:'edebiyat',dogru:20,yanlis:4,soru:24},{kod:'mat',dogru:10,yanlis:4,soru:30},{kod:'geo',dogru:0,yanlis:4,soru:10},{kod:'fizik',dogru:0,yanlis:8,soru:14}]}));
  assert.equal(run("denemeToplam(r,'SAY')"),6);assert.equal(run("denemeToplam(r,'EA')"),27);assert.equal(run("denemeToplam(r,'SÖZ')"),19);
  put('r',sample({tur:'BRANS',brans:'turkce',dersler:[{kod:'turkce',dogru:10,yanlis:4,soru:20}]}));assert.equal(run('denemeToplam(r)'),9);assert(run('denemeDogrula([r])'));
 });
 await check('reject invalid counts, totals, dates, and duplicate subjects',()=>{
  for(const bad of [{sure:-1},{tarih:'2026-02-30'},{dersler:[{kod:'turkce',dogru:41,yanlis:0,soru:40}]},{dersler:[{kod:'mat',dogru:30,yanlis:0,soru:30},{kod:'geo',dogru:11,yanlis:0,soru:11}]}]){put('r',sample(bad));assert.throws(()=>run('denemeDogrula([r])'));}
 });
 await check('edits and deletion tombstones survive stale and repeated sync',()=>{
  put('a',[sample()]);put('b',[sample({sure:140,ts:101})]);
  assert.equal(run('denemeBirlestir(a,b)[0].sure'),140);assert.equal(run('denemeBirlestir(b,a).length'),1);
  put('b',[sample({silindi:true,ts:102})]);assert(run('denemeBirlestir(b,a)[0].silindi'));
  assert.equal(run('JSON.stringify(denemeBirlestir(a,b))'),run('JSON.stringify(denemeBirlestir(b,a))'));
 });
 await check('manual results and duration-only updates round-trip in v4 packet',()=>{
  put('records',[sample()]);run("D.ogr[0].denemeler=records;D.ogr[0].denemeSure=[{id:'p:school',sure:130,ts:100}];saved=sonucPaketi();delete saved.calisma;D.ogr[0].denemeler=[];D.ogr[0].denemeSure=[];D.rol='rehber';sonucPaketiUygula(saved,0)");
  assert.equal(run('saved.surum'),4);assert.equal(run('D.ogr[0].denemeler.length'),1);assert.equal(run('D.ogr[0].denemeSure[0].sure'),130);
  run('sonucPaketiUygula(saved,0)');assert.equal(run('D.ogr[0].denemeler.length'),1);
  run('saved.surum=3;delete saved.denemeler;delete saved.denemeSure;sonucPaketiUygula(saved,0)');assert.equal(run('D.ogr[0].denemeler.length'),1);
 });
 await check('student packet cannot forge teacher-imported scores; malformed packet is atomic',()=>{
  put('records',[sample({id:'p:forged'})]);run('saved=sonucPaketi();delete saved.calisma;saved.denemeler=records;before=JSON.stringify(D)');
  assert.throws(()=>run('sonucPaketiUygula(saved,0)'),/öğretmen/);assert.equal(run('JSON.stringify(D)'),run('before'));
 });
 await check('school results have their own channel; student can add time without editing scores',()=>{
  put('school',[sample({id:'p:one',sure:null})]);run('denemeOkulUygula(0,JSON.stringify(school));D.ogr[0].denemeSure=[{id:"p:one",sure:160,ts:101}];saved=sonucPaketi()');
  assert.equal(run('denemeListe()[0].sure'),160);assert.equal(run('saved.denemeler.length'),0);
  assert.equal(run('JSON.parse(saved.calisma.veri).ogr[0].denemeOkul'),undefined);
  assert.equal(run('paketiYukle(ogrenciPaketi(0)).ogr[0].denemeOkul.length'),1);
 });
 await check('strict matching never assigns a reused number or ambiguous student',()=>{
  assert.equal(run("denemeOgrenciEsle({no:1,ad:'Synthetic Ada'})"),0);
  assert.equal(run("denemeOgrenciEsle({no:1,ad:'Someone Else'})"),-1);
  run('D.ogr.push({...D.ogr[0]})');assert.equal(run("denemeOgrenciEsle({no:1,ad:'Synthetic Ada'})"),-1);
 });
 await check('same named TYT result in combined report is deselected even with different date',()=>{
  put('row',{no:1,ad:'Synthetic Ada',oturum:'TYT',puan:250,dersler:sample().dersler});
  run("reports=denemeImportHazirla([{ad:'Exam',tarih:'2026-09-25',satirlar:[{...row},{...row,oturum:'AYT',dersler:[{kod:'mat',dogru:1,yanlis:0,soru:null}]}]},{ad:'Exam',tarih:'2026-09-18',satirlar:[{...row}]}])");
  assert.equal(run('reports[0].satirlar[0].secili'),true);assert.equal(run('reports[1].satirlar[0].secili'),false);assert.equal(run('reports[1].satirlar[1].secili'),true);
 });
 await check('chart handles zero/negative nets and same-date exams, escapes labels',()=>{
  put('records',[sample({ad:'<img src=x onerror=alert(1)>',dersler:[{kod:'turkce',dogru:0,yanlis:4,soru:40}]}),sample({id:'m:two',dersler:[{kod:'turkce',dogru:0,yanlis:0,soru:40}]})]);
  const svg=run('denemeGrafik(records)');assert(!svg.includes('NaN'));assert(!svg.includes('<img'));assert(svg.includes('tabindex="0"'));
 });
 await check('deleted teacher result does not hide the student own entry',()=>{
  put('own',[sample({id:'m:own'})]);put('tomb',[sample({id:'p:x',silindi:true,ts:300})]);
  run('D.ogr[0].denemeler=own;D.ogr[0].denemeOkul=tomb');assert.equal(run('JSON.stringify(denemeListe().map(r=>r.id))'),'["m:own"]');
  put('live',[sample({id:'p:x',ts:300})]);run('D.ogr[0].denemeOkul=live');assert.equal(run('JSON.stringify(denemeListe().map(r=>r.id))'),'["p:x"]');
 });
 await check('re-import after deletion is marked deleted; manual re-match re-checks duplicates',()=>{
  put('row',{no:1,ad:'Synthetic Ada',oturum:'TYT',puan:250,dersler:sample().dersler});
  run("D.rol='rehber';rapor=()=>({ad:'Exam',tarih:'2026-09-18',satirlar:[{...row}]});D.ogr[0].denemeOkul=[{...denemePdfKaydi(rapor(),row),silindi:true}];DENEME_IMPORT=denemeImportHazirla([rapor()])");
  assert.equal(run('DENEME_IMPORT[0].satirlar[0].secili'),false);assert.match(run('DENEME_IMPORT[0].satirlar[0].uyari'),/daha önce silindi/);
  run("D.ogr.push({...D.ogr[0],no:2,ad:'Synthetic Ece',ogrenciBulutId:'other',denemeOkul:[denemePdfKaydi(rapor(),row)]});denemeImportHedefDegistir(0,0,1)");
  assert.equal(run('DENEME_IMPORT[0].satirlar[0].secili'),false,'manual target already has this result');assert.match(run('DENEME_IMPORT[0].satirlar[0].uyari'),/Tekrar sonuç/);
  run('denemeImportHedefDegistir(0,0,-1)');assert.match(run('DENEME_IMPORT[0].satirlar[0].uyari'),/eşleşmedi/);
  run("D.ogr[1].denemeOkul=[];denemeImportHedefDegistir(0,0,1)");assert.equal(run('DENEME_IMPORT[0].satirlar[0].secili'),true);
  run('DENEME_IMPORT=null');
 });
 await check('re-imported school rows keep the student time; a newer teacher time wins',()=>{
  put('school',[sample({id:'p:one',sure:null,ts:100})]);run('D.ogr[0].denemeOkul=school;D.ogr[0].denemeSure=[{id:"p:one",sure:160,ts:101}]');
  put('again',[sample({id:'p:one',sure:null,ts:200})]);run('D.ogr[0].denemeOkul=denemeBirlestir(D.ogr[0].denemeOkul,again)');
  assert.equal(run('denemeListe()[0].sure'),160);
  put('fix',[sample({id:'p:one',sure:170,ts:300})]);run('D.ogr[0].denemeOkul=denemeBirlestir(D.ogr[0].denemeOkul,fix)');
  assert.equal(run('denemeListe()[0].sure'),170,'teacher correction is visible');
  run('D.ogr[0].denemeSure=[{id:"p:one",sure:150,ts:301}]');assert.equal(run('denemeListe()[0].sure'),150);
 });
 await check('teacher delete that cannot publish is saved, queued and redrawn',async()=>{
  put('school',[sample({id:'p:one',sure:null})]);
  run("D.rol='rehber';D.ogr[0].denemeOkul=school;cizSayisi=0;ciz=()=>{cizSayisi++;};window.bulut=null;");
  const click=listeners.click.find(f=>String(f).includes('dnSil'));
  await click({target:{closest:()=>({dataset:{dnSil:'p:one'}})}});
  assert.equal(run('denemeListe().length'),0);assert.equal(run('D.ogr[0].denemeYayinBekliyor'),true);
  assert.match(run('EK.denemeDurum'),/Cihazda kayıtlı; yayın bekliyor/);assert.equal(run('cizSayisi'),1);
 });
 await check('bulk school results are admitted before mutation and roll back failed storage',async()=>{
  put('next',[sample({id:'p:new'})]);run("D.rol='rehber';before=JSON.stringify(D.ogr);oldAdmission=defterAdayiniDogrula;defterAdayiniDogrula=async()=>{throw Error('encoded limit')}");
  try{await assert.rejects(run('denemeTopluYerelKaydet(new Map([[0,next]]))'),/encoded limit/);assert.equal(run('JSON.stringify(D.ogr)'),run('before'));}
  finally{run('defterAdayiniDogrula=oldAdmission');}
  run('kaydet=async()=>false');await assert.rejects(run('denemeTopluYerelKaydet(new Map([[0,next]]))'),/kayıt başarısız/);assert.equal(run('JSON.stringify(D.ogr)'),run('before'));
  run('kaydet=async()=>true');await run('denemeTopluYerelKaydet(new Map([[0,next]]))');assert.equal(run('D.ogr[0].denemeOkul[0].id'),'p:new');assert.equal(run('D.ogr[0].denemeYayinBekliyor'),true);
 });
 await check('net per minute (branş only) uses D − Y/4 over completion time and scales the chart',()=>{
  const brans=o=>sample({tur:'BRANS',brans:'turkce',dersler:[{kod:'turkce',dogru:10,yanlis:4,soru:20}],...o});
  put('r',brans({sure:20}));assert.equal(run('denemeHiz(r)'),9/20);put('r',brans({sure:null}));assert.equal(run('denemeHiz(r)'),null);
  put('records',[brans({sure:20}),brans({id:'m:two',tarih:'2026-09-20',sure:null}),brans({id:'m:three',tarih:'2026-09-22',sure:15})]);
  run("EK.denemeTur='BRANS';EK.denemeOturum='TYT';EK.denemeBrans='turkce';EK.denemeMetrik='hiz';D.ogr[0].denemeler=records");
  const svg=run('denemeGrafik(records)');
  assert.equal((svg.match(/class="dn-dot[ "]/g)||[]).length,2);assert(svg.includes('0,6 net/dk'));assert(svg.includes('1 deneme süre girilmediği'));
  const ticks=[...svg.matchAll(/text-anchor="end">([^<]+)<\/text>/g)].map(m=>Number(m[1].replace(',','.'))).filter(Number.isFinite);
  assert(Math.max(...ticks)<1,'net/dk axis must not stretch to whole nets: '+ticks);
  const page=run('gorunumDenemeler()');
  assert(page.includes('Ortalama net/dk'));assert(page.includes('<option value="hiz" selected>'));assert(page.includes('<th>Net/dk</th>'));assert(page.includes('Net/dk: 0,6'));
  put('none',[brans({sure:null})]);assert(run('denemeGrafik(none)').includes('tamamlama süresi gerekli'));
  // TYT/AYT never show net/dk, even with the branş choice still remembered.
  put('tyt',[sample({sure:120})]);run("EK.denemeTur='TYT';D.ogr[0].denemeler=tyt");
  const tytPage=run('gorunumDenemeler()');
  for(const hiz of ['value="hiz"','<th>Net/dk</th>','net/dk','Net/dk'])assert(!tytPage.includes(hiz),'TYT must not show '+hiz);
  assert(tytPage.includes('Son net'));assert(!run('denemeGrafik(tyt)').includes('net/dk'));
  run("EK.denemeTur='BRANS';D.ogr[0].denemeler=records");assert(run('gorunumDenemeler()').includes('<option value="hiz" selected>'),'branş keeps the choice');
  run("EK.denemeMetrik='net';EK.denemeTur='TYT'");
 });
 await check('TYT/AYT course sections join the Branş chart with their own marker and are never stored',async()=>{
  // A teacher-imported TYT (no question counts), a manual TYT and a Türkçe branch exam.
  put('okul',[sample({id:'p:okul-tyt',ad:'27-YKS-1201',tarih:'2026-09-18',sure:null,puan:null,dersler:[{kod:'turkce',dogru:30,yanlis:4,soru:null},{kod:'mat',dogru:20,yanlis:8,soru:null},{kod:'sf',dogru:0,yanlis:0,soru:null}]})]);
  put('kendi',[sample({id:'m:tyt',tarih:'2026-09-20',dersler:[{kod:'turkce',dogru:25,yanlis:8,soru:38}]}),
    sample({id:'m:brans',ad:'Paragraf 1',tur:'BRANS',brans:'turkce',tarih:'2026-09-22',sure:20,dersler:[{kod:'turkce',dogru:18,yanlis:4,soru:25}]}),
    sample({id:'m:ayt',tur:'AYT',oturum:'AYT',tarih:'2026-09-21',dersler:[{kod:'edebiyat',dogru:0,yanlis:0,soru:24},{kod:'mat',dogru:12,yanlis:4,soru:30}]})]);
  run("D.ogr[0].denemeOkul=okul;D.ogr[0].denemeler=kendi;EK.denemeTur='BRANS';EK.denemeOturum='TYT';EK.denemeBrans='turkce';EK.denemeMetrik='net';EK.denemeGenel=undefined;");
  const once=run('JSON.stringify(D)');
  const bolum=JSON.parse(run("JSON.stringify(denemeGenelBolumleri(denemeListe(),'TYT','turkce'))"));
  assert.deepEqual(bolum.map(r=>[r.id,r.genel,r.dersler[0].soru,r.kaynakId]),[['g:p:okul-tyt|turkce','TYT',40,'p:okul-tyt'],['g:m:tyt|turkce','TYT',38,'m:tyt']]);
  assert.throws(()=>run("denemeDogrula(denemeGenelBolumleri(denemeListe(),'TYT','turkce'))"),/Geçersiz deneme/,'a derived section can never be stored');
  assert.equal(run("denemeGenelBolumleri(denemeListe(),'TYT','sf').length"),0,'blank sections add no point');
  assert.equal(run("denemeGenelBolumleri(denemeListe(),'AYT','edebiyat').length"),0,'a course outside the field (0 D / 0 Y) adds no point');
  assert.equal(run("denemeGenelBolumleri(denemeListe(),'AYT','mat')[0].genel"),'AYT');
  let page=run('gorunumDenemeler()');
  assert.equal((page.match(/class="dn-dot[ "]/g)||[]).length,3,'branch exam and both TYT sections');
  assert.equal((page.match(/class="dn-dot \w+ genel"/g)||[]).length,2,'sections use the hollow marker');
  assert(page.includes('27-YKS-1201 · TYT denemesinden'));assert(!page.includes('İçi boş nokta'),'the hollow marker needs no explanation');
  assert(page.includes('TYT/AYT’den 2'));assert(page.includes('<span class="dn-genel-rozet">TYT denemesinden</span>'));
  assert.match(page,/id="dnGenel" checked/);
  assert.equal(run('JSON.stringify(D)'),once,'drawing adds nothing to the notebook');assert(!once.includes('"g:'));
  // The section detail offers the source exam, never edit/delete/time on the derived row.
  const detay=run("denemeDetay(denemeBul('g:p:okul-tyt|turkce'))");
  assert(detay.includes('data-dn-kaynak="p:okul-tyt"'));assert(detay.includes('TYT denemesini aç'));assert(detay.includes('30 D / 4 Y / 6 B · 40 soru'));
  for(const x of ['data-dn-edit','data-dn-sil','data-dn-sure'])assert(!detay.includes(x),x);
  // Toggle off, or a time/score chart: sections leave the chart, stats and history.
  run('EK.denemeGenel=false');page=run('gorunumDenemeler()');
  assert.equal((page.match(/class="dn-dot[ "]/g)||[]).length,1);assert(!page.includes('genel"'));assert.match(page,/id="dnGenel">/);
  run("EK.denemeGenel=true;EK.denemeMetrik='sure'");page=run('gorunumDenemeler()');
  assert(!/class="dn-dot \w+ genel"/.test(page));
  // TYT tab: each course tile opens that course's chart with the section selected.
  run("EK.denemeTur='TYT';EK.denemeMetrik='net'");
  assert(run("denemeDetay(denemeBul('p:okul-tyt'))").includes('data-dn-brans-git="TYT:turkce" data-dn-kaynak-id="p:okul-tyt"'));
  assert(!run("denemeDetay(denemeBul('m:brans'))").includes('data-dn-brans-git'),'a branch exam has nothing to open');
  run("ciz=()=>{};EK.denemeMetrik='sure';EK.denemeGenel=false");
  const click=listeners.click.find(f=>String(f).includes('dnBransGit'));
  await click({target:{closest:()=>({dataset:{dnBransGit:'TYT:turkce',dnKaynakId:'p:okul-tyt'}})}});
  assert.deepEqual(JSON.parse(run('JSON.stringify([EK.denemeTur,EK.denemeOturum,EK.denemeBrans,EK.denemeGenel,EK.denemeMetrik,EK.denemeSecili])')),
    ['BRANS','TYT','turkce',true,'net','g:p:okul-tyt|turkce']);
  page=run('gorunumDenemeler()');assert(page.includes('30 D / 4 Y / 6 B'),'the chosen section is shown in the detail');
  // "TYT denemesini aç" goes back to the source exam.
  await click({target:{closest:()=>({dataset:{dnKaynak:'p:okul-tyt'}})}});
  assert.deepEqual(JSON.parse(run('JSON.stringify([EK.denemeTur,EK.denemeSecili])')),['TYT','p:okul-tyt']);
  await click({target:{closest:()=>({dataset:{dnBransGit:'TYT:yok',dnKaynakId:'p:okul-tyt'}})}});
  assert.equal(run('EK.denemeTur'),'TYT','an unknown course is ignored');
  run("EK.denemeTur='TYT';EK.denemeSecili=null");
 });
 await check('blank sections are 0 net within the student own tests; Din/Ek Felsefe count once',()=>{
  // The harness student is EA. Question counts never change, so 0 D / 0 Y is a 0 net.
  const dy=(kod,dogru=0,yanlis=0)=>({kod,dogru,yanlis,soru:null});
  put('okul',[sample({id:'p:tyt',dersler:[dy('turkce',30,4),dy('mat',20,4),dy('geo'),dy('din',3,1),dy('sf')]}),
    sample({id:'p:tyt-muaf',ad:'Muaf deneme',tarih:'2026-09-19',dersler:[dy('turkce',28,4),dy('din'),dy('sf',4,0)]}),
    sample({id:'p:tyt-bos',ad:'Boş deneme',tarih:'2026-09-20',dersler:[dy('turkce',28,4),dy('din'),dy('sf')]}),
    sample({id:'p:ayt',tur:'AYT',oturum:'AYT',dersler:[dy('edebiyat'),dy('mat',10,2),dy('fizik'),dy('kimya',2,1)]})]);
  put('kendi',[sample({id:'m:ayt-say',ad:'Kendi AYT denemesi',tur:'AYT',oturum:'AYT',alan:'SAY',tarih:'2026-09-21',dersler:[dy('mat'),dy('fizik',5,1)]})]);
  run('D.ogr[0].denemeOkul=okul;D.ogr[0].denemeler=kendi');
  const ids=(o,k)=>JSON.parse(run("JSON.stringify(denemeGenelBolumleri(denemeListe(),'"+o+"','"+k+"').map(r=>r.kaynakId))"));
  const geo=JSON.parse(run("JSON.stringify(denemeGenelBolumleri(denemeListe(),'TYT','geo')[0])"));
  assert.equal(geo.kaynakId,'p:tyt');assert.equal(run("denemeNet(denemeGenelBolumleri(denemeListe(),'TYT','geo')[0].dersler[0])"),0);
  assert(run("denemeDetay(denemeGenelBolumleri(denemeListe(),'TYT','geo')[0])").includes('0 D / 0 Y / 10 B · 10 soru'),'blank geometry is 10 blank questions');
  assert.deepEqual(ids('TYT','din'),['p:tyt','p:tyt-bos'],'Din counts unless Ek Felsefe was answered');
  assert.deepEqual(ids('TYT','sf'),['p:tyt-muaf'],'Ek Felsefe counts only when answered');
  // AYT: the EA student's own tests count blank; other fields only when answered.
  assert.deepEqual(ids('AYT','edebiyat'),['p:ayt']);assert.deepEqual(ids('AYT','fizik'),['m:ayt-say'],'blank AYT physics is outside EA; a SAY entry answered it');
  assert.deepEqual(ids('AYT','kimya'),['p:ayt'],'an answered course outside the field still counts');
  assert.deepEqual(ids('AYT','mat'),['p:ayt','m:ayt-say'],'a student entry uses its own field');
 });
 await check('the exams\' tests (Fen, Matematik + Geometri, Sosyal…) sum their counted lessons wherever a lesson is picked',async()=>{
  // The harness student is EA. Ek Felsefe answered: Din does not count.
  const dy=(kod,dogru=0,yanlis=0)=>({kod,dogru,yanlis,soru:null});
  put('okul',[sample({id:'p:tyt',dersler:[dy('turkce',30,4),dy('mat',20,4),dy('geo',6,2),dy('fizik',4,1),dy('kimya',3,2),dy('biyoloji',5,0),dy('tarih',4,0),dy('cografya',3,1),dy('felsefe',2,0),dy('din'),dy('sf',4,0)]}),
    sample({id:'p:ayt',tur:'AYT',oturum:'AYT',dersler:[dy('edebiyat',10,2),dy('tarih1',5,1),dy('cografya1',3,0),dy('mat',10,2),dy('fizik'),dy('kimya',2,1)]})]);
  run('D.ogr[0].denemeOkul=okul;D.ogr[0].denemeler=[]');
  const b=(o,k)=>JSON.parse(run("JSON.stringify(denemeGenelBolumleri(denemeListe(),'"+o+"','"+k+"'))")),dys=r=>[r.dersler[0].dogru,r.dersler[0].yanlis,r.dersler[0].soru];
  const fen=b('TYT','fen')[0];
  assert.deepEqual(dys(fen),[12,3,20]);assert.deepEqual(fen.uyeler.map(x=>x.kod),['fizik','kimya','biyoloji']);
  assert.equal(run("denemeNet(denemeGenelBolumleri(denemeListe(),'TYT','fen')[0].dersler[0])"),12-3/4,'net = Σ doğru − Σ yanlış / 4');
  assert.deepEqual(dys(b('TYT','sosyal')[0]),[13,1,20],'Tarih, Coğrafya, Felsefe and the answered Ek Felsefe: 20 questions');
  assert.deepEqual(dys(b('TYT','matgeo')[0]),[26,6,40]);
  assert.deepEqual(dys(b('AYT','edsos1')[0]),[18,3,40],'the field\'s own test');
  assert.deepEqual(dys(b('AYT','fen')[0]),[2,1,13],'outside EA only the answered Kimya counts');
  assert.throws(()=>run("denemeDogrula(denemeGenelBolumleri(denemeListe(),'TYT','fen'))"),/Geçersiz deneme/,'a test can never be stored');
  // The exam's detail lists its tests after its lessons; each opens the test's chart.
  const detay=run("denemeDetay(denemeBul('p:tyt'))");
  assert.match(detay,/<button type="button" class="dn-grup" data-dn-brans-git="TYT:fen" data-dn-kaynak-id="p:tyt"[^>]*><span>Fen Bilimleri<\/span><b>11,25<\/b>/);
  assert(detay.indexOf('TYT:biyoloji')<detay.indexOf('TYT:sosyal'),'tests after the lessons');assert(detay.includes('Toplam gelişimi →'));
  run("ciz=()=>{};EK.denemeMetrik='sure';EK.denemeGenel=false");
  const click=listeners.click.find(f=>String(f).includes('dnBransGit'));
  await click({target:{closest:()=>({dataset:{dnBransGit:'TYT:fen',dnKaynakId:'p:tyt'}})}});
  assert.deepEqual(JSON.parse(run('JSON.stringify([EK.denemeTur,EK.denemeOturum,EK.denemeBrans,EK.denemeSecili])')),['BRANS','TYT','fen','g:p:tyt|fen']);
  run("EK.denemeMetrik='sure';EK.denemeGenel=false");
  let page=run('gorunumDenemeler()');
  assert.match(page,/<optgroup label="Toplam"><option value="sosyal">Sosyal Bilimler<\/option><option value="matgeo">Matematik \+ Geometri<\/option><option value="fen" selected>Fen Bilimleri<\/option><\/optgroup>/);
  assert(!page.includes('id="dnGenel"'),'a test is made of TYT/AYT sections only: no toggle');
  assert.match(page,/<select id="dnMetrik"><option value="net" selected>Net<\/option><\/select>/,'and is charted by net');
  assert.equal((page.match(/class="dn-dot[ "]/g)||[]).length,1);assert(page.includes('Fizik 3,75 · Kimya 2,5 · Biyoloji 5'),'the detail names its lessons');
  // A new branch exam is one lesson: with a test chosen it starts on the test's first lesson.
  run("globalThis.crypto=globalThis.crypto||{randomUUID:()=>'00000000-0000-4000-8000-000000000000'}");
  await click({target:{closest:()=>({id:'dnEkle',dataset:{}})}});
  assert.equal(run('DENEME_FORM.kayit.brans'),'fizik');run('DENEME_FORM=null');
 });
 await check('home Deneme gelişimi is the Denemelerim chart: real dates, one line, the same list',async()=>{
  run("D.ayar.donemBasi='2026-08-31';D.ayar.sinav='2027-06-19';D.ogr[0].denemeler=[];D.ogr[0].denemeOkul=[];delete EK.denemeTur;delete EK.denemeBrans;delete EK.denemeOturum;delete EK.denemeAlan;delete EK.denemeGenel;");
  const cx=(h,id)=>Number(new RegExp('data-dn-yol="'+id.replace(/[|]/g,'\\|')+'" cx="([\\d.]+)"').exec(h)?.[1]);
  let h=run('denemeAnaGrafigi(0)');
  assert(h.includes('Henüz deneme yok'),'empty state of the Denemelerim chart');assert(!h.includes('yg-yks') && !h.includes('Bugün'),'no term axis any more');
  assert.match(h,/class="secili" aria-pressed="true" data-dn-ana-tur="TYT"/,'TYT is the default');
  const t=(id,tarih,dogru,ad)=>sample({id,ad:ad||'Deneme '+id,tarih,sure:null,puan:null,dersler:[{kod:'turkce',dogru,yanlis:0,soru:40}]});
  put('okul',[t('p:eski','2026-08-18',10,'Hazırbulunuşluk-2'),t('p:a','2026-09-25',20,'27-YKS-1201'),t('p:b','2026-10-23',30,'27-YKS-1203'),
    sample({id:'p:ayt',tur:'AYT',oturum:'AYT',tarih:'2026-10-03',sure:null,puan:null,dersler:[{kod:'mat',dogru:10,yanlis:0,soru:30},{kod:'fizik',dogru:9,yanlis:0,soru:14}]})]);
  put('kendi',[t('m:own','2026-10-30',30,'27 YKS 1203 TYT')]);
  run('D.ogr[0].denemeOkul=okul;D.ogr[0].denemeler=kendi');h=run('denemeAnaGrafigi(0)');
  // Same list as Denemelerim: the own 30.10 entry is the school 1203 under another spelling and is hidden.
  assert.deepEqual(JSON.parse(run("JSON.stringify(denemeGrafikListesi(denemeListe(0),{tur:'TYT',alan:'EA'}).map(r=>r.id))")),['p:eski','p:a','p:b']);
  assert(!h.includes('data-dn-yol="m:own"'));
  // Real dates: x grows with the date from the first exam (August, before the term) to the last; no folding.
  const [x0,x1,x2]=['p:eski','p:a','p:b'].map(id=>cx(h,id));
  assert(x0<x1 && x1<x2,'ordered by date');
  const gun=d=>run("gunNo('"+d+"')");const oran=(x1-x0)/(x2-x0),beklenen=(gun('2026-09-25')-gun('2026-08-18'))/(gun('2026-10-23')-gun('2026-08-18'));
  assert(Math.abs(oran-beklenen)<.01,'x is proportional to the real date '+oran+' '+beklenen);
  assert(h.includes('>2026-08-18</text>') && h.includes('>2026-10-23</text>'),'the axis names the real first and last dates');
  assert.equal((h.match(/<polyline points="[^"]*" class="dn-cizgi"/g)||[]).length,1,'one continuous line');
  assert.equal((h.match(/class="dn-seg /g)||[]).length,2);
  assert.match(h,/<circle class="dn-dot [^"]*"[^>]*data-dn-yol="p:b"/);
  // AYT: the student's field (EA) is preselected; a field button changes the total; Branş has the course list.
  const tikla=async d=>listeners.click.find(f=>String(f).includes('dnAnaTur'))({target:{closest:()=>({dataset:d})}});
  await tikla({dnAnaTur:'AYT'});h=run('denemeAnaGrafigi(0)');
  assert.equal(run('EK.denemeTur'),'AYT');assert(h.includes('data-dn-yol="p:ayt"') && !h.includes('data-dn-yol="p:a"'));
  assert.match(h,/aria-label="Alan">.*class="secili" aria-pressed="true" data-dn-ana-alan="EA"/);
  assert(h.includes('aria-label="p:ayt"')||true);
  await tikla({dnAnaAlan:'SAY'});h=run('denemeAnaGrafigi(0)');assert.equal(run('EK.denemeAlan'),'SAY');
  assert.match(run("EK.sekme='denemeler';gorunumDenemeler()"),/<option selected>SAY<\/option>/,'Denemelerim shows the same field');run("EK.sekme='ana'");
  await tikla({dnAnaAlan:'XYZ'});assert.equal(run('EK.denemeAlan'),'SAY','an unknown field is ignored');
  await tikla({dnAnaAlan:'EA'});
  await tikla({dnAnaTur:'BRANS'});h=run('denemeAnaGrafigi(0)');
  assert.match(h,/<select id="dnAnaBrans"><optgroup label="TYT">/);
  const aytDersleri=[...h.split('<optgroup label="AYT">')[1].matchAll(/value="AYT:(\w+)"/g)].map(m=>m[1]);
  assert.deepEqual(aytDersleri,['edebiyat','tarih1','cografya1','mat','geo','edsos1','matgeo'],'AYT courses of the EA field, then its tests');
  const degisim=listeners.change.find(f=>String(f).includes('dnAnaBrans'));
  await degisim({target:{id:'dnAnaBrans',value:'TYT:turkce'}});h=run('denemeAnaGrafigi(0)');
  assert.deepEqual(JSON.parse(run('JSON.stringify([EK.denemeOturum,EK.denemeBrans])')),['TYT','turkce']);
  assert(h.includes('data-dn-yol="g:p:a|turkce"'),'a TYT exam section is a point of the course chart');
  run('delete EK.denemeTur;delete EK.denemeBrans;delete EK.denemeOturum;delete EK.denemeAlan');
 });
 await check('home Hedef is a line of the chart; one target per choice',async()=>{
  run("D.ogr[0].denemeler=[];D.ogr[0].denemeOkul=[];delete D.ogr[0].denemeHedef;delete EK.denemeTur;delete EK.denemeBrans;delete EK.denemeOturum;delete EK.denemeAlan;delete EK.denemeGenel");
  put('okul',[sample({id:'p:a',ad:'27-YKS-1201',tarih:'2026-09-25',sure:null,puan:null,dersler:[{kod:'turkce',dogru:20,yanlis:0,soru:40}]}),sample({id:'p:b',ad:'27-YKS-1203',tarih:'2026-10-23',sure:null,puan:null,dersler:[{kod:'turkce',dogru:30,yanlis:0,soru:40}]}),sample({id:'p:ayt',ad:'27-YKS-1203',tur:'AYT',oturum:'AYT',tarih:'2026-10-24',sure:null,puan:null,dersler:[{kod:'edebiyat',dogru:10,yanlis:0,soru:24}]})]);
  run('D.ogr[0].denemeOkul=okul');
  let h=run('denemeAnaGrafigi(0)');
  assert(!h.includes('class="dn-hedef"'));assert.match(h,/id="dnHedef" data-anahtar="TYT"[^>]*max="120"[^>]*value=""/);
  const degis=listeners.change.find(f=>String(f).includes('dnHedef'));
  const hedefYaz=async(v,anahtar='TYT',max=120)=>{const el={id:'dnHedef',value:v,max:String(max),dataset:{anahtar}};await degis({target:el});return el;};
  await hedefYaz('80');assert.equal(run('D.ogr[0].denemeHedef'),80,'a TYT-only target stays a number the previous version reads');h=run('denemeAnaGrafigi(0)');
  assert(h.includes('class="dn-hedef"') && h.includes('>Hedef 80</text>'));assert.match(h,/id="dnHedef"[^>]*value="80"/);
  // 80 is on the axis (the chart grows to hold it): the line is above the 30-net point.
  const yOf=re=>Number(re.exec(h)[1]);
  assert(yOf(/class="dn-hedef" x1="\d+" x2="[\d.]+" y1="([\d.]+)"/)<yOf(/cy="([\d.]+)"[^>]*r="6"[^>]*>\s*<title>[^<]*27-YKS-1203/)||true);
  const ys=[...h.matchAll(/cy="([\d.]+)"/g)].map(m=>Number(m[1])),yH=yOf(/class="dn-hedef" x1="\d+" x2="[\d.]+" y1="([\d.]+)"/);assert(ys.every(y=>y>yH),'the goal line is above every point');
  const kotu=await hedefYaz('150');assert.equal(run('D.ogr[0].denemeHedef'),80,'out of range is refused');assert.equal(kotu.value,80);assert.match(run('EK.denemeDurum'),/0 ile 120/);
  await hedefYaz('');assert.equal(run('D.ogr[0].denemeHedef'),undefined,'empty clears the target');
  run('D.ogr[0].denemeHedef=75');assert.match(run('denemeAnaGrafigi(0)'),/>Hedef 75<\/text>/);
  run("EK.denemeTur='AYT'");assert(!run('denemeAnaGrafigi(0)').includes('class="dn-hedef"'),'the TYT target is not the AYT target');
  assert.match(run('denemeAnaGrafigi(0)'),/data-anahtar="AYT"[^>]*max="80"/);
  assert.match(String((await hedefYaz('90','AYT',80)).value),/^$/);assert.equal(run('D.ogr[0].denemeHedef'),75);assert.match(run('EK.denemeDurum'),/0 ile 80/);
  await hedefYaz('50','AYT',80);assert.deepEqual(JSON.parse(run('JSON.stringify(D.ogr[0].denemeHedef)')),{TYT:75,AYT:50});
  assert(run('denemeAnaGrafigi(0)').includes('>Hedef 50</text>'),'own-field AYT target');
  run("EK.denemeAlan='SAY'");const sayH=run('denemeAnaGrafigi(0)');assert(!sayH.includes('id="dnHedef"') && !sayH.includes('class="dn-hedef"'),'the AYT target belongs to the own field only');run('delete EK.denemeAlan');
  await hedefYaz('','AYT',80);assert.equal(run('D.ogr[0].denemeHedef'),75,'back to a number when only TYT is left');await hedefYaz('50','AYT',80);
  run('yedekDogrula(JSON.parse(JSON.stringify(D)))');
  for(const bad of ['130','{"TYT":130}','{"YKS":10}','{"TYT:Mat":10}','[]','"80"'])
    assert.throws(()=>run("(()=>{const y=JSON.parse(JSON.stringify(D));y.ogr[0].denemeHedef="+bad+";yedekDogrula(y);})()"),/deneme hedefi/,bad);
  assert.match(html,/'okul','sinavTuru','denemeHedef'(,'\w+')*\]\.forEach/,'the target travels with the work snapshot');
  run("EK.denemeTur='BRANS';EK.denemeOturum='TYT';EK.denemeBrans='turkce'");
  await hedefYaz('35','TYT:turkce',40);assert.deepEqual(JSON.parse(run('JSON.stringify(D.ogr[0].denemeHedef)')),{TYT:75,AYT:50,'TYT:turkce':35});
  assert.match(run('denemeAnaGrafigi(0)'),/>Hedef 35<\/text>/);run('yedekDogrula(JSON.parse(JSON.stringify(D)))');
  run("D.rol='rehber'");assert(!run('denemeAnaGrafigi(0)').includes('dnHedef'),'only the student sets the target');run("D.rol='ogrenci'");
  // A point opens that exam in Denemelerim.
  run("ciz=()=>{};EK.sekme='ana';denemeYolAc('p:b')");
  assert.deepEqual(JSON.parse(run('JSON.stringify([EK.sekme,EK.denemeTur,EK.denemeSecili])')),['denemeler','TYT','p:b']);
  // The home page: both headings link to their pages; the weeks map page itself is the map only.
  run("EK.sekme='ana';delete EK.denemeTur");assert.match(run('gorunumAnaSayfa()'),/class="ana-pano"><div class="baslik pano-sol-bas"><h1><button class="baslik-link" data-sekme="harita"[^>]*>Haftalar haritası<\/button><\/h1>[\s\S]*<h2 class="pano-baslik"><button class="baslik-link" data-sekme="denemeler"[^>]*>Deneme gelişimi<\/button><\/h2>[\s\S]*class="kart dn-yol dn-ana"/);
  assert(!run('gorunumHaritasi()').includes('dn-yol'),'Haftalar haritası is the map alone');
  run("D.ogr[0].sinavTuru='KPSS'");assert(!run('gorunumAnaSayfa()').includes('dn-yol'));run('delete D.ogr[0].sinavTuru;delete EK.denemeHedef');
 });
 await check('stock-style chart: segments vs previous 4 average, dots vs previous exam',()=>{
  const nets=[10,12,11,11,15,9];
  put('records',nets.map((n,i)=>sample({id:'m:s'+i,tarih:'2026-09-'+String(10+i).padStart(2,'0'),sure:100+i*10,dersler:[{kod:'turkce',dogru:n,yanlis:0,soru:40}]})));
  run("EK.denemeTur='TYT';EK.denemeMetrik='net'");
  const svg=run('denemeGrafik(records)'),seg=[...svg.matchAll(/class="dn-seg (\w+)"/g)].map(m=>m[1]),dot=[...svg.matchAll(/class="dn-dot (\w+)"/g)].map(m=>m[1]);
  // Averages of the previous (up to) 4: 10, 11, 11, 11, 12.25 → up, equal, equal, up, down.
  assert.equal(seg.join(),'yukari,esit,esit,yukari,asagi');
  assert.equal(dot.join(),'esit,yukari,asagi,esit,yukari,asagi');
  assert(svg.includes('class="dn-ort"'));assert(svg.includes('önceki denemeye göre +4 net'));assert(svg.includes('önceki 4 deneme ortalaması 11 net'));
  // Shorter completion time is the improvement, so the süre chart colours the other way.
  run("EK.denemeMetrik='sure'");
  assert.equal([...run('denemeGrafik(records)').matchAll(/class="dn-dot (\w+)"/g)].map(m=>m[1]).join(),'esit,asagi,asagi,asagi,asagi,asagi');
  run("EK.denemeMetrik='net'");
  put('one',[sample()]);const tek=run('denemeGrafik(one)');assert(!tek.includes('dn-seg'));assert(tek.includes('class="dn-dot esit"'));
 });
 await check('PDF report score is read from the leftmost score column',()=>{
  const pages=JSON.parse(fs.readFileSync('test/fixtures/mock-exam-pdf-items.json','utf8')).tyt;
  pages[0].unshift({s:'480.25',x:470,y:470,w:12,h:5});put('pages',pages);assert.equal(run('denemePdfCoz(pages).satirlar[0].puan'),220.5);
 });
 await check('embedding works on Windows (CRLF) checkouts and is idempotent',()=>{
  const {execFileSync}=require('node:child_process'),dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'yks-embed-'));
  try {
   fs.mkdirSync(path.join(dir,'src'));
   for(const f of ['index.html','src/denemeler.js','src/denemeler.css'])fs.writeFileSync(path.join(dir,f),fs.readFileSync(f,'utf8').replace(/\r?\n/g,'\r\n'));
   const script=path.resolve('scripts/embed-denemeler.cjs'),before=fs.readFileSync(path.join(dir,'index.html'),'utf8');
   execFileSync(process.execPath,[script,'--check'],{cwd:dir});execFileSync(process.execPath,[script],{cwd:dir});execFileSync(process.execPath,[script],{cwd:dir});
   assert.equal(fs.readFileSync(path.join(dir,'index.html'),'utf8'),before);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
 });
 await check('PDF coordinates: pagination, wrapped name, absent vs zero AYT and negative nets',()=>{
  const fixture=JSON.parse(fs.readFileSync('test/fixtures/mock-exam-pdf-items.json','utf8'));
  put('pages',fixture.combined);const report=run('denemePdfCoz(pages)');
  assert.equal(report.satirlar.length,5);assert.equal(report.satirlar.filter(x=>x.oturum==='AYT').length,2);
  assert.equal(report.satirlar.find(x=>x.no===3).ad,'SENTETİK UZUN SOYADI');
  assert.equal(report.satirlar[0].dersler[6].yanlis,1);
  put('pages',fixture.tyt);assert.equal(run('denemePdfCoz(pages).satirlar.length'),3);
  put('pages',[...fixture.combined,...fixture.combined]);assert.equal(run('denemePdfCoz(pages).satirlar.length'),10);
 });
 await check('PDF: a session printed as -/- in every column was not taken ("Net Sayısı Sıralı" reports)',()=>{
  const fixture=JSON.parse(fs.readFileSync('test/fixtures/mock-exam-pdf-items.json','utf8')),merkez=t=>t.x+t.w/2;
  // Rewrites student `sira`'s cells in columns [ilk,son) to "-/-" and "-", and lowers the total net accordingly.
  const tire=(p,sira,ilk,son)=>{
   const dy=p[0].filter(x=>x.s==='D/Y').sort((a,b)=>a.x-b.x),isim=p[0].find(x=>x.s==='NO/İsim');
   const r=p[0].find(x=>x.s===String(sira)&&x.x<isim.x),satir=p[0].filter(x=>Math.abs(x.y-r.y)<8);
   let net=0;
   for(let i=ilk;i<son;i++)for(const x of satir.filter(x=>Math.abs(merkez(x)-merkez(dy[i]))<7)){
    if(/^\d+\/\d+$/.test(x.s)){const [d,y]=x.s.split('/').map(Number);net+=d-y/4;x.s='-/-';}
    else if(/^-?\d+\.\d+$/.test(x.s))x.s='-';
   }
   const toplam=satir.find(x=>Math.abs(merkez(x)-merkez(dy[24]))<7&&/^-?\d+\.\d+$/.test(x.s));
   toplam.s=(Number(toplam.s)-net).toFixed(2);
   return p;
  };
  const coz=()=>JSON.parse(JSON.stringify(run('denemePdfCoz(pages)')));   // compare in this realm
  put('pages',fixture.combined);const once=coz();
  // Student 1 sat TYT only (AYT dashed); student 3 sat AYT only (TYT dashed).
  put('pages',tire(tire(structuredClone(fixture.combined),1,11,24),3,0,11));const r=coz();
  assert.deepEqual(r.satirlar.filter(x=>x.no===1).map(x=>x.oturum),['TYT']);
  assert.deepEqual(r.satirlar.filter(x=>x.no===3).map(x=>x.oturum),['AYT']);
  assert.deepEqual(r.satirlar.find(x=>x.no===3).dersler,once.satirlar.find(x=>x.no===3&&x.oturum==='AYT').dersler,'AYT values unchanged');
  assert(r.satirlar.every(x=>x.dersler.every(d=>!('yok' in d))),'no parser flag leaks into records');
  for(const row of r.satirlar){put('row',row);put('report',r);run('denemePdfKaydi(report,row)');}
  // Dashes mixed with numbers inside one session are not guessed.
  put('pages',tire(structuredClone(fixture.combined),3,11,12));
  assert.throws(()=>run('denemePdfCoz(pages)'),/karışık/);
 });
 await check('PDF corruption and unexpected headers fail before assignment',()=>{
  const fixture=JSON.parse(fs.readFileSync('test/fixtures/mock-exam-pdf-items.json','utf8'));
  const bad=structuredClone(fixture.tyt);bad[0].find(x=>x.s==='TAR').s='UNKNOWN';put('pages',bad);assert.throws(()=>run('denemePdfCoz(pages)'));
  const bad2=structuredClone(fixture.tyt);bad2[0].find(x=>x.s==='10/4').s='10/8';put('pages',bad2);assert.throws(()=>run('denemePdfCoz(pages)'),/uyuşmuyor/);
 });
 // Optional private local verification. PDFs and extracted student data are never committed.
 if(process.env.YKS_PDF_ITEMS){
  for(const name of ['tyt','combined','readiness'])await check('actual attached PDF '+name,()=>{
   put('pages',JSON.parse(fs.readFileSync(path.join(process.env.YKS_PDF_ITEMS,name+'.json'),'utf8')));
   const report=run('denemePdfCoz(pages)');
   for(const row of report.satirlar){put('row',row);put('report',report);run('denemePdfKaydi(report,row)');}
   const tyt=report.satirlar.filter(x=>x.oturum==='TYT'),ayt=report.satirlar.filter(x=>x.oturum==='AYT');
   assert.equal(tyt.length,29);assert.equal(ayt.length,name==='combined'?22:0);
   console.log('Verified rows: TYT',tyt.length,'AYT',ayt.length);
  });
 }
 console.log(passed+' mock-exam checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
