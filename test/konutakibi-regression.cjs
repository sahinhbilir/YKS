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
  run("D.__syntheticPadding='x'.repeat(BULUT_YEDEK_UST_SINIR)");await assert.rejects(K.ekle([F.reports[0]]),/bulut yedeği sınırı/);assert.equal(run('D.konutakibi'),undefined);
 });
 await test('escaped untrusted text; empty and viewing teacher are usable',()=>{
  assert(K.gorunum().includes('Kazanım Haritası Yükle'));const r=copy(F.reports[0]);r.blocks[0].rows[0].name='<img src=x onerror=alert(1)>';put('__r',r);run('D.konutakibi=KONU_TAKIBI.merge(KONU_TAKIBI.blank(),[__r])');const html=K.gorunum();assert(!html.includes('<img'));assert(html.includes('&lt;img'));
  run('yalnizcaGoruntuleme=()=>true');const view=K.gorunum();assert(!view.includes('id="ktPdf"'));assert(!view.includes('data-kt-delete'));assert(view.includes('data-kt-filter'));
 });
 console.log(passed+' Konu Takibi tests passed.');
})();

