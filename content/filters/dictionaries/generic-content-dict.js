/**
 * generic-content-dict.js — STUB
 * Les vrais dictionnaires sont privés. Ce fichier permet à l'extension
 * de se lancer sans crash (les filtres retournent score 0 sans dictionnaire).
 *
 * Pour contribuer des mots-clés → community-dict.js
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};
  window.Epure.dictionaries = window.Epure.dictionaries || {};

  window.Epure.dictionaries.genericContent = {
    GENERIC_PHRASES_EN: [],
    GENERIC_PHRASES_FR: [],
    STRUCTURAL_EMOJIS: null,
    NUMBERED_LIST_RE: null,
    CTA_FINAL_RE: null
  };
})();