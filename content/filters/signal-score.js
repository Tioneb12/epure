/**
 * signal-score.js
 * Scoring inversé : détection du signal probable
 * Conservateur et humble — "signal probable", jamais de certitude
 * Lit ses données depuis window.Epure.dictionaries.signal
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};
  window.Epure.filters = window.Epure.filters || {};

  function scoreSignal(text, context) {
    var dict = (window.Epure.dictionaries && window.Epure.dictionaries.signal) || {};
    var CONNECTORS_EN = dict.CONNECTORS_EN || [];
    var CONNECTORS_FR = dict.CONNECTORS_FR || [];
    var DATA_RE = dict.DATA_RE || null;
    var PROMO_PATTERNS = dict.PROMO_PATTERNS || null;

    var total = 0;
    var reasons = [];
    var lower = text.toLowerCase();
    var sel = window.Epure.sel;
    var postElement = context.postElement;
    var authorUrl = context.authorUrl;
    var config = context.config;
    var noiseScore = context.noiseScore;

    // Données concrètes
    var dataMatches = DATA_RE ? (text.match(DATA_RE) || []) : [];
    var hasOutboundLinks = false;
    if (postElement) {
      hasOutboundLinks = postElement.querySelectorAll(sel.OUTBOUND_LINKS).length > 0;
    }
    if (dataMatches.length >= 2 || hasOutboundLinks) {
      total += 0.15;
      reasons.push('données concrètes');
    }

    // Substance > 80 mots sans broetry
    var words = text.split(/\s+/).filter(function(w) { return w.length > 0; });
    var lines = text.split('\n').filter(function(l) { return l.trim().length > 0; });
    var newlineRatio = lines.length / Math.max(words.length, 1);
    if (words.length > 80 && newlineRatio < 0.15) {
      total += 0.15;
      reasons.push('contenu substantiel');
    }

    // Structure argumentative
    var connectorHits = 0;
    var allConnectors = CONNECTORS_EN.concat(CONNECTORS_FR);
    for (var i = 0; i < allConnectors.length; i++) {
      if (lower.includes(allConnectors[i])) connectorHits++;
    }
    if (connectorHits >= 2) {
      total += 0.1;
      reasons.push('structure argumentative');
    }

    // Absence de bruit (le plus gros bonus)
    if (noiseScore < 0.2) {
      total += 0.3;
      reasons.push('absence de bruit');
    }

    // Auteur whitelist
    if (authorUrl && config && config.whitelist && config.whitelist.indexOf(authorUrl) !== -1) {
      total += 0.2;
      reasons.push('auteur whitelist');
    }

    // Mots-clés signal custom
    if (config && config.signalKeywords && config.signalKeywords.length > 0) {
      var kwHits = 0;
      for (var k = 0; k < config.signalKeywords.length; k++) {
        if (lower.includes(config.signalKeywords[k].toLowerCase())) kwHits++;
      }
      if (kwHits > 0) {
        total += Math.min(kwHits * 0.1, 0.2);
        reasons.push('mots-clés signal (' + kwHits + ')');
      }
    }

    // Pas de CTA commercial
    if (!PROMO_PATTERNS || !PROMO_PATTERNS.test(text)) {
      total += 0.1;
      reasons.push('pas de CTA commercial');
    }

    var finalScore = Math.min(total, 1);
    var threshold = (config && config.signalThreshold != null) ? config.signalThreshold : 0.7;

    return {
      score: finalScore,
      isSignal: finalScore >= threshold,
      reasons: reasons
    };
  }

  window.Epure.filters.signal = { scoreSignal: scoreSignal };
})();
