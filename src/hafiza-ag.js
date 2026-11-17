// Bağlantılı hafıza: FSRS-6 on a map of topics (konu ağı). The agreed rules: docs/baglantili-hafiza.md.
// Pure functions: no DOM, no storage. Not embedded in index.html yet; test/hafiza-ag-regression.cjs runs it beside the
// app's own FSRS-6 (hatirlama, hatirlaS, unutS, ilkS, ilkD, yeniD, FACTOR, DECAY), or `opts.fsrs` supplies them.
// Days are integer day numbers (the app's bugunNo()). Only real results and lesson days go in; an assumed "İyi" never does.
//
// One kind of link: {alt, ust, kullanim} — `ust` uses `alt` (alt is its foundation, whatever order the müfredat teaches
// them). kullanim = how much of alt it uses: az 0.25 · çok 0.5 · tam 1. How much memory flows is separate and learned
// per link (kredi, ceza, çekiş; each starts at 0.5, provisional). A hidden part {gizli: true, parcasi: X} is a piece of X
// that is not a müfredat topic: a test of X is its own test. Twins {esler: [...]} are one node with one memory.
// {tur: 'karisik'} links (confusable topics) are kept for the teacher's drawing only and change nothing.
const HAFIZA_AG = (() => {
const KULLANIM = Object.freeze({az: 0.25, cok: 0.5, tam: 1});
const PARAMLAR = Object.freeze(['kredi', 'ceza', 'cekis']);
const IZGARA = Object.freeze([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]);
const AYAR = Object.freeze({
  hedef: 0.9,          // the student's recall target (the app's hedefTutma): the red line and the exam star
  ufuk: 7,             // risk = chance of having forgotten within this many days
  kisa: 7, uzun: 30,   // memory level on S in days (time for recall to fall to 90 %): < 7 kısa, 7–30 pekişiyor, ≥ 30 uzun
  esik: 0.05,          // credit or use below this share of a review is dropped (chains die out)
  kredi: 0.5,          // starting share of a review a foundation gets when a topic using it fully is passed
  ceza: 0.5,           // starting share of a lapse a topic gets when a foundation it fully uses is failed
  cekis: 0.5,          // starting share of the gap by which a weaker foundation pulls the shown recall down
  ortukNotTavan: 3,    // credit counts as at most "İyi"
  temelEsik: 1.5,      // foundational: topics using it, weighted by use (tam 1, çok 0.5, az 0.25), add up to this
  ozGuven: 10,         // own results on a link after which a student's data weighs as much as the shared value
  yilKatsayi: 0.9,     // past exams: each year counts this much of the year after it
  kontrolSoru: 5,      // questions in a check test
  ornekPencere: 30,    // at most one sample check per student in this many days
  ornekBosluk: 30,     // sample only foundations without an own test for this many days, kept up by credit
  kotuBag: 0.1, kotuBagN: 30 // a link whose learned kredi falls below this on at least this many results: tell the teacher
});
const sinirla = (x, a, b) => Math.min(b, Math.max(a, x));
const RENK_SIRA = Object.freeze({gri: 0, kirmizi: 1, turuncu: 2, sari: 3});

function fsrsAl(o) {
  if (o && o.fsrs) return o.fsrs;
  try { return {hatirlama, hatirlaS, unutS, ilkS, ilkD, yeniD, FACTOR, DECAY}; } // eslint-disable-line no-undef
  catch (e) { throw new Error('HAFIZA_AG: FSRS-6 functions not found; pass opts.fsrs'); }
}
function ayarKur(opts) {
  const o = Object.assign({}, AYAR);
  Object.keys(AYAR).forEach(a => { const v = opts && opts[a]; if (Number.isFinite(v) && v >= 0) o[a] = v; });
  o.hedef = sinirla(o.hedef, 0.5, 0.99); PARAMLAR.forEach(p => { o[p] = sinirla(o[p], 0, 1); });
  return o;
}

/* ---- the map ---- */
function agKur(konular, baglar, birimler) {
  const dugum = new Map(), takma = new Map(), uyarilar = [], asagi = new Map(), yukari = new Map(), parcalar = new Map(), karisik = [], birim = new Map();
  const ekle = (m, a, x) => { let l = m.get(a); if (!l) m.set(a, l = []); l.push(x); };
  (konular || []).forEach((k, i) => {
    if (!k || k.id == null || dugum.has(k.id)) return void uyarilar.push('konu ' + i + ': kimliği yok ya da tekrar ediyor');
    dugum.set(k.id, k); takma.set(k.id, k.id);
  });
  dugum.forEach(k => (k.esler || []).forEach(e => {
    if (takma.has(e)) uyarilar.push('eş ' + e + ': başka bir konuya ait'); else takma.set(e, k.id);
  }));
  // School units (grade 9–11): a result or lesson on a unit counts for every YKS topic it covers.
  (birimler || []).forEach((b, i) => {
    const kapsar = [...new Set((b && b.kapsar || []).map(x => takma.get(x)).filter(x => x != null))];
    if (!b || b.id == null || takma.has(b.id) || birim.has(b.id) || !kapsar.length) return void uyarilar.push('birim ' + i + ': kimliği ya da kapsadığı konu yok');
    birim.set(b.id, {kapsar, ogrenildi: b.ogrenildi});
  });
  const bagla = (alt, ust, u, ic) => {
    const anahtar = alt + '>' + ust, var_ = (asagi.get(ust) || []).find(e => e.id === alt);
    if (var_) { uyarilar.push('bağ ' + anahtar + ': iki kez çizilmiş, büyüğü kaldı'); if (u > var_.u) { var_.u = u; (yukari.get(alt) || []).find(e => e.id === ust).u = u; } return; }
    ekle(asagi, ust, {id: alt, u, anahtar, ic}); ekle(yukari, alt, {id: ust, u, anahtar, ic});
  };
  dugum.forEach((k, id) => {
    if (!k.gizli) return;
    if (!dugum.has(k.parcasi) || k.parcasi === id) return void uyarilar.push('parça ' + id + ': ait olduğu konu yok');
    ekle(parcalar, k.parcasi, id); bagla(id, k.parcasi, 1, true);
  });
  (baglar || []).forEach((b, i) => {
    const tur = b && b.tur ? b.tur : 'kullanir';
    const alt = b && takma.get(b.alt), ust = b && takma.get(b.ust);
    if (tur === 'karisik') { if (alt != null && ust != null && alt !== ust) karisik.push({a: alt, b: ust}); else uyarilar.push('bağ ' + i + ': konusu yok'); return; }
    if (tur !== 'kullanir') return void uyarilar.push('bağ ' + i + ': bilinmeyen tür');
    const u = typeof b.kullanim === 'number' ? b.kullanim : KULLANIM[b.kullanim];
    if (alt == null || ust == null || alt === ust) return void uyarilar.push('bağ ' + i + ': konusu yok ya da kendine bağlı');
    if (!(u > 0 && u <= 1)) return void uyarilar.push('bağ ' + i + ': kullanım az, çok ya da tam olmalı');
    bagla(alt, ust, u, false);
  });
  // How much each topic is used by every topic above it: the strongest path, use multiplied along it.
  const kullananlar = new Map(), temeller = new Map();
  dugum.forEach((_, id) => { kullananlar.set(id, enIyiYol(yukari, id, e => e.u, 1e-9)); temeller.set(id, new Set(enIyiYol(asagi, id, e => e.u, 1e-9).keys())); });
  return {dugum, takma, asagi, yukari, parcalar, karisik, birim, kullananlar, temeller, uyarilar};
}
// Strongest multiplied path from `kaynak` through `komsu` edges; Map id → share (kaynak left out).
function enIyiYol(komsu, kaynak, agirlik, esik, atla) {
  const en = new Map([[kaynak, 1]]), sira = [[kaynak, 1]];
  while (sira.length) {
    let i = 0; for (let j = 1; j < sira.length; j++) if (sira[j][1] > sira[i][1]) i = j;
    const [id, om] = sira.splice(i, 1)[0];
    if (om < en.get(id)) continue;
    for (const e of komsu.get(id) || []) {
      if (atla && atla(id, e)) continue;
      const x = om * agirlik(e);
      if (x < esik || x <= (en.get(e.id) || 0)) continue;
      en.set(e.id, x); sira.push([e.id, x]);
    }
  }
  en.delete(kaynak);
  return en;
}

/* ---- learned link values ---- */
// parametreler: {paylasilan: {anahtar: {kredi, ceza, cekis, n: {...}}}, ogrenci: {anahtar: {...}}} — ogrenci holds this
// student's values (already blended with the shared ones by ogren); without any, the starting values.
function paramOkuyucu(parametreler, o, ustune) {
  const pay = (parametreler && parametreler.paylasilan) || {}, og = (parametreler && parametreler.ogrenci) || {};
  return (anahtar, p) => {
    if (ustune && ustune.anahtar === anahtar && ustune.p === p) return ustune.deger;
    const a = og[anahtar] && og[anahtar][p], b = pay[anahtar] && pay[anahtar][p];
    return Number.isFinite(a) ? a : Number.isFinite(b) ? b : o[p];
  };
}

/* ---- running a student's lessons and results through the map ---- */
// kayit (optional) receives, before every own result, the predicted recall: {i, id, gun, p (shown), y}.
// kume (optional, for learning): only these topics (closed downward) are simulated; events elsewhere are skipped.
function calistir(girdi, o, F, ag, prm, kayit, olaylar, kume) {
  const bugun = girdi.bugun, durum = new Map(), ek = girdi.konuEk || {}, icinde = id => !kume || kume.has(id);
  let ilgili = null;
  if (kume) { ilgili = new Set(kume); kume.forEach(id => ag.kullananlar.get(id).forEach((_, u) => ilgili.add(u))); }
  const zincir = new Map();
  const ozellik = (id, a) => { const e = ek[id]; return e && e[a] !== undefined ? e[a] : ag.dugum.get(id)[a]; };
  const kat = id => { const v = ozellik(id, 'k'); return v > 0 ? v : 1; }, wp = id => ozellik(id, 'w');
  const al = id => { let x = durum.get(id); if (!x) durum.set(id, x = {s: 0, d: 0, son: null, bas: null, sonOz: null, kontrol: null, kredili: false, n: 0}); return x; };
  const var_ = id => { const x = durum.get(id); return !!x && x.s > 0; };
  const R = (id, gun) => { const x = durum.get(id); return F.hatirlama(Math.max(0, gun - x.son) / kat(id), x.s); };
  const yaz = olaylar ? e => olaylar.push(e) : () => {};
  // Shown recall: own recall pulled down by the weakest-relative foundation (strongest pull only; no pull from a
  // foundation without memory). Foundations' shown recall is used, so a weak base reaches further up the chain.
  const gosterilen = (id, gun, gor = new Set()) => {
    if (!var_(id)) return null;
    const oz = R(id, gun); if (gor.has(id)) return oz;
    gor.add(id); let cek = 0;
    for (const e of ag.asagi.get(id) || []) {
      if (e.ic) continue;
      const fb = gosterilen(e.id, gun, gor); if (fb === null) continue;
      cek = Math.max(cek, prm(e.anahtar, 'cekis') * e.u * Math.max(0, oz - fb));
    }
    gor.delete(id);
    return oz - cek;
  };
  const baslat = (id, gun, kaynak) => {
    if (!icinde(id)) return true;
    const x = al(id), w = wp(id); if (x.s > 0) return false;
    Object.assign(x, {s: F.ilkS(3, w), d: F.ilkD(3, true, w), son: gun, bas: gun});
    yaz({gun, kaynak, id, tur: 'basla'}); return true;
  };
  const oz = (id, not, gun) => {
    if (!icinde(id)) return;
    const x = al(id), w = wp(id);
    if (x.s > 0) { const r = R(id, gun); x.s = Math.max(not === 1 ? F.unutS(x.d, x.s, r, w) : F.hatirlaS(x.d, x.s, r, not, w), 0.001); x.d = F.yeniD(x.d, not, w); }
    else { x.s = F.ilkS(not, w); x.d = F.ilkD(not, true, w); x.bas = gun; }
    Object.assign(x, {son: gun, sonOz: gun, kontrol: null, kredili: false, n: x.n + 1});
  };
  // A pass (or a lesson, as "İyi") on the sources: foundations reached get a fractional review; one without memory
  // starts that day. Starting depends on use only, credit on use × the learned kredi of each link.
  const basari = (kaynaklar, not, gun) => {
    let z = zincir.get(kaynaklar[0]);
    if (!z) {
      const icAtla = (id, e) => e.ic && kaynaklar.includes(id) && kaynaklar.includes(e.id), kullanim = new Map(), pay = new Map();
      for (const k of kaynaklar) {
        enIyiYol(ag.asagi, k, e => e.u, o.esik, icAtla).forEach((v, id) => { if (!kaynaklar.includes(id) && icinde(id)) kullanim.set(id, Math.max(kullanim.get(id) || 0, v)); });
        enIyiYol(ag.asagi, k, e => e.ic ? 1 : e.u * prm(e.anahtar, 'kredi'), o.esik, icAtla).forEach((v, id) => { if (!kaynaklar.includes(id) && icinde(id)) pay.set(id, Math.max(pay.get(id) || 0, v)); });
      }
      zincir.set(kaynaklar[0], z = {kullanim, pay});
    }
    const {kullanim, pay} = z;
    kullanim.forEach((_, id) => {
      if (baslat(id, gun, kaynaklar[0])) return;
      const om = pay.get(id) || 0; if (om < o.esik) return;
      const x = durum.get(id), r = R(id, gun), sTam = Math.max(F.hatirlaS(x.d, x.s, r, Math.min(not, o.ortukNotTavan), wp(id)), x.s);
      const s = x.s * Math.pow(sTam / x.s, om), r2 = r + om * (1 - r);
      const t = r2 >= 1 ? 0 : s / F.FACTOR * (Math.pow(r2, 1 / F.DECAY) - 1);
      yaz({gun, kaynak: kaynaklar[0], id, tur: 'kredi', w: om, sOnce: x.s, sSonra: s, rOnce: r, rSonra: r2});
      x.s = s; x.son = gun - t * kat(id); x.kredili = true;
    });
  };
  // A failure on the sources: topics directly using them lose a share of a lapse (one step); their direct
  // foundations get a check flag and keep their memory.
  const basarisiz = (kaynaklar, gun) => {
    const pay = new Map();
    for (const k of kaynaklar) for (const e of ag.yukari.get(k) || []) {
      if (e.ic || kaynaklar.includes(e.id)) continue;
      pay.set(e.id, Math.max(pay.get(e.id) || 0, e.u * prm(e.anahtar, 'ceza')));
    }
    pay.forEach((om, id) => {
      if (om < o.esik || !icinde(id) || !var_(id)) return;
      const x = durum.get(id), r = R(id, gun), sH = Math.max(F.unutS(x.d, x.s, r, wp(id)), 0.001); if (sH >= x.s) return;
      const s = x.s * Math.pow(sH / x.s, om);
      yaz({gun, kaynak: kaynaklar[0], id, tur: 'ceza', w: om, sOnce: x.s, sSonra: s, rOnce: r, rSonra: F.hatirlama(Math.max(0, gun - x.son) / kat(id), s)});
      x.s = s;
    });
    for (const k of kaynaklar) for (const e of ag.asagi.get(k) || []) {
      if (e.ic || kaynaklar.includes(e.id) || !icinde(e.id)) continue;
      al(e.id).kontrol = {gun, kaynak: kaynaklar[0]}; yaz({gun, kaynak: kaynaklar[0], id: e.id, tur: 'kontrol'});
    }
  };

  const sira = [];
  ag.dugum.forEach((_, id) => { const g = ozellik(id, 'ogrenildi'); if (Number.isInteger(g) && g <= bugun) sira.push({gun: g, id, ders: true, i: -1}); });
  // a school unit's lesson day: this student's (birimEk, when learning over a notebook), else the map input's
  ag.birim.forEach((b, bid) => { const be = girdi.birimEk || {}, g = be[bid] !== undefined ? be[bid] : b.ogrenildi; if (Number.isInteger(g) && g <= bugun) b.kapsar.forEach(id => sira.push({gun: g, id, ders: true, i: -1})); });
  (girdi.sonuclar || []).forEach((r, i) => {
    if (!r || ![1, 2, 3, 4].includes(r.not) || !Number.isInteger(r.gun) || r.gun > bugun) return;
    const id = ag.takma.get(r.id), b = ag.birim.get(r.id);
    if (id != null) sira.push({gun: r.gun, id, not: r.not, i});
    else if (b) b.kapsar.forEach(k => sira.push({gun: r.gun, id: k, not: r.not, i}));
  });
  sira.sort((a, b) => a.gun - b.gun || a.i - b.i);
  for (const e of sira) {
    if (ilgili && !ilgili.has(e.id)) continue;
    const kaynaklar = [e.id, ...(ag.parcalar.get(e.id) || [])];
    if (e.ders) { kaynaklar.forEach(id => baslat(id, e.gun, e.id)); basari(kaynaklar, 3, e.gun); continue; }
    if (kayit) kaynaklar.forEach(id => { if (icinde(id) && var_(id)) kayit.push({i: e.i, id, gun: e.gun, p: gosterilen(id, e.gun), y: e.not > 1 ? 1 : 0}); });
    kaynaklar.forEach(id => oz(id, e.not, e.gun));
    if (e.not > 1) basari(kaynaklar, e.not, e.gun); else basarisiz(kaynaklar, e.gun);
  }
  return {durum, R, kat, var_, gosterilen};
}

/* ---- what the student sees ---- */
// girdi: {konular, baglar, birimler?: [{id, kapsar: [ids], ogrenildi?}], sonuclar: [{gun, id, not 1–4}], bugun, sinavGunu?,
//         konuEk?: {id: {k, w, ogrenildi}},
//         parametreler?, ornekGecmisi?: [{gun, id}], anahtar? (a stable student key for the sample draw)}
function hesapla(girdi, opts) {
  const o = ayarKur(opts), F = fsrsAl(opts), ag = agKur(girdi.konular, girdi.baglar, girdi.birimler), olaylar = [];
  if (!Number.isInteger(girdi.bugun)) throw new Error('HAFIZA_AG: bugun must be a day number');
  const prm = paramOkuyucu(girdi.parametreler, o);
  const {durum, R, kat, var_, gosterilen} = calistir(girdi, o, F, ag, prm, null, olaylar);
  const bugun = girdi.bugun, soru = id => { const v = ag.dugum.get(id).soru; return v > 0 ? v : 0; };
  const satirlar = [];
  ag.dugum.forEach((d, id) => {
    const x = durum.get(id), kul = ag.kullananlar.get(id);
    let agirlik = 0, onem = 2 * soru(id);
    kul.forEach((u, a) => { agirlik += u; onem += u * soru(a); });
    const s = {id, ad: d.ad, ders: d.ders, gizli: !!d.gizli, calis: d.gizli ? d.parcasi : id, onem, kullananAgirlik: agirlik,
      temel: agirlik >= o.temelEsik - 1e-9, r: null, rOz: null, sGun: null, katman: null, sinavaKadar: null, risk: null,
      sonOz: x ? x.sonOz : null, baslangic: x ? x.bas : null, kredili: !!(x && x.kredili), kontrol: x && x.kontrol ? x.kontrol : null, alarm: null};
    if (var_(id)) {
      s.rOz = R(id, bugun); s.r = gosterilen(id, bugun); s.sGun = x.s * kat(id);
      s.katman = s.sGun < o.kisa ? 'kisa' : s.sGun < o.uzun ? 'orta' : 'uzun';
      s.risk = 1 - gosterilen(id, bugun + o.ufuk);
      s.sinavaKadar = Number.isInteger(girdi.sinavGunu) ? gosterilen(id, girdi.sinavGunu) >= o.hedef : null;
    }
    if (s.temel) {
      if (!var_(id)) { if ([...kul.keys()].some(var_)) s.alarm = 'gri'; }
      else s.alarm = s.r < o.hedef ? 'kirmizi' : s.kontrol ? 'turuncu' : s.katman !== 'uzun' ? 'sari' : null;
    }
    satirlar.push(s);
  });
  const alarmlar = satirlar.filter(s => s.alarm).sort((a, b) => RENK_SIRA[a.alarm] - RENK_SIRA[b.alarm] || b.onem - a.onem).map(s => s.id);
  // Check tests: every foundation flagged by a failure above it, and at most one sample per window among the
  // foundations kept up only by credit (no own test for ornekBosluk days). Their results train the links like any other.
  const kontroller = satirlar.filter(s => s.kontrol).map(s => ({id: s.id, calis: s.calis, sebep: 'supheli', kaynak: s.kontrol.kaynak, soru: o.kontrolSoru}));
  const pencere = Math.floor(bugun / o.ornekPencere);
  const yapildi = (girdi.ornekGecmisi || []).some(e => e && Math.floor(e.gun / o.ornekPencere) === pencere);
  const adaylar = satirlar.filter(s => s.kredili && !s.kontrol && s.r !== null && bugun - (s.sonOz ?? s.baslangic) >= o.ornekBosluk).sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);
  if (!yapildi && adaylar.length) {
    const s = adaylar[karistir(String(girdi.anahtar || '') + '|' + pencere) % adaylar.length];
    kontroller.push({id: s.id, calis: s.calis, sebep: 'ornek', soru: o.kontrolSoru});
  }
  return {konular: satirlar, alarmlar, ust3: alarmlar.slice(0, 3), kontroller, olaylar, karisik: ag.karisik, uyarilar: ag.uyarilar, ayar: o};
}
// FNV-1a: a stable draw for the monthly sample (same student and window → same topic).
function karistir(m) { let h = 2166136261; for (let i = 0; i < m.length; i++) h = Math.imul(h ^ m.charCodeAt(i), 16777619); return h >>> 0; }

/* ---- learning the links from the notebook's results ---- */
// ogrenciler: [{anahtar, sonuclar, bugun, konuEk?, birimEk?}]. For every link and each of kredi, ceza and çekiş, the value on the
// grid that best predicts the results it affects (log-likelihood of each own result given the shown recall just before
// it). Shared value = notebook's best, blended with the starting value by count; a student's value = own best blended
// with the shared one (ozGuven results weigh as much as it). One coordinate pass per call; calls repeat as data grows.
// girdi.sadece: [anahtar] limits a call to some links, so the work can be spread (about 1 s per student per full pass
// on a 90-link map). Each value is judged by its direct effect only (see the kume comment below).
function ogren(girdi, opts) {
  const o = ayarKur(opts), F = fsrsAl(opts), ag = agKur(girdi.konular, girdi.baglar, girdi.birimler), K = o.ozGuven;
  const onceki = girdi.parametreler || {}, paylasilan = JSON.parse(JSON.stringify(onceki.paylasilan || {}));
  const ogrenci = {}; (girdi.ogrenciler || []).forEach(s => { ogrenci[s.anahtar] = JSON.parse(JSON.stringify(((onceki.ogrenci || {})[s.anahtar]) || {})); });
  const ll = (p, y) => { const q = sinirla(p, 1e-4, 1 - 1e-4); return y ? Math.log(q) : Math.log(1 - q); };
  const notlar = [];
  const sadece = Array.isArray(girdi.sadece) ? new Set(girdi.sadece) : null; // learn only these links this call
  ag.asagi.forEach((kenarlar, ust) => kenarlar.forEach(e => {
    if (e.ic || (sadece && !sadece.has(e.anahtar))) return;
    const alt = e.id;
    for (const p of PARAMLAR) {
      // What the value can change directly: kredi → the foundation and everything under it; ceza and çekiş → the
      // topic using it (with its foundations, needed for its shown recall). Effects further up are left to later passes.
      const kok = p === 'kredi' ? alt : ust, kume = new Set([kok, ...ag.temeller.get(kok)]);
      const toplam = IZGARA.map(() => 0), kisisel = [];
      for (const s of girdi.ogrenciler || []) {
        const ilgili = (s.sonuclar || []).some(r => { const id = ag.takma.get(r.id); return id === alt || id === ust || ag.kullananlar.get(alt).has(id); });
        if (!ilgili) { kisisel.push(null); continue; }
        const kayitlar = IZGARA.map(g => {
          const k = []; calistir(Object.assign({}, girdi, s), o, F, ag, paramOkuyucu({paylasilan, ogrenci: ogrenci[s.anahtar]}, o, {anahtar: e.anahtar, p, deger: g}), k, null, kume);
          return k;
        });
        const ilk = kayitlar[0], son = kayitlar[IZGARA.length - 1];
        const etkili = ilk.map((r, j) => son[j] && Math.abs(r.p - son[j].p) > 1e-9);
        const n = etkili.filter(Boolean).length; if (!n) { kisisel.push(null); continue; }
        const skor = kayitlar.map(k => k.reduce((t, r, j) => t + (etkili[j] ? ll(r.p, r.y) : 0), 0));
        skor.forEach((v, gi) => { toplam[gi] += v; });
        kisisel.push({s, n, en: IZGARA[skor.indexOf(Math.max(...skor))]});
      }
      const N = kisisel.reduce((t, k) => t + (k ? k.n : 0), 0), bas = o[p];
      const pay = paylasilan[e.anahtar] = paylasilan[e.anahtar] || {n: {}};
      const enIyi = IZGARA[toplam.indexOf(Math.max(...toplam))];
      pay[p] = N ? (N * enIyi + K * bas) / (N + K) : (Number.isFinite(pay[p]) ? pay[p] : bas); pay.n[p] = N;
      kisisel.forEach(k => {
        if (!k) return;
        const og = ogrenci[k.s.anahtar][e.anahtar] = ogrenci[k.s.anahtar][e.anahtar] || {n: {}};
        og[p] = (k.n * k.en + K * pay[p]) / (k.n + K); og.n[p] = k.n;
      });
      if (p === 'kredi' && N >= o.kotuBagN && pay[p] < o.kotuBag) notlar.push({anahtar: e.anahtar, alt, ust, deger: pay[p], n: N});
    }
  }));
  return {paylasilan, ogrenci, notlar};
}

// How well the map predicts the student's results, against the app's plain FSRS-6 on the same results (each raw topic
// on its own, results only): mean log loss of the recall predicted just before each result. Lower is better.
function degerlendir(girdi, opts) {
  const o = ayarKur(opts), F = fsrsAl(opts), ag = agKur(girdi.konular, girdi.baglar, girdi.birimler), ile = [];
  calistir(girdi, o, F, ag, paramOkuyucu(girdi.parametreler, o), ile, null);
  const duz = new Map(), kart = new Map();
  (girdi.sonuclar || []).map((r, i) => Object.assign({i}, r)).filter(r => r && ag.takma.has(r.id) && [1, 2, 3, 4].includes(r.not) && Number.isInteger(r.gun) && r.gun <= girdi.bugun)
    .sort((a, b) => a.gun - b.gun || a.i - b.i).forEach(r => {
      const x = kart.get(r.id), id = ag.takma.get(r.id), w = ((girdi.konuEk || {})[id] || {}).w || ag.dugum.get(id).w;
      if (x) { const p = F.hatirlama(Math.max(0, r.gun - x.son), x.s); duz.set(r.i, {p, y: r.not > 1 ? 1 : 0});
        x.s = Math.max(r.not === 1 ? F.unutS(x.d, x.s, p, w) : F.hatirlaS(x.d, x.s, p, r.not, w), 0.001); x.d = F.yeniD(x.d, r.not, w); x.son = r.gun; }
      else kart.set(r.id, {s: F.ilkS(r.not, w), d: F.ilkD(r.not, true, w), son: r.gun});
    });
  const ll = a => { if (!a.length) return null; let t = 0; for (const {p, y} of a) { const q = sinirla(p, 1e-4, 1 - 1e-4); t -= y ? Math.log(q) : Math.log(1 - q); } return t / a.length; };
  const ortak = ile.filter(r => duz.has(r.i) && ag.takma.get((girdi.sonuclar[r.i] || {}).id) === r.id);
  return {n: ortak.length, ag: ll(ortak), duz: ll(ortak.map(r => duz.get(r.i))), agTum: ll(ile), nTum: ile.length};
}

/* ---- past-exam question counts ---- */
// yillar: {2018: 2, 2019: 0, ...} (missing or '-' = 0). Expected questions = recency-weighted mean; the pattern is
// only described (shown to the student), never used to lower a topic's priority.
function soruBeklentisi(yillar, opts) {
  const o = ayarKur(opts), y = Object.keys(yillar || {}).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
  if (!y.length) return {beklenen: 0, soruldu: 0, yil: 0, desen: 'veri yok'};
  const deger = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  const son = y[y.length - 1]; let pay = 0, payda = 0;
  y.forEach(t => { const a = Math.pow(o.yilKatsayi, son - t); pay += a * deger(yillar[t]); payda += a; });
  const var_ = y.map(t => deger(yillar[t]) > 0), soruldu = var_.filter(Boolean).length;
  const donusumlu = y.length >= 4 && var_.every((v, i) => i === 0 || v !== var_[i - 1]);
  const desen = soruldu === y.length ? 'her yıl' : soruldu === 0 ? 'hiç sorulmadı' : donusumlu ? 'iki yılda bir (' + (var_[var_.length - 1] ? 'son yıl soruldu' : 'son yıl sorulmadı') + ')'
    : y.length + ' yılın ' + soruldu + '’inde';
  return {beklenen: pay / payda, soruldu, yil: y.length, desen};
}

return {AYAR, KULLANIM, IZGARA, agKur, hesapla, ogren, degerlendir, soruBeklentisi};
})();
