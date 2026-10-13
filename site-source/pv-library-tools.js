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
    '.pvl-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px 12px 4px}.pvl-tab{border:1px solid #304a72;background:#0d203a;color:#bbcff0;border-radius:10px;padding:10px;font-weight:800}.pvl-tab[aria-selected=true]{background:linear-gradient(135deg,#2c7ee8,#6a4ce8);color:white;border-color:#8ebaff}',
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
      '<div class="pvl-tabs" role="tablist"><button class="pvl-tab" type="button" data-pvl-tab="games" aria-selected="true">My Games</button><button class="pvl-tab" type="button" data-pvl-tab="movies" aria-selected="false">My Movies</button><button class="pvl-tab" type="button" data-pvl-tab="catalog" aria-selected="false">Public Catalog</button><button class="pvl-tab" type="button" data-pvl-tab="review" aria-selected="false">Review Queue</button></div>' +
      '<div class="pvl-content"><div class="pvl-note" id="pvl-instructions">Import HTML games as individual files or choose a whole folder to include images, scripts, audio, and styles. Imports stay in this browser on this device.</div>' +
      '<div class="pvl-actions"><button class="pvl-action" type="button" id="pvl-pick-game">＋ Add game files</button><button class="pvl-action secondary" type="button" id="pvl-pick-folder">＋ Add game folder</button><button class="pvl-action" type="button" id="pvl-pick-movie" hidden>＋ Add movie files</button></div>' +
      '<input id="pvl-game-input" class="pvl-hidden-input" type="file" multiple accept=".html,.htm,.js,.mjs,.css,.json,.wasm,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp3,.ogg,.wav,.m4a,.mp4,.webm,.woff,.woff2,.ttf,.xml,.txt">' +
      '<input id="pvl-folder-input" class="pvl-hidden-input" type="file" multiple webkitdirectory directory>' +
      '<input id="pvl-movie-input" class="pvl-hidden-input" type="file" multiple accept="video/*,.mp4,.webm,.m4v,.mov,.ogv">' +
      '<input id="pvl-public-game-zip-input" class="pvl-hidden-input" type="file" accept=".zip,application/zip">' +
      '<input id="pvl-public-movie-input" class="pvl-hidden-input" type="file" accept="video/*,.mp4,.webm,.m4v,.mov,.ogv,.ogg">' +
      '<div id="pvl-status" class="pvl-status" role="status"></div><div id="pvl-list" class="pvl-list"></div>' +
      '<div class="pvl-card" id="pvl-publish-box"><strong>Submit for owner review</strong><small>Anyone can submit a game ZIP or video here. Uploads stay private until you approve them in the owner-only Review Queue.</small><div class="pvl-card-actions"><button type="button" class="pvl-action secondary" id="pvl-upload-games">Submit game ZIP for review</button><button type="button" class="pvl-action secondary" id="pvl-upload-movies">Submit movie for review</button></div></div>' +
      '<p class="pvl-note">Local imports are private to this browser profile and are not uploaded to the public site. Large imports depend on available device storage. Folder games work best when their HTML uses ordinary relative file paths; some games that require server-side features may not run locally.</p></div>';
    var stage = document.createElement('div'); stage.id = 'pvl-stage'; stage.hidden = true; stage.setAttribute('role', 'dialog'); stage.setAttribute('aria-modal', 'true'); stage.setAttribute('aria-label', 'Local game or movie player');
    stage.innerHTML = '<div class="pvl-stage-bar"><strong class="pvl-stage-title" id="pvl-stage-title">My Library</strong><button type="button" data-pvl-fullscreen>Fullscreen</button><button type="button" data-pvl-close-stage>Back to library</button></div><div class="pvl-stage-content" id="pvl-stage-content"></div>';
    document.body.appendChild(launch); document.body.appendChild(panel); document.body.appendChild(stage);

    var currentTab = 'games', currentObjectUrls = [], moderationToken = '';
    var list = panel.querySelector('#pvl-list'), status = panel.querySelector('#pvl-status');
    function setStatus(text, kind) { status.textContent = text || ''; status.className = 'pvl-status' + (kind ? ' ' + kind : ''); }
    function switchTab(tab) {
      currentTab = tab;
      panel.querySelectorAll('[data-pvl-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-pvl-tab') === tab)); });
      panel.querySelector('#pvl-pick-game').hidden = tab !== 'games';
      panel.querySelector('#pvl-pick-folder').hidden = tab !== 'games';
      panel.querySelector('#pvl-pick-movie').hidden = tab !== 'movies';
      panel.querySelector('#pvl-publish-box').hidden = tab === 'catalog' || tab === 'review';
      panel.querySelector('#pvl-instructions').textContent = tab === 'games' ?
        'Add HTML game files or an entire folder with supporting assets. Imports stay private until submitted for owner review.' :
        (tab === 'movies' ?
          'Add video files to play here. Submit a movie for owner review to ask for a place in the Public Catalog.' :
          (tab === 'catalog' ?
            'The Public Catalog is visible to every visitor. Only submissions approved by the owner appear here.' :
            'Private owner-only queue. Enter your moderation password to review submissions, then approve or reject each one.'));
      if (tab === 'catalog') renderPublicCatalog();
      else if (tab === 'review') renderReviewQueue();
      else renderList();
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
            (currentTab === 'games' ? '<button type="button" class="pvl-action secondary" data-pvl-export="' + esc(item.id) + '">Submit for review</button>' : '<button type="button" class="pvl-action secondary" data-pvl-public-download="' + esc(item.id) + '">Submit for review</button>') +
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

    function safeSlug(value) {
      return String(value || 'pixel-vault-game').toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 44) || 'pixel-vault-game';
    }
    function crc32(bytes) {
      var crc = -1;
      for (var i = 0; i < bytes.length; i++) {
        crc ^= bytes[i];
        for (var j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
      return (crc ^ -1) >>> 0;
    }
    function makeStoredZip(entries) {
      return Promise.all(entries.map(function (entry) {
        var name = normPath(entry.name);
        return entry.blob.arrayBuffer().then(function (buffer) {
          return { name: name, nameBytes: new TextEncoder().encode(name), bytes: new Uint8Array(buffer) };
        });
      })).then(function (prepared) {
        var parts = [], central = [], offset = 0, centralSize = 0;
        prepared.forEach(function (entry) {
          if (!entry.name || entry.name.charAt(0) === '/' || entry.name.split('/').some(function (p) { return p === '..'; })) {
            throw new Error('A game asset has an unsafe path and cannot be exported.');
          }
          var checksum = crc32(entry.bytes), nameBytes = entry.nameBytes, local = new Uint8Array(30 + nameBytes.length);
          var lv = new DataView(local.buffer);
          lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
          lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0, true);
          lv.setUint32(14, checksum, true); lv.setUint32(18, entry.bytes.length, true); lv.setUint32(22, entry.bytes.length, true);
          lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true); local.set(nameBytes, 30);
          parts.push(local, entry.bytes);
          var header = new Uint8Array(46 + nameBytes.length), cv = new DataView(header.buffer);
          cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
          cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
          cv.setUint32(16, checksum, true); cv.setUint32(20, entry.bytes.length, true); cv.setUint32(24, entry.bytes.length, true);
          cv.setUint16(28, nameBytes.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
          cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
          header.set(nameBytes, 46); central.push(header); centralSize += header.length; offset += local.length + entry.bytes.length;
        });
        var end = new Uint8Array(22), ev = new DataView(end.buffer);
        ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
        ev.setUint16(8, prepared.length, true); ev.setUint16(10, prepared.length, true);
        ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
        return new Blob(parts.concat(central, [end]), { type: 'application/zip' });
      });
    }
    function triggerDownload(blob, filename) {
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = filename; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    }
    function submitForReview(kind, filename, blob) {
      if (!blob || !blob.size) { setStatus('Choose a non-empty file to submit.', 'error'); return; }
      if (blob.size > 20 * 1024 * 1024) {
        setStatus('This file is larger than 20 MB. Submissions can be up to 20 MB.', 'error');
        return;
      }
      setStatus('Sending to the private review queue…');
      var endpoint = 'https://pixel-vault-search.hendryjavier26.workers.dev/api/submit?' +
        new URLSearchParams({ kind: kind, name: baseName(filename) }).toString();
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': kind === 'games' ? 'application/zip' : (blob.type || 'application/octet-stream') },
        body: blob,
        credentials: 'omit'
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok || !data.ok) throw new Error(data.error || ('Submission failed (HTTP ' + response.status + ').'));
          setStatus('Submitted successfully. It is private and will not appear publicly unless the owner approves it.', 'good');
        });
      }).catch(function (error) {
        var message = error && error.message ? error.message : '';
        if (/failed to fetch|networkerror|load failed/i.test(message)) {
          setStatus('Could not reach the private submission service from this network. Nothing was submitted.', 'error');
        } else setStatus(message || 'Submission failed. Please try again.', 'error');
      });
    }
    function exportGamePackage(id) {
      setStatus('Preparing a ZIP for public publishing…');
      getAll().then(function (items) {
        var entry = items.find(function (x) { return x.id === id && x.kind === 'game'; });
        if (!entry) throw new Error('That game is no longer in your local library.');
        var group = items.filter(function (x) { return x.groupId === entry.groupId && (x.kind === 'game' || x.kind === 'asset'); });
        var total = group.reduce(function (n, x) { return n + (x.size || (x.blob && x.blob.size) || 0); }, 0);
        if (total > 20 * 1024 * 1024) throw new Error('This game is larger than 20 MB. Reduce its assets before submitting for review.');
        if (!group.some(function (x) { return normPath(x.path).toLowerCase() === normPath(entry.path).toLowerCase(); })) {
          throw new Error('The main HTML file is missing from its game folder.');
        }
        var packageName = safeSlug(entry.displayName || entry.name) + '-' + makeId().slice(-6).replace(/[^a-z0-9]/gi, '').toLowerCase();
        var manifest = new Blob([JSON.stringify({
          name: String(entry.displayName || entry.name || 'Pixel Vault Game').replace(/\.html?$/i, ''),
          entry: normPath(entry.path), kind: 'game', version: 1
        }, null, 2)], { type: 'application/json' });
        var zipEntries = group.map(function (x) { return { name: normPath(x.path), blob: x.blob }; });
        zipEntries.push({ name: '.pv-game.json', blob: manifest });
        return makeStoredZip(zipEntries).then(function (zip) {
          submitForReview('games', packageName + '.zip', zip);
        });
      }).catch(function (e) { setStatus(e.message || 'Could not package this game for publishing.', 'error'); });
    }
    function downloadMovieForPublic(id) {
      getAll().then(function (items) {
        var movie = items.find(function (x) { return x.id === id && x.kind === 'movie'; });
        if (!movie) throw new Error('That movie is no longer in your local library.');
        if ((movie.size || 0) > 20 * 1024 * 1024) throw new Error('This movie is larger than 20 MB. Choose a smaller video to submit for review.');
        submitForReview('movies', baseName(movie.name || movie.displayName || 'pixel-vault-movie.mp4'), movie.blob);
      }).catch(function (e) { setStatus(e.message || 'Could not download the movie.', 'error'); });
    }
    function publishFromPicker(kind, input) {
      var files = collectFiles(input);
      if (!files.length) return;
      var file = files[0];
      if (kind === 'games' && !/\.zip$/i.test(file.name)) {
        setStatus('Choose a game ZIP package. To publish an imported game, use its Submit for review button.', 'error');
        return;
      }
      submitForReview(kind, file.name, file);
    }
    function requestModerationToken() {
      if (moderationToken) return moderationToken;
      var entered = window.prompt('Owner only: enter the private PUBLISH_ADMIN_TOKEN configured in Cloudflare. This password stays in memory for this page session.');
      if (!entered) { setStatus('Review Queue is locked. Only the site owner can open it.', ''); return ''; }
      if (entered.length < 24) { setStatus('That moderation password is too short.', 'error'); return ''; }
      moderationToken = entered;
      return moderationToken;
    }
    function renderReviewQueue() {
      var token = requestModerationToken();
      if (!token) {
        list.innerHTML = '<div class="pvl-empty">The Review Queue is private.<br>Enter the owner password to continue.</div>';
        return;
      }
      setStatus('Loading private submissions…');
      list.innerHTML = '<div class="pvl-empty">Loading review queue…</div>';
      fetch('https://pixel-vault-search.hendryjavier26.workers.dev/api/admin/submissions', {
        method: 'GET', headers: { 'X-Admin-Token': token }, credentials: 'omit', cache: 'no-store'
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok || !data.ok) {
            if (response.status === 401) moderationToken = '';
            throw new Error(data.error || 'Could not access the private review queue.');
          }
          var items = Array.isArray(data.items) ? data.items : [];
          setStatus(items.length + ' pending submission' + (items.length === 1 ? '' : 's') + '. Submissions stay private until approved.', 'good');
          if (!items.length) {
            list.innerHTML = '<div class="pvl-empty">No submissions waiting for review.<br>New visitor submissions will appear here privately.</div>';
            return;
          }
          list.innerHTML = items.map(function (item) {
            var when = item.submittedAt ? new Date(item.submittedAt).toLocaleString() : 'Date unavailable';
            var kind = item.kind === 'movies' ? 'Movie/video' : 'Game ZIP';
            return '<article class="pvl-card"><strong>' + esc(item.name || item.filename || 'Untitled submission') + '</strong><small>' +
              esc(kind) + ' · ' + esc(fmtBytes(Number(item.size) || 0)) + '<br>Submitted ' + esc(when) + '</small>' +
              '<div class="pvl-card-actions"><button type="button" class="pvl-action" data-pvl-moderate="approve" data-pvl-id="' + esc(item.id) + '" data-pvl-name="' + esc(item.name || item.filename || 'item') + '">Approve & publish</button>' +
              '<button type="button" class="pvl-action secondary" data-pvl-moderate="reject" data-pvl-id="' + esc(item.id) + '" data-pvl-name="' + esc(item.name || item.filename || 'item') + '">Reject</button></div></article>';
          }).join('');
        });
      }).catch(function (error) {
        setStatus((error && error.message) || 'Review queue unavailable.', 'error');
        list.innerHTML = '<div class="pvl-empty">Could not load your private queue. Check the password and retry.</div>';
      });
    }
    function moderateSubmission(action, id, name) {
      var token = requestModerationToken();
      if (!token) return;
      if (action === 'approve' && !window.confirm('Approve "' + name + '" and publish it for every visitor?')) return;
      if (action === 'reject' && !window.confirm('Reject "' + name + '" and permanently remove it from the private queue?')) return;
      setStatus(action === 'approve' ? 'Approving and publishing…' : 'Rejecting submission…');
      fetch('https://pixel-vault-search.hendryjavier26.workers.dev/api/admin/submissions/' + encodeURIComponent(id) + '/' + action, {
        method: 'POST', headers: { 'X-Admin-Token': token }, credentials: 'omit'
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok || !data.ok) {
            if (response.status === 401) moderationToken = '';
            throw new Error(data.error || (action + ' failed.'));
          }
          setStatus(action === 'approve' ? 'Approved. Deployment will update the Public Catalog for everyone.' : 'Rejected. The submission was removed.', 'good');
          renderReviewQueue();
        });
      }).catch(function (error) { setStatus((error && error.message) || 'Moderation action failed.', 'error'); });
    }
    function renderPublicCatalog() {
      setStatus('Loading the shared catalog…');
      list.innerHTML = '<div class="pvl-empty">Loading public games and movies…</div>';
      fetch('./public-catalog.json?pv=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' }).then(function (response) {
        if (!response.ok) throw new Error('The public catalog file is not available yet.');
        return response.json();
      }).then(function (data) {
        var entries = Array.isArray(data.items) ? data.items : [];
        entries = entries.filter(function (item) { return item && (item.kind === 'game' || item.kind === 'movie') && typeof item.url === 'string'; });
        entries.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
        setStatus(entries.length + ' public item' + (entries.length === 1 ? '' : 's') + ' available to every visitor.', 'good');
        if (!entries.length) {
          list.innerHTML = '<div class="pvl-empty">The Public Catalog is live but empty.<br>Submit a game or movie for owner review. Approved items appear here for everyone after deployment.</div>';
          return;
        }
        list.innerHTML = entries.map(function (item) {
          var kind = item.kind === 'movie' ? 'movie' : 'game';
          var size = item.size ? ' · ' + fmtBytes(Number(item.size) || 0) : '';
          return '<article class="pvl-card"><strong>' + esc(item.name || 'Untitled') + '</strong><small>' +
            (kind === 'movie' ? 'Public movie/video' : 'Public HTML game') + size + '</small><div class="pvl-card-actions">' +
            '<button type="button" class="pvl-action" data-pvl-public-play="1" data-pvl-public-kind="' + kind + '" data-pvl-public-url="' + esc(item.url) + '" data-pvl-public-name="' + esc(item.name || 'Public item') + '">' +
            (kind === 'movie' ? 'Watch movie' : 'Play game') + '</button></div></article>';
        }).join('');
      }).catch(function (e) {
        setStatus((e.message || 'Catalog failed to load.') + ' Refresh after a successful deployment.', 'error');
        list.innerHTML = '<div class="pvl-empty">Could not load the shared catalog. Check the deployment status and refresh the page.</div>';
      });
    }
    function playPublicItem(kind, url, name) {
      var absolute;
      try { absolute = new URL(url, location.href).href; } catch (_) { setStatus('This public catalog item has an invalid URL.', 'error'); return; }
      var parsed;
      try { parsed = new URL(absolute); } catch (_) { setStatus('This public catalog item has an invalid URL.', 'error'); return; }
      if (!/^https?:$/.test(parsed.protocol) || parsed.origin !== location.origin) {
        setStatus('This catalog item points outside the Pixel Vault website and was not opened.', 'error'); return;
      }
      var root = stageOpen(name || 'Public Catalog');
      if (kind === 'movie') {
        var video = document.createElement('video');
        video.controls = true; video.playsInline = true; video.preload = 'metadata'; video.src = absolute;
        video.setAttribute('aria-label', name || 'Public movie'); root.appendChild(video);
      } else {
        var frame = document.createElement('iframe');
        frame.title = name || 'Public game'; frame.src = absolute;
        frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-pointer-lock allow-downloads allow-modals allow-presentation');
        frame.setAttribute('allowfullscreen', 'true'); frame.setAttribute('referrerpolicy', 'no-referrer');
        root.appendChild(frame);
      }
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
      if (open) { if (currentTab === 'catalog') renderPublicCatalog(); else if (currentTab === 'review') renderReviewQueue(); else renderList(); }
    });
    panel.querySelector('[data-pvl-close-panel]').addEventListener('click', function () { panel.style.display = 'none'; launch.setAttribute('aria-expanded', 'false'); });
    panel.querySelectorAll('[data-pvl-tab]').forEach(function (b) { b.addEventListener('click', function () { switchTab(b.getAttribute('data-pvl-tab')); }); });
    panel.querySelector('#pvl-pick-game').addEventListener('click', function () { panel.querySelector('#pvl-game-input').click(); });
    panel.querySelector('#pvl-pick-folder').addEventListener('click', function () { panel.querySelector('#pvl-folder-input').click(); });
    panel.querySelector('#pvl-pick-movie').addEventListener('click', function () { panel.querySelector('#pvl-movie-input').click(); });
    panel.querySelector('#pvl-upload-games').addEventListener('click', function () { panel.querySelector('#pvl-public-game-zip-input').click(); });
    panel.querySelector('#pvl-upload-movies').addEventListener('click', function () { panel.querySelector('#pvl-public-movie-input').click(); });
    panel.querySelector('#pvl-public-game-zip-input').addEventListener('change', function (ev) { publishFromPicker('games', ev.target); });
    panel.querySelector('#pvl-public-movie-input').addEventListener('change', function (ev) { publishFromPicker('movies', ev.target); });
    panel.querySelector('#pvl-game-input').addEventListener('change', function (ev) { importGames(collectFiles(ev.target)); });
    panel.querySelector('#pvl-folder-input').addEventListener('change', function (ev) { importGames(collectFiles(ev.target)); });
    panel.querySelector('#pvl-movie-input').addEventListener('change', function (ev) { importMovies(collectFiles(ev.target)); });
    list.addEventListener('click', function (ev) {
      var reviewAction = ev.target.closest && ev.target.closest('[data-pvl-moderate]');
      var publicPlay = ev.target.closest && ev.target.closest('[data-pvl-public-play]');
      var exportButton = ev.target.closest && ev.target.closest('[data-pvl-export]');
      var downloadButton = ev.target.closest && ev.target.closest('[data-pvl-public-download]');
      var play = ev.target.closest && ev.target.closest('[data-pvl-play]');
      var remove = ev.target.closest && ev.target.closest('[data-pvl-remove]');
      if (reviewAction) {
        moderateSubmission(reviewAction.getAttribute('data-pvl-moderate'), reviewAction.getAttribute('data-pvl-id'), reviewAction.getAttribute('data-pvl-name'));
      } else if (publicPlay) {
        playPublicItem(publicPlay.getAttribute('data-pvl-public-kind'), publicPlay.getAttribute('data-pvl-public-url'), publicPlay.getAttribute('data-pvl-public-name'));
      } else if (exportButton) {
        exportGamePackage(exportButton.getAttribute('data-pvl-export'));
      } else if (downloadButton) {
        downloadMovieForPublic(downloadButton.getAttribute('data-pvl-public-download'));
      } else if (play) {
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