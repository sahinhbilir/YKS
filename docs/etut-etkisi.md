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
- **Teachers:** the same panel with one γ_T per teacher (etüts counted per teacher over all dersler, γ_T shared across dersler in z units, shown in net of the chosen ders). **Toplam katkı** = γ_T × the etüts that teacher gave in the chosen ders. No share is split. Ranked by Toplam katkı, ties share a rank; under 5 students no rank, drawn faint, last.
- **Student outliers:** on the residual of the chosen ders (modified z of the residual against the student's own other dersler, floor 1 net), iterated (fit, flag, refit, judge everybody again, 5 rounds), at most 20% put aside (*uç sonuç çok fazla: en uç 20% dışarıda*). Listed, never dropped silently.
- **Students table:** the student's change in this ders vs the mean change of their other dersler (in net of the chosen ders); *Fark* is the difference.

### Exported pooled result

`ETUT_ETKI.model(...)` keeps its field names (the Kurum raporu reads them): `ozet {n, katki, b, ci:[lo,hi], toplam, beklenen, fark, etut}`, `karar {k, yazi}`, `ogrenciler`, `hocalar`, `uc`, `dersler`, `ders`, `kip`, `durum`, `beklenen` (model info). They now hold the **within-student** estimate. New fields: `olay` (event study), `olcek`, `panel`, `dersSayisi`, and **`capraz`** — the earlier cross-student estimate (change = a_pair + b·d_start + γ·e over students, one ders) with the same shape (`ozet`, `hocalar`, `ogrenciler`, `karar`, `uc`).

## What the page shows

1. Context line, headline `#eeOzet`, verdict `#eeKarar`, counts, the one-line limit.
2. Controls (Sınıf, Oturum, Ders, Dönem) and banners.
3. **Etütten önce ve sonra** (`#eeOlay`, event study, `olayKur` / `olaySvg`): x = denemeler relative to the student's first etüt of the chosen ders (*2 deneme önce, 1 deneme önce, İlk etütten önce* = 0 and the reference, *1 deneme sonra, 2 deneme sonra, 3+ sonra*; tail binned, a student's values in a bin averaged first); y = mean cumulative change of the Türkiye farkı since the reference, in net of the chosen ders (standardized, converted back). Two lines for the same students: the etüt ders and the mean of their dersler without any etüt in the period. 95% whiskers (mean ± 1,96 SE), n under each position, a dotted marker at *İlk etüt* (between the reference and the next deneme), points with n < 5 faint. Note: *Etütten önce iki çizgi birlikte gidiyor, sonra etüt alınan ders yukarı ayrılıyorsa artış etüte bağlanabilir. Önceden de ayrılıyorsa bu başka bir farktır.*
4. **Okulun Türkiye'deki yeri** (`#eeGrafik`): unchanged (dilim line with deneme names and hollow dots for complete lists, weekly etüts beneath); its note now explains how it relates to the event study.
5. **Öğretmenlere göre** (`#eeHocalar`), **Öğrenciler** (`#eeOgrenciler`), left-out students and outliers.
6. Collapsed **Ayrıntı** (`#eeAralik`): *Öğrenciler arası karşılaştırma: her etüt ≈ … net* (the cross-student number, which includes diligence, so it can be larger than the headline; comparing both shows how much diligence inflated it), its scatter (`#eeFark`, etüt count × adjusted change), and the interval view (consecutive-denemeler fixed effects, paired comparison, bars by etüt count).
7. Collapsed **Nasıl hesaplanır** (`#eeNasil`), in plain words, saying: *Çok etüt alan öğrenciler zaten çalışkan olabilir; bu yüzden her öğrenci kendi diğer dersleriyle karşılaştırılır.*

## What it cannot tell

An **association, not a cause**. A student may take etüt in a ders because of something that also changes that ders only (a new plan for Fizik). Diligence is assumed to lift every ders by the same number of SDs; a ders-specific push is not removed. Dersler with etüt in different windows have different lengths, which a_pair only partly absorbs. Few students give wide intervals, hence faint points and *Yeterli veri yok*.

## Code and tests

- `src/etutetkisi.js` / `.css` are embedded by `node scripts/embed-etutetkisi.cjs` (`--check` verifies).
- `test/etutetkisi-regression.cjs`: Türkiye farkı and name match; interval view and cross-student checks (through `m.capraz`); the teacher's case (diligent students, no effect: cross-student clearly positive, within γ ≈ 0); a planted +0,5 net in Fizik recovered, also with diligence; standardization (Türkçe vs Fizik); event-study bins, reference at 0, flat pre-trends, divergence; γ_T and Toplam katkı; outliers and the 20% cap; *Yeterli veri yok*; bootstrap determinism; unchanged pooled field names; the page.
- `test/tutarlilik-regression.cjs` runs one synthetic fixture through the pages. `test/etutetkisi-browser.cjs` runs at 1280 (light) and 390 (dark): sections, event study at real width, Ayrıntı, tables, filters, no sideways scroll.
- All students and Türkiye lists are synthetic, built inside the tests.
