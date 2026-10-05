'use strict';
// LGS, KPSS, ALES, DGS and AGS: the setup asks which exam, and a non-YKS student studies that
// exam's topic list with the same personal plan the no-school YKS student uses (lessons,
// one-test checks, pacing to a target date). YKS students see no change.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8'), marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const source = html.slice(start, html.indexOf('// ---------------------------------------------------------------- başlangıç', start));
const veri = JSON.parse(fs.readFileSync('data/sinav-konulari-2026.json', 'utf8'));
const SINAVLAR = ['LGS', 'KPSS', 'ALES', 'DGS', 'AGS'];

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
// The setup form as a test-account student fills it ("today" is 23.09.2026).
async function kurulum(a, sinavTuru, sinav = '2027-07-11', alan = 'SAY') {
  a.run("D=varsayilan();D.rol='ogrenci';D.ayar.testTarih='2026-09-23';EK={ogr:0,sekme:'plan',hafta:null,girisAcik:{}};");
  Object.assign(a.nodes, { kOgrAd: a.el({ value: 'Aday' }), kOgrSinavTuru: a.el({ value: sinavTuru }),
    kOgrOkul: a.el({ value: 'evet' }), kOgrAlan: a.el({ value: alan }), kOgrSinav: a.el({ value: sinav }) });
  await a.tikla('kOgrBaslat');
}
const kur = (a, seviye = {}, hedef = '2027-05-28') => a.run(`kendiPlanKur(0,${JSON.stringify(seviye)},'${hedef}')`);
async function tamamla(a, ki, bu) {
  const gun = a.run(`(()=>{const p=planHesapla(0,${bu});const g=p.gunler.findIndex(l=>l.some(x=>x.anlatim&&x.ki===${ki}));return ${bu}+g;})()`);
  if (gun > a.run('bugunNo()')) a.run(`D.ayar.testTarih=isoDan(${gun})`);
  a.run(`anlatimTamam(0,${ki},${gun})`); await a.run('kaydet(true)');
}
const checks = [];
async function check(name, fn) { await fn(app()); checks.push(name); }

(async () => {
  await check('embedded-exam-data-matches-the-reviewed-json', async a => {
    assert.deepEqual(JSON.parse(a.run('JSON.stringify(SINAV_KONULARI)')), veri);
    assert.deepEqual(JSON.parse(a.run('JSON.stringify(DIGER_SINAVLAR)')), SINAVLAR);
    for (const s of SINAVLAR) {
      const x = veri.sinavlar[s];
      assert(x.ad === s && x.uzunAd && x.kurum && x.kapsam, s + ' has its names and scope');
      assert(x.kaynaklar.length >= 2 && x.kaynaklar.every(u => /^https:\/\//.test(u)), s + ' cites sources');
      assert(x.dersler.length >= 3, s + ' has courses');
      for (const d of x.dersler) {
        assert(Number.isInteger(d.idx) && d.idx >= 0 && d.idx < 10, s + ' ' + d.ad + ' maps to a known course slot');
        assert(d.konular.length > 0 && new Set(d.konular).size === d.konular.length, s + ' ' + d.ad + ' has distinct topics');
        assert(d.konular.every(k => typeof k === 'string' && k.trim() === k && k.length > 1 && k.length < 120));
      }
    }
  });

  await check('setup-asks-for-the-exam-date-and-stores-the-exam', async a => {
    await kurulum(a, 'KPSS', '');
    assert.equal(a.run('D.ogr.length'), 0); assert(a.events.includes('alert:Sınav tarihini seç.'));
    await kurulum(a, 'KPSS', '2026-10-01');
    assert.equal(a.run('D.ogr.length'), 0); assert(a.events.includes('alert:Sınav tarihi en az iki hafta sonra olmalı.'));
    await kurulum(a, 'TUS');
    assert.equal(a.run('D.ogr.length'), 0); assert(a.events.includes('alert:Geçerli bir sınav seç.'));
    for (const s of SINAVLAR) {
      const b = app();
      await kurulum(b, s, '2027-07-11', 'EA');
      const o = JSON.parse(b.run('JSON.stringify(D.ogr[0])'));
      assert.equal(o.sinavTuru, s); assert.equal(o.okul, false); assert.equal(o.sube, 'benim');
      assert.equal(o.alan, 'SAY', 'the YKS field question does not apply');
      assert.deepEqual(o.dakika, { hi: 180, hs: 180, deneme: false });
      assert.equal(b.run('D.ayar.sinav'), '2027-07-11');
      assert.equal(b.run('D.ayar.donemBasi'), b.run('isoDan(buHafta(0))'));
      assert.equal(b.run('Object.keys(D.dersProgrami||{}).length'), 0, 'no timetable');
      assert.equal(b.run('EK.sekme'), 'ayarlar');
      assert(b.events.some(e => e.includes('“Kendi ' + s + ' planımı başlat”')), s + ' start message');
    }
  });

  await check('yks-setup-is-unchanged', async a => {
    await kurulum(a, 'YKS', '2027-06-19');
    const o = JSON.parse(a.run('JSON.stringify(D.ogr[0])'));
    assert.equal(o.sinavTuru, undefined); assert.notEqual(o.okul, false);
    assert.equal(a.run('ogrenciSinavi(D.ogr[0])'), 'YKS'); assert.equal(a.run('kendiPlanTuru(D.ogr[0])'), 'TYT');
    assert(a.run('SEKMELER().some(([id])=>id==="mufredat")') && a.run('SEKMELER().some(([id])=>id==="denemeler")'));
  });

  await check('each-exam-plan-carries-exactly-that-exams-topics', async a => {
    for (const s of SINAVLAR) {
      const b = app();
      await kurulum(b, s);
      const sayi = kur(b);
      const beklenen = veri.sinavlar[s].dersler.reduce((t, d) => t + d.konular.length, 0);
      assert.equal(b.run('D.ogr[0].kendiPlan.tur'), s);
      assert.equal(sayi, beklenen, s + ' plans every listed topic once');
      const dersler = new Set(JSON.parse(b.run('JSON.stringify(D.ogr[0].kendiPlan.sira.map(k=>D.konuDers[k]))')));
      assert.deepEqual([...dersler].sort(), veri.sinavlar[s].dersler.map(d => d.ad).sort(), s + ' courses');
      assert(!/AYT|TYT/.test([...dersler].join()), s + ' borrows no YKS course');
      assert.equal(b.run('D.ogr[0].kendiPlan.sira.filter(k=>!alanUygun(0,k)).length'), 0, s + ' topics all pass the field filter');
      assert.equal(b.run('kendiPlanKuyrugu(0).length'), sayi);
      const ilk = JSON.parse(b.run('JSON.stringify(D.ogr[0].kendiPlan.sira.slice(0,' + veri.sinavlar[s].dersler.length + ').map(k=>D.konuDers[k]))'));
      assert.equal(new Set(ilk).size, veri.sinavlar[s].dersler.length, s + ' mixes every course from the start');
    }
  });

  await check('same-topic-name-in-two-courses-stays-two-topics', async a => {
    // KPSS "Türkçe" and AGS "Sözel Yetenek" both list paragraph work under course slot 0.
    await kurulum(a, 'KPSS'); kur(a);
    const paragraf = a.run("D.ogr[0].kendiPlan.sira.filter(k=>konuAl(k)[3]==='Paragrafta Anlam').length");
    assert.equal(paragraf, 1);
    const ki = a.run("D.ogr[0].kendiPlan.sira.find(k=>konuAl(k)[3]==='Paragrafta Anlam')");
    assert.equal(a.run(`kullaniciKonusuTam(0,'Paragrafta Anlam','Türkçe',12)`), ki, 'same exam, same topic');
    assert.notEqual(a.run(`kullaniciKonusuTam(0,'Paragrafta Anlam','Sözel Yetenek',12)`), ki, 'another course label is another topic');
  });

  await check('lessons-for-courses-outside-the-yks-field-lead-to-tests', async a => {
    await kurulum(a, 'AGS');
    kur(a, {}, '2026-11-01'); a.run('ciz()');                      // ~6 new topics a week
    const bu = a.run('buHafta(0)');
    const satirlar = JSON.parse(a.run(`(()=>{const p=planHesapla(0,${bu});return JSON.stringify(p.gunler.flat().filter(x=>x.anlatim)
      .map(x=>({ki:x.ki,kaynak:p.elle.anlatim[x.ki].kaynak,ders:D.konuDers[x.ki]})))})()`));
    assert(satirlar.length > 0 && satirlar.every(x => x.kaynak === 'Kendi AGS planın'), 'AGS lessons are issued this week');
    // Eğitim Bilimleri (slot 8) and Mevzuat (slot 6) are outside the internal SAY field.
    const disari = satirlar.find(x => ['Eğitim Bilimleri ve Türk Millî Eğitim Sistemi', 'Mevzuat', 'Tarih', 'Türkiye Coğrafyası'].includes(x.ders));
    assert(disari, 'a non-SAY course lesson is issued: ' + satirlar.map(x => x.ders).join());
    await tamamla(a, disari.ki, bu);
    let test = false;
    for (let w = 0; w < 4 && !test; w++) test = a.run(`planHesapla(0,sonrakiHafta(0,${bu})+${w * 7}).gunler.flat().some(x=>x.ki===${disari.ki}&&!x.anlatim)`);
    assert(test, 'a test follows the ' + disari.ders + ' lesson');
    assert.match(a.run(`sonucSatiriHtml({si:0,ki:${disari.ki},gun:bugunNo(),kayit:null,soru:12})`), /Bu konuyu henüz çalışmadım/);
  });

  await check('known-courses-start-with-a-check-test', async a => {
    await kurulum(a, 'ALES');
    kur(a, { 'Matematik': 'bilir', 'Geometri': 'biraz' }, '2026-11-01'); a.run('ciz()');
    const bu = a.run('buHafta(0)');
    const satir = JSON.parse(a.run(`(()=>{const p=planHesapla(0,${bu});return JSON.stringify(p.gunler.flat()
      .filter(x=>D.ogr[0].kendiPlan.sira.includes(x.ki)).map(x=>({ders:D.konuDers[x.ki],anlatim:!!x.anlatim})))})()`));
    assert(satir.some(x => x.ders === 'Türkçe' && x.anlatim), 'unknown course: lesson');
    assert(satir.some(x => x.ders === 'Matematik' && !x.anlatim), 'known course: test');
    assert(!satir.some(x => x.ders === 'Matematik' && x.anlatim), 'known course: no lesson');
  });

  await check('screens-name-the-chosen-exam', async a => {
    await kurulum(a, 'ALES');
    let h = a.run('gorunumAyarlar()');
    assert.match(h, /<h2>Kendi ALES planın<\/h2>/);
    assert.match(h, /Akademik Personel ve Lisansüstü Eğitimi Giriş Sınavı konuları bu planla gelir/);
    assert.match(h, /Kapsam ve kaynaklar/); assert.match(h, /href="https:\/\//);
    assert.match(h, /Konu başlıkları 01\.10\.2026 tarihinde derlendi/);
    assert.match(h, /Kendi ALES planımı başlat/);
    assert.doesNotMatch(h, /Çalışma ağırlığın/, 'the TYT→AYT weighting does not apply');
    assert.doesNotMatch(h, /Kendi TYT planın/);
    assert.match(h, /ALES tarihi/);
    assert.doesNotMatch(h, /data-sekme="konuplani"/, 'no school topic plan to edit');
    assert.match(a.run("EK.sekme='plan';gorunumPlan()"), /ALES planın henüz başlamadı/);
    kur(a); a.run('ciz()');
    h = a.run("EK.sekme='plan';gorunumPlan()");
    assert.match(h, /ALES’e giden yol/); assert.doesNotMatch(h, /YKS’ye giden yol/);
    assert.match(a.run('ogrenciYksYolu(true)'), /Ayarlardaki ALES tarihi/);
    assert.match(a.run("EK.sekme='rapor';gorunumRapor()"), /ALES’e \d+ gün/);
    assert.deepEqual(JSON.parse(a.run('JSON.stringify(SEKMELER().map(s=>s[0]))')),
      ['plan', 'giris', 'harita', 'kurtarma', 'rapor', 'ayarlar'], 'no Müfredat, no Denemelerim');
    const b = app(); await kurulum(b, 'KPSS'); kur(b); b.run('ciz()');
    assert.match(b.run("EK.sekme='plan';gorunumPlan()"), /KPSS’ye giden yol/);
  });

  await check('exam-type-and-plan-type-validate-and-sync', async a => {
    await kurulum(a, 'DGS'); kur(a);
    a.run('yedekDogrula(JSON.parse(JSON.stringify(D)))');
    assert.throws(() => a.run("(()=>{const y=JSON.parse(JSON.stringify(D));y.ogr[0].sinavTuru='TUS';yedekDogrula(y);})()"), /Geçersiz sınav türü/);
    assert.throws(() => a.run("(()=>{const y=JSON.parse(JSON.stringify(D));y.ogr[0].kendiPlan.tur='TUS';yedekDogrula(y);})()"));
    assert.match(html, /'okul','sinavTuru'(,'\w+')*\]\.forEach/, 'the exam travels with the work snapshot');
    // An unknown stored value never turns a student into a non-YKS one.
    assert.equal(a.run("ogrenciSinavi({sinavTuru:'TUS'})"), 'YKS');
    assert.equal(a.run("ogrenciSinavi({sinavTuru:'__proto__'})"), 'YKS');
  });

  await check('target-date-is-clamped-to-a-close-exam', async a => {
    await kurulum(a, 'LGS', '2026-10-21');                          // four weeks away
    assert.equal(a.run('kendiPlanVarsayilanHedef()'), '2026-10-21', 'default target is not after the exam');
    assert.equal(a.run("kendiPlanHedefHatasi('2026-10-21')"), '');
    assert.match(a.run("kendiPlanHedefHatasi('2026-10-22')"), /sınav tarihinden \(21\.10\.2026\) sonra olamaz/);
  });

  console.log('exam plan regression: ' + checks.length + ' checks passed');
})().catch(e => { console.error(e); process.exit(1); });
