/**
 * generic-content.js
 * Détecte le contenu générique / template marketing — Bilingue FR + EN
 * Lit ses données depuis window.Epure.dictionaries.genericContent
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};
  window.Epure.filters = window.Epure.filters || {};

  function score(text) {
    var dict = (window.Epure.dictionaries && window.Epure.dictionaries.genericContent) || {};
    var GENERIC_PHRASES_EN = dict.GENERIC_PHRASES_EN || [];
    var GENERIC_PHRASES_FR = dict.GENERIC_PHRASES_FR || [];
    var STRUCTURAL_EMOJIS = dict.STRUCTURAL_EMOJIS || null;
    var NUMBERED_LIST_RE = dict.NUMBERED_LIST_RE || null;
    var CTA_FINAL_RE = dict.CTA_FINAL_RE || null;

    // Fallback défensif : si le dictionnaire est absent, score 0
    if (GENERIC_PHRASES_EN.length === 0 && GENERIC_PHRASES_FR.length === 0) {
      return { score: 0, reasons: [] };
    }

    var total = 0;
    var reasons = [];
    var lower = text.toLowerCase();

    var phraseHits = 0;
    for (var i = 0; i < GENERIC_PHRASES_EN.length; i++) {
      if (lower.includes(GENERIC_PHRASES_EN[i])) phraseHits++;
    }
    for (var j = 0; j < GENERIC_PHRASES_FR.length; j++) {
      if (lower.includes(GENERIC_PHRASES_FR[j])) phraseHits++;
    }
    if (phraseHits >= 3) {
      total += 0.4;
      reasons.push('expressions template (' + phraseHits + ')');
    } else if (phraseHits >= 1) {
      total += 0.15 * phraseHits;
      reasons.push('expression générique');
    }

    if (STRUCTURAL_EMOJIS) {
      var emojiLines = text.split('\n').filter(function(l) { return STRUCTURAL_EMOJIS.test(l); });
      if (emojiLines.length >= 3) {
        total += 0.2;
        reasons.push('emojis structurels');
      }
    }

    if (NUMBERED_LIST_RE && CTA_FINAL_RE) {
      var numberedItems = (text.match(NUMBERED_LIST_RE) || []).length;
      if (numberedItems >= 3 && CTA_FINAL_RE.test(lower)) {
        total += 0.25;
        reasons.push('structure liste + CTA');
      }
    }

    var sentences = text.split(/[.!?\n]+/).filter(function(s) { return s.trim().length > 5; });
    if (sentences.length >= 4) {
      var lengths = sentences.map(function(s) { return s.trim().split(/\s+/).length; });
      var avg = lengths.reduce(function(a, b) { return a + b; }, 0) / lengths.length;
      var variance = lengths.reduce(function(a, b) { return a + Math.pow(b - avg, 2); }, 0) / lengths.length;
      if (variance < 4 && avg > 3) {
        total += 0.15;
        reasons.push('lissage stylistique');
      }
    }

    // Formule récap équation (X = Y. Y = Z.) — signature LinkedIn bro
    var equationLines = text.match(/^.{3,30}\s*=\s*.{3,30}\.?\s*$/gm);
    if (equationLines && equationLines.length >= 2) {
      total += 0.2;
      reasons.push('formule récap (' + equationLines.length + ')');
    }

    // Signature auto-promo en fin de post
    if (/(?:ghostwriter|coach|formateur|formatrice|mentor|consultant|experte?)\s+qui/i.test(text)) {
      total += 0.15;
      reasons.push('signature auto-promo');
    }

    return { score: Math.min(total, 1), reasons: reasons };
  }

  window.Epure.filters.genericContent = { score: score };
})();
