(function(){
  'use strict';
  if (window.__PV_EXTRA_TABS__) return; window.__PV_EXTRA_TABS__=true;
  var css = `#pv-extra-launch{position:fixed;right:16px;bottom:16px;z-index:2147483000;border:1px solid #438fff;background:#0b1830;color:#eaf3ff;border-radius:14px;padding:11px 15px;font:800 13px system-ui;box-shadow:0 8px 30px #0008;cursor:pointer}#pv-extra-panel{position:fixed;right:16px;bottom:68px;z-index:2147483000;width:min(390px,calc(100vw - 24px));max-height:min(70vh,620px);overflow:auto;background:#081426;color:#eaf3ff;border:1px solid #31527e;border-radius:18px;box-shadow:0 18px 60px #000b;font:14px system-ui;display:none}#pv-extra-panel *{box-sizing:border-box}#pv-extra-panel .pvx-head{position:sticky;top:0;background:#0b1a30;padding:14px;border-bottom:1px solid #243d60;display:flex;align-items:center;justify-content:space-between}#pv-extra-panel .pvx-head strong{font-size:15px}#pv-extra-panel .pvx-close{background:#182d4b;border:0;color:white;border-radius:8px;padding:6px 10px;cursor:pointer}#pv-extra-panel .pvx-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px}#pv-extra-panel .pvx-tab{border:1px solid #2b4567;background:#10213a;color:#bcd3f4;border-radius:10px;padding:9px 4px;font-weight:800;cursor:pointer;font-size:12px}#pv-extra-panel .pvx-tab[aria-selected=true]{background:#2c69bd;color:white;border-color:#6aa7ff}#pv-extra-panel .pvx-content{padding:4px 14px 16px}#pv-extra-panel .pvx-card{background:#0e2038;border:1px solid #223d60;border-radius:12px;padding:13px;margin:8px 0}#pv-extra-panel .pvx-muted{color:#9eb5d7;font-size:12px;line-height:1.5}#pv-extra-panel .pvx-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#pv-extra-panel input{min-width:0;flex:1;background:#061020;border:1px solid #35547c;border-radius:9px;color:white;padding:10px;font:inherit}#pv-extra-panel .pvx-action{border:0;background:#347ee1;color:white;padding:10px 12px;border-radius:9px;font-weight:800;cursor:pointer}#pv-extra-panel a{color:#9dc9ff}#pv-extra-panel .pvx-big{font-size:28px;font-weight:900}#pv-extra-panel .pvx-status{color:#9ee6b2;font-weight:800}#pv-extra-panel .pvx-error{color:#ffb3a8}`;
  function mount(){if(!document.body||document.getElementById('pv-extra-panel'))return;
    var style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
    var launch=document.createElement('button');launch.id='pv-extra-launch';launch.type='button';launch.textContent='✦ Vault Tools';launch.setAttribute('aria-expanded','false');
    var panel=document.createElement('section');panel.id='pv-extra-panel';panel.setAttribute('aria-label','Pixel Vault tools');
    panel.innerHTML='<div class="pvx-head"><strong>PIXEL VAULT · TOOLS</strong><button class="pvx-close" type="button">Close ✕</button></div><div class="pvx-tabs" role="tablist"><button class="pvx-tab" data-tab="weather" aria-selected="true">Weather</button><button class="pvx-tab" data-tab="spotify" aria-selected="false">Spotify</button><button class="pvx-tab" data-tab="developer" aria-selected="false">Developer</button><button class="pvx-tab" data-tab="battery" aria-selected="false">Battery</button></div><div class="pvx-content" id="pvx-content"></div>';
    document.body.appendChild(launch);document.body.appendChild(panel);
    var content=panel.querySelector('#pvx-content'), active='weather', battery=null;
    function renderSpotify(){
      var clientIdKey='pvx_spotify_client_id', tokenKey='pvx_spotify_access_token', expiryKey='pvx_spotify_token_expiry';
      var clientId=localStorage.getItem(clientIdKey)||'';
      function esc(v){return String(v==null?'':v).replace(/[&<>"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];});}
      content.innerHTML='<div class="pvx-card"><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:24px">♫</span><div><strong style="font-size:18px">Spotify Search</strong><div class="pvx-muted">Search Spotify from inside Pixel Vault</div></div></div><form id="pvx-spotify-config" class="pvx-row" style="margin-bottom:12px"><input id="pvx-spotify-client-id" aria-label="Spotify Client ID" placeholder="Spotify Developer Client ID" required><button class="pvx-action" type="submit">Connect</button></form><div id="pvx-spotify-status" class="pvx-muted" role="status">Enter your Spotify app Client ID and connect to enable official search.</div><form id="pvx-spotify-search" class="pvx-row" style="margin-top:12px"><input id="pvx-spotify-query" aria-label="Search Spotify" placeholder="Search songs, artists, albums, playlists…" required><button class="pvx-action" type="submit">Search</button></form><div id="pvx-spotify-results" style="margin-top:12px"></div><div id="pvx-spotify-player" style="margin-top:12px"></div><div class="pvx-muted" style="margin-top:12px">Search and playback use Spotify’s official API and embedded player. Some playback features may require signing in or Premium.</div></div>';
      var config=content.querySelector('#pvx-spotify-config'), idInput=content.querySelector('#pvx-spotify-client-id'), status=content.querySelector('#pvx-spotify-status'), results=content.querySelector('#pvx-spotify-results'), player=content.querySelector('#pvx-spotify-player');
      idInput.value=clientId;
      function redirectUri(){return location.origin+location.pathname;}
      function randomString(n){var a=new Uint8Array(n);crypto.getRandomValues(a);return Array.from(a).map(function(x){return x.toString(16).padStart(2,'0');}).join('');}
      function b64url(bytes){return btoa(String.fromCharCode.apply(null,new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
      async function startConnect(id){
        if(!id){status.textContent='Enter your Spotify Client ID first.';return;}
        localStorage.setItem(clientIdKey,id);
        var verifier=randomString(32), state=randomString(16);
        var digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
        var challenge=b64url(digest);
        sessionStorage.setItem('pvx_spotify_verifier',verifier);
        sessionStorage.setItem('pvx_spotify_state',state);
        var params=new URLSearchParams({client_id:id,response_type:'code',redirect_uri:redirectUri(),code_challenge_method:'S256',code_challenge:challenge,state:state});
        location.assign('https://accounts.spotify.com/authorize?'+params.toString());
      }
      async function handleCallback(){
        var params=new URLSearchParams(location.search), code=params.get('code'), err=params.get('error');
        if(err){history.replaceState({},document.title,location.pathname);status.textContent='Spotify authorization was cancelled or denied.';return;}
        if(!code)return;
        var state=params.get('state'), expected=sessionStorage.getItem('pvx_spotify_state'), verifier=sessionStorage.getItem('pvx_spotify_verifier');
        history.replaceState({},document.title,location.pathname);
        if(!clientId||!verifier||!state||state!==expected){status.textContent='Spotify sign-in could not be verified. Press Connect and try again.';return;}
        status.textContent='Finishing Spotify sign-in…';
        try{
          var response=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code:code,redirect_uri:redirectUri(),code_verifier:verifier})});
          var data=await response.json();
          if(!response.ok||!data.access_token)throw Error(data.error_description||'Spotify token exchange failed.');
          localStorage.setItem(tokenKey,data.access_token);localStorage.setItem(expiryKey,String(Date.now()+Number(data.expires_in||3600)*1000));sessionStorage.removeItem('pvx_spotify_verifier');sessionStorage.removeItem('pvx_spotify_state');
          status.textContent='Connected to Spotify. Search for music below.';
        }catch(e){status.textContent='Spotify sign-in failed: '+(e.message||'Check the Client ID and registered redirect URI.');}
      }
      async function searchSpotify(){
        var q=content.querySelector('#pvx-spotify-query').value.trim();
        if(!q)return;
        var token=localStorage.getItem(tokenKey), expiry=Number(localStorage.getItem(expiryKey)||0);
        if(!token||Date.now()>expiry){status.textContent='Connect to Spotify first (or reconnect if your session expired).';return;}
        status.textContent='Searching Spotify…';results.innerHTML='';player.innerHTML='';
        try{
          var url='https://api.spotify.com/v1/search?'+new URLSearchParams({q:q,type:'track,album,artist,playlist',limit:'5',market:'US'});
          var response=await fetch(url,{headers:{Authorization:'Bearer '+token}});
          var data=await response.json();
          if(response.status===401){localStorage.removeItem(tokenKey);localStorage.removeItem(expiryKey);throw Error('Spotify session expired. Press Connect again.');}
          if(!response.ok)throw Error(data.error&&data.error.message||'Spotify search request failed.');
          var all=[];
          ['tracks','albums','artists','playlists'].forEach(function(key){(data[key]&&data[key].items||[]).forEach(function(item){if(item&&item.id)all.push(item);});});
          if(!all.length){status.textContent='No Spotify results found for “'+q+'”.';return;}
          status.textContent='Search results for “'+q+'”';
          results.innerHTML=all.map(function(item){
            var kind=item.type||'track', image=(item.images&&item.images[0]&&item.images[0].url)||(item.album&&item.album.images&&item.album.images[0]&&item.album.images[0].url)||'';
            var sub=item.artists?item.artists.map(function(a){return a.name;}).join(', '):(item.owner&&item.owner.display_name?item.owner.display_name:(kind==='artist'?'Artist':kind));
            return '<div class="pvx-card" style="display:flex;gap:10px;align-items:center">'+(image?'<img src="'+esc(image)+'" alt="" style="width:58px;height:58px;object-fit:cover;border-radius:8px">':'')+'<div style="min-width:0;flex:1"><strong>'+esc(item.name)+'</strong><div class="pvx-muted">'+esc(kind.toUpperCase())+' · '+esc(sub)+'</div><button class="pvx-action" type="button" data-pvx-play="'+esc(kind)+'" data-pvx-id="'+esc(item.id)+'" style="margin-top:7px">Play here</button></div></div>';
          }).join('');
          results.querySelectorAll('[data-pvx-play]').forEach(function(btn){btn.addEventListener('click',function(){
            var kind=btn.getAttribute('data-pvx-play'), id=btn.getAttribute('data-pvx-id');
            player.innerHTML='<iframe title="Spotify player" src="https://open.spotify.com/embed/'+encodeURIComponent(kind)+'/'+encodeURIComponent(id)+'?utm_source=pixelvault" style="display:block;width:100%;height:352px;border:0;border-radius:12px;background:#111" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>';
          });});
        }catch(e){status.textContent=e.message||'Spotify search is unavailable right now.';}
      }
      config.addEventListener('submit',function(ev){ev.preventDefault();startConnect(idInput.value.trim()).catch(function(e){status.textContent='Could not start Spotify sign-in: '+(e.message||'browser security error');});});
      content.querySelector('#pvx-spotify-search').addEventListener('submit',function(ev){ev.preventDefault();searchSpotify();});
      if(clientId&&localStorage.getItem(tokenKey)&&Date.now()<Number(localStorage.getItem(expiryKey)||0))status.textContent='Spotify is connected. Search for music below.';
      handleCallback();
    }
    function show(tab){active=tab;panel.querySelectorAll('.pvx-tab').forEach(function(b){b.setAttribute('aria-selected',String(b.dataset.tab===tab));});
      if(tab==='weather') content.innerHTML='<div class="pvx-card"><strong>Local weather</strong><p class="pvx-muted">Enter a city to get current conditions and today\'s forecast. Uses Open-Meteo public weather data.</p><form id="pvx-weather-form" class="pvx-row"><input id="pvx-city" aria-label="City" placeholder="City, e.g. Worcester, MA" required><button class="pvx-action">Get weather</button></form><div id="pvx-weather-result" class="pvx-muted" style="margin-top:12px">Weather has not been loaded yet.</div></div>';
      else if(tab==='spotify') { renderSpotify(); }
      else if(tab==='developer') content.innerHTML='<div class="pvx-card"><strong>Developer Mode</strong><p class="pvx-muted">Status check only. Editing the live site is restricted to the authorized owner account.</p><div id="pvx-dev-status"></div></div><div class="pvx-card"><strong>Runtime diagnostics</strong><div id="pvx-diagnostics" class="pvx-muted"></div></div>';
      else content.innerHTML='<div class="pvx-card"><strong>Device battery</strong><div id="pvx-battery-value" class="pvx-big">Checking…</div><div id="pvx-battery-detail" class="pvx-muted">Battery access depends on browser support.</div></div>';
      if(tab==='developer'){
        var auth=!!(window.supabase||window.__SUPABASE__);content.querySelector('#pvx-dev-status').innerHTML='<p class="pvx-muted">Authentication: <span class="pvx-error">'+(auth?'client object detected; account verification still required':'not configured/detected')+'</span></p><p class="pvx-muted">Live editor: <span class="pvx-error">not enabled in this public page</span></p><p class="pvx-muted">A safe owner-only developer panel requires working server-side authentication. No fake login or edit controls are shown.</p>';
        var d=content.querySelector('#pvx-diagnostics');d.textContent='Page: '+location.pathname+' · Viewport: '+innerWidth+'×'+innerHeight+' · Online: '+(navigator.onLine?'yes':'no')+' · JavaScript: running';
      }
      if(tab==='battery') updateBattery();
    }
    function updateBattery(){var v=content.querySelector('#pvx-battery-value'),d=content.querySelector('#pvx-battery-detail');if(!v)return;if(battery){v.textContent=(battery.charging?'⚡ ':'🔋 ')+Math.round(battery.level*100)+'%';d.textContent=battery.charging?'Charging':'Not charging';return;}if(!navigator.getBattery){v.textContent='Unavailable';d.textContent='This browser/device does not expose battery status to websites.';return;}navigator.getBattery().then(function(b){battery=b;updateBattery();b.addEventListener('levelchange',updateBattery);b.addEventListener('chargingchange',updateBattery);}).catch(function(){v.textContent='Unavailable';d.textContent='Browser permission or platform restrictions prevent battery access.';});}
    panel.querySelectorAll('.pvx-tab').forEach(function(b){b.addEventListener('click',function(){show(b.dataset.tab);});});
    launch.addEventListener('click',function(){var open=panel.style.display!=='block';panel.style.display=open?'block':'none';launch.setAttribute('aria-expanded',String(open));if(open)show(active);});panel.querySelector('.pvx-close').addEventListener('click',function(){panel.style.display='none';launch.setAttribute('aria-expanded','false');});
    panel.addEventListener('submit',function(ev){ev.preventDefault();if(ev.target.id==='pvx-spotify-form'){var q=panel.querySelector('#pvx-spotify-query').value.trim();if(q){var url='https://open.spotify.com/search/'+encodeURIComponent(q);panel.querySelector('#pvx-spotify-link').href=url;location.href=url;}}else if(ev.target.id==='pvx-weather-form'){var city=panel.querySelector('#pvx-city').value.trim(),out=panel.querySelector('#pvx-weather-result');out.textContent='Looking up '+city+'…';fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(city)+'&count=1&language=en&format=json').then(function(r){if(!r.ok)throw Error('Location lookup failed');return r.json();}).then(function(g){if(!g.results||!g.results.length)throw Error('City not found. Try a nearby larger city.');var p=g.results[0];return fetch('https://api.open-meteo.com/v1/forecast?latitude='+p.latitude+'&longitude='+p.longitude+'&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto').then(function(r){if(!r.ok)throw Error('Weather request failed');return r.json();}).then(function(w){var cur=w.current||{},daily=w.daily||{};out.innerHTML='<div class="pvx-big">'+Math.round(cur.temperature_2m)+'°F</div><strong>'+p.name+(p.admin1?', '+p.admin1:'')+'</strong><p class="pvx-muted">Feels like '+Math.round(cur.apparent_temperature)+'°F · Humidity '+cur.relative_humidity_2m+'% · Wind '+Math.round(cur.wind_speed_10m)+' mph</p><p class="pvx-muted">Today: '+Math.round(daily.temperature_2m_min[0])+'°–'+Math.round(daily.temperature_2m_max[0])+'°F</p><p class="pvx-muted">Source: Open-Meteo</p>';}).catch(function(e){out.textContent=e.message||'Weather unavailable.';});}).catch(function(e){out.textContent=e.message||'Weather unavailable.';});}});
    show(active);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  var tries=0;var retry=setInterval(function(){if(document.getElementById('pv-extra-panel')){clearInterval(retry);return;}if(++tries>20){clearInterval(retry);return;}mount();},500);
})();