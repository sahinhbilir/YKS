// Public catalogue is fetched once per page session. Never attach it to D or a student packet.
const YOKATLAS = (() => {
'use strict';
const SUBJECTS = {
 tr:['Türkçe',40,'TYT:turkce',['turkce']],sos:['Sosyal Bilimler',20,'TYT:sosyal',['tarih','cografya','felsefe','din','sf']],
 mat:['Matematik',40,'TYT:matgeo',['mat','geo']],fen:['Fen Bilimleri',20,'TYT:fen',['fizik','kimya','biyoloji']],
 amat:['Matematik',40,'AYT:matgeo',['mat','geo']],fiz:['Fizik',14,'AYT:fizik',['fizik']],kim:['Kimya',13,'AYT:kimya',['kimya']],bio:['Biyoloji',13,'AYT:biyoloji',['biyoloji']],
 edb:['Edebiyat',24,'AYT:edebiyat',['edebiyat']],tar1:['Tarih-1',10,'AYT:tarih1',['tarih1']],cog1:['Coğrafya-1',6,'AYT:cografya1',['cografya1']],
 tar2:['Tarih-2',11,'AYT:tarih2',['tarih2']],cog2:['Coğrafya-2',11,'AYT:cografya2',['cografya2']],fel:['Felsefe',12,'AYT:felsefe',['felsefe']],din:['Din / Ek Felsefe',6,'AYT:din',['din','sf']]
};
const TYT=['tr','sos','mat','fen'], AYT={SAY:['amat','fiz','kim','bio'],EA:['amat','edb','tar1','cog1'],'SÖZ':['edb','tar1','cog1','tar2','cog2','fel','din']};
const CITIES={6:'Ankara',26:'Eskişehir',34:'İstanbul',35:'İzmir',41:'Kocaeli'};
let catalog=null,pending=null,error='',saving=false;
const SAYFA=24,DIPLOMA_VARSAYILAN=80;
const taze=(owner,student)=>({owner,student,field:AYT[student?.alan]?student.alan:'SAY',city:'',kind:'',query:'',merkez:'son',tyt:null,ayt:null,more:0});
let state=taze(null,null);
let modelOnbellek=null;
const num=v=>v===null||v===undefined?'—':Number(v).toLocaleString('tr-TR',{maximumFractionDigits:2});
const dec=(v,n)=>v===null||v===undefined||!Number.isFinite(v)?'—':Number(v).toLocaleString('tr-TR',{minimumFractionDigits:n,maximumFractionDigits:n});
const norm=s=>String(s||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
const sum=(v,keys)=>keys.reduce((n,k)=>n+v[k],0);
const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
function diplomaDogrula(n){
 if(n===undefined||n===null)return true;
 if(!finite(n,50,100))throw new Error('Diploma notu 50 ile 100 arasında olmalı.');
 return true;
}
function hedefDogrula(h){
 if(h===undefined||h===null)return true;
 if(!h||typeof h!=='object'||Array.isArray(h)||Object.keys(h).sort().join(',')!=='alan,id,surum,yil'||h.surum!==1||!/^\d{9}$/.test(h.id)||typeof h.id!=='string'||!Object.hasOwn(AYT,h.alan)||!Number.isInteger(h.yil)||h.yil<2020||h.yil>2100)throw new Error('Üniversite hedefi geçersiz.');
 return true;
}
function katalogDogrula(c){
 if(!c||c.schema!==1||!Number.isInteger(c.catalogYear)||!Number.isInteger(c.referenceYear)||c.referenceYear>c.catalogYear||c.referenceYear<c.catalogYear-3||!Array.isArray(c.programs)||!c.programs.length||c.programs.length>10000)throw new Error('Üniversite kataloğu geçersiz.');
 const seen=new Set();
 for(const p of c.programs){
  if(!p||typeof p.id!=='string'||!/^\d{9}$/.test(p.id)||seen.has(p.id)||!Object.hasOwn(AYT,p.field)||!Number.isInteger(p.city)||!Object.hasOwn(CITIES,p.city)||!['DEVLET','VAKIF'].includes(p.type)||p.type==='VAKIF'&&p.scholarship!==100||['university','program'].some(k=>typeof p[k]!=='string'||!p[k].trim()||p[k].length>250))throw new Error('Katalogda kapsam dışı veya geçersiz program var.');
  seen.add(p.id);
  if(p.nets!==null&&(!p.nets||p.nets.coefficient!==.12||[...TYT,...AYT[p.field]].some(k=>!finite(p.nets.values?.[k],-SUBJECTS[k][1]/4,SUBJECTS[k][1]))))throw new Error('Katalogda geçersiz net profili var.');
 }
 return c;
}
async function yukle(){
 if(catalog)return catalog;
 if(pending)return pending;
 error='';
 pending=(async()=>{
  // Same-origin public asset; no credentials, exam records or student identifiers are sent.
  const r=await fetch('data/yokatlas.json',{credentials:'omit',cache:'default'});
  if(!r.ok)throw new Error('Üniversite kataloğu yüklenemedi. İnternet bağlantısını kontrol edip yeniden deneyin.');
  const raw=await r.text();if(raw.length>5000000)throw new Error('Üniversite kataloğu boyut sınırını aşıyor.');
  catalog=katalogDogrula(JSON.parse(raw));return catalog;
 })().catch(e=>{error=e.message||'Katalog yüklenemedi.';throw e}).finally(()=>{pending=null});
 return pending;
}
/* ---------------- model: puan and başarı sırası from the catalogue ---------------- */
// Per alan, least squares over the programmes that have a net profile: puan ≈ a + b·TYT + c·AYT + d·OBP (totals of the last placed
// student; OBP is the diploma notu × 5). Nothing is stored: it is refitted from the catalogue once per page session.
function coz(rows,y){
 const n=rows[0].length,M=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>rows.reduce((s,r)=>s+r[i]*r[j],0)).concat(rows.reduce((s,r,k)=>s+r[i]*y[k],0)));
 for(let i=0;i<n;i++){
  let p=i;for(let r=i+1;r<n;r++)if(Math.abs(M[r][i])>Math.abs(M[p][i]))p=r;
  if(Math.abs(M[p][i])<1e-9)return null;
  [M[i],M[p]]=[M[p],M[i]];
  for(let r=0;r<n;r++)if(r!==i){const k=M[r][i]/M[i][i];for(let j=i;j<=n;j++)M[r][j]-=k*M[i][j]}
 }
 return M.map((r,i)=>r[n]/r[i]);
}
// Rank falls as puan rises: fit -log(rank) with a pool-adjacent-violators pass (monotone), then interpolate between the block means.
function siraEgrisi(ps){
 const by=new Map();
 for(const p of ps){const l=by.get(p.points)||[];l.push(Math.log(p.rank));by.set(p.points,l)}
 const bl=[];
 for(const [x,l] of [...by].sort((a,b)=>a[0]-b[0])){
  bl.push({sx:x*l.length,sy:-l.reduce((a,b)=>a+b,0),w:l.length});
  while(bl.length>1&&bl[bl.length-2].sy/bl[bl.length-2].w>bl[bl.length-1].sy/bl[bl.length-1].w){const b=bl.pop(),a=bl[bl.length-1];a.sx+=b.sx;a.sy+=b.sy;a.w+=b.w}
 }
 return bl.map(b=>[b.sx/b.w,b.sy/b.w]);
}
function modelKur(c){
 const out={};
 for(const f of Object.keys(AYT)){
  const ps=c.programs.filter(p=>p.field===f&&p.nets&&finite(p.nets.points,0,700)&&finite(p.nets.obp,0,500));
  const X=ps.map(p=>[1,sum(p.nets.values,TYT),sum(p.nets.values,AYT[f]),p.nets.obp]),y=ps.map(p=>p.nets.points),b=ps.length>=30?coz(X,y):null;
  const sr=c.programs.filter(p=>p.field===f&&finite(p.points,0,700)&&Number.isFinite(p.rank)&&p.rank>=1);
  out[f]=b?{n:ps.length,b,sd:Math.sqrt(X.reduce((s,r,k)=>s+(y[k]-r.reduce((a,v,i)=>a+v*b[i],0))**2,0)/(ps.length-4)),sira:sr.length?siraEgrisi(sr):[]}:null;
 }
 return out;
}
function modeller(){
 if(!catalog)return null;
 if(modelOnbellek?.c!==catalog)modelOnbellek={c:catalog,m:modelKur(catalog)};
 return modelOnbellek.m;
}
// puan → rank: monotone, clamped to the catalogue's best and worst taban rank.
function siraTahmin(m,puan){
 const k=m?.sira;if(!k?.length)return null;
 let y;
 if(puan<=k[0][0])y=k[0][1];
 else if(puan>=k[k.length-1][0])y=k[k.length-1][1];
 else{let i=1;while(k[i][0]<puan)i++;const [x0,y0]=k[i-1],[x1,y1]=k[i];y=y0+(y1-y0)*(puan-x0)/(x1-x0)}
 return Math.exp(-y);
}
function siraYaz(r){
 if(!Number.isFinite(r))return null;
 const step=r>=10000?500:r>=1000?100:r>=100?10:1;
 return Math.max(1,Math.round(r/step)*step);
}
function tahmin(alan,tyt,ayt,diploma){
 const m=modeller()?.[alan];if(!m||!Number.isFinite(tyt)||!Number.isFinite(ayt))return null;
 const girildi=finite(diploma,50,100),obp=(girildi?diploma:DIPLOMA_VARSAYILAN)*5;
 const puan=m.b[0]+m.b[1]*tyt+m.b[2]*ayt+m.b[3]*obp;
 return {puan,sd:m.sd,sira:siraTahmin(m,puan),obp,diplomaGirildi:girildi};
}

/* ---------------- the student's exams ---------------- */
const tarihYaz=t=>String(t||'').split('-').reverse().join('.');
// Every TYT or AYT record of the student, newest first. Nothing is hidden by exam kind (Tarama / Genel).
const satirlar=(oturum,si=EK.ogr)=>denemeListe(si).filter(r=>!r.silindi&&r.tur===oturum&&r.oturum===oturum).reverse();
const dersAdi=(oturum,kod)=>DENEME_DERSLER[oturum]?.find(x=>x[0]===kod)?.[1]||kod;
// Compare only complete, full-length test coverage. Missing lessons are not zero nets.
// Legacy imports omit question counts: use published TYT/AYT section maxima only when
// all component lessons are present. A combined mathematics column needs an explicit 40.
// values: the nets per test when usable; eksik: what is missing otherwise.
function kapsam(r,oturum,field){
 if(!r||r.silindi||r.tur!==oturum||r.oturum!==oturum||!Object.hasOwn(AYT,field))return {values:null,eksik:['deneme']};
 const keys=oturum==='TYT'?TYT:AYT[field],values={},eksik=[];
 for(const k of keys){
  const [label,max,,codes]=SUBJECTS[k];
  const ds=r.dersler.filter(d=>codes.includes(d.kod)&&denemeBolumSayilir(r,d.kod,field));
  const count=ds.reduce((n,d)=>n+(d.soru??DENEME_DERSLER[oturum].find(x=>x[0]===d.kod)?.[2]??0),0);
  const net=ds.reduce((n,d)=>n+denemeNet(d),0);
  if(count===max&&finite(net,-max/4,max)){values[k]=net;continue}
  const yok=codes.filter(c=>c!=='sf'&&!r.dersler.some(d=>d.kod===c)).map(c=>dersAdi(oturum,c));
  eksik.push(...(yok.length?yok:[label]));
 }
 return {values:eksik.length?null:values,eksik};
}
const profil=(r,oturum,field)=>kapsam(r,oturum,field).values;
const eksikYazi=l=>'eksik: '+l.slice(0,2).join(', ')+(l.length>2?' +'+(l.length-2):'');
function sinavSecenekleri(alan,si=EK.ogr){
 const yap=(ot)=>satirlar(ot,si).map(r=>{const k=kapsam(r,ot,alan);return {id:r.id,r,etiket:tarihYaz(r.tarih)+' · '+r.ad,uygun:!!k.values,values:k.values,eksik:k.eksik}});
 return {tyt:yap('TYT'),ayt:yap('AYT')};
}
const gidisatBellek=new WeakMap();
function gidisatNeti(student,key){
 try{
  const kaynak=typeof ANALIZ.kaynak==='function'?ANALIZ.kaynak():null;
  let m=kaynak&&typeof kaynak==='object'?gidisatBellek.get(kaynak):null;
  if(kaynak&&typeof kaynak==='object'&&!m){m=new Map();gidisatBellek.set(kaynak,m)}
  const mk=student.no+'|'+key+'|'+D.ayar?.sinav+'|'+D.ayar?.testTarih;
  if(m?.has(mk))return m.get(mk);
  const c=ANALIZ.kart(String(student.no),key);
  let s;
  if(!c||c.durum==='secim')s={neden:'sıralama listesinde yok'};
  else if(c.durum!=='tamam')s={neden:'sıralama verisi yok'};
  else if(c.oturum.key!==key)s={neden:'deneme yok'};
  else if(!c.gidisat||!c.gidisat.var)s={neden:'en az 3 deneme gerekli'};
  else if(!c.gidisat.yks)s={neden:'YKS tarihi yok'};
  else s={net:c.gidisat.yks.net,ad:'Gidişat'};
  m?.set(mk,s);return s;
 }catch(e){return {neden:'hesaplanamadı'}}
}
// The centre of the lists: the student's TYT and AYT net totals. kip: 'son' (the latest usable exam of each), 'sec' (picked exams;
// secim.tyt / secim.ayt, the latest usable when null) or 'gidisat' (the Öğrenci kartı projection at the YKS date).
function merkezBul(student,kip,alan,secim={},si=EK.ogr){
 if(kip==='gidisat'){
  const t=gidisatNeti(student,'TYT'),a=gidisatNeti(student,'AYT:'+alan);
  return {kip,tyt:t.net===undefined?null:{net:t.net,ad:'Gidişat'},ayt:a.net===undefined?null:{net:a.net,ad:'Gidişat'},tytNeden:t.neden||'',aytNeden:a.neden||''};
 }
 const s=sinavSecenekleri(alan,si);
 const bul=(l,id,ot)=>{
  if(!l.length)return {neden:ot+' denemesi yok'};
  // Nothing usable: say what the newest exam lacks.
  const x=kip==='sec'&&id?l.find(y=>y.id===id):l.find(y=>y.uygun)||l[0];
  if(!x)return {neden:'seçilen deneme bulunamadı'};
  if(!x.uygun)return {neden:eksikYazi(x.eksik)};
  return {x};
 };
 const t=bul(s.tyt,secim.tyt,'TYT'),a=bul(s.ayt,secim.ayt,'AYT');
 const yaz=(b,keys)=>b.x?{net:sum(b.x.values,keys),ad:b.x.r.ad,tarih:b.x.r.tarih,id:b.x.id}:null;
 return {kip,tyt:yaz(t,TYT),ayt:yaz(a,AYT[alan]),tytNeden:t.neden||'',aytNeden:a.neden||''};
}
// Which alan the centre can serve: the AYT must have that alan's tests.
function alanDurumlari(student,kip,secim={},si=EK.ogr){
 return Object.fromEntries(Object.keys(AYT).map(f=>{const m=merkezBul(student,kip,f,secim,si);return [f,{ok:!!m.ayt,neden:m.aytNeden}]}));
}

/* ---------------- the lists ---------------- */
const yerlesir=p=>!!p.nets&&finite(p.points,0,700);
const siraKarsilastir=(a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||a.university.localeCompare(b.university,'tr')||a.program.localeCompare(b.program,'tr')||a.id.localeCompare(b.id);
function suzgec(p,f){return (!f.city||p.city===+f.city)&&(!f.kind||p.type===f.kind)&&(!f.query||norm(p.university+' '+p.program+' '+p.group).includes(norm(f.query)))}
// yukari: the nearest programmes with taban puan above the estimate, the nearest last. asagi: the highest at or below it.
// yok: programmes the search finds that cannot be placed (no net profile or no puan).
function listele(alan,puan,f={},adet=SAYFA){
 const hepsi=catalog.programs.filter(p=>p.field===alan&&suzgec(p,f)),yer=hepsi.filter(yerlesir);
 const ust=Number.isFinite(puan)?yer.filter(p=>p.points>puan).sort((a,b)=>a.points-b.points||siraKarsilastir(a,b)):[];
 const alt=Number.isFinite(puan)?yer.filter(p=>p.points<=puan).sort((a,b)=>b.points-a.points||siraKarsilastir(a,b)):[];
 const yok=f.query?hepsi.filter(p=>!yerlesir(p)).sort(siraKarsilastir):[];
 return {yukari:ust.slice(0,adet).reverse(),asagi:alt.slice(0,adet),yukariKalan:Math.max(0,ust.length-adet),asagiKalan:Math.max(0,alt.length-adet),yok:yok.slice(0,adet),yokKalan:Math.max(0,yok.length-adet)};
}

/* ---------------- targets ---------------- */
function netHedef(p){
 if(!p.nets)return null;
 const v=p.nets.values,keys=[...TYT,...AYT[p.field]];
 // Existing goals accept nonnegative nets. Clamp each subject before deriving totals.
 const g=Object.fromEntries(keys.map(k=>[k,Math.max(0,v[k])]));
 const h=Object.fromEntries(keys.map(k=>[SUBJECTS[k][2],g[k]]));
 h.TYT=sum(g,TYT);h.AYT=sum(g,AYT[p.field]);
 if(p.field==='SAY')h['AYT:fen']=g.fiz+g.kim+g.bio;
 if(p.field!=='SAY')h['AYT:edsos1']=g.edb+g.tar1+g.cog1;
 if(p.field==='SÖZ')h['AYT:sosyal2']=g.tar2+g.cog2+g.fel+g.din;
 return h;
}
const ogretmenIslemi=(owner,student)=>!saving&&D===owner&&D.ogr[EK.ogr]===student&&rehberMi()&&!yalnizcaGoruntuleme()&&ogrenciSinavi(student)==='YKS';
// Choosing a programme never touches the net goals (denemeHedef); netleriAyarla does, on an explicit request.
async function hedefSec(id,owner=D,student=D.ogr[EK.ogr]){
 if(!ogretmenIslemi(owner,student))throw new Error('Üniversite hedefini yalnızca öğretmen belirleyebilir.');
 const p=id===null?null:catalog?.programs.find(x=>x.id===id);
 if(id!==null&&(!p||p.field!==student.alan))throw new Error('Hedef program öğrencinin alanıyla aynı olmalı.');
 const old=student.universiteHedef;
 const next=p?{surum:1,id:p.id,yil:catalog.referenceYear,alan:p.field}:null;
 hedefDogrula(next);saving=true;
 // Teacher-owned: student packets no longer carry it, so the student's work clock is left alone.
 student.universiteHedef=next;
 try{if(!await kaydet(true))throw new Error('Hedef kaydedilemedi. Yeniden deneyin.');}
 catch(e){if(student.universiteHedef===next){if(old===undefined)delete student.universiteHedef;else student.universiteHedef=old}throw e}
 finally{saving=false}
}
async function netleriAyarla(owner=D,student=D.ogr[EK.ogr]){
 if(!ogretmenIslemi(owner,student))throw new Error('Net hedeflerini yalnızca öğretmen ayarlayabilir.');
 const p=catalog?.programs.find(x=>x.id===student.universiteHedef?.id),goals=p&&p.field===student.alan?netHedef(p):null;
 if(!goals)throw new Error('Bu program için net hedefi hesaplanamıyor.');
 if(!confirm('Öğrencinin net hedefleri “'+p.program+'” son yerleşen profiline göre değişecek. Mevcut net hedeflerin silinir. Devam edilsin mi?'))return false;
 const oldNets=student.denemeHedef,oldTs=student.ogrCalismaTs;saving=true;student.denemeHedef=goals;student.ogrCalismaTs=Date.now();
 try{if(!await kaydet(true))throw new Error('Net hedefleri kaydedilemedi. Yeniden deneyin.');return true}
 catch(e){if(student.denemeHedef===goals){if(oldNets===undefined)delete student.denemeHedef;else student.denemeHedef=oldNets;if(oldTs===undefined)delete student.ogrCalismaTs;else student.ogrCalismaTs=oldTs}throw e}
 finally{saving=false}
}
// Diploma notu: teacher-owned. null clears it (a tombstone the sync understands).
async function diplomaYaz(deger,owner=D,student=D.ogr[EK.ogr]){
 if(saving||D!==owner||D.ogr[EK.ogr]!==student||yalnizcaGoruntuleme()||!rehberMi())throw new Error('Diploma notu yalnızca öğretmen tarafından değiştirilebilir.');
 const n=deger===null?null:Math.round(Number(deger)*100)/100;
 diplomaDogrula(n);
 const old=student.diplomaNotu;
 student.diplomaNotu=n;saving=true;
 try{if(!await kaydet(true))throw new Error('Diploma notu kaydedilemedi. Yeniden deneyin.');}
 catch(e){if(student.diplomaNotu===n){if(old===undefined)delete student.diplomaNotu;else student.diplomaNotu=old}throw e}
 finally{saving=false}
}

/* ---------------- view ---------------- */
function prepare(){
 const student=D.ogr[EK.ogr];
 if(state.owner!==D||state.student!==student)state=taze(D,student);
 return student;
}
const opt=(v,label,selected,disabled)=>'<option value="'+kacis(String(v))+'"'+(String(v)===String(selected)?' selected':'')+(disabled?' disabled':'')+'>'+kacis(label)+'</option>';
function satirHtml(p,{puan=null,secili=false,izinli=false,baslik=''}={}){
 const yer=yerlesir(p),tyt=p.nets?sum(p.nets.values,TYT):null,ayt=p.nets?sum(p.nets.values,AYT[p.field]):null;
 const fark=yer&&Number.isFinite(puan)&&p.points>puan?'<small class="ya-fark">+'+dec(p.points-puan,1)+' puan</small>':'';
 const eylem=(izinli&&!secili?'<button class="dugme ya-sec" data-ya-target="'+kacis(p.id)+'"'+(saving?' disabled':'')+'>Hedef olarak seç</button>':secili?'<span class="ya-etiket">Hedef</span>':'')+
  '<a href="https://yokatlas.yok.gov.tr/detay/'+kacis(p.id)+'" target="_blank" rel="noopener noreferrer">YÖK Atlas ↗</a>';
 return '<article class="ya-row'+(secili?' ya-secili':'')+(yer?'':' ya-yok')+'" data-ya-id="'+kacis(p.id)+'">'+
  '<h3 class="ya-prog">'+kacis(p.program)+'</h3><div class="ya-uni">'+kacis(p.university)+' <span>('+kacis(CITIES[p.city])+')</span></div>'+
  '<div class="ya-h ya-puan" data-l="Taban puan">'+(p.points!==null&&p.points!==undefined?'<b>'+dec(p.points,2)+'</b>':'<b class="ya-soluk">puan verisi yok</b>')+fark+'</div>'+
  '<div class="ya-h ya-sira" data-l="Başarı sırası">'+num(p.rank)+'</div><div class="ya-h ya-tyt" data-l="TYT net">'+num(tyt)+'</div><div class="ya-h ya-ayt" data-l="AYT net">'+num(ayt)+'</div><div class="ya-h ya-obp" data-l="OBP">'+num(p.nets?.obp)+'</div>'+
  '<div class="ya-eylem">'+eylem+'</div></article>';
}
const baslikHtml='<div class="ya-baslik" aria-hidden="true"><span>Bölüm</span><span>Üniversite</span><span>Taban puan</span><span>Başarı sırası</span><span>TYT net</span><span>AYT net</span><span>OBP</span></div>';
function content(){
 const o=prepare();
 if(!rehberMi())return '<h1>Üniversite hedefi</h1><p>Bu bölüm yalnızca öğretmen içindir.</p>';
 if(!o)return '<h1>Üniversite hedefi</h1><p>Öğrenci seçin.</p>';
 if(ogrenciSinavi(o)!=='YKS')return '<h1>Üniversite hedefi</h1><p>Bu bölüm YKS öğrencileri içindir.</p>';
 const chooser='<label class="ya-student">Öğrenci<select id="yaStudent">'+canliOgrenciler().map(i=>opt(i,D.ogr[i].ad+' · '+(D.ogr[i].sube||''),EK.ogr)).join('')+'</select></label>';
 const head='<div class="ya-heading"><h1>Üniversite hedefi</h1>'+chooser+'</div>';
 if(!catalog){if(!pending&&!error)void yukle().then(draw,draw);return head+'<p role="status">'+(error?kacis(error):'YÖK Atlas kataloğu yükleniyor…')+'</p>'+(error?'<button class="dugme" data-ya-retry>Yeniden dene</button>':'')}
 const secim={tyt:state.tyt,ayt:state.ayt},alan=state.field;
 const mk=merkezBul(o,state.merkez,alan,secim),durum=alanDurumlari(o,state.merkez,secim);
 const gid=merkezBul(o,'gidisat',alan),gidAlan=state.merkez==='gidisat'?durum:alanDurumlari(o,'gidisat');
 const gidOk=!!gid.tyt&&Object.values(gidAlan).some(x=>x.ok),gidNeden=gid.tytNeden||Object.values(gidAlan).find(x=>x.neden)?.neden||'';
 const est=mk.tyt&&mk.ayt?tahmin(alan,mk.tyt.net,mk.ayt.net,o.diplomaNotu):null;
 const secenek=sinavSecenekleri(alan);
 const sinavSec=(l,id,ot)=>{const secili=id||(l.find(x=>x.uygun)?.id??'');return '<label>'+ot+' denemesi<select id="ya'+ot+'"'+(l.length?'':' disabled')+'>'+(secili?'':opt('',l.length?'Kullanılabilir deneme yok':'Deneme yok','',false))+l.map(x=>opt(x.id,x.etiket+(x.uygun?'':' · '+eksikYazi(x.eksik)),secili,!x.uygun)).join('')+'</select></label>'};
 const sinavlar=state.merkez==='sec'?sinavSec(secenek.tyt,state.tyt,'TYT')+sinavSec(secenek.ayt,state.ayt,'AYT'):'';
 const duzenle=!yalnizcaGoruntuleme();
 const panel='<section class="ya-panel"><div class="ya-ayar"><label>Merkez<select id="yaMerkez">'+opt('son','Son deneme',state.merkez)+opt('sec','Önceki deneme seç',state.merkez)+opt('gidisat','Gidişat (YKS günü)'+(gidOk?'':' · '+gidNeden),state.merkez,!gidOk&&state.merkez!=='gidisat')+'</select></label>'+sinavlar+
  '<label>Alan<select id="yaField">'+Object.keys(AYT).map(a=>opt(a,a+(durum[a].ok?'':' · '+durum[a].neden),alan,!durum[a].ok&&a!==alan)).join('')+'</select></label>'+
  '<label>Diploma notu<input id="yaDiploma" type="number" min="50" max="100" step="0.01" inputmode="decimal" placeholder="80"'+(o.diplomaNotu!==undefined&&o.diplomaNotu!==null?' value="'+kacis(String(o.diplomaNotu))+'"':'')+(duzenle?'':' disabled')+'></label></div>'+
  '<p class="ya-tahmin" aria-live="polite">'+(est?'Tahmini '+alan+' puanın ≈ <strong>'+dec(est.puan,1)+'</strong> ± '+dec(est.sd,1)+' puan · başarı sırası ≈ <strong>'+(est.sira===null?'—':num(siraYaz(est.sira)))+'</strong>'+(est.diplomaGirildi?'':' <span class="ya-soluk">(diploma notu girilmedi, '+DIPLOMA_VARSAYILAN+' sayıldı)</span>')
   :'Puan tahmini yok'+(mk.tytNeden||mk.aytNeden?' · '+kacis([mk.tytNeden&&'TYT: '+mk.tytNeden,mk.aytNeden&&'AYT: '+mk.aytNeden].filter(Boolean).join(' · ')):''))+'</p>'+
  (est?'<p class="ya-soluk ya-kaynak-net">TYT '+num(mk.tyt.net)+' net'+(mk.tyt.tarih?' · '+kacis(tarihYaz(mk.tyt.tarih)):'')+' · AYT '+num(mk.ayt.net)+' net'+(mk.ayt.tarih?' · '+kacis(tarihYaz(mk.ayt.tarih)):'')+'</p>':'')+'</section>';
 const filtre={city:state.city,kind:state.kind,query:state.query};
 const filters='<div class="ya-filters"><label>Şehir<select id="yaCity">'+opt('','Tüm şehirler',state.city)+Object.entries(CITIES).map(([k,l])=>opt(k,l,state.city)).join('')+'</select></label><label>Üniversite türü<select id="yaType">'+opt('','Tümü',state.kind)+opt('DEVLET','Devlet',state.kind)+opt('VAKIF','%100 burslu vakıf',state.kind)+'</select></label><label class="ya-search">Üniversite / bölüm ara<input id="yaSearch" type="search" maxlength="120" value="'+kacis(state.query)+'" placeholder="Örn. bilgisayar mühendisliği"></label></div>';
 const izinli=!yalnizcaGoruntuleme();
 const secili=catalog.programs.find(p=>p.id===o.universiteHedef?.id);
 let pin='';
 if(o.universiteHedef){
  let fark='';
  if(secili){
   const e=secili.field===alan?est:(()=>{const m=merkezBul(o,state.merkez,secili.field,secim);return m.tyt&&m.ayt?tahmin(secili.field,m.tyt.net,m.ayt.net,o.diplomaNotu):null})();
   fark=!yerlesir(secili)?'puan verisi yok':!e?'':secili.points>e.puan?'Hedefe +'+dec(secili.points-e.puan,1)+' puan':'hedefin üstünde';
  }
  const netBtn=izinli&&secili?.nets&&secili.field===o.alan?'<button class="dugme" data-ya-netler'+(saving?' disabled':'')+'>Net hedeflerini bu programa göre ayarla</button>':'';
  pin='<section class="ya-hedef"><div class="ya-heading"><h2>Hedef'+(o.universiteHedef.yil!==catalog.referenceYear?' · '+o.universiteHedef.yil:'')+'</h2>'+(fark?'<strong class="ya-hedef-fark">'+kacis(fark)+'</strong>':'')+'</div>'+
   (secili?baslikHtml+satirHtml(secili,{puan:est?.puan??null,secili:true}):'<p>Seçilen program ('+kacis(o.universiteHedef.id)+') güncel katalogda yok.</p>')+
   '<div class="ya-actions">'+netBtn+(izinli?'<button class="dugme" data-ya-clear>Hedefi kaldır</button>':'')+'</div></section>';
 }
 const L=listele(alan,est?.puan,filtre,SAYFA*(state.more+1));
 const rows=(l,opts)=>l.map(p=>satirHtml(p,{...opts,izinli:izinli&&p.field===o.alan,secili:p.id===o.universiteHedef?.id})).join('');
 const daha=(n)=>n>0?'<button class="dugme ya-daha" data-ya-more>Daha fazla</button>':'';
 const bos='<p class="ya-soluk">Bu filtrelerle bölüm yok.</p>';
 const listeler=est?
  '<section class="ya-liste"><div class="ya-heading"><h2>Yükselirsen</h2></div>'+daha(L.yukariKalan)+baslikHtml+(L.yukari.length?rows(L.yukari,{puan:est.puan}):bos)+'</section>'+
  '<div class="ya-cizgi" role="separator"><span>'+(mk.kip==='gidisat'?'YKS günü: ':'')+'TYT netin: '+num(mk.tyt.net)+' · AYT netin: '+num(mk.ayt.net)+'</span><strong>≈ '+dec(est.puan,1)+' puan</strong></div>'+
  '<section class="ya-liste"><div class="ya-heading"><h2>Düşersen / şu an</h2></div>'+baslikHtml+(L.asagi.length?rows(L.asagi,{puan:est.puan}):bos)+daha(L.asagiKalan)+'</section>':'';
 const yokListe=L.yok.length?'<section class="ya-liste"><div class="ya-heading"><h2>Puan verisi yok</h2></div>'+rows(L.yok,{})+(L.yokKalan?'<button class="dugme ya-daha" data-ya-more>Daha fazla</button>':'')+'</section>':'';
 return head+panel+pin+filters+listeler+yokListe+'<p class="ya-kaynak">YÖK Atlas · '+catalog.referenceYear+' yerleşme verisi</p><p id="yaStatus" role="status"></p>';
}
function draw(){if(EK.sekme==='universite'&&document.getElementById('yaKok'))document.getElementById('yaKok').innerHTML=content()}
function gorunum(){return '<div id="yaKok">'+content()+'</div>'}
document.addEventListener('change',async e=>{
 if(!e.target.closest?.('#yaKok'))return;
 const id=e.target.id,v=e.target.value;
 if(id==='yaStudent'){EK.ogr=+v;draw();return}
 if(id==='yaDiploma'){
  const owner=D,student=D.ogr[EK.ogr],t=e.target,ham=String(v).replace(',','.').trim();
  try{await diplomaYaz(ham===''?null:Number(ham),owner,student);if(D!==owner||D.ogr[EK.ogr]!==student)return;draw();const s=document.getElementById('yaStatus');if(s)s.textContent='Diploma notu kaydedildi.'}
  catch(err){if(D!==owner||D.ogr[EK.ogr]!==student)return;draw();const s=document.getElementById('yaStatus');if(s)s.textContent=err.message}
  return;
 }
 const map={yaField:'field',yaCity:'city',yaType:'kind',yaMerkez:'merkez',yaTYT:'tyt',yaAYT:'ayt'};
 if(!map[id])return;
 state[map[id]]=id==='yaTYT'||id==='yaAYT'?(v||null):v;state.more=0;
 if(id==='yaMerkez'){state.tyt=null;state.ayt=null}
 draw();
});
document.addEventListener('input',e=>{
 if(e.target.id!=='yaSearch'||!e.target.closest?.('#yaKok'))return;
 const pos=e.target.selectionStart;state.query=e.target.value.slice(0,120);state.more=0;draw();const box=document.getElementById('yaSearch');box?.focus();if(pos!==null)box?.setSelectionRange(pos,pos);
});
document.addEventListener('click',async e=>{
 const b=e.target.closest?.('#yaKok button');if(!b)return;
 if(b.hasAttribute('data-ya-retry')){error='';draw();return}
 if(b.hasAttribute('data-ya-more')){state.more++;draw();return}
 const sec=b.hasAttribute('data-ya-target'),temizle=b.hasAttribute('data-ya-clear'),net=b.hasAttribute('data-ya-netler');
 if(!sec&&!temizle&&!net)return;
 const owner=D,student=D.ogr[EK.ogr];b.disabled=true;
 const durum=m=>{const s=document.getElementById('yaStatus');if(s)s.textContent=m};
 try{
  if(net){const ok=await netleriAyarla(owner,student);if(D!==owner||D.ogr[EK.ogr]!==student)return;draw();durum(ok?'Net hedefleri güncellendi.':'');if(!ok)b.disabled=false;return}
  await hedefSec(temizle?null:b.dataset.yaTarget,owner,student);if(D!==owner||D.ogr[EK.ogr]!==student)return;draw();durum(student.universiteHedef?'Hedef kaydedildi.':'Hedef kaldırıldı.');
 }
 catch(err){if(D!==owner||D.ogr[EK.ogr]!==student)return;durum(err.message);b.disabled=false}
});
return {gorunum,yukle,profil,kapsam,sinavSecenekleri,merkezBul,alanDurumlari,modelKur,tahmin,siraTahmin,siraYaz,listele,yerlesir,netHedef,hedefSec,netleriAyarla,diplomaYaz,diplomaDogrula,hedefDogrula,katalogDogrula};
})();
function gorunumUniversite(){return YOKATLAS.gorunum()}
