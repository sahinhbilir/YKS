# Result saves and printing must reach the teacher

The previous implementation had several separate gaps: Firebase's persisted student login could be replaced with anonymous login before initialization finished; PDF preview did not save or upload; the teacher only imported student changes through a manual button; and the result packet omitted issued plans and completed lessons. Signing in again also replaced unsent local work with the older published package.

## Changed behavior

- Student sync waits for Firebase authentication initialization. A published account recovers through the existing name-and-number login and verifies its UID. Student login credentials are unchanged.
- Saving results and printing initiate synchronization. Printing writes the current notebook to local storage before opening the print dialog. Preview still does not freeze a future week. The server confirmation appears separately, after the upload transaction succeeds.
- Student packets include a validated work snapshot alongside the existing result history. Issued plans, completed lessons, postponements, week status and supported personal settings merge into the matching student's notebook. Topic IDs are translated for custom curricula. Oversized or malformed snapshots fail visibly without clearing local work.
- An authenticated teacher listens to the known student slots. Server-confirmed updates are imported automatically and initiate the teacher's full-notebook backup. Open input fields are not redrawn. Listener failures and backup failures are visible in the sidebar.
- Signing in as the same student merges unsent local results and work with server data. Before replacing a student session, its notebook is retained in the browser's `yks_ogrenci_kurtarma` recovery entry. A storage failure stops replacement.
- Pending student work retries when connectivity returns or the app reopens. Backgrounding or leaving the page also attempts an immediate upload. Browsers can suspend network activity while printing or closing: local persistence is immediate, but only **Sunucuya kaydedildi** confirms server receipt.

The teacher must be signed in and have the linked roster to receive updates. If the teacher is offline, student uploads remain in their server slots for import when the teacher returns. Existing cloud-backup conflict and empty-notebook protections remain active; see [cloud notebook recovery](cloud-notebook-recovery.md). This is not a server-side background worker or automatic conflict merging between two teacher devices.

## Verification

Application regressions cover persisted-login timing, correct student account recovery, custom-topic work snapshots, atomic rejection of malformed work, local PDF saving and unchanged plan-freezing behavior. The Firebase emulator integration uses the actual application save/print handlers, two authenticated Firestore clients, real listeners and transactions, and the repository's security rules. It checks delivery through the student slot to the teacher notebook and backup, offline retry, same-account relogin, fresh-browser recovery and print-only changes.

Firebase references: [authentication initialization](https://firebase.google.com/docs/reference/js/auth.auth#authauthstateready), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), and [snapshot listeners and metadata](https://firebase.google.com/docs/firestore/query-data/listen).

Production OAuth, App Check configuration and the user's private cloud data are outside these tests. This repair does not establish whether earlier missing data still exists. Recovery requires a surviving browser copy, server snapshot or exported backup.
