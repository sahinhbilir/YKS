# Grade 11 weekly learning outcomes

Reviewed against the live Türkiye Yüzyılı Maarif Modeli unit pages on 26 September 2026.

The former school plan introduced each broad topic once. Weeks within the same topic consequently had no new work. Grade 11 now has **36 distinct weekly groups per supported subject**, across 38 units and nine subjects (324 groups). Each entry repeats a readable main heading and adds an outcome-based subtopic. A repeated heading never collapses the different subtopics into one review card.

For example, the mathematics programme's [statistics unit](https://tymm.meb.gov.tr/matematik-dersi/unite/298) maps to:

| Suggested week | Main heading | Subtopic | Outcome reference |
| --- | --- | --- | --- |
| 1 | İstatistiksel Araştırma Süreci | Research question and data collection plan | MAT.11.1.1 |
| 2 | İstatistiksel Araştırma Süreci | Preparing data and choosing a representation | MAT.11.1.1 |
| 3 | İstatistiksel Araştırma Süreci | Analysing data and interpreting findings | MAT.11.1.1 |
| 4 | İstatistiksel Araştırma Süreci | Evaluating conclusions, errors and bias | MAT.11.1.1, MAT.11.1.2 |

## Source and pacing decisions

- `data/curriculum-2026-2027.json` contains each unit's official URL, the outcome codes found in its **Öğrenme Çıktıları ve Süreç Bileşenleri** section (`ciktiKodlari`), a readable `planBasligi`, and editorial `haftalikKazanimlar` labels with their outcome references. Every published outcome in these 38 sections is referenced by at least one group.
- Labels are concise planning summaries of outcomes and their process components, not quotations or new official outcome names. One outcome can span several weeks; related outcomes can share a week. The source browser shows the codes and unit links for verification. Student-facing topic titles show the main heading and subtopic without grade or code prefixes.
- Unit boundaries follow cumulative programme hours rounded to 36 weeks. Weekly subdivisions are an **editable suggestion**, not an official dated annual plan. This does not assume every unit lasts one month, does not derive week numbers from monthly publisher covers, and does not skip holidays automatically.
- Mathematics uses separate headings for statistics, geometry, trigonometry, exponential/logarithmic functions and operations on functions. Ordinary mathematics / AYT mathematics is the Grade 11 school course; explicit TYT mathematics retains its separate sequence. A standalone geometry or Turkish course is not automatically given another course's plan.
- Grades 9, 10 and 12 retain their previous planning behaviour.

## Existing notebooks

Returning students see a preview on their plan and in **Konu Planı**. Default school courses are selected; edited or intentionally empty courses require explicit selection. Applying the displayed change updates only the selected courses' eligible weeks, after saving a complete recovery backup. The backup can be downloaded from the same screens.

Past weeks, weeks with results, and manually issued/frozen weeks (including future snapshots and overlapping personal reporting cycles) remain unchanged. The student's current unscored automatic snapshot can be rebuilt in the same action. Retired default headings that no longer appear in the selected course plan lose their unscored scheduling/catch-up dates, so obsolete broad headings cannot crowd out their replacements. Recorded topics, personal additions and protected plan references are retained. Existing topic indexes, records and cards remain intact. Updated groups use separate internal identity slots; legacy broad-topic identities still resolve to their original source. New enrollments use weekly outcome groups immediately.

Tests cover all 324 groups, complete outcome-code coverage, hour-based boundaries, title limits and source lookup, separate weekly topic IDs, TYT isolation, package round trips, pure previews, atomic failure when backup storage is full, selective upgrades, and protection of results and issued weeks. Browser tests exercise upload, preview and upgrade on desktop and mobile with synthetic notebooks. The attached private backup was also checked locally without publishing its contents or changing the original file.
