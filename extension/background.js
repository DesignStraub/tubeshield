/*
 * TubeShield – automatische Aktualisierung der Filterlisten.
 *
 * Die Erweiterung bringt ihre Regeln fest mit (rules/filters.json). Damit sie
 * aktuell bleiben, ohne dass man TubeShield neu installieren muss, lädt dieses
 * Skript einmal am Tag die öffentliche Update-Datei von GitHub (erzeugt jede
 * Nacht von .github/workflows/filters.yml aus EasyList & Co.) und vergleicht
 * sie mit den eingebauten Regeln:
 *
 *   - neue Regeln   -> als dynamische Regeln zusätzlich aktiviert
 *   - entfernte     -> eingebaute Regel abgeschaltet (wenn Safari das kann)
 *
 * Es wird nur diese eine Datei abgerufen; TubeShield schickt dabei keine
 * eigenen Daten mit. Abschaltbar im Popup („Filterlisten automatisch
 * aktualisieren“).
 */
(() => {
  'use strict';

  const ext = globalThis.browser || globalThis.chrome;
  const dnr = ext.declarativeNetRequest;
  const UPDATE_URL = 'https://raw.githubusercontent.com/DesignStraub/tubeshield/filter-updates/filters.json';
  const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;
  const ALARM = 'tubeshield-filters';
  const ALL_TYPES = ['sub_frame', 'stylesheet', 'script', 'image', 'font',
    'xmlhttprequest', 'ping', 'media', 'websocket', 'other'];
  const DEFAULTS = { adblock: true, autoUpdate: true };
  const STATE_KEY = 'filterState';
  const BUNDLED_RULESET = 'filters';

  // ---------- Hilfsfunktionen ----------
  const get = (keys) => Promise.resolve(ext.storage.local.get(keys));
  const set = (values) => Promise.resolve(ext.storage.local.set(values));

  function keyOf(filter, thirdParty, types) {
    return filter + '|' + (thirdParty ? 1 : 0) + '|' + types;
  }

  function typesKey(resourceTypes) {
    if (!resourceTypes || resourceTypes.length === ALL_TYPES.length) return '';
    return resourceTypes.slice().sort().join(',');
  }

  function toRule(id, [filter, thirdParty, types]) {
    const condition = { urlFilter: filter, resourceTypes: types ? types.split(',') : ALL_TYPES };
    if (thirdParty) condition.domainType = 'thirdParty';
    return { id, priority: 1, action: { type: 'block' }, condition };
  }

  function dynamicLimit() {
    return dnr.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES || dnr.MAX_NUMBER_OF_DYNAMIC_RULES || 5000;
  }

  // ---------- Regeln anwenden ----------
  async function apply() {
    const { adblock, autoUpdate } = await get(DEFAULTS);
    const { [STATE_KEY]: state } = await get({ [STATE_KEY]: null });
    const active = adblock && autoUpdate && state;
    const added = active ? state.added : [];
    const removedIds = active ? state.removedIds : [];

    const existing = await dnr.getDynamicRules();
    await dnr.updateDynamicRules({
      removeRuleIds: existing.map((r) => r.id),
      addRules: added.map((entry, i) => toRule(i + 1, entry)),
    });

    // Eingebaute Regeln, die aus den Listen entfernt wurden, abschalten
    // (updateStaticRules gibt es erst in neueren Safari-Versionen).
    if (typeof dnr.updateStaticRules === 'function') {
      const prev = (await get({ disabledStatic: [] })).disabledStatic;
      const enable = prev.filter((id) => !removedIds.includes(id));
      try {
        await dnr.updateStaticRules({ rulesetId: BUNDLED_RULESET, disableRuleIds: removedIds, enableRuleIds: enable });
        await set({ disabledStatic: removedIds });
      } catch (_) { /* nicht unterstützt – dann bleiben alte Regeln einfach aktiv */ }
    }
  }

  // ---------- Update laden ----------
  let running = null;

  function update(force) {
    if (!running) running = doUpdate(force).finally(() => { running = null; });
    return running;
  }

  async function doUpdate(force) {
    const { autoUpdate } = await get(DEFAULTS);
    const { [STATE_KEY]: state } = await get({ [STATE_KEY]: null });
    if (!autoUpdate) return status();
    if (!force && state && Date.now() - (state.checked || 0) < CHECK_EVERY_MS) return status();

    try {
      const headers = state && state.etag && !force ? { 'If-None-Match': state.etag } : {};
      const resp = await fetch(UPDATE_URL, { cache: 'no-cache', headers });
      if (resp.status === 304 && state) {
        await set({ [STATE_KEY]: { ...state, checked: Date.now(), error: null } });
        return status();
      }
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      if (data.format !== 1 || !Array.isArray(data.rules) || data.rules.length < 20000) {
        throw new Error('invalid list');
      }

      const bundled = await (await fetch(ext.runtime.getURL('rules/filters.json'))).json();
      const custom = await (await fetch(ext.runtime.getURL('rules/custom.json'))).json();
      const bundledKeys = new Map();
      for (const r of bundled) {
        const c = r.condition;
        bundledKeys.set(keyOf(c.urlFilter, c.domainType === 'thirdParty', typesKey(c.resourceTypes)), r.id);
      }
      const customFilters = new Set(custom.map((r) => r.condition.urlFilter));

      const remoteKeys = new Set();
      const added = [];
      for (const entry of data.rules) {
        const k = keyOf(entry[0], entry[1], entry[2]);
        remoteKeys.add(k);
        if (!bundledKeys.has(k) && !customFilters.has(entry[0])) added.push(entry);
      }
      const removedIds = [];
      for (const [k, id] of bundledKeys) if (!remoteKeys.has(k)) removedIds.push(id);

      const limit = dynamicLimit();
      const next = {
        checked: Date.now(),
        generated: data.generated || null,
        etag: resp.headers.get('ETag'),
        added: added.slice(0, limit),
        skipped: Math.max(0, added.length - limit),
        removedIds,
        error: null,
      };
      await set({ [STATE_KEY]: next });
      await apply();
    } catch (err) {
      const prev = state || {};
      await set({ [STATE_KEY]: { ...prev, added: prev.added || [], removedIds: prev.removedIds || [],
        checked: Date.now(), error: String(err && err.message ? err.message : err) } });
    }
    return status();
  }

  async function status() {
    const { autoUpdate } = await get(DEFAULTS);
    const { [STATE_KEY]: state } = await get({ [STATE_KEY]: null });
    return {
      ok: true,
      autoUpdate,
      generated: state ? state.generated : null,
      checked: state ? state.checked : null,
      added: state ? state.added.length : 0,
      removed: state ? state.removedIds.length : 0,
      error: state ? state.error : null,
    };
  }

  // ---------- Auslöser ----------
  function schedule() {
    try { ext.alarms.create(ALARM, { periodInMinutes: 6 * 60 }); } catch (_) {}
  }

  ext.runtime.onInstalled.addListener(() => { schedule(); update(true); });
  ext.runtime.onStartup && ext.runtime.onStartup.addListener(() => { schedule(); update(false); });
  ext.alarms && ext.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) update(false); });

  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.autoUpdate && changes.autoUpdate.newValue === true) update(true);
    else if (changes.adblock || changes.autoUpdate) apply();
  });

  ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'tubeshield-filters') return false;
    (msg.force ? update(true) : update(false)).then(sendResponse, () => sendResponse(null));
    return true;
  });

  // Service Worker wurde (neu) gestartet: fällige Prüfung nachholen.
  schedule();
  update(false);
})();
