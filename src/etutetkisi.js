// Embedded in index.html by scripts/embed-etutetkisi.cjs. No student data belongs here.
// Etüt etkisi (teacher only): does a student gain more in the ders where they took etüts than in their own other dersler?
// It reads the merged students of Öğrenci raporları' base (OGRENCI_RAPOR.temelOgrenciler: exams with every lesson's net, etüt
// sessions with date, lesson and teacher) and the Türkiye geneli lists (TURKIYE), so nothing is stored, uploaded or sent to students.
// Method (docs/etut-etkisi.md): per ders, a student's Türkiye farkı d = their net − the Türkiye average net of that ders in that exam
// removes how hard the exam was. The main estimate compares each student with themself across the dersler of the oturum (a panel of
// student × ders): change_z = α_i (student) + β_k (ders) + a_pair + b_k·d_start_z + γ_k·e_ik, d in units of the ders's school SD, so
// general diligence (it lifts every ders of a student) is absorbed by α_i. γ of the chosen ders is shown in net; per teacher γ_T.
// The 95% interval is a seeded percentile cluster bootstrap over students (1000 resamples). The earlier cross-student estimate
// (change = a_pair + b·d_start + γ·e over all students) is kept as the secondary number "öğrenciler arası karşılaştırma". The page is
// a comparison, not proof.
const ETUT_ETKI = (() => {
const OTURUMLAR=['TYT','AYT'];
const EN_AZ=5;            // fewer intervals / students than this: drawn faint, teachers unranked
const EN_AZ_KARAR=8;      // fewer students than this identify the estimate: no verdict
const GENIS_ARALIK=3;     // an interval wider than this many net per etüt says nothing
const BOOT=1000,TOHUM=20261105;
const SON_DENEME=4;
// Outliers: the modified z-score of Iglewicz & Hoaglin, M = 0,6745·(x − median)/MAD, flagged above 3,5. The MAD never goes below a floor
// (an exam-to-exam swing of 2 net, a total change of 1 net), so a pool of identical values flags nothing.
const UC_ESIK=3.5,UC_TABAN_DENEME=2,UC_TABAN_FARK=1,UC_EN_AZ=6;
const SD_TABAN=0.5;      // net: the school SD of a ders never goes below this when the scale is set
const EN_KONTROL=5;      // fewer students with both an etüt ders and a non-etüt ders than this: no verdict
const OLAY_BIN=[-2,-1,0,1,2,3],OLAY_AD=['2 deneme önce','1 deneme önce','İlk etütten önce','1 deneme sonra','2 deneme sonra','3+ sonra'];
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
const medyan=l=>{if(!l.length)return null;const k=l.slice().sort((a,b)=>a-b),h=k.length>>1;return k.length%2?k[h]:(k[h-1]+k[h])/2};
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
// An etüt counts for both sessions, whatever "TYT" or "AYT" its course name carries: the school writes
// "MATEMATİK TYT" for AYT etüts too, and one etüt often covers both. The lesson alone decides.
function etutOturum(course,oturum){return true}
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
/* ---------------- change since the etüt, by etüt count (the main measure) ---------------- */
const EN_AZ_KONTROL=3;   // a start–end pair with fewer students borrows its intercept from the pooled one
// One regression over students: change = a_pair + β·x. obs: [{p (the start–end pair), y (the change), x: [columns]}]. Each pair is
// demeaned within itself (so a_pair, which absorbs the school's trend of that pair, drops out of β); β is solved from the normal
// equations; a column with no variation inside the pairs (or collinear with the others) has β null and counts as 0. Afterwards
// a_pair = w·own + (1 − w)·pooled, w = min(1, n/3): a pair with fewer than 3 students leans on the pooled intercept.
// katki[j]: students whose column j differs from their pair's mean (they are what identifies β_j).
function regres(obs,k){
  if(!obs.length)return null;
  const g=new Map();for(const o of obs){if(!g.has(o.p))g.set(o.p,[]);g.get(o.p).push(o)}
  const A=Array.from({length:k},()=>new Array(k+1).fill(0)),katki=new Array(k).fill(0);
  for(const l of g.values()){
    if(l.length<2)continue;
    const mx=Array.from({length:k},(_,j)=>ort(l.map(o=>o.x[j]))),my=ort(l.map(o=>o.y));
    for(const o of l){
      for(let i=0;i<k;i++){const di=o.x[i]-mx[i];if(Math.abs(di)>1e-9)katki[i]++;for(let j=0;j<k;j++)A[i][j]+=di*(o.x[j]-mx[j]);A[i][k]+=di*(o.y-my)}
    }
  }
  // Gauss–Jordan; a column with no pivot (no variation, or collinear with an earlier one) is dropped: its β is null.
  const M=A.map(r=>r.slice()),satirOf=new Array(k).fill(-1),kullanildi=new Set(),b=new Array(k).fill(null);
  for(let c=0;c<k;c++){
    let q=-1;for(let i=0;i<k;i++)if(!kullanildi.has(i)&&Math.abs(M[i][c])>1e-9*(1+A[c][c])&&(q<0||Math.abs(M[i][c])>Math.abs(M[q][c])))q=i;
    if(q<0||A[c][c]<=1e-9)continue;
    kullanildi.add(q);satirOf[c]=q;const pv=M[q][c];for(let j=0;j<=k;j++)M[q][j]/=pv;
    for(let i=0;i<k;i++)if(i!==q){const f=M[i][c];if(f)for(let j=0;j<=k;j++)M[i][j]-=f*M[q][j]}
  }
  for(let c=0;c<k;c++)if(satirOf[c]>=0)b[c]=M[satirOf[c]][k];
  const bb=b.map(v=>v===null?0:v),art=o=>o.y-o.x.reduce((t,v,j)=>t+bb[j]*v,0),havuz=ort(obs.map(art)),a=new Map();
  for(const [p,l] of g)a.set(p,Math.min(1,l.length/EN_AZ_KONTROL)*ort(l.map(art))+(1-Math.min(1,l.length/EN_AZ_KONTROL))*havuz);
  return {beta:b,a,havuz,katki,n:obs.length,cift:g.size,aOf:p=>a.has(p)?a.get(p):havuz};
}
// Cluster bootstrap over students for a regression: f(resample) returns an array of numbers (or nulls); the result is the 95% percentile
// interval of each (null when fewer than half of the resamples gave a value). Fixed seed: the same data give the same interval.
function kumeAralik(obs,f,B=BOOT,tohum=TOHUM){
  if(obs.length<2)return null;
  const rnd=rastgele(tohum),n=obs.length;let v=null;
  for(let i=0;i<B;i++){
    const r=f(Array.from({length:n},()=>obs[Math.floor(rnd()*n)]));if(!r)continue;
    if(!v)v=r.map(()=>[]);r.forEach((x,j)=>{if(x!==null&&Number.isFinite(x))v[j].push(x)});
  }
  if(!v)return null;
  return v.map(l=>{if(l.length<B/2)return null;l.sort((a,b)=>a-b);return [yuzdelik(l,.025),yuzdelik(l,.975)]});
}
// The verdict on the pooled gain per etüt (o: {b, ci, n, kontrol}); never a cause. n: students whose etüt ders is compared with their
// other dersler; kontrol (when given): students with both an etüt ders and a non-etüt ders.
function kararToplam(o){
  const veri=y=>({k:'veri',yazi:y});
  if(!o||o.b===null||o.b===undefined)return veri('Yeterli veri yok (öğrencilerin etüt alınan ve alınmayan dersleri birlikte yeterince yok).');
  if(o.n<EN_AZ_KARAR)return veri('Yeterli veri yok (etüt alınan dersi diğer dersleriyle kıyaslanabilen '+fi(o.n)+' öğrenci var; en az '+EN_AZ_KARAR+' gerekir).');
  if(o.kontrol!==undefined&&o.kontrol<EN_KONTROL)return veri('Yeterli veri yok (hem etüt aldığı hem almadığı dersi olan '+fi(o.kontrol)+' öğrenci var; en az '+EN_KONTROL+' gerekir).');
  if(!o.ci)return veri('Yeterli veri yok.');
  if(o.ci[1]-o.ci[0]>GENIS_ARALIK)return veri('Yeterli veri yok (tahmin çok belirsiz).');
  const lo=Math.round(o.ci[0]*1e6)/1e6,hi=Math.round(o.ci[1]*1e6)/1e6;
  if(lo>0)return {k:'var',yazi:'Etüt alınan derste artış belirgin: her etüt ≈ '+isr(o.b)+' net (aynı öğrencinin diğer derslerine göre).'};
  if(hi<0)return {k:'az',yazi:'Etüt alınan derste artış daha az: her etüt ≈ '+isr(o.b)+' net (aynı öğrencinin diğer derslerine göre).'};
  return {k:'yok',yazi:'Belirgin bir fark yok.'};
}
// THE EARLIER, CROSS-STUDENT ESTIMATE (kept as the secondary number): every student with two exams that count, one ders. Etüt students: from the exam before their first etüt of the lesson (the first exam of the
// period when the etüt came earlier, marked) to their last exam; students with no etüt: first exam to last. The model
// change = a_pair + b·d_start + γ·e fits all of them, with e the etüts of the lesson in the window, so students with fewer
// etüts are the comparison for those with more (nobody has to have none). The same with one γ per teacher (e counted for that teacher
// only, the others held constant) gives each teacher's own gain per etüt; their pocket is γ × the etüts they gave. No share is split.
function toplamDegisim({satir,ex,oturum,ders,son,disarida}){
  const gunler=new Set(ex.map(e=>e.gun)),rows=[];
  for(const r of satir){
    const e=(r._s.sessions||[]).filter(x=>x.date&&ETUT.dersAdi(x.course)===ders&&etutOturum(x.course,oturum)).map(x=>({g:gunNo(x.date),hoca:U(x.teacher)||'?',ad:x.teacher}))
      .filter(x=>!gunler.has(x.g)&&x.g<son).sort((a,b)=>a.g-b.g);
    const d=r.dizi,gecerli=[];d.forEach((v,i)=>{if(v!==null)gecerli.push(i)});
    let bi=gecerli[0],si=gecerli[gecerli.length-1],isaret=false,g0=null;
    if(e.length){
      g0=e[0].g;bi=-1;for(const i of gecerli)if(ex[i].gun<g0)bi=i;
      if(bi<0){bi=gecerli[0];isaret=true}
      if(si<=bi){disarida.push({id:r._s.id,ad:r._s.name,sinif:r._s.cls,neden:'etütten sonra deneme yok'});continue}
    }
    const ge=ex[si].gun,pencere=e.filter(x=>x.g<ge),sayilar={},adlar={};
    for(const x of pencere){sayilar[x.hoca]=(sayilar[x.hoca]||0)+1;adlar[x.hoca]=adlar[x.hoca]||kisiAdi(x.ad)||'Öğretmen belirtilmemiş'}
    let isx=null;
    if(e.length){isx=0;for(let i=0;i<ex.length-1;i++)if(g0>=ex[i].gun)isx=i+Math.min(1,(g0-ex[i].gun)/Math.max(1,ex[i+1].gun-ex[i].gun))}
    rows.push({r,bi,si,p:bi+'|'+si,sayilar,adlar,n:pencere.length,etut:e.length>0,isaret,isx,toplam:d[si]-d[bi],x0:d[bi]});
  }
  const keys=[...new Set(rows.flatMap(q=>Object.keys(q.sayilar)))],adlar=new Map();
  for(const q of rows)for(const k of Object.keys(q.sayilar))if(!adlar.has(k))adlar.set(k,q.adlar[k]);
  const obsP=q=>({p:q.p,y:q.toplam,x:[q.x0,q.n]}),obsT=q=>({p:q.p,y:q.toplam,x:[q.x0,...keys.map(k=>q.sayilar[k]||0)]});
  // Students whose total change is far from what the model says (modified z of the residual above 3,5): fit, flag, refit without them,
  // then judge every student again against the new fit (a student flagged earlier is let back in if they fit the cleaner model), until the
  // set stops changing (at most 5 rounds). Several extreme students cannot hide each other this way. At most 20% of the students are put
  // aside; if more would be, only the most extreme ones are, and the list says so.
  let aykiri=new Set(),kesik=false;const enCok=Math.floor(rows.length*.2);
  if(rows.length>=UC_EN_AZ)for(let tur=0;tur<5;tur++){
    const f=regres(rows.filter(q=>!aykiri.has(q)).map(obsP),2);if(!f)break;
    const res=rows.map(q=>q.toplam-f.aOf(q.p)-(f.beta[0]||0)*q.x0-(f.beta[1]||0)*q.n),tut=res.filter((_,i)=>!aykiri.has(rows[i])),m0=medyan(tut),mad=Math.max(medyan(tut.map(v=>Math.abs(v-m0))),UC_TABAN_FARK);
    let yeni=rows.map((q,i)=>({q,m:Math.abs(.6745*(res[i]-m0)/mad)})).filter(x=>x.m>UC_ESIK).sort((a,b)=>b.m-a.m);
    kesik=yeni.length>enCok;if(kesik)yeni=yeni.slice(0,enCok);
    const k=new Set(yeni.map(x=>x.q));if(k.size===aykiri.size&&[...k].every(q=>aykiri.has(q)))break;
    aykiri=k;if(kesik)break;   // over the cap: the most extreme fifth is the answer, no further rounds
  }
  rows.forEach(q=>{q.aykiri=aykiri.has(q)});
  const tutulan=rows.filter(q=>!q.aykiri),fp=regres(tutulan.map(obsP),2),ft=keys.length?regres(tutulan.map(obsT),1+keys.length):null;
  const gP=fp?fp.beta[1]:null,bP=fp&&fp.beta[0]!==null?fp.beta[0]:0;
  const ciP=fp?kumeAralik(tutulan.map(obsP),s=>{const f=regres(s,2);return f?[f.beta[1]]:null}):null;
  const ciT=ft?kumeAralik(tutulan.map(obsT),s=>{const f=regres(s,1+keys.length);return f?f.beta.slice(1):null}):null;
  const ogrenciler=rows.map(q=>{
    const r=q.r,bek=fp?fp.aOf(q.p)+bP*q.x0:null,o={id:r.id,no:r.no,ad:r.ad,sinif:r.sinif,n:q.n,etut:q.etut,sayilar:q.sayilar,adlar:q.adlar,onceAd:ex[q.bi].etiket,onceD:q.x0,onceIlk:q.isaret,sonAd:ex[q.si].etiket,sonD:r.dizi[q.si],
      aykiri:q.aykiri,ucDeneme:r.uc.filter(Boolean).length,dizi0:r.dizi0,uc:r.uc,toplam:r2(q.toplam),beklenen:bek===null?null:r2(bek),fark:bek===null?null:r2(q.toplam-bek),dizi:r.dizi,isaret:q.isx,_egim:r._egim,_fark:bek===null?null:q.toplam-bek,_yT:{}};
    if(ft)keys.forEach((k,j)=>{const bT=ft.beta[0]||0,dig=keys.reduce((t,k2,j2)=>t+(j2===j?0:(ft.beta[1+j2]||0)*(q.sayilar[k2]||0)),0);o._yT[k]=q.toplam-ft.aOf(q.p)-bT*q.x0-dig});
    return o;
  });
  const etutlu=ogrenciler.filter(o=>o.etut&&o.fark!==null&&!o.aykiri);
  const ozet=fp?{n:etutlu.length,katki:fp.katki[1],b:gP,ci:ciP?ciP[0]:null,toplam:etutlu.length?ort(etutlu.map(o=>o.toplam)):null,beklenen:etutlu.length?ort(etutlu.map(o=>o.beklenen)):null,
    fark:etutlu.length?ort(etutlu.map(o=>o._fark)):null,etut:rows.reduce((t,q)=>t+q.n,0)}:null;
  // Each teacher's own gain per etüt, with the etüts they gave and their pocket (γ × those etüts). Ranked by the pocket.
  const hocalar=keys.map((key,j)=>{
    const l=tutulan.filter(q=>q.sayilar[key]),etut=l.reduce((t,q)=>t+q.sayilar[key],0),gam=ft?ft.beta[1+j]:null;
    return {key,ad:adlar.get(key),n:l.length,etut,b:gam,ci:ciT?ciT[j]:null,toplam:gam===null?null:gam*etut,katki:ft?ft.katki[1+j]:0,az:l.length<EN_AZ||gam===null};
  });
  const tSayi=h=>h.toplam===null?-Infinity:Math.round(h.toplam*1e6)/1e6;
  hocalar.sort((a,b)=>a.az-b.az||tSayi(b)-tSayi(a)||b.n-a.n||a.ad.localeCompare(b.ad,'tr'));
  hocalar.forEach((h,i)=>{h.sira=h.az?null:i>0&&!hocalar[i-1].az&&r2(hocalar[i-1].toplam)===r2(h.toplam)?hocalar[i-1].sira:i+1});
  const uc2=ogrenciler.filter(o=>o.aykiri).map(o=>({id:o.id,ad:o.ad,sinif:o.sinif,tur:'ogrenci',neden:'Toplam değişim diğer öğrencilerden çok farklı ('+isr(o.toplam-(o.beklenen??0)-0,1)+' net fark)'}));
  if(kesik)uc2.push({tur:'ozet',neden:'uç sonuç çok fazla: en uç 20% dışarıda'});
  return {ogrenciler,hocalar,ozet,karar:kararToplam(ozet?{b:ozet.b,ci:ozet.ci,n:ozet.katki}:null),kontrol:ogrenciler.filter(o=>!o.etut&&!o.aykiri).length,uc2,model:fp&&{b:bP,gama:gP,cift:fp.cift,n:fp.n}};
}

/* ---------------- the main estimate: each student against their own other dersler ---------------- */
// Gauss–Jordan on the augmented matrix M (q rows, q+1 columns): the solution, null for a column with no pivot (no variation, or exactly
// explained by the columns before it: such a column counts as 0 and is said to be unidentified).
function gjCoz(M,q){
  const diag=M.map((r,i)=>r[i]),satirOf=new Array(q).fill(-1),kul=new Array(q).fill(false),b=new Array(q).fill(null);
  for(let c=0;c<q;c++){
    if(!(diag[c]>1e-9))continue;
    let best=-1;for(let i=0;i<q;i++)if(!kul[i]&&Math.abs(M[i][c])>1e-8*(1+diag[c])&&(best<0||Math.abs(M[i][c])>Math.abs(M[best][c])))best=i;
    if(best<0)continue;
    kul[best]=true;satirOf[c]=best;const pv=M[best][c];for(let j=0;j<=q;j++)M[best][j]/=pv;
    for(let i=0;i<q;i++)if(i!==best){const f=M[i][c];if(f)for(let j=0;j<=q;j++)M[i][j]-=f*M[best][j]}
  }
  for(let c=0;c<q;c++)if(satirOf[c]>=0)b[c]=M[satirOf[c]][q];
  return b;
}
// Student fixed effects by demeaning: for every student (rows: [{x (p numbers), y}]) the products of the demeaned columns, as one flat
// array of p rows × (p+1) (the last entry of a row is the product with y). A student with one row adds nothing (null).
function panelHazirla(ogr,p){
  return ogr.map(rows=>{
    const m=rows.length;if(m<2)return null;
    const mx=new Array(p).fill(0);let my=0;
    for(const r of rows){for(let c=0;c<p;c++)mx[c]+=r.x[c];my+=r.y}
    for(let c=0;c<p;c++)mx[c]/=m;my/=m;
    const t=new Float64Array(p*(p+1)),dx=new Float64Array(p);
    for(const r of rows){
      for(let c=0;c<p;c++)dx[c]=r.x[c]-mx[c];const dy=r.y-my;
      for(let a=0;a<p;a++){const da=dx[a];if(!da)continue;const o=a*(p+1);for(let c=a;c<p;c++)t[o+c]+=da*dx[c];t[o+p]+=da*dy}
    }
    for(let a=0;a<p;a++)for(let c=0;c<a;c++)t[a*(p+1)+c]=t[c*(p+1)+a];
    return t;
  });
}
const panelTopla=(T,p)=>{const top=new Float64Array(p*(p+1));for(const t of T)if(t)for(let i=0;i<top.length;i++)top[i]+=t[i];return top};
const panelAktif=(top,p)=>{const a=[];for(let c=0;c<p;c++)if(top[c*(p+1)+c]>1e-9)a.push(c);return a};
function panelMatris(top,p,akt){
  const q=akt.length;return Array.from({length:q},(_,a)=>{const r=new Array(q+1);for(let c=0;c<q;c++)r[c]=top[akt[a]*(p+1)+akt[c]];r[q]=top[akt[a]*(p+1)+p];return r});
}
// The coefficients (length p, null where there is none) from the summed products.
function panelCoz(top,p,akt){
  const b=gjCoz(panelMatris(top,p,akt),akt.length),tam=new Array(p).fill(null);akt.forEach((c,i)=>{tam[c]=b[i]});return tam;
}
// 95% percentile intervals of the coefficients of the columns hedef (each times carp), by a seeded cluster bootstrap over the students.
// null for a column that has no value in at least half of the resamples.
function panelAralik(T,p,akt,hedef,carp,B=BOOT,tohum=TOHUM){
  const q=akt.length,pos=hedef.map(h=>akt.indexOf(h));
  const S=T.filter(Boolean).map(t=>{const r=new Float64Array(q*(q+1));for(let a=0;a<q;a++){for(let c=0;c<q;c++)r[a*(q+1)+c]=t[akt[a]*(p+1)+akt[c]];r[a*(q+1)+q]=t[akt[a]*(p+1)+p]}return r});
  const n=S.length;if(n<2||!q)return hedef.map(()=>null);
  const rnd=rastgele(tohum),v=hedef.map(()=>[]),len=q*(q+1),top=new Float64Array(len);
  for(let i=0;i<B;i++){
    top.fill(0);
    for(let j=0;j<n;j++){const s=S[Math.floor(rnd()*n)];for(let t=0;t<len;t++)top[t]+=s[t]}
    const M=Array.from({length:q},(_,a)=>{const r=new Array(q+1);for(let c=0;c<=q;c++)r[c]=top[a*(q+1)+c];return r});
    const b=gjCoz(M,q);
    pos.forEach((ps,h)=>{if(ps>=0&&b[ps]!==null&&Number.isFinite(b[ps]))v[h].push(b[ps]*carp[h])});
  }
  return v.map(l=>{if(l.length<B/2)return null;l.sort((a,b)=>a-b);return [yuzdelik(l,.025),yuzdelik(l,.975)]});
}
// The school SD of a ders (net): the within-exam SD of the Türkiye farkı over the students, pooled over the exams before anybody in the
// grade had an etüt in any ders of the oturum (just the first exam when etüts started earlier), never below SD_TABAN. Exams after the
// etüts began are not used: the etüt (and the diligence of those who take many) would widen the spread the scale is measured by and make
// the ders look "more spread" than its neighbours; one cut for every ders keeps the scales comparable. ilk: that day (null: no etüt).
function olcek(diziler,ex,ilk){
  let ss=0,df=0;
  for(let j=0;j<ex.length;j++){
    if(j>0&&ilk!==null&&ex[j].gun>=ilk)break;
    const v=[];for(const d of diziler)if(d[j]!==null&&d[j]!==undefined)v.push(d[j]);
    if(v.length<2)continue;const mu=ort(v);for(const x of v)ss+=(x-mu)**2;df+=v.length-1;
  }
  return Math.max(df?Math.sqrt(ss/df):0,SD_TABAN);
}
// One student's window in one ders: from the last valid exam strictly before day g0 (the first valid exam when the etüt came earlier,
// marked isaret) to the last valid exam; g0 null: first to last. null when there is no window with an exam after its start.
function pencereBul(d,ex,g0){
  const gec=[];d.forEach((v,i)=>{if(v!==null)gec.push(i)});
  if(gec.length<2)return null;
  let bi=gec[0],isaret=false;
  if(g0!==null){bi=-1;for(const i of gec)if(ex[i].gun<g0)bi=i;if(bi<0){bi=gec[0];isaret=true}}
  const si=gec[gec.length-1];
  return si>bi?{bi,si,isaret}:null;
}
// The mean (and 95% interval) of a list of numbers; interval null under two numbers.
function ortCi(l){
  const n=l.length;if(!n)return {n:0,ort:null,ci:null};
  const m=ort(l);if(n<2)return {n,ort:m,ci:null};
  const sd=Math.sqrt(l.reduce((t,x)=>t+(x-m)**2,0)/(n-1)),se=sd/Math.sqrt(n);
  return {n,ort:m,ci:[m-1.96*se,m+1.96*se]};
}
// 95% percentile intervals of the means of the student-level values S (etüt line), C (ortalama line) and S − C, one cluster bootstrap
// (the same seeded resamples for the three); nulls under two students.
function ortBoot(S,C,B=BOOT,tohum=TOHUM){
  const n=S.length;if(n<2)return {s:null,c:null,f:null};
  const rnd=rastgele(tohum),ms=[],mc=[],mf=[];
  for(let i=0;i<B;i++){let a=0,c=0;for(let j=0;j<n;j++){const k=Math.floor(rnd()*n);a+=S[k];c+=C[k]}ms.push(a/n);mc.push(c/n);mf.push((a-c)/n)}
  const ci=l=>{l.sort((x,y)=>x-y);return [yuzdelik(l,.025),yuzdelik(l,.975)]};
  return {s:ci(ms),c:ci(mc),f:ci(mf)};
}
// The event study (difference in differences with not-yet-treated controls), in net of the chosen ders: for each student with an etüt in it,
// the reference r is the exam before their first etüt (with the teacher, on a teacher's chart). The etüt line at position p is the mean over
// those students of d(r+p) − d(r). The ortalama line is, for the same students and the same calendar exams, the mean of d_j(r+p) − d_j(r)
// over the grade's other students j who had no etüt of the ders up to the later of the two exams (not yet, or never, treated): a student who
// is treated later is a control until their own first etüt. A student-position without any such control is left out of both lines, so both
// cover exactly the same students. Positions: 2 and 1 before, the reference, 1 and 2 after, 3 or more after (a student's values in a bin
// are averaged first). Dd: every student's series of the ders ({dizi}); EHd: their etüts of the ders (with day and teacher key).
function olayKur(kisiler,Dd,EHd,ders,ex,hoca=null){
  const g0=EHd.map(l=>l.length?l[0].g:null),kutu=OLAY_BIN.map(()=>({s:[],c:[]})),ogr=new Set();
  for(const q of kisiler){
    if(q.aykiri||q.gSel===null)continue;
    const ds=Dd[q.si_].dizi;let r=q.sel.bi;
    if(hoca!==null){
      if(!q.sel.tc[hoca])continue;
      const g=q.E[ders].find(x=>x.hoca===hoca).g,gec=[];ds.forEach((v,i)=>{if(v!==null)gec.push(i)});
      r=-1;for(const i of gec)if(ex[i].gun<g)r=i;if(r<0)r=gec[0];
    }
    if(ds[r]===null||ds[r]===undefined)continue;
    const bin=OLAY_BIN.map(()=>({s:[],c:[]}));
    for(let t=0;t<ex.length;t++){
      const rel=t-r;if(rel<=-3||ds[t]===null||ds[t]===undefined)continue;
      const m=Math.max(t,r),cv=[];
      for(let j=0;j<Dd.length;j++){
        if(j===q.si_||(g0[j]!==null&&g0[j]<=ex[m].gun))continue;
        const dj=Dd[j].dizi;if(dj[t]===null||dj[t]===undefined||dj[r]===null||dj[r]===undefined)continue;cv.push(dj[t]-dj[r]);
      }
      if(!cv.length)continue;
      const b=bin[Math.min(rel,3)+2];b.s.push(ds[t]-ds[r]);b.c.push(ort(cv));
    }
    let var_=false;bin.forEach((b,i)=>{if(b.s.length){kutu[i].s.push(ort(b.s));kutu[i].c.push(ort(b.c));if(OLAY_BIN[i]!==0)var_=true}});if(var_)ogr.add(q.si_);
  }
  const nokta=OLAY_BIN.map((rel,i)=>{
    const S=kutu[i].s,C=kutu[i].c,n=S.length,bt=ortBoot(S,C),e=n?ort(S):null,c=n?ort(C):null;
    return {rel,ad:OLAY_AD[i],n,etut:{ort:e,ci:bt.s},kontrol:{ort:c,ci:bt.c},fark:{ort:n?e-c:null,ci:bt.f},az:n<EN_AZ};
  });
  return {ders,n:ogr.size,noktalar:nokta};
}
// What the chart says in two numbers: the gap (etüt line − ortalama) at the last position after the first etüt that has at least EN_AZ students, and the
// mean gap before it. null without such a position.
function olayOzeti(o){
  if(!o)return null;
  const mi=OLAY_BIN.indexOf(0);let son=null;
  for(let i=o.noktalar.length-1;i>mi;i--){const p=o.noktalar[i];if(p.n>=EN_AZ&&p.fark.ort!==null){son=p;break}}
  if(!son)return null;
  const on=o.noktalar.slice(0,mi).filter(p=>p.n>=EN_AZ&&p.fark.ort!==null).map(p=>p.fark.ort);
  return {fark:son.fark.ort,ad:son.ad,n:son.n,once:on.length?ort(on):null};
}
// The deneme-level outlier rule for one ders (see model): the per-student d series after the rule, and the list of flagged results.
function denemeUc(ogrD,ex,oturum,ders,kip,ref,onEk){
  const on=ogrD.map(s=>{const netler=ex.map(e=>netAl(s,e,oturum,ders));return {netler,dizi0:netler.map((v,i)=>v===null?null:kip==='ham'?v:ref[i]===null?null:r2(v-ref[i]))}});
  const sapma=[],medler=on.map(o=>{const v=o.dizi0.filter(x=>x!==null);if(v.length<3)return null;const m=medyan(v);v.forEach(x=>sapma.push(Math.abs(x-m)));return m});
  const mad=Math.max(medyan(sapma)||0,UC_TABAN_DENEME),ucListe=[];
  on.forEach((o,k)=>{o.uc=o.dizi0.map((x,i)=>{
    const bayrak=x!==null&&medler[k]!==null&&Math.abs(.6745*(x-medler[k])/mad)>UC_ESIK;
    if(bayrak)ucListe.push({id:ogrD[k].id,ad:ogrD[k].name,sinif:ogrD[k].cls,tur:'deneme',neden:(onEk?ders+' · ':'')+ex[i].etiket+': öğrencinin diğer denemelerinden çok farklı ('+isr(x-medler[k],1)+' net)'});
    return bayrak});o.dizi=o.dizi0.map((x,i)=>o.uc[i]?null:x)});
  return {on,ucListe};
}
// The panel: one row per student × ders that has a Türkiye farkı, over the dersler of the oturum. A ders with etüt: window from the exam
// before its first etüt to the student's last exam. A ders without: the window of the student's etüt dersler, the chosen ders first
// (so the lines of the event study share it), else the earliest etüt of any other ders; without any etüt first → last exam.
// change_z = α_student + β_ders + a_pair + b_ders·d_start_z + γ_ders·e (z: divided by the ders's school SD). dahil: the ids of the students
// with a window in the chosen ders (the same set the earlier method counts).
function panelKur({ogrD,ex,oturum,ders,kip,trFn,son,satir,dahil,on,ucSecili}){
  const gunler=new Set(ex.map(e=>e.gun)),dersAd=Object.keys(NET[oturum]),D={},ucDiger=[];
  for(const k of dersAd){
    if(k===ders){D[k]=on;continue}
    const kodlar=(TR_KOD[oturum]||{})[k]||[],ref=ex.map(e=>kip==='ham'?null:trOrtalama(trFn,e.ad,kodlar));
    if(kip!=='ham'&&!ref.some(v=>v!==null))continue;
    const r=denemeUc(ogrD,ex,oturum,k,kip,ref,true);
    if(!r.on.some(o=>o.dizi.filter(v=>v!==null).length>=2))continue;
    D[k]=r.on;ucDiger.push(...r.ucListe);
  }
  const etutAl=(s,k)=>(s.sessions||[]).filter(x=>x.date&&ETUT.dersAdi(x.course)===k&&etutOturum(x.course,oturum)).map(x=>({g:gunNo(x.date),hoca:U(x.teacher)||'?',ad:x.teacher})).filter(x=>!gunler.has(x.g)&&x.g<son).sort((a,b)=>a.g-b.g);
  const EH=ogrD.map(s=>{const E={};for(const k of Object.keys(D))E[k]=etutAl(s,k);return E});
  const ilkGunler=EH.flatMap(E=>Object.values(E).filter(l=>l.length).map(l=>l[0].g)),ilkGun=ilkGunler.length?Math.min(...ilkGunler):null,sd={};for(const k of Object.keys(D))sd[k]=olcek(D[k].map(o=>o.dizi),ex,ilkGun);
  const sat=new Map(satir.map(r=>[r.id,r])),adlar=new Map(),kisiler=[];
  for(const [si_,s] of ogrD.entries()){
    const rs=sat.get(s.id);if(!rs||!dahil.has(s.id))continue;
    const E=EH[si_];
    const gSel=E[ders].length?E[ders][0].g:null;let gDig=null;
    for(const k of Object.keys(D))if(k!==ders&&E[k].length)gDig=gDig===null?E[k][0].g:Math.min(gDig,E[k][0].g);
    const g0K=gSel!==null?gSel:gDig,rows=[];
    for(const k of Object.keys(D)){
      const d=D[k][si_].dizi;let w;
      if(E[k].length)w=pencereBul(d,ex,E[k][0].g);
      else{w=pencereBul(d,ex,g0K);if(!w&&g0K!==null)w=pencereBul(d,ex,null)}
      if(!w)continue;
      const ge=ex[w.si].gun,pen=E[k].filter(x=>x.g<ge);if(E[k].length&&!pen.length)continue;
      const tc={};for(const x of pen){tc[x.hoca]=(tc[x.hoca]||0)+1;if(!adlar.has(x.hoca))adlar.set(x.hoca,kisiAdi(x.ad)||'Öğretmen belirtilmemiş')}
      rows.push({k,y:(d[w.si]-d[w.bi])/sd[k],x0:d[w.bi]/sd[k],net:d[w.si]-d[w.bi],p:w.bi+'|'+w.si,e:pen.length,tc,bi:w.bi,si:w.si,isaret:w.isaret});
    }
    const sel=rows.find(r=>r.k===ders);if(!sel)continue;
    kisiler.push({si_,s,rs,rows,sel,E,gSel,aykiri:false});
  }
  // The design: b_ders·d_start_z (a column per ders), ders effects, pair intercepts, then the etüt columns (the chosen ders first).
  const KD=Object.keys(D).filter(k=>kisiler.some(q=>q.rows.some(r=>r.k===k))),kix=new Map(KD.map((k,i)=>[k,i]));
  const pairs=[...new Set(kisiler.flatMap(q=>q.rows.map(r=>r.p)))].sort(),pix=new Map(pairs.map((p_,i)=>[p_,i]));
  const eDers=KD.filter(k=>kisiler.some(q=>q.rows.some(r=>r.k===k&&r.e>0))).sort((a,b)=>(b===ders)-(a===ders));
  const hocaKeys=[...adlar.keys()],nb=KD.length,nd=Math.max(0,KD.length-1),np=Math.max(0,pairs.length-1),taban=nb+nd+np;
  const xVec=(r,mod)=>{
    const v=new Float64Array(taban+(mod==='ders'?eDers.length:hocaKeys.length)),ki=kix.get(r.k),pi=pix.get(r.p);
    v[ki]=r.x0;if(ki>0)v[nb+ki-1]=1;if(pi>0)v[nb+nd+pi-1]=1;
    if(mod==='ders'){const ei=eDers.indexOf(r.k);if(ei>=0)v[taban+ei]=r.e}else hocaKeys.forEach((h,j)=>{v[taban+j]=r.tc[h]||0});
    return v;
  };
  const pD=taban+eDers.length,pT=taban+hocaKeys.length,sec=eDers.indexOf(ders)>=0?taban+eDers.indexOf(ders):-1;
  for(const q of kisiler){q.XD=q.rows.map(r=>({x:xVec(r,'ders'),y:r.y}));q.XT=q.rows.map(r=>({x:xVec(r,'hoca'),y:r.y}))}
  // Students whose etüt ders departs from their own other dersler (modified z of the residual of the chosen ders above 3,5): fit, flag,
  // refit without them, judge everybody again, until the set stops changing (5 rounds at most); at most 20% are put aside.
  const residual=(q,beta)=>{
    const m=q.XD.length;if(m<2)return 0;
    const mx=new Float64Array(pD);let my=0;for(const r of q.XD){for(let c=0;c<pD;c++)mx[c]+=r.x[c];my+=r.y}for(let c=0;c<pD;c++)mx[c]/=m;my/=m;
    const r=q.XD[q.rows.indexOf(q.sel)];let e=(r.y-my);for(let c=0;c<pD;c++)if(beta[c])e-=beta[c]*(r.x[c]-mx[c]);return e*sd[ders];
  };
  let aykiri=new Set(),kesik=false,resSon=new Map();const aday=kisiler.filter(q=>q.rows.length>=2),enCok=Math.floor(aday.length*.2);
  if(pD&&aday.length>=UC_EN_AZ)for(let tur=0;tur<5;tur++){
    const kal=kisiler.filter(q=>!aykiri.has(q)),T=panelHazirla(kal.map(q=>q.XD),pD),top=panelTopla(T,pD),beta=panelCoz(top,pD,panelAktif(top,pD));
    const res=aday.map(q=>residual(q,beta)),tut=res.filter((_,i)=>!aykiri.has(aday[i])),m0=medyan(tut);if(m0===null)break;
    const mad=Math.max(medyan(tut.map(v=>Math.abs(v-m0))),UC_TABAN_FARK);
    let yeni=aday.map((q,i)=>({q,m:Math.abs(.6745*(res[i]-m0)/mad),r:res[i]})).filter(x=>x.m>UC_ESIK).sort((a,b)=>b.m-a.m);
    kesik=yeni.length>enCok;if(kesik)yeni=yeni.slice(0,enCok);
    resSon=new Map(yeni.map(x=>[x.q,x.r]));
    const k=new Set(yeni.map(x=>x.q));if(k.size===aykiri.size&&[...k].every(q=>aykiri.has(q)))break;
    aykiri=k;if(kesik)break;
  }
  kisiler.forEach(q=>{q.aykiri=aykiri.has(q)});
  const kept=kisiler.filter(q=>!q.aykiri);
  // The pooled fit and the per-teacher fit, both with a student effect for every student.
  const TD=panelHazirla(kept.map(q=>q.XD),pD),topD=panelTopla(TD,pD),aktD=panelAktif(topD,pD),betaD=pD?panelCoz(topD,pD,aktD):[];
  const katki=kept.filter(q=>q.rows.length>=2&&q.sel.e>0).length,kontrol=kept.filter(q=>q.rows.some(r=>r.e>0)&&q.rows.some(r=>r.e===0)).length;
  // Without a single ders that had no etüt, the level of γ is not identified (the dersler could only be told apart from each other).
  const gz=sec>=0&&kontrol>0?betaD[sec]:null,gamaP=gz===null||gz===undefined?null:gz*sd[ders];
  const ciP=gamaP===null?null:panelAralik(TD,pD,aktD,[sec],[sd[ders]])[0];
  const gosterKeys=hocaKeys.filter(h=>kept.some(q=>q.sel.tc[h]));
  const TT=panelHazirla(kept.map(q=>q.XT),pT),topT=panelTopla(TT,pT),aktT=panelAktif(topT,pT),betaT=pT?panelCoz(topT,pT,aktT):[];
  const hedefT=gosterKeys.map(h=>taban+hocaKeys.indexOf(h)),ciT=gosterKeys.length&&gamaP!==null?panelAralik(TT,pT,aktT,hedefT,hedefT.map(()=>sd[ders])):gosterKeys.map(()=>null);
  const hocalar=gosterKeys.map((key,j)=>{
    const l=kept.filter(q=>q.sel.tc[key]),etut=l.reduce((t,q)=>t+q.sel.tc[key],0),g=betaT[hedefT[j]],gam=g===null||g===undefined?null:g*sd[ders];
    const katk=kept.filter(q=>q.rows.length>=2&&new Set(q.rows.map(r=>r.tc[key]||0)).size>1).length;
    return {key,ad:adlar.get(key),n:l.length,etut,b:gam,ci:ciT[j]||null,toplam:gam===null?null:gam*etut,katki:katk,az:l.length<EN_AZ||gam===null};
  });
  const tSayi=h=>h.toplam===null?-Infinity:Math.round(h.toplam*1e6)/1e6;
  hocalar.sort((a,b)=>a.az-b.az||tSayi(b)-tSayi(a)||b.n-a.n||a.ad.localeCompare(b.ad,'tr'));
  hocalar.forEach((h,i)=>{h.sira=h.az?null:i>0&&!hocalar[i-1].az&&r2(hocalar[i-1].toplam)===r2(h.toplam)?hocalar[i-1].sira:i+1});
  // The students: the chosen ders's change against the mean change of their other dersler (in net of the chosen ders).
  const ogrenciler=kisiler.map(q=>{
    const r=q.rs,sel=q.sel,diger=q.rows.filter(x=>x.k!==ders),bek=diger.length?ort(diger.map(x=>x.y))*sd[ders]:null;
    let isx=null;if(q.gSel!==null){const g0=q.gSel;isx=0;for(let i=0;i<ex.length-1;i++)if(g0>=ex[i].gun)isx=i+Math.min(1,(g0-ex[i].gun)/Math.max(1,ex[i+1].gun-ex[i].gun))}
    const ad_={};for(const k of Object.keys(sel.tc))ad_[k]=adlar.get(k);
    return {id:r.id,no:r.no,ad:r.ad,sinif:r.sinif,n:sel.e,etut:q.gSel!==null,sayilar:sel.tc,adlar:ad_,onceAd:ex[sel.bi].etiket,onceD:r.dizi[sel.bi],onceIlk:sel.isaret,sonAd:ex[sel.si].etiket,sonD:r.dizi[sel.si],
      aykiri:q.aykiri,ucDeneme:r.uc.filter(Boolean).length,dizi0:r.dizi0,uc:r.uc,toplam:r2(sel.net),beklenen:bek===null?null:r2(bek),fark:bek===null?null:r2(sel.net-bek),dizi:r.dizi,isaret:isx,_egim:r._egim,_fark:bek===null?null:sel.net-bek,diger:diger.length};
  });
  const etutlu=ogrenciler.filter(o=>o.etut&&o.fark!==null&&!o.aykiri);
  const ozet=kisiler.length?{n:etutlu.length,katki:gamaP===null?0:katki,b:gamaP,ci:ciP,toplam:etutlu.length?ort(etutlu.map(o=>o.toplam)):null,beklenen:etutlu.length?ort(etutlu.map(o=>o.beklenen)):null,
    fark:etutlu.length?ort(etutlu.map(o=>o._fark)):null,etut:ogrenciler.reduce((t,o)=>t+o.n,0)}:null;
  const uc2=kisiler.filter(q=>q.aykiri).map(q=>({id:q.s.id,ad:q.s.name,sinif:q.s.cls,tur:'ogrenci',neden:'Etüt alınan ders, öğrencinin diğer derslerinden çok farklı ('+isr(resSon.get(q)??0,1)+' net fark)'}));
  if(kesik)uc2.push({tur:'ozet',neden:'uç sonuç çok fazla: en uç 20% dışarıda'});
  const bK=kix.has(ders)?betaD[kix.get(ders)]:null;
  return {ogrenciler,hocalar,ozet,karar:kararToplam(ozet?{b:ozet.b,ci:ozet.ci,n:ozet.katki,kontrol}:null),panel:{kontrol,katki,ogrenci:kisiler.length},kontrol:ogrenciler.filter(o=>!o.etut&&!o.aykiri).length,uc2,ucDiger,
    model:kisiler.length?{b:bK??0,gama:gamaP,cift:pairs.length,n:kisiler.reduce((t,q)=>t+q.rows.length,0),dersler:KD.length}:null,
    olay:olayKur(kisiler,D[ders],EH.map(E=>E[ders]),ders,ex),hocaOlay:Object.fromEntries(hocalar.map(h=>[h.key,olayKur(kisiler,D[ders],EH.map(E=>E[ders]),ders,ex,h.key)])),olcek:{ders:sd[ders],sd},dersSayisi:KD.length};
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
  // One result that does not fit the student's own record (a blank test, an illness): its deviation from the student's own median d,
  // against the MAD pooled over all students of the lesson (each has few exams), is flagged by the modified z-score. Students need
  // three results. A flagged result is left out everywhere below (windows, intervals, the line) and listed.
  const {on,ucListe}=denemeUc(ogrD,ex,oturum,ders,kip,ref,false);
  for(const [si_,s] of ogrD.entries()){
    const {netler,dizi,dizi0,uc}=Object.assign({},on[si_]);
    const anahtar=new Set(ex.map(e=>e.key)),girdi=new Set((s.exams||[]).filter(e=>e.session===oturum&&e.date&&anahtar.has(sinavAnahtari(e))).map(sinavAnahtari)).size;
    const oturduklari=[];netler.forEach((v,i)=>{if(v!==null&&!uc[i])oturduklari.push(i)});
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
      dizi,dizi0,uc,_egim:egim(dizi.map((v,i)=>v===null?null:[i,v]).filter(Boolean)),ar,_s:s});
  }
  const listeler=satir.map(r=>r.ar),etki=etkiHesapla(listeler,i=>i.e);
  etki.karar=karar(etki);
  const toplamAralik=satir.reduce((t,r)=>t+r.aralik,0);
  const hepsi=satir.map(({ar,_s,etutler,...r})=>r);
  // The earlier cross-student estimate (the secondary number), then the main within-student one over the same students.
  const top=toplamDegisim({satir,ex,oturum,ders,son,disarida,kapsam:null}),capraz={...top,uc:[...ucListe,...top.uc2]};
  const P=panelKur({ogrD,ex,oturum,ders,kip,trFn,son,satir,dahil:new Set(top.ogrenciler.map(o=>o.id)),on});
  return {...taban,ders,kip,listesiz,uc:[...ucListe,...P.ucDiger,...P.uc2],ogrenciler:P.ogrenciler,hocalar:P.hocalar,ozet:P.ozet,karar:P.karar,kontrol:P.kontrol,beklenen:P.model,hepsi,disarida,toplamOgrenci:ogrD.length,
    olay:P.olay,hocaOlay:P.hocaOlay,olcek:P.olcek,dersSayisi:P.dersSayisi,panel:P.panel,capraz,
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
// The lesson's line(s) on the Türkiye geneli page for the grade's group and session: the school's dilim in each exam of the
// period, and under it (same dates) the weekly etüts of the lesson. tv: the stored Türkiye geneli data (TURKIYE.oku().veri).
function durus(ogrD,m,tv){
  const yok=neden=>({durum:'yok',neden});
  if(!tv)return yok('Bu sınıf için Türkiye geneli listesi eklenmemiş.');
  // The same series the Türkiye geneli page draws: its list kind (Kolej / Tüm kurumlar / Kurs) and school choice, and every
  // deneme of the grade. A deneme is not cut by the students' period: one with no Sıralamalar list is dated by its report's
  // print day, which can fall days after the deneme, and cutting it hid exactly the latest change.
  const ek=typeof EK!=='undefined'?EK:{};
  let tm;try{tm=TURKIYE.model(tv,{duzey:'d'+m.duzey,oturum:m.oturum,liste:ek.tgListe,okul:ek.tgOkul})}catch(e){return yok('Türkiye geneli listesi okunamadı.')}
  if(!tm||tm.duzey!=='d'+m.duzey||tm.oturum!==m.oturum||!tm.sinavlar.length)return yok(m.duzey+'. sınıf '+m.oturum+' için Türkiye geneli listesi eklenmemiş.');
  const D=dilimler(),ad=TURKIYE.dersBilgi;
  const kodlar=(TR_KOD[m.oturum]||{})[m.ders]||[],cizgiler=[],kisaAd=TURKIYE.kisaAdlar?TURKIYE.kisaAdlar(tm.sinavlar):tm.sinavlar.map(s=>s.ad);
  kodlar.forEach((kod,q)=>{
    const d=tm.dersler.find(x=>denemeAdAnahtari(x.kod)===denemeAdAnahtari(kod));if(!d)return;
    const nokta=[];
    tm.sinavlar.forEach((s,i)=>{
      const dil=D.nokta(d.seri[i]);if(!Number.isFinite(s.g)||!Number.isFinite(dil))return;
      const sp=d.seri[i];nokta.push({g:s.g,sinav:s.ad,kisa:kisaAd[i],dilim:dil,t:D.tden(dil),tam:!!(sp&&sp.tam),okulN:sp&&sp.tam&&Number.isFinite(sp.n)?sp.n:null});
    });
    if(nokta.length)cizgiler.push({kod,ad:kodlar.length>1?ad(kod).ad:m.ders,renk:'var(--e-c'+(q+1)+')',nokta});
  });
  if(!cizgiler.length)return yok('Okul bu derste Türkiye geneli listesinde bulunamadı; Türkiye geneli sayfasında okulu seçin.');
  const g=cizgiler.flatMap(c=>c.nokta.map(p=>p.g)),g0=Math.min(...g),g1=Math.max(...g);
  const listeAd={kolej:'Kolej',kurum:'Tüm kurumlar',kurs:'Kurs'}[tm.liste]||'',kisa=TURKIYE.kisaAdlar?TURKIYE.kisaAdlar(tm.sinavlar):tm.sinavlar.map(s=>s.ad);
  const kaynak=[listeAd&&listeAd+' listesi',m.oturum+' '+m.ders,kisa[0]+(kisa.length>1?' → '+kisa.at(-1):''),tm.sinavlar.length+' deneme'].filter(Boolean).join(' · ');
  return {durum:'tamam',cizgiler,g0,g1,haftalik:haftalikEtut(ogrD,m.oturum,m.ders,g0,g1),yerelDilim:D.yerelMi,kaynak};
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
  const x=g=>L+(g1===g0?.5:(g-g0)/(g1-g0))*(R-L),y=t=>alt-(t-lo)/(hi-lo)*ph,sol=alt+36,sUst=sol+14,taban=sUst+54,H=taban+10;
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Okulun Türkiye\'deki yeri ve haftalık etüt sayısı">';
  svg+=tik.map(k=>'<line class="et-izgara" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(k.t))+'" y2="'+r1(y(k.t))+'"/><text class="et-tik" x="'+r1(L-6)+'" y="'+r1(y(k.t))+'" dy="0.32em" text-anchor="end">'+D.kisa(k.d)+'</text>').join('');
  const tarih=[...new Set(seriler.flatMap(s=>s.nokta.map(p=>p.g)))].sort((a,b)=>a-b);
  const adOf=new Map(seriler.flatMap(s=>s.nokta.map(p=>[p.g,p.kisa||''])));
  let sonX=-99;const yazilan=[],ara=Math.max(48,...[...adOf.values()].map(a=>yaziGen(a)+6));
  tarih.forEach((g,i)=>{const cx=x(g);if(cx-sonX>=ara){yazilan.push(g);sonX=cx}else if(i===tarih.length-1){yazilan.pop();yazilan.push(g);sonX=cx}});
  svg+=tarih.map(g=>'<line class="et-izgara ee-sinav" x1="'+r1(x(g))+'" x2="'+r1(x(g))+'" y1="'+ust+'" y2="'+taban+'"/>').join('');
  svg+='<line class="et-eksen" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+alt+'" y2="'+alt+'"/>';
  svg+=yazilan.map(g=>'<text class="et-tik" x="'+r1(x(g))+'" y="'+(alt+17)+'" text-anchor="middle">'+gunAy(g)+'</text>'+(adOf.get(g)?'<text class="et-tik ee-sinav-ad" x="'+r1(x(g))+'" y="'+(alt+31)+'" text-anchor="middle">'+kacis(adOf.get(g))+'</text>':'')).join('');
  for(const s of seriler){
    const pts=s.nokta.map(p=>[x(p.g),y(p.t)]);
    if(pts.length>1)svg+='<path class="ee-cizgi" style="stroke:'+s.renk+'" d="'+GRAFIK_CIZGI.yol(pts)+'"/>';
    svg+=s.nokta.map((p,i)=>'<circle class="ee-nokta'+(p.tam?' ee-tam':'')+'" cx="'+r1(pts[i][0])+'" cy="'+r1(pts[i][1])+'" r="4" style="'+(p.tam?'fill:var(--e-yuzey,#fff);stroke:'+s.renk+';stroke-width:2':'fill:'+s.renk)+'"><title>'+kacis(p.sinav+' · '+(seriler.length>1?s.ad+' · ':'')+D.yazi(p.dilim)+(p.tam?' · tam liste'+(p.okulN?' ('+p.okulN+' okul)':''):''))+'</title></circle>').join('');
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
// "Etüt aldıkça artış", directly: a dot per student, x = the etüts they took (of the chosen teacher when one is chosen, else all),
// y = their change since the first etüt (first exam without etüt) after the start level and the school's trend of their exam pair are
// taken out (the other teachers' etüts too, when one teacher is chosen). The line is the fitted gain per etüt, written on it; the
// zero line is "as expected without etüts". No names.
function farkSvg(m,W,hoca){
  const dar=W<520,k=hoca||'',h=k?m.hocalar.find(x=>x.key===k):null,gam=k?(h?h.b:null):m.ozet.b;
  const pts=m.ogrenciler.map((o,i)=>({x:k?(o.sayilar[k]||0):o.n,y:k?o._yT[k]:o._fark,i,uc:o.aykiri})).filter(p=>Number.isFinite(p.y));
  const xmax=Math.max(1,...pts.map(p=>p.x)),yv=pts.filter(p=>!p.uc).map(p=>p.y).concat(gam===null?[0]:[0,gam*xmax]),lo0=Math.min(...yv),hi0=Math.max(...yv),pay=Math.max(.5,(hi0-lo0)*.08);
  const tik=tikler(lo0-pay,hi0+pay,dar?4:5),lo=tik[0],hi=tik[tik.length-1],L=Math.max(...tik.map(t=>yaziGen(sayiEtiket(t))))+6,R=W-14,ust=14,ph=dar?210:260,alt=ust+ph,H=alt+44;
  const x=v=>L+(v+.5)/(xmax+1)*(R-L),y=v=>alt-(v-lo)/(hi-lo)*ph;
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Etüt sayısına göre artış">';
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+r1(L-6)+'" y="'+r1(y(t))+'" dy="0.32em" text-anchor="end">'+sayiEtiket(t)+'</text>').join('');
  svg+='<line class="et-eksen ee-sifir" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(0))+'" y2="'+r1(y(0))+'"/>';
  for(let v=0;v<=xmax;v++)svg+='<text class="et-tik" x="'+r1(x(v))+'" y="'+(alt+16)+'" text-anchor="middle">'+v+'</text>';
  svg+='<text class="ee-baslik" x="'+r1((L+R)/2)+'" y="'+(alt+36)+'" text-anchor="middle">Aldığı etüt sayısı'+(h?' ('+kacis(h.ad)+')':'')+'</text>';
  const yy=v=>Math.max(ust+4,Math.min(alt-4,y(v)));
  svg+=pts.map(p=>{const j=((p.i*37)%7-3)*.05;return '<circle class="ee-nokta ee-dagilim'+(p.uc?' ee-aykiri':'')+'" cx="'+r1(x(p.x+j))+'" cy="'+r1(p.uc?yy(p.y):y(p.y))+'" r="'+(dar?3.5:4.5)+'"><title>'+kacis(fi(p.x)+' etüt · '+isr(p.y,2)+' net'+(p.uc?' · aykırı, hesaba katılmadı':''))+'</title></circle>'+
    (p.uc?'<text class="et-tik ee-aykiri-ad" x="'+r1(x(p.x+j)<R-150?x(p.x+j)+8:x(p.x+j)-8)+'" y="'+r1(yy(p.y))+'" dy="0.32em" text-anchor="'+(x(p.x+j)<R-150?'start':'end')+'">aykırı, hesaba katılmadı</text>':'')}).join('');
  if(gam!==null){
    svg+='<line class="ee-ortcizgi ee-egri" x1="'+r1(x(0))+'" x2="'+r1(x(xmax))+'" y1="'+r1(y(0))+'" y2="'+r1(y(gam*xmax))+'"/>';
    const ly=y(gam*xmax)+(gam>=0?-9:15);
    svg+='<text class="ee-ad ee-egri-ad" x="'+r1(R-4)+'" y="'+r1(ly)+'" text-anchor="end">her etüt '+kacis(isr(gam,1))+' net</text>';
  }
  return svg+'</svg>';
}
// "Etütten önce ve sonra": the event study. x = exams relative to the first etüt of the ders (the reference, 0, is the exam before it),
// y = the mean change of the Türkiye farkı since the reference, in net of the ders. The etüt ders (solid, blue) and the same students'
// dersler without etüt (dashed, grey); a 95% whisker on each; the first etüt falls between the reference and the next exam (dotted
// marker). A point of fewer than EN_AZ students is faint. The count under each position is the same students for both lines.
function olaySvg(o,W,sec={}){
  const dar=W<520,N=o.noktalar,deger=N.flatMap(p=>[p.etut.ort,p.kontrol.ort,...(p.etut.ci||[]),...(p.kontrol.ci||[])].filter(v=>v!==null&&v!==undefined)),
    lo0=sec.y?sec.y[0]:Math.min(0,...deger),hi0=sec.y?sec.y[1]:Math.max(0,...deger),pay=Math.max(.3,(hi0-lo0)*.14),tik=tikler(lo0-(lo0<0?pay:0),hi0+pay,dar?4:5),lo=tik[0],hi=tik[tik.length-1],
    L=Math.max(...tik.map(t=>yaziGen(sayiEtiket(t))))+6,R=W-6,ust=26,ph=dar?200:250,alt=ust+ph,slot=(R-L)/N.length,cx=i=>L+slot*(i+.5),y=v=>alt-(v-lo)/(hi-lo)*ph;
  const mx=Math.max(5,Math.floor((slot-8)/5.8)),sar=t=>{const l=[];let c='';for(const w of t.split(' ')){if(c&&(c+' '+w).length>mx){l.push(c);c=w}else c=c?c+' '+w:w}if(c)l.push(c);return l};
  const mi0=OLAY_BIN.indexOf(0),satirlar=N.map(p=>sar(p.ad)),altSatir=Math.max(...satirlar.map(l=>l.length)),nY=alt+22+altSatir*14;
  // The strip under the chart: etüt line − expected line at each position, one bar from zero (grey before the first etüt, green above / red below after it).
  const sd_=N.map(p=>p.etut.ort!==null&&p.kontrol.ort!==null?p.etut.ort-p.kontrol.ort:null),guclu=N.map((p,i)=>i>mi0&&sd_[i]!==null&&p.etut.ort>0&&p.kontrol.ort<0),sm=Math.max(.3,sec.sy||Math.max(0,...sd_.filter(v=>v!==null).map(Math.abs))),
    sh=sec.net?64:80,baslik=dar?['Fark (net):','etüt alanlar − sınıf ortalaması']:['Fark (net): etüt alanlar − sınıf ortalaması'],sT=nY+16,sTop=sT+baslik.length*14+8,sZ=sTop+sh/2,sy=v=>sZ-v/sm*(sh/2-13),H=sTop+sh+24;
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Etütten önce ve sonra">';
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+r1(L-6)+'" y="'+r1(y(t))+'" dy="0.32em" text-anchor="end">'+sayiEtiket(t)+'</text>').join('');
  svg+='<line class="et-eksen ee-sifir" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(0))+'" y2="'+r1(y(0))+'"/>';
  if(sec.net)svg+='<text class="et-tik ee-baslik" x="2" y="12">net</text>';
  const mi=OLAY_BIN.indexOf(0),mxX=(cx(mi)+cx(mi+1))/2,onGen=mxX-L;
  svg+='<rect class="ee-ol-on-alan" x="'+r1(L)+'" y="'+(ust-4)+'" width="'+r1(onGen)+'" height="'+(alt-ust+4)+'"/>'+(onGen<200?['Etütten önce','birlikte gitmeli']:['Etütten önce birlikte gitmeli']).map((t,j)=>'<text class="et-tik ee-ol-on-ad" x="'+r1(L+5)+'" y="'+(ust+10+j*13)+'">'+t+'</text>').join('');
  svg+='<line class="ee-etutim ee-ol-isaret" x1="'+r1(mxX)+'" x2="'+r1(mxX)+'" y1="'+(ust-4)+'" y2="'+alt+'"/><text class="et-tik ee-ol-isaret-ad" x="'+r1(mxX)+'" y="'+(ust-10)+'" text-anchor="middle">İlk etüt</text>';
  // After the first etüt: the area between the etüt line and the expected line, green where the etüt line is above, red where below; a segment that crosses is split at the crossing.
  const ev=i=>N[i].etut.ort,kv=i=>N[i].kontrol.ort,poly=(pt,c,az)=>'<polygon class="ee-ol-alan ee-ol-alan-'+c+(az?' ee-ol-az':'')+'" points="'+pt.map(q=>r1(q[0])+','+r1(q[1])).join(' ')+'"/>';
  for(let i=mi;i<N.length-1;i++){
    if(ev(i)===null||kv(i)===null||ev(i+1)===null||kv(i+1)===null)continue;
    const d0=ev(i)-kv(i),d1=ev(i+1)-kv(i+1),az=N[i].az||N[i+1].az,x0=cx(i),x1=cx(i+1),c=d=>d>0?'ok':'bad';
    if(d0*d1<0){
      const t=d0/(d0-d1),xc=x0+t*(x1-x0),yc=y(ev(i)+t*(ev(i+1)-ev(i)));
      svg+=poly([[x0,y(ev(i))],[xc,yc],[x0,y(kv(i))]],c(d0),az)+poly([[xc,yc],[x1,y(ev(i+1))],[x1,y(kv(i+1))]],c(d1),az);
    }else if(d0||d1)svg+=poly([[x0,y(ev(i))],[x1,y(ev(i+1))],[x1,y(kv(i+1))],[x0,y(kv(i))]],c(d0||d1),az);
  }
  const seri=[['kontrol','ee-ol-kont',-3],['etut','ee-ol-etut',3]];
  for(const [ad,sinif,dx] of seri){
    const pts=N.map((p,i)=>p[ad].ort===null?null:{x:cx(i),y:y(p[ad].ort),az:p.az,p,i});
    for(let i=0;i<pts.length-1;i++)if(pts[i]&&pts[i+1])svg+='<line class="'+sinif+' ee-ol-cizgi'+(pts[i].az||pts[i+1].az?' ee-ol-az':'')+'" x1="'+r1(pts[i].x)+'" y1="'+r1(pts[i].y)+'" x2="'+r1(pts[i+1].x)+'" y2="'+r1(pts[i+1].y)+'"/>';
    for(const q of pts){
      if(!q)continue;const ci=q.p[ad].ci,wx=q.x+dx,gap=sd_[q.i],renk=ad==='etut'&&q.i>mi&&gap!==null&&gap!==0?(guclu[q.i]?' ee-ol-ok ee-ol-guclu':gap>0?' ee-ol-ok':' ee-ol-bad'):'';
      const ip=kacis(q.p.ad+' · '+(ad==='etut'?'etüt alan öğrenciler':'sınıf ortalaması (etüt almayanlar)')+' · '+isr(q.p[ad].ort,2)+' net'+(ci?' (olası aralık '+isr(ci[0],2)+' … '+isr(ci[1],2)+')':'')+' · '+fi(q.p.n)+' öğrenci');
      svg+='<g class="'+sinif+' ee-ol-nokta'+renk+(q.az?' ee-ol-az':'')+'">'+(ci&&q.p.rel!==0?'<line class="ee-biyik" x1="'+r1(wx)+'" x2="'+r1(wx)+'" y1="'+r1(y(ci[0]))+'" y2="'+r1(y(ci[1]))+'"/><line class="ee-biyik" x1="'+r1(wx-4)+'" x2="'+r1(wx+4)+'" y1="'+r1(y(ci[0]))+'" y2="'+r1(y(ci[0]))+'"/><line class="ee-biyik" x1="'+r1(wx-4)+'" x2="'+r1(wx+4)+'" y1="'+r1(y(ci[1]))+'" y2="'+r1(y(ci[1]))+'"/>':'')+
        '<circle cx="'+r1(q.x)+'" cy="'+r1(q.y)+'" r="'+(renk.includes('guclu')?(dar?6:6.5):(dar?4:4.5))+'"><title>'+ip+'</title></circle></g>';
    }
  }
  // The right end says how far the etüt line is from the ortalama line; the first point after the first etüt where the etüt line rose while the ortalama fell is named.
  let son=-1;for(let i=N.length-1;i>mi;i--)if(sd_[i]!==null){son=i;break}
  if(son>mi){
    const g=sd_[son],yy=g>=0?y(Math.max(ev(son),kv(son)))-12:y(Math.min(ev(son),kv(son)))+20;
    svg+='<text class="ee-deger ee-ol-d-'+(g>=0?'ok':'bad')+'" x="'+r1(R-2)+'" y="'+r1(yy)+'" text-anchor="end">'+isr(g,1)+' net ortalamadan '+(g>=0?'fazla':'az')+'</text>';
  }
  const gi=guclu.findIndex((v,i)=>v&&i!==son);
  if(gi>=0)svg+='<text class="ee-deger ee-ol-rozet" x="'+r1(Math.max(L+68,Math.min(R-68,cx(gi))))+'" y="'+r1(y(ev(gi))-13)+'" text-anchor="middle">ortalama düşerken arttı</text>';
  N.forEach((p,i)=>{
    svg+=satirlar[i].map((t,j)=>'<text class="et-tik ee-ol-ad'+(p.az?' ee-ol-az':'')+'" x="'+r1(cx(i))+'" y="'+(alt+16+j*14)+'" text-anchor="middle">'+kacis(t)+'</text>').join('');
    svg+='<text class="et-tik ee-say'+(p.az?' ee-ol-az':'')+'" x="'+r1(cx(i))+'" y="'+nY+'" text-anchor="middle">'+(p.n?'n = '+fi(p.n):'yok')+'</text>';
  });
  svg+=baslik.map((t,j)=>'<text class="et-tik ee-baslik ee-sb-baslik" x="'+r1(L)+'" y="'+(sT+j*14)+'">'+t+'</text>').join('');
  svg+='<line class="et-eksen ee-sb-sifir" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(sZ)+'" y2="'+r1(sZ)+'"/>';
  const bw=Math.min(dar?24:34,slot*.55);
  N.forEach((p,i)=>{
    const d=sd_[i];if(d===null)return;const onUyari=i<mi&&Math.abs(d)>.5&&!(p.fark.ci&&p.fark.ci[0]<=0&&p.fark.ci[1]>=0),sinif=i<mi?(onUyari?'uyari':'on'):i===mi?'on':guclu[i]?'guclu':d>0?'ok':d<0?'bad':'on',yv=sy(d),ust_=Math.min(sZ,yv),hh=Math.abs(yv-sZ);
    svg+='<g class="ee-sb-g'+(p.az?' ee-ol-az':'')+'"><rect class="ee-sb ee-sb-'+sinif+'" data-d="'+(Math.round(d*1e4)/1e4)+'" x="'+r1(cx(i)-bw/2)+'" y="'+r1(ust_)+'" width="'+r1(bw)+'" height="'+r1(Math.max(hh,sinif==='on'&&!hh?0:1))+'"><title>'+kacis(p.ad+' · etüt farkı '+isr(d,2)+' net · '+fi(p.n)+' öğrenci')+'</title></rect>'+
      '<text class="ee-sb-d" x="'+r1(cx(i))+'" y="'+r1(d>=0?ust_-4:ust_+hh+11)+'" text-anchor="middle">'+isr(d,1)+'</text></g>';
  });
  const uyari=N.some((p,i)=>i<mi&&sd_[i]!==null&&Math.abs(sd_[i])>.5&&!(p.fark.ci&&p.fark.ci[0]<=0&&p.fark.ci[1]>=0));
  svg+='<text class="et-tik ee-sb-not'+(uyari?' ee-sb-uyari':'')+'" x="'+r1((cx(0)+cx(mi))/2)+'" y="'+(sTop+sh+16)+'" text-anchor="middle">'+(uyari?'etütten önce de farklıydı':'önce: ≈ 0 olmalı')+'</text>';
  return svg+'</svg>';
}
// One y range for every teacher's chart: the extremes of all the lines and whiskers, and 0.
function ortakY(m){
  const v=[0];for(const h of m.hocalar){const o=m.hocaOlay&&m.hocaOlay[h.key];if(o)for(const p of o.noktalar)for(const x of [p.etut.ort,p.kontrol.ort,...(p.etut.ci||[]),...(p.kontrol.ci||[])])if(x!==null&&x!==undefined)v.push(x)}
  return [Math.min(...v),Math.max(...v)];
}
// One strip scale for every teacher's chart: the largest gap between the etüt line and the expected line.
function ortakS(m){
  let v=.3;for(const h of m.hocalar){const o=m.hocaOlay&&m.hocaOlay[h.key];if(o)for(const p of o.noktalar)if(p.etut.ort!==null&&p.kontrol.ort!==null)v=Math.max(v,Math.abs(p.etut.ort-p.kontrol.ort))}
  return v;
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
  const secili=m.capraz.hocalar.some(h=>h.key===EK.eeHoca)?EK.eeHoca:'',cap={ogrenciler:m.capraz.ogrenciler,hocalar:m.capraz.hocalar,ozet:m.capraz.ozet};
  const yh=ortakY(m),sh_=ortakS(m);
  m.hocalar.forEach((h,i)=>{const o=m.hocaOlay[h.key];if(o)cizim('#eeHocaGrafik .ee-hoca-kart:nth-of-type('+(i+1)+') .et-grafik',h.key+'|'+yh.join()+'|'+sh_+'|'+o.noktalar.map(p=>[p.n,p.etut.ort,p.kontrol.ort,(p.etut.ci||[]).join(),(p.kontrol.ci||[]).join()].join(':')).join('/'),W=>olaySvg(o,W,{y:yh,sy:sh_,net:true}))});
  cizim('#eeOlay .et-grafik',m.olay.noktalar.map(p=>[p.n,p.etut.ort,p.kontrol.ort,(p.etut.ci||[]).join(),(p.kontrol.ci||[]).join()].join(':')).join('/'),W=>olaySvg(m.olay,W));
  if(cap.ozet&&cap.ogrenciler.length)cizim('#eeFark .et-grafik',secili+'|'+cap.ogrenciler.map(o=>o.fark+':'+o.n).join()+'|'+cap.ozet.b+'|'+cap.hocalar.map(h=>h.b).join(),W=>farkSvg(cap,W,secili));
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
const degisim=v=>Math.abs(v)<.05?'değişmedi':isr(v,1)+' net '+(v>0?'arttı':'azaldı');
function ozetYazisi(m){
  const o=m.ozet,b=t=>'<b>'+t+'</b>';
  if(!o)return 'Değişimi hesaplanabilen öğrenci yok.';
  if(o.b===null)return 'Bu ders için öğrencinin kendi diğer dersleriyle kıyaslama yapılamadı: hem etüt aldığı hem almadığı dersi olan öğrenci yok ya da çok az.';
  return 'Her etüt ≈ '+b(isr(o.b,1)+' net')+(o.ci?' (olası aralık '+isr(o.ci[0],1)+' … '+isr(o.ci[1],1)+')':'')+', aynı öğrencinin diğer derslerine göre.'+
    (o.n&&o.toplam!==null&&o.beklenen!==null?' Etüt alan '+b(fi(o.n)+' öğrenci')+': '+kacis(m.ders)+' ortalama '+b(degisim(o.toplam))+', diğer dersleri ortalama '+b(degisim(o.beklenen))+'.':'');
}
// The chart's own sentence: after the first etüt, how far the etüt students are from the class average (the last position with at least 5 students), and before it.
function olayYazisi(o,onek=''){
  const z=olayOzeti(o);if(!z)return onek+'Etütten sonra karşılaştırılacak yeterli öğrenci yok.';
  return onek+'İlk etütten sonra etüt alanlar sınıf ortalamasından ≈ <b>'+isr(z.fark,1)+' net '+(z.fark>=0?'fazla':'az')+'</b> arttı'+(z.once!==null?' (etütten önce fark ≈ '+isr(z.once,1)+')':'')+' · '+kacis(z.ad)+', '+fi(z.n)+' öğrenci.';
}
function eslesmeYazisi(m){
  const s=m.esli;if(!s)return '';
  const b=t=>'<b>'+t+'</b>';
  return 'Hem etüt aldığı hem almadığı deneme arası olan '+b(fi(s.n)+' öğrenci')+': etüt alınan aralarda ortalama '+b(isr(s.etutlu,2)+' net')+', alınmayanlarda '+b(isr(s.etutsuz,2)+' net')+'; fark '+b(isr(s.fark,2))+
    (s.ci?' (olası aralık '+isr(s.ci[0],2)+' … '+isr(s.ci[1],2)+').':'.');
}
function sayimYazisi(m){
  const d=m.disarida.length,n=m.ogrenciler.length,e=n-m.kontrol;
  return fi(m.toplamOgrenci)+' öğrenciden '+sahip(n)+' sayıldı ('+fi(e)+' etüt alan, '+fi(m.kontrol)+' etüt almayan)'+(d?'; '+sahip(d)+' dışarıda (aşağıda listelenir).':'.');
}
function sutunlar(l){return '<colgroup>'+l.map(c=>'<col class="'+c+'">').join('')+'</colgroup>'}
const baslikSatiri=l=>'<thead><tr>'+l.map(([a,c])=>'<th'+(c?' class="'+c+'"':'')+'>'+a+'</th>').join('')+'</tr></thead>';
const aralikYazi=ci=>ci?isr(ci[0],2)+' … '+isr(ci[1],2):'';
const gitDugme=(sekme,ad)=>'<button type="button" class="et-dugme" data-sekme="'+sekme+'">'+ad+' →</button>';
function olayPaneli(m){
  const o=m.olay,bas='<div class="et-kart-bas"><h2>'+kacis('Etütten önce ve sonra · '+m.ders)+'</h2>';
  if(!o||o.n<2)return '<section class="et-panel" id="eeOlay">'+bas+'</div><p class="mini ee-yok">Bu grafik için etüt alan ve karşılaştırılacak etüt almayan öğrenci yeterli değil.</p></section>';
  return '<section class="et-panel" id="eeOlay">'+bas+'<span class="mini">'+kacis('İlk etütten önceki denemeye göre Türkiye farkındaki toplam değişim, net. Etüt alan '+fi(o.n)+' öğrenci; karşılaştırma: aynı denemelerde etüt almayan sınıf arkadaşları.')+'</span></div>'+
    '<div class="ee-lejant" id="eeLejant"><span><i class="ee-sw ee-sw-etut"></i>Etüt alan öğrenciler</span><span><i class="ee-sw ee-sw-kont"></i>Sınıf ortalaması (etüt almayanlar)</span></div>'+
    '<div class="et-grafik ee-grafik" role="group" aria-label="Etütten önce ve sonra"></div>'+
    '<p class="et-cumle" id="eeOlayNot">Etütten önce iki çizgi birlikte gidiyor, sonra etüt alanların çizgisi sınıf ortalamasından yukarı ayrılıyorsa artış etüte bağlanabilir. Önceden de ayrılıyorsa bu başka bir farktır.</p>'+
    '<p class="mini">Yeşil: etüt alanlar sınıf ortalamasının üstünde (koyu yeşil: ortalama düşerken arttı), kırmızı: altında. Gri alan: etütten önce çizgiler birlikte gitmeli. Çizgiler %95 olası aralık. Soluk nokta: 5’ten az öğrenci.</p></section>';
}
// The earlier view, kept as supporting evidence: the gain between two exams by the etüts taken in between, each student compared with themself.
function aralikBlogu(m,secili){
  const bir=m.kip==='turkiye'?'Türkiye farkındaki artış':'net artışı',k=m.etki.karar,c=m.capraz.ozet,h=m.capraz.hocalar.find(x=>x.key===secili);
  const capraz=c&&c.b!==null?'Öğrenciler arası karşılaştırma: her etüt ≈ <b>'+isr(c.b,1)+' net</b>'+(c.ci?' (olası aralık '+isr(c.ci[0],1)+' … '+isr(c.ci[1],1)+')':'')+'. Çok etüt alan öğrenciler zaten çalışkan olabilir; bu sayı onların çalışkanlığını da içerir, o yüzden başlıktaki sayıdan büyük çıkabilir.':
    'Öğrenciler arası karşılaştırma: etüt sayısı öğrenciler arasında yeterince değişmediği için hesaplanamadı.';
  return '<details id="eeAralik"><summary>Ayrıntı</summary><div class="ee-nasil">'+
    '<p class="et-cumle" id="eeCapraz">'+capraz+'</p>'+
    (c&&c.b!==null?'<div id="eeFark"><h3 class="ee-alt-baslik">'+kacis('Etüt aldıkça artış · öğrenciler arası'+(h?' · '+h.ad:''))+'</h3><p class="mini">'+kacis('Her nokta bir öğrenci: yatayda aldığı etüt sayısı, dikeyde değişimi (başlangıç düzeyi ve okulun genel gidişi çıkarıldıktan sonra, net). Çizgi: her etüt için ortalama artış. Öğrenciler birbirleriyle kıyaslanır.')+'</p><div class="et-grafik ee-grafik" role="group" aria-label="Etüt sayısına göre artış"></div></div>':'')+
    '<h3 class="ee-alt-baslik">Deneme aralarına göre</h3>'+
    '<p class="et-cumle ee-karar ee-k-'+k.k+'" id="eeAralikKarar"><b>'+kacis(k.yazi)+'</b></p>'+(m.esli?'<p class="et-cumle" id="eeEslesme">'+eslesmeYazisi(m)+'</p>':'')+
    '<p class="mini">'+kacis('Her çubuk: iki deneme arasında o kadar etüt alınan aralarda ortalama '+bir+' (net). Çizgiler %95 olası aralık; soluk çubuk 5’ten az deneme arası. Her öğrenci kendi gidişiyle kıyaslanır.')+'</p>'+
    '<div id="eeArtis"><div class="et-grafik ee-grafik" role="group" aria-label="Etüt aldıkça artış"></div></div></div></details>';
}
function durusPaneli(st,m){
  const bas='<div class="et-kart-bas"><h2>'+kacis('Okulun Türkiye’deki yeri · '+m.ders)+'</h2>';
  if(st.durum!=='tamam')return '<section class="et-panel" id="eeGrafik">'+bas+'</div><p class="mini ee-yok">'+kacis(st.neden)+'</p><div class="et-arac">'+gitDugme('turkiye','Türkiye geneli')+'</div></section>';
  return '<section class="et-panel" id="eeGrafik">'+bas+'<span class="mini">Yukarı çıkmak, Türkiye’de daha üst dilime girmektir. Altta aynı tarihlerde dersin haftalık etütü.</span></div><div class="et-grafik ee-grafik" role="group" aria-label="Okulun Türkiye’deki yeri"></div><p class="mini" id="eeDurusKaynak">'+kacis('Türkiye geneli sayfasındaki ders çizgisinin aynısı: '+st.kaynak)+'</p>'+
    (st.cizgiler.some(c=>c.nokta.some(p=>p.tam))?'<p class="mini" id="eeTamListe">'+kacis('İçi boş nokta: tam liste ('+[...new Set(st.cizgiler.flatMap(c=>c.nokta.filter(p=>p.tam).map(p=>p.kisa+(p.okulN?', '+p.okulN+' okul':''))))].join('; ')+'). O denemeye daha az okul girdi; sıra yalnızca bu okullar arasındadır, diğer denemelerle tam karşılaştırılamaz.')+'</p>':'')+
    '<p class="mini" id="eeIkiGrafik">'+kacis('Bu grafik okulun Türkiye’deki okullar arasındaki yerini gösterir. “Etütten önce ve sonra” ise okulun içinde, etüt alınan dersi aynı öğrencilerin diğer dersleriyle karşılaştırır; okulun genel gidişi orada çıkarılmıştır. Okul bir denemede geriye düşse de etüt alınan ders diğer derslerden daha az düşmüş ya da yükselmiş olabilir; iki grafik bu yüzden birbirini yalanlamaz.')+'</p></section>';
}
// A small "Etütten önce ve sonra" per teacher who gave etüts of the ders, in the table's order, the same y range for all.
function hocaKartlari(m,secili){
  const l=m.hocalar.filter(h=>m.hocaOlay&&m.hocaOlay[h.key]&&m.hocaOlay[h.key].n>=1);if(!l.length)return '';
  const kart=h=>'<div class="ee-hoca-kart'+(h.az?' ee-az':'')+(secili===h.key?' secili':'')+'" data-ee-hoca="'+kacis(h.key)+'"><div class="ee-kart-ust"><button type="button" class="ee-kart-ad" data-ee-hoca="'+kacis(h.key)+'" aria-pressed="'+(secili===h.key)+'">'+kacis(h.ad)+'</button><span class="mini">'+(h.sira===null?'sıralanmadı':'Sıra '+fi(h.sira))+'</span></div>'+
    '<p class="et-cumle ee-kart-say">'+(h.b===null?'Her etüt için artış hesaplanamadı':'Her etüt ≈ <b>'+isr(h.b,2)+' net</b>'+(h.ci?' (olası aralık '+isr(h.ci[0],2)+' … '+isr(h.ci[1],2)+')':''))+' · '+fi(h.n)+' öğrenci · '+fi(h.etut)+' etüt</p>'+
    '<p class="et-cumle ee-kart-say ee-kart-olay">'+olayYazisi(m.hocaOlay[h.key])+'</p>'+(h.n<EN_AZ?'<p class="mini ee-kart-az">5’ten az öğrenci: kesin değil</p>':'')+'<div class="et-grafik ee-grafik" role="group" aria-label="'+kacis(h.ad)+' · Etütten önce ve sonra"></div></div>';
  return '<h3 class="ee-alt-baslik" id="eeHocaBaslik">Etütten önce ve sonra · öğretmene göre</h3><p class="mini">Her grafik yalnızca o öğretmenden etüt alan öğrencileri gösterir; sıfır noktası o öğretmenle ilk etütten önceki deneme; karşılaştırma yine etüt almayan sınıf arkadaşlarıdır. Hepsi aynı ölçektedir.</p>'+
    '<div class="ee-lejant" id="eeHocaLejant"><span><i class="ee-sw ee-sw-etut"></i>Etüt alan öğrenciler</span><span><i class="ee-sw ee-sw-kont"></i>Sınıf ortalaması (etüt almayanlar)</span></div>'+
    '<div id="eeHocaGrafik" class="ee-hoca-izgara">'+l.map(kart).join('')+'</div>';
}
function hocaTablosu(m,secili){
  const satir=h=>'<tr'+(secili===h.key?' class="secili'+(h.az?' ee-az':'')+'"':h.az?' class="ee-az"':'')+'><td class="sayi ee-sira">'+(h.sira===null?'—':fi(h.sira))+'</td><td class="tg-ad"><button type="button" class="ee-ad" data-ee-hoca="'+kacis(h.key)+'" aria-pressed="'+(secili===h.key)+'">'+kacis(h.ad)+'</button>'+
    '<div class="mini">'+fi(h.n)+' öğrenci · '+fi(h.etut)+' etüt'+(h.az?' · az öğrenci, sıralanmadı':'')+'</div></td><td class="sayi et-dar-gizle">'+fi(h.n)+'</td><td class="sayi et-dar-gizle">'+fi(h.etut)+'</td><td class="sayi'+yonlu(h.toplam)+'">'+ok(h.toplam)+'</td><td class="sayi'+yonlu(h.b)+'">'+ok(h.b)+(h.ci?'<div class="mini">'+aralikYazi(h.ci)+'</div>':'')+'</td></tr>';
  return '<section class="et-panel" id="eeHocalar"><div class="et-kart-bas"><h2>Öğretmenlere göre</h2><span class="mini">Her öğretmenin etüt başına kazancı, aynı öğrencinin diğer derslerine göre (öbür öğretmenlerin etütleri sabit tutulur). Toplam katkı = bu kazanç × verdiği etüt. Bir öğretmene basınca öğrenciler aşağıda o öğretmenin etüt verdikleriyle sınırlanır.</span></div><div class="et-tablo-kutu"><table class="et-tablo ee-tablo">'+sutunlar(['sira','ad','s1 et-dar-gizle','s1 et-dar-gizle','s4','s7'])+
    baslikSatiri([['Sıra','sayi ee-sira'],['Öğretmen'],['Öğrenci','sayi et-dar-gizle'],['Etüt','sayi et-dar-gizle'],['Toplam katkı (net)','sayi'],['Her etüt için artış (net)','sayi']])+
    '<tbody>'+(m.hocalar.length?m.hocalar.map(satir).join(''):'<tr><td colspan="6" class="mini">Bu dönemde etüt alıp sonrasında denemeye giren öğrenci yok.</td></tr>')+'</tbody></table></div>'+hocaKartlari(m,secili)+'</section>';
}
// A student's Türkiye farkı (their net when no list) over the exams of the period as a small line, with a marker where the first etüt was.
function kucukCizgi(r){
  const v=r.dizi.filter(x=>x!==null),n=r.dizi.length,G=84,Y=22,lo=Math.min(...v),hi=Math.max(...v);
  const x=i=>2+(G-4)*(n>1?i/(n-1):.5),y=a=>Math.max(2,Math.min(Y-2,Y-3-(hi===lo?.5:(a-lo)/(hi-lo))*(Y-6))),renk=r.toplam>0?'var(--e-ok)':r.toplam<0?'var(--e-bad)':'var(--e-muted)';
  const uc=r.uc||[],pts=r.dizi.map((a,i)=>a===null?null:[x(i),y(a)]);let yol_='',run=[];
  const bitir=()=>{if(run.length>1)yol_+='<path class="et-kucuk" style="stroke:'+renk+'" d="M'+run.map(p=>r1(p[0])+','+r1(p[1])).join('L')+'"/>';run=[]};
  pts.forEach((p,i)=>{if(p)run.push(p);else if(!uc[i])bitir()});bitir();
  const im=Number.isFinite(r.isaret)?'<line class="ee-etutim" x1="'+r1(x(r.isaret))+'" x2="'+r1(x(r.isaret))+'" y1="0" y2="'+Y+'"><title>İlk etüt</title></line>':'';
  const bos=uc.map((b,i)=>b&&r.dizi0&&r.dizi0[i]!==null?'<circle class="ee-bosnokta" cx="'+r1(x(i))+'" cy="'+r1(y(r.dizi0[i]))+'" r="2.4" style="stroke:'+renk+'"><title>Uç sonuç, hesaba katılmadı</title></circle>':'').join('');
  return '<svg viewBox="0 0 '+G+' '+Y+'" width="'+G+'" height="'+Y+'" aria-hidden="true">'+im+yol_+pts.map(p=>p?'<circle cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="2" style="fill:'+renk+'"/>':'').join('')+bos+'</svg>';
}
function ogrenciTablosu(m,secili){
  const hoca=new Map(m.hocalar.map(h=>[h.key,h.ad]));
  const l=m.ogrenciler.filter(r=>!secili||r.sayilar[secili]).sort((a,b)=>(b._fark??-1e9)-(a._fark??-1e9)||a.ad.localeCompare(b.ad,'tr'));
  const dg=v=>m.kip==='turkiye'?isr(v,2):f2(v),sayi=v=>'<td class="sayi'+yonlu(v)+'">'+ok(v)+'</td>';
  const deneme=(ad,d,not)=>'<td class="sayi et-dar-gizle">'+dg(d)+'<div class="mini">'+kacis(ad)+(not?' · '+not:'')+'</div></td>';
  const satir=r=>'<tr'+(r.aykiri?' class="ee-az ee-ucsatir"':'')+'><td class="tg-ad">'+(r.no?ANALIZ.adDugmesi(r.no,kisiAdi(r.ad)):kacis(kisiAdi(r.ad)))+(r.aykiri?'<div class="mini">aykırı, hesaba katılmadı</div>':r.ucDeneme?'<div class="mini">'+fi(r.ucDeneme)+' deneme uç, hesaba katılmadı</div>':'')+'</td>'+deneme(r.onceAd,r.onceD,r.onceIlk?'etüt bu denemeden önce başladı':r.etut?'':'etüt almadı')+deneme(r.sonAd,r.sonD,'')+
    sayi(r.toplam)+'<td class="sayi et-dar-gizle">'+(r.beklenen===null?'—':ok(r.beklenen))+'</td>'+sayi(r.fark)+'<td class="sayi et-dar-gizle">'+fi(r.n)+'</td>'+
    '<td class="et-dar-gizle ee-paylar">'+(Object.keys(r.sayilar).length?Object.keys(r.sayilar).sort((a,b)=>r.sayilar[b]-r.sayilar[a]).map(k=>kacis(r.adlar[k])+' · '+fi(r.sayilar[k])+' etüt').join('<br>'):'—')+'</td><td class="et-trend">'+kucukCizgi(r)+'</td></tr>';
  const disarida=m.disarida.length?'<details id="eeDisarida"><summary>Dışarıda kalan '+fi(m.disarida.length)+' öğrenci</summary><ul>'+
    m.disarida.slice().sort((a,b)=>a.ad.localeCompare(b.ad,'tr')).map(d=>'<li>'+kacis(kisiAdi(d.ad))+' · '+kacis(d.sinif||'—')+' · '+kacis(d.neden)+'</li>').join('')+'</ul></details>':'';
  return '<section class="et-panel" id="eeOgrenciler"><div class="et-kart-bas"><h2>'+kacis('Öğrenciler'+(secili?' · '+(hoca.get(secili)||''):''))+'</h2>'+
    (secili?'<button type="button" class="et-dugme" data-ee-hoca="">Tüm öğretmenler</button>':'<span class="mini">'+fi(l.length)+' öğrenci</span>')+'</div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo ee-tablo ee-ogr">'+sutunlar(['ad','s8 et-dar-gizle','s8 et-dar-gizle','s4','s4 et-dar-gizle','s4','s1 et-dar-gizle','s9 et-dar-gizle','s6'])+
    baslikSatiri([['Öğrenci'],['Etütten önce','sayi et-dar-gizle'],['Son deneme','sayi et-dar-gizle'],['Bu dersteki değişim (net)','sayi'],['Diğer derslerinde, ortalama (net)','sayi et-dar-gizle'],['Fark (net)','sayi'],['Etüt','sayi et-dar-gizle'],['Öğretmenler','et-dar-gizle'],[m.kip==='turkiye'?'Türkiye farkı':'Net']])+
    '<tbody>'+(l.length?l.map(satir).join(''):'<tr><td colspan="9" class="mini">Öğrenci yok.</td></tr>')+'</tbody></table></div>'+disarida+'</section>';
}
function ucBlogu(m){
  if(!m.uc.length)return '';
  return '<details id="eeUc"><summary>Hesaba katılmayan uç sonuçlar ('+fi(m.uc.length)+')</summary><ul>'+m.uc.map(u=>'<li>'+(u.ad?kacis(kisiAdi(u.ad))+' · '+kacis(u.sinif||'—')+' · ':'')+kacis(u.neden)+'</li>').join('')+'</ul></details>';
}
function nasilBlogu(m){
  return '<details id="eeNasil"><summary>Nasıl hesaplanır</summary><div class="ee-nasil">'+
    '<p><b>Çok etüt alan öğrenciler zaten çalışkan olabilir; bu yüzden her öğrenci kendi diğer dersleriyle karşılaştırılır.</b> Çalışkanlık her dersi birden yükseltir, öğrencinin kendi derslerini kıyaslarken etkisi kaybolur.</p>'+
    '<p><b>Türkiye farkı.</b> Öğrencinin o dersteki neti eksi o denemede Türkiye’nin o dersteki ortalama neti. Deneme zor da olsa kolay da olsa bu fark denemenin zorluğundan etkilenmez.</p>'+
    '<p><b>Değişim.</b> Etüt alınan derste, ilk etütten hemen önceki denemeden son denemeye Türkiye farkının değişimi. Etüt almadığı derslerde aynı öğrencinin aynı iki denemesi; o öğrenci hiçbir derste etüt almadıysa ilk ve son deneme. Başka bir dersten etüt almış ama bu dersten almamış öğrencinin diğer dersleri, o etütten önceki denemeden başlar.</p>'+
    '<p><b>Ölçek.</b> Türkçe 40, Fizik 7 soru; net olduğu gibi toplanırsa Türkçe baskın çıkar. Bu yüzden her dersin değişimi, okulun o dersteki öğrenci dağılımına (etütler başlamadan önceki denemelerde) bölünür; sonuç yine bu dersin netine çevrilip gösterilir.</p>'+
    '<p><b>Her etüt ≈ … net.</b> Aynı öğrencinin etüt aldığı ve almadığı derslerdeki değişimleri yan yana konur. Dersin kendine özgü gidişi ve başlangıçta düşük olanın kendiliğinden yükselmesi hesaba katılır. Sonuç: bu derste alınan her etüt için, aynı öğrencinin diğer derslerine göre ek artış.</p>'+
    '<p><b>Etütten önce ve sonra.</b> Etüt alanlar, aynı denemelerde etüt almayan sınıf arkadaşlarıyla karşılaştırılır. Her öğrencinin sıfır noktası ilk etütten önceki denemedir; iki çizgi de o denemeye göre değişimi gösterir. Sınıf ortalaması, o ana kadar bu dersten etüt almamış (henüz almamış ya da hiç almamış) öğrencilerden hesaplanır. Etütten önce iki çizgi birlikte gidiyorsa karşılaştırma adildir; önceden de ayrılıyorsa şeritte sarı çıkar. Etütten sonra yeşil: etüt alanlar ortalamanın üstünde, kırmızı: altında; koyu yeşil: ortalama düşerken etüt alanlar arttı.</p>'+
    '<p><b>Öğretmen.</b> Her öğretmenin kendi etüt başına kazancı bulunur; öbür öğretmenlerin etütleri sabit tutulur. Bir öğrenci iki öğretmenden de etüt aldıysa her ikisinin satırında kendi etüt sayısıyla yer alır; hiçbir pay bölüşümü yoktur. Toplam katkı, bu kazanç çarpı o öğretmenin verdiği etüt sayısıdır. Beş öğrenciden azı olan öğretmen sıralanmaz.</p>'+
    '<p><b>Çok uç sonuçlar</b> (öğrencinin kendi gidişinden ya da etüt aldığı dersin diğer derslerinden aşırı farklı olanlar) hesaba katılmaz ve ayrıca listelenir. Bir denemenin uçluğu, öğrencinin kendi ortancasından uzaklığına bakılarak ölçülür; bir öğrencinin uçluğu, etüt aldığı dersin kendi diğer derslerinden uzaklığına bakılarak. İkisinde de ölçüt, 3,5’i aşan değiştirilmiş z puanıdır (Iglewicz ve Hoaglin). Öğrenci uçları birkaç turda belirlenir; en çok %20’si dışarıda tutulur.</p>'+
    '<p><b>Olası aralık.</b> Öğrenciler 1000 kez yeniden seçilerek bulunur ve her seferinde aynı çıkar. Aralık sıfırı içermiyorsa fark belirgin sayılır. Hem etüt aldığı hem almadığı dersi olan öğrenci çok azsa ya da aralık çok genişse sonuç verilmez.</p>'+
    '<p><b>Ayrıntı bölümü</b> iki eski karşılaştırmayı tutar: öğrencilerin birbiriyle karşılaştırılması (çalışkanlığı da içerir) ve iki deneme arasındaki etüt sayısına göre artış.</p>'+
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
    '<p class="et-cumle" id="eeOlayOzet">'+olayYazisi(m.olay)+'</p><p class="et-cumle" id="eeOzet">'+ozetYazisi(m)+'</p><p class="et-cumle ee-karar ee-k-'+m.karar.k+'" id="eeKarar"><b>'+kacis(m.karar.yazi)+'</b></p>'+
    '<p class="et-cumle" id="eeSayim">'+sayimYazisi(m)+'</p><p class="mini" id="eeSinir">'+SINIR_YAZI+'</p></header>'+arac(m)+uyari+hamUyari+listesiz+kapsamUyari+
    (m.hepsi.length?olayPaneli(m)+durusPaneli(st,m)+hocaTablosu(m,secili)+ogrenciTablosu(m,secili)+ucBlogu(m)+aralikBlogu(m,secili)+nasilBlogu(m):ogrenciTablosu(m,secili)+ucBlogu(m)+nasilBlogu(m));
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
  const el=ev.target.closest?.('[data-ee-duzey],[data-ee-oturum],[data-ee-donem],button[data-ee-hoca],.ee-hoca-kart[data-ee-hoca]');if(!el||el.disabled)return;
  if(el.dataset.eeDuzey){EK.eeDuzey=Number(el.dataset.eeDuzey);EK.eeOturum=EK.eeDers=EK.eeHoca=undefined;yenidenCiz('[data-ee-duzey="'+EK.eeDuzey+'"]');return}
  if(el.dataset.eeOturum){EK.eeOturum=el.dataset.eeOturum;EK.eeDers=EK.eeHoca=undefined;yenidenCiz('[data-ee-oturum="'+EK.eeOturum+'"]');return}
  if(el.dataset.eeDonem){EK.eeDonem=el.dataset.eeDonem;EK.eeHoca=undefined;yenidenCiz('[data-ee-donem="'+EK.eeDonem+'"]');return}
  if(el.dataset.eeHoca!==undefined){EK.eeHoca=el.dataset.eeHoca&&EK.eeHoca!==el.dataset.eeHoca?el.dataset.eeHoca:undefined;yenidenCiz();document.getElementById('eeOgrenciler')?.scrollIntoView({block:'nearest',behavior:'smooth'})}
});
document.addEventListener('change',ev=>{
  if(!etkin())return;const el=ev.target;
  if(el.id==='eeDers'){EK.eeDers=el.value;EK.eeHoca=undefined;yenidenCiz('#eeDers')}
});
return {model,olayOzeti,olaySvg,ortakY,ortakS,panelKur,olcek,pencereBul,panelAralik,panelHazirla,gjCoz,regres,kumeAralik,kararToplam,farkSvg,egim,netAl,etutOturum,eksikGun,icerik,gorunum,artisSvg,durusSvg,durus,grafikleriCiz,sahip,trOrtalama,etkiHesapla,karar,eslestirme,kovalar,bootstrap,coz,dilimler,isr,NET,TR_KOD,EN_AZ,EN_AZ_KARAR,EN_KONTROL,GENIS_ARALIK,SD_TABAN,OLAY_BIN,OLAY_AD,BOOT,TOHUM,HAM_UYARI,SINIR_YAZI};
})();
function gorunumEtutEtki(){return ETUT_ETKI.gorunum()}
