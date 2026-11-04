// Embedded in index.html by scripts/embed-turkiye.cjs. No student data belongs here.
// Türkiye geneli (teacher only): the publisher's "Ders Ortalamaları İlk 100 Kurum (Kolej)" report, read in
// the browser. For every subject the report ranks the 100 schools with the highest average net across
// Türkiye and prints the Türkiye average (Genel Net). Each PDF is one exam; the page follows one school
// (the teacher's) from exam to exam: its place and net in every subject, against the Türkiye average and
// the list's first and last school. A compact copy is kept in the teacher notebook as D.turkiye, so it
// travels with the teacher's cloud backup; student packets are built from a field whitelist and never
// carry it. Nothing is uploaded. See docs/turkiye-geneli.md.
const TURKIYE = (() => {
const SURUM=1, UST_SINIR=250000, EN_COK_SINAV=40, EN_COK_DERS=40, EN_COK_SATIR=150, EN_COK_AD=3000;
const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const PALET=['var(--e-c1)','var(--e-c2)','var(--e-c3)','var(--e-c7)','var(--e-c5)','var(--e-c6)','var(--e-c4)','var(--e-c8)'];
// Which schools a list ranks. The Kolej list (schools only) is the default; the same report set has
// "İlk 100 Kurum" (schools and courses together) and "(Kurs)". Lists of different kinds never mix.
const LISTELER=[['kolej','Kolej'],['kurum','Tüm kurumlar'],['kurs','Kurs']];
const LISTE_ADI=Object.fromEntries(LISTELER);
const OTURUMLAR=['TYT','AYT'];
// Totals: the sum of the subjects' average nets. TYT takes every TYT subject (120 questions without Ek
// Felsefe); AYT has one total per field.
const TOPLAMLAR={TYT:[['TYT','TYT toplam',null]],AYT:[['SAY','SAY toplam',['MATEMATİK-A','GEOMETRİ-A','FİZİK-A','KİMYA-A','BİYOLOJİ-A']],
  ['EA','EA toplam',['TÜRK DİLİ VE EDB-A','TARİH.1-A','COĞRAFYA.1-A','MATEMATİK-A','GEOMETRİ-A']],
  ['SÖZ','SÖZ toplam',['TÜRK DİLİ VE EDB-A','TARİH.1-A','COĞRAFYA.1-A','TARİH.2-A','COĞRAFYA.2-A','FELSEFE GR.-A','DİN KÜLTÜRÜ-A']]]};
const MODLAR=[['tpuan','T ve sıra'],['artis','Artış'],['sira','Sıra']];
const modAl=k=>k==='artis'||k==='sira'?k:'tpuan';
const aralikAl=k=>['tum','1','3','5','sec'].includes(String(k))?String(k):'tum';
const grafikAl=k=>k==='sira'||k==='artis'?k:'t';
// The report's subject titles → the site's names, in the order the page shows them.
const DERSLER=[
  ['TÜRKÇE-T','TYT','Türkçe'],['TARİH-T','TYT','Tarih'],['COĞRAFYA-T','TYT','Coğrafya'],['FELSEFE-T','TYT','Felsefe'],
  ['DİN KÜLTÜRÜ-T','TYT','Din Kültürü'],['MATEMATİK-T','TYT','Matematik'],['GEOMETRİ-T','TYT','Geometri'],
  ['FİZİK-T','TYT','Fizik'],['KİMYA-T','TYT','Kimya'],['BİYOLOJİ-T','TYT','Biyoloji'],
  ['TÜRK DİLİ VE EDB-A','AYT','Edebiyat'],['TARİH.1-A','AYT','Tarih-1'],['COĞRAFYA.1-A','AYT','Coğrafya-1'],['TARİH.2-A','AYT','Tarih-2'],
  ['COĞRAFYA.2-A','AYT','Coğrafya-2'],['FELSEFE GR.-A','AYT','Felsefe Grubu'],['DİN KÜLTÜRÜ-A','AYT','Din Kültürü'],
  ['MATEMATİK-A','AYT','Matematik'],['GEOMETRİ-A','AYT','Geometri'],['FİZİK-A','AYT','Fizik'],['KİMYA-A','AYT','Kimya'],['BİYOLOJİ-A','AYT','Biyoloji']];

/* ---------------- small helpers ---------------- */
const anahtar=s=>denemeAdAnahtari(s);
// Ek Felsefe (S.FELSEFE, for students exempt from Din Kültürü) is left out: not read, not kept, and
// dropped from lists stored before.
const DISARIDA=new Set(['S.FELSEFE-T','S.FELSEFE-A'].map(anahtar));
const disarida=kod=>DISARIDA.has(anahtar(kod));
const kisa=(s,n)=>String(s==null?'':s).replace(/\s+/g,' ').trim().slice(0,n);
// "SINAV KOLEJİ DOĞU KAMPÜSÜ (KESTEL) FEN/ANADOLU LİSESİ" → "Sınav Koleji Doğu Kampüsü (Kestel) Fen/Anadolu Lisesi"
const okulAdi=s=>String(s||'').toLocaleLowerCase('tr-TR').replace(/(^|[\s(/.\-])(\p{L})/gu,(m,a,b)=>a+b.toLocaleUpperCase('tr-TR'));
const DERS=new Map(DERSLER.map(([k,o,ad],i)=>[anahtar(k),{oturum:o,ad,sira:i}]));
function dersBilgi(kod){
  const b=DERS.get(anahtar(kod));if(b)return b;
  return {oturum:/-T$/u.test(kod)?'TYT':/-A$/u.test(kod)?'AYT':null,ad:okulAdi(String(kod).replace(/-[TA]$/u,'')),sira:999};
}
const f1=x=>Number(x).toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});
const f2=x=>Number(x).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fi=x=>Number(x).toLocaleString('tr-TR');
const isaret=(v,f=f1)=>(v>0?'+':v<0?'−':'')+f(Math.abs(v));
const yon=v=>v>0?'yukari':v<0?'asagi':'esit';
const ok=v=>v>0?'▲':v<0?'▼':'';
const r1=x=>Math.round(x*10)/10;
const gunAy=g=>{if(g===null||g===undefined)return '';const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]};
const tarihUzun=g=>{const t=new Date(g*864e5);return t.getUTCDate()+' '+AY[t.getUTCMonth()]+' '+t.getUTCFullYear()};
const gunDan=t=>{const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(t||'').trim());if(!m||+m[2]<1||+m[2]>12||+m[1]<1||+m[1]>31)return null;return gunNo(m[3]+'-'+m[2]+'-'+m[1])};
const kimlik=(ad,liste)=>anahtar(ad)+'|'+liste;
// The grade from the exam's code: 27-YKS-1202 → 12, 27-TYT-901 → 9. Other names are "Diğer".
const sinifDuzeyi=ad=>{const m=/(\d{3,4})\s*$/.exec(String(ad||''));if(!m)return null;const d=Number(m[1].slice(0,-2));return d>=9&&d<=12?d:null};
// Also "12.SINIF_HAZIR_BULUNUŞLUK_SINAVI" → 12.
const adDuzeyi=ad=>{const m=/(?:^|\D)(9|1[0-2])\s*\.?\s*SINIF/u.exec(anahtar(ad));return m?Number(m[1]):sinifDuzeyi(ad)};
// Grade groups: 'd12' … 'd9', 'd' (Diğer, set by the teacher) and 'tum' (every exam of the list).
const grupAdi=k=>k==='tum'?'Tümü':k==='d'?'Diğer':k.slice(1)+'. sınıf';
const grupSira=k=>k==='tum'?-1:k==='d'?0:Number(k.slice(1));
const DUZEYLER=[0,9,10,11,12];
const izleme=()=>typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme();

/* ---------------- PDF text → lists ---------------- */
// sayfalar: pdf.js text items per page {s,x,y,w,h,z} (y from the page bottom). Every subject starts on a
// new page under "27-YKS-1202, TÜRKÇE-T Dersi Net Sıralı Liste _40 Soru_ (İlk 100 Okul)" and the column
// headers Sıralama · Okul Adı · Okul Net · Okul Başarı · Genel Net; its rows run on to the next page under
// the headers only. Başarı is net ÷ questions, so only the net is kept. The footer holds the print date.
const SAYI=/^[-−]?\d{1,3}(?:[.,]\d{1,3})?$/;
const sayiOku=s=>Number(String(s).replace('−','-').replace(',','.'));
const BASLIK=/^(.+?)\s*,\s*(.+?)\s+Dersi\s+Net\s+Sıralı\s+Liste\b(.*)$/u;
// Lines by baseline; touching runs on a line are one phrase ("Okul" "Net" → "Okul Net").
function satirla(it){
  const out=[];
  for(const o of it.slice().sort((a,b)=>b.y-a.y||a.x-b.x)){const l=out[out.length-1];if(l&&Math.abs(l.y-o.y)<1.5)l.o.push(o);else out.push({y:o.y,o:[o]})}
  for(const l of out){
    l.o.sort((a,b)=>a.x-b.x);const p=[];
    for(const o of l.o){const q=p[p.length-1],ara=q?o.x-(q.x+q.w):Infinity;if(q&&ara<3.5){q.s+=(ara>.8?' ':'')+o.s;q.w=o.x+o.w-q.x}else p.push({s:o.s,x:o.x,w:o.w})}
    l.p=p;l.metin=p.map(q=>q.s).join(' ');
  }
  return out;
}
function kolonlar(l){
  const bul=r=>l.p.find(q=>r.test(q.s)),c=q=>q.x+q.w/2;
  const sira=bul(/^Sıra(lama)?$/u),ad=bul(/Adı$/u),net=bul(/^(?!Genel)\S+\s+Net$/u),bas=bul(/Başarı/u),gen=bul(/^Genel\s+Net$/u);
  if(!sira||!ad||!net||!gen)return null;
  return {siraSag:sira.x+sira.w+6,adSag:net.x-4,sutun:[['net',c(net)],['basari',bas?c(bas):null],['genel',c(gen)]].filter(x=>x[1]!==null)};
}
function listeTuru(dosya,adlar){
  const d=String(dosya||'');
  if(/\(\s*kolej\s*\)/iu.test(d))return 'kolej';
  if(/\(\s*kurs\s*\)/iu.test(d))return 'kurs';
  const kurs=adlar.filter(a=>/(^|\s)KURS(U|LARI)?(\s|$)/u.test(anahtar(a))).length;
  return !kurs?'kolej':kurs===adlar.length?'kurs':'kurum';
}
function pdfCoz(sayfalar,dosya){
  let sinav=null,ders=null,kolon=null,yaz=null,atlanan=0,baslik=false;
  const dersler=new Map();
  for(const items of sayfalar||[]){
    const it=(items||[]).filter(i=>i&&typeof i.s==='string'&&i.s.trim()&&Number.isFinite(i.x)&&Number.isFinite(i.y))
      .map(i=>({s:i.s.trim().replace(/\s+/g,' '),x:i.x,y:i.y,w:Number.isFinite(i.w)?i.w:i.s.trim().length*4}));
    const satirlar=[],yalniz=[];
    for(const l of satirla(it)){
      const b=BASLIK.exec(l.metin);
      if(b){
        baslik=true;const tur=(/\(\s*İlk\s*\d+\s*([^)]*)\)/u.exec(b[3])||[])[1]||'';
        if(/Şube|Sınıf/u.test(tur))throw new Error('Bu bir şube listesi. “Ders Ortalamaları İlk 100 Kurum (Kolej)” raporunu ekleyin.');
        if(/Öğrenci/u.test(tur))throw new Error('Bu bir öğrenci listesi. “Ders Ortalamaları İlk 100 Kurum (Kolej)” raporunu ekleyin.');
        const ad=kisa(b[1],120),kod=kisa(b[2],60),soru=Number((/(\d{1,3})\s*Soru/u.exec(b[3])||[])[1]);
        if(sinav!==null&&anahtar(sinav)!==anahtar(ad))throw new Error('PDF’de iki ayrı sınav var: '+sinav+', '+ad+'.');
        if(!Number.isSafeInteger(soru)||soru<1||soru>200)throw new Error(kod+' dersinin soru sayısı okunamadı.');
        sinav=ad;const k=anahtar(kod);
        if(!dersler.has(k))dersler.set(k,{kod,soru,satir:[],genel:[],disarida:disarida(kod)});
        ders=dersler.get(k);continue;
      }
      const k=kolonlar(l);if(k){kolon=k;continue}
      if(l.p.some(q=>/^Sayfa\s*\d+/u.test(q.s))||l.p.length<=2&&l.p.some(q=>gunDan(q.s)!==null)){
        for(const q of l.p){const g=gunDan(q.s);if(g!==null)yaz=yaz===null?g:Math.max(yaz,g)}continue;
      }
      if(!kolon||!ders){if(baslik)atlanan++;continue}
      const r={y:l.y,ad:[],sira:null};let fazla=false;
      for(const q of l.p){
        const c=q.x+q.w/2;
        if(SAYI.test(q.s)&&q.x>=kolon.adSag){
          let en=null,ed=40;for(const [ad,x] of kolon.sutun)if(Math.abs(x-c)<ed){ed=Math.abs(x-c);en=ad}
          if(en&&r[en]===undefined)r[en]=sayiOku(q.s);else fazla=true;
        }else if(/^\d{1,4}$/.test(q.s)&&r.sira===null&&!r.ad.length&&q.x+q.w<=kolon.siraSag)r.sira=Number(q.s);
        else if(q.x<kolon.adSag)r.ad.push(q.s);else fazla=true;
      }
      // A row's name may sit on the lines above and below its numbers.
      if(r.sira!==null&&r.net!==undefined&&!fazla){r.ders=ders;satirlar.push(r)}
      else if(r.sira===null&&r.ad.length&&r.net===undefined&&!fazla)yalniz.push(r);
      else atlanan++;
    }
    // A school name on two lines: the line without numbers joins the nearest row.
    for(const y of yalniz){
      let en=null,ed=8;for(const r of satirlar)if(Math.abs(r.y-y.y)<ed){ed=Math.abs(r.y-y.y);en=r}
      if(!en){atlanan++;continue}
      en.ad=y.y>en.y?y.ad.concat(en.ad):en.ad.concat(y.ad);
    }
    for(const r of satirlar){if(!r.ad.length){atlanan++;continue}r.ders.satir.push({sira:r.sira,ad:kisa(r.ad.join(' '),120),net:r.net});if(r.genel!==undefined)r.ders.genel.push(r.genel)}
  }
  if(!baslik)throw new Error('Bu PDF bir “Ders Ortalamaları İlk 100 Kurum” listesine benzemiyor.');
  const sonuc=[];
  for(const d of dersler.values()){
    if(d.disarida)continue;
    const gor=new Set(),satir=[];
    for(const r of d.satir.sort((a,b)=>a.sira-b.sira)){const k=anahtar(r.ad);if(gor.has(k)||Math.abs(r.net)>d.soru+1e-9){atlanan++;continue}gor.add(k);satir.push(r)}
    if(!satir.length||!d.genel.length)continue;
    // The Türkiye average is printed on every row; the most common value wins.
    const say=new Map();d.genel.forEach(g=>say.set(g,(say.get(g)||0)+1));
    const genel=[...say].sort((a,b)=>b[1]-a[1])[0][0];
    sonuc.push({kod:d.kod,soru:d.soru,genel,satir:satir.slice(0,EN_COK_SATIR)});
  }
  if(!sonuc.length)throw new Error('PDF’de okunabilen kurum satırı yok.');
  if(sonuc.length>EN_COK_DERS)throw new Error('Bir listede en fazla '+EN_COK_DERS+' ders olabilir.');
  const adlar=[...new Set(sonuc.flatMap(d=>d.satir.map(r=>r.ad)))];
  return {ad:sinav,liste:listeTuru(dosya,adlar),yaz,dersler:sonuc,atlanan};
}

/* ---------------- notebook storage ---------------- */
// D.turkiye = {surum, ts, okul, adlar:[school names], sinavlar:[{ad, liste, yaz, ts, dersler:[[kod, soru, genel, satırlar]]}]}
// okul is the school the page follows (as printed), null until chosen. genel is the Türkiye average in
// hundredths. satırlar is the list in its printed order, "name:net" per school, both base 36 (the name
// is its place in adlar, the net in hundredths); a third part is the printed place when it is not the
// row's position. yaz is the report's print day. duzey, when the teacher set it, is the exam's grade
// (0 for Diğer); otherwise the grade comes from the exam's name or Sıralamalar. Adding an exam's list
// again replaces it and keeps that choice.
const PARCA=/^([0-9a-z]{1,3}):(-?[0-9a-z]{1,4})(?::([0-9a-z]{1,4}))?$/;
function dogrula(v){
  const hata=m=>{throw new Error('Kayıtlı Türkiye geneli verisi okunamadı ('+m+').')};
  const metin=(x,n)=>typeof x==='string'&&x.length<=n&&x.trim().length>0;
  const gun=x=>Number.isSafeInteger(x)&&x>=10000&&x<=40000;
  const tam=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
  if(!v||typeof v!=='object'||Array.isArray(v)||v.surum!==SURUM||!tam(v.ts,0,1e14))hata('yapı');
  if(v.okul!==null&&!metin(v.okul,120))hata('okul');
  if(!Array.isArray(v.adlar)||!v.adlar.length||v.adlar.length>EN_COK_AD||!v.adlar.every(a=>metin(a,120))||new Set(v.adlar.map(anahtar)).size!==v.adlar.length)hata('kurumlar');
  if(!Array.isArray(v.sinavlar)||!v.sinavlar.length||v.sinavlar.length>EN_COK_SINAV)hata('denemeler');
  const ids=new Set();
  for(const s of v.sinavlar){
    if(!s||typeof s!=='object'||Array.isArray(s)||!metin(s.ad,120)||!LISTE_ADI[s.liste]||!(s.yaz===null||gun(s.yaz))||!tam(s.ts,0,1e14)||!(s.duzey===undefined||DUZEYLER.includes(s.duzey)))hata('deneme');
    const id=kimlik(s.ad,s.liste);if(ids.has(id))hata('aynı deneme');ids.add(id);
    if(!Array.isArray(s.dersler)||!s.dersler.length||s.dersler.length>EN_COK_DERS)hata('dersler');
    const kodlar=new Set();
    for(const d of s.dersler){
      if(!Array.isArray(d)||d.length!==4||!metin(d[0],60)||kodlar.has(anahtar(d[0]))||!tam(d[1],1,200)||!tam(d[2],-20000,20000)||typeof d[3]!=='string')hata('ders');
      kodlar.add(anahtar(d[0]));
      const p=d[3].split(',');if(p.length>EN_COK_SATIR)hata('ders satırları');
      for(const x of p){const m=PARCA.exec(x);if(!m||parseInt(m[1],36)>=v.adlar.length||Math.abs(parseInt(m[2],36))>d[1]*100||(m[3]!==undefined&&!tam(parseInt(m[3],36),1,99999)))hata('ders satırı')}
    }
  }
  return v;
}
function oku(){
  if(D.turkiye===undefined)return {veri:null};
  try{return {veri:dogrula(JSON.parse(JSON.stringify(D.turkiye)))}}catch(e){return {veri:null,hata:e.message}}
}
// The lists as {okul, sinavlar:[{id, ad, liste, yaz, ts, dersler:[{kod, soru, genel, satir:[{sira, ad, net}]}]}]}.
function ac(v){
  if(!v)return {okul:null,sinavlar:[]};
  return {okul:v.okul,sinavlar:v.sinavlar.map(s=>({id:kimlik(s.ad,s.liste),ad:s.ad,liste:s.liste,yaz:s.yaz,ts:s.ts,...(s.duzey===undefined?{}:{duzey:s.duzey}),
    dersler:s.dersler.filter(d=>!disarida(d[0])).map(([kod,soru,genel,sat])=>({kod,soru,genel:genel/100,satir:sat.split(',').map((p,i)=>{const m=PARCA.exec(p);
      return {sira:m[3]===undefined?i+1:parseInt(m[3],36),ad:v.adlar[parseInt(m[1],36)],net:parseInt(m[2],36)/100}})}))})).filter(s=>s.dersler.length)};
}
function paketle(a,ts){
  const adlar=[],yer=new Map(),no=ad=>{const k=anahtar(ad);if(!yer.has(k)){yer.set(k,adlar.length);adlar.push(ad)}return yer.get(k)};
  const sinavlar=a.sinavlar.map(s=>({ad:s.ad,liste:s.liste,yaz:s.yaz??null,ts:s.ts,...(s.duzey===undefined?{}:{duzey:s.duzey}),dersler:s.dersler.map(d=>[d.kod,d.soru,Math.round(d.genel*100),
    d.satir.map((r,i)=>no(r.ad).toString(36)+':'+Math.round(r.net*100).toString(36)+(r.sira===i+1?'':':'+r.sira.toString(36))).join(',')])}));
  return {surum:SURUM,ts,okul:a.okul??null,adlar,sinavlar};
}
function birlestir(a,r){
  const id=kimlik(r.ad,r.liste),eski=a.sinavlar.find(x=>x.id===id);
  const s={id,ad:kisa(r.ad,120),liste:r.liste,yaz:r.yaz??null,ts:Date.now(),...(eski&&eski.duzey!==undefined?{duzey:eski.duzey}:{}),
    dersler:r.dersler.map(d=>({kod:d.kod,soru:d.soru,genel:d.genel,satir:d.satir.map(x=>({sira:x.sira,ad:x.ad,net:x.net}))}))};
  const sinavlar=a.sinavlar.filter(x=>x.id!==id).concat(s);
  if(sinavlar.length>EN_COK_SINAV)throw new Error('En fazla '+EN_COK_SINAV+' liste saklanır; Denemeler tablosundan eskilerini silin.');
  return {okul:a.okul,sinavlar};
}
async function yaz(veri){
  if(veri)dogrula(veri);
  const json=veri?JSON.stringify(veri):'',bayt=baytBoyu(json);
  if(bayt>UST_SINIR && bayt>baytBoyu(JSON.stringify(D.turkiye??null)))throw new Error('Türkiye geneli verisi '+Math.round(UST_SINIR/1000)+' KB sınırını aşıyor; Denemeler tablosundan eski listeleri silin.');
  const owner=D,eski=owner.turkiye,aday={...owner};
  if(veri)aday.turkiye=veri;else delete aday.turkiye;
  const oncekiDefter=JSON.stringify(D);
  await defterAdayiniDogrula(aday,{previous:owner});
  if(D!==owner||owner.turkiye!==eski||JSON.stringify(D)!==oncekiDefter)throw new Error('Defter değişti. İşlemi yeniden deneyin.');
  const geri=()=>{if(owner.turkiye!==veri && !(veri===null&&owner.turkiye===undefined))return;if(eski===undefined)delete owner.turkiye;else owner.turkiye=eski};
  if(veri)owner.turkiye=veri;else delete owner.turkiye;
  try{if(!await kaydet(true))throw new Error('Cihaza kaydedilemedi; Türkiye geneli verisi değişmedi.')}catch(e){geri();throw e}
}
const yazabilir=()=>{if(!rehberMi()||izleme())throw new Error('Yalnızca rehber öğretmen değiştirebilir.')};
const sonraki=veri=>Math.max(Date.now(),veri?veri.ts+1:0);
async function raporEkle(raporlar){
  yazabilir();const {veri,hata}=oku();if(hata)throw new Error(hata+' Yeni liste eklenmedi.');
  let a=ac(veri);for(const r of raporlar)a=birlestir(a,r);
  const v=paketle(a,sonraki(veri));await yaz(v);return v;
}
async function okulKaydet(ad){
  yazabilir();const {veri,hata}=oku();if(!veri)throw new Error(hata||'Önce bir liste ekleyin.');
  const a=ac(veri);a.okul=ad?kisa(ad,120):null;await yaz(paketle(a,sonraki(veri)));
}
// d: 0, 9 … 12, or null for automatic.
async function duzeyKaydet(id,d){
  yazabilir();const {veri,hata}=oku();if(!veri)throw new Error(hata||'Liste yok.');
  if(d!==null&&!DUZEYLER.includes(d))throw new Error('Geçersiz sınıf.');
  const a=ac(veri),s=a.sinavlar.find(x=>x.id===id);if(!s)throw new Error('Liste bulunamadı.');
  if(d===null)delete s.duzey;else s.duzey=d;await yaz(paketle(a,sonraki(veri)));
}
async function sinavSil(id){
  yazabilir();const {veri,hata}=oku();if(!veri)throw new Error(hata||'Silinecek liste yok.');
  const a=ac(veri);a.sinavlar=a.sinavlar.filter(s=>s.id!==id);
  await yaz(a.sinavlar.length?paketle(a,sonraki(veri)):null);
}
async function sil(){yazabilir();await yaz(null)}

/* ---------------- T-puanı ve tahmini sıra ---------------- */
// A subject's list gives the top schools' nets by place (x_k) and the Türkiye average (mu). School means are
// taken as Normal(mu, sigma) over N schools, so the k-th school's net is about mu + sigma·Φ⁻¹(1 − (k − .5)/N).
// N and sigma are fitted by least squares (sigma given mu and N has a closed form). The schools' means are
// not the students' scores: sigma is the spread BETWEEN schools. See docs/turkiye-geneli.md.
const ESIK_UYUM=.35, EN_AZ_SATIR=10, N_UST=6000, TOPLAM_KORELASYON=.8;
// Φ⁻¹ (Wichura, AS241) and Φ (Hart, double precision).
function normTers(p){
  if(!(p>0&&p<1))return p<=0?-Infinity:Infinity;
  const q=p-.5;let r;
  if(Math.abs(q)<=.425){r=.180625-q*q;
    return q*(((((((2509.0809287301226727*r+33430.575583588128105)*r+67265.770927008700853)*r+45921.953931549871457)*r+13731.693765509461125)*r+1971.5909503065514427)*r+133.14166789178437745)*r+3.387132872796366608)/
      (((((((5226.495278852545925*r+28729.085735721942674)*r+39307.89580009271061)*r+21213.794301586595867)*r+5394.1960214247511077)*r+687.1870074920579083)*r+42.313330701600911252)*r+1)}
  r=Math.sqrt(-Math.log(q<0?p:1-p));let v;
  if(r<=5){r-=1.6;v=(((((((7.7454501427834140764e-4*r+.0227238449892691845833)*r+.24178072517745061177)*r+1.27045825245236838258)*r+3.64784832476320460504)*r+5.7694972214606914055)*r+4.6303378461565452959)*r+1.42343711074968357734)/
    (((((((1.05075007164441684324e-9*r+5.475938084995344946e-4)*r+.0151986665636164571966)*r+.14810397642748007459)*r+.68976733498510000455)*r+1.6763848301838038494)*r+2.05319162663775882187)*r+1)}
  else{r-=5;v=(((((((2.01033439929228813265e-7*r+2.71155556874348757815e-5)*r+.0012426609473880784386)*r+.026532189526576123093)*r+.29656057182850489123)*r+1.7848265399172913358)*r+5.4637849111641143699)*r+6.6579046435011037772)/
    (((((((2.04426310338993978564e-15*r+1.4215117583164458887e-7)*r+1.8463183175100546818e-5)*r+7.868691311456132591e-4)*r+.0148753612908506148525)*r+.13692988092273580531)*r+.59983220655588793769)*r+1)}
  return q<0?-v:v;
}
function normCdf(x){
  const a=Math.abs(x);let c;
  if(a>37)c=0;
  else{const e=Math.exp(-a*a/2);
    if(a<7.07106781186547){let b=.0352624965998911*a+.700383064443688;b=b*a+6.37396220353165;b=b*a+33.912866078383;b=b*a+112.079291497871;b=b*a+221.213596169931;b=b*a+220.206867912376;c=e*b;
      b=.0883883476483184*a+1.75566716318264;b=b*a+16.064177579207;b=b*a+86.7807322029461;b=b*a+296.564248779674;b=b*a+637.333633378831;b=b*a+793.826512519948;b=b*a+440.413735824752;c/=b}
    else{let b=a+.65;b=a+4/b;b=a+3/b;b=a+2/b;b=a+1/b;c=e/b/2.506628274631}}
  return x>0?1-c:c;
}
// satir: [{sira, net}] (the printed place and net), mu: the Türkiye average. With n given, only sigma is fitted.
// Returns {n, sigma, rmse (in nets), mu, adet} or null when the list is too short or does not fit a spread.
function siraUydur(satir,mu,n){
  const k=[],x=[];for(const r of satir||[])if(r&&Number.isFinite(r.sira)&&Number.isFinite(r.net)){k.push(r.sira);x.push(r.net-mu)}
  if(k.length<EN_AZ_SATIR||!Number.isFinite(mu))return null;
  const kmax=Math.max(...k),sxx=x.reduce((t,v)=>t+v*v,0);
  const dene=N=>{let sxq=0,sqq=0;for(let i=0;i<k.length;i++){const q=normTers(1-(k[i]-.5)/N);sxq+=x[i]*q;sqq+=q*q}
    if(!(sqq>0))return null;const sigma=sxq/sqq;return sigma>0?{n:N,sigma,sse:Math.max(0,sxx-sigma*sxq)}:null};
  let en=null;
  if(n!==undefined)en=Number.isFinite(n)&&n>kmax?dene(n):null;
  else{
    const al=N=>{const f=dene(N);if(f&&(!en||f.sse<en.sse-1e-12))en=f};
    const lo=kmax+20;
    for(let N=lo;N<=Math.min(1000,N_UST);N+=10)al(N);
    for(let N=Math.max(lo,1050);N<=N_UST;N+=50)al(N);
    if(en){const b=en.n,w=b>=1000?50:10;for(let N=Math.max(kmax+1,b-w);N<=Math.min(N_UST,b+w);N++)al(N)}
  }
  return en?{n:en.n,sigma:en.sigma,rmse:Math.sqrt(en.sse/k.length),mu,adet:k.length}:null;
}
const sdAl=l=>{const m=l.reduce((a,v)=>a+v,0)/l.length;return Math.sqrt(l.reduce((a,v)=>a+(v-m)*(v-m),0)/Math.max(1,l.length-1))};
// Thorndike (1949) Case II: the correlation of a population from the one seen in a sample selected on the measured
// variables (here the top-100 lists). u = population SD / sample SD (> 1 when the sample is the upper tail).
const duzeltilmisR=(r,u)=>{if(!Number.isFinite(r)||!(u>0))return null;const v=r*u/Math.sqrt(1-r*r+r*r*u*u);return Math.max(0,Math.min(.98,v))};
const EN_AZ_ORTAK=30;
// a, b: {sigma (fitted population sd), net: Map(school → net), sd (sd of the listed nets)} → {r, n, u, R} or null (too few schools in common).
function ciftKorelasyon(a,b){
  const x=[],y=[];for(const [k,v] of a.net){const w=b.net.get(k);if(w!==undefined){x.push(v);y.push(w)}}
  if(x.length<EN_AZ_ORTAK)return null;
  const mx=x.reduce((t,v)=>t+v,0)/x.length,my=y.reduce((t,v)=>t+v,0)/y.length;let sxy=0,sxx=0,syy=0;
  x.forEach((v,i)=>{sxy+=(v-mx)*(y[i]-my);sxx+=(v-mx)**2;syy+=(y[i]-my)**2});
  if(!(sxx>0&&syy>0&&a.sd>0&&b.sd>0))return null;
  const r=sxy/Math.sqrt(sxx*syy),u=(a.sigma/a.sd+b.sigma/b.sd)/2;
  return {r,n:x.length,u,R:duzeltilmisR(r,u)};
}
// The corrected correlations among a total's subjects (kodlar: anahtar list): a matrix, the median R used, and whether the
// default was needed. A pair with too few common schools takes the median of the other pairs; with none, 0.8 ("varsayılan").
function toplamKorelasyon(kodlar,cift){
  const n=kodlar.length,ham=[];
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const c=cift&&cift.get(kodlar[i]+'|'+kodlar[j]);ham.push([i,j,c&&c.R!==null?c.R:null])}
  const iyi=ham.map(h=>h[2]).filter(v=>v!==null),varsayilan=n>1&&!iyi.length;
  const ort=iyi.length?ortancaHam(iyi):TOPLAM_KORELASYON,R=Array.from({length:n},()=>Array(n).fill(1));
  for(const [i,j,v] of ham)R[i][j]=R[j][i]=v!==null?v:ort;
  return {R,ortanca:n>1?ort:null,varsayilan,adet:iyi.length};
}
// A list shorter than its nominal size (100) is the whole population of schools, not a truncated top: N is its row count, mu and
// sigma are the empirical (school-level) mean and SD of its nets, so T and the printed place are exact.
const NOMINAL=100;
const tamListe=d=>d.satir.length<NOMINAL;
function tamDagilim(satir){
  const x=satir.map(r=>r.net).filter(Number.isFinite),n=x.length;if(n<EN_AZ_SATIR)return null;
  const mu=x.reduce((a,v)=>a+v,0)/n,sigma=Math.sqrt(x.reduce((a,v)=>a+(v-mu)*(v-mu),0)/n);
  return sigma>0?{mu,sigma,n}:null;
}
// A total over complete lists: every school's nets summed over the total's subjects (matched by name); null unless every
// school is in every list. {mu, sigma, n, sirasi(x): 1 + the schools with a higher sum}.
function tamToplam(s,kodlar){
  const ds=kodlar.map(k=>s.dersler.find(d=>anahtar(d.kod)===k));if(!ds.length||ds.some(d=>!d||!tamListe(d)))return null;
  const say=new Map();for(const d of ds)for(const r of d.satir){const k=anahtar(r.ad),v=say.get(k)||{t:0,c:0};v.t+=r.net;v.c++;say.set(k,v)}
  const tum=[...say.values()].filter(v=>v.c===ds.length).map(v=>v.t);
  if(tum.length<EN_AZ_SATIR||tum.length!==Math.max(...ds.map(d=>d.satir.length)))return null;
  const mu=tum.reduce((a,v)=>a+v,0)/tum.length,sigma=Math.sqrt(tum.reduce((a,v)=>a+(v-mu)*(v-mu),0)/tum.length);
  return sigma>0?{mu,sigma,n:tum.length,sirasi:x=>1+tum.filter(v=>v>x+1e-9).length}:null;
}
const ortancaHam=l=>{const t=l.slice().sort((a,b)=>a-b),m=t.length;return m%2?t[(m-1)/2]:(t[m/2-1]+t[m/2])/2};
const ortanca=l=>{const s=l.slice().sort((a,b)=>a-b),m=s.length;return m%2?s[(m-1)/2]:Math.round((s[m/2-1]+s[m/2])/2)};
// One exam and list kind: each subject is fitted on its own; the pooled N is the median over the subjects that
// fit well (rmse / sigma < ESIK_UYUM), then each subject's sigma is fitted again with that N fixed.
// {n (null when no subject fits), aralik: [lowest, highest] per-subject N, adet, dersler: Map(anahtar(kod) → {mu, sigma, rmse, uyum, kendiN})}
const DAGILIM_ONBELLEK=new Map();
function dagilimAl(s){
  const imza=s.id+'|'+s.ts+'|'+s.dersler.map(d=>d.kod+':'+d.genel+':'+d.satir.length+':'+d.satir.reduce((t,r)=>t+r.net*r.sira,0).toFixed(2)).join(',');
  if(DAGILIM_ONBELLEK.has(imza))return DAGILIM_ONBELLEK.get(imza);
  const kendi=s.dersler.filter(d=>!tamListe(d)).map(d=>({d,f:siraUydur(d.satir,d.genel)})),tamlar=s.dersler.filter(tamListe);
  const iyi=kendi.filter(x=>x.f&&x.f.rmse/x.f.sigma<ESIK_UYUM).map(x=>x.f.n);
  const tamN=tamlar.length&&!kendi.length?ortanca(tamlar.map(d=>d.satir.length)):null;
  const n=iyi.length?ortanca(iyi):tamN,dersler=new Map();
  for(const d of tamlar){const g=tamDagilim(d.satir);if(g)dersler.set(anahtar(d.kod),{mu:g.mu,sigma:g.sigma,rmse:0,uyum:0,kendiN:null,tam:true,n:g.n})}
  for(const {d,f} of kendi){
    const g=!iyi.length?null:siraUydur(d.satir,d.genel,n);
    if(g)dersler.set(anahtar(d.kod),{mu:d.genel,sigma:g.sigma,rmse:g.rmse,uyum:g.rmse/g.sigma,kendiN:f?f.n:null,tam:false,n});
  }
  const cift=new Map();
  if(iyi.length){
    const liste=s.dersler.filter(d=>!tamListe(d)&&dersler.has(anahtar(d.kod))).map(d=>({k:anahtar(d.kod),sigma:dersler.get(anahtar(d.kod)).sigma,net:new Map(d.satir.map(r=>[anahtar(r.ad),r.net])),sd:sdAl(d.satir.map(r=>r.net))}));
    for(let i=0;i<liste.length;i++)for(let j=i+1;j<liste.length;j++){const c=ciftKorelasyon(liste[i],liste[j]);if(c)cift.set(liste[i].k+'|'+liste[j].k,c);cift.set(liste[j].k+'|'+liste[i].k,c)}
  }
  const sonuc={n,aralik:iyi.length?[Math.min(...iyi),Math.max(...iyi)]:null,adet:iyi.length,dersler,cift};
  if(DAGILIM_ONBELLEK.size>200)DAGILIM_ONBELLEK.clear();
  DAGILIM_ONBELLEK.set(imza,sonuc);return sonuc;
}
const tPuani=(x,mu,sigma)=>Number.isFinite(x)&&Number.isFinite(mu)&&sigma>0?50+10*(x-mu)/sigma:null;
// The place a net would take among N schools: 1 + (N − 1)(1 − Φ(z)). enAz: outside a printed list the place is
// beyond the list's last row, so it is never estimated above it.
function tahminiSira(x,mu,sigma,N,enAz){
  if(!Number.isFinite(x)||!Number.isFinite(mu)||!(sigma>0)||!(N>1))return null;
  const r=Math.round(1+(N-1)*(1-normCdf((x-mu)/sigma)));
  return Math.max(enAz||1,Math.min(Math.max(N,enAz||1),r));
}
// The total's sigma: σ² = Σσ_i² + 2Σ_{i<j} R_ij σ_i σ_j. R is a matrix of corrected between-subject correlations of
// school means (toplamKorelasyon), or one number for every pair.
function toplamSigma(sigmalar,R=TOPLAM_KORELASYON){
  if(!sigmalar.length||sigmalar.some(v=>!(v>0)))return null;
  let v=sigmalar.reduce((t,x)=>t+x*x,0);
  for(let i=0;i<sigmalar.length;i++)for(let j=i+1;j<sigmalar.length;j++)v+=2*(typeof R==='number'?R:R[i][j])*sigmalar[i]*sigmalar[j];
  return Math.sqrt(v);
}
// Sıralamalar' own school average (Kurum Ortalamaları) of a subject: the net of the school's own students for an
// exam when the school is outside that subject's list. Keys are Sıralamalar' column keys.
const SIRA_ANAHTARI=new Map([['TÜRKÇE-T','TÜR'],['TARİH-T','TAR'],['COĞRAFYA-T','COĞ'],['FELSEFE-T','FEL'],['DİN KÜLTÜRÜ-T','DİN'],['MATEMATİK-T','MAT'],['GEOMETRİ-T','GEO'],['FİZİK-T','FİZ'],['KİMYA-T','KİM'],['BİYOLOJİ-T','BİY']]
  .map(([k,v])=>[anahtar(k),['tyt',v]]).concat([['TÜRK DİLİ VE EDB-A','EDB'],['TARİH.1-A','TAR1'],['COĞRAFYA.1-A','COĞ1'],['TARİH.2-A','TAR2'],['COĞRAFYA.2-A','COĞ2'],['FELSEFE GR.-A','FELGR'],['DİN KÜLTÜRÜ-A','DİN2'],
  ['MATEMATİK-A','AMAT'],['GEOMETRİ-A','AGEO'],['FİZİK-A','AFİZ'],['KİMYA-A','AKİM'],['BİYOLOJİ-A','ABİY']].map(([k,v])=>[anahtar(k),['ayt',v]])));
function kurumNetiKaynagi(sl){
  const onbellek=new Map();
  return (ad,kod)=>{
    const k=anahtar(ad);
    if(!onbellek.has(k)){const s=sl.find(x=>anahtar(x.ad)===k);let m=null;if(s){try{m=SIRALAMA.model(s)}catch(e){m=null}}onbellek.set(k,m)}
    const m=onbellek.get(k),b=SIRA_ANAHTARI.get(anahtar(kod));if(!m||!b)return null;
    const g=m[b[0]],net=g&&g.kurum&&g.kurum.net?g.kurum.net[b[1]]:null;
    return typeof net==='number'&&Number.isFinite(net)?net:null;
  };
}

/* ---------------- model ---------------- */
// The exam's date is Sıralamalar' (the school list of the same exam, corrected date first), else the
// report's print day. The school the page follows: the one chosen, else the school named on the
// Sıralamalar lists when exactly one school in the lists matches it.
function siralamaSinavlari(){
  try{if(typeof SIRALAMA==='undefined')return [];const {veri}=SIRALAMA.oku();return veri?veri.sinavlar:[]}catch(e){return []}
}
function sinavGunu(ad,sl){
  const k=anahtar(ad),s=sl.find(x=>anahtar(x.ad)===k);if(!s)return null;
  return gunDan(s.tarih)??gunDan(s.T&&s.T.tarih)??gunDan(s.F&&s.F.tarih);
}
function okulTahmini(adlar,sl){
  const okullar=[...new Set(sl.map(s=>anahtar(s.okul||'')).filter(Boolean))];
  for(const o of okullar){const t=adlar.find(a=>anahtar(a)===o);if(t)return t}
  for(const o of okullar){const l=adlar.filter(a=>{const k=anahtar(a);return k.includes(o)||o.includes(k)});if(l.length===1)return l[0]}
  return null;
}
// One subject in one exam, seen from the followed school (k: its row, -1 when it is not in the list).
function noktaAl(d,okulK,dg,alt){
  const n=d.satir.length,k=okulK?d.satir.findIndex(r=>anahtar(r.ad)===okulK):-1,r=k>=0?d.satir[k]:null;
  let esit=null;if(r){const a=d.satir.filter(q=>Math.abs(q.net-r.net)<1e-9).map(q=>q.sira);if(a.length>1)esit=[Math.min(...a),Math.max(...a)]}
  // Its place with one more net: after every school with a higher net than that.
  const birNet=r&&k>0?d.satir.filter(q=>q.net>r.net+1+1e-9).length+1:null;
  // T: the school's own net (its row; outside the list Sıralamalar' school average, else none) against the Türkiye
  // average and the between-school spread. The place is the printed one; only outside the list it is estimated.
  const x=r?r.net:Number.isFinite(alt)?alt:null,kaynak=r?'liste':x!==null?'okul':null,sonSira=Math.max(0,...d.satir.map(q=>q.sira));
  const t=dg&&x!==null?tPuani(x,dg.mu,dg.sigma):null;
  const tahmin=!r&&dg&&!dg.tam&&x!==null?tahminiSira(x,dg.mu,dg.sigma,dg.n,sonSira+1):null;
  return {soru:d.soru,genel:d.genel,n,ilk:d.satir[0],son:d.satir[n-1],satir:d.satir,k,sira:r?r.sira:null,net:r?r.net:null,esit,birNet,tNet:x,kaynak,t,tahmin,dg:dg||null};
}
const yer=p=>p.sira??p.n+1;
function ozetAl(dersler,i){
  const var_=dersler.filter(d=>d.seri[i]);if(!var_.length)return null;
  const ic=var_.filter(d=>d.seri[i].sira!==null);
  return {ders:var_.length,ilk:ic.length,ort:var_.reduce((t,d)=>t+yer(d.seri[i]),0)/var_.length,
    ustu:var_.filter(d=>d.seri[i].net!==null&&d.seri[i].net>d.seri[i].genel+1e-9).length,
    enIyi:ic.slice().sort((a,b)=>a.seri[i].sira-b.seri[i].sira)[0]||null};
}
// The grade of an exam in Sıralamalar: the grade most of its students are in.
function siralamaDuzeyi(ad,sl){
  const k=anahtar(ad),s=sl.find(x=>anahtar(x.ad)===k);if(!s)return null;
  try{const d=SIRALAMA.model(s).sinif;return DUZEYLER.includes(d)&&d?d:null}catch(e){return null}
}
// sec: {liste, duzey (a grade group: 'd12' … 'd', or 'tum'), oturum, simdi and onceki (exam ids), mod, okul (a viewer's choice)}.
// An exam's grade: the teacher's choice, else its name, else Sıralamalar. An exam whose grade is not
// known joins the main group (12. sınıf, else the grade with the most exams), so it is never hidden.
function model(v,sec={}){
  const A=ac(v),sl=siralamaSinavlari();
  const tum=A.sinavlar.map(s=>{const g=sinavGunu(s.ad,sl),oto=adDuzeyi(s.ad)??siralamaDuzeyi(s.ad,sl),d=s.duzey!==undefined?s.duzey:oto;
    return {...s,duzeyOto:oto,duzeyElle:s.duzey!==undefined,grup:d===null?null:d===0?'d':'d'+d,g:g??s.yaz,gKaynak:g!==null?'sinav':s.yaz!==null?'rapor':null}});
  const listeler=LISTELER.map(l=>l[0]).filter(l=>tum.some(s=>s.liste===l));
  const liste=listeler.includes(sec.liste)?sec.liste:listeler[0]||null;
  const l1=tum.filter(s=>s.liste===liste),sayac=new Map();l1.forEach(s=>{if(s.grup)sayac.set(s.grup,(sayac.get(s.grup)||0)+1)});
  const ana=sayac.has('d12')?'d12':[...sayac].sort((a,b)=>b[1]-a[1]||grupSira(b[0])-grupSira(a[0]))[0]?.[0]??null;
  tum.forEach(s=>{s.yer=s.grup??(s.liste===liste?ana:null)});
  const gruplar=[...sayac.keys()].sort((a,b)=>grupSira(b)-grupSira(a)),duzeyler=gruplar.length>1?[...gruplar,'tum']:gruplar;
  const duzey=duzeyler.includes(sec.duzey)?sec.duzey:ana??'tum';
  const sinavlar=l1.filter(s=>duzey==='tum'||s.yer===duzey).sort((a,b)=>(a.g??1e9)-(b.g??1e9)||a.ad.localeCompare(b.ad,'tr',{numeric:true}));
  const oturumlar=OTURUMLAR.filter(o=>sinavlar.some(s=>s.dersler.some(d=>dersBilgi(d.kod).oturum===o)));
  const oturum=oturumlar.includes(sec.oturum)?sec.oturum:oturumlar[0]||null;
  const okullar=[...new Map(sinavlar.flatMap(s=>s.dersler.flatMap(d=>d.satir.map(r=>[anahtar(r.ad),r.ad])))).values()].sort((a,b)=>a.localeCompare(b,'tr'));
  const aday=sec.okul||A.okul||okulTahmini(okullar,sl),okulK=aday?anahtar(aday):null;
  const okul=okulK?okullar.find(a=>anahtar(a)===okulK)||aday:null;
  const okulKaynak=!okul?null:sec.okul?'gecici':A.okul?'secili':'tahmin';
  let simdi=sinavlar.findIndex(s=>s.id===sec.simdi);if(simdi<0)simdi=sinavlar.length-1;
  // Artış compares the first exam of the chart with the latest (the whole run); Sıra the exam before.
  let onceki=sinavlar.findIndex(s=>s.id===sec.onceki);
  if(sec.mod==='tpuan'&&sec.aralik!=='sec'){const ar=String(sec.aralik||'tum');onceki=simdi>0?(ar==='tum'?0:Math.max(0,simdi-(ar==='1'?1:Number(ar)-1))):null}
  else if(onceki<0||onceki>=simdi)onceki=simdi>0?(sec.mod==='artis'?0:simdi-1):null;
  // Between-school spread and the pooled number of schools, per exam and list kind.
  sinavlar.forEach(s=>{s.dag=dagilimAl(s)});
  // A school outside a subject's list: Sıralamalar' school average, only when Sıralamalar is about this school.
  const kurumNeti=kurumNetiKaynagi(sl),kurumOk=!!okulK&&!!okulTahmini(okullar,sl)&&anahtar(okulTahmini(okullar,sl))===okulK;
  const kodlar=new Map();
  for(const s of sinavlar)for(const d of s.dersler){const b=dersBilgi(d.kod),k=anahtar(d.kod);if(b.oturum===oturum&&!kodlar.has(k))kodlar.set(k,{kod:d.kod,...b})}
  const dersler=[...kodlar.values()].sort((a,b)=>a.sira-b.sira||a.ad.localeCompare(b.ad,'tr')).map((b,i)=>{
    const seri=sinavlar.map(s=>{const d=s.dersler.find(x=>anahtar(x.kod)===anahtar(b.kod));if(!d)return null;
      const g=s.dag.dersler.get(anahtar(d.kod)),dg=g?{...g,n:g.tam?g.n:s.dag.n,aralik:g.tam?null:s.dag.aralik,adet:s.dag.adet,cift:s.dag.cift}:null;
      return noktaAl(d,okulK,dg,okulK&&kurumNeti&&kurumOk?kurumNeti(s.ad,d.kod):null)});
    const son=seri.filter(Boolean).pop();
    return {kod:b.kod,ad:b.ad,oturum:b.oturum,soru:son?son.soru:null,renk:PALET[i%PALET.length],seri};
  });
  const N=Math.max(1,...dersler.flatMap(d=>d.seri.filter(Boolean).map(p=>p.n)));
  const ozet=sinavlar.map((_,i)=>okul?ozetAl(dersler,i):null);
  // Increases. A measure is a subject or a total over subjects (kodlar); its value for a school (key)
  // or for the Türkiye average (null) is missing when any part is missing.
  const harita=sinavlar.map(s=>new Map(s.dersler.map(d=>[anahtar(d.kod),{genel:d.genel,net:new Map(d.satir.map(r=>[anahtar(r.ad),r.net]))}])));
  const adMap=new Map(okullar.map(a=>[anahtar(a),a]));
  const r2=x=>Math.round(x*100)/100;
  const deger=(i,kodlar,key)=>{let t=0;for(const k of kodlar){const d=harita[i].get(k);if(!d)return null;const v=key===null?d.genel:d.net.get(key);if(v===undefined)return null;t+=v}return r2(t)};
  // Every school with the measure in both exams, by its increase (equal increases share a place).
  const artisAl=kodlar=>{
    if(onceki===null)return null;const a=onceki,b=simdi,keys=new Set();
    for(const k of kodlar){const d=harita[b].get(k);if(d)for(const x of d.net.keys())keys.add(x)}
    const satir=[];for(const key of keys){const o=deger(a,kodlar,key),n=deger(b,kodlar,key);if(o!==null&&n!==null)satir.push({key,ad:adMap.get(key)||key,once:o,simdi:n,fark:r2(n-o)})}
    satir.sort((x,y)=>y.fark-x.fark||x.ad.localeCompare(y.ad,'tr'));
    satir.forEach((r,j)=>{r.sira=j&&Math.abs(satir[j-1].fark-r.fark)<1e-9?satir[j-1].sira:j+1});
    const bo=okulK?deger(a,kodlar,okulK):null,bs=okulK?deger(b,kodlar,okulK):null,go=deger(a,kodlar,null),gs=deger(b,kodlar,null);
    const fark=bo!==null&&bs!==null?r2(bs-bo):null,genelFark=go!==null&&gs!==null?r2(gs-go):null,goreli=fark!==null&&genelFark!==null?r2(fark-genelFark):null;
    // Each step between two neighbouring exams of the run; the total is the first exam against the last,
    // and the average is the total over the steps (a step is empty when the school is outside a list).
    const adimlar=[];
    for(let j=a+1;j<=b;j++){
      const o=okulK?deger(j-1,kodlar,okulK):null,n=okulK?deger(j,kodlar,okulK):null,g0=deger(j-1,kodlar,null),g1=deger(j,kodlar,null);
      const f=o!==null&&n!==null?r2(n-o):null,gf=g0!==null&&g1!==null?r2(g1-g0):null;
      adimlar.push({onceki:sinavlar[j-1].ad,ad:sinavlar[j].ad,once:o,simdi:n,fark:f,genelFark:gf,goreli:f!==null&&gf!==null?r2(f-gf):null});
    }
    const adim=b-a,bol=x=>x===null?null:r2(x/adim);
    return {satir,biz:okulK?satir.find(r=>r.key===okulK)||null:null,once:bo,simdi:bs,fark,genelOnce:go,genelSimdi:gs,genelFark,goreli,adim,adimlar,ort:bol(fark),genelOrt:bol(genelFark),goreliOrt:bol(goreli)};
  };
  for(const d of dersler)d.artis=artisAl([anahtar(d.kod)]);
  // A total's T: the sum of the school's subject nets against the sum of the Türkiye averages. The report has no total
  // ranking, so its sigma is toplamSigma of the subjects' sigmas; the place is always an estimate. Missing: the school's
  // net in a subject (outside its list, no Sıralamalar average) or the spread; the point is then empty, not a guess.
  const dersHarita=new Map(dersler.map(d=>[anahtar(d.kod),d]));
  const toplamT=kodlar=>sinavlar.map((_,i)=>{
    const ps=kodlar.map(k=>{const d=dersHarita.get(k);return d?d.seri[i]:null});
    if(!ps.length||ps.some(p=>!p))return null;
    const mu=ps.reduce((a,p)=>a+p.genel,0),bos={t:null,sira:null,tahmin:null,net:null,genel:mu,sigma:null,n:null,aralik:null,kaynak:null,ortT:null,yok:ps.some(p=>p.tNet===null)?'net':'dagilim'};
    if(ps.some(p=>p.tNet===null))return bos;
    const net=ps.reduce((a,p)=>a+p.tNet,0),kaynak=ps.every(p=>p.kaynak==='liste')?'liste':'okul';
    if(ps.some(p=>!p.dg))return {...bos,net,kaynak,yok:'dagilim'};
    if(ps.every(p=>p.dg.tam)){
      // Complete lists: the total's own distribution, from each school's summed nets; the place is the exact one.
      const tt=tamToplam(sinavlar[i],kodlar);
      if(tt){const sira=kaynak==='liste'?tt.sirasi(net):null;
        return {t:tPuani(net,tt.mu,tt.sigma),sira,tahmin:null,net,genel:tt.mu,sigma:tt.sigma,n:tt.n,aralik:null,tam:true,kaynak,ortT:ps.reduce((a,p)=>a+p.t,0)/ps.length,yok:null,rOrt:null,rVarsayilan:false}}
    }
    const kor=toplamKorelasyon(kodlar,ps[0].dg.cift),sigma=toplamSigma(ps.map(p=>p.dg.sigma),kor.R),n=ps[0].dg.n,t=tPuani(net,mu,sigma);
    return {t,sira:null,tahmin:tahminiSira(net,mu,sigma,n,1),net,genel:mu,sigma,n,aralik:ps[0].dg.aralik,kaynak,ortT:ps.reduce((a,p)=>a+p.t,0)/ps.length,yok:null,rOrt:kor.ortanca,rVarsayilan:kor.varsayilan};
  });
  const dersK=new Set(dersler.map(d=>anahtar(d.kod)));
  const toplamlar=(TOPLAMLAR[oturum]||[]).map(([key,ad,l])=>({key,ad,kodlar:l?l.map(anahtar):[...dersK]})).filter(t=>t.kodlar.length&&t.kodlar.every(k=>dersK.has(k)));
  const toplam=toplamlar.find(t=>t.key===sec.toplam)||toplamlar[0]||null;
  if(toplam){toplam.seri=sinavlar.map((_,i)=>({okul:okulK?deger(i,toplam.kodlar,okulK):null,genel:deger(i,toplam.kodlar,null)}));toplam.artis=artisAl(toplam.kodlar);toplam.tseri=toplamT(toplam.kodlar)}
  // The mean of the subjects' T, for a session with no total (and as a second reading of the total).
  const ortT={ad:'Ders ortalaması T',tseri:sinavlar.map((_,i)=>{const l=dersler.map(d=>d.seri[i]).filter(p=>p&&p.t!==null);
    return l.length?{t:l.reduce((a,p)=>a+p.t,0)/l.length,adet:l.length,sira:null,tahmin:null,net:null,genel:null,sigma:null,n:null,aralik:null,kaynak:null,ortT:null}:null})};
  return {tum,listeler,liste,ana,duzeyler,duzey,sinavlar,oturumlar,oturum,okullar,okul,okulKaynak,simdi,onceki,dersler,N,ozet,toplamlar,toplam,ortT};
}
function durumAl(v){
  const m=model(v,{liste:EK.tgListe,duzey:EK.tgDuzey,oturum:EK.tgOturum,simdi:EK.tgSimdi,onceki:EK.tgOnceki,toplam:EK.tgToplam,okul:EK.tgOkul,mod:modAl(EK.tgMod),aralik:aralikAl(EK.tgAralik)});
  const odak=EK.tgDers&&m.okul?m.dersler.find(d=>anahtar(d.kod)===anahtar(EK.tgDers))||null:null;
  return {m,odak,mod:modAl(EK.tgMod),grafik:grafikAl(EK.tgGrafik),aralik:aralikAl(EK.tgAralik)};
}
// Places moved from the önceki exam to the şimdiki one (a school outside the list counts as N + 1).
function siraFarki(d,m){
  const p=d.seri[m.simdi],q=m.onceki===null?null:d.seri[m.onceki];
  if(!p||!q||p.sira===null&&q.sira===null)return null;
  return yer(q)-yer(p);
}

// The Türkiye average of the exams that Sıralamalar lists too (Öğrenci kartı, src/analiz.js). An exam is matched by its
// name, the same match that dates a Türkiye list from Sıralamalar (sinavGunu); the Kolej list comes first when an exam
// has several lists. Returns ad => null (no list) or {ad, liste, kodlar, genel(kod), toplam(oturum)}; genel(kod) is the
// subject's Türkiye average (null when the list lacks it); toplam('TYT' | 'SAY' | 'EA' | 'SÖZ') is {genel, kodlar}:
// the sum of the total's subjects and which they are, null when the list lacks one of them (TYT sums every TYT subject
// the list has).
function ortalamalar(v){
  const sira=LISTELER.map(l=>l[0]),harita=new Map();
  for(const s of ac(v).sinavlar){const k=anahtar(s.ad),eski=harita.get(k);if(!eski||sira.indexOf(s.liste)<sira.indexOf(eski.liste))harita.set(k,s)}
  const r2=x=>Math.round(x*100)/100;
  return ad=>{
    const s=harita.get(anahtar(ad));if(!s)return null;
    const genel=new Map(s.dersler.map(d=>[anahtar(d.kod),d]));
    const al=kod=>genel.has(anahtar(kod))?genel.get(anahtar(kod)).genel:null;
    const toplam=oturum=>{
      let kodlar;
      if(oturum==='TYT')kodlar=s.dersler.filter(d=>dersBilgi(d.kod).oturum==='TYT').map(d=>d.kod);
      else{const t=TOPLAMLAR.AYT.find(x=>x[0]===oturum);kodlar=t?t[2]:[]}
      if(!kodlar.length||kodlar.some(k=>al(k)===null))return null;
      return {genel:r2(kodlar.reduce((t,k)=>t+al(k),0)),kodlar};
    };
    return {ad:s.ad,liste:s.liste,kodlar:s.dersler.map(d=>d.kod),genel:al,toplam};
  };
}

/* ---------------- charts (SVG strings, sized to their box) ---------------- */
const CIZIMLER=new Map();
function tikler(lo,hi,n){
  const span=Math.max(1e-9,hi-lo),ham=span/n,us=Math.pow(10,Math.floor(Math.log10(ham))),adim=[1,2,2.5,5,10].map(k=>k*us).find(k=>k>=ham-1e-9);
  const a=Math.floor(lo/adim)*adim,out=[];for(let v=a;v<hi+adim-1e-9;v+=adim)out.push(Math.round(v*1000)/1000);return out;
}
const yaziGen=s=>String(s).length*7;
const yol=pts=>GRAFIK_CIZGI.yol(pts);
const imlec=(ust,alt)=>'<line class="et-kural" y1="'+ust+'" y2="'+alt+'" x1="0" x2="0" visibility="hidden"/><g class="et-imlecler"></g>';
// "27-YKS-1201", "27-YKS-1202" → "1201", "1202": the common start up to its last separator goes.
function kisaAdlar(d){
  if(d.length<2)return d.map(s=>s.ad);
  let p=d[0].ad;for(const s of d)while(p&&!s.ad.startsWith(p))p=p.slice(0,-1);
  const kes=Math.max(p.lastIndexOf('-'),p.lastIndexOf('_'),p.lastIndexOf(' '))+1;
  return d.map(s=>{const t=s.ad.slice(kes)||s.ad;return t.length>14?t.slice(0,13)+'…':t});
}
function eksenX(d,x,step,W,y0){
  const ad=kisaAdlar(d),gen=Math.max(...ad.map(yaziGen)),her=Math.max(1,Math.ceil((gen+12)/step)),n=d.length;let out='';
  d.forEach((s,i)=>{if((n-1-i)%her)return;const t=ad[i],w=yaziGen(t);let xx=x(i),a='middle';
    if(xx-w/2<0){xx=0;a='start'}else if(xx+w/2>W){xx=W;a='end'}out+='<text class="et-tik" x="'+r1(xx)+'" y="'+y0+'" text-anchor="'+a+'">'+kacis(t)+'</text>'});
  return out;
}
// The önceki and şimdiki exams' columns, lightly shaded.
function bantlar(m,x,step,ust,alt){
  return [['once',m.onceki],['son',m.simdi]].filter(([,i])=>i!==null&&i>=0).map(([c,i])=>'<rect class="et-bant '+c+'" x="'+r1(x(i)-step/2)+'" y="'+ust+'" width="'+r1(step)+'" height="'+(alt-ust)+'"/>').join('');
}
const sinavBasligi=s=>s.ad+(s.g!==null&&s.g!==undefined?' · '+gunAy(s.g):'');
// ▲2,35 / ▼1,10: a change in nets.
const artisOk=v=>v===null||v===undefined?'—':(v>0?'▲':v<0?'▼':'')+f2(Math.abs(v));
const siraKisa=p=>p.sira!==null?fi(p.sira)+'.':'İlk '+fi(p.n)+' dışı';
// "İlk 100’de"; the suffix is only sure for 100, other list lengths say "Listede".
const ilkte=N=>N===100?'İlk 100’de':'Listede';
// A line through pts ([x, y, dışı] or null): solid between points in the list, dashed to and from the
// "dışı" lane, broken where the subject is missing.
function cizgiParcalari(pts,sinif,stil,ek){
  let out='',run=[];
  const bitir=()=>{if(run.length>1)out+='<path class="'+sinif+'"'+ek+' style="'+stil+'" d="'+yol(run)+'"/>';run=[]};
  pts.forEach(p=>{if(!p||p[2])bitir();else run.push(p)});bitir();
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(a&&b&&(a[2]||b[2]))out+='<path class="'+sinif+' kesik"'+ek+' style="'+stil+'" d="M'+r1(a[0])+','+r1(a[1])+'L'+r1(b[0])+','+r1(b[1])+'"/>'}
  return out;
}
function noktalarCiz(pts,renk,ek,hepsi){
  return pts.map((p,i)=>{if(!p)return '';
    if(p[2])return '<circle class="tg-disi-nokta"'+ek+' cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="3.5" style="stroke:'+renk+'"/>';
    const yalniz=!(pts[i-1]&&!pts[i-1][2])&&!(pts[i+1]&&!pts[i+1][2]);
    return hepsi||yalniz?'<circle'+ek+' cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="3" style="fill:'+renk+'"/>':'';
  }).join('');
}
function sagEtiket(y,R,yazi,ust){
  const tw=yaziGen(yazi)+12;
  return '<rect class="et-etiket tg-etiket" x="'+(R+3)+'" y="'+r1(Math.max(ust,y-9))+'" width="'+tw+'" height="18" rx="4"/><text class="et-etiket-yazi" x="'+r1(R+3+tw/2)+'" y="'+r1(Math.max(ust+9,y))+'" dy="0.32em" text-anchor="middle">'+kacis(yazi)+'</text>';
}
// Sıra: 1 at the top. Every subject is a line (the one under the pointer takes the stage) and the bold
// line is the average place; with a subject chosen, only that subject. A school outside the list sits on
// the "dışı" lane under the last place.
function grafikSira(st,W){
  const m=st.m,d=m.sinavlar,H=320,N=m.N,odak=st.odak,seri=odak?[odak]:m.dersler;if(!d.length||!m.okul)return null;
  const tik=[...new Set([1,...[10,20,25,40,50,60,75,80,100,120,125,150].filter(t=>t<N-4&&(N<=60?t%10===0:t%(N>100?25:20)===0)),N])];
  const disi=W>=480?'İlk '+fi(N)+' dışı':'dışı',L=2,ust=22,alt=H-60,disY=H-34,R=W-(Math.max(...tik.map(t=>yaziGen(fi(t)+'.')),yaziGen(disi))+24);
  const step=(R-L)/d.length,x=i=>L+step*(i+.5),y=s=>s===null?disY:ust+(Math.min(s,N)-1)/Math.max(1,N-1)*(alt-ust);
  const yOrt=v=>v<=N?y(v):alt+(disY-alt)*Math.min(1,v-N);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+bantlar(m,x,step,4,disY+12);
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+L+'" x2="'+R+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+(R+8)+'" y="'+r1(y(t))+'" dy="0.32em">'+fi(t)+'.</text>').join('');
  svg+='<line class="tg-disi-cizgi" x1="'+L+'" x2="'+R+'" y1="'+r1(disY)+'" y2="'+r1(disY)+'"/><text class="et-tik" x="'+(R+8)+'" y="'+r1(disY)+'" dy="0.32em">'+disi+'</text>';
  const coklu=!odak&&seri.length>1,ek=k=>coklu?' data-seri="'+k+'"':'';
  const ptsAl=s=>d.map((_,i)=>s.seri[i]?[x(i),y(s.seri[i].sira),s.seri[i].sira===null]:null);
  for(let k=seri.length-1;k>=0;k--){const s=seri[k],pts=ptsAl(s);
    svg+=cizgiParcalari(pts,'et-cizgi '+(odak?'kalin':'ince'),'stroke:'+s.renk,ek(k))+noktalarCiz(pts,s.renk,ek(k),!!odak||d.length<3)}
  let son;
  if(odak){const i=[...d.keys()].reverse().find(i=>odak.seri[i]);if(i!==undefined)son=[y(odak.seri[i].sira),siraKisa(odak.seri[i]).replace(/^İlk \d+ /,'')]}
  else{
    const pts=d.map((_,i)=>m.ozet[i]?[x(i),yOrt(m.ozet[i].ort)]:null);let run=[];
    const bitir=()=>{if(run.length>1)svg+='<path class="tg-ort" d="'+yol(run)+'"/>';run=[]};pts.forEach(p=>{if(p)run.push(p);else bitir()});bitir();
    svg+=pts.map(p=>p?'<circle class="tg-ort-nokta" cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="3"/>':'').join('');
    const i=[...d.keys()].reverse().find(i=>m.ozet[i]);if(i!==undefined)son=[yOrt(m.ozet[i].ort),f1(m.ozet[i].ort)];
  }
  if(son)svg+=sagEtiket(son[0],R,son[1],ust-10);
  svg+=eksenX(d,x,step,W,H-6)+imlec(ust-10,disY+8)+'</svg>';
  const satirlar=(i,vurgu)=>m.dersler.filter(s=>s.seri[i]).sort((a,b)=>yer(a.seri[i])-yer(b.seri[i])||a.seri[i].n-b.seri[i].n)
    .map(s=>[s.renk,s.ad,siraKisa(s.seri[i]),'cizgi',s===vurgu]);
  const ozetSatir=i=>m.ozet[i]?[['var(--e-fg)','Ortalama sıra',f1(m.ozet[i].ort),'cizgi'],[null,ilkte(N),fi(m.ozet[i].ilk)+' / '+fi(m.ozet[i].ders)+' ders']]:[];
  const ipucu=d.map((s,i)=>{
    if(!odak)return {bas:sinavBasligi(s),satir:ozetSatir(i).concat(satirlar(i))};
    const p=odak.seri[i];if(!p)return {bas:sinavBasligi(s),satir:[[odak.renk,odak.ad,'bu denemede yok','cizgi']]};
    return {bas:sinavBasligi(s),satir:[[odak.renk,odak.ad,siraKisa(p),'cizgi'],[null,'Net',p.net===null?'—':f2(p.net)+' / '+fi(p.soru)],[null,'Türkiye ortalaması',f2(p.genel)],
      ...(p.esit?[[null,'Aynı netle',fi(p.esit[0])+'.–'+fi(p.esit[1])+'. sıra']]:[]),...(p.birNet?[[null,'1 net daha',fi(p.birNet)+'. sıra']]:[]),[null,'1. kurum',f2(p.ilk.net)+' net']]};
  });
  const noktalar=d.map((_,i)=>odak?(odak.seri[i]?[[y(odak.seri[i].sira),odak.renk]]:[]):seri.filter(s=>s.seri[i]).map(s=>[y(s.seri[i].sira),s.renk]).concat(m.ozet[i]?[[yOrt(m.ozet[i].ort),'var(--e-fg)']]:[]));
  const ys=d.map((_,i)=>odak&&odak.seri[i]?y(odak.seri[i].sira):m.ozet[i]?yOrt(m.ozet[i].ort):ust+40);
  return {svg,xs:d.map((_,i)=>x(i)),ys,noktalar,ipucu,
    ...(coklu?{seriler:seri.map(s=>({kod:s.kod,pts:ptsAl(s)})),seriNokta:(k,i)=>seri[k].seri[i]?[[y(seri[k].seri[i].sira),seri[k].renk]]:[],
      seriIpucu:(k,i)=>({bas:ipucu[i].bas,satir:ozetSatir(i).concat(satirlar(i,seri[k]))})}:{})};
}
// Net of the chosen subject: the school, the Türkiye average (dashed) and the band from the list's last
// school to its first. Outside the list the school's net is not printed: a hollow dot on the band's edge.
function grafikNet(st,W){
  const m=st.m,d=m.sinavlar,s=st.odak,H=280;if(!s||!d.length)return null;
  const vals=[];d.forEach((_,i)=>{const p=s.seri[i];if(p)vals.push(p.ilk.net,p.son.net,p.genel,...(p.net===null?[]:[p.net]))});if(!vals.length)return null;
  const lo=Math.min(...vals),hi=Math.max(...vals),tik=tikler(Math.min(0,lo),hi+(hi-lo)*.08+.2,5);
  const L=2,ust=22,alt=H-26,R=W-Math.max(...tik.map(t=>yaziGen(f1(t))))-30,step=(R-L)/d.length,x=i=>L+step*(i+.5);
  const y=v=>alt-(v-tik[0])/(tik[tik.length-1]-tik[0])*(alt-ust);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+bantlar(m,x,step,4,alt);
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+L+'" x2="'+R+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+(R+8)+'" y="'+r1(y(t))+'" dy="0.32em">'+(Number.isInteger(t)?fi(t):f1(t))+'</text>').join('');
  svg+='<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
  // The band and the lines break where the subject is missing.
  const kosular=[];let k=[];d.forEach((_,i)=>{if(s.seri[i])k.push(i);else{if(k.length)kosular.push(k);k=[]}});if(k.length)kosular.push(k);
  for(const r of kosular){
    if(r.length>1){const ustK=r.map(i=>[x(i),y(s.seri[i].ilk.net)]),altK=r.map(i=>[x(i),y(s.seri[i].son.net)]).reverse();svg+='<path class="tg-bant" d="'+yol(ustK)+'L'+yol(altK).slice(1)+'Z"/>'}
    else{const p=s.seri[r[0]];svg+='<rect class="tg-bant" x="'+r1(x(r[0])-6)+'" y="'+r1(y(p.ilk.net))+'" width="12" height="'+r1(Math.max(1,y(p.son.net)-y(p.ilk.net)))+'" rx="3"/>'}
    const g=r.map(i=>[x(i),y(s.seri[i].genel)]);svg+=g.length>1?'<path class="tg-genel" d="'+yol(g)+'"/>':'<line class="tg-genel" x1="'+r1(g[0][0]-8)+'" x2="'+r1(g[0][0]+8)+'" y1="'+r1(g[0][1])+'" y2="'+r1(g[0][1])+'"/>';
  }
  const pts=d.map((_,i)=>{const p=s.seri[i];return p?[x(i),y(p.net===null?p.son.net:p.net),p.net===null]:null});
  svg+=cizgiParcalari(pts,'et-cizgi kalin','stroke:'+s.renk,'')+noktalarCiz(pts,s.renk,'',true);
  const i0=[...d.keys()].reverse().find(i=>s.seri[i]&&s.seri[i].net!==null);
  if(i0!==undefined)svg+=sagEtiket(pts[i0][1],R,f2(s.seri[i0].net),ust-10);
  svg+=eksenX(d,x,step,W,H-6)+imlec(ust-10,alt)+'</svg>';
  const ipucu=d.map((sn,i)=>{const p=s.seri[i];if(!p)return {bas:sinavBasligi(sn),satir:[[s.renk,s.ad,'bu denemede yok','cizgi']]};
    return {bas:sinavBasligi(sn),satir:[[s.renk,m.okul?okulAdi(m.okul):'Okul',p.net===null?'İlk '+fi(p.n)+' dışı':f2(p.net)+' net','cizgi'],['var(--e-fg2)','Türkiye ortalaması',f2(p.genel)+' net','kesik'],
      ['var(--e-c1)','İlk '+fi(p.n)+' aralığı',f2(p.son.net)+' – '+f2(p.ilk.net),'bant'],[null,'1. kurum',okulAdi(p.ilk.ad)]]}});
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map((_,i)=>pts[i]?pts[i][1]:ust+40),noktalar:d.map((_,i)=>pts[i]?[[pts[i][1],s.renk],[y(s.seri[i].genel),'var(--e-fg2)']]:[]),ipucu};
}
// A total's net, the school against the Türkiye average (dashed), exam by exam: the line the increases
// are read from. The axis starts near the values so the change shows.
function grafikToplam(st,W){
  const m=st.m,d=m.sinavlar,T=m.toplam,H=280;if(!T||!d.length||!m.okul)return null;
  const vals=T.seri.flatMap(p=>[p.okul,p.genel]).filter(v=>v!==null);if(!vals.length)return null;
  const lo=Math.min(...vals),hi=Math.max(...vals),pay=Math.max(1,(hi-lo)*.25),tik=tikler(Math.max(0,lo-pay),hi+pay,5);
  const L=2,ust=22,alt=H-26,R=W-Math.max(...tik.map(t=>yaziGen(f1(t))))-30,step=(R-L)/d.length,x=i=>L+step*(i+.5);
  const y=v=>alt-(v-tik[0])/(tik[tik.length-1]-tik[0])*(alt-ust);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+bantlar(m,x,step,4,alt);
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+L+'" x2="'+R+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/><text class="et-tik" x="'+(R+8)+'" y="'+r1(y(t))+'" dy="0.32em">'+(Number.isInteger(t)?fi(t):f1(t))+'</text>').join('');
  svg+='<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
  const cizgi=(k,sinif,stil)=>{const pts=T.seri.map((p,i)=>p[k]===null?null:[x(i),y(p[k])]);let out='',run=[];
    const bitir=()=>{if(run.length>1)out+='<path class="'+sinif+'" style="'+stil+'" d="'+yol(run)+'"/>';run=[]};pts.forEach(p=>{if(p)run.push(p);else bitir()});bitir();
    // A missing exam in between: the known points on either side are joined by a dashed line.
    let son=null;pts.forEach((p,i)=>{if(!p)return;if(son!==null&&i>son+1)out+='<path class="'+sinif+' kesik tg-bosluk" style="'+stil+'" d="M'+r1(pts[son][0])+','+r1(pts[son][1])+'L'+r1(p[0])+','+r1(p[1])+'"/>';son=i});
    return out+pts.map((p,i)=>p&&(k==='okul'||!(pts[i-1]||pts[i+1]))?'<circle cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="'+(k==='okul'?3:2.5)+'" style="fill:'+(k==='okul'?'var(--e-c1)':'var(--e-fg2)')+'"/>':'').join('')};
  svg+=cizgi('genel','tg-genel','')+cizgi('okul','et-cizgi kalin','stroke:var(--e-c1)');
  const i0=[...d.keys()].reverse().find(i=>T.seri[i].okul!==null);
  if(i0!==undefined)svg+=sagEtiket(y(T.seri[i0].okul),R,f2(T.seri[i0].okul),ust-10);
  svg+=eksenX(d,x,step,W,H-6)+imlec(ust-10,alt)+'</svg>';
  const ipucu=d.map((s,i)=>{const p=T.seri[i],q=i?T.seri[i-1]:null;return {bas:sinavBasligi(s),satir:[['var(--e-c1)',okulAdi(m.okul),p.okul===null?'—':f2(p.okul)+' net','cizgi'],
    ['var(--e-fg2)','Türkiye ortalaması',p.genel===null?'—':f2(p.genel)+' net','kesik'],[null,'Türkiye’ye göre',p.okul===null||p.genel===null?'—':isaret(p.okul-p.genel,f2)],
    ...(q&&q.okul!==null&&p.okul!==null?[[null,'Önceki denemeye göre',artisOk(p.okul-q.okul)]]:[])]}});
  return {svg,xs:d.map((_,i)=>x(i)),ys:T.seri.map(p=>p.okul!==null?y(p.okul):p.genel!==null?y(p.genel):ust+40),
    noktalar:T.seri.map(p=>[...(p.okul!==null?[[y(p.okul),'var(--e-c1)']]:[]),...(p.genel!==null?[[y(p.genel),'var(--e-fg2)']]:[])]),ipucu};
}
/* ---------------- T-puanı, Sıra and Artış sırası charts ---------------- */
const rr2=x=>Math.round(x*100)/100;
// A subject's or the total's point as the charts read it: {t, sira (printed place), tahmin (estimated place), net, genel, sigma, n,
// aralik, kaynak, ortT, tam, yok} or null.
const tNokta=p=>p?{t:p.t,sira:p.sira,tahmin:p.tahmin,net:p.tNet,genel:p.dg?p.dg.mu:p.genel,sigma:p.dg?p.dg.sigma:null,n:p.dg?p.dg.n:null,aralik:p.dg?p.dg.aralik:null,kaynak:p.kaynak,ortT:null,tam:!!(p.dg&&p.dg.tam),
  yok:p.tNet===null?'net':!p.dg?'dagilim':null}:null;
// The measure on show, exam by exam: the chosen subject, else the session's total, else the subjects' mean T.
function olcuT(st){
  const m=st.m,d=st.odak;
  if(d)return {ad:d.ad,renk:d.renk,tur:'ders',seri:d.seri.map(tNokta)};
  if(m.toplam)return {ad:m.toplam.ad,renk:'var(--e-c1)',tur:'toplam',seri:m.toplam.tseri};
  return {ad:m.ortT.ad,renk:'var(--e-c1)',tur:'ort',seri:m.ortT.tseri};
}
const siraDegeri=p=>p?p.sira!==null?p.sira:p.tahmin:null;
const siraYazisi=p=>!p?'—':p.sira!==null?fi(p.sira)+'.':p.tahmin!==null?'≈ '+fi(p.tahmin)+'.':'—';
// "N ≈ 180 okul" with the spread of the subjects' own fits; a complete list says so.
const okulSayisiYazisi=p=>!p.n?'—':p.tam?'tam liste · '+fi(p.n)+' okul':'≈ '+fi(p.n)+' okul'+(p.aralik&&p.aralik[0]!==p.aralik[1]?' (derslerde '+fi(p.aralik[0])+'–'+fi(p.aralik[1])+')':'');
const tYok=p=>p.yok==='net'?'okulun neti bu denemede yok (listede değil)':'okullar arası dağılım kestirilemedi';

/* The followed school against the others, by T. A school's T in an exam comes from its net in that subject's list (a total: its
   summed nets over the schools in every list of the total); ΔT = T(later) − T(earlier), ranked among the schools that have the
   measure in both exams (equal increases share a place). The followed school outside a list is placed by its own T and marked "≈". */
function tHaritasi(m,d,i){
  const c=m.tc||(m.tc=new Map()),k=(d==='toplam'?'*':d.kod)+'|'+i;if(c.has(k))return c.get(k);
  const h=new Map();
  if(d==='toplam'){
    const T=m.toplam,tp=T&&T.tseri[i];
    if(tp&&tp.sigma>0){const ps=T.kodlar.map(kk=>{const x=m.dersler.find(z=>anahtar(z.kod)===kk);return x?x.seri[i]:null});
      if(ps.every(p=>p&&p.dg)){const say=new Map();
        for(const p of ps)for(const r of p.satir){const key=anahtar(r.ad),v=say.get(key)||{ad:r.ad,net:0,c:0};v.net+=r.net;v.c++;say.set(key,v)}
        for(const [key,v] of say)if(v.c===ps.length)h.set(key,{ad:v.ad,net:v.net,t:tPuani(v.net,tp.genel,tp.sigma)})}}
  }else{const p=d.seri[i];if(p&&p.dg)for(const r of p.satir)h.set(anahtar(r.ad),{ad:r.ad,net:r.net,t:tPuani(r.net,p.dg.mu,p.dg.sigma),sira:r.sira})}
  c.set(k,h);return h;
}
const bizT=(m,d,i)=>{const p=d==='toplam'?(m.toplam?m.toplam.tseri[i]:m.ortT.tseri[i]):d.seri[i];return p&&p.t!==null&&p.t!==undefined?p.t:null};
function artisT(m,d,a,b){
  const c=m.ac||(m.ac=new Map()),ck=(d==='toplam'?'*':d.kod)+'|'+a+'|'+b;if(c.has(ck))return c.get(ck);
  const A=tHaritasi(m,d,a),B=tHaritasi(m,d,b),okulK=m.okul?anahtar(m.okul):null,satir=[];
  for(const [k,v] of A){const w=B.get(k);if(w&&v.t!==null&&w.t!==null)satir.push({key:k,ad:v.ad,once:v.t,simdi:w.t,fark:rr2(w.t-v.t)})}
  const nOrtak=satir.length;let biz=okulK?satir.find(r=>r.key===okulK)||null:null;
  if(okulK&&!biz){const ta=bizT(m,d,a),tb=bizT(m,d,b);
    if(ta!==null&&tb!==null){biz={key:okulK,ad:m.okul,once:ta,simdi:tb,fark:rr2(tb-ta),yaklasik:true};satir.push(biz)}}
  satir.sort((x,y)=>y.fark-x.fark||x.ad.localeCompare(y.ad,'tr'));
  satir.forEach((r,j)=>{r.sira=j&&Math.abs(satir[j-1].fark-r.fark)<1e-9?satir[j-1].sira:j+1});
  const sonuc={satir,biz,nOrtak,yaklasik:!!(biz&&biz.yaklasik)};c.set(ck,sonuc);return sonuc;
}
// The followed school's place by increase in every transition of the range (onceki … simdi): [{sira, yak, fark, n, top}|null].
function artisSeri(m,d){
  const a=m.onceki,b=m.simdi,out=[];if(a===null)return out;
  for(let j=a;j<b;j++){const R=artisT(m,d,j,j+1);out.push(R.biz?{sira:R.biz.sira,yak:!!R.biz.yaklasik,fark:R.biz.fark,n:R.nOrtak,top:R.satir.length}:null)}
  return out;
}
const artisYazisi=a=>a?(a.yak?'≈ ':'')+fi(a.sira)+'.':'—';

// One chart for T, Sıra and Artış sırası: every subject a thin line (colours of the subject cards) and the total the bold line;
// the line under the pointer takes the stage (as in Sıra), a click opens that subject. A chosen subject is drawn alone.
// T: 50 is the average school. Sıra: 1 at the top, down to about N; estimates are hollow and dashed. Artış sırası: x is the
// transitions of the range, 1 (the biggest increase) at the top.
function grafikBirlesik(st,W,tur){
  const m=st.m,odak=st.odak,T=tur==='t',A=tur==='artis',H=odak&&!A?280:340;if(!m.okul||!m.sinavlar.length)return null;
  const O=odak?null:olcuT(st);
  let xAd;
  if(A){
    if(m.onceki===null)return null;
    const kisa=kisaAdlar(m.sinavlar);xAd=[];for(let j=m.onceki;j<m.simdi;j++)xAd.push({ad:kisa[j]+'→'+kisa[j+1],tam:m.sinavlar[j].ad+' → '+m.sinavlar[j+1].ad});
  }else xAd=m.sinavlar;
  const n=xAd.length;
  // A line: {kod, ad, renk, v[], e[] (estimated), seri[], yaz(i)}.
  const cizgi=(ad,renk,kod,olcu)=>{
    if(A){if(!olcu)return {kod,ad,renk,v:[],e:[],seri:[],yaz:()=>'—'};const seri=artisSeri(m,olcu);return {kod,ad,renk,v:seri.map(a=>a?a.sira:null),e:seri.map(a=>!!(a&&a.yak)),yaz:i=>artisYazisi(seri[i]),seri}}
    const seri=olcu==='toplam'?O.seri:olcu.seri.map(tNokta);
    return {kod,ad,renk,seri,v:seri.map(p=>T?(p&&p.t!==null?p.t:null):siraDegeri(p)),e:seri.map(p=>!T&&!!p&&p.sira===null),yaz:i=>T?(seri[i]&&seri[i].t!==null?f1(seri[i].t):'—'):siraYazisi(seri[i])};
  };
  const dersler=(odak?[odak]:m.dersler).map(s=>cizgi(s.ad,s.renk,s.kod,s)).filter(l=>l.v.some(v=>v!==null));
  const toplam=odak?null:cizgi(O.ad,'var(--e-fg)',null,A?(m.toplam?'toplam':null):'toplam');
  const hepsi=[...dersler,...(toplam?[toplam]:[])].flatMap(l=>l.v).filter(v=>v!==null&&v!==undefined);
  if(!hepsi.length)return null;
  const ns=A?[Math.max(2,...m.dersler.flatMap(s=>artisSeri(m,s).map(a=>a?a.top:0)))]:[...dersler,...(toplam?[toplam]:[])].flatMap(l=>(l.seri||[]).map(p=>p&&p.n?p.n:0));
  const ek=k=>!odak&&dersler.length>1?' data-seri="'+k+'"':'';
  let tik,y,yazTik,ustTik;
  const ust=22,alt=H-26;
  if(T){const v=[50,...hepsi],lo=Math.min(...v),hi=Math.max(...v),pay=Math.max(2,(hi-lo)*.1);tik=tikler(lo-pay,hi+pay,5);yazTik=t=>Number.isInteger(t)?fi(t):f1(t);
    y=v=>alt-(v-tik[0])/(tik[tik.length-1]-tik[0])*(alt-ust)}
  else{const enBuyuk=Math.max(A?5:10,...hepsi,...ns),ta=tikler(0,enBuyuk,4);ustTik=ta.find(t=>t>=enBuyuk-1e-9)??ta[ta.length-1];tik=[...new Set([1,...ta.filter(t=>t>1&&t<=ustTik)])];yazTik=t=>fi(t)+'.';
    y=v=>ust+(v-1)/Math.max(1,ustTik-1)*(alt-ust)}
  const L=2,R=W-Math.max(...tik.map(t=>yaziGen(yazTik(t))))-30,step=(R-L)/n,x=i=>L+step*(i+.5);
  const has=(l,i)=>l.v[i]!==null&&l.v[i]!==undefined;
  const sonL=toplam&&toplam.v.some(v=>v!==null&&v!==undefined)?toplam:dersler[dersler.length-1],sonI=[...Array(n).keys()].reverse().find(i=>has(sonL,i)),yEt=sonI===undefined?-99:y(sonL.v[sonI]);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+(A?'':bantlar(m,x,step,4,alt));
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+L+'" x2="'+R+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/>'+(Math.abs(y(t)-yEt)<12?'':'<text class="et-tik" x="'+(R+8)+'" y="'+r1(y(t))+'" dy="0.32em">'+yazTik(t)+'</text>')).join('');
  if(T)svg+='<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/><line class="tg-genel" x1="'+L+'" x2="'+R+'" y1="'+r1(y(50))+'" y2="'+r1(y(50))+'"/><text class="et-tik tg-t-etiket" x="'+(R-4)+'" y="'+r1(y(50)-6)+'" text-anchor="end">Türkiye ortalaması (okullar)</text>';
  const ptsAl=l=>l.v.map((v,i)=>v===null||v===undefined?null:[x(i),y(v),l.e[i]]);
  for(let k=dersler.length-1;k>=0;k--){const l=dersler[k],pts=ptsAl(l);
    svg+=cizgiParcalari(pts,odak?'et-cizgi kalin':'et-cizgi ince tg-cok','stroke:'+l.renk,ek(k))+noktalarCiz(pts,l.renk,ek(k),!!odak||n<3)}
  if(toplam){const tpts=ptsAl(toplam);svg+=cizgiParcalari(tpts,'et-cizgi kalin tg-ort','','')+noktalarCiz(tpts,'var(--e-fg)','',true)}
  if(sonI!==undefined)svg+=sagEtiket(y(sonL.v[sonI]),R,sonL.yaz(sonI),ust-10);
  svg+=eksenX(xAd,x,step,W,H-6)+imlec(ust-10,alt)+'</svg>';
  // Tooltips: the total first (its figures), then every subject sorted by the measure.
  const bas=i=>A?xAd[i].tam:sinavBasligi(m.sinavlar[i]);
  const topSatir=i=>{
    if(!toplam)return [];const p=toplam.seri[i],fg='var(--e-fg)';
    if(A)return p?[[fg,toplam.ad+' · artış sırası',artisYazisi(p),'cizgi'],[null,'ΔT',isaret(p.fark,f1)+' T'],[null,'Ortak okul',fi(p.n)+(p.yak?' (≈: okul listede yok)':'')]]:[[fg,toplam.ad,'artış sırası yok','cizgi']];
    if(!p)return [[fg,toplam.ad,'bu denemede yok','cizgi']];
    if(T){if(p.t===null)return [[fg,toplam.ad,'T puanı yok','cizgi'],...(O.tur==='ort'?[]:[[null,'Neden',tYok(p)]])];
      return [[fg,toplam.ad+' · T puanı (okullar arası)',f1(p.t),'cizgi'],...(O.tur==='ort'?[[null,'Ders sayısı',fi(p.adet)]]:[[null,'Net',f2(p.net)+(p.kaynak==='okul'?' · Sıralamalar kurum ortalaması':'')],[null,p.tam?'Okul ortalaması (tam liste)':'Türkiye ortalaması',f2(p.genel)+' net'],
        [null,'Okullar arası σ',f2(p.sigma)+' net'],...(p.rOrt!==null&&p.rOrt!==undefined?[[null,'Derslerarası r','≈ '+f2(p.rOrt)+(p.rVarsayilan?' (varsayılan korelasyon)':' (düzeltilmiş)')]]:[]),[null,'N',okulSayisiYazisi(p)],...(p.ortT!==null&&p.ortT!==undefined?[[null,'Ders ortalaması T',f1(p.ortT)]]:[])])]}
    if(p.sira!==null)return [[fg,toplam.ad+' · sıra',fi(p.sira)+'.','cizgi'],...(p.n?[[null,'N',okulSayisiYazisi(p)]]:[])];
    if(p.tahmin!==null)return [[fg,toplam.ad+' · tahmini sıra',siraYazisi(p),'cizgi'],[null,'N',okulSayisiYazisi(p)]];
    return [[fg,toplam.ad,'sıra yok','cizgi'],[null,'Neden','toplam için sıralama basılmıyor']];
  };
  const dersSatir=(i,vurgu)=>dersler.filter(l=>has(l,i)).sort((a,b)=>T?b.v[i]-a.v[i]:a.v[i]-b.v[i])
    .map(l=>[l.renk,l.ad,l.yaz(i)+(A?' · '+isaret(l.seri[i].fark,f1)+' T':''),'cizgi',l===vurgu]);
  const tekSatir=i=>{const l=dersler[0],a=l?l.seri[i]:null;
    return a?[[l.renk,l.ad+' · artış sırası',artisYazisi(a),'cizgi'],[null,'ΔT',isaret(a.fark,f1)+' T'],[null,'Ortak okul',fi(a.n)+(a.yak?' (≈: okul listede yok)':'')]]:[[l?l.renk:null,l?l.ad:'','artış sırası yok','cizgi']]};
  const ipucu=xAd.map((_,i)=>({bas:bas(i),satir:odak?tekSatir(i):topSatir(i).concat(dersSatir(i))}));
  const tumNokta=i=>[...dersler.filter(l=>has(l,i)).map(l=>[y(l.v[i]),l.renk]),...(toplam&&has(toplam,i)?[[y(toplam.v[i]),'var(--e-fg)']]:[])];
  const ys=xAd.map((_,i)=>toplam&&has(toplam,i)?y(toplam.v[i]):tumNokta(i)[0]?tumNokta(i)[0][0]:ust+40);
  return {svg,xs:xAd.map((_,i)=>x(i)),ys,noktalar:xAd.map((_,i)=>tumNokta(i)),ipucu,
    ...(!odak&&dersler.length>1?{seriler:dersler.map(l=>({kod:l.kod,pts:ptsAl(l)})),seriNokta:(k,i)=>has(dersler[k],i)?[[y(dersler[k].v[i]),dersler[k].renk]]:[],
      seriIpucu:(k,i)=>({bas:bas(i),satir:topSatir(i).concat(dersSatir(i,dersler[k]))})}:{})};
}
// A chosen subject in T and Sıra: its own line (the total is not drawn); the printed place is filled on a solid line, an
// estimate (the school is outside the list) hollow on a dashed one.
function grafikT(st,W){
  const m=st.m,d=m.sinavlar,O=olcuT(st),H=280;if(!st.odak)return grafikBirlesik(st,W,'t');
  if(!m.okul||!d.length||!O.seri.some(p=>p&&p.t!==null))return null;
  const vals=[50,...O.seri.filter(p=>p&&p.t!==null).map(p=>p.t)],lo=Math.min(...vals),hi=Math.max(...vals),tik=tikler(lo-Math.max(2,(hi-lo)*.1),hi+Math.max(2,(hi-lo)*.1),5);
  const L=2,ust=22,alt=H-26,R=W-Math.max(...tik.map(t=>yaziGen(fi(t))))-30,step=(R-L)/d.length,x=i=>L+step*(i+.5);
  const y=v=>alt-(v-tik[0])/(tik[tik.length-1]-tik[0])*(alt-ust);
  const sonT=[...d.keys()].reverse().find(i=>O.seri[i]&&O.seri[i].t!==null),yEt=sonT===undefined?-99:y(O.seri[sonT].t);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+bantlar(m,x,step,4,alt);
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+L+'" x2="'+R+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/>'+(Math.abs(y(t)-yEt)<12?'':'<text class="et-tik" x="'+(R+8)+'" y="'+r1(y(t))+'" dy="0.32em">'+(Number.isInteger(t)?fi(t):f1(t))+'</text>')).join('');
  svg+='<line class="et-eksen" x1="'+L+'" x2="'+R+'" y1="'+alt+'" y2="'+alt+'"/>';
  svg+='<line class="tg-genel" x1="'+L+'" x2="'+R+'" y1="'+r1(y(50))+'" y2="'+r1(y(50))+'"/><text class="et-tik tg-t-etiket" x="'+(R-4)+'" y="'+r1(y(50)-6)+'" text-anchor="end">Türkiye ortalaması (okullar)</text>';
  const pts=d.map((_,i)=>{const p=O.seri[i];return p&&p.t!==null?[x(i),y(p.t),false]:null});
  svg+=cizgiParcalari(pts,'et-cizgi kalin','stroke:'+O.renk,'')+noktalarCiz(pts,O.renk,'',true);
  const i0=[...d.keys()].reverse().find(i=>pts[i]);
  if(i0!==undefined)svg+=sagEtiket(pts[i0][1],R,f1(O.seri[i0].t),ust-10);
  svg+=eksenX(d,x,step,W,H-6)+imlec(ust-10,alt)+'</svg>';
  const ipucu=d.map((sn,i)=>{const p=O.seri[i],bas=sinavBasligi(sn);
    if(!p)return {bas,satir:[[O.renk,O.ad,'bu denemede yok','cizgi']]};
    if(p.t===null)return {bas,satir:[[O.renk,O.ad,'T puanı yok','cizgi'],[null,'Neden',tYok(p)]]};
    return {bas,satir:[[O.renk,O.ad+' · T puanı (okullar arası)',f1(p.t),'cizgi'],['var(--e-fg2)','Türkiye ortalaması (okullar)','50','kesik'],
      [null,'Net',f2(p.net)+(p.kaynak==='okul'?' · Sıralamalar kurum ortalaması':'')],[null,p.tam?'Okul ortalaması (tam liste)':'Türkiye ortalaması',f2(p.genel)+' net'],
      [null,'Okullar arası σ',f2(p.sigma)+' net'],[null,'N',okulSayisiYazisi(p)]]}});
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map((_,i)=>pts[i]?pts[i][1]:y(50)),noktalar:d.map((_,i)=>pts[i]?[[pts[i][1],O.renk]]:[]),ipucu};
}
function grafikTSira(st,W){
  const m=st.m,d=m.sinavlar,O=olcuT(st),H=280;if(!st.odak)return grafikBirlesik(st,W,'sira');
  if(!m.okul||!d.length||!O.seri.some(p=>siraDegeri(p)!==null))return null;
  const degerler=O.seri.map(siraDegeri),enBuyuk=Math.max(10,...degerler.filter(v=>v!==null),...O.seri.map(p=>p&&p.n?p.n:0));
  const tikAlt=tikler(0,enBuyuk,4),ustTik=tikAlt.find(t=>t>=enBuyuk-1e-9)??tikAlt[tikAlt.length-1],tik=[...new Set([1,...tikAlt.filter(t=>t>1&&t<=ustTik)])];
  const L=2,ust=22,alt=H-26,R=W-Math.max(...tik.map(t=>yaziGen(fi(t)+'.')))-30,step=(R-L)/d.length,x=i=>L+step*(i+.5);
  const y=v=>ust+(v-1)/Math.max(1,ustTik-1)*(alt-ust);
  const sonI=[...d.keys()].reverse().find(i=>degerler[i]!==null),yEt=sonI===undefined?-99:y(degerler[sonI]);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" aria-hidden="true">'+bantlar(m,x,step,4,alt);
  svg+=tik.map(t=>'<line class="et-izgara" x1="'+L+'" x2="'+R+'" y1="'+r1(y(t))+'" y2="'+r1(y(t))+'"/>'+(Math.abs(y(t)-yEt)<12?'':'<text class="et-tik" x="'+(R+8)+'" y="'+r1(y(t))+'" dy="0.32em">'+fi(t)+'.</text>')).join('');
  const pts=d.map((_,i)=>degerler[i]===null?null:[x(i),y(degerler[i]),O.seri[i].sira===null]);
  svg+=cizgiParcalari(pts,'et-cizgi kalin','stroke:'+O.renk,'')+noktalarCiz(pts,O.renk,'',true);
  const i0=[...d.keys()].reverse().find(i=>pts[i]);
  if(i0!==undefined)svg+=sagEtiket(pts[i0][1],R,siraYazisi(O.seri[i0]),ust-10);
  svg+=eksenX(d,x,step,W,H-6)+imlec(ust-10,alt)+'</svg>';
  const ipucu=d.map((sn,i)=>{const p=O.seri[i],bas=sinavBasligi(sn);
    if(!p)return {bas,satir:[[O.renk,O.ad,'bu denemede yok','cizgi']]};
    if(p.sira!==null)return {bas,satir:[[O.renk,O.ad+' · sıra',fi(p.sira)+'.','cizgi'],[null,'Net',f2(p.net)+' / '+(p.tam?'okul ortalaması ':'Türkiye ')+f2(p.genel)],...(p.n?[[null,'N',okulSayisiYazisi(p)]]:[])]};
    if(p.tahmin!==null)return {bas,satir:[[O.renk,O.ad+' · tahmini sıra',siraYazisi(p),'cizgi'],[null,'N',okulSayisiYazisi(p)],[null,'Net',f2(p.net)+(p.kaynak==='okul'?' · Sıralamalar kurum ortalaması':'')+' / Türkiye '+f2(p.genel)]]};
    return {bas,satir:[[O.renk,O.ad,'sıra yok','cizgi'],[null,'Neden',p.yok?tYok(p):'listede değil']]};
  });
  return {svg,xs:d.map((_,i)=>x(i)),ys:d.map((_,i)=>pts[i]?pts[i][1]:ust+40),noktalar:d.map((_,i)=>pts[i]?[[pts[i][1],O.renk]]:[]),ipucu};
}
const grafikTArtis=(st,W)=>grafikBirlesik(st,W,'artis');
const GRAFIKLER={sira:grafikSira,net:grafikNet,toplam:grafikToplam,t:grafikT,tsira:grafikTSira,tartis:grafikTArtis};
let ZAMAN=null;
const etkin=()=>EK.sekme==='turkiye'&&rehberMi()&&!!document.getElementById?.('tgKok');
function grafikleriCiz(){
  if(!etkin())return;const {veri}=oku();if(!veri)return;const st=durumAl(veri);
  document.querySelectorAll('.et-grafik[data-tg-grafik]').forEach(kutu=>{
    const W=Math.round(kutu.clientWidth);if(W<120)return;
    const imza=[W,veri.ts,st.m.liste,st.m.duzey,st.m.oturum,st.m.simdi,st.m.onceki,st.m.toplam&&st.m.toplam.key,st.mod,st.grafik,st.aralik,st.m.okul,st.odak&&st.odak.kod,GRAFIK_CIZGI.tur()].join('|');if(kutu.dataset.imza===imza)return;
    const g=GRAFIKLER[kutu.dataset.tgGrafik](st,Math.max(260,W));if(!g)return;
    kutu.dataset.imza=imza;kutu.innerHTML=g.svg+'<div class="et-ipucu" hidden></div>';CIZIMLER.set(kutu.dataset.tgGrafik,g);
  });
}
function cizimPlanla(){if(typeof window==='undefined'||!window.requestAnimationFrame)return;window.cancelAnimationFrame(ZAMAN);ZAMAN=window.requestAnimationFrame(grafikleriCiz)}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('resize',cizimPlanla);
function ipucuGoster(kutu,i){
  const g=CIZIMLER.get(kutu.dataset.tgGrafik);if(!g||i<0||i>=g.xs.length)return;
  const svg=kutu.querySelector('svg'),tip=kutu.querySelector('.et-ipucu');if(!svg||!tip)return;
  kutu.dataset.i=String(i);const kural=svg.querySelector('.et-kural'),cx=g.xs[i];
  kural.setAttribute('x1',r1(cx));kural.setAttribute('x2',r1(cx));kural.setAttribute('visibility','visible');
  const k=kutu.dataset.seri===undefined||!g.seriler?null:Number(kutu.dataset.seri);
  svg.querySelector('.et-imlecler').innerHTML=(k===null?g.noktalar[i]:g.seriNokta(k,i)).map(([yy,c])=>'<circle cx="'+r1(cx)+'" cy="'+r1(yy)+'" r="4.5" class="et-imlec" style="fill:'+c+'"/>').join('');
  const p=k===null?g.ipucu[i]:g.seriIpucu(k,i);
  tip.innerHTML='<div class="et-ipucu-bas">'+kacis(p.bas)+'</div>'+p.satir.map(([c,ad,v,tur,vurgu])=>'<div class="et-ipucu-satir'+(vurgu?' dp-vurgu':'')+'">'+
    (c?'<i class="et-renk'+(tur==='cizgi'?' cizgi':tur==='kesik'?' cizgi tg-renk-kesik':tur==='bant'?' tg-renk-bant':'')+'" style="background:'+c+'"></i>':'')+'<span>'+kacis(ad)+'</span><b>'+kacis(v)+'</b></div>').join('');
  tip.hidden=false;
  const olcek=kutu.clientWidth/Number(svg.viewBox.baseVal.width||kutu.clientWidth),px=cx*olcek,py=g.ys[i]*olcek,bw=kutu.clientWidth,tw=tip.offsetWidth,th=tip.offsetHeight;
  let sol=px+14;if(sol+tw>bw)sol=px-tw-14;sol=Math.max(0,Math.min(sol,bw-tw));
  tip.style.left=sol+'px';tip.style.top=Math.max(0,Math.min(py-th/2,kutu.clientHeight-th))+'px';
}
// One line takes the stage: the others lose their colour and fade (CSS: svg.odakli). k null clears.
function seriVurgula(kutu,k){
  const svg=kutu.querySelector('svg');if(!svg)return;
  if(k===null||k===undefined||k<0){svg.classList.remove('odakli');svg.querySelectorAll('[data-seri].aktif').forEach(e=>e.classList.remove('aktif'));delete kutu.dataset.seri;return}
  if(kutu.dataset.seri===String(k))return;
  svg.querySelectorAll('[data-seri].aktif').forEach(e=>e.classList.remove('aktif'));
  svg.querySelectorAll('[data-seri="'+k+'"]').forEach(e=>{e.classList.add('aktif');e.parentNode.appendChild(e)});
  svg.classList.add('odakli');kutu.dataset.seri=String(k);
}
function enYakinSeri(kutu,clientX,clientY){
  const g=CIZIMLER.get(kutu.dataset.tgGrafik),svg=kutu.querySelector('svg');if(!g||!g.seriler||!svg)return null;
  const r=svg.getBoundingClientRect(),o=(Number(svg.viewBox.baseVal.width)||r.width)/(r.width||1),px=(clientX-r.left)*o,py=(clientY-r.top)*o;
  const uzak=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/l)):0;return Math.hypot(a[0]+t*dx-px,a[1]+t*dy-py)};
  let en=null,ed=14*o;
  g.seriler.forEach((s,k)=>s.pts.forEach((p,i)=>{if(!p)return;const q=s.pts[i+1];const dd=q?uzak(p,q):Math.hypot(p[0]-px,p[1]-py);if(dd<ed){ed=dd;en=k}}));
  return en;
}
function ipucuGizle(kutu){
  seriVurgula(kutu,null);const tip=kutu.querySelector('.et-ipucu'),svg=kutu.querySelector('svg');if(tip)tip.hidden=true;delete kutu.dataset.i;
  if(svg){svg.querySelector('.et-kural')?.setAttribute('visibility','hidden');const im=svg.querySelector('.et-imlecler');if(im)im.innerHTML=''}
}
function enYakin(kutu,clientX){
  const g=CIZIMLER.get(kutu.dataset.tgGrafik),svg=kutu.querySelector('svg');if(!g||!svg)return -1;
  const r=svg.getBoundingClientRect(),vx=(clientX-r.left)*(Number(svg.viewBox.baseVal.width)||r.width)/(r.width||1);
  let en=0;g.xs.forEach((x,i)=>{if(Math.abs(x-vx)<Math.abs(g.xs[en]-vx))en=i});return en;
}

/* ---------------- page ---------------- */
let DURUM_YAZI='',ISLEM=false;
function durum(t){DURUM_YAZI=t||'';const el=document.getElementById('tgDurum');if(el)el.textContent=DURUM_YAZI}
const secim=(ad,deger,secenekler,etiket)=>'<div class="et-seg" role="group" aria-label="'+etiket+'"><span class="et-seg-label">'+etiket+'</span>'+
  secenekler.map(([v,yazi,kapali])=>'<button type="button" data-tg-'+ad+'="'+kacis(v)+'" aria-pressed="'+(String(v)===String(deger))+'"'+(kapali?' disabled':'')+'>'+kacis(yazi)+'</button>').join('')+'</div>';
const hap=(v,yazi)=>'<span class="et-hap '+yon(v)+'">'+(ok(v)?'<span aria-hidden="true">'+ok(v)+'</span>':'')+yazi+'</span>';
const siraOk=f=>f===null||f===undefined?'':'<span class="et-sira-ok '+yon(f)+'" role="img" aria-label="'+(f>0?fi(f)+' sıra yükseldi':f<0?fi(-f)+' sıra düştü':'sıra aynı')+'">'+(f>0?'▲'+fi(f):f<0?'▼'+fi(-f):'=')+'</span>';
const egilimRengi=v=>v>0?'var(--e-ok)':v<0?'var(--e-bad)':'var(--e-muted)';
// A card's mini line: higher is better (places are drawn upside down); the şimdiki exam is shaded.
function kucukCizgi(vals,renk,son,G,Y){
  const n=vals.length,var_=vals.filter(v=>v!==null);if(!var_.length)return '';
  const mx=Math.max(...var_),mn=Math.min(...var_),x=i=>2+(G-6)*(n>1?i/(n-1):.5),y=v=>Y-3-(mx===mn?.5:(v-mn)/(mx-mn))*(Y-7);
  const pts=vals.map((v,i)=>v===null?null:[x(i),y(v)]);
  let s='<svg viewBox="0 0 '+G+' '+Y+'" width="100%" height="'+Y+'" preserveAspectRatio="none" aria-hidden="true">';
  if(son!==null&&n>1){const h=(G-6)/(n-1)/2;s+='<rect class="et-bant son" x="'+r1(x(son)-h)+'" y="0" width="'+r1(2*h)+'" height="'+Y+'"/>'}
  let run=[];const bitir=()=>{if(run.length>1)s+='<path class="et-kucuk" vector-effect="non-scaling-stroke" style="stroke:'+renk+'" d="'+yol(run)+'"/>';run=[]};
  pts.forEach(p=>{if(p)run.push(p);else bitir()});bitir();
  if(var_.length===1){const p=pts.find(Boolean);s+='<circle cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="2.5" style="fill:'+renk+'"/>'}
  return s+'</svg>';
}
function arac(st,salt){
  const m=st.m;
  const ekle=salt?'':'<label class="et-dugme birincil">PDF ekle<input type="file" id="tgPdf" accept="application/pdf,.pdf" multiple hidden></label>';
  const okullar=m.okul&&!m.okullar.some(a=>anahtar(a)===anahtar(m.okul))?[m.okul,...m.okullar]:m.okullar;
  const okul='<label class="et-seg tg-okul"><span class="et-seg-label">Okul</span><select id="tgOkul" aria-label="Okul">'+(m.okul?'':'<option value="">Okulunuzu seçin</option>')+
    okullar.map(a=>'<option value="'+kacis(a)+'"'+(m.okul&&anahtar(a)===anahtar(m.okul)?' selected':'')+'>'+kacis(okulAdi(a))+'</option>').join('')+'</select></label>';
  // The two exams compared (Önceki → Şimdiki in Sıra, İlk → Son deneme in Artış); the first offers only exams before the second.
  const liste_=(id,ad,l,i0)=>'<label class="et-seg"><span class="et-seg-label">'+ad+'</span><select id="'+id+'" aria-label="'+ad+'">'+
    l.map(([s,i])=>'<option value="'+kacis(s.id)+'"'+(i===i0?' selected':'')+'>'+kacis(s.ad)+'</option>').reverse().join('')+'</select></label>';
  const ikili=st.mod==='tpuan'&&st.aralik!=='sec'?'':m.sinavlar.length>1?'<div class="tg-ikili">'+liste_('tgOnceki',st.mod==='artis'||st.mod==='tpuan'?'İlk deneme':'Önceki',m.sinavlar.map((s,i)=>[s,i]).slice(0,m.simdi),m.onceki)+'<span class="tg-ok" aria-hidden="true">→</span>'+
    liste_('tgSimdi',st.mod==='artis'||st.mod==='tpuan'?'Son deneme':'Şimdiki',m.sinavlar.map((s,i)=>[s,i]).slice(1),m.simdi)+'</div>':'';
  const n=m.sinavlar.length,tpuan=st.mod==='tpuan';
  return '<div class="et-arac">'+ekle+secim('mod',st.mod,MODLAR,'Görünüm')+(tpuan?secim('gor',st.grafik,GRAFIKLER_T,'Grafik'):'')+okul+
    (tpuan?secim('aralik',st.aralik,ARALIKLAR_T.map(([k,ad])=>[k,ad,(k==='sec'||k==='tum'?n<2:n<(k==='1'?2:Number(k)))]),'Karşılaştır'):'')+ikili+
    (m.listeler.length>1?secim('liste',m.liste,m.listeler.map(l=>[l,LISTE_ADI[l]]),'Liste'):'')+
    (m.duzeyler.length>1?secim('duzey',m.duzey,m.duzeyler.map(k=>[k,grupAdi(k)]),'Sınıf'):'')+
    secim('oturum',m.oturum,OTURUMLAR.map(o=>[o,o,!m.oturumlar.includes(o)]),'Oturum')+
    (st.mod!=='sira'&&m.toplamlar.length>1?secim('toplam',m.toplam.key,m.toplamlar.map(t=>[t.key,t.key]),'Toplam'):'')+
    secim('cizgi',GRAFIK_CIZGI.tur(),GRAFIK_CIZGI.SECENEKLER,'Çizgi')+'</div>';
}
function cumle(st){
  const m=st.m,s=m.sinavlar[m.simdi],b=t=>'<b>'+t+'</b>',o=m.ozet[m.simdi],p=m.onceki===null?null:m.ozet[m.onceki];
  const bas=kacis(s.ad)+(s.g!==null?' ('+gunAy(s.g)+')':'')+' · '+kacis(LISTE_ADI[m.liste])+' listesi · ';
  if(!m.okul)return bas+'Okulunuzu “Okul” listesinden seçin; her dersteki sırası ve neti deneme deneme çizilir.';
  if(!o)return bas+kacis(okulAdi(m.okul))+': bu denemede '+kacis(m.oturum||'')+' dersi yok.';
  const fark=p?p.ort-o.ort:null;
  return bas+b(kacis(okulAdi(m.okul)))+' · '+kacis(m.oturum)+': '+ilkte(m.N).toLocaleLowerCase('tr-TR')+' '+b(fi(o.ilk)+' / '+fi(o.ders))+' ders, ortalama sıra '+b(f1(o.ort))+
    (fark!==null?' ('+kacis(m.sinavlar[m.onceki].ad)+' ile: '+b((fark>0?'▲':fark<0?'▼':'')+f1(Math.abs(fark)))+')':'')+'. '+
    (o.enIyi?'En iyi ders: '+kacis(o.enIyi.ad)+', '+b(fi(o.enIyi.seri[m.simdi].sira)+'.')+' sıra. ':'')+
    'Türkiye ortalamasının üstünde '+b(fi(o.ustu))+' ders.';
}
function ozetKartlari(st){
  const m=st.m,o=m.ozet[m.simdi],p=m.onceki===null?null:m.ozet[m.onceki];if(!o)return '';
  const kart=(baslik,buyuk,alt)=>'<div class="et-ozet-kart"><span class="mini">'+baslik+'</span><strong>'+buyuk+'</strong><div class="et-ozet-alt">'+alt+'</div></div>';
  const fark=d=>siraFarki(d,m),deg=m.dersler.filter(d=>fark(d)!==null).sort((a,b)=>fark(b)-fark(a)),enCok=deg[0]&&fark(deg[0])>0?deg[0]:null,enAz=deg.length&&fark(deg[deg.length-1])<0?deg[deg.length-1]:null;
  const ss=(d,i)=>siraKisa(d.seri[i]).replace(/^İlk (\d+) dışı$/,'$1+');
  return '<div class="et-ozet">'+
    kart('Ortalama sıra · '+kacis(m.oturum),f1(o.ort),p?hap(p.ort-o.ort,f1(Math.abs(p.ort-o.ort)))+'<span class="mini">önceki: '+f1(p.ort)+'</span>':'<span class="mini">'+fi(o.ders)+' ders</span>')+
    kart(ilkte(m.N),fi(o.ilk)+'<span class="tg-bolu"> / '+fi(o.ders)+'</span>',p?hap(o.ilk-p.ilk,fi(Math.abs(o.ilk-p.ilk))+' ders')+'<span class="mini">önceki: '+fi(p.ilk)+'</span>':'<span class="mini">ders</span>')+
    kart('Türkiye ortalamasının üstünde',fi(o.ustu)+'<span class="tg-bolu"> / '+fi(o.ders)+'</span>',p?hap(o.ustu-p.ustu,fi(Math.abs(o.ustu-p.ustu))+' ders')+'<span class="mini">önceki: '+fi(p.ustu)+'</span>':'<span class="mini">ders</span>')+
    (o.enIyi?kart('En iyi sıra',fi(o.enIyi.seri[m.simdi].sira)+'.','<span class="mini">'+kacis(o.enIyi.ad)+'</span>'):'')+
    (enCok?kart('En çok yükselen','▲'+fi(fark(enCok)),'<span class="mini">'+kacis(enCok.ad)+' · '+ss(enCok,m.onceki)+' → '+ss(enCok,m.simdi)+'</span>'):'')+
    (enAz?kart('En çok düşen','▼'+fi(-fark(enAz)),'<span class="mini">'+kacis(enAz.ad)+' · '+ss(enAz,m.onceki)+' → '+ss(enAz,m.simdi)+'</span>'):'')+'</div>';
}
function dersKartlari(st){
  const m=st.m,i=m.simdi;
  return '<div class="et-dersler">'+m.dersler.map(d=>{const p=d.seri[i],f=siraFarki(d,m);
    return '<button type="button" class="et-ders" data-tg-ders="'+kacis(d.kod)+'" aria-pressed="'+(st.odak===d)+'"><span class="et-ders-ust"><i class="et-renk nokta" style="background:'+d.renk+'"></i><b>'+kacis(d.ad)+'</b><span class="mini">'+(p?fi(p.soru)+' soru':'')+'</span></span>'+
      '<strong>'+(p?p.sira!==null?fi(p.sira)+'.':'—':'—')+'</strong>'+
      '<span class="et-ders-alt">'+siraOk(f)+'<span class="mini">'+(!p?'bu denemede yok':p.sira===null?'ilk '+fi(p.n)+' dışında':f2(p.net)+' net · TR '+f2(p.genel))+'</span></span>'+
      '<span class="et-kucuk-kutu">'+kucukCizgi(d.seri.map(x=>x?-yer(x):null),egilimRengi(f||0),i,160,38)+'</span></button>'}).join('')+'</div>';
}
const lejant=l=>'<div class="et-lejant">'+l.map(([c,ad,tur])=>'<span><i class="et-renk '+(tur||'cizgi')+'" style="background:'+c+'"></i>'+kacis(ad)+'</span>').join('')+'</div>';
function siraPaneli(st){
  const m=st.m,s=st.odak,baslik=s?'Sıra · '+s.ad+' ('+m.oturum+')':'Sıra · '+m.oturum+' dersleri';
  const lj=s?lejant([[s.renk,s.ad],['transparent','İlk '+fi(m.N)+' dışında','tg-renk-disi']]):lejant([['var(--e-fg)','Ortalama sıra'],['transparent','İlk '+fi(m.N)+' dışında','tg-renk-disi']]);
  return '<section class="et-panel" id="tgSiraPanel"><div class="et-kart-bas"><h2>'+kacis(baslik)+'</h2>'+lj+'</div>'+
    '<div class="et-grafik" data-tg-grafik="sira" tabindex="0" role="img" aria-label="'+kacis(baslik)+', deneme deneme"></div>'+
    (s?'<div class="tg-ders-geri"><button type="button" class="et-dugme" data-tg-ders="">Tüm dersler</button></div>':'')+'</section>';
}
function netPaneli(st){
  const s=st.odak;
  return '<section class="et-panel"><div class="et-kart-bas"><h2>'+kacis('Net · '+s.ad)+'</h2>'+
    lejant([[s.renk,okulAdi(st.m.okul)],['var(--e-fg2)','Türkiye ortalaması','cizgi tg-renk-kesik'],['var(--e-c1)','İlk '+fi(st.m.N)+' aralığı','tg-renk-bant']])+'</div>'+
    '<div class="et-grafik orta" data-tg-grafik="net" tabindex="0" role="img" aria-label="'+kacis('Net · '+s.ad)+', deneme deneme"></div></section>';
}
// Türkiye ortalamasına göre: each subject's success (net ÷ questions) minus the Türkiye average's, in points.
function farkPaneli(st){
  const m=st.m,i=m.simdi,s=m.sinavlar[i],l=m.dersler.filter(d=>d.seri[i]);
  const fark=d=>{const p=d.seri[i];return p.net===null?null:(p.net-p.genel)/p.soru*100};
  const ust=Math.max(10,...l.map(fark).filter(v=>v!==null).map(Math.abs));
  const bar=v=>v===null?'<span class="tg-fark-iz"></span><span class="tg-fark-iz"></span>':
    '<span class="tg-fark-iz eksi">'+(v<0?'<i style="width:'+r1(-v/ust*100)+'%"></i>':'')+'</span><span class="tg-fark-iz arti">'+(v>0?'<i style="width:'+r1(v/ust*100)+'%"></i>':'')+'</span>';
  return '<section class="et-panel"><div class="et-kart-bas"><h2>'+kacis('Türkiye ortalamasına göre · '+s.ad)+'</h2><span class="mini">başarı farkı, puan</span></div><div class="tg-fark">'+
    l.map(d=>{const v=fark(d),p=d.seri[i];return '<button type="button" class="tg-fark-satir" data-tg-ders="'+kacis(d.kod)+'"><span class="tg-fark-ad"><i class="et-renk nokta" style="background:'+d.renk+'"></i>'+kacis(d.ad)+'</span>'+bar(v)+
      '<b class="'+(v===null?'':yon(v))+'">'+(v===null?'ilk '+fi(p.n)+' dışı':isaret(v))+'</b><span class="mini tg-fark-net">'+(p.net===null?'':f2(p.net)+' · TR '+f2(p.genel))+'</span></button>'}).join('')+'</div></section>';
}
// Sıralamada yakın: the first school and the four schools on each side of the followed one, with the
// Türkiye average where it falls in the list.
function cevrePaneli(st){
  const m=st.m,s=st.odak,i=m.simdi,sn=m.sinavlar[i],p=s.seri[i];
  const bas='<section class="et-panel tg-cevre-panel"><div class="et-kart-bas"><h2>'+kacis('Sıralamada yakın · '+s.ad+' · '+sn.ad)+'</h2></div>';
  if(!p)return bas+'<p class="mini">Bu denemede '+kacis(s.ad)+' yok.</p></section>';
  const l=p.satir,k=p.k,goster=new Set([0]);
  if(k>=0)for(let j=k-4;j<=k+4;j++){if(j>=0&&j<l.length)goster.add(j)}else for(let j=Math.max(0,l.length-5);j<l.length;j++)goster.add(j);
  const sira=[...goster].sort((a,b)=>a-b),genelYer=l.filter(r=>r.net>p.genel+1e-9).length;
  let out='',onceki=-1,genelKondu=false;
  const genelSatir='<li class="tg-cevre-satir tg-genel-satir"><span class="tg-sira"></span><span class="tg-cevre-ad">Türkiye ortalaması</span><b>'+f2(p.genel)+'</b><span></span></li>';
  const ara='<li class="tg-cevre-ara" aria-hidden="true">…</li>';
  for(const j of sira){
    // Hidden rows show as "…", on whichever side of the Türkiye average they fall.
    if(!genelKondu&&genelYer<=j){out+=(genelYer>onceki+1?ara:'')+genelSatir+(j>genelYer?ara:'');genelKondu=true}
    else if(j>onceki+1)out+=ara;
    const r=l[j];
    out+='<li class="tg-cevre-satir'+(j===k?' tg-biz':'')+'"><span class="tg-sira">'+fi(r.sira)+'.</span><span class="tg-cevre-ad">'+kacis(okulAdi(r.ad))+'</span><b>'+f2(r.net)+'</b><span class="mini">'+(k>=0&&j!==k?isaret(r.net-l[k].net,f2):'')+'</span></li>';
    onceki=j;
  }
  if(!genelKondu)out+=(genelYer>onceki+1?ara:'')+genelSatir+(genelYer<l.length?ara:'');
  else if(onceki<l.length-1)out+=ara;
  const alt=k<0?'Okulunuz bu derste listede yok; listenin sonundaki kurum '+f2(p.son.net)+' net.':
    (p.birNet&&p.birNet<p.sira?'1 net daha ile '+fi(p.birNet)+'. sıra. ':'')+(k>0?'Bir üstteki kurumla fark '+f2(l[k-1].net-l[k].net)+' net.':'Listenin birincisi.');
  return bas+'<ol class="tg-cevre">'+out+'</ol><p class="mini tg-cevre-not">'+kacis(alt)+'</p></section>';
}
function dersTablosu(st){
  const m=st.m,i=m.simdi,s=m.sinavlar[i],o=m.onceki,l=m.dersler.filter(d=>d.seri[i]);
  const sutun=[['Ders'],['Sıra','sayi'],['Önceki','sayi et-dar-gizle'],['Net','sayi'],['Başarı','sayi et-dar-gizle'],['Türkiye','sayi et-dar-gizle'],['Fark','sayi'],['1 net daha','sayi et-dar-gizle'],['1. kurum','et-dar-gizle']];
  return '<section class="et-panel"><div class="et-kart-bas"><h2>'+kacis('Dersler · '+s.ad)+'</h2></div><div class="et-tablo-kutu"><table class="et-tablo tg-tablo"><thead><tr>'+
    sutun.map(([a,c])=>'<th'+(c?' class="'+c+'"':'')+'>'+a+'</th>').join('')+'</tr></thead><tbody>'+
    l.map(d=>{const p=d.seri[i],q=o===null?null:d.seri[o],f=p.net===null?null:p.net-p.genel;
      return '<tr data-tg-ders="'+kacis(d.kod)+'"'+(st.odak===d?' class="secili"':'')+'><td><i class="et-renk nokta" style="background:'+d.renk+'"></i> '+kacis(d.ad)+'</td>'+
        '<td class="sayi">'+(p.sira!==null?fi(p.sira)+'.':'—')+siraOk(siraFarki(d,m))+'</td><td class="sayi et-dar-gizle">'+(q?q.sira!==null?fi(q.sira)+'.':'—':'')+'</td>'+
        '<td class="sayi">'+(p.net===null?'—':f2(p.net))+'</td><td class="sayi et-dar-gizle">'+(p.net===null?'—':'%'+f1(p.net/p.soru*100))+'</td><td class="sayi et-dar-gizle">'+f2(p.genel)+'</td>'+
        '<td class="sayi'+(f===null?'':f>0?' et-yukari':f<0?' et-asagi':'')+'">'+(f===null?'—':isaret(f,f2))+'</td><td class="sayi et-dar-gizle">'+(p.birNet&&p.sira!==null&&p.birNet<p.sira?fi(p.birNet)+'.':'—')+'</td>'+
        '<td class="et-dar-gizle tg-ilk">'+kacis(okulAdi(p.ilk.ad))+' · '+f2(p.ilk.net)+'</td></tr>'}).join('')+'</tbody></table></div></section>';
}
// Every list kept, all grades and kinds, with its date and how many subjects hold the school.
function kaynaklar(v,st,salt){
  const m=st?st.m:model(v,{}),okulK=m.okul?anahtar(m.okul):null;
  const l=m.tum.slice().sort((a,b)=>LISTELER.findIndex(x=>x[0]===a.liste)-LISTELER.findIndex(x=>x[0]===b.liste)||grupSira(b.yer||'tum')-grupSira(a.yer||'tum')||(a.g??1e9)-(b.g??1e9)||a.ad.localeCompare(b.ad,'tr',{numeric:true}));
  return '<section class="et-panel" id="tgKaynak"><div class="et-kart-bas"><h2>Denemeler</h2>'+(salt?'':'<button type="button" class="et-dugme" id="tgSilHepsi">Tüm listeleri sil</button>')+'</div><div class="et-kaydir"><table class="et-kaynak"><thead><tr><th>Deneme</th><th class="tg-dar-gizle">Sınıf</th><th class="tg-dar-gizle">Liste</th><th>Tarih</th><th class="tg-dar-gizle">Dersler</th><th>Okulunuz</th>'+(salt?'':'<th></th>')+'</tr></thead><tbody>'+
    l.map(s=>{const var_=okulK?s.dersler.filter(d=>d.satir.some(r=>anahtar(r.ad)===okulK)).length:null;
      const sinif=salt?(s.yer?grupAdi(s.yer):'—'):'<select class="tg-sinif" data-tg-sinif="'+kacis(s.id)+'" aria-label="'+kacis(s.ad)+' sınıfı"><option value="">'+(s.duzeyOto?'Otomatik · '+s.duzeyOto+'. sınıf':s.yer?'Otomatik · '+grupAdi(s.yer):'Otomatik')+'</option>'+
        [12,11,10,9,0].map(d=>'<option value="'+d+'"'+(s.duzeyElle&&s.duzey===d?' selected':'')+'>'+(d?d+'. sınıf':'Diğer')+'</option>').join('')+'</select>';
      return '<tr><td class="tg-ad">'+kacis(s.ad)+'</td><td class="tg-dar-gizle">'+sinif+'</td><td class="tg-dar-gizle">'+kacis(LISTE_ADI[s.liste])+'</td><td class="tg-ad">'+(s.g!==null?tarihUzun(s.g)+(s.gKaynak==='rapor'?' <span class="mini tg-dar-gizle">rapor</span>':''):'—')+'</td>'+
        '<td class="tg-dar-gizle">'+fi(s.dersler.length)+'</td><td>'+(var_===null?'—':fi(var_)+' derste')+'</td>'+(salt?'':'<td><button type="button" class="et-dugme" data-tg-sil="'+kacis(s.id)+'" aria-label="'+kacis(s.ad+' · '+LISTE_ADI[s.liste])+' listesini sil">Sil</button></td>')+'</tr>'}).join('')+'</tbody></table></div></section>';
}
/* ---------------- T ve sıra (the default view): the school-level twin of Deneme panosu ---------------- */
// Karşılaştırma: Tüm dönem / Son deneme / Son 3 / Son 5 deneme / Seç; the range is first → latest (onceki → simdi).
const ARALIKLAR_T=[['tum','Tüm dönem'],['1','Son deneme'],['3','Son 3 deneme'],['5','Son 5 deneme'],['sec','Seç']];
const GRAFIKLER_T=[['t','T puanı'],['sira','Sıra'],['artis','Artış sırası']];
const olcuAdi=st=>st.odak||'toplam';
function cumleT(st){
  const m=st.m,s=m.sinavlar[m.simdi],b=t=>'<b>'+t+'</b>',O=olcuT(st),p=O.seri[m.simdi],q=m.onceki===null?null:O.seri[m.onceki];
  const bas=kacis(s.ad)+(s.g!==null?' ('+gunAy(s.g)+')':'')+' · '+kacis(LISTE_ADI[m.liste])+' listesi · ';
  if(!m.okul)return bas+'Okulunuzu “Okul” listesinden seçin; T puanı ve sırası deneme deneme çizilir.';
  const ad=b(kacis(okulAdi(m.okul)))+' · '+kacis(O.ad);
  if(!p||p.t===null)return bas+ad+': bu denemede T puanı hesaplanamıyor'+(p&&p.yok?' ('+kacis(tYok(p))+')':'')+'.';
  const fark=q&&q.t!==null?p.t-q.t:null;
  return bas+ad+': T puanı '+b(f1(p.t))+(fark!==null?' ('+kacis(m.sinavlar[m.onceki].ad)+' ile: '+b(isaret(fark,f1))+')':'')+
    (siraDegeri(p)!==null?' · '+(p.sira!==null?'sıra ':'tahmini sıra ')+b(siraYazisi(p)):'')+' · '+(p.t>=50?'okullar ortalamasının üstünde.':'okullar ortalamasının altında.');
}
// The KPI strip, as in Deneme panosu: the primary tile is the school's change in T over the range with its increase place; each
// supporting tile carries its comparison with the first exam of the range.
function ozetT(st){
  const m=st.m,i=m.simdi,a=m.onceki,O=olcuT(st),d=olcuAdi(st),p=O.seri[i],q=a===null?null:O.seri[a];
  const kart=(sinif,ad,buyuk,alt)=>'<div class="et-ozet-kart'+sinif+'"><span class="dp-kpi-ad">'+ad+'</span><strong>'+buyuk+'</strong><div class="dp-kpi-alt">'+alt+'</div></div>';
  const not=t=>'<span class="dp-kpi-not">'+t+'</span>',yok='<span class="dp-kpi-yok">veri yok</span>';
  const R=a===null?null:artisT(m,d,a,i),biz=R&&R.biz,fark=biz?biz.fark:null;
  const ana=a===null?kart(' dp-kpi-ana','T puanı değişimi',yok,not('Karşılaştırma için ikinci deneme gerekir'))
    :kart(' dp-kpi-ana','T puanı değişimi · '+kacis(O.ad),fark===null?yok:isaret(fark,f1)+'<small>T</small>',
      not(biz?'Artış sırası '+(biz.yaklasik?'≈ ':'')+fi(biz.sira)+'. / '+fi(R.satir.length)+' okul':'Artış sırası hesaplanamıyor')+not(ciftAdi(m)));
  const cmp=(x,y,f=f1)=>x!==null&&x!==undefined&&y!==null&&y!==undefined?hap(x-y,f(Math.abs(x-y)))+not('ilk denemeye göre'+(a===null?'':' ('+kacis(m.sinavlar[a].ad)+': '+f(y)+')')):'';
  const tT=kart('','T puanı · '+kacis(O.ad),p&&p.t!==null?f1(p.t):yok,(q&&p&&p.t!==null?cmp(p.t,q.t):'')+not('Sıra '+kacis(siraYazisi(p))));
  const ustte=k=>{const l=k===null?[]:m.dersler.filter(x=>x.seri[k]&&x.seri[k].t!==null);return {n:l.filter(x=>x.seri[k].t>50).length,top:l.length}};
  const u=ustte(i),u0=a===null?null:ustte(a);
  const ust=kart('','Ortalamanın üstünde',fi(u.n)+'<small>/ '+fi(u.top)+' ders</small>',(u0&&u0.top?hap(u.n-u0.n,fi(Math.abs(u.n-u0.n)))+not('ilk denemeye göre ('+fi(u0.n)+' / '+fi(u0.top)+')'):not('T &gt; 50')));
  const okulN=kart('','Okul sayısı',p&&p.n?fi(p.n)+'<small>okul</small>':yok,not(p&&p.n?(p.tam?'tam liste':'tahmin'+(p.aralik&&p.aralik[0]!==p.aralik[1]?' (derslerde '+fi(p.aralik[0])+'–'+fi(p.aralik[1])+')':'')):'okullar arası dağılım yok')+(q&&q.n&&p&&p.n&&q.n!==p.n?not('ilk denemede '+fi(q.n)):''));
  return '<div class="et-ozet dp-kpi" id="tgKpi">'+ana+tT+ust+okulN+'</div>';
}
function tPaneli(st){
  const O=olcuT(st),g=st.grafik,m=st.m,coklu=!st.odak,tur=g==='sira'?'tsira':g==='artis'?'tartis':'t';
  const baslik=(g==='t'?'T puanı · ':g==='sira'?'Sıra · ':'Artış sırası · ')+(coklu?O.ad+' ve dersler':O.ad);
  const var_=GRAFIKLER[tur](st,400)!==null;
  const bos=g==='artis'?(m.onceki===null?'Artış sırası için ikinci bir deneme gerekir.':'Artış sırası hesaplanamıyor.'):g==='sira'?'Sıra hesaplanamıyor.':'T puanı hesaplanamıyor: okulun neti listede olmadığı denemelerde basılmıyor.';
  const lj=coklu?(g==='t'?lejant([['var(--e-fg)',O.ad+' (kalın çizgi)'],['var(--e-fg2)','Türkiye ortalaması (okullar)','cizgi tg-renk-kesik']]):lejant([['var(--e-fg)',O.ad+' (kalın çizgi)'],['transparent','Tahmini sıra','tg-renk-disi']]))
    :(g==='t'?lejant([[O.renk,'T puanı (okullar arası)'],['var(--e-fg2)','Türkiye ortalaması (okullar)','cizgi tg-renk-kesik']]):lejant([[O.renk,g==='artis'?'Artış sırası':'Listedeki sıra'],['transparent','Tahmini sıra','tg-renk-disi']]));
  return '<section class="et-panel" id="tgTPanel"><div class="et-kart-bas"><h2>'+kacis(baslik)+'</h2>'+lj+'</div>'+
    (var_?'<div class="et-grafik orta" data-tg-grafik="'+tur+'" tabindex="0" role="img" aria-label="'+kacis(baslik+', deneme deneme')+'"></div>':'<p class="mini">'+kacis(bos)+'</p>')+
    (st.odak?'<div class="tg-ders-geri"><button type="button" class="et-dugme" data-tg-ders="">Tüm dersler</button></div>':'')+'</section>';
}
function dersKartlariT(st){
  const m=st.m,i=m.simdi,a=m.onceki,g=st.grafik;
  return '<div class="et-dersler">'+m.dersler.map(d=>{const p=d.seri[i],R=a===null?null:artisT(m,d,a,i),biz=R&&R.biz;
    const durum=!p?'bu denemede yok':p.sira!==null?fi(p.sira)+'. sıra':p.tahmin!==null?'≈ '+fi(p.tahmin)+'. sıra':'listede değil';
    const tip=!p||!p.dg?'':okulSayisiYazisi({n:p.dg.n,tam:p.dg.tam,aralik:p.dg.aralik});
    const mini=g==='t'?d.seri.map(x=>x&&x.t!==null?x.t:null):g==='sira'?d.seri.map(x=>{const v=siraDegeri(x);return v===null?null:-v}):artisSeri(m,d).map(x=>x?-x.sira:null);
    const son=g==='artis'?mini.length-1:i;
    return '<button type="button" class="et-ders" data-tg-ders="'+kacis(d.kod)+'" aria-pressed="'+(st.odak===d)+'"'+(tip?' title="'+kacis(tip)+'"':'')+'><span class="et-ders-ust"><i class="et-renk nokta" style="background:'+d.renk+'"></i><b>'+kacis(d.ad)+'</b><span class="mini">'+(p?fi(p.soru)+' soru':'')+'</span></span>'+
      '<strong>'+(p&&p.t!==null?f1(p.t):'—')+'<span class="tg-bolu"> T</span></strong>'+
      '<span class="et-ders-alt"><span class="mini">'+kacis(durum)+(biz?' · ΔT '+kacis(isaret(biz.fark,f1)):'')+'</span></span>'+
      '<span class="et-kucuk-kutu" title="'+(g==='t'?'T puanı':g==='sira'?'Sıra':'Artış sırası')+'">'+kucukCizgi(mini,d.renk,son,160,38)+'</span></button>'}).join('')+'</div>';
}
function dersTablosuT(st){
  const m=st.m,i=m.simdi,s=m.sinavlar[i],l=m.dersler.filter(d=>d.seri[i]);
  const sutun=[['Ders'],['T','sayi'],['Sıra','sayi'],['Net','sayi et-dar-gizle'],['Ortalama','sayi et-dar-gizle'],['σ','sayi et-dar-gizle'],['N','sayi et-dar-gizle']];
  return '<section class="et-panel"><div class="et-kart-bas"><h2>'+kacis('Dersler · '+s.ad)+'</h2></div><div class="et-tablo-kutu"><table class="et-tablo tg-tablo"><thead><tr>'+
    sutun.map(([a,c])=>'<th'+(c?' class="'+c+'"':'')+'>'+a+'</th>').join('')+'</tr></thead><tbody>'+
    l.map(d=>{const p=d.seri[i];
      return '<tr data-tg-ders="'+kacis(d.kod)+'"'+(st.odak===d?' class="secili"':'')+'><td><i class="et-renk nokta" style="background:'+d.renk+'"></i> '+kacis(d.ad)+'</td>'+
        '<td class="sayi'+(p.t===null?'':p.t>50?' et-yukari':p.t<50?' et-asagi':'')+'">'+(p.t===null?'—':f1(p.t))+'</td><td class="sayi">'+(p.sira!==null?fi(p.sira)+'.':p.tahmin!==null?'≈ '+fi(p.tahmin)+'.':'—')+'</td>'+
        '<td class="sayi et-dar-gizle">'+(p.tNet===null?'—':f2(p.tNet))+'</td><td class="sayi et-dar-gizle">'+f2(p.dg?p.dg.mu:p.genel)+'</td>'+
        '<td class="sayi et-dar-gizle">'+(p.dg?f2(p.dg.sigma):'—')+'</td><td class="sayi et-dar-gizle">'+(p.dg?(p.dg.tam?'tam liste · ':'≈ ')+fi(p.dg.n):'—')+'</td></tr>'}).join('')+
    '</tbody></table></div></section>';
}
// Artış sıralaması on ΔT: the first three and the three on each side of the followed school.
function artisTSiralamasi(st){
  const m=st.m,d=olcuAdi(st),ad=st.odak?st.odak.ad:olcuT(st).ad;
  const bas='<section class="et-panel tg-cevre-panel" id="tgArtisSira"><div class="et-kart-bas"><h2>'+kacis('Artış sıralaması (ΔT) · '+ad)+'</h2><span class="mini">'+ciftAdi(m)+'</span></div>';
  if(m.onceki===null)return bas+'<p class="mini">Artış sırası için ikinci bir deneme gerekir.</p></section>';
  const R=artisT(m,d,m.onceki,m.simdi),l=R.satir;if(!l.length)return bas+'<p class="mini">İki denemede de bu ölçü olan okul yok.</p></section>';
  const k=R.biz?l.indexOf(R.biz):-1,goster=new Set([0,1,2].filter(j=>j<l.length));
  if(k>=0)for(let j=k-3;j<=k+3;j++){if(j>=0&&j<l.length)goster.add(j)}
  const ara='<li class="tg-cevre-ara" aria-hidden="true">…</li>';let out='',onceki=-1;
  for(const j of [...goster].sort((x,y)=>x-y)){
    if(j>onceki+1)out+=ara;const r=l[j];
    out+='<li class="tg-cevre-satir tg-artis-satir'+(j===k?' tg-biz':'')+'"><span class="tg-sira">'+(r.yaklasik?'≈ ':'')+fi(r.sira)+'.</span><span class="tg-cevre-ad">'+kacis(okulAdi(r.ad))+'</span><b class="'+yon(r.fark)+'">'+isaret(r.fark,f1)+' T</b><span class="mini">'+f1(r.once)+' → '+f1(r.simdi)+'</span></li>';
    onceki=j;
  }
  if(onceki<l.length-1)out+=ara;
  return bas+'<ol class="tg-cevre">'+out+'</ol><p class="mini tg-cevre-not">'+kacis(fi(R.nOrtak)+' okul iki denemede de listede.'+(R.yaklasik?' Okulunuz bir listede yok: sırası ≈ (kendi netinden).':''))+'</p></section>';
}
// The schools of the range for the chosen measure: T and place in the latest exam, ΔT and its place over the range.
function okulSatirlari(st){
  const m=st.m,d=olcuAdi(st),b=m.simdi,a=m.onceki,okulK=m.okul?anahtar(m.okul):null,keys=new Map();
  for(let i=a===null?b:a;i<=b;i++)for(const [k,v] of tHaritasi(m,d,i))keys.set(k,v.ad);
  if(okulK&&!keys.has(okulK))keys.set(okulK,m.okul);
  const R=a===null?null:artisT(m,d,a,b),rk=new Map(R?R.satir.map(r=>[r.key,r]):[]),Hb=tHaritasi(m,d,b),op=olcuT(st).seri[b];
  const tp=d==='toplam'&&m.toplam?m.toplam.tseri[b]:null;
  return [...keys].map(([k,ad])=>{
    const v=Hb.get(k),r=rk.get(k),biz=k===okulK;let t=v?v.t:null,net=v?v.net:null,sira=null,yak=false;
    if(v){if(d!=='toplam')sira=v.sira;else if(tp&&tp.tam)sira=1+[...Hb.values()].filter(z=>z.net>v.net+1e-9).length;else if(tp&&tp.sigma>0){sira=tahminiSira(v.net,tp.genel,tp.sigma,tp.n,1);yak=sira!==null}}
    else if(biz&&op){t=op.t;net=op.net;if(op.sira!==null&&op.sira!==undefined)sira=op.sira;else if(op.tahmin!==null&&op.tahmin!==undefined){sira=op.tahmin;yak=true}}
    return {key:k,ad,biz,t,net,sira,yak,fark:r?r.fark:null,artis:r?r.sira:null,artisYak:!!(r&&r.yaklasik)};
  });
}
const OKUL_SUTUN=[['ad','Okul'],['t','T','sayi'],['sira','Sıra','sayi et-dar-gizle'],['fark','ΔT','sayi'],['artis','Artış sırası','sayi'],['net','Net','sayi et-dar-gizle']];
const OKUL_YON={ad:'artan',t:'azalan',sira:'artan',fark:'azalan',artis:'artan',net:'azalan'};
function okulTablosu(st){
  const m=st.m,ad=st.odak?st.odak.ad:olcuT(st).ad,sut=OKUL_SUTUN.some(x=>x[0]===EK.tgSira)?EK.tgSira:'fark',yon_=EK.tgSira&&OKUL_SUTUN.some(x=>x[0]===EK.tgSira)?(EK.tgSiraYon==='artan'||EK.tgSiraYon==='azalan'?EK.tgSiraYon:OKUL_YON[sut]):OKUL_YON[sut],yonu=yon_==='artan'?1:-1;
  const satirlar=okulSatirlari(st),de=(r,c)=>c==='ad'?r.ad:r[c];
  satirlar.sort((x,y)=>{const a=de(x,sut),b=de(y,sut);if(a===null&&b===null)return x.ad.localeCompare(y.ad,'tr');if(a===null)return 1;if(b===null)return -1;
    const f=typeof a==='number'?a-b:String(a).localeCompare(String(b),'tr');return f*yonu||x.ad.localeCompare(y.ad,'tr')});
  const biz=satirlar.find(r=>r.biz),yz=(r,c)=>c==='ad'?'<td class="tg-okul-ad">'+kacis(okulAdi(r.ad))+(r.biz?' <span class="mini">· bizim okul</span>':'')+'</td>':
    c==='t'?'<td class="sayi">'+(r.t===null?'—':f1(r.t))+'</td>':c==='sira'?'<td class="sayi et-dar-gizle">'+(r.sira===null?'—':(r.yak?'≈ ':'')+fi(r.sira)+'.')+'</td>':
    c==='fark'?'<td class="sayi'+(r.fark===null?'':r.fark>0?' et-yukari':r.fark<0?' et-asagi':'')+'">'+(r.fark===null?'—':isaret(r.fark,f1))+'</td>':
    c==='artis'?'<td class="sayi">'+(r.artis===null?'—':(r.artisYak?'≈ ':'')+fi(r.artis)+'.')+'</td>':'<td class="sayi et-dar-gizle">'+(r.net===null?'—':f2(r.net))+'</td>';
  const satir=(r,pin)=>'<tr class="'+(r.biz?'tg-biz':'')+(pin?' tg-pin':'')+'"'+(r.biz&&!pin?' id="tgBizSatir"':'')+' data-okul="'+kacis(r.key)+'">'+OKUL_SUTUN.map(([c])=>yz(r,c)).join('')+'</tr>';
  const bas=OKUL_SUTUN.map(([c,yazi,sn])=>'<th scope="col"'+(sn?' class="'+sn+'"':'')+' aria-sort="'+(sut===c?(yonu>0?'ascending':'descending'):'none')+'"><button type="button" data-tg-sira="'+c+'">'+yazi+(sut===c?(yonu>0?' ▲':' ▼'):'')+'</button></th>').join('');
  return '<section class="et-panel" id="tgOkullar"><div class="et-kart-bas"><h2>'+kacis('Okullar · '+ad)+'</h2><span class="mini">'+fi(satirlar.length)+' okul · '+ciftAdi(m)+'</span>'+
    (biz?'<button type="button" class="et-dugme" data-tg-biz="1">Bizim okul</button>':'')+'</div>'+
    '<div class="et-tablo-kutu tg-okul-kutu"><table class="et-tablo tg-tablo"><thead><tr>'+bas+'</tr></thead><tbody>'+satirlar.map(r=>satir(r,false)).join('')+'</tbody>'+(biz?'<tfoot>'+satir(biz,true)+'</tfoot>':'')+'</table></div></section>';
}
/* ---------------- Artış: how much the school's net rose ---------------- */
// The measure on show: the chosen subject, else the session's total.
const olcuAl=st=>st.odak?{ad:st.odak.ad,artis:st.odak.artis,soru:st.odak.soru}:st.m.toplam?{ad:st.m.toplam.ad,artis:st.m.toplam.artis}:null;
const ciftAdi=m=>m.onceki===null?kacis(m.sinavlar[m.simdi].ad):kacis(m.sinavlar[m.onceki].ad)+' → '+kacis(m.sinavlar[m.simdi].ad);
function cumleArtis(st){
  const m=st.m,b=t=>'<b>'+t+'</b>',bas=ciftAdi(m)+(m.onceki!==null&&m.simdi-m.onceki>1?' ('+fi(m.simdi-m.onceki+1)+' deneme)':'')+' · '+kacis(LISTE_ADI[m.liste])+' listesi · ';
  if(!m.okul)return bas+'Okulunuzu “Okul” listesinden seçin; netinin deneme deneme ne kadar arttığı çizilir.';
  const okul=b(kacis(okulAdi(m.okul)));
  if(m.onceki===null)return bas+okul+': artışı görmek için ikinci bir deneme ekleyin.';
  const O=olcuAl(st),a=O&&O.artis;
  if(!a||a.fark===null)return bas+okul+': '+kacis(O?O.ad:m.oturum||'')+' iki denemede de hesaplanamıyor.';
  // The net change first (total over the run and the average per exam), then against the Türkiye average's.
  const cok=a.adim>1;
  return bas+okul+' · '+kacis(O.ad)+': net '+(cok?'toplam ':'')+b(artisOk(a.fark))+(cok&&a.ort!==null?', deneme başına '+b(artisOk(a.ort)):'')+' (okul '+f2(a.once)+' → '+f2(a.simdi)+'; Türkiye ortalaması '+
    artisOk(a.genelFark)+(cok&&a.genelOrt!==null?', deneme başına '+artisOk(a.genelOrt):'')+'). Türkiye’ye göre '+(cok?'toplam ':'')+b(isaret(a.goreli,f2)+' net')+'. Artış sırası '+b(fi(a.biz.sira)+'.')+' / '+fi(a.satir.length)+' kurum.';
}
// A subject's increase over the Türkiye average's, in success points (net ÷ questions), so subjects compare.
const goreliPuan=d=>d.artis&&d.artis.goreli!==null?d.artis.goreli/d.soru*100:null;
function ozetArtis(st){
  const m=st.m,T=m.toplam,a=T&&T.artis;
  const kart=(baslik,buyuk,alt)=>'<div class="et-ozet-kart"><span class="mini">'+baslik+'</span><strong>'+buyuk+'</strong><div class="et-ozet-alt">'+alt+'</div></div>';
  const l=m.dersler.filter(d=>goreliPuan(d)!==null).sort((x,y)=>goreliPuan(y)-goreliPuan(x)),en=l[0]&&goreliPuan(l[0])>0?l[0]:null,az=l.length&&goreliPuan(l[l.length-1])<0?l[l.length-1]:null;
  const dersYazi=d=>hap(d.artis.goreli,f2(Math.abs(d.artis.goreli))+' TR’ye göre')+'<span class="mini">okul '+artisOk(d.artis.fark)+' · TR '+artisOk(d.artis.genelFark)+'</span>';
  return '<div class="et-ozet">'+
    (a&&a.fark!==null?kart(kacis(T.ad)+' · net değişimi'+(a.adim>1?' (toplam)':''),artisOk(a.fark),'<span class="mini">'+f2(a.once)+' → '+f2(a.simdi)+' · TR '+artisOk(a.genelFark)+'</span>')+
      (a.adim>1&&a.ort!==null?kart('Deneme başına ortalama',artisOk(a.ort),'<span class="mini">'+fi(a.adim)+' adımda · TR '+artisOk(a.genelOrt)+'</span>'):'')+
      kart('Türkiye’ye göre'+(a.adim>1?' (toplam)':''),isaret(a.goreli,f2),hap(a.goreli,a.goreli>0?'TR’den çok arttı':a.goreli<0?'TR’den az arttı':'TR kadar'))+
      kart('Artış sırası',fi(a.biz.sira)+'.','<span class="mini">'+fi(a.satir.length)+' kurum içinde</span>'):'')+
    kart('Türkiye’den çok artan',fi(l.filter(d=>goreliPuan(d)>0).length)+'<span class="tg-bolu"> / '+fi(l.length)+'</span>','<span class="mini">ders</span>')+
    (en?kart('En çok artan',kacis(en.ad),dersYazi(en)):'')+(az?kart('En çok geride kalan',kacis(az.ad),dersYazi(az)):'')+'</div>';
}
function toplamPaneli(st){
  const m=st.m,T=m.toplam;
  return '<section class="et-panel"><div class="et-kart-bas"><h2>'+kacis('Net · '+T.ad)+'</h2>'+
    lejant([['var(--e-c1)',okulAdi(m.okul)],['var(--e-fg2)','Türkiye ortalaması','cizgi tg-renk-kesik']])+'</div>'+
    '<div class="et-grafik orta" data-tg-grafik="toplam" tabindex="0" role="img" aria-label="'+kacis('Net · '+T.ad)+', deneme deneme"></div></section>';
}
// Denemeler arası net değişimi: the school's change in net from each exam to the next, for the total and
// for every subject (a row each), then the total of the changes and their average per exam. The Türkiye
// average's total and average sit beside them.
function adimlarPaneli(st){
  const m=st.m,T=m.toplam,satirlar=[...(T&&T.artis?[{ad:T.ad,a:T.artis,toplam:true}]:[]),...m.dersler.filter(d=>d.artis).map(d=>({ad:d.ad,a:d.artis,d}))];
  if(!satirlar.length||!satirlar[0].a.adimlar.length)return '';
  const adimlar=satirlar[0].a.adimlar,c=v=>v===null?'—':artisOk(v),yonlu=v=>v===null?'':v>0?' et-yukari':v<0?' et-asagi':'';
  const hucre=(v,ek)=>'<td class="sayi'+yonlu(v)+(ek||'')+'">'+c(v)+'</td>';
  // Toplam and Ortalama come first, so a narrow screen shows them before the exam columns scroll.
  const baslik='<th>Ölçü</th><th class="sayi">Toplam</th><th class="sayi">Ortalama</th>'+adimlar.map(x=>'<th class="sayi" title="'+kacis(x.onceki+' → '+x.ad)+'">'+kacis(x.ad)+'</th>').join('')+
    '<th class="sayi et-dar-gizle">TR toplam</th><th class="sayi et-dar-gizle">TR ortalama</th>';
  const satir=satirlar.map(r=>'<tr'+(r.toplam?' class="tg-toplam"':'')+(r.d?' data-tg-ders="'+kacis(r.d.kod)+'"':'')+(r.d&&st.odak===r.d?' class="secili"':'')+'><td class="tg-ad">'+
    (r.d?'<i class="et-renk nokta" style="background:'+r.d.renk+'"></i> ':'')+kacis(r.ad)+'</td>'+hucre(r.a.fark,' tg-kalin')+hucre(r.a.ort,' tg-kalin')+r.a.adimlar.map(x=>hucre(x.fark)).join('')+hucre(r.a.genelFark,' et-dar-gizle')+hucre(r.a.genelOrt,' et-dar-gizle')+'</tr>').join('');
  const bos=satirlar.some(r=>r.a.adimlar.some(x=>x.fark===null));
  return '<section class="et-panel" id="tgAdimlar"><div class="et-kart-bas"><h2>Denemeler arası net değişimi</h2><span class="mini">'+ciftAdi(m)+'</span></div>'+
    '<p class="mini">Toplam: net değişimlerinin toplamı (ilk denemeden sonuncuya); Ortalama: deneme başına. Her deneme sütunu, bir önceki denemeye göre okulun net değişimidir.</p>'+
    '<div class="et-tablo-kutu"><table class="et-tablo tg-tablo tg-matris"><thead><tr>'+baslik+'</tr></thead><tbody>'+satir+'</tbody></table></div>'+
    (bos?'<p class="mini">Okul bir denemede listede yoksa neti basılmaz; o adım boş kalır. Toplam ve ortalama ilk ve son denemeden hesaplanır.</p>':'')+'</section>';
}
// Artış sıralaması: every school by its increase between the two exams; the first three and the
// schools around the followed one, with the Türkiye average's increase where it falls.
function artisSiralamasi(st){
  const m=st.m,O=olcuAl(st),a=O&&O.artis;
  const bas='<section class="et-panel tg-cevre-panel" id="tgArtisSira"><div class="et-kart-bas"><h2>'+kacis('Artış sıralaması · '+(O?O.ad:''))+'</h2><span class="mini">'+ciftAdi(m)+'</span></div>';
  if(!a||!a.satir.length)return bas+'<p class="mini">İki denemede de bu ölçü olan kurum yok.</p></section>';
  const l=a.satir,k=a.biz?l.indexOf(a.biz):-1,goster=new Set([0,1,2].filter(j=>j<l.length));
  if(k>=0)for(let j=k-3;j<=k+3;j++){if(j>=0&&j<l.length)goster.add(j)}
  const sira=[...goster].sort((x,y)=>x-y),gYer=a.genelFark===null?Infinity:l.filter(r=>r.fark>a.genelFark+1e-9).length;
  const ara='<li class="tg-cevre-ara" aria-hidden="true">…</li>',genel=a.genelFark===null?'':'<li class="tg-cevre-satir tg-artis-satir tg-genel-satir"><span class="tg-sira"></span><span class="tg-cevre-ad">Türkiye ortalaması</span><b>'+artisOk(a.genelFark)+'</b><span class="mini">'+f2(a.genelOnce)+' → '+f2(a.genelSimdi)+'</span></li>';
  let out='',onceki=-1,kondu=!genel;
  for(const j of sira){
    if(!kondu&&gYer<=j){out+=(gYer>onceki+1?ara:'')+genel+(j>gYer?ara:'');kondu=true}else if(j>onceki+1)out+=ara;
    const r=l[j];
    out+='<li class="tg-cevre-satir tg-artis-satir'+(j===k?' tg-biz':'')+'"><span class="tg-sira">'+fi(r.sira)+'.</span><span class="tg-cevre-ad">'+kacis(okulAdi(r.ad))+'</span><b class="'+yon(r.fark)+'">'+artisOk(r.fark)+'</b><span class="mini">'+f2(r.once)+' → '+f2(r.simdi)+'</span></li>';
    onceki=j;
  }
  if(!kondu)out+=(gYer>onceki+1?ara:'')+genel+(gYer<l.length?ara:'');else if(onceki<l.length-1)out+=ara;
  return bas+'<ol class="tg-cevre">'+out+'</ol><p class="mini tg-cevre-not">'+kacis(fi(l.length)+' kurum iki denemede de listede.'+(k<0?' Okulunuz iki denemede de listede değil.':''))+'</p></section>';
}
function dersKartlariArtis(st){
  const m=st.m;
  return '<div class="et-dersler">'+m.dersler.map(d=>{const a=d.artis,v=goreliPuan(d);
    return '<button type="button" class="et-ders" data-tg-ders="'+kacis(d.kod)+'" aria-pressed="'+(st.odak===d)+'"><span class="et-ders-ust"><i class="et-renk nokta" style="background:'+d.renk+'"></i><b>'+kacis(d.ad)+'</b><span class="mini">'+(d.soru?fi(d.soru)+' soru':'')+'</span></span>'+
      '<strong>'+(a&&a.goreli!==null?isaret(a.goreli,f2):'—')+'</strong>'+
      '<span class="et-ders-alt"><span class="mini">'+(a&&a.fark!==null?'TR’ye göre · okul '+artisOk(a.fark)+', TR '+artisOk(a.genelFark):'iki denemede de yok')+(a&&a.biz?' · '+fi(a.biz.sira)+'. sıra':'')+'</span></span>'+
      // The mini line is the net minus the Türkiye average: its slope is the increase against Türkiye.
      '<span class="et-kucuk-kutu">'+kucukCizgi(d.seri.map(x=>x&&x.net!==null?x.net-x.genel:null),egilimRengi(v||0),m.simdi,160,38)+'</span></button>'}).join('')+'</div>';
}
// Türkiye’ye göre artış: each subject's increase minus the Türkiye average's; bars in success points.
function farkArtisPaneli(st){
  const m=st.m,l=m.dersler.filter(d=>d.artis&&d.artis.goreli!==null);
  const ust=Math.max(5,...l.map(d=>Math.abs(goreliPuan(d))));
  return '<section class="et-panel"><div class="et-kart-bas"><h2>Türkiye’ye göre artış · '+ciftAdi(m)+'</h2><span class="mini">çubuk: başarı puanı</span></div><div class="tg-fark">'+
    m.dersler.map(d=>{const a=d.artis,v=goreliPuan(d);
      const bar=v===null?'<span class="tg-fark-iz"></span><span class="tg-fark-iz"></span>':'<span class="tg-fark-iz eksi">'+(v<0?'<i style="width:'+r1(-v/ust*100)+'%"></i>':'')+'</span><span class="tg-fark-iz arti">'+(v>0?'<i style="width:'+r1(v/ust*100)+'%"></i>':'')+'</span>';
      return '<button type="button" class="tg-fark-satir" data-tg-ders="'+kacis(d.kod)+'"><span class="tg-fark-ad"><i class="et-renk nokta" style="background:'+d.renk+'"></i>'+kacis(d.ad)+'</span>'+bar+
        '<b class="'+(v===null?'':yon(a.goreli))+'">'+(v===null?'—':isaret(a.goreli,f2))+'</b><span class="mini tg-fark-net">'+(a&&a.fark!==null?'okul '+artisOk(a.fark)+' · TR '+artisOk(a.genelFark):'')+'</span></button>'}).join('')+'</div></section>';
}
function dersTablosuArtis(st){
  const m=st.m,l=m.dersler.filter(d=>d.artis);
  const sutun=[['Ders'],['İlk','sayi et-dar-gizle'],['Son','sayi et-dar-gizle'],['Toplam değişim','sayi'],['TR artışı','sayi et-dar-gizle'],['TR’ye göre','sayi'],['TR’ye göre / deneme','sayi et-dar-gizle'],['Artış sırası','sayi'],['Sıra','sayi et-dar-gizle']];
  return '<section class="et-panel"><div class="et-kart-bas"><h2>Dersler · '+ciftAdi(m)+'</h2></div><div class="et-tablo-kutu"><table class="et-tablo tg-tablo"><thead><tr>'+
    sutun.map(([a,c])=>'<th'+(c?' class="'+c+'"':'')+'>'+a+'</th>').join('')+'</tr></thead><tbody>'+
    l.map(d=>{const a=d.artis,p=d.seri[m.simdi];
      return '<tr data-tg-ders="'+kacis(d.kod)+'"'+(st.odak===d?' class="secili"':'')+'><td><i class="et-renk nokta" style="background:'+d.renk+'"></i> '+kacis(d.ad)+'</td>'+
        '<td class="sayi et-dar-gizle">'+(a.once===null?'—':f2(a.once))+'</td><td class="sayi et-dar-gizle">'+(a.simdi===null?'—':f2(a.simdi))+'</td>'+
        '<td class="sayi'+(a.fark===null?'':a.fark>0?' et-yukari':a.fark<0?' et-asagi':'')+'">'+artisOk(a.fark)+'</td><td class="sayi et-dar-gizle">'+artisOk(a.genelFark)+'</td>'+
        '<td class="sayi'+(a.goreli===null?'':a.goreli>0?' et-yukari':a.goreli<0?' et-asagi':'')+'">'+(a.goreli===null?'—':isaret(a.goreli,f2))+'</td>'+
        '<td class="sayi et-dar-gizle">'+(a.goreliOrt===null?'—':isaret(a.goreliOrt,f2))+'</td>'+
        '<td class="sayi">'+(a.biz?fi(a.biz.sira)+'. <span class="mini">/ '+fi(a.satir.length)+'</span>':'—')+'</td><td class="sayi et-dar-gizle">'+(p&&p.sira!==null?fi(p.sira)+'.':'—')+'</td></tr>'}).join('')+
    '</tbody></table></div></section>';
}
// The lists stored but not in this chart (another list kind or grade), each a button that shows it.
function digerleri(st){
  const m=st.m,ids=new Set(m.sinavlar.map(s=>s.id)),l=m.tum.filter(s=>!ids.has(s.id));if(!l.length)return '';
  return '<p class="tg-diger">Grafikte '+fi(m.sinavlar.length)+' deneme var. Diğerleri: '+l.map(s=>'<button type="button" class="tg-git" data-tg-git="'+kacis(s.id)+'">'+kacis(s.ad)+' · '+
    kacis(s.liste!==m.liste?LISTE_ADI[s.liste]+' listesi':grupAdi(s.yer||'tum'))+'</button>').join(' ')+'</p>';
}
function icerik(){
  const salt=izleme(),{veri,hata}=oku(),baslik='<h1 class="et-baslik">Türkiye geneli</h1>';
  const ekle=salt?'':'<label class="et-dugme birincil">PDF ekle<input type="file" id="tgPdf" accept="application/pdf,.pdf" multiple hidden></label>';
  const durumSatiri='<p id="tgDurum" role="status" aria-live="polite">'+kacis(DURUM_YAZI)+'</p>';
  if(hata)return '<header class="et-bas">'+baslik+'</header><p class="et-uyari">'+kacis(hata)+'</p>'+durumSatiri;
  if(!veri)return '<header class="et-bas">'+baslik+'</header><div class="et-arac">'+ekle+'</div>'+durumSatiri+
    '<section class="et-panel et-bos"><b>Henüz liste yok</b>'+(salt?'':'<p>Myexamy’de sınavın Raporlar → Türkiye Geneli Analiz ve Raporları bölümünden “Ders Ortalamaları İlk 100 Kurum (Kolej)” PDF’ini indirip “PDF ekle” ile ekleyin. Her yeni deneme grafiğe bir nokta ekler.</p>')+'</section>';
  const st=durumAl(veri),m=st.m;
  cizimPlanla();
  const ust='<header class="et-bas">'+baslik+'<p class="et-cumle">'+(st.mod==='artis'?cumleArtis(st):st.mod==='sira'?cumle(st):cumleT(st))+'</p></header>'+arac(st,salt)+durumSatiri+digerleri(st);
  if(!m.okul)return ust+'<section class="et-panel et-bos tg-okul-sec"><b>Okulunuzu seçin</b><p>Üstteki “Okul” listesinden okulunuzu seçin.</p></section>'+kaynaklar(veri,st,salt);
  if(!m.ozet[m.simdi])return ust+'<section class="et-panel et-bos"><b>Bu denemede '+kacis(m.oturum||'')+' dersi yok</b></section>'+kaynaklar(veri,st,salt);
  if(st.mod==='tpuan')return ust+ozetT(st)+tPaneli(st)+dersKartlariT(st)+artisTSiralamasi(st)+okulTablosu(st)+dersTablosuT(st)+kaynaklar(veri,st,salt);
  if(st.mod==='artis'){
    const grafik=st.odak?netPaneli(st):m.toplam?toplamPaneli(st):'';
    if(m.onceki===null)return ust+grafik+kaynaklar(veri,st,salt);
    return ust+ozetArtis(st)+'<div class="et-iki">'+grafik+artisSiralamasi(st)+'</div>'+adimlarPaneli(st)+
      (st.odak?'<div class="tg-ders-geri"><button type="button" class="et-dugme" data-tg-ders="">Tüm dersler</button></div>':'')+dersKartlariArtis(st)+farkArtisPaneli(st)+dersTablosuArtis(st)+kaynaklar(veri,st,salt);
  }
  return ust+ozetKartlari(st)+siraPaneli(st)+dersKartlari(st)+(st.odak?'<div class="et-iki">'+netPaneli(st)+cevrePaneli(st)+'</div>':farkPaneli(st))+dersTablosu(st)+kaynaklar(veri,st,salt);
}
function gorunum(){
  if(!rehberMi())return '<div class="baslik"><h1>Türkiye geneli</h1></div><p>Bu sayfa rehber öğretmen içindir.</p>';
  return '<div id="tgKok">'+icerik()+'</div>';
}
function yenidenCiz(odak){
  const kok=document.getElementById('tgKok');if(!kok){ciz();return}
  kok.innerHTML=icerik();cizimPlanla();
  if(odak){const el=document.querySelector(odak);if(el)el.focus()}
}
async function pdfEkle(files){
  const okunan=[],hatalar=[],defter=D;let atlanan=0;
  for(const file of files){
    durum('PDF okunuyor: '+file.name);
    try{const {pages}=await denemePdfSayfalari(file);const r=pdfCoz(pages,file.name);atlanan+=r.atlanan;okunan.push(r)}catch(e){hatalar.push(file.name+': '+e.message)}
  }
  if(D!==defter||!rehberMi())throw new Error('Oturum değişti.');
  if(okunan.length){
    await raporEkle(okunan);
    // The page moves to the list just added: its kind, its grade and the exam itself.
    const r=okunan[okunan.length-1];gorunumeGit(kimlik(r.ad,r.liste));
  }
  return (okunan.length?'Eklendi: '+okunan.map(r=>r.ad+' · '+LISTE_ADI[r.liste]+' · '+fi(r.dersler.length)+' ders').join(', ')+'.':'Liste eklenmedi.')+
    (atlanan?' Okunamayan '+fi(atlanan)+' satır atlandı.':'')+(hatalar.length?' Okunamayan: '+hatalar.join(' · '):'');
}
// Shows one stored list: its kind, its grade group and the exam itself.
function gorunumeGit(id){
  const {veri}=oku();if(!veri)return;const m=model(veri,{}),s=m.tum.find(x=>x.id===id);if(!s)return;
  const mm=s.liste===m.liste?m:model(veri,{liste:s.liste}),t=mm.tum.find(x=>x.id===id);
  EK.tgListe=s.liste;EK.tgDuzey=mm.duzeyler.includes(t.yer)?t.yer:undefined;EK.tgSimdi=id;EK.tgOnceki=EK.tgDers=undefined;
}
function dersSec(kod){
  EK.tgDers=kod&&anahtar(kod)!==anahtar(EK.tgDers||'')?kod:undefined;
  yenidenCiz();(document.getElementById('tgSiraPanel')||document.getElementById('tgTPanel'))?.scrollIntoView({block:'nearest',behavior:'smooth'});
}
document.addEventListener('click',async ev=>{
  if(!etkin())return;
  const grafik=ev.target.closest?.('.et-grafik[data-tg-grafik="sira"],.et-grafik[data-tg-grafik="t"],.et-grafik[data-tg-grafik="tsira"],.et-grafik[data-tg-grafik="tartis"]');
  if(grafik&&grafik.dataset.seri!==undefined){const g=CIZIMLER.get(grafik.dataset.tgGrafik),s=g&&g.seriler&&g.seriler[Number(grafik.dataset.seri)];if(s){dersSec(s.kod);return}}
  const el=ev.target.closest?.('[data-tg-mod],[data-tg-gor],[data-tg-aralik],[data-tg-sira],[data-tg-biz],[data-tg-toplam],[data-tg-liste],[data-tg-duzey],[data-tg-oturum],[data-tg-cizgi],[data-tg-ders],[data-tg-git],[data-tg-sil],#tgSilHepsi');if(!el||el.disabled)return;
  if(el.dataset.tgMod){EK.tgMod=el.dataset.tgMod;yenidenCiz('[data-tg-mod="'+EK.tgMod+'"]');return}
  if(el.dataset.tgGor){EK.tgGrafik=grafikAl(el.dataset.tgGor);yenidenCiz('[data-tg-gor="'+EK.tgGrafik+'"]');return}
  if(el.dataset.tgAralik){EK.tgAralik=aralikAl(el.dataset.tgAralik);if(EK.tgAralik!=='sec')EK.tgOnceki=undefined;yenidenCiz('[data-tg-aralik="'+EK.tgAralik+'"]');return}
  if(el.dataset.tgSira){const c=el.dataset.tgSira,ayni=(EK.tgSira||'fark')===c,simdiki=EK.tgSiraYon==='artan'||EK.tgSiraYon==='azalan'?EK.tgSiraYon:OKUL_YON[c];
    EK.tgSiraYon=ayni?(simdiki==='artan'?'azalan':'artan'):OKUL_YON[c];EK.tgSira=c;yenidenCiz('[data-tg-sira="'+c+'"]');return}
  if(el.dataset.tgBiz){const r=document.getElementById('tgBizSatir');if(r){r.scrollIntoView({block:'center',behavior:'smooth'});r.classList.add('tg-isik');setTimeout(()=>r.classList.remove('tg-isik'),1600)}return}
  if(el.dataset.tgToplam){EK.tgToplam=el.dataset.tgToplam;EK.tgDers=undefined;yenidenCiz('[data-tg-toplam="'+EK.tgToplam+'"]');return}
  if(el.dataset.tgGit){gorunumeGit(el.dataset.tgGit);yenidenCiz();document.getElementById('tgKok')?.scrollIntoView({block:'start',behavior:'smooth'});return}
  if(el.dataset.tgListe){EK.tgListe=el.dataset.tgListe;EK.tgDuzey=EK.tgSimdi=EK.tgOnceki=EK.tgDers=undefined;yenidenCiz('[data-tg-liste="'+EK.tgListe+'"]');return}
  if(el.dataset.tgDuzey){EK.tgDuzey=el.dataset.tgDuzey;EK.tgSimdi=EK.tgOnceki=EK.tgDers=undefined;yenidenCiz('[data-tg-duzey="'+EK.tgDuzey+'"]');return}
  if(el.dataset.tgOturum){EK.tgOturum=el.dataset.tgOturum;EK.tgDers=undefined;yenidenCiz('[data-tg-oturum="'+EK.tgOturum+'"]');return}
  if(el.dataset.tgCizgi){GRAFIK_CIZGI.sec(el.dataset.tgCizgi);yenidenCiz('[data-tg-cizgi="'+GRAFIK_CIZGI.tur()+'"]');return}
  if(el.dataset.tgDers!==undefined){dersSec(el.dataset.tgDers);return}
  if(ISLEM||izleme())return;
  if(el.dataset.tgSil){
    if(!confirm('Bu liste silinsin mi? PDF’i yeniden ekleyebilirsiniz.'))return;
    ISLEM=true;try{await sinavSil(el.dataset.tgSil);if(EK.tgSimdi===el.dataset.tgSil)EK.tgSimdi=undefined;if(EK.tgOnceki===el.dataset.tgSil)EK.tgOnceki=undefined;durum('Liste silindi.')}catch(e){durum(e.message)}finally{ISLEM=false}
    yenidenCiz();return;
  }
  if(el.id==='tgSilHepsi'){
    if(!confirm('Kayıtlı bütün Türkiye geneli listeleri silinsin mi? PDF’leri yeniden ekleyebilirsiniz.'))return;
    ISLEM=true;try{await sil();EK.tgSimdi=EK.tgDers=undefined;durum('Türkiye geneli listeleri silindi.')}catch(e){durum(e.message)}finally{ISLEM=false}
    yenidenCiz();
  }
});
document.addEventListener('change',async ev=>{
  if(!etkin())return;const el=ev.target;
  if(el.id==='tgPdf'){
    const files=Array.from(el.files||[]);el.value='';if(!files.length||ISLEM)return;
    if(files.length>10){durum('Bir defada en fazla 10 PDF seçin.');return}
    ISLEM=true;try{durum(await pdfEkle(files))}catch(e){durum('PDF eklenemedi: '+e.message)}finally{ISLEM=false}
    yenidenCiz();return;
  }
  if(el.id==='tgOkul'){
    const ad=el.value;EK.tgDers=undefined;
    if(izleme()){EK.tgOkul=ad||undefined;yenidenCiz('#tgOkul');return}
    if(ISLEM)return;ISLEM=true;try{await okulKaydet(ad);EK.tgOkul=undefined;durum(ad?'Okul: '+okulAdi(ad)+'.':'')}catch(e){durum(e.message)}finally{ISLEM=false}
    yenidenCiz('#tgOkul');return;
  }
  if(el.id==='tgSimdi'){EK.tgSimdi=el.value;yenidenCiz('#tgSimdi');return}
  if(el.id==='tgOnceki'){EK.tgOnceki=el.value;yenidenCiz('#tgOnceki');return}
  if(el.dataset.tgSinif){
    if(ISLEM||izleme())return;const id=el.dataset.tgSinif,d=el.value===''?null:Number(el.value);
    ISLEM=true;try{await duzeyKaydet(id,d);durum('Sınıf kaydedildi.')}catch(e){durum(e.message)}finally{ISLEM=false}
    yenidenCiz('[data-tg-sinif="'+id+'"]');
  }
});
function imlecGoster(ev){
  if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-tg-grafik]');if(!kutu)return;
  if(ev.pointerType!=='touch')seriVurgula(kutu,enYakinSeri(kutu,ev.clientX,ev.clientY));
  ipucuGoster(kutu,enYakin(kutu,ev.clientX));
}
document.addEventListener('pointermove',imlecGoster);
document.addEventListener('pointerdown',imlecGoster);
document.addEventListener('pointerout',ev=>{if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-tg-grafik]');if(kutu&&!kutu.contains(ev.relatedTarget)&&document.activeElement!==kutu)ipucuGizle(kutu)});
document.addEventListener('keydown',ev=>{
  if(!etkin())return;const kutu=ev.target.closest?.('.et-grafik[data-tg-grafik]');if(!kutu||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Escape','Enter'].includes(ev.key))return;
  const g=CIZIMLER.get(kutu.dataset.tgGrafik);if(!g)return;ev.preventDefault();
  if(ev.key==='Escape'){ipucuGizle(kutu);return}
  const i=kutu.dataset.i===undefined?g.xs.length-1:Number(kutu.dataset.i);
  // ↑/↓ walk the subjects' lines; Enter opens the highlighted one.
  if(ev.key==='Enter'){if(g.seriler&&kutu.dataset.seri!==undefined)dersSec(g.seriler[Number(kutu.dataset.seri)].kod);return}
  if(ev.key==='ArrowUp'||ev.key==='ArrowDown'){if(!g.seriler)return;const n=g.seriler.length,k=kutu.dataset.seri===undefined?(ev.key==='ArrowDown'?-1:n):Number(kutu.dataset.seri);
    seriVurgula(kutu,((k+(ev.key==='ArrowDown'?1:-1))%n+n)%n);ipucuGoster(kutu,i);return}
  ipucuGoster(kutu,ev.key==='Home'?0:ev.key==='End'?g.xs.length-1:Math.max(0,Math.min(g.xs.length-1,i+(ev.key==='ArrowLeft'?-1:1))));
});
document.addEventListener('focusout',ev=>{const kutu=ev.target.closest?.('.et-grafik[data-tg-grafik]');if(kutu&&etkin())ipucuGizle(kutu)});
return {ortalamalar,grafikToplam,pdfCoz,listeTuru,dersBilgi,sinifDuzeyi,adDuzeyi,okulAdi,kisaAdlar,dogrula,oku,ac,paketle,birlestir,raporEkle,okulKaydet,duzeyKaydet,sinavSil,sil,model,durumAl,
  grafikSira,grafikNet,grafikT,grafikTSira,grafikTArtis,grafikBirlesik,artisT,artisSeri,tHaritasi,okulSatirlari,grafikleriCiz,icerik,normTers,normCdf,siraUydur,toplamKorelasyon,duzeltilmisR,ciftKorelasyon,sdAl,dagilimAl,tPuani,tahminiSira,toplamSigma,olcuT,ESIK_UYUM,TOPLAM_KORELASYON,gorunum,CIZIMLER,UST_SINIR,EN_COK_SINAV,DERSLER};
})();
function gorunumTurkiye(){return TURKIYE.gorunum()}
