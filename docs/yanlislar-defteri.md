# Yanlışlar defteri

Teacher page under **Denemeler → Yanlışlar defteri** (same roles as Konu Takibi: the guidance teacher; students
never see it). It prints, for each student of one exam, only the questions the student got **wrong or left empty**,
cut out of the A booklet as pictures, so the student can solve them again.

## Files

Three inputs, each with a short ✓ status once read. Nothing is stored: not in localStorage, not in the notebook
(`D`), not in Firestore, and nothing is sent anywhere. The files stay in the page's memory; reloading or logging out
clears them, and uploading again is how the teacher reprints.

1. **Soru kitapçığı (A)**, PDF. Each test is found by its page header code (`2026-27-TYT/TÜR-1203`) and its count
   ("Bu testte N soru vardır"). A question start is an item "12." at the left edge of a column, first on its line, and the
   next number of that test; numbers inside tables or the instruction block fail one of those. A question's picture runs
   from its number to the next start in the same column (or to the footer rule). A shared passage or notice
   ("35 - 36. soruları aşağıdaki parçaya göre …") is added in front of each question it covers; a passage with tables across
   both columns is cut across the page. Each page is rendered once at scale 2 and the pictures are copied out of it.
   If the found count differs from the declared one the file is refused with the test and the missing number.
2. **Cevap raporu**, `.xlsx`. Read by header text, not column letters (shared or inline strings). Sections (TÜRKÇE-T, …)
   are filled into the booklet tests in order by their question counts; if they do not fit, a Turkish error is shown.
3. **Çözüm kitapçığı**, PDF with "A-n / B-m" labels. Needed only for B students. It is accepted only after the other two
   are loaded, and refused as a whole unless every test's A and B numbers are permutations of 1..N, every pair stays in
   one section, and `keyA[a] = keyB[b]` for every pair. If a later booklet or report no longer fits it, it is dropped.

## Privacy

- The cevap raporu has a `TC Kimlik No` column. The header row is located first and the cells of that column are never
  read (not even their shared strings). Any 11 digit number found anywhere else is dropped. The parsed model has no TC
  field. `test/yanlislar-regression.cjs` checks that `JSON.stringify` of the model has no 11 digit number, and that the TC
  cells are not opened.
- Konu Takibi still refuses this file (`GIZLI` / `CEVAP_RAPORU`); only this page accepts it, in memory.
- Tests and fixtures use made-up students and booklet text only.

## The page

Filters: **Şube**, **Öğrenci** (one student), and a checkbox per ders (for sections not taken). **Yazdır** prints the
filtered set. On screen the questions are one column; on paper A4 portrait, two per row when they fit (a question with a
full-width passage takes a row), never split across pages.

- Each student starts on a new page: name, Öğrenci No, şube, exam name, "12 yanlış · 5 boş"; questions grouped by ders in
  booklet order, each with "Soru 12" and "Senin cevabın: C" or "Boş". A student without wrong or empty questions is shown
  on screen but not printed.
- **Doğru cevaplar** are on a separate last page of that student's defter, so the student tries first.
- **Din Kültürü / S.Felsefe**: if a student left one of them entirely blank and answered at least one question of the
  other, the blank one is skipped. Other untaken sections are not guessed; untick them.
- **B booklet students** get the A pictures labelled "Soru 12 (B kitapçığında 7)" and their answer key in their own B
  numbers. Without the çözüm file they get a numbers-only list by B number per ders and the line "B kitapçığı: sorular
  kendi kitapçığından çözülecek".

## Tests

`node scripts/embed-yanlislar.cjs --check && node test/yanlislar-regression.cjs` (parsing, TC, selection, mapping, map
validation, markup) and `node test/yanlislar-browser.cjs` (real pdf.js on a generated booklet, crops, filters, print
to PDF, 1280 and 390 widths). Source: `src/yanlislar.js`, `src/yanlislar.css`.
