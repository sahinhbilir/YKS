# Logout and reset recovery

`Kaydet ve çıkış yap` now finishes a persistent weekly plan edit using the same snapshot operation as `kaydet ve kapat`. A read-only print/download preview or an empty work picker does not block logout. Typed work names, unsubmitted results, changed settings and photo recovery forms still require their own save action. Cloud upload and server read-back must succeed before sign-out and browser cleanup.

Settings replaces the ambiguous destructive reset with:

- **Tarayıcı verilerini sıfırla** (teacher and student): after confirmation, stops scheduled sync, waits for existing writes, signs out, and removes only the application's `yks_` entries. It starts no new upload. Already running writes may finish. Unsynced local work is intentionally discarded; cloud data is preserved. Other tabs, failed sign-out and failed storage cleanup block deletion.
- **Bulut verilerini sıfırla** (teacher): opens a dated backup picker. This restores the teacher notebook to an existing backup rather than deleting the cloud history. Student accounts and devices are not rewritten. A transaction archives the exact current local and cloud notebooks and then replaces the live cloud notebook. It requires an unchanged cloud version from the picker, verifies the server copy, and only then replaces local state. A stale selection must be refreshed. Failed or ambiguous writes retain the local notebook and invalidate the upload baseline to prevent automatic overwriting of a possibly successful restore.

Teacher backups now create one immutable `geriNoktalari/gun-baslangici-YYYY-MM-DD` record before the first cloud overwrite of a real calendar day in Europe/Istanbul. Subsequent saves cannot replace that record. This uses the already deployed create-only recovery-point rules. Existing end-of-day backups remain available. Versions never archived by older releases cannot be reconstructed.

After cloud rollback, automatic incoming student sync remains paused across reloads (`bulutGeriAlma` in the restored notebook). Settings explains this; `Buluttan sonuçları çek` offers an explicit confirmation to resume, since full-history student packets can reintroduce reverted records. The rollback can itself be undone using the newly created protection points. Local before/target copies are retained as an additional recovery aid.

Validation: regression cases cover hidden edits, previews, local-only reset and failures, immutable start-of-day copies, rollback/undo, offline and rejected writes, read-back mismatch, stale selection, quota failure, other tabs and teacher/student scope. Browser checks exercise the visible backup picker, reset confirmation, hidden-edit logout and fresh login with synthetic data. Firebase rules and save/read-back suites remain required in CI.
