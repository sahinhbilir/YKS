const fs = require('fs');
const vm = require('vm');

const target = process.argv[2] || 'index.html';
const html = fs.readFileSync(target, 'utf8');
const marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
if (start < marker.length || boot < 0) throw new Error('Uygulama betiği bulunamadı.');
const source = html.slice(start, boot);

const listeners = {};
const nodes = {
  ray: { innerHTML: '' }, ana: { innerHTML: '' },
  stil: { textContent: 'body{}' }, uygulama: { textContent: source }, veri: { textContent: 'null' }
};
const element = () => ({
  style: {}, hidden: false, textContent: '', innerHTML: '', value: '', checked: false,
  classList: { contains() { return false; }, add() {}, remove() {} }, dataset: {},
  setAttribute() {}, appendChild() {}, click() {}, remove() {}, focus() {}, select() {},
  getClientRects() { return [1]; }, closest() { return null; }
});
const sandbox = {
  console, setTimeout, clearTimeout, Blob, URL, URLSearchParams,
  location: { search: '?dev=1' }, Date, Math, JSON, Intl,
  alert() {}, confirm() { return true; }, prompt() { return ''; },
  fetch: async () => ({ ok: false }),
  localStorage: { getItem() { return null; }, setItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  window: { scrollTo() {}, open() { return null; }, addEventListener() {} },
  document: {
    activeElement: null,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    contains() { return true; },
    getElementById(id) { return nodes[id] || null; },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === '.oRutin' ? (nodes.__routines || []) : []; },
    createElement() { return element(); },
    body: { appendChild() {}, insertAdjacentHTML(_where, markup) { this.lastHTML = markup; } }
  }
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
new vm.Script(source, { filename: target }).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const assert = (condition, message) => { if (!condition) throw new Error(message); };


const a = require('node:assert/strict');
const data = JSON.parse(fs.readFileSync('data/curriculum-2026-2027.json','utf8'));
a.equal(run('JSON.stringify(MUFREDAT_2026)'),JSON.stringify(data),'embedded curriculum matches maintainable data');
run(`D=varsayilan(); D.rol='rehber'; D.ayar.testTarih='2026-09-23';
D.ogr=[{ad:'Existing',no:1,sube:'12-A',alan:'SAY',aktif:true},
{ad:'New',no:2,sube:'11-A',alan:'EA',sinif:11,mufredatBaslangic:'2026-09-21',aktif:true}];`);
a.equal(run('ogrenciSinifi(D.ogr[0])'),12);
a.equal(run('!!subeSinifHatasi("12-A",11)'),true);
a.equal(run('!!subeSinifHatasi("301",11)'),true);
a.equal(run('subeSinifHatasi("11-B",11)'), '');
for(const g of [9,10,11]) {
 sandbox.grade=g;
 const count=run(`(()=>{const p=okulKonuPlani(grade); let n=0; for(const c of MUFREDAT_2026.siniflar[grade]) {
 const actual=p.flatMap(h=>h[c.ad]||[]); const expected=c.uniteler.flatMap((u,ui)=>u.kisaKonular.map((ad,ti)=>mufredatKonuAdi(grade,ui,ti,ad)));
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('topic order '+c.ad);
 for(const ad of actual) { if(ad.length>SONUC_KONU_AD_UST_SINIR || !mufredatKonuBilgisi(c.ders,ad))throw Error('identity '+ad); }
 n+=actual.length; } return n;})()`);
 a(count>100);
}
a.match(run('okulKonuPlani(11)[0].Matematik[0]'),/Nicel|İstatistik|İki/);
run(`D.konuPlani['12-A']=JSON.parse(JSON.stringify(VARSAYILAN_KONU_PLANI.SAY));
D.log=[[gunNo('2026-09-21'),0,1,4,20,0,0]]; D.elle={'0|123':{sabit:true,plan:{sentinel:1}}};`);
const frozen=run('JSON.stringify({log:D.log,elle:D.elle,katalog:KATALOG})');
const oldPlan=run('JSON.stringify(D.konuPlani["12-A"])');
run('varsayilanKonuPlaniniHazirla("12-A","SAY",12)');
a.equal(run('JSON.stringify(D.konuPlani["12-A"])'),oldPlan);
run('varsayilanKonuPlaniniHazirla("11-A","EA",11)');
a.equal(run('planHaftasi("11-A",gunNo("2026-09-21"))'),1);
a.equal(run('haftaTakvimi(2,"11-A")'),run('gunNo("2026-09-28")'));
run(`D.dersProgrami['11-A']={saatler:['09:00'],gunler:[['MATEMATİK'],[],[],[],[],[],[]]};
programUygula(gunNo('2026-09-21'),'11-A');`);
const topic=run('Object.keys(D.subeIslenis["11-A"])[0]');
a(topic,'school timetable produces topics');
sandbox.topic=+topic;
a.equal(run('konuAl(topic)[1]'),11);
a.equal(run('alanUygun(1,topic)'),true);a.equal(run('alanUygun(0,topic)'),false);
a.equal(run('alanUygun(1,1)'),false);
run(`const ci=kullaniciKonusu(1,'Öğretmenin eklediği konu',null,'Matematik',11);
if(ci!==kullaniciKonusu(1,'Öğretmenin eklediği konu',null,'Matematik',11))throw Error('custom duplication');
if(alanUygun(0,ci))throw Error('custom grade leak');`);
const pack=run('ogrenciPaketi(1)'); sandbox.pack=pack;
a.equal(run('paketiYukle(pack).ogr[0].sinif'),11);
a.equal(run('paketiYukle(pack).ogr[0].mufredatBaslangic'),'2026-09-21');
a.equal(run('JSON.stringify({log:D.log,elle:D.elle,katalog:KATALOG})'),frozen);
a(run('yksPlanEksikleri("12-A").length')>=4);
run('yksEksikleriniEkle("12-A",gunNo("2026-09-21"))');
a.equal(run('yksPlanEksikleri("12-A").length'),0);
a.equal(run('JSON.stringify({log:D.log,elle:D.elle,katalog:KATALOG})'),frozen);
for(const alan of ['SAY','EA','SÖZ','DİL']) {
 sandbox.alan=alan;
 a(run('sinifaGoreKonuPlani(12,alan).some(h=>h.Fizik?.length)'));
 a(run('sinifaGoreKonuPlani(12,alan).some(h=>h.Tarih?.length)'));
 a(run('sinifaGoreKonuPlani(12,alan).some(h=>h["Din Kültürü"]?.length)'));
}
a.equal(run('sinifaGoreKonuPlani(12,"DİL").some(h=>h["Matematik AYT"])'),false);

// Current school results roundtrip to a teacher with independent custom topic indices.
run(`D=varsayilan(); D.rol='rehber'; D.ayar.testTarih='2026-09-23';
D.ogr=[{ad:'Grade Eleven',no:11,sube:'11-A',alan:'EA',sinif:11,mufredatBaslangic:'2026-09-21',aktif:true}];
D.konuPlani['11-A']=okulKonuPlani(11); D.dersProgrami['11-A']={saatler:['09:00'],gunler:[['MATEMATİK'],[],[],[],[],[],[]]};
programUygula(gunNo('2026-09-21'),'11-A');`);
sandbox.teacher=JSON.parse(run('JSON.stringify(D)'));
run(`D=paketiYukle(ogrenciPaketi(0));const id=+Object.keys(D.subeIslenis['11-A'])[0];
sonucIsle(0,[{ki:id,gun:gunNo('2026-09-22'),not:4}]);`);
sandbox.results=run('sonucPaketi()');
run('D=teacher; sonucPaketiUygula(results);');
a.equal(run('D.log.length'),1);a.equal(run('konuAl(D.log[0][2])[1]'),11);
a.equal(run('ogrenciSinifi(D.ogr[0])'),11);
console.log('PASS: grade curricula, ordered coverage, isolation, timetable, package roundtrip and additive legacy repair');
process.exit(0);
