/**
 * structural.js
 * Détecte les problèmes structurels : hashtags, emojis, posts courts,
 * activité réseau, posts sponsorisés
 * Lit ses données depuis window.Epure.dictionaries.structural
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};
  window.Epure.filters = window.Epure.filters || {};

  function isNetworkActivity(postElement) {
    var sel = window.Epure.sel;
    var fullText = postElement.textContent || '';
    var lower = fullText.toLowerCase();
    for (var i = 0; i < sel.NETWORK_ACTIVITY_HINTS.length; i++) {
      if (lower.includes(sel.NETWORK_ACTIVITY_HINTS[i].toLowerCase())) return true;
    }
    return false;
  }

  function score(text, context) {
    var dict = (window.Epure.dictionaries && window.Epure.dictionaries.structural) || {};
    var EMOJI_RE = dict.EMOJI_RE || null;

    var total = 0;
    var reasons = [];
    var sel = window.Epure.sel;
    var postElement = context.postElement;

    if (postElement) {
      var hashtags = postElement.querySelectorAll(sel.HASHTAG_LINKS);
      if (hashtags.length > 5) {
        total += 0.3;
        reasons.push('hashtags excessifs (' + hashtags.length + ')');
      }
    }

    if (EMOJI_RE) {
      var emojis = text.match(EMOJI_RE) || [];
      if (emojis.length > 10) {
        total += 0.25;
        reasons.push('emojis excessifs (' + emojis.length + ')');
      }
    }

    var wordCount = text.split(/\s+/).filter(function(w) { return w.length > 0; }).length;
    if (wordCount < 20) {
      total += 0.2;
      reasons.push('post très court');
    }

    if (postElement && isNetworkActivity(postElement)) {
      total += 0.4;
      reasons.push('activité réseau');
    }

    // Sponsorisé géré directement par detector.js

    return { score: Math.min(total, 1), reasons: reasons };
  }

  window.Epure.filters.structural = { score: score };
})();
