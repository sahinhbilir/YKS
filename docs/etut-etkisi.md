# Etüt etkisi (guidance teacher)

The **Etüt etkisi** page asks one question of the school's own records: *do students gain more between two exams when they took etüts in between?* It does not compare average nets and it does not sort students into groups by their etüt counts. It looks at **how much each student's result moved**, measured against the Türkiye average, and compares every student **with themself**. It sits in the teacher menu under **Öğrenciler**, after Etütler, and shares the Etütler look (`src/etutler.css`, root `#eeKok`).

## Where the data comes from

Nothing is added, stored or uploaded. The page reads the analysis base of **Öğrenci raporları** (`OGRENCI_RAPOR.temelOgrenciler()`): the merged students with their exam results (the net of every lesson) and their etüt sessions (date, lesson, teacher, from Etütler). It also reads the lists of **Türkiye geneli** (`TURKIYE.oku()`, `TURKIYE.ortalamalar`, `TURKIYE.model`) for the Türkiye average net of every lesson in every exam. The page never writes to the notebook and never reaches a student packet; the choices live in `EK.ee*` only (`eeDuzey`, `eeOturum`, `eeDers`, `eeDonem`, `eeHoca`).

## How it is computed

Per lesson and session (**Sınıf**, **Oturum**, **Ders**, **Dönem** as before: *Tümü* or *Son 4 deneme*; a lesson's etüt course is turned into a lesson the way Etütler does it, and a course named for one session counts for it only).

1. **Türkiye farkı.** For each student, exam and lesson, d = the student's net − the Türkiye average net of that lesson in that exam. The exam is matched to its Türkiye list by name, the way Türkiye geneli matches it (`TURKIYE.ortalamalar`). AYT Coğrafya and Tarih are two parts for the student and in the list; both sides are summed. Raw nets rise and fall with how hard each exam was; d does not. A pair that touches an exam without a list for that lesson is not counted, and those exams are named on the page with a button to Türkiye geneli. If no exam of the period has a list, the raw net is used for every pair and a banner says so: *Türkiye geneli listesi yok: ham net artışı kullanıldı; deneme zorluğu ayıklanmadı. Türkiye geneli sayfasından ekleyin.*
2. **Intervals.** For every pair of consecutive exams a student sat (a missed exam in between is skipped): the gain g = d₂ − d₁, the etüts e of that lesson **strictly between the two exam days** (the exam days are not counted), and the days between.
3. **Within-student fixed effects.** gᵢₜ = aᵢ + b·eᵢₜ + c·(d₁ᵢₜ − d̄ᵢ) + ε. aᵢ is the student's own usual pace, so a strong or a weak student does not bias b. b is the net gained **per etüt** beyond that pace. c is the **regression-to-the-mean control**: students go to etüt after a bad exam, and a bad exam is followed by a rebound anyway; without c the rebound would be credited to etüt. It is fitted by demeaning within the student (`etkiHesapla`; only students with at least two intervals enter, and only students whose etüt count changes between their intervals identify b; they are the *n* shown). A test checks the result against an independent dummy-variable fit.
4. **Interval.** The 95% interval of b is the 2.5% and 97.5% percentiles of a **cluster bootstrap over students**: 1000 resamples of whole students with the fixed seed `TOHUM`, so the same data always give the same interval (`bootstrap`).
5. **Simple comparison.** Among students who have both kinds of intervals: the mean gain in intervals with at least one etüt minus the mean gain in intervals with none, per student then averaged, with a bootstrap interval and the number of students (`eslestirme`).
6. **Verdict** (`karar`), never a cause: *Etüt aldıkça artış belirgin: her etüt ≈ +0,4 net (aynı öğrencinin kendi gidişine göre)* when the interval is above zero; *Belirgin bir fark yok* when it holds zero; *Etüt alınan aralıklarda artış daha az* when it is below zero; *Yeterli veri yok* when fewer than 8 students identify b or the interval is wider than 3 net per etüt. Always followed by *Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir.*
7. **Teachers.** For each teacher, the same estimate with e counted for that teacher's etüts only, with its interval and number of students. Ranked by the estimate, largest first; equal estimates share a rank (1, 1, 3); with fewer than 5 students there is no rank (—), the row is drawn faint and comes last. A teacher's name filters the student list; pressing it again or *Tüm öğretmenler* clears it.
8. **Students left out**, listed apart with the reason: *yalnızca 1 denemeye girdi*, *bu dönemde denemeye girmedi*, *bu dersin neti yok*, *Türkiye listesi olan iki deneme yok*.
9. **Coverage.** Weekdays in the period that no added etüt report covers are counted; the page warns that etüt counts may be incomplete.

## What the page shows

Top to bottom, in plain Turkish with every number labelled:

1. **Sentence** (grade, lesson, exams, students, intervals), the **verdict** (`#eeKarar`), the simple comparison (`#eeEslesme`), the count of students counted and left out, and the one-line limit.
2. **Controls:** Sınıf (when more than one), Oturum, Ders, Dönem; then the banners (matching warnings, the missing-list banner or the list of exams without a list, coverage).
3. **Etüt aldıkça artış** (`#eeArtis`): one bar per etüt count in the interval (0, 1, 2, 3, 4+), the mean Türkiye-farkı gain with 95% whiskers and *n* intervals under it, a zero line; a bar from fewer than 5 intervals is faint.
4. **Okulun Türkiye'deki yeri** (`#eeGrafik`): the lesson's line from Türkiye geneli for that grade and session (`TURKIYE.model`), as the school's **yüzdelik dilim** ("ilk %12", higher on the chart is better), named at its right end, with the weekly etüt count of the lesson beneath on the same dates. The dilim helpers are TURKIYE's own (`dilimNokta`, `dilimdenT`, `dilimYazi`, `dilimKisa`, `DILIM_TIKLARI`); if they are missing the page uses the same formula, dilim = 100·(1−Φ((T−50)/10)), with the same wording (whole number from 10, one decimal below, floor 0,1). Without a list for the grade the panel says so with a button to Türkiye geneli.
5. **Öğretmenlere göre** (`#eeHocalar`): rank, teacher, students, etüts, the estimate per etüt with its interval under it.
6. **Öğrenciler** (`#eeOgrenciler`): intervals, etüts, mean gain in intervals with etüt and without, a small line of the student's Türkiye farkı (their net when no list); most etüts first; and the collapsed list of students left out (`#eeDisarida`).
7. **Nasıl hesaplanır** (`#eeNasil`), collapsed, in plain words: the Türkiye farkı, comparing each student with themself, the rebound after a bad exam, the interval.

Every numeric header and number share the class `sayi` (right-aligned); the tables have fixed column widths with a flexible name column; on a phone the non-essential columns are hidden so nothing scrolls sideways. The charts are drawn at the box's real width.

## What it cannot tell

It shows an **association, not a cause.** A student may go to etüt because of something that also changes their results (a new study plan, a change at home). The rebound control removes the most common trap, not every one. Few students or few intervals give wide intervals, which is why small bars and teachers are drawn faint and why the verdict can be *Yeterli veri yok*.

## Code and tests

- `src/etutetkisi.js` and `src/etutetkisi.css` are embedded into `index.html` by `node scripts/embed-etutetkisi.cjs` (`--check` only verifies). The pure model (`model`, `etkiHesapla`, `bootstrap`, `karar`, `eslestirme`, `kovalar`, `trOrtalama`, `durus`) is exported with the page. The page is `gorunumEtutEtki()` under the tab `etutetki` (rehber only).
- `test/etutetkisi-regression.cjs` checks d with Türkiye averages (the AYT two-part sum, the name match through the real `TURKIYE.ortalamalar`), the interval and etüt counting rules, a hand-worked fixed-effects fixture (b = 1, c = −0,5), a planted +0,5 net per etüt recovered exactly and against a dummy-variable fit, the rebound fixture (b ≈ 0 with the control, clearly positive without it), the bootstrap's determinism, the paired comparison, the bars, the verdict sentences, the missing-list fallback and banner, the students left out and why, teacher rows and ranks, periods, coverage, the page (sections in order, no tier labels), the standing chart and the dilim helpers, the states, the menu and privacy.
- `test/tutarlilik-regression.cjs` runs one synthetic fixture through Deneme panosu, Etüt etkisi, Öğrenci raporları, Yoklama and Etütler.
- `test/etutetkisi-browser.cjs` runs on desktop (light) and at 390 px (dark): the menu, the sections in order, both charts drawn at their real width in real-pixel type, every numeric header over its numbers, the teacher filter, the Dönem, Ders and Sınıf controls, the left-out list, the method block, the missing-list banner, redraw on resize, and no sideways page scrolling.
- The synthetic students and Türkiye lists (no real data) are built inside the tests.
