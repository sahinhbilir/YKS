// Teacher-only publisher assessment evidence. Embedded by scripts/embed-konutakibi.cjs.
// No personal data or source PDFs belong in this file. See docs/konu-takibi.md.
const KONU_TAKIBI = (() => {
const LIMIT=350000, MAX_ROWS=30000;
const clean=s=>String(s??'').replace(/\s+/gu,' ').trim();
const key=s=>clean(s).toLocaleUpperCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^A-Z0-9ÇĞİÖŞÜ]/gu,'');
const ek=s=>denemeAdAnahtari(s);
const title=s=>clean(s).toLocaleLowerCase('tr-TR').replace(/(^|[\s(])\p{L}/gu,s=>s.toLocaleUpperCase('tr-TR'));
const percent=c=>c[0]?100*c[1]/c[0]:null;
const sum=(a,b)=>a.map((x,i)=>x+b[i]);
const zero=()=>[0,0,0,0];
const same=(a,b)=>a.every((v,i)=>v===b[i]);
const studentKey=s=>JSON.stringify([s.cls,s.no]);
const blockKey=b=>JSON.stringify([studentKey(b.student),b.course,b.kind]);
const countOK=c=>Array.isArray(c)&&c.length===4&&c.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=10000)&&c[0]===c[1]+c[2]+c[3];
const codeRE=/^([\p{L}.]+(?:\.\d+)+)\s*[-–]\s*(.+)$/u;
// Publisher topic parents, checked against paired KONU and coded reports. These are NOT inferred
// from answer percentages. Unknown codes remain unassigned until the teacher supplies a topic.
const PARENTS=`T.12.1|Sözcükte Anlam
T.12.2|Söz Öbeklerinde Anlam
T.12.3|Cümlede Anlam
T.12.4.1|Paragrafta Anlam
T.12.4.2|Paragrafta Yapı
T.12.4.3|Paragrafta Anlatım Özellikleri
T.12.5|Ses Bilgisi
T.12.6|Yazım Kuralları
T.12.7|Noktalama İşaretleri
T.12.8|Sözcükte Ekler ve Yapı
T.12.10|Sıfat (Ön Ad)
T.12.21|Cümlenin Ögeleri
T.12.22|Cümle Türleri
E.TAR.9.1|Tarih ve Zaman
E.TAR.9.2|İnsanlığın İlk Dönemleri
E.TAR.9.4|İlk ve Orta Çağlarda Türk Dünyası
E.TAR.10.1|Yerleşme ve Devletleşme Sürecinde Selçuklu Türkiyesi
E.TAR.10.5|Dünya Gücü Osmanlı (1453-1595)
İTA.12.1|20. Yüzyıl Başlarında Osmanlı Devleti ve Dünya
İTA.12.2|Millî Mücadele
E.COG.9.1|Doğal Sistemler
E.COG.9.3|Küresel Ortam: Bölgeler ve Ülkeler
E.COG.10.2|Beşerî Sistemler
E.COG.10.4|Çevre ve Toplum
E.FEL.10.1|Felsefeyi Tanıma
E.FEL.10.2|Felsefe ile Düşünme
E.FEL.10.3|Felsefenin Temel Konuları ve Problemleri
E.FEL.11.1|MÖ 6. Yüzyıl-MS 2. Yüzyıl Felsefesi
E.FEL.11.2|MS 2. Yüzyıl-MS 15. Yüzyıl Felsefesi
E.FEL.11.3|15. Yüzyıl-17. Yüzyıl Felsefesi
E.FEL.11.5|20. Yüzyıl Felsefesi
E.DİN.9.1|Bilgi ve İnanç
E.DİN.9.2|Din ve İslam
E.DİN.9.3|İslam ve İbadet
E.DİN.10.3|Din ve Hayat
E.DİN.10.4|Ahlaki Tutum ve Davranışlar
E.DİN.11.3|Kur’an’da Bazı Kavramlar
DİN.12.2|Anadolu’da İslam
E.M.9.1.1|Önermeler ve Bileşik Önermeler
E.M.9.2.1|Kümelerde Temel Kavramlar
E.M.9.2.2|Kümelerde İşlemler
E.M.9.3.1|Sayı Kümeleri
E.M.9.3.2|Bölünebilme Kuralları
E.M.9.3.3|Birinci Dereceden Denklemler ve Eşitsizlikler
E.M.9.3.4|Üslü İfadeler ve Denklemler
E.M.9.3.6|Problemler
E.M.9.5.1|Merkezî Eğilim ve Yayılım Ölçüleri
E.M.10.1.1|Sıralama ve Seçme
E.M.10.1.2|Basit Olayların Olasılıkları
E.M.10.2.1|Fonksiyon Kavramı ve Gösterimi
E.M.10.2.2|İki Fonksiyonun Bileşkesi ve Bir Fonksiyonun Tersi
E.GEO.9.4.1|Üçgenlerde Temel Kavramlar
E.GEO.9.4.2|Üçgenlerde Eşlik ve Benzerlik
E.GEO.9.4.3|Üçgenin Yardımcı Elemanları
E.GEO.9.4.4|Dik Üçgen ve Trigonometri
E.GEO.9.4.5|Üçgenin Alanı
E.GEO.10.5.1|Çokgenler
E.GEO.10.5.3|Özel Dörtgenler
E.GEO.10.6.1|Katı Cisimler
E.FİZ.9.1.3|Fiziksel Niceliklerin Sınıflandırılması
E.FİZ.9.2.1|Madde ve Özkütle
E.FİZ.9.2.3|Yapışma ve Birbirini Tutma
E.FİZ.9.3.1|Hareket
E.FİZ.9.5.1|Isı ve Sıcaklık
E.FİZ.10.1.2|Elektrik Devreleri
E.FİZ.10.2.1|Basınç
E.FİZ.10.2.2|Kaldırma Kuvveti
E.FİZ.10.3.1|Dalgalar
E.FİZ.10.4.5|Küresel Aynalar
E.KİM.9.1.2|Kimya Disiplinleri ve Kimyacıların Çalışma Alanları
E.KİM.9.1.3|Kimyanın Sembolik Dili
E.KİM.9.1.4|Kimya Uygulamalarında İş Sağlığı ve Güvenliği
E.KİM.9.2.1|Atom Modelleri
E.KİM.9.2.2|Atomun Yapısı
E.KİM.9.2.3|Periyodik Sistem
E.KİM.9.3.4|Zayıf Etkileşimler
E.KİM.9.4.3|Sıvılar
E.KİM.10.1.4|Kimyasal Tepkimelerde Hesaplamalar
E.KİM.10.2.2|Ayırma ve Saflaştırma Teknikleri
E.KİM.10.3.4|Tuzlar
E.BİY.9.1.1|Biyoloji ve Canlıların Ortak Özellikleri
E.BİY.9.1.2|Canlıların Yapısında Bulunan Temel Bileşikler
E.BİY.9.2.1|Hücre
E.BİY.9.3.2|Canlı Alemleri ve Özellikleri
E.BİY.10.1.1|Mitoz ve Eşeysiz Üreme
E.BİY.10.2.1|Kalıtım ve Biyolojik Çeşitlilik
E.BİY.10.3.1|Ekosistem Ekolojisi`.split('\n').map(s=>s.split('|')).sort((a,b)=>b[0].length-a[0].length);
const canon=new Map(PARENTS.map(([,n])=>[key(n),n]));
canon.set(key('FİZİKSEL NİCELİKLERİNSINIFLANDIRILMASI'),'Fiziksel Niceliklerin Sınıflandırılması');
const topicName=n=>canon.get(key(n))||title(n);
const topicFor=(course,code,maps={})=>maps[course+'|'+code]||PARENTS.find(([p])=>code===p||code.startsWith(p+'.'))?.[1]||null;

/* A PDF is accepted atomically. Every subject must end in a verified total, including across pages. */
function pdfCoz(pages){
  if(!Array.isArray(pages)||!pages.length||pages.length>100)throw new Error('PDF sayfaları okunamadı.');
  const out={ad:null,blocks:[]};let student=null,kind=null,block=null,cols=null,seen=new Set();
  const fail=msg=>{throw new Error(msg+' PDF eklenmedi.')};
  for(const raw of pages){
    const items=raw.filter(i=>i&&typeof i.s==='string'&&Number.isFinite(i.x)&&Number.isFinite(i.y)).map(i=>({...i,s:clean(i.s)}));
    const heading=items.find(i=>/^KAZANIM KARNESİ(?:-KONU)?$/u.test(i.s));
    if(heading){
      if(block)fail('Ders toplamı eksik.');
      const value=(caption,right)=>{const a=items.find(i=>i.s===caption);return a?items.filter(i=>Math.abs(i.y-a.y)<1&&i.x>a.x+a.w-1&&i.x<right).sort((a,b)=>a.x-b.x).map(i=>i.s).join(' '):''};
      const name=value('Ad Soyad',310),no=value('No',362),cls=value('Sınıf',430),ad=value('Sınav Adı',315);
      if(!name||!/^\d{1,12}$/u.test(no)||!/(?:9|1[012])\s*[/\-]\s*[A-ZÇĞİÖŞÜ]/u.test(cls)||!ad)fail('Öğrenci veya sınav başlığı eksik.');
      if(/,|…|\.\.\./u.test(ad))fail('Birden çok sınavın birleşik karnesi zaman çizelgesine eklenemez. Tek sınav kazanım haritasını kullanın.');
      if(out.ad&&ek(out.ad)!==ek(ad))fail('PDF birden çok sınav içeriyor.');
      out.ad=ad;student={name,no,cls:clean(cls)};kind=heading.s.endsWith('-KONU')?'topic':'outcome';
    }
    const headers=items.filter(i=>i.s==='Toplam');
    if(headers.length){const h=headers[0],cs=['Toplam','Doğru','Yanlış','Boş'].map(s=>items.find(i=>i.s===s&&Math.abs(i.y-h.y)<1));if(cs.some(x=>!x))fail('Tablo sütunları eksik.');cols=cs.map(i=>i.x+i.w/2)}
    if(!cols||!student){if(items.length)fail('Tek sınavlık kazanım haritası bulunamadı.');continue}
    const anchors=items.filter(i=>/^\d+$/u.test(i.s)&&Math.abs(i.x+i.w/2-cols[0])<5).map(i=>({y:i.y,counts:cols.map(c=>items.filter(j=>Math.abs(j.y-i.y)<1&&Math.abs(j.x+j.w/2-c)<5)),labels:[]}));
    const events=headers.map(h=>({type:'header',y:h.y,label:items.filter(i=>i.x<cols[0]-25&&Math.abs(i.y-h.y)<1).map(i=>i.s).join(' ')}));
    const all=[...anchors.map(a=>({...a,type:'row'})),...events].sort((a,b)=>b.y-a.y);
    for(const i of items.filter(i=>i.x<cols[0]-25&&i.y<(heading?Math.max(...headers.map(h=>h.y))+1:Infinity)&&i.y>12)){
      const nearest=all.reduce((a,b)=>!a||Math.abs(b.y-i.y)<Math.abs(a.y-i.y)?b:a,null);
      if(nearest?.type==='row')nearest.labels.push(i);
    }
    for(const e of all){
      if(e.type==='header'){
        if(block)fail('Önceki dersin toplamı eksik.');
        if(!/-[TA]$/u.test(e.label))fail('Ders başlığı tanınmadı: '+e.label);
        block={student:{...student},course:e.label,kind,rows:[]};continue;
      }
      if(!block)fail('Ders başlığı eksik.');
      if(e.counts.some(c=>c.length!==1||!/^\d+$/u.test(c[0].s)))fail('Yanıt sayıları okunamadı.');
      const c=e.counts.map(a=>+a[0].s),label=e.labels.sort((a,b)=>b.y-a.y||a.x-b.x).map(i=>i.s).join(' ');
      if(!countOK(c))fail('Doğru, yanlış ve boş sayıları toplamla uyuşmuyor.');
      if(label.startsWith('Toplam - ')){
        if(label!=='Toplam - '+block.course||!block.rows.length||!same(block.rows.reduce((a,r)=>sum(a,r.c),zero()),c))fail('Ders toplamı satırlarla uyuşmuyor: '+block.course);
        const bk=blockKey(block);if(seen.has(bk))fail('Aynı öğrenci ve ders PDF içinde tekrarlanıyor.');seen.add(bk);
        out.blocks.push(block);block=null;
      }else{
        const m=codeRE.exec(label);if(!label||(kind==='outcome'&&!m))fail('Kazanım satırı okunamadı: '+label);
        const row={code:m?m[1]:'',name:m?m[2]:topicName(label),c};
        if(block.rows.some(r=>(r.code||key(r.name))===(row.code||key(row.name))))fail('Yinelenen konu veya kazanım satırı.');
        block.rows.push(row);
      }
    }
  }
  if(block)fail('Son dersin toplamı eksik.');
  if(!out.ad||!out.blocks.length)fail('Bu PDF metin içermiyor. Resim veya birleşik karne yerine tek sınavın metin içeren kazanım haritasını yükleyin.');
  return out;
}

/* Zorluk (difficulty) sources. Two files per exam: the Sınav özeti (.xlsx: question -> outcome codes, booklet A order) and
   the Madde Analizi (.pdf: the school's own success rate per question). Both are accepted atomically; nothing but
   course, outcome codes and per-question counts is kept. The publisher's answer report (names, ID numbers) is refused. */
const CEVAP_RAPORU='Bu dosya öğrenci cevap raporu; kişisel bilgi (TC kimlik) içerdiği için yüklenmez. Sınav özeti ve Madde Analizi yeterli.';
const OZET_SAYFA='Sınav Özeti',RELNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const GIZLI=new Set(['TC Kimlik No','Öğrenci No','Ad Soyad','Kitapçık','SINAV CEVAP RAPORU'].map(key));
const ZOTURUM=['TYT','AYT','TYT + AYT'];
const u16=(d,o)=>d.getUint16(o,true),u32=(d,o)=>d.getUint32(o,true);
const EXCEL_HATA='Bu dosya geçerli bir Excel (.xlsx) dosyası değil. Dosya eklenmedi.';
function zipListe(b){
  const bad=()=>new Error(EXCEL_HATA);
  if(!b||!(b.length>=22)||b.length>15*1024*1024)throw bad();
  const d=new DataView(b.buffer,b.byteOffset,b.byteLength);let e=-1;
  for(let i=b.length-22;i>=Math.max(0,b.length-22-65535);i--)if(u32(d,i)===0x06054b50){e=i;break}
  if(e<0)throw bad();
  const n=u16(d,e+10),off=u32(d,e+16);if(!n||n>200||off>=b.length)throw bad();
  const out=new Map();let p=off;
  for(let k=0;k<n;k++){
    if(p+46>b.length||u32(d,p)!==0x02014b50)throw bad();
    const nl=u16(d,p+28),el=u16(d,p+30),cl=u16(d,p+32);if(p+46+nl>b.length)throw bad();
    out.set(new TextDecoder().decode(b.subarray(p+46,p+46+nl)).replace(/^\//u,''),{flag:u16(d,p+8),method:u16(d,p+10),csize:u32(d,p+20),usize:u32(d,p+24),lho:u32(d,p+42)});
    p+=46+nl+el+cl;
  }
  return out;
}
async function zipDosya(b,ent,cap=8*1024*1024){
  const bad=()=>new Error(EXCEL_HATA),d=new DataView(b.buffer,b.byteOffset,b.byteLength);
  if(ent.flag&1)throw new Error('Şifreli Excel dosyası okunamaz. Dosya eklenmedi.');
  if(ent.usize>cap)throw new Error('Excel dosyasının içeriği çok büyük. Dosya eklenmedi.');
  if(ent.lho+30>b.length||u32(d,ent.lho)!==0x04034b50)throw bad();
  const s=ent.lho+30+u16(d,ent.lho+26)+u16(d,ent.lho+28);if(s+ent.csize>b.length)throw bad();
  const raw=b.subarray(s,s+ent.csize);
  if(ent.method===0){if(ent.csize!==ent.usize)throw bad();return raw}
  if(ent.method!==8)throw bad();
  if(typeof DecompressionStream!=='function')throw new Error('Bu tarayıcı Excel dosyasını açamıyor. Dosya eklenmedi.');
  try{
    const rd=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let len=0;
    for(;;){const {done,value}=await rd.read();if(done)break;len+=value.length;if(len>ent.usize){await rd.cancel();throw bad()}parts.push(value)}
    if(len!==ent.usize)throw bad();
    const out=new Uint8Array(len);let at=0;for(const x of parts){out.set(x,at);at+=x.length}return out;
  }catch(e){throw bad()}
}
function xmlAc(text){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(!doc.documentElement||doc.getElementsByTagName('parsererror').length)throw new Error(EXCEL_HATA);
  return doc;
}
const xmlEl=(el,name)=>Array.from(el.getElementsByTagNameNS('*',name));
const xmlKids=el=>Array.from(el.children);
// Rich text keeps only <t> runs (phonetic runs <rPh> are skipped).
const siMetin=el=>xmlKids(el).map(c=>c.localName==='t'?c.textContent:c.localName==='r'?xmlKids(c).filter(x=>x.localName==='t').map(x=>x.textContent).join(''):'').join('');
function sayfaHucreleri(doc,sst){
  const rows=new Map(),cells=xmlEl(doc,'c');if(cells.length>300000)throw new Error(EXCEL_HATA);
  for(const c of cells){
    const ref=/^([A-Z]{1,3})(\d{1,6})$/u.exec(c.getAttribute('r')||'');if(!ref)continue;
    const t=c.getAttribute('t'),kids=xmlKids(c),v=kids.find(x=>x.localName==='v'),is=kids.find(x=>x.localName==='is');
    const s=clean(t==='inlineStr'&&is?siMetin(is):t==='s'&&v?sst[+v.textContent]??'':v?v.textContent:'');
    if(!s)continue;const r=+ref[2];if(!rows.has(r))rows.set(r,new Map());rows.get(r).set(ref[1],s);
  }
  return rows;
}
async function ozetCoz(bytes){
  const files=zipListe(bytes),read=async n=>{const e=files.get(n);return e?new TextDecoder().decode(await zipDosya(bytes,e)):null};
  const bad=()=>new Error(EXCEL_HATA),wbx=await read('xl/workbook.xml'),rx=await read('xl/_rels/workbook.xml.rels');if(!wbx||!rx)throw bad();
  const sheets=xmlEl(xmlAc(wbx),'sheet').map(s=>({name:s.getAttribute('name'),rid:s.getAttribute('r:id')||s.getAttributeNS(RELNS,'id')}));
  if(!sheets.length||sheets.length>8)throw bad();
  const rels=new Map(xmlEl(xmlAc(rx),'Relationship').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')||'']));
  const sx=await read('xl/sharedStrings.xml'),sst=sx?xmlEl(xmlAc(sx),'si').map(siMetin):[],loaded=[];
  for(const s of sheets){
    const t=rels.get(s.rid),x=t?await read(t.startsWith('/')?t.slice(1):'xl/'+t):null;if(x===null)throw bad();
    loaded.push({name:s.name,rows:sayfaHucreleri(xmlAc(x),sst)});
  }
  // Privacy first: a student answer report is refused before anything else is looked at, and nothing is kept.
  for(const sh of loaded)for(const [r,cells] of sh.rows)if(r<=12)for(const v of cells.values())if(GIZLI.has(key(v)))throw new Error(CEVAP_RAPORU);
  const fail=msg=>{throw new Error(msg+' Dosya eklenmedi.')};
  if(loaded.length!==1||loaded[0].name!==OZET_SAYFA)fail('Bu dosya bir Sınav Özeti değil (tek sayfa, adı “'+OZET_SAYFA+'” olmalı).');
  const rows=loaded[0].rows,title=rows.get(1)?.get('A')||'',tm=/^(.+?)\s*[-–]\s*(TYT|AYT)$/u.exec(title),h=rows.get(2);
  if(!tm||tm[1].length>160)fail('Sınav Özeti başlığı okunamadı (örnek: 27-YKS-1203 - TYT).');
  if(!h||key(h.get('A'))!=='DERS'||key(h.get('B'))!=='KAZANIMKODU'||key(h.get('C'))!=='KAZANIM')fail('Sınav Özeti sütunları (Ders, Kazanım Kodu, Kazanım) bulunamadı.');
  const sfx=tm[2]==='TYT'?'-T':'-A',dersler={};let last=null,lastDers=null,total=0;
  for(const [r,cells] of [...rows].filter(([r])=>r>2).sort((a,b)=>a[0]-b[0])){
    const ders=cells.get('A')||'',codes=cells.get('B')||'';
    if(!ders&&!codes&&!cells.get('C'))continue;
    if(r!==(last===null?3:last+1))fail('Sınav Özeti satırları kesintisiz değil (satır '+r+').');
    last=r;
    if(!ders||!ders.endsWith(sfx)||ders.length>80)fail('Ders adı bu oturumla uyuşmuyor (satır '+r+').');
    const list=[...new Set(codes.split(/[,;]/u).map(clean).filter(Boolean))];
    if(!list.length||list.length>10||list.some(c=>!/^[\p{L}\p{N}.\-]{2,40}$/u.test(c)))fail('Kazanım kodu okunamadı (satır '+r+').');
    if(!dersler[ders]){if(Object.keys(dersler).length>=20)fail('En fazla 20 ders olabilir.');dersler[ders]=[]}
    else if(lastDers!==ders)fail('Dersin soruları ardışık değil: '+ders+'.');
    if(dersler[ders].length>=200)fail('Bir derste en fazla 200 soru olabilir.');
    dersler[ders].push(list);lastDers=ders;total++;
  }
  if(!total)fail('Sınav Özeti’nde soru satırı yok.');
  return {tur:'ozet',ad:clean(tm[1]),oturum:tm[2],dersler};
}

/* Madde Analizi PDF. The pages are rotated: table rows advance along x and columns along y. The orientation is
   read from the header row (items sharing x = rotated, sharing y = upright), so both layouts work. */
const MADDE_KOLON=['No','Cevap','Doğru','Yanlış','Boş','A','B','C','D','E','Başarı','Zorluk'];
const MADDE_ZORUNLU=['No','Doğru','Yanlış','Boş','Başarı','Zorluk'];
function maddeCoz(pages){
  const fail=msg=>{throw new Error(msg+' Dosya eklenmedi.')};
  if(!Array.isArray(pages)||!pages.length||pages.length>100)throw new Error('PDF sayfaları okunamadı.');
  const out={tur:'madde',ad:null,oturum:null,ogrenci:null,dersler:{}};let cur=null;
  const TITLE=/^(.+?)\s+Madde Analizi$/u,EXAM=/^(.+?)\s*\/\s*(TYT|AYT)$/u,INFO=/^Öğrenci Sayısı\s*:\s*(\d+)$/u;
  pages.forEach((raw,pi)=>{
    const sayfa='Sayfa '+(pi+1)+': ';
    const items=(Array.isArray(raw)?raw:[]).filter(i=>i&&typeof i.s==='string'&&Number.isFinite(i.x)&&Number.isFinite(i.y)).map(i=>({...i,s:clean(i.s),w:Number.isFinite(i.w)?i.w:0})).filter(i=>i.s);
    if(!items.length)return;
    const known=items.filter(i=>MADDE_KOLON.includes(i.s)),heads=[];let rot=null;
    for(const n of items.filter(i=>i.s==='No')){
      const same=axis=>known.filter(i=>Math.abs(i[axis]-n[axis])<1.5);
      const sx=same('x'),sy=same('y'),r=sx.length>sy.length,row=r?sx:sy;
      if(row.length<MADDE_ZORUNLU.length)continue;
      if(rot!==null&&rot!==r)fail(sayfa+'Tablo yönü tutarsız.');rot=r;
      const col=i=>r?i.y+i.w/2:i.x+i.w/2,cols={};
      // The side table (Zorluk / Soru Numaraları, right of the main table) repeats a header word; the leftmost one is the main table's.
      for(const c of row)cols[c.s]=Math.min(cols[c.s]??Infinity,col(c));
      if(MADDE_ZORUNLU.some(c=>cols[c]===undefined))fail(sayfa+'Tablo sütunları eksik.');
      const seq=MADDE_KOLON.filter(c=>cols[c]!==undefined).map(c=>cols[c]);
      if(seq.some((x,i)=>i&&x<=seq[i-1]))fail(sayfa+'Tablo sütunları sırasız.');
      heads.push({cols,pos:r?n.x:-n.y});
    }
    if(!heads.length)fail(sayfa+'Madde Analizi tablosu bulunamadı.');
    const pos=i=>rot?i.x:-i.y,col=i=>rot?i.y+i.w/2:i.x+i.w/2;
    heads.sort((a,b)=>a.pos-b.pos);
    const titles=items.filter(i=>TITLE.test(i.s)),exams=items.filter(i=>EXAM.test(i.s)),infos=items.filter(i=>INFO.test(i.s));
    heads.forEach((hd,k)=>{
      const before=k?heads[k-1].pos:-Infinity,near=list=>list.filter(i=>pos(i)<hd.pos&&pos(i)>before).sort((a,b)=>pos(b)-pos(a))[0];
      const title=near(titles);
      if(title){
        if(cur)fail('Önceki dersin sonu (Ortalama satırı) eksik: '+cur.course+'.');
        const ex=near(exams),info=near(infos);if(!ex||!info)fail(sayfa+'Sınav adı veya öğrenci sayısı bulunamadı.');
        const em=EXAM.exec(ex.s),course=TITLE.exec(title.s)[1],n=+INFO.exec(info.s)[1];
        if(!/-[TA]$/u.test(course)||course.length>80||course.endsWith(em[2]==='TYT'?'-A':'-T'))fail(sayfa+'Ders adı tanınmadı: '+course+'.');
        if(out.ad!==null&&(ek(out.ad)!==ek(em[1])||out.oturum!==em[2]))fail('Dosyada birden çok sınav var.');
        if(out.ogrenci!==null&&out.ogrenci!==n)fail('Öğrenci sayısı derslerde farklı.');
        if(!(n>=1&&n<=10000))fail(sayfa+'Öğrenci sayısı okunamadı.');
        if(out.dersler[course])fail('Aynı ders dosyada tekrarlanıyor: '+course+'.');
        out.ad=clean(em[1]);out.oturum=em[2];out.ogrenci=n;cur={course,n,rows:[]};
      }else if(!cur)fail(sayfa+'Ders başlığı bulunamadı.');
      // Rows of this header: after it and before the next subject's title/info or header. The side table (far right) maps to no column.
      const stops=[...titles,...exams,...infos].map(pos).filter(p=>p>hd.pos),end=Math.min(...stops,heads[k+1]?.pos??Infinity);
      const cells=[],avg=[];
      for(const i of items){
        const p=pos(i);if(p<=hd.pos+3||p>=end)continue;
        if(i.s==='Ortalama'){avg.push(p);continue}
        let best=null,dist=Infinity;for(const c of MADDE_KOLON){if(hd.cols[c]===undefined)continue;const dd=Math.abs(col(i)-hd.cols[c]);if(dd<dist){dist=dd;best=c}}
        if(best&&dist<=14)cells.push({c:best,p,col:col(i),s:i.s});
      }
      const lines=[];
      for(const c of [...cells.map(x=>({...x,avg:false})),...avg.map(p=>({c:'',p,avg:true,s:''}))].sort((a,b)=>a.p-b.p)){
        const l=lines.at(-1);if(l&&c.p-l.p<=4){l.items.push(c);l.avg=l.avg||c.avg}else lines.push({p:c.p,items:[c],avg:c.avg});
      }
      for(const ln of lines){
        if(ln.avg){
          if(!cur||!cur.rows.length)fail(sayfa+'Ortalama satırı soru satırlarından önce geldi.');
          out.dersler[cur.course]=cur.rows;cur=null;continue;
        }
        const cell=c=>ln.items.filter(x=>x.c===c).sort((a,b)=>a.col-b.col).map(x=>x.s).join(' ');
        if(!cell('No')){if(['Doğru','Yanlış','Boş'].some(c=>cell(c)))fail(sayfa+'Soru numarası okunamadı.');continue}
        if(!cur)fail(sayfa+'Ortalama satırından sonra soru satırı var.');
        const num=x=>/^\d{1,5}$/u.test(x)?+x:null,no=num(cell('No')),D=num(cell('Doğru')),Y=num(cell('Yanlış')),B=num(cell('Boş'));
        if(no===null||no!==cur.rows.length+1)fail(sayfa+cur.course+' soru numaraları sırayla değil (beklenen '+(cur.rows.length+1)+').');
        if(D===null||Y===null||B===null)fail(sayfa+cur.course+' soru '+no+': doğru, yanlış veya boş sayısı okunamadı.');
        if(D+Y+B>cur.n)fail(cur.course+' soru '+no+': doğru + yanlış + boş öğrenci sayısını aşıyor.');
        const pm=/^%?\s*(\d+(?:[.,]\d+)?)\s*%?$/u.exec(cell('Başarı')),label=cell('Zorluk');
        if(!pm||Math.abs(+pm[1].replace(',','.')-100*D/cur.n)>0.1001)fail(cur.course+' soru '+no+': Başarı yüzdesi doğru sayısıyla uyuşmuyor.');
        if(!label||label.length>24)fail(cur.course+' soru '+no+': zorluk etiketi okunamadı.');
        if(cur.rows.length>=200)fail('Bir derste en fazla 200 soru olabilir.');
        cur.rows.push([Math.round(D/cur.n*10000)/10000,D,Y,B,label]);
      }
    });
  });
  if(cur)fail('Ders sonu (Ortalama satırı) eksik: '+cur.course+'.');
  if(!Object.keys(out.dersler).length)fail('Bu PDF’de Madde Analizi tablosu yok.');
  return out;
}

/* Dictionary-packed storage; replacements are per exam/student/subject/representation, not class. */
const blank=()=>({surum:1,ts:0,labels:[],exams:[],maps:{}});
const dateOK=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/u.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
/* v.zorluk[ek(exam)] = {ad, oturum, ogrenci, ts, ozet:{course:[[code..],..]}|null, madde:{course:[[p,D,Y,B,label],..]}|null} */
function zorlukDogrula(z,fail,str){
  if(z===undefined)return;
  if(!z||typeof z!=='object'||Array.isArray(z)||Object.keys(z).length>60)fail();
  for(const [k,e] of Object.entries(z)){
    if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).sort().join()!=='ad,madde,ogrenci,oturum,ozet,ts'||!str(k,200)||!str(e.ad,160)||k!==ek(e.ad)||!ZOTURUM.includes(e.oturum)||!Number.isSafeInteger(e.ts)||e.ts<0)fail();
    if(e.ozet===null&&e.madde===null)fail();
    if(e.madde===null?e.ogrenci!==null:!Number.isInteger(e.ogrenci)||e.ogrenci<1||e.ogrenci>10000)fail();
    for(const part of ['ozet','madde']){
      const o=e[part];if(o===null)continue;
      if(!o||typeof o!=='object'||Array.isArray(o))fail();
      const cs=Object.entries(o);if(!cs.length||cs.length>20)fail();
      for(const [c,qs] of cs){
        if(!str(c,80)||!/-[TA]$/u.test(c)||!Array.isArray(qs)||!qs.length||qs.length>200)fail();
        for(const q of qs){
          if(!Array.isArray(q))fail();
          if(part==='ozet'){if(!q.length||q.length>10||!q.every(x=>str(x,40)))fail()}
          else if(q.length!==5||typeof q[0]!=='number'||!(q[0]>=0&&q[0]<=1)||![1,2,3].every(i=>Number.isInteger(q[i])&&q[i]>=0&&q[i]<=e.ogrenci)||q[1]+q[2]+q[3]>e.ogrenci||!str(q[4],24))fail();
        }
      }
    }
  }
}
function dogrula(v){
  const fail=()=>{throw new Error('Konu Takibi kaydı geçersiz; mevcut veri korunuyor.')},str=(s,n)=>typeof s==='string'&&s.length>0&&s.length<=n;
  if(!v||v.surum!==1||!Number.isSafeInteger(v.ts)||v.ts<0||!Array.isArray(v.labels)||v.labels.length>10000||!Array.isArray(v.exams)||v.exams.length>100||!v.maps||Array.isArray(v.maps)||typeof v.maps!=='object')fail();
  if(Object.entries(v.maps).length>10000||Object.entries(v.maps).some(([k,n])=>!str(k,180)||!str(n,240)))fail();
  const labels=new Set();for(const l of v.labels){if(!Array.isArray(l)||l.length!==2||typeof l[0]!=='string'||l[0].length>100||!str(l[1],1500))fail();const k=l[0]||key(l[1]);if(labels.has(k))fail();labels.add(k)}
  let count=0;const exams=new Set();
  for(const e of v.exams){
    if(!str(e.ad,160)||exams.has(ek(e.ad))||(e.date!==null&&!dateOK(e.date))||!Array.isArray(e.blocks)||!e.blocks.length)fail();exams.add(ek(e.ad));const bs=new Set();
    for(const b of e.blocks){
      if(!b.student||!str(b.student.name,160)||!str(b.student.no,12)||!/^\d+$/u.test(b.student.no)||!str(b.student.cls,80)||!str(b.course,80)||!/-[TA]$/u.test(b.course)||!['topic','outcome'].includes(b.kind)||!Array.isArray(b.rows)||!b.rows.length||b.rows.length>1000||bs.has(blockKey(b)))fail();bs.add(blockKey(b));
      const rs=new Set();for(const r of b.rows){if(!Array.isArray(r)||r.length!==5||!Number.isInteger(r[0])||r[0]<0||r[0]>=v.labels.length||!countOK(r.slice(1))||rs.has(r[0])||(b.kind==='outcome')!==!!v.labels[r[0]][0])fail();rs.add(r[0]);if(++count>MAX_ROWS)fail()}
    }
  }
  zorlukDogrula(v.zorluk,fail,str);
  if(baytBoyu(JSON.stringify(v))>LIMIT)throw new Error('Konu Takibi alanı doldu. Kaynaklar bölümünden eski sınavları kaldırın.');
  return v;
}
function oku(){try{return {veri:D.konutakibi===undefined?blank():dogrula(JSON.parse(JSON.stringify(D.konutakibi)))}}catch(e){return {veri:null,hata:e.message}}}
const oturumOf=e=>{const t=new Set(Object.keys({...e.ozet,...e.madde}).map(c=>c.endsWith('-T')?'TYT':'AYT'));return t.size>1?'TYT + AYT':[...t][0]};
function mergeZorluk(n,parts){
  for(const p of parts){
    const k=ek(p.ad);n.zorluk=n.zorluk||{};let e=n.zorluk[k];
    if(!e){if(Object.keys(n.zorluk).length>=60)throw new Error('En fazla 60 sınavın zorluk verisi tutulabilir. Kaynaklar bölümünden eskilerini kaldırın.');e={ad:p.ad,oturum:p.oturum,ogrenci:null,ts:0,ozet:null,madde:null};n.zorluk[k]=e}
    // The same exam's file again replaces that part (özet or madde analizi); the other part stays.
    e.ad=p.ad;e[p.tur]=p.dersler;if(p.tur==='madde')e.ogrenci=p.ogrenci;e.oturum=oturumOf(e);e.ts=Date.now();
  }
}
function merge(v,reports,zparts=[]){
  const n=JSON.parse(JSON.stringify(v)),labels=new Map(n.labels.map((l,i)=>[l[0]||key(l[1]),i]));
  const people=new Map(n.exams.flatMap(e=>e.blocks.map(b=>[studentKey(b.student),key(b.student.name)])));
  for(const r of reports){
    if(!r||!Array.isArray(r.blocks)||!r.blocks.length)throw new Error('Boş rapor eklenemez.');
    let e=n.exams.find(e=>ek(e.ad)===ek(r.ad));if(!e){e={ad:r.ad,date:null,blocks:[]};n.exams.push(e)}
    for(const b of r.blocks){
      const sk=studentKey(b.student),name=key(b.student.name);
      if(people.has(sk)&&people.get(sk)!==name)throw new Error('Aynı şube ve öğrenci numarası farklı adlarla kayıtlı. PDF kimliğini kontrol edin; dosya eklenmedi.');people.set(sk,name);
      const rows=b.rows.map(r=>{const k=r.code||key(r.name);let i=labels.get(k);if(i===undefined){i=n.labels.length;labels.set(k,i);n.labels.push([r.code,r.name])}return [i,...r.c]});
      const newB={student:{...b.student},course:b.course,kind:b.kind,rows},i=e.blocks.findIndex(x=>blockKey(x)===blockKey(newB));
      if(i<0)e.blocks.push(newB);else e.blocks[i]=newB;
    }
  }
  mergeZorluk(n,zparts);
  n.ts=Math.max(Date.now(),v.ts+1);return dogrula(compact(n));
}
function compact(v){
  const used=new Map();for(const e of v.exams)for(const b of e.blocks)for(const r of b.rows){if(!used.has(r[0]))used.set(r[0],used.size)}
  const labels=[...used.keys()].map(i=>v.labels[i]);for(const e of v.exams)for(const b of e.blocks)for(const r of b.rows)r[0]=used.get(r[0]);v.labels=labels;return v;
}
const readonly=()=>typeof yalnizcaGoruntuleme==='function'&&yalnizcaGoruntuleme();
function canWrite(){if(!rehberMi()||readonly())throw new Error('Yalnızca düzenleme yetkisi olan rehber öğretmen değiştirebilir.')}
let saving=false;
async function write(v,owner=D,previous=D.konutakibi){
  canWrite();if(saving||D!==owner||D.konutakibi!==previous)throw new Error('Defter değişti. İşlemi yeniden deneyin.');dogrula(v);
  const next={...D,konutakibi:v};if(baytBoyu(JSON.stringify(next))>DEFTER_HAM_UST_SINIR&&baytBoyu(JSON.stringify(next))>baytBoyu(JSON.stringify(D)))throw new Error('Defterin bulut yedeği sınırı doldu. Ayarlar → Defter boyutu bölümüne bakın.');
  saving=true;D.konutakibi=v;
  try{if(!await kaydet(true))throw new Error('Kaydedilemedi; önceki kayıt korundu.')}
  catch(e){if(owner.konutakibi===v){if(previous===undefined)delete owner.konutakibi;else owner.konutakibi=previous}throw e}
  finally{saving=false}
}
async function ekle(reports,owner=D,previous=D.konutakibi,zparts=[]){canWrite();const o=oku();if(o.hata)throw new Error(o.hata);return write(merge(o.veri,reports,zparts),owner,previous)}
async function change(fn){canWrite();const {veri,hata}=oku();if(hata)throw new Error(hata);fn(veri);veri.ts=Math.max(Date.now(),veri.ts+1);await write(compact(veri))}
const tarihKaydet=(ad,date)=>change(v=>{const e=v.exams.find(e=>ek(e.ad)===ad);if(!e)throw new Error('Sınav bulunamadı.');if(date!==null&&!dateOK(date))throw new Error('Tarih geçersiz.');e.date=date});
const sinavSil=ad=>change(v=>{v.exams=v.exams.filter(e=>ek(e.ad)!==ad)});
const zorlukSil=k=>change(v=>{if(!v.zorluk?.[k])throw new Error('Zorluk verisi bulunamadı.');delete v.zorluk[k];if(!Object.keys(v.zorluk).length)delete v.zorluk});
const esle=(course,code,name)=>change(v=>{if(!v.labels.some(l=>l[0]===code)||!clean(name))throw new Error('Konu adı gerekli.');v.maps[course+'|'+code]=topicName(name)});

/* Running rates use integer evidence, never the average of percentages. Undated results are
   included in the total, but no chronology/delta is invented for them. Same-day exams form one step. */
function examDate(e,school=[]){
  if(e.date)return e.date;
  const matches=school.filter(s=>ek(s.ad)===ek(e.ad)),dates=new Set();
  for(const s of matches){const ds=s.tarih?[s.tarih]:[s.T?.tarih,s.F?.tarih].filter(Boolean);for(const d of ds){const m=/^(\d{2})\.(\d{2})\.(\d{4})$/u.exec(d);if(m&&dateOK(m[3]+'-'+m[2]+'-'+m[1]))dates.add(m[3]+'-'+m[2]+'-'+m[1])}}
  return dates.size===1?[...dates][0]:null;
}
/* Difficulty. A question's difficulty is the school's own success rate p; a correct answer earns 1 - p and a wrong or blank
   answer costs p, so over a set of questions: fark = doğru - beklenen with beklenen = sum of p. Units are questions.
   z = {b: beklenen, d: doğru, n: questions counted, s: [pupil ids]}. Rows whose question count does not match have no z. */
function zorlukIndex(zorluk){
  const out=new Map();
  for(const [k,e] of Object.entries(zorluk||{})){
    const courses=new Map(),bad=[],mk=o=>new Map(Object.entries(o||{}).map(([c,q])=>[key(c),{c,q}])),oz=mk(e.ozet),md=mk(e.madde);
    if(e.ozet&&e.madde){
      for(const [ck,{c,q}] of oz){
        const m=md.get(ck);
        if(!m||m.q.length!==q.length){bad.push(c);continue}
        const qs=q.map((codes,i)=>({no:i+1,codes,p:m.q[i][0],d:m.q[i][1],y:m.q[i][2],b:m.q[i][3],label:m.q[i][4]})),byCode=new Map();
        for(const x of qs)for(const code of x.codes){if(!byCode.has(code))byCode.set(code,[]);byCode.get(code).push(x)}
        courses.set(ck,{course:c,qs,byCode});
      }
      for(const [ck,{c}] of md)if(!oz.has(ck))bad.push(c);
    }
    out.set(k,{courses,bad,ozet:!!e.ozet,madde:!!e.madde});
  }
  return out;
}
const zAdd=(a,b)=>!a?(b?{...b,s:[...b.s]}:null):!b?a:{b:a.b+b.b,d:a.d+b.d,n:a.n+b.n,s:[...new Set([...a.s,...b.s])]};
const zFin=(z,exams,of,skipped)=>z?{...z,fark:z.d-z.b,ns:z.s.length,exams,of,skipped}:null;
// A student's kazanım row has difficulty only when its question total equals the number of questions carrying the code.
function rowZ(zc,code,c,sid){
  const qs=zc.byCode.get(code);
  if(!qs||qs.length!==c[0])return {z:null,qs:null};
  return {z:{b:qs.reduce((a,q)=>a+q.p,0),d:c[1],n:qs.length,s:[sid]},qs};
}
function history(records){
  const total=records.reduce((a,r)=>sum(a,r.c),zero()),dated=records.filter(r=>r.date&&r.c[0]>0).sort((a,b)=>a.date.localeCompare(b.date)||a.ad.localeCompare(b.ad,'tr'));
  const points=[];for(const r of dated){let p=points.at(-1);if(!p||p.date!==r.date){p={date:r.date,ad:r.ad,c:zero(),exams:[]};points.push(p)}p.c=sum(p.c,r.c);p.exams.push(r);p.ad=p.exams.map(x=>x.ad).join(' + ')}
  let acc=zero();for(const p of points){acc=sum(acc,p.c);p.running=[...acc];p.rate=percent(acc);p.examRate=percent(p.c);p.z=zFin(p.exams.reduce((a,r)=>zAdd(a,r.z),null),p.exams.filter(r=>r.z).length,p.exams.length,p.exams.reduce((a,r)=>a+(r.zs||0),0))}
  const missing=records.filter(r=>!r.date&&r.c[0]>0).length,zr=records.filter(r=>r.z),z=zFin(records.reduce((a,r)=>zAdd(a,r.z),null),zr.length,records.length,records.reduce((a,r)=>a+(r.zs||0),0));
  return {total,rate:percent(total),points,missing,delta:!missing&&points.length>1?points.at(-1).rate-points[0].rate:null,z,zskip:records.reduce((a,r)=>a+(r.zs||0),0)};
}
const MG='MATEMATİK+GEOMETRİ';
const gradeOf=c=>{const m=/(?:^|[^\d])(9|1[012])\s*[/\-]\s*[A-ZÇĞİÖŞÜ]/u.exec(c||'');return m?+m[1]:null};
const SIRA=[['soru','En çok soru'],['dusen','Düşenler'],['yukselen','Yükselenler'],['son','Son denemede iyi'],['zayif','Zorluğa göre zayıf'],['guclu','Zorluğa göre güçlü'],['ad','Ada göre (A–Z)']];
const lastPoint=t=>t.points.at(-1)||null;
// Missing values (null) always sort last, whatever the direction.
const by=(get,dir)=>(a,b)=>{const x=get(a),y=get(b);return x===null||x===undefined?(y===null||y===undefined?0:1):y===null||y===undefined?-1:dir*(x-y)};
const ORDER={
  soru:[by(t=>t.total[0],-1)],
  dusen:[by(t=>t.delta,1)],
  yukselen:[by(t=>t.delta,-1)],
  son:[by(t=>lastPoint(t)?.examRate,-1),by(t=>lastPoint(t)?.c[0],-1)],
  zayif:[by(t=>t.z?t.z.fark:null,1)],
  guclu:[by(t=>t.z?t.z.fark:null,-1)],
  ad:[]
};
const order=(list,sira)=>[...list].sort((a,b)=>{for(const f of ORDER[sira]||ORDER.soru){const r=f(a,b);if(r)return r}return a.name.localeCompare(b.name,'tr')});
function model(v,selection={},school=[]){
  const students=[...new Map(v.exams.flatMap(e=>e.blocks.map(b=>[studentKey(b.student),b.student]))).entries()].map(([id,s])=>({...s,id})).sort((a,b)=>a.name.localeCompare(b.name,'tr'));
  const classes=[...new Set(students.map(s=>s.cls))].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));
  // Open on the class with the most loaded exams (a TYT and an AYT exam are two), then the most pupils, then name.
  const examCount=c=>new Set(v.exams.flatMap(e=>e.blocks.filter(b=>b.student.cls===c).map(b=>JSON.stringify([e.ad,b.course.slice(-2)])))).size;
  const richest=[...classes].sort((a,b)=>examCount(b)-examCount(a)||students.filter(s=>s.cls===b).length-students.filter(s=>s.cls===a).length)[0];
  const cls=classes.includes(selection.cls)?selection.cls:richest,ss=students.filter(s=>s.cls===cls);
  // Views: one pupil, the whole class (default) or every class of the same grade. Never mixes grades.
  const grade=gradeOf(cls),gradeStudents=grade?students.filter(s=>gradeOf(s.cls)===grade):[],one=ss.find(s=>s.id===selection.student);
  const scope=one?'student':selection.student==='*sinif'&&grade?'grade':'class',student=one||null;
  const ids=new Set((scope==='student'?[one]:scope==='grade'?gradeStudents:ss).map(s=>s.id));
  const blocks=v.exams.flatMap(e=>e.blocks.filter(b=>ids.has(studentKey(b.student))).map(b=>({...b,ad:e.ad,date:examDate(e,school)})));
  const index=new Map();for(const b of blocks){const k=JSON.stringify([ek(b.ad),b.course]);if(!index.has(k))index.set(k,[]);index.get(k).push(b)}
  const blocksOf=(e,part)=>index.get(JSON.stringify([ek(e.ad),part]))||[];
  const courses=[...new Set(blocks.map(b=>b.course))].sort((a,b)=>a.localeCompare(b,'tr'));
  const sessions=['TYT','AYT'].filter(s=>courses.some(c=>c.endsWith(s==='TYT'?'-T':'-A'))),session=sessions.includes(selection.session)?selection.session:sessions[0];
  const sfx=session==='TYT'?'-T':'-A',cs=courses.filter(c=>c.endsWith(sfx)),pick=n=>cs.find(c=>key(c)===key(n+sfx));
  // "Matematik + Geometri" is offered only when both subjects exist for this session; the separate ones stay.
  const merged=pick('MATEMATİK')&&pick('GEOMETRİ')?MG+sfx:null,options=merged?[merged,...cs]:cs;
  const course=options.includes(selection.course)?selection.course:options[0],parts=course===merged?[pick('MATEMATİK'),pick('GEOMETRİ')]:[course];
  // Exams in this session and how many included pupils have each (one pupil = no count shown).
  const sessionExams=v.exams.map(e=>({ad:e.ad,n:new Set(blocks.filter(b=>ek(b.ad)===ek(e.ad)&&b.course.endsWith(sfx)).map(b=>studentKey(b.student))).size})).filter(x=>x.n);
  const sira=SIRA.some(s=>s[0]===selection.sira)?selection.sira:'soru';
  const topics=new Map(),unknown=new Map(),zi=zorlukIndex(v.zorluk),zExams=new Set(),zBad=new Set();let zTot=null,zSkip=0;
  for(const e of v.exams){
    const combined=new Map(),zx=zi.get(ek(e.ad));
    // Per pupil and subject the summary/detail rule applies once; only then are pupils and subjects added up.
    for(const sid of ids)for(const part of parts){
      const bs=blocksOf(e,part).filter(b=>studentKey(b.student)===sid),detail=bs.find(b=>b.kind==='outcome'),summary=bs.find(b=>b.kind==='topic'),groups=new Map(),zc=zx?.courses.get(key(part));
      if(bs.length&&zx?.bad.some(c=>key(c)===key(part)))zBad.add(part);
      const get=n=>{const id=key(n);if(!groups.has(id))groups.set(id,{name:topicName(n),detail:[],summary:null});return groups.get(id)};
      if(summary)for(const r of summary.rows)get(v.labels[r[0]][1]).summary=r.slice(1);
      if(detail)for(const r of detail.rows){const [code,name]=v.labels[r[0]],topic=topicFor(part,code,v.maps);if(!topic){unknown.set(part+'|'+code,{code,name,course:part});continue}const c=r.slice(1),rz=zc&&c[0]?rowZ(zc,code,c,sid):{z:null,qs:null};get(topic).detail.push({code,name,c,z:rz.z,qs:rz.qs,zs:zc&&c[0]&&!rz.z?1:0})}
      for(const [id,g] of groups){
        const dc=g.detail.reduce((a,r)=>sum(a,r.c),zero()),c=g.summary||dc;if(!c[0])continue;
        // Difficulty: from the detail rows when they exist; otherwise the topic summary against the questions mapped to the topic.
        let z=null,zs=0;
        if(zc){
          if(g.detail.length){for(const r of g.detail){z=zAdd(z,r.z);zs+=r.zs}}
          else{const qs=zc.qs.filter(q=>q.codes.some(cd=>{const t=topicFor(part,cd,v.maps);return t&&key(t)===id}));if(qs.length===g.summary[0])z={b:qs.reduce((a,q)=>a+q.p,0),d:g.summary[1],n:qs.length,s:[sid]};else zs=1}
        }
        // The same topic name in both subjects is one topic: one record per exam, counts summed once.
        let x=combined.get(id);if(!x){x={name:g.name,c:zero(),detail:new Map(),mismatch:false,z:null,zs:0};combined.set(id,x)}
        x.c=sum(x.c,c);x.z=zAdd(x.z,z);x.zs+=zs;if(!!g.summary&&!!g.detail.length&&!same(dc,g.summary))x.mismatch=true;
        for(const r of g.detail){const o=x.detail.get(r.code);x.detail.set(r.code,o?{...o,c:sum(o.c,r.c),z:zAdd(o.z,r.z),qs:o.qs||r.qs,zs:o.zs+r.zs}:{code:r.code,name:r.name,c:r.c,z:r.z,qs:r.qs,zs:r.zs})}
      }
    }
    for(const [id,g] of combined){
      let t=topics.get(id);if(!t){t={id,name:g.name,records:[],outcomes:new Map(),conflicts:0};topics.set(id,t)}
      const date=examDate(e,school);t.records.push({ad:e.ad,date,c:g.c,z:g.z,zs:g.zs});if(g.mismatch)t.conflicts++;
      if(g.z){zExams.add(e.ad);zTot=zAdd(zTot,g.z)}zSkip+=g.zs;
      // Keep detailed evidence visible even if its scope differs, but label that scope explicitly.
      for(const r of g.detail.values()){let o=t.outcomes.get(r.code);if(!o){o={code:r.code,name:r.name,records:[]};t.outcomes.set(r.code,o)}o.records.push({ad:e.ad,date,c:r.c,z:r.z,qs:r.qs,zs:r.zs})}
    }
  }
  /* Subject line: counts come from the subject blocks, not from the topic list. Publisher outcome rows can map one
     question to several outcomes, so the topic-summary block is used when present; otherwise the detail rows, whose
     printed subject total equals their row sum (checked by pdfCoz). */
  let ozetC=zero(),ozetN=0;const ozetS=new Set();
  for(const e of v.exams){
    let any=false;
    for(const sid of ids)for(const part of parts){
      const bs=blocksOf(e,part).filter(b=>studentKey(b.student)===sid),src=bs.find(b=>b.kind==='topic')||bs.find(b=>b.kind==='outcome');
      if(src){ozetC=src.rows.reduce((a,r)=>sum(a,r.slice(1)),ozetC);any=true;ozetS.add(sid)}
    }
    if(any)ozetN++;
  }
  return {classes,students:ss,student,scope,grade,gradeCount:gradeStudents.length,view:scope==='student'?student.id:scope==='grade'?'*sinif':'*sube',cls,sessions,session,courses:options,course,parts,sira,sessionExams,unknown:[...unknown.values()],summary:ozetN?{exams:ozetN,students:ozetS.size,c:ozetC}:null,
    zorluk:{z:zFin(zTot,zExams.size,ozetN,zSkip),skipped:zSkip,bad:[...zBad]},
    topics:order([...topics.values()].map(t=>{const outcomes=order([...t.outcomes.values()].map(o=>({...o,...history(o.records),sorular:o.records.filter(r=>r.qs).map(r=>({ad:r.ad,qs:r.qs.map(q=>({no:q.no,p:q.p}))}))})),sira);const rates=outcomes.map(o=>o.rate).filter(x=>x!==null);return {...t,...history(t.records),outcomes,range:rates.length>1?[Math.min(...rates),Math.max(...rates)]:null}}),sira)};
}

/* One pupil at a time, no ranks or peer comparisons. Same evidence and scale in every drilldown. */
const f=n=>n===null?'—':n.toLocaleString('tr-TR',{maximumFractionDigits:1});
const pct=n=>n===null?'—':'%'+f(n);
const diff=n=>n===null?'—':(n>0?'+':'')+f(n)+' puan';
// Questions (soru), one decimal, "0" instead of "-0"; the sign carries the direction.
const sg=n=>{const r=Math.round(n*10)/10;return r===0?'0':(r>0?'+':'')+f(r)};
const zYon=n=>{const r=Math.round(n*10)/10;return r>0?'up':r<0?'down':'eq'};
const dateLabel=d=>d?d.split('-').reverse().join('.'):'Tarih gerekli';
const h=s=>kacis(String(s??''));
const schoolExams=()=>{try{return SIRALAMA.oku().veri?.sinavlar||[]}catch{return []}};
let charts=[],busy=false,message='',frame=0;
function graph(hist,name){const i=charts.push({hist,name})-1;return '<div class="kt-chart" data-kt-chart="'+i+'"></div>'}
function draw(hist,name,w){
  const ps=hist.points,W=Math.max(160,w),H=230,L=42,R=22,T=23,B=36,x=i=>ps.length===1?(L+W-R)/2:L+i*(W-L-R)/(ps.length-1),y=v=>H-B-v*(H-T-B)/100;
  if(!ps.length)return '<p class="kt-muted">Grafik için Kaynaklar bölümünden sınav tarihini girin.</p>';
  const lines=[['rate','kt-line'],['examRate','kt-line kt-exam-line']].map(([k,c])=>'<polyline class="'+c+'" points="'+ps.map((p,i)=>x(i)+','+y(p[k])).join(' ')+'"/>').reverse().join('');
  return '<svg width="'+W+'" height="'+H+'" role="img" aria-label="'+h(name+'; kümülatif doğru yüzdesi ve her denemenin doğru yüzdesi. Değerler aşağıdaki tabloda.')+'">'+
    [0,25,50,75,100].map(v=>'<line class="kt-grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="kt-axis" text-anchor="end" x="'+(L-10)+'" y="'+(y(v)+4)+'">'+v+'</text>').join('')+lines+
    ps.map((p,i)=>'<circle class="kt-dot kt-exam-dot" cx="'+x(i)+'" cy="'+y(p.examRate)+'" r="3"/><circle class="kt-dot" cx="'+x(i)+'" cy="'+y(p.rate)+'" r="4"><title>'+h(p.ad+' · '+dateLabel(p.date)+' · Kümülatif '+pct(p.rate)+' · Bu denemede '+pct(p.examRate))+'</title></circle>'+((ps.length<=5||i===0||i===ps.length-1)?'<text class="kt-value" text-anchor="'+(i===0?'start':i===ps.length-1?'end':'middle')+'" x="'+x(i)+'" y="'+(y(p.rate)-11)+'">'+f(p.rate)+'</text>':'')+((ps.length<=3||i===0||i===ps.length-1)?'<text class="kt-axis" text-anchor="'+(i===0?'start':i===ps.length-1?'end':'middle')+'" x="'+x(i)+'" y="'+(H-10)+'">'+h(dateLabel(p.date).slice(0,5))+'</text>':'')).join('')+'</svg>';
}
function drawAll(){if(!active())return;for(const el of document.querySelectorAll('#ktKok [data-kt-chart]')){if(!el.getClientRects().length)continue;const c=charts[+el.dataset.ktChart];if(c)el.innerHTML=draw(c.hist,c.name,el.clientWidth)}}
function planDraw(){if(!window.requestAnimationFrame)return;window.cancelAnimationFrame(frame);frame=window.requestAnimationFrame(drawAll)}
window.addEventListener('resize',planDraw);
document.addEventListener('toggle',ev=>{if(ev.target.closest?.('#ktKok'))planDraw()},true);
function historyHTML(t){
  const zc=!!t.z,zh=zc?'<th>Beklenen doğru</th><th>Zorluğa göre</th>':'',zx=z=>zc?(z?'<td>'+f(z.b)+'</td><td>'+sg(z.fark)+' soru</td>':'<td>—</td><td>—</td>'):'';
  const legend='<div class="kt-legend"><span><i></i>Kümülatif</span><span><i class="kt-dashed"></i>Bu Denemede</span></div>';
  const table='<div class="kt-table-wrap"><table><thead><tr><th>Deneme</th><th>Doğru / Toplam</th><th>Bu Denemede</th><th>Kümülatif</th><th>Değişim</th>'+zh+'</tr></thead><tbody>'+t.points.map((p,i)=>'<tr><th scope="row">'+h(p.ad)+'<span class="kt-muted">'+dateLabel(p.date)+'</span></th><td>'+p.c[1]+' / '+p.c[0]+'</td><td>'+pct(p.examRate)+'</td><td>'+pct(p.rate)+'</td><td>'+diff(i?p.rate-t.points[i-1].rate:null)+'</td>'+zx(p.z)+'</tr>').join('')+t.records.filter(r=>!r.date).map(r=>'<tr><th scope="row">'+h(r.ad)+'<span class="kt-warning">Tarih gerekli</span></th><td>'+r.c[1]+' / '+r.c[0]+'</td><td>'+pct(percent(r.c))+'</td><td>—</td><td>—</td>'+zx(r.z&&zFin(r.z,1,1,0))+'</tr>').join('')+'</tbody></table></div>';
  return (t.missing?'<p class="kt-warning">Tarihi eksik '+t.missing+' sınav toplama dahil; grafikte yer almıyor.</p>':'')+legend+graph(t,t.name)+table+zNote(t);
}
// Difficulty figures under a history table: the sum behind the number, coverage, and rows that could not be matched.
function zNote(t){
  if(!t.z&&!t.zskip)return '';
  return (t.z?'<p class="kt-muted">Doğru '+t.z.d+' − beklenen '+f(t.z.b)+' = zorluğa göre '+sg(t.z.fark)+' soru'+(t.z.exams<t.z.of?' · zorluk verisi '+t.z.exams+'/'+t.z.of+' denemede':'')+'</p>':'')+(t.zskip?'<p class="kt-muted">Zorluk eşleşmedi: '+t.zskip+' kazanım satırı hesaba katılmadı</p>':'');
}
function zCell(t,ctx){
  if(!ctx.hasZ)return '';
  if(!t.z)return '<span class="kt-zcell kt-muted">Zorluk verisi yok</span>';
  return '<span class="kt-zcell"><span class="kt-z kt-z-'+zYon(t.z.fark)+'">Zorluğa göre '+sg(t.z.fark)+' soru</span>'+(ctx.scope!=='student'?'<span class="kt-muted">öğrenci başına '+sg(t.z.fark/t.z.ns)+'</span>':'')+'</span>';
}
// Questions of a kazanım as small chips: question number and the school's success rate ("S26 %7").
function chips(o){
  return (o.sorular||[]).map(x=>'<div class="kt-qs"><span class="kt-muted">'+h(x.ad)+' · sorular</span><span class="kt-chips">'+x.qs.map(q=>{const pc=Math.round(q.p*100);return '<span class="kt-chip kt-chip-'+(q.p<.25?'zor':q.p>=.75?'kolay':'orta')+'" title="'+h('Soru '+q.no+': okulda %'+f(q.p*100)+' doğru')+'">S'+q.no+' %'+pc+'</span>'}).join('')+'</span></div>').join('');
}
function rateBar(t){return '<span class="kt-bar" aria-hidden="true"><i style="width:'+Math.max(0,Math.min(100,t.rate||0))+'%"></i></span>'}
// Shown on every row while "Son denemede iyi" is active, so the order can be checked by eye.
function lastLabel(t,sira){if(sira!=='son')return '';const p=lastPoint(t);return '<span class="kt-muted kt-last">'+(p?'Son deneme '+pct(p.examRate)+' · '+p.c[1]+'/'+p.c[0]:'Son deneme · tarihli kayıt yok')+'</span>'}
function topicHTML(t,sira,ctx={}){
  return '<details class="kt-topic"><summary><span class="kt-topic-name">'+h(t.name)+'<span class="kt-muted">'+t.total[1]+' / '+t.total[0]+' doğru · '+t.records.length+' deneme</span>'+lastLabel(t,sira)+'</span>'+rateBar(t)+'<strong>'+pct(t.rate)+'</strong><span class="kt-change">'+diff(t.delta)+'</span>'+zCell(t,ctx)+'</summary><div class="kt-detail">'+
    '<div class="kt-section-title"><h2>Kümülatif Değişim</h2><span class="kt-muted">İlk kayıttan bugüne '+diff(t.delta)+'</span></div>'+
    historyHTML(t)+
    '<div class="kt-section-title"><h2>Kazanımlar</h2>'+(t.range?'<span class="kt-range">'+pct(t.range[0])+' – '+pct(t.range[1])+'</span>':'')+'</div>'+
    (t.conflicts?'<p class="kt-warning">'+t.conflicts+' sınavda konu özeti ile kazanım toplamı farklı. Konu oranı özet PDF’den; kazanımlar kendi kayıtlarından hesaplandı.</p>':'')+
    (t.outcomes.length?t.outcomes.map(o=>'<details class="kt-outcome"><summary><span>'+h(o.name)+'<span class="kt-muted">'+h(o.code)+' · '+o.total[1]+' / '+o.total[0]+' doğru</span>'+lastLabel(o,sira)+'</span>'+rateBar(o)+'<strong>'+pct(o.rate)+'</strong>'+zCell(o,ctx)+'</summary><div class="kt-detail">'+chips(o)+historyHTML(o)+'</div></details>').join(''):'<p class="kt-muted">Bu konu için kazanım ayrıntısı yüklenmedi.</p>')+'</div></details>';
}
// Per exam: which of the two difficulty files are loaded, and whether they match question for question.
function zorlukSatiri(v,zi,k){
  const e=v.zorluk?.[k],x=zi.get(k),bad=x?.bad||[];
  return '<div class="kt-zline"><span>Zorluk: özet '+(e?.ozet?'✓':'yok')+' · madde analizi '+(e?.madde?'✓':'yok')+'</span>'+(bad.length?'<span class="kt-warning">Zorluk verisi uyuşmuyor: '+h(bad.map(courseLabel).join(', '))+'</span>':'')+
    (e&&!readonly()?'<button type="button" class="et-dugme" data-kt-zdelete="'+h(k)+'"'+(busy?' disabled':'')+'>Zorluk verisini kaldır</button>':'')+'</div>';
}
function sources(v,school){
  const zi=zorlukIndex(v.zorluk),only=Object.keys(v.zorluk||{}).filter(k=>!v.exams.some(e=>ek(e.ad)===k));
  if(!v.exams.length&&!only.length)return '';
  return '<details class="kt-sources"'+(v.exams.some(e=>!examDate(e,school))?' open':'')+'><summary>Kaynaklar · '+(v.exams.length+only.length)+' Deneme</summary><div class="kt-source-list">'+v.exams.map(e=>{
    const date=examDate(e,school),students=new Set(e.blocks.map(b=>studentKey(b.student))).size,kind=[...new Set(e.blocks.map(b=>b.kind))].map(k=>k==='topic'?'Konu özeti':'Kazanım ayrıntısı').join(' + '),
      sessions=['TYT','AYT'].filter(x=>e.blocks.some(b=>b.course.endsWith(x==='TYT'?'-T':'-A'))).join(' + '),classes=[...new Set(e.blocks.map(b=>classOf(b.student.cls)))].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true})).join(', ');
    return '<div class="kt-source"><div><b>'+h(e.ad)+'</b><span class="kt-muted">'+sessions+' · '+h(classes)+' · '+students+' öğrenci · '+kind+'</span></div><label>Sınav Tarihi'+(readonly()?'<b>'+dateLabel(date)+'</b>':'<input type="date" data-kt-date="'+h(ek(e.ad))+'" value="'+h(date||'')+'" aria-label="'+h(e.ad+' sınav tarihi')+'"'+(busy?' disabled':'')+'>')+'</label>'+(!readonly()?'<button type="button" class="et-dugme" data-kt-delete="'+h(ek(e.ad))+'"'+(busy?' disabled':'')+'>Kaldır</button>':'')+zorlukSatiri(v,zi,ek(e.ad))+'</div>';
  }).join('')+only.map(k=>{const e=v.zorluk[k];return '<div class="kt-source"><div><b>'+h(e.ad)+'</b><span class="kt-muted">'+e.oturum+' · kazanım haritası yüklenmedi</span></div>'+zorlukSatiri(v,zi,k)+'</div>'}).join('')+'</div></details>';
}
const classOf=c=>/(?:9|1[012])\s*[/\-]\s*[A-ZÇĞİÖŞÜ]\S*/u.exec(c)?.[0]||c;
const examsText=m=>m.sessionExams.length?m.session+': '+m.sessionExams.slice(0,6).map(x=>m.scope==='student'?x.ad:x.ad+' ('+x.n+')').join(', ')+(m.sessionExams.length>6?' +'+(m.sessionExams.length-6):''):'';
const nf=n=>n.toLocaleString('tr-TR');
const courseLabel=c=>c&&c.startsWith(MG)?'Matematik + Geometri':title((c||'').replace(/-[TA]$/u,''));
// Difficulty part of the subject line: sum over the listed topics (same occurrences as their own figures).
function zSummary(m){
  const z=m.zorluk?.z;if(!z)return '';
  return ' · zorluğa göre '+sg(z.fark)+' soru (beklenen '+f(z.b)+')'+(m.scope!=='student'?' · öğrenci başına '+sg(z.fark/z.ns):'')+(z.exams<z.of?' (zorluk verisi '+z.exams+'/'+z.of+' denemede)':'');
}
function summaryText(m){
  const s=m.summary;if(!s)return '';
  const lead=m.scope==='student'?courseLabel(m.course):(m.scope==='grade'?'Tüm '+m.grade+'. sınıflar':'Tüm şube')+' · '+s.students+' öğrenci';
  return lead+' · '+s.exams+' deneme · '+nf(s.c[0])+' soru · '+nf(s.c[1])+' doğru ('+pct(percent(s.c))+')'+zSummary(m)+(s.exams===1&&!readonly()?' · geçmiş için başka denemelerin haritalarını yükleyin':'');
}
function select(label,field,options,value){return '<label class="kt-select">'+label+'<select data-kt-filter="'+field+'">'+options.map(([id,n])=>'<option value="'+h(id)+'"'+(id===value?' selected':'')+'>'+h(n)+'</option>').join('')+'</select></label>'}
function content(){
  charts=[];const {veri:v,hata}=oku(),school=schoolExams();
  const top='<div class="kt-header"><div class="et-bas"><h1 class="et-baslik">Konu Takibi</h1><p class="kt-muted">Denemeler boyunca biriken doğru cevap yüzdesi</p>'+(!readonly()&&!hata?'<p class="kt-muted">Yüklenecek dosyalar: kazanım haritası (PDF) · Madde Analizi (PDF) · sınav özeti (Excel)</p>':'')+'</div>'+(!readonly()&&!hata?'<label class="et-dugme birincil">'+(busy?'Dosya Okunuyor…':'Dosya Yükle')+'<input id="ktPdf" type="file" accept="application/pdf,.pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple class="kt-file"'+(busy?' disabled':'')+'></label>':'')+'</div><p id="ktStatus" role="status" aria-live="polite">'+h(message)+'</p>';
  if(hata)return top+'<p class="kt-warning">'+h(hata)+'</p>';
  if(!v.exams.length)return top+'<div class="et-panel et-bos"><h2>Konuların gelişimini görün</h2><p>Tek bir denemenin kazanım haritasını yükleyin. Yeni denemeler eklendikçe konu ve kazanım grafikleri büyür.</p></div>'+sources(v,school);
  const m=model(v,{...EK.ktSelection,sira:EK.ktSira},school);EK.ktSelection={cls:m.cls,student:m.view,session:m.session,course:m.course};EK.ktSira=m.sira;
  const ctx={scope:m.scope,hasZ:m.topics.some(t=>t.z)};
  const filters='<div class="kt-filters">'+select('Şube','cls',m.classes.map(c=>[c,c]),m.cls)+select('Öğrenci','student',[['*sube','Tüm şube ('+m.students.length+' öğrenci)'],...(m.grade?[['*sinif','Tüm '+m.grade+'. sınıflar ('+m.gradeCount+' öğrenci)']]:[]),...m.students.map(s=>[s.id,title(s.name)+' · '+s.no])],m.view)+(m.sessions.length>1?select('Oturum','session',m.sessions.map(s=>[s,s]),m.session):'<div class="kt-select">Oturum<b class="kt-fixed">'+h(m.session||'')+'</b></div>')+select('Ders','course',m.courses.map(c=>[c,courseLabel(c)]),m.course)+'</div>';
  const unknown=m.unknown.length?'<details class="kt-sources"><summary>'+m.unknown.length+' Kazanımın Konusu Eşleştirilmeli</summary><p class="kt-muted">Bu kazanımlar konu başlıklarına bağlanmadı. Konu özeti varsa toplamları kullanılmaya devam eder.</p>'+m.unknown.map((u,i)=>'<form class="kt-mapping" data-kt-code="'+h(u.code)+'" data-kt-course="'+h(u.course)+'"><label for="ktMap'+i+'">'+h(u.name)+'<span class="kt-muted">'+h(u.code)+'</span></label>'+(!readonly()?'<input id="ktMap'+i+'" name="topic" required maxlength="240" placeholder="Konu adı" list="ktTopics"><button class="et-dugme"'+(busy?' disabled':'')+'>Eşleştir</button>':'')+'</form>').join('')+'<datalist id="ktTopics">'+m.topics.map(t=>'<option value="'+h(t.name)+'"></option>').join('')+'</datalist></details>':'';
  const sort='<label class="kt-select kt-sort">Sırala<select data-kt-sort>'+SIRA.map(([id,n])=>'<option value="'+id+'"'+(id===m.sira?' selected':'')+'>'+h(n)+'</option>').join('')+'</select></label>';
  return top+filters+'<div class="kt-list-head"><div class="kt-head-text"><h2>'+h(courseLabel(m.course))+' · '+m.topics.length+' Konu</h2>'+(m.summary?'<p class="kt-muted kt-summary">'+h(summaryText(m))+'</p>':'')+(m.zorluk.bad.length?'<p class="kt-warning">Zorluk verisi uyuşmuyor: '+h(m.zorluk.bad.map(courseLabel).join(', '))+'</p>':'')+(m.zorluk.skipped?'<p class="kt-muted">Zorluk eşleşmedi: '+m.zorluk.skipped+' kazanım satırı hesaba katılmadı</p>':'')+(m.sessionExams.length?'<p class="kt-muted kt-exams">'+h(examsText(m))+'</p>':'')+'<p class="kt-muted">Kümülatif doğru oranı · İlk kayıttan değişim</p></div>'+(m.topics.length?sort:'')+'</div>'+unknown+
    (m.topics.length?'<div class="kt-topics'+(ctx.hasZ?' kt-has-z':'')+'">'+m.topics.map(t=>topicHTML(t,m.sira,ctx)).join('')+'</div>':'<p class="kt-muted">Bu seçim için eşleştirilmiş konu yok.</p>')+sources(v,school)+
    '<details class="kt-sources"><summary>Hesaplama</summary><p>Kümülatif oran = tüm yüklü denemelerdeki doğru toplamı / doğru, yanlış ve boş toplamı. Değişimler yüzde puanıdır. Konunun sorulmadığı deneme sıfır sayılmaz. Aynı tarihteki sınavlar grafikte tek adımda birleşir.</p><p>Zorluğa göre = doğru − beklenen. Beklenen, sorulardaki okul başarı oranlarının (Madde Analizi) toplamıdır: yalnızca %7’sinin doğru yaptığı soruyu kaçırmak 0,07 soru, %93’ünün doğru yaptığı soruyu kaçırmak 0,93 soru düşürür. Birimi sorudur; zorluk verisi olmayan denemeler hesaba katılmaz.</p><p>Yayıncının konu ve kazanım kayıtları kullanılır; bir soru birden fazla kazanımda yer alabilir. Aynı sınavın konu özeti ve kazanım ayrıntısı iki kez sayılmaz.</p></details>';
}
function gorunum(){if(!rehberMi())return '<p>Bu sayfa rehber öğretmen içindir.</p>';planDraw();return '<div id="ktKok">'+content()+'</div>'}
const active=()=>EK.sekme==='konutakibi'&&rehberMi()&&!!document.getElementById('ktKok');
function render(focus){const root=document.getElementById('ktKok');if(!active()||!root)return;root.innerHTML=content();planDraw();if(focus)root.querySelector(focus)?.focus()}
function uploadMessage(reports,errors=[],extra=[]){
  if(!reports.length)return [...extra,...errors].join(' ');
  const exams=new Map(reports.map(r=>[ek(r.ad),r.ad])),pupils=new Set(reports.flatMap(r=>r.blocks.map(b=>studentKey(b.student))));
  return reports.length+' PDF kaydedildi · '+exams.size+' sınav'+(exams.size<=3?' ('+[...exams.values()].join(', ')+')':'')+' · '+pupils.size+' öğrenci. Aynı sınavın tekrarları güncellendi. '+[...extra,...errors].join(' ');
}
// Routes a file by what it is: Excel -> Sınav özeti (or the refused answer report); PDF -> Madde Analizi or kazanım karnesi.
async function dosyaCoz(file){
  if(/\.xlsx$/iu.test(file.name||'')||/spreadsheetml/u.test(file.type||'')){
    if(file.size>15*1024*1024)throw new Error('Excel dosyası en fazla 15 MB olabilir.');
    return {z:await ozetCoz(new Uint8Array(await file.arrayBuffer()))};
  }
  const {pages}=await denemePdfSayfalari(file);
  return pages.some(p=>Array.isArray(p)&&p.some(i=>typeof i?.s==='string'&&/Madde Analizi$/u.test(clean(i.s))))?{z:maddeCoz(pages)}:{rapor:pdfCoz(pages)};
}
const zorlukMesaj=p=>(p.tur==='madde'?'Madde Analizi':'Sınav özeti')+' kaydedildi · '+p.ad+' ('+p.oturum+') · '+Object.keys(p.dersler).length+' ders · '+Object.values(p.dersler).reduce((a,q)=>a+q.length,0)+' soru';
async function pdfEkle(files){
  canWrite();if(files.length>10)throw new Error('Bir defada en fazla 10 dosya seçin.');
  const owner=D,previous=D.konutakibi,reports=[],zparts=[],errors=[];
  for(const file of files){try{const r=await dosyaCoz(file);if(r.rapor)reports.push(r.rapor);else zparts.push(r.z)}catch(e){errors.push(file.name+': '+e.message)}}
  if(D!==owner||D.konutakibi!==previous)throw new Error('Defter değişti; dosyalar kaydedilmedi. Yeniden deneyin.');
  const extra=zparts.map(zorlukMesaj);
  if(reports.length||zparts.length){
    await ekle(reports,owner,previous,zparts);
    // Say so at once when the two difficulty files of an exam do not fit each other.
    const zi=zorlukIndex(oku().veri?.zorluk);
    for(const k of new Set(zparts.map(p=>ek(p.ad)))){const bad=zi.get(k)?.bad||[];if(bad.length)extra.push('Zorluk verisi uyuşmuyor: '+bad.map(courseLabel).join(', ')+'.')}
  }
  return uploadMessage(reports,errors,extra);
}
async function act(fn){if(busy)return;busy=true;message='';render();try{message=await fn()||'Kaydedildi.'}catch(e){message=e.message}finally{busy=false;render()}}
document.addEventListener('change',ev=>{
  if(!active())return;const el=ev.target;
  if(el.matches?.('[data-kt-sort]')){EK.ktSira=SIRA.some(s=>s[0]===el.value)?el.value:'soru';render('[data-kt-sort]');return}
  if(el.dataset.ktFilter){const field=el.dataset.ktFilter;if(!['cls','student','session','course'].includes(field))return;EK.ktSelection={...EK.ktSelection,[field]:el.value};render('[data-kt-filter="'+field+'"]');return}
  if(readonly()||busy)return;
  if(el.id==='ktPdf'){const files=Array.from(el.files||[]);el.value='';if(files.length)act(()=>pdfEkle(files))}
  if(el.dataset.ktDate){const ad=el.dataset.ktDate,date=el.value||null;act(()=>tarihKaydet(ad,date))}
});
document.addEventListener('click',ev=>{
  if(!active()||readonly()||busy)return;
  const el=ev.target.closest?.('[data-kt-delete]'),zel=ev.target.closest?.('[data-kt-zdelete]');
  if(el&&confirm('Bu sınavın Konu Takibi kayıtları kaldırılsın mı? PDF yeniden yüklenebilir.')){const ad=el.dataset.ktDelete;act(()=>sinavSil(ad))}
  if(zel&&confirm('Bu sınavın zorluk verisi (sınav özeti ve Madde Analizi) kaldırılsın mı? Dosyalar yeniden yüklenebilir.')){const k=zel.dataset.ktZdelete;act(()=>zorlukSil(k))}
});
document.addEventListener('submit',ev=>{const form=ev.target;if(!active()||!form.matches?.('.kt-mapping'))return;ev.preventDefault();if(readonly()||busy)return;const {ktCourse,ktCode}=form.dataset,name=form.elements.topic.value;act(()=>esle(ktCourse,ktCode,name))});
return {pdfCoz,ozetCoz,maddeCoz,zorlukIndex,zorlukSil,zipListe,zipDosya,topicFor,topicName,key,ek,studentKey,blockKey,blank,dogrula,oku,merge,compact,examDate,history,model,examsText,order,summaryText,uploadMessage,SIRA,ekle,tarihKaydet,sinavSil,esle,gorunum,pdfEkle,drawAll};
})();
function gorunumKonuTakibi(){return KONU_TAKIBI.gorunum()}
