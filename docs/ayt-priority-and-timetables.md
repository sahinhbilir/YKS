# September timetables and optional AYT priority

The three timetables supplied on 23 September 2026 are installed for 201 (12/B),
205 (12/C), and 301 (12/A). Each has 40 lessons across nine possible start times;
Friday uses 12:25 instead of 13:00. Teacher names are not stored.

The dated timetable begins Monday 21 September 2026 and is inherited by every
following week until a later timetable is explicitly saved. This is a recurring
school schedule, not a one-week student assignment. Prior weeks retain their old
schedule. The supplied revision replaces an older timetable saved for the effective week
once. Later dated schedules and subsequent user edits take precedence. The revision
marker travels with backups and student packages so restoring them preserves edits.
New student setup and older teacher/student notebooks receive the dated schedules.
Only future automatic lesson dates are reassigned; logged work, cards, personal
overrides, manual lesson dates, issued plans and the current started draft survive.

`test/fixtures/school-timetables-2026-09-23.json` was extracted independently from
the three supplied PDF tables using pdfplumber, with teacher names removed. Tests
compare every cell against the application tables, not just lesson totals.

## Ağırlığı TYT’den AYT’ye al

Students can turn this on in Ayarlar → Çalışma ağırlığın. Teachers have the same
checkbox per student in Öğrenciler. It defaults to off, persists through reload,
backup and cloud synchronization, and stays on until explicitly disabled.

For subsequent unfrozen plans:

- New TYT topics get one diagnostic test. Successful TYT topics retain short
  reviews when estimated recall is still high. Weak, forgotten and relearning
  topics keep ordinary review requirements.
- AYT tasks receive capacity before ordinary TYT tasks. Weak topics and tasks at
  least seven days overdue take priority so TYT cannot remain indefinitely behind
  new AYT work. Overflow remains visible and carries forward.
- Due dates, actual grades, memory cards, daily capacity, rest days, manual task
  counts and issued weekly plans do not change. An AYT task due later in the week
  cannot prevent earlier TYT work from using an available earlier day.

Explicit TYT/AYT topic/lesson labels take precedence. The built-in mixed science
plan has a topic-specific mapping, consistent with the existing catalog's grade
split and the [school-published TYT/AYT topic reference](https://sivasabdulhamidhananadoluihl.meb.k12.tr/meb_iys_dosyalar/58/01/760774/dosyalar/2022_10/10113104_TYT-AYT-Konu-Dagilimi.pdf).
Unclassified custom topics and shared geometry retain normal treatment. This
mapping is a workload preference, not an exam syllabus guarantee.

Validation covers all timetable cells, dated inheritance across 36 weeks, later
manual changes, future lesson redistribution, history preservation, scarce-capacity
scheduling, weak/overdue TYT, unchanged FSRS records, setting validation, teacher
sync, and desktop/mobile checkbox persistence plus server-confirmed logout.
