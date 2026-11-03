# Annual storage capacity test — 2 November 2026

The first reproduced limit is in the app, before Firebase's total storage quota. For **99 students, with 31 taking weekly mocks**, the Sıralamalar source-list store rejects week 23 of the modelled year. A Firebase plan upgrade alone would not change this limit.

Tested source: `a11cbfc064a8a3546c7e93abb649c15218d76754`. The complete published HTML at https://ykstekrar.com matched that source during this audit. No production account or student data was read or changed.

## Workload and results

The baseline models 36 teaching weeks / 180 attendance days, eight lessons per day, 99 students, and two etüt requests per student per week. It includes one weekly TYT for 31 students and an additional AYT every other week: 1,674 individual school-result records. It uses deterministic, varied attendance, bounded correct/wrong counts, full ranking fields, and matching source-list/student results. Holidays are not calendar predictions: “week 23” means the 23rd batch in this workload.

The other 68 students have no exams in the baseline. Their occasional exams, Konu Takibi, homework, saved weekly plans, study logs and other growing features are excluded, so these are core-data estimates, not a complete account-size guarantee. Etüt frequency and alternate-week AYT are assumptions, not facts supplied by the user.

| Baseline component | End-year raw size | Current app cap | Actual import result |
| --- | ---: | ---: | --- |
| Yoklama: 99 × 180 days | 65,251 B | 250,000 B | All 36 batches accepted |
| Etüt: 7,128 requests | 163,199 B | 300,000 B / 15,000 rows | All 36 batches accepted |
| Sıralamalar: 36 exam events | 544,545 B projected | 350,000 B / 40 events | Week 23 refused: 354,081 B; week 22 retained at 332,580 B |
| Full notebook, including individual exam copies | 1,975,337 B projected | 2,500,000 B raw budget for growing report imports | Core estimate leaves only 524,663 B for other features |
| Same full notebook after actual app compression | 292,824 B projected | 900,000 B stored snapshot string | Codec and backup size guard pass; decode is byte-identical |

**Projected** means constructed with the app's packing functions while deliberately bypassing import size guards. The full-year notebook cannot currently be reached through all normal imports because the ranking module stops earlier. A Sıralamalar failure is not necessarily a failure to save the individual mock results: the Denemeler importer catches source-list storage errors separately.

| Sensitivity scenario | Reproduced module failure | Projected full-year raw / compressed size |
| --- | --- | ---: |
| Same 99/31, four etüts per student per week | Etüt week 34: 302,879 B; old 294,083 B retained | 2,132,597 / 317,032 B |
| Same 31 weekly; other 68 take TYT every fourth week (9 each) | Ranking week 17: 357,682 B; old 317,403 B retained | 2,558,863 / 383,036 B |
| Conservative bound: all 99 take weekly mocks | Ranking week 7 | 5,766,857 / 957,140 B |

The occasional-exam sensitivity exceeds the configured raw budget even before topic tracking, homework or saved study plans. Every actual rejected module import in the test preserved its previous data byte-for-byte. These tests do not establish that a complete year's data will be lost; they establish where further retention is refused.

## Firebase quota versus app architecture

Firestore Standard's free database includes **1 GiB storage, 50,000 reads/day, 20,000 writes/day and 10 GiB/month outbound transfer**. Its **1 MiB document limit** also applies on paid plans. See [Firebase quotas](https://firebase.google.com/docs/firestore/quotas).

The current core workload does not demonstrate a need for paid storage. However, the architecture stores the entire teacher notebook in one compressed document, and keeps full daily history and start-of-day recovery snapshots without automatic retention. A constant 292,824-byte snapshot repeated for a current copy plus roughly two copies per active day would use about **101 MiB over 180 active days**, or **204 MiB over 365**. These are illustrative payload-only calculations, not measured Firebase usage; other documents, indexes, restore points and independent notebooks add storage.

Instrumenting the actual backup handler against a memory transport showed:

- Initial backup: 1 document read, 2 writes.
- Existing backup, including an unchanged notebook: 2 reads, 2 writes.
- First changed backup of a day: 2 reads, 3 writes.
- Opening backup history retrieves the full snapshot documents, even though the UI displays only metadata.

At the baseline year-end size, two full-snapshot reads per backup across 22 active days imply approximately 0.24 GiB/month at 20 backups/day, 2.4 GiB at 200/day, or 12 GiB at 1,000/day. These are activity scenarios, not observed rates or invoices. Rule-dependent reads, listeners, student synchronization, retries and serialized-response overhead add usage; see [Firebase billing rules](https://firebase.google.com/docs/firestore/pricing). The app can therefore exhaust bandwidth without exhausting total stored data.

## Browser test

In a fresh, isolated Chrome origin, the actual projected baseline notebook compressed to **292,824 B**, decoded identically, and saved to localStorage. A second full local recovery copy fitted. A third copy failed with `QuotaExceededError`; the original remained intact. The app has several full-notebook recovery keys, so their shared origin capacity matters. This is a reproduced browser configuration, not a universal quota guarantee for every device.

## Recommended changes

1. Store school data in bounded records grouped by academic year, module and period, with student/exam identity shared consistently. Retain a hard per-document safety limit and test a full year through the real import and restore paths.
2. Replace indefinite full-notebook history with an explicit recovery policy and lightweight history metadata. Recovery needs to remain reliable while old copies stop accumulating indefinitely.
3. Avoid rewriting unchanged full notebooks and downloading every historical payload to list backups. Synchronize changed records and fetch historical content only when selected.
4. Move large local datasets and recovery versions to IndexedDB with explicit quota/error handling. Preserve a recoverable copy before migration.
5. Add a capacity/usage view distinguishing module caps, raw local data, compressed cloud documents, retained history and live Firebase quotas.

The immediate engineering priority is storage partitioning and reliable recovery, rather than choosing a paid plan from this test alone. Actual project quota headroom still requires the Firebase Usage dashboard; it was not accessed here. The local Firebase emulator does not enforce the free-tier daily/monthly quotas, so no emulator result is presented as a quota test.

## Reproduce

Run from this checkout:

```powershell
node test/annual-data-capacity.cjs --out annual-capacity.json --snapshot-out synthetic-year.json
node test/backup-capacity-audit.cjs --snapshot synthetic-year.json --out backup-capacity.json
node test/local-storage-capacity-browser.cjs --snapshot synthetic-year.json --out browser-capacity.json
```

The browser command needs Playwright on `NODE_PATH`; set `YKS_CHROMIUM` to the installed Chrome executable if bundled Chromium is unavailable. All fixtures are invented. Machine-readable results are in `docs/diagnostics/`.

Source evidence: `src/yoklama.js` (module cap and guarded write), `src/etutler.js` (row/byte limits and guarded write), `src/siralamalar.js` (exam-list cap), `index.html` (backup codec, whole-notebook transaction, history listing and localStorage save), and `firestore.rules` (900,000-character snapshot cap and history deletion restrictions).
