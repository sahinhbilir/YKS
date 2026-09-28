# Weekly student activity

Teacher entry opens **Haftalık öğrenci takibi**, defaulting to **İşlem haftası**
and the current Monday–Sunday week in Europe/Istanbul. Actions are grouped by when
they happened. For example, entering September 21 results on Monday September 28
and requesting the September 28 plan appears in the September 28 activity week.
The result dates and PDF plan dates remain visible separately. Existing synced
records immediately benefit from this presentation fix; no re-upload is needed.

**Sonuç haftası** remains available for reviewing a reporting period regardless of
when its actions happened. That view groups reporting periods whose start falls in
the selected week, including non-Monday cycles and short transition periods.
Filter by class or student name. Counts are distinct roster identities, not event
totals. Hover timestamps for the first observed action in the selected view.

The three actions are deliberately distinct:

| Analytics event | Recorded when | Dashboard meaning |
| --- | --- | --- |
| `student_results_opened` | Student clicks Sonuç gir, including the missing-results prompt | Opened the result form for that period |
| `student_results_saved` | Valid result rows finish successful local persistence | Saved results; partial submission also qualifies |
| `student_pdf_requested` | Student clicks Planı indir / PDF (including the advanced print button) | Requested print/export, possibly blocked by missing results or cancelled in the browser |

An open result form is not a submitted result. An export request is not evidence
that a PDF file reached the filesystem. Repeated clicks update the last time but
do not increase the number of students. The “Açtı → PDF istedi” column counts an
observed form-open followed by a PDF request for the same result period, without
requiring result submission. Both observations must belong to the selected view.
The latest related form-open/save within seven days links an immediately following
plan period back to its result period, even after reload or another device syncs.
Unrelated PDFs are attributed to their own plan period. Import, render, teacher
actions, synchronization retries and background auto-generation emit no events.

## Storage and authorization

`ogrenciler/{syncId}.paket.etkinlik` extends the existing student-owned result
packet. Existing rules bind writes to the authenticated student and allow reads
only to the owner teacher and that student. No rule widening, new collection or
new permission is required. The teacher's existing per-student server snapshot
listeners update the dashboard; its own backup retains received observations.

The local record is `D.ogr[si].etkinlik`:

```js
{v:1, baslangic:/* first tracking timestamp */, kayit:[
  {tur:'pdf', hafta:/* target plan day number */, sonucHafta:/* source period */,
   ilk:/* first client timestamp */, son:/* last client timestamp */}
]}
```

The existing read/merge/write transaction merges first/min and last/max by action,
source period and plan period. This makes retries idempotent and preserves work
from multiple devices. Manual sends from updated clients also use that transaction.
Strict packet validation occurs before any result mutation. The duplicate working
snapshot omits activity; the explicit packet field carries it. At most 600 most
recent action/period combinations are retained. Names stay in the existing protected
student roster and are not copied into Analytics parameters.

The v1 wire format is unchanged so older open student sessions keep synchronizing.
It retains only first/last timestamps for each action/result/plan combination.
The activity-week view shows those actual observations using in-week timestamps;
it does not invent activity in intervening weeks. If the exact same old-period
action is repeated in three or more different weeks, intermediate observations
are not retained in this ledger. This is not a full click history; Analytics events
remain separate per-click observations when collection is available.

Tracking begins with this version; old clicks cannot be backfilled. Offline actions
are saved locally and retried through the existing synchronization queue. “Kayıt
ulaşmadı” means there is no received evidence, not proof of inactivity. Old exported
HTML clients must be refreshed/re-exported to generate tracking. Timestamps and
actions are client observations, not an anti-cheating audit or server attestation.

## Firebase Analytics verification

The production-only Analytics bridge sends `student_key` (the existing random UUID),
`activity_week`, `report_week` and `plan_week` (ISO dates), and `action_ts`
(milliseconds). `activity_week` is the action's Monday in Europe/Istanbul, even
when results belong to a prior period. Older queued events without that optional
parameter still send. The bridge whitelists
events/parameters and rejects non-UUID identifiers. It never sends student names,
school numbers, classes, email addresses, result scores or topic text. The SDK loads
asynchronously, queues early events, and cannot interrupt Auth, Firestore or printing.
Offline HTML, localhost, preview origins and `?dev=1` do not initialize Analytics.

To verify receipt in the actual project **yks-tekrar-manual-test**:

1. In an authorized student session, open `https://ykstekrar.com/?analytics_debug=1`.
2. Select a result period and click Sonuç gir. Submit a valid result, then request
   its next plan's PDF. Do not use `?dev=1`; it intentionally disables Analytics.
3. Open Firebase Analytics → DebugView for the project. Confirm the three event
   names and inspect `student_key`, `activity_week`, `report_week`, `plan_week`, and `action_ts`.
4. Open the owning teacher session. Select the action week. Match the
   student UUID from the protected roster/packet to the event's opaque key, and
   confirm the dates and timestamps. Switch to Sonuç haftası to inspect the same
   actions under their source result period. Repeating a click must not increase
   unique counts. Test a Monday submission for the preceding week's results.
5. Remove the debug query afterwards. Debug traffic is for validation and may be
   excluded from aggregate reporting. Register `activity_week`, `report_week` and `plan_week` as
   event-scoped custom dimensions for normal reports, if needed. Count distinct
   students rather than event totals; Analytics may be delayed or blocked.

Automated coverage: activity/packet merging and identity isolation, Analytics SDK
emission/parameter filtering, actual save and print delivery through the Firestore
emulator, authorization denials, and desktop/mobile UI interactions. Emulator and
SDK tests do not prove production DebugView ingestion; that final check requires
an authorized Firebase console and student session.
