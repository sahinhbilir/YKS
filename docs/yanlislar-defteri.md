# Yanlışlar defteri

Teacher page under **Denemeler → Yanlışlar defteri** (same roles as Konu Takibi: the guidance teacher; students
never see it). It prints, for each student of one exam, only the questions the student got **wrong or left empty**,
cut out of the A booklet as pictures, so the student can solve them again.

## Files

Three inputs, each with a short ✓ status once read. None of these files or the generated notebooks are stored: not in localStorage, not in the notebook
(`D`), not in Firestore, and nothing is sent anywhere. The files stay in the page's memory; reloading or logging out
clears them, and uploading again is how the teacher reprints.

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

## Privacy

- The cevap raporu has a `TC Kimlik No` column. The header row is located first and the cells of that column are never
  read (not even their shared strings). Any 11 digit number found anywhere else is dropped. The parsed model has no TC
  field. `test/yanlislar-regression.cjs` checks that `JSON.stringify` of the model has no 11 digit number, and that the TC
  cells are not opened.
- Konu Takibi still refuses this file (`GIZLI` / `CEVAP_RAPORU`); only this page accepts it, in memory.
- Tests and fixtures use made-up students and booklet text only.

## The page

Filters: **Şube**, **Öğrenci** (one student), and a checkbox per ders (for sections not taken). **Yazdır** prints the
filtered set. On screen the questions are one column; on paper A4 portrait, two per row when they fit (a question with a
full-width passage takes a row), never split across pages.

**Soru durumu** selects wrong, blank, or both. **Zorluk** is a row of chips (Çok kolay · Kolay · Orta · Zor · Çok zor, plus
**Kendi seviyesi**); all five bands are selected by default. Printing and the counts in the header use the same selection.
The selected status appears in each printed notebook's heading; Kendi seviyesi, tiers and kademe are never printed. Zero matching questions disables printing.
Filter choices and answer-file data remain in page memory only. Difficulty is computed from the cevap raporu itself (see
"Zorluk ve kademeler"); the school's Madde Analizi in Konu Takibi is now only a validity check (one rank correlation).

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

Tests: `node test/zorluk-regression.cjs` (Wilson, r_it, KR-20, seeded JMLE recovery, bands and "?", strata, equating, Veri yetersiz, Kendi
seviyesi, two-sheet parsing, TC) and the browser tests `test/yanlislar-browser.cjs`, `test/denemepano-browser.cjs`.
