/**
 * observer.js
 * MutationObserver sur le feed LinkedIn
 * Debounce 200ms + queue de traitement par batch de 10
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};

  var observer = null;
  var debounceTimer = null;
  var config = null;
  var scanning = false;   // verrou anti-réentrance
  var DEBOUNCE_MS = 200;
  var BATCH_SIZE = 10;
  var BATCH_COOLDOWN_MS = 300;
  var MAX_POSTS_SESSION = 500;
  var processedCount = 0;

  async function initObserver() {
    var sel = window.Epure.sel;
    config = await window.Epure.storage.getConfig();
    // S'assurer que les stats sont chargées en mémoire avant de traiter
    await window.Epure.storage.getStats();

    // Écouter les changements de config
    chrome.storage.onChanged.addListener(function(changes, area) {
      if (area === 'sync' && changes.config) {
        config = changes.config.newValue;
      }
    });

    // Observer scopé sur main (pas document.body) pour éviter les
    // mutations parasites (header, chat, sidebar, signal bar…)
    observer = new MutationObserver(onMutation);
    attachObserver();

    // Scan initial avec retry + backoff exponentiel (LinkedIn SPA charge le feed en async)
    var retries = 0;
    var BASE_DELAY = 1500;
    function tryInitialScan() {
      var allPosts = findFeedPosts();
      if (allPosts.length > 0) {
        scanNewPosts();
      } else if (retries < 10) {
        retries++;
        var delay = Math.min(BASE_DELAY * Math.pow(1.5, retries - 1), 10000);
        setTimeout(tryInitialScan, delay);
      }
    }
    tryInitialScan();
  }

  /**
   * Attache l'observer sur main (scope réduit).
   * Si main n'existe pas encore, retry toutes les 500ms.
   */
  function attachObserver() {
    var main = document.querySelector('main');
    if (main) {
      observer.observe(main, { childList: true, subtree: true });
    } else {
      setTimeout(attachObserver, 500);
    }
  }

  function isEpureElement(node) {
    if (!node || !node.closest) return false;
    if (node.closest('[data-epure-overlay]')) return true;
    if (node.classList && node.classList.contains('epure-signal-only-feed')) return true;
    // Ignorer les mutations sur les posts déjà traités
    if (node.hasAttribute && node.hasAttribute('data-epure-processed')) return true;
    if (node.closest && node.closest('[data-epure-processed]')) return true;
    return false;
  }

  function onMutation(mutations) {
    // Auto-destruction si le contexte d'extension est invalidé (rechargement)
    if (!window.Epure.storage.isContextValid()) {
      cleanupAll();
      if (observer) { observer.disconnect(); observer = null; }
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      return;
    }

    // Pas de scan pendant un traitement en cours
    if (scanning) return;

    // Ignorer les mutations Épure (overlays, posts traités, feed signal-only)
    var dominated = true;
    for (var i = 0; i < mutations.length; i++) {
      if (!isEpureElement(mutations[i].target)) {
        dominated = false;
        break;
      }
    }
    if (dominated) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanNewPosts, DEBOUNCE_MS);
  }

  /**
   * Filtre les vrais posts du feed parmi les listitem.
   * On cible les listitem dans main qui contiennent du contenu de post
   * (texte feed-commentary ou data-view-name="feed-full-update").
   */
  function findFeedPosts() {
    var main = document.querySelector('main');
    if (!main) return [];

    // Tous les listitem dans main qui contiennent du contenu de post
    var listitems = main.querySelectorAll('[role="listitem"]');
    var result = [];

    for (var i = 0; i < listitems.length; i++) {
      var li = listitems[i];
      // Un vrai post contient feed-full-update, feed-commentary, ou un lien auteur
      if (li.querySelector('[data-view-name="feed-full-update"]') ||
          li.querySelector('[data-view-name="feed-commentary"]') ||
          li.querySelector('a[href*="/in/"]')) {
        result.push(li);
      }
    }

    return result;
  }

  function scanNewPosts() {
    if (!config || !config.enabled) return;
    if (scanning) return; // anti-réentrance
    scanning = true;

    // Déconnecter l'observer pendant le traitement pour couper la cascade
    if (observer) observer.disconnect();

    var sel = window.Epure.sel;
    var allPosts = findFeedPosts();
    var unprocessed = [];

    for (var i = 0; i < allPosts.length; i++) {
      if (!sel.isProcessed(allPosts[i])) unprocessed.push(allPosts[i]);
    }

    if (unprocessed.length > 0) {
      processQueue(unprocessed);
    } else {
      finishScan();
    }
  }

  /**
   * Reconnecter l'observer après un cooldown pour laisser le DOM se stabiliser
   */
  function finishScan() {
    setTimeout(function() {
      scanning = false;
      if (observer) attachObserver();
    }, 300);
  }

  function processQueue(posts) {
    var index = 0;
    function processBatch() {
      if (processedCount >= MAX_POSTS_SESSION) {
        console.info('[Epure] Limite de session atteinte (' + MAX_POSTS_SESSION + ' posts)');
        finishScan();
        return;
      }
      var end = Math.min(index + BATCH_SIZE, posts.length);
      for (var i = index; i < end; i++) {
        if (processedCount >= MAX_POSTS_SESSION) break;
        processPost(posts[i]);
        processedCount++;
      }
      index = end;
      if (index < posts.length && processedCount < MAX_POSTS_SESSION) {
        setTimeout(processBatch, BATCH_COOLDOWN_MS);
      } else {
        finishScan();
      }
    }
    processBatch();
  }

  function processPost(postElement) {
    try {
      if (!postElement || !postElement.isConnected) return;

      var sel = window.Epure.sel;
      var detector = window.Epure.detector;
      var highlighter = window.Epure.highlighter;

      if (sel.isProcessed(postElement)) return;

      // En mode signal-only, marquer le parent direct du post pour le CSS
      if (config.signalOnly && postElement.parentElement) {
        if (!postElement.parentElement.classList.contains('epure-signal-only-feed')) {
          postElement.parentElement.classList.add('epure-signal-only-feed');
        }
      }

      var result = detector.analyzePost(postElement, config);
      sel.markAsProcessed(postElement);
      if (result === null) return;

      // Compteurs juste apres l'analyse, avant les traitements visuels
      window.Epure.storage.updateStats({
        total: 1,
        noise: result.noise.triggered ? 1 : 0,
        signal: result.signal.isSignal ? 1 : 0
      });

      // Vérifier si on doit afficher le bandeau notation
      if (window.Epure.ui && window.Epure.ui.checkRatingBanner) {
        window.Epure.ui.checkRatingBanner();
      }

      if (config.signalOnly) {
        if (result.signal.isSignal) {
          highlighter.applySignalHighlight(postElement, result, config);
        }
      } else {
        // Arbitrage : signal gagne SI son score est >= au score bruit.
        // Sinon le bruit l'emporte (même si signal.isSignal est true).
        var signalWins = result.signal.isSignal && result.signal.score >= result.noise.finalScore;
        if (signalWins) {
          highlighter.applySignalHighlight(postElement, result, config);
        } else if (result.noise.triggered) {
          highlighter.applyNoiseAction(postElement, result, config);
        }
        highlighter.applyScoreIndicator(postElement, result);
      }

      // Mise a jour ratio live du bandeau Signal Only (seulement en mode signal)
      if (config.signalOnly && window.Epure.ui) window.Epure.ui.updateBarRatio();
    } catch (e) {
      console.warn('[Epure] processPost:', e.message);
    }
  }

  function reprocessAll() {
    var sel = window.Epure.sel;
    var highlighter = window.Epure.highlighter;

    // Tout arrêter
    if (observer) observer.disconnect();
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    scanning = false;

    // Retirer la classe CSS signal-only si on n'est plus en mode signal
    if (!config.signalOnly) {
      var feed = document.querySelector('.epure-signal-only-feed');
      if (feed) feed.classList.remove('epure-signal-only-feed');
    }

    var allPosts = document.querySelectorAll('[' + sel.PROCESSED_ATTR + ']');
    for (var i = 0; i < allPosts.length; i++) {
      allPosts[i].removeAttribute(sel.PROCESSED_ATTR);
      highlighter.removeAllTreatments(allPosts[i]);
    }

    // scanNewPosts va déconnecter → traiter → reconnecter via finishScan
    scanNewPosts();
  }

  /**
   * Nettoie toutes les modifications DOM d'Epure (overlays, classes, attributs)
   */
  function cleanupAll() {
    var sel = window.Epure.sel;
    var highlighter = window.Epure.highlighter;

    var processed = document.querySelectorAll('[' + sel.PROCESSED_ATTR + ']');
    for (var i = 0; i < processed.length; i++) {
      highlighter.removeAllTreatments(processed[i]);
      processed[i].removeAttribute(sel.PROCESSED_ATTR);
    }

    var feed = document.querySelector('.epure-signal-only-feed');
    if (feed) feed.classList.remove('epure-signal-only-feed');

    if (window.Epure.detector && window.Epure.detector.clearCache) {
      window.Epure.detector.clearCache();
    }
  }

  function stopObserver() {
    if (observer) { observer.disconnect(); observer = null; }
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    cleanupAll();
  }

  window.Epure.observer = {
    initObserver: initObserver,
    reprocessAll: reprocessAll,
    stopObserver: stopObserver,
    cleanupAll: cleanupAll
  };
})();
