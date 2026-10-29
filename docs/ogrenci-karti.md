# Öğrenci kartı (guidance teacher)

One page per student: how they stand against the **Türkiye average** of each exam, how steady they are, and what else the school knows about them (etüts, absences, weak topics). It is a teacher-only page (`ogrencikarti`), not a menu item: it opens from a student's name (Deneme panosu, Etüt etkisi, and Sıralamalar for students who are not in the notebook) and marks **Öğrenciler** in the menu. A search box at the top (name or school number) opens any student directly; a button leads back to the page it was opened from.

## Where the data comes from

Nothing is added, stored or uploaded; the page only reads and caches in memory (`src/analiz.js`, `ANALIZ`; state in `EK.okKim`, `EK.okOturum`, `EK.okGeri`).

- **Exams and nets:** Sıralamalar' lists through `DPANO.temel`, with Deneme panosu's measures: TYT, and AYT per alan (SAY, EA, SÖZ) for the students who took the alan's tests. A student is identified by school number.
- **Türkiye average:** Türkiye geneli, `TURKIYE.ortalamalar`. An exam is matched by its name (the match that dates a Türkiye list); the Kolej list comes first. Never the school mean.
- **Etüt:** the merged students of Öğrenci raporları (`OGRENCI_RAPOR.temelOgrenciler`). **Yoklama:** its students matched by name and class. **Konu Takibi:** the student's blocks, by school number. **Hedef:** the class / şube target of Deneme ortalaması (`denemeOrtHedefi`).
- Every source is optional; a part without its source says so ("—", "Etüt kaydı yok").

## Definitions

- **Sapma:** the student's net minus the Türkiye average of that exam and session (TYT total; AYT per alan). The student's net counts the same subjects as the Türkiye total (Ek Felsefe stands in for Din Kültürü). An exam without Türkiye data has no sapma; the card says "Bu denemenin Türkiye ortalaması yok" and the chart still draws the student's net.
- **Beklenen:** the exam's Türkiye average plus the mean sapma over the student's previous up to 5 exams that have one; it needs at least 2. **Beklenenden:** the net above (▲) or below (▼) it. Fewer than 2 earlier exams: "En az 3 deneme gerekli".
- **İstikrar:** the standard deviation (of the whole group of values) of sapma over the last up to 6 exams that have one, at least 3. Below 3 net *Çok istikrarlı*, below 6 *İstikrarlı*, below 10 *Dalgalı*, otherwise *Çok dalgalı*.
- **Etüt / devamsızlık:** the last 30 days (today and the 29 days before). A missed day follows Yoklama's rule (3 or more missed lessons; *tam gün* when no lesson was attended, else *yarım gün*).
- **Zayıf konular:** Konu Takibi topics whose "zorluğa göre" is −1 question or less, the worst first, at most 5.

## The page, top to bottom

Header (name, şube, alan, school number), the student search and the TYT / AYT switch, five cards (**Son net** with the place in the school, **Türkiye'ye göre**, **Beklenenden**, **İstikrar**, **Şube / Sınıf hedefi** with the distance), the chart (the student's nets on the real dates, with the school mean dotted, the Türkiye average dashed and the target; each line is named at its right end), **Dersler** (last and previous exam and the difference from the Türkiye average of each lesson), **Zayıf konular**, **Etütler (son 30 gün)** and **Devamsızlık (son 30 gün)**.

## For other pages

`ANALIZ` is the shared base: `kaynak(bugun)` (cached by a signature of the school lists, the Türkiye, etüt, Yoklama and Konu Takibi stamps, the roster and the day) gives `olcular[measure] = {sinavlar, ogr: Map(no → series)}`, each series point `{exam, ad, tarih, g, net, okulOrt, n, sira, trOrt, sapma, beklenen, beklenenden}`; `kart(no, measure, bugun)` is one student's card; `istikrar(series)`, `etutOzeti`, `devamsizlik`, `zayifKonular` are pure. A name that should open the card is `ANALIZ.adDugmesi(no, name)` (a button with `data-ogrenci-karti`; one delegated handler opens it).

## Code and tests

`src/analiz.js`, `src/analiz.css`, `scripts/embed-analiz.cjs` (`--check` verifies). `test/analiz-regression.cjs` works the definitions out by hand on a synthetic school; `test/analiz-browser.cjs` runs the page at 1280 px and 390 px.
