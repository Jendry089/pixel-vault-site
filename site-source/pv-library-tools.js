/* Pixel Vault: local game/movie library + centered loader polish */
(function () {
  'use strict';
  if (window.__PV_LIBRARY_TOOLS__) return;
  window.__PV_LIBRARY_TOOLS__ = true;

  var DB_NAME = 'pixel-vault-local-library';
  var DB_VERSION = 1;
  var STORE = 'files';
  var MAX_IMPORT_BYTES = 1610612736;
  var dbPromise;

  function makeId() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() :
      ('pvl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
  }
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('This browser does not support local library storage.')); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Could not open local storage.')); };
      req.onblocked = function () { reject(new Error('Local storage is busy in another Pixel Vault tab. Close the other tab and try again.')); };
    });
    return dbPromise;
  }
  function getAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly'), req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error || new Error('Could not read the library.')); };
      });
    });
  }
  function putMany(items) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE);
        items.forEach(function (item) { store.put(item); });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('Browser storage is full or unavailable.')); };
        tx.onabort = function () { reject(tx.error || new Error('Import was cancelled by browser storage.')); };
      });
    });
  }
  function removeGroup(groupId) {
    return getAll().then(function (items) {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE);
          items.filter(function (item) { return item.groupId === groupId; }).forEach(function (item) { store.delete(item.id); });
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { reject(tx.error || new Error('Could not remove the item.')); };
        });
      });
    });
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtBytes(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
  function baseName(path) {
    return String(path || 'Untitled').replace(/\\/g, '/').split('/').pop() || 'Untitled';
  }
  function normPath(path) {
    var out = [];
    String(path || '').replace(/\\/g, '/').split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') out.pop(); else out.push(part);
    });
    return out.join('/');
  }
  function isHTML(file) { return /\.html?$/i.test(file.name || ''); }
  function filePath(file) { return normPath(file.webkitRelativePath || file.name || 'file'); }

  var css = [
    '#pvl-launch{position:fixed;left:16px;bottom:16px;z-index:2147483001;border:1px solid #6b8cff;background:linear-gradient(135deg,#182f5b,#35206a);color:#f3f6ff;border-radius:14px;padding:12px 16px;font:800 13px system-ui;box-shadow:0 8px 30px #0009;cursor:pointer}',
    '#pvl-panel{position:fixed;left:12px;bottom:68px;z-index:2147483001;width:min(520px,calc(100vw - 24px));max-height:82vh;overflow:auto;background:linear-gradient(145deg,#081426,#101a34 65%,#16132d);color:#edf3ff;border:1px solid #46679d;border-radius:18px;box-shadow:0 18px 60px #000c;font:14px system-ui;display:none}',
    '#pvl-panel *{box-sizing:border-box}#pvl-panel button,#pvl-stage button{font:inherit;cursor:pointer}',
    '.pvl-head{position:sticky;top:0;z-index:3;background:#0b1930ee;backdrop-filter:blur(14px);padding:14px;border-bottom:1px solid #29436a;display:flex;align-items:center;justify-content:space-between;gap:12px}',
    '.pvl-head strong{letter-spacing:.07em;font-size:13px}.pvl-close{background:#182d4b;border:1px solid #35547c;color:white;border-radius:9px;padding:7px 10px}',
    '.pvl-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 12px 4px}.pvl-tab{border:1px solid #304a72;background:#0d203a;color:#bbcff0;border-radius:10px;padding:10px;font-weight:800}.pvl-tab[aria-selected=true]{background:linear-gradient(135deg,#2c7ee8,#6a4ce8);color:white;border-color:#8ebaff}',
    '.pvl-content{padding:12px 14px 16px}.pvl-note{font-size:12px;line-height:1.55;color:#a8bbda;margin:6px 0 12px}.pvl-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.pvl-action{border:1px solid #5184cb;background:linear-gradient(135deg,#2475d7,#5645bd);color:white;padding:9px 12px;border-radius:10px;font-weight:800}.pvl-action.secondary{background:#132844;border-color:#35527b;color:#dceaff}.pvl-hidden-input{display:none!important}',
    '.pvl-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px}.pvl-card{min-width:0;background:linear-gradient(145deg,#102441,#101b30);border:1px solid #29476d;border-radius:13px;padding:12px}.pvl-card strong{display:block;overflow-wrap:anywhere;line-height:1.35}.pvl-card small{display:block;color:#a9bddb;margin:6px 0 10px;line-height:1.4}.pvl-card-actions{display:flex;gap:7px;flex-wrap:wrap}.pvl-card-actions button{font-size:12px!important;padding:7px 9px!important}.pvl-empty{border:1px dashed #385477;border-radius:12px;padding:18px;color:#afc1dc;text-align:center;line-height:1.5}.pvl-status{font-size:12px;line-height:1.5;color:#b4c7e5;min-height:18px;margin-top:9px}.pvl-status.error{color:#ffb7ad}.pvl-status.good{color:#a9f1c2}',
    '#pvl-stage[hidden]{display:none!important}#pvl-stage{position:fixed;inset:0;z-index:2147483002;background:#040812;color:#eef5ff;display:flex;flex-direction:column;font:14px system-ui}#pvl-stage .pvl-stage-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:#09152a;border-bottom:1px solid #2d466a;min-height:54px}#pvl-stage .pvl-stage-title{font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:100px}#pvl-stage .pvl-stage-bar button{border:1px solid #456b9c;background:#142b4a;color:white;padding:8px 11px;border-radius:9px;font-weight:800}#pvl-stage .pvl-stage-content{flex:1;min-height:0;display:flex;align-items:stretch;justify-content:center;background:#000}#pvl-stage iframe,#pvl-stage video{display:block;width:100%;height:100%;border:0;background:#000;object-fit:contain}',
    '@media(max-width:520px){#pvl-launch{left:10px;bottom:10px;padding:11px 12px}#pvl-panel{left:8px;bottom:58px;width:calc(100vw - 16px);max-height:84vh}.pvl-list{grid-template-columns:1fr}#pvl-stage .pvl-stage-bar{gap:7px;padding:8px}#pvl-stage .pvl-stage-bar button{padding:7px 9px}}',
    '@keyframes pvl-spin{to{transform:rotate(360deg)}}@keyframes pvl-petal-fall{0%{transform:translateY(-8vh) rotate(0deg);opacity:0}15%{opacity:.8}100%{transform:translateY(110vh) rotate(420deg);opacity:0}}',
    '.pvl-loader-polished{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;height:100svh!important;min-height:100vh!important;margin:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;transform:none!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:15px!important;text-align:center!important;padding:clamp(24px,6vw,76px)!important;overflow:hidden!important;z-index:2147482000!important;color:#eff6ff!important;background:radial-gradient(ellipse at 50% 38%,#1c3869 0%,#101b39 38%,#070b19 76%,#03060f 100%)!important}',
    '.pvl-loader-polished>*{position:relative;z-index:2;margin-left:auto!important;margin-right:auto!important;text-align:center!important;max-width:min(780px,94vw)}.pvl-loader-polished h1,.pvl-loader-polished h2{font-weight:950!important;letter-spacing:.12em!important;text-transform:uppercase!important;text-shadow:0 0 24px #5595ff99!important}.pvl-loader-polished [class*=progress],.pvl-loader-polished progress{margin-left:auto!important;margin-right:auto!important}',
    '.pvl-loader-polished:before{content:"";position:absolute;inset:clamp(16px,4vw,48px);border:1px solid #7bacff33;border-radius:24px;box-shadow:inset 0 0 70px #327dff0c,0 0 60px #2875ef10;pointer-events:none}',
    '.pvl-load-orbit{position:absolute!important;z-index:1!important;left:50%!important;top:32%!important;width:clamp(110px,17vw,172px)!important;aspect-ratio:1!important;border:1px solid #83b6ff55!important;border-radius:50%!important;transform:translate(-50%,-50%)!important;pointer-events:none!important;box-shadow:0 0 45px #347ce933,inset 0 0 28px #3579d822!important}',
    '.pvl-load-orbit:before,.pvl-load-orbit:after{content:"";position:absolute;border-radius:50%;inset:13%;border:3px solid transparent;border-top-color:#8fc8ff;border-right-color:#5d86ff;animation:pvl-spin 2.4s linear infinite;box-shadow:0 0 16px #63a7ff66}',
    '.pvl-load-orbit:after{inset:29%;border-top-color:#e0bfff;border-right-color:#8e72ff;animation-direction:reverse;animation-duration:1.7s}',
    '.pvl-load-petal{position:absolute!important;z-index:1!important;top:-5vh!important;width:9px!important;height:20px!important;border-radius:80% 15% 80% 15%!important;background:linear-gradient(145deg,#bbd9ff,#8e79ff)!important;opacity:0;pointer-events:none!important;animation:pvl-petal-fall 7s linear infinite!important;box-shadow:0 0 12px #6a9fff55}'
  ].join('\n');

  function mountLibrary() {
    if (!document.body || document.getElementById('pvl-panel')) return;
    var style = document.createElement('style'); style.id = 'pvl-library-style'; style.textContent = css; document.head.appendChild(style);
    var launch = document.createElement('button'); launch.id = 'pvl-launch'; launch.type = 'button'; launch.textContent = '+ My Library'; launch.setAttribute('aria-expanded', 'false');
    var panel = document.createElement('section'); panel.id = 'pvl-panel'; panel.setAttribute('aria-label', 'My local games and movies');
    panel.innerHTML = '<div class="pvl-head"><strong>PIXEL VAULT · MY LIBRARY</strong><button class="pvl-close" type="button" data-pvl-close-panel>Close ×</button></div>' +
      '<div class="pvl-tabs" role="tablist"><button class="pvl-tab" type="button" data-pvl-tab="games" aria-selected="true">My Games</button><button class="pvl-tab" type="button" data-pvl-tab="movies" aria-selected="false">My Movies</button></div>' +
      '<div class="pvl-content"><div class="pvl-note" id="pvl-instructions">Import HTML games as individual files or choose a whole folder to include images, scripts, audio, and styles. Imports stay in this browser on this device.</div>' +
      '<div class="pvl-actions"><button class="pvl-action" type="button" id="pvl-pick-game">＋ Add game files</button><button class="pvl-action secondary" type="button" id="pvl-pick-folder">＋ Add game folder</button><button class="pvl-action" type="button" id="pvl-pick-movie" hidden>＋ Add movie files</button></div>' +
      '<input id="pvl-game-input" class="pvl-hidden-input" type="file" multiple accept=".html,.htm,.js,.mjs,.css,.json,.wasm,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp3,.ogg,.wav,.m4a,.mp4,.webm,.woff,.woff2,.ttf,.xml,.txt">' +
      '<input id="pvl-folder-input" class="pvl-hidden-input" type="file" multiple webkitdirectory directory>' +
      '<input id="pvl-movie-input" class="pvl-hidden-input" type="file" multiple accept="video/*,.mp4,.webm,.m4v,.mov,.ogv">' +
      '<div id="pvl-status" class="pvl-status" role="status"></div><div id="pvl-list" class="pvl-list"></div>' +
      '<p class="pvl-note">Local imports are private to this browser profile and are not uploaded to the public site. Large imports depend on available device storage. Folder games work best when their HTML uses ordinary relative file paths; some games that require server-side features may not run locally.</p></div>';
    var stage = document.createElement('div'); stage.id = 'pvl-stage'; stage.hidden = true; stage.setAttribute('role', 'dialog'); stage.setAttribute('aria-modal', 'true'); stage.setAttribute('aria-label', 'Local game or movie player');
    stage.innerHTML = '<div class="pvl-stage-bar"><strong class="pvl-stage-title" id="pvl-stage-title">My Library</strong><button type="button" data-pvl-fullscreen>Fullscreen</button><button type="button" data-pvl-close-stage>Back to library</button></div><div class="pvl-stage-content" id="pvl-stage-content"></div>';
    document.body.appendChild(launch); document.body.appendChild(panel); document.body.appendChild(stage);

    var currentTab = 'games', currentObjectUrls = [];
    var list = panel.querySelector('#pvl-list'), status = panel.querySelector('#pvl-status');
    function setStatus(text, kind) { status.textContent = text || ''; status.className = 'pvl-status' + (kind ? ' ' + kind : ''); }
    function switchTab(tab) {
      currentTab = tab;
      panel.querySelectorAll('[data-pvl-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-pvl-tab') === tab)); });
      panel.querySelector('#pvl-pick-game').hidden = tab !== 'games';
      panel.querySelector('#pvl-pick-folder').hidden = tab !== 'games';
      panel.querySelector('#pvl-pick-movie').hidden = tab !== 'movies';
      panel.querySelector('#pvl-instructions').textContent = tab === 'games' ?
        'Import HTML games as files, or choose a whole folder to include images, scripts, audio, and styles. Imports stay in this browser on this device.' :
        'Add video files to play them here with controls. Movie files stay in this browser on this device and are not uploaded.';
      renderList();
    }
    function renderList() {
      setStatus('');
      getAll().then(function (items) {
        var chosen = items.filter(function (item) { return item.kind === (currentTab === 'games' ? 'game' : 'movie'); });
        chosen.sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
        if (!chosen.length) {
          list.innerHTML = '<div class="pvl-empty">Nothing here yet.<br>Use the add button above to import your own ' + (currentTab === 'games' ? 'HTML game files or a whole game folder' : 'movie/video files') + '.</div>';
          return;
        }
        list.innerHTML = chosen.map(function (item) {
          var size = item.groupBytes ? fmtBytes(item.groupBytes) : fmtBytes(item.size || 0);
          var title = item.displayName || item.name || 'Untitled';
          var tag = currentTab === 'games' ? 'HTML game · ' + (item.path || item.name) : 'Video · ' + size;
          return '<article class="pvl-card"><strong>' + esc(title) + '</strong><small>' + esc(tag) + (currentTab === 'games' ? ' · ' + size : '') + '</small><div class="pvl-card-actions">' +
            '<button type="button" class="pvl-action" data-pvl-play="' + esc(item.id) + '">' + (currentTab === 'games' ? 'Play game' : 'Watch movie') + '</button>' +
            '<button type="button" class="pvl-action secondary" data-pvl-remove="' + esc(item.groupId) + '">Remove</button></div></article>';
        }).join('');
      }).catch(function (e) {
        list.innerHTML = '<div class="pvl-empty">Local library unavailable: ' + esc(e.message || e) + '</div>';
      });
    }
    function collectFiles(input) {
      var files = Array.prototype.slice.call(input.files || []);
      input.value = '';
      return files;
    }
    function importGames(files) {
      if (!files.length) return;
      var htmlFiles = files.filter(isHTML);
      if (!htmlFiles.length) { setStatus('Choose at least one .html or .htm game entry file. For assets, select the entire game folder.', 'error'); return; }
      var total = files.reduce(function (n, f) { return n + (f.size || 0); }, 0);
      if (total > MAX_IMPORT_BYTES) { setStatus('This import is larger than 1.5 GB. Split the game folder into smaller imports.', 'error'); return; }
      var groupId = makeId(), now = Date.now();
      var records = files.map(function (file) {
        var path = filePath(file), entry = isHTML(file);
        return { id: makeId(), groupId: groupId, kind: entry ? 'game' : 'asset', name: baseName(path),
          displayName: baseName(path), path: path, type: file.type || '', size: file.size || 0, groupBytes: total,
          addedAt: now, blob: file };
      });
      setStatus('Importing ' + files.length + ' file(s)…');
      putMany(records).then(function () {
        setStatus('Imported ' + htmlFiles.length + ' game entry/entries and ' + (files.length - htmlFiles.length) + ' supporting file(s).', 'good');
        renderList();
      }).catch(function (e) { setStatus((e.message || 'Import failed') + ' Check available browser storage and try fewer files.', 'error'); });
    }
    function importMovies(files) {
      if (!files.length) return;
      var nonVideo = files.filter(function (file) { return !(/^video\//i.test(file.type) || /\.(mp4|webm|m4v|mov|ogv|ogg)$/i.test(file.name)); });
      if (nonVideo.length) { setStatus('Some selected files do not look like video files. Choose MP4, WebM, MOV, or another browser-supported video.', 'error'); return; }
      var total = files.reduce(function (n, f) { return n + (f.size || 0); }, 0);
      if (total > MAX_IMPORT_BYTES) { setStatus('This import is larger than 1.5 GB. Add the movies in smaller batches.', 'error'); return; }
      var now = Date.now(), records = files.map(function (file) {
        var groupId = makeId();
        return { id: makeId(), groupId: groupId, kind: 'movie', name: file.name, displayName: file.name, path: file.name,
          type: file.type || 'video/mp4', size: file.size || 0, groupBytes: file.size || 0, addedAt: now, blob: file };
      });
      setStatus('Adding ' + files.length + ' video file(s)…');
      putMany(records).then(function () { setStatus('Added ' + files.length + ' movie/video file(s).', 'good'); renderList(); })
        .catch(function (e) { setStatus((e.message || 'Import failed') + ' Check available browser storage and try fewer files.', 'error'); });
    }
    function closeStage() {
      stage.hidden = true;
      stage.querySelector('#pvl-stage-content').innerHTML = '';
      currentObjectUrls.forEach(function (url) { try { URL.revokeObjectURL(url); } catch (_) {} });
      currentObjectUrls = [];
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      launch.focus();
    }
    function stageOpen(title) {
      stage.querySelector('#pvl-stage-title').textContent = title || 'My Library';
      stage.querySelector('#pvl-stage-content').innerHTML = '';
      stage.hidden = false;
      return stage.querySelector('#pvl-stage-content');
    }
    function addUrl(blob) { var u = URL.createObjectURL(blob); currentObjectUrls.push(u); return u; }
    function rewriteCss(source, fromPath, lookup) {
      return source.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, function (whole, quote, value) {
        var raw = String(value || '').trim();
        if (!raw || /^(?:data:|https?:|blob:|\/\/|#|about:|javascript:)/i.test(raw)) return whole;
        var key = resolvePath(fromPath, raw), found = lookup[key.toLowerCase()] || lookup[baseName(key).toLowerCase()];
        return found ? 'url("' + found + '")' : whole;
      }).replace(/@import\s+(["'])([^"']+)\1/gi, function (whole, quote, value) {
        if (/^(?:data:|https?:|blob:|\/\/|#)/i.test(value)) return whole;
        var key = resolvePath(fromPath, value), found = lookup[key.toLowerCase()] || lookup[baseName(key).toLowerCase()];
        return found ? '@import "' + found + '"' : whole;
      });
    }
    function resolvePath(fromPath, reference) {
      var raw = String(reference || '').split(/[?#]/)[0].replace(/\\/g, '/');
      try { raw = raw.split('/').map(function (part) { return decodeURIComponent(part); }).join('/'); } catch (_) {}
      if (!raw) return '';
      var stack = raw.charAt(0) === '/' ? [] : normPath(fromPath).split('/');
      if (raw.charAt(0) !== '/') stack.pop();
      raw.split('/').forEach(function (part) {
        if (!part || part === '.') return;
        if (part === '..') stack.pop(); else stack.push(part);
      });
      return stack.join('/');
    }
    function launchGame(id) {
      getAll().then(function (items) {
        var entry = items.find(function (x) { return x.id === id && x.kind === 'game'; });
        if (!entry) throw new Error('That game is no longer in the library.');
        var group = items.filter(function (x) { return x.groupId === entry.groupId; });
        var lookup = Object.create(null);
        group.forEach(function (x) {
          var rawUrl = addUrl(x.blob);
          lookup[normPath(x.path).toLowerCase()] = rawUrl;
          if (!lookup[baseName(x.path).toLowerCase()]) lookup[baseName(x.path).toLowerCase()] = rawUrl;
        });
        var cssRecords = group.filter(function (x) { return /\.css$/i.test(x.path); });
        var cssWork = cssRecords.map(function (x) {
          return x.blob.text().then(function (source) {
            var oldUrl = lookup[normPath(x.path).toLowerCase()];
            var newUrl = addUrl(new Blob([rewriteCss(source, x.path, lookup)], { type: 'text/css' }));
            lookup[normPath(x.path).toLowerCase()] = newUrl;
            if (lookup[baseName(x.path).toLowerCase()] === oldUrl) lookup[baseName(x.path).toLowerCase()] = newUrl;
          });
        });
        return Promise.all(cssWork).then(function () { return entry.blob.text(); }).then(function (html) {
          html = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, function (whole, start, body, end) {
            return start + rewriteCss(body, entry.path, lookup) + end;
          });
          html = html.replace(/\b(src|href|poster|data)\s*=\s*(["'])(.*?)\2/gi, function (whole, attr, quote, value) {
            var raw = String(value || '').trim();
            if (!raw || /^(?:data:|https?:|blob:|\/\/|#|mailto:|tel:|javascript:|about:)/i.test(raw)) return whole;
            var key = resolvePath(entry.path, raw), found = lookup[key.toLowerCase()] || lookup[baseName(key).toLowerCase()];
            return found ? attr + '=' + quote + found + quote : whole;
          });
          var root = stageOpen(entry.displayName || entry.name);
          var frame = document.createElement('iframe');
          frame.title = entry.displayName || entry.name;
          frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-pointer-lock allow-downloads allow-modals');
          frame.setAttribute('allowfullscreen', 'true');
          frame.setAttribute('referrerpolicy', 'no-referrer');
          frame.src = addUrl(new Blob([html], { type: 'text/html;charset=utf-8' }));
          root.appendChild(frame);
        });
      }).catch(function (e) { setStatus((e.message || 'Could not open game.') + ' Try importing its whole folder.', 'error'); });
    }
    function launchMovie(id) {
      getAll().then(function (items) {
        var movie = items.find(function (x) { return x.id === id && x.kind === 'movie'; });
        if (!movie) throw new Error('That video is no longer in the library.');
        var root = stageOpen(movie.displayName || movie.name);
        var video = document.createElement('video');
        video.controls = true; video.playsInline = true; video.preload = 'metadata';
        video.src = addUrl(movie.blob);
        video.setAttribute('aria-label', movie.displayName || movie.name);
        root.appendChild(video);
      }).catch(function (e) { setStatus(e.message || 'Could not open movie.', 'error'); });
    }

    launch.addEventListener('click', function () {
      var open = panel.style.display !== 'block';
      panel.style.display = open ? 'block' : 'none';
      launch.setAttribute('aria-expanded', String(open));
      if (open) renderList();
    });
    panel.querySelector('[data-pvl-close-panel]').addEventListener('click', function () { panel.style.display = 'none'; launch.setAttribute('aria-expanded', 'false'); });
    panel.querySelectorAll('[data-pvl-tab]').forEach(function (b) { b.addEventListener('click', function () { switchTab(b.getAttribute('data-pvl-tab')); }); });
    panel.querySelector('#pvl-pick-game').addEventListener('click', function () { panel.querySelector('#pvl-game-input').click(); });
    panel.querySelector('#pvl-pick-folder').addEventListener('click', function () { panel.querySelector('#pvl-folder-input').click(); });
    panel.querySelector('#pvl-pick-movie').addEventListener('click', function () { panel.querySelector('#pvl-movie-input').click(); });
    panel.querySelector('#pvl-game-input').addEventListener('change', function (ev) { importGames(collectFiles(ev.target)); });
    panel.querySelector('#pvl-folder-input').addEventListener('change', function (ev) { importGames(collectFiles(ev.target)); });
    panel.querySelector('#pvl-movie-input').addEventListener('change', function (ev) { importMovies(collectFiles(ev.target)); });
    list.addEventListener('click', function (ev) {
      var play = ev.target.closest && ev.target.closest('[data-pvl-play]');
      var remove = ev.target.closest && ev.target.closest('[data-pvl-remove]');
      if (play) {
        var id = play.getAttribute('data-pvl-play');
        if (currentTab === 'movies') launchMovie(id); else launchGame(id);
      } else if (remove) {
        var groupId = remove.getAttribute('data-pvl-remove');
        if (confirm('Remove this imported item and its supporting files from this browser?')) {
          removeGroup(groupId).then(renderList).catch(function (e) { setStatus(e.message || 'Could not remove item.', 'error'); });
        }
      }
    });
    stage.querySelector('[data-pvl-close-stage]').addEventListener('click', closeStage);
    stage.querySelector('[data-pvl-fullscreen]').addEventListener('click', function () {
      if (stage.requestFullscreen) stage.requestFullscreen().catch(function () {});
      else setStatus('Fullscreen is not supported in this browser.', 'error');
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !stage.hidden && !document.fullscreenElement) closeStage();
    });
    switchTab('games');
  }

  function polishLoadingScreen() {
    if (!document.body || !document.head) return;
    var selector = '[id*="load" i],[class*="load" i],[id*="intro" i],[class*="intro" i],[id*="startup" i],[class*="startup" i]';
    var nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
    var chosen = null, chosenScore = -1;
    var phrase = /starting arcade|loading pixel vault|pixel vault could not start|initializing pixel vault|loading\.\.\.|please wait/i;
    nodes.forEach(function (el) {
      if (el.closest && el.closest('#pvl-panel,#pvl-stage')) return;
      var rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      if (!rect.width || !rect.height || style.display === 'none' || style.visibility === 'hidden') return;
      var text = (el.innerText || el.textContent || '').slice(0, 600);
      var ident = ((el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '')).toLowerCase();
      if (!phrase.test(text) && !/(loading|loader|intro|startup)/i.test(ident)) return;
      var area = Math.min(1, (rect.width * rect.height) / Math.max(1, innerWidth * innerHeight));
      var score = area * 10 + (/loading|loader|startup/i.test(ident) ? 5 : 0) + (phrase.test(text) ? 4 : 0);
      if (score > chosenScore) { chosen = el; chosenScore = score; }
    });
    if (!chosen) return;
    var root = chosen, parent = chosen.parentElement, hops = 0;
    while (parent && parent !== document.body && hops++ < 5) {
      var r = parent.getBoundingClientRect(), txt = (parent.innerText || parent.textContent || '').slice(0, 700);
      var ident = ((parent.id || '') + ' ' + (typeof parent.className === 'string' ? parent.className : '')).toLowerCase();
      if ((/(loading|loader|intro|startup)/i.test(ident) || phrase.test(txt)) && r.width >= Math.min(innerWidth * 0.55, 420) && r.height >= Math.min(innerHeight * 0.25, 180)) root = parent;
      parent = parent.parentElement;
    }
    root.classList.add('pvl-loader-polished');
    if (!root.querySelector('.pvl-load-orbit')) {
      var orbit = document.createElement('span'); orbit.className = 'pvl-load-orbit'; orbit.setAttribute('aria-hidden', 'true'); root.appendChild(orbit);
      var decor = document.createElement('span'); decor.setAttribute('aria-hidden', 'true'); decor.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1';
      for (var i = 0; i < 13; i++) {
        var petal = document.createElement('i'); petal.className = 'pvl-load-petal';
        petal.style.left = (4 + (i * 37 % 93)) + '%';
        petal.style.animationDelay = (-((i * 1.13) % 7)) + 's';
        petal.style.animationDuration = (6 + (i % 5)) + 's';
        petal.style.opacity = '.6'; decor.appendChild(petal);
      }
      root.appendChild(decor);
    }
  }
  function init() {
    mountLibrary();
    polishLoadingScreen();
    [350, 900, 1800, 3500, 6000].forEach(function (delay) { setTimeout(polishLoadingScreen, delay); });
    if (document.body && window.MutationObserver) {
      var observer = new MutationObserver(function (mutations) {
        if (mutations.some(function (m) { return m.addedNodes && m.addedNodes.length; })) polishLoadingScreen();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { observer.disconnect(); }, 20000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();