/**
 * popup.js
 * Logique du popup Épure — unifié (filtres + signal + auteurs + config)
 */

import {
  getConfig,
  saveConfig,
  getDefaultConfig,
  getStats,
  resetStats,
  normalizeAuthorUrl,
  validateConfig
} from '../utils/storage.js';

// === Références DOM ===

// Header
const toggleEnabled = document.getElementById('toggleEnabled');
const totalCountEl = document.getElementById('totalCount');
const signalCountEl = document.getElementById('signalCount');
const noiseCountEl = document.getElementById('noiseCount');

// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Filtres
const filterCheckboxes = document.querySelectorAll('[data-filter]');
const weightSliders = document.querySelectorAll('[data-weight]');
const noiseThreshold = document.getElementById('noiseThreshold');
const noiseThresholdLabel = document.getElementById('noiseThresholdLabel');
const modeBtns = document.querySelectorAll('.mode-btn');
const noiseKeywordsEl = document.getElementById('noiseKeywords');
const filterSponsoredEl = document.getElementById('filterSponsored');

// Signal
const toggleHighlight = document.getElementById('toggleHighlight');
const toggleSignalOnly = document.getElementById('toggleSignalOnly');
const signalThresholdEl = document.getElementById('signalThreshold');
const signalThresholdLabel = document.getElementById('signalThresholdLabel');
const signalKeywordsEl = document.getElementById('signalKeywords');
const optHotkey = document.getElementById('optHotkey');

// Auteurs
const whitelistContainer = document.getElementById('whitelistContainer');
const whitelistInput = document.getElementById('whitelistInput');
const addWhitelistBtn = document.getElementById('addWhitelist');

// Config
const exportBtn = document.getElementById('exportConfig');
const importInput = document.getElementById('importConfig');
const resetConfigBtn = document.getElementById('resetConfig');
const resetCountersBtn = document.getElementById('resetCounters');
const configVersionEl = document.getElementById('configVersion');

// === Init ===

async function init() {
  const config = await getConfig();
  const stats = await getStats();
  populateUI(config, stats);
  setupListeners();

  // Hotkey label adapté à la plateforme
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const hintEl = document.getElementById('hotkeyHint');
  if (hintEl) hintEl.textContent = isMac ? '⌥S' : 'Alt+S';

  // Lien notation Chrome Web Store
  const rateLink = document.getElementById('rateLink');
  if (rateLink) {
    rateLink.href = 'https://chromewebstore.google.com/detail/' + chrome.runtime.id + '/reviews';
    rateLink.target = '_blank';
    rateLink.rel = 'noopener';
  }
}

function populateUI(config, stats) {
  // Toggle global
  toggleEnabled.checked = config.enabled;

  // Compteurs
  totalCountEl.textContent = stats.totalCount || 0;
  signalCountEl.textContent = stats.signalCount;
  noiseCountEl.textContent = stats.noiseCount;

  // Filtres
  filterCheckboxes.forEach(cb => {
    const name = cb.dataset.filter;
    if (config.filters?.[name]) cb.checked = config.filters[name].enabled;
  });

  // Poids
  weightSliders.forEach(slider => {
    const name = slider.dataset.weight;
    const val = config.filters?.[name]?.weight ?? 50;
    slider.value = val;
    const label = document.querySelector('[data-weight-label="' + name + '"]');
    if (label) label.textContent = val + '%';
  });

  // Sensibilité
  noiseThreshold.value = Math.round(config.noiseThreshold * 100);
  noiseThresholdLabel.textContent = config.noiseThreshold.toFixed(2);

  // Mode
  modeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === config.mode);
  });

  // Mots-clés bruit
  noiseKeywordsEl.value = (config.noiseKeywords || []).join('\n');

  // Sponsorisés : coché = filtrer, décoché = laisser tranquille
  filterSponsoredEl.checked = config.filterSponsored === true;

  // Signal
  toggleHighlight.checked = config.highlightSignal;
  toggleSignalOnly.checked = config.signalOnly;
  signalThresholdEl.value = Math.round(config.signalThreshold * 100);
  signalThresholdLabel.textContent = config.signalThreshold.toFixed(2);
  signalKeywordsEl.value = (config.signalKeywords || []).join('\n');
  optHotkey.checked = config.hotkey !== false;

  // Auteurs
  renderAuthorList(config.whitelist || []);

  // Config info
  configVersionEl.textContent = chrome.runtime.getManifest().version;
}

// === Auteurs ===

function renderAuthorList(urls) {
  whitelistContainer.innerHTML = '';
  if (urls.length === 0) {
    whitelistContainer.innerHTML = '<p class="hint" style="padding: 4px 0;">Aucun auteur</p>';
    return;
  }
  urls.forEach(url => {
    const item = document.createElement('div');
    item.className = 'author-item';
    const span = document.createElement('span');
    span.textContent = url;
    const btn = document.createElement('button');
    btn.className = 'btn-remove';
    btn.title = 'Supprimer';
    btn.textContent = '\u00d7';
    item.appendChild(span);
    item.appendChild(btn);
    btn.addEventListener('click', async () => {
      const config = await getConfig();
      config.whitelist = config.whitelist.filter(u => u !== url);
      await saveConfig(config);
      renderAuthorList(config.whitelist);
    });
    whitelistContainer.appendChild(item);
  });
}

function normalizeInput(val) {
  val = val.trim();
  if (!val) return null;
  if (val.startsWith('http')) return normalizeAuthorUrl(val);
  if (val.startsWith('/')) return val;
  return '/in/' + val;
}

// === Listeners ===

function setupListeners() {
  // Navigation onglets
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Toggle global
  toggleEnabled.addEventListener('change', async () => {
    const config = await getConfig();
    config.enabled = toggleEnabled.checked;
    await saveConfig(config);
  });

  // Filtres
  filterCheckboxes.forEach(cb => {
    cb.addEventListener('change', async () => {
      const config = await getConfig();
      const name = cb.dataset.filter;
      if (config.filters[name]) {
        config.filters[name].enabled = cb.checked;
        await saveConfig(config);
      }
    });
  });

  // Poids filtres
  weightSliders.forEach(slider => {
    slider.addEventListener('input', () => {
      const label = document.querySelector('[data-weight-label="' + slider.dataset.weight + '"]');
      if (label) label.textContent = slider.value + '%';
    });
    slider.addEventListener('change', async () => {
      const config = await getConfig();
      const name = slider.dataset.weight;
      if (config.filters[name]) {
        config.filters[name].weight = parseInt(slider.value, 10);
        await saveConfig(config);
      }
    });
  });

  // Sensibilité bruit
  noiseThreshold.addEventListener('input', () => {
    noiseThresholdLabel.textContent = (noiseThreshold.value / 100).toFixed(2);
    // Si seuil bruit dépasse seuil signal, faire suivre le slider signal
    if (parseInt(noiseThreshold.value, 10) > parseInt(signalThresholdEl.value, 10)) {
      signalThresholdEl.value = noiseThreshold.value;
      signalThresholdLabel.textContent = (signalThresholdEl.value / 100).toFixed(2);
    }
  });
  noiseThreshold.addEventListener('change', async () => {
    const config = await getConfig();
    config.noiseThreshold = noiseThreshold.value / 100;
    // Sauvegarder aussi le seuil signal s'il a été remonté par le clamp
    if (noiseThreshold.value / 100 > config.signalThreshold) {
      config.signalThreshold = noiseThreshold.value / 100;
    }
    await saveConfig(config);
  });

  // Mode
  modeBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const config = await getConfig();
      config.mode = btn.dataset.mode;
      await saveConfig(config);
    });
  });

  // Mots-clés bruit (sauvegarde en temps réel avec debounce)
  let noiseKwTimer = null;
  noiseKeywordsEl.addEventListener('input', () => {
    if (noiseKwTimer) clearTimeout(noiseKwTimer);
    noiseKwTimer = setTimeout(async () => {
      const config = await getConfig();
      config.noiseKeywords = noiseKeywordsEl.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      await saveConfig(config);
    }, 500);
  });

  // Sponsorisés
  filterSponsoredEl.addEventListener('change', async () => {
    const config = await getConfig();
    config.filterSponsored = filterSponsoredEl.checked;
    await saveConfig(config);
  });

  // Highlight signal
  toggleHighlight.addEventListener('change', async () => {
    const config = await getConfig();
    config.highlightSignal = toggleHighlight.checked;
    await saveConfig(config);
  });

  // Signal only — sauvegarde directe, le content script réagit via onChanged
  toggleSignalOnly.addEventListener('change', async () => {
    const config = await getConfig();
    config.signalOnly = toggleSignalOnly.checked;
    await saveConfig(config);
  });


  // Seuil signal
  signalThresholdEl.addEventListener('input', () => {
    // Bloquer la descente sous le seuil bruit
    if (parseInt(signalThresholdEl.value, 10) < parseInt(noiseThreshold.value, 10)) {
      signalThresholdEl.value = noiseThreshold.value;
    }
    signalThresholdLabel.textContent = (signalThresholdEl.value / 100).toFixed(2);
  });
  signalThresholdEl.addEventListener('change', async () => {
    const config = await getConfig();
    config.signalThreshold = signalThresholdEl.value / 100;
    await saveConfig(config);
  });

  // Mots-clés signal (sauvegarde en temps réel avec debounce)
  let signalKwTimer = null;
  signalKeywordsEl.addEventListener('input', () => {
    if (signalKwTimer) clearTimeout(signalKwTimer);
    signalKwTimer = setTimeout(async () => {
      const config = await getConfig();
      config.signalKeywords = signalKeywordsEl.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      await saveConfig(config);
    }, 500);
  });

  // Hotkey
  optHotkey.addEventListener('change', async () => {
    const config = await getConfig();
    config.hotkey = optHotkey.checked;
    await saveConfig(config);
  });

  // Ajouter whitelist
  addWhitelistBtn.addEventListener('click', async () => {
    const url = normalizeInput(whitelistInput.value);
    if (!url) return;
    const config = await getConfig();
    if (!config.whitelist.includes(url)) {
      config.whitelist.push(url);
      await saveConfig(config);
      renderAuthorList(config.whitelist);
    }
    whitelistInput.value = '';
  });

  // Export
  exportBtn.addEventListener('click', async () => {
    const config = await getConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'epure-config.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import
  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const imported = validateConfig(raw);
      if (!imported) return;
      await saveConfig(imported);
      const config = await getConfig();
      const stats = await getStats();
      populateUI(config, stats);
    } catch { /* fichier invalide */ }
    importInput.value = '';
  });

  // Reset config
  resetConfigBtn.addEventListener('click', async () => {
    const defaults = getDefaultConfig();
    await saveConfig(defaults);
    const stats = await getStats();
    populateUI(defaults, stats);
  });

  // Reset compteurs
  resetCountersBtn.addEventListener('click', async () => {
    await resetStats();
    totalCountEl.textContent = '0';
    signalCountEl.textContent = '0';
    noiseCountEl.textContent = '0';
    chrome.runtime.sendMessage({ type: 'reset-stats' }).catch(() => {});
  });
}

// Stats en temps réel
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.stats) {
    const stats = changes.stats.newValue;
    if (stats) {
      totalCountEl.textContent = stats.totalCount || 0;
      signalCountEl.textContent = stats.signalCount;
      noiseCountEl.textContent = stats.noiseCount;
    }
  }
});

init();
