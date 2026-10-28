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
const MODLAR=[['artis','Artış'],['sira','Sıra']];
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
  if(bayt>UST_SINIR)throw new Error('Türkiye geneli verisi '+Math.round(UST_SINIR/1000)+' KB sınırını aşıyor; Denemeler tablosundan eski listeleri silin.');
  const eski=D.turkiye,geri=()=>{if(eski===undefined)delete D.turkiye;else D.turkiye=eski};
  if(veri)D.turkiye=veri;else delete D.turkiye;
  // The lists ride in the teacher's cloud backup; they must not push it over its limit.
  if(veri&&baytBoyu(JSON.stringify(D))>BULUT_YEDEK_UST_SINIR&&bayt>(eski===undefined?0:baytBoyu(JSON.stringify(eski)))){geri();throw new Error('Bu liste defteri bulut yedeği sınırının üstüne çıkarır.')}
  if(!await kaydet(true)){geri();throw new Error('Cihaza kaydedilemedi; Türkiye geneli verisi değişmedi.')}
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
function noktaAl(d,okulK){
  const n=d.satir.length,k=okulK?d.satir.findIndex(r=>anahtar(r.ad)===okulK):-1,r=k>=0?d.satir[k]:null;
  let esit=null;if(r){const a=d.satir.filter(q=>Math.abs(q.net-r.net)<1e-9).map(q=>q.sira);if(a.length>1)esit=[Math.min(...a),Math.max(...a)]}
  // Its place with one more net: after every school with a higher net than that.
  const birNet=r&&k>0?d.satir.filter(q=>q.net>r.net+1+1e-9).length+1:null;
  return {soru:d.soru,genel:d.genel,n,ilk:d.satir[0],son:d.satir[n-1],satir:d.satir,k,sira:r?r.sira:null,net:r?r.net:null,esit,birNet};
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
  let onceki=sinavlar.findIndex(s=>s.id===sec.onceki);if(onceki<0||onceki>=simdi)onceki=simdi>0?(sec.mod==='artis'?0:simdi-1):null;
  const kodlar=new Map();
  for(const s of sinavlar)for(const d of s.dersler){const b=dersBilgi(d.kod),k=anahtar(d.kod);if(b.oturum===oturum&&!kodlar.has(k))kodlar.set(k,{kod:d.kod,...b})}
  const dersler=[...kodlar.values()].sort((a,b)=>a.sira-b.sira||a.ad.localeCompare(b.ad,'tr')).map((b,i)=>{
    const seri=sinavlar.map(s=>{const d=s.dersler.find(x=>anahtar(x.kod)===anahtar(b.kod));return d?noktaAl(d,okulK):null});
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
  const dersK=new Set(dersler.map(d=>anahtar(d.kod)));
  const toplamlar=(TOPLAMLAR[oturum]||[]).map(([key,ad,l])=>({key,ad,kodlar:l?l.map(anahtar):[...dersK]})).filter(t=>t.kodlar.length&&t.kodlar.every(k=>dersK.has(k)));
  const toplam=toplamlar.find(t=>t.key===sec.toplam)||toplamlar[0]||null;
  if(toplam){toplam.seri=sinavlar.map((_,i)=>({okul:okulK?deger(i,toplam.kodlar,okulK):null,genel:deger(i,toplam.kodlar,null)}));toplam.artis=artisAl(toplam.kodlar)}
  return {tum,listeler,liste,ana,duzeyler,duzey,sinavlar,oturumlar,oturum,okullar,okul,okulKaynak,simdi,onceki,dersler,N,ozet,toplamlar,toplam};
}
function durumAl(v){
  const m=model(v,{liste:EK.tgListe,duzey:EK.tgDuzey,oturum:EK.tgOturum,simdi:EK.tgSimdi,onceki:EK.tgOnceki,toplam:EK.tgToplam,okul:EK.tgOkul,mod:EK.tgMod==='sira'?'sira':'artis'});
  const odak=EK.tgDers&&m.okul?m.dersler.find(d=>anahtar(d.kod)===anahtar(EK.tgDers))||null:null;
  return {m,odak,mod:EK.tgMod==='sira'?'sira':'artis'};
}
// Places moved from the önceki exam to the şimdiki one (a school outside the list counts as N + 1).
function siraFarki(d,m){
  const p=d.seri[m.simdi],q=m.onceki===null?null:d.seri[m.onceki];
  if(!p||!q||p.sira===null&&q.sira===null)return null;
  return yer(q)-yer(p);
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
const GRAFIKLER={sira:grafikSira,net:grafikNet,toplam:grafikToplam};
let ZAMAN=null;
const etkin=()=>EK.sekme==='turkiye'&&rehberMi()&&!!document.getElementById?.('tgKok');
function grafikleriCiz(){
  if(!etkin())return;const {veri}=oku();if(!veri)return;const st=durumAl(veri);
  document.querySelectorAll('.et-grafik[data-tg-grafik]').forEach(kutu=>{
    const W=Math.round(kutu.clientWidth);if(W<120)return;
    const imza=[W,veri.ts,st.m.liste,st.m.duzey,st.m.oturum,st.m.simdi,st.m.onceki,st.m.toplam&&st.m.toplam.key,st.mod,st.m.okul,st.odak&&st.odak.kod,GRAFIK_CIZGI.tur()].join('|');if(kutu.dataset.imza===imza)return;
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
  const ikili=m.sinavlar.length>1?'<div class="tg-ikili">'+liste_('tgOnceki',st.mod==='artis'?'İlk deneme':'Önceki',m.sinavlar.map((s,i)=>[s,i]).slice(0,m.simdi),m.onceki)+'<span class="tg-ok" aria-hidden="true">→</span>'+
    liste_('tgSimdi',st.mod==='artis'?'Son deneme':'Şimdiki',m.sinavlar.map((s,i)=>[s,i]).slice(1),m.simdi)+'</div>':'';
  return '<div class="et-arac">'+ekle+secim('mod',st.mod,MODLAR,'Görünüm')+okul+ikili+
    (m.listeler.length>1?secim('liste',m.liste,m.listeler.map(l=>[l,LISTE_ADI[l]]),'Liste'):'')+
    (m.duzeyler.length>1?secim('duzey',m.duzey,m.duzeyler.map(k=>[k,grupAdi(k)]),'Sınıf'):'')+
    secim('oturum',m.oturum,OTURUMLAR.map(o=>[o,o,!m.oturumlar.includes(o)]),'Oturum')+
    (st.mod==='artis'&&m.toplamlar.length>1?secim('toplam',m.toplam.key,m.toplamlar.map(t=>[t.key,t.key]),'Toplam'):'')+
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
  // Exams differ in difficulty, so the increase is read against the Türkiye average's.
  return bas+okul+' · '+kacis(O.ad)+': Türkiye’ye göre '+(a.adim>1?'toplam ':'')+b(isaret(a.goreli,f2)+' net')+(a.adim>1&&a.goreliOrt!==null?', deneme başına '+b(isaret(a.goreliOrt,f2)+' net'):'')+' (okul '+f2(a.once)+' → '+f2(a.simdi)+', '+artisOk(a.fark)+'; Türkiye ortalaması '+artisOk(a.genelFark)+
    '). Artış sırası '+b(fi(a.biz.sira)+'.')+' / '+fi(a.satir.length)+' kurum.';
}
// A subject's increase over the Türkiye average's, in success points (net ÷ questions), so subjects compare.
const goreliPuan=d=>d.artis&&d.artis.goreli!==null?d.artis.goreli/d.soru*100:null;
function ozetArtis(st){
  const m=st.m,T=m.toplam,a=T&&T.artis;
  const kart=(baslik,buyuk,alt)=>'<div class="et-ozet-kart"><span class="mini">'+baslik+'</span><strong>'+buyuk+'</strong><div class="et-ozet-alt">'+alt+'</div></div>';
  const l=m.dersler.filter(d=>goreliPuan(d)!==null).sort((x,y)=>goreliPuan(y)-goreliPuan(x)),en=l[0]&&goreliPuan(l[0])>0?l[0]:null,az=l.length&&goreliPuan(l[l.length-1])<0?l[l.length-1]:null;
  const dersYazi=d=>hap(d.artis.goreli,f2(Math.abs(d.artis.goreli))+' TR’ye göre')+'<span class="mini">okul '+artisOk(d.artis.fark)+' · TR '+artisOk(d.artis.genelFark)+'</span>';
  return '<div class="et-ozet">'+
    (a&&a.fark!==null?kart(kacis(T.ad)+' · Türkiye’ye göre artış',isaret(a.goreli,f2),hap(a.goreli,a.goreli>0?'TR’den çok arttı':a.goreli<0?'TR’den az arttı':'TR kadar'))+
      (a.adim>1&&a.goreliOrt!==null?kart('Deneme başına ortalama',isaret(a.goreliOrt,f2),'<span class="mini">'+fi(a.adim)+' adımda · okul '+artisOk(a.ort)+' · TR '+artisOk(a.genelOrt)+'</span>'):'')+
      kart('Artış sırası',fi(a.biz.sira)+'.','<span class="mini">'+fi(a.satir.length)+' kurum içinde</span>')+
      kart(kacis(T.ad)+' neti',artisOk(a.fark),'<span class="mini">'+f2(a.once)+' → '+f2(a.simdi)+' · TR '+artisOk(a.genelFark)+'</span>'):'')+
    kart('Türkiye’den çok artan',fi(l.filter(d=>goreliPuan(d)>0).length)+'<span class="tg-bolu"> / '+fi(l.length)+'</span>','<span class="mini">ders</span>')+
    (en?kart('En çok artan',kacis(en.ad),dersYazi(en)):'')+(az?kart('En çok geride kalan',kacis(az.ad),dersYazi(az)):'')+'</div>';
}
function toplamPaneli(st){
  const m=st.m,T=m.toplam;
  return '<section class="et-panel"><div class="et-kart-bas"><h2>'+kacis('Net · '+T.ad)+'</h2>'+
    lejant([['var(--e-c1)',okulAdi(m.okul)],['var(--e-fg2)','Türkiye ortalaması','cizgi tg-renk-kesik']])+'</div>'+
    '<div class="et-grafik orta" data-tg-grafik="toplam" tabindex="0" role="img" aria-label="'+kacis('Net · '+T.ad)+', deneme deneme"></div></section>';
}
// Denemeler arası artış: each step between neighbouring exams of the run, then the total (first exam against
// the last) and the average per step, for the measure on show.
function adimlarPaneli(st){
  const m=st.m,O=olcuAl(st),a=O&&O.artis;if(!a||!a.adimlar.length)return '';
  const c=v=>v===null?'—':artisOk(v),g=v=>v===null?'—':isaret(v,f2),yonlu=v=>v===null?'':v>0?' et-yukari':v<0?' et-asagi':'';
  const hucre=(f,gf,gl)=>'<td class="sayi'+yonlu(f)+'">'+c(f)+'</td><td class="sayi et-dar-gizle">'+c(gf)+'</td><td class="sayi'+yonlu(gl)+'">'+g(gl)+'</td>';
  const satir=a.adimlar.map(s=>'<tr><td class="tg-ad">'+kacis(s.onceki)+' → '+kacis(s.ad)+'</td><td class="sayi et-dar-gizle">'+(s.once===null?'—':f2(s.once))+' → '+(s.simdi===null?'—':f2(s.simdi))+'</td>'+hucre(s.fark,s.genelFark,s.goreli)+'</tr>').join('');
  const alt='<tr class="tg-toplam"><td class="tg-ad">Toplam</td><td class="sayi et-dar-gizle">'+(a.once===null?'—':f2(a.once))+' → '+(a.simdi===null?'—':f2(a.simdi))+'</td>'+hucre(a.fark,a.genelFark,a.goreli)+'</tr>'+
    (a.adim>1?'<tr class="tg-toplam"><td class="tg-ad">Deneme başına ortalama</td><td class="sayi et-dar-gizle"></td>'+hucre(a.ort,a.genelOrt,a.goreliOrt)+'</tr>':'');
  const bos=a.adimlar.some(s=>s.fark===null);
  return '<section class="et-panel" id="tgAdimlar"><div class="et-kart-bas"><h2>'+kacis('Denemeler arası artış · '+O.ad)+'</h2><span class="mini">'+ciftAdi(m)+'</span></div><div class="et-tablo-kutu"><table class="et-tablo tg-tablo"><thead><tr>'+
    ['Denemeler','Okul neti','Okul artışı','TR artışı','TR’ye göre'].map((x,i)=>'<th class="'+(i===0?'':'sayi')+(i===1||i===3?' et-dar-gizle':'')+'">'+x+'</th>').join('')+'</tr></thead><tbody>'+satir+alt+'</tbody></table></div>'+
    (bos?'<p class="mini">Okul bir denemede listede yoksa net basılmaz; o adım boş kalır. Toplam ve ortalama ilk ve son denemeden hesaplanır.</p>':'')+'</section>';
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
  const sutun=[['Ders'],['İlk','sayi et-dar-gizle'],['Son','sayi et-dar-gizle'],['Toplam artış','sayi'],['TR artışı','sayi et-dar-gizle'],['TR’ye göre','sayi'],['Deneme başına','sayi et-dar-gizle'],['Artış sırası','sayi'],['Sıra','sayi et-dar-gizle']];
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
  const ust='<header class="et-bas">'+baslik+'<p class="et-cumle">'+(st.mod==='artis'?cumleArtis(st):cumle(st))+'</p></header>'+arac(st,salt)+durumSatiri+digerleri(st);
  if(!m.okul)return ust+'<section class="et-panel et-bos tg-okul-sec"><b>Okulunuzu seçin</b><p>Üstteki “Okul” listesinden okulunuzu seçin.</p></section>'+kaynaklar(veri,st,salt);
  if(!m.ozet[m.simdi])return ust+'<section class="et-panel et-bos"><b>Bu denemede '+kacis(m.oturum||'')+' dersi yok</b></section>'+kaynaklar(veri,st,salt);
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
  yenidenCiz();document.getElementById('tgSiraPanel')?.scrollIntoView({block:'nearest',behavior:'smooth'});
}
document.addEventListener('click',async ev=>{
  if(!etkin())return;
  const grafik=ev.target.closest?.('.et-grafik[data-tg-grafik="sira"]');
  if(grafik&&grafik.dataset.seri!==undefined){const g=CIZIMLER.get('sira'),s=g&&g.seriler&&g.seriler[Number(grafik.dataset.seri)];if(s){dersSec(s.kod);return}}
  const el=ev.target.closest?.('[data-tg-mod],[data-tg-toplam],[data-tg-liste],[data-tg-duzey],[data-tg-oturum],[data-tg-cizgi],[data-tg-ders],[data-tg-git],[data-tg-sil],#tgSilHepsi');if(!el||el.disabled)return;
  if(el.dataset.tgMod){EK.tgMod=el.dataset.tgMod;yenidenCiz('[data-tg-mod="'+EK.tgMod+'"]');return}
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
return {grafikToplam,pdfCoz,listeTuru,dersBilgi,sinifDuzeyi,adDuzeyi,okulAdi,kisaAdlar,dogrula,oku,ac,paketle,birlestir,raporEkle,okulKaydet,duzeyKaydet,sinavSil,sil,model,durumAl,
  grafikSira,grafikNet,grafikleriCiz,icerik,gorunum,CIZIMLER,UST_SINIR,EN_COK_SINAV,DERSLER};
})();
function gorunumTurkiye(){return TURKIYE.gorunum()}
