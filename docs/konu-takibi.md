# Konu Takibi

Teacher page under **Denemeler → Konu Takibi**. Upload (button *Dosya Yükle*) a publisher's single-exam
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

## Reading the page

- **Sırala** orders topics (and the outcomes inside an expanded topic): *En çok soru*
  (default), *Düşenler* / *Yükselenler* (cumulative change, topics without a change
  last), *Son denemede iyi* (the topic's latest dated exam's own rate, ties by that
  exam's question count; each row then shows e.g. "Son deneme %83 · 5/6") and *Ada göre*.
- **Matematik + Geometri** (first in the subject list when both exist for the session)
  merges the two subjects' topics. A topic name present in both is one topic with
  counts summed per exam. TYT Temel Matematik is 30 Matematik + 10 Geometri questions.
- The line under the list title gives the subject totals over the pupil's exams
  (blocks' row sums; the topic summary when one exists, because publisher outcome rows
  can map one question to several outcomes), then the exams the pupil has in that
  session ("TYT: 27-YKS-1203"). With one exam only, it suggests uploading other exams.
- **Öğrenci** starts with "Tüm şube (N öğrenci)" (the default) and "Tüm 12. sınıflar
  (N öğrenci)" (every class of the same grade, read from the class text; grades are
  never mixed). In these views counts are summed over the included pupils and exams
  (each pupil's exam once per topic), the history has one point per exam date for all
  pupils who took it, and sessions/subjects are the union over the pupils. The summary
  reads "Tüm 12. sınıflar · 26 öğrenci · 3 deneme · 1.040 soru · 412 doğru (%40)" and
  the exam line gives pupil counts: "TYT: 27-YKS-1203 (9), 27-TYT SIFIR POZİTİF (7)".
  Only totals are shown; there are no per-pupil lists or rankings.
- A session with a single kind (e.g. only TYT) is shown as plain text, not a choice.
- The page opens on the class with the most loaded exams (then most pupils), so
  a class with TYT and AYT exams is preferred over one with a single TYT exam.
- After an upload the status reads e.g. "3 PDF kaydedildi · 1 sınav (27-YKS-1203) ·
  27 öğrenci": several class files of one exam are one exam. **Kaynaklar** lists each
  exam with its session, classes and pupil count.

## Zorluğa göre (difficulty-adjusted points)

Each question's difficulty is the school's own success rate p (share of pupils who
answered it correctly). A correct answer earns 1 − p and a wrong or blank one costs p,
which sums to `fark = doğru − beklenen` with `beklenen = Σ p` over the questions.
Missing a question only 7 % got right costs 0,07; missing one 93 % got right costs 0,93.
The unit is questions ("soru"). A kazanım row uses the questions carrying its code
(its Toplam must equal that count, otherwise the row has no difficulty and is counted
in "Zorluk eşleşmedi"). A topic sums its kazanım rows; a topic with only a topic summary
uses the questions that map to it (each once) against the summary's doğru. Cumulative
figures add only exams that have difficulty ("zorluk verisi 1/2 denemede" says so);
class and grade views sum over pupils and also show "öğrenci başına". Sırala has
*Zorluğa göre zayıf* / *güçlü* (topics without difficulty last).

Two files per exam supply p, both uploaded through **Dosya Yükle**: the **Sınav özeti**
(.xlsx, sheet "Sınav Özeti": question order within each Ders with its kazanım codes) and
the **Madde Analizi** (.pdf, rotated pages; p = Doğru / Öğrenci Sayısı, which must agree
with the printed Başarı within 0,1). Either may come first; the difficulty is used only
when both exist and every course has the same question count ("Zorluk verisi uyuşmuyor:
<ders>" otherwise). Uploading an exam's file again replaces that part. Kaynaklar shows
"Zorluk: özet ✓ · madde analizi ✓" per exam with a button to remove it (editing teacher only).
The xlsx is read in the browser by a minimal ZIP reader, `DecompressionStream` and `DOMParser`; no library.

**Privacy:** the publisher's *sınav cevap raporu* (xlsx with Öğrenci No, Ad Soyad, TC Kimlik
No, Kitapçık) is refused before anything is read further or stored. Only Ders, kazanım codes
and per-question counts are kept, never names or numbers.

Storage: optional `zorluk: {[examKey]: {ad, oturum, ogrenci, ts, ozet, madde}}` in
`D.konutakibi` (≤ 60 exams, ≤ 200 questions per course, p in [0, 1]); it shares the 350 KB limit.
Removing an exam in Kaynaklar leaves its difficulty data until that is removed too.

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
