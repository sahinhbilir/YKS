# Grade 11 timetable topics

Grade 11 keeps two independent mathematics courses:

- `Matematik`, `Matematik AYT`, and `AYT Matematik` use the branch's Grade 11
  school topic sequence. This is classified as AYT for the study-priority setting.
- `Matematik TYT` and `TYT Matematik` use a separate TYT revision sequence.
  A timetable that explicitly includes this course receives the existing SAY
  TYT mathematics sequence, mapped in order over the 36 school-planning weeks.
  School topics and existing teacher-edited or explicitly empty TYT course keys
  are retained. No TYT course is added to a school-only timetable.

The same course resolver now serves placement and topic suggestions. Assigned
topic chips use the readable course identity, instead of trying to parse an exam
label from the old space-free source key. TYT, school maths and geometry cannot
fall back to one another merely because they share a catalog subject number.
Uploaded lesson labels remain selected in the timetable editor, including plain
`MATEMATİK` and labels with the exam prefix first.

The timetable's week selector and start-date control now update the selected
lower-grade branch's curriculum start. Previously they only changed the global
Grade 12 term date, which Grade 11 planning ignores. Other branches retain their
dates. A missing plan created during upload also uses the branch's grade.

Existing uploaded Grade 11 schedules receive a missing TYT maths sequence during
normal forward distribution. An explicit re-upload uses the existing rescheduling
flow; logged results and cards remain protected, and issued plan snapshots stay
unchanged. To align with the teacher's actual pace, use the timetable's plan-week
selector or edit the topic plan. The default school distribution is still a
suggested 36-week sequence, not a school-specific dated annual plan; weeks without
a new topic are not filled with invented topics.

Validation covers the real upload/change handlers, both maths tracks on the same
day, aliases and ASCII labels, dated schedule inheritance, branch isolation,
preserved results, and student exports. Desktop/mobile UI checks upload a mixed
Grade 11 timetable and change its plan week.
