# TYT method in the original weekly programme

The method supplies ordinary rows to planHesapla. The original seven-day table, result controls, saved-week lifecycle and A4 print CSS remain in use.

The pure forecast in src/tyt-weekly.js accepts multiple videos per subject per day and reserves each recall on video day + 3, including across weeks. Türkçe grammar and mathematics begin together. Social lessons join in the first week; science and geometry join later unless a custom start date is chosen. Forecast reservations never count as real completion or unlock actual AYT.

Parallel pacing: Türkçe and mathematics start on day 0, Tarih/Coğrafya on day 1 and Felsefe/Din on day 2. Science joins after a week and social progress; geometry joins later. `metot.baslangiclar` stores optional per-lesson dates and overrides those automatic gates, so all Fen lessons can start together on a chosen day. Settings have Fen and Sosyal date shortcuts. Explicitly changing dates rebuilds only unused, unprinted automatic method weeks; completed and printed sheets remain unchanged.

**Genel son tekrar only on request.** The method never places a lesson's 2-hour overview (genel son tekrar) by itself. Topic videos start on the lesson's start day without waiting for one.

- **Asking for one.** Hafızam → Sepetin lists the current session's lessons whose overview is not watched and not already in the plan (`TYT_WEEKLY.overviewOptions`). The student drags or taps a lesson onto a day. That adds an own row: a `serbest` entry with `metotId: 'g|TYT|<ders>'`, `metotTur: 'overview'` and 120 minutes. Ayarlar → Kendi YKS planın says so.
- **On its day.** A requested overview counts as that lesson's overview from its day on. That lesson's topic video never falls on the same day. Two overviews on a day leave no room for videos, and one leaves room for one. Türkçe's grammar recall follows three days later. The row is completed like any method overview: Sonuç gir, or **Zaten yaptım**.
- **Removing it.** Taking it out of the basket removes it from the plan, and the lesson can be asked for again.
- **Already-issued overviews.** Overviews placed on printed sheets before this change stay as printed. Ordinary days use weighted fair scheduling: mathematics can receive two topic blocks while Türkçe receives one; subjects take turns according to their own progress. Türkçe grammar has a defined teaching order before meaning topics. The existing eight-row A4 capacity and +3-day recall reservations remain hard limits.

Paragraph, weekly wrong-question review, lesson/group branches and five mocks (offsets 0, 1, 3, 4, 5) appear in the same programme. Existing daily budgets and rest days apply. Planning estimates: overview 120 minutes, video 60, recall 45, general mock 165 plus 60 analysis.

Issued weeks retain full row payloads in elle.metotPlan. Numeric topic references remap through existing work-package import. Legacy issued sheets remain intact; unused empty automatic placeholders can be released at method activation. Actual watch dates are recorded through the normal results form. Frozen dates remain historical assignments, and premature/mismatched recalls cannot be completed.

General-repeat rows also offer **Zaten yaptım**. The student enters the actual watch date, including a date before programme activation. It records only the overview completion; it does not invent topic completions or rewrite an issued sheet. Future planning and the grammar overview's three-day recall use that actual date. Failed saves roll back the completion.

The student's own additions (Hafızam → Sepetin, or a lesson added in Planım) stand beside the method rows (`ownRows` in src/tyt-weekly.js). They live in the week's `ogrEk`/`yer`/`anlatim`/`konuSlot`/`serbest` entries and never in `metotPlan`, so issued method rows stay as printed. Each one shows on its day, in Sonuç gir, in the basket's day card and in Raporum (PDF). They also take their minutes and a row on that day in the forecast. Removing it from the basket removes it from the plan.
