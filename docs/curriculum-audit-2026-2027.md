# Curriculum audit — 2026–2027

Checked against the live site/repository at `be9d6c9`, the connected Drive module contents, and official MEB sources on 23–24 September 2026.

## Verdict

The existing weekly plans are **YKS revision plans**, combining earlier grades, and largely follow the publisher's module sequence. They are not the official grade-12 school-year sequence. Interleaving TYT and AYT in physics is intentional in those modules; it is not by itself an ordering error. However, the site was not complete or correct enough to describe every topic as verified.

| Finding | Change |
|---|---|
| Only SAY and EA had default weekly plans; no grade field | Add explicit grades 9–12 in both enrollment flows. Missing grade in old records means 12; no automatic annual promotion. |
| SAY omitted the TYT social courses | Add history, geography, philosophy and religion to new defaults; show an additive repair preview for existing branches. |
| EA omitted science courses despite timetable science slots; religion and history also missing | Add TYT science and the missing social courses to new defaults; offer additive repair. |
| Physics default omitted Süper İletkenler (official 12.6.3) | Include it after semiconductors in new SAY plans; expose the omission in existing branch plans. |
| EA's philosophy list also included psychology, sociology and logic | New EA/SAY/DİL defaults keep philosophy. SÖZ retains the philosophy-group list. Existing teacher edits remain untouched. |
| SÖZ/DİL could be selected without a corresponding default | Generate suitable defaults from the existing module pools. DİL is explicitly TYT-only; no YDT syllabus is claimed. |
| Catalog physics units were mismatched | Correct visible labels for alternating current, buoyancy, wave mechanics, Big Bang and radioactivity. |
| Catalog physics outcome codes contain parsing mistakes; basic mathematics and advanced mathematics rows are mixed | Preserve historical catalog identity for saved results. The separately sourced curriculum browser is the reference for current school content; the old catalog is explicitly labeled as legacy revision content. |

## Which curriculum applies now?

[MEB's 2026–2027 transition announcement](https://ogm.meb.gov.tr/www/2026-2027-egitim-ogretim-yili-turkiye-yuzyili-maarif-modeli-taslak-cerceve-planlar-yayimlandi/icerik/2633/tr) specifies:

| Grade | School programme in 2026–2027 | Planning source |
|---|---|---|
| 9 | Türkiye Yüzyılı Maarif Modeli (TYMM) | Current official programme, with textbook links |
| 10 | TYMM | Current official programme, with textbook links |
| 11 | TYMM — newly applicable to this cohort | Current official programme, with textbook links |
| 12 | Previous programme | Previous official programme for the school curriculum; existing Drive YKS modules for revision order |

Important example: **grade-11 mathematics** now runs through statistics, geometric shapes, trigonometry, exponential/logarithmic functions, and function composition. The older Drive grade-11 module begins with trigonometry, so that module cannot define this year's grade-11 school sequence. The official programme uses three subparts of the same “Nicelikler ve Değişimler” theme; its repeated theme number is retained in the source data.

## Coverage and sources

`data/curriculum-2026-2027.json` contains subject → unit/theme → factual topic labels, official programme URLs, unit URLs, and available MEB textbook links. The application embeds the same data for offline student exports. Update the reviewed JSON and run `node scripts/embed-curriculum.cjs`; the regression test checks they agree.

The browser covers the existing application's core academic subjects: literature, mathematics, physics, chemistry, biology, history/revolution history, geography, philosophy and religion, at the grades in which they occur. It does **not** claim to cover foreign languages, every elective, vocational-school specialisms, or all school types. Some grade-12 humanities entries are unit-level summaries; the linked programme gives the detailed outcomes. Literature topics summarize the theme's reading genres and skills, not an invented genre-based annual order.

Primary sources:

- [Official secondary textbooks](https://tymm.meb.gov.tr/ders-kitaplari/ortaogretim).
- [Current grade-11 mathematics programme](https://tymm.meb.gov.tr/ogretim-programlari/matematik-dersi/13); its linked 2026 textbook contents were also inspected.
- Previous programmes: [mathematics](https://mufredat.meb.gov.tr/ProgramDetay.aspx?PID=343), [physics](https://mufredat.meb.gov.tr/ProgramDetay.aspx?PID=351), [chemistry](https://mufredat.meb.gov.tr/ProgramDetay.aspx?PID=350), [biology](https://mufredat.meb.gov.tr/ProgramDetay.aspx?PID=361), [literature](https://mufredat.meb.gov.tr/ProgramDetay.aspx?PID=353), [revolution history](https://mufredat.meb.gov.tr/ProgramDetay.aspx?PID=346), [geography](https://mufredat.meb.gov.tr/ProgramDetay.aspx?PID=336), [religion](https://mufredat.meb.gov.tr/ProgramDetay.aspx?PID=319).
- Connected Drive: 2025–2026 teacher module `02_lise_ogretmen_mod_1_mat.pdf`, YKS module-1 files with their full module-series contents (`05_12_KM_MF01_Fizik_I_26.pdf`, `07_12_KM_MF01_Kimya_26.pdf`, `08_12_KM_MF01_Biyoloji_26.pdf`, the geometry volume and `26KONMOD12TMS_*` subject files). Private source documents are not committed or republished.

Official online unit content frames were checked for the supported grades 9–11. Selected grade-11 textbook contents were visually inspected, not every page of every textbook. The year is explicitly versioned: this is not a promise of automatic future-year curriculum updates.

## Preservation and scheduling

- Existing students, their IDs, results, FSRS cards and issued snapshots are not migrated or rewritten. Original `KATALOG` content/order/signature and `VARSAYILAN_KONU_PLANI` remain unchanged.
- An existing branch's plan, including an intentionally empty plan, is never replaced during enrollment.
- New 9–11 plans preserve official topic order. A 36-week **suggested** distribution weights units by programme hours; it is not an official dated annual plan and does not skip holidays. The branch start and topic pacing are editable.
- Lower-grade topics use distinct identities and are filtered by grade. Ordinary user-authored topics also retain their grade. Student exports carry grade, branch start and custom topic data.
- Existing grade-12 repairs are previewed in Konu Planı and added only after the current/visible week. The existing topic sequence is retained; a missed topic whose original week has passed is scheduled for future catch-up. Repeating the repair does not add duplicates.
- No real student data was used in tests. Existing regressions plus grade-specific tests cover record preservation, timetable assignment, package roundtrip, branch isolation, and enrollment.
