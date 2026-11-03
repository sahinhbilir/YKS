// Security rules of ogretmenYedek/{owner}/gunlukRapor/{raporId} (Günlük rapor): a student creates up to
// three reports a day under the teacher their slot is linked to; the owner and a co-teacher read, list
// and delete; a viewer reads and lists; nobody updates; the student cannot read anything back.
// Run: firebase emulators:exec --only firestore --project demo-yks-test "node test/firebase/gunluk-rapor.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-yks-test',
  firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8081 } });
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log('PASS', name); };

const google = { firebase: { sign_in_provider: 'google.com', identities: {} } };
const ogrToken = { firebase: { sign_in_provider: 'password', identities: {} }, email: 'ogr-' + 'a'.repeat(40) + '@student.ykstekrar.app' };
const ogr2Token = { firebase: { sign_in_provider: 'password', identities: {} }, email: 'ogr-' + 'b'.repeat(40) + '@student.ykstekrar.app' };
const OWNER = 'owner', STU = 'StudentUid1', STU2 = 'StudentUid2', UNLINKED = 'StudentUid3', OTHER_OWNER = 'owner2';
const owner = env.authenticatedContext(OWNER, google).firestore();
const co = env.authenticatedContext('co', google).firestore();
const viewer = env.authenticatedContext('viewer', google).firestore();
const stranger = env.authenticatedContext('stranger', google).firestore();
const stu = env.authenticatedContext(STU, ogrToken).firestore();
const stu2 = env.authenticatedContext(STU2, ogr2Token).firestore();
const unlinked = env.authenticatedContext(UNLINKED, ogrToken).firestore();
const anonStu = env.authenticatedContext(STU, { firebase: { sign_in_provider: 'anonymous', identities: {} } }).firestore();
const noAuth = env.unauthenticatedContext().firestore();

// Istanbul calendar day (UTC+3, no daylight saving), the same key the site builds.
const gun = (kaydir = 0) => new Date(Date.now() + 3 * 3600e3 + kaydir * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
const rid = (uid, n, kaydir = 0) => `${uid}-${gun(kaydir)}-${n}`;
const ref = (db, id, sahip = OWNER) => doc(db, 'ogretmenYedek', sahip, 'gunlukRapor', id);
const jpeg = n => 'data:image/jpeg;base64,' + 'QUJD'.repeat(Math.floor((n - 23) / 4));   // exactly <= n chars
const rapor = (over = {}) => ({ ogrenciUid: STU, ogrenciBulutId: 'bulut-1', ts: Date.now(), metin: 'Bugün 40 paragraf sorusu çözdüm.',
  fotograflar: [], tercih: 'ovgu', yzYanit: 'Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte övgün: iyi iş.', onemli: false, ...over });

try {
  await env.clearFirestore();
  await seedLinks();
  const seed = (id, data = rapor()) => env.withSecurityRulesDisabled(ctx => setDoc(ref(ctx.firestore(), id), data));

  // ---------------------------------------------------------------- student create
  await check('student creates reports 1, 2 and 3 for the owner their slot is linked to', async () => {
    await assertSucceeds(setDoc(ref(stu, rid(STU, 1)), rapor()));
    await assertSucceeds(setDoc(ref(stu, rid(STU, 2)), rapor({ tercih: 'elestiri', onemli: true })));
    await assertSucceeds(setDoc(ref(stu, rid(STU, 3)), rapor({ metin: '' , fotograflar: [jpeg(1000)] })));
  });
  await check('yesterday (Istanbul) is accepted, so a report written around midnight is not lost', async () => {
    await assertSucceeds(setDoc(ref(stu, rid(STU, 1, -1)), rapor()));
  });
  await check('a fourth report of the day is denied', async () => {
    await assertFails(setDoc(ref(stu, rid(STU, 4)), rapor()));
    await assertFails(setDoc(ref(stu, rid(STU, 0)), rapor()));
  });
  await check('writing an id that already exists is an update and is denied', async () => {
    await assertFails(setDoc(ref(stu, rid(STU, 1)), rapor({ metin: 'değiştirildi' })));
  });
  await check('an id with another uid prefix, a far-away day or a bad shape is denied', async () => {
    await assertFails(setDoc(ref(stu2, rid(STU, 1, 0)), rapor({ ogrenciUid: STU2, ogrenciBulutId: 'bulut-2' })));
    await assertFails(setDoc(ref(stu, rid(STU2, 1)), rapor()));
    await assertFails(setDoc(ref(stu, STU + '-20200101-1'), rapor()));
    await assertFails(setDoc(ref(stu, rid(STU, 1, 5).replace(/-1$/, '-2')), rapor()));
    await assertFails(setDoc(ref(stu, rid(STU, 1, -2)), rapor()));
    await assertFails(setDoc(ref(stu, rid(STU, 1) + 'x'), rapor()));
    await assertFails(setDoc(ref(stu, 'x' + rid(STU, 1)), rapor()));
  });
  await check('the first slot of tomorrow is a different id and is denied (no future days)', async () => {
    await assertFails(setDoc(ref(stu, rid(STU, 1, 1)), rapor()));
  });
  await check('ogrenciUid must be the caller, ogrenciBulutId the slot\'s identity', async () => {
    await env.clearFirestore();
    await seedLinks();
    await assertFails(setDoc(ref(stu, rid(STU, 1)), rapor({ ogrenciUid: STU2 })));
    await assertFails(setDoc(ref(stu, rid(STU, 1)), rapor({ ogrenciBulutId: 'bulut-2' })));
    await assertFails(setDoc(ref(stu, rid(STU, 1)), rapor({ ogrenciBulutId: '' })));
    await assertSucceeds(setDoc(ref(stu, rid(STU, 1)), rapor()));
  });
  async function fresh() { await env.clearFirestore(); await seedLinks(); }
  async function seedLinks() {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'ogretmenler', OWNER), {});
      await setDoc(doc(db, 'ogretmenler', OTHER_OWNER), {});
      await setDoc(doc(db, 'izleyiciler', 'co'), { sahipUid: OWNER, yetki: 'ortak' });
      await setDoc(doc(db, 'izleyiciler', 'viewer'), { sahipUid: OWNER });
      const yuva = (bagli, bulut, ogretmen = OWNER) => ({ ogretmenUid: ogretmen, ogrenciNo: 3, ogrenciAd: 'Sentetik Ada', ogrenciSube: '12-A',
        ogrenciBulutId: bulut, bagliUid: bagli, paket: null, sunucuTs: null, durum: 'aktif' });
      await setDoc(doc(db, 'ogrenciler', 'sync-1'), yuva(STU, 'bulut-1'));
      await setDoc(doc(db, 'ogrenciHesaplari', STU), { veri: '{}', syncId: 'sync-1', aktif: true, ts: 1, surum: 1 });
      await setDoc(doc(db, 'ogrenciler', 'sync-2'), yuva(STU2, 'bulut-2', OTHER_OWNER));
      await setDoc(doc(db, 'ogrenciHesaplari', STU2), { veri: '{}', syncId: 'sync-2', aktif: true, ts: 1, surum: 1 });
    });
  }
  await check('size caps: text 4000, photo 300000, three photos, reply 2500; one more is denied', async () => {
    await fresh();
    await assertSucceeds(setDoc(ref(stu, rid(STU, 1)), rapor({ metin: 'a'.repeat(4000), yzYanit: 'b'.repeat(2500) })));
    await assertFails(setDoc(ref(stu, rid(STU, 2)), rapor({ metin: 'a'.repeat(4001) })));
    await assertFails(setDoc(ref(stu, rid(STU, 2)), rapor({ yzYanit: 'b'.repeat(2501) })));
    await assertFails(setDoc(ref(stu, rid(STU, 2)), rapor({ fotograflar: [jpeg(300004)] })));
    await assertFails(setDoc(ref(stu, rid(STU, 2)), rapor({ fotograflar: [jpeg(1000), jpeg(1000), jpeg(1000), jpeg(1000)] })));
    await assertSucceeds(setDoc(ref(stu, rid(STU, 2)), rapor({ fotograflar: [jpeg(280000), jpeg(280000), jpeg(280000)] })));
  });
  await check('the whole document must stay under 900000 characters', async () => {
    await fresh();
    await assertFails(setDoc(ref(stu, rid(STU, 3)), rapor({ metin: 'a'.repeat(4000), yzYanit: 'b'.repeat(2500),
      fotograflar: [jpeg(300000), jpeg(300000), jpeg(300000)] })));
  });
  await check('a photo must be a JPEG data URL', async () => {
    await fresh();
    await assertFails(setDoc(ref(stu, rid(STU, 3)), rapor({ fotograflar: ['data:image/png;base64,QUJD'] })));
    await assertFails(setDoc(ref(stu, rid(STU, 3)), rapor({ fotograflar: ['https://example.test/a.jpg'] })));
    await assertFails(setDoc(ref(stu, rid(STU, 3)), rapor({ fotograflar: [5] })));
    await assertFails(setDoc(ref(stu, rid(STU, 3)), rapor({ fotograflar: 'data:image/jpeg;base64,QUJD' })));
  });
  await check('extra, missing or mistyped fields are denied; text or photo must exist', async () => {
    await env.clearFirestore(); await seedLinks();
    await assertFails(setDoc(ref(stu, rid(STU, 1)), rapor({ ekstra: true })));
    const eksik = rapor(); delete eksik.yzYanit;
    await assertFails(setDoc(ref(stu, rid(STU, 1)), eksik));
    await assertFails(setDoc(ref(stu, rid(STU, 1)), rapor({ tercih: 'ovgu2' })));
    await assertFails(setDoc(ref(stu, rid(STU, 1)), rapor({ onemli: 'evet' })));
    await assertFails(setDoc(ref(stu, rid(STU, 1)), rapor({ ts: 'şimdi' })));
    await assertFails(setDoc(ref(stu, rid(STU, 1)), rapor({ ts: serverTimestamp() })));
    await assertFails(setDoc(ref(stu, rid(STU, 1)), rapor({ metin: '', fotograflar: [] })));
    await assertSucceeds(setDoc(ref(stu, rid(STU, 1)), rapor({ metin: '', fotograflar: [jpeg(500)] })));
  });
  await check('only a student linked to that owner can write: not another owner\'s student, an unlinked account, anonymous or signed-out', async () => {
    await fresh();
    await assertFails(setDoc(ref(stu2, rid(STU2, 1)), rapor({ ogrenciUid: STU2, ogrenciBulutId: 'bulut-2' })));   // linked to OTHER_OWNER, path is OWNER
    await assertSucceeds(setDoc(ref(stu2, rid(STU2, 1), OTHER_OWNER), rapor({ ogrenciUid: STU2, ogrenciBulutId: 'bulut-2' })));
    await assertFails(setDoc(ref(stu, rid(STU, 2), OTHER_OWNER), rapor()));
    await assertFails(setDoc(ref(unlinked, rid(UNLINKED, 1)), rapor({ ogrenciUid: UNLINKED })));
    await assertFails(setDoc(ref(anonStu, rid(STU, 2)), rapor()));
    await assertFails(setDoc(ref(noAuth, rid(STU, 2)), rapor()));
    await assertFails(setDoc(ref(owner, rid(STU, 2)), rapor()));
    await assertFails(setDoc(ref(co, rid(STU, 2)), rapor()));
  });
  await check('a deactivated or re-linked slot stops the student', async () => {
    await fresh();
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'ogrenciler', 'sync-1'), { ogretmenUid: OWNER, bagliUid: STU, durum: 'iptal', ogrenciBulutId: 'bulut-1' }));
    await assertFails(setDoc(ref(stu, rid(STU, 2)), rapor()));
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'ogrenciler', 'sync-1'), { ogretmenUid: OWNER, bagliUid: 'someone-else', durum: 'aktif', ogrenciBulutId: 'bulut-1' }));
    await assertFails(setDoc(ref(stu, rid(STU, 2)), rapor()));
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'ogrenciler', 'sync-1'), { ogretmenUid: OWNER, bagliUid: STU, durum: 'aktif', ogrenciBulutId: 'bulut-1' }));
    await assertSucceeds(setDoc(ref(stu, rid(STU, 2)), rapor()));
  });

  // ---------------------------------------------------------------- student cannot read back
  await check('the student cannot get, list, update or delete (not even their own report)', async () => {
    await fresh();
    await seed(rid(STU, 1)); await seed(rid(STU, 2));
    const id = rid(STU, 1);
    await assertFails(getDoc(ref(stu, id)));
    await assertFails(getDocs(collection(stu, 'ogretmenYedek', OWNER, 'gunlukRapor')));
    await assertFails(updateDoc(ref(stu, id), { metin: 'x' }));
    await assertFails(deleteDoc(ref(stu, id)));
    await assertFails(getDoc(ref(noAuth, id)));
    await assertFails(getDocs(collection(stranger, 'ogretmenYedek', OWNER, 'gunlukRapor')));
    await assertFails(getDoc(ref(stranger, id)));
  });

  // ---------------------------------------------------------------- teachers
  await check('owner and co-teacher get and list; a viewer gets and lists', async () => {
    const col = db => getDocs(collection(db, 'ogretmenYedek', OWNER, 'gunlukRapor'));
    for (const db of [owner, co, viewer]) {
      assert((await assertSucceeds(col(db))).size >= 2);
      assert((await assertSucceeds(getDoc(ref(db, rid(STU, 1))))).exists());
    }
  });
  await check('nobody updates, not the owner, the co-teacher or a viewer', async () => {
    for (const db of [owner, co, viewer, stu]) await assertFails(updateDoc(ref(db, rid(STU, 1)), { onemli: true }));
  });
  await check('a viewer cannot delete; the owner and the co-teacher can', async () => {
    await assertFails(deleteDoc(ref(viewer, rid(STU, 1))));
    await assertSucceeds(deleteDoc(ref(owner, rid(STU, 1))));
    await seed(rid(STU, 1));
    await assertSucceeds(deleteDoc(ref(co, rid(STU, 1))));
    assert.equal((await getDoc(ref(owner, rid(STU, 1)))).exists(), false);
  });
  await check('deleting follows the notebook lock: another editor\'s fresh lock blocks, the holder and a stale lock allow', async () => {
    await seed(rid(STU, 3, 0));
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'defterKilidi', OWNER), { uid: OWNER, ad: 'Sahip', ts: new Date() }));
    await assertFails(deleteDoc(ref(co, rid(STU, 3))));
    await assertSucceeds(deleteDoc(ref(owner, rid(STU, 3))));
    await seed(rid(STU, 3));
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'defterKilidi', OWNER), { uid: OWNER, ad: 'Sahip', ts: new Date(Date.now() - 600000) }));
    await assertSucceeds(deleteDoc(ref(co, rid(STU, 3))));
  });
  await check('an unrelated teacher or stranger cannot list or delete another owner\'s reports', async () => {
    await seed(rid(STU, 2));
    await assertFails(getDocs(collection(env.authenticatedContext(OTHER_OWNER, google).firestore(), 'ogretmenYedek', OWNER, 'gunlukRapor')));
    await assertFails(deleteDoc(ref(env.authenticatedContext(OTHER_OWNER, google).firestore(), rid(STU, 2))));
  });
  console.log('GÜNLÜK RAPOR RULES:', checks, 'checks passed');
} finally { await env.cleanup(); }
