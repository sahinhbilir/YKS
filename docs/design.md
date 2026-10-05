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
3. The student login, open by default.
4. Under the login button, "Rehber öğretmeniyim" and "Test hesabı aç".
5. The cap-and-books drawing.
6. One folded "Yedekten geri yükle" link. It opens the file picker and the paste
   option.

The screen carries no hint sentences. The status line under "Giriş yap" stays empty
until there is an error or progress message.

The corner bands, dot grids and drawing are inline SVG (`GIRIS_SUSLER`,
`GIRIS_CIZIM`). They are coloured by the tokens, decorative only (`aria-hidden`), and
never placed over a control. The browser test checks that each control is the top
element at its own centre. While no role is chosen, the menu is empty and hidden,
and the start screen spans the full width (`.kabuk:has(>.ray:empty)`).
