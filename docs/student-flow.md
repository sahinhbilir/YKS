# Automatic student flow

Students should study and enter their results without managing the scheduler.

## Daily interface

The student navigation is Planım, Sonuç gir, Karnem and Ayarlar. The plan is read-only by default and offers one download action. Detailed editing, topic planning, historical decisions, personal routines, data recovery and algorithm controls remain accessible through Gelişmiş ayarlar. Teacher navigation and manual tools remain available.

Basic settings contain daily test capacity and rest days. They save automatically and affect upcoming plans. The current issued plan stays intact. Each result requires an actual score: blank rows are never scored as correct, incorrect or completed. Saving a partial set stays on that week's results; saving the complete set opens the upcoming plan.

## Plan lifecycle

1. On opening or saving a student notebook, fill the topic horizon from its class timetable. Teacher packets now include that class's topic plan and timetable. For older packages, use a built-in class timetable only when none is present.
2. Prepare and persist a lightweight snapshot for the immediately upcoming week in `ogrTaslak`. This is still a live preview and is recomputed after results or settings change.
3. On the next visit, promote any elapsed prepared week into the existing immutable `elle` snapshot format **before** recalculating the current plan. A student returning only on Sunday therefore retains the Monday–Saturday result rows.
4. Automatically preserve the current week's plan if it has work and no existing snapshot. Existing teacher/manual snapshots are not overwritten.
5. Downloading the preview does not freeze or unfreeze it. No confirmation or Monday visit is required.

## Catch-up and workload

Students joining late automatically receive the earlier curriculum topics in their personal topic pool. Missing scores remain unknown; their work re-enters the queue without altering FSRS grades or learning history. Advanced settings can disable automatic catch-up and exclude unstarted topics introduced by it. Submitted results and existing weekly snapshots are retained.

Normal weeks keep the existing recall-based one/two-test rule. In overloaded student weeks, previously successful topics (last score at least 80%) can receive one 12-question test instead of two. Weak topics retain two tests. Reviews take priority over new topics when overloaded; placement can reuse earlier free days. A one-test daily capacity permits one initial test rather than starving all two-test items. No new work is placed on or after the exam date.

This is workload management, not a guarantee of zero overdue work or measured 90% retention. Finite capacity and weekly-only feedback can still cause delays. The balancing option is reversible in advanced settings.

## Background result sync

Successful local saves queue background sync. Startup, connection recovery and returning to the tab also check for remote results. A Firestore transaction merges remote scores with the local snapshot before updating the result package, retaining newer corrections and other-device results. Failed sync retries with bounded exponential backoff. A first anonymous legacy-package connection binds its UID without replacing the server's result package. Account changes cancel stale work.

The UI reports result-sync status, not a claim that every notebook setting or draft has been backed up to the cloud. Local weekly snapshots remain device-local until included in a notebook backup; the existing server result schema is unchanged.

## Validation

`node test/student-automation-regression.js` exercises eight Sunday-only weeks with deterministic synthetic scores, draft downloads, week transitions, serialization/reload, historical-plan stability, partial results, late joining, missed weeks, catch-up reversal, capacity changes, result merging, retry and account isolation. It makes no real Firebase writes. The other four Node regression suites cover teacher compatibility, result packages, cloud behavior and timetable imports. CI runs all five suites.

The generated student-plan and settings markup was inspected for primary controls and duplicate IDs. A local-file browser preview was blocked by the browser's URL policy; no visual-browser pass is claimed. Production Firebase App Check behavior still depends on deployment configuration.
