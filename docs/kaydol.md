# Kaydol: user name and password accounts

On the start screen, **Kaydol** sits between "Rehber öğretmeniyim" and "Test hesabı
aç". It gives a student without a teacher their own YKS notebook in one step.

## Sign-up

The sign-up card asks for three things:

- **Kullanıcı adı.** Spaces are removed and letters are lower-cased with Turkish
  rules, so "Ali Veli 07" becomes `aliveli07`. While typing, the card shows "Kullanıcı
  adın: aliveli07" whenever the typed form differs. The name is 3–30 characters, with
  only letters, digits, `.`, `_` and `-`.
- **Şifre.** At least 6 characters. The eye button shows or hides it.
- **Alanın.** SAY, EA, SÖZ or DİL. YKS needs it to choose the AYT topics, so there is
  no default.

"Kaydol ve başla" then does what "Test hesabı aç" → YKS → "Okula gitmiyorum" →
"Kendi YKS planımı başlat" does by hand:

1. Creates the Firebase account. A taken name gets "Bu kullanıcı adı alınmış".
2. Builds the notebook (`uyeDefteriniKur`):
   - exam YKS, `okul: false`, nickname = user name;
   - weeks from this Monday (`donemBasi`), first active day today (`ilkAktif`);
   - the YKS exam date from the settings;
   - the own YKS plan with every course at "Bilmiyorum" (each topic starts with a
     konu anlatımı) and the default target date.
3. Opens the home page. The first topics are in this week's plan.

The student can change the course levels later in Ayarlar.

## Login

The same login form serves both accounts. The first input reads "Kullanıcı adı - Ad
soyad" and the second "Şifre - Okul numarası".

- If the second value is a school number (1–9999), the school login (name + number) is
  tried first. Only a wrong-credentials error falls through to Kaydol. Any other error
  is shown as it is.
- Otherwise, or after that fall-through, the values are tried as a Kaydol user name and
  password.
- If neither matches: "Kullanıcı adı ve şifre ya da ad soyad ve okul numarası
  eşleşmedi."

A Kaydol account whose cloud notebook does not exist yet (the sign-up stopped before
the first save) opens the setup screen with the user name as the nickname.

## Account and storage

- **Firebase Auth.** An email/password account with the email
  `uye-<first 40 hex of SHA-256("uye|" + user name)>@uye.ykstekrar.app`. The user name
  itself is not stored in Firebase Auth. School students' accounts use
  `@student.ykstekrar.app`, a different domain.
- **Notebook.** The same `testDefter/{uid}` notebook, history slots, multi-device
  checks and "Kaydet ve çıkış yap" as test accounts (docs/test-accounts.md), with
  `testHesap: {uid, acilis, tur: 'uye', ad}`.
- **Ayarlar.** Shows **Hesabın** with the user name. If the device is signed out, a
  password field and "Yeniden gir" sign the student back in.
- **No reset.** A Kaydol account is a real student account, not a test, so it has no
  "Test hesabımı sıfırla" (`testSifirlamaIzinli()` refuses `tur: 'uye'`).

## Şifre değiştir

Ayarlar has a folded **Şifre değiştir** card right under the heading. It asks for the
current password and the new one (at least 6 characters, different from the current
one), each with the eye button.

- **Kaydol account:** the current password is the Kaydol password.
- **School student with a cloud account** (`hesapUid`): the first current password is
  the school number. The card is hidden for Google test accounts and for students
  without a cloud account.

`window.bulut.sifreDegistir(mevcut, yeni, okul)` runs these steps:

1. Re-authenticates. For a school student, a value equal to their school number is
   turned into the account's derived password.
2. For a school student only, writes a lookup entry:
   `sifreliGiris/{SHA-256("giris|" + normalised name)}/hesaplar/{uid} = {email, ts}`.
3. Calls `updatePassword`.

The lookup entry is written **before** the password changes. If it cannot be written
(for example, rules not yet published), the password stays as it was. That way a
student is never locked out.

**After the change**, the school student's account no longer accepts name + school
number. The login form takes "Ad soyad" + the new password:

- if the Kaydol attempt does not match, `okulSifreGirisi` reads the lookup for that
  name and tries the password on each school account email listed there;
- `ogrenciHesabindanYukle(ad, null, user)` then loads the plan as usual;
- a refused lookup read counts as "eşleşmedi", not as a raw error.

The name itself is never stored; the lookup holds only a name hash and the account's
hashed email. If the session on a device ends, the sync asks the student to log in again
with their name and password.

Teacher publishing signs in to each student account with name + number. For a student
who changed their password, that sign-in fails with wrong credentials, so publishing
keeps the known `hesapUid`: the email, and so the account, is unchanged. A student
without a known account is not published blindly.

There is no password reset. A school student who forgets their password gets a new
account when the teacher changes their name or number and publishes again; the results
slot follows the new account.

## Security rules

`testDefter/{uid}` accepts its owner when signed in either with Google or with
`password` and an email that fully matches `uye-[0-9a-f]{40}@uye[.]ykstekrar[.]app`.
School name+number sessions, look-alike emails, anonymous sessions and other users
stay refused.

## Deployment

1. Publish the updated `firestore.rules`. Besides the `testDefter` owner rule it has a
   `sifreliGiris` block for the password lookup:
   - anyone who knows a name hash can list that name's entries;
   - only the school account itself (`ogr-…@student.ykstekrar.app`, `password` provider)
     writes its own entry, in the shape `{email, ts}` with its own email;
   - only the owner deletes it.

   To publish: Firebase console → Firestore Database → Rules → paste → Publish.

   Until then:
   - sign-up creates the account and the notebook works on the device, but cloud saves
     report a missing permission. The next save after publishing uploads it;
   - a school student's password change stops with "buluta erişim izni yok", and the
     password is not changed.
2. Email/password sign-in is already enabled, because school student accounts use it.
3. Serve the updated `index.html`.

## Tests

- `node test/test-account-regression.js` checks:
  - the form and validation, with nothing sent to Firebase on an error;
  - spaces removed from the user name;
  - the YKS plan this week without school;
  - the cloud save, and no reset;
  - a taken name;
  - login by user name and password;
  - the school-number-first order;
  - a half-finished sign-up;
  - re-login from Ayarlar.
- `node test/test-account-browser.cjs` checks, at desktop and 390 px:
  - the login placeholders;
  - the password field and its eye button;
  - the three buttons;
  - the sign-up card, then a sign-up landing on the home page and the cloud save.
- `test/firebase/firestore.test.mjs` checks that a Kaydol account owns its notebook,
  and that school accounts, look-alike emails and other providers are refused.
  It also checks the `sifreliGiris` lookup: who can write it, the field shape, public
  reads only under a name hash, and owner-only delete.
- `node --experimental-vm-modules test/password-module-regression.cjs` runs the real
  Firebase module with an in-memory Auth and Firestore. It checks:
  - the school number as the first current password;
  - the order reauthenticate → lookup → password;
  - that name + number stops working and name + password works (spacing and case
    ignored);
  - that a refused lookup or a wrong current password changes nothing;
  - a Kaydol password change;
  - that only school emails from the lookup are tried.
- `test-account-regression` checks the card (under the heading, folded, Kaydol and
  school students only), its validation and messages, and name + password login.
  `cloud-sync-resilience` checks that publishing keeps the account of a student who
  changed their password.
