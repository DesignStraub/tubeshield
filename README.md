# TubeShield

**A lightweight, private ad blocker for Safari on Mac – with a YouTube ad blocker and protection against YouTube's automatic pause ("Video paused. Continue watching?").**

**[⬇ Download the latest version](https://github.com/DesignStraub/tubeshield/releases/latest)** · macOS 13 or later · Apple silicon and Intel

---

## Contents

- [Features](#features)
- [Privacy](#privacy)
- [Installation](#installation)
- [Check that it works](#check-that-it-works)
- [Updating the filter lists](#updating-the-filter-lists)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Limitations](#limitations)
- [License & credits](#license--credits)

---

## Features

| Area | What happens |
|---|---|
| **All websites** | About 93,000 network rules block ad and tracking servers before anything is loaded. The lists update themselves daily. |
| **YouTube: video ads** | "Skip" is clicked automatically. Otherwise the ad is muted and skipped, or played through at 16× speed. The picture, controls and yellow ad bars stay invisible meanwhile. Sound and speed are restored afterwards. |
| **YouTube: banners & feed** | Ad tiles on the home page, next to the video, in Shorts and in search are hidden. |
| **YouTube: Premium upsells** | Premium upsell dialogs and banners are hidden and closed via their own "No thanks" button – never via the buy button. |
| **YouTube: auto-pause** | The "Video paused. Continue watching?" dialog (and "Are you still there?" on YouTube Music) is confirmed automatically and the video keeps playing. |
| **YouTube: home page without recommendations** *(optional)* | The home page shows no feed – only search and the sidebar. You search for what you want instead of drifting through recommendations. |
| **YouTube: hide Shorts** *(optional)* | Shorts disappear from the home page, search (including the filter chip), the sidebar, channel pages and subscriptions. Direct Shorts links open as a regular video. |
| **Popup** | Five switches: *block ads*, *update filter lists automatically*, *prevent auto-pause* (all on) as well as *home page without recommendations* and *hide Shorts* (both off by default). The bottom line shows whether TubeShield is active on the current tab. The popup is available in English and German. |

**Safety net for the auto-pause block:** TubeShield only steps in if the video was paused *without* a click or key press from you. Other confirmation dialogs (e.g. "Remove from playlist?") are never confirmed automatically.

## Privacy

TubeShield **collects and sends no data**. There is no TubeShield server, no telemetry, no account.

- Safari itself does the blocking, based on fixed rules (`declarativeNetRequest`). The extension never sees which pages you visit.
- The YouTube script only runs on `youtube.com` and only changes the page in your browser.
- The only thing stored is the popup switches – locally in Safari.
- **The only connection the extension makes:** once a day it downloads the public filter list `filters.json` from GitHub (`raw.githubusercontent.com/DesignStraub/tubeshield/filter-updates/`). It is a plain download – TubeShield sends nothing along. Like any download, GitHub sees your IP address. You can turn this off in the popup (*Update filter lists automatically*); TubeShield then only uses the lists built into the app.

## Installation

Two options: **download the ready-made app** (quick, but with one catch in Safari) or **build it yourself** (set up Xcode once, then no catch).

### A) Download the app

1. Download `TubeShield-<version>.zip` from [Releases](https://github.com/DesignStraub/tubeshield/releases/latest), unzip it and move `TubeShield.app` to **Applications**.
2. The app is not notarized by Apple, so on first launch: **right-click → Open → Open**. If macOS still blocks it: System Settings → Privacy & Security → **Open Anyway**.
3. In Safari, turn on the developer features: Safari → Settings → Advanced → **Show features for web developers**.
4. Safari → Settings → Developer → enable **Allow unsigned extensions**.
5. Safari → Settings → Extensions → enable **TubeShield** and set access to **youtube.com** to "Always Allow".

> **The catch:** Safari turns "Allow unsigned extensions" off **every time Safari restarts** – then repeat step 4. Safari only trusts extensions without this switch if they come from the App Store or are signed with a paid Developer ID and notarized by Apple. If you don't want to repeat the step, build TubeShield yourself once (option B) – with a free Apple ID that works permanently on your own Mac.

### B) Build it yourself

#### Requirements

- A Mac with a current macOS and Safari
- **Xcode** (free on the App Store)
- An **Apple ID** (a free one is enough) – needed so that Safari keeps the extension permanently

#### One-time setup

1. **Install Xcode**, open it once and let it install the additional components. Then in Terminal:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
2. **Sign in to Xcode with your Apple ID:** Xcode → Settings → Accounts → **+** → Apple ID.
3. **Clone the repository:**
   ```bash
   git clone https://github.com/DesignStraub/tubeshield.git
   cd tubeshield
   ```
4. **Set your team ID.** The easiest way: open the project in Xcode (`xcode/TubeShield/TubeShield.xcodeproj`), choose your "Personal Team" for both targets under *Signing & Capabilities*, close Xcode and read the ID with
   ```bash
   grep -m1 DEVELOPMENT_TEAM xcode/TubeShield/TubeShield.xcodeproj/project.xcproj
   ```
   Then write the 10-character ID to a file `.team` in the project folder (it is not committed):
   ```bash
   echo "YOUR_TEAM_ID" > .team
   ```

#### Build & install

```bash
./scripts/build.sh
```

The script copies the files from `extension/` into the Xcode project, builds and signs the app, checks signature and contents and installs it to `/Applications/TubeShield.app`.

`./scripts/build.sh --release` instead builds the download version (ad-hoc signed, Apple silicon + Intel, macOS 13 or later) as a ZIP in `dist/`.

#### Enable in Safari

1. Safari → Settings → **Extensions** → enable **TubeShield**.
2. Set TubeShield's access to **youtube.com** to "Always Allow".
3. Reload open pages.

> After reinstalling, Safari may reset the access to youtube.com. The popup shows this ("Active on this tab" or a hint).

The app does **not** need to be running and needs **no login item** – it just has to be in Applications. Safari loads the extension on its own.

> **Without an Apple ID / team** the script builds an ad-hoc signed version. It only works with Safari → Settings → Developer → "Allow unsigned extensions", which Safari turns off again on every restart.

> **Certificate lifetime:** with a free account the development certificate is valid for one year. After that, simply run `./scripts/build.sh` again.

## Check that it works

- **General ad blocking:** open a public ad block test page, e.g. <https://d3ward.github.io/toolz/adblock>. It shows how many ad and tracking servers are blocked.
- **YouTube:** open a music video – no ads should be visible, and the video starts after at most a short black moment.

## Updating the filter lists

**Nothing to do – it happens automatically.** Every night the GitHub Action `.github/workflows/filters.yml` runs `tools/update-filters.py --update-file …` and publishes the result to the branch `filter-updates`. Installed copies download it once a day (`extension/background.js`), compare it with the rules built into the app and activate new rules as dynamic rules. Rules that were removed from the lists are switched off where Safari supports `updateStaticRules`.

The lists built into the app (`extension/rules/filters.json`) are only the starting point. To refresh them for a new release:

```bash
python3 tools/update-filters.py
./scripts/build.sh
```

Custom rules go into `tools/custom-rules.txt` (Adblock Plus syntax, e.g. `||ads.example^`).

## How it works

```
extension/
├── manifest.json          Safari Web Extension (Manifest V3)
├── background.js          daily filter list update
├── rules/custom.json      custom rules (from tools/custom-rules.txt)
├── rules/filters.json     ~93,000 rules from EasyList & co.
├── content/page.js        YouTube: removes ad data from the player response
├── content/youtube.js     YouTube: ad fallback, auto-pause, Premium dialogs, Shorts links
├── content/youtube.css    YouTube: hidden ad elements, home feed, Shorts
└── popup/                 popup with the switches
```

**Network blocking** – Safari evaluates the rules itself (`declarativeNetRequest`). Only simple, robust domain rules are used (`||domain^`, optionally with `$third-party` or resource types). Complex rules, path patterns and `$domain=` rules are deliberately skipped because they are the most likely to break pages. Top-level pages are never blocked, only embedded content. The rules are split into two rule sets: should Safari ever reject the big list, the basic protection from `custom.json` stays active.

**YouTube ads** – First, `content/page.js` runs in the page itself and removes the ad fields (`adPlacements`, `playerAds`, `adSlots`) from YouTube's player data before the player reads them, so most ads are never loaded. As a fallback, every 250 ms the script checks whether the player has the `ad-showing` class. Then it:
1. clicks skip buttons,
2. mutes and switches to 16× speed,
3. jumps to the end of separately loaded ads (≤ 3 minutes). Ads that YouTube embeds directly into the video stream are **not** skipped this way – otherwise the actual video would be skipped.

Via CSS, the picture and controls are invisible right away during ads, without a fade animation.

**Auto-pause** – The script remembers when the last *real* input (click, key, touch) happened. If the video is paused without input and YouTube's confirmation dialog appears, it clicks "Yes" and resumes playback.

**Home page & Shorts** – Each switch sets an attribute on the `<html>` element (`data-tubeshield-nohome`, `data-tubeshield-noshorts`). The rules in `youtube.css` only apply when it is set – that's why the switches take effect immediately. Shorts are recognised by their elements (`ytm-shorts-lockup-view-model`, `ytd-reel-shelf-renderer`, …) and by links to `/shorts/`; regular videos are left alone.

## Project structure

```
tubeshield/
├── extension/        extension source code (develop here)
├── xcode/            Xcode project: the Mac app that contains the extension
├── tools/            filter list converter and custom rules
├── .github/workflows/ nightly filter list update (filters.yml)
├── scripts/build.sh  build, sign, install
├── CHANGELOG.md
└── LICENSE           GPL-3.0
```

Always make changes in `extension/` – `scripts/build.sh` copies them into the Xcode project.

## Limitations

- **YouTube changes its pages regularly.** If something stops working, usually only selectors in `content/youtube.js` / `content/youtube.css` need to be updated.
- **Ads embedded in the stream** can't be removed, only muted and played through quickly.
- **On other websites** ad servers are blocked, but empty ad spaces are not hidden (no generic element rules – on purpose, to avoid breaking pages).
- **Safari on macOS** only (iOS would be possible with the Xcode project but isn't set up).

## License & credits

TubeShield is licensed under the **GNU General Public License v3.0** – see [LICENSE](LICENSE).

The rules in `extension/rules/filters.json` are generated from these lists:

- [EasyList](https://easylist.to/), [EasyPrivacy](https://easylist.to/) and [EasyList Germany](https://easylist.to/) – © The EasyList authors, licensed under GPLv3 and CC BY-SA 3.0 respectively.

Thanks to everyone who maintains these lists.
