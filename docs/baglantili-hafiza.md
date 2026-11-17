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

Each topic keeps the app's FSRS-6 card (S, D), built from its own results exactly as today. Three link effects are added. Each has a value per link that starts at 0.5 and is learnt.

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
- **Foundational**: the topics using it, directly or through others, weighted by use along the strongest path, add up to at least 1.5.
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
- **Topic = a point of light.** Flat core, no clip-art, no spikes, no nebulae, no decorative star field.
- **Colour** is the topic's shown recall, computed in OKLCH so the steps read as one spectrum:
  - At or above the student's line: mint, `oklch(.79 .13 163)` (light theme `oklch(.62 .13 163)`).
  - Below the line: crimson-red just under it, getting steadily darker to deep wine. `f = (line − r) / .45`, colour `oklch(.57 − .22f, .19 − .035f, 21° − 18°f)`; light theme starts at L `.52`.
  - No orange anywhere. The Hafızam card bar uses the same two reds.
- **Shine** shows the memory level, one step ahead of the ring:
  - short-term: soft light;
  - settling: a fully lit neuron, with a white-hot core and light in its colour;
  - long-term: fully lit and with its Saturn ring.

  Only never-studied topics are unlit.
- **Saturn ring** around every long-term topic, tilted, passing behind and then in front of the core.
  - **Golden shining ring** for a topic safe until YKS (recall on exam day still at or above the line).
  - **Asteroid belt:** a long-term topic that falls below the line keeps its ring, but the ring breaks into rocks and grains along the orbit. They spread out, thin and scatter as recall falls; at the deepest red only scattered grains are left.
- **Size** = importance, capped. A topic grows only up to the 85th percentile of importance, so the largest is about twice the smallest.
- **Labels:** only foundational and alarmed topics are named before anything is touched.
- **Alarms:** an alarmed foundation twinkles (an animated pulse of its own light; still when the student asks for reduced motion). The top 3 also appear as chips above the map, whose dot is the topic's own colour. There is no separate alarm ring.
- **Never studied:** a faint grey point.
- **Touch / hover:**
  - The topic grows and its threads and neighbours light up while the rest dims.
  - It opens the **real Hafızam card** (`hafizaSatiri`), not a look-alike. It is placed on the side that covers the fewest topics.
  - On a computer, hover shows the card and a click pins it. On a phone, the card opens under the map.
- **Teacher side:** Ayarlar → a "Bağlantılı hafıza" box with **Bağları güncelle** (learns the links from the notebook's results, with a progress bar), when it last ran, and the links that do not seem to hold.
- **Map editing:** for v1 only in the repository (`data/hafiza-haritasi-*.json`), by the project owner. Confusable pairs are drawn there only, with no effect.

## In the app (v1)

- **Haritam tab** (`src/haritam.js`, `src/haritam.css`, embedded with `src/hafiza-ag.js` and the map by `scripts/embed-haritam.cjs`). It sits right after Hafızam for students with Mathematics (`HARITAM.uygun`); Physics is shown for SAY, and before grade 12 when no field is chosen.
- **Topic resolution.** A map topic is fed by:
  - the student's plan topics with the same course label and name;
  - every school unit (`birimler`: subject, grade, catalogue name) that covers it.

  A unit's result and lesson day count for each YKS topic it covers.
- **Inputs.** The student's real results (`sonucNotu`, excluding `sonucDevreDisiMi` rows), lesson days (`ogrenciIslenisTarihi`), forgetting speed per lesson (`unutmaKatsayisi`), FSRS parameters (`parametreAl`), recall target (`hedefTutma`) and exam day.
- **Card.** The touched topic's card is Hafızam's own `hafizaSatiri`. It shows the map's recall, and its bar uses the map's reds inside Haritam only. Its buttons are Hafızam's (Çalıştım opens the same result slider).
- **Not changed.** Hafızam, the weekly plan and every FSRS card.
- **Tests.**
  - `test/hafiza-ag-regression.cjs` (algorithm).
  - `test/haritam-regression.cjs` (tab rules, resolution, page).
  - `test/haritam-browser.cjs` (1280 px dark/light, 390 px; hover, pin, Çalıştım, filter).

## Not done yet

- Teacher side: **Bağları güncelle** and storing and delivering the learnt link values. Until then every link uses its starting values.
- The rest of the Mathematics, Geometry and Physics map, after the pilot is reviewed.
- Hafızam's own states ("Çoktan unuttum", Düzenle) and basket lessons are not yet read by the map.
