// Synthetic only: "SENTETİK ÖĞRENCİ n", made-up numbers and made-up booklet text. No real file is copied here.
// One tiny exam: TÜR test (4 questions) and SOS test (6 questions: Tarih 1-2, Din 3-4, S.Felsefe 5-6), page size like the real booklets.
const F=require('./konutakibi-fixtures.cjs');
const W=609.449,H=870.236;
const SENTETIK_TC=['12345678901','10987654321','11111111111'];

/* ---- booklet A: pages as drawing instructions, usable as pdf.js-like items and as a real PDF ---- */
const Lx=42.5,Rx=319,TOP=776;
function soru(x,y,no,satirlar,figur){
  const t=[[x,y,no+'.',9]],r=[];
  satirlar.forEach((s,i)=>t.push([x+19.9,y-12*i,s,9]));
  const bit=y-12*satirlar.length-8;
  ['A)','B)','C)','D)','E)'].forEach((o,i)=>{t.push([x+19.9,bit-14*i,o+' Secenek '+no+o[0],9])});
  if(figur)r.push([x+19.9,bit-14*5-figur,150,figur]);
  return {t,r};
}
function sayfa(kod,no,parts,ekstra=[]){
  const t=[[123,808.9,kod,9],[300,51,String(no),9],[498,52,'Diger sayfaya geciniz.',7]],r=[];
  for(const p of parts){t.push(...(p.t||[]));r.push(...(p.r||[]))}
  for(const e of ekstra){t.push(...(e.t||[]));r.push(...(e.r||[]))}
  return {texts:t,rects:r,w:W,h:H};
}
function kitapcikSpec(){
  const TUR='2026-27-TYT/TUR-1203',SOS='2026-27-TYT/SOS-1203';
  const kapak={texts:[[259,785,'YUKSEKOGRETIM KURUMLARI SINAVI',9],[44,270,'1.',9],[62,270,'Adayin dikkatine',9]],rects:[],w:W,h:H};
  // false numbers inside a question: a table with "1." labels away from the column edge, and a line "1. sira"
  const yanlisNo=[[114,697,'1.',9],[138,697,'2.',9],[163,697,'3.',9],[200,697,'1. sira',9]];
  const p2=sayfa(TUR,2,[
    {t:[[268,808,'TURKCE TESTI',10],[46.5,773,'1. Bu testte 4 soru vardir.',9],[46.5,756,'2. Cevaplarinizi isaretleyiniz.',9]]},
    soru(Lx,719,1,['Sentetik Turkce sorusu bir','ikinci satir'],0),{t:yanlisNo},
    soru(Rx,719,2,['Sentetik Turkce sorusu iki'],40)]);
  const p3=sayfa(TUR,3,[soru(Lx,TOP,3,['Sentetik Turkce sorusu uc']),soru(Rx,TOP,4,['Sentetik Turkce sorusu dort'])],[{t:[[484,57,'TURKCE TESTI BITTI.',9]]}]);
  const p4=sayfa(SOS,4,[
    {t:[[244,808,'SOSYAL BILIMLER TESTI',10],[47,773,'1. Bu testte sirasiyla, Tarih (1-2), Din (3-4), Felsefe (5-6) alanlarina ait toplam 6 soru vardir.',9]]},
    soru(Lx,719,1,['Sentetik tarih sorusu bir']),soru(Rx,719,2,['Sentetik tarih sorusu iki'])]);
  const p5=sayfa(SOS,5,[soru(Lx,TOP,3,['Sentetik din sorusu uc']),soru(Rx,TOP,4,['Sentetik din sorusu dort'])]);
  // shared passage for 5 - 6: a notice and text on top of the left column, question 5 below it, question 6 in the right column
  const p6=sayfa(SOS,6,[
    {t:[[71,768,'5 - 6. sorulari asagidaki parcaya gore',9],[71,756,'cevaplayiniz.',9],[62,728,'Ortak sentetik parca birinci satir',9],[62,716,'Ortak sentetik parca ikinci satir',9]],r:[[58,750,230,26]]},
    soru(Lx,560,5,['Sentetik felsefe sorusu bbes']),soru(Rx,TOP,6,['Sentetik felsefe sorusu alti'])]);
  return [kapak,p2,p3,p4,p5,p6];
}
const itemlere=spec=>spec.map(p=>({w:p.w,h:p.h,items:p.texts.map(([x,y,s,z])=>({s,x,y,w:s.length*z*.5,h:z}))}));
const kitapcikSayfalari=()=>itemlere(kitapcikSpec());

/* ---- a real (tiny) PDF written by hand: Helvetica text and rectangles ---- */
function pdfYaz(sayfalar){
  const esc=s=>String(s).replace(/[\\()]/g,m=>'\\'+m),objs=[];
  const n=sayfalar.length,add=x=>{objs.push(x);return objs.length};
  add('<< /Type /Catalog /Pages 2 0 R >>');add('<< /Type /Pages /Kids ['+sayfalar.map((_,i)=>(4+2*i)+' 0 R').join(' ')+'] /Count '+n+' >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  sayfalar.forEach(p=>{
    const body=p.rects.map(([x,y,w,h])=>x+' '+y+' '+w+' '+h+' re S').join('\n')+'\n'+p.texts.map(([x,y,s,z])=>'BT /F1 '+z+' Tf '+x+' '+y+' Td ('+esc(s)+') Tj ET').join('\n');
    add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+p.w+' '+p.h+'] /Resources << /Font << /F1 3 0 R >> >> /Contents '+(objs.length+2)+' 0 R >>');
    add('<< /Length '+Buffer.byteLength(body,'latin1')+' >>\nstream\n'+body+'\nendstream');
  });
  let out='%PDF-1.4\n';const off=[];
  objs.forEach((o,i)=>{off.push(Buffer.byteLength(out,'latin1'));out+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});
  const xref=Buffer.byteLength(out,'latin1');
  out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'+off.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  return Buffer.from(out,'latin1');
}

/* ---- cevap raporu .xlsx (with a TC column, as the real file has) ---- */
const SECTIONS=[['TÜRKÇE-T',4],['TARİH-T',2],['DİN KÜLTÜRÜ-T',2],['S.FELSEFE-T',2]];
const KEY_A=['A','B','C','D','A','B','C','D','E','A'],KEY_B=['B','D','A','C','B','A','D','C','A','E'];
// answers in the order of the student's own booklet
const OGRENCILER=[
 {no:'9001',ad:'SENTETİK ÖĞRENCİ 1',sube:'205 12/A',kit:'A',cev:['A','C','','D','A','B','C','','','']},
 {no:'9002',ad:'SENTETİK ÖĞRENCİ 2',sube:'205 12/A',kit:'B',cev:['B','D','A','','B','','','','A','A']},
 {no:'9003',ad:'SENTETİK ÖĞRENCİ 3',sube:'205 12/B',kit:'A',cev:KEY_A.slice()}];
function raporSatirlari({tcBaslik='TC Kimlik No',ogrenciler=OGRENCILER,anahtarA=KEY_A,anahtarB=KEY_B,bolumler=SECTIONS,sinav='SENTETİK-1203'}={}){
  const T=bolumler.reduce((a,[,k])=>a+k,0),pad=(a,n=10+T)=>{const o=a.slice();while(o.length<n)o.push('');return o};
  const sec=Array(10+T).fill('');sec[6]='Toplam';let c=10;for(const [ad,k] of bolumler){sec[c]=ad;c+=k}
  const bas=['Sıra','Öğrenci No','Ad Soyad',tcBaslik,'Şube','Kitapçık','D','Y','B','Net'];for(const [,k] of bolumler)for(let i=1;i<=k;i++)bas.push('S'+i);
  return [['SINAV CEVAP RAPORU'],['Rapor Tarihi: 01.01.2000   |   Sinav: '+sinav+'   |   Form: TYT'],[],sec,bas,
    pad(['','','Cevap Anahtarı - A','','','A','','','','',...anahtarA]),pad(['','','Cevap Anahtarı - B','','','B','','','','',...anahtarB]),
    ...ogrenciler.map((o,i)=>pad([String(i+1),o.no,o.ad,SENTETIK_TC[i%3],o.sube,o.kit,'1','1','0','0.5',...o.cev]))];
}
const raporXlsx=(o={})=>F.xlsx({sheetName:'TYT',shared:o.shared??true,method:o.method??0,rows:raporSatirlari(o)});

/* ---- çözüm kitapçığı: "A-n / B-m" labels in two columns ---- */
const HARITA=[[1,3],[2,1],[3,4],[4,2],[1,2],[2,1],[3,4],[4,3],[5,6],[6,5]];
function cozumSpec(pairs=HARITA,perPage=5){
  const sp=[];
  for(let i=0;i<pairs.length;i+=perPage){
    const t=[[188,730,'1203 TYT COZUMLERI',10]];
    pairs.slice(i,i+perPage).forEach(([a,b],k)=>{const sol=k<Math.ceil(perPage/2),y=696-(k%Math.ceil(perPage/2))*120;t.push([sol?37:298,y,'A-'+a+' / B-'+b,9],[sol?54:315,y-16,'Sentetik cozum metni '+a,9])});
    sp.push({texts:t,rects:[],w:567,h:808});
  }
  return sp;
}
/* ---- AYT session: a second booklet (header 2026-27-AYT/EDB-1203) and the AYT sheet of the same workbook ---- */
function kitapcikSpecAyt(sinav='1203'){
  const EDB='2026-27-AYT/EDB-'+sinav,MAT='2026-27-AYT/MAT-'+sinav;
  const kapak={texts:[[259,785,'YUKSEKOGRETIM KURUMLARI SINAVI',9],[44,270,'1.',9],[62,270,'Adayin dikkatine',9]],rects:[],w:W,h:H};
  const p2=sayfa(EDB,2,[{t:[[200,808,'EDEBIYAT TESTI',10],[46.5,773,'1. Bu testte 5 soru vardir.',9]]},soru(Lx,719,1,['Sentetik edebiyat sorusu bir']),soru(Rx,719,2,['Sentetik edebiyat sorusu iki'])]);
  const p3=sayfa(EDB,3,[soru(Lx,TOP,3,['Sentetik edebiyat sorusu uc']),soru(Rx,TOP,4,['Sentetik edebiyat sorusu dort'])]);
  const p4=sayfa(EDB,4,[soru(Lx,TOP,5,['Sentetik tarih sorusu bes'])]);
  const p5=sayfa(MAT,5,[{t:[[200,808,'MATEMATIK TESTI',10],[46.5,773,'1. Bu testte 3 soru vardir.',9]]},soru(Lx,719,1,['Sentetik matematik sorusu bir']),soru(Rx,719,2,['Sentetik matematik sorusu iki'])]);
  const p6=sayfa(MAT,6,[soru(Lx,TOP,3,['Sentetik matematik sorusu uc'])]);
  return [kapak,p2,p3,p4,p5,p6];
}
const kitapcikSayfalariAyt=sinav=>itemlere(kitapcikSpecAyt(sinav));
const AYT_SECTIONS=[['TÜRK DİLİ VE EDB-A',3],['TARİH.1-A',2],['MATEMATİK-A',3]];
const AYT_KEY_A=['A','B','C','D','E','A','B','C'],AYT_KEY_B=['C','A','B','E','D','B','C','A'];
const AYT_HARITA=[[1,2],[2,3],[3,1],[4,5],[5,4],[1,3],[2,1],[3,2]];
// AYT answers in the order of the student's own booklet; 9004 sat only the AYT.
const AYT_OGRENCILER=[
 {no:'9001',ad:'SENTETİK ÖĞRENCİ 1',sube:'205 12/A',kit:'A',cev:['A','C','','D','','A','B','']},
 {no:'9002',ad:'SENTETİK ÖĞRENCİ 2',sube:'205 12/A',kit:'B',cev:['C','','B','','D','B','A','A']},
 {no:'9003',ad:'SENTETİK ÖĞRENCİ 3',sube:'205 12/B',kit:'A',cev:AYT_KEY_A.slice()},
 {no:'9004',ad:'SENTETİK ÖĞRENCİ 4',sube:'205 12/B',kit:'A',cev:['E','B','C','A','E','A','','C']}];
function raporSatirlariAyt({ogrenciler=AYT_OGRENCILER,anahtarA=AYT_KEY_A,anahtarB=AYT_KEY_B,sinav='SENTETİK-1203'}={}){
  const pad=(a,n=18)=>{const o=a.slice();while(o.length<n)o.push('');return o};
  const sec=Array(18).fill('');sec[6]='Toplam';let c=10;for(const [ad,k] of AYT_SECTIONS){sec[c]=ad;c+=k}
  const bas=['Sıra','Öğrenci No','Ad Soyad','TC Kimlik No','Şube','Kitapçık','D','Y','B','Net'];for(const [,k] of AYT_SECTIONS)for(let i=1;i<=k;i++)bas.push('S'+i);
  return [['SINAV CEVAP RAPORU'],['Rapor Tarihi: 01.01.2000   |   Sinav: '+sinav+'   |   Form: AYT'],[],sec,bas,
    pad(['','','Cevap Anahtarı - A','','','A','','','','',...anahtarA]),pad(['','','Cevap Anahtarı - B','','','B','','','','',...anahtarB]),
    ...ogrenciler.map((o,i)=>pad([String(i+1),o.no,o.ad,SENTETIK_TC[i%3],o.sube,o.kit,'1','1','0','0.5',...o.cev]))];
}
// One workbook with several sheets. sayfalar: [{ad, rows, shared}]; shared strings of the sheets that ask for them live in one part, the others are inline.
const kolon=i=>{let s='';for(i++;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};
function cokSayfaXlsx(sayfalar,{method=8}={}){
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),sst=[],idx=new Map();
  const files=[{name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',method}];
  const sheets=sayfalar.map((sy,n)=>{
    const cell=(r,c,v)=>{
      if(v===''||v===null||v===undefined)return '';
      const ref=kolon(c)+(r+1);
      if(sy.shared){if(!idx.has(v)){idx.set(v,sst.length);sst.push(v)}return '<c r="'+ref+'" t="s"><v>'+idx.get(v)+'</v></c>'}
      return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+esc(v)+'</t></is></c>';
    };
    files.push({name:'xl/worksheets/sheet'+(n+1)+'.xml',data:'<?xml version="1.0" encoding="UTF-8"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+sy.rows.map((row,r)=>'<row r="'+(r+1)+'">'+row.map((v,c)=>cell(r,c,v)).join('')+'</row>').join('')+'</sheetData></worksheet>',method});
    return '<sheet name="'+esc(sy.ad)+'" sheetId="'+(n+1)+'" r:id="rId'+(n+3)+'"/>';
  });
  files.push({name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.join('')+'</sheets></workbook>',method});
  files.push({name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sayfalar.map((_,n)=>'<Relationship Id="rId'+(n+3)+'" Target="worksheets/sheet'+(n+1)+'.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>').join('')+'</Relationships>',method});
  if(sst.length)files.push({name:'xl/sharedStrings.xml',data:'<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'+sst.length+'" uniqueCount="'+sst.length+'">'+sst.map(t=>'<si><t xml:space="preserve">'+esc(t)+'</t></si>').join('')+'</sst>',method});
  return F.zip(files);
}
// The real workbook: sheet "TYT" and sheet "AYT" (the AYT sheet with inline strings, t="inlineStr").
const raporXlsx2=(o={})=>cokSayfaXlsx([{ad:'TYT',rows:raporSatirlari(o),shared:o.shared??true},{ad:'AYT',rows:raporSatirlariAyt(o.ayt||{}),shared:false}],{method:o.method??8});

/* ---- a larger one-session exam for statistics: tests of N questions each, two questions per half page column ---- */
function kitapcikSpecBuyuk(testler=[['TUR',20],['MAT',20]],sinav='1203',oturum='TYT'){
  const sp=[{texts:[[259,785,'YUKSEKOGRETIM KURUMLARI SINAVI',9],[44,270,'1.',9],[62,270,'Adayin dikkatine',9]],rects:[],w:W,h:H}];let sayfaNo=2;
  for(const [kod,N] of testler){
    const KODU='2026-27-'+oturum+'/'+kod+'-'+sinav,ilk=[719,590,461,332,203],sonra=[776,647,518,389,260];
    for(let q=1,p=0;q<=N;p++){
      const y=p===0?ilk:sonra,parts=p===0?[{t:[[200,808,kod+' TESTI',10],[46.5,773,'1. Bu testte '+N+' soru vardir.',9]]}]:[];
      for(const x of [Lx,Rx])for(let k=0;k<5&&q<=N;k++,q++)parts.push(soru(x,y[k],q,['Sentetik '+kod+' sorusu '+q]));
      sp.push(sayfa(KODU,sayfaNo++,parts));
    }
  }
  return sp;
}

/* ---- statistics fixtures: a seeded Rasch simulation of one TYT exam (two tests of 20 questions, a third of the students on booklet B) ---- */
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const normal=r=>()=>Math.sqrt(-2*Math.log(r()+1e-12))*Math.cos(2*Math.PI*r());
const sig=z=>1/(1+Math.exp(-z));
const BUYUK_BOLUMLER=[['TÜRKÇE-T',20],['MATEMATİK-T',20]];
const HARF='ABCDE';
function simule({N=60,seed=4242,bolumN=[20,20]}={}){
  const r=rng(seed),nrm=normal(r),keyA=[],keyB=[],bTrue=[],pairs=[];
  const perm=bolumN.map(n=>{const p=Array.from({length:n},(_,i)=>i+1);for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[p[i],p[j]]=[p[j],p[i]]}return p});  // perm[t][a-1] = b
  bolumN.forEach((n,t)=>{
    const ka=Array.from({length:n},()=>HARF[Math.floor(r()*5)]),kb=Array(n);
    for(let a=1;a<=n;a++){kb[perm[t][a-1]-1]=ka[a-1];pairs.push([a,perm[t][a-1]])}
    keyA.push(...ka);keyB.push(...kb);
    for(let a=0;a<n;a++)bTrue.push(-2.4+4.8*((a*7+t*3)%n)/(n-1));
  });
  const ogr=Array.from({length:N},(_,i)=>{
    const th=nrm(),kit=i%3===2?'B':'A',cev=[];
    bolumN.forEach((n,t)=>{
      const off=bolumN.slice(0,t).reduce((x,y)=>x+y,0),own=Array(n).fill('');
      for(let a=0;a<n;a++){
        const b=kit==='A'?a:perm[t][a]-1,key=(kit==='A'?keyA:keyB)[off+b],dogru=r()<sig(th-bTrue[off+a]);
        own[b]=dogru?key:r()<0.25?'':HARF.replace(key,'')[Math.floor(r()*4)];
      }
      cev.push(...own);
    });
    return {no:String(9300+i),ad:'SENTETİK ÖĞRENCİ '+(i+1),sube:i%2?'205 12/B':'205 12/A',kit,cev};
  });
  return {ogr,keyA,keyB,bTrue,pairs,bolumN,perm};
}
// The big exam as a workbook (sheet TYT), optionally with the small AYT sheet whose student 9302 also sat the TYT (booklet B in both).
function raporBuyuk(sim,{ayt=true}={}){
  const sayfalar=[{ad:'TYT',rows:raporSatirlari({ogrenciler:sim.ogr,anahtarA:sim.keyA,anahtarB:sim.keyB,bolumler:BUYUK_BOLUMLER}),shared:true}];
  if(ayt){const o=AYT_OGRENCILER.map((x,i)=>i===1?{...x,no:'9302',ad:'SENTETİK ÖĞRENCİ 3',sube:'205 12/A'}:x);sayfalar.push({ad:'AYT',rows:raporSatirlariAyt({ogrenciler:o}),shared:false})}
  return cokSayfaXlsx(sayfalar,{method:8});
}
// Notebooks for the Kademeler view: N students of two şubeler with four TYT and two AYT school results (denemeOkul rows), made up.
function kademeOgrencileri({N=30,seed=77}={}){
  const r=rng(seed),nrm=normal(r),tyt=[['turkce',40],['tarih',5],['cografya',5],['felsefe',5],['din',5],['mat',30],['geo',10],['fizik',7],['kimya',7],['biyoloji',6]],ayt=[['mat',30],['geo',10],['fizik',14],['kimya',13],['biyoloji',13]];
  const sinavlar=[['Sentetik Deneme 1','2026-09-10','TYT',0.3],['Sentetik Deneme 2','2026-09-24','TYT',-0.3],['Sentetik Deneme 3','2026-10-01','AYT',-0.2],['Sentetik Deneme 4','2026-10-08','TYT',0.1],['Sentetik Deneme 5','2026-10-15','AYT',0.2],['Sentetik Deneme 6','2026-10-22','TYT',0]];
  return Array.from({length:N},(_,i)=>{
    const th=nrm()*1.1,ders=Object.fromEntries([...tyt,...ayt].map(([k])=>[k,0.6*nrm()]));
    const rows=sinavlar.map(([ad,tarih,tur,kolay],k)=>({id:'p:k'+k+'-'+i,ad,tarih,tur,oturum:tur,alan:'SAY',sure:null,puan:null,ts:1000+k,
      dersler:(tur==='TYT'?tyt:ayt).map(([kod,n])=>{const d=Math.max(0,Math.min(n,Math.round(n*sig(th+ders[kod]+kolay+0.25*nrm()))));return {kod,dogru:d,yanlis:Math.max(0,n-d-(i%3)),soru:n}})}));
    return {ad:'SENTETİK ÖĞRENCİ '+(i+1),no:String(9400+i),sube:i%2?'12-B':'12-A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,denemeOkul:rows};
  });
}
module.exports={rng,normal,sig,simule,raporBuyuk,kademeOgrencileri,BUYUK_BOLUMLER,kitapcikSpecBuyuk,AYT_SECTIONS,AYT_KEY_A,AYT_KEY_B,AYT_HARITA,AYT_OGRENCILER,kitapcikSpecAyt,kitapcikSayfalariAyt,raporSatirlariAyt,cokSayfaXlsx,raporXlsx2,W,H,kitapcikSpec,kitapcikSayfalari,pdfYaz,itemlere,SECTIONS,KEY_A,KEY_B,OGRENCILER,raporSatirlari,raporXlsx,HARITA,cozumSpec,SENTETIK_TC};
