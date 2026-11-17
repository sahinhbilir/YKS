// Bağlantılı hafıza: FSRS-6 on a graph of topics (konu ağı). Rules, parameters and sources: docs/baglantili-hafiza.md.
// Pure functions: no DOM, no storage. Not embedded in index.html yet; test/hafiza-ag-regression.cjs runs it beside the
// app's own FSRS-6 (hatirlama, hatirlaS, unutS, ilkS, ilkD, yeniD, FACTOR, DECAY), or `opts.fsrs` supplies them.
// Days are integer day numbers (the app's bugunNo()). Only real results go in: an assumed "İyi" never reaches this model.
// With no links, or with ortukKatsayi = hataKatsayi = 0, every topic is plain FSRS-6, identical to the app.
const HAFIZA_AG = (() => {
const AYAR = Object.freeze({
  hedef: 0.9,          // recall target (the app's hedefTutma)
  ufuk: 7,             // risk = chance of having forgotten within this many days
  kisa: 7, uzun: 30,   // storage tiers on S in days (time for recall to fall to 90 %): < 7 kısa, 7–30 pekişiyor, ≥ 30 uzun süreli
  esik: 0.05,          // implicit credit that has faded below this share is dropped
  hataYukari: 0.5,     // a failure dents the topics built on it with this share of the link's weight
  hataOnkosul: 0.15,   // the share for a pure prerequisite link (no practice credit)
  ortukTavan: 2.5,     // implicit credit raises S at most to this multiple of S after the topic's last real result
  ortukNotTavan: 3,    // implicit practice counts as at most "İyi"
  temelEsik: 2,        // a topic with at least this many topics resting on it (directly or not) is temel
  ortukKatsayi: 1,     // this student's gate on implicit credit (0 = none; for a weak student or a bad fit)
  hataKatsayi: 1       // the same for failures carried up (0 = none)
});
// Default share of a link: kapsar = solving the upper topic practises half of the lower; kardes = parallel topics
// (Fizik vektörler ↔ Matematik vektörler); onkosul = needed to learn the upper topic but not practised by it.
const TUR_W = Object.freeze({kapsar: 0.5, kardes: 0.2, onkosul: 0});
const sinirla = (x, a, b) => Math.min(b, Math.max(a, x));

function fsrsAl(o) {
  if (o && o.fsrs) return o.fsrs;
  try { return {hatirlama, hatirlaS, unutS, ilkS, ilkD, yeniD, FACTOR, DECAY}; } // eslint-disable-line no-undef
  catch (e) { throw new Error('HAFIZA_AG: FSRS-6 functions not found; pass opts.fsrs'); }
}
function ayarKur(opts) {
  const o = Object.assign({}, AYAR);
  Object.keys(AYAR).forEach(a => { const v = opts && opts[a]; if (Number.isFinite(v) && v >= 0) o[a] = v; });
  o.hedef = sinirla(o.hedef, 0.5, 0.99); o.ortukKatsayi = sinirla(o.ortukKatsayi, 0, 1); o.hataKatsayi = sinirla(o.hataKatsayi, 0, 1);
  o.ortukTavan = Math.max(1, o.ortukTavan); o.ortukNotTavan = sinirla(Math.round(o.ortukNotTavan), 2, 4);
  return o;
}

/* ---- the graph ---- */
// konular: [{id, ad?, ders?, k?, w?, ogrenildi?}] — k: the student's forgetting speed for its ders (app's unutmaKatsayisi),
// w: its FSRS parameters (app's parametreAl), ogrenildi: the day it was taught (memory starts then if there is no result).
// baglar: [{ust, alt, tur: 'kapsar'|'onkosul', w?}] (ust rests on alt) or [{a, b, tur: 'kardes', w?}].
function agKur(konular, baglar) {
  const dugum = new Map(), uyarilar = [], asagi = new Map(), yukari = new Map(), kardes = new Map();
  (konular || []).forEach((k, i) => {
    if (!k || k.id == null || dugum.has(k.id)) uyarilar.push('konu ' + i + ': kimliği yok ya da tekrar ediyor');
    else dugum.set(k.id, k);
  });
  const ekle = (m, a, x) => { let l = m.get(a); if (!l) m.set(a, l = []); l.push(x); };
  (baglar || []).forEach((b, i) => {
    const tur = b && b.tur ? b.tur : 'kapsar';
    if (!b || !Object.prototype.hasOwnProperty.call(TUR_W, tur)) return void uyarilar.push('bağ ' + i + ': bilinmeyen tür');
    const a = tur === 'kardes' ? (b.a ?? b.ust) : b.ust, c = tur === 'kardes' ? (b.b ?? b.alt) : b.alt;
    if (!dugum.has(a) || !dugum.has(c) || a === c) return void uyarilar.push('bağ ' + i + ': konusu yok ya da kendine bağlı');
    const w = tur === 'onkosul' ? 0 : sinirla(Number.isFinite(b.w) ? b.w : TUR_W[tur], 0, 1);
    if (tur === 'kardes') { ekle(kardes, a, {id: c, w}); ekle(kardes, c, {id: a, w}); }
    else { ekle(asagi, a, {id: c, w, tur}); ekle(yukari, c, {id: a, w, tur}); }
  });
  // Topics resting on each topic, directly or through others (prerequisite and kapsar links; not kardes).
  const bagimli = new Map();
  dugum.forEach((_, id) => {
    const gor = new Set([id]), yigin = [id];
    while (yigin.length) for (const e of yukari.get(yigin.pop()) || []) if (!gor.has(e.id)) { gor.add(e.id); yigin.push(e.id); }
    gor.delete(id); bagimli.set(id, [...gor]);
  });
  return {dugum, asagi, yukari, kardes, bagimli, uyarilar};
}

// Where practice of `kaynak` reaches: down kapsar links, the share multiplied along the way and fading out below `esik`
// (the strongest path counts), and one step to its kardes topics. Map id → share.
function krediYay(ag, kaynak, esik) {
  const en = new Map([[kaynak, 1]]), sira = [[kaynak, 1]];
  while (sira.length) {
    let i = 0; for (let j = 1; j < sira.length; j++) if (sira[j][1] > sira[i][1]) i = j;
    const [id, om] = sira.splice(i, 1)[0];
    if (om < en.get(id)) continue;
    for (const e of ag.asagi.get(id) || []) {
      const x = om * e.w;
      if (x < esik || x <= (en.get(e.id) || 0)) continue;
      en.set(e.id, x); sira.push([e.id, x]);
    }
  }
  en.delete(kaynak);
  for (const e of ag.kardes.get(kaynak) || []) if (e.w >= esik && e.w > (en.get(e.id) || 0)) en.set(e.id, e.w);
  return en;
}

/* ---- running the results through the graph ---- */
function calistir(girdi, o, F, ag, tahminler, olaylar) {
  const bugun = girdi.bugun, durum = new Map();
  const kat = id => { const v = ag.dugum.get(id).k; return v > 0 ? v : 1; }, wp = id => ag.dugum.get(id).w;
  const al = id => { let x = durum.get(id); if (!x) durum.set(id, x = {s: 0, d: 0, son: null, sonAcik: null, n: 0, sAcik: 0, ortuk: 0, tohum: false, kontrol: null}); return x; };
  const R = (x, id, gun) => x && x.s > 0 ? F.hatirlama(Math.max(0, gun - x.son) / kat(id), x.s) : 0;
  const yaz = olaylar ? e => olaylar.push(e) : () => {};

  const sira = [];
  ag.dugum.forEach((d, id) => { if (Number.isInteger(d.ogrenildi) && d.ogrenildi <= bugun) sira.push({gun: d.ogrenildi, id, ders: true, i: -1}); });
  (girdi.sonuclar || []).forEach((r, i) => {
    if (r && ag.dugum.has(r.id) && [1, 2, 3, 4].includes(r.not) && Number.isInteger(r.gun) && r.gun <= bugun) sira.push({gun: r.gun, id: r.id, not: r.not, i});
  });
  sira.sort((a, b) => a.gun - b.gun || a.i - b.i);

  for (const e of sira) {
    const x = al(e.id), w = wp(e.id);
    if (e.ders) {
      // Taught, not measured: learnt that day with the first "İyi"'s stability, as Hafızam does. The first result replaces it.
      if (!(x.s > 0)) Object.assign(x, {s: F.ilkS(3, w), d: F.ilkD(3, true, w), son: e.gun, sAcik: F.ilkS(3, w), tohum: true});
      continue;
    }
    if (tahminler && x.s > 0 && !x.tohum) tahminler.push({id: e.id, gun: e.gun, p: R(x, e.id, e.gun), y: e.not > 1 ? 1 : 0});
    // 1. The topic's own FSRS-6 step, exactly as the app's tekrarla (days divided by the forgetting speed k).
    if (x.s > 0 && !x.tohum) {
      const r = R(x, e.id, e.gun);
      x.s = Math.max(e.not === 1 ? F.unutS(x.d, x.s, r, w) : F.hatirlaS(x.d, x.s, r, e.not, w), 0.001);
      x.d = F.yeniD(x.d, e.not, w);
    } else { x.s = F.ilkS(e.not, w); x.d = F.ilkD(e.not, true, w); }
    Object.assign(x, {son: e.gun, sonAcik: e.gun, n: x.n + 1, sAcik: x.s, ortuk: 0, tohum: false});
    if (x.kontrol && x.kontrol.gun <= e.gun) x.kontrol = null;

    if (e.not > 1) {
      // 2. Success: the topics it practises get a fractional review (FIRe). The share interpolates FSRS's own stability gain
      //    in log space, so practice while recall is still high adds almost nothing, as a full early review would.
      if (!(o.ortukKatsayi > 0)) continue;
      krediYay(ag, e.id, o.esik / o.ortukKatsayi).forEach((ham, id) => {
        const om = ham * o.ortukKatsayi, y = durum.get(id);
        if (om < o.esik || !y || !(y.s > 0)) return;
        const r = R(y, id, e.gun), tavan = y.sAcik * o.ortukTavan;
        if (y.s >= tavan) return void yaz({gun: e.gun, kaynak: e.id, id, tur: 'tavan', w: om, sOnce: y.s, sSonra: y.s, rOnce: r, rSonra: r});
        const sTam = Math.max(F.hatirlaS(y.d, y.s, r, Math.min(e.not, o.ortukNotTavan), wp(id)), y.s);
        const s = Math.min(y.s * Math.pow(sTam / y.s, om), tavan), r2 = r + om * (1 - r);
        const t = r2 >= 1 ? 0 : s / F.FACTOR * (Math.pow(r2, 1 / F.DECAY) - 1);
        yaz({gun: e.gun, kaynak: e.id, id, tur: 'ortuk', w: om, sOnce: y.s, sSonra: s, rOnce: r, rSonra: r2});
        y.s = s; y.son = e.gun - t * kat(id); y.ortuk++;
      });
    } else {
      // 3. Failure: the topics built on it (one step up) and its kardes topics lose part of their stability, as a fractional
      //    lapse; recall today falls with it. Foundations one step down are not marked forgotten, only flagged for a check.
      const yukari = (ag.yukari.get(e.id) || []).map(b => ({id: b.id, om: (b.tur === 'onkosul' ? o.hataOnkosul : b.w * o.hataYukari) * o.hataKatsayi}))
        .concat((ag.kardes.get(e.id) || []).map(b => ({id: b.id, om: b.w * o.hataYukari * o.hataKatsayi})));
      const en = new Map(); yukari.forEach(b => en.set(b.id, Math.max(en.get(b.id) || 0, b.om)));
      en.forEach((om, id) => {
        const y = durum.get(id); if (om < o.esik || !y || !(y.s > 0)) return;
        const r = R(y, id, e.gun), sH = Math.max(F.unutS(y.d, y.s, r, wp(id)), 0.001);
        if (sH >= y.s) return;
        const s = y.s * Math.pow(sH / y.s, om);
        yaz({gun: e.gun, kaynak: e.id, id, tur: 'hata', w: om, sOnce: y.s, sSonra: s, rOnce: r, rSonra: F.hatirlama(Math.max(0, e.gun - y.son) / kat(id), s)});
        y.s = s;
      });
      for (const b of ag.asagi.get(e.id) || []) {
        al(b.id).kontrol = {gun: e.gun, kaynak: e.id};
        yaz({gun: e.gun, kaynak: e.id, id: b.id, tur: 'kontrol', w: 0});
      }
    }
  }
  return {durum, R, kat};
}

/* ---- what the student sees ---- */
// girdi: {konular, baglar, sonuclar: [{gun, id, not 1–4}], bugun, sinavGunu?}. Returns one row per topic, the order of
// attention, studies that cover the most of it, an audit trail of every implicit change, and warnings about the input.
function hesapla(girdi, opts) {
  const o = ayarKur(opts), F = fsrsAl(opts), ag = agKur(girdi.konular, girdi.baglar), olaylar = [];
  if (!Number.isInteger(girdi.bugun)) throw new Error('HAFIZA_AG: bugun must be a day number');
  const {durum, R, kat} = calistir(girdi, o, F, ag, null, olaylar);
  const bugun = girdi.bugun, cizgiCarpan = (Math.pow(o.hedef, 1 / F.DECAY) - 1) / F.FACTOR;
  const kartVar = id => { const x = durum.get(id); return !!x && x.s > 0; };
  const konular = [];
  ag.dugum.forEach((d, id) => {
    const x = durum.get(id), var_ = kartVar(id), k = kat(id), bag = ag.bagimli.get(id), temel = bag.length >= o.temelEsik;
    const agirlik = Math.sqrt(1 + bag.length);
    const satir = {id, ad: d.ad, ders: d.ders, bagimli: bag.length, temel, agirlik, r: null, sGun: null, katman: null, risk: null,
      sinavaKadar: null, cizgiGun: null, sonAcik: x ? x.sonAcik : null, ortuk: x ? x.ortuk : 0, kontrol: x ? x.kontrol : null, alarm: null, oncelik: 0};
    if (var_) {
      satir.r = R(x, id, bugun); satir.sGun = x.s * k;
      satir.katman = satir.sGun < o.kisa ? 'kisa' : satir.sGun < o.uzun ? 'orta' : 'uzun';
      satir.risk = 1 - R(x, id, bugun + o.ufuk);
      satir.sinavaKadar = Number.isInteger(girdi.sinavGunu) ? R(x, id, girdi.sinavGunu) >= o.hedef : null;
      satir.cizgiGun = x.son + k * x.s * cizgiCarpan;
      satir.oncelik = satir.risk * agirlik;
      satir.alarm = temel && satir.r < o.hedef ? 'alarm' : x.kontrol ? 'kontrol' : temel && satir.katman !== 'uzun' ? 'uyari' : null;
    } else if (temel && bag.some(kartVar)) {
      // A foundation never measured while topics resting on it are being studied: start it with a konu anlatımı.
      satir.alarm = 'eksik'; satir.oncelik = agirlik;
    } else if (x && x.kontrol) satir.alarm = 'kontrol';
    konular.push(satir);
  });
  const byId = new Map(konular.map(s => [s.id, s]));
  const sira = konular.filter(s => s.oncelik > 0).sort((a, b) => b.oncelik - a.oncelik || b.bagimli - a.bagimli).map(s => s.id);
  // Spaced-repetition compression: a study of A also reviews what A practises. Need = priority of a topic that crosses the
  // line within the horizon; a study's worth = its own need + the shares of the needs it covers.
  const ihtiyac = id => { const s = byId.get(id); return s && s.r !== null && 1 - s.risk < o.hedef ? s.oncelik : 0; };
  const oneriler = [];
  if (o.ortukKatsayi > 0) konular.forEach(s => {
    if (s.r === null) return;
    const kapsadiklari = [];
    let deger = ihtiyac(s.id);
    krediYay(ag, s.id, o.esik / o.ortukKatsayi).forEach((ham, id) => {
      const om = ham * o.ortukKatsayi, n = ihtiyac(id), x = durum.get(id);
      if (om < o.esik || !(n > 0) || !x || x.s >= x.sAcik * o.ortukTavan) return;
      deger += om * n; kapsadiklari.push({id, w: om});
    });
    if (deger > 0 && kapsadiklari.length) oneriler.push({id: s.id, deger, kendi: ihtiyac(s.id), kapsadiklari: kapsadiklari.sort((a, b) => b.w - a.w)});
  });
  oneriler.sort((a, b) => b.deger - a.deger);
  return {konular, sira, oneriler, olaylar, uyarilar: ag.uyarilar, ayar: o};
}

// How well the graph predicts this student's next results, against plain FSRS-6 on the same results: mean log loss of the
// recall predicted just before each real result (lower is better). The way to set the gate and the link weights from data.
function degerlendir(girdi, opts) {
  const o = ayarKur(opts), F = fsrsAl(opts), ag = agKur(girdi.konular, girdi.baglar);
  const ll = a => { if (!a.length) return null; let t = 0; for (const {p, y} of a) { const q = sinirla(p, 1e-4, 1 - 1e-4); t -= y ? Math.log(q) : Math.log(1 - q); } return t / a.length; };
  const ile = [], duz = [];
  calistir(girdi, o, F, ag, ile, null);
  calistir(girdi, Object.assign({}, o, {ortukKatsayi: 0, hataKatsayi: 0}), F, ag, duz, null);
  return {n: ile.length, ag: ll(ile), duz: ll(duz), fark: ile.length ? ll(duz) - ll(ile) : null};
}

return {AYAR, TUR_W, agKur, krediYay, hesapla, degerlendir};
})();
