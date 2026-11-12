# Öğretmen raporu

**Denemeler ▾ → Öğretmen raporu** (rehber öğretmen only) gives every subject teacher one section: how the students they teach are doing in their subject against students across Türkiye, exam by exam, and which topics of the subject go well and which do not, measured on the same questions. It is meant to be read at a glance. The pictures carry the message; the formulas and every raw number behind them fold out under **Nasıl hesaplanır · ham veriler** in each block, so a teacher can check that nothing is hidden.

## What it never does

- **No class comparisons.** A teacher's students are the students of all the classes the teacher teaches the subject in, taken together. A class is never shown on its own and classes are never ranked against each other (the class names appear only to say whom the section covers).
- **No students.** No student is named, listed or ranked.
- **No teacher comparisons.** Each section is about one teacher; there is no league table.

## Where the data comes from

- **Teachers, subjects, classes:** the classes' weekly timetables in **Etüt planı** (`programlar`: day, time, lesson, teacher). A lesson is mapped to its exam subjects (`DERSLER`): Matematik → TYT and AYT Matematik; Türk dili ve edebiyatı → TYT Türkçe and AYT Edebiyat; Tarih → TYT Tarih, AYT Tarih-1 and -2; and so on. Lessons with no exam subject (Beden eğitimi, Rehberlik …) are left out. No timetable → the page says so and links to Etüt planı.
- **Nets:** the school's exam lists (Sıralamalar, through `ANALIZ.kaynak()`).
- **Türkiye average:** the publisher's Genel Net from the Türkiye geneli lists.
- **Topics:** Konu Takibi: the students' kazanım reports, the exam summary (question → kazanım) and the publisher's **Performans analizi** (Türkiye's success rate per question). Without the Performans analizi the grid is replaced by a one-line note saying what to add.
- **Etüts:** the etüt report (Etütler), through the student report's shared base.

Each teacher's subject is split by grade (an exam belongs to one grade) and by exam subject: one block per *TYT Matematik · 12. sınıf*, *AYT Matematik · 12. sınıf* …

## A block

1. **Headline:** *Son deneme · Türkiye’ye göre* in net (green above, red below), for the newest exam that has a Türkiye list; an exam whose list has not come yet is skipped, never filled in.
2. **Net chart:** the students' mean net in the subject (solid, the subject's colour) and the Türkiye average (dashed) exam by exam; between them a bar, green where the students are above, red where below. Mean net = the mean over the students whose net the list prints (a blank cell is not a 0 here).
3. **Topic grid** (*Konular · Türkiye ile aynı sorularda*): a row per topic, a column per exam. Each cell compares the students' correct answers d with the number students across Türkiye would get on **the same questions**, b = Σ p (the publisher's success rates of those questions):
   - gap = 100 · (d − b) / n points (n: the students' answers to those questions);
   - colour: **red** when behind, **green** when ahead, deeper with the gap (full at ±20 points); white text on the deepest cells;
   - **pale** when the gap is within chance: z = (d − b) / √(Σ n·p·(1 − p) · (1 + (q − 1)·0,2)) with |z| < 1,96 (summed over the students; p = b/n per student; one student's answers to the questions of one topic are taken as correlated, r = 0,2, so the band is widened by the design effect 1 + (q − 1)·0,2, q the topic's questions per student — the same assumption as Konu Takibi);
   - **▼▼▼ / ▲▲▲** at the end of a row: behind / ahead (beyond chance) on the last three measured exams in a row: a signal to change the approach, or to keep it;
   - rows are ordered most behind first; each column's head carries the whole subject's gap that exam; hatched cells: the topic had no question that exam.
   Because b uses Türkiye's success on the same questions, a hard question does not paint a topic red on its own: if everybody found it hard, the expectation is low too.
4. **Etüt:** the teacher's etüt attendances in the subject (rows of the etüt report: one student at one etüt) and the number of students. The arrow shows those students' mean gap to the Türkiye average in the subject on their last exam on or before their first etüt with the teacher → on their latest exam (only students with both). It is descriptive: everything else the students did also moves it. An etüt belongs to the session its course names (“MATEMATİK TYT”, “AYT FİZİK”); one that names none counts with TYT, so nothing is counted twice.
5. **Nasıl hesaplanır · ham veriler:** the rules above in plain words, and the raw tables: per exam (students, mean net, Türkiye average, gap) and per topic and exam (n, d, b, gap, z). The topic table is built when the box is opened (over all teachers it runs to thousands of rows).

## Use and print

- **Öğretmen** filters to one teacher (*Bütün öğretmenler* by default).
- **Yazdır / PDF** prints every shown teacher on their own page (no toolbar; colours kept), so the whole school's report is one document, or one teacher's alone.
- Nothing is stored and nothing is sent; the page reads the notebook only.

## Speed

The first version froze the browser on a real school: every block rebuilt Öğrenci raporları' student base, and that base copied every school list for every student and compared every etüt row with every student. Now:

- one page builds the student base once, reads Konu Takibi once and works out each exam's topic comparison once for all students; every block takes its classes' students from them;
- the student base (shared with Öğrenci raporları, Etüt etkisi and the teacher home page) copies the school lists only when they changed (`DPANO.veriAl`), works out a list's columns once per list and session (`denemeListeSutunlari`), and finds an etüt row's student among the students of that name (`merge`);
- the charts read all their widths before drawing any (one layout instead of one per chart).

On a synthetic school of 500 students, 14 weeks of lists and two etüts per student a week, the page opens in under a second in Chromium.

## Code and tests

`src/ogretmenrapor.js` (`OGRETMEN_RAPOR`), `src/ogretmenrapor.css`, embedded by `node scripts/embed-ogretmenrapor.cjs` (`--check` verifies).

- `node test/ogretmenrapor-regression.cjs`: teachers from the timetables (lessons without an exam subject left out); the mean net of a teacher's classes together against the Türkiye average (a blank is not a 0, another class is not counted, no list → no gap); the topic grid with hand-worked d, b, gap and z (design effect), the run of three behind / ahead, the order and the exam column; the colours; the etüts (each once, by session; before → after); the page (formulas, raw rows, no student names, no figure per class, no ranking, the teacher filter, the empty state); each source read once per page; teacher only; nothing stored.
- `node test/buyuk-okul-regression.cjs`: a school-sized notebook through the app's own stores: the student base copies the lists once, not per student; a combined TYT+AYT list gives the TYT row TYT lessons and the AYT row AYT lessons; etüt rows reach the student of that name and class (the same name in two classes stays two students); the report builds the base once.
- `node test/ogretmenrapor-browser.cjs`: 1280 px light and 390 px dark: the sections, the charts at their box's width, red behind and green ahead in the grid, no sideways scrolling (also with the formulas open), the raw topic table filled when its box opens, the filter, and the print layout (one teacher per page, no toolbar).
