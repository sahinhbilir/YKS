'use strict';
// Kurum raporu (the institution-level twin of the student report): the homework totals, the Türkiye geneli block (the list kind
// and school chosen on the Türkiye geneli page, with and without a list for the grade), the Etüt etkisi block (ETUT_ETKI's own pooled
// gain per etüt per ders, TYT and AYT, its verdict phrases, its missing-data messages), the page structure, and that no student,
// teacher or şube figure and no Devamsızlık is ever drawn. All records are synthetic.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),a=html.indexOf('<script id="uygulama">')+23,b=html.indexOf('// ---------------------------------------------------------------- başlangıç',a),source=html.slice(a,b);
const {kurumListesi,kurumRaporu,BIZ,BIZIM}=require('./fixtures/kurum-pdf.cjs');
// The followed school sits inside every subject's top list, so it has a printed place in each.
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
const svgK=(k,d)=>R.svgKurum(k,d).join(''),hepsiYok=()=>({var:false,neden:'liste'}),eeYok=()=>({var:false,neden:'etut'});
const rapor=(key,tur=hepsiYok)=>{const sc=R.kurumKapsamlari(S).find(x=>x.key===key);return R.kurumRapor(S,sc,tur,eeYok)};

check('scopes: Tüm okul first, then each grade that has students, highest first',()=>{
 assert.deepEqual(plain(R.kurumKapsamlari(S).map(x=>[x.key,x.label,x.count])),[['okul','Tüm okul',7],['12','12. sınıf',5],['11','11. sınıf',2]]);
});
check('homework: status totals, completion rate and per-ders rows keep Matematik TYT and AYT apart',()=>{
 const k=rapor('okul'),o=k.odev;assert.equal(o.total,32);assert.deepEqual(plain(o.statuses),[22,5,2,1,1,1]);
 assert.equal(o.statuses.reduce((a,b)=>a+b,0),o.total);assert.equal(Math.round(o.rate*100)/100,68.75);assert.equal(o.students,4);
 const m=o.courses.map(c=>c.course);assert(m.includes('Matematik TYT')&&m.includes('Matematik AYT'));assert.equal(o.date,'2026-10-24');
 const mt=o.courses.find(c=>c.course==='Matematik TYT');assert.equal(mt.values[0],15);assert.equal(mt.values[1],10);
 const k12=rapor('12').odev;assert.equal(k12.total,25);assert.equal(k12.statuses[0],17);assert.equal(Math.round(k12.rate*100)/100,68);
 const k11=rapor('11').odev;assert.equal(k11.total,7);assert.equal(Math.round(k11.rate*100)/100,71.43);
});

// ---- Türkiye geneli, through the Türkiye geneli module's own model ----
const liste=(ad,e,extra={},tur='Kolej')=>{const L=kurumListesi(e,{ad,normal:{N:180,oran:tur==='Kurs'?.05:.09},...extra});ctx.PG=kurumRaporu(L).pages;return vm.runInContext('TURKIYE.pdfCoz(PG,"'+ad+' Ders Ortalamaları İlk 100 Kurum ('+tur+').pdf")',ctx)};
const yukle=(grades,kurs={})=>{ // grades: {12:[exam names], 11:[exam names]} → D.turkiye with the school followed; kurs: the same exams as a Kurs list
 const rs=[];for(const [g,names] of Object.entries(grades))names.forEach((n,j)=>{const r=liste(n,j+1);r.__g=Number(g);rs.push(r)});
 for(const [g,names] of Object.entries(kurs))names.forEach((n,j)=>{const r=liste(n,j+1,{},'Kurs');r.__g=Number(g);rs.push(r)});
 ctx.RS=rs;ctx.OKUL=BIZ;
 vm.runInContext("D=varsayilan();D.rol='rehber';D.ogr=[];(()=>{let a={okul:OKUL,sinavlar:[]};for(const r of RS){a=TURKIYE.birlestir(a,r);a.sinavlar.at(-1).duzey=r.__g}D.turkiye=TURKIYE.paketle(a,5)})()",ctx);
};
const turkiyeKapat=()=>vm.runInContext('D=varsayilan();D.rol="rehber";D.ogr=[];EK.tgListe=undefined;EK.tgOkul=undefined',ctx);
const canli=key=>{const sc=R.kurumKapsamlari(S).find(x=>x.key===key);return R.kurumRapor(S,sc,undefined,eeYok)};
const TA='27-YKS-1201 TARAMA',GE='27-YKS-1202',TB='27-YKS-1203 TARAMA',GD='27-YKS-1204';
// The page's own model for a grade (Sıra view): the average place and every ders's printed place.
const mS=(liste,okul,oturum='TYT')=>plain(vm.runInContext("TURKIYE.model(TURKIYE.oku().veri,{"+(liste?"liste:"+JSON.stringify(liste)+",":"")+(okul?"okul:"+JSON.stringify(okul)+",":"")+"duzey:'d12',oturum:'"+oturum+"',mod:'sira'})",ctx));
const ortOf=m=>m.ozet.map(o=>o?Math.round(o.ort*10)/10:null),f1=v=>v.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});
const yerOf=(s,n)=>s===null?n+1:s;
check('Türkiye geneli: the page\'s own printed places; a ders compares the latest Tarama with the previous Tarama (a Genel exam between is skipped); the average place keeps first → latest',()=>{
 yukle({12:[TA,GE,TB,GD]});
 const b=canli('12').turkiye;assert.equal(b.var,true);assert.equal(b.liste,'kolej');assert.equal(b.exams.length,4);
 assert.deepEqual(plain(b.exams.map(e=>e.tur)),['tarama','genel','tarama','genel']);
 const c=b.cards.TYT,m=mS();
 assert.deepEqual(plain(c.pair),{once:0,son:2},'1201 → 1203, the Genel 1202 and the later Genel 1204 are not compared');assert.equal(c.pairText,'1201 → 1203 (tarama → tarama)');
 // The average place: the module's own, exam by exam; the change is first → latest exam with a value, positive when the school rose.
 assert.deepEqual(plain(c.ort),ortOf(m));assert.deepEqual(plain(c.ilk),m.ozet.map(o=>o.ilk));assert.equal(c.first,0);assert.equal(c.last,3);
 assert.equal(c.ortNow,ortOf(m)[3]);assert.equal(c.delta,Math.round((ortOf(m)[0]-ortOf(m)[3])*10)/10);assert.equal(c.N,100);
 // A ders: its printed place in every exam; the change is in places between the two Tarama exams.
 const md=m.dersler.find(d=>d.ad==='Türkçe'),ders=c.lessons.find(d=>d.ad==='Türkçe');
 assert.deepEqual(plain(ders.sira),md.seri.map(p=>p.sira));assert.equal(ders.now,md.seri[2].sira);assert.equal(ders.once,md.seri[0].sira);
 assert.equal(ders.delta,yerOf(md.seri[0].sira,md.seri[0].n)-yerOf(md.seri[2].sira,md.seri[2].n),'a ders compares tarama → tarama');
 const svg=svgK(canli('12'),'2026-10-25'),txt=metin(svg);
 for(const t of ['Değişim: 1201 → 1203 (tarama → tarama)','Ders karşılaştırması: 1201 → 1203 (tarama)','Değişim: ilk → son deneme (1201 → 1204)','TYT · Türkiye’deki sıra','TYT dersleri · Türkiye’deki sıra','Ortalama sıra','İlk 100’de','Tarama','Genel',f1(c.ortNow),ders.now+'.'])assert(txt.includes(t),t);
 assert(!txt.includes('Türkiye geneli listesi yok'));
 const bands=(svg.match(/fill="#e1efe9"/g)||[]).length;assert(bands>=2,'the compared Tarama exams are shaded in the main charts');
});
check('Türkiye geneli: Sıralamalar\' Tarama / Genel choice for an exam wins over its name; fewer than two Tarama gives no ders change',()=>{
 yukle({12:[TA,GE,GD]});const asil=vm.runInContext('SIRALAMA.oku',ctx);
 try{
  let c=canli('12').turkiye.cards.TYT;assert.equal(c.pair,null);assert(c.delta!==null,'the average place keeps first → latest');assert(c.lessons.every(d=>d.delta===null),'no ders change without two Tarama');
  const svg=svgK(canli('12'),'2026-10-25'),txt=metin(svg);assert(txt.includes('İki tarama denemesi yok'));assert(!txt.includes('Ders karşılaştırması:'),'no marker without two Tarama');assert(!svg.includes('fill="#e1efe9"'),'no shaded band');
  // The teacher marks 1202 as Tarama in Sıralamalar: now two Tarama exams exist.
  vm.runInContext("SIRALAMA.oku=()=>({veri:{sinavlar:[{ad:'27-YKS-1202',tur:'tarama'}]}})",ctx);
  c=canli('12').turkiye;assert.deepEqual(plain(c.exams.map(e=>e.tur)),['tarama','tarama','genel']);assert.deepEqual(plain(c.cards.TYT.pair),{once:0,son:1});assert(c.cards.TYT.lessons.every(d=>d.delta!==null));assert(metin(svgK(canli('12'),'2026-10-25')).includes('Ders karşılaştırması: 1201 → 1202 (tarama)'));
  vm.runInContext("SIRALAMA.oku=()=>({veri:{sinavlar:[{ad:'27-YKS-1201 TARAMA',tur:'genel'},{ad:'27-YKS-1202',tur:'tarama'}]}})",ctx);
  c=canli('12').turkiye;assert.deepEqual(plain(c.exams.map(e=>e.tur)),['genel','tarama','genel'],'a stored choice beats the name');assert.equal(c.cards.TYT.pair,null);
 }finally{ctx.__o=asil;vm.runInContext('SIRALAMA.oku=__o',ctx)}
});
check('change pills: green ▲ when the school rose, red ▼ when it fell, grey when unchanged; the words are the places',()=>{
 yukle({12:[TA,GE,TB]});
 const mk=d=>{const k=canli('12');for(const c of [k.turkiye.cards.TYT,k.turkiye.cards.AYT].filter(Boolean)){c.delta=d;c.ort[c.first]=31.2;c.ort[c.last]=12.4;for(const l of c.lessons){l.delta=d;l.once=35;l.now=23}}return svgK(k,'2026-10-25')};
 let v=mk(18.8);assert(v.includes('fill="#dcf1ea"')&&v.includes('▲ 31,2 → 12,4')&&v.includes('▲ 35. → 23.'),'green ▲: the average place and the ders places');
 v=mk(-12);assert(v.includes('fill="#f6e0d9"')&&v.includes('▼ 31,2 → 12,4')&&v.includes('▼ 35. → 23.'),'red ▼');
 const g=mk(0);assert(g.includes('fill="#e9ecea"')&&g.includes('>31,2 → 12,4<')&&!g.includes('▲ 31')&&!g.includes('▼ 31'),'grey, no arrow');
 // Outside the list: the ders box says so; a change from outside reads "dışı".
 const k=canli('12'),l=k.turkiye.cards.TYT.lessons[0];l.once=null;l.now=87;l.delta=14;l.nOnce=100;const w=svgK(k,'2026-10-25');assert(w.includes('▲ dışı → 87.'));
 const k2=canli('12'),l2=k2.turkiye.cards.TYT.lessons[0];l2.now=null;l2.nNow=100;l2.delta=null;assert(metin(svgK(k2,'2026-10-25')).includes('İlk 100 dışı'));
});
check('the Kurum charts: place axis with 1. at the top and 100. at the bottom; nothing estimated anywhere (no dilim, no T, no ≈)',()=>{
 yukle({12:[TA,GE,TB,GD]});
 const svg=svgK(canli('12'),'2026-10-25'),txt=metin(svg);
 for(const t of ['1.','25.','50.','75.','100.'])assert(txt.includes(t),t);
 const tyt=svg.split('aria-label="TYT ortalama sıra grafiği"')[1].split('</g>')[0];
 const y=lab=>Number((new RegExp('<text x="[^"]*" y="([^"]*)"[^>]*>'+lab.replace('.','\\.')+'</text>').exec(tyt)||[])[1]);
 assert(y('1.')<y('25.')&&y('25.')<y('50.')&&y('50.')<y('100.'),'1. is at the top');
 for(const k of ['12','okul']){const t=metin(svgK(canli(k),'2026-10-25'))+' '+svgK(canli(k),'2026-10-25').replace(/<(?!title)[^>]+>/g,' ');
  for(const yasak of ['ilk %','dilim','Dilim','ΔT','T puan','≈','okul içinde','σ'])assert(!t.includes(yasak),k+': "'+yasak+'"');
  assert(!/(^|[^\p{L}])T([^\p{L}]|$)/u.test(t.replace(/TYT|AYT/g,'')),k+': no stand-alone T')}
 const tx=metin(svgK(canli('okul'),'2026-10-25'));
 for(const t of ['TYT ortalama sıra','Değişim','Listede olduğu ders','Sıra gelişimi','▲ yeşil: sıra yükseldi · ▼ kırmızı: sıra düştü'])assert(tx.includes(t),t);
 turkiyeKapat();
});
check('TYT and AYT are separate charts, and a missing exam between two points is bridged by one continuous line',()=>{
 yukle({12:[TA,GE,TB,GD]});const k=canli('12'),b=k.turkiye;
 b.cards.TYT.ort=[20,null,15,18];b.cards.TYT.ilk=[2,null,3,3];b.cards.TYT.ders=[3,null,3,3];
 const svg=svgK(k,'2026-10-25'),tytG=svg.split('aria-label="TYT ortalama sıra grafiği"')[1].split('</g><text')[0];
 assert(svg.includes('aria-label="AYT ortalama sıra grafiği"'),'the AYT card has its own chart');
 const pts=g=>g.match(/<polyline data-seri="Ortalama sıra" points="([^"]+)"/)[1].split(' ').map(p=>p.split(',').map(Number));
 const p=pts(tytG);assert.equal(p.length,3,'three values, one polyline through them');assert(p[1][0]-p[0][0]>0&&Math.abs((p[1][0]-p[0][0])-(p[2][0]-p[1][0])*2)<1e-6,'the line runs straight over the empty exam (twice the step)');
 assert(p[1][1]<p[0][1],'a better (smaller) place is higher up');
 assert.equal((tytG.match(/<polyline data-seri="Ortalama sıra"/g)||[]).length,1,'no break: one path');
});
check('without a Türkiye geneli list for the grade: own TYT average per exam and the plain Turkish notice',()=>{
 yukle({12:['27-YKS-1201','27-YKS-1202']});
 const k=canli('11');assert.equal(k.turkiye.var,false);assert.equal(k.turkiye.neden,'liste');
 const svg=svgK(k,'2026-10-25');assert(metin(svg).includes('Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.'));
 assert(svg.includes('Okul ortalaması'),'the fallback chart is the school\'s own average');assert.equal(k.denemeler.length,2);assert.equal(k.denemeler[1].avg,(32+34)/2);
 turkiyeKapat();const k2=canli('12');assert.equal(k2.turkiye.var,false);assert(metin(svgK(k2,'2026-10-25')).includes('Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.'));
});
check('Tüm okul: one row per grade, a grade with a list shows its average place, its change and the subjects in the list; one without says so',()=>{
 yukle({12:[TA,GE,TB]});
 const k=canli('okul');assert.deepEqual(plain(k.turkiye.grades.map(g=>[g.grade,g.count,g.block.var])),[[12,5,true],[11,2,false]]);
 const svg=svgK(k,'2026-10-25'),tx=metin(svg);assert(svg.includes('aria-label="12. sınıf Türkiye geneli"')&&svg.includes('aria-label="11. sınıf Türkiye geneli"'));
 assert(tx.includes('Türkiye geneli listesi yok; Türkiye geneli sayfasından ekleyin.'));assert(svg.includes('Okul ort. TYT neti: 33'));
 const c=k.turkiye.grades[0].block.cards.TYT;assert(tx.includes(f1(c.ortNow))&&tx.includes(c.ilkNow+' / '+c.dersNow+' ders'));
 assert(!tx.includes('dersleri · Türkiye’deki sıra'),'the whole-school page has no per-ders charts');assert(tx.includes('Kolej listesi'),'each grade row names its list kind');assert(tx.includes('1201 → 1203'),'the first → latest exam is named');
});
check('a list without the school: the page asks for the school to be chosen',()=>{
 yukle({12:['27-YKS-1201','27-YKS-1202']});vm.runInContext("(()=>{const v=D.turkiye;v.okul=null;})()",ctx);
 const k=canli('12');assert.equal(k.turkiye.var,false);assert.equal(k.turkiye.neden,'okulyok');assert(metin(svgK(k,'2026-10-25')).includes('Okulunuz bu listelerde bulunamadı'));
 turkiyeKapat();
});

// ---- the list kind and school chosen on the Türkiye geneli page ----
const ekAyarla=(liste,okul)=>{ctx.__L=liste;ctx.__O=okul;vm.runInContext('EK.tgListe=__L;EK.tgOkul=__O',ctx)};
const tytS=b=>plain(b.cards.TYT.ort);
check('the Türkiye block uses EK.tgListe and EK.tgOkul (the Türkiye geneli page\'s own choice); the old order only when that list kind has nothing for the grade',()=>{
 try{
  yukle({12:[TA,GE,TB]},{12:[TA,GE,TB]});
  let b=canli('12').turkiye;assert.equal(b.liste,'kolej','nothing chosen: the old order, Kolej first');assert.equal(b.yedek,false);const kolej=tytS(b);
  ekAyarla('kurs');b=canli('12').turkiye;assert.equal(b.var,true);assert.equal(b.liste,'kurs');assert.equal(b.listeAdi,'Kurs');assert.equal(b.yedek,false);
  assert.deepEqual(tytS(b),ortOf(mS('kurs')),'the page\'s own places for the Kurs list');assert.notDeepEqual(tytS(b),kolej,'not the Kolej places');
  let txt=metin(svgK(canli('12'),'2026-10-25'));assert(txt.includes('Kurs listesi · sıra:'),'the list kind is in the note');assert(!txt.includes('Seçtiğiniz'));
  const okullar=mS('kolej').okullar;assert(okullar.length>3);const baska=okullar.find(a=>a!==BIZ);
  ekAyarla('kurs',baska);b=canli('12').turkiye;assert.equal(b.okul,baska,'the school chosen on the page');assert.deepEqual(tytS(b),ortOf(mS('kurs',baska)));
  // The school table of Tüm okul follows the choice too and names the list.
  ekAyarla('kurs');assert(metin(svgK(canli('okul'),'2026-10-25')).includes('Kurs listesi'));
  // Only Kolej has the grade: the chosen Kurs list has nothing, so the report falls back and says so.
  yukle({12:[TA,GE,TB]});ekAyarla('kurs');b=canli('12').turkiye;assert.equal(b.liste,'kolej');assert.equal(b.yedek,true);assert.equal(b.secilen,'kurs');
  txt=metin(svgK(canli('12'),'2026-10-25'));assert(txt.includes('Kolej listesi · sıra:')&&txt.includes('Seçtiğiniz Kurs listesinde bu sınıf düzeyi yok; Kolej listesi gösterilir.'),txt);
  assert.deepEqual(tytS(b),ortOf(mS('kolej')));
  // No EK at all (the page is closed): the old order.
  ekAyarla(undefined,undefined);assert.equal(canli('12').turkiye.liste,'kolej');
 }finally{turkiyeKapat()}
});

// ---- Etüt etkisi: ETUT_ETKI's own pooled model, planted effects, synthetic students only ----
const fx=require('./fixtures/kurum-etut.cjs'),EM=vm.runInContext('ETUT_ETKI',ctx);
ctx.__oku=vm.runInContext('TURKIYE.oku',ctx);ctx.__ort=vm.runInContext('TURKIYE.ortalamalar',ctx);
const klon=x=>JSON.parse(JSON.stringify(x));
const trKur=(...l)=>{ctx.__KI=fx.tr(...l);vm.runInContext('TURKIYE.oku=()=>({veri:{}});TURKIYE.ortalamalar=()=>(a=>{const o=__KI[a];return o?{genel:k=>k in o?o[k]:null}:null})',ctx)};
const trGeri=()=>{vm.runInContext('TURKIYE.oku=__oku;TURKIYE.ortalamalar=__ort',ctx);turkiyeKapat()};
const sgn=v=>{const a=Math.round(Math.abs(v)*10)/10,t=a.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});return (v>0&&a>0?'+':v<0&&a>0?'−':'')+t};
const kapsam=(st,g)=>({key:String(g),label:g+'. sınıf',grade:g,count:st.filter(s=>s.grade===g).length});
const kurE=(st,g)=>R.kurumRapor(klon(st),kapsam(st,g),hepsiYok);
const okulE=st=>R.kurumRapor(klon(st),{key:'okul',label:'Tüm okul',grade:null,count:st.length},hepsiYok);
const modelRef=(st,oturum,ders,g=12)=>plain(EM.model(klon(st),{duzey:g,oturum,ders,donem:'tum'},null,vm.runInContext('TURKIYE.ortalamalar(TURKIYE.oku().veri)',ctx)));
const EE_CUMLE='Her etüt için artış: aynı öğrencinin etüt almadığı derslerine göre, etüt alınan dersteki ek artış (Türkiye farkı, net). Çalışkanlık her derse yansıdığı için bu karşılaştırmada çıkar. Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir.';
check('Etüt etkisi: every ders with etüts, TYT and AYT, shows ETUT_ETKI\'s own pooled γ and interval, its verdict phrase and the students counted',()=>{
 trKur(fx.TYT_DERS,fx.AYT_DERS);
 try{
  const st=fx.ogrenciler(),k=kurE(st,12),s=k.etutEtki.sonuc;assert.equal(k.etutEtki.grade,12);assert.equal(s.var,true);
  const svg=svgK(k,'2026-10-25'),txt=metin(svg);
  assert.deepEqual(plain(Object.keys(s.oturumlar)),['TYT','AYT']);
  assert.deepEqual(plain(s.oturumlar.TYT.satirlar.map(r=>r.ders).sort()),['Biyoloji','Fizik','Kimya','Matematik']);assert.deepEqual(plain(s.oturumlar.AYT.satirlar.map(r=>r.ders)),['Matematik'],'a ders with no AYT net is no AYT row');
  for(const oturum of ['TYT','AYT'])for(const r of s.oturumlar[oturum].satirlar){
   const m=modelRef(st,oturum,r.ders);
   assert.deepEqual(plain(r.b),m.ozet.b,r.ders+' γ is the model\'s');assert.deepEqual(plain(r.ci),m.ozet.ci,r.ders+' interval is the model\'s');assert.equal(r.karar.k,m.karar.k);assert.equal(r.karar.yazi,m.karar.yazi);
   assert.equal(r.n,m.ogrenciler.filter(o=>!o.aykiri).length);assert.equal(r.n,21);assert.equal(r.uc,0);
   if(r.b!==null&&r.karar.k!=='veri'){assert(txt.includes('≈ '+sgn(m.ozet.b)+' net'),r.ders+' '+sgn(m.ozet.b));assert(txt.includes('('+sgn(m.ozet.ci[0])+' ile '+sgn(m.ozet.ci[1])+')'),r.ders+' interval')}
  }
  const by=(o,d)=>s.oturumlar[o].satirlar.find(r=>r.ders===d);
  assert(Math.abs(by('TYT','Matematik').b-0.4)<1e-9&&by('TYT','Matematik').karar.k==='var','the planted +0,4');assert(Math.abs(by('AYT','Matematik').b-0.3)<1e-9);assert(Math.abs(by('TYT','Kimya').b+0.5)<1e-9&&by('TYT','Kimya').karar.k==='az');
  assert(Math.abs(by('TYT','Fizik').b)<1e-9&&by('TYT','Fizik').karar.k==='yok','a rebound and a school trend are not credited');assert.equal(by('TYT','Biyoloji').b,null);assert.equal(by('TYT','Biyoloji').karar.k,'veri');
  assert(txt.includes('≈ +0,4 net')&&txt.includes('≈ +0,3 net')&&txt.includes('≈ −0,5 net')&&txt.includes('≈ 0,0 net'),txt);assert(txt.includes('(+0,4 ile +0,4)'));
  for(const t of ['artış belirgin','belirgin fark yok','etüt alanlarda daha az','yeterli veri yok'])assert(txt.includes(t),t);
  assert(txt.includes(EE_CUMLE),'the plain explanation');assert(txt.includes('Her etüt için artış')&&txt.includes('olası aralık')&&txt.includes('Öğrenci')&&txt.includes('Hesaba katılmadı'));
  assert(/yeterli veri yok/.test(txt.split('Biyoloji')[1]||''),'the row of the ders with no variation');
  // The colours of the phrases: green, grey, red, muted.
  for(const c of ['#dcf1ea','#e9ecea','#f6e0d9','#eef0ee'])assert(svg.includes('fill="'+c+'"'),c);
  assert(txt.includes('TYT')&&txt.includes('AYT')&&!txt.includes('0 uç sonuç'));
  // Only the pooled gain: no teacher, no per-teacher gain or total, no student name, no etüt count.
  assert(!/öğretmen/i.test(txt)&&!/Toplam katkı|katkı|sıra/i.test(txt.replace(/okul içinde|Sıralamalar/g,'')),'no teacher figure');assert(!/SENTETİK ÖĞR/.test(svg)&&!svg.includes('SENTETİK ÖĞRETMEN'),'no names');assert(!/hoca/i.test(JSON.stringify(k.etutEtki)));
  assert(!/etüt sayıları|Haftalık|Derse göre etüt|Öğrenci başına/.test(txt),'no etüt counts');assert(!svg.includes('…'));
  // No scatter (the teacher removed it); one table, each ders once, the TYT and AYT columns side by side.
  assert(!txt.includes('Etüt sayısı ve ek artış')&&!txt.includes('Aldığı etüt sayısı'));assert(txt.includes('TYT netinde · her etüt için artış')&&txt.includes('AYT netinde · her etüt için artış'));
  assert.equal((txt.match(/Matematik/g)||[]).length,1,'Matematik is one row');
 }finally{trGeri()}
});
check('Etüt etkisi: extreme results are only a count, and the students counted leave them out',()=>{
 trKur(fx.TYT_DERS,fx.AYT_DERS);
 try{
  const st=fx.ogrenciler();st[3].exams.find(e=>e.session==='TYT'&&e.exam===fx.adTyt(2)).nets.mat+=60;
  const k=kurE(st,12),r=k.etutEtki.sonuc.oturumlar.TYT.satirlar.find(x=>x.ders==='Matematik'),m=modelRef(st,'TYT','Matematik'),txt=metin(svgK(k,'2026-10-25'));
  const uc=m.uc.filter(u=>u.tur!=='ozet').length;assert(uc>=1,'the planted blank-test style result is flagged');assert.equal(r.uc,uc);assert.equal(r.n,m.ogrenciler.filter(o=>!o.aykiri).length);
  assert.deepEqual(plain(r.b),m.ozet.b);assert(txt.includes(uc+' uç sonuç'),txt);assert(!/SENTETİK ÖĞR/.test(txt));
 }finally{trGeri()}
});
check('Etüt etkisi: what is missing is said, with the page that adds it',()=>{
 try{
  trKur(fx.TYT_DERS,fx.AYT_DERS);
  const say=(st,g=12)=>metin(svgK(kurE(st,g),'2026-10-25')).replace(/\s+/g,' ');
  // No etüt report: the students have no etüt at all.
  let t=say(fx.ogrenciler({ucret:false}));assert(t.includes('Etüt kaydı yok. Etütler sayfasından etüt raporu ekleyin.'),t);assert(!t.includes('≈ +')&&!t.includes('artış belirgin'));
  // No Türkiye list: the real module has none stored.
  trGeri();t=say(fx.ogrenciler());assert(t.includes('Etüt etkisi için Türkiye geneli listesi gerekir; Türkiye geneli sayfasından ekleyin.'),t);assert(!t.includes('≈ +'));
  // A list that does not have the school's exams: the same message (the raw nets are not a comparison).
  trKur(fx.TYT_DERS,fx.AYT_DERS);ctx.__KI={};t=say(fx.ogrenciler());assert(t.includes('Etüt etkisi için Türkiye geneli listesi gerekir'),t);ctx.__KI=fx.tr(fx.TYT_DERS,fx.AYT_DERS);
  // One exam only: no two exams in one session.
  let st=fx.ogrenciler();st.forEach(s=>{s.exams=s.exams.slice(0,1)});t=say(st);assert(t.includes('Etüt etkisi için aynı oturumda en az iki deneme gerekir. Sıralamalar sayfasından deneme listesi ekleyin.'),t);
  // Etüts only after the last exam.
  st=fx.ogrenciler();st.forEach(s=>s.sessions.forEach(x=>{x.date='2026-10-25'}));t=say(st);assert(t.includes('Denemeler arasına düşen etüt kaydı yok. Etütler sayfasından etüt raporu ekleyin.'),t);
  // TYT without a second exam but AYT with: the TYT column says so, the AYT column is drawn.
  st=fx.ogrenciler();st.forEach(s=>{s.exams=s.exams.filter(e=>e.session==='AYT'||e.exam===fx.adTyt(0))});t=say(st);assert(t.includes('Etüt etkisi için aynı oturumda en az iki deneme gerekir.')&&t.includes('≈ +0,3 net'),t);
  assert.equal(kurE(st,12).etutEtki.sonuc.oturumlar.TYT.satirlar.length,0);
  // Whole school: a grade with nothing is named under the table.
  trKur(fx.TYT_DERS,fx.AYT_DERS);const ok=metin(svgK(okulE([...fx.ogrenciler(),...fx.ogrenciler({sinif:11,ucret:false})]),'2026-10-25'));assert(ok.includes('11. sınıf: Etüt kaydı yok. Etütler sayfasından etüt raporu ekleyin.'),ok);
  // A scope with no grade has no etüt etkisi: every grade without etüt says so in one sentence.
  const hic=metin(svgK(okulE(fx.ogrenciler({ucret:false})),'2026-10-25'));assert(hic.includes('Etüt kaydı yok. Etütler sayfasından etüt raporu ekleyin.'));
 }finally{trGeri()}
});
check('Tüm okul: one compact ders × grade table per session (TYT, then AYT) with the per-etüt value and the verdict phrase; no per-grade teacher or count',()=>{
 // Grade 11 also sits Türkçe, with no etüt: each student's etüt dersler are compared with it.
 const TURKCE={ders:'Türkçe',course:'TÜRKÇE',key:'turkce',kod:'TÜRKÇE-T',kat:0,mod:'kontrol'};
 trKur([...fx.TYT_DERS,TURKCE],fx.AYT_DERS);
 try{
  const st=[...fx.ogrenciler(),...fx.ogrenciler({sinif:11,tyt:[{...fx.TYT_DERS[0],kat:0.2},{...fx.TYT_DERS[1],mod:'azalan',kat:-0.5},TURKCE],ayt:[]})];
  const k=okulE(st);assert.deepEqual(plain(k.etutEtki.grades.map(g=>[g.grade,g.count,g.sonuc.var])),[[12,21,true],[11,21,true]]);
  const svg=svgK(k,'2026-10-25'),txt=metin(svg).replace(/\s+/g,' ');
  const cell=(g,o,d)=>k.etutEtki.grades.find(x=>x.grade===g).sonuc.oturumlar[o].satirlar.find(r=>r.ders===d);
  for(const [g,o,d] of [[12,'TYT','Matematik'],[12,'TYT','Kimya'],[12,'AYT','Matematik'],[11,'TYT','Matematik'],[11,'TYT','Fizik']]){const r=cell(g,o,d),m=modelRef(st.filter(s=>s.grade===g),o,d,g);assert.deepEqual(plain(r.b),m.ozet.b,g+' '+o+' '+d);assert.deepEqual(plain(r.ci),m.ozet.ci);assert(svg.includes('aria-label="'+g+'. sınıf · '+d+' ('+o+') · her etüt ≈ '+sgn(r.b)+' net ('+sgn(r.ci[0])+' ile '+sgn(r.ci[1])+')'),g+o+d)}
  assert(txt.includes('12. sınıf')&&txt.includes('11. sınıf')&&txt.includes('Her etüt için artış (net) ve karar')&&txt.includes(EE_CUMLE));
  assert(txt.indexOf('TYT',txt.indexOf('Etüt etkisi'))<txt.indexOf('AYT',txt.indexOf('Etüt etkisi')),'TYT first, then AYT');
  for(const t of ['artış belirgin','etüt alanlarda daha az','+0,4','+0,2','−0,5'])assert(txt.includes(t),t);
  assert(!/öğretmen|SENTETİK ÖĞR|uç sonuç hesaba/i.test(txt.replace(/Uç sonuç: diğerlerinden/,'')),'no names');assert(!svg.includes('…'));
  assert.deepEqual(plain(Object.keys(k).sort()),['count','denemeler','etutEtki','odev','school','scope','sources','subeCount','turkiye']);
 }finally{trGeri()}
});
check('page structure: Türkiye geneli, Etüt etkisi, Ödevler (with the scatter beside them in a grade), each page numbered; no Etütler, Devamsızlık or Şube blocks',()=>{
 trKur(fx.TYT_DERS,fx.AYT_DERS);
 try{
  const st=fx.ogrenciler(),kartlar=pages=>plain(pages).map(p=>[...p.matchAll(/data-kart="([^"]+)"/g)].map(m=>m[1]));
  const p12=R.svgKurum(kurE(st,12),'2026-10-25'),k12=kartlar(p12);assert.deepEqual(k12.flat(),['Türkiye geneli','Etüt etkisi']);assert(p12.length>=1);
  const pok=R.svgKurum(okulE([...st,...fx.ogrenciler({sinif:11,tyt:fx.TYT_DERS.slice(0,2),ayt:[]})]),'2026-10-25'),kok=kartlar(pok);assert.deepEqual(kok.flat(),['Türkiye geneli','Etüt etkisi'],'no ödev report and no scatter: no empty Ödevler page');assert(plain(pok)[0].includes('Ödev raporu: yok'),'the header says so');
  for(const ps of [p12,pok])ps.forEach((p,i)=>{assert(p.includes('Sayfa '+(i+1)+' / '+ps.length));assert.match(p,/^<svg [^>]*viewBox="0 0 1190\.55 841\.89"/);assert(!p.includes('Devamsızlık')&&!p.includes('Şube karşılaştırması')&&!/data-kart="Etütler"/.test(p))});
  // With a Türkiye list for the grade the dilim cards fill page 1 and the rest follows on page 2.
  vm.runInContext('TURKIYE.oku=__oku',ctx);turkiyeKapat();yukle({12:[TA,GE,TB]});ctx.__KI=fx.tr(fx.TYT_DERS,fx.AYT_DERS);vm.runInContext('TURKIYE.ortalamalar=()=>(a=>{const o=__KI[a];return o?{genel:k=>k in o?o[k]:null}:null})',ctx);
  const lk=R.svgKurum(R.kurumRapor(klon(st),kapsam(st,12),R.kurumTurkiye),'2026-10-25'),kl=kartlar(lk);assert.deepEqual(kl[0],['Türkiye geneli']);assert.deepEqual(kl.flat(),['Türkiye geneli','Etüt etkisi']);assert.equal(lk.length,kl.length);
 }finally{trGeri()}
});
check('no devamsızlık, no şube figures, no teacher, no etüt count and no student name in any scope; the header keeps "N öğrenci · M şube"',()=>{
 yukle({12:['27-YKS-1201','27-YKS-1202','27-YKS-1203']});
 try{
  for(const key of ['okul','12','11']){const sc=R.kurumKapsamlari(S).find(x=>x.key===key),k=R.kurumRapor(S,sc,undefined,eeYok),pages=R.svgKurum(k,'2026-10-25'),svg=pages.join(''),txt=metin(svg);
   for(const n of NAMES)assert(!svg.includes(n),key+' leaks '+n);assert(!/SENTETİK (BİR|İKİ|ÜÇ|DÖRT|BEŞ|ALTI|YEDİ)/.test(svg));
   for(const t of ['Devamsızlık','devamsız','Yoklama','kaçırılan','Şube karşılaştırması','Öğretmene göre','Derse göre etüt','Haftalık','Öğrenci başına','SENTETİK HOCA'])assert(!svg.includes(t),key+' still has '+t);
   assert(!/öğretmen/i.test(txt),key+' names teachers');assert(!/(^|[^\d])(9|10|11|12)\/[A-Z]([^\p{L}]|$)/u.test(txt)&&!/Şube ·/.test(svg),key+' has a per-şube figure');
   assert(svg.includes('Sentetik Kartal Anadolu Lisesi'));assert(!/(^|\D)\d{11}(\D|$)/.test(txt),'no TC kimlik style numbers');pages.forEach(p=>assert.match(p,/^<svg [^>]*viewBox="0 0 1190\.55 841\.89"/));
   assert.deepEqual(plain(Object.keys(k).sort()),['count','denemeler','etutEtki','odev','school','scope','sources','subeCount','turkiye'],'the model keeps nothing of the removed blocks');}
  const head=svgK(R.kurumRapor(S,R.kurumKapsamlari(S).find(x=>x.key==='12'),undefined,eeYok),'2026-10-25');
  for(const t of ['Kurum raporu · 12. sınıf','5 öğrenci · 2 şube','Rapor tarihi: 25.10.2026','Etüt: 14.09.2026 – 16.10.2026','Ödev raporu: 24.10.2026','Deneme: 20.09.2026 – 18.10.2026'])assert(head.includes(t),t);
  assert(!head.includes('Yoklama:'),'no yoklama range in the header');assert(metin(svgK(R.kurumRapor(S,R.kurumKapsamlari(S)[0],undefined,eeYok),'2026-10-25')).includes('7 öğrenci · 3 şube'));
 }finally{turkiyeKapat()}
});
check('a long school: ten TYT and four AYT dersler and thirteen ödev dersler are all listed in full, on numbered pages, nothing cut',()=>{
 trKur(fx.TYT_UZUN,fx.AYT_UZUN);
 try{
  const st=fx.ogrenciler({tyt:fx.TYT_UZUN,ayt:fx.AYT_UZUN}),C=['MATEMATİK TYT','MATEMATİK AYT','FİZİK','KİMYA','BİYOLOJİ','TÜRKÇE','EDEBİYAT','TARİH','COĞRAFYA','FELSEFE','DİN KÜLTÜRÜ','GEOMETRİ','İNGİLİZCE'];
  C.forEach((c,i)=>st[i].homework=[{course:c,values:[4,2,1,0,0,1,0],reportDate:'2026-10-24'}]);
  const k=kurE(st,12),pages=R.svgKurum(k,'2026-10-25'),txt=metin(pages.join(''));
  assert.equal(k.odev.courses.length,13);assert.equal(k.etutEtki.sonuc.oturumlar.TYT.satirlar.length,10);assert.equal(k.etutEtki.sonuc.oturumlar.AYT.satirlar.length,4);
  for(const d of ['Matematik','Türkçe','Fizik','Kimya','Biyoloji','Tarih','Coğrafya','Felsefe','Din Kültürü','Geometri'])assert((txt.match(new RegExp(d,'g'))||[]).length>=1,d);
  for(const c of k.odev.courses)assert(txt.includes(c.course),c.course);
  assert(!pages.join('').includes('…'));pages.forEach((p,i)=>assert(p.includes('Sayfa '+(i+1)+' / '+pages.length)));assert(pages.length>=2);
  const ok=R.svgKurum(okulE(st),'2026-10-25').join('');assert(!ok.includes('…'));
 }finally{trGeri()}
});
console.log(passed+' kurum report checks passed');
