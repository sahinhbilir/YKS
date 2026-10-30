# Kendi TYT planım (self-paced TYT track)

A school student can revise TYT topics at their own pace, separately from the school
curriculum. A typical user is an 11th grader who learns AYT at school but has
forgotten grade 9–10 content. The school plan keeps running unchanged next to it.
Students turn it on in Ayarlar → **Kendi TYT planın**.

## Okula gitmiyorum (full YKS plan)

The solo setup now asks **Okula gidiyor musun?** Answering "Hayır" (graduates,
açık lise, a break from school) changes the setup:

- The grade, class and curriculum-start fields are hidden. Instead it asks for the
  student's **YKS date** (stored in `D.ayar.sinav`, at least four weeks away).
- The student is created with:
  - `okul: false`, `sube: 'benim'`, grade 12 semantics
  - **no timetable and no school topic plan**
  - minutes 180/180, no Saturday mock, up to 3 lessons a day
- Plan weeks start this Monday. Setup then opens Ayarlar.
- **Kendi YKS planın** is the first card in Ayarlar, the student's main plan. It
  covers every topic of the field's YKS plan (TYT and AYT; around 310 for SAY,
  interleaved by course), with the same levels, pacing, checks and "henüz
  çalışmadım" behaviour as below. Lessons are labelled "Kendi YKS planın".
- Until the plan starts, the weekly plan shows a prompt pointing to Ayarlar.
  Starting it before the current week has any work puts the first topics in this
  week.

`okul` travels with the work snapshot and is validated as a boolean; `kendiPlan.tur`
is `'TYT'`, `'YKS'` or one of the other exams. DİL remains TYT-only (no YDT
syllabus is claimed). LGS, KPSS, ALES, DGS and AGS use this same plan with their
own topic lists; see [exams.md](exams.md).

## Topics and identity

- The topic list is the built-in YKS revision plan for the student's field
  (`yeniYksKonuPlani(alan)`), keeping only TYT material:
  - `Türkçe`, `Matematik TYT`, `Geometri`, `Tarih`, `Felsefe` and `Din Kültürü`
  - physics/chemistry/biology topics marked TYT in `PLAN_FEN_SINAVI`
  - geography topics labelled `(TYT)`
  - philosophy-group topics only when they are philosophy (SÖZ)
- AYT courses, `Türk Dili ve Edebiyatı`, `T.C. İnkılap Tarihi` and `(AYT)` topics
  are excluded. Around 200 topics for SAY.
- Plan weeks keep their order. Within a week, courses alternate, so each week
  mixes subjects.
- Topics are resolved with the same rule the school timetable uses
  (`kullaniciKonusu(…, grade)`). For grades 9–11 they are grade-scoped topics, so a
  grade-11 timetable's own "Matematik TYT" sequence is the same topic. For grade 12
  they are the catalog topics of the school YKS plan.
- **A topic the school already dates (`subeIslenis`, `islenis`) is never scheduled
  by the personal track.**

## Placement and pacing

Per course: **Bilmiyorum** (default), **Biraz biliyorum**, **Biliyorum**.

- Bilmiyorum: the topic arrives as a **konu anlatımı** row (20 minutes in the
  minute budget), labelled "Kendi TYT planın". Ticking it in Sonuç gir sets the
  study date. The first test then follows through the normal spaced-repetition flow.
- Biraz / Biliyorum: the topic arrives as a **one-test check** (12 questions, no
  lesson).
  - A Biliyorum check rated **Tekrar** (or numerically below the Tekrar threshold)
    queues a konu anlatımı.
  - For Biraz, **Zor** also queues one.
  - Queued lessons come first, even in the week the check was taken.

Each not-yet-issued week takes `ceil(remaining / weeks to the target date)` topics
from the queue. The default target is the exam date minus eight weeks, at least four
weeks from today, and never after the exam. The pace is recomputed every time, so it
self-corrects. Budget limits still apply: lessons are placed first, and overflow
carries to the next week.

A topic already on a current or future issued paper is not planned again. A lesson
left unticked on a past paper returns to the queue. Changing a course's level or the
target date affects only topics that have not started. **Kendi planımı durdur**
stops new topics; started topics keep their reviews.

## Genel tekrar comes first

Genel tekrar is for students **without school** (`o.okul === false`; every no-school setup, including other
exams, sets it). A student in school with a personal plan gets no genel tekrar, no pacing gate and no
settings-card line, and the plan behaves as before; "Zaten yaptım" below stays for every personal plan.

Before any topic, the student watches one **Genel tekrar** per subject to see the whole
topic chronology (the teacher's decision: all subjects first, then topics).

- One item per subject of the plan, in curriculum order (the order subjects first appear
  in the plan's topic sequence). TYT and AYT parts of a subject are separate items when
  the plan covers both ("TYT Matematik", "AYT Matematik"). A TYT-only plan has TYT items
  only; other exams use their own subjects without a TYT/AYT prefix. A subject whose topics
  are all dated by the school has no item.
- Each item is **120 minutes** (`GENEL_TEKRAR_DAKIKA`) and is stored as a free-work row of the
  week (`ov.serbest[GT<n>] = {ad, ders:'Genel tekrar', soru:120, birim:'dakika', gt:key}`), so
  it freezes, prints and travels like any other row. It never makes a test, a card, a log row
  or a lesson date.
- **Daily rule.** At most one genel tekrar per day, and only on a day whose minute budget still
  holds 120 minutes. Genel tekrar is placed before everything else of the week, so overdue
  reviews take the remaining minutes (60 on a 180-minute day). If no day of the week can hold
  120 minutes (a very small budget), one item a week goes onto an otherwise empty day and
  exceeds the day's budget; otherwise the topics could never start. In test-count mode it is
  one a day, counted against the lesson limit, not the test capacity.
- **Pacing.** The not-yet-issued weeks take the unfinished items in order, as many as the
  week's capacity (the days that fit the rule). Topic lessons and tests start only in the week
  after the last genel tekrar is placed (or sits on a current/future issued paper). An item left
  unticked on a past paper returns to the front of the queue, like an unticked lesson.
- **Progress.** `o.kendiPlan.genelTekrar = {sira:[key…], tamam:{key: dayNo}}`, key is
  `"TYT|Matematik TYT"` (session, course). Created by `kendiPlanKur`; validated in
  `yedekDogrula` and carried by the work snapshot (the whole `kendiPlan` object).
- **Migration.** A running plan without the field gets it once, in the student-side
  preparation (`ogrenciOtomasyonUygula`), with an empty `tamam` except for subjects that already
  have a lesson date, a card or a result: those are written as done on their first date, so
  nobody is sent back. The same rule is computed on the fly, so it also holds before anything is
  saved and when a stopped plan is restarted.
- **Where it shows.** Plan table, list and print as "GENEL TEKRAR · TYT Matematik · 2 saat"; the
  weeks map counts it as lesson-type work (like a lesson in the "x/y anlatım" count); Sonuç gir has an
  **izledim** box like lessons. The settings card reports "Önce genel tekrar: N ders · ~X saat",
  and the weekly pace numbers start counting after the genel tekrar weeks.

## "Zaten yaptım"

On the student's own weekly plan (table and phone list) each lesson, genel tekrar and test of the
**personal plan** has a small **Zaten yaptım** button, for the current and future weeks (not for
past weeks, resolved rows, free work, daily practice or school-plan rows). The algorithm acts as if
it happened on the **last day of the previous week**: `G = buHafta − 1`.

- **Konu anlatımı** (confirm): `anlatimTamam(0, ki, G)` semantics. The lesson leaves the queue and
  unissued weeks, its first test is due `G + first-review interval`, a pending "lesson needed"
  request for the topic is cleared. On an issued paper the row stays and is marked done
  (`ov.onceden[slot] = G`), which `anlatimTamamMi` and the weeks map read.
- **Genel tekrar** (confirm): `genelTekrar.tamam[key] = G`; unissued weeks drop it; an issued row is
  marked done the same way.
- **Test**: a small popup with one result row (the normal rating or doğru/soru row, no "Yapmadım"),
  titled "<konu> · geçen haftanın son günü sonucu". Saving records the result at G through
  `sonucKaydiDogrula`, `sonucIsle` and `kendiPlanSonuclariniIsle` (a weak first check queues a lesson
  as usual), recomputes the card, and on an issued paper marks the slot done so it is neither
  "missing" nor assumed İyi. Sonuç gir shows such a row as "Önceden yapıldı". The popup reads only its
  own row (`data-sade`) and the main Sonuç gir form ignores it; it leaves `EK.sonucFormu` alone.
- G may lie before the student's plan start. After any of these the plan redraws and the notebook
  is saved and synced like a result.

`ov.onceden` keys are translated with the other week fields in `paketPlanKonulariniCevir`.

## "Bu konuyu henüz çalışmadım"

On a personal-track row, the result form's "Bu konu daha anlatılmadı" button reads
**Bu konuyu henüz çalışmadım**. Saving it:

- closes that test without a result (like "Yapmadım", no postponement)
- queues a konu anlatımı for the topic

It does **not** shift the school course sequence and records no
`konuAnlatilmadi` event. School rows keep the original behaviour.

## Storage and sync

`o.kendiPlan = {tur:'TYT', hedef, seviye:{course: 'hic'|'biraz'|'bilir'}, sira:[ki…], anlatimGerek:{ki: day}}`.

- The weekly rows are not stored separately. While computing a not-yet-issued week,
  the scheduler writes them into that week's working `elle` copy: `anlatim[ki]` with
  kaynak "Kendi TYT planın", or `kendiTest[ki]`. When the week is issued they are
  frozen with it, printed, and completed through the existing flows.
- `kendiPlan` travels with the student's work snapshot. `sira` and `anlatimGerek`
  keys are translated to the receiving notebook's topic IDs, like `otoTelafiHaric`.
  `kendiTest` is translated with the other week fields in `paketPlanKonulariniCevir`.
  Notebook validation checks the shape.

## Tests

- `node test/personal-plan-regression.js`, 21 checks (its helpers mark the genel tekrar phase done; it checks topics) (5 of them for the no-school mode):
  - TYT classification and interleaving for every field
  - school de-duplication
  - pacing and non-overlapping weeks
  - frozen weeks and the week after
  - lesson completion leading to tests
  - one-test checks, and weak results adding lessons (Biliyorum/Biraz, rating and numeric)
  - "not studied yet" leaving the school sequence untouched
  - result-row wording
  - unfinished lessons returning
  - stopping the plan
  - the settings card
  - the target-date rules
  - ID translation and validation
  - no change without a plan
- `node test/personal-plan-browser.cjs`, desktop and 390 px Chromium: start from
  Ayarlar; then in Sonuç gir mark a check "Bu konuyu henüz çalışmadım", save, and see
  the lesson in next week's plan.
  It also runs the no-school setup end to end: answer "Hayır", start the YKS plan, and see
  this week's lessons.

- `node test/genel-tekrar-regression.js`, 16 checks (including the in-school case: no genel tekrar, topics at once): one 120-minute item per subject in curriculum order
  (every field, TYT-only, other exams), the daily rule and small budgets, topics starting after the last
  item, no cards or tests from it, unticked items returning, lazy migration, Sonuç gir box and weeks map,
  "Zaten yaptım" on a lesson / test / genel tekrar, button placement, validation and snapshot.
- `personal-plan-browser.cjs` also checks, at 1280 and 390 px with no sideways scroll, the genel tekrar rows,
  "Zaten yaptım" on a genel tekrar, a lesson and a test (popup, İyi, stored at G) and Sonuç gir afterwards.

A student without a personal plan gets identical plans. The local comparison
against the step-1 commit still shows 50 weeks / 656 rows unchanged.
