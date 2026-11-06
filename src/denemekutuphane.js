// "Deneme kütüphanesi" of the Yanlışlar defteri: the uploaded exams are kept on this device only (IndexedDB), per signed-in teacher.
// Embedded by scripts/embed-denemekutuphane.cjs. See docs/yanlislar-defteri.md.
// Never the server, never the notebook D, never localStorage. What is kept per exam: the booklet and çözüm PDFs as bytes, the parsed cevap raporu
// model (it has no TC), the parsed Ders ortalamaları model ({kod, dersler}) and the booklet's cut geometry. The raw .xlsx is never kept.
// Without IndexedDB (private mode, blocked, no account) everything stays in this object's memory for the session.
const DENEME_KUTUPHANE = (() => {
'use strict';
const DB = 'yks-deneme-kutuphanesi', SURUM = 1, DEPOLAR = ['meta', 'dosya'];
const SLOT = /^(kit|coz)-(TYT|AYT)$/u;
const TC = /\d{11}/u;
const enc = s => encodeURIComponent(String(s));
const kota = e => !!e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(String(e.message || '')));
const bytes = async v => {
  const t = Object.prototype.toString.call(v);
  if (t === '[object ArrayBuffer]') return v;
  if (v && typeof v.arrayBuffer === 'function') return v.arrayBuffer();
  if (ArrayBuffer.isView(v)) return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
  return null;
};
const uzunluk = v => v ? (v.byteLength ?? v.size ?? 0) : 0;

/* ---- storage adapters. toplu(ops) is atomic: every op [depo, anahtar, deger] or [depo, anahtar] (delete) is applied, or none. ---- */
function idbAdaptor(idb) {
  let db = null;
  const istek = r => new Promise((ok, red) => { r.onsuccess = () => ok(r.result); r.onerror = () => red(r.error || new Error('Cihaz depolaması okunamadı.')); });
  const bitti = t => new Promise((ok, red) => { t.oncomplete = ok; t.onabort = t.onerror = () => red(t.error || new Error('Cihaz depolaması yazılamadı.')); });
  const aralik = onek => IDBKeyRange.bound(onek, onek + '￿');
  return {
    async ac() {
      if (db) return;
      db = await new Promise((ok, red) => {
        let r;
        try { r = idb.open(DB, SURUM) } catch (e) { red(e); return }
        r.onupgradeneeded = () => { for (const d of DEPOLAR) if (!r.result.objectStoreNames.contains(d)) r.result.createObjectStore(d) };
        r.onsuccess = () => ok(r.result); r.onerror = () => red(r.error || new Error('IndexedDB açılamadı.')); r.onblocked = () => red(new Error('Cihaz depolaması başka sekmede açık.'));
      });
      // Another tab (or the logout cleanup) deleting the database must never be held up by this connection.
      db.onversionchange = () => { try { db.close() } catch (e) {} db = null };
    },
    async oku(depo, anahtar) { const v = await istek(db.transaction(depo, 'readonly').objectStore(depo).get(anahtar)); return v; },
    async anahtarlar(depo, onek) { return istek(db.transaction(depo, 'readonly').objectStore(depo).getAllKeys(aralik(onek))); },
    async tumu(depo, onek) { return istek(db.transaction(depo, 'readonly').objectStore(depo).getAll(aralik(onek))); },
    async toplu(ops) {
      const t = db.transaction(DEPOLAR, 'readwrite'), son = bitti(t);
      // a put that throws (quota) must not leave the part already queued behind: the whole write is abandoned
      try { for (const [d, k, v] of ops) { const s = t.objectStore(d); if (v === undefined) s.delete(k); else s.put(v, k) } }
      catch (e) { try { t.abort() } catch (x) {} son.catch(() => {}); throw e }
      await son;
    },
    kapat() { try { db?.close() } catch (e) {} db = null },
    async veritabaniniSil() {
      try { db?.close() } catch (e) {} db = null;
      await new Promise((ok, red) => {
        let r; try { r = idb.deleteDatabase(DB) } catch (e) { red(e); return }
        const zaman = setTimeout(() => red(new Error('Cihaz depolaması başka sekmede açık.')), 8000);
        r.onsuccess = () => { clearTimeout(zaman); ok() }; r.onerror = () => { clearTimeout(zaman); red(r.error || new Error('Cihaz depolaması silinemedi.')) };
      });
    }
  };
}
// In-memory store with the same contract. `disk` is a plain object {meta:Map, dosya:Map} that outlives an instance, so a test can simulate a page reload.
// Options: kotaBayt (a write that would exceed it throws QuotaExceededError), acHata (open fails), silHata.
function bellekAdaptor(disk = { meta: new Map(), dosya: new Map() }, o = {}) {
  const toplam = () => { let n = 0; for (const m of Object.values(disk)) for (const v of m.values()) n += uzunluk(v) || JSON.stringify(v).length; return n };
  const dolu = (depo, onek) => [...disk[depo].entries()].filter(([k]) => k.startsWith(onek)).sort((a, b) => a[0] < b[0] ? -1 : 1);
  return {
    disk,
    async ac() { if (o.acHata) throw new Error('IndexedDB açılamadı.') },
    async oku(depo, anahtar) { return disk[depo].get(anahtar) },
    async anahtarlar(depo, onek) { return dolu(depo, onek).map(x => x[0]) },
    async tumu(depo, onek) { return dolu(depo, onek).map(x => x[1]) },
    async toplu(ops) {
      const once = { meta: new Map(disk.meta), dosya: new Map(disk.dosya) };
      try {
        for (const [d, k, v] of ops) { if (v === undefined) disk[d].delete(k); else disk[d].set(k, v) }
        if (o.kotaBayt !== undefined && toplam() > o.kotaBayt) { const e = new Error('Quota exceeded.'); e.name = 'QuotaExceededError'; throw e }
      } catch (e) { disk.meta = once.meta; disk.dosya = once.dosya; throw e }
    },
    kapat() {},
    async veritabaniniSil() { if (o.silHata) throw new Error('Cihaz depolaması silinemedi.'); disk.meta.clear(); disk.dosya.clear() }
  };
}

let persist = false;      // navigator.storage.persist() is asked once per page
const ACIK = new Set();      // every library instance of this page, so the logout cleanup can empty them

/* ---- one library = one teacher (uid) ---- */
function olustur({ uid, adaptor, tahmin } = {}) {
  const ad = adaptor || (typeof indexedDB !== 'undefined' && !(typeof ONIZLEME_MODU !== 'undefined' && ONIZLEME_MODU) ? idbAdaptor(indexedDB) : null);
  const onek = uid ? enc(uid) + '|' : null;
  const metaKey = kod => onek + enc(kod), dosyaKey = (kod, slot) => onek + enc(kod) + '|' + slot;
  const bellek = new Map();      // kod -> {meta, dosyalar:{slot: Blob|ArrayBuffer}}: everything in memory mode, and exams that did not fit
  const K = { mod: 'bekliyor', neden: '', kotaKodlari: new Set() };
  let zincir = Promise.resolve();
  const sirala = fn => { const p = zincir.then(fn, fn); zincir = p.catch(() => {}); return p };
  // Called with the first successful save: ask the browser not to evict the files. Once per page, never fatal.
  const kalicilik = () => { if (persist) return; persist = true; try { const p = typeof navigator !== 'undefined' && navigator.storage?.persist?.(); if (p && p.catch) p.catch(() => {}) } catch (e) {} };

  async function yukle() {
    if (!uid) { K.mod = 'gecici'; K.neden = 'hesap'; return [] }
    if (!ad) { K.mod = 'gecici'; K.neden = 'izin'; return [] }
    try {
      await ad.ac();
      const metalar = await ad.tumu('meta', onek);
      K.mod = 'kalici'; K.neden = '';
      return metalar.filter(m => m && m.kod != null);
    } catch (e) { try { ad.kapat() } catch (_) {} K.mod = 'gecici'; K.neden = 'izin'; return [] }
  }
  // meta: JSON-safe record {kod, ...}; yeni: {slot: Blob|ArrayBuffer} written now; sil: [slot] removed now.
  // Result: {kalici, kota, hata}. A refused save keeps the exam in memory, so the page still works this session.
  function kaydet(kod, meta, yeni = {}, sil = []) {
    return sirala(async () => {
      const metin = JSON.stringify(meta);
      // Defense in depth: the parsers already drop them. A model with an 11 digit number (a TC) is never written to the device.
      if (TC.test(metin)) return { kalici: false, hata: 'tc' };
      for (const s of [...Object.keys(yeni), ...sil]) if (!SLOT.test(s)) return { kalici: false, hata: 'slot' };
      const veri = {};
      for (const [s, v] of Object.entries(yeni)) {
        const ab = await bytes(v);
        if (!ab || new Uint8Array(ab, 0, 4).reduce((a, c) => a + String.fromCharCode(c), '') !== '%PDF') return { kalici: false, hata: 'pdf' };
        veri[s] = ab;
      }
      const tut = (ek = {}) => {
        const b = bellek.get(kod) || { meta: null, dosyalar: {} };
        b.meta = meta; for (const s of sil) delete b.dosyalar[s]; Object.assign(b.dosyalar, ek); bellek.set(kod, b);
      };
      if (K.mod !== 'kalici') { tut(veri); return { kalici: false }; }
      const ops = [['meta', metaKey(kod), JSON.parse(metin)], ...Object.entries(veri).map(([s, ab]) => ['dosya', dosyaKey(kod, s), ab]), ...sil.map(s => ['dosya', dosyaKey(kod, s)])];
      try { await ad.toplu(ops) }
      catch (e) { tut(veri); return { kalici: false, kota: kota(e), hata: kota(e) ? 'kota' : String(e && e.message || e) } }
      bellek.delete(kod); kalicilik();
      return { kalici: true };
    });
  }
  async function dosya(kod, slot) {
    const b = bellek.get(kod);
    if (b && b.dosyalar[slot]) return bytes(b.dosyalar[slot]);
    if (K.mod !== 'kalici') return null;
    const v = await ad.oku('dosya', dosyaKey(kod, slot));
    return v === undefined ? null : bytes(v);
  }
  function sil(kod) {
    return sirala(async () => {
      bellek.delete(kod);
      if (K.mod !== 'kalici') return;
      const anahtarlar = await ad.anahtarlar('dosya', metaKey(kod) + '|');
      await ad.toplu([['meta', metaKey(kod)], ...anahtarlar.map(k => ['dosya', k])]);
    });
  }
  function hepsiniSil() {
    return sirala(async () => {
      bellek.clear();
      if (K.mod !== 'kalici') return;
      const ops = [...(await ad.anahtarlar('meta', onek)).map(k => ['meta', k]), ...(await ad.anahtarlar('dosya', onek)).map(k => ['dosya', k])];
      if (ops.length) await ad.toplu(ops);
    });
  }
  // Bytes in use: the browser's estimate when it has one (the whole origin, the notebook included), else the sum of what we hold.
  async function boyut(metalar) {
    let toplam = 0;
    for (const m of metalar || []) for (const n of Object.values(m.boyut || {})) toplam += +n || 0;
    try {
      const f = tahmin || (typeof navigator !== 'undefined' && navigator.storage?.estimate ? () => navigator.storage.estimate() : null);
      if (K.mod === 'kalici' && f) { const e = await f(); if (e && Number.isFinite(e.usage) && e.usage > 0) return { bayt: e.usage, tahmin: true } }
    } catch (e) {}
    return { bayt: toplam, tahmin: false };
  }
  const o = { yukle, kaydet, dosya, sil, hepsiniSil, boyut, mod: () => K.mod, neden: () => K.neden, bellekte: kod => bellek.has(kod), bellekKodlari: () => [...bellek.keys()],
    kapat() { try { ad?.kapat() } catch (e) {} ACIK.delete(o) }, _bosalt() { bellek.clear(); K.mod = 'gecici'; K.neden = 'temizlendi' } };
  ACIK.add(o);
  return o;
}

// Logout / browser reset: the whole database goes (every account of this browser), like the rest of this app's local data. Idempotent.
async function hepsiniTemizle(idb = typeof indexedDB !== 'undefined' ? indexedDB : null) {
  for (const k of [...ACIK]) { try { k._bosalt(); k.kapat() } catch (e) {} }
  if (!idb) return;
  await idbAdaptor(idb).veritabaniniSil();
}

return { olustur, hepsiniTemizle, idbAdaptor, bellekAdaptor, DB, SLOT };
})();
