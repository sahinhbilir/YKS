# Recover a past weekly plan from a photo

Teachers and students have a **Geçmiş plan kurtar** page. Teachers select a student; students recover only their own history. Then open a JPG/PNG/WebP photo, and copy the supplied AI prompt. Attach the same photo and prompt to an AI conversation, then paste its JSON response into the page. This follows the existing timetable import workflow; the website does not call an AI/OCR service or upload the image to Firebase. Rows can also be entered manually.

The user reviews the original photo alongside editable dates, topic matches, assignment types, completion states and any visible results. Unreadable dates stay empty. Ambiguous topics require selection from the catalog. A photo containing multiple weeks or students must be processed separately. The final confirmation covers the selected student as well as the extracted work.

Mixed practice and other activities use **Karışık / serbest çalışma**, without a catalog topic. The prompt distinguishes these from topic tests. Older AI responses that label **Karışık Paragraf**, **Karışık Problem** or **Karışık Geometri** as tests are corrected automatically unless there is an exact catalog match. For another unmatched activity, use **Karışık / serbest çalışma olarak kullan**, or select that type and enter its name and subject. This is available to both teachers and students. Dates, question totals and completion states are preserved; no topic, result or learning grade is created. Supplied scores remain visible for correction and must be cleared before saving as free work; they are never silently discarded. Real catalog topics, including literature’s Deneme topic, retain topic-test behavior.

## Scheduling behavior

- Confirmed test scores or recall ratings are entered on their original dates. The existing learning model rebuilds the affected topic chronologically, including any later results already recorded.
- A confirmed completed test without a score does not create a result or learning grade. It receives a short assessment repeat using the configured initial delay. A later real result takes precedence.
- Assigned work whose completion is unknown remains awaiting evidence on the teacher side. Work confirmed missed can return to the scheduler without a failing grade being invented.
- Confirmed completed lessons can restore a missing student-specific lesson date and start the normal first-review interval. Existing real dates and later learning resets are respected.
- The photographed week is stored as an issued historical plan, with its original row positions and question totals when known. Lessons and tests of the same topic retain separate slots. Future unissued weeks use the recovered history; other issued weeks remain intact.
- Daily practice targets do not add or duplicate tasks in a recovered week. The archived plan shows the activities recovered from the sheet; targets still apply to ordinary weeks.

## Preservation and delivery

Preview performs no writes. The import validates all included rows before saving. Replacing an existing week requires an explicit confirmation checkbox; overlapping week ranges are rejected. Existing results for the same student, topic and date are kept, even if the photo disagrees. Reimporting the same reviewed plan creates no duplicate history.

Before committing, the full current notebook is saved in the browser's `yks_plan_kurtarma_oncesi` entry, downloadable through **İşlem öncesi yedeği indir**. The new notebook must also persist successfully before in-memory state changes. This is a local checkpoint; it is not proof that a cloud backup succeeded. The usual server backup and conflict protections run after the import, and their status remains visible in the sidebar.

**Öğrenci hesabını güncelle** publishes the recovered package to the already-linked student account after verifying the teacher, slot and student identities. The student receives it on the next login; unsent local results still merge. Students using file packages can receive a newly exported package instead. Students automatically send their recovered history to the teacher through the existing work sync, with a retry button and a server acknowledgment shown separately from local saving. A stale student snapshot cannot replace a recovered historical week; subsequent edits to a known recovery retain its lineage and can sync normally.

Clicking a week in **Haftalar Haritası** opens its stored plan for both roles. The teacher’s missed-week decisions remain available through **Nasıl geçti?**. Recovered weeks before the current term also appear. Completed lessons remain in issued plans, and recorded scores, completed unscored work, missed work and unknown completion are labeled without assuming that one result completes a week. A past week with no saved plan shows a missing-record message instead of a newly calculated historical plan.

Tests cover parsing, ambiguity, date validation, duplicate import, replacement conflicts, chronological learning recalculation, unscored work, lesson/test slots, storage rollback, topic remapping and old student snapshots. The browser check exercises the real photo input, review controls, save action, history navigation and mobile layout with a synthetic fixture. The Firebase emulator checks publishing the recovery, subsequent student login, and the teacher's full server backup. No private student photos or production accounts are used in these tests.
