'use strict';

// Password change, user-name change, "Parolamı unuttum" and the teacher's manual resets, run on the
// real inline Firebase module with an in-memory Auth and Firestore.
// Usage: node --experimental-vm-modules test/password-module-regression.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { webcrypto } = require('node:crypto');
const vm = require('node:vm');

const html = readFileSync('index.html', 'utf8');
const source = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const kimlikHatasi = () => Object.assign(new Error('auth'), { code: 'auth/invalid-credential' });
const izinYok = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

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
  const context = vm.createContext({ window, URLSearchParams, setTimeout, clearTimeout, crypto: webcrypto, TextEncoder, Uint32Array,
    console: { warn() {} }, location: new URL('http://localhost/?dev=1') });
  const yaz = (ref, veri) => { if (!yazmaIzni) throw izinYok(); olaylar.push(['yaz', ref]); belgeler[ref] = JSON.parse(JSON.stringify(veri)); };
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
        olaylar.push(['hesap', email, auth === ikincil ? 'ikincil' : 'birincil']);
        return giris(auth, email, sifre);
      },
      GoogleAuthProvider: class {}, onAuthStateChanged() {},
      EmailAuthProvider: { credential: (email, sifre) => ({ email, sifre }) },
      reauthenticateWithCredential: async (user, k) => { olaylar.push(['yeniden', k.email]); if (k.email !== user.email || hesaplar[k.email]?.sifre !== k.sifre) throw kimlikHatasi(); },
      updatePassword: async (user, yeni) => { olaylar.push(['sifre', user.email]); hesaplar[user.email].sifre = yeni; }
    },
    'firebase-firestore.js': {
      getFirestore: () => ({}), doc: (_db, ...yol) => yol.join('/'), collection: (_db, ...yol) => yol.join('/'),
      setDoc: async (ref, veri) => yaz(ref, veri),
      deleteDoc: async ref => { if (!yazmaIzni) throw izinYok(); olaylar.push(['sil', ref]); delete belgeler[ref]; },
      getDoc: async ref => ({ exists: () => ref in belgeler, data: () => belgeler[ref] && JSON.parse(JSON.stringify(belgeler[ref])) }),
      getDocs: async yol => ({ docs: Object.keys(belgeler).filter(k => k.startsWith(yol + '/') && !k.slice(yol.length + 1).includes('/'))
        .map(k => ({ id: k.split('/').pop(), data: () => belgeler[k] })) }),
      getDocFromServer: async () => ({ exists: () => false }),
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
  const ogretmen = () => { birincil.currentUser = { uid: 'ogretmen-1', email: 'rehber@example.com', isAnonymous: false }; };
  return { bulut: window.bulut, hesaplar, belgeler, olaylar, birincil, ikincil, ogretmen, izin: v => { yazmaIzni = v; },
    belgeIle: onek => Object.keys(belgeler).filter(k => k.startsWith(onek)) };
}
// A teacher-published school account (name + number), signed in on the student's device.
async function okulOgrencisi() {
  const t = await load();
  const h = await t.bulut.ogrenciHesabiHazirla('Ada Yılmaz', 42, 0);
  await t.bulut.girisOgrenciHesabi('Ada Yılmaz', 42);
  assert.equal(t.birincil.currentUser.uid, h.uid);
  t.olaylar.length = 0;
  return { ...t, uid: h.uid, email: t.birincil.currentUser.email };
}

test('school student: e-mail and lookup first, then the password; name + password logs in', async () => {
  const t = await okulOgrencisi();
  await t.bulut.sifreDegistir(' 42 ', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42, nesil: 0 }, 'veli@example.com');
  assert.deepEqual(t.olaylar.map(o => o[0]), ['yeniden', 'yaz', 'yaz', 'sifre'], 'reauthenticate, recovery e-mail, lookup, password');
  const [kurtarma] = t.belgeIle('kurtarma/'), [arama] = t.belgeIle('sifreliGiris/');
  assert.match(kurtarma, /^kurtarma\/[0-9a-f]{64}\/hesaplar\//);assert.equal(kurtarma.split('/').pop(), t.uid);
  assert.deepEqual({ ...t.belgeler[kurtarma], ts: 0 }, { eposta: 'veli@example.com', tur: 'okul', ts: 0 });
  assert.equal(kurtarma.split('/')[1], arama.split('/')[1], 'both keyed by the name hash');
  assert(!JSON.stringify(Object.keys(t.belgeler)).includes('Ada'), 'the name itself is never stored');
  await assert.rejects(t.bulut.girisOgrenciHesabi('Ada Yılmaz', 42), e => e.code === 'auth/invalid-credential');
  t.birincil.currentUser = null;
  assert.equal((await t.bulut.okulSifreGirisi('  ADA   yılmaz ', 'yeni-sifre')).uid, t.uid);
  await assert.rejects(t.bulut.okulSifreGirisi('Ada Yılmaz', 'yanlis-sifre'), e => e.code === 'auth/invalid-credential');
  // The teacher reads the recovery e-mail to check a request.
  t.ogretmen();
  assert.deepEqual((await t.bulut.kurtarmaKayitlari('okul', 'ada yılmaz')).map(k => [k.uid, k.eposta]), [[t.uid, 'veli@example.com']]);
});

test('nothing changes when a record cannot be written or the current password is wrong', async () => {
  const t = await okulOgrencisi();
  t.izin(false);
  await assert.rejects(t.bulut.sifreDegistir('42', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42 }, 'veli@example.com'), e => e.code === 'permission-denied');
  assert(!t.olaylar.some(o => o[0] === 'sifre'), 'the password is not changed');
  t.izin(true);
  await assert.rejects(t.bulut.sifreDegistir('41', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42 }, 'veli@example.com'), e => e.code === 'auth/invalid-credential');
  assert.deepEqual(Object.keys(t.belgeler), [], 'a wrong current password writes nothing');
  assert.ok(await t.bulut.girisOgrenciHesabi('Ada Yılmaz', 42), 'name + number still works');
  t.birincil.currentUser = null;
  await assert.rejects(t.bulut.sifreDegistir('42', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42 }, 'veli@example.com'), e => e.code === 'yks/oturum-yok');
});

test('Kaydol: sign-up writes its own redirect; password change keeps a recovery e-mail', async () => {
  const t = await load();
  const u = await t.bulut.uyeKaydol('Ali Veli', 'eski-sifre');
  const [yon] = t.belgeIle('girisYonu/');
  assert.deepEqual({ ...t.belgeler[yon], ts: 0 }, { email: u.email, uid: u.uid, ts: 0 }, 'the teacher can find the account by name');
  await t.bulut.sifreDegistir('eski-sifre', 'yeni-sifre', null, 'ali@example.com', 'aliveli');
  assert.deepEqual(t.belgeIle('sifreliGiris/'), [], 'no name + password lookup for Kaydol');
  assert.equal(t.belgeler[t.belgeIle('kurtarma/')[0]].tur, 'uye');
  t.birincil.currentUser = null;
  await assert.rejects(t.bulut.uyeGiris('aliveli', 'eski-sifre'), e => e.code === 'auth/invalid-credential');
  assert.equal((await t.bulut.uyeGiris('Ali Veli', 'yeni-sifre')).uid, u.uid);
  // An account from before redirects: the login alone writes nothing; the app writes it once the notebook name matches.
  delete t.belgeler[yon];
  t.birincil.currentUser = null;
  await t.bulut.uyeGiris('aliveli', 'yeni-sifre');
  assert.deepEqual(t.belgeIle('girisYonu/'), [], 'login alone writes no redirect');
  await t.bulut.uyeYonunuYaz();
  assert.equal((await t.bulut.uyeYonu('aliveli')).uid, u.uid);
});

test('Kaydol user-name change: the new name is reserved and redirects; the old redirect goes', async () => {
  const t = await load();
  const u = await t.bulut.uyeKaydol('aliveli', 'sifre-123');
  await t.bulut.uyeKaydol('mehmet', 'baska-1');                 // someone else's name
  t.birincil.currentUser = u;
  await assert.rejects(t.bulut.kullaniciAdiDegistir('aliveli', 'mehmet', 'sifre-123'), e => e.code === 'auth/email-already-in-use');
  await assert.rejects(t.bulut.kullaniciAdiDegistir('aliveli', 'yeniad', 'yanlis'), e => e.code === 'auth/invalid-credential');
  t.birincil.currentUser = u;
  await t.bulut.kullaniciAdiDegistir('aliveli', 'Yeni Ad', 'sifre-123');
  assert(t.olaylar.some(o => o[0] === 'hesap' && o[2] === 'ikincil'), 'the new name is reserved by an account of its own');
  t.birincil.currentUser = null;
  assert.equal((await t.bulut.uyeGiris('yeniad', 'sifre-123')).uid, u.uid, 'the new name signs in to the same account');
  assert.equal((await t.bulut.uyeYonu('aliveli')), null, 'the old name no longer redirects');
  t.birincil.currentUser = null;
  assert.equal((await t.bulut.uyeGiris('aliveli', 'sifre-123')).uid, u.uid, 'the old name still reaches the account; the app refuses it by the notebook name');
  assert.equal((await t.bulut.uyeYonu('aliveli')), null, 'and that login does not bring the old redirect back');
  await assert.rejects(t.bulut.uyeKaydol('yeniad', 'x-123456'), e => e.code === 'auth/email-already-in-use', 'nobody else can sign up with it');
  // Back to the original name: its own account, no reservation needed.
  t.birincil.currentUser = u;
  await t.bulut.kullaniciAdiDegistir('yeniad', 'aliveli', 'sifre-123');
  assert.equal((await t.bulut.uyeYonu('aliveli')).uid, u.uid);
});

test('teacher resets a Kaydol password: new account, redirect, hand-over; twice in a row keeps the root', async () => {
  const t = await load();
  const u = await t.bulut.uyeKaydol('aliveli', 'unutulan-1');
  t.ogretmen();
  const r = await t.bulut.uyeSifreSifirla('aliveli', u.uid);
  assert.match(r.sifre, /^\d{8}$/);
  assert.equal(t.belgeler['devir/' + u.uid].yeniUid, r.uid);
  const yon = await t.bulut.uyeYonu('aliveli');
  assert.deepEqual([yon.uid, yon.eskiUid, 'kokUid' in yon], [r.uid, u.uid, false]);
  assert.equal(t.birincil.currentUser.uid, 'ogretmen-1', 'the teacher stays signed in');
  t.birincil.currentUser = null;
  assert.equal((await t.bulut.uyeGiris('aliveli', r.sifre)).uid, r.uid, 'the new password signs in to the new account');
  t.ogretmen();
  const r2 = await t.bulut.uyeSifreSifirla('aliveli', r.uid, u.uid);
  assert.equal(t.belgeler['devir/' + r.uid].yeniUid, r2.uid);assert.equal(t.belgeler['devir/' + u.uid].yeniUid, r2.uid, 'the root hands over too');
  assert.deepEqual([(await t.bulut.uyeYonu('aliveli')).eskiUid, (await t.bulut.uyeYonu('aliveli')).kokUid], [r.uid, u.uid]);
});

test('teacher resets a school student to the school number: a new generation signs in by name + number', async () => {
  const t = await okulOgrencisi();
  await t.bulut.sifreDegistir('42', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42 }, 'veli@example.com');
  t.ogretmen();
  await t.bulut.okulYonuYaz('Ada Yılmaz', 42, 1);
  const yeni = await t.bulut.ogrenciHesabiHazirla('Ada Yılmaz', 42, 1);
  assert.notEqual(yeni.uid, t.uid);
  await t.bulut.sifreliGirisSil('Ada Yılmaz', t.uid);
  assert.deepEqual(t.belgeIle('sifreliGiris/'), []);
  t.birincil.currentUser = null;
  assert.equal((await t.bulut.girisOgrenciHesabi('ada yılmaz', ' 42')).uid, yeni.uid, 'name + number works again, on the new account');
  await assert.rejects(t.bulut.okulSifreGirisi('Ada Yılmaz', 'yeni-sifre'), e => e.code === 'auth/invalid-credential', 'the old password is gone');
  // A redirect that cannot be read never blocks the derived account.
  const t2 = await okulOgrencisi();
  t2.belgeler['girisYonu/' + 'x'] = { nesil: 5 };
  t2.birincil.currentUser = null;
  assert.equal((await t2.bulut.girisOgrenciHesabi('Ada Yılmaz', 42)).uid, t2.uid);
});

test('"Parolamı unuttum" requests: written signed out, listed and removed by the teacher', async () => {
  const t = await load();
  await t.bulut.sifreTalebi('uye', 'aliveli', 'ali@example.com');
  await t.bulut.sifreTalebi('okul', 'Ada Yılmaz', 'veli@example.com');
  const [ref] = t.belgeIle('sifreTalepleri/');
  assert.match(ref, /^sifreTalepleri\/[0-9a-f-]{36}$/);assert.deepEqual(Object.keys(t.belgeler[ref]).sort(), ['ad', 'eposta', 'ts', 'tur']);
  t.ogretmen();
  const liste = await t.bulut.sifreTalepleriAl();
  assert.deepEqual(liste.map(x => x.tur).sort(), ['okul', 'uye']);
  await t.bulut.sifreTalebiSil(liste[0].id);
  assert.equal((await t.bulut.sifreTalepleriAl()).length, 1);
});

test('a lookup entry that is not a school account email is never tried', async () => {
  const t = await okulOgrencisi();
  await t.bulut.sifreDegistir('42', 'yeni-sifre', { ad: 'Ada Yılmaz', no: 42 }, 'veli@example.com');
  const yol = t.belgeIle('sifreliGiris/')[0].split('/').slice(0, 3).join('/');
  t.belgeler[yol + '/sahte'] = { email: 'uye-' + 'a'.repeat(40) + '@uye.ykstekrar.app' };
  t.olaylar.length = 0; t.birincil.currentUser = null;
  await t.bulut.okulSifreGirisi('Ada Yılmaz', 'yeni-sifre');
  assert(t.olaylar.every(o => o[0] !== 'giris' || o[1].endsWith('@student.ykstekrar.app')));
});
