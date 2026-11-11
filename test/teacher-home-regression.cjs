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
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
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
  assert.deepEqual(liste(h, 'ogrencilerMenusu'), ['takip', 'etutler', 'etutetki', 'etutplani', 'yoklama', 'ogrencirapor', 'gunlukrapor']);
  assert.deepEqual(liste(h, 'denemelerMenusu'), ['siralamalar', 'turkiye', 'konutakibi', 'yanlislar', 'universite']);
  assert.deepEqual(sekmeler(h.slice(h.indexOf('<div class="bosluk">'))), ['mufredat', 'ayarlar'], 'Müfredat and Ayarlar on the right');
  // Konular and the class curricula open from Müfredat; past-plan recovery from a red week on the map.
  const hepsi = sekmeler(h), beklenen = run('SEKME_REHBER.map(s=>s[0])').filter(x => !['konular', 'konuplani', 'kurtarma', 'ogrencikarti'].includes(x));
  assert.deepEqual([...new Set(hepsi.filter(x => x !== 'ana'))].sort(), [...beklenen].sort(), 'every menu page is reachable exactly once');
  assert.equal(hepsi.length, new Set(hepsi).size);
  for (const gone of ['rapor', 'anlasma']) assert(!run('SEKME_REHBER.map(s=>s[0])').includes(gone), gone + ' is removed');
  // A page inside a group marks its group; pages outside the menu mark where they open from.
  run("EK.sekme='siralamalar';rayCiz()");
  assert.match(nodes.ray.innerHTML, /<div class="menu-grup alt-secili"><button data-sekme="denemeler">/);
  assert.match(nodes.ray.innerHTML, /data-sekme="siralamalar" aria-current="page"/);
  run("EK.sekme='ogrencikarti';rayCiz()"); assert.match(nodes.ray.innerHTML, /<div class="menu-grup[^"]*"><button data-sekme="ogrenciler" aria-current="page">/, 'Öğrenci kartı opens from names and marks Öğrenciler');
  run("EK.sekme='konuplani';rayCiz()"); assert.match(nodes.ray.innerHTML, /data-sekme="mufredat" aria-current="page"/);
  run("EK.sekme='kurtarma';rayCiz()"); assert.match(nodes.ray.innerHTML, /<div class="menu-grup alt-secili"><button data-sekme="plan">/);
});

check('student menu keeps its layout', () => {
  run("D.rol='ogrenci';D.ogr=[D.ogr[0]];D.ogr[0].sinavTuru='YKS';rayCiz()");
  const h = nodes.ray.innerHTML;
  assert.equal(nodes.ray.className, 'ray ust');
  assert.deepEqual(liste(h, 'planMenusu'), ['hafiza', 'harita', 'giris'], 'Hafızam first; no Karnem, no Geçmiş plan kurtar (red weeks open it)');
  assert.deepEqual(sekmeler(h.slice(h.indexOf('<div class="bosluk">'))), ['mufredat', 'ayarlar']);
  assert.match(h, /aria-label="Planla ilgili diğer sayfalar"/);
  assert(!h.includes('data-sekme="universite"') && !h.includes('Üniversite Hedefi'), 'no Üniversite Hedefi for students');
  assert.equal(liste(h, 'denemelerMenusu'), null, 'Denemelerim has no submenu');
  assert(!run('SEKMELER().map(s=>s[0])').includes('universite') && !run('MENU_OGRENCI.flatMap(m=>m[1])').includes('universite'));
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

check('Dikkat: a student given a plan last week who entered no result gets the notebook\'s own flag; the home page carries the card', () => {
  const ek = JSON.parse(run(`(() => {
    const hb = buHafta(0), onceki = oncekiHafta(0, hb), ts = Date.parse('2026-10-14T09:00:00+03:00');
    D.ogr[0].cikti = onceki; D.ogr[0].no = 501;  // Ada: plan last week, a result → no flag
    D.ogr[1].cikti = onceki; D.ogr[1].no = 502;  // Bora: plan last week, no result → flag (by school number)
    D.ogr[2].cikti = bugunNo(); delete D.ogr[2].no; // Cem: plan this week only → no flag
    D.ogr[3].cikti = onceki;                     // deleted student: ignored
    D.log.push([onceki + 2, 0, 0, 9, 12, 1, ts]);
    return JSON.stringify([...rehberDikkatEkleri()]);
  })()`));
  assert.deepEqual(ek, [['502', { ad: 'Synthetic Bora', sinif: ek[0][1].sinif, si: 1,
    isaretler: [{ tur: 'sonuc', puan: 1, yazi: 'Geçen haftanın sonucu yok', aciklama: 'Geçen hafta planı verildi, o haftaya hiç test sonucu girilmedi.' }] }]]);
  // A student without a school number is keyed by her place in the notebook.
  assert.deepEqual(JSON.parse(run(`(() => { delete D.ogr[1].no; return JSON.stringify([...rehberDikkatEkleri().keys()]); })()`)), ['si:1']);
  const ana = run('gorunumRehberAna()');
  assert.match(ana, /<section class="kart rehber-dikkat" id="rehberDikkat"/);
  assert.match(ana, /<h2 class="rd-baslik">1 <span>öğrenci ilgi bekliyor<\/span><\/h2>/);
  assert.match(ana, /<span class="rd-kim"><button type="button" class="ogr-ad" data-ogr-gor="1"[^>]*>Synthetic Bora<\/button>/, 'not in the school lists: the name opens her own view');
  assert.match(ana, /<button type="button" class="rd-isaret rd-p1" data-rd-neden title="Geçen hafta planı verildi, o haftaya hiç test sonucu girilmedi.">Geçen haftanın sonucu yok<\/button>/);
  assert.ok(ana.indexOf('id="rehberHafta"') < ana.indexOf('id="rehberDikkat"'), 'under the two cards of the week');
  run("D.rol='ogrenci'"); assert.equal(run('rehberDikkatKarti()'), '', 'teachers only'); run("D.rol='rehber'");
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
  // The class average lives on the teacher home; a student's own Deneme panosu (opened by the teacher) shows only that student.
  assert(run('gorunumRehberAna()').includes('aria-label="Deneme ortalaması"'));
  run("EK.sekme='denemeler';EK.ogr=0;denemeKisiAc(0)");
  const sayfa = run('gorunumDenemeler()');
  assert(!sayfa.includes('aria-label="Deneme ortalaması"') && sayfa.includes('id="dpSinifaDon"') && sayfa.includes('data-dn-tur="TYT"'));
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

// ---- the school lists (the Deneme panosu's source) ----
// Synthetic Sıralamalar lists written straight into D.siralama: rows are [no, class, TYT Türkçe net, AYT Matematik net or null].
const listeKur = (sinavlar) => run(`(() => {
  const satir = (no, snf, tur, mat) => {
    const K = mat === null ? 11 : 24, n = Array(K).fill(null), dy = Array(K).fill(null);
    n[0] = tur; dy[0] = tur + '/0'; n[1] = 0; dy[1] = '0/0';
    if (mat !== null) { n[19] = mat; dy[19] = mat + '/0'; n[21] = 0; dy[21] = '1/0'; n[22] = 0; dy[22] = '0/0'; n[23] = 0; dy[23] = '0/0'; n[20] = 0; dy[20] = '0/0'; }
    return {no: String(no), ad: denemeAdAnahtari(({1: 'Synthetic Ada', 2: 'Synthetic Bora', 3: 'Synthetic Cem'})[no] || 'SENTETIK ' + no), snf, n, dy, p: [0, 0, 0, 0], r: ['', '', '', '']};
  };
  const slot = (tarih, rows, ayt) => ({tarih, katilim: ['', '', ''], kurum: null, ogr: rows.map(r => satir(r[0], r[1], r[2], ayt ? r[3] : null))});
  D.siralama = {surum: 1, tercih: {}, sinavlar: ${JSON.stringify(sinavlar)}.map((x, i) => ({id: denemeAdAnahtari(x.ad), ad: x.ad, okul: 'Sentetik Okul', ts: 1000 + i,
    T: ayt0(x) ? null : slot(x.tarih, x.rows, false), F: ayt0(x) ? slot(x.tarih, x.rows, true) : null}))};
  function ayt0(x) { return !!x.ayt; }
})()`);
const ortalamalar = (kapsam, olcu) => JSON.parse(run(`JSON.stringify((() => { const t = DPANO.veriAl().t, ks = DPANO.kapsamlar(t); return DPANO.gorunumModeli(t, DPANO.olcu(${JSON.stringify(olcu || 'TYT')}), ks.find(k => k.key === ${JSON.stringify(kapsam)})).sinavlar.map(s => [s.g, Math.round(s.ort * 100) / 100]); })())`));
const SAYFALAR = [
  {ad: 'Hazırbulunuşluk', tarih: '18.08.2026', rows: [[1, '12/A', 30], [2, '12/A', 36], [3, '12/B', 24], [9, '12/B', 18], [7, '11/A', 10]]},
  {ad: 'Deneme Eylül', tarih: '25.09.2026', rows: [[1, '12/A', 38], [2, '12/A', 40], [3, '12/B', 30], [9, '12/B', 34], [7, '11/A', 12]]},
  {ad: 'Deneme Ekim', tarih: '23.10.2026', ayt: true, rows: [[1, '12/A', 36, 20], [2, '12/A', 40, 30], [3, '12/B', 28, 10], [9, '12/B', 32, 14]]},
  {ad: 'Geçen Yıl', tarih: '10.01.2026', rows: [[1, '12/A', 39], [2, '12/A', 39]]}
];
const kopya = `(() => {
  const ders = n => DENEME_DERSLER.TYT.map(d => ({kod:d[0],soru:d[2],dogru:d[0]==='turkce'?n:0,yanlis:0}));
  const k = (id, ad, tarih, n) => ({id,ad,tarih,tur:'TYT',oturum:'TYT',brans:'',alan:'SAY',dersler:ders(n),sure:null,puan:null,ts:1});
  // Only the October exam has student copies (a "PDF ekle" list has none), and a different date than the list's.
  D.ogr[0].denemeOkul = [k('p:x1','Deneme Ekim','2026-10-30',50)];
  D.ogr[1].denemeOkul = [k('p:x2','Deneme Ekim','2026-10-30',54)];
  D.ayar.donemBasi = '2026-09-07'; D.ayar.sinav = '2027-06-19'; EK.anaDenemeTur = 'TYT'; EK.anaSube = ''; EK.anaGrup = ''; EK.anaGrupMod = 'deneme'; delete EK.anaSinif;
})()`;

check('class average follows the school lists: a list-only exam appears, same numbers and dates as Deneme panosu', () => {
  run(kopya); listeKur(SAYFALAR);
  const nokta = () => JSON.parse(run('JSON.stringify(denemeOrtalamaVerisi().noktalar.map(n=>[gunNo(n.r.tarih),n.v,n.r.ad]))'));
  const v = JSON.parse(run('JSON.stringify((v=>({kaynak:v.kaynak,kapsam:v.kapsam,sinif:v.sinif,siniflar:v.siniflar}))(denemeOrtalamaVerisi()))'));
  assert.deepEqual(v, {kaynak: 'liste', kapsam: 'g12', sinif: 12, siniflar: [12, 11]});
  // 12th grade: Aug (30,36,24,18 -> 27), Sep (38,40,30,34 -> 35.5), Oct (36,40,28,32 -> 34); last year's exam excluded.
  assert.deepEqual(nokta().map(n => n[1]), [27, 35.5, 34]);
  assert.deepEqual(nokta().map(n => n[0]), ['2026-08-18', '2026-09-25', '2026-10-23'].map(d => run(`gunNo('${d}')`)), 'the exam dates, not the copy date 30 Oct');
  assert.match(nokta()[0][2], /^Hazırbulunuşluk · 4 öğrenci ortalaması$/);
  // Equal to Deneme panosu's per-exam participant average for the same grade, şube and alan.
  for (const [kapsam, sube, olcu, tur, alan] of [['g12', '', 'TYT', 'TYT', 'SAY'], ['12/A', '12/A', 'TYT', 'TYT', 'SAY'], ['12/B', '12-B', 'TYT', 'TYT', 'SAY'], ['g12', '', 'AYT:SAY', 'AYT', 'SAY']]) {
    run(`EK.anaSube=${JSON.stringify(sube)};EK.anaDenemeTur=${JSON.stringify(tur)};EK.anaDenemeAlan=${JSON.stringify(alan)}`);
    assert.deepEqual(nokta().map(n => [n[0], n[1]]), ortalamalar(kapsam, olcu).filter(a => a[0] >= run("gunNo('2026-08-01')")).map(a => [a[0], a[1]]), kapsam + ' ' + olcu + ' (last year’s exam is not on the home chart)');
  }
  run("EK.anaSube='';EK.anaDenemeTur='TYT'");
  // Another grade: its own exams only.
  run('EK.anaSinif=11'); assert.deepEqual(nokta().map(n => n[1]), [10, 12]); run('delete EK.anaSinif');
});

check('class average: şube and group filters, the 18 Ağu exam keeps its own date and the axis starts there', () => {
  run(kopya); listeKur(SAYFALAR);
  const v = () => JSON.parse(run('JSON.stringify((v=>({bas:v.bas,sube:v.sube,n:v.noktalar.map(n=>[n.v,!!n.erken])}))(denemeOrtalamaVerisi()))'));
  const agu = run("gunNo('2026-08-18')"), donem = run("pazartesi(gunNo('2026-09-07'))");
  assert(v().bas <= agu && v().bas < donem, 'the axis starts at the August exam (its Monday), before the term start');
  assert.deepEqual(v().n, [[27, false], [35.5, false], [34, false]], 'no point is folded onto the term start');
  const h = run('denemeOrtalamaGrafigi()');
  assert.match(h, /Hazırbulunuşluk · 4 öğrenci ortalaması · 2026-08-18 · 27 net/);
  assert.doesNotMatch(h, /dönem başından önce/);
  assert.equal((h.match(/<polyline class="yg-cizgi/g) || []).length, 1, 'one line through all the points');
  assert.match(h, /<select id="dnOrtSube"><option value="">Tümü<\/option><option value="12\/A">12\/A<\/option><option value="12\/B">12\/B<\/option><\/select>/);
  assert.match(h, /data-dn-yol="o:TYT:pano"/);
  // Şube: the list's class; the notebook's "12-B" spelling is the same class.
  run("EK.anaSube='12/A'"); assert.deepEqual(v().n.map(x => x[0]), [33, 39, 38]);
  run("EK.anaSube='12-B'"); assert.deepEqual([v().sube, ...v().n.map(x => x[0])], ['12/B', 21, 32, 30]);
  run("EK.anaSube='13/Z'"); assert.equal(v().sube, '', 'an unknown class is everyone');
  // Group: each exam's top 25% of 4 -> 1 student; fixed group by overall average; target keys with either spelling.
  run("EK.anaSube='';EK.anaGrup='ust20'"); assert.deepEqual(v().n.map(x => x[0]), [36, 40, 40]);
  run("EK.anaGrup='alt40'"); assert.deepEqual(v().n.map(x => x[0]), [21, 32, 30]);
  run("EK.anaGrup='ust40';EK.anaGrupMod='genel'"); assert.deepEqual(v().n.map(x => x[0]), [33, 39, 38], 'students 1 and 2 are the top two on average');
  run("EK.anaGrup='';EK.anaGrupMod='deneme';D.denemeOrtHedef={TYT:{'':40,'12-B':28}};EK.anaSube='12/B'");
  assert.equal(run('denemeOrtalamaVerisi().hedef'), 28, 'the 12-B target applies to the list class 12/B');
  run("EK.anaSube='12/A'"); assert.equal(run('denemeOrtalamaVerisi().hedef'), 40);
  // A previous school year stays out; the YKS date minus a year is the limit.
  run("EK.anaSube='';D.denemeOrtHedef=undefined");
  assert(!JSON.parse(run('JSON.stringify(denemeOrtalamaVerisi().noktalar.map(n=>n.r.ad))')).some(a => /Geçen Yıl/.test(a)));
});

check('class average: a click opens Deneme panosu with the same oturum and grade; no lists falls back to the student copies', () => {
  run(kopya); listeKur(SAYFALAR); run("ciz=()=>{}");
  run("EK.anaSinif=11;denemeYolAc('o:TYT:pano')");
  assert.deepEqual(JSON.parse(run('JSON.stringify([EK.sekme,EK.dpOlcu,EK.dpKapsam,EK.denemeKisi])')), ['denemeler', 'TYT', 'g11', false]);
  run("delete EK.anaSinif;EK.anaDenemeTur='AYT';EK.anaDenemeAlan='SAY';EK.anaSube='12/B';denemeYolAc('o:AYT:x')");
  assert.deepEqual(JSON.parse(run('JSON.stringify([EK.dpOlcu,EK.dpKapsam])')), ['AYT:SAY', '12/B']);
  // No school lists: the students' own copies, as before.
  run("delete D.siralama;EK.anaDenemeTur='TYT';EK.anaSube=''");
  const v = JSON.parse(run('JSON.stringify((v=>({kaynak:v.kaynak,n:v.noktalar.map(n=>[n.r.tarih,n.v])}))(denemeOrtalamaVerisi()))'));
  assert.deepEqual(v, {kaynak: 'kopya', n: [['2026-10-30', 52]]});
});

check('one list of a student’s exams: school-list rows (with per-ders nets) first, own entries only when no school exam has the name', () => {
  run(kopya); listeKur(SAYFALAR);
  run(`(() => {
    const ders = n => DENEME_DERSLER.TYT.map(d => ({kod:d[0],soru:d[2],dogru:d[0]==='turkce'?n:0,yanlis:0}));
    // The student's own copy of the October exam dated 30 Oct (the school list says 23 Oct), another exam of the student's own.
    D.ogr[0].denemeler = [{id:'m:a',ad:'deneme  ekim',tarih:'2026-10-30',tur:'TYT',oturum:'TYT',brans:'',alan:'SAY',dersler:ders(41),sure:null,puan:null,ts:1},
      {id:'m:b',ad:'Kendi Deneme',tarih:'2026-10-01',tur:'TYT',oturum:'TYT',brans:'',alan:'SAY',dersler:ders(5),sure:null,puan:null,ts:1}];
  })()`);
  const l = () => JSON.parse(run('JSON.stringify(ogrenciDenemeKayitlari(0).map(r=>[r.tarih,r.ad,r.tur,r.id.slice(0,2),!!r.okulListe,Math.round(denemeToplam(r,"SAY")*100)/100]))'));
  assert.deepEqual(l(), [['2026-01-10', 'Geçen Yıl', 'TYT', 'p:', true, 39], ['2026-08-18', 'Hazırbulunuşluk', 'TYT', 'p:', true, 30], ['2026-09-25', 'Deneme Eylül', 'TYT', 'p:', true, 38], ['2026-10-01', 'Kendi Deneme', 'TYT', 'm:', false, 5],
    ['2026-10-23', 'Deneme Ekim', 'AYT', 'p:', true, 21], ['2026-10-30', 'Deneme Ekim', 'TYT', 'p:', false, 50]].sort((a, b) => a[0].localeCompare(b[0]) || a[3].localeCompare(b[3])).map(x => x),
    'the published copy wins over the list row, and the student’s 30 Oct entry of the same name is hidden whatever its date');
  assert(run('D.ogr[0].denemeler.some(r=>r.id==="m:a")'), 'the stored entry is kept');
  // The teacher's per-student panosu shows the list-only exam with its lessons.
  const e = JSON.parse(run('JSON.stringify(ogrenciDenemeKayitlari(0).find(r=>r.ad==="Hazırbulunuşluk"))'));
  assert(e.dersler.find(d => d.kod === 'turkce' && d.dogru === 30 && d.soru === 40));
  run("EK.sekme='denemeler';EK.ogr=0;EK.denemeKisi=true;EK.denemeTur='TYT'");
  const h = run('gorunumDenemeler()');
  assert(h.includes('Hazırbulunuşluk') && h.includes('Deneme Eylül') && !h.includes('deneme  ekim'), 'the list-only exams are in the history; the duplicate is not');
  // A student session cannot read the lists: only the published copies and its own entries (deduped by name).
  run("D.rol='ogrenci';EK.ogr=0");
  assert.deepEqual(JSON.parse(run('JSON.stringify(ogrenciDenemeKayitlari(0).map(r=>[r.ad,r.id.slice(0,2)]))')), [['Kendi Deneme', 'm:'], ['Deneme Ekim', 'p:']]);
});

// ---- publishing the school lists to the students' Denemelerim ("PDF ekle", "Bekleyen sonuçları yayınla") ----
const yayinKur = () => {
  run(kopya); listeKur(SAYFALAR);
  run(`(() => {
    D.ogr[0].denemeOkul = []; D.ogr[1].denemeOkul = [];
    D.ogr.push({ad:'Synthetic Eda', no:5, sube:'12-A', sinif:12, alan:'SAY', kap:6, off:[6], aktif:true});
    // The list prints no 5 under another name (another school's student), and prints student 9 who is not in the notebook.
    D.siralama.sinavlar[1].T.ogr.push({...D.siralama.sinavlar[1].T.ogr[0], no:'5', ad:'BASKA OKUL OGRENCISI', snf:'12/A'});
    kayitlar = []; kaydet = async () => true;
    denemeOkulYayinla = async si => { kayitlar.push([si, JSON.stringify(D.ogr[si].denemeOkul)]); D.ogr[si].denemeYayinBekliyor = false; };
  })()`);
};
const kopyalar = (i) => JSON.parse(run(`JSON.stringify((D.ogr[${i}].denemeOkul || []).map(r => [r.id.slice(0, 2), r.ad, r.tarih, r.oturum, r.dersler.find(d => d.kod === 'turkce')?.dogru]))`));
check('PDF ekle / backfill: each matched student gets only their own rows, once; other schools’ and unmatched rows are not published', async () => {
  yayinKur();
  const mesaj = await run('denemeBekleyenleriYayinla()');
  assert.match(mesaj, /^3 öğrenciye yayınlandı\. Okul listelerinden 3 öğrenci için 14 sonuç eklendi\. Öğrenciler/);
  // Student 1 (no 1): Geçen Yıl, Hazırbulunuşluk, Deneme Eylül, Deneme Ekim TYT + AYT; with the school's dates.
  assert.deepEqual(kopyalar(0).map(r => r.slice(1)).sort(), [['Deneme Ekim', '2026-10-23', 'AYT', null], ['Deneme Ekim', '2026-10-23', 'TYT', 36], ['Deneme Eylül', '2026-09-25', 'TYT', 38],
    ['Geçen Yıl', '2026-01-10', 'TYT', 39], ['Hazırbulunuşluk', '2026-08-18', 'TYT', 30]].sort());
  assert.equal(kopyalar(2).length, 4, 'Synthetic Cem (no 3, 12/B) is not in the Geçen Yıl list');
  assert.deepEqual(kopyalar(4), [], 'a student whose number is printed under another name gets nothing');
  assert.equal(run('D.ogr[4].denemeYayinBekliyor'), undefined);
  // Ids and kimlik are the import’s: re-importing the same file dedupes.
  assert(run("D.ogr[0].denemeOkul.every(r => r.id === 'p:' + encodeURIComponent([denemeAdAnahtari(r.ad), r.tarih, r.oturum].join('|')))"));
  // Privacy: what is published for a student holds that student's own numbers only.
  const yayin = JSON.parse(run('JSON.stringify(kayitlar)'));
  for (const [si, json] of yayin) {
    const kayit = JSON.parse(json);
    for (const r of kayit) {
      assert.deepEqual(Object.keys(r).sort(), ['alan', 'ad', 'brans', 'dersler', 'id', 'oturum', 'puan', 'sinavTuru', 'sure', 'tarih', 'ts', 'tur'].sort(), 'no list fields such as rank, class or name');
      assert(r.dersler.every(d => Object.keys(d).sort().join() === 'dogru,kod,soru,yanlis'));
    }
    for (const yabanci of ['SYNTHETIC', 'SENTETIK', 'BASKA', 'Bora', 'Cem', '12/']) assert(!json.includes(yabanci), 'no other student: ' + yabanci);
  }
  assert.equal(JSON.parse(yayin.find(x => x[0] === 0)[1]).find(r => r.ad === 'Hazırbulunuşluk').dersler.find(d => d.kod === 'turkce').dogru, 30, 'student 1’s own net, not the class’s');
  // Backfill again: nothing new.
  const once = run('JSON.stringify(D.ogr)'), tekrar = await run('denemeBekleyenleriYayinla()');
  assert.equal(tekrar, '0 öğrenciye yayınlandı. Öğrenciler sonuçlarını otomatik görecek.');
  assert.equal(run('JSON.stringify(D.ogr)'), once, 'no copy added twice');
  // A result the student deleted stays deleted.
  run("D.ogr[0].denemeOkul = denemeBirlestir(D.ogr[0].denemeOkul, [{...D.ogr[0].denemeOkul.find(r => r.ad === 'Hazırbulunuşluk'), silindi:true, ts:Date.now() + 5}])");
  await run('denemeBekleyenleriYayinla()');
  assert(!run("D.ogr[0].denemeOkul.some(r => r.ad === 'Hazırbulunuşluk' && !r.silindi)"));
});

check('publishing respects the 300 KB school-result field: what does not fit is skipped and named', async () => {
  yayinKur();
  run(`(() => {
    const o = D.ogr[0], doldur = i => ({id:'p:dolgu' + i, ad:'Dolgu ' + i, tarih:'2026-09-01', tur:'TYT', oturum:'TYT', brans:'', alan:'SAY', sure:null, puan:null, ts:1, sinavTuru:'genel',
      dersler: DENEME_DERSLER.TYT.map(d => ({kod:d[0], dogru:1, yanlis:0, soru:d[2]}))});
    o.denemeOkul = [];
    for (let i = 0; baytBoyu(JSON.stringify(o.denemeOkul)) < 299000 - 700; i++) o.denemeOkul.push(doldur(i));
  })()`);
  const mesaj = await run('denemeBekleyenleriYayinla()');
  assert.match(mesaj, /Boyut sınırı nedeniyle atlandı: Synthetic Ada \(\d sonuç\)/);
  assert(run("baytBoyu(JSON.stringify(D.ogr[0].denemeOkul))") <= 300000);
  assert(run("D.ogr[0].denemeOkul.filter(r => !r.id.startsWith('p:dolgu')).length") < 5, 'some rows were left out');
  assert.equal(kopyalar(1).length, 5, 'another student is not affected');
});

check('student session: a list-only exam shows with the school date; an own entry of the same name shows once and can be deleted', async () => {
  yayinKur();
  run(`(() => { D.ogr[0].denemeler = [{id:'m:own', ad:'deneme  eylül', tarih:'2026-10-02', tur:'TYT', oturum:'TYT', brans:'', alan:'SAY', sure:null, puan:null, ts:1,
    dersler: DENEME_DERSLER.TYT.map(d => ({kod:d[0], soru:d[2], dogru:d[0] === 'turkce' ? 39 : 0, yanlis:0}))}]; })()`);
  await run('denemeBekleyenleriYayinla()');
  // The student's own notebook: just that student, no school lists.
  run("(() => { const o = D.ogr[0]; D = varsayilan(); D.rol = 'ogrenci'; D.ogr = [o]; delete D.siralama; EK.ogr = 0; EK.sekme = 'denemeler'; EK.denemeTur = 'TYT'; })()");
  const liste = JSON.parse(run('JSON.stringify(ogrenciDenemeKayitlari(0).filter(r => r.tur === "TYT").map(r => [r.tarih, r.ad]))'));
  assert.deepEqual(liste.filter(x => /Eylül|Hazır/.test(x[1])), [['2026-08-18', 'Hazırbulunuşluk'], ['2026-09-25', 'Deneme Eylül']], 'school dates; the own 2 Oct entry (a week from the school exam) is not a second exam');
  const h = run('gorunumDenemeler()');
  assert.equal((h.match(/Deneme Eylül/g) || []).length >= 1, true);
  assert.match(h, /Senin girdiğin <b>deneme  eylül<\/b> \(02\.10\) okul sonucuyla birleşti\. <button class="dugme" data-dn-sil="m:own"/);
  assert(!/<td>2026-10-02<br><b>deneme/.test(h), 'not in the history table');
  // Sil goes through the existing delete path.
  const el = {dataset: {dnSil: 'm:own'}, id: ''}; el.closest = () => el;
  run("kaydet = async () => true; confirm = () => true; ciz = () => {}");
  for (const f of listeners.click) { try { await f({target: el, preventDefault() {}}); } catch (e) { /* other modules' click handlers */ } }
  assert(run("D.ogr[0].denemeler.find(r => r.id === 'm:own').silindi === true"), 'the own entry is deleted');
  assert.doesNotMatch(run('gorunumDenemeler()'), /okul sonucuyla birleşti/);
});


// ---- exam keys, per-session dates, re-imports, date repair, the lag line and the student preview ----
const tarihKur = () => {   // Deneme Ekim: the TYT list says 23 Oct, the TYT+AYT list says 30 Oct
  run(kopya); listeKur([{ad: 'Deneme Ekim', tarih: '23.10.2026', rows: [[1, '12/A', 36], [2, '12/A', 40]]}]);
  const T = run('JSON.stringify(D.siralama.sinavlar[0].T)');
  listeKur([{ad: 'Deneme Ekim', tarih: '30.10.2026', ayt: true, rows: [[1, '12/A', 36, 20], [2, '12/A', 40, 30]]}]);
  run(`(() => { D.siralama.sinavlar[0].T = ${T}; D.siralama.sinavlar[0].ts = 2000; D.ogr[0].denemeOkul = []; D.ogr[1].denemeOkul = []; D.ogr[0].denemeler = []; kaydet = async () => true; })()`);
};
const J = (x) => JSON.parse(JSON.stringify(x));
const tarihler = (i) => JSON.parse(run(`JSON.stringify(denemeListe(${i}).map(r => [r.ad, r.oturum, r.tarih, r.id.slice(0, 2)]))`));
const kayit = (id, ad, tarih, oturum, n) => `({id:${JSON.stringify(id)},ad:${JSON.stringify(ad)},tarih:'${tarih}',tur:'${oturum}',oturum:'${oturum}',brans:'',alan:'SAY',sure:null,puan:null,ts:1,sinavTuru:'genel',dersler:DENEME_DERSLER.${oturum}.map(d=>({kod:d[0],soru:d[2],dogru:d[0]===${oturum === 'TYT' ? "'turkce'" : "'edebiyat'"}?${n}:0,yanlis:0}))})`;
const pid = (ad, t, o) => 'p:' + encodeURIComponent([ad.toLocaleUpperCase('tr-TR'), t, o].join('|'));

check('exam key: spellings of one school exam meet, different exams never do', () => {
  const k = (a) => run(`denemeSinavAnahtari(${JSON.stringify(a)})`);
  const ayni = ['27-YKS-1203', '27 YKS 1203', '27-yks-1203', '27_YKS_1203 (TYT)', '27-YKS-1203 TYT', '27-YKS-1203-TYT', '  27 - YKS - 1203  ', '27-YKS-1203 - 23.10.2026', '27-YKS-1203 (23.10)', 'TYT 27-YKS-1203 Denemesi'];
  for (const a of ayni) assert.equal(k(a), '27-YKS-1203', a);
  for (const [a, b] of [['27-YKS-1203', '27-YKS-1202'], ['27-YKS-1203', '28-YKS-1203'], ['Deneme 1', 'Deneme 12'], ['Deneme 1', 'Deneme 2'], ['Hazırbulunuşluk-1', 'Hazırbulunuşluk-2'], ['27-TYT_SIFIR_POZİTİF', '27-YKS-1201']])
    assert.notEqual(k(a), k(b), a + ' / ' + b);
  assert.equal(k('Hazırbulunuşluk-2'), k('HAZIRBULUNUSLUK 2 TYT'));
  assert.equal(k('27-TYT_SIFIR_POZİTİF'), k('27 TYT SIFIR POZİTİF'));
  const ayniSinav = (a, ta, oa, b, tb, ob) => run(`denemeAyniSinav({ad:${JSON.stringify(a)},tarih:'${ta}',oturum:'${oa}',tur:'${oa}'},{ad:${JSON.stringify(b)},tarih:'${tb}',oturum:'${ob}',tur:'${ob}'})`);
  assert.equal(ayniSinav('27-YKS-1203', '2026-10-23', 'TYT', '27-YKS-1203', '2026-10-23', 'AYT'), false, 'another session is another exam');
});

check('student session: an own entry spelled differently is hidden next to the school copy; copies of one exam under two dates show once', () => {
  run(kopya);
  for (const ad of ['27 YKS 1203', '27-YKS-1203 TYT', '27_YKS_1203 (TYT)', '27-yks-1203 - 30.10.2026']) {
    run(`(() => { D = varsayilan(); D.rol = 'ogrenci'; EK.ogr = 0; D.ogr = [{ad:'Synthetic Ada', no:1, alan:'SAY', aktif:true,
      denemeOkul:[${kayit(pid('27-YKS-1203', '2026-10-23', 'TYT'), '27-YKS-1203', '2026-10-23', 'TYT', 36)}],
      denemeler:[${kayit('m:own', ad, '2026-10-30', 'TYT', 36)}]}]; })()`);
    assert.deepEqual(tarihler(0), [['27-YKS-1203', 'TYT', '2026-10-23', 'p:']], 'own entry "' + ad + '" is hidden');
  }
  // A different exam of the same night is not hidden.
  run(`D.ogr[0].denemeler = [${kayit('m:own', '27-YKS-1202', '2026-10-09', 'TYT', 30)}]`);
  assert.equal(tarihler(0).length, 2);
  // A re-sit of another session is not hidden either.
  run(`D.ogr[0].denemeler = [${kayit('m:ayt', '27-YKS-1203', '2026-10-30', 'AYT', 10)}]`);
  assert.equal(tarihler(0).length, 2);
  // The same exam published under two dates (a combined file gave both sessions one date): one row; the newest copy.
  run(`(() => { const a = ${kayit(pid('27-YKS-1203', '2026-10-23', 'TYT'), '27-YKS-1203', '2026-10-23', 'TYT', 36)}, b = ${kayit(pid('27-YKS-1203', '2026-10-30', 'TYT'), '27-YKS-1203', '2026-10-30', 'TYT', 36)}; b.ts = 5;
    D.ogr[0].denemeler = []; D.ogr[0].denemeOkul = [a, b]; })()`);
  assert.deepEqual(tarihler(0), [['27-YKS-1203', 'TYT', '2026-10-30', 'p:']]);
});

check('generic names need dates within 14 days; a code matches whatever the dates', () => {
  const m = (a, ta, b, tb, o = 'TYT') => run(`denemeAyniSinav({ad:${JSON.stringify(a)},tarih:'${ta}',oturum:'${o}',tur:'${o}'},{ad:${JSON.stringify(b)},tarih:'${tb}',oturum:'${o}',tur:'${o}'})`);
  assert.equal(m('27-YKS-1203', '2026-10-23', '27 YKS 1203 TYT', '2026-10-30'), true, 'code: 23.10 vs 30.10 merges');
  assert.equal(m('27-YKS-1203', '2026-10-23', '27-YKS-1203', '2026-12-30'), true, 'code: any gap');
  assert.equal(m('TYT Deneme', '2026-10-23', 'TYT Deneme', '2026-10-30'), true, 'generic: a week apart merges');
  assert.equal(m('TYT Deneme', '2026-10-02', 'TYT Deneme', '2026-10-16'), true, 'generic: 14 days merges');
  assert.equal(m('TYT Deneme', '2026-10-02', 'TYT Deneme', '2026-10-30'), false, 'generic: weeks apart are two exams');
  assert.equal(m('Hazırbulunuşluk', '2026-08-18', 'Hazırbulunuşluk', '2026-10-05'), false);
  // Two generic exams a month apart stay two rows (copies), and an own "Deneme" is not hidden by a school "Deneme" a month away.
  run(`(() => { D = varsayilan(); D.rol = 'ogrenci'; EK.ogr = 0; D.ogr = [{ad:'Synthetic Ada', no:1, alan:'SAY', aktif:true,
    denemeOkul:[${kayit(pid('TYT Deneme', '2026-10-02', 'TYT'), 'TYT Deneme', '2026-10-02', 'TYT', 30)}, ${kayit(pid('TYT Deneme', '2026-10-30', 'TYT'), 'TYT Deneme', '2026-10-30', 'TYT', 34)}],
    denemeler:[${kayit('m:own', 'Deneme', '2026-12-01', 'TYT', 20)}, ${kayit('m:own2', 'TYT Deneme', '2026-11-20', 'TYT', 22)}]}]; })()`);
  assert.deepEqual(tarihler(0).map(r => r[2]), ['2026-10-02', '2026-10-30', '2026-11-20', '2026-12-01']);
  // The same generic name 23.10 vs 30.10 is one exam (a combined file's other day).
  run(`D.ogr[0].denemeOkul = [${kayit(pid('TYT Deneme', '2026-10-23', 'TYT'), 'TYT Deneme', '2026-10-23', 'TYT', 30)}, ${kayit(pid('TYT Deneme', '2026-10-30', 'TYT'), 'TYT Deneme', '2026-10-30', 'TYT', 30)}]; D.ogr[0].denemeOkul[1].ts = 5; D.ogr[0].denemeler = [${kayit('m:own', 'TYT Deneme', '2026-10-28', 'TYT', 30)}]`);
  assert.deepEqual(tarihler(0).map(r => r[2]), ['2026-10-30'], 'one row: the newest copy, the own entry hidden');
  // An own "Deneme" next to a school "Deneme" a month away is shown; five days away it is the same exam.
  run(`D.ogr[0].denemeOkul = [${kayit(pid('Deneme', '2026-10-02', 'TYT'), 'Deneme', '2026-10-02', 'TYT', 30)}]; D.ogr[0].denemeler = [${kayit('m:own', 'deneme', '2026-11-02', 'TYT', 20)}]`);
  assert.equal(tarihler(0).length, 2);
  run(`D.ogr[0].denemeler = [${kayit('m:own', 'deneme', '2026-10-07', 'TYT', 20)}]`);
  assert.equal(tarihler(0).length, 1);
  // Several candidates in the window: the nearest date is the one replaced by a re-import.
  run(`D.ogr[0].denemeOkul = [${kayit(pid('Deneme', '2026-10-02', 'TYT'), 'Deneme', '2026-10-02', 'TYT', 30)}, ${kayit(pid('Deneme', '2026-10-12', 'TYT'), 'Deneme', '2026-10-12', 'TYT', 31)}]; D.ogr[0].denemeler = []`);
  sandbox.__y = JSON.parse(run(`JSON.stringify(${kayit(pid('Deneme', '2026-10-11', 'TYT'), 'Deneme', '2026-10-11', 'TYT', 40)})`));
  assert.deepEqual(J(run('denemeKayitDegistir(D.ogr[0].denemeOkul, __y)').filter(r => r.silindi).map(r => r.tarih)), ['2026-10-12'], 'the nearest day is replaced');
});

check('school lists carry a date per session: TYT from the TYT list, AYT from the TYT+AYT list', () => {
  tarihKur();
  assert.deepEqual(tarihler(0).sort(), [['Deneme Ekim', 'AYT', '2026-10-30', 'p:'], ['Deneme Ekim', 'TYT', '2026-10-23', 'p:']]);
  // A corrected date (the exam table's field) covers both sessions again.
  run("D.siralama.sinavlar[0].tarih = '24.10.2026'; D.siralama.sinavlar[0].ts = 2001");
  assert.deepEqual(tarihler(0).map(r => r[2]), ['2026-10-24', '2026-10-24']);
});

check('combined TYT+AYT file with one date: the preview asks for a day per session, prefilled from the lists; a printed day per session wins', () => {
  tarihKur();
  const rapor = (extra = {}) => ({ad: '27 YKS Ekim', tarih: '2026-10-30', uyarilar: [], dosya: 'x.pdf', satirlar: [], ...extra});
  const satirlar = () => run(`[{no:1,ad:'Synthetic Ada',oturum:'TYT',puan:null,dersler:${kayit('x', 'x', '2026-10-30', 'TYT', 36)}.dersler},{no:1,ad:'Synthetic Ada',oturum:'AYT',puan:null,dersler:${kayit('x', 'x', '2026-10-30', 'AYT', 10)}.dersler}]`);
  sandbox.__s = satirlar();
  // A file whose name the lists do not know: both sessions start on the file's day, and both fields are there to edit.
  let r = rapor({satirlar: JSON.parse(JSON.stringify(sandbox.__s))}); sandbox.__r = r; run('DENEME_IMPORT = denemeImportHazirla([__r])');
  assert.equal(r.cift, true); assert.deepEqual(J(r.oturumTarihleri), {TYT: '2026-10-30', AYT: '2026-10-30'});
  let h = run('denemeImportHtml()');
  assert.match(h, /data-alan="tarihTYT" value="2026-10-30"/); assert.match(h, /data-alan="tarihAYT" value="2026-10-30"/); assert.doesNotMatch(h, /data-alan="tarih" /);
  // Deneme Ekim exists on the lists (TYT 23 Oct, AYT 30 Oct): prefilled from the lists, each session its own.
  r = rapor({ad: 'Deneme Ekim', satirlar: JSON.parse(JSON.stringify(sandbox.__s))}); sandbox.__r = r; run('DENEME_IMPORT = denemeImportHazirla([__r])');
  assert.deepEqual(J(r.oturumTarihleri), {TYT: '2026-10-23', AYT: '2026-10-30'});
  assert.deepEqual(JSON.parse(run('JSON.stringify(__r.satirlar.map(x => denemePdfKaydi(__r, x)).map(x => [x.oturum, x.tarih, x.id === ' + JSON.stringify(pid('Deneme Ekim', '', '')) + '.slice(0,0) + x.id]))')).map(x => x.slice(0, 2)), [['TYT', '2026-10-23'], ['AYT', '2026-10-30']]);
  // The file prints a day for each session (AI-read): they win over the lists.
  r = rapor({ad: 'Deneme Ekim', oturumTarihleri: {TYT: '2026-10-21', AYT: '2026-10-28'}, satirlar: JSON.parse(JSON.stringify(sandbox.__s))}); sandbox.__r = r; run('DENEME_IMPORT = denemeImportHazirla([__r])');
  assert.deepEqual(J(r.oturumTarihleri), {TYT: '2026-10-21', AYT: '2026-10-28'});
  // Editing a field changes that session only.
  run("__r.oturumTarihleri = {...__r.oturumTarihleri, AYT: '2026-10-29'}");
  assert.deepEqual(JSON.parse(run('JSON.stringify(__r.satirlar.map(x => denemePdfKaydi(__r, x).tarih))')), ['2026-10-21', '2026-10-29']);
  // A single-session report keeps its single date field.
  r = rapor({satirlar: JSON.parse(JSON.stringify(sandbox.__s)).slice(0, 1)}); sandbox.__r = r; run('DENEME_IMPORT = denemeImportHazirla([__r])');
  assert.equal(r.cift, undefined); assert.match(run('denemeImportHtml()'), /data-alan="tarih" value="2026-10-30"/);
});

check('a "Rapor Tarihi" is never an exam day: the school PDF reader takes only "Sınav Tarihi"', () => {
  const sayfa = (etiketler) => { const items = [], y0 = 700; let y = y0;
    for (const [e, v] of etiketler) { items.push({s: e, x: 40, y, w: 60, h: 8, z: 8}, {s: v, x: 120, y, w: 60, h: 8, z: 8}); y -= 12; } return items; };
  sandbox.__p = [sayfa([['Rapor Tarihi:', '30.10.2026'], ['Sınav Adı:', '27-YKS-1203']])];
  assert.throws(() => run('denemePdfCoz(__p)'), /Sınav adı\/tarihi okunamadı/, 'a report date alone is no exam date');
  sandbox.__p = [sayfa([['Rapor Tarihi:', '30.10.2026'], ['Sınav Adı:', '27-YKS-1203'], ['Sınav Tarihi:', '23.10.2026']])];
  assert.throws(() => run('denemePdfCoz(__p)'), /Öğrenci kimlik sütunları okunamadı/, 'it got past the date check with the exam day, not the report day');
  assert.match(html, /"Rapor Tarihi", yazdırma, çıktı, baskı ya da oluşturma tarihini ASLA sınav tarihi olarak yazma/, 'the AI prompt says so');
});

check('re-import with a corrected date replaces the record instead of adding a duplicate; the student’s time moves', () => {
  tarihKur();
  run(`(() => { const k = ${kayit(pid('Deneme Ekim', '2026-10-30', 'TYT'), 'Deneme Ekim', '2026-10-30', 'TYT', 36)}; k.sure = 95; D.ogr[0].denemeOkul = [k]; })()`);
  const rapor = {ad: 'Deneme Ekim', tarih: '2026-10-23', uyarilar: [], satirlar: [{no: 1, ad: 'Synthetic Ada', oturum: 'TYT', puan: null, dersler: JSON.parse(run(`JSON.stringify(${kayit('x', 'x', '2026-10-23', 'TYT', 36)}.dersler)`))}]};
  sandbox.__r = rapor; run('DENEME_IMPORT = denemeImportHazirla([__r])');
  const row = rapor.satirlar[0];
  assert.match(row.uyari, /Aynı sınav 2026-10-30 tarihiyle kayıtlı; tarihi 2026-10-23 olarak güncellenir/); assert.equal(row.secili, true);
  run('__sonuc = denemeKayitDegistir(D.ogr[0].denemeOkul, denemePdfKaydi(__r, __r.satirlar[0]))');
  run('D.ogr[0].denemeOkul = __sonuc');
  assert.deepEqual(tarihler(0).filter(r => r[1] === 'TYT'), [['Deneme Ekim', 'TYT', '2026-10-23', 'p:']], 'one TYT row, on the new date');
  assert.equal(run("D.ogr[0].denemeOkul.filter(r => !r.silindi).length"), 1);
  assert.equal(run("D.ogr[0].denemeOkul.find(r => !r.silindi).sure"), 95);
  assert(run("D.ogr[0].denemeOkul.some(r => r.silindi && r.tarih === '2026-10-30')"), 'the old record is a tombstone, so publishing removes it on the student’s device');
  // The same file again on the same date is a plain duplicate: skipped.
  sandbox.__r = JSON.parse(JSON.stringify(rapor)); delete sandbox.__r.satirlar[0].uyari; run('DENEME_IMPORT = denemeImportHazirla([__r])');
  assert.match(sandbox.__r.satirlar[0].uyari, /Tekrar sonuç/); assert.equal(sandbox.__r.satirlar[0].secili, false);
  // A different spelling of the name on a re-import is the same exam.
  const r2 = JSON.parse(JSON.stringify(rapor)); r2.ad = 'DENEME EKİM TYT'; r2.tarih = '2026-10-24'; sandbox.__r = r2; run('DENEME_IMPORT = denemeImportHazirla([__r])');
  assert.match(r2.satirlar[0].uyari, /güncellenir/);
});

check('date correction in the exam table: the published copies of the exam follow, and the student’s own entry stays hidden', async () => {
  tarihKur();
  run(`(() => { D.ogr[0].denemeOkul = [${kayit(pid('Deneme Ekim', '2026-10-23', 'TYT'), 'Deneme Ekim', '2026-10-23', 'TYT', 36)}, ${kayit(pid('Deneme Ekim', '2026-10-30', 'AYT'), 'Deneme Ekim', '2026-10-30', 'AYT', 10)}];
    D.ogr[0].denemeler = [${kayit('m:own', 'deneme ekim tyt', '2026-10-27', 'TYT', 36)}]; })()`);
  const r = await run("(async () => { const r = await SIRALAMA.tarihDegistir(D.siralama.sinavlar[0].id, '25.10.2026'); const n = await denemeOkulTarihTasi(r.ad, r.eski.map(t => t.split('.').reverse().join('-')), '2026-10-25'); return {n, eski: r.eski}; })()");
  assert.equal(r.n, 1); assert.deepEqual([...r.eski].sort(), ['23.10.2026', '30.10.2026']);
  assert.deepEqual(tarihler(0).sort(), [['Deneme Ekim', 'AYT', '2026-10-25', 'p:'], ['Deneme Ekim', 'TYT', '2026-10-25', 'p:']], 'both sessions followed; the own entry (another spelling, 27 Oct) is still hidden');
  assert.equal(run("D.ogr[0].denemeYayinBekliyor"), true);
  assert.equal(run("D.ogr[0].denemeler.length"), 1, 'the own entry is untouched');
});

check('"Tarihleri onar": copies whose date differs from the list move once; own entries and matching copies are untouched', async () => {
  tarihKur();
  // Student 1: TYT copy on 30 Oct (the AYT day) while the list says 23 Oct; the AYT copy is right. Student 2: both copies exist (one stale).
  run(`(() => {
    D.ogr[0].denemeOkul = [${kayit(pid('Deneme Ekim', '2026-10-30', 'TYT'), 'Deneme Ekim', '2026-10-30', 'TYT', 36)}, ${kayit(pid('Deneme Ekim', '2026-10-30', 'AYT'), 'Deneme Ekim', '2026-10-30', 'AYT', 10)}];
    D.ogr[0].denemeler = [${kayit('m:own', 'Deneme Ekim', '2026-10-30', 'TYT', 36)}];
    D.ogr[1].denemeOkul = [${kayit(pid('Deneme Ekim', '2026-10-23', 'TYT'), 'Deneme Ekim', '2026-10-23', 'TYT', 40)}, ${kayit(pid('Deneme Ekim', '2026-10-30', 'TYT'), 'Deneme Ekim', '2026-10-30', 'TYT', 40)}];
  })()`);
  const sahip = run('JSON.stringify(D.ogr[0].denemeler)');
  assert.equal(run('denemeTarihFarklari().length'), 2);
  run("EK.sekme = 'denemeler'");
  assert.match(run('DPANO.gorunum()'), /id="dnTarihFarki"[^>]*>2 yayınlanmış sonucun tarihi okul listesinden farklı · <button type="button" class="et-dugme" id="dnTarihOnar">Tarihleri onar<\/button>/);
  const mesaj = await run('denemeTarihleriniOnar()');
  assert.deepEqual(J(mesaj), {kopya: 2, ogrenci: 2});
  assert.deepEqual(tarihler(0).sort(), [['Deneme Ekim', 'AYT', '2026-10-30', 'p:'], ['Deneme Ekim', 'TYT', '2026-10-23', 'p:']]);
  assert.deepEqual(tarihler(1).filter(r => r[1] === 'TYT'), [['Deneme Ekim', 'TYT', '2026-10-23', 'p:']], 'the stale copy next to a right one is removed');
  assert.equal(run('D.ogr[0].denemeler.length') + run('JSON.stringify(D.ogr[0].denemeler)'), '1' + sahip, 'own entries are never touched');
  assert.equal(run("D.ogr[0].denemeOkul.find(r => r.oturum === 'TYT' && !r.silindi).id"), pid('Deneme Ekim', '2026-10-23', 'TYT'));
  assert(run("D.ogr[0].denemeOkul.some(r => r.silindi && r.tarih === '2026-10-30' && r.oturum === 'TYT')"), 'the old TYT copy is a tombstone to publish');
  assert.equal(run("D.ogr[0].denemeYayinBekliyor && D.ogr[1].denemeYayinBekliyor"), true);
  // Once: nothing left to repair, no button.
  assert.equal(run('denemeTarihFarklari().length'), 0);
  assert.doesNotMatch(run('DPANO.gorunum()'), /dnTarihOnar/);
  assert.deepEqual(J(await run('denemeTarihleriniOnar()')), {kopya: 0, ogrenci: 0});
});

check('lag line: the teacher sees how many exams a student’s screen lacks, and sending clears it', async () => {
  yayinKur();
  const eksik = (si) => run(`denemeEksikSayisi(${si})`);
  assert.equal(eksik(0), 5); assert.equal(eksik(1), 5); assert.equal(eksik(2), 4); assert.equal(eksik(4), 0, 'a student the lists do not print');
  assert.equal(eksik(), 14, 'the class total is what a backfill would add');
  assert.match(run('denemeEksikSatiri(0)'), /Bu öğrencinin ekranında 5 deneme eksik · <button type="button" class="et-dugme" id="dnEksikGonder" data-si="0">Öğrencilere gönder<\/button>/);
  assert.equal(run('denemeEksikSatiri(4)'), '');
  run("D.rol = 'rehber'; EK.sekme = 'denemeler'");
  const h = run('DPANO.gorunum()');
  assert.match(h, /id="dnEksik"[^>]*>Öğrencilerin ekranında 14 deneme eksik · <button type="button" class="et-dugme" id="dnYayinla">Öğrencilere gönder<\/button>/);
  assert.doesNotMatch(h, /Bekleyen sonuçları yayınla/, 'one button for the same thing');
  // Sending to one student publishes only that student.
  const mesaj = await run('denemeBekleyenleriYayinla(() => {}, 0)');
  assert.match(mesaj, /^1 öğrenciye yayınlandı\. Okul listelerinden 1 öğrenci için 5 sonuç eklendi/);
  assert.equal(eksik(0), 0); assert.equal(eksik(1), 5, 'the others still wait'); assert.equal(eksik(), 9);
  assert.equal(run('denemeEksikSatiri(0)'), '');
  assert.equal(kopyalar(1).length, 0);
  await run('denemeBekleyenleriYayinla()');
  assert.equal(eksik(), 0);
  assert.doesNotMatch(run('DPANO.gorunum()'), /deneme eksik/);
  // A viewing teacher can not send: no line.
  run("yalnizcaGoruntuleme = () => true"); yayinKur(); assert.equal(run('denemeEksikSatiri(0)'), ''); run("yalnizcaGoruntuleme = () => false");
  // Pending-only: the old button stays.
  yayinKur(); await run('denemeBekleyenleriYayinla()'); run("D.ogr[0].denemeYayinBekliyor = true");
  assert.match(run('DPANO.gorunum()'), /id="dnYayinla">Bekleyen sonuçları yayınla</);
});

check('student preview shows what the student has: published copies and own entries, deduped; no teacher-only list rows or other students', () => {
  yayinKur();
  run(`(() => { D.ogr[0].denemeOkul = [${kayit(pid('Hazırbulunuşluk', '2026-08-18', 'TYT'), 'Hazırbulunuşluk', '2026-08-18', 'TYT', 30)}];
    D.ogr[0].denemeler = [${kayit('m:own', 'hazırbulunuşluk tyt', '2026-08-20', 'TYT', 30)}, ${kayit('m:ozel', 'Kendi Deneme', '2026-09-01', 'TYT', 20)}]; })()`);
  // The teacher sees the list rows too (5 exams for student 1); the student does not have them.
  assert.equal(run('denemeListe(0).filter(r => r.okulListe).length'), 4);
  const belge = run('JSON.stringify(ogrenciPaketi(0))');
  assert(!belge.includes('siralama') && !belge.includes('SENTETIK') && !belge.includes('Synthetic Bora') && !belge.includes('Synthetic Cem'), 'the package has no list and no other student');
  run('__yok = (() => { const y = paketiYukle(JSON.parse(JSON.stringify(ogrenciPaketi(0)))); return y; })()');
  run("(() => { const t = D; D = __yok; D.rol = 'ogrenci'; EK.ogr = 0; __goz = JSON.stringify(denemeListe(0).map(r => [r.ad, r.tarih, r.id.slice(0, 2), !!r.okulListe])); D = t; })()");
  assert.deepEqual(JSON.parse(sandbox.__goz), [['Hazırbulunuşluk', '2026-08-18', 'p:', false], ['Kendi Deneme', '2026-09-01', 'm:', false]], 'copies and own entries only; the own duplicate of the copy is hidden');
});

(async () => {
  for (const [name, fn] of checks) {
    reset();
    try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; }
  }
  console.log('teacher home regression: ' + passed + ' checks passed');
})();
