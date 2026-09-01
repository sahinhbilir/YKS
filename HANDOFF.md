# YKS Tekrar Defteri — Handoff

## What this is
Android app (WebView wrapper) for spaced-repetition study planning (FSRS-6) for YKS exam prep. Used by a teacher (rehber) for a whole class, and self-service by individual students. The whole app is **one file**: `index.html` in this folder (`C:\Claude Project\index.html`) — HTML/CSS/JS, zero dependencies, zero build tooling, fully offline. Edit that file directly; there is no compile step for the web layer.

That file is the **source of truth**. It gets copied verbatim into the separate Android wrapper project at `C:\Users\sahin\Downloads\YKS_Tekrar_Defteri_android_1\app\src\main\assets\index.html` before every build — never edit the copy inside the Android project directly, always edit here and re-copy.

**Both folders are git repos now** (`C:\Claude Project` and the Android project). `git log` in each is the authoritative, detailed history of every fix — this document is a summary of things *not* obvious from the log (methodology, gotchas, open risks), not a replacement for it.

User: sahin.bilir@sinav.k12.tr (school email) / sahinh.bilir@gmail.com (git commit identity, set locally per-repo), a teacher building this for eventual distribution to many schools. Tests on a real physical Android device (serial `R52R504R1QR`) and gives direct, dense, detailed feedback (Turkish/English mix, sometimes frustrated when a fix doesn't hold up) — read every sentence of a long message, don't drop items.

## The single most important lesson from this session

**A fix "verified" only against a synthetic sandbox scenario is not verified.** Two significant fixes this session were built and confidently shipped after only synthetic sandbox testing, and both had real bugs that synthetic testing missed:
- A type mismatch (`o.cikti` is a plain day-number everywhere in this codebase, never an ISO string — a fix that assumed otherwise crashed on real data, but "worked" in a test that used the same wrong assumption).
- A scheduling regression (an "enrollment date" gate that, tested only against a hand-picked scenario, would have hidden months of real history for any actively-used student).

Both were caught and fixed, but only because of a third case: the user reported a bug that no synthetic scenario had covered, and the eventual fix for *that* was built by **loading the user's real exported backup JSON (Ayarlar → Yedek indir) into the sandbox and replaying the app's actual functions against real data** — not guessing, not constructing another synthetic case. That JSON-in-`localStorage` technique (see Testing section below) is the correct default whenever a real bug report exists; only fall back to synthetic sandbox data for genuinely new features with no real data yet.

## Data model (in `D`, persisted to localStorage as `yks_veri`)
- `D.ogr[]` — students, index = `si`. `o.cikti` = day-number of the most recent printed plan (advances every print). `o.ilkAktif` = day-number of *first* activation, set once, never moves — use this for "how long has this student been active," never `cikti`.
- `D.kart` — FSRS review cards, keyed `"si:ki"`
- `D.elle["si|hb"]` — per-student per-week manual overrides (`yer`=pinned placement, `ek`/`sil`=add/remove, `anlatim`=pending lecture entries, `serbest`=free items, `soru`=frozen question counts)
- `D.subeIslenis[sube]` / `D.ogrIslenis[si]` / `D.islenis` — "taught date" records at class/student/global level (checked in that priority order)
- `D.konuPlani[sube]` — array of week-objects `{dersAdı: [topicNames]}`, the curriculum content. Length varies per class; `planHaftaSayisi(sube)` = its length, `planHaftasi(sube,hb)` clamps a calendar week onto `[1, that length]`.
- `D.dersProgrami` / `D.programHafta[sube][hb]` — class timetables
- `D.ayar` — settings (`donemBasi` = term start, must always be Monday-aligned; `sinav` = exam date; `ilk` = days to first test; `kap` = per-student daily test capacity; `telafiGunKap` = per-student/global max "konu anlatımı" catch-up entries per day)
- `D.haftaDurum["si|hb"]` — which weeks have been marked via Haftalar Haritası and why

Key functions: `planHesapla(si, hb)` computes a week's plan (candidates → capacity-aware placement, due-date ordered, with *separate* capacity lanes for regular tests vs. "konu anlatımı" catch-up entries — see below); `haftaNo(hb)` maps a calendar week to a plan-week number relative to `donemBasi`; `dondur(si,hb,p)` freezes a week's current computed layout into `ov.yer` (pins it); `programUygula`/`ileriDagit`/`programDegistiTetikle` auto-fill future weeks' curriculum assignments — all three now anchor via `ileriDagitBaslangic()` (never earlier than `donemBasi`'s week — see Known fixes).

## Known fixes this session (context for judgment, not a todo list — see `git log` for full detail)
- **Dead code removal** (~350 lines): three zero-caller functions, a superseded curriculum-textarea editor, an entire abandoned coordinate-based PDF schedule parser (the app moved to an AI-paste-JSON import flow and never deleted the old parser).
- **Haftalar Haritası false positives, two rounds**: (1) weeks before a student's real enrollment were wrongly flagged "skipped" — fixed using `o.ilkAktif`, *not* `o.cikti` (a first attempt used `cikti` and both crashed on real data and would have hidden history for actively-used students — see lesson above). (2) Weeks where nothing was ever printed on paper were also wrongly flagged "skipped" even though the app had already auto-resolved them — fixed by checking `o.cikti >= hb` (the same signal `sonucBekliyor()` already uses internally for this exact question) before flagging.
- **Telafi (catch-up) scheduling landing weeks/months in the future**: root cause was `planHesapla`'s placement loop never re-sorting `ogeler` by due-date after appending catch-up items (so they got processed *last* despite having the earliest due date, forced to start searching from wherever regular items had already pushed a shared "don't go backward" cursor), plus catch-up items sharing the *same* capacity budget as regular tests. Fixed by sorting before placement and giving "konu anlatımı" its own capacity lane (`anlatimSiniriGun`, independently configurable via `D.ayar.telafiGunKap` / `D.ogr[si].telafiGunKap`) with its own monotonic cursor.
- **Silent multi-week content blackout at term start**: `programDegistiTetikle`/`ileriDagit`/backup-restore all anchored the fill-ahead loop at `buHafta()` (today), not `donemBasi`. When a schedule gets entered before the term's own start date, multiple calendar weeks clamp onto the same plan-week-1 index via `planHaftasi()`, and `programUygula`'s intentional one-time-only topic assignment means only the first of those colliding weeks gets content — every week after it, up to `donemBasi`, silently gets nothing. Fixed with `ileriDagitBaslangic()` = `max(buHafta(), donemBasi's week)`, used at all three fill-trigger call sites.

## Known risk, NOT yet fixed — flagged during the blackout investigation
`donemHizala()` (runs once per app boot inside `durumuYukle()`) silently resets `D.ayar.donemBasi` to "today" if `haftaNo(today)` falls outside `[1, planHaftaSayisi]` for the longest-running class — which is *always true* for a student whose term hasn't started yet (any reboot before reaching `donemBasi`'s week resets it). This only did *not* corrupt the real backup investigated this session because the user did setup + schedule-paste + export all in one sitting without ever closing the app (so `durumuYukle`/`donemHizala` only ran once, before `donemBasi` was even meaningfully "in the past"). **If a student/teacher sets up a future-dated term and then closes and reopens the app before that date arrives, this would silently move their term start to today and could reproduce a similar (or worse) blackout.** Not reproduced with real data yet — worth watching for, and probably the next thing to investigate if a similar report comes in.

## Bug classes found and fixed in earlier sessions (still true, still worth knowing)
- `haftaNo()` needs its reference date Monday-aligned — always snap via `pazartesi()`.
- `planHesapla`'s placement is a **sequential, mostly-non-backtracking greedy pass** — a day filling up doesn't let later-due items backfill earlier gaps *within the same capacity lane*. (Regular tests and "konu anlatımı" now have independent lanes/cursors, per the fix above, but within one lane the old caveat still holds.) Any feature that bulk-moves a week's worth of items must place them against actual remaining capacity, never as a flat date shift.
- `dondur()` freezes a *whole week* the moment it's called — batch all writes first, freeze affected weeks once at the end, not per-item in a loop.

## Testing environment
No Node.js or Python on this Windows dev machine. The method, used successfully throughout:
1. A PowerShell static file server already exists at `C:\Claude Project\staticserver.ps1` (serves this folder on `-Port`). Start it: `Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','"C:\Claude Project\staticserver.ps1"','-Port','8791' -WindowStyle Hidden`, then verify with a curl/`Invoke-WebRequest` to `http://127.0.0.1:8791/index.html`.
2. Open the Claude Browser pane, navigate to that URL.
3. **For a real bug report**: get the user's exported backup JSON (Ayarlar → Yedek indir), then in `javascript_exec`: `localStorage.setItem('yks_veri', <json string>)` and reload, OR directly `D = <parsed json>; kaydet(true); ciz();` in the current session — this reproduces their exact real state. Prefer this over constructing a synthetic scenario whenever real data is available.
4. Use `javascript_exec` to poke `D`/`EK` state and call internal functions directly (`planHesapla`, `haftayiTelafiEt`, etc.) to verify behavior before touching the real build. Always run a full 9-view render sweep (loop `EK.sekme` through all tabs, call `ciz()`, check `innerHTML.length` and no thrown errors) before committing — note `ogrenciMi()` restricts students to a 6-tab subset, don't treat the other 3 falling back to "plan" as an error.
5. Check `read_console_messages` — a stray favicon 404 is normal/harmless.
6. **Never ship a change without this verification** — this codebase has no other safety net.

Caveat: the Claude Browser pane sometimes auto-opens a second `file://` tab after an edit — a *different* tab from your sandbox server tab. If a test gives a suspicious result, check `tabs_context` and pass `tabId` explicitly.

## Build & install
```bash
cd "C:\Users\sahin\Downloads\YKS_Tekrar_Defteri_android_1"
JAVA_HOME="C:\Users\sahin\.jdks\jbr-21.0.11" ./gradlew.bat assembleDebug
```
Must use JDK 21 (`jbr-21.0.11`), **not** the JDK 25 bundled with Android Studio — it breaks Gradle 8.9/AGP 8.7.3. Remember to `cp` the source `index.html` into `app/src/main/assets/index.html` and bump `versionCode`/`versionName` in `app/build.gradle` before building.

Install/launch (adb isn't on PATH in the Bash tool — use PowerShell with the full SDK path; check `adb devices` first, the phone connects/disconnects and sometimes needs re-authorizing on the device screen after an adb daemon restart):
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s R52R504R1QR install -r "app\build\outputs\apk\debug\app-debug.apk"
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s R52R504R1QR shell am start -n tr.k12.sinav.yksdefter.deneme/tr.k12.sinav.yksdefter.MainActivity
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s R52R504R1QR logcat -d -t 200 | Select-String -Pattern "AndroidRuntime|FATAL"
```
Always check logcat for `FATAL`/`AndroidRuntime` after install+launch — confirms no crash before telling the user it's ready.

## Git
Both `C:\Claude Project` and the Android project are git repos with real history — read `git log` in each before assuming anything about "current state." Commit identity is set *locally per-repo* (not global): `Şahin Bilir` / `sahinh.bilir@gmail.com`. Commit style: one logical fix per commit, message explains root cause + how it was verified (see any commit this session for the pattern) — this matters a lot to this user given the trust issues around unverified fixes.

## Working style notes
- Messages are often long and dense with many distinct asks (Turkish, sometimes rough English) — parse every sentence, don't silently drop items.
- Wants changes **actually verified working**, not "should work" — has explicitly pushed back on guessed fixes and on synthetic-only testing when a real bug report was available. When a real user backup exists, use it.
- Prefer investigating root cause over patching symptoms — several bugs this session turned out to be one shared mechanism (calendar-week-to-plan-week clamping colliding with one-time-only assignment) wearing different disguises at different boundaries (enrollment date, print date, term start, term end).
- Open/deferred (not yet acted on, needs the user's decision): `gorunumProgram()` (the weekly class-timetable editor) has no tab of its own, only reachable by scrolling down inside Ayarlar — flagged as a possible navigation/IA cleanup, explicitly left alone pending the user's call since it's a UX judgment, not a bug.
