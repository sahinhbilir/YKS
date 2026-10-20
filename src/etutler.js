// Embedded in index.html by scripts/embed-etutler.cjs. No student data belongs here.
// Etütler (teacher only): the school's "Tarih Bazlı Etüt Raporu" PDFs, read in the browser and
// drawn as a stock-style board: etüts over time, per subject, distinct students, and each
// student's rise or fall between two windows of full weeks. A compact copy of the rows is kept in
// the teacher notebook as D.etut, so it travels with the teacher's cloud backup; student packets
// are built from a field whitelist and never carry it. Nothing is uploaded. See docs/etutler.md.
const ETUT = (() => {
const SURUM=1, UST_SINIR=300000, EN_COK_SATIR=15000, EN_COK_KAYNAK=60, ARALIKLAR=[1,2,4], PENCERELER=[...ARALIKLAR,'sec'];
// A teacher's places on each of their etüt days: the Etüt planı's four students.
const GUNLUK_YER=4;
const GUN_ADI=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
// School rules on who may stay for etüts: 12. sınıflar have none on Fridays from 14 Eylül 2026
// (gun: 0 = Pazartesi … 4 = Cuma). In a grade's view those days are not etüt days.
const KISITLAR=[{duzey:12,gun:4,bas:'2026-09-14'}];
// The grade of a class ("12/A" → 12), or null.
const sinifDuzeyi=c=>{const m=/^(\d{1,2})\s*\//.exec(String(c||'').trim());return m?Number(m[1]):null};
const kademeAdi=d=>d+'. sınıflar';
const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
// Report branches ("MATEMATİK TYT", "FİZİK 1", "Kimya"…) are grouped into one subject each.
const DERSLER=[[/^MATEMAT/u,'Matematik'],[/^GEOMETR/u,'Geometri'],[/^FİZİK/u,'Fizik'],[/^KİMYA/u,'Kimya'],[/^BİYOLOJ/u,'Biyoloji'],
  [/^(TÜRKÇE|TÜRK DİLİ|EDEBİYAT|DİL VE ANLATIM)/u,'Türkçe'],[/^COĞRAFYA/u,'Coğrafya'],[/(TARİH|İNKILAP)/u,'Tarih'],
  [/^(FELSEFE|MANTIK|PSİKOLOJİ|SOSYOLOJİ)/u,'Felsefe'],[/^DİN/u,'Din Kültürü']];
const RENK_SIRA=['Matematik','Kimya','Fizik','Türkçe','Biyoloji','Geometri','Coğrafya','Tarih','Felsefe','Din Kültürü'];
const DURUM={Rising:'Artıyor',Falling:'Azalıyor',Stopped:'Bıraktı',New:'Yeni',Returned:'Döndü',Steady:'Aynı',Quiet:'Etüt yok'};

/* ---------------- small helpers ---------------- */
const anahtar=s=>denemeAdAnahtari(s);
const kisa=(s,n)=>String(s==null?'':s).replace(/\s+/g,' ').trim().slice(0,n);
const kisiAdi=s=>String(s||'').toLocaleLowerCase('tr-TR').split(' ').map(w=>w?w[0].toLocaleUpperCase('tr-TR')+w.slice(1):w).join(' ');
function dersAdi(brans){
  const b=anahtar(brans);for(const [re,ad] of DERSLER)if(re.test(b))return ad;
  return kisiAdi(kisa(brans,40))||'Diğer';
}
const dersRengi=d=>{const i=RENK_SIRA.indexOf(d);return i>=0&&i<8?'var(--e-c'+(i+1)+')':i===8?'var(--e-fg2)':'var(--e-chart-muted)'};
const sayi=n=>Number(n).toLocaleString('tr-TR');
const isaretli=n=>(n>0?'+':n<0?'−':'')+sayi(Math.abs(n));
const yuzde=p=>'%'+Math.round(Math.abs(p)*100);
const gunAy=g=>{const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]};
const tarihUzun=g=>{const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]+' '+t.getUTCFullYear()};
function aralikYazi(a,b){
  const A=new Date(a*864e5),B=new Date(b*864e5);
  return A.getUTCMonth()===B.getUTCMonth()?A.getUTCDate()+'–'+gunAy(b):gunAy(a)+' – '+gunAy(b);
}
const haftaYazi=s=>s+' hafta';
// The two sides of a comparison: "Önceki 2H" / "Son 2H", or the chosen weeks in Seç.
const oncekiAdi=(m,s)=>s==='sec'?gunAy(m.pencere.sec.once[0])+' haftası':'Önceki '+s+'H';
const sonAdi=(m,s)=>s==='sec'?gunAy(m.pencere.sec.son[0])+' haftası':'Son '+s+'H';
const karsiYazi=(m,s)=>s==='sec'?gunAy(m.pencere.sec.once[0])+' haftası → '+gunAy(m.pencere.sec.son[0])+' haftası':s===1?'Geçen hafta, önceki haftaya göre':'Son '+s+' hafta, önceki '+s+' haftaya göre';
const yon=v=>v>0?'yukari':v<0?'asagi':'esit';
const ok=v=>v>0?'▲':v<0?'▼':'';
const r1=x=>Math.round(x*10)/10;
const gunDan=t=>{const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(t||'');return m?gunNo(m[3]+'-'+m[2]+'-'+m[1]):null};

/* ---------------- PDF text → rows ---------------- */
// sayfalar: pdf.js text items per page {s,x,y,w,h,z} (y from the page bottom). Each day of the
// report starts with its date, then a table: # · Branş · Öğretmen · Öğrenci · Şube · Derslik ·
// Saat · Süre. Long teacher or student names wrap onto two lines around the row's number.
const BASLIKLAR={'#':'no','Branş':'brans','Öğretmen Ad Soyad':'ogretmen','Öğrenci Ad Soyad':'ogrenci','Şube':'sube','Derslik':'derslik','Saat':'saat','Süre':'sure'};
function pdfCoz(sayfalar){
  let rapor=false,bas=null,bit=null,tarih=null,kolon=null,atlanan=0;
  const satirlar=[];
  for(const items of sayfalar){
    const it=(items||[]).filter(i=>i&&typeof i.s==='string'&&i.s.trim()&&Number.isFinite(i.x)&&Number.isFinite(i.y))
      .map(i=>({s:i.s.trim().replace(/\s+/g,' '),x:i.x,y:i.y,w:Number.isFinite(i.w)?i.w:0}));
    for(const o of it){
      if(/Etüt Raporu/iu.test(o.s))rapor=true;
      const m=/(\d{2}\.\d{2}\.\d{4})\s*\/\s*(\d{2}\.\d{2}\.\d{4})/.exec(o.s);
      if(m&&bas===null){bas=gunDan(m[1]);bit=gunDan(m[2])}
    }
    const bas_=it.filter(o=>BASLIKLAR[o.s]);
    const basliklar=[];
    for(const o of bas_){const satir=basliklar.find(b=>Math.abs(b.y-o.y)<1.5);if(satir)satir.o[BASLIKLAR[o.s]]=o;else basliklar.push({y:o.y,o:{[BASLIKLAR[o.s]]:o}})}
    const tam=basliklar.filter(b=>b.o.brans&&b.o.ogrenci&&b.o.sube).sort((a,b)=>b.y-a.y);
    if(tam.length){const o=tam[0].o;kolon={brans:o.brans.x,ogretmen:(o.ogretmen||o.ogrenci).x,ogrenci:o.ogrenci.x,sube:o.sube,
      orta:['sube','derslik','saat','sure'].filter(k=>o[k]).map(k=>[k,o[k].x+o[k].w/2])}}
    if(!kolon)continue;
    const ustSinir=y=>{const b=tam.filter(t=>t.y>y).sort((a,b)=>a.y-b.y)[0];return b?b.y:Infinity};
    const tarihler=it.filter(o=>/^\d{2}\.\d{2}\.\d{4}$/.test(o.s)).map(o=>({y:o.y,g:gunDan(o.s)})).filter(t=>t.g!==null).sort((a,b)=>b.y-a.y);
    const capalar=it.filter(o=>/^\d{1,4}$/.test(o.s)&&o.x+o.w<kolon.brans-2&&(!tam.length||tam.some(t=>t.y>o.y+2))).sort((a,b)=>b.y-a.y);
    capalar.forEach((a,i)=>{
      const yuk=i>0?capalar[i-1].y:ustSinir(a.y),alt=i<capalar.length-1?capalar[i+1].y:-Infinity;
      const ust=Math.min(a.y+9,(yuk+a.y)/2,ustSinir(a.y)-1),dip=Math.max(a.y-9,(alt+a.y)/2);
      const bant=it.filter(o=>o!==a&&o.y<ust&&o.y>dip&&o.x>=kolon.brans-2&&!/^\d{2}\.\d{2}\.\d{4}$/.test(o.s));
      const hucre={brans:[],ogretmen:[],ogrenci:[],sube:[],derslik:[],saat:[],sure:[]};
      for(const o of bant){
        let k;
        if(o.x<kolon.ogretmen-2)k='brans';else if(o.x<kolon.ogrenci-2)k='ogretmen';else if(o.x<kolon.sube.x-10)k='ogrenci';
        else{const c=o.x+o.w/2;k=kolon.orta.reduce((m,[ad,x])=>Math.abs(x-c)<Math.abs(m[1]-c)?[ad,x]:m,kolon.orta[0])[0]}
        hucre[k].push(o);
      }
      const yazi=k=>hucre[k].sort((p,q)=>q.y-p.y||p.x-q.x).map(o=>o.s).join(' ').replace(/\s+/g,' ').trim();
      const ust_=tarihler.filter(t=>t.y>a.y).pop();if(ust_)tarih=ust_.g;
      const ogr=yazi('ogrenci'),brans=yazi('brans');
      if(tarih===null||!ogr||!brans){atlanan++;return}
      const subeYazi=yazi('sube'),sm=/(\d{1,2})\s*\/\s*([A-ZÇĞİÖŞÜ]{1,3})\b/u.exec(subeYazi);
      const sa=/(\d{1,2}):(\d{2})/.exec(yazi('saat')),su=/(\d{1,3})/.exec(yazi('sure'));
      satirlar.push({g:tarih,brans:kisa(brans,60),ogretmen:kisa(yazi('ogretmen'),80),ad:kisa(ogr,80),
        sinif:sm?sm[1]+'/'+sm[2]:kisa(subeYazi,24),saat:sa&&+sa[1]<24&&+sa[2]<60?(+sa[1])*60+(+sa[2]):null,sure:su?Math.min(600,+su[1]):null});
    });
    const sonTarih=tarihler.length?tarihler[tarihler.length-1]:null;if(sonTarih&&!capalar.some(a=>a.y<sonTarih.y))tarih=sonTarih.g;
  }
  if(!kolon||(!rapor&&!satirlar.length))throw new Error('Bu PDF okulun “Tarih Bazlı Etüt Raporu” gibi görünmüyor.');
  if(!satirlar.length)throw new Error('PDF’de etüt satırı bulunamadı.');
  const gs=satirlar.map(s=>s.g),en=Math.min(...gs),son=Math.max(...gs);
  if(bas===null||bit===null||bas>bit||en<bas||son>bit){bas=en;bit=son}
  return {bas,bit,satirlar,atlanan};
}

/* ---------------- notebook storage ---------------- */
// D.etut = {surum, ts, kaynak:[{bas,bit,n,ts}], brans:[], ogretmen:[], ogrenci:[[ad,sinif]],
//           satir:[[gün, branş, öğretmen, öğrenci, saat (dakika|null), süre (dakika|null)]]}
// Days are the app's day numbers (UTC days since 1970). A report replaces every row inside its
// own date range and keeps the rows outside it, so cumulative reports simply refresh the data.
function dogrula(v){
  const hata=m=>{throw new Error('Kayıtlı etüt verisi okunamadı ('+m+').')};
  const metin=(x,n)=>typeof x==='string'&&x.length<=n;
  const gun=x=>Number.isSafeInteger(x)&&x>=10000&&x<=40000;
  const tamsayi=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
  if(!v||typeof v!=='object'||Array.isArray(v)||v.surum!==SURUM||!Number.isSafeInteger(v.ts)||v.ts<0)hata('yapı');
  if(!Array.isArray(v.kaynak)||v.kaynak.length>EN_COK_KAYNAK||!v.kaynak.every(k=>k&&gun(k.bas)&&gun(k.bit)&&k.bas<=k.bit&&tamsayi(k.n,0,EN_COK_SATIR)&&tamsayi(k.ts,0,1e14)))hata('raporlar');
  if(!Array.isArray(v.brans)||!v.brans.every(x=>metin(x,60)&&x)||!Array.isArray(v.ogretmen)||!v.ogretmen.every(x=>metin(x,80)))hata('sözlük');
  if(!Array.isArray(v.ogrenci)||!v.ogrenci.every(o=>Array.isArray(o)&&o.length===2&&metin(o[0],80)&&o[0]&&metin(o[1],24)))hata('öğrenci');
  if(!Array.isArray(v.satir)||v.satir.length>EN_COK_SATIR)hata('satırlar');
  for(const s of v.satir)if(!Array.isArray(s)||s.length!==6||!gun(s[0])||!tamsayi(s[1],0,v.brans.length-1)||!tamsayi(s[2],0,v.ogretmen.length-1)||
    !tamsayi(s[3],0,v.ogrenci.length-1)||!(s[4]===null||tamsayi(s[4],0,1439))||!(s[5]===null||tamsayi(s[5],0,600)))hata('satır');
  return v;
}
const izleme=()=>typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme();
function oku(){
  if(D.etut===undefined)return {veri:null};
  try{return {veri:dogrula(JSON.parse(JSON.stringify(D.etut)))}}catch(e){return {veri:null,hata:e.message}}
}
function ac(v){
  if(!v)return [];
  return v.satir.map(([g,b,o,a,saat,sure])=>({g,brans:v.brans[b],ogretmen:v.ogretmen[o],ad:v.ogrenci[a][0],sinif:v.ogrenci[a][1],saat,sure}));
}
function paketle(satirlar,kaynak,ts){
  const sozluk=dizi=>{const s=[...new Set(dizi)].sort((a,b)=>a.localeCompare(b,'tr'));return [s,new Map(s.map((x,i)=>[x,i]))]};
  const [brans,bi]=sozluk(satirlar.map(r=>r.brans)),[ogretmen,oi]=sozluk(satirlar.map(r=>r.ogretmen));
  const [kisi,ki]=sozluk(satirlar.map(r=>JSON.stringify([r.ad,r.sinif])));
  const sirali=satirlar.slice().sort((a,b)=>a.g-b.g||(a.saat??-1)-(b.saat??-1)||a.ad.localeCompare(b.ad,'tr'));
  return {surum:SURUM,ts,kaynak,brans,ogretmen,ogrenci:kisi.map(x=>JSON.parse(x)),
    satir:sirali.map(r=>[r.g,bi.get(r.brans),oi.get(r.ogretmen),ki.get(JSON.stringify([r.ad,r.sinif])),r.saat,r.sure])};
}
function birlestir(veri,rapor){
  const kalan=ac(veri).filter(r=>r.g<rapor.bas||r.g>rapor.bit);
  const ts=Math.max(Date.now(),veri?veri.ts+1:0);
  const kaynak=[...(veri?veri.kaynak:[]),{bas:rapor.bas,bit:rapor.bit,n:rapor.satirlar.length,ts}].slice(-EN_COK_KAYNAK);
  const tum=kalan.concat(rapor.satirlar);
  if(tum.length>EN_COK_SATIR)throw new Error('En fazla '+sayi(EN_COK_SATIR)+' etüt saklanır.');
  return paketle(tum,kaynak,ts);
}
const ONBELLEK={ts:null,m:null};
async function yaz(veri){
  if(veri)dogrula(veri);
  const json=veri?JSON.stringify(veri):'',bayt=baytBoyu(json);
  if(bayt>UST_SINIR)throw new Error('Etüt verisi '+Math.round(UST_SINIR/1000)+' KB sınırını aşıyor.');
  const eski=D.etut,geri=()=>{if(eski===undefined)delete D.etut;else D.etut=eski};
  if(veri)D.etut=veri;else delete D.etut;
  // The rows ride in the teacher's cloud backup; they must not push it over its limit.
  if(veri&&baytBoyu(JSON.stringify(D))>BULUT_YEDEK_UST_SINIR&&bayt>(eski===undefined?0:baytBoyu(JSON.stringify(eski)))){geri();throw new Error('Bu rapor defteri bulut yedeği sınırının üstüne çıkarır.')}
  if(!await kaydet(true)){geri();throw new Error('Cihaza kaydedilemedi; etüt verisi değişmedi.')}
  ONBELLEK.ts=null;
}
async function raporEkle(raporlar){
  if(!rehberMi()||izleme())throw new Error('Yalnızca rehber öğretmen ekleyebilir.');
  const {veri,hata}=oku();if(hata)throw new Error(hata+' Yeni rapor eklenmedi.');
  let v=veri;
  for(const r of raporlar.slice().sort((a,b)=>a.bit-b.bit))v=birlestir(v,r);
  await yaz(v);
  return v;
}
async function sil(){
  if(!rehberMi()||izleme())throw new Error('Yalnızca rehber öğretmen silebilir.');
  await yaz(null);
}
// A notebook opened without its etüt rows (from another device or an older cloud copy) can take them
// back from the newest daily cloud copy that has them. Only D.etut is written; the rest stays.
const EN_COK_YEDEK=30;
function bulutHazir(){
  const b=typeof window!=='undefined'&&window.bulut,u=b&&b.yapilandirilmis&&typeof b.mevcutKullanici==='function'?b.mevcutKullanici():null;
  return !!(u&&!u.isAnonymous);
}
async function yedekteBul(ilerleme){
  const g=await bulutYedekGecmisi();if(g.tur!=='tamam')throw new Error(g.mesaj||'Bulut yedeğine bağlanılamadı.');
  for(const y of g.liste.slice(0,EN_COK_YEDEK)){
    if(ilerleme)ilerleme(y.gun);
    const r=await buluttanGunAl(y.gun);if(r.tur!=='tamam'||!r.yedek||r.yedek.etut===undefined)continue;
    try{const v=dogrula(JSON.parse(JSON.stringify(r.yedek.etut)));if(v.satir.length)return {gun:y.gun,veri:v}}catch(e){/* unreadable copy: try an older one */}
  }
  return null;
}
async function yedektenGetir(){
  if(!rehberMi()||izleme())throw new Error('Yalnızca rehber öğretmen geri getirebilir.');
  if(D.etut!==undefined)throw new Error('Defterde zaten etüt verisi var.');
  const defter=D,b=await yedekteBul(gun=>durum('Bulut yedekleri aranıyor: '+tarihUzun(gunNo(gun))+'…'));
  if(D!==defter||!rehberMi())throw new Error('Oturum değişti.');
  if(!b)return 'Bulut yedeklerinde etüt verisi yok. Son etüt raporunu “PDF ekle” ile ekleyin.';
  const v=b.veri,gun=tarihUzun(gunNo(b.gun));
  if(!confirm(gun+' yedeğinde '+sayi(v.satir.length)+' etüt var ('+tarihUzun(v.satir[0][0])+' – '+tarihUzun(v.satir[v.satir.length-1][0])+'). Geri getirilsin mi? Defterin geri kalanı değişmez.'))return 'Geri getirilmedi.';
  if(D!==defter||D.etut!==undefined)throw new Error('Defter bu arada değişti; geri getirilmedi.');
  await yaz(v);
  return 'Geri getirildi: '+sayi(v.satir.length)+' etüt ('+gun+' yedeğinden).';
}

/* ---------------- model ---------------- */
// Weeks start on Monday and run from the first etüt's week to the report's last day; weeks with
// no etüt count as 0. The last week is partial (dashed, left out of comparisons) when the report
// ends before Friday. Windows compare the last 1, 2 or 4 full weeks with as many weeks before.
// sec = {a,b}: the two full weeks chosen on the chart (Karşılaştır: Seç), compared week to week.
// plan: each teacher's weekdays from the Etüt planı (Map of anahtar(ad) → Set of 0 = Pazartesi … 4 = Cuma).
// kademe: one grade (12 = 12. sınıflar) or null for every student. A grade's page counts its own
// students' etüts; its days are the report's etüt days that the grade may stay for (KISITLAR).
function model(v,sec,plan,kademe){
  const hepsi=ac(v).map(r=>({...r,hafta:pazartesi(r.g),ders:dersAdi(r.brans),kim:anahtar(r.ad)+'|'+r.sinif,hoca:anahtar(r.ogretmen),duzey:sinifDuzeyi(r.sinif)})).sort((a,b)=>a.g-b.g||(a.saat??-1)-(b.saat??-1));
  const rows=kademe?hepsi.filter(r=>r.duzey===kademe):hepsi;
  if(!rows.length)return null;
  const bit=Math.max(hepsi[hepsi.length-1].g,...v.kaynak.map(k=>k.bit));
  const haftalar=[];for(let h=rows[0].hafta;h<=pazartesi(bit);h+=7)haftalar.push(h);
  const kismiHafta=haftaGunu(bit)<4?pazartesi(bit):null;
  const yasak=(g,gun)=>!!kademe&&KISITLAR.some(k=>k.duzey===kademe&&k.gun===gun&&g>=gunNo(k.bas));
  // Days with an etüt of the grade always stay, so no etüt is ever hidden.
  const gunler=[...new Set(hepsi.map(r=>r.g).filter(g=>g>=haftalar[0]&&!yasak(g,haftaGunu(g))).concat(rows.map(r=>r.g)))].sort((a,b)=>a-b);
  const donem=(tur)=>{
    const anahtarlar=tur==='hafta'?haftalar:gunler;
    const grup=new Map(anahtarlar.map(p=>[p,[]]));for(const r of rows)grup.get(tur==='hafta'?r.hafta:r.g).push(r);
    const gorulen=new Set(),sayilar=[];
    return anahtarlar.map(p=>{
      const l=grup.get(p),kisi=new Set(l.map(r=>r.kim));let yeni=0;
      for(const k of kisi)if(!gorulen.has(k)){yeni++;gorulen.add(k)}
      sayilar.push(l.length);const son5=sayilar.slice(-5);
      return {p,etut:l.length,ogrenci:kisi.size,yeni,tekrar:kisi.size-yeni,gun:new Set(l.map(r=>r.g)).size,
        ort5:tur==='gun'?son5.reduce((a,b)=>a+b,0)/son5.length:null,kismi:tur==='hafta'&&p===kismiHafta,satir:l};
    });
  };
  const hafta=donem('hafta'),gun=donem('gun');
  const tam=hafta.filter(h=>!h.kismi).map(h=>h.p),n=tam.length;
  const pencere={};
  for(const s of ARALIKLAR)if(n>=2*s)pencere[s]={once:[tam[n-2*s],tam[n-s-1]],son:[tam[n-s],tam[n-1]]};
  // Seç: Önceki and Şimdiki are any two full weeks; by default the last full week and four weeks before it.
  if(n>=2){let a=sec&&tam.includes(sec.a)?sec.a:tam[Math.max(0,n-5)],b=sec&&tam.includes(sec.b)?sec.b:tam[n-1];
    if(a>b)[a,b]=[b,a];if(a===b){a=tam[Math.max(0,n-5)];b=tam[n-1]}pencere.sec={once:[a,a],son:[b,b]}}
  const icinde=(r,[a,b])=>r.hafta>=a&&r.hafta<=b;
  const dersSira=[...new Set(rows.map(r=>r.ders))].map(d=>[d,rows.filter(r=>r.ders===d).length]).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'tr')).map(x=>x[0]);
  const ilkHafta=new Map();for(const r of rows)if(!ilkHafta.has(r.kim))ilkHafta.set(r.kim,r.hafta);
  const karsilastir=(liste,s)=>{const w=pencere[s];if(!w)return null;const once=liste.filter(r=>icinde(r,w.once)).length,son=liste.filter(r=>icinde(r,w.son)).length;
    return {once,son,fark:son-once,oran:once?(son-once)/once:null}};
  const dersler=dersSira.map(d=>{const l=rows.filter(r=>r.ders===d),o={ders:d,toplam:l.length,renk:dersRengi(d),hafta:haftalar.map(h=>l.filter(r=>r.hafta===h).length),gun:gun.map(x=>x.satir.filter(r=>r.ders===d).length),k:{}};
    for(const s of PENCERELER)o.k[s]=karsilastir(l,s);return o});
  const kisiler=[...new Set(rows.map(r=>r.kim))].map(kim=>{
    const l=rows.filter(r=>r.kim===kim),o={kim,ad:l[0].ad,sinif:l[0].sinif,toplam:l.length,ilk:l[0].g,son:l[l.length-1].g,
      hafta:haftalar.map(h=>l.filter(r=>r.hafta===h).length),dersler:{},k:{}};
    for(const r of l)o.dersler[r.ders]=(o.dersler[r.ders]||0)+1;
    o.ogretmenler={};for(const r of l)if(r.hoca)o.ogretmenler[r.hoca]=(o.ogretmenler[r.hoca]||0)+1;
    for(const s of PENCERELER){const c=karsilastir(l,s);if(!c)continue;const w=pencere[s];
      c.durum=c.son>0&&c.once===0&&ilkHafta.get(kim)>w.once[1]?'New':c.son>0&&c.once===0?'Returned':c.son===0&&c.once>0?'Stopped':c.son>c.once?'Rising':c.son<c.once?'Falling':c.son>0?'Steady':'Quiet';
      o.k[s]=c}
    return o;
  }).sort((a,b)=>b.toplam-a.toplam||a.ad.localeCompare(b.ad,'tr'));
  // Teachers, each under the subject they give most etüts in; grouped in subject order.
  const ogretmenler=[...new Set(rows.filter(r=>r.hoca).map(r=>r.hoca))].map(hoca=>{
    const l=rows.filter(r=>r.hoca===hoca),sayac={},kisi=new Map();
    for(const r of l){sayac[r.ders]=(sayac[r.ders]||0)+1;const k=kisi.get(r.kim);if(k){k.n++;k.son=r.g}else kisi.set(r.kim,{kim:r.kim,ad:r.ad,sinif:r.sinif,n:1,son:r.g})}
    const ders=Object.entries(sayac).sort((a,b)=>b[1]-a[1]||dersSira.indexOf(a[0])-dersSira.indexOf(b[0]))[0][0];
    const o={hoca,ad:l[0].ogretmen,ders,renk:dersRengi(ders),toplam:l.length,ogrenci:kisi.size,hafta:haftalar.map(h=>l.filter(r=>r.hafta===h).length),
      gun:gun.map(x=>x.satir.filter(r=>r.hoca===hoca).length),kisiler:[...kisi.values()].sort((a,b)=>b.n-a.n||b.son-a.son||a.ad.localeCompare(b.ad,'tr')),k:{}};
    // Etüt days follow the teacher's schedule as it changes over the term. A day of the report is theirs
    // when they held etüts on it, on the same weekday the week before or after it, or (in the
    // report's last four weeks) on a weekday the Etüt planı lists them on. Each such day gives
    // GUNLUK_YER places. Other days are not the teacher's: the chart passes over them (null) instead of
    // dropping to 0, and doluluk is etüts ÷ places. A grade's page takes the days from all the
    // teacher's etüts, less the days the grade may not stay. gunleri are the days named on the page: the
    // plan's, else the weekdays of their etüts in the last four weeks (or of all their etüts).
    const tum=hepsi.filter(r=>r.hoca===hoca),pg=plan&&plan.get(hoca),kendi=new Set(tum.map(r=>r.g)),iz=new Map();
    for(const g of kendi){const w=haftaGunu(g);if(!iz.has(w))iz.set(w,[]);iz.get(w).push(g)}
    const acik=g=>kendi.has(g)||(iz.get(haftaGunu(g))||[]).some(d=>Math.abs(d-g)<=7)||!!pg&&pg.has(haftaGunu(g))&&g>bit-28;
    const gunleri=new Set(pg||tum.filter(r=>r.g>bit-28).map(r=>haftaGunu(r.g)));if(!gunleri.size)for(const r of tum)gunleri.add(haftaGunu(r.g));
    o.gunleri=[...gunleri].filter(g=>!yasak(bit,g)).sort((a,b)=>a-b);o.kaynak=pg?'plan':'rapor';
    o.kapGun=gun.map(x=>acik(x.p)?GUNLUK_YER:0);o.kapHafta=haftalar.map(h=>gun.filter(x=>x.p>=h&&x.p<h+7&&acik(x.p)).length*GUNLUK_YER);
    o.haftaG=o.hafta.map((v,i)=>o.kapHafta[i]||v?v:null);o.gunG=o.gun.map((v,i)=>o.kapGun[i]||v?v:null);
    o.kap=o.kapHafta.reduce((a,b)=>a+b,0);o.doluluk=o.kap?o.toplam/o.kap:null;
    for(const s of PENCERELER){const c=karsilastir(l,s);o.k[s]=c;if(!c)continue;const w=pencere[s],kap=([a,b])=>haftalar.reduce((t,h,i)=>h>=a&&h<=b?t+o.kapHafta[i]:t,0);
      c.kapOnce=kap(w.once);c.kapSon=kap(w.son);c.dolOnce=c.kapOnce?c.once/c.kapOnce:null;c.dolSon=c.kapSon?c.son/c.kapSon:null}
    return o;
  }).sort((a,b)=>dersSira.indexOf(a.ders)-dersSira.indexOf(b.ders)||b.toplam-a.toplam||a.ad.localeCompare(b.ad,'tr'));
  // Places in each window (1 = highest, equal values share a place, none without a value): students by
  // etüt count (none without etüt), teachers by doluluk (none without etüt days). siraFark is the önceki
  // place minus the son place, so a climb is positive.
  const yerler=(liste,s,deger)=>{
    for(const alan of ['once','son']){const v=o=>o.k[s]?deger(o.k[s],alan):null,l=liste.filter(o=>v(o)!==null).sort((a,b)=>v(b)-v(a));
      l.forEach((o,i)=>{o.k[s][alan+'Sira']=i&&v(l[i-1])===v(o)?l[i-1].k[s][alan+'Sira']:i+1})}
    for(const o of liste){const c=o.k[s];if(!c)continue;c.onceSira=c.onceSira??null;c.sonSira=c.sonSira??null;c.siraFark=c.onceSira!==null&&c.sonSira!==null?c.onceSira-c.sonSira:null}
  };
  for(const s of PENCERELER)if(pencere[s]){yerler(kisiler,s,(c,alan)=>c[alan]>0?c[alan]:null);yerler(ogretmenler,s,(c,alan)=>c[alan==='once'?'dolOnce':'dolSon'])}
  const ozet={};
  for(const s of PENCERELER){const w=pencere[s];if(!w)continue;
    const once=rows.filter(r=>icinde(r,w.once)),son=rows.filter(r=>icinde(r,w.son));
    const ko=new Set(once.map(r=>r.kim)).size,ks=new Set(son.map(r=>r.kim)).size;
    ozet[s]={etutOnce:once.length,etutSon:son.length,etutFark:son.length-once.length,etutOran:once.length?(son.length-once.length)/once.length:null,
      ogrOnce:ko,ogrSon:ks,ogrFark:ks-ko,yeni:[...ilkHafta.values()].filter(h=>h>=w.son[0]&&h<=w.son[1]).length,
      artan:kisiler.filter(k=>k.k[s].fark>0).length,azalan:kisiler.filter(k=>k.k[s].fark<0).length};
  }
  return {rows,bit,ilk:rows[0].g,haftalar,hafta,gun,pencere,dersler,ogretmenler,kisiler,ozet,kismiHafta,kademe:kademe||null};
}
// Each teacher's weekdays in the Etüt planı (src/etutplani.js), or null without a plan.
function planGunleri(){
  if(typeof ETUTPLANI==='undefined')return null;const {plan}=ETUTPLANI.oku();if(!plan)return null;
  const m=new Map();plan.gunler.forEach((satirlar,g)=>{for(const s of satirlar){const k=anahtar(s[1]);if(!k)continue;if(!m.has(k))m.set(k,new Set());m.get(k).add(g)}});
  return m.size?m:null;
}
// The grades in the report, highest first, and the one the page shows (Sınıf; null = all).
const kademeler=v=>[...new Set(v.ogrenci.map(o=>sinifDuzeyi(o[1])).filter(d=>d!==null))].sort((a,b)=>b-a);
const kademeAl=v=>{const d=Number(EK.etKademe);return kademeler(v).includes(d)?d:null};
function modelAl(v,kademe=kademeAl(v)){
  const k=v.ts+'|'+v.satir.length+'|'+EK.etSecA+'|'+EK.etSecB+'|'+(D.etutPlani&&D.etutPlani.ts)+'|'+kademe;
  if(ONBELLEK.ts!==k||!ONBELLEK.m){ONBELLEK.m=model(v,{a:EK.etSecA,b:EK.etSecB},planGunleri(),kademe);ONBELLEK.ts=k}return ONBELLEK.m;
}
function durumAl(m){
  const s=EK.etAralik==='sec'&&m.pencere.sec?'sec':ARALIKLAR.includes(EK.etAralik)&&m.pencere[EK.etAralik]?EK.etAralik:m.pencere[2]?2:ARALIKLAR.filter(x=>m.pencere[x]).pop()||null;
  return {s,tur:EK.etTur==='gun'?'gun':'hafta',ders:m.dersler.some(d=>d.ders===EK.etDers)?EK.etDers:null,
    hoca:m.ogretmenler.some(o=>o.hoca===EK.etHoca)?EK.etHoca:null,
    kim:m.kisiler.some(k=>k.kim===EK.etOgr)?EK.etOgr:(m.kisiler[0]||{}).kim};
}

/* ---------------- charts (SVG strings, sized to their box) ---------------- */
const CIZIMLER=new Map();
function tikler(max,n){
  if(!(max>0))return [0,1];
  const ham=max/n,us=Math.pow(10,Math.floor(Math.log10(ham))),adim=Math.max(1,[1,2,5,10].find(k=>k*us>=ham-1e-9)*us),out=[];
  for(let v=0;v<max;v+=adim)out.push(v);out.push(out[out.length-1]+adim);return out;
}
const yaziGen=s=>String(s).length*7;
function eksenY(tik,y,L,R){
  return tik.map(t=>'<line class="et-izgara" x1="'+L+'" x2="'+R+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+(R+8)+'" y="'+r1(y(t))+'" dy="0.32em">'+sayi(t)+'</text>').join('');
}
function eksenX(ps,x,step,W,y0){
  const her=Math.max(1,Math.ceil(52/step)),n=ps.length;let out='';
  ps.forEach((p,i)=>{if((n-1-i)%her)return;const t=gunAy(p),w=yaziGen(t);let xx=x(i),a='middle';
    if(xx-w/2<0){xx=0;a='start'}else if(xx+w/2>W){xx=W;a='end'}
    out+='<text class="et-tik" x="'+r1(xx)+'" y="'+y0+'" text-anchor="'+a+'">'+t+'</text>'});
  return out;
}
function bantlar(ps,x,step,w,s,ust,alt,yazi,tur){
  if(!w)return '';let out='';
  for(const [sinif,[a,b],etiket] of [['once',w.once,s==='sec'?'Önceki':'Önceki '+s+'H'],['son',w.son,s==='sec'?'Şimdiki':'Son '+s+'H']]){
    const bitis=b+6,ic=ps.map((p,i)=>[p,i]).filter(([p])=>p>=a&&p<=bitis);if(!ic.length)continue;
    const xa=x(ic[0][1])-step/2,xb=x(ic[ic.length-1][1])+step/2;
    out+='<rect class="et-bant '+sinif+'" data-bant="'+sinif+'" x="'+r1(xa)+'" y="'+ust+'" width="'+r1(Math.max(0,xb-xa))+'" height="'+(alt-ust)+'"/>';
    if(yazi&&xb-xa>58)out+='<text class="et-bant-yazi" x="'+r1(xa+6)+'" y="'+(ust+13)+'">'+etiket+'</text>';
  }
  return out;
}
// Köşeli or yumuşak, as the viewer chose (src/grafik.js).
const yol=pts=>GRAFIK_CIZGI.yol(pts);
function egim(id,renk){return '<defs><linearGradient id="'+id+'" x1="0" x2="0" y1="0" y2="1">'+[[0,.26],[.25,.16],[.5,.08],[.75,.03],[1,0]].map(([o,a])=>'<stop offset="'+o+'" style="stop-color:'+renk+';stop-opacity:'+a+'"/>').join('')+'</linearGradient></defs>'}
const imlec=(ust,alt)=>'<line class="et-kural" y1="'+ust+'" y2="'+alt+'" x1="0" x2="0" visibility="hidden"/><g class="et-imlecler"></g>';

function grafikGenel(m,st,W){
  const H=300,d=m[st.tur],ps=d.map(r=>r.p),yMax=Math.max(1,...d.map(r=>r.etut)),tik=tikler(yMax,5);
  const R=W-(yaziGen(sayi(tik[tik.length-1]))+22),L=2,ust=26,hacimH=56,altTaban=H-26,fiyatAlt=altTaban-hacimH-18;
  const step=(R-L)/d.length,x=i=>L+step*(i+.5),y=v=>fiyatAlt-v/tik[tik.length-1]*(fiyatAlt-ust);
  const sMax=Math.max(1,...d.map(r=>r.ogrenci)),yv=v=>altTaban-v/sMax*hacimH;
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+egim('etEgimGenel','var(--e-c1)');
  svg+=bantlar(ps,x,step,m.pencere[st.s],st.s,4,altTaban,!(st.s==='sec'&&st.tur==='hafta'),st.tur)+eksenY(tik,y,L,R);
  svg+='<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+altTaban+'" y2="'+altTaban+'"/>';
  const bw=Math.max(2,Math.min(18,step*.55));
  d.forEach((r,i)=>{const o=i?d[i-1].ogrenci:null,c=o===null||r.ogrenci===o?'esit':r.ogrenci>o?'yukari':'asagi';
    svg+='<rect class="et-hacim '+c+(r.kismi?' kismi':'')+'" x="'+r1(x(i)-bw/2)+'" y="'+r1(yv(r.ogrenci))+'" width="'+r1(bw)+'" height="'+r1(Math.max(0,altTaban-yv(r.ogrenci)))+'" rx="'+r1(Math.min(3,bw/2))+'"/>'});
  const tamlar=d.map((r,i)=>[r,i]).filter(([r])=>!r.kismi),kismi=d.findIndex(r=>r.kismi);
  const pts=tamlar.map(([r,i])=>[x(i),y(r.etut)]);
  if(pts.length)svg+='<path d="'+yol(pts)+'L'+r1(pts[pts.length-1][0])+','+fiyatAlt+'L'+r1(pts[0][0])+','+fiyatAlt+'Z" style="fill:url(#etEgimGenel)"/>';
  if(st.tur==='gun')svg+='<path class="et-ort" d="'+yol(d.map((r,i)=>[x(i),y(r.ort5)]))+'"/>';
  svg+='<path class="et-cizgi" d="'+yol(pts)+'"/>';
  if(kismi>=0&&pts.length){svg+='<path class="et-cizgi kesik" d="'+yol([pts[pts.length-1],[x(kismi),y(d[kismi].etut)]])+'"/><circle class="et-bos-nokta" cx="'+r1(x(kismi))+'" cy="'+r1(y(d[kismi].etut))+'" r="3.5"/>'}
  if(pts.length){const [lx,ly]=pts[pts.length-1],deger=sayi(tamlar[tamlar.length-1][0].etut),tw=yaziGen(deger)+12;
    svg+='<line class="et-ref" x1="'+r1(lx)+'" x2="'+R+'" y1="'+r1(ly)+'" y2="'+r1(ly)+'"/><circle class="et-nokta" cx="'+r1(lx)+'" cy="'+r1(ly)+'" r="3.5"/>'+
      '<rect class="et-etiket" x="'+(R+3)+'" y="'+r1(ly-9)+'" width="'+tw+'" height="18" rx="4"/><text class="et-etiket-yazi" x="'+r1(R+3+tw/2)+'" y="'+r1(ly)+'" dy="0.32em" text-anchor="middle">'+deger+'</text>'}
  // Seç on the weekly chart: Önceki and Şimdiki are vertical lines with a handle, dragged to any full week.
  // Close lines put their handles side by side (Önceki to the left, Şimdiki to the right).
  const w=m.pencere[st.s],ia=w?ps.indexOf(w.once[0]):-1,ib=w?ps.indexOf(w.son[0]):-1,yakin=Math.abs(x(ib)-x(ia))<60;
  const tutamak=st.s==='sec'&&st.tur==='hafta'&&ia>=0&&ib>=0?[['once','Önceki',ia,yakin?-54:-27],['son','Şimdiki',ib,yakin?0:-27]].map(([ad,yazi,i,dx])=>
    '<g class="et-tutamak" data-tutamak="'+ad+'" transform="translate('+r1(x(i))+',0)"><rect class="et-tutamak-alan" x="-11" y="2" width="22" height="'+(altTaban-2)+'"/>'+
      '<line class="et-tutamak-cizgi" x1="0" x2="0" y1="20" y2="'+altTaban+'"/><rect class="et-tutamak-tut" x="'+dx+'" y="2" width="54" height="18" rx="9"/>'+
      '<text class="et-tutamak-yazi" x="'+(dx+27)+'" y="11" dy="0.32em" text-anchor="middle">'+yazi+'</text></g>').join(''):'';
  svg+=eksenX(ps,x,step,W,H-6)+imlec(ust-6,altTaban)+tutamak+'</svg>';
  const ipucu=d.map(r=>({bas:donemBasligi(r,st.tur),satir:[['var(--e-c1)','Etüt',sayi(r.etut),'cizgi'],[null,'Öğrenci',sayi(r.ogrenci)],[null,'İlk kez gelen',sayi(r.yeni)],
    st.tur==='hafta'?[null,'Etüt olan gün',sayi(r.gun)]:['var(--e-muted)','5 günlük ortalama',r.ort5.toLocaleString('tr-TR',{maximumFractionDigits:1}),'cizgi']]}));
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map(r=>y(r.etut)),noktalar:d.map(r=>[[y(r.etut),'var(--e-c1)']]),ipucu,step,ps,tam:d.map(r=>!r.kismi),deger:d.map(r=>r.etut),...(tutamak?{tutamak:true}:{}),
    olc:{donem:ps,uzunluk:st.tur==='hafta'?7:1,birim:'etüt',ana:{v:d.map(r=>r.etut),y:d.map(r=>y(r.etut)),renk:'var(--e-c1)'}}};
}
function donemBasligi(r,tur){return tur==='hafta'?gunAy(r.p)+' haftası'+(r.kismi?' · devam ediyor':''):new Date(r.p*864e5).toLocaleDateString('tr-TR',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'})}

// One line per subject or per teacher; a chosen one is drawn alone with its area. enCok keeps the
// readout to the busiest series when many lines share the chart. A null value is a day or week that is
// not the teacher's (no etüt days): the line skips it. s.kap adds the doluluk to the readout.
function grafikCoklu(m,st,W,seri,secili,egimId,enCok){
  const H=300,d=m[st.tur],ps=d.map(r=>r.p),var_=v=>v!==null&&v!==undefined;
  const gorunen=secili?seri.filter(s=>s.k===secili):seri,yMax=Math.max(1,...gorunen.flatMap(s=>s.v.filter(var_))),tik=tikler(yMax,5);
  const R=W-(yaziGen(sayi(tik[tik.length-1]))+22),L=2,ust=26,alt=H-26,step=(R-L)/d.length,x=i=>L+step*(i+.5),y=v=>alt-v/tik[tik.length-1]*(alt-ust);
  const nTam=d.findIndex(r=>r.kismi)<0?d.length:d.findIndex(r=>r.kismi);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">';
  svg+=bantlar(ps,x,step,m.pencere[st.s],st.s,4,alt,true,st.tur)+eksenY(tik,y,L,R)+'<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
  // With every line drawn, the one under the pointer takes the stage (data-seri, see seriVurgula).
  const coklu=!secili&&seri.length>1,noktasi=s=>s.v.map((v,i)=>var_(v)?[x(i),y(v),i]:null).filter(Boolean);
  const ciz=(s,kalin,k)=>{const pts=noktasi(s),tam=pts.filter(p=>p[2]<nTam),c=(coklu?' data-seri="'+k+'"':'')+' style="stroke:'+s.renk+'"',sinif=kalin?' kalin':' ince';
    return '<path class="et-cizgi'+sinif+'"'+c+' d="'+yol(tam)+'"/>'+(tam.length&&tam.length<pts.length?'<path class="et-cizgi kesik'+sinif+'"'+c+' d="'+yol(pts.slice(tam.length-1))+'"/>':'')+
      (tam.length===1&&!coklu?'<circle cx="'+r1(tam[0][0])+'" cy="'+r1(tam[0][1])+'" r="3" style="fill:'+s.renk+'"/>':'')};
  if(secili){const s=gorunen[0],tam=noktasi(s).filter(p=>p[2]<nTam);
    if(tam.length)svg+=egim(egimId,s.renk)+'<path d="'+yol(tam)+'L'+r1(tam[tam.length-1][0])+','+alt+'L'+r1(tam[0][0])+','+alt+'Z" style="fill:url(#'+egimId+')"/>';svg+=ciz(s,true)}
  else for(let k=seri.length-1;k>=0;k--)svg+=ciz(seri[k],false,k);
  svg+=eksenX(ps,x,step,W,H-6)+imlec(ust-6,alt)+'</svg>';
  const dolu=(s,i)=>s.kap&&s.kap[i]?[null,'Doluluk',yuzde(s.v[i]/s.kap[i])+' · '+sayi(s.v[i])+'/'+sayi(s.kap[i])]:null;
  const ipucu=d.map((r,i)=>{let l=gorunen.filter(s=>var_(s.v[i])).map(s=>[s.renk,s.ad,s.v[i]]).sort((a,b)=>b[2]-a[2]),geri=[];
    if(enCok&&!secili){l=l.filter(z=>z[2]>0);if(l.length>enCok)geri=l.splice(enCok-1)}
    const satir=l.map(([c,a,v])=>[c,a,sayi(v),'cizgi']);
    if(geri.length)satir.push([null,'+'+sayi(geri.length)+' öğretmen',sayi(geri.reduce((a,z)=>a+z[2],0))]);
    if(secili&&dolu(gorunen[0],i))satir.push(dolu(gorunen[0],i));
    return {bas:donemBasligi(r,st.tur),satir:satir.length?satir:[[null,secili&&!var_(gorunen[0].v[i])?'Etüt günü değil':'Etüt',secili&&!var_(gorunen[0].v[i])?'':'0']]}});
  // A line under the pointer: its point, and the readout led by it.
  const tekli=coklu?{seriler:seri.map(s=>({k:s.k,ad:s.ad,pts:d.map((_,i)=>var_(s.v[i])?[x(i),y(s.v[i])]:null)})),seriNokta:(k,i)=>var_(seri[k].v[i])?[[y(seri[k].v[i]),seri[k].renk]]:[],
    seriIpucu:(k,i)=>({bas:ipucu[i].bas,satir:[[seri[k].renk,seri[k].ad,var_(seri[k].v[i])?sayi(seri[k].v[i]):'—','cizgi',true]].concat(dolu(seri[k],i)?[dolu(seri[k],i)]:[],
      ipucu[i].satir.filter(r=>r[1]!==seri[k].ad)).slice(0,enCok||99)})}:{};
  // Measuring (src/grafik.js): a highlighted line, the chosen one, or all of them together.
  const olcSeri=s=>({ad:s.ad,v:s.v,y:s.v.map(v=>var_(v)?y(v):null),renk:s.renk});
  const olc={donem:ps,uzunluk:st.tur==='hafta'?7:1,birim:'etüt',seriler:coklu?seri.map(olcSeri):null,
    ana:secili?olcSeri(gorunen[0]):{ad:enCok?'Tüm öğretmenler':'Tüm dersler',v:d.map((_,i)=>seri.reduce((t,s)=>t+(s.v[i]||0),0)),y:null}};
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map((_,i)=>secili?y(gorunen[0].v[i]??0):ust+40),noktalar:d.map((_,i)=>gorunen.filter(s=>var_(s.v[i])&&(!enCok||secili||s.v[i]>0)).map(s=>[y(s.v[i]),s.renk])),ipucu,olc,...tekli};
}
const grafikDers=(m,st,W)=>grafikCoklu(m,st,W,m.dersler.map(x=>({k:x.ders,ad:x.ders,renk:x.renk,v:x[st.tur]})),st.ders,'etEgimDers');
const grafikHoca=(m,st,W)=>grafikCoklu(m,st,W,m.ogretmenler.map(x=>({k:x.hoca,ad:kisiAdi(x.ad),renk:x.renk,v:x[st.tur==='hafta'?'haftaG':'gunG'],kap:x[st.tur==='hafta'?'kapHafta':'kapGun']})),st.hoca,'etEgimHoca',10);
function grafikOgrenci(m,st,W){
  const H=240,d=m[st.tur],ps=d.map(r=>r.p),tik=tikler(Math.max(1,...d.map(r=>r.ogrenci)),4);
  const R=W-(yaziGen(sayi(tik[tik.length-1]))+22),L=2,ust=26,alt=H-26,step=(R-L)/d.length,x=i=>L+step*(i+.5),y=v=>alt-v/tik[tik.length-1]*(alt-ust),bw=Math.max(2,Math.min(32,step*.7));
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+bantlar(ps,x,step,m.pencere[st.s],st.s,4,alt,true,st.tur)+eksenY(tik,y,L,R);
  d.forEach((r,i)=>{const k=r.kismi?' kismi':'',yr=y(r.tekrar),yt=y(r.ogrenci);
    svg+='<rect class="et-tekrar'+k+'" x="'+r1(x(i)-bw/2)+'" y="'+r1(yr)+'" width="'+r1(bw)+'" height="'+r1(Math.max(0,alt-yr))+'" rx="'+r1(Math.min(3,bw/2))+'"/>';
    if(r.yeni)svg+='<rect class="et-yeni'+k+'" x="'+r1(x(i)-bw/2)+'" y="'+r1(yt)+'" width="'+r1(bw)+'" height="'+r1(Math.max(0,yr-yt-(r.tekrar?1:0)))+'" rx="'+r1(Math.min(3,bw/2))+'"/>'});
  svg+='<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>'+eksenX(ps,x,step,W,H-6)+imlec(ust-6,alt)+'</svg>';
  const ipucu=d.map(r=>({bas:donemBasligi(r,st.tur),satir:[[null,'Öğrenci',sayi(r.ogrenci)],['var(--e-c1)','İlk kez gelen',sayi(r.yeni)],['var(--e-chart-muted)','Tekrar gelen',sayi(r.tekrar)]]}));
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map(r=>y(r.ogrenci)),noktalar:d.map(()=>[]),bant:step,ipucu,
    olc:{donem:ps,uzunluk:st.tur==='hafta'?7:1,birim:'öğrenci',ana:{v:d.map(r=>r.ogrenci),y:d.map(r=>y(r.ogrenci)),renk:'var(--e-c1)'}}};
}
function grafikKisi(m,st,W){
  const k=m.kisiler.find(x=>x.kim===st.kim);if(!k)return null;
  const H=210,hs=m.hafta,ps=hs.map(r=>r.p),satirlar=m.rows.filter(r=>r.kim===k.kim),sira=m.dersler.map(d=>d.ders);
  const tik=tikler(Math.max(1,...k.hafta),Math.min(4,Math.max(1,...k.hafta)));
  const R=W-(yaziGen(sayi(tik[tik.length-1]))+20),L=2,ust=26,alt=H-26,step=(R-L)/hs.length,x=i=>L+step*(i+.5),y=v=>alt-v/tik[tik.length-1]*(alt-ust),bw=Math.max(2,Math.min(28,step*.68));
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+bantlar(ps,x,step,m.pencere[st.s],st.s,4,alt,true,'hafta')+eksenY(tik,y,L,R);
  const kat=hs.map(h=>sira.map(d=>[d,satirlar.filter(r=>r.hafta===h.p&&r.ders===d).length]).filter(z=>z[1]));
  hs.forEach((h,i)=>{let acc=0;for(const [d,v] of kat[i]){svg+='<rect class="'+(h.kismi?'kismi':'')+'" x="'+r1(x(i)-bw/2)+'" y="'+r1(y(acc+v))+'" width="'+r1(bw)+'" height="'+r1(Math.max(0,y(acc)-y(acc+v)-1))+'" rx="2" style="fill:'+dersRengi(d)+'"/>';acc+=v}
    if(k.hafta[i]&&bw>=12)svg+='<text class="et-deger" x="'+r1(x(i))+'" y="'+r1(y(k.hafta[i])-5)+'" text-anchor="middle">'+sayi(k.hafta[i])+'</text>'});
  svg+='<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>'+eksenX(ps,x,step,W,H-6)+imlec(ust-6,alt)+'</svg>';
  const ipucu=hs.map((h,i)=>({bas:donemBasligi(h,'hafta'),satir:[[null,'Etüt',sayi(k.hafta[i])],...kat[i].map(([d,v])=>[dersRengi(d),d,sayi(v)])]}));
  return {svg,xs:hs.map((_,i)=>x(i)),ys:hs.map((_,i)=>y(k.hafta[i])),noktalar:hs.map(()=>[]),bant:step,ipucu,
    olc:{donem:ps,uzunluk:7,birim:'etüt',ana:{v:k.hafta,y:k.hafta.map(v=>y(v)),renk:'var(--e-fg)'}}};
}
const GRAFIKLER={genel:grafikGenel,ders:grafikDers,hoca:grafikHoca,ogrenci:grafikOgrenci,kisi:grafikKisi};
let ZAMAN=null;
function grafikleriCiz(){
  if(EK.sekme!=='etutler'||!rehberMi())return;
  const {veri}=oku();if(!veri)return;const m=modelAl(veri);if(!m)return;const st=durumAl(m);
  document.querySelectorAll('.et-grafik[data-et-grafik]').forEach(kutu=>{
    const W=Math.round(kutu.clientWidth);if(W<120)return;
    const sw=m.pencere.sec,imza=W+'|'+st.s+'|'+(sw?sw.once[0]+'-'+sw.son[0]:'')+'|'+st.tur+'|'+st.ders+'|'+st.hoca+'|'+st.kim+'|'+veri.ts;if(kutu.dataset.imza===imza)return;
    const g=GRAFIKLER[kutu.dataset.etGrafik](m,st,Math.max(260,W));if(!g)return;
    kutu.dataset.imza=imza;kutu.innerHTML=g.svg+'<div class="et-ipucu" hidden></div>';CIZIMLER.set(kutu.dataset.etGrafik,g);
  });
}
function cizimPlanla(){if(typeof window==='undefined'||!window.requestAnimationFrame)return;window.cancelAnimationFrame(ZAMAN);ZAMAN=window.requestAnimationFrame(grafikleriCiz)}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('resize',cizimPlanla);
function ipucuGoster(kutu,i){
  const g=CIZIMLER.get(kutu.dataset.etGrafik);if(!g||i<0||i>=g.xs.length)return;
  const svg=kutu.querySelector('svg'),tip=kutu.querySelector('.et-ipucu');if(!svg||!tip)return;
  kutu.dataset.i=String(i);
  const kural=svg.querySelector('.et-kural'),cx=g.xs[i];
  if(g.bant){kural.setAttribute('visibility','hidden');let hl=svg.querySelector('.et-vurgu-bant');
    if(!hl){hl=document.createElementNS('http://www.w3.org/2000/svg','rect');hl.setAttribute('class','et-vurgu-bant');svg.insertBefore(hl,svg.firstChild)}
    hl.setAttribute('x',r1(cx-g.bant/2));hl.setAttribute('width',r1(g.bant));hl.setAttribute('y','20');hl.setAttribute('height',String(Number(kural.getAttribute('y2'))-20));hl.setAttribute('visibility','visible')}
  else{kural.setAttribute('x1',r1(cx));kural.setAttribute('x2',r1(cx));kural.setAttribute('visibility','visible')}
  const k=kutu.dataset.seri===undefined||!g.seriler?null:Number(kutu.dataset.seri);
  svg.querySelector('.et-imlecler').innerHTML=(k===null?g.noktalar[i]:g.seriNokta(k,i)).map(([yy,c])=>'<circle cx="'+r1(cx)+'" cy="'+r1(yy)+'" r="4.5" class="et-imlec" style="fill:'+c+'"/>').join('');
  const p=k===null?g.ipucu[i]:g.seriIpucu(k,i);
  tip.innerHTML='<div class="et-ipucu-bas">'+kacis(p.bas)+'</div>'+p.satir.map(([c,ad,v,tur,vurgu])=>'<div class="et-ipucu-satir'+(vurgu?' dp-vurgu':'')+'">'+(c?'<i class="et-renk'+(tur?' '+tur:'')+'" style="background:'+c+'"></i>':'')+'<span>'+kacis(ad)+'</span><b>'+kacis(v)+'</b></div>').join('');
  tip.hidden=false;
  const olcek=kutu.clientWidth/Number(svg.viewBox.baseVal.width||kutu.clientWidth),px=cx*olcek,py=g.ys[i]*olcek,bw=kutu.clientWidth,tw=tip.offsetWidth,th=tip.offsetHeight;
  let sol=px+14;if(sol+tw>bw)sol=px-tw-14;sol=Math.max(0,Math.min(sol,bw-tw));
  tip.style.left=sol+'px';tip.style.top=Math.max(0,Math.min(py-th/2,kutu.clientHeight-th))+'px';
}
// One line takes the stage: the others lose their colour and fade (CSS: svg.odakli), and the line
// is drawn last so nothing crosses it. k null clears. As on the Deneme panosu.
function seriVurgula(kutu,k){
  const svg=kutu.querySelector('svg');if(!svg)return;
  if(k===null||k===undefined||k<0){svg.classList.remove('odakli');svg.querySelectorAll('[data-seri].aktif').forEach(e=>e.classList.remove('aktif'));delete kutu.dataset.seri;return}
  if(kutu.dataset.seri===String(k))return;
  svg.querySelectorAll('[data-seri].aktif').forEach(e=>e.classList.remove('aktif'));
  svg.querySelectorAll('[data-seri="'+k+'"]').forEach(e=>{e.classList.add('aktif');e.parentNode.appendChild(e)});
  svg.classList.add('odakli');kutu.dataset.seri=String(k);
}
// The line nearest the pointer, if one passes within a few pixels of it.
function enYakinSeri(kutu,clientX,clientY){
  const g=CIZIMLER.get(kutu.dataset.etGrafik),svg=kutu.querySelector('svg');if(!g||!g.seriler||!svg)return null;
  const r=svg.getBoundingClientRect(),o=(Number(svg.viewBox.baseVal.width)||r.width)/(r.width||1),px=(clientX-r.left)*o,py=(clientY-r.top)*o;
  const uzak=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/l)):0;return Math.hypot(a[0]+t*dx-px,a[1]+t*dy-py)};
  let en=null,ed=14*o;
  g.seriler.forEach((s,k)=>{const pts=s.pts.filter(Boolean);pts.forEach((p,i)=>{const q=pts[i+1];const dd=q?uzak(p,q):Math.hypot(p[0]-px,p[1]-py);if(dd<ed){ed=dd;en=k}})});
  return en;
}
// A click or Enter on a line opens that subject's or teacher's own chart, as its card does.
function seriSec(kutu){
  const g=CIZIMLER.get(kutu.dataset.etGrafik);if(!g||!g.seriler||kutu.dataset.seri===undefined)return;
  const k=g.seriler[Number(kutu.dataset.seri)].k;
  if(kutu.dataset.etGrafik==='ders'){EK.etDers=k;yenidenCiz('[data-et-ders="'+CSS.escape(k)+'"].et-ders')}
  else if(kutu.dataset.etGrafik==='hoca'){EK.etHoca=k;yenidenCiz('[data-et-hoca="'+CSS.escape(k)+'"].et-ders')}
}
// The readout, rule and points go; a highlighted line stays (measuring keeps it, src/grafik.js).
function ipucuSakla(kutu){
  const tip=kutu.querySelector('.et-ipucu'),svg=kutu.querySelector('svg');if(tip)tip.hidden=true;delete kutu.dataset.i;
  if(svg){svg.querySelector('.et-kural')?.setAttribute('visibility','hidden');svg.querySelector('.et-vurgu-bant')?.setAttribute('visibility','hidden');const im=svg.querySelector('.et-imlecler');if(im)im.innerHTML=''}
}
function ipucuGizle(kutu){seriVurgula(kutu,null);ipucuSakla(kutu)}
function enYakin(kutu,clientX){
  const g=CIZIMLER.get(kutu.dataset.etGrafik),svg=kutu.querySelector('svg');if(!g||!svg)return -1;
  const r=svg.getBoundingClientRect(),vx=(clientX-r.left)*(Number(svg.viewBox.baseVal.width)||r.width)/(r.width||1);
  let en=0;g.xs.forEach((x,i)=>{if(Math.abs(x-vx)<Math.abs(g.xs[en]-vx))en=i});return en;
}
// Drag to measure (src/grafik.js): the highlighted line, else the chart's own (g.olc). Days are labelled
// by their date, weeks by their Monday.
function olcBilgi(kutu){
  const g=CIZIMLER.get(kutu.dataset.etGrafik);if(!g||!g.olc)return null;
  const o=g.olc,s=kutu.dataset.seri!==undefined&&o.seriler?o.seriler[Number(kutu.dataset.seri)]||o.ana:o.ana;
  return {xs:g.xs,deger:s.v,ys:s.y,renk:s.renk,ad:s.ad||'',donem:o.donem,uzunluk:o.uzunluk,birim:o.birim,fmt:sayi,etiket:i=>gunAy(o.donem[i])};
}

/* ---------------- page ---------------- */
let DURUM_YAZI='',ISLEM=false;
function durum(t){DURUM_YAZI=t||'';const el=document.getElementById('etDurum');if(el)el.textContent=DURUM_YAZI}
const secim=(ad,deger,secenekler,etiket)=>'<div class="et-seg" role="group" aria-label="'+etiket+'"><span class="et-seg-label">'+etiket+'</span>'+
  secenekler.map(([v,yazi,kapali])=>'<button type="button" data-et-'+ad+'="'+v+'" aria-pressed="'+(String(v)===String(deger))+'"'+(kapali?' disabled':'')+'>'+yazi+'</button>').join('')+'</div>';
const hap=(v,yazi)=>'<span class="et-hap '+yon(v)+'">'+(ok(v)?'<span aria-hidden="true">'+ok(v)+'</span>':'')+yazi+'</span>';
// ▲3 / ▼2 / =: places moved between the windows; nothing without an earlier place.
const siraOk=f=>f===null||f===undefined?'':'<span class="et-sira-ok '+yon(f)+'" role="img" aria-label="'+(f>0?sayi(f)+' sıra yükseldi':f<0?sayi(-f)+' sıra düştü':'sıra aynı')+'">'+(f>0?'▲'+sayi(f):f<0?'▼'+sayi(-f):'=')+'</span>';
const siraYazi=c=>c&&c.sonSira!==null?'<span class="mini">'+sayi(c.sonSira)+'. sıra</span>'+siraOk(c.siraFark):'';
const oranYazi=(fark,oran)=>sayi(Math.abs(fark))+(oran===null?'':' · '+yuzde(oran));
// Weekly mini graphs; haftalar lets measuring (src/grafik.js) shade the same weeks and show the change.
function kucukCizgi(vals,kismi,renk,son,G,Y,id,haftalar){
  const n=vals.length,mx=Math.max(1,...vals),x=i=>2+(G-6)*(n>1?i/(n-1):.5),y=v=>Y-3-v/mx*(Y-7),tam=kismi<0?n:kismi,pts=vals.slice(0,tam).map((v,i)=>[x(i),y(v)]);
  let s='<svg viewBox="0 0 '+G+' '+Y+'" width="100%" height="'+Y+'" preserveAspectRatio="none" aria-hidden="true"'+(haftalar?' data-olc-donem="'+haftalar.join(',')+'" data-olc-uzunluk="7" data-olc-v="'+vals.join(',')+'"':'')+'>';
  if(son&&son[0]>=0){const y_=n>1?(G-6)/(n-1)/2:0;s+='<rect class="et-bant son" x="'+r1(x(son[0])-y_)+'" y="0" width="'+r1(x(son[1])-x(son[0])+2*y_)+'" height="'+Y+'"/>'}
  if(id&&pts.length)s+=egim(id,renk)+'<path style="fill:url(#'+id+')" d="'+yol(pts)+'L'+r1(pts[pts.length-1][0])+','+Y+'L'+r1(pts[0][0])+','+Y+'Z"/>';
  s+='<path class="et-kucuk" vector-effect="non-scaling-stroke" style="stroke:'+renk+'" d="'+yol(pts)+'"/>';
  if(tam<n&&tam>0)s+='<path class="et-kucuk kesik" vector-effect="non-scaling-stroke" style="stroke:'+renk+'" d="'+yol([pts[tam-1],[x(tam),y(vals[tam])]])+'"/>';
  return s+'</svg>';
}
const egilimRengi=v=>v>0?'var(--e-ok)':v<0?'var(--e-bad)':'var(--e-muted)';
function defterEslesme(){
  const m=new Map();(D.ogr||[]).forEach((o,i)=>{if(!o||o.silindi)return;const a=anahtar(o.ad);m.set(a,m.has(a)?-1:i)});
  return ad=>{const i=m.get(anahtar(ad));return i===undefined||i<0?undefined:i};
}
function ozetKartlari(m,st){
  const o=m.ozet[st.s],son=m.pencere[st.s],ets=m.hafta.reduce((a,b)=>b.etut>a.etut?b:a,m.hafta[0]),et=st.s==='sec'?sonAdi(m,'sec'):'son '+haftaYazi(st.s);
  const kart=(baslik,buyuk,alt)=>'<div class="et-ozet-kart"><span class="mini">'+baslik+'</span><strong>'+buyuk+'</strong><div class="et-ozet-alt">'+alt+'</div></div>';
  return '<div class="et-ozet">'+
    kart('Toplam etüt',sayi(m.rows.length),'<span class="mini">'+sayi(m.kisiler.length)+' öğrenci · '+gunAy(m.ilk)+' – '+gunAy(m.bit)+'</span>')+
    (o?kart('Etüt · '+et,sayi(o.etutSon),hap(o.etutFark,oranYazi(o.etutFark,o.etutOran))+'<span class="mini">önceki: '+sayi(o.etutOnce)+'</span>')+
      kart('Etüt alan öğrenci · '+et,sayi(o.ogrSon),hap(o.ogrFark,sayi(Math.abs(o.ogrFark)))+'<span class="mini">önceki: '+sayi(o.ogrOnce)+'</span>')+
      kart('İlk kez gelen · '+et,sayi(o.yeni),'<span class="mini">'+aralikYazi(son.son[0],son.son[1]+6)+'</span>'):'')+
    kart('En yoğun hafta',sayi(ets.etut),'<span class="mini">'+gunAy(ets.p)+' haftası</span>')+'</div>';
}
function cumle(m,st){
  const kapsam=m.kademe?kademeAdi(m.kademe)+' · ':'';
  const o=m.ozet[st.s],w=m.pencere[st.s];if(!o)return kapsam+'Karşılaştırma için en az iki tam hafta gerekir.';
  const en=m.dersler.slice().sort((a,b)=>Math.abs(b.k[st.s].fark)-Math.abs(a.k[st.s].fark))[0];
  const b=t=>'<b>'+t+'</b>';
  const onceki=st.s==='sec'?gunAy(w.once[0])+' haftasına':st.s===1?'önceki haftaya':'önceki '+st.s+' haftaya';
  const degisim=o.etutFark===0?b('aynı'):o.etutOran===null?b(isaretli(o.etutFark)):b(yuzde(o.etutOran)+' '+(o.etutFark<0?'az':'fazla'));
  const bas=st.s==='sec'?gunAy(w.son[0])+' haftası':(st.s===1?'Geçen hafta':'Son '+st.s+' hafta')+' ('+aralikYazi(w.son[0],w.son[1]+6)+')';
  return kapsam+bas+': '+b(sayi(o.etutSon))+' etüt, '+onceki+' göre '+degisim+(st.s==='sec'?' ('+sayi(o.etutOnce)+' → '+sayi(o.etutSon)+')':'')+'. En büyük değişim: '+kacis(en.ders)+' '+b(isaretli(en.k[st.s].fark))+'. '+
    b(sayi(o.azalan))+' öğrenci daha az, '+b(sayi(o.artan))+' öğrenci daha çok etüt alıyor.';
}
function dersKartlari(m,st){
  const kismi=m.hafta.findIndex(h=>h.kismi),w=m.pencere[st.s],son=w?[m.haftalar.indexOf(w.son[0]),m.haftalar.indexOf(w.son[1])]:null;
  return '<div class="et-dersler">'+m.dersler.map((d,di)=>{const k=d.k[st.s],f=k?k.fark:0;
    return '<button type="button" class="et-ders" data-et-ders="'+kacis(d.ders)+'" aria-pressed="'+(st.ders===d.ders)+'"><span class="et-ders-ust"><i class="et-renk nokta" style="background:'+d.renk+'"></i><b>'+kacis(d.ders)+'</b><span class="mini">'+sayi(d.toplam)+' toplam</span></span>'+
      (k?'<strong>'+sayi(k.son)+'</strong><span class="et-ders-alt">'+hap(f,oranYazi(f,k.oran))+'<span class="mini">önceki: '+sayi(k.once)+'</span></span>':'<strong>'+sayi(d.toplam)+'</strong>')+
      '<span class="et-kucuk-kutu">'+kucukCizgi(d.hafta,kismi,egilimRengi(f),son,160,38,'etSg'+di,m.haftalar)+'</span></button>'}).join('')+'</div>';
}
// Teacher cards read like the subject cards; the dot is the teacher's subject colour. The place is by
// doluluk: etüts ÷ places on the teacher's etüt days.
const doluYazi=c=>c&&c.dolSon!==null?'<span class="mini">'+yuzde(c.dolSon)+' dolu</span>':'';
function hocaKartlari(m,st){
  const kismi=m.hafta.findIndex(h=>h.kismi),w=m.pencere[st.s],son=w?[m.haftalar.indexOf(w.son[0]),m.haftalar.indexOf(w.son[1])]:null;
  return '<div class="et-dersler">'+m.ogretmenler.map((o,oi)=>{const k=o.k[st.s],f=k?k.fark:0,ad=kisiAdi(o.ad);
    return '<button type="button" class="et-ders et-hoca-kart" data-et-hoca="'+kacis(o.hoca)+'" aria-pressed="'+(st.hoca===o.hoca)+'" title="'+kacis(ad)+'"><span class="et-ders-ust"><i class="et-renk nokta" style="background:'+o.renk+'"></i><b>'+kacis(ad)+'</b></span>'+
      '<span class="mini et-hoca-ders">'+kacis(o.ders)+' · '+sayi(o.toplam)+' toplam</span>'+
      (k?'<strong>'+sayi(k.son)+'</strong><span class="et-ders-alt">'+hap(f,oranYazi(f,k.oran))+'<span class="mini">önceki: '+sayi(k.once)+'</span>'+doluYazi(k)+siraYazi(k)+'</span>':'<strong>'+sayi(o.toplam)+'</strong>')+
      '<span class="et-kucuk-kutu">'+kucukCizgi(o.hafta,kismi,egilimRengi(f),son,160,38,'etHg'+oi,m.haftalar)+'</span></button>'}).join('')+'</div>';
}
function hocaPaneli(m,st,per){
  const o=m.ogretmenler.find(x=>x.hoca===st.hoca),ad=o?kisiAdi(o.ad):'';
  const gunler=o?'<span class="mini" id="etHocaGun">Etüt günleri: '+o.gunleri.map(g=>GUN_ADI[g]).join(', ')+' · '+(o.kaynak==='plan'?'Etüt planından':'etüt raporundan')+'</span>':'';
  const grafik='<section class="et-panel"><div class="et-kart-bas"><h2>'+(o?kacis(ad)+' etütleri':'Öğretmenlere göre etüt')+' · '+per+'</h2>'+(o?'<button type="button" class="et-dugme" data-et-hoca="">Tüm öğretmenler</button>':'')+'</div>'+gunler+
    '<div class="et-grafik" data-et-grafik="hoca" tabindex="0" role="img" aria-label="'+kacis((ad||'Öğretmen')+' etüt sayısı ('+per+')')+'"></div></section>';
  if(!o){
    const w=m.pencere[st.s];if(!w)return '<div id="etHoca">'+grafik+'</div>';
    const l=m.ogretmenler.slice().sort((a,b)=>(a.k[st.s].sonSira??1e9)-(b.k[st.s].sonSira??1e9)||(b.k[st.s].dolOnce??-1)-(a.k[st.s].dolOnce??-1)||a.ad.localeCompare(b.ad,'tr'));
    return '<div class="et-bolunmus" id="etHoca">'+grafik+'<section class="et-panel"><div class="et-kart-bas"><h2>Sıralama · doluluk</h2><span class="mini">'+karsiYazi(m,st.s)+'</span></div>'+
      '<div class="et-hoca-liste">'+l.map(h=>{const c=h.k[st.s];return '<button type="button" class="et-hareket-satir et-sira-satir" data-et-hoca="'+kacis(h.hoca)+'"><span class="et-sira-no">'+(c.sonSira===null?'—':sayi(c.sonSira))+'</span>'+
        '<span class="et-kim"><span><i class="et-renk nokta" style="background:'+h.renk+'"></i> '+kacis(kisiAdi(h.ad))+'</span><span class="mini">'+kacis(h.ders)+' · '+sayi(c.son)+'/'+sayi(c.kapSon)+' etüt · önceki: '+(c.dolOnce===null?'—':yuzde(c.dolOnce))+'</span></span>'+
        '<b>'+(c.dolSon===null?'—':yuzde(c.dolSon))+'</b>'+(siraOk(c.siraFark)||'<span></span>')+'</button>'}).join('')+'</div></section></div>';
  }
  return '<div class="et-bolunmus" id="etHoca">'+grafik+'<section class="et-panel"><div class="et-kart-bas"><h2>Öğrencileri</h2><span class="mini">'+sayi(o.ogrenci)+' öğrenci</span></div>'+
    '<div class="et-hoca-liste">'+o.kisiler.map(k=>'<button type="button" class="et-hareket-satir" data-et-ogr="'+kacis(k.kim)+'" aria-pressed="'+(st.kim===k.kim)+'"><span class="et-kim"><span>'+kacis(kisiAdi(k.ad))+'</span><span class="mini">'+kacis(k.sinif)+'</span></span>'+
      '<span class="mini">son: '+gunAy(k.son)+'</span><b>'+sayi(k.n)+'</b></button>').join('')+'</div></section></div>';
}
function hareketliler(m,st,es){
  const s=st.s;if(!m.pencere[s])return '<p class="mini">Karşılaştırma için en az iki tam hafta gerekir.</p>';
  const art=m.kisiler.filter(k=>k.k[s].fark>0).sort((a,b)=>b.k[s].fark-a.k[s].fark||b.k[s].son-a.k[s].son).slice(0,6);
  const az=m.kisiler.filter(k=>k.k[s].fark<0).sort((a,b)=>a.k[s].fark-b.k[s].fark||b.k[s].once-a.k[s].once).slice(0,6);
  const sutun=(baslik,n,liste)=>'<div class="et-hareket"><h3>'+baslik+' <span class="mini">('+sayi(n)+')</span></h3>'+(liste.length?liste.map(k=>
    '<button type="button" class="et-hareket-satir" data-et-ogr="'+kacis(k.kim)+'" aria-pressed="'+(st.kim===k.kim)+'"><span class="et-kim"><span>'+kacis(kisiAdi(k.ad))+'</span><span class="mini">'+kacis(k.sinif)+'</span></span>'+
    '<span class="mini">'+sayi(k.k[s].once)+' → '+sayi(k.k[s].son)+'</span>'+hap(k.k[s].fark,sayi(Math.abs(k.k[s].fark)))+'</button>').join(''):'<p class="mini">Bu aralıkta kimse yok.</p>')+'</div>';
  return '<div class="et-hareketler">'+sutun('Daha çok alanlar',m.ozet[s].artan,art)+sutun('Daha az alanlar',m.ozet[s].azalan,az)+'</div>';
}
const SUTUNLAR=[['ad','Öğrenci'],['sinif','Şube'],['toplam','Toplam'],['trend','Haftalık'],['once','Önceki'],['son','Son'],['fark','Değişim'],['sira','Sıra'],['durum','Durum']];
function tablo(m,st){
  const s=st.s,kismi=m.hafta.findIndex(h=>h.kismi),w=m.pencere[s],son=w?[m.haftalar.indexOf(w.son[0]),m.haftalar.indexOf(w.son[1])]:null;
  const kol=SUTUNLAR.filter(([k])=>w||!['once','son','fark','sira','durum'].includes(k));
  const sira=kol.some(([k])=>k===EK.etSira)&&EK.etSira!=='trend'?EK.etSira:'toplam',yonu=EK.etSiraYon==='artan'?1:-1;
  const deger=(k,c)=>c==='ad'?kisiAdi(k.ad):c==='sinif'?k.sinif:c==='toplam'?k.toplam:c==='durum'?DURUM[k.k[s].durum]:c==='sira'?(k.k[s].sonSira??1e9):k.k[s][c];
  const liste=m.kisiler.slice().sort((a,b)=>{const x=deger(a,sira),y=deger(b,sira);const f=typeof x==='number'?x-y:String(x).localeCompare(String(y),'tr');return f*yonu||b.toplam-a.toplam});
  const siniflar=[...new Set(m.kisiler.map(k=>k.sinif))].sort((a,b)=>parseInt(b,10)-parseInt(a,10)||a.localeCompare(b,'tr'));
  const ara=anahtar(EK.etAra||''),sinif=siniflar.includes(EK.etSinif)?EK.etSinif:'';
  const gor=k=>(!ara||anahtar(k.ad).includes(ara))&&(!sinif||k.sinif===sinif);
  const bas=kol.map(([k,ad])=>{const yazi=k==='once'?oncekiAdi(m,s):k==='son'?sonAdi(m,s):ad,gizli=['sinif','toplam','trend','once'].includes(k)?' class="et-dar-gizle"':'';
    return k==='trend'?'<th scope="col"'+gizli+'>'+yazi+'</th>':'<th scope="col"'+gizli+' aria-sort="'+(sira===k?(yonu>0?'ascending':'descending'):'none')+'"><button type="button" data-et-sira="'+k+'">'+yazi+'</button></th>'}).join('');
  const satir=k=>{const c=k.k[s],f=c?c.fark:0;
    return '<tr data-et-ogr="'+kacis(k.kim)+'" data-ara="'+kacis(anahtar(k.ad))+'" data-sinif="'+kacis(k.sinif)+'"'+(st.kim===k.kim?' class="secili"':'')+(gor(k)?'':' hidden')+'>'+
      '<td><button type="button" class="et-ad" data-et-ogr="'+kacis(k.kim)+'">'+kacis(kisiAdi(k.ad))+'</button></td><td class="et-dar-gizle">'+kacis(k.sinif)+'</td><td class="sayi et-dar-gizle">'+sayi(k.toplam)+'</td>'+
      '<td class="et-dar-gizle et-trend">'+kucukCizgi(k.hafta,kismi,egilimRengi(f),son,84,26,null,m.haftalar)+'</td>'+
      (c?'<td class="sayi et-dar-gizle">'+sayi(c.once)+'</td><td class="sayi">'+sayi(c.son)+'</td><td class="sayi et-'+yon(f)+'">'+isaretli(f)+'</td><td class="sayi">'+(c.sonSira===null?'—':sayi(c.sonSira))+siraOk(c.siraFark)+'</td><td><span class="et-durum '+c.durum+'">'+DURUM[c.durum]+'</span></td>':'')+'</tr>'};
  const gorunen=m.kisiler.filter(gor).length;
  return '<div class="et-filtre"><input type="search" id="etAra" placeholder="Öğrenci ara" aria-label="Öğrenci ara" value="'+kacis(EK.etAra||'')+'">'+
    '<select id="etSinif" aria-label="Şube"><option value="">Tüm şubeler</option>'+siniflar.map(c=>'<option value="'+kacis(c)+'"'+(c===sinif?' selected':'')+'>'+kacis(c)+'</option>').join('')+'</select>'+
    '<span class="mini" id="etSayac">'+(gorunen===m.kisiler.length?sayi(m.kisiler.length)+' öğrenci':sayi(gorunen)+' / '+sayi(m.kisiler.length)+' öğrenci')+'</span></div>'+
    '<div class="et-tablo-kutu"><table class="et-tablo"><thead><tr>'+bas+'</tr></thead><tbody>'+liste.map(satir).join('')+'</tbody></table></div>';
}
function kisiKarti(m,st,es){
  const k=m.kisiler.find(x=>x.kim===st.kim);if(!k)return '';
  const c=k.k[st.s],si=es(k.ad),ad=kisiAdi(k.ad);
  const dersler=Object.entries(k.dersler).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...dersler.map(x=>x[1]));
  const hb=new Map(m.ogretmenler.map(o=>[o.hoca,o])),hocalar=Object.entries(k.ogretmenler||{}).filter(([h])=>hb.has(h)).sort((a,b)=>b[1]-a[1]),hx=Math.max(1,...hocalar.map(x=>x[1]));
  return '<div class="et-kisi-bas"><h3>'+(si===undefined?kacis(ad):ogrAdDugmesi(si,ad))+'</h3><span class="mini">'+kacis(k.sinif)+' · ilk etüt '+gunAy(k.ilk)+' · son etüt '+gunAy(k.son)+'</span></div>'+
    '<div class="et-kisi-sayilar"><div><span class="mini">Toplam</span><strong>'+sayi(k.toplam)+'</strong></div>'+
    (c?'<div><span class="mini">'+sonAdi(m,st.s)+'</span><strong>'+sayi(c.son)+'</strong><span class="mini">önceki: '+sayi(c.once)+'</span>'+(c.sonSira!==null?'<span class="mini">'+sayi(c.sonSira)+'. sıra'+siraOk(c.siraFark)+'</span>':'')+'</div><div><span class="mini">Değişim</span>'+hap(c.fark,sayi(Math.abs(c.fark)))+'<span class="et-durum '+c.durum+'">'+DURUM[c.durum]+'</span></div>':'')+'</div>'+
    '<div class="et-grafik kucuk" data-et-grafik="kisi" tabindex="0" role="img" aria-label="'+kacis(ad+': haftalık etüt sayısı, derslere göre')+'"></div>'+
    '<span class="mini">Derslere göre</span><div class="et-cubuklar">'+dersler.map(([d,v])=>'<div class="et-cubuk"><span><i class="et-renk nokta" style="background:'+dersRengi(d)+'"></i>'+kacis(d)+'</span><span class="et-cubuk-iz"><i style="width:'+r1(v/mx*100)+'%;background:'+dersRengi(d)+'"></i></span><b>'+sayi(v)+'</b></div>').join('')+'</div>'+
    (hocalar.length?'<span class="mini">Öğretmenlere göre</span><div class="et-cubuklar hoca">'+hocalar.map(([h,v])=>{const o=hb.get(h),ad=kisiAdi(o.ad);
      return '<div class="et-cubuk"><span title="'+kacis(ad+' · '+o.ders)+'"><i class="et-renk nokta" style="background:'+o.renk+'"></i><span>'+kacis(ad)+'</span></span><span class="et-cubuk-iz"><i style="width:'+r1(v/hx*100)+'%;background:'+o.renk+'"></i></span><b>'+sayi(v)+'</b></div>'}).join('')+'</div>':'');
}
function kaynaklar(v,salt){
  const ks=v.kaynak.slice().reverse();
  return '<section class="et-panel" id="etRaporlar"><div class="et-kart-bas"><h2>Eklenen raporlar</h2>'+(salt?'':'<button type="button" class="et-dugme" id="etSil">Etüt verisini sil</button>')+'</div>'+
    '<div class="et-kaydir"><table class="et-kaynak"><thead><tr><th>Tarih aralığı</th><th>Etüt</th><th>Eklendi</th></tr></thead><tbody>'+
    ks.map(k=>'<tr><td>'+tarihUzun(k.bas)+' – '+tarihUzun(k.bit)+'</td><td>'+sayi(k.n)+'</td><td>'+new Date(k.ts).toLocaleDateString('tr-TR')+'</td></tr>').join('')+'</tbody></table></div></section>';
}
// Sınıf: every student or one grade, when the report has more than one.
function kademeSecimi(v,m){
  const l=kademeler(v);if(l.length<2)return '';
  return '<label class="et-seg"><span class="et-seg-label">Sınıf</span><select id="etKademe" aria-label="Sınıf"><option value="">Tüm sınıflar</option>'+
    l.map(d=>'<option value="'+d+'"'+(d===m.kademe?' selected':'')+'>'+kademeAdi(d)+'</option>').join('')+'</select></label>';
}
// Seç: Önceki and Şimdiki from the full weeks, newest first; the chart's lines move with them.
function ikiHafta(m){
  const w=m.pencere.sec,tam=m.hafta.filter(h=>!h.kismi).map(h=>h.p);
  const sec=(id,ad,h)=>'<label class="et-seg"><span class="et-seg-label">'+ad+'</span><select id="'+id+'" aria-label="'+ad+' hafta">'+tam.slice().reverse().map(p=>'<option value="'+p+'"'+(p===h?' selected':'')+'>'+gunAy(p)+' haftası</option>').join('')+'</select></label>';
  return sec('etSecA','Önceki',w.once[0])+sec('etSecB','Şimdiki',w.son[0]);
}
function icerik(){
  const salt=izleme(),{veri,hata}=oku();
  const ekle=salt?'':'<label class="et-dugme birincil">PDF ekle<input type="file" id="etPdf" accept="application/pdf,.pdf" multiple hidden></label>';
  const durumSatiri='<p id="etDurum" role="status" aria-live="polite">'+kacis(DURUM_YAZI)+'</p>';
  if(hata)return '<header class="et-bas"><h1 class="et-baslik">Etütler</h1></header><p class="et-uyari">'+kacis(hata)+'</p>'+durumSatiri;
  const m=veri?modelAl(veri):null;
  const geri=!salt&&!veri&&bulutHazir()?'<button type="button" class="et-dugme" id="etGeriGetir">Yedekten geri getir</button>':'';
  if(!m)return '<header class="et-bas"><h1 class="et-baslik">Etütler</h1><p class="et-cumle">Okulun etüt raporundan haftalık etüt grafikleri</p></header><div class="et-arac">'+ekle+geri+'</div>'+durumSatiri+
    '<section class="et-panel et-bos"><b>Henüz etüt raporu yok</b>'+(salt?'':'<p>Okulun “Tarih Bazlı Etüt Raporu” PDF’ini “PDF ekle” ile ekleyin. Yeni rapor, kapsadığı tarihlerdeki kayıtların yerine geçer.</p>')+'</section>';
  const st=durumAl(m),es=defterEslesme(),per=st.tur==='hafta'?'haftalık':'günlük';
  cizimPlanla();
  return '<header class="et-bas"><h1 class="et-baslik">Etütler</h1><p class="et-cumle">'+cumle(m,st)+'</p></header>'+
    '<div class="et-arac">'+ekle+secim('aralik',st.s,ARALIKLAR.map(s=>[s,haftaYazi(s),!m.pencere[s]]).concat([['sec','Seç',!m.pencere.sec]]),'Karşılaştır')+(st.s==='sec'?ikiHafta(m):'')+kademeSecimi(veri,m)+
      secim('tur',st.tur,[['hafta','Haftalık'],['gun','Günlük']],'Grafik')+secim('cizgi',GRAFIK_CIZGI.tur(),GRAFIK_CIZGI.SECENEKLER,'Çizgi')+'</div>'+durumSatiri+
    ozetKartlari(m,st)+
    '<section class="et-panel" id="etGenel"><div class="et-kart-bas"><h2>Tüm etütler · '+per+'</h2><div class="et-lejant"><span><i class="et-renk cizgi" style="background:var(--e-c1)"></i>Etüt</span>'+
      (st.tur==='gun'?'<span><i class="et-renk cizgi" style="background:var(--e-muted)"></i>5 günlük ortalama</span>':'')+
      '<span><i class="et-renk" style="background:var(--e-ok)"></i>Öğrenci sayısı arttı</span><span><i class="et-renk" style="background:var(--e-bad)"></i>azaldı</span></div></div>'+
      '<div class="et-grafik" data-et-grafik="genel" tabindex="0" role="img" aria-label="'+kacis('Etüt sayısı ('+per+') ve altında etüt alan öğrenci sayısı')+'"></div></section>'+
    '<h2 class="et-bolum" id="etDersler">Dersler</h2>'+dersKartlari(m,st)+
    '<section class="et-panel"><div class="et-kart-bas"><h2>'+(st.ders?kacis(st.ders)+' etütleri':'Derslere göre etüt')+' · '+per+'</h2>'+(st.ders?'<button type="button" class="et-dugme" data-et-ders="">Tüm dersler</button>':'')+'</div>'+
      '<div class="et-grafik" data-et-grafik="ders" tabindex="0" role="img" aria-label="'+kacis((st.ders||'Ders')+' etüt sayısı ('+per+')')+'"></div></section>'+
    (m.ogretmenler.length?'<h2 class="et-bolum" id="etOgretmenler">Öğretmenler</h2>'+hocaKartlari(m,st)+hocaPaneli(m,st,per):'')+
    '<h2 class="et-bolum" id="etOgrenciler">Öğrenciler</h2>'+
    '<div class="et-iki"><section class="et-panel"><div class="et-kart-bas"><h2>Farklı öğrenci sayısı · '+per+'</h2><div class="et-lejant"><span><i class="et-renk" style="background:var(--e-c1)"></i>İlk kez gelen</span><span><i class="et-renk" style="background:var(--e-chart-muted)"></i>Tekrar gelen</span></div></div>'+
      '<div class="et-grafik orta" data-et-grafik="ogrenci" tabindex="0" role="img" aria-label="'+kacis('Etüt alan farklı öğrenci sayısı ('+per+')')+'"></div></section>'+
    '<section class="et-panel"><div class="et-kart-bas"><h2>En çok değişenler</h2><span class="mini">'+karsiYazi(m,st.s)+'</span></div>'+hareketliler(m,st,es)+'</section></div>'+
    '<div class="et-bolunmus"><section class="et-panel" id="etTablo"><div class="et-kart-bas"><h2>Tüm öğrenciler</h2></div>'+tablo(m,st)+'</section>'+
    '<section class="et-panel et-kisi" id="etKisi">'+kisiKarti(m,st,es)+'</section></div>'+
    kaynaklar(veri,salt);
}
// Etüt planı (src/etutplani.js) offers, for each weekday, the teachers who held etüts on it in the
// report's last four weeks, and the report's teacher and student names for its lists.
function planIcin(){
  const {veri}=oku(),m=veri?modelAl(veri,null):null;if(!m)return null;
  const sinir=m.bit-27,hb=new Map(m.ogretmenler.map(o=>[o.hoca,{brans:o.ders,ogretmen:kisiAdi(o.ad)}]));
  return {gunler:[0,1,2,3,4].map(g=>[...new Set(m.rows.filter(r=>r.hoca&&r.g>=sinir&&haftaGunu(r.g)===g).map(r=>r.hoca))].map(h=>hb.get(h))),
    ogretmenler:[...hb.values()],ogrenciler:m.kisiler.map(k=>({ad:kisiAdi(k.ad),sinif:k.sinif}))};
}
function gorunum(){
  if(!rehberMi())return '<div class="baslik"><h1>Etütler</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  return '<div id="etKok">'+icerik()+'</div>';
}
function yenidenCiz(odak){
  const kok=document.getElementById('etKok');if(!kok){ciz();return}
  kok.innerHTML=icerik();cizimPlanla();
  if(odak){const el=document.querySelector(odak);if(el)el.focus()}
}
async function pdfEkle(files){
  const okunan=[],hatalar=[],defter=D;let atlanan=0;
  for(const file of files){
    durum('PDF okunuyor: '+file.name);
    try{const {pages}=await denemePdfSayfalari(file);const r=pdfCoz(pages);atlanan+=r.atlanan;okunan.push(r)}catch(e){hatalar.push(file.name+': '+e.message)}
  }
  if(D!==defter||!rehberMi())throw new Error('Oturum değişti.');
  if(okunan.length)await raporEkle(okunan);
  const n=okunan.reduce((a,r)=>a+r.satirlar.length,0);
  return (okunan.length?'Eklendi: '+okunan.map(r=>tarihUzun(r.bas)+' – '+tarihUzun(r.bit)).join(', ')+' · '+sayi(n)+' etüt.':'Rapor eklenmedi.')+
    (atlanan?' Okunamayan '+sayi(atlanan)+' satır atlandı.':'')+(hatalar.length?' Okunamayan: '+hatalar.join(' · '):'');
}
const etkin=()=>EK.sekme==='etutler'&&rehberMi();
GRAFIK_OLCUM.kur({secici:'.et-grafik[data-et-grafik]',kok:'#etKok',etkin,bilgi:olcBilgi,yakin:enYakin,ipucuGizle:ipucuSakla,hap,fmt:sayi});
document.addEventListener('click',async ev=>{
  if(!etkin())return;
  const el=ev.target.closest?.('[data-et-aralik],[data-et-tur],[data-et-cizgi],[data-et-ders],[data-et-hoca],[data-et-ogr],[data-et-sira],#etSil,#etGeriGetir');if(!el||el.disabled)return;
  if(el.id==='etGeriGetir'){
    if(ISLEM||izleme())return;
    ISLEM=true;try{durum(await yedektenGetir())}catch(e){durum('Geri getirilemedi: '+e.message)}finally{ISLEM=false}
    yenidenCiz();return;
  }
  if(el.dataset.etAralik){EK.etAralik=el.dataset.etAralik==='sec'?'sec':Number(el.dataset.etAralik);yenidenCiz('[data-et-aralik="'+EK.etAralik+'"]');return}
  if(el.dataset.etTur){EK.etTur=el.dataset.etTur;yenidenCiz('[data-et-tur="'+EK.etTur+'"]');return}
  if(el.dataset.etCizgi){GRAFIK_CIZGI.sec(el.dataset.etCizgi);yenidenCiz('[data-et-cizgi="'+GRAFIK_CIZGI.tur()+'"]');return}
  if(el.dataset.etDers!==undefined){const d=el.dataset.etDers;EK.etDers=d&&EK.etDers!==d?d:null;yenidenCiz(d?'[data-et-ders="'+CSS.escape(d)+'"].et-ders':null);return}
  if(el.dataset.etHoca!==undefined){const h=el.dataset.etHoca;EK.etHoca=h&&EK.etHoca!==h?h:null;yenidenCiz(h?'[data-et-hoca="'+CSS.escape(h)+'"].et-ders':null);return}
  if(el.dataset.etSira){const k=el.dataset.etSira;if(EK.etSira===k)EK.etSiraYon=EK.etSiraYon==='artan'?'azalan':'artan';else{EK.etSira=k;EK.etSiraYon=['ad','sinif','durum','sira'].includes(k)?'artan':'azalan'}
    yenidenCiz('[data-et-sira="'+k+'"]');return}
  if(el.dataset.etOgr){const uzak=!!el.closest('#etHoca');EK.etOgr=el.dataset.etOgr;yenidenCiz();const kart=document.getElementById('etKisi');
    if(kart&&(uzak||getComputedStyle(kart).position!=='sticky'))kart.scrollIntoView({block:'nearest',behavior:'smooth'});return}
  if(el.id==='etSil'){
    if(ISLEM||izleme())return;
    if(!confirm('Kayıtlı bütün etüt verisi silinsin mi? Raporları yeniden ekleyebilirsiniz.'))return;
    ISLEM=true;try{await sil();durum('Etüt verisi silindi.')}catch(e){durum(e.message)}finally{ISLEM=false}
    yenidenCiz();
  }
});
document.addEventListener('change',async ev=>{
  if(!etkin())return;const el=ev.target;
  if(el.id==='etPdf'){
    const files=Array.from(el.files||[]);el.value='';if(!files.length||ISLEM)return;
    if(files.length>10){durum('Bir defada en fazla 10 PDF seçin.');return}
    ISLEM=true;try{durum(await pdfEkle(files))}catch(e){durum('PDF eklenemedi: '+e.message)}finally{ISLEM=false}
    yenidenCiz();return;
  }
  if(el.id==='etSinif'){EK.etSinif=el.value;filtrele()}
  if(el.id==='etKademe'){EK.etKademe=el.value?Number(el.value):null;EK.etSinif='';yenidenCiz('#etKademe');return}
  if(el.id==='etSecA'||el.id==='etSecB'){const {veri}=oku();if(!veri)return;const w=modelAl(veri).pencere.sec;
    EK.etSecA=el.id==='etSecA'?Number(el.value):w.once[0];EK.etSecB=el.id==='etSecB'?Number(el.value):w.son[0];yenidenCiz('#'+el.id)}
});
document.addEventListener('input',ev=>{if(etkin()&&ev.target.id==='etAra'){EK.etAra=ev.target.value;filtrele()}});
function filtrele(){
  const ara=anahtar(EK.etAra||''),sinif=EK.etSinif||'';let n=0,t=0;
  document.querySelectorAll('.et-tablo tbody tr').forEach(tr=>{t++;const g=(!ara||tr.dataset.ara.includes(ara))&&(!sinif||tr.dataset.sinif===sinif);tr.hidden=!g;if(g)n++});
  const s=document.getElementById('etSayac');if(s)s.textContent=n===t?sayi(t)+' öğrenci':sayi(n)+' / '+sayi(t)+' öğrenci';
}
function imlecGoster(ev){
  if(!etkin()||GRAFIK_OLCUM.olcuyor())return;const kutu=ev.target.closest?.('.et-grafik[data-et-grafik]');if(!kutu)return;
  if(CIZIMLER.get(kutu.dataset.etGrafik)?.seriler)seriVurgula(kutu,enYakinSeri(kutu,ev.clientX,ev.clientY));
  ipucuGoster(kutu,enYakin(kutu,ev.clientX));
}
document.addEventListener('pointermove',imlecGoster);
document.addEventListener('pointerdown',imlecGoster);
document.addEventListener('click',ev=>{if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-et-grafik="ders"],.et-grafik[data-et-grafik="hoca"]');if(kutu)seriSec(kutu)});
document.addEventListener('pointerout',ev=>{if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-et-grafik]');if(kutu&&!kutu.contains(ev.relatedTarget)&&document.activeElement!==kutu)ipucuGizle(kutu)});
document.addEventListener('keydown',ev=>{
  if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-et-grafik]');if(!kutu||!['ArrowLeft','ArrowRight','Home','End','Escape','ArrowUp','ArrowDown','Enter'].includes(ev.key))return;
  const g=CIZIMLER.get(kutu.dataset.etGrafik);if(!g)return;
  if(['ArrowUp','ArrowDown','Enter'].includes(ev.key)&&!g.seriler)return;
  ev.preventDefault();
  if(ev.key==='Escape'){ipucuGizle(kutu);return}
  const i=kutu.dataset.i===undefined?g.xs.length-1:Number(kutu.dataset.i);
  if(ev.key==='Enter'){seriSec(kutu);return}
  // ↑/↓ walk the lines from top to bottom at the current week or day.
  if(ev.key==='ArrowUp'||ev.key==='ArrowDown'){
    const sira=g.seriler.map((s,k)=>[k,s.pts[i]]).filter(x=>x[1]).sort((a,b)=>a[1][1]-b[1][1]).map(x=>x[0]);if(!sira.length)return;
    const j=sira.indexOf(Number(kutu.dataset.seri)),yeni=j<0?(ev.key==='ArrowDown'?0:sira.length-1):Math.max(0,Math.min(sira.length-1,j+(ev.key==='ArrowDown'?1:-1)));
    seriVurgula(kutu,sira[yeni]);ipucuGoster(kutu,i);return;
  }
  ipucuGoster(kutu,ev.key==='Home'?0:ev.key==='End'?g.xs.length-1:Math.max(0,Math.min(g.xs.length-1,i+(ev.key==='ArrowLeft'?-1:1))));
});
document.addEventListener('focusout',ev=>{const kutu=ev.target.closest?.('.et-grafik[data-et-grafik]');if(kutu)ipucuGizle(kutu)});
// Seç: a line is dragged to any full week, never onto or past the other one. The tooltip and an
// "Önceki → Şimdiki" readout follow it; on release the page compares the two weeks.
let SURUKLE=null;
function surukleYaz(){
  const {kutu,g}=SURUKLE,a=g.deger[SURUKLE.once],b=g.deger[SURUKLE.son];
  let el=kutu.querySelector('.et-surukle');if(!el){el=document.createElement('div');el.className='et-surukle';kutu.appendChild(el)}
  el.innerHTML=gunAy(g.ps[SURUKLE.once])+' → '+gunAy(g.ps[SURUKLE.son])+': <b>'+sayi(a)+' → '+sayi(b)+'</b> etüt '+hap(b-a,oranYazi(b-a,a?(b-a)/a:null));
}
document.addEventListener('pointerdown',ev=>{
  if(!etkin())return;const t=ev.target.closest?.('.et-grafik[data-et-grafik="genel"] [data-tutamak]');if(!t)return;
  const kutu=t.closest('.et-grafik'),g=CIZIMLER.get('genel'),svg=kutu.querySelector('svg');if(!g||!g.tutamak||!svg)return;
  const tx=ad=>{const e=svg.querySelector('[data-tutamak="'+ad+'"]'),v=/translate\(([\d.-]+)/.exec(e.getAttribute('transform'));return g.xs.reduce((en,x,i)=>Math.abs(x-v[1])<Math.abs(g.xs[en]-v[1])?i:en,0)};
  ev.preventDefault();SURUKLE={kutu,g,svg,hangi:t.dataset.tutamak,once:tx('once'),son:tx('son')};
  try{kutu.setPointerCapture(ev.pointerId)}catch(e){}
  kutu.classList.add('suruklen');surukleYaz();
});
document.addEventListener('pointermove',ev=>{
  if(!SURUKLE)return;const {kutu,g,svg,hangi}=SURUKLE;
  let i=enYakin(kutu,ev.clientX);while(i>0&&!g.tam[i])i--;
  i=hangi==='once'?Math.min(i,SURUKLE.son-1):Math.max(i,SURUKLE.once+1);
  if(i<0||i>=g.xs.length||!g.tam[i])return;
  SURUKLE[hangi]=i;svg.querySelector('[data-tutamak="'+hangi+'"]').setAttribute('transform','translate('+r1(g.xs[i])+',0)');
  const bant=svg.querySelector('[data-bant="'+hangi+'"]');if(bant){bant.setAttribute('x',r1(g.xs[i]-g.step/2));bant.setAttribute('width',r1(g.step))}
  surukleYaz();ipucuGoster(kutu,i);
});
function birak(){
  if(!SURUKLE)return;const {g}=SURUKLE;EK.etSecA=g.ps[SURUKLE.once];EK.etSecB=g.ps[SURUKLE.son];SURUKLE=null;
  yenidenCiz();
}
document.addEventListener('pointerup',birak);document.addEventListener('pointercancel',birak);
return {pdfCoz,dogrula,oku,ac,paketle,birlestir,raporEkle,sil,yedekteBul,yedektenGetir,model,dersAdi,gorunum,icerik,grafikleriCiz,GRAFIKLER,CIZIMLER,planIcin,UST_SINIR,EN_COK_SATIR,DURUM,
  get onbellek(){return ONBELLEK}};
})();
function gorunumEtutler(){return ETUT.gorunum()}
