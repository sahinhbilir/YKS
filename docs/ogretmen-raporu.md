# Öğretmen raporu

**Denemeler ▾ → Öğretmen raporu** (rehber öğretmen only) gives every subject teacher one section: how the students they teach are doing in their subject against students across Türkiye, exam by exam, and which topics of the subject go well and which do not, measured on the same questions.

## Who reads it

The rehber öğretmen prints it (**Yazdır / PDF**) and hands each teacher their own sheets. The reader is a subject teacher who has never opened the app, does not know where the numbers come from or how they are worked out, and has no statistics vocabulary. So the PDF is the product, and it has to explain itself:

- every figure sits under a plain label and a line saying what it is (*Öğrencileriniz 14,3 net — 72 öğrencinin ortalaması*);
- every picture carries its own key and title, right beside it;
- the sheets say whom they cover, where the data comes from and how to read a sign and a colour (**Bu raporu okurken**);
- nothing is a symbol to decode: a topic behind on three exams running says *Son 3 denemede geride*, a difference too small to trust says *fark küçük; tesadüf olabilir*;
- no statistical term (z, anlamlılık, tasarım etkisi …) appears outside the folded appendix **Hesaplama ayrıntıları ve ham veriler**, where the formulas and every raw number stay available so that nothing is hidden. The appendix is printed only when it is open.

## What it never does

- **No class comparisons.** A teacher's students are the students of all the classes the teacher teaches the subject in, taken together. A class is never shown on its own and classes are never ranked against each other (the class names appear only to say whom the section covers).
- **No students.** No student is named, listed or ranked.
- **The only place shown** is the whole school's among Türkiye's schools, as the publisher's list prints it.
- **No teacher comparisons.** Each section is about one teacher; there is no league table.
- **No etüts.** The report is about the lessons a teacher gives in class. An etüt is a one-to-one session after school and is not part of it (Etütler and Etüt etkisi are the pages for those). The page does not read the etüt report or the student base at all.

## Where the data comes from

- **Teachers, subjects, classes:** the classes' weekly timetables in **Etüt planı** (`programlar`: day, time, lesson, teacher). A lesson is mapped to its exam subjects (`DERSLER`): Matematik → TYT and AYT Matematik; Türk dili ve edebiyatı → TYT Türkçe and AYT Edebiyat; Tarih → TYT Tarih, AYT Tarih-1 and -2; and so on. Lessons with no exam subject (Beden eğitimi, Rehberlik …) are left out. No timetable → the page says so and links to Etüt planı.
- **TYT or AYT, class by class:** the timetable decides. In a class, a lesson whose name gives its session (*TYT MATEMATİK*, *AYT MATEMATİK*) or is Türkçe (TYT by its name) takes that session's exam subject alone; a lesson that names none (*MATEMATİK*, *GEOMETRİ*, *FİZİK*, *TÜRK DİLİ VE EDEBİYATI*) takes the exam subjects no such lesson took. So:
  - TYT and AYT Matematik split between two teachers where the timetable splits them;
  - Geometri, Fizik and the other mixed lessons are TYT and AYT;
  - in an EA class with a Türkçe lesson, Türk dili ve edebiyatı is AYT Edebiyat; alone (other classes) it is TYT Türkçe and AYT Edebiyat, and a block lists only the classes that had data, so an SAY class does not appear under AYT Edebiyat.

  A subject a teacher teaches in one session only says so under their name: *Matematik (AYT) · 12/C*.
- **Nets:** the school's exam lists (Sıralamalar, through `ANALIZ.kaynak()`).
- **Türkiye average:** the publisher's Genel Net from the Türkiye geneli lists.
- **A kazanım with no topic is its own row.** Konu Takibi's built-in kazanım → topic map covers the 9th and 10th grade codes and Türkçe; an 11th or 12th grade kazanım (most of AYT) has a topic only if the teacher mapped it. The report asks `ogrenciFark` for `kazanim: true`, so such a kazanım is a row under its own name and every question of every exam is in the table. The 10th–12th grade **maths** topics (Polinomlar … Türev, İntegral, Çemberin Analitik İncelenmesi) are in the built-in map by their number in the **earlier** programme (`MEB_MAT`, read from the code whatever its prefix), which this year's 12th grade follows, so its AYT Matematik and Geometri group by konu. The 9th–11th grades follow the **new** programme, whose codes start with the ders in full (`MAT.11.1.1`) and whose numbers mean other topics: those are never read from the earlier list; an 11th grade code takes the unit that lists it in the app's curriculum (`MUFREDAT_2026`), and a code with no list stays a kazanım row. The other lessons of the earlier programme (Fizik, Kimya, Biyoloji, Tarih and İnkılap Tarihi, Çağdaş Türk ve Dünya Tarihi, Coğrafya, Din Kültürü, Felsefe, Mantık, Psikoloji, Sosyoloji, Türk Dili ve Edebiyatı) are in `ESKI`: unit names by grade.unit, and topic names by grade.unit.topic where a unit is broad (Fizik 11–12, Biyoloji İnsan Fizyolojisi). The ders comes from the publisher's course code; within Tarih and the Felsefe grubu, from the code's own prefix (ÇTD, MAN, PS, SOS). These lists were written from the 2018 programmes, not read from the publisher's files: a number not listed stays a kazanım row. (Before, these were dropped: an AYT Matematik block showed only the few 9th–10th grade questions of one exam, which read as TYT topics.)
- **Topics:** Konu Takibi: the students' kazanım reports, the exam summary (question → kazanım) and the publisher's **Performans analizi** (Türkiye's success rate per question). Without the Performans analizi the grid is replaced by a one-line note saying what to add.

Each teacher's subject is split by grade (an exam belongs to one grade) and by exam subject: one block per *TYT Matematik · 12. sınıf*, *AYT Matematik · 12. sınıf* …

**Sınıf düzeyi** shows one grade only (*12. sınıf*): its teachers, the classes of that grade under their names, its blocks, and the grade in the page title (also in print).

## A block

Top to bottom, the same on screen and on paper:

1. **What it covers:** the title (*TYT Matematik · 12. sınıf*) and one line: the classes taken together, the number of exams and the days they span (*12/A, 12/B, 12/C sınıfları birlikte · 12 deneme · 5 Eyl 2026 – 4 Oca 2027*).
2. **Takeaway:** one sentence saying whether the students are above or below Türkiye and whether the advantage or deficit grew or shrank since the preceding comparison. It names one repeat priority only when a topic was clearly behind on its last three measured exams (the first such row in the table), and says why: *Tekrar önceliği: Problemler (son 3 denemede Türkiye’nin gerisinde).* No Türkiye data means no claimed position or trend.
3. **Headline boxes**, for *Son karşılaştırılan deneme*: the newest exam that has a Türkiye list (if a newer exam has none, the line names it and says the comparison was made with the one before; nothing is filled in):
   - *Öğrencileriniz*: the students' mean net and how many students it is the mean of;
   - *Türkiye ortalaması*: the publisher's average in the same exam;
   - *Fark*: the difference, green and tinted above, red below, with the words *Türkiye ortalamasının üzerinde / altında*;
   - *Fark nasıl değişti?*: ▲/▼ against the exam before and against the first exam (named);
   - *Okulun Türkiye sırası*: the whole school's printed place in the subject's list (“İlk 100 dışı” outside it) with its move since the exam before (▲ green rose, ▼ red fell; outside the list counts as 101.). The place is the school's, never a class's or the teacher's, and is never estimated; it needs the school chosen on the Türkiye geneli page;
   - *İlk 100 sınırı*: how far above the Türkiye average the list's last row (the 100th school) stands in that exam: the list's own yardstick for the size of a gap, read from the printed list, not fitted.
4. **Net chart**, its key directly above it, two panels on one time axis, every value written on the chart (a printout has no tooltips):
   - *Ortalama net*: the students' mean net in the subject (solid, the subject's colour) and the Türkiye average (dashed), each point with its value. Mean net = the mean over the students whose net the list prints (a blank cell is not a 0 here);
   - *Türkiye ortalamasına göre fark (net)*: the distance between the two lines, a bar per exam from the Türkiye line (0), green above, red below, its value on it, on the gaps' own scale so that a change of a few tenths is still seen.

   The chart has those two series and their difference and nothing else: the İlk 100 yardstick is a labelled figure in the boxes (and per exam in the appendix), not a fourth line, because a line far above the bars flattened them into slivers.

   The horizontal axis shows exam names. Every exam is named when the names fit side by side (long names wrap, measured in pixels, never cut); with many exams the values and names are written on spaced points counted back from the newest, so they never overlap. Dates determine the order.
5. **Topic table** (*Konular: öğrencileriniz Türkiye’ye göre nerede?*): a row per topic, most behind first. Above it, what a box is and a worked example (*Türkiye’de %60, sizde %50 doğru cevapladıysa kutuda −10 yazar*), that the comparison is on the same questions, and that the rows run from most behind to most ahead. Each cell compares the students' correct answers d with the number students across Türkiye would get on **the same questions**, b = Σ p (the publisher's success rates of those questions):
   - **Konu:** the topic, and under it *Son 3 denemede geride / önde* when it was behind / ahead (beyond chance) on its last three measured exams in a row: a signal to change the approach, or to keep it;
   - **its kazanımlar** as smaller rows under it (`alt`): the kazanım's number and name, its average, and the same difference per exam in a smaller, inset box; ordered by number. A topic and its kazanımlar are one `tbody` and are not split across pages;
   - **Ortalama:** the mean of the topic's gaps over the exams that had a question on it, as a number and as a bar from the Türkiye line in the middle (left and red behind, right and green ahead). It is the figure the rows are ordered by, so the order explains itself;
   - **a column per exam** (equal widths, the exam's name on top): gap = 100 · (d − b) / n points (n: the students' answers to those questions), in whole points; a value that rounds to zero is written 0, never −0;
   - colour: **red** when behind, **green** when ahead, deeper with the gap (full at ±20 points); white text on the deepest cells. The sign is always written, so a black-and-white printout loses nothing;
   - **pale** when the gap is within chance: z = (d − b) / √(Σ n·p·(1 − p) · (1 + (q − 1)·0,2)) with |z| < 1,96 (summed over the students; p = b/n per student; one student's answers to the questions of one topic are taken as correlated, r = 0,2, so the band is widened by the design effect 1 + (q − 1)·0,2, q the topic's questions per student — the same assumption as Konu Takibi). On the page this is only *Soluk kutu: fark küçük; tesadüf olabilir*;
   - **·** the topic had no question that exam;
   - **İlk → son:** the topic's gap on its last measured exam minus on its first (points), ▲ green when it improved, ▼ red when it fell; descriptive, no chance test;
   - **Bütün konular** (last row, under a hairline): the whole subject on the same questions, exam by exam.

   Because b uses Türkiye's success on the same questions, a hard question does not paint a topic red on its own: if everybody found it hard, the expectation is low too. Under the table a key shows the four fills from *Türkiye’nin gerisinde* to *Türkiye’nin önünde* and says what dark, pale and the dot mean. Without the Performans analizi the section is a one-line note for the rehber on screen (what to add) and is left off the paper.
6. **Hesaplama ayrıntıları ve ham veriler** (folded): the rules above with their formulas, and the raw tables: per exam (students, mean net, Türkiye average, gap, the list's last row, the 1st school, the school's place) and per topic and exam (n, d, b, gap, z). The topic table is built when the box is opened (over all teachers it runs to thousands of rows).

## Use and print

- **Öğretmen** filters to one teacher (*Bütün öğretmenler* by default); **Sınıf düzeyi** to one grade.
- **Bu rapor nasıl okunur?** (folded, once, on screen) holds the reading notes that are printed with every teacher's sheets.
- **Yazdır / PDF** prints the shown teachers as one document: the whole school's report, one grade's, or one teacher's alone.
- Nothing is stored and nothing is sent; the page reads the notebook only.

### The paper (A4 landscape)

- **Each teacher's sheets stand alone.** A teacher starts a new page under a letterhead: *Öğretmen raporu* (with the grade when one is chosen) and the day it was printed, the teacher's name, the lessons and classes, and beside them **Bu raporu okurken**: *Kimleri kapsıyor?* (the classes the teacher teaches, as one group; no student, class or teacher comparison), *Veriler nereden geliyor?* (the school's exam result lists; the Türkiye average from the publisher's Türkiye geneli results for the same exams; nothing estimated), *Nasıl okunur?* (+ and green above the Türkiye average, − and red below; net gaps in net, topic gaps in percentage points).
- **A page per block.** The teacher's first block follows the letterhead; every further block starts its own page with the teacher's name beside its title.
- **Nothing is cut.** The takeaway, the boxes and the chart stay together; the topic table stays together (it usually takes the next sheet, with the block's and the teacher's name beside its heading, so a loose sheet says whose it is); a table too long for one page repeats its header and never splits a row. There is no empty or nearly empty page.
- **The table fits the page** whatever the number of exams: the name and the two summary columns keep their width, the exams share the rest; above twelve exams the names stand upright.
- **Its own palette and type**: dark ink on white, Arial, the subjects' colours fixed. The screen theme does not reach it, a dark one included, and every fill prints even with "background graphics" off.
- The page title, the toolbar, the screen's folded notes and a closed appendix are not printed. The charts are drawn again at the paper's width, so their values stay readable.

## Speed

The first version froze the browser on a real school: every block rebuilt Öğrenci raporları' student base, and that base copied every school list for every student and compared every etüt row with every student. Now:

- one page reads the school lists and Konu Takibi once and works out each exam's topic comparison once for all students; every block takes its classes' students from them;
- the page no longer builds the student base at all (it was needed only for the etüts);
- the charts read all their widths before drawing any (one layout instead of one per chart).

Measured while the page still read the etüts: on a synthetic school of 500 students, 14 weeks of lists and two etüts per student a week, it opened in under a second in Chromium. It now does less work than that (not measured again).

## Code and tests

`src/ogretmenrapor.js` (`OGRETMEN_RAPOR`), `src/ogretmenrapor.css`, embedded by `node scripts/embed-ogretmenrapor.cjs` (`--check` verifies).

- `node test/ogretmenrapor-regression.cjs`: teachers from the timetables (lessons without an exam subject left out); TYT / AYT class by class (a session-named lesson alone, an unmarked one the rest; Türkçe beside Edebiyat; mixed lessons both); Sınıf düzeyi; the labelled boxes (the yardstick and the school's place with its move, hand-worked) and what a block covers; every value written on the chart, the nets above their difference, the gap panel's own scale, no yardstick line; the headline's change, the table's first → last column; the mean net of a teacher's classes together against the Türkiye average (a blank is not a 0, another class is not counted, no list → no gap); the topic table with hand-worked d, b, gap and z (design effect), the run of three in words, the average bar's figure, the whole subject's row, the dot, no sign on a zero, the order; the colours; the page (reading notes with every teacher, the worked example and the key, formulas and raw rows folded, no student names, no figure per class, no ranking, no etüts, the teacher filter, the empty state); each source read once per page and the student base never; teacher only; nothing stored.
- `node test/buyuk-okul-regression.cjs`: a school-sized notebook through the app's own stores: the student base copies the lists once, not per student; a combined TYT+AYT list gives the TYT row TYT lessons and the AYT row AYT lessons; etüt rows reach the student of that name and class (the same name in two classes stays two students); the Öğretmen raporu never builds the base and has no etüts.
- `node test/ogretmenrapor-browser.cjs`: 1280 px light and 390 px dark: the sections, the boxes inside their row with their labels and values, the key above the chart, the charts at their box's width with full exam names that do not overlap, red behind and green ahead in the table, the average bar left or right of the Türkiye line, equal exam columns, no sideways scrolling (also with the appendix open), the raw topic table filled when its box opens, the values on the chart, the teacher and grade filters; and the paper: the letterhead and reading notes with each teacher, no toolbar or page title, nothing cut across pages and a page per further block, the table inside the page's width, dark ink on white under the dark theme too, the chart redrawn at the paper's width with the subject's colour, the cells' fills kept, and the PDF itself: A4 landscape, three sheets for the synthetic school (no empty sheet).

## Öğrenci raporu (Türkiye)

**Denemeler ▾ → Öğrenci raporu (Türkiye)** (rehber öğretmen only, `ogrencitr`, `OGRETMEN_RAPOR.gorunumOgrenci`) is the same report for one student, to hand to the student or their family: **Sınıf düzeyi → Şube → Öğrenci** (or every student of the şube, each on their own sheets). The student is found by the school number in the lists and in Konu Takibi (`netSerisi` / `konuIzgarasi` with `nolar`).

- A block per exam subject the student has nets or topic answers in, TYT before AYT (`ogrenciModeli`, `TUM_KODLAR`), with the same takeaway, boxes, chart, topic table with kazanımlar, and appendix.
- The words are the student's (`YAZI.ogrenci`): *Netin*, *Türkiye ortalamasının altındasın; önceki denemeye göre aradaki fark azaldı*, *Konular: Türkiye’ye göre neredesin?*, a reading note *Kimi kapsıyor? Yalnızca seni…*. No other student's name, no ranking.
- The school's place and the İlk 100 yardstick are about schools, so they are not on a student's report.
- With one student a topic has only a few questions an exam, so most cells are pale (within chance); the appendix says to read the direction from the dark cells and from a colour that repeats.
