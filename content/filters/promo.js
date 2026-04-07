/**
 * promo.js
 * Détecte le contenu promotionnel et les lead magnets — FR + EN
 * Lit ses données depuis window.Epure.dictionaries.promo
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};
  window.Epure.filters = window.Epure.filters || {};

  function score(text) {
    var dict = (window.Epure.dictionaries && window.Epure.dictionaries.promo) || {};
    var PROMO_PHRASES_EN = dict.PROMO_PHRASES_EN || [];
    var PROMO_PHRASES_FR = dict.PROMO_PHRASES_FR || [];
    var VALUE_THEN_CTA_RE = dict.VALUE_THEN_CTA_RE || null;

    // Fallback défensif : si le dictionnaire est absent, score 0
    if (PROMO_PHRASES_EN.length === 0 && PROMO_PHRASES_FR.length === 0) {
      return { score: 0, reasons: [] };
    }

    var total = 0;
    var reasons = [];
    var lower = text.toLowerCase();

    var promoHits = 0;
    for (var i = 0; i < PROMO_PHRASES_EN.length; i++) {
      if (lower.includes(PROMO_PHRASES_EN[i])) promoHits++;
    }
    for (var j = 0; j < PROMO_PHRASES_FR.length; j++) {
      if (lower.includes(PROMO_PHRASES_FR[j])) promoHits++;
    }
    if (promoHits >= 3) { total += 0.5; reasons.push('promo agressive (' + promoHits + ')'); }
    else if (promoHits >= 2) { total += 0.35; reasons.push('promo multiple'); }
    else if (promoHits === 1) { total += 0.2; reasons.push('promo'); }

    if (/\b(gratuit|free|offert)\b/i.test(text) && promoHits > 0) {
      total += 0.15; reasons.push('appât gratuit');
    }

    if (VALUE_THEN_CTA_RE && VALUE_THEN_CTA_RE.test(text)) {
      total += 0.2; reasons.push('valeur + CTA commercial');
    }

    // Lien externe + vocabulaire commercial = promo
    if (/https?:\/\//.test(text) && promoHits > 0) {
      total += 0.15; reasons.push('lien + promo');
    }

    return { score: Math.min(total, 1), reasons: reasons };
  }

  window.Epure.filters.promo = { score: score };
})();
