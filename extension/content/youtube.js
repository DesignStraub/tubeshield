/*
 * TubeShield – YouTube content script
 *  1. Video-Werbung: Skip-Button klicken, sonst stumm + vorspulen bis zum Ende.
 *  2. Banner-/Feed-Werbung: per CSS (youtube.css) versteckt.
 *  3. Auto-Pause ("Video pausiert. Weiterschauen?"): Dialog automatisch
 *     bestätigen und Video weiterlaufen lassen – aber NUR, wenn die Pause
 *     nicht vom Nutzer selbst kam.
 *  4. Optional: Startseiten-Vorschläge ausblenden (nur noch Suche).
 *  5. Optional: Shorts überall ausblenden (Startseite, Suche, Seitenleiste,
 *     Kanäle, Abos); direkte Shorts-Links öffnen als normales Video.
 */
(() => {
  'use strict';

  if (window.__tubeShieldLoaded) return;
  window.__tubeShieldLoaded = true;

  const DEFAULTS = { adblock: true, noAutoPause: true, hideHomeFeed: false, hideShorts: false };
  // Einstellung -> Attribut am <html>, an dem die CSS-Regeln hängen.
  const ROOT_FLAGS = {
    adblock: 'data-tubeshield-ads',
    hideHomeFeed: 'data-tubeshield-nohome',
    hideShorts: 'data-tubeshield-noshorts'
  };
  const settings = { ...DEFAULTS };

  // ---------- Einstellungen (Safari: `browser`, Fallback: `chrome`) ----------
  const ext = globalThis.browser || globalThis.chrome || null;

  function applySettings(values) {
    if (values && typeof values === 'object') {
      for (const key of Object.keys(DEFAULTS)) {
        if (typeof values[key] === 'boolean') settings[key] = values[key];
      }
    }
    const root = document.documentElement;
    if (root) {
      for (const [key, attr] of Object.entries(ROOT_FLAGS)) {
        if (settings[key]) root.setAttribute(attr, '');
        else root.removeAttribute(attr);
      }
      // Für page.js: Werbedaten nur entfernen, solange Ad-Blocking an ist.
      if (settings.adblock) root.removeAttribute('data-tubeshield-ads-off');
      else root.setAttribute('data-tubeshield-ads-off', '');
    }
    redirectShorts();
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

  // Das Popup fragt hier nach, ob TubeShield auf dem Tab läuft, und schickt
  // geänderte Schalter direkt mit (wirkt sofort, auch ohne storage.onChanged).
  try {
    ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'tubeshield-apply') applySettings(msg.values);
      if (msg.type === 'tubeshield-apply' || msg.type === 'tubeshield-status') {
        sendResponse({ ok: true, settings: { ...settings } });
      }
    });
  } catch (_) {
    /* ohne Messaging bleibt nur storage.onChanged */
  }

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
  let adState = null; // { saved: Map<video,{muted,rate}>, start, maxRate, seeked } solange eine Werbung läuft

  function msg(key, subs) {
    try { return (ext && ext.i18n && ext.i18n.getMessage(key, subs)) || ''; } catch (_) { return ''; }
  }

  // Hinweis statt schwarzem Bild, solange eine Werbung läuft. Die zweite
  // Zeile zeigt Restzeit und tatsächliche Geschwindigkeit – so sieht man,
  // ob YouTube das Vorspulen gerade zulässt.
  function adOverlay(player) {
    let el = player.querySelector(':scope > .tubeshield-ad-overlay');
    if (!el) {
      el = document.createElement('div');
      el.className = 'tubeshield-ad-overlay';
      const title = document.createElement('div');
      title.className = 'tubeshield-ad-title';
      title.textContent = msg('adOverlayTitle') || 'Skipping ad …';
      const detail = document.createElement('div');
      detail.className = 'tubeshield-ad-detail';
      el.append(title, detail);
      player.appendChild(el);
    }
    return el;
  }

  function updateOverlay(player, video) {
    const detail = adOverlay(player).querySelector('.tubeshield-ad-detail');
    const rate = video.playbackRate || 1;
    const d = video.duration;
    let text = '';
    if (Number.isFinite(d) && d > 0 && d <= MAX_AD_SEEK_DURATION) {
      const left = Math.max(0, Math.ceil((d - video.currentTime) / rate));
      text = msg('adOverlayRemaining', [String(left)]) || left + ' s';
    }
    const speed = Math.round(rate) + '×';
    detail.textContent = text ? text + ' · ' + speed : speed;
  }

  // YouTube spielt Werbung teils im Haupt-Video, teils in einem eigenen
  // <video>-Element ab. Deshalb werden während einer Werbung ALLE Videos im
  // Player behandelt und ihr Zustand pro Element gemerkt.
  function playerVideos(player) {
    const set = new Set(player.querySelectorAll('video'));
    for (const v of document.querySelectorAll('.html5-video-player video, .video-ads video')) set.add(v);
    return [...set];
  }

  function isShortAd(v) {
    const d = v.duration;
    return Number.isFinite(d) && d > 0 && d <= MAX_AD_SEEK_DURATION;
  }

  function handleVideoAds() {
    const player = getPlayer();
    if (!player) return;
    const adShowing =
      player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');

    if (adShowing && settings.adblock) {
      for (const btn of player.querySelectorAll(SKIP_SELECTORS)) {
        try { btn.click(); } catch (_) {}
      }
      const videos = playerVideos(player);
      if (!videos.length) return;
      if (!adState) {
        adState = { saved: new Map(), start: Date.now(), maxRate: 1, seeked: false };
        console.info('[TubeShield] Werbung erkannt', videos.map((v) => ({ duration: v.duration, time: v.currentTime, paused: v.paused })));
      }
      for (const v of videos) {
        if (!adState.saved.has(v)) adState.saved.set(v, { muted: v.muted, rate: v.playbackRate || 1 });
        v.muted = true;
        try { v.playbackRate = 16; } catch (_) {}
        adState.maxRate = Math.max(adState.maxRate, v.playbackRate || 1);
        // Nur bei separat geladenen Spots (kurze Dauer) ans Ende springen.
        // Ist die Werbung direkt ins Video eingebettet, entspricht die Dauer
        // dem ganzen Video – dann würde ein Sprung das Video selbst
        // überspringen. In dem Fall läuft die Werbung nur stumm mit 16x durch.
        if (isShortAd(v) && v.currentTime < v.duration - 0.3) {
          try { v.currentTime = v.duration - 0.1; adState.seeked = true; } catch (_) {}
        }
        // Ein pausiertes Haupt-Video neben einem Werbe-Video nicht starten.
        if (v.paused && (videos.length === 1 || isShortAd(v))) v.play().catch(() => {});
      }
      const shown = videos.find((v) => isShortAd(v) && !v.paused) || videos.find((v) => !v.paused) || videos[0];
      updateOverlay(player, shown);
    } else if (adState) {
      console.info('[TubeShield] Werbung vorbei', {
        seconds: Math.round((Date.now() - adState.start) / 100) / 10,
        videos: adState.saved.size,
        maxRate: adState.maxRate,
        seeked: adState.seeked
      });
      // Werbung vorbei -> Ton & Geschwindigkeit wiederherstellen
      for (const [v, st] of adState.saved) {
        if (!v.isConnected) continue;
        v.muted = st.muted;
        try { v.playbackRate = st.rate; } catch (_) {}
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

  // ---------- 4./5. Shorts ----------
  // Ausblenden passiert per CSS (youtube.css). Hier nur, was CSS nicht kann:
  //  - direkte Shorts-Links (/shorts/<id>) als normales Video öffnen,
  //  - den Filter-Chip "Shorts" in Suche/Startseite markieren (nur am Text erkennbar).
  function redirectShorts() {
    if (!settings.hideShorts) return;
    const m = location.pathname.match(/^\/shorts\/([\w-]{6,})/);
    if (m) location.replace('/watch?v=' + m[1]);
  }

  function markShortsChips() {
    if (!settings.hideShorts) return;
    for (const chip of document.querySelectorAll('yt-chip-cloud-chip-renderer:not([data-tubeshield-shorts])')) {
      if (chip.textContent.trim() === 'Shorts') chip.setAttribute('data-tubeshield-shorts', '');
    }
  }

  // ---------- Loop ----------
  setInterval(() => {
    try { handleVideoAds(); } catch (_) {}
    try { handleAutoPause(); } catch (_) {}
    try { handlePromos(); } catch (_) {}
    try { redirectShorts(); } catch (_) {}
    try { markShortsChips(); } catch (_) {}
  }, 250);
})();
