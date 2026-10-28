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
sandbox.__yg = run('yalnizcaGoruntuleme'); sandbox.__rapor = run('OGRENCI_RAPOR.temelOgrenciler');
const reset = () => run(`yalnizcaGoruntuleme=__yg;OGRENCI_RAPOR.temelOgrenciler=__rapor;D=varsayilan();D.rol='rehber';D.ogr=[];EK.sekme='etutetki';
  for(const k of ['eeDuzey','eeOturum','eeDers','eeSimdi','eeOnceki','eePencere','eeHoca'])EK[k]=undefined;`);
const merged = (ogr, kapsam = null, warnings = []) => { put('__eeS', ogr); put('__eeKP', kapsam); put('__eeW', warnings); run('OGRENCI_RAPOR.temelOgrenciler=()=>({students:__eeS,warnings:__eeW,etutKapsam:__eeKP})'); };
const model = (ogr, sec = {}, kapsam = null) => { put('__eeS', ogr); put('__eeC', sec); put('__eeKP', kapsam); return get('ETUT_ETKI.model(__eeS,__eeC,__eeKP)'); };
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
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const delta = l => l.map(i => CHG[i]);

// An exam is its title and date; the old default pair (1202 → 1203, last 7 days) as a choice.
const K = i => E[i][0] + '|' + E[i][1], P7 = { onceki: K(1), pencere: 7 };
const gun = iso => run('gunNo("' + iso + '")');

(async () => {
  await check('defaults: the whole run (first exam → latest, every day between) and the groups over it', () => {
    const m = model(TUM);
    assert.equal(m.durum, 'tamam'); assert.deepEqual(m.duzeyler, [12, 9]); assert.equal(m.duzey, 12); assert.deepEqual(m.oturumlar, ['TYT']); assert.equal(m.oturum, 'TYT');
    assert.deepEqual(m.sinavlar.map(e => e.key), [K(0), K(1), K(2)]); assert.deepEqual(m.sinavlar.map(e => e.etiket), E.map(e => e[0]));
    assert.equal(m.onceki, 0); assert.equal(m.simdi, 2); assert.equal(m.pencere, 0);
    assert.deepEqual(m.dersler.map(d => d.ders), ['Matematik', 'Fizik']); assert.equal(m.ders, 'Matematik'); assert.equal(m.satir.length, 25, 'x1 has 1201 and 1203 though not 1202');
    // 8–20 Oct: the 10 Oct (C) and 14 Oct (A) etüts count; the exam days 7 and 21 Oct, Fizik and the AYT course do not.
    const kontrol = [17, 18, 19, 22, 23, 24], uzun = l => l.map(i => CHG[i] + 1);
    assert.equal(m.hepsi.alan.n, 19); assert.equal(m.kontrol.n, 6); assert.equal(m.kontrol.ort, r2(mean(uzun(kontrol))));
    assert.deepEqual(m.hocalar.map(h => [h.ad, h.alan.n, h.ortak]), [['Sentetik Öğretmen A', 12, 2], ['Sentetik Öğretmen B', 8, 2], ['Sentetik Öğretmen C', 1, 0]], 'students 4 and 8 also took B: counted in both rows, shown as overlap');
  });
  await check('one pair: the groups by teacher and by number of etüts against an independent calculation', () => {
    const m = model(TUM, P7);
    assert.equal(m.onceki, 1); assert.equal(m.simdi, 2); assert.equal(m.pencere, 7); assert.equal(m.satir.length, 24);
    const kontrol = range(17, 24), a = range(1, 10), b = [...range(11, 16), 4, 8], hepsi = [...range(1, 16)];
    assert.equal(m.kontrol.n, 8); assert.equal(m.kontrol.ort, r2(mean(delta(kontrol))));
    const ha = m.hocalar.find(h => h.ad === 'Sentetik Öğretmen A'), hb = m.hocalar.find(h => h.ad === 'Sentetik Öğretmen B');
    assert.deepEqual(m.hocalar.map(h => h.ad), ['Sentetik Öğretmen A', 'Sentetik Öğretmen B'], 'by number of students, no teacher for Fizik or the AYT course');
    assert.equal(ha.alan.n, 10); assert.equal(ha.alan.ort, r2(mean(delta(a)))); assert.equal(ha.fark, r2(mean(delta(a)) - mean(delta(kontrol))));
    assert.equal(ha.etut, r2((1 + 1 + 1 + 1 + 2 + 2 + 2 + 3 + 3 + 3) / 10), 'etüts of teacher A per student who took them'); assert.equal(ha.ortak, 2);
    assert.equal(hb.alan.n, 8); assert.equal(hb.alan.ort, r2(mean(delta(b)))); assert.equal(hb.fark, r2(mean(delta(b)) - mean(delta(kontrol))));
    assert.equal(m.hepsi.alan.n, 16); assert.equal(m.hepsi.alan.ort, r2(mean(delta(hepsi)))); assert.equal(m.hepsi.fark, r2(mean(delta(hepsi)) - mean(delta(kontrol))));
    const once = l => r2(mean(l.map(i => 10 + i * 0.3)));
    assert.equal(ha.alan.once, once(a)); assert.equal(m.kontrol.once, once(kontrol)); assert.equal(ha.alan.simdi, r2(mean(a.map(i => 10 + i * 0.3 + CHG[i]))));
    assert.deepEqual(m.doz.map(d => d.ad), ['0', '1', '2', '3 ve üstü']); assert.deepEqual(m.doz.map(d => d.n), [8, 9, 4, 3]);
    assert.equal(m.doz[1].ort, r2(mean(delta([1, 2, 3, ...range(11, 16)])))); assert.equal(m.doz[2].ort, r2(mean(delta([4, 5, 6, 7])))); assert.equal(m.doz[3].ort, r2(mean(delta([8, 9, 10]))));
    const s4 = m.satir.find(r => r.id === 'o4'); assert.equal(s4.n, 2); assert.deepEqual(Object.values(s4.hoca).sort(), [1, 1]); assert.equal(s4.fark, 2);
  });
  await check('window: 7 days, 14 days or all the days between the exams; exam days and other lessons never count', () => {
    const sec = { onceki: K(0), simdi: K(2) };
    let m = model(TUM, { ...sec, pencere: 7 }), c = m.satir.find(r => r.id === 'o21');
    assert.equal(c.n, 0, 'the 10 Oct etüt is before the 7-day window (15–20 Oct)'); assert.equal(m.kontrol.n, 8);
    m = model(TUM, { ...sec, pencere: 14 }); assert.equal(m.satir.find(r => r.id === 'o21').n, 1); assert.equal(m.satir.find(r => r.id === 'o20').n, 1); assert.equal(m.kontrol.n, 6);
    m = model(TUM, { ...sec, pencere: 0 }); assert.equal(m.satir.find(r => r.id === 'o21').n, 1); assert.equal(m.kontrol.n, 6);
    assert.equal(m.hocalar.find(h => h.ad === 'Sentetik Öğretmen C').alan.n, 1);
    for (const id of ['o19', 'o17', 'o18', 'o22']) assert.equal(m.satir.find(r => r.id === id).n, 0, id + ': exam day, another lesson or an AYT-only course');
    assert.equal(model(TUM, P7).satir.find(r => r.id === 'o20').n, 0, 'the 14 Oct etüt falls on the earlier exam’s day in 1202 → 1203');
    m = model(TUM, { ders: 'Fizik' }); assert.equal(m.ders, 'Fizik'); assert.deepEqual(m.hocalar.map(h => h.ad), ['Sentetik Öğretmen F']); assert.equal(m.hocalar[0].alan.n, 2);
    assert.equal(m.satir.length, 25); assert(m.satir.some(r => r.id === 'x2')); assert(!m.satir.some(r => r.id === 'x1' || r.id === 'x3'));
    m = model(TUM, { duzey: 9 }); assert.equal(m.duzey, 9); assert.equal(m.satir.length, 1); assert.equal(m.kontrol.n, 0);
  });
  await check('TYT and AYT: a course named for one session counts for it only; the lesson’s net keys', () => {
    put('SA', { exams: [{ exam: 'X', date: '2026-10-07', session: 'AYT', nets: { edebiyat: 10, cografya1: 3, cografya2: 2.5, tarih1: 1 } }] });
    const net = (k, o, d) => get('ETUT_ETKI.netAl(SA,{key:"' + k + '"},"' + o + '","' + d + '")');
    assert.equal(net('X|2026-10-07', 'AYT', 'Türkçe'), 10); assert.equal(net('X|2026-10-07', 'AYT', 'Coğrafya'), 5.5); assert.equal(net('X|2026-10-07', 'AYT', 'Tarih'), 1);
    assert.equal(net('X|2026-10-07', 'TYT', 'Türkçe'), null); assert.equal(net('X|2026-10-14', 'AYT', 'Türkçe'), null, 'the same title on another date is another exam');
    assert.equal(get('ETUT_ETKI.etutOturum("MATEMATİK TYT","TYT")'), true); assert.equal(get('ETUT_ETKI.etutOturum("MATEMATİK TYT","AYT")'), false);
    assert.equal(get('ETUT_ETKI.etutOturum("MATEMATİK AYT","AYT")'), true); assert.equal(get('ETUT_ETKI.etutOturum("Matematik","AYT")'), true);
  });
  await check('exams with the same title on different dates stay apart and carry their dates', () => {
    const dates = ['2026-10-07', '2026-10-14', '2026-10-21'];
    const ogr = range(1, 12).map(i => ({ id: 'g' + i, name: 'SENTETİK GENEL ' + i, cls: '12/A', sessions: i <= 6 ? oturum(0, MAT, A, '2026-10-16') : [],
      exams: dates.map((date, k) => ({ exam: 'GENEL DENEME', date, session: 'TYT', nets: { mat: 10 + k * (i <= 6 ? 2 : 1) } })) }));
    const m = model(ogr);
    assert.equal(m.durum, 'tamam'); assert.equal(m.sinavlar.length, 3); assert.deepEqual(m.sinavlar.map(e => e.etiket), ['GENEL DENEME (7 Eki)', 'GENEL DENEME (14 Eki)', 'GENEL DENEME (21 Eki)']);
    assert.equal(m.hepsi.alan.n, 6); assert.equal(m.hepsi.fark, 2);
  });
  await check('the adjusted difference compares students of similar starting net; the raw one is beside it', () => {
    // Low starters rise +3, middle +2, high +1 whatever they do; most etüt takers start low.
    const yap = (alanlar) => range(1, 30).map(i => { const once = i <= 10 ? 5 : i <= 20 ? 10 : 15, chg = i <= 10 ? 3 : i <= 20 ? 2 : 1;
      return { id: 'b' + i, name: 'SENTETİK BANT ' + i, cls: '12/A', sessions: alanlar(i) ? oturum(0, MAT, A, '2026-10-09') : [],
        exams: [E[0], E[1]].map(([exam, date], k) => ({ exam, date, session: 'TYT', nets: { mat: once + k * chg } })) }; });
    let h = model(yap(i => i <= 8 || i === 11 || i === 12)).hepsi;
    assert.equal(h.alan.n, 10); assert.equal(h.fark, 1.2, 'raw: (8×3 + 2×2)/10 − (2×3 + 8×2 + 10×1)/20'); assert.equal(h.duz.fark, 0, 'within each third, takers and the rest rose alike');
    assert.equal(h.duz.kapsanan, 10); assert.equal(h.duz.yari, 0);
    // Thirds without anyone outside etüt cannot be compared; the page says how many takers were.
    h = model(yap(i => i <= 8 || i === 11 || i === 12 || i > 20)).hepsi;
    assert.equal(h.alan.n, 20); assert.equal(h.duz.kapsanan, 10); assert.equal(h.duz.fark, 0);
  });
  await check('the interval and the too-few flag; no verdict is drawn from them', () => {
    const m = model(TUM, P7), ha = m.hocalar.find(h => h.ad === 'Sentetik Öğretmen A');
    const a = delta(range(1, 10)), k = delta(range(17, 24)), sd = x => { const mu = mean(x); return Math.sqrt(x.reduce((t, v) => t + (v - mu) ** 2, 0) / (x.length - 1)); };
    const se = Math.sqrt(sd(a) ** 2 / a.length + sd(k) ** 2 / k.length);
    assert.equal(ha.yari, r2(2.36 * se), 'Student’s t, df = min(10, 8) − 1 = 7'); assert.equal(ha.yeterli, true); assert.equal(ha.anlamli, undefined);
    const kucuk = TUM.map(s => ({ ...s, sessions: (s.sessions || []).filter(x => x.teacher !== B || ['o11', 'o12', 'o13'].includes(s.id)) }));
    const hb = model(kucuk, P7).hocalar.find(h => h.ad === 'Sentetik Öğretmen B');
    assert.equal(hb.alan.n, 3); assert.equal(hb.yeterli, false); assert.notEqual(hb.fark, null);
    const mh = model(TUM.map(s => ({ ...s, sessions: oturum(0, MAT, A, '2026-10-16') })), P7);
    assert.equal(mh.kontrol.n, 0); assert.equal(mh.hocalar[0].fark, null); assert.equal(mh.hocalar[0].yari, null); assert.equal(mh.hocalar[0].duz.fark, null);
    assert.equal(model(TUM.map(s => ({ ...s, sessions: [] }))).durum, 'etutyok');
    merged(TUM); assert(!/belirgin/.test(run('ETUT_ETKI.icerik()')));
  });
  await check('every exam pair, the whole run, distinct students and observations (six students are not twelve)', () => {
    // Six students rise +3 in each of two intervals with an etüt before each exam; six others stay.
    const ogr = range(1, 12).map(i => ({ id: 'r' + i, name: 'SENTETİK ARALIK ' + i, cls: '12/A', sessions: i <= 6 ? oturum(0, MAT, A, '2026-10-09', '2026-10-16') : [],
      exams: E.map(([exam, date], k) => ({ exam, date, session: 'TYT', nets: { mat: 10 + (i <= 6 ? 3 * k : 0) } })) }));
    const r = model(ogr).seri.satirlar.find(x => x.ad === 'Sentetik Öğretmen A');
    assert.deepEqual(r.hucre.map(x => x.fark), [3, 3]); assert.equal(r.gozlem, 12); assert.equal(r.farkli, 6); assert.equal(r.ort, 3, 'the mean of the intervals');
    assert.equal(r.donem.fark, 6, 'the whole run: first exam against the latest'); assert.equal(r.donem.n, 6); assert.equal(r.donem.duz, 6);
    // The usual data: C only before 1202 (10 Oct), A and B before 1203; 14 Oct falls on the 1202 exam day.
    const s = model(TUM).seri;
    assert.deepEqual(s.sinavlar.map(e => [e.onceki, e.ad]), [['27-YKS-1201', '27-YKS-1202'], ['27-YKS-1202', '27-YKS-1203']]); assert.equal(s.ilk, '27-YKS-1201'); assert.equal(s.son, '27-YKS-1203');
    assert.deepEqual(s.satirlar.map(x => [x.ad, x.farkli]), [['Sentetik Öğretmen A', 10], ['Sentetik Öğretmen B', 8], ['Sentetik Öğretmen C', 1]]);
    assert.equal(s.satirlar[0].donem.n, 12, 'over the whole run A also has the 14 Oct etüt and x1 (no 1202 result)'); assert.equal(s.satirlar[2].hucre[1], null);
    // Two pairs with etüts: the interval mean is weighted by the takers and counts observations.
    const ek = OGR.map(s2 => { const i = Number(s2.id.slice(1)); return i >= 17 ? s2 : { ...s2, sessions: [...s2.sessions, ...oturum(0, MAT, A, '2026-10-09')] }; });
    const x = model(ek, { pencere: 7 }).seri.satirlar.find(y => y.ad === 'Sentetik Öğretmen A'), [x0, x1] = x.hucre;
    assert(x0 && x0.fark !== null && x1 && x1.fark !== null); assert.equal(x.gozlem, x0.n + x1.n); assert.equal(x.ort, r2((x0.fark * x0.n + x1.fark * x1.n) / (x0.n + x1.n)));
    assert.equal(x.farkli, 16);
  });
  await check('coverage: days no etüt report covers are counted and shown; matching warnings are shown', () => {
    const kap = [[gun('2026-10-15'), gun('2026-10-20')]];
    assert.equal(model(TUM, {}, kap).eksik, 5, '8, 9, 12, 13, 14 Oct are weekdays outside the report');
    assert.equal(model(TUM, P7, kap).eksik, 0); assert.equal(model(TUM).eksik, null, 'unknown coverage is not zero');
    merged(TUM, kap); let h = run('ETUT_ETKI.icerik()'); assert.match(h, /id="eeKapsam"[^>]*>Etüt raporları bu aralığın 5 iş gününü kapsamıyor/);
    merged(TUM, [[gun('2026-10-01'), gun('2026-10-31')]]); assert(!run('ETUT_ETKI.icerik()').includes('eeKapsam'));
    merged(TUM, null, ['SENTETİK ÇİFT: ad/şube birden fazla öğrenciye ait; kaydı eşleştirilmedi.']); h = run('ETUT_ETKI.icerik()');
    assert.match(h, /id="eeDurum">Eşleştirme: SENTETİK ÇİFT: ad\/şube birden fazla öğrenciye ait/);
  });
  await check('page: sentence, cards, tables, a teacher’s students and the choices', () => {
    merged(TUM); let h = run('ETUT_ETKI.icerik()');
    const cumle = /<p class="et-cumle">(.*?)<\/p>/.exec(h)[1].replace(/<[^>]+>/g, '');
    assert.match(cumle, /^27-YKS-1201 → 27-YKS-1203 \(7 Eki → 21 Eki\) · Matematik · iki deneme arasında etüt alan 19 öğrencinin neti ▲[\d,]+ \(başta [\d,]+\), almayan 6 öğrencinin ▲[\d,]+ \(başta [\d,]+\)\. Başlangıç netine göre fark [+−]?[\d,]+ net \(ham [+−][\d,]+\)\.$/);
    assert.match(h, /\d+ \/ 19 öğrenci karşılaştırılabildi/, 'most takers start lower than anyone without etüt');
    assert.match(h, /<h2>Öğretmenlere göre · Matematik<\/h2>/); assert.match(h, /Herhangi bir etüt/); assert.match(h, /<th class="sayi et-dar-gizle">Başka öğretmenden de<\/th>/);
    assert.match(h, /id="eeSeri"/); assert.match(h, /<th class="sayi">İlk → son<\/th>/); assert.match(h, /Aralık ortalaması/); assert.match(h, /Farklı öğrenci/); assert.match(h, /Gözlem/);
    assert.match(h, /id="eeDoz"/); assert.match(h, /id="eeOgrenciler"/); assert.match(h, /id="eeNot"/); assert.match(h, /tekrar eden farklara bakın/);
    assert.match(h, /data-ee-pencere="0" aria-pressed="true">Tüm aralık/); assert.match(h, /<select id="eeOnceki" aria-label="İlk">/); assert.match(h, /<select id="eeSimdi" aria-label="Son">/);
    assert.match(h, /data-ee-duzey="12" aria-pressed="true"/); assert.match(h, /data-ee-oturum="AYT"[^>]*disabled/);
    assert.equal((h.match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 18);
    assert(!h.includes('NaN') && !h.includes('undefined') && h.includes('Sentetik Eksik 1') && !h.includes('Sentetik Eksik 2'));
    run("EK.eeHoca='SENTETİK ÖĞRETMEN B'"); h = run('ETUT_ETKI.icerik()');
    assert.equal((h.match(/<tr><td class="tg-ad">Sentetik Öğrenci /g) || []).length, 8); assert.match(h, /Etüt alan öğrenciler · Matematik · Sentetik Öğretmen B/); assert.match(h, /<tr class="secili">/);
    run("EK.eeHoca=undefined;EK.eeDers='Fizik';EK.eePencere=14;EK.eeOnceki='" + K(1) + "'"); h = run('ETUT_ETKI.icerik()');
    assert.match(h, /<h2>Öğretmenlere göre · Fizik<\/h2>/); assert.match(h, /son 14 günde/); assert.match(h, /^[\s\S]*27-YKS-1202 → 27-YKS-1203/);
    run('EK.eeDers=EK.eePencere=EK.eeOnceki=undefined'); merged(TUM.map(s => s.id === 'o1' ? { ...s, name: 'SENTETİK <ÖĞRENCİ> "1"' } : s)); h = run('ETUT_ETKI.icerik()'); assert(!h.includes('<öğrenci>')); assert.match(h, /&lt;öğrenci&gt;/);
  });
  await check('page states: no data, one exam, no etüt in the run, an empty last pair keeps the history, a failing source', () => {
    merged([]); let h = run('ETUT_ETKI.icerik()'); assert.match(h, /Henüz veri yok/); assert.match(h, /data-sekme="siralamalar"/); assert.match(h, /data-sekme="etutler"/);
    merged([OGR[0]].map(s => ({ ...s, exams: s.exams.slice(0, 1) }))); h = run('ETUT_ETKI.icerik()'); assert.match(h, /İki deneme gerekli/);
    merged(OGR.map(s => ({ ...s, sessions: [] }))); h = run('ETUT_ETKI.icerik()'); assert.match(h, /Dönemde etüt kaydı yok/); assert.match(h, /27-YKS-1201 → 27-YKS-1203/); assert(!h.includes('id="eeHocalar"')); assert.match(h, /<select id="eeSimdi"/); assert(!h.includes('id="eeDers"'));
    // Etüts only before 1202: the pair 1202 → 1203 has none, yet the run's history stays.
    merged(OGR.map(s => ({ ...s, sessions: Number(s.id.slice(1)) <= 10 ? oturum(0, MAT, A, '2026-10-09') : [] }))); run("EK.eeOnceki='" + K(1) + "'"); h = run('ETUT_ETKI.icerik()');
    assert.match(h, /etüt alan öğrenci yok; aşağıda denemeler boyunca tablosu bütün dönemi gösterir/); assert.match(h, /id="eeSeri"/); assert.match(h, /Sentetik Öğretmen A/); assert(!h.includes('Dönemde etüt kaydı yok'));
    run('EK.eeOnceki=undefined;OGRENCI_RAPOR.temelOgrenciler=()=>{throw new Error("Rapor okunamadı.")}'); h = run('ETUT_ETKI.icerik()'); assert.match(h, /<p class="et-uyari">Rapor okunamadı\.<\/p>/);
    merged(TUM); assert.match(run('ETUT_ETKI.icerik()'), /data-ee-duzey="9" aria-pressed="false"/);
  });
  await check('menu, viewing teacher and privacy: under Öğrenciler, rehber only, nothing stored or sent to students', () => {
    assert.deepEqual(get("MENU_REHBER.find(m=>m[0]==='ogrenciler')[1]"), ['takip', 'etutler', 'etutetki', 'etutplani', 'yoklama', 'ogrencirapor']);
    assert.equal(get("SEKME_REHBER.some(s=>s[0]==='etutetki'&&s[1]==='Etüt etkisi')"), true); assert.equal(get("SEKME_OGRENCI.some(s=>s[0]==='etutetki')"), false);
    run("D.rol='ogrenci'"); assert.match(run('gorunumEtutEtki()'), /rehber öğretmen içindir/); run("D.rol='rehber'");
    merged(TUM); const once = run('JSON.stringify(D)'); run('ETUT_ETKI.icerik();ETUT_ETKI.gorunum()'); assert.equal(run('JSON.stringify(D)'), once);
    run('yalnizcaGoruntuleme=()=>true'); assert.match(run('ETUT_ETKI.gorunum()'), /<div id="eeKok">[\s\S]*Öğretmenlere göre/);
  });
  console.log(passed + ' Etüt etkisi checks passed');
})();
