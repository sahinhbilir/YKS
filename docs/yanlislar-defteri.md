# Yanlışlar defteri

Teacher page under **Denemeler → Yanlışlar defteri** (same roles as Konu Takibi: the guidance teacher; students
never see it). For each student of the **selected exams** it prints (or downloads as one PDF) only the questions the student got **wrong or left empty**,
cut out of the A booklets as pictures, so the student can solve them again. One exam is simply a library with one row.

## Deneme kütüphanesi (kept on this device only)

The teacher adds files with one **Dosya ekle** button (many files, all four kinds, many exams at once) or drops them on the page. Each file is recognised by its
content with the parsers below and grouped into its exam by the exam code: the booklet header (`2026-27-TYT/TÜR-1203` → 1203), the cevap raporu's exam name
(`…-1203`), the Ders ortalamaları title (`27-YKS-1203`). A çözüm label may be one text run ("A-1 / B-3") or pieces on one line ("A-1", "/", "B-3": pieces less than 14 pt apart are joined). A çözüm file has no code of its own: it goes to the exam and session whose question count it matches **and**
whose answer keys it fits (`keyA[a] = keyB[b]`); a number in its title ("1203 TYT ÇÖZÜMLERİ") only breaks a tie, and if several exams still fit it is refused as ambiguous.
Files are read one by one ("3 / 12 dosya okunuyor…"), then applied in dependency order (reports and booklets first, then çözüm and ortalamalar), so one drop of everything works.

- **Where.** A dedicated IndexedDB database (`yks-deneme-kutuphanesi`, `src/denemekutuphane.js`), keys prefixed with the signed-in teacher's uid, so another account on the same browser never sees it.
  Never the notebook `D`, Firestore, localStorage or any network request.
- **What is kept per exam.** The booklet and çözüm PDFs as bytes (the pictures are cut from them), the parsed cevap raporu model (it has no TC; the raw .xlsx is never kept), the booklet's cut geometry,
  the çözüm pairs, the parsed Performans analizi model and the parsed Ders ortalamaları model (`{kod, dersler:[{ad,n,genel}]}`, no school names). The library refuses to write a model that contains an 11 digit number and anything that is not a PDF.
  Tests assert that nothing stored has an 11 digit number or an .xlsx.
- **Reload.** On opening the page the library is read and the exams are ready; booklets are opened (pdf.js) only when pictures must be cut, exam by exam, and their canvases and documents are released afterwards.
- **Status line.** "Bu cihazda saklanır, sunucuya gönderilmez · 5 deneme · 84 MB" (size from `navigator.storage.estimate()`, else the sum of the stored bytes). `navigator.storage.persist()` is asked once, with the first save.
- **Removing.** **Sil** on a row (with its files), **Tümünü bu cihazdan sil** (everything of this account).
- **Logout.** `cikisYerelVerisiniTemizle()` (Kaydet ve çıkış yap, Tarayıcı verilerini sıfırla, a co-teacher losing access) deletes the **whole database, every account's library**, together with the notebook's
  local copy, and empties the page. Logout already removes all `yks_` data of every account on the browser, and student data must not outlive the session on a shared computer, so the library follows the same rule instead of
  being kept per account. The library is deleted before the notebook (which goes last); a delete blocked by another tab fails the cleanup like any other storage failure.
- **No IndexedDB** (private mode, blocked, no account id): everything stays in memory for the session, with one line: "Bu tarayıcı dosyaları saklamaya izin vermiyor; sayfa kapanınca yeniden yüklemeniz gerekir."
  Bulk upload and bulk export work as usual.
- **Quota exceeded** while saving: the exam stays in memory, its row says "Yalnız bu oturumda" and the page says "… cihaza sığmadı; bu oturumda bellekte tutuluyor. Yer açmak için eski denemeleri silin." Earlier exams stay stored (the write is one transaction).
- **Exam table.** One row per exam: checkbox (all selected by default), name, code, date (the report's "Rapor Tarihi"), a ✓ / ✗ per input (TYT kitapçık, AYT kitapçık, Cevap raporu, Çözüm, Ders ort., Performans analizi; "–" where the report has no such session)
  and the Turkish refusal text of a file in its own row (files that belong to no exam are listed above the table). Çözüm, Ders ort. and Performans analizi are optional (their ✗ is muted). Replacing a file re-validates it as before; a file that no longer fits is dropped with the reason.
- **Bulk print / PDF.** Students are matched across the selected exams by Öğrenci No (name and şube of the latest exam). One defter per student: header with name, no, şube, the exam list and the totals ("3 deneme · 31 yanlış · 9 boş"), then one section per exam
  (exam heading; TYT, then AYT, with ders headings), and the answer tables at the end grouped by exam, each with its own key. B booklets, Din / Ek Felsefe and the alan rules apply per exam. A student who sat only some exams gets those; a student with nothing to print is skipped
  (shown on screen as "Yanlış veya boş soru yok"). **Seçili denemeler için yazdır** keeps the print layout (A4 portrait, two columns, pictures at 82%, nothing split, a page per student). The screen preview holds about 3000 pictures; print and PDF always take every student.
  **PDF indir** builds the same defter in the browser with pdf-lib (`SIRALAMA.kutuphane()`, Roboto): pictures as JPEG (about 185 dpi at printed size, shared between students), student by student with progress, named like `Yanlislar_defteri_3_deneme_12A.pdf`.
  Above 400 pages the page offers one PDF per şube (those that fit) and says how to narrow the selection.
- Memory: pictures are cut exam by exam; page canvases beyond three are released at once and all canvases and pdf.js documents of an exam are released when its pictures are done.

## Files

Each exam has up to six inputs; the page tells which is which. None of the files or the generated notebooks go to the server: not the notebook (`D`), not Firestore, not localStorage, and nothing is sent anywhere.
They are kept only in this device's library (see above) and are wiped at logout.

1. **Soru kitapçığı (A)**, PDF. Each test is found by its page header code (`2026-27-TYT/TÜR-1203`) and its count
   ("Bu testte N soru vardır"). A question start is an item "12." at the left edge of a column, first on its line, and the
   next number of that test; numbers inside tables or the instruction block fail one of those. A question's picture runs
   from its number to the next start in the same column (or to the footer rule). A shared passage or notice
   ("35 - 36. soruları aşağıdaki parçaya göre …") is added in front of each question it covers; a passage with tables across
   both columns is cut across the page. Each page is rendered once at scale 2 and the pictures are copied out of it.
   If the found count differs from the declared one the file is refused with the test and the missing number.
2. **Cevap raporu**, `.xlsx`. Read by header text, not column letters (shared or inline strings). Every sheet with the header row is one
   session: the real workbook has **TYT** and **AYT** sheets (sections end in -T / -A). Students are joined by Öğrenci No; a student's
   booklet (A or B) is per session. Sections (TÜRKÇE-T, …)
   are filled into the booklet tests in order by their question counts; if they do not fit, a Turkish error is shown.
3. **Çözüm kitapçığı**, PDF with "A-n / B-m" labels. Needed only for B students; it goes to the session whose question count it matches, and may exist for TYT only (AYT B students then get the numbers-only list). It is accepted only after the other two
   are loaded, and refused as a whole unless every test's A and B numbers are permutations of 1..N, every pair stays in
   one section, and `keyA[a] = keyB[b]` for every pair. If a later booklet or report no longer fits it, it is dropped.
4. **Ders ortalamaları (isteğe bağlı)**, the publisher's "Ders Ortalamaları İlk 100 Kurum" PDF (read with pdf.js, like the others; needs only the cevap raporu of the same exam first).
   One section per ders (TYT and AYT), each starting with a title line `27-YKS-1202, TÜRKÇE-T Dersi Net Sıralı Liste _40 Soru_ (İlk 100 Okul)`, then the header
   `Sıralama · Okul Adı · Okul Net · Okul Başarı · Genel Net` and 100 school rows (a continuation page repeats the header without a title). **Only three things are read:** the exam code,
   each ders's question count (from the title) and its **Genel Net**, the network-wide average net, constant down the column (Turkish decimal comma). The school rows are ignored: only the `Genel Net`
   column is taken (by the nearest header), school names are never read into the model, and only `{kod, dersler:[{ad, n, genel}]}` is kept. Status: "✓ 24 ders · genel ortalama".
   It is refused (nothing changes) when the exam code differs from the cevap raporu's ("Sınav kodları uyuşmuyor: … 27-YKS-1202 … 27-YKS-1203"), when a ders's question count differs from the report's section
   ("Soru sayıları uyuşmuyor: …"), when no ders matches, when the Genel Net column is not one value, or when the PDF is not this report. Ders names are matched by the section names of the report (TÜRKÇE-T, TARİH.1-A, FELSEFE GR.-A, S.FELSEFE-A …);
   report sections the file lacks stay unanchored. A new cevap raporu re-checks the file and drops it if it no longer fits.

5. **Performans analizi (isteğe bağlı)**, the publisher's "27-YKS-1202 SINAVI ANALİZLERİ" PDF: aggregate counts over the whole network, no student data. Recognised by its title ("SINAVI ANALİZLERİ" / "Madde Güçlük İndeksi") and read by lines (items grouped by y).
   The exam code is in the title; there is one page per ders titled like the report's sections ("TÜRKÇE-T (40 Soru )", "TARİH.1-A (10 Soru )"); each row is `1. Soru`, the ÜST and ALT counts of A, B, C, D, E, BOŞ (12 numbers), p (dot decimal), its meaning, r, its meaning, in A-booklet numbers.
   The reader is strict: a file that names two different exams is refused, and a question printed twice with different numbers is refused (an identical repeat, e.g. on a page break, is read once). Each ders also keeps the publisher's printed participant count ("İşaretleme yapan öğrenci sayısı", `orneklem`) and upper + lower group size (`grupToplam`) when the file prints them, the number of decimals p and r were printed with, and `kitapcik: 'A'` when the file says it is in A-booklet order (shared with Konu Takibi, which reads the same file through `YANLISLAR.performansCoz`).
   Only `{kod, kitapcik, dersler:[{ad, n, orneklem, grupToplam, maddeler:[{no, p, r, pBasamak, rBasamak, ust, alt}]}]}` is kept (stored in the library, no 11 digit number). It is refused (nothing changes) when the exam code differs from the cevap raporu's ("Sınav kodları uyuşmuyor: …"),
   when a section's question count differs ("Soru sayıları uyuşmuyor: …"), when no ders matches, or when more than about 10% of the questions have a most-marked ÜST option that differs from the report's A key ("N soruda en çok işaretlenen seçenek cevap anahtarından farklı …"; a few differences are accepted,
   since a cancelled or differently keyed question breaks the rule). A new cevap raporu re-checks it. See "Soru zorluğu" for how it is used.

## Privacy

- The cevap raporu has a `TC Kimlik No` column. The header row is located first and the cells of that column are never
  read (not even their shared strings). Any 11 digit number found anywhere else is dropped. The parsed model has no TC
  field. `test/yanlislar-regression.cjs` checks that `JSON.stringify` of the model has no 11 digit number, and that the TC
  cells are not opened.
- Konu Takibi still refuses this file (`GIZLI` / `CEVAP_RAPORU`); only this page accepts it. The raw .xlsx is read in memory and dropped; only the sanitised model is kept (device only).
- Tests and fixtures use made-up students and booklet text only.

## The page

**Oturum and Alan.** The booklet slot is labelled "Soru kitapçığı (A) · TYT ve AYT": the TYT and the AYT booklet are two PDFs (one A booklet each), chosen together or one after the other; each
is recognised by its page header, the ✓ status shows one line per session and a hint names the booklet still missing. When the report and booklets cover both sessions the page offers **Oturum**
(TYT + AYT, the default · TYT · AYT) and, while AYT is included, **Alan**: *Öğrencinin alanı* (default), SAY, EA, SÖZ, Tümü. The AYT tests of a field are the app's own `DENEME_ALAN` (SAY: Matematik + Geometri, Fizik, Kimya, Biyoloji;
EA: Matematik + Geometri, Türk Dili ve Edebiyatı, Tarih-1, Coğrafya-1; SÖZ: Türk Dili ve Edebiyatı, Tarih-1, Coğrafya-1, Tarih-2, Coğrafya-2, Felsefe Grubu, Din Kültürü / Ek Felsefe with the Din / Ek Felsefe rule below), matched to
the report sections by `KADEME.kodDers`. *Öğrencinin alanı* reads the field written for the student in the teacher notebook (`D.ogr`, matched by school no); when it is unknown, only the AYT tests the student answered are used.
AYT tests outside the alan are left out of that student's defter, so their blank answers are not counted as "boş"; *Tümü* keeps all of them. TYT is never touched by Alan. The ders checkboxes work on top (with SAY, EA or SÖZ the boxes of the other fields are hidden),
and the counts in the header follow. The difficulty of an AYT section is computed from the students who took it (a whole blank section is not taken), whatever the alan; Ders ortalamaları anchoring and Kendi seviyesi use the AYT keys of KADEME.
In print a TYT block comes first, then the AYT block, each under its session heading ("TYT", "AYT") with its ders headings, and the key at the end covers both; neither the alan nor the tiers are printed.

Filters: **Şube**, **Öğrenci** (one student), and a checkbox per ders (for sections not taken). **Yazdır** prints the
filtered set. On screen the questions are one column; on paper A4 portrait, two per row when they fit (a question with a
full-width passage takes a row), never split across pages.

**Soru durumu** selects wrong, blank, or both. **Zorluk** is a row of chips (Çok kolay · Kolay · Orta · Zor · Çok zor, plus
**Kendi seviyesi**); all five bands are selected by default. Printing and the counts in the header use the same selection.
The selected status appears in each printed notebook's heading; Kendi seviyesi, tiers and kademe are never printed. Zero matching questions disables printing.
Filter choices remain in page memory only; the answer-file data is kept in the device library. Difficulty is computed from the cevap raporu itself (see
"Zorluk ve kademeler"; with the optional Ders ortalamaları file the band scale is anchored to the network average); the school's Madde Analizi in Konu Takibi is now only a validity check (one rank correlation).

- Each student starts on a new page: name, Öğrenci No, şube, exam name, "12 yanlış · 5 boş"; questions grouped by ders in
  booklet order, each with "Soru 12" and a small difficulty chip ("Zor", or "Zor?" when the band is not certain). A student without wrong or empty questions is shown
  on screen but not printed.
- The last page of each defter is a table per ders: **soru · senin cevabın (or Boş) · doğru cevap**, so the student tries first.
- **Din Kültürü / Ek Felsefe** (report: S.FELSEFE): if a student left one of them entirely blank and answered at least one question of the
  other, the blank one is skipped. Other untaken sections are not guessed; untick them.
- **B booklet students** get the A pictures labelled "Soru 12 (B kitapçığında 7)" and their answer key in their own B
  numbers. Without the çözüm file they get a numbers-only list by B number per ders and the line "B kitapçığı: sorular
  kendi kitapçığından çözülecek".

## Tests

`node scripts/embed-yanlislar.cjs --check && node test/yanlislar-regression.cjs && node test/yanlislar-difficulty-regression.cjs` (parsing, TC, selection, difficulty boundaries, mapping, map
validation, markup) and `node test/yanlislar-browser.cjs` (real pdf.js on a generated booklet, crops, filters, print
to PDF, 1280 and 390 widths). Source: `src/yanlislar.js`, `src/yanlislar.css`.

## Zorluk ve kademeler

Everything below is computed in the browser, in memory; nothing is stored or sent. Code: `src/zorluk.js` (item analysis), `src/kademe.js` (tiers).

### Ders names

Report sections are shown under proper names (checkboxes, defter headings, answer tables, Madde kalitesi): TÜRKÇE → Türkçe, TÜRK DİLİ VE EDB → Türk Dili ve Edebiyatı,
TARİH.1 → Tarih-1, COĞRAFYA.2 → Coğrafya-2, FELSEFE GR. → Felsefe Grubu, S.FELSEFE → Ek Felsefe, the rest by their plain names (Matematik, Geometri, Fizik, Kimya, Biyoloji, Din Kültürü). A name that exists in
both sessions gets the session ("TYT Matematik", "AYT Matematik"); otherwise there is no prefix. An unknown section is only title-cased.

### Difficulty source priority

1. **Performans analizi p**: the network-wide p of the question (thousands of students) replaces the school sample. p is turned into the same five bands as the school's Rasch bands: b = ln((1 − p)/p) centred over the section's questions, μθ = the ability at which the expected section score equals the mean p (the average network student),
   and `b − μθ` goes through the same cut points (≤ −2 Çok kolay, ≤ −0,75 Kolay, < 0,75 Orta, < 2 Zor, otherwise Çok zor). With this N the "?" marker and the low-reliability mark disappear. Applies to the A numbering (A students, and A+B pooled through the çözüm map; a B group without a map keeps the school's bands).
   The section line says "zorluk: yayınevinin performans analizi (Türkiye geneli, A kitapçığı)" with the rank correlation between the school's p and the publisher's, and Madde kalitesi shows a "Türkiye p" column. The school's own computation stays as the validity check.
2. The school's p anchored by **Ders ortalamaları** (below).
3. The school's p alone.

Kendi seviyesi and the kademeler work on whichever band is shown.

### Soru zorluğu (from the cevap raporu)

Per session and per ders section, from all students in the report. Correct = 1, wrong or blank = 0 (wrong and blank rates are kept).
A student who left the whole section blank did not take it and is not counted (Din vs Ek Felsefe, an AYT section outside the field).
A cancelled question (key not A-E) is left out of the totals. With a valid A↔B map the A and B students are pooled on A numbering;
without it each booklet is analysed separately on its own numbers (smaller n, which the reliability line shows).

Per item: `p` with its **Wilson (1927) 95% interval**; the **corrected point-biserial** `r_it` (item against the rest of the section
score); the **Rasch (1PL) difficulty** `b` by JMLE (own implementation, items centred at 0, Wright's bias correction (L−1)/L on b, θ and SE;
extreme persons and items are left out of the fit and counted as extreme; SE = 1/√ΣP(1−P)); infit and outfit mean squares.
Per section: **KR-20** (Kuder & Richardson 1937, population variance) and SEM = SD·√(1−KR-20), n takers, item count, and the Rasch item
separation G = SD_true/RMSE (SD_true² = SD_obs² − mean SE²) with reliability G²/(1+G²).

**Five bands** from `b − μθ` (logits, relative to the mean person ability of the section): ≤ −2 Çok kolay · (−2, −0.75] Kolay ·
(−0.75, 0.75) Orta · [0.75, 2) Zor · ≥ 2 Çok zor. Reasons: ±0.75 logit is P ≈ .32 / .68 for an average student, a band where
an item neither separates nobody nor everybody; ±2 logits is P ≈ .12 / .88, where an item is nearly always missed or nearly always
answered. The band is the point estimate. The label carries "?" ("Zor?") only when `b ± 1.96·SE` spans **three or more** bands, i.e. when we cannot even say
"this band or a neighbour"; the chip Zor still includes Zor? items. Reason: at n ≈ 27 the SE is about 0.45–0.6 logits, so a 95% interval is about ±1 logit,
wider than one band (0.75–1.25 logits), and it touches a neighbouring band for almost every item; a "?" on every chip would carry no information. The band is the
best estimate and is reliable to within one neighbour band. An item everybody got right (or nobody) has no `b`; it keeps Çok kolay / Çok zor and is reported as extreme,
with "?" only when fewer than 15 students took the section.

**Flags** (kept next to, never instead of, the label; thresholds of Ebel & Frisbie 1991 for r_it, 0.5–1.5 for the Rasch mean squares,
Wright & Masters 1982): `r_it < 0` "Ayırt etmiyor: anahtarı kontrol edin", `0 ≤ r_it < 0.20` "Zayıf ayırt edicilik", infit or outfit
outside 0.5–1.5 "Uyumsuz". They are shown in the on-screen **Madde kalitesi** tables (soru, p, b relative to μθ, r_it, flag), not printed.
The section line reads "Türkçe · 27 öğrenci · KR-20 0,82 · 2 madde işaretli"; with fewer than 15 takers or KR-20 < 0.50 it adds
"Güvenilirlik düşük"; that line is where low reliability is said, the labels get no "?" for it and their chips are shown muted instead. If Konu Takibi holds the Madde Analizi of the same exam, the Spearman correlation between our `p` and
the school's `p` is added as "okul verisi ρ 0,71".

### Ders ortalamalarına göre ölçek (optional anchoring)

Without the fourth file the bands use `b − μθ`, the Rasch difficulty relative to **this school's** mean ability, so "Zor" means hard for this cohort. With the file, each ders that has a Genel Net is anchored to the network-wide average student:

1. School mean net ratio `r_s` = mean over the takers of `(D − Y/4)/n` (D correct, Y wrong, blanks cost nothing; the same wrong-answer penalty as the publisher's net; takers as in the item analysis, a cancelled question is left out of D, Y and n).
2. Network ratio `r_g` = Genel Net / n (n = the question count of the file, equal to the report's section).
3. Both are clamped to [0.02, 0.98] so a perfect or zero ratio stays finite; `Δ = logit(r_s) − logit(r_g)`.
4. The bands use `(b − μθ) + Δ`: the difficulty for the average **network** student. A school that is stronger than the network (`Δ > 0`) sees its items move harder, a weaker school (`Δ < 0`) easier. Same five edges (±0.75, ±2), same "?" rule (the SE is unchanged); extreme items keep Çok kolay / Çok zor.

With two booklets analysed separately (no çözüm map) each group gets its own Δ. Per ders; a ders the file lacks keeps the school-relative band. **Without the file everything is exactly as before.**

Only the **item bands** shift: the chips on screen and in print, the filter, and the new "Genele göre" column of the Madde kalitesi table (which sits next to `b`, still the school-relative value, so the two can be compared) use the anchored band; the order of questions inside a ders (Rasch b) is unchanged. **Kademe tiers and Kendi seviyesi windows are unaffected**: tiers stay relative within the grade, and the Kendi seviyesi window picks the same band numbers (it simply meets the anchored bands). The section line gains
"· genel ort. 22,48 net · okul 27,10 net · ölçek genele göre" (only with the file). The printed student defter says nothing about anchoring (the chips just use the anchored band).

**Limitation.** This is a *common-mean anchoring* (a mean/mean linking), **not equating**: it assumes that the shift of the mean net ratio on the logit scale approximates the shift of the mean ability (the net ratio is not a Rasch measure; a ratio is compressed near 0 and 1, which the clamp only partly handles), that the school's students are a sample comparable to the publisher's population of takers, and that one constant moves all items of a ders. It uses nets with the wrong-answer penalty on both sides so the comparison is like with like; a sparse sample (few takers, five-question dersler) makes `r_s`, and hence Δ, noisy. Δ moves the labels but adds no information about the items.

### Kademeler (from all exams in the notebook)

Source: `denemeListe` of every student (school results and own entries): D, Y and question count per ders. A ders counts as in
`denemeBolumSayilir` (a blank TYT ders is a real zero; an AYT ders outside the field only if answered). Everything is computed **per grade** (the student's `sinif`, otherwise the grade in the şube name, otherwise 12: `denemeOrtSinifi`, as in the Deneme ortalamaları): a 9th grader is never ranked against 12th graders. Per exam and ders the cohort is
every student of that grade who sat it (at least 5, otherwise the exam is skipped). With `m_e` = the cohort mean of (D+0.5)/(n+1):

- relative ability `a_se = logit((D+0.5)/(n+1)) − logit(m_e)`; an exam that is harder for everybody moves `m_e` with it, so nobody's ability falls;
- `a_s = Σ w a / Σ w`, `w` = precision `n p (1−p)` times recency `0.8^age` (`AGIRLIK_KADEME`), age = the exam's index from the latest exam of that ders (see "Why 0.8" below);
- SE by the delta method, `var(logit p) ≈ 1/(n p (1−p))`.

**Why 0.8, not 0.5.** `analiz.js` weighs the gidişat projection by `0.5^age` because a projection needs recency; that keeps an effective n of about 3 exams.
Tiers classify a fairly stable ability and need precision: a 5-question ders (Tarih, Coğrafya, Felsefe, Din) has SE of 0.7-1 logit per student per exam, and with
n_eff ≈ 3 `SD_obs²` falls below `mean(SE²)`, so the ders used to be dropped. `0.8^age` has a half-life of about 3 exams and an effective n of about 7 over 10 exams. `analiz.js` is unchanged.

Person separation `G = SD_true/RMSE` (G = 0 when `SD_true² ≤ 0`), reliability `G²/(1+G²)`; the tier count `H = floor((4G+1)/3)` (Wright & Masters 1982 strata) is clamped to **3..6**.
A blank counts like a wrong answer (the ability uses D out of n, so an empty question is not a separate case).

**Tiers are norm-referenced within the grade, cut at natural breaks.** The teacher's purpose is relative grouping for question selection, with the boundaries where the cohort
actually separates. Per (grade, oturum, ders) the abilities are sorted and split into `H` contiguous groups by the exact **Fisher (1958) / Jenks (1977) optimal partition**
(*On grouping for maximum homogeneity*, JASA 53; Jenks, *Optimal data classification for choropleth maps*): the partition that minimises the total within-group sum of squared deviations,
by dynamic programming in O(H·n²). Objective: minimise **SDCM**, the sum of squared deviations from the class means (**SDAM** is the sum of squared deviations from the overall mean).
Trying every combination of breaks guarantees the optimum ([Jenks natural breaks optimization](https://en.wikipedia.org/wiki/Jenks_natural_breaks_optimization)); Fisher's exact dynamic programme finds that same optimum efficiently, so nothing is approximated. Chosen at the teacher's request instead of fixed counts per tier: a far-away student forms a tier alone, and a boundary never falls inside a dense bunch.
Tier 1 is the strongest group. The boundary between two tiers is the midpoint of the gap between the last student of one and the first of the next; the "?" rule uses these boundaries.
**Ties:** equal abilities are never split: the DP runs on the distinct values with their multiplicities, and with fewer distinct values than `H`, `H` is that number (at least 1; a ders with one ability value is a single tier).
**Number of classes:** the method itself gives no rule (Jenks aimed for fewer than 7); ours is `H` from the Wright & Masters strata, kept within 3-6.
**Fit:** the goodness of variance fit `GVF = (SDAM − SDCM) / SDAM`, in 0..1 (1 when there is no variance) is kept per ders and shown in the header tooltip next to the reliability ("… güvenilirlik 0,82 · ayrışma uyumu 0,91").
A ders is **never dropped for low separation**: with `SD_true² ≤ 0` it still gets tiers, reliability 0 and `dusuk`. Natural breaks are "not recommended for data that have low variance" (the page above), which is why a ders whose separation reliability is < 0.5 is marked `dusuk` (no GVF threshold is used):
the header reads "<H> kademe · güvenilirlik düşük", its cells and chips are muted (opacity .55, as the low-reliability item chips) and get no "?".
"Veri yetersiz" only when fewer than 8 students of that grade have data for the ders, or no exam can be equated.
Tier 1 is the strongest; a student's tier is the point estimate and shows "?" only when `a ± 1.96·SE` spans three or more tiers (same rule and reason as the item bands). The Deneme panosu shows **Kademeler** (students ×
ders, Sınıf selector (9/10/11/12, only grades with data, default the highest), şube list of that grade, TYT/AYT filter, sort by a ders, click a cell for the ability trend); the cells use one blue scale (tier 1 the deepest fill, the weakest tier the lightest, scaled by the ders's tier count, so 1/2 and 1/6 differ; light text on the deep half, contrast ≥ 4.5 in light and dark themes) and a "?" cell is hatched with a dashed inner outline, never another colour. The header reads "6 kademe · 0,95" (title: "6 kademe · güvenilirlik 0,95"); the table scrolls inside its card and keeps the student column fixed. Denemelerim shows the chips "Matematik · 2. kademe / 4".

**Kendi seviyesi** maps the student's tier to a window of difficulty bands (0 Çok kolay, 1 Kolay, 2 Orta, 3 Zor, 4 Çok zor) and **adds** that window to the selected band chips: for each student and each ders the included bands = chips ∪ window (Kendi seviyesi alone gives exactly the window; a tier-1 student with Orta+Zor+Çok zor gets the same set with or without it). Questions are
listed **easiest first** (Rasch b ascending) within each ders. Five windows from the top: W0 = {Zor, Çok zor}, W1 = {Orta, Zor}, W2 = {Orta}, W3 = {Kolay, Orta}, W4 = {Çok kolay, Kolay};
tier k of H gets `W[round((k−1)·4/(H−1))]` (a ders with a single tier gets W2): H = 3 → {3,4}, {2}, {0,1}; H = 4 → {3,4}, {2,3}, {1,2}, {0,1}; H = 5, 6 as the formula gives. Report sections are matched to Deneme ders codes by name (TÜRKÇE-T → TYT turkce, TARİH.1-A →
AYT tarih1, …; the student by Öğrenci No). The tier is the student's own grade's, and exists for low-reliability ders too. A student (or ders) without tiers (Veri yetersiz) falls back to the Orta window (W2).

### Known limits

- **Small n.** A school sample of 15–60 students gives `b` standard errors of 0.3–0.5 logits for mid-range items, so a band is reliable to within one neighbour band only. Items near the cut points move bands with a handful of students; the labels rank questions, they do not measure them.
  Five-question sections (Tarih, Coğrafya, Felsefe, Din) have KR-20 near or below 0.5 and are flagged "Güvenilirlik düşük".
- Without the A↔B map the two booklets are separate small groups; AYT fields leave 4–13 takers per section.
- Rasch assumes equal discrimination; misfit flags item types that break this (guessing, key errors).
- Wrong and blank both count as 0, so a skipped hard item and a missed one look alike; the blank rate is kept for reading.
- Ability uses only a student's own sampling error (not exam-to-exam instability); tiers are coarse by design.
- A student's own Denemelerim only shows tier chips when the notebook holds the cohort (teacher view); nothing is published to students.

References: Wilson (1927) JASA 22; Kuder & Richardson (1937) Psychometrika 2; Ebel & Frisbie (1991) *Essentials of Educational Measurement*;
Wright & Masters (1982) *Rating Scale Analysis* (separation, strata, fit mean squares); Fisher (1958) JASA 53, 789-798; Jenks (1977), Optimal data classification for choropleth maps; en.wikipedia.org/wiki/Jenks_natural_breaks_optimization.

Tests: `node test/yanlislar-kutuphane-regression.cjs` (library, bulk grouping, multi-exam defter, PDF plan, wipe) and `test/yanlislar-kutuphane-browser.cjs` (real IndexedDB, reload, print, PDF, quota, no IndexedDB); `node test/zorluk-regression.cjs` (ders ortalamaları parsing on a synthetic text-item layout, refusals, Δ on a hand example, stronger/weaker school, no file = unchanged; Wilson, r_it, KR-20, seeded JMLE recovery, bands and "?", strata, equating, Veri yetersiz, Kendi
seviyesi, two-sheet parsing, TC) and the browser tests `test/yanlislar-browser.cjs`, `test/denemepano-browser.cjs`.
