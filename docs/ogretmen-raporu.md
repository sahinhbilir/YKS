# Öğretmen raporu

**Denemeler ▾ → Öğretmen raporu** (rehber öğretmen only) gives every subject teacher one section: how the students they teach are doing in their subject against students across Türkiye, exam by exam, and which topics of the subject go well and which do not, measured on the same questions. It is meant to be read at a glance. The pictures carry the message; the formulas and every raw number behind them fold out under **Nasıl hesaplanır · ham veriler** in each block, so a teacher can check that nothing is hidden.

## What it never does

- **No class comparisons.** A teacher's students are the students of all the classes the teacher teaches the subject in, taken together. A class is never shown on its own and classes are never ranked against each other (the class names appear only to say whom the section covers).
- **No students.** No student is named, listed or ranked.
- **The only place shown** is the whole school's among Türkiye's schools, as the publisher's list prints it.
- **No teacher comparisons.** Each section is about one teacher; there is no league table.

## Where the data comes from

- **Teachers, subjects, classes:** the classes' weekly timetables in **Etüt planı** (`programlar`: day, time, lesson, teacher). A lesson is mapped to its exam subjects (`DERSLER`): Matematik → TYT and AYT Matematik; Türk dili ve edebiyatı → TYT Türkçe and AYT Edebiyat; Tarih → TYT Tarih, AYT Tarih-1 and -2; and so on. Lessons with no exam subject (Beden eğitimi, Rehberlik …) are left out. No timetable → the page says so and links to Etüt planı.
- **TYT or AYT, class by class:** the timetable decides. In a class, a lesson whose name gives its session (*TYT MATEMATİK*, *AYT MATEMATİK*) or is Türkçe (TYT by its name) takes that session's exam subject alone; a lesson that names none (*MATEMATİK*, *GEOMETRİ*, *FİZİK*, *TÜRK DİLİ VE EDEBİYATI*) takes the exam subjects no such lesson took. So:
  - TYT and AYT Matematik split between two teachers where the timetable splits them;
  - Geometri, Fizik and the other mixed lessons are TYT and AYT;
  - in an EA class with a Türkçe lesson, Türk dili ve edebiyatı is AYT Edebiyat; alone (other classes) it is TYT Türkçe and AYT Edebiyat, and a block lists only the classes that had data, so an SAY class does not appear under AYT Edebiyat.

  A subject a teacher teaches in one session only says so under their name: *Matematik (AYT) · 12/C*.
- **Nets:** the school's exam lists (Sıralamalar, through `ANALIZ.kaynak()`).
- **Türkiye average:** the publisher's Genel Net from the Türkiye geneli lists.
- **Topics:** Konu Takibi: the students' kazanım reports, the exam summary (question → kazanım) and the publisher's **Performans analizi** (Türkiye's success rate per question). Without the Performans analizi the grid is replaced by a one-line note saying what to add.
- **Etüts:** the etüt report (Etütler), through the student report's shared base.

Each teacher's subject is split by grade (an exam belongs to one grade) and by exam subject: one block per *TYT Matematik · 12. sınıf*, *AYT Matematik · 12. sınıf* …

**Sınıf düzeyi** shows one grade only (*12. sınıf*): its teachers, the classes of that grade under their names, its blocks, and the grade in the page title (also in print).

## A block

1. **Short takeaway and headline:** a sentence above the chart says whether the students are above or below Türkiye and whether the advantage or deficit grew or shrank since the preceding comparison. It names one repeat priority only when a topic was clearly behind on its last three measured exams (the first such row in the grid). No Türkiye data means no claimed position or trend. *Son karşılaştırma · Türkiye’ye göre* gives the gap in net (green above, red below), for the newest exam that has a Türkiye list; if a newer exam has no Türkiye figure, a short note says so. Under it, how that gap moved: ▲/▼ against the exam before and against the first exam. Then the list's own yardstick in the same exam, *İlk 100 sınırı: Türkiye ortalaması +6,5 net* (how far above the Türkiye average the list's last row, the 100th school, stands), and *Okulun Türkiye sırası (tüm okul)*: the whole school's printed place in the subject's list in the newest exam with a list (“İlk 100 dışı” outside it), with its move since the exam before (▲ green rose, ▼ red fell; outside the list counts as 101.; “40. → dışı”). The place is the school's, never a class's or the teacher's, and is never estimated; it needs the school chosen on the Türkiye geneli page.
2. **Net chart**, two panels on one time axis, every value written on the chart (a printout has no tooltips):
   - *Türkiye’ye göre fark (net)*: a bar per exam from the Türkiye line (0), green above, red below, its value on it, and a dashed purple line, **İlk 100 sınırı**: where the list's last row stood against the Türkiye average in that exam, its value written at the newest exam. It is the list's own scale for a gap (something like a spread, read from the printed list, not fitted): a bar that reaches the line means the students' mean is as far above the Türkiye average as the 100th school. The scale covers the gaps and the line;
   - *Ortalama net*: the students' mean net in the subject (solid, the subject's colour) and the Türkiye average (dashed), each point with its value. Mean net = the mean over the students whose net the list prints (a blank cell is not a 0 here).

   The horizontal axis shows exam names, with long names wrapped onto multiple lines. With many exams the values and names are written on spaced points counted back from the newest, so they never overlap. The topic grid's column headers and the first-exam comparison also use exam names; dates still determine the order.
3. **Topic grid** (*Konular · Türkiye ile aynı sorularda*): a row per topic, a column per exam. Each cell compares the students' correct answers d with the number students across Türkiye would get on **the same questions**, b = Σ p (the publisher's success rates of those questions):
   - gap = 100 · (d − b) / n points (n: the students' answers to those questions);
   - colour: **red** when behind, **green** when ahead, deeper with the gap (full at ±20 points); white text on the deepest cells;
   - **pale** when the gap is within chance: z = (d − b) / √(Σ n·p·(1 − p) · (1 + (q − 1)·0,2)) with |z| < 1,96 (summed over the students; p = b/n per student; one student's answers to the questions of one topic are taken as correlated, r = 0,2, so the band is widened by the design effect 1 + (q − 1)·0,2, q the topic's questions per student — the same assumption as Konu Takibi);
   - **▼▼▼ / ▲▲▲** at the end of a row: behind / ahead (beyond chance) on the last three measured exams in a row: a signal to change the approach, or to keep it;
   - **İlk → son:** the topic's gap on its last measured exam minus on its first (points), ▲ green when it improved, ▼ red when it fell; descriptive, no chance test;
   - rows are ordered most behind first; each column's head carries the whole subject's gap that exam; hatched cells: the topic had no question that exam.
   Because b uses Türkiye's success on the same questions, a hard question does not paint a topic red on its own: if everybody found it hard, the expectation is low too.
   The explanation above the grid says these are the average percentages of students who answered the topic's questions correctly: if 60% answered correctly across Türkiye and 50% in the teacher's group, the table shows −10 (10 percentage points behind). Below it, a compact visible legend explains +/−, pale cells, the three arrows and hatching; these explanations also appear in print and do not depend on hovering. Pale cells say the difference is not yet clear under this calculation, rather than treating the assumed statistical model as certain.
4. **Etüt:** the teacher's etüt attendances in the subject (rows of the etüt report: one student at one etüt) by students of the block's grade, and the number of those students. The arrow shows their mean gap to the Türkiye average in the subject on their last exam on or before their first etüt with the teacher → on their latest exam (only students with both). It is descriptive: everything else the students did also moves it. Etüts are not split into TYT and AYT the way classes are: an etüt whose name gives a session (“MATEMATİK TYT”, “AYT FİZİK”) counts in that block; one that names none counts in each of the teacher's blocks of the subject (TYT and AYT), and the block says how many such etüts it counted.
5. **Nasıl hesaplanır · ham veriler:** the rules above in plain words, and the raw tables: per exam (students, mean net, Türkiye average, gap, the list's last row, the 1st school, the school's place) and per topic and exam (n, d, b, gap, z). The topic table is built when the box is opened (over all teachers it runs to thousands of rows).

## Use and print

- **Öğretmen** filters to one teacher (*Bütün öğretmenler* by default).
- **Yazdır / PDF** prints every shown teacher on their own page (no toolbar), so the whole school's report is one document, one grade's, or one teacher's alone. In print: the subjects' colours are the page's own (the screen theme's do not reach print), every fill prints even with "background graphics" off, the headline sits above the chart and the charts are drawn again at the paper's width, so their values stay readable.
- Nothing is stored and nothing is sent; the page reads the notebook only.

## Speed

The first version froze the browser on a real school: every block rebuilt Öğrenci raporları' student base, and that base copied every school list for every student and compared every etüt row with every student. Now:

- one page builds the student base once, reads Konu Takibi once and works out each exam's topic comparison once for all students; every block takes its classes' students from them;
- the student base (shared with Öğrenci raporları, Etüt etkisi and the teacher home page) copies the school lists only when they changed (`DPANO.veriAl`), works out a list's columns once per list and session (`denemeListeSutunlari`), and finds an etüt row's student among the students of that name (`merge`);
- the charts read all their widths before drawing any (one layout instead of one per chart).

On a synthetic school of 500 students, 14 weeks of lists and two etüts per student a week, the page opens in under a second in Chromium.

## Code and tests

`src/ogretmenrapor.js` (`OGRETMEN_RAPOR`), `src/ogretmenrapor.css`, embedded by `node scripts/embed-ogretmenrapor.cjs` (`--check` verifies).

- `node test/ogretmenrapor-regression.cjs`: teachers from the timetables (lessons without an exam subject left out); TYT / AYT class by class (a session-named lesson alone, an unmarked one the rest; Türkçe beside Edebiyat; mixed lessons both); Sınıf düzeyi; every value written on the chart, the gap panel's own scale, the headline's change, the grid's first → last column; the mean net of a teacher's classes together against the Türkiye average (a blank is not a 0, another class is not counted, no list → no gap); the topic grid with hand-worked d, b, gap and z (design effect), the run of three behind / ahead, the order and the exam column; the colours; the etüts (by session where the name gives one, in both blocks where it does not; the block's grade only; before → after); the page (formulas, raw rows, no student names, no figure per class, no ranking, the teacher filter, the empty state); each source read once per page; teacher only; nothing stored.
- `node test/buyuk-okul-regression.cjs`: a school-sized notebook through the app's own stores: the student base copies the lists once, not per student; a combined TYT+AYT list gives the TYT row TYT lessons and the AYT row AYT lessons; etüt rows reach the student of that name and class (the same name in two classes stays two students); the report builds the base once.
- `node test/ogretmenrapor-browser.cjs`: 1280 px light and 390 px dark: the sections, the charts at their box's width, red behind and green ahead in the grid, no sideways scrolling (also with the formulas open), the raw topic table filled when its box opens, the values on the chart, the teacher and grade filters, and print (one teacher per page, no toolbar, the chart redrawn at the paper's width with the subject's colour, the cells' fills kept).
