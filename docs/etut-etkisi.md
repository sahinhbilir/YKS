# Etüt etkisi (guidance teacher)

The **Etüt etkisi** page asks one question of the school's own records: *did the students who took etüts of a lesson in the days before a mock exam gain more net in that lesson than the students who took none?* It sits in the teacher menu under **Öğrenciler**, after Etütler, and shares the Etütler look (`src/etutler.css`, root `#eeKok`).

## Where the data comes from

Nothing is added, stored or uploaded. The page reads the analysis base of **Öğrenci raporları** (`OGRENCI_RAPOR.temelOgrenciler()`): the merged students with their exam results (the net of every lesson, from Sıralamalar and the students' own results) and their etüt sessions (date, lesson, teacher, from Etütler). The two are matched the way Öğrenci raporları matches them (student number, or name and class). The base leaves out attendance, homework and the timetables, so an unreadable Etüt planı or Yoklama does not stop the page; the merge warnings that concern the exams and etüts are shown on the page. The page never writes to the notebook and never reaches a student packet; the choices live in `EK.ee*` only.

If the exam lists or the etüt report are missing, the page says which page to add them on.

## How it is computed

- **The pair.** **İlk → Son** are two exams of one grade (**Sınıf**) and one session (**Oturum**: TYT or AYT). By default they are the first exam and the latest, so the whole period counts. An exam is its title and its date: exams with the same title on different dates stay apart, and their labels then carry the date (“GENEL DENEME (7 Eki)”).
- **The lesson.** **Ders** lists the lessons that had an etüt in the whole period, most etüts first. An etüt's course is turned into a lesson the way Etütler does it (MATEMATİK TYT → Matematik; Türkçe and Edebiyat → Türkçe). The lesson's net is the student's net in that lesson in each exam (AYT Coğrafya and Tarih add their two parts; AYT Türkçe is Edebiyat). A course named for one session counts for it only (“… TYT” for TYT, “… AYT” for AYT); a course with neither counts for both.
- **The students.** Only students of the chosen grade who have the lesson's net in **both** exams count. Their **change** is Şimdiki − Önceki.
- **The etüt window.** **Etüt aralığı**: *Tüm aralık* (the default: every day between the two exams), *Son 7 gün* or *Son 14 gün*. The window never starts before the first exam, and the days of the two exams themselves are not counted. Only etüts of that lesson count.
- **The groups.** **Etüt alan** took at least one etüt of the lesson in the window (for a teacher's row: at least one of that teacher's); **almayan** took none of the lesson from anyone.
- **The raw difference** is the mean change of the first group minus the mean change of the second. The exam's difficulty moves both groups alike, so it cancels.
- **The difference by starting net** (the headline). Students who start low tend to rise more whatever they do, and etüt takers usually start lower. So the students are split into thirds by their net in the first exam; the difference is taken within each third that has both groups, and the thirds are weighted by their etüt takers. The page says how many takers could be compared this way. The raw difference stays beside it.
- **±%95** is the half-width of an approximate 95 % interval (Welch's standard error with Student's t on the smaller group's degrees of freedom). It is shown, but no verdict is drawn from it: with many teachers, lessons and exam pairs some cells look large by chance. A group with fewer than 5 students is marked **az** and its numbers are drawn faint.
- **Coverage.** A student counts as *almayan* only if the etüt reports cover the window. Weekdays in the window that no added etüt report covers are counted, and the page warns that those students may have taken etüts that are not recorded.

## What the page shows

- **Sentence and cards:** the number of students who took and did not take etüts, each group's change and starting net, the difference with its interval and the etüts per student.
- **Öğretmenlere göre:** a row for any etüt and one per teacher who gave the lesson in the window: students, difference by starting net (with a bar either side of zero), raw difference, each group's change, ±, etüts per student, the starting nets, and how many of the teacher's students also took the lesson from another teacher (they count for each teacher they saw). A teacher's name opens that teacher's students below; pressing it again clears it.
- **Etüt sayısına göre:** the students by how many etüts they took (0, 1, 2, 3 and over): their starting and latest net, change, and the difference from the students with none.
- **Denemeler boyunca:** the whole period, shown even when the chosen pair had no etüt. Per teacher: **İlk → son** (the difference over the whole period, for the students in both end exams), the difference per pair of neighbouring exams, **Aralık ortalaması** (the mean of the pairs, weighted by the takers), **Farklı öğrenci** (distinct students who took the teacher's etüts) and **Gözlem** (student-intervals: six students in two intervals are twelve observations, not twelve students). It shows whether an effect repeats.
- **Etüt alan öğrenciler:** each student with the number of etüts, the teachers, the two nets and the change.
- **Nasıl okunur?** the reading rules above, in short.

## What it cannot tell

It shows an **association, not a cause.** Students who come to etüt may differ from the rest to begin with: those who start low tend to rise more whatever they do. The difference by starting net removes part of this, and the starting net of each group is printed beside its change. A bigger difference over several exams and for several teachers is stronger evidence than one pair; a handful of students proves nothing.

## Code and tests

- `src/etutetkisi.js` and `src/etutetkisi.css` are embedded into `index.html` by `node scripts/embed-etutetkisi.cjs` (`--check` only verifies). The page is `gorunumEtutEtki()` under the tab `etutetki` (rehber only; students are sent to their plan).
- `test/etutetkisi-regression.cjs` covers the default whole period, the groups and their means against an independent calculation, the window rules (7 days, 14 days, between the exams, exam days, other lessons, TYT / AYT courses), same-titled exams, the difference by starting net, the interval and the too-few flag, distinct students and observations, coverage and warnings, the page and its states (an empty last pair keeps the history), the menu, the viewing teacher and privacy.
- `test/tutarlilik-regression.cjs` runs one synthetic fixture through Deneme panosu, Etüt etkisi, Öğrenci raporları, Yoklama and Etütler: participant mean against the same students' change, one missed-day rule, same-titled exams, students against observations, the empty last pair, and the analysis base with an unreadable Etüt planı.
- `test/etutetkisi-browser.cjs` runs on desktop (light theme) and at 390 px (dark theme): the menu, the sentence and cards, a teacher's students, the window, the lesson and exam pickers, the empty pair, and no sideways scrolling.
- The synthetic students (no real data) are built inside the tests, in the shape Öğrenci raporları returns.
