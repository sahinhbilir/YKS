// Embedded in index.html by scripts/embed-analiz.cjs. No student data belongs here.
// Öğrenci analizi and Öğrenci kartı (teacher only). One module computes, for every student of the school lists
// (DPANO.temel, i.e. Sıralamalar), the series of the exams they sat, measured against the Türkiye average of the same
// exam (Türkiye geneli, TURKIYE.ortalamalar), and adds their etüts, absences and weak topics (Etütler, Yoklama, Konu
// Takibi). Pages that list or flag students build on it. Nothing is stored, uploaded or sent to students: the results
// are cached in memory by a signature of the data and the day. See docs/ogrenci-karti.md.
//
// Definitions (the Türkiye average of an exam and session is the reference, never the school mean):
// - sapma: the student's net minus the Türkiye average of that exam and session (TYT total; AYT per alan; the student's
//   net counts the same subjects as the Türkiye total). An exam without Türkiye data has no sapma.
// - beklenen: the exam's Türkiye average plus the mean sapma over the student's previous up to 5 exams that have one;
//   it needs at least 2 of them. beklenenden: the net above (+) or below (−) it (= sapma minus that mean sapma).
// - istikrar: the standard deviation of sapma over the student's last up to 6 exams that have one (at least 3):
//   below 3 net Çok istikrarlı, below 6 İstikrarlı, below 10 Dalgalı, otherwise Çok dalgalı.
// - etüt and devamsızlık: the last 30 days (today and the 29 days before). A missed day is Yoklama's rule (3+ lessons).
// - zayıf konular: Konu Takibi topics whose "zorluğa göre" is -1 question or less, the worst first, at most 5.
// The student is identified by the school number (the key of every list).
const ANALIZ = (() => {
// measure key, name, Türkiye total
const OLCULER=[['TYT','TYT','TYT'],['AYT:SAY','AYT · SAY','SAY'],['AYT:EA','AYT · EA','EA'],['AYT:SÖZ','AYT · SÖZ','SÖZ']];
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
// noktalar: a student's exams in time order, [{net, trOrt, trNet}] (trOrt: the exam's Türkiye average, null when the exam
// has none; trNet: the student's net over the Türkiye total's subjects). Adds sapma, beklenen and beklenenden.
function turet(noktalar){
  const gecmis=[];
  return noktalar.map(p=>{
    const sapma=p.trOrt!==null&&p.trOrt!==undefined&&Number.isFinite(p.trNet)?y6(p.trNet-p.trOrt):null,pencere=gecmis.slice(-BEKLENEN_PENCERE);
    let beklenen=null,beklenenden=null;
    if(sapma!==null&&pencere.length>=BEKLENEN_EN_AZ){const m=ort(pencere);beklenen=y6(p.trOrt+m);beklenenden=y6(sapma-m)}
    if(sapma!==null)gecmis.push(sapma);
    return {...p,sapma,beklenen,beklenenden};
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
// For every measure (TYT, AYT · SAY, EA, SÖZ): the exams with their school mean and Türkiye average, and every student's
// series. t: DPANO.temel(veri); trFn: TURKIYE.ortalamalar(veri) or null.
function seriler(t,trFn){
  const out={};
  for(const [key,ad,toplamKey] of OLCULER){
    const O=DPANO.olcu(key),alan=O.oturum==='tyt'?'tyt':'ayt',sinavlar=[],ogr=new Map();
    for(const s of t.sinavlar){
      const rows=[];for(const o of Object.values(s[alan]||{})){const v=O.deger(o);if(v!==null)rows.push({o,v:y6(v)})}
      if(!rows.length)continue;
      const tr=trFn?trFn(s.ad):null,top=tr?tr.toplam(toplamKey):null,sirali=rows.map(r=>r.v).sort((a,b)=>b-a);
      const okulOrt=y6(ort(rows.map(r=>r.v)));
      sinavlar.push({id:s.id,ad:s.ad,tarih:s.tarih,g:s.g,n:rows.length,okulOrt,trOrt:top?top.genel:null,trVar:!!top});
      for(const {o,v} of rows){
        const p={exam:s.id,ad:s.ad,tarih:s.tarih,g:s.g,net:v,okulOrt,n:rows.length,sira:1+sirali.filter(x=>x>v+1e-9).length,trOrt:top?top.genel:null,trNet:top?karsilastirmaNeti(o,key,top.kodlar):null};
        Object.defineProperty(p,'ham',{value:o,enumerable:false});
        if(!ogr.has(o.no))ogr.set(o.no,[]);ogr.get(o.no).push(p);
      }
    }
    for(const [no,l] of ogr){const d=turet(l);d.forEach((p,i)=>Object.defineProperty(p,'ham',{value:l[i].ham,enumerable:false}));ogr.set(no,d)}
    out[key]={key,ad,toplam:toplamKey,sinavlar,ogr};
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
// Lesson nets in the student's last exam and the one before it; the Türkiye average of the lesson in the last exam.
function dersSatirlari(k,key,noktalar){
  const son=noktalar[noktalar.length-1],once=noktalar.length>1?noktalar[noktalar.length-2]:null,O=DPANO.olcu(key);
  const tr=k.trFn?k.trFn(son.ad):null,kod=new Map(esle(key).map(x=>[x[0],x]));
  const net=(p,d)=>{if(!p)return null;const v=p.ham.net[d.kod];if(v!==null&&v!==undefined)return v;const e=kod.get(d.kod);return e&&e[2]&&p.ham.net[e[2]]!=null?p.ham.net[e[2]]:null};
  return O.dersler.filter(d=>!d.uyeler).map(d=>{
    const a=net(son,d),b=net(once,d),e=kod.get(d.kod),g=tr&&e?tr.genel(e[1]):null;
    return {kod:d.kod,ad:d.ad,soru:d.soru,son:a,once:b,degisim:a!==null&&b!==null?y6(a-b):null,trOrt:g,trFark:a!==null&&g!==null?y6(a-g):null};
  }).filter(r=>r.son!==null||r.once!==null);
}
// The card of one student for one measure. oturum: a measure key; the first the student has when none or unknown.
function kart(key,oturum,bugun=bugunNo()){
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
  // Etüt, Yoklama and Konu Takibi: "var: false" when the source is not there.
  const E=etutKaynagi(k),es=E.var?E.ogr.get(kisi.no):null,etut={var:E.var,son:E.son,...etutOzeti(es?es.sessions:[],bugun)};
  const Y=yoklamaKaynagi(k),yg=Y.ad.get(kisi.key),yoklama={var:!!yg,son:Y.son,...devamsizlik(yg?[...yg]:[],bugun)};
  let zayif;try{zayif=zayifKonular(konuKaynagi(k),kisi.no,sinavlarOkul())}catch(e){zayif={var:false,zorluk:false,liste:[]}}
  return {durum:'tamam',kisi:{...kisi,alan:alanAl(k,kisi)},oturumlar:mevcut,oturum:sec,noktalar,tum:O.sinavlar,son,once,
    trVar:!!k.trFn,neden,trSayi:trMevcut,istikrar:istikrar(noktalar),hedef,dersler:dersSatirlari(k,sec.key,noktalar),etut,yoklama,zayif,bugun};
}
const liste=(bugun)=>kaynak(bugun).liste;

/* ---------------- chart ---------------- */
function tikler(lo,hi,n){
  const ham=(hi-lo||1)/n,us=10**Math.floor(Math.log10(ham)),adim=[1,2,2.5,5,10].map(k=>k*us).find(a=>a>=ham)||10*us,l=[];
  for(let v=Math.floor(lo/adim)*adim;v<hi+adim*.999;v+=adim){l.push(Math.round(v*1e6)/1e6);if(l.length>12)break}
  return l;
}
const yaziGen=t=>String(t).length*6.8+4;
// The student's net in every exam they sat with the school mean (dotted), the Türkiye average (dashed) and the target
// (dashed, flat) on the real spacing of the exam dates; every line is named at its right end with its latest value.
// W is the box's real width in pixels, so the type is real pixels too.
function grafikSvg(c,W){
  const tum=c.tum,gunlu=tum.every(s=>Number.isFinite(s.g)),yer=new Map(tum.map((s,i)=>[s.id,i]));
  const pos=s=>gunlu?s.g:yer.get(s.id),dar=W<520;
  const seriler_=[];
  if(c.hedef)seriler_.push({ad:'Hedef',renk:'var(--e-c4)',stil:'kesik',nokta:false,pts:[[pos(tum[0]),c.hedef.deger],[pos(tum[tum.length-1]),c.hedef.deger]]});
  seriler_.push({ad:'Okul ortalaması',renk:'var(--e-ref)',stil:'nokta',nokta:false,pts:tum.map(s=>[pos(s),s.okulOrt])});
  seriler_.push({ad:'Türkiye ortalaması',renk:'var(--e-muted)',stil:'kesik',nokta:false,pts:tum.map(s=>s.trOrt===null?null:[pos(s),s.trOrt])});
  seriler_.push({ad:'Öğrenci',renk:'var(--e-c1)',stil:'duz',nokta:true,pts:c.noktalar.map(p=>[pos({id:p.exam,g:p.g}),p.net]),oge:c.noktalar});
  for(const s of seriler_){
    const dolu=s.pts.filter(Boolean);s.dolu=dolu;if(!dolu.length){s.son=null;continue}
    s.son=dolu[dolu.length-1][1];s.yazi=f2(s.son);
  }
  const goster=seriler_.filter(s=>s.son!==null);
  const hepsi=goster.flatMap(s=>s.dolu.map(p=>p[1])),lo0=Math.min(...hepsi),hi0=Math.max(...hepsi),pay=Math.max(.5,(hi0-lo0)*.12);
  const tik=tikler(lo0-pay,hi0+pay,dar?4:5),lo=tik[0],hi=tik[tik.length-1];
  const etiketGen=Math.max(...goster.map(s=>yaziGen(s.ad)),yaziGen('00,00')),L=Math.max(...tik.map(t=>yaziGen(Number.isInteger(t)?fi(t):String(t).replace('.',','))))+8;
  const R=Math.max(L+110,W-etiketGen-34),ust=14,ph=dar?200:240,alt=ust+ph,H=alt+30;
  const xs=tum.map(pos),x0=Math.min(...xs),x1=Math.max(...xs);
  const x=g=>L+(x1===x0?.5:(g-x0)/(x1-x0))*(R-L),y=v=>alt-(v-lo)/(hi-lo)*ph;
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Denemelere göre öğrencinin neti, okul ve Türkiye ortalaması">';
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+r1(L-6)+'" y="'+r1(y(t))+'" dy="0.32em" text-anchor="end">'+(Number.isInteger(t)?fi(t):String(t).replace('.',','))+'</text>').join('');
  let sonX=-99;const yazilan=[];
  tum.forEach((e,i)=>{const cx=x(pos(e));if(cx-sonX>=48){yazilan.push(e);sonX=cx}else if(i===tum.length-1){yazilan.pop();yazilan.push(e);sonX=cx}});
  svg+=tum.map(e=>'<line class="et-izgara ok-sinav" x1="'+r1(x(pos(e)))+'" x2="'+r1(x(pos(e)))+'" y1="'+ust+'" y2="'+alt+'"/>').join('');
  svg+='<line class="et-eksen" x1="'+r1(L)+'" x2="'+r1(R)+'" y1="'+alt+'" y2="'+alt+'"/>';
  svg+=yazilan.map(e=>'<text class="et-tik" x="'+r1(x(pos(e)))+'" y="'+(alt+17)+'" text-anchor="middle">'+kacis(gunlu?gunAy(e.g):String(e.ad).slice(0,8))+'</text>').join('');
  // Lines: broken where the series has no value (an exam the student missed or without a Türkiye average).
  const cizgi=s=>{
    let out='',run=[];
    const bitir=()=>{if(run.length>1)out+='<path class="ok-cizgi '+s.stil+'" style="stroke:'+s.renk+'" d="'+GRAFIK_CIZGI.yol(run.map(p=>[x(p[0]),y(p[1])]))+'"/>';run=[]};
    for(const p of s.pts){if(p)run.push(p);else bitir()}bitir();
    if(s.nokta)out+=s.dolu.map((p,i)=>'<circle class="ok-nokta" cx="'+r1(x(p[0]))+'" cy="'+r1(y(p[1]))+'" r="4" style="fill:'+s.renk+'"><title>'+kacis(s.oge[i].ad+' · '+f2(p[1])+' net · okulda '+fi(s.oge[i].sira)+'. / '+fi(s.oge[i].n))+'</title></circle>').join('');
    return out;
  };
  svg+=goster.map(cizgi).join('');
  // Direct labels at the right end (name above, value below), pushed apart when two lines end close together.
  const blok=goster.map(s=>({s,h:28,ideal:y(s.son)})).sort((a,b)=>a.ideal-b.ideal);
  let alta=ust-8;for(const b of blok){b.ust=Math.max(b.ideal-14,alta+3);alta=b.ust+b.h}
  const tasma=alta-(alt+8);if(tasma>0)for(let i=blok.length-1;i>=0;i--){const kalan=i===blok.length-1?alt+8:blok[i+1].ust-3;blok[i].ust=Math.min(blok[i].ust,kalan-blok[i].h)}
  for(const b of blok){
    const s=b.s,ly=b.ust+7,sx=x(s.dolu[s.dolu.length-1][0]);
    if(Math.abs(b.ust+14-b.ideal)>2||sx<R-1)svg+='<line class="ok-bag" style="stroke:'+s.renk+'" x1="'+r1(sx+5)+'" y1="'+r1(b.ideal)+'" x2="'+r1(R+10)+'" y2="'+r1(b.ust+14)+'"/>';
    svg+='<g class="ok-etiket"><line x1="'+r1(R+9)+'" x2="'+r1(R+19)+'" y1="'+r1(b.ust+14)+'" y2="'+r1(b.ust+14)+'" style="stroke:'+s.renk+';stroke-width:2.5'+(s.stil==='kesik'?';stroke-dasharray:3 2':s.stil==='nokta'?';stroke-dasharray:1 3;stroke-linecap:round':'')+'"/>'+
      '<text class="ok-ad" x="'+r1(R+24)+'" y="'+r1(ly)+'" dy="0.32em">'+kacis(s.ad)+'</text><text class="et-tik" x="'+r1(R+24)+'" y="'+r1(ly+14)+'" dy="0.32em">'+kacis(s.yazi)+'</text></g>';
  }
  return svg+'</svg>';
}
let ZAMAN=null;
const etkin=()=>EK.sekme==='ogrencikarti'&&rehberMi()&&!!document.getElementById?.('okKok');
let SON=null;
function grafikleriCiz(){
  if(!etkin()||!SON)return;
  const kutu=document.querySelector('#okGrafik .et-grafik');if(!kutu)return;
  const W=Math.round(kutu.clientWidth);if(W<200)return;
  const c=SON,imza=[W,c.kisi.key,c.oturum.key,c.noktalar.map(p=>p.net).join(),c.tum.map(s=>s.okulOrt+':'+s.trOrt).join(),c.hedef&&c.hedef.deger,GRAFIK_CIZGI.tur()].join('|');
  if(kutu.dataset.imza===imza)return;
  kutu.dataset.imza=imza;kutu.innerHTML=grafikSvg(c,W);
}
function cizimPlanla(){if(typeof window==='undefined'||!window.requestAnimationFrame)return;window.cancelAnimationFrame(ZAMAN);ZAMAN=window.requestAnimationFrame(grafikleriCiz)}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('resize',cizimPlanla);

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
function kartlar(c){
  const s=c.son,ozet=(baslik,deger,alt,yonDeger)=>'<div class="et-ozet-kart"><span class="mini">'+baslik+'</span><strong class="'+(yonDeger===undefined?'':'ok-'+yon(yonDeger))+'">'+deger+'</strong><div class="et-ozet-alt">'+alt+'</div></div>';
  const mini=t=>'<span class="mini">'+t+'</span>';
  const k=[];
  k.push(ozet('Son '+kacis(c.oturum.ad)+' neti',f2(s.net),mini('Okulda '+fi(s.sira)+'. / '+fi(s.n)+' öğrenci')));
  k.push(s.sapma===null?ozet('Türkiye’ye göre','—',mini(c.trVar?'Bu denemenin Türkiye ortalaması yok':'Türkiye geneli verisi yok')):
    ozet('Türkiye’ye göre',ok(s.sapma)+' <small>net</small>',mini('Türkiye ortalaması '+f2(s.trOrt)+' net'),s.sapma));
  k.push(s.beklenenden===null?ozet('Beklenenden','—',mini(c.neden==='tr-yok'?(c.trVar?'Bu denemenin Türkiye ortalaması yok':'Türkiye geneli verisi yok'):'En az 3 deneme gerekli')):
    ozet('Beklenenden',ok(s.beklenenden)+' <small>net</small>',mini('Türkiye ortalamasına göre her zamanki yerinden'),s.beklenenden));
  const i=c.istikrar;
  k.push(i.yeterli?ozet('İstikrar',kacis(i.etiket),mini('± '+f2(i.std)+' net · son '+fi(i.n)+' deneme')):ozet('İstikrar','—',mini('En az 3 deneme gerekli')));
  const h=c.hedef;
  k.push(h?ozet(h.kaynak==='sube'?'Şube hedefi · '+kacis(h.sube):'Sınıf hedefi',f2(h.deger)+' <small>net</small>',
    mini(h.fark>=0?'Son net hedefin '+f2(h.fark)+' net üstünde':'Son net hedefin '+f2(-h.fark)+' net altında')):ozet('Hedef','—',mini('Hedef belirlenmemiş')));
  return '<div class="et-ozet" id="okKartlar">'+k.join('')+'</div>';
}
function dersTablosu(c){
  const ilkAd=c.once?kacis(c.once.ad):'—';
  const satir=d=>'<tr><td class="ok-ad">'+kacis(d.ad)+'</td><td class="sayi">'+(d.son===null?'—':f2(d.son))+'</td><td class="sayi et-dar-gizle">'+(d.once===null?'—':f2(d.once))+'</td>'+
    sayiHucre(d.degisim,ok(d.degisim))+sayiHucre(d.trFark,ok(d.trFark));
  return '<section class="et-panel" id="okDersler"><div class="et-kart-bas"><h2>Dersler</h2><span class="mini">'+kacis(c.son.ad)+(c.once?' · önceki: '+ilkAd:'')+'</span></div>'+
    (c.dersler.length?'<div class="et-tablo-kutu"><table class="et-tablo ok-tablo"><thead><tr><th>Ders</th><th class="sayi">Son net</th><th class="sayi et-dar-gizle">Önceki net</th><th class="sayi">Değişim (net)</th><th class="sayi">Türkiye’ye göre (net)</th></tr></thead><tbody>'+
      c.dersler.map(d=>satir(d)+'</tr>').join('')+'</tbody></table></div>':'<p class="mini">Ders neti yok.</p>')+'</section>';
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
  let c;try{c=kart(EK.okKim,EK.okOturum)}catch(e){SON=null;return baslik('Öğrenci kartı')+'<p class="et-uyari">'+kacis(e.message)+'</p>'}
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
    '<section class="et-panel" id="okGrafik"><div class="et-kart-bas"><h2>'+kacis('Denemelerde net · '+c.oturum.ad)+'</h2></div><div class="et-grafik ok-grafik" role="group" aria-label="Denemelere göre net"></div></section>'+
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
  EK.okKim=String(key);EK.okOturum=undefined;EK.sekme='ogrencikarti';ciz();return true;
}
// A name in a list: opens that student's card.
const adDugmesi=(no,ad,sinif='et-ad')=>'<button type="button" class="'+sinif+'" data-ogrenci-karti="'+kacis(String(no))+'">'+kacis(ad)+'</button>';
function secildi(deger){
  const v=U(deger),l=kaynak().liste;if(!v)return;
  let b=l.find(s=>U(etiketKisi(s))===v)||l.find(s=>s.no===v.trim());
  if(!b){const a=l.filter(s=>U(s.ad+' '+s.no).includes(v));if(a.length===1)b=a[0]}
  if(b){EK.okKim=b.key;EK.okOturum=undefined;yenidenCiz('#okAra')}
}
if(typeof document!=='undefined'&&document.addEventListener){
  document.addEventListener('click',ev=>{
    const el=ev.target.closest?.('[data-ogrenci-karti]');if(el&&rehberMi()){ac(el.dataset.ogrenciKarti);return}
    if(!etkin())return;
    const o=ev.target.closest?.('[data-ok-oturum]');
    if(o){EK.okOturum=o.dataset.okOturum;yenidenCiz('[data-ok-oturum="'+o.dataset.okOturum+'"]')}
  });
  document.addEventListener('change',ev=>{if(etkin()&&ev.target.id==='okAra')secildi(ev.target.value)});
  document.addEventListener('keydown',ev=>{if(etkin()&&ev.target.id==='okAra'&&ev.key==='Enter')secildi(ev.target.value)});
}
return {OLCULER,ISTIKRAR_ETIKETLERI,turet,istikrar,seriler,karsilastirmaNeti,etutOzeti,devamsizlik,zayifKonular,hedefAl,kaynak,kart,liste,icerik,gorunum,ac,adDugmesi,grafikSvg,grafikleriCiz,imzaAl,
  get onbellek(){return ONBELLEK}};
})();
function gorunumOgrenciKarti(){return ANALIZ.gorunum()}
