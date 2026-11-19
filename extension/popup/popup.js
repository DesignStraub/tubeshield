(() => {
  'use strict';
  const DEFAULTS = { adblock: true, noAutoPause: true, hideHomeFeed: false, hideShorts: false };
  const usePromises = !!globalThis.browser;
  const ext = globalThis.browser || globalThis.chrome;
  const status = document.getElementById('status');

  function storageGet(defaults) {
    if (usePromises) return ext.storage.local.get(defaults);
    return new Promise((resolve) => ext.storage.local.get(defaults, resolve));
  }

  function storageSet(values) {
    if (usePromises) return ext.storage.local.set(values);
    return new Promise((resolve) => ext.storage.local.set(values, resolve));
  }

  function setRuleset(enabled) {
    const ids = ['custom', 'filters'];
    const opts = enabled ? { enableRulesetIds: ids } : { disableRulesetIds: ids };
    if (usePromises) return ext.declarativeNetRequest.updateEnabledRulesets(opts);
    return new Promise((resolve) => ext.declarativeNetRequest.updateEnabledRulesets(opts, resolve));
  }

  // ---------- Verbindung zum YouTube-Tab ----------
  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
  }

  async function activeTabId() {
    const query = { active: true, currentWindow: true };
    const tabs = usePromises
      ? await ext.tabs.query(query)
      : await new Promise((resolve) => ext.tabs.query(query, resolve));
    return tabs && tabs[0] ? tabs[0].id : null;
  }

  async function sendToTab(message) {
    try {
      const id = await activeTabId();
      if (id == null) return null;
      const reply = usePromises
        ? ext.tabs.sendMessage(id, message)
        : new Promise((resolve) => ext.tabs.sendMessage(id, message, (r) => resolve(chrome.runtime.lastError ? null : r)));
      return await withTimeout(Promise.resolve(reply).catch(() => null), 800);
    } catch (_) {
      return null;
    }
  }

  const YT_HINT = 'Die YouTube-Schalter wirken nur auf youtube.com. Läuft dort nichts: ' +
    'Safari → Einstellungen → Erweiterungen → TubeShield → youtube.com auf „Immer erlauben“.';

  async function showTabStatus() {
    const reply = await sendToTab({ type: 'tubeshield-status' });
    status.textContent = reply && reply.ok ? 'Aktiv auf diesem Tab.' : YT_HINT;
  }

  async function init() {
    const values = await storageGet(DEFAULTS);
    for (const key of Object.keys(DEFAULTS)) {
      const box = document.getElementById(key);
      box.checked = values[key] === true;
      box.addEventListener('change', async () => {
        try {
          await storageSet({ [key]: box.checked });
          if (key === 'adblock') await setRuleset(box.checked);
          const reply = await sendToTab({ type: 'tubeshield-apply', values: { [key]: box.checked } });
          status.textContent = reply && reply.ok ? 'Gespeichert – auf diesem Tab schon aktiv.' : 'Gespeichert. ' + YT_HINT;
        } catch (err) {
          status.textContent = 'Fehler: ' + (err && err.message ? err.message : err);
        }
      });
    }
    showTabStatus();
  }

  init().catch((err) => {
    status.textContent = 'Fehler: ' + (err && err.message ? err.message : err);
  });
})();
