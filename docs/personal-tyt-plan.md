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
is `'TYT'` or `'YKS'`. DİL remains TYT-only (no YDT syllabus is claimed).

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

- `node test/personal-plan-regression.js`, 20 checks (5 of them for the no-school mode):
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

A student without a personal plan gets identical plans. The local comparison
against the step-1 commit still shows 50 weeks / 656 rows unchanged.
