# Connected, but the teacher notebook is missing

The Settings `bulutBaglan` handler signed in, reserved local student slots, then immediately uploaded the local notebook. It never called the full-notebook download used by initial teacher setup. Connecting an empty device could therefore replace both the latest backup and that day's snapshot. The previous Google authorization fix did not fix this separate data-loading bug.

## Corrected behavior

- Connecting now reads the latest notebook from the server and offers to restore it, showing the account, date, student count and result count. Settings also has **Buluttaki defteri aç** for an existing session. Neither action uploads the local notebook as the latest cloud copy. Student slot reservation remains in package export and account publishing.
- An existing local teacher notebook is preserved in a separate immutable restore point before it is replaced. Failed local persistence is not reported as successful restoration. Initial setup uses the same download flow and directs failed retries to Settings, without suggesting a data reset.
- Automatic backup pauses during connection/restoration. Backups use a Firestore transaction to compare the current cloud copy against this device's last acknowledged SHA-256 fingerprint. The fingerprint is saved per account for subsequent page loads; another tab cannot advance an already-open tab's baseline. Unknown or changed cloud data stops the upload. An empty roster or results list cannot automatically replace a populated one.
- On first use after this update, an existing cloud copy may need review before automatic uploads resume. Open the cloud notebook, or explicitly choose **Defteri buluta yedekle** to upload the local copy. A confirmed replacement archives the previous cloud copy in the same transaction. An archive failure or a changed remote copy prevents replacement. A completely empty local notebook cannot create a new backup.
- Daily snapshots remain available under **Bulut yedek geçmişini göster**. If an automatic backup pauses after a history restore, **Defteri buluta yedekle** offers the protected upload of that restored state.

## Recovery on the affected device

1. Refresh the site and open **Ayarlar → Buluttaki defteri aç**. Use the Google account that held the notebook.
2. Inspect the counts before accepting the restoration.
3. If the latest copy is empty or missing, open **Bulut yedek geçmişini göster**. Look for a populated daily backup or restore point and restore it. Today's daily copy may have been replaced by the old connection handler; earlier days and immutable restore points are separate documents.
4. If there is no suitable cloud copy, keep the original device/browser intact. Its local notebook or an exported JSON backup may still contain the data. **Buluttan sonuçları çek** only imports results for an already-known roster; it does not restore a teacher notebook.

The repository tests reproduce the missing-download and overwrite paths. Thirteen new application cases cover restoration, cancellation, empty/missing/corrupt backups, pending sign-in, local persistence failure, protected replacement, account isolation, reloads and other-device updates. Emulator tests check the combined archive/replacement transaction and rollback on archive denial. Firebase behavior follows the documented [transaction guarantees](https://firebase.google.com/docs/firestore/manage-data/transactions) and [server reads](https://firebase.google.com/docs/firestore/query-data/get-data).

No private production cloud data was accessible during this repair. The fix does not establish which historical copies exist and cannot recreate data absent from all cloud, local and exported backups. Older tabs still running the previous code should be refreshed. This is conflict detection and explicit restoration, not automatic merging of two edited teacher notebooks.
