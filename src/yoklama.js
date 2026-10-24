// Embedded in index.html by scripts/embed-yoklama.cjs. No student data belongs here.
// Yoklama (teacher only): the school's "Yoklama Raporu" PDFs, read in the browser. Every student's
// day gets one state: Geldi, Geç geldi, Gelmedi, Raporlu or Diğer (see gunDurumu). Absence and
// lateness are counted and ranked apart; one date range (Başlangıç–Bitiş) drives every chart and list.
// A compact copy is kept in the teacher notebook as D.yoklama, so it travels with the teacher's cloud
// backup; student packets are built from a field whitelist and never carry it. Nothing is uploaded.
// See docs/yoklama.md.
const YOKLAMA = (() => {
const SURUM=1, UST_SINIR=250000, EN_COK_OGRENCI=3000, EN_COK_GUN=400, EN_COK_KAYNAK=60, EN_COK_DERS=12;
// The school year starts on 14 Eylül 2026; earlier days in a report are not kept.
const ILK_GUN_ISO='2026-09-14';
const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const GUN_KISA=['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
// One state per student and day, in the order the page shows them.
const DURUMLAR=[
  ['geldi','Geldi','Okula geldi. Erken çıkma ve ders kaçırma da “geldi” sayılır.'],
  ['gec','Geç geldi','“Gecikti” yazıyor ya da ilk derslere gelmeyip sonra geldi.'],
  ['gelmedi','Gelmedi','Gün boyu gelmedi, mazereti yok.'],
  ['raporlu','Raporlu','Mazeretli (Raporlu).'],
  ['diger','Diğer','Mazeretli (Diğer).']];
const DURUM_ADI=Object.fromEntries(DURUMLAR.map(([k,ad])=>[k,ad]));
const RENK=k=>'var(--y-'+k+')';
// A lesson's code in the report: P Geldi · G Gecikti · A Gelmedi · M Mazeretli (Diğer) ·
// R Mazeretli (Raporlu) · . no entry.
const KOD_ADI={P:'geldi',G:'gecikti',A:'gelmedi',M:'mazeretli (diğer)',R:'mazeretli (raporlu)','.':'yoklama yok'};
const KOD_SINIF={P:'geldi',G:'gec',A:'gelmedi',M:'diger',R:'raporlu','.':'yok'};

/* ---------------- small helpers ---------------- */
const anahtar=s=>denemeAdAnahtari(s);
const kisa=(s,n)=>String(s==null?'':s).replace(/\s+/g,' ').trim().slice(0,n);
const kisiAdi=s=>String(s||'').toLocaleLowerCase('tr-TR').split(' ').map(w=>w?w[0].toLocaleUpperCase('tr-TR')+w.slice(1):w).join(' ');
const sayi=n=>Number(n).toLocaleString('tr-TR');
const yuzde=p=>'%'+(Math.round(p*1000)/10).toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});
const r1=x=>Math.round(x*10)/10;
const gunAy=g=>{const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]};
const tarihUzun=g=>{const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]+' '+t.getUTCFullYear()};
const gunAdli=g=>GUN_KISA[haftaGunu(g)]+' '+gunAy(g);
const sinifDuzeyi=c=>{const m=/^(\d{1,2})\s*\//.exec(String(c||'').trim());return m?Number(m[1]):null};
const kademeAdi=d=>d+'. sınıflar';
const sinifSira=(a,b)=>(sinifDuzeyi(b)||0)-(sinifDuzeyi(a)||0)||a.localeCompare(b,'tr');
const bos=()=>({geldi:0,gec:0,gelmedi:0,raporlu:0,diger:0});
const TARIH=/^(\d{2})\/(\d{2})\/(\d{4})$/;
const tarihGun=s=>{const m=TARIH.exec(s);if(!m||+m[2]<1||+m[2]>12||+m[1]<1||+m[1]>31)return null;return gunNo(m[3]+'-'+m[2]+'-'+m[1])};
// The footer's print date ("19 Eki 2026").
function baskiGunu(s){
  const m=/^(\d{1,2})\s+(\S+)\s+(\d{4})$/u.exec(s);if(!m)return null;
  const ay=AY.findIndex(a=>m[2].toLocaleLowerCase('tr-TR').startsWith(a.toLocaleLowerCase('tr-TR')));if(ay<0)return null;
  return gunNo(m[3]+'-'+String(ay+1).padStart(2,'0')+'-'+m[1].padStart(2,'0'));
}

// The day's state from its lessons. A day with any Geldi or Gecikti lesson is a day at school: Geç
// geldi when a lesson is marked Gecikti or a Gelmedi comes before the first lesson there, else Geldi
// (leaving early and missing a lesson in between count as Geldi). A day with no lesson at school is
// Gelmedi when unexcused lessons outnumber excused ones, else Raporlu or Diğer, whichever has more.
function gunDurumu(kod){
  const k=String(kod||'').replace(/\./g,'');if(!k)return null;
  const i=k.search(/[PG]/);
  if(i>=0)return k.includes('G')||k.slice(0,i).includes('A')?'gec':'geldi';
  const n=c=>k.split(c).length-1,a=n('A'),r=n('R'),m=n('M');
  if(a>r+m)return 'gelmedi';
  return r>=m&&r>0?'raporlu':'diger';
}
// "1–2. ders gelmedi · 3–8. ders geldi"
function dersOzeti(kod){
  const out=[];let i=0;
  while(i<kod.length){let j=i;while(j+1<kod.length&&kod[j+1]===kod[i])j++;
    if(kod[i]!=='.')out.push((i===j?(i+1):(i+1)+'–'+(j+1))+'. ders '+KOD_ADI[kod[i]]);i=j+1}
  return out.join(' · ');
}
const dersSeridi=kod=>'<span class="yk-serit" aria-hidden="true">'+[...kod].map(c=>'<i class="'+KOD_SINIF[c]+'"></i>').join('')+'</span>';

/* ---------------- PDF text → days ---------------- */
// sayfalar: pdf.js text items per page {s,x,y,w,h,z} (y from the page bottom). Each class starts on a
// new page under "205 12/C Yoklama Raporu" and the lesson headers "1. Ders" … "8. Ders". Every row is
// one day of one student: its date, then each lesson's state under its header ("Mazeretli" over
// "(Diğer)" / "(Raporlu)"). A student's rows run one after another, dates rising, and go on to the
// next page; the name sits in the middle of the rows on each page, long names on two lines.
function hucreKodu(t){
  if(/Gecik|Geç/iu.test(t))return 'G';if(/Gelmedi/iu.test(t))return 'A';if(/Geldi/iu.test(t))return 'P';
  if(/Rapor/iu.test(t))return 'R';if(/Mazeret|İzin|Görev|Diğer/iu.test(t))return 'M';return null;
}
function pdfCoz(sayfalar){
  let rapor=false,sinif=null,kolon=null,son=null,atlanan=0,bilinmeyen=0,yaz=null;
  const kisiler=new Map();
  for(const items of sayfalar){
    const it=(items||[]).filter(i=>i&&typeof i.s==='string'&&i.s.trim()&&Number.isFinite(i.x)&&Number.isFinite(i.y))
      .map(i=>({s:i.s.trim().replace(/\s+/g,' '),x:i.x,y:i.y,w:Number.isFinite(i.w)?i.w:0}));
    for(const o of it){
      if(/Yoklama Raporu/iu.test(o.s)){rapor=true;const h=/(\d{1,2})\s*\/\s*([A-ZÇĞİÖŞÜ]{1,3})\s+Yoklama Raporu/u.exec(o.s);if(h){sinif=h[1]+'/'+h[2];son=null}}
      const b=baskiGunu(o.s);if(b!==null)yaz=yaz===null?b:Math.max(yaz,b);
    }
    const bas=it.filter(o=>/^\d{1,2}\. Ders$/.test(o.s)&&parseInt(o.s,10)>=1&&parseInt(o.s,10)<=EN_COK_DERS);
    if(bas.length){const ust=Math.max(...bas.map(o=>o.y)),satir=bas.filter(o=>Math.abs(o.y-ust)<2);
      kolon=new Map(satir.map(o=>[parseInt(o.s,10)-1,o.x+o.w/2]))}
    if(!kolon||!sinif)continue;
    const ustY=bas.length?Math.max(...bas.map(o=>o.y))-2:Infinity;
    const satirlar=it.filter(o=>TARIH.test(o.s)&&o.y<ustY).map(o=>({y:o.y,x:o.x,g:tarihGun(o.s)})).filter(r=>r.g!==null).sort((a,b)=>b.y-a.y);
    if(!satirlar.length)continue;
    const tarihX=Math.min(...satirlar.map(r=>r.x)),n=Math.max(...kolon.keys())+1,merkez=[...Array(n)].map((_,i)=>kolon.get(i));
    const adim=n>1?Math.min(...merkez.filter(Number.isFinite).slice(1).map((x,i)=>x-merkez.filter(Number.isFinite)[i])):45;
    // Lessons: the text under each header, within the row's band.
    for(const r of satirlar){
      const hucre=[...Array(n)].map(()=>[]);
      for(const o of it){
        if(o.x<tarihX+30||Math.abs(o.y-r.y)>=8||TARIH.test(o.s))continue;
        const c=o.x+o.w/2;let en=-1,ed=Infinity;
        merkez.forEach((x,i)=>{if(Number.isFinite(x)&&Math.abs(x-c)<ed){ed=Math.abs(x-c);en=i}});
        if(en>=0&&ed<adim/2)hucre[en].push(o.s);
      }
      r.kod=hucre.map(h=>{if(!h.length)return '.';const k=hucreKodu(h.join(' '));if(!k){bilinmeyen++;return '.'}return k}).join('').replace(/\.+$/,'');
    }
    // Names in the column left of the dates; lines close together are one name.
    const altY=satirlar[satirlar.length-1].y-15;
    const adlar=it.filter(o=>o.x+o.w<=tarihX-1&&o.y<ustY&&o.y>altY&&!/^Sayfa\s*\d+$/iu.test(o.s)).sort((a,b)=>b.y-a.y);
    const gruplar=[];
    for(const o of adlar){const g=gruplar[gruplar.length-1];if(g&&g.alt-o.y<=12){g.s.push(o.s);g.alt=o.y}else gruplar.push({s:[o.s],ust:o.y,alt:o.y})}
    for(const g of gruplar){g.ad=kisa(g.s.join(' '),80);g.y=(g.ust+g.alt)/2}
    // Runs of rising dates; a date at or before the previous one starts the next student.
    const parcalar=[];
    for(const r of satirlar){const p=parcalar[parcalar.length-1];if(!p||r.g<=p.satir[p.satir.length-1].g)parcalar.push({satir:[r],adlar:[]});else p.satir.push(r)}
    for(const g of gruplar){
      let en=null,ed=Infinity;
      for(const p of parcalar){const u=p.satir[0].y,a=p.satir[p.satir.length-1].y;if(g.y>u+10||g.y<a-10)continue;const d=Math.abs(g.y-(u+a)/2);if(d<ed){ed=d;en=p}}
      if(en)en.adlar.push(g);
    }
    // A run holding several names (a student whose days start after the one above ended): each name
    // takes the rows it sits in the middle of.
    const bolum=[];
    for(const p of parcalar){
      if(p.adlar.length<2){bolum.push({satir:p.satir,ad:p.adlar[0]?p.adlar[0].ad:null});continue}
      const ad=p.adlar.sort((a,b)=>b.y-a.y);let i0=0;
      ad.forEach((a,j)=>{
        if(j===ad.length-1){bolum.push({satir:p.satir.slice(i0),ad:a.ad});return}
        let k0=i0+1,ed=Infinity;
        for(let k=i0+1;k<=p.satir.length-(ad.length-1-j);k++){const d=Math.abs((p.satir[i0].y+p.satir[k-1].y)/2-a.y);if(d<ed){ed=d;k0=k}}
        bolum.push({satir:p.satir.slice(i0,k0),ad:a.ad});i0=k0;
      });
    }
    bolum.forEach((p,pi)=>{
      const ilk=p.satir[0].g;let hedef=null;
      if(pi===0&&son&&ilk>son.sonG&&(!p.ad||anahtar(p.ad)===anahtar(son.ad)))hedef=son;
      else if(p.ad){const k=anahtar(p.ad)+'|'+sinif;hedef=kisiler.get(k)||{ad:p.ad,sinif,gun:new Map()};kisiler.set(k,hedef)}
      if(!hedef){atlanan+=p.satir.length;son=null;return}
      for(const r of p.satir)if(r.kod)hedef.gun.set(r.g,r.kod);
      hedef.sonG=p.satir[p.satir.length-1].g;son=hedef;
    });
  }
  if(!rapor)throw new Error('Bu PDF okulun “Yoklama Raporu” gibi görünmüyor.');
  const liste=[...kisiler.values()].filter(k=>k.gun.size);
  if(!liste.length)throw new Error('PDF’de yoklama satırı bulunamadı.');
  const gunler=liste.flatMap(o=>[...o.gun.keys()]);
  return {bas:Math.min(...gunler),bit:Math.max(...gunler),yaz,siniflar:[...new Set(liste.map(o=>o.sinif))].sort(sinifSira),
    ogrenciler:liste.map(o=>({ad:o.ad,sinif:o.sinif,gun:[...o.gun.entries()].sort((a,b)=>a[0]-b[0])})),atlanan,bilinmeyen};
}

/* ---------------- notebook storage ---------------- */
// D.yoklama = {surum, ts, kaynak:[{bas,bit,n,yaz,ts}], gunler:[gün…], ogrenci:[[ad, şube, "8P,,AAPPPPPP,…"]]}
// Days are the app's day numbers (UTC days since 1970). Each student's days are one string, a part per
// entry of gunler: the lessons' codes ("AAPPPPPP"), a run of one code as count + code ("8P"), or empty
// for no entry. yaz is the report's print day. A report replaces its own classes' days inside its own
// date range and keeps everything else, so cumulative reports simply refresh the data.
const PARCA=/^(?:|\d{1,2}[PAGMR.]|[PAGMR.]{1,12})$/;
const sikistir=k=>k.length>1&&/^(.)\1+$/.test(k)?k.length+k[0]:k;
const acKod=s=>{const m=/^(\d{1,2})([PAGMR.])$/.exec(s);return m?m[2].repeat(+m[1]):s};
function dogrula(v){
  const hata=m=>{throw new Error('Kayıtlı yoklama verisi okunamadı ('+m+').')};
  const metin=(x,n)=>typeof x==='string'&&x.length<=n;
  const gun=x=>Number.isSafeInteger(x)&&x>=10000&&x<=40000;
  const tamsayi=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
  if(!v||typeof v!=='object'||Array.isArray(v)||v.surum!==SURUM||!Number.isSafeInteger(v.ts)||v.ts<0)hata('yapı');
  if(!Array.isArray(v.kaynak)||v.kaynak.length>EN_COK_KAYNAK||!v.kaynak.every(k=>k&&gun(k.bas)&&gun(k.bit)&&k.bas<=k.bit&&tamsayi(k.n,0,1e6)&&tamsayi(k.ts,0,1e14)&&(k.yaz===null||gun(k.yaz))))hata('raporlar');
  if(!Array.isArray(v.gunler)||!v.gunler.length||v.gunler.length>EN_COK_GUN||!v.gunler.every((g,i)=>gun(g)&&(!i||g>v.gunler[i-1])))hata('günler');
  if(!Array.isArray(v.ogrenci)||!v.ogrenci.length||v.ogrenci.length>EN_COK_OGRENCI)hata('öğrenciler');
  for(const o of v.ogrenci){
    if(!Array.isArray(o)||o.length!==3||!metin(o[0],80)||!o[0]||!metin(o[1],24)||typeof o[2]!=='string')hata('öğrenci');
    const p=o[2].split(',');if(p.length!==v.gunler.length||!p.every(x=>PARCA.test(x)&&acKod(x).length<=EN_COK_DERS)||!p.some(x=>x&&gunDurumu(acKod(x))))hata('öğrenci günleri');
  }
  return v;
}
const izleme=()=>typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme();
function oku(){
  if(D.yoklama===undefined)return {veri:null};
  try{return {veri:dogrula(JSON.parse(JSON.stringify(D.yoklama)))}}catch(e){return {veri:null,hata:e.message}}
}
// Students as {ad, sinif, gun: Map(gün → lesson codes)}.
function ac(v){
  if(!v)return [];
  return v.ogrenci.map(([ad,sinif,s])=>{const gun=new Map();s.split(',').forEach((x,i)=>{if(x)gun.set(v.gunler[i],acKod(x))});return {ad,sinif,gun}});
}
function paketle(kisiler,kaynak,ts){
  const gunler=[...new Set(kisiler.flatMap(o=>[...o.gun.keys()]))].sort((a,b)=>a-b);
  const sirali=kisiler.slice().sort((a,b)=>sinifSira(a.sinif,b.sinif)||a.ad.localeCompare(b.ad,'tr'));
  return {surum:SURUM,ts,kaynak,gunler,ogrenci:sirali.map(o=>[o.ad,o.sinif,gunler.map(g=>o.gun.has(g)?sikistir(o.gun.get(g)):'').join(',')])};
}
function birlestir(veri,rapor){
  const ilk=gunNo(ILK_GUN_ISO),bas=Math.max(rapor.bas,ilk),bit=rapor.bit,siniflar=new Set(rapor.siniflar),m=new Map();
  for(const o of ac(veri)){const gun=new Map([...o.gun].filter(([g])=>!(siniflar.has(o.sinif)&&g>=bas&&g<=bit)));m.set(anahtar(o.ad)+'|'+o.sinif,{ad:o.ad,sinif:o.sinif,gun})}
  let n=0;
  for(const o of rapor.ogrenciler){
    const k=anahtar(o.ad)+'|'+o.sinif,e=m.get(k)||{ad:o.ad,sinif:o.sinif,gun:new Map()};e.ad=o.ad;
    for(const [g,kod] of o.gun)if(g>=ilk&&gunDurumu(kod)){e.gun.set(g,kod.slice(0,EN_COK_DERS));n++}
    m.set(k,e);
  }
  const kisiler=[...m.values()].filter(o=>o.gun.size);
  if(!kisiler.length)throw new Error('Raporda '+tarihUzun(ilk)+' ve sonrasına ait yoklama yok.');
  if(kisiler.length>EN_COK_OGRENCI)throw new Error('En fazla '+sayi(EN_COK_OGRENCI)+' öğrenci saklanır.');
  const ts=Math.max(Date.now(),veri?veri.ts+1:0);
  const kaynak=[...(veri?veri.kaynak:[]),{bas:Math.min(bas,bit),bit,n,yaz:rapor.yaz??null,ts}].slice(-EN_COK_KAYNAK);
  const v=paketle(kisiler,kaynak,ts);
  if(v.gunler.length>EN_COK_GUN)throw new Error('En fazla '+sayi(EN_COK_GUN)+' gün saklanır.');
  return v;
}
const ONBELLEK={k:null,m:null};
async function yaz(veri){
  if(veri)dogrula(veri);
  const json=veri?JSON.stringify(veri):'',bayt=baytBoyu(json);
  if(bayt>UST_SINIR)throw new Error('Yoklama verisi '+Math.round(UST_SINIR/1000)+' KB sınırını aşıyor.');
  const eski=D.yoklama,geri=()=>{if(eski===undefined)delete D.yoklama;else D.yoklama=eski};
  if(veri)D.yoklama=veri;else delete D.yoklama;
  // The days ride in the teacher's cloud backup; they must not push it over its limit.
  if(veri&&baytBoyu(JSON.stringify(D))>BULUT_YEDEK_UST_SINIR&&bayt>(eski===undefined?0:baytBoyu(JSON.stringify(eski)))){geri();throw new Error('Bu rapor defteri bulut yedeği sınırının üstüne çıkarır.')}
  if(!await kaydet(true)){geri();throw new Error('Cihaza kaydedilemedi; yoklama verisi değişmedi.')}
  ONBELLEK.k=null;
}
async function raporEkle(raporlar){
  if(!rehberMi()||izleme())throw new Error('Yalnızca rehber öğretmen ekleyebilir.');
  const {veri,hata}=oku();if(hata)throw new Error(hata+' Yeni rapor eklenmedi.');
  let v=veri;
  for(const r of raporlar.slice().sort((a,b)=>a.bit-b.bit||(a.yaz??0)-(b.yaz??0)))v=birlestir(v,r);
  await yaz(v);
  return v;
}
async function sil(){
  if(!rehberMi()||izleme())throw new Error('Yalnızca rehber öğretmen silebilir.');
  await yaz(null);
}

/* ---------------- model ---------------- */
// kapsam: '' the whole school, 'd12' one grade, '12/A' one class. The range [bas, bit] is clamped to
// the stored days. Days printed on the day of the report (yaz) may be incomplete: kismi.
const kapsamIcinde=(sinif,k)=>!k||(k[0]==='d'?sinifDuzeyi(sinif)===Number(k.slice(1)):sinif===k);
const kapsamAdi=k=>!k?'Tüm okul':k[0]==='d'?kademeAdi(k.slice(1)):k;
function kismiGunler(v){
  const s=new Set();
  for(const k of v.kaynak.slice().sort((a,b)=>a.ts-b.ts)){for(const g of [...s])if(g>=k.bas&&g<=k.bit)s.delete(g);if(k.yaz!==null&&k.yaz>=k.bas&&k.yaz<=k.bit)s.add(k.yaz)}
  return s;
}
function aralik(v,bas,bit){
  const ilk=v.gunler[0],son=v.gunler[v.gunler.length-1],k=g=>Number.isSafeInteger(g)?Math.min(son,Math.max(ilk,g)):null;
  let a=k(bas)??ilk,b=k(bit)??son;if(a>b)[a,b]=[b,a];return [a,b];
}
function model(v,{bas,bit,kapsam}={}){
  const [a,b]=aralik(v,bas,bit),kismi=kismiGunler(v),tum=ac(v);
  const gunler=v.gunler.filter(g=>g>=a&&g<=b),haftalar=[...new Set(gunler.map(pazartesi))];
  const kisiler=[];
  for(const o of tum){
    if(!kapsamIcinde(o.sinif,kapsam))continue;
    const liste=[],say=bos(),once=[];
    for(const [g,kod] of o.gun){const d=gunDurumu(kod);if(!d)continue;if(g>=a&&g<=b){liste.push({g,kod,d});say[d]++}if(g<=b)once.push({g,d})}
    if(!liste.length)continue;
    const toplam=liste.length,kim=anahtar(o.ad)+'|'+o.sinif;
    const sonu=d=>{const l=liste.filter(x=>x.d===d);return l.length?l[l.length-1].g:null};
    kisiler.push({kim,ad:o.ad,sinif:o.sinif,duzey:sinifDuzeyi(o.sinif),liste,say,toplam,oran:(say.geldi+say.gec)/toplam,
      sonGelmedi:sonu('gelmedi'),sonGec:sonu('gec'),tum:once,gunu:new Map(liste.map(x=>[x.g,x]))});
  }
  kisiler.sort((x,y)=>sinifSira(x.sinif,y.sinif)||x.ad.localeCompare(y.ad,'tr'));
  if(!kisiler.length)return {bos:true,a,b,kapsam:kapsam||'',gunler,haftalar,kisiler,kismi};
  // Counts per day for the scope ('*'), each grade ('d12') and each class ('12/A').
  const gunSay=new Map(),ekle=(k,g,d)=>{if(!gunSay.has(k))gunSay.set(k,new Map());const m=gunSay.get(k);if(!m.has(g))m.set(g,bos());m.get(g)[d]++};
  for(const o of kisiler)for(const x of o.liste){ekle('*',x.g,x.d);ekle('d'+o.duzey,x.g,x.d);ekle(o.sinif,x.g,x.d)}
  const kismiHafta=haftaGunu(b)<4?pazartesi(b):null;
  const donem=(grup,tur)=>{const m=gunSay.get(grup)||new Map(),ps=tur==='hafta'?haftalar:gunler;
    return ps.map(p=>{const say=bos();let gun=0;
      for(const g of (tur==='hafta'?gunler.filter(g=>pazartesi(g)===p):[p])){const s=m.get(g);if(!s)continue;gun++;for(const k in say)say[k]+=s[k]}
      const toplam=Object.values(say).reduce((x,y)=>x+y,0);
      return {p,say,toplam,gun,kismi:tur==='hafta'?p===kismiHafta||gunler.some(g=>pazartesi(g)===p&&kismi.has(g)):kismi.has(p)}})};
  const grupOzeti=(ad,liste)=>{const say=bos();for(const o of liste)for(const k in say)say[k]+=o.say[k];const toplam=Object.values(say).reduce((x,y)=>x+y,0);
    return {ad,ogrenci:liste.length,say,toplam,oran:toplam?(say.geldi+say.gec)/toplam:0,gelmeyen:liste.filter(o=>o.say.gelmedi).length,gecikan:liste.filter(o=>o.say.gec).length}};
  const subeler=[...new Set(kisiler.map(o=>o.sinif))].sort(sinifSira);
  const duzeyler=[...new Set(kisiler.map(o=>o.duzey).filter(d=>d!==null))].sort((x,y)=>y-x);
  const ozet=grupOzeti(kapsamAdi(kapsam),kisiler);
  // Rankings: unexcused absence and lateness apart, most first; ties by the later last time.
  const sirala=d=>kisiler.filter(o=>o.say[d]>0).sort((x,y)=>y.say[d]-x.say[d]||(y[d==='gec'?'sonGec':'sonGelmedi']-x[d==='gec'?'sonGec':'sonGelmedi'])||x.ad.localeCompare(y.ad,'tr'));
  return {a,b,kapsam:kapsam||'',gunler,haftalar,kisiler,kismi,kismiHafta,donem,ozet,
    subeler:subeler.map(s=>({k:s,...grupOzeti(s,kisiler.filter(o=>o.sinif===s))})),
    duzeyler:duzeyler.map(d=>({k:'d'+d,...grupOzeti(kademeAdi(d),kisiler.filter(o=>o.duzey===d))})),
    gelmeyenler:sirala('gelmedi'),gecikenler:sirala('gec'),tam:kisiler.filter(o=>o.say.geldi===o.toplam)};
}
// One day in the scope: who was where, and for absence and lateness how often it happened before.
// A day is beklenmedik for a student who did the same on at most 3% of at least 5 earlier days.
function gunDetayi(m,g){
  const l={geldi:[],gec:[],gelmedi:[],raporlu:[],diger:[]};
  for(const o of m.kisiler){const x=o.gunu.get(g);if(!x)continue;
    const once=o.tum.filter(y=>y.g<g),ayni=once.filter(y=>y.d===x.d).length;
    l[x.d].push({o,kod:x.kod,once:once.length,ayni,beklenmedik:(x.d==='gelmedi'||x.d==='gec')&&once.length>=5&&ayni/once.length<=.03})}
  for(const k in l)l[k].sort((a,b)=>b.beklenmedik-a.beklenmedik||a.ayni-b.ayni||sinifSira(a.o.sinif,b.o.sinif)||a.o.ad.localeCompare(b.o.ad,'tr'));
  return l;
}
function kapsamAl(v){
  const k=EK.ykKapsam||'',siniflar=new Set(v.ogrenci.map(o=>o[1]));
  if(!k)return '';
  if(k[0]==='d')return [...siniflar].some(s=>'d'+sinifDuzeyi(s)===k)?k:'';
  return siniflar.has(k)?k:'';
}
function modelAl(v){
  const kapsam=kapsamAl(v),k=v.ts+'|'+v.gunler.length+'|'+EK.ykBas+'|'+EK.ykBit+'|'+kapsam;
  if(ONBELLEK.k!==k||!ONBELLEK.m){ONBELLEK.m=model(v,{bas:EK.ykBas,bit:EK.ykBit,kapsam});ONBELLEK.k=k}return ONBELLEK.m;
}
function durumAl(m){
  const gruplar=gruplarAl(m);
  return {tur:EK.ykTur==='gun'?'gun':'hafta',grup:gruplar.some(g=>g[0]===EK.ykGrup)?EK.ykGrup:'birlikte',
    gun:m.gunler.includes(EK.ykGun)?EK.ykGun:m.gunler[m.gunler.length-1],
    kim:m.kisiler.some(k=>k.kim===EK.ykOgr)?EK.ykOgr:((m.gelmeyenler[0]||m.gecikenler[0]||m.kisiler[0]||{}).kim)};
}
// Göster: one chart, a chart per grade, or a chart per class, as far as the scope has them.
function gruplarAl(m){
  const g=[['birlikte','Birlikte']];
  if(!m.kapsam&&m.duzeyler.length>1)g.push(['duzey','Sınıf düzeyleri']);
  if(m.kapsam[0]!=='d'&&m.kapsam||m.subeler.length<2)return g;
  g.push(['sube','Şubeler']);return g;
}

/* ---------------- charts (SVG strings, sized to their box) ---------------- */
const CIZIMLER=new Map();
const SORUN=['gelmedi','gec','raporlu','diger'];
function tikler(max,n){
  if(!(max>0))return [0,1];
  const ham=max/n,us=Math.pow(10,Math.floor(Math.log10(ham))),adim=Math.max(1,[1,2,5,10].find(k=>k*us>=ham-1e-9)*us),out=[];
  for(let v=0;v<max;v+=adim)out.push(v);out.push(out[out.length-1]+adim);return out;
}
const yaziGen=s=>String(s).length*7;
function donemBasligi(r,tur){return tur==='hafta'?gunAy(r.p)+' haftası'+(r.kismi?' · devam ediyor':''):gunAdli(r.p)+(r.kismi?' · gün bitmeden':'')}
// Bars per week or day: Gelmedi at the bottom, then Geç geldi, Raporlu and Diğer. Geldi is left out of
// the bars (it would fill them) and given in the readout.
function cubukGrafik(d,tur,W,{H=260,yMax}={}){
  const tik=tikler(Math.max(1,yMax??Math.max(...d.map(r=>SORUN.reduce((t,k)=>t+r.say[k],0)))),H<200?3:5);
  const R=W-(yaziGen(sayi(tik[tik.length-1]))+20),L=2,ust=14,alt=H-24,step=(R-L)/Math.max(1,d.length),x=i=>L+step*(i+.5),y=v=>alt-v/tik[tik.length-1]*(alt-ust);
  const bw=Math.max(2,Math.min(34,step*.66));
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">';
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+L+'" x2="'+R+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+(R+8)+'" y="'+r1(y(t))+'" dy="0.32em">'+sayi(t)+'</text>').join('');
  d.forEach((r,i)=>{let acc=0;
    for(const k of SORUN){const v=r.say[k];if(!v)continue;
      svg+='<rect class="yk-cubuk'+(r.kismi?' kismi':'')+'" x="'+r1(x(i)-bw/2)+'" y="'+r1(y(acc+v))+'" width="'+r1(bw)+'" height="'+r1(Math.max(.5,y(acc)-y(acc+v)-(acc+v<tik[tik.length-1]?1:0)))+'" style="fill:'+RENK(k)+'"/>';acc+=v}
    if(acc&&bw>=16&&H>=200)svg+='<text class="et-deger" x="'+r1(x(i))+'" y="'+r1(y(acc)-5)+'" text-anchor="middle">'+sayi(acc)+'</text>'});
  svg+='<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
  const her=Math.max(1,Math.ceil(52/step)),n=d.length;
  d.forEach((r,i)=>{if((n-1-i)%her)return;const t=gunAy(r.p),w=yaziGen(t);let xx=x(i),an='middle';if(xx-w/2<0){xx=0;an='start'}else if(xx+w/2>W){xx=W;an='end'}
    svg+='<text class="et-tik" x="'+r1(xx)+'" y="'+(H-6)+'" text-anchor="'+an+'">'+t+'</text>'});
  svg+='<line class="et-kural" y1="'+(ust-6)+'" y2="'+alt+'" x1="0" x2="0" visibility="hidden"/></svg>';
  const ipucu=d.map(r=>({bas:donemBasligi(r,tur)+(tur==='hafta'?' · '+sayi(r.gun)+' gün':''),
    satir:[...SORUN.map(k=>[RENK(k),DURUM_ADI[k],sayi(r.say[k])]),[RENK('geldi'),'Geldi',sayi(r.say.geldi)],[null,'Gelme oranı',r.toplam?yuzde((r.say.geldi+r.say.gec)/r.toplam):'—']]}));
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map(r=>y(SORUN.reduce((t,k)=>t+r.say[k],0))),bant:step,ipucu};
}
function grafikVerisi(m,st,ad){
  if(ad==='donem')return {d:m.donem('*',st.tur),opt:{}};
  const k=ad.slice(5),gl=st.grup==='duzey'?m.duzeyler:m.subeler;
  const yMax=Math.max(1,...gl.map(g=>Math.max(...m.donem(g.k,st.tur).map(r=>SORUN.reduce((t,s)=>t+r.say[s],0)))));
  return {d:m.donem(k,st.tur),opt:{H:150,yMax}};
}
let ZAMAN=null;
function grafikleriCiz(){
  if(!etkin())return;
  const {veri}=oku();if(!veri)return;const m=modelAl(veri);if(m.bos)return;const st=durumAl(m);
  document.querySelectorAll('.et-grafik[data-yk-grafik]').forEach(kutu=>{
    const W=Math.round(kutu.clientWidth);if(W<120)return;
    const ad=kutu.dataset.ykGrafik,imza=W+'|'+st.tur+'|'+st.grup+'|'+m.a+'|'+m.b+'|'+m.kapsam+'|'+veri.ts;if(kutu.dataset.imza===imza)return;
    const {d,opt}=grafikVerisi(m,st,ad);const g=cubukGrafik(d,st.tur,Math.max(200,W),opt);
    kutu.dataset.imza=imza;kutu.innerHTML=g.svg+'<div class="et-ipucu" hidden></div>';CIZIMLER.set(ad,g);
  });
}
function cizimPlanla(){if(typeof window==='undefined'||!window.requestAnimationFrame)return;window.cancelAnimationFrame(ZAMAN);ZAMAN=window.requestAnimationFrame(grafikleriCiz)}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('resize',cizimPlanla);
function ipucuGoster(kutu,i){
  const g=CIZIMLER.get(kutu.dataset.ykGrafik);if(!g||i<0||i>=g.xs.length)return;
  const svg=kutu.querySelector('svg'),tip=kutu.querySelector('.et-ipucu');if(!svg||!tip)return;
  kutu.dataset.i=String(i);
  const kural=svg.querySelector('.et-kural'),cx=g.xs[i];
  let hl=svg.querySelector('.et-vurgu-bant');
  if(!hl){hl=document.createElementNS('http://www.w3.org/2000/svg','rect');hl.setAttribute('class','et-vurgu-bant');svg.insertBefore(hl,svg.firstChild)}
  hl.setAttribute('x',r1(cx-g.bant/2));hl.setAttribute('width',r1(g.bant));hl.setAttribute('y',kural.getAttribute('y1'));hl.setAttribute('height',String(Number(kural.getAttribute('y2'))-Number(kural.getAttribute('y1'))));hl.setAttribute('visibility','visible');
  const p=g.ipucu[i];
  tip.innerHTML='<div class="et-ipucu-bas">'+kacis(p.bas)+'</div>'+p.satir.map(([c,ad,v])=>'<div class="et-ipucu-satir">'+(c?'<i class="et-renk" style="background:'+c+'"></i>':'')+'<span>'+kacis(ad)+'</span><b>'+kacis(v)+'</b></div>').join('');
  tip.hidden=false;
  const olcek=kutu.clientWidth/Number(svg.viewBox.baseVal.width||kutu.clientWidth),px=cx*olcek,py=g.ys[i]*olcek,bw=kutu.clientWidth,tw=tip.offsetWidth,th=tip.offsetHeight;
  let sol=px+14;if(sol+tw>bw)sol=px-tw-14;sol=Math.max(0,Math.min(sol,bw-tw));
  tip.style.left=sol+'px';tip.style.top=Math.max(0,Math.min(py-th/2,kutu.clientHeight-th))+'px';
}
function ipucuGizle(kutu){
  const tip=kutu.querySelector('.et-ipucu'),svg=kutu.querySelector('svg');if(tip)tip.hidden=true;delete kutu.dataset.i;
  svg?.querySelector('.et-vurgu-bant')?.setAttribute('visibility','hidden');
}
function enYakin(kutu,clientX){
  const g=CIZIMLER.get(kutu.dataset.ykGrafik),svg=kutu.querySelector('svg');if(!g||!svg)return -1;
  const r=svg.getBoundingClientRect(),vx=(clientX-r.left)*(Number(svg.viewBox.baseVal.width)||r.width)/(r.width||1);
  let en=0;g.xs.forEach((x,i)=>{if(Math.abs(x-vx)<Math.abs(g.xs[en]-vx))en=i});return en;
}

/* ---------------- page ---------------- */
let DURUM_YAZI='',ISLEM=false;
function durum(t){DURUM_YAZI=t||'';const el=document.getElementById('ykDurum');if(el)el.textContent=DURUM_YAZI}
const secim=(ad,deger,secenekler,etiket)=>'<div class="et-seg" role="group" aria-label="'+etiket+'"><span class="et-seg-label">'+etiket+'</span>'+
  secenekler.map(([v,yazi,kapali])=>'<button type="button" data-yk-'+ad+'="'+v+'" aria-pressed="'+(String(v)===String(deger))+'"'+(kapali?' disabled':'')+'>'+yazi+'</button>').join('')+'</div>';
const nokta=k=>'<i class="et-renk" style="background:'+RENK(k)+'"></i>';
const cip=(k,v)=>'<span class="yk-cip '+k+'">'+(v===undefined?DURUM_ADI[k]:DURUM_ADI[k]+' <b>'+sayi(v)+'</b>')+'</span>';
function defterEslesme(){
  const m=new Map();(D.ogr||[]).forEach((o,i)=>{if(!o||o.silindi)return;const a=anahtar(o.ad);m.set(a,m.has(a)?-1:i)});
  return ad=>{const i=m.get(anahtar(ad));return i===undefined||i<0?undefined:i};
}
// Presets of the range: the whole data, the last four weeks, the last week (from their Mondays).
function hazirAraliklar(v){
  const ilk=v.gunler[0],son=v.gunler[v.gunler.length-1];
  return [['tum','Tümü',ilk,son],['ay','Son 4 hafta',Math.max(ilk,pazartesi(son)-21),son],['hafta','Son hafta',Math.max(ilk,pazartesi(son)),son]];
}
function arac(v,m,st,salt){
  const ekle=salt?'':'<label class="et-dugme birincil">PDF ekle<input type="file" id="ykPdf" accept="application/pdf,.pdf" multiple hidden></label>';
  const ilk=v.gunler[0],son=v.gunler[v.gunler.length-1],hz=hazirAraliklar(v),secili=(hz.find(h=>h[2]===m.a&&h[3]===m.b)||[])[0];
  const tarih=(id,ad,g)=>'<label class="yk-tarih"><span class="et-seg-label">'+ad+'</span><input type="date" id="'+id+'" min="'+isoDan(ilk)+'" max="'+isoDan(son)+'" value="'+isoDan(g)+'" aria-label="'+ad+'"></label>';
  const siniflar=[...new Set(v.ogrenci.map(o=>o[1]))].sort(sinifSira),duzeyler=[...new Set(siniflar.map(sinifDuzeyi).filter(d=>d!==null))].sort((a,b)=>b-a);
  const kapsam='<label class="et-seg"><span class="et-seg-label">Öğrenciler</span><select id="ykKapsam" aria-label="Öğrenciler"><option value="">Tüm okul</option>'+
    duzeyler.map(d=>'<option value="d'+d+'"'+(m.kapsam==='d'+d?' selected':'')+'>'+kademeAdi(d)+'</option>').join('')+
    siniflar.map(s=>'<option value="'+kacis(s)+'"'+(m.kapsam===s?' selected':'')+'>'+kacis(s)+'</option>').join('')+'</select></label>';
  return '<div class="et-arac">'+ekle+'<div class="yk-aralik">'+tarih('ykBas','Başlangıç',m.a)+tarih('ykBit','Bitiş',m.b)+'</div>'+
    secim('aralik',secili||'',hz.map(h=>[h[0],h[1]]),'Tarih')+kapsam+'</div>';
}
function lejant(){
  return '<section class="yk-lejant" aria-label="Renkler">'+DURUMLAR.map(([k,ad,tanim])=>'<div class="yk-lejant-oge"><span class="yk-kare '+k+'"></span><span><b>'+ad+'</b> '+kacis(tanim)+'</span></div>').join('')+'</section>';
}
function cumle(m){
  const o=m.ozet,b=t=>'<b>'+t+'</b>';
  return kacis(kapsamAdi(m.kapsam))+' · '+gunAy(m.a)+' – '+gunAy(m.b)+' · '+b(sayi(m.gunler.length))+' okul günü · '+b(sayi(o.ogrenci))+' öğrenci. Gelme oranı '+b(yuzde(o.oran))+'. '+
    'Gelmedi '+b(sayi(o.say.gelmedi))+' kez ('+sayi(o.gelmeyen)+' öğrenci), geç geldi '+b(sayi(o.say.gec))+' kez ('+sayi(o.gecikan)+' öğrenci).';
}
function ozetKartlari(m){
  const o=m.ozet,kart=(k,baslik,buyuk,alt)=>'<div class="et-ozet-kart yk-kart'+(k?' '+k:'')+'"><span class="mini">'+(k?nokta(k):'')+baslik+'</span><strong>'+buyuk+'</strong><div class="et-ozet-alt"><span class="mini">'+alt+'</span></div></div>';
  return '<div class="et-ozet">'+kart('','Gelme oranı',yuzde(o.oran),sayi(o.say.geldi+o.say.gec)+' / '+sayi(o.toplam)+' öğrenci günü')+
    kart('gelmedi','Gelmedi',sayi(o.say.gelmedi),sayi(o.gelmeyen)+' öğrenci')+kart('gec','Geç geldi',sayi(o.say.gec),sayi(o.gecikan)+' öğrenci')+
    kart('raporlu','Raporlu',sayi(o.say.raporlu),sayi(m.kisiler.filter(k=>k.say.raporlu).length)+' öğrenci')+
    kart('diger','Diğer',sayi(o.say.diger),sayi(m.kisiler.filter(k=>k.say.diger).length)+' öğrenci')+'</div>';
}
function grafikPaneli(m,st){
  const per=st.tur==='hafta'?'Haftalara göre':'Günlere göre';
  const lej='<div class="et-lejant">'+SORUN.map(k=>'<span>'+nokta(k)+DURUM_ADI[k]+'</span>').join('')+'</div>';
  const ust='<div class="et-kart-bas"><h2>'+per+' · '+kacis(kapsamAdi(m.kapsam))+'</h2>'+lej+'</div><div class="et-arac">'+secim('tur',st.tur,[['hafta','Haftalık'],['gun','Günlük']],'Grafik')+
    (gruplarAl(m).length>1?secim('grup',st.grup,gruplarAl(m),'Göster'):'')+'</div>';
  if(st.grup==='birlikte')return '<section class="et-panel" id="ykGrafik">'+ust+'<div class="et-grafik orta" data-yk-grafik="donem" tabindex="0" role="img" aria-label="'+kacis(per+': gelmedi, geç geldi, raporlu ve diğer')+'"></div></section>';
  const gl=st.grup==='duzey'?m.duzeyler:m.subeler;
  return '<section class="et-panel" id="ykGrafik">'+ust+'<div class="yk-coklu">'+gl.map(g=>'<div class="yk-coklu-oge"><div class="yk-coklu-bas"><button type="button" class="et-ad" data-yk-kapsam="'+kacis(g.k)+'"><b>'+kacis(g.ad)+'</b></button><span class="mini">'+sayi(g.ogrenci)+' öğrenci · '+yuzde(g.oran)+'</span></div>'+
    '<div class="yk-coklu-sayi">'+SORUN.map(k=>'<span>'+nokta(k)+sayi(g.say[k])+'</span>').join('')+'</div>'+
    '<div class="et-grafik yk-mini" data-yk-grafik="grup:'+kacis(g.k)+'" tabindex="0" role="img" aria-label="'+kacis(g.ad+': '+per.toLowerCase())+'"></div></div>').join('')+'</div></section>';
}
// Rankings: who was absent most, and who came late most; each list has its own colour.
function siralamalar(m,st){
  const liste=(d,l,baslik)=>{const mx=Math.max(1,...l.map(o=>o.say[d])),sonK=d==='gec'?'sonGec':'sonGelmedi',yer=[];
    l.forEach((o,i)=>yer.push(i&&o.say[d]===l[i-1].say[d]?yer[i-1]:i+1));
    return '<section class="et-panel yk-sira"><div class="et-kart-bas"><h2>'+nokta(d)+baslik+'</h2><span class="mini">'+sayi(l.length)+' öğrenci</span></div>'+
      (l.length?'<ol class="yk-sira-liste">'+l.slice(0,12).map((o,i)=>'<li><button type="button" class="yk-sira-satir" data-yk-ogr="'+kacis(o.kim)+'" aria-pressed="'+(st.kim===o.kim)+'">'+
        '<span class="et-sira-no">'+sayi(yer[i])+'</span><span class="et-kim"><span>'+kacis(kisiAdi(o.ad))+'</span><span class="mini">'+kacis(o.sinif)+' · son: '+gunAy(o[sonK])+'</span></span>'+
        '<span class="yk-sira-iz"><i style="width:'+r1(o.say[d]/mx*100)+'%;background:'+RENK(d)+'"></i></span><b>'+sayi(o.say[d])+'</b></button></li>').join('')+'</ol>'
        :'<p class="mini">Bu tarihlerde kimse yok.</p>')+'</section>'};
  return '<div class="et-iki">'+liste('gelmedi',m.gelmeyenler,'En çok gelmeyenler')+liste('gec',m.gecikenler,'En çok geç gelenler')+'</div>';
}
// Classes: absence and lateness side by side; the bar is the whole of the class's days.
function subeTablosu(m){
  if(m.subeler.length<2&&m.duzeyler.length<2)return '';
  const bar=g=>'<span class="yk-bar" role="img" aria-label="'+kacis(DURUMLAR.map(([k,ad])=>ad+' '+sayi(g.say[k])).join(', '))+'">'+DURUMLAR.map(([k])=>g.say[k]?'<i class="'+k+'" style="width:'+r1(g.say[k]/g.toplam*100)+'%"></i>':'').join('')+'</span>';
  const satir=(g,ust)=>'<tr class="'+(ust?'yk-duzey':'')+(m.kapsam===g.k?' secili':'')+'" data-yk-kapsam="'+kacis(g.k)+'"><td><button type="button" class="et-ad" data-yk-kapsam="'+kacis(g.k)+'">'+kacis(g.ad)+'</button></td><td class="sayi et-dar-gizle">'+sayi(g.ogrenci)+'</td>'+
    '<td class="sayi et-dar-gizle">'+yuzde(g.oran)+'</td><td class="sayi">'+sayi(g.say.gelmedi)+'<span class="mini yk-ogr-say"> · '+sayi(g.gelmeyen)+' öğr.</span></td><td class="sayi">'+sayi(g.say.gec)+'<span class="mini yk-ogr-say"> · '+sayi(g.gecikan)+' öğr.</span></td>'+
    '<td class="sayi et-dar-gizle">'+sayi(g.say.raporlu)+'</td><td class="sayi et-dar-gizle">'+sayi(g.say.diger)+'</td><td class="yk-bar-hucre et-dar-gizle">'+bar(g)+'</td></tr>';
  const satirlar=m.duzeyler.map(d=>{const l=m.subeler.filter(s=>'d'+sinifDuzeyi(s.k)===d.k);return (m.duzeyler.length>1?satir(d,true):'')+l.map(s=>satir(s,false)).join('')}).join('')+
    m.subeler.filter(s=>sinifDuzeyi(s.k)===null).map(s=>satir(s,false)).join('');
  return '<section class="et-panel" id="ykSubeler"><div class="et-kart-bas"><h2>Şubeler</h2></div><div class="et-tablo-kutu yk-kisa"><table class="et-tablo yk-sube-tablo"><thead><tr><th scope="col">Şube</th><th scope="col" class="et-dar-gizle">Öğrenci</th><th scope="col" class="et-dar-gizle">Gelme oranı</th>'+
    '<th scope="col">'+nokta('gelmedi')+' Gelmedi</th><th scope="col">'+nokta('gec')+' Geç geldi</th><th scope="col" class="et-dar-gizle">'+nokta('raporlu')+' Raporlu</th><th scope="col" class="et-dar-gizle">'+nokta('diger')+' Diğer</th><th scope="col" class="et-dar-gizle">Günlerin dağılımı</th></tr></thead><tbody>'+satirlar+'</tbody></table></div></section>';
}
// The day: who was absent, late or excused, and which of them rarely is.
function gunPaneli(m,st){
  const g=st.gun,l=gunDetayi(m,g),i=m.gunler.indexOf(g);
  const sec='<div class="yk-gun-sec"><button type="button" class="et-dugme" data-yk-gun="'+(m.gunler[i-1]??'')+'"'+(i>0?'':' disabled')+' aria-label="Önceki gün">‹</button>'+
    '<select id="ykGunSec" aria-label="Gün">'+m.gunler.slice().reverse().map(x=>'<option value="'+x+'"'+(x===g?' selected':'')+'>'+gunAdli(x)+'</option>').join('')+'</select>'+
    '<button type="button" class="et-dugme" data-yk-gun="'+(m.gunler[i+1]??'')+'"'+(i<m.gunler.length-1?'':' disabled')+' aria-label="Sonraki gün">›</button></div>';
  const kisi=(x,d)=>'<li><button type="button" class="yk-gun-satir" data-yk-ogr="'+kacis(x.o.kim)+'"><span class="et-kim"><span>'+kacis(kisiAdi(x.o.ad))+'</span><span class="mini">'+kacis(x.o.sinif)+
    ((d==='gelmedi'||d==='gec')&&x.once?' · önceki '+sayi(x.once)+' günde '+sayi(x.ayni)+' kez':'')+'</span></span>'+(x.beklenmedik?'<span class="yk-beklenmedik">Beklenmedik</span>':'<span></span>')+dersSeridi(x.kod)+'</button></li>';
  const grup=d=>l[d].length?'<div class="yk-gun-grup"><h3>'+nokta(d)+DURUM_ADI[d]+' <span class="mini">('+sayi(l[d].length)+')</span></h3><ul>'+l[d].map(x=>kisi(x,d)).join('')+'</ul></div>':'';
  const hic=SORUN.every(d=>!l[d].length);
  return '<section class="et-panel" id="ykGun"><div class="et-kart-bas"><h2>Gün · '+gunAdli(g)+'</h2>'+sec+'</div>'+
    (m.kismi.has(g)?'<p class="yk-not">Rapor bu gün bitmeden alındı; yoklaması eksik olabilir.</p>':'')+
    '<div class="yk-cipler">'+DURUMLAR.map(([k])=>cip(k,l[k].length)).join('')+'</div>'+
    (hic?'<p class="mini">Bu gün herkes geldi.</p>':'<div class="yk-gun-gruplar">'+SORUN.map(grup).join('')+'</div>')+'</section>';
}
function tamPaneli(m){
  return '<section class="et-panel" id="ykTam"><div class="et-kart-bas"><h2>'+nokta('geldi')+'Her gün gelenler</h2><span class="mini">'+sayi(m.tam.length)+' / '+sayi(m.kisiler.length)+' öğrenci</span></div>'+
    (m.tam.length?'<div class="yk-adlar">'+m.tam.map(o=>'<button type="button" class="yk-ad-cip" data-yk-ogr="'+kacis(o.kim)+'">'+kacis(kisiAdi(o.ad))+'<span class="mini">'+kacis(o.sinif)+'</span></button>').join('')+'</div>':'<p class="mini">Bu tarihlerde her gün gelen yok.</p>')+'</section>';
}
// Çizelge: a row per student, a square per day, coloured by the day's state.
function cizelge(m,st){
  const gs=m.gunler,ay=g=>new Date(g*864e5).getUTCMonth();
  const bas='<div class="yk-cz-satir yk-cz-bas"><span class="yk-cz-ad"></span><span class="yk-cz-gunler">'+gs.map((g,i)=>'<span class="yk-cz-gun'+(i&&pazartesi(g)!==pazartesi(gs[i-1])?' hafta':'')+(m.kismi.has(g)?' kismi':'')+'"'+
    (!i||ay(g)!==ay(gs[i-1])?' data-ay="'+AY[ay(g)]+'"':'')+'>'+new Date(g*864e5).getUTCDate()+'</span>').join('')+'</span></div>';
  let onceki=null;
  const satirlar=m.kisiler.map(o=>{const ayrac=!m.kapsam||m.kapsam[0]==='d'?(o.sinif!==onceki?'<div class="yk-cz-sinif">'+kacis(o.sinif)+'</div>':''):'';onceki=o.sinif;
    return ayrac+'<div class="yk-cz-satir'+(st.kim===o.kim?' secili':'')+'"><button type="button" class="yk-cz-ad" data-yk-ogr="'+kacis(o.kim)+'">'+kacis(kisiAdi(o.ad))+'</button><span class="yk-cz-gunler">'+
      gs.map((g,i)=>{const x=o.gunu.get(g),h=i&&pazartesi(g)!==pazartesi(gs[i-1])?' hafta':'';
        return x?'<i class="yk-h '+x.d+h+'" title="'+kacis(gunAdli(g)+' · '+DURUM_ADI[x.d]+(x.d==='geldi'&&!/[AGMR]/.test(x.kod)?'':' · '+dersOzeti(x.kod)))+'"></i>':'<i class="yk-h yok'+h+'"></i>'}).join('')+'</span></div>'}).join('');
  return '<section class="et-panel" id="ykCizelge"><div class="et-kart-bas"><h2>Çizelge · '+kacis(kapsamAdi(m.kapsam))+'</h2><div class="et-lejant">'+DURUMLAR.map(([k,ad])=>'<span>'+nokta(k)+ad+'</span>').join('')+'</div></div>'+
    '<div class="yk-cz" role="table" aria-label="Öğrencilerin günleri">'+bas+satirlar+'</div></section>';
}
const SUTUNLAR=[['ad','Öğrenci'],['sinif','Şube'],['oran','Gelme oranı'],['gelmedi','Gelmedi'],['gec','Geç geldi'],['raporlu','Raporlu'],['diger','Diğer'],['son','Son günler']];
function tablo(m,st){
  const sira=SUTUNLAR.some(([k])=>k===EK.ykSira)&&EK.ykSira!=='son'?EK.ykSira:'gelmedi',yonu=EK.ykSiraYon==='artan'?1:-1;
  const deger=(o,c)=>c==='ad'?kisiAdi(o.ad):c==='sinif'?o.sinif:c==='oran'?o.oran:o.say[c];
  const liste=m.kisiler.slice().sort((a,b)=>{const x=deger(a,sira),y=deger(b,sira);const f=typeof x==='number'?x-y:String(x).localeCompare(String(y),'tr');return f*yonu||b.say.gelmedi-a.say.gelmedi||b.say.gec-a.say.gec||a.ad.localeCompare(b.ad,'tr')});
  const ara=anahtar(EK.ykAra||''),gor=o=>!ara||anahtar(o.ad).includes(ara),sonN=10;
  const bas=SUTUNLAR.map(([k,ad])=>{const gizli=['sinif','oran','raporlu','diger','son'].includes(k)?' class="et-dar-gizle"':'',yazi=(['gelmedi','gec','raporlu','diger'].includes(k)?nokta(k):'')+ad;
    return k==='son'?'<th scope="col"'+gizli+'>'+yazi+'</th>':'<th scope="col"'+gizli+' aria-sort="'+(sira===k?(yonu>0?'ascending':'descending'):'none')+'"><button type="button" data-yk-sira="'+k+'">'+yazi+'</button></th>'}).join('');
  const satir=o=>{const son=m.gunler.slice(-sonN).map(g=>{const x=o.gunu.get(g);return '<i class="yk-h '+(x?x.d:'yok')+'"></i>'}).join('');
    return '<tr data-yk-ogr="'+kacis(o.kim)+'" data-ara="'+kacis(anahtar(o.ad))+'"'+(st.kim===o.kim?' class="secili"':'')+(gor(o)?'':' hidden')+'>'+
      '<td><button type="button" class="et-ad" data-yk-ogr="'+kacis(o.kim)+'">'+kacis(kisiAdi(o.ad))+'</button></td><td class="et-dar-gizle">'+kacis(o.sinif)+'</td><td class="sayi et-dar-gizle">'+yuzde(o.oran)+'</td>'+
      ['gelmedi','gec','raporlu','diger'].map(k=>'<td class="sayi'+(['raporlu','diger'].includes(k)?' et-dar-gizle':'')+(o.say[k]?' yk-var '+k:'')+'">'+sayi(o.say[k])+'</td>').join('')+
      '<td class="et-dar-gizle"><span class="yk-son">'+son+'</span></td></tr>'};
  const gorunen=m.kisiler.filter(gor).length;
  return '<div class="et-filtre"><input type="search" id="ykAra" placeholder="Öğrenci ara" aria-label="Öğrenci ara" value="'+kacis(EK.ykAra||'')+'">'+
    '<span class="mini" id="ykSayac">'+(gorunen===m.kisiler.length?sayi(m.kisiler.length)+' öğrenci':sayi(gorunen)+' / '+sayi(m.kisiler.length)+' öğrenci')+'</span></div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo yk-tablo"><thead><tr>'+bas+'</tr></thead><tbody>'+liste.map(satir).join('')+'</tbody></table></div>';
}
// The student: their counts, a calendar of the range, the weekdays of their absences and lateness,
// and each day that was not a plain Geldi with its lessons.
function kisiKarti(m,st,es){
  const o=m.kisiler.find(x=>x.kim===st.kim);if(!o)return '<p class="mini">Bir öğrenci seçin.</p>';
  const si=es(o.ad),ad=kisiAdi(o.ad);
  const sayilar='<div class="yk-kisi-sayilar"><div><span class="mini">Gelme oranı</span><strong>'+yuzde(o.oran)+'</strong><span class="mini">'+sayi(o.say.geldi+o.say.gec)+' / '+sayi(o.toplam)+' gün</span></div>'+
    DURUMLAR.slice(1).map(([k,a])=>'<div class="'+k+'"><span class="mini">'+nokta(k)+a+'</span><strong>'+sayi(o.say[k])+'</strong></div>').join('')+'</div>';
  const haftalar=[...new Set(o.liste.map(x=>pazartesi(x.g)))];
  const takvim='<div class="yk-takvim" role="table" aria-label="Takvim"><div class="yk-tk-satir yk-tk-bas"><span></span>'+GUN_KISA.slice(0,5).map(g=>'<span>'+g+'</span>').join('')+'</div>'+
    haftalar.map(h=>'<div class="yk-tk-satir"><span class="mini">'+gunAy(h)+'</span>'+[0,1,2,3,4].map(w=>{const g=h+w,x=o.gunu.get(g);
      return x?'<span class="yk-tk '+x.d+(m.kismi.has(g)?' kismi':'')+'" title="'+kacis(gunAdli(g)+' · '+DURUM_ADI[x.d]+' · '+dersOzeti(x.kod))+'">'+new Date(g*864e5).getUTCDate()+'</span>':'<span class="yk-tk yok"></span>'}).join('')+'</div>').join('')+'</div>';
  const gunluk=d=>[0,1,2,3,4].map(w=>o.liste.filter(x=>x.d===d&&haftaGunu(x.g)===w).length);
  const hafta=['gelmedi','gec'].map(d=>{const v=gunluk(d);return '<div class="yk-hg-satir"><span class="mini">'+nokta(d)+DURUM_ADI[d]+'</span>'+v.map(n=>'<span class="yk-hg '+(n?d:'')+'">'+(n?sayi(n):'·')+'</span>').join('')+'</div>'}).join('');
  const olaylar=o.liste.filter(x=>x.d!=='geldi'||/[AGMR]/.test(x.kod)).slice().reverse();
  return '<div class="et-kisi-bas"><h3>'+(si===undefined?kacis(ad):ogrAdDugmesi(si,ad))+'</h3><span class="mini">'+kacis(o.sinif)+' · '+gunAy(o.liste[0].g)+' – '+gunAy(o.liste[o.liste.length-1].g)+'</span></div>'+sayilar+takvim+
    '<div class="yk-hg-tablo"><div class="yk-hg-satir yk-tk-bas"><span></span>'+GUN_KISA.slice(0,5).map(g=>'<span>'+g+'</span>').join('')+'</div>'+hafta+'</div>'+
    (olaylar.length?'<div class="yk-olaylar"><span class="mini">Tam gün gelmediği günler</span><ul>'+olaylar.slice(0,30).map(x=>'<li><span class="yk-olay-gun">'+gunAdli(x.g)+'</span>'+cip(x.d)+dersSeridi(x.kod)+'<span class="mini yk-olay-ders">'+kacis(dersOzeti(x.kod))+'</span></li>').join('')+'</ul></div>':'');
}
function kaynaklar(v,salt){
  const ks=v.kaynak.slice().reverse();
  return '<section class="et-panel" id="ykRaporlar"><div class="et-kart-bas"><h2>Eklenen raporlar</h2>'+(salt?'':'<button type="button" class="et-dugme" id="ykSil">Yoklama verisini sil</button>')+'</div>'+
    '<div class="et-kaydir"><table class="et-kaynak"><thead><tr><th>Tarih aralığı</th><th>Öğrenci günü</th><th>Eklendi</th></tr></thead><tbody>'+
    ks.map(k=>'<tr><td>'+tarihUzun(k.bas)+' – '+tarihUzun(k.bit)+'</td><td>'+sayi(k.n)+'</td><td>'+new Date(k.ts).toLocaleDateString('tr-TR')+'</td></tr>').join('')+'</tbody></table></div></section>';
}
function icerik(){
  const salt=izleme(),{veri,hata}=oku();
  const ekle=salt?'':'<label class="et-dugme birincil">PDF ekle<input type="file" id="ykPdf" accept="application/pdf,.pdf" multiple hidden></label>';
  const durumSatiri='<p id="ykDurum" role="status" aria-live="polite">'+kacis(DURUM_YAZI)+'</p>';
  if(hata)return '<header class="et-bas"><h1 class="et-baslik">Yoklama</h1></header><p class="et-uyari">'+kacis(hata)+'</p>'+durumSatiri;
  if(!veri)return '<header class="et-bas"><h1 class="et-baslik">Yoklama</h1></header><div class="et-arac">'+ekle+'</div>'+durumSatiri+
    '<section class="et-panel et-bos"><b>Henüz yoklama raporu yok</b>'+(salt?'':'<p>Okulun “Yoklama Raporu” PDF’ini “PDF ekle” ile ekleyin.</p>')+'</section>';
  const m=modelAl(veri);
  if(m.bos)return '<header class="et-bas"><h1 class="et-baslik">Yoklama</h1></header>'+arac(veri,m,{},salt)+durumSatiri+'<section class="et-panel et-bos"><b>Bu tarihlerde '+kacis(kapsamAdi(m.kapsam))+' için yoklama yok</b></section>'+kaynaklar(veri,salt);
  const st=durumAl(m),es=defterEslesme();
  cizimPlanla();
  return '<header class="et-bas"><h1 class="et-baslik">Yoklama</h1><p class="et-cumle">'+cumle(m)+'</p></header>'+arac(veri,m,st,salt)+durumSatiri+lejant()+ozetKartlari(m)+
    grafikPaneli(m,st)+siralamalar(m,st)+subeTablosu(m)+'<div class="et-iki yk-gun-iki">'+gunPaneli(m,st)+tamPaneli(m)+'</div>'+cizelge(m,st)+
    '<h2 class="et-bolum" id="ykOgrenciler">Öğrenciler</h2><div class="et-bolunmus"><section class="et-panel" id="ykTablo"><div class="et-kart-bas"><h2>Tüm öğrenciler · '+kacis(kapsamAdi(m.kapsam))+'</h2></div>'+tablo(m,st)+'</section>'+
    '<section class="et-panel et-kisi" id="ykKisi">'+kisiKarti(m,st,es)+'</section></div>'+kaynaklar(veri,salt);
}
function gorunum(){
  if(!rehberMi())return '<div class="baslik"><h1>Yoklama</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  return '<div id="ykKok">'+icerik()+'</div>';
}
function yenidenCiz(odak){
  const kok=document.getElementById('ykKok');if(!kok){ciz();return}
  kok.innerHTML=icerik();cizimPlanla();
  if(odak){const el=document.querySelector(odak);if(el)el.focus()}
}
async function pdfEkle(files){
  const okunan=[],hatalar=[],defter=D;let atlanan=0,bilinmeyen=0;
  for(const file of files){
    durum('PDF okunuyor: '+file.name);
    try{const {pages}=await denemePdfSayfalari(file);const r=pdfCoz(pages);atlanan+=r.atlanan;bilinmeyen+=r.bilinmeyen;okunan.push(r)}catch(e){hatalar.push(file.name+': '+e.message)}
  }
  if(D!==defter||!rehberMi())throw new Error('Oturum değişti.');
  if(okunan.length)await raporEkle(okunan);
  const ilk=gunNo(ILK_GUN_ISO),once=okunan.some(r=>r.bas<ilk);
  return (okunan.length?'Eklendi: '+okunan.map(r=>tarihUzun(Math.max(r.bas,ilk))+' – '+tarihUzun(r.bit)+' · '+sayi(r.ogrenciler.length)+' öğrenci').join(', ')+'.':'Rapor eklenmedi.')+
    (once?' '+tarihUzun(ilk)+' öncesi alınmadı.':'')+(atlanan?' Okunamayan '+sayi(atlanan)+' satır atlandı.':'')+(bilinmeyen?' Tanınmayan '+sayi(bilinmeyen)+' ders boş sayıldı.':'')+(hatalar.length?' Okunamayan: '+hatalar.join(' · '):'');
}
const etkin=()=>EK.sekme==='yoklama'&&rehberMi();
function ogrenciSec(kim,uzak){
  EK.ykOgr=kim;yenidenCiz();const kart=document.getElementById('ykKisi');
  if(kart&&(uzak||getComputedStyle(kart).position!=='sticky'))kart.scrollIntoView({block:'nearest',behavior:'smooth'});
}
document.addEventListener('click',async ev=>{
  if(!etkin())return;
  const el=ev.target.closest?.('[data-yk-aralik],[data-yk-tur],[data-yk-grup],[data-yk-kapsam],[data-yk-ogr],[data-yk-sira],[data-yk-gun],#ykSil');if(!el||el.disabled)return;
  if(el.dataset.ykAralik){const {veri}=oku();if(!veri)return;const h=hazirAraliklar(veri).find(x=>x[0]===el.dataset.ykAralik);if(!h)return;EK.ykBas=h[2];EK.ykBit=h[3];yenidenCiz('[data-yk-aralik="'+h[0]+'"]');return}
  if(el.dataset.ykTur){EK.ykTur=el.dataset.ykTur;yenidenCiz('[data-yk-tur="'+EK.ykTur+'"]');return}
  if(el.dataset.ykGrup){EK.ykGrup=el.dataset.ykGrup;yenidenCiz('[data-yk-grup="'+EK.ykGrup+'"]');return}
  if(el.dataset.ykKapsam!==undefined){EK.ykKapsam=el.dataset.ykKapsam;EK.ykGrup='birlikte';yenidenCiz('#ykKapsam');document.getElementById('ykKok')?.scrollIntoView({block:'start',behavior:'smooth'});return}
  if(el.dataset.ykGun!==undefined){const g=Number(el.dataset.ykGun);if(!el.dataset.ykGun||!Number.isSafeInteger(g))return;EK.ykGun=g;yenidenCiz('[data-yk-gun="'+el.dataset.ykGun+'"]');return}
  if(el.dataset.ykSira){const k=el.dataset.ykSira;if(EK.ykSira===k)EK.ykSiraYon=EK.ykSiraYon==='artan'?'azalan':'artan';else{EK.ykSira=k;EK.ykSiraYon=['ad','sinif','oran'].includes(k)?'artan':'azalan'}
    yenidenCiz('[data-yk-sira="'+k+'"]');return}
  if(el.dataset.ykOgr){ogrenciSec(el.dataset.ykOgr,!el.closest('#ykTablo'));return}
  if(el.id==='ykSil'){
    if(ISLEM||izleme())return;
    if(!confirm('Kayıtlı bütün yoklama verisi silinsin mi? Raporları yeniden ekleyebilirsiniz.'))return;
    ISLEM=true;try{await sil();durum('Yoklama verisi silindi.')}catch(e){durum(e.message)}finally{ISLEM=false}
    yenidenCiz();
  }
});
document.addEventListener('change',async ev=>{
  if(!etkin())return;const el=ev.target;
  if(el.id==='ykPdf'){
    const files=Array.from(el.files||[]);el.value='';if(!files.length||ISLEM)return;
    if(files.length>10){durum('Bir defada en fazla 10 PDF seçin.');return}
    ISLEM=true;try{durum(await pdfEkle(files))}catch(e){durum('PDF eklenemedi: '+e.message)}finally{ISLEM=false}
    yenidenCiz();return;
  }
  if(el.id==='ykBas'||el.id==='ykBit'){const g=el.value?gunNo(el.value):null;if(!Number.isSafeInteger(g))return;
    const {veri}=oku();if(!veri)return;const m=modelAl(veri);EK.ykBas=el.id==='ykBas'?g:m.a;EK.ykBit=el.id==='ykBit'?g:m.b;yenidenCiz('#'+el.id);return}
  if(el.id==='ykKapsam'){EK.ykKapsam=el.value;EK.ykGrup='birlikte';yenidenCiz('#ykKapsam');return}
  if(el.id==='ykGunSec'){EK.ykGun=Number(el.value);yenidenCiz('#ykGunSec')}
});
document.addEventListener('input',ev=>{if(etkin()&&ev.target.id==='ykAra'){EK.ykAra=ev.target.value;filtrele()}});
function filtrele(){
  const ara=anahtar(EK.ykAra||'');let n=0,t=0;
  document.querySelectorAll('.yk-tablo tbody tr').forEach(tr=>{t++;const g=!ara||tr.dataset.ara.includes(ara);tr.hidden=!g;if(g)n++});
  const s=document.getElementById('ykSayac');if(s)s.textContent=n===t?sayi(t)+' öğrenci':sayi(n)+' / '+sayi(t)+' öğrenci';
}
function imlecGoster(ev){
  if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-yk-grafik]');if(!kutu)return;
  ipucuGoster(kutu,enYakin(kutu,ev.clientX));
}
document.addEventListener('pointermove',imlecGoster);
document.addEventListener('pointerdown',imlecGoster);
document.addEventListener('pointerout',ev=>{if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-yk-grafik]');if(kutu&&!kutu.contains(ev.relatedTarget)&&document.activeElement!==kutu)ipucuGizle(kutu)});
document.addEventListener('keydown',ev=>{
  if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-yk-grafik]');if(!kutu||!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(ev.key))return;
  const g=CIZIMLER.get(kutu.dataset.ykGrafik);if(!g)return;ev.preventDefault();
  if(ev.key==='Escape'){ipucuGizle(kutu);return}
  const i=kutu.dataset.i===undefined?g.xs.length-1:Number(kutu.dataset.i);
  ipucuGoster(kutu,ev.key==='Home'?0:ev.key==='End'?g.xs.length-1:Math.max(0,Math.min(g.xs.length-1,i+(ev.key==='ArrowLeft'?-1:1))));
});
document.addEventListener('focusout',ev=>{const kutu=ev.target.closest?.('.et-grafik[data-yk-grafik]');if(kutu)ipucuGizle(kutu)});
return {pdfCoz,gunDurumu,dersOzeti,dogrula,oku,ac,paketle,birlestir,raporEkle,sil,model,gunDetayi,cubukGrafik,gorunum,icerik,grafikleriCiz,CIZIMLER,UST_SINIR,ILK_GUN_ISO,
  get onbellek(){return ONBELLEK}};
})();
function gorunumYoklama(){return YOKLAMA.gorunum()}
