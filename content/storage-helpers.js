/**
 * storage-helpers.js
 * Helpers chrome.storage pour les content scripts (IIFE, pas de module)
 * sync = config, local = compteurs
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};

  // Vérifie que le contexte d'extension est encore valide
  // (après rechargement de l'extension, les vieux content scripts sont orphelins)
  function isContextValid() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); }
    catch(e) { return false; }
  }

  var SCHEMA_VERSION = 1;

  var DEFAULT_CONFIG = {
    schema_version: SCHEMA_VERSION,
    enabled: true,
    mode: 'blur',
    noiseThreshold: 0.6,
    signalThreshold: 0.7,
    highlightSignal: true,
    signalOnly: false,
    hotkey: true,
    filterSponsored: false,
    filters: {
      genericContent: { enabled: true, weight: 80 },
      broetry: { enabled: true, weight: 70 },
      engagementBait: { enabled: true, weight: 90 },
      humbleBrag: { enabled: true, weight: 50 },
      promo: { enabled: true, weight: 75 },
      structural: { enabled: true, weight: 30 }
    },
    signalKeywords: [],
    noiseKeywords: [],
    whitelist: []
  };

  var DEFAULT_STATS = {
    totalCount: 0,
    signalCount: 0,
    noiseCount: 0,
    lastReset: Date.now()
  };

  function mergeDefaults(obj, defaults) {
    var result = Object.assign({}, defaults);
    for (var key of Object.keys(obj)) {
      if (obj[key] !== undefined && obj[key] !== null) {
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) &&
            typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
          result[key] = mergeDefaults(obj[key], defaults[key]);
        } else {
          result[key] = obj[key];
        }
      }
    }
    return result;
  }

  async function getConfig() {
    if (!isContextValid()) return Object.assign({}, DEFAULT_CONFIG);
    var data = await chrome.storage.sync.get('config');
    if (!data.config) {
      await saveConfig(DEFAULT_CONFIG);
      return Object.assign({}, DEFAULT_CONFIG);
    }
    if (!data.config.schema_version || data.config.schema_version < SCHEMA_VERSION) {
      data.config.schema_version = SCHEMA_VERSION;
      await saveConfig(data.config);
    }
    return mergeDefaults(data.config, DEFAULT_CONFIG);
  }

  async function saveConfig(config) {
    if (!isContextValid()) return;
    config.schema_version = SCHEMA_VERSION;
    await chrome.storage.sync.set({ config: config });
  }

  // Compteurs en mémoire (synchrone, zéro race condition)
  var memStats = null;
  var flushTimer = null;
  var FLUSH_DELAY = 300;

  async function loadStats() {
    if (!isContextValid()) { memStats = Object.assign({}, DEFAULT_STATS); return; }
    try {
      var data = await chrome.storage.local.get('stats');
      memStats = data.stats || Object.assign({}, DEFAULT_STATS);
      // Migration : ajouter totalCount si absent
      if (memStats.totalCount === undefined) memStats.totalCount = 0;
    } catch(e) {
      memStats = Object.assign({}, DEFAULT_STATS);
    }
  }

  function flushStats() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(function() {
      if (!isContextValid()) return;
      try {
        chrome.storage.local.set({ stats: memStats }).catch(function() {});
      } catch(e) { /* contexte invalidé */ }
    }, FLUSH_DELAY);
  }

  async function getStats() {
    if (!memStats) await loadStats();
    return memStats;
  }

  function updateStats(counts) {
    if (!memStats) return;
    memStats.totalCount += (counts.total || 0);
    memStats.noiseCount += (counts.noise || 0);
    memStats.signalCount += (counts.signal || 0);
    flushStats();
  }

  async function resetStats() {
    memStats = Object.assign({}, DEFAULT_STATS, { lastReset: Date.now() });
    if (!isContextValid()) return memStats;
    try {
      await chrome.storage.local.set({ stats: memStats });
    } catch(e) { /* contexte invalidé */ }
    return memStats;
  }

  // Charger les stats au démarrage (seulement si contexte valide)
  if (isContextValid()) loadStats();

  function normalizeAuthorUrl(href) {
    if (!href) return null;
    try {
      var url = new URL(href, 'https://www.linkedin.com');
      var path = url.pathname;
      var match = path.match(/\/(in|company|school)\/([^/]+)/);
      if (match) return '/' + match[1] + '/' + match[2];
      return null;
    } catch(e) {
      return null;
    }
  }

  // === Flag bandeau notation Chrome Web Store ===
  async function getRatingShown() {
    if (!isContextValid()) return false;
    try {
      var data = await chrome.storage.local.get('ratingShown');
      return !!data.ratingShown;
    } catch(e) { return false; }
  }

  async function setRatingShown() {
    if (!isContextValid()) return;
    try {
      await chrome.storage.local.set({ ratingShown: true });
    } catch(e) { /* contexte invalidé */ }
  }

  window.Epure.storage = {
    getConfig: getConfig,
    saveConfig: saveConfig,
    getStats: getStats,
    getMemStats: function() { return memStats; },
    updateStats: updateStats,
    resetStats: resetStats,
    normalizeAuthorUrl: normalizeAuthorUrl,
    getDefaultConfig: function() { return Object.assign({}, DEFAULT_CONFIG); },
    isContextValid: isContextValid,
    getRatingShown: getRatingShown,
    setRatingShown: setRatingShown
  };
})();
