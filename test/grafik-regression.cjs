#!/usr/bin/env node
'use strict';
// The charts' shared code (src/grafik.js): köşeli and yumuşak lines, and the measuring helper's ranges
// and snapping. The pages' own use of it is in etut-regression.cjs and denemepano-regression.cjs.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const a = html.indexOf('// BEGIN GRAFIK'), b = html.indexOf('// END GRAFIK');
assert(a > 0 && b > a && a < html.indexOf('// BEGIN ETUTLER'), 'embedded ahead of Etütler');
const kayit = {};
const sandbox = {Math, Number, String, localStorage:{getItem:k => kayit[k] ?? null, setItem:(k, v) => { kayit[k] = String(v); }}};
vm.createContext(sandbox); new vm.Script(html.slice(a, b) + ';this.C=GRAFIK_CIZGI;this.O=GRAFIK_OLCUM;').runInContext(sandbox);
const {C, O} = sandbox;
let passed = 0;
function check(name, fn) { try { fn(); passed++; console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } }
// Every cubic of a path: [start, control 1, control 2, end].
const kubikler = d => { const out = []; let son = null;
  for (const [, k, t] of d.matchAll(/([MLC])([^MLC]+)/g)) { const s = t.split(',').map(Number), p = []; for (let i = 0; i < s.length; i += 2) p.push([s[i], s[i + 1]]);
    if (k === 'C') out.push([son, ...p]); son = p[p.length - 1]; }
  return out; };

check('köşeli by default: straight segments, as before', () => {
  assert.equal(C.tur(), 'kose');
  assert.equal(C.yol([[0, 0], [10, 5.04], [20, 0]]), 'M0,0L10,5L20,0');
  assert.equal(C.yol([]), '');
});
check('yumuşak: a curve through every point that never overshoots them; the choice is remembered', () => {
  C.sec('yumusak'); assert.equal(C.tur(), 'yumusak'); assert.equal(kayit.yks_grafik_cizgi, 'yumusak');
  const pts = [[0, 100], [10, 100], [20, 40], [30, 40], [40, 70], [50, 0]], d = C.yol(pts);
  assert(d.startsWith('M0,100C') && !/NaN|undefined/.test(d));
  const k = kubikler(d); assert.equal(k.length, pts.length - 1);
  k.forEach(([s, c1, c2, e], i) => {
    assert.deepEqual([s, e], [pts[i], pts[i + 1]], 'passes through the points');
    const lo = Math.min(s[1], e[1]), hi = Math.max(s[1], e[1]);
    for (const c of [c1, c2]) assert(c[1] >= lo - 1e-9 && c[1] <= hi + 1e-9 && c[0] >= s[0] && c[0] <= e[0], 'stays within its segment: ' + JSON.stringify([s, c, e]));
  });
  assert.equal(C.yol([[0, 0], [10, 5]]), 'M0,0L10,5', 'two points stay straight');
  C.sec('başka'); assert.equal(C.tur(), 'kose', 'anything else is köşeli');
});
check('yumuşak: a band (far side drawn back) and a vertical step are joined straight, each side curved', () => {
  C.sec('yumusak');
  const ust = [[0, 10], [10, 20], [20, 15]], alt = [[20, 40], [10, 50], [0, 45]], d = C.yol(ust.concat(alt));
  assert(!/NaN|Infinity/.test(d)); assert(d.includes('L20,40'), 'the step down at the right end');
  assert.equal(kubikler(d).length, 4, 'both sides curved');
  C.sec('kose');
});
check('measuring: the periods of a range, and snapping to the nearest point with a value', () => {
  assert.deepEqual([...O.aralik([100, 107, 114], 7, 105, 110)], [0, 1], 'weeks meeting the days');
  assert.deepEqual([...O.aralik([0, 1, 2, 3], 1, 2, 2)], [2, 2], 'one exam');
  assert.equal(O.aralik([100, 107], 7, 200, 210), null);
  const b = {xs:[0, 1, 2, 3, 4], deger:[null, 5, null, null, 7]};
  assert.deepEqual([0, 1, 2, 3, 4, 9, -1].map(i => O.yer(b, i)), [1, 1, 1, 4, 4, 4, -1]);
  assert.equal(O.olcuyor(), false); assert.equal(O.durum, null);
});
console.log(passed + ' shared chart checks passed');
