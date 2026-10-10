/* Pixel Vault search compatibility and in-page YouTube search */
(function () {
  'use strict';
  if (window.__PV_SEARCH_NAV_FIX__) return;
  window.__PV_SEARCH_NAV_FIX__ = true;
  var YOUTUBE_PROXY = 'https://pixel-vault-search.hendryjavier26.workers.dev/api/youtube';
  var CSS_ID = 'pv-youtube-search-style';

  function tabFor(node) { return node && node.closest ? node.closest('.tab-content') : null; }
  function tabTitle(tab) {
    var el = tab && tab.querySelector('.tab-title');
    return el ? (el.textContent || '').trim().toLowerCase() : '';
  }
  function queryIn(tab) {
    var input = tab && tab.querySelector('.search-bar-big input');
    return input ? input.value.trim() : '';
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function ensureStyle() {
    if (document.getElementById(CSS_ID)) return;
    var style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = [
      '.pvyt-results{margin:18px 0 0;width:100%;color:inherit}',
      '.pvyt-panel{padding:14px;margin:10px 0;border:1px solid #42618a;border-radius:14px;background:rgba(8,20,38,.94);color:#eef5ff}',
      '.pvyt-muted{font-size:12px;line-height:1.5;opacity:.8;margin:7px 0}',
      '.pvyt-config{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}',
      '.pvyt-config input{flex:1;min-width:180px;padding:10px;border:1px solid #58749a;border-radius:9px;background:#071225;color:#fff}',
      '.pvyt-btn{display:inline-block;border:0;border-radius:9px;background:#347ee1;color:#fff;padding:9px 12px;font-weight:800;cursor:pointer;text-decoration:none}',
      '.pvyt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px}',
      '.pvyt-item{min-width:0;padding:10px;border:1px solid #2b4567;border-radius:12px;background:rgba(14,32,56,.95)}',
      '.pvyt-thumb{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:#061020}',
      '.pvyt-item h3{font-size:14px;line-height:1.4;margin:9px 0 4px;overflow-wrap:anywhere}',
      '.pvyt-item p{font-size:12px;line-height:1.45;opacity:.8;margin:4px 0 10px}',
      '.pvyt-player{margin-top:14px;aspect-ratio:16/9;width:100%;background:#000;border-radius:12px;overflow:hidden}',
      '.pvyt-player iframe{width:100%;height:100%;border:0}',
      '.pvyt-status{margin:10px 0;font-size:13px;line-height:1.5}',
      '@media(max-width:520px){.pvyt-grid{grid-template-columns:1fr}.pvyt-config input{min-width:100%}}'
    ].join('');
    document.head.appendChild(style);
  }
  function getResults(tab) {
    var box = tab.querySelector('.pvyt-results');
    if (!box) {
      box = document.createElement('section');
      box.className = 'pvyt-results';
      box.setAttribute('aria-label', 'YouTube search results');
      var search = tab.querySelector('.search-bar-big');
      if (search && search.parentNode) search.parentNode.insertBefore(box, search.nextSibling);
      else tab.appendChild(box);
    }
    return box;
  }
  function showSetup(box, message) {
    box.innerHTML = '<div class="pvyt-panel"><strong>YouTube Search</strong>' +
      '<p class="pvyt-muted">' + esc(message || 'YouTube search is not configured on the server yet.') + '</p>' +
      '<p class="pvyt-muted">Pixel Vault sends searches to its fixed, protected search endpoint. The API key is kept on the server and is not stored in this browser.</p>' +
      '<div class="pvyt-config"><button class="pvyt-btn" type="button" data-pvyt-open>Open YouTube search in this tab</button></div>' +
      '<div class="pvyt-status" role="status"></div></div>';
    box.querySelector('[data-pvyt-open]').addEventListener('click', function () {
      var tab = box.closest('.tab-content'), q = queryIn(tab);
      if (q) location.assign('https://www.youtube.com/results?search_query=' + encodeURIComponent(q));
      else location.assign('https://www.youtube.com/');
    });
  }
  async function searchYouTube(tab) {
    var q = queryIn(tab);
    if (!q) return;
    ensureStyle();
    var box = getResults(tab);
    box.innerHTML = '<div class="pvyt-panel"><div class="pvyt-status" role="status">Searching YouTube…</div><div class="pvyt-grid"></div><div class="pvyt-player" hidden></div></div>';
    var status = box.querySelector('.pvyt-status'), grid = box.querySelector('.pvyt-grid'), player = box.querySelector('.pvyt-player');
    try {
      var response = await fetch(YOUTUBE_PROXY + '?q=' + encodeURIComponent(q), { method: 'GET', credentials: 'omit' });
      var data = await response.json();
      if (!response.ok) {
        var apiMessage = data && typeof data.error === 'string' ? data.error : (data && data.error && data.error.message ? data.error.message : 'YouTube search request failed.');
        if (response.status === 400 || response.status === 403) apiMessage += ' Check the key, YouTube Data API v3, and website/API restrictions.';
        throw new Error(apiMessage);
      }
      var items = (data.items || []).filter(function (item) { return item.id && item.id.videoId && item.snippet; });
      if (!items.length) { status.textContent = 'No embeddable videos found for “' + q + '”.'; return; }
      status.textContent = 'Results for “' + q + '” · ' + items.length + ' videos';
      grid.innerHTML = items.map(function (item) {
        var sn = item.snippet || {}, id = item.id.videoId;
        var thumb = sn.thumbnails && ((sn.thumbnails.medium && sn.thumbnails.medium.url) || (sn.thumbnails.default && sn.thumbnails.default.url));
        return '<article class="pvyt-item"><img class="pvyt-thumb" loading="lazy" alt="" src="' + esc(thumb || '') + '">' +
          '<h3>' + esc(sn.title || 'Untitled video') + '</h3><p>' + esc(sn.channelTitle || 'YouTube') + '</p>' +
          '<div class="pvyt-config"><button class="pvyt-btn" type="button" data-pvyt-play="' + esc(id) + '">Play here</button>' +
          '<a class="pvyt-btn" href="https://www.youtube.com/watch?v=' + encodeURIComponent(id) + '" target="_blank" rel="noopener">YouTube</a></div></article>';
      }).join('');
      grid.querySelectorAll('[data-pvyt-play]').forEach(function (button) {
        button.addEventListener('click', function () {
          var id = button.getAttribute('data-pvyt-play');
          player.hidden = false;
          player.innerHTML = '<iframe title="YouTube video player" src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
          player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      });
    } catch (error) {
      status.textContent = (error && error.message ? error.message : 'Search failed.') + ' If the network blocks Google APIs or YouTube embeds, Pixel Vault cannot override that restriction.';
      var fallback = document.createElement('button');
      fallback.type = 'button'; fallback.className = 'pvyt-btn'; fallback.textContent = 'Open YouTube search in this tab';
      fallback.addEventListener('click', function () { location.assign('https://www.youtube.com/results?search_query=' + encodeURIComponent(q)); });
      status.appendChild(document.createTextNode(' ')); status.appendChild(fallback);
    }
  }
  function navigateWebSearch(tab) {
    var q = queryIn(tab);
    if (q) location.assign('https://duckduckgo.com/?q=' + encodeURIComponent(q));
  }
  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest && event.target.closest('.search-go-btn');
    if (!button) return;
    var tab = tabFor(button);
    if (!tab) return;
    var title = tabTitle(tab);
    if (title.indexOf('youtube search') !== -1) {
      event.preventDefault(); event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      searchYouTube(tab);
    } else if (title.indexOf('web search') !== -1) {
      if (!queryIn(tab)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      navigateWebSearch(tab);
    }
  }, true);
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return;
    var input = event.target;
    if (!input || !input.matches || !input.matches('.search-bar-big input')) return;
    var tab = tabFor(input);
    if (!tab) return;
    var title = tabTitle(tab);
    if (title.indexOf('youtube search') !== -1) {
      event.preventDefault(); event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      searchYouTube(tab);
    } else if (title.indexOf('web search') !== -1) {
      if (!queryIn(tab)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      navigateWebSearch(tab);
    }
  }, true);
})();