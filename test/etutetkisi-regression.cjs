#!/usr/bin/env node
'use strict';
// Etüt etkisi: the model (the students who took a lesson's etüts in the window before an exam against those who
// took none, per teacher and per number of etüts), the window rules (days, exam days, other lessons, TYT / AYT
// courses), the interval and the too-few flag, the figure per exam pair, the page and its states, the menu, the
// viewing teacher and privacy. Synthetic students only; the merged students are those of Öğrenci raporları.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const marker = '<script id="uygulama">', start = html.indexOf(marker) + marker.length;
const boot = html.indexOf('// ---------------------------------------------------------------- başlangıç', start);
const source = html.slice(start, boot);
const node = () => ({innerHTML:'',textContent:'',style:{},hidden:false,setAttribute(){},appendChild(){},remove(){},click(){},focus(){},getClientRects(){return [1]}});
const nodes = {ray:node(),ana:node(),stil:{textContent:'body{}'},uygulama:{textContent:source},veri:{textContent:'null'}};
const sandbox = {console,setTimeout,clearTimeout,Blob,URL,URLSearchParams,TextEncoder,location:{search:'?dev=1'},Date,Math,JSON,Intl,alert(){},confirm(){return true},prompt(){return ''},fetch:async()=>({ok:false}),
  localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{},window:{scrollTo(){},open(){return null},addEventListener(){}},
  document:{activeElement:null,addEventListener(){},contains(){return true},getElementById(id){return nodes[id]||null},querySelector(){return null},querySelectorAll(){return []},createElement(){return node()},body:{appendChild(){},insertAdjacentHTML(){}}}};
sandbox.window.document = sandbox.document; vm.createContext(sandbox); new vm.Script(source).runInContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const put = (name, value) => sandbox[name] = JSON.parse(JSON.stringify(value));
const get = code => JSON.parse(JSON.stringify(run(code)));
sandbox.__yg = run('yalnizcaGoruntuleme'); sandbox.__rapor = run('OGRENCI_RAPOR.model');
const reset = () => run(`yalnizcaGoruntuleme=__yg;OGRENCI_RAPOR.model=__rapor;D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='etutetki';
  for(const k of ['eeDuzey','eeOturum','eeDers','eeSimdi','eeOnceki','eePencere','eeHoca'])EK[k]=undefined;`);
const merged = ogr => { put('S', ogr); run('OGRENCI_RAPOR.model=()=>({students:S,warnings:[]})'); };
const model = (ogr, sec = {}) => { put('S', ogr); put('C', sec); return get('ETUT_ETKI.model(S,C)'); };
const r2 = x => Math.round(x * 100) / 100, mean = a => a.reduce((t, x) => t + x, 0) / a.length;
let passed = 0;
async function check(name, fn) { reset(); try { await fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }

// ---- synthetic grade 12: three exams a week apart and a Matematik / Fizik net per student ----
const E = [['27-YKS-1201', '2026-10-07'], ['27-YKS-1202', '2026-10-14'], ['27-YKS-1203', '2026-10-21']];
const A = 'SENTETİK ÖĞRETMEN A', B = 'SENTETİK ÖĞRETMEN B', C = 'SENTETİK ÖĞRETMEN C', F = 'SENTETİK ÖĞRETMEN F';
// id → change in Matematik from 1202 to 1203; 1201 → 1202 is +1 for everyone.
const CHG = { 1: 3, 2: 2.5, 3: 3.5, 4: 2, 5: 4, 6: 3, 7: 2.8, 8: 3.2, 9: 2.2, 10: 3.8, 11: 1, 12: 0.5, 13: 1.5, 14: 1, 15: 0.8, 16: 1.2,
  17: 0.5, 18: 1, 19: 0, 20: 0.8, 21: 0.2, 22: 0.7, 23: 0.4, 24: 0.4 };
const oturum = (id, course, teacher, ...dates) => dates.map(d => ({ date: d, course, teacher, minutes: 40, time: 900 }));
const MAT = 'MATEMATİK TYT';
const SESS = {
  // A: students 1–10 (1–4 once, 5–7 twice, 8–10 three times); 4 and 8 also see B; B alone: 11–16.
  1: oturum(1, MAT, A, '2026-10-16'), 2: oturum(2, MAT, A, '2026-10-16'), 3: oturum(3, MAT, A, '2026-10-17'),
  4: [...oturum(4, MAT, A, '2026-10-16'), ...oturum(4, MAT, B, '2026-10-19')],
  5: oturum(5, MAT, A, '2026-10-15', '2026-10-17'), 6: oturum(6, MAT, A, '2026-10-16', '2026-10-19'), 7: oturum(7, MAT, A, '2026-10-15', '2026-10-20'),
  8: [...oturum(8, MAT, A, '2026-10-15', '2026-10-16', '2026-10-19'), ...oturum(8, MAT, B, '2026-10-20')],
  9: oturum(9, MAT, A, '2026-10-15', '2026-10-16', '2026-10-17'), 10: oturum(10, MAT, A, '2026-10-16', '2026-10-17', '2026-10-20'),
  11: oturum(11, MAT, B, '2026-10-16'), 12: oturum(12, MAT, B, '2026-10-17'), 13: oturum(13, MAT, B, '2026-10-19'), 14: oturum(14, MAT, B, '2026-10-16'),
  15: oturum(15, MAT, B, '2026-10-20'), 16: oturum(16, 'MATEMATİK', B, '2026-10-15'),
  // No Matematik etüt that counts: another lesson, the exam day, the day of the earlier exam, before it, an AYT-only course.
  17: oturum(17, 'FİZİK', F, '2026-10-16'), 18: oturum(18, 'FİZİK', F, '2026-10-17', '2026-10-19'), 19: oturum(19, MAT, A, '2026-10-21'),
  20: oturum(20, MAT, A, '2026-10-14'), 21: oturum(21, MAT, C, '2026-10-10'), 22: oturum(22, 'MATEMATİK AYT', A, '2026-10-16'), 23: [], 24: []
};
const ogrenci = i => {
  const once = 10 + i * 0.3, nets = [once - 1, once, once + CHG[i]];
  return { id: 'o' + i, name: 'SENTETİK ÖĞRENCİ ' + String(i).padStart(2, '0'), cls: '12/' + (i % 2 ? 'A' : 'B'), sessions: SESS[i] || [],
    exams: E.map(([exam, date], k) => ({ exam, date, session: 'TYT', nets: { mat: r2(nets[k]), fizik: 5 + k } })) };
};
const OGR = Object.keys(CHG).map(Number).map(ogrenci);
// Students that never count: no 1202 result, no Matematik net, and another grade.
const EKSIK = [
  { id: 'x1', name: 'SENTETİK EKSİK 1', cls: '12/A', sessions: oturum(0, MAT, A, '2026-10-16'), exams: [E[0], E[2]].map(([exam, date]) => ({ exam, date, session: 'TYT', nets: { mat: 8 } })) },
  { id: 'x2', name: 'SENTETİK EKSİK 2', cls: '12/A', sessions: oturum(0, MAT, A, '2026-10-16'), exams: E.map(([exam, date]) => ({ exam, date, session: 'TYT', nets: { fizik: 6 } })) },
  { id: 'x3', name: 'SENTETİK KÜÇÜK', cls: '9/A', sessions: oturum(0, MAT, A, '2026-10-16'), exams: E.map(([exam, date]) => ({ exam: exam.replace('YKS', 'TYT'), date, session: 'TYT', nets: { mat: 7 } })) }
];
const TUM = OGR.concat(EKSIK);
const ids = (...l) => l.flat();
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const delta = l => l.map(i => CHG[i]);

(async () => {
  await check('model: the exams, the default pair, the lesson with most etüts and the groups by teacher', () => {
    const m = model(TUM);
    assert.equal(m.durum, 'tamam'); assert.deepEqual(m.duzeyler, [12, 9]); assert.equal(m.duzey, 12); assert.deepEqual(m.oturumlar, ['TYT']); assert.equal(m.oturum, 'TYT');
    assert.deepEqual(m.sinavlar.map(e => e.ad), E.map(e => e[0])); assert.equal(m.simdi, 2); assert.equal(m.onceki, 1); assert.equal(m.pencere, 7);
    assert.deepEqual(m.dersler.map(d => d.ders), ['Matematik', 'Fizik']); assert.equal(m.ders, 'Matematik');
    // 1202 → 1203, the last 7 days (15–20 Oct): no one outside the 24 students counts.
    assert.equal(m.satir.length, 24);
    const kontrol = range(17, 24), a = range(1, 10), b = [...range(11, 16), 4, 8], hepsi = [...range(1, 16)];
    assert.equal(m.kontrol.n, 8); assert.equal(m.kontrol.ort, r2(mean(delta(kontrol))));
    const ha = m.hocalar.find(h => h.ad === 'Sentetik Öğretmen A'), hb = m.hocalar.find(h => h.ad === 'Sentetik Öğretmen B');
    assert.deepEqual(m.hocalar.map(h => h.ad), ['Sentetik Öğretmen A', 'Sentetik Öğretmen B'], 'by number of students, no teacher for Fizik or the AYT course');
    assert.equal(ha.alan.n, 10); assert.equal(ha.alan.ort, r2(mean(delta(a)))); assert.equal(ha.fark, r2(mean(delta(a)) - mean(delta(kontrol))));
    assert.equal(ha.etut, r2((1 + 1 + 1 + 1 + 2 + 2 + 2 + 3 + 3 + 3) / 10), 'etüts of teacher A per student who took them');
    assert.equal(hb.alan.n, 8); assert.equal(hb.alan.ort, r2(mean(delta(b)))); assert.equal(hb.fark, r2(mean(delta(b)) - mean(delta(kontrol))));
    assert.equal(m.hepsi.alan.n, 16); assert.equal(m.hepsi.alan.ort, r2(mean(delta(hepsi)))); assert.equal(m.hepsi.fark, r2(mean(delta(hepsi)) - mean(delta(kontrol))));
    // The starting nets sit beside the changes: the mean 1202 Matematik net of each group.
    const once = l => r2(mean(l.map(i => 10 + i * 0.3)));
    assert.equal(ha.alan.once, once(a)); assert.equal(m.kontrol.once, once(kontrol)); assert.equal(ha.alan.simdi, r2(mean(a.map(i => 10 + i * 0.3 + CHG[i]))));
    // By number of etüts: 0 · 1 · 2 · 3 and over.
    assert.deepEqual(m.doz.map(d => d.ad), ['0', '1', '2', '3 ve üstü']);
    assert.deepEqual(m.doz.map(d => d.n), [8, 9, 4, 3]);
    assert.equal(m.doz[1].ort, r2(mean(delta([1, 2, 3, ...range(11, 16)])))); assert.equal(m.doz[2].ort, r2(mean(delta([4, 5, 6, 7])))); assert.equal(m.doz[3].ort, r2(mean(delta([8, 9, 10]))));
    // A student's own record.
    const s4 = m.satir.find(r => r.id === 'o4'); assert.equal(s4.n, 2); assert.deepEqual(Object.values(s4.hoca).sort(), [1, 1]); assert.equal(s4.fark, 2);
  });
  await check('window: 7 days, 14 days or all the days between the exams; exam days and other lessons never count', () => {
    // 1201 → 1203 (7 → 21 Oct) turns the 10 Oct etüt of student 21 into one that counts in the longer windows.
    const sec = { onceki: '27-YKS-1201', simdi: '27-YKS-1203' };
    let m = model(TUM, { ...sec, pencere: 7 }), c = m.satir.find(r => r.id === 'o21');
    assert.equal(c.n, 0, 'the 10 Oct etüt is before the 7-day window (15–20 Oct)'); assert.equal(m.kontrol.n, 8);
    m = model(TUM, { ...sec, pencere: 14 }); c = m.satir.find(r => r.id === 'o21'); assert.equal(c.n, 1); assert.equal(m.satir.find(r => r.id === 'o20').n, 1); assert.equal(m.kontrol.n, 6, 'the 14-day window (8–20 Oct) takes the 10 and 14 Oct etüts');
    m = model(TUM, { ...sec, pencere: 0 }); assert.equal(m.satir.find(r => r.id === 'o21').n, 1); assert.equal(m.pencere, 0); assert.equal(m.kontrol.n, 6);
    assert.equal(m.satir.find(r => r.id === 'o20').n, 1, 'the 14 Oct etüt lies between the exams of 7 and 21 Oct (neither exam day)');
    assert.equal(m.hocalar.find(h => h.ad === 'Sentetik Öğretmen C').alan.n, 1);
    // Never counted: the exam day itself (student 19), another lesson (17, 18), an AYT-only course (22).
    assert.equal(m.satir.find(r => r.id === 'o19').n, 0); assert.equal(m.satir.find(r => r.id === 'o17').n, 0); assert.equal(m.satir.find(r => r.id === 'o18').n, 0); assert.equal(m.satir.find(r => r.id === 'o22').n, 0);
    // The same 14 Oct etüt is on the earlier exam's day in 1202 → 1203, so it does not count there.
    assert.equal(model(TUM, { pencere: 7 }).satir.find(r => r.id === 'o20').n, 0);
    // The lesson list of the pair lists Fizik too; its etüts count for Fizik only.
    m = model(TUM, { ders: 'Fizik' }); assert.equal(m.ders, 'Fizik'); assert.deepEqual(m.hocalar.map(h => h.ad), ['Sentetik Öğretmen F']);
    assert.equal(m.hocalar[0].alan.n, 2);
    // Students without both nets are left out (a Fizik-only record counts for Fizik alone); a grade's students stay with their grade.
    assert.equal(m.satir.length, 25); assert(m.satir.some(r => r.id === 'x2')); assert(!m.satir.some(r => r.id === 'x1' || r.id === 'x3'));
    assert.equal(model(TUM).satir.length, 24); assert(!model(TUM).satir.some(r => r.id.startsWith('x')));
    m = model(TUM, { duzey: 9 }); assert.equal(m.duzey, 9); assert.equal(m.durum, 'tamam'); assert.equal(m.satir.length, 1); assert.equal(m.kontrol.n, 0, 'the only 9. sınıf student took an etüt');
  });
  await check('TYT and AYT: a course named for one session counts for it only; the lesson’s net keys', () => {
    const ayt = { exams: [{ exam: 'X', date: '2026-10-07', session: 'AYT', nets: { edebiyat: 10, cografya1: 3, cografya2: 2.5, tarih1: 1 } }] }, ex = { key: 'X' };
    put('SA', ayt); assert.equal(get('ETUT_ETKI.netAl(SA,{key:"X"},"AYT","Türkçe")'), 10); assert.equal(get('ETUT_ETKI.netAl(SA,{key:"X"},"AYT","Coğrafya")'), 5.5); assert.equal(get('ETUT_ETKI.netAl(SA,{key:"X"},"AYT","Tarih")'), 1);
    assert.equal(get('ETUT_ETKI.netAl(SA,{key:"X"},"TYT","Türkçe")'), null, 'the exam has no TYT part'); assert.equal(get('ETUT_ETKI.netAl(SA,{key:"Y"},"AYT","Türkçe")'), null);
    assert.equal(get('ETUT_ETKI.etutOturum("MATEMATİK TYT","TYT")'), true); assert.equal(get('ETUT_ETKI.etutOturum("MATEMATİK TYT","AYT")'), false);
    assert.equal(get('ETUT_ETKI.etutOturum("MATEMATİK AYT","AYT")'), true); assert.equal(get('ETUT_ETKI.etutOturum("Matematik","AYT")'), true); assert.equal(get('ETUT_ETKI.etutOturum("TÜRK DİLİ VE EDEBİYATI","TYT")'), true);
  });
  await check('the interval and the too-few flag: the difference of the mean changes with a Student’s t half-width', () => {
    const m = model(TUM), ha = m.hocalar.find(h => h.ad === 'Sentetik Öğretmen A');
    const a = delta(range(1, 10)), k = delta(range(17, 24)), sd = x => { const mu = mean(x); return Math.sqrt(x.reduce((t, v) => t + (v - mu) ** 2, 0) / (x.length - 1)); };
    const se = Math.sqrt(sd(a) ** 2 / a.length + sd(k) ** 2 / k.length), t = 2.36;   // df = min(10, 8) − 1 = 7
    assert.equal(ha.yari, r2(t * se)); assert.equal(ha.yeterli, true); assert.equal(ha.anlamli, Math.abs(ha.fark) > ha.yari);
    assert.equal(ha.anlamli, true, 'a 2.5-net lead on a 0.2-net spread is clear');
    // A teacher with three students: too few (the flag stays off, the difference is still shown).
    const kucuk = TUM.map(s => ({ ...s, sessions: (s.sessions || []).filter(x => x.teacher !== B || ['o11', 'o12', 'o13'].includes(s.id)) }));
    const mk = model(kucuk), hb = mk.hocalar.find(h => h.ad === 'Sentetik Öğretmen B');
    assert.equal(hb.alan.n, 3); assert.equal(hb.yeterli, false); assert.equal(hb.anlamli, false); assert.notEqual(hb.fark, null);
    // Without anyone outside etüt, or without any etüt, no comparison.
    const hepsi = TUM.map(s => ({ ...s, sessions: oturum(0, MAT, A, '2026-10-16') }));
    const mh = model(hepsi); assert.equal(mh.kontrol.n, 0); assert.equal(mh.hocalar[0].fark, null); assert.equal(mh.hocalar[0].yari, null);
    assert.equal(model(TUM.map(s => ({ ...s, sessions: [] }))).durum, 'etutyok');
  });
  await check('every exam pair: each teacher’s difference per exam and its mean weighted by the students', () => {
    const m = model(TUM), s = m.seri;
    assert.deepEqual(s.sinavlar.map(e => e.ad), ['27-YKS-1202', '27-YKS-1203']); assert.deepEqual(s.sinavlar.map(e => e.onceki), ['27-YKS-1201', '27-YKS-1202']);
    const ha = s.satirlar.find(r => r.ad === 'Sentetik Öğretmen A');
    assert.equal(ha.hucre[0], null, 'no etüt in 8–13 Oct'); assert.equal(ha.hucre[1].fark, m.hocalar.find(h => h.ad === 'Sentetik Öğretmen A').fark); assert.equal(ha.hucre[1].n, 10); assert.equal(ha.hucre[1].k, 8);
    assert.equal(ha.ort, ha.hucre[1].fark); assert.equal(ha.n, 10);
    assert.deepEqual(s.satirlar.map(r => r.ad), ['Sentetik Öğretmen A', 'Sentetik Öğretmen B', 'Sentetik Öğretmen C'], 'C only in 1201 → 1202 (the 10 Oct etüt)'); assert.equal(s.satirlar[2].hucre[1], null);
    // Two pairs with etüts: the mean is weighted by the students who took etüt.
    const ek = OGR.map(s2 => { const i = Number(s2.id.slice(1)); return i >= 17 && i <= 24 ? s2 : { ...s2, sessions: [...s2.sessions, ...oturum(0, MAT, A, '2026-10-09')] }; });
    const m2 = model(ek, { pencere: 7 }), r = m2.seri.satirlar.find(x => x.ad === 'Sentetik Öğretmen A'), [x0, x1] = r.hucre;
    assert(x0 && x0.fark !== null && x1 && x1.fark !== null); assert.equal(r.n, x0.n + x1.n); assert.equal(r.ort, r2((x0.fark * x0.n + x1.fark * x1.n) / (x0.n + x1.n)));
  });
  await check('page: sentence, cards, the teacher and etüt-count tables, the figure per exam, the students and the notes', () => {
    merged(TUM); let h = run('ETUT_ETKI.icerik()');
    const cumle = /<p class="et-cumle">(.*?)<\/p>/.exec(h)[1].replace(/<[^>]+>/g, '');
    const m = model(TUM), f = x => x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), ok = v => (v > 0 ? '▲' : v < 0 ? '▼' : '') + f(Math.abs(v));
    assert.equal(cumle, '27-YKS-1202 → 27-YKS-1203 (14 Eki → 21 Eki) · Matematik · son 7 günde etüt alan 16 öğrencinin neti ' + ok(m.hepsi.alan.ort) + ' (önceki ' + f(m.hepsi.alan.once) + '), almayan 8 öğrencinin neti ' + ok(m.kontrol.ort) +
      ' (önceki ' + f(m.kontrol.once) + '): fark ' + (m.hepsi.fark > 0 ? '+' : '−') + f(Math.abs(m.hepsi.fark)) + ' net.');
    assert.match(h, /<h2>Öğretmenlere göre · Matematik<\/h2>/); assert.match(h, /Herhangi bir etüt/); assert.match(h, /class="ee-ad" data-ee-hoca="SENTETİK ÖĞRETMEN A" aria-pressed="false">Sentetik Öğretmen A<\/button>/);
    assert.match(h, /id="eeDoz"/); assert.match(h, /3 ve üstü/); assert.match(h, /id="eeSeri"/); assert.match(h, /Denemeler boyunca · Matematik/); assert.match(h, /id="eeOgrenciler"/); assert.match(h, /Etüt alan öğrenciler · Matematik/);
    assert.match(h, /id="eeNot"/); assert.match(h, /kesin neden-sonuç değil/);
    assert.match(h, /<option value="Matematik" selected>Matematik · \d+ etüt<\/option>/); assert.match(h, /<select id="eeSimdi"/); assert.match(h, /<select id="eeOnceki"/); assert.match(h, /data-ee-pencere="7" aria-pressed="true"/); assert.match(h, /data-ee-pencere="0"/);
    assert.match(h, /data-ee-duzey="12" aria-pressed="true"/); assert.match(h, /data-ee-oturum="TYT" aria-pressed="true"/); assert.match(h, /data-ee-oturum="AYT"[^>]*disabled/);
    assert.equal((h.match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 16, 'the students who took an etüt');
    assert(!h.includes('NaN') && !h.includes('undefined') && !h.includes('Sentetik Eksik'));
    // A teacher filters the students to those who took that teacher’s etüts; pressing again clears it.
    run("EK.eeHoca='SENTETİK ÖĞRETMEN B'"); h = run('ETUT_ETKI.icerik()');
    assert.equal((h.match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 8); assert.match(h, /Etüt alan öğrenciler · Matematik · Sentetik Öğretmen B/); assert.match(h, /data-ee-hoca="">Tüm öğretmenler/); assert.match(h, /<tr class="secili">/);
    run("EK.eeHoca='YOK'"); assert.equal((run('ETUT_ETKI.icerik()').match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 16, 'an unknown teacher clears the filter');
    // Choices: Fizik, the 14-day window and another pair.
    run("EK.eeHoca=undefined;EK.eeDers='Fizik';EK.eePencere=14;EK.eeOnceki='27-YKS-1201'"); h = run('ETUT_ETKI.icerik()');
    assert.match(h, /<h2>Öğretmenlere göre · Fizik<\/h2>/); assert.match(h, /son 14 günde/); assert.match(h, /data-ee-pencere="14" aria-pressed="true"/);
    // Names are escaped.
    run('EK.eeDers=EK.eePencere=EK.eeOnceki=undefined'); merged(TUM.map(s => s.id === 'o1' ? { ...s, name: 'SENTETİK <ÖĞRENCİ> "1"' } : s)); h = run('ETUT_ETKI.icerik()'); assert(!h.includes('<öğrenci>')); assert.match(h, /&lt;öğrenci&gt;/);
  });
  await check('page states: no data, one exam only, no etüt between the exams, a failing merge', () => {
    merged([]); let h = run('ETUT_ETKI.icerik()'); assert.match(h, /Henüz veri yok/); assert.match(h, /data-sekme="siralamalar"/); assert.match(h, /data-sekme="etutler"/);
    merged([OGR[0]].map(s => ({ ...s, exams: s.exams.slice(0, 1) }))); h = run('ETUT_ETKI.icerik()'); assert.match(h, /İki deneme gerekli/);
    merged(OGR.map(s => ({ ...s, sessions: [] }))); h = run('ETUT_ETKI.icerik()'); assert.match(h, /Bu iki deneme arasında etüt kaydı yok/); assert.match(h, /27-YKS-1202 → 27-YKS-1203/); assert(!h.includes('id="eeHocalar"')); assert.match(h, /<select id="eeSimdi"/, 'the pair can still be changed'); assert(!h.includes('id="eeDers"'));
    run("OGRENCI_RAPOR.model=()=>{throw new Error('Rapor okunamadı.')}"); h = run('ETUT_ETKI.icerik()'); assert.match(h, /<p class="et-uyari">Rapor okunamadı\.<\/p>/);
    // More than one grade: the grade switch; the default is the grade with the most etüts.
    merged(TUM); assert.match(run('ETUT_ETKI.icerik()'), /data-ee-duzey="9" aria-pressed="false"/);
  });
  await check('menu, viewing teacher and privacy: under Öğrenciler, rehber only, nothing stored or sent to students', () => {
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='ogrenciler')[1]"), ['takip', 'etutler', 'etutetki', 'etutplani', 'yoklama', 'ogrencirapor']);
    assert.equal(get("SEKME_REHBER.some(s=>s[0]==='etutetki'&&s[1]==='Etüt etkisi')"), true); assert.equal(get("SEKME_OGRENCI.some(s=>s[0]==='etutetki')"), false);
    run("D.rol='ogrenci'"); assert.match(run('gorunumEtutEtki()'), /rehber öğretmen içindir/); run("D.rol='rehber'");
    // Reading the page changes nothing in the notebook and keeps nothing: the choices live in EK only.
    merged(TUM); const once = run('JSON.stringify(D)'); run('ETUT_ETKI.icerik();ETUT_ETKI.gorunum()'); assert.equal(run('JSON.stringify(D)'), once); assert.equal(get("Object.keys(D).includes('etutEtki')||Object.keys(D).includes('etkisi')"), false);
    // The viewing teacher sees the page as well (it only reads).
    run('yalnizcaGoruntuleme=()=>true'); assert.match(run('ETUT_ETKI.gorunum()'), /<div id="eeKok">[\s\S]*Öğretmenlere göre/);
  });
  console.log(passed + ' Etüt etkisi checks passed');
})();
