/*
 * TubeShield – YouTube page script (runs in the page's own JavaScript world).
 *
 * YouTube tells its player where ads go via fields in the player response
 * (adPlacements, playerAds, adSlots). This script removes those fields before
 * the player reads them, so ads are not loaded at all – there is nothing to
 * skip and no black wait. It covers the three ways the data arrives:
 *   - window.ytInitialPlayerResponse (first page load),
 *   - JSON.parse (responses YouTube parses itself),
 *   - Response.json() (fetch of /youtubei/v1/player, /next, …).
 *
 * Ads that YouTube stitches directly into the video stream can't be removed
 * this way; youtube.js still mutes and speeds those up as a fallback.
 *
 * The content script sets html[data-tubeshield-ads-off] when the user turns
 * ad blocking off – then this script changes nothing.
 */
(() => {
  'use strict';

  if (window.__tubeShieldPage) return;
  window.__tubeShieldPage = true;

  const AD_KEYS = ['adPlacements', 'playerAds', 'adSlots'];
  let pruned = 0;

  function enabled() {
    const root = document.documentElement;
    return !(root && root.hasAttribute('data-tubeshield-ads-off'));
  }

  function stripAds(obj) {
    let hit = false;
    for (const key of AD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        delete obj[key];
        hit = true;
      }
    }
    return hit;
  }

  // Looks only at the top level, .playerResponse and short arrays of page
  // parts (YouTube's navigation responses) – cheap enough for every parse.
  function prune(value, depth) {
    if (!value || typeof value !== 'object' || depth > 2) return value;
    if (Array.isArray(value)) {
      if (value.length <= 8) for (const item of value) prune(item, depth + 1);
      return value;
    }
    let hit = stripAds(value);
    if (value.playerResponse && typeof value.playerResponse === 'object') {
      hit = stripAds(value.playerResponse) || hit;
    }
    if (hit) {
      pruned++;
      if (document.documentElement) document.documentElement.setAttribute('data-tubeshield-pruned', String(pruned));
    }
    return value;
  }

  function safePrune(value) {
    if (!enabled()) return value;
    try { return prune(value, 0); } catch (_) { return value; }
  }

  // 1. First page load: `var ytInitialPlayerResponse = {…}` in an inline script.
  try {
    let initial;
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      get() { return initial; },
      set(v) { initial = safePrune(v); }
    });
  } catch (_) { /* already defined – the other hooks still apply */ }

  // 2. JSON.parse
  const origParse = JSON.parse;
  JSON.parse = function parse(text, reviver) {
    const result = origParse.call(this, text, reviver);
    if (typeof text === 'string' && text.length > 200 &&
        (text.includes('"adPlacements"') || text.includes('"playerAds"') || text.includes('"adSlots"'))) {
      return safePrune(result);
    }
    return result;
  };

  // 3. fetch(...).then(r => r.json())
  const origJson = Response.prototype.json;
  Response.prototype.json = function json() {
    return origJson.call(this).then((data) => {
      if (/\/youtubei\/v1\/(player|next|browse|search|reel)/.test(this.url || '')) return safePrune(data);
      return data;
    });
  };
})();
