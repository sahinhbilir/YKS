# Etüt etkisi (guidance teacher)

The **Etüt etkisi** page asks one question of the school's own records: *do students gain more between two exams when they took etüts in between?* It does not compare average nets and it does not sort students into groups by their etüt counts. It looks at **how much each student's result moved**, measured against the Türkiye average, and compares every student **with themself**. It sits in the teacher menu under **Öğrenciler**, after Etütler, and shares the Etütler look (`src/etutler.css`, root `#eeKok`).

## Where the data comes from

Nothing is added, stored or uploaded. The page reads the analysis base of **Öğrenci raporları** (`OGRENCI_RAPOR.temelOgrenciler()`): the merged students with their exam results (the net of every lesson) and their etüt sessions (date, lesson, teacher, from Etütler). It also reads the lists of **Türkiye geneli** (`TURKIYE.oku()`, `TURKIYE.ortalamalar`, `TURKIYE.model`) for the Türkiye average net of every lesson in every exam. The page never writes to the notebook and never reaches a student packet; the choices live in `EK.ee*` only (`eeDuzey`, `eeOturum`, `eeDers`, `eeDonem`, `eeHoca`).

## How it is computed

Per lesson and session (**Sınıf**, **Oturum**, **Ders**, **Dönem** as before: *Tümü* or *Son 4 deneme*; a lesson's etüt course is turned into a lesson the way Etütler does it, and a course named for one session counts for it only). Exam days are never etüt days.

**Türkiye farkı.** d = the student's net − the Türkiye average net of that lesson in that exam, so how hard the exam was drops out. The exam is matched to its Türkiye list by name, the way Türkiye geneli matches it (`TURKIYE.ortalamalar`). AYT Coğrafya and Tarih are two parts for the student and in the list; both sides are summed. An exam without a list for that lesson is not used. If no exam of the period has a list, the raw net is used and a banner says so: *Türkiye geneli listesi yok: ham net artışı kullanıldı; deneme zorluğu ayıklanmadı. Türkiye geneli sayfasından ekleyin.*

### The main measure: total change since the etüt (`toplamDegisim`)

1. **Etütten önce and Son deneme.** For each student with at least one etüt of the lesson in the period: d at the last exam strictly before their first etüt (if the first etüt is earlier than the first exam of the period, the first exam is used and marked *etüt bu denemeden önce başladı*), and d at the latest exam they sat after it. **Toplam değişim** = Son − Etütten önce. Small swings in between do not cancel the credit: +5 after the etüt and then −1 is +4. A student with no exam after the first etüt is listed apart (*etütten sonra deneme yok*).
2. **Beklenen değişim.** Students with no etüt of the lesson before the end of the same two exams (and who sat both) are the controls. For each (start, end) pair used by an etüt student: change = a_pair + b·d_start, with a pair's own intercept and one slope b shared by all pairs (each pair demeaned within itself). It removes the school's general trend of that pair and the rebound of low starters (they rise anyway). A pair with fewer than 3 controls borrows: a = (n/3)·own + (1 − n/3)·pooled intercept, so a pair with none uses the pooled one. The prediction for an etüt student is made from their own start. **Etüt sonrası fark** = Toplam değişim − Beklenen.
3. **Öğretmen cebi.** Each student's difference is split among the teachers by their share of that student's etüts of the lesson up to the last exam (6 with A and 2 with B: A 75%, B 25%). Per teacher: **Toplam katkı** = the sum of their shares of the differences ("the pocket"), **Öğrenci başına** = the share-weighted mean, with a 95% interval (percentile bootstrap over students, 1000 resamples, fixed seed `TOHUM`, so the same data give the same interval), the number of students and etüts. Ranked by Toplam katkı, ties sharing a rank (1, 1, 3); under 5 students no rank (—), drawn faint, last. The name filter limits the student list to a teacher's students.
4. **Headline and verdict.** Mean total change of the etüt students, mean expected change, their difference with its bootstrap interval; then one sentence (`kararToplam`): *Etüt aldıktan sonra artış belirgin…* when the interval is above zero, *Belirgin bir fark yok.*, *Etüt alanlar beklenenden daha az arttı…*, or *Yeterli veri yok* (fewer than 8 etüt students, or an interval wider than 6 net). The interval covers the etüt students; the uncertainty of the expected-change fit is not added (it rests on the controls, whose number is shown).

### Supporting view: between exams (`etkiHesapla`)

Collapsed under **Ayrıntı: deneme aralarına göre**. For every pair of consecutive exams a student sat: g = d₂ − d₁ and e = the etüts strictly between the two exam days. Within-student fixed effects g = aᵢ + b·e + c·(d₁ − d̄ᵢ) + ε (the c term controls the rebound after a bad exam), fitted by demeaning within the student; only students whose etüt count changes between their intervals identify b. 95% interval by cluster bootstrap over students, a sentence on it, the paired comparison (students with both kinds of intervals) and the bars by etüts in the interval (0, 1, 2, 3, 4+; faint under 5 intervals). The two methods never share the headline.

**Students left out**, listed apart with the reason: *yalnızca 1 denemeye girdi*, *bu dönemde denemeye girmedi*, *bu dersin neti yok*, *Türkiye listesi olan iki deneme yok*, *etütten sonra deneme yok*. **Coverage:** weekdays in the period that no added etüt report covers are counted; the page warns that etüt counts may be incomplete.

## What the page shows

Top to bottom, in plain Turkish with every number labelled:

1. Context line, the **headline** (`#eeOzet`), the **verdict** (`#eeKarar`), the counts of students (with etüts / without, left out) and the one-line limit.
2. Controls (Sınıf, Oturum, Ders, Dönem), then the banners (matching warnings, the missing-list banner or the exams without a list, coverage).
3. **Etüt sonrası fark** (`#eeFark`): one bar per student who took etüts, sorted, up (green) when they gained more than the expected change and down (red) when less; the zero line is "beklenen" (as expected) and the mean is a dashed line, both named at the right. Chosen because it needs no explanation: every bar is a person, above zero is better than similar students without etüt.
4. **Okulun Türkiye'deki yeri** (`#eeGrafik`): the lesson's line from Türkiye geneli for that grade and session (`TURKIYE.model`) as the school's yüzdelik dilim ("ilk %12", higher is better), with the weekly etüt count of the lesson beneath on the same dates. The dilim helpers are TURKIYE's own (`dilimNokta`, `dilimdenT`, `dilimYazi`, `dilimKisa`, `DILIM_TIKLARI`); if missing, the page uses dilim = 100·(1−Φ((T−50)/10)) with the same wording. Without a list for the grade the panel says so with a button to Türkiye geneli.
5. **Öğretmenlere göre** (`#eeHocalar`): rank, teacher, students, etüts, Toplam katkı, Öğrenci başına with its interval under it.
6. **Öğrenciler** (`#eeOgrenciler`): Etütten önce (exam and d), Son deneme, Toplam değişim, Beklenen, Etüt sonrası fark (▲ green / ▼ red), the teachers with their shares, and a small line of d with a dotted marker at the first etüt; the collapsed list of students left out (`#eeDisarida`).
7. Collapsed **Ayrıntı: deneme aralarına göre** (`#eeAralik`) and **Nasıl hesaplanır** (`#eeNasil`, plain words).

Numeric headers and numbers share the class `sayi` (right-aligned); on a phone the non-essential columns are hidden so nothing scrolls sideways. Charts are drawn at the box's real width (the interval bars are drawn when their block is opened).

## What it cannot tell

It shows an **association, not a cause.** A student may go to etüt because of something that also changes their results (a new study plan, a change at home). The rebound control removes the most common trap, not every one. Few students or few intervals give wide intervals, which is why small bars and teachers are drawn faint and why the verdict can be *Yeterli veri yok*.

## Code and tests

- `src/etutetkisi.js` and `src/etutetkisi.css` are embedded into `index.html` by `node scripts/embed-etutetkisi.cjs` (`--check` only verifies). The pure model (`model`, `beklenenModel`, `kararToplam`, `etkiHesapla`, `bootstrap`, `karar`, `eslestirme`, `kovalar`, `trOrtalama`, `durus`) is exported with the page. The page is `gorunumEtutEtki()` under the tab `etutetki` (rehber only).
- `test/etutetkisi-regression.cjs` checks d with Türkiye averages (the AYT two-part sum, the name match through the real `TURKIYE.ortalamalar`); the teacher's example (+5 then −1 is +4, all credit); the credit split by share; the expected change removing a planted school-wide trend and the rebound of low starters (difference 0), and a planted +1,5 found; the pair intercept borrowing; a first etüt before the first exam and an etüt with no later exam; headline text, verdict sentences and bootstrap determinism; teacher ranks and thresholds; the interval method (hand-worked fixture, planted +0,5 per etüt against a dummy-variable fit, rebound control, paired comparison, bars); the missing-list fallback; left-out reasons; periods, coverage, the page (sections in order, no tier labels, collapsed blocks), the charts and dilim helpers, states, menu and privacy.
- `test/tutarlilik-regression.cjs` runs one synthetic fixture through Deneme panosu, Etüt etkisi, Öğrenci raporları, Yoklama and Etütler.
- `test/etutetkisi-browser.cjs` runs on desktop (light) and at 390 px (dark): the menu, the sections in order, the charts at their real width in real-pixel type, the collapsed interval block opening and drawing, every numeric header over its numbers, the teacher filter, Dönem, Ders and Sınıf, the left-out list, the missing-list banner, redraw on resize, no sideways scrolling.
- The synthetic students and Türkiye lists (no real data) are built inside the tests.
