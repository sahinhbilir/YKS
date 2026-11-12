// Embedded in index.html by scripts/embed-ogretmenrapor.cjs. No student data belongs here.
// Öğretmen raporu (rehber öğretmen only): one section per teacher of the weekly timetables (Etüt planı → ders programları).
// A teacher's students are the students of the classes the teacher teaches the subject in, TAKEN TOGETHER: the report never
// shows a class on its own, never ranks classes, never names a student and never compares one teacher with another. Per grade
// and per exam subject (TYT Matematik, AYT Matematik …) it shows:
//  1. the students' mean net in the subject against the Türkiye average (Genel Net) exam by exam, and the gap;
//  2. a topic grid: for every topic of the subject (Konu Takibi) and every exam, how the students did against students across
//     Türkiye on the same questions: green where better, red where worse, deeper the larger the gap; pale when the gap is
//     within chance; arrows where a topic has been behind (or ahead) on three measured exams in a row;
//  3. the teacher's own etüts: how many, how many students, and those students' gap to Türkiye before and after;
//  4. folded: the formulas in plain words and every raw number behind the figures.
// Nothing is stored or sent. See docs/ogretmen-raporu.md.
const OGRETMEN_RAPOR = (() => {
'use strict';
// A subject of the timetable → its exam subjects: [session, Sıralamalar key, publisher code].
const DERSLER=[
  ['Türk dili ve edebiyatı',/TURK DILI|EDEBIYAT/,[['TYT','TÜR','TÜRKÇE-T'],['AYT','EDB','TÜRK DİLİ VE EDB-A']]],
  ['Türkçe',/TURKCE/,[['TYT','TÜR','TÜRKÇE-T']]],
  ['Matematik',/MATEMATIK/,[['TYT','MAT','MATEMATİK-T'],['AYT','AMAT','MATEMATİK-A']]],
  ['Geometri',/GEOMETRI/,[['TYT','GEO','GEOMETRİ-T'],['AYT','AGEO','GEOMETRİ-A']]],
  ['Fizik',/FIZIK/,[['TYT','FİZ','FİZİK-T'],['AYT','AFİZ','FİZİK-A']]],
  ['Kimya',/KIMYA/,[['TYT','KİM','KİMYA-T'],['AYT','AKİM','KİMYA-A']]],
  ['Biyoloji',/BIYOLOJI/,[['TYT','BİY','BİYOLOJİ-T'],['AYT','ABİY','BİYOLOJİ-A']]],
  ['Tarih',/TARIH|INKILAP/,[['TYT','TAR','TARİH-T'],['AYT','TAR1','TARİH.1-A'],['AYT','TAR2','TARİH.2-A']]],
  ['Coğrafya',/COGRAFYA/,[['TYT','COĞ','COĞRAFYA-T'],['AYT','COĞ1','COĞRAFYA.1-A'],['AYT','COĞ2','COĞRAFYA.2-A']]],
  ['Felsefe',/FELSEFE|PSIKOLOJI|SOSYOLOJI|MANTIK/,[['TYT','FEL','FELSEFE-T'],['AYT','FELGR','FELSEFE GR.-A']]],
  ['Din kültürü',/DIN KULTURU/,[['TYT','DİN','DİN KÜLTÜRÜ-T'],['AYT','DİN2','DİN KÜLTÜRÜ-A']]]];
const OGRENCI_KISA={'TÜRKÇE-T':'turkce','TARİH-T':'tarih','COĞRAFYA-T':'cografya','FELSEFE-T':'felsefe','DİN KÜLTÜRÜ-T':'din','MATEMATİK-T':'mat','GEOMETRİ-T':'geo','FİZİK-T':'fizik','KİMYA-T':'kimya','BİYOLOJİ-T':'biyoloji',
  'TÜRK DİLİ VE EDB-A':'edebiyat','TARİH.1-A':'tarih1','COĞRAFYA.1-A':'cografya1','TARİH.2-A':'tarih2','COĞRAFYA.2-A':'cografya2','FELSEFE GR.-A':'felsefe','DİN KÜLTÜRÜ-A':'din','MATEMATİK-A':'mat','GEOMETRİ-A':'geo','FİZİK-A':'fizik','KİMYA-A':'kimya','BİYOLOJİ-A':'biyoloji'};
// Design effect for the topic test: the answers of one student to the questions of one topic are correlated (assumed r = 0,2,
// as in Konu Takibi), so the chance band is widened by √(1 + (q − 1)·0,2), q the topic's questions per student.
const R_MADDE=.2, Z=1.96, ART_ARDA=3, RENK_UST=20;
const yaz=s=>String(s??'').replace(/\s+/g,' ').trim();
// katla and sinifK run for every student of every exam in every block; the same names and classes repeat, so each is worked out once.
const bellek=f=>{const m=new Map();return s=>{const k=String(s??'');let v=m.get(k);if(v===undefined){v=f(k);if(m.size>=20000)m.clear();m.set(k,v)}return v}};
const katla=bellek(s=>yaz(s).toLocaleUpperCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/İ/g,'I').replace(/ı/g,'I'));
const sinifK=bellek(s=>{const m=/(\d{1,2})\s*[-/]?\s*([A-ZÇĞİÖŞÜ]+)\b/u.exec(yaz(s).toLocaleUpperCase('tr-TR'));return m?m[1]+'/'+m[2]:''});
const duzeyi=c=>{const d=parseInt(c,10);return Number.isFinite(d)?d:null};
const kisiAd=s=>yaz(s).toLocaleLowerCase('tr-TR').split(' ').map(w=>w?w[0].toLocaleUpperCase('tr-TR')+w.slice(1):w).join(' ');
const ort=l=>l.length?l.reduce((a,b)=>a+b,0)/l.length:null;
const f1=x=>Number(x).toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});
const f2=x=>Number(x).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fi=x=>Number(x).toLocaleString('tr-TR');
const isaret=(v,f=f1)=>v===null||v===undefined?'—':(v>0?'+':v<0?'−':'')+f(Math.abs(v));
const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const gunAy=g=>{if(!Number.isFinite(g))return '';const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]};
const r1=x=>Math.round(x*10)/10;
const dersBul=course=>{const k=katla(course);return DERSLER.find(([,re])=>re.test(k))||null};

/* ---------------- teachers (pure over the notebook) ---------------- */
// The session a lesson's name gives: "TYT MATEMATİK", "AYT FİZİK"; Türkçe is the TYT lesson by its name (an EA class has Türkçe
// and Edebiyat as two lessons). null: the lesson teaches the subject in both sessions.
const dersOturumu=(ad,d)=>{const k=katla(ad);return /\bTYT\b/.test(k)?'TYT':/\bAYT\b/.test(k)?'AYT':d&&d[0]==='Türkçe'?'TYT':null};
const siraliSinif=l=>[...l].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));
// [{key, ad, dersler:[{ad, kodlar, siniflar, kodSinif:{kod:[classes]}, oturumlar}]}] from the classes' timetables; lessons with no
// exam subject are left out. In a class, an exam subject a lesson names by session (TYT Matematik, AYT Matematik, Türkçe) is that
// lesson's alone; a lesson that names no session (Matematik, Geometri, Fizik, Türk dili ve edebiyatı) takes the exam subjects no
// such lesson took. So TYT and AYT Matematik split between two teachers where the timetable splits them, Türk dili ve edebiyatı
// beside a Türkçe lesson (EA) is AYT Edebiyat, and a mixed lesson (Geometri, Fizik …) is both.
function ogretmenler(){
  let plan=null;try{plan=typeof ETUTPLANI!=='undefined'?ETUTPLANI.oku().plan:null}catch(e){plan=null}
  const by=new Map();
  for(const [sinif,p] of Object.entries((plan&&plan.programlar)||{})){
    const c=sinifK(sinif);if(!c)continue;
    const dersler=[];
    for(const x of p.dersler||[]){const hoca=yaz(x[3]),d=dersBul(x[2]);if(!hoca||!d)continue;const ot=dersOturumu(x[2],d);dersler.push({hoca,d,ot,kodlar:ot?d[2].filter(k=>k[0]===ot):d[2]})}
    const isaretli=new Set(dersler.filter(l=>l.ot).flatMap(l=>l.kodlar.map(k=>k[2])));
    for(const l of dersler){
      const kodlar=l.ot?l.kodlar:l.kodlar.filter(k=>!isaretli.has(k[2]));if(!kodlar.length)continue;
      const key=katla(l.hoca);let o=by.get(key);if(!o){o={key,ad:l.hoca,dersler:new Map()};by.set(key,o)}
      let dd=o.dersler.get(l.d[0]);if(!dd){dd={ad:l.d[0],tum:l.d[2],kodlar:new Map(),siniflar:new Set()};o.dersler.set(l.d[0],dd)}
      dd.siniflar.add(c);for(const k of kodlar){let e=dd.kodlar.get(k[2]);if(!e)dd.kodlar.set(k[2],e={k,siniflar:new Set()});e.siniflar.add(c)}
    }
  }
  return [...by.values()].map(o=>({key:o.key,ad:o.ad,dersler:[...o.dersler.values()].map(d=>{
    const kodlar=d.tum.filter(k=>d.kodlar.has(k[2]));
    return {ad:d.ad,kodlar,siniflar:siraliSinif(d.siniflar),kodSinif:Object.fromEntries(kodlar.map(k=>[k[2],siraliSinif(d.kodlar.get(k[2]).siniflar)])),oturumlar:[...new Set(kodlar.map(k=>k[0]))]}})}))
    .sort((a,b)=>a.ad.localeCompare(b.ad,'tr'));
}

/* ---------------- the figures (pure) ---------------- */
// The school's exams (Sıralamalar) for one subject code: per exam the mean net of the given classes' students who have a net
// in it, the Türkiye average (Genel Net) and the gap. A blank cell is not a 0 here: a student is counted where the list
// prints their net.
// gorulen (optional Set): filled with the classes that had a net (an SAY class has no AYT Edebiyat).
function netSerisi(k,siniflar,oturum,anahtar,kod,gorulen){
  const out=[];if(!k||!k.t)return out;
  const S=new Set(siniflar),alan=oturum==='TYT'?'tyt':'ayt';
  for(const s of k.t.sinavlar){
    const l=[];for(const o of Object.values(s[alan]||{})){const kisi=k.t.kisi.get(o.no);if(!kisi)continue;const c=sinifK(kisi.sinif);if(!S.has(c))continue;const v=o.net&&o.net[anahtar];if(Number.isFinite(v)){l.push(v);if(gorulen)gorulen.add(c)}}
    if(!l.length)continue;
    const tr=k.trFn?k.trFn(s.ad):null,genel=tr?tr.genel(kod):null;
    out.push({id:s.id,ad:s.ad,g:s.g,n:l.length,net:ort(l),genel:Number.isFinite(genel)?genel:null,fark:Number.isFinite(genel)?ort(l)-genel:null});
  }
  return out.sort((a,b)=>(a.g??0)-(b.g??0));
}
// Konu Takibi: per exam and topic of the subject, the given classes' students' correct answers d against the number the
// Türkiye students' success rates predict for the same questions b = Σ p_q, over n question answers.
//   fark (percentage points) = 100 · (d − b) / n
//   z = (d − b) / √(Σ n_i·p_i·(1 − p_i) · (1 + (q_i − 1)·0,2))   (i: a student; p_i = b_i / n_i; q_i: the topic's questions)
// A cell is "belirgin" when |z| ≥ 1,96. Needs the publisher's Performans analizi in Konu Takibi (Türkiye's p per question).
// c: the page's shared context (baglam): every exam's comparison is worked out once for all students and every block takes its
// classes' students from it; without one the work is done here.
function konuIzgarasi(v,siniflar,oturum,kod,c=baglam(null,v),gorulen){
  if(!v||!Array.isArray(v.exams)||typeof KONU_TAKIBI==='undefined')return null;
  const S=new Set(siniflar),ck=KONU_TAKIBI.key(kod),sinavlar=[],konular=new Map();
  for(const e of dersSinavlari(c,kod)){
    const r=sinavFarki(c,oturum,e);if(!r||!r.ogrenciler.length)continue;
    const i=sinavlar.length,toplam={d:0,b:0,n:0,v:0,ogr:0};let var_=false;
    for(const st of r.ogrenciler){const sc=sinifK(st.student.cls);if(!S.has(sc))continue;let bu=false;
      for(const t of st.konular.values()){if(t.ders!==ck||!t.n||t.id.endsWith('|?'))continue;var_=bu=true;
        let K=konular.get(t.id);if(!K){K={id:t.id,ad:t.ad,hucre:[]};konular.set(t.id,K)}
        const c=K.hucre[i]||(K.hucre[i]={d:0,b:0,n:0,v:0,ogr:0}),p=Math.min(1,Math.max(0,t.b/t.n)),vv=t.n*p*(1-p)*(1+(t.n-1)*R_MADDE);
        c.d+=t.d;c.b+=t.b;c.n+=t.n;c.v+=vv;c.ogr++;toplam.d+=t.d;toplam.b+=t.b;toplam.n+=t.n;toplam.v+=vv}
      if(bu){toplam.ogr++;if(gorulen)gorulen.add(sc)}}
    if(!var_)continue;
    sinavlar.push({ad:e.ad,g:e.date?Date.parse(e.date+'T00:00:00Z')/864e5:null,ogr:toplam.ogr,...olc(toplam)});
  }
  if(!sinavlar.length)return null;
  const satir=[...konular.values()].map(K=>{
    const hucre=sinavlar.map((_,i)=>K.hucre[i]?{...K.hucre[i],...olc(K.hucre[i])}:null);
    const olcu=hucre.filter(Boolean),sonlar=olcu.slice(-ART_ARDA);
    const seri=sonlar.length===ART_ARDA&&sonlar.every(c=>c.durum==='geride')?'geride':sonlar.length===ART_ARDA&&sonlar.every(c=>c.durum==='onde')?'onde':null;
    const fl=olcu.map(c=>c.fark);return {id:K.id,ad:K.ad,hucre,seri,ortFark:fl.length?ort(fl):0,olcum:olcu.length,degisim:olcu.length>=2?olcu[olcu.length-1].fark-olcu[0].fark:null};
  }).sort((a,b)=>a.ortFark-b.ortFark||a.ad.localeCompare(b.ad,'tr'));
  return {sinavlar,satir};
}
// The page's shared context: the lists (ANALIZ), Konu Takibi, and, on first use, the student base with its etüts and every exam's
// topic comparison. One render reads each source once, whatever the number of teachers and blocks.
function baglam(k,v){return {k,v,fark:new Map(),dersSinav:new Map(),temel:undefined,hoca:null}}
function dersSinavlari(c,kod){
  let l=c.dersSinav.get(kod);
  if(!l){l=(c.v&&Array.isArray(c.v.exams)?c.v.exams:[]).filter(e=>e.blocks.some(b=>b.course===kod)).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||a.ad.localeCompare(b.ad,'tr',{numeric:true}));c.dersSinav.set(kod,l)}
  return l;
}
function sinavFarki(c,oturum,e){
  const anahtar=oturum+'|'+KONU_TAKIBI.ek(e.ad);
  if(!c.fark.has(anahtar)){let r;try{r=KONU_TAKIBI.ogrenciFark(c.v,{session:oturum,exam:KONU_TAKIBI.ek(e.ad)})}catch(err){r=null}c.fark.set(anahtar,r)}
  return c.fark.get(anahtar);
}
function olc(c){
  const fark=c.n?100*(c.d-c.b)/c.n:null,z=c.v>0?(c.d-c.b)/Math.sqrt(c.v):null;
  return {fark,z,durum:z===null?'belirsiz':z<=-Z?'geride':z>=Z?'onde':'belirsiz'};
}
// The teacher's own etüts in the subject: sessions, students, and those students' gap to the Türkiye average in the subject on
// their last exam on or before their first etüt with the teacher, and on their latest exam. Only students with both are counted.
// An etüt belongs to the session its course names (“MATEMATİK TYT”, “AYT FİZİK”); one that names none counts with TYT, so no
// etüt is counted twice when a subject has a TYT and an AYT block.
const etutOturumu=c=>{const k=katla(c);return /\bAYT\b/.test(k)?'AYT':/\bTYT\b/.test(k)?'TYT':null};
// The exam subjects an etüt is about: its lesson's, in the session its name gives; an etüt that names no session ("MATEMATİK")
// is about both, so it counts in each block of the teacher's in that subject (etüts are not split into TYT and AYT; classes are).
const etutKodlari=bellek(c=>{const d=dersBul(c);if(!d)return [];const ot=etutOturumu(c)||(d[0]==='Türkçe'?'TYT':null);return d[2].filter(k=>!ot||k[0]===ot).map(k=>k[2])});
// The student base (Öğrenci raporları) is built once per page and its etüts are grouped by teacher once.
function hocaEtutleri(c,ogretmenKey){
  if(!c.hoca){
    if(c.temel===undefined){try{c.temel=typeof OGRENCI_RAPOR!=='undefined'?OGRENCI_RAPOR.temelOgrenciler():null}catch(e){c.temel=null}}
    c.hoca=new Map();
    for(const s of (c.temel&&c.temel.students)||[])for(const x of s.sessions||[]){const k=katla(x.teacher);let m=c.hoca.get(k);if(!m)c.hoca.set(k,m=new Map());let l=m.get(s);if(!l)m.set(s,l=[]);l.push(x)}
  }
  return c.temel?c.hoca.get(ogretmenKey)||new Map():null;
}
// duzey: only the students of that grade (a teacher's etüts mix classes and grades; each grade's block counts its own students).
function etutOzeti(ogretmenKey,ders,oturum,kod,trFn,c=baglam(null,null),duzey=null){
  const hoca=hocaEtutleri(c,ogretmenKey);if(!hoca)return null;
  const kisa=OGRENCI_KISA[kod],out={etut:0,ogrenci:0,once:[],sonra:[],ayrilmamis:0};
  for(const [s,oturumlar] of hoca){
    if(duzey!==null&&duzeyi(sinifK(s.cls))!==duzey)continue;
    const bu=oturumlar.filter(x=>etutKodlari(x.course).includes(kod)),l=bu.map(x=>x.date).filter(Boolean).sort();
    if(!l.length)continue;out.etut+=l.length;out.ogrenci++;out.ayrilmamis+=bu.filter(x=>!etutOturumu(x.course)).length;
    const ex=(s.exams||[]).filter(e=>e.session===oturum&&e.nets&&Number.isFinite(e.nets[kisa])).map(e=>{const tr=trFn?trFn(e.exam):null,g=tr?tr.genel(kod):null;
      return Number.isFinite(g)?{date:e.date,fark:e.nets[kisa]-g}:null}).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));
    const once=ex.filter(e=>e.date<=l[0]).pop(),son=ex[ex.length-1];
    if(once&&son&&son.date>l[0]){out.once.push(once.fark);out.sonra.push(son.fark)}
  }
  return out.etut?{etut:out.etut,ogrenci:out.ogrenci,olculen:out.once.length,once:ort(out.once),sonra:ort(out.sonra),ayrilmamis:out.ayrilmamis}:null;
}
// Everything for one teacher: per subject, per grade, per exam subject (code).
function sayfaBaglami(){
  let k=null;try{k=typeof ANALIZ!=='undefined'?ANALIZ.kaynak():null}catch(e){k=null}
  let v=null;try{v=typeof KONU_TAKIBI!=='undefined'&&D.konutakibi!==undefined?KONU_TAKIBI.oku().veri:null}catch(e){v=null}
  return baglam(k,v);
}
// duzey: only that grade's classes (null: every grade). A block lists only the classes that had data in it (an SAY class taught
// Türk dili ve edebiyatı has no AYT Edebiyat).
function ogretmenModeli(o,c=sayfaBaglami(),duzey=null){
  const k=c.k,v=c.v,bloklar=[];
  for(const d of o.dersler){
    const duzeyler=[...new Set(d.siniflar.map(duzeyi))].filter(x=>x!==null&&(duzey===null||x===duzey)).sort((a,b)=>b-a);
    for(const duz of duzeyler){
      for(const [oturum,anahtar,kod] of d.kodlar){
        const siniflar=((d.kodSinif&&d.kodSinif[kod])||d.siniflar).filter(c=>duzeyi(c)===duz);if(!siniflar.length)continue;
        const gorulen=new Set(),seri=netSerisi(k,siniflar,oturum,anahtar,kod,gorulen),izgara=konuIzgarasi(v,siniflar,oturum,kod,c,gorulen);
        if(!seri.length&&!izgara)continue;
        bloklar.push({ders:d.ad,duzey:duz,siniflar:siniflar.filter(x=>gorulen.has(x)),oturum,kod,dersAd:dersEtiketi(kod),seri,izgara,etut:etutOzeti(o.key,d,oturum,kod,k&&k.trFn,c,duz)});
      }}
  }
  // An etüt that names no session counts in the teacher's TYT and AYT blocks of the subject alike: the block says so.
  for(const b of bloklar)if(b.etut&&b.etut.ayrilmamis)b.etut.ikiOturum=bloklar.some(x=>x!==b&&x.ders===b.ders&&x.duzey===b.duzey&&x.oturum!==b.oturum&&x.etut);
  return {...o,dersler:duzey===null?o.dersler:o.dersler.map(d=>({...d,siniflar:d.siniflar.filter(x=>duzeyi(x)===duzey)})).filter(d=>d.siniflar.length),bloklar};
}
const dersEtiketi=kod=>({'TÜRKÇE-T':'TYT Türkçe','TARİH-T':'TYT Tarih','COĞRAFYA-T':'TYT Coğrafya','FELSEFE-T':'TYT Felsefe','DİN KÜLTÜRÜ-T':'TYT Din kültürü','MATEMATİK-T':'TYT Matematik','GEOMETRİ-T':'TYT Geometri',
  'FİZİK-T':'TYT Fizik','KİMYA-T':'TYT Kimya','BİYOLOJİ-T':'TYT Biyoloji','TÜRK DİLİ VE EDB-A':'AYT Edebiyat','TARİH.1-A':'AYT Tarih-1','COĞRAFYA.1-A':'AYT Coğrafya-1','TARİH.2-A':'AYT Tarih-2','COĞRAFYA.2-A':'AYT Coğrafya-2',
  'FELSEFE GR.-A':'AYT Felsefe grubu','DİN KÜLTÜRÜ-A':'AYT Din kültürü','MATEMATİK-A':'AYT Matematik','GEOMETRİ-A':'AYT Geometri','FİZİK-A':'AYT Fizik','KİMYA-A':'AYT Kimya','BİYOLOJİ-A':'AYT Biyoloji'})[kod]||kod;

/* ---------------- drawing ---------------- */
const renk=kod=>(typeof GRAFIK_RENK!=='undefined'&&GRAFIK_RENK.ders(kod))||'var(--e-c1)';
// The cell colour: red (behind) ↔ green (ahead), deeper with the gap (full at ±20 points); a gap within chance is drawn pale.
function hucreRengi(c){
  if(!c)return '';
  const t=Math.min(1,Math.abs(c.fark)/RENK_UST),a=Math.round((c.durum==='belirsiz'?.12+.18*t:.25+.6*t)*100);
  return 'background:color-mix(in srgb,'+(c.fark<0?'var(--kritik)':'var(--iyi)')+' '+a+'%,transparent)'+(a>=60?';color:#fff':'');
}
// A round step for about `adet` ticks over `aralik` (1, 2, 2,5 or 5 · 10^k).
function adimBul(aralik,adet){const ham=aralik/Math.max(1,adet),u=Math.pow(10,Math.floor(Math.log10(ham||1)));return [1,2,2.5,5,10].map(x=>x*u).find(x=>x>=ham)||10*u}
// Two panels on one x axis, every value written on the chart (a printout has no tooltips):
//  1. Türkiye’ye göre fark: a bar per exam from the Türkiye line (0), green above, red below; the scale is the gaps' own, so a
//     change of a few tenths of a net is visible;
//  2. Ortalama net: the students' mean net (the subject's colour) and the Türkiye average (dashed), each point with its value.
function netGrafigi(b,W){
  const l=b.seri;if(!l.length)return '';
  // The first and last points sit in from the axes, so the end bars cover no tick label.
  const n=l.length,dar=W<520,L=dar?40:50,R=W-(dar?14:22),ic=n>1?Math.min(dar?14:22,(R-L)/(n-1)*.3):0;
  const x=i=>r1(n===1?(L+R)/2:L+ic+(R-L-2*ic)*i/(n-1)),adim=n>1?(R-L-2*ic)/(n-1):R-L;
  // A value is written on every point when the labels fit, otherwise on every k-th counted back from the newest exam.
  const her=Math.max(1,Math.ceil((dar?36:42)/Math.max(1,adim))),yazili=i=>(n-1-i)%her===0;
  const deger=(xx,yy,metin,cls)=>'<text class="ogr-deger '+cls+'" x="'+xx+'" y="'+r1(yy)+'" text-anchor="middle">'+kacis(metin)+'</text>';
  let s='',y0=4;
  const fl=l.filter(p=>p.fark!==null);
  if(fl.length){
    const UST=y0+22,ALT=UST+(dar?96:112);
    let lo=Math.min(0,...fl.map(p=>p.fark)),hi=Math.max(0,...fl.map(p=>p.fark));const pay=Math.max(.4,(hi-lo)*.22);if(lo<0)lo-=pay;if(hi>0)hi+=pay;if(hi===lo)hi=lo+1;
    const y=v=>r1(ALT-(v-lo)/(hi-lo)*(ALT-UST)),ad=adimBul(hi-lo,dar?3:4);
    s+='<text class="ogr-panel-ad" x="'+L+'" y="'+(y0+12)+'">Türkiye’ye göre fark (net)</text>';
    for(let v=Math.ceil(lo/ad)*ad;v<=hi+1e-9;v+=ad){const vv=Math.abs(v)<1e-9?0:v;if(vv!==0)s+='<line class="ogr-izgara" x1="'+L+'" x2="'+R+'" y1="'+y(vv)+'" y2="'+y(vv)+'"/>';s+='<text class="ogr-tik" x="'+(L-6)+'" y="'+(y(vv)+4)+'" text-anchor="end">'+(vv===0?'0':isaret(vv,fi))+'</text>'}
    const bw=Math.max(6,Math.min(30,adim*.56));
    l.forEach((p,i)=>{if(p.fark===null)return;const ya=y(Math.max(0,p.fark)),yb=y(Math.min(0,p.fark)),ust=p.fark>=0;
      s+='<rect class="ogr-cubuk '+(ust?'ogr-cubuk-ust':'ogr-cubuk-alt')+'" x="'+r1(x(i)-bw/2)+'" y="'+ya+'" width="'+r1(bw)+'" height="'+r1(Math.max(1,yb-ya))+'"><title>'+kacis(p.ad+': '+isaret(p.fark,f2)+' net Türkiye’ye göre')+'</title></rect>';
      if(yazili(i))s+=deger(x(i),ust?ya-5:yb+13,isaret(p.fark,f1),ust?'ogr-y':'ogr-k')});
    s+='<line class="ogr-sifir" x1="'+L+'" x2="'+R+'" y1="'+y(0)+'" y2="'+y(0)+'"/>';
    y0=ALT+16;
  }
  const UST=y0+22,ALT=UST+(dar?112:132);
  const vals=l.flatMap(p=>[p.net,...(p.genel!==null?[p.genel]:[])]),lo0=Math.min(...vals),hi0=Math.max(...vals),pad=Math.max(.8,(hi0-lo0)*.28);
  const lo=Math.max(0,lo0-pad),hi=hi0+pad,y=v=>r1(ALT-(v-lo)/(hi-lo||1)*(ALT-UST)),ad=adimBul(hi-lo,dar?3:4);
  s+='<text class="ogr-panel-ad" x="'+L+'" y="'+(y0+12)+'">Ortalama net</text>';
  for(let v=Math.ceil(lo/ad)*ad;v<=hi+1e-9;v+=ad)s+='<line class="ogr-izgara" x1="'+L+'" x2="'+R+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="ogr-tik" x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+fi(Math.round(v*10)/10)+'</text>';
  const yol=(pts,c,st)=>pts.length>1?'<path class="'+c+'"'+(st?' style="'+st+'"':'')+' d="M'+pts.map(([a,b2])=>a+','+b2).join(' L')+'"/>':'';
  s+=yol(l.map((p,i)=>p.genel===null?null:[x(i),y(p.genel)]).filter(Boolean),'ogr-tr');
  s+=yol(l.map((p,i)=>[x(i),y(p.net)]),'ogr-okul','stroke:'+renk(b.kod));
  l.forEach((p,i)=>{
    const ust=p.genel===null||p.net>=p.genel;   // the students' value on the outer side of their point, Türkiye's on the other
    if(p.genel!==null)s+='<circle class="ogr-tr-nokta" cx="'+x(i)+'" cy="'+y(p.genel)+'" r="3"/>';
    s+='<circle class="ogr-okul-nokta" cx="'+x(i)+'" cy="'+y(p.net)+'" r="4.5" style="fill:'+renk(b.kod)+'"><title>'+kacis(p.ad+' · öğrencileriniz '+f2(p.net)+' net ('+fi(p.n)+' öğrenci)'+(p.genel!==null?' · Türkiye '+f2(p.genel)+' net':''))+'</title></circle>';
    if(!yazili(i))return;
    s+=deger(x(i),ust?y(p.net)-8:y(p.net)+16,f1(p.net),'ogr-deger-okul');
    if(p.genel!==null)s+=deger(x(i),ust?y(p.genel)+15:y(p.genel)-7,f1(p.genel),'ogr-deger-tr');
  });
  l.forEach((p,i)=>{if((n-1-i)%Math.max(her,Math.ceil(n/(dar?4:9))))return;s+='<text class="ogr-tik" x="'+x(i)+'" y="'+(ALT+18)+'" text-anchor="'+(n>1&&ic<12&&i===0?'start':n>1&&ic<12&&i===n-1?'end':'middle')+'">'+kacis(gunAy(p.g)||p.ad)+'</text>'});
  const H=ALT+26;
  return '<svg class="ogr-net" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+kacis(b.dersAd+': Türkiye’ye göre fark ve ortalama net, deneme deneme')+'">'+s+'</svg>';
}
function izgaraHtml(b){
  const z=b.izgara;if(!z)return '<p class="mini ogr-yok">Konu karşılaştırması için Konu Takibi’ne bu dersin karne raporunu, sınav özetini ve yayınevinin performans analizini (Türkiye başarı oranları) ekleyin.</p>';
  const bas=z.sinavlar.map(e=>'<th scope="col" class="ogr-iz-sinav" title="'+kacis(e.ad+' · '+fi(e.ogr)+' öğrenci · '+isaret(e.fark,f1)+' puan Türkiye’ye göre')+'"><span>'+kacis(gunAy(e.g)||e.ad)+'</span><b class="'+(e.durum==='geride'?'ogr-k':e.durum==='onde'?'ogr-y':'')+'">'+isaret(e.fark,v=>fi(Math.round(v)))+'</b></th>').join('');
  const seri=r=>r.seri==='geride'?'<span class="ogr-seri ogr-seri-geride" title="Son '+ART_ARDA+' ölçümde belirgin biçimde geride">▼▼▼</span>':r.seri==='onde'?'<span class="ogr-seri ogr-seri-onde" title="Son '+ART_ARDA+' ölçümde belirgin biçimde önde">▲▲▲</span>':'';
  const hucre=(r,c,e)=>!c?'<td class="ogr-iz-bos" title="'+kacis(e.ad+': bu konuda soru yok')+'"></td>':
    '<td class="ogr-iz-h'+(c.durum==='belirsiz'?' ogr-iz-soluk':'')+'" style="'+hucreRengi(c)+'" title="'+kacis(r.ad+' · '+e.ad+': öğrencileriniz %'+fi(Math.round(100*c.d/c.n))+', Türkiye’nin aynı sorulardaki başarısı %'+fi(Math.round(100*c.b/c.n))+' → '+isaret(c.fark,f1)+' puan'+(c.durum==='belirsiz'?' (şans payı içinde)':''))+'">'+isaret(c.fark,v=>fi(Math.round(v)))+'</td>';
  // İlk → son: the topic's gap on its last measured exam minus on its first (points): the direction at a glance.
  const degisim=r=>r.degisim===null?'<td class="ogr-iz-degisim"></td>':'<td class="ogr-iz-degisim '+(r.degisim>=.5?'ogr-y':r.degisim<=-.5?'ogr-k':'ogr-sabit')+'" title="'+kacis(r.ad+': ilk ölçümde '+isaret(r.hucre.find(Boolean).fark,f1)+', son ölçümde '+isaret([...r.hucre].reverse().find(Boolean).fark,f1)+' puan')+'">'+(r.degisim>=.5?'▲ ':r.degisim<=-.5?'▼ ':'■ ')+isaret(r.degisim,v=>fi(Math.round(v)))+'</td>';
  return '<div class="ogr-iz-kutu"><table class="ogr-iz"><thead><tr><th scope="col" class="ogr-iz-konu">Konu</th>'+bas+'<th scope="col" class="ogr-iz-degisim" title="Konunun son ölçümdeki farkı eksi ilk ölçümdeki farkı (puan)">İlk → son</th><th scope="col" class="ogr-iz-seri"></th></tr></thead><tbody>'+
    z.satir.map(r=>'<tr><th scope="row" class="ogr-iz-konu">'+kacis(r.ad)+'</th>'+r.hucre.map((c,i)=>hucre(r,c,z.sinavlar[i])).join('')+degisim(r)+'<td class="ogr-iz-seri">'+seri(r)+'</td></tr>').join('')+'</tbody></table></div>'+
    '<div class="ogr-olcek" aria-hidden="true"><span>Türkiye’nin gerisinde</span><i></i><span>Türkiye’nin önünde</span></div>';
}
function etutHtml(b){
  const e=b.etut;if(!e)return '';
  const ok=e.olculen&&e.once!==null&&e.sonra!==null;
  return '<div class="ogr-etut"><div class="ogr-etut-sayi" title="Etüt raporundaki satır sayısı: bir öğrencinin bir etüde katılımı"><strong>'+fi(e.etut)+'</strong><span>etüt katılımı</span></div><div class="ogr-etut-sayi"><strong>'+fi(e.ogrenci)+'</strong><span>öğrenci</span></div>'+
    (e.ayrilmamis&&e.ikiOturum?'<p class="mini ogr-etut-not">'+fi(e.ayrilmamis)+' etüdün adında TYT/AYT yok: bu etütler dersin TYT ve AYT bölümünde birlikte sayıldı.</p>':'')+
    (ok?'<div class="ogr-etut-once" title="Etüt alan '+fi(e.olculen)+' öğrencinin Türkiye’ye göre ortalama farkı: ilk etütten önceki son deneme → son deneme"><span class="'+(e.once<0?'ogr-k':'ogr-y')+'">'+isaret(e.once,f1)+'</span><i aria-hidden="true">→</i><span class="'+(e.sonra<0?'ogr-k':'ogr-y')+'">'+isaret(e.sonra,f1)+'</span><small>net Türkiye’ye göre · '+fi(e.olculen)+' öğrenci</small></div>':'')+'</div>';
}
// The raw topic table can run to thousands of rows over all teachers, so it is built when its box is opened (hamKonu).
function hamKonu(b){
  const z=b&&b.izgara;if(!z)return '';
  return '<div class="et-tablo-kutu"><table class="et-tablo ogr-ham"><thead><tr><th scope="col">Konu</th><th scope="col">Deneme</th><th scope="col" class="sayi">Yanıt (n)</th><th scope="col" class="sayi">Doğru (d)</th><th scope="col" class="sayi">Türkiye’ye göre beklenen (b)</th><th scope="col" class="sayi">Fark (puan)</th><th scope="col" class="sayi">z</th></tr></thead><tbody>'+
    z.satir.flatMap(r=>r.hucre.map((c,i)=>c?'<tr><td>'+kacis(r.ad)+'</td><td>'+kacis(z.sinavlar[i].ad)+'</td><td class="sayi">'+fi(c.n)+'</td><td class="sayi">'+fi(c.d)+'</td><td class="sayi">'+f2(c.b)+'</td><td class="sayi">'+isaret(c.fark,f1)+'</td><td class="sayi">'+(c.z===null?'—':isaret(c.z,f2))+'</td></tr>':'')).join('')+'</tbody></table></div>';
}
function hamVeri(b,i){
  const seri=b.seri.length?'<div class="et-tablo-kutu"><table class="et-tablo ogr-ham"><thead><tr><th scope="col">Deneme</th><th scope="col" class="sayi">Öğrenci</th><th scope="col" class="sayi">Ortalama net</th><th scope="col" class="sayi">Türkiye ort. (Genel Net)</th><th scope="col" class="sayi">Fark</th></tr></thead><tbody>'+
    b.seri.map(p=>'<tr><td>'+kacis(p.ad)+'</td><td class="sayi">'+fi(p.n)+'</td><td class="sayi">'+f2(p.net)+'</td><td class="sayi">'+(p.genel===null?'—':f2(p.genel))+'</td><td class="sayi">'+isaret(p.fark,f2)+'</td></tr>').join('')+'</tbody></table></div>':'';
  const konu=b.izgara?'<div class="ogr-ham-konu" data-ogr-ham-konu="'+i+'"></div>':'';
  return '<details class="ogr-formul" data-ogr-ham="'+i+'"><summary>Nasıl hesaplanır · ham veriler</summary>'+
    '<p><b>Kimler?</b> '+kacis(b.siniflar.join(', '))+' sınıflarının öğrencileri birlikte (ders programında bu dersi verdiğiniz sınıflar). Sınıflar ayrı ayrı gösterilmez, öğrenci adı yoktur.</p>'+
    '<p><b>Net grafiği:</b> her denemede öğrencilerinizin bu dersteki net ortalaması (neti basılmış öğrenciler) ve yayınevinin Türkiye ortalaması (Genel Net). Üstteki çubuklar farktır: Fark = ortalama net − Genel Net; yeşil çubuk Türkiye’nin üstünde, kırmızı altında. Çubukların ölçeği farkların kendi aralığıdır, küçük değişimler de görünsün diye. Önceki / ilk denemeye göre: son farkın o denemedeki farktan ne kadar değiştiği.</p>'+
    '<p><b>Konu tablosu:</b> her hücre, o denemede o konunun sorularında öğrencilerinizin doğru sayısını (d), aynı soruları çözen Türkiye geneli öğrencilerinin başarı oranlarından beklenen doğru sayısıyla (b = soruların Türkiye başarı oranlarının toplamı) karşılaştırır. Fark = 100 · (d − b) / n puan; n öğrencilerinizin o sorulara verdiği yanıt sayısıdır. Böylece zor sorular konuyu haksız yere kırmızıya boyamaz: aynı soruda Türkiye de zorlanmışsa beklenen de düşüktür.</p>'+
    '<p><b>Renk:</b> kırmızı = Türkiye’nin gerisinde, yeşil = önünde; fark büyüdükçe renk koyulaşır (±'+RENK_UST+' puanda en koyu). Soluk hücre: fark şans payı içinde (z = (d − b) / √(Σ n·p·(1 − p) · (1 + (soru − 1) · 0,2)), |z| < 1,96; bir öğrencinin aynı konudaki yanıtları birbirine bağlı sayılır). ▼▼▼ / ▲▲▲: konu son '+ART_ARDA+' ölçümde belirgin biçimde geride / önde. İlk → son: konunun son ölçümdeki farkı eksi ilk ölçümdeki farkı (puan); betimleyicidir, şans payı sınanmaz.</p>'+
    '<p><b>Etüt:</b> bu dersteki etütleriniz ve bu sınıf düzeyinden aldıkları öğrenci sayısı. Etüt adında TYT ya da AYT yazıyorsa o bölümde, yazmıyorsa dersin her iki bölümünde sayılır (etütler TYT/AYT diye ayrılmıyor). Ok, etüt alan öğrencilerin Türkiye’ye göre ortalama farkıdır: ilk etütten önceki son denemede → son denemede. Betimleyicidir: etüt dışındaki her şey de bu değişime katkı yapar.</p>'+seri+konu+'</details>';
}
function blokHtml(b,i){
  // The newest exam that has a Türkiye average (an exam whose list has not come yet is skipped, never filled in).
  const son=b.seri.filter(p=>p.fark!==null).pop()||null,fark=son?son.fark:null;
  // How the gap moved: against the exam before and against the first one (only exams with a Türkiye average).
  const fl=b.seri.filter(p=>p.fark!==null),degis=(p,ad)=>{const d=son.fark-p.fark,yon=d>=.05?'ogr-y':d<=-.05?'ogr-k':'ogr-sabit';
    return '<span class="ogr-degisim"><b class="'+yon+'">'+(d>=.05?'▲':d<=-.05?'▼':'■')+' '+isaret(d,f1)+'</b> '+kacis(ad)+'</span>'};
  const kpi='<div class="ogr-kpi"><span class="ogr-kpi-ad">Son deneme · Türkiye’ye göre</span><strong class="'+(fark===null?'':fark<0?'ogr-k':'ogr-y')+'">'+(fark===null?'—':isaret(fark,f1))+'<small> net</small></strong>'+
    (son?'<span class="mini">'+kacis(son.ad)+' · '+fi(son.n)+' öğrenci</span>':'')+
    (fl.length>=2?degis(fl[fl.length-2],'önceki denemeye göre'):'')+(fl.length>=3?degis(fl[0],'ilk denemeye göre ('+(gunAy(fl[0].g)||fl[0].ad)+')'):'')+'</div>';
  return '<section class="et-panel ogr-blok"><div class="et-kart-bas"><h3><i class="et-renk nokta" style="background:'+renk(b.kod)+'"></i> '+kacis(b.dersAd)+' · '+fi(b.duzey)+'. sınıf</h3>'+
    '<div class="et-lejant"><span><i class="et-renk cizgi ogr-l-okul" style="background:'+renk(b.kod)+'"></i>Öğrencileriniz</span><span><i class="et-renk cizgi ogr-l-tr"></i>Türkiye ortalaması</span><span><i class="et-renk ogr-l-cubuk"></i>Fark</span></div></div>'+
    '<div class="ogr-ust">'+kpi+'<div class="ogr-grafik" data-ogr-grafik="'+i+'"></div></div>'+
    '<h4 class="ogr-alt-baslik">Konular · Türkiye ile aynı sorularda</h4>'+izgaraHtml(b)+etutHtml(b)+hamVeri(b,i)+'</section>';
}
let SON=null;
function gorunum(){
  if(typeof rehberMi!=='function'||!rehberMi())return '<div class="baslik"><h1>Öğretmen raporu</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  const l=ogretmenler();
  if(!l.length){SON=null;return '<div id="ogrKok"><header class="et-bas"><h1 class="et-baslik">Öğretmen raporu</h1></header><section class="et-panel et-bos"><b>Ders programı yok</b><p>Öğretmenler, Etüt planı’na eklenen sınıf ders programlarından gelir. Etüt planı’nda sınıfların haftalık ders programlarını ekleyin.</p><button type="button" class="et-dugme" data-sekme="etutplani">Etüt planı →</button></section></div>'}
  // Sınıf düzeyi: every grade of the timetables, or one (12. sınıf …); the teachers are those who teach that grade.
  const duzeyler=[...new Set(l.flatMap(o=>o.dersler.flatMap(d=>d.siniflar.map(duzeyi))))].filter(x=>x!==null).sort((a,b)=>b-a);
  const duzey=duzeyler.includes(EK.ogrDuzey)?EK.ogrDuzey:null,uygun=duzey===null?l:l.filter(o=>o.dersler.some(d=>d.siniflar.some(c=>duzeyi(c)===duzey)));
  const secili=uygun.find(o=>o.key===EK.ogrHoca)?EK.ogrHoca:'',goster=secili?uygun.filter(o=>o.key===secili):uygun;
  const c=sayfaBaglami(),modeller=goster.map(o=>ogretmenModeli(o,c,duzey));SON=modeller;
  let sayac=0;
  // A subject taught in one session only (TYT Matematik, AYT Edebiyat …) says which.
  const dersYazisi=d=>{const ot=[...new Set(d.kodlar.filter(k=>((d.kodSinif||{})[k[2]]||d.siniflar).some(x=>d.siniflar.includes(x))).map(k=>k[0]))];
    return kacis(d.ad)+(ot.length===1?' ('+ot[0]+')':'')+' · '+kacis(d.siniflar.join(', '))};
  const bolum=o=>'<section class="ogr-ogretmen" data-ogr-hoca="'+kacis(o.key)+'"><header class="ogr-ogretmen-bas"><h2>'+kacis(kisiAd(o.ad))+'</h2><p class="mini">'+
    o.dersler.map(dersYazisi).join(' — ')+'</p></header>'+
    (o.bloklar.length?o.bloklar.map(b=>blokHtml(b,sayac++)).join(''):'<p class="mini ogr-yok">Bu öğretmenin derslerinde henüz deneme ya da konu verisi yok.</p>')+'</section>';
  const duzeySec='<label class="et-seg"><span class="et-seg-label">Sınıf düzeyi</span><select id="ogrDuzey"><option value="">Bütün düzeyler</option>'+duzeyler.map(d=>'<option value="'+d+'"'+(d===duzey?' selected':'')+'>'+d+'. sınıf</option>').join('')+'</select></label>';
  const secim='<label class="et-seg"><span class="et-seg-label">Öğretmen</span><select id="ogrHoca"><option value="">Bütün öğretmenler ('+fi(uygun.length)+')</option>'+uygun.map(o=>'<option value="'+kacis(o.key)+'"'+(o.key===secili?' selected':'')+'>'+kacis(kisiAd(o.ad))+'</option>').join('')+'</select></label>';
  planla();
  return '<div id="ogrKok"><header class="et-bas"><h1 class="et-baslik">Öğretmen raporu'+(duzey!==null?' · '+duzey+'. sınıf':'')+'</h1><p class="et-cumle">Her öğretmenin, dersini verdiği sınıfların öğrencileri birlikte: Türkiye ortalamasına göre net ve aynı sorularda konu konu Türkiye ile karşılaştırma. Sınıflar ve öğrenciler birbiriyle karşılaştırılmaz.</p></header>'+
    '<div class="et-arac">'+duzeySec+secim+'<button type="button" class="et-dugme" id="ogrYazdir">Yazdır / PDF</button></div>'+
    (modeller.length?modeller.map(bolum).join(''):'<p class="mini ogr-yok">Bu sınıf düzeyinde ders veren öğretmen yok.</p>')+'</div>';
}
let ZAMAN=null;
function grafikleriCiz(){
  if(!SON||typeof document==='undefined')return;const bl=SON.flatMap(o=>o.bloklar);
  // Every width is read before any chart is drawn: reading one after drawing another would lay the whole page out again each time.
  const kutular=[...document.querySelectorAll('#ogrKok .ogr-grafik[data-ogr-grafik]')].map(k=>[k,Math.round(k.clientWidth)]);
  for(const [k,W] of kutular){const b=bl[+k.dataset.ogrGrafik];if(!b||W<160||k.dataset.w===String(W))continue;k.dataset.w=String(W);k.innerHTML=netGrafigi(b,W)}
}
function planla(){if(typeof window==='undefined'||!window.requestAnimationFrame)return;window.cancelAnimationFrame(ZAMAN);ZAMAN=window.requestAnimationFrame(grafikleriCiz)}
if(typeof window!=='undefined'&&window.addEventListener){
  const acik=()=>typeof EK!=='undefined'&&EK.sekme==='ogretmenrapor';
  window.addEventListener('resize',()=>{if(acik())planla()});
  // Printing lays the page out at the paper's width: the charts are drawn again at their printed width (text stays readable), and
  // again at the screen's afterwards.
  if(window.matchMedia){const mq=window.matchMedia('print'),f=()=>{if(acik())grafikleriCiz()};if(mq.addEventListener)mq.addEventListener('change',f);else if(mq.addListener)mq.addListener(f)}
  window.addEventListener('afterprint',()=>{if(acik())planla()});
}
if(typeof document!=='undefined'&&document.addEventListener){
  document.addEventListener('change',ev=>{if(typeof rehberMi!=='function'||!rehberMi())return;
    if(ev.target.id==='ogrHoca'){EK.ogrHoca=ev.target.value||undefined;ciz()}
    else if(ev.target.id==='ogrDuzey'){EK.ogrDuzey=ev.target.value?Number(ev.target.value):undefined;ciz()}});
  document.addEventListener('click',ev=>{if(ev.target.closest?.('#ogrYazdir')&&typeof rehberMi==='function'&&rehberMi()){grafikleriCiz();try{window.print()}catch(e){}}});
  // toggle does not bubble: listen while it travels down.
  document.addEventListener('toggle',ev=>{const d=ev.target;if(!d||!d.open||!d.matches||!d.matches('#ogrKok details.ogr-formul[data-ogr-ham]'))return;hamDoldur(d)},true);
}
function hamDoldur(d){
  const yer=d.querySelector('.ogr-ham-konu[data-ogr-ham-konu]');if(!yer||yer.dataset.dolu)return;
  const b=SON?SON.flatMap(o=>o.bloklar)[+yer.dataset.ogrHamKonu]:null;if(!b)return;
  yer.innerHTML=hamKonu(b);yer.dataset.dolu='1';
}
return {DERSLER,ogretmenler,netSerisi,konuIzgarasi,olc,etutOzeti,ogretmenModeli,hucreRengi,netGrafigi,izgaraHtml,hamKonu,bloklar:()=>SON?SON.flatMap(o=>o.bloklar):[],gorunum,grafikleriCiz,sinifK,R_MADDE,RENK_UST,ART_ARDA};
})();
function gorunumOgretmenRapor(){return OGRETMEN_RAPOR.gorunum()}
