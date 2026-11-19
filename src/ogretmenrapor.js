// Embedded in index.html by scripts/embed-ogretmenrapor.cjs. No student data belongs here.
// Öğretmen raporu (rehber öğretmen only): one section per teacher of the weekly timetables (Etüt planı → ders programları).
// A teacher's students are the students of the classes the teacher teaches the subject in, TAKEN TOGETHER: the report never
// shows a class on its own, never ranks classes, never names a student and never compares one teacher with another. Per grade
// and per exam subject (TYT Matematik, AYT Matematik …) it shows:
//  1. the students' mean net in the subject against the Türkiye average (Genel Net) exam by exam, and the gap;
//  2. a topic table: for every topic of the subject (Konu Takibi) and every exam, how the students did against students across
//     Türkiye on the same questions, on one spectrum: red where worse, amber about level, green where better, further out the
//     larger the gap (nearer the middle when the gap is within chance); a label where a topic has been behind (or ahead) on three measured exams in a row;
//  3. folded: the formulas and every raw number behind the figures.
// It is written to be handed to the teacher on paper: plain labels, the source of the numbers and how to read them on the sheet.
// It is about the lessons a teacher gives in class: etüts (one-to-one sessions after school) are not part of it.
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
// A value that rounds to zero carries no sign: "0", never "−0" or "+0,0".
const isaret=(v,f=f1)=>{if(v===null||v===undefined)return '—';const s=f(Math.abs(v));return (/[1-9]/.test(s)?(v>0?'+':'−'):'')+s};
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
// prints their net. From the subject's Türkiye list itself (only what it prints): its last row (sinir: the 100th school of
// an "İlk 100" list), its first school (birinci), its length (listeN) and the school's own printed place (sira: null outside
// the list, undefined when no school is followed on the Türkiye geneli page). The last row against the Türkiye average is
// the list's own yardstick for a gap: how far above the average a school has to be to enter the list.
// gorulen (optional Set): filled with the classes that had a net (an SAY class has no AYT Edebiyat).
// nolar (optional Set of school numbers): those students instead of the classes (Öğrenci raporu: one student).
// Questions per subject in the YKS (ÖSYM): a percentage puts a 5-question test and a 40-question one on one scale, so 2,5 net in
// TYT Din (of 5) looks like 20 net in TYT Matematik (of 30 + Geometri 10 apart): both 50%.
const SORU_STANDART={TÜR:40,TAR:5,COĞ:5,FEL:5,DİN:5,'S.F':5,MAT:30,GEO:10,FİZ:7,KİM:7,BİY:6,EDB:24,TAR1:10,COĞ1:6,TAR2:11,COĞ2:11,FELGR:12,DİN2:6,'S.F2':6,AMAT:30,AGEO:10,AFİZ:14,AKİM:13,ABİY:13};
// An exam's question count for a subject. The list prints D/Y, not the blanks, so it cannot say the count alone: the most answers
// (D + Y) a student of the whole list gave, when it is above the YKS count or well below it (a lower grade's shorter test); else
// the YKS count.
function soruSayisi(liste,anahtar){
  let en=0;for(const o of Object.values(liste||{})){const m=/^(\d+)\/(\d+)/.exec((o&&o.dy&&o.dy[anahtar])||'');if(m)en=Math.max(en,+m[1]+ +m[2])}
  const st=SORU_STANDART[anahtar]||0;if(!st)return en||null;return en>st||en&&en<st*.7?en:st;
}
// The page's Türkiye is the publisher's whole network (2026-11-19), the pupils the topic squares are measured against: its mean
// net from the same Performans analizi (KONU_TAKIBI.agNet: Σ (p − w / 4)). The İlk 100 list's Genel Net is the top schools'
// level (AYT Geometri 27-YKS-1202: 3,11 against the network's 0,90) and is no longer the line; the list still gives the school's
// place (sira). An exam without that file, or with one read before the wrong shares were kept, has no Türkiye value (ilk100
// keeps the list's figure for the appendix).
function agBagla(seri,v,kod){
  const agNet=typeof KONU_TAKIBI!=='undefined'&&typeof KONU_TAKIBI.agNet==='function'?KONU_TAKIBI.agNet:null;
  for(const p of seri){const ag=agNet&&v?agNet(v,p.ad,kod):null;p.ilk100=p.genel;p.genel=Number.isFinite(ag)?ag:null;p.fark=p.genel===null?null:p.net-p.genel}
  return seri;
}
// The exact count where Konu Takibi has the publisher's Sınav özeti of the exam (one entry a question).
function ozetSorulari(seri,v,kod){
  if(!v||!v.zorluk||typeof KONU_TAKIBI==='undefined')return seri;
  for(const p of seri){const z=v.zorluk[KONU_TAKIBI.ek(p.ad)],q=z&&z.ozet&&z.ozet[kod];if(Array.isArray(q)&&q.length)p.soru=q.length}
  return seri;
}
const anahtarOf=kod=>{for(const [,,l] of DERSLER)for(const k of l)if(k[2]===kod)return k[1];return null};
// A net as a percentage of the test (null when the count is unknown).
const yuzdesi=(v,soru)=>v===null||v===undefined||!soru?null:100*v/soru;
function netSerisi(k,siniflar,oturum,anahtar,kod,gorulen,nolar){
  const out=[];if(!k||!k.t)return out;
  // AYT: a student counts in a subject only when they answered its test (an SAY student's 0 net in Edebiyat is not a result).
  const S=new Set(siniflar),alan=oturum==='TYT'?'tyt':'ayt',almadi=o=>oturum==='AYT'&&typeof SIRALAMA!=='undefined'&&typeof SIRALAMA.denedi==='function'&&SIRALAMA.denedi(o,anahtar)===false;
  for(const s of k.t.sinavlar){
    const l=[],liste=s[alan]||{};for(const o of (nolar?[...nolar].map(n=>liste[n]).filter(Boolean):Object.values(liste))){const kisi=k.t.kisi.get(o.no);if(!kisi)continue;const c=sinifK(kisi.sinif);if(nolar?!nolar.has(String(o.no)):!S.has(c))continue;if(almadi(o))continue;const v=o.net&&o.net[anahtar];if(Number.isFinite(v)){l.push(v);if(gorulen)gorulen.add(c)}}
    if(!l.length)continue;
    const tr=k.trFn?k.trFn(s.ad):null,genel=tr?tr.genel(kod):null,li=tr&&tr.dersListesi&&Number.isFinite(genel)?tr.dersListesi(kod):null;
    const soru=soruSayisi(liste,anahtar);
    out.push({id:s.id,ad:s.ad,g:s.g,n:l.length,soru,net:ort(l),genel:Number.isFinite(genel)?genel:null,fark:Number.isFinite(genel)?ort(l)-genel:null,
      sinir:li?li.son.net:null,birinci:li?li.ilk.net:null,listeN:li?li.n:null,sira:li?li.sira:undefined});
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
function konuIzgarasi(v,siniflar,oturum,kod,c=baglam(null,v),gorulen,nolar){
  if(!v||!Array.isArray(v.exams)||typeof KONU_TAKIBI==='undefined')return null;
  const S=new Set(siniflar),ck=KONU_TAKIBI.key(kod),sinavlar=[],konular=new Map();
  for(const e of dersSinavlari(c,kod)){
    const r=sinavFarki(c,oturum,e);if(!r||!r.ogrenciler.length)continue;
    const i=sinavlar.length,toplam={d:0,b:0,n:0,v:0,ogr:0};let var_=false;
    if(nolar&&!r.idx){r.idx=new Map();for(const st of r.ogrenciler)r.idx.set(String(st.student.no),st)}
    for(const st of (nolar?[...nolar].map(n=>r.idx.get(n)).filter(Boolean):r.ogrenciler)){const sc=sinifK(st.student.cls);if(nolar?!nolar.has(String(st.student.no)):!S.has(sc))continue;let bu=false;
      for(const t of st.konular.values()){if(t.ders!==ck||!t.n||t.id.endsWith('|?'))continue;var_=bu=true;
        let K=konular.get(t.id);if(!K){K={id:t.id,ad:t.ad,hucre:[]};konular.set(t.id,K)}if(t.kod)siraAl(K,t.kod);
        const c=K.hucre[i]||(K.hucre[i]={d:0,b:0,n:0,v:0,ogr:0}),p=Math.min(1,Math.max(0,t.b/t.n)),vv=t.n*p*(1-p)*(1+(t.n-1)*R_MADDE);
        c.d+=t.d;c.b+=t.b;c.n+=t.n;c.v+=vv;c.ogr++;toplam.d+=t.d;toplam.b+=t.b;toplam.n+=t.n;toplam.v+=vv}
      // The kazanımlar of each topic, measured the same way (alt): smaller rows under the topic's own.
      if(st.kazanimlar)for(const q of st.kazanimlar.values()){if(q.ders!==ck||!q.n)continue;const K=konular.get(q.konu);if(!K)continue;
        K.alt=K.alt||new Map();let A=K.alt.get(q.kod);if(!A)K.alt.set(q.kod,A={kod:q.kod,ad:q.ad,hucre:[]});siraAl(K,q.kod);
        const h=A.hucre[i]||(A.hucre[i]={d:0,b:0,n:0,v:0,ogr:0}),p=Math.min(1,Math.max(0,q.b/q.n));h.d+=q.d;h.b+=q.b;h.n+=q.n;h.v+=q.n*p*(1-p)*(1+(q.n-1)*R_MADDE);h.ogr++}
      if(bu){toplam.ogr++;if(gorulen)gorulen.add(sc)}}
    if(!var_)continue;
    const tarih=tarihi(c)(e);sinavlar.push({ad:e.ad,g:tarih?Date.parse(tarih+'T00:00:00Z')/864e5:null,ogr:toplam.ogr,...olc(toplam)});
  }
  if(!sinavlar.length)return null;
  // The şube's plan order: the block's classes, or the student's own class.
  const planSiniflari=siniflar.length?siniflar:nolar&&c.k&&c.k.t?[...nolar].map(n=>c.k.t.kisi.get(String(n))).filter(Boolean).map(k=>sinifK(k.sinif)):[];
  const liste=planListesi(planSiniflari,kod,oturum);if(liste)planaGore(konular,liste);
  return izgaraKur(sinavlar,konular);
}
// The order topics are taught in: a kazanım code's numbers after the lesson's letters (E.GEO.9.4.3.1 → 9, 4, 3, 1: grade, unit,
// topic, kazanım), so 9th-grade Üçgenler come before 10th-grade Çokgenler and 11th-grade Çember. A topic takes its earliest
// kazanım's place (sira); a topic with no numbered kazanım goes last.
const kodSirasi=kod=>{const m=/(?:^|\.)(\d+(?:\.\d+)*)/u.exec(String(kod||''));return m?m[1].split('.').map(Number):null};
function siraKarsilastir(a,b){
  if(!a||!b)return (!a)-(!b);
  for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]??-1,y=b[i]??-1;if(x!==y)return x-y}
  return 0;
}
// The order the students' weekly schedules use (2026-11-18): the şube's own topic plan (Müfredat, D.konuPlani[şube kodu]),
// week by week. A class (12/A) finds its şube code in the timetables (Etüt planı → 12/A = 301); the lesson by its name
// (MATEMATİK-A → "Matematik AYT", GEOMETRİ-T → "Geometri", TARİH.1-A → "Tarih"). Konu Takibi names its topics after the MEB
// programme and the plan after the school's own list ("Üçgenlerde Eşlik ve Benzerlik" / "Üçgende Eşlik"), so a topic takes the
// plan entry sharing most of its words (at least 60% of them, or all of the entry's) (each word cut to its first five letters; one a prefix of the other counts, so Alanı
// meets Alan). A topic with no such entry stays after the topic before it in the kazanım codes. No plan: the kazanım codes.
const planNorm=t=>String(t||'').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^A-Z0-9]+/g,' ').trim();
const PLAN_DOLGU=new Set(['VE','ILE','DE','DA','KI','BIR','IN','TYT','AYT','DEVAMI','I','II']);
const PLAN_GENEL=new Set(['ANLAM','KAVRA','TEMEL','PROBL','SISTE','ISLEM','OZELL','IFADE','DENKL','SAYI','SAYIL','GENEL','YAPI','TURLE','CESIT','ELEMA','UYGUL','GOSTE','ILISK','DONEM','FONKS','GRAFI','DEREC','BILIN','ESITS']);
const planKokleri=t=>planNorm(t).split(' ').filter(w=>w.length>=3&&!PLAN_DOLGU.has(w)).map(w=>w.slice(0,5));
function planDersi(plan,kod,oturum){
  const n=planNorm(kod).replace(/ [TA]$/,'').replace(/^S /,'').replace(/ (GR|[12])\b.*$/,'').trim(),k=n.split(' '),taban=/^(TURK|DIN)$/.test(k[0])?k.slice(0,2).join(' '):k[0];
  const adlar=[...new Set(plan.flatMap(h=>Object.keys(h||{})))],aday=adlar.filter(d=>planNorm(d)===taban||planNorm(d).startsWith(taban+' ')&&!(taban==='TURK'&&/TURKCE/.test(planNorm(d))));
  return aday.find(d=>planNorm(d).split(' ').includes(oturum))||aday.find(d=>!/ (TYT|AYT)$/.test(planNorm(d)))||aday[0]||null;
}
function planListesi(siniflar,kod,oturum){
  if(typeof D==='undefined'||!D||!D.konuPlani)return null;
  const kodlar={};try{const pl=typeof ETUTPLANI!=='undefined'?ETUTPLANI.oku().plan:null;for(const [s,x] of Object.entries((pl&&pl.programlar)||{}))if(x&&x.kod)kodlar[sinifK(s)]=String(x.kod)}catch(e){}
  for(const c of siniflar){
    const plan=D.konuPlani[kodlar[c]]||D.konuPlani[c];if(!Array.isArray(plan))continue;
    const ders=planDersi(plan,kod,oturum);if(!ders)continue;
    const l=[];for(const h of plan)for(const t of (h&&h[ders])||[]){if(planNorm(t)==='GENEL TEKRAR'||l.includes(t))continue;const tag=/\((TYT|AYT)\)\s*$/.exec(t);if(tag&&tag[1]!==oturum)continue;l.push(t)}
    if(l.length)return l;
  }
  return null;
}
function planYeri(ad,liste){
  const a=planKokleri(ad);if(!a.length)return null;let en=null,puan=0,ikinci=0;
  liste.forEach((t,i)=>{const b=planKokleri(t);if(!b.length)return;const ortak=a.filter(x=>b.some(y=>x.startsWith(y)||y.startsWith(x))).length,p=ortak/a.length,q=ortak/b.length;
    // Most of the topic's words (60%), or every word of the entry (Özel Dörtgenler → Dörtgenler), or half of them when a shared word
    // is a specific one (Bölünebilme Kuralları → Bölme ve Bölünebilme); a shared common word is not enough (Sözcükte Anlam is not
    // Cümlede Anlam ve Anlatım, Sindirim Sistemi not Dolaşım Sistemi).
    const ozel=a.some(x=>!PLAN_GENEL.has(x)&&b.some(y=>x.startsWith(y)||y.startsWith(x)));
    if((p>=.6||q===1||p>=.5&&ozel)&&(p>puan||p===puan&&q>ikinci)){en=i;puan=p;ikinci=q}});
  return en;
}
// Topics in the plan's order: matched ones by their place, the others right after the topic before them in the kazanım codes.
function planaGore(konular,liste){
  const l=[...konular.values()].sort((a,b)=>siraKarsilastir(a.sira,b.sira)||a.ad.localeCompare(b.ad,'tr'));let son=-1,ek=0;
  for(const K of l){const i=planYeri(K.ad,liste);if(i!==null){son=i;ek=0;K.sira=[i,0]}else K.sira=[son,++ek]}
}
function siraAl(K,kod){const s=kodSirasi(kod);if(s&&(!K.sira||siraKarsilastir(s,K.sira)<0))K.sira=s}
// sinavlar: [{ad, g, ogr, fark, z, durum}]; konular: Map(id → {id, ad, sira, hucre:[{d,b,n,v}], alt: Map(kod → {kod, ad, hucre})}).
function izgaraKur(sinavlar,konular){
  const satir=[...konular.values()].map(K=>{
    const hucre=sinavlar.map((_,i)=>K.hucre[i]?{...K.hucre[i],...olc(K.hucre[i])}:null);
    const olcu=hucre.filter(Boolean),sonlar=olcu.slice(-ART_ARDA);
    const seri=sonlar.length===ART_ARDA&&sonlar.every(c=>c.durum==='geride')?'geride':sonlar.length===ART_ARDA&&sonlar.every(c=>c.durum==='onde')?'onde':null;
    const alt=K.alt?[...K.alt.values()].map(A=>{const hc=sinavlar.map((_,i)=>A.hucre[i]?{...A.hucre[i],...olc(A.hucre[i])}:null),ol=hc.filter(Boolean),f=ol.map(c=>c.fark);
      return {kod:A.kod,ad:A.ad,hucre:hc,ortFark:f.length?ort(f):0,degisim:ol.length>=2?ol[ol.length-1].fark-ol[0].fark:null}})
      .sort((a,b)=>siraKarsilastir(kodSirasi(a.kod),kodSirasi(b.kod))||a.kod.localeCompare(b.kod,'tr',{numeric:true})):[];
    const fl=olcu.map(c=>c.fark);return {id:K.id,ad:K.ad,sira:K.sira||null,alt,hucre,seri,ortFark:fl.length?ort(fl):0,olcum:olcu.length,degisim:olcu.length>=2?olcu[olcu.length-1].fark-olcu[0].fark:null};
  }).sort((a,b)=>siraKarsilastir(a.sira,b.sira)||a.ad.localeCompare(b.ad,'tr'));
  return {sinavlar,satir};
}
// The page's shared context: the lists (ANALIZ), Konu Takibi and, on first use, every exam's topic comparison. One render reads
// each source once, whatever the number of teachers and blocks.
function baglam(k,v){return {k,v,fark:new Map(),dersSinav:new Map(),tarih:sinavTarihi()}}
const tarihi=c=>c.tarih||(c.tarih=sinavTarihi());
// An exam's day in Konu Takibi (ISO, or null): its own date, else the one the school lists (Sıralamalar) give it, as on the
// Konu Takibi page and in the net chart. Most karneler print no date: sorted by '' they came before every dated exam.
function sinavTarihi(){
  let okul=[];try{okul=typeof SIRALAMA!=='undefined'?SIRALAMA.oku().veri?.sinavlar||[]:[]}catch(e){okul=[]}
  const m=new Map();
  return e=>{if(!m.has(e))m.set(e,typeof KONU_TAKIBI!=='undefined'&&typeof KONU_TAKIBI.examDate==='function'?KONU_TAKIBI.examDate(e,okul):e.date||null);return m.get(e)};
}
// Oldest first; an exam with no date anywhere goes last (it is most often the newest, its lists not added yet).
function dersSinavlari(c,kod){
  let l=c.dersSinav.get(kod);
  if(!l){const t=tarihi(c);l=(c.v&&Array.isArray(c.v.exams)?c.v.exams:[]).filter(e=>e.blocks.some(b=>b.course===kod))
    .sort((a,b)=>(!t(a))-(!t(b))||String(t(a)||'').localeCompare(String(t(b)||''))||a.ad.localeCompare(b.ad,'tr',{numeric:true}));c.dersSinav.set(kod,l)}
  return l;
}
function sinavFarki(c,oturum,e){
  const anahtar=oturum+'|'+KONU_TAKIBI.ek(e.ad);
  // kazanim: a kazanım with no topic (every 11th and 12th grade code: the built-in map stops at the 10th grade) is a row under
  // its own name. Dropping them left an AYT block with the few 9th and 10th grade questions of one exam and nothing else.
  if(!c.fark.has(anahtar)){let r;try{r=KONU_TAKIBI.ogrenciFark(c.v,{session:oturum,exam:KONU_TAKIBI.ek(e.ad),kazanim:true})}catch(err){r=null}c.fark.set(anahtar,r)}
  return c.fark.get(anahtar);
}
function olc(c){
  const fark=c.n?100*(c.d-c.b)/c.n:null,z=c.v>0?(c.d-c.b)/Math.sqrt(c.v):null;
  return {fark,z,durum:z===null?'belirsiz':z<=-Z?'geride':z>=Z?'onde':'belirsiz'};
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
        const gorulen=new Set(),seri=agBagla(ozetSorulari(netSerisi(k,siniflar,oturum,anahtar,kod,gorulen),v,kod),v,kod),izgara=konuIzgarasi(v,siniflar,oturum,kod,c,gorulen);
        if(!seri.length&&!izgara)continue;
        bloklar.push({ders:d.ad,duzey:duz,siniflar:siniflar.filter(x=>gorulen.has(x)),oturum,kod,dersAd:dersEtiketi(kod),seri,izgara});
      }}
  }
  return {...o,dersler:duzey===null?o.dersler:o.dersler.map(d=>({...d,siniflar:d.siniflar.filter(x=>duzeyi(x)===duzey)})).filter(d=>d.siniflar.length),bloklar};
}
const dersEtiketi=kod=>({'TÜRKÇE-T':'TYT Türkçe','TARİH-T':'TYT Tarih','COĞRAFYA-T':'TYT Coğrafya','FELSEFE-T':'TYT Felsefe','DİN KÜLTÜRÜ-T':'TYT Din kültürü','MATEMATİK-T':'TYT Matematik','GEOMETRİ-T':'TYT Geometri',
  'FİZİK-T':'TYT Fizik','KİMYA-T':'TYT Kimya','BİYOLOJİ-T':'TYT Biyoloji','TÜRK DİLİ VE EDB-A':'AYT Edebiyat','TARİH.1-A':'AYT Tarih-1','COĞRAFYA.1-A':'AYT Coğrafya-1','TARİH.2-A':'AYT Tarih-2','COĞRAFYA.2-A':'AYT Coğrafya-2',
  'FELSEFE GR.-A':'AYT Felsefe grubu','DİN KÜLTÜRÜ-A':'AYT Din kültürü','MATEMATİK-A':'AYT Matematik','GEOMETRİ-A':'AYT Geometri','FİZİK-A':'AYT Fizik','KİMYA-A':'AYT Kimya','BİYOLOJİ-A':'AYT Biyoloji'})[kod]||kod;

/* ---------------- drawing ---------------- */
// The words of a block: the teacher's report speaks of "your students", the student's of "you". b.y: the block's own.
const YAZI={
  ogretmen:{ogrenci:false,biz:'Öğrencileriniz',bizK:'öğrencileriniz',ort:n=>fi(n)+' öğrencinin ortalaması',konuBas:'Konular: öğrencileriniz Türkiye’ye göre nerede?',
    ornek:'Türkiye’de öğrencilerin %60’ı, sizin öğrencilerinizin %50’si doğru cevapladıysa kutuda −10 yazar.',
    ust:'Türkiye ortalamasının üzerindesiniz',alt:'Türkiye ortalamasının altındasınız',ayni:'Türkiye ortalamasıyla aynı düzeydesiniz',cik:'Türkiye ortalamasının üzerine çıktınız',dus:'Türkiye ortalamasının altına düştünüz',avantaj:'avantajınız'},
  ogrenci:{ogrenci:true,biz:'Netin',bizK:'sen',ort:()=>'bu denemede',konuBas:'Konular: Türkiye’ye göre neredesin?',
    ornek:'Türkiye’de öğrencilerin %60’ı doğru cevapladıysa ve sen bu soruların %50’sini doğru cevapladıysan kutuda −10 yazar.',
    ust:'Türkiye ortalamasının üzerindesin',alt:'Türkiye ortalamasının altındasın',ayni:'Türkiye ortalamasıyla aynı düzeydesin',cik:'Türkiye ortalamasının üzerine çıktın',dus:'Türkiye ortalamasının altına düştün',avantaj:'avantajın'}};
const yz=b=>(b&&b.y)||YAZI.ogretmen;
// The page is read on paper by teachers who have never opened the app: every figure carries a plain label, every picture says
// what it shows, and the source of the numbers is printed with them. Nothing here assumes a statistics vocabulary; the formulas
// stay in the folded appendix.
const renk=kod=>(typeof GRAFIK_RENK!=='undefined'&&GRAFIK_RENK.ders(kod))||'var(--e-c1)';
const AYLAR_KISA=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const yilNo=g=>new Date(g*864e5).getUTCFullYear();
const gunYaz=(g,yil=true)=>{const t=new Date(g*864e5);return t.getUTCDate()+' '+AYLAR_KISA[t.getUTCMonth()]+(yil?' '+t.getUTCFullYear():'')};
// "5 Eyl – 20 Ara 2026", "5 Eyl 2026 – 4 Oca 2027": the days the block's exams span.
const donem=l=>{const g=l.map(p=>p.g).filter(Number.isFinite);if(!g.length)return '';const a=Math.min(...g),b=Math.max(...g);return a===b?gunYaz(a):gunYaz(a,yilNo(a)!==yilNo(b))+' – '+gunYaz(b)};
const yonSinifi=(v,esik=.05)=>v>=esik?'ogr-y':v<=-esik?'ogr-k':'ogr-sabit';
const ok=(v,esik=.05)=>v>=esik?'▲':v<=-esik?'▼':'■';
// The squares' colours: one solid spectrum from deep red (far behind Türkiye) through orange and amber (about level) to deep
// green (far ahead); the gap sets the place, the ends at ±RENK_UST points. A gap within chance sits nearer the middle (×0,6).
// The spectrum is shared (GRAFIK_RENK.spektrum, src/grafik.js) and squashed around the middle: a 20-point gap is red, not orange.
const {SPEKTRUM,spektrum}=GRAFIK_RENK;
const kareYeri=c=>Math.max(-1,Math.min(1,c.fark/RENK_UST))*(c.durum==='belirsiz'?.6:1);
function hucreRengi(c){return c?'background:'+spektrum(kareYeri(c)):''}
// The key: the spectrum as one bar.
const SPEKTRUM_CSS='linear-gradient(90deg,'+SPEKTRUM.map(([u])=>spektrum(u)+' '+(u+1)*50+'%').join(',')+')';
const spektrumAnahtari=()=>'<span class="ogr-olcek-serit"><em>Türkiye’nin gerisinde</em><i class="ogr-spektrum" style="background:'+SPEKTRUM_CSS+'"></i><em>Türkiye’nin önünde</em></span>';
// A round step for about `adet` ticks over `aralik` (1, 2, 2,5 or 5 · 10^k).
function adimBul(aralik,adet){const ham=aralik/Math.max(1,adet),u=Math.pow(10,Math.floor(Math.log10(ham||1)));return [1,2,2.5,5,10].map(x=>x*u).find(x=>x>=ham)||10*u}
// An estimate of a label's width at the exam names' size (10,5 px): enough to wrap a name and to keep neighbours apart.
const harfEn=c=>/\d/.test(c)?6.2:/[\s\-.,·:;'’()/]/.test(c)?3.8:/[A-ZÇĞÖŞÜ]/.test(c)&&!/[Iİ]/.test(c)?7.9:/[ıijlIİftr]/.test(c)?4:6.2;
const yaziEn=s=>Array.from(s).reduce((t,c)=>t+harfEn(c),0);
// Wrap a full exam name at word boundaries to `en` px; a word longer than a line breaks after its - or _ first, and a piece
// still longer is cut so that every character is kept. enCok: at most that many lines, the last one ending in "…" (0: no limit).
function sinavAdSatirlari(ad,en,enCok=0){
  const satir=[''];
  const koy=(p,bitisik)=>{const son=satir.length-1,yeni=satir[son]+(satir[son]&&!bitisik?' ':'')+p;if(satir[son]&&yaziEn(yeni)>en)satir.push(p);else satir[son]=yeni};
  for(const kelime of yaz(ad).split(' ')){
    const parcalar=yaziEn(kelime)>en?kelime.split(/(?<=[-_])/):[kelime];
    parcalar.forEach((pc,j)=>{let parca='',ic=false;
      for(const h of Array.from(pc)){if(parca&&yaziEn(parca+h)>en){koy(parca,j>0||ic);ic=true;parca=h}else parca+=h}
      if(parca)koy(parca,j>0||ic)});
  }
  if(enCok&&satir.length>enCok){const l=satir.slice(0,enCok);let t=l[enCok-1];while(t&&yaziEn(t+'…')>en)t=t.slice(0,-1);l[enCok-1]=t+'…';return l}
  return satir;
}
// The chart's scale: every value is placed by its share of the test (0 at the foot, the whole test at the top; below 0 only for
// a negative net), so a 5-question test and a 30-question one draw fair red and green areas; the numbers written stay nets. The
// axis is marked in nets when the exams have one count (0 · 7,5 · 15 · 22,5 · 30), else in quarters of the test. Without the
// counts, nets on their own range. v(p) and g(p): where the students' and Türkiye's value of an exam sit.
function olcekKur(l){
  const pay=l.length&&l.every(p=>p.soru),v=p=>pay?yuzdesi(p.net,p.soru):p.net,g=p=>p.genel===null?null:pay?yuzdesi(p.genel,p.soru):p.genel;
  const vals=l.flatMap(p=>[v(p),...(g(p)!==null?[g(p)]:[])]),lo0=Math.min(...vals),hi0=Math.max(...vals);
  let lo,hi;if(pay){lo=lo0<0?lo0-5:0;hi=Math.max(100,hi0)}else{const pad=Math.max(.8,(hi0-lo0)*.25);lo=lo0<0?lo0-pad:Math.max(0,lo0-pad);hi=hi0+pad}
  const tekSoru=pay&&l.every(p=>p.soru===l[0].soru)?l[0].soru:null;
  const tikler=adet=>{if(pay){const t=[0,25,50,75,100];if(lo<0)t.unshift(Math.floor(lo/25)*25);return t.filter(x=>x>=lo-1e-9).map(x=>[x,tekSoru?fi(Math.round(tekSoru*x)/100+0):x===0?'0':x===100?'tam':'¼½¾'[x/25-1]||''])}
    const ad=adimBul(hi-lo,adet),o=[];for(let x=Math.ceil(lo/ad)*ad;x<=hi+1e-9;x+=ad)o.push([x,fi(Math.round(x*10)/10+0)]);return o};
  return {pay,lo,hi,v,g,etiket:p=>f1(p.net),tikler};
}
// One picture, every value of the students written on it (a printout has no tooltips): the students' mean net (the subject's
// colour) and the Türkiye average (dashed). The room between the two lines is shaded green where the students are above,
// red where below (split where the lines cross), so the picture reads without a number. Exam names run under it.
// The squares under the chart (2026-11-19): each exam's column of squares sits right under that exam on the chart, so the exam's
// name (and the school's place) under the chart names the column. sutunYerleri(b): for every exam of the topic table, its point
// on the chart (index into b.seri), or null when one has no point there (then the table keeps its own columns).
function sutunYerleri(b){
  const z=b.izgara;if(!z||!b.seri||!b.seri.length)return null;
  const k=s=>typeof denemeAdAnahtari==='function'?denemeAdAnahtari(s):String(s),yer=new Map(b.seri.map((p,i)=>[k(p.ad),i]));
  const l=z.sinavlar.map(e=>yer.has(k(e.ad))?yer.get(k(e.ad)):-1);return l.every(i=>i>=0)?l:null;
}
// The chart's geometry at width W: left edge L (the topic names' column when the squares sit under it), right margin, inset ic
// of the first and last point, the points' x and the step between them.
function geometri(b,W){
  const n=b.seri.length,dar=W<520,hizali=!!sutunYerleri(b),L=hizali&&!dar?214:dar?30:38,Rk=dar?12:20,R=W-Rk;
  const ic=n>1?(hizali?(dar?14:24):Math.min(dar?14:30,(R-L)/(n-1)*.3)):0;
  const x=i=>r1(n===1?(L+R)/2:L+ic+(R-L-2*ic)*i/(n-1)),adim=n>1?(R-L-2*ic)/(n-1):R-L;
  return {n,dar,hizali,L,Rk,R,ic,x,adim,kw:Math.max(18,Math.min(76,adim*.86))};
}
function netGrafigi(b,W){
  const l=b.seri;if(!l.length)return '';
  // The first and last points sit in from the axes, so the end labels cover no tick label.
  const G=geometri(b,W),{n,dar,L,R,x,adim}=G;
  // A value is written on every point when the labels fit, otherwise on every k-th counted back from the newest exam.
  const her=Math.max(1,Math.ceil((dar?32:36)/Math.max(1,adim))),yazili=i=>(n-1-i)%her===0;
  // The students' line is a fixed blue (--ogr-cizgi), not the subject's colour nor the theme's accent (which can be green): only
  // the shading is red or green.
  const renkli='var(--ogr-cizgi)',UST=16,ALT=UST+(dar?130:150);
  // Every value as a percentage of its test on a fixed 0–100% axis (the same picture for a 5- and a 40-question test); without
  // the counts, nets on their own scale.
  const O=olcekKur(l),y=v=>r1(ALT-(v-O.lo)/(O.hi-O.lo||1)*(ALT-UST));
  let s='';
  for(const [v,et] of O.tikler(dar?3:4))s+='<line class="ogr-izgara" x1="'+L+'" x2="'+R+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="ogr-tik" x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+et+'</text>';
  // The shading: between consecutive exams that both have a Türkiye average.
  const alan=(xa,na,ga,xb,nb,gb,ust)=>s+='<path class="ogr-alan '+(ust?'ogr-alan-ust':'ogr-alan-alt')+'" d="M'+xa+','+y(na)+' L'+xb+','+y(nb)+' L'+xb+','+y(gb)+' L'+xa+','+y(ga)+' Z"/>';
  for(let i=0;i+1<n;i++){
    const a=l[i],c=l[i+1];if(a.genel===null||c.genel===null)continue;
    const an=O.v(a),ag=O.g(a),cn=O.v(c),cg=O.g(c),d0=an-ag,d1=cn-cg,x0=x(i),x1=x(i+1);
    if(d0*d1<0){const t=d0/(d0-d1),xm=r1(x0+(x1-x0)*t),vm=an+(cn-an)*t;alan(x0,an,ag,xm,vm,vm,d0>0);alan(xm,vm,vm,x1,cn,cg,d1>0)}
    else if(d0||d1)alan(x0,an,ag,x1,cn,cg,d0+d1>0);
  }
  const yol=(pts,c,st)=>pts.length>1?'<path class="'+c+'"'+(st?' style="'+st+'"':'')+' d="M'+pts.map(([a,b2])=>a+','+b2).join(' L')+'"/>':'';
  s+=yol(l.map((p,i)=>p.genel===null?null:[x(i),y(O.g(p))]).filter(Boolean),'ogr-tr');
  s+=yol(l.map((p,i)=>[x(i),y(O.v(p))]),'ogr-okul','stroke:'+renkli);
  l.forEach((p,i)=>{
    const ust=p.genel===null||O.v(p)>=O.g(p);   // the students' value on the outer side of their point
    if(p.genel!==null)s+='<circle class="ogr-tr-nokta" cx="'+x(i)+'" cy="'+y(O.g(p))+'" r="3"><title>'+kacis(p.ad+' · Türkiye '+f2(p.genel)+' net')+'</title></circle>';
    s+='<circle class="ogr-okul-nokta" cx="'+x(i)+'" cy="'+y(O.v(p))+'" r="4.5" style="fill:'+renkli+'"><title>'+kacis(p.ad+' · '+yz(b).bizK+' '+f2(p.net)+' net'+(p.soru?' / '+fi(p.soru)+' soru':'')+' ('+fi(p.n)+' öğrenci)'+(p.genel!==null?' · Türkiye '+f2(p.genel)+' net':''))+'</title></circle>';
    if(yazili(i))s+='<text class="ogr-deger ogr-deger-okul" x="'+x(i)+'" y="'+(ust?y(O.v(p))-9:y(O.v(p))+17)+'" text-anchor="middle">'+kacis(O.etiket(p))+'</text>';
  });
  // The exam names: every exam when they fit side by side, otherwise spaced ones counted back from the newest.
  const y0=ALT,tumu=n===1||G.hizali||adim>=(dar?70:78),etiketAdimi=tumu?1:Math.max(her,Math.ceil((dar?110:130)/Math.max(1,adim)));
  // Under the topic squares every exam is named (its column has to be told apart), in at most three lines.
  const en=n===1?Math.min(R-L,220):G.hizali?Math.max(36,adim-8):tumu?adim-12:Math.min(dar?104:132,adim*etiketAdimi-12);
  let etiketSatiri=1;
  l.forEach((p,i)=>{
    if((n-1-i)%etiketAdimi)return;
    const satirlar=sinavAdSatirlari(p.ad,en,G.hizali?3:0),xx=x(i),genis=Math.max(...satirlar.map(yaziEn)),hiza=xx-genis/2<2?'start':xx+genis/2>W-2?'end':'middle';
    etiketSatiri=Math.max(etiketSatiri,satirlar.length);
    s+='<text class="ogr-tik ogr-sinav-adi" x="'+xx+'" y="'+(y0+18)+'" text-anchor="'+hiza+'" aria-label="'+kacis(p.ad)+'">'+
      satirlar.map((satir,j)=>'<tspan x="'+xx+'" dy="'+(j?13:0)+'">'+kacis(satir)+'</tspan>').join('')+'</text>';
  });
  // Under each name the school's place in the İlk 100 list, an arrow against the exam before (▲ green up, ▼ red down).
  const yl=yerler(b);
  if(yl)l.forEach((p,i)=>{if((n-1-i)%etiketAdimi||!yl[i])return;const o=yl[i],xx=x(i);
    s+='<text class="ogr-tik ogr-sira'+(o.k===1?' ogr-y':o.k===-1?' ogr-k':'')+'" x="'+xx+'" y="'+(y0+18+etiketSatiri*13+2)+'" text-anchor="'+(xx<40?'start':xx>W-40?'end':'middle')+'">'+(o.k===1?'▲ ':o.k===-1?'▼ ':'')+kacis(o.yazi)+'</text>'});
  const H=y0+26+(etiketSatiri-1)*13+(yl?16:0);
  return '<svg class="ogr-net" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+kacis(b.dersAd+': ortalama net ve Türkiye ortalaması, deneme deneme')+'">'+s+'</svg>';
}
// Whom and what a block covers, in one line: the classes taken together, the number of exams and the days they span.
function kapsamYazisi(b){
  const l=b.seri&&b.seri.length?b.seri:(b.izgara?b.izgara.sinavlar:[]),sn=b.siniflar||[];
  return [sn.join(', '),l.length?fi(l.length)+' deneme':''].filter(Boolean).join(' · ');
}
// The headline: the students' mean and the Türkiye average in the newest exam that has a Türkiye average (an exam whose list
// has not come yet is skipped, never filled in), side by side, with a coloured word for where the students stand.
// The school's place in the subject's İlk 100 list, exam by exam (sira; undefined when no school is followed on the Türkiye geneli
// page; null outside the list, counted as one past its end). Teachers' pages only: a student's sheet has no school place.
const yerDegeri=p=>p.sira===null?(p.listeN||100)+1:p.sira;
const yerYazisi=p=>p.sira===null?'100+':fi(p.sira)+'.';
const yerVar=b=>!yz(b).ogrenci&&b.seri.some(p=>p.sira!==undefined);
// Each exam's place and its move since the exam before that has one: 1 up (green), −1 down (red), 0 the same.
function yerler(b){
  if(!yerVar(b))return null;let once=null;
  return b.seri.map(p=>{if(p.sira===undefined)return null;const k=once===null?null:yerDegeri(p)<yerDegeri(once)?1:yerDegeri(p)>yerDegeri(once)?-1:0;once=p;return {yazi:yerYazisi(p),k}});
}
// The newest move, for the words beside where the students stand (outside the list both times: nothing).
function siraDurumu(b){
  if(!yerVar(b))return null;const l=b.seri.filter(p=>p.sira!==undefined);if(l.length<2)return null;
  const a=l[l.length-2],c=l[l.length-1];if(a.sira===null&&c.sira===null)return null;
  const d=yerDegeri(a)-yerDegeri(c);return d>0?{k:1,yazi:'Sıralama yükseldi'}:d<0?{k:-1,yazi:'Sıralama düştü'}:{k:0,yazi:'Sıralama aynı'};
}
// Where the students stand in the newest exam with a Türkiye average, and how the gap moved since the exam before:
// behind and the gap closing is good (green), ahead and the gap closing is not (red); a move under 1 point (0,05 net) is none.
function durumu(b){
  const fl=b.seri.filter(p=>p.fark!==null),son=fl[fl.length-1]||null,once=fl[fl.length-2]||null;if(!son)return null;
  const yz_=p=>p.soru?yuzdesi(p.fark,p.soru):p.fark,esik=son.soru?1:.05,yon=son.fark>=.05?1:son.fark<=-.05?-1:0;
  let egilim=null;
  if(once&&yon){const d=yz_(son)-yz_(once),kapan=yon<0?d>0:d<0;
    egilim=Math.abs(d)<esik?{k:0,yazi:'Fark değişmedi'}:{k:(kapan?(yon<0?1:-1):(yon<0?-1:1)),yazi:kapan?'Fark daralıyor':'Fark açılıyor'}}
  return {son,yon,egilim};
}
function skorHtml(b){
  const d=durumu(b),sr=siraDurumu(b),y=yz(b);if(!d&&!sr)return '';
  const rozet=(o,ek='')=>o?'<b class="ogr-durum ogr-egilim'+ek+' '+(o.k>0?'ogr-y':o.k<0?'ogr-k':'ogr-sabit')+'">'+o.yazi+'</b>':'';
  const siraR=rozet(sr,' ogr-sira-durum');
  if(!d){const son=b.seri[b.seri.length-1];return '<div class="ogr-skor"><div class="ogr-skor-sayi"><span>'+(y.ogrenci?'Senin netin':y.biz)+'</span><strong>'+f1(son.net)+'</strong></div><div class="ogr-skor-durum"><div class="ogr-rozetler">'+siraR+'</div><span>'+kacis(son.ad)+'</span></div></div>'}
  const {son}=d,yon=d.yon>0?'ogr-y':d.yon<0?'ogr-k':'ogr-sabit';
  const durum=d.yon>0?'▲ Türkiye’nin üstünde':d.yon<0?'▼ Türkiye’nin altında':'■ Türkiye ile aynı';
  return '<div class="ogr-skor"><div class="ogr-skor-sayi"><span>'+(y.ogrenci?'Senin netin':y.biz)+'</span><strong class="'+yon+'">'+f1(son.net)+'</strong></div>'+
    '<div class="ogr-skor-sayi"><span>Türkiye</span><strong>'+f1(son.genel)+'</strong></div>'+
    '<div class="ogr-skor-durum"><div class="ogr-rozetler"><b class="ogr-durum '+yon+'">'+durum+'</b>'+rozet(d.egilim)+siraR+'</div><span>'+kacis(son.ad)+'</span></div></div>';
}
// The topic table: a row per topic in the şube's plan order (planaGore; without a plan the kazanım codes, kodSirasi), a coloured square per exam (green ahead of Türkiye, red
// behind, amber about level, on one solid spectrum (spektrum); empty: no question). No number on the page: the figures are in
// each square's tooltip and the folded appendix. The kazanımlar under each topic are hidden until "Kazanımlar" is ticked.
// The last row is the whole subject. ust: printed beside the heading, so a loose sheet says whose it is.
function izgaraHtml(b,ust=''){
  if(sutunYerleri(b))return hizaliIzgaraHtml(b,ust);
  const z=b.izgara,y=yz(b),bas='<h4 class="ogr-alt-baslik">Konular'+(ust?'<span class="ogr-baski ogr-sayfa-adi">'+kacis(ust)+'</span>':'')+'</h4>';
  if(!z)return '<div class="ogr-konular ogr-ekran">'+bas+'<p class="mini ogr-yok">Bu ders için konu verisi henüz yok.</p></div>';
  const yuzde=c=>y.bizK+' %'+fi(Math.round(100*c.d/c.n))+', Türkiye %'+fi(Math.round(100*c.b/c.n));
  const kare=(ad,c,e,cls)=>!c?'<td class="'+cls+' ogr-iz-bos" title="'+kacis(e.ad+': soru yok')+'"></td>':
    '<td class="'+cls+(c.durum==='belirsiz'?' ogr-iz-soluk':'')+'" title="'+kacis(ad+' · '+e.ad+': '+yuzde(c))+'"><i style="'+hucreRengi(c)+'"></i></td>';
  const basliklar=z.sinavlar.map(e=>'<th scope="col" class="ogr-iz-sinav" title="'+kacis(e.ad+' · '+fi(e.ogr)+' öğrenci')+'"><span>'+kacis(e.ad)+'</span></th>').join('');
  const altSatir=a=>'<tr class="ogr-iz-alt"><th scope="row" class="ogr-iz-konu"><span class="ogr-kod">'+kacis(a.kod)+'</span>'+(a.ad&&a.ad!==a.kod?kacis(a.ad):'')+'</th>'+a.hucre.map((c,i)=>kare(a.kod,c,z.sinavlar[i],'ogr-iz-kh')).join('')+'</tr>';
  const toplam=e=>'<td class="ogr-iz-h'+(e.durum==='belirsiz'?' ogr-iz-soluk':'')+'" title="'+kacis(e.ad+' · bütün konular')+'"><i style="'+hucreRengi(e)+'"></i></td>';
  const altVar=z.satir.some(r=>r.alt&&r.alt.length);
  // Exams with nets above but no topic data: named in one quiet line, so a missing column is not read as "no question".
  const adK=s=>typeof denemeAdAnahtari==='function'?denemeAdAnahtari(s):String(s),konulu=new Set(z.sinavlar.map(e=>adK(e.ad)));
  const eksik=[...new Set((b.seri||[]).filter(e=>!konulu.has(adK(e.ad))).map(e=>e.ad))];
  return '<div class="ogr-konular'+(altVar?' ogr-iz-kazanimli':'')+'"><div class="ogr-konu-bas">'+bas+
    (altVar?'<label class="ogr-iz-ac ogr-ekran"><input type="checkbox"> Kazanımlar</label>':'')+'</div>'+
    '<div class="ogr-iz-kutu"><table class="ogr-iz'+(z.sinavlar.length>12?' ogr-iz-cok':'')+'" style="--ogr-en:'+(220+z.sinavlar.length*40)+'px;--ogr-ust:'+(260+z.sinavlar.length*96)+'px"><thead><tr><th scope="col" class="ogr-iz-konu"></th>'+basliklar+'</tr></thead>'+
    z.satir.map(r=>'<tbody class="ogr-iz-grup"><tr><th scope="row" class="ogr-iz-konu">'+kacis(r.ad)+'</th>'+r.hucre.map((c,i)=>kare(r.ad,c,z.sinavlar[i],'ogr-iz-h')).join('')+'</tr>'+(r.alt||[]).map(altSatir).join('')+'</tbody>').join('')+
    '<tfoot><tr class="ogr-iz-toplam"><th scope="row" class="ogr-iz-konu">Bütün konular</th>'+z.sinavlar.map(toplam).join('')+'</tr></tfoot></table></div>'+
    '<div class="ogr-olcek">'+spektrumAnahtari()+
    '<span class="ogr-olcek-bos"><i></i>soru yok</span></div>'+
    (eksik.length?'<p class="mini ogr-iz-eksik ogr-ekran">Konu verisi henüz yok: '+kacis(eksik.join(', '))+'</p>':'')+'</div>';
}
// The topic table under the chart: a row a topic, its squares at the chart's points (t: the point's place from 0 to 1 along the
// axis), no column heads (the chart's exam names are right above).
function hizaliIzgaraHtml(b,ust=''){
  const z=b.izgara,y=yz(b),yer=sutunYerleri(b),n=b.seri.length,t=i=>n===1?.5:yer[i]/(n-1);
  const bas='<h4 class="ogr-alt-baslik">Konular'+(ust?'<span class="ogr-baski ogr-sayfa-adi">'+kacis(ust)+'</span>':'')+'</h4>';
  const yuzde=c=>y.bizK+' %'+fi(Math.round(100*c.d/c.n))+', Türkiye %'+fi(Math.round(100*c.b/c.n));
  const kare=(ad,c,e,i)=>!c?'<i class="ogr-hz-kare ogr-hz-bos" style="--t:'+t(i)+'" title="'+kacis(e.ad+': soru yok')+'"></i>':
    '<i class="ogr-hz-kare'+(c.durum==='belirsiz'?' ogr-iz-soluk':'')+'" style="--t:'+t(i)+';'+hucreRengi(c)+'" title="'+kacis(ad+' · '+e.ad+': '+yuzde(c))+'"></i>';
  const satir=r=>'<div class="ogr-hz-satir"><span class="ogr-hz-ad">'+kacis(r.ad)+'</span>'+r.hucre.map((c,i)=>kare(r.ad,c,z.sinavlar[i],i)).join('')+'</div>'+
    (r.alt||[]).map(a=>'<div class="ogr-hz-satir ogr-iz-alt"><span class="ogr-hz-ad"><span class="ogr-kod">'+kacis(a.kod)+'</span>'+(a.ad&&a.ad!==a.kod?kacis(a.ad):'')+'</span>'+a.hucre.map((c,i)=>kare(a.kod,c,z.sinavlar[i],i)).join('')+'</div>').join('');
  const toplam='<div class="ogr-hz-satir ogr-hz-toplam"><span class="ogr-hz-ad">Bütün konular</span>'+z.sinavlar.map((e,i)=>kare('Bütün konular',e,e,i)).join('')+'</div>';
  const altVar=z.satir.some(r=>r.alt&&r.alt.length);
  return '<div class="ogr-konular ogr-hz-kutu'+(altVar?' ogr-iz-kazanimli':'')+'"><div class="ogr-konu-bas">'+bas+(altVar?'<label class="ogr-iz-ac ogr-ekran"><input type="checkbox"> Kazanımlar</label>':'')+'</div>'+
    '<div class="ogr-hz">'+z.satir.map(satir).join('')+toplam+'</div>'+
    '<div class="ogr-olcek">'+spektrumAnahtari()+'<span class="ogr-olcek-bos"><i></i>soru yok</span></div></div>';
}
// The raw topic table can run to thousands of rows over all teachers, so it is built when its box is opened (hamKonu).
function hamKonu(b){
  const z=b&&b.izgara;if(!z)return '';
  return '<div class="et-tablo-kutu"><table class="et-tablo ogr-ham"><thead><tr><th scope="col">Konu</th><th scope="col">Deneme</th><th scope="col" class="sayi">Yanıt (n)</th><th scope="col" class="sayi">Doğru (d)</th><th scope="col" class="sayi">Türkiye’ye göre beklenen (b)</th><th scope="col" class="sayi">Fark (puan)</th><th scope="col" class="sayi">z</th></tr></thead><tbody>'+
    z.satir.flatMap(r=>r.hucre.map((c,i)=>c?'<tr><td>'+kacis(r.ad)+'</td><td>'+kacis(z.sinavlar[i].ad)+'</td><td class="sayi">'+fi(c.n)+'</td><td class="sayi">'+fi(c.d)+'</td><td class="sayi">'+f2(c.b)+'</td><td class="sayi">'+isaret(c.fark,f1)+'</td><td class="sayi">'+(c.z===null?'—':isaret(c.z,f2))+'</td></tr>':'')).join('')+'</tbody></table></div>';
}
// The appendix for whoever wants to check a figure: the rules with their formulas, and every raw number. Folded; printed only
// when it is open.
function hamVeri(b,i){
  const seri=b.seri.length?'<div class="et-tablo-kutu"><table class="et-tablo ogr-ham"><thead><tr><th scope="col">Deneme</th><th scope="col" class="sayi">Öğrenci</th><th scope="col" class="sayi">Ortalama net</th><th scope="col" class="sayi">Türkiye ort. (yayınevinin bütün kurumları)</th><th scope="col" class="sayi">Fark</th><th scope="col" class="sayi">İlk 100 listesinde okulun yeri</th></tr></thead><tbody>'+
    b.seri.map(p=>'<tr><td>'+kacis(p.ad)+'</td><td class="sayi">'+fi(p.n)+'</td><td class="sayi">'+f2(p.net)+'</td><td class="sayi">'+(p.genel===null?'—':f2(p.genel))+'</td><td class="sayi">'+(p.fark===null?'—':isaret(p.fark,f2))+'</td>'+'</tr>').join('')+'</tbody></table></div>':'';
  const konu=b.izgara?'<div class="ogr-ham-konu" data-ogr-ham-konu="'+i+'"></div>':'';
  if(yz(b).ogrenci)return '<details class="ogr-formul" data-ogr-ham="'+i+'"><summary>Hesaplama ayrıntıları ve ham veriler</summary>'+
    '<p><b>Net grafiği:</b> her denemede bu dersteki netin ve yayınevinin bütün kurumlarındaki öğrencilerin ortalama neti (o denemenin performans analizinden). İki çizgi arası yeşilse Türkiye’nin üstündesin, kırmızıysa altında.</p>'+
    '<p><b>Konu tablosu:</b> her hücre, o denemede o konunun sorularında senin doğru sayını (d), aynı soruları çözen Türkiye geneli öğrencilerinin başarı oranlarından beklenen doğru sayısıyla (b) karşılaştırır. Fark = 100 · (d − b) / n puan; n o konudaki soru sayısıdır. Zor sorular konuyu haksız yere kırmızıya boyamaz: aynı soruda Türkiye de zorlanmışsa beklenen de düşüktür.</p>'+
    '<p><b>Renk:</b> koyu kırmızıdan turuncu ve sarıya, oradan koyu yeşile uzanan tek bir renk yelpazesi: kırmızı = Türkiye’nin gerisinde, sarı = Türkiye ile aşağı yukarı aynı, yeşil = önünde; fark büyüdükçe renk uca yaklaşır. Fark küçük ya da soru azsa (tesadüf olabilir: z = (d − b) / √(n·p·(1 − p) · (1 + (soru − 1) · 0,2)), |z| < 1,96) renk ortaya, sarıya daha yakın çizilir. Tek öğrencide bir konunun birkaç sorusu olduğu için çoğu kare ortaya yakın çıkar: yönü okumak için koyu karelere ve tekrar eden renge bakın.</p>'+seri+konu+'</details>';
  return '<details class="ogr-formul" data-ogr-ham="'+i+'"><summary>Hesaplama ayrıntıları ve ham veriler</summary>'+
    '<p><b>Kimler?</b> '+kacis(b.siniflar.join(', '))+' sınıflarının öğrencileri birlikte (ders programında bu dersi verdiğiniz sınıflar). Sınıflar ayrı ayrı gösterilmez, öğrenci adı yoktur.</p>'+
    '<p><b>Net grafiği:</b> her denemede öğrencilerinizin bu dersteki net ortalaması (neti basılmış öğrenciler) ve yayınevinin bütün kurumlarındaki öğrencilerin ortalama neti (o denemenin performans analizinden: her soruda doğru oranı − yanlış oranı / 4; konu karelerinin karşılaştırıldığı öğrencilerin aynısı). İki çizgi arası yeşilse Türkiye’nin üstünde, kırmızıysa altındadır. Fark = ortalama net − Türkiye ortalaması. Grafiğin yüksekliği testin tamamıdır (0’dan soru sayısına). Deneme adının altındaki sayı okulun bu dersteki İlk 100 listesindeki yeridir.</p>'+
    '<p><b>Konu tablosu:</b> her hücre, o denemede o konunun sorularında öğrencilerinizin doğru sayısını (d), aynı soruları çözen Türkiye geneli öğrencilerinin başarı oranlarından beklenen doğru sayısıyla (b = soruların Türkiye başarı oranlarının toplamı) karşılaştırır. Fark = 100 · (d − b) / n puan; n öğrencilerinizin o sorulara verdiği yanıt sayısıdır. Böylece zor sorular konuyu haksız yere kırmızıya boyamaz: aynı soruda Türkiye de zorlanmışsa beklenen de düşüktür. Konular derste işlendikleri düzende (kazanım numarasına göre) dizilir. Bütün konular: dersin o denemedeki bütün sorularıyla aynı hesap.</p>'+
    '<p><b>Renk:</b> koyu kırmızıdan turuncu ve sarıya, oradan koyu yeşile uzanan tek bir renk yelpazesi: kırmızı = Türkiye’nin gerisinde, sarı = Türkiye ile aşağı yukarı aynı, yeşil = önünde; fark büyüdükçe renk uca yaklaşır (±'+RENK_UST+' puanda en uçta). Fark bu hesaba göre henüz belirgin değilse renk ortaya, sarıya daha yakın çizilir (z = (d − b) / √(Σ n·p·(1 − p) · (1 + (soru − 1) · 0,2)), |z| < 1,96; bir öğrencinin aynı konudaki yanıtları birbirine bağlı sayılır). Boş kare: o denemede konudan soru yok. Bir karenin üzerine gelince yüzdeler görünür.</p>'+seri+konu+'</details>';
}
// One block: what it covers, the two headline numbers, the chart with its key, the topics, the folded appendix.
// hoca: the teacher's name, printed beside the topic heading (the topics usually fall on a sheet of their own) and, on a block
// that is not the teacher's first (ilk), beside the block's title: each block starts a page on paper.
function blokHtml(b,i,hoca='',ilk=true){
  const y=yz(b),baslik=b.dersAd+(y.ogrenci?'':' · '+fi(b.duzey)+'. sınıf'),kapsam=kapsamYazisi(b);
  return '<section class="et-panel ogr-blok"><header class="ogr-blok-bas"><h3><i class="et-renk nokta" style="background:'+renk(b.kod)+'"></i> '+kacis(baslik)+'</h3>'+
    (hoca&&!ilk?'<span class="ogr-baski ogr-sayfa-adi">'+kacis(hoca)+'</span>':'')+(kapsam?'<p class="ogr-kapsam">'+kacis(kapsam)+'</p>':'')+'</header>'+
    (b.seri.length?'<div class="ogr-genel">'+skorHtml(b)+
      '<figure class="ogr-sekil"><div class="et-lejant ogr-lejant"><span><i class="et-renk cizgi ogr-l-okul"></i>'+(y.ogrenci?'Senin netin':y.biz)+'</span><span><i class="et-renk cizgi ogr-l-tr"></i>Türkiye ortalaması</span></div><div class="ogr-grafik" data-ogr-grafik="'+i+'"></div></figure></div>':'')+
    izgaraHtml(b,hoca?baslik+' · '+hoca:'')+hamVeri(b,i)+'</section>';
}
// What a reader needs before the first figure: whom the report covers, where the numbers come from, how to read a sign and a colour.
const REHBER=[['Kimleri kapsıyor?','Ders programında dersine girdiğiniz sınıfların öğrencilerini, tek bir grup olarak. Öğrenciler ve sınıflar ayrı ayrı gösterilmez; öğretmenler birbiriyle karşılaştırılmaz.'],
  ['Veriler nereden geliyor?','Netler, okulda uygulanan denemelerin sonuç listelerinden; Türkiye ortalaması, yayınevinin aynı denemeler için açıkladığı Türkiye geneli sonuçlarından alınır. Hiçbir değer tahmin edilmez.'],
  ['Nasıl okunur?','Yeşil, Türkiye ortalamasının üzerinde; kırmızı, altında demektir. Renk koyulaştıkça aradaki açık büyür; soluk renk, açığın küçük olduğunu gösterir.']];
const REHBER_OGRENCI=[['Kimi kapsıyor?','Yalnızca seni: okulda girdiğin denemelerdeki netlerini ve cevaplarını. Başka öğrencinin adı ya da sıralama yoktur.'],REHBER[1],REHBER[2]];
const rehberHtml=(l=REHBER)=>'<div class="ogr-rehber-ic">'+l.map(([ad,metin])=>'<p><b>'+ad+'</b> '+metin+'</p>').join('')+'</div>';
// The grades as buttons side by side, one always chosen (the teacher's and the student's report alike).
const duzeyDugmeleri=(alan,duzeyler,secili)=>duzeyler.length?'<div class="ogr-duzeyler" role="group" aria-label="Sınıf düzeyi" id="'+alan+'">'+duzeyler.map(d=>'<button type="button" class="ogr-duzey" data-duzey-alan="'+alan+'" data-duzey="'+d+'" aria-pressed="'+(d===secili)+'">'+d+'. sınıf</button>').join('')+'</div>':'';
let SON_DUZEY=null;
let SON=null;
function gorunum(){
  if(typeof rehberMi!=='function'||!rehberMi())return '<div class="baslik"><h1>Öğretmen raporu</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  const l=ogretmenler();
  if(!l.length){SON=null;return '<div id="ogrKok"><header class="et-bas"><h1 class="et-baslik">Öğretmen raporu</h1></header><section class="et-panel et-bos"><b>Ders programı yok</b><p>Öğretmenler, Etüt planı’na eklenen sınıf ders programlarından gelir. Etüt planı’nda sınıfların haftalık ders programlarını ekleyin.</p><button type="button" class="et-dugme" data-sekme="etutplani">Etüt planı →</button></section></div>'}
  // Sınıf düzeyi: always one grade at a time (2026-11-19: no "Bütün düzeyler"), the highest first; the teachers are those who
  // teach that grade.
  const duzeyler=[...new Set(l.flatMap(o=>o.dersler.flatMap(d=>d.siniflar.map(duzeyi))))].filter(x=>x!==null).sort((a,b)=>b-a);
  const duzey=duzeyler.includes(EK.ogrDuzey)?EK.ogrDuzey:duzeyler.length?duzeyler[0]:null;SON_DUZEY=duzey;const uygun=duzey===null?l:l.filter(o=>o.dersler.some(d=>d.siniflar.some(c=>duzeyi(c)===duzey)));
  const secili=uygun.find(o=>o.key===EK.ogrHoca)?EK.ogrHoca:'',goster=secili?uygun.filter(o=>o.key===secili):uygun;
  const c=sayfaBaglami(),modeller=goster.map(o=>ogretmenModeli(o,c,duzey));SON=modeller;
  let sayac=0;
  // A subject taught in one session only (TYT Matematik, AYT Edebiyat …) says which.
  const dersYazisi=d=>{const ot=[...new Set(d.kodlar.filter(k=>((d.kodSinif||{})[k[2]]||d.siniflar).some(x=>d.siniflar.includes(x))).map(k=>k[0]))];
    return kacis(d.ad)+(ot.length===1?' ('+ot[0]+')':'')+' · '+kacis(d.siniflar.join(', '))};
  // On paper every teacher's sheets stand alone: the report's name and the day it was printed come with each; the picture's own keys
  // (the chart's legend, the squares' key) are the only reading notes on paper.
  const bugun=typeof bugunNo==='function'?gunYaz(bugunNo()):'',ustYazi='Öğretmen raporu'+(duzey!==null?' · '+duzey+'. sınıf':'')+(bugun?' · '+bugun:'');
  const bolum=o=>{const ad=kisiAd(o.ad);return '<section class="ogr-ogretmen" data-ogr-hoca="'+kacis(o.key)+'"><header class="ogr-ogretmen-bas"><div class="ogr-kimlik"><p class="ogr-baski ogr-ust-yazi">'+kacis(ustYazi)+'</p><h2>'+kacis(ad)+'</h2><p class="mini">'+
    o.dersler.map(dersYazisi).join(' — ')+'</p></div></header>'+
    (o.bloklar.length?o.bloklar.map((b,j)=>blokHtml(b,sayac++,ad,!j)).join(''):'<p class="mini ogr-yok">Bu öğretmenin derslerinde henüz deneme ya da konu verisi yok.</p>')+'</section>'};
  const duzeySec=duzeyDugmeleri('ogrDuzey',duzeyler,duzey);
  const secim='<label class="et-seg"><span class="et-seg-label">Öğretmen</span><select id="ogrHoca"><option value="">Bütün öğretmenler ('+fi(uygun.length)+')</option>'+uygun.map(o=>'<option value="'+kacis(o.key)+'"'+(o.key===secili?' selected':'')+'>'+kacis(kisiAd(o.ad))+'</option>').join('')+'</select></label>';
  planla();
  return '<div id="ogrKok"><header class="et-bas"><h1 class="et-baslik">Öğretmen raporu'+(duzey!==null?' · '+duzey+'. sınıf':'')+'</h1><p class="et-cumle">Öğrencilerinizin netleri ve konu başarıları, aynı denemelerde Türkiye ortalamasıyla karşılaştırılır.</p></header>'+
    '<div class="et-arac">'+duzeySec+secim+'<button type="button" class="et-dugme" id="ogrYazdir">PDF indir</button><span class="mini ogr-pdf-durum" id="ogrPdfDurum" role="status"></span></div>'+
    '<details class="ogr-rehber ogr-rehber-ekran"><summary>Bu rapor nasıl okunur?</summary>'+rehberHtml()+'</details>'+
    (modeller.length?modeller.map(bolum).join(''):'<p class="mini ogr-yok">Bu sınıf düzeyinde ders veren öğretmen yok.</p>')+'</div>';
}
// Öğrenci raporu (Türkiye): the same blocks for one student: every exam subject the student has nets or topic answers in, TYT
// before AYT. The student is found by the school number in the lists and in Konu Takibi.
const TUM_KODLAR=(()=>{const m=new Map();for(const [,,l] of DERSLER)for(const k of l)if(!m.has(k[2]))m.set(k[2],k);return [...m.values()].sort((a,b)=>(a[0]==='TYT'?0:1)-(b[0]==='TYT'?0:1))})();
function ogrenciModeli(kisi,c){
  const nolar=new Set([String(kisi.no)]),sinif=sinifK(kisi.sinif),bloklar=[];
  for(const [oturum,anahtar,kod] of TUM_KODLAR){
    const seri=agBagla(ozetSorulari(netSerisi(c.k,[],oturum,anahtar,kod,null,nolar),c.v,kod),c.v,kod),izgara=konuIzgarasi(c.v,[],oturum,kod,c,null,nolar);
    if(!seri.length&&!izgara)continue;
    bloklar.push({ders:dersEtiketi(kod),duzey:duzeyi(sinif),siniflar:sinif?[sinif]:[],oturum,kod,dersAd:dersEtiketi(kod),seri,izgara,y:YAZI.ogrenci});
  }
  return {key:String(kisi.no),ad:kisi.ad,sinif,no:kisi.no,bloklar};
}
function gorunumOgrenci(){
  const bas='<header class="et-bas"><h1 class="et-baslik">Türkiye ortalaması karşılaştırması</h1><p class="et-cumle">Öğrencinin netleri ve konu başarıları, aynı denemelerde Türkiye ortalamasıyla karşılaştırılır.</p></header>';
  if(typeof rehberMi!=='function'||!rehberMi())return '<div class="baslik"><h1>Öğrenci raporu</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  const c=sayfaBaglami(),kisiler=c.k&&c.k.t?[...c.k.t.kisi.values()].filter(x=>sinifK(x.sinif)):[];
  if(!kisiler.length){SON=null;return '<div id="ogrKok">'+bas+'<section class="et-panel et-bos"><b>Deneme listesi yok</b><p>Öğrenciler, Denemeler’e eklenen okul sonuç listelerinden gelir.</p><button type="button" class="et-dugme" data-sekme="denemeler">Denemeler →</button></section></div>'}
  // Sınıf düzeyi → şube → öğrenci (or every student of the şube, each on their own sheets).
  const duzeyler=[...new Set(kisiler.map(x=>duzeyi(sinifK(x.sinif))))].filter(x=>x!==null).sort((a,b)=>b-a),duzey=duzeyler.includes(EK.osDuzey)?EK.osDuzey:duzeyler[0];
  const subeler=siraliSinif([...new Set(kisiler.filter(x=>duzeyi(sinifK(x.sinif))===duzey).map(x=>sinifK(x.sinif)))]),sube=subeler.includes(EK.osSube)?EK.osSube:subeler[0];
  const subede=kisiler.filter(x=>sinifK(x.sinif)===sube).sort((a,b)=>String(a.ad).localeCompare(String(b.ad),'tr'));
  const secili=subede.some(x=>String(x.no)===EK.osOgr)?EK.osOgr:'',goster=secili?subede.filter(x=>String(x.no)===secili):subede;
  const modeller=goster.map(x=>ogrenciModeli(x,c));SON=modeller;
  const bugun=typeof bugunNo==='function'?gunYaz(bugunNo()):'';let sayac=0;
  const bolum=o=>{const ad=kisiAd(o.ad);return '<section class="ogr-ogretmen" data-ogr-ogrenci="'+kacis(o.key)+'"><header class="ogr-ogretmen-bas"><div class="ogr-kimlik"><p class="ogr-baski ogr-ust-yazi">'+kacis('Türkiye ortalaması karşılaştırması'+(bugun?' · '+bugun:''))+'</p><h2>'+kacis(ad)+'</h2><p class="mini">'+
    kacis(o.sinif+' · okul no '+o.no)+'</p></div></header>'+
    (o.bloklar.length?o.bloklar.map((b,j)=>blokHtml(b,sayac++,ad,!j)).join(''):'<p class="mini ogr-yok">Bu öğrencinin henüz deneme ya da konu verisi yok.</p>')+'</section>'};
  const sec=(id,ad,l,v)=>'<label class="et-seg"><span class="et-seg-label">'+ad+'</span><select id="'+id+'">'+l.map(([d,y])=>'<option value="'+kacis(String(d))+'"'+(String(d)===String(v)?' selected':'')+'>'+kacis(y)+'</option>').join('')+'</select></label>';
  planla();
  return '<div id="ogrKok">'+bas+'<div class="et-arac">'+duzeyDugmeleri('osDuzey',duzeyler,duzey)+sec('osSube','Şube',subeler.map(s=>[s,s]),sube)+
    sec('osOgr','Öğrenci',[['','Bütün öğrenciler ('+fi(subede.length)+')']].concat(subede.map(x=>[String(x.no),kisiAd(x.ad)])),secili)+'<button type="button" class="et-dugme" id="ogrYazdir">PDF indir</button><span class="mini ogr-pdf-durum" id="ogrPdfDurum" role="status"></span></div>'+
    '<details class="ogr-rehber ogr-rehber-ekran"><summary>Bu rapor nasıl okunur?</summary>'+rehberHtml(REHBER_OGRENCI)+'</details>'+modeller.map(bolum).join('')+'</div>';
}
/* ---- Türkiye karşılaştırması on the student's own device ----
   The student's notebook has no school lists and no Konu Takibi, so the teacher's app works out the student's comparison and
   sends it in the student's package (ogrenciPaketi → turkiyeKiyas), compactly: per block the exams [ad, g, net, Türkiye] and
   per topic and kazanım the cells [d, b, n] (0: no question). The student's page builds the same blocks from it. A budget keeps
   the package small: the kazanımlar are left out first, then the topic tables. */
const KIYAS_SURUM=1,KIYAS_UST=250000;
let KIYAS_BAGLAM=null;
const r3=x=>Math.round(x*1000)/1000;
function kiyasOzeti(o){
  if(!o||o.no===undefined||o.no===null||o.no==='')return null;
  // One context for a run of packages (a publish builds every student's in a row).
  const simdi=Date.now();
  if(!KIYAS_BAGLAM||KIYAS_BAGLAM.D!==(typeof D!=='undefined'?D:null)||simdi-KIYAS_BAGLAM.t>5000)KIYAS_BAGLAM={D:typeof D!=='undefined'?D:null,t:simdi,c:sayfaBaglami()};
  const c=KIYAS_BAGLAM.c,kisi=c.k&&c.k.t?c.k.t.kisi.get(String(o.no)):null;if(!kisi)return null;
  const m=ogrenciModeli(kisi,c);if(!m.bloklar.length)return null;
  const hc=h=>h?[h.d,r3(h.b),h.n]:0;
  const blok=(b,altVar,izVar)=>({k:b.kod,o:b.oturum,s:b.seri.map(p=>[p.ad,p.g,r3(p.net),p.genel===null?null:r3(p.genel),p.soru||null]),
    z:izVar&&b.izgara?{e:b.izgara.sinavlar.map(e=>[e.ad,e.g]),r:b.izgara.satir.map(r=>[r.ad,r.hucre.map(hc),altVar?(r.alt||[]).map(a=>[a.kod,a.ad,a.hucre.map(hc)]):[]])}:null});
  for(const [altVar,izVar] of [[true,true],[false,true],[false,false]]){
    const oz={v:KIYAS_SURUM,t:typeof bugunNo==='function'?bugunNo():null,sinif:m.sinif,b:m.bloklar.map(b=>blok(b,altVar,izVar))};
    if(JSON.stringify(oz).length<=KIYAS_UST)return oz;
  }
  return null;
}
// Back from the snapshot to the blocks the page draws (the same measures: olc on the same d, b, n; one student's variance).
function kiyasAc(oz){
  if(!oz||oz.v!==KIYAS_SURUM||!Array.isArray(oz.b))return [];
  const hucre=x=>{if(!Array.isArray(x))return null;const [d,b,n]=x;if(!(n>0))return null;const p=Math.min(1,Math.max(0,b/n));return {d,b,n,v:n*p*(1-p)*(1+(n-1)*R_MADDE),ogr:1}};
  return oz.b.filter(x=>x&&typeof x.k==='string').map(x=>{
    const seri=(x.s||[]).map(([ad,g,net,genel,soru])=>({ad,g,n:1,soru:soru||SORU_STANDART[anahtarOf(x.k)]||null,net,genel:Number.isFinite(genel)?genel:null,fark:Number.isFinite(genel)?net-genel:null,sinir:null,birinci:null,listeN:null,sira:undefined}));
    let izgara=null;
    if(x.z&&Array.isArray(x.z.e)&&x.z.e.length){
      const konular=new Map(),toplam=x.z.e.map(()=>({d:0,b:0,n:0,v:0,ogr:0}));
      // The rows come in the teacher's order (the order taught), which the student's page keeps.
      for(const [ad,hl,al] of x.z.r||[]){const K={id:ad,ad,sira:[konular.size],hucre:(hl||[]).map(hucre)};K.hucre.forEach((h,i)=>{if(h&&toplam[i]){const t=toplam[i];t.d+=h.d;t.b+=h.b;t.n+=h.n;t.v+=h.v;t.ogr=1}});
        if(Array.isArray(al)&&al.length){K.alt=new Map();for(const [kod,kad,ah] of al)K.alt.set(kod,{kod,ad:kad,hucre:(ah||[]).map(hucre)})}konular.set(ad,K)}
      izgara=izgaraKur(x.z.e.map(([ad,g],i)=>({ad,g,ogr:1,...olc(toplam[i])})),konular);
    }
    return {ders:dersEtiketi(x.k),duzey:duzeyi(oz.sinif),siniflar:oz.sinif?[oz.sinif]:[],oturum:x.o,kod:x.k,dersAd:dersEtiketi(x.k),seri,izgara,y:YAZI.ogrenci};
  }).filter(b=>b.seri.length||b.izgara);
}
function gorunumKendi(){
  const bas='<header class="et-bas"><h1 class="et-baslik">Türkiye ortalaması karşılaştırması</h1><p class="et-cumle">Netlerin ve konu başarıların, aynı denemelerde Türkiye ortalamasıyla karşılaştırılır.</p></header>';
  const o=typeof D!=='undefined'&&D.ogr?D.ogr[0]:null,bloklar=kiyasAc(typeof D!=='undefined'?D.turkiyeKiyas:null);
  if(!o||!bloklar.length){SON=null;return '<div id="ogrKok">'+bas+'<section class="et-panel et-bos"><b>Henüz karşılaştırma yok</b><p>Öğretmenin okulun deneme sonuçlarını ve yayınevinin Türkiye geneli sonuçlarını ekleyip planını yayınladığında burada görünür.</p></section></div>'}
  const m={key:'0',ad:o.ad||'',sinif:D.turkiyeKiyas.sinif||o.sube||'',bloklar};SON=[m];
  const ad=kisiAd(m.ad),tarih=Number.isInteger(D.turkiyeKiyas.t)?gunYaz(D.turkiyeKiyas.t):'';let sayac=0;
  planla();
  return '<div id="ogrKok">'+bas+'<div class="et-arac"><button type="button" class="et-dugme" id="ogrYazdir">PDF indir</button><span class="mini ogr-pdf-durum" id="ogrPdfDurum" role="status"></span>'+(tarih?'<span class="mini">Öğretmeninin son yayınından · '+kacis(tarih)+'</span>':'')+'</div>'+
    '<details class="ogr-rehber ogr-rehber-ekran"><summary>Bu sayfa nasıl okunur?</summary>'+rehberHtml(REHBER_OGRENCI)+'</details>'+
    '<section class="ogr-ogretmen"><header class="ogr-ogretmen-bas"><div class="ogr-kimlik"><p class="ogr-baski ogr-ust-yazi">'+kacis('Türkiye ortalaması karşılaştırması'+(tarih?' · '+tarih:''))+'</p><h2>'+kacis(ad)+'</h2><p class="mini">'+kacis(m.sinif)+'</p></div>'+
    '</header>'+bloklar.map((b,j)=>blokHtml(b,sayac++,ad,!j)).join('')+'</section></div>';
}
let ZAMAN=null;
/* ---- PDF: one A4 landscape page per teacher (or student), drawn like the Öğrenci raporu: white soft-cornered cards on a warm
   page, one picture per page, saved straight to a PDF file, so no browser header, address, title or page number is printed.
   A page fits whatever the number of blocks: the blocks with a topic table are the large cards side by side, the blocks with
   nets only are the small cards along the bottom; row heights and the chart shrink to fit. ---- */
const PC={ink:'#213d40',muted:'#657878',line:'#2c6aa8',green:'#168d7d',red:'#bf6951',gray:'#d9dfdc',bg:'#f6f5f0',grid:'#e5ebe7',tr:'#8a9b99'},PW=1190.55,PH=841.89;
const PDF_W=841.89,PDF_H=595.28,PDF_OLCEK=3;
// Where the students stand, as on the screen: [pill fill, text colour, arrow, words].
const PDF_DURUM={1:['#dcf1ea','#0b6a5d','▲','Türkiye’nin üstünde'],'-1':['#f6e0d9','#9a3f2c','▼','Türkiye’nin altında'],0:['#e9ecea','#586e70','■','Türkiye ile aynı']};
// A colour on white: a = 0 white, 1 the colour. The squares use the screen's rule (hucreRengi) drawn on paper.
function kareRengi(c){return spektrum(kareYeri(c))}
function ressam(out){
  let olc=null;try{olc=typeof document!=='undefined'?document.createElement('canvas').getContext?.('2d')||null:null}catch(e){olc=null}
  const en=(t,s,b=false)=>{if(olc){olc.font=(b?'bold ':'')+s+'px Arial';return olc.measureText(String(t)).width}return [...String(t)].length*s*(b?.62:.56)};
  const sigdir=(t,max,s,b=false)=>{t=String(t);if(en(t,s,b)<=max)return t;const c=[...t];let lo=0,hi=c.length;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(en(c.slice(0,m).join('')+'…',s,b)<=max)lo=m;else hi=m-1}return c.slice(0,lo).join('').trimEnd()+'…'};
  // Up to `adet` lines at word boundaries; the last line is cut with an ellipsis when the words run on.
  // A word too long for the line breaks after a dash or an underscore (27-YKS-1201, 27_AYT_ÖZEL_1).
  // A word longer than a line breaks after its - or _; its pieces join again without a space (bas: a line starts mid-word).
  const satirla=(t,max,s,b=false,adet=2)=>{const l=[''],bas=[false];for(const [k,bit] of String(t).split(/\s+/).flatMap(w=>en(w,s,b)>max?w.split(/(?<=[-_])/).map((p,j)=>[p,j>0]):[[w,false]])){const son=l.length-1,yeni=l[son]?l[son]+(bit?'':' ')+k:k;if(en(yeni,s,b)<=max||!l[son])l[son]=yeni;else{l.push(k);bas.push(bit)}}
    const kalan=l.slice(adet-1).reduce((a,x,i)=>a+(i&&!bas[adet-1+i]?' ':'')+x,'');
    return l.length<=adet?l.map(x=>sigdir(x,max,s,b)):[...l.slice(0,adet-1).map(x=>sigdir(x,max,s,b)),sigdir(kalan,max,s,b)]};
  const yazi=(x,y,t,s=12,renk=PC.ink,b=false,hiza='start')=>out.push('<text x="'+r1(x)+'" y="'+r1(y)+'" font-size="'+s+'" fill="'+renk+'" font-weight="'+(b?700:400)+'" text-anchor="'+hiza+'">'+kacis(t)+'</text>');
  const kutu=(x,y,w,h,dolgu='#fff',r=14,ek='')=>out.push('<rect x="'+r1(x)+'" y="'+r1(y)+'" width="'+r1(Math.max(0,w))+'" height="'+r1(Math.max(0,h))+'" rx="'+r1(Math.max(0,Math.min(r,h/2,w/2)))+'" fill="'+dolgu+'"'+ek+'/>');
  const cizgi=(x1,y1,x2,y2,renk=PC.grid,w=1,kesik='')=>out.push('<path d="M'+r1(x1)+','+r1(y1)+' L'+r1(x2)+','+r1(y2)+'" stroke="'+renk+'" stroke-width="'+w+'" fill="none"'+(kesik?' stroke-dasharray="'+kesik+'"':'')+'/>');
  return {en,sigdir,satirla,yazi,kutu,cizgi,out};
}
const kartBasligi=b=>b.dersAd+(yz(b).ogrenci?'':' · '+fi(b.duzey)+'. sınıf');
// The two numbers and where the students stand. buyuk: the large card (the words in the pill and the exam's name); else the
// small card (the arrow alone). Returns the y under it.
function pdfSkor(P,b,x,y,buyuk){
  const d=durumu(b),sonNet=b.seri[b.seri.length-1],ad=yz(b).ogrenci?'Senin netin':yz(b).biz;if(!sonNet)return y;
  const son=d?d.son:sonNet,ls=buyuk?10.5:8.5,ns=buyuk?30:19,ara=buyuk?26:12,ny=y+ls+3+ns*.82,netAlti=false;
  const deger=v=>f1(v),genis=(lab,v)=>Math.max(P.en(lab,ls,true),P.en(deger(v),ns,true),netAlti?P.en(f1(v)+' net',9):0);
  P.yazi(x,y+ls,ad,ls,PC.muted,true);P.yazi(x,ny,deger(son.net),ns,d&&d.yon>0?PC.green:d&&d.yon<0?PC.red:PC.ink,true);if(netAlti)P.yazi(x,ny+13,f1(son.net)+' net',9,PC.muted);
  const alt=ny+(netAlti?18:6);
  if(!d){P.yazi(x+genis(ad,son.net)+ara,ny,'Türkiye ortalaması yok',ls,PC.muted);return alt}
  const x2=x+genis(ad,son.net)+ara;
  P.yazi(x2,y+ls,'Türkiye',ls,PC.muted,true);P.yazi(x2,ny,deger(son.genel),ns,PC.ink,true);if(netAlti)P.yazi(x2,ny+13,f1(son.genel)+' net',9,PC.muted);
  let x3=x2+genis('Türkiye',son.genel)+ara;const [bg,fg,okc,soz]=PDF_DURUM[d.yon],eg=d.egilim?PDF_DURUM[d.egilim.k]:null;
  if(buyuk){const ps=11,ph=22,py=y+ls-4,hap=(metin,r)=>{const pw=P.en(metin,ps,true)+22;P.kutu(x3,py,pw,ph,r[0],ph/2);P.yazi(x3+pw/2,py+ph/2+ps*.36,metin,ps,r[1],true,'middle');x3+=pw+8};
    const x0=x3,sr=siraDurumu(b);hap(okc+' '+soz,[bg,fg]);if(eg)hap(d.egilim.yazi,eg);if(sr)hap(sr.yazi,PDF_DURUM[sr.k]);P.yazi(x0,py+ph+14,son.ad,9.5,PC.muted)}
  else{const ph=18,py=ny-ph+2;P.kutu(x3,py,ph+6,ph,bg,ph/2);P.yazi(x3+(ph+6)/2,py+ph/2+3.6,okc,10,fg,true,'middle');x3+=ph+12;
    if(eg){const t=d.egilim.k===0?'aynı':d.egilim.yazi.replace('Fark ',''),pw=P.en(t,8,true)+12;P.kutu(x3,py+2,pw,ph-4,eg[0],(ph-4)/2);P.yazi(x3+pw/2,py+ph/2+3,t,8,eg[1],true,'middle')}}
  return alt;
}
// The net chart: the students' line, the Türkiye line dashed, the room between shaded green above and red below (split where
// they cross), the students' values on their points, the exam names under it (spaced when they do not fit).
function pdfGrafik(P,b,x,y,w,h,as=9,solW=28){
  const l=b.seri,n=l.length;if(!n||h<40)return null;
  const yl=yerler(b),isimH=as*2.5+(yl?as+4:0),py0=y+10,py1=y+h-isimH-6;
  const O=olcekKur(l),yy=v=>py1-(v-O.lo)/(O.hi-O.lo||1)*(py1-py0);
  const sol=x+solW,sag=x+w-12,hz=solW>28,ic=n>1?(hz?20:Math.min(20,(sag-sol)/(n-1)*.25)):0,xx=i=>n===1?(sol+sag)/2:sol+ic+(sag-sol-2*ic)*i/(n-1),adim=n>1?(sag-sol-2*ic)/(n-1):sag-sol;
  for(const [v,et] of O.tikler(h>150?4:3)){P.cizgi(sol,yy(v),sag,yy(v),PC.grid,.8);P.yazi(sol-6,yy(v)+3,et,8.5,PC.muted,false,'end')}
  const alan=(xa,na,ga,xb,nb,gb,ust)=>P.out.push('<path d="M'+r1(xa)+','+r1(yy(na))+' L'+r1(xb)+','+r1(yy(nb))+' L'+r1(xb)+','+r1(yy(gb))+' L'+r1(xa)+','+r1(yy(ga))+' Z" fill="'+(ust?PC.green:PC.red)+'" fill-opacity=".24"/>');
  for(let i=0;i+1<n;i++){const a=l[i],c=l[i+1];if(a.genel===null||c.genel===null)continue;const an=O.v(a),ag=O.g(a),cn=O.v(c),cg=O.g(c),d0=an-ag,d1=cn-cg,x0=xx(i),x1=xx(i+1);
    if(d0*d1<0){const t=d0/(d0-d1),xm=x0+(x1-x0)*t,vm=an+(cn-an)*t;alan(x0,an,ag,xm,vm,vm,d0>0);alan(xm,vm,vm,x1,cn,cg,d1>0)}else if(d0||d1)alan(x0,an,ag,x1,cn,cg,d0+d1>0)}
  const yol=(pts,renk,w_,kesik)=>{if(pts.length>1)P.out.push('<path d="M'+pts.map(([a,c])=>r1(a)+','+r1(c)).join(' L')+'" fill="none" stroke="'+renk+'" stroke-width="'+w_+'" stroke-linejoin="round"'+(kesik?' stroke-dasharray="'+kesik+'"':'')+'/>')};
  yol(l.map((p,i)=>p.genel===null?null:[xx(i),yy(O.g(p))]).filter(Boolean),PC.tr,1.4,'4 3');
  yol(l.map((p,i)=>[xx(i),yy(O.v(p))]),PC.line,2.4);
  const her=Math.max(1,Math.ceil(28/Math.max(1,adim)));
  l.forEach((p,i)=>{if(p.genel!==null)P.out.push('<circle cx="'+r1(xx(i))+'" cy="'+r1(yy(O.g(p)))+'" r="2.2" fill="#fff" stroke="'+PC.tr+'" stroke-width="1.2"/>');
    P.out.push('<circle cx="'+r1(xx(i))+'" cy="'+r1(yy(O.v(p)))+'" r="3.4" fill="'+PC.line+'" stroke="#fff" stroke-width="1.4"/>');
    if((n-1-i)%her===0){const ust=p.genel===null||O.v(p)>=O.g(p);P.yazi(xx(i),ust?yy(O.v(p))-7:yy(O.v(p))+14,O.etiket(p),9.5,PC.ink,true,'middle')}});
  const tum=hz||adim>=as*6.5,esAdim=tum?1:Math.max(her,Math.ceil(as*11/Math.max(1,adim))),pay=n>1?adim*esAdim:w;
  l.forEach((p,i)=>{if((n-1-i)%esAdim)return;
    // Each name keeps to its own share of the axis: half a step either side, the page edge for the first and the last.
    const sinirL=n===1?x+2:Math.max(x+2,xx(i)-pay/2+3),sinirR=n===1?x+w-2:Math.min(x+w-2,xx(i)+pay/2-3),sat=P.satirla(p.ad,Math.max(20,sinirR-sinirL),as),gw=Math.max(...sat.map(t=>P.en(t,as)));
    const hz=xx(i)-gw/2<sinirL?'start':xx(i)+gw/2>sinirR?'end':'middle',tx=hz==='start'?sinirL:hz==='end'?sinirR:xx(i);
    sat.forEach((t,j)=>P.yazi(tx,py1+as+6+j*(as+2),t,as,PC.muted,false,hz));
    if(yl&&yl[i]){const o=yl[i];P.yazi(tx,py1+as+6+2*(as+2)+2,(o.k===1?'▲ ':o.k===-1?'▼ ':'')+o.yazi,as,o.k===1?PC.green:o.k===-1?PC.red:PC.muted,true,hz)}});
  return {xx,adim};
}
// The topic table: the exam names on top, a row per topic in the order taught with a coloured square per exam (an empty dashed
// square: no question), the whole subject last under a hairline. Rows shrink to fit the height they are given.
function pdfIzgara(P,z,x,y,w,h,kazanim=false){
  const satirlar=z.satir.flatMap(r=>[{r},...(kazanim?(r.alt||[]).map(a=>({a})):[])]);
  const ns=z.sinavlar.length,n=satirlar.length+1,hb=26,rh=Math.max(8,Math.min(24,(h-hb-8)/n)),fs=Math.max(7.5,Math.min(10.5,rh*.66)),ks=Math.max(7,fs-1.5);
  const adW=Math.min(Math.max(110,w*.42),kazanim?300:250),kx=x+adW+6,kw=(x+w-kx)/ns,kareW=Math.min(kw-4,76),kr=Math.min(5,rh/3);
  z.sinavlar.forEach((e,j)=>{const sat=P.satirla(e.ad,kw-4,8,true);sat.forEach((t,k)=>P.yazi(kx+kw*j+kw/2,y+hb-6-(sat.length-1-k)*10,t,8,PC.muted,true,'middle'))});
  const kare=(c,j,ry,kucuk)=>{const kw2=kucuk?kareW*.6:kareW,bx=kx+kw*j+(kw-kw2)/2,by=ry+(kucuk?3:1.5),bh=rh-(kucuk?6:3);if(c)P.kutu(bx,by,kw2,bh,kareRengi(c),kr);else P.kutu(bx,by,kw2,bh,'#fff',kr,' stroke="'+PC.gray+'" stroke-width=".8" stroke-dasharray="3 2"')};
  satirlar.forEach((o,i)=>{const ry=y+hb+i*rh;
    if(o.r){P.yazi(x,ry+rh/2+fs*.36,P.sigdir(o.r.ad,adW-4,fs,true),fs,PC.ink,true);o.r.hucre.forEach((c,j)=>kare(c,j,ry,false))}
    else{const kod=o.a.kod,kodW=P.en(kod,ks,true);P.yazi(x+10,ry+rh/2+ks*.36,kod,ks,PC.ink,true);
      if(o.a.ad&&o.a.ad!==kod)P.yazi(x+16+kodW,ry+rh/2+ks*.36,P.sigdir(o.a.ad,adW-26-kodW,ks),ks,PC.muted);o.a.hucre.forEach((c,j)=>kare(c,j,ry,true))}});
  const ty=y+hb+(n-1)*rh+6;P.cizgi(x,ty-3,x+adW,ty-3,PC.gray,.8);
  P.yazi(x,ty+rh/2+fs*.36,'Bütün konular',fs,PC.ink,true);z.sinavlar.forEach((e,j)=>kare(e,j,ty,false));
}
// A large card's height for its content within hMax: the head (title, numbers), then the chart and the topic table side by side
// (a wide card) or one above the other; rows of about 22–24 px, a chart of 110–260 px; never taller than hMax.
// The topic table under the PDF chart: the squares at the chart's points (G.xx), the names
// in the chart's left column (adW wide), no column heads.
function pdfIzgaraHizali(P,b,x,y,w,h,kazanim,G,adW){
  const z=b.izgara,yer=sutunYerleri(b),satirlar=z.satir.flatMap(r=>[{r},...(kazanim?(r.alt||[]).map(a=>({a})):[])]);
  const n=satirlar.length+1,rh=Math.max(8,Math.min(24,(h-14)/n)),fs=Math.max(7.5,Math.min(10.5,rh*.66)),ks=Math.max(7,fs-1.5),kareW=Math.max(14,Math.min(80,G.adim*.86)),kr=Math.min(5,rh/3);
  const kare=(c,j,ry,kucuk)=>{const kw2=kucuk?kareW*.6:kareW,bx=G.xx(yer[j])-kw2/2,by=ry+(kucuk?3:1.5),bh=rh-(kucuk?6:3);if(c)P.kutu(bx,by,kw2,bh,kareRengi(c),kr);else P.kutu(bx,by,kw2,bh,'#fff',kr,' stroke="'+PC.gray+'" stroke-width=".8" stroke-dasharray="3 2"')};
  satirlar.forEach((o,i)=>{const ry=y+2+i*rh;
    if(o.r){P.yazi(x,ry+rh/2+fs*.36,P.sigdir(o.r.ad,adW-4,fs,true),fs,PC.ink,true);o.r.hucre.forEach((c,j)=>kare(c,j,ry,false))}
    else{const kod=o.a.kod,kodW=P.en(kod,ks,true);P.yazi(x+10,ry+rh/2+ks*.36,kod,ks,PC.ink,true);
      if(o.a.ad&&o.a.ad!==kod)P.yazi(x+16+kodW,ry+rh/2+ks*.36,P.sigdir(o.a.ad,adW-26-kodW,ks),ks,PC.muted);o.a.hucre.forEach((c,j)=>kare(c,j,ry,true))}});
  const ty=y+2+(n-1)*rh+6;P.cizgi(x,ty-3,x+adW,ty-3,PC.gray,.8);
  P.yazi(x,ty+rh/2+fs*.36,'Bütün konular',fs,PC.ink,true);z.sinavlar.forEach((e,j)=>kare(e,j,ty,false));
}
const IZGH=(n,rh)=>16+n*rh;
const IZG=(n,rh)=>34+n*rh;
const satirSayisi=(b,kazanim)=>b.izgara.satir.length+1+(kazanim?b.izgara.satir.reduce((t,r)=>t+((r.alt||[]).length),0):0);
// A large card's height for its content within hMax: the head (title, numbers), then the chart and the topic table side by side
// (a wide card) or one above the other; rows of about 22–24 px, a chart of 110–260 px; never taller than hMax.
function buyukYukseklik(b,w,hMax,kazanim=false){
  const n=satirSayisi(b,kazanim),bas=b.seri.length?116:44,yer=hMax-bas-14;
  const ic=!b.seri.length?IZG(n,24):sutunYerleri(b)?Math.min(200,Math.max(170,yer*.36))+8+IZGH(n,20):w>=700?Math.max(230,IZG(n,24)):Math.min(200,Math.max(110,yer*.36))+6+IZG(n,22);
  return bas+14+Math.min(yer,ic);
}
// The least height a card needs with readable rows (11 px): whether the kazanımlar fit on the teacher's page.
function buyukEnAz(b,w,kazanim){const n=satirSayisi(b,kazanim),bas=b.seri.length?116:44;return bas+14+(!b.seri.length?IZG(n,11):sutunYerleri(b)?84+6+IZGH(n,11):w>=700?Math.max(180,IZG(n,11)):84+6+IZG(n,11))}
function buyukKart(P,b,x,y,w,h,kazanim=false){
  P.kutu(x,y,w,h);
  P.yazi(x+18,y+28,P.sigdir(kartBasligi(b),w*.6,15,true),15,PC.ink,true);
  P.yazi(x+w-18,y+28,P.sigdir(kapsamYazisi(b),w*.36,10),10,PC.muted,false,'end');
  const ust=b.seri.length?pdfSkor(P,b,x+18,y+40,true)+16:y+44,ch=y+h-14-ust,z=b.izgara,n=satirSayisi(b,kazanim);
  if(!b.seri.length){pdfIzgara(P,z,x+18,ust,w-36,ch,kazanim);return}
  // The squares under the chart: the chart above, its left column the topic names' column.
  // The chart keeps a full height (170–200 px, like the chart over a table), the rows share the rest.
  if(sutunYerleri(b)){const solW=Math.min(260,Math.max(150,w*.36)),gh=ch-8-IZGH(n,11)<170?Math.max(84,ch-8-IZGH(n,11)):Math.min(w>=700?220:200,Math.max(170,ch-6-IZGH(n,18)));
    const G=pdfGrafik(P,b,x+8,ust,w-26,gh,9,solW);if(G){pdfIzgaraHizali(P,b,x+18,ust+gh+8,w-36,ch-gh-8,kazanim,G,solW-18);return}}
  if(w>=700){const gw=Math.min(w*.52,300+z.sinavlar.length*92);pdfGrafik(P,b,x+8,ust,w-gw-50,Math.min(ch,260));pdfIzgara(P,z,x+w-18-gw,ust,gw,ch,kazanim);return}
  let gh=Math.min(200,ch-6-IZG(n,22));if(gh<110)gh=Math.max(84,Math.min(200,ch-6-IZG(n,12)));
  pdfGrafik(P,b,x+8,ust,w-26,gh);pdfIzgara(P,z,x+18,ust+gh+6,w-36,ch-gh-6,kazanim);
}
function kucukKart(P,b,x,y,w,h){
  P.kutu(x,y,w,h);const buyuk=h>=230&&w>=340;
  P.yazi(x+14,y+22,P.sigdir(kartBasligi(b),w-28,buyuk?14:12,true),buyuk?14:12,PC.ink,true);
  // A wide, low card: the numbers on the left, the chart beside them the card's whole height.
  if(!buyuk&&w>=420){pdfSkor(P,b,x+14,y+32,false);const sol=x+Math.min(300,w*.34);pdfGrafik(P,b,sol,y+8,x+w-8-sol,h-14,8);return}
  const alt=pdfSkor(P,b,x+14,y+32,buyuk)+(buyuk?18:6);
  pdfGrafik(P,b,x+4,alt,w-14,y+h-8-alt,buyuk?9:8);
}
// One key for the page, at its foot: the two lines, then the colours from red to green, and the empty square.
function lejant(P,x,y,ad,kareli){
  const s=9.5;let cx=x;const ek=(t,g=18)=>{P.yazi(cx,y,t,s,PC.muted);cx+=P.en(t,s)+g};
  P.cizgi(cx,y-3.5,cx+18,y-3.5,PC.line,2.4);cx+=24;ek(ad);
  P.cizgi(cx,y-3.5,cx+18,y-3.5,PC.tr,1.4,'4 3');cx+=24;ek('Türkiye ortalaması',28);
  ek('Türkiye’nin gerisinde',6);
  P.out.push('<defs><linearGradient id="ogrSpektrum">'+SPEKTRUM.map(([u])=>'<stop offset="'+(u+1)*50+'%" stop-color="'+spektrum(u)+'"/>').join('')+'</linearGradient></defs>');P.kutu(cx,y-10,96,12,'url(#ogrSpektrum)',3);cx+=100;
  cx+=4;ek('Türkiye’nin önünde',kareli?24:0);
  if(kareli){P.kutu(cx,y-10,18,12,'#fff',3,' stroke="'+PC.gray+'" stroke-dasharray="3 2"');cx+=24;ek('soru yok',0)}
}
// m: a teacher's model (ad, dersler, bloklar) or a student's (ad, sinif, no, bloklar). ust: the line above the name.
function sayfaCiz(m,ust='',tarih=''){
  const out=[],P=ressam(out),M=28,USTY=104,ALTY=PH-42,genis=PW-2*M,ARA=14,yer=ALTY-USTY;
  const ogrenci=m.bloklar.some(b=>yz(b).ogrenci)||!m.dersler;
  sayfaBasi(P,m,ust,tarih);
  const F=m.bloklar.filter(b=>b.izgara),S=m.bloklar.filter(b=>!b.izgara);let kazanim=false;
  if(F.length){
    const sk=Math.min(S.length,6),sr=S.length?Math.ceil(S.length/6):0,fk=Math.min(F.length,3),fr=Math.ceil(F.length/3),wF=(genis-(fk-1)*ARA)/fk;
    // The small cards give up some height when a topic table needs it (a 24-topic AYT Matematik beside them).
    const sigar=hs=>{const hF=yer-sr*(hs+ARA),hFk=(hF-(fr-1)*ARA)/fr;return F.every(b=>buyukYukseklik(b,wF,1e4)<=hFk)};
    const hs=!sr||sigar(sr>1?128:150)?(sr>1?128:150):(sr>1?112:118),hF=yer-sr*(hs+ARA),hFk=(hF-(fr-1)*ARA)/fr;
    // The kazanımlar go under their topics when every card still has readable rows; else on the page after (kazanimSayfalari).
    kazanim=F.some(b=>b.izgara.satir.some(r=>r.alt&&r.alt.length))&&F.every(b=>buyukEnAz(b,wF,true)<=hFk);
    let y=USTY;
    for(let r=0;r<fr;r++){const satir=F.slice(r*fk,r*fk+fk),h=Math.max(...satir.map(b=>buyukYukseklik(b,wF,hFk,kazanim)));
      satir.forEach((b,i)=>buyukKart(P,b,M+i*(wF+ARA),y,wF,h,kazanim));y+=h+ARA}
    const ws=sk?(genis-(sk-1)*ARA)/sk:0;S.forEach((b,i)=>kucukKart(P,b,M+(i%sk)*(ws+ARA),y+Math.floor(i/sk)*(hs+ARA),ws,hs));
  }else if(S.length){
    const k=S.length<=3?S.length:Math.min(4,Math.ceil(S.length/2)),r=Math.ceil(S.length/k),w=(genis-(k-1)*ARA)/k,h=Math.min(k===1?300:330,(yer-(r-1)*ARA)/r);
    S.forEach((b,i)=>kucukKart(P,b,M+(i%k)*(w+ARA),USTY+Math.floor(i/k)*(h+ARA),w,h));
  }
  lejant(P,M,PH-18,ogrenci?'Senin netin':'Öğrencileriniz',F.length>0);
  return {svg:svgSar(out,kisiAd(m.ad)),kazanim};
}
const svgSar=(out,ad)=>'<svg xmlns="http://www.w3.org/2000/svg" width="'+PW+'" height="'+PH+'" viewBox="0 0 '+PW+' '+PH+'" font-family="Arial, sans-serif" role="img" aria-label="'+kacis(ad)+'">'+out.join('')+'</svg>';
const sayfaSvg=(m,ust='',tarih='')=>sayfaCiz(m,ust,tarih).svg;
// The page head: the line above the name, the name, the lessons and classes (or class and school number), the day.
function sayfaBasi(P,m,ust,tarih){
  const M=28,genis=PW-2*M,alt=m.dersler?m.dersler.map(d=>d.ad+' · '+d.siniflar.join(', ')).join('   ·   '):[m.sinif,m.no!==undefined&&m.no!==''?'okul no '+m.no:''].filter(Boolean).join(' · ');
  P.out.push('<rect width="'+PW+'" height="'+PH+'" fill="'+PC.bg+'"/>');
  P.yazi(M,38,P.sigdir(String(ust).toLocaleUpperCase('tr-TR'),genis-160,10,true),10,PC.muted,true);
  P.yazi(M,68,P.sigdir(kisiAd(m.ad),genis-160,26,true),26,PC.ink,true);
  P.yazi(M,88,P.sigdir(alt,genis-160,12),12,PC.muted);
  if(tarih)P.yazi(PW-M,38,tarih,12,PC.muted,false,'end');
}
// The kazanımlar of a teacher's topic tables when they did not fit the teacher's page: each lesson's topics with their kazanımlar
// under them, the same squares, in two white columns a page, as many pages as they need.
function kazanimSayfalari(m,ust='',tarih=''){
  const F=m.bloklar.filter(b=>b.izgara&&b.izgara.satir.some(r=>r.alt&&r.alt.length));if(!F.length)return [];
  const M=28,USTY=104,ALTY=PH-42,ARA=14,cw=(PW-2*M-ARA)/2,ic=ALTY-USTY-28,HB=40,HK=17,HZ=15,sayfalar=[];
  const ogeler=[];for(const b of F){ogeler.push({tip:'bas',b});for(const r of b.izgara.satir){ogeler.push({tip:'konu',b,r});for(const a of r.alt||[])ogeler.push({tip:'kaz',b,a})}}
  let out=null,P=null,kol=2,yy=0,sonBas=null;
  const yeniKolon=()=>{if(kol>=1){if(out){lejant(P,M,PH-18,m.dersler?'Öğrencileriniz':'Senin netin',true);sayfalar.push(svgSar(out,kisiAd(m.ad)))}
      out=[];P=ressam(out);sayfaBasi(P,m,ust+' · Kazanımlar',tarih);kol=0}else kol++;
    P.kutu(M+kol*(cw+ARA),USTY,cw,ALTY-USTY);yy=0};
  const x0=()=>M+kol*(cw+ARA)+14,genisK=cw-28;
  const bas=(b,devam)=>{const x=x0(),y=USTY+14+yy,z=b.izgara,ns=z.sinavlar.length,adW=genisK*.55,kx=x+adW+6,kw=(x+genisK-kx)/ns;
    P.yazi(x,y+14,P.sigdir(kartBasligi(b)+(devam?' (devam)':''),adW,12,true),12,PC.ink,true);
    z.sinavlar.forEach((e,j)=>{const sat=P.satirla(e.ad,kw-4,7.5,true);sat.forEach((t,k)=>P.yazi(kx+kw*j+kw/2,y+HB-6-(sat.length-1-k)*9,t,7.5,PC.muted,true,'middle'))});yy+=HB};
  const satir=(o)=>{const x=x0(),y=USTY+14+yy,z=o.b.izgara,ns=z.sinavlar.length,adW=genisK*.55,kx=x+adW+6,kw=(x+genisK-kx)/ns,h=o.tip==='konu'?HK:HZ,kucuk=o.tip==='kaz',kareW=Math.min(kw-4,60)*(kucuk?.6:1);
    const hucre=o.tip==='konu'?o.r.hucre:o.a.hucre;
    if(o.tip==='konu')P.yazi(x,y+h/2+3.4,P.sigdir(o.r.ad,adW-4,9.5,true),9.5,PC.ink,true);
    else{const kodW=P.en(o.a.kod,8,true);P.yazi(x+10,y+h/2+3,o.a.kod,8,PC.ink,true);if(o.a.ad&&o.a.ad!==o.a.kod)P.yazi(x+16+kodW,y+h/2+3,P.sigdir(o.a.ad,adW-26-kodW,8),8,PC.muted)}
    hucre.forEach((c,j)=>{const bx=kx+kw*j+(kw-kareW)/2,by=y+(kucuk?3:2),bh=h-(kucuk?6:4);if(c)P.kutu(bx,by,kareW,bh,kareRengi(c),4);else P.kutu(bx,by,kareW,bh,'#fff',4,' stroke="'+PC.gray+'" stroke-width=".8" stroke-dasharray="3 2"')});
    yy+=h};
  for(const o of ogeler){
    const h=o.tip==='bas'?HB+HK:o.tip==='konu'?HK:HZ;
    if(!out||yy+h>ic){yeniKolon();if(o.tip!=='bas')bas(o.b,true)}
    if(o.tip==='bas'){if(yy>0)yy+=10;bas(o.b,false)}else satir(o);
  }
  if(out){lejant(P,M,PH-18,m.dersler?'Öğrencileriniz':'Senin netin',true);sayfalar.push(svgSar(out,kisiAd(m.ad)))}
  return sayfalar;
}
async function rasterle(svg){
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try{const img=new Image();await new Promise((ok,bad)=>{img.onload=ok;img.onerror=()=>bad(new Error('Rapor görseli oluşturulamadı.'));img.src=url});
    const cv=document.createElement('canvas');cv.width=Math.round(PW*PDF_OLCEK);cv.height=Math.round(PH*PDF_OLCEK);const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);
    return await new Promise((ok,bad)=>cv.toBlob(async b=>{if(!b){bad(new Error('PDF görseli hazırlanamadı.'));return}ok(new Uint8Array(await b.arrayBuffer()))},'image/png'));
  }finally{URL.revokeObjectURL(url)}
}
// The pages of what is shown (the filters apply): a page per teacher or student with data.
const pdfSayfalari=(modeller,ust,tarih)=>modeller.filter(m=>m.bloklar&&m.bloklar.length).flatMap(m=>{const c=sayfaCiz(m,ust,tarih);return [c.svg,...(c.kazanim?[]:kazanimSayfalari(m,ust,tarih))]});
async function pdfYap(sayfalar,baslik){
  if(!sayfalar.length)throw new Error('PDF’e girecek deneme verisi yok.');
  const L=await SIRALAMA.kutuphane(),doc=await L.PDFLib.PDFDocument.create();doc.setTitle(baslik);
  for(const svg of sayfalar){const img=await doc.embedPng(await rasterle(svg)),p=doc.addPage([PDF_W,PDF_H]);p.drawImage(img,{x:0,y:0,width:PDF_W,height:PDF_H})}
  return doc.save();
}
let PDF_MESGUL=false;
async function pdfIndir(dugme){
  if(PDF_MESGUL||!SON)return;PDF_MESGUL=true;const durum=document.getElementById('ogrPdfDurum'),eski=dugme.textContent;dugme.disabled=true;dugme.textContent='PDF hazırlanıyor…';if(durum)durum.textContent='';
  try{
    const ogrenci=!SON[0]||!SON[0].dersler,tarih=typeof bugunNo==='function'?gunYaz(bugunNo()):'';
    const duzey=!ogrenci?SON_DUZEY:null;
    const ust=ogrenci?'Türkiye ortalaması karşılaştırması':'Öğretmen raporu · Türkiye karşılaştırması'+(duzey!==null?' · '+duzey+'. sınıf':'');
    const ad=(ogrenci?'Turkiye_karsilastirmasi':'Ogretmen_raporu')+(SON.length===1?'_'+kisiAd(SON[0].ad):duzey!==null?'_'+duzey+'_sinif':'');
    const bytes=await pdfYap(pdfSayfalari(SON,ust,tarih),ogrenci?'Türkiye ortalaması karşılaştırması':'Öğretmen raporu');
    await indir(ad.replace(/[^\p{L}\p{N} _-]/gu,'_').replace(/\s+/g,'_')+'.pdf',bytes,'pdf');
  }catch(e){if(durum)durum.textContent=e.message}
  finally{PDF_MESGUL=false;dugme.disabled=false;dugme.textContent=eski}
}
function grafikleriCiz(){
  if(!SON||typeof document==='undefined')return;const bl=SON.flatMap(o=>o.bloklar);
  // Every width is read before any chart is drawn: reading one after drawing another would lay the whole page out again each time.
  const kutular=[...document.querySelectorAll('#ogrKok .ogr-grafik[data-ogr-grafik]')].map(k=>[k,Math.round(k.clientWidth)]);
  for(const [k,W] of kutular){const b=bl[+k.dataset.ogrGrafik];if(!b||W<160||k.dataset.w===String(W))continue;k.dataset.w=String(W);k.innerHTML=netGrafigi(b,W);
    // The squares under the chart take its geometry: the same left edge, inset and step.
    const G=geometri(b,W),blok=k.closest('.ogr-blok');if(blok)blok.classList.toggle('ogr-hz-dar',G.hizali&&G.dar);if(G.hizali&&blok)for(const [a,v] of [['--ogr-L',G.L],['--ogr-ic',G.ic],['--ogr-R',G.Rk],['--ogr-kw',r1(G.kw)]])blok.style.setProperty(a,v+'px')}
}
function planla(){if(typeof window==='undefined'||!window.requestAnimationFrame)return;window.cancelAnimationFrame(ZAMAN);ZAMAN=window.requestAnimationFrame(grafikleriCiz)}
if(typeof window!=='undefined'&&window.addEventListener){
  const acik=()=>typeof EK!=='undefined'&&(EK.sekme==='ogretmenrapor'||EK.sekme==='ogrencitr'||EK.sekme==='kiyas');
  window.addEventListener('resize',()=>{if(acik())planla()});
  // Printing lays the page out at the paper's width: the charts are drawn again at their printed width (text stays readable), and
  // again at the screen's afterwards.
  if(window.matchMedia){const mq=window.matchMedia('print'),f=()=>{if(acik())grafikleriCiz()};if(mq.addEventListener)mq.addEventListener('change',f);else if(mq.addListener)mq.addListener(f)}
  window.addEventListener('afterprint',()=>{if(acik())planla()});
}
if(typeof document!=='undefined'&&document.addEventListener){
  document.addEventListener('change',ev=>{if(typeof rehberMi!=='function'||!rehberMi())return;
    if(ev.target.id==='ogrHoca'){EK.ogrHoca=ev.target.value||undefined;ciz()}
    else if(ev.target.id==='osSube'){EK.osSube=ev.target.value;EK.osOgr=undefined;ciz()}
    else if(ev.target.id==='osOgr'){EK.osOgr=ev.target.value||undefined;ciz()}});
  // A grade button: that grade (the student's report starts again from its first şube).
  document.addEventListener('click',ev=>{const d=ev.target.closest?.('[data-duzey-alan]');if(!d||typeof rehberMi!=='function'||!rehberMi())return;const n=Number(d.dataset.duzey);
    if(d.dataset.duzeyAlan==='ogrDuzey'){if(EK.ogrDuzey===n)return;EK.ogrDuzey=n;EK.ogrHoca=undefined}else{if(EK.osDuzey===n)return;EK.osDuzey=n;EK.osSube=undefined;EK.osOgr=undefined}ciz()});
  // PDF indir: the PDF is built here, a page per teacher (or student) shown, and saved as a file (see sayfaSvg).
  document.addEventListener('click',ev=>{const d=ev.target.closest?.('#ogrYazdir');if(d&&document.getElementById('ogrKok'))pdfIndir(d)});
  // toggle does not bubble: listen while it travels down.
  document.addEventListener('toggle',ev=>{const d=ev.target;if(!d||!d.open||!d.matches||!d.matches('#ogrKok details.ogr-formul[data-ogr-ham]'))return;hamDoldur(d)},true);
}
function hamDoldur(d){
  const yer=d.querySelector('.ogr-ham-konu[data-ogr-ham-konu]');if(!yer||yer.dataset.dolu)return;
  const b=SON?SON.flatMap(o=>o.bloklar)[+yer.dataset.ogrHamKonu]:null;if(!b)return;
  yer.innerHTML=hamKonu(b);yer.dataset.dolu='1';
}
return {sayfaSvg,sayfaCiz,kazanimSayfalari,pdfSayfalari,pdfYap,gorunumOgrenci,gorunumKendi,kiyasOzeti,kiyasAc,ogrenciModeli,DERSLER,ogretmenler,netSerisi,konuIzgarasi,olc,ogretmenModeli,hucreRengi,netGrafigi,izgaraHtml,blokHtml,hamKonu,bloklar:()=>SON?SON.flatMap(o=>o.bloklar):[],gorunum,grafikleriCiz,sinifK,R_MADDE,RENK_UST,ART_ARDA};
})();
function gorunumOgretmenRapor(){return OGRETMEN_RAPOR.gorunum()}
