'use strict';
// Synthetic students and exams; the real public catalogue (data/yokatlas.json) for the model and the lists.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const cut=(re)=>{const m=re.exec(html);assert(m,'missing in index.html: '+re);return m[0]};
const catalogue=JSON.parse(fs.readFileSync('data/yokatlas.json','utf8'));
// The app's own exam definitions, so the module is tested against what the page really ships.
const app=[cut(/const DENEME_DERSLER = \{[\s\S]*?\n\};/),cut(/const DENEME_ALAN = \{[^\n]*\};/),cut(/const denemeNet = [^\n]*;/),cut(/function denemeBolumSayilir[\s\S]*?\n\}/)].join('\n');
let fetches=0,saves=0,confirmAnswer=true;
const sandbox={console,Intl,JSON,Math,Number,Object,Array,Set,Map,WeakMap,Error,Promise,String,fetch:async()=>{fetches++;return {ok:true,text:async()=>JSON.stringify(catalogue)}},document:{addEventListener(){}},
 D:{rol:'rehber',ayar:{},ogr:[{no:1,ad:'Sentetik Ada',alan:'SAY',denemeler:[]}]},EK:{ogr:0},ogrenciMi:()=>sandbox.D.rol==='ogrenci',rehberMi:()=>sandbox.D.rol==='rehber',yalnizcaGoruntuleme:()=>false,ogrenciSinavi:()=> 'YKS',
 kaydet:async()=>{saves++;return true},confirm:()=>confirmAnswer,kacis:s=>String(s),canliOgrenciler:()=>[0],denemeListe:si=>sandbox.D.ogr[si].denemeler.filter(r=>!r.silindi).slice().sort((a,b)=>a.tarih.localeCompare(b.tarih)||a.id.localeCompare(b.id)),
 ANALIZ:{kart:()=>({durum:'bos'})}};
vm.createContext(sandbox);vm.runInContext(app+'\n'+fs.readFileSync('src/yokatlas.js','utf8')+'\nglobalThis.api=YOKATLAS;',sandbox);const a=sandbox.api;
const same=(x,y,w)=>assert.equal(JSON.stringify(x),JSON.stringify(y),w);
const near=(x,y,tol,what)=>assert(Math.abs(x-y)<=tol,what+': '+x+' vs '+y);
// Full-length exam. `net` right answers per lesson, `skip` lessons omitted from the record.
const TYT_SORU={turkce:40,tarih:5,cografya:5,felsefe:5,din:5,mat:30,geo:10,fizik:7,kimya:7,biyoloji:6};
const AYT_SORU={SAY:{mat:30,geo:10,fizik:14,kimya:13,biyoloji:13},EA:{mat:30,geo:10,edebiyat:24,tarih1:10,cografya1:6},'SÖZ':{edebiyat:24,tarih1:10,cografya1:6,tarih2:11,cografya2:11,felsefe:12,din:6}};
const exam=(id,ad,tarih,oturum,{alan='SAY',skip=[],oran=.6,sinavTuru,tur=oturum}={})=>({id,ad,tarih,tur,oturum,brans:'',alan,sinavTuru,sure:null,puan:null,ts:1,
 dersler:Object.entries(oturum==='TYT'?TYT_SORU:AYT_SORU[alan]).filter(([k])=>!skip.includes(k)).map(([kod,soru])=>({kod,soru,dogru:Math.round(soru*oran),yanlis:0}))});
const student=sandbox.D.ogr[0];
(async()=>{
 // --- validation ---
 assert.equal(a.hedefDogrula({surum:1,id:'123456789',yil:2025,alan:'SAY'}),true);assert.throws(()=>a.hedefDogrula({surum:1,id:'x',yil:2025,alan:'SAY'}));
 const prog=catalogue.programs.find(p=>p.field==='SAY'&&p.nets);
 assert.equal(a.katalogDogrula(catalogue),catalogue);assert.throws(()=>a.katalogDogrula({...catalogue,programs:[{...prog,type:'VAKIF',scholarship:50}]}));
 for(const ok of [undefined,null,50,100,87.35])assert.equal(a.diplomaDogrula(ok),true);
 for(const bad of [49.99,100.01,'80',NaN,Infinity,{},[]])assert.throws(()=>a.diplomaDogrula(bad),/Diploma notu/,String(bad));
 const loaded=await a.yukle();assert.equal(await a.yukle(),loaded);assert.equal(fetches,1);

 // --- model: coefficients and residual SD per alan, fitted from the real catalogue ---
 const M=a.modelKur(catalogue),beklenen={SAY:[[129.8,1.274,2.714,0.119],2.7],EA:[[127.6,1.246,2.866,0.121],2.3],'SÖZ':[[131.0,1.244,2.83,0.11],4.8]};
 for(const [f,[b,sd]] of Object.entries(beklenen)){
  const m=M[f];assert(m,f);near(m.b[0],b[0],1,f+' a');near(m.b[1],b[1],.01,f+' TYT');near(m.b[2],b[2],.02,f+' AYT');near(m.b[3],b[3],.005,f+' OBP');near(m.sd,sd,.2,f+' SD');
  console.log('model',f,m.n,m.b.map(v=>+v.toFixed(3)).join(' '),'SD',m.sd.toFixed(2));
  // puan → rank is monotone: a higher puan never has a worse rank, and the ends are clamped
  let onceki=Infinity;for(let p=50;p<=600;p+=.5){const r=a.siraTahmin(m,p);assert(r<=onceki+1e-9,f+' rank must not rise with puan at '+p);onceki=r}
  assert.equal(a.siraTahmin(m,0),a.siraTahmin(m,-100));assert.equal(a.siraTahmin(m,600),a.siraTahmin(m,900));
  const tabanlar=catalogue.programs.filter(p=>p.field===f&&Number.isFinite(p.points)&&p.rank).map(p=>p.rank);
  assert(a.siraTahmin(m,900)>=Math.min(...tabanlar)-.5&&a.siraTahmin(m,0)<=Math.max(...tabanlar)+.5);
 }
 // The estimate: diploma notu × 5 as OBP, 95 (OBP 475) when empty; totals of the last placed student reproduce the programme's own puan.
 const e0=a.tahmin('SAY',60,40,undefined),e1=a.tahmin('SAY',60,40,95),e2=a.tahmin('SAY',60,40,85);
 assert.equal(e0.diplomaGirildi,false);assert.equal(e1.diplomaGirildi,true);assert.equal(e0.puan,e1.puan);near(e1.puan-e2.puan,M.SAY.b[3]*50,1e-6,'OBP effect');assert(e1.sira<=e2.sira);
 near(a.tahmin('SAY',60,40,95).obp,475,1e-9,'OBP = not × 5');
 {const p=catalogue.programs.find(x=>x.field==='EA'&&x.nets&&x.points>400),v=p.nets.values,t=v.tr+v.sos+v.mat+v.fen,y=v.amat+v.edb+v.tar1+v.cog1,e=a.tahmin('EA',t,y,p.nets.obp/5);near(e.puan,p.points,12,'a programme\'s own profile lands near its taban puan')}
 assert.equal(a.siraYaz(85123),85000);assert.equal(a.siraYaz(85260),85500);assert.equal(a.siraYaz(4321),4300);assert.equal(a.siraYaz(432),430);assert.equal(a.siraYaz(0.2),1);

 // --- the student's exams: Genel and Tarama both listed, every exam shown, unusable ones disabled with the reason ---
 student.denemeler=[
  exam('m:1','Tarama TYT 1','2026-09-04','TYT',{sinavTuru:'tarama'}),exam('m:2','Genel TYT 2','2026-10-02','TYT',{sinavTuru:'genel'}),
  exam('m:3','Tarama TYT 3 eksik','2026-10-30','TYT',{skip:['fizik'],sinavTuru:'tarama'}),
  exam('m:4','Tarama AYT 1','2026-09-11','AYT',{sinavTuru:'tarama'}),exam('m:5','Genel AYT 2','2026-10-09','AYT',{sinavTuru:'genel',oran:.8}),
  exam('m:6','Başka alan AYT','2026-10-23','AYT',{alan:'EA'}),
  {...exam('m:7','Silinmiş','2026-10-31','TYT'),silindi:true},{...exam('m:8','Branş','2026-10-31','TYT'),tur:'BRANS',brans:'turkce'}
 ];
 const s=a.sinavSecenekleri('SAY');
 same(s.tyt.map(x=>x.id),['m:3','m:2','m:1'],'all TYT, newest first; deleted and branch records are not exams');
 same(s.ayt.map(x=>x.id),['m:6','m:5','m:4']);
 same(s.tyt.map(x=>x.uygun),[false,true,true]);same(s.tyt[0].eksik,['Fizik']);
 same(s.ayt.map(x=>x.uygun),[false,true,true],'an AYT of another alan is listed but unusable for SAY');assert.match(a.sinavSecenekleri('SAY').ayt[0].eksik.join(),/Fizik/);
 assert(s.tyt.some(x=>x.r.sinavTuru==='genel')&&s.tyt.some(x=>x.r.sinavTuru==='tarama'));
 assert.equal(a.profil(student.denemeler[2],'TYT','SAY'),null);assert.equal(a.profil({...student.denemeler[0],silindi:true},'TYT','SAY'),null);
 assert.equal(a.profil(student.denemeler[0],'TYT','SAY').sos,12);
 // Son deneme: the latest usable of each (the incomplete newest TYT and the other alan's AYT are skipped)
 let m=a.merkezBul(student,'son','SAY');
 assert.equal(m.tyt.id,'m:2');assert.equal(m.ayt.id,'m:5');near(m.tyt.net,72,1e-9,'TYT total');near(m.ayt.net,63,1e-9,'AYT total');
 // Any earlier exam, including Genel; an unusable one is refused with its reason
 m=a.merkezBul(student,'sec','SAY',{tyt:'m:1',ayt:'m:4'});assert.equal(m.tyt.id,'m:1');assert.equal(m.ayt.id,'m:4');near(m.tyt.net,72,1e-9,'TYT total');
 m=a.merkezBul(student,'sec','SAY',{tyt:'m:3',ayt:'m:4'});assert.equal(m.tyt,null);assert.match(m.tytNeden,/eksik: Fizik/);
 // Alan switch only where the centre's AYT has the alan's tests
 let d=a.alanDurumlari(student,'sec',{ayt:'m:5'});assert.equal(d.SAY.ok,true);assert.equal(d.EA.ok,false);assert.match(d.EA.neden,/eksik:/);
 d=a.alanDurumlari(student,'sec',{ayt:'m:6'});assert.equal(d.EA.ok,true);assert.equal(d.SAY.ok,false);
 assert.equal(a.merkezBul(student,'sec','EA',{ayt:'m:6'}).ayt.id,'m:6');
 // --- school lists are the primary source (Denemeler table / Öğrenci kartı), student copies only fill the gaps ---
 {
  const eskiListe=student.denemeler,AYTK=['EDB','TAR1','COĞ1','TAR2','COĞ2','FELGR','DİN2','S.F2','AMAT','AGEO','AFİZ','AKİM','ABİY'],TYTK=['TÜR','TAR','COĞ','FEL','DİN','S.F','MAT','GEO','FİZ','KİM','BİY'];
  const FC={SAY:['AMAT','AGEO','AFİZ','AKİM','ABİY'],EA:['EDB','TAR1','COĞ1','AMAT','AGEO'],'SÖZ':['EDB','TAR1','COĞ1','TAR2','COĞ2','FELGR','DİN2','S.F2']};
  // Minimal stand-ins for the real SIRALAMA helpers (the browser test runs the real modules).
  sandbox.SIRALAMA={hasTYT:o=>TYTK.some(k=>o.net[k]!=null),hasAYT:o=>AYTK.some(k=>o.net[k]!=null),took:(o,f)=>FC[f].every(k=>o.net[k]!=null),FCOLS:FC,SIRA_DERS:{AYT:[['AFİZ','Fizik'],['AKİM','Kimya'],['ABİY','Biyoloji'],['EDB','Edebiyat'],['AMAT','Matematik'],['AGEO','Geometri']]}};
  const tytNet={'TÜR':30,'TAR':3,'COĞ':3,'FEL':3,'DİN':3,'MAT':20,'GEO':5,'FİZ':4,'KİM':4,'BİY':4},aytNet={AMAT:20,AGEO:5,'AFİZ':10,'AKİM':9,'ABİY':8};
  const sin=(id,ad,tarih,ogr)=>({id,ad,tarih,tyt:Object.fromEntries(Object.entries(ogr).map(([no,o])=>[no,{no,net:o.tyt||{}}])),ayt:Object.fromEntries(Object.entries(ogr).filter(([,o])=>o.ayt).map(([no,o])=>[no,{no,net:{...(o.tyt||{}),...o.ayt}}]))});
  sandbox.DPANO={veriAl:()=>({t:{sinavlar:[
   sin('A','27-YKS-1203','23.10.2026',{1:{tyt:tytNet,ayt:aytNet},2:{tyt:tytNet}}),
   sin('B','27-YKS-1202','09.10.2026',{1:{tyt:tytNet}}),                                // a school list only: no per-student copy
   sin('C','Fen eksik','01.10.2026',{1:{tyt:{...tytNet,'FİZ':null,'KİM':null,'BİY':null}}}),
   sin('D','Başka öğrenci','15.10.2026',{2:{tyt:tytNet}})                                // student 1 did not sit it
  ]}})};
  // Student copies: the same exam as A under another date (a duplicate), and one only the student has.
  student.denemeler=[exam('d:1','27-YKS-1203','2026-10-30','TYT',{oran:.6}),exam('d:2','27-yks-1203  ','2026-10-23','AYT',{oran:.6}),exam('d:3','Kendi Deneme','2026-10-12','TYT'),exam('d:4','27-yks-1202','2026-09-01','TYT',{oran:.3})];
  const l=a.sinavSecenekleri('SAY');
  same(l.tyt.map(x=>x.etiket),['23.10.2026 · 27-YKS-1203','2026-10-12'.split('-').reverse().join('.')+' · Kendi Deneme (öğrenci girdi)','09.10.2026 · 27-YKS-1202','01.10.2026 · Fen eksik'],'school exams (their own dates), the student-only entry, newest first; copies and absent exams are not listed');
  assert.equal(l.tyt.filter(x=>/1203/.test(x.etiket)).length,1,'a student copy with another date is not a second 1203');
  assert.equal(l.tyt.filter(x=>/1202/.test(x.etiket)).length,1);assert(!l.tyt.some(x=>/Başka öğrenci/.test(x.etiket)));
  assert.equal(l.tyt[2].kaynak,'okul');assert.equal(l.tyt[2].uygun,true,'a school-list-only exam is usable');
  assert.equal(l.tyt[3].uygun,false);same(l.tyt[3].eksik,['Fen Bilimleri']);assert.match(a.merkezBul(student,'sec','SAY',{tyt:l.tyt[3].id}).tytNeden,/eksik: Fen Bilimleri/);
  assert.equal(l.tyt[1].kaynak,'ogrenci');assert.equal(l.tyt[1].uygun,true);assert(!l.tyt[0].etiket.includes('öğrenci girdi'));
  same(l.ayt.map(x=>x.etiket),['23.10.2026 · 27-YKS-1203'],'the AYT copy matches by name and session despite case and spacing');assert.equal(l.ayt[0].uygun,true);
  // nets come from the school list, not from the student's copy
  let mm=a.merkezBul(student,'son','SAY');
  assert.equal(mm.tyt.id,l.tyt[0].id);near(mm.tyt.net,79,1e-9,'TYT total from the school list (the copy would give 72)');near(mm.ayt.net,52,1e-9,'AYT total from the school list');assert.equal(mm.tyt.tarih,'2026-10-23');
  mm=a.merkezBul(student,'sec','SAY',{tyt:l.tyt[2].id});near(mm.tyt.net,79,1e-9,'1202 comes from the school list, not the 30 % copy');
  mm=a.merkezBul(student,'sec','SAY',{tyt:l.tyt[1].id});near(mm.tyt.net,72,1e-9,'a student-only exam keeps its own nets');
  // another alan: the school AYT lacks its tests
  const e=a.sinavSecenekleri('EA').ayt[0];assert.equal(e.uygun,false);assert.match(e.eksik.join(),/Edebiyat/);
  // a student that is not on the lists falls back to their own entries
  sandbox.D.ogr[0].no=99;same(a.sinavSecenekleri('SAY').tyt.map(x=>x.kaynak),['ogrenci','ogrenci','ogrenci']);sandbox.D.ogr[0].no=1;
  // broken or missing lists never break the page
  sandbox.DPANO={veriAl:()=>{throw new Error('x')}};assert.equal(a.sinavSecenekleri('SAY').tyt.length,3);
  delete sandbox.DPANO;delete sandbox.SIRALAMA;student.denemeler=eskiListe;
 }
 // --- Gidişat: the Öğrenci kartı projection at the YKS date (totals), through ANALIZ.kart ---
 const cagrilar=[];
 sandbox.ANALIZ={kart:(no,key)=>{cagrilar.push([no,key]);return {durum:'tamam',oturum:{key},gidisat:{var:true,yks:{net:key==='TYT'?91.5:key==='AYT:SAY'?52.25:70}}}}};
 m=a.merkezBul(student,'gidisat','SAY');assert.equal(m.tyt.net,91.5);assert.equal(m.ayt.net,52.25);same(cagrilar.slice(0,2),[['1','TYT'],['1','AYT:SAY']]);
 assert.equal(a.merkezBul(student,'gidisat','EA').ayt.net,70);
 const tg=a.tahmin('SAY',m.tyt.net,m.ayt.net,undefined);assert(tg.puan>a.tahmin('SAY',72,63,undefined).puan-60);
 sandbox.ANALIZ={kart:(no,key)=>({durum:'tamam',oturum:{key},gidisat:{var:true,yks:key==='TYT'?{net:90}:null}})};
 m=a.merkezBul(student,'gidisat','SAY');assert.equal(m.tyt.net,90);assert.equal(m.ayt,null);assert.match(m.aytNeden,/YKS/);
 sandbox.ANALIZ={kart:()=>({durum:'bos'})};m=a.merkezBul(student,'gidisat','SAY');assert.equal(m.tyt,null);assert.match(m.tytNeden,/sıralama/);
 sandbox.ANALIZ={kart:()=>{throw new Error('x')}};assert.equal(a.merkezBul(student,'gidisat','SAY').tyt,null);

 // --- the lists ---
 const est=a.tahmin('SAY',72,63,undefined).puan,L=a.listele('SAY',est,{});
 assert.equal(L.yukari.length,24);assert.equal(L.asagi.length,24);
 assert(L.yukari.every(p=>a.yerlesir(p)&&p.points>est),'above: placeable and above the estimate');
 assert(L.asagi.every(p=>a.yerlesir(p)&&p.points<=est),'below: placeable and at or below the estimate');
 assert(L.yukari.every((p,i,l)=>!i||l[i-1].points>=p.points),'nearest last (descending towards the line)');
 assert(L.asagi.every((p,i,l)=>!i||l[i-1].points>=p.points),'highest first');
 {const all=catalogue.programs.filter(p=>p.field==='SAY'&&a.yerlesir(p)),ust=all.filter(p=>p.points>est).sort((x,y)=>x.points-y.points);
  assert.equal(L.yukari[L.yukari.length-1].points,ust[0].points,'the nearest above sits right above the line');assert.equal(L.yukari[0].points,ust[23].points);
  const alt=all.filter(p=>p.points<=est).sort((x,y)=>y.points-x.points);assert.equal(L.asagi[0].points,alt[0].points);assert.equal(L.yukariKalan,ust.length-24);assert.equal(L.asagiKalan,alt.length-24)}
 assert.equal(a.listele('SAY',est,{},48).yukari.length,48);
 assert(L.yukari.concat(L.asagi).every(p=>p.field==='SAY'));
 const noPuan=catalogue.programs.filter(p=>p.field==='SAY'&&!a.yerlesir(p));assert(noPuan.length>0);
 assert.equal(L.yok.length,0,'no search: unplaced programmes stay out');
 const q=noPuan[0].program.split(' ')[0],Q=a.listele('SAY',est,{query:q});
 assert(Q.yukari.concat(Q.asagi).every(p=>a.yerlesir(p)));assert(Q.yok.length>0&&Q.yok.every(p=>!a.yerlesir(p)));
 const Ci=a.listele('SAY',est,{city:'35',kind:'DEVLET'});assert(Ci.yukari.concat(Ci.asagi).every(p=>p.city===35&&p.type==='DEVLET'));
 assert.equal(a.listele('SAY',null,{}).yukari.length+a.listele('SAY',null,{}).asagi.length,0);

 // --- targets: choosing a programme leaves the net goals alone; the explicit button changes them ---
 const values={tr:30,sos:15,mat:25,fen:12,amat:20,fiz:9,kim:8,bio:7},program={id:'123456789',field:'SAY',city:34,type:'DEVLET',university:'Test Üniversitesi',program:'Test',nets:{coefficient:.12,values,obp:400,points:400},points:400,rank:5000};
 loaded.programs.push(program);
 const goals=a.netHedef(program);assert.equal(goals.TYT,82);assert.equal(goals.AYT,44);assert.equal(goals['TYT:matgeo'],25);assert.equal(goals['AYT:fen'],24);assert.equal(a.netHedef({...program,nets:{...program.nets,values:{...values,tr:-2}}})['TYT:turkce'],0);
 student.denemeHedef={TYT:60};
 // the target is the teacher's: a student session (or a read-only teacher) can neither set nor clear it
 sandbox.D.rol='ogrenci';await assert.rejects(a.hedefSec(program.id),/öğretmen/);await assert.rejects(a.netleriAyarla(),/öğretmen/);await assert.rejects(a.diplomaYaz(80),/öğretmen/);assert.equal(student.universiteHedef,undefined);sandbox.D.rol='rehber';
 const t1=student.ogrCalismaTs;await a.hedefSec(program.id);assert.equal(student.universiteHedef.id,program.id);same(student.denemeHedef,{TYT:60},'selecting a target must not touch denemeHedef');assert.equal(student.ogrCalismaTs,t1,'a teacher-owned target leaves the student work clock alone');
 confirmAnswer=false;assert.equal(await a.netleriAyarla(),false);same(student.denemeHedef,{TYT:60},'a declined confirm changes nothing');
 student.ogrCalismaTs=5;confirmAnswer=true;assert.equal(await a.netleriAyarla(),true);assert(student.ogrCalismaTs>5,'net goals edit advances the work clock');assert.equal(student.denemeHedef.TYT,82);assert.equal(student.denemeHedef['AYT:fen'],24);
 student.denemeHedef={TYT:60};const kaydetOnce=sandbox.kaydet;sandbox.kaydet=async()=>false;await assert.rejects(a.netleriAyarla());same(student.denemeHedef,{TYT:60});
 student.ogrCalismaTs=7;await a.hedefSec(null).catch(()=>{});assert.equal(student.universiteHedef.id,program.id,'a failed save rolls the target back');assert.equal(student.ogrCalismaTs,7);sandbox.kaydet=kaydetOnce;
 await a.hedefSec(null);assert.equal(student.universiteHedef,null);same(student.denemeHedef,{TYT:60});
 await assert.rejects(a.netleriAyarla(),/hesaplanam/);
 await a.hedefSec(program.id);
 sandbox.yalnizcaGoruntuleme=()=>true;await assert.rejects(a.hedefSec(program.id));await assert.rejects(a.netleriAyarla());sandbox.yalnizcaGoruntuleme=()=>false;
 await assert.rejects(a.hedefSec(program.id,{},student));await assert.rejects(a.hedefSec(program.id,sandbox.D,{}));
 const other=catalogue.programs.find(p=>p.field==='EA');await assert.rejects(a.hedefSec(other.id),/aynı olmalı/);
 // an old saved target (no diploma notu, nets already set) still validates
 a.hedefDogrula(student.universiteHedef);

 // --- diploma notu: teacher-owned, validated, rolled back ---
 {const ts=student.ogrCalismaTs;await a.diplomaYaz(87.456);assert.equal(student.diplomaNotu,87.46);assert.equal(student.ogrCalismaTs,ts,'teacher-owned diploma notu leaves the work clock alone');}
 await assert.rejects(a.diplomaYaz(49),/Diploma notu/);await assert.rejects(a.diplomaYaz(101));assert.equal(student.diplomaNotu,87.46);
 sandbox.kaydet=async()=>false;await assert.rejects(a.diplomaYaz(90));assert.equal(student.diplomaNotu,87.46);sandbox.kaydet=kaydetOnce;
 await a.diplomaYaz(null);assert.equal(student.diplomaNotu,null);
 sandbox.yalnizcaGoruntuleme=()=>true;await assert.rejects(a.diplomaYaz(80));sandbox.yalnizcaGoruntuleme=()=>false;
 sandbox.D.rol='';await assert.rejects(a.diplomaYaz(80));sandbox.D.rol='rehber';
 // the page itself is teacher-only
 sandbox.D.rol='ogrenci';assert.match(a.gorunum(),/yalnızca öğretmen/);sandbox.D.rol='rehber';
 console.log('PASS YÖK Atlas model, exams, Gidişat, lists, targets and diploma notu');
})().catch(e=>{console.error(e);process.exitCode=1});
