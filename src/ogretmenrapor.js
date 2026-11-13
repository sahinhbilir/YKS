// Embedded in index.html by scripts/embed-ogretmenrapor.cjs. No student data belongs here.
// Öğretmen raporu (rehber öğretmen only): one section per teacher of the weekly timetables (Etüt planı → ders programları).
// A teacher's students are the students of the classes the teacher teaches the subject in, TAKEN TOGETHER: the report never
// shows a class on its own, never ranks classes, never names a student and never compares one teacher with another. Per grade
// and per exam subject (TYT Matematik, AYT Matematik …) it shows:
//  1. the students' mean net in the subject against the Türkiye average (Genel Net) exam by exam, and the gap;
//  2. a topic table: for every topic of the subject (Konu Takibi) and every exam, how the students did against students across
//     Türkiye on the same questions: green where better, red where worse, deeper the larger the gap; pale when the gap is
//     within chance; a label where a topic has been behind (or ahead) on three measured exams in a row;
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
function netSerisi(k,siniflar,oturum,anahtar,kod,gorulen,nolar){
  const out=[];if(!k||!k.t)return out;
  const S=new Set(siniflar),alan=oturum==='TYT'?'tyt':'ayt';
  for(const s of k.t.sinavlar){
    const l=[];for(const o of Object.values(s[alan]||{})){const kisi=k.t.kisi.get(o.no);if(!kisi)continue;const c=sinifK(kisi.sinif);if(nolar?!nolar.has(String(o.no)):!S.has(c))continue;const v=o.net&&o.net[anahtar];if(Number.isFinite(v)){l.push(v);if(gorulen)gorulen.add(c)}}
    if(!l.length)continue;
    const tr=k.trFn?k.trFn(s.ad):null,genel=tr?tr.genel(kod):null,li=tr&&tr.dersListesi&&Number.isFinite(genel)?tr.dersListesi(kod):null;
    out.push({id:s.id,ad:s.ad,g:s.g,n:l.length,net:ort(l),genel:Number.isFinite(genel)?genel:null,fark:Number.isFinite(genel)?ort(l)-genel:null,
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
    for(const st of r.ogrenciler){const sc=sinifK(st.student.cls);if(nolar?!nolar.has(String(st.student.no)):!S.has(sc))continue;let bu=false;
      for(const t of st.konular.values()){if(t.ders!==ck||!t.n||t.id.endsWith('|?'))continue;var_=bu=true;
        let K=konular.get(t.id);if(!K){K={id:t.id,ad:t.ad,hucre:[]};konular.set(t.id,K)}
        const c=K.hucre[i]||(K.hucre[i]={d:0,b:0,n:0,v:0,ogr:0}),p=Math.min(1,Math.max(0,t.b/t.n)),vv=t.n*p*(1-p)*(1+(t.n-1)*R_MADDE);
        c.d+=t.d;c.b+=t.b;c.n+=t.n;c.v+=vv;c.ogr++;toplam.d+=t.d;toplam.b+=t.b;toplam.n+=t.n;toplam.v+=vv}
      // The kazanımlar of each topic, measured the same way (alt): smaller rows under the topic's own.
      if(st.kazanimlar)for(const q of st.kazanimlar.values()){if(q.ders!==ck||!q.n)continue;const K=konular.get(q.konu);if(!K)continue;
        K.alt=K.alt||new Map();let A=K.alt.get(q.kod);if(!A)K.alt.set(q.kod,A={kod:q.kod,ad:q.ad,hucre:[]});
        const h=A.hucre[i]||(A.hucre[i]={d:0,b:0,n:0,v:0,ogr:0}),p=Math.min(1,Math.max(0,q.b/q.n));h.d+=q.d;h.b+=q.b;h.n+=q.n;h.v+=q.n*p*(1-p)*(1+(q.n-1)*R_MADDE);h.ogr++}
      if(bu){toplam.ogr++;if(gorulen)gorulen.add(sc)}}
    if(!var_)continue;
    sinavlar.push({ad:e.ad,g:e.date?Date.parse(e.date+'T00:00:00Z')/864e5:null,ogr:toplam.ogr,...olc(toplam)});
  }
  if(!sinavlar.length)return null;
  const satir=[...konular.values()].map(K=>{
    const hucre=sinavlar.map((_,i)=>K.hucre[i]?{...K.hucre[i],...olc(K.hucre[i])}:null);
    const olcu=hucre.filter(Boolean),sonlar=olcu.slice(-ART_ARDA);
    const seri=sonlar.length===ART_ARDA&&sonlar.every(c=>c.durum==='geride')?'geride':sonlar.length===ART_ARDA&&sonlar.every(c=>c.durum==='onde')?'onde':null;
    const alt=K.alt?[...K.alt.values()].map(A=>{const hc=sinavlar.map((_,i)=>A.hucre[i]?{...A.hucre[i],...olc(A.hucre[i])}:null),ol=hc.filter(Boolean),f=ol.map(c=>c.fark);
      return {kod:A.kod,ad:A.ad,hucre:hc,ortFark:f.length?ort(f):0,degisim:ol.length>=2?ol[ol.length-1].fark-ol[0].fark:null}}).sort((a,b)=>a.kod.localeCompare(b.kod,'tr',{numeric:true})):[];
    const fl=olcu.map(c=>c.fark);return {id:K.id,ad:K.ad,alt,hucre,seri,ortFark:fl.length?ort(fl):0,olcum:olcu.length,degisim:olcu.length>=2?olcu[olcu.length-1].fark-olcu[0].fark:null};
  }).sort((a,b)=>a.ortFark-b.ortFark||a.ad.localeCompare(b.ad,'tr'));
  return {sinavlar,satir};
}
// The page's shared context: the lists (ANALIZ), Konu Takibi and, on first use, every exam's topic comparison. One render reads
// each source once, whatever the number of teachers and blocks.
function baglam(k,v){return {k,v,fark:new Map(),dersSinav:new Map()}}
function dersSinavlari(c,kod){
  let l=c.dersSinav.get(kod);
  if(!l){l=(c.v&&Array.isArray(c.v.exams)?c.v.exams:[]).filter(e=>e.blocks.some(b=>b.course===kod)).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||a.ad.localeCompare(b.ad,'tr',{numeric:true}));c.dersSinav.set(kod,l)}
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
        const gorulen=new Set(),seri=netSerisi(k,siniflar,oturum,anahtar,kod,gorulen),izgara=konuIzgarasi(v,siniflar,oturum,kod,c,gorulen);
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
// The cell colour: red (behind) ↔ green (ahead), deeper with the gap (full at ±20 points); a gap within chance is drawn pale.
function hucreRengi(c){
  if(!c)return '';
  const t=Math.min(1,Math.abs(c.fark)/RENK_UST),a=Math.round((c.durum==='belirsiz'?.12+.18*t:.25+.6*t)*100);
  return 'background:color-mix(in srgb,'+(c.fark<0?'var(--kritik)':'var(--iyi)')+' '+a+'%,transparent)'+(a>=60?';color:#fff':'');
}
// A round step for about `adet` ticks over `aralik` (1, 2, 2,5 or 5 · 10^k).
function adimBul(aralik,adet){const ham=aralik/Math.max(1,adet),u=Math.pow(10,Math.floor(Math.log10(ham||1)));return [1,2,2.5,5,10].map(x=>x*u).find(x=>x>=ham)||10*u}
// An estimate of a label's width at the exam names' size (10,5 px): enough to wrap a name and to keep neighbours apart.
const harfEn=c=>/\d/.test(c)?6.2:/[\s\-.,·:;'’()/]/.test(c)?3.8:/[A-ZÇĞÖŞÜ]/.test(c)&&!/[Iİ]/.test(c)?7.9:/[ıijlIİftr]/.test(c)?4:6.2;
const yaziEn=s=>Array.from(s).reduce((t,c)=>t+harfEn(c),0);
// Wrap a full exam name at word boundaries to `en` px; a word longer than a line is cut so that every character is kept.
function sinavAdSatirlari(ad,en){
  const satir=[''];
  for(const kelime of yaz(ad).split(' ')){
    let parca='';
    const koy=p=>{const son=satir.length-1;if(satir[son]&&yaziEn(satir[son]+' '+p)>en)satir.push(p);else satir[son]+=(satir[son]?' ':'')+p};
    for(const h of Array.from(kelime)){if(parca&&yaziEn(parca+h)>en){koy(parca);parca=h}else parca+=h}
    if(parca)koy(parca);
  }
  return satir;
}
// Two panels on one time axis, every value written on the chart (a printout has no tooltips):
//  1. Ortalama net: the students' mean net (the subject's colour) and the Türkiye average (dashed), each point with its value;
//  2. Türkiye ortalamasına göre fark: the distance between the two lines, a bar per exam from the Türkiye line (0), green above,
//     red below, on the gaps' own scale so that a change of a few tenths is still seen.
// The exam names run under the lower panel.
function netGrafigi(b,W){
  const l=b.seri;if(!l.length)return '';
  // The first and last points sit in from the axes, so the end bars cover no tick label.
  const n=l.length,dar=W<520,L=dar?38:46,R=W-(dar?12:20),ic=n>1?Math.min(dar?14:30,(R-L)/(n-1)*.3):0;
  const x=i=>r1(n===1?(L+R)/2:L+ic+(R-L-2*ic)*i/(n-1)),adim=n>1?(R-L-2*ic)/(n-1):R-L;
  // A value is written on every point when the labels fit, otherwise on every k-th counted back from the newest exam.
  const her=Math.max(1,Math.ceil((dar?36:42)/Math.max(1,adim))),yazili=i=>(n-1-i)%her===0;
  const deger=(xx,yy,metin,cls)=>'<text class="ogr-deger '+cls+'" x="'+xx+'" y="'+r1(yy)+'" text-anchor="middle">'+kacis(metin)+'</text>';
  const renkli=renk(b.kod);
  let s='';
  // 1. Ortalama net.
  const UST=24,ALT=UST+(dar?116:128);
  {
    const vals=l.flatMap(p=>[p.net,...(p.genel!==null?[p.genel]:[])]),lo0=Math.min(...vals),hi0=Math.max(...vals),pad=Math.max(.8,(hi0-lo0)*.28);
    const lo=Math.max(0,lo0-pad),hi=hi0+pad,y=v=>r1(ALT-(v-lo)/(hi-lo||1)*(ALT-UST)),ad=adimBul(hi-lo,dar?3:4);
    s+='<text class="ogr-panel-ad" x="'+L+'" y="12">Ortalama net</text>';
    for(let v=Math.ceil(lo/ad)*ad;v<=hi+1e-9;v+=ad)s+='<line class="ogr-izgara" x1="'+L+'" x2="'+R+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="ogr-tik" x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+fi(Math.round(v*10)/10)+'</text>';
    const yol=(pts,c,st)=>pts.length>1?'<path class="'+c+'"'+(st?' style="'+st+'"':'')+' d="M'+pts.map(([a,b2])=>a+','+b2).join(' L')+'"/>':'';
    s+=yol(l.map((p,i)=>p.genel===null?null:[x(i),y(p.genel)]).filter(Boolean),'ogr-tr');
    s+=yol(l.map((p,i)=>[x(i),y(p.net)]),'ogr-okul','stroke:'+renkli);
    l.forEach((p,i)=>{
      const ust=p.genel===null||p.net>=p.genel;   // the students' value on the outer side of their point, Türkiye's on the other
      if(p.genel!==null)s+='<circle class="ogr-tr-nokta" cx="'+x(i)+'" cy="'+y(p.genel)+'" r="3"/>';
      s+='<circle class="ogr-okul-nokta" cx="'+x(i)+'" cy="'+y(p.net)+'" r="4.5" style="fill:'+renkli+'"><title>'+kacis(p.ad+' · '+yz(b).bizK+' '+f2(p.net)+' net ('+fi(p.n)+' öğrenci)'+(p.genel!==null?' · Türkiye '+f2(p.genel)+' net':''))+'</title></circle>';
      if(!yazili(i))return;
      s+=deger(x(i),ust?y(p.net)-8:y(p.net)+16,f1(p.net),'ogr-deger-okul');
      if(p.genel!==null)s+=deger(x(i),ust?y(p.genel)+15:y(p.genel)-7,f1(p.genel),'ogr-deger-tr');
    });
  }
  // 2. Türkiye ortalamasına göre fark.
  let y0=ALT;
  const fl=l.filter(p=>p.fark!==null);
  if(fl.length){
    const U2=ALT+44,A2=U2+72;
    let lo=Math.min(0,...fl.map(p=>p.fark)),hi=Math.max(0,...fl.map(p=>p.fark));const pay=Math.max(.4,(hi-lo)*.3);if(lo<0)lo-=pay;if(hi>0)hi+=pay;if(hi===lo)hi=lo+1;
    const y=v=>r1(A2-(v-lo)/(hi-lo)*(A2-U2)),ad=adimBul(hi-lo,3);
    s+='<text class="ogr-panel-ad" x="'+L+'" y="'+(ALT+32)+'">Türkiye ortalamasına göre fark (net)</text>';
    for(let v=Math.ceil(lo/ad)*ad;v<=hi+1e-9;v+=ad){const vv=Math.abs(v)<1e-9?0:v;if(vv!==0)s+='<line class="ogr-izgara" x1="'+L+'" x2="'+R+'" y1="'+y(vv)+'" y2="'+y(vv)+'"/>';s+='<text class="ogr-tik" x="'+(L-6)+'" y="'+(y(vv)+4)+'" text-anchor="end">'+(vv===0?'0':isaret(vv,fi))+'</text>'}
    const bw=Math.max(6,Math.min(34,adim*.5));
    l.forEach((p,i)=>{if(p.fark===null)return;const ya=y(Math.max(0,p.fark)),yb=y(Math.min(0,p.fark)),ust=p.fark>=0;
      s+='<rect class="ogr-cubuk '+(ust?'ogr-cubuk-ust':'ogr-cubuk-alt')+'" x="'+r1(x(i)-bw/2)+'" y="'+ya+'" width="'+r1(bw)+'" height="'+r1(Math.max(1,yb-ya))+'" rx="2"><title>'+kacis(p.ad+': Türkiye ortalamasına göre '+isaret(p.fark,f2)+' net')+'</title></rect>';
      if(yazili(i))s+=deger(x(i),ust?ya-5:yb+13,isaret(p.fark,f1),ust?'ogr-y':'ogr-k')});
    s+='<line class="ogr-sifir" x1="'+L+'" x2="'+R+'" y1="'+y(0)+'" y2="'+y(0)+'"/>';
    y0=A2;
  }
  // The exam names: every exam when they fit side by side, otherwise spaced ones counted back from the newest.
  const tumu=n===1||adim>=(dar?70:78),etiketAdimi=tumu?1:Math.max(her,Math.ceil((dar?110:130)/Math.max(1,adim)));
  const en=n===1?Math.min(R-L,220):tumu?adim-12:Math.min(dar?104:132,adim*etiketAdimi-12);
  let etiketSatiri=1;
  l.forEach((p,i)=>{
    if((n-1-i)%etiketAdimi)return;
    const satirlar=sinavAdSatirlari(p.ad,en),xx=x(i),genis=Math.max(...satirlar.map(yaziEn)),hiza=xx-genis/2<2?'start':xx+genis/2>W-2?'end':'middle';
    etiketSatiri=Math.max(etiketSatiri,satirlar.length);
    s+='<text class="ogr-tik ogr-sinav-adi" x="'+xx+'" y="'+(y0+18)+'" text-anchor="'+hiza+'" aria-label="'+kacis(p.ad)+'">'+
      satirlar.map((satir,j)=>'<tspan x="'+xx+'" dy="'+(j?13:0)+'">'+kacis(satir)+'</tspan>').join('')+'</text>';
  });
  const H=y0+26+(etiketSatiri-1)*13;
  return '<svg class="ogr-net" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+kacis(b.dersAd+': ortalama net ve Türkiye ortalamasına göre fark, deneme deneme')+'">'+s+'</svg>';
}
// Whom and what a block covers, in one line: the classes taken together, the number of exams and the days they span.
function kapsamYazisi(b){
  const l=b.seri&&b.seri.length?b.seri:(b.izgara?b.izgara.sinavlar:[]),sn=b.siniflar||[];
  return [sn.length?sn.join(', ')+(yz(b).ogrenci?'':sn.length>1?' sınıfları birlikte':' sınıfı'):'',l.length?fi(l.length)+' deneme':'',donem(l)].filter(Boolean).join(' · ');
}
// The headline figures as labelled boxes: the students' mean, the Türkiye average and their difference in the newest exam that
// has a Türkiye average (an exam whose list has not come yet is skipped, never filled in); how that difference moved; and, from
// the publisher's list only, the whole school's printed place and how far above the average the list's last school stands.
function kpiHtml(b){
  const fl=b.seri.filter(p=>p.fark!==null),son=fl[fl.length-1]||null;if(!son)return '';
  const kutu=(cls,ad,ic,not)=>'<div class="ogr-kutu'+(cls?' '+cls:'')+'"><span class="ogr-kutu-ad">'+ad+'</span>'+ic+(not?'<span class="ogr-kutu-not">'+not+'</span>':'')+'</div>';
  const yon=yonSinifi(son.fark);
  // How the gap moved: against the exam before and against the first one (only exams with a Türkiye average).
  const degis=(p,ad,sinav)=>{const d=son.fark-p.fark;return '<span class="ogr-degisim"><b class="'+yonSinifi(d)+'">'+ok(d)+' '+isaret(d,f1)+'</b> '+kacis(ad)+(sinav?' <span class="ogr-sinav'+(sinav.length<=18?' ogr-tek':'')+'">('+kacis(sinav)+')</span>':'')+'</span>'};
  const y=yz(b);
  let h=kutu('ogr-kutu-ana',y.biz,'<strong>'+f1(son.net)+'<small> net</small></strong>',y.ort(son.n))+
    kutu('ogr-kutu-ana','Türkiye ortalaması','<strong>'+f1(son.genel)+'<small> net</small></strong>','aynı denemede')+
    kutu('ogr-kutu-ana ogr-kutu-fark'+(yon==='ogr-y'?' ogr-arti':yon==='ogr-k'?' ogr-eksi':''),'Fark','<strong class="'+(yon==='ogr-sabit'?'':yon)+'">'+isaret(son.fark,f1)+'<small> net</small></strong>',
      yon==='ogr-y'?'Türkiye ortalamasının üzerinde':yon==='ogr-k'?'Türkiye ortalamasının altında':'Türkiye ortalamasıyla aynı düzeyde');
  if(fl.length>=2)h+=kutu('','Fark nasıl değişti?',degis(fl[fl.length-2],'önceki denemeye göre')+(fl.length>=3?degis(fl[0],'ilk denemeye göre',fl[0].ad):''),'');
  // The school's own printed place in the subject's list with its move since the exam before (a place outside the list counts as
  // one past its end; outside both: no move).
  // The school's place and the list's yardstick are about schools: not on a student's report.
  const yl=y.ogrenci?[]:b.seri.filter(p=>p.sira!==undefined),ys=yl[yl.length-1],yo=yl[yl.length-2];
  if(ys){
    const yer=p=>p.sira===null?p.listeN+1:p.sira,yerYaz=p=>p.sira===null?(p.listeN===100?'İlk 100 dışı':'Listede yok'):fi(p.sira)+'.';
    const hareket=yo&&!(ys.sira===null&&yo.sira===null)?yer(yo)-yer(ys):null;
    h+=kutu('','Okulun Türkiye sırası','<strong class="ogr-kutu-orta">'+yerYaz(ys)+'</strong>'+
      (hareket===null?'':'<span class="ogr-degisim"><b class="'+yonSinifi(hareket,1)+'">'+(hareket>0?'▲ '+fi(hareket):hareket<0?'▼ '+fi(-hareket):'■ 0')+'</b> önceki denemede '+kacis(yerYaz(yo))+'</span>'),
      'bu derste bütün okulun yeri');
  }
  if(!y.ogrenci&&Number.isFinite(son.sinir)){const d=son.sinir-son.genel;
    h+=kutu('',son.listeN===100?'İlk 100 sınırı':'Listenin sonu','<strong class="ogr-kutu-orta">'+isaret(d,f1)+'<small> net</small></strong>',
      (son.listeN===100?'Türkiye’de ilk 100’e giren son okul':'Türkiye listesindeki son okul')+', ortalamanın bu kadar '+(d<0?'altında':'üzerinde'));}
  const enYeni=b.seri[b.seri.length-1];
  return '<p class="ogr-son">Son karşılaştırılan deneme: <b>'+kacis(son.ad)+'</b>'+(son!==enYeni?' · Son denemenin Türkiye ortalaması henüz yok ('+kacis(enYeni.ad)+'); karşılaştırma ondan önceki denemeyle yapıldı.':'')+'</p><div class="ogr-kpi">'+h+'</div>';
}
// The topic table: a row per topic, most behind first. After the name: the topic's average gap over its exams as a bar from the
// Türkiye line (the order of the rows made visible), then a cell per exam, then how the gap moved from its first exam to its last.
// The last row is the whole subject on the same questions. ust: printed beside the heading, so a loose sheet says whose it is.
function izgaraHtml(b,ust=''){
  const z=b.izgara,y=yz(b),bas='<h4 class="ogr-alt-baslik">'+y.konuBas+(ust?'<span class="ogr-baski ogr-sayfa-adi">'+kacis(ust)+'</span>':'')+'</h4>';
  if(!z)return '<div class="ogr-konular ogr-ekran">'+bas+'<p class="mini ogr-yok">Bu ders için konu karşılaştırması henüz yok. Konu Takibi’ne bu dersin karne raporunu, sınav özetini ve yayınevinin performans analizini (Türkiye başarı oranları) ekleyin.</p></div>';
  // Whole points; a half rounds up whatever the last binary digit says (57,5 is written 58).
  const tam=v=>isaret(v,x=>fi(Math.round(x+1e-9)));
  const toplamOrt=ort(z.sinavlar.map(e=>e.fark)),olcek=Math.max(10,...z.satir.map(r=>Math.abs(r.ortFark)),Math.abs(toplamOrt));
  const cubuk=(v,ad)=>'<td class="ogr-iz-ort" title="'+kacis(ad+': soru çıkan denemelerdeki farkların ortalaması '+isaret(v,f1)+' puan')+'"><span class="ogr-ort"><b class="'+yonSinifi(v,.5)+'">'+tam(v)+'</b><i class="ogr-ort-yol"><i class="ogr-ort-cubuk '+(v<0?'ogr-ort-alt':'ogr-ort-ust')+'" style="width:'+r1(Math.min(50,Math.abs(v)/olcek*50))+'%"></i></i></span></td>';
  const basliklar=z.sinavlar.map(e=>'<th scope="col" class="ogr-iz-sinav" title="'+kacis(e.ad+' · '+fi(e.ogr)+' öğrenci')+'"><span>'+kacis(e.ad)+'</span></th>').join('');
  const etiket=r=>r.seri==='geride'?'<span class="ogr-seri ogr-seri-geride" title="Soru çıkan son '+ART_ARDA+' denemenin hepsinde belirgin biçimde geride">Son '+ART_ARDA+' denemede geride</span>':
    r.seri==='onde'?'<span class="ogr-seri ogr-seri-onde" title="Soru çıkan son '+ART_ARDA+' denemenin hepsinde belirgin biçimde önde">Son '+ART_ARDA+' denemede önde</span>':'';
  const hucre=(ad,c,e)=>!c?'<td class="ogr-iz-bos" title="'+kacis(e.ad+': bu konuda soru yok')+'">·</td>':
    '<td class="ogr-iz-h'+(c.durum==='belirsiz'?' ogr-iz-soluk':'')+'" style="'+hucreRengi(c)+'" title="'+kacis(ad+' · '+e.ad+': '+y.bizK+' %'+fi(Math.round(100*c.d/c.n))+', Türkiye’nin aynı sorulardaki başarısı %'+fi(Math.round(100*c.b/c.n))+' → '+isaret(c.fark,f1)+' puan'+(c.durum==='belirsiz'?' (fark küçük; tesadüf olabilir)':''))+'">'+tam(c.fark)+'</td>';
  // İlk → son: the gap on the last measured exam minus on the first (points): the direction at a glance.
  const degisim=(ad,ilk,son)=>ilk===null||son===null?'<td class="ogr-iz-degisim"></td>':'<td class="ogr-iz-degisim '+yonSinifi(son-ilk,.5)+'" title="'+kacis(ad+': ilk denemede '+isaret(ilk,f1)+', son denemede '+isaret(son,f1)+' puan')+'">'+ok(son-ilk,.5)+' '+tam(son-ilk)+'</td>';
  const satirDegisim=r=>r.degisim===null?degisim(r.ad,null,null):degisim(r.ad,r.hucre.find(Boolean).fark,[...r.hucre].reverse().find(Boolean).fark);
  const sonSatir=z.sinavlar.length>=2?degisim('Bütün konular',z.sinavlar[0].fark,z.sinavlar[z.sinavlar.length-1].fark):degisim('',null,null);
  const toplamHucre=e=>'<td class="ogr-iz-h'+(e.durum==='belirsiz'?' ogr-iz-soluk':'')+'" style="'+hucreRengi(e)+'" title="'+kacis(e.ad+' · bütün konular: '+isaret(e.fark,f1)+' puan'+(e.durum==='belirsiz'?' (fark küçük; tesadüf olabilir)':''))+'">'+tam(e.fark)+'</td>';
  // A topic's kazanımlar: smaller boxes under the topic's own, each with its number, name and the same difference per exam.
  const altSatir=a=>{const ol=a.hucre.filter(Boolean);return '<tr class="ogr-iz-alt"><th scope="row" class="ogr-iz-konu"><span class="ogr-kod">'+kacis(a.kod)+'</span>'+(a.ad&&a.ad!==a.kod?kacis(a.ad):'')+'</th><td class="ogr-iz-ort"><span class="ogr-ort"><b class="'+yonSinifi(a.ortFark,.5)+'">'+tam(a.ortFark)+'</b></span></td>'+
    a.hucre.map((c,i)=>!c?'<td class="ogr-iz-kb">·</td>':'<td class="ogr-iz-kh'+(c.durum==='belirsiz'?' ogr-iz-soluk':'')+'" title="'+kacis(a.kod+' · '+z.sinavlar[i].ad+': '+y.bizK+' %'+fi(Math.round(100*c.d/c.n))+', Türkiye %'+fi(Math.round(100*c.b/c.n))+' → '+isaret(c.fark,f1)+' puan')+'"><i style="'+hucreRengi(c)+'">'+tam(c.fark)+'</i></td>').join('')+
    (ol.length>=2?degisim(a.kod,ol[0].fark,ol[ol.length-1].fark):degisim('',null,null))+'</tr>'};
  const koyu=(c,a)=>'background:color-mix(in srgb,var(--'+c+') '+a+'%,transparent)';
  return '<div class="ogr-konular">'+bas+
    '<p class="ogr-iz-aciklama">Her kutu bir denemedir. İçindeki sayı, o konunun sorularını doğru cevaplayan öğrenci yüzdesinin Türkiye’deki yüzdeden farkıdır. Örnek: '+y.ornek.slice(0,-1)+'. Karşılaştırma aynı sorular üzerinden yapılır; zor bir deneme konuyu kendiliğinden kötü göstermez. Konular, en geride kalınandan en önde olunana doğru dizilmiştir. Her konunun altındaki küçük kutular o konunun kazanımlarıdır (numarasıyla); sayılar aynı biçimde okunur.</p>'+
    '<div class="ogr-iz-kutu"><table class="ogr-iz'+(z.sinavlar.length>12?' ogr-iz-cok':'')+'" style="--ogr-en:'+(330+z.sinavlar.length*58)+'px;--ogr-ust:'+(400+z.sinavlar.length*120)+'px"><thead><tr><th scope="col" class="ogr-iz-konu">Konu</th><th scope="col" class="ogr-iz-ort" title="Konunun soru çıkan denemelerdeki farklarının ortalaması (yüzde puan)">Ortalama<small>bütün denemeler</small></th>'+basliklar+
    '<th scope="col" class="ogr-iz-degisim" title="Konunun son denemedeki farkı eksi ilk denemedeki farkı (yüzde puan)">İlk → son</th></tr></thead>'+
    z.satir.map(r=>'<tbody class="ogr-iz-grup"><tr><th scope="row" class="ogr-iz-konu">'+kacis(r.ad)+etiket(r)+'</th>'+cubuk(r.ortFark,r.ad)+r.hucre.map((c,i)=>hucre(r.ad,c,z.sinavlar[i])).join('')+satirDegisim(r)+'</tr>'+(r.alt||[]).map(altSatir).join('')+'</tbody>').join('')+
    '<tfoot><tr class="ogr-iz-ara" aria-hidden="true"><td colspan="'+(z.sinavlar.length+3)+'"></td></tr><tr class="ogr-iz-toplam"><th scope="row" class="ogr-iz-konu">Bütün konular<small>dersin o denemedeki bütün soruları</small></th>'+cubuk(toplamOrt,'Bütün konular')+z.sinavlar.map(toplamHucre).join('')+sonSatir+'</tr></tfoot></table></div>'+
    '<div class="ogr-olcek"><span class="ogr-olcek-serit"><em>Türkiye’nin gerisinde</em><i style="'+koyu('kritik',85)+'">−</i><i style="'+koyu('kritik',21)+'">−</i><i style="'+koyu('iyi',21)+'">+</i><i style="'+koyu('iyi',85)+'">+</i><em>Türkiye’nin önünde</em></span>'+
    '<span><b>Koyu kutu:</b> fark belirgin.</span><span><b>Soluk kutu:</b> fark küçük; tesadüf olabilir.</span><span><b>·</b> O denemede bu konudan soru çıkmadı.</span></div></div>';
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
  const seri=b.seri.length?'<div class="et-tablo-kutu"><table class="et-tablo ogr-ham"><thead><tr><th scope="col">Deneme</th><th scope="col" class="sayi">Öğrenci</th><th scope="col" class="sayi">Ortalama net</th><th scope="col" class="sayi">Türkiye ort. (Genel Net)</th><th scope="col" class="sayi">Fark</th><th scope="col" class="sayi">Listenin sonu (100.)</th><th scope="col" class="sayi">1. kurum</th><th scope="col" class="sayi">Okulun sırası</th></tr></thead><tbody>'+
    b.seri.map(p=>'<tr><td>'+kacis(p.ad)+'</td><td class="sayi">'+fi(p.n)+'</td><td class="sayi">'+f2(p.net)+'</td><td class="sayi">'+(p.genel===null?'—':f2(p.genel))+'</td><td class="sayi">'+(p.fark===null?'—':isaret(p.fark,f2))+'</td>'+
      '<td class="sayi">'+(Number.isFinite(p.sinir)?f2(p.sinir)+(p.listeN!==100?' ('+fi(p.listeN)+'.)':''):'—')+'</td><td class="sayi">'+(Number.isFinite(p.birinci)?f2(p.birinci):'—')+'</td><td class="sayi">'+(p.sira===undefined?'—':p.sira===null?'dışı':fi(p.sira)+'.')+'</td></tr>').join('')+'</tbody></table></div>':'';
  const konu=b.izgara?'<div class="ogr-ham-konu" data-ogr-ham-konu="'+i+'"></div>':'';
  if(yz(b).ogrenci)return '<details class="ogr-formul" data-ogr-ham="'+i+'"><summary>Hesaplama ayrıntıları ve ham veriler</summary>'+
    '<p><b>Net grafiği:</b> her denemede bu dersteki netin ve yayınevinin Türkiye ortalaması (Genel Net). Alttaki çubuklar farktır: Fark = netin − Genel Net; yeşil çubuk Türkiye’nin üstünde, kırmızı altında.</p>'+
    '<p><b>Konu tablosu:</b> her hücre, o denemede o konunun sorularında senin doğru sayını (d), aynı soruları çözen Türkiye geneli öğrencilerinin başarı oranlarından beklenen doğru sayısıyla (b) karşılaştırır. Fark = 100 · (d − b) / n puan; n o konudaki soru sayısıdır. Zor sorular konuyu haksız yere kırmızıya boyamaz: aynı soruda Türkiye de zorlanmışsa beklenen de düşüktür.</p>'+
    '<p><b>Renk:</b> kırmızı = Türkiye’nin gerisinde, yeşil = önünde; fark büyüdükçe renk koyulaşır. Soluk hücre: fark küçük ya da soru az; tesadüf olabilir (z = (d − b) / √(n·p·(1 − p) · (1 + (soru − 1) · 0,2)), |z| < 1,96). Tek öğrencide bir konunun birkaç sorusu olduğu için çoğu hücre soluk çıkar: yönü okumak için koyu hücrelere ve tekrar eden renge bakın.</p>'+seri+konu+'</details>';
  return '<details class="ogr-formul" data-ogr-ham="'+i+'"><summary>Hesaplama ayrıntıları ve ham veriler</summary>'+
    '<p><b>Kimler?</b> '+kacis(b.siniflar.join(', '))+' sınıflarının öğrencileri birlikte (ders programında bu dersi verdiğiniz sınıflar). Sınıflar ayrı ayrı gösterilmez, öğrenci adı yoktur.</p>'+
    '<p><b>Net grafiği:</b> her denemede öğrencilerinizin bu dersteki net ortalaması (neti basılmış öğrenciler) ve yayınevinin Türkiye ortalaması (Genel Net). Alttaki çubuklar farktır: Fark = ortalama net − Genel Net; yeşil çubuk Türkiye’nin üstünde, kırmızı altında. Çubukların ölçeği farkların kendi aralığıdır, küçük değişimler de görünsün diye. Önceki / ilk denemeye göre: son farkın o denemedeki farktan ne kadar değiştiği.</p>'+
    '<p><b>İlk 100 sınırı:</b> Türkiye listesinin son satırındaki (100.) kurumun netinin Türkiye ortalamasından farkıdır; farkın büyüklüğünü okumak için listenin kendi ölçüsüdür (Türkiye geneli sayfasındaki listeden, tahmin değil). Farkınız bu değere ulaşırsa öğrencilerinizin ortalaması ilk 100’ün sonundaki kurum kadardır. <b>Okulun Türkiye sırası</b> bütün okulun bu dersteki yeridir (listede yazan; Türkiye geneli sayfasında seçilen okul), yalnızca sizin sınıflarınızın değil; listede yoksa “İlk 100 dışı” yazılır, yeri tahmin edilmez.</p>'+
    '<p><b>Konu tablosu:</b> her hücre, o denemede o konunun sorularında öğrencilerinizin doğru sayısını (d), aynı soruları çözen Türkiye geneli öğrencilerinin başarı oranlarından beklenen doğru sayısıyla (b = soruların Türkiye başarı oranlarının toplamı) karşılaştırır. Fark = 100 · (d − b) / n puan; n öğrencilerinizin o sorulara verdiği yanıt sayısıdır. Böylece zor sorular konuyu haksız yere kırmızıya boyamaz: aynı soruda Türkiye de zorlanmışsa beklenen de düşüktür. Ortalama: konunun soru çıkan denemelerdeki farklarının ortalaması; satırlar buna göre dizilir. Bütün konular: dersin o denemedeki bütün sorularıyla aynı hesap.</p>'+
    '<p><b>Renk:</b> kırmızı = Türkiye’nin gerisinde, yeşil = önünde; fark büyüdükçe renk koyulaşır (±'+RENK_UST+' puanda en koyu). Soluk hücre: bu hesaba göre fark henüz belirgin değil (z = (d − b) / √(Σ n·p·(1 − p) · (1 + (soru − 1) · 0,2)), |z| < 1,96; bir öğrencinin aynı konudaki yanıtları birbirine bağlı sayılır). “Son '+ART_ARDA+' denemede geride / önde”: konu, soru çıkan son '+ART_ARDA+' denemenin hepsinde belirgin biçimde geride / önde. İlk → son: konunun son denemedeki farkı eksi ilk denemedeki farkı (puan); betimleyicidir, şans payı sınanmaz. Nokta (·): o denemede konudan soru yok.</p>'+seri+konu+'</details>';
}
// A short reading of the existing figures; recommend a topic only after three measured exams behind.
function ozetYazisi(b){
  const fl=b.seri.filter(p=>p.fark!==null),son=fl[fl.length-1],once=fl[fl.length-2],cumle=[];
  if(son){
    const yon=v=>v>=.05?1:v<=-.05?-1:0,s=yon(son.fark),o=once?yon(once.fark):null,d=once?yon(son.fark-once.fark):0;
    const y=yz(b);let metin=s>0?y.ust:s<0?y.alt:y.ayni;
    if(once&&s!==0){
      if(s!==o)metin=s>0?y.cik:y.dus;
      else if(d)metin+='; önceki denemeye göre '+(s>0?y.avantaj+' '+(d>0?'arttı':'azaldı'):'aradaki fark '+(d>0?'azaldı':'arttı'));
      else metin+='; önceki denemeye göre fark değişmedi';
    }
    cumle.push(metin+'.');
  }else if(b.seri.length)cumle.push('Net karşılaştırması için Türkiye ortalaması eksik.');
  const oncelik=b.izgara&&b.izgara.satir.find(r=>r.seri==='geride');
  if(oncelik)cumle.push('Tekrar önceliği: '+oncelik.ad+' (son '+ART_ARDA+' denemede Türkiye’nin gerisinde).');
  return cumle.join(' ');
}
// One block: what it covers, the takeaway, the headline boxes, the chart with its own key, the topics, the appendix.
// hoca: the teacher's name, printed beside the topic heading (the topics usually fall on a sheet of their own) and, on a block
// that is not the teacher's first (ilk), beside the block's title: each block starts a page on paper.
function blokHtml(b,i,hoca='',ilk=true){
  const ozet=ozetYazisi(b),baslik=b.dersAd+(yz(b).ogrenci?'':' · '+fi(b.duzey)+'. sınıf'),kapsam=kapsamYazisi(b),fark=b.seri.some(p=>p.fark!==null);
  return '<section class="et-panel ogr-blok"><header class="ogr-blok-bas"><h3><i class="et-renk nokta" style="background:'+renk(b.kod)+'"></i> '+kacis(baslik)+'</h3>'+
    (hoca&&!ilk?'<span class="ogr-baski ogr-sayfa-adi">'+kacis(hoca)+'</span>':'')+(kapsam?'<p class="ogr-kapsam">'+kacis(kapsam)+'</p>':'')+'</header>'+
    (b.seri.length?'<div class="ogr-genel">'+(ozet?'<p class="ogr-ozet">'+kacis(ozet)+'</p>':'')+kpiHtml(b)+
      '<figure class="ogr-sekil"><div class="et-lejant ogr-lejant"><span><i class="et-renk cizgi ogr-l-okul" style="background:'+renk(b.kod)+'"></i>'+yz(b).biz.replace('Netin','Senin netin')+'</span><span><i class="et-renk cizgi ogr-l-tr"></i>Türkiye ortalaması</span>'+
      (fark?'<span><i class="et-renk ogr-l-ust"></i>Türkiye’nin üstünde</span><span><i class="et-renk ogr-l-alt"></i>Türkiye’nin altında</span>':'')+'</div><div class="ogr-grafik" data-ogr-grafik="'+i+'"></div></figure></div>':
      (ozet?'<p class="ogr-ozet">'+kacis(ozet)+'</p>':''))+
    izgaraHtml(b,hoca?baslik+' · '+hoca:'')+hamVeri(b,i)+'</section>';
}
// What a reader needs before the first figure: whom the report covers, where the numbers come from, how to read a sign and a colour.
const REHBER=[['Kimleri kapsıyor?','Ders programında dersine girdiğiniz sınıfların öğrencilerini, tek bir grup olarak. Öğrenciler ve sınıflar ayrı ayrı gösterilmez; öğretmenler birbiriyle karşılaştırılmaz.'],
  ['Veriler nereden geliyor?','Netler, okulda uygulanan denemelerin sonuç listelerinden; Türkiye ortalaması, yayınevinin aynı denemeler için açıkladığı Türkiye geneli sonuçlarından alınır. Hiçbir değer tahmin edilmez.'],
  ['Nasıl okunur?','“+” ve yeşil, Türkiye ortalamasının üzerinde; “−” ve kırmızı, altında demektir. Net farkları net, konu farkları yüzde puan olarak yazılır.']];
const REHBER_OGRENCI=[['Kimi kapsıyor?','Yalnızca seni: okulda girdiğin denemelerdeki netlerini ve cevaplarını. Başka öğrencinin adı ya da sıralama yoktur.'],REHBER[1],REHBER[2]];
const rehberHtml=(l=REHBER)=>'<div class="ogr-rehber-ic">'+l.map(([ad,metin])=>'<p><b>'+ad+'</b> '+metin+'</p>').join('')+'</div>';
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
  // On paper every teacher's sheets stand alone: the report's name, the day it was printed and the reading notes come with each.
  const bugun=typeof bugunNo==='function'?gunYaz(bugunNo()):'',ustYazi='Öğretmen raporu'+(duzey!==null?' · '+duzey+'. sınıf':'')+(bugun?' · '+bugun:'');
  const bolum=o=>{const ad=kisiAd(o.ad);return '<section class="ogr-ogretmen" data-ogr-hoca="'+kacis(o.key)+'"><header class="ogr-ogretmen-bas"><div class="ogr-kimlik"><p class="ogr-baski ogr-ust-yazi">'+kacis(ustYazi)+'</p><h2>'+kacis(ad)+'</h2><p class="mini">'+
    o.dersler.map(dersYazisi).join(' — ')+'</p></div><div class="ogr-baski ogr-rehber"><b class="ogr-rehber-ad">Bu raporu okurken</b>'+rehberHtml()+'</div></header>'+
    (o.bloklar.length?o.bloklar.map((b,j)=>blokHtml(b,sayac++,ad,!j)).join(''):'<p class="mini ogr-yok">Bu öğretmenin derslerinde henüz deneme ya da konu verisi yok.</p>')+'</section>'};
  const duzeySec='<label class="et-seg"><span class="et-seg-label">Sınıf düzeyi</span><select id="ogrDuzey"><option value="">Bütün düzeyler</option>'+duzeyler.map(d=>'<option value="'+d+'"'+(d===duzey?' selected':'')+'>'+d+'. sınıf</option>').join('')+'</select></label>';
  const secim='<label class="et-seg"><span class="et-seg-label">Öğretmen</span><select id="ogrHoca"><option value="">Bütün öğretmenler ('+fi(uygun.length)+')</option>'+uygun.map(o=>'<option value="'+kacis(o.key)+'"'+(o.key===secili?' selected':'')+'>'+kacis(kisiAd(o.ad))+'</option>').join('')+'</select></label>';
  planla();
  return '<div id="ogrKok"><header class="et-bas"><h1 class="et-baslik">Öğretmen raporu'+(duzey!==null?' · '+duzey+'. sınıf':'')+'</h1><p class="et-cumle">Öğrencilerinizin netleri ve konu başarıları, aynı denemelerde Türkiye ortalamasıyla karşılaştırılır.</p></header>'+
    '<div class="et-arac">'+duzeySec+secim+'<button type="button" class="et-dugme" id="ogrYazdir">Yazdır / PDF</button></div>'+
    '<details class="ogr-rehber ogr-rehber-ekran"><summary>Bu rapor nasıl okunur?</summary>'+rehberHtml()+'</details>'+
    (modeller.length?modeller.map(bolum).join(''):'<p class="mini ogr-yok">Bu sınıf düzeyinde ders veren öğretmen yok.</p>')+'</div>';
}
// Öğrenci raporu (Türkiye): the same blocks for one student: every exam subject the student has nets or topic answers in, TYT
// before AYT. The student is found by the school number in the lists and in Konu Takibi.
const TUM_KODLAR=(()=>{const m=new Map();for(const [,,l] of DERSLER)for(const k of l)if(!m.has(k[2]))m.set(k[2],k);return [...m.values()].sort((a,b)=>(a[0]==='TYT'?0:1)-(b[0]==='TYT'?0:1))})();
function ogrenciModeli(kisi,c){
  const nolar=new Set([String(kisi.no)]),sinif=sinifK(kisi.sinif),bloklar=[];
  for(const [oturum,anahtar,kod] of TUM_KODLAR){
    const seri=netSerisi(c.k,[],oturum,anahtar,kod,null,nolar),izgara=konuIzgarasi(c.v,[],oturum,kod,c,null,nolar);
    if(!seri.length&&!izgara)continue;
    bloklar.push({ders:dersEtiketi(kod),duzey:duzeyi(sinif),siniflar:sinif?[sinif]:[],oturum,kod,dersAd:dersEtiketi(kod),seri,izgara,y:YAZI.ogrenci});
  }
  return {key:String(kisi.no),ad:kisi.ad,sinif,no:kisi.no,bloklar};
}
function gorunumOgrenci(){
  const bas='<header class="et-bas"><h1 class="et-baslik">Öğrenci raporu (Türkiye)</h1><p class="et-cumle">Öğrencinin netleri ve konu başarıları, aynı denemelerde Türkiye ortalamasıyla karşılaştırılır.</p></header>';
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
  const bolum=o=>{const ad=kisiAd(o.ad);return '<section class="ogr-ogretmen" data-ogr-ogrenci="'+kacis(o.key)+'"><header class="ogr-ogretmen-bas"><div class="ogr-kimlik"><p class="ogr-baski ogr-ust-yazi">'+kacis('Öğrenci raporu'+(bugun?' · '+bugun:''))+'</p><h2>'+kacis(ad)+'</h2><p class="mini">'+
    kacis(o.sinif+' · okul no '+o.no)+'</p></div><div class="ogr-baski ogr-rehber"><b class="ogr-rehber-ad">Bu raporu okurken</b>'+rehberHtml(REHBER_OGRENCI)+'</div></header>'+
    (o.bloklar.length?o.bloklar.map((b,j)=>blokHtml(b,sayac++,ad,!j)).join(''):'<p class="mini ogr-yok">Bu öğrencinin henüz deneme ya da konu verisi yok.</p>')+'</section>'};
  const sec=(id,ad,l,v)=>'<label class="et-seg"><span class="et-seg-label">'+ad+'</span><select id="'+id+'">'+l.map(([d,y])=>'<option value="'+kacis(String(d))+'"'+(String(d)===String(v)?' selected':'')+'>'+kacis(y)+'</option>').join('')+'</select></label>';
  planla();
  return '<div id="ogrKok">'+bas+'<div class="et-arac">'+sec('osDuzey','Sınıf düzeyi',duzeyler.map(d=>[d,d+'. sınıf']),duzey)+sec('osSube','Şube',subeler.map(s=>[s,s]),sube)+
    sec('osOgr','Öğrenci',[['','Bütün öğrenciler ('+fi(subede.length)+')']].concat(subede.map(x=>[String(x.no),kisiAd(x.ad)])),secili)+'<button type="button" class="et-dugme" id="ogrYazdir">Yazdır / PDF</button></div>'+
    '<details class="ogr-rehber ogr-rehber-ekran"><summary>Bu rapor nasıl okunur?</summary>'+rehberHtml(REHBER_OGRENCI)+'</details>'+modeller.map(bolum).join('')+'</div>';
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
  const acik=()=>typeof EK!=='undefined'&&(EK.sekme==='ogretmenrapor'||EK.sekme==='ogrencitr');
  window.addEventListener('resize',()=>{if(acik())planla()});
  // Printing lays the page out at the paper's width: the charts are drawn again at their printed width (text stays readable), and
  // again at the screen's afterwards.
  if(window.matchMedia){const mq=window.matchMedia('print'),f=()=>{if(acik())grafikleriCiz()};if(mq.addEventListener)mq.addEventListener('change',f);else if(mq.addListener)mq.addListener(f)}
  window.addEventListener('afterprint',()=>{if(acik())planla()});
}
if(typeof document!=='undefined'&&document.addEventListener){
  document.addEventListener('change',ev=>{if(typeof rehberMi!=='function'||!rehberMi())return;
    if(ev.target.id==='ogrHoca'){EK.ogrHoca=ev.target.value||undefined;ciz()}
    else if(ev.target.id==='osDuzey'){EK.osDuzey=Number(ev.target.value);EK.osSube=undefined;EK.osOgr=undefined;ciz()}
    else if(ev.target.id==='osSube'){EK.osSube=ev.target.value;EK.osOgr=undefined;ciz()}
    else if(ev.target.id==='osOgr'){EK.osOgr=ev.target.value||undefined;ciz()}
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
return {gorunumOgrenci,ogrenciModeli,DERSLER,ogretmenler,netSerisi,konuIzgarasi,olc,ogretmenModeli,hucreRengi,netGrafigi,izgaraHtml,blokHtml,hamKonu,bloklar:()=>SON?SON.flatMap(o=>o.bloklar):[],gorunum,grafikleriCiz,sinifK,R_MADDE,RENK_UST,ART_ARDA};
})();
function gorunumOgretmenRapor(){return OGRETMEN_RAPOR.gorunum()}
