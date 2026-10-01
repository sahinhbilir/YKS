'use strict';
// "Kendi TYT planım": a self-paced TYT track next to the school plan. Topics follow the
// YKS plan order, arrive as konu anlatımı (Bilmiyorum) or a one-test check (Biraz/Biliyorum),
// are paced to a target date, and never repeat a topic the school already dates.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8'), marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const source = html.slice(start, html.indexOf('// ---------------------------------------------------------------- başlangıç', start));

function app() {
  const store = {}, listeners = {}, events = [], secimler = [];
  const el = extra => Object.assign({ style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', checked: false,
    classList: { add() {}, remove() {}, contains() { return false; } }, setAttribute() {}, appendChild() {}, remove() {}, focus() {} }, extra || {});
  const nodes = { ray: el(), ana: el(), veri: el() };
  const sandbox = { console, setTimeout: () => 0, clearTimeout() {}, Blob, URL, URLSearchParams, crypto, TextEncoder, structuredClone,
    location: { search: '?dev=1' }, Date, Math, JSON, Intl, alert: m => events.push('alert:' + m), confirm: () => true, prompt: () => '',
    fetch: async () => ({ ok: false }), localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, navigator: {},
    window: { scrollTo() {}, addEventListener() {}, bulut: null },
    document: { activeElement: null, addEventListener(k, fn) { (listeners[k] ||= []).push(fn); }, contains: () => true,
      getElementById: id => nodes[id] || null, querySelector: () => null,
      querySelectorAll: q => q === '.kpSeviye' ? secimler : [], createElement: () => el(),
      body: { appendChild: v => events.push('bilgi:' + v.textContent), insertAdjacentHTML() {} } } };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  const run = code => vm.runInContext(code, sandbox);
  const tikla = async id => { const t = el({ id }); t.closest = q => q === '#' + id ? t : null;
    for (const fn of listeners.click || []) await fn({ target: t }); await run('KAYIT_ZINCIRI'); };
  return { run, events, tikla, nodes, secimler, el };
}
// Grade 12 SAY in class 201 (built-in timetable) or grade 11 in a personal class.
function ogrenci(a, { sinif = 12, tarih = '2026-09-23', dakika = { hi: 200, hs: 290, deneme: false } } = {}) {
  a.run(`D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='${tarih}';D.ayar.planBasi='2026-08-31';
    D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;
    D.ogr=[{no:1,ad:'Kendi',sube:${sinif === 12 ? "'201'" : "'benim'"},alan:'SAY',sinif:${sinif},kap:6,off:[6],aktif:true,
      ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},dakika:${JSON.stringify(dakika)},telafiGunKap:3
      ${sinif < 12 ? ",mufredatBaslangic:'2026-09-14'" : ''}}];
    ${sinif < 12 ? "D.konuPlani.benim=sinifaGoreKonuPlani(11,'SAY');" : ''}
    EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};`);
}
const kur = (a, seviye = {}, hedef = '2027-04-23') => a.run(`kendiPlanKur(0,${JSON.stringify(seviye)},'${hedef}')`);
const haftaKendi = (a, h) => a.run(`(()=>{const p=planHesapla(0,${h});return JSON.parse(JSON.stringify(
  p.gunler.flat().filter(x=>x.anlatim?(p.elle.anlatim[x.ki]||{}).kaynak===KENDI_PLAN_KAYNAK:(p.elle.kendiTest||{})[x.ki])
  .map(x=>({ki:x.ki,anlatim:!!x.anlatim,soru:x.soru,test:x.test}))))})()`);
const checks = [];
async function check(name, fn) { await fn(app()); checks.push(name); }

(async () => {
  await check('tyt-classification-follows-course-and-topic-labels', async a => {
    assert.equal(a.run("tytPlanKonusuMu('Matematik AYT','Türev')"), false);
    assert.equal(a.run("tytPlanKonusuMu('Matematik TYT','Kümeler')"), true);
    assert.equal(a.run("tytPlanKonusuMu('Türkçe','Paragraf')"), true);
    assert.equal(a.run("tytPlanKonusuMu('Fizik','Basınç')"), true);
    assert.equal(a.run("tytPlanKonusuMu('Fizik','Tork ve Tork Dengesi')"), false);
    assert.equal(a.run("tytPlanKonusuMu('Coğrafya','Harita Bilgisi (TYT)')"), true);
    assert.equal(a.run("tytPlanKonusuMu('Coğrafya','Ekstrem Doğa Olayları - Küresel İklim Değişimi (AYT)')"), false);
    assert.equal(a.run("tytPlanKonusuMu('Türk Dili ve Edebiyatı','Şiir')"), false);
  });

  await check('topic-list-is-tyt-only-and-interleaved-by-course', async a => {
    a.run('D=varsayilan();');
    for (const alan of ['SAY', 'EA', 'SÖZ', 'DİL']) {
      const liste = JSON.parse(a.run(`JSON.stringify(kendiPlanKonulari('${alan}'))`));
      assert(liste.length > 150, alan + ' has a full TYT list');
      assert(liste.every(x => a.run(`tytPlanKonusuMu(${JSON.stringify(x.dersAd)},${JSON.stringify(x.ad)})`)));
      assert(!liste.some(x => /AYT/.test(x.dersAd)));
      assert(new Set(liste.slice(0, 8).map(x => x.dersAd)).size >= 4, alan + ' mixes courses from the first week');
    }
    assert.deepEqual(JSON.parse(a.run("JSON.stringify(kendiPlanDersleri('DİL'))")).includes('Matematik AYT'), false);
  });

  await check('school-dated-topics-are-not-repeated', async a => {
    ogrenci(a); a.run('ciz()');
    const sayi = kur(a);
    const kuyruk = JSON.parse(a.run('JSON.stringify(kendiPlanKuyrugu(0))'));
    const okul = JSON.parse(a.run("JSON.stringify(Object.keys((D.subeIslenis||{})['201']||{}).map(Number))"));
    assert(okul.length > 0, 'the school plan dates topics');
    assert(kuyruk.length > 0 && kuyruk.length < sayi, 'school topics are removed from the personal queue');
    assert(!kuyruk.some(x => okul.includes(x.ki)));
    assert.equal(a.run(`kendiKonuMu(0,${okul.find(k => a.run(`D.ogr[0].kendiPlan.sira.includes(${k})`))})`), false);
  });

  await check('weekly-pace-reaches-the-target-and-weeks-do-not-overlap', async a => {
    ogrenci(a); a.run('ciz()');
    kur(a, {}, '2026-12-21');
    const h1 = a.run("sonrakiHafta(0,buHafta(0))"), kalan = a.run('kendiPlanKuyrugu(0).length');
    const K = Math.ceil(kalan / Math.ceil((a.run("gunNo('2026-12-21')") - (a.run('elleAl(0,buHafta(0)).sabit') ? h1 : a.run('buHafta(0)'))) / 7));
    const w1 = JSON.parse(a.run(`JSON.stringify(kendiPlanHaftasi(0,${h1}))`));
    const w2 = JSON.parse(a.run(`JSON.stringify(kendiPlanHaftasi(0,${h1 + 7}))`));
    assert.equal(w1.length, K); assert.equal(w2.length, K);
    assert(!w1.some(x => w2.some(y => y.ki === x.ki)), 'consecutive weeks take different topics');
    assert(w1.every(x => x.anlatim), 'Bilmiyorum (default) starts with konu anlatımı');
  });

  await check('frozen-week-keeps-its-rows-and-the-next-week-continues', async a => {
    ogrenci(a);
    kur(a, {}, '2026-12-21');
    const bu = a.run('buHafta(0)');
    const once = JSON.parse(a.run(`JSON.stringify(kendiPlanHaftasi(0,${bu}))`));
    a.run('ciz()');                                   // automation issues the current week
    assert(a.run(`!!elleAl(0,${bu}).sabit`));
    const kagit = haftaKendi(a, bu);
    assert(kagit.length > 0 && kagit.every(x => x.anlatim), 'the issued week carries the personal lessons');
    assert(kagit.every(x => once.some(y => y.ki === x.ki)));
    const sonraki = JSON.parse(a.run(`JSON.stringify(kendiPlanHaftasi(0,sonrakiHafta(0,${bu})))`));
    assert(!sonraki.some(x => kagit.some(y => y.ki === x.ki)), 'placed topics are not planned again');
    assert.match(a.run(`planListesi(0,${bu},planHesapla(0,${bu}))`), /KONU ANLATIMI · Kendi TYT planın/);
  });

  await check('completed-lesson-leaves-the-queue-and-brings-tests', async a => {
    ogrenci(a);
    kur(a, {}, '2026-12-21'); a.run('ciz()');
    const bu = a.run('buHafta(0)'), ki = haftaKendi(a, bu)[0].ki;
    a.run(`anlatimTamam(0,${ki},bugunNo())`);
    assert(!a.run(`kendiPlanKuyrugu(0).some(x=>x.ki===${ki})`));
    let test = false;
    for (let w = 0; w < 3 && !test; w++) test = a.run(`planHesapla(0,sonrakiHafta(0,${bu})+${w * 7}).gunler.flat().some(x=>x.ki===${ki}&&!x.anlatim)`);
    assert(test, 'a first test follows the self-studied lesson');
  });

  await check('known-courses-start-with-one-test-and-weak-results-add-a-lesson', async a => {
    ogrenci(a, { sinif: 11 });
    const dersler = JSON.parse(a.run("JSON.stringify(kendiPlanDersleri('SAY'))"));
    const seviye = Object.fromEntries(dersler.map(d => [d, d === 'Türkçe' ? 'biraz' : 'bilir']));
    kur(a, seviye, '2026-12-21'); a.run('ciz()');
    const bu = a.run('buHafta(0)'), satirlar = haftaKendi(a, bu);
    assert(satirlar.length > 0 && satirlar.every(x => !x.anlatim && x.test === 1 && x.soru === 12), 'checks are one 12-question test');
    const gun = a.run('bugunNo()');
    const kiTurkce = a.run("D.ogr[0].kendiPlan.sira.find(k=>D.konuDers[k]==='Türkçe')");
    const kiBilir = satirlar.map(x => x.ki).find(k => a.run(`D.konuDers[${k}]`) !== 'Türkçe');
    // Biliyorum + Zor keeps the topic; Biliyorum + Tekrar adds a lesson; Biraz + Zor adds a lesson.
    a.run(`(()=>{const r=[{ki:${kiBilir},gun:${gun},not:2}];sonucIsle(0,r);kendiPlanSonuclariniIsle(0,r);})()`);
    assert.equal(a.run(`(D.ogr[0].kendiPlan.anlatimGerek||{})[${kiBilir}]`), undefined);
    const kiBilir2 = satirlar.map(x => x.ki).filter(k => a.run(`D.konuDers[${k}]`) !== 'Türkçe')[1];
    a.run(`(()=>{const r=[{ki:${kiBilir2},gun:${gun},dogru:3,soru:12}];sonucIsle(0,r);kendiPlanSonuclariniIsle(0,r);})()`);
    assert.equal(a.run(`D.ogr[0].kendiPlan.anlatimGerek[${kiBilir2}]`), gun, '25% on the check counts as Tekrar');
    a.run(`(()=>{const r=[{ki:${kiTurkce},gun:${gun},not:2}];sonucIsle(0,r);kendiPlanSonuclariniIsle(0,r);})()`);
    assert.equal(a.run(`D.ogr[0].kendiPlan.anlatimGerek[${kiTurkce}]`), gun, 'Biraz + Zor asks for a lesson');
    const on = JSON.parse(a.run('JSON.stringify(kendiPlanKuyrugu(0).slice(0,2))'));
    assert.deepEqual(on.map(x => x.anlatim), [true, true]);
    assert.deepEqual(on.map(x => x.ki).sort(), [kiBilir2, kiTurkce].sort(), 'lessons for weak checks come first');
    a.run(`anlatimTamam(0,${kiTurkce},${gun}+1)`);
    assert(!a.run(`kendiPlanKuyrugu(0).some(x=>x.ki===${kiTurkce})`), 'a lesson after the request clears it');
  });

  await check('not-studied-yet-adds-a-lesson-without-shifting-the-school-sequence', async a => {
    ogrenci(a);
    const dersler = JSON.parse(a.run("JSON.stringify(kendiPlanDersleri('SAY'))"));
    kur(a, Object.fromEntries(dersler.map(d => [d, 'bilir'])), '2026-12-21'); a.run('ciz()');
    const bu = a.run('buHafta(0)'), gun = a.run('bugunNo()'), ki = haftaKendi(a, bu)[0].ki;
    const okulOnce = a.run('JSON.stringify(D.ogrIslenis[0]||{})');
    a.run(`kendiPlanCalismadim(0,${ki},${gun},${bu})`);
    assert.equal(a.run(`D.ogr[0].kendiPlan.anlatimGerek[${ki}]`), gun);
    assert(a.run(`yapilmadiMi(0,${ki},${gun})`), 'the check closes without a result');
    assert.equal(a.run('JSON.stringify(D.ogrIslenis[0]||{})'), okulOnce, 'no school date moves');
    assert.equal(a.run('D.konuAnlatilmadi.length'), 0);
    assert.deepEqual(JSON.parse(a.run('JSON.stringify(kendiPlanKuyrugu(0)[0])')), { ki, anlatim: true, gun });
    assert.throws(() => a.run(`kendiPlanCalismadim(0,${ki},${gun - 14},${bu})`), /bu haftanın/);
  });

  await check('result-rows-use-the-personal-wording-only-for-personal-topics', async a => {
    ogrenci(a);
    const dersler = JSON.parse(a.run("JSON.stringify(kendiPlanDersleri('SAY'))"));
    kur(a, Object.fromEntries(dersler.map(d => [d, 'bilir'])), '2026-12-21'); a.run('ciz()');
    const bu = a.run('buHafta(0)'), gun = a.run('bugunNo()');
    const kendiKi = haftaKendi(a, bu)[0].ki;
    const okulKi = +a.run("Object.keys(D.subeIslenis['201']).find(k=>!D.ogr[0].kendiPlan.sira.includes(+k))");
    const satir = ki => a.run(`sonucSatiriHtml({si:0,ki:${ki},gun:${gun},kayit:null,soru:12})`);
    assert.match(satir(kendiKi), /data-kendi="1"[^>]*>Bu konuyu henüz çalışmadım</);
    assert.match(satir(okulKi), />Bu konu daha anlatılmadı</);
    a.run(`kendiPlanCalismadim(0,${kendiKi},${gun},${bu})`);
    assert.match(satir(kendiKi), /Çalışmadım · konu anlatımı sıraya eklendi/);
  });

  await check('unfinished-lesson-in-a-past-week-returns-to-the-queue', async a => {
    ogrenci(a);
    kur(a, {}, '2026-12-21'); a.run('ciz()');
    const bu = a.run('buHafta(0)'), ki = haftaKendi(a, bu)[0].ki;
    assert(!a.run(`kendiPlanKuyrugu(0).some(x=>x.ki===${ki})`));
    a.run("D.ayar.testTarih='2026-09-30';");                // a week later, the lesson was never ticked
    assert(a.run(`kendiPlanKuyrugu(0).some(x=>x.ki===${ki})`));
  });

  await check('stopping-keeps-started-topics-and-adds-nothing-new', async a => {
    ogrenci(a);
    kur(a, {}, '2026-12-21'); a.run('ciz()');
    const bu = a.run('buHafta(0)'), ki = haftaKendi(a, bu)[0].ki;
    a.run(`anlatimTamam(0,${ki},bugunNo())`);
    await a.tikla('kpKapat');
    assert.equal(a.run('D.ogr[0].kendiPlan'), undefined);
    assert.equal(a.run(`D.ogrIslenis[0][${ki}]`), a.run('bugunNo()'));
    assert.deepEqual(JSON.parse(a.run(`JSON.stringify(kendiPlanHaftasi(0,sonrakiHafta(0,${bu})))`)), []);
  });

  await check('settings-card-starts-and-reports-the-plan', async a => {
    ogrenci(a); a.run('ciz()');
    let h = a.run("EK.sekme='ayarlar';gorunumAyarlar()");
    assert.match(h, /Kendi TYT planın · isteğe bağlı/); assert.match(h, /id="kpBaslat"/);
    assert.match(h, /class="kpSeviye" data-ders="Matematik TYT"/);
    a.secimler.push(Object.assign(a.el({ value: 'bilir' }), { dataset: { ders: 'Türkçe' } }));
    a.nodes.kpHedef = a.el({ value: '2027-01-15' });
    await a.tikla('kpBaslat');
    assert.equal(a.run('D.ogr[0].kendiPlan.seviye["Türkçe"]'), 'bilir');
    assert.equal(a.run('D.ogr[0].kendiPlan.hedef'), '2027-01-15');
    assert(a.events.some(e => e.startsWith('bilgi:Kendi TYT planın başladı')));
    h = a.run('gorunumAyarlar()');
    assert.match(h, /\d+ konu kaldı<\/b> · hedef 15\.01\.2027/); assert.match(h, /id="kpKapat"/);
    a.nodes.kpHedef = a.el({ value: '2028-01-01' });
  });

  await check('target-date-must-be-before-the-exam', async a => {
    ogrenci(a);
    assert.match(a.run("kendiPlanHedefHatasi('2028-01-01')"), /YKS tarihinden/);
    assert.match(a.run("kendiPlanHedefHatasi('2026-09-01')"), /bugünden sonra/);
    assert.equal(a.run("kendiPlanHedefHatasi('2027-03-01')"), '');
  });

  await check('plan-id-translation-and-validation-cover-the-personal-plan', async a => {
    ogrenci(a);
    kur(a, {}, '2026-12-21'); a.run('ciz()');
    const cev = JSON.parse(a.run("JSON.stringify(paketPlanKonulariniCevir({kendiTest:{'5':true},anlatim:{'7':{kaynak:'x'}}},k=>k+1))"));
    assert.deepEqual(Object.keys(cev.kendiTest), ['6']);
    a.run('yedekDogrula(JSON.parse(JSON.stringify(D)))');
    for (const kotu of ["{tur:'AYT',hedef:'2027-01-01',seviye:{},sira:[]}", "{tur:'TYT',hedef:'x',seviye:{},sira:[]}",
      "{tur:'TYT',hedef:'2027-01-01',seviye:{Türkçe:'hepsi'},sira:[]}", "{tur:'TYT',hedef:'2027-01-01',seviye:{},sira:[-1]}",
      "{tur:'TYT',hedef:'2027-01-01',seviye:{},sira:[1],anlatimGerek:{'1':'dün'}}"])
      assert.throws(() => a.run(`(()=>{const y=JSON.parse(JSON.stringify(D));y.ogr[0].kendiPlan=${kotu};yedekDogrula(y);})()`), /kendi TYT planı/);
  });

  await check('without-a-personal-plan-nothing-changes', async a => {
    ogrenci(a); a.run('ciz()');
    const h = a.run('sonrakiHafta(0,buHafta(0))');
    assert.deepEqual(JSON.parse(a.run(`JSON.stringify(kendiPlanHaftasi(0,${h}))`)), []);
    assert(!a.run(`!!planHesapla(0,${h}).elle.kendiTest`));
  });

  console.log('personal plan regression: ' + checks.length + ' checks passed');
})().catch(e => { console.error(e); process.exit(1); });
