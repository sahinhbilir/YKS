// Öğrenci kademeleri (ders başına). Embedded by scripts/embed-zorluk.cjs. See "Zorluk ve kademeler" in docs/yanlislar-defteri.md.
// Computed in memory on every draw from the results already in the notebook (denemeListe of every student); nothing is stored or sent.
//   a_se = logit((D + 0.5) / (n + 1)) − logit(m_e)   m_e = the mean of the cohort's (D + 0.5) / (n + 1) in that exam and ders
//   a_s  = Σ w a / Σ w   w = precision × 0.5^age   precision = n p (1 − p), age = the exam's index from the latest (as in analiz.js)
//   SE   = √(Σ prec · r²) / Σ prec · r            (delta method, var(logit p) ≈ 1 / (n p (1 − p)))
//   G = SD_true / RMSE, SD_true² = SD_obs² − mean(SE²); tiers H = floor((4G + 1) / 3) clamped to 2..6 (Wright & Masters 1982)
const KADEME = (() => {
const logit = p => Math.log(p / (1 - p)), sig = z => 1 / (1 + Math.exp(-z));
const Z = 1.96, EN_AZ_OGRENCI = 8, EN_AZ_KOHORT = 5, AGIRLIK = 0.5, H_ALT = 2, H_UST = 6;
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
const anahtarDers = (oturum, kod) => oturum + ':' + kod;

// Number of statistically distinct strata from the person separation G (Wright & Masters 1982), kept within 2..6.
const katman = G => Math.max(H_ALT, Math.min(H_UST, Math.floor((4 * G + 1) / 3)));

/* ---- the computation ----
   kayitlar: [{ogr, sinav, tarih, ad, oturum, ders, d, n}] one row per student, exam and ders (n questions, d correct). */
function hesapla(kayitlar) {
  const gruplar = new Map();
  for (const r of kayitlar) {
    if (!(r.n > 0) || !(r.d >= 0) || r.d > r.n) continue;
    const k = anahtarDers(r.oturum, r.ders);
    if (!gruplar.has(k)) gruplar.set(k, {oturum: r.oturum, kod: r.ders, sinavlar: new Map()});
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
        const p = ph[j], prec = r.n * p * (1 - p), a = logit(p) - lm, rec = Math.pow(AGIRLIK, yas);
        if (!kisi.has(r.ogr)) kisi.set(r.ogr, {ogr: r.ogr, seri: [], sw: 0, swa: 0, swp: 0});
        const q = kisi.get(r.ogr);
        q.seri.push({sinav: s.id, ad: s.ad, tarih: s.tarih, a, se: 1 / Math.sqrt(prec), n: r.n, d: r.d});
        q.sw += prec * rec; q.swa += prec * rec * a; q.swp += prec * rec * rec;
      });
    });
    const ogrenciler = [...kisi.values()].map(q => ({ogr: q.ogr, seri: q.seri, a: q.swa / q.sw, se: Math.sqrt(q.swp) / q.sw}));
    const d = {key: k, oturum: g.oturum, kod: g.kod, n: ogrenciler.length, sinavSayisi: sin.length, ogrenciler: new Map(ogrenciler.map(o => [o.ogr, o])), yetersiz: true, H: null, G: null, guvenirlik: null, kenarlar: []};
    dersler.set(k, d);
    if (ogrenciler.length < EN_AZ_OGRENCI) continue;
    const A = ogrenciler.map(o => o.a), m = ort(A), vobs = A.reduce((s, x) => s + (x - m) ** 2, 0) / (A.length - 1), mse = ort(ogrenciler.map(o => o.se * o.se)), vt = vobs - mse;
    d.sdGozlenen = Math.sqrt(vobs); d.rmse = Math.sqrt(mse);
    if (!(vt > 0)) continue;
    const G = Math.sqrt(vt) / Math.sqrt(mse), H = katman(G);
    const s = A.slice().sort((a, b) => a - b), lo = yuzdelik(s, 0.05), hi = yuzdelik(s, 0.95);
    if (!(hi - lo > 1e-9)) continue;
    const kenarlar = Array.from({length: H - 1}, (_, i) => lo + (i + 1) * (hi - lo) / H);
    Object.assign(d, {yetersiz: false, G, H, guvenirlik: G * G / (1 + G * G), kenarlar, alt: lo, ust: hi});
    for (const o of ogrenciler) {
      o.kademe = H - kenarlar.filter(e => e <= o.a).length;
      o.belirsiz = kenarlar.some(e => e >= o.a - Z * o.se && e <= o.a + Z * o.se);
    }
  }
  return dersler;
}

/* ---- the notebook as records ---- */
function kayitlariTopla() {
  const out = [], kimlik = new Map();
  (D.ogr || []).forEach((o, si) => {
    if (!o || o.silindi) return;
    const id = String(o.no || '').trim() || 'i' + si;
    kimlik.set(id, {id, ad: o.ad, sube: o.sube || '', si});
    for (const r of denemeListe(si)) {
      if (r.tur !== 'TYT' && r.tur !== 'AYT') continue;
      const alan = r.id.startsWith('p:') ? o.alan : r.alan;
      if (!r.dersler.some(d => d.dogru + d.yanlis > 0)) continue;
      const sinav = denemeAdAnahtari(r.ad) + '|' + r.tarih + '|' + r.oturum;
      for (const d of r.dersler) {
        if (!denemeBolumSayilir(r, d.kod, alan)) continue;
        const std = DENEME_DERSLER[r.oturum].find(x => x[0] === d.kod);
        out.push({ogr: id, sinav, tarih: r.tarih, ad: r.ad, oturum: r.oturum, ders: d.kod, d: d.dogru, n: d.soru ?? std?.[2] ?? d.dogru + d.yanlis});
      }
    }
  });
  return {kayitlar: out, kimlik};
}
let ONBELLEK = {imza: null, m: null};
function model() {
  if (typeof D === 'undefined' || !Array.isArray(D.ogr)) return {dersler: new Map(), kimlik: new Map()};
  const imza = D.ogr.map((o, i) => !o || o.silindi ? '' : (o.no || '') + ':' + (o.sube || '') + ':' + (o.alan || '') + ':' + [...(o.denemeler || []), ...(o.denemeOkul || [])].map(r => r.id + '.' + r.ts + (r.silindi ? 'x' : '')).join(',')).join('|') + '#' + D.ogr.length;
  if (ONBELLEK.imza !== imza) { const t = kayitlariTopla(); ONBELLEK = {imza, m: {dersler: hesapla(t.kayitlar), kimlik: t.kimlik}} }
  return ONBELLEK.m;
}
const kimlikDers = (no, oturum, kod) => model().dersler.get(anahtarDers(oturum, kod))?.ogrenciler.get(String(no ?? '').trim()) || null;
// The student's relative ability (logits above the cohort of the same exams) in a ders, or null when there is no data or the ders has no tiers (Veri yetersiz).
const yetenek = (no, oturum, kod) => { const d = model().dersler.get(anahtarDers(oturum, kod)); return d && !d.yetersiz ? d.ogrenciler.get(String(no ?? '').trim())?.a ?? null : null };

/* ---- screen ---- */
const KD = {oturum: 'TYT', sube: '', sira: '', secili: null};
const dersAdi = (oturum, kod) => (DENEME_DERSLER[oturum].find(d => d[0] === kod) || [kod, kod])[1];
const kademeYazi = (o, belirsiz) => o.kademe + (belirsiz ?? o.belirsiz ? '?' : '');
function hucreRengi(t, H) {
  if (H < 2) return '';
  const f = (t - 1) / (H - 1), pay = Math.round(Math.abs(f - 0.5) * 2 * 55);
  return pay ? 'background:color-mix(in srgb,var(--e-' + (f < 0.5 ? 'ok' : 'bad') + ') ' + pay + '%,var(--e-panel))' : '';
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
  const m = model(), subeler = [...new Set([...m.kimlik.values()].map(k => k.sube).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr', {numeric: true}));
  if (KD.sube && !subeler.includes(KD.sube)) KD.sube = '';
  const dl = DENEME_DERSLER[KD.oturum].map(d => m.dersler.get(anahtarDers(KD.oturum, d[0]))).filter(d => d && d.n);
  const seg = (ad, deger, secenekler, etiket) => '<div class="et-seg" role="group" aria-label="' + etiket + '"><span class="et-seg-label">' + etiket + '</span>' +
    secenekler.map(([v, t]) => '<button type="button" data-kd-' + ad + '="' + esc(v) + '" aria-pressed="' + (deger === v) + '">' + esc(t) + '</button>').join('') + '</div>';
  const araclar = '<div class="et-arac">' + seg('oturum', KD.oturum, [['TYT', 'TYT'], ['AYT', 'AYT']], 'Oturum') +
    '<label class="et-seg"><span class="et-seg-label">Şube</span><select data-kd-sube aria-label="Şube"><option value="">Tüm şubeler</option>' + subeler.map(s => '<option value="' + esc(s) + '"' + (s === KD.sube ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></label></div>';
  if (!dl.length) return '<div class="et-kart-bas"><h2>Kademeler</h2></div>' + araclar + '<p class="mini">Veri yetersiz</p>';
  const ogr = [...m.kimlik.values()].filter(k => (!KD.sube || k.sube === KD.sube) && dl.some(d => d.ogrenciler.has(k.id)));
  const deger = (k, d) => d.ogrenciler.get(k.id)?.kademe ?? null;
  const sira = dl.find(d => d.key === KD.sira);
  const ad = (a, b) => a.sube.localeCompare(b.sube, 'tr', {numeric: true}) || String(a.ad).localeCompare(String(b.ad), 'tr');
  ogr.sort((a, b) => sira ? (deger(a, sira) ?? 99) - (deger(b, sira) ?? 99) || (sira.ogrenciler.get(b.id)?.a ?? -99) - (sira.ogrenciler.get(a.id)?.a ?? -99) || ad(a, b) : ad(a, b));
  const bas = dl.map(d => '<th scope="col" class="kd-ders"><button type="button" data-kd-sira="' + d.key + '" aria-pressed="' + (KD.sira === d.key) + '" aria-label="' + esc(dersAdi(d.oturum, d.kod) + ' derse göre sırala') + '"><b>' + esc(dersAdi(d.oturum, d.kod)) + '</b>' +
    (d.yetersiz ? '<span class="mini">Veri yetersiz</span>' : '<span class="mini">' + d.H + ' kademe · ' + f2(d.guvenirlik) + '</span>') + '</button></th>').join('');
  const sec = KD.secili && m.kimlik.has(KD.secili.id) ? KD.secili : null;
  const govde = ogr.map(k => '<tr><th scope="row">' + esc(k.ad) + ' <span class="mini">' + esc(k.sube) + '</span></th>' + dl.map(d => {
    const o = d.ogrenciler.get(k.id);
    if (!o || d.yetersiz) return '<td class="kd-hucre bos">—</td>';
    const on = sec && sec.id === k.id && sec.key === d.key;
    return '<td class="kd-hucre" style="' + hucreRengi(o.kademe, d.H) + '"><button type="button" data-kd-hucre="' + esc(k.id) + '|' + d.key + '" aria-pressed="' + on + '" aria-label="' + esc(k.ad + ', ' + dersAdi(d.oturum, d.kod) + ': ' + o.kademe + '. kademe' + (o.belirsiz ? ', belirsiz' : '')) + '">' + kademeYazi(o) + '</button></td>';
  }).join('') + '</tr>').join('');
  let detay = '';
  if (sec) {
    const d = m.dersler.get(sec.key), o = d && d.ogrenciler.get(sec.id), k = m.kimlik.get(sec.id);
    if (o) detay = '<div class="kd-detay"><div class="kd-detay-ust"><b>' + esc(k.ad) + '</b><span>' + esc(dersAdi(d.oturum, d.kod)) + (d.yetersiz ? '' : ' · ' + kademeYazi(o) + '. kademe / ' + d.H) + '</span></div>' + sparkline(o, d) + '</div>';
  }
  return '<div class="et-kart-bas"><h2>Kademeler</h2><span class="mini">' + ogr.length + ' öğrenci</span></div>' + araclar +
    '<div class="et-kaydir"><table class="et-tablo kd-tablo"><thead><tr><th scope="col">Öğrenci</th>' + bas + '</tr></thead><tbody>' + govde + '</tbody></table></div>' + detay;
}
const panel = () => '<section class="et-panel" id="kdKok">' + panelIc() + '</section>';
function yenile(odak) { const el = typeof document !== 'undefined' && document.getElementById('kdKok'); if (!el) return; el.innerHTML = panelIc(); if (odak) el.querySelector(odak)?.focus() }
// A student's tier per ders as chips: "Matematik · 2. kademe / 4".
function ogrenciSatiri(si) {
  const o = D.ogr[si]; if (!o) return '';
  const id = String(o.no || '').trim() || 'i' + si, m = model(), hap = [];
  for (const oturum of ['TYT', 'AYT']) for (const d of DENEME_DERSLER[oturum]) {
    const x = m.dersler.get(anahtarDers(oturum, d[0])), q = x && !x.yetersiz && x.ogrenciler.get(id);
    if (q) hap.push('<span class="kd-hap">' + (oturum === 'AYT' ? 'AYT ' : '') + esc(d[1]) + ' · ' + kademeYazi(q) + '. kademe / ' + x.H + '</span>');
  }
  return hap.length ? '<div class="kd-haplar" id="kdHaplar" role="list" aria-label="Kademeler">' + hap.join('') + '</div>' : '';
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', ev => {
    const el = ev.target.closest?.('#kdKok [data-kd-oturum],#kdKok [data-kd-sira],#kdKok [data-kd-hucre]'); if (!el) return;
    if (el.dataset.kdOturum) { KD.oturum = el.dataset.kdOturum; KD.sira = ''; KD.secili = null; yenile('[data-kd-oturum="' + KD.oturum + '"]'); return }
    if (el.dataset.kdSira) { KD.sira = KD.sira === el.dataset.kdSira ? '' : el.dataset.kdSira; yenile('[data-kd-sira="' + el.dataset.kdSira + '"]'); return }
    if (el.dataset.kdHucre) { const [id, key] = el.dataset.kdHucre.split('|'); KD.secili = KD.secili && KD.secili.id === id && KD.secili.key === key ? null : {id, key}; yenile('[data-kd-hucre="' + el.dataset.kdHucre.replace(/"/g, '') + '"]') }
  });
  document.addEventListener('change', ev => { if (ev.target.matches?.('#kdKok [data-kd-sube]')) { KD.sube = ev.target.value; yenile('[data-kd-sube]') } });
}
const durum = () => KD;
return {hesapla, katman, model, kodDers, yetenek, kimlikDers, kayitlariTopla, panel, panelIc, ogrenciSatiri, sparkline, durum, anahtarDers, sig, EN_AZ_OGRENCI, EN_AZ_KOHORT, H_ALT, H_UST};
})();
