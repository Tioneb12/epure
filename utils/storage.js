/**
 * storage.js
 * Gestion du stockage chrome.storage avec versioning de schéma
 * sync = config, local = compteurs
 */

const SCHEMA_VERSION = 1;

// Structure config par défaut
const DEFAULT_CONFIG = {
  schema_version: SCHEMA_VERSION,
  enabled: true,
  mode: 'blur',             // 'blur' | 'hide' | 'badge'
  noiseThreshold: 0.6,
  signalThreshold: 0.7,
  highlightSignal: true,
  signalOnly: false,
  hotkey: true,              // Active/désactive le raccourci Alt+S
  filterSponsored: false,    // true = traiter les posts sponsorisés comme bruit
  filters: {
    genericContent: { enabled: true, weight: 80 },
    broetry: { enabled: true, weight: 70 },
    engagementBait: { enabled: true, weight: 90 },
    humbleBrag: { enabled: true, weight: 50 },
    promo: { enabled: true, weight: 75 },
    structural: { enabled: true, weight: 30 }
  },
  signalKeywords: [],        // Mots-clés bonus signal custom
  noiseKeywords: [],         // Mots-clés bruit custom
  whitelist: []              // URLs /in/xxx ou /company/xxx
};

// Stats par défaut
const DEFAULT_STATS = {
  totalCount: 0,
  signalCount: 0,
  noiseCount: 0,
  lastReset: Date.now()
};

/**
 * Récupère la config depuis chrome.storage.sync
 * Applique les valeurs par défaut pour les clés manquantes
 */
export async function getConfig() {
  const data = await chrome.storage.sync.get('config');
  if (!data.config) {
    await saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  await migrateIfNeeded(data.config);
  // Fusion avec les défauts pour les clés potentiellement absentes
  return mergeDefaults(data.config, DEFAULT_CONFIG);
}

/**
 * Sauvegarde la config dans chrome.storage.sync
 */
export async function saveConfig(config) {
  config.schema_version = SCHEMA_VERSION;
  await chrome.storage.sync.set({ config });
}

/**
 * Récupère les compteurs depuis chrome.storage.local
 */
export async function getStats() {
  const data = await chrome.storage.local.get('stats');
  if (!data.stats) {
    await chrome.storage.local.set({ stats: { ...DEFAULT_STATS } });
    return { ...DEFAULT_STATS };
  }
  return data.stats;
}

/**
 * Met à jour les compteurs
 * @param {{ total?: number, noise?: number, signal?: number }} counts
 */
export async function updateStats(counts) {
  const stats = await getStats();
  stats.totalCount = (stats.totalCount || 0) + (counts.total || 0);
  stats.noiseCount += (counts.noise || 0);
  stats.signalCount += (counts.signal || 0);
  await chrome.storage.local.set({ stats });
  return stats;
}

/**
 * Remet les compteurs à zéro
 */
export async function resetStats() {
  const stats = { ...DEFAULT_STATS, lastReset: Date.now() };
  await chrome.storage.local.set({ stats });
  return stats;
}

/**
 * Migration automatique si schema_version < SCHEMA_VERSION
 */
async function migrateIfNeeded(config) {
  if (!config.schema_version || config.schema_version < SCHEMA_VERSION) {
    // Migration v0 → v1 : ajout des champs manquants via mergeDefaults
    config.schema_version = SCHEMA_VERSION;
    await saveConfig(config);
  }
}

/**
 * Fusionne récursivement les valeurs par défaut pour les clés manquantes
 */
function mergeDefaults(obj, defaults) {
  const result = { ...defaults };
  for (const key of Object.keys(obj)) {
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

/**
 * Retourne la config par défaut (pour reset)
 */
export function getDefaultConfig() {
  return { ...DEFAULT_CONFIG, filters: { ...DEFAULT_CONFIG.filters } };
}

/**
 * Valide et assainit une config importée
 * Retourne une config safe ou null si l'entrée est invalide
 */
export function validateConfig(obj) {
  if (!obj || typeof obj !== 'object') return null;

  var safe = mergeDefaults({}, DEFAULT_CONFIG);

  // Booléens
  ['enabled', 'highlightSignal', 'signalOnly', 'hotkey', 'filterSponsored'].forEach(function(key) {
    if (typeof obj[key] === 'boolean') safe[key] = obj[key];
  });

  // Nombres bornés
  if (typeof obj.noiseThreshold === 'number') safe.noiseThreshold = Math.max(0, Math.min(1, obj.noiseThreshold));
  if (typeof obj.signalThreshold === 'number') safe.signalThreshold = Math.max(0, Math.min(1, obj.signalThreshold));

  // Mode
  if (['blur', 'hide', 'badge'].indexOf(obj.mode) !== -1) safe.mode = obj.mode;

  // Filtres
  if (obj.filters && typeof obj.filters === 'object') {
    for (const name of Object.keys(DEFAULT_CONFIG.filters)) {
      if (obj.filters[name]) {
        if (typeof obj.filters[name].enabled === 'boolean') safe.filters[name].enabled = obj.filters[name].enabled;
        if (typeof obj.filters[name].weight === 'number') safe.filters[name].weight = Math.max(0, Math.min(100, Math.round(obj.filters[name].weight)));
      }
    }
  }

  // Arrays de strings
  ['signalKeywords', 'noiseKeywords', 'whitelist'].forEach(function(key) {
    if (Array.isArray(obj[key])) safe[key] = obj[key].filter(function(v) { return typeof v === 'string'; });
  });

  return safe;
}

/**
 * Vérifie si le bandeau notation a déjà été affiché
 */
export async function getRatingShown() {
  const data = await chrome.storage.local.get('ratingShown');
  return !!data.ratingShown;
}

/**
 * Marque le bandeau notation comme affiché
 */
export async function setRatingShown() {
  await chrome.storage.local.set({ ratingShown: true });
}

/**
 * Normalise une URL auteur LinkedIn en pathname court
 * Ex: "https://www.linkedin.com/in/jean-dupont?foo=bar" → "/in/jean-dupont"
 */
export function normalizeAuthorUrl(href) {
  if (!href) return null;
  try {
    const url = new URL(href, 'https://www.linkedin.com');
    const path = url.pathname;
    // Extraire /in/xxx ou /company/xxx ou /school/xxx
    const match = path.match(/\/(in|company|school)\/([^/]+)/);
    if (match) {
      return `/${match[1]}/${match[2]}`;
    }
    return null;
  } catch {
    return null;
  }
}
