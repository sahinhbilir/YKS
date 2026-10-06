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
  eşleşmedi." The login button then splits in two: "Giriş yap" on the left and
  **Parolamı unuttum** on the right (see below).

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
- **Redirect.** `girisYonu/{SHA-256("uye|" + user name)} = {email, uid, ts}` points the
  user name at its account. Sign-up writes it. An account opened before redirects
  existed writes it at its next login, once the notebook confirms the name
  (`uyeYonunuYaz`). The teacher needs it to reset a password.
- **No reset.** A Kaydol account is a real student account, not a test, so it has no
  "Test hesabımı sıfırla" (`testSifirlamaIzinli()` refuses `tur: 'uye'`).

## Kullanıcı adını değiştir

Kaydol accounts only. A school student's name comes from the teacher's list. Ayarlar
has a folded **Kullanıcı adını değiştir** card right under the heading. It asks for the
new user name (cleaned like at sign-up) and the current password.

`window.bulut.kullaniciAdiDegistir(eski, yeni, sifre)`:

1. Re-authenticates with the password.
2. Refuses a name whose redirect points at another account: "Bu kullanıcı adı
   alınmış".
3. Reserves the new name. It opens an account with the new name's derived email and a
   random password, on the secondary Auth instance, so nobody can sign up with that name.
   The step is skipped when the new name is the account's own original name.
4. Writes the new name's redirect to this account, then deletes the old name's
   redirect.

The app then stores the new name in the notebook (`testHesap.ad`, and the nickname if
it was the old name) and moves the recovery e-mail to the new name.

The account's email is unchanged, so the old name + password still reaches it. The
login refuses it: the notebook holds the new name, so the device signs out and shows
"eşleşmedi". The old name stays taken.

## Şifre değiştir

Ayarlar has a folded **Şifre değiştir** card under the user-name card. It asks for the
current password, the new one (at least 6 characters, different from the current
one), each with the eye button, and an e-mail address. The e-mail is required. It is
where a new password goes if the student forgets this one, and the field is prefilled
with the last one used.

- **Kaydol account:** the current password is the Kaydol password.
- **School student with a cloud account** (`hesapUid`): the first current password is
  the school number. The card is hidden for Google test accounts and for students
  without a cloud account.

`window.bulut.sifreDegistir(mevcut, yeni, okul, eposta, kullaniciAdi)` runs these
steps:

1. Re-authenticates. For a school student, a value equal to their school number is
   turned into the account's derived password (of its current generation, see below).
2. Writes the recovery e-mail:
   `kurtarma/{key}/hesaplar/{uid} = {eposta, tur, ts}`. The key is the name lookup hash
   for a school student and the redirect key for a Kaydol account. Only teachers can
   read it.
3. For a school student only, writes a lookup entry:
   `sifreliGiris/{SHA-256("giris|" + normalised name)}/hesaplar/{uid} = {email, ts}`.
4. Calls `updatePassword`.

Both entries are written **before** the password changes. If one cannot be written
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

## Parolamı unuttum

After a failed login, **Parolamı unuttum** opens a popup:

- "Okul numaranla giriş yaptıysan şifren okul numarana sıfırlanır."
- "Kaydol ile hesap açtıysan şifren rastgele rakamlara sıfırlanır ve e-postana
  gönderilir."
- Two choices: "Okul numaramla giriyordum" (preselected when the typed name has a space)
  and "Kaydol ile hesap açtım".
- The name, prefilled from the login form, and the e-mail address.
- **E-posta gönder** files the request:
  `sifreTalepleri/{random id} = {tur: 'okul' | 'uye', ad, eposta, ts}`. Then it shows
  "Talebin rehber öğretmene iletildi."

Esc, × or a click outside closes it. Nothing is reset automatically: the teacher does it
by hand.

## Teacher: E-posta talepleri bekliyor

When the teacher's app opens and requests are waiting, a popup **E-posta talepleri
bekliyor (N)** lists them. It is also reopened by **E-posta talepleri (N)** on Haftalık
öğrenci takibi. Each request shows the name, the account kind, the e-mail and the time,
and a check against the recovery e-mail the student stored:

- "✓ Kayıtlı e-postayla aynı";
- "⚠ Kayıtlı e-posta farklı";
- "Kayıtlı e-posta yok" (the student never changed their password).

Resetting without a match asks for confirmation first. The actions:

- **Kaydol: "Yeni şifre oluştur".** `uyeSifreSifirla(ad, eskiUid, kokUid)`:
  1. creates a new account with an 8-digit random password and a fresh email;
  2. writes `devir/{old uid} = {yeniUid, ts}`, which lets the new account read the old
     notebook;
  3. points the name's redirect at the new account (`{email, uid, eskiUid, kokUid?}`).

  On its first login, the new account copies the old notebook into its own and saves
  it ("şifren sıfırlandı, defterin yeni hesabına taşındı"). `kokUid` keeps the first
  account, so two resets in a row without a login in between still find the notebook.
- **School student: "Okul numarasına sıfırla".** The student is matched by name in the
  teacher's list (a choice appears when several match). The reset then:
  1. raises the student's account generation (`hesapNesli`);
  2. writes the name + number redirect `girisYonu/{SHA-256("okul|" + name + "|" +
     number)} = {nesil, ts}`;
  3. publishes the plan to the new generation's account, derived from name + number +
     generation;
  4. deletes the old account's name + password lookup.

  Name + school number then logs in again. If the publish fails, the generation goes
  back and nothing else changes.

After a reset, the card shows the new password (Kaydol) or "Okul numarasına
sıfırlandı." **E-posta yaz** opens the teacher's mail app with the address, subject
and text filled in. **Tamamlandı** deletes the request. **Sil** deletes a request
without acting on it.

Limits:

- the teacher sees the new Kaydol password and sends the e-mail themselves;
- the old Kaydol password still opens the old account, and a device still signed in to
  it keeps writing there;
- a Kaydol account needs its redirect or a stored recovery e-mail before the teacher can
  find it.

Logins try the redirect first and then the account derived from the name, so a
redirect never locks anyone out.

## Security rules

`testDefter/{uid}` accepts its owner when signed in either with Google or with
`password` and an email that fully matches `uye-[0-9a-f]{40}@uye[.]ykstekrar[.]app`.
School name+number sessions, look-alike emails, anonymous sessions and other users
stay refused. A new account named in `devir/{uid}` may also read that notebook.

The recovery blocks:

- **`girisYonu/{64-hex key}`.** Anyone can get a redirect by its key; nobody can list
  them.
  - A Kaydol account creates or updates only its own redirect, `{email, uid, ts}`, with
    its own email and uid.
  - A teacher writes reset redirects: a Kaydol `email` plus `uid`, `eskiUid` and
    `kokUid`, or a school `nesil` from 1 to 999.
  - The owner or a teacher deletes it.
- **`devir/{old uid}`.** Readable by the new account it names and by teachers. Only
  teachers write or delete it (`{yeniUid, ts}`).
- **`kurtarma/{key}/hesaplar/{uid}`.** Only the account itself writes it, with the
  shape `{eposta, tur, ts}` (an e-mail of at most 120 characters, `tur` `uye` or
  `okul`). Only teachers read it. The owner or a teacher deletes it.
- **`sifreTalepleri/{id}`.** Anyone can create one, in the shape `{tur, ad, eposta, ts}`
  (name 1–80 characters). Only teachers read, list or delete. Nobody updates.
- **`sifreliGiris`.** A teacher may now delete an entry too, so a school reset can
  remove the old password.

## Deployment

1. Publish the updated `firestore.rules`. Besides the `testDefter` owner rule it has a
   `sifreliGiris` block for the password lookup:
   - anyone who knows a name hash can list that name's entries;
   - only the school account itself (`ogr-…@student.ykstekrar.app`, `password` provider)
     writes its own entry, in the shape `{email, ts}` with its own email;
   - only the owner or a teacher deletes it.

   It also has the `girisYonu`, `devir`, `kurtarma` and `sifreTalepleri` blocks above,
   and the `devralan()` read on `testDefter`.

   To publish: Firebase console → Firestore Database → Rules → paste → Publish.

   Until then:
   - sign-up creates the account and the notebook works on the device, but cloud saves
     report a missing permission. The next save after publishing uploads it;
   - a password change stops with "buluta erişim izni yok", and the password is not
     changed;
   - "E-posta gönder" and the teacher popup report the missing permission. Logins work
     as before.
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
  - re-login from Ayarlar;
  - the user-name change, and that the old name is refused and does not bring its
    redirect back;
  - the split button, the popup and the request;
  - the teacher popup, both resets, the e-mail check and the mail link;
  - a reset Kaydol account taking over its notebook.
- `node test/test-account-browser.cjs` checks, at desktop and 390 px:
  - the login placeholders;
  - the password field and its eye button;
  - the three buttons;
  - the sign-up card, then a sign-up landing on the home page and the cloud save;
  - the split login button, the Parolamı unuttum popup, the Ayarlar cards and the
    teacher's "E-posta talepleri bekliyor" popup.
- `test/firebase/firestore.test.mjs` checks that a Kaydol account owns its notebook,
  and that school accounts, look-alike emails and other providers are refused.
  It also checks the `sifreliGiris` lookup: who can write it, the field shape, public
  reads only under a name hash, and owner or teacher delete. The recovery blocks
  (redirects, hand-over, recovery e-mails, requests) are checked the same way.
- `node --experimental-vm-modules test/password-module-regression.cjs` runs the real
  Firebase module with an in-memory Auth and Firestore. It checks:
  - the school number as the first current password;
  - the order reauthenticate → lookup → password;
  - that name + number stops working and name + password works (spacing and case
    ignored);
  - that a refused lookup or a wrong current password changes nothing;
  - a Kaydol password change, its recovery e-mail and its redirect;
  - the user-name change;
  - both teacher resets, including two Kaydol resets in a row;
  - requests;
  - that only school emails from the lookup are tried.
- `test-account-regression` checks the card (under the heading, folded, Kaydol and
  school students only), its validation and messages, and name + password login.
  `cloud-sync-resilience` checks that publishing keeps the account of a student who
  changed their password, and that a school reset moves the student to a new account
  generation.
