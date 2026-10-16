#!/usr/bin/env node
'use strict';
// Teacher top menu and main screen: menu groups (same pattern as the student's), this week's
// numbers per class (plan given, PDF requested, last week's result, weeks awaiting a decision)
// and the class average of school mock exams. Synthetic data only.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',className:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const listeners = {};
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},
  window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(t,f){(listeners[t]=listeners[t]||[]).push(f)},contains(){return true},getElementById(id){return nodes[id]||null},
    querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const assert = require('node:assert/strict');
const run = code => vm.runInContext(code, sandbox);
let passed = 0;
function check(name, fn) {
  run(`D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-14';EK={sekme:'ana',ogr:0,hafta:null,kirli:false,son:'',girisAcik:{}};
    D.ogr=[{ad:'Synthetic Ada',no:1,sube:'12-A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-10-05')},
      {ad:'Synthetic Bora',no:2,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-10-05')},
      {ad:'Synthetic Cem',no:3,sube:'12-B',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-10-05')},
      {ad:'Synthetic Silinen',no:4,sube:'12-B',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,silindi:true}];`);
  try { fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; }
}
const sekmeler = h => [...h.matchAll(/data-sekme="([^"]+)"/g)].map(m => m[1]);
const liste = (h, id) => { const m = h.match(new RegExp('id="' + id + '">(.*?)</div>')); return m ? sekmeler(m[1]) : null; };

check('teacher menu is on top, grouped like the student menu', () => {
  run('rayCiz()');
  const h = nodes.ray.innerHTML;
  assert.equal(nodes.ray.className, 'ray ust rehber');
  assert.match(h, /^<button class="marka" data-sekme="ana"/, 'the brand opens the main screen');
  // Groups: Haftalık plan ▾ · Öğrenciler ▾ · Konular ▾ · Denemeler ▾; then Ayarlar on the right.
  assert.deepEqual([...h.matchAll(/<div class="menu-grup[^"]*"><button data-sekme="([^"]+)"/g)].map(m => m[1]), ['plan', 'ogrenciler', 'konular', 'denemeler']);
  assert.deepEqual(liste(h, 'planMenusu'), ['giris', 'harita', 'rapor', 'kurtarma', 'anlasma']);
  assert.deepEqual(liste(h, 'ogrencilerMenusu'), ['takip']);
  assert.deepEqual(liste(h, 'konularMenusu'), ['konuplani', 'mufredat']);
  assert.deepEqual(liste(h, 'denemelerMenusu'), ['siralamalar']);
  assert.deepEqual(sekmeler(h.slice(h.indexOf('<div class="bosluk">'))), ['ayarlar'], 'only Ayarlar on the right');
  const hepsi = sekmeler(h), beklenen = run('SEKME_REHBER.map(s=>s[0])');
  assert.deepEqual([...new Set(hepsi.filter(x => x !== 'ana'))].sort(), [...beklenen].sort(), 'every teacher page is reachable exactly once');
  assert.equal(hepsi.length, new Set(hepsi).size);
  // A page inside a group marks its group.
  run("EK.sekme='siralamalar';rayCiz()");
  assert.match(nodes.ray.innerHTML, /<div class="menu-grup alt-secili"><button data-sekme="denemeler">/);
  assert.match(nodes.ray.innerHTML, /data-sekme="siralamalar" aria-current="page"/);
});

check('student menu keeps its layout', () => {
  run("D.rol='ogrenci';D.ogr=[D.ogr[0]];D.ogr[0].sinavTuru='YKS';rayCiz()");
  const h = nodes.ray.innerHTML;
  assert.equal(nodes.ray.className, 'ray ust');
  assert.deepEqual(liste(h, 'planMenusu'), ['harita', 'giris', 'rapor', 'kurtarma']);
  assert.deepEqual(sekmeler(h.slice(h.indexOf('<div class="bosluk">'))), ['mufredat', 'ayarlar']);
  assert.match(h, /aria-label="Planla ilgili diğer sayfalar"/);
});

check('this week per class: plan given, PDF requested, last week\'s result, weeks awaiting a decision', () => {
  const ozet = JSON.parse(run(`(() => {
    const hb = buHafta(0), onceki = oncekiHafta(0, hb), ts = Date.parse('2026-10-14T09:00:00+03:00');
    D.ogr[0].cikti = bugunNo();                 // Ada: plan given this week
    D.ogr[1].cikti = onceki;                    // Bora: plan given last week only, no result → awaiting a decision
    D.ogr[0].etkinlik = {v:1,baslangic:ts,kayit:[{tur:'pdf',hafta:hb,sonucHafta:onceki,ilk:ts,son:ts}]};
    D.log.push([onceki + 2, 0, 0, 9, 12, 1, ts]);   // Ada: a result in last week's plan
    D.log.push([onceki + 1, 3, 0, 9, 12, 1, ts]);   // deleted student: ignored
    return JSON.stringify(rehberHaftaOzeti().map(r => [r.o.ad, r.plan, r.pdf, r.sonuc, r.karar]));
  })()`));
  assert.deepEqual(ozet, [['Synthetic Ada', true, true, true, 0], ['Synthetic Bora', false, false, false, 1], ['Synthetic Cem', false, false, false, 0]]);
  const kart = run('rehberHaftaKarti()');
  assert.match(kart, /12\.10\.2026 – 18\.10\.2026/);
  assert.match(kart, /<h2>3 öğrenci <span>2 şube<\/span><\/h2>/);
  const sayilar = [...kart.matchAll(/<div class="rh-sayi[^"]*"><strong>(.*?)<\/strong><span>(.*?)<\/span>/g)].map(m => m[2] + ' ' + m[1].replace(/<[^>]+>/g, ''));
  assert.deepEqual(sayilar, ['Plan verildi 1/3', 'PDF istedi 1/3', 'Geçen haftanın sonucu 1/3', 'Karar bekleyen 1']);
  assert.match(kart, /<div class="rh-sayi uyari"><strong>1<\/strong><span>Karar bekleyen/);
  const satirlar = [...kart.matchAll(/data-ra-sube="([^"]*)"[^>]*>([^<]*)<small>(\d+) öğrenci<\/small><\/button><\/th>(.*?)<\/tr>/g)]
    .map(m => [m[1], m[3], [...m[4].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(x => x[1].replace(/<[^>]+>/g, ''))]);
  assert.deepEqual(satirlar, [['12-A', '2', ['1/2', '1/2', '1/2', '1']], ['12-B', '1', ['0/1', '0/1', '0/1', '0']]]);
  // The name opens Bora's own view; the number opens the weeks map to decide.
  assert.match(kart, /<span class="rh-ad"><button type="button" class="ogr-ad" data-ogr-gor="1" title="Öğrenci gözüyle gör">Synthetic Bora<\/button><button type="button" data-ra-harita="1"[^>]*>1<\/button><\/span>/);
  assert.doesNotMatch(kart, /Silinen/);
});

check('the fast per-student count matches the weeks map on a large notebook', () => {
  const fark = run(`(() => {
    let tohum = 7; const rastgele = n => (tohum = (tohum * 48271) % 2147483647) % n;
    D.ayar.testTarih = '2027-03-10'; const bas = gunNo('2026-08-24');
    D.ogr = Array.from({length: 40}, (_, i) => ({ad: 'S' + i, no: i, sube: '12-' + 'ABC'[i % 3], sinif: 12, alan: 'SAY', kap: 6, off: [6], aktif: true,
      ilkAktif: bas + 7 * rastgele(10), cikti: bas + rastgele(200), silindi: i === 39}));
    D.log = Array.from({length: 3000}, () => [bas + rastgele(200), rastgele(40), 0, 9, 12, 1, 1]);
    D.haftaDurum = {['3|' + (bas + 14)]: {neden: 'onemsiz', konu: 0}};
    return rehberHaftaOzeti().filter(r => r.karar !== atlananHaftalar(r.si).length ||
      r.sonuc !== haftaSonucSayisi(r.si, oncekiHafta(r.si, buHafta(r.si))) > 0).map(r => r.si);
  })()`);
  assert.deepEqual(Array.from(fark), []);
  assert(run('rehberHaftaOzeti().reduce((t, r) => t + r.karar, 0)') > 0, 'the sample has weeks awaiting a decision');
});

check('main screen: titles link to their pages, e-mail requests stay reachable', () => {
  let h = run('gorunumRehberAna()');
  assert.match(h, /<h1><button class="baslik-link" data-sekme="takip"[^>]*>Bu hafta<\/button><\/h1>/);
  assert.match(h, /<h2 class="pano-baslik"><button class="baslik-link" data-sekme="denemeler"[^>]*>Deneme ortalaması<\/button><\/h2>/);
  assert.match(h, /id="rehberHafta"/); assert.match(h, /data-ort="1"/);
  assert.doesNotMatch(h, /id="talepAc"/);
  run("EK.sifreTalepleri=[{id:'t1'},{id:'t2'}]");
  assert.match(run('gorunumRehberAna()'), /id="talepAc">E-posta talepleri \(2\)/);
  run("EK.sekme='ana';cizIc()");
  assert.match(nodes.ana.innerHTML, /class="ana-pano rehber-pano"/, 'the teacher main screen is drawn');
});

check('a student name opens that student\'s view: one student\'s data, student role, no cloud module', () => {
  const ad = run('ogrAdDugmesi(0)');
  assert.equal(ad, '<button type="button" class="ogr-ad" data-ogr-gor="0" title="Öğrenci gözüyle gör">Synthetic Ada</button>');
  assert.equal(run('ogrAdDugmesi(3)'), 'Synthetic Silinen', 'a deleted student is plain text');
  assert.equal(run("ogrAdDugmesi(1,'<b>x</b>')").includes('&lt;b&gt;x&lt;/b&gt;'), true, 'escaped');
  run("D.ogr[0].syncId='synthetic-sync';D.ogr[1].denemeOkul=[{id:'p:b',ad:'Bora sınavı',tarih:'2026-10-01',tur:'TYT',oturum:'TYT',brans:'',alan:'SAY',dersler:[],sure:null,puan:null,ts:1}]");
  const belge = run('ogrenciGozuyleBelgesi(0)');
  const hazirlik = belge.indexOf('window.YKS_ONIZLEME = true'), uygulama = belge.indexOf('<script id="uygulama">');
  assert(hazirlik > 0 && hazirlik < uygulama, 'memory storage is set up before the app runs');
  assert.doesNotMatch(belge, /type="module"/, 'no Firebase module');
  const veri = JSON.parse(belge.slice(belge.indexOf('id="veri" type="application/json">') + 34, belge.indexOf('</script>', belge.indexOf('id="veri"'))));
  assert.equal(veri.rol, 'ogrenci'); assert.equal(veri.ogr.length, 1); assert.equal(veri.ogr[0].ad, 'Synthetic Ada');
  for (const baska of ['Synthetic Bora', 'Synthetic Cem', 'Bora sınavı']) assert(!belge.includes(baska), baska + ' must not be in Ada\'s view');
  assert.equal(run('ONIZLEME_MODU'), false, 'the teacher page itself is not a preview');
  run("D.rol='ogrenci'"); assert.equal(run('ogrAdDugmesi(0)'), 'Synthetic Ada', 'students see plain names');
  assert.equal(run('ogrenciGozuyleAc(0)'), false);
});

check('mock exam average per exam, per class and per field', () => {
  run(`(() => {
    const ders = n => DENEME_DERSLER.TYT.map(d => ({kod:d[0],soru:d[2],dogru:d[0]==='turkce'?n:0,yanlis:0}));
    const ayt = n => DENEME_DERSLER.AYT.map(d => ({kod:d[0],soru:d[2],dogru:d[0]==='mat'?n:0,yanlis:0}));
    const k = (id, ad, tarih, tur, dersler, ek) => ({id,ad,tarih,tur,oturum:tur,dersler,sure:null,puan:null,ts:1,...(ek||{})});
    D.ogr[0].denemeOkul = [k('p:a1','Deneme 1','2026-09-20','TYT',ders(30)), k('p:a2','deneme  2','2026-10-04','TYT',ders(36)), k('p:a3','Deneme 2','2026-10-04','AYT',ayt(20))];
    D.ogr[1].denemeOkul = [k('p:b1','Deneme 1','2026-09-20','TYT',ders(20)), k('p:b2','Deneme 2','2026-10-04','AYT',ayt(10)),
      k('p:b3','Eski','2026-09-01','TYT',ders(5),{silindi:true})];
    D.ogr[2].denemeOkul = [k('p:c1','Deneme 1','2026-09-20','TYT',ders(10)), k('p:c2','Deneme 2','2026-10-04','TYT',ders(30)), k('p:c3','Deneme 2','2026-10-04','AYT',ayt(30))];
    D.ogr[3].denemeOkul = [k('p:d1','Deneme 1','2026-09-20','TYT',ders(40))];   // deleted student
    D.ogr[0].denemeler = [k('m:own','Kendi','2026-10-01','TYT',ders(40))];       // student's own exam: not a school exam
  })()`);
  const nokta = () => JSON.parse(run('JSON.stringify(denemeOrtalamaVerisi().noktalar.map(n=>[n.r.tarih,n.v,n.r.ad]))'));
  assert.deepEqual(nokta(), [['2026-09-20', 20, 'Deneme 1 · 3 öğrenci ortalaması'], ['2026-10-04', 33, 'deneme  2 · 2 öğrenci ortalaması']]);
  run("EK.anaSube='12-A'");
  assert.deepEqual(nokta().map(n => n[1]), [25, 36]);
  run("EK.anaSube='yok'");
  assert.equal(run('denemeOrtalamaVerisi().sube'), '', 'an unknown class falls back to all');
  run("EK.anaSube='';EK.anaDenemeTur='AYT'");
  assert.deepEqual(nokta(), [['2026-10-04', 25, 'Deneme 2 · 2 öğrenci ortalaması']], 'AYT SAY: only SAY students');
  run("EK.anaDenemeAlan='EA'");
  assert.deepEqual(nokta().map(n => n[1]), [10]);
  const h = run('denemeOrtalamaGrafigi()');
  assert.match(h, /data-dn-ort-tur="AYT"/); assert.match(h, /aria-pressed="true" data-dn-ort-alan="EA"/);
  assert.match(h, /<select id="dnOrtSube"><option value="">Tümü<\/option><option value="12-A">12-A<\/option><option value="12-B">12-B<\/option><\/select>/);
  assert.match(h, /data-dn-yol="o:AYT:[^"]+"[^>]*aria-label="AYT EA · Deneme 2 · 1 öğrenci ortalaması · 2026-10-04 · 10 net\. Denemeler’de aç"/);
  assert.doesNotMatch(h, /Hedef/, 'no target line for a class average');
  // A point opens Denemeler with that exam type (and field).
  run("ciz=()=>{};denemeYolAc('o:AYT:x')");
  assert.deepEqual(JSON.parse(run('JSON.stringify([EK.sekme,EK.denemeTur,EK.denemeAlan])')), ['denemeler', 'AYT', 'EA']);
  run("D.ogr.forEach(o=>{o.denemeOkul=[]});EK.anaDenemeTur='TYT'");
  assert.match(run('denemeOrtalamaGrafigi()'), /Henüz TYT denemesi yok/);
});

console.log('teacher home regression: ' + passed + ' checks passed');
