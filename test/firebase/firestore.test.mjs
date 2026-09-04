// Firestore security-rule tests for the "ogrenciler/{syncId}" home-sync design (+ the
// "ogretmenler/{uid}" teacher allowlist). Run from test/firebase/: npm install && npm test
// (npm test = firebase emulators:exec, which starts a local Firestore emulator, runs this
// script against it, and tears everything down automatically — no real Firebase project or
// credentials needed. See ../../firestore.rules for the rules under test.)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, updateDoc, runTransaction } from 'firebase/firestore';

let pass = 0, fail = 0;
const check = async (name, fn) => {
  try { await fn(); pass++; console.log('PASS', name); }
  catch (e) { fail++; console.log('FAIL', name, '-', e.message); }
};

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-yks-test',
  firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8081 }
});
await testEnv.clearFirestore();

const OGRETMEN_UID = 'ogretmen-1';          // allowlist'te — gerçek "sahip öğretmen"
const OGRETMEN2_UID = 'ogretmen-2';         // gerçek bir hesap ama allowlist'te DEĞİL
const TEMP_TEACHER_UID = 'ogretmen-gecici'; // yalnızca de-allowlist testinde kullanılır
const OGRENCI_UID = 'ogrenci-gercek-1';     // birincil öğrenci — üretimdeki gibi ANONİM
const OGRENCI2_UID = 'ogrenci-gercek-2';    // ikinci öğrenci (Fix E: ikinci syncId üzerinde tekrar)
const HESAPLI_OGRENCI_UID = 'ogrenci-hesap-1';
const SALDIRGAN_UID = 'saldirgan-1';

const gercekToken = { firebase: { sign_in_provider: 'google.com', identities: {} } };
const anonimToken = { firebase: { sign_in_provider: 'anonymous', identities: {} } };
const sifreToken = { firebase: { sign_in_provider: 'password', identities: {} } };

const ogretmenDb = testEnv.authenticatedContext(OGRETMEN_UID, gercekToken).firestore();
const ogretmen2Db = testEnv.authenticatedContext(OGRETMEN2_UID, gercekToken).firestore();
const saldirganDb = testEnv.authenticatedContext(SALDIRGAN_UID, gercekToken).firestore();
const anonOgretmenDb = testEnv.authenticatedContext(OGRETMEN_UID, anonimToken).firestore();
const anonDb = testEnv.unauthenticatedContext().firestore();
// Üretimde öğrenci cihazları HER ZAMAN anonim oturum açar (girisOgrenci()) — bu yüzden
// birincil öğrenci bağlamları burada da anonim. Gerçek (google.com) bir hesabın aynı
// işlemleri YAPAMADIĞINI kanıtlamak için ayrıca ogrenciGercekHesapDb tutulur.
const ogrenciDb = testEnv.authenticatedContext(OGRENCI_UID, anonimToken).firestore();
const ogrenciGercekHesapDb = testEnv.authenticatedContext(OGRENCI_UID, gercekToken).firestore();
const ogrenci2Db = testEnv.authenticatedContext(OGRENCI2_UID, anonimToken).firestore();
const hesapliOgrenciDb = testEnv.authenticatedContext(HESAPLI_OGRENCI_UID, sifreToken).firestore();

// Allowlist tohumlama: gerçek dünyada bu, öğretmenin ilk gerçek Google girişinden sonra
// Firebase konsolundan elle yapılan tek seferlik bir adımdır (bkz. plan §1).
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'ogretmenler', OGRETMEN_UID), {});
});

const bosYuva = (over) => Object.assign({
  ogretmenUid: OGRETMEN_UID, ogrenciNo: 3, ogrenciAd: 'Ayşe Yılmaz', ogrenciSube: '12A',
  ogrenciBulutId: 'bulut-id-1', bagliUid: null, paket: null, sunucuTs: null, durum: 'aktif'
}, over || {});
const hesapVeri = (syncId, over) => Object.assign({
  veri: JSON.stringify({ tur: 'yks-ogrenci-paketi', ogr: { no: 3 } }),
  syncId, aktif: true, ts: 1750000000000, surum: 1
}, over || {});

let sidN = 0;
const sid = (label) => 'sid-' + label + '-' + (++sidN);

// ================================================================== create
await check('teacher-can-create-reserved-slot', async () => {
  await assertSucceeds(setDoc(doc(ogretmenDb, 'ogrenciler', sid('create-ok')), bosYuva()));
});
await check('non-allowlisted-real-account-cannot-create-slot', async () => {
  await assertFails(setDoc(doc(ogretmen2Db, 'ogrenciler', sid('create-nonallow')),
    bosYuva({ ogretmenUid: OGRETMEN2_UID })));
});
await check('non-owner-cannot-create-slot-claiming-someone-elses-uid', async () => {
  await assertFails(setDoc(doc(saldirganDb, 'ogrenciler', sid('create-imperson')), bosYuva()));
});
await check('unauthenticated-cannot-create-slot', async () => {
  await assertFails(setDoc(doc(anonDb, 'ogrenciler', sid('create-anon')), bosYuva()));
});
await check('create-with-nonnull-bagliUid-rejected', async () => {
  await assertFails(setDoc(doc(ogretmenDb, 'ogrenciler', sid('create-bagli')), bosYuva({ bagliUid: OGRETMEN_UID })));
});
await check('create-with-nonnull-paket-rejected', async () => {
  await assertFails(setDoc(doc(ogretmenDb, 'ogrenciler', sid('create-paket')),
    bosYuva({ paket: { tur: 'yks-sonuc', surum: 2, kayit: [] } })));
});
await check('anonymous-account-cannot-create-slot-even-as-self-declared-owner', async () => {
  await assertFails(setDoc(doc(anonOgretmenDb, 'ogrenciler', sid('create-anonteacher')), bosYuva()));
});
await check('create-rejects-missing-ogrenciBulutId', async () => {
  const veri = bosYuva(); delete veri.ogrenciBulutId;
  await assertFails(setDoc(doc(ogretmenDb, 'ogrenciler', sid('create-nobulutid')), veri));
});
await check('create-rejects-empty-ogrenciBulutId', async () => {
  await assertFails(setDoc(doc(ogretmenDb, 'ogrenciler', sid('create-emptybulutid')), bosYuva({ ogrenciBulutId: '' })));
});
await check('create-rejects-non-aktif-durum', async () => {
  await assertFails(setDoc(doc(ogretmenDb, 'ogrenciler', sid('create-baddurum')), bosYuva({ durum: 'iptal' })));
});

// ================================================================== önceden seçilmiş öğrenci hesabı
const hesapSid = sid('account');
await check('teacher-can-publish-student-account-package', async () => {
  await assertSucceeds(setDoc(
    doc(ogretmenDb, 'ogrenciHesaplari', HESAPLI_OGRENCI_UID), hesapVeri(hesapSid)));
});
await check('student-can-read-only-own-active-account-package', async () => {
  await assertSucceeds(getDoc(doc(hesapliOgrenciDb, 'ogrenciHesaplari', HESAPLI_OGRENCI_UID)));
  await assertFails(getDoc(doc(ogrenciGercekHesapDb, 'ogrenciHesaplari', HESAPLI_OGRENCI_UID)));
  await assertFails(getDoc(doc(anonDb, 'ogrenciHesaplari', HESAPLI_OGRENCI_UID)));
});
await check('student-cannot-write-account-package', async () => {
  await assertFails(updateDoc(
    doc(hesapliOgrenciDb, 'ogrenciHesaplari', HESAPLI_OGRENCI_UID), { aktif: false }));
});
await check('teacher-can-create-slot-prebound-to-published-account', async () => {
  await assertSucceeds(setDoc(doc(ogretmenDb, 'ogrenciler', hesapSid),
    bosYuva({ bagliUid: HESAPLI_OGRENCI_UID })));
});
await check('password-student-account-can-send-results-to-own-slot', async () => {
  await assertSucceeds(updateDoc(doc(hesapliOgrenciDb, 'ogrenciler', hesapSid), {
    bagliUid: HESAPLI_OGRENCI_UID,
    paket: { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 100, k: 5, d: 8, s: 10, t: 1 }], konular: {} },
    sunucuTs: null
  }));
});
await check('password-student-can-record-valid-automatic-sync-event', async () => {
  await assertSucceeds(updateDoc(doc(hesapliOgrenciDb, 'ogrenciler', hesapSid), {
    paket: { tur: 'yks-sonuc', surum: 2, kayit: [], konular: {},
      istemciOlay: { tur: 'plan-baslatildi', hafta: 100, ts: 1750000000000, toplam: 7 } },
    sunucuTs: 1750000000000
  }));
});
await check('password-student-cannot-record-arbitrary-sync-event', async () => {
  await assertFails(updateDoc(doc(hesapliOgrenciDb, 'ogrenciler', hesapSid), {
    paket: { tur: 'yks-sonuc', surum: 2, kayit: [], konular: {},
      istemciOlay: { tur: 'hesabi-sil', hafta: 100, ts: 1750000000000, gizli: true } },
    sunucuTs: 1750000000000
  }));
});
await check('password-student-account-cannot-use-another-sync-slot', async () => {
  const baskaSid = sid('account-other-slot');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'ogrenciler', baskaSid),
      bosYuva({ bagliUid: HESAPLI_OGRENCI_UID, ogrenciBulutId: 'other-cloud-id' }));
  });
  await assertFails(updateDoc(doc(hesapliOgrenciDb, 'ogrenciler', baskaSid), {
    bagliUid: HESAPLI_OGRENCI_UID,
    paket: { tur: 'yks-sonuc', surum: 2, kayit: [], konular: {} },
    sunucuTs: null
  }));
});
await check('teacher-can-rebind-existing-slot-only-to-matching-published-account', async () => {
  const rebindSid = sid('account-rebind');
  await assertSucceeds(setDoc(
    doc(ogretmenDb, 'ogrenciHesaplari', HESAPLI_OGRENCI_UID), hesapVeri(rebindSid)));
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'ogrenciler', rebindSid), bosYuva());
  });
  await assertSucceeds(updateDoc(
    doc(ogretmenDb, 'ogrenciler', rebindSid), { bagliUid: HESAPLI_OGRENCI_UID }));
  await assertFails(updateDoc(
    doc(ogretmenDb, 'ogrenciler', rebindSid), { bagliUid: 'not-a-published-account' }));
  // Sonraki testler asıl hesap belgesini ilk syncId ile kullanır.
  await assertSucceeds(setDoc(
    doc(ogretmenDb, 'ogrenciHesaplari', HESAPLI_OGRENCI_UID), hesapVeri(hesapSid)));
});

// ================================================================== read + allowlist revocation
await check('allowlisted-teacher-can-check-missing-slot-before-create', async () => {
  const missingSid = sid('read-missing');
  const snapshot = await assertSucceeds(getDoc(doc(ogretmenDb, 'ogrenciler', missingSid)));
  if (snapshot.exists()) throw new Error('fresh random syncId unexpectedly exists');
  await assertSucceeds(setDoc(doc(ogretmenDb, 'ogrenciler', missingSid), bosYuva()));
});
await check('non-allowlisted-teacher-cannot-probe-missing-slot', async () => {
  await assertFails(getDoc(doc(ogretmen2Db, 'ogrenciler', sid('read-missing-nonallow'))));
});
const readSid = sid('read');
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'ogrenciler', readSid), bosYuva());
});
await check('stranger-cannot-read-unclaimed-slot', async () => {
  await assertFails(getDoc(doc(saldirganDb, 'ogrenciler', readSid)));
});
await check('unauthenticated-cannot-read-slot', async () => {
  await assertFails(getDoc(doc(anonDb, 'ogrenciler', readSid)));
});
await check('owning-teacher-CAN-read-slot', async () => {
  await assertSucceeds(getDoc(doc(ogretmenDb, 'ogrenciler', readSid)));
});
await check('de-allowlisted-teacher-loses-read-access', async () => {
  const tempDb = testEnv.authenticatedContext(TEMP_TEACHER_UID, gercekToken).firestore();
  const tempSid = sid('deallow');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'ogretmenler', TEMP_TEACHER_UID), {});
    await setDoc(doc(ctx.firestore(), 'ogrenciler', tempSid), bosYuva({ ogretmenUid: TEMP_TEACHER_UID }));
  });
  await assertSucceeds(getDoc(doc(tempDb, 'ogrenciler', tempSid)));   // allowlist'teyken okuyabiliyor
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(ctx.firestore(), 'ogretmenler', TEMP_TEACHER_UID));
  });
  await assertFails(getDoc(doc(tempDb, 'ogrenciler', tempSid)));      // allowlist'ten çıkarılınca okuyamıyor
});

// ================================================================== ilk bağlanma (öğrenci)
const claimSid = sid('claim');
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'ogrenciler', claimSid), bosYuva());
});
const ilkPaket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 100, k: 5, d: 8, s: 10, t: 1 }], konular: {} };
await check('non-anonymous-account-cannot-claim-or-resync-student-slot', async () => {
  // Gerçek (anonim OLMAYAN) bir hesap — allowlist'teki öğretmenin kendi hesabı bile —
  // öğrenci dalını kullanamaz. Bu, sağlayıcı kontrolünün yalnızca niyet belgesi değil,
  // gerçekten yazmayı ENGELLEDİĞİNİ kanıtlar.
  await assertFails(updateDoc(doc(ogretmenDb, 'ogrenciler', claimSid),
    { bagliUid: OGRETMEN_UID, paket: ilkPaket, sunucuTs: null }));
});
await check('real-student-can-claim-unclaimed-slot', async () => {
  await assertSucceeds(updateDoc(doc(ogrenciDb, 'ogrenciler', claimSid),
    { bagliUid: OGRENCI_UID, paket: ilkPaket, sunucuTs: null }));
});
await check('attacker-cannot-claim-already-bound-slot', async () => {
  const sahtePaket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 101, k: 5, d: 1, s: 10, t: 2 }] };
  const saldirganAnonDb = testEnv.authenticatedContext(SALDIRGAN_UID, anonimToken).firestore();
  await assertFails(updateDoc(doc(saldirganAnonDb, 'ogrenciler', claimSid),
    { bagliUid: SALDIRGAN_UID, paket: sahtePaket, sunucuTs: null }));
});
await check('attacker-cannot-write-with-mismatched-uid-even-if-claiming-same-bagliUid', async () => {
  const sahtePaket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 102, k: 5, d: 0, s: 10, t: 3 }] };
  const saldirganAnonDb = testEnv.authenticatedContext(SALDIRGAN_UID, anonimToken).firestore();
  await assertFails(updateDoc(doc(saldirganAnonDb, 'ogrenciler', claimSid),
    { bagliUid: OGRENCI_UID, paket: sahtePaket, sunucuTs: null }));
});

// ================================================================== bağlı öğrenci davranışı
await check('bound-student-cannot-change-ogrenciAd', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', claimSid), { ogrenciAd: 'Sahte İsim', paket: ilkPaket }));
});
await check('bound-student-cannot-change-ogretmenUid', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', claimSid), { ogretmenUid: SALDIRGAN_UID, paket: ilkPaket }));
});
await check('bound-student-cannot-change-ogrenciBulutId', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', claimSid), { ogrenciBulutId: 'baska-bir-id', paket: ilkPaket }));
});
await check('bound-student-cannot-add-unknown-field', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', claimSid), { paket: ilkPaket, ekstraAlan: 'sızma-denemesi' }));
});
await check('bound-student-cannot-reassign-bagliUid-to-another-uid', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', claimSid),
    { bagliUid: SALDIRGAN_UID, paket: ilkPaket, sunucuTs: null }));
});
await check('student-cannot-set-sonrakiSyncId-on-active-slot', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', claimSid),
    { paket: ilkPaket, sunucuTs: null, sonrakiSyncId: sid('sneaky') }));
});
await check('bound-student-can-sync-again', async () => {
  const yeniPaket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 103, k: 5, d: 9, s: 10, t: 4 }], konular: {} };
  await assertSucceeds(updateDoc(doc(ogrenciDb, 'ogrenciler', claimSid), { paket: yeniPaket, sunucuTs: null }));
});
await check('bound-student-can-read-own-slot', async () => {
  await assertSucceeds(getDoc(doc(ogrenciDb, 'ogrenciler', claimSid)));
});
await check('stranger-still-cannot-read-bound-slot', async () => {
  await assertFails(getDoc(doc(saldirganDb, 'ogrenciler', claimSid)));
});

// ================================================================== Fix E: ikinci (anonim) öğrenci, ikinci syncId
const claim2Sid = sid('claim2');
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'ogrenciler', claim2Sid), bosYuva({ ogrenciNo: 4, ogrenciAd: 'Deniz Kaya', ogrenciBulutId: 'bulut-id-2' }));
});
await check('second-anonymous-student-can-claim-unclaimed-slot', async () => {
  await assertSucceeds(updateDoc(doc(ogrenci2Db, 'ogrenciler', claim2Sid),
    { bagliUid: OGRENCI2_UID, paket: ilkPaket, sunucuTs: null }));
});
await check('second-anonymous-student-can-resync', async () => {
  const yeniPaket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 104, k: 5, d: 9, s: 10, t: 5 }], konular: {} };
  await assertSucceeds(updateDoc(doc(ogrenci2Db, 'ogrenciler', claim2Sid), { paket: yeniPaket, sunucuTs: null }));
});

// ================================================================== malformed / oversized
const malformedSid = sid('malformed');
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'ogrenciler', malformedSid), bosYuva({ bagliUid: OGRENCI_UID, paket: ilkPaket }));
});
await check('malformed-paket-shape-rejected', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', malformedSid), { paket: { tur: 'baska-bir-sey' } }));
});
await check('oversized-kayit-rejected', async () => {
  const devasa = { tur: 'yks-sonuc', surum: 2, kayit: new Array(5001).fill({ g: 1, k: 1, d: 1, s: 1, t: 1 }) };
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', malformedSid), { paket: devasa }));
});
await check('oversized-konular-rejected', async () => {
  const konularDevasa = {};
  for (let i = 0; i < 2001; i++) konularDevasa['k' + i] = [0, 'konu ' + i];
  const paket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 1, k: 1, d: 1, s: 1, t: 1 }], konular: konularDevasa };
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', malformedSid), { paket }));
});

// ================================================================== devre dışı bırakma (syncId rotasyonu)
async function disableAndCreate(actorDb, oldSid, newSid, yeniVeri) {
  return runTransaction(actorDb, async (tx) => {
    tx.update(doc(actorDb, 'ogrenciler', oldSid), { durum: 'iptal', sonrakiSyncId: newSid });
    tx.set(doc(actorDb, 'ogrenciler', newSid), yeniVeri);
  });
}

await check('allowlisted-teacher-can-disable-then-create-fresh-slot', async () => {
  const oldS = sid('disable-ok-old'), newS = sid('disable-ok-new');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'ogrenciler', oldS), bosYuva({ bagliUid: 'eski-cihaz', paket: ilkPaket }));
  });
  await assertSucceeds(disableAndCreate(ogretmenDb, oldS, newS,
    { ogretmenUid: OGRETMEN_UID, ogrenciNo: 3, ogrenciAd: 'Ayşe Yılmaz', ogrenciSube: '12A',
      ogrenciBulutId: 'bulut-id-1', bagliUid: null, paket: null, sunucuTs: null, durum: 'aktif' }));
  // yeni yuva sıradan bir öğrenci tarafından normal şekilde talep edilebilir
  const yeniOgrenciDb = testEnv.authenticatedContext('yeni-cihaz-uid', anonimToken).firestore();
  await assertSucceeds(updateDoc(doc(yeniOgrenciDb, 'ogrenciler', newS),
    { bagliUid: 'yeni-cihaz-uid', paket: ilkPaket, sunucuTs: null }));
});

await check('disable-branch-cannot-touch-paket-or-identity', async () => {
  const oldS = sid('disable-tamper-old'), newS = sid('disable-tamper-new');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'ogrenciler', oldS), bosYuva({ bagliUid: 'eski-cihaz', paket: ilkPaket }));
  });
  await assertFails(runTransaction(ogretmenDb, async (tx) => {
    tx.update(doc(ogretmenDb, 'ogrenciler', oldS), { durum: 'iptal', sonrakiSyncId: newS, paket: null });
    tx.set(doc(ogretmenDb, 'ogrenciler', newS),
      { ogretmenUid: OGRETMEN_UID, ogrenciNo: 3, ogrenciAd: 'Ayşe Yılmaz', ogrenciSube: '12A',
        ogrenciBulutId: 'bulut-id-1', bagliUid: null, paket: null, sunucuTs: null, durum: 'aktif' });
  }));
});

await check('disable-branch-requires-sonrakiSyncId', async () => {
  const oldS = sid('disable-nonext-old');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'ogrenciler', oldS), bosYuva({ bagliUid: 'eski-cihaz', paket: ilkPaket }));
  });
  await assertFails(updateDoc(doc(ogretmenDb, 'ogrenciler', oldS), { durum: 'iptal' }));
});

await check('disable-rejects-mismatched-sonrakiSyncId', async () => {
  const oldS = sid('disable-mismatch-old'), newS = sid('disable-mismatch-new');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'ogrenciler', oldS), bosYuva({ bagliUid: 'eski-cihaz', paket: ilkPaket }));
  });
  await assertFails(disableAndCreate(ogretmenDb, oldS, newS,
    // farklı öğrenci numarasıyla — kimlik eşleşmiyor
    { ogretmenUid: OGRETMEN_UID, ogrenciNo: 999, ogrenciAd: 'Ayşe Yılmaz', ogrenciSube: '12A',
      ogrenciBulutId: 'bulut-id-1', bagliUid: null, paket: null, sunucuTs: null, durum: 'aktif' }));
});

await check('disable-rejects-sonrakiSyncId-with-mismatched-ogrenciBulutId', async () => {
  const oldS = sid('disable-badbulutid-old'), newS = sid('disable-badbulutid-new');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'ogrenciler', oldS), bosYuva({ bagliUid: 'eski-cihaz', paket: ilkPaket }));
  });
  await assertFails(disableAndCreate(ogretmenDb, oldS, newS,
    { ogretmenUid: OGRETMEN_UID, ogrenciNo: 3, ogrenciAd: 'Ayşe Yılmaz', ogrenciSube: '12A',
      ogrenciBulutId: 'FARKLI-bulut-id', bagliUid: null, paket: null, sunucuTs: null, durum: 'aktif' }));
});

await check('disable-rejects-sonrakiSyncId-pointing-at-a-pre-existing-document', async () => {
  const oldS = sid('disable-preexist-old'), preexistS = sid('disable-preexist-new');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'ogrenciler', oldS), bosYuva({ bagliUid: 'eski-cihaz', paket: ilkPaket }));
    // "yeni" belge zaten transaction ÖNCESİNDEN var — sahte bir "taze" halef
    await setDoc(doc(ctx.firestore(), 'ogrenciler', preexistS), bosYuva());
  });
  await assertFails(runTransaction(ogretmenDb, async (tx) => {
    tx.update(doc(ogretmenDb, 'ogrenciler', oldS), { durum: 'iptal', sonrakiSyncId: preexistS });
  }));
});

await check('disabled-slot-cannot-be-reclaimed-or-read-by-original-uid', async () => {
  const oldS = sid('disable-regress-old'), newS = sid('disable-regress-new');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'ogrenciler', oldS), bosYuva({ bagliUid: OGRENCI_UID, paket: ilkPaket, ogrenciBulutId: 'bulut-regress' }));
  });
  await assertSucceeds(disableAndCreate(ogretmenDb, oldS, newS,
    { ogretmenUid: OGRETMEN_UID, ogrenciNo: 3, ogrenciAd: 'Ayşe Yılmaz', ogrenciSube: '12A',
      ogrenciBulutId: 'bulut-regress', bagliUid: null, paket: null, sunucuTs: null, durum: 'aktif' }));
  // eski (uncleared) cihaz aynı OGRENCI_UID ile ne yeniden bağlanabilir...
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', oldS),
    { bagliUid: OGRENCI_UID, paket: ilkPaket, sunucuTs: null }));
  // ...ne de artık eski belgeyi okuyabilir (sonrakiSyncId'yi asla öğrenemez)
  await assertFails(getDoc(doc(ogrenciDb, 'ogrenciler', oldS)));
});

// ================================================================== öğretmenin kendi bulut yedeği
// Öğretmenin defterinin tamamı (31 öğrencinin adı dahil) burada durur; en sıkı testler bunlar.
const yedekVeri = () => ({ veri: JSON.stringify({ rol: 'rehber', ogr: [{ ad: 'Ayşe Yılmaz' }] }),
  ts: 1750000000000, surum: 10, boyut: 60 });

await check('teacher-can-write-and-read-own-backup', async () => {
  await assertSucceeds(setDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID), yedekVeri()));
  const anlik = await assertSucceeds(getDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID)));
  if (!anlik.exists()) throw new Error('yedek yazıldı ama okunamadı');
});
await check('teacher-cannot-read-another-teachers-backup', async () => {
  // OGRETMEN2 allowlist'te değil; ayrıca başkasının UID'si altına hiç bakamamalı
  await assertFails(getDoc(doc(ogretmen2Db, 'ogretmenYedek', OGRETMEN_UID)));
  // allowlist'teki öğretmen bile BAŞKASININ yedeğini okuyamaz
  await assertFails(getDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN2_UID)));
});
await check('teacher-cannot-write-into-another-teachers-backup', async () => {
  await assertFails(setDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN2_UID), yedekVeri()));
});
await check('anonymous-student-cannot-touch-any-teacher-backup', async () => {
  await assertFails(getDoc(doc(ogrenciDb, 'ogretmenYedek', OGRETMEN_UID)));
  await assertFails(setDoc(doc(ogrenciDb, 'ogretmenYedek', OGRENCI_UID), yedekVeri()));
});
await check('unauthenticated-cannot-touch-teacher-backup', async () => {
  await assertFails(getDoc(doc(anonDb, 'ogretmenYedek', OGRETMEN_UID)));
  await assertFails(setDoc(doc(anonDb, 'ogretmenYedek', OGRETMEN_UID), yedekVeri()));
});
await check('non-allowlisted-real-account-cannot-write-own-backup', async () => {
  // Kendi UID'si altına bile yazamaz: allowlist dışı bir hesap depolamayı kullanamamalı
  await assertFails(setDoc(doc(ogretmen2Db, 'ogretmenYedek', OGRETMEN2_UID), yedekVeri()));
});
await check('backup-rejects-oversized-payload', async () => {
  await assertFails(setDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID),
    Object.assign(yedekVeri(), { veri: 'x'.repeat(900001) })));
});
await check('backup-rejects-unknown-fields-and-bad-types', async () => {
  await assertFails(setDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID),
    Object.assign(yedekVeri(), { fazladan: 'sızma' })));
  await assertFails(setDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID),
    Object.assign(yedekVeri(), { veri: { nesne: 1 } })));
  await assertFails(setDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID),
    Object.assign(yedekVeri(), { veri: '' })));
});
await check('backup-cannot-be-deleted', async () => {
  const { deleteDoc } = await import('firebase/firestore');
  await assertFails(deleteDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID)));
});
await check('de-allowlisted-teacher-loses-access-to-own-backup', async () => {
  const tempDb = testEnv.authenticatedContext(TEMP_TEACHER_UID, gercekToken).firestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'ogretmenler', TEMP_TEACHER_UID), {});
  });
  await assertSucceeds(setDoc(doc(tempDb, 'ogretmenYedek', TEMP_TEACHER_UID), yedekVeri()));
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(ctx.firestore(), 'ogretmenler', TEMP_TEACHER_UID));
  });
  await assertFails(getDoc(doc(tempDb, 'ogretmenYedek', TEMP_TEACHER_UID)));
});

// ================================================================== günlük yedek geçmişi
const gunVeri = (over) => Object.assign({
  veri: JSON.stringify({ rol: 'rehber', ogr: [{ ad: 'Ayşe Yılmaz' }] }),
  ts: 1750000000000, surum: 10, boyut: 60, ogrenciSayisi: 1, sonucSayisi: 0
}, over || {});

await check('teacher-can-write-and-list-own-daily-snapshots', async () => {
  const { collection, getDocs } = await import('firebase/firestore');
  await assertSucceeds(setDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-01'), gunVeri()));
  await assertSucceeds(setDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-02'), gunVeri()));
  const liste = await assertSucceeds(getDocs(collection(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID, 'gecmis')));
  if (liste.size !== 2) throw new Error('beklenen 2 gün, gelen ' + liste.size);
});
await check('nobody-else-can-read-or-list-a-teachers-snapshots', async () => {
  const { collection, getDocs } = await import('firebase/firestore');
  await assertFails(getDoc(doc(ogretmen2Db, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-01')));
  await assertFails(getDocs(collection(ogretmen2Db, 'ogretmenYedek', OGRETMEN_UID, 'gecmis')));
  await assertFails(getDoc(doc(ogrenciDb, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-01')));
  await assertFails(getDoc(doc(hesapliOgrenciDb, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-01')));
  await assertFails(getDoc(doc(anonDb, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-01')));
});
await check('nobody-can-write-into-another-teachers-snapshots', async () => {
  await assertFails(setDoc(doc(ogretmen2Db, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-03'), gunVeri()));
  await assertFails(setDoc(doc(hesapliOgrenciDb, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-03'), gunVeri()));
});
await check('snapshots-cannot-be-deleted-so-history-cannot-be-erased', async () => {
  const { deleteDoc } = await import('firebase/firestore');
  await assertFails(deleteDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-01')));
});
await check('snapshot-rejects-unknown-fields-and-oversized-payload', async () => {
  await assertFails(setDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-04'),
    gunVeri({ fazladan: 'sızma' })));
  await assertFails(setDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-04'),
    gunVeri({ veri: 'x'.repeat(900001) })));
  await assertFails(setDoc(doc(ogretmenDb, 'ogretmenYedek', OGRETMEN_UID, 'gecmis', '2026-09-04'),
    gunVeri({ veri: '' })));
});

console.log('\n=== TOTAL:', pass, 'passed,', fail, 'failed ===');
await testEnv.cleanup();
process.exit(fail ? 1 : 0);
