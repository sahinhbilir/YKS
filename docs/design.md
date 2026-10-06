# Design

The look follows the "YKS 2027 · Hedefine bir adım daha yaklaş" image: white space,
navy headlines, royal blue as the one accent, light blue surfaces, and bold, plain
sans-serif type. Keep new screens inside these rules.

## Tokens

All colours are CSS variables on `:root` in `index.html`. The dark theme redefines
them in two places: under `prefers-color-scheme: dark` and under
`:root[data-theme="dark"]`. Use the variables; do not write hex colours in new rules.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--marka-koyu` | `#0B2A6B` navy | `#A9C1FF` | headings, brand, headline |
| `--marka` / `--vurgu` | `#1F4FC8` royal blue | `#4D7BEA` / `#7EA4FF` | primary buttons, links, active tab, focus ring |
| `--marka-acik` / `--vurgu-yumusak` | `#DCE6FB` / `#E8EFFC` | `#17254A` | selected rows, soft buttons, highlights |
| `--zemin` / `--kagit` | `#F4F7FD` / `#FFFFFF` | `#0A1226` / `#111B33` | page / cards |
| `--murekkep` / `--soluk` / `--cizgi` | `#0F1E3D` / `#55627A` / `#DCE3F0` | `#E6ECF8` / `#9AA8C4` / `#25314F` | text / secondary text / borders |
| `--iyi` / `--uyari` / `--kritik` | green / amber / red | lighter tints | status only, never decoration |
| `--il-koyu` / `--il-mavi` | navy / royal | light blue / royal | the cap-and-books drawing |

On white, `--vurgu` and white-on-`--vurgu` both reach about 7:1 contrast.
`--soluk` reaches about 6:1.

## Type

- Headings, the brand and the start-screen headline use `--baslik-font`. It is a
  system sans stack (Segoe UI, SF, Roboto…) at weight 700–800, so it needs no web
  font and works offline. Montserrat is used when the device has it.
- Body text stays on the existing sans stack at 15 px.
- Printed plans keep their own black-and-white stylesheet (`yazdirCSS`). Theme
  colours never reach paper.

## Start screen

`gorunumKurulum()` draws, top to bottom:

1. **YKS {year}**. The year comes from the YKS date in the settings.
2. "Hedefine bir adım daha yaklaş".
3. The student login, open by default. One form serves both kinds of student: a
   Kaydol account (user name + password) and a school student (name + school
   number). See docs/kaydol.md.
4. Under the login button, "Rehber öğretmeniyim" on its own row, then "Kaydol" and
   "Test hesabı aç" side by side. The three do not fit one 340 px row.
5. The cap-and-books drawing.
6. One folded "Yedekten geri yükle" link. It opens the file picker and the paste
   option.

The login card is compact: 340 px wide, with two inputs whose labels are visually
hidden. The placeholders show instead: "Kullanıcı adı - Ad soyad" and "Şifre - Okul
numarası". Screen readers still read the labels.

- The second input is a password field (no number spinner). An eye button inside it
  on the right shows or hides the text (`sifreKutusu`, `data-sifre-goster`, with
  `aria-pressed` and "Şifreyi göster/gizle"). The browser's own reveal button is hidden.
- Enter in either input submits.
- After a failed login, the button splits into two equal halves (`.giris-dugmeler.bolunmus`):
  "Giriş yap" stays primary on the left, and "Parolamı unuttum" on the right opens a popup
  (`parolaPenceresi`, see docs/kaydol.md).
- "Kaydol" swaps the card for the sign-up card (`kaydolKarti`): user name, password
  (same eye button) and field, then "Kaydol ve başla" and "Girişe dön".

The whole column is centred vertically. The gaps between headline, login, drawing and
link are flexible spacers (`.giris-ara`). They grow only into free space, and only up
to a cap (30→130, 30→130 and 22→52 px), so a tall screen opens the layout up a little.
The gaps above and below the login card are equal. The drawing's viewBox starts at
the tip of the cap, so the visible gap is the spacer itself.
When the column is shorter than the screen, the space above and below is equal. When it is taller (short laptops, phones), it scrolls from a
small top margin that still clears the corner bands.

The screen carries no hint sentences. The status line under "Giriş yap" stays empty
until there is an error or progress message.

## No explanatory text

The design explains itself: no page subtitles that describe the page, no "how it
works" paragraphs, no colour legends and no hints under fields. What stays:

- data (counts, dates, names, totals), labels and headings;
- status and error messages, and a short line where a choice has a consequence (for
  example, "Buluttakini aç" discards unsaved changes on this device);
- one-line steps a feature cannot be used without (the AI timetable and paper-plan
  import);
- warnings in the confirmation dialogs of destructive actions;
- the opt-in "Nasıl seçilir?" help in Sonuç gir.

Background that some people still need moves into a hover title instead of text on
the page. Examples: the teacher settings descriptions (the dotted-underlined setting
name), the weekly minute cap's PISA source, and "Kayıt ulaşmadı" in the activity
list.

The corner bands, dot grids and drawing are inline SVG (`GIRIS_SUSLER`,
`GIRIS_CIZIM`). They are coloured by the tokens, decorative only (`aria-hidden`), and
never placed over a control. The browser test checks that each control is the top
element at its own centre. While no role is chosen, the menu is empty and hidden,
and the start screen spans the full width (`.kabuk:has(>.ray:empty)`).

## Student navigation and home

Students get a top bar (`.ray.ust`). Teachers keep the side menu.

- **YKS Tekrar Defteri** (the brand) is a button that opens the home page (`'ana'`).
  For a teacher it opens Öğrenci takibi. On phones (≤480 px) it shortens to "YKS".
- **Planım ▾**: "Planım" opens the weekly plan. The arrow opens Haftalar haritası,
  Sonuç gir, Karnem and Geçmiş plan kurtar (`PLAN_ALT_SEKMELER`). Hovering opens it
  with a mouse (`@media (hover:hover)`), a click toggles it on touch screens, and it
  opens on keyboard focus. Esc or a click elsewhere closes it, and so does choosing
  a page. The group is highlighted while one of its pages is open.
- **Denemelerim** follows Planım. **Müfredat** and **Ayarlar** sit on the right.
  A thin divider separates them from "Kaydet ve çıkış yap", and the save status
  follows on one line (cut short with an ellipsis rather than wrapping).
- On narrow screens the bar wraps rather than scrolling sideways, so the dropdown is
  never clipped.

After login, students land on the home page (`gorunumAnaSayfa`, tab `'ana'`). It
shows the weeks map, and for a YKS student the **Deneme gelişimi** chart beside it.
Both headings are links: "Haftalar haritası" opens the map page (the map alone, also
in the Planım menu) and "Deneme gelişimi" opens Denemelerim. On hover or focus they
turn blue, are underlined and show "→".

- The two cards have equal widths and equal heights, with a clear gap between them
  (`clamp(32px, 3.2vw, 64px)`). The chart card has the map card's look (blue top
  edge). Both headings sit on one row.
- The week boxes are more compact here. The chart redraws to the card's free area
  (`denemeYolSigdir`), so it fills the card. Its drawing follows the measured width,
  with text scaled up to 1.35× on wide cards, so labels keep a steady size from phone
  to large monitor.
- Above the chart, a **TYT · AYT · Branş** control picks what is drawn. Branş adds a
  course list. Each choice has its own axis and target (see docs/mock-exams.md).
- At ≥1700 px the page widens to `min(1880px, 94vw)`, and the week boxes, their text
  and the headings grow.
- In a single column (≤1100 px) the chart moves above the map and keeps a 480:300
  shape.
