'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let html=fs.readFileSync('index.html','utf8'),marker='<script id="uygulama">',start=html.indexOf(marker)+marker.length;
let source=html.slice(start,html.indexOf('// ---------------------------------------------------------------- başlangıç',start));
const mod=fs.readFileSync('src/tyt-metot.js','utf8');
if(source.includes('// BEGIN TYT_METOT')) source=source.replace(/\/\/ BEGIN TYT_METOT[\s\S]*?\/\/ END TYT_METOT/,mod);else source+='\n'+mod;
const listeners={},nodes={},el=(extra={})=>Object.assign({style:{},dataset:{},innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){},focus(){}},extra);
const sandbox={console,setTimeout:()=>0,clearTimeout(){},Blob,URL,URLSearchParams,crypto,TextEncoder,structuredClone,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm:()=>true,prompt:()=>'',fetch:async()=>({ok:false}),localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},addEventListener(){},bulut:null},document:{activeElement:null,addEventListener(k,f){(listeners[k]||=[]).push(f)},contains:()=>true,getElementById:id=>nodes[id]||null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>el(),body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document=sandbox.document;vm.createContext(sandbox);vm.runInContext(source,sandbox);const run=s=>vm.runInContext(s,sandbox);
run(`D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-10-30';D.ayar.donemBasi='2026-08-31';D.ogr=[{no:1,ad:'Test',sube:'benim',alan:'SAY',sinif:12,kap:6,off:[],aktif:true,okul:false,maddeler:[],rutin:{}}];EK={ogr:0,sekme:'plan',girisAcik:{}};kaydet=async()=>true;ciz=()=>{};
 const entries=[['Türkçe','Ses Bilgisi',0],['Matematik TYT','Temel Kavramlar',1],['Tarih','İlk Çağ',5],['Coğrafya','Harita Bilgisi (TYT)',7],['Felsefe','Felsefeye Giriş',8],['Din Kültürü','Din',9],['Fizik','Basınç',2],['Kimya','Atom',2],['Biyoloji','Hücre',2],['Geometri','Açılar',1],['Matematik AYT','Türev',1]];
 const ids=entries.map(([ders,ad,idx])=>{const ki=kullaniciKonusuTam(idx,ad,ders,12);D.konuDers[ki]=ders;return ki});
 D.ogr[0].kendiPlan={tur:'YKS',hedef:'2027-04-01',seviye:{},sira:ids,anlatimGerek:{},metot:{surum:1,baslangic:'2026-10-30',dakika:480,tamam:{}}};`);
const data=expr=>JSON.parse(run('JSON.stringify('+expr+')'));const m=day=>data(`TYT_METOT.model(gunNo('${day}'))`);const topics=data('TYT_METOT.topics()');const tr=topics.find(x=>x.c==='tr'),mat=topics.find(x=>x.c==='mat'&&x.tyt);
(async()=>{
 assert(run('TYT_METOT.eligible()'));run('D.ogr[0].okul=true');assert(!run('TYT_METOT.eligible()'));run("D.ogr[0].okul=false;D.ogr[0].sinavTuru='LGS'");assert(!run('TYT_METOT.eligible()'));run("delete D.ogr[0].sinavTuru");
 const valid=done=>({surum:1,baslangic:'2026-10-30',dakika:480,tamam:done});
 assert.throws(()=>run(`TYT_METOT.validate(${JSON.stringify(valid({'bogus':'2026-10-30'}))})`));
 assert.throws(()=>run(`TYT_METOT.validate(${JSON.stringify(valid({'r|x':'2026-11-02'}))})`));
 assert.throws(()=>run(`TYT_METOT.validate(${JSON.stringify(valid({'v|x':'2026-10-30','r|x':'2026-11-01'}))})`));
 assert.throws(()=>run(`TYT_METOT.validate(${JSON.stringify(valid({'d|0':'2026-11-03','d|1':'2026-11-04','d|3':'2026-11-05'}))})`));
 assert(run(`TYT_METOT.validate(${JSON.stringify(valid({'d|0':'2026-11-03','d|1':'2026-11-04','d|3':'2026-11-06'}))})`));
 const ayt=topics.find(x=>!x.tyt);run(`D.ogr[0].kendiPlan.metot.tamam[${JSON.stringify('v|'+ayt.key)}]='2026-10-30'`);
 assert(!m('2026-11-02').tasks.some(t=>t.id==='r|'+ayt.key),'AYT recall remains locked');
 run(`D.ogr[0].kendiPlan.metot.tamam[${JSON.stringify('v|'+tr.key)}]='2026-11-10';D.ogr[0].kendiPlan.metot.tamam[${JSON.stringify('r|'+tr.key)}]='2026-11-13'`);
 assert.equal(m('2026-11-02').progress,0,'future completions do not change historical progress');
 run('D.ogr[0].kendiPlan.metot.tamam={}');
 assert.throws(()=>run("TYT_METOT.validate({surum:1,baslangic:'2026-10-30',dakika:119,tamam:{}})"));assert.throws(()=>run("TYT_METOT.validate({surum:1,baslangic:'2026-10-30',dakika:480,tamam:{x:'2026-10-29'}})"));
 run(`D.ogr[0].kendiPlan.metot.tamam[${JSON.stringify('v|'+tr.key)}]='2026-10-30'`);
 assert(!m('2026-10-30').tasks.some(t=>t.id==='r|'+tr.key));assert(!m('2026-11-01').tasks.some(t=>t.id==='r|'+tr.key));const recall=m('2026-11-02').tasks.find(t=>t.id==='r|'+tr.key);assert(recall);assert.equal(recall.due-recall.video,3);
 assert.equal(m('2026-11-02').phase,'TYT');assert(!m('2026-11-02').tasks.some(t=>t.x&&!t.x.tyt));assert(!m('2026-11-02').tasks.some(t=>t.kind==='Branş denemesi'),'planned or watched topic does not trigger a branch exam');
 run(`D.ogr[0].kendiPlan.metot.tamam[${JSON.stringify('r|'+tr.key)}]='2026-11-02'`);assert(m('2026-11-02').tasks.some(t=>t.kind==='Branş denemesi'&&t.course===undefined));
 run(`for(const x of TYT_METOT.topics().filter(x=>x.tyt)){D.ogr[0].kendiPlan.metot.tamam['v|'+x.key]='2026-10-30';D.ogr[0].kendiPlan.metot.tamam['r|'+x.key]='2026-11-02'}`);
 assert.equal(m('2026-11-03').phase,'TYT deneme haftası');run(`for(const n of [0,1,3,4])D.ogr[0].kendiPlan.metot.tamam['d|'+n]='2026-11-03'`);assert.equal(m('2026-11-10').phase,'TYT deneme haftası');run("D.ogr[0].kendiPlan.metot.tamam['d|5']='2026-11-10'");assert.equal(m('2026-11-11').phase,'AYT');
 run(`D.ogr[0].kendiPlan.metot.tamam={};D.ogr[0].kendiPlan.metot.dakika=120;for(const x of TYT_METOT.topics().filter(x=>x.tyt).slice(0,4))D.ogr[0].kendiPlan.metot.tamam['v|'+x.key]='2026-10-30'`);const overloaded=m('2026-11-02');assert(overloaded.over);assert(!overloaded.tasks.some(t=>t.kind==='Konu videosu'||t.kind==='Genel son tekrar'));
 run('delete D.ogr[0].kendiPlan.metot;before=JSON.stringify(D.ogr[0].kendiPlan);kaydet=async()=>false');await assert.rejects(run('TYT_METOT.start()'));assert.equal(run('JSON.stringify(D.ogr[0].kendiPlan)'),run('before'));
 run(`D.ogr[0].kendiPlan.metot={surum:'1',baslangic:'2026-10-30',dakika:480,tamam:{}}`);assert.throws(()=>run('TYT_METOT.validate(D.ogr[0].kendiPlan.metot)'));
 // Complete each day's recommended work, including work unlocked by earlier batches.
 run(`D.ogr[0].kendiPlan.metot={surum:1,baslangic:'2026-10-30',dakika:480,tamam:{}}`);
 let reached=false,previousProgress=0;
 for(let offset=0;offset<150&&!reached;offset++){
  const day=run(`gunNo('2026-10-30')+${offset}`),date=run(`isoDan(${day})`),seen=new Set();
  for(let batch=0;batch<100;batch++){
   const state=data(`TYT_METOT.model(${day})`);assert(state.progress>=previousProgress,'progress must not decrease');previousProgress=state.progress;
   if(state.phase==='AYT'){reached=true;break;}
   const ids=state.tasks.map(t=>t.id);assert.equal(new Set(ids).size,ids.length,'duplicate task on '+date);
   if(!ids.length)break;
   for(const task of state.tasks){
    assert(!seen.has(task.id),'task repeated on '+date+': '+task.id);seen.add(task.id);
    if(task.kind==='Hatırlama testi'&&task.video!==undefined)assert(day>=task.video+3,'recall offered early');
   }
   run(`for(const id of ${JSON.stringify(ids)}) D.ogr[0].kendiPlan.metot.tamam[id]=${JSON.stringify(date)};TYT_METOT.validate(D.ogr[0].kendiPlan.metot)`);
   if(batch===99)throw new Error('Daily task batches did not stabilize on '+date);
  }
 }
 assert(reached,'TYT track did not reach AYT within 150 days');
 const completed=data('D.ogr[0].kendiPlan.metot.tamam');
 for(const t of topics.filter(x=>x.tyt)){assert(completed['v|'+t.key]);assert(completed['r|'+t.key]);}
 const mockDates=[0,1,3,4,5].map(n=>completed['d|'+n]);assert(mockDates.every(Boolean));
 const days=mockDates.map(d=>run(`gunNo('${d}')`));for(let i=1;i<days.length;i++)assert(days[i]-days[i-1]>=(i===2?2:1),'mock dates require distinct days and a rest day');
 // A student work packet remaps numeric topic IDs but retains stable URI method keys.
 run(`D.ogr[0].ogrenciBulutId='d70ec14d-ab10-43e5-b63f-0dd990c3626b';D.ogrCalismaTs=2000;
 D.ogr[0].kendiPlan.metot={surum:1,baslangic:'2026-10-30',dakika:480,tamam:{}};
 D.ogr[0].kendiPlan.metot.tamam[${JSON.stringify('v|'+tr.key)}]='2026-10-30';
 studentPacket=ogrenciCalismaPaketi();sourceIds=D.ogr[0].kendiPlan.sira.slice();student=JSON.parse(JSON.stringify(D.ogr[0]));
 D=varsayilan();D.rol='rehber';D.ogr=[student];delete D.ogr[0].kendiPlan;D.ogr[0].ogrCalismaTs=100;
 kullaniciKonusuTam(1,'Synthetic unrelated first topic','Matematik TYT',12);
 ogrenciCalismasiniUygula(studentPacket,0);`);
 assert.equal(run(`D.ogr[0].kendiPlan.metot.tamam[${JSON.stringify('v|'+tr.key)}]`),'2026-10-30');
 assert.notEqual(run('D.ogr[0].kendiPlan.sira[0]'),run('sourceIds[0]'),'teacher topic IDs are remapped');
 run(`bad=JSON.parse(studentPacket.veri);bad.ogr[0].kendiPlan.metot.tamam['r|missing']='2026-11-01';badPacket={ts:3000,veri:JSON.stringify(bad)};beforeTeacher=JSON.stringify(D)`);
 assert.throws(()=>run('ogrenciCalismasiniUygula(badPacket,0)'));assert.equal(run('JSON.stringify(D)'),run('beforeTeacher'));
 console.log('PASS TYT method eligibility, recall dates, gates, budget and rollback');
})().catch(e=>{console.error(e);process.exitCode=1});

