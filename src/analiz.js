// Embedded in index.html by scripts/embed-analiz.cjs. No student data belongs here.
// Öğrenci analizi and Öğrenci kartı (teacher only). One module computes, for every student of the school lists
// (DPANO.temel, i.e. Sıralamalar), the series of the exams they sat, measured against the Türkiye average of the same
// exam (Türkiye geneli, TURKIYE.ortalamalar), and adds their etüts, absences and weak topics (Etütler, Yoklama, Konu
// Takibi). Pages that list or flag students build on it. Nothing is stored, uploaded or sent to students: the results
// are cached in memory by a signature of the data and the day. See docs/ogrenci-karti.md.
//
// Definitions (the Türkiye average of an exam and session is the reference, never the school mean):
// - sapma: the student's net minus the Türkiye average of that exam and session (TYT total; AYT per alan; the student's
//   net counts the same subjects as the Türkiye total). An exam without a Türkiye list uses the tahmini Türkiye ortalaması
//   when there is one (below), flagged tahmini: true; with neither it has no sapma.
// - tahmini Türkiye ortalaması: okulOrt of the exam minus the median, over the exams of the same measure that have a real
//   Türkiye average, of (okulOrt − trOrt); it needs at least one such exam. Nothing is stored; it is only an estimate.
// - okul sürprizi: on an exam with a Türkiye list, the school's gap (okulOrt − trOrt) minus its usual gap (the median over
//   the other exams with a list).
// - beklenen: the exam's Türkiye average plus the mean sapma over the student's previous up to 5 exams that have one;
//   it needs at least 2 of them. beklenenden: the net above (+) or below (−) it (= sapma minus that mean sapma).
// - istikrar: the standard deviation of sapma over the student's last up to 6 exams that have one (at least 3):
//   below 3 net Çok istikrarlı, below 6 İstikrarlı, below 10 Dalgalı, otherwise Çok dalgalı.
// - hedef yolu: the personal target. g0 is the student's sapma at her first exam with a Türkiye average (real or tahmini);
//   the target net is the exam's Türkiye average plus the target gap, capped just below the measure's maximum (ust: TYT 120,
//   AYT 80). At her k-th later exam the gap is the previous (capped) gap plus the step: adım (+1 net for TYT, +0,5 for every AYT
//   measure) × min(1, (ust − previous target net) / (ust / 2)), so the effort shows more the closer the target gets to the maximum.
// - gidişat: a bounded, robust trend in the success-ratio logit space. r = logit(clamp(net / ust)) − logit(clamp(Türkiye / ust)),
//   clamp to 0.02 … 0.98. Level L = median of r over her last up to 5 exams; slope s = Theil–Sen (median of the pairwise slopes of r
//   over the exam index) over all her exams with a Türkiye value, 0 when |s| ≤ MAD(r) / √n (noise: "aralığında dalgalanıyor"). To the
//   YKS date (D.ayar.sinav): m = floor(days left / DENEME_ARALIGI_GUN) at most 30 (the school holds TYT and AYT in alternate weeks, so each session has an exam every 14 days); r_YKS = L + s × Σ 0.85^j (j = 1 … m);
//   the net there = ust × sigmoid(r_YKS + logit(clamp(latest Türkiye / ust))), always between 0 and ust. At least 3 exams.
//   The hedef yolu is projected to the YKS date with the same m, each future exam adding its (shrinking) step.
// - aralık: Son 1 ay / Son 3 ay (the earliest of her exams within that many months of her latest → the latest), Tümü, or two
//   exams picked by dragging on the chart; it drives the change card and the Dersler table.
// - etüt and devamsızlık: the last 30 days (today and the 29 days before). A missed day is Yoklama's rule (3+ lessons).
// - zayıf konular: Konu Takibi topics whose "zorluğa göre" is -1 question or less, the worst first, at most 5.
// The student is identified by the school number (the key of every list).
const ANALIZ = (() => {
// measure key, name, Türkiye total
const OLCULER=[['TYT','TYT','TYT'],['AYT:SAY','AYT · SAY','SAY'],['AYT:EA','AYT · EA','EA'],['AYT:SÖZ','AYT · SÖZ','SÖZ']];
const HEDEF_ADIM_TYT=1, HEDEF_ADIM_AYT=.5, HEDEF_TAVAN=.5, GIDISAT_EN_AZ=3, GIDISAT_SEVIYE=5, GIDISAT_SONUM=.85, GIDISAT_EN_COK_SINAV=30, DENEME_ARALIGI_GUN=14, ORAN_ALT=.02, ORAN_UST=.98, UST_VARSAYILAN=120;
const BEKLENEN_PENCERE=5, BEKLENEN_EN_AZ=2, ISTIKRAR_PENCERE=6, ISTIKRAR_EN_AZ=3, GUN=30, ZAYIF_ESIK=-1, ZAYIF_EN_COK=5;
const ISTIKRAR_ETIKETLERI=[[3,'Çok istikrarlı'],[6,'İstikrarlı'],[10,'Dalgalı'],[Infinity,'Çok dalgalı']];
const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
// The lessons of a measure in Sıralamalar' columns, with the lesson's Türkiye code and (for Din Kültürü) the column of
// Ek Felsefe, which stands in for it.
const TYT_ESLE=[['TÜR','TÜRKÇE-T'],['TAR','TARİH-T'],['COĞ','COĞRAFYA-T'],['FEL','FELSEFE-T'],['DİN','DİN KÜLTÜRÜ-T','S.F'],['MAT','MATEMATİK-T'],['GEO','GEOMETRİ-T'],['FİZ','FİZİK-T'],['KİM','KİMYA-T'],['BİY','BİYOLOJİ-T']];
const AYT_ESLE=[['EDB','TÜRK DİLİ VE EDB-A'],['TAR1','TARİH.1-A'],['COĞ1','COĞRAFYA.1-A'],['TAR2','TARİH.2-A'],['COĞ2','COĞRAFYA.2-A'],['FELGR','FELSEFE GR.-A'],['DİN2','DİN KÜLTÜRÜ-A','S.F2'],['AMAT','MATEMATİK-A'],['AGEO','GEOMETRİ-A'],['AFİZ','FİZİK-A'],['AKİM','KİMYA-A'],['ABİY','BİYOLOJİ-A']];
const esle=key=>key==='TYT'?TYT_ESLE:AYT_ESLE;

/* ---------------- small helpers ---------------- */
const anahtar=s=>denemeAdAnahtari(s);
const U=s=>String(s??'').replace(/\s+/g,' ').trim().normalize('NFKC').toLocaleUpperCase('tr-TR');
const kisiAdi=s=>String(s||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR').split(' ').map(w=>w?w[0].toLocaleUpperCase('tr-TR')+w.slice(1):w).join(' ');
const y6=x=>Math.round(x*1e6)/1e6;
const r1=x=>Math.round(x*10)/10;
const ort=l=>l.length?l.reduce((a,b)=>a+b,0)/l.length:null;
const medyan=l=>{if(!l.length)return null;const s=l.slice().sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const hedefAdimi=key=>key==='TYT'?HEDEF_ADIM_TYT:HEDEF_ADIM_AYT;
const logit=p=>Math.log(p/(1-p)),sigmoid=z=>1/(1+Math.exp(-z));
const oranLogit=(v,ust)=>logit(Math.min(ORAN_UST,Math.max(ORAN_ALT,v/ust)));
// Theil–Sen: the median of the slopes between every pair of points (y against the index).
const theilSen=y=>{const e=[];for(let i=0;i<y.length;i++)for(let j=i+1;j<y.length;j++)e.push((y[j]-y[i])/(j-i));return medyan(e)};
const std=l=>{const m=ort(l);return Math.sqrt(ort(l.map(x=>(x-m)**2)))};
const f2=x=>Number(x).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const f1=x=>Number(x).toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});
const fi=x=>Number(x).toLocaleString('tr-TR');
const ok=v=>v===null||v===undefined?'—':(v>0?'▲':v<0?'▼':'')+f2(Math.abs(v));
const yon=v=>v>0?'yukari':v<0?'asagi':'esit';
const gunAy=g=>{if(!Number.isFinite(g))return '';const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]};
const sinifK=c=>{const m=/(\d{1,2})\s*[/-]\s*([A-ZÇĞİÖŞÜ]+)/u.exec(U(c));return m?m[1]+'/'+m[2]:''};
const izleme=()=>typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme();

/* ---------------- series (pure) ---------------- */
// noktalar: a student's exams in time order, [{net, trOrt, trNet, tr, tahmini}] (trOrt: the exam's real Türkiye average, null when
// the exam has none; tr: the average the figures use, trOrt or the tahmini one, defaulting to trOrt; trNet: the student's net over
// the Türkiye total's subjects). Adds sapma, beklenen and beklenenden; with adim (the target's step per exam) also the personal
// target path: hedefK (her exams with a Türkiye average counted from the first, 0), hedefGap and hedefNet. With ust (the measure's
// maximum net) the target net stays below it and the step shrinks toward it (hedefAdimi); without ust the step is constant.
const hedefCarpan=(net,ust)=>ust?Math.min(1,Math.max(0,(ust-net)/(ust/2))):1;
function turet(noktalar,adim=null,ust=null){
  const gecmis=[];let g0=null,k=-1,once=null;
  return noktalar.map(p=>{
    const tr=p.tr!==undefined?p.tr:p.trOrt;
    const sapma=tr!==null&&tr!==undefined&&Number.isFinite(p.trNet)?y6(p.trNet-tr):null,pencere=gecmis.slice(-BEKLENEN_PENCERE);
    let beklenen=null,beklenenden=null,hedefK=null,hedefGap=null,hedefNet=null;
    if(sapma!==null&&pencere.length>=BEKLENEN_EN_AZ){const m=ort(pencere);beklenen=y6(tr+m);beklenenden=y6(sapma-m)}
    if(sapma!==null){
      if(g0===null)g0=sapma;k++;
      if(adim!==null){
        let gap=k===0?g0:once.gap+adim*hedefCarpan(once.net,ust),net=tr+gap;
        if(ust&&net>ust-HEDEF_TAVAN){net=ust-HEDEF_TAVAN;gap=net-tr}
        hedefK=k;hedefGap=y6(gap);hedefNet=y6(net);once={gap:hedefGap,net:hedefNet};
      }
      gecmis.push(sapma);
    }
    return {...p,sapma,beklenen,beklenenden,hedefK,hedefGap,hedefNet};
  });
}
// The consistency of a student: the spread of sapma over their last exams that have one.
function istikrar(noktalar){
  const s=noktalar.filter(p=>p.sapma!==null&&p.sapma!==undefined).slice(-ISTIKRAR_PENCERE).map(p=>p.sapma);
  if(s.length<ISTIKRAR_EN_AZ)return {n:s.length,std:null,etiket:null,yeterli:false};
  const d=y6(std(s));
  return {n:s.length,std:d,etiket:ISTIKRAR_ETIKETLERI.find(([u])=>d<u)[1],yeterli:true};
}
// The student's net over the Türkiye total's subjects (kodlar): Ek Felsefe stands in for Din Kültürü.
function karsilastirmaNeti(o,key,kodlar){
  const var_=new Set(kodlar.map(anahtar));let t=0;
  for(const [k,kod,ek] of esle(key))if(var_.has(anahtar(kod)))t+=(o.net[k]??0)+(ek?(o.net[ek]??0):0);
  return y6(t);
}
// The school's gap to the Türkiye average (okulOrt − trOrt) on every exam with a Türkiye list, against its usual gap (the median over
// the other such exams; null when there is no other). surpriz > 0: the school stood better against Türkiye than it usually does.
function okulSurprizleri(sinavlar){
  const l=sinavlar.filter(e=>e.trVar).map(e=>({e,fark:y6(e.okulOrt-e.trOrt)}));
  return l.map(({e,fark})=>{const olagan=medyan(l.filter(x=>x.e!==e).map(x=>x.fark));
    return {id:e.id,ad:e.ad,g:e.g,fark,olagan:olagan===null?null:y6(olagan),surpriz:olagan===null?null:y6(fark-olagan)}});
}
// For every measure (TYT, AYT · SAY, EA, SÖZ): the exams with their school mean and Türkiye average, and every student's
// series. t: DPANO.temel(veri); trFn: TURKIYE.ortalamalar(veri) or null. An exam without a Türkiye list gets trTahmini (see the
// top) when another exam of the measure has one; tr is the average the figures use (trOrt, else trTahmini) and tahmini says which.
function seriler(t,trFn){
  const out={};
  for(const [key,ad,toplamKey] of OLCULER){
    const O=DPANO.olcu(key),alan=O.oturum==='tyt'?'tyt':'ayt',sinavlar=[],satirlar=[],ogr=new Map(),adim=hedefAdimi(key),ust=Number.isFinite(O.ust)&&O.ust>0?O.ust:UST_VARSAYILAN;
    for(const s of t.sinavlar){
      const rows=[];for(const o of Object.values(s[alan]||{})){const v=O.deger(o);if(v!==null)rows.push({o,v:y6(v)})}
      if(!rows.length)continue;
      const tr=trFn?trFn(s.ad):null,top=tr?tr.toplam(toplamKey):null,sirali=rows.map(r=>r.v).sort((a,b)=>b-a);
      const okulOrt=y6(ort(rows.map(r=>r.v)));
      const e={id:s.id,ad:s.ad,tarih:s.tarih,g:s.g,n:rows.length,okulOrt,trOrt:top?top.genel:null,trVar:!!top,trTahmini:null,tr:top?top.genel:null,tahmini:false};
      sinavlar.push(e);satirlar.push({s,e,rows,top,sirali});
    }
    const okulFarki=medyan(sinavlar.filter(e=>e.trVar).map(e=>y6(e.okulOrt-e.trOrt)));
    if(okulFarki!==null)for(const e of sinavlar)if(!e.trVar){e.trTahmini=y6(e.okulOrt-okulFarki);e.tr=e.trTahmini;e.tahmini=true}
    for(const {s,e,rows,top,sirali} of satirlar){
      for(const {o,v} of rows){
        const p={exam:s.id,ad:s.ad,tarih:s.tarih,g:s.g,net:v,okulOrt:e.okulOrt,n:rows.length,sira:1+sirali.filter(x=>x>v+1e-9).length,trOrt:e.trOrt,tr:e.tr,tahmini:e.tahmini,
          trNet:top?karsilastirmaNeti(o,key,top.kodlar):e.tahmini?v:null};
        Object.defineProperty(p,'ham',{value:o,enumerable:false});
        if(!ogr.has(o.no))ogr.set(o.no,[]);ogr.get(o.no).push(p);
      }
    }
    for(const [no,l] of ogr){const d=turet(l,adim,ust);d.forEach((p,i)=>Object.defineProperty(p,'ham',{value:l[i].ham,enumerable:false}));ogr.set(no,d)}
    out[key]={key,ad,toplam:toplamKey,sinavlar,ogr,okulFarki,okul:okulSurprizleri(sinavlar),adim,ust};
  }
  return out;
}

/* ---------------- etüt, absences, weak topics (pure) ---------------- */
// sessions: [{date (ISO), course, teacher}] → the etüts of the last 30 days by lesson with their teachers.
function etutOzeti(sessions,bugun){
  const bas=bugun-GUN,by=new Map();let toplam=0;
  for(const x of sessions||[]){
    if(!x||!x.date)continue;const g=gunNo(x.date);if(!(g>bas&&g<=bugun))continue;
    const ders=ETUT.dersAdi(x.course),e=by.get(ders)||{ders,n:0,hoca:new Map()},h=kisiAdi(x.teacher)||'Öğretmen belirtilmemiş';
    e.n++;toplam++;e.hoca.set(h,(e.hoca.get(h)||0)+1);by.set(ders,e);
  }
  return {toplam,dersler:[...by.values()].sort((a,b)=>b.n-a.n||a.ders.localeCompare(b.ders,'tr')).map(e=>({ders:e.ders,n:e.n,
    hocalar:[...e.hoca].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'tr')).map(([ad,n])=>({ad,n}))}))};
}
// gunler: [[day number, lesson codes]] → the missed days of the last 30 days (Yoklama's rule: 3+ missed lessons;
// 'tam' when no lesson was attended, else 'yarim').
function devamsizlik(gunler,bugun){
  const l=new Map();
  for(const [g,kod] of gunler||[]){
    if(!(g>bugun-GUN&&g<=bugun))continue;const k=YOKLAMA.kacirma(kod);
    if(k&&(!l.has(g)||k==='tam'))l.set(g,k);
  }
  const gunlerL=[...l].map(([g,tur])=>({g,tur})).sort((a,b)=>a.g-b.g);
  return {n:gunlerL.length,gunler:gunlerL};
}
const dersAdiK=c=>String(c||'').startsWith('MATEMATİK+GEOMETRİ')?'Matematik + Geometri':kisiAdi(String(c||'').replace(/-[TA]$/u,''));
// The topics of one student whose difficulty-adjusted points are -1 question or less. v: KONU_TAKIBI.oku().veri.
// {var: the student is in Konu Takibi, zorluk: some topic has difficulty data, liste}
function zayifKonular(v,no,okul){
  const bos={var:false,zorluk:false,liste:[]};
  if(!v||!Array.isArray(v.exams)||!String(no||''))return bos;
  const kisiler=new Map();
  for(const e of v.exams)for(const b of e.blocks)if(String(b.student.no)===String(no))kisiler.set(KONU_TAKIBI.studentKey(b.student),b.student.cls);
  if(!kisiler.size)return bos;
  const liste=new Map();let zorluk=false;
  for(const [sid,cls] of kisiler){
    const m0=KONU_TAKIBI.model(v,{cls,student:sid},okul);
    for(const session of m0.sessions){
      const ms=KONU_TAKIBI.model(v,{cls,student:sid,session},okul);
      for(const course of ms.courses.filter(c=>!c.includes('+'))){
        const m=KONU_TAKIBI.model(v,{cls,student:sid,session,course},okul);
        for(const tp of m.topics){
          if(!tp.z)continue;zorluk=true;
          if(tp.z.fark>ZAYIF_ESIK+1e-9)continue;
          const son=tp.points.length?tp.points[tp.points.length-1]:null,k=course+'|'+tp.name;
          if(!liste.has(k))liste.set(k,{konu:tp.name,ders:dersAdiK(course),fark:y6(tp.z.fark),son:son&&son.examRate!==null?son.examRate:null});
        }
      }
    }
  }
  return {var:true,zorluk,liste:[...liste.values()].sort((a,b)=>a.fark-b.fark||a.konu.localeCompare(b.konu,'tr')).slice(0,ZAYIF_EN_COK)};
}

/* ---------------- sources and cache ---------------- */
function imzaAl(bugun){
  const sr=D.siralama===undefined?'-':D.siralama&&Array.isArray(D.siralama.sinavlar)?D.siralama.sinavlar.map(s=>s.id+':'+s.ts+':'+(s.tarih||'')+':'+(s.tur||'')).join('|'):'?';
  const ts=x=>x&&x.ts!==undefined?x.ts:'-';
  const ogr=(D.ogr||[]).map(o=>o&&!o.silindi?[o.no,o.ad,o.sube,o.alan,o.sinif].join('~'):'').join('|');
  return [sr,ts(D.turkiye),ts(D.etut),ts(D.yoklama),ts(D.konutakibi),bugun,ogr].join('#');
}
let ONBELLEK={imza:null,k:null};
// Everything computed from the school lists and the Türkiye lists; etüt, Yoklama and Konu Takibi are read on first use.
function cekirdek(bugun){
  const a=DPANO.veriAl(),k={bugun,hata:a.hata||null,t:a.t||null,trFn:null,olcular:null,kisiler:new Map(),liste:[],alt:{}};
  if(!a.t)return k;
  try{const tv=TURKIYE.oku().veri;if(tv)k.trFn=TURKIYE.ortalamalar(tv)}catch(e){k.trFn=null}
  k.olcular=seriler(a.t,k.trFn);
  const no=new Set();for(const [key] of OLCULER)for(const n of k.olcular[key].ogr.keys())no.add(n);
  for(const n of no){const c=a.t.kisi.get(n)||{no:n,ad:'',sinif:''};k.kisiler.set(String(n),{key:String(n),no:String(n),ad:c.ad,sinif:c.sinif||''})}
  k.liste=[...k.kisiler.values()].sort((x,y)=>(parseInt(y.sinif,10)||0)-(parseInt(x.sinif,10)||0)||x.sinif.localeCompare(y.sinif,'tr')||x.ad.localeCompare(y.ad,'tr'));
  return k;
}
function kaynak(bugun=bugunNo()){
  const imza=imzaAl(bugun);
  if(ONBELLEK.imza!==imza)ONBELLEK={imza,k:cekirdek(bugun)};
  return ONBELLEK.k;
}
const sinavlarOkul=()=>{try{return SIRALAMA.oku().veri?.sinavlar||[]}catch(e){return []}};
// The merged students (Öğrenci raporları' base) by school number, with their etüt sessions.
function etutKaynagi(k){
  if(k.alt.etut)return k.alt.etut;
  let e={var:false,ogr:new Map(),son:null};
  try{
    const t=OGRENCI_RAPOR.temelOgrenciler(),ogr=new Map();
    for(const s of t.students||[])if(s.no)ogr.set(String(s.no),s);
    const sonG=[...ogr.values()].flatMap(s=>s.sessions||[]).map(x=>x.date).filter(Boolean).sort().pop();
    const var_=(t.etutKapsam||[]).length>0||[...ogr.values()].some(s=>(s.sessions||[]).length);
    e={var:var_,ogr,son:(t.etutKapsam||[]).length?Math.max(...t.etutKapsam.map(x=>x[1])):sonG?gunNo(sonG):null};
  }catch(err){e={var:false,ogr:new Map(),son:null}}
  return k.alt.etut=e;
}
// Yoklama's students matched to the school lists by name and class (a name alone when it is unique).
function yoklamaKaynagi(k){
  if(k.alt.yoklama)return k.alt.yoklama;
  let y={var:false,ad:new Map(),son:null};
  try{
    const v=YOKLAMA.oku().veri;
    if(v){
      const adSinif=new Map(),ad=new Map();
      for(const s of k.kisiler.values()){adSinif.set(U(s.ad)+'|'+sinifK(s.sinif),s.key);const l=ad.get(U(s.ad))||[];l.push(s.key);ad.set(U(s.ad),l)}
      const by=new Map();
      for(const r of YOKLAMA.ac(v)){
        let key=adSinif.get(U(r.ad)+'|'+sinifK(r.sinif));
        if(!key){const l=ad.get(U(r.ad));if(l&&l.length===1)key=l[0]}
        if(!key)continue;
        const m=by.get(key)||new Map();for(const [g,kod] of r.gun)m.set(g,kod);by.set(key,m);
      }
      y={var:true,ad:by,son:v.gunler.length?v.gunler[v.gunler.length-1]:null};
    }
  }catch(err){y={var:false,ad:new Map(),son:null}}
  return k.alt.yoklama=y;
}
function konuKaynagi(k){
  if(k.alt.konu!==undefined)return k.alt.konu;
  let v=null;try{if(D.konutakibi!==undefined)v=KONU_TAKIBI.oku().veri}catch(e){v=null}
  return k.alt.konu=v;
}

/* ---------------- the card ---------------- */
// The class / şube target of the average net (Deneme ortalaması), as the notebook has it set.
function hedefAl(kisi,olcuKey){
  if(typeof denemeOrtHedefi!=='function')return null;
  const nb=(D.ogr||[]).find(o=>o&&!o.silindi&&String(o.no)===String(kisi.no)),sube=nb&&nb.sube?nb.sube:'';
  const sinif=nb?denemeOrtSinifi(nb):(parseInt(kisi.sinif,10)||12);
  const secim=olcuKey==='TYT'?{tur:'TYT'}:{tur:'AYT',alan:olcuKey.split(':')[1]},h=denemeOrtHedefi(secim,sube,sinif);
  if(h.deger===null||h.deger===undefined)return null;
  return {deger:h.deger,kaynak:sube&&h.kendi!==null?'sube':'sinif',sube:sube&&h.kendi!==null?sube:''};
}
function alanAl(k,kisi){
  const nb=(D.ogr||[]).find(o=>o&&!o.silindi&&String(o.no)===String(kisi.no));
  if(nb&&['SAY','EA','SÖZ'].includes(nb.alan))return nb.alan;
  let en=null,say=0;
  for(const f of ['SAY','EA','SÖZ']){const l=k.olcular['AYT:'+f].ogr.get(kisi.no);if(l&&l.length>say){say=l.length;en=f}}
  return en;
}
// Lesson nets of the student in the first and the last exam of the range (noktalar[i] … noktalar[j]), the change and the change
// per exam between them; the Türkiye average of the lesson in the last exam. A single exam in the range has no start.
function dersSatirlari(k,key,noktalar,i=Math.max(0,noktalar.length-2),j=noktalar.length-1){
  const son=noktalar[j],bas=j>i?noktalar[i]:null,O=DPANO.olcu(key),n=j-i+1;
  const tr=k.trFn?k.trFn(son.ad):null,kod=new Map(esle(key).map(x=>[x[0],x]));
  const net=(p,d)=>{if(!p)return null;const v=p.ham.net[d.kod];if(v!==null&&v!==undefined)return v;const e=kod.get(d.kod);return e&&e[2]&&p.ham.net[e[2]]!=null?p.ham.net[e[2]]:null};
  return O.dersler.filter(d=>!d.uyeler).map(d=>{
    const a=net(son,d),b=net(bas,d),e=kod.get(d.kod),g=tr&&e?tr.genel(e[1]):null,degisim=a!==null&&b!==null?y6(a-b):null;
    return {kod:d.kod,ad:d.ad,soru:d.soru,son:a,bas:b,degisim,basina:degisim!==null&&n>1?y6(degisim/(n-1)):null,trOrt:g,trFark:a!==null&&g!==null?y6(a-g):null};
  }).filter(r=>r.son!==null||r.bas!==null);
}
// The YKS date as a day number: D.ayar.sinav, null when it is not a valid date.
function yksGunu(){try{const v=D.ayar&&D.ayar.sinav;return v&&isoTarihGecerli(v)?gunNo(v):null}catch(e){return null}}
// The range of the card: Son 1 ay / Son 3 ay (the earliest exam within that many months of the latest → the latest), Tümü, or
// {bas, bit} (exam ids, picked by dragging on the chart). A range that holds fewer than two of her exams is not there:
// Tümü takes its place. Returns the indices i … j into noktalar and which presets she has.
function aralikSec(noktalar,istek){
  const n=noktalar.length,sonG=n?noktalar[n-1].g:null,tumu={tur:'tumu',i:0,j:Math.max(0,n-1)};
  const ay=(k)=>{if(!Number.isFinite(sonG))return null;const kesim=DPANO.ayGeri(sonG,k),i=noktalar.findIndex(p=>Number.isFinite(p.g)&&p.g>=kesim);return i>=0&&i<n-1?{tur:k===1?'1ay':'3ay',i,j:n-1}:null};
  const hazir={'1ay':ay(1),'3ay':ay(3),tumu};
  let sec=tumu;
  if(istek==='1ay'||istek==='3ay')sec=hazir[istek]||tumu;
  else if(istek&&typeof istek==='object'){
    const i=noktalar.findIndex(p=>p.exam===istek.bas),j=noktalar.findIndex(p=>p.exam===istek.bit);
    if(i>=0&&j>i)sec={tur:'sec',i,j};
  }
  return {...sec,n:sec.j-sec.i+1,uygun:{'1ay':!!hazir['1ay'],'3ay':!!hazir['3ay']}};
}
// Exams still to come before the YKS date: one every DENEME_ARALIGI_GUN days (each session is held every second week), counted from
// her last exam; at most GIDISAT_EN_COK_SINAV. 0 when the YKS date is not after her last exam; null without a date.
function kalanSinav(sonG,yksG){
  if(!Number.isFinite(sonG)||!Number.isFinite(yksG)||!(yksG>sonG))return null;
  return Math.min(GIDISAT_EN_COK_SINAV,Math.floor((yksG-sonG)/DENEME_ARALIGI_GUN));
}
const netDegeri=p=>Number.isFinite(p.trNet)?p.trNet:p.net;
// Gidişat (see the top): the level is the median of r over her last 5 exams, the slope the Theil–Sen slope of r over the exam index
// (0 inside the noise), damped (0.85 per exam to come) up to the YKS date (yksG). ust: the measure's maximum net. egim: r per exam;
// yks: {g, m, r, gap, net} (null without a later YKS date); cizgi: from her last exam's net to the YKS value.
function gidisat(noktalar,yksG,ust=null){
  const U=ust||UST_VARSAYILAN,d=noktalar.filter(p=>Number.isFinite(p.tr)&&Number.isFinite(netDegeri(p)));
  if(d.length<GIDISAT_EN_AZ)return {var:false,n:d.length,yks:null,cizgi:null};
  const r=d.map(p=>oranLogit(netDegeri(p),U)-oranLogit(p.tr,U)),n=r.length,L=medyan(r.slice(-GIDISAT_SEVIYE)),orta=medyan(r),mad=medyan(r.map(v=>Math.abs(v-orta)));
  let egim=theilSen(r);const ham=egim;if(Math.abs(egim)<=mad/Math.sqrt(n))egim=0;
  const son=d[d.length-1],trZ=oranLogit(son.tr,U),son5=d.slice(-GIDISAT_SEVIYE).map(netDegeri),sonNet=netDegeri(son);
  const git=z=>y6(U*sigmoid(z+trZ)),sonG=noktalar.filter(p=>Number.isFinite(p.g)).map(p=>p.g).pop();
  const m=kalanSinav(sonG,yksG);
  let yks=null;
  if(m!==null){
    let toplam=0;for(let j=1;j<=m;j++)toplam+=GIDISAT_SONUM**j;
    const rY=L+egim*toplam,net=git(rY);
    yks={g:yksG,m,r:y6(rY),gap:y6(net-son.tr),net};
  }
  return {var:true,n,egim,hamEgim:ham,mad,seviye:{r:y6(L),net:git(L)},dalgalanir:egim===0,aralik:{min:Math.min(...son5),max:Math.max(...son5)},trSon:son.tr,yks,
    cizgi:yks?[[sonG,sonNet],[yksG,yks.net]]:null};
}
// The hedef yolu at the YKS date: from her last target net on, one exam every DENEME_ARALIGI_GUN days up to the YKS date, each adding
// adim × the shrink factor (hedefCarpan), the net kept below ust - HEDEF_TAVAN. {aralik: days, m: exams to come, gap, net}.
function hedefYks(noktalar,adim,yksG,ust=null){
  const gunlu=noktalar.filter(p=>Number.isFinite(p.g)),h=noktalar.filter(p=>p.hedefNet!==null&&p.hedefNet!==undefined);
  if(!gunlu.length||!h.length)return null;
  const m=kalanSinav(gunlu[gunlu.length-1].g,yksG);if(m===null)return null;
  const son=h[h.length-1];let net=son.hedefNet;
  for(let j=0;j<m;j++){net=net+adim*hedefCarpan(net,ust);if(ust&&net>ust-HEDEF_TAVAN)net=ust-HEDEF_TAVAN}
  net=y6(net);
  return {aralik:DENEME_ARALIGI_GUN,m,gap:y6(net-son.tr),net,g:yksG,ilk:{g:son.g,net:son.hedefNet}};
}
// The card of one student for one measure. oturum: a measure key; the first the student has when none or unknown. aralik: '1ay',
// '3ay', 'tumu' (the default) or {bas, bit} exam ids.
function kart(key,oturum,bugun=bugunNo(),aralik='tumu'){
  const k=kaynak(bugun);
  if(k.hata)return {durum:'hata',hata:k.hata};
  if(!k.t||!k.t.sinavlar.length||!k.liste.length)return {durum:'bos'};
  const kisi=k.kisiler.get(String(key??''));
  if(!kisi)return {durum:'secim',liste:k.liste};
  const mevcut=OLCULER.filter(([ok_])=>k.olcular[ok_].ogr.has(kisi.no)).map(([ok_,ad])=>({key:ok_,ad,n:k.olcular[ok_].ogr.get(kisi.no).length}));
  const sec=mevcut.find(m=>m.key===oturum)||mevcut.find(m=>m.key==='TYT')||mevcut[0],O=k.olcular[sec.key],noktalar=O.ogr.get(kisi.no);
  const son=noktalar[noktalar.length-1],once=noktalar.length>1?noktalar[noktalar.length-2]:null;
  const trMevcut=noktalar.filter(p=>p.sapma!==null).length;
  // Why there is no beklenenden: the exam has no Türkiye average, or fewer than two earlier exams have one.
  const neden=son.beklenenden!==null?null:son.sapma===null?'tr-yok':'az';
  const h=hedefAl(kisi,sec.key),hedef=h?{...h,fark:y6(son.net-h.deger)}:null;
  const yks=yksGunu(),ar=aralikSec(noktalar,aralik),bas=noktalar[ar.i],bit=noktalar[ar.j];
  const degisim={n:ar.n,bas:bas.net,son:bit.net,basG:bas.g,sonG:bit.g,basAd:bas.ad,sonAd:bit.ad,fark:y6(bit.net-bas.net),basina:ar.n>1?y6((bit.net-bas.net)/(ar.n-1)):null};
  // The personal target at her last exam with a Türkiye average, and where the trend and the target path meet the YKS date.
  const hp=noktalar.filter(p=>p.hedefNet!==null),hs=hp.length?hp[hp.length-1]:null;
  const hedefYol=hs?{net:hs.hedefNet,gap:hs.hedefGap,k:hs.hedefK,adim:O.adim,tr:hs.tr,tahmini:hs.tahmini,ad:hs.ad,sonMu:hs===son,fark:y6(hs.net-hs.hedefNet),
    ilkAd:noktalar.find(p=>p.sapma!==null).ad}:null;
  const gid=gidisat(noktalar,yks,O.ust),hy=hs?hedefYks(noktalar,O.adim,yks,O.ust):null;
  const gidisatHedef={gidisat:gid.yks?gid.yks.net:null,hedef:hy?hy.net:null,fark:gid.yks&&hy?y6(gid.yks.net-hy.net):null};
  // Etüt, Yoklama and Konu Takibi: "var: false" when the source is not there.
  const E=etutKaynagi(k),es=E.var?E.ogr.get(kisi.no):null,etut={var:E.var,son:E.son,...etutOzeti(es?es.sessions:[],bugun)};
  const Y=yoklamaKaynagi(k),yg=Y.ad.get(kisi.key),yoklama={var:!!yg,son:Y.son,...devamsizlik(yg?[...yg]:[],bugun)};
  let zayif;try{zayif=zayifKonular(konuKaynagi(k),kisi.no,sinavlarOkul())}catch(e){zayif={var:false,zorluk:false,liste:[]}}
  const okul=O.okul.filter(x=>x.surpriz!==null).pop()||null;
  return {durum:'tamam',kisi:{...kisi,alan:alanAl(k,kisi)},oturumlar:mevcut,oturum:sec,noktalar,tum:O.sinavlar,son,once,
    ust:O.ust,trVar:!!k.trFn,neden,trSayi:trMevcut,istikrar:istikrar(noktalar),hedef,hedefYol,aralik:ar,degisim,gidisat:gid,hedefYks:hy,gidisatHedef,yks,okul,
    dersler:dersSatirlari(k,sec.key,noktalar,ar.i,ar.j),etut,yoklama,zayif,bugun};
}
const liste=(bugun)=>kaynak(bugun).liste;

/* ---------------- chart ---------------- */
// Ticks from the top (the measure's maximum, always a tick) down to the first one at or below lo.
function tikler(lo,hi,n){
  const ham=(hi-lo||1)/n,adim=[.5,1,2,5,10,20,50,100].find(a=>a>=ham)||100,l=[];
  for(let v=hi;l.length<14;v-=adim){l.push(Math.round(v*1e6)/1e6);if(v-adim<lo-1e-9)break}
  return l.reverse();
}
const yaziGen=t=>String(t).length*6.8+4;
// Straight segments through the points: the reference lines never follow the Köşeli / Yumuşak setting (a curve would overshoot).
const dogru=pts=>pts.length>1?'M'+pts.map(p=>r1(p[0])+','+r1(p[1])).join('L'):'';
// Label centres pushed apart (adim apart at least) and kept between lo and hi; ideal is sorted ascending.
function ayir(ideal,adim,lo,hi){
  const p=ideal.map(v=>Math.min(hi,Math.max(lo,v)));
  for(let i=1;i<p.length;i++)p[i]=Math.max(p[i],p[i-1]+adim);
  if(p.length&&p[p.length-1]>hi){p[p.length-1]=hi;for(let i=p.length-2;i>=0;i--)p[i]=Math.min(p[i],p[i+1]-adim)}
  return p;
}
const LABEL_H=30;
// The chart of one student and one measure. The x-axis is the order of the exams: every exam of the measure in the range has one
// slot of the same width, labelled under its point with its short date (every n-th when they would collide, the first and the last
// always). Every series is drawn over its own points only, with straight segments: the student (solid), the school mean (dotted),
// the Türkiye average (dashed; estimated points hollow and the segments to them lighter), the personal target path (orange dashed)
// and the şube target (thin). The y-axis ends at the measure's maximum (c.ust). When the range ends at her last exam and there is a
// YKS date, one separated column "YKS" stands after a gap: the Gidişat and the Hedef yolu values at YKS, each joined to its last
// value by a short dashed segment; nothing runs across the months in between. Each line is named in the right margin, a horizontal
// leader from the line's last point, the labels nudged apart vertically. W is the box's real width in pixels.
// Returns {svg, olc, seriler, ...} (olc is what drag-to-measure needs, seriler describes what is drawn, for the tests).
function cizim(c,W){
  const ar=c.aralik,yakin=ar.tur!=='tumu',dar=W<520,N=c.noktalar,tum=c.tum,UST=Number.isFinite(c.ust)&&c.ust>0?c.ust:UST_VARSAYILAN;
  const gunlu=N.every(p=>Number.isFinite(p.g))&&tum.every(s=>Number.isFinite(s.g)),sira=new Map(tum.map((s,i)=>[s.id,i]));
  const lo_=sira.get(N[ar.i].exam),hi_=sira.get(N[ar.j].exam);
  const gor=tum.filter((s,i)=>!yakin||i>=lo_&&i<=hi_),nok=N.slice(ar.i,ar.j+1),G=gor.length;
  const yer=new Map(gor.map((s,i)=>[s.id,i])),P=s=>yer.get(s.id);
  const ykG=Number.isFinite(c.yks)&&ar.j===N.length-1?c.yks:null,gid=ykG!==null&&c.gidisat&&c.gidisat.yks?c.gidisat.yks:null,hy=ykG!==null&&c.hedefYks?c.hedefYks:null,uzat=!!(gid||hy);
  const YKS_YER=G+1;   // slot index of the YKS column: one empty slot after the last exam
  const sade=(id,ad,renk,stil,pts,ek={})=>({id,ad,renk,stil,pts,...ek});
  let S=[];
  if(c.hedef&&gor.length)S.push(sade('sube',c.hedef.kaynak==='sube'?'Şube hedefi':'Sınıf hedefi','var(--e-c4)','ince',[[0,c.hedef.deger],[G-1,c.hedef.deger]],{yazi:f2(c.hedef.deger)}));
  S.push(sade('okul',dar?'Okul':'Okul ortalaması','var(--e-ref)','nokta',gor.map(s=>[P(s),s.okulOrt])));
  S.push(sade('tr',dar?'Türkiye':'Türkiye ortalaması','var(--e-muted)','kesik',gor.filter(s=>s.tr!==null&&s.tr!==undefined).map(s=>[P(s),s.tr,s.tahmini,s])));
  const ogrPts=nok.map(p=>[yer.get(p.exam),p.net]),ogrSon=ogrPts[ogrPts.length-1];
  const hp=nok.filter(p=>p.hedefNet!==null&&p.hedefNet!==undefined);
  if(hp.length){
    const pts=hp.map(p=>[yer.get(p.exam),p.hedefNet]),ek=hy?[YKS_YER,hy.net]:null;
    S.push(sade('hedef','Hedef yolu','var(--e-c2)','kesik',pts,{uzanti:ek,uzantiBas:pts[pts.length-1],yazi:ek?(dar?'':'YKS’de ')+fi(Math.round(ek[1]))+(dar?'':' net'):f2(pts[pts.length-1][1]),sonDeger:ek?ek[1]:pts[pts.length-1][1],sonX:ek?ek[0]:pts[pts.length-1][0],bitis:!!ek}));
  }
  if(gid)S.push(sade('gidis','Gidişat','var(--e-c1)','gidis',[[YKS_YER,gid.net]],{uzanti:[YKS_YER,gid.net],uzantiBas:ogrSon,yazi:(dar?'':'YKS’de ')+'~'+fi(Math.round(gid.net))+(dar?'':' net'),bitis:true}));
  S.push(sade('ogr','Öğrenci','var(--e-c1)','duz',ogrPts,{oge:nok,nokta:true,yazi:f2(nok[nok.length-1].net)}));
  S=S.filter(x=>x.pts.length);
  for(const x of S){
    const l=x.pts[x.pts.length-1];x.sonX=x.sonX!==undefined?x.sonX:l[0];x.sonDeger=x.sonDeger!==undefined?x.sonDeger:l[1];
    if(x.yazi===undefined)x.yazi=f2(x.sonDeger)+(x.id==='tr'&&l[2]?' tahmini':'');
  }
  // Y scale: the top is the maximum of the measure (always a tick), the bottom just under the lowest value drawn.
  const degerler=S.flatMap(x=>x.pts.map(q=>q[1]).concat(x.uzanti?[x.uzanti[1]]:[])),lo0=Math.min(...degerler),pay=Math.max(.5,(UST-lo0)*.08);
  const tik=tikler(Math.min(lo0-pay,UST-1),UST,dar?4:5),lo=tik[0],hi=UST;
  const tikYazi=t=>Number.isInteger(t)?fi(t):String(t).replace('.',',');
  const L=Math.max(...tik.map(t=>yaziGen(tikYazi(t))))+8,ust=14,ph=dar?200:240,alt=ust+ph,H=alt+30;
  const genis=x=>Math.max(yaziGen(x.ad),yaziGen(x.yazi));
  const marj=Math.max(...S.map(genis))+24,R=Math.max(L+110,W-marj);
  // x of a slot: the exams, then (with the YKS column) an empty slot and the YKS slot; all slots equally wide.
  const xA=L+(dar?12:20),xB=R-(uzat?(dar?10:14):(dar?8:10)),araSayi=G-1+(uzat?2:0),adim=araSayi>0?(xB-xA)/araSayi:0;
  const x=k=>araSayi>0?xA+k*adim:(xA+xB)/2,y=v=>alt-(Math.min(Math.max(v,lo),hi)-lo)/(hi-lo)*ph;
  for(const q of S)q.px=q.pts.map(t=>[x(t[0]),y(t[1])]);
  const xa=s=>x(P(s)),xSon=x(G-1),xYks=x(YKS_YER),xAyrac=uzat?x(G):null;
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Denemelere göre öğrencinin neti, okul ve Türkiye ortalaması, hedef yolu ve gidişat">';
  if(uzat)svg+='<rect class="ok-yks-sutun" x="'+r1(xAyrac)+'" y="'+ust+'" width="'+r1(R-xAyrac)+'" height="'+ph+'"/>';
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+r1(L-6)+'" y="'+r1(y(t))+'" dy="0.32em" text-anchor="end">'+tikYazi(t)+'</text>').join('');
  svg+='<line class="et-kural" x1="0" x2="0" y1="'+ust+'" y2="'+alt+'" visibility="hidden"/>';
  svg+=gor.map(e=>'<line class="et-izgara ok-sinav" x1="'+r1(xa(e))+'" x2="'+r1(xa(e))+'" y1="'+ust+'" y2="'+alt+'"/>').join('');
  svg+='<line class="et-eksen" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+alt+'" y2="'+alt+'"/>';
  if(uzat)svg+='<line class="et-eksen ok-ayrac" x1="'+r1(xAyrac)+'" x2="'+r1(xAyrac)+'" y1="'+ust+'" y2="'+alt+'"/>';
  // The exams' short dates under their points: every n-th when they would collide, the first and the last always.
  const etiketler=gor.map(e=>gunlu?gunAy(e.g):String(e.ad).slice(0,8)),yksYazi=dar?'YKS':'YKS · '+kacis(gunAy(ykG||0)),yksYari=uzat?yaziGen(yksYazi)/2:0;
  const bosluk=Math.max(...etiketler.map(yaziGen),0)+10,hepsi=gor.map((_,i)=>i),n=adim>0?Math.max(1,Math.ceil(bosluk/adim)):1;
  let goster=hepsi.filter(i=>i%n===0);
  if(G>1&&!goster.includes(G-1)){const son=goster[goster.length-1];if((G-1-son)*adim<bosluk&&son!==0)goster.pop();goster.push(G-1)}
  svg+=goster.map(i=>'<text class="et-tik ok-tarih" x="'+r1(x(i))+'" y="'+(alt+17)+'" text-anchor="middle">'+kacis(etiketler[i])+'</text>').join('');
  // The YKS label is centred under its column; when that would touch the last exam's date it starts at the column instead.
  if(uzat){const yakin_=xYks-xSon<yksYari+yaziGen(etiketler[G-1])/2+6&&goster.includes(G-1);
    svg+='<text class="et-tik ok-yks" x="'+r1(yakin_?xYks-4:xYks)+'" y="'+(alt+17)+'" text-anchor="'+(yakin_?'start':'middle')+'">'+yksYazi+'</text>'}
  // Lines: straight segments over their own points (the student's too: the Köşeli / Yumuşak setting does not apply on this chart).
  const yolEl=(id,renk,sinif,d,ek='')=>d?'<path class="ok-cizgi '+sinif+'" data-ok="'+id+'" style="stroke:'+renk+'" d="'+d+'"'+ek+'/>':'';
  for(const q of S){
    if(q.id==='ogr')continue;
    if(q.id==='tr'){
      // Real segments in one path, the segments to or from an estimated point lighter in another.
      const g=[],a=[];for(let i=0;i<q.px.length-1;i++){const seg=q.pts[i][2]||q.pts[i+1][2]?a:g;seg.push('M'+r1(q.px[i][0])+','+r1(q.px[i][1])+'L'+r1(q.px[i+1][0])+','+r1(q.px[i+1][1]))}
      svg+=yolEl(q.id,q.renk,q.stil,g.join(''))+yolEl(q.id,q.renk,q.stil+' soluk',a.join(''),' data-tahmini="1"');
      svg+=q.pts.map((t,i)=>t[2]?'<circle class="ok-nokta bos" data-ok="tr" cx="'+r1(q.px[i][0])+'" cy="'+r1(q.px[i][1])+'" r="3.5" style="stroke:'+q.renk+'"><title>'+kacis(t[3].ad+' · tahmini Türkiye ortalaması (okul ortalamasından) '+f2(t[1])+' net')+'</title></circle>':'').join('');
      continue;
    }
    if(q.id!=='gidis')svg+=yolEl(q.id,q.renk,q.stil,dogru(q.px));
    if(q.uzanti){
      const bas=q.id==='gidis'?[x(q.uzantiBas[0]),y(q.uzantiBas[1])]:q.px[q.px.length-1];
      q.uzantiPx=[bas,[x(q.uzanti[0]),y(q.uzanti[1])]];svg+=yolEl(q.id,q.renk,q.id==='gidis'?q.stil:q.stil+' soluk',dogru(q.uzantiPx),' data-gelecek="1"');
    }
  }
  const ogr=S.find(q=>q.id==='ogr');
  svg+=yolEl('ogr',ogr.renk,'duz',dogru(ogr.px));
  svg+=ogr.px.map((q,i)=>'<circle class="ok-nokta" data-ok="ogr" cx="'+r1(q[0])+'" cy="'+r1(q[1])+'" r="4" style="fill:'+ogr.renk+'"><title>'+kacis(ogr.oge[i].ad+' · '+f2(ogr.pts[i][1])+' net · okulda '+fi(ogr.oge[i].sira)+'. / '+fi(ogr.oge[i].n)+(ogr.oge[i].tahmini?' · tahmini Türkiye ortalaması':''))+'</title></circle>').join('');
  // The YKS end markers, one per line.
  for(const q of S)if(q.bitis)svg+='<circle class="ok-yks-nokta" data-ok="'+q.id+'" cx="'+r1(x(q.uzanti[0]))+'" cy="'+r1(y(q.uzanti[1]))+'" r="5" style="fill:'+q.renk+'"><title>'+kacis(q.ad+' · '+q.yazi)+'</title></circle>';
  // Direct labels in the right margin: name above, value below. A horizontal leader runs from a line's last point to its label.
  const blok=S.map(q=>({q,ideal:y(q.sonDeger)})).sort((a,b)=>a.ideal-b.ideal),yy=ayir(blok.map(b=>b.ideal),LABEL_H,ust+LABEL_H/2,alt-LABEL_H/2-2),sx=R;
  blok.forEach((b,i)=>{
    const q=b.q,cy=yy[i],lx=x(q.sonX),bx=sx+9;
    q.etiket={x:r1(sx+22),y:r1(cy),ideal:r1(b.ideal)};
    if(bx-lx>6&&!q.bitis&&!uzat){q.bag={x1:r1(lx+5),x2:r1(bx-2),y:r1(b.ideal)};svg+='<line class="ok-bag" data-ok="'+q.id+'" style="stroke:'+q.renk+'" x1="'+q.bag.x1+'" y1="'+q.bag.y+'" x2="'+q.bag.x2+'" y2="'+q.bag.y+'"/>'}
    svg+='<g class="ok-etiket" data-ok="'+q.id+'"><line x1="'+r1(sx+9)+'" x2="'+r1(sx+19)+'" y1="'+r1(cy)+'" y2="'+r1(cy)+'" style="stroke:'+q.renk+';stroke-width:2.5'+(q.stil==='kesik'||q.stil==='gidis'?';stroke-dasharray:3 2':q.stil==='nokta'?';stroke-dasharray:1 3;stroke-linecap:round':'')+'"/>'+
      '<text class="ok-ad" x="'+r1(sx+24)+'" y="'+r1(cy-7)+'" dy="0.32em">'+kacis(q.ad)+'</text><text class="et-tik" x="'+r1(sx+24)+'" y="'+r1(cy+7)+'" dy="0.32em">'+kacis(q.yazi)+'</text></g>';
  });
  svg+='</svg>';
  // What drag-to-measure needs: the exams on the chart, the student's net at each (null: she did not sit it).
  const ogrYer=new Map(nok.map((p,i)=>[p.exam,i]));
  const olc={ids:gor.map(e=>e.id),xs:gor.map(xa),deger:gor.map(e=>ogrYer.has(e.id)?nok[ogrYer.get(e.id)].net:null),ys:gor.map(e=>ogrYer.has(e.id)?r1(ogr.px[ogrYer.get(e.id)][1]):null),
    donem:gor.map((e,i)=>gunlu?e.g:i),etiket:etiketler};
  return {svg,olc,W,H,L,R,ust,alt,uzat,adim,ustDeger:UST,tikler:tik,tarihler:goster,ykX:uzat?xYks:null,ayrac:xAyrac,seriler:S.map(q=>({id:q.id,ad:q.ad,yazi:q.yazi,pts:q.px.map(t=>[r1(t[0]),r1(t[1])]),uzanti:q.uzantiPx?q.uzantiPx.map(t=>[r1(t[0]),r1(t[1])]):null,etiket:q.etiket||null,bag:q.bag||null,tahmini:q.id==='tr'?q.pts.map(t=>!!t[2]):null}))};
}
const grafikSvg=(c,W)=>cizim(c,W).svg;
let ZAMAN=null;
const etkin=()=>EK.sekme==='ogrencikarti'&&rehberMi()&&!!document.getElementById?.('okKok');
let SON=null,OLCUM=null;
function grafikleriCiz(){
  if(!etkin()||!SON)return;
  const kutu=document.querySelector('#okGrafik .et-grafik');if(!kutu)return;
  const W=Math.round(kutu.clientWidth);if(W<200)return;
  const c=SON,a=c.aralik,imza=[W,c.kisi.key,c.oturum.key,a.tur,a.i,a.j,c.yks,c.noktalar.map(p=>p.net+':'+p.hedefNet).join(),c.tum.map(s=>s.okulOrt+':'+s.tr+':'+s.tahmini).join(),c.hedef&&c.hedef.deger,
    c.gidisat.yks&&c.gidisat.yks.net,c.hedefYks&&c.hedefYks.net,GRAFIK_CIZGI.tur()].join('|');
  if(kutu.dataset.imza===imza)return;
  const g=cizim(c,W);kutu.dataset.imza=imza;kutu.innerHTML=g.svg;OLCUM=g.olc;
}
function cizimPlanla(){if(typeof window==='undefined'||!window.requestAnimationFrame)return;window.cancelAnimationFrame(ZAMAN);ZAMAN=window.requestAnimationFrame(grafikleriCiz)}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('resize',cizimPlanla);
// Drag to measure (src/grafik.js): the change of her net from the earlier exam to the later one, as in Etütler and Deneme panosu.
const hap=(v,yazi)=>'<span class="et-hap '+yon(v)+'">'+(v>0?'<span aria-hidden="true">▲</span>':v<0?'<span aria-hidden="true">▼</span>':'')+yazi+'</span>';
function olcBilgi(){
  const o=OLCUM;if(!o||!o.xs.length)return null;
  return {xs:o.xs,deger:o.deger,ys:o.ys,donem:o.donem,uzunluk:1,birim:'net',fmt:f1,etiket:i=>o.etiket[i],ad:'Öğrenci',renk:'var(--e-c1)'};
}
function enYakin(kutu,clientX){
  const o=OLCUM,svg=kutu.querySelector('svg');if(!o||!svg)return -1;
  const r=svg.getBoundingClientRect(),vx=(clientX-r.left)*(Number(svg.viewBox.baseVal.width)||r.width)/(r.width||1);
  let en=0;o.xs.forEach((x,i)=>{if(Math.abs(x-vx)<Math.abs(o.xs[en]-vx))en=i});return en;
}
if(typeof GRAFIK_OLCUM!=='undefined')GRAFIK_OLCUM.kur({secici:'#okGrafik .et-grafik',kok:'#okKok',etkin,bilgi:olcBilgi,yakin:enYakin,ipucuGizle(){},hap,fmt:f1});

/* ---------------- page ---------------- */
const yonlu=v=>v===null||v===undefined?'':v>0?' et-yukari':v<0?' et-asagi':'';
const sayiHucre=(v,metin,ek='')=>'<td class="sayi'+ek+yonlu(v)+'">'+metin+'</td>';
const seg=(ad,deger,secenekler,etiket)=>'<div class="et-seg" role="group" aria-label="'+etiket+'">'+
  secenekler.map(([v,yazi])=>'<button type="button" data-ok-'+ad+'="'+kacis(v)+'" aria-pressed="'+(String(v)===String(deger))+'">'+kacis(yazi)+'</button>').join('')+'</div>';
const etiketKisi=s=>kisiAdi(s.ad)+(s.sinif?' · '+s.sinif:'')+' · '+s.no;
function secici(liste,secili){
  return '<div class="et-filtre ok-secici"><input type="search" id="okAra" list="okListe" autocomplete="off" placeholder="Öğrenci ya da numara ara" aria-label="Öğrenci seç" value="'+kacis(secili?etiketKisi(secili):'')+'">'+
    '<datalist id="okListe">'+liste.map(s=>'<option value="'+kacis(etiketKisi(s))+'"></option>').join('')+'</datalist></div>';
}
function geriDugme(){
  const g=EK.okGeri,ad=g&&(SEKME_REHBER.find(s=>s[0]===g)||[])[1];
  return g&&g!=='ogrencikarti'&&ad?'<button type="button" class="et-dugme" data-sekme="'+kacis(g)+'">← '+kacis(ad)+'</button>':'';
}
const okf1=v=>(v>0?'▲':v<0?'▼':'')+f1(Math.abs(v));
const gunAraligi=(g1,g2,ad1,ad2)=>Number.isFinite(g1)&&Number.isFinite(g2)?gunAy(g1)+' → '+gunAy(g2):ad1+' → '+ad2;
const aralikYazisi=c=>gunAraligi(c.degisim.basG,c.degisim.sonG,c.degisim.basAd,c.degisim.sonAd);
// "27-YKS-1202 denemesinde okul ortalaması Türkiye’ye göre her zamankinden ▲2,1 net iyi": the school against Türkiye on an exam with a
// Türkiye list, compared with its usual gap (okulSurprizi).
function okulSurprizYazisi(x){
  if(!x)return '';
  const v=x.surpriz,yaz=Math.abs(v)<.05?'her zamanki gibi':'her zamankinden '+okf1(v)+' net '+(v>0?'iyi':'kötü');
  return 'Okul ortalaması '+kacis(x.ad)+' denemesinde Türkiye’ye göre '+yaz;
}
// How the school's gap to Türkiye on each exam with a Türkiye list differs from its usual gap, for Deneme panosu and other pages:
// {olcu, sinavlar: [{id, ad, g, fark, olagan, surpriz}], son: the latest exam with a surpriz}.
function okulSurprizi(olcuKey='TYT',bugun=bugunNo()){
  const k=kaynak(bugun),O=k.olcular&&k.olcular[olcuKey];
  if(!O)return {olcu:olcuKey,sinavlar:[],son:null};
  return {olcu:olcuKey,sinavlar:O.okul,son:O.okul.filter(x=>x.surpriz!==null).pop()||null};
}
function kartlar(c){
  const s=c.son,ozet=(baslik,deger,alt,yonDeger)=>'<div class="et-ozet-kart"><span class="mini">'+baslik+'</span><strong class="'+(yonDeger===undefined?'':'ok-'+yon(yonDeger))+'">'+deger+'</strong><div class="et-ozet-alt">'+alt+'</div></div>';
  const mini=t=>'<span class="mini">'+t+'</span>';
  const yok=c.trVar?'Bu denemenin Türkiye ortalaması yok':'Türkiye geneli verisi yok',tahmin=s.tahmini?'tahmini ':'';
  const k=[];
  k.push(ozet('Son '+kacis(c.oturum.ad)+' neti',f2(s.net),mini('Okulda '+fi(s.sira)+'. / '+fi(s.n)+' öğrenci')));
  k.push(s.sapma===null?ozet('Türkiye’ye göre','—',mini(yok)):
    ozet('Türkiye’ye göre',ok(s.sapma)+' <small>net</small>',mini(s.tahmini?'tahmini Türkiye ortalaması (okul ortalamasından) '+f2(s.tr)+' net':'Türkiye ortalaması '+f2(s.trOrt)+' net'),s.sapma));
  k.push(s.beklenenden===null?ozet('Beklenenden','—',mini(c.neden==='tr-yok'?yok:'En az 3 deneme gerekli')):
    ozet('Beklenenden',ok(s.beklenenden)+' <small>net</small>',mini(tahmin+'Türkiye ortalamasına göre her zamanki yerinden'),s.beklenenden));
  const i=c.istikrar;
  k.push(i.yeterli?ozet('İstikrar',kacis(i.etiket),mini('± '+f2(i.std)+' net · son '+fi(i.n)+' deneme')):ozet('İstikrar','—',mini('En az 3 deneme gerekli')));
  const hy=c.hedefYol;
  k.push(hy?ozet('Hedef · '+(hy.sonMu?'son deneme':kacis(hy.ad)),f2(hy.net)+' <small>net</small>',
    mini((hy.tahmini?'tahmini ':'')+'Türkiye '+(hy.gap<0?'−':'+')+f2(Math.abs(hy.gap))+' · '+(hy.fark>=0?'▲':'▼')+f2(Math.abs(hy.fark))+' net hedefin '+(hy.fark>=0?'üstünde':'altında')),hy.fark):
    ozet('Hedef','—',mini(yok)));
  const d=c.degisim;
  k.push(d.n>1?ozet('Aralıkta değişim · '+aralikYazisi(c),ok(d.fark)+' <small>net</small>',mini(fi(d.n)+' deneme · deneme başına '+ok(d.basina)),d.fark):
    ozet('Aralıkta değişim','—',mini('Aralıkta tek deneme var')));
  const h=c.hedef;
  if(h)k.push(ozet(h.kaynak==='sube'?'Şube hedefi · '+kacis(h.sube):'Sınıf hedefi',f2(h.deger)+' <small>net</small>',
    mini(h.fark>=0?'Son net hedefin '+f2(h.fark)+' net üstünde':'Son net hedefin '+f2(-h.fark)+' net altında')));
  return '<div class="et-ozet" id="okKartlar">'+k.join('')+'</div>';
}
// Under the chart: where the trend and the target path meet the YKS date, and how the school did against Türkiye.
function notlar(c){
  const l=[],g=c.gidisat,gh=c.gidisatHedef,yks=v=>'YKS’de ~'+fi(Math.round(v))+' net';
  if(g.yks){
    l.push('Gidişat · '+yks(g.yks.net)+(g.dalgalanir?'<span class="mini"> · aralığında dalgalanıyor (≈ '+fi(Math.round(g.aralik.min))+'–'+fi(Math.round(g.aralik.max))+')</span>':''));
    if(gh.fark!==null)l.push((Math.abs(gh.fark)<.05?'Gidişat hedefle aynı yerde':'Gidişat hedefin '+f1(Math.abs(gh.fark))+' net '+(gh.fark<0?'altında':'üstünde'))+
      '<span class="mini"> · hedef yolu YKS’de '+fi(Math.round(gh.hedef))+' net</span>');
  }else if(!g.var&&c.trSayi>0)l.push('Gidişat için Türkiye ortalamalı en az '+GIDISAT_EN_AZ+' deneme gerekli');
  if(c.okul)l.push(okulSurprizYazisi(c.okul));
  return l.length?'<ul class="ok-notlar" id="okNotlar">'+l.map(t=>'<li>'+t+'</li>').join('')+'</ul>':'';
}
// Son 1 ay · Son 3 ay · Tümü (and the range picked by dragging, while it is on).
function aralikSeg(c){
  const a=c.aralik,sec=[['1ay','Son 1 ay',!a.uygun['1ay']],['3ay','Son 3 ay',!a.uygun['3ay']],['tumu','Tümü',false]];
  return '<div class="et-seg" role="group" aria-label="Aralık"><span class="et-seg-label">Aralık</span>'+
    sec.map(([v,yazi,kapali])=>'<button type="button" data-ok-aralik="'+v+'" aria-pressed="'+(a.tur===v)+'"'+(kapali?' disabled':'')+'>'+yazi+'</button>').join('')+
    (a.tur==='sec'?'<button type="button" data-ok-aralik="sec" aria-pressed="true">'+kacis(aralikYazisi(c))+'</button>':'')+'</div>';
}
function dersTablosu(c){
  const th=(t,ek='')=>'<th class="sayi'+ek+'">'+t+'</th>',d=c.degisim;
  const satir=r=>'<tr><td class="ok-ad">'+kacis(r.ad)+'</td><td class="sayi">'+(r.bas===null?'—':f2(r.bas))+'</td><td class="sayi">'+(r.son===null?'—':f2(r.son))+'</td>'+
    sayiHucre(r.degisim,ok(r.degisim))+sayiHucre(r.basina,ok(r.basina),' et-dar-gizle')+sayiHucre(r.trFark,ok(r.trFark));
  return '<section class="et-panel" id="okDersler"><div class="et-kart-bas"><h2>Dersler</h2><span class="mini">ders neti · '+kacis(aralikYazisi(c))+' · '+fi(d.n)+' deneme</span></div>'+
    (c.dersler.length?'<div class="et-tablo-kutu"><table class="et-tablo ok-tablo"><thead><tr><th>Ders</th>'+th('Başta')+th('Sonda')+th('Değişim')+th('Deneme başına',' et-dar-gizle')+th('Türkiye’ye göre (son)')+'</tr></thead><tbody>'+
      c.dersler.map(r=>satir(r)+'</tr>').join('')+'</tbody></table></div>':'<p class="mini">Ders neti yok.</p>')+'</section>';
}
function zayifPaneli(c){
  const z=c.zayif;let g;
  if(!z.var)g='<p class="mini">— · Konu Takibi’nde bu öğrenci yok</p>';
  else if(!z.zorluk)g='<p class="mini">— · Zorluk verisi yok</p>';
  else if(!z.liste.length)g='<p class="mini">Zorluğa göre zayıf konu yok</p>';
  else g='<div class="et-tablo-kutu"><table class="et-tablo ok-tablo"><thead><tr><th>Konu</th><th class="sayi">Zorluğa göre (soru)</th><th class="sayi">Son deneme (%)</th></tr></thead><tbody>'+
    z.liste.map(t=>'<tr><td class="ok-konu">'+kacis(t.konu)+'<span class="mini"> · '+kacis(t.ders)+'</span></td>'+sayiHucre(t.fark,(t.fark<0?'−':t.fark>0?'+':'')+f1(Math.abs(t.fark)))+'<td class="sayi">'+(t.son===null?'—':'%'+fi(Math.round(t.son)))+'</td></tr>').join('')+'</tbody></table></div>';
  return '<section class="et-panel" id="okZayif"><div class="et-kart-bas"><h2>Zayıf konular</h2><span class="mini">zorluğa göre −1 soru ve altı</span></div>'+g+'</section>';
}
function etutPaneli(c){
  const e=c.etut;let g;
  if(!e.var)g='<p class="mini">— · Etüt kaydı yok</p>';
  else if(!e.dersler.length)g='<p class="mini">Son 30 günde etüt yok</p>';
  else g='<div class="et-tablo-kutu"><table class="et-tablo ok-tablo"><thead><tr><th>Ders</th><th class="sayi">Etüt (adet)</th><th>Öğretmen</th></tr></thead><tbody>'+
    e.dersler.map(d=>'<tr><td class="ok-ad">'+kacis(d.ders)+'</td><td class="sayi">'+fi(d.n)+'</td><td class="ok-hoca">'+kacis(d.hocalar.map(h=>h.ad+(d.hocalar.length>1?' ('+h.n+')':'')).join(', '))+'</td></tr>').join('')+'</tbody></table></div>';
  return '<section class="et-panel" id="okEtut"><div class="et-kart-bas"><h2>Etütler (son 30 gün)</h2><span class="mini">'+(e.var?fi(e.toplam)+' etüt'+(e.son?' · son kayıt '+gunAy(e.son):''):'')+'</span></div>'+g+'</section>';
}
function devamPaneli(c){
  const y=c.yoklama;let g;
  if(!y.var)g='<p class="mini">— · Yoklama kaydı yok</p>';
  else if(!y.n)g='<p class="mini">Son 30 günde devamsız gün yok</p>';
  else g='<ul class="ok-gunler">'+y.gunler.map(d=>'<li><b>'+gunAy(d.g)+'</b><span class="mini"> '+(d.tur==='tam'?'tam gün':'yarım gün')+'</span></li>').join('')+'</ul>';
  return '<section class="et-panel" id="okDevam"><div class="et-kart-bas"><h2>Devamsızlık (son 30 gün)</h2><span class="mini">'+(y.var?fi(y.n)+' gün'+(y.son?' · son kayıt '+gunAy(y.son):''):'')+'</span></div>'+g+'</section>';
}
function icerik(){
  const baslik=t=>'<header class="et-bas"><h1 class="et-baslik">'+t+'</h1></header>',git=(sekme,ad)=>'<button type="button" class="et-dugme" data-sekme="'+sekme+'">'+ad+' →</button>';
  let c;try{c=kart(EK.okKim,EK.okOturum,bugunNo(),EK.okAralik||'tumu')}catch(e){SON=null;return baslik('Öğrenci kartı')+'<p class="et-uyari">'+kacis(e.message)+'</p>'}
  SON=null;
  if(c.durum==='hata')return baslik('Öğrenci kartı')+'<p class="et-uyari">'+kacis(c.hata)+'</p>';
  if(c.durum==='bos')return baslik('Öğrenci kartı')+'<section class="et-panel et-bos"><b>Henüz veri yok</b><p>Öğrenci kartı için deneme sonuç listelerini Sıralamalar’a ekleyin.</p><div class="et-arac">'+git('siralamalar','Sıralamalar')+'</div></section>';
  const ust=geriDugme();
  if(c.durum==='secim')return baslik('Öğrenci kartı')+'<div class="et-arac">'+ust+'</div>'+secici(c.liste,null)+'<section class="et-panel et-bos"><b>Bir öğrenci seçin</b><p>Adını ya da numarasını yazın; ya da Deneme panosu, Etüt etkisi ve Sıralamalar’da bir öğrencinin adına basın.</p></section>';
  SON=c;cizimPlanla();
  const k=c.kisi,liste=kaynak().liste;
  return '<header class="et-bas"><h1 class="et-baslik" id="okAd">'+kacis(kisiAdi(k.ad))+'</h1><p class="et-cumle" id="okKimlik">'+kacis(k.sinif||'Şube yok')+' · Alan: '+kacis(k.alan||'—')+' · No '+kacis(k.no)+' · '+fi(c.noktalar.length)+' '+kacis(c.oturum.ad)+' denemesi</p></header>'+
    '<div class="et-arac">'+ust+secici(liste,k)+(c.oturumlar.length>1?seg('oturum',c.oturum.key,c.oturumlar.map(m=>[m.key,m.ad]),'Oturum'):'')+'</div>'+
    kartlar(c)+
    '<section class="et-panel" id="okGrafik"><div class="et-kart-bas"><h2>'+kacis('Denemelerde net · '+c.oturum.ad)+'</h2>'+aralikSeg(c)+'</div><div class="et-grafik ok-grafik" role="group" aria-label="Denemelere göre net"></div>'+notlar(c)+'</section>'+
    dersTablosu(c)+zayifPaneli(c)+etutPaneli(c)+devamPaneli(c);
}
function gorunum(){
  if(!rehberMi())return '<div class="baslik"><h1>Öğrenci kartı</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  return '<div id="okKok">'+icerik()+'</div>';
}
function yenidenCiz(odak){
  const kok=document.getElementById('okKok');if(!kok){ciz();return}
  kok.innerHTML=icerik();
  if(odak){const el=document.querySelector(odak);if(el)el.focus()}
}
// Opens the card of a student from anywhere (a name button with data-ogrenci-karti="<school number>").
function ac(key){
  if(!rehberMi())return false;
  if(EK.sekme!=='ogrencikarti')EK.okGeri=EK.sekme;
  EK.okKim=String(key);EK.okOturum=undefined;aralikSifirla();EK.sekme='ogrencikarti';ciz();return true;
}
// A name in a list: opens that student's card.
const adDugmesi=(no,ad,sinif='et-ad')=>'<button type="button" class="'+sinif+'" data-ogrenci-karti="'+kacis(String(no))+'">'+kacis(ad)+'</button>';
// A range picked by dragging belongs to one student's exams; the presets (Son 1 ay …) carry over to the next student.
const aralikSifirla=()=>{if(EK.okAralik&&typeof EK.okAralik==='object')EK.okAralik=undefined};
function secildi(deger){
  const v=U(deger),l=kaynak().liste;if(!v)return;
  let b=l.find(s=>U(etiketKisi(s))===v)||l.find(s=>s.no===v.trim());
  if(!b){const a=l.filter(s=>U(s.ad+' '+s.no).includes(v));if(a.length===1)b=a[0]}
  if(b){EK.okKim=b.key;EK.okOturum=undefined;aralikSifirla();yenidenCiz('#okAra')}
}
if(typeof document!=='undefined'&&document.addEventListener){
  document.addEventListener('click',ev=>{
    const el=ev.target.closest?.('[data-ogrenci-karti]');if(el&&rehberMi()){ac(el.dataset.ogrenciKarti);return}
    if(!etkin())return;
    const o=ev.target.closest?.('[data-ok-oturum]');
    if(o){EK.okOturum=o.dataset.okOturum;aralikSifirla();yenidenCiz('[data-ok-oturum="'+o.dataset.okOturum+'"]');return}
    const a=ev.target.closest?.('[data-ok-aralik]');
    if(a&&!a.disabled&&a.dataset.okAralik!=='sec'){EK.okAralik=a.dataset.okAralik;yenidenCiz('[data-ok-aralik="'+a.dataset.okAralik+'"]')}
  });
  document.addEventListener('change',ev=>{if(etkin()&&ev.target.id==='okAra')secildi(ev.target.value)});
  document.addEventListener('keydown',ev=>{if(etkin()&&ev.target.id==='okAra'&&ev.key==='Enter')secildi(ev.target.value)});
  // Dragging on the chart measures (src/grafik.js); on release the dragged range becomes the card's range. Read before the
  // measuring helper clears its state (capture phase), applied after it.
  let OLC_BENIM=false;
  document.addEventListener('pointerdown',ev=>{OLC_BENIM=!!(etkin()&&ev.target.closest?.('#okGrafik .et-grafik'))},true);
  document.addEventListener('pointerup',()=>{
    const d=OLC_BENIM&&OLCUM&&typeof GRAFIK_OLCUM!=='undefined'?GRAFIK_OLCUM.durum:null;OLC_BENIM=false;
    if(!d||!d.suruklendi||d.i0===d.i1)return;
    const a=Math.min(d.i0,d.i1),b=Math.max(d.i0,d.i1),bas=OLCUM.ids[a],bit=OLCUM.ids[b];
    setTimeout(()=>{if(etkin()){EK.okAralik={bas,bit};yenidenCiz()}},0);
  },true);
}
return {OLCULER,ISTIKRAR_ETIKETLERI,turet,istikrar,seriler,karsilastirmaNeti,etutOzeti,devamsizlik,zayifKonular,hedefAl,kaynak,kart,liste,icerik,gorunum,ac,adDugmesi,grafikSvg,cizim,grafikleriCiz,imzaAl,okulSurprizleri,okulSurprizi,okulSurprizYazisi,gidisat,hedefYks,kalanSinav,DENEME_ARALIGI_GUN,aralikSec,dersSatirlari,medyan,yksGunu,
  get onbellek(){return ONBELLEK}};
})();
function gorunumOgrenciKarti(){return ANALIZ.gorunum()}
