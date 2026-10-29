# Reading files with AI (Gemini)

The site's own parsers read the school's PDFs by text position, so they only know the school's layouts. Everything else is now read by **Gemini** through **Firebase AI Logic** (Gemini Developer API, no-cost tier, project `yks-tekrar-manual-test`): result lists from other publishers, photos and scans, Excel and CSV files, and photos or PDFs of timetables and paper plans.

AI reading appears only when the Firebase module is loaded and configured (`window.bulut.yapayZeka`). Without it, every page works as before: school PDFs only, plus the copy-and-paste AI path.

## Where it is used

| Page | Control | What happens |
| --- | --- | --- |
| Denemeler, Deneme panosu | **Dosyadan toplu aktar** (was *PDF’den toplu aktar*) | A school PDF is read by position as before. If its layout is not the school's, or the file is a photo, Excel or CSV file, Gemini reads it. The rows go to the usual **Aktarmadan önce kontrol et** preview. |
| Sıralamalar, Deneme panosu | **PDF ekle** | Same fallback. This path saves without a preview, so an AI list is saved only when the file confirms every row (see below). |
| Ayarlar → Ders programı | **Fotoğraf / PDF’ten oku** in *Programı AI ile aktar* | Gemini reads the timetable with the existing prompt. The answer is written into the paste box, with a preview table under it, and is used only after **Bu programı kullan**. The box can still be corrected by hand; the preview follows the edit. |
| Geçmiş plan kurtar | **Yapay zekâ ile oku** | Sends the opened photo with the existing plan prompt and fills the AI output box. The review, preview and confirmation steps are unchanged. Opening a photo sends nothing. |

Accepted files: PDF, JPG, PNG, WebP, HEIC/HEIF, `.xlsx`, CSV/TSV, up to 14 MB. Old `.xls` files must be saved as `.xlsx` or CSV first. Spreadsheets are converted to tab-separated text in the browser (no library) and sent as text.

## What is sent

Only the chosen file and fixed instructions. No notebook data, roster, names or settings are added. The instructions tell the model that text inside the file is data, not instructions.

## Checks on deneme results

The model returns D/Y for each lesson, using the site's lesson codes, and copies the total net printed in the file (`tytNet`, `aytNet`). It does not compute the total itself. `YZ.denemeRaporu` then:

- drops a row whose D/Y is unreadable or exceeds the lesson's or test's question count, and lists it in the preview;
- skips a session that is 0/0 in every lesson (not taken);
- **pre-selects a row only when its D/Y add up to the printed total net** (±0.01). Rows that do not match, or have no printed total, show the reason and wait for the teacher's tick;
- uses today's date when no exam date can be read, and says so in the preview;
- matches students by number and name as before. A file without school numbers matches by a name only one student has, and says so;
- builds the Sıralamalar list only when every row has a school number and a confirmed total.

The preview shows **Yapay zekâ ile okundu · değerleri dosyayla karşılaştırın** and the list of notes above the table.

Lists that give only test totals (for example *Sosyal Bilimler* or *Fen Bilimleri* with no lesson split) cannot be stored, because results are kept per lesson. The model reports this in its note. Konu Takibi (per-question answers) is not read by AI.

## Models and limits

`YZ_MODELLER` in the Firebase module lists the models in order: `gemini-3.5-flash`, then `gemini-3.5-flash-lite`. On 29 October 2026 the newer `gemini-3.7-flash` and `gemini-3.8-flash` took 110–150 s or more for a one-line request on the no-cost tier, while `gemini-3.5-flash` answered in about 3 s. The second model has its own quota. It takes over when the first is out of quota (429), busy (5xx), missing (404), times out or returns nothing.

The request uses `temperature: 0`, `responseMimeType: application/json` and a JSON Schema (`responseJsonSchema`). A test with a synthetic 8-student photo returned every D/Y, net and score correctly in 25 s with `gemini-3.5-flash`. `gemini-3.5-flash-lite` swapped two D/Y pairs; the printed-total check caught that row.

No-cost tier quotas are per project and per model, and are shown in Google AI Studio. A quota error reads *Ücretsiz yapay zekâ kotası şu an dolu…*. Very long files can hit the output limit (*Dosya bir defada okunamayacak kadar uzun…*); split them by class.

## Console setup

- Firebase console → AI Logic: **Gemini Developer API** enabled (done).
- AI Logic → *All apps*: App Check is registered but **not enforced**. The site already sends reCAPTCHA Enterprise App Check tokens with every request, so enforcing it after this change is deployed blocks calls from anywhere else.
- AI monitoring is on. It records requests in the console.

## Terms to keep in mind

On the no-cost tier, Google may use prompts and answers to improve its products, and human reviewers may read them. Its terms say not to send personal information there. The Gemini API terms and Google Cloud's generative AI terms also exclude services directed at, or likely to be used by, people under 18. With real student data or student users, check this first; the paid tier (Blaze billing) does not use prompts for training.

## Code and tests

- `src/yapayzeka.js`, `src/yapayzeka.css`, embedded by `scripts/embed-yapayzeka.cjs`: request parts, `.xlsx` reading, prompts and schemas, the checks above, the timetable box handlers.
- Firebase module in `index.html`: `yapayZeka({parcalar, sema, zamanAsimi, dusunme})`, model order and error messages.
- `test/yapayzeka-regression.cjs` (Node) and `test/yapayzeka-browser.cjs` (Playwright, desktop and phone) use a stub model; nothing leaves the test.
