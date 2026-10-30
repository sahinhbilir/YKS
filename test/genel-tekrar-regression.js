'use strict';
// "Genel tekrar" and "Zaten yaptım" on the personal plan (Kendi YKS/TYT planın).
// 1) Before any topic, the student watches one 2-hour "Genel tekrar" per subject (TYT and AYT apart),
//    in curriculum order; topics start only in the week after the last one is placed.
// 2) On the student's weekly plan every lesson / genel tekrar / test of the own plan can be marked
//    "Zaten yaptım": the algorithm acts as if it happened on the last day of the previous week.
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
  const json = code => JSON.parse(run('JSON.stringify(' + code + ')'));
  return { run, json, events, nodes, el, listeners };
}
const checks = [];
async function check(name, fn) { await fn(app()); checks.push(name); }
// Not in school, Wednesday 23 September 2026, the full YKS plan from this Monday.
async function okulsuz(a, { alan = 'SAY', hedef = '2027-04-23', seviye = {}, dakika, kur = true } = {}) {
  a.run("D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};");
  Object.assign(a.nodes, { kOgrAd: a.el({ value: 'Mezun' }), kOgrOkul: a.el({ value: 'hayir' }),
    kOgrAlan: a.el({ value: alan }), kOgrSinav: a.el({ value: '2027-06-19' }) });
  const t = a.el({ id: 'kOgrBaslat' }); t.closest = q => q === '#kOgrBaslat' ? t : null;
  for (const fn of a.listeners.click || []) await fn({ target: t });
  await a.run('KAYIT_ZINCIRI');
  if (dakika) a.run(`D.ogr[0].dakika=${JSON.stringify(dakika)}`);
  if (kur) a.run(`kendiPlanKur(0,${JSON.stringify(seviye)},'${hedef}')`);
}
const hepsiBilir = a => a.json("Object.fromEntries(kendiPlanDersleri('SAY','YKS').map(d=>[d,'bilir']))");
const genelTekrarBitir = a => a.run('(()=>{const g=D.ogr[0].kendiPlan.genelTekrar;g.sira.forEach(k=>{g.tamam[k]=0;});})()');
const hafta = (a, h) => a.json(`planHesapla(0,${h}).gunler.map(l=>l.map(x=>({ki:x.ki,ad:x.ad,gt:!!x.genelTekrar,anlatim:!!x.anlatim,soru:x.soru,slot:String(planSlotAnahtari(x))})))`);
const satirlar = (a, h) => hafta(a, h).flat();
const sonraki = (a, h) => a.run(`sonrakiHafta(0,${h})`);

(async () => {
  await check('one-genel-tekrar-per-subject-in-curriculum-order-two-hours-each', async a => {
    await okulsuz(a);
    const gt = a.json('D.ogr[0].kendiPlan.genelTekrar');
    assert.deepEqual(gt.tamam, {});
    // The order is the order subjects first appear in the topic sequence; TYT and AYT parts are separate items.
    const ilk = a.json(`(()=>{const sira=D.ogr[0].kendiPlan.sira,m=new Map();
      sira.forEach((ki,i)=>{const g=[...genelTekrarDurumu(0).gr.g.values()].find(x=>x.kis.includes(ki));if(!m.has(g.anahtar))m.set(g.anahtar,i);});return [...m.entries()];})()`);
    assert.deepEqual(ilk.map(x => x[0]), gt.sira);
    assert(ilk.every((x, i) => i === 0 || x[1] > ilk[i - 1][1]), 'first appearances increase');
    const adlar = a.json('[...genelTekrarDurumu(0).gr.g.values()].map(g=>g.ad)');
    for (const ad of ['TYT Matematik', 'AYT Matematik', 'TYT Fizik', 'AYT Fizik', 'TYT Türkçe', 'AYT Kimya', 'TYT Geometri', 'TYT Din Kültürü'])
      assert(adlar.includes(ad), ad + ' in ' + adlar);
    assert(!adlar.some(x => /Türk Dili|İnkılap/.test(x)), 'SAY has no edebiyat or inkılap course');
    assert.equal(new Set(adlar).size, adlar.length, 'one item per subject and session');
    assert.equal(a.run('GENEL_TEKRAR_DAKIKA'), 120);
    // The first plan week carries them as their own row type, 120 minutes each.
    a.run('ciz()');
    const bu = a.run('buHafta(0)'), satir = satirlar(a, bu);
    assert(satir.length > 0 && satir.every(x => x.gt && x.soru === 120), 'the first week holds only genel tekrar rows');
    assert.deepEqual(satir.map(x => x.ad), adlar.slice(0, satir.length), 'curriculum order');
    assert.equal(a.run(`isDakikasi({serbest:true,birim:'dakika',soru:120})`), 120);
    const p = a.json(`(()=>{const p=planHesapla(0,${bu});return {gd:p.gunDakika,b:p.dakikaButce}})()`);
    p.gd.forEach((m, g) => { assert(m <= p.b[g], 'day ' + g + ' within budget'); assert([0, 120].includes(m), 'one 2-hour item per day: ' + m); });
    const gorunum = a.run('gorunumOgrenciPlan()');
    assert.match(gorunum, /GENEL TEKRAR · TYT Fizik · 2 saat/);
    assert.match(gorunum, /GENEL TEKRAR · 2 saat/);
    assert.doesNotMatch(gorunum, /data-hucre/, 'student view stays read-only');
    // The plan card reports them.
    const kart = a.run('kendiPlanKarti(0)');
    assert.match(kart, new RegExp('Önce genel tekrar:</b> ' + adlar.length + ' ders · ~' + adlar.length * 2 + ' saat'));
    assert.equal(a.json('kendiPlanHaftalikSayi(0)').genelTekrar, adlar.length);
  });

  await check('every-field-gets-its-own-tyt-and-ayt-items-in-plan-order', async a => {
    const gelen = {};
    for (const alan of ['SAY', 'EA', 'SÖZ', 'DİL']) {
      await okulsuz(a, { alan });
      gelen[alan] = a.json('[...genelTekrarDurumu(0).gr.g.values()].map(g=>g.ad)');
      assert.equal(new Set(gelen[alan]).size, gelen[alan].length);
      assert.deepEqual(a.json('D.ogr[0].kendiPlan.genelTekrar.sira'), a.json('[...genelTekrarDurumu(0).gr.g.keys()]'));
    }
    assert(gelen.EA.includes('AYT Türk Dili ve Edebiyatı') && gelen.EA.includes('AYT Coğrafya') && gelen.EA.includes('AYT Matematik'));
    assert(gelen.SÖZ.includes('AYT Felsefe') && !gelen.SÖZ.includes('AYT Matematik'));
    assert(gelen.DİL.every(x => x.startsWith('TYT ')), 'DİL stays TYT-only');
    assert.equal(gelen.SAY.indexOf('TYT Matematik') < gelen.SAY.indexOf('AYT Matematik'), true);
  });

  await check('in-school-students-get-no-genel-tekrar-and-their-topics-start-at-once', async a => {
    a.run("D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};");
    a.run(`D.ogr=[{no:1,ad:'Kendi',sube:'201',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},
      dakika:{hi:200,hs:290,deneme:false},telafiGunKap:3}];D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;`);
    a.run("kendiPlanKur(0,{},'2027-01-15')");
    assert.equal(a.run('D.ogr[0].kendiPlan.genelTekrar'), undefined, 'the field is not created');
    assert.equal(a.run('genelTekrarHazirla(0)'), null);
    assert.equal(a.json('genelTekrarDurumu(0).liste').length, 0);
    assert.equal(a.run('kendiPlanGenelTekrarPlani(0).haftalar.size'), 0);
    a.run('ciz()');
    const bu = a.run('buHafta(0)');
    assert(!a.json(`planHesapla(0,${bu}).gunler.flat().some(x=>x.genelTekrar)`));
    assert(a.json(`kendiPlanHaftasi(0,${sonraki(a, bu)})`).length > 0, 'topics start with the next unissued week as before');
    assert.equal(a.run('kendiPlanIlkKonuHaftasi(0)'), sonraki(a, bu));
    assert.equal(a.run('ogrenciOtomasyonUygula()') !== undefined, true);
    assert.equal(a.run('D.ogr[0].kendiPlan.genelTekrar'), undefined, 'not even lazily');
    const kart = a.run('kendiPlanKarti(0)');
    assert.doesNotMatch(kart, /genel tekrar/);
    assert.equal(a.json('kendiPlanHaftalikSayi(0)').genelTekrar, 0);
    assert.doesNotMatch(a.run('gorunumOgrenciPlan()'), /GENEL TEKRAR/);
    // Zaten yaptım stays for the lesson.
    const ki = a.json(`planHesapla(0,${bu}).gunler.flat().find(x=>x.anlatim)?.ki`);
    if (ki !== undefined) assert.equal(a.run(`kendiPlanAnlatimOnceden(0,${ki})`), bu - 1);
  });

  await check('tyt-only-and-other-exam-students-without-school-get-their-own-items', async a => {
    await okulsuz(a, { kur: false });
    a.run("D.ogr[0].alan='SAY';D.ogr[0].sinavTuru=undefined;delete D.ogr[0].sinavTuru;");
    a.run("kendiPlanKur(0,{},'2027-01-15')");
    assert.equal(a.run('D.ogr[0].kendiPlan.tur'), 'YKS');
    a.run("D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';");
    a.run(`okulsuzDefterKur('Aday','SAY','2027-07-11','KPSS');`);
    assert.equal(a.run('D.ogr[0].okul'), false, 'every no-school setup is okul=false');
    a.run("kendiPlanKur(0,{},'2027-03-01')");
    const kpss = a.json('[...genelTekrarDurumu(0).gr.g.values()].map(g=>g.ad)');
    assert(kpss.length >= 3 && kpss.every(x => !/^(TYT|AYT) /.test(x)), kpss.join());
    assert(a.json('genelTekrarDurumu(0).liste').length === kpss.length, 'the exam student gets genel tekrar');
    // A TYT-track student without school (okul=false, tur TYT) is not produced by setup; the items would be TYT-only.
    a.run("D.ogr[0].sinavTuru='YKS';delete D.ogr[0].sinavTuru;kendiPlanKur(0,{},'2027-03-01');D.ogr[0].kendiPlan.tur='TYT';");
    assert.equal(a.run('D.ogr[0].kendiPlan.tur'), 'TYT');
    assert(a.json('[...genelTekrarDurumu(0).gr.g.values()].map(g=>g.ad)').every(x => x.startsWith('TYT ')));
  });

  await check('genel-tekrar-fits-the-daily-budget-and-never-stacks-two-in-a-day', async a => {
    await okulsuz(a);
    const bu = a.run('buHafta(0)');
    for (let w = 0, h = bu; w < 4; w++, h = sonraki(a, h)) {
      const p = a.json(`(()=>{const p=planHesapla(0,${h});return {gd:p.gunDakika,b:p.dakikaButce,g:p.gunler.map(l=>l.filter(x=>x.genelTekrar).length)}})()`);
      p.g.forEach((n, g) => { assert(n <= 1, 'at most one per day'); assert(p.gd[g] <= p.b[g], 'within the day budget'); });
    }
    // 90 minutes a day cannot hold two hours: one item a week on an otherwise empty day (the only budget overrun).
    const b = app();
    await okulsuz(b, { dakika: { hi: 90, hs: 90, deneme: false } });
    const b0 = b.run('buHafta(0)');
    const gunler = (h) => b.json(`planHesapla(0,${h}).gunler.map(l=>l.filter(x=>x.genelTekrar).length)`);
    assert.equal(gunler(b0).reduce((x, y) => x + y, 0), 1, 'the current week');
    assert.equal(gunler(sonraki(b, b0)).reduce((x, y) => x + y, 0), 1, 'the next week');
    const dk = b.json(`planHesapla(0,${sonraki(b, b0)}).gunler.map((l,g)=>l.length)`);
    assert(dk.every(n => n <= 1), 'on an empty day: ' + dk);
    // Test-count mode (no minute budget): still one a day.
    const c = app();
    await okulsuz(c);
    c.run('delete D.ogr[0].dakika;D.ogr[0].kap=6;D.ogr[0].off=[6]');
    const c1 = sonraki(c, c.run('buHafta(0)'));
    const sayilar = c.json(`planHesapla(0,${c1}).gunler.map(l=>l.filter(x=>x.genelTekrar).length)`);
    assert(sayilar.every(n => n <= 1) && sayilar.reduce((x, y) => x + y, 0) >= 5, 'one a day in test-count mode: ' + sayilar);
  });

  await check('topics-start-only-after-the-last-genel-tekrar-week-and-no-cards-or-tests-appear', async a => {
    await okulsuz(a);
    const bu = a.run('buHafta(0)'), son = a.run('kendiPlanGenelTekrarPlani(0).son');
    assert(son > bu, 'several weeks of genel tekrar');
    let h = bu;
    for (; h <= son; h = sonraki(a, h)) {
      const s = satirlar(a, h);
      assert(s.length > 0 && s.every(x => x.gt), 'week ' + a.run(`isoDan(${h})`) + ' holds only genel tekrar');
      assert.deepEqual(a.json(`kendiPlanHaftasi(0,${h})`), []);
    }
    const ilk = satirlar(a, h);
    assert(ilk.length > 0 && ilk.every(x => !x.gt && x.anlatim), 'the week after the last genel tekrar starts the lessons');
    assert.equal(a.run('kendiPlanIlkKonuHaftasi(0)'), h);
    // The pace now counts the weeks from there.
    const kalan = a.run('kendiPlanKuyrugu(0).length');
    assert.equal(ilk.length >= 1 && a.json(`kendiPlanHaftasi(0,${h})`).length, Math.ceil(kalan / Math.ceil((a.run("gunNo('2027-04-23')") - h) / 7)));
    // Genel tekrar never creates a card, a test, a log row or a lesson date.
    a.run('ciz()');
    assert.equal(a.run('Object.keys(D.kart).length'), 0);
    assert.equal(a.run('D.log.length'), 0);
    assert.equal(a.run('Object.keys((D.ogrIslenis||{})[0]||{}).length'), 0);
    assert(!a.json(`planHesapla(0,${bu}).gunler.flat().some(x=>!x.serbest)`), 'no test or lesson row in the first week');
    assert.equal(a.json(`planHesapla(0,${bu}).elle.kendiTest||null`), null);
  });

  await check('ticked-items-are-done-and-unfinished-ones-return-in-front-of-the-rest', async a => {
    await okulsuz(a);
    a.run('ciz()');
    const bu = a.run('buHafta(0)'), ov = () => a.json(`elleAl(0,${bu}).serbest`);
    const idler = Object.keys(ov()), ilk4 = idler.map(id => ov()[id].gt);
    assert.equal(idler.length, 4);
    const sonBeklenen = a.run('kendiPlanGenelTekrarPlani(0).son');
    // Wednesday: the first one was watched on its day (the form's “izledim”).
    const gun = a.run(`bugunNo()+(elleAl(0,${bu}).yer['${idler[0]}'][0]-(bugunNo()-${bu}))`);
    a.run('D.ayar.testTarih=isoDan(' + gun + ')');
    a.run(`genelTekrarTamam(0,${bu},'${idler[0]}',${gun})`);
    assert.equal(a.run(`D.ogr[0].kendiPlan.genelTekrar.tamam['${ilk4[0]}']`), gun);
    assert.equal(a.run(`elleAl(0,${bu}).serbest['${idler[0]}'].tamamGun`), gun);
    assert.equal(a.run(`genelTekrarTamamMi(planHesapla(0,${bu}),{genelTekrar:true,ki:'${idler[0]}'},${gun})`), true);
    // Next week arrives (its prepared draft is issued as it was); the three unticked items are back in
    // the queue, first in curriculum order and ahead of the ones never placed.
    a.run('D.ayar.testTarih=isoDan(' + (bu + 7) + ');ciz();');
    const bu2 = a.run('buHafta(0)');
    assert.equal(bu2, bu + 7);
    const sira = a.json('[...genelTekrarDurumu(0).gr.g.keys()]');
    const kuyruk = a.json('kendiPlanGenelTekrarKuyrugu(0)');
    assert.deepEqual(kuyruk.slice(0, 3), sira.slice(1, 4), 'unticked rows return first');
    assert(!kuyruk.includes(sira[0]), 'the ticked one does not return');
    const adlar = a.json('[...genelTekrarDurumu(0).gr.g.values()].map(g=>g.ad)');
    assert.deepEqual(satirlar(a, bu2 + 7).filter(x => x.gt).map(x => x.ad).slice(0, 3), adlar.slice(1, 4));
    assert(a.run('kendiPlanGenelTekrarPlani(0).son') >= sonBeklenen, 'the topic start does not move earlier');
  });

  await check('running-plans-get-the-field-lazily-and-started-subjects-are-marked-done', async a => {
    await okulsuz(a);
    a.run('delete D.ogr[0].kendiPlan.genelTekrar');        // a plan that started before this feature
    const ki = k => a.json(`D.ogr[0].kendiPlan.sira.filter(ki=>D.konuDers[ki]==='${k}')`);
    const fizik = ki('Fizik')[0], geometri = ki('Geometri')[0];
    a.run(`anlatimTamam(0,${fizik},bugunNo()-10)`);        // a lesson already done in TYT Fizik
    a.run(`sonucIsle(0,[{ki:${geometri},gun:bugunNo()-3,not:3}])`);  // and a result in Geometri
    const aytFizik = a.json(`D.ogr[0].kendiPlan.sira.filter(ki=>D.konuDers[ki]==='Fizik'&&konuSinavTuru(ki)==='AYT')[0]`);
    assert.equal(a.run('D.ogr[0].kendiPlan.genelTekrar'), undefined);
    // Derived state works before anything is written ...
    const d = a.json(`(()=>{const d=genelTekrarDurumu(0);return {bitti:[...d.bitti],kuyruk:kendiPlanGenelTekrarKuyrugu(0)}})()`);
    assert.deepEqual(d.bitti.sort(), ['TYT|Fizik', 'TYT|Geometri']);
    assert(!d.kuyruk.includes('TYT|Fizik') && !d.kuyruk.includes('TYT|Geometri') && d.kuyruk.includes('AYT|Fizik') && d.kuyruk.includes('TYT|Kimya'));
    assert(aytFizik === undefined || d.kuyruk.includes('AYT|Fizik'), 'AYT Fizik was not started');
    // ... and the student-side preparation writes it once, with an empty tamam for everything not started.
    assert.equal(a.run('ogrenciOtomasyonUygula()'), true);
    const gt = a.json('D.ogr[0].kendiPlan.genelTekrar');
    assert.deepEqual(Object.keys(gt.tamam).sort(), ['TYT|Fizik', 'TYT|Geometri']);
    assert.equal(gt.tamam['TYT|Fizik'], a.run('bugunNo()') - 10);
    assert.equal(gt.sira.length, a.json('[...genelTekrarDurumu(0).gr.g.keys()]').length);
    a.run('ciz()');
    const bu = a.run('buHafta(0)');
    const adlar = satirlar(a, bu).filter(x => x.gt).map(x => x.ad);
    assert(adlar.length > 0 && !adlar.includes('TYT Fizik') && !adlar.includes('TYT Geometri'), 'nobody is sent back: ' + adlar);
    // Restarting a stopped plan keeps the started subjects done as well.
    a.run('delete D.ogr[0].kendiPlan');
    a.run("kendiPlanKur(0,{},'2027-04-23')");
    assert.deepEqual(Object.keys(a.json('D.ogr[0].kendiPlan.genelTekrar.tamam')).sort(), ['TYT|Fizik', 'TYT|Geometri']);
  });

  await check('sonuc-gir-has-an-izledim-box-and-the-weeks-map-counts-genel-tekrar-as-lesson-work', async a => {
    await okulsuz(a);
    a.run('ciz()');
    const bu = a.run('buHafta(0)'), idler = Object.keys(a.json(`elleAl(0,${bu}).serbest`));
    a.run("EK.sekme='giris';EK.hafta=null");
    let giris = a.run('gorunumGiris()');
    assert.equal((giris.match(/class="gGenelTekrar"/g) || []).length, 4);
    assert.match(giris, /TYT Fizik <span class="mini">· 2 saat<\/span>/);
    assert.match(giris, /class="gGenelTekrar" data-ki="GT0" data-gun="\d+">izledim/, 'today can be ticked');
    assert.match(giris, /class="gGenelTekrar" data-ki="GT1" data-gun="\d+" disabled>bu gün henüz gelmedi/, 'a future day is disabled');
    // A past-or-today day is open for ticking: move today to Saturday.
    a.run(`D.ayar.testTarih=isoDan(${bu + 5})`);
    giris = a.run('gorunumGiris()');
    assert.match(giris, /class="gGenelTekrar" data-ki="GT0" data-gun="\d+">izledim/);
    assert.deepEqual(a.json(`haftaAnlatimOzeti(0,${bu},${bu + 5})`), { toplam: 4, tamam: 0 });
    const gun0 = bu + a.json(`elleAl(0,${bu}).yer`)[idler[0]][0];
    a.run(`genelTekrarTamam(0,${bu},'${idler[0]}',${gun0})`);
    assert.deepEqual(a.json(`haftaAnlatimOzeti(0,${bu},${bu + 5})`), { toplam: 4, tamam: 1 });
    giris = a.run('gorunumGiris()');
    assert.match(giris, /class="gGenelTekrar" data-ki="GT0" data-gun="\d+" checked disabled>İzledim/);
    assert.match(a.run('gorunumOgrenciPlan()'), /✓ İzlendi/);
    // Future days cannot be ticked.
    assert.throws(() => a.run(`genelTekrarTamam(0,${bu},'${idler[3]}',${bu + 6})`), /bugün veya geçmiş/);
    assert.throws(() => a.run(`genelTekrarTamam(0,${bu},'GT99',${bu})`), /bugün veya geçmiş/);
  });

  // ---- Zaten yaptım: the topics part, with the genel tekrar phase already finished.
  async function konulu(a, bilir = false) {
    await okulsuz(a, { kur: false });
    a.run(`kendiPlanKur(0,${JSON.stringify(bilir ? hepsiBilir(a) : {})},'2027-04-23')`);
    genelTekrarBitir(a);
    a.run('ciz()');
    return a.run('buHafta(0)');
  }

  await check('zaten-yaptim-on-a-lesson-dates-it-on-the-last-day-of-the-previous-week', async a => {
    const bu = await konulu(a), G = bu - 1;
    assert.equal(a.run('oncedenGunu(0)'), G);
    const kagit = hafta(a, bu).flatMap((l, g) => l.map(x => ({ ...x, gun: bu + g }))).filter(x => x.anlatim);
    assert(kagit.length >= 3);
    const ki = kagit[1].ki, gelecek = sonraki(a, bu);
    const kuyrukOnce = a.run('kendiPlanKuyrugu(0).length');
    assert.equal(a.run(`anlatimTamamMi(planHesapla(0,${bu}),${ki},${kagit[1].gun})`), false);
    // Button on the frozen row (current week) and on a not-yet-issued future row.
    assert.match(a.run('gorunumOgrenciPlan()'), new RegExp('data-yaptim="anlatim" data-ki="' + ki + '" data-hb="' + bu + '"'));
    const gelecekKi = a.json(`kendiPlanHaftasi(0,${gelecek})[0].ki`);
    a.run(`EK.hafta=${gelecek}`);
    assert.match(a.run('gorunumOgrenciPlan()'), new RegExp('data-yaptim="anlatim" data-ki="' + gelecekKi + '" data-hb="' + gelecek + '"'));
    a.run('EK.hafta=null');
    // Pressing it on the current (frozen) row.
    assert.equal(a.run(`kendiPlanAnlatimOnceden(0,${ki})`), G);
    assert.equal(a.run(`D.ogrIslenis[0][${ki}]`), G, 'the lesson is dated the last day of the previous week');
    assert.equal(a.run(`elleAl(0,${bu}).onceden['${ki}']`), G);
    assert.equal(a.run(`anlatimTamamMi(planHesapla(0,${bu}),${ki},${kagit[1].gun})`), true, 'the frozen row counts as done though G is not its day');
    assert.equal(a.run(`anlatimTamamMi(planHesapla(0,${bu}),${kagit[0].ki},${kagit[0].gun})`), false);
    assert.equal(a.run('kendiPlanKuyrugu(0).length'), kuyrukOnce, 'it was already on the paper, not in the queue');
    assert.deepEqual(a.json(`haftaAnlatimOzeti(0,${bu},${bu + 6})`), { toplam: kagit.length, tamam: 1 });
    const h = a.run('gorunumOgrenciPlan()');
    assert.doesNotMatch(h, new RegExp('data-yaptim="anlatim" data-ki="' + ki + '"'), 'no button on a resolved row');
    assert.match(h, /✓ Önceden yapıldı/);
    // Sonuç gir shows it as watched.
    assert.match(a.run('EK.sekme="giris";gorunumGiris()'), new RegExp('class="gAnlatim" data-ki="' + ki + '" data-gun="\\d+" checked disabled>Anlatım tamamlandı'));
    // The first test is due G + the first-review interval; it reaches the next unissued week.
    const aralik = a.run(`ilkTekrarAraligi(0,${ki},${G})`);
    assert(aralik >= 1);
    assert(satirlar(a, gelecek).some(x => x.ki === ki && !x.anlatim), 'the first test arrives');
    assert.equal(a.run(`(()=>{const t=D.ogrIslenis[0][${ki}];return t+ilkTekrarAraligi(0,${ki},t);})()`), G + aralik);
    // Future unissued row: it leaves the queue and the week.
    assert.equal(a.run(`kendiPlanAnlatimOnceden(0,${gelecekKi})`), G);
    assert.equal(a.run(`kendiPlanKuyrugu(0).some(x=>x.ki===${gelecekKi})`), false);
    assert(!satirlar(a, gelecek).some(x => x.ki === gelecekKi && x.anlatim), 'the lesson row is gone from the unissued week');
    assert.equal(a.run(`D.ogrIslenis[0][${gelecekKi}]`), G);
    // A topic outside the personal plan is refused.
    assert.throws(() => a.run('kendiPlanAnlatimOnceden(0,0)'), /kendi planında değil/);
    // A weak check's lesson request is fulfilled too.
    a.run(`D.ogr[0].kendiPlan.anlatimGerek[${ki}]=${bu + 1}`);
    a.run(`kendiPlanAnlatimOnceden(0,${ki})`);
    assert.equal(a.run(`D.ogr[0].kendiPlan.anlatimGerek[${ki}]`), undefined);
  });

  await check('zaten-yaptim-on-a-test-records-the-result-at-g-recomputes-the-card-and-resolves-the-slot', async a => {
    const bu = await konulu(a, true), G = bu - 1;        // all-known student: the first week carries one-test checks
    const kagit = hafta(a, bu).flatMap((l, g) => l.map(x => ({ ...x, gun: bu + g })));
    assert(kagit.length >= 3 && kagit.every(x => !x.anlatim && !x.gt));
    const [t1, t2] = kagit;
    const bekleyen = a.json('[...varsayimIyiGunleri(0)]');
    assert(bekleyen.some(([k, g]) => k === t2.ki && g.includes(t2.gun)), 'control: an unmarked frozen test is assumed İyi on its day');
    assert.match(a.run('gorunumOgrenciPlan()'), new RegExp('data-yaptim="test" data-ki="' + t1.ki + '" data-hb="' + bu + '" data-slot="' + t1.slot + '"'));
    // Popup row: exactly one row, titled for the last day of the previous week.
    a.run(`EK.yaptim={ki:${t1.ki},hb:${bu},slot:'${t1.slot}'}`);
    const pencere = a.run('gorunumOgrenciPlan()');
    assert.match(pencere, /id="yaptimOrtu"/);
    assert.match(pencere, /geçen haftanın son günü sonucu<\/b>/);
    assert.equal((pencere.slice(pencere.indexOf('id="yaptimOrtu"')).match(/data-sonuc-row/g) || []).length, 1);
    assert.match(pencere, /data-sonuc-row data-ki="\d+" data-gun="\d+" data-sade="1"/);
    assert.doesNotMatch(pencere.slice(pencere.indexOf('id="yaptimOrtu"')), /data-sonuc-yapmadim|data-sonuc-anlatilmadi/);
    assert.equal(a.run('EK.sonucFormu'), undefined, 'the popup leaves the Sonuç gir form state alone');
    assert.doesNotMatch(a.run('EK.sekme="giris";gorunumGiris()'), /yaptimOrtu/);
    a.run('EK.sekme="plan"');
    // Saving: result at G through the normal validation and card path.
    assert.throws(() => a.run(`kendiPlanTestOnceden(0,${t1.ki},${bu},'${t1.slot}',{})`), /FSRS notu veya doğru\/soru/);
    assert.equal(a.json(`elleAl(0,${bu}).onceden||null`), null, 'a refused save leaves nothing behind');
    assert.throws(() => a.run(`kendiPlanTestOnceden(0,0,${bu},'0',{not:3})`), /kendi planında değil/);
    a.run(`kendiPlanTestOnceden(0,${t1.ki},${bu},'${t1.slot}',{not:3})`);
    assert.deepEqual(a.json(`D.log.filter(l=>l[2]===${t1.ki}).map(l=>[l[0],l[1],l[3],l[4],l[5]])`), [[G, 0, null, null, 3]]);
    const kart = a.json(`D.kart['0:${t1.ki}']`);
    assert.equal(kart.son, G); assert.equal(kart.not, 3);
    assert.equal(kart.vg, undefined, 'no assumed İyi at the scheduled day');
    assert.equal(a.run(`elleAl(0,${bu}).onceden['${t1.slot}']`), G);
    assert(!(a.json('[...varsayimIyiGunleri(0)]').find(([k]) => k === t1.ki) || [0, []])[1].includes(t1.gun));
    assert.equal(a.run(`oncedenMi(planHesapla(0,${bu}),'${t1.slot}')`), true);
    assert.doesNotMatch(a.run('gorunumOgrenciPlan()'), new RegExp('data-yaptim="test" data-ki="' + t1.ki + '" '));
    assert.match(a.run('EK.sekme="giris";gorunumGiris()'), /✓ Önceden yapıldı · sonuç geçen haftanın son gününe yazıldı/);
    assert.equal(a.run(`(${bu}-1)<=bugunNo()`), true);
    // A numeric result goes through the same validation.
    assert.throws(() => a.run(`kendiPlanTestOnceden(0,${t2.ki},${bu},'${t2.slot}',{dogru:13,soru:12})`), /Doğru sayısı/);
    a.run(`kendiPlanTestOnceden(0,${t2.ki},${bu},'${t2.slot}',{dogru:10,soru:12})`);
    assert.deepEqual(a.json(`D.log.filter(l=>l[2]===${t2.ki}).map(l=>[l[0],l[3],l[4]])`), [[G, 10, 12]]);
    // The weekly map counts the pre-done tests as done.
    assert(a.json(`haftaTestOzeti(0,${bu},${bu + 6},haftaYapilanTestler(0))`).yapilan >= 2);
  });

  await check('zaten-yaptim-on-a-weak-first-check-queues-the-lesson-like-a-normal-result', async a => {
    const bu = await konulu(a, true), G = bu - 1;
    const [t1, t2] = hafta(a, bu).flat();
    a.run(`kendiPlanTestOnceden(0,${t1.ki},${bu},'${t1.slot}',{not:1})`);
    assert.equal(a.run(`D.ogr[0].kendiPlan.anlatimGerek[${t1.ki}]`), G, 'Tekrar on a Biliyorum check asks for a lesson, dated G');
    assert.equal(a.json('kendiPlanKuyrugu(0)')[0].ki, t1.ki);
    assert.equal(a.json('kendiPlanKuyrugu(0)')[0].anlatim, true);
    assert(satirlar(a, sonraki(a, bu)).some(x => x.ki === t1.ki && x.anlatim), 'the lesson comes first next week');
    // A good result queues nothing.
    a.run(`kendiPlanTestOnceden(0,${t2.ki},${bu},'${t2.slot}',{not:3})`);
    assert.equal(a.run(`D.ogr[0].kendiPlan.anlatimGerek[${t2.ki}]`), undefined);
  });

  await check('zaten-yaptim-on-genel-tekrar-marks-it-done-and-pulls-the-topics-forward', async a => {
    await okulsuz(a);
    a.run('ciz()');
    const bu = a.run('buHafta(0)'), G = bu - 1, ov = a.json(`elleAl(0,${bu}).serbest`), idler = Object.keys(ov);
    const anahtar = ov[idler[1]].gt;
    const sonOnce = a.run('kendiPlanGenelTekrarPlani(0).son');
    assert.match(a.run('gorunumOgrenciPlan()'), new RegExp('data-yaptim="gt" data-ki="' + anahtar.replace('|', '\\|') + '" data-hb="' + bu));
    a.run(`kendiPlanGenelTekrarOnceden(0,'${anahtar}')`);
    assert.equal(a.run(`D.ogr[0].kendiPlan.genelTekrar.tamam['${anahtar}']`), G);
    assert.equal(a.run(`elleAl(0,${bu}).onceden['${idler[1]}']`), G, 'the issued row is marked done');
    assert.equal(a.run(`genelTekrarTamamMi(planHesapla(0,${bu}),{genelTekrar:true,ki:'${idler[1]}'},${bu + 3})`), true);
    assert.doesNotMatch(a.run('gorunumOgrenciPlan()'), new RegExp('data-yaptim="gt" data-ki="' + anahtar.replace('|', '\\|') + '"'));
    assert.match(a.run('gorunumOgrenciPlan()'), /✓ Önceden yapıldı/);
    assert(!a.json('kendiPlanGenelTekrarKuyrugu(0)').includes(anahtar));
    assert.deepEqual(a.json(`haftaAnlatimOzeti(0,${bu},${bu + 6})`), { toplam: 4, tamam: 1 });
    // Not-yet-issued weeks no longer carry it, and the last genel tekrar week can come earlier.
    for (let h = sonraki(a, bu), i = 0; i < 4; i++, h = sonraki(a, h)) assert(!satirlar(a, h).some(x => x.gt && x.ad === ov[idler[1]].ad));
    assert(a.run('kendiPlanGenelTekrarPlani(0).son') <= sonOnce);
    // Unknown key.
    assert.throws(() => a.run("kendiPlanGenelTekrarOnceden(0,'AYT|Yok')"), /kendi planında değil/);
    // Marking one that is on a not-yet-issued week needs no paper change.
    const kuyruk = a.json('kendiPlanGenelTekrarKuyrugu(0)');
    a.run(`kendiPlanGenelTekrarOnceden(0,'${kuyruk[0]}')`);
    assert.equal(a.run(`D.ogr[0].kendiPlan.genelTekrar.tamam['${kuyruk[0]}']`), G);
  });

  await check('zaten-yaptim-buttons-stay-inside-the-personal-plan-and-the-current-and-future-weeks', async a => {
    const bu = await konulu(a);
    const h = a.run('gorunumOgrenciPlan()');
    assert((h.match(/data-yaptim="anlatim"/g) || []).length >= 6, 'table and list both carry the buttons');
    assert.equal((h.match(/>Zaten yaptım</g) || []).length, (h.match(/data-yaptim=/g) || []).length);
    // Past week: no button (also called directly).
    assert.equal(a.run(`yaptimDugmesi(0,${bu - 7},{ki:1,anlatim:true,ad:'x'},0,planHesapla(0,${bu}))`), '');
    // Teacher / unrelated rows: free work, daily practice and school topics stay without a button.
    const p = `planHesapla(0,${bu})`;
    assert.equal(a.run(`yaptimDugmesi(0,${bu},{ki:'S1',serbest:true,ad:'x'},0,${p})`), '');
    assert.equal(a.run(`yaptimDugmesi(0,${bu},{ki:'GUNLUK_paragraf_1',serbest:true,gunlukEk:true,ad:'x'},0,${p})`), '');
    assert.equal(a.run(`yaptimDugmesi(0,${bu},{ki:0,ad:'okul konusu'},0,${p})`), '', 'a topic outside the personal plan');
    a.run("D.rol='rehber'");
    assert.equal(a.run(`yaptimDugmesi(0,${bu},{ki:${a.json('D.ogr[0].kendiPlan.sira')[0]},anlatim:true,ad:'x'},0,${p})`), '');
    a.run("D.rol='ogrenci'");
    // A student without a personal plan has nothing new.
    a.run('delete D.ogr[0].kendiPlan');
    assert.doesNotMatch(a.run('gorunumOgrenciPlan()'), /data-yaptim|Zaten yaptım/);
  });

  await check('plan-field-validation-and-snapshot-carry-the-genel-tekrar-state', async a => {
    await okulsuz(a);
    a.run('yedekDogrula(JSON.parse(JSON.stringify(D)))');
    a.run("(()=>{const y=JSON.parse(JSON.stringify(D));y.ogr[0].kendiPlan.genelTekrar={sira:['TYT|Fizik'],tamam:{'TYT|Fizik':20700}};yedekDogrula(y);})()");
    for (const kotu of ["'x'", '[]', 'null', '{sira:"TYT|Fizik",tamam:{}}', "{sira:[1],tamam:{}}", '{sira:[""],tamam:{}}', '{sira:[],tamam:null}', '{sira:[],tamam:[]}',
      "{sira:[],tamam:{'TYT|Fizik':'dün'}}", "{sira:[],tamam:{'TYT|Fizik':1.5}}", `{sira:[],tamam:{'${'x'.repeat(130)}':1}}`, '{tamam:{}}'])
      assert.throws(() => a.run(`(()=>{const y=JSON.parse(JSON.stringify(D));y.ogr[0].kendiPlan.genelTekrar=${kotu};yedekDogrula(y);})()`), /kendi TYT planı/, kotu);
    // The work snapshot (ogrenciCalismaPaketi) carries the field and the fields of the paper.
    a.run('ciz()');
    const bu = a.run('buHafta(0)'), id = Object.keys(a.json(`elleAl(0,${bu}).serbest`))[0];
    a.run(`kendiPlanGenelTekrarOnceden(0,'TYT|Fizik')`);
    const paket = a.json('JSON.parse(ogrenciCalismaPaketi().veri)');
    assert.equal(paket.ogr[0].kendiPlan.genelTekrar.tamam['TYT|Fizik'], bu - 1);
    assert.equal(paket.elle[`0|${bu}`].onceden[id], bu - 1);
    assert.equal(paket.elle[`0|${bu}`].serbest[id].gt, 'TYT|Fizik');
    // Slot translation keeps genel tekrar ids and moves topic ids.
    const cev = a.json(`paketPlanKonulariniCevir({onceden:{'5':20000,'GT3':20001},serbest:{GT3:{gt:'x'}}},k=>k+1)`);
    assert.deepEqual(Object.keys(cev.onceden).sort(), ['6', 'GT3']);
    assert.equal(cev.serbest.GT3.gt, 'x');
  });

  await check('without-a-personal-plan-nothing-changes', async a => {
    a.run("D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';D.ayar.planBasi='2026-08-31';D.ayar.donemBasi='2026-08-31';D.ayar.donemElle=true;");
    a.run(`D.ogr=[{no:1,ad:'Kendi',sube:'201',alan:'SAY',sinif:12,kap:6,off:[6],aktif:true,ilkAktif:gunNo('2026-08-31'),maddeler:[],rutin:{},dakika:{hi:200,hs:290,deneme:false},telafiGunKap:3}];EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};`);
    const bu = a.run('buHafta(0)');
    assert.deepEqual(a.json(`kendiPlanGenelTekrarHaftasi(0,${bu})`), []);
    assert.deepEqual(a.json(`kendiPlanGenelTekrarPlani(0).son`), null);
    assert.equal(a.run('ogrenciOtomasyonUygula()') !== undefined, true);
    assert.equal(a.run('D.ogr[0].kendiPlan'), undefined);
    assert(!a.json(`planHesapla(0,${bu}).gunler.flat().some(x=>x.genelTekrar)`));
  });

  console.log('genel tekrar regression: ' + checks.length + ' checks passed');
})().catch(e => { console.error(e); process.exit(1); });
