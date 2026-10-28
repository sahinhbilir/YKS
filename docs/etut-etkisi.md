# Etüt etkisi (guidance teacher)

The **Etüt etkisi** page asks one question of the school's own records: *how did every student progress through all their mock exams in a lesson, and how does that relate to the etüts of that lesson they took?* It sits in the teacher menu under **Öğrenciler**, after Etütler, and shares the Etütler look (`src/etutler.css`, root `#eeKok`).

## Where the data comes from

Nothing is added, stored or uploaded. The page reads the analysis base of **Öğrenci raporları** (`OGRENCI_RAPOR.temelOgrenciler()`): the merged students with their exam results (the net of every lesson) and their etüt sessions (date, lesson, teacher, from Etütler). The two are matched the way Öğrenci raporları matches them (student number, or name and class). The base leaves out attendance, homework and the timetables, so an unreadable Etüt planı or Yoklama does not stop the page; the merge warnings are shown on the page. The page never writes to the notebook and never reaches a student packet; the choices live in `EK.ee*` only (`eeDuzey`, `eeOturum`, `eeDers`, `eeDonem`, `eeHoca`).

If the exam lists or the etüt report are missing, the page says which page to add them on.

## How it is computed

- **The exams.** One grade (**Sınıf**) and one session (**Oturum**: TYT or AYT). **Dönem** is *Tümü* (every exam of the grade and session, the default) or *Son 4 deneme*. An exam is its title and its date: exams with the same title on different dates stay apart.
- **The lesson.** **Ders** lists the lessons that had an etüt in the period, most etüts first. An etüt's course is turned into a lesson the way Etütler does it (MATEMATİK TYT → Matematik). The lesson's net is the student's net in that lesson in each exam (AYT Coğrafya and Tarih add their two parts; AYT Türkçe is Edebiyat). A course named for one session counts for it only (“… TYT” for TYT, “… AYT” for AYT); a course with neither counts for both.
- **Progress of a student.** The least-squares line through all their nets in the lesson, with the exam's place in the period as the x, gives the **artış per exam** (net per exam). A missed exam in the middle keeps its place, so it does not bend the line. **Toplam artış** is that slope times the exams between the student's first and last exam. Students with at least two exams in the lesson are counted; the rest are listed apart with the reason (*yalnızca 1 denemeye girdi*, *bu dersin neti yok*).
- **Etüts of a student.** The etüts of the lesson between the first and the last exam day of the period; the days of those two exams are not counted. They sort the counted students into four fixed groups: *Etüt yok*, *1–2 etüt*, *3–5 etüt*, *6+ etüt*.
- **Groups.** For each group: the students, etüts per student, the mean first and last net, the mean progress per exam and in total. A group with fewer than 5 students is drawn faint and its size is written beside it.
- **Teachers.** Each teacher who gave the lesson in the period: the counted students who took it from them, etüts per student, their mean progress per exam and its difference from the class mean. Students who took the lesson from more than one teacher count for each; how many is written under the teacher's name.
- **Coverage.** Weekdays in the period that no added etüt report covers are counted; the page warns that etüt counts may be incomplete.

## What the page shows

Top to bottom, in plain Turkish with the units in the headers and no manual or footnotes:

1. **Sentence:** the grade, lesson, number of exams and dates, how much the class progresses per exam on average, and the same for the group with the most etüts and the group with none; then how many students were counted and how many left out, and one line: *Bu bir karşılaştırmadır; farkın sebebi etüt olmayabilir.*
2. **Controls:** Sınıf (when more than one), Oturum, Ders, Dönem.
3. **Chart** (`#eeGrafik`): drawn after the page is in place at the box's real width, on the real spacing of the exam dates. One line per non-empty group (the mean net of those who sat each exam), the class mean dashed; each line is named at its right end with its latest value (no legend). Beneath it, on the same dates, the weekly etüt count of the lesson from zero.
4. **Etüt sayısına göre** (`#eeGruplar`), **Öğretmenlere göre** (`#eeHocalar`; ranked by *Sınıftan fazla / az* — the teacher's students' mean progress per exam minus the class mean — largest first, with the rank in the first column *Sıra*; equal values share a rank (1, 1, 3); a teacher with fewer than five counted students has no rank (—), is drawn faint and comes after the ranked ones; a teacher's name filters the student list, pressing it again or *Tüm öğretmenler* clears it), **Öğrenciler** (`#eeOgrenciler`: etüts, exams, progress per exam and in total, a small line of their nets; most etüts first), and the collapsed list of students left out (`#eeDisarida`).

Every numeric header and number share the class `sayi` (right-aligned: `.et-tablo th.sayi` in `src/etutler.css`, so every module with such tables benefits); the tables have fixed column widths with a flexible name column and scroll inside their own box on a phone.

## What it cannot tell

It shows an **association, not a cause.** Students who come to etüt may differ from the rest to begin with. A bigger difference that repeats over several lessons and teachers is stronger evidence than one; a handful of students proves nothing, which is why small groups are drawn faint.

## Code and tests

- `src/etutetkisi.js` and `src/etutetkisi.css` are embedded into `index.html` by `node scripts/embed-etutetkisi.cjs` (`--check` only verifies). The pure model (`egim`, `ogrenciGelisim`, `model`) is exported with the page. The page is `gorunumEtutEtki()` under the tab `etutetki` (rehber only).
- `test/etutetkisi-regression.cjs` checks the slope against hand-worked series (including a missed middle exam), the possessive endings, the groups and their means, the etüt counting rules (exam days, other lessons, TYT / AYT courses), teacher rows with overlap and difference from the class, the students left out and why, the weekly counts, same-titled exams, Son 4 deneme, coverage, the page (sections in order, no manual words, states), the chart's lines and labels, the menu and privacy.
- `test/tutarlilik-regression.cjs` runs one synthetic fixture through Deneme panosu, Etüt etkisi, Öğrenci raporları, Yoklama and Etütler (six students are six rows; an etüt only before the second exam still shows).
- `test/etutetkisi-browser.cjs` runs on desktop (light) and at 390 px (dark): the menu, the sections in order, the chart drawn at its real width with non-overlapping labels in real-pixel type, every numeric header over its numbers in every table, the teacher filter, the Dönem, Ders and Sınıf controls, the left-out list, redraw on resize, and no sideways page scrolling.
- The synthetic students (no real data) are built inside the tests, in the shape Öğrenci raporları returns.
