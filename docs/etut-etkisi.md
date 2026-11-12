# Etüt etkisi (guidance teacher)

The **Etüt etkisi** page asks one question of the school's own records: *does a student gain more in the ders where they took etüts than in their own other dersler?* Students who take many etüts are often diligent students who improve everywhere, so comparing students with each other credits etüt with their diligence. The page therefore compares **each student with themself across the dersler of the oturum**. It sits in the teacher menu under **Öğrenciler**, after Etütler, and shares the Etütler look (`src/etutler.css`, root `#eeKok`).

## Where the data comes from

Nothing is added, stored or uploaded. The page reads the analysis base of **Öğrenci raporları** (`OGRENCI_RAPOR.temelOgrenciler()`): merged students with their exam results (net of every ders) and etüt sessions (date, ders, teacher). It also reads **Türkiye geneli** (`TURKIYE.oku()`, `TURKIYE.ortalamalar`, `TURKIYE.model`). Choices live in `EK.ee*` only (`eeDuzey`, `eeOturum`, `eeDers`, `eeDonem`, `eeHoca`).

## How it is computed (`src/etutetkisi.js`)

**Türkiye farkı.** d = student net − Türkiye average net of that ders in that deneme (matched by deneme name; AYT Coğrafya/Tarih sum two parts). Without any list for the chosen ders the raw net is used and a banner says so. A deneme-level outlier rule (modified z, 3,5; per ders; deviation from the student's own median, pooled MAD, floor 2 net) removes a blank test from every window.

### The panel (`panelKur`)

For the grade and oturum: one row per **student × ders** that has a Türkiye farkı, over **all dersler of the oturum** (not just the chosen one).

- **Window of a ders with etüt:** from the deneme before the first etüt of that ders (the first deneme if the etüt began earlier, marked) to the student's last deneme. An etüt with no later deneme drops the student (*etütten sonra deneme yok*).
- **Window of a ders without etüt:** the window of the student's etüt dersler. The chosen ders comes first, so a student with an etüt in it has the same window in every ders (this is what makes the event-study lines comparable). If the student has no etüt in the chosen ders, the earliest first etüt among their other etüt dersler sets the start; with no etüt anywhere it is first → last deneme.
- **change** = d_end − d_start.
- **Scale.** Türkçe has 40 questions, Fizik 7, so changes are divided by the ders's school SD: the within-deneme SD of d over students, pooled over the denemeler **before anybody in the grade had an etüt** (just the first deneme when etüts began earlier), floor 0,5 net. Later denemeler are not used because the etüt (and the diligence of heavy etüt takers) would widen the spread the scale is measured by. γ is converted back to net of the chosen ders for display.

### The model

change_z = α_student + β_ders + a_pair + b_ders·d_start_z + γ_ders·e + ε, fitted with student fixed effects (demeaning within the student). α absorbs diligence (it lifts every ders of a student). a_pair is an intercept for the (start, end) pair, b_ders the rebound control (a student who starts low rises anyway; one slope per ders). e is the etüt count in the window.

- **Headline:** γ of the chosen ders, in net: *her etüt ≈ +0,4 net, aynı öğrencinin diğer derslerine göre*. Interval: seeded percentile cluster bootstrap over students, 1000 resamples (`TOHUM`), the same data give the same interval.
- **Verdict** (`kararToplam`): *Etüt alınan derste artış belirgin…*, *Belirgin bir fark yok.*, *Etüt alınan derste artış daha az…*, or *Yeterli veri yok* when fewer than 8 students have the etüt ders compared with other dersler, fewer than 5 students have both an etüt ders and a non-etüt ders, no student has a non-etüt ders (γ's level is then unidentified, γ is null), the oturum has only one ders, or the interval is wider than 3 net. Always with *Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir.*
- **Teachers:** the same panel with one γ_T per teacher (etüts counted per teacher over all dersler, γ_T shared across dersler in z units, shown in net of the chosen ders). **Toplam katkı** = γ_T × the etüts that teacher gave in the chosen ders. No share is split. **A teacher gets a place only when the per-etüt effect is established**: the whole interval above or below zero (`belirgin`). Two effects whose intervals both include zero cannot be told apart from no effect, let alone from each other, so those teachers have no place, no arrow and no green or red (their figures are printed with a plain sign and the row says “aralık sıfırı içeriyor: fark belirgin değil”), and are listed by name after the placed ones. Placed teachers are ranked by Toplam katkı, ties share a rank; under 5 students no rank, drawn faint, last.
- **Student outliers:** on the residual of the chosen ders (modified z of the residual against the student's own other dersler, floor 1 net), iterated (fit, flag, refit, judge everybody again, 5 rounds), at most 20% put aside (*uç sonuç çok fazla: en uç 20% dışarıda*). Listed, never dropped silently.
- **Students table:** the student's change in this ders vs the mean change of their other dersler (in net of the chosen ders); *Fark* is the difference.

### Exported pooled result

`ETUT_ETKI.model(...)` keeps its field names (the Kurum raporu reads them): `ozet {n, katki, b, ci:[lo,hi], toplam, beklenen, fark, etut}`, `karar {k, yazi}`, `ogrenciler`, `hocalar`, `uc`, `dersler`, `ders`, `kip`, `durum`, `beklenen` (model info). They now hold the **within-student** estimate. New fields: `olay` (event study), `olcek`, `panel`, `dersSayisi`, and **`capraz`** — the earlier cross-student estimate (change = a_pair + b·d_start + γ·e over students, one ders) with the same shape (`ozet`, `hocalar`, `ogrenciler`, `karar`, `uc`).

## What the page shows

1. Context line, headline `#eeOzet`, verdict `#eeKarar`, counts, the one-line limit.
2. Controls (Sınıf, Oturum, Ders, Dönem) and banners.
3. **Etütten önce ve sonra** (`#eeOlay`, `olayKur` / `olaySvg`), compared with the **class average** of the same ders (difference in differences, not-yet-treated controls, in net of the ders, no standardization). For each student with an etüt in the ders the reference r is the exam before their first etüt (with that teacher, on a teacher's chart). x = exams relative to r: *2 deneme önce, 1 deneme önce, İlk etütten önce* (0), *1, 2 deneme sonra, 3+ sonra* (tail binned; a student's values in a bin averaged first).
   - **Etüt line** (*Etüt alan öğrenciler*) at position p: the mean over those students of d(r+p) − d(r).
   - **Ortalama line** (*Sınıf ortalaması (etüt almayanlar)*): for the same students and the same calendar exams, the mean of d_j(r+p) − d_j(r) over the grade's other students j with no etüt of the ders up to the later of the two exams (not yet, or never, treated; a student treated later is a control until their own first etüt). A student-position without any control is left out of both lines. Spread: 95% whiskers by a seeded cluster bootstrap over the etüt students (1000 resamples); n under each position.
   - **Before the first etüt** the area is grey, labelled *Etütten önce birlikte gitmeli*. The strip's pre bars are grey when the gap is small (|gap| ≤ 0,5 net or inside its interval) and amber with *etütten önce de farklıydı* when not: the honest check for the "studious students" problem.
   - **After it:** the area between the lines is light green where the etüt line is above, light red where below, split at crossings. Points follow the same colours; strong green (bigger point, the badge *ortalama düşerken arttı*) when the etüt line rose while the ortalama fell. The right end reads *+2,1 net ortalamadan fazla* / *−0,8 net ortalamadan az*.
   - **Strip** *Fark (net): etüt alanlar − sınıf ortalaması*: a bar per position, value = etüt line − ortalama line (grey/amber before, green/strong green/red after, faint under 5 students).
   - **Headline** (`#eeOlayOzet`): *İlk etütten sonra etüt alanlar sınıf ortalamasından ≈ +2,1 net fazla arttı (etütten önce fark ≈ +0,1) · <position>, n öğrenci* (the last position after the first etüt with at least 5 students; before: the mean of the pre positions with at least 5). The per-etüt line *Her etüt ≈ … (aynı öğrencinin diğer derslerine göre)* below it is unchanged and stays the verdict and the Kurum raporu's value.
4. **Okulun Türkiye'deki yeri** (`#eeGrafik`): the school's printed place in the lesson's Türkiye list, exam by exam (1. at the top; a deneme outside the list sits on a dashed “İlk 100 dışı” lane as a hollow dot, its place not estimated), with the deneme names under the dates and the weekly etüts beneath; its note explains how it relates to the event study.
5. **Öğretmenlere göre** (`#eeHocalar`), **Öğrenciler** (`#eeOgrenciler`), left-out students and outliers.
   Under the teacher table, **Etütten önce ve sonra · öğretmene göre** draws one small chart per teacher, in the table's order, with one shared legend above the grid: the same study as the main chart (class-average comparison, green/red fill, strip), restricted to the students who took that ders's etüt from that teacher, with position 0 the deneme before their first etüt **with that teacher**. Each card gives the teacher's own "Her etüt ≈ … net (olası aralık …) · n öğrenci · m etüt"; each card also repeats the chart's own sentence (gap after / before the first etüt); all cards share one y scale and one strip scale so they can be compared at a glance. A teacher with fewer than 5 students is drawn faint with "5’ten az öğrenci: kesin değil" and has no rank. Clicking a card or its name filters the student list. Two or three cards per row on a desktop, one at 390 px. The Kurum raporu never shows these.
6. Collapsed **Ayrıntı** (`#eeAralik`): *Öğrenciler arası karşılaştırma: her etüt ≈ … net* (the cross-student number, which includes diligence, so it can be larger than the headline; comparing both shows how much diligence inflated it), its scatter (`#eeFark`, etüt count × adjusted change), and the interval view (consecutive-denemeler fixed effects, paired comparison, bars by etüt count).
7. Collapsed **Nasıl hesaplanır** (`#eeNasil`), in plain words, saying: *Çok etüt alan öğrenciler zaten çalışkan olabilir; bu yüzden her öğrenci kendi diğer dersleriyle karşılaştırılır.*

## What it cannot tell

An **association, not a cause**. A student may take etüt in a ders because of something that also changes that ders only (a new plan for Fizik). Diligence is assumed to lift every ders by the same number of SDs; a ders-specific push is not removed. Dersler with etüt in different windows have different lengths, which a_pair only partly absorbs. Few students give wide intervals, hence faint points and *Yeterli veri yok*.

## Code and tests

- `src/etutetkisi.js` / `.css` are embedded by `node scripts/embed-etutetkisi.cjs` (`--check` verifies).
- `test/etutetkisi-regression.cjs`: Türkiye farkı and name match; interval view and cross-student checks (through `m.capraz`); the teacher's case (diligent students, no effect: cross-student clearly positive, within γ ≈ 0); a planted +0,5 net in Fizik recovered, also with diligence; standardization (Türkçe vs Fizik); event-study bins, reference at 0, flat pre-trends, divergence; γ_T and Toplam katkı; outliers and the 20% cap; *Yeterli veri yok*; bootstrap determinism; unchanged pooled field names; the page.
- `test/tutarlilik-regression.cjs` runs one synthetic fixture through the pages. `test/etutetkisi-browser.cjs` runs at 1280 (light) and 390 (dark): sections, event study at real width, Ayrıntı, tables, filters, no sideways scroll.
- All students and Türkiye lists are synthetic, built inside the tests.
