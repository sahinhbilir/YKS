# Okul takvimi: tatiller

The topic plan (Özel tasarlanmış müfredat) is a list of school weeks. The school's
holidays (`D.ayar.tatiller`) decide which calendar weeks are school weeks.

## The 2026–2027 holidays

From the Kolej Lise sınav takvimi 2026–2027:

| Tatil | Tarih |
| --- | --- |
| 1. dönem ara tatili | 16–20 Kasım 2026 |
| Yarıyıl tatili | 25 Ocak – 5 Şubat 2027 |
| 2. dönem ara tatili · Ramazan Bayramı | 8–12 Mart 2027 |
| Kurban Bayramı | 16–19 Mayıs 2027 |

New notebooks start with this list. A notebook made earlier gets it once
(`tatilleriHazirla`), and the coming weeks are redistributed. A teacher who edits the
list (even to empty) keeps their own list.

## Rules

- A week with at least 3 holiday weekdays (Monday–Friday) is a **holiday week**: no
  new topics, and it does not count as a plan week. The plan continues the week after,
  so everything after it moves one week later (`planHaftasi`, `haftaTakvimi`).
- A shorter holiday removes only those days' lessons: a topic planned for a holiday
  day goes to another lesson day of that course in the same week, otherwise to the
  week's first school day.
- Students' review plans continue in holidays; only school lessons stop.
- Ayarlar → Ders programı lists the holidays; adding or removing one redistributes the
  coming weeks' topics that have no results (`programDegistiTetikle`). A holiday week
  shows "Bu hafta tatil" above the timetable. View-only teachers cannot edit the list.

## Tests

`test/okul-takvimi-regression.cjs` and `test/ayarlar-takvim-browser.cjs`.
