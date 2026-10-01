# Other exams: LGS, KPSS, ALES, DGS, AGS

The student setup asks **"Hangi sınava hazırlanıyorsun?"**. YKS keeps the existing
paths: the school plan, the optional "Kendi TYT planım", or "Okula gitmiyorum".
Any other exam uses the same personal plan as "Okula gitmiyorum", built from that
exam's topic list.

## Setup

- For a non-YKS exam the form hides the school question, grade, class and field.
  The student enters their own exam date. The YKS default date is cleared when
  another exam is chosen and comes back when YKS is chosen again.
- The date must be at least two weeks away. YKS without school still needs four.
- The student gets `sinavTuru` (`LGS`, `KPSS`, `ALES`, `DGS` or `AGS`) and
  `okul: false`. They also get the internal field `SAY`, which only satisfies the
  existing validation and is never shown. Minutes default to 180 a day, with no
  Saturday mock exam.
- Ayarlar then shows **Kendi <exam> planın**. It has a level per course
  (Bilmiyorum / Biraz / Biliyorum), a target date that cannot be after the exam,
  and a collapsed **Kapsam ve kaynaklar** section with the official scope, source
  links and the date the list was compiled.

## Behaviour

- Topics come round-robin across the exam's courses, so the first week already
  mixes courses. Pacing, the 20-minute konu anlatımı, one-test checks, "Bu konuyu
  henüz çalışmadım", minute budget and spaced repetition are unchanged.
- Topics resolve with `kullaniciKonusuTam(idx, ad, dersAd, 12)`. The match needs
  the course slot, the name and the course label, so "Paragrafta Anlam" under
  KPSS Türkçe and under AGS Sözel Yetenek are separate topics. `idx` reuses the
  closest existing course slot (0 language, 1 mathematics, 2 science, 5 history,
  6 Revolution history/law, 7 geography, 8 philosophy/education, 9 religion). The
  screen always shows the exam's own course name.
- **Müfredat** (high-school curriculum) and **Denemelerim** (TYT/AYT mock exams)
  are hidden. The TYT→AYT weighting card is hidden. So is the Gelişmiş ayarlar
  "Konu planı" button: no student without a school has a school topic plan, and
  this applies to "Okula gitmiyorum" YKS students too.
- The countdown, report card, week map and settings date name the exam
  (“KPSS’ye giden yol”, “ALES’e 120 gün”, “KPSS tarihi”).
- `sinavTuru` is validated (`Geçersiz sınav türü`) and travels with the work
  snapshot like `okul`. `kendiPlan.tur` accepts `TYT`, `YKS` and the five exams.
  An unknown value is treated as YKS.

The exam cannot be changed after setup. A test account can use **Test hesabımı
sıfırla** and choose again.

## Topic lists

`data/sinav-konulari-2026.json` is the reviewed source. Run
`node scripts/embed-sinavlar.cjs` after editing it to update the
`const SINAV_KONULARI = …;` line in `index.html` (`--check` only verifies; CI runs
it). Never rename a topic that students already use: the name is its identity.
Add new topics instead.

| Exam | Courses (topics) | Official scope |
|---|---|---|
| LGS | Türkçe (14), Matematik (12), Fen Bilimleri (7 units), T.C. İnkılap Tarihi ve Atatürkçülük (7), Din Kültürü (5), İngilizce (10 units) | MEB: 8th-grade programmes, both terms; 2027 scope announced as unchanged |
| KPSS | Türkçe (12), Matematik (15), Geometri (5), Tarih (11), Coğrafya (8), Vatandaşlık (9), Güncel Bilgiler (3) | ÖSYM: Genel Yetenek–Genel Kültür |
| ALES | Türkçe (5), Matematik (12), Geometri (6) | ÖSYM: Sayısal and Sözel tests, 50 questions each |
| DGS | Türkçe (6), Matematik (10), Geometri (6) | ÖSYM: Sayısal and Sözel tests, 50 questions each |
| AGS | Sözel Yetenek (5), Sayısal Yetenek (3), Tarih (4), Türkiye Coğrafyası (2), Eğitim Bilimleri ve Türk Millî Eğitim Sistemi (11), Mevzuat (5) | ÖSYM, 8 January 2026: 80 questions in six areas |

Sources (compiled 1 October 2026):

- LGS: [MEB 2026 LGS guide announcement](https://www.meb.gov.tr/2026-lgs-kapsamindaki-merkezi-sinav-icin-basvuru-ve-uygulama-kilavuzu-yayimlandi/haber/40200/tr),
  [kitapsec](https://www.kitapsec.com/blog/2027-lgs-konulari-219.html),
  [kitapdoldur](https://www.kitapdoldur.com/blog/icerik/2027-lgs-turkce-konulari-ve-soru-dagilimi)
- KPSS: [dopinghafiza](https://www.dopinghafiza.com/ders/kpss-lisans/kpss-lisans-soru-dagilimi-2026-genel-yetenek-ve-genel-kultur),
  [rehberpanda](https://rehberpanda.com/rehberler/kpss/lisans/konu-dagilimi/),
  [bilgenc](https://www.bilgenc.com/kpss-lisans-konulari/)
- ALES: [bilgenc](https://www.bilgenc.com/ales-konulari/),
  [rehberpanda](https://rehberpanda.com/rehberler/ales/konu-dagilimi/),
  [xyzakademi](https://www.xyzakademi.com.tr/ales-konulari/)
- DGS: [bilgenc](https://www.bilgenc.com/dgs-konulari/),
  [universitego](https://www.universitego.com/dgs-konulari-ve-soru-dagilimi/),
  [rehberpanda](https://rehberpanda.com/blog/2026-dgs-konulari-soru-dagilimi-guncellenmis/)
- AGS: [ÖSYM topic distribution, 8 Jan 2026](https://dokuman.osym.gov.tr/pdfdokuman/2026/MEB-AGS/konudagilimi08012026.pdf),
  [atlasrehberlik](https://www.atlasrehberlik.com/2026-ags-konulari-ve-soru-dagilimlari/),
  [murathoca](https://murathoca.com.tr/meb-ags-konu-soru-dagilimi/)

### Caveats

- ÖSYM publishes only the test areas for KPSS, ALES and DGS, not topic lists. The
  topics are the headings that the cited preparation sources share.
- The ÖSYM AGS document could not be opened from the build environment. The site
  returned an access-denied page. The AGS sub-topics were cross-checked between
  two sources that reproduce it. Review them against the PDF.
- Not covered: KPSS Eğitim Bilimleri and Alan Bilgisi, AGS ÖABT, and the logic
  (sayısal/sözel mantık) question types beyond a single topic each.
- Exam dates are not built in. Each student enters the official date from the MEB
  or ÖSYM calendar.

## Tests

- `node test/exam-plan-regression.js`: 10 checks. They cover the embedded data,
  setup per exam (date required, two-week minimum, unknown exam refused), YKS
  unchanged, exact topic sets, same-name topics kept apart, lessons outside the
  internal field leading to tests, known courses starting with a check test, exam
  wording on every screen, and validation and sync.
- `node test/personal-plan-browser.cjs` step 4: KPSS setup at desktop and 390 px
  width, hidden YKS questions, the plan card, tabs, countdown and first lessons.
