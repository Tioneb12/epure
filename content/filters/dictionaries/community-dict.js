/**
 * community-dict.js
 * Dictionnaire communautaire — modifiable par PR sur le repo public
 * Structure : mots-clés bruit et signal proposés par la communauté
 *
 * Pour contribuer :
 * 1. Fork le repo https://github.com/Tioneb12/epure
 * 2. Ajoutez vos mots-clés dans les tableaux ci-dessous
 * 3. Ouvrez une Pull Request avec une justification
 *
 * Règles :
 * - Phrases en minuscules, FR ou EN
 * - Pas de regex, uniquement des chaînes simples
 * - Un mot-clé = un pattern récurrent observé sur LinkedIn
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};
  window.Epure.dictionaries = window.Epure.dictionaries || {};

  window.Epure.dictionaries.community = {
    // Mots-clés bruit : expressions qui indiquent du contenu faible signal
    noise: [],

    // Mots-clés signal : expressions qui indiquent du contenu de qualité
    signal: []
  };
})();
