/**
 * humble-brag.js
 * Détecte le humble brag et le storytelling forcé — FR + EN
 * Lit ses données depuis window.Epure.dictionaries.humbleBrag
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};
  window.Epure.filters = window.Epure.filters || {};

  function score(text) {
    var dict = (window.Epure.dictionaries && window.Epure.dictionaries.humbleBrag) || {};
    var TEMPORAL_PATTERNS = dict.TEMPORAL_PATTERNS || [];
    var HUMBLE_BRAG = dict.HUMBLE_BRAG || [];
    var VANITY_RE = dict.VANITY_RE || null;
    var LIFE_LESSON_RE = dict.LIFE_LESSON_RE || null;

    // Fallback défensif : si le dictionnaire est absent, score 0
    if (HUMBLE_BRAG.length === 0 && TEMPORAL_PATTERNS.length === 0) {
      return { score: 0, reasons: [] };
    }

    var total = 0;
    var reasons = [];
    var lower = text.toLowerCase();

    var hasTemporal = false;
    for (var i = 0; i < TEMPORAL_PATTERNS.length; i++) {
      if (TEMPORAL_PATTERNS[i].test(text)) { hasTemporal = true; break; }
    }

    var bragHits = 0;
    for (var j = 0; j < HUMBLE_BRAG.length; j++) {
      if (lower.includes(HUMBLE_BRAG[j])) bragHits++;
    }
    if (bragHits >= 2) { total += 0.4; reasons.push('humble brag multiple'); }
    else if (bragHits === 1) { total += 0.2; reasons.push('humble brag'); }

    var hasNow = /\b(today|aujourd'hui|maintenant|now|désormais)\b/i.test(text);
    if (hasTemporal && hasNow) { total += 0.25; reasons.push('storytelling temporel'); }
    else if (hasTemporal) { total += 0.1; reasons.push('pattern temporel'); }

    // Compter les vanity metrics (plusieurs = plus lourd)
    if (VANITY_RE) {
      var vanityMatches = text.match(new RegExp(VANITY_RE.source, 'gi')) || [];
      if (vanityMatches.length >= 3) { total += 0.35; reasons.push('vanity metrics massif (' + vanityMatches.length + ')'); }
      else if (vanityMatches.length >= 1) { total += 0.15; reasons.push('vanity metrics'); }
    }

    if (LIFE_LESSON_RE && LIFE_LESSON_RE.test(text)) { total += 0.15; reasons.push('leçon de vie générique'); }

    // "Je me vante pas" / "le but c'est pas de me vanter" = humble brag flagrant
    if (/(?:pas (?:pour )?(?:me |se )?vanter|not (?:to )?(?:brag|boast)|(?:c'est|je suis) pas (?:là )?pour (?:me )?vanter|humble)/i.test(text)) {
      total += 0.25; reasons.push('déni de vantardise');
    }

    return { score: Math.min(total, 1), reasons: reasons };
  }

  window.Epure.filters.humbleBrag = { score: score };
})();
