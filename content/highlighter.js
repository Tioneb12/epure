/**
 * highlighter.js
 * Traitement visuel des posts : blur/masquer/badge (bruit) + liseré doré (signal)
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};

  function applyNoiseAction(postElement, result, config) {
    try {
      if (!postElement || !postElement.isConnected) return;
      if (!result.noise.triggered) return;

      var mode = config.mode || 'blur';
      var score = result.noise.finalScore.toFixed(2);
      var reasons = result.noise.reasons.join(', ');
      var authorUrl = result.authorUrl;

      if (mode === 'blur') applyBlur(postElement, score, reasons, authorUrl);
      else if (mode === 'hide') postElement.classList.add('epure-hidden');
      else if (mode === 'badge') applyBadge(postElement, score, reasons);

      postElement.setAttribute('data-epure-noise', '1');
    } catch (e) {
      console.warn('[Epure] highlighter.applyNoiseAction:', e.message);
    }
  }

  function applyBlur(postElement, score, reasons, authorUrl) {
    postElement.classList.add('epure-blurred');

    var overlay = document.createElement('div');
    overlay.className = 'epure-blur-overlay';
    overlay.setAttribute('data-epure-overlay', '1');

    var label = document.createElement('span');
    label.className = 'epure-overlay-label';
    label.textContent = 'Faible signal \u00b7 score ' + score;
    overlay.appendChild(label);

    var actions = document.createElement('div');
    actions.className = 'epure-overlay-actions';

    var showBtn = document.createElement('button');
    showBtn.className = 'epure-btn-show';
    showBtn.textContent = 'Afficher';
    showBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      postElement.classList.add('epure-revealed');
      overlay.classList.add('epure-overlay-dismissed');
    });
    actions.appendChild(showBtn);

    if (authorUrl) {
      var whitelistBtn = document.createElement('button');
      whitelistBtn.className = 'epure-btn-whitelist';
      whitelistBtn.textContent = 'Toujours afficher';
      whitelistBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        window.Epure.storage.getConfig().then(function(cfg) {
          if (cfg.whitelist.indexOf(authorUrl) === -1) {
            cfg.whitelist.push(authorUrl);
            window.Epure.storage.saveConfig(cfg);
          }
        });
        postElement.classList.add('epure-revealed');
        overlay.classList.add('epure-overlay-dismissed');
      });
      actions.appendChild(whitelistBtn);
    }

    overlay.appendChild(actions);
    postElement.appendChild(overlay);
  }

  function applyBadge(postElement, score, reasons) {
    postElement.classList.add('epure-badged');
    var badge = document.createElement('div');
    badge.className = 'epure-noise-badge';
    badge.textContent = 'masqué (réglage)';
    badge.title = 'faible signal \u00b7 score ' + score + ' \u00b7 ' + reasons;
    badge.setAttribute('data-epure-overlay', '1');
    postElement.classList.add('epure-positioned');
    postElement.appendChild(badge);
  }

  function applySignalHighlight(postElement, result, config) {
    try {
      if (!postElement || !postElement.isConnected) return;
      if (!result.signal.isSignal) return;

      postElement.setAttribute('data-epure-signal', '1');

      if (!config.highlightSignal) return;
      postElement.classList.add('epure-signal');

      if (!postElement.querySelector('.epure-signal-badge')) {
        var badge = document.createElement('span');
        badge.className = 'epure-signal-badge';
        badge.textContent = '\u2726';
        badge.title = 'Post signal';
        badge.setAttribute('data-epure-overlay', '1');
        postElement.classList.add('epure-positioned');
        postElement.appendChild(badge);
      }
    } catch (e) {
      console.warn('[Epure] highlighter.applySignalHighlight:', e.message);
    }
  }

  function applyScoreIndicator(postElement, result) {
    try {
      if (!postElement || !postElement.isConnected) return;
      if (postElement.querySelector('.epure-score-indicator')) return;

      var tag = document.createElement('div');
      tag.className = 'epure-score-indicator';
      tag.setAttribute('data-epure-overlay', '1');

      var noise = result.noise.finalScore.toFixed(2);
      var signal = result.signal.score !== undefined ? result.signal.score.toFixed(2) : (result.signal.isSignal ? '1' : '0');
      var reasons = result.noise.reasons.length > 0 ? result.noise.reasons.join(', ') : 'aucun';

      tag.textContent = 'B:' + noise + ' S:' + signal;
      tag.title = 'Bruit: ' + noise + ' | Signal: ' + signal + '\n' + reasons;

      // Arbitrage cohérent avec observer.js : signal gagne uniquement si plus fort que le bruit
      var signalWins = result.signal.isSignal && result.signal.score >= result.noise.finalScore;
      if (signalWins) tag.classList.add('epure-score-signal');
      else if (result.noise.triggered) tag.classList.add('epure-score-noise');

      postElement.classList.add('epure-positioned');
      postElement.appendChild(tag);
    } catch (e) {
      console.warn('[Epure] highlighter.applyScoreIndicator:', e.message);
    }
  }

  function removeAllTreatments(postElement) {
    try {
      if (!postElement) return;
      postElement.classList.remove(
        'epure-blurred', 'epure-hidden', 'epure-badged',
        'epure-signal', 'epure-revealed', 'epure-positioned'
      );
      postElement.removeAttribute('data-epure-noise');
      postElement.removeAttribute('data-epure-signal');
      var overlays = postElement.querySelectorAll('[data-epure-overlay]');
      for (var i = 0; i < overlays.length; i++) overlays[i].remove();
    } catch (e) {
      console.warn('[Epure] highlighter.removeAllTreatments:', e.message);
    }
  }

  window.Epure.highlighter = {
    applyNoiseAction: applyNoiseAction,
    applySignalHighlight: applySignalHighlight,
    applyScoreIndicator: applyScoreIndicator,
    removeAllTreatments: removeAllTreatments
  };
})();
