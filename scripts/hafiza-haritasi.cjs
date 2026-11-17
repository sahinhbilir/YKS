// Review files for a connected-memory map draft (data/hafiza-haritasi-*.json):
//   <out>/…-baglar.csv   one row per link: foundation, topic using it, use level, reason (edit and send back)
//   <out>/…-konular.csv  one row per topic: expected YKS questions, pattern, weighted users, foundational, importance
//   <out>/…-harita.html  the map drawn as a picture (foundations left, topics using them right), and when the map has
//                        more than one subject, …-harita-<geo|tyt|ayt|fiz>.html, one picture per subject
// Usage: node scripts/hafiza-haritasi.cjs data/hafiza-haritasi-pilot.json <out-dir>
const fs = require('fs'), path = require('path'), vm = require('vm');
const [girdiYolu, cikti] = process.argv.slice(2);
if (!girdiYolu || !cikti) { console.error('usage: node scripts/hafiza-haritasi.cjs <map.json> <out-dir>'); process.exit(1); }
const ctx = vm.createContext({Math, JSON, Object, Array, Map, Set, Number, String, Error});
new vm.Script(fs.readFileSync(path.join(__dirname, '..', 'src', 'hafiza-ag.js'), 'utf8') + '\n;this.HAFIZA_AG = HAFIZA_AG;').runInContext(ctx);
const H = ctx.HAFIZA_AG, harita = JSON.parse(fs.readFileSync(girdiYolu, 'utf8'));
const ad = path.basename(girdiYolu, '.json'), byId = new Map(harita.konular.map(k => [k.id, k]));

// Expected questions per topic: each exam row's recency-weighted expectation × the topic's share of it.
const soru = new Map(), desen = new Map();
for (const r of harita.sinavSatirlari || []) {
  const b = H.soruBeklentisi(r.yillar);
  for (const [id, pay] of Object.entries(r.paylar)) {
    if (!byId.has(id)) throw new Error('unknown topic in exam row ' + r.konu + ': ' + id);
    soru.set(id, (soru.get(id) || 0) + pay * b.beklenen);
    (desen.get(id) || desen.set(id, []).get(id)).push(r.sinav + ' ' + r.konu + ' ×' + pay + ': ' + b.desen);
  }
}
const konular = harita.konular.map(k => Object.assign({}, k, {soru: soru.get(k.id) || 0}));
const ag = H.agKur(konular, harita.baglar);
if (ag.uyarilar.length) throw new Error('map problems:\n' + ag.uyarilar.join('\n'));
const out = H.hesapla({konular, baglar: harita.baglar, sonuclar: [], bugun: 0}, {fsrs: {}});
const satir = new Map(out.konular.map(s => [s.id, s]));
const kul = {az: 'az (0,25)', cok: 'çok (0,5)', tam: 'tam (1)'};
const csv = rows => rows.map(r => r.map(v => { const t = String(v ?? ''); return /[",;\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(';')).join('\n') + '\n';
const sayi = (x, n = 2) => x.toFixed(n).replace('.', ',');
const etiket = k => k.ad + (k.gizli ? ' [parça: ' + byId.get(k.parcasi).ad + ']' : '');
fs.mkdirSync(cikti, {recursive: true});
fs.writeFileSync(path.join(cikti, ad + '-baglar.csv'), '﻿' + csv([['Temel (B)', 'Ders', 'Kullanan (A)', 'Ders', 'A, B\'nin ne kadarını kullanıyor', 'Gerekçe', 'Düzeltme']]
  .concat(harita.baglar.filter(b => (b.tur || 'kullanir') === 'kullanir').map(b => [etiket(byId.get(b.alt)), byId.get(b.alt).ders, etiket(byId.get(b.ust)), byId.get(b.ust).ders, kul[b.kullanim], b.gerekce, '']))));
fs.writeFileSync(path.join(cikti, ad + '-konular.csv'), '﻿' + csv([['Konu', 'Ders', 'Gizli parça', 'Yılda beklenen YKS sorusu', 'Kaynak ve desen', 'Kullananlar (ağırlıklı)', 'Temel mi (≥ ' + String(H.AYAR.temelEsik).replace('.', ',') + ')', 'Önem', 'Düzeltme']]
  .concat(konular.map(k => { const s = satir.get(k.id); return [k.ad, k.ders, k.gizli ? 'evet, ' + byId.get(k.parcasi).ad + ' içinde' : '', sayi(k.soru), (desen.get(k.id) || ['sınav satırı yok']).join(' | '), sayi(s.kullananAgirlik), s.temel ? 'evet' : 'hayır', sayi(s.onem), '']; })
  .sort((a, b) => parseFloat(b[7].replace(',', '.')) - parseFloat(a[7].replace(',', '.'))))));

// ---- picture: one for the whole map and one per subject. Layers by longest path from foundations (inside the drawn
// set); order inside a layer by the mean position of neighbours. In a subject picture, foundations from other subjects
// are listed under the topic and the topics in other subjects that use it are counted.
const DERS = ['Geometri', 'Matematik TYT', 'Matematik AYT', 'Fizik'];
const RENK = {'Geometri': '#2a7f62', 'Matematik TYT': '#8a5cc2', 'Matematik AYT': '#2f6db5', 'Fizik': '#c2602f'};
const KISA = {'Geometri': 'Geo', 'Matematik TYT': 'TYT', 'Matematik AYT': 'AYT', 'Fizik': 'Fiz'};
const tumKenar = [];
ag.asagi.forEach((l, ust) => l.forEach(e => tumKenar.push({alt: e.id, ust, u: e.u, ic: e.ic})));
const enBuyuk = Math.max(...out.konular.map(s => s.onem), 1);
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const kisalt = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;
function resim(ids, baslik, dosya) {
  const icinde = id => ids.has(id), kenar = tumKenar.filter(e => icinde(e.alt) && icinde(e.ust)), alt = id => kenar.filter(e => e.ust === id);
  const disTemel = id => tumKenar.filter(e => e.ust === id && !icinde(e.alt)), disKullanan = id => tumKenar.filter(e => e.alt === id && !icinde(e.ust));
  const derin = new Map(); const d = id => { if (derin.has(id)) return derin.get(id); derin.set(id, 0); const v = Math.max(0, ...alt(id).map(e => d(e.alt) + 1)); derin.set(id, v); return v; };
  const liste = konular.filter(k => icinde(k.id)); liste.forEach(k => d(k.id));
  const katman = []; liste.forEach(k => { (katman[derin.get(k.id)] ||= []).push(k.id); });
  katman.forEach(l => l.sort((a, b) => DERS.indexOf(byId.get(a).ders) - DERS.indexOf(byId.get(b).ders)));
  const yer = () => { const m = new Map(); katman.forEach(l => l.forEach((id, i) => m.set(id, i - (l.length - 1) / 2))); return m; };
  for (let tur = 0; tur < 8; tur++) {
    const m = yer();
    katman.forEach(l => { const ort = id => { const k = kenar.filter(e => e.alt === id || e.ust === id).map(e => m.get(e.alt === id ? e.ust : e.alt)); return k.length ? k.reduce((a, b) => a + b, 0) / k.length : m.get(id); };
      const o = new Map(l.map(id => [id, ort(id)])); l.sort((a, b) => o.get(a) - o.get(b)); });
  }
  const tek = ids.size < byId.size, SW = 320, SH = tek ? 80 : 64, PAD = 40, maxN = Math.max(...katman.map(l => l.length)), w = 275;
  const W = Math.max(PAD * 2 + katman.length * SW, 1100), Hh = PAD * 2 + maxN * SH + 70;
  const pos = new Map(); katman.forEach((l, x) => l.forEach((id, i) => pos.set(id, {x: PAD + x * SW + 10, y: PAD + 60 + (maxN - l.length) * SH / 2 + i * SH})));
  let svg = '';
  for (const e of kenar) {
    const a = pos.get(e.alt), b = pos.get(e.ust), x1 = a.x + w, y1 = a.y + 20, x2 = b.x, y2 = b.y + 20, mx = (x1 + x2) / 2;
    svg += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="${e.ic ? '#999' : RENK[byId.get(e.ust).ders]}" stroke-opacity="${e.ic ? 0.9 : 0.55}" stroke-width="${e.ic ? 1.5 : 1 + e.u * 5}"${e.ic ? ' stroke-dasharray="4 3"' : ''} marker-end="url(#ok)"/>`;
  }
  for (const k of liste) {
    const p = pos.get(k.id), s = satir.get(k.id), dt = tek ? disTemel(k.id) : [], dk = tek ? disKullanan(k.id) : [], h = (k.gizli ? 30 : 34 + 10 * (s.onem / enBuyuk)) + (dt.length ? 13 : 0);
    const dis = dt.map(e => KISA[byId.get(e.alt).ders] + ': ' + byId.get(e.alt).ad).join(', ');
    svg += `<g><rect x="${p.x}" y="${p.y + 20 - h / 2 + (dt.length ? 6 : 0)}" width="${w}" height="${h}" rx="8" fill="${k.gizli ? '#fff' : RENK[k.ders]}" fill-opacity="${k.gizli ? 1 : 0.14}" stroke="${RENK[k.ders]}" stroke-width="${s.temel ? 2.6 : 1.2}"${k.gizli ? ' stroke-dasharray="5 3"' : ''}/>`
      + `<text x="${p.x + 8}" y="${p.y + 17}" font-size="12" font-weight="${s.temel ? 700 : 500}" fill="#1d1d1f">${esc(kisalt(k.ad, 42))}</text>`
      + `<text x="${p.x + 8}" y="${p.y + 31}" font-size="10" fill="#555">${k.gizli ? 'parça · ' : ''}${sayi(k.soru, 1)} soru/yıl · önem ${sayi(s.onem, 1)}${s.temel ? ' · TEMEL' : ''}${dk.length ? ' · ' + dk.length + ' dış kullanan' : ''}</text>`
      + (dt.length ? `<text x="${p.x + 8}" y="${p.y + 44}" font-size="9.5" fill="#777">⟵ ${esc(kisalt(dis, 58))}</text>` : '') + '</g>';
  }
  const lejant = (tek ? `<text x="${PAD}" y="${PAD + 2}" font-size="16" font-weight="700" fill="${RENK[baslik]}">${esc(baslik)}</text>` : DERS.map((dd, i) => `<rect x="${PAD + i * 150}" y="${PAD - 10}" width="14" height="14" rx="3" fill="${RENK[dd]}"/><text x="${PAD + i * 150 + 20}" y="${PAD + 2}" font-size="13">${dd}</text>`).join(''))
    + `<text x="${PAD + (tek ? 180 : 620)}" y="${PAD + 2}" font-size="12" fill="#444">Ok: temel → onu kullanan · kalınlık: az / çok / tam · kesik kutu: gizli parça · kalın kenar: temel konu · kutu boyu: önem${tek ? ' · ⟵ başka dersten temeller' : ''}</text>`;
  fs.writeFileSync(path.join(cikti, dosya), `<!doctype html><meta charset="utf-8"><title>${esc(baslik)}</title><body style="margin:0;background:#fff;font-family:system-ui,sans-serif">`
    + `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}"><defs><marker id="ok" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#777"/></marker></defs>${lejant}${svg}</svg></body>`);
  return {dosya, genislik: W, yukseklik: Hh};
}
const resimler = [resim(new Set(byId.keys()), ad, ad + '-harita.html')];
const dersler = DERS.filter(dd => konular.some(k => k.ders === dd));
if (dersler.length > 1) dersler.forEach(dd => resimler.push(resim(new Set(konular.filter(k => k.ders === dd).map(k => k.id)), dd, ad + '-harita-' + KISA[dd].toLowerCase() + '.html')));
console.log(JSON.stringify({konu: konular.length, bag: tumKenar.length, temel: out.konular.filter(s => s.temel).length, resimler}));
