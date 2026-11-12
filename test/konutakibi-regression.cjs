// Cumulative topic evidence, publisher parsing, persistence, permissions and privacy.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const F=require('./konutakibi-fixtures.cjs');
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,TextDecoder,DecompressionStream,DOMParser:F.DOMParserShim,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const put = (name, value) => sandbox[name] = JSON.parse(JSON.stringify(value));
const get = code => JSON.parse(JSON.stringify(run(code)));

const K=run('KONU_TAKIBI');
const copy=x=>JSON.parse(JSON.stringify(x));
let passed=0;
function reset(){run("D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='konutakibi';EK.ktSelection=undefined;kaydet=async()=>true;yalnizcaGoruntuleme=()=>false");}
async function test(name,fn){reset();try{await fn();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e);process.exitCode=1}}
function stored(reports=F.reports){const v=K.merge(K.blank(),reports);v.exams.forEach((e,i)=>e.date='2026-10-'+String(7+i*7).padStart(2,'0'));return v}
function topic(v,name='Sözcükte Anlam'){return K.model(v).topics.find(t=>t.name===name)}
(async()=>{
 await test('wrapped text, continuations and KONU representation',()=>{
  for(const continuation of [false,true])for(const topic of [false,true]){const r=K.pdfCoz(F.pages({topic,continuation}));assert.equal(r.blocks.length,1);assert.equal(r.blocks[0].rows.length,2);assert.equal(r.blocks[0].kind,topic?'topic':'outcome');assert.equal(r.blocks[0].rows[0].name,topic?'Sözcükte Anlam':'Sözcüğün anlamını yorumlar.');}
 });
 await test('reject incomplete, conflicting, raster and cumulative reports atomically',()=>{
  assert.throws(()=>K.pdfCoz(F.pages({corrupt:true})),/uyuşmuyor/);
  const p=F.pages();p[0]=p[0].filter(i=>i.y!==708);assert.throws(()=>K.pdfCoz(p),/toplamı eksik/);
  assert.throws(()=>K.pdfCoz([[]]),/metin içermiyor/);
  const q=F.pages();q[0].find(i=>i.s==='SENTETİK-1').s='SENTETİK-1, SENTETİK-2';assert.throws(()=>K.pdfCoz(q),/birleşik/);
  assert.throws(()=>K.pdfCoz([...F.pages(),...F.pages()]),/tekrarlanıyor/);
 });
 await test('weighted accumulation 2/4 then 6/6 = 8/10, +30 points; not 75%',()=>{
  const t=topic(stored(F.reports.slice(0,2)));assert.equal(t.rate,80);assert.equal(t.delta,30);assert.deepEqual(copy(t.total),[10,8,1,1]);assert.deepEqual(copy(t.points.map(p=>p.rate)),[50,80]);assert.equal(t.points[1].examRate,100);
 });
 await test('later downturn and recovery; separate kazanım percentages show disparity',()=>{
  const t=topic(stored());assert(Math.abs(t.rate-2100/33)<1e-9);assert.equal(t.points[2].running[1],11);assert.equal(t.points[2].running[0],23);assert(t.points[2].rate<t.points[1].rate);assert(t.points[3].rate>t.points[2].rate);assert.deepEqual(copy(t.range),[1000/22,100]);
 });
 await test('topic absent from later exams is not zero, untouched evidence stays unchanged',()=>{
  const t=topic(stored(),'Cümlede Anlam');assert.equal(t.rate,100);assert.equal(t.points.length,1);assert.equal(t.delta,null);assert.deepEqual(copy(t.total),[5,5,0,0]);
 });
 await test('zero-question and fully blank evidence remain distinct',()=>{
  assert.equal(K.history([{ad:'A',date:'2026-10-01',c:[0,0,0,0]}]).rate,null);
  assert.equal(K.history([{ad:'A',date:'2026-10-01',c:[3,0,0,3]}]).rate,0);
 });
 await test('dates resolve only unambiguously, manual date wins and missing dates do not invent change',()=>{
  const e={ad:'A',date:null};assert.equal(K.examDate(e,[{ad:'A',T:{tarih:'09.10.2026'},F:{tarih:'10.10.2026'}}]),null);
  assert.equal(K.examDate(e,[{ad:'A',tarih:'11.10.2026',T:{tarih:'09.10.2026'}}]),'2026-10-11');
  assert.equal(K.examDate({...e,date:'2026-10-12'},[{ad:'A',tarih:'11.10.2026'}]),'2026-10-12');
  assert.equal(K.examDate(e,[{ad:'A',tarih:'31.02.2026'}]),null);
  const v=stored();v.exams[1].date=null;const t=topic(v);assert.equal(t.missing,1);assert.equal(t.delta,null);assert.equal(t.points.length,3);assert.equal(t.total[0],33);
 });
 await test('out-of-order upload sorts by date; same-day exams do not invent an order',()=>{
  const v=stored();v.exams.reverse();assert.equal(topic(v).points[0].ad,'SENTETİK-1');
  v.exams.find(e=>e.ad==='SENTETİK-2').date='2026-10-07';const t=topic(v);assert.equal(t.points.length,3);assert.equal(t.points[0].rate,80);assert.equal(t.points[0].exams.length,2);
 });
 await test('repeat uploads and companion topic summaries never double count',()=>{
  let v=stored(F.reports.slice(0,2));v=K.merge(v,[F.reports[0],F.reports[1]]);assert.equal(v.exams.length,2);assert.equal(topic(v).total[0],10);
  const summary={ad:'SENTETİK-1',blocks:[F.block([F.row('','SÖZCÜKTE ANLAM',[4,2,1,1]),F.row('','CÜMLEDE ANLAM',[5,5,0,0])],'topic')]};
  v=K.merge(v,[summary]);assert.equal(topic(v).total[0],10);assert.equal(topic(v).outcomes.length,2);assert.equal(topic(v).conflicts,0);
  summary.blocks[0].rows[0].c=[5,3,1,1];v=K.merge(v,[summary]);assert.equal(topic(v).conflicts,1);assert.equal(topic(v).total[0],11);
 });
 await test('partial class replacement preserves other students; TYT and AYT stay separate',()=>{
  const first=copy(F.reports[0]);first.blocks.push(F.block([F.row('T.12.1.1','Test',[5,5,0,0])],'outcome','TÜRKÇE-T',{...F.student,no:'9002',name:'SENTETİK İKİ'}));first.blocks.push(F.block([F.row('T.12.1.1','Test',[3,0,3,0])],'outcome','EDEBİYAT-A'));
  let v=K.merge(K.blank(),[first]);v=K.merge(v,[F.reports[0]]);assert.equal(v.exams[0].blocks.length,3);assert.equal(K.model(v,{student:K.studentKey(F.student),session:'AYT'}).topics[0].rate,0);assert.equal(K.model(v,{student:K.studentKey(F.student)}).topics.find(t=>t.name==='Sözcükte Anlam').rate,50);
 });
 await test('unknown taxonomy is explicit and editable, not guessed from similar percentages',async()=>{
  const r={ad:'YENİ',blocks:[F.block([F.row('YENİ.10.1.1','Yeni kazanım',[2,1,0,1])])]};await K.ekle([r]);let m=K.model(K.oku().veri);assert.equal(m.unknown.length,1);assert.equal(m.topics.length,0);
  await K.esle('TÜRKÇE-T','YENİ.10.1.1','Yeni Konu');m=K.model(K.oku().veri);assert.equal(m.unknown.length,0);assert.equal(m.topics[0].rate,50);
 });
 await test('save failure rolls back, changed notebook is rejected, readonly and student writes blocked',async()=>{
  await K.ekle([F.reports[0]]);const old=run('D.konutakibi');run('kaydet=async()=>false');await assert.rejects(K.ekle([F.reports[1]]),/Kaydedilemedi/);assert.equal(run('D.konutakibi'),old);
  const owner=run('D');reset();await assert.rejects(K.ekle([F.reports[0]],owner,old),/Defter değişti/);
  run('yalnizcaGoruntuleme=()=>true');await assert.rejects(K.ekle([F.reports[0]]),/yetkisi/);
  run("yalnizcaGoruntuleme=()=>false;D.rol='ogrenci'");await assert.rejects(K.ekle([F.reports[0]]),/yetkisi/);assert(!K.gorunum().includes('ktKok'));
 });
 await test('bad stored data never becomes an empty import, deletion compacts and dates validate',async()=>{
  run('D.konutakibi={surum:999}');await assert.rejects(K.ekle([F.reports[0]]),/geçersiz/);assert.equal(run('D.konutakibi.surum'),999);reset();await K.ekle(F.reports);
  await assert.rejects(K.tarihKaydet(K.ek('SENTETİK-1'),'2026-02-31'),/geçersiz/);await K.tarihKaydet(K.ek('SENTETİK-1'),'2026-10-07');assert.equal(K.oku().veri.exams[0].date,'2026-10-07');
  for(const r of F.reports)await K.sinavSil(K.ek(r.ad));assert.equal(K.oku().veri.exams.length,0);assert.equal(K.oku().veri.labels.length,0);
 });
 await test('teacher data survives normalization but never enters a student packet',()=>{
  put('__kt',stored());run('D.konutakibi=__kt;veriyiHazirla(JSON.parse(JSON.stringify(D)))');assert.deepEqual(K.oku().veri.exams.map(e=>e.ad).join(','),F.reports.map(r=>r.ad).join(','));
  put('__kt',stored());run("D.konutakibi=__kt;D.ogr=[{ad:'Sentetik Öğrenci',no:9001,sinif:12,sube:'12-A',alan:'SAY',kap:6,off:[6],aktif:true}]");
  const packet=get('ogrenciPaketi(0)');assert(!JSON.stringify(packet).includes('konutakibi'));assert(!JSON.stringify(packet).includes('SENTETİK-1'));
 });
 await test('a reused number with a different name cannot silently merge two pupils',()=>{
  const r=copy(F.reports[1]);r.blocks[0].student.name='BAŞKA ÖĞRENCİ';assert.throws(()=>K.merge(stored(),[r]),/farklı adlarla/);
 });
 await test('notebook limit is enforced before mutation',async()=>{
  run("D.__syntheticPadding='x'.repeat(DEFTER_HAM_UST_SINIR)");await assert.rejects(K.ekle([F.reports[0]]),/5\.000 KB cihaz bütçesini/);assert.equal(run('D.konutakibi'),undefined);
  run("D.__syntheticPadding='x'.repeat(800000)");await K.ekle([F.reports[0]]);assert(run('D.konutakibi'),'a notebook within the uncompressed fallback limit still takes the write');
 });
 await test('escaped untrusted text; empty and viewing teacher are usable',()=>{
  assert(K.gorunum().includes('Dosya Yükle'));const r=copy(F.reports[0]);r.blocks[0].rows[0].name='<img src=x onerror=alert(1)>';put('__r',r);run('D.konutakibi=KONU_TAKIBI.merge(KONU_TAKIBI.blank(),[__r])');const html=K.gorunum();assert(!html.includes('<img'));assert(html.includes('&lt;img'));
  run('yalnizcaGoruntuleme=()=>true');const view=K.gorunum();assert(!view.includes('id="ktPdf"'));assert(!view.includes('data-kt-delete'));assert(view.includes('data-kt-filter'));
 });

 // ---- Sıralama, Matematik + Geometri, özet satırı, yükleme iletisi, tek oturum
 const trow=(name,c)=>F.row('',name,c);
 const tblock=(rows,course='TÜRKÇE-T')=>F.block(rows,'topic',course);
 function sortData(){
  const v=K.merge(K.blank(),[
   {ad:'SORT-1',blocks:[tblock([trow('YÜKSELEN',[10,2,8,0]),trow('DÜŞEN',[10,9,1,0]),trow('SABİT',[10,5,5,0]),trow('İLK DENEME',[4,4,0,0])])]},
   {ad:'SORT-2',blocks:[tblock([trow('YÜKSELEN',[10,9,1,0]),trow('DÜŞEN',[10,3,7,0]),trow('SABİT',[10,5,5,0]),trow('TEK DENEME',[8,8,0,0])])]},
   {ad:'SORT-3',blocks:[tblock([trow('TARİHSİZ',[6,3,3,0])])]}]);
  v.exams[0].date='2026-10-07';v.exams[1].date='2026-10-14';return v;
 }
 const names=(v,sira)=>K.model(v,{sira}).topics.map(t=>t.name).join(' | ');
 await test('sort orders: soru, dusen, yukselen, son, ad (nulls last, ties by name)',()=>{
  const v=sortData();
  assert.equal(names(v),'Düşen | Sabit | Yükselen | Tek Deneme | Tarihsiz | İlk Deneme');
  assert.equal(names(v,'garbage'),names(v,'soru'));
  assert.equal(names(v,'dusen'),'Düşen | Sabit | Yükselen | İlk Deneme | Tarihsiz | Tek Deneme');
  assert.equal(names(v,'yukselen'),'Yükselen | Sabit | Düşen | İlk Deneme | Tarihsiz | Tek Deneme');
  assert.equal(names(v,'son'),'Tek Deneme | İlk Deneme | Yükselen | Sabit | Düşen | Tarihsiz');
  assert.equal(names(v,'ad'),'Düşen | İlk Deneme | Sabit | Tarihsiz | Tek Deneme | Yükselen');
  const t=K.model(v,{}).topics;assert.equal(t.find(x=>x.name==='Yükselen').delta,35);assert.equal(t.find(x=>x.name==='Düşen').delta,-30);assert.equal(t.find(x=>x.name==='Tarihsiz').delta,null);
  assert.equal(t.find(x=>x.name==='Yükselen').points.at(-1).examRate,90);
 });
 await test('outcomes inside a topic follow the same sort',()=>{
  const v=stored(),o=sira=>K.model(v,{sira}).topics.find(t=>t.name==='Sözcükte Anlam').outcomes.map(x=>x.code).join();
  assert.equal(o('soru'),'T.12.1.1,T.12.1.2');assert.equal(o('dusen'),'T.12.1.1,T.12.1.2');assert.equal(o('yukselen'),'T.12.1.2,T.12.1.1');assert.equal(o('ad'),'T.12.1.1,T.12.1.2');
  assert.equal(o('son'),'T.12.1.1,T.12.1.2');// both 100% in the last exam; ties go to the exam's larger question count (6 vs 4)
 });
 await test('sorted view shows the latest exam rate when "Son denemede iyi" is active, and the sort control',()=>{
  run('D.konutakibi=null');put('__kt',sortData());run('D.konutakibi=__kt');
  let html=K.gorunum();assert(html.includes('data-kt-sort'));assert(!html.includes('Son deneme %'));
  run("EK.ktSira='son'");html=K.gorunum();assert(html.includes('Son deneme %90 · 9/10'));assert(html.includes('Son deneme %100 · 8/8'));assert(html.includes('tarihli kayıt yok'));
  const at=n=>html.indexOf('kt-topic-name">'+n);
  assert(at('Tek Deneme')<at('İlk Deneme')&&at('İlk Deneme')<at('Yükselen')&&at('Yükselen')<at('Düşen'));
  run("EK.ktSira='dusen'");html=K.gorunum();assert(html.indexOf('kt-topic-name">Düşen')<html.indexOf('kt-topic-name">Yükselen'));
 });
 const SK=K.studentKey(F.student);
 const mat=(rows,kind='outcome',course='MATEMATİK-T')=>F.block(rows,kind,course);
 function mgData(extra=[]){
  return K.merge(K.blank(),[{ad:'MG-1',blocks:[
   mat([F.row('E.M.9.3.4','Üslü ifadeleri çözer.',[20,6,10,4]),F.row('E.M.9.3.6','Problem çözer.',[10,2,6,2])]),
   mat([F.row('E.GEO.9.4.5','Üçgen alanı bulur.',[6,3,2,1]),F.row('E.GEO.10.5.1','Çokgenleri tanır.',[4,1,2,1])],'outcome','GEOMETRİ-T'),...extra]}]);
 }
 await test('Matematik + Geometri: first option, counts add to 40, separate courses stay',()=>{
  const v=mgData(),m=K.model(v,{});
  assert.deepEqual(copy(m.courses),['MATEMATİK+GEOMETRİ-T','GEOMETRİ-T','MATEMATİK-T']);assert.equal(m.course,'MATEMATİK+GEOMETRİ-T');
  assert.equal(m.topics.reduce((a,t)=>a+t.total[0],0),40);assert.equal(m.topics.reduce((a,t)=>a+t.total[1],0),12);assert.equal(m.unknown.length,0);
  const t=K.model(v,{course:'MATEMATİK-T'});assert.equal(t.topics.reduce((a,x)=>a+x.total[0],0),30);
  assert.equal(K.model(v,{course:'GEOMETRİ-T'}).topics.reduce((a,x)=>a+x.total[0],0),10);
  const only=K.merge(K.blank(),[{ad:'X',blocks:[mat([F.row('E.M.9.3.6','Problem çözer.',[10,2,6,2])])]}]);assert.deepEqual(copy(K.model(only,{}).courses),['MATEMATİK-T']);
  const html=(run('D.konutakibi=null'),put('__kt',v),run('D.konutakibi=__kt;EK.ktSelection=undefined'),K.gorunum());assert(html.includes('<option value="MATEMATİK+GEOMETRİ-T" selected>Matematik + Geometri</option>'));assert(html.indexOf('Matematik + Geometri</option>')<html.indexOf('>Geometri</option>'));
 });
 await test('merged view: same topic name in both courses is one topic per exam, never double counted; unknown codes and maps per course',async()=>{
  const v=mgData([mat([trow('PROBLEMLER',[10,5,5,0]),trow('ÇOKGENLER',[5,5,0,0])],'topic'),mat([trow('PROBLEMLER',[6,3,3,0])],'topic','GEOMETRİ-T')]);
  let m=K.model(v,{});const p=m.topics.find(t=>t.name==='Problemler');
  assert.equal(p.records.length,1);assert.deepEqual(copy(p.total),[16,8,8,0]);
  assert.deepEqual(copy(K.model(v,{course:'MATEMATİK-T'}).topics.find(t=>t.name==='Problemler').total),[10,5,5,0]);
  assert.equal(m.topics.find(t=>t.name==='Çokgenler').total[0],5+4);
  // unknown code in the geometry half is mapped for that half only
  const u=K.merge(v,[{ad:'MG-1',blocks:[mat([F.row('GEO.X.1','Yeni kazanım',[2,1,1,0])],'outcome','GEOMETRİ-T')]}]);
  put('__kt',u);run('D.konutakibi=__kt');m=K.model(K.oku().veri,{});assert.equal(m.unknown.length,1);assert.equal(m.unknown[0].course,'GEOMETRİ-T');
  await K.esle('GEOMETRİ-T','GEO.X.1','Problemler');m=K.model(K.oku().veri,{});assert.equal(m.unknown.length,0);
 });
 await test('subject summary line: block sums, topic summary preferred, hint only with a single exam',()=>{
  const v=mgData(),line=m=>K.summaryText(m);
  assert.equal(line(K.model(v,{student:SK})),'Matematik + Geometri · 1 deneme · 40 soru · 12 doğru (%30) · geçmiş için başka denemelerin haritalarını yükleyin');
  assert.equal(line(K.model(v,{student:SK,course:'MATEMATİK-T'})),'Matematik · 1 deneme · 30 soru · 8 doğru (%26,7) · geçmiş için başka denemelerin haritalarını yükleyin');
  const withTopic=K.merge(v,[{ad:'MG-1',blocks:[mat([trow('PROBLEMLER',[25,10,10,5])],'topic')]}]);
  assert.match(line(K.model(withTopic,{student:SK,course:'MATEMATİK-T'})),/^Matematik · 1 deneme · 25 soru · 10 doğru \(%40\)/);
  const two=K.merge(v,[{ad:'MG-2',blocks:[mat([F.row('E.M.9.3.6','Problem çözer.',[10,10,0,0])]),mat([F.row('E.GEO.9.4.5','Üçgen alanı bulur.',[10,0,10,0])],'outcome','GEOMETRİ-T')]}]);
  assert.equal(line(K.model(two,{student:SK})),'Matematik + Geometri · 2 deneme · 60 soru · 22 doğru (%36,7)');
  run('yalnizcaGoruntuleme=()=>true');assert(!line(K.model(v,{student:SK})).includes('geçmiş için'));
 });
 await test('upload message counts PDFs, exams and pupils; errors are still reported',async()=>{
  const cls=['12/A','12/B','12/C'],rep=(c,n)=>({ad:'27-YKS-1203',blocks:Array.from({length:n},(_,i)=>F.block([F.row('T.12.1.1','Test',[2,1,1,0])],'outcome','TÜRKÇE-T',{name:'SENTETİK '+c+i,no:String(100+i),cls:c}))});
  const reports=cls.map(c=>rep(c,9));
  assert.equal(K.uploadMessage(reports),'3 PDF kaydedildi · 1 sınav (27-YKS-1203) · 27 öğrenci. Aynı sınavın tekrarları güncellendi. ');
  assert.match(K.uploadMessage([...reports,{...rep('12/D',1),ad:'27-YKS-1204'}],['x.pdf: Bozuk.']),/^4 PDF kaydedildi · 2 sınav \(27-YKS-1203, 27-YKS-1204\) · 28 öğrenci\..*x\.pdf: Bozuk\.$/);
  assert.equal(K.uploadMessage([],['x.pdf: Bozuk.']),'x.pdf: Bozuk.');
  let n=0;run('denemePdfSayfalari=async f=>{if(f.name==="bad.pdf")throw new Error("Okunamadı.");return {pages:'+JSON.stringify(F.pages())+'}}');
  const msg=await K.pdfEkle([{name:'a.pdf'},{name:'b.pdf'},{name:'bad.pdf'}]);
  assert.match(msg,/^2 PDF kaydedildi · 1 sınav \(SENTETİK-1\) · 1 öğrenci\./);assert(msg.includes('bad.pdf: Okunamadı.'));assert.equal(K.oku().veri.exams.length,1);
 });
 await test('a single session is plain text, not a fake choice; two sessions keep the select',()=>{
  put('__kt',stored());run('D.konutakibi=__kt');let html=K.gorunum();
  assert(html.includes('Oturum<b class="kt-fixed">TYT</b>'));assert(!html.includes('data-kt-filter="session"'));
  const both=copy(F.reports[0]);both.blocks.push(F.block([F.row('T.12.1.1','Test',[3,0,3,0])],'outcome','EDEBİYAT-A'));
  put('__kt',K.merge(K.blank(),[both]));run('D.konutakibi=__kt;EK.ktSelection=undefined');html=K.gorunum();assert(html.includes('data-kt-filter="session"'));assert(!html.includes('kt-fixed'));
 });

 await test('opens on the class with the most loaded exams; sources and student exams show session, class and count',()=>{
  const S=(cls,no,name)=>({name,no,cls});
  const c=S('205 12/C','1','SENTETİK C'),a=S('301 12/A','2','SENTETİK A'),a2=S('301 12/A','3','SENTETİK A2');
  const rr=(x,course)=>F.block([F.row('T.12.1.1','Test',[2,1,1,0])],'outcome',course,x);
  const v=K.merge(K.blank(),[
   {ad:'27-YKS-1203',blocks:[rr(c,'TÜRKÇE-T'),rr(a,'TÜRKÇE-T'),rr(a2,'TÜRKÇE-T')]},
   {ad:'27-YKS-1202',blocks:[rr(a,'EDEBİYAT-A'),rr(a2,'EDEBİYAT-A')]}]);
  let m=K.model(v,{});assert.equal(m.cls,'301 12/A');assert.equal(m.scope,'class');m=K.model(v,{student:K.studentKey(a)});assert.equal(m.student.no,'2');assert.deepEqual(copy(m.sessions),['TYT','AYT']);
  assert.equal(K.model(v,{cls:'205 12/C'}).cls,'205 12/C');
  assert.equal(K.examsText(m),'TYT: 27-YKS-1203');assert.equal(K.examsText(K.model(v,{student:K.studentKey(a),session:'AYT'})),'AYT: 27-YKS-1202');assert.equal(K.examsText(K.model(v,{})),'TYT: 27-YKS-1203 (2)');
  // tie on exams -> most pupils
  const tie=K.merge(K.blank(),[{ad:'T-1',blocks:[rr(c,'TÜRKÇE-T'),rr(a,'TÜRKÇE-T'),rr(a2,'TÜRKÇE-T')]}]);assert.equal(K.model(tie,{}).cls,'301 12/A');
  put('__kt',v);run('D.konutakibi=__kt');const html=K.gorunum();
  assert(html.includes('AYT · 12/A · 2 öğrenci · Kazanım ayrıntısı'));assert(html.includes('TYT · 12/A, 12/C · 3 öğrenci · Kazanım ayrıntısı'));
  assert(html.includes('class="kt-muted kt-exams">TYT: 27-YKS-1203'));
  const both=K.merge(v,[{ad:'27-YKS-1202',blocks:[rr(c,'TÜRKÇE-T')]}]);put('__kt',both);run('D.konutakibi=__kt');assert(K.gorunum().includes('TYT + AYT · 12/A, 12/C'));
 });

 // ---- Tüm şube / Tüm sınıflar
 function classData(){
  const P=(cls,no)=>({name:'SENTETİK '+no,no,cls}),a1=P('301 12/A','1'),a2=P('301 12/A','2'),a3=P('301 12/A','3'),b1=P('205 12/B','4'),b2=P('205 12/B','5'),c1=P('101 11/A','6');
  const cnt=(n,k)=>[n,k,n-k,0],tb=(s,c)=>F.block([F.row('','SÖZCÜKTE ANLAM',c)],'topic','TÜRKÇE-T',s);
  const v=K.merge(K.blank(),[
   {ad:'KLS-1',blocks:[tb(a1,cnt(10,4)),F.block([F.row('T.12.1.1','Sözcüğün anlamını belirler.',cnt(10,4))],'outcome','TÜRKÇE-T',a1),tb(a2,cnt(10,6)),tb(b1,cnt(10,5)),tb(c1,cnt(10,9))]},
   {ad:'KLS-2',blocks:[tb(a1,cnt(10,8)),tb(a2,cnt(10,7)),tb(a3,cnt(10,3)),tb(b1,cnt(10,5)),tb(b2,cnt(10,6))]}]);
  v.exams[0].date='2026-10-07';v.exams[1].date='2026-10-14';return {v,a1,a2,a3,b1,b2,c1};
 }
 await test('whole-class and whole-grade views: default, sums of pupils, grades never mixed, history by exam',()=>{
  const {v,a1,a2,a3,b1,b2,c1}=classData(),cnt=(n,k)=>[n,k,n-k,0],tb=(x,c)=>F.block([F.row('','SÖZCÜKTE ANLAM',c)],'topic','TÜRKÇE-T',x),sp=x=>({cls:x.cls,student:K.studentKey(x)});
  const m=K.model(v,{});assert.equal(m.cls,'301 12/A');assert.equal(m.scope,'class');assert.equal(m.view,'*sube');assert.equal(m.student,null);
  const cl=m.topics[0],gr=K.model(v,{cls:'301 12/A',student:'*sinif'}),g=gr.topics[0];
  assert.equal(gr.scope,'grade');assert.equal(gr.grade,12);assert.equal(gr.gradeCount,5);
  // one pupil's exam counts once per topic even with topic summary + detail loaded (a1, exam 1)
  assert.deepEqual(copy(cl.total),[50,28,22,0]);assert.deepEqual(copy(g.total),[80,44,36,0]);
  const sumOf=list=>list.reduce((acc,x)=>acc.map((n,i)=>n+K.model(v,sp(x)).topics[0].total[i]),[0,0,0,0]);
  assert.deepEqual(sumOf([a1,a2,a3]),copy(cl.total));assert.deepEqual(sumOf([a1,a2,a3,b1,b2]),copy(g.total));
  assert(!JSON.stringify(g).includes('11/A')&&sumOf([c1])[0]===10);assert.deepEqual(copy(K.model(v,{cls:'101 11/A',student:'*sinif'}).topics[0].total.slice(0,2)),[10,9]);
  // history is per exam date over all included pupils
  assert.deepEqual(copy(cl.points.map(p=>p.c)),[[20,10,10,0],[30,18,12,0]]);assert.deepEqual(copy(cl.points.map(p=>p.examRate)),[50,60]);assert.deepEqual(copy(cl.points.map(p=>p.rate)),[50,56]);
  assert.deepEqual(copy(g.points.map(p=>p.c[0])),[30,50]);assert.equal(g.delta,5);assert.equal(cl.records.length,2);
  assert.equal(cl.outcomes.length,1);assert.equal(cl.outcomes[0].total[0],10);
  assert.equal(K.summaryText(m),'Tüm şube · 3 öğrenci · 2 deneme · 50 soru · 28 doğru (%56)');
  assert.equal(K.summaryText(gr),'Tüm 12. sınıflar · 5 öğrenci · 2 deneme · 80 soru · 44 doğru (%55)');
  assert.equal(K.examsText(m),'TYT: KLS-1 (2), KLS-2 (3)');assert.equal(K.examsText(gr),'TYT: KLS-1 (3), KLS-2 (5)');
  assert.equal(K.examsText(K.model(v,sp(a1))),'TYT: KLS-1, KLS-2');
  // selection falls back to the class view when the pupil is not in the chosen class; sorting works on aggregates
  assert.equal(K.model(v,{cls:'205 12/B',student:K.studentKey(a1)}).scope,'class');assert.equal(K.model(v,{sira:'yukselen',student:'*sinif'}).topics[0].name,'Sözcükte Anlam');
  const big=K.merge(K.blank(),[{ad:'BÜYÜK',blocks:[tb(a1,[1040,412,628,0])]}]);assert.equal(K.summaryText(K.model(big,{student:'*sinif'})),'Tüm 12. sınıflar · 1 öğrenci · 1 deneme · 1.040 soru · 412 doğru (%39,6) · geçmiş için başka denemelerin haritalarını yükleyin');
  // union of sessions/courses over the included pupils
  const mixed=K.merge(v,[{ad:'AYT-1',blocks:[F.block([F.row('','EDEBİYAT',cnt(4,2))],'topic','EDEBİYAT-A',b1)]}]);
  assert.deepEqual(copy(K.model(mixed,{cls:'205 12/B'}).sessions),['TYT','AYT']);assert.deepEqual(copy(K.model(mixed,{cls:'301 12/A'}).sessions),['TYT']);assert.deepEqual(copy(K.model(mixed,{cls:'301 12/A',student:'*sinif'}).sessions),['TYT','AYT']);
  // rendering: default is the class, both aggregate entries are offered, no per-pupil lists inside the topics
  put('__kt',v);run('D.konutakibi=__kt;EK.ktSelection=undefined');let html=K.gorunum();
  assert(html.includes('<option value="*sube" selected>Tüm şube (3 öğrenci)</option>'));assert(html.includes('<option value="*sinif">Tüm 12. sınıflar (5 öğrenci)</option>'));
  assert(html.includes('class="kt-muted kt-exams">TYT: KLS-1 (2), KLS-2 (3)'));const list=html.slice(html.indexOf('kt-topics'),html.indexOf('kt-sources'));assert(!list.includes('SENTETİK'));
  run("EK.ktSelection={...EK.ktSelection,student:'*sinif'}");html=K.gorunum();assert(html.includes('<option value="*sinif" selected>'));assert(html.includes('Tüm 12. sınıflar · 5 öğrenci'));
 });

 // ---- Zorluğa göre (difficulty-adjusted points). Synthetic school and exams only.
 const S1=F.student,S2={name:'SENTETİK İKİ',no:'9002',cls:'205 12/A'},S3={name:'SENTETİK ÜÇ',no:'9003',cls:'210 12/B'};
 const near=(a,b,msg)=>assert(Math.abs(a-b)<1e-9,(msg||'')+' '+a+' != '+b);
 // spec: {course:[[codes, p], ...]} with 100 pupils, so D = p * 100.
 const NZ=100;
 function zpart(tur,ad,spec){
  const dersler={};
  for(const [c,qs] of Object.entries(spec))dersler[c]=tur==='ozet'?qs.map(q=>q[0].split(',')):qs.map(q=>{const D=Math.round(q[1]*NZ);return [q[1],D,NZ-D,0,F.zorlukEtiketi(q[1])]});
  return {tur,ad,oturum:'TYT',...(tur==='madde'?{ogrenci:NZ}:{}),dersler};
 }
 const zpair=(ad,spec)=>[zpart('ozet',ad,spec),zpart('madde',ad,spec)];
 const ZSPEC={'TÜRKÇE-T':[['T.12.1.1',.11],['T.12.1.1',.07],['T.12.1.2',.93],['T.12.1.2',.89],['T.12.3.1',.5],['T.12.5.1',.6],['T.12.5.1',.4]]};
 const zrep=(ad,rows,st=S1)=>({ad,blocks:[F.block(rows,'outcome','TÜRKÇE-T',st)]});
 const zrows=(a,b,c,d)=>[F.row('T.12.1.1','Zor kazanım',a),F.row('T.12.1.2','Kolay kazanım',b),F.row('T.12.3.1','Tek soru',c),F.row('T.12.5.1','Eşleşmeyen',d)];
 // Student 1: 0/2 on the two hardest, 1/2 on the two easiest, 1/1, and a row whose total (3) does not match the 2 questions.
 const ZREP=zrep('SENTETİK-ZORLUK',zrows([2,0,2,0],[2,1,1,0],[1,1,0,0],[3,2,1,0]));
 function zdata(reports=[ZREP],zparts=zpair('SENTETİK-ZORLUK',ZSPEC)){const v=K.merge(K.blank(),reports,zparts);v.exams.forEach((e,i)=>e.date='2026-10-'+String(7+7*i).padStart(2,'0'));return v}
 const T=(v,name,sel={student:K.studentKey(S1)})=>K.model(v,sel).topics.find(t=>t.name===name);

 await test('hand-computed kazanım and topic figures: fark = doğru - beklenen, units are questions',()=>{
  const m=K.model(zdata(),{student:K.studentKey(S1)}),t=m.topics.find(x=>x.name==='Sözcükte Anlam'),o=c=>t.outcomes.find(x=>x.code===c);
  // two very hard questions (p 0,11 and 0,07), student 0/2 -> beklenen 0,18, fark -0,18
  near(o('T.12.1.1').z.b,.18,'b');assert.equal(o('T.12.1.1').z.d,0);near(o('T.12.1.1').z.fark,-.18,'fark');
  // two easy questions (0,93 and 0,89), student 1/2 -> beklenen 1,82, fark -0,82
  near(o('T.12.1.2').z.b,1.82);near(o('T.12.1.2').z.fark,-.82);
  near(t.z.b,2);assert.equal(t.z.d,1);near(t.z.fark,-1);assert.equal(t.z.exams,1);assert.equal(t.z.of,1);
  const c=m.topics.find(x=>x.name==='Cümlede Anlam');near(c.z.b,.5);near(c.z.fark,.5);
  // Missing the 7 % question costs 0,07; missing the 93 % one costs 0,93.
  const one=(p,d)=>zdata([zrep('SENTETİK-ZORLUK',[F.row('T.12.1.1','x',[1,d,1-d,0])])],zpair('SENTETİK-ZORLUK',{'TÜRKÇE-T':[['T.12.1.1',p]]}));
  near(T(one(.07,0),'Sözcükte Anlam').z.fark,-.07);near(T(one(.93,0),'Sözcükte Anlam').z.fark,-.93);near(T(one(.07,1),'Sözcükte Anlam').z.fark,.93);near(T(one(.93,1),'Sözcükte Anlam').z.fark,.07);
 });
 await test('a kazanım row whose Toplam differs from its question count has no difficulty and is counted',()=>{
  const m=K.model(zdata(),{student:K.studentKey(S1)}),ses=m.topics.find(x=>x.name==='Ses Bilgisi');
  assert.equal(ses.z,null);assert.equal(ses.zskip,1);assert.equal(ses.total[0],3);assert.equal(m.zorluk.skipped,1);
  const html=(put('__kt',zdata()),run('D.konutakibi=__kt;EK.ktSelection={student:'+JSON.stringify(K.studentKey(S1))+'};EK.ktSira="soru"'),K.gorunum());
  assert(html.includes('Zorluk eşleşmedi: 1 kazanım satırı'));
 });
 await test('topic with only a topic summary: its questions (each once) against the summary doğru',()=>{
  const q=[['T.12.1.1',.2],['T.12.1.2,T.12.1.3',.4],['T.12.1.3',.6],['T.12.1.1,T.12.2.1',.8]];
  const rep=sc=>({ad:'SENTETİK-ÖZET',blocks:[F.block([F.row('','SÖZCÜKTE ANLAM',sc)],'topic','TÜRKÇE-T',S1)]});
  let v=zdata([rep([4,3,1,0])],zpair('SENTETİK-ÖZET',{'TÜRKÇE-T':q})),t=T(v,'Sözcükte Anlam');
  near(t.z.b,2);assert.equal(t.z.d,3);near(t.z.fark,1);assert.equal(t.z.n,4);assert.equal(t.zskip,0);assert.equal(t.outcomes.length,0);
  v=zdata([rep([5,3,2,0])],zpair('SENTETİK-ÖZET',{'TÜRKÇE-T':q}));t=T(v,'Sözcükte Anlam');assert.equal(t.z,null);assert.equal(t.zskip,1);
  // with detail rows too, the topic figure comes from the detail rows and the summary only supplies the rate
  v=zdata([{ad:'SENTETİK-ÖZET',blocks:[F.block([F.row('','SÖZCÜKTE ANLAM',[4,3,1,0])],'topic','TÜRKÇE-T',S1),F.block([F.row('T.12.1.1','a',[2,2,0,0]),F.row('T.12.1.3','b',[2,1,1,0])],'outcome','TÜRKÇE-T',S1)]}],zpair('SENTETİK-ÖZET',{'TÜRKÇE-T':q}));
  t=T(v,'Sözcükte Anlam');assert.equal(t.total[0],4);assert.equal(t.z.n,4);assert.equal(t.z.d,3);
 });
 await test('cumulative over exams: only exams with difficulty count, and the coverage is stated',()=>{
  const second=zrep('SENTETİK-ZORLUK2',[F.row('T.12.1.1','x',[1,1,0,0])]),third=zrep('SENTETİK-SIFIR',[F.row('T.12.1.1','x',[2,2,0,0])]);
  const zp=[...zpair('SENTETİK-ZORLUK',ZSPEC),...zpair('SENTETİK-ZORLUK2',{'TÜRKÇE-T':[['T.12.1.1',.3]]})];
  let v=zdata([ZREP,second],zp),t=T(v,'Sözcükte Anlam');
  near(t.z.b,2.3);assert.equal(t.z.d,2);near(t.z.fark,-.3);assert.equal(t.z.exams,2);assert.equal(t.z.of,2);
  assert.equal(t.points.length,2);near(t.points[0].z.fark,-1);near(t.points[1].z.fark,.7,'second exam');
  v=zdata([ZREP,second,third],zp);t=T(v,'Sözcükte Anlam');near(t.z.fark,-.3);assert.equal(t.z.exams,2);assert.equal(t.z.of,3);assert.equal(t.records.length,3);
  const m=K.model(v,{student:K.studentKey(S1)});assert.equal(m.zorluk.z.exams,2);assert.equal(m.zorluk.z.of,3);
  assert.match(K.summaryText(m),/ · zorluğa göre \+0,2 soru \(beklenen 2,8\) \(zorluk verisi 2\/3 denemede\)/);
  // all exams have difficulty: no coverage remark
  assert(!K.summaryText(K.model(zdata([ZREP,second],zp),{student:K.studentKey(S1)})).includes('zorluk verisi'));
 });
 await test('summary line: zorluğa göre and beklenen, one decimal, Turkish comma; absent without difficulty',()=>{
  const m=K.model(zdata(),{student:K.studentKey(S1)});
  assert.equal(K.summaryText(m),'Türkçe · 1 deneme · 8 soru · 4 doğru (%50) · zorluğa göre -0,5 soru (beklenen 2,5) · geçmiş için başka denemelerin haritalarını yükleyin');
  assert(!K.summaryText(K.model(K.merge(K.blank(),[ZREP]),{})).includes('zorluğa göre'));
 });
 const CLASS_REPS=[ZREP,zrep('SENTETİK-ZORLUK',zrows([2,2,0,0],[2,2,0,0],[1,0,1,0],[2,1,1,0]),S2),zrep('SENTETİK-ZORLUK',zrows([2,0,2,0],[2,0,2,0],[1,1,0,0],[2,0,2,0]),S3)];
 const CLASS_REP={ad:'SENTETİK-ZORLUK',blocks:CLASS_REPS.flatMap(r=>r.blocks)};
 await test('class and grade views sum over pupils; per-pupil average is fark / pupils',()=>{
  const v=zdata([CLASS_REP]),cls=K.model(v,{cls:'205 12/A'}),grade=K.model(v,{cls:'205 12/A',student:'*sinif'});
  const a=T(v,'Sözcükte Anlam',{cls:'205 12/A'}),g=T(v,'Sözcükte Anlam',{cls:'205 12/A',student:'*sinif'});
  assert.equal(cls.scope,'class');near(a.z.b,4);assert.equal(a.z.d,5);near(a.z.fark,1);assert.equal(a.z.ns,2);near(a.z.fark/a.z.ns,.5);
  assert.equal(grade.scope,'grade');near(g.z.b,6);assert.equal(g.z.d,5);near(g.z.fark,-1);assert.equal(g.z.ns,3);
  // the same figure as the sum of the individual pupils
  const one=(s)=>T(v,'Sözcükte Anlam',{cls:s.cls,student:K.studentKey(s)}).z.fark;near(one(S1)+one(S2),a.z.fark);near(one(S1)+one(S2)+one(S3),g.z.fark);
  assert.match(K.summaryText(cls),/ · zorluğa göre [+-][\d,]+ soru \(beklenen [\d,]+\) · öğrenci başına [+-][\d,]+/);
  put('__kt',v);run('D.konutakibi=__kt;EK.ktSelection={cls:"205 12/A"};EK.ktSira="soru"');const html=K.gorunum();assert(html.includes('öğrenci başına +0,5'));
  const single=(run('EK.ktSelection={student:'+JSON.stringify(K.studentKey(S1))+'}'),K.gorunum());assert(!single.includes('öğrenci başına'));
 });
 await test('Matematik + Geometri adds the two subjects; a question counted once per subject',()=>{
  const spec={'MATEMATİK-T':[['E.M.9.3.4',.5],['E.M.9.3.4',.3],['E.M.9.3.6',.9]],'GEOMETRİ-T':[['E.GEO.9.4.5',.6],['E.GEO.9.4.5',.2]]};
  const rep={ad:'SENTETİK-MG',blocks:[F.block([F.row('E.M.9.3.4','a',[2,1,1,0]),F.row('E.M.9.3.6','b',[1,0,1,0])],'outcome','MATEMATİK-T',S1),F.block([F.row('E.GEO.9.4.5','c',[2,2,0,0])],'outcome','GEOMETRİ-T',S1)]};
  const v=zdata([rep],zpair('SENTETİK-MG',spec)),m=K.model(v,{student:K.studentKey(S1)});
  assert.equal(m.course,'MATEMATİK+GEOMETRİ-T');const t=n=>m.topics.find(x=>x.name===n).z;
  near(t('Üslü İfadeler ve Denklemler').fark,.2);near(t('Problemler').fark,-.9);near(t('Üçgenin Alanı').fark,1.2);near(m.zorluk.z.b,2.5);assert.equal(m.zorluk.z.d,3);near(m.zorluk.z.fark,.5);
  near(K.model(v,{student:K.studentKey(S1),course:'GEOMETRİ-T'}).zorluk.z.fark,1.2);
 });
 await test('sort: Zorluğa göre zayıf / güçlü, topics without difficulty last',()=>{
  const v=zdata(),n=sira=>K.model(v,{student:K.studentKey(S1),sira}).topics.map(t=>t.name).join(' | ');
  assert.equal(n('zayif'),'Sözcükte Anlam | Cümlede Anlam | Ses Bilgisi');assert.equal(n('guclu'),'Cümlede Anlam | Sözcükte Anlam | Ses Bilgisi');
  assert.deepEqual(copy(K.SIRA.map(x=>x[0])),['soru','dusen','yukselen','son','zayif','guclu','ad']);assert(K.SIRA.some(x=>x[1]==='Zorluğa göre zayıf')&&K.SIRA.some(x=>x[1]==='Zorluğa göre güçlü'));
  const o=sira=>K.model(v,{student:K.studentKey(S1),sira}).topics.find(t=>t.name==='Sözcükte Anlam').outcomes.map(x=>x.code).join();assert.equal(o('zayif'),'T.12.1.2,T.12.1.1');assert.equal(o('guclu'),'T.12.1.1,T.12.1.2');
 });
 await test('rendering: topic row, history columns, question chips, summary, sources',()=>{
  put('__kt',zdata());run('D.konutakibi=__kt;EK.ktSelection={student:'+JSON.stringify(K.studentKey(S1))+'};EK.ktSira="zayif"');const html=K.gorunum();
  assert(html.includes('kt-topics kt-has-z'));assert(html.includes('<span class="kt-z kt-z-down">Zorluğa göre -1 soru</span>'));assert(html.includes('<span class="kt-z kt-z-up">Zorluğa göre +0,5 soru</span>'));
  assert(html.includes('Zorluk verisi yok'));assert(html.includes('<th>Beklenen doğru</th><th>Zorluğa göre</th>'));assert(html.includes('<td>0,2</td><td>-0,2 soru</td>'));
  assert(html.includes('title="Soru 1: okulda %11 doğru">S1 %11</span>'));assert(html.includes('>S2 %7</span>'));assert(html.includes('kt-chip-zor'));assert(html.includes('>S3 %93</span>')&&html.includes('kt-chip-kolay'));
  assert(html.includes('Doğru 1 − beklenen 2 = zorluğa göre -1 soru'));
  assert(html.includes('Zorluk: özet ✓ · madde analizi ✓'));assert(html.includes('data-kt-zdelete="SENTETİK-ZORLUK"'));
  assert(html.includes('<option value="zayif" selected>Zorluğa göre zayıf</option>'));assert(html.includes('<option value="guclu">Zorluğa göre güçlü</option>'));
  assert(html.indexOf('kt-topic-name">Sözcükte Anlam')<html.indexOf('kt-topic-name">Cümlede Anlam'));
  // without any difficulty data nothing about it is drawn
  put('__kt',K.merge(K.blank(),[ZREP]));run('D.konutakibi=__kt');const plain=K.gorunum();assert(!plain.includes('kt-has-z'));assert(!plain.includes('Beklenen doğru'));assert(plain.includes('Zorluk: özet yok · madde analizi yok'));
 });
 await test('Kaynaklar names what is missing; mismatching files give a warning and no difficulty',()=>{
  const spec=ZSPEC,ozetOnly=K.merge(K.blank(),[ZREP],[zpart('ozet','SENTETİK-ZORLUK',spec)]);
  put('__kt',ozetOnly);run('D.konutakibi=__kt');let html=K.gorunum();assert(html.includes('Zorluk: özet ✓ · madde analizi yok'));assert.equal(K.model(ozetOnly,{}).zorluk.z,null);
  const madOnly=K.merge(K.blank(),[ZREP],[zpart('madde','SENTETİK-ZORLUK',spec)]);put('__kt',madOnly);run('D.konutakibi=__kt');html=K.gorunum();assert(html.includes('Zorluk: özet yok · madde analizi ✓'));
  // a different question count in one course
  const bad=zpart('madde','SENTETİK-ZORLUK',{'TÜRKÇE-T':spec['TÜRKÇE-T'].slice(0,6)}),v=K.merge(K.blank(),[ZREP],[zpart('ozet','SENTETİK-ZORLUK',spec),bad]);
  const m=K.model(v,{});assert.deepEqual(copy(m.zorluk.bad),['TÜRKÇE-T']);assert.equal(m.zorluk.z,null);assert(m.topics.every(t=>!t.z));
  put('__kt',v);run('D.konutakibi=__kt');html=K.gorunum();assert(html.includes('Zorluk verisi uyuşmuyor: Türkçe'));assert(!html.includes('kt-has-z'));
  // a course present on one side only
  const other=zpart('madde','SENTETİK-ZORLUK',{'TÜRKÇE-T':spec['TÜRKÇE-T'],'TARİH-T':[['E.TAR.9.1.1',.5]]});
  assert.deepEqual(copy([...K.zorlukIndex(K.merge(K.blank(),[ZREP],[zpart('ozet','SENTETİK-ZORLUK',spec),other]).zorluk).values()][0].bad),['TARİH-T']);
 });
 await test('a TYT Sınav özeti with Seçmeli Felsefe beside a TYT + AYT Madde Analizi without it: nothing is "uyuşmuyor"; the missing AYT özet is named',async()=>{
  const ozet=zpart('ozet','SENTETİK-ZORLUK',{'TÜRKÇE-T':[['T.1',.5],['T.2',.5]],'S.FELSEFE-T':[['F.1',0],['F.2',0]]});
  const madde={tur:'madde',ad:'SENTETİK-ZORLUK',oturum:'TYT + AYT',ogrenci:27,dersler:{'TÜRKÇE-T':[[.5,13,10,4,'Orta'],[.4,11,10,6,'Orta']],'MATEMATİK-A':[[.5,13,10,3,'Orta'],[.25,6,10,10,'Zor']]}};
  const v=K.merge(K.blank(),[ZREP],[ozet,madde]),x=[...K.zorlukIndex(v.zorluk).values()][0];
  assert.deepEqual(copy(x.bad),[],'Seçmeli Felsefe (left out of the Madde Analizi) and the AYT dersler (no AYT özet) are not mismatches');
  assert.deepEqual(copy(x.eksik.ozet),['AYT']);assert(x.courses.has(K.key('TÜRKÇE-T')),'TYT Türkçe has its difficulty');
  put('__kt',v);run('D.konutakibi=__kt');const html=K.gorunum();
  assert(html.includes('Zorluk: özet TYT ✓, AYT yok · madde analizi TYT ✓, AYT ✓'),'each part per session');assert(!html.includes('uyuşmuyor'));
  // The upload says what to add.
  run('D.konutakibi=__kt;denemePdfSayfalari=async f=>({pages:f.pages})');
  const msg=await K.pdfEkle([{name:'m.pdf',size:10,pages:F.maddePages({ad:'SENTETİK-ZORLUK',oturum:'AYT',N:26,courses:[{course:'MATEMATİK-A',rows:[[13,10,3],[6,10,10]]}]})}]);
  assert.match(msg,/SENTETİK-ZORLUK: AYT Sınav özeti yok; AYT dersleri konu ve kazanım düzeyinde eşlenemez\. AYT Sınav özetini \(Excel\) ekleyin\./);assert(!/uyuşmuyor/.test(msg));
 });
 await test('exam with only difficulty files is listed in Kaynaklar; either file may come first',()=>{
  const v=K.merge(K.blank(),[],zpair('SENTETİK-1203',{'TÜRKÇE-T':[['T.12.1.1',.5]]}));
  assert.equal(v.exams.length,0);put('__kt',v);run('D.konutakibi=__kt');const html=K.gorunum();assert(html.includes('SENTETİK-1203'));assert(html.includes('kazanım haritası yüklenmedi'));assert(html.includes('Zorluk: özet ✓ · madde analizi ✓'));
  const a=K.merge(K.merge(K.blank(),[],[zpart('ozet','SENTETİK-ZORLUK',ZSPEC)]),[ZREP],[zpart('madde','SENTETİK-ZORLUK',ZSPEC)]),b=K.merge(K.merge(K.blank(),[ZREP],[zpart('madde','SENTETİK-ZORLUK',ZSPEC)]),[],[zpart('ozet','SENTETİK-ZORLUK',ZSPEC)]);
  assert.deepEqual(copy(K.model(a,{}).topics.map(t=>t.z&&t.z.fark)),copy(K.model(b,{}).topics.map(t=>t.z&&t.z.fark)));assert.equal(Object.values(a.zorluk)[0].ogrenci,NZ);
 });

 // ---- Parsing: Sınav özeti (.xlsx), refused answer report, Madde Analizi (.pdf)
 const QS=[['TÜRKÇE-T','T.12.1.3,T.12.1.2'],['TÜRKÇE-T','T.12.1.1'],['TÜRKÇE-T','T.12.3.1'],['MATEMATİK-T','E.M.9.3.4'],['MATEMATİK-T','E.M.9.3.6'],['GEOMETRİ-T','E.GEO.9.4.5']];
 const OZET_BEKLENEN={tur:'ozet',ad:'SENTETİK-1203',oturum:'TYT',dersler:{'TÜRKÇE-T':[['T.12.1.3','T.12.1.2'],['T.12.1.1'],['T.12.3.1']],'MATEMATİK-T':[['E.M.9.3.4'],['E.M.9.3.6']],'GEOMETRİ-T':[['E.GEO.9.4.5']]}};
 await test('Sınav özeti: stored and deflated zips, shared and inline strings, several codes per question',async()=>{
  for(const o of [{method:0,shared:false},{method:8,shared:true},{method:8,shared:false},{method:0,shared:true}])assert.deepEqual(copy(await K.ozetCoz(F.ozetXlsx(QS,o))),OZET_BEKLENEN,JSON.stringify(o));
  const at=await K.ozetCoz(F.ozetXlsx([['FİZİK-A','E.FİZ.9.1.3']],{title:'SENTETİK-1202 – AYT'}));assert.equal(at.oturum,'AYT');assert.equal(at.ad,'SENTETİK-1202');
  // the real report writes rich-text inline strings with xml:space and may use semicolons/spaces around codes
  const sp=await K.ozetCoz(F.ozetXlsx([['TÜRKÇE-T',' T.12.1.3 ; T.12.1.2 , T.12.1.3']]));assert.deepEqual(copy(sp.dersler['TÜRKÇE-T']),[['T.12.1.3','T.12.1.2']]);
 });
 await test('Sınav özeti: anything but this layout is refused with a Turkish message',async()=>{
  const rej=(b,re)=>assert.rejects(K.ozetCoz(b),re);
  await rej(Buffer.from('bu bir excel değil'),/geçerli bir Excel/);
  await rej(F.ozetXlsx(QS).subarray(0,200),/geçerli bir Excel/);
  await rej(F.ozetXlsx(QS,{sheetName:'Sayfa1'}),/Sınav Özeti değil/);
  await rej(F.xlsx({rows:[['SENTETİK-1203 - TYT'],['Ders','Kod','Kazanım'],['TÜRKÇE-T','T.12.1.1','x']]}),/sütunları/);
  await rej(F.xlsx({rows:[['Başlık yok'],['Ders','Kazanım Kodu','Kazanım'],['TÜRKÇE-T','T.12.1.1','x']]}),/başlığı okunamadı/);
  await rej(F.xlsx({rows:[['SENTETİK-1203 - TYT'],['Ders','Kazanım Kodu','Kazanım']]}),/soru satırı yok/);
  await rej(F.xlsx({rows:[['SENTETİK-1203 - TYT'],['Ders','Kazanım Kodu','Kazanım'],['TÜRKÇE-T','T.12.1.1','x'],[],['TÜRKÇE-T','T.12.1.2','x']]}),/kesintisiz/);
  await rej(F.ozetXlsx([['TÜRKÇE-T','T.12.1.1'],['MATEMATİK-T','E.M.9.3.4'],['TÜRKÇE-T','T.12.1.2']]),/ardışık/);
  await rej(F.ozetXlsx([['TÜRKÇE-A','T.12.1.1']]),/oturumla uyuşmuyor/);
  await rej(F.ozetXlsx([['TÜRKÇE-T','']]),/Kazanım kodu okunamadı/);
  await rej(F.ozetXlsx([['TÜRKÇE-T','T.12.1.1 <x>']]),/Kazanım kodu okunamadı/);
 });
 await test('the answer report (names, ID numbers) is refused before anything is read or stored',async()=>{
  for(const o of [{method:8},{method:0},{shared:true},{sheetName:'Sınav Özeti'}])await assert.rejects(K.ozetCoz(F.cevapXlsx(o)),e=>e.message==='Bu dosya öğrenci cevap raporu; kişisel bilgi (TC kimlik) içerdiği için yüklenmez. Sınav özeti ve Madde Analizi yeterli.');
  // even when it carries the right sheet name and sits in a sheet with the özet headers elsewhere
  await assert.rejects(K.ozetCoz(F.xlsx({rows:[['SENTETİK-1203 - TYT'],['Ders','Kazanım Kodu','Kazanım'],['Öğrenci No','Ad Soyad','TC Kimlik No']]})),/cevap raporu/);
  let saves=0;run('kaydet=async()=>{globalThis.__saves=(globalThis.__saves||0)+1;return true}');run('globalThis.__saves=0');
  const buf=F.cevapXlsx(),file={name:'cevap.xlsx',size:buf.length,arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.length)};
  const msg=await K.pdfEkle([file]);
  assert.equal(msg,'cevap.xlsx: Bu dosya öğrenci cevap raporu; kişisel bilgi (TC kimlik) içerdiği için yüklenmez. Sınav özeti ve Madde Analizi yeterli.');
  assert.equal(run('D.konutakibi'),undefined);assert.equal(run('globalThis.__saves'),0);assert(!JSON.stringify(run('D')).includes('GİZLİ')&&!JSON.stringify(run('D')).includes('00000000000'));
 });
 const MC=[{course:'TÜRKÇE-T',rows:[[10,15,2],[1,25,1],[20,5,2]]},{course:'MATEMATİK-T',rows:[[27,0,0],[0,20,7]]},{course:'GEOMETRİ-T',rows:[[13,10,4]]}];
 const MADDE_BEKLENEN=()=>({tur:'madde',ad:'SENTETİK-1203',oturum:'TYT',ogrenci:27,dersler:{'TÜRKÇE-T':[[.3704,10,15,2,'Zor'],[.037,1,25,1,'Çok Zor'],[.7407,20,5,2,'Kolay']],'MATEMATİK-T':[[1,27,0,0,'Çok Kolay'],[0,0,20,7,'Çok Zor']],'GEOMETRİ-T':[[.4815,13,10,4,'Orta']]}});
 await test('Madde Analizi: rotated and upright pages, continuation page without a title, side table ignored',()=>{
  for(const rotated of [true,false])for(const perPage of [32,2,1]){
   const r=K.maddeCoz(F.maddePages({courses:MC,rotated,perPage}));assert.deepEqual(copy(r),MADDE_BEKLENEN(),rotated+' '+perPage);
  }
  const pages=F.maddePages({courses:MC,perPage:2});assert.equal(pages.length,4);assert(!pages[1].some(i=>/Madde Analizi/.test(i.s)),'page 2 has no title');
  // a page with several subjects, and a subject continued onto the next page
  const big=F.maddePages({courses:[{course:'TÜRKÇE-T',rows:Array.from({length:40},(_,i)=>[i%27,27-(i%27),0])}],perPage:32});
  const r=K.maddeCoz(big);assert.equal(r.dersler['TÜRKÇE-T'].length,40);assert.equal(big.length,2);
  assert.equal(K.maddeCoz(F.maddePages({courses:MC,N:27,answered:25})).ogrenci,27);// "Testi Cevaplamış Öğrenci Sayısı" is not the base
 });
 await test('Madde Analizi: p = Doğru / Öğrenci Sayısı; wrong rows, numbering and counts are refused',()=>{
  const rej=(pages,re)=>assert.throws(()=>K.maddeCoz(pages),re);
  rej(F.maddePages({courses:[{course:'TÜRKÇE-T',rows:[[10,15,2]],pct:{1:'45.0%'}}]}),/Başarı yüzdesi doğru sayısıyla uyuşmuyor/);
  assert.doesNotThrow(()=>K.maddeCoz(F.maddePages({courses:[{course:'TÜRKÇE-T',rows:[[10,15,2]],pct:{1:'37.1%'}}]})));// 37.04 printed as 37.1 is within 0,1
  rej(F.maddePages({courses:[{course:'TÜRKÇE-T',rows:[[20,15,2]]}]}),/aşıyor/);
  const p=F.maddePages({courses:MC});p[0]=p[0].filter(i=>!(i.s==='2'&&Math.abs(i.x-150)<1&&Math.abs(i.y+i.w/2-46)<1));rej(p,/Soru numarası|sırayla/);
  const q=F.maddePages({courses:MC,perPage:2});q.splice(1,1);rej(q,/sırayla|Ders başlığı|Ortalama/);
  const o=F.maddePages({courses:MC});o[0]=o[0].filter(i=>i.s!=='Ortalama');rej(o,/Ortalama/);
  rej(F.maddePages({courses:MC}).map(pg=>pg.map(i=>/Öğrenci Sayısı : 27/.test(i.s)&&pg.some(j=>/MATEMATİK/.test(j.s))?{...i,s:'Öğrenci Sayısı : 26'}:i)),/Öğrenci sayısı derslerde farklı/);
  rej(F.maddePages({courses:[{course:'TÜRKÇE-T',rows:[[1,1,1]]},{course:'TÜRKÇE-T',rows:[[1,1,1]]}]}),/tekrarlanıyor/);
  rej([[{s:'Başka bir PDF',x:10,y:10,w:50}]],/tablosu bulunamadı/);
  rej(F.maddePages({courses:[{course:'TÜRKÇE-A',rows:[[1,1,1]]}]}),/Ders adı tanınmadı/);
  const m=F.maddePages({courses:MC,ad:'SENTETİK-1203'});m[1]=m[1].map(i=>i.s==='SENTETİK-1203 / TYT'?{...i,s:'SENTETİK-1204 / TYT'}:i);rej(m,/birden çok sınav/);
 });
 await test('Madde Analizi: one file with the exam’s TYT and AYT (each its own student count); the Başarı denominator per ders; a test nobody answered is left out',()=>{
  // 27-YKS-1203 style: TYT for 27 students, AYT for 26, in one file.
  const birlesik=[...F.maddePages({oturum:'TYT',N:27,courses:[{course:'TÜRKÇE-T',rows:[[20,5,2],[10,10,7]]}]}),...F.maddePages({oturum:'AYT',N:26,courses:[{course:'MATEMATİK-A',rows:[[13,10,3],[26,0,0]]}]})];
  const r=copy(K.maddeCoz(birlesik));assert.equal(r.oturum,'TYT + AYT');assert.deepEqual(Object.keys(r.dersler),['TÜRKÇE-T','MATEMATİK-A']);
  // p is kept to four decimals.
  assert.equal(r.dersler['TÜRKÇE-T'][0][0],Math.round(20/27*1e4)/1e4);assert.equal(r.dersler['MATEMATİK-A'][0][0],.5);assert.equal(r.ogrenci,27);
  // A whole YKS file: 11 TYT and 13 AYT dersler (24) are read and saved as one exam (the stored part once allowed only 20).
  const TD=['TÜRKÇE-T','TARİH-T','COĞRAFYA-T','FELSEFE-T','DİN KÜLTÜRÜ-T','S.FELSEFE-T','MATEMATİK-T','GEOMETRİ-T','FİZİK-T','KİMYA-T','BİYOLOJİ-T'];
  const AD=['TÜRK DİLİ VE EDB-A','TARİH.1-A','COĞRAFYA.1-A','TARİH.2-A','COĞRAFYA.2-A','FELSEFE GR.-A','DİN KÜLTÜRÜ-A','S.FELSEFE-A','MATEMATİK-A','GEOMETRİ-A','FİZİK-A','KİMYA-A','BİYOLOJİ-A'];
  const tam=K.maddeCoz([...F.maddePages({oturum:'TYT',N:27,courses:TD.map(course=>({course,rows:[[10,10,7],[5,5,17]]}))}),...F.maddePages({oturum:'AYT',N:26,courses:AD.map(course=>({course,rows:[[10,10,6],[5,5,16]]}))})]);
  assert.equal(Object.keys(tam.dersler).length,24);const kayit=K.merge(K.blank(),[],[tam]);assert.doesNotThrow(()=>K.dogrula(copy(kayit)));
  assert.equal(Object.keys(Object.values(kayit.zorluk)[0].madde).length,24);
  // Two exams in one file are still refused; one session's counts must agree.
  const iki=[...F.maddePages({ad:'SENTETİK-1203',courses:[{course:'TÜRKÇE-T',rows:[[1,1,1]]}]}),...F.maddePages({ad:'SENTETİK-1204',oturum:'AYT',courses:[{course:'MATEMATİK-A',rows:[[1,1,1]]}]})];
  assert.throws(()=>K.maddeCoz(iki),/birden çok sınav/);
  // TÖDER style: 29 on the list, 15 sat the exam. Türkçe: Başarı = D / 15 (all 15 answered the test); Coğrafya: 14 answered the
  // test but its rows count the 15 who sat the exam and Başarı = D / 15; Seçmeli Felsefe: nobody answered, left out.
  const t=copy(K.maddeCoz(F.maddePages({N:29,courses:[{course:'TÜRKÇE-T',taban:15,cevap:15,rows:[[15,0,0],[12,3,0]]},{course:'COĞRAFYA-T',taban:15,cevap:14,rows:[[2,6,7],[10,2,3]]},{course:'S.FELSEFE-T',taban:29,cevap:0,rows:[[0,0,29],[0,0,29]]}]})));
  assert.deepEqual(Object.keys(t.dersler),['TÜRKÇE-T','COĞRAFYA-T']);assert.deepEqual(t.atlanan,['S.FELSEFE-T']);assert.equal(t.ogrenci,15);
  assert.equal(t.dersler['TÜRKÇE-T'][0][0],1);assert.equal(t.dersler['COĞRAFYA-T'][0][0],Math.round(2/15*1e4)/1e4);
  // A percentage no denominator explains is still refused.
  assert.throws(()=>K.maddeCoz(F.maddePages({N:29,courses:[{course:'TÜRKÇE-T',cevap:15,rows:[[12,3,0]],pct:{1:'61.0%'}}]})),/Başarı yüzdesi doğru sayısıyla uyuşmuyor/);
  // Nothing answered at all: a clear refusal.
  assert.throws(()=>K.maddeCoz(F.maddePages({courses:[{course:'S.FELSEFE-T',cevap:0,rows:[[0,0,27]]}]})),/cevaplayan öğrenci yok/);
 });
 await test('an exam’s TYT and AYT files sit side by side (a later file replaces only its own session); each ders’s own student count in the Türkiye comparison',()=>{
  const mpart=(oturum,N,dersler)=>({tur:'madde',ad:'SENTETİK-1203',oturum,ogrenci:N,dersler});
  const tyt=mpart('TYT',27,{'TÜRKÇE-T':[[.5,13,10,4,'Orta'],[.4,11,10,6,'Orta']]}),ayt=mpart('AYT',26,{'MATEMATİK-A':[[.5,13,10,3,'Orta'],[.25,6,10,10,'Zor']]});
  let v=K.merge(K.blank(),[],[tyt]);v=K.merge(v,[],[ayt]);let e=Object.values(v.zorluk)[0];
  assert.deepEqual(Object.keys(e.madde),['TÜRKÇE-T','MATEMATİK-A'],'the AYT file does not wipe the TYT one');assert.equal(e.oturum,'TYT + AYT');assert.equal(e.ogrenci,27);
  v=K.merge(v,[],[mpart('TYT',27,{'TARİH-T':[[.5,13,10,4,'Orta']]})]);e=Object.values(v.zorluk)[0];
  assert.deepEqual(Object.keys(e.madde),['MATEMATİK-A','TARİH-T'],'the TYT file again replaces the TYT part only');
  // Sınav özeti the same way.
  v=K.merge(v,[],[zpart('ozet','SENTETİK-1203',{'TÜRKÇE-T':[['T.1',.5],['T.1',.5]]}),{tur:'ozet',ad:'SENTETİK-1203',oturum:'AYT',dersler:{'MATEMATİK-A':[['M.1'],['M.2']]}}]);
  assert.deepEqual(Object.keys(Object.values(v.zorluk)[0].ozet).sort(),['MATEMATİK-A','TÜRKÇE-T']);
  // The Türkiye comparison counts each ders with its own students: AYT 26, not the exam's largest 27.
  v=K.merge(K.blank(),[],[tyt,ayt,{tur:'turkiye',ad:'SENTETİK-1203',oturum:'TYT + AYT',dersler:{'TÜRKÇE-T':[.5,.5],'MATEMATİK-A':[.5,.5]}}]);
  const n=o=>[...new Set(K.turkiyeKiyas(K.dogrula(v),{session:o}).dersler.flatMap(r=>r.sorular.map(q=>q.n)))];
  assert.deepEqual(n('AYT'),[26]);assert.deepEqual(n('TYT'),[27]);
 });
 await test('upload routes by content, saves once, names what was added and reports a mismatch',async()=>{
  run('denemePdfSayfalari=async f=>({pages:f.pages})');
  const pdf=(name,pages)=>({name,pages,size:10}),xl=(name,buf)=>({name,size:buf.length,arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.length)});
  const karne=pdf('karne.pdf',F.pages()),madde=pdf('madde.pdf',F.maddePages({courses:MC})),ozet=xl('ozet.xlsx',F.ozetXlsx(QS));
  let msg=await K.pdfEkle([madde]);
  assert.equal(msg,'Madde Analizi kaydedildi · SENTETİK-1203 (TYT) · 3 ders · 6 soru');assert.equal(K.oku().veri.exams.length,0);
  msg=await K.pdfEkle([ozet]);assert.equal(msg,'Sınav özeti kaydedildi · SENTETİK-1203 (TYT) · 3 ders · 6 soru');
  const e=K.oku().veri.zorluk[K.ek('SENTETİK-1203')];assert(e.ozet&&e.madde);assert.equal(e.ogrenci,27);assert.equal(e.oturum,'TYT');
  msg=await K.pdfEkle([karne,madde]);assert.match(msg,/^1 PDF kaydedildi · 1 sınav \(SENTETİK-1\) · 1 öğrenci\. Aynı sınavın tekrarları güncellendi\. Madde Analizi kaydedildi · SENTETİK-1203 \(TYT\) · 3 ders · 6 soru$/);
  // fewer questions in the new özet than in the stored Madde Analizi: stored, but flagged
  const short=xl('ozet.xlsx',F.ozetXlsx(QS.slice(0,5)));msg=await K.pdfEkle([short]);
  assert.match(msg,/^Sınav özeti kaydedildi · SENTETİK-1203 \(TYT\) · 2 ders · 5 soru SENTETİK-1203: Zorluk verisi uyuşmuyor: Geometri\.$/);
  assert.equal(K.model(K.oku().veri,{}).zorluk.z,null);
  // bad files do not block the good ones
  msg=await K.pdfEkle([pdf('bozuk.pdf',[[{s:'x',x:1,y:1,w:3}]]),xl('cevap.xlsx',F.cevapXlsx()),ozet]);assert.match(msg,/^Sınav özeti kaydedildi · SENTETİK-1203 \(TYT\) · 3 ders · 6 soru bozuk\.pdf: .*cevap\.xlsx: Bu dosya öğrenci cevap raporu/);
  assert(!JSON.stringify(run('D.konutakibi')).includes('GİZLİ')&&!JSON.stringify(run('D.konutakibi')).includes('00000000000'));
 });

 // ---- Storage
 await test('dogrula accepts a valid zorluk record and rejects every malformed one',()=>{
  const good=()=>copy(zdata());const bad=(fn,label)=>{const v=good(),e=Object.values(v.zorluk)[0];fn(v,e);assert.throws(()=>K.dogrula(v),/geçersiz/,label)};
  assert.doesNotThrow(()=>K.dogrula(good()));const k=Object.keys(good().zorluk)[0];assert.equal(k,K.ek('SENTETİK-ZORLUK'));
  const noz=good();delete noz.zorluk;assert.doesNotThrow(()=>K.dogrula(noz));
  bad((v,e)=>{v.zorluk=[]},'array');bad((v,e)=>{v.zorluk='x'},'string');bad((v,e)=>{v.zorluk=null},'null');
  bad((v,e)=>{e.extra=1},'extra key');bad((v,e)=>{delete e.ts},'missing key');bad((v,e)=>{e.ts=-1},'ts');bad((v,e)=>{e.oturum='KPSS'},'oturum');bad((v,e)=>{e.ad=''},'ad');
  bad((v,e)=>{v.zorluk={ANAHTAR:e}},'key must be the exam key');bad((v,e)=>{e.ozet=null;e.madde=null},'both empty');
  bad((v,e)=>{e.ogrenci=null},'ogrenci null with madde');bad((v,e)=>{e.ogrenci=0},'ogrenci 0');bad((v,e)=>{e.ogrenci=1.5},'ogrenci float');
  bad((v,e)=>{e.madde['TÜRKÇE-T'][0][0]=1.2},'p>1');bad((v,e)=>{e.madde['TÜRKÇE-T'][0][0]=-.1},'p<0');bad((v,e)=>{e.madde['TÜRKÇE-T'][0][0]='0.5'},'p string');bad((v,e)=>{e.madde['TÜRKÇE-T'][0][0]=NaN},'p NaN');
  bad((v,e)=>{e.madde['TÜRKÇE-T'][0][1]=e.ogrenci+1},'D > N');bad((v,e)=>{e.madde['TÜRKÇE-T'][0][1]=1.5},'D float');bad((v,e)=>{e.madde['TÜRKÇE-T'][0][2]=e.ogrenci},'D+Y+B > N');
  bad((v,e)=>{e.madde['TÜRKÇE-T'][0].pop()},'short question');bad((v,e)=>{e.madde['TÜRKÇE-T'][0][4]=5},'label type');bad((v,e)=>{e.madde['TÜRKÇE-T'][0]='x'},'question not array');
  bad((v,e)=>{e.ozet['TÜRKÇE-T'][0]=[]},'no codes');bad((v,e)=>{e.ozet['TÜRKÇE-T'][0]=[3]},'code type');bad((v,e)=>{e.ozet['TÜRKÇE-T'][0]=Array(11).fill('T.12.1.1')},'too many codes');
  bad((v,e)=>{e.ozet['TÜRKÇE']=e.ozet['TÜRKÇE-T']},'course without -T/-A');bad((v,e)=>{e.ozet['TÜRKÇE-T']=[]},'no questions');
  bad((v,e)=>{e.ozet['TÜRKÇE-T']=Array.from({length:201},()=>['T.12.1.1'])},'201 questions');
  bad((v,e)=>{e.madde['TÜRKÇE-T']=Array.from({length:201},()=>[.5,1,1,0,'Orta'])},'201 madde questions');
  bad((v,e)=>{v.zorluk={};for(let i=0;i<61;i++){const ad='SENTETİK-'+i;v.zorluk[K.ek(ad)]={...copy(e),ad}}},'61 exams');
  const sixty=good();sixty.zorluk={};for(let i=0;i<60;i++){const ad='SENTETİK-'+i;sixty.zorluk[K.ek(ad)]={...copy(Object.values(good().zorluk)[0]),ad}}assert.doesNotThrow(()=>K.dogrula(sixty));
  assert.throws(()=>K.merge(sixty,[],zpair('SENTETİK-YENİ',{'TÜRKÇE-T':[['T.12.1.1',.5]]})),/En fazla 60/);
  const huge=good();Object.values(huge.zorluk)[0].ad='S'.repeat(160);assert.throws(()=>K.dogrula(huge),/geçersiz/);// key no longer equals the exam key
 });
 await test('whole-record guard: zorluk shares the 350 KB limit',()=>{
  const v=zdata();for(let i=0;i<59;i++){const ad='SENTETİK-'+i,c=Array.from({length:200},()=>['T.12.1.1','T.12.1.2','T.12.1.3','T.12.1.4','T.12.1.5','T.12.1.6','T.12.1.7','T.12.1.8','T.12.1.9','T.12.1.10']);
   v.zorluk[K.ek(ad)]={ad,oturum:'TYT',ogrenci:null,ts:1,ozet:{'TÜRKÇE-T':c,'TARİH-T':c,'FİZİK-T':c},madde:null}}
  assert.throws(()=>K.dogrula(v),/alanı doldu/);
 });
 await test('re-uploading an exam file replaces that part only; delete removes the difficulty data',async()=>{
  await K.ekle([ZREP],undefined,undefined,zpair('SENTETİK-ZORLUK',ZSPEC));
  const first=K.oku().veri.zorluk[K.ek('SENTETİK-ZORLUK')];assert.equal(first.madde['TÜRKÇE-T'][0][0],.11);
  const newer={'TÜRKÇE-T':ZSPEC['TÜRKÇE-T'].map(([c,p])=>[c,Math.min(.99,p+.05)])};
  await K.ekle([],undefined,undefined,[zpart('madde','SENTETİK-ZORLUK',newer)]);
  const e=K.oku().veri.zorluk[K.ek('SENTETİK-ZORLUK')];near(e.madde['TÜRKÇE-T'][0][0],.16);assert.deepEqual(copy(e.ozet),copy(first.ozet));assert.equal(Object.keys(K.oku().veri.zorluk).length,1);assert(e.ts>=first.ts);
  await K.ekle([],undefined,undefined,[zpart('ozet','SENTETİK-ZORLUK',{'TÜRKÇE-T':[['T.12.9.9',.5]]})]);
  assert.deepEqual(copy(K.oku().veri.zorluk[K.ek('SENTETİK-ZORLUK')].ozet),{'TÜRKÇE-T':[['T.12.9.9']]});
  await assert.rejects(K.zorlukSil('YOK'),/bulunamadı/);
  await K.zorlukSil(K.ek('SENTETİK-ZORLUK'));assert.equal(K.oku().veri.zorluk,undefined);assert.equal(K.oku().veri.exams.length,1);
  // removing the exam keeps its difficulty data until that is removed on purpose
  await K.ekle([],undefined,undefined,zpair('SENTETİK-ZORLUK',ZSPEC));await K.sinavSil(K.ek('SENTETİK-ZORLUK'));assert(K.oku().veri.zorluk);
 });
 await test('a viewing teacher and a student can neither upload nor delete difficulty data',async()=>{
  await K.ekle([ZREP],undefined,undefined,zpair('SENTETİK-ZORLUK',ZSPEC));const before=run('D.konutakibi');
  run('yalnizcaGoruntuleme=()=>true');
  await assert.rejects(K.ekle([],undefined,undefined,zpair('SENTETİK-2',ZSPEC)),/yetkisi/);await assert.rejects(K.zorlukSil(K.ek('SENTETİK-ZORLUK')),/yetkisi/);
  await assert.rejects(K.pdfEkle([{name:'x.xlsx',size:1,arrayBuffer:async()=>new ArrayBuffer(1)}]),/yetkisi/);
  assert.equal(run('D.konutakibi'),before);
  const view=K.gorunum();assert(view.includes('Zorluk: özet ✓ · madde analizi ✓'));assert(!view.includes('data-kt-zdelete'));assert(!view.includes('id="ktPdf"'));
  run("yalnizcaGoruntuleme=()=>false;D.rol='ogrenci'");await assert.rejects(K.zorlukSil(K.ek('SENTETİK-ZORLUK')),/yetkisi/);
 });
 await test('difficulty data travels in the notebook but never into a student packet; untrusted text is escaped',()=>{
  put('__kt',zdata());run("D.konutakibi=__kt;D.ogr=[{ad:'Sentetik Öğrenci',no:9001,sinif:12,sube:'12-A',alan:'SAY',kap:6,off:[6],aktif:true}]");
  const packet=get('ogrenciPaketi(0)');assert(!JSON.stringify(packet).includes('zorluk'));assert(!JSON.stringify(packet).includes('SENTETİK-ZORLUK'));
  run('veriyiHazirla(JSON.parse(JSON.stringify(D)))');assert(K.oku().veri.zorluk);
  const v=zdata();Object.values(v.zorluk)[0].ad='SENTETİK-ZORLUK';v.exams[0].ad='<img src=x onerror=alert(1)>';
  const w=copy(zdata([zrep('<img src=x onerror=alert(1)>',zrows([2,0,2,0],[2,1,1,0],[1,1,0,0],[3,2,1,0]))],zpair('<img src=x onerror=alert(1)>',ZSPEC)));put('__kt',w);run('D.konutakibi=__kt;EK.ktSelection=undefined');
  const html=K.gorunum();assert(!html.includes('<img'));assert(html.includes('&lt;img'));
 });


 /* ---------------- Türkiye'ye göre: the school and each pupil against the publisher's network-wide success rates ---------------- */
 const Y=require('./yanlislar-fixtures.cjs');
 const tpart=(ad,dersler)=>({tur:'turkiye',ad,oturum:'TYT',dersler});
 // Fizik, 4 questions, 100 pupils. School p .30 .40 (F.1) .70 .50 (F.2); Türkiye p .50 .60 .60 .50.
 const TSPEC={'FİZİK-T':[['F.1',.30],['F.1',.40],['F.2',.70],['F.2',.50]]},TP={'FİZİK-T':[.5,.6,.6,.5]};
 const TS2={name:'SENTETİK İKİ',no:'9002',cls:'205 12/A'};
 const trep=(ad,st,f1,f2)=>({ad,blocks:[F.block([F.row('F.1','Basınç kazanımı',f1),F.row('F.2','Kuvvet kazanımı',f2)],'outcome','FİZİK-T',st)]});
 function tdata(ad='27-YKS-1203',extra=[]){
  const v=K.merge(K.blank(),[trep(ad,S1,[2,1,1,0],[2,2,0,0]),{ad,blocks:trep(ad,TS2,[2,0,2,0],[2,2,0,0]).blocks}],[...zpair(ad,TSPEC),tpart(ad,TP),...extra]);
  v.maps['FİZİK-T|F.1']='Basınç';v.maps['FİZİK-T|F.2']='Kuvvet';return K.dogrula(v);
 }
 const seHand=ps=>{const v=ps.map(p=>{const q=(p*NZ+1)/(NZ+2);return q*(1-q)}),sv=v.reduce((a,x)=>a+x,0),ss=v.reduce((a,x)=>a+Math.sqrt(x),0);return Math.sqrt((sv+K.R_MADDE*(ss*ss-sv))/(ps.length**2)/NZ)};
 await test('Performans analizi: an exam with a code is named by it; one without a code (27-TYT_SIFIR_POZİTİF) by its full name, and meets its Sınav özeti under that name',async()=>{
  const sayfa=kod=>Y.itemlere(Y.performansSpec({kod})).map(p=>p.items);
  put('__pg',sayfa('27-YKS-1203'));const kodlu=run('KONU_TAKIBI.turkiyeCoz(__pg)');assert.equal(kodlu.ad,'27-YKS-1203');assert.equal(kodlu.oturum,'TYT');
  put('__pg',sayfa('SENTETİK-TYT_SIFIR_DENEME'));const adli=copy(run('KONU_TAKIBI.turkiyeCoz(__pg)'));
  assert.equal(adli.ad,'SENTETİK-TYT_SIFIR_DENEME');assert.deepEqual(adli.dersler['TÜRKÇE-T'],[.9,.7,.5,.2]);assert.deepEqual(Object.keys(adli.dersler),['TÜRKÇE-T','TARİH-T','DİN KÜLTÜRÜ-T','S.FELSEFE-T']);
  // The Sınav özeti of the same exam ("SENTETİK-TYT_SIFIR_DENEME - TYT" → its name) and the Performans analizi make one exam.
  const v=K.merge(K.blank(),[],[zpart('ozet','SENTETİK-TYT_SIFIR_DENEME',{'TÜRKÇE-T':[['T.1',.5],['T.1',.5],['T.2',.5],['T.2',.5]]}),adli]);
  assert.equal(Object.keys(v.zorluk).length,1);const e=Object.values(v.zorluk)[0];assert(e.ozet&&e.turkiye,'özet and Türkiye under one exam');
  // A page with neither a code nor a "… SINAVI ANALİZLERİ" title is still refused.
  put('__pg',sayfa('27-YKS-1203').map(p=>p.filter(i=>!/SINAVI ANALİZLERİ/.test(i.s))));assert.throws(()=>run('KONU_TAKIBI.turkiyeCoz(__pg)'),/eklenmedi/);
 });
 await test('Türkiye part: stored beside özet and madde, validated, replaced and removed on its own',async()=>{
  const v=tdata(),e=v.zorluk[K.ek('27-YKS-1203')];assert.deepEqual(copy(e.turkiye),TP);assert.equal(e.ad,'27-YKS-1203');assert.equal(e.oturum,'TYT');
  const bad=fn=>{const x=copy(v);fn(Object.values(x.zorluk)[0]);assert.throws(()=>K.dogrula(x),/geçersiz/)};
  bad(e=>{e.turkiye['FİZİK-T'][0]=1.2});bad(e=>{e.turkiye['FİZİK-T'][0]='0.5'});bad(e=>{e.turkiye={}});bad(e=>{e.turkiye['FİZİK']=[.5]});bad(e=>{e.turkiye=null});bad(e=>{e.fazla=1});
  // An older record has no turkiye key at all; a record with the Türkiye file alone is valid too.
  const eski=copy(v);delete Object.values(eski.zorluk)[0].turkiye;assert.doesNotThrow(()=>K.dogrula(eski));
  const yalniz=K.merge(K.blank(),[],[tpart('27-YKS-1204',TP)]),y=yalniz.zorluk[K.ek('27-YKS-1204')];assert.equal(y.ozet,null);assert.equal(y.madde,null);assert.equal(y.ogrenci,null);assert.deepEqual(copy(y.turkiye),TP);
  // Adding the file again replaces it; the exam keeps the name its other files gave it.
  const again=K.merge(v,[],[{...tpart('27 YKS 1203',{'FİZİK-T':[.1,.2,.3,.4]})}]),a=again.zorluk[K.ek('27-YKS-1203')];assert.equal(Object.keys(again.zorluk).length,1);assert.equal(a.ad,'27-YKS-1203');assert.deepEqual(copy(a.turkiye['FİZİK-T']),[.1,.2,.3,.4]);assert(a.ozet&&a.madde);
  // The other way round: the Türkiye file first under the bare code, then the özet under a longer name adopts it.
  const once=K.merge(K.blank(),[],[tpart('27-YKS-1205',TP)]),sonra=K.merge(once,[],[zpart('ozet','27 YKS 1205',TSPEC)]);assert.deepEqual(Object.keys(sonra.zorluk),[K.ek('27 YKS 1205')]);assert(sonra.zorluk[K.ek('27 YKS 1205')].turkiye&&sonra.zorluk[K.ek('27 YKS 1205')].ozet);
  put('__kt',v);run('D.konutakibi=__kt');await K.turkiyeSil(K.ek('27-YKS-1203'));const k=K.oku().veri.zorluk[K.ek('27-YKS-1203')];assert.equal(k.turkiye,undefined);assert(k.ozet&&k.madde);
  await assert.rejects(K.turkiyeSil(K.ek('27-YKS-1203')),/bulunamadı/);
  put('__kt',yalniz);run('D.konutakibi=__kt');await K.turkiyeSil(K.ek('27-YKS-1204'));assert.equal(K.oku().veri.zorluk,undefined,'an entry with nothing left is removed');
 });
 await test('okul ve Türkiye by hand: rates, difference, interval and status per konu, kazanım and soru',()=>{
  const v=tdata(),m=K.turkiyeKiyas(v,{});
  assert.equal(m.veri,true);assert.equal(m.session,'TYT');assert.equal(m.duzey,12);assert.equal(m.exam,'*');assert.equal(m.course,'*');assert.equal(m.soru,4);assert.equal(m.ogrenci,NZ);
  const d=m.dersler[0];assert.equal(d.ad,'Fizik');near(d.okul,.475);near(d.tr,.55);near(d.fark,-.075);near(d.se,seHand([.3,.4,.7,.5]));assert.equal(d.m,4);
  assert.equal(d.durum,d.fark+1.96*d.se<0?'geride':'belirsiz');
  const k=K.turkiyeKiyas(v,{course:d.id});assert.equal(k.seviye,'konu');assert.deepEqual(copy(k.rows.map(r=>r.ad)),['Basınç','Kuvvet'],'the most behind first');
  const [b,kv]=k.rows;near(b.okul,.35);near(b.tr,.55);near(b.fark,-.2);near(b.se,seHand([.3,.4]));assert.equal(b.durum,'geride');assert.equal(b.m,2);
  near(kv.okul,.6);near(kv.tr,.55);near(kv.fark,.05);assert.equal(kv.durum,'belirsiz','+5 points on two questions is inside the interval');
  // With independent answers (r = 0) the interval would be narrower: the published one is the wider.
  assert(b.se>Math.sqrt([.3,.4].map(p=>{const q=(p*NZ+1)/(NZ+2);return q*(1-q)}).reduce((a,x)=>a+x,0)/4/NZ));
  // Relative to the school's own level in the ders: zero over the ders, the weak topic negative, the other positive.
  near(d.goreli,0);near(b.goreli*2+kv.goreli*2,0);assert(b.goreli<0&&kv.goreli>0);assert(Math.abs(b.goreli)<Math.abs(b.fark),'part of the gap is the school’s general level');
  const g=K.turkiyeKiyas(v,{course:d.id,olcu:'goreli',sira:'ileri'});assert.equal(g.olcu,'goreli');assert.equal(g.rows[0].ad,'Kuvvet');
  const kz=K.turkiyeKiyas(v,{course:d.id,seviye:'kazanim'});assert.deepEqual(copy(kz.rows.map(r=>[r.id,r.ad])),[['F.1','Basınç kazanımı'],['F.2','Kuvvet kazanımı']]);
  const sr=K.turkiyeKiyas(v,{course:d.id,seviye:'soru'});assert.equal(sr.rows.length,4);near(sr.rows[0].fark,-.2);assert.deepEqual(copy(sr.rows.map(r=>r.ad).sort()),['Soru 1','Soru 2','Soru 3','Soru 4']);near(sr.rows.find(r=>r.ad==='Soru 4').fark,0);
  assert.deepEqual(copy(sr.rows[0].sorular[0]),{ad:'27-YKS-1203',no:1,ps:.3,pt:.5,n:NZ});
 });
 await test('the school’s level in a ders: the shift is zero when the school equals Türkiye and one logit when it is one logit above',()=>{
  const sig=x=>1/(1+Math.exp(-x)),lg=p=>Math.log(p/(1-p)),pt=[.3,.5,.7];
  near(Math.round(K.dersKaymasi(pt.map(p=>({pt:p,ps:p,n:40})))*1e6)/1e6,0);
  near(Math.round(K.dersKaymasi(pt.map(p=>({pt:p,ps:sig(lg(p)+1),n:40})))*1e6)/1e6,1);
  const one=K.grupOlc([{ps:.3,pt:.5,bek:.4,n:30}]);near(one.fark,-.2);near(one.goreli,-.1);near(one.se,Math.sqrt((10/32)*(22/32)/30));assert.equal(one.durum,'geride');assert.equal(one.durumG,'belirsiz');
  // Everybody right: the smoothed variance keeps the interval open instead of claiming certainty.
  assert(K.grupOlc([{ps:1,pt:.9,bek:.9,n:20}]).se>0);
 });
 await test('exams, grades and missing parts: filtered, never mixed, and said',()=>{
  const st9={name:'SENTETİK DOKUZ',no:'9101',cls:'102 9/A'};
  const v=K.merge(tdata(),[trep('27-TYT-901',st9,[2,2,0,0],[2,2,0,0])],[...zpair('27-TYT-901',TSPEC),tpart('27-TYT-901',{'FİZİK-T':[.9,.9,.9,.9]}),...zpair('27-YKS-1204',TSPEC),tpart('27-YKS-1204',{'FİZİK-T':[.3,.4,.7,.5]})]);
  v.maps['FİZİK-T|F.1']='Basınç';v.maps['FİZİK-T|F.2']='Kuvvet';
  const m=K.turkiyeKiyas(v,{});assert.deepEqual(copy(m.duzeyler),[12,9]);assert.equal(m.duzey,12,'the 12th grade first');assert.deepEqual(copy(m.exams.map(x=>x.ad)),['27-YKS-1203','27-YKS-1204'],'the 9th grade exam is not in the 12th grade view; 1204 has no karne, its grade comes from the code');
  assert.equal(m.soru,8);near(m.dersler[0].fark,(-.075+0)/2);assert.equal(m.dersler[0].sinav,2);
  const tek=K.turkiyeKiyas(v,{exam:K.ek('27-YKS-1204')});assert.equal(tek.soru,4);near(tek.dersler[0].fark,0);
  const dokuz=K.turkiyeKiyas(v,{duzeyNo:9});assert.equal(dokuz.duzey,9);assert.equal(dokuz.exams.length,1);near(dokuz.dersler[0].tr,.9);
  // A Türkiye file whose question count differs from the Madde Analizi is left out and named.
  const kisa=K.merge(tdata(),[],[tpart('27-YKS-1203',{'FİZİK-T':[.5,.6,.6]})]),mk=K.turkiyeKiyas(kisa,{});assert.equal(mk.veri,false);assert.deepEqual(copy(mk.uyusmayan),['27-YKS-1203 · Fizik']);
  // Without the Sınav özeti there is no kazanım to group by: ders and soru still compare, konu says why.
  const oz=copy(tdata());Object.values(oz.zorluk)[0].ozet=null;const mo=K.turkiyeKiyas(oz,{course:K.key('FİZİK-T')});assert.equal(mo.ozetYok,true);assert.deepEqual(copy(mo.rows.map(r=>r.ad)),['Kazanım haritası yok']);assert.equal(K.turkiyeKiyas(oz,{course:K.key('FİZİK-T'),seviye:'soru'}).rows.length,4);
  // Without the Madde Analizi there is no school rate: the page lists what is missing.
  const md=copy(tdata());Object.values(md.zorluk)[0].madde=null;Object.values(md.zorluk)[0].ogrenci=null;const mm=K.turkiyeKiyas(md,{});assert.equal(mm.veri,false);assert.deepEqual(copy(mm.dosyalar),[{k:K.ek('27-YKS-1203'),ad:'27-YKS-1203',ozet:true,madde:false,turkiye:true}]);
 });
 await test('each pupil against Türkiye: correct − Σ Türkiye p, by ders and by konu; the Kıyas baseline of the topic list',()=>{
  const v=tdata(),r=K.ogrenciFark(v,{session:'TYT'}),o=id=>r.ogrenciler.find(x=>x.student.no===id);
  assert.equal(r.ogrenciler.length,2);assert.equal(r.atlanan,0);
  near(o('9001').toplam.d,3);near(o('9001').toplam.b,2.2);near(o('9002').toplam.d-o('9002').toplam.b,-.2);
  const k=[...o('9002').konular.values()];assert.deepEqual(copy(k.map(t=>t.ad)),['Basınç','Kuvvet']);near(k[0].d-k[0].b,-1.1);near(k[1].d-k[1].b,.9);assert.equal(k[0].n,2);
  assert.equal(K.ogrenciFark(v,{session:'TYT',ids:new Set([K.studentKey(TS2)])}).ogrenciler.length,1);assert.equal(K.ogrenciFark(v,{session:'AYT'}).ogrenciler.length,0);
  // The same pupil in the topic list: against the school's rates F.1 is −0,7, against Türkiye's −1,1.
  const okul=K.model(v,{student:K.studentKey(TS2)}),tr=K.model(v,{student:K.studentKey(TS2),taban:'turkiye'}),t=(m,n)=>m.topics.find(x=>x.name===n).z;
  assert.equal(okul.taban,'okul');assert.equal(tr.taban,'turkiye');assert.equal(okul.trVar,true);
  near(t(okul,'Basınç').fark,-.7);near(t(tr,'Basınç').fark,-1.1);near(t(tr,'Basınç').b,1.1);near(t(tr,'Kuvvet').fark,.9);near(tr.zorluk.z.fark,-.2);
  // Öğrenci kartı: weak topics use Türkiye when the file is there (−1,1 ≤ −1), the school's rates otherwise (−0,7 is not weak).
  const A=run('ANALIZ'),z=A.zayifKonular(v,'9002',[]);assert.equal(z.taban,'turkiye');assert.deepEqual(copy(z.liste.map(x=>[x.konu,x.fark])),[['Basınç',-1.1]]);
  const eski=copy(v);delete Object.values(eski.zorluk)[0].turkiye;const z2=A.zayifKonular(eski,'9002',[]);assert.equal(z2.taban,'okul');assert.equal(z2.liste.length,0);
  // The summary other pages show: every topic of every ders, established gaps first.
  const g=K.geridekiKonular(v,{session:'TYT'},5);assert.equal(g.var,true);assert.equal(g.toplam,2);assert.equal(g.geride,1);assert.deepEqual(copy(g.liste.map(x=>[x.ad,x.ders,x.durum])),[['Basınç','Fizik','geride'],['Kuvvet','Fizik','belirsiz']]);
  assert.equal(K.geridekiKonular(K.blank(),{}).var,false);
 });
 await test('Performans analizi upload: recognised by its title, only the exam code and p are kept; the page and its controls',async()=>{
  run('denemePdfSayfalari=async f=>({pages:f.pages})');
  const perf={name:'performans.pdf',size:10,pages:Y.itemlere(Y.performansSpec({})).map(p=>p.items)};
  const msg=await K.pdfEkle([perf]);assert.equal(msg,'Performans analizi (Türkiye geneli) kaydedildi · 27-YKS-1203 (TYT) · 4 ders · 10 soru');
  const e=K.oku().veri.zorluk[K.ek('27-YKS-1203')];assert.deepEqual(copy(e.turkiye['TÜRKÇE-T']),[.9,.7,.5,.2]);assert.deepEqual(Object.keys(e).sort(),['ad','madde','ogrenci','oturum','ozet','ts','turkiye']);
  assert(!/\b\d{3,}\b/.test(JSON.stringify(e.turkiye)),'no counts of the report are stored');
  // A PDF that is neither is still read as a karne and refused as before.
  await assert.rejects(async()=>{const m=await K.pdfEkle([{name:'bos.pdf',size:1,pages:[[]]}]);if(/metin içermiyor/.test(m))throw new Error(m)},/metin içermiyor/);
  // The page: Gelişim is the default; Türkiye’ye göre shows what is missing, then the tables.
  let html=K.gorunum();assert(html.includes('data-kt-gorunum="gelisim" aria-pressed="true"'));
  run("EK.ktGorunum='turkiye'");html=K.gorunum();assert(html.includes('Okul hangi konularda Türkiye’nin gerisinde?'));assert(html.includes('performans analizi ✓ · madde analizi yok · sınav özeti yok'));
  put('__kt',tdata());run("D.konutakibi=__kt;EK.ktTr=undefined");html=K.gorunum();
  for(const x of ['id="ktTrKpi"','Dersler · okul ve Türkiye','data-kt-tr-ders=','Öğrenciler · kim nerede geride','data-ogrenci-karti="9002"','Konu, kazanım ve soru düzeyi için bir ders seçin'])assert(html.includes(x),x);
  assert(/Okul − Türkiye · TYT<\/span><strong>−7,5<small>puan/.test(html),'the headline is the difference in points');
  run("EK.ktTr={course:'"+K.key('FİZİK-T')+"',acik:'"+K.key('Basınç')+"'}");html=K.gorunum();
  assert(html.includes('Konular · Fizik'));assert(html.includes('kt-rozet-geride">Geride'));assert(html.includes('S1 · okul %30 · Türkiye %50'),'the open topic lists its questions');assert(html.includes('<b>−20</b><span class="kt-muted"> ± '));
  // Gelişim keeps working and gains the Kıyas switch; a viewing teacher sees both views but no upload or delete.
  run("EK.ktGorunum='gelisim';EK.ktTaban='turkiye';EK.ktSelection={student:'"+K.studentKey(TS2).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"',cls:'205 12/A'}");html=K.gorunum();
  assert(html.includes('data-kt-taban="turkiye" aria-pressed="true"'));assert(html.includes('Türkiye’ye göre -1,1 soru'));assert(html.includes('Türkiye’ye göre zayıf'));
  run("yalnizcaGoruntuleme=()=>true;EK.ktGorunum='turkiye'");html=K.gorunum();assert(html.includes('Dersler · okul ve Türkiye'));assert(!html.includes('id="ktPdf"'));assert(!html.includes('data-kt-trdelete'));
  run("D.rol='ogrenci'");assert(!K.gorunum().includes('ktTrKpi'));
 });

 console.log(passed+' Konu Takibi tests passed.');
})();

