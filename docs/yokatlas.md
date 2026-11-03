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

The page shows the SD as "± x puan". The student's OBP is the optional **Diploma notu** (50-100, `diplomaNotu` on the student, set by the teacher, validated in `yedekDogrula`) × 5; empty counts as 95 (OBP 475), since all students are at a private school, and the page says so. `test/yokatlas-regression.cjs` asserts these coefficients within tolerance.

**Başarı sırası.** A monotone fit of the catalogue's taban `points` to `rank` per alan (pool-adjacent-violators on `-log(rank)`, linear between block means, clamped to the best and worst taban rank), rounded to 500 above 10.000, 100 above 1.000, 10 above 100. A higher puan never gives a worse rank (tested).

**Centre.** *Son deneme* (default): the student's latest usable TYT and AYT. *Önceki deneme seç*: every TYT and AYT record, newest first, Tarama and Genel alike; one missing a test is shown but disabled with "eksik: Fizik". *Gidişat (YKS günü)*: `ANALIZ.kart(no, 'TYT' | 'AYT:<alan>').gidisat.yks.net`, the Öğrenci kartı projection; it needs the school's Sıralamalar lists, which the teacher session always has; it is disabled (with the reason) only when the lists lack the student or the exam. The alan can be switched only where the centre's AYT has that alan's tests.

**Lists.** Programmes without a net profile or puan are not placed; a search still finds them under "Puan verisi yok". Şehir, üniversite türü and the search filter both lists; "Daha fazla" reveals 24 more each way.

**Targets.** "Hedef olarak seç" / "Hedefi kaldır" store only `universiteHedef`; the pinned card reads "Hedefe +X puan". Net goals (`denemeHedef`) change only through the separate, confirmed button "Net hedeflerini bu programa göre ayarla".

**Sync.** `universiteHedef` and `diplomaNotu` are teacher-owned. Setting the target or diploma notu leaves the student's `ogrCalismaTs` alone, because student packets no longer carry these fields; bumping it would only make the student's next real packet look older and skip their other changes. Applying a programme's net goals (`denemeHedef`, still student-editable) bumps it, like other teacher edits to student work. The student→teacher work-packet import (`ogrenciCalismasiniUygula`) no longer copies `universiteHedef` or `diplomaNotu`, even from a newer packet, so an old student build cannot overwrite them; `denemeHedef` is still copied. The teacher→student packet still carries both fields (nothing on the student side renders or edits them), and `yedekDogrula` still validates them so old backups load.
