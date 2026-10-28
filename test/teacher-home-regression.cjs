#!/usr/bin/env node
'use strict';
// Teacher top menu and main screen: menu groups (same pattern as the student's), this week's
// plan-given students (PDF requested and last week's result as small numbers) and the class
// average of school mock exams. Synthetic data only.
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
const checks = [];
function check(name, fn) { checks.push([name, fn]); }
function reset() {
  run(`D=varsayilan();D.rol='rehber';D.ayar.testTarih='2026-10-14';EK={sekme:'ana',ogr:0,hafta:null,kirli:false,son:'',girisAcik:{}};
    D.ogr=[{ad:'Synthetic Ada',no:1,sube:'12-A',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-10-05')},
      {ad:'Synthetic Bora',no:2,sube:'12-A',sinif:12,alan:'EA',kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-10-05')},
      {ad:'Synthetic Cem',no:3,sube:'12-B',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-10-05')},
      {ad:'Synthetic Silinen',no:4,sube:'12-B',sinif:12,alan:'SAY',kap:6,off:[6],aktif:true,silindi:true}];`);
}
const sekmeler = h => [...h.matchAll(/data-sekme="([^"]+)"/g)].map(m => m[1]);
const liste = (h, id) => { const m = h.match(new RegExp('id="' + id + '">(.*?)</div>')); return m ? sekmeler(m[1]) : null; };

check('teacher menu is on top, grouped like the student menu', () => {
  run('rayCiz()');
  const h = nodes.ray.innerHTML;
  assert.equal(nodes.ray.className, 'ray ust rehber');
  assert.match(h, /^<button class="marka" data-sekme="ana"/, 'the brand opens the main screen');
  // Groups: Haftalık plan ▾ · Öğrenciler ▾ · Denemeler ▾; Müfredat and Ayarlar on the right.
  assert.deepEqual([...h.matchAll(/<div class="menu-grup[^"]*"><button data-sekme="([^"]+)"/g)].map(m => m[1]), ['plan', 'ogrenciler', 'denemeler']);
  assert.deepEqual(liste(h, 'planMenusu'), ['giris', 'harita']);
  assert.deepEqual(liste(h, 'ogrencilerMenusu'), ['takip', 'etutler', 'etutetki', 'etutplani', 'yoklama', 'ogrencirapor']);
  assert.deepEqual(liste(h, 'denemelerMenusu'), ['siralamalar', 'turkiye']);
  assert.deepEqual(sekmeler(h.slice(h.indexOf('<div class="bosluk">'))), ['mufredat', 'ayarlar'], 'Müfredat and Ayarlar on the right');
  // Konular and the class curricula open from Müfredat; past-plan recovery from a red week on the map.
  const hepsi = sekmeler(h), beklenen = run('SEKME_REHBER.map(s=>s[0])').filter(x => !['konular', 'konuplani', 'kurtarma'].includes(x));
  assert.deepEqual([...new Set(hepsi.filter(x => x !== 'ana'))].sort(), [...beklenen].sort(), 'every menu page is reachable exactly once');
  assert.equal(hepsi.length, new Set(hepsi).size);
  for (const gone of ['rapor', 'anlasma']) assert(!run('SEKME_REHBER.map(s=>s[0])').includes(gone), gone + ' is removed');
  // A page inside a group marks its group; pages outside the menu mark where they open from.
  run("EK.sekme='siralamalar';rayCiz()");
  assert.match(nodes.ray.innerHTML, /<div class="menu-grup alt-secili"><button data-sekme="denemeler">/);
  assert.match(nodes.ray.innerHTML, /data-sekme="siralamalar" aria-current="page"/);
  run("EK.sekme='konuplani';rayCiz()"); assert.match(nodes.ray.innerHTML, /data-sekme="mufredat" aria-current="page"/);
  run("EK.sekme='kurtarma';rayCiz()"); assert.match(nodes.ray.innerHTML, /<div class="menu-grup alt-secili"><button data-sekme="plan">/);
});

check('student menu keeps its layout', () => {
  run("D.rol='ogrenci';D.ogr=[D.ogr[0]];D.ogr[0].sinavTuru='YKS';rayCiz()");
  const h = nodes.ray.innerHTML;
  assert.equal(nodes.ray.className, 'ray ust');
  assert.deepEqual(liste(h, 'planMenusu'), ['harita', 'giris'], 'no Karnem, no Geçmiş plan kurtar (red weeks open it)');
  assert.deepEqual(sekmeler(h.slice(h.indexOf('<div class="bosluk">'))), ['mufredat', 'ayarlar']);
  assert.match(h, /aria-label="Planla ilgili diğer sayfalar"/);
});

check('this week: names of students given the plan; PDF requested and last week\'s result small below', () => {
  const ozet = JSON.parse(run(`(() => {
    const hb = buHafta(0), onceki = oncekiHafta(0, hb), ts = Date.parse('2026-10-14T09:00:00+03:00');
    D.ogr[0].cikti = bugunNo();                 // Ada: plan given this week
    D.ogr[2].cikti = bugunNo();                 // Cem: plan given this week
    D.ogr[1].cikti = onceki;                    // Bora: plan given last week only
    D.ogr[3].cikti = bugunNo();                 // deleted student: ignored
    D.ogr[0].etkinlik = {v:1,baslangic:ts,kayit:[{tur:'pdf',hafta:hb,sonucHafta:onceki,ilk:ts,son:ts}]};
    D.log.push([onceki + 2, 0, 0, 9, 12, 1, ts]);   // Ada: a result in last week's plan
    D.log.push([onceki + 1, 3, 0, 9, 12, 1, ts]);   // deleted student: ignored
    return JSON.stringify(rehberHaftaOzeti().map(r => [r.o.ad, r.plan, r.pdf, r.sonuc]));
  })()`));
  assert.deepEqual(ozet, [['Synthetic Ada', true, true, true], ['Synthetic Bora', false, false, false], ['Synthetic Cem', true, false, false]]);
  const kart = run('rehberHaftaKarti()');
  assert.match(kart, /12\.10\.2026 – 18\.10\.2026/);
  assert.match(kart, /<h2 class="rh-plan">2<small>\/3<\/small> <span>Plan verildi<\/span><\/h2>/);
  // Only the names of students given this week's plan; each opens that student's own view.
  assert.deepEqual([...kart.matchAll(/<li><button type="button" class="ogr-ad" data-ogr-gor="(\d+)"[^>]*>([^<]*)<\/button><\/li>/g)].map(m => [m[1], m[2]]),
    [['0', 'Synthetic Ada'], ['2', 'Synthetic Cem']]);
  const kucuk = [...kart.matchAll(/<div class="rh-sayi"><strong>(.*?)<\/strong><span>(.*?)<\/span>/g)].map(m => m[2] + ' ' + m[1].replace(/<[^>]+>/g, ''));
  assert.deepEqual(kucuk, ['PDF istedi 1/3', 'Geçen haftanın sonucu 1/3']);
  assert.ok(kart.indexOf('rh-adlar') < kart.indexOf('rh-ikincil'), 'the small numbers come after the names');
  for (const gone of [/Karar bekleyen/, /şube/i, /data-ra-/, /Silinen/]) assert.doesNotMatch(kart, gone);
  // Nobody given a plan yet: no list, just 0/n.
  run('D.ogr.forEach(o => { delete o.cikti; })');
  const bos = run('rehberHaftaKarti()');
  assert.match(bos, /<h2 class="rh-plan">0<small>\/3<\/small>/); assert.doesNotMatch(bos, /rh-adlar/);
});

check('the fast per-student result count matches haftaSonucSayisi on a large notebook', () => {
  const fark = run(`(() => {
    let tohum = 7; const rastgele = n => (tohum = (tohum * 48271) % 2147483647) % n;
    D.ayar.testTarih = '2027-03-10'; const bas = gunNo('2026-08-24');
    D.ogr = Array.from({length: 40}, (_, i) => ({ad: 'S' + i, no: i, sube: '12-' + 'ABC'[i % 3], sinif: 12, alan: 'SAY', kap: 6, off: [6], aktif: true,
      ilkAktif: bas + 7 * rastgele(10), cikti: bas + rastgele(200), silindi: i === 39}));
    D.log = Array.from({length: 3000}, () => [bas + rastgele(200), rastgele(40), 0, 9, 12, 1, 1]);
    D.elle = {}; for (let i = 0; i < 40; i++) for (let w = 0; w < 28; w++) if (!rastgele(3)) D.elle[i + '|' + (bas + 7 * w)] = {sabit: bas + 7 * w};
    return rehberHaftaOzeti().filter(r => r.sonuc !== haftaSonucSayisi(r.si, oncekiHafta(r.si, buHafta(r.si))) > 0).map(r => r.si);
  })()`);
  assert.deepEqual(Array.from(fark), []);
  assert(run('rehberHaftaOzeti().some(r => r.sonuc) && rehberHaftaOzeti().some(r => !r.sonuc)'), 'the sample has both');
});

check('weeks map: printed without result is grey (Nasıl geçti?), not printed is red (Planı kurtar)', () => {
  const r = JSON.parse(run(`(() => {
    const ilk = gunNo('2026-09-21'); D.ogr[0].ilkAktif = ilk; D.ogr[0].cikti = bugunNo();
    D.elle = {['0|' + ilk]: {ek: [], sil: [], yer: {}, soru: {}, degisim: {}, konuSlot: {}, sabit: ilk}};
    D.log.push([ilk + 7 + 1, 0, 0, 9, 12, 1, 1]);
    const d = h => haftaHaritaDurumu(0, h, haftaBaslangici(D.ogr[0]), buHafta(0)).durum;
    EK.ogr = 0;
    return JSON.stringify({durum: [d(ilk), d(ilk + 7), d(ilk + 14), d(ilk - 7)], harita: gorunumHaritasi(), karar: atlananHaftalar(0)});
  })()`));
  assert.deepEqual(r.durum, ['atlandi', 'tamam', 'kayitsiz', 'gelecek'], 'printed+no result, result, not printed, before joining');
  assert.match(r.harita, /haritaHucre atlandi"[^]*?data-haritaAc="\d+">Nasıl geçti\?/);
  assert.match(r.harita, /haritaHucre kayitsiz"[^]*?plan verilmedi[^]*?data-harita-kurtar="\d+">Planı kurtar/);
  assert.equal(r.karar.length, 1, 'only the grey week awaits a decision');
});

check('Müfredat: designed curricula per class, design your own, MEB tab; the class page is its custom curriculum', async () => {
  run("D.konuPlani={'12-A':sinifaGoreKonuPlani(12,'SAY')};EK.mufredatGorunum=undefined;EK.mufredatTasarla=false;kaydet=async()=>true");
  let h = run('gorunumMufredat()');
  assert.match(h, /<h1>Müfredat<\/h1>/);
  assert.match(h, /aria-pressed="true" data-mufredat-gor="tasarim">Tasarlanmış müfredatlar/);
  assert.deepEqual([...h.matchAll(/data-mufredat-sube="([^"]+)"/g)].map(m => m[1]), ['12-A', '12-B']);
  assert.match(h, /data-mufredat-sube="12-A"><b>12-A<\/b><span>12\. sınıf · SAY, EA · 2 öğrenci<\/span><span class="mini">\d+ ders · \d+ konu<\/span>/);
  assert.match(h, /data-mufredat-sube="12-B">[^]*?müfredat yok/);
  assert.match(h, /id="mufredatTasarlaAc">\+ Kendi müfredatını tasarla/);
  run("EK.mufredatGorunum='meb'"); assert.match(run('gorunumMufredat()'), /id="mufredatSinif"/);
  run("D.rol='ogrenci'"); assert.match(run('gorunumMufredat()'), /<h1>Müfredat ve kaynaklar<\/h1>/, 'students keep the MEB page'); run("D.rol='rehber'");
  // Design: from the MEB suggestion for a class without students, or as a copy of another class.
  assert.equal(await run("mufredatOlustur('305',11,'SAY','')"), '305');
  assert.deepEqual(JSON.parse(run('JSON.stringify([Array.isArray(D.konuPlani["305"]),D.mufredatSinif,subeSinifi("305")])')), [true, {'305': 11}, 11]);
  assert.equal(await run("mufredatOlustur('12-B',12,'SAY','12-A')"), '12-B');
  assert.equal(run('JSON.stringify(D.konuPlani["12-B"])===JSON.stringify(D.konuPlani["12-A"])&&D.konuPlani["12-B"]!==D.konuPlani["12-A"]'), true, 'a separate copy');
  assert.equal(run('D.mufredatSinif["12-B"]'), undefined, 'a class with students takes its grade from them');
  await assert.rejects(run("mufredatOlustur('305',11,'SAY','')"), /zaten var/);
  await assert.rejects(run("mufredatOlustur('',11,'SAY','')"), /1–40/);
  run("kaydet=async()=>false"); await assert.rejects(run("mufredatOlustur('306',10,'SAY','')"), /kaydedilemedi/);
  assert.equal(run('"306" in D.konuPlani'), false, 'a failed save changes nothing'); run("kaydet=async()=>true");
  run("YG=yalnizcaGoruntuleme;yalnizcaGoruntuleme=()=>true");
  try { await assert.rejects(run("mufredatOlustur('307',10,'SAY','')"), /görüntüleme/); assert.doesNotMatch(run('gorunumMufredat()'), /mufredatTasarlaAc/); }
  finally { run('yalnizcaGoruntuleme=YG'); }
  run("EK.sekme='konuplani';EK.sube='305'"); h = run('gorunumKonuPlani()');
  assert.match(h, /<h1>Özel tasarlanmış müfredat<\/h1><p>305<\/p>/);
  assert.match(h, /data-sekme="konular">Konular ve işleniş tarihleri/);
  assert.match(h, /<option selected>305<\/option>/, 'a designed class is in the class list');
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
  assert.doesNotMatch(h, /class="yg-hedef"/, 'no target line until the teacher sets one');
  // A point opens Denemeler with that exam type (and field).
  run("ciz=()=>{};denemeYolAc('o:AYT:x')");
  assert.deepEqual(JSON.parse(run('JSON.stringify([EK.sekme,EK.denemeTur,EK.denemeAlan])')), ['denemeler', 'AYT', 'EA']);
  run("D.ogr.forEach(o=>{o.denemeOkul=[]});EK.anaDenemeTur='TYT'");
  assert.match(run('denemeOrtalamaGrafigi()'), /Henüz TYT denemesi yok/);
});

check('class average: top/bottom groups per exam or by overall average, teacher target with class override', () => {
  run(`(() => {
    const ders = n => DENEME_DERSLER.TYT.map(d => ({kod:d[0],soru:d[2],dogru:d[0]==='turkce'?n:0,yanlis:0}));
    const k = (id, tarih, n) => ({id,ad:'Deneme '+tarih,tarih,tur:'TYT',oturum:'TYT',brans:'',alan:'SAY',dersler:ders(n),sure:null,puan:null,ts:1});
    // Ten students in two classes, two exams. Exam 1 nets 10..19 (student i: 10+i); exam 2 reverses the order.
    D.ogr = Array.from({length:10}, (_, i) => ({ad:'S'+i, no:i+1, sube:i<5?'12-A':'12-B', sinif:12, alan:'SAY', kap:6, off:[6], aktif:true,
      denemeOkul:[k('p:'+i+'a','2026-09-20',10+i), k('p:'+i+'b','2026-10-04',30-i)]}));
    EK.anaDenemeTur='TYT'; EK.anaSube=''; EK.anaGrup=''; EK.anaGrupMod='deneme';
  })()`);
  const v = () => JSON.parse(run('JSON.stringify(denemeOrtalamaVerisi().noktalar.map(n=>n.v))'));
  assert.deepEqual(v(), [14.5, 25.5], 'everyone');
  // Per exam: each exam's own top 20% (2 of 10) and bottom 40% (4 of 10).
  run("EK.anaGrup='ust20'"); assert.deepEqual(v(), [18.5, 29.5]);
  run("EK.anaGrup='alt40'"); assert.deepEqual(v(), [11.5, 22.5]);
  run("EK.anaGrup='ust60'"); assert.deepEqual(v(), [16.5, 27.5], '6 of 10');
  // By overall average: everyone averages 20, ties break by order, so the group is fixed (S0, S1 for top 20%).
  run("EK.anaGrup='ust20';EK.anaGrupMod='genel'"); assert.deepEqual(v(), [10.5, 29.5], 'the same two students in both exams');
  assert.match(run('denemeOrtalamaVerisi().noktalar[0].r.ad'), /2 öğrenci ortalaması \(Üst %20\)/);
  run("EK.anaGrup='bilinmeyen'"); assert.deepEqual(v(), [14.5, 25.5], 'an unknown group is everyone');
  let h = run('denemeOrtalamaGrafigi()');
  assert.deepEqual([...h.match(/<select id="dnOrtGrup">(.*?)<\/select>/)[1].matchAll(/>([^<]+)<\/option>/g)].map(m => m[1]),
    ['Tüm öğrenciler', 'Üst %20', 'Üst %40', 'Üst %60', 'Alt %60', 'Alt %40', 'Alt %20']);
  assert.doesNotMatch(h, /data-dn-ort-mod/, 'the mode appears with a group');
  run("EK.anaGrup='alt20'"); h = run('denemeOrtalamaGrafigi()');
  assert.match(h, /aria-pressed="true" data-dn-ort-mod="genel">Genel ortalamaya göre/);
  // Target: the school's line, a class may override it; only the teacher sees and edits it.
  run("EK.anaGrup='';D.denemeOrtHedef={TYT:{'':24,'12-B':28}}");
  assert.equal(run('denemeOrtalamaVerisi().hedef'), 24);
  run("EK.anaSube='12-A'"); assert.equal(run('denemeOrtalamaVerisi().hedef'), 24, '12-A uses the school target');
  h = run('denemeOrtalamaGrafigi()');
  assert.match(h, /id="dnOrtHedef"[^>]*value=""[^>]*placeholder="24"/, '12-A has no target of its own');
  run("EK.anaSube='12-B'"); assert.equal(run('denemeOrtalamaVerisi().hedef'), 28, '12-B overrides');
  h = run('denemeOrtalamaGrafigi()');
  assert.match(h, /class="yg-hedef"/); assert.match(h, /Hedef 28/); assert.match(h, /id="dnOrtHedef"[^>]*value="28"/);
  run("EK.anaDenemeTur='AYT'"); assert.equal(run('denemeOrtalamaVerisi().hedef'), null, 'AYT SAY has its own target');
  // Kept through a backup; bad values are dropped on load.
  run("D.denemeOrtHedef={TYT:{'':24,'x':-3},'AYT:SAY':{'':'40'},bad:{'':5}};veriyiHazirla(D)");
  assert.deepEqual(JSON.parse(run('JSON.stringify(D.denemeOrtHedef)')), {TYT:{'':24}});
  // View-only teachers see the line but not the input.
  run("EK.anaDenemeTur='TYT';EK.anaSube='';IZLEME={sahipUid:'a',izleyiciUid:'b'}");
  h = run('denemeOrtalamaGrafigi()'); assert.match(h, /Hedef 24/); assert.doesNotMatch(h, /dnOrtHedef/);
  run('IZLEME=null');
  // The student's package does not carry the teacher's targets.
  assert.equal(run('JSON.stringify(ogrenciPaketi(0)).includes("denemeOrtHedef")'), false);
  // The teacher's Denemeler page shows the class average above the student's exams.
  run("EK.sekme='denemeler';EK.ogr=0;EK.denemeKlasik=true");
  const sayfa = run('gorunumDenemeler()');
  assert(sayfa.indexOf('aria-label="Deneme ortalaması"') > 0 && sayfa.indexOf('aria-label="Deneme ortalaması"') < sayfa.indexOf('data-dn-tur="TYT"'));
});

check('class average never mixes grades: one grade at a time, 12 by default, each with its own target', () => {
  run(`(() => {
    const ders = n => DENEME_DERSLER.TYT.map(d => ({kod:d[0],soru:d[2],dogru:d[0]==='turkce'?n:0,yanlis:0}));
    const k = (id, n) => ({id,ad:'Deneme 1',tarih:'2026-10-04',tur:'TYT',oturum:'TYT',brans:'',alan:'SAY',dersler:ders(n),sure:null,puan:null,ts:1});
    const o = (i, sube, sinif, n) => ({ad:'S'+i, no:i+1, sube, ...(sinif ? {sinif} : {}), alan:'SAY', kap:6, off:[6], aktif:true, denemeOkul:[k('p:'+i, n)]});
    // The same exam name and date in both grades. One 12th grader has no grade on record (an older
    // notebook: counts as 12); one 11th grader has it only in the class name "11/B".
    D.ogr = [o(0,'12-A',12,30), o(1,'201',0,20), o(2,'11-A',11,10), o(3,'11/B',0,6),
      {ad:'S4', no:5, sube:'10-A', sinif:10, alan:'SAY', kap:6, off:[6], aktif:true}];   // no exams: no 10th-grade option
    EK.anaDenemeTur='TYT'; EK.anaSube=''; EK.anaGrup=''; delete EK.anaSinif;
    D.denemeOrtHedef={TYT:{'':24},'11:TYT':{'':12}};
  })()`);
  const veri = () => JSON.parse(run('JSON.stringify((v => ({sinif:v.sinif, siniflar:v.siniflar, sube:v.sube, hedef:v.hedef, n:v.noktalar.map(n => [n.v, n.r.ad])}))(denemeOrtalamaVerisi()))'));
  assert.deepEqual(veri(), {sinif:12, siniflar:[12, 11], sube:'', hedef:24, n:[[25, 'Deneme 1 · 2 öğrenci ortalaması']]}, '12th grade only, not (30+20+10+6)/4');
  let h = run('denemeOrtalamaGrafigi()');
  assert.match(h, /<select id="dnOrtSinif"><option value="12" selected>12\. sınıf<\/option><option value="11">11\. sınıf<\/option><\/select>/);
  assert.deepEqual([...h.match(/<select id="dnOrtSube">(.*?)<\/select>/)[1].matchAll(/value="([^"]*)"/g)].map(m => m[1]), ['', '12-A', '201'], "12th grade's classes only");
  assert.match(h, /<small>TYT · 12\. sınıf<\/small>/);
  run("EK.anaSinif=11");
  assert.deepEqual(veri(), {sinif:11, siniflar:[12, 11], sube:'', hedef:12, n:[[8, 'Deneme 1 · 2 öğrenci ortalaması']]}, "11th grade with its own target");
  run("EK.anaSube='12-A'"); assert.equal(veri().sube, '', "another grade's class is ignored");
  run("EK.anaSube='11/B'"); assert.deepEqual(veri().n.map(x => x[0]), [6]);
  run("EK.anaSube='';EK.anaSinif=9"); assert.equal(veri().sinif, 12, 'a grade without exams falls back to the top grade');
  // A target saved for the 11th grade is kept through a load; an unknown grade prefix is dropped.
  run("D.denemeOrtHedef={TYT:{'':24},'11:TYT':{'':12,'11-A':14},'13:TYT':{'':5}};veriyiHazirla(D)");
  assert.deepEqual(JSON.parse(run('JSON.stringify(D.denemeOrtHedef)')), {TYT:{'':24}, '11:TYT':{'':12,'11-A':14}});
  // One grade only: no grade selector, and the label stays "okul".
  run("D.ogr.forEach(o => { o.sinif = 12; }); delete EK.anaSinif");
  h = run('denemeOrtalamaGrafigi()');
  assert.doesNotMatch(h, /dnOrtSinif/); assert.match(h, /<small>TYT · okul<\/small>/);
});

(async () => {
  for (const [name, fn] of checks) {
    reset();
    try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; }
  }
  console.log('teacher home regression: ' + passed + ' checks passed');
})();
