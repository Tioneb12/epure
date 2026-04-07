/**
 * engagement-bait.js
 * Détecte les posts qui sollicitent artificiellement l'engagement — FR + EN
 * Lit ses données depuis window.Epure.dictionaries.engagementBait
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};
  window.Epure.filters = window.Epure.filters || {};

  function score(text, context) {
    var dict = (window.Epure.dictionaries && window.Epure.dictionaries.engagementBait) || {};
    var BAIT_PHRASES_EN = dict.BAIT_PHRASES_EN || [];
    var BAIT_PHRASES_FR = dict.BAIT_PHRASES_FR || [];
    var CTA_END_RE = dict.CTA_END_RE || null;

    // Fallback défensif : si le dictionnaire est absent, score 0
    if (BAIT_PHRASES_EN.length === 0 && BAIT_PHRASES_FR.length === 0) {
      return { score: 0, reasons: [] };
    }

    var total = 0;
    var reasons = [];
    var lower = text.toLowerCase();
    var sel = window.Epure.sel;

    var baitHits = 0;
    for (var i = 0; i < BAIT_PHRASES_EN.length; i++) {
      if (lower.includes(BAIT_PHRASES_EN[i])) baitHits++;
    }
    for (var j = 0; j < BAIT_PHRASES_FR.length; j++) {
      if (lower.includes(BAIT_PHRASES_FR[j])) baitHits++;
    }
    if (baitHits >= 2) {
      total += 0.5;
      reasons.push('engagement bait multiple (' + baitHits + ')');
    } else if (baitHits === 1) {
      total += 0.3;
      reasons.push('engagement bait');
    }

    if (context && context.postElement) {
      var poll = context.postElement.querySelector(sel.POLL_CANDIDATES);
      if (poll) {
        total += 0.2;
        reasons.push('sondage');
      }
    }

    if (CTA_END_RE && CTA_END_RE.test(text)) {
      total += 0.2;
      reasons.push('CTA fin de post');
    }

    // Accroche provocatrice en ouverture
    if (/^(?:tu penses|vous pensez|you think|you still think|tu crois|vous croyez).{5,60}\?\s/im.test(text)) {
      total += 0.15;
      reasons.push('accroche provocatrice');
    }

    // Urgence artificielle (FOMO)
    if (/(?:faut pas tra[iî]ner|d[eé]p[eê]che[z-]|hurry|act now|avant qu'il|plus que \d|only \d+ (?:left|spots|seats)|attention\s*:|attention !)/i.test(text)) {
      total += 0.2;
      reasons.push('urgence artificielle');
    }

    return { score: Math.min(total, 1), reasons: reasons };
  }

  window.Epure.filters.engagementBait = { score: score };
})();
