# Türkiye geneli (guidance teacher)

The **Türkiye geneli** page charts how much the school's nets rise from exam to exam compared with the publisher's schools across Türkiye, and where it stands among them. It reads the report **Ders Ortalamaları İlk 100 Kurum (Kolej)**: for every subject, the 100 schools with the highest average net and the Türkiye average (*Genel Net*). Each PDF added is one exam, so each new exam adds a point to every line. The page sits in the teacher menu under **Denemeler**, after Sıralamalar, and shares the Etütler look (`src/etutler.css`, root `#tgKok`).

## Getting the report

In Myexamy: select the exam on **Sınavlar**, then **Raporlar → Türkiye Geneli Analiz ve Raporları**, and download the PDF of **“<exam> Ders Ortalamaları İlk 100 Kurum (Kolej)”**. On the page, **PDF ekle** adds one or more of these files (up to 10 at a time). The PDF is read in the browser and is never uploaded.

## Reading the PDF

- Each subject starts on a new page under a title such as `27-YKS-1202, TÜRKÇE-T Dersi Net Sıralı Liste _40 Soru_ (İlk 100 Okul)`. The title gives the exam, the subject and its question count. The columns are Sıralama · Okul Adı · Okul Net · Okul Başarı · Genel Net, and the rows carry on to the next page under the headers only.
- **Ek Felsefe** (`S.FELSEFE-T`, `S.FELSEFE-A`) is left out: it is not read, not kept, and lists stored before lose it the next time the data is saved.
- The page keeps the place, the school and its net. *Başarı* is net ÷ questions, so it is computed again rather than stored. The Türkiye average is the value printed on most rows. The print date comes from the footer.
- A school name split across two lines is joined to its row. An unreadable row is skipped and counted in the status line.
- A PDF with no such title is refused, and so are Şube and Öğrenci lists and a file that mixes two exams.
- **List kind.** The same report set also contains “İlk 100 Kurum” (schools and courses together) and “(Kurs)”. The kind comes from the file name when it says *(Kolej)* or *(Kurs)*. Otherwise it is inferred from the names: no course means Kolej, only courses means Kurs, and a mix means *Tüm kurumlar*. Different kinds are never mixed. When more than one kind is stored, a **Liste** switch appears and Kolej is the default.
- Adding an exam's list again (same exam name and kind) replaces it.

## The exams and the school

- **Grade.** An exam's grade is, in order: the teacher's choice in the Denemeler table's **Sınıf** column; the exam's name (`27-YKS-1202` and `12.SINIF_HAZIR_BULUNUŞLUK_SINAVI` are 12. sınıf, `27-TYT-901` is 9. sınıf); the grade most of its students are in on the same exam's Sıralamalar list. An exam whose grade is still unknown (such as `27-TYT_SIFIR_POZİTİF`) joins the main group, so it is never hidden. The main group is 12. sınıf, otherwise the grade with the most exams. A **Sınıf** switch appears when more than one grade is stored; **Tümü** shows every exam of the list together. Choosing *Otomatik* in the Sınıf column clears the teacher's choice, and adding the same list again keeps it.
- **Lists not in the chart.** When some stored lists are of another kind or grade, a line under the toolbar names them (“Grafikte 3 deneme var. Diğerleri: …”), and each name switches the page to that list.
- **Order and date.** Exams are ordered by date. The date comes from the same exam's school list in Sıralamalar (its corrected date first). Without one, the report's print date is used, and the exam table marks it “rapor”.
- **The school.** **Okul** chooses the school the page follows, and the choice is saved with the lists. Before the teacher chooses, the school named on the Sıralamalar lists is used when exactly one school in the report matches it. Otherwise the page asks the teacher to pick one. A viewing teacher's choice is kept for the visit only.
- **The two exams compared.** In **Artış** they are **İlk deneme → Son deneme**: the first exam of the chart and the latest by default, so the page reads the whole run of mock exams, not one pair. In **Sıra** they are **Önceki → Şimdiki**: the latest and the exam just before it. The first only offers exams before the second. Adding a PDF switches the page to that exam.

## Artış (the default view)

Exams differ in difficulty, so an increase is read against the Türkiye average's increase between the same exams: **Türkiye’ye göre** = the school's change − the Türkiye average's change, in nets. By default the page covers the whole run, first exam → latest: the **total** is the last exam against the first, and the **average per exam** is the total over the steps between neighbouring exams (a run of 4 exams has 3 steps).

- **Totals:** the sum of the subjects' average nets. TYT takes every TYT subject (120 questions without Ek Felsefe). AYT has one total per field, chosen with **Toplam**: SAY (Matematik, Geometri, Fizik, Kimya, Biyoloji), EA (Edebiyat, Tarih-1, Coğrafya-1, Matematik, Geometri) and SÖZ (Edebiyat, Tarih-1, Coğrafya-1, Tarih-2, Coğrafya-2, Felsefe Grubu, Din Kültürü). A total is missing in an exam where any of its subjects is missing for that school.
- **Sentence and cards:** for the total (or the chosen subject), the change in net (total over the run and **Deneme başına ortalama**, with the Türkiye average's), then the increase against Türkiye, the **Artış sırası**, the school's own change with both nets and the Türkiye average's change, how many subjects rose more than Türkiye, and the subjects that rose the most and fell furthest behind (by success points, so subjects of different lengths compare).
- **Net** chart: the total's net (or the chosen subject's) exam by exam, the school against the Türkiye average (dashed). A total missing in an exam is bridged by a dashed line.
- **Denemeler arası net değişimi:** a table with a row for the total and for every subject and **Toplam** (the total of the net changes, the first exam against the last) and **Ortalama** (per exam, the total over the steps), then a column for every exam after the first: the school's change in net from the exam before, and last the Türkiye average's total and average. A step is empty when the school is outside a list in one of its exams (the net is not printed); the total and the average still come from the first and last exams. A subject's row opens that subject.
- **Artış sıralaması:** every school that has the measure in both the first and the last exam, by its increase (equal increases share a place): the first three and the three on each side of the school, with the Türkiye average's increase where it falls.
- **Subject cards:** the increase against Türkiye, the school's and the Türkiye average's changes and the increase ranking place; the mini line is the net minus the Türkiye average, so its slope is the increase against Türkiye.
- **Türkiye’ye göre artış:** a bar per subject, in success points.
- **Dersler** table: İlk and Son nets, Toplam değişim, the Türkiye average's change, Türkiye’ye göre, Türkiye’ye göre / deneme (the average per exam against Türkiye), Artış sırası (out of how many schools) and the current place.
- With one exam, the page asks for a second one.

## Sıra

**Görünüm: Sıra** shows where the school stands.

- **Sentence and cards:** the exam, the list kind and the school. The cards show the average place across the session's subjects, how many subjects the school is in the top 100 for, how many are above the Türkiye average, the best place, and the subjects that rose and fell the most since the previous exam. A school outside the list counts as place N + 1 (101) in the average.
- **Sıra** (main chart): place 1 is at the top. With no subject chosen, every subject of the session (TYT or AYT) is a line and the bold line is the average place. The line under the pointer is highlighted and the others fade; ↑/↓ moves between lines and a click or Enter opens that subject. A subject outside the top 100 sits on the dotted **İlk 100 dışı** lane, joined to its other points by dashed lines. The previous and current exams' columns are shaded. Hovering or ←/→ shows an exam's figures, and Home/End jump to the first and last exam.
- **Subject cards:** place, places moved (▲/▼), net and Türkiye average, plus a small chart of the place where higher is better. A card opens its subject; clicking it again, or **Tüm dersler**, goes back.
- **Türkiye ortalamasına göre** (no subject chosen): for every subject in the current exam, the school's success minus the Türkiye average's, in points. Bars to the right are above the average and bars to the left are below it.
- **A chosen subject** adds two parts:
  - **Net:** the school's net, the Türkiye average (dashed) and the band from the list's last school to its first. Outside the list the school's net is not printed, so the point is a hollow dot on the band's lower edge.
  - **Sıralamada yakın:** the first school and the four schools on each side of the followed one, with net differences and the Türkiye average placed where it falls. It also shows the place one more net would give, and the gap to the school just above.
- **Dersler** table (Sıra): place and change, previous place, net, success, Türkiye average, difference, the place with one more net, and the first school.

## On both views

- **Denemeler** table: every stored list (all grades and kinds) with its date, its number of subjects and how many of them hold the school. **Sınıf** sets a list's grade, **Sil** deletes one list and **Tüm listeleri sil** deletes them all. A viewing teacher sees the page but cannot add lists, delete them or save the school.
- **Çizgi: Köşeli / Yumuşak** shapes the lines, as on the other boards (docs/grafikler.md).

## Storage and privacy

- The data is kept in the teacher notebook as `D.turkiye = {surum:1, ts, okul, adlar:[…], sinavlar:[{ad, liste, yaz, ts, duzey?, dersler:[[kod, soru, genel, satırlar]]}]}`; `duzey` is present only when the teacher set the grade (0 for Diğer). `adlar` is the school-name dictionary and `genel` is the Türkiye average in hundredths. `satırlar` is the list in printed order as `name:net` pairs in base 36 (the name's index in `adlar`, the net in hundredths), with a third part only when the printed place differs from the row's position. `yaz` is the print day.
- One exam's Kolej list takes about 15 KB. Limits: 40 lists, 250 KB in total, and no addition that would push the notebook over the cloud backup limit. A failed save leaves the data unchanged. `dogrula` checks the structure on every read and write; unreadable data is shown as a warning and never overwritten.
- The data travels with the teacher's cloud backup. Student packets are built from a field whitelist and never carry it, and students never see the page.

## Code and tests

- `src/turkiye.js` and `src/turkiye.css` are embedded into `index.html` by `node scripts/embed-turkiye.cjs` (`--check` only verifies). The PDF text is read with `denemePdfSayfalari` from Denemeler, and lines are drawn with `GRAFIK_CIZGI` (`src/grafik.js`).
- `test/turkiye-regression.cjs` covers reading (pages, two-line names, skipped rows, list kinds, refused reports), storage (encoding, replacing, printed places, damaged data, limits), Ek Felsefe left out, exams shown together (grade from the name, Sıralamalar or the teacher; grade-less exams in the main group; the note on other lists), the model (order and Sıralamalar dates, grade and kind, guessing and choosing the school, places, ties, one more net, outside the list, averages), the Artış view (totals, increases against Türkiye, the increase ranking, Önceki → Şimdiki), charts, the Sıra view, the viewing teacher and privacy.
- `test/turkiye-browser.cjs` runs on desktop (light theme) and at 390 px (dark theme). It covers the menu, PDF ekle, choosing the school, the Artış view (a subject's increase and ranking, the TYT total chart and its readout), a third exam moving the chart, hover and keyboard, line highlight and click, a subject's net chart and nearby schools, TYT/AYT, Önceki, Çizgi, no sideways scrolling, and deleting.
- The synthetic report is in `test/fixtures/kurum-pdf.cjs`; it holds no real school data.
