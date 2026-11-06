// Soru zorluğu ve madde kalitesi (Yanlışlar defteri). Embedded by scripts/embed-zorluk.cjs. See "Zorluk ve kademeler" in docs/yanlislar-defteri.md.
// Pure functions on 0/1/blank matrices computed in the browser from the uploaded cevap raporu. Nothing here reads, stores or sends a file; no personal data.
// Cell codes: 1 doğru, 0 yanlış, -1 boş.
const ZORLUK = (() => {
const Z = 1.96;
const sig = z => 1 / (1 + Math.exp(-z));
const ort = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const varyans = (a, ddof = 0) => { if (a.length - ddof < 1) return null; const m = ort(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - ddof); };

/* ---- single-number statistics ---- */
// Wilson (1927) score interval of a proportion k/n at 95%.
function wilson(k, n) {
  if (!(n > 0)) return null;
  const p = k / n, z2 = Z * Z, d = 1 + z2 / n, c = p + z2 / (2 * n), h = Z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}
function pearson(x, y) {
  const n = x.length; if (n < 2) return null;
  const mx = ort(x), my = ort(y); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2 }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
// Corrected point-biserial: the item against the rest of the section score (the item itself left out of the total).
function ritDuzeltilmis(x, toplam) { return pearson(x, toplam.map((t, i) => t - x[i])) }
// Kuder & Richardson (1937) formula 20 with the population variance of the total scores; SEM = SD √(1 − KR-20).
function kr20(X) {
  const n = X.length, k = n ? X[0].length : 0; if (n < 2 || k < 2) return null;
  const tot = X.map(r => r.reduce((a, b) => a + b, 0)), v = varyans(tot);
  if (!(v > 0)) return null;
  let pq = 0; for (let i = 0; i < k; i++) { const p = X.reduce((s, r) => s + r[i], 0) / n; pq += p * (1 - p) }
  const r = k / (k - 1) * (1 - pq / v);
  return {kr20: r, sd: Math.sqrt(v), sem: Math.sqrt(v) * Math.sqrt(Math.max(0, 1 - r)), ort: ort(tot)};
}
function siralar(a) {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = Array(a.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1 }
  return r;
}
const spearman = (x, y) => x.length >= 3 && x.length === y.length ? pearson(siralar(x), siralar(y)) : null;

/* ---- Rasch (1PL) by joint maximum likelihood ---- */
// X[person][item] in {0,1}. Extreme persons and items (all correct or all wrong) are left out of the fit, repeatedly until none is left.
// Items are centred at 0; Wright's bias correction (L − 1) / L is applied to b, θ and the standard errors.
function rasch(X) {
  const N0 = X.length, L0 = N0 ? X[0].length : 0;
  let pk = Array.from({length: N0}, (_, i) => i), ik = Array.from({length: L0}, (_, i) => i);
  for (;;) {
    const sc = pk.map(n => ik.reduce((s, i) => s + X[n][i], 0)), ic = ik.map(i => pk.reduce((s, n) => s + X[n][i], 0));
    const pk2 = pk.filter((_, j) => sc[j] > 0 && sc[j] < ik.length), ik2 = ik.filter((_, j) => ic[j] > 0 && ic[j] < pk.length);
    const same = pk2.length === pk.length && ik2.length === ik.length;
    pk = pk2; ik = ik2;
    if (same || pk.length < 2 || ik.length < 2) break;
  }
  const L = ik.length, N = pk.length;
  const bos = {uygun: false, b: Array(L0).fill(null), se: Array(L0).fill(null), infit: Array(L0).fill(null), outfit: Array(L0).fill(null), uc: Array(L0).fill(true), mu: null, kisiUc: N0 - N, maddeUc: L0 - L, ayirma: null};
  if (L < 2 || N < 2) return bos;
  const skor = pk.map(n => ik.reduce((s, i) => s + X[n][i], 0)), cnt = Array(L + 1).fill(0);
  skor.forEach(s => cnt[s]++);
  const c = ik.map(i => pk.reduce((s, n) => s + X[n][i], 0));
  let b = c.map(v => Math.log((N - v) / v)); { const m = ort(b); b = b.map(v => v - m) }
  const th = Array(L + 1).fill(0); for (let s = 1; s < L; s++) th[s] = Math.log(s / (L - s));
  const clamp = (v, m) => Math.max(-m, Math.min(m, v));
  for (let it = 0; it < 500; it++) {
    for (let s = 1; s < L; s++) {
      if (!cnt[s]) continue;
      for (let k = 0; k < 40; k++) {
        let E = 0, V = 0; for (const bi of b) { const p = sig(th[s] - bi); E += p; V += p * (1 - p) }
        const d = clamp((s - E) / V, 1); th[s] += d; if (Math.abs(d) < 1e-9) break;
      }
    }
    let mx = 0;
    const nb = b.map((bi, j) => { let E = 0, V = 0; for (let s = 1; s < L; s++) if (cnt[s]) { const p = sig(th[s] - bi); E += cnt[s] * p; V += cnt[s] * p * (1 - p) } const d = clamp((E - c[j]) / V, 1); mx = Math.max(mx, Math.abs(d)); return bi + d });
    const m = ort(nb); b = nb.map(v => v - m);
    if (mx < 1e-7) break;
  }
  const V = b.map(bi => { let v = 0; for (let s = 1; s < L; s++) if (cnt[s]) { const p = sig(th[s] - bi); v += cnt[s] * p * (1 - p) } return v });
  const f = (L - 1) / L, bc = b.map(v => v * f), thc = th.map(v => v * f), sec = V.map(v => f / Math.sqrt(v));
  // fit mean squares (Wright & Masters 1982): infit = Σ(x − P)² / ΣP(1 − P), outfit = mean of the squared standardised residuals
  const infit = [], outfit = [];
  ik.forEach((_, j) => {
    let num = 0, den = 0, z2 = 0;
    pk.forEach((n, q) => { const p = sig(thc[skor[q]] - bc[j]), r2 = (X[n][ik[j]] - p) ** 2, v = p * (1 - p); num += r2; den += v; z2 += r2 / v });
    infit.push(num / den); outfit.push(z2 / N);
  });
  const out = {...bos, uygun: true, b: Array(L0).fill(null), se: Array(L0).fill(null), infit: Array(L0).fill(null), outfit: Array(L0).fill(null), uc: Array(L0).fill(true)};
  ik.forEach((i, j) => { out.b[i] = bc[j]; out.se[i] = sec[j]; out.infit[i] = infit[j]; out.outfit[i] = outfit[j]; out.uc[i] = false });
  out.mu = ort(skor.map(s => thc[s]));
  // item separation and reliability (Wright & Masters 1982): SD_true² = SD_obs² − mean(SE²), G = SD_true / RMSE, reliability = G² / (1 + G²)
  const mse = ort(sec.map(s => s * s)), vobs = varyans(bc, 1);
  if (L >= 3 && vobs !== null) { const vt = Math.max(0, vobs - mse), G = Math.sqrt(vt / mse); out.ayirma = {G, guvenirlik: G * G / (1 + G * G), rmse: Math.sqrt(mse)} }
  out.L = L; out.N = N; out.kisiUc = N0 - N; out.maddeUc = L0 - L;
  return out;
}

/* ---- five bands from b − μθ (logits) ---- */
const BANTLAR = [['cok-kolay', 'Çok kolay'], ['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor'], ['cok-zor', 'Çok zor']];
const BANT_AD = Object.fromEntries(BANTLAR);
const bantNo = r => r <= -2 ? 0 : r <= -0.75 ? 1 : r < 0.75 ? 2 : r < 2 ? 3 : 4;
// The band is the point estimate. "?" only when b ± 1.96·SE spans three or more bands (we cannot even say "this one or a neighbour"):
// at school sizes SE ≈ 0.45–0.6 logits, so the interval (≈ ±1 logit) usually touches one neighbour band, which the band already tolerates.
function bantla(rel, se) {
  const i = bantNo(rel), belirsiz = se !== null && se !== undefined && Math.abs(bantNo(rel + Z * se) - bantNo(rel - Z * se)) >= 2;
  return {bant: BANTLAR[i][0], belirsiz};
}
const etiketYazi = (bant, belirsiz) => BANT_AD[bant] + (belirsiz ? '?' : '');

/* ---- quality flags (Ebel & Frisbie 1991; Wright & Masters 1982) ---- */
const BAYRAK = {ters: 'Ayırt etmiyor: anahtarı kontrol edin', zayif: 'Zayıf ayırt edicilik', uyumsuz: 'Uyumsuz'};
function bayraklar(r, infit, outfit) {
  const l = [];
  if (r !== null && r !== undefined) { if (r < 0) l.push(BAYRAK.ters); else if (r < 0.2) l.push(BAYRAK.zayif) }
  const dis = v => v !== null && v !== undefined && (v < 0.5 || v > 1.5);
  if (dis(infit) || dis(outfit)) l.push(BAYRAK.uyumsuz);
  return l;
}

/* ---- one section ----
   rows: persons × items, codes 1 / 0 / -1. opt.atla: Set of item indexes left out (cancelled questions). A person who left the whole
   section blank did not take it and is not counted. */
const EN_AZ_OGRENCI = 15, EN_AZ_KR20 = 0.5;
function bolum(rows, opt = {}) {
  const k = rows.length ? rows[0].length : (opt.k || 0), atla = opt.atla || new Set();
  const canli = Array.from({length: k}, (_, i) => i).filter(i => !atla.has(i));
  const al = rows.filter(r => canli.some(i => r[i] >= 0)), n = al.length;
  const X = al.map(r => canli.map(i => r[i] === 1 ? 1 : 0));
  const tot = X.map(r => r.reduce((a, b) => a + b, 0));
  const kr = n >= 2 ? kr20(X) : null, R = n >= 3 ? rasch(X) : null;
  const dusuk = n < EN_AZ_OGRENCI || !kr || kr.kr20 < EN_AZ_KR20;
  // Net with the wrong-answer penalty, D − Y/4, per taker (blank costs nothing); its mean and its ratio to the live item count feed the anchoring (capala).
  const netler = al.map(r => { let d = 0, y = 0; for (const i of canli) { if (r[i] === 1) d++; else if (r[i] === 0) y++ } return d - y / 4 });
  const okulNet = ort(netler), okulOran = okulNet !== null && canli.length ? okulNet / canli.length : null;
  const maddeler = Array.from({length: k}, (_, i) => ({i, iptal: atla.has(i)}));
  canli.forEach((i, j) => {
    const dogru = X.reduce((s, r) => s + r[j], 0), bos = al.filter(r => r[i] < 0).length, yanlis = n - dogru - bos;
    const x = X.map(r => r[j]), rit = n >= 3 ? ritDuzeltilmis(x, tot) : null;
    const m = maddeler[i];
    Object.assign(m, {n, dogru, yanlis, bos, p: n ? dogru / n : null, aralik: wilson(dogru, n), yanlisOran: n ? yanlis / n : null, bosOran: n ? bos / n : null, rit});
    if (R && R.uygun) { m.b = R.b[j]; m.se = R.se[j]; m.infit = R.infit[j]; m.outfit = R.outfit[j]; m.uc = R.uc[j] } else { m.b = null; m.se = null; m.infit = null; m.outfit = null; m.uc = true }
    if (!m.uc) { m.rel = m.b - R.mu; Object.assign(m, bantla(m.rel, m.se)) }
    else if (n && (dogru === n || dogru === 0)) { m.bant = dogru === n ? 'cok-kolay' : 'cok-zor'; m.belirsiz = n < EN_AZ_OGRENCI; m.rel = null }
    else { m.bant = null; m.belirsiz = false; m.rel = null }
    m.dusuk = dusuk;
    m.bayrak = bayraklar(m.rit, m.infit, m.outfit);
  });
  return {n, k: canli.length, okulNet, okulOran, kr20: kr ? kr.kr20 : null, sem: kr ? kr.sem : null, sd: kr ? kr.sd : null, ortSkor: kr ? kr.ort : null, dusuk,
    mu: R && R.uygun ? R.mu : null, ayirma: R ? R.ayirma : null, kisiUc: R ? R.kisiUc : 0, maddeUc: R ? R.maddeUc : 0, maddeler, isaretli: maddeler.filter(m => m.bayrak && m.bayrak.length).length};
}
/* ---- anchoring to the network average (mean/mean linking, not equating) ----
   The bands use b − μθ, the difficulty relative to this school's mean ability. With the publisher's Genel Net of the ders:
   r_s = the school's mean net ratio, r_g = Genel Net / n, both clamped to [0.02, 0.98]; Δ = logit(r_s) − logit(r_g) (> 0: the school is stronger than the network).
   The bands then use (b − μθ) + Δ, the difficulty for the average network student. Same edges, same "?" rule. Only the item bands move. */
const OLCEK_SINIR = [0.02, 0.98];
const kisitla = r => Math.min(OLCEK_SINIR[1], Math.max(OLCEK_SINIR[0], r));
const logit = p => Math.log(p / (1 - p));
const capaFarki = (okulOran, genelOran) => logit(kisitla(okulOran)) - logit(kisitla(genelOran));
// Re-bands the items of a bolum() result in place; returns the anchor (or null when it cannot be computed). The school-relative band is kept as bantOkul.
function capala(a, genelNet, n) {
  if (!a || !(a.n > 0) || a.okulOran === null || a.okulOran === undefined || !Number.isFinite(genelNet) || !(n > 0)) return null;
  const delta = capaFarki(a.okulOran, genelNet / n);
  a.maddeler.forEach(m => {
    if (m.iptal) return;
    m.bantOkul = m.bant; m.belirsizOkul = m.belirsiz; m.genele = true;
    if (m.rel !== null && m.rel !== undefined) { m.relGenel = m.rel + delta; Object.assign(m, bantla(m.relGenel, m.se)) }
  });
  a.capa = {delta, genel: genelNet, okul: a.okulNet, rs: a.okulOran, rg: genelNet / n};
  return a.capa;
}
/* ---- the publisher's network-wide p (Performans analizi) ----
   ps[i] = p of item i (A numbering), thousands of students, so no "?" and no low-reliability mark. The same five bands from b − μθ: b = the logit difficulty
   ln((1 − p) / p) centred over the items, μθ = the ability whose expected section score equals the mean score Σp (the network's average student). Returns the summary or null. */
function performans(a, ps) {
  const idx = []; a.maddeler.forEach((m, i) => { if (!m.iptal && Number.isFinite(ps[i])) idx.push(i) });
  if (idx.length < 2) return null;
  const p = idx.map(i => Math.min(0.99, Math.max(0.01, ps[i]))), d = p.map(v => -logit(v)), mu = ort(d), b = d.map(v => v - mu), hedef = p.reduce((s, v) => s + v, 0);
  let lo = -10, hi = 10; for (let k = 0; k < 80; k++) { const t = (lo + hi) / 2; if (b.reduce((s, v) => s + sig(t - v), 0) < hedef) lo = t; else hi = t }
  const th = (lo + hi) / 2;
  idx.forEach((i, j) => {
    const m = a.maddeler[i], rel = b[j] - th;
    m.bantOkul = m.bant; m.belirsizOkul = m.belirsiz; m.pYayin = ps[i]; m.rel = rel; m.bant = BANTLAR[bantNo(rel)][0]; m.belirsiz = false; m.dusuk = false; m.yayin = true;
  });
  let rho = null; { const x = [], y = []; idx.forEach(i => { const m = a.maddeler[i]; if (m.p !== null && m.p !== undefined) { x.push(m.p); y.push(ps[i]) } }); rho = spearman(x, y) }
  a.perf = {n: idx.length, ort: hedef / idx.length, rho};
  return a.perf;
}
const sayi = (v, d = 2) => v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d).replace(/^-(0[.,]?0*)$/, '$1').replace('.', ',').replace('-', '−');
// "Türkçe · 27 öğrenci · KR-20 0,82 · 2 madde işaretli"; low reliability and the school correlation are added after it.
function bolumSatiri(ad, a, rho) {
  const c = a.capa;
  return ad + ' · ' + a.n + ' öğrenci · KR-20 ' + sayi(a.kr20) + ' · ' + (a.isaretli ? a.isaretli + ' madde işaretli' : 'işaretli madde yok') +
    (a.dusuk ? ' · Güvenilirlik düşük' : '') + (rho !== null && rho !== undefined ? ' · okul verisi ρ ' + sayi(rho) : '') +
    (a.perf ? ' · zorluk: yayınevinin performans analizi (Türkiye geneli, A kitapçığı)' + (a.perf.rho !== null ? ' · okul ↔ yayınevi ρ ' + sayi(a.perf.rho) : '') : '') +
    (c ? ' · genel ort. ' + sayi(c.genel) + ' net · okul ' + sayi(c.okul) + ' net · ölçek genele göre' : '');
}
// Weight class (Kendi seviyesi): the student's tier k of H (1 = strongest, norm-referenced within the grade) picks a window of difficulty bands
// (0 Çok kolay, 1 Kolay, 2 Orta, 3 Zor, 4 Çok zor). Five windows from top to bottom; tier k gets PENCERELER[round((k − 1)·4 / (H − 1))].
// A student without a tier for the ders gets the Orta window.
const PENCERELER = [[3, 4], [2, 3], [2], [1, 2], [0, 1]];
const kademePenceresi = (kademe, H) => !(H >= 2) || !(kademe >= 1) ? PENCERELER[2] : PENCERELER[Math.round((Math.min(kademe, H) - 1) * 4 / (H - 1))];
function kendiSeviyesi(kademe, H, bant) {
  const i = BANTLAR.findIndex(b => b[0] === bant);
  return i >= 0 && kademePenceresi(kademe, H).includes(i);
}
return {wilson, pearson, ritDuzeltilmis, kr20, spearman, rasch, bantNo, bantla, etiketYazi, BANTLAR, BANT_AD, BAYRAK, bayraklar, bolum, bolumSatiri, capala, performans, capaFarki, kisitla, kendiSeviyesi, kademePenceresi, PENCERELER, EN_AZ_OGRENCI, EN_AZ_KR20, sayi, sig};
})();
