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
    assert.doesNotMatch(h, /✓ Önceden yapıldı/, 'the row itself leaves the week on the student’s screen');
    assert.match(h, new RegExp('id="oncedenNot"[\\s\\S]*konu anlatımı[\\s\\S]*data-onceden-geri data-slot="' + ki + '" data-gun="' + G + '">Geri al'), 'listed under the table with a way back');
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
    assert.match(a.run('gorunumOgrenciPlan()'), new RegExp('id="oncedenNot"[\\s\\S]*genel tekrar[\\s\\S]*data-onceden-geri data-slot="' + idler[1] + '" data-gun="' + G + '">Geri al'));
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

  // ---------------------------------------------------------------- the result slider inside the plan
  await check('plan-slider-shows-each-ratings-interval-saves-through-the-result-path-and-freezes-the-week', async a => {
    // 40 minutes a day: four one-test checks a day, so the week has tests today and on later days.
    await okulsuz(a, { kur: false, dakika: { hi: 40, hs: 40, deneme: false } });
    a.run(`kendiPlanKur(0,${JSON.stringify(hepsiBilir(a))},'2027-04-23')`); genelTekrarBitir(a); a.run('ciz()');
    const bu = a.run('buHafta(0)'), bugun = a.run('bugunNo()');
    a.run(`delete D.elle['0|${bu}']`);                                   // an unissued week: the first result must issue it
    const kagit = hafta(a, bu).flatMap((l, g) => l.map(x => ({ ...x, gun: bu + g })));
    const t = kagit.find(x => x.gun === bugun), ileri = kagit.find(x => x.gun > bugun);
    assert(t && ileri, 'a test today and one on a later day');
    const h = a.run('gorunumOgrenciPlan()');
    // One slider per test row; its four stops carry the interval each rating would give (the plan's own tekrarla()).
    const oniz = a.json(`sonucOnizleme(0,${t.ki},${t.gun})`);
    assert.deepEqual(oniz.map(o => o.not), [1, 2, 3, 4]);
    assert.deepEqual(oniz.map(o => o.ivl), a.json(`[1,2,3,4].map(n=>tekrarla(null,n,0,hedefTutma(0),D.ayar.maks,D.ayar.relearn,parametreAl(0,${t.ki})).ivl)`), 'a first measurement: no earlier card');
    assert(oniz[3].ivl >= oniz[2].ivl && oniz[2].ivl >= oniz[1].ivl, 'easier ratings never come back sooner');
    assert.match(h, new RegExp('class="plan-sonuc ps-bos" data-ps data-ki="' + t.ki + '" data-gun="' + t.gun + '" data-hb="' + bu + '" data-slot="' + t.slot + '" data-plan-disi="0" data-kayitli="0" data-oniz="' + oniz.map(o => o.ivl + ':' + o.gun).join(',') + '"'));
    assert.match(h, /Sonucunu seç<\/span><b class="ps-deger">İyi sayılır<\/b>/, 'unset: the plan assumes İyi and says so');
    assert.match(h, new RegExp('data-ps-not="4"[^>]*>Kolay<i>' + oniz[3].ivl + ' gün</i>'));
    // A later day of the week: the same preview, but nothing can be entered yet.
    assert.match(h, new RegExp('class="plan-sonuc ps-bos ps-gelecek" data-ps data-ki="' + ileri.ki + '"[\\s\\S]{0,400}Sonuç girilmezse[\\s\\S]{0,300}class="ps-surgu"[^>]* disabled>'));
    assert.equal(a.run(`!!elleAl(0,${bu}).sabit`), false);
    // Saving "Kolay" from the row.
    const kok = `{dataset:{ki:'${t.ki}',gun:'${t.gun}',hb:'${bu}',slot:'${t.slot}',planDisi:'0',kayitli:'0',oniz:''},querySelector:()=>null,querySelectorAll:()=>[]}`;
    await a.run(`planSonucKaydet(${kok},4)`); await a.run('KAYIT_ZINCIRI');
    assert.deepEqual(a.json(`D.log.filter(l=>l[2]===${t.ki}).map(l=>[l[0],l[1],l[3],l[4],l[5]])`), [[t.gun, 0, null, null, 4]]);
    assert.equal(a.run(`!!elleAl(0,${bu}).sabit`), true, 'entering a result issues the shown week first (as Sonuç gir does)');
    assert.equal(a.run(`D.kart['0:${t.ki}'].due`), oniz[3].gun, 'the card is due exactly where the slider said');
    assert(a.events.some(e => /^bilgi:Kolay kaydedildi · sonraki tekrar ≈ /.test(e)), a.events.join(' | '));
    const h2 = a.run('gorunumOgrenciPlan()');
    assert.match(h2, new RegExp('class="plan-sonuc" data-ps data-ki="' + t.ki + '"[^>]*data-kayitli="4"'));
    assert.match(h2, new RegExp('data-ps data-ki="' + t.ki + '"[\\s\\S]{0,900}data-ps-not="4" aria-pressed="true"'));
    // Changing it replaces the same day's result; an out-of-range rating or a future day is refused.
    await a.run(`planSonucKaydet(${kok},2)`); await a.run('KAYIT_ZINCIRI');
    assert.deepEqual(a.json(`D.log.filter(l=>l[2]===${t.ki}).map(l=>l[5])`), [2]);
    await a.run(`planSonucKaydet(${kok},7)`);
    assert.deepEqual(a.json(`D.log.filter(l=>l[2]===${t.ki}).map(l=>l[5])`), [2]);
    const once = a.run('D.log.length');
    await a.run(`planSonucKaydet({dataset:{ki:'${ileri.ki}',gun:'${ileri.gun}',hb:'${bu}',slot:'${ileri.slot}',planDisi:'0',kayitli:'0',oniz:''}},3)`);
    assert.equal(a.run('D.log.length'), once, 'a day that has not come takes no result');
    assert(a.events.some(e => /^alert:Sonuç tarihi bugün veya daha eski/.test(e)));
    // The teacher's table keeps its own status line; nobody but the student gets a slider.
    a.run("D.rol='rehber'"); assert.doesNotMatch(a.run(`planTablosu(0,${bu},planHesapla(0,${bu}))`), /data-ps/); a.run("D.rol='ogrenci'");
  });

  await check('zaten-yaptim-moves-the-test-to-last-weeks-last-day-where-it-can-be-changed-or-taken-back', async a => {
    const bu = await konulu(a, true), G = bu - 1, onceki = a.run(`oncekiHafta(0,${bu})`);
    const kagit = hafta(a, bu).flatMap((l, g) => l.map(x => ({ ...x, gun: bu + g }))), [t1, t2] = kagit;
    a.run(`kendiPlanTestOnceden(0,${t1.ki},${bu},'${t1.slot}',{not:3})`);
    // This week: the row is gone from the student's table and listed under it with Geri al.
    let h = a.run('gorunumOgrenciPlan()');
    assert.doesNotMatch(h, new RegExp('data-ps data-ki="' + t1.ki + '" data-gun="' + t1.gun + '"'));
    assert.match(h, new RegExp('id="oncedenNot"[\\s\\S]*data-onceden-geri data-slot="' + t1.slot + '" data-gun="' + G + '" data-ki="' + t1.ki + '">Geri al'));
    assert.match(h, new RegExp('data-hafta-git="' + onceki + '">Geçen haftayı aç'));
    assert.equal(a.json(`ogrenciPlanGunleri(0,${bu},planHesapla(0,${bu}),true)`).flat().some(x => x.ki === t1.ki), false);
    assert.equal(a.json(`ogrenciPlanGunleri(0,${bu},planHesapla(0,${bu}),false)`).flat().some(x => x.ki === t1.ki), true, 'the teacher still sees the paper as issued');
    // Last week: the result is a row on its last day, with the slider on İyi and Geri al.
    a.run(`EK.hafta=${onceki}`); h = a.run('gorunumOgrenciPlan()');
    assert.doesNotMatch(h, /kaydedilmiş planı bulunamadı/, 'a week with only this result still draws its table');
    assert.match(h, new RegExp('class="plan-sonuc" data-ps data-ki="' + t1.ki + '" data-gun="' + G + '" data-hb="' + onceki + '"[^>]*data-plan-disi="1" data-kayitli="3"'));
    assert.match(h, /PLAN DIŞI SONUÇ/);
    assert.match(h, new RegExp('data-ps-geri data-ki="' + t1.ki + '" data-gun="' + G + '"'));
    // Adjusting it there replaces the result at G.
    await a.run(`planSonucKaydet({dataset:{ki:'${t1.ki}',gun:'${G}',hb:'${onceki}',slot:'${t1.ki}',planDisi:'1',kayitli:'3',oniz:''}},2)`); await a.run('KAYIT_ZINCIRI');
    assert.deepEqual(a.json(`D.log.filter(l=>l[2]===${t1.ki}).map(l=>[l[0],l[5]])`), [[G, 2]]);
    assert.equal(a.run(`elleAl(0,${bu}).onceden['${t1.slot}']`), G, 'still marked: it stays out of this week');
    // Geri al: the result and the mark go, the test is back in this week and assumed İyi again on its day.
    assert.equal(a.run(`oncedenGeriAl(0,${t1.ki},${G})`), 'silindi');
    assert.equal(a.run(`D.log.filter(l=>l[2]===${t1.ki}).length`), 0);
    assert.equal(a.json(`elleAl(0,${bu}).onceden||null`), null);
    assert((a.json('[...varsayimIyiGunleri(0)]').find(([k]) => k === t1.ki) || [0, []])[1].includes(t1.gun));
    a.run('EK.hafta=null'); h = a.run('gorunumOgrenciPlan()');
    assert.match(h, new RegExp('data-yaptim="test" data-ki="' + t1.ki + '" data-hb="' + bu + '" data-slot="' + t1.slot + '"'));
    assert.doesNotMatch(h, /id="oncedenNot"/);
    assert.throws(() => a.run(`oncedenGeriAl(0,${t1.ki},${G})`), /Geri alınacak bir kayıt bulunamadı/);
    // A notebook linked to a teacher: the result has been sent and syncing would bring it back, so it stays; only the mark goes.
    a.run(`kendiPlanTestOnceden(0,${t2.ki},${bu},'${t2.slot}',{not:4})`); a.run("D.ogr[0].syncId='sync-1'");
    a.run(`EK.hafta=${onceki}`); assert.doesNotMatch(a.run('gorunumOgrenciPlan()'), /data-ps-geri/, 'no delete button on a result that cannot be deleted'); a.run('EK.hafta=null');
    assert.equal(a.run(`oncedenGeriAl(0,${t2.ki},${G},'${t2.slot}')`), 'sonucKaldi');
    assert.deepEqual(a.json(`D.log.filter(l=>l[2]===${t2.ki}).map(l=>[l[0],l[5]])`), [[G, 4]]);
    assert.equal(a.json(`elleAl(0,${bu}).onceden||null`), null);
    assert.match(a.run('gorunumOgrenciPlan()'), new RegExp('data-ps data-ki="' + t2.ki + '" data-gun="' + t2.gun + '"'), 'the test is back on its day');
    // Teachers and other students cannot use it.
    a.run("D.rol='rehber'"); assert.throws(() => a.run(`oncedenGeriAl(0,${t2.ki},${G})`), /kendi planındaki/); a.run("D.rol='ogrenci'");
  });

  await check('geri-al-brings-a-lesson-and-a-genel-tekrar-back', async a => {
    const bu = await konulu(a), G = bu - 1;
    const ki = hafta(a, bu).flat().find(x => x.anlatim).ki;
    a.run(`kendiPlanAnlatimOnceden(0,${ki})`);
    assert.equal(a.run(`D.ogrIslenis[0][${ki}]`), G);
    assert.equal(a.run(`oncedenGeriAl(0,null,${G},'${ki}')`), 'geri');
    assert.equal(a.run(`D.ogrIslenis[0][${ki}]`), undefined, 'the lesson is no longer dated');
    assert.equal(a.json(`elleAl(0,${bu}).onceden||null`), null);
    assert.match(a.run('gorunumOgrenciPlan()'), new RegExp('data-yaptim="anlatim" data-ki="' + ki + '"'), 'the row and its button are back');
  });
  await check('geri-al-brings-a-genel-tekrar-back', async a => {
    await okulsuz(a); a.run('ciz()');
    const bu = a.run('buHafta(0)'), G = bu - 1, ov = a.json(`elleAl(0,${bu}).serbest`), idler = Object.keys(ov), anahtar = ov[idler[1]].gt;
    a.run(`kendiPlanGenelTekrarOnceden(0,'${anahtar}')`);
    assert.equal(a.run(`oncedenGeriAl(0,null,${G},'${idler[1]}')`), 'geri');
    assert.equal(a.run(`D.ogr[0].kendiPlan.genelTekrar.tamam['${anahtar}']`), undefined);
    assert.equal(a.json(`elleAl(0,${bu}).onceden||null`), null);
    assert.match(a.run('gorunumOgrenciPlan()'), new RegExp('data-yaptim="gt" data-ki="' + anahtar.replace('|', '\\|') + '"'));
  });

  // ---------------------------------------------------------------- Planı kendine göre ayarla
  await check('study-time-adjustment-lowers-the-recall-target-until-reviews-fit-never-below-80-and-only-when-ticked', async a => {
    const bu = await konulu(a, true), bugun = a.run('bugunNo()');
    a.run("D.ogr[0].dakika={hi:60,hs:60,deneme:false}");
    assert.equal(a.run('hedefTutma(0)'), a.run('D.ayar.hedef'));
    // 60 topics answered İyi three days ago: far more weekly review minutes than 60% of 6 × 60.
    a.run(`(()=>{let n=0;for(let ki=0;ki<konuSayisi()&&n<60;ki++){if(!konuAl(ki))continue;D.log.push([${bugun}-3,0,ki,null,null,3,1000+n]);n++}const v=varsayimIyiGunleri(0);new Set(D.log.map(l=>l[2])).forEach(ki=>kartiYenidenHesapla(0,ki,v))})()`);
    const h = a.json('sureHedefiHesapla(0)');
    assert.equal(h.sure, 360); assert.equal(h.pay, 216); assert(h.yuk > h.pay, 'control: the load does not fit at the base target');
    assert.equal(h.hedef, 0.8, 'stops at the floor'); assert(h.yukSonra < h.yuk);
    const due = a.json("Object.values(D.kart).map(k=>k.due-k.son)");
    assert.equal(a.run('sureyeGoreAyarla(0,true)'), true);
    assert.equal(a.run('D.ogr[0].sureyeGore'), true); assert.equal(a.run('D.ogr[0].sureHedef'), 0.8); assert.equal(a.run('hedefTutma(0)'), 0.8);
    const due2 = a.json("Object.values(D.kart).map(k=>k.due-k.son)");
    assert(due2.every((d, i) => d >= due[i]) && due2.some((d, i) => d > due[i]), 'every review comes later, none sooner');
    assert.doesNotThrow(() => a.run('yedekDogrula(JSON.parse(JSON.stringify(D)))'));
    // The slider preview uses the same target.
    const ki = a.run('D.log[D.log.length-1][2]');
    assert.equal(a.json(`sonucOnizleme(0,${ki},${bugun})`)[2].ivl, a.run(`(()=>{const k=kartHesapla(0,${ki},[],D.log.filter(l=>l[2]===${ki}&&l[0]<${bugun}));return tekrarla(k,3,${bugun}-k.son,0.8,D.ayar.maks,D.ayar.relearn,parametreAl(0,${ki})).ivl})()`));
    // More time: the target climbs back by itself at the next save (in steps of at least 2 points).
    a.run("D.ogr[0].dakika={hi:600,hs:600,deneme:false}"); assert.equal(a.run('sureHedefiGuncelle(0)'), true);
    assert(a.run('hedefTutma(0)') > 0.8);
    // It never exceeds the teacher's / general target, and unticking restores it.
    a.run('D.ogr[0].sureHedef=0.99'); assert.equal(a.run('hedefTutma(0)'), a.run('D.ayar.hedef'));
    assert.equal(a.run('sureyeGoreAyarla(0,false)'), true); assert.equal(a.run('D.ogr[0].sureyeGore'), false); assert.equal(a.run('hedefTutma(0)'), a.run('D.ayar.hedef'));
    assert.deepEqual(a.json("Object.values(D.kart).map(k=>k.due-k.son)"), due, 'the cards are as before');
    // Invalid values are refused with the notebook; the settings card shows both boxes and the numbers behind them.
    a.run('D.ogr[0].sureHedef=0.2'); assert.throws(() => a.run('yedekDogrula(JSON.parse(JSON.stringify(D)))'), /süreye göre hedef/); a.run('delete D.ogr[0].sureHedef');
    a.run('D.ogr[0].sureyeGore=1'); assert.throws(() => a.run('yedekDogrula(JSON.parse(JSON.stringify(D)))'), /süreye göre ayar/); a.run('D.ogr[0].sureyeGore=false');
    const kart = a.run('planiAyarlaKarti(0)');
    assert.match(kart, /id="ogrUzunSure">/); assert.match(kart, /id="ogrSureyeGore">/); assert.match(kart, /Haftalık tekrar yükün ≈ \d+ dk · tekrarlara ayrılan süre 2160 dk \(haftalık 3600 dk/);
    a.run("hafizaSeviyesiniUygula(0,'guclu')"); assert.match(a.run('planiAyarlaKarti(0)'), /id="ogrUzunSure" checked>[\s\S]*id="ogrHafizaSec" class="oHafiza"/);
    a.run("D.rol='rehber'"); assert.equal(a.run('sureyeGoreAyarla(0,true)'), false, 'the student decides this, not the teacher'); a.run("D.rol='ogrenci'");
  });

  await check('gelecek-haftalar-lists-every-coming-week-with-unanswered-tests-counted-as-iyi-and-writes-nothing', async a => {
    const bu = await konulu(a, true), once = a.run('JSON.stringify(D)');
    const dort = a.json('gelecekHaftalar(0,4)');
    assert.equal(dort.length, 4); assert.equal(dort[0].hb, sonraki(a, bu)); assert(dort.every((h, i) => !i || h.hb === sonraki(a, dort[i - 1].hb)));
    assert.equal(a.run('JSON.stringify(D)'), once, 'computed on a copy');
    // The same weeks as the single-week preview the map opens.
    for (const h of dort.slice(0, 2)) assert.deepEqual(h.gunler.map(l => l.map(x => x.ad)), a.json(`varsayimliPlan(0,${h.hb}).gunler.map(l=>l.map(x=>x.ad))`));
    assert(dort.some(h => h.gunler.flat().some(x => x.etiket === '2. tekrar')), 'a first test counted as İyi returns as a second repetition');
    assert(a.json('gelecekHaftalar(0,60)').length > 20, 'up to the exam');
    // The card: folded until asked for, then one row per week.
    let h = a.run('gorunumOgrenciPlan()');
    assert.match(h, /id="gelecekHaftalar"/); assert.doesNotMatch(h, /class="gh-hafta"/);
    a.run('EK.gelecekAdet=4'); h = a.run('gorunumOgrenciPlan()');
    assert.equal((h.match(/class="gh-hafta"/g) || []).length, 4); assert.match(h, new RegExp('data-hafta-git="' + dort[0].hb + '">Bu haftayı aç'));
    a.run(`EK.hafta=${dort[0].hb}`); assert.doesNotMatch(a.run('gorunumOgrenciPlan()'), /id="gelecekHaftalar"/, 'only under the current week');
  });

  await check('home-leads-with-todays-tests-with-the-same-slider-the-weeks-progress-and-the-streak', async a => {
    await okulsuz(a, { kur: false, dakika: { hi: 40, hs: 40, deneme: false } });
    a.run(`kendiPlanKur(0,${JSON.stringify(hepsiBilir(a))},'2027-04-23')`); genelTekrarBitir(a); a.run('ciz()');
    const bu = a.run('buHafta(0)'), bugun = a.run('bugunNo()');
    const kagit = hafta(a, bu).flatMap((l, g) => l.map(x => ({ ...x, gun: bu + g })));
    const bugunku = kagit.filter(x => x.gun === bugun), toplam = a.json(`haftaTestOzeti(0,${bu},planHaftaSonu(0,${bu}))`).toplam;
    assert(bugunku.length >= 2 && toplam > bugunku.length, 'tests today and on later days');
    let h = a.run('ogrenciBugunKarti(0)');
    assert.match(h, /^<section class="kart bugun-kart" id="bugunKart" aria-label="Bugünün işleri">/);
    assert.match(h, new RegExp('<h2 class="bg-baslik"><b>' + bugunku.length + '</b> <span>test seni bekliyor</span></h2>'));
    assert.equal((h.match(/class="bg-oge"/g) || []).length, bugunku.length, 'one row per test of today, none of another day');
    // The row carries the plan page's own slider, so a result entered here goes down the same path.
    for (const t of bugunku) assert.match(h, new RegExp('class="plan-sonuc ps-bos" data-ps data-ki="' + t.ki + '" data-gun="' + bugun + '" data-hb="' + bu + '"'));
    assert.match(h, new RegExp('<div class="bg-sayi"><strong>0<small>/' + toplam + '</small></strong><span>bu haftanın testi</span>'));
    assert.doesNotMatch(h, /hafta üst üste|sonuç · /, 'nothing done yet: no streak, no total');
    assert.match(h, /<button class="dugme" data-sekme="plan">Haftalık planım →<\/button>/);
    // The home page starts with it; the weeks map follows.
    const ana = a.run("EK.sekme='ana';gorunumAnaSayfa()");
    assert(ana.startsWith('<section class="kart bugun-kart"') && ana.indexOf('id="bugunKart"') < ana.indexOf('yks-yolu'), 'today first');
    // One result: the count falls, the row is marked, the week moves.
    const t = bugunku[0], kok = `{dataset:{ki:'${t.ki}',gun:'${bugun}',hb:'${bu}',slot:'${t.slot}',planDisi:'0',kayitli:'0',oniz:''},querySelector:()=>null,querySelectorAll:()=>[]}`;
    await a.run(`planSonucKaydet(${kok},3)`); await a.run('KAYIT_ZINCIRI');
    h = a.run('ogrenciBugunKarti(0)');
    assert.match(h, new RegExp('<h2 class="bg-baslik"><b>' + (bugunku.length - 1) + '</b> <span>test seni bekliyor</span></h2>'));
    assert.equal((h.match(/class="bg-oge bg-bitti"/g) || []).length, 1);
    assert.match(h, new RegExp('<strong>1<small>/' + toplam + '</small></strong><span>bu haftanın testi</span><i class="bg-cubuk" aria-hidden="true"><i style="width:' + Math.round(100 / toplam) + '%">'));
    assert.match(h, /<div class="bg-sayi"><strong>1<\/strong><span>sonuç · 1 haftada<\/span><\/div>/);
    assert.deepEqual(a.json('ogrenciSerisi(0)'), { seri: 1, hafta: 1, test: 1 });
    // All of today's tests: the heading says so.
    for (const x of bugunku.slice(1)) { await a.run(`planSonucKaydet({dataset:{ki:'${x.ki}',gun:'${bugun}',hb:'${bu}',slot:'${x.slot}',planDisi:'0',kayitli:'0',oniz:''},querySelector:()=>null,querySelectorAll:()=>[]},3)`); await a.run('KAYIT_ZINCIRI'); }
    h = a.run('ogrenciBugunKarti(0)');
    assert.match(h, /<h2 class="bg-baslik"><span>Bugünün testleri tamam<\/span> <b aria-hidden="true">✓<\/b><\/h2>/);
    assert.doesNotMatch(h, /Sürgüyü oynat/);
    // The streak: weeks with a result, back from last week without a gap; this week counts once it has one.
    const once = a.run(`oncekiHafta(0,${bu})`), iki = a.run(`oncekiHafta(0,oncekiHafta(0,${bu}))`), dort = a.run(`oncekiHafta(0,oncekiHafta(0,oncekiHafta(0,oncekiHafta(0,${bu}))))`);
    a.run(`D.log.push([${once}+1,0,${t.ki},null,null,3,1],[${iki}+2,0,${t.ki},null,null,3,1],[${dort},0,${t.ki},null,null,3,1])`);
    assert.deepEqual(a.json('ogrenciSerisi(0)'), { seri: 3, hafta: 4, test: bugunku.length + 3 }, 'the week four back is cut off by the empty week before it');
    assert.match(a.run('ogrenciBugunKarti(0)'), /<div class="bg-sayi"><strong>3<\/strong><span>hafta üst üste<\/span><\/div>/);
    a.run(`D.log=D.log.filter(l=>l[0]<${bu})`);
    assert.equal(a.json('ogrenciSerisi(0)').seri, 2, 'no result yet this week: last week still holds the streak');
    // Not for the teacher; not on or after the exam day.
    a.run("D.rol='rehber'"); assert.equal(a.run('ogrenciBugunKarti(0)'), ''); a.run("D.rol='ogrenci'");
    a.run(`D.ayar.sinav=isoDan(${bugun})`); assert.equal(a.run("ogrenciBugunKarti(0)"), "");
  });

  await check('hafizam-shows-each-topics-recall-now-against-the-target-line-and-takes-a-spontaneous-study', async a => {
    await okulsuz(a, { kur: false, dakika: { hi: 40, hs: 40, deneme: false } });
    a.run(`kendiPlanKur(0,${JSON.stringify(hepsiBilir(a))},'2027-04-23')`); genelTekrarBitir(a); a.run('ciz()');
    const bu = a.run('buHafta(0)'), bugun = a.run('bugunNo()');
    const kagit = hafta(a, bu).flatMap((l, g) => l.map(x => ({ ...x, gun: bu + g }))).filter(x => !x.gt && !x.anlatim);
    const disarida = a.json(`D.ogr[0].kendiPlan.sira.filter(k=>!${JSON.stringify(kagit.map(x => x.ki))}.includes(k)).slice(0,3)`);
    assert.equal(disarida.length, 3, 'three topics that are not on this week’s paper');
    // Nothing answered yet: nothing to show, no card on the home page.
    assert.deepEqual(a.json('hafizaDurumu(0)'), { hedef: 0.9, liste: [], altinda: 0, eski: 0 }); assert.equal(a.run('hafizaAnaKarti(0)'), '');
    // İyi thirty days ago, İyi yesterday. FSRS-6: R(t) = (1 + FACTOR·t/S)^DECAY with FACTOR = 0,9^(1/DECAY) − 1, so R(S) = 0,9.
    const [ki30, ki1, kiYeni] = disarida;
    a.run(`sonucIsle(0,[{ki:${ki30},gun:${bugun - 30},not:3,dogru:null,soru:null},{ki:${ki1},gun:${bugun - 1},not:3,dogru:null,soru:null}])`);
    const [DECAY, FACTOR] = a.json('[DECAY,FACTOR]'), S = a.run(`tekrarla(null,3,0,hedefTutma(0),D.ayar.maks,D.ayar.relearn,parametreAl(0,${ki30})).s`);
    assert(Math.abs(FACTOR - (Math.pow(0.9, 1 / DECAY) - 1)) < 1e-12); const R = t => Math.pow(1 + FACTOR * t / S, DECAY);
    assert(Math.abs(R(S) - 0.9) < 1e-12, 'the line is where the interval of the first review ends');
    let d = a.json('hafizaDurumu(0)');
    assert.deepEqual(d.liste.map(x => [x.ki, x.gecen, x.son, x.sayildi, x.altinda]), [[ki30, 30, bugun - 30, false, true], [ki1, 1, bugun - 1, false, false]], 'the most forgotten first');
    assert(Math.abs(d.liste[0].r - R(30)) < 1e-9 && Math.abs(d.liste[1].r - R(1)) < 1e-9); assert.equal(d.altinda, 1);
    assert(Math.abs(d.liste[0].cizgiGun - (bugun - 30 + S)) < 1e-9, 'it met the line S days after the review');
    if (Math.abs(S - 2.3065) < 1e-9) assert.equal(Math.round(d.liste[0].r * 100), 67, 'default parameters: (1 + 0,98037·30/2,3065)^−0,1542 = 0,6675');
    // The home card: the topics under the line, the bar with the line marked, days in words.
    let h = a.run('hafizaAnaKarti(0)');
    assert.match(h, /^<section class="kart hafiza-kart" id="hafizaKart" aria-label="Hafızan">/); assert.match(h, /Hafızan · hedef çizgisi %90/);
    assert.match(h, /<h2 class="bg-baslik"><b>1<\/b> <span>konu çizginin altına indi<\/span><\/h2>/);
    const y30 = Math.round(R(30) * 100);
    // Thirty days without an entered result: also red (HAFIZA_UZUN = 21), with the days in words; the card can be dragged to the basket.
    assert.match(h, new RegExp('<div class="hf-oge hf-alt hf-eski" data-hf-ki="' + ki30 + '" draggable="true" data-hf-surukle="konu:' + ki30 + '">[\\s\\S]*?<button type="button" class="dugme mini" data-hf-ac="' + ki30 + '" aria-expanded="false">Çalıştım</button>'));
    assert.match(h, /<div class="hf-eski-not">30 gündür sonuç girmedin<\/div>/);
    assert.match(h, new RegExp('role="img" aria-label="Tahmini hatırlama %' + y30 + ', hedef çizgisi %90"><i style="width:' + y30 + '%"></i><b style="left:90%"></b></div>'));
    assert.match(h, new RegExp('<strong>%' + y30 + '</strong><span>son çalışma 30 gün önce · çizginin altına ' + Math.floor(30 - S) + ' gün önce indi</span>'));
    assert(!h.includes('data-hf-ki="' + ki1 + '"'), 'a topic above the line is not on the home card'); assert.doesNotMatch(h, /data-ps/, 'no slider until a row is opened');
    assert.match(h, /<button class="dugme" data-sekme="hafiza">Hafızam: bütün konular \(2\) →<\/button>/);
    assert.match(a.run("EK.sekme='ana';gorunumAnaSayfa()"), /id="bugunKart"[\s\S]*id="hafizaKart"[\s\S]*yks-yolu/, 'between today and the weeks map');
    // "Çalıştım" opens the plan's own slider for today, as a result outside the plan.
    a.run(`EK.hafizaAcik=${ki30}`); h = a.run('hafizaAnaKarti(0)');
    assert.match(h, new RegExp('data-hf-ac="' + ki30 + '" aria-expanded="true">Kapat</button>'));
    assert.match(h, new RegExp('class="plan-sonuc ps-bos" data-ps data-ki="' + ki30 + '" data-gun="' + bugun + '" data-hb="' + bu + '" data-slot="[^"]*" data-plan-disi="1"'));
    assert.match(h, /<span>Bugün çalıştıysan<\/span><b class="ps-deger">sonucunu seç<\/b>/);
    const once = a.json(`haftaTestOzeti(0,${bu},planHaftaSonu(0,${bu}))`);
    assert.deepEqual([once.yapilan, once.kendi, once.kendiToplam], [1, 1, 1], 'yesterday’s own study is in this week and already counts as one of its tests');
    const kok = ki => `{dataset:{ki:'${ki}',gun:'${bugun}',hb:'${bu}',slot:'',planDisi:'1',kayitli:'0',oniz:''},querySelector:()=>null,querySelectorAll:()=>[]}`;
    await a.run(`planSonucKaydet(${kok(ki30)},4)`); await a.run('KAYIT_ZINCIRI');
    assert.deepEqual(a.json(`D.log.filter(l=>l[2]===${ki30}).map(l=>[l[0],l[5]])`), [[bugun - 30, 3], [bugun, 4]]);
    d = a.json('hafizaDurumu(0)'); const x = d.liste.find(r => r.ki === ki30);
    assert.deepEqual([x.r, x.gecen, x.altinda, d.altinda], [1, 0, false, 0], 'studied today: back at 100%');
    assert.match(a.run('hafizaAnaKarti(0)'), /<span>Bütün konuların çizginin üstünde<\/span>/);
    assert.match(a.run('hafizaAnaKarti(0)'), new RegExp('data-hf-ki="' + ki30 + '"[\\s\\S]*data-kayitli="4"'), 'the open row stays so the result can be corrected');
    // The page: both groups, the tiles, the switch and the picker for a topic that has no result yet.
    a.run("EK.sekme='hafiza';EK.hafizaAcik=undefined"); h = a.run('gorunumHafiza()');
    assert.match(h, /<h1>Hafızam<\/h1>/); assert.match(h, /Çizginin üstündekiler <span class="mini">2 konu/); assert.doesNotMatch(h, /Çizginin altındakiler/);
    assert.match(h, /<span class="dp-kpi-ad">Çizginin altında<\/span><strong>0<small> konu<\/small><\/strong>/); assert.match(h, /<span class="dp-kpi-ad">Hedef çizgisi<\/span><strong>%90<\/strong>/);
    assert.match(h, /<input type="checkbox" id="ogrSerbest"><span><b>Kendi programımı kendim yaparım<\/b>/);
    assert.match(h, new RegExp('<select id="hfKonu"><option value="">Konu seç…</option>[\\s\\S]*<option value="' + kiYeni + '">'));
    assert(!new RegExp('<option value="' + ki30 + '"').test(h), 'a measured topic is not in the picker');
    a.run(`hafizaKonuSecildi('${kiYeni}')`); h = a.run('gorunumHafiza()');
    assert.match(h, new RegExp('<option value="' + kiYeni + '" selected>')); assert.match(h, new RegExp('class="hf-oge hf-acik hf-yeni" data-hf-ki="' + kiYeni + '"[\\s\\S]*henüz sonucu yok · ilk ölçüm olur[\\s\\S]*data-ps data-ki="' + kiYeni + '"[^>]*data-plan-disi="1"'));
    await a.run(`planSonucKaydet(${kok(kiYeni)},2)`); await a.run('KAYIT_ZINCIRI');
    assert.deepEqual(a.json('hafizaDurumu(0)').liste.map(r => r.ki).sort((p, q) => p - q), [ki30, ki1, kiYeni].sort((p, q) => p - q));
    a.run(`hafizaSatirAc(${ki1})`); assert.equal(a.run('EK.hafizaAcik'), ki1); a.run(`hafizaSatirAc(${ki1})`); assert.equal(a.run('EK.hafizaAcik'), undefined, 'the same button closes it');
    // The menu and the tab; teachers have neither the page nor the card.
    assert.deepEqual(a.json("[SEKME_OGRENCI.find(s=>s[0]==='hafiza'),MENU_OGRENCI[0][1]]"), [['hafiza', 'Hafızam'], ['hafiza', 'harita', 'giris']]);
    a.run("D.rol='rehber'"); assert.equal(a.run('hafizaAnaKarti(0)'), ''); assert.equal(a.run('gorunumHafiza()'), '<div class="baslik"><h1>Hafızam</h1></div>'); a.run("D.rol='ogrenci'");
  });
  await check('hafizam-lists-every-taught-topic-marks-long-silence-red-and-takes-the-students-own-speed-state-and-basket', async a => {
    await okulsuz(a, { kur: false, dakika: { hi: 40, hs: 40, deneme: false } });
    a.run(`kendiPlanKur(0,${JSON.stringify(hepsiBilir(a))},'2027-04-23')`); genelTekrarBitir(a); a.run('ciz()');
    const bu = a.run('buHafta(0)'), bugun = a.run('bugunNo()');
    const kagit = hafta(a, bu).flatMap(l => l.map(x => x.ki));
    const [kiA, kiB, kiC] = a.json(`D.ogr[0].kendiPlan.sira.filter(k=>!${JSON.stringify(kagit)}.includes(k)).slice(0,3)`);
    // Taught in class (the curriculum and the timetable put the topic on a lesson day): 10 and 25 days ago, never measured.
    a.run(`D.ogrIslenis=D.ogrIslenis||{};D.ogrIslenis[0]=Object.assign(D.ogrIslenis[0]||{},{${kiA}:${bugun - 10},${kiB}:${bugun - 25}})`);
    a.run(`sonucIsle(0,[{ki:${kiC},gun:${bugun - 5},not:3,dogru:null,soru:null}])`);
    const [DECAY, FACTOR] = a.json('[DECAY,FACTOR]'), S0 = a.run(`ilkS(3,parametreAl(0,${kiA}))`), R = (t, S) => Math.pow(1 + FACTOR * t / S, DECAY);
    let d = a.json('hafizaDurumu(0)');
    const x = ki => d.liste.find(r => r.ki === ki);
    assert.deepEqual([kiA, kiB, kiC].map(ki => [x(ki).olculmedi, x(ki).gecen, x(ki).sonucsuz, x(ki).eski]), [[true, 10, 10, false], [true, 25, 25, true], [false, 5, 5, false]],
      'taught topics are listed without a result; 21 days or more without one is red');
    assert(Math.abs(x(kiA).r - R(10, S0)) < 1e-9, 'a taught, unmeasured topic starts on the lesson day with the first İyi’s stability'); assert.equal(d.eski, 1);
    let h = a.run("EK.sekme='hafiza';gorunumHafiza()");
    assert.match(h, new RegExp('<div class="hf-oge hf-alt hf-eski" data-hf-ki="' + kiB + '"[^>]*>[\\s\\S]*?derste işlendi 25 gün önce · henüz sonucun yok[\\s\\S]*?<div class="hf-eski-not">25 gündür hiç sonucun yok</div>'));
    assert.match(h, /<div class="et-ozet-kart hf-eski-kart"><span class="dp-kpi-ad">Uzun süredir sonuçsuz<\/span><strong>1<small> konu<\/small>/);
    // The lesson's own speed: "Çok geç unuturum" (k = 2) stretches time: R(t / 2), and the line comes twice as late.
    const ders = a.run(`dersAnahtari(${kiC})`), once = a.json(`D.kart['0:${kiC}']`), cizgiOnce = x(kiC).cizgiGun;
    assert.equal(a.run(`unutmaDersAyarla(0,${JSON.stringify(ders)},2)`), true); d = a.json('hafizaDurumu(0)');
    const S = a.run(`tekrarla(null,3,0,hedefTutma(0),D.ayar.maks,D.ayar.relearn,parametreAl(0,${kiC})).s`);
    assert(Math.abs(x(kiC).r - R(5 / 2, S)) < 1e-9); assert(Math.abs((x(kiC).cizgiGun - (bugun - 5)) - 2 * (cizgiOnce - (bugun - 5))) < 1e-9);
    assert.equal(a.json(`D.kart['0:${kiC}'].due`) - (bugun - 5), Math.min(a.run('D.ayar.maks'), 2 * (once.due - (bugun - 5))), 'the plan’s next review moves with it');
    assert.match(a.run('gorunumHafiza()'), new RegExp('<select data-hf-ders="' + ders + '">[\\s\\S]*?<option value="2" selected>Çok geç unuturum</option>'));
    assert.equal(a.run(`unutmaDersAyarla(0,${JSON.stringify(ders)},3)`), false, 'only the listed speeds');
    // Own state of a topic: 80 % now, 30 days to 90 %. The bar shows 80 %, later results continue from it, "Algoritmaya bırak" removes it.
    assert.equal(a.run(`hafizaElleKaydet(0,${kiA},0.8,30)`), true); d = a.json('hafizaDurumu(0)');
    assert.equal(Math.round(x(kiA).r * 100), 80); assert(Math.abs(x(kiA).sGun - 30) / 30 < 0.05, 'the chosen speed (rounded to whole days)');
    assert.deepEqual([x(kiA).elle, x(kiA).olculmedi, x(kiA).eski], [true, false, false]);
    h = a.run(`EK.hafizaDuzenle=${kiA};gorunumHafiza()`);
    assert.match(h, new RegExp('<div class="hf-duzen" data-hf-duzen="' + kiA + '" data-hedef="0.9">[\\s\\S]*?<b data-hf-r-yazi>%80</b><input type="range" min="5" max="100" step="1" value="80" data-hf-r[\\s\\S]*?<b data-hf-s-yazi>30 günde</b>[\\s\\S]*?data-hf-kaydet="' + kiA + '"[\\s\\S]*?data-hf-birak="' + kiA + '"'));
    assert.equal(a.run('hafizaOnizleYazi(0.8,30,0.9)'), 'Bu ayarla konu çizginin altında: tekrar etmen gerekiyor.'); assert.match(a.run('hafizaOnizleYazi(0.99,30,0.9)'), /çizginin altına \d+ gün sonra iner/);
    a.run(`D.ogr[0].hafizaElle[${kiA}].ts-=10;sonucIsle(0,[{ki:${kiA},gun:${bugun},not:4,dogru:null,soru:null}]);kartiYenidenHesapla(0,${kiA})`);
    assert.deepEqual([a.json(`D.kart['0:${kiA}'].n`), a.json(`D.kart['0:${kiA}'].elle`)], [2, bugun], 'a result after the own state continues from it');
    assert.equal(a.run(`hafizaElleSil(0,${kiA})`), true); assert.equal(a.json(`D.kart['0:${kiA}'].n`), 1); assert.equal(a.run('D.ogr[0].hafizaElle'), undefined);
    // The basket: a topic and a mixed study onto today, a mixed study onto every day; taken out again; never onto a past day.
    const g = bugun - bu;
    assert.equal(a.run(`hafizaSepeteEkle('konu:${kiB}',${bu},${g})`), 1); assert.equal(a.run(`hafizaSepeteEkle('ek:paragraf',${bu},${g})`), 1);
    const gun = hafta(a, bu)[g]; assert(gun.some(r => r.ki === kiB), 'the topic is on today’s plan'); assert(gun.some(r => r.ad === 'Karışık Paragraf'));
    assert.equal(a.run(`hafizaSepeteEkle('ek:problem',${bu},'her')`), 1); assert.equal(a.run("gunlukEkSorusu(0,'problem',bugunNo())"), 20);
    if (g > 0) assert.equal(a.run(`hafizaSepeteEkle('konu:${kiC}',${bu},${g - 1})`), 0, 'not onto a day that has passed');
    h = a.run('gorunumHafiza()');
    assert.match(h, /<section class="kart hf-sepet" id="hfSepet" aria-label="Sepetin">/); assert.match(h, new RegExp('data-hf-gun="' + g + '" data-hf-hb="' + bu + '"'));
    assert.match(h, /data-hf-surukle="ek:paragraf"/); assert.match(h, /data-hf-gun="her"/);
    const slot = gun.find(r => r.ki === kiB).slot; assert.match(h, new RegExp('data-hf-cikar="' + slot + '"'));
    assert.equal(a.run(`hafizaSepettenCikar('${slot}',${bu})`), true); assert(!hafta(a, bu)[g].some(r => r.ki === kiB));
    // The filter keeps one lesson's topics.
    a.run(`EK.hafizaDersFiltre=${JSON.stringify(ders)}`); h = a.run('gorunumHafiza()');
    for (const ki of [kiA, kiB, kiC]) assert.equal(new RegExp('data-hf-ki="' + ki + '"').test(h), a.run(`dersAnahtari(${ki})`) === ders, 'only ' + ders);
    a.run('EK.hafizaDersFiltre=undefined;EK.hafizaDuzenle=undefined');
  });
  await check('a-week-fills-with-what-the-student-reports-and-a-topic-studied-on-its-own-leaves-the-plan-row-behind', async a => {
    await okulsuz(a, { kur: false, dakika: { hi: 40, hs: 40, deneme: false } });
    a.run(`kendiPlanKur(0,${JSON.stringify(hepsiBilir(a))},'2027-04-23')`); genelTekrarBitir(a); a.run('ciz()');
    const bu = a.run('buHafta(0)'), bugun = a.run('bugunNo()'), son = a.run(`planHaftaSonu(0,${bu})`);
    const kagit = hafta(a, bu).flatMap((l, g) => l.map(x => ({ ...x, gun: bu + g }))).filter(x => !x.gt && !x.anlatim);
    const ileri = kagit.find(x => x.gun > bugun), disarida = a.json(`D.ogr[0].kendiPlan.sira.filter(k=>!${JSON.stringify(kagit.map(x => x.ki))}.includes(k)).slice(0,2)`);
    const T = a.json(`haftaTestOzeti(0,${bu},${son})`); assert.deepEqual([T.yapilan, T.kendi, T.kendiToplam], [0, 0, 0]); assert(T.toplam >= 3 && ileri);
    const kok = ki => `{dataset:{ki:'${ki}',gun:'${bugun}',hb:'${bu}',slot:'',planDisi:'1',kayitli:'0',oniz:''},querySelector:()=>null,querySelectorAll:()=>[]}`;
    // Two topics of the student's own choice, reported today: two tests' worth of the week, without touching the plan's rows.
    for (const ki of disarida) { await a.run(`planSonucKaydet(${kok(ki)},3)`); await a.run('KAYIT_ZINCIRI'); }
    let oz = a.json(`haftaTestOzeti(0,${bu},${son})`);
    assert.deepEqual([oz.toplam, oz.yapilan, oz.kendi, oz.kendiToplam], [T.toplam, 2, 2, 2]);
    assert.match(a.run('ogrenciBugunKarti(0)'), new RegExp('<strong>2<small>/' + T.toplam + '</small></strong><span>bu haftanın testi</span>'));
    // The map counts the running week up to today: the tests due so far.
    const Tb = a.json(`haftaTestOzeti(0,${bu},${bugun})`); assert(Tb.toplam >= 2 && Tb.toplam <= T.toplam); assert.equal(Tb.yapilan, 2);
    assert.match(a.run('ogrenciYksYolu(true)'), new RegExp('2/' + Tb.toplam + ' test yapıldı · 2 kendi seçtiğin çalışma'));
    assert.match(a.run('ogrenciYksYolu(true)'), new RegExp('class="yol-hafta yesil[^"]*" style="--oran:' + (2 / Tb.toplam).toFixed(2) + '"[^>]*aria-current="date"'), 'the week is green by what was reported');
    // More reports than the plan asked for never count beyond it.
    assert.equal(a.run(`(()=>{const y=haftaYapilanTestler(0);for(let i=0;i<50;i++)y.add((900000+i)+':${bugun}');return haftaTestOzeti(0,${bu},${son},y).yapilan})()`), 2, 'unknown topics are not counted');
    assert.equal(a.run(`(()=>{const y=haftaYapilanTestler(0);D.ogr[0].kendiPlan.sira.forEach(k=>y.add(k+':${bugun}'));const o=haftaTestOzeti(0,${bu},${son},y);return o.yapilan===o.toplam&&o.kendiToplam>o.kendi})()`), true, 'capped at the tests given');
    // The topic of a later row, studied today on the student's own: that row leaves the student's plan (the result stands on
    // today as a result outside the plan), it is not assumed İyi on top, and it still counts once.
    assert(a.json(`[...(varsayimIyiGunleri(0).get(${ileri.ki})||[])]`).includes(ileri.gun), 'control: the unanswered row is assumed');
    await a.run(`planSonucKaydet(${kok(ileri.ki)},3)`); await a.run('KAYIT_ZINCIRI');
    const gunler = a.json(`ogrenciPlanGunleri(0,${bu},planHesapla(0,${bu}),true).map(l=>l.map(x=>[x.ki,!!x.planDisi]))`);
    assert(!gunler[ileri.gun - bu].some(r => r[0] === ileri.ki), 'the row is gone from its day');
    assert(gunler[bugun - bu].some(r => r[0] === ileri.ki && r[1]), 'the study stands on today');
    assert.deepEqual(a.json(`[...planOrtusu(0,${bu},planHesapla(0,${bu}))]`), [ileri.ki + ':' + ileri.gun]);
    assert(!a.json(`[...(varsayimIyiGunleri(0).get(${ileri.ki})||[])]`).includes(ileri.gun), 'not assumed on top of the real result');
    assert.deepEqual(a.json(`[D.kart['0:${ileri.ki}'].n,D.kart['0:${ileri.ki}'].son]`), [1, bugun]);
    oz = a.json(`haftaTestOzeti(0,${bu},${son})`); assert.deepEqual([oz.toplam, oz.yapilan, oz.kendiToplam], [T.toplam, 3, 3]);
    assert.equal(a.run(`oncekiHaftaEksikTestSayisi(0,${bu},planHesapla(0,${bu}))`), T.toplam - 1, 'the covered row is not a missing result');
    // The teacher's table keeps every row of the paper.
    a.run("D.rol='rehber'"); assert(a.json(`ogrenciPlanGunleri(0,${bu},planHesapla(0,${bu}),true)[${ileri.gun - bu}].map(x=>x.ki)`).includes(ileri.ki)); a.run("D.rol='ogrenci'");
    // A week without a saved plan: one result per working day makes it fully green (six working days here, three results: half).
    assert.equal(a.run(`haftaCalismaGunu(0,${bu},${son})`), 6); assert.equal(a.run(`haftaCalismaGunu(0,${bu},${bu + 1})`), 2); assert.equal(a.run(`haftaCalismaGunu(0,${bu + 6},${bu + 6})`), 1, 'never zero');
  });
  await check('kendi-programim-makes-the-plan-a-suggestion-nothing-unreported-counts-and-the-wording-says-so', async a => {
    await okulsuz(a, { kur: false, dakika: { hi: 40, hs: 40, deneme: false } });
    a.run(`kendiPlanKur(0,${JSON.stringify(hepsiBilir(a))},'2027-04-23')`); genelTekrarBitir(a); a.run('ciz()');
    const bu = a.run('buHafta(0)'), bugun = a.run('bugunNo()');
    const say = () => a.json('[...varsayimIyiGunleri(0).values()].flat()');
    assert(say().some(g => g >= bugun), 'control: today’s and later rows of the given week are assumed İyi');
    assert.match(a.run('planiAyarlaKarti(0)'), /<input type="checkbox" id="ogrSerbest"><span><b>Kendi programımı kendim yaparım<\/b>/);
    assert.doesNotMatch(a.run('gorunumOgrenciPlan()'), /serbestNot/); assert.match(a.run('ogrenciBugunKarti(0)'), /test seni bekliyor/);
    // Switched on today.
    assert.equal(a.run('serbestAyarla(0,true)'), true); assert.deepEqual(a.json('D.ogr[0].serbest'), [[bugun, null]]);
    assert.equal(say().filter(g => g >= bugun).length, 0, 'from today nothing is assumed');
    assert.doesNotThrow(() => a.run('yedekDogrula(JSON.parse(JSON.stringify(D)))'));
    const h = a.run('gorunumOgrenciPlan()');
    assert.match(h, /<p class="mini serbest-not" id="serbestNot">Kendi programını yapıyorsun: bu plan bir öneri\./);
    assert.match(h, /<span>Öneri · çalışırsan sonucunu seç<\/span><b class="ps-deger">girmezsen sayılmaz<\/b>/); assert.doesNotMatch(h, /İyi sayılır/);
    assert.match(a.run('ogrenciBugunKarti(0)'), /<span>test öneriliyor<\/span>/);
    assert.match(a.run('planiAyarlaKarti(0)'), /id="ogrSerbest" checked>/); assert.match(a.run("EK.sekme='hafiza';gorunumHafiza()"), /id="ogrSerbest" checked>[\s\S]*Kendi programını yapıyorsun: sonucunu girmediğin hiçbir test yapılmış sayılmıyor/);
    // A reported result still works the same way and shows as the student's own.
    const t = hafta(a, bu).flatMap((l, g) => l.map(x => ({ ...x, gun: bu + g }))).find(x => x.gun === bugun && !x.gt && !x.anlatim);
    await a.run(`planSonucKaydet({dataset:{ki:'${t.ki}',gun:'${bugun}',hb:'${bu}',slot:'${t.slot}',planDisi:'0',kayitli:'0',oniz:''},querySelector:()=>null,querySelectorAll:()=>[]},3)`); await a.run('KAYIT_ZINCIRI');
    assert.match(a.run('gorunumOgrenciPlan()'), new RegExp('data-ps data-ki="' + t.ki + '"[^>]*data-kayitli="3"'));
    // Last week's unanswered rows are not "missing" for a student who was on her own that week.
    a.run(`D.ogr[0].serbest=[[${bu - 7},null]]`);
    assert.equal(a.run(`oncekiHaftaEksikTestSayisi(0,${bu},planHesapla(0,${bu}))`), 0);
    // The teacher's copy takes the switch with the student's work and sees it on the plan header.
    a.run("D.rol='rehber'"); assert.match(a.run('gorunumPlan()'), new RegExp('<b>kendi programını yapıyor</b> \\(' + a.run(`ggyy(${bu - 7})`).replace(/\./g, '\\.') + ' tarihinden beri; sonucu girilmeyen test İyi sayılmaz\\)')); a.run("D.rol='ogrenci'");
    // Switched off: today on, the plan is the rule again; the period stays as it was lived.
    assert.equal(a.run('serbestAyarla(0,false)'), true); assert.deepEqual(a.json('D.ogr[0].serbest'), [[bu - 7, bugun - 1]]);
    assert.doesNotMatch(a.run('gorunumOgrenciPlan()'), /serbestNot/);
  });

  console.log('genel tekrar regression: ' + checks.length + ' checks passed');
})().catch(e => { console.error(e); process.exit(1); });
