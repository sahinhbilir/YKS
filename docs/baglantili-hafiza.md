# Bağlantılı hafıza (connected memory)

FSRS-6 on a map of topics. A topic's memory is not alone: practising a topic refreshes the topics it is built on, a failed foundation weakens what is built on it, and a weak foundation makes what rests on it look weaker. Code: `src/hafiza-ag.js` (`HAFIZA_AG`), tests: `test/hafiza-ag-regression.cjs`. **Not embedded in `index.html` and not used by the app yet.**

Every rule below was decided in the design session of 2026-11-17. Lines marked *builder default* were not asked and can be changed. Every number is a provisional starting value; the learnable ones are learnt from results.

## The map

- **One kind of link: "A uses B".** B is A's foundation by logic, whatever order the müfredat teaches them (Math vectors → Physics vectors even if physics teaches it first). A foundation can be a simpler or intermediate version of another topic, and topics can share foundations.
- **Use level** (how much of B topic A uses): az 0.25 · çok 0.5 · tam 1. Use level is *coverage*, not memory credit. "Tam" means A contains all of B. It does not mean an A test is a full B review.
- **Hidden parts.** A piece of a topic that is not a müfredat topic (e.g. *sin/cos in a right triangle*, part of TYT trigonometry): `{gizli: true, parcasi: X}`. A test of X is the part's own test. Credit reaching X reaches the part. Its alarm tells the student to study X. Shown on the map as small nodes.
- **Twins** (a school unit and a YKS-list topic with the same content): one node, one memory. A result on either counts for both (`esler`).
- **Confusable links** (`tur: 'karisik'`): drawn by teachers only, no effect on memory. An algorithm for them comes later, if teachers find it useful.
- **v1 scope:** Mathematics, Geometry, Physics (TYT and AYT). I draft the starter map; teachers edit it.

## Memory

Each topic keeps the app's FSRS-6 card (S, D), built exactly as Hafızam builds it (below). Three link effects are added. Each has a value per link that starts at 0.5 and is learnt.

**A topic's own memory follows Hafızam's rules** (decided 2026-11-17: Haritam is Hafızam drawn as a map, not a second memory). With every link value at 0, the map shows Hafızam's own numbers exactly:

- **Lesson day.** Starts the memory as an "İyi" that day, until the topic's first own test. A later lesson before any test counts from that later day.
- **First own test.** A first FSRS review (`ilkS` of its grade), as in Hafızam, whatever the lesson or credit built before it.
- **Düzenle and "Çoktan unuttum".** The student's own setting replaces the memory at that moment (`hafizaElleKarti`: recall r that day, S days to fall to 90 %). Results entered after it go on from it; same-day order is by entry time.
- **Basket lesson** (konu anlatımı in the basket, day come, not "Yapmadım"). After the last own test it restarts the topic as a fresh "İyi" until the next own test, which goes on from the memory before the lesson. Before any test it counts like a lesson day. It credits the foundations like a lesson.

| Event | Effect | Reach |
|---|---|---|
| A passed (Zor/İyi/Kolay) | B gets a **fractional review**: share = kredi × use, multiplied along the chain, dropped below 0.05 | down the chain |
| A taught (lesson day) | same as an "İyi" pass | down the chain |
| B failed | A gets a **fractional lapse**: share = ceza × use | one step up only |
| A failed | B's memory unchanged; B gets an **orange check flag** | one step down |
| Any time | A's **shown** recall is pulled toward a weaker foundation: own − çekiş × use × (own − foundation's shown) | live, up the chain |

- **Fractional review.** The new stability is FSRS's own full-review stability, taken in log space by the share. Recall is raised by the same share. A review while recall is still high gives almost nothing, as a full early FSRS review would. Credit counts at most as "İyi" *(builder default)*.
- **Starting memory.** A lesson or a pass on A starts the memory of any foundation that has none, as if taught that day. Starting depends on use only, not on the learnt credit *(builder default, keeps learning stable)*.
- **Pull-down.** Only the strongest pull counts. A foundation without memory pulls nothing. It changes only what is shown, never the stored memory.
- **No cap and no "speed".** Credit can keep a topic up indefinitely. A student for whom credit does not hold gets a learnt credit near 0 on that link (below), which replaces Math Academy's speed rule.

## What the student sees

- **Recall** (colour, red → green): the shown recall, own memory with the pull-down applied.
- **Memory level** from stability S (days for recall to fall to 90 %): < 7 short-term · 7–30 settling · ≥ 30 long-term. Credit can lift a topic to long-term.
- **Safe until YKS** (star): shown recall on exam day, with no more study, is at least the student's own target.
- **Foundational**: the topics using it, directly or through others, weighted by use along the strongest path, add up to at least 4. On 2026-11-17 it went from 1.5 (65 of the 178 math and physics topics) to 2.5 (43), then to 4 (30 of the 371 topics of every subject, almost all in mathematics; only long chains reach it).
- **Importance**: 2 × the topic's own expected YKS questions + Σ (use along the chain × that user's expected questions).
- **Alarms** (foundational topics only, one per topic, in this order):
  1. **grey**: no memory, while a topic using it has memory;
  2. **red**: shown recall below the target;
  3. **orange**: a topic using it was failed after its last own test;
  4. **yellow**: not long-term yet.

  Hafızam shows the top 3: by colour, then importance. The rest go under "N more". The map shows a dot on every alarmed node.
- Map look: to be chosen from image mockups.

## Check tests (5 questions)

- **When doubtful:** every topic with an orange flag.
- **Monthly sample:** at most one per student per 30 days, drawn at random (stable per student and window) among topics kept up by credit with no own test for 30 days (counted from when their memory started, if never tested).
- Their results are ordinary results and train the links.

## Learning the links

- **What is learnt:** for every link, kredi, ceza and çekiş.
- **Method:** grid search over 0, 0.125 … 1 on the log-likelihood of each own result given the shown recall just before it.
- **Shared value** (the teacher's notebook): the notebook's best value, blended with the start value 0.5 by count, so that 10 results weigh as much as the start.
- **A student's value:** their own best value, blended with the shared value. After 10 of their own results on that link, their data weighs as much as the shared value.
- **Bad links:** if a link's shared kredi falls below 0.1 over at least 30 results, the teacher is told ("this link does not seem to hold for your students"). The teacher decides; nothing is deleted.
- **Builder defaults:**
  - Each value is judged by its direct effect only (kredi on the foundation and below, ceza and çekiş on the topic using it).
  - One coordinate pass per call.
  - `sadece` limits a call to some links, so the work can be spread (about 1 s per student per full pass on a 90-link map).

## Proving it

`degerlendir` compares the map with the app's plain FSRS-6 on the same results (mean log loss of the predicted recall, lower is better). v1 changes only Hafızam and the map. The weekly plan keeps plain FSRS until real results show the map predicts better.

## Past-exam question counts

- **Expected questions** for a topic = mean over all years, each year weighted 0.9 × the year after it.
- **Patterns** ("every year", "every two years", "in 3 of 8 years") are shown only. They never lower a priority.
- **Source data:**
  - TYT 2018–2025 from the school's distribution table.
  - AYT from kitapsec.com's yearly table.
- **Splitting.** An exam topic often covers several app topics. I propose how its count is split among them; teachers correct it.

## Sources behind the rules

- **Implicit credit down, failure up, check flags:**
  - Skycak, [*Individualized spaced repetition in hierarchical knowledge structures*](https://www.justinmath.com/individualized-spaced-repetition-in-hierarchical-knowledge-structures) (Math Academy, FIRe).
  - Käser et al. 2014, [*Beyond Knowledge Tracing*](https://www.cs.toronto.edu/~aschwing/KaeserEtAl_ITS2014.pdf).
- **Storage vs retrieval strength** (the two indicators):
  - Bjork & Bjork 2020, [*Desirable difficulties in theory and practice*](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2021/01/RABjorkELBjorkJARMAC2020ForPostingSingleSpaced.pdf).
  - Woźniak et al. 1995, [*Two components of long-term memory*](https://ane.pl/index.php/ane/article/download/1090/1090).
- **Testing helps related material, but only partly:**
  - Chan, McDermott & Roediger 2006 (*JEP: General* 135).
  - Pan & Rickard 2018, [meta-analysis](https://sc-pan.github.io/pdf/PR_2018.pdf).
- **Confusable topics:** Anderson, Bjork & Bjork 1994, [*Remembering can cause forgetting*](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/Anderson_RBjork_EBjork_1994.pdf).
- **FSRS-6 and its evaluation:**
  - [A technical explanation of FSRS-6](https://expertium.github.io/Algorithm.html).
  - [SRS benchmark](https://expertium.github.io/Benchmark.html).
- **Exam-date retention:** Cepeda et al. 2008, [*Spacing effects in learning*](https://www.evullab.org/pdf/CepedaVulRohrerWixtedPashler-PS-2008.pdf).
- **Learning link effects from results:**
  - Choffin et al. 2019, [DAS3H](https://arxiv.org/abs/1905.06873).
  - Zhou et al. 2024, [PSI-KT](https://arxiv.org/abs/2403.13179).
  - Khajah, Lindsey & Mozer 2016, [*How deep is knowledge tracing?*](https://arxiv.org/abs/1604.02416).

## Haritam: what the student sees (decided 2026-11-17 from image mockups)

- **Placement:** a new tab, **Haritam**, for every student who has Mathematics. Each student sees only their own subjects. Hafızam stays as it is.
- **Background:** neutral, never blue.
  - Dark: near-black `#0E0E0F`.
  - Light: white.
  - Light mode follows the app theme with the same rules (a "daytime" version).
- **Layout:** every subject is its own constellation (neural network), and a thread between constellations is a cross-subject link.
  - The subject name sits above its constellation in small, letter-spaced capitals.
  - Threads are thin and neutral: white or black at low opacity, never coloured.
  - All subjects share one scale, so a link is equally long everywhere. Subjects sit in rows of two (one column on a phone), each row as tall as its tallest subject, so a big subject gets more room and the map grows taller instead of crowding.
- **Topic = a point of light.** Flat core, no clip-art, no spikes, no nebulae, no decorative star field.
- **Colour** is the topic's shown recall, computed in OKLCH so the steps read as one spectrum:
  - At or above the student's line: mint, `oklch(.79 .13 163)` (light theme `oklch(.62 .13 163)`).
  - Below the line: crimson-red just under it, getting steadily darker to deep wine. `f = (line − r) / .45`, colour `oklch(.57 − .22f, .19 − .035f, 21° − 18°f)`; light theme starts at L `.52`.
  - No orange anywhere. The Hafızam card bar uses the same two reds.
- **Shine** shows the memory level, one step ahead of the ring:
  - short-term: soft light;
  - settling: a fully lit neuron, with a white-hot core and light in its colour;
  - long-term: fully lit and with its Saturn ring.

  On 2026-11-18 every glow was lowered half a step (short-term ¼, settling and long-term ¾), then 30 % more: short-term at 0.175 of the original strength, settling and long-term at 0.525. Every studied topic, short-term ones and hidden parts included, has a hot core (a point without one was distracting). The core's heat follows the shine, like a cooling ember: white-hot where the glow is strong (settling, long-term), a warm tint of the topic's own colour (40 % toward white) where the glow is weak (short-term), so the core never outshines its glow.

  Only never-studied topics are unlit.
- **Saturn ring** around every long-term topic, tilted, passing behind and then in front of the core.
  - **Golden shining ring** for a topic safe until YKS (recall on exam day still at or above the line).
  - **Asteroid belt:** a long-term topic that falls below the line keeps its ring, but the ring breaks into rocks and grains along the orbit. They spread out, thin and scatter as recall falls; at the deepest red only scattered grains are left.
- **Size** = importance, capped. A topic grows only up to the 85th percentile of importance, so the largest is about twice the smallest.
- **Labels:** only foundational and alarmed topics are named before anything is touched, alarms first, then foundations by importance. A label that would cover one already placed is left out. Touching a topic names its neighbours. Labels are drawn larger on a phone and never cut at the edge.
- **Touch:** only a topic's own spot takes the pointer; a neighbour's glow never covers it.
- **Alarms:** an alarmed foundation twinkles (an animated pulse of its own light; still when the student asks for reduced motion). The top 3 also appear as chips above the map, whose dot is the topic's own colour. There is no separate alarm ring.
- **Never studied:** a faint grey point.
- **Touch / hover:**
  - The topic grows and its threads and neighbours light up while the rest dims.
  - It opens the **real Hafızam card** (`hafizaSatiri`), not a look-alike. It is placed on the side that covers the fewest topics.
  - On a computer, hover shows the card and a click pins it. On a phone, the card opens under the map.
- **Teacher side:** Ayarlar → a "Bağlantılı hafıza" box with **Bağları güncelle** (learns the links from the notebook's results, with a progress bar), when it last ran, and the links that do not seem to hold.
- **Map editing:** for v1 only in the repository (`data/hafiza-haritasi-*.json`), by the project owner. Confusable pairs are drawn there only, with no effect.

## In the app (v1)

- **Haritam tab** (`src/haritam.js`, `src/haritam.css`, embedded with `src/hafiza-ag.js` and the map by `scripts/embed-haritam.cjs`). It sits right after Hafızam for every YKS student (`HARITAM.uygun`) with the topics of their exams (`HARITAM.gorunur`, 2026-11-18; `HARITAM.dersleri` lists the subjects that have one). Every topic of the map says which exam asks it (`sinav`: TYT, AYT or both):
  - every TYT topic for every YKS student: Türkçe, TYT Matematik and Geometri, TYT Fizik, Kimya and Biyoloji, Tarih, İnkılap Tarihi's TYT part, TYT Coğrafya, Felsefe and Din Kültürü;
  - and the AYT topics of the subjects their field's AYT has: SAY Matematik, Geometri, Fizik, Kimya, Biyoloji; EA Matematik, Geometri, Edebiyat, Tarih-1 (Tarih and İnkılap Tarihi), Coğrafya-1; SÖZ Edebiyat, Tarih, İnkılap Tarihi, Coğrafya, the Felsefe grubu, Din Kültürü; DİL none (its second exam is YDT);
  - with no field yet, every topic. A hidden part goes with its topic. Before, a student saw whole subjects by field: an SAY student had no Tarih, Coğrafya, Felsefe or Din Kültürü, an EA student no TYT Fizik, Kimya or Biyoloji, and SÖZ and DİL no TYT Matematik, though every YKS student takes TYT.
- **Topic resolution.** A map topic is fed by:
  - the student's plan topics with the same course label and name;
  - every school unit (`birimler`: subject, grade, catalogue name) that covers it.

  A unit's result and lesson day count for each YKS topic it covers.
- **Inputs: what Hafızam reads.**
  - Real results (`sonucNotu`, excluding `sonucDevreDisiMi` rows), with their entry time.
  - Lesson days (`ogrenciIslenisTarihi`) and basket lessons (`konuAnlatimGunleri`, shared with Hafızam).
  - Own settings (`hafizaElle`: Düzenle and "Çoktan unuttum").
  - Forgetting speed per lesson (`unutmaKatsayisi`), FSRS parameters (`parametreAl`), recall target (`hedefTutma`) and exam day.
- **One number on both pages.**
  - Hafızam (`hafizaDurumu`) takes the map's value for the student's topics on the map: recall, below the line or not, line day, stability. A school unit covering several map topics shows their mean.
  - `rKendi` keeps the topic's own value. The row says how much connected topics changed it ("bağlı konular +6").
  - The map's line day is the own curve's crossing when nothing pulls, else the shown recall's crossing.
  - The map is computed once per input (`HARITAM.durum` keeps the last answer): about 13 ms for 250 results, then about 4 ms.
- **Card.** The touched topic's card is Hafızam's own `hafizaSatiri`, so it is the same card and number as in Hafızam. Its bar uses the map's reds inside Haritam only. Its buttons are Hafızam's (Çalıştım opens the same result slider). For a topic fed by a school unit covering several map topics, the card shows this topic's value and says Hafızam shows the unit's mean.
- **Not changed.** The weekly plan and every stored FSRS card (`D.kart`); only what Hafızam shows.
- **Teacher (v1: teacher view only).** Ayarlar → Öğrenci kalibrasyonu → **Bağlantılı hafıza**.
  - **Bağları güncelle** learns every link over the notebook's active students with results. It works one link at a time with a progress bar (`HARITAM.ogren`) and stores the values in the notebook as `D.hafizaAg`:
    - shared values for every link;
    - a student's own values only for links where they had results;
    - rounded, with the time, student and result counts, and the links that do not seem to hold.
  - The teacher opens any student's map from the same box, computed with the learnt values.
  - Students' Haritam keeps the starting values until delivery is decided.
- **Tests.**
  - `test/hafiza-ag-regression.cjs` (algorithm).
  - `test/haritam-regression.cjs` (tab rules, resolution, page; Hafızam's states in, and the same number on both pages, with no link effects equal to Hafızam's own).
  - `test/haritam-browser.cjs` (1280 px dark/light, 390 px; hover, pin, Çalıştım, filter).

## Full map (2026-11-17, in the app; every YKS topic 2026-11-18)

- `data/hafiza-haritasi-tam.json`, built by `scripts/hafiza-haritasi-tam.py`:
  - every topic of the app's YKS plans (407): the SAY and EA plans, the Tarih (18) and Din Kültürü (20) every plan gets (`YKS_EK_DERSLER`), and Süper İletkenler (MEB 12.6.3, inserted into every SAY plan); Geometri, Matematik TYT and AYT, Fizik, Kimya, Biyoloji, Türkçe, Türk Dili ve Edebiyatı, Tarih, İnkılap Tarihi, Coğrafya, Felsefe grubu, Din Kültürü. Tarih is named as the 2023 programme this year's 12th grade was taught, Din Kültürü as the 2018 DKAB programme (checked against mufredat.meb.gov.tr);
  - ten parts: the pilot's three hidden parts, and Felsefe's seven branches (Varlık, Bilgi, Bilim, Ahlak, Din, Siyaset, Sanat Felsefesi: MEB 10.3.1–10.3.7, `dal`). The plan has them as one topic, "Felsefenin Temel Konuları ve Problemleri"; the branches are its parts, so its lessons and tests are theirs and a branch shows its card, but each is drawn as a topic with its own links (Bilgi Felsefesi → 15.–17. and 18.–19. yüzyıl felsefesi, Bilim Felsefesi, psikolojinin temel süreçleri; Varlık → MÖ 6. yüzyıl; Din → MS 2.–15. yüzyıl; Bilim → 20. yüzyıl …). The plan and the stored data are unchanged (decided 2026-11-18: the catalogue's numbering is frozen, so a real split would rewrite every şube's plan);
  - 650 links with use level and reason (the pilot's kept as reviewed), a few across subjects (orantı → harita ölçeği and kimyasal hesaplamalar, logaritma → pH, olasılık → kalıtım, TYT mantık → sembolik mantık, Denge Stratejisi → XX. yüzyıl başları, Türklerin İslamiyet'i kabulü → Anadolu'da İslam, Bilgi Felsefesi → psikolojinin temel süreçleri);
  - exam shares for every TYT row from 2018 (the school's table) and every AYT row from 2018 (kitapsec.com; 2025 only for mathematics). Checked row by row against the school's table on 2026-11-18, which added the rows the map lacked: TYT Tarih and Din Kültürü; Felsefe by branch (Bilgi Felsefesi 12 questions in 2018–2025); TYT Fizik Hareket ve Kuvvet (7) and İş, Güç, Enerji (1), whose topics the plan lists under AYT; TYT Matematik Oran-Orantı, Denklem Çözme, Köklü İfadeler, Çarpanlara Ayırma, İşlem; TYT Geometri Analitik Geometri. A blank cell of that table (Basit Eşitsizlikler, Oran-Orantı …) is 2024 with no question. AYT Tarih-1 adds the Tarih units (kitapsec.com);
  - 443 school units (grades 9–12), Tarih and Din Kültürü included.
- A plan topic finds its catalogue topic by name; the Felsefe grubu is "Felsefe" in every field's plan but SÖZ's (`DERS_ESI`). Where the catalogue spells a topic otherwise ("Mö 6. Yüzyıl-ms 2. …", "Sosyo-ekonomik") it reaches the map as a school unit.
- A continued plan topic ("… (devamı)", "… - devamı") feeds its topic's point.
- The builder checks names against the plans (none missing), ids, cycles and share sums, and gives every topic its exam (`sinav`: the subject's rule — the plan's own TYT list for Fizik, Kimya and Biyoloji, the (TYT)/(AYT) of Coğrafya — and every exam whose rows count it).
- Review files: `node scripts/hafiza-haritasi.cjs data/hafiza-haritasi-tam.json <out>` writes the two tables and one picture per subject (a ← line under a topic lists its foundations from other subjects).
- 31 of 417 topics are foundational at the threshold of 4 (Bilgi Felsefesi is the new one).
- Embedded in place of the pilot (`scripts/embed-haritam.cjs`); `data/hafiza-haritasi-pilot.json` is kept as the reviewed trigonometry start. Each subject's layout is worked out when it is first drawn, not when the app opens.
- Pull-down applies to Hafızam too: a topic passed today whose foundation is weak shows a little under 100 %.

## Not done yet

- Delivering the learnt link values to students (teacher view only for now).
