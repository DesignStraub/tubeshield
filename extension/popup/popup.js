(() => {
  'use strict';
  const DEFAULTS = { adblock: true, noAutoPause: true };
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

  async function init() {
    const values = await storageGet(DEFAULTS);
    for (const key of Object.keys(DEFAULTS)) {
      const box = document.getElementById(key);
      box.checked = values[key] !== false;
      box.addEventListener('change', async () => {
        try {
          await storageSet({ [key]: box.checked });
          if (key === 'adblock') await setRuleset(box.checked);
          status.textContent = 'Gespeichert. Ggf. Seite neu laden.';
        } catch (err) {
          status.textContent = 'Fehler: ' + (err && err.message ? err.message : err);
        }
      });
    }
  }

  init().catch((err) => {
    status.textContent = 'Fehler: ' + (err && err.message ? err.message : err);
  });
})();
