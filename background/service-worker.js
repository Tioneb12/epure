/**
 * service-worker.js
 * Background script Épure (MV3)
 * - Met à jour le badge icône (compteur signal)
 * - Gère le raccourci Alt+S via chrome.commands
 * - Écoute les messages du content script
 */

import { getStats, getConfig, saveConfig } from '../utils/storage.js';

// Couleurs du badge
const BADGE_COLOR_SIGNAL = '#e8b931';  // jaune doré
const BADGE_COLOR_NEUTRAL = '#8a8a8a'; // gris

/**
 * Met à jour le badge icône avec le nombre de posts signal
 */
async function updateBadge() {
  const stats = await getStats();
  const count = stats.signalCount;

  if (count > 0) {
    await chrome.action.setBadgeText({ text: String(count) });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_SIGNAL });
  } else {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_NEUTRAL });
  }
}

/**
 * Écoute les messages du content script et du popup
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'reset-stats') {
    updateBadge();
  }
  return false;
});

/**
 * Écoute le raccourci clavier Alt+S via chrome.commands
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-signal-only') {
    // Vérifier si le hotkey est activé
    const config = await getConfig();
    if (config.hotkey === false) return;

    // Sauvegarder le toggle — le content script réagit via onChanged
    config.signalOnly = !config.signalOnly;
    await saveConfig(config);
  }
});

/**
 * Écoute les changements de stats pour mettre à jour le badge
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.stats) {
    updateBadge();
  }
});

// Initialisation du badge au démarrage
updateBadge();
