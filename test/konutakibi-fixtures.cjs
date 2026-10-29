// Synthetic only. Geometry follows the supported publisher report, no school data.
const student={name:'SENTETİK ÖĞRENCİ',no:'9001',cls:'205 12/A'};
const row=(code,name,c)=>({code,name,c});
const block=(rows,kind='outcome',course='TÜRKÇE-T',s=student)=>({student:{...s},course,kind,rows});
const reports=[
 {ad:'SENTETİK-1',blocks:[block([row('T.12.1.1','Sözcüğün anlamını belirler.',[4,2,1,1]),row('T.12.3.1','Cümlenin anlamını yorumlar.',[5,5,0,0])])]},
 {ad:'SENTETİK-2',blocks:[block([row('T.12.1.1','Sözcüğün anlamını belirler.',[2,2,0,0]),row('T.12.1.2','Sözcüğün bağlamını yorumlar.',[4,4,0,0])])]},
 {ad:'SENTETİK-3',blocks:[block([row('T.12.1.1','Sözcüğün anlamını belirler.',[10,0,6,4]),row('T.12.1.2','Sözcüğün bağlamını yorumlar.',[3,3,0,0])])]},
 {ad:'SENTETİK-4',blocks:[block([row('T.12.1.1','Sözcüğün anlamını belirler.',[6,6,0,0]),row('T.12.1.2','Sözcüğün bağlamını yorumlar.',[4,4,0,0])])]},
];
function pages({topic=false,continuation=false,corrupt=false,code='T.12.1.1',ad='SENTETİK-1'}={}){
 const item=(s,x,y,w=String(s).length*4,z=9)=>({s:String(s),x,y,w,z,h:z});
 const metadata=[item(topic?'KAZANIM KARNESİ-KONU':'KAZANIM KARNESİ',230,819),item('Ad Soyad',163,802,47.5),item(student.name,213,802,95),item('No',314,802,13.7),item(student.no,333,802,23),item('Kitapçık',363,802),item('Sınav Adı',163,788,47.5),item(ad,213,788),item('Sınıf',317,788,23),item(student.cls,348,788),item('Kademe',438,788)];
 const header=[item('TÜRKÇE-T',19,754),...['Toplam','Doğru','Yanlış','Boş'].map((s,i)=>item(s,364+48*i-12,754,24))];
 const nums=(c,y)=>c.map((n,i)=>item(n,364+48*i-3,y,6));
 const r1=[item(topic?'Sözcükte Anlam':code+' - Sözcüğün anlamını',18,742,190,7),...(!topic?[item('yorumlar.',18,734,36,7)]:[]),...nums([4,2,1,1],738)];
 const r2=[item(topic?'Cümlede Anlam':'T.12.3.1 - Cümlenin anlamını yorumlar.',18,continuation?805:724,200,7),...nums([2,1,0,1],continuation?802:722)];
 const totalY=continuation?788:708,total=[item('Toplam - TÜRKÇE-T',220,totalY,120),...nums([6,corrupt?4:3,1,2],totalY)];
 return continuation?[[...metadata,...header,...r1],[...r2,...total]]:[[...metadata,...header,...r1,...r2,...total]];
}
module.exports={student,row,block,reports,pages};

/* ---- Zorluk (difficulty) fixtures. Synthetic only: a made-up school, exam 'SENTETİK-1203', no names or ID numbers. ---- */
const zlib=require('node:zlib');
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0});
const crc32=b=>{let c=0xFFFFFFFF;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
// A tiny ZIP writer: method 0 = stored, 8 = deflate (zlib.deflateRawSync), like the files the browser reads.
function zip(files){
 const out=[],central=[];let off=0;
 for(const f of files){
  const name=Buffer.from(f.name,'utf8'),data=Buffer.from(f.data),method=f.method??8,comp=method===8?zlib.deflateRawSync(data):data,crc=crc32(data);
  const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0x0800,6);lh.writeUInt16LE(method,8);lh.writeUInt16LE(0,10);lh.writeUInt16LE(0x21,12);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(comp.length,18);lh.writeUInt32LE(data.length,22);lh.writeUInt16LE(name.length,26);lh.writeUInt16LE(0,28);
  const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(0x0800,8);ch.writeUInt16LE(method,10);ch.writeUInt16LE(0,12);ch.writeUInt16LE(0x21,14);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(comp.length,20);ch.writeUInt32LE(data.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(off,42);
  out.push(lh,name,comp);central.push(ch,name);off+=30+name.length+comp.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(off,16);
 return Buffer.concat([...out,cd,end]);
}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const colName=i=>String.fromCharCode(65+i);
// rows: array of arrays of strings (row 1 first). shared:true writes xl/sharedStrings.xml (t="s"), otherwise inline strings.
function xlsx({sheetName='Sınav Özeti',rows,shared=false,method=8}){
 const sst=[],idx=new Map(),cell=(r,c,v)=>{
  if(v===''||v===null||v===undefined)return '';
  const ref=colName(c)+(r+1);
  if(shared){if(!idx.has(v)){idx.set(v,sst.length);sst.push(v)}return '<c r="'+ref+'" t="s"><v>'+idx.get(v)+'</v></c>'}
  return '<c r="'+ref+'" t="inlineStr"><is><r><t xml:space="preserve">'+esc(v)+'</t></r></is></c>';
 };
 const sheet='<?xml version="1.0" encoding="UTF-8"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((row,r)=>'<row r="'+(r+1)+'">'+row.map((v,c)=>cell(r,c,v)).join('')+'</row>').join('')+'</sheetData></worksheet>';
 const files=[
  {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',method},
  {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+esc(sheetName)+'" sheetId="1" r:id="rId1"/></sheets></workbook>',method},
  {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>',method},
  {name:'xl/worksheets/sheet1.xml',data:sheet,method}];
 if(shared)files.push({name:'xl/sharedStrings.xml',data:'<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'+sst.length+'" uniqueCount="'+sst.length+'">'+sst.map(s=>'<si><t xml:space="preserve">'+esc(s)+'</t></si>').join('')+'</sst>',method});
 return zip(files);
}
// questions: [[ders, 'code1,code2'], ...] in booklet A order.
const ozetXlsx=(questions,o={})=>xlsx({...o,rows:[[(o.title||'SENTETİK-1203 - TYT')],['Ders','Kazanım Kodu','Kazanım'],...questions.map(([d,c])=>[d,c,'Sentetik kazanım metni.'])]});
// The publisher's answer report: has names and ID numbers, so the page must refuse it.
const cevapXlsx=(o={})=>xlsx({sheetName:'TYT',...o,rows:[['SINAV CEVAP RAPORU'],['Rapor Tarihi: 01.01.2000'],[],['','','','','','','Toplam','','','','TÜRKÇE-T'],['Sıra','Öğrenci No','Ad Soyad','TC Kimlik No','Şube','Kitapçık','D','Y','B','Net','S1','S2'],['','','Cevap Anahtarı - A','','','A','','','','','C','B'],['1','9001','SENTETİK GİZLİ','00000000000','205 12/A','A','1','1','0','0.75','C','D']]});

// Madde Analizi geometry as measured on the real report: pages are rotated (rows advance along x, columns along y).
const MADDE_COL=[46,88,126.5,168.5,209,246,284,322,360.5,397.5,445,512.5];
const zorlukEtiketi=p=>p>=.8?'Çok Kolay':p>=.6?'Kolay':p>=.4?'Orta':p>=.2?'Zor':'Çok Zor';
// courses: [{course:'TÜRKÇE-T', rows:[[D,Y,B],...], pct:{3:'12.3%'} (printed Başarı overrides)}]
function maddePages({ad='SENTETİK-1203',oturum='TYT',N=27,courses,rotated=true,perPage=32,okul='SENTETİK ANADOLU LİSESİ',answered=N}){
 const item=(s,row,col,w=String(s).length*4.5)=>rotated?{s:String(s),x:row,y:col-w/2,w,h:8,z:8,f:'g_f1'}:{s:String(s),x:col-w/2,y:800-row,w,h:8,z:8,f:'g_f1'};
 const pages=[],hdr=(row)=>['No','Cevap','Doğru','Yanlış','Boş','A','B','C','D','E','Başarı','Zorluk'].map((s,i)=>item(s,row,MADDE_COL[i]));
 const side=(row,n)=>[item('Zorluk',row,631),item('Soru Numaraları',row,738),...Array.from({length:n},(_,i)=>[item(['Çok Kolay','Kolay','Orta','Zor','Çok Zor'][i%5],row+16+14*i,619),item('1,2,3',row+16+14*i,694)]).flat()];
 const line=(r,q,row,pct)=>{const [D,Y,B]=q,p=D/N;return [item(r,row,MADDE_COL[0]),item('ABCDE'[r%5],row,MADDE_COL[1]),item(D,row,MADDE_COL[2]),item(Y,row,MADDE_COL[3]),item(B,row,MADDE_COL[4]),...[0,1,2,3,4].map(i=>item(i,row,MADDE_COL[5+i])),item(pct??(100*D/N).toFixed(1)+'%',row,MADDE_COL[10]),item(zorlukEtiketi(p),row,MADDE_COL[11])]};
 for(const c of courses){
  let page=[],row=136,i=0;
  page.push(item(okul,34,421,234),item(ad+' / '+oturum,48,421),item(c.course+' Madde Analizi',65,421),item('Öğrenci Sayısı : '+N,84,62),item('Testi Cevaplamış Öğrenci Sayısı : '+answered,98,62),...hdr(120),...side(120,2));
  for(const q of c.rows){
   if(i&&i%perPage===0){pages.push(page);page=[...hdr(32)];row=48}
   page.push(...line(i+1,q,row,c.pct?.[i+1]));row+=14;i++;
  }
  page.push(item('Ortalama',row,45),item('50.0%',row,MADDE_COL[10]),item('Orta',row,MADDE_COL[11]));pages.push(page);
 }
 return pages;
}

// Just enough of DOMParser for Node (the browser test uses the real one): elements, attributes, text, entities.
class XEl{
 constructor(n,a){this.nodeName=n;this.localName=n.split(':').pop();this.attrs=a;this.nodes=[]}
 get children(){return this.nodes.filter(n=>typeof n!=='string')}
 get textContent(){return this.nodes.map(n=>typeof n==='string'?n:n.textContent).join('')}
 getAttribute(n){return n in this.attrs?this.attrs[n]:null}
 getAttributeNS(ns,l){const k=Object.keys(this.attrs).find(k=>k.includes(':')&&k.split(':').pop()===l);return k?this.attrs[k]:null}
 all(){return this.children.flatMap(c=>[c,...c.all()])}
 getElementsByTagName(n){return this.all().filter(e=>e.nodeName===n)}
 getElementsByTagNameNS(ns,n){return this.all().filter(e=>e.localName===n)}
}
const ent=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(m,e)=>e[0]==='#'?String.fromCodePoint(e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):+e.slice(1)):{amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e.toLowerCase()]);
class DOMParserShim{
 parseFromString(text){
  const root=new XEl('#document',{}),stack=[root],re=/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([^>\s]+)\s*>|<([^\s/>]+)((?:\s+[^\s=]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m,ok=true,pos=0;
  while((m=re.exec(text))){
   if(m.index!==pos){ok=false;break}pos=re.lastIndex;
   const top=stack.at(-1);
   if(m[1]!==undefined)top.nodes.push(m[1]);
   else if(m[2]!==undefined){if(stack.length<2||top.nodeName!==m[2]){ok=false;break}stack.pop()}
   else if(m[3]!==undefined){const a={};for(const x of m[4].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))a[x[1]]=ent(x[2]??x[3]);const e=new XEl(m[3],a);top.nodes.push(e);if(!m[5])stack.push(e)}
   else if(m[6]!==undefined)top.nodes.push(ent(m[6]));
  }
  if(pos!==text.length||stack.length!==1)ok=false;
  const err=new XEl('parsererror',{});
  const doc={documentElement:ok?root.children[0]:err,getElementsByTagName:n=>ok?root.getElementsByTagName(n):n==='parsererror'?[err]:[],getElementsByTagNameNS:(ns,n)=>ok?root.getElementsByTagNameNS(ns,n):[]};
  return doc;
 }
}
Object.assign(module.exports,{zip,xlsx,ozetXlsx,cevapXlsx,maddePages,DOMParserShim,zorlukEtiketi});
