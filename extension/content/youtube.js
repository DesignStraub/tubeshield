/*
 * TubeShield – YouTube content script
 *  1. Video-Werbung: Skip-Button klicken, sonst stumm + vorspulen bis zum Ende.
 *  2. Banner-/Feed-Werbung: per CSS (youtube.css) versteckt.
 *  3. Auto-Pause ("Video pausiert. Weiterschauen?"): Dialog automatisch
 *     bestätigen und Video weiterlaufen lassen – aber NUR, wenn die Pause
 *     nicht vom Nutzer selbst kam.
 */
(() => {
  'use strict';

  if (window.__tubeShieldLoaded) return;
  window.__tubeShieldLoaded = true;

  const DEFAULTS = { adblock: true, noAutoPause: true };
  const settings = { ...DEFAULTS };

  // ---------- Einstellungen (Safari: `browser`, Fallback: `chrome`) ----------
  const ext = globalThis.browser || globalThis.chrome || null;

  function applySettings(values) {
    if (values && typeof values === 'object') {
      if (typeof values.adblock === 'boolean') settings.adblock = values.adblock;
      if (typeof values.noAutoPause === 'boolean') settings.noAutoPause = values.noAutoPause;
    }
    const root = document.documentElement;
    if (root) {
      if (settings.adblock) root.setAttribute('data-tubeshield-ads', '');
      else root.removeAttribute('data-tubeshield-ads');
    }
  }

  function loadSettings() {
    try {
      if (!ext || !ext.storage || !ext.storage.local) return;
      if (globalThis.browser) {
        globalThis.browser.storage.local.get(DEFAULTS).then(applySettings, () => {});
      } else {
        globalThis.chrome.storage.local.get(DEFAULTS, applySettings);
      }
      ext.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const next = {};
        for (const key of Object.keys(DEFAULTS)) {
          if (changes[key]) next[key] = changes[key].newValue;
        }
        applySettings(next);
      });
    } catch (_) {
      /* Defaults bleiben aktiv */
    }
  }

  applySettings(null);
  loadSettings();

  // ---------- Helfer ----------
  function getPlayer() {
    return document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  }

  function getVideo() {
    const player = getPlayer();
    return (
      (player && (player.querySelector('video.html5-main-video') || player.querySelector('video'))) ||
      document.querySelector('video')
    );
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return el.getClientRects().length > 0;
  }

  // ---------- 1. Video-Werbung ----------
  const SKIP_SELECTORS = [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-slot button',
    'button[id^="skip-button"]'
  ].join(',');

  const MAX_AD_SEEK_DURATION = 180; // Sekunden
  let adState = null; // { muted, rate } solange wir eine Werbung manipulieren

  function handleVideoAds() {
    const player = getPlayer();
    if (!player) return;
    const video = getVideo();
    const adShowing =
      player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');

    if (adShowing && settings.adblock) {
      for (const btn of player.querySelectorAll(SKIP_SELECTORS)) {
        try { btn.click(); } catch (_) {}
      }
      if (video) {
        if (!adState) adState = { muted: video.muted, rate: video.playbackRate || 1 };
        video.muted = true;
        try { video.playbackRate = 16; } catch (_) {}
        // Nur bei separat geladenen Spots (kurze Dauer) ans Ende springen.
        // Ist die Werbung direkt ins Video eingebettet, entspricht die Dauer
        // dem ganzen Video – dann würde ein Sprung das Video selbst
        // überspringen. In dem Fall läuft die Werbung nur stumm mit 16x durch.
        const d = video.duration;
        if (Number.isFinite(d) && d > 0 && d <= MAX_AD_SEEK_DURATION && video.currentTime < d - 0.3) {
          try { video.currentTime = d - 0.1; } catch (_) {}
        }
        if (video.paused) video.play().catch(() => {});
      }
    } else if (adState) {
      // Werbung vorbei -> Ton & Geschwindigkeit wiederherstellen
      if (video) {
        video.muted = adState.muted;
        try { video.playbackRate = adState.rate; } catch (_) {}
      }
      adState = null;
    }
  }

  // ---------- 2. Auto-Pause verhindern ----------
  // Zeitpunkt der letzten ECHTEN Nutzereingabe (isTrusted).
  let lastUserInput = 0;
  for (const type of ['pointerdown', 'mousedown', 'keydown', 'touchstart']) {
    window.addEventListener(
      type,
      (e) => { if (e.isTrusted) lastUserInput = Date.now(); },
      { capture: true, passive: true }
    );
  }

  // Wurde das Video ohne Nutzeraktion pausiert? (-> YouTube-Auto-Pause)
  let pausedWithoutUser = false;
  document.addEventListener(
    'pause',
    (e) => {
      if (!(e.target instanceof HTMLVideoElement)) return;
      const player = getPlayer();
      const isAd = player && player.classList.contains('ad-showing');
      pausedWithoutUser = !isAd && Date.now() - lastUserInput > 1500;
    },
    true
  );
  document.addEventListener(
    'play',
    (e) => { if (e.target instanceof HTMLVideoElement) pausedWithoutUser = false; },
    true
  );

  function findStillWatchingButton() {
    // YouTube (Desktop): yt-confirm-dialog-renderer im Popup-Container
    const dialogs = document.querySelectorAll(
      'ytd-popup-container tp-yt-paper-dialog, ytd-popup-container yt-confirm-dialog-renderer'
    );
    for (const dlg of dialogs) {
      if (!isVisible(dlg)) continue;
      const confirm = dlg.querySelector('yt-confirm-dialog-renderer') ? dlg : (dlg.matches('yt-confirm-dialog-renderer') ? dlg : null);
      if (!confirm) continue;
      const btn =
        confirm.querySelector('#confirm-button button') ||
        confirm.querySelector('#confirm-button tp-yt-paper-button') ||
        confirm.querySelector('#confirm-button');
      if (btn) return btn;
    }
    // YouTube Music: "Bist du noch da?"
    const music = document.querySelector('ytmusic-you-there-renderer');
    if (music && isVisible(music)) {
      return music.querySelector('button') || music.querySelector('.yt-button-renderer');
    }
    return null;
  }

  let lastResume = 0;
  function handleAutoPause() {
    if (!settings.noAutoPause) return;
    const video = getVideo();
    if (!video || video.ended) return;
    // Nur eingreifen, wenn das Video OHNE Nutzeraktion angehalten wurde
    // (schützt andere Bestätigungsdialoge wie "Aus Playlist entfernen?").
    if (!video.paused || !pausedWithoutUser) return;
    if (Date.now() - lastUserInput < 1500) return;
    if (Date.now() - lastResume < 1000) return;

    const btn = findStillWatchingButton();
    if (!btn) return;

    lastResume = Date.now();
    try { btn.click(); } catch (_) {}
    setTimeout(() => {
      const v = getVideo();
      if (v && v.paused && !v.ended) v.play().catch(() => {});
    }, 250);
  }

  // ---------- 3. YouTube-Premium-Werbedialoge ----------
  // Wird per CSS versteckt; zusätzlich wird – falls vorhanden – der
  // "Nein danke"-Knopf (#dismiss-button) geklickt, nie der Kaufen-Knopf.
  const PROMO_SELECTORS = [
    'yt-upsell-dialog-renderer',
    'yt-mealbar-promo-renderer',
    'ytd-mealbar-promo-renderer'
  ].join(',');

  let lastPromoDismiss = 0;
  function handlePromos() {
    if (!settings.adblock) return;
    if (Date.now() - lastPromoDismiss < 1000) return;
    for (const promo of document.querySelectorAll(PROMO_SELECTORS)) {
      const host = promo.closest('tp-yt-paper-dialog') || promo;
      // Versteckt per CSS -> isVisible() hilft nicht; "geöffnet" erkennen wir
      // daran, dass YouTube den Dialog nicht selbst ausgeblendet hat.
      if (host.getAttribute('aria-hidden') === 'true' || host.style.display === 'none') continue;
      const dismiss =
        promo.querySelector('#dismiss-button button') ||
        promo.querySelector('#dismiss-button tp-yt-paper-button') ||
        promo.querySelector('#dismiss-button');
      if (dismiss) {
        lastPromoDismiss = Date.now();
        try { dismiss.click(); } catch (_) {}
      }
    }
  }

  // ---------- Loop ----------
  setInterval(() => {
    try { handleVideoAds(); } catch (_) {}
    try { handleAutoPause(); } catch (_) {}
    try { handlePromos(); } catch (_) {}
  }, 250);
})();
