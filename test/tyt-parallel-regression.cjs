'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
// Use the app VM fixture and current source (not a stale embedded adapter).
let fixture=fs.readFileSync('test/tyt-metot-regression.cjs','utf8').split('(async()=>{')[0];
fixture=fixture.replace('const listeners={},nodes={}',"source=source.slice(0,source.indexOf('// BEGIN TYT_WEEKLY'))+require('node:fs').readFileSync('src/tyt-weekly.js','utf8')+source.slice(source.indexOf('// END TYT_WEEKLY')+'// END TYT_WEEKLY'.length);\nconst listeners={},nodes={}");
const {run,data}=new Function('require',fixture+'\nreturn {run,data};')(require);
run(`D.ayar.testTarih='2026-10-26';D.ogr[0].kendiPlan.metot.baslangic='2026-10-26';D.ogr[0].kendiPlan.metot.dakika=600;D.ogr[0].off=[];
 const sample=[['Türkçe','Ses Bilgisi',0],['Türkçe','Sözcükte Yapı',0],['Türkçe','İsim',0],['Türkçe','Sıfat',0],['Türkçe','Zamir',0],['Türkçe','Zarf',0],
 ['Matematik TYT','Temel Kavramlar',1],['Matematik TYT','Sayı Basamakları',1],['Matematik TYT','Bölünebilme',1],['Matematik TYT','EBOB EKOK',1],['Matematik TYT','Rasyonel Sayılar',1],['Matematik TYT','Basit Eşitsizlikler',1],['Matematik TYT','Üslü Sayılar',1],['Matematik TYT','Köklü Sayılar',1],['Matematik TYT','Çarpanlara Ayırma',1],['Matematik TYT','Denklemler',1],['Matematik TYT','Oran Orantı',1],['Matematik TYT','Problemler',1],
 ['Tarih','İlk Çağ',5],['Coğrafya','Harita Bilgisi (TYT)',7],['Felsefe','Felsefeye Giriş',8],['Din Kültürü','Din',9],['Fizik','Basınç',2],['Kimya','Atom (TYT)',2],['Biyoloji','Hücre',2],['Geometri','Açılar',1]];
 D.ogr[0].kendiPlan.sira=sample.map(([ders,ad,idx])=>{const ki=kullaniciKonusuTam(idx,ad,ders,12);D.konuDers[ki]=ders;return ki});`);
const forecast=()=>data(`(()=>{const f=TYT_WEEKLY.forecast(0,gunNo('2026-11-30'));return [...f.days].map(([day,rows])=>({day,rows}))})()`);
(async()=>{
 const base=forecast(),baseRows=base.flatMap(({day,rows})=>rows.map(x=>({...x,day}))),start=run("gunNo('2026-10-26')");
 const week=baseRows.filter(x=>x.day>=start&&x.day<start+7);
 assert(week.some(x=>x.metotTur==='video'&&x.dersAd==='Türkçe'));
 assert(week.some(x=>x.metotTur==='video'&&x.dersAd==='Matematik TYT'));
 assert(week.some(x=>x.metotTur==='video'&&['Tarih','Coğrafya'].includes(x.dersAd)),'social overlaps core lessons in the first week');
 const day4=week.filter(x=>x.day===start+4&&x.metotTur==='video');
 assert.equal(day4.filter(x=>x.dersAd==='Matematik TYT').length,2);assert.equal(day4.filter(x=>x.dersAd==='Türkçe').length,1);
 const inspect=days=>{
  const rows=days.flatMap(({day,rows})=>rows.map(x=>({...x,day})));
  for(const {day,rows:daily} of days){
   assert(daily.length<=8,'A4 row cap on '+day);
   const intros=daily.filter(x=>x.metotTur==='overview');
   assert(!daily.some(x=>x.metotTur==='video'&&intros.some(i=>i.dersAd===x.dersAd)),'no same-course video on its overview day');
   const videos=daily.filter(x=>x.metotTur==='video');
   if(intros.length>=2)assert.equal(videos.length,0,'multiple overviews reserve a breathing day');
   if(intros.length===1)assert(videos.length<=1,'one overview permits at most one other video');
  }
  for(const v of rows.filter(x=>x.metotTur==='video')){const r=rows.find(x=>x.metotTur==='recall'&&x.ki===v.ki&&x.metotVideoGun===v.day);assert(r,'video has reserved recall');assert.equal(r.day,v.day+3);}
 };
 inspect(base);
 await run("TYT_METOT.setStarts({fiz:'2026-10-27',kim:'2026-10-27',bio:'2026-10-27',tar:'2026-10-28'})");
 const overridden=forecast(),flat=overridden.flatMap(({day,rows})=>rows.map(x=>({...x,day})));inspect(overridden);
 for(const c of ['Fizik','Kimya','Biyoloji'])assert(flat.some(x=>x.day===start+1&&x.metotTur==='overview'&&x.dersAd===c),c+' starts on requested day');
 assert(flat.some(x=>x.day===start+2&&x.metotTur==='overview'&&x.dersAd==='Tarih'));
 const nextDate={fiz:'2026-11-02'};
 run(`hb=buHafta(0);wp=TYT_WEEKLY.weekly(0,hb,planHaftaSonu(0,hb),elleAl(0,hb));haftayiSabitle(0,hb,wp);D.elle['0|'+hb].ogrenciOtomatik=true;D.elle['0|'+hb].metotBaski=true;frozen=JSON.stringify(planHesapla(0,hb).gunler)`);
 await run(`TYT_METOT.setStarts(${JSON.stringify(nextDate)})`);assert.equal(run('JSON.stringify(planHesapla(0,hb).gunler)'),run('frozen'),'printed sheet remains unchanged');
 run(`future=sonrakiHafta(0,hb);fp=TYT_WEEKLY.weekly(0,future,planHaftaSonu(0,future),elleAl(0,future));D.elle['0|'+future]=JSON.parse(JSON.stringify(fp.elle));D.elle['0|'+future].sabit=future;D.elle['0|'+future].ogrenciOtomatik=true;D.ogrTaslak={};D.ogrTaslak['0|'+future]={sample:true};before=JSON.stringify([D.elle,D.ogrTaslak,D.ogr[0].kendiPlan.metot]);kaydet=async()=>false;`);
 await assert.rejects(run("TYT_METOT.setStarts({kim:'2026-11-05'})"));assert.equal(run('JSON.stringify([D.elle,D.ogrTaslak,D.ogr[0].kendiPlan.metot])'),run('before'),'failed save restores method and snapshots');
 run('kaydet=async()=>true');await run("TYT_METOT.setStarts({kim:'2026-11-05'})");assert.equal(run("!!D.elle['0|'+future]"),false,'unused automatic future sheet is rebuilt');assert(run("!!D.elle['0|'+hb]"),'printed sheet survives');
 console.log('PASS parallel subject starts, pacing, reservations and snapshot preservation');
})().catch(e=>{console.error(e);process.exitCode=1});

