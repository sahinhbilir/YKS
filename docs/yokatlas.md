# YÖK Atlas catalogue

`data/yokatlas.json` is a static public catalogue built from the official [YÖK Atlas](https://yokatlas.yok.gov.tr/) `tercih-kilavuz/search` and `netler/search` API snapshots. It uses the 2026 programme catalogue and 2025 historical placement data; the output records both years and the retrieval timestamp. Historical nets describe the last placed candidate, not an admission probability or guarantee. Missing or inconsistent historical values are left unavailable.

The picker includes bachelor's programmes in SAY, EA and SÖZ physically located in İstanbul, Ankara, Eskişehir, Kocaeli or İzmir, at state universities or foundation universities with a full tuition scholarship (`bursOraniId=158`, Burslu). It excludes KKTC nationality-restricted quotas and identified foreign campuses. The physical programme city is used rather than the university headquarters.

Rebuild from a populated local cache without refreshing source responses:

```sh
python scripts/build-yokatlas.py --cache-dir ../yok-inspect/cache --output data/yokatlas.json
```

To update from the official source, use a cache directory and add `--refresh`. The builder fetches public programme data only. It does not read student records, credentials or a cloud notebook; the catalogue is a static website asset outside the notebook.

## Üniversite hedefi page: estimate and lists

**Teacher-only.** The page (`src/yokatlas.js`) is in the teacher's Denemeler menu only. Students have no Üniversite Hedefi: it is not in `SEKME_OGRENCI` / `MENU_OGRENCI`, and a student who lands on `EK.sekme==='universite'` (restored tab, typed link) is sent to `plan` in `cizIc`. The teacher picks the student with the page's own selector and sets `universiteHedef`, `diplomaNotu` and (via the button below) `denemeHedef` for that student; a read-only teacher can change nothing.

The page places the student between the programmes by an estimated YKS puan: the 24 programmes just above, the line, the 24 highest at or below. Nothing about the student is sent anywhere; the model is refitted from the catalogue in the browser once per page session.

**Model (per alan).** Least squares over the programmes that have a net profile: `puan ≈ a + b·TYT + c·AYT + d·OBP`, where TYT and AYT are the totals of the last placed student's nets (`nets.values`: TYT `tr, sos, mat, fen`; AYT the alan's keys), OBP is `nets.obp` and the target is `nets.points`. Totals are used throughout so exams and the Gidişat projection (also totals) share the model. Fit on the 2025 catalogue (2026-10-29 build):

| alan | programmes | a | b (TYT) | c (AYT) | d (OBP) | residual SD |
|---|---|---|---|---|---|---|
| SAY | 1563 | 129.80 | 1.274 | 2.714 | 0.119 | 2.7 puan |
| EA | 1025 | 127.63 | 1.246 | 2.866 | 0.121 | 2.3 puan |
| SÖZ | 460 | 131.00 | 1.244 | 2.830 | 0.110 | 4.8 puan |

The residual SD is only the error of turning nets into a puan, so it is **not** shown as the uncertainty of the estimate (it stands in the small line under it as "net→puan dönüşüm hatası ± x"). The uncertainty a teacher needs is how far the student's own exams move: **Son denemelerinin en düşük ve en yüksek netleriyle: 281,4 – 312,0 puan** (`puanAraligi`: the lowest TYT with the lowest AYT total and the highest with the highest, over the newest 5 usable exams of each session, with the matching başarı sırası range). With fewer than 3 usable exams in a session the page says a range needs 3 and that an estimate from a single exam can move by tens of points. The student's OBP is the optional **Diploma notu** (50-100, `diplomaNotu` on the student, set by the teacher, validated in `yedekDogrula`) × 5; empty counts as 95 (OBP 475), since all students are at a private school, and the page says so. `test/yokatlas-regression.cjs` asserts these coefficients within tolerance.

**Başarı sırası.** A monotone fit of the catalogue's taban `points` to `rank` per alan (pool-adjacent-violators on `-log(rank)`, linear between block means, clamped to the best and worst taban rank), rounded to 500 above 10.000, 100 above 1.000, 10 above 100. A higher puan never gives a worse rank (tested).

**Exam list.** Primary source: the school's own result lists, `DPANO.veriAl().t.sinavlar` (the same lists as the Denemeler · TYT / AYT table, Sıralamalar and the Öğrenci kartı / Gidişat). Each exam carries its students' nets by school number (`s.tyt[no].net`, `s.ayt[no].net`), matched with `String(student.no)`. Exams imported with "PDF ekle" are school lists; their rows are also published to the matched students as copies (docs/siralamalar.md), and `ogrenciDenemeKayitlari` (`denemeListe`) merges list rows, copies and own entries for every view. A school exam is listed for a student who sat that session in it. TYT is usable when each of Türkçe, Sosyal, Matematik and Fen has a printed net; AYT when `SIRALAMA.took(o, alan)` holds (every test of the alan attempted); the totals are the sums of those nets (`kapsam`-equivalent values). Otherwise it is shown disabled with "eksik: …". After the school exams come the student's own `denemeListe` entries that match no listed school exam. The match is the normalised exam name (case, spacing, diacritics) and the session; the date is ignored, because a student's copy often carries another date. When matched, the school row wins and the copy is not listed. An unmatched entry keeps its own nets: a student-entered one is labelled "(öğrenci girdi)", a teacher-sent copy (`denemeOkul`) is not. Labels are `tarih · ad` with the school exam's own date, newest first. When the lists cannot be read, or the student is not in them, only the student's entries remain.

**Centre.** *Son deneme* (default): the newest usable TYT and AYT of that list. *Önceki deneme seç*: every exam of that list, Tarama and Genel alike; one missing a test is shown but disabled with "eksik: Fizik". *Gidişat (YKS günü)*: `ANALIZ.kart(no, 'TYT' | 'AYT:<alan>').gidisat.yks.net`, the Öğrenci kartı projection; it needs the school's Sıralamalar lists, which the teacher session always has; it is disabled (with the reason) only when the lists lack the student or the exam. The alan can be switched only where the centre's AYT has that alan's tests.

**Lists.** Programmes without a net profile or puan are not placed; a search still finds them under "Puan verisi yok". Şehir, üniversite türü and the search filter both lists; "Daha fazla" reveals 24 more each way.

**Targets.** "Hedef olarak seç" / "Hedefi kaldır" store only `universiteHedef`; the pinned card reads "Hedefe +X puan". Net goals (`denemeHedef`) change only through the separate, confirmed button "Net hedeflerini bu programa göre ayarla".

**Sync.** `universiteHedef` and `diplomaNotu` are teacher-owned. Setting the target or diploma notu leaves the student's `ogrCalismaTs` alone, because student packets no longer carry these fields; bumping it would only make the student's next real packet look older and skip their other changes. Applying a programme's net goals (`denemeHedef`, still student-editable) bumps it, like other teacher edits to student work. The student→teacher work-packet import (`ogrenciCalismasiniUygula`) no longer copies `universiteHedef` or `diplomaNotu`, even from a newer packet, so an old student build cannot overwrite them; `denemeHedef` is still copied. The teacher→student packet still carries both fields (nothing on the student side renders or edits them), and `yedekDogrula` still validates them so old backups load.

## Students and "Her dersin en iyisi"

- **Students** have the page as a tab of its own, **Üniversite hedefi** (YKS students only), for their own notebook, and set it themselves: the diploma notu, the target programme and the net goals from it (`ogretmenIslemi` allows the teacher for the selected student and the student for their own). A student's choice stays on the student's device: the teacher's import of the student's work carries neither these fields nor the net goals (`denemeHedef`), so what the teacher chose is never replaced by the student's.
- **Merkez → Her dersin en iyisi** (`merkezBul(…, 'eniyi')`): over every usable exam of the session, each branch's best net is taken (TYT: Türkçe, Sosyal, Matematik, Fen; AYT: the alan's tests) and the bests are totalled. A line under the estimate names each best and its exam. Exams with a missing branch are not used (a missing lesson is not a 0).
