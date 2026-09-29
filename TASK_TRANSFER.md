# YKS mock-exam feature — task transfer note

## Current state

Work is on branch `feat/mock-exam-tracking`, based on the repository default branch at commit `5df6f72`. The requested mock-exam workflow is implemented in the single-file app and is ready to be reviewed/merged after the commit containing this note.

## User requirements covered

- Students can enter TYT, AYT, and separate branş results.
- TYT, AYT, and branş exams have independent filters and responsive point/line graphs.
- Hover, keyboard focus, or touch selection shows the exam date, score/net, D/Y values, duration, and subject breakdown.
- AYT supports SAY/EA/SÖZ; TYT Matematik and Geometri remain separate.
- Completion time is stored separately, so a student can add or correct time without changing teacher-imported scores.
- Teachers can select PDF files, preview parsed students, correct target matches, and publish results to student cloud slots.
- Matching is strict (school number + normalized name + class/section when available). Changed roster rows are not silently reassigned.
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

## Verification already completed

- `node scripts/embed-denemeler.cjs --check`
- `git diff --check`
- `node test/mock-exam-regression.cjs` — 11 checks passed.
- Existing Node regression suites, cloud-sync resilience, and Firestore rules suites passed before handoff.
- Desktop and 390px Playwright checks passed during development, including manual entry, editing, graph keyboard interaction, branch/AYT separation, persistence, teacher matching, duplicate handling, publication failure, and retry.
- The three supplied PDFs were tested privately: 29 TYT; 29 TYT + 22 AYT in the combined report; 29 TYT in the readiness report. PDFs and extracted student data were not added to Git.

## Deployment order

1. Deploy the updated `firestore.rules`.
2. Serve the regenerated `index.html` (run `node scripts/embed-denemeler.cjs`).
3. Test with one teacher account and two student devices before broad school use.

PDF parsing currently supports the supplied `DENEME SINAVI TOPLU SONUÇ LİSTESİ` coordinate layout. Scanned-image/OCR PDFs and unrelated publisher layouts fail clearly instead of being assigned incorrectly. PDF.js compatibility builds are loaded lazily from the pinned jsDelivr version.

## Next AI should do

1. Rerun the full emulator command below and inspect the complete log, because the last run was interrupted after the first five legacy flow checks while the new multi-device exam checks were being added:

   ```bash
   PATH="/workspace/scratch/763c9520cbc4/test-runtime/jdk-21.0.12.1+1-jre/bin:$PATH" \
   test/firebase/node_modules/.bin/firebase emulators:exec --only firestore --project demo-yks-test \
   "node test/firebase/save-print-flow.test.mjs"
   ```

2. If it passes, commit/push the branch and open the pull request. If it fails, fix only the failing regression and rerun the focused plus full suites.
3. Review the diff for product wording and run the existing CI workflow after push.

Do not add the supplied PDFs, generated PDF JSON, screenshots, emulator logs, or runtime downloads to the repository.
