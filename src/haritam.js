// Haritam: the student's connected-memory map (bağlantılı hafıza). Embedded by scripts/embed-haritam.cjs together
// with src/hafiza-ag.js (HAFIZA_AG) and data/hafiza-haritasi-tam.json (HARITA_VERI). Rules: docs/baglantili-hafiza.md.
// Reads the student's results, lesson days and settings; writes nothing except the view state in EK.
const HARITAM = (() => {
const V = HARITA_VERI, DERS_SIRA = ['Geometri', 'Matematik TYT', 'Matematik AYT', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe', 'Türk Dili ve Edebiyatı',
  'T.C. İnkılap Tarihi ve Atatürkçülük', 'Coğrafya', 'Felsefe (+ Felsefe Grubu)'].filter(d => V.konular.some(k => k.ders === d));
// Plan course labels as the map shows them.
const KISA_AD = {'Türk Dili ve Edebiyatı': 'Edebiyat', 'T.C. İnkılap Tarihi ve Atatürkçülük': 'İnkılap Tarihi', 'Felsefe (+ Felsefe Grubu)': 'Felsefe'}, dersAd = d => KISA_AD[d] || d;
const KEN = {az: .25, cok: .5, tam: 1};

/* ---- colours: one spectrum in OKLCH ---- */
function oklch(L, C, h) {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, bb = -.0041960863 * l - .7034186147 * m + 1.707614701 * s;
  const f = x => { x = Math.max(0, Math.min(1, x)); return x <= .0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - .055; };
  return '#' + [r, g, bb].map(v => Math.round(f(v) * 255).toString(16).padStart(2, '0')).join('');
}
const TEMA = {
  koyu: {zemin: '#0E0E0F', ip: '255,255,255', yazi: '#8E8E93', yaziGuclu: '#D1D1D6', bos: '#3A3A3C', nane: oklch(.79, .13, 163), kL: .57, cekirdek: '#FFFFFF'},
  acik: {zemin: '#FFFFFF', ip: '0,0,0', yazi: '#6E6E73', yaziGuclu: '#1C1C1E', bos: '#D1D1D6', nane: oklch(.62, .13, 163), kL: .52, cekirdek: '#FFFFFF'}};
const ALTIN = '#E9C46A';
// Green at or above the line; below it crimson-red deepening to wine (f = 0 at the line, 1 at 45 points under it).
function renk(t, r, hedef) {
  if (r == null) return t.bos;
  if (r >= hedef) return t.nane;
  const f = Math.min(1, Math.max(0, (hedef - r) / .45));
  return oklch(t.kL - .22 * f, .19 - .035 * f, 21 - 18 * f);
}
const koyuMu = () => { try { return TEMA_TERCIHI === 'dark' || (TEMA_TERCIHI !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; } };

/* ---- static parts: expected questions, links, layout ---- */
const SORU = (() => { const m = new Map(); for (const r of V.sinavSatirlari || []) { const b = HAFIZA_AG.soruBeklentisi(r.yillar); for (const [id, p] of Object.entries(r.paylar)) m.set(id, (m.get(id) || 0) + p * b.beklenen); } return m; })();
const KONU = new Map(V.konular.map(k => [k.id, k]));
const KENAR = V.baglar.filter(b => (b.tur || 'kullanir') === 'kullanir').map(b => ({a: b.alt, b: b.ust, u: KEN[b.kullanim] || .5}))
  .concat(V.konular.filter(k => k.gizli).map(k => ({a: k.id, b: k.parcasi, u: 1, ic: true})));
// Each subject is laid out on its own (a deterministic force layout), centred at 0. Worked out when the subject is first
// drawn, not when the app opens.
const yerHazir = {};
function yerAl(ders) {
  if (yerHazir[ders]) return yerHazir[ders];
  let seed = 5 + DERS_SIRA.indexOf(ders) * 17; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const ids = V.konular.filter(k => k.ders === ders).map(k => k.id), P = new Map(ids.map(id => [id, {x: rnd() * 100, y: rnd() * 100, vx: 0, vy: 0}]));
  const E = KENAR.filter(e => P.has(e.a) && P.has(e.b));
  for (let it = 0, T = 1; it < 1500; it++, T *= .996) {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const p = P.get(ids[i]), q = P.get(ids[j]), dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy + .01, d = Math.sqrt(d2), f = 1400 / d2;
      p.vx += f * dx / d; p.vy += f * dy / d; q.vx -= f * dx / d; q.vy -= f * dy / d; }
    for (const e of E) { const p = P.get(e.a), q = P.get(e.b), dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy) + .01, f = (d - (e.ic ? 18 : 46 - 10 * e.u)) * (.05 + .04 * e.u);
      p.vx += f * dx / d; p.vy += f * dy / d; q.vx -= f * dx / d; q.vy -= f * dy / d; }
    for (const p of P.values()) { p.vx += (50 - p.x) * .012; p.vy += (50 - p.y) * .012; p.x += Math.max(-6, Math.min(6, p.vx * T)); p.y += Math.max(-6, Math.min(6, p.vy * T)); p.vx *= .5; p.vy *= .5; }
  }
  const xs = [...P.values()].map(p => p.x), ys = [...P.values()].map(p => p.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return (yerHazir[ders] = new Map([...P].map(([id, p]) => [id, {x: p.x - cx, y: p.y - cy}])));
}

/* ---- the student ---- */
// Subjects the student has, by field: Türkçe for every YKS student; Mathematics (Geometri, Matematik TYT and AYT) as
// before (SAY, EA, no field, or before grade 12); Fizik, Kimya and Biyoloji for SAY; Edebiyat, İnkılap Tarihi, Coğrafya
// and Felsefe for EA and SÖZ. Before grade 12 with no field chosen yet: every subject.
const FEN = new Set(['Fizik', 'Kimya', 'Biyoloji']), SOZEL = new Set(['Türk Dili ve Edebiyatı', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Coğrafya', 'Felsefe (+ Felsefe Grubu)']);
function dersleri(o) {
  if (!o || ogrenciSinavi(o) !== 'YKS') return [];
  const alan = o.alan, sinif = ogrenciSinifi(o), hepsi = !alan && sinif < 12;
  const mat = !alan || alan === 'SAY' || alan === 'EA' || sinif < 12, fen = alan === 'SAY' || hepsi, sozel = alan === 'EA' || alan === 'SÖZ' || hepsi;
  return DERS_SIRA.filter(d => FEN.has(d) ? fen : SOZEL.has(d) ? sozel : d === 'Türkçe' || mat);
}
const uygun = () => { try { return ogrenciMi() && !!D.ogr[EK.ogr] && dersleri(D.ogr[EK.ogr]).length > 0; } catch (e) { return false; } };
// Map node → the student's topic ids: same course label and same topic name; a continued plan topic ("… (devamı)",
// "… - devamı") is the same topic. School units (catalogue: subject, grade, name) count for every YKS topic they cover.
const devamsiz = ad => String(ad).trim().replace(/\s*(?:\(devamı\)|- devamı)$/i, '');
function cozumle() {
  const adlar = new Map();
  for (let ki = 0, n = konuSayisi(); ki < n; ki++) { const k = konuAl(ki); if (!k) continue;
    const a = dersKimligi(konuDersAdi(ki)) + '|' + konuAdiTamAnahtari(devamsiz(k[3])); (adlar.get(a) || adlar.set(a, []).get(a)).push(ki); }
  const esler = new Map(V.konular.map(k => [k.id, adlar.get(dersKimligi(k.ders) + '|' + konuAdiTamAnahtari(k.ad)) || []]));
  const birimler = [];
  for (const b of V.birimler || []) { const di = KISA.indexOf(b.ders);
    KATALOG.forEach((k, ki) => { if (k[0] === di && k[1] === b.sinif && k[3] === b.ad) birimler.push({id: ki, kapsar: b.kapsar}); }); }
  return {esler, birimler};
}
// A student's input for HAFIZA_AG: the shared map (konular, birimler) and this student's own part, read from what
// Hafızam reads (konuEk: forgetting speed, FSRS parameters and lesson day per topic; birimEk: lesson day per school unit;
// real results with their entry time; own settings from Düzenle and "Çoktan unuttum"; basket lessons).
const ogrAnahtar = o => (o && o.no !== undefined ? o.no : '') + '|' + (o && o.ad || '');
function girdi(si, cz) {
  const o = D.ogr[si], bugun = bugunNo(), {esler, birimler} = cz || cozumle();
  const islenis = ki => { const g = ogrenciIslenisTarihi(si, ki); return Number.isInteger(g) && g <= bugun ? g : null; };
  const konular = V.konular.map(k => { const x = {id: k.id, ad: k.ad, ders: k.ders, gizli: !!k.gizli, soru: SORU.get(k.id) || 0, esler: esler.get(k.id) || []}; if (k.gizli) x.parcasi = k.parcasi; return x; });
  const konuEk = {}, birimEk = {};
  for (const k of konular) {
    if (!k.esler.length) continue;
    const g = k.esler.map(islenis).filter(x => x !== null), e = {k: unutmaKatsayisi(si, k.esler[0]), w: parametreAl(si, k.esler[0])};
    if (g.length) e.ogrenildi = Math.min(...g);
    konuEk[k.id] = e;
  }
  for (const b of birimler) { const g = islenis(b.id); if (g !== null) birimEk[b.id] = g; }
  const sonuclar = [];
  for (const l of D.log || []) {
    if (l[1] !== si || l[0] > bugun) continue;
    const not = sonucNotu(l); if (!not || sonucDevreDisiMi(si, l[2], l[0])) continue;
    sonuclar.push({gun: l[0], id: l[2], not, ts: +l[6] || 0});
  }
  const ayarlar = Object.entries((o && o.hafizaElle) || {}).filter(([ki]) => hafizaElleAl(si, +ki)).map(([ki, e]) => ({gun: e.g, id: +ki, r: e.r, s: e.s, ts: +e.ts || 0}));
  const anlatimlar = konuAnlatimGunleri(si, bugun).map(([ki, gun]) => ({gun, id: ki}));
  return {konular, baglar: V.baglar, birimler, konuEk, birimEk, sonuclar, ayarlar, anlatimlar, bugun, sinavGunu: gunNo(D.ayar.sinav), anahtar: ogrAnahtar(o), esler};
}
// Learnt link values: the notebook's shared ones and this student's own (Bağları güncelle, teacher side).
function parametreleri(o) {
  const p = D.hafizaAg && D.hafizaAg.parametreler; if (!p) return null;
  return {paylasilan: p.paylasilan || {}, ogrenci: (p.ogrenci || {})[ogrAnahtar(o)] || {}};
}
// opts (tests): link values over the starting ones, e.g. {kredi: 0, ceza: 0, cekis: 0} = Hafızam's own numbers.
// Hafızam, the map and its card all ask for it during one page draw, so the last answer is kept while the input is the same.
let onbellek = null;
function durum(si, opts) {
  const o = D.ogr[si], hedef = hedefTutma(si), cz = cozumle(), g = girdi(si, cz), prm = parametreleri(o);
  const anahtar = JSON.stringify([si, hedef, g.bugun, g.sinavGunu, g.sonuclar, g.konuEk, g.birimEk, g.ayarlar, g.anlatimlar, prm, opts || null, konuSayisi()]);
  if (onbellek && onbellek.anahtar === anahtar) return onbellek.d;
  const out = HAFIZA_AG.hesapla(Object.assign({}, g, {parametreler: prm}), Object.assign({}, opts, {hedef}));
  // Where a topic's memory lives in this notebook: plan topics with its name first, then school units covering it.
  const kaynak = new Map(V.konular.map(k => [k.id, (cz.esler.get(k.id) || []).concat(cz.birimler.filter(b => b.kapsar.includes(k.id)).map(b => b.id))]));
  const d = {out, esler: cz.esler, kaynak, hedef, satir: new Map(out.konular.map(s => [s.id, s]))};
  onbellek = {anahtar, d};
  return d;
}
// Hafızam's rows (hafizaDurumu) for the student's topics on the map take the map's value: a plan topic its node's, a
// school unit covering several nodes their mean (its line day: the nearest coming crossing, or the latest one passed).
function hafizayaUygula(si, liste, hedef) {
  const o = D.ogr[si], ders = new Set(dersleri(o)); if (!ders.size) return;
  const d = durum(si), dugum = new Map();
  d.kaynak.forEach((kis, id) => { const s = d.satir.get(id); if (!s || s.gizli || s.r === null || !ders.has(s.ders)) return; kis.forEach(ki => (dugum.get(ki) || dugum.set(ki, []).get(ki)).push(s)); });
  for (const x of liste) {
    const l = dugum.get(x.ki); if (!l) continue;
    const ort = f => l.reduce((t, s) => t + f(s), 0) / l.length, r = ort(s => s.r), alt = r < hedef - 1e-9;
    const cizgiGun = l.length === 1 ? l[0].cizgiGun : alt ? Math.max(...l.filter(s => s.r < hedef).map(s => s.cizgiGun)) : Math.min(...l.filter(s => s.r >= hedef).map(s => s.cizgiGun));
    Object.assign(x, {rKendi: x.r, r, altinda: alt, cizgiGun, sGun: ort(s => s.sGun), harita: l.map(s => s.id)});
  }
}

/* ---- teacher: learning the links over the notebook (Ayarlar → Öğrenci kalibrasyonu) ---- */
const LINKLER = V.baglar.filter(b => (b.tur || 'kullanir') === 'kullanir').map(b => b.alt + '>' + b.ust);
let ogreniyor = null;
const yuvarla = x => Math.round(x * 1000) / 1000;
// Only what was learnt is kept: shared values for every link, a student's own only where they had results on it.
function sikistir(p) {
  const tek = v => { const o = {n: {}}; for (const k of ['kredi', 'ceza', 'cekis']) if (Number.isFinite(v[k])) { o[k] = yuvarla(v[k]); o.n[k] = (v.n || {})[k] || 0; } return o; };
  const paylasilan = {}; for (const [a, v] of Object.entries(p.paylasilan || {})) paylasilan[a] = tek(v);
  const ogrenci = {};
  for (const [s, l] of Object.entries(p.ogrenci || {})) { const m = {}; for (const [a, v] of Object.entries(l)) if (Object.values(v.n || {}).some(n => n > 0)) m[a] = tek(v); if (Object.keys(m).length) ogrenci[s] = m; }
  return {paylasilan, ogrenci};
}
async function ogren(ilerleme) {
  if (ogreniyor) return ogreniyor;
  ogreniyor = (async () => {
    const cz = cozumle(), ogrenciler = [];
    (D.ogr || []).forEach((o, si) => { if (o && o.aktif !== false && dersleri(o).length) { const g = girdi(si, cz); if (g.sonuclar.length) ogrenciler.push({anahtar: g.anahtar, sonuclar: g.sonuclar, bugun: g.bugun, konuEk: g.konuEk, birimEk: g.birimEk, ayarlar: g.ayarlar, anlatimlar: g.anlatimlar}); } });
    const ilk = ogrenciler.length ? girdi(D.ogr.findIndex(o => o && ogrAnahtar(o) === ogrenciler[0].anahtar), cz) : null;
    let p = (D.hafizaAg && D.hafizaAg.parametreler) || {paylasilan: {}, ogrenci: {}}, notlar = [];
    if (ilk) for (let i = 0; i < LINKLER.length; i++) {
      // one link at a time, yielding between links so the page stays responsive
      const r = HAFIZA_AG.ogren({konular: ilk.konular, baglar: V.baglar, birimler: ilk.birimler, ogrenciler, parametreler: p, sadece: [LINKLER[i]]});
      p = {paylasilan: Object.assign({}, p.paylasilan, r.paylasilan), ogrenci: r.ogrenci};
      notlar = notlar.filter(n => n.anahtar !== LINKLER[i]).concat(r.notlar);
      if (ilerleme) ilerleme((i + 1) / LINKLER.length);
      await new Promise(res => setTimeout(res, 0));
    }
    D.hafizaAg = {parametreler: sikistir(p), son: Date.now(), ogrenciSayisi: ogrenciler.length, sonucSayisi: ogrenciler.reduce((t, s) => t + s.sonuclar.length, 0), notlar: notlar.map(n => ({anahtar: n.anahtar, deger: yuvarla(n.deger), n: n.n}))};
  })();
  try { await ogreniyor; } finally { ogreniyor = null; }
}
function ogretmenKarti() {
  const h = D.hafizaAg || {}, salt = typeof yalnizcaGoruntuleme === 'function' && yalnizcaGoruntuleme();
  const ad = id => (KONU.get(id) || {}).ad || id, link = a => { const [alt, ust] = a.split('>'); return kac(ad(ust)) + ' → ' + kac(ad(alt)); };
  const ogr = (D.ogr || []).map((o, si) => [o, si]).filter(([o]) => o && o.aktif !== false && dersleri(o).length);
  return '<div class="kart hm-ogretmen" id="hmOgretmen"><h2>Bağlantılı hafıza</h2>' +
    '<p class="mini">Konu haritasındaki bağların gücünü bu defterdeki öğrencilerin gerçek sonuçlarından öğrenir. Öğrenilen değerleri şimdilik yalnızca siz görürsünüz; öğrencilerin Haritam’ı başlangıç değerleriyle (0,5) çalışır.</p>' +
    (h.son ? '<p>Son güncelleme: <b>' + new Date(h.son).toLocaleString('tr-TR') + '</b> · ' + h.ogrenciSayisi + ' öğrenci, ' + h.sonucSayisi + ' sonuç</p>' : '<p class="mini">Henüz güncellenmedi.</p>') +
    (salt ? '' : '<div class="arac"><button type="button" class="dugme birincil" id="hmOgren">Bağları güncelle</button><progress id="hmIlerleme" max="1" value="0" hidden></progress></div>') +
    ((h.notlar || []).length ? '<h3>Tutmuyor gibi görünen bağlar</h3><ul class="mini">' + h.notlar.map(n => '<li>' + link(n.anahtar) + ' · öğrenilen kredi ' + String(n.deger).replace('.', ',') + ' (' + n.n + ' sonuç). Bu bağı gözden geçirin.</li>').join('') + '</ul>' : '') +
    (ogr.length ? '<div class="arac"><label>Öğrencinin haritası <select id="hmOgrSec">' + ogr.map(([o, si]) => '<option value="' + si + '">' + kac(o.ad || ('Öğrenci ' + (si + 1))) + '</option>').join('') + '</select></label><button type="button" class="dugme" id="hmOgrAc">Aç</button></div>' : '') +
    '</div>';
}

/* ---- drawing ---- */
const kac = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const sabit = n => Math.round(n * 10) / 10;
const dar = () => { try { return innerWidth < 640; } catch (e) { return false; } };
// Subjects in rows of two (one column on a phone). Every subject keeps its own layout at one shared scale, so a link is
// as long in each; a bigger subject gets more room and the map grows taller instead of crowding. B: each subject's box.
function konumlar(dersler, W) {
  const YER = Object.fromEntries(dersler.map(d => [d, yerAl(d)])), pad = 46, ust = 34, ara = 60, baslik = 26, bosluk = dar() ? 72 : 40; // phone labels are larger
  const K = new Map(dersler.map(d => { const v = [...YER[d].values()], xs = v.map(p => p.x), ys = v.map(p => p.y);
    return [d, {w: Math.max(1, Math.max(...xs) - Math.min(...xs)), h: Math.max(1, Math.max(...ys) - Math.min(...ys))}]; }));
  const sut = dersler.length > 1 && !dar() ? 2 : 1, satirlar = [];
  for (let i = 0; i < dersler.length; i += sut) satirlar.push(dersler.slice(i, i + sut));
  const olcek = Math.min(2.6, ...satirlar.map(r => (W - pad - ara * r.length) / r.reduce((t, d) => t + K.get(d).w, 0)));
  const P = new Map(), B = {}; let y = ust;
  for (const r of satirlar) {
    const yuk = Math.max(...r.map(d => K.get(d).h)) * olcek, bos = (W - pad - r.reduce((t, d) => t + K.get(d).w * olcek, 0)) / r.length;
    let x = pad / 2;
    for (const d of r) {
      const w = K.get(d).w * olcek + bos, cx = x + w / 2, cy = y + baslik + yuk / 2;
      B[d] = [x + bos / 2, y + baslik, x + w - bos / 2, y + baslik + yuk];
      YER[d].forEach((p, id) => P.set(id, {x: cx + p.x * olcek, y: cy + p.y * olcek}));
      x += w;
    }
    y += baslik + yuk + bosluk;
  }
  return {P, B, H: Math.max(320, Math.round(y))};
}
// Glow, ring and belt for one topic. guc: short-term .175, settling and long-term .525 (shine is one step ahead of the
// ring; on 2026-11-18 lowered half a step, then 30 % more). Settling and long-term keep the white-hot core.
function noron(t, s, x, y, r, c, hedef, gid, dokun) {
  const parlak = s.katman === 'uzun' || s.katman === 'orta', guc = parlak ? .525 : .175, koyu = t === TEMA.koyu;
  let arka = '', on = '', govde = '';
  const isik = (R, a) => `<circle cx="${sabit(x)}" cy="${sabit(y)}" r="${sabit(R)}" fill="url(#${gid})" opacity="${sabit(a * 100) / 100}"/>`;
  govde += isik(r * 8 * (.55 + .45 * guc), (koyu ? .45 : .3) * guc) + isik(r * 3.6 * (.55 + .45 * guc), (koyu ? .75 : .5) * guc);
  // Saturn ring (long-term): golden when safe until YKS; an asteroid belt when the topic has fallen under the line
  if (s.katman === 'uzun' && !KONU.get(s.id).gizli) {
    const hc = s.sinavaKadar ? ALTIN : c, kir = s.r < hedef ? Math.min(1, (hedef - s.r) / .35) : 0, RX = r * 3.1, RY = r * 1.05, don = 'rotate(-22 ' + sabit(x) + ' ' + sabit(y) + ')';
    const yay = (ust) => `M${sabit(x - RX)},${sabit(y)} A${sabit(RX)},${sabit(RY)} 0 0 ${ust ? 0 : 1} ${sabit(x + RX)},${sabit(y)}`;
    if (!kir) {
      arka += `<path d="${yay(true)}" transform="${don}" fill="none" stroke="${hc}" stroke-opacity="${s.sinavaKadar ? .55 : .4}" stroke-width="${s.sinavaKadar ? 1.3 : 1}"/>`;
      on += (s.sinavaKadar ? `<path d="${yay(false)}" transform="${don}" fill="none" stroke="${ALTIN}" stroke-opacity="${koyu ? .3 : .25}" stroke-width="4"/>` : '') +
        `<path d="${yay(false)}" transform="${don}" fill="none" stroke="${hc}" stroke-opacity="${s.sinavaKadar ? 1 : .85}" stroke-width="${s.sinavaKadar ? 1.6 : 1.2}"/>`;
    } else {
      const iz = (1 - kir) * (1 - kir);
      if (iz > .02) { arka += `<path d="${yay(true)}" transform="${don}" fill="none" stroke="${hc}" stroke-opacity="${sabit(.35 * iz * 100) / 100}"/>`;
        on += `<path d="${yay(false)}" transform="${don}" fill="none" stroke="${hc}" stroke-opacity="${sabit(.75 * iz * 100) / 100}"/>`; }
      let sd = [...s.id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0 || 7; sd = sd % 2147483646 + 1;
      const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }, gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
      const N = Math.round(90 * (1 - .55 * kir)), cs = Math.cos(-22 * Math.PI / 180), sn = Math.sin(-22 * Math.PI / 180);
      let ka = '', ko = '';
      for (let i = 0; i < N; i++) {
        const th = 2 * Math.PI * rnd(), dr = gauss() * kir * .38, dz = gauss() * kir * .55, boy = rnd(), dus = rnd(), al = .35 + .65 * rnd(), on_ = Math.sin(th) > 0;
        if (dus < kir * .35) continue;
        const lx = RX * (1 + dr) * Math.cos(th), ly = RY * (1 + dr) * Math.sin(th) + dz * RY, px = x + lx * cs - ly * sn, py = y + lx * sn + ly * cs;
        const sz = (boy > .93 ? 1 + .8 * rnd() : boy > .7 ? .6 + .4 * rnd() : .3 + .3 * rnd()) * Math.max(.7, r / 5), a = (on_ ? .95 : .5) * al * (1 - .55 * kir);
        const sekil = sz > 1 ? (() => { const rot = rnd() * 6.28; return `<polygon points="${[0, 1, 2, 3, 4].map(q => { const an = rot + q * 1.2566, rr = sz * (.65 + .5 * rnd()); return sabit(px + rr * Math.cos(an)) + ',' + sabit(py + rr * Math.sin(an)); }).join(' ')}" fill-opacity="${sabit(a * 100) / 100}"/>`; })()
          : `<circle cx="${sabit(px)}" cy="${sabit(py)}" r="${sabit(sz)}" fill-opacity="${sabit(a * 100) / 100}"/>`;
        if (on_) ko += sekil; else ka += sekil;
      }
      arka += `<g fill="${hc}">${ka}</g>`; on += `<g fill="${hc}">${ko}</g>`;
    }
  }
  const cekirdek = KONU.get(s.id).gizli ? `<circle cx="${sabit(x)}" cy="${sabit(y)}" r="${sabit(r)}" fill="${t.zemin}" stroke="${c}" stroke-width="1.3"/>`
    : parlak ? `<circle cx="${sabit(x)}" cy="${sabit(y)}" r="${sabit(r)}" fill="url(#${gid}c)"/>` : `<circle cx="${sabit(x)}" cy="${sabit(y)}" r="${sabit(r)}" fill="${c}"/>`;
  return (s.alarm ? `<g class="hm-yan">${govde}</g>` : govde) + arka + cekirdek + on + (dokun ? `<circle cx="${sabit(x)}" cy="${sabit(y)}" r="${sabit(r + 3.5)}" fill="none" stroke="${koyu ? '#fff' : '#000'}" stroke-opacity=".7"/>` : '');
}
function cizim(si, d, dersler, secili) {
  const t = koyuMu() ? TEMA.koyu : TEMA.acik, W = dar() ? 560 : 1100;
  const {P, B, H} = konumlar(dersler, W), gor = new Set(P.keys()), sat = d.satir;
  const sirali = d.out.konular.map(s => s.onem).sort((a, b) => a - b), tavan = Math.max(1, sirali[Math.floor(sirali.length * .85)] || 1);
  const yaricap = s => (KONU.get(s.id).gizli ? 2.2 : 2.8 + 2.8 * Math.sqrt(Math.min(1, s.onem / tavan))) * (s.id === secili ? 1.6 : 1);
  const komsu = new Set(secili ? [secili] : []); if (secili) KENAR.forEach(e => { if (e.a === secili) komsu.add(e.b); if (e.b === secili) komsu.add(e.a); });
  let defs = '', ipler = '', dugumler = '', yazilar = '';
  // a phone shows the 560-wide drawing at about 350 px: labels are drawn larger there to stay readable
  const adlar = [], yazi = dar() ? 1.45 : 1;
  const grad = new Map(), gradId = c => { if (!grad.has(c)) { const id = 'hmg' + grad.size; grad.set(c, id);
    defs += `<radialGradient id="${id}"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="${id}c"><stop offset="0" stop-color="${t.cekirdek}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${c}"/></radialGradient>`; } return grad.get(c); };
  for (const [ders, k] of Object.entries(B)) yazilar += `<text x="${sabit((k[0] + k[2]) / 2)}" y="${sabit(k[1] - 12)}" class="hm-ders" fill="${t.yazi}">${kac(dersAd(ders).toLocaleUpperCase('tr'))}</text>`;
  KENAR.forEach((e, i) => {
    if (!gor.has(e.a) || !gor.has(e.b)) return;
    const p = P.get(e.a), q = P.get(e.b), ayni = KONU.get(e.a).ders === KONU.get(e.b).ders, sa = sat.get(e.a), sb = sat.get(e.b), yanik = sa.katman === 'uzun' && sb.katman === 'uzun' && sa.r >= d.hedef && sb.r >= d.hedef;
    const yol = ayni ? `M${sabit(p.x)},${sabit(p.y)} L${sabit(q.x)},${sabit(q.y)}` : `M${sabit(p.x)},${sabit(p.y)} Q${sabit((p.x + q.x) / 2 + (q.y - p.y) * .12)},${sabit((p.y + q.y) / 2 - (q.x - p.x) * .12)} ${sabit(q.x)},${sabit(q.y)}`;
    const renkli = yanik ? t.nane : null, yakin = secili && (e.a === secili || e.b === secili);
    ipler += `<path class="hm-ip${yakin ? ' hm-yakin' : ''}" data-a="${e.a}" data-b="${e.b}" d="${yol}" fill="none" stroke="${renkli || 'rgb(' + t.ip + ')'}" stroke-opacity="${renkli ? .28 : ayni ? .14 : .07}" stroke-width="${sabit(.7 + e.u * .4)}"${e.ic ? ' stroke-dasharray="2 3"' : ''}/>`;
  });
  for (const s of d.out.konular) {
    if (!gor.has(s.id)) continue;
    const p = P.get(s.id), r = yaricap(s), k = KONU.get(s.id), ki = (d.kaynak.get(k.gizli ? k.parcasi : s.id) || [])[0];
    const ic = s.r == null ? `<circle cx="${sabit(p.x)}" cy="${sabit(p.y)}" r="${sabit(r * .7)}" fill="${t.bos}"/>` : noron(t, s, p.x, p.y, r, renk(t, s.r, d.hedef), d.hedef, gradId(renk(t, s.r, d.hedef)), s.id === secili);
    dugumler += `<g class="hm-d${komsu.has(s.id) ? ' hm-yakin' : ''}" data-hm="${s.id}" data-x="${sabit(p.x)}" data-y="${sabit(p.y)}"${ki !== undefined ? ' data-hm-ki="' + ki + '"' : ''} tabindex="0" role="button" aria-label="${kac(k.ad)}">` +
      `<circle class="hm-vur" cx="${sabit(p.x)}" cy="${sabit(p.y)}" r="${sabit(Math.max(10, r * 2.4))}" fill="transparent"/>${ic}</g>`;
    adlar.push({s, k, x: p.x, y: p.y + r + 14 * yazi});
  }
  // Labels: the chosen topic's neighbours always; then alarms (in alarm order) and foundations (by importance), each only
  // where it covers no label already placed. Every other label is drawn hidden and shows while its topic is next to the
  // one touched.
  const once = a => komsu.has(a.s.id) ? 0 : a.s.alarm ? 1 : a.s.temel ? 2 : 3, alarmSira = new Map(d.out.alarmlar.map((id, i) => [id, i]));
  const kutular = Object.entries(B).map(([ders, k]) => { const w = ders.length * 8.5 + 10, x = (k[0] + k[2]) / 2; return [x - w / 2, k[1] - 24, x + w / 2, k[1] - 8]; });
  adlar.sort((a, b) => once(a) - once(b) || (alarmSira.get(a.s.id) ?? 0) - (alarmSira.get(b.s.id) ?? 0) || b.s.onem - a.s.onem);
  for (const a of adlar) {
    const metin = a.k.ad.length > 30 ? a.k.ad.slice(0, 29) + '…' : a.k.ad, w = metin.length * 5.7 * yazi + 6;
    a.x = Math.min(W - w / 2 - 4, Math.max(w / 2 + 4, a.x)); // never cut at the edge
    const b = [a.x - w / 2, a.y - 10 * yazi, a.x + w / 2, a.y + 3 * yazi];
    const goster = once(a) === 0 || (once(a) < 3 && !kutular.some(c => b[0] < c[2] && c[0] < b[2] && b[1] < c[3] && c[1] < b[3]));
    if (goster) kutular.push(b);
    yazilar += `<text class="hm-ad${komsu.has(a.s.id) ? ' hm-yakin' : ''}${goster ? '' : ' hm-sakla'}" data-hm-ad="${a.s.id}" x="${sabit(a.x)}" y="${sabit(a.y)}" fill="${komsu.has(a.s.id) ? t.yaziGuclu : t.yazi}" stroke="${t.zemin}">${kac(metin)}</text>`;
  }
  return {svg: `<svg class="hm-svg${secili ? ' hm-odak' : ''}${yazi > 1 ? ' hm-dar' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Konu haritası" style="background:${t.zemin}"><defs>${defs}</defs>${ipler}${dugumler}${yazilar}</svg>`, P, W, H};
}

/* ---- the Hafızam card for a map topic ---- */
function kart(si, d, id) {
  const k = KONU.get(id), s = d.satir.get(id), asil = k.gizli ? k.parcasi : id, kis = d.kaynak.get(asil) || [], ki = kis[0];
  // The card of the notebook topic Hafızam knows (plan topic first, then a school unit covering it).
  const hd = hafizaDurumu(si), x = kis.map(i => hd.liste.find(y => y.ki === i)).find(Boolean) || null;
  const parca = k.gizli ? '<p class="mini hm-parca">' + kac(k.ad) + ' · ' + kac(KONU.get(k.parcasi).ad) + ' konusunun parçası</p>' : '';
  if (!x || s.r == null) return '<div class="hf-oge hm-bos"><div class="hf-ad"><span class="d">' + kac(dersAd(KONU.get(asil).ders)) + '</span><span class="k">' + kac(KONU.get(asil).ad) + '</span></div>' + parca +
    '<p class="mini">' + (ki === undefined ? 'Bu konu senin planında yok.' : 'Henüz çalışmadın: derste işlendiğinde ya da sonucunu girdiğinde burada parlar.') + '</p></div>';
  // Hafızam already shows this node's value on its plan topic. A school unit covering several nodes shows their mean
  // there; here the card shows this node's value and says so.
  const a = d.satir.get(asil), r = a.r ?? s.r, birlikte = !!x.harita && x.harita.length > 1;
  const y = x.harita && !birlikte ? x : Object.assign({}, x, {r, altinda: r < d.hedef - 1e-9, cizgiGun: a.cizgiGun ?? s.cizgiGun, sGun: a.sGun ?? s.sGun, rKendi: undefined});
  const unite = birlikte ? '<p class="mini hm-parca">Okuldaki ' + kac(konuGorunenAdi(x.ad)) + ' ünitesinden · Hafızam’da ünitenin ortalaması %' + Math.round(x.r * 100) + '</p>' : '';
  return parca + unite + hafizaSatiri(si, y, hd, hafizaPlani(si));
}

/* ---- page ---- */
let son = null; // last render, for the hover card
function gorunum() {
  const si = EK.ogr, o = D.ogr[si], tum = dersleri(o);
  const ogretmen = !ogrenciMi(), baslik = ogretmen ? 'Haritası · ' + kac(o && o.ad || '') : 'Haritam';
  if (!tum.length) return '<div class="baslik"><h1>' + baslik + '</h1><p>Harita şimdilik matematik ve fizik konuları için var.</p></div>';
  const filtre = tum.includes(EK.haritamDers) ? EK.haritamDers : '', dersler = filtre ? [filtre] : tum;
  const d = durum(si), secili = d.satir.has(EK.haritamSecili) ? EK.haritamSecili : null, c = cizim(si, d, dersler, secili);
  son = {si, d, P: c.P, W: c.W, H: c.H};
  const t = koyuMu() ? TEMA.koyu : TEMA.acik;
  const cipler = '<div class="hm-cipler" role="group" aria-label="Ders">' + [['', 'Tümü']].concat(tum.map(x => [x, dersAd(x)])).map(([v, ad]) =>
    '<button type="button" class="dugme mini' + (v === filtre ? ' secili' : '') + '" data-hm-ders="' + kac(v) + '" aria-pressed="' + (v === filtre) + '">' + kac(ad) + '</button>').join('') + '</div>';
  const alarmlar = d.out.ust3.filter(id => d.satir.has(id)).map(id => { const s = d.satir.get(id), k = KONU.get(id), c2 = renk(t, s.r, d.hedef);
    const ne = {gri: 'Eksik temel', kirmizi: 'Unutuluyor', turuncu: 'Kontrol testi', sari: 'Henüz kalıcı değil'}[s.alarm];
    return '<button type="button" class="hm-alarm-cip" data-hm-sec="' + kac(id) + '"><i style="background:' + c2 + ';box-shadow:0 0 8px ' + c2 + '"></i><b>' + kac(k.ad) + '</b><span>' + ne + '</span></button>'; }).join('');
  const kartHtml = secili ? kart(si, d, secili) : '', yer = secili ? kartYeri(c.P, c.W, c.H, secili) : null;
  const ornek = (cls, svg) => '<span class="hm-ornek ' + cls + '"><svg viewBox="-12 -8 24 16" width="24" height="16" aria-hidden="true">' + svg + '</svg>';
  const n = t.nane, g = (r, a) => '<circle r="' + r + '" fill="' + n + '" opacity="' + a + '"/>';
  const lejant = '<div class="hm-lejant">' +
    '<span><i class="hm-yelpaze" style="background:linear-gradient(90deg,' + renk(t, .45, .9) + ',' + renk(t, .89, .9) + ' 72%,' + n + ' 72%)"></i>hatırlama: çizginin altı → üstü</span>' +
    ornek('', g(5.2, .1) + '<circle r="3" fill="' + n + '"/>') + 'hafif ışık: kısa süreli</span>' +
    ornek('', g(7, .24) + '<circle r="3.2" fill="#fff" stroke="' + n + '" stroke-width="1.4"/>') + 'ışıldıyor: pekişiyor</span>' +
    ornek('', '<path d="M-11,0 A11,3.8 0 0 1 11,0" transform="rotate(-22)" fill="none" stroke="' + n + '" stroke-opacity=".45"/><circle r="3.2" fill="#fff" stroke="' + n + '" stroke-width="1.4"/><path d="M11,0 A11,3.8 0 0 1 -11,0" transform="rotate(-22)" fill="none" stroke="' + n + '"/>') + 'halka: uzun süreli</span>' +
    ornek('', '<path d="M-11,0 A11,3.8 0 0 1 11,0" transform="rotate(-22)" fill="none" stroke="' + ALTIN + '" stroke-opacity=".6"/><circle r="3.2" fill="#fff" stroke="' + n + '" stroke-width="1.4"/><path d="M11,0 A11,3.8 0 0 1 -11,0" transform="rotate(-22)" fill="none" stroke="' + ALTIN + '" stroke-width="1.5"/>') + 'altın halka: YKS’ye kadar kalıcı</span>' +
    '<span>dağılan halka: kalıcıydı, unutuluyor</span><span>yanıp sönen: dikkat isteyen temel</span><span>büyük nokta: çok konu ona dayanıyor</span></div>';
  return '<div class="hm-sayfa"><div class="baslik"><h1>' + baslik + '</h1><p>' + (ogretmen ? 'Öğrencinin konu haritası; bağlar bu defterden öğrenilen değerlerle hesaplanır. ' +
      '<button type="button" class="dugme mini" id="hmGeri">Ayarlar’a dön</button>' : 'Her nokta bir konu; ışığı ne kadar kalıcı olduğunu, rengi ne kadar hatırladığını gösterir. Bir konuya dokun.') + '</p></div>' +
    cipler + (alarmlar ? '<div class="hm-alarmlar">' + alarmlar + '</div>' : '') +
    // One card: over the map on a computer, under it on a phone (CSS); pinned until the topic is touched again.
    '<div class="hm-harita" data-hm-harita>' + c.svg + '<div class="hm-kart-yer' + (secili ? ' hm-sabit' : '') + '"' + (yer ? ' style="left:' + yer.x + '%;top:' + yer.y + '%"' : ' hidden') + ' data-hm-kart>' + kartHtml + '</div></div>' +
    lejant + '</div>';
}
// The card goes on the side of the topic that covers the fewest topics (percent of the map).
function kartYeri(P, W, H, id) {
  const p = P.get(id); if (!p) return null;
  const cw = 340 * W / 1100, ch = 190, gap = 24, sinir = (x, y) => [Math.max(6, Math.min(W - cw - 6, x)), Math.max(6, Math.min(H - ch - 6, y))];
  const aday = [[p.x + gap, p.y - ch / 2], [p.x - cw - gap, p.y - ch / 2], [p.x - cw / 2, p.y + gap], [p.x - cw / 2, p.y - ch - gap]].map(([x, y]) => sinir(x, y));
  const ortu = ([x, y]) => [...P].reduce((n, [k, q]) => n + (q.x > x - 12 && q.x < x + cw + 12 && q.y > y - 12 && q.y < y + ch + 12 ? (k === id ? 50 : 1) : 0), 0);
  const [x, y] = aday.reduce((b, c) => ortu(c) < ortu(b) ? c : b);
  return {x: Math.round(x / W * 1000) / 10, y: Math.round(y / H * 1000) / 10};
}

/* ---- interaction: hover shows (fine pointer), click pins ---- */
const inceIsaretci = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return false; } };
function vurgula(svg, id) {
  if (!svg) return;
  const komsu = new Set([id]); KENAR.forEach(e => { if (e.a === id) komsu.add(e.b); if (e.b === id) komsu.add(e.a); });
  svg.classList.toggle('hm-odak', !!id);
  svg.querySelectorAll('.hm-d').forEach(g => g.classList.toggle('hm-yakin', !!id && komsu.has(g.dataset.hm)));
  svg.querySelectorAll('.hm-ip').forEach(p => p.classList.toggle('hm-yakin', !!id && (p.dataset.a === id || p.dataset.b === id)));
  svg.querySelectorAll('.hm-ad').forEach(t => t.classList.toggle('hm-yakin', !!id && komsu.has(t.dataset.hmAd)));
}
let baglandi = false;
function bagla() {
  if (baglandi || typeof document === 'undefined' || !document.addEventListener) return; baglandi = true;
  document.addEventListener('pointerover', ev => {
    if (EK.sekme !== 'haritam' || EK.haritamSecili || !son || !inceIsaretci()) return;
    const g = ev.target.closest && ev.target.closest('.hm-d'), harita = document.querySelector('[data-hm-harita]'), yer = harita && harita.querySelector('[data-hm-kart]');
    if (!harita || !yer) return;
    if (!g || !harita.contains(g)) { if (!ev.target.closest || !ev.target.closest('[data-hm-kart]')) { yer.hidden = true; vurgula(harita.querySelector('svg'), null); } return; }
    const id = g.dataset.hm, p = kartYeri(son.P, son.W, son.H, id);
    try { yer.innerHTML = kart(son.si, son.d, id); } catch (e) { return; }
    yer.style.left = p.x + '%'; yer.style.top = p.y + '%'; yer.hidden = false; vurgula(harita.querySelector('svg'), id);
  });
  document.addEventListener('click', async ev => {
    const id = ev.target && ev.target.id;
    if (id === 'hmOgren') {
      const btn = ev.target, bar = document.getElementById('hmIlerleme'); btn.disabled = true; if (bar) bar.hidden = false;
      try { await ogren(f => { if (bar) bar.value = f; }); await kaydet(true); } finally { ciz(); }
      return;
    }
    if (id === 'hmOgrAc') { const sel = document.getElementById('hmOgrSec'); EK.ogr = +sel.value; EK.haritamSecili = undefined; EK.haritamDers = undefined; EK.sekme = 'haritam'; ciz(); return; }
    if (id === 'hmGeri') { EK.sekme = 'ayarlar'; EK.ayarBolum = 'kalibrasyon'; ciz(); return; }
    if (EK.sekme !== 'haritam') return;
    const ders = ev.target.closest && ev.target.closest('[data-hm-ders]');
    if (ders) { EK.haritamDers = ders.dataset.hmDers || undefined; EK.haritamSecili = undefined; ciz(); return; }
    const sec = ev.target.closest && (ev.target.closest('[data-hm-sec]') || ev.target.closest('.hm-d'));
    if (sec) { const id = sec.dataset.hmSec || sec.dataset.hm; EK.haritamSecili = EK.haritamSecili === id ? undefined : id; ciz(); return; }
    if (ev.target.closest && ev.target.closest('.hm-svg') && EK.haritamSecili) { EK.haritamSecili = undefined; ciz(); }
  });
  document.addEventListener('keydown', ev => {
    if (EK.sekme !== 'haritam' || (ev.key !== 'Enter' && ev.key !== ' ')) return;
    const g = ev.target.closest && ev.target.closest('.hm-d'); if (!g) return;
    ev.preventDefault(); EK.haritamSecili = EK.haritamSecili === g.dataset.hm ? undefined : g.dataset.hm; ciz();
  });
}
bagla();
// kaynaklar: map topic → the notebook topic ids that feed it (plan topics, then school units)
const kaynaklar = () => { const {esler, birimler} = cozumle(); return new Map(V.konular.map(k => [k.id, (esler.get(k.id) || []).concat(birimler.filter(b => b.kapsar.includes(k.id)).map(b => b.id))])); };
return {gorunum, uygun, dersleri, durum, girdi, cozumle, kaynaklar, hafizayaUygula, ogren, ogretmenKarti, renk, oklch, TEMA};
})();
