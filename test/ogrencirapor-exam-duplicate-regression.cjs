'use strict';
// One exam result must not be plotted twice when two sources date it differently. Synthetic data only.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),a=html.indexOf('<script id="uygulama">')+23,b=html.indexOf('// ---------------------------------------------------------------- başlangıç',a),source=html.slice(a,b);
const ctx={console,Date,Math,Intl,JSON,URL,URLSearchParams,setTimeout,clearTimeout,TextEncoder,Blob,location:{search:'?dev=1'},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},navigator:{},window:{addEventListener(){}},document:{addEventListener(){},getElementById:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},setAttribute(){},getClientRects:()=>[]})}};
vm.createContext(ctx);vm.runInContext(source+';this.R=OGRENCI_RAPOR;',ctx);const R=ctx.R;
const who={no:'1001',name:'SENTETİK ADA',cls:'12/A'};
const exam=(date,nets,extra={})=>({kind:'exam',students:[who],exams:[{...who,exam:'YKS-1202',date,session:'TYT',nets,...extra}]});
let passed=0;const check=(name,f)=>{try{f();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e);process.exitCode=1}};
check('same TYT result dated one week apart by two sources is one point, on the earlier date',()=>{
 const m=R.merge([exam('2026-10-02',{turkce:30,mat:20},{examType:'genel'}),exam('2026-10-09',{turkce:30,mat:20},{examType:'tarama'})]),s=m.students[0];
 assert.equal(s.exams.length,1);assert.equal(s.exams[0].date,'2026-10-02');assert.equal(s.exams[0].examType,'tarama');
});
check('the same exam with different nets stays two results',()=>{
 const s=R.merge([exam('2026-10-02',{turkce:30,mat:20}),exam('2026-10-09',{turkce:31,mat:20})]).students[0];assert.equal(s.exams.length,2);
});
check('identical nets more than a week apart, or another session, are not merged',()=>{
 assert.equal(R.merge([exam('2026-10-02',{turkce:30}),exam('2026-10-20',{turkce:30})]).students[0].exams.length,2);
 const ayt=exam('2026-10-09',{turkce:30});ayt.exams[0].session='AYT';
 assert.equal(R.merge([exam('2026-10-02',{turkce:30}),ayt]).students[0].exams.length,2);
});
console.log(passed+' passed');
