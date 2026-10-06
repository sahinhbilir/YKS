'use strict';

// "Şifre değiştir" and name + password login, run on the real inline Firebase module with an
// in-memory Auth and Firestore. Usage: node --experimental-vm-modules test/password-module-regression.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { webcrypto } = require('node:crypto');
const vm = require('node:vm');

const html = readFileSync(process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : 'index.html', 'utf8');
const source = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const kimlikHatasi = () => Object.assign(new Error('auth'), { code: 'auth/invalid-credential' });

async function load() {
  const hesaplar = {}, belgeler = {}, olaylar = [];
  let uidSayac = 0, yazmaIzni = true;
  const birincil = { currentUser: null, authStateReady: async () => {} }, ikincil = { currentUser: null, authStateReady: async () => {} };
  const giris = (auth, email, sifre) => {
    const h = hesaplar[email];
    if (!h || h.sifre !== sifre) throw kimlikHatasi();
    auth.currentUser = { uid: h.uid, email, isAnonymous: false };
    return { user: auth.currentUser };
  };
  const apps = [], window = { bulutDegisti() {} };
  const context = vm.createContext({ window, URLSearchParams, setTimeout, clearTimeout, crypto: webcrypto, TextEncoder,
    console: { warn() {} }, location: new URL('http://localhost/?dev=1') });
  const sdks = {
    'firebase-app.js': { initializeApp(config, name = '[DEFAULT]') { const app = { config, name }; apps.push(app); return app; } },
    'firebase-app-check.js': { initializeAppCheck() {}, ReCaptchaEnterpriseProvider: class {} },
    'firebase-auth.js': {
      getAuth: app => app === apps[0] ? birincil : ikincil,
      signOut: async auth => { auth.currentUser = null; }, signInAnonymously: async () => ({ user: null }), signInWithPopup: async () => ({}),
      signInWithEmailAndPassword: async (auth, email, sifre) => { olaylar.push(['giris', email]); return giris(auth, email, sifre); },
      createUserWithEmailAndPassword: async (auth, email, sifre) => {
        if (hesaplar[email]) throw Object.assign(new Error('taken'), { code: 'auth/email-already-in-use' });
        hesaplar[email] = { uid: 'u' + (++uidSayac), sifre };
        return giris(auth, email, sifre);
      },
      GoogleAuthProvider: class {}, onAuthStateChanged() {},
      EmailAuthProvider: { credential: (email, sifre) => ({ email, sifre }) },
      reauthenticateWithCredential: async (user, k) => { olaylar.push(['yeniden', k.email]); if (k.email !== user.email || hesaplar[k.email]?.sifre !== k.sifre) throw kimlikHatasi(); },
      updatePassword: async (user, yeni) => { olaylar.push(['sifre', user.email]); hesaplar[user.email].sifre = yeni; }
    },
    'firebase-firestore.js': {
      getFirestore: () => ({}), doc: (_db, ...yol) => yol.join('/'), collection: (_db, ...yol) => yol.join('/'),
      setDoc: async (ref, veri) => {
        if (!yazmaIzni) throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
        olaylar.push(['yaz', ref]); belgeler[ref] = JSON.parse(JSON.stringify(veri));
      },
      getDocs: async yol => ({ docs: Object.keys(belgeler).filter(k => k.startsWith(yol + '/') && !k.slice(yol.length + 1).includes('/'))
        .map(k => ({ id: k.split('/').pop(), data: () => belgeler[k] })) }),
      getDoc: async () => ({ exists: () => false }), getDocFromServer: async () => ({ exists: () => false }),
      updateDoc: async () => {}, runTransaction: async () => {}, onSnapshot: () => () => {}
    }
  };
  const modul = id => {
    const exports = sdks[id.split('/').pop()];
    assert.ok(exports, 'unexpected import ' + id);
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v); }, { context });
  };
  const m = new vm.SourceTextModule(source, { context, identifier: 'index.html:firebase' });
  await m.link(modul); await m.evaluate();
  return { bulut: window.bulut, hesaplar, belgeler, olaylar, birincil, izin: v => { yazmaIzni = v; } };
}
// A teacher-published school account (name + number), signed in on the student's device.
async function okulOgrencisi() {
  const t = await load();
  const h = await t.bulut.ogrenciHesabiHazirla('Ada Yılmaz', 42);
  await t.bulut.girisOgrenciHesabi('Ada Yılmaz', 42);
  assert.equal(t.birincil.currentUser.uid, h.uid);
  t.olaylar.length = 0;
  return { ...t, uid: h.uid, email: t.birincil.currentUser.email };
}

test('school student: the school number is the current password; then name + new password logs in', async () => {
  const t = await okulOgrencisi();
  await t.bulut.sifreDegistir(' 42 ', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42 });
  assert.deepEqual(t.olaylar.map(o => o[0]), ['yeniden', 'yaz', 'sifre'], 'reauthenticate, then the lookup, then the password');
  const yol = Object.keys(t.belgeler)[0];
  assert.match(yol, /^sifreliGiris\/[0-9a-f]{64}\/hesaplar\//);
  assert.equal(yol.split('/').pop(), t.uid);
  assert.equal(t.belgeler[yol].email, t.email);assert.deepEqual(Object.keys(t.belgeler[yol]).sort(), ['email', 'ts']);
  assert(!yol.includes('Ada') && !JSON.stringify(t.belgeler).includes('Ada'), 'the name itself is never stored');
  // Name + number no longer works; name + password does (spacing and case do not matter).
  await assert.rejects(t.bulut.girisOgrenciHesabi('Ada Yılmaz', 42), /auth/);
  t.birincil.currentUser = null;
  const u = await t.bulut.okulSifreGirisi('  ADA   yılmaz ', 'yeni-sifre');
  assert.equal(u.uid, t.uid);
  await assert.rejects(t.bulut.okulSifreGirisi('Ada Yılmaz', 'yanlis-sifre'), e => e.code === 'auth/invalid-credential');
  await assert.rejects(t.bulut.okulSifreGirisi('Ece Kaya', 'yeni-sifre'), e => e.code === 'auth/invalid-credential', 'another name has no lookup');
  // A second change takes the new password as the current one.
  t.birincil.currentUser = u;
  await assert.rejects(t.bulut.sifreDegistir('42', 'baska-sifre', { ad: 'Ada Yılmaz', no: 42 }), e => e.code === 'auth/invalid-credential');
  await t.bulut.sifreDegistir('yeni-sifre', 'baska-sifre', { ad: 'Ada Yılmaz', no: 42 });
  assert.equal((await t.bulut.okulSifreGirisi('Ada Yılmaz', 'baska-sifre')).uid, t.uid);
});

test('nothing changes when the lookup cannot be written or the current password is wrong', async () => {
  const t = await okulOgrencisi();
  t.izin(false);
  await assert.rejects(t.bulut.sifreDegistir('42', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42 }), e => e.code === 'permission-denied');
  assert(!t.olaylar.some(o => o[0] === 'sifre'), 'the password is not changed without the lookup');
  t.izin(true);
  await assert.rejects(t.bulut.sifreDegistir('41', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42 }), e => e.code === 'auth/invalid-credential');
  assert.deepEqual(Object.keys(t.belgeler), [], 'a wrong current password writes nothing');
  assert.ok(await t.bulut.girisOgrenciHesabi('Ada Yılmaz', 42), 'name + number still works');
  t.birincil.currentUser = null;
  await assert.rejects(t.bulut.sifreDegistir('42', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42 }), e => e.code === 'yks/oturum-yok', 'signed out');
});

test('Kaydol account: current password, no lookup; the user name logs in with the new one', async () => {
  const t = await load();
  await t.bulut.uyeKaydol('Ali Veli', 'eski-sifre');
  await t.bulut.sifreDegistir('eski-sifre', 'yeni-sifre', null);
  assert.deepEqual(Object.keys(t.belgeler), [], 'no name lookup for Kaydol');
  t.birincil.currentUser = null;
  await assert.rejects(t.bulut.uyeGiris('aliveli', 'eski-sifre'), e => e.code === 'auth/invalid-credential');
  assert.ok(await t.bulut.uyeGiris('aliveli', 'yeni-sifre'));
});

test('a lookup entry that is not a school account email is never tried', async () => {
  const t = await okulOgrencisi();
  await t.bulut.sifreDegistir('42', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42 });
  const yol = Object.keys(t.belgeler)[0].split('/').slice(0, 3).join('/');
  t.belgeler[yol + '/sahte'] = { email: 'uye-' + 'a'.repeat(40) + '@uye.ykstekrar.app' };
  t.olaylar.length = 0; t.birincil.currentUser = null;
  await t.bulut.okulSifreGirisi('Ada Yılmaz', 'yeni-sifre');
  assert(t.olaylar.every(o => o[0] !== 'giris' || o[1].endsWith('@student.ykstekrar.app')));
});
