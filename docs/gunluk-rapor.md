# Günlük rapor

A student writes what they did today and/or adds photos, chooses **Övgü istiyorum** or **Eleştiri istiyorum**, and gets a Gemini reply at once. The report and the reply are stored as one document under the teacher. The teacher reads them under **Öğrenciler → Günlük raporlar**; **Gördüm** deletes the document, so nothing piles up in the cloud. No e-mail is sent.

Code: `src/gunlukrapor.js` and `src/gunlukrapor.css` (embedded by `scripts/embed-gunlukrapor.cjs`), rules in `firestore.rules`.

## Yayınlama adımları (kuralları açma)

Özellik, `firestore.rules` dosyası yayınlanana kadar çalışmaz: öğrenci “Günlük rapor henüz açık değil.” görür, öğretmen sayfada tek satırlık bir not görür.

1. Firebase konsolunu açın: <https://console.firebase.google.com> → proje `yks-tekrar-manual-test`.
2. Soldan **Firestore Database** → üstteki **Rules** (Kurallar) sekmesi.
3. Depodaki güncel `firestore.rules` dosyasının **tamamını** kopyalayıp editördeki metnin yerine yapıştırın.
4. **Publish** (Yayınla) düğmesine basın. Birkaç saniye içinde etkinleşir.
5. Kontrol: öğrenci hesabıyla **Günlük rapor** → bir şey yazıp **Gönder**; öğretmen hesabında **Öğrenciler → Günlük raporlar** sayısı görünür.

Komut satırından (isteğe bağlı): `firebase deploy --only firestore:rules --project yks-tekrar-manual-test`.

Yapay zekâ yanıtı için ayrıca bir şey gerekmez: sitenin Dosya okuma özelliği (`window.bulut.yapayZeka`, Firebase AI Logic, bkz. `docs/yapay-zeka.md`) aynı kurulumu kullanır.

## Data

`ogretmenYedek/{owner}/gunlukRapor/{raporId}`

* `owner` is the teacher notebook owner uid. A student finds it the way the results sync does: `ogrenciler/{syncId}.ogretmenUid`, read from the student's own sync slot (checked: `bagliUid` is the student, `durum == 'aktif'`, `ogrenciBulutId` equals the notebook's). For a co-teacher or viewer it is `defterUid()` (the owner's uid).
* `raporId` = `<studentAuthUid>-<YYYYAAGG Istanbul>-<1..3>`, so a student has at most three reports a day. The day comes from `bulutGercekGun()`, the app's Istanbul-day helper.

| Field | Content |
|---|---|
| `ogrenciUid` | the student's auth uid |
| `ogrenciBulutId` | `D.ogr[i].ogrenciBulutId`, what the teacher notebook uses to find the student |
| `ts` | integer, milliseconds |
| `metin` | text, ≤ 4000 characters |
| `fotograflar` | up to 3 JPEG data URLs, each ≤ 300000 characters |
| `tercih` | `ovgu` or `elestiri` |
| `yzYanit` | the AI reply, ≤ 2500 characters |
| `onemli` | `true` when the report suggests a crisis |

At least one of `metin` or `fotograflar` is non-empty; the whole document stays under 900000 characters.

## Rules

* **Student** — `create` only, for the owner their slot is linked to. The rules follow `ogrenciHesaplari/{uid}.syncId` → `ogrenciler/{syncId}` and require a password account `ogr-…@student.ykstekrar.app`, `aktif`, `bagliUid == uid`, `durum == 'aktif'`, `ogretmenUid == {owner}` and a matching `ogrenciBulutId`. The id must be `<uid>-<today or yesterday in Istanbul>-<1..3>`; the two-day window keeps a report written around midnight from being lost, while stopping a student from opening unlimited documents under made-up dates. A student cannot get, list, update or delete.
* **Owner and co-teacher with edit rights** (`defterYetkilisi`) — `get`, `list`, and `delete` while `kilitUygun` holds (the notebook lock is not held fresh by someone else, same as every other notebook write).
* **Viewer** (`izleyici`) — `get` and `list`.
* **Nobody updates.** A second `create` of an existing id counts as an update and is refused; the app reads that as "this slot is used".

Anonymous (old file-package) students and test accounts have no linked teacher and cannot write, so the menu entry is hidden for them.

Emulator tests: `test/firebase/gunluk-rapor.test.mjs` (run in CI with the other rules tests).

## Student flow

1. Menu **Günlük rapor**: textarea “Bugün ne yaptın?”, **Fotoğraf çek** (camera on phones) and **Galeriden ekle**, thumbnails with remove, **Övgü istiyorum / Eleştiri istiyorum**, **Gönder**, and one line: “Raporun yapay zekâ ile değerlendirilir ve rehber öğretmenine iletilir.”
2. Photos are compressed in a canvas: longest side ≤ 1280 px, JPEG, quality 0.75 stepping down (0.65 … 0.25) until the data URL is ≤ 280000 characters (the rules allow 300000). If even 0.25 is too large, the picture is made 20% smaller and tried again. A file the browser cannot decode (HEIC in some browsers) shows “Bu fotoğraf açılamadı; JPEG/PNG deneyin.”
3. **Gönder** first asks the AI, then writes the document with `yzYanit`. The reply card shows “Bugün X/3 rapor gönderdin”.
4. If the AI fails (offline, quota, 60 s timeout, unreadable answer) the report is still sent with `yzYanit = "Yapay zekâ şu an yanıt veremedi; rehber öğretmenin değerlendirecek."` and the student is told it was sent. If the AI is down and the text contains a clear crisis phrase (a short fixed list), `onemli` is still set so the report is listed first.
5. If the write itself fails (offline), the same reply is reused on the next press of **Gönder**, so a retry does not spend another AI request.

Nothing goes into the notebook `D`, so student packets and local storage do not grow. The last reply card is kept in `sessionStorage` (this tab, today) and so are the slots this tab used.

### How the day count works

Students cannot read, so the count cannot be asked. The app uses two things:

* **What this tab sent.** `sessionStorage` keeps the slot numbers written today. They are skipped, and a fourth report is stopped before the AI call.
* **A probe by writing.** The remaining ids 1, 2, 3 are tried in order. The rules refuse a second create of an existing id (it would be an update), so a permission-denied on an id is treated as "already used" and the next id is tried. The first id that succeeds is the report, and X in “Bugün X/3” is the number of used slots (denied ones plus this one).

If all remaining ids are denied the cause is either that the three are used (from another device or tab) or that the rules are not published. The student sees “Günlük rapor henüz açık değil. Bugün 3 rapor gönderdiysen yarın yine gönder.” (when this tab has already sent some, it says the three are used). Denied ids are not remembered, so once the rules are published sending works again.

Limitation: a write made offline can still reach the server later, after the 20 s wait ended. A retry then finds that id taken and uses the next one, so such a report can appear twice.

## What the AI receives

`window.bulut.yapayZeka({parcalar, sema, zamanAsimi: 60000})`: fixed Turkish instructions (kind, honest mentor, only what the report shows, "sen", 3–5 sentences, praise or constructive criticism, never insulting or about appearance, family or private life, required opening sentence, crisis rule), the student's text and photos. The choice only selects the instruction text. No name, number, class, grade or id is sent; `test/gunluk-rapor-regression.cjs` inspects the parts. The report text is marked as data, not instructions.

The answer is JSON `{yanit, onemli}` (response schema). `yanit` must begin with the required sentence, added or replaced when missing, and is cut to 2500 characters:

* övgü: “Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte övgün:”
* eleştiri: “Rehber öğretmenin bir sonraki okul gününde değerlendirmeden önce, işte eleştirin:”

If the report suggests self-harm, suicide, abuse, violence or a crisis, the model gives no praise or criticism, writes a short warm message that points to the rehber öğretmen or a trusted adult today, and sets `onemli: true`. That reply carries no prefix.

## Teacher flow

**Öğrenciler → Günlük raporlar**. The count of unread reports is fetched once when the menu first renders for an owner (one `getDocs`, no live listener) and shown as a badge on **Öğrenciler** and on the entry. The page uses the same fetched list; **Yenile** fetches again.

Each item shows the student (matched by `ogrenciBulutId` in `D.ogr`; “Tanınmayan öğrenci” if there is none), şube, date and time (Istanbul), text, photo thumbnails (click to enlarge, Esc closes), the choice, and the AI reply. `onemli` reports come first, then newest first.

* **Gördüm** deletes the document, then removes it from the list.
* **Tümünü gördüm** asks for confirmation, then deletes them one by one.
* A viewer sees the list without these buttons.
* Before the rules are published the page shows one line: “Günlük raporlar için firestore.rules dosyası yayınlanmalı: Firebase konsolu → Firestore Database → Rules → Publish.”

## Storage

Each report is at most about 900 KB (typically 100–600 KB with photos) and is deleted at **Gördüm**. Listing downloads the documents with their photos, so a long unread backlog costs reads and bandwidth; the teacher should clear it regularly.

## Tests

* `node scripts/embed-gunlukrapor.cjs --check && node test/gunluk-rapor-regression.cjs`
* `NODE_PATH=… node test/gunluk-rapor-browser.cjs` (1280 and 390; screenshots go to `$YKS_UI_ARTIFACTS`)
* `firebase emulators:exec --only firestore --project demo-yks-test "node test/firebase/gunluk-rapor.test.mjs"`
