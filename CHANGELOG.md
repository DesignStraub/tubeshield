# Changelog

## 1.3.2 – 2026-11-19
- The popup and the extension description are now available in **English and German**, following Safari's language (English for all other languages).

## 1.3.1 – 2026-11-19
- Hide Shorts: the "Shorts" entry now also disappears from the collapsed sidebar.
- First downloadable build on GitHub Releases (ad-hoc signed, Apple silicon + Intel, macOS 13 or later). New option `./scripts/build.sh --release`; the app version now comes from `manifest.json`.

## 1.3.0 – 2026-11-19
- New switch **Home page without recommendations:** the YouTube home page no longer shows a feed, only search and the sidebar.
- New switch **Hide Shorts:** Shorts disappear from the home page, search results (including the "Shorts" filter chip), the sidebar, channel pages ("Shorts" tab) and subscriptions. Direct Shorts links open as a regular video.
- Both switches are off by default and take effect immediately, without reloading.
- The popup shows at the bottom whether TubeShield is active on the current tab – and if not, where to allow access to youtube.com in Safari. Changed switches are sent straight to the open tab.

## 1.2.0 – 2026-11-18
- **All websites:** about 93,000 rules from EasyList, EasyPrivacy and EasyList Germany (previously 47).
- Rules split into two rule sets (`custom` + `filters`) so that the basic protection stays active even if Safari rejects the big list.
- New tool `tools/update-filters.py` for updating the lists.
- New build script `scripts/build.sh` (sync, build, sign, verify, install).

## 1.1.1 – 2026-11-18
- YouTube: the yellow ad progress bar, the controls and the ad markers in the timeline are hidden during ads – without a fade animation.

## 1.1.0 – 2026-11-18
- YouTube: for ads embedded directly in the video stream, TubeShield no longer jumps to the end (that would have skipped the actual video). Instead: muted + 16× speed.
- YouTube: the ad picture is invisible right away, not only after the next check cycle.
- YouTube: Premium upsell dialogs are detected (correct element names `yt-upsell-dialog-renderer`, `yt-mealbar-promo-renderer`), hidden and closed via "No thanks".

## 1.0.0 – 2026-11-18
- First version: network blocking, skipping YouTube ads, auto-pause block, popup with switches.
