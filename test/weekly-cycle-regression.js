#!/usr/bin/env node
'use strict';
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes={ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox={console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document=sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);

const out=vm.runInContext(`(()=>{
 const checks=[],a=(x,m)=>{if(!x)throw Error(m)},eq=(x,y,m)=>{if(JSON.stringify(x)!==JSON.stringify(y))throw Error(m+': '+JSON.stringify(x)+' != '+JSON.stringify(y))};
 const test=(name,fn)=>{try{fn();checks.push({name,ok:true})}catch(e){checks.push({name,ok:false,error:e.stack})}};
 const mon=gunNo('2026-09-07'),wed=mon+2;
 function reset(date='2026-09-07'){
  D=varsayilan();D.rol='ogrenci';D.ayar.testTarih=date;D.ayar.donemBasi='2026-08-24';D.ayar.donemElle=true;
  D.ogr=[{no:1,ad:'Ada',sube:'12-A',alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:mon}];
  D.konuPlani={};D.dersProgrami={};D.programHafta={};EK.ogr=0;EK.hafta=null;EK.sekme='plan';
 }
 const work=(ki,day)=>{D.islenis[ki]=day-D.ayar.ilk};
 test('default-remains-monday-through-sunday',()=>{reset();eq(buHafta(),mon,'Monday');eq(planHaftaSonu(0,mon),mon+6,'Sunday');a(!D.ogr[0].haftaDuzeni,'opt in only')});
 test('wednesday-cycle-rolls-over-only-on-wednesday',()=>{
  reset();eq(ogrenciHaftaGunuAyarla(2),wed,'activation');eq(buHafta(),mon,'pending setting');eq(sonrakiHafta(0,mon),wed,'short transition');
  D.ayar.testTarih='2026-09-09';eq(buHafta(),wed,'starts Wednesday');
  D.ayar.testTarih='2026-09-15';eq(buHafta(),wed,'Tuesday same cycle');
  D.ayar.testTarih='2026-09-16';eq(buHafta(),wed+7,'next Wednesday');eq(oncekiHafta(0,wed+7),wed,'previous cycle');
 });
 test('frozen-dates-and-manual-work-survive-changing-cycle',()=>{
  reset();for(let i=0;i<6;i++)work(i,mon+i);
  const ov=elleAl(0,mon,true);ov.serbest={manual:{ad:'Kitap',ders:'Serbest',soru:15}};ov.yer.manual=[3,0];
  ogrenciHaftayiSakla(0,mon,planHesapla(0,mon));
  const before=JSON.stringify(D.elle['0|'+mon]),original=planHesapla(0,mon).gunler.map(l=>l.map(x=>[x.ad,x.soru]));
  ogrenciHaftaGunuAyarla(2);const short=planHesapla(0,mon);a(short.gunler.slice(2).flat().length===0,'transition ends Tuesday');
  D.ayar.testTarih='2026-09-09';const next=planHesapla(0,wed);
  for(let g=0;g<5;g++)eq(next.gunler[g].map(x=>[x.ad,x.soru]),original[g+2],'original calendar day '+g);
  eq(JSON.stringify(D.elle['0|'+mon]),before,'read-only projection and old snapshot');
  ogrenciHaftayiSakla(0,wed,next);const stored=planHesapla(0,wed);
  eq(stored.gunler.map(l=>l.map(x=>[x.ad,x.soru])),next.gunler.map(l=>l.map(x=>[x.ad,x.soru])),'freeze retains projected manual and topic rows');
  eq(JSON.stringify(D.elle['0|'+mon]),before,'original snapshot remains intact');
 });
 test('rest-days-and-daily-capacity-are-real-calendar-days',()=>{
  reset('2026-09-09');ogrenciHaftaGunuAyarla(2);for(let i=0;i<30;i++)work(i,wed);
  const p=planHesapla(0,wed);eq(p.gunler[4].length,0,'Sunday rest');a(p.gunler[5].length>0,'Monday is not Sunday');a(p.gunYuk.every(n=>n<=6),'capacity');
 });
 test('desktop-mobile-pdf-and-csv-use-wednesday-tuesday-order',()=>{
  reset('2026-09-09');ogrenciHaftaGunuAyarla(2);for(let i=0;i<8;i++)work(i,wed);
  const p=planHesapla(0,wed),html=planTablosu(0,wed,p,false,true),pdf=yazdirSayfa(0,wed),csv=csvOlustur(0,wed),mobile=planListesi(0,wed,p,true);
  for(const x of [html,pdf]){a(x.indexOf('ÇARŞAMBA')<x.indexOf('PAZARTESİ'),'Wednesday first');a(x.includes('15.09.2026'),'ends Tuesday');}
  a(csv.indexOf('Çarşamba')<csv.indexOf('Pazartesi'),'CSV order');a(mobile.includes('Çarşamba'),'mobile label');
  a(gorunumOgrenciAyarlar().includes('id="ogrHaftaGunu"'),'optional setting visible');
 });
 test('short-transition-print-shows-only-its-two-days',()=>{
  reset();ogrenciHaftaGunuAyarla(2);work(0,mon);const html=yazdirSayfa(0,mon);
  a(html.includes('08.09.2026'),'ends Tuesday');a(!html.includes('ÇARŞAMBA'),'no extra day columns');
 });
 test('pdf-gate-checks-previous-personal-cycle',()=>{
  reset('2026-09-09');ogrenciHaftaGunuAyarla(2);work(0,wed);const p=planHesapla(0,wed);ogrenciHaftayiSakla(0,wed,p);
  const blocked=sonrakiHaftaYazdirmaEngeli(0,wed+7);a(blocked&&blocked.hb===wed,'previous Wednesday cycle required');
  sonucIsle(0,[{ki:0,gun:wed,not:3,dogru:null,soru:null}]);a(!sonrakiHaftaYazdirmaEngeli(0,wed+7),'rating unlocks next cycle');
 });
 test('reporting-day-waits-for-prior-results-before-freezing-current-plan',()=>{
  reset('2026-09-09');ogrenciHaftaGunuAyarla(2);work(0,wed);ogrenciOtomasyonHazirla();
  D.ayar.testTarih='2026-09-16';ogrenciOtomasyonHazirla();
  a(!elleAl(0,wed+7).sabit,'current preview must await previous results');
  const gate=sonrakiHaftaYazdirmaEngeli(0,wed+7);a(gate&&gate.hb===wed,'current PDF requires prior cycle');
  sonucIsle(0,[{ki:0,gun:wed,not:3,dogru:null,soru:null}]);work(1,wed+7);ogrenciOtomasyonHazirla();
  a(!sonrakiHaftaYazdirmaEngeli(0,wed+7),'reported results unlock current PDF');
  a(elleAl(0,wed+7).sabit,'new plan freezes with updated results');
 });
 test('reset-and-results-roundtrip-with-non-monday-anchor',()=>{
  reset('2026-09-09');ogrenciHaftaGunuAyarla(2);work(0,wed);konuAnlatilmadi(0,0,wed);const pk=sonucPaketi(),backup=JSON.parse(JSON.stringify(D));
  a(yedekDogrula(backup),'backup validates');eq(pk.konuAnlatilmadi[0].hafta,wed,'reset uses Wednesday');
  reset('2026-09-09');sonucPaketiUygula(pk,0);eq(buHafta(),wed,'preference restored');eq(D.konuAnlatilmadi[0].hafta,wed,'reset restored');
  D.ayar.testTarih='2026-09-16';sonucIsle(0,[{ki:0,gun:wed+7,not:3,dogru:null,soru:null}]);eq(D.kart['0:0'].n,1,'first actual repetition');
 });
 test('preference-sync-needs-no-test-results-and-stale-device-cannot-revert',()=>{
  reset();ogrenciHaftaGunuAyarla(2);const p=sonucPaketi();eq(p.kayit.length,0,'no synthetic result');
  const cloud={ogrenciNo:1,ogrenciAd:'Ada',ogrenciSube:'12-A',paket:Object.assign({},p,{kayit:[]})};
  reset();sonucPaketiUygula(bulutSonucPaketiniYerellestir(cloud),0);eq(D.ogr[0].haftaDuzeni,p.haftaDuzeni,'preference-only restore');
  ogrenciHaftaGunuAyarla(4);const own=JSON.stringify(D.ogr[0].haftaDuzeni);sonucPaketiUygula(p,0);eq(JSON.stringify(D.ogr[0].haftaDuzeni),own,'new preference wins');
 });
 test('teacher-calendar-and-other-student-stay-independent',()=>{
  reset('2026-09-09');ogrenciHaftaGunuAyarla(2);D.ogr.push({no:2,ad:'Ece',sube:'12-A',alan:'SAY',kap:4,off:[]});
  eq(buHafta(1),mon,'other student Monday');eq(ileriDagitBaslangic(),mon,'school distribution Monday');
  EK.sekme='program';eq(haftaBasi(),mon,'school timetable Monday');EK.sekme='plan';eq(haftaBasi(),wed,'personal view Wednesday');
 });
 test('eight-wednesday-reports-keep-fsrs-dates-and-frozen-plans',()=>{
  reset('2026-09-09');ogrenciHaftaGunuAyarla(2);for(let i=0;i<60;i++)work(i,wed);
  let count=0;
  for(let w=0;w<8;w++){
   const hb=wed+w*7;D.ayar.testTarih=isoDan(hb);ogrenciOtomasyonHazirla();
   const before=JSON.stringify(D.elle['0|'+hb]),p=planHesapla(0,hb);
   D.ayar.testTarih=isoDan(hb+6);const rows=p.gunler.flatMap((l,g)=>l.filter(x=>!x.serbest&&!x.anlatim).map(x=>({ki:x.ki,gun:hb+g,not:3,dogru:null,soru:null})));
   if(rows.length){sonucIsle(0,rows);count+=rows.length;}
   eq(JSON.stringify(D.elle['0|'+hb]),before,'snapshot remains after report '+w);
   a(!sonrakiHaftaYazdirmaEngeli(0,hb+7),'completed week print gate '+w);
   a(Object.values(D.kart).every(k=>k.due>k.son),'future FSRS dates');
  }
  a(count>40,'substantial result history');
 });
 test('malformed-preference-is-rejected-before-state-mutation',()=>{
  reset();const p=sonucPaketi();p.haftaDuzeni={at:1,donemler:[{bas:wed,gun:0}]};const before=JSON.stringify(D);
  let threw=false;try{sonucPaketiUygula(p,0)}catch(e){threw=true}a(threw,'invalid weekday');eq(JSON.stringify(D),before,'atomic');
 });
 return {passed:checks.filter(c=>c.ok).length,total:checks.length,checks};
})()`,sandbox);
console.log(JSON.stringify(out,null,2));process.exitCode=out.passed===out.total?0:1;
