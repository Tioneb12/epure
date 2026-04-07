/**
 * detector.js
 * Orchestrateur du scoring : exécute tous les filtres bruit + signal
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};

  var scoreCache = new Map();
  var MAX_CACHE_SIZE = 500;
  var CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  function quickHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function extractText(postElement) {
    var sel = window.Epure.sel;
    var candidates = postElement.querySelectorAll(sel.TEXT_CANDIDATES);
    var longestText = '';

    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.closest(sel.COMMENT_ZONES)) continue;
      if (el.closest('button') || el.closest(sel.SOCIAL_ACTIONS)) continue;
      if (el.closest('[data-epure-overlay]')) continue;

      var text = el.innerText || '';
      if (text.length > longestText.length) longestText = text;
    }

    return longestText
      .replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  function extractAuthorUrl(postElement) {
    var sel = window.Epure.sel;
    var link = postElement.querySelector(sel.AUTHOR_LINKS);
    if (!link) return null;
    return window.Epure.storage.normalizeAuthorUrl(link.getAttribute('href'));
  }

  function isSponsored(postElement) {
    var candidates = postElement.querySelectorAll('p, span');
    for (var i = 0; i < candidates.length; i++) {
      var raw = candidates[i].textContent.trim();
      if (raw.length > 20) continue;
      var txt = raw.toLowerCase().normalize('NFC');
      if (txt === 'sponsoris\u00e9' || txt === 'promoted' || txt === 'sponsored') {
        return true;
      }
    }
    // Fallback : chercher dans tout le texte du post
    var full = postElement.textContent.toLowerCase().normalize('NFC');
    if (full.indexOf('sponsoris\u00e9') !== -1 || full.indexOf('promoted') !== -1) {
      return true;
    }
    return false;
  }

  function analyzePost(postElement, config) {
    var text = extractText(postElement);

    var hash = quickHash(text);
    if (scoreCache.has(hash)) {
      var cached = scoreCache.get(hash);
      if (Date.now() - cached.ts < CACHE_TTL_MS) return cached.result;
      scoreCache.delete(hash);
    }

    var authorUrl = extractAuthorUrl(postElement);

    // Détection sponsorisé EN PREMIER : les sponsorisés sont souvent des posts courts
    // (carousel, image, vidéo) qui seraient skippés par le filtre wordCount < 20
    var postIsSponsored = isSponsored(postElement);
    if (postIsSponsored) {
      if (config.filterSponsored) {
        var sponsoredNoise = {
          postElement: postElement, textContent: text, authorUrl: authorUrl,
          noise: { scores: {}, finalScore: 1, triggered: true, reasons: ['sponsorisé'] },
          signal: { score: 0, isSignal: false, reasons: [] }
        };
        cacheResult(hash, sponsoredNoise);
        return sponsoredNoise;
      } else {
        var sponsoredSkip = {
          postElement: postElement, textContent: text, authorUrl: authorUrl,
          noise: { scores: {}, finalScore: 0, triggered: false, reasons: ['sponsorisé (ignoré)'] },
          signal: { score: 0, isSignal: false, reasons: [] }
        };
        cacheResult(hash, sponsoredSkip);
        return sponsoredSkip;
      }
    }

    // Filtre wordCount APRÈS la détection sponsorisée
    var wordCount = text.split(/\s+/).filter(function(w) { return w.length > 0; }).length;
    if (wordCount < 20) return null;

    var context = { postElement: postElement, authorUrl: authorUrl, config: config };
    var filters = window.Epure.filters;

    var isWhitelisted = authorUrl && config.whitelist && config.whitelist.indexOf(authorUrl) !== -1;

    // Scoring bruit
    var noiseScores = {};
    var noiseReasons = [];

    // Mots-clés bruit : config utilisateur + dictionnaire communautaire
    var lower = text.toLowerCase();
    var allNoiseKw = (config.noiseKeywords || []).slice();
    var community = (window.Epure.dictionaries && window.Epure.dictionaries.community) || {};
    if (community.noise && community.noise.length > 0) {
      allNoiseKw = allNoiseKw.concat(community.noise);
    }
    if (allNoiseKw.length > 0) {
      var kwHits = 0;
      for (var k = 0; k < allNoiseKw.length; k++) {
        if (lower.includes(allNoiseKw[k].toLowerCase())) kwHits++;
      }
      if (kwHits > 0) noiseReasons.push('mots-clés bruit (' + kwHits + ')');
    }

    var filterMap = {
      genericContent: filters.genericContent,
      broetry: filters.broetry,
      engagementBait: filters.engagementBait,
      humbleBrag: filters.humbleBrag,
      promo: filters.promo,
      structural: filters.structural
    };

    var weightedSum = 0;

    for (var name in filterMap) {
      var filterConfig = config.filters && config.filters[name];
      if (!filterConfig || !filterConfig.enabled) {
        noiseScores[name] = 0;
        continue;
      }

      try {
        var res = filterMap[name].score(text, context);
        noiseScores[name] = res.score;
        noiseReasons = noiseReasons.concat(res.reasons);
        var weight = (filterConfig.weight || 50) / 100;
        weightedSum += res.score * weight;
      } catch (e) {
        console.warn('[Epure] Filtre ' + name + ':', e.message);
        noiseScores[name] = 0;
      }
    }

    var noiseFinal = Math.min(weightedSum, 1);
    var noiseTriggered = !isWhitelisted && noiseFinal >= config.noiseThreshold;

    // Scoring signal — fusionner les mots-clés signal communautaires
    var signalConfig = config;
    if (community.signal && community.signal.length > 0) {
      signalConfig = Object.assign({}, config);
      signalConfig.signalKeywords = (config.signalKeywords || []).concat(community.signal);
    }
    var signalContext = {
      postElement: postElement, authorUrl: authorUrl,
      config: signalConfig, noiseScore: noiseFinal
    };
    var signalResult;
    try {
      signalResult = filters.signal.scoreSignal(text, signalContext);
    } catch (e) {
      console.warn('[Epure] Signal scoring:', e.message);
      signalResult = { score: 0, isSignal: false, reasons: [] };
    }

    var result = {
      postElement: postElement, textContent: text, authorUrl: authorUrl,
      noise: { scores: noiseScores, finalScore: noiseFinal, triggered: noiseTriggered, reasons: noiseReasons },
      signal: signalResult
    };

    cacheResult(hash, result);
    return result;
  }

  function cacheResult(hash, result) {
    if (scoreCache.size >= MAX_CACHE_SIZE) {
      var firstKey = scoreCache.keys().next().value;
      scoreCache.delete(firstKey);
    }
    scoreCache.set(hash, { result: result, ts: Date.now() });
  }

  function clearCache() {
    scoreCache.clear();
  }

  window.Epure.detector = {
    analyzePost: analyzePost,
    extractText: extractText,
    extractAuthorUrl: extractAuthorUrl,
    clearCache: clearCache
  };
})();
