'use strict';
// Minute-based study budget: 50 s per question, 20-minute konu anlatımı, daily mixed
// practice inside the day, Saturday school mock (180 min) inside the 1760-minute week.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8'), marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const source = html.slice(start, html.indexOf('// ---------------------------------------------------------------- başlangıç', start));

function app() {
  const store = {}, listeners = {}, events = [];
  const el = extra => Object.assign({ style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', checked: false,
    classList: { add() {}, remove() {}, contains() { return false; } }, setAttribute() {}, appendChild() {}, remove() {}, focus() {} }, extra || {});
  const nodes = { ray: el(), ana: el(), veri: el() };
  const sandbox = { console, setTimeout: () => 0, clearTimeout() {}, Blob, URL, URLSearchParams, crypto, TextEncoder, structuredClone,
    location: { search: '?dev=1' }, Date, Math, JSON, Intl, alert: m => events.push('alert:' + m), confirm: () => true, prompt: () => '',
    fetch: async () => ({ ok: false }), localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, navigator: {},
    window: { scrollTo() {}, addEventListener() {}, bulut: null },
    document: { activeElement: null, addEventListener(k, fn) { (listeners[k] ||= []).push(fn); }, contains: () => true,
      getElementById: id => nodes[id] || null, querySelector: () => null, querySelectorAll: () => [], createElement: () => el(),
      body: { appendChild: v => events.push('bilgi:' + v.textContent), insertAdjacentHTML() {} } } };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  const run = code => vm.runInContext(code, sandbox);
  const olay = async (tur, target) => { for (const fn of listeners[tur] || []) await fn({ target }); await run('KAYIT_ZINCIRI'); };
  const tikla = id => { const t = el({ id }); t.closest = q => q === '#' + id ? t : null; return olay('click', t); };
  const degistir = (sinif, ozellik) => { const t = el(ozellik); t.classList = { contains: c => c === sinif }; t.closest = () => null; return olay('change', t); };
  const gunDugmesi = g => { const t = el({ dataset: { i: '0', g: String(g) } }); t.closest = q => q === '.gunDugme' ? t : null; return olay('click', t); };
  return { run, events, tikla, degistir, gunDugmesi, nodes };
}
// A SAY student of the built-in 201 timetable with three weeks of results.
function ogrenci(a, ek) {
  a.run(`D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';D.ayar.planBasi='2026-08-31';
    D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
    D.ogr=[Object.assign({no:1,ad:'Dakika',sube:'201',alan:'SAY',kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),
      maddeler:[],rutin:{}},${JSON.stringify(ek || {})})];
    EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};ciz();`);
  for (let w = 0; w < 3; w++) {
    const h = a.run("gunNo('2026-09-07')") + w * 7;
    a.run(`(()=>{const p=planHesapla(0,${h}),r=[];p.gunler.forEach((l,g)=>l.forEach(x=>{
      if(!x.anlatim&&!x.serbest&&${h}+g<=bugunNo())r.push({ki:x.ki,gun:${h}+g,not:[4,3,2,1][x.ki%4]});}));sonucIsle(0,r);})()`);
  }
}
const plan = (a, h) => a.run(`(()=>{const p=planHesapla(0,${h});return JSON.parse(JSON.stringify({gunler:p.gunler.map(l=>l.map(x=>({
  ki:x.ki,anlatim:!!x.anlatim,serbest:!!x.serbest,soru:x.soru,birim:x.birim||'',pin:!!x.pin}))),gunDakika:p.gunDakika,dakikaButce:p.dakikaButce,
  gunYuk:p.gunYuk,kap:p.kap,tasan:p.tasan}))})()`);
const checks = [];
async function check(name, fn) { await fn(app()); checks.push(name); }

(async () => {
  await check('costs-follow-50-seconds-per-question-and-20-minute-lessons', async a => {
    assert.equal(a.run('soruDakikasi(12)'), 10);
    assert.equal(a.run('soruDakikasi(24)'), 20);
    assert.equal(a.run('isDakikasi({anlatim:true,soru:0})'), 20);
    assert.equal(a.run("isDakikasi({serbest:true,birim:'dakika',soru:45})"), 45);
    assert.equal(a.run('isDakikasi({soru:36})'), 30);
    assert.equal(a.run('HAFTALIK_DAKIKA_SINIRI'), 1760);
  });

  await check('weekly-total-counts-study-days-and-saturday-mock-not-school', async a => {
    assert.equal(a.run('haftalikDakika({hi:120,hs:180,deneme:true},[6])'), 5 * 120 + 180 + 180);
    assert.equal(a.run('haftalikDakika({hi:200,hs:290,deneme:true},[])'), 1760);
    assert.equal(a.run("dakikaAyariHatasi({hi:200,hs:290,deneme:true},[])"), '');
    assert.match(a.run("dakikaAyariHatasi({hi:210,hs:290,deneme:true},[])"), /1810 dk.*en fazla 1760/);
    assert.equal(a.run("dakikaAyariHatasi({hi:210,hs:290,deneme:false},[])"), '', 'no mock: 1630 fits');
    assert.equal(a.run('haftalikDakika({hi:100,hs:100,deneme:true},[0,1,2,3,4,5,6])'), 180, 'the mock counts even on a rest Saturday');
    assert.match(a.run("dakikaAyariHatasi({hi:601,hs:0},[])"), /0–600/);
  });

  await check('day-budget-subtracts-mixed-practice-and-rest-days', async a => {
    ogrenci(a, { dakika: { hi: 120, hs: 180, deneme: true }, gunlukEk: { paragraf: [{ gun: 0, soru: 30 }] } });
    const pzt = a.run("gunNo('2026-09-21')");
    assert.equal(a.run(`gunDakikaButcesi(0,${pzt})`), 120 - 25, '30 paragraph questions = 25 min');
    assert.equal(a.run(`gunDakikaButcesi(0,${pzt + 5})`), 180 - 25, 'Saturday study time excludes the mock');
    assert.equal(a.run(`gunDakikaButcesi(0,${pzt + 6})`), 0, 'Sunday is the rest day');
  });

  await check('scheduler-never-exceeds-a-day-budget-and-counts-lessons', async a => {
    ogrenci(a, { dakika: { hi: 40, hs: 60, deneme: true }, telafiGunKap: 2 });
    a.run("(()=>{const h=gunNo('2026-09-28'),ov=elleAl(0,h,true);ov.anlatim=ov.anlatim||{};[0,1,2].forEach(ki=>{ov.anlatim[ki]={kaynak:'deneme'};});})()");
    let yerlesen = 0, anlatim = 0;
    for (let w = 0; w < 8; w++) {
      const h = a.run("gunNo('2026-09-28')") + w * 7, p = plan(a, h);
      assert(p.gunDakika && p.dakikaButce, 'minute mode returns minutes');
      p.gunler.forEach((l, g) => {
        const serbest = l.filter(x => !x.pin);
        assert(p.gunDakika[g] <= p.dakikaButce[g] + 1e-9 || serbest.length === 0, 'week ' + w + ' day ' + g + ' over budget');
        assert(l.filter(x => x.anlatim).length <= 2, 'daily lesson limit kept');
        yerlesen += l.length; anlatim += l.filter(x => x.anlatim).length;
      });
      assert.equal(p.gunler[6].length, 0, 'rest day stays empty');
    }
    assert(yerlesen > 20, 'the budget still schedules work');
    assert.equal(anlatim, 3, 'lesson rows are placed within the budget');
    const p = plan(a, a.run("gunNo('2026-09-28')"));
    const g = p.gunler.findIndex(l => l.some(x => x.anlatim));
    assert(p.gunDakika[g] >= 20, 'a lesson row costs 20 minutes');
  });

  await check('small-days-make-first-measurements-one-test', async a => {
    ogrenci(a, { dakika: { hi: 15, hs: 15, deneme: false } });
    const p = plan(a, a.run("gunNo('2026-09-28')"));
    const testler = p.gunler.flat().filter(x => !x.anlatim && !x.serbest);
    assert(testler.length > 0);
    assert(testler.every(x => x.soru <= 12), 'no two-test (20-minute) row can fit a 15-minute day');
  });

  await check('saturday-mock-row-is-shown-but-not-a-result-row', async a => {
    ogrenci(a, { dakika: { hi: 120, hs: 180, deneme: true } });
    const h = a.run("gunNo('2026-09-28')");
    const sat = a.run(`gunlukEkliPlan(0,${h},planHesapla(0,${h})).gunler[5].map(x=>[x.ad,x.soru,x.birim,!!x.deneme])`);
    assert.deepEqual(JSON.parse(JSON.stringify(sat[0])), ['Okul denemesi', 180, 'dakika', true]);
    assert.match(a.run(`planListesi(0,${h},planHesapla(0,${h}))`), /Okul denemesi[\s\S]*?180 dakika/);
    assert.match(a.run(`planListesi(0,${h},planHesapla(0,${h}))`), /\d+\/\d+ dk</);
    assert(!a.run(`planHesapla(0,${h}).gunler.flat().some(x=>x.deneme)`), 'the mock is not a scheduled or result row');
    a.run('D.ogr[0].dakika.deneme=false');
    assert(!a.run(`gunlukEkliPlan(0,${h},planHesapla(0,${h})).gunler[5].some(x=>x.deneme)`));
    a.run('delete D.ogr[0].dakika');
    assert(!a.run(`gunlukEkliPlan(0,${h},planHesapla(0,${h})).gunler[5].some(x=>x.deneme)`), 'test-count mode has no mock row');
  });

  await check('legacy-test-count-mode-is-unchanged', async a => {
    ogrenci(a);
    const p = plan(a, a.run("gunNo('2026-09-28')"));
    assert.equal(p.gunDakika, undefined);
    assert(p.gunYuk.every(n => n <= p.kap));
    assert.match(a.run("planListesi(0,gunNo('2026-09-28'),planHesapla(0,gunNo('2026-09-28')))"), /\/6 test</);
  });

  await check('catch-up-placement-uses-minutes', async a => {
    ogrenci(a, { dakika: { hi: 30, hs: 30, deneme: false } });
    const h = a.run("gunNo('2026-09-28')");
    const takip = {};
    const g1 = a.run(`(()=>{const t=${JSON.stringify(takip)};globalThis.__t=t;return telafiGunBul(0,${h},t,2);})()`);
    const kalan = a.run(`gunDakikaButcesi(0,${g1}) - __t[${g1}]`);
    assert(kalan >= 0, 'a two-test catch-up (20 min) fits its day');
    for (let i = 0; i < 6; i++) a.run(`telafiGunBul(0,${h},__t,2)`);
    assert(a.run(`Object.entries(__t).every(([g,m])=>m<=gunDakikaButcesi(0,+g)+1e-9)`), 'catch-up never overfills a day');
  });

  await check('settings-card-shows-weekly-total-and-mode-switch', async a => {
    ogrenci(a, { dakika: { hi: 120, hs: 180, deneme: true } });
    const h = a.run("EK.sekme='ayarlar';gorunumAyarlar()");
    assert.match(h, /Haftalık toplam: 960 \/ 1760 dk/);
    assert.match(h, /class="oDakikaDeneme" checked/);
    assert.match(h, /Liu ve ark\., 2023/);
    ogrenci(a);
    assert.match(a.run("EK.sekme='ayarlar';gorunumAyarlar()"), /id="oDakikayaGec"/);
  });

  await check('switching-to-minutes-converts-test-capacity', async a => {
    ogrenci(a, { kap: 6 });
    await a.tikla('oDakikayaGec');
    assert.deepEqual(JSON.parse(a.run('JSON.stringify(D.ogr[0].dakika)')), { hi: 60, hs: 60, deneme: true });
    await a.tikla('oTesteDon');
    assert.equal(a.run('D.ogr[0].dakika'), undefined);
  });

  await check('settings-changes-over-the-cap-are-refused', async a => {
    ogrenci(a, { off: [6], dakika: { hi: 200, hs: 290, deneme: true } });
    await a.degistir('oDakika', { dataset: { k: 'hi' }, value: '260' });
    assert.equal(a.run('D.ogr[0].dakika.hi'), 200);
    assert(a.events.some(e => e.startsWith('alert:Haftalık toplam')));
    await a.degistir('oDakika', { dataset: { k: 'hs' }, value: '300' });
    assert.equal(a.run('D.ogr[0].dakika.hs'), 300, 'within the cap is saved');
    await a.gunDugmesi(6);
    assert.deepEqual(JSON.parse(a.run('JSON.stringify(D.ogr[0].off)')), [6], 'Sunday stays a rest day: 1780 > 1760');
    await a.degistir('oDakikaDeneme', { checked: false });
    assert.equal(a.run('D.ogr[0].dakika.deneme'), false);
    await a.gunDugmesi(6);
    assert.deepEqual(JSON.parse(a.run('JSON.stringify(D.ogr[0].off)')), [], 'without the mock the week is 1600');
  });

  await check('notebook-validation-accepts-minutes-and-rejects-bad-shapes', async a => {
    ogrenci(a, { dakika: { hi: 120, hs: 180, deneme: true } });
    a.run('yedekDogrula(JSON.parse(JSON.stringify(D)))');
    for (const kotu of ['{hi:-1,hs:0}', "{hi:10,hs:'x'}", '{hi:10,hs:10,deneme:1}', '{hi:10,hs:10,fazla:1}', '[]'])
      assert.throws(() => a.run(`(()=>{const y=JSON.parse(JSON.stringify(D));y.ogr[0].dakika=${kotu};yedekDogrula(y);})()`), /çalışma süresi/);
  });

  await check('new-solo-setup-starts-with-the-minute-budget', async a => {
    a.run("D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};");
    const el = v => ({ value: v, style: {}, dataset: {} });
    Object.assign(a.nodes, { kOgrAd: el('Yeni'), kOgrSinif: el('11'), kMufredatBaslangic: el('2026-09-21'), kOgrSube: el(''), kOgrAlan: el('SAY') });
    await a.tikla('kOgrBaslat');
    assert.deepEqual(JSON.parse(a.run('JSON.stringify(D.ogr[0].dakika)')), { hi: 120, hs: 180, deneme: true });
  });

  console.log('minute budget regression: ' + checks.length + ' checks passed');
})().catch(e => { console.error(e); process.exit(1); });
