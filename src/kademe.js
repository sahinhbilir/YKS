// Öğrenci kademeleri (ders başına). Embedded by scripts/embed-zorluk.cjs. See "Zorluk ve kademeler" in docs/yanlislar-defteri.md.
// Computed in memory on every draw from the results already in the notebook (denemeListe of every student); nothing is stored or sent.
//   a_se = logit((D + 0.5) / (n + 1)) − logit(m_e)   m_e = the mean of the cohort's (D + 0.5) / (n + 1) in that exam and ders
//   a_s  = Σ w a / Σ w   w = precision × 0.8^age   precision = n p (1 − p), age = the exam's index from the latest (AGIRLIK_KADEME; analiz.js's projection uses 0.5, tiers need precision)
//   Everything is per grade (sınıf): the equating cohort of an exam is that exam's takers of the same grade; edges, H and reliability are per (grade, oturum, ders).
//   SE   = √(Σ prec · r²) / Σ prec · r            (delta method, var(logit p) ≈ 1 / (n p (1 − p)))
//   G = SD_true / RMSE, SD_true² = SD_obs² − mean(SE²) (G = 0 when ≤ 0); H = floor((4G + 1) / 3) clamped to 3..6 (Wright & Masters 1982); reliability G²/(1+G²) < 0.5 -> dusuk
//   Tiers = Fisher–Jenks natural breaks of the abilities in the grade cohort (optimal 1-D partition into H groups, equal abilities never split; fewer distinct values than H -> fewer tiers). GVF = 1 − SDCM/SDAM.
//   A blank counts like a wrong answer (d is the number correct out of n).
const KADEME = (() => {
const logit = p => Math.log(p / (1 - p)), sig = z => 1 / (1 + Math.exp(-z));
const Z = 1.96, EN_AZ_OGRENCI = 8, EN_AZ_KOHORT = 5, AGIRLIK_KADEME = 0.8, GUVENIRLIK_ESIK = 0.5, H_ALT = 3, H_UST = 6;
const ort = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const yuzdelik = (s, p) => { const i = (s.length - 1) * p, a = Math.floor(i), b = Math.ceil(i); return s[a] + (s[b] - s[a]) * (i - a) };
const hK = s => String(s ?? '').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Z0-9]/gu, '');
const f2 = v => v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(2).replace('.', ',').replace('-', '−');
const esc = s => typeof kacis === 'function' ? kacis(String(s ?? '')) : String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/* ---- the report's section names -> Deneme ders codes ("TÜRKÇE-T" -> TYT turkce, "TARİH.1-A" -> AYT tarih1) ---- */
const KODLAR = {TURKCE: 'turkce', TURKDILIVEEDB: 'edebiyat', TURKDILIVEEDEBIYATI: 'edebiyat', EDEBIYAT: 'edebiyat', TARIH: 'tarih', TARIH1: 'tarih1', TARIH2: 'tarih2', COGRAFYA: 'cografya', COGRAFYA1: 'cografya1', COGRAFYA2: 'cografya2',
  FELSEFE: 'felsefe', FELSEFEGR: 'felsefe', FELSEFEGRUBU: 'felsefe', DINKULTURU: 'din', DINKULTURUVEAHLAKBILGISI: 'din', SFELSEFE: 'sf', EKFELSEFE: 'sf', SOSYALFELSEFE: 'sf', MATEMATIK: 'mat', GEOMETRI: 'geo', FIZIK: 'fizik', KIMYA: 'kimya', BIYOLOJI: 'biyoloji'};
function kodDers(ad) {
  const s = String(ad ?? '').trim(), m = /-([TA])$/iu.exec(s);
  if (!m) return null;
  const oturum = m[1].toUpperCase() === 'T' ? 'TYT' : 'AYT', kod = KODLAR[hK(s.slice(0, m.index))];
  return kod ? {oturum, kod} : null;
}
// Key of a ders in the model: 'TYT:mat@12' (grade 12); without a grade (plain hesapla input) 'TYT:mat'.
const anahtarDers = (oturum, kod, sinif) => oturum + ':' + kod + (sinif ? '@' + sinif : '');

// Number of statistically distinct strata from the person separation G (Wright & Masters 1982), kept within 3..6.
const katman = G => Math.max(H_ALT, Math.min(H_UST, Math.floor((4 * G + 1) / 3)));

// Tiers by natural breaks: the exact Fisher (1958) / Jenks (1977) optimal partition of the sorted abilities into H contiguous groups that minimises the within-group sum of squares
// (dynamic programming, O(H·n²)). Run on the distinct values with multiplicities, so equal abilities are never split; with fewer distinct values than H, H is that number (at least 1).
// Tier 1 = the strongest group. kenarlar = the H − 1 boundaries, descending, each the midpoint of the gap between the last student of one group and the first of the next.
// SDCM = sum of squared deviations from the class means (minimised; evaluating every break combination gives the same optimum), SDAM = from the overall mean; gvf = (SDAM − SDCM) / SDAM in 0..1 (1 when there is no variance).
function kademeAta(A, H) {
  const n = A.length, sira = A.map((a, i) => i).sort((x, y) => A[x] - A[y]), v = [], w = [], grup = new Array(n);
  sira.forEach(i => { if (v.length && Math.abs(A[i] - v[v.length - 1]) <= 1e-9) w[w.length - 1]++; else { v.push(A[i]); w.push(1) } grup[i] = v.length - 1 });
  const m = v.length, h = Math.max(1, Math.min(H, m)), W = [0], S = [0], Q = [0];
  for (let i = 0; i < m; i++) { W.push(W[i] + w[i]); S.push(S[i] + w[i] * v[i]); Q.push(Q[i] + w[i] * v[i] * v[i]) }
  const ssd = (i, j) => { const ww = W[j + 1] - W[i], ss = S[j + 1] - S[i]; return Math.max(0, Q[j + 1] - Q[i] - ss * ss / ww) };   // values i..j
  const D = [], P = [];
  for (let k = 0; k < h; k++) { D.push(new Array(m).fill(Infinity)); P.push(new Array(m).fill(0)) }
  for (let j = 0; j < m; j++) D[0][j] = ssd(0, j);
  for (let k = 1; k < h; k++) for (let j = k; j < m; j++) for (let i = k; i <= j; i++) { const c = D[k - 1][i - 1] + ssd(i, j); if (c < D[k][j]) { D[k][j] = c; P[k][j] = i } }
  const baslangic = new Array(h); let j = m - 1;
  for (let k = h - 1; k >= 0; k--) { baslangic[k] = k ? P[k][j] : 0; j = baslangic[k] - 1 }   // group k covers distinct values baslangic[k] .. next start − 1
  const gIdx = new Array(m); for (let k = 0; k < h; k++) for (let q = baslangic[k]; q < (k + 1 < h ? baslangic[k + 1] : m); q++) gIdx[q] = k;
  const t = grup.map(g => h - gIdx[g]);
  const kenarlar = []; for (let k = h - 1; k >= 1; k--) kenarlar.push((v[baslangic[k] - 1] + v[baslangic[k]]) / 2);
  const sdam = ssd(0, m - 1), sdcm = D[h - 1][m - 1], gvf = sdam > 1e-12 ? Math.min(1, Math.max(0, 1 - sdcm / sdam)) : 1;
  return {t, kenarlar, H: h, gvf};
}

/* ---- the computation ----
   kayitlar: [{ogr, sinif, sinav, tarih, ad, oturum, ders, d, n}] one row per student, exam and ders (n questions, d correct); sinif = the student's grade (optional). */
function hesapla(kayitlar) {
  const gruplar = new Map();
  for (const r of kayitlar) {
    if (!(r.n > 0) || !(r.d >= 0) || r.d > r.n) continue;
    const k = anahtarDers(r.oturum, r.ders, r.sinif);
    if (!gruplar.has(k)) gruplar.set(k, {oturum: r.oturum, kod: r.ders, sinif: r.sinif || null, sinavlar: new Map()});
    const g = gruplar.get(k);
    if (!g.sinavlar.has(r.sinav)) g.sinavlar.set(r.sinav, {id: r.sinav, tarih: r.tarih, ad: r.ad, satir: []});
    g.sinavlar.get(r.sinav).satir.push(r);
  }
  const dersler = new Map();
  for (const [k, g] of gruplar) {
    // Exams with too few takers cannot be equated; the others are ordered by date and aged from the latest.
    const sin = [...g.sinavlar.values()].filter(s => s.satir.length >= EN_AZ_KOHORT).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)) || String(a.id).localeCompare(String(b.id)));
    const kisi = new Map();
    sin.forEach((s, idx) => {
      const ph = s.satir.map(r => (r.d + 0.5) / (r.n + 1)), me = ort(ph), lm = logit(me), yas = sin.length - 1 - idx;
      s.satir.forEach((r, j) => {
        const p = ph[j], prec = r.n * p * (1 - p), a = logit(p) - lm, rec = Math.pow(AGIRLIK_KADEME, yas);
        if (!kisi.has(r.ogr)) kisi.set(r.ogr, {ogr: r.ogr, seri: [], sw: 0, swa: 0, swp: 0});
        const q = kisi.get(r.ogr);
        q.seri.push({sinav: s.id, ad: s.ad, tarih: s.tarih, a, se: 1 / Math.sqrt(prec), n: r.n, d: r.d});
        q.sw += prec * rec; q.swa += prec * rec * a; q.swp += prec * rec * rec;
      });
    });
    const ogrenciler = [...kisi.values()].map(q => ({ogr: q.ogr, seri: q.seri, a: q.swa / q.sw, se: Math.sqrt(q.swp) / q.sw}));
    const d = {key: k, oturum: g.oturum, kod: g.kod, sinif: g.sinif, n: ogrenciler.length, sinavSayisi: sin.length, ogrenciler: new Map(ogrenciler.map(o => [o.ogr, o])), yetersiz: true, dusuk: false, H: null, G: null, guvenirlik: null, kenarlar: []};
    dersler.set(k, d);
    if (ogrenciler.length < EN_AZ_OGRENCI) continue;
    const A = ogrenciler.map(o => o.a), m = ort(A), vobs = A.reduce((s, x) => s + (x - m) ** 2, 0) / (A.length - 1), mse = ort(ogrenciler.map(o => o.se * o.se)), vt = vobs - mse;
    d.sdGozlenen = Math.sqrt(vobs); d.rmse = Math.sqrt(mse);
    // Never dropped for low separation: SD_true² ≤ 0 gives G = 0, reliability 0 and H = 3; dusuk marks reliability < 0.5.
    const G = vt > 0 && mse > 0 ? Math.sqrt(vt) / Math.sqrt(mse) : 0, H = katman(G), guv = G * G / (1 + G * G);
    const {t: kt, kenarlar, H: He, gvf} = kademeAta(A, H);
    Object.assign(d, {yetersiz: false, dusuk: guv < GUVENIRLIK_ESIK, G, H: He, Hhedef: H, gvf, guvenirlik: guv, kenarlar});
    // tier of an ability value against the edges (descending): 1 + the number of edges above it
    const t = x => 1 + kenarlar.filter(e => x < e).length;
    ogrenciler.forEach((o, i) => {
      o.kademe = kt[i];
      // "?" only when a ± 1.96·SE spans three or more tiers; two adjacent tiers are within what the tier already tolerates.
      // A low-reliability ders is muted as a whole instead, so it gets no "?" at all.
      o.belirsiz = !d.dusuk && Math.abs(t(o.a - Z * o.se) - t(o.a + Z * o.se)) >= 2;
    });
  }
  return dersler;
}

/* ---- the notebook as records ---- */
function kayitlariTopla() {
  const out = [], kimlik = new Map();
  (D.ogr || []).forEach((o, si) => {
    if (!o || o.silindi) return;
    const id = String(o.no || '').trim() || 'i' + si;
    const sinif = denemeOrtSinifi(o);
    kimlik.set(id, {id, ad: o.ad, sube: o.sube || '', sinif, si});
    for (const r of denemeListe(si)) {
      if (r.tur !== 'TYT' && r.tur !== 'AYT') continue;
      const alan = r.id.startsWith('p:') ? o.alan : r.alan;
      if (!r.dersler.some(d => d.dogru + d.yanlis > 0)) continue;
      const sinav = denemeAdAnahtari(r.ad) + '|' + r.tarih + '|' + r.oturum;
      for (const d of r.dersler) {
        if (!denemeBolumSayilir(r, d.kod, alan)) continue;
        const std = DENEME_DERSLER[r.oturum].find(x => x[0] === d.kod);
        out.push({ogr: id, sinif, sinav, tarih: r.tarih, ad: r.ad, oturum: r.oturum, ders: d.kod, d: d.dogru, n: d.soru ?? std?.[2] ?? d.dogru + d.yanlis});
      }
    }
  });
  return {kayitlar: out, kimlik};
}
let ONBELLEK = {imza: null, m: null};
function model() {
  if (typeof D === 'undefined' || !Array.isArray(D.ogr)) return {dersler: new Map(), kimlik: new Map()};
  const imza = D.ogr.map((o, i) => !o || o.silindi ? '' : (o.no || '') + ':' + (o.sube || '') + ':' + (o.sinif || '') + ':' + (o.alan || '') + ':' + [...(o.denemeler || []), ...(o.denemeOkul || [])].map(r => r.id + '.' + r.ts + (r.silindi ? 'x' : '')).join(',')).join('|') + '#' + D.ogr.length;
  if (ONBELLEK.imza !== imza) { const t = kayitlariTopla(); ONBELLEK = {imza, m: {dersler: hesapla(t.kayitlar), kimlik: t.kimlik}} }
  return ONBELLEK.m;
}
// The ders of one grade; without a grade the student's own grade is used (looked up by no).
const dersBul = (sinif, oturum, kod) => model().dersler.get(anahtarDers(oturum, kod, sinif)) || null;
const ogrDers = (no, oturum, kod) => { const id = String(no ?? '').trim(), k = model().kimlik.get(id); return k ? {id, d: dersBul(k.sinif, oturum, kod)} : {id, d: null} };
const kimlikDers = (no, oturum, kod) => { const x = ogrDers(no, oturum, kod); return x.d?.ogrenciler.get(x.id) || null };
// The student's relative ability (logits above the cohort of the same exams and grade) in a ders, or null when there is no data or fewer than 8 students of the grade (Veri yetersiz).
// Low-reliability ders (dusuk) still have an ability.
// The student's tier and the ders's tier count, {kademe, H, dusuk}, or null without tiers (Veri yetersiz). Used by Kendi seviyesi in the defter.
const kademeBilgi = (no, oturum, kod) => { const x = ogrDers(no, oturum, kod), o = x.d && !x.d.yetersiz ? x.d.ogrenciler.get(x.id) : null; return o ? {kademe: o.kademe, H: x.d.H, dusuk: x.d.dusuk} : null };
const yetenek = (no, oturum, kod) => { const x = ogrDers(no, oturum, kod); return x.d && !x.d.yetersiz ? x.d.ogrenciler.get(x.id)?.a ?? null : null };

/* ---- screen ---- */
const KD = {oturum: 'TYT', sinif: null, sube: '', sira: '', secili: null};
const dersAdi = (oturum, kod) => (DENEME_DERSLER[oturum].find(d => d[0] === kod) || [kod, kod])[1];
const kademeYazi = (o, belirsiz) => o.kademe + (belirsiz ?? o.belirsiz ? '?' : '');
// One sequential hue: tier 1 (strongest) gets the deepest fill, the weakest tier the lightest, scaled by the ders's tier count H.
// Light text goes on the deep half (class kd-g), see kademe.css for the base colour and the contrast it was checked at.
const KD_DOLGU = [88, 12], KD_ACIK_ESIK = 67;
function hucreDolgu(t, H) {
  if (!(H >= 2)) return {pay: KD_DOLGU[1], acik: false};
  const pay = Math.round(KD_DOLGU[0] - (t - 1) / (H - 1) * (KD_DOLGU[0] - KD_DOLGU[1]));
  return {pay, acik: pay >= KD_ACIK_ESIK};
}
function sparkline(o, d) {
  const s = o.seri.slice().sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
  const W = 320, Hh = 84, L = 8, R = 8, T = 10, B = 14, vs = s.map(x => x.a).concat(d.yetersiz ? [] : d.kenarlar, [0]);
  const mn = Math.min(...vs), mx = Math.max(...vs), pad = (mx - mn || 1) * 0.1, lo = mn - pad, hi = mx + pad;
  const x = i => L + (s.length > 1 ? i / (s.length - 1) : 0.5) * (W - L - R), y = v => T + (hi - v) / (hi - lo) * (Hh - T - B), r1 = v => Math.round(v * 10) / 10;
  const kenar = d.yetersiz ? '' : d.kenarlar.map(e => '<line class="kd-kenar" x1="' + L + '" x2="' + (W - R) + '" y1="' + r1(y(e)) + '" y2="' + r1(y(e)) + '"/>').join('');
  return '<svg class="kd-iz" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="' + esc(dersAdi(d.oturum, d.kod) + ' yetenek eğilimi: ' + s.map(p => p.ad + ' ' + f2(p.a)).join(', ')) + '">' +
    '<line class="kd-sifir" x1="' + L + '" x2="' + (W - R) + '" y1="' + r1(y(0)) + '" y2="' + r1(y(0)) + '"/>' + kenar +
    (s.length > 1 ? '<polyline class="kd-cizgi" points="' + s.map((p, i) => r1(x(i)) + ',' + r1(y(p.a))).join(' ') + '"/>' : '') +
    s.map((p, i) => '<circle class="kd-nokta" cx="' + r1(x(i)) + '" cy="' + r1(y(p.a)) + '" r="3.5"><title>' + esc(p.ad + ' · ' + f2(p.a)) + '</title></circle>').join('') + '</svg>';
}
function panelIc() {
  const m = model(), siniflar = [...new Set([...m.dersler.values()].filter(d => d.n && d.sinif).map(d => d.sinif))].sort((a, b) => a - b);
  if (!siniflar.includes(KD.sinif)) { KD.sinif = siniflar.length ? siniflar[siniflar.length - 1] : null; KD.sube = ''; KD.sira = ''; KD.secili = null }
  const subeler = [...new Set([...m.kimlik.values()].filter(k => k.sinif === KD.sinif).map(k => k.sube).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr', {numeric: true}));
  if (KD.sube && !subeler.includes(KD.sube)) KD.sube = '';
  const dl = DENEME_DERSLER[KD.oturum].map(d => m.dersler.get(anahtarDers(KD.oturum, d[0], KD.sinif))).filter(d => d && d.n);
  const seg = (ad, deger, secenekler, etiket) => '<div class="et-seg" role="group" aria-label="' + etiket + '"><span class="et-seg-label">' + etiket + '</span>' +
    secenekler.map(([v, t]) => '<button type="button" data-kd-' + ad + '="' + esc(v) + '" aria-pressed="' + (deger === v) + '">' + esc(t) + '</button>').join('') + '</div>';
  const araclar = '<div class="et-arac">' + seg('oturum', KD.oturum, [['TYT', 'TYT'], ['AYT', 'AYT']], 'Oturum') + (siniflar.length ? seg('sinif', String(KD.sinif), siniflar.map(s => [String(s), String(s)]), 'Sınıf') : '') +
    '<label class="et-seg"><span class="et-seg-label">Şube</span><select data-kd-sube aria-label="Şube"><option value="">Tüm şubeler</option>' + subeler.map(s => '<option value="' + esc(s) + '"' + (s === KD.sube ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></label></div>';
  if (!dl.length) return '<div class="et-kart-bas"><h2>Kademeler</h2></div>' + araclar + '<p class="mini">Veri yetersiz</p>';
  const ogr = [...m.kimlik.values()].filter(k => k.sinif === KD.sinif && (!KD.sube || k.sube === KD.sube) && dl.some(d => d.ogrenciler.has(k.id)));
  const deger = (k, d) => d.ogrenciler.get(k.id)?.kademe ?? null;
  const sira = dl.find(d => d.key === KD.sira);
  const ad = (a, b) => a.sube.localeCompare(b.sube, 'tr', {numeric: true}) || String(a.ad).localeCompare(String(b.ad), 'tr');
  ogr.sort((a, b) => sira ? (deger(a, sira) ?? 99) - (deger(b, sira) ?? 99) || (sira.ogrenciler.get(b.id)?.a ?? -99) - (sira.ogrenciler.get(a.id)?.a ?? -99) || ad(a, b) : ad(a, b));
  const bas = dl.map(d => '<th scope="col" class="kd-ders"><button type="button" data-kd-sira="' + d.key + '" aria-pressed="' + (KD.sira === d.key) + '" aria-label="' + esc(dersAdi(d.oturum, d.kod) + ' derse göre sırala') + '"' + (d.yetersiz ? '' : ' title="' + esc(d.H + ' kademe · güvenilirlik ' + f2(d.guvenirlik) + ' · ayrışma uyumu ' + f2(d.gvf)) + '"') + '><b>' + esc(dersAdi(d.oturum, d.kod)) + '</b>' +
    (d.yetersiz ? '<span class="mini">Veri yetersiz</span>' : '<span class="mini">' + d.H + ' kademe · ' + (d.dusuk ? 'güvenilirlik düşük' : f2(d.guvenirlik)) + '</span>') + '</button></th>').join('');
  const sec = KD.secili && m.kimlik.has(KD.secili.id) ? KD.secili : null;
  const govde = ogr.map(k => '<tr><th scope="row">' + esc(k.ad) + ' <span class="mini">' + esc(k.sube) + '</span></th>' + dl.map(d => {
    const o = d.ogrenciler.get(k.id);
    if (!o || d.yetersiz) return '<td class="kd-hucre bos">—</td>';
    const on = sec && sec.id === k.id && sec.key === d.key;
    const dl = hucreDolgu(o.kademe, d.H);
    return '<td class="kd-hucre' + (dl.acik ? ' kd-g' : '') + (o.belirsiz ? ' kd-bel' : '') + (d.dusuk ? ' kd-dusuk' : '') + '" style="--kd:' + dl.pay + '%"><button type="button" data-kd-hucre="' + esc(k.id) + '|' + d.key + '" aria-pressed="' + on + '" aria-label="' + esc(k.ad + ', ' + dersAdi(d.oturum, d.kod) + ': ' + o.kademe + '. kademe' + (o.belirsiz ? ', belirsiz' : '') + (d.dusuk ? ', güvenilirlik düşük' : '')) + '">' + kademeYazi(o) + '</button></td>';
  }).join('') + '</tr>').join('');
  let detay = '';
  if (sec) {
    const d = m.dersler.get(sec.key), o = d && d.ogrenciler.get(sec.id), k = m.kimlik.get(sec.id);
    if (o) detay = '<div class="kd-detay"><div class="kd-detay-ust"><b>' + esc(k.ad) + '</b><span>' + esc(dersAdi(d.oturum, d.kod)) + (d.yetersiz ? '' : ' · ' + kademeYazi(o) + '. kademe / ' + d.H + (d.dusuk ? ' · güvenilirlik düşük' : '')) + '</span></div>' + sparkline(o, d) + '</div>';
  }
  return '<div class="et-kart-bas"><h2>Kademeler</h2><span class="mini">' + ogr.length + ' öğrenci</span></div>' + araclar +
    '<div class="et-kaydir"><table class="et-tablo kd-tablo"><thead><tr><th scope="col">Öğrenci</th>' + bas + '</tr></thead><tbody>' + govde + '</tbody></table></div>' + detay;
}
const panel = () => '<section class="et-panel" id="kdKok">' + panelIc() + '</section>';
function yenile(odak) { const el = typeof document !== 'undefined' && document.getElementById('kdKok'); if (!el) return; el.innerHTML = panelIc(); if (odak) el.querySelector(odak)?.focus() }
// A student's tier per ders as chips: "Matematik · 2. kademe / 4".
function ogrenciSatiri(si) {
  const o = D.ogr[si]; if (!o) return '';
  const id = String(o.no || '').trim() || 'i' + si, m = model(), sinif = denemeOrtSinifi(o), hap = [];
  for (const oturum of ['TYT', 'AYT']) for (const d of DENEME_DERSLER[oturum]) {
    const x = m.dersler.get(anahtarDers(oturum, d[0], sinif)), q = x && !x.yetersiz && x.ogrenciler.get(id);
    if (q) hap.push('<span class="kd-hap' + (x.dusuk ? ' kd-dusuk' : '') + '"' + (x.dusuk ? ' title="Güvenilirlik düşük"' : '') + '>' + (oturum === 'AYT' ? 'AYT ' : '') + esc(d[1]) + ' · ' + kademeYazi(q) + '. kademe / ' + x.H + '</span>');
  }
  return hap.length ? '<div class="kd-haplar" id="kdHaplar" role="list" aria-label="Kademeler">' + hap.join('') + '</div>' : '';
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', ev => {
    const el = ev.target.closest?.('#kdKok [data-kd-oturum],#kdKok [data-kd-sinif],#kdKok [data-kd-sira],#kdKok [data-kd-hucre]'); if (!el) return;
    if (el.dataset.kdOturum) { KD.oturum = el.dataset.kdOturum; KD.sira = ''; KD.secili = null; yenile('[data-kd-oturum="' + KD.oturum + '"]'); return }
    if (el.dataset.kdSinif) { KD.sinif = Number(el.dataset.kdSinif); KD.sube = ''; KD.sira = ''; KD.secili = null; yenile('[data-kd-sinif="' + KD.sinif + '"]'); return }
    if (el.dataset.kdSira) { KD.sira = KD.sira === el.dataset.kdSira ? '' : el.dataset.kdSira; yenile('[data-kd-sira="' + el.dataset.kdSira + '"]'); return }
    if (el.dataset.kdHucre) { const [id, key] = el.dataset.kdHucre.split('|'); KD.secili = KD.secili && KD.secili.id === id && KD.secili.key === key ? null : {id, key}; yenile('[data-kd-hucre="' + el.dataset.kdHucre.replace(/"/g, '') + '"]') }
  });
  document.addEventListener('change', ev => { if (ev.target.matches?.('#kdKok [data-kd-sube]')) { KD.sube = ev.target.value; yenile('[data-kd-sube]') } });
}
const durum = () => KD;
return {hesapla, katman, model, kodDers, yetenek, kademeBilgi, kademeAta, kimlikDers, dersBul, kayitlariTopla, panel, panelIc, ogrenciSatiri, sparkline, durum, anahtarDers, sig, EN_AZ_OGRENCI, EN_AZ_KOHORT, H_ALT, H_UST, AGIRLIK_KADEME};
})();
