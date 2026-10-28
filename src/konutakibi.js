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

/* Dictionary-packed storage; replacements are per exam/student/subject/representation, not class. */
const blank=()=>({surum:1,ts:0,labels:[],exams:[],maps:{}});
const dateOK=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/u.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
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
  if(baytBoyu(JSON.stringify(v))>LIMIT)throw new Error('Konu Takibi alanı doldu. Kaynaklar bölümünden eski sınavları kaldırın.');
  return v;
}
function oku(){try{return {veri:D.konutakibi===undefined?blank():dogrula(JSON.parse(JSON.stringify(D.konutakibi)))}}catch(e){return {veri:null,hata:e.message}}}
function merge(v,reports){
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
async function ekle(reports,owner=D,previous=D.konutakibi){canWrite();const o=oku();if(o.hata)throw new Error(o.hata);return write(merge(o.veri,reports),owner,previous)}
async function change(fn){canWrite();const {veri,hata}=oku();if(hata)throw new Error(hata);fn(veri);veri.ts=Math.max(Date.now(),veri.ts+1);await write(compact(veri))}
const tarihKaydet=(ad,date)=>change(v=>{const e=v.exams.find(e=>ek(e.ad)===ad);if(!e)throw new Error('Sınav bulunamadı.');if(date!==null&&!dateOK(date))throw new Error('Tarih geçersiz.');e.date=date});
const sinavSil=ad=>change(v=>{v.exams=v.exams.filter(e=>ek(e.ad)!==ad)});
const esle=(course,code,name)=>change(v=>{if(!v.labels.some(l=>l[0]===code)||!clean(name))throw new Error('Konu adı gerekli.');v.maps[course+'|'+code]=topicName(name)});

/* Running rates use integer evidence, never the average of percentages. Undated results are
   included in the total, but no chronology/delta is invented for them. Same-day exams form one step. */
function examDate(e,school=[]){
  if(e.date)return e.date;
  const matches=school.filter(s=>ek(s.ad)===ek(e.ad)),dates=new Set();
  for(const s of matches){const ds=s.tarih?[s.tarih]:[s.T?.tarih,s.F?.tarih].filter(Boolean);for(const d of ds){const m=/^(\d{2})\.(\d{2})\.(\d{4})$/u.exec(d);if(m&&dateOK(m[3]+'-'+m[2]+'-'+m[1]))dates.add(m[3]+'-'+m[2]+'-'+m[1])}}
  return dates.size===1?[...dates][0]:null;
}
function history(records){
  const total=records.reduce((a,r)=>sum(a,r.c),zero()),dated=records.filter(r=>r.date&&r.c[0]>0).sort((a,b)=>a.date.localeCompare(b.date)||a.ad.localeCompare(b.ad,'tr'));
  const points=[];for(const r of dated){let p=points.at(-1);if(!p||p.date!==r.date){p={date:r.date,ad:r.ad,c:zero(),exams:[]};points.push(p)}p.c=sum(p.c,r.c);p.exams.push(r);p.ad=p.exams.map(x=>x.ad).join(' + ')}
  let acc=zero();for(const p of points){acc=sum(acc,p.c);p.running=[...acc];p.rate=percent(acc);p.examRate=percent(p.c)}
  const missing=records.filter(r=>!r.date&&r.c[0]>0).length;
  return {total,rate:percent(total),points,missing,delta:!missing&&points.length>1?points.at(-1).rate-points[0].rate:null};
}
const MG='MATEMATİK+GEOMETRİ';
const gradeOf=c=>{const m=/(?:^|[^\d])(9|1[012])\s*[/\-]\s*[A-ZÇĞİÖŞÜ]/u.exec(c||'');return m?+m[1]:null};
const SIRA=[['soru','En çok soru'],['dusen','Düşenler'],['yukselen','Yükselenler'],['son','Son denemede iyi'],['ad','Ada göre (A–Z)']];
const lastPoint=t=>t.points.at(-1)||null;
// Missing values (null) always sort last, whatever the direction.
const by=(get,dir)=>(a,b)=>{const x=get(a),y=get(b);return x===null||x===undefined?(y===null||y===undefined?0:1):y===null||y===undefined?-1:dir*(x-y)};
const ORDER={
  soru:[by(t=>t.total[0],-1)],
  dusen:[by(t=>t.delta,1)],
  yukselen:[by(t=>t.delta,-1)],
  son:[by(t=>lastPoint(t)?.examRate,-1),by(t=>lastPoint(t)?.c[0],-1)],
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
  const topics=new Map(),unknown=new Map();
  for(const e of v.exams){
    const combined=new Map();
    // Per pupil and subject the summary/detail rule applies once; only then are pupils and subjects added up.
    for(const sid of ids)for(const part of parts){
      const bs=blocksOf(e,part).filter(b=>studentKey(b.student)===sid),detail=bs.find(b=>b.kind==='outcome'),summary=bs.find(b=>b.kind==='topic'),groups=new Map();
      const get=n=>{const id=key(n);if(!groups.has(id))groups.set(id,{name:topicName(n),detail:[],summary:null});return groups.get(id)};
      if(summary)for(const r of summary.rows)get(v.labels[r[0]][1]).summary=r.slice(1);
      if(detail)for(const r of detail.rows){const [code,name]=v.labels[r[0]],topic=topicFor(part,code,v.maps);if(!topic){unknown.set(part+'|'+code,{code,name,course:part});continue}get(topic).detail.push({code,name,c:r.slice(1)})}
      for(const [id,g] of groups){
        const dc=g.detail.reduce((a,r)=>sum(a,r.c),zero()),c=g.summary||dc;if(!c[0])continue;
        // The same topic name in both subjects is one topic: one record per exam, counts summed once.
        let x=combined.get(id);if(!x){x={name:g.name,c:zero(),detail:new Map(),mismatch:false};combined.set(id,x)}
        x.c=sum(x.c,c);if(!!g.summary&&!!g.detail.length&&!same(dc,g.summary))x.mismatch=true;
        for(const r of g.detail){const o=x.detail.get(r.code);x.detail.set(r.code,o?{...o,c:sum(o.c,r.c)}:{code:r.code,name:r.name,c:r.c})}
      }
    }
    for(const [id,g] of combined){
      let t=topics.get(id);if(!t){t={id,name:g.name,records:[],outcomes:new Map(),conflicts:0};topics.set(id,t)}
      const date=examDate(e,school);t.records.push({ad:e.ad,date,c:g.c});if(g.mismatch)t.conflicts++;
      // Keep detailed evidence visible even if its scope differs, but label that scope explicitly.
      for(const r of g.detail.values()){let o=t.outcomes.get(r.code);if(!o){o={code:r.code,name:r.name,records:[]};t.outcomes.set(r.code,o)}o.records.push({ad:e.ad,date,c:r.c})}
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
    topics:order([...topics.values()].map(t=>{const outcomes=order([...t.outcomes.values()].map(o=>({...o,...history(o.records)})),sira);const rates=outcomes.map(o=>o.rate).filter(x=>x!==null);return {...t,...history(t.records),outcomes,range:rates.length>1?[Math.min(...rates),Math.max(...rates)]:null}}),sira)};
}

/* One pupil at a time, no ranks or peer comparisons. Same evidence and scale in every drilldown. */
const f=n=>n===null?'—':n.toLocaleString('tr-TR',{maximumFractionDigits:1});
const pct=n=>n===null?'—':'%'+f(n);
const diff=n=>n===null?'—':(n>0?'+':'')+f(n)+' puan';
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
  const legend='<div class="kt-legend"><span><i></i>Kümülatif</span><span><i class="kt-dashed"></i>Bu Denemede</span></div>';
  const table='<div class="kt-table-wrap"><table><thead><tr><th>Deneme</th><th>Doğru / Toplam</th><th>Bu Denemede</th><th>Kümülatif</th><th>Değişim</th></tr></thead><tbody>'+t.points.map((p,i)=>'<tr><th scope="row">'+h(p.ad)+'<span class="kt-muted">'+dateLabel(p.date)+'</span></th><td>'+p.c[1]+' / '+p.c[0]+'</td><td>'+pct(p.examRate)+'</td><td>'+pct(p.rate)+'</td><td>'+diff(i?p.rate-t.points[i-1].rate:null)+'</td></tr>').join('')+t.records.filter(r=>!r.date).map(r=>'<tr><th scope="row">'+h(r.ad)+'<span class="kt-warning">Tarih gerekli</span></th><td>'+r.c[1]+' / '+r.c[0]+'</td><td>'+pct(percent(r.c))+'</td><td>—</td><td>—</td></tr>').join('')+'</tbody></table></div>';
  return (t.missing?'<p class="kt-warning">Tarihi eksik '+t.missing+' sınav toplama dahil; grafikte yer almıyor.</p>':'')+legend+graph(t,t.name)+table;
}
function rateBar(t){return '<span class="kt-bar" aria-hidden="true"><i style="width:'+Math.max(0,Math.min(100,t.rate||0))+'%"></i></span>'}
// Shown on every row while "Son denemede iyi" is active, so the order can be checked by eye.
function lastLabel(t,sira){if(sira!=='son')return '';const p=lastPoint(t);return '<span class="kt-muted kt-last">'+(p?'Son deneme '+pct(p.examRate)+' · '+p.c[1]+'/'+p.c[0]:'Son deneme · tarihli kayıt yok')+'</span>'}
function topicHTML(t,sira){
  return '<details class="kt-topic"><summary><span class="kt-topic-name">'+h(t.name)+'<span class="kt-muted">'+t.total[1]+' / '+t.total[0]+' doğru · '+t.records.length+' deneme</span>'+lastLabel(t,sira)+'</span>'+rateBar(t)+'<strong>'+pct(t.rate)+'</strong><span class="kt-change">'+diff(t.delta)+'</span></summary><div class="kt-detail">'+
    '<div class="kt-section-title"><h2>Kümülatif Değişim</h2><span class="kt-muted">İlk kayıttan bugüne '+diff(t.delta)+'</span></div>'+
    historyHTML(t)+
    '<div class="kt-section-title"><h2>Kazanımlar</h2>'+(t.range?'<span class="kt-range">'+pct(t.range[0])+' – '+pct(t.range[1])+'</span>':'')+'</div>'+
    (t.conflicts?'<p class="kt-warning">'+t.conflicts+' sınavda konu özeti ile kazanım toplamı farklı. Konu oranı özet PDF’den; kazanımlar kendi kayıtlarından hesaplandı.</p>':'')+
    (t.outcomes.length?t.outcomes.map(o=>'<details class="kt-outcome"><summary><span>'+h(o.name)+'<span class="kt-muted">'+h(o.code)+' · '+o.total[1]+' / '+o.total[0]+' doğru</span>'+lastLabel(o,sira)+'</span>'+rateBar(o)+'<strong>'+pct(o.rate)+'</strong></summary><div class="kt-detail">'+historyHTML(o)+'</div></details>').join(''):'<p class="kt-muted">Bu konu için kazanım ayrıntısı yüklenmedi.</p>')+'</div></details>';
}
function sources(v,school){
  if(!v.exams.length)return '';
  return '<details class="kt-sources"'+(v.exams.some(e=>!examDate(e,school))?' open':'')+'><summary>Kaynaklar · '+v.exams.length+' Deneme</summary><div class="kt-source-list">'+v.exams.map(e=>{
    const date=examDate(e,school),students=new Set(e.blocks.map(b=>studentKey(b.student))).size,kind=[...new Set(e.blocks.map(b=>b.kind))].map(k=>k==='topic'?'Konu özeti':'Kazanım ayrıntısı').join(' + '),
      sessions=['TYT','AYT'].filter(x=>e.blocks.some(b=>b.course.endsWith(x==='TYT'?'-T':'-A'))).join(' + '),classes=[...new Set(e.blocks.map(b=>classOf(b.student.cls)))].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true})).join(', ');
    return '<div class="kt-source"><div><b>'+h(e.ad)+'</b><span class="kt-muted">'+sessions+' · '+h(classes)+' · '+students+' öğrenci · '+kind+'</span></div><label>Sınav Tarihi'+(readonly()?'<b>'+dateLabel(date)+'</b>':'<input type="date" data-kt-date="'+h(ek(e.ad))+'" value="'+h(date||'')+'" aria-label="'+h(e.ad+' sınav tarihi')+'"'+(busy?' disabled':'')+'>')+'</label>'+(!readonly()?'<button type="button" class="et-dugme" data-kt-delete="'+h(ek(e.ad))+'"'+(busy?' disabled':'')+'>Kaldır</button>':'')+'</div>';
  }).join('')+'</div></details>';
}
const classOf=c=>/(?:9|1[012])\s*[/\-]\s*[A-ZÇĞİÖŞÜ]\S*/u.exec(c)?.[0]||c;
const examsText=m=>m.sessionExams.length?m.session+': '+m.sessionExams.slice(0,6).map(x=>m.scope==='student'?x.ad:x.ad+' ('+x.n+')').join(', ')+(m.sessionExams.length>6?' +'+(m.sessionExams.length-6):''):'';
const nf=n=>n.toLocaleString('tr-TR');
const courseLabel=c=>c&&c.startsWith(MG)?'Matematik + Geometri':title((c||'').replace(/-[TA]$/u,''));
function summaryText(m){
  const s=m.summary;if(!s)return '';
  const lead=m.scope==='student'?courseLabel(m.course):(m.scope==='grade'?'Tüm '+m.grade+'. sınıflar':'Tüm şube')+' · '+s.students+' öğrenci';
  return lead+' · '+s.exams+' deneme · '+nf(s.c[0])+' soru · '+nf(s.c[1])+' doğru ('+pct(percent(s.c))+')'+(s.exams===1&&!readonly()?' · geçmiş için başka denemelerin haritalarını yükleyin':'');
}
function select(label,field,options,value){return '<label class="kt-select">'+label+'<select data-kt-filter="'+field+'">'+options.map(([id,n])=>'<option value="'+h(id)+'"'+(id===value?' selected':'')+'>'+h(n)+'</option>').join('')+'</select></label>'}
function content(){
  charts=[];const {veri:v,hata}=oku(),school=schoolExams();
  const top='<div class="kt-header"><div class="et-bas"><h1 class="et-baslik">Konu Takibi</h1><p class="kt-muted">Denemeler boyunca biriken doğru cevap yüzdesi</p></div>'+(!readonly()&&!hata?'<label class="et-dugme birincil">'+(busy?'PDF Okunuyor…':'Kazanım Haritası Yükle')+'<input id="ktPdf" type="file" accept="application/pdf,.pdf" multiple class="kt-file"'+(busy?' disabled':'')+'></label>':'')+'</div><p id="ktStatus" role="status" aria-live="polite">'+h(message)+'</p>';
  if(hata)return top+'<p class="kt-warning">'+h(hata)+'</p>';
  if(!v.exams.length)return top+'<div class="et-panel et-bos"><h2>Konuların gelişimini görün</h2><p>Tek bir denemenin kazanım haritasını yükleyin. Yeni denemeler eklendikçe konu ve kazanım grafikleri büyür.</p></div>';
  const m=model(v,{...EK.ktSelection,sira:EK.ktSira},school);EK.ktSelection={cls:m.cls,student:m.view,session:m.session,course:m.course};EK.ktSira=m.sira;
  const filters='<div class="kt-filters">'+select('Şube','cls',m.classes.map(c=>[c,c]),m.cls)+select('Öğrenci','student',[['*sube','Tüm şube ('+m.students.length+' öğrenci)'],...(m.grade?[['*sinif','Tüm '+m.grade+'. sınıflar ('+m.gradeCount+' öğrenci)']]:[]),...m.students.map(s=>[s.id,title(s.name)+' · '+s.no])],m.view)+(m.sessions.length>1?select('Oturum','session',m.sessions.map(s=>[s,s]),m.session):'<div class="kt-select">Oturum<b class="kt-fixed">'+h(m.session||'')+'</b></div>')+select('Ders','course',m.courses.map(c=>[c,courseLabel(c)]),m.course)+'</div>';
  const unknown=m.unknown.length?'<details class="kt-sources"><summary>'+m.unknown.length+' Kazanımın Konusu Eşleştirilmeli</summary><p class="kt-muted">Bu kazanımlar konu başlıklarına bağlanmadı. Konu özeti varsa toplamları kullanılmaya devam eder.</p>'+m.unknown.map((u,i)=>'<form class="kt-mapping" data-kt-code="'+h(u.code)+'" data-kt-course="'+h(u.course)+'"><label for="ktMap'+i+'">'+h(u.name)+'<span class="kt-muted">'+h(u.code)+'</span></label>'+(!readonly()?'<input id="ktMap'+i+'" name="topic" required maxlength="240" placeholder="Konu adı" list="ktTopics"><button class="et-dugme"'+(busy?' disabled':'')+'>Eşleştir</button>':'')+'</form>').join('')+'<datalist id="ktTopics">'+m.topics.map(t=>'<option value="'+h(t.name)+'"></option>').join('')+'</datalist></details>':'';
  const sort='<label class="kt-select kt-sort">Sırala<select data-kt-sort>'+SIRA.map(([id,n])=>'<option value="'+id+'"'+(id===m.sira?' selected':'')+'>'+h(n)+'</option>').join('')+'</select></label>';
  return top+filters+'<div class="kt-list-head"><div class="kt-head-text"><h2>'+h(courseLabel(m.course))+' · '+m.topics.length+' Konu</h2>'+(m.summary?'<p class="kt-muted kt-summary">'+h(summaryText(m))+'</p>':'')+(m.sessionExams.length?'<p class="kt-muted kt-exams">'+h(examsText(m))+'</p>':'')+'<p class="kt-muted">Kümülatif doğru oranı · İlk kayıttan değişim</p></div>'+(m.topics.length?sort:'')+'</div>'+unknown+
    (m.topics.length?'<div class="kt-topics">'+m.topics.map(t=>topicHTML(t,m.sira)).join('')+'</div>':'<p class="kt-muted">Bu seçim için eşleştirilmiş konu yok.</p>')+sources(v,school)+
    '<details class="kt-sources"><summary>Hesaplama</summary><p>Kümülatif oran = tüm yüklü denemelerdeki doğru toplamı / doğru, yanlış ve boş toplamı. Değişimler yüzde puanıdır. Konunun sorulmadığı deneme sıfır sayılmaz. Aynı tarihteki sınavlar grafikte tek adımda birleşir.</p><p>Yayıncının konu ve kazanım kayıtları kullanılır; bir soru birden fazla kazanımda yer alabilir. Aynı sınavın konu özeti ve kazanım ayrıntısı iki kez sayılmaz.</p></details>';
}
function gorunum(){if(!rehberMi())return '<p>Bu sayfa rehber öğretmen içindir.</p>';planDraw();return '<div id="ktKok">'+content()+'</div>'}
const active=()=>EK.sekme==='konutakibi'&&rehberMi()&&!!document.getElementById('ktKok');
function render(focus){const root=document.getElementById('ktKok');if(!active()||!root)return;root.innerHTML=content();planDraw();if(focus)root.querySelector(focus)?.focus()}
function uploadMessage(reports,errors=[]){
  if(!reports.length)return errors.join(' ');
  const exams=new Map(reports.map(r=>[ek(r.ad),r.ad])),pupils=new Set(reports.flatMap(r=>r.blocks.map(b=>studentKey(b.student))));
  return reports.length+' PDF kaydedildi · '+exams.size+' sınav'+(exams.size<=3?' ('+[...exams.values()].join(', ')+')':'')+' · '+pupils.size+' öğrenci. Aynı sınavın tekrarları güncellendi. '+errors.join(' ');
}
async function pdfEkle(files){
  canWrite();if(files.length>10)throw new Error('Bir defada en fazla 10 PDF seçin.');
  const owner=D,previous=D.konutakibi,reports=[],errors=[];
  for(const file of files){try{const {pages}=await denemePdfSayfalari(file);reports.push(pdfCoz(pages))}catch(e){errors.push(file.name+': '+e.message)}}
  if(D!==owner||D.konutakibi!==previous)throw new Error('Defter değişti; PDF’ler kaydedilmedi. Yeniden deneyin.');
  if(reports.length)await ekle(reports,owner,previous);
  return uploadMessage(reports,errors);
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
document.addEventListener('click',ev=>{if(!active()||readonly()||busy)return;const el=ev.target.closest?.('[data-kt-delete]');if(el&&confirm('Bu sınavın Konu Takibi kayıtları kaldırılsın mı? PDF yeniden yüklenebilir.')){const ad=el.dataset.ktDelete;act(()=>sinavSil(ad))}});
document.addEventListener('submit',ev=>{const form=ev.target;if(!active()||!form.matches?.('.kt-mapping'))return;ev.preventDefault();if(readonly()||busy)return;const {ktCourse,ktCode}=form.dataset,name=form.elements.topic.value;act(()=>esle(ktCourse,ktCode,name))});
return {pdfCoz,topicFor,topicName,key,ek,studentKey,blockKey,blank,dogrula,oku,merge,compact,examDate,history,model,examsText,order,summaryText,uploadMessage,SIRA,ekle,tarihKaydet,sinavSil,esle,gorunum,pdfEkle,drawAll};
})();
function gorunumKonuTakibi(){return KONU_TAKIBI.gorunum()}
