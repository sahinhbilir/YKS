# Türkiye geneli (guidance teacher)

The **Türkiye geneli** page charts where the school stands among the publisher's schools across Türkiye, exam by exam. It reads the report **Ders Ortalamaları İlk 100 Kurum (Kolej)**: for every subject, the 100 schools with the highest average net and the Türkiye average (*Genel Net*). Each PDF added is one exam, so each new exam adds a point to every line. The page sits in the teacher menu under **Denemeler**, after Sıralamalar, and shares the Etütler look (`src/etutler.css`, root `#tgKok`).

## Getting the report

In Myexamy: select the exam on **Sınavlar**, then **Raporlar → Türkiye Geneli Analiz ve Raporları**, and download the PDF of **“<exam> Ders Ortalamaları İlk 100 Kurum (Kolej)”**. On the page, **PDF ekle** adds one or more of these files (up to 10 at a time). The PDF is read in the browser and is never uploaded.

## Reading the PDF

- Each subject starts on a new page under a title such as `27-YKS-1202, TÜRKÇE-T Dersi Net Sıralı Liste _40 Soru_ (İlk 100 Okul)`. The title gives the exam, the subject and its question count. The columns are Sıralama · Okul Adı · Okul Net · Okul Başarı · Genel Net, and the rows carry on to the next page under the headers only.
- The page keeps the place, the school and its net. *Başarı* is net ÷ questions, so it is computed again rather than stored. The Türkiye average is the value printed on most rows. The print date comes from the footer.
- A school name split across two lines is joined to its row. An unreadable row is skipped and counted in the status line.
- A PDF with no such title is refused, and so are Şube and Öğrenci lists and a file that mixes two exams.
- **List kind.** The same report set also contains “İlk 100 Kurum” (schools and courses together) and “(Kurs)”. The kind comes from the file name when it says *(Kolej)* or *(Kurs)*. Otherwise it is inferred from the names: no course means Kolej, only courses means Kurs, and a mix means *Tüm kurumlar*. Different kinds are never mixed. When more than one kind is stored, a **Liste** switch appears and Kolej is the default.
- Adding an exam's list again (same exam name and kind) replaces it.

## The exams and the school

- **Grade.** The grade comes from the exam code: `27-YKS-1202` is 12. sınıf and `27-TYT-901` is 9. sınıf. Other names count as *Diğer*. A **Sınıf** switch appears when lists of more than one grade are stored. The default is 12. sınıf, otherwise the grade with the most exams.
- **Order and date.** Exams are ordered by date. The date comes from the same exam's school list in Sıralamalar (its corrected date first). Without one, the report's print date is used, and the exam table marks it “rapor”.
- **The school.** **Okul** chooses the school the page follows, and the choice is saved with the lists. Before the teacher chooses, the school named on the Sıralamalar lists is used when exactly one school in the report matches it. Otherwise the page asks the teacher to pick one. A viewing teacher's choice is kept for the visit only.
- **Deneme** chooses the current exam, which is the latest by default. It is compared with the exam just before it. Adding a PDF switches the page to that exam.

## What the page shows

- **Sentence and cards:** the exam, the list kind and the school. The cards show the average place across the session's subjects, how many subjects the school is in the top 100 for, how many are above the Türkiye average, the best place, and the subjects that rose and fell the most since the previous exam. A school outside the list counts as place N + 1 (101) in the average.
- **Sıra** (main chart): place 1 is at the top. With no subject chosen, every subject of the session (TYT or AYT) is a line and the bold line is the average place. The line under the pointer is highlighted and the others fade; ↑/↓ moves between lines and a click or Enter opens that subject. A subject outside the top 100 sits on the dotted **İlk 100 dışı** lane, joined to its other points by dashed lines. The previous and current exams' columns are shaded. Hovering or ←/→ shows an exam's figures, and Home/End jump to the first and last exam.
- **Subject cards:** place, places moved (▲/▼), net and Türkiye average, plus a small chart of the place where higher is better. A card opens its subject; clicking it again, or **Tüm dersler**, goes back.
- **Türkiye ortalamasına göre** (no subject chosen): for every subject in the current exam, the school's success minus the Türkiye average's, in points. Bars to the right are above the average and bars to the left are below it.
- **A chosen subject** adds two parts:
  - **Net:** the school's net, the Türkiye average (dashed) and the band from the list's last school to its first. Outside the list the school's net is not printed, so the point is a hollow dot on the band's lower edge.
  - **Sıralamada yakın:** the first school and the four schools on each side of the followed one, with net differences and the Türkiye average placed where it falls. It also shows the place one more net would give, and the gap to the school just above.
- **Dersler** table: place and change, previous place, net, success, Türkiye average, difference, the place with one more net, and the first school.
- **Denemeler** table: every stored list (all grades and kinds) with its date, its number of subjects and how many of them hold the school. **Sil** deletes one list and **Tüm listeleri sil** deletes them all. A viewing teacher sees the page but cannot add lists, delete them or save the school.
- **Çizgi: Köşeli / Yumuşak** shapes the lines, as on the other boards (docs/grafikler.md).

## Storage and privacy

- The data is kept in the teacher notebook as `D.turkiye = {surum:1, ts, okul, adlar:[…], sinavlar:[{ad, liste, yaz, ts, dersler:[[kod, soru, genel, satırlar]]}]}`. `adlar` is the school-name dictionary and `genel` is the Türkiye average in hundredths. `satırlar` is the list in printed order as `name:net` pairs in base 36 (the name's index in `adlar`, the net in hundredths), with a third part only when the printed place differs from the row's position. `yaz` is the print day.
- One exam's Kolej list takes about 15 KB. Limits: 40 lists, 250 KB in total, and no addition that would push the notebook over the cloud backup limit. A failed save leaves the data unchanged. `dogrula` checks the structure on every read and write; unreadable data is shown as a warning and never overwritten.
- The data travels with the teacher's cloud backup. Student packets are built from a field whitelist and never carry it, and students never see the page.

## Code and tests

- `src/turkiye.js` and `src/turkiye.css` are embedded into `index.html` by `node scripts/embed-turkiye.cjs` (`--check` only verifies). The PDF text is read with `denemePdfSayfalari` from Denemeler, and lines are drawn with `GRAFIK_CIZGI` (`src/grafik.js`).
- `test/turkiye-regression.cjs` covers reading (pages, two-line names, skipped rows, list kinds, refused reports), storage (encoding, replacing, printed places, damaged data, limits), the model (order and Sıralamalar dates, grade and kind, guessing and choosing the school, places, ties, one more net, outside the list, averages), charts, the page, the viewing teacher and privacy.
- `test/turkiye-browser.cjs` runs on desktop (light theme) and at 390 px (dark theme). It covers the menu, PDF ekle, choosing the school, a third exam moving the chart, hover and keyboard, line highlight and click, a subject's net chart and nearby schools, TYT/AYT, the exam picker, Çizgi, no sideways scrolling, and deleting.
- The synthetic report is in `test/fixtures/kurum-pdf.cjs`; it holds no real school data.
