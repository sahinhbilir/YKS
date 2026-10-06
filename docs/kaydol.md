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

## Security rules

`testDefter/{uid}` accepts its owner when signed in either with Google or with
`password` and an email that fully matches `uye-[0-9a-f]{40}@uye[.]ykstekrar[.]app`.
School name+number sessions, look-alike emails, anonymous sessions and other users
stay refused.

## Deployment

1. Publish the updated `firestore.rules`: Firebase console → Firestore Database →
   Rules → paste → Publish. Until then, sign-up creates the account and the notebook
   works on the device, but cloud saves report a missing permission. The next save
   after publishing uploads it.
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
