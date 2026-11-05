// Embedded in index.html by scripts/embed-etutetkisi.cjs. No student data belongs here.
// Etüt etkisi (teacher only): do students gain more between two exams when they took etüts in between? It reads the
// merged students of Öğrenci raporları' base (OGRENCI_RAPOR.temelOgrenciler: exams with every lesson's net, etüt
// sessions with date, lesson and teacher) and the Türkiye geneli lists (TURKIYE), so nothing is stored, uploaded or
// sent to students.
// Method (docs/etut-etkisi.md): per lesson and session, a student's Türkiye farkı d = their net − the Türkiye average
// net of that lesson in that exam removes how hard the exam was. For each pair of consecutive exams the student sat:
// g = d₂ − d₁ and e = the etüts of the lesson strictly between the two exam days. Within-student fixed effects:
// g = aᵢ + b·e + c·(d₁ − d̄ᵢ) + ε, fitted by demeaning within the student (only students with at least two pairs),
// so b is the net gained per etüt beyond the student's own usual trend and c absorbs the rebound after a bad exam
// (regression to the mean). The 95% interval of b is a percentile cluster bootstrap over students (1000 resamples,
// fixed seed, so the result is the same every time). The page is a comparison, not proof.
const ETUT_ETKI = (() => {
const OTURUMLAR=['TYT','AYT'];
const EN_AZ=5;            // fewer intervals / students than this: drawn faint, teachers unranked
const EN_AZ_KARAR=8;      // fewer students than this identify the estimate: no verdict
const GENIS_ARALIK=3;     // an interval wider than this many net per etüt says nothing
const BOOT=1000,TOHUM=20261105;
const SON_DENEME=4;
const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const DONEMLER=[['tum','Tümü'],['son4','Son '+SON_DENEME+' deneme']];
const KOVALAR=[0,1,2,3,4];   // etüts in an interval: 0, 1, 2, 3, 4 or more
// The keys of a lesson's net in a student's exam (Öğrenci raporları), by session.
const NET={
  TYT:{Matematik:['mat'],Geometri:['geo'],Fizik:['fizik'],Kimya:['kimya'],Biyoloji:['biyoloji'],'Türkçe':['turkce'],'Coğrafya':['cografya'],Tarih:['tarih'],Felsefe:['felsefe'],'Din Kültürü':['din']},
  AYT:{Matematik:['mat'],Geometri:['geo'],Fizik:['fizik'],Kimya:['kimya'],Biyoloji:['biyoloji'],'Türkçe':['edebiyat'],'Coğrafya':['cografya1','cografya2'],Tarih:['tarih1','tarih2'],Felsefe:['felsefe'],'Din Kültürü':['din']}};
// The same lessons in the Türkiye geneli lists (TURKIYE.DERSLER codes); AYT Coğrafya and Tarih are two parts there too.
const TR_KOD={
  TYT:{Matematik:['MATEMATİK-T'],Geometri:['GEOMETRİ-T'],Fizik:['FİZİK-T'],Kimya:['KİMYA-T'],Biyoloji:['BİYOLOJİ-T'],'Türkçe':['TÜRKÇE-T'],'Coğrafya':['COĞRAFYA-T'],Tarih:['TARİH-T'],Felsefe:['FELSEFE-T'],'Din Kültürü':['DİN KÜLTÜRÜ-T']},
  AYT:{Matematik:['MATEMATİK-A'],Geometri:['GEOMETRİ-A'],Fizik:['FİZİK-A'],Kimya:['KİMYA-A'],Biyoloji:['BİYOLOJİ-A'],'Türkçe':['TÜRK DİLİ VE EDB-A'],'Coğrafya':['COĞRAFYA.1-A','COĞRAFYA.2-A'],Tarih:['TARİH.1-A','TARİH.2-A'],Felsefe:['FELSEFE GR.-A'],'Din Kültürü':['DİN KÜLTÜRÜ-A']}};
const HAM_UYARI='Türkiye geneli listesi yok: ham net artışı kullanıldı; deneme zorluğu ayıklanmadı. Türkiye geneli sayfasından ekleyin.';
const SINIR_YAZI='Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir.';

/* ---------------- small helpers ---------------- */
const U=s=>String(s??'').replace(/\s+/g,' ').trim().normalize('NFKC').toLocaleUpperCase('tr-TR');
const kisiAdi=s=>String(s||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR').split(' ').map(w=>w?w[0].toLocaleUpperCase('tr-TR')+w.slice(1):w).join(' ');
const r2=x=>Math.round(x*100)/100;
const r1=x=>Math.round(x*10)/10;
const f2=x=>Number(x).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fi=x=>Number(x).toLocaleString('tr-TR');
const ok=v=>v===null||v===undefined?'—':(v>0?'▲':v<0?'▼':'')+f2(Math.abs(v));
// +0,4 / −0,3 / 0,0: the sign of what is shown, with n decimals.
function isr(v,n=1){
  const k=10**n,a=Math.round(Math.abs(v)*k)/k,s=Number(a).toLocaleString('tr-TR',{minimumFractionDigits:n,maximumFractionDigits:n});
  return (v>0&&a>0?'+':v<0&&a>0?'−':'')+s;
}
const ort=l=>l.length?l.reduce((t,x)=>t+x,0)/l.length:null;
const yonlu=v=>v===null||v===undefined?'':v>0?' et-yukari':v<0?' et-asagi':'';
const gunAy=g=>{const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]};
const duzeyAl=c=>{const m=/^(\d{1,2})\s*[/-]/.exec(String(c||'').trim());return m?Number(m[1]):null};
// "24'ü", "7'si", "15'i": the number with its possessive ending, by how the number is read.
function sahip(n){
  const son=n%10,onlar=Math.floor(n/10)%10;let ek;
  if(n>0&&n%100===0)ek='ü';
  else if(son)ek=['','i','si','ü','ü','i','sı','si','i','u'][son];
  else ek=onlar?['','u','si','u','ı','si','ı','i','i','ı'][onlar]:'ı';
  return n+'’'+ek;
}

/* ---------------- the Türkiye farkı ---------------- */
// The Türkiye average net of a lesson (kodlar: one list code, or two parts that are summed) in an exam, by the exam's
// name the way TURKIYE.ortalamalar matches it; null when the exam has no list or the list lacks a part.
function trOrtalama(trFn,ad,kodlar){
  if(typeof trFn!=='function'||!kodlar||!kodlar.length)return null;
  let r;try{r=trFn(ad)}catch(e){r=null}
  if(!r||typeof r.genel!=='function')return null;
  let t=0;for(const k of kodlar){const v=r.genel(k);if(!Number.isFinite(v))return null;t+=v}
  return r2(t);
}

/* ---------------- the fixed-effects estimate ---------------- */
// A small seeded generator (mulberry32): the bootstrap gives the same interval every time.
function rastgele(tohum){let a=tohum>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function yuzdelik(sirali,p){const h=(sirali.length-1)*p,a=Math.floor(h),b=Math.ceil(h);return sirali[a]+(sirali[b]-sirali[a])*(h-a)}
// Cluster bootstrap over students. S: one vector of sums per student; f maps the summed vector of a resample to a
// number (or null). Returns the 2.5% and 97.5% percentiles of the resampled values, null with fewer than two students.
function bootstrap(S,f,B=BOOT,tohum=TOHUM){
  const n=S.length;if(n<2)return null;
  const rnd=rastgele(tohum),k=S[0].length,v=[];
  for(let i=0;i<B;i++){
    const t=new Array(k).fill(0);
    for(let j=0;j<n;j++){const s=S[Math.floor(rnd()*n)];for(let q=0;q<k;q++)t[q]+=s[q]}
    const x=f(t);if(x!==null&&Number.isFinite(x))v.push(x);
  }
  if(v.length<B/2)return null;
  v.sort((a,b)=>a-b);return [yuzdelik(v,.025),yuzdelik(v,.975)];
}
// Normal equations of g̃ = b·ẽ + c·d̃ from the summed products [Σẽẽ, Σẽd̃, Σd̃d̃, Σẽg̃, Σd̃g̃] (tilde: minus the student's mean).
// kontrol false: no rebound term (only for showing what the control changes).
function coz(t,kontrol=true){
  const [See,Sed,Sdd,Seg,Sdg]=t;
  if(!(See>1e-9))return null;
  if(!kontrol||!(Sdd>1e-9))return {b:Seg/See,c:0};
  const det=See*Sdd-Sed*Sed;if(!(det>1e-9*See*Sdd))return null;
  return {b:(Sdd*Seg-Sed*Sdg)/det,c:(See*Sdg-Sed*Seg)/det};
}
// listeler: per student the list of intervals {g, d1, …}; eAl(interval) is the etüt count to use. Students with fewer than
// two intervals add nothing (nothing to compare with themself). Returns the estimate b, the rebound coefficient c, the
// 95% interval of b, the students whose etüt count varies between their intervals (they are what identifies b) and the
// intervals in the fit.
function etkiHesapla(listeler,eAl,sec={}){
  const kontrol=sec.kontrol!==false,B=sec.B||BOOT,tohum=sec.tohum||TOHUM,S=[];let aralik=0;
  for(const l of listeler){
    if(l.length<2)continue;
    const e=l.map(eAl),d=l.map(x=>x.d1),g=l.map(x=>x.g),m=v=>ort(v),me=m(e),md=m(d),mg=m(g),t=[0,0,0,0,0];
    for(let i=0;i<l.length;i++){const a=e[i]-me,b=d[i]-md,c=g[i]-mg;t[0]+=a*a;t[1]+=a*b;t[2]+=b*b;t[3]+=a*c;t[4]+=b*c}
    S.push(t);aralik+=l.length;
  }
  const top=[0,0,0,0,0];for(const t of S)for(let q=0;q<5;q++)top[q]+=t[q];
  const r=S.length?coz(top,kontrol):null;
  return {b:r?r.b:null,c:r?r.c:null,ci:r?bootstrap(S,t=>{const q=coz(t,kontrol);return q?q.b:null},B,tohum):null,n:S.filter(t=>t[0]>1e-9).length,ogrenci:S.length,aralik};
}
// The plain sentence for the estimate. Never a cause.
function karar(e){
  if(!e||e.b===null||!e.ci||e.n<EN_AZ_KARAR)return {k:'veri',yazi:'Yeterli veri yok'+(e&&e.n<EN_AZ_KARAR?' (etüt sayısı denemeler arasında değişen '+fi(e.n)+' öğrenci var; en az '+EN_AZ_KARAR+' gerekir)':'')+'.'};
  if(e.ci[1]-e.ci[0]>GENIS_ARALIK)return {k:'veri',yazi:'Yeterli veri yok (tahmin çok belirsiz).'};
  const s=isr(e.b);
  if(e.ci[0]>0)return {k:'var',yazi:'Etüt aldıkça artış belirgin: her etüt ≈ '+s+' net (aynı öğrencinin kendi gidişine göre).'};
  if(e.ci[1]<0)return {k:'az',yazi:'Etüt alınan aralıklarda artış daha az: her etüt ≈ '+s+' net.'};
  return {k:'yok',yazi:'Belirgin bir fark yok.'};
}
// Students with both kinds of intervals: each one's mean gain with ≥1 etüt minus their mean gain with none.
function eslestirme(listeler,B=BOOT,tohum=TOHUM){
  const S=[],x=[];
  for(const l of listeler){
    const a=l.filter(i=>i.e>=1).map(i=>i.g),b=l.filter(i=>i.e===0).map(i=>i.g);
    if(a.length&&b.length){const ma=ort(a),mb=ort(b);S.push([ma-mb,1]);x.push([ma,mb])}
  }
  if(!S.length)return null;
  return {n:S.length,etutlu:ort(x.map(v=>v[0])),etutsuz:ort(x.map(v=>v[1])),fark:ort(S.map(v=>v[0])),ci:bootstrap(S,t=>t[0]/t[1],B,tohum)};
}
// Mean gain of the intervals with 0, 1, 2, 3 and 4+ etüts, each with a student-cluster interval.
function kovalar(listeler,B=BOOT,tohum=TOHUM){
  const S=listeler.filter(l=>l.length).map(l=>{const t=new Array(KOVALAR.length*2).fill(0);for(const i of l){const k=Math.min(i.e,KOVALAR.length-1);t[2*k]+=i.g;t[2*k+1]++}return t});
  return KOVALAR.map(k=>{
    const n=S.reduce((t,s)=>t+s[2*k+1],0),toplam=S.reduce((t,s)=>t+s[2*k],0);
    return {k,ad:k===KOVALAR.length-1?k+'+':String(k),n,az:n<EN_AZ,ort:n?toplam/n:null,ci:n>=2?bootstrap(S,t=>t[2*k+1]>0?t[2*k]/t[2*k+1]:null,B,tohum):null};
  });
}

/* ---------------- model ---------------- */
// An exam is its title and its date: equal titles on different dates stay apart.
const sinavAnahtari=e=>U(e.exam)+'|'+e.date;
// The exams of one grade and session, by date; a title used on more than one date carries its date.
function sinavListesi(ogr,oturum){
  const m=new Map();
  for(const s of ogr)for(const e of s.exams||[])if(e.session===oturum&&e.date){
    const key=sinavAnahtari(e),o=m.get(key)||{key,ad:e.exam,tarih:e.date,n:0};o.n++;m.set(key,o);
  }
  const l=[...m.values()].map(o=>({...o,gun:gunNo(o.tarih)})).sort((a,b)=>a.gun-b.gun||a.ad.localeCompare(b.ad,'tr',{numeric:true}));
  const say=new Map();for(const e of l)say.set(U(e.ad),(say.get(U(e.ad))||0)+1);
  for(const e of l)e.etiket=say.get(U(e.ad))>1?e.ad+' ('+gunAy(e.gun)+')':e.ad;
  return l;
}
// A student's net in a lesson in an exam; null when the exam or the lesson is missing.
function netAl(s,ex,oturum,ders){
  const e=(s.exams||[]).find(x=>x.session===oturum&&sinavAnahtari(x)===ex.key);if(!e||!e.nets)return null;
  const v=(NET[oturum][ders]||[]).map(k=>e.nets[k]).filter(Number.isFinite);
  return v.length?r2(v.reduce((a,b)=>a+b,0)):null;
}
// An etüt of "MATEMATİK TYT" counts for TYT only, "… AYT" for AYT only, a lesson without either for both.
function etutOturum(course,oturum){
  const k=U(course),t=/\bTYT\b/.test(k),a=/\bAYT\b/.test(k);
  return (!t&&!a)||(oturum==='TYT'?t:a);
}
// Weekdays after bas and before son that no added etüt report covers; null when the coverage is unknown.
function eksikGun(bas,son,kapsam){
  if(!Array.isArray(kapsam))return null;let n=0;
  for(let g=bas+1;g<son;g++)if(haftaGunu(g)<5&&!kapsam.some(([a,b])=>g>=a&&g<=b))n++;
  return n;
}
// The least-squares slope through points [[x, y], …] (used for the colour of a student's small line). null with fewer than two points.
function egim(points){
  const l=(points||[]).filter(p=>p&&Number.isFinite(p[0])&&Number.isFinite(p[1]));if(l.length<2)return null;
  const mx=ort(l.map(p=>p[0])),my=ort(l.map(p=>p[1]));let sxy=0,sxx=0;
  for(const p of l){sxy+=(p[0]-mx)*(p[1]-my);sxx+=(p[0]-mx)**2}
  return sxx?sxy/sxx:null;
}
// The etüts of a lesson a student took strictly between two days (the exam days themselves are not counted),
// in total and by teacher.
function ogrenciEtut(s,oturum,ders,bas,son){
  const hoca={};let n=0;
  for(const x of s.sessions||[]){
    if(!x.date)continue;const g=gunNo(x.date);
    if(g<=bas||g>=son||ETUT.dersAdi(x.course)!==ders||!etutOturum(x.course,oturum))continue;
    const k=U(x.teacher)||'?';n++;hoca[k]=(hoca[k]||0)+1;
  }
  return {n,hoca};
}
// The days of the weeks (Monday first) from bas to son, each with the etüts of the lesson in it.
function haftalikEtut(ogr,oturum,ders,bas,son){
  const hafta=new Map();
  for(let g=bas-haftaGunu(bas);g<=son;g+=7)hafta.set(g,0);
  for(const s of ogr)for(const x of s.sessions||[]){
    if(!x.date)continue;const g=gunNo(x.date);
    if(g<=bas||g>=son||ETUT.dersAdi(x.course)!==ders||!etutOturum(x.course,oturum))continue;
    const h=g-haftaGunu(g);hafta.set(h,(hafta.get(h)||0)+1);
  }
  return [...hafta].map(([h,n])=>({bas:h,son:h+6,n}));
}
/* ---------------- total change since the etüt (the main measure) ---------------- */
const EN_AZ_KONTROL=3;   // a start–end pair with fewer controls borrows its intercept from the pooled one
const GENIS_FARK=6;      // a 95% interval wider than this many net says nothing
// The expected change of a student with no etüt: change = a_pair + b·d_start. b is shared and pooled over all pairs (each pair
// demeaned within itself), a_pair is the pair's own intercept. A pair with n < 3 controls borrows: a = (n/3)·own + (1 − n/3)·pooled,
// so a pair with none uses the pooled intercept. gozlem: [{p, x (d at the start), y (change)}]. null without any control.
function beklenenModel(gozlem){
  if(!gozlem.length)return null;
  const g=new Map();for(const o of gozlem){if(!g.has(o.p))g.set(o.p,[]);g.get(o.p).push(o)}
  let sxx=0,sxy=0;
  for(const l of g.values()){if(l.length<2)continue;const mx=ort(l.map(o=>o.x)),my=ort(l.map(o=>o.y));for(const o of l){sxx+=(o.x-mx)**2;sxy+=(o.x-mx)*(o.y-my)}}
  const b=sxx>1e-9?sxy/sxx:0,mx=ort(gozlem.map(o=>o.x)),my=ort(gozlem.map(o=>o.y)),havuz=my-b*mx,a=new Map();
  for(const [p,l] of g){const kendi=ort(l.map(o=>o.y))-b*ort(l.map(o=>o.x)),w=Math.min(1,l.length/EN_AZ_KONTROL);a.set(p,w*kendi+(1-w)*havuz)}
  return {b,havuz,a,n:gozlem.length,cift:g.size,tahmin:(p,x)=>(a.has(p)?a.get(p):havuz)+b*x};
}
function kararToplam(o){
  if(!o||o.ci===null||o.ci===undefined||o.n<EN_AZ_KARAR)return {k:'veri',yazi:'Yeterli veri yok'+(o&&o.n<EN_AZ_KARAR?' (etüt alıp sonrasında denemeye giren '+fi(o.n)+' öğrenci var; en az '+EN_AZ_KARAR+' gerekir)':'')+'.'};
  if(o.ci[1]-o.ci[0]>GENIS_FARK)return {k:'veri',yazi:'Yeterli veri yok (tahmin çok belirsiz).'};
  const lo=Math.round(o.ci[0]*1e6)/1e6,hi=Math.round(o.ci[1]*1e6)/1e6;
  if(lo>0)return {k:'var',yazi:'Etüt aldıktan sonra artış belirgin: etüt alanlar beklenenden ortalama '+isr(o.fark)+' net fazla arttı.'};
  if(hi<0)return {k:'az',yazi:'Etüt alanlar beklenenden daha az arttı: ortalama '+isr(o.fark)+' net.'};
  return {k:'yok',yazi:'Belirgin bir fark yok.'};
}
// Every student who took an etüt of the lesson: d at the last exam before their first etüt (the first exam of the period when the
// etüt came earlier, marked), d at the latest exam after it, the total change, what a student with no etüt and the same start
// changed by, the difference, and the share of each teacher in their etüts up to that last exam. satir: the students with an
// interval; the others are listed apart by the caller (disarida).
function toplamDegisim({satir,ex,oturum,ders,son,disarida}){
  const gunler=new Set(ex.map(e=>e.gun)),satirlar=[];
  for(const r of satir){
    const e=(r._s.sessions||[]).filter(x=>x.date&&ETUT.dersAdi(x.course)===ders&&etutOturum(x.course,oturum)).map(x=>({g:gunNo(x.date),hoca:U(x.teacher)||'?',ad:x.teacher}))
      .filter(x=>!gunler.has(x.g)&&x.g<son).sort((a,b)=>a.g-b.g);
    r.etutler=e;
    if(!e.length)continue;
    const g0=e[0].g,d=r.dizi;let bi=-1,isaret=false,si=-1;
    for(let i=0;i<ex.length;i++)if(d[i]!==null&&ex[i].gun<g0)bi=i;
    if(bi<0){bi=d.findIndex(v=>v!==null);isaret=true}
    for(let i=ex.length-1;i>bi;i--)if(d[i]!==null){si=i;break}
    if(si<0){disarida.push({id:r._s.id,ad:r._s.name,sinif:r._s.cls,neden:'etütten sonra deneme yok'});continue}
    const ge=ex[si].gun,pencere=e.filter(x=>x.g<ge),sayilar={},adlar={};
    for(const x of pencere){sayilar[x.hoca]=(sayilar[x.hoca]||0)+1;adlar[x.hoca]=adlar[x.hoca]||kisiAdi(x.ad)||'Öğretmen belirtilmemiş'}
    const hoca={};for(const k of Object.keys(sayilar))hoca[k]=sayilar[k]/pencere.length;
    let isx=0;for(let i=0;i<ex.length-1;i++)if(g0>=ex[i].gun)isx=i+Math.min(1,(g0-ex[i].gun)/Math.max(1,ex[i+1].gun-ex[i].gun));
    satirlar.push({r,bi,si,p:bi+'|'+si,hoca,sayilar,adlar,n:pencere.length,isaret,isx});
  }
  // Controls: students with no etüt of the lesson before the end of the pair, who sat both exams.
  const gozlem=[],ciftler=new Map(satirlar.map(q=>[q.p,q]));
  for(const q of ciftler.values())for(const r of satir){
    if(r.etutler.some(x=>x.g<ex[q.si].gun))continue;
    const d=r.dizi;if(d[q.bi]===null||d[q.si]===null)continue;
    gozlem.push({p:q.p,x:d[q.bi],y:d[q.si]-d[q.bi]});
  }
  const model=beklenenModel(gozlem),ogrenciler=[];
  for(const q of satirlar){
    const r=q.r,d=r.dizi,toplam=d[q.si]-d[q.bi],bek=model?model.tahmin(q.p,d[q.bi]):null;
    ogrenciler.push({id:r.id,no:r.no,ad:r.ad,sinif:r.sinif,n:q.n,hoca:q.hoca,sayilar:q.sayilar,adlar:q.adlar,onceAd:ex[q.bi].etiket,onceD:d[q.bi],onceIlk:q.isaret,sonAd:ex[q.si].etiket,sonD:d[q.si],
      toplam:r2(toplam),beklenen:bek===null?null:r2(bek),fark:bek===null?null:r2(toplam-bek),dizi:d,isaret:q.isx,_egim:r._egim,_fark:bek===null?null:toplam-bek});
  }
  const kayit=ogrenciler.filter(o=>o.fark!==null);
  const ozet=kayit.length?{n:kayit.length,toplam:ort(kayit.map(o=>o.toplam)),beklenen:ort(kayit.map(o=>o.beklenen)),fark:ort(kayit.map(o=>o._fark)),
    ci:bootstrap(kayit.map(o=>[o._fark,1]),t=>t[0]/t[1])}:null;
  // The pocket of each teacher: the sum of their share of every student's difference; per student the weighted mean.
  const adlar=new Map();for(const o of ogrenciler)for(const k of Object.keys(o.hoca))if(!adlar.has(k))adlar.set(k,o.adlar[k]);
  const hocalar=[...adlar].map(([key,ad])=>{
    const l=kayit.filter(o=>o.hoca[key]),S=l.map(o=>[o.hoca[key]*o._fark,o.hoca[key]]),t=S.reduce((a,v)=>a+v[0],0),w=S.reduce((a,v)=>a+v[1],0);
    return {key,ad,n:l.length,etut:ogrenciler.filter(o=>o.hoca[key]).reduce((a,o)=>a+o.sayilar[key],0),toplam:l.length?t:null,ort:w>0?t/w:null,ci:bootstrap(S,v=>v[1]>0?v[0]/v[1]:null),az:l.length<EN_AZ};
  });
  const tSayi=h=>h.toplam===null?-Infinity:h.toplam;
  hocalar.sort((a,b)=>a.az-b.az||tSayi(b)-tSayi(a)||b.n-a.n||a.ad.localeCompare(b.ad,'tr'));
  hocalar.forEach((h,i)=>{h.sira=h.az?null:i>0&&!hocalar[i-1].az&&r2(hocalar[i-1].toplam)===r2(h.toplam)?hocalar[i-1].sira:i+1});
  const kontrol=satir.filter(r=>!r.etutler||!r.etutler.length).length;
  return {ogrenciler,hocalar,ozet,karar:kararToplam(ozet),kontrol,model:model&&{b:model.b,cift:model.cift,n:model.n}};
}
// sec: {duzey, oturum, ders, donem ('tum' or 'son4'), hoca}; kapsam: the [first, last] days of the added etüt reports;
// trFn: TURKIYE.ortalamalar(list), or null without a Türkiye geneli list.
// The default period is every exam of the grade and session; 'son4' keeps the last four.
function model(ogr,sec={},kapsam,trFn){
  const L=(ogr||[]).filter(s=>s&&Array.isArray(s.exams)),say=new Map();
  for(const s of L){const d=duzeyAl(s.cls);if(!d||!s.exams.length)continue;const o=say.get(d)||{d,etut:0};o.etut+=(s.sessions||[]).length;say.set(d,o)}
  const duzeyler=[...say.keys()].sort((a,b)=>b-a);
  if(!duzeyler.length)return {durum:'bos'};
  // The grade whose students took the most etüts is the default.
  const duzey=duzeyler.includes(sec.duzey)?sec.duzey:[...say.values()].sort((a,b)=>b.etut-a.etut||b.d-a.d)[0].d;
  const ogrD=L.filter(s=>duzeyAl(s.cls)===duzey),oturumlar=OTURUMLAR.filter(o=>sinavListesi(ogrD,o).length>=2);
  if(!oturumlar.length)return {durum:'az',duzeyler,duzey,oturumlar,oturum:null};
  const oturum=oturumlar.includes(sec.oturum)?sec.oturum:oturumlar[0],tum=sinavListesi(ogrD,oturum);
  const donem=sec.donem==='son4'?'son4':'tum',ex=donem==='son4'?tum.slice(-SON_DENEME):tum,bas=ex[0].gun,son=ex[ex.length-1].gun;
  // The lessons with an etüt in the period, most first.
  const ara=new Map();
  for(const s of ogrD)for(const x of s.sessions||[]){
    if(!x.date)continue;const g=gunNo(x.date),d=ETUT.dersAdi(x.course);
    if(g>bas&&g<son&&NET[oturum][d]&&etutOturum(x.course,oturum))ara.set(d,(ara.get(d)||0)+1);
  }
  const dersler=[...ara].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'tr')).map(([ders,n])=>({ders,n}));
  const taban={durum:'tamam',duzeyler,duzey,oturumlar,oturum,donem,sinavlar:ex,dersler};
  if(!dersler.length)return {...taban,durum:'etutyok',ders:null};
  const ders=dersler.some(x=>x.ders===sec.ders)?sec.ders:dersler[0].ders;
  // The Türkiye average of the lesson in each exam. No exam with a list: the raw net stands in (kip 'ham').
  const kodlar=(TR_KOD[oturum]||{})[ders]||[],ref=ex.map(e=>trOrtalama(trFn,e.ad,kodlar));
  const kip=ref.some(v=>v!==null)?'turkiye':'ham',listesiz=kip==='turkiye'?ex.filter((_,i)=>ref[i]===null).map(e=>e.etiket):[];
  const satir=[],disarida=[];
  for(const s of ogrD){
    const netler=ex.map(e=>netAl(s,e,oturum,ders)),dizi=netler.map((v,i)=>v===null?null:kip==='ham'?v:ref[i]===null?null:r2(v-ref[i]));
    const anahtar=new Set(ex.map(e=>e.key)),girdi=new Set((s.exams||[]).filter(e=>e.session===oturum&&e.date&&anahtar.has(sinavAnahtari(e))).map(sinavAnahtari)).size;
    const oturduklari=[];netler.forEach((v,i)=>{if(v!==null)oturduklari.push(i)});
    // Each pair of consecutive exams the student sat; a pair that touches an exam without a Türkiye list is not counted.
    const ar=[];
    for(let q=1;q<oturduklari.length;q++){
      const a=oturduklari[q-1],b=oturduklari[q];if(dizi[a]===null||dizi[b]===null)continue;
      const e=ogrenciEtut(s,oturum,ders,ex[a].gun,ex[b].gun);
      ar.push({a,b,d1:dizi[a],d2:dizi[b],g:r2(dizi[b]-dizi[a]),e:e.n,hoca:e.hoca,gun:ex[b].gun-ex[a].gun});
    }
    if(!ar.length){
      disarida.push({id:s.id,ad:s.name,sinif:s.cls,neden:girdi===0?'bu dönemde denemeye girmedi':girdi===1?'yalnızca 1 denemeye girdi':oturduklari.length<2?'bu dersin neti yok':'Türkiye listesi olan iki deneme yok'});continue;
    }
    const hoca={};for(const i of ar)for(const [k,n] of Object.entries(i.hoca))hoca[k]=(hoca[k]||0)+n;
    const var_=ar.filter(i=>i.e>=1).map(i=>i.g),yok=ar.filter(i=>i.e===0).map(i=>i.g);
    satir.push({id:s.id,no:s.no,ad:s.name,sinif:s.cls,aralik:ar.length,n:ar.reduce((t,i)=>t+i.e,0),hoca,etutlu:var_.length?r2(ort(var_)):null,etutsuz:yok.length?r2(ort(yok)):null,
      dizi,_egim:egim(dizi.map((v,i)=>v===null?null:[i,v]).filter(Boolean)),ar,_s:s});
  }
  const listeler=satir.map(r=>r.ar),etki=etkiHesapla(listeler,i=>i.e);
  etki.karar=karar(etki);
  const toplamAralik=satir.reduce((t,r)=>t+r.aralik,0);
  const hepsi=satir.map(({ar,_s,...r})=>r);
  const top=toplamDegisim({satir,ex,oturum,ders,son,disarida,kapsam:null});
  return {...taban,ders,kip,listesiz,ogrenciler:top.ogrenciler,hocalar:top.hocalar,ozet:top.ozet,karar:top.karar,kontrol:top.kontrol,beklenen:top.model,hepsi,disarida,toplamOgrenci:ogrD.length,
    aralik:toplamAralik,etki,esli:eslestirme(listeler),cubuklar:kovalar(listeler),haftalik:haftalikEtut(ogrD,oturum,ders,bas,son),eksik:eksikGun(bas,son,kapsam)};
}

/* ---------------- the school's standing (Türkiye geneli) ---------------- */
// The yüzdelik dilim helpers of TURKIYE when it has them, else the same formula here: dilim = 100·(1−Φ((T−50)/10)).
function normCdf(x){
  const t=1/(1+.3275911*Math.abs(x)/Math.SQRT2),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x/2);
  return x>=0?.5+y/2:.5-y/2;
}
function dilimler(T=typeof TURKIYE==='object'&&TURKIYE?TURKIYE:{}){
  const f=n=>typeof T[n]==='function'?T[n]:null;
  const yerel={
    nokta:p=>p&&Number.isFinite(p.t)?100*(1-normCdf((p.t-50)/10)):null,
    sayi:d=>{if(!Number.isFinite(d))return '—';const r=Math.round(d*10)/10;return r>=10?fi(Math.min(100,Math.round(d))):Number(Math.max(.1,r)).toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1})},
    // the T that stands for a dilim: found by halving, Φ is monotone
    tden:d=>{let a=0,b=100;for(let i=0;i<40;i++){const m=(a+b)/2;if(100*(1-normCdf((m-50)/10))>d)a=m;else b=m}return(a+b)/2}};
  const nokta=f('dilimNokta')||yerel.nokta,tden=f('dilimdenT')||yerel.tden;
  const yazi=f('dilimYazi')||(d=>d===null||d===undefined||!Number.isFinite(d)?'—':'ilk %'+yerel.sayi(d)),kisa=f('dilimKisa')||(d=>d===null||d===undefined||!Number.isFinite(d)?'—':'%'+yerel.sayi(d));
  const tikler=Array.isArray(T.DILIM_TIKLARI)?T.DILIM_TIKLARI:[0.1,1,5,15,30,50,70,85,95];
  return {nokta,yazi,kisa,tikler,tden:d=>tden(Math.min(99.9,Math.max(.05,d))),yerelMi:!f('dilimNokta')};
}
const DURUS_PAYI=[3,7];   // days either side of the period in which a Türkiye list's date still belongs to it
// The lesson's line(s) on the Türkiye geneli page for the grade's group and session: the school's dilim in each exam of the
// period, and under it (same dates) the weekly etüts of the lesson. tv: the stored Türkiye geneli data (TURKIYE.oku().veri).
function durus(ogrD,m,tv){
  const yok=neden=>({durum:'yok',neden});
  if(!tv)return yok('Bu sınıf için Türkiye geneli listesi eklenmemiş.');
  let tm;try{tm=TURKIYE.model(tv,{duzey:'d'+m.duzey,oturum:m.oturum})}catch(e){return yok('Türkiye geneli listesi okunamadı.')}
  if(!tm||tm.duzey!=='d'+m.duzey||tm.oturum!==m.oturum||!tm.sinavlar.length)return yok(m.duzey+'. sınıf '+m.oturum+' için Türkiye geneli listesi eklenmemiş.');
  const D=dilimler(),ex=m.sinavlar,a=ex[0].gun-DURUS_PAYI[0],b=ex[ex.length-1].gun+DURUS_PAYI[1],ad=TURKIYE.dersBilgi;
  const kodlar=(TR_KOD[m.oturum]||{})[m.ders]||[],cizgiler=[];
  kodlar.forEach((kod,q)=>{
    const d=tm.dersler.find(x=>denemeAdAnahtari(x.kod)===denemeAdAnahtari(kod));if(!d)return;
    const nokta=[];
    tm.sinavlar.forEach((s,i)=>{
      const dil=D.nokta(d.seri[i]);if(!Number.isFinite(s.g)||s.g<a||s.g>b||!Number.isFinite(dil))return;
      nokta.push({g:s.g,sinav:s.ad,dilim:dil,t:D.tden(dil)});
    });
    if(nokta.length)cizgiler.push({kod,ad:kodlar.length>1?ad(kod).ad:m.ders,renk:'var(--e-c'+(q+1)+')',nokta});
  });
  if(!cizgiler.length)return yok('Okul bu derste Türkiye geneli listesinde bulunamadı; Türkiye geneli sayfasında okulu seçin.');
  const g=cizgiler.flatMap(c=>c.nokta.map(p=>p.g)),g0=Math.min(...g),g1=Math.max(...g);
  return {durum:'tamam',cizgiler,g0,g1,haftalik:haftalikEtut(ogrD,m.oturum,m.ders,g0,g1),yerelDilim:D.yerelMi};
}

/* ---------------- charts ---------------- */
// Ticks for a range: about n steps of 1, 2, 2.5 or 5 (times a power of ten).
function tikler(lo,hi,n){
  const ham=(hi-lo||1)/n,us=10**Math.floor(Math.log10(ham)),adim=[1,2,2.5,5,10].map(k=>k*us).find(a=>a>=ham)||10*us,l=[];
  for(let v=Math.floor(lo/adim)*adim;v<hi+adim*.999;v+=adim){l.push(Math.round(v*1e6)/1e6);if(l.length>12)break}
  return l;
}
const yaziGen=t=>String(t).length*6.8+4;
const sayiEtiket=t=>Number.isInteger(t)?fi(t):String(t).replace('.',',');
// "Etüt aldıkça artış": the mean gain of the intervals with 0, 1, 2, 3 and 4+ etüts, each with its 95% whiskers and the
// number of intervals under it; a bar from fewer than EN_AZ intervals is faint. The zero line is the reference.
function artisSvg(m,W){
  const c=m.cubuklar,dar=W<520,deger=c.flatMap(k=>k.ort===null?[]:[k.ort,...(k.ci||[])]),lo0=Math.min(0,...deger),hi0=Math.max(0,...deger),pay=Math.max(.3,(hi0-lo0)*.12);
  const tik=tikler(lo0-(lo0<0?pay:0),hi0+pay,dar?4:5),lo=tik[0],hi=tik[tik.length-1],L=Math.max(...tik.map(t=>yaziGen(sayiEtiket(t))))+6,R=W-10,ust=18,ph=dar?180:220,alt=ust+ph;
  const y=v=>alt-(v-lo)/(hi-lo)*ph,slot=(R-L)/c.length,bw=Math.min(64,slot*.58),cx=i=>L+slot*(i+.5),H=alt+62;
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Etüt aldıkça artış">';
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+r1(L-6)+'" y="'+r1(y(t))+'" dy="0.32em" text-anchor="end">'+sayiEtiket(t)+'</text>').join('');
  svg+='<line class="et-eksen ee-sifir" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(0))+'" y2="'+r1(y(0))+'"/>';
  c.forEach((k,i)=>{
    const x=cx(i),bas=y(0);
    if(k.ort!==null){
      const ucY=y(k.ort),top=Math.min(bas,ucY),h=Math.max(1,Math.abs(bas-ucY)),ip=kacis(k.ad+' etüt · '+fi(k.n)+' deneme arası · ortalama '+isr(k.ort,2)+' net'+(k.ci?' (olası aralık '+isr(k.ci[0],2)+' … '+isr(k.ci[1],2)+')':''));
      svg+='<g class="ee-kova'+(k.az?' az':'')+'"><rect class="ee-sutun" x="'+r1(x-bw/2)+'" y="'+r1(top)+'" width="'+r1(bw)+'" height="'+r1(h)+'" rx="2"><title>'+ip+'</title></rect>';
      if(k.ci)svg+='<line class="ee-biyik" x1="'+r1(x)+'" x2="'+r1(x)+'" y1="'+r1(y(k.ci[0]))+'" y2="'+r1(y(k.ci[1]))+'"/><line class="ee-biyik" x1="'+r1(x-6)+'" x2="'+r1(x+6)+'" y1="'+r1(y(k.ci[0]))+'" y2="'+r1(y(k.ci[0]))+'"/><line class="ee-biyik" x1="'+r1(x-6)+'" x2="'+r1(x+6)+'" y1="'+r1(y(k.ci[1]))+'" y2="'+r1(y(k.ci[1]))+'"/>';
      const ustte=k.ort>=0,uc=k.ci?(ustte?y(k.ci[1]):y(k.ci[0])):ucY;
      svg+='<text class="ee-deger" x="'+r1(x)+'" y="'+r1(ustte?uc-6:uc+14)+'" text-anchor="middle">'+isr(k.ort,2)+'</text></g>';
    }
    svg+='<text class="ee-kova-ad" x="'+r1(x)+'" y="'+(alt+18)+'" text-anchor="middle">'+k.ad+'</text><text class="et-tik ee-say" x="'+r1(x)+'" y="'+(alt+34)+'" text-anchor="middle">'+(k.n?'n = '+fi(k.n):'yok')+'</text>';
  });
  svg+='<text class="ee-baslik" x="'+r1((L+R)/2)+'" y="'+(alt+54)+'" text-anchor="middle">'+(dar?'İki deneme arasındaki etüt sayısı (altta: kaç deneme arası)':'İki deneme arasında alınan etüt sayısı (altta: kaç deneme arası)')+'</text>';
  return svg+'</svg>';
}
// The school's dilim in the lesson (above is better) with the weekly etüts of the lesson beneath on the same dates. W is the
// box's real width in pixels, so the type is real pixels too.
function durusSvg(st,W){
  const D=dilimler(),dar=W<520,seriler=st.cizgiler.map(c=>({...c,son:c.nokta[c.nokta.length-1]}));
  for(const s of seriler)s.yazi=(seriler.length>1?s.ad+' · ':'')+D.yazi(s.son.dilim);
  const ts=seriler.flatMap(s=>s.nokta.map(p=>p.t));let lo=Math.min(...ts)-4,hi=Math.max(...ts)+4,tik;
  for(let i=0;i<8;i++){tik=D.tikler.map(d=>({d,t:D.tden(d)})).filter(x=>x.t>=lo&&x.t<=hi);if(tik.length>=3)break;lo-=4;hi+=4}
  const g0=st.g0,g1=st.g1,etiketGen=Math.max(...seriler.map(s=>yaziGen(s.yazi))),L=Math.max(...tik.map(x=>yaziGen(D.kisa(x.d))),20)+8,R=Math.max(L+120,W-etiketGen-26),ust=14,ph=dar?190:230,alt=ust+ph;
  const x=g=>L+(g1===g0?.5:(g-g0)/(g1-g0))*(R-L),y=t=>alt-(t-lo)/(hi-lo)*ph,sol=alt+22,sUst=sol+14,taban=sUst+54,H=taban+10;
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Okulun Türkiye\'deki yeri ve haftalık etüt sayısı">';
  svg+=tik.map(k=>'<line class="et-izgara" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(k.t))+'" y2="'+r1(y(k.t))+'"/><text class="et-tik" x="'+r1(L-6)+'" y="'+r1(y(k.t))+'" dy="0.32em" text-anchor="end">'+D.kisa(k.d)+'</text>').join('');
  const tarih=[...new Set(seriler.flatMap(s=>s.nokta.map(p=>p.g)))].sort((a,b)=>a-b);
  let sonX=-99;const yazilan=[];
  tarih.forEach((g,i)=>{const cx=x(g);if(cx-sonX>=48){yazilan.push(g);sonX=cx}else if(i===tarih.length-1){yazilan.pop();yazilan.push(g);sonX=cx}});
  svg+=tarih.map(g=>'<line class="et-izgara ee-sinav" x1="'+r1(x(g))+'" x2="'+r1(x(g))+'" y1="'+ust+'" y2="'+taban+'"/>').join('');
  svg+='<line class="et-eksen" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+alt+'" y2="'+alt+'"/>';
  svg+=yazilan.map(g=>'<text class="et-tik" x="'+r1(x(g))+'" y="'+(alt+17)+'" text-anchor="middle">'+gunAy(g)+'</text>').join('');
  for(const s of seriler){
    const pts=s.nokta.map(p=>[x(p.g),y(p.t)]);
    if(pts.length>1)svg+='<path class="ee-cizgi" style="stroke:'+s.renk+'" d="'+GRAFIK_CIZGI.yol(pts)+'"/>';
    svg+=s.nokta.map((p,i)=>'<circle class="ee-nokta" cx="'+r1(pts[i][0])+'" cy="'+r1(pts[i][1])+'" r="4" style="fill:'+s.renk+'"><title>'+kacis(p.sinav+' · '+(seriler.length>1?s.ad+' · ':'')+D.yazi(p.dilim))+'</title></circle>').join('');
  }
  // Direct labels at the right end, pushed apart when two lines end close together.
  const blok=seriler.map(s=>({s,h:15,ideal:y(s.son.t)})).sort((a,b)=>a.ideal-b.ideal);
  let alta=ust-8;for(const b of blok){b.ust=Math.max(b.ideal-7.5,alta+3);alta=b.ust+b.h}
  const tasma=alta-(alt+8);if(tasma>0)for(let i=blok.length-1;i>=0;i--){const kalan=i===blok.length-1?alt+8:blok[i+1].ust-3;blok[i].ust=Math.min(blok[i].ust,kalan-blok[i].h)}
  for(const b of blok){
    const s=b.s,ly=b.ust+7.5,ex_=x(s.son.g);
    if(Math.abs(ly-b.ideal)>2||ex_<R-1)svg+='<line class="ee-bag" style="stroke:'+s.renk+'" x1="'+r1(ex_+5)+'" y1="'+r1(b.ideal)+'" x2="'+r1(R+10)+'" y2="'+r1(ly)+'"/>';
    svg+='<g class="ee-etiket"><circle cx="'+r1(R+14)+'" cy="'+r1(ly)+'" r="4" style="fill:'+s.renk+'"/><text class="ee-ad" x="'+r1(R+24)+'" y="'+r1(ly)+'" dy="0.32em">'+kacis(s.yazi)+'</text></g>';
  }
  // Weekly etüts, from zero, a bar for the days of the week that fall inside the span.
  const hafta=st.haftalik,en=Math.max(1,...hafta.map(h=>h.n)),bh=34;
  svg+='<text class="ee-baslik" x="'+r1(L)+'" y="'+(sUst-2)+'">Haftalık etüt</text>';
  svg+=hafta.map(h=>{
    const a=x(Math.max(h.bas,g0)),b=x(Math.min(h.son+1,g1)),hh=h.n/en*bh;if(b-a<3||!h.n)return '';
    return '<rect class="ee-cubuk" x="'+r1(a+1)+'" y="'+r1(taban-hh)+'" width="'+r1(b-a-2)+'" height="'+r1(hh)+'" rx="2"><title>'+kacis(gunAy(Math.max(h.bas,g0))+' – '+gunAy(Math.min(h.son,g1))+' · '+fi(h.n)+' etüt')+'</title></rect>'+
      (b-a>=22?'<text class="et-tik" x="'+r1((a+b)/2)+'" y="'+r1(taban-hh-4)+'" text-anchor="middle">'+fi(h.n)+'</text>':'');
  }).join('');
  svg+='<line class="et-eksen" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+taban+'" y2="'+taban+'"/>';
  return svg+'</svg>';
}
// "Etüt sonrası fark": one bar per student who took etüts, their total change since the first etüt minus what a student with no
// etüt and the same start changed by (up: more than expected, down: less); sorted, with the zero line (= as expected) and the
// mean as a dashed line, both named at the right.
function farkSvg(m,W){
  const l=m.ogrenciler.filter(o=>o.fark!==null).sort((a,b)=>b._fark-a._fark||a.ad.localeCompare(b.ad,'tr')),ozet=m.ozet,dar=W<520;
  const v=l.map(o=>o._fark),lo0=Math.min(0,...v,ozet.fark),hi0=Math.max(0,...v,ozet.fark),pay=Math.max(.5,(hi0-lo0)*.1);
  const tik=tikler(lo0-(lo0<0?pay:0),hi0+pay,dar?4:5),lo=tik[0],hi=tik[tik.length-1],ort_=isr(ozet.fark,1),etiket=['ortalama '+ort_,'beklenen'];
  const L=Math.max(...tik.map(t=>yaziGen(sayiEtiket(t))))+6,R=Math.max(L+80,W-Math.max(...etiket.map(yaziGen))-18),ust=14,ph=dar?190:240,alt=ust+ph,H=alt+8;
  const y=x=>alt-(x-lo)/(hi-lo)*ph,slot=(R-L)/l.length,bw=Math.max(2,Math.min(22,slot*.72));
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Her öğrencinin etüt sonrası farkı">';
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+r1(L-6)+'" y="'+r1(y(t))+'" dy="0.32em" text-anchor="end">'+sayiEtiket(t)+'</text>').join('');
  svg+=l.map((o,i)=>{
    const x=L+slot*(i+.5),a=y(Math.max(0,o._fark)),b=y(Math.min(0,o._fark));
    return '<rect class="ee-fark '+(o._fark>=0?'ee-yukari':'ee-asagi')+'" x="'+r1(x-bw/2)+'" y="'+r1(a)+'" width="'+r1(bw)+'" height="'+r1(Math.max(1,b-a))+'" rx="1.5"><title>'+kacis(kisiAdi(o.ad)+' · toplam '+isr(o.toplam,2)+', beklenen '+isr(o.beklenen,2)+', fark '+isr(o.fark,2)+' net')+'</title></rect>';
  }).join('');
  svg+='<line class="et-eksen ee-sifir" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(0))+'" y2="'+r1(y(0))+'"/>';
  svg+='<line class="ee-ortcizgi" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(ozet.fark))+'" y2="'+r1(y(ozet.fark))+'"/>';
  let ym=y(ozet.fark),y0=y(0);if(Math.abs(ym-y0)<15)ym=ym<=y0?y0-8:y0+8;
  svg+='<text class="ee-ad" x="'+r1(R+6)+'" y="'+r1(ym)+'" dy="0.32em">'+kacis(etiket[0])+'</text><text class="et-tik" x="'+r1(R+6)+'" y="'+r1(y0+(ym<y0?7:-7)+(Math.abs(ym-y0)<15?0:0))+'" dy="0.32em">beklenen</text>';
  return svg+'</svg>';
}
let SON=null,ZAMAN=null;
const etkin=()=>EK.sekme==='etutetki'&&rehberMi()&&!!document.getElementById?.('eeKok');
function grafikleriCiz(){
  if(!etkin()||!SON)return;
  const {m,st}=SON,tur=GRAFIK_CIZGI.tur();
  const cizim=(secici,imza,yap)=>{
    const kutu=document.querySelector(secici);if(!kutu)return;
    const W=Math.round(kutu.clientWidth);if(W<200)return;
    const im=[W,m.duzey,m.oturum,m.ders,m.donem,m.kip,imza,tur].join('|');
    if(kutu.dataset.imza===im)return;
    kutu.dataset.imza=im;kutu.innerHTML=yap(W);
  };
  if(m.ozet)cizim('#eeFark .et-grafik',m.ogrenciler.map(o=>o.fark).join(),W=>farkSvg(m,W));
  cizim('#eeArtis .et-grafik',m.cubuklar.map(c=>c.n+':'+c.ort+':'+(c.ci||[]).join()).join(),W=>artisSvg(m,W));
  if(st.durum==='tamam')cizim('#eeGrafik .et-grafik',st.cizgiler.map(c=>c.nokta.map(p=>p.g+':'+p.dilim).join()).join('/')+'|'+st.haftalik.map(h=>h.n).join(),W=>durusSvg(st,W));
}
function cizimPlanla(){if(typeof window==='undefined'||!window.requestAnimationFrame)return;window.cancelAnimationFrame(ZAMAN);ZAMAN=window.requestAnimationFrame(grafikleriCiz)}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('resize',cizimPlanla);

/* ---------------- page ---------------- */
const secim=(ad,deger,secenekler,etiket)=>'<div class="et-seg" role="group" aria-label="'+etiket+'"><span class="et-seg-label">'+etiket+'</span>'+
  secenekler.map(([v,yazi,kapali])=>'<button type="button" data-ee-'+ad+'="'+kacis(v)+'" aria-pressed="'+(String(v)===String(deger))+'"'+(kapali?' disabled':'')+'>'+kacis(yazi)+'</button>').join('')+'</div>';
function secimler(){return {duzey:EK.eeDuzey,oturum:EK.eeOturum,ders:EK.eeDers,donem:EK.eeDonem}}
function arac(m){
  const sel=(id,ad,l,deger)=>'<label class="et-seg"><span class="et-seg-label">'+ad+'</span><select id="'+id+'" aria-label="'+ad+'">'+
    l.map(([v,yazi])=>'<option value="'+kacis(v)+'"'+(String(v)===String(deger)?' selected':'')+'>'+kacis(yazi)+'</option>').join('')+'</select></label>';
  return '<div class="et-arac">'+(m.duzeyler.length>1?secim('duzey',m.duzey,m.duzeyler.map(d=>[d,d+'. sınıf']),'Sınıf'):'')+
    secim('oturum',m.oturum,OTURUMLAR.map(o=>[o,o,!m.oturumlar.includes(o)]),'Oturum')+
    (m.dersler.length?sel('eeDers','Ders',m.dersler.map(x=>[x.ders,x.ders+' · '+fi(x.n)+' etüt']),m.ders):'')+
    secim('donem',m.donem,DONEMLER,'Dönem')+'</div>';
}
// The finding in everyday words: who and what was counted, the headline, the verdict.
function cumle(m){
  const e=m.sinavlar;
  return m.duzey+'. sınıf · '+kacis(m.ders)+' · '+fi(e.length)+' deneme ('+gunAy(e[0].gun)+' – '+gunAy(e[e.length-1].gun)+')';
}
const degisim=(v,hamMi)=>Math.abs(v)<.05?'değişmedi':isr(v,1)+' net '+(v>0?'arttı':'azaldı');
function ozetYazisi(m){
  const o=m.ozet,b=t=>'<b>'+t+'</b>',alan=m.kip==='turkiye'?'Türkiye farkında':'netinde';
  if(!o)return 'Etüt alıp sonrasında denemeye giren, beklenen değişimi hesaplanabilen öğrenci yok.';
  return 'Etüt alan '+b(fi(o.n)+' öğrenci')+', ilk etütten bu yana '+alan+' ortalama '+b(degisim(o.toplam))+'; benzer başlangıçtaki etüt almayanlar '+b(degisim(o.beklenen))+'. Fark: '+b(isr(o.fark,1)+' net')+
    (o.ci?' (olası aralık '+isr(o.ci[0],1)+' … '+isr(o.ci[1],1)+').':'.');
}
function eslesmeYazisi(m){
  const s=m.esli;if(!s)return '';
  const b=t=>'<b>'+t+'</b>';
  return 'Hem etüt aldığı hem almadığı deneme arası olan '+b(fi(s.n)+' öğrenci')+': etüt alınan aralarda ortalama '+b(isr(s.etutlu,2)+' net')+', alınmayanlarda '+b(isr(s.etutsuz,2)+' net')+'; fark '+b(isr(s.fark,2))+
    (s.ci?' (olası aralık '+isr(s.ci[0],2)+' … '+isr(s.ci[1],2)+').':'.');
}
function sayimYazisi(m){
  const d=m.disarida.length;
  return fi(m.toplamOgrenci)+' öğrenciden '+sahip(m.ogrenciler.length)+' etüt alan, '+sahip(m.kontrol)+' etüt almayan (karşılaştırma için) olarak sayıldı'+(d?'; '+sahip(d)+' dışarıda (aşağıda listelenir).':'.');
}
function sutunlar(l){return '<colgroup>'+l.map(c=>'<col class="'+c+'">').join('')+'</colgroup>'}
const baslikSatiri=l=>'<thead><tr>'+l.map(([a,c])=>'<th'+(c?' class="'+c+'"':'')+'>'+a+'</th>').join('')+'</tr></thead>';
const aralikYazi=ci=>ci?isr(ci[0],2)+' … '+isr(ci[1],2):'';
const gitDugme=(sekme,ad)=>'<button type="button" class="et-dugme" data-sekme="'+sekme+'">'+ad+' →</button>';
function farkPaneli(m){
  return '<section class="et-panel" id="eeFark"><div class="et-kart-bas"><h2>Etüt sonrası fark</h2><span class="mini">'+kacis('Her çubuk bir öğrenci: ilk etütten bu yana artışı, benzer başlangıçtaki etüt almayan bir öğrencinin artışından ne kadar fazla (yukarı) ya da az (aşağı). Sıfır: beklenen kadar.')+'</span></div>'+
    '<div class="et-grafik ee-grafik" role="group" aria-label="Her öğrencinin etüt sonrası farkı"></div></section>';
}
// The earlier view, kept as supporting evidence: the gain between two exams by the etüts taken in between, each student compared with themself.
function aralikBlogu(m){
  const bir=m.kip==='turkiye'?'Türkiye farkındaki artış':'net artışı',k=m.etki.karar;
  return '<details id="eeAralik"><summary>Ayrıntı: deneme aralarına göre</summary><div class="ee-nasil">'+
    '<p class="et-cumle ee-karar ee-k-'+k.k+'" id="eeAralikKarar"><b>'+kacis(k.yazi)+'</b></p>'+(m.esli?'<p class="et-cumle" id="eeEslesme">'+eslesmeYazisi(m)+'</p>':'')+
    '<p class="mini">'+kacis('Her çubuk: iki deneme arasında o kadar etüt alınan aralarda ortalama '+bir+' (net). Çizgiler %95 olası aralık; soluk çubuk 5’ten az deneme arası. Her öğrenci kendi gidişiyle kıyaslanır.')+'</p>'+
    '<div id="eeArtis"><div class="et-grafik ee-grafik" role="group" aria-label="Etüt aldıkça artış"></div></div></div></details>';
}
function durusPaneli(st,m){
  const bas='<div class="et-kart-bas"><h2>'+kacis('Okulun Türkiye’deki yeri · '+m.ders)+'</h2>';
  if(st.durum!=='tamam')return '<section class="et-panel" id="eeGrafik">'+bas+'</div><p class="mini ee-yok">'+kacis(st.neden)+'</p><div class="et-arac">'+gitDugme('turkiye','Türkiye geneli')+'</div></section>';
  return '<section class="et-panel" id="eeGrafik">'+bas+'<span class="mini">Yukarı çıkmak, Türkiye’de daha üst dilime girmektir. Altta aynı tarihlerde dersin haftalık etütü.</span></div><div class="et-grafik ee-grafik" role="group" aria-label="Okulun Türkiye’deki yeri"></div></section>';
}
function hocaTablosu(m,secili){
  const satir=h=>'<tr'+(secili===h.key?' class="secili'+(h.az?' ee-az':'')+'"':h.az?' class="ee-az"':'')+'><td class="sayi ee-sira">'+(h.sira===null?'—':fi(h.sira))+'</td><td class="tg-ad"><button type="button" class="ee-ad" data-ee-hoca="'+kacis(h.key)+'" aria-pressed="'+(secili===h.key)+'">'+kacis(h.ad)+'</button>'+
    '<div class="mini">'+fi(h.n)+' öğrenci · '+fi(h.etut)+' etüt'+(h.az?' · az öğrenci, sıralanmadı':'')+'</div></td><td class="sayi et-dar-gizle">'+fi(h.n)+'</td><td class="sayi et-dar-gizle">'+fi(h.etut)+'</td><td class="sayi'+yonlu(h.toplam)+'">'+ok(h.toplam)+'</td><td class="sayi'+yonlu(h.ort)+'">'+ok(h.ort)+(h.ci?'<div class="mini">'+aralikYazi(h.ci)+'</div>':'')+'</td></tr>';
  return '<section class="et-panel" id="eeHocalar"><div class="et-kart-bas"><h2>Öğretmenlere göre</h2><span class="mini">Her öğrencinin etüt sonrası farkı, o öğrencinin etütlerindeki paya göre öğretmenlere bölünür. Bir öğretmene basınca öğrenciler aşağıda o öğretmenin etüt verdikleriyle sınırlanır.</span></div><div class="et-tablo-kutu"><table class="et-tablo ee-tablo">'+sutunlar(['sira','ad','s1 et-dar-gizle','s1 et-dar-gizle','s4','s7'])+
    baslikSatiri([['Sıra','sayi ee-sira'],['Öğretmen'],['Öğrenci','sayi et-dar-gizle'],['Etüt','sayi et-dar-gizle'],['Toplam katkı (net)','sayi'],['Öğrenci başına (net)','sayi']])+
    '<tbody>'+(m.hocalar.length?m.hocalar.map(satir).join(''):'<tr><td colspan="6" class="mini">Bu dönemde etüt alıp sonrasında denemeye giren öğrenci yok.</td></tr>')+'</tbody></table></div></section>';
}
// A student's Türkiye farkı (their net when no list) over the exams of the period as a small line, with a marker where the first etüt was.
function kucukCizgi(r){
  const v=r.dizi.filter(x=>x!==null),n=r.dizi.length,G=84,Y=22,lo=Math.min(...v),hi=Math.max(...v);
  const x=i=>2+(G-4)*(n>1?i/(n-1):.5),y=a=>Y-3-(hi===lo?.5:(a-lo)/(hi-lo))*(Y-6),renk=r.toplam>0?'var(--e-ok)':r.toplam<0?'var(--e-bad)':'var(--e-muted)';
  const pts=r.dizi.map((a,i)=>a===null?null:[x(i),y(a)]);let yol_='',run=[];
  const bitir=()=>{if(run.length>1)yol_+='<path class="et-kucuk" style="stroke:'+renk+'" d="M'+run.map(p=>r1(p[0])+','+r1(p[1])).join('L')+'"/>';run=[]};
  pts.forEach(p=>{if(p)run.push(p);else bitir()});bitir();
  const im=Number.isFinite(r.isaret)?'<line class="ee-etutim" x1="'+r1(x(r.isaret))+'" x2="'+r1(x(r.isaret))+'" y1="0" y2="'+Y+'"><title>İlk etüt</title></line>':'';
  return '<svg viewBox="0 0 '+G+' '+Y+'" width="'+G+'" height="'+Y+'" aria-hidden="true">'+im+yol_+pts.map(p=>p?'<circle cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="2" style="fill:'+renk+'"/>':'').join('')+'</svg>';
}
function ogrenciTablosu(m,secili){
  const hoca=new Map(m.hocalar.map(h=>[h.key,h.ad]));
  const l=m.ogrenciler.filter(r=>!secili||r.hoca[secili]).sort((a,b)=>(b._fark??-1e9)-(a._fark??-1e9)||a.ad.localeCompare(b.ad,'tr'));
  const dg=v=>m.kip==='turkiye'?isr(v,2):f2(v),sayi=v=>'<td class="sayi'+yonlu(v)+'">'+ok(v)+'</td>';
  const deneme=(ad,d,not)=>'<td class="sayi et-dar-gizle">'+dg(d)+'<div class="mini">'+kacis(ad)+(not?' · '+not:'')+'</div></td>';
  const satir=r=>'<tr><td class="tg-ad">'+(r.no?ANALIZ.adDugmesi(r.no,kisiAdi(r.ad)):kacis(kisiAdi(r.ad)))+'</td>'+deneme(r.onceAd,r.onceD,r.onceIlk?'etüt bu denemeden önce başladı':'')+deneme(r.sonAd,r.sonD,'')+
    sayi(r.toplam)+'<td class="sayi et-dar-gizle">'+(r.beklenen===null?'—':ok(r.beklenen))+'</td>'+sayi(r.fark)+
    '<td class="et-dar-gizle ee-paylar">'+Object.keys(r.hoca).sort((a,b)=>r.hoca[b]-r.hoca[a]).map(k=>kacis(r.adlar[k])+' %'+Math.round(r.hoca[k]*100)).join('<br>')+'</td><td class="et-trend">'+kucukCizgi(r)+'</td></tr>';
  const disarida=m.disarida.length?'<details id="eeDisarida"><summary>Dışarıda kalan '+fi(m.disarida.length)+' öğrenci</summary><ul>'+
    m.disarida.slice().sort((a,b)=>a.ad.localeCompare(b.ad,'tr')).map(d=>'<li>'+kacis(kisiAdi(d.ad))+' · '+kacis(d.sinif||'—')+' · '+kacis(d.neden)+'</li>').join('')+'</ul></details>':'';
  return '<section class="et-panel" id="eeOgrenciler"><div class="et-kart-bas"><h2>'+kacis('Öğrenciler'+(secili?' · '+(hoca.get(secili)||''):''))+'</h2>'+
    (secili?'<button type="button" class="et-dugme" data-ee-hoca="">Tüm öğretmenler</button>':'<span class="mini">'+fi(l.length)+' etüt alan öğrenci</span>')+'</div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo ee-tablo ee-ogr">'+sutunlar(['ad','s8 et-dar-gizle','s8 et-dar-gizle','s4','s4 et-dar-gizle','s4','s9 et-dar-gizle','s6'])+
    baslikSatiri([['Öğrenci'],['Etütten önce','sayi et-dar-gizle'],['Son deneme','sayi et-dar-gizle'],['Toplam değişim (net)','sayi'],['Beklenen (net)','sayi et-dar-gizle'],['Etüt sonrası fark (net)','sayi'],['Öğretmenler','et-dar-gizle'],[m.kip==='turkiye'?'Türkiye farkı':'Net']])+
    '<tbody>'+(l.length?l.map(satir).join(''):'<tr><td colspan="8" class="mini">Öğrenci yok.</td></tr>')+'</tbody></table></div>'+disarida+'</section>';
}
function nasilBlogu(m){
  return '<details id="eeNasil"><summary>Nasıl hesaplanır</summary><div class="ee-nasil">'+
    '<p><b>Türkiye farkı.</b> Öğrencinin o dersteki neti eksi o denemede Türkiye’nin o dersteki ortalama neti. Deneme zor da olsa kolay da olsa bu fark o denemenin zorluğundan etkilenmez; neti olduğu gibi kullanmak kolay denemeyi öne çıkarırdı.</p>'+
    '<p><b>Toplam değişim.</b> Öğrencinin ilk etütten hemen önceki denemesinden, etütten sonra girdiği son denemeye kadar Türkiye farkının değişimi. Aradaki küçük inip çıkmalar birbirini götürmez: etütten sonra +5 yükselip sonra −1 düşen öğrencinin değişimi +4’tür.</p>'+
    '<p><b>Beklenen değişim.</b> Aynı iki deneme arasında hiç etüt almamış öğrencilere bakılır. Başlangıçta düşük olan öğrenci etüt almasa da çoğu zaman yükselir; bu kendiliğinden toparlanma ve okulun genel gidişi, benzer başlangıçtaki etüt almayanların değişiminden öğrenilir. Az öğrencili bir deneme çifti için bu değer, tüm çiftlerden gelen değere yaklaştırılır.</p>'+
    '<p><b>Etüt sonrası fark.</b> Toplam değişim eksi beklenen değişim. Yani etüt almayan benzer bir öğrencinin yapacağından ne kadar fazla ya da az.</p>'+
    '<p><b>Öğretmen cebi.</b> Her öğrencinin farkı, o öğrencinin etütlerindeki paya göre öğretmenlere bölünür (6 etüt A, 2 etüt B ise A %75, B %25). Toplam katkı payların toplamıdır; öğrenci başına, paylarla ağırlıklı ortalamadır.</p>'+
    '<p><b>Olası aralık.</b> Öğrenciler 1000 kez yeniden seçilerek bulunur ve her seferinde aynı çıkar. Aralık sıfırı içermiyorsa fark belirgin sayılır; çok az öğrenci varsa sonuç verilmez.</p>'+
    '<p><b>Ayrıntı bölümü</b> her öğrenciyi yalnızca kendisiyle kıyaslar: iki deneme arasında alınan her etüt için artış ne kadar değişiyor, kötü denemeden sonraki toparlanma hesaba katılarak.</p>'+
    (m.kip==='ham'?'<p><b>Bu sayfada ham net kullanıldı</b> (Türkiye geneli listesi olmadığı için); sonuç denemelerin zorluğundan etkilenebilir.</p>':'')+'</div></details>';
}
function icerik(){
  const baslik='<h1 class="et-baslik">Etüt etkisi</h1>';
  let t;try{t=OGRENCI_RAPOR.temelOgrenciler()}catch(e){SON=null;return '<header class="et-bas">'+baslik+'</header><p class="et-uyari">'+kacis(e.message)+'</p>'}
  let tv=null,trFn=null;try{tv=TURKIYE.oku().veri;if(tv)trFn=TURKIYE.ortalamalar(tv)}catch(e){tv=null;trFn=null}
  const m=model(t.students,secimler(),t.etutKapsam,trFn);
  const uyari=(t.warnings||[]).length?'<p class="mini ee-durum" id="eeDurum">Eşleştirme: '+kacis(t.warnings.slice(0,3).join(' '))+(t.warnings.length>3?' (+'+fi(t.warnings.length-3)+')':'')+'</p>':'';
  const bos=(yazi)=>'<header class="et-bas">'+baslik+'</header><section class="et-panel et-bos"><b>'+yazi[0]+'</b><p>'+yazi[1]+'</p><div class="et-arac">'+gitDugme('siralamalar','Sıralamalar')+gitDugme('etutler','Etütler')+'</div></section>';
  if(m.durum!=='tamam')SON=null;
  if(m.durum==='bos')return bos(['Henüz veri yok','Etüt etkisi için deneme sonuç listelerini Sıralamalar’a, etüt raporunu Etütler’e ekleyin.']);
  if(m.durum==='az')return '<header class="et-bas">'+baslik+'</header>'+(m.duzeyler.length>1?'<div class="et-arac">'+secim('duzey',m.duzey,m.duzeyler.map(d=>[d,d+'. sınıf']),'Sınıf')+'</div>':'')+
    '<section class="et-panel et-bos"><b>İki deneme gerekli</b><p>'+m.duzey+'. sınıf için aynı oturumda en az iki deneme sonucu olmalı.</p><div class="et-arac">'+gitDugme('siralamalar','Sıralamalar')+'</div></section>';
  if(m.durum==='etutyok'){
    const e=m.sinavlar;
    return '<header class="et-bas">'+baslik+'</header>'+arac(m)+uyari+
      '<section class="et-panel et-bos"><b>Dönemde etüt kaydı yok</b><p>'+kacis(e[0].etiket)+' – '+kacis(e[e.length-1].etiket)+' arasında bu oturumun derslerinden etüt alan öğrenci bulunamadı. Etüt raporunun tarih aralığını ve öğrenci adlarının denemelerle eşleştiğini kontrol edin.</p><div class="et-arac">'+gitDugme('etutler','Etütler')+'</div></section>';
  }
  const ogrD=t.students.filter(s=>s&&Array.isArray(s.exams)&&duzeyAl(s.cls)===m.duzey),st=durus(ogrD,m,tv);
  SON=m.hepsi.length?{m,st}:null;
  const hamUyari=m.kip==='ham'?'<div class="ee-uyari-satir"><p class="et-uyari" id="eeHamUyari">'+HAM_UYARI+'</p>'+gitDugme('turkiye','Türkiye geneli')+'</div>':'';
  const listesiz=m.listesiz.length?'<div class="ee-uyari-satir"><p class="et-uyari" id="eeListesiz">Türkiye geneli listesi olmayan denemeler hesaba katılmadı: '+kacis(m.listesiz.join(', '))+'.</p>'+gitDugme('turkiye','Türkiye geneli')+'</div>':'';
  const kapsamUyari=m.eksik?'<p class="et-uyari" id="eeKapsam">Etüt raporları bu dönemin '+fi(m.eksik)+' iş gününü kapsamıyor; o günlerin etütleri kayıtlı değil, etüt sayıları eksik olabilir.</p>':'';
  const secili=m.hocalar.some(h=>h.key===EK.eeHoca)?EK.eeHoca:'';
  cizimPlanla();
  return '<header class="et-bas">'+baslik+'<p class="et-cumle" id="eeCumle">'+cumle(m)+'</p>'+
    '<p class="et-cumle" id="eeOzet">'+ozetYazisi(m)+'</p><p class="et-cumle ee-karar ee-k-'+m.karar.k+'" id="eeKarar"><b>'+kacis(m.karar.yazi)+'</b></p>'+
    '<p class="et-cumle" id="eeSayim">'+sayimYazisi(m)+'</p><p class="mini" id="eeSinir">'+SINIR_YAZI+'</p></header>'+arac(m)+uyari+hamUyari+listesiz+kapsamUyari+
    (m.hepsi.length?(m.ozet?farkPaneli(m):'')+durusPaneli(st,m)+hocaTablosu(m,secili)+ogrenciTablosu(m,secili)+aralikBlogu(m)+nasilBlogu(m):ogrenciTablosu(m,secili)+nasilBlogu(m));
}
function gorunum(){
  if(!rehberMi())return '<div class="baslik"><h1>Etüt etkisi</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  return '<div id="eeKok">'+icerik()+'</div>';
}
function yenidenCiz(odak){
  const kok=document.getElementById('eeKok');if(!kok){ciz();return}
  kok.innerHTML=icerik();
  if(odak){const el=document.querySelector(odak);if(el)el.focus()}
}
document.addEventListener('toggle',()=>{if(etkin())cizimPlanla()},true);
document.addEventListener('click',ev=>{
  if(!etkin())return;
  const el=ev.target.closest?.('[data-ee-duzey],[data-ee-oturum],[data-ee-donem],button[data-ee-hoca]');if(!el||el.disabled)return;
  if(el.dataset.eeDuzey){EK.eeDuzey=Number(el.dataset.eeDuzey);EK.eeOturum=EK.eeDers=EK.eeHoca=undefined;yenidenCiz('[data-ee-duzey="'+EK.eeDuzey+'"]');return}
  if(el.dataset.eeOturum){EK.eeOturum=el.dataset.eeOturum;EK.eeDers=EK.eeHoca=undefined;yenidenCiz('[data-ee-oturum="'+EK.eeOturum+'"]');return}
  if(el.dataset.eeDonem){EK.eeDonem=el.dataset.eeDonem;EK.eeHoca=undefined;yenidenCiz('[data-ee-donem="'+EK.eeDonem+'"]');return}
  if(el.dataset.eeHoca!==undefined){EK.eeHoca=el.dataset.eeHoca&&EK.eeHoca!==el.dataset.eeHoca?el.dataset.eeHoca:undefined;yenidenCiz();document.getElementById('eeOgrenciler')?.scrollIntoView({block:'nearest',behavior:'smooth'})}
});
document.addEventListener('change',ev=>{
  if(!etkin())return;const el=ev.target;
  if(el.id==='eeDers'){EK.eeDers=el.value;EK.eeHoca=undefined;yenidenCiz('#eeDers')}
});
return {model,beklenenModel,kararToplam,farkSvg,egim,netAl,etutOturum,eksikGun,icerik,gorunum,artisSvg,durusSvg,durus,grafikleriCiz,sahip,trOrtalama,etkiHesapla,karar,eslestirme,kovalar,bootstrap,coz,dilimler,isr,NET,TR_KOD,EN_AZ,EN_AZ_KARAR,GENIS_FARK,GENIS_ARALIK,BOOT,TOHUM,HAM_UYARI,SINIR_YAZI};
})();
function gorunumEtutEtki(){return ETUT_ETKI.gorunum()}
