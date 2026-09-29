# YKS mock-exam feature — task transfer note

## Current state

Work is on branch `feat/mock-exam-tracking`, based on the repository default branch at commit `5df6f72`. The feature is implemented and published in draft PR #21: https://github.com/sahinhbilir/YKS/pull/21. It has not been merged or deployed.

The 2026-09-29 continuation resolved the outstanding save/print emulator failure. The initial PR CI passed the Node and browser jobs and all 75 security-rule checks, but timed out on `print-only work delivery` after the multi-device exam checks.

`ogrenciCalismasiniUygula` preferred an old per-student work timestamp over a newer local save. It also failed to carry a received work timestamp into the student's outgoing packet. It now compares both student work clocks and preserves the received version when forwarding work. Teacher notebooks still use only the relevant student's clock. The exam listener continues to persist teacher results without advancing the student's work timestamp.

## User requirements covered

- Students can enter TYT, AYT, and separate branş results.
- TYT, AYT, and branş exams have independent filters and responsive point/line graphs.
- Hover, keyboard focus, or touch selection shows the exam date, score/net, D/Y values, duration, and subject breakdown.
- AYT supports SAY/EA/SÖZ; TYT Matematik and Geometri remain separate.
- Completion time is stored separately, so a student can add or correct time without changing teacher-imported scores.
- Teachers can select PDF files, preview parsed students, correct target matches, and publish results to student cloud slots.
- Matching is strict (school number + normalized name). Class/section is not read from the PDF rows; the synthetic fixture has no class values to verify a format against. Changed roster rows are not silently reassigned.
- Duplicate rows are skipped using exam/session/score identity; a combined TYT+AYT report does not duplicate an earlier TYT-only import.
- Teacher-imported scores and student-entered scores use separate channels. Student packets cannot forge teacher records.

## Important files

- `src/denemeler.js` — feature logic, validation, PDF.js coordinate parser, graph rendering, manual entry, teacher import/publication, merge rules.
- `src/denemeler.css` — feature styles and mobile layout.
- `scripts/embed-denemeler.cjs` — embeds the two source files into `index.html`; run it after source edits.
- `firestore.rules` — rules for the protected `denemeOkul` channel and bounded student exam fields.
- `docs/mock-exams.md` — Turkish user/deployment/schema documentation.
- `test/mock-exam-regression.cjs` — pure validation/parser/merge/chart regression checks.
- `test/mock-exam-browser.cjs` — Playwright desktop/mobile UI coverage.
- `test/fixtures/mock-exam-pdf-items.json` — synthetic parser fixture; no real student data.
- `test/firebase/firestore.test.mjs` and `test/firebase/save-print-flow.test.mjs` — emulator coverage, including teacher publication and multi-device behavior.
- `index.html` (`ogrenciCalismasiniUygula`) and `test/cloud-sync-resilience.js` — work-version conflict fix and three focused regressions.

## Verification already completed

- `node scripts/embed-denemeler.cjs --check`
- `git diff --check`
- `node test/mock-exam-regression.cjs` — 11 checks passed.
- `node test/cloud-sync-resilience.js` — 101 checks passed, including three new regressions. The two student timestamp checks were reproduced failing before the fix.
- `node test/result-package-regression.js` — 20 checks passed.
- All Node regression commands from `.github/workflows/verify.yml` passed on the continuation changes.
- Full `test/firebase/save-print-flow.test.mjs` emulator run — all 26 checks passed, including live school results, personal results and duration, stale-device deletion, print delivery, logout, and recovery.
- Full `test/firebase/firestore.test.mjs` emulator run — 75 passed, 0 failed.
- Desktop and 390px Playwright checks passed during development, including manual entry, editing, graph keyboard interaction, branch/AYT separation, persistence, teacher matching, duplicate handling, publication failure, and retry.
- The original PR browser CI job passed. Local Chromium could not start in the continuation environment; use the latest PR CI browser job to verify the continuation changes.
- The three supplied PDFs were tested privately: 29 TYT; 29 TYT + 22 AYT in the combined report; 29 TYT in the readiness report. PDFs and extracted student data were not added to Git.

## Deployment order

1. Deploy the updated `firestore.rules`.
2. Serve the regenerated `index.html` (run `node scripts/embed-denemeler.cjs`).
3. Test with one teacher account and two student devices before broad school use.

PDF parsing currently supports the supplied `DENEME SINAVI TOPLU SONUÇ LİSTESİ` coordinate layout. Scanned-image/OCR PDFs and unrelated publisher layouts fail clearly instead of being assigned incorrectly. PDF.js compatibility builds are loaded lazily from the pinned jsDelivr version.

## Verification commands and remaining work

Use Node.js 22 or later and Java 21 on `PATH`; the previous handoff's absolute runtime path was temporary. Install the pinned Firebase dependencies with `npm ci --prefix test/firebase`, then run:

```bash
node scripts/embed-denemeler.cjs --check
node test/mock-exam-regression.cjs
node test/cloud-sync-resilience.js
test/firebase/node_modules/.bin/firebase emulators:exec --only firestore --project demo-yks-test "node test/firebase/firestore.test.mjs"
test/firebase/node_modules/.bin/firebase emulators:exec --only firestore --project demo-yks-test "node test/firebase/save-print-flow.test.mjs"
```

The existing `.github/workflows/verify.yml` runs all Node, desktop/mobile browser, and emulator suites on branch pushes and PR updates. Confirm its status on the latest PR head before merging. No additional feature work is identified in this handoff. Deployment and the teacher/two-student-device smoke check above remain release tasks.

Do not add the supplied PDFs, generated PDF JSON, screenshots, emulator logs, or runtime downloads to the repository.
