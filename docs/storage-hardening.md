# Storage hardening

The school keeps the existing teacher-owned notebook, student synchronization documents and co-teacher editing lock. Reports and the seven-column A4 programme retain their layout. The public university catalogue remains a static repository asset.

## Device persistence

`src/local-store.js` is embedded in the standalone application. Current notebooks and the existing recovery slots move to IndexedDB; small preferences remain in localStorage. Migration copies and reads back records before marking IndexedDB authoritative and removing identical legacy values. An interrupted migration keeps the legacy source; a failed authoritative IndexedDB open/read never substitutes an empty notebook silently or touches the device copy: the app starts with a temporary in-memory notebook (`LOCAL_STORE.gecici()`), shows a persistent warning band with a retry button, and works only against the cloud notebook. Memory mode never writes, clears or deletes IndexedDB or the managed localStorage keys, and the existing empty-notebook and conflict guards stop it from overwriting the cloud copy. It also keeps the cloud conflict base in this session only: the stored base still describes the device copy, so if that copy opens again later, the cloud work done meanwhile is reported as a conflict instead of being overwritten.

The app retains a single active notebook. Known student/test/teacher identities on recovery envelopes prevent another known account's recovery copy appearing as its own. Unknown legacy identities remain available rather than being guessed or discarded. Logout/reset retains the existing server-verification and tab-lock gates, then verifies cleanup of both IndexedDB and leftover managed localStorage records. Other applications' keys are untouched.

When IndexedDB is unavailable before migration, localStorage remains a verified fallback; its smaller quota can still reject a save. A standalone exported HTML file whose storage APIs are unavailable can display its validated embedded notebook read-only and download an independent JSON copy. Successful migrations stop full-size dual writes. Standalone exports and JSON recovery remain independent of the browser database.

## Admission and budgets

New growing school reports are validated as candidates before application. The actual gzip/base64 codec is used to measure their cloud snapshot, with a concurrent-edit check before committing. Failed admission preserves the old notebook; oversized legacy data can still be reduced. Ordinary edits remain locally durable when cloud synchronization fails and retain the existing accurate cloud error status.

| Budget | Limit |
| --- | ---: |
| Raw notebook for report growth | 5,000,000 UTF-8 bytes |
| Ranking source lists | 1,250,000 bytes / 100 exam events |
| Etüt requests | 750,000 bytes / 20,000 rows |
| Attendance | Existing 250,000-byte / 400-date limits |
| Stored cloud snapshot | Existing 900,000-byte hard limit |
| Cloud planning threshold | 700,000 bytes |

These are tested engineering budgets, not guarantees for every possible year. Additional topic maps, plans, logs and less compressible content consume headroom. The settings capacity card shows the latest confirmed cloud size and the planning warning. No Firebase billing-plan change is required by this release.

## Bounded cloud history

New history uses fixed `_v2-*` addresses in the existing owner-protected `ogretmenYedek/{owner}/gecmis` collection. Existing deployed rules already allow these documents and retain their owner/co-teacher/lock restrictions. No broader deletion permission or rules migration is introduced.

- 30 changed-day snapshots.
- 12 monthly snapshots, written only when the day rolls over: the first backup of a new day promotes the previous cloud copy (the end of the last active day) into the month slot of that day's month. Later backups the same day do not rewrite it.
- 10 operation recovery **snapshots**; a restore protecting different local and cloud copies uses two.
- One current-day start snapshot.

The maximum is 53 payload slots plus the primary notebook and a compact metadata index. Index/payload changes commit atomically with primary replacements. Displayed versions carry a generation timestamp and SHA-256 of the decoded snapshot. Stale/overwritten slots, corrupt indexes and hash mismatches fail without loading a different version or resetting the index.

Normal history listing reads metadata only; selecting an entry retrieves its payload. “Eski yedekleri göster” reads the legacy history explicitly. Existing dated and immutable recovery documents are left intact. Old clients can still create old-style history under existing rules; the bound applies to new-client history. Backups whose only changes are top-level save timestamp/revision create zero new writes while preserving exact remote conflict bases. A changed backup writes three documents (primary notebook, day slot, index); the first changed backup of a day writes five (adds the start slot and the promoted month slot).

## Verification and rollback

The full-year Chrome test uses real imports and persistence for 99 students: 180 attendance days, four weekly etüt requests, 54 separately named exam events, weekly/monthly exam subsets, topic evidence, 40 frozen plans and 1,000 study results. It verifies reload, JSON download and restore, actual encoded-size rejection without mutation, and reducing cleanup. The tested sample is approximately 4.4 MB raw and 0.60 MB stored. It does not certify Firebase project quotas or every possible workload.

Additional checks cover interrupted migration, marker failure, storage quota failure, account isolation, verified logout, standalone offline exports, unchanged backup writes, more than a year of bounded history, stale versions, corruption and atomic failure. Emulator tests cover actual existing Firestore authorization, editing locks and save/restore delivery.

Rollback builds must understand IndexedDB, expanded validators and v2 history; redeploying the old unmodified application after migration is not a supported rollback. Preserve current IndexedDB/cloud snapshots and exports when rolling back a release. No existing legacy cloud history is deleted by this deployment.
