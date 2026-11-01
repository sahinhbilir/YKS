# TYT method in the original weekly programme

The method supplies ordinary rows to planHesapla. The original seven-day table, result controls, saved-week lifecycle and A4 print CSS remain in use.

The pure forecast in src/tyt-weekly.js accepts multiple videos per subject per day and reserves each recall on video day + 3, including across weeks. Türkçe grammar and mathematics begin together. Social lessons join in the first week; science and geometry join later unless a custom start date is chosen. Forecast reservations never count as real completion or unlock actual AYT.

Parallel pacing: Türkçe and mathematics start on day 0, Tarih/Coğrafya on day 1 and Felsefe/Din on day 2. Science joins after a week and social progress; geometry joins later. `metot.baslangiclar` stores optional per-lesson dates and overrides those automatic gates, so all Fen lessons can start together on a chosen day. Settings have Fen and Sosyal date shortcuts. Explicitly changing dates rebuilds only unused, unprinted automatic method weeks; completed and printed sheets remain unchanged.

An overview day never also contains that lesson's topic video. Days with multiple overviews leave new topic work for later. Ordinary days use weighted fair scheduling: mathematics can receive two topic blocks while Türkçe receives one; subjects take turns according to their own progress. Türkçe grammar has a defined teaching order before meaning topics. The existing eight-row A4 capacity and +3-day recall reservations remain hard limits.

Paragraph, weekly wrong-question review, lesson/group branches and five mocks (offsets 0, 1, 3, 4, 5) appear in the same programme. Existing daily budgets and rest days apply. Planning estimates: overview 120 minutes, video 60, recall 45, general mock 165 plus 60 analysis.

Issued weeks retain full row payloads in elle.metotPlan. Numeric topic references remap through existing work-package import. Legacy issued sheets remain intact; unused empty automatic placeholders can be released at method activation. Actual watch dates are recorded through the normal results form. Frozen dates remain historical assignments, and premature/mismatched recalls cannot be completed.
