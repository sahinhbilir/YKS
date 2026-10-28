// Cumulative topic evidence, publisher parsing, persistence, permissions and privacy.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const put = (name, value) => sandbox[name] = JSON.parse(JSON.stringify(value));
const get = code => JSON.parse(JSON.stringify(run(code)));

const F=require('./konutakibi-fixtures.cjs');
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
  run("D.__syntheticPadding='x'.repeat(DEFTER_HAM_UST_SINIR)");await assert.rejects(K.ekle([F.reports[0]]),/bulut yedeği sınırı.*Ayarlar → Defter boyutu/);assert.equal(run('D.konutakibi'),undefined);
  run("D.__syntheticPadding='x'.repeat(1500000)");await K.ekle([F.reports[0]]);assert(run('D.konutakibi'),'a notebook over the old 900 KB guard but under the raw limit still takes the write');
 });
 await test('escaped untrusted text; empty and viewing teacher are usable',()=>{
  assert(K.gorunum().includes('Kazanım Haritası Yükle'));const r=copy(F.reports[0]);r.blocks[0].rows[0].name='<img src=x onerror=alert(1)>';put('__r',r);run('D.konutakibi=KONU_TAKIBI.merge(KONU_TAKIBI.blank(),[__r])');const html=K.gorunum();assert(!html.includes('<img'));assert(html.includes('&lt;img'));
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
 console.log(passed+' Konu Takibi tests passed.');
})();

