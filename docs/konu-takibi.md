# Konu Takibi

Teacher page under **Denemeler → Konu Takibi**. Upload a publisher's single-exam
`KAZANIM KARNESİ` (coded outcomes) or `KAZANIM KARNESİ-KONU` (topic summary) PDF.
Choose a class, student, TYT/AYT and subject. Topic rows show a cumulative correct
rate and change from the first recorded exam. Expand a topic for its history and
individual outcomes; expand an outcome for the same history at that level.
No student ranks, peer comparisons, recommendations or student-plan mutations.

## Meaning of the numbers

For a topic after exam n, cumulative rate is
`100 × sum(correct through n) / sum(correct + wrong + blank through n)`.
This is a weighted rate, not a mean of exam percentages. For example, 2/4 followed
by 6/6 is 8/10 = 80%, a change of +30 percentage points from 50%.

The solid blue line is cumulative. The dashed line is that exam's own correct
rate. Both use a fixed 0–100 scale; the table provides exact counts, percentages
and step changes. The topic row's change spans the full recorded period. An exam
without that topic contributes no evidence, not a zero. All-blank answers do
contribute to the denominator. Zero-question rows have no rate.

These are publisher outcome occurrences. A physical question may map to more
than one outcome, so totals can exceed the exam's physical question count.
This page does not call the percentages net scores or mastery probabilities.

## Import and topic association

Parsing uses the shared browser PDF.js reader, including its 15 MB/file and
100-page limits. Up to ten files can be selected. The parser handles wrapped
labels, split text runs and student/subject continuation pages. Every subject's
four printed totals must match the sum of its rows; a truncated or malformed
file is rejected as a whole. Other valid files in a batch may still be saved,
and filenames plus errors appear in the page status. No PDF is sent to a server.

The seeded publisher code-parent dictionary was checked against all students
in the supplied paired detail/topic reports for two exams. All paired counts
matched. Original descriptions are retained, including publisher classifications
that differ from ordinary classroom terminology. Unrecognized codes stay in an
explicit unassigned group. A teacher can enter the topic name there; no matching
is inferred from coincidentally similar percentages.

A topic-only file supplies topic history without invented outcome details.
When both representations exist, the topic summary supplies the topic count;
the detail supplies the outcomes. They are never added together. A mismatch
between the two is shown on the expanded topic. Unassigned detail does not erase
an available topic summary. Raster-only PDFs and already-combined multi-exam
report cards are rejected: they cannot establish individual exam history.

## Identity, dates and storage

Exam identity is the site's normalized exam name (which includes the publisher's
year/exam code). Student identity is the complete printed class plus school
number. TYT and AYT subjects stay separate. A repeated upload replaces the
exam/student/subject/representation block; other students and representations
survive. The same exam name is treated as the same event, not a new attempt.

Manual dates take priority. Otherwise, the page uses a uniquely matching exam
name from Sıralamalar, preferring its corrected date. Conflicting dates are
unresolved. The supplied exam maps contain no exam date, so unmatched exams need
a date in **Kaynaklar**. No date is inferred from upload time or filename.
Undated results count toward the total but are excluded from the timeline;
overall change remains unavailable until all relevant dates are known. Exams
on the same day form a single timeline step, avoiding an invented within-day
order. All component exam names remain visible.

`D.konutakibi` version 1 holds a dictionary of outcome codes/descriptions, packed
integer counts, exam blocks, dates and manual associations. Limits are 350 KB,
100 exams and 30,000 rows, additionally bounded by the existing notebook backup
limit. Unreadable existing data is preserved and blocks imports. A failed save
rolls back; an import cannot cross notebook/account switches or overwrite another
concurrent Konu Takibi update. Deleting an exam also compacts unused labels.

The data travels in the teacher's existing notebook backup. Student packets use
their existing field whitelist and omit this field. The viewing teacher can
filter and expand, but every mutation is guarded by the editor permission. The
student menu, route and exported student view do not expose the page.

## Source and validation

Edit `src/konutakibi.js` and `.css`, then run `node scripts/embed-konutakibi.cjs`.
Shared board tokens live in `src/etutler.css`; run its embed script after changes.
The fixture and test suites contain synthetic students only; private PDFs,
parsed records and screenshots of real students must never enter Git or CI.

- `node test/konutakibi-regression.cjs`: parsing, weighted history, missing data,
  duplicate and paired imports, date conflicts, scope, validation, rollback,
  editor permissions, escaped document text and student packet isolation.
- `node test/konutakibi-browser.cjs`: upload, date entry, drilldowns, charts,
  desktop/mobile layout, light/dark theme and readonly/student routing.
- Both are wired into `verify.yml`, including embedding verification.
