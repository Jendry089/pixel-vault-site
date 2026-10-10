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

  // The Spotify homepage cannot be embedded. Replace the broken full-site iframe with a clear launcher/search form.
  function repairSpotifyFrame(frame) {
    if (!frame || frame.dataset.pvReplaced === 'yes') return;
    var src = frame.getAttribute('src') || '';
    if (!/^https:\/\/open\.spotify\.com\/?(?:[?#].*)?$/.test(src)) return;
    frame.dataset.pvReplaced = 'yes';
    var card = document.createElement('div');
    card.className = 'pv-spotify-launcher';
    card.style.cssText = 'padding:24px;min-height:300px;border:1px solid #29486d;border-radius:14px;background:linear-gradient(145deg,#10243a,#081321);color:#eaf3ff;font-family:system-ui,sans-serif;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px';
    card.innerHTML = '<h3 style="font-size:22px;font-weight:900;margin:0">Spotify</h3><p style="max-width:520px;color:#a9c0df;margin:0">Spotify blocks its full website from being embedded here. Search or open Spotify in this tab instead.</p><form class="pv-spotify-launch-form" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:100%;max-width:520px"><input aria-label="Search Spotify" placeholder="Songs, artists, albums or playlists" required style="flex:1;min-width:180px;padding:12px;border:1px solid #35547c;border-radius:9px;background:#061020;color:white;font:inherit"><button type="submit" style="padding:12px 16px;border:0;border-radius:9px;background:#347ee1;color:white;font-weight:800;cursor:pointer">Search Spotify</button></form><button type="button" class="pv-spotify-open" style="padding:10px 15px;border:1px solid #42658c;border-radius:9px;background:#122b45;color:white;font-weight:800;cursor:pointer">Open Spotify</button>';
    frame.replaceWith(card);
    card.querySelector('form').addEventListener('submit', function (event) {
      event.preventDefault();
      var q = card.querySelector('input').value.trim();
      if (q) window.location.assign('https://open.spotify.com/search/' + encodeURIComponent(q));
    });
    card.querySelector('.pv-spotify-open').addEventListener('click', function () {
      window.location.assign('https://open.spotify.com/');
    });
  }
  function scanSpotify() {
    document.querySelectorAll('iframe[src^="https://open.spotify.com/"]').forEach(function (frame) {
      var src = frame.getAttribute('src') || '';
      if (/^https:\/\/open\.spotify\.com\/?(?:[?#].*)?$/.test(src)) repairSpotifyFrame(frame);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scanSpotify);
  else scanSpotify();
  var observer = new MutationObserver(scanSpotify);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

  // Make Spotify searches in the floating Vault Tools panel explicitly same-tab.
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || form.id !== 'pvx-spotify-form') return;
    var input = form.querySelector('#pvx-spotify-query');
    var q = input ? input.value.trim() : '';
    if (!q) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    window.location.assign('https://open.spotify.com/search/' + encodeURIComponent(q));
  }, true);
})();