# Automatic student flow

Students should understand what to study, why it returns, and how much preparation time remains, without managing the scheduler. Simplicity means automating administrative decisions while keeping learning information visible.

## Daily interface

The student navigation is Planım, Sonuç gir, Haftalar haritası and Ayarlar; the app opens on the home page, which leads with today (below) and then shows Haftalar haritası. The plan is read-only by default and offers one download action. Its visible exam countdown and compact weeks map place the current week within the preparation period. The full map opens past plans and distinguishes recorded results from an actually completed week; one recorded result never implies completion. The countdown uses the notebook's configured exam date, not an independently verified official date.

Each scheduled test shows its repetition number, previous result date and score, and any result recorded for that scheduled day. Desktop, mobile, result entry and printable plans retain this information. Repetition stages are counted from results preceding the scheduled date, so future reviews do not renumber historical plans. “2. tekrar” describes the learning stage; “2 test” describes the question load within that stage. The weekly summary counts first measurements, later repetitions and recorded topic results, excluding free routines and lesson explanations.

Detailed editing, topic planning, personal routines, data recovery and algorithm controls remain accessible through Gelişmiş ayarlar. Teacher navigation and manual tools remain available.

Basic settings contain daily test capacity and rest days. They save automatically and affect upcoming plans. The current issued plan stays intact. Each result requires an explicit recall rating or an actual score: blank rows are never scored as correct, incorrect or completed. Saving a partial set stays on that week's results; saving the complete set opens the upcoming plan.

## Home: today first

The student's home page (`gorunumAnaSayfa`, after login and on the brand) starts with **Bugün** (`ogrenciBugunKarti`, `#bugunKart`), then the weeks map and the exam chart:

- The heading says how many of today's tests are still open ("3 test seni bekliyor"), "Bugünün testleri tamam ✓" once each has a result, or what today is when there is nothing to do (izin günü, no plan, no work today — with the next working day: "Sıradaki: Cuma · 4 çalışma").
- Under it are today's rows of this week's plan (the same rows as Planım: lessons, genel tekrar, tests and plan-dışı results; a test moved by "Zaten yaptım" is not there). Every test row carries **the plan's own result slider** (`planSatirEki`), so a result entered on the home page goes down the same path as in Planım: it issues the week, recomputes the card and the coming weeks, and the row turns to its done look.
- On the right: **bu haftanın testi** (done / issued so far this week, with a bar; the same count as the weeks map, `haftaTestOzeti`), **hafta üst üste** (the streak, shown from two weeks) and **sonuç · n haftada** (every result entered, and in how many weeks).
- The streak (`ogrenciSerisi`) counts back from last week over the weeks that have at least one result, without a gap; this week adds one as soon as it has a result and never breaks the streak while it is still empty. It is a count of weeks worked, not a score: no threshold decides that a week was "good".
- "Haftalık planım →" opens Planım. The card is the student's only; it is not drawn on the exam day or after it, and never printed.

## Hafızam: studying on the student's own initiative

The plan is a suggestion, not the only way to work. **Hafızam** (its own tab, the leftmost, and the page a student lands on: `OGRENCI_ACILIS`; `gorunumHafiza`; a card of the same rows on the home page under Bugün, `hafizaAnaKarti`) shows what the scheduler knows about the student's memory, so she can decide for herself what to study:

- **A quiet page.** A newcomer should see what it is about without reading: one sentence under the title (*Çubuk kızardıkça konuyu unutuyorsun. Çalıştığında “Çalıştım”a bas.*), one line of summary (*3 konu unutuluyor · 14 konu aklında*), then **Unutmaya başladıkların** and **Aklında olanlar**. No tiles. A row shows the bar, **Çalıştım** and **Sepete**; Düzenle and Çoktan unuttum are under **Diğer**. With more than `HAFIZA_UST_ACIK` = 12 remembered topics that list is folded behind **Göster** (it opens for a ders filter, an open row, or a topic the student has just set). The settings (Kendi programımı kendim yaparım, Derslerine göre unutma hızın) are one folded **Ayarlar** box at the end.
- **Konu anlatımlarını göster** opens every topic of the student, by ders, as a konu anlatımı to drag onto a day (or tap, then a day), and the picker for reporting a topic that has no result yet. Once its day has come — and unless the student answered **Yapmadım**, which takes it out — the topic has its forgetting bar from that day ("konu anlatımını yaptın 3 gün önce · henüz sonucun yok"), like a topic taught in class; done after a result or after Çoktan unuttum, it starts the topic again from that day (`anlatildi`).
- **The forgetting speed is visible.** In Düzenle a small curve (`hafizaEgri`) is drawn again as the sliders move: recall from today, the target line dashed, a dot where it is met. In Derslerine göre unutma hızın each ders has a five-step meter beside its choice (red fast, green slow) and a changed ders is marked; its topics say "geç / çabuk unuturum" in colour.
- **Every taught topic is a row**, not only the measured ones: the topics whose lesson day (`ogrenciIslenisTarihi`: the class's müfredat and timetable, `subeIslenis`, or the student's own dates) is today or earlier, plus every topic with a result or an own state. A taught topic never measured starts on its lesson day with the first İyi's stability (`ilkS(3, w)`): "derste işlendi 10 gün önce · henüz sonucun yok".
- Each topic is one row: a bar from 0 to 100 with the **estimated recall now** and a mark at the **target line** (`hedefTutma`, 90 % unless the teacher or "süreme göre ayarla" changed it). Under it: when it was last studied and when it met / will meet the line ("çizginin altına 12 gün önce indi", "çizgiye 3 gün var").
- Recall is FSRS-6's forgetting curve, **R(t) = (1 + FACTOR·t/S)^DECAY** with FACTOR = 0,9^(1/DECAY) − 1 (so R(S) = 0,9), t the days since the last review and S the card's stability (`hafizaDurumu`). **Hafızam is honest:** the card is built from real results up to today and the student's own state only (`kartHesapla(si, ki, [], rows)`). The "İyi" assumed for an unreported plan test belongs to the plan's preview and scheduling; it never reaches Hafızam, and neither does a study put in the basket and not done. (The plan's stored card counts assumptions and this week's not-yet-done tests, so it is not used here.)
- Topics under the line come first, the most forgotten on top ("Çizginin altındakiler"), then the rest with the nearest to the line first. The home card shows up to six topics under the line.
- **Çalıştım** opens the row: the plan's own result slider for today. If the topic is on today's plan it is that row's slider; otherwise the result is written to today as a result outside the plan (`planSonucKaydet` with `planDisi`), through the same validation, card and sync path as every result. The topic then stands at 100 % and its next review is scheduled from this result. An unlinked notebook can take it back with Geri al; a notebook linked to a teacher can change it with the slider.
- **Listede olmayan bir konu çalıştıysan** lists the topics of the student's own plan that are not taught yet; the first report is that topic's first measurement.
- **Orange to red under the line.** The bar and the figure of a topic under the line are mixed from `--uyari` to `--kritik` by how far recall has fallen below the line (full red at 40 % and below): the closer to forgotten, the redder.
- **Çoktan unuttum** on a row sets the student's own state to 1 % (`hafizaElleKaydet(si, ki, 0.01, 1)`; the row's `unutuldu`): the topic turns into a **konu anlatımı** — red edge, "konu anlatımıyla yeniden başla", and its drag / "Sepete · konu anlatımı" adds a lesson (`tur: 'anlatim'`), not a test. **Unutmadım · geri al** removes the own state. A topic not taught yet can be reported ahead of the teacher from the picker under the list (*Henüz işlenmeyen bir konunun anlatımını kendin yaptıysan*).
- **Red: no result for a long time.** A topic with no entered result for `HAFIZA_UZUN` = 21 days or more (counted from the last real result, the student's own state, or else the lesson day; an "İyi" assumed for an unanswered plan row is not a result) has a red edge and says "21 gündür sonuç girmedin" ("… hiç sonucun yok" when never measured). The tile "Uzun süredir sonuçsuz" counts them.
- **Ders filter:** one button per lesson with "under the line / all" counts; the list then shows that lesson's topics only.

### The student's own forgetting

The algorithm's guess can be corrected by the student's own experience; both settings sync to the teacher (topic numbers mapped both ways) and are checked by the notebook validation.

- **Derslerine göre unutma hızın** (`o.unutmaDers = {ders: k}`, `unutmaDersAyarla`): Çok çabuk (0,5) · Çabuk (0,75) · Normal (1) · Geç (1,5) · Çok geç unuturum (2). It is a time scale: in `kartHesapla` the days between reviews are divided by k and the next interval multiplied by k (capped by the maximum interval); Hafızam's recall is R(t / k) and the line is met k times later; the plan's retrievability (`x.R`) uses the same scale. So the line falls slower or faster for every topic of the lesson and the plan's review days move with it. Parameters learnt from results stay as they are.
- **Düzenle** on a row (`o.hafizaElle = {ki: {g, r, s, ts}}`, `hafizaElleKaydet` / `hafizaElleSil`): two sliders, *Şu an aklımda %r* and *Unutma hızı · %90'a S günde* (1–365 days), with a live preview ("çizginin altına 12 gün sonra iner"). It is the topic's state on day g: the card is built as if fully learnt t whole days before g, with t = S/FACTOR·(r^(1/DECAY) − 1) rounded, and the stability adjusted so that R(t) is exactly r (`hafizaElleKarti`). It replaces the results and assumptions before it; results after it continue from it. The row says "kendi ayarın (bugün)" until a real result follows; **Algoritmaya bırak** removes it.

### The basket (Sepetin)

At the end of Hafızam (`hafizaSepeti`): this week's or next week's days, each showing the studies the student added (with × to take one out) and how many plan studies it has, and the mixed studies **Karışık Paragraf · Karışık Problem · Karışık Geometri**.

- **Drag** a topic card or a mixed study onto a day (HTML5 drag and drop; the basket docks at the bottom of the window while dragging), or **tap** "Sepete" / a chip and then a day (phones; the basket docks while something is picked). A topic becomes the student's own test that day, a mixed study a 20-question study that day (`ogrenciElleEkle`, the same path as "Planıma çalışma ekle"); **Her gün** makes a mixed study a daily target (`gunlukEkAyarla`). A topic already on that day's plan is not added twice; days that have passed take nothing.
- **The basket is a plan, not a result.** A topic goes in with `HAFIZA_SEPET_SORU` = 12 questions and the student can change the number on the item (`hafizaSepetSoru`, 1–200). Nothing reaches memory until she reports it with **Çalıştım**. **Yapmadım** on an item of today or of a past day of the week (× on a future day) takes it out as if it had never been added (`hafizaSepettenCikar`); an item with a result shows "✓ yapıldı".
- **Raporum (PDF)** (`hafizaRaporu`, `hafizaYazdir`; paper only) is laid out like the weekly plan's PDF: A4 landscape, a column per day of the week, each study a small block (ders, topic, what happened): "✓ İyi" for a reported one, "sepetteydi · yapılmadı" or "bildirilmedi" in red for one not reported up to today, "sepette" for a basket study of a coming day; under the table the topics under the line. It says that only reported studies are in memory.

### A week fills with what the student reports

- A result on a day where the plan has no row for that topic (a study of the student's own) counts as one of the week's tests, up to the number of tests given: `haftaTestOzeti` returns `kendi` (counted) and `kendiToplam` (all). The weeks map, the home card's "bu haftanın testi" and Hafızam's "Bu hafta" use it, and the week's title says "5/12 test yapıldı · 2 kendi seçtiğin çalışma". So a week turns green by reporting, whether or not the student followed the paper.
- A week without a saved plan (or with no test due yet) is green by its results too: one result per working day of the week makes it fully green (`haftaCalismaGunu`; before it was a fixed half).
- **No double counting.** When the student studies on her own a topic that also has an unanswered row in the same plan week, that result stands for the row (`haftaOrtusu`; each extra result covers one row, the earliest first; a row marked “Yapmadım” is not covered): the row leaves the student's plan and Bugün (the study stands on its own day as "plan dışı sonuç"), it is **not assumed İyi** on top of the real result, and Sonuç gir does not count it as missing. The teacher's table keeps the row as printed.

### Kendi programımı kendim yaparım

A tick box in Ayarlar (Planı kendine göre ayarla) and on Hafızam (`o.serbest`, `serbestAyarla`). While it is on:

- the plan stays as a suggestion ("Kendi programını yapıyorsun: bu plan bir öneri" on Planım, "N test öneriliyor" on the home page, "Öneri · çalışırsan sonucunu seç — girmezsen sayılmaz" on the sliders);
- **a test without a result is not assumed İyi** from that day on (`serbestGunMu` in `varsayimIyiGunleri`): what is not reported was not done, the card moves only with real results and its recall keeps falling until the student studies it. This is what makes Hafızam honest for a student who does not follow the paper;
- Sonuç gir does not send her back to last week for "missing" results.

`o.serbest` is a list of periods `[[first day, last day | null], …]` (only the last may be open, validated by `serbestDogrula`). Switching on opens a period today (or continues one closed yesterday or today); switching off closes it yesterday, so a period opened and closed on one day leaves nothing. The days of a closed period keep their rule: turning the box off never re-assumes the tests of the weeks she spent on her own. The list travels with the student's work snapshot (also when empty), the teacher's copy recomputes the cards with it, and the teacher's plan header says "kendi programını yapıyor (… tarihinden beri; sonucu girilmeyen test İyi sayılmaz)".

Without the box the same reporting works; the only difference is that plan tests she does not report are still assumed İyi **in the plan** (its preview and review days). Hafızam does not use that assumption either way, and its note says so.

## Results inside the plan: the slider

The student's weekly plan (table and phone list) is also where results are entered. Under every test row
(`planSatirEki`, student role only; the teacher's table keeps its status line):

- A four-stop slider: **Tekrar · Zor · İyi · Kolay**. Under each stop stands the interval that rating would give
  ("İyi · 7 gün"), computed by `sonucOnizleme` with the plan's own `tekrarla()` from the card as it was before that
  day, the student's parameters and the effective recall target. Below: "Sonraki tekrar ≈ 23.10 · 7 gün sonra".
  This is the FSRS step made visible: the student sees what each answer does before choosing it.
- **No result yet:** the slider rests on İyi, dimmed, and the row reads "Sonucunu seç · İyi sayılır", because that
  is what the plan assumes (see "Missing results count as İyi").
- **A day that has not come:** the same preview, disabled ("Sonuç girilmezse İyi sayılır").
- Releasing the slider, pressing a stop, or Enter on the slider saves at once (`planSonucKaydet`): the same path
  as Sonuç gir for one row (`sonucKaydiDogrula`, issue the shown week first if it is not issued, `sonucIsle`,
  `kendiPlanSonuclariniIsle`, `planSlotSonuclandi`, save, activity, sync). The message names the next date and the
  coming weeks are recalculated. Changing the slider later replaces that day's result.
- Not shown on lessons, genel tekrar, free work, daily practice, a test marked "Yapmadım" or "anlatılmadı" (those
  stay in Sonuç gir, which keeps doğru/soru entry, Yapmadım and alt konu).

## Gelecek haftaların

Under the current week's plan the student can open **4 hafta · 8 hafta · Sınava kadar**. Every coming week is
listed (tests, lessons, repetition numbers per day) and opens in full with "Bu haftayı aç". The weeks are computed
in one pass on a copy of the notebook (`gelecekHaftalar`): each week's unanswered tests are counted as İyi before
the next week is calculated, exactly like the single-week preview (`varsayimliPlan`). Nothing is written. It is a
draft that the student's own inputs reshape: results, minutes, rest days and the two boxes below.

## Planı kendine göre ayarla (Ayarlar)

Three opt-in boxes change the general setting of the calculation; an issued week never changes. The third, **Kendi programımı kendim yaparım**, is described under Hafızam above.

- **Uzun süredir çalışıyorum** sets the existing starting memory level (`hafizaSeviyesi`: Güçlü, or Çok güçlü from
  the list that appears): new topics start with longer first intervals. A weak first result still comes back soon.
- **Planı çalışma süreme göre ayarla** (`sureyeGore`). FSRS has one workload setting, the recall target: a lower
  target means longer intervals. When the box is ticked the target is lowered in steps of 1 point until the weekly
  review load fits 60 % of the student's weekly study minutes (`sureHedefiHesapla`; the rest is left for new
  topics), never below **80 %** and never above the teacher's / general target. Load = Σ over the student's cards
  of 7 ÷ interval × test minutes (two tests for a topic last rated Tekrar or Zor). With the app's FSRS-6 parameters
  90 % → 80 % makes intervals about 3,3 times longer. The value (`sureHedef`) is kept in step before every save
  and only moves in steps of 2 points or more, so the plan does not shift on every result. The card shows the
  numbers: load, minutes available, the target and the factor; when even 80 % does not fit it says so, and the
  overflow carries forward by the usual rule. The cost is stated on the box: a slightly higher chance of
  forgetting a topic before its review. Both fields travel with the student's work snapshot; the teacher's plan
  header shows the effective target.

## Weeks map, “Yapmadım” and printing

Students open the app on Haftalar haritası (a restored tab after a same-tab reload is kept). Each past week with an issued plan is coloured by the share of its tests that actually have a result: grey when none were done, grey-green when few were, deep green when all were. A week with no tests, only konu anlatımı (a Kaydol or Okula gitmiyorum student's first weeks), is coloured the same way by its lessons marked "anlatıldı / izledi" in Sonuç gir, and its box reads "x/y anlatım". A past week with no plan record at all (the app was not used that week) is red; weeks before the student joined stay neutral. “Bu konu daha anlatılmadı” tests are left out of the count; “Yapmadım” and blank tests count as not done. The current week is not coloured before it ends. Tapping a red week opens Geçmiş plan kurtar with that week as the paper's first day and a short note: if the student made a plan that week but it is not in the system, they can save it there.

Each result row has a **Yapmadım** button. It records no FSRS result and moves the test to the next week that has not been issued yet, as if it had not been in that week's plan (it uses the existing postpone, `D.ertele`, plus a per-test `D.yapilmadi` mark that syncs with the work snapshot). A later real result for that test replaces the mark.

A missing result never blocks a plan: this week's and next week's plans can always be downloaded or printed, and weeks after that are preview only (their previous week has not started). The reminders stay. Opening Sonuç gir goes to the previous week while any of its tests has no result, “Yapmadım” or “Bu konu daha anlatılmadı”, and tapping a grey week on the map opens its Sonuç gir with a “you forgot to enter this week's results” note (the “Yapmadım” line is left out for a week without tests). Other weeks open their plan. Future-week previews also count the tests of weeks not yet given as İyi; that part is computed on a copy of the notebook.

## Missing results count as İyi

A test in a given week (a saved plan: printed, downloaded or saved automatically) that has no result is scheduled as if the student had rated it **İyi** on its day. Its 2nd, 3rd and 4th repetitions keep spacing out without Sonuç gir, exactly as if İyi had been entered each time. Nothing is written as a result:

- the weeks map, Sonuç gir, the teacher's "Geçen haftanın sonucu" and the week counts use real results only, so such a week stays grey and keeps asking for its results;
- FSRS calibration and the result package contain real results only;
- the card keeps the assumed days (`vg`), and the plan's repetition label counts them ("3. tekrar · Son çözüm 07.10 · sonuç girilmedi").

A real result entered later, even weeks later, replaces the assumption for that day. The card is recomputed and the coming weeks change; weeks already given never change.

Not assumed: a test on a day of a "Kendi programımı kendim yaparım" period, a row whose topic the student studied on another day of the same plan week (see Hafızam), a test marked “Yapmadım”, a topic marked “Bu konu daha anlatılmadı” (and the course topics it shifts, before their new date), a week the teacher answered with "okula geldi, testleri kaldı" or "okula gelmedi" in **Nasıl geçti?** (its tests come back, postponed through `D.ertele`), a recovered paper's “yapılmadı” rows, free work, lessons and days on or after the exam. A week that is not given (red) has no tests to assume. A week computed live (not saved) ignores assumptions dated in that week or later, so it never treats its own tests as done.

Code: `varsayimIyiGunleri` (which tests count), `kartHesapla` / `kartiYenidenHesapla` (cards from real and assumed reviews), `varsayimKartlariniGuncelle` (keeps cards in step; run on every render, skipped when the notebook has not changed, and per student after saving a week, a result, “Yapmadım”, a reset or a week decision). On the first load after this change, a postponement an older version wrote onto a card is kept as `D.ertele`. Tests: `test/assumed-good-regression.cjs`.

## First-review delay

The first test after a topic is taught comes "İlk tekrar gecikmesi" days later (Ayarlar → Genel) only while the app knows too little about the student. Once a student has at least 8 first measurements spread over at least 4 weeks, the delay is learned from them (`ilkTekrarOgrenilen`): the FSRS forgetting curve's most likely stability after a lesson, smoothed with 4 virtual results at the set delay, and the first test is placed when recall would drop to the student's target retention (1–14 days). Only real results count. Ayarlar → Genel says under the setting how many students still use it and the learned range; Öğrenci kalibrasyonu shows the student's own value.

## Alt konu

Every test row in Sonuç gir has a folded **Alt konulara ayır** box (open for broad topics, those with at least "Geniş konu eşiği" kazanım codes). It lists the topic's parts that the app knows: the parts of a compound topic name ("Asal Sayılar, Ardışık Sayılar, Faktöriyel"; "Şiir ve deneme: edebî dil, imge ve sembol"), the 11th-grade outcome codes, and otherwise the catalogue's kazanım codes. A click splits that part into its own topic for this student; a "write your own" field covers anything else. Split parts show as "✓". A teacher's split stays with that student (`D.ogrIslenis`), and the same name reuses the topic. The app has no MEB kazanım texts for YKS topics, only codes.

## Recall feedback and lessons not yet taught

Students primarily choose Tekrar, Zor, İyi or Kolay. Tekrar means unsuccessful recall; Zor means successful recall with substantial difficulty. İyi means normal recall effort and Kolay means immediate, easy recall. A first-use explanation introduces these choices and can be reopened. Numeric correct/total entry remains an alternative. Rating-only results contain no invented question counts or percentages.

“Bu konu daha anlatılmadı” is a teaching delay, not a failed review. It preserves the issued paper, postpones the student's affected course sequence and starts a new learning attempt for the marked topic. Earlier attempts remain in history but do not train the new attempt. Previously learned other topics retain their FSRS reviews. The next first repetition enters the following plan subject to available capacity and the exam boundary; no unfreeze action is needed.

The rating meanings follow the [FSRS usage guide](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md). Weekly test feedback estimates recall at topic level; it does not guarantee that every topic will remain remembered until the exam.

## Personal work in the weekly plan

The student plan ends with three optional daily question targets: Karışık Paragraf, Karışık Problem and Karışık Geometri. Selecting a target and entering 1–200 questions saves it automatically. Targets repeat every calendar day, including rest days, until changed or disabled; the UI states this explicitly. Changes begin today or at the start of the selected future week. Dated preference records preserve earlier days and stop at the configured exam date.

Daily mixed practice is added to the displayed and printed plan and CSV, without consuming the automatic scheduler's test capacity or creating FSRS cards. Its question count is shown separately from scheduled test questions. The preferences are part of the notebook backup and student package; result-only cloud sync does not back up these preferences.

At the end, Daha fazla opens the existing manual work dialog for the student's own plan. It includes a custom task name, question/minute count, day selection and topic search, with no Kime selector. New work can be appended to an issued week without reopening or moving its existing rows. Students may remove their own uncompleted additions; existing scheduled work and scored additions cannot be removed through these controls. Specific topic tests enter FSRS through actual results; mixed/free tasks do not.

## Automatic plan lifecycle

1. On opening or saving a student notebook, fill the topic horizon from its class timetable. Teacher packets now include that class's topic plan and timetable. For older packages, use a built-in class timetable only when none is present.
2. Prepare and persist a lightweight snapshot for the immediately upcoming week in `ogrTaslak`. This is still a live preview and is recomputed after results or settings change.
3. On the next visit, promote any elapsed prepared week into the existing immutable `elle` snapshot format **before** recalculating the current plan. A student returning only on Sunday therefore retains the Monday–Saturday result rows.
4. Automatically preserve the current week's plan if it has work and no existing snapshot. Existing teacher/manual snapshots are not overwritten.
5. Downloading the preview does not freeze or unfreeze it. No confirmation or Monday visit is required.

## Catch-up and workload

Students joining late automatically receive the earlier curriculum topics in their personal topic pool. Missing scores of topics never given remain unknown; their work re-enters the queue without altering FSRS grades or learning history. Advanced settings can disable automatic catch-up and exclude unstarted topics introduced by it. Submitted results and existing weekly snapshots are retained.

Normal weeks keep the existing recall-based one/two-test rule. In overloaded student weeks, previously successful topics (last score at least 80%) can receive one 12-question test instead of two. Weak topics retain two tests. Reviews take priority over new topics when overloaded; placement can reuse earlier free days. A one-test daily capacity permits one initial test rather than starving all two-test items. No new work is placed on or after the exam date.

This is workload management, not a guarantee of zero overdue work or measured 90% retention. Finite capacity and weekly-only feedback can still cause delays. The balancing option is reversible in advanced settings.

## Background result sync

Successful local saves queue background sync. Startup, connection recovery and returning to the tab also check for remote results. A Firestore transaction merges remote ratings, numeric scores and lesson-delay events with the local snapshot before updating the result package, retaining newer corrections and other-device results. Failed sync retries with bounded exponential backoff. A first anonymous legacy-package connection binds its UID without replacing the server's result package. Account changes cancel stale work.

Returning to the tab on the same day does not replace the page contents. A date change may refresh an idle plan, while result entry, settings and open dialogs retain their unfinished inputs. Background result sync updates its status without replacing the active form.

The UI reports result-sync status, not a claim that every notebook setting or draft has been backed up to the cloud. Local weekly snapshots remain device-local until included in a notebook backup. Result packages use version 3 for ratings and lesson-delay events; version 1 and 2 numeric packages remain importable.

## Backups and printing on Apple devices

On iPhone and iPad, file exports call native file sharing inside the tap when the browser supports that file type. Cancelling does not trigger another download. Unsupported or blocked sharing opens a recovery view with a real download link and the complete backup text for copying. Desktop downloads also start without awaiting the optional artifact-host bridge. Blob URLs remain available for at least a minute rather than being revoked immediately.

Website printing renders the existing print document in a separate view inside the same page and calls `window.print()` directly. The preview remains available after cancellation or a failed print call, with a retry action and an iPhone PDF-saving hint. Closing restores the app and its title. This avoids depending on a pop-up or a delayed load-handler print, and does not change plans, FSRS cards or results. The embedded artifact-host download path remains supported.

`node test/mobile-export-regression.js` covers activation timing, iPhone/iPad detection, file contents, cancellation, unsupported sharing, download/copy recovery, direct printing and app-state preservation. These tests use browser API doubles; a physical iPhone print/share sheet still requires device verification.

## Scheduling validation

`node test/student-automation-regression.js` exercises eight Sunday-only weeks with deterministic synthetic scores, draft downloads, week transitions, serialization/reload, historical-plan stability, partial results, late joining, missed weeks, catch-up reversal, capacity changes, result merging, retry and account isolation. It also checks historical repetition labels, previous scores, consistent desktop/mobile/print labels, honest progress counts, map navigation and the exam-day countdown. It makes no real Firebase writes. The optional `YKS_BACKUP=/path/to/backup.json` check loads a private backup locally to verify real plans and preservation of existing history; the fixture is never committed.

`node test/genel-tekrar-regression.js` covers Hafızam (the recall value worked out from the formula, the line, the home card and the page, a spontaneous study through the slider, the picker), the week count with the student's own studies and its cap, the covered row leaving the plan, and the wording and effect of "Kendi programımı kendim yaparım"; `test/assumed-good-regression.cjs` covers the two new exceptions to the İyi assumption and the periods (open, close, same-day, validation); `test/ayt-timetable-regression.js` the round trip to the teacher. `node test/genel-tekrar-regression.js` also covers the home page's Bugün card (today's rows only, the plan's slider on each test, the count falling as results are entered, the week's progress, the streak with and without a result this week, teacher and exam-day exclusions); `test/personal-plan-browser.cjs` checks it at 1280 and 390 px (before the weeks map, heading on one line, no sideways scroll, the way to Planım).

CI runs nine Node suites covering teacher compatibility, student automation, mobile export, tab visibility, recall-feedback interactions, lesson postponement and learning-history epochs, result packages, cloud behavior and timetable imports.

The generated student-plan and settings markup was inspected for primary controls and duplicate IDs. A local-file browser preview was blocked by the browser's URL policy; no visual-browser pass is claimed. Production Firebase App Check behavior still depends on deployment configuration.
