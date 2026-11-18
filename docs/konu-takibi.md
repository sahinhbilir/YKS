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
when both exist and every course has the same question count ("<sınav>: Zorluk verisi uyuşmuyor:
<ders>" otherwise; also when the Madde Analizi has a ders the session's Sınav özeti does not know). A Sınav özeti ders missing
from the Madde Analizi is not a mismatch (a test nobody took is left out of it), and a session with no Sınav özeti is not
either: the upload says "<sınav>: AYT Sınav özeti yok; …" when the exam has the other session's özet, and Kaynaklar shows
each part per session for an exam with TYT and AYT ("özet TYT ✓, AYT yok · madde analizi TYT ✓, AYT ✓"). Uploading an exam's file again replaces that part for the sessions the file carries: an exam's TYT
and AYT files (Sınav özeti, Madde Analizi or Performans analizi) sit side by side. The Türkiye comparison counts each ders
with its own students (the most doğru + yanlış + boş of its rows), so an AYT taken by 26 is not counted as 27. Kaynaklar shows
"Zorluk: özet ✓ · madde analizi ✓" per exam with a button to remove it (editing teacher only).
The xlsx is read in the browser by a minimal ZIP reader, `DecompressionStream` and `DOMParser`; no library.

**Privacy:** the publisher's *sınav cevap raporu* (xlsx with Öğrenci No, Ad Soyad, TC Kimlik
No, Kitapçık) is refused before anything is read further or stored. Only Ders, kazanım codes
and per-question counts are kept, never names or numbers.

Storage: optional `zorluk: {[examKey]: {ad, oturum, ogrenci, ts, ozet, madde}}` in
`D.konutakibi` (≤ 60 exams, ≤ 40 courses per part so an exam's TYT and AYT fit side by side, ≤ 200 questions per course,
p in [0, 1]); it counts toward the record's size caps below.
Removing an exam in Kaynaklar leaves its difficulty data until that is removed too.

## Türkiye’ye göre (where the school and each pupil are behind)

**A compulsory TYT test left wholly blank is still evidence**: its questions count in the denominator and its correct rate is 0%, including geometry and science. Both the topic model and the pupil’s Türkiye gap use those counts. The existing exclusion of wholly blank AYT subjects and optional TYT Seçmeli Felsefe remains unchanged. This affects Konu Takibi, Öğretmen raporu, Türkiye karşılaştırması, Öğrenci kartı and Dikkat where they use these calculations.

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

**Topic names checked against MEB's published programmes (2026-11-18).** Every unit and topic table (`ESKI`, `MEB_MAT`) was
compared with the programme PDFs on mufredat.meb.gov.tr: the 2018 programmes, and for Tarih the 2023 one that this year's 12th
grade was taught. Corrections: Biyoloji 12.2.1 Canlılık ve Enerji, 12.2.2 Fotosentez, 12.2.3 Kemosentez, 12.2.4 Hücresel Solunum
(the table was one off); Fizik 12.1.4 Kütle Çekim Kuvveti and 12.1.5 Kepler Kanunları; Tarih 11.3 Devrimler Çağında Değişen
Devlet-Toplum İlişkileri, 11.4 Uluslararası İlişkilerde Denge Stratejisi, 11.5 XIX ve XX. Yüzyılda Değişen Sosyoekonomik Hayat
(2023: no Sermaye ve Emek, no 11.6); Din 11.5 Yahudilik ve Hıristiyanlık; Felsefe 10.4 Felsefi Okuma ve Yazma. `E.M.9.2.1.5` is
the publisher's own code for Sayı Basamakları (MEB's 9.2.1 ends at 9.2.1.3; the Sınav özeti names it so), ahead of its parent
`E.M.9.2.1` Kümelerde Temel Kavramlar. Matematik, Kimya, Coğrafya, İnkılap Tarihi, Edebiyat, Psikoloji, Mantık and Sosyoloji
matched. Built-in names display as written (`kanon`): before, a name outside the publisher's list was title-cased ("Sanat Ve
Edebiyat", "Iı. Dünya Savaşı").

**Missing student karnesi (2026-11-18).** Every table (Konu Takibi and the Türkiye karşılaştırması of the reports) is built
from each student's own kazanım results, the publisher's Kazanım Karnesi. The Sınav özeti, Madde Analizi and Performans analizi
are question totals for the whole school and never stand in for it. So a Kaynaklar row whose difficulty files cover a session
that has no karnesi says so in red: "AYT öğrenci kazanım karnesi yok: bu denemenin AYT konuları … girmez. Yayınevinin AYT Kazanım
Karnesi PDF’ini ekleyin." An exam with difficulty files only says "öğrenci kazanım karnesi yüklenmedi". A karnesi titled
differently from its exam (27 YKS 1201 AYT for 27-YKS-1201) joins it by the exam code when exactly one exam, or one set of
difficulty files, has that code; two candidates are never guessed between.

**12th-grade and AYT codes (2026-11-18, from the publisher's 27-YKS-1202 AYT Sınav özeti).** The new programme has reached the
9th–11th grades only, so a 12th-grade code with a new-style prefix (`BİY.12.1.1.2`, `MAT.12.5.2`) is read as the earlier
programme's (`yeniProgramMi`). AYT Edebiyat's `TDE.12.unit.part.kazanım` codes follow the publisher's own AYT order, not the MEB
12th-grade units, so they have their own table (`AYT_EDB`). Its names are the app's own AYT Edebiyat plan topics
(`VARSAYILAN_KONU_PLANI`, the same names as Hafızam and Haritam; the publisher's teacher modules on Drive are 9th–10th grade only
and name no AYT topic): 12.1.1 and 12.1.5 (güzel sanatlar; öğretici and edebî metinler) Sanat ve Edebiyat, 12.1.3 Türk Dilinin ve
Edebiyatının Tarihî Dönemleri, 12.2.1 Coşku ve Heyecanı Dile Getiren Metinler (Şiir Bilgisi), 12.2.2 … (Şiir Dili / Söz Sanatları),
12.3.1 Tarihsel Süreç İçinde Türk Şiiri (İslamiyet Öncesi / Geçiş Dönemi 11-12.yy / Halk Edebiyatı). A part not seen yet takes its
unit's topic (12.1 Sanat ve Edebiyat, 12.2 Şiir Bilgisi, 12.3 Tarihî Dönemleri), an unknown unit stays for **Eşleştir**. Seçmeli Felsefe (`S.FELSEFE-A`) reads the Felsefe grubu codes. All 166 AYT questions of that exam now have a topic
(before: 27 had none: 18 Edebiyat, 6 Biyoloji, 3 Seçmeli Felsefe). Topics are worked out when a page is drawn, so stored data
regroups by itself; a teacher's own Eşleştir still comes first.

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

`D.konutakibi` holds a dictionary of outcome codes/descriptions, integer counts, exam blocks, dates and manual
associations. Every page reads it as version 1 (`oku`); since 2026-11-18 the notebook stores version 2 (`sakla`/`ac`): each
exam's students listed once, each block's kazanım list (label, question count) as a shared template, and each pupil's doğru
and yanlış per row as base-36 characters (boş = soru − doğru − yanlış, which every row satisfies). `write` stores it only after
checking that it reads back to exactly the record it was given; a version 1 record still reads, and the next save converts
it. Measured on a realistic 31-pupil TYT + AYT exam: 39 KB stored instead of 153 KB, 9 KB instead of 18 KB of the cloud copy;
thirty such exams 598 KB instead of 4,043 KB (cloud 137 KB instead of 424 KB), so a school year fits easily where version 1
filled the old cap at about nineteen exams. An upload may not grow the stored record past 2,500 KB or 400,000 kazanım rows
(about seventy such exams; the rows are what a page works on); 100 exams at most. Kaynaklar shows the record's size and rows
against the caps and about how many more exams of the average size fit. Every save is also checked against the notebook's
own budget (cloud copy 900 KB compressed, device 5,000 KB). The caps apply to growth only: a removal, a replaced exam or any
change that does not grow the record always saves, and reading never fails on size (only a record no upload could have
made, over 10 MB stored or 1,000,000 rows, is refused as corrupt).

**Large karne files (2026-11-18).** A kazanım karnesi (its first page says so) is read page by page (`karneCozucu`;
`denemePdfSayfalari`'s `sayfaIsle`), up to 1,000 pages and 60 MB like the other school lists, keeping only its rows and each
kazanım's text once; the pages themselves are dropped as they are read. Kaynaklar's status shows "… okunuyor · n / t sayfa"
on long files. The Madde Analizi and Performans analizi stay at 100 pages. Unreadable existing data is preserved and blocks imports. A failed save
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
