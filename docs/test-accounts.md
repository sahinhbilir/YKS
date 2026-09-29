# Test accounts ("Test hesabı aç")

Private-alpha testers can use the app without a teacher. The start screen has a
**Test hesabı aç** button in the bottom-right corner. It opens a Google sign-in
window. The same button signs a returning tester in on another device.

## Flow

1. Google sign-in (the same provider teachers already use; no allowlist).
2. If `testDefter/{uid}` exists, that notebook opens on this device.
3. Otherwise the existing solo student setup opens. It asks for a **nickname**
   (not a real name), grade, field and, for grades 9–11, the curriculum start. The
   school timetable is entered afterwards in Ayarlar, as in the existing solo flow.
   "Öğretmenimden gelen dosyayı yükle" is hidden: loading a teacher package would
   detach the notebook from the test account.
4. Every local save schedules the existing debounced cloud backup. For a test
   account it writes `testDefter/{uid}` and one history slot.
5. **Kaydet ve çıkış yap** uploads, reads the server copy back, and clears the
   device only when the two match. This is the same rule as teacher logout.

The notebook is an ordinary student notebook (`rol: 'ogrenci'`) with
`testHesap: {uid, acilis}`. It has no `syncId`, so the teacher result sync never
runs for it. Teachers and teacher-created students are unaffected.

## Storage

| Document | Content |
|---|---|
| `testDefter/{uid}` | `{veri, ts, surum, boyut}`: the whole notebook as a JSON string |
| `testDefter/{uid}/gecmis/0…6` | the last save of each weekday, overwritten a week later |
| `testDefter/{uid}/gecmis/cakisma` | the cloud copy replaced by "Bu cihazdakini buluta yaz" |

History is bounded: at most eight notebook copies per tester. Unlike teacher
backups, no per-date documents accumulate.

## Several devices

Each device remembers the signature of the cloud version it last saw (the same
`yks_bulut_temelleri` mechanism as teacher backups). An upload never overwrites a
cloud notebook this device has not seen.

On opening, on a Google session change, and on returning to the tab, the device
checks the cloud copy:

- **Nothing new in the cloud:** nothing happens.
- **Newer cloud copy, and this device had no unsent changes:** the cloud copy
  opens automatically. Until the student first clicks or types on the page, the
  notebook as it was when the page opened also counts as "no unsent changes". That
  way the automatic plan preparation at start-up does not block the switch, but
  anything the student saves does. A half-filled form postpones the switch.
- **Both changed:** nothing is overwritten. Ayarlar → **Test hesabın** offers
  "Buluttakini aç" or "Bu cihazdakini buluta yaz". The second option keeps the
  replaced cloud copy in `gecmis/cakisma`.

## Security rules

`firestore.rules` allows `testDefter/{uid}` and its `gecmis` slots only to the
signed-in owner with the `google.com` provider. Anonymous and name+number
(`password`) sessions are refused, and so are other users, including allowlisted
teachers. Deletes and collection listing are closed. Documents must match the
field list and the 900 000-character limit. History slot IDs are limited to
`0`–`6` and `cakisma`.

## Deployment

1. Publish the updated `firestore.rules`: Firebase console → Firestore Database →
   Rules → paste → Publish. Until then the button signs testers in, but cloud saves
   report a missing permission.
2. Serve the updated `index.html`.

Google sign-in and the `ykstekrar.com` authorized domain are already configured
for teacher login.

## Tests

- `node test/test-account-regression.js`: 16 checks, including setup, bounded
  history, second device, automatic pull (with and without a start-up re-save and
  a user click), conflicts in both directions, wrong account, rules denial, logout
  success/failure and unchanged school paths.
- `node test/test-account-browser.cjs`: desktop and 390 px Chromium checks of the
  button position, nickname setup, first cloud save and the settings card.
- `test/firebase/firestore.test.mjs`: 8 emulator checks for `testDefter` rules.

Legal and privacy work (KVKK, parental consent for under-18 users) is deliberately
out of scope for the private alpha and must be completed before a public launch.
