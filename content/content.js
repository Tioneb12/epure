/**
 * content.js
 * Point d'entrée du content script Épure
 * Initialise l'observer et gère le raccourci clavier Alt+S (fallback)
 */
(function() {
  'use strict';

  var signalBar = null;

  /**
   * Trouve le conteneur [role="list"] du feed et lui ajoute la classe
   * de masquage signal-only. Utilise le child combinator (>) pour ne
   * cibler que les enfants directs — pas les listitems imbriqués.
   */
  function markFeedSignalOnly() {
    var main = document.querySelector('main');
    if (!main) return;
    var firstItem = main.querySelector('[role="listitem"]');
    if (firstItem && firstItem.parentElement) {
      firstItem.parentElement.classList.add('epure-signal-only-feed');
    }
  }

  function unmarkFeedSignalOnly() {
    var feed = document.querySelector('.epure-signal-only-feed');
    if (feed) feed.classList.remove('epure-signal-only-feed');
  }

  /**
   * Nettoyage des orphelins d'un content script précédent (invalidé par rechargement extension)
   */
  function cleanupOrphans() {
    var orphanOverlays = document.querySelectorAll('[data-epure-overlay]');
    for (var i = 0; i < orphanOverlays.length; i++) orphanOverlays[i].remove();
    var orphanProcessed = document.querySelectorAll('[data-epure-processed]');
    for (var j = 0; j < orphanProcessed.length; j++) {
      orphanProcessed[j].removeAttribute('data-epure-processed');
      orphanProcessed[j].removeAttribute('data-epure-signal');
      orphanProcessed[j].removeAttribute('data-epure-noise');
      orphanProcessed[j].classList.remove('epure-blurred', 'epure-hidden', 'epure-badged', 'epure-signal', 'epure-revealed', 'epure-positioned');
    }
    var orphanFeed = document.querySelector('.epure-signal-only-feed');
    if (orphanFeed) orphanFeed.classList.remove('epure-signal-only-feed');
  }

  async function init() {
    cleanupOrphans();

    var storage = window.Epure.storage;
    var obs = window.Epure.observer;
    var config = await storage.getConfig();

    if (!config.enabled) return;

    await obs.initObserver();

    if (config.hotkey !== false) setupHotkeyFallback();
    if (config.signalOnly) {
      markFeedSignalOnly();
      showSignalOnlyBar('active');
    }

    // Messages du service worker et du popup
    chrome.runtime.onMessage.addListener(function(msg) {
      if (msg.type === 'config-changed') debouncedReprocess();
      if (msg.type === 'reset-stats') window.Epure.storage.resetStats();
    });

    // Changements de config (debounce pour éviter les refresh multiples)
    var reprocessTimer = null;
    function debouncedReprocess() {
      if (reprocessTimer) clearTimeout(reprocessTimer);
      reprocessTimer = setTimeout(function() { obs.reprocessAll(); }, 300);
    }

    chrome.storage.onChanged.addListener(function(changes, area) {
      if (area === 'sync' && changes.config) {
        var newConfig = changes.config.newValue;
        var oldConfig = changes.config.oldValue;

        if (!newConfig.enabled) {
          obs.stopObserver();
          removeSignalOnlyBar();
          return;
        }

        // Détection changement signalOnly
        var soChanged = oldConfig && (!!oldConfig.signalOnly !== !!newConfig.signalOnly);

        if (soChanged) {
          if (newConfig.signalOnly) {
            // Activation → bandeau alerte (pas encore de reprocess)
            showSignalOnlyBar('alert');
          } else {
            // Désactivation → retirer bandeau + reprocess
            removeSignalOnlyBar();
            obs.reprocessAll();
          }
        } else {
          // Autre changement de config → reprocess normal
          debouncedReprocess();
        }
      }
    });
  }

  function setupHotkeyFallback() {
    document.addEventListener('keydown', function(e) {
      if (e.altKey && e.code === 'KeyS') {
        e.preventDefault();
        toggleSignalOnly();
      }
    });
  }

  /**
   * Toggle signalOnly via config — le onChanged handler gère l'UI
   */
  async function toggleSignalOnly() {
    var storage = window.Epure.storage;
    var config = await storage.getConfig();
    config.signalOnly = !config.signalOnly;
    await storage.saveConfig(config);
  }

  /**
   * Lance le filtrage Signal Only (bouton "Lancer" dans le bandeau alerte)
   * La config est déjà signalOnly=true, on switch juste le bandeau et on reprocess
   */
  function launchSignalOnly() {
    markFeedSignalOnly();
    showSignalOnlyBar('active');
    window.Epure.observer.reprocessAll();
  }

  // === Bandeau unifié Signal Only ===

  /**
   * Affiche le bandeau fixe en bas de page
   * @param {'alert'|'active'} state
   */
  function showSignalOnlyBar(state) {
    if (signalBar) signalBar.remove();

    signalBar = document.createElement('div');
    signalBar.className = 'epure-signal-bar';
    signalBar.setAttribute('data-epure-overlay', '1');

    if (state === 'alert') {
      signalBar.innerHTML = '<span class="epure-bar-warn">\u26A0</span> <span class="epure-bar-text">Le mode Signal Only est tr\u00e8s restrictif</span> <span style="color:#8a8a8a;">\u00b7</span> <button class="epure-bar-btn epure-bar-launch">Lancer le filtrage</button>';
      signalBar.querySelector('.epure-bar-launch').addEventListener('click', launchSignalOnly);
    } else {
      signalBar.innerHTML = '<span class="epure-bar-text">Respire\u2026</span> <span class="epure-bar-brand">j\u2019<span class="epure-bar-accent">\u00C9</span>pure<span class="epure-bar-accent">.</span></span> <span style="color:#333;">\u00b7</span> <span class="epure-bar-ratio"></span> <button class="epure-bar-btn epure-bar-next">\u2193 Suivant</button> <button class="epure-bar-btn epure-bar-stop">Stop</button>';
      signalBar.querySelector('.epure-bar-next').addEventListener('click', scrollToNextSignal);
      signalBar.querySelector('.epure-bar-stop').addEventListener('click', toggleSignalOnly);
      updateBarRatio();
    }

    document.body.appendChild(signalBar);
  }

  function removeSignalOnlyBar() {
    unmarkFeedSignalOnly();
    if (signalBar) {
      signalBar.remove();
      signalBar = null;
    }
  }

  var ratioTimer = null;

  /**
   * Met à jour le ratio — debounce 300ms pour éviter les reflows en cascade
   */
  function updateBarRatio() {
    if (ratioTimer) return; // déjà planifié
    ratioTimer = setTimeout(function() {
      ratioTimer = null;
      if (!signalBar) return;
      var ratioEl = signalBar.querySelector('.epure-bar-ratio');
      if (!ratioEl) return;

      var stats = window.Epure.storage.getMemStats();
      if (!stats) return;

      var newText = '\u2726 ' + stats.signalCount + ' / ' + stats.totalCount;
      if (ratioEl.textContent !== newText) {
        ratioEl.textContent = newText;
        // Flash visuel sur le compteur (une seule fois par batch)
        ratioEl.classList.remove('epure-bar-pulse');
        requestAnimationFrame(function() {
          ratioEl.classList.add('epure-bar-pulse');
        });
        // Micro-scale sur le bandeau
        signalBar.classList.remove('epure-bar-tick');
        requestAnimationFrame(function() {
          signalBar.classList.add('epure-bar-tick');
        });
      }
    }, 300);
  }

  function scrollToNextSignal() {
    var currentScroll = window.scrollY;
    var signals = document.querySelectorAll('[data-epure-signal="1"]');
    for (var i = 0; i < signals.length; i++) {
      var top = signals[i].getBoundingClientRect().top + window.scrollY;
      // Trouver le premier signal en dessous du viewport actuel (marge 60px)
      if (top > currentScroll + 60) {
        signals[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    // Aucun signal plus bas — scroller en bas pour forcer LinkedIn à charger
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  // === Bandeau notation Chrome Web Store ===

  var RATING_THRESHOLD = 100;
  var ratingCheckPending = false;

  /**
   * Vérifie si le seuil de posts bruit est atteint et affiche le bandeau si besoin.
   * Appelé depuis observer.js après chaque updateStats.
   */
  async function checkRatingBanner() {
    if (ratingCheckPending) return;
    var stats = window.Epure.storage.getMemStats();
    if (!stats || stats.noiseCount < RATING_THRESHOLD) return;

    ratingCheckPending = true;
    var shown = await window.Epure.storage.getRatingShown();
    if (shown) return;

    showRatingBanner();
  }

  function showRatingBanner() {
    var banner = document.createElement('div');
    banner.className = 'epure-rating-banner';
    banner.setAttribute('data-epure-overlay', '1');

    // Logo gauche
    var logoDiv = document.createElement('div');
    logoDiv.className = 'epure-rating-logo';
    logoDiv.innerHTML = '<span class="epure-rating-accent">\u00C9</span>pure<span class="epure-rating-accent">.</span>';

    // Bloc droit : texte + CTA
    var rightDiv = document.createElement('div');
    rightDiv.className = 'epure-rating-right';

    var textP = document.createElement('p');
    textP.className = 'epure-rating-text';
    textP.textContent = '\u00C9pure a filtr\u00e9 100+ posts pour toi. Tu kiffes ? Dis-le.';

    var storeUrl = 'https://chromewebstore.google.com/detail/' + chrome.runtime.id + '/reviews';

    var ctaBtn = document.createElement('a');
    ctaBtn.className = 'epure-rating-cta';
    ctaBtn.href = storeUrl;
    ctaBtn.target = '_blank';
    ctaBtn.rel = 'noopener';
    ctaBtn.textContent = 'Laisser un avis \u2605';

    rightDiv.appendChild(textP);
    rightDiv.appendChild(ctaBtn);

    // Bouton fermer
    var closeBtn = document.createElement('button');
    closeBtn.className = 'epure-rating-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.title = 'Fermer';

    banner.appendChild(logoDiv);
    banner.appendChild(rightDiv);
    banner.appendChild(closeBtn);

    function dismiss() {
      banner.remove();
    }

    ctaBtn.addEventListener('click', dismiss);
    closeBtn.addEventListener('click', dismiss);

    // Injecter dans le feed comme premier enfant
    var main = document.querySelector('main');
    if (!main) return;
    var feedList = main.querySelector('[role="list"]');
    if (feedList) {
      feedList.insertBefore(banner, feedList.firstChild);
    } else {
      main.insertBefore(banner, main.firstChild);
    }

    // Marquer comme affichée DÈS l'injection (pas seulement au clic)
    // → la bannière ne re-apparaît plus jamais après son premier affichage,
    // évitant le comportement "nag screen" insistant à chaque session.
    window.Epure.storage.setRatingShown();
  }

  // Exposer pour l'observer (mise à jour ratio live + check rating)
  window.Epure = window.Epure || {};
  window.Epure.ui = {
    updateBarRatio: updateBarRatio,
    checkRatingBanner: checkRatingBanner
  };

  init();
})();
