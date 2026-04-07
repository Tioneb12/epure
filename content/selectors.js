/**
 * selectors.js
 * Sélecteurs DOM robustes pour analyser le feed LinkedIn
 * Basés sur rôles ARIA, attributs data-* et structures hiérarchiques
 */
(function() {
  'use strict';
  window.Epure = window.Epure || {};

  // Posts : LinkedIn utilise role="listitem" dans le feed principal
  var POSTS = [
    '[role="listitem"]',
    '[data-view-name="feed-full-update"]'
  ].join(',');

  var MAIN_CONTAINER = 'main';
  var FEED_CANDIDATES = [
    'main',
    'main [role="list"]',
    'main [role="main"]',
    'div[role="main"]'
  ].join(',');

  // Texte : data-view-name="feed-commentary" contient le texte du post
  var TEXT_CANDIDATES = [
    '[data-view-name="feed-commentary"]',
    '[data-testid="expandable-text-box"]',
    '[dir="ltr"]',
    'span[dir="ltr"]'
  ].join(',');

  var SEE_MORE = [
    'button[aria-expanded]',
    'button[aria-label*="see more"]',
    'button[aria-label*="Voir plus"]',
    'button[data-view-name*="see-more"]'
  ].join(',');

  var AUTHOR_LINKS = [
    'a[href*="/in/"]',
    'a[href*="/company/"]',
    'a[href*="/school/"]'
  ].join(',');

  var SPONSORED_HINTS = ['Promoted', 'Sponsorisé', 'Sponsored'];
  var LABELS = 'span, div, p';

  var SOCIAL_ACTIONS = [
    '[data-view-name="feed-social-action-bar"]',
    'button[aria-label*="Like"]',
    'button[aria-label*="J\'aime"]',
    'button[aria-label*="Comment"]',
    'button[aria-label*="Commenter"]',
    'button[aria-label*="Repost"]',
    'button[aria-label*="Republier"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="Envoyer"]'
  ].join(',');

  var HASHTAG_LINKS = 'a[href*="/feed/hashtag/"]';
  var MENTION_LINKS = 'a[href*="/in/"]';
  var OUTBOUND_LINKS = 'a[href^="http"]:not([href*="linkedin.com"])';

  var POLL_CANDIDATES = [
    '[role="radiogroup"]',
    'div[aria-label*="poll"]',
    'div[aria-label*="sondage"]'
  ].join(',');

  var COMMENT_ZONES = [
    '[data-view-name="comment-container"]',
    '[data-view-name="comment-commentary"]',
    'div[aria-label*="Comments"]',
    'div[aria-label*="Commentaires"]',
    'section[aria-label*="Comments"]',
    'section[aria-label*="Commentaires"]'
  ].join(',');

  var NETWORK_ACTIVITY_HINTS = [
    'a aimé ceci',
    'a commenté ceci',
    'liked this',
    'commented on this',
    'reposted'
  ];

  var PROCESSED_ATTR = 'data-epure-processed';

  function markAsProcessed(el) {
    if (el) el.setAttribute(PROCESSED_ATTR, '1');
  }

  function isProcessed(el) {
    return el && el.getAttribute(PROCESSED_ATTR) === '1';
  }

  window.Epure.sel = {
    POSTS: POSTS,
    MAIN_CONTAINER: MAIN_CONTAINER,
    FEED_CANDIDATES: FEED_CANDIDATES,
    TEXT_CANDIDATES: TEXT_CANDIDATES,
    SEE_MORE: SEE_MORE,
    AUTHOR_LINKS: AUTHOR_LINKS,
    SPONSORED_HINTS: SPONSORED_HINTS,
    LABELS: LABELS,
    SOCIAL_ACTIONS: SOCIAL_ACTIONS,
    HASHTAG_LINKS: HASHTAG_LINKS,
    MENTION_LINKS: MENTION_LINKS,
    OUTBOUND_LINKS: OUTBOUND_LINKS,
    POLL_CANDIDATES: POLL_CANDIDATES,
    COMMENT_ZONES: COMMENT_ZONES,
    NETWORK_ACTIVITY_HINTS: NETWORK_ACTIVITY_HINTS,
    PROCESSED_ATTR: PROCESSED_ATTR,
    markAsProcessed: markAsProcessed,
    isProcessed: isProcessed
  };
})();
