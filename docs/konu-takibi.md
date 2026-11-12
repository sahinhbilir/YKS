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
the **Madde Analizi** (.pdf, rotated pages; p = Doğru / n, which must agree with the printed Başarı within 0,1). Publishers
print Başarı over different bases, so n is, per ders, the first of these the percentages fit: the list's **Öğrenci Sayısı**,
the ders's **Testi Cevaplamış Öğrenci Sayısı**, or the students its rows count (doğru + yanlış + boş: those who sat the exam,
as in a TÖDER file where 15 of the 29 listed pupils sat it). A test nobody answered (Testi Cevaplamış 0, every row blank:
an optional Seçmeli Felsefe) is left out, and the upload message says so; its 0 % would otherwise read as far behind
Türkiye. One file may carry the exam's TYT and its AYT ("27-YKS-1203 / TYT", "… / AYT"), each with its own student count;
two different exams in one file are refused. Either file may come first; the difficulty is used only
when both exist and every course has the same question count ("Zorluk verisi uyuşmuyor:
<ders>" otherwise). Uploading an exam's file again replaces that part for the sessions the file carries: an exam's TYT
and AYT files (Sınav özeti, Madde Analizi or Performans analizi) sit side by side. The Türkiye comparison counts each ders
with its own students (the most doğru + yanlış + boş of its rows), so an AYT taken by 26 is not counted as 27. Kaynaklar shows
"Zorluk: özet ✓ · madde analizi ✓" per exam with a button to remove it (editing teacher only).
The xlsx is read in the browser by a minimal ZIP reader, `DecompressionStream` and `DOMParser`; no library.

**Privacy:** the publisher's *sınav cevap raporu* (xlsx with Öğrenci No, Ad Soyad, TC Kimlik
No, Kitapçık) is refused before anything is read further or stored. Only Ders, kazanım codes
and per-question counts are kept, never names or numbers.

Storage: optional `zorluk: {[examKey]: {ad, oturum, ogrenci, ts, ozet, madde}}` in
`D.konutakibi` (≤ 60 exams, ≤ 200 questions per course, p in [0, 1]); it shares the 350 KB limit.
Removing an exam in Kaynaklar leaves its difficulty data until that is removed too.

## Türkiye’ye göre (where the school and each pupil are behind)

**Görünüm: Gelişim | Türkiye’ye göre.** The second view compares the school's success on every question with the
network's. It needs, for the same exam: the publisher's **Performans analizi** (PDF “27-YKS-1203 SINAVI ANALİZLERİ”:
the share of all the publisher's pupils who answered each question of the A booklet correctly), the school's **Madde
Analizi** and, for konu and kazanım, the **Sınav özeti**. All three go through **Dosya Yükle**; the Performans analizi
is recognised by its title and read by the Yanlışlar defteri parser. Only the exam code and one p per question are
kept (`zorluk[exam].turkiye = {course: [p, …]}`): no counts, no school, no pupil. The file names its exam by the code
only, so it joins the entry whose name carries the same code ("27 YKS 1203 TYT" and "27-YKS-1203" are one exam). An
exam without such a code ("27-TYT_SIFIR_POZİTİF SINAVI ANALİZLERİ") is named by its full name, the name its karneler and
Sınav özeti give it, so the three files still meet under one exam.
Kaynaklar shows "Türkiye (performans analizi) ✓" with its own **Türkiye verisini kaldır**.

What the page shows, top to bottom:

- **Okul − Türkiye** (the headline, in percentage points, with its interval), **Geride kalınan ders**, the most
  behind ders or topic, and the amount of data (questions, exams, pupils).
- Controls: Sınıf (only when exams of several grades are stored; grades are never mixed, a grade is the karne pupils'
  grade or the exam code's, "27-YKS-1203" → 12), Oturum, Deneme (all or one), Ders, **Ölçü**.
- **Dersler · okul ve Türkiye**: one row per ders, the school's dot against Türkiye's tick on a 0–100 scale, the two
  rates, the difference ± interval, the number of questions and **Durum**. A row selects the ders.
- **Konular / Kazanımlar / Sorular** of the selected ders (**Düzey**), sorted (En geride, En ileride, En çok soru, Ada
  göre). A konu or kazanım row opens its questions as chips ("S12 · okul %31 · Türkiye %58").
- **Öğrenciler · kim nerede geride**: pupils × dersler (or × the topics of the selected ders). A cell is the pupil's
  correct answers minus what a pupil at the Türkiye average would be expected to get on the same questions (Σ Türkiye p
  over the kazanım rows of the karne; unit: questions). The most behind pupil is on top, the school's most behind
  column on the left; colour follows the difference per question, so a 40-question ders and a 7-question ders share
  one scale. A name opens Öğrenci kartı. Needs the pupils' karne and the Sınav özeti.

### How it is calculated

- **Rates.** okul = Σ doğru ÷ Σ pupils over the group's questions (Madde Analizi); Türkiye = the same weighted mean
  of the Performans analizi p. **Fark** = okul − Türkiye, in percentage points.
- **Dersin geneline göre** (the second Ölçü, inside a ders). A school can be above or below Türkiye in a whole ders.
  For every exam and ders one shift d on the logit scale is solved from Σ σ(logit(p_TR) + d) = Σ p_okul; a
  question's *beklenen* is σ(logit(p_TR) + d), what a school at this school's level would score on it. okul − beklenen
  sums to zero inside the ders, so it shows the topics that are weak for the school's own level. This is the logic of
  differential item functioning (Holland & Wainer 1993), applied to a school instead of a demographic group.
- **Interval.** The same pupils answer every question of a group, so answers are not independent. With m questions and
  N pupils, Var(group mean) = [Σv + r·((Σ√v)² − Σv)] / (m²·N), v = p(1 − p) with p smoothed by one right and one wrong
  answer, r = 0,2 the assumed correlation between two questions (`R_MADDE`; the mean inter-item correlation behind a
  KR-20 of about 0,9 on 40 questions). r = 0 would be the binomial interval, which is too narrow. The page shows
  ± 1,96·SE.
- **Durum.** *Geride* only when the whole interval is below zero, *İleride* when it is above; otherwise *Fark belirsiz*.
  With about 30 pupils a two-question topic has an interval of roughly ±20 points, so only large gaps are established;
  pooling several exams narrows it.
- **Kıyas: Okul içi | Türkiye** (Gelişim view, when a Türkiye file exists) switches the baseline of "zorluğa göre" to
  Türkiye's rates; the figure is then called "Türkiye’ye göre" everywhere (rows, history tables, Sırala, summary).

### Limits

- "Türkiye" is the publisher's network: the pupils who sat this publisher's exam, not every pupil in the country.
- The Performans analizi is for the A booklet; the school's Madde Analizi pools both booklets on A numbering.
- r = 0,2 is an assumption; a topic whose questions are near copies of each other correlates more and has a wider
  true interval. About one row in twenty is flagged by chance when many rows are read together.
- A question carrying several kazanım codes is counted in each of them (the publisher's own convention).

Other pages read the same calculation: **Türkiye geneli** shows "Geride kalınan konular" (`geridekiKonular`), and
**Öğrenci kartı → Zayıf konular** uses the Türkiye baseline when the file is there.

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

- `node test/konutakibi-regression.cjs`: Türkiye’ye göre worked by hand (rates, interval, status, relative measure,
  grades and exams, missing parts, each pupil, the upload and the page); parsing, weighted history, missing data,
  duplicate and paired imports, date conflicts, scope, validation, rollback,
  editor permissions, escaped document text and student packet isolation.
- `node test/konutakibi-browser.cjs`: upload, date entry, drilldowns, charts,
  desktop/mobile layout, light/dark theme and readonly/student routing.
- Both are wired into `verify.yml`, including embedding verification.
