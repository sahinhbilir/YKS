# Minute-based study budget

A student can plan their capacity in minutes instead of "tests per day". New solo
and test-account setups start in minute mode. Existing students keep the test-count
mode until they choose **Süremi dakikayla planla** in Ayarlar, so their current
plans do not change mid-week. **Test sayısıyla planla** switches back.

## Costs

| Work | Minutes |
|---|---|
| One test question | 50 s (a 12-question test is 10 min; a two-test topic is 20 min) |
| Konu anlatımı row | 20 min |
| Free task in minutes ("Daha fazla" with dakika) | its own minutes |
| Daily mixed practice (paragraf / problem / geometri) | 50 s per question, taken from that day first |
| Saturday school mock | 180 min, counted in the weekly total, shown as a row |

## Settings and the weekly cap

`o.dakika = {hi, hs, deneme}`:

- `hi`: study minutes on each weekday
- `hs`: study minutes on each weekend day, **excluding** the mock
- `deneme`: whether the student sits the Saturday 3-hour school mock

School lessons are not counted. The weekly total is the study minutes of all non-rest
days plus 180 when `deneme` is on. It may not exceed **1760 minutes**. Settings or
rest-day changes that would exceed it are refused with the resulting total.

The cap is the upper bound of the optimal weekly learning time (1620–1760 min)
reported by Liu, A.; Wei, Y.; Xiu, Q.; Yao, H.; Liu, J. *How Learning Time Allocation
Make Sense on Secondary School Students' Academic Performance: A Chinese Evidence
Based on PISA 2018.* Behavioral Sciences 2023, 13(3), 237.
https://doi.org/10.3390/bs13030237. The study is cross-sectional, uses
self-reported time from 15-year-olds in four Chinese provinces, and includes
classroom time in its total. The app uses it as a conservative ceiling for
out-of-school study, as the product owner decided; it is not a proven optimum for
YKS preparation. In Ayarlar the source is the hover title of the weekly total.

## Scheduling

- Each day's budget is `hi` or `hs`, minus that day's mixed practice. Rest days are 0.
  The mock does not reduce Saturday's study minutes; it only counts toward the cap.
- Unpinned work is placed only where its minutes fit. Konu anlatımı rows are placed
  first (still at most `telafiGunKap` per day), so overdue reviews cannot keep new
  learning out indefinitely. Tests fill the remaining minutes, and overflow carries
  forward as before.
- If no study day can hold a 20-minute two-test row, first measurements become one
  test, like the old one-test capacity rule. The overload rule compares minutes.
- Catch-up placement (`telafiGunBul`) tracks minutes in minute mode.
- Frozen/issued weeks keep their rows; the budget only affects placement.
- Plan views show `used/available dk` per day. The teacher's table and plan header
  show the student's minutes instead of the test count.

`dakika` travels with the student's work snapshot like `kap` and `off`, so teacher
views and other devices use the same budget. Removing it (switching back) also syncs.

## Tests

`node test/minute-budget-regression.js` has 13 checks: costs, weekly total and cap,
day budgets, no day over budget across eight weeks, lessons placed and counted, one-test
rule, the mock row (display only), unchanged test-count mode, minute-based catch-up,
settings card and mode switch, refused over-cap changes (including rest days), notebook
validation, and new-setup defaults.

Before merging, a one-off local comparison against the previous commit ran
`planHesapla` for five test-count students (capacity 1, 6, 12, AYT priority, mixed
practice) over ten weeks. All 50 weeks (656 rows) were identical.
