#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');

const target = process.argv[2] || 'index.html';
const html = fs.readFileSync(target, 'utf8');
const marker = '<script id="uygulama">';
const start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
if (start < marker.length || boot < 0) throw new Error('Uygulama betiği bulunamadı.');

const sandbox = {
  console, setTimeout, clearTimeout, Blob, URL, URLSearchParams, crypto,
  location: { search: '?dev=1' }, Date, Math, JSON, Intl,
  alert() {}, confirm() { return true; }, prompt() { return ''; }, fetch: async () => ({ ok: false }),
  localStorage: { getItem() { return null; }, setItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {}, window: { scrollTo() {}, open() { return null; }, addEventListener() {} },
  document: {
    activeElement: null, addEventListener() {}, contains() { return true; },
    getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return { style: {}, classList: { add() {}, remove() {} }, click() {}, remove() {} }; },
    body: { appendChild() {}, insertAdjacentHTML() {} }
  }
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
new vm.Script(html.slice(start, boot), { filename: target }).runInContext(sandbox);
const parse = text => vm.runInContext('dersProgramiJsonAyristir(' + JSON.stringify(text) + ')', sandbox);

const base = {
  saatler: ['09:00', '09:55'],
  gunler: [
    ['MATEMATİK TYT', 'FİZİK'], ['KİMYA', ''], ['', ''], ['', ''], ['', ''], ['', ''], ['', '']
  ]
};
const json = JSON.stringify(base);
const checks = [];
function check(name, text, verify) {
  const result = parse(text);
  if (!result.tablo || !verify(result.tablo)) throw new Error(name + ': ' + JSON.stringify(result));
  checks.push(name);
}

check('plain-json', json, t => t.gunler[0][0] === 'MATEMATİK TYT');
check('markdown-fence', '```json\n' + json + '\n```', t => t.saatler.length === 2);
check('surrounding-prose-with-extra-object', 'Program: ' + json + '\nAçıklama örneği: {"not":"bitti"}',
  t => t.gunler[1][0] === 'KİMYA');
check('unrelated-object-before-program', '{"durum":"hazır"}\n' + json, t => t.gunler.length === 7);

const braces = JSON.parse(json);
braces.gunler[0][0] = 'MATEMATİK {TYT}';
check('braces-inside-string', JSON.stringify(braces), t => t.gunler[0][0] === 'MATEMATİK {TYT}');

// Yalnızca gerçek sondaki virgülü sınar; çift virgül gibi belirsiz bozukluk kabul edilmemeli.
check('trailing-comma', json.replace(/\}\s*$/, ',}'), t => t.saatler[0] === '09:00');

const curly = json.replace(/"/g, (m, i, whole) => {
  const before = whole.slice(0, i);
  return (before.match(/"/g) || []).length % 2 ? '”' : '“';
});
check('all-smart-quotes', curly, t => t.saatler[1] === '09:55');

const weekdays = JSON.parse(json);
weekdays.gunler = weekdays.gunler.slice(0, 5);
check('five-day-program-pads-weekend', JSON.stringify(weekdays),
  t => t.gunler.length === 7 && t.gunler[5].every(x => x === '') && t.gunler[6].every(x => x === ''));

const noTable = parse('{"hata":"Görselde okunabilir bir haftalık ders programı bulunamadı."}');
if (!noTable.hata || !/bulunamadı/.test(noTable.hata)) throw new Error('structured-no-timetable-error');
checks.push('structured-no-timetable-error');

const promptContract = vm.runInContext('dersProgramiPromptMetni()', sandbox);
if (!promptContract.includes('{"hata":') || !promptContract.includes('tahmin etme'))
  throw new Error('prompt-must-forbid-inventing-a-missing-timetable');
checks.push('prompt-forbids-invented-timetable');

const invalid = parse('{"saatler":["09:00"],"gunler":[,,,]}');
if (!invalid.hata || invalid.tablo) throw new Error('invalid-json-must-remain-rejected: ' + JSON.stringify(invalid));
checks.push('invalid-json-remains-rejected');

const wrongShape = parse('{"saatler":[],"gunler":[]}');
if (!wrongShape.hata || !/saatler/.test(wrongShape.hata)) throw new Error('schema-validation-must-remain-specific');
checks.push('schema-validation-remains-specific');

const invalidDay = parse('{"saatler":["09:00"],"gunler":[[],[],"Cuma",[],[]]}');
if (!invalidDay.hata || !/ayrı bir ders listesi/.test(invalidDay.hata)) throw new Error('non-array-day-must-be-rejected');
checks.push('non-array-day-remains-rejected');

const tooLarge = parse(' '.repeat(200001));
if (!tooLarge.hata || !/çok büyük/.test(tooLarge.hata)) throw new Error('oversized-output-must-be-rejected-quickly');
checks.push('oversized-output-rejected');


// Yeni bir şubenin henüz programı yokken ilk aktarım boş anahtara yazılmamalı.
// Bu, arayüzün "aktarıldı" deyip haftalık planda hiçbir şey göstermediği hatanın regresyon testidir.
const initialClass = vm.runInContext(`
  D = varsayilan();
  D.rol = 'rehber';
  D.ogr = [{ ad: 'Test Öğrenci', sube: '12A', silindi: false }];
  D.dersProgrami[''] = { saatler: ['09:00'], gunler: [[], [], [], [], [], [], []] };
  D.programHafta[''] = {};
  EK.sube = '';
  const html = gorunumProgram();
  ({ sube: EK.sube, subeler: subeListesi(), secenekte: html.includes('<option selected>12A</option>') });
`, sandbox);
if (initialClass.sube !== '12A' || initialClass.subeler.includes('') || !initialClass.secenekte)
  throw new Error('first-timetable-import-must-target-real-class: ' + JSON.stringify(initialClass));
checks.push('first-timetable-import-targets-real-class');


// Rehber tarafında eklenen ilk öğrenci için eksik konu planı, ders programının
// "aktarıldı" deyip boş haftalık plan üretmesine yol açmamalı.
const teacherPlan = vm.runInContext(`
  D = varsayilan();
  D.rol = 'rehber';
  D.ayar.donemBasi = '2026-09-14';
  D.ayar.testTarih = '2026-09-16';
  D.ogr = [{ ad: 'Test Öğrenci', no: 1, sube: '12A', alan: 'SAY', silindi: false,
    aktif: false, kap: 6, off: [6], hedef: null, maddeler: [], rutin: { once: '', ara: '', sonra: '' } }];
  EK.ogr = 0; EK.sube = '12A';
  const hazir = varsayilanKonuPlaniniHazirla('12A', 'SAY');
  programYaz('12A', haftaBasi(), ${JSON.stringify(base)});
  programDegistiTetikle('12A');
  const p = planHesapla(0, haftaBasi());
  ({ olustu: hazir.olustu, hafta: D.konuPlani['12A'].length, toplam: p.toplam });
`, sandbox);
if (!teacherPlan.olustu || teacherPlan.hafta < 1 || teacherPlan.toplam < 1)
  throw new Error('teacher-class-must-get-default-topic-plan: ' + JSON.stringify(teacherPlan));
checks.push('teacher-class-gets-default-topic-plan');

const existingPlan = vm.runInContext(`
  D.konuPlani['12A'][0]['Matematik TYT'][0] = 'Özel konu';
  const yeniden = varsayilanKonuPlaniniHazirla('12A', 'SAY');
  ({ olustu: yeniden.olustu, ad: D.konuPlani['12A'][0]['Matematik TYT'][0] });
`, sandbox);
if (existingPlan.olustu || existingPlan.ad !== 'Özel konu')
  throw new Error('existing-topic-plan-must-never-be-overwritten: ' + JSON.stringify(existingPlan));
checks.push('existing-topic-plan-is-not-overwritten');

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
