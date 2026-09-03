// Firestore security-rule tests for the "ogrenciler/{syncId}" home-sync design.
// Run from test/firebase/: npm install && npm test
// (npm test = firebase emulators:exec, which starts a local Firestore emulator, runs this
// script against it, and tears everything down automatically — no real Firebase project or
// credentials needed. See ../../firestore.rules for the rules under test.)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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

const OGRETMEN_UID = 'ogretmen-1';
const OGRETMEN2_UID = 'ogretmen-2';         // farklı, gerçek bir ikinci öğretmen hesabı
const OGRENCI_UID = 'ogrenci-gercek-1';
const SALDIRGAN_UID = 'saldirgan-1';
const SYNC_ID = 'test-sync-id-abc';

const gercekToken = { firebase: { sign_in_provider: 'google.com', identities: {} } };
const anonimToken = { firebase: { sign_in_provider: 'anonymous', identities: {} } };

const ogretmenDb = testEnv.authenticatedContext(OGRETMEN_UID, gercekToken).firestore();
const ogretmen2Db = testEnv.authenticatedContext(OGRETMEN2_UID, gercekToken).firestore();
const ogrenciDb = testEnv.authenticatedContext(OGRENCI_UID, gercekToken).firestore();
const saldirganDb = testEnv.authenticatedContext(SALDIRGAN_UID, gercekToken).firestore();
const anonOgretmenDb = testEnv.authenticatedContext(OGRETMEN_UID, anonimToken).firestore();
const anonDb = testEnv.unauthenticatedContext().firestore();

const bosYuva = { ogretmenUid: OGRETMEN_UID, ogrenciNo: 3, ogrenciAd: 'Ayşe Yılmaz', ogrenciSube: '12A',
  bagliUid: null, paket: null, sunucuTs: null };

// --- create ---
await check('teacher-can-create-reserved-slot', async () => {
  await assertSucceeds(setDoc(doc(ogretmenDb, 'ogrenciler', SYNC_ID), bosYuva));
});
await testEnv.clearFirestore();

await check('non-owner-cannot-create-slot-claiming-someone-elses-uid', async () => {
  await assertFails(setDoc(doc(saldirganDb, 'ogrenciler', SYNC_ID), bosYuva));
});
await check('unauthenticated-cannot-create-slot', async () => {
  await assertFails(setDoc(doc(anonDb, 'ogrenciler', SYNC_ID), bosYuva));
});
await check('create-with-nonnull-bagliUid-rejected', async () => {
  await assertFails(setDoc(doc(ogretmenDb, 'ogrenciler', SYNC_ID), Object.assign({}, bosYuva, { bagliUid: OGRETMEN_UID })));
});
await check('create-with-nonnull-paket-rejected', async () => {
  await assertFails(setDoc(doc(ogretmenDb, 'ogrenciler', SYNC_ID),
    Object.assign({}, bosYuva, { paket: { tur: 'yks-sonuc', surum: 2, kayit: [] } })));
});
await check('anonymous-account-cannot-create-slot-even-as-self-declared-owner', async () => {
  await assertFails(setDoc(doc(anonOgretmenDb, 'ogrenciler', SYNC_ID), bosYuva));
});

// set up a real reserved slot for the rest of the tests, bypassing rules
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'ogrenciler', SYNC_ID), bosYuva);
});

// --- read ---
await check('stranger-cannot-read-unclaimed-slot', async () => {
  await assertFails(getDoc(doc(saldirganDb, 'ogrenciler', SYNC_ID)));
});
await check('unauthenticated-cannot-read-slot', async () => {
  await assertFails(getDoc(doc(anonDb, 'ogrenciler', SYNC_ID)));
});
await check('owning-teacher-CAN-read-slot', async () => {
  await assertSucceeds(getDoc(doc(ogretmenDb, 'ogrenciler', SYNC_ID)));
});

// --- first claim ---
const ilkPaket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 100, k: 5, d: 8, s: 10, t: 1 }], konular: {} };
await check('real-student-can-claim-unclaimed-slot', async () => {
  await assertSucceeds(updateDoc(doc(ogrenciDb, 'ogrenciler', SYNC_ID),
    { bagliUid: OGRENCI_UID, paket: ilkPaket, sunucuTs: null }));
});

await check('attacker-cannot-claim-already-bound-slot', async () => {
  const sahtePaket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 101, k: 5, d: 1, s: 10, t: 2 }] };
  await assertFails(updateDoc(doc(saldirganDb, 'ogrenciler', SYNC_ID),
    { bagliUid: SALDIRGAN_UID, paket: sahtePaket, sunucuTs: null }));
});
await check('attacker-cannot-write-with-mismatched-uid-even-if-claiming-same-bagliUid', async () => {
  const sahtePaket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 102, k: 5, d: 0, s: 10, t: 3 }] };
  await assertFails(updateDoc(doc(saldirganDb, 'ogrenciler', SYNC_ID),
    { bagliUid: OGRENCI_UID, paket: sahtePaket, sunucuTs: null }));
});

// --- bound-student behavior (identity + bagliUid immutability, this is the fix for the
//     original "hijack" bug: the earlier rules let an already-bound student reassign
//     bagliUid to a different uid because only the OLD value was checked) ---
await check('bound-student-cannot-change-ogrenciAd', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', SYNC_ID),
    { ogrenciAd: 'Sahte İsim', paket: ilkPaket }));
});
await check('bound-student-cannot-change-ogretmenUid', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', SYNC_ID),
    { ogretmenUid: SALDIRGAN_UID, paket: ilkPaket }));
});
await check('bound-student-cannot-add-unknown-field', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', SYNC_ID),
    { paket: ilkPaket, ekstraAlan: 'sızma-denemesi' }));
});
await check('bound-student-cannot-reassign-bagliUid-to-another-uid', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', SYNC_ID),
    { bagliUid: SALDIRGAN_UID, paket: ilkPaket, sunucuTs: null }));
});
await check('bound-student-can-sync-again', async () => {
  const yeniPaket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 103, k: 5, d: 9, s: 10, t: 4 }], konular: {} };
  await assertSucceeds(updateDoc(doc(ogrenciDb, 'ogrenciler', SYNC_ID), { paket: yeniPaket, sunucuTs: null }));
});
await check('bound-student-can-read-own-slot', async () => {
  await assertSucceeds(getDoc(doc(ogrenciDb, 'ogrenciler', SYNC_ID)));
});
await check('stranger-still-cannot-read-bound-slot', async () => {
  await assertFails(getDoc(doc(saldirganDb, 'ogrenciler', SYNC_ID)));
});

// --- malformed / oversized payloads ---
await check('malformed-paket-shape-rejected', async () => {
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', SYNC_ID), { paket: { tur: 'baska-bir-sey' } }));
});
await check('oversized-kayit-rejected', async () => {
  const devasa = { tur: 'yks-sonuc', surum: 2, kayit: new Array(5001).fill({ g: 1, k: 1, d: 1, s: 1, t: 1 }) };
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', SYNC_ID), { paket: devasa }));
});
await check('oversized-konular-rejected', async () => {
  const konularDevasa = {};
  for (let i = 0; i < 2001; i++) konularDevasa['k' + i] = [0, 'konu ' + i];
  const paket = { tur: 'yks-sonuc', surum: 2, kayit: [{ g: 1, k: 1, d: 1, s: 1, t: 1 }], konular: konularDevasa };
  await assertFails(updateDoc(doc(ogrenciDb, 'ogrenciler', SYNC_ID), { paket }));
});

// --- teacher-initiated reset (new: recovers a lost/wiped student device) ---
await check('owning-teacher-can-reset-a-bound-slot', async () => {
  await assertSucceeds(updateDoc(doc(ogretmenDb, 'ogrenciler', SYNC_ID),
    { bagliUid: null, paket: null, sunucuTs: null }));
});
await check('non-owner-cannot-reset-a-slot', async () => {
  // yeniden bağlanmamış (bagliUid null) bir yuvayı farklı bir öğretmen sıfırlayamaz
  await assertFails(updateDoc(doc(ogretmen2Db, 'ogrenciler', SYNC_ID),
    { bagliUid: null, paket: null, sunucuTs: null }));
});
await check('anonymous-current-user-cannot-perform-teacher-reset', async () => {
  // yuvayı tekrar bağlı hale getirip, anonim bir "öğretmen" ile sıfırlamayı dene
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'ogrenciler', SYNC_ID), { bagliUid: OGRENCI_UID, paket: ilkPaket, sunucuTs: null });
  });
  await assertFails(updateDoc(doc(anonOgretmenDb, 'ogrenciler', SYNC_ID),
    { bagliUid: null, paket: null, sunucuTs: null }));
});
await check('teacher-reset-cannot-also-change-identity-fields', async () => {
  await assertFails(updateDoc(doc(ogretmenDb, 'ogrenciler', SYNC_ID),
    { bagliUid: null, paket: null, sunucuTs: null, ogrenciAd: 'Başka İsim' }));
});
await check('student-can-reclaim-slot-after-teacher-reset', async () => {
  // yuva zaten yukarıdaki adımlardan sıfırlanmamış olabilir; garanti altına al, sonra yeniden bağla
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'ogrenciler', SYNC_ID), { bagliUid: null, paket: null, sunucuTs: null });
  });
  await assertSucceeds(updateDoc(doc(ogrenciDb, 'ogrenciler', SYNC_ID),
    { bagliUid: OGRENCI_UID, paket: ilkPaket, sunucuTs: null }));
});

console.log('\n=== TOTAL:', pass, 'passed,', fail, 'failed ===');
await testEnv.cleanup();
process.exit(fail ? 1 : 0);
