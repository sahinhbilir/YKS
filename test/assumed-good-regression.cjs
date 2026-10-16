#!/usr/bin/env node
'use strict';
// A test in a given (saved) week with no result counts as "İyi" for the schedule, so the 2nd, 3rd and
// 4th repetitions keep spacing out. The assumption is never stored as a result: the weeks map stays
// grey, Sonuç gir still asks, calibration sees only real results. A late real result replaces it and
// changes the coming weeks, never a week already given. Synthetic data only.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',className:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){},removeItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},performance,
  window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},
    querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){},classList:{add(){},remove(){},contains(){return false}}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox), json = code => JSON.parse(run('JSON.stringify(' + code + ')'));
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('PASS ' + name); }

// One student, three Edebiyat and two Matematik topics taught on different days; a single real
// result (İyi on 10 Sep) on the first topic. Each Wednesday the week's plan is given (saved).
run(`
  var TOPICS = [0, 1, 2, 40, 41];
  function kur(rol) {
    D = varsayilan(); D.rol = rol; D.ayar.testTarih = '2026-09-09';
    D.ogr = [{ad:'Synthetic', no:1, sube:'12-A', sinif:12, alan:'SAY', kap:6, off:[6], aktif:true, ilkAktif:gunNo('2026-09-07')}];
    D.islenis = {0:gunNo('2026-09-07'), 1:gunNo('2026-09-15'), 2:gunNo('2026-09-29'), 40:gunNo('2026-09-08'), 41:gunNo('2026-09-22')};
    D.elle = {}; D.log = [[gunNo('2026-09-10'), 0, 0, null, null, 3, 1]]; D.kart = {}; kartiYenidenHesapla(0, 0);
    EK = {sekme:'plan', ogr:0, hafta:null, girisAcik:{}};
  }
  // Give week by week. iyi: the student enters İyi for every past test that has no result yet.
  function haftalar(rol, iyi, son) {
    kur(rol);
    for (let w = gunNo('2026-09-07'); w <= gunNo(son); w += 7) {
      D.ayar.testTarih = isoDan(w + 2);
      if (iyi) Object.keys(D.elle).forEach(a => { const hb = +a.split('|')[1];
        sabitHaftaTestleri(D.elle[a], hb).forEach(t => { if (t.gun < bugunNo() && !D.log.some(l => l[2] === t.ki && l[0] === t.gun))
          sonucIsle(0, [{ki:t.ki, gun:t.gun, not:3, dogru:null, soru:null}]); }); });
      varsayimKartlariniGuncelle();
      if (rol === 'rehber') haftayiKullanimaAl(0, buHafta(0)); else ogrenciHaftayiSakla(0, buHafta(0), planHesapla(0, buHafta(0)));
    }
  }
  function verilen() { return Object.keys(D.elle).map(a => +a.split('|')[1]).sort((a, b) => a - b)
    .flatMap(hb => sabitHaftaTestleri(D.elle[a2(hb)], hb).map(t => isoDan(t.gun) + ':' + t.ki)); }
  function a2(hb) { return '0|' + hb; }
  function yerlesim(hb) { return JSON.stringify(planHesapla(0, hb).gunler.map(l => l.map(x => [x.ki, x.soru]))); }
`);

for (const rol of ['rehber', 'ogrenci']) {
  check(rol + ': without results the repetitions space out exactly as if İyi were entered', () => {
    const iyi = json(`(haftalar('${rol}', true, '2026-11-23'), {verilen: verilen(), log: D.log.length})`);
    const bos = json(`(haftalar('${rol}', false, '2026-11-23'), {verilen: verilen(), log: D.log.length, kart: D.kart})`);
    assert.deepEqual(bos.verilen, iyi.verilen, 'same tests on the same days');
    assert(iyi.log > 5, 'the İyi run entered results');
    assert.equal(bos.log, 1, 'the assumption is never written as a result');
    // Topic 0 does not come back every week: given on few days, further and further apart.
    const gunler = bos.verilen.filter(x => x.endsWith(':0')).map(x => x.split(':')[0]);
    assert(gunler.length >= 2 && gunler.length <= 4, 'topic 0 days: ' + gunler);
    const aralik = gunler.slice(1).map((g, i) => (Date.parse(g) - Date.parse(gunler[i])) / 864e5);
    assert(aralik.every((d, i) => i === 0 || d > aralik[i - 1]), 'growing intervals: ' + aralik);
    assert(Object.values(bos.kart).every(k => k.n >= (k.vg || []).length), 'cards count their assumed reviews');
  });
}

check('the weeks map stays grey and Sonuç gir still asks for the missing results', () => {
  run(`haftalar('ogrenci', false, '2026-10-12'); D.ayar.testTarih = '2026-10-14'`);
  const hb = run(`gunNo('2026-09-21')`);
  assert.equal(run(`haftaHaritaDurumu(0, ${hb}, haftaBaslangici(D.ogr[0]), buHafta(0)).durum`), 'atlandi');
  const testler = json(`sabitHaftaTestleri(D.elle['0|${hb}'], ${hb})`);
  assert(testler.length, 'the week had tests');
  const form = run(`(EK.sekme = 'giris', EK.hafta = ${hb}, gorunumGiris())`);
  testler.forEach(t => assert.match(form, new RegExp('data-sonuc-row[^>]*data-ki="' + t.ki + '"[^>]*data-gun="' + t.gun + '"|data-sonuc-row[^>]*data-gun="' + t.gun + '"[^>]*data-ki="' + t.ki + '"')));
  assert.equal(run(`haftaTestOzeti(0, ${hb}, ${hb} + 6).yapilan`), 0, 'no test counts as done');
  assert.equal(run('planYazdirmaEngeli(0, buHafta(0))'), null, 'the plan downloads');
  assert.equal(run('planYazdirmaEngeli(0, sonrakiHafta(0, buHafta(0)))'), null, 'next week downloads too');
  assert(run('!!sonrakiHaftaYazdirmaEngeli(0, sonrakiHafta(0, buHafta(0)))'), 'Sonuç gir still points to the missing week');
});

check('a late real result recalibrates the coming weeks and leaves every given week as it was', () => {
  run(`haftalar('rehber', false, '2026-10-12'); D.ayar.testTarih = '2026-10-15'`);
  const verilmis = json(`Object.keys(D.elle).map(a => +a.split('|')[1])`);
  const once = json(`Object.keys(D.elle).map(a => yerlesim(+a.split('|')[1]))`);
  const sonraki = run('sonrakiHafta(0, buHafta(0))');
  // The latest given test of a topic (no later assumed review) that is not due again until after next week.
  const t = json(`Object.keys(D.elle).map(a => +a.split('|')[1]).filter(hb => hb < buHafta(0))
    .flatMap(hb => sabitHaftaTestleri(D.elle['0|' + hb], hb)).filter(x => (D.kart['0:' + x.ki].vg || []).slice(-1)[0] === x.gun &&
      D.kart['0:' + x.ki].due > ${sonraki} + 6 && !planHesapla(0, buHafta(0)).gunler.flat().some(y => y.ki === x.ki))[0]`);
  assert(t, 'fixture has such a test');
  const kartOnce = json(`D.kart['0:${t.ki}']`);
  assert((kartOnce.vg || []).includes(t.gun), 'counted as İyi before the result');
  const plOnce = json(`planHesapla(0, ${sonraki}).gunler.flat().map(x => x.ki)`);
  run(`sonucIsle(0, [{ki:${t.ki}, gun:${t.gun}, not:1, dogru:null, soru:null}])`);
  const kart = json(`D.kart['0:${t.ki}']`);
  assert(!(kart.vg || []).includes(t.gun) && kart.not !== undefined, 'the real result replaced the assumption');
  assert(kart.due < kartOnce.due, 'Tekrar brings the topic back sooner');
  const pl = json(`planHesapla(0, ${sonraki}).gunler.flat().map(x => x.ki)`);
  assert(pl.includes(t.ki) && !plOnce.includes(t.ki), 'next week now has the topic');
  assert.deepEqual(json(`Object.keys(D.elle).map(a => yerlesim(+a.split('|')[1]))`), once, 'given weeks unchanged');
  assert.deepEqual(json(`Object.keys(D.elle).map(a => +a.split('|')[1])`), verilmis);
});

check('"Yapmadım", "Bu konu daha anlatılmadı" and a week whose tests were not done are not assumed', () => {
  run(`haftalar('ogrenci', false, '2026-09-28'); D.ayar.testTarih = '2026-09-30'`);
  const hb = run(`gunNo('2026-09-21')`);
  const [a] = json(`sabitHaftaTestleri(D.elle['0|${hb}'], ${hb})`);
  run(`testiYapilmadiIsaretle(0, ${a.ki}, ${a.gun}); ciz()`);
  assert(!((run(`(D.kart['0:${a.ki}'] || {}).vg || []`)) || []).includes(a.gun), 'Yapmadım');
  assert(run(`erteleAl(0, ${a.ki})`) > a.gun, 'moved on, as before');
  // Not taught: the student's own topic this week; earlier assumed reviews of the old attempt drop out.
  const bu = json(`sabitHaftaTestleri(D.elle['0|' + buHafta(0)], buHafta(0)).filter(t => t.gun <= bugunNo())[0]`);
  assert(bu, 'fixture has a test this week');
  run(`konuAnlatilmadi(0, ${bu.ki}, ${bu.gun})`);
  assert(!((json(`(D.kart['0:${bu.ki}'] || {}).vg || []`)).some(g => g < run(`resetIlkTekrarGunu(0, ${bu.ki})`))), 'not taught');
  // Teacher: "came to school, tests not done" removes the week's assumption and postpones its tests.
  run(`haftalar('rehber', false, '2026-09-28'); D.ayar.testTarih = '2026-09-30'`);
  const testler = json(`sabitHaftaTestleri(D.elle['0|${hb}'], ${hb})`);
  run(`haftayiTelafiEt(0, ${hb}, 'geldi_cozmedi')`);
  assert.equal(run(`kartHesapla(0, ${testler[0].ki}, D.kart['0:${testler[0].ki}'] && D.kart['0:${testler[0].ki}'].vg || []) ? JSON.stringify(kartHesapla(0, ${testler[0].ki}, D.kart['0:${testler[0].ki}'].vg || [])) : 'null'`),
    run(`JSON.stringify(D.kart['0:${testler[0].ki}'] || null)`), 'cards are exactly what the results and the assumption give');
  testler.forEach(t => {
    assert(!((json(`(D.kart['0:${t.ki}'] || {}).vg || []`)).includes(t.gun)), 'decided week ' + t.ki);
    // Not done means not reviewed: the topic comes back by the end of the following week (overdue, or
    // postponed there through ertele, never by editing the card).
    const etkin = run(`Math.max(D.kart['0:${t.ki}'] ? D.kart['0:${t.ki}'].due : -Infinity, erteleAl(0, ${t.ki}) ?? -Infinity)`);
    assert(etkin <= hb + 13, 'comes back ' + t.ki);
  });
  // "Önemsiz" keeps the assumption.
  run(`haftalar('rehber', false, '2026-09-28'); D.ayar.testTarih = '2026-09-30'; haftayiTelafiEt(0, ${hb}, 'onemsiz')`);
  testler.forEach(t => assert((json(`(D.kart['0:${t.ki}'] || {}).vg || []`)).includes(t.gun), 'önemsiz keeps İyi'));
});

check('free work, lessons, recovered "yapılmadı" rows and days on or after the exam are never assumed', () => {
  run(`kur('rehber'); D.ayar.testTarih = '2026-09-16'; var h = gunNo('2026-09-07');
    D.elle['0|' + h] = {ek:[], sil:[], yer:{}, soru:{}, degisim:{}, konuSlot:{KURT_0:{ki:1}, KURT_1:{ki:2}, KURT_2:{ki:3, anlatim:true}}, serbest:{s1:{ad:'x'}}, anlatim:{40:{}},
      sabit:h, plan:{surum:2, slotlar:[['41','s1','40'],['KURT_0'],['KURT_1'],['KURT_2'],[],[],[]], off:[], kap:6, devreden:0, tasan:[]},
      kurtarma:{id:'k', imza:'', satirlar:[{ki:1, gun:h+1, tur:'test', durum:'yapilmadi'}, {ki:2, gun:h+2, tur:'test', durum:'planlandi'}, {ki:3, gun:h+3, tur:'anlatim', durum:'tamamlandi'}]}};
    varsayimKartlariniGuncelle()`);
  assert.deepEqual(json(`Array.from(varsayimIyiGunleri(0)).sort((a, b) => a[0] - b[0])`), [[2, [run(`h + 2`)]], [41, [run('h')]]]);
  run(`D.ayar.sinav = isoDan(h + 2)`);
  assert.deepEqual(json(`Array.from(varsayimIyiGunleri(0).keys())`), [41], 'nothing on or after the exam day');
});

check('calibration and the result package see real results only', () => {
  run(`haftalar('ogrenci', false, '2026-11-02')`);
  assert(run(`Object.values(D.kart).some(k => k.vg)`), 'there are assumed reviews');
  assert.equal(run(`dersKayitlari(0, dersKisaAd(konuDersAdi(0))).length`), 1);
  assert.equal(run(`sonucPaketi().kayit.length`), 1);
});

check('the repetition label counts assumed reviews and says no result was entered', () => {
  run(`haftalar('rehber', false, '2026-11-23')`);
  const r = json(`(() => { const out = []; Object.keys(D.elle).map(a => +a.split('|')[1]).sort((a, b) => a - b).forEach(hb => {
    const p = planHesapla(0, hb); p.gunler.forEach((l, g) => l.forEach(x => { if (x.ki === 0) out.push(tekrarBilgisi(0, x, hb + g)); })); }); return out; })()`);
  assert(r.length >= 2);
  r.forEach((b, i) => assert.equal(b.n, i + 2, 'stage ' + (i + 2)));     // the real 10 Sep result was the 1st
  assert.match(r[r.length - 1].aciklama, /sonuç girilmedi/);
  assert.match(r[0].aciklama, /İyi/);                                      // after the real result
});

check('recomputing a given week live keeps its own tests', () => {
  run(`haftalar('rehber', false, '2026-09-21'); D.ayar.testTarih = '2026-09-22'`);
  const hb = run('buHafta(0)');
  const kayitli = json(`planHesapla(0, ${hb}).gunler.flat().map(x => x.ki).sort()`);
  const canli = json(`(() => { const ov = D.elle['0|${hb}']; delete D.elle['0|${hb}']; const p = planHesapla(0, ${hb}); D.elle['0|${hb}'] = ov; return p.gunler.flat().map(x => x.ki).sort(); })()`);
  assert.deepEqual(canli, kayitli, 'a week does not count its own tests as done');
});

check('a given week sees cards as they were before it: its first measurements stay first measurements', () => {
  run(`kur('rehber'); D.ayar.testTarih = '2026-09-16'; haftayiKullanimaAl(0, buHafta(0))`);
  const hb = run('buHafta(0)');
  const ilk = json(`planHesapla(0, ${hb}).gunler.flatMap((l, g) => l.map(x => ({ki: x.ki, kart: x.kart || null, b: tekrarBilgisi(0, x, ${hb} + g)})))`)
    .filter(x => x.b.tur === 'ilk');
  assert(ilk.length, 'the week has first measurements');
  ilk.forEach(x => {
    assert.equal(x.kart, null, 'no card before its own day: ' + x.ki);
    assert((json(`D.kart['0:${x.ki}'].vg`) || []).length, 'yet the coming weeks count it as İyi: ' + x.ki);
  });
});

check('reloading the notebook keeps the cards; a second pass changes nothing', () => {
  run(`haftalar('rehber', false, '2026-11-02')`);
  const kart = run('JSON.stringify(D.kart)');
  run(`D = JSON.parse(JSON.stringify(D))`);
  assert.equal(run('varsayimKartlariniGuncelle()'), false);
  assert.equal(run('JSON.stringify(D.kart)'), kart);
  assert.equal(run('varsayimKartlariniGuncelle()'), false);
  // ciz() runs the pass and renders without errors.
  run(`EK.sekme = 'plan'; ciz()`);
  assert.equal(run('JSON.stringify(D.kart)'), kart);
});

check('a postponement an older version wrote onto a card survives the first recompute', () => {
  run(`haftalar('rehber', false, '2026-09-21')`);
  const t = json(`sabitHaftaTestleri(D.elle['0|' + gunNo('2026-09-21')], gunNo('2026-09-21'))[0]`);
  // Old notebook: card computed from real results only, its due moved by a "Nasıl geçti?" decision.
  run(`D.log.push([gunNo('2026-09-14'), 0, ${t.ki}, null, null, 2, 2]); D = JSON.parse(JSON.stringify(D));
    var eski = kartHesapla(0, ${t.ki}, []); eski.due = gunNo('2026-10-26'); D.kart['0:${t.ki}'] = eski; delete (D.ertele || {})['0:${t.ki}']`);
  run('varsayimKartlariniGuncelle()');
  assert.equal(run(`erteleAl(0, ${t.ki})`), run(`gunNo('2026-10-26')`));
});

check('a large notebook stays fast', () => {
  const ms = run(`(() => {
    kur('rehber'); D.ayar.testTarih = '2027-03-10'; const bas = gunNo('2026-08-24'), ki = Array.from({length: 30}, (_, i) => i);
    D.ogr = Array.from({length: 180}, (_, i) => ({ad:'S' + i, no:i, sube:'12-' + 'ABC'[i % 3], sinif:12, alan:'SAY', kap:6, off:[6], aktif:true, ilkAktif:bas}));
    D.log = []; D.kart = {}; D.elle = {};
    for (let i = 0; i < 180; i++) for (let w = 0; w < 28; w++) {
      const hb = bas + 7 * w, slotlar = [[], [], [], [], [], [], []];
      for (let j = 0; j < 18; j++) slotlar[j % 6].push(String(ki[(w * 3 + j) % 30]));
      D.elle[i + '|' + hb] = {ek:[], sil:[], yer:{}, soru:{}, degisim:{}, konuSlot:{}, sabit:hb, plan:{surum:2, slotlar, off:[6], kap:6, devreden:0, tasan:[]}};
      if (w % 2) D.log.push([hb + 1, i, ki[(w * 3) % 30], null, null, 3, 1]);
    }
    const t0 = performance.now(); varsayimKartlariniGuncelle(); const ilk = performance.now() - t0;
    const t1 = performance.now(); varsayimKartlariniGuncelle(); const ikinci = performance.now() - t1;
    return JSON.stringify([ilk, ikinci, Object.keys(D.kart).length]);
  })()`);
  const [ilk, ikinci, kart] = JSON.parse(ms);
  console.log('  first pass ' + ilk.toFixed(0) + ' ms, unchanged pass ' + ikinci.toFixed(0) + ' ms, ' + kart + ' cards');
  assert(kart >= 180 * 25);
  assert(ilk < 15000 && ikinci < 1500, 'too slow');
});

console.log('assumed good regression: ' + passed + ' checks passed');
