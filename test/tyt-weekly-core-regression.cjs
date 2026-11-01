'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
// Reuse the app's established VM fixture, but exercise the weekly adapter itself.
const fixture=fs.readFileSync('test/tyt-metot-regression.cjs','utf8').split('(async()=>{')[0];
const {run,data}=new Function('require',fixture+'\nreturn {run,data};')(require);
if(run('typeof TYT_WEEKLY')==='undefined')run(fs.readFileSync('src/tyt-weekly.js','utf8'));
const before=run('JSON.stringify(D)');
const forecast=data('(()=>{const f=TYT_WEEKLY.forecast(0,bugunNo()+45);return {days:[...f.days],finalStart:f.finalStart}})()');
assert.equal(run('JSON.stringify(D)'),before,'preview does not write completions or snapshots');
const rows=forecast.days.flatMap(([day,xs])=>xs.map(x=>({...x,day})));
assert(forecast.days.every(([,xs])=>xs.length<=8),'new work carries forward instead of over-stacking the unchanged A4 page');
const videos=rows.filter(x=>x.anlatim),recalls=rows.filter(x=>x.metotTur==='recall');
assert(videos.length>0);assert(recalls.length>0);
for(const v of videos){const r=recalls.find(r=>r.ki===v.ki);assert(r);assert.equal(r.day,v.day+3);assert.equal(r.metotVideoGun,v.day);}
assert(!rows.some(x=>x.anlatim&&x.dersAd.includes('AYT')),'AYT never opens from forecast alone');
const mocks=rows.filter(x=>x.metotTur==='mock');assert.equal(mocks.length,5);
assert.deepEqual(mocks.map(x=>x.day-mocks[0].day),[0,1,3,4,5]);
assert(rows.some(x=>x.metotTur==='weak'&&x.day===mocks[0].day+2));
assert(run(`TYT_WEEKLY.ledger(0).recalls.size===0`));
run('const hb=buHafta(0); const wp=TYT_WEEKLY.weekly(0,hb,planHaftaSonu(0,hb),elleAl(0,hb)); haftayiSabitle(0,hb,wp);');
const frozen=run('JSON.stringify(planHesapla(0,buHafta(0)).gunler)');
run('D.ogr[0].kendiPlan.metot.dakika=120;D.ogr[0].off=[0,1,2,3,4,5,6]');
assert.equal(run('JSON.stringify(planHesapla(0,buHafta(0)).gunler)'),frozen,'issued rows and dates survive settings changes');
assert.throws(()=>run('(()=>{const s=JSON.parse(JSON.stringify(wp.elle.metotPlan));s.gunler.flat().find(x=>!x.serbest).ki=konuSayisi()+1;TYT_WEEKLY.validateSnapshot(s,konuSayisi())})()'));
console.log('TYT weekly core regression passed');
