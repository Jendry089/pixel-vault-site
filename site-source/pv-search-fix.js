/* Pixel Vault external-search compatibility fix */
(function () {
  'use strict';
  if (window.__PV_SEARCH_NAV_FIX__) return;
  window.__PV_SEARCH_NAV_FIX__ = true;

  function tabFor(node) { return node && node.closest ? node.closest('.tab-content') : null; }
  function tabTitle(tab) {
    var el = tab && tab.querySelector('.tab-title');
    return el ? (el.textContent || '').trim().toLowerCase() : '';
  }
  function queryIn(tab) {
    var input = tab && tab.querySelector('.search-bar-big input');
    return input ? input.value.trim() : '';
  }
  function navigateSearch(tab) {
    var title = tabTitle(tab), q = queryIn(tab);
    if (!q) return false;
    if (title.indexOf('youtube search') !== -1) {
      window.location.assign('https://www.youtube.com/results?search_query=' + encodeURIComponent(q));
      return true;
    }
    if (title.indexOf('web search') !== -1) {
      window.location.assign('https://duckduckgo.com/?q=' + encodeURIComponent(q));
      return true;
    }
    return false;
  }

  // Capture before the bundled React handlers start scraping proxy sites or opening results in an iframe.
  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest && event.target.closest('.search-go-btn');
    if (!button) return;
    var tab = tabFor(button);
    if (!tab) return;
    var title = tabTitle(tab);
    if (title.indexOf('youtube search') === -1 && title.indexOf('web search') === -1) return;
    if (!queryIn(tab)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    navigateSearch(tab);
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return;
    var input = event.target;
    if (!input || !input.matches || !input.matches('.search-bar-big input')) return;
    var tab = tabFor(input);
    if (!tab) return;
    var title = tabTitle(tab);
    if (title.indexOf('youtube search') === -1 && title.indexOf('web search') === -1) return;
    if (!input.value.trim()) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    navigateSearch(tab);
  }, true);


})();