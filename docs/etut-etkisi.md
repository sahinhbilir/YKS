# Etüt etkisi (guidance teacher)

The **Etüt etkisi** page asks one question of the school's own records: *did the students who took etüts of a lesson in the days before a mock exam gain more net in that lesson than the students who took none?* It sits in the teacher menu under **Öğrenciler**, after Etütler, and shares the Etütler look (`src/etutler.css`, root `#eeKok`).

## Where the data comes from

Nothing is added, stored or uploaded. The page reads the merged students of **Öğrenci raporları** (`OGRENCI_RAPOR.model()`): their exam results (the net of every lesson, from Sıralamalar and the students' own results) and their etüt sessions (date, lesson, teacher, from Etütler). The two are matched the way Öğrenci raporları matches them (student number, or name and class). The page never writes to the notebook and never reaches a student packet; the choices live in `EK.ee*` only.

If the exam lists or the etüt report are missing, the page says which page to add them on.

## How it is computed

- **The pair.** **Önceki → Şimdiki** are two exams of one grade (**Sınıf**) and one session (**Oturum**: TYT or AYT). By default Şimdiki is the latest exam and Önceki the exam before it.
- **The lesson.** **Ders** lists the lessons that had an etüt between the two exams, most etüts first. An etüt's course is turned into a lesson the way Etütler does it (MATEMATİK TYT → Matematik; Türkçe and Edebiyat → Türkçe). The lesson's net is the student's net in that lesson in each exam (AYT Coğrafya and Tarih add their two parts; AYT Türkçe is Edebiyat). A course named for one session counts for it only (“… TYT” for TYT, “… AYT” for AYT); a course with neither counts for both.
- **The students.** Only students of the chosen grade who have the lesson's net in **both** exams count. Their **change** is Şimdiki − Önceki.
- **The etüt window.** **Etüt aralığı**: *Son 7 gün* (the default), *Son 14 gün*, or *İki deneme arası* (every day since Önceki). The window never starts before Önceki, and the days of the two exams themselves are not counted. Only etüts of that lesson count.
- **The groups.** **Etüt alan** took at least one etüt of the lesson in the window (for a teacher's row: at least one of that teacher's); **almayan** took none of the lesson from anyone.
- **The difference** is the mean change of the first group minus the mean change of the second. The exam's difficulty moves both groups alike, so it cancels. **±%95** is the half-width of an approximate 95 % interval (Welch's standard error with Student's t on the smaller group's degrees of freedom); a difference that does not exceed it may be chance. A group with fewer than 5 students is marked **az** and its numbers are drawn faint.

## What the page shows

- **Sentence and cards:** the number of students who took and did not take etüts, each group's change and starting net, the difference with its interval and the etüts per student.
- **Öğretmenlere göre:** a row for any etüt and one per teacher who gave the lesson in the window: students, difference (with a bar either side of zero), each group's change, ±, etüts per student and the starting nets. A teacher's name opens that teacher's students below; pressing it again clears it.
- **Etüt sayısına göre:** the students by how many etüts they took (0, 1, 2, 3 and over): their starting and latest net, change, and the difference from the students with none.
- **Denemeler boyunca:** every pair of neighbouring exams of the grade and session: each teacher's difference per exam and its mean over the exams, weighted by the students who took etüt. It shows whether an effect repeats.
- **Etüt alan öğrenciler:** each student with the number of etüts, the teachers, the two nets and the change.
- **Nasıl okunur?** the reading rules above, in short.

## What it cannot tell

It shows an **association, not a cause.** Students who come to etüt may differ from the rest to begin with: those who start low tend to rise more whatever they do. The starting net of each group is therefore printed beside its change. A bigger difference over several exams and for several teachers is stronger evidence than one pair; a handful of students proves nothing.

## Code and tests

- `src/etutetkisi.js` and `src/etutetkisi.css` are embedded into `index.html` by `node scripts/embed-etutetkisi.cjs` (`--check` only verifies). The page is `gorunumEtutEtki()` under the tab `etutetki` (rehber only; students are sent to their plan).
- `test/etutetkisi-regression.cjs` covers the groups and their means against an independent calculation, the window rules (7 days, 14 days, between the exams, exam days, other lessons, TYT / AYT courses), the interval and the too-few flag, the figure per exam pair, the page and its states, the menu, the viewing teacher and privacy.
- `test/etutetkisi-browser.cjs` runs on desktop (light theme) and at 390 px (dark theme): the menu, the sentence and cards, a teacher's students, the window, the lesson and exam pickers, the empty pair, and no sideways scrolling.
- The synthetic students (no real data) are built inside the tests, in the shape Öğrenci raporları returns.
