// Embedded in index.html by scripts/embed-etutplani.cjs. No student or teacher data belongs here.
// Etüt planı (teacher only): the school's "<GÜN> — ETÜT PLANI" sheets, laid out as in the school's
// Excel file. The teacher keeps each weekday's teachers (branş, öğretmen), writes up to four students
// beside each and prints the sheets landscape, two days to a page. Sınıf dağıtımı turns the weekdays
// into dated sheets for a few weeks and writes a class (not 12th grade) in each teacher's Öğrenci 1,
// rotating per subject so every class gets every subject; with the classes' timetables (Ders
// programları, read from the school's PDFs) each class's etüts go to its own teachers, more for the
// lessons with more weekly hours. Kept in the teacher notebook as
// D.etutPlani, so it travels with the teacher's cloud backup; student packets are built from a field
// whitelist and never carry it. Nothing is uploaded. See docs/etut-plani.md.
const ETUTPLANI = (() => {
const SURUM=1, GUNLER=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma'], KISA=['Pzt','Sal','Çar','Per','Cum'], OGRENCI=4, EN_COK_SATIR=40;
const AYLAR=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const EN_COK_SINIF=60, EN_COK_DONEM=70, EN_COK_PROGRAM=40;
const PROGRAM_GUNLER=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
// Days without etüts that the school's holidays (Ayarlar) do not list: national holidays on school
// days, and the afternoon off before Cumhuriyet Bayramı (etüts are after lessons).
const RESMI_YOK=['2026-10-28','2026-10-29','2027-01-01','2027-04-23'];
// The paper's order; other branches follow in the order they were first written.
const BRANS_SIRA=['Matematik','Geometri','Türkçe','Edebiyat','Fizik','Kimya','Biyoloji','Tarih','Coğrafya','Felsefe','Din Kültürü','İngilizce'];
const anahtar=s=>denemeAdAnahtari(s);
const kisa=(s,n)=>String(s==null?'':s).replace(/\s+/g,' ').trim().slice(0,n);
const buyuk=s=>String(s||'').toLocaleUpperCase('tr-TR');
const izleme=()=>typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme();
const sayi=n=>Number(n).toLocaleString('tr-TR');

/* ---------------- notebook storage ---------------- */
// D.etutPlani = {surum, ts, gunler:[Pazartesi … Cuma: [[branş, öğretmen, [öğrenci 1 … 4]]]],
//   donem?:{bas, bit, siniflar:['9/A', …], yok:[iso günler]},
//   programlar?:{'11/A':{kod, ts, saatler:['09.00', …], dersler:[[gün 0–6, saat, ders, öğretmen]]}}}.
// Rows keep the order they were written in; the sheet groups them by branş. donem is the Sınıf
// dağıtımı (see dagit), programlar the classes' timetables (see programCoz).
const bos=()=>({surum:SURUM,ts:0,gunler:GUNLER.map(()=>[])});
const yeniSatir=(b='',o='')=>[b,o,Array(OGRENCI).fill('')];
function dogrula(v){
  const hata=m=>{throw new Error('Kayıtlı etüt planı okunamadı ('+m+').')};
  const metin=(x,n)=>typeof x==='string'&&x.length<=n;
  if(!v||typeof v!=='object'||Array.isArray(v)||v.surum!==SURUM||!Number.isSafeInteger(v.ts)||v.ts<0)hata('yapı');
  if(!Array.isArray(v.gunler)||v.gunler.length!==GUNLER.length)hata('günler');
  for(const g of v.gunler){
    if(!Array.isArray(g)||g.length>EN_COK_SATIR)hata('gün');
    for(const s of g)if(!Array.isArray(s)||s.length!==3||!metin(s[0],40)||!metin(s[1],60)||!Array.isArray(s[2])||s[2].length!==OGRENCI||!s[2].every(x=>metin(x,60)))hata('satır');
  }
  if(v.donem!==undefined){const d=v.donem,iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&isoTarihGecerli(x);
    if(!d||typeof d!=='object'||Array.isArray(d)||!iso(d.bas)||!iso(d.bit)||d.bas>d.bit||gunNo(d.bit)-gunNo(d.bas)>EN_COK_DONEM||
      !Array.isArray(d.siniflar)||!d.siniflar.length||d.siniflar.length>EN_COK_SINIF||!d.siniflar.every(x=>metin(x,12)&&x)||!Array.isArray(d.yok)||d.yok.length>EN_COK_DONEM||!d.yok.every(iso))hata('sınıf dağıtımı')}
  if(v.programlar!==undefined){const P=v.programlar;if(!P||typeof P!=='object'||Array.isArray(P)||Object.keys(P).length>EN_COK_PROGRAM)hata('ders programları');
    for(const [c,x] of Object.entries(P))if(sinifYaz(c)!==c||!x||typeof x!=='object'||Array.isArray(x)||!metin(x.kod,8)||!Number.isSafeInteger(x.ts)||x.ts<0||
      !Array.isArray(x.saatler)||x.saatler.length>16||!x.saatler.every(t=>metin(t,5)&&t)||!Array.isArray(x.dersler)||x.dersler.length>120||
      !x.dersler.every(d=>Array.isArray(d)&&d.length===4&&Number.isInteger(d[0])&&d[0]>=0&&d[0]<7&&x.saatler.includes(d[1])&&metin(d[2],80)&&d[2]&&metin(d[3],80)))hata('ders programı')}
  return v;
}
function oku(){
  if(D.etutPlani===undefined)return {plan:bos()};
  try{return {plan:dogrula(JSON.parse(JSON.stringify(D.etutPlani)))}}catch(e){return {plan:null,hata:e.message}}
}
// Every change goes through here: a copy is changed, checked and saved; a save that fails puts the
// previous plan back, so the page never shows what the notebook does not hold.
async function degistir(fn){
  if(!rehberMi()||izleme())throw new Error('Yalnızca rehber öğretmen değiştirebilir.');
  const {plan,hata}=oku();if(hata)throw new Error(hata);
  const sonuc=fn(plan);
  plan.ts=Math.max(Date.now(),plan.ts+1);dogrula(plan);
  const eski=D.etutPlani,defter=D,geri=()=>{if(defter.etutPlani!==plan)return;if(eski===undefined)delete defter.etutPlani;else defter.etutPlani=eski};
  D.etutPlani=plan;
  if(baytBoyu(JSON.stringify(D))>BULUT_YEDEK_UST_SINIR&&baytBoyu(JSON.stringify(plan))>(eski===undefined?0:baytBoyu(JSON.stringify(eski)))){geri();throw new Error('Defter bulut yedeği sınırında; plan kaydedilmedi.')}
  if(!await kaydet(true)){geri();throw new Error('Cihaza kaydedilemedi; plan değişmedi.')}
  return sonuc;
}

/* ---------------- sheet model ---------------- */
// Rows of one branş sit together (the branş written on the first), in the paper's subject order.
const bransSirasi=k=>{if(!k)return 1e6;const i=BRANS_SIRA.findIndex(b=>anahtar(b)===k);return i<0?1000:i};
function gruplar(satirlar){
  const m=new Map();
  satirlar.forEach((s,i)=>{const k=anahtar(s[0]);if(!m.has(k))m.set(k,{brans:s[0],k,ilk:i,satir:[]});m.get(k).satir.push(i)});
  return [...m.values()].sort((a,b)=>bransSirasi(a.k)-bransSirasi(b.k)||a.ilk-b.ilk);
}
// A student written twice on one day is marked on both cells (ilk: the first student column to check).
function ciftler(satirlar,ilk=0){
  const n=new Map();for(const s of satirlar)for(const a of s[2].slice(ilk)){const k=anahtar(a);if(k)n.set(k,(n.get(k)||0)+1)}
  return new Set([...n].filter(([,c])=>c>1).map(([k])=>k));
}

/* ---------------- Sınıf dağıtımı ---------------- */
// For the dates bas … bit (school days, less the school's holidays and the yok days) each weekday's
// teachers are copied, and every teacher's Öğrenci 1 gets a class. Per subject the classes take turns
// in date and sheet order, each subject starting one class further on, so with as many places as
// classes every class has an etüt in every subject. 12th grade classes are never written.
const sinifYaz=c=>{const m=/^(\d{1,2})\s*[\/\-. ]?\s*([A-Za-zÇĞİÖŞÜçğıöşü]{1,3})$/u.exec(String(c||'').trim());return m&&+m[1]>=5&&+m[1]<=12?+m[1]+'/'+buyuk(m[2]):null};
const sinifSirala=(a,b)=>parseInt(a,10)-parseInt(b,10)||a.localeCompare(b,'tr');
// The classes with a timetable, else those of the etüt report and of the notebook's students; never
// the 12th grade.
function sinifOnerisi(){
  const {plan}=oku(),P=Object.keys((plan&&plan.programlar)||{}).filter(c=>parseInt(c,10)!==12);if(P.length)return P.sort(sinifSirala);
  const r=rapor(),l=(r?r.ogrenciler.map(o=>o.sinif):[]).concat((D.ogr||[]).filter(o=>o&&!o.silindi).map(o=>o.sube));
  return [...new Set(l.map(sinifYaz).filter(c=>c&&parseInt(c,10)!==12))].sort(sinifSirala);
}
// From tomorrow (Monday after a weekend) to the Friday of the week after next.
function varsayilanDonem(){
  let g=bugunNo()+1;while(haftaGunu(g)>4)g++;
  const bas=isoDan(g),bit=isoDan(pazartesi(g)+18);
  return {bas,bit,siniflar:sinifOnerisi(),yok:RESMI_YOK.filter(t=>t>=bas&&t<=bit)};
}
function dagit(p){
  const d=p&&p.donem;if(!d)return null;
  const tatil=typeof tatilGunleri==='function'?tatilGunleri():new Set(),yok=new Set(d.yok.map(gunNo)),gunler=[];
  for(let g=gunNo(d.bas);g<=gunNo(d.bit);g++){const w=haftaGunu(g);if(w<GUNLER.length&&!tatil.has(g)&&!yok.has(g))gunler.push({g,w})}
  if(d.siniflar.some(c=>p.programlar&&p.programlar[c]))return programDagit(p,gunler,d.siniflar);
  const dersler=new Map();
  for(const {g,w} of gunler)for(const grup of gruplar(p.gunler[w]))for(const i of grup.satir){
    if(!grup.k||!p.gunler[w][i][1])continue;if(!dersler.has(grup.k))dersler.set(grup.k,{brans:grup.brans,k:grup.k,yer:[]});dersler.get(grup.k).yer.push(g+':'+i)}
  const siniflar=d.siniflar,n=siniflar.length,sinif=new Map(),kapsam=[];
  [...dersler.values()].sort((a,b)=>bransSirasi(a.k)-bransSirasi(b.k)||a.brans.localeCompare(b.brans,'tr')).forEach((o,j)=>{
    const alan=new Set();o.yer.forEach((y,t)=>{const c=siniflar[(j+t)%n];sinif.set(y,c);alan.add(c)});
    kapsam.push({brans:o.brans,yer:o.yer.length,eksik:siniflar.filter(c=>!alan.has(c))})});
  return {gunler,sinif,kapsam,siniflar,mod:'sira'};
}

/* ---------------- Ders programları ---------------- */
// A class's "<kod> <sınıf> Haftalık Ders Programı" PDF: days across, lesson times down, in each cell
// the lesson in bold (the header's font) and the teacher in plain type, both wrapping. Items are
// pdf.js text runs {s,x,y,w,z,f} (y from the page bottom, f the font). A cell's lines sit a line
// apart; a bold line after a plain one starts the next cell; a cell's row is the time nearest its
// middle.
function programCoz(sayfalar){
  const it=(sayfalar[0]||[]).filter(i=>i&&typeof i.s==='string'&&i.s.trim()&&Number.isFinite(i.x)&&Number.isFinite(i.y)).map(i=>({...i,s:i.s.trim().replace(/\s+/g,' '),w:Number.isFinite(i.w)?i.w:0}));
  const ad=it.map(i=>/(?:(\d{1,4})\s+)?(\d{1,2})\s*\/\s*([A-Za-zÇĞİÖŞÜçğıöşü]{1,3})\s+Haftalık Ders Programı/u.exec(i.s)).find(Boolean),sinif=ad&&sinifYaz(ad[2]+'/'+ad[3]);
  if(!sinif)throw new Error('Bu PDF bir sınıfın “Haftalık Ders Programı” gibi görünmüyor.');
  const gun=PROGRAM_GUNLER.map((g,k)=>{const i=it.find(x=>x.s===g);return i?{k,x:i.x+i.w/2,y:i.y,f:i.f}:null}).filter(Boolean);
  if(gun.length<5)throw new Error(sinif+': gün başlıkları bulunamadı.');
  const kalin=gun[0].f,ust=Math.min(...gun.map(g=>g.y)),sol=Math.min(...gun.map(g=>g.x))-40;
  const saat=[];for(const t of it.filter(i=>/^\d{1,2}[.:]\d{2}$/.test(i.s)&&i.x<sol&&i.y<ust).sort((a,b)=>b.y-a.y||a.x-b.x)){
    const r=saat.find(x=>Math.abs(x.y-t.y)<3);if(!r)saat.push({y:t.y,x:t.x,bas:t.s.replace(':','.').padStart(5,'0')});else if(t.x<r.x){r.x=t.x;r.bas=t.s.replace(':','.').padStart(5,'0')}}
  if(!saat.length)throw new Error(sinif+': ders saatleri bulunamadı.');
  const alt=Math.min(...saat.map(r=>r.y))-30,hucre=it.filter(i=>i.y<ust-4&&i.y>alt&&i.x+i.w/2>sol+20),dersler=[];
  const sutun=i=>{const c=i.x+i.w/2;return gun.reduce((m,g)=>Math.abs(g.x-c)<Math.abs(m.x-c)?g:m,gun[0]).k};
  for(const g of gun){
    const bloklar=[];
    for(const i of hucre.filter(x=>sutun(x)===g.k).sort((a,b)=>b.y-a.y||a.x-b.x)){
      const b=bloklar[bloklar.length-1],son=b&&b.l[b.l.length-1];
      if(b&&b.alt-i.y<(i.z||7)*1.7&&!(i.f===kalin&&son.f!==kalin)){b.l.push(i);b.alt=i.y}else bloklar.push({ust:i.y,alt:i.y,l:[i]})}
    for(const b of bloklar){const orta=(b.ust+b.alt)/2,r=saat.reduce((m,x)=>Math.abs(x.y-orta)<Math.abs(m.y-orta)?x:m,saat[0]);
      const ders=kisa(b.l.filter(i=>i.f===kalin).map(i=>i.s).join(' '),80),hoca=kisa(b.l.filter(i=>i.f!==kalin).map(i=>i.s).join(' '),80);
      if(ders&&!dersler.some(x=>x[0]===g.k&&x[1]===r.bas))dersler.push([g.k,r.bas,ders,hoca])}
  }
  if(!dersler.length)throw new Error(sinif+': ders bulunamadı.');
  return {sinif,kod:kisa(ad[1]||'',8),saatler:saat.map(r=>r.bas),dersler:dersler.sort((a,b)=>a[0]-b[0]||a[1].localeCompare(b[1]))};
}
// A lesson's branş on the etüt sheet (Matematik TYT is Matematik, Türk Dili ve Edebiyatı is Edebiyat …),
// or null for lessons without etüts (Beden Eğitimi, Görsel Sanatlar …).
const DERS_AILE=[[/^(TEMEL |İLERİ |SEÇMELİ )?MATEMATİK/u,'Matematik'],[/GEOMETRİ/u,'Geometri'],[/EDEBİYAT/u,'Edebiyat'],[/^TÜRKÇE/u,'Türkçe'],[/FİZİK/u,'Fizik'],[/KİMYA/u,'Kimya'],
  [/BİYOLOJİ/u,'Biyoloji'],[/(TARİH|İNKILAP)/u,'Tarih'],[/COĞRAFYA/u,'Coğrafya'],[/^(FELSEFE|MANTIK|PSİKOLOJİ|SOSYOLOJİ)/u,'Felsefe'],[/^DİN/u,'Din Kültürü'],[/^(İNGİLİZCE|YABANCI DİL)/u,'İngilizce']];
const dersAilesi=d=>{const b=anahtar(d);for(const [re,ad] of DERS_AILE)if(re.test(b))return ad;return null};
// Lessons whose hours are the teacher's own lesson's: a chemistry teacher's Fen Bilimleri Uygulamaları is Kimya.
const ARA_DERS=/ADAB|MUA[ŞS]ERET|REHBERL[İI]K|FEN B[İI]L[İI]M\S* UYGULAMA|UYGULAMALI DENEY/u;
const araDers=d=>ARA_DERS.test(anahtar(d));
// The timetable's teacher for a name on the etüt sheet: the same name, or the same surname with the
// first names or their initials matching ("A. YILMAZ" is "AHMET YILMAZ"); never a guess
// between two.
function hocaEsle(ad,adlar){
  const k=anahtar(ad);if(adlar.has(k))return k;
  const p=k.replace(/\./g,' ').split(' ').filter(Boolean);if(p.length<2)return null;
  const uyan=[...adlar].filter(a=>{const q=a.replace(/\./g,' ').split(' ').filter(Boolean);if(q.length<2||q[q.length-1]!==p[p.length-1])return false;
    const [az,cok]=p.length<=q.length?[p,q]:[q,p];return az.slice(0,-1).every((t,i)=>cok[i].startsWith(t))});
  return uyan.length===1?uyan[0]:null;
}
// Sınıf dağıtımı with timetables. Every class's etüts go to its own teachers: a class, a lesson and its
// teacher make a pair. A class's subject (Matematik with Matematik TYT and AYT, …) weighs its weekly
// hours. A teacher's etüts in the dates go to their pairs, the class's subject with the lowest
// (etüts + 1) ÷ hours first: every pair has one before any has two, and subjects with more hours get
// more. A subject never gets more etüts per weekly hour than one of the class's subjects with more
// hours (nor more etüts than one with as many), unless it is the pair's first; etüts left over stay
// empty, for students to write in. Each teacher's etüts are then spread over their dates. Öğrenci 1 shows the
// lesson beside the class when it is not the sheet's branş: "11/A (GEOMETRİ)".
function programDagit(p,gunler,siniflar){
  const programli=siniflar.filter(c=>p.programlar&&p.programlar[c]),adlar=new Set();
  for(const c of programli)for(const x of p.programlar[c].dersler)if(x[3])adlar.add(anahtar(x[3]));
  const eslesme=new Map(),hoca=ad=>{const k=anahtar(ad);if(!eslesme.has(k))eslesme.set(k,hocaEsle(ad,adlar));return eslesme.get(k)};
  const yerler=new Map(),aileler=new Set();
  for(const {g,w} of gunler)for(const grup of gruplar(p.gunler[w]))for(const i of grup.satir){const s=p.gunler[w][i];if(!s[1])continue;
    const a=dersAilesi(s[0]);if(a)aileler.add(a);
    const t=hoca(s[1]);if(!t)continue;
    if(!yerler.has(t))yerler.set(t,[]);yerler.get(t).push({y:g+':'+i,aile:a})}
  // A teacher's own lesson: their branş on the sheet, else the lesson they teach most hours in the timetables.
  const ana=new Map(),saat=new Map();
  for(const gun of p.gunler)for(const s of gun){const t=s[0]&&s[1]&&hoca(s[1]);if(t&&!ana.has(t))ana.set(t,s[0])}
  for(const c of Object.keys(p.programlar).sort(sinifSirala))for(const [,,ders,h] of p.programlar[c].dersler)if(h&&!araDers(ders)){
    const t=anahtar(h);if(!saat.has(t))saat.set(t,new Map());const m=saat.get(t);m.set(ders,(m.get(ders)||0)+1)}
  for(const [t,m] of saat)if(!ana.has(t)){let en=null;for(const [d,n] of m)if(!en||n>en[1])en=[d,n];ana.set(t,en[0])}
  const ciftler_=[];
  programli.forEach((c,ci)=>{const m=new Map(),l=p.programlar[c].dersler.filter(x=>x[3]);
    const ekle=(t,ders)=>{const k=t+'|'+anahtar(ders);if(!m.has(k))m.set(k,{c,ci,t,ders,aile:dersAilesi(ders),h:0,n:0});m.get(k).h++};
    for(const [,,ders,h] of l)if(!araDers(ders)||!ana.has(anahtar(h)))ekle(anahtar(h),ders);
    // Rehberlik, Adab-ı Muaşeret, Fen Bilimleri Uygulamaları, Uygulamalı Deney: hours of the teacher's own lesson,
    // under its name in this timetable when the teacher teaches it to the class.
    for(const [,,ders,h] of l){const t=anahtar(h);if(!araDers(ders)||!ana.has(t))continue;const a=ana.get(t),af=dersAilesi(a);
      const ayni=[...m.values()].filter(x=>x.t===t&&(anahtar(x.ders)===anahtar(a)||af&&x.aile===af)).sort((x,y)=>y.h-x.h)[0];
      ekle(t,ayni?ayni.ders:buyuk(a))}
    ciftler_.push(...m.values())});
  const etkin=ciftler_.filter(x=>yerler.has(x.t)),kalan=new Map([...yerler].map(([t,l])=>[t,l.length]));
  // Subjects: the pairs of a class's subject together, with all their weekly hours.
  const konu=new Map();for(const x of ciftler_){const k=x.c+'|'+(x.aile||anahtar(x.ders));if(!konu.has(k))konu.set(k,{c:x.c,h:0,n:0,etkin:false});x.k=konu.get(k);x.k.h+=x.h}
  for(const x of etkin)x.k.etkin=true;
  const konular=[...konu.values()].filter(k=>k.etkin);
  const once=(x,y)=>x.ci-y.ci||y.k.h-x.k.h||y.h-x.h||x.ders.localeCompare(y.ders,'tr');
  const izin=x=>x.n===0||konular.every(q=>q===x.k||q.c!==x.c||(q.h>x.k.h?(x.k.n+1)*q.h<=q.n*x.k.h:q.h===x.k.h?x.k.n<=q.n:true));
  const az=(x,y)=>{const a=(x.k.n+1)*y.k.h-(y.k.n+1)*x.k.h;return a||(x.n+1)*y.h-(y.n+1)*x.h||once(x,y)};
  for(;;){let en=null;
    for(const x of etkin){if(!kalan.get(x.t)||!izin(x))continue;if(!en||az(x,en)<0)en=x}
    if(!en)break;en.n++;en.k.n++;kalan.set(en.t,kalan.get(en.t)-1)}
  const sinif=new Map();
  for(const [t,l] of yerler){
    const sira=[],benim=etkin.filter(x=>x.t===t&&x.n),bos=l.length-benim.reduce((a,x)=>a+x.n,0);
    for(const x of benim)for(let j=0;j<x.n;j++)sira.push({x,o:(j+.5)/x.n});
    for(let j=0;j<bos;j++)sira.push({x:null,o:(j+.5)/bos});
    sira.sort((a,b)=>a.o-b.o||(!a.x)-(!b.x)||(a.x&&b.x?once(a.x,b.x):0));
    l.forEach((y,k)=>{const x=sira[k].x;if(x)sinif.set(y.y,x.c+(x.aile&&x.aile===y.aile?'':' ('+buyuk(x.aile||x.ders)+')'))});
  }
  // Per class: its lessons with etüt teachers, and the lessons of the sheet's branşes it gets none of.
  const tablo=programli.map(c=>{const l=ciftler_.filter(x=>x.c===c&&(yerler.has(x.t)||x.aile&&aileler.has(x.aile))).sort((a,b)=>b.h-a.h||a.ders.localeCompare(b.ders,'tr'));
    return {sinif:c,dersler:l.map(x=>({ders:x.ders,saat:x.h,etut:x.n,hoca:yerler.has(x.t)}))}});
  const programsiz=siniflar.filter(c=>!programli.includes(c)),eksik=tablo.reduce((t,x)=>t+x.dersler.filter(d=>!d.etut).length,0);
  return {gunler,sinif,siniflar:programli,programsiz,tablo,eksik,kapsam:[],mod:'program'};
}
const tarihAdi=g=>{const t=new Date(g*864e5);return t.getUTCDate()+' '+AYLAR[t.getUTCMonth()]};
const kisaTarih=g=>{const t=new Date(g*864e5);return t.getUTCDate()+' '+AYLAR[t.getUTCMonth()].slice(0,3)};
const rapor=()=>typeof ETUT!=='undefined'&&ETUT.planIcin?ETUT.planIcin():null;
// The etüt report's teachers for a weekday that the day does not have yet.
function eksikler(satirlar,liste){
  const var_=new Set(satirlar.map(s=>anahtar(s[1])).filter(Boolean)),out=[];
  for(const o of liste||[]){const k=anahtar(o.ogretmen);if(k&&!var_.has(k)){var_.add(k);out.push(o)}}
  return out;
}
function bransBul(p,ogretmen){
  const k=anahtar(ogretmen);
  for(const g of p.gunler)for(const s of g)if(s[0]&&anahtar(s[1])===k)return s[0];
  const r=rapor(),o=r&&r.ogretmenler.find(x=>anahtar(x.ogretmen)===k);return o?o.brans:'';
}
function gunSec(){
  const g=EK.epGun;if(g==='hepsi'||(Number.isInteger(g)&&g>=0&&g<GUNLER.length))return g;
  const h=haftaGunu(bugunNo());return h<GUNLER.length?h:0;
}
// "PAZARTESİ — ETÜT PLANI", or with its date in a Sınıf dağıtımı: "PERŞEMBE 22 EKİM — ETÜT PLANI".
const baslik=(w,g)=>buyuk(GUNLER[w])+(g==null?'':' '+buyuk(tarihAdi(g)))+' — ETÜT PLANI';
// The dated sheet on screen: one date, or every date ('hepsi'); today or the next date by default.
function tarihSec(dg){
  const t=EK.epTarih;if(t==='hepsi')return t;if(Number.isInteger(t)&&dg.gunler.some(x=>x.g===t))return t;
  const s=dg.gunler.find(x=>x.g>=bugunNo());return s?s.g:'hepsi';
}
// The sheets on screen and on paper: {w: weekday, g: date or null}.
function kagitlar(p,dg,mod){
  if(dg&&mod!=='ogretmen'){const t=tarihSec(dg);return (t==='hepsi'?dg.gunler:dg.gunler.filter(x=>x.g===t)).map(({g,w})=>({w,g}))}
  const s=gunSec();return (s==='hepsi'?GUNLER.map((_,j)=>j):[s]).map(w=>({w,g:null}));
}

/* ---------------- pasted teacher list ---------------- */
// One paste sets the week: a weekday on its own line ("PAZARTESİ", "Salı — ETÜT PLANI") starts a day
// and "Branş: Ad Soyad, Ad Soyad" lines follow. Lines before any weekday go to the day on screen.
const sade=s=>anahtar(s).replace(/[İI]/g,'I').replace(/Ş/g,'S').replace(/Ç/g,'C').replace(/Ğ/g,'G').replace(/Ö/g,'O').replace(/Ü/g,'U');
function listeCoz(metin,gun){
  const gunler=new Map(),hatalar=[];let g=Number.isInteger(gun)?gun:null;
  String(metin||'').split(/\r?\n/).forEach((ham,i)=>{
    const satir=String(ham).trim().slice(0,500);if(!satir)return;
    const bas=sade(satir).replace(/\s*[—–-]*\s*ETUT PLANI\s*$/,'').replace(/[\s:.]+$/,''),gi=GUNLER.findIndex(d=>sade(d)===bas);
    if(gi>=0){g=gi;if(!gunler.has(g))gunler.set(g,[]);return}
    const m=/^([^:\t]+?)\s*[:\t]\s*(.+)$/.exec(satir),adlar=m?m[2].split(/\s*[,;\t]\s*/).map(a=>kisa(a,60)).filter(Boolean):[];
    if(g===null||!m||!kisa(m[1],40)||!adlar.length){hatalar.push(i+1);return}
    if(!gunler.has(g))gunler.set(g,[]);
    for(const a of adlar)gunler.get(g).push([kisa(m[1],40),a]);
  });
  return {gunler,hatalar};
}
// Each pasted day's teachers replace that day's list; a teacher who stays keeps their students.
async function listeUygula(metin){
  const g0=gunSec(),{gunler,hatalar}=listeCoz(metin,g0==='hepsi'?null:g0);
  if(hatalar.length)throw new Error((hatalar.length>1?'Okunamayan satırlar: ':'Okunamayan satır: ')+hatalar.slice(0,6).join(', ')+'. Gün adı kendi satırında, öğretmenler “Branş: Ad Soyad, Ad Soyad” biçiminde.');
  const dolu=[...gunler].filter(([,l])=>l.length).sort((a,b)=>a[0]-b[0]);
  if(!dolu.length)throw new Error('Yapıştırılan listede öğretmen yok.');
  for(const [g,l] of dolu)if(l.length>EN_COK_SATIR)throw new Error(GUNLER[g]+': bir günde en fazla '+EN_COK_SATIR+' satır olur.');
  const {plan}=oku(),degisen=plan?dolu.filter(([g])=>plan.gunler[g].length).map(([g])=>GUNLER[g]):[];
  if(degisen.length&&!confirm(degisen.join(', ')+' öğretmen listesi yapıştırılanla değişsin mi? Kalan öğretmenlerin öğrencileri korunur.'))return '';
  await degistir(p=>{for(const [g,l] of dolu){
    const eski=new Map();for(const s of p.gunler[g])if(s[1]&&!eski.has(anahtar(s[1])))eski.set(anahtar(s[1]),s[2]);
    p.gunler[g]=l.map(([b,o])=>{const k=anahtar(o),ogr=eski.get(k);eski.delete(k);return [b,o,ogr?ogr.slice():Array(OGRENCI).fill('')]})}});
  return 'Yapıştırıldı: '+dolu.map(([g,l])=>GUNLER[g]+' '+sayi(l.length)).join(' · ')+' öğretmen.';
}

/* ---------------- page ---------------- */
let DURUM_YAZI='',LISTE='';
function durum(t){DURUM_YAZI=t||'';const el=document.getElementById('epDurum');if(el)el.textContent=DURUM_YAZI}
// Columns as in the Excel file: BRANŞ 16, ÖĞRETMEN and the four students 26 characters wide.
const sutunlar='<colgroup><col class="ep-k-brans"><col class="ep-k-hoca">'+'<col class="ep-k-ogr">'.repeat(OGRENCI)+'</colgroup>';
const basSatiri='<thead><tr><th scope="col">BRANŞ</th><th scope="col">ÖĞRETMEN</th>'+Array.from({length:OGRENCI},(_,k)=>'<th scope="col">ÖĞRENCİ '+(k+1)+'</th>').join('')+'</tr></thead>';
// Rows as in the Excel file: the branş on its group's first row, the cell below it left empty.
function govde(satirlar,hucre){
  let h='';
  for(const grup of gruplar(satirlar))grup.satir.forEach((i,j)=>{const s=satirlar[i];
    h+='<tr>'+(j===0?'<th scope="row" class="ep-brans">'+kacis(buyuk(grup.brans))+'</th>':'<td class="ep-brans-bos"></td>')+'<td class="ep-hoca">'+kacis(buyuk(s[1]))+'</td>'+s[2].map((a,k)=>hucre(i,k,a)).join('')+'</tr>'});
  return h;
}
// The class a Sınıf dağıtımı writes in a dated sheet's Öğrenci 1, or null.
const sinifIcin=(dg,k)=>k.g!=null&&dg?(i=>dg.sinif.get(k.g+':'+i)||''):null;
function kagit(p,k,r,salt,dg){
  const g=k.w,satirlar=p.gunler[g],sinif=sinifIcin(dg,k),cift=ciftler(satirlar,sinif?1:0);
  let h=govde(satirlar,(i,j,a)=>sinif&&j===0?'<td class="ep-ogr ep-sinif">'+kacis(sinif(i))+'</td>':
    '<td class="ep-ogr"><input type="text" data-ep-g="'+g+'" data-ep-r="'+i+'" data-ep-k="'+j+'" value="'+kacis(a)+'" maxlength="60" list="epOgrenciler" autocomplete="off" spellcheck="false" placeholder="Öğrenci '+(j+1)+'" aria-label="'+kacis((satirlar[i][1]||satirlar[i][0]||GUNLER[g])+' · Öğrenci '+(j+1))+'"'+
      (cift.has(anahtar(a))?' class="ep-cift" title="Bu günde iki kez yazıldı"':'')+(salt?' readonly':'')+'></td>');
  if(!satirlar.length){const oneri=r?eksikler([],r.gunler[g]):[];
    h='<tr><td class="ep-bos" colspan="'+(2+OGRENCI)+'">'+(salt?'—':'<button type="button" class="et-dugme" data-ep-ekle="'+g+'">Öğretmen ekle</button>'+
      (oneri.length?'<button type="button" class="et-dugme" data-ep-rapor="'+g+'">Etüt raporundan ekle</button>':''))+'</td></tr>'}
  return '<section class="et-panel ep-kagit" data-ep-kagit="'+g+'"'+(k.g!=null?' data-ep-tarih="'+k.g+'"':'')+'><h2 class="ep-baslik">'+kacis(baslik(g,k.g))+'</h2><div class="ep-kaydir"><table class="ep-tablo">'+sutunlar+basSatiri+'<tbody>'+h+'</tbody></table></div></section>';
}
function duzenKagidi(p,g,r){
  const satirlar=p.gunler[g],oneri=r?eksikler(satirlar,r.gunler[g]):[];
  const govde_=satirlar.map((s,i)=>'<tr><td><input type="text" data-ep-g="'+g+'" data-ep-r="'+i+'" data-ep-alan="0" value="'+kacis(s[0])+'" maxlength="40" list="epBranslar" autocomplete="off" aria-label="Branş"></td>'+
    '<td><input type="text" data-ep-g="'+g+'" data-ep-r="'+i+'" data-ep-alan="1" value="'+kacis(s[1])+'" maxlength="60" list="epOgretmenler" autocomplete="off" spellcheck="false" aria-label="Öğretmen"></td>'+
    '<td class="ep-sil"><button type="button" class="ep-x" data-ep-sil="'+g+':'+i+'" aria-label="Satırı sil" title="Satırı sil">×</button></td></tr>').join('');
  const kopya=GUNLER.map((ad,j)=>j===g||!p.gunler[j].length?'':'<option value="'+j+'">'+ad+'</option>').join('');
  return '<section class="et-panel ep-duzen" data-ep-kagit="'+g+'"><h2 class="ep-baslik">'+kacis(baslik(g))+'</h2>'+
    (satirlar.length?'<div class="ep-kaydir"><table class="ep-tablo duzen"><colgroup><col><col class="ep-k-hoca2"><col class="ep-k-sil"></colgroup><thead><tr><th scope="col">BRANŞ</th><th scope="col">ÖĞRETMEN</th><th scope="col"><span class="ep-gizli">Sil</span></th></tr></thead><tbody>'+govde_+'</tbody></table></div>':'')+
    '<div class="ep-duzen-arac"><button type="button" class="et-dugme" data-ep-ekle="'+g+'">Satır ekle</button>'+
    (oneri.length?'<button type="button" class="et-dugme" data-ep-rapor="'+g+'">Etüt raporundan ekle</button>':'')+
    (kopya?'<select data-ep-kopya="'+g+'" aria-label="Başka günün öğretmenlerini ekle"><option value="">Başka günden ekle</option>'+kopya+'</select>':'')+'</div></section>';
}
function listeler(p,r){
  const tekil=(liste,an)=>{const g=new Set();return liste.filter(x=>{const k=an(x);if(!k||g.has(k))return false;g.add(k);return true})};
  const ogr=tekil((D.ogr||[]).filter(o=>o&&!o.silindi&&o.ad).map(o=>({ad:String(o.ad),sinif:o.sube||''})).concat(r?r.ogrenciler:[]),x=>anahtar(x.ad));
  const hoca=tekil(p.gunler.flat().map(s=>s[1]).concat(r?r.ogretmenler.map(o=>o.ogretmen):[]),anahtar);
  const brans=tekil(BRANS_SIRA.concat(p.gunler.flat().map(s=>s[0]),r?r.ogretmenler.map(o=>o.brans):[]),anahtar);
  const sec=(id,l)=>'<datalist id="'+id+'">'+l.join('')+'</datalist>';
  return sec('epOgrenciler',ogr.map(o=>'<option value="'+kacis(o.ad)+'"'+(o.sinif?' label="'+kacis(o.sinif)+'"':'')+'></option>'))+
    sec('epOgretmenler',hoca.map(a=>'<option value="'+kacis(a)+'"></option>'))+sec('epBranslar',brans.map(a=>'<option value="'+kacis(a)+'"></option>'));
}
const seg=(ad,deger,secenekler,etiket,ek)=>'<div class="et-seg'+(ek?' '+ek:'')+'" role="group" aria-label="'+etiket+'"><span class="et-seg-label">'+etiket+'</span>'+
  secenekler.map(([v,yazi,uzun])=>'<button type="button" data-ep-'+ad+'="'+v+'" aria-pressed="'+(String(v)===String(deger))+'"'+(uzun?' aria-label="'+uzun+'"':'')+'>'+yazi+'</button>').join('')+'</div>';
const aralikAdi=d=>kisaTarih(gunNo(d.bas))+' – '+kisaTarih(gunNo(d.bit));
const tarihYaz=iso=>{const [y,a,g]=iso.split('-');return g+'.'+a+'.'+y};
// Sınıf dağıtımı: dates, classes and days without etüt; below them what every subject (or, with the
// timetables, every class's lesson) gets.
function dagitimPaneli(p,dg){
  const d=p.donem||varsayilanDonem(),eksik=dg?dg.mod==='program'?dg.eksik:dg.kapsam.filter(x=>x.eksik.length).length:0;
  const ozet=dg?' · '+aralikAdi(d)+' · '+sayi(dg.siniflar.length)+' sınıf'+(dg.mod==='program'?' · ders programına göre':'')+(eksik?' · '+sayi(eksik)+' derste eksik':' · tamam'):'';
  const kapsam=!dg?'':dg.mod==='program'?'<ul class="ep-kapsam ep-sinif-kapsam">'+dg.tablo.map(x=>'<li><b>'+kacis(x.sinif)+'</b> '+x.dersler.map(y=>'<span class="'+(y.etut?'ep-tamam':'ep-eksik')+'" title="'+
        kacis(y.hoca?'Haftada '+y.saat+' saat':'Öğretmeni etüt planında yok')+'">'+kacis(buyuk(y.ders))+' '+sayi(y.etut)+'</span>').join(' ')+'</li>').join('')+
      (dg.programsiz.length?'<li class="ep-eksik">Ders programı olmayan: '+kacis(dg.programsiz.join(', '))+'</li>':'')+'</ul>':
    '<ul class="ep-kapsam">'+dg.kapsam.map(x=>'<li class="'+(x.eksik.length?'ep-eksik':'ep-tamam')+'"><b>'+kacis(buyuk(x.brans))+'</b> '+sayi(x.yer)+' etüt'+
      (x.eksik.length?' · alamayan: '+kacis(x.eksik.join(', ')):'')+'</li>').join('')+'</ul>';
  return '<details class="ep-yapistir ep-dagitim" id="epDagitim"'+(EK.epDagitimAcik||!dg?' open':'')+'><summary>Sınıf dağıtımı'+kacis(ozet)+'</summary>'+
    '<div class="ep-dagitim-alan"><label>Başlangıç<input type="date" id="epDonemBas" value="'+d.bas+'"></label><label>Bitiş<input type="date" id="epDonemBit" value="'+d.bit+'"></label>'+
    '<label class="ep-genis">Sınıflar (12. sınıflar hariç)<input type="text" id="epSiniflar" value="'+kacis(d.siniflar.join(', '))+'" placeholder="9/A, 9/B, 10/A" spellcheck="false"></label>'+
    '<label class="ep-genis">Etüt olmayan günler<input type="text" id="epYok" value="'+kacis(d.yok.map(tarihYaz).join(', '))+'" placeholder="29.10.2026" spellcheck="false"></label></div>'+
    '<div class="ep-duzen-arac"><button type="button" class="et-dugme birincil" id="epDagit">'+(dg?'Güncelle':'Dağıt')+'</button>'+(dg?'<button type="button" class="et-dugme" id="epDagitimKaldir">Kaldır</button>':'')+'</div>'+kapsam+'</details>';
}
// Ders programları: the classes' timetables from the school's PDFs; one is shown as its weekly grid.
function programPaneli(p,salt){
  const P=p.programlar||{},l=Object.keys(P).sort(sinifSirala),sec=l.includes(EK.epProgram)?EK.epProgram:null;
  return '<details class="ep-yapistir ep-programlar" id="epProgramlar"'+(EK.epProgramAcik?' open':'')+'><summary>Ders programları'+(l.length?' · '+kacis(l.join(', ')):'')+'</summary>'+
    '<div class="ep-duzen-arac">'+(salt?'':'<label class="et-dugme">PDF ekle<input type="file" id="epProgramPdf" accept="application/pdf,.pdf" multiple hidden></label>')+
      l.map(c=>'<button type="button" class="et-dugme" data-ep-program="'+kacis(c)+'" aria-pressed="'+(c===sec)+'">'+kacis(c)+' <span class="mini">'+sayi(P[c].dersler.length)+' saat</span></button>').join('')+'</div>'+
    (sec?programTablosu(sec,P[sec],salt):'')+'</details>';
}
function programTablosu(c,x,salt){
  const gunler=PROGRAM_GUNLER.map((_,g)=>g).filter(g=>g<5||x.dersler.some(d=>d[0]===g));
  return '<div class="ep-kaydir"><table class="ep-program"><caption>'+kacis(c)+(x.kod?' <span class="mini">('+kacis(x.kod)+')</span>':'')+'</caption><thead><tr><th scope="col"></th>'+
      gunler.map(g=>'<th scope="col">'+PROGRAM_GUNLER[g]+'</th>').join('')+'</tr></thead><tbody>'+
    x.saatler.map(t=>'<tr><th scope="row">'+kacis(t)+'</th>'+gunler.map(g=>{const d=x.dersler.find(y=>y[0]===g&&y[1]===t);
      return '<td>'+(d?'<b>'+kacis(d[2])+'</b>'+(d[3]?'<span>'+kacis(d[3])+'</span>':''):'')+'</td>'}).join('')+'</tr>').join('')+'</tbody></table></div>'+
    (salt?'':'<div class="ep-duzen-arac"><button type="button" class="et-dugme" data-ep-program-sil="'+kacis(c)+'">'+kacis(c)+' programını sil</button></div>');
}
function icerik(){
  const {plan,hata}=oku(),salt=izleme();
  const bas='<header class="et-bas"><h1 class="et-baslik">Etüt planı</h1></header>',durumSatiri='<p id="epDurum" role="status" aria-live="polite">'+kacis(DURUM_YAZI)+'</p>';
  if(hata)return bas+'<p class="et-uyari">'+kacis(hata)+'</p>'+durumSatiri;
  const mod=!salt&&EK.epMod==='ogretmen'?'ogretmen':'ogrenci',dg=dagit(plan),r=rapor(),liste=kagitlar(plan,dg,mod),tarihli=dg&&mod!=='ogretmen';
  const ogrVar=liste.some(k=>plan.gunler[k.w].some(s=>s[2].slice(tarihli?1:0).some(Boolean)));
  const secim=tarihli?'<label class="et-seg"><span class="et-seg-label">Tarih</span><select id="epTarih" aria-label="Tarih"><option value="hepsi">Tümü ('+aralikAdi(plan.donem)+')</option>'+
      dg.gunler.map(x=>'<option value="'+x.g+'"'+(tarihSec(dg)===x.g?' selected':'')+'>'+KISA[x.w]+' '+kisaTarih(x.g)+'</option>').join('')+'</select></label>':
    seg('gun',gunSec(),GUNLER.map((ad,j)=>[j,'<span class="ep-tam">'+ad+'</span><span class="ep-kisa" aria-hidden="true">'+KISA[j]+'</span>',ad]).concat([['hepsi','Tümü']]),'Gün','ep-gun-sec');
  return bas+'<div class="et-arac"><button type="button" class="et-dugme birincil" id="epYazdir">Yazdır</button>'+secim+
    (salt?'':seg('mod',mod,[['ogrenci','Öğrenciler'],['ogretmen','Öğretmenler']],'Düzenle')+'<button type="button" class="et-dugme" id="epTemizle"'+(ogrVar?'':' disabled')+'>Öğrencileri sil</button>')+'</div>'+durumSatiri+
    (salt?'':dagitimPaneli(plan,dg))+programPaneli(plan,salt)+
    (mod==='ogretmen'?'<details class="ep-yapistir" id="epYapistir"'+(LISTE?' open':'')+'><summary>Listeyi yapıştır</summary><textarea id="epListe" rows="9" spellcheck="false" aria-label="Öğretmen listesi" '+
      'placeholder="PAZARTESİ&#10;Matematik: Ad Soyad, Ad Soyad&#10;Geometri: Ad Soyad&#10;SALI&#10;Matematik: Ad Soyad">'+kacis(LISTE)+'</textarea><button type="button" class="et-dugme birincil" id="epListeUygula">Uygula</button></details>':'')+
    '<div class="ep-gunler">'+liste.map(k=>mod==='ogretmen'?duzenKagidi(plan,k.w,r):kagit(plan,k,r,salt,dg)).join('')+'</div>'+listeler(plan,r)+'<div id="epBaski"></div>';
}
function gorunum(){
  if(!rehberMi())return '<div class="baslik"><h1>Etüt planı</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  baskiBitir();
  return '<div id="epKok">'+icerik()+'</div>';
}
function yenidenCiz(odak){
  const kok=document.getElementById('epKok');if(!kok){ciz();return}
  kok.innerHTML=icerik();
  if(odak){const el=document.querySelector(odak);if(el)el.focus()}
}

/* ---------------- print ---------------- */
// Printed as the school's Excel file prints: A4 landscape, Pazartesi with Salı and Çarşamba with
// Perşembe on one page, Cuma alone (in a Sınıf dağıtımı, per week). The Excel prints at 82%; a page
// whose rows would not fit is printed smaller, as Excel's "fit to page" does.
const OLCEK=.82,SAYFA_PT=595.3-144,SATIR_PT=19.5,BASLIK_PT=21.75,ARA_PT=30;
function sayfala(liste){
  const out=[];
  for(const k of liste){const a=(k.g==null?0:pazartesi(k.g))+'|'+Math.floor(k.w/2),son=out[out.length-1];if(son&&son.a===a)son.l.push(k);else out.push({a,l:[k]})}
  return out.map(x=>x.l);
}
function baskiHtml(p,liste,dg){
  liste=liste.map(k=>typeof k==='number'?{w:k,g:null}:k).filter(k=>p.gunler[k.w].length);
  return sayfala(liste).map(l=>{
    const pt=l.reduce((t,k)=>t+2*BASLIK_PT+p.gunler[k.w].length*SATIR_PT,0)+(l.length-1)*ARA_PT,o=Math.min(OLCEK,SAYFA_PT/pt);
    return '<section class="ep-sayfa" style="--o:'+(Math.floor(o*1000)/1000)+'">'+l.map(k=>{const sinif=sinifIcin(dg,k);
      return '<div class="ep-gun"><h1>'+kacis(baslik(k.w,k.g))+'</h1><table>'+sutunlar+basSatiri+'<tbody>'+
        govde(p.gunler[k.w],(i,j,a)=>'<td class="ep-ogr'+(sinif&&j===0?' ep-sinif':'')+'">'+kacis(sinif&&j===0?sinif(i):buyuk(a))+'</td>')+'</tbody></table></div>'}).join('<div class="ep-ara"></div>')+'</section>'}).join('');
}
function baskiBitir(){
  if(typeof document==='undefined'||!document.body)return;
  document.body.classList?.remove('ep-yazdir');document.getElementById('epSayfaStili')?.remove();
}
// Also run from the browser's own print command (beforeprint), so Ctrl+P prints the sheets too.
function baskiHazirla(){
  const {plan}=oku(),kutu=document.getElementById('epBaski');if(!plan||!kutu)return false;
  const dg=dagit(plan),html=baskiHtml(plan,kagitlar(plan,dg,'ogrenci'),dg);if(!html)return false;
  kutu.innerHTML=html;
  // Excel's margins: 1 inch top and bottom, 0.75 inch at the sides.
  const stil=document.createElement('style');stil.id='epSayfaStili';stil.textContent='@media print{@page{size:A4 landscape;margin:25.4mm 19.05mm}}';
  baskiBitir();document.head.appendChild(stil);document.body.classList.add('ep-yazdir');
  window.addEventListener('afterprint',baskiBitir,{once:true});
  return true;
}
function yazdir(){
  if(!baskiHazirla()){durum('Yazdırılacak öğretmen yok.');return false}
  try{if(typeof window.print!=='function')throw new Error('print');window.print();return true}
  catch(e){baskiBitir();durum('Yazdırma açılamadı.');return false}
}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('beforeprint',()=>{if(etkin()&&!document.body.classList.contains('ep-yazdir'))baskiHazirla()});

/* ---------------- events ---------------- */
const etkin=()=>EK.sekme==='etutplani'&&rehberMi();
const hucre=(g,r,alan)=>document.querySelector('input[data-ep-g="'+g+'"][data-ep-r="'+r+'"][data-ep-alan="'+alan+'"]');
// Within one sheet; a dated plan shows a weekday more than once.
function ciftIsaretle(kagit){
  if(!kagit)return;const kutular=[...kagit.querySelectorAll('input[data-ep-k]')],n=new Map();
  for(const i of kutular){const k=anahtar(i.value);if(k)n.set(k,(n.get(k)||0)+1)}
  for(const i of kutular){const c=(n.get(anahtar(i.value))||0)>1;i.classList.toggle('ep-cift',c);if(c)i.title='Bu günde iki kez yazıldı';else i.removeAttribute('title')}
}
async function ekle(g,liste,yazi){
  const n=await degistir(p=>{const l=eksikler(p.gunler[g],liste);if(p.gunler[g].length+l.length>EN_COK_SATIR)throw new Error('Bir günde en fazla '+EN_COK_SATIR+' satır olur.');
    for(const o of l)p.gunler[g].push(yeniSatir(kisa(o.brans,40),kisa(o.ogretmen,60)));return l.length});
  durum(n?yazi+': '+sayi(n)+' öğretmen eklendi.':'Eklenecek yeni öğretmen yok.');
}
// Leaving the teacher view drops rows with nothing written in them.
async function bosSatirlariAt(){
  const {plan}=oku();if(!plan||!plan.gunler.some(g=>g.some(s=>!s[0]&&!s[1]&&!s[2].some(Boolean))))return;
  await degistir(p=>{p.gunler=p.gunler.map(g=>g.filter(s=>s[0]||s[1]||s[2].some(Boolean)))});
}
// The Sınıf dağıtımı fields: dates (at most ten weeks), classes ("10-a" → "10/A", 12th grade left out)
// and days without etüt (dd.mm.yyyy or yyyy-mm-dd).
function donemOku(){
  const deger=id=>(document.getElementById(id)||{}).value||'';
  const bas=deger('epDonemBas'),bit=deger('epDonemBit');
  if(!isoTarihGecerli(bas)||!isoTarihGecerli(bit))throw new Error('Başlangıç ve bitiş tarihini seçin.');
  if(bas>bit)throw new Error('Bitiş, başlangıçtan önce olamaz.');
  if(gunNo(bit)-gunNo(bas)>EN_COK_DONEM)throw new Error('Dağıtım en fazla on hafta olur.');
  const parca=deger('epSiniflar').split(/[,;\s]+/).filter(Boolean),siniflar=[],hatali=[];let on2=0;
  for(const c of parca){const y=sinifYaz(c);if(!y)hatali.push(c);else if(parseInt(y,10)===12)on2++;else if(!siniflar.includes(y))siniflar.push(y)}
  if(hatali.length)throw new Error('Okunamayan sınıf: '+hatali.slice(0,5).join(', ')+'. Sınıfları “10/A” gibi yazın.');
  if(!siniflar.length)throw new Error('En az bir sınıf yazın (12. sınıflar hariç).');
  if(siniflar.length>EN_COK_SINIF)throw new Error('En fazla '+EN_COK_SINIF+' sınıf olur.');
  const yok=[];
  for(const t of deger('epYok').split(/[,;\s]+/).filter(Boolean)){const m=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t),iso=m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):t;
    if(!isoTarihGecerli(iso))throw new Error('Okunamayan gün: '+t+'. Günleri “29.10.2026” gibi yazın.');if(!yok.includes(iso))yok.push(iso)}
  return {donem:{bas,bit,siniflar:siniflar.sort(sinifSirala),yok:yok.filter(t=>t>=bas&&t<=bit).sort().slice(0,EN_COK_DONEM)},on2};
}
document.addEventListener('click',async ev=>{
  if(!etkin())return;
  const el=ev.target.closest?.('[data-ep-gun],[data-ep-mod],[data-ep-ekle],[data-ep-rapor],[data-ep-sil],[data-ep-program],[data-ep-program-sil],#epYazdir,#epTemizle,#epListeUygula,#epDagit,#epDagitimKaldir');if(!el||el.disabled)return;
  try{
    if(el.id==='epYazdir'){yazdir();return}
    if(el.id==='epListeUygula'){const t=document.getElementById('epListe'),m=await listeUygula(t?t.value:LISTE);if(m){LISTE='';durum(m)}yenidenCiz();return}
    if(el.id==='epDagit'){const {donem,on2}=donemOku();await degistir(p=>{p.donem=donem});EK.epTarih=undefined;EK.epMod='ogrenci';
      const dg=dagit(oku().plan),eksik=dg.kapsam.filter(x=>x.eksik.length).length;
      durum('Dağıtıldı: '+aralikAdi(donem)+' · '+sayi(dg.gunler.length)+' gün · '+sayi(donem.siniflar.length)+' sınıf'+(on2?' (12. sınıflar alınmadı)':'')+'. '+(eksik?sayi(eksik)+' derste her sınıfa yer yok.':'Her sınıf her dersten en az bir etüt alıyor.'));
      yenidenCiz('#epDagit');return}
    if(el.dataset.epProgram!==undefined){const c=el.dataset.epProgram;EK.epProgram=EK.epProgram===c?null:c;yenidenCiz('[data-ep-program="'+c+'"]');return}
    if(el.dataset.epProgramSil!==undefined){const c=el.dataset.epProgramSil;if(!confirm(c+' ders programı silinsin mi?'))return;
      await degistir(p=>{if(p.programlar){delete p.programlar[c];if(!Object.keys(p.programlar).length)delete p.programlar}});EK.epProgram=null;durum(c+' ders programı silindi.');yenidenCiz();return}
    if(el.id==='epDagitimKaldir'){if(!confirm('Sınıf dağıtımı kaldırılsın mı? Haftalık plan kalır.'))return;
      await degistir(p=>{delete p.donem});durum('Sınıf dağıtımı kaldırıldı.');yenidenCiz();return}
    if(el.dataset.epGun!==undefined){const v=el.dataset.epGun;EK.epGun=v==='hepsi'?v:Number(v);durum('');yenidenCiz('[data-ep-gun="'+v+'"]');return}
    if(el.dataset.epMod){const v=el.dataset.epMod;if(v!=='ogretmen'&&EK.epMod==='ogretmen')await bosSatirlariAt();EK.epMod=v;durum('');yenidenCiz('[data-ep-mod="'+v+'"]');return}
    if(el.dataset.epEkle!==undefined){const g=Number(el.dataset.epEkle);
      const i=await degistir(p=>{if(p.gunler[g].length>=EN_COK_SATIR)throw new Error('Bir günde en fazla '+EN_COK_SATIR+' satır olur.');p.gunler[g].push(yeniSatir());return p.gunler[g].length-1});
      EK.epMod='ogretmen';EK.epGun=g;durum('');yenidenCiz('input[data-ep-g="'+g+'"][data-ep-r="'+i+'"][data-ep-alan="0"]');return}
    if(el.dataset.epRapor!==undefined){const g=Number(el.dataset.epRapor),r=rapor();if(!r)return;await ekle(g,r.gunler[g],'Etüt raporundan');yenidenCiz();return}
    if(el.dataset.epSil){const [g,i]=el.dataset.epSil.split(':').map(Number),{plan}=oku(),s=plan&&plan.gunler[g][i];if(!s)return;
      if(s[2].some(Boolean)&&!confirm('Bu satırdaki öğrenci adları da silinsin mi?'))return;
      await degistir(p=>{p.gunler[g].splice(i,1)});durum('');yenidenCiz();return}
    if(el.id==='epTemizle'){const {plan}=oku(),dg=dagit(plan),liste=kagitlar(plan,dg,'ogrenci'),gunler=[...new Set(liste.map(k=>k.w))],hepsi=gunler.length===GUNLER.length;
      if(!confirm(hepsi?'Bütün günlerin öğrenci adları silinsin mi? Öğretmenler kalır.':gunler.map(j=>GUNLER[j]).join(', ')+' günündeki öğrenci adları silinsin mi? Öğretmenler kalır.'))return;
      await degistir(p=>{for(const j of gunler)for(const s of p.gunler[j])s[2]=s[2].map(()=>'')});durum('Öğrenci adları silindi.');yenidenCiz();return}
  }catch(e){durum(e.message);yenidenCiz()}
});
document.addEventListener('toggle',ev=>{if(!etkin())return;if(ev.target.id==='epDagitim')EK.epDagitimAcik=ev.target.open;if(ev.target.id==='epProgramlar')EK.epProgramAcik=ev.target.open},true);
// The timetable PDFs: each read in the browser; a class read again replaces its timetable.
async function programEkle(files){
  const okunan=[],hatalar=[],defter=D;
  for(const f of files){durum('PDF okunuyor: '+f.name);
    try{const {pages}=await denemePdfSayfalari(f);okunan.push(programCoz(pages))}catch(e){hatalar.push(f.name+': '+e.message)}}
  if(D!==defter||!rehberMi())throw new Error('Oturum değişti.');
  if(okunan.length)await degistir(p=>{p.programlar=p.programlar||{};const ts=Date.now();
    for(const r of okunan)p.programlar[r.sinif]={kod:r.kod,ts,saatler:r.saatler,dersler:r.dersler};
    if(Object.keys(p.programlar).length>EN_COK_PROGRAM)throw new Error('En fazla '+EN_COK_PROGRAM+' sınıfın programı saklanır.')});
  if(okunan.length){EK.epProgram=okunan[0].sinif;EK.epProgramAcik=true}
  return (okunan.length?'Ders programı eklendi: '+okunan.map(r=>r.sinif+' ('+sayi(r.dersler.length)+' saat)').join(', ')+'.':'Ders programı eklenmedi.')+(hatalar.length?' Okunamayan: '+hatalar.join(' · '):'');
}
document.addEventListener('input',ev=>{if(!etkin())return;if(ev.target.id==='epListe')LISTE=ev.target.value;else if(ev.target.dataset?.epK!==undefined)ciftIsaretle(ev.target.closest('.ep-kagit'))});
document.addEventListener('change',async ev=>{
  if(!etkin())return;const el=ev.target;
  try{
    if(el.id==='epProgramPdf'){const files=Array.from(el.files||[]);el.value='';if(!files.length)return;if(files.length>40){durum('Bir defada en fazla 40 PDF seçin.');return}
      durum(await programEkle(files));yenidenCiz();return}
    if(el.id==='epTarih'){EK.epTarih=el.value==='hepsi'?'hepsi':Number(el.value);durum('');yenidenCiz('#epTarih');return}
    if(el.dataset?.epKopya!==undefined){const g=Number(el.dataset.epKopya),j=Number(el.value);if(el.value===''||!(j>=0&&j<GUNLER.length))return;
      const {plan}=oku();await ekle(g,plan.gunler[j].map(s=>({brans:s[0],ogretmen:s[1]})).filter(o=>o.ogretmen),GUNLER[j]+' gününden');yenidenCiz();return}
    if(el.dataset?.epR===undefined)return;
    const g=Number(el.dataset.epG),r=Number(el.dataset.epR),k=el.dataset.epK,alan=el.dataset.epAlan,deger=kisa(el.value,alan==='0'?40:60);
    let brans='';
    await degistir(p=>{const s=p.gunler[g]&&p.gunler[g][r];if(!s)throw new Error('Plan değişti; sayfa yenilendi.');
      if(k!==undefined)s[2][Number(k)]=deger;
      else{s[Number(alan)]=deger;if(alan==='1'&&deger&&!s[0]){brans=kisa(bransBul(p,deger),40);s[0]=brans}}});
    if(el.value!==deger)el.value=deger;
    const b=brans&&hucre(g,r,0);if(b)b.value=brans;
    // The same weekday on another date shows the same names.
    if(k!==undefined)document.querySelectorAll('input[data-ep-g="'+g+'"][data-ep-r="'+r+'"][data-ep-k="'+k+'"]').forEach(i=>{if(i!==el){i.value=deger;ciftIsaretle(i.closest('.ep-kagit'))}});
    if(k!==undefined)ciftIsaretle(el.closest('.ep-kagit'));
  }catch(e){durum(e.message);yenidenCiz()}
});
return {dogrula,oku,degistir,gruplar,ciftler,eksikler,bransBul,ekle,listeCoz,listeUygula,bosSatirlariAt,gunSec,baskiHtml,yazdir,icerik,gorunum,dagit,varsayilanDonem,sinifOnerisi,sinifYaz,sayfala,
  programCoz,programEkle,hocaEsle,dersAilesi,araDers,
  GUNLER,OGRENCI,EN_COK_SATIR,BRANS_SIRA,RESMI_YOK};
})();
function gorunumEtutPlani(){return ETUTPLANI.gorunum()}
