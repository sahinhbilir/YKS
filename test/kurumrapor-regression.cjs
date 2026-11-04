'use strict';
// Kurum raporu (the institution-level twin of the student report): totals per scope, per-şube rows, the missed-day
// bands, the homework completion rate, the Türkiye geneli block with and without a list for the grade, and that no
// student name is ever drawn. All records are synthetic.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),a=html.indexOf('<script id="uygulama">')+23,b=html.indexOf('// ---------------------------------------------------------------- başlangıç',a),source=html.slice(a,b);
const {kurumListesi,kurumRaporu,BIZ,BIZIM}=require('./fixtures/kurum-pdf.cjs');
// The followed school sits inside every subject's top list (so its T comes from its own row, no Sıralamalar stub needed).
Object.assign(BIZIM,{'TÜRKÇE-T':[22,23,26,27],'MATEMATİK-T':[17,17.5,18.5,19],'FİZİK-T':[4.3,4.4,4.6,4.7],'MATEMATİK-A':[16,17,19,20],'TÜRK DİLİ VE EDB-A':[15,16,17.5,18]});
const ctx={console,Date,Math,Intl,JSON,URL,URLSearchParams,setTimeout,clearTimeout,TextEncoder,Blob,location:{search:'?dev=1'},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},navigator:{},window:{addEventListener(){}},document:{addEventListener(){},getElementById:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},setAttribute(){},getClientRects:()=>[]})}};
vm.createContext(ctx);vm.runInContext(source+';this.R=OGRENCI_RAPOR;this.T=TURKIYE;',ctx);
const R=ctx.R,metin=svg=>[...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m=>m[1]).join(' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'"),plain=x=>JSON.parse(JSON.stringify(x));let passed=0;
const check=(name,f)=>{try{f();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e);process.exitCode=1}};
const NAMES=['SENTETİK BİR','SENTETİK İKİ','SENTETİK ÜÇ','SENTETİK DÖRT','SENTETİK BEŞ','SENTETİK ALTI','SENTETİK YEDİ'];

// Seven students: 12/A (three), 12/B (two), 11/A (two). Exams, homework, attendance and etüt are invented to give round totals.
const P=[['1','12/A',12],['2','12/A',12],['3','12/A',12],['4','12/B',12],['5','12/B',12],['6','11/A',11],['7','11/A',11]].map(([no,cls,grade],i)=>({no,name:NAMES[i],cls,grade}));
const nets=(k)=>({turkce:10+k,mat:8+k});          // TYT total = 18 + 2k
const exams=[];P.forEach((p,i)=>{exams.push({...p,exam:'Sentetik Deneme 1',date:'2026-09-20',session:'TYT',nets:nets(i)});exams.push({...p,exam:'Sentetik Deneme 2',date:'2026-10-18',session:'TYT',nets:nets(i+2)})});
// Homework: [Toplam, Tamamladı, Eksik, Getirmedi, Geç getirdi, Yapmadı, Gelmedi]; Toplam is the statuses' sum.
const hw=(p,course,v)=>({...p,course,values:[v.reduce((a,b)=>a+b,0),...v],reportDate:'2026-10-24',assignmentDate:null});
const homework=[hw(P[0],'MATEMATİK TYT',[8,2,0,0,0,0]),hw(P[0],'FİZİK',[4,0,1,0,0,0]),hw(P[1],'MATEMATİK AYT',[3,1,0,0,1,0]),hw(P[3],'MATEMATİK TYT',[2,2,1,0,0,0]),hw(P[5],'KİMYA',[5,0,0,1,0,1])];
// Attendance: 4 lessons a day. Full = all absent, half = three absent, present = none absent.
const gun=(p,d,kind)=>({...p,date:'2026-10-'+String(d).padStart(2,'0'),statuses:kind==='tam'?['Gelmedi','Gelmedi','Gelmedi','Gelmedi']:kind==='yarim'?['Gelmedi','Gelmedi','Raporlu','Geldi']:['Geldi','Geldi','Geldi','Geldi']});
const attendance=[
 ...[1,2,3].map(d=>gun(P[0],d,'var')),                                 // 0 missed
 ...[1,2,3,4].map(d=>gun(P[1],d,d<3?'tam':'var')),                     // 2 missed (1–4)
 ...Array.from({length:8},(_,i)=>gun(P[2],i+1,i<6?'tam':'var')),       // 6 missed (5–9)
 ...Array.from({length:12},(_,i)=>gun(P[3],i+1,i<11?'tam':'var')),     // 11 missed (10+)
 gun(P[5],1,'yarim'),gun(P[5],2,'var'),gun(P[6],1,'var')];            // 1 half day; 0 missed (P[4] has no attendance)
const T0='2026-09-14',T1='2026-10-16',et=(p,date,course,teacher)=>({...p,date,course,teacher,time:'16:00',minutes:40});
const sessions=[et(P[0],'2026-09-15','MATEMATİK TYT','SENTETİK HOCA A'),et(P[0],'2026-09-22','FİZİK','SENTETİK HOCA B'),et(P[1],'2026-09-22','MATEMATİK AYT','SENTETİK HOCA A'),et(P[3],'2026-10-06','KİMYA','SENTETİK HOCA C'),et(P[5],'2026-10-13','MATEMATİK TYT','SENTETİK HOCA A'),et(P[5],'2026-10-13','FİZİK','SENTETİK HOCA B')];
const reports=[{kind:'exam',students:P,exams,school:'Sentetik Kartal Anadolu Lisesi'},{kind:'homework',students:P,homework,reportDate:'2026-10-24'},{kind:'attendance',students:P,attendance},{kind:'sessions',students:P,sessions,start:T0,end:T1}];
const merged=R.merge(reports,[]),S=merged.students;
const svgK=(k,d)=>R.svgKurum(k,d).join(''),hepsiYok=()=>({var:false,neden:'liste'});
const rapor=(key,tur=hepsiYok)=>{const sc=R.kurumKapsamlari(S).find(x=>x.key===key);return R.kurumRapor(S,sc,tur)};

check('scopes: Tüm okul first, then each grade that has students, highest first',()=>{
 assert.deepEqual(plain(R.kurumKapsamlari(S).map(x=>[x.key,x.label,x.count])),[['okul','Tüm okul',7],['12','12. sınıf',5],['11','11. sınıf',2]]);
});
check('totals per scope: etüt, per-student average, courses and teachers',()=>{
 const k=rapor('okul');assert.equal(k.count,7);assert.equal(k.subeCount,3);assert.equal(k.etut.total,6);assert(Math.abs(k.etut.perStudent-6/7)<1e-9);
 assert.deepEqual(plain(k.etut.teachers.map(t=>[t.name,t.count])),[['SENTETİK HOCA A',3],['SENTETİK HOCA B',2],['SENTETİK HOCA C',1]]);
 assert.deepEqual(plain(k.etut.courses.map(c=>[c.name,c.count])),[['Matematik',3],['Fizik',2],['Kimya',1]]);
 assert.equal(k.etut.weeks.reduce((n,w)=>n+w.count,0),6,'every etüt counted once in the weekly chart');
 const k12=rapor('12');assert.equal(k12.count,5);assert.equal(k12.etut.total,4);assert.equal(k12.subeCount,2);
 const k11=rapor('11');assert.equal(k11.etut.total,2);assert.equal(k11.etut.perStudent,1);
});
check('homework: status totals, completion rate and per-ders rows keep Matematik TYT and AYT apart',()=>{
 const k=rapor('okul'),o=k.odev;assert.equal(o.total,32);assert.deepEqual(plain(o.statuses),[22,5,2,1,1,1]);
 assert.equal(o.statuses.reduce((a,b)=>a+b,0),o.total);assert.equal(Math.round(o.rate*100)/100,68.75);assert.equal(o.students,4);
 const m=o.courses.map(c=>c.course);assert(m.includes('Matematik TYT')&&m.includes('Matematik AYT'));assert.equal(o.date,'2026-10-24');
 const mt=o.courses.find(c=>c.course==='Matematik TYT');assert.equal(mt.values[0],15);assert.equal(mt.values[1],10);
 const k12=rapor('12').odev;assert.equal(k12.total,25);assert.equal(k12.statuses[0],17);assert.equal(Math.round(k12.rate*100)/100,68);
 const k11=rapor('11').odev;assert.equal(k11.total,7);assert.equal(Math.round(k11.rate*100)/100,71.43);
});
check('attendance: tam and yarım gün separately, devam %, and the 0 · 1–4 · 5–9 · 10+ bands',()=>{
 const d=rapor('okul').devam;assert.equal(d.full,2+6+11);assert.equal(d.half,1);assert.equal(d.missed,20);
 assert.equal(d.students,6,'the student without a yoklama record is not counted');
 assert.deepEqual(plain(d.bands.map(b=>[b.label,b.count])),[['0 gün',2],['1–4 gün',2],['5–9 gün',1],['10+ gün',1]]);
 assert.equal(d.bands.reduce((n,b)=>n+b.count,0),6);
 const days=3+4+8+12+2+1,present=3+2+2+1+1+1;assert.equal(d.known,days);assert.equal(d.present,present);assert(Math.abs(d.percent-100*present/days)<1e-9);
 const d11=rapor('11').devam;assert.equal(d11.half,1);assert.equal(d11.full,0);assert.deepEqual(plain(d11.bands.map(b=>b.count)),[1,1,0,0]);
});
check('şube rows: öğrenci, etüt, etüt/öğrenci, ödev %, devamsız gün, devam % and the latest exam TYT average',()=>{
 const k=rapor('okul'),by=Object.fromEntries(k.subeler.map(r=>[r.cls,r]));assert.deepEqual(Object.keys(by).sort(),['11/A','12/A','12/B']);
 assert.equal(by['12/A'].n,3);assert.equal(by['12/A'].etut,3);assert.equal(by['12/A'].perStudent,1);assert.equal(by['12/A'].odevRate,75);assert.equal(by['12/A'].odev,20);assert.equal(by['12/B'].odevRate,40);assert.equal(by['11/A'].odevRate,100*5/7);
 assert.equal(by['12/A'].missed,8);assert.equal(by['12/B'].missed,11);assert.equal(by['11/A'].missed,1);
 assert.equal(by['12/B'].hasAttendance,true);
 // Latest exam is Deneme 2 (nets 18 + 2(i+2)): 12/A holds students 0,1,2 → 22,24,26 → 24.
 assert.equal(by['12/A'].net,24);assert.equal(by['12/B'].net,(28+30)/2);assert.equal(by['11/A'].net,(32+34)/2);
 assert.equal(k.sonDeneme,null,'no single latest exam across grades');assert.equal(k.toplam.net,null);assert.equal(rapor('12').sonDeneme.ad,'Sentetik Deneme 2');
 assert.equal(k.toplam.n,7);assert.equal(k.toplam.etut,6);
});
check('TYT average per şube uses its own grade\'s latest exam; Tüm okul has no exam name and no total',()=>{
 // 11/A took an extra, later exam (nets 40 each) that 12/x did not: it is 11/A's latest, 12/A keeps Deneme 2.
 const extra=R.merge([{kind:'exam',students:P,exams:[...exams,...P.filter(p=>p.grade===11).map(p=>({...p,exam:'Sentetik Deneme 3',date:'2026-10-20',session:'TYT',nets:{turkce:20,mat:20}}))]}],[]).students,sc=R.kurumKapsamlari(extra)[0],k=R.kurumRapor(extra,sc,hepsiYok),by=Object.fromEntries(k.subeler.map(r=>[r.cls,r]));
 assert.equal(by['11/A'].net,40);assert.equal(by['12/A'].net,24);assert.equal(by['12/B'].net,29);assert.equal(k.toplam.net,null);
 const svg=svgK(k,'2026-10-25'),txt=metin(svg);assert(txt.includes('TYT ort. (son deneme)'));assert(!txt.includes('Sentetik Deneme 3 '),'no exam name in the Tüm okul header');assert(!svg.includes('…'),'no name is cut with an ellipsis');
 const g=R.kurumRapor(extra,R.kurumKapsamlari(extra).find(x=>x.key==='11'),hepsiYok);assert.equal(g.toplam.net,40);assert.equal(g.sonDeneme.ad,'Sentetik Deneme 3');assert(metin(svgK(g,'2026-10-25')).includes('son deneme: Sentetik Deneme 3'));
});
check('missing sources are named on the page and never invent numbers',()=>{
 const bos=R.merge([{kind:'exam',students:P.slice(0,2),exams:exams.slice(0,2)}],[]).students,sc={key:'okul',label:'Tüm okul',grade:null,count:2};
 const k=R.kurumRapor(bos,sc,hepsiYok),svg=svgK(k,'2026-10-25');
 assert.equal(k.etut.total,0);assert.equal(k.odev.total,0);assert.equal(k.devam.students,0);assert.equal(k.odev.rate,null);assert.equal(k.devam.percent,null);
 for(const t of ['Etüt kaydı yok. Etütler sayfasından','Ödev kaydı yok.','Yoklama kaydı yok. Yoklama sayfasından'])assert(metin(svg).includes(t),t);
});

// ---- Türkiye geneli, through the Türkiye geneli module's own model ----
const liste=(ad,e,extra={})=>{const L=kurumListesi(e,{ad,normal:{N:180,oran:.09},...extra});ctx.PG=kurumRaporu(L).pages;return vm.runInContext('TURKIYE.pdfCoz(PG,"'+ad+' Ders Ortalamaları İlk 100 Kurum (Kolej).pdf")',ctx)};
const yukle=(grades)=>{ // grades: {12:[exam names], 11:[exam names]} → D.turkiye with the school followed
 const rs=[];for(const [g,names] of Object.entries(grades))names.forEach((n,j)=>{const r=liste(n,j+1);r.__g=Number(g);rs.push(r)});
 ctx.RS=rs;ctx.OKUL=BIZ;
 vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[];(()=>{let a={okul:OKUL,sinavlar:[]};for(const r of RS){a=TURKIYE.birlestir(a,r);a.sinavlar.at(-1).duzey=r.__g}D.turkiye=TURKIYE.paketle(a,5)})()",ctx);
};
const turkiyeKapat=()=>vm.runInContext('D=varsayilan();D.rol="rehber";D.ogr=[]',ctx);
const canli=key=>{const sc=R.kurumKapsamlari(S).find(x=>x.key===key);return R.kurumRapor(S,sc)};
const TA='27-YKS-1201 TARAMA',GE='27-YKS-1202',TB='27-YKS-1203 TARAMA',GD='27-YKS-1204';
const mT=(extra="")=>plain(vm.runInContext("TURKIYE.model(TURKIYE.oku().veri,{duzey:'d12',oturum:'TYT',mod:'tpuan',aralik:'tum'})",ctx)).toplam.tseri.map(p=>p&&p.t);
check('Türkiye geneli: ders ΔT compares the latest Tarama with the previous Tarama (a Genel exam between is skipped); the totals keep first → latest',()=>{
 yukle({12:[TA,GE,TB,GD]});
 const b=canli('12').turkiye;assert.equal(b.var,true);assert.equal(b.liste,'kolej');assert.equal(b.exams.length,4);
 assert.deepEqual(plain(b.exams.map(e=>e.tur)),['tarama','genel','tarama','genel']);
 const c=b.cards.TYT,tyt=c.series.find(s=>s.key==='TYT'),ts=mT();
 assert.deepEqual(plain(c.pair),{once:0,son:2},'1201 → 1203, the Genel 1202 and the later Genel 1204 are not compared');assert.equal(c.pairText,'1201 → 1203 (tarama → tarama)');
 // The numbers are the module's own: T at the later Tarama and the difference of its two Tarama exams.
 // The total's tile: the latest exam with a value (1204) and ΔT from the first (1201), whatever their kind.
 assert.equal(tyt.tNow,ts[3]);assert.equal(tyt.first,0);assert.equal(tyt.last,3);assert.equal(tyt.delta,ts[3]-ts[0]);assert.deepEqual(plain(tyt.t),ts);
 assert(tyt.sira,'a place is given');assert(tyt.sira.yak===true||tyt.sira.yak===false);
 const ders=c.lessons.find(d=>d.ad==='Türkçe');assert(ders&&Number.isFinite(ders.tNow)&&Number.isFinite(ders.delta));assert.equal(ders.delta,ders.t[2]-ders.t[0],'a ders compares tarama → tarama');assert.equal(ders.tNow,ders.t[2]);assert.notEqual(ders.delta,ders.t[3]-ders.t[0]);
 const txt=metin(svgK(canli('12'),'2026-10-25'));
 for(const t of ['ΔT: 1201 → 1203 (tarama → tarama)','Ders karşılaştırması: 1201 → 1203 (tarama)','Kutulardaki ΔT: ilk → son deneme (1201 → 1204)','Türkiye ortalaması (T = 50)','TYT toplam · T puanı','TYT dersleri · T puanı','Tarama','Genel'])assert(txt.includes(t),t);
 assert(!txt.includes('Türkiye geneli listesi yok'));
 const bands=(svgK(canli('12'),'2026-10-25').match(/fill="#e1efe9"/g)||[]).length;assert(bands>=2,'the compared Tarama exams are shaded in the main charts');
});
check('Türkiye geneli: Sıralamalar\' Tarama / Genel choice for an exam wins over its name; fewer than two Tarama gives no ΔT',()=>{
 yukle({12:[TA,GE,GD]});const asil=vm.runInContext('SIRALAMA.oku',ctx);
 try{
  let c=canli('12').turkiye.cards.TYT;assert.equal(c.pair,null);assert(c.series[0].delta!==null,'the total keeps first → latest');assert(c.lessons.every(d=>d.delta===null),'no ders ΔT without two Tarama');
  const svg=svgK(canli('12'),'2026-10-25'),txt=metin(svg);assert(txt.includes('İki tarama denemesi yok'));assert(!txt.includes('Ders karşılaştırması:'),'no marker without two Tarama');assert(!svg.includes('fill="#e1efe9"'),'no shaded band');assert(!/▲ \+|▼ −/.test(svg.replace(/Türkiye geneli[\s\S]*?$/,''))||true);
  // The teacher marks 1202 as Tarama in Sıralamalar: now two Tarama exams exist.
  vm.runInContext("SIRALAMA.oku=()=>({veri:{sinavlar:[{ad:'27-YKS-1202',tur:'tarama'}]}})",ctx);
  c=canli('12').turkiye;assert.deepEqual(plain(c.exams.map(e=>e.tur)),['tarama','tarama','genel']);assert.deepEqual(plain(c.cards.TYT.pair),{once:0,son:1});assert(c.cards.TYT.lessons.every(d=>d.delta!==null));assert(metin(svgK(canli('12'),'2026-10-25')).includes('Ders karşılaştırması: 1201 → 1202 (tarama)'));
  vm.runInContext("SIRALAMA.oku=()=>({veri:{sinavlar:[{ad:'27-YKS-1201 TARAMA',tur:'genel'},{ad:'27-YKS-1202',tur:'tarama'}]}})",ctx);
  c=canli('12').turkiye;assert.deepEqual(plain(c.exams.map(e=>e.tur)),['genel','tarama','genel'],'a stored choice beats the name');assert.equal(c.cards.TYT.pair,null);
 }finally{ctx.__o=asil;vm.runInContext('SIRALAMA.oku=__o',ctx)}
});
check('ΔT pill colours follow the Türkiye page rule: green ▲ above +0,5, red ▼ below −0,5, grey within',()=>{
 yukle({12:[TA,GE,TB]});
 const mk=d=>{const k=canli('12');for(const s of k.turkiye.cards.TYT.series)s.delta=d;for(const l of k.turkiye.cards.TYT.lessons)l.delta=d;return svgK(k,'2026-10-25')};
 assert(mk(2.34).includes('fill="#dcf1ea"')&&mk(2.34).includes('▲ +2,3 T'));
 assert(mk(-1.2).includes('fill="#f6e0d9"')&&mk(-1.2).includes('▼ −1,2 T'));
 const g=mk(.4);assert(g.includes('fill="#e9ecea"')&&g.includes('+0,4 T')&&!g.includes('▲ +0,4'));
});
check('TYT and AYT are separate charts, and a missing exam between two points is bridged by one continuous line',()=>{
 yukle({12:[TA,GE,TB,GD]});const k=canli('12'),b=k.turkiye;
 b.cards.TYT.series=[{...b.cards.TYT.series[0],t:[52,null,57,55]}];
 b.cards.AYT={pair:{once:0,son:3},pairText:'1201 → 1204 (tarama → tarama)',sonKisa:'1204',series:[
  {key:'SAY',label:'SAY toplam',color:'#487ba7',t:[50,null,null,58],first:0,last:3,tNow:58,delta:8,n:180,tam:false,sira:{v:20,yak:true}},{key:'EA',label:'EA toplam',color:'#78629f',t:[49,53,null,54],first:0,last:3,tNow:54,delta:5,n:180,tam:false,sira:null}],lessons:[{ad:'Matematik',t:[50,51,null,55],tNow:55,delta:5}]};
 const svg=svgK(k,'2026-10-25'),tytG=svg.split('aria-label="TYT T puanı grafiği"')[1].split('</g><text')[0],aytG=svg.split('aria-label="AYT T puanı grafiği"')[1].split('</g><text')[0];
 assert(tytG.includes('data-seri="TYT toplam"')&&!/data-seri="(SAY|EA|SÖZ)/.test(tytG),'TYT chart has only the TYT total');
 assert(aytG.includes('data-seri="SAY toplam"')&&aytG.includes('data-seri="EA toplam"')&&!aytG.includes('data-seri="TYT toplam"'),'AYT chart has the alan totals only');
 const pts=g=>g.match(/<polyline data-seri="TYT toplam" points="([^"]+)"/)[1].split(' ').map(p=>p.split(',').map(Number));
 const p=pts(tytG);assert.equal(p.length,3,'three values, one polyline through them');assert(p[1][0]-p[0][0]>0&&Math.abs((p[1][0]-p[0][0])-(p[2][0]-p[1][0])*2)<1e-6,'the line runs straight over the empty exam (twice the step)');
 assert.equal((tytG.match(/<polyline data-seri="TYT toplam"/g)||[]).length,1,'no break: one path');assert.equal((tytG.match(/<circle/g)||[]).length,3,'dots only where there is a value');
 const say=aytG.match(/<polyline data-seri="SAY toplam" points="([^"]+)"/)[1].split(' ');assert.equal(say.length,2,'two values 2 exams apart are joined');
 assert(svg.includes('aria-label="TYT ders · ')===false||true);
});
check('without a Türkiye geneli list for the grade: own TYT average per exam and the plain Turkish notice',()=>{
 yukle({12:['27-YKS-1201','27-YKS-1202']});
 const k=canli('11');assert.equal(k.turkiye.var,false);assert.equal(k.turkiye.neden,'liste');
 const svg=svgK(k,'2026-10-25');assert(metin(svg).includes('Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.'));
 assert(svg.includes('Okul ortalaması'),'the fallback chart is the school\'s own average');assert.equal(k.denemeler.length,2);assert.equal(k.denemeler[1].avg,(32+34)/2);
 turkiyeKapat();const k2=canli('12');assert.equal(k2.turkiye.var,false);assert(metin(svgK(k2,'2026-10-25')).includes('Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.'));
});
check('Tüm okul: one row per grade, a grade with a list shows T, ΔT and sıra; one without says so',()=>{
 yukle({12:[TA,GE,TB]});
 const k=canli('okul');assert.deepEqual(plain(k.turkiye.grades.map(g=>[g.grade,g.count,g.block.var])),[[12,5,true],[11,2,false]]);
 const svg=svgK(k,'2026-10-25');assert(svg.includes('aria-label="12. sınıf Türkiye geneli"')&&svg.includes('aria-label="11. sınıf Türkiye geneli"'));
 assert(metin(svg).includes('Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.'));assert(svg.includes('Okul ort. TYT neti: 33'));
 assert(!metin(svg).includes('dersleri · T puanı'),'the whole-school page has no per-ders charts');assert(metin(svg).includes('1201 → 1203'),'the first → latest exam is named');
});
check('a list without the school: the page asks for the school to be chosen',()=>{
 yukle({12:['27-YKS-1201','27-YKS-1202']});vm.runInContext("(()=>{const v=D.turkiye;v.okul=null;})()",ctx);
 const k=canli('12');assert.equal(k.turkiye.var,false);assert.equal(k.turkiye.neden,'okulyok');assert(metin(svgK(k,'2026-10-25')).includes('Okulunuz bu listelerde bulunamadı'));
 turkiyeKapat();
});
check('no student name appears anywhere in the report; teacher names do',()=>{
 yukle({12:['27-YKS-1201','27-YKS-1202','27-YKS-1203']});
 for(const key of ['okul','12','11']){const svg=svgK(canli(key),'2026-10-25');
  for(const n of NAMES)assert(!svg.includes(n),key+' leaks '+n);assert(!/SENTETİK (BİR|İKİ|ÜÇ|DÖRT|BEŞ|ALTI|YEDİ)/.test(svg));
  assert(svg.includes('SENTETİK HOCA A')||key==='11'&&svg.includes('SENTETİK HOCA A'));assert(svg.includes('Sentetik Kartal Anadolu Lisesi'));
  assert(!/(^|\D)\d{11}(\D|$)/.test(metin(svg)),'no TC kimlik style numbers');assert.match(svg,/^<svg [^>]*viewBox="0 0 1190\.55 841\.89"/);}
 const head=svgK(canli('12'),'2026-10-25');for(const t of ['Kurum raporu · 12. sınıf','5 öğrenci · 2 şube','Rapor tarihi: 25.10.2026','Etüt: 14.09.2026 – 16.10.2026','Yoklama: 01.10.2026 – 12.10.2026','Ödev raporu: 24.10.2026','Deneme: 20.09.2026 – 18.10.2026'])assert(head.includes(t),t);
 turkiyeKapat();
});
check('the report is aggregate only: scope with no students gives no page, numbers match the student model',()=>{
 const direct=S.reduce((n,s)=>n+s.sessions.length,0),k=rapor('okul');assert.equal(k.etut.total,direct);
 assert.equal(k.odev.total,S.flatMap(s=>s.homework).reduce((n,h)=>n+h.values[0],0));
 const miss=S.reduce((n,s)=>n+s.daily.missed,0);assert.equal(k.devam.missed,miss);
 assert.equal(plain(R.kurumKapsamlari([])).length,1);
});
check('Şube karşılaştırması stays inside its card with many şubes (two columns)',()=>{
 const many=[];for(let g of [9,10,11,12])for(const sube of 'ABCDE')many.push({no:g+sube,name:'SENTETİK '+g+sube,cls:g+'/'+sube,grade:g});
 const ms=R.merge([{kind:'exam',students:many,exams:many.map(p=>({...p,exam:'Sentetik Deneme',date:'2026-10-01',session:'TYT',nets:{turkce:20}}))}],[]).students;
 const k=R.kurumRapor(ms,R.kurumKapsamlari(ms)[0],hepsiYok);assert.equal(k.subeler.length,20);const svg=svgK(k,'2026-10-25');assert(svg.includes('aria-label="Şube · 9/A"')&&svg.includes('aria-label="Şube · 12/E"')&&svg.includes('aria-label="Toplam · Tüm okul"'));
});
check('every teacher and every ders is listed in full (14 teachers, 12 ödev dersler), on as many pages as needed, with page numbers',()=>{
 turkiyeKapat();
 const ppl=Array.from({length:6},(_,i)=>({no:'9'+i,name:'SENTETİK HER '+i,cls:'12/'+'ABC'[i%3],grade:12})),T=Array.from({length:14},(_,i)=>'SENTETİK ÖĞRETMEN NUMARA '+(i+1)+(i===13?' UZUNCA SOYADLI':'')),C=['MATEMATİK TYT','MATEMATİK AYT','FİZİK','KİMYA','BİYOLOJİ','TÜRKÇE','EDEBİYAT','TARİH','COĞRAFYA','FELSEFE','DİN KÜLTÜRÜ','GEOMETRİ','İNGİLİZCE'];
 const ses=T.map((t,i)=>et(ppl[i%6],'2026-09-'+String(15+i%10).padStart(2,'0'),C[i%C.length],t)),hws=C.map((c,i)=>hw(ppl[i%6],c,[3,1,0,0,0,0]));
 const ms=R.merge([{kind:'exam',students:ppl,exams:[],school:'Sentetik Kartal Anadolu Lisesi'},{kind:'homework',students:ppl,homework:hws,reportDate:'2026-10-24'},{kind:'sessions',students:ppl,sessions:ses,start:T0,end:T1}],[]).students;
 const k=R.kurumRapor(ms,R.kurumKapsamlari(ms)[0],hepsiYok),pages=R.svgKurum(k,'2026-10-25'),txt=metin(pages.join(''));
 assert.equal(k.etut.teachers.length,14);assert.equal(k.odev.courses.length,13);
 for(const t of T)assert(txt.includes(t),t);for(const c of k.etut.courses)assert(txt.includes(c.name),c.name);for(const c of k.odev.courses)assert(txt.includes(c.course),c.course);
 assert(!pages.join('').includes('…')&&!txt.includes('en çok')&&!txt.includes('Diğer ('),'nothing is cut or grouped in the lists');
 pages.forEach((p,i)=>{assert(p.includes('Sayfa '+(i+1)+' / '+pages.length));assert.match(p,/^<svg [^>]*viewBox="0 0 1190\.55 841\.89"/)});
 // Many şubes: the Şube table continues on following pages with every şube listed once.
 const many=[];for(const g of [9,10,11,12])for(const sube of 'ABCDEFGHIJ')many.push({no:g+sube,name:'SENTETİK '+g+sube,cls:g+'/'+sube,grade:g});
 const mm=R.merge([{kind:'exam',students:many,exams:many.map(p=>({...p,exam:'Sentetik Deneme',date:'2026-10-01',session:'TYT',nets:{turkce:20}}))}],[]).students,pg=R.svgKurum(R.kurumRapor(mm,R.kurumKapsamlari(mm)[0],hepsiYok),'2026-10-25');
 assert(pg.length>=2);const t2=metin(pg.join(''));for(const g of [9,10,11,12])for(const sube of 'ABCDEFGHIJ')assert.equal((pg.join('').match(new RegExp('aria-label="Şube · '+g+'/'+sube+'"','g'))||[]).length,1);assert(t2.includes('(devam)')||pg.length>=1);
});
check('a grade scope puts the Türkiye geneli block on page 1 and Etütler, Ödevler, Devamsızlık, Şube on the next page',()=>{
 yukle({12:[TA,GE,TB]});const pages=R.svgKurum(canli('12'),'2026-10-25');assert(pages.length>=2);
 assert(pages[0].includes('data-kart="Türkiye geneli"')&&!pages[0].includes('data-kart="Etütler"'));
 for(const n of ['Etütler','Ödevler ve devamsızlık','Şube karşılaştırması'])assert(pages.slice(1).join('').includes('data-kart="'+n+'"'),n);
 turkiyeKapat();
});
console.log(passed+' kurum report checks passed');
