# Design

The screen design follows **Öğrenci Raporları**: a warm cream canvas, white rounded
cards, dark teal headings, a teal accent, clear sans-serif type and restrained
chart grids. Student and teacher screens use this same hierarchy. Data, dates,
totals and charts take precedence over explanatory prose and decoration.

The weeks map and the exam chart deliberately show the entire journey to YKS.
Empty future weeks and the space ahead of the early exam results tell that story.
Preserve their full horizon, prominence, ordering and existing layout; do not crop
the chart to recent results or collapse the map to make room for other content.

## Tokens

Screen colours are CSS variables in `src/report-theme.css`, embedded **last** in
`style#stil` by `scripts/embed-report-theme.cjs`. The entire layer is inside
`@media screen`. The earlier base stylesheet remains for print compatibility.
The dark theme redefines tokens under `prefers-color-scheme: dark` and under
`:root[data-theme="dark"]`. Use variables rather than per-screen colour literals.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--marka-koyu` | `#213D40` | `#E8F1ED` | headings, brand, headline |
| `--marka` / `--vurgu` | `#168D7D` / `#11766A` | `#76CFB9` | chart accent / interactive accent |
| `--vurgu-uzeri` | `#FFFFFF` | `#102C28` | text on filled accent buttons and selected controls |
| `--alan-cizgi` | `#7D9390` | `#7E9C96` | identifiable input boundaries, separate from decorative card borders |
| `--marka-acik` / `--vurgu-yumusak` | `#E6F2EC` | `#213F3B` | selected rows, soft buttons, highlights |
| `--zemin` / `--kagit` | `#F6F5F0` / `#FFFFFF` | `#101E20` / `#1A2D30` | page / cards |
| `--murekkep` / `--soluk` / `--cizgi` | `#213D40` / `#586E70` / `#D9E2DE` | `#E8F1ED` / `#AFC3BD` / `#344C4B` | text / secondary text / borders |
| `--iyi` / `--uyari` / `--kritik` | green / amber / red | lighter tints | status only, never decoration |
| `--il-koyu` / `--il-mavi` | dark teal / teal | pale teal / teal | the cap-and-books drawing |

The interactive accent is darker than the report's chart accent so white button
labels meet 4.5:1 contrast. Secondary text meets 4.5:1; input boundaries meet 3:1.
Decorative borders stay quieter. Status colours retain distinct meanings.

Dashboard `--e-*` tokens bridge to these same variables, including explicit and
system themes. Use shared `.et-panel`, `.et-ozet-kart`, `.et-seg` and `.et-dugme`
components. Headings and figures use the same sans-serif family throughout.
Cards use 18–20 px radii and 20–24 px padding; narrow screens use 16–18 px padding.
Keep gaps between cards and padding at their edges consistent.

Charts retain distinct series and semantic positive/negative colours. Do not
override SVG children globally: report SVGs, multi-series charts and the school's
Excel sheet have intentional presentation attributes. Report SVGs and generated
PDFs keep their exact palette, fonts and A4 dimensions. The Excel sheet retains
its original paper appearance within the themed workspace.

Use `--vurgu-uzeri` for every filled accent selection, including result ratings and
the plan editor's type/scope controls. Do not override text colors with selectors
that behave differently for system and explicit themes. Placeholders use `--soluk`.

The login screen and Settings offer System / Light / Dark (`Sistem / Açık / Koyu`).
The preference is stored only on the device (`yks_gorunum`); it is not part of the
student notebook or cloud payload. Switching themes updates the root without
redrawing the page or losing unfinished inputs. System mode removes the override
and follows subsequent OS changes. The existing full device-data cleanup also
clears this preference. Ordinary buttons use flat surfaces, with a brief border
transition disabled for reduced-motion users.

## One visual language across pages

- **A ders has one colour everywhere.** `GRAFIK_RENK.ders(name)` (src/grafik.js) maps every name a page uses for a
  ders ("Matematik", "MATEMATİK-T", "MAT", "AMAT") to the same series token, so Türkçe is the same colour on Deneme
  panosu, Türkiye geneli, Etütler and Etüt etkisi. TYT and AYT versions of a ders share it. There are twelve series
  tokens (`--e-c1` … `--e-c12`), so the twelve AYT dersler never share a colour. Pages must not assign ders colours by
  list position.
- **Status colours are the site's.** Yoklama's Gelmedi / Geç geldi / Raporlu / Diğer use `--kritik`, `--uyari` and the
  report blue and green, not a palette of their own.
- **Charts say what their marks mean.** The student's exam chart has round axis values (1, 2, 2,5 or 5 × 10^k),
  dates as "24 Eyl" like the teacher's boards, and a key under it for the dot colours, the dashed average and the
  target. An axis never shows a value the measure cannot have (a TYT chart ends at 120).
- **A comparison that is not established has no verdict colour**: estimated Türkiye values and teacher effects whose
  interval includes zero are printed plainly (docs/ogrenci-karti.md, docs/etut-etkisi.md).
- **Older teacher pages use the board components**: Haftalık öğrenci takibi and Öğrenciler are card lists with compact
  rows and the theme's inputs.
- **The filter bar of a board stays in view** under the top bar on wide, tall screens (≥ 1100 × 760), so the scope of
  a long page is always visible and changeable.

## Type

- Headings, the brand, numbers and body use Arial / Segoe UI / system sans; no web
  font is required. Headings and key figures use weight 700; body text stays 15 px.
- Numbers use tabular figures without switching to a monospace typeface.
- Printed plans keep their own black-and-white stylesheet (`yazdirCSS`). Theme
  colours never reach paper.

## Start screen

`gorunumKurulum()` draws, top to bottom:

1. **YKS {year}**. The year comes from the YKS date in the settings.
2. "Hedefine bir adım daha yaklaş"; the extra product-promise sentence is hidden
   by the screen theme.
3. The student login, open by default. One form serves both kinds of student: a
   Kaydol account (user name + password) and a school student (name + school
   number). See docs/kaydol.md.
4. Under the login button, "Rehber öğretmeniyim" on its own row, then "Kaydol" and
   "Test hesabı aç" side by side. Teacher access uses a quieter, unfilled treatment.
5. The cap-and-books drawing.
6. One folded "Yedekten geri yükle" link. It opens the file picker and the paste
   option.

The login card is at most 400 px wide, with persistent visible labels and 16 px
input text. Inputs are at least 46 px high and buttons at least 44 px. The sign-up
card follows the same rules. Placeholders remain as examples without replacing labels.

- The second input is a password field (no number spinner). An eye button inside it
  on the right shows or hides the text (`sifreKutusu`, `data-sifre-goster`, with
  `aria-pressed` and "Şifreyi göster/gizle"). The browser's own reveal button is hidden.
- Enter in either input submits.
- After a failed login, the button splits into two equal halves (`.giris-dugmeler.bolunmus`):
  "Giriş yap" stays primary on the left, and "Parolamı unuttum" on the right opens a popup
  (`parolaPenceresi`, see docs/kaydol.md).
- "Kaydol" swaps the card for the sign-up card (`kaydolKarti`): user name, password
  (same eye button) and field, then "Kaydol ve başla" and "Girişe dön".

The whole column is centred vertically. The gaps between headline, login, drawing and
link are flexible spacers (`.giris-ara`). They grow only into free space, and only up
to a cap (30→130, 30→130 and 22→52 px), so a tall screen opens the layout up a little.
The gaps above and below the login card are equal. The drawing's viewBox starts at
the tip of the cap, so the visible gap is the spacer itself.
When the column is shorter than the screen, the space above and below is equal. When it is taller (short laptops, phones), it scrolls from a
small top margin that still clears the corner bands.

The status line under "Giriş yap" stays empty until there is an error or progress
message.

## No explanatory text

Working screens stay concise: no page subtitles that describe the page, no "how it
works" paragraphs and no redundant hints under fields. What stays:

- data (counts, dates, names, totals), labels and headings;
- chart legends that identify different series;
- status and error messages, and a short line where a choice has a consequence (for
  example, "Buluttakini aç" discards unsaved changes on this device);
- one-line steps a feature cannot be used without (the AI timetable and paper-plan
  import);
- warnings in the confirmation dialogs of destructive actions;
- the opt-in "Nasıl seçilir?" help in Sonuç gir.

The screen theme removes the long dashboard header narratives, duplicate KPI
footnotes, prose chart summaries and repeated equations. Headings, primary values
and change badges provide the hierarchy. Field labels, chart legends that identify
different series, dates, student identity, empty states and errors stay visible.
Use specific selectors; `.mini` is also used for essential labels and actions and
must never be hidden globally. Number displays use Arial, with bold headline
values and tabular digits, including the plan's row numbers. Print keeps its own
type and text rules.

Background that some people still need moves into a hover title instead of text on
the page. Examples: the teacher settings descriptions (the dotted-underlined setting
name), the weekly minute cap's PISA source, and "Kayıt ulaşmadı" in the activity
list.

The corner bands, dot grids and drawing are inline SVG (`GIRIS_SUSLER`,
`GIRIS_CIZIM`). They are coloured by the tokens, decorative only (`aria-hidden`), and
never placed over a control. The browser test checks that each control is the top
element at its own centre. While no role is chosen, the menu is empty and hidden,
and the start screen spans the full width (`.kabuk:has(>.ray:empty)`).

## Student navigation and home

Students and teachers both get a top bar (`.ray.ust`), built by `ustMenu` from
`MENU_OGRENCI` / `MENU_REHBER`. The teacher layout is described in the next section.

- **YKS Tekrar Defteri** (the brand) is a button that opens the home page (`'ana'`).
  On phones (≤480 px) it shortens to "YKS".
- **Planım ▾**: "Planım" opens the weekly plan. The arrow opens Hafızam (recall per topic against the target line, see docs/student-flow.md), Haftalar haritası
  and Sonuç gir (`PLAN_ALT_SEKMELER`). Geçmiş plan kurtar opens from a red week on the
  map; there is no Karnem (its FSRS course calibration moved to Ayarlar). Hovering opens it
  with a mouse (`@media (hover:hover)`), a click toggles it on touch screens, and it
  opens on keyboard focus. Esc or a click elsewhere closes it, and so does choosing
  a page. The group is highlighted while one of its pages is open.
- **Denemelerim** follows Planım. **Müfredat** and **Ayarlar** sit on the right.
  A thin divider separates them from "Kaydet ve çıkış yap", and the save status
  follows on one line (cut short with an ellipsis rather than wrapping).
- At ≤820 px, **Diğer** groups Müfredat, Ayarlar and logout in a right-aligned
  dropdown; desktop keeps them visible. Primary destinations remain on the top
  bar, with save status on a compact second line. The bar can wrap on very narrow
  screens rather than overflow, and the account dropdown stays within the viewport.

Result-entry rating buttons have 44 px targets. The save action remains reachable
in a sticky footer inside the results card, and secondary mobile actions also have
44 px targets. Help links and SVG week arrows use the same visual language as the
other controls; week arrows have explicit accessible names.

After login, students land on the home page (`gorunumAnaSayfa`, tab `'ana'`). It
shows the weeks map, and for a YKS student the **Deneme gelişimi** chart beside it.
Both headings are links: "Haftalar haritası" opens the map page (the map alone, also
in the Planım menu) and "Deneme gelişimi" opens Denemelerim. On hover or focus they
turn teal, are underlined and show "→".

- The two cards have equal widths and equal heights, with a 24 px gap on desktop
  and the same rounded surface and quiet border. Both headings sit on one row.
- The week boxes are more compact here. The chart redraws to the card's free area
  (`denemeYolSigdir`), so it fills the card. Its drawing follows the measured width,
  with text scaled up to 1.35× on wide cards, so labels keep a steady size from phone
  to large monitor.
- Above the chart, a **TYT · AYT · Branş** control picks what is drawn. Branş adds a
  course list. Each choice has its own axis and target (see docs/mock-exams.md).
- At ≥1700 px the page widens to `min(1880px, 94vw)`, and the week boxes, their text
  and the headings grow.
- In a single column (≤1100 px) the chart moves above the map and keeps a 480:300
  shape.

## Teacher navigation and home

The teacher bar (`.ray.ust.rehber`) uses the same groups and dropdowns as the
student's: the group name opens its page, the arrow opens the related pages.

- **Haftalık plan ▾**: Sonuç girişi, Haftalar haritası.
- **Öğrenciler ▾**: Haftalık öğrenci takibi.
- **Denemeler ▾**: Sıralamalar, Türkiye geneli, Konu Takibi, **Öğretmen raporu** (docs/ogretmen-raporu.md), Yanlışlar defteri, Üniversite Hedefi.
- **Müfredat** and **Ayarlar** on the right, then "Kaydet ve çıkış yap" and the
  two-line status. On phones (≤520 px) the logout button reads "Çıkış" (its
  accessible name stays "Kaydet ve çıkış yap").
- Pages outside the menu mark where they open from (`MENU_BAGLI`): a class's
  curriculum and Konular mark Müfredat; Geçmiş plan kurtar marks Haftalar haritası.
- **Öğrenci ara** (`#ustAra`, between the menu and Müfredat) lists every student of
  the school lists (name · class · number); choosing one, or typing a number or a
  part of one name and pressing Enter, opens that student's Öğrenci kartı and
  empties the field. "/" outside a field moves the cursor into it, Esc leaves it.
  A text that names nobody (or several students) shows a notice. The field is only
  there when school lists are loaded, never for a student or in öğrenci gözüyle,
  and is hidden below 380 px. While the cursor is in it the bar is not redrawn
  (only the status text is refreshed), so the typed text and the open list stay.
- Below 1340 px the brand shortens to "YKS" and the gaps narrow. Below 1130 px the
  status moves to its own line under the menu. On phones the bar is two rows plus the
  status line (the search shares the second row). A dropdown near the right edge
  opens leftwards (`menuSigdir`), so it stays on screen.

After login, after opening a cloud notebook (own, view-only or co-teacher) and on
the brand, teachers land on the home page (`gorunumRehberAna`, tab `'ana'`). Like
the student home, it has two cards with linked headings, and under them the
**Dikkat** card (who needs attention; see below):

- **Bu hafta** (opens Haftalık öğrenci takibi). It shows the calendar week and
  **n/N Plan verildi** (this week's plan was saved, or a plan was printed this week;
  `planVerildiMi`), then only the names of the students given this week's plan, A–Z,
  in columns. Haftalık öğrenci takibi counts "Plan verildi" the same way (first card,
  a column and a filter), and the heading opens it on this week with no filter. A name opens the student's view. There
  are no classes and no "Karar bekleyen". Below the names, in small grey text: PDF
  istedi (this week's activity) and Geçen haftanın sonucu (a result in the student's
  previous plan week). The card refreshes live as student activity arrives.
  "E-posta talepleri (n)" sits beside the heading while requests wait.
- **Deneme ortalaması** (opens Denemeler). It is drawn the same way as the student's
  progress chart, and each point is one school exam (imported from PDF), averaged
  over the students who took it. TYT · AYT picks the exam type. AYT adds SAY · EA ·
  SÖZ and averages only the students of that field. Grades never mix: the chart shows
  one grade at a time (12 by default); "Sınıf" appears when more than one grade has
  school exams. A student's grade is `sinif`, else the class name ("11/A"), else 12.
  "Şube" narrows it to one class of that grade.
  **Grup** draws the average of the top or bottom 20, 40 or 60 % instead of everyone:
  *Her denemede* ranks the students within each exam; *Genel ortalamaya göre* ranks
  them once by their average over the shown exams and keeps that group. **Hedef**
  sets the teacher's target line (only teachers see it; `D.denemeOrtHedef`, per exam
  type and grade: `TYT`, `AYT:SAY` for grade 12, `11:TYT` for others; a class override
  otherwise shows its grade's target). A point
  opens Denemeler with that exam type. The same chart opens the teacher's Denemeler
  page, above the selected student's exams.
- In a single column (≤1100 px) the week card comes first, then the chart.

A student's name anywhere in the teacher pages opens that student's own screens in an
isolated frame ("Öğrenci gözüyle"). See docs/ogrenci-gozuyle.md.


### Dikkat (the teacher's home)

`ANALIZ.dikkat(bugun, ek)` lists the students who need attention, most pressing
first, and `ANALIZ.dikkatKarti` draws them under the two cards (`#rehberDikkat`):
the name (opens Öğrenci kartı), the class, and one chip per flag. A chip is a
button: pressing it shows the reasoning (also its `title`). The heading counts the
students, the line under it counts them per kind, eight rows are shown before
**Tümünü göster (n)**, and the foot says which sources there are to look at
(✓ Denemeler · Türkiye listesi (son deneme) · Yoklama · Konu Takibi · Türkiye’ye
göre), so a missing flag is never mistaken for "no problem".

Every rule uses real figures only and can be explained in one sentence:

| Flag | Rule | Weight |
|---|---|---|
| **Beklenenden düşük** (`dusus`) | On the last exam of her grade in a measure (TYT, AYT · alan) her standing is below the one-sided 95 % prediction interval of her previous three to five exams (mean − t·s·√(1+1/n); t = 2,920 / 2,353 / 2,132 for 3 / 4 / 5 exams) **and** at least 4 net below their mean. Her standing is her net against the Türkiye average, so the figure is the card's **Beklenenden**. | 3 |
| **N denemedir geriliyor** (`gerileme`) | Her standing fell on each of her last three exams, 4 net or more in all. | 3 |
| **Devamsızlık** (`devamsiz`) | 3 or more missed days in the last 30 (Yoklama's rule for a missed day). | 2, from 6 days 3 |
| **Konuda geride** (`konu`) | 3 or more topics in which she is at least one question behind what the Türkiye students got right and outside the one-sided 95 % band of chance: z = (d − b)/√(n·p̄(1−p̄)) ≤ −1,645 with b the Türkiye expectation, p̄ = b/n (never smaller than the true spread, so the test is cautious). Needs the Performans analizi in Konu Takibi. | 1 |
| **Geçen haftanın sonucu yok** (`sonuc`) | She was given a plan last week and entered no result in it (`rehberDikkatEkleri`, from the notebook). | 1 |

- A **tahmini** Türkiye average never raises a flag. When the last exam has no
  Türkiye list (or one of the three falling exams has none), her standing is her
  net minus the school mean of the exam for every exam of the rule, and the chip
  says "(okula göre)".
- A student who did not sit her grade's last exam gets no exam flag: there is
  nothing new to say about her.
- The prediction interval makes the rule fair to a student whose nets swing: a
  fall inside her own usual swing is not a flag, the same fall for a steady
  student is (Hahn & Meeker, *Statistical Intervals*).
- Rows are ordered by the sum of the weights, then the number of flags, then the
  name. A student who is only in the notebook (not in the school lists) gets her
  own row; her name opens öğrenci gözüyle.
- The exam, Yoklama and Konu Takibi flags are cached with `ANALIZ.kaynak` (same
  signature); the notebook's flags are added on every draw and never cached.
  Nothing is stored in the notebook. Teachers only.

## Ayarlar

Three sections, as a segmented control under the title (`ayarBolumu`):

- **Genel**: the settings table, save, backups and cloud. "İlk tekrar gecikmesi" says
  under it which students still use it (see docs/student-flow.md).
- **Ders programı** (when there is a class): AI ile aktar (no coloured outline; with Gemini
  available it starts with **Fotoğraf / PDF’ten oku**, see docs/yapay-zeka.md), the
  weekly timetable, **Tatiller** (the school holidays; add and remove) and **Haftalık
  konular**, one button per class to its Özel tasarlanmış müfredat.
- **Öğrenci kalibrasyonu**: the course profiles (FSRS calibration per student and
  course), with "Önerilir" where a course has enough results, and the student's
  first-review delay.

Leaving Genel with unsaved changes asks first. See docs/okul-takvimi.md for holidays.

The menu's Ayarlar always opens at Genel (students: Gelişmiş ayarlar folded). The old
`program` page name opens Ders programı; a student who sets up without a ready class
timetable lands there, inside the opened Gelişmiş ayarlar. Ders programı and Konu planı
step through school weeks (Monday), not the student's own week. On a phone the section
buttons wrap their labels instead of widening the page.

## Müfredat (teacher)

One page at the top right, with two tabs:

- **Tasarlanmış müfredatlar**: one row per class (from students, timetables and
  existing plans): class, grade, fields, students, and the size of its curriculum.
  A row opens that class's curriculum, titled **Özel tasarlanmış müfredat** (the
  former Konu planı: topics per course and week, add / delete / move / extend). It
  links back to Müfredat and to **Konular ve işleniş tarihleri** (the former Konular
  page). **+ Kendi müfredatını tasarla** creates a curriculum for a class code from
  the MEB suggestion for a grade and field, or as a copy of another class's; a class
  without students keeps the chosen grade (`D.mufredatSinif`). A view-only teacher
  sees the list without the button.
- **MEB müfredatı**: the official programme per grade (what students see as Müfredat).

## Weeks map colours (teacher)

The same rule as the student map: a past week whose plan was saved (printed or
downloaded; `elle.sabit`) but has no result is **grey** and offers **Nasıl geçti?**; a
past week with no plan at all is **red** ("plan verilmedi") and offers **Planı
kurtar**, which opens past-plan recovery for that student and week. A grey week's tests still count
as İyi for the schedule (see docs/student-flow.md, "Missing results count as İyi").

## Printed agreement and routine

The weekly agreement ("Haftalık çalışma anlaşması") and the three routine boxes are
filled in by hand on the printout: fixed headings and empty lines on the screen
preview and on paper. There is no page to type them; text typed in older notebooks is
not printed.
