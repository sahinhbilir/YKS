# Toplu öğrenci ekle: adding a whole school list at once

The teacher's **Öğrenciler** page has a folded **Toplu öğrenci ekle** card under the
single "Öğrenci ekle" row. It takes a pasted school list, shows a preview and adds every
new student in one save.

## What can be pasted

- **Myexamy.** Öğrenci İşlemleri → "Excel olarak dışarı aktar", open the file, select all
  and copy. The page text itself (one cell per line) is read too.
- **Any Excel or CSV list** with a header row: tabs or semicolons, columns in any order.
  Recognised headers: `No` / `Okul No` / `Numara`, `Adı Soyadı` (or separate `Adı` and
  `Soyadı`), `Sınıf` / `Kademe`, `Şube`, `Alan`.
- **Rows without a header** are read when each one starts with the school number followed
  by the full name.

From each row the card reads:

| Field | Accepted forms | Stored as |
| --- | --- | --- |
| No | 1–9999 | `no` |
| Ad soyad | at least two words | `ad`, as written |
| Sınıf | `9. Sınıf`, `12`, or taken from the şube | `sinif` |
| Şube | Myexamy `201 12/B` → `201`; `12/B`, `12-B` → `12/B`; any text under a `Şube` header | `sube` |
| Alan | SAY, EA, SÖZ, DİL (also MF, TM, TS, Sayısal, Eşit Ağırlık, Sözel) | `alan` |

Myexamy's şube codes (`201`, `205`, `301`) are the codes of the built-in 12th-grade
timetables, so 12th graders land in their class programmes directly.

## Preview

**Önizle** reads the text and lists every row as *eklenecek* or with the reason it will be
skipped:

- `Numara yok`, `Ad soyad yok`, `Sınıf okunamadı`, `Şube okunamadı`;
- `Sınıf ile şube uyuşmuyor` (e.g. `11. Sınıf` with `201 12/B`);
- `Listede iki kez var`: the same number appears twice in the paste;
- `Zaten listede`: same number and same name (case and spacing ignored);
- `Bu numara … adına kayıtlı`: the number belongs to another student;
- `Aynı adla kayıtlı (No …)`: the name is already in the list with another number;
- `… şubesi N. sınıf`: the şube already holds another grade;
- `… hazır 12. sınıf şubesi`: a 9–11 student in a built-in 12th-grade şube;
- `Alan yok`: an 11th or 12th grader without an alan whose şube gives none.

Deleted students do not block numbers or names. Above the table, one line per şube shows
the grade, the number of new students, whether the şube is new and, for 9–11, the plan
start.

Defaults:

- **Alan.** The row's own value, otherwise the şube's (its existing students, or the
  built-in programme). 9th and 10th graders without one get SAY; their school curriculum
  does not depend on it.
- **9–11 plan başlangıcı.** An existing şube keeps its date. A new şube takes the date in
  the "9–11 plan başlangıcı" field of the single-add row (this Monday by default). It can be
  changed later per şube on the Müfredat page.
- **Günde kaç test.** The value in the single-add row (6 by default).

Editing the text after a preview turns the add button off until the next preview.

## Adding

**N öğrenciyi ekle** asks for confirmation, then:

1. adds each new row as a student with `aktif: false`, like the single add: a student
   becomes "kullanıyor" when their plan is first printed;
2. builds the default topic plan for each new şube (`varsayilanKonuPlaniniHazirla`);
   existing şube plans are not touched;
3. saves once. The cloud backup follows as after any save.

If the notebook would pass the whole-notebook limit (`DEFTER_HAM_UST_SINIR`, 2 500 000
bytes of JSON; the cloud copy is compressed, see docs/cloud-notebook-recovery.md), nothing is added and the card asks to split the list. A 98-student school list with
six new şubeler adds about 130 KB.

The card is hidden in view-only mode, and the add step refuses there.

## Tests

- `node test/toplu-ogrenci-regression.cjs`: parsing (Myexamy text, Excel with headers in
  any order, header-less rows), every skip reason, defaults, the add step, view-only, the
  size rollback, the card and its buttons.
- `node test/toplu-ogrenci-browser.cjs` (Playwright): preview, stale-preview guard and
  adding on desktop, phone and dark mode.

Fixtures use synthetic names only.
