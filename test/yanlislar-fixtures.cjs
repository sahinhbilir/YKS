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
function raporSatirlari({tcBaslik='TC Kimlik No',ogrenciler=OGRENCILER,anahtarA=KEY_A,anahtarB=KEY_B}={}){
  const pad=(a,n=20)=>{const o=a.slice();while(o.length<n)o.push('');return o};
  const sec=Array(20).fill('');sec[6]='Toplam';let c=10;for(const [ad,k] of SECTIONS){sec[c]=ad;c+=k}
  const bas=['Sıra','Öğrenci No','Ad Soyad',tcBaslik,'Şube','Kitapçık','D','Y','B','Net'];for(const [,k] of SECTIONS)for(let i=1;i<=k;i++)bas.push('S'+i);
  return [['SINAV CEVAP RAPORU'],['Rapor Tarihi: 01.01.2000   |   Sinav: SENTETİK-1203   |   Form: TYT'],[],sec,bas,
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
module.exports={W,H,kitapcikSpec,kitapcikSayfalari,pdfYaz,itemlere,SECTIONS,KEY_A,KEY_B,OGRENCILER,raporSatirlari,raporXlsx,HARITA,cozumSpec,SENTETIK_TC};
