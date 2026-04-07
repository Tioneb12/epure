/**
 * broetry.js
 * Détecte le style "broetry" : une phrase par ligne, effet dramatique
 * Lit ses données depuis window.Epure.dictionaries.broetry
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};
  window.Epure.filters = window.Epure.filters || {};

  function score(text) {
    var dict = (window.Epure.dictionaries && window.Epure.dictionaries.broetry) || {};
    var BROETRY_HINTS_RE = dict.BROETRY_HINTS_RE || null;

    var total = 0;
    var reasons = [];
    var lines = text.split('\n').filter(function(l) { return l.trim().length > 0; });
    var words = text.split(/\s+/).filter(function(w) { return w.length > 0; });
    var wordCount = words.length;
    var lineCount = lines.length;

    if (wordCount === 0) return { score: 0, reasons: [] };

    var newlineRatio = lineCount / wordCount;
    if (newlineRatio > 0.25) {
      total += 0.45;
      reasons.push('ratio lignes/mots très élevé');
    } else if (newlineRatio > 0.2) {
      total += 0.35;
      reasons.push('ratio lignes/mots élevé');
    } else if (newlineRatio > 0.15) {
      total += 0.2;
      reasons.push('beaucoup de retours à la ligne');
    }

    if (lines.length >= 2) {
      var firstLineWords = lines[0].trim().split(/\s+/).length;
      if (firstLineWords <= 8 && firstLineWords >= 1) {
        total += 0.15;
        reasons.push('accroche courte');
      }
    }

    if (BROETRY_HINTS_RE) {
      var hints = text.match(BROETRY_HINTS_RE);
      if (hints && hints.length >= 3) {
        total += 0.25;
        reasons.push('indicateurs broetry multiples (' + hints.length + ')');
      } else if (hints && hints.length > 0) {
        total += 0.15;
        reasons.push('indicateurs broetry');
      }
    }

    var singleSentenceParagraphs = lines.filter(function(l) {
      var trimmed = l.trim();
      var sentenceEnds = (trimmed.match(/[.!?]/g) || []).length;
      return sentenceEnds <= 1 && trimmed.split(/\s+/).length >= 2;
    });
    if (singleSentenceParagraphs.length > 10) {
      total += 0.35;
      reasons.push('paragraphes mono-phrase massif (' + singleSentenceParagraphs.length + ')');
    } else if (singleSentenceParagraphs.length > 5) {
      total += 0.25;
      reasons.push('paragraphes mono-phrase (' + singleSentenceParagraphs.length + ')');
    }

    return { score: Math.min(total, 1), reasons: reasons };
  }

  window.Epure.filters.broetry = { score: score };
})();
