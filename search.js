(function () {
  var TMDB_API_KEY = '6cb6e1dc603bc65ffb6198489d5bc5b7';
  var TMDB_BASE = 'https://api.themoviedb.org/3';
  var IMG_BASE = 'https://image.tmdb.org/t/p/w154';
  var BLANK_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  var input = document.getElementById('home-search-input');
  var resultsContainer = document.getElementById('results-container');
  var statusEl = document.getElementById('search-status');

  var debounceTimer = null;
  var currentRequestId = 0;
  var activeController = null;
  var searchCache = {};

  function setStatus(content, isError) {
    if (!content) {
      statusEl.hidden = true;
      statusEl.innerHTML = '';
      statusEl.classList.remove('-error');
      return;
    }
    statusEl.hidden = false;
    statusEl.innerHTML = content;
    statusEl.classList.toggle('-error', !!isError);
  }

  var SPINNER_HTML =
    '<div class="spinner -inline"><div></div><div></div><div></div><div></div><div></div><div></div></div>';
  var LOADING_HTML = '<div class="loading-shimmer">' + SPINNER_HTML + '</div>';

  function clearResults() {
    resultsContainer.innerHTML = '';
  }

  function yearFromDate(dateStr) {
    if (!dateStr) return '';
    return dateStr.slice(0, 4);
  }

  var STAR_ICON_SVG =
    '<svg class="star-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.75l2.87 6.13 6.63.7-4.93 4.6 1.32 6.62L12 17.9l-5.89 3.9 1.32-6.62-4.93-4.6 6.63-.7L12 2.75z"></path></svg>';

  function formatRating(voteAverage, voteCount) {
    if (!voteAverage || !voteCount) return '';
    return voteAverage.toFixed(1);
  }

  function buildCard(show) {
    var item = document.createElement('a');
    item.className = 'result-item';
    item.href = '/show/?id=' + show.id;

    var posterSrc = show.poster_path
      ? IMG_BASE + show.poster_path
      : BLANK_POSTER;

    var rating = formatRating(show.vote_average, show.vote_count);

    item.innerHTML =
      '<img class="poster" src="' + posterSrc + '" alt="' + escapeHtml(show.name) + '" loading="lazy" decoding="async">' +
      '<div class="details">' +
        '<div class="header">' +
          '<h2 class="title">' + escapeHtml(show.name) + '</h2>' +
          '<div class="meta">' +
            (yearFromDate(show.first_air_date) ? '<span class="year numbers">' + yearFromDate(show.first_air_date) + '</span>' : '') +
            (rating ? '<span class="rating numbers">' + STAR_ICON_SVG + rating + '</span>' : '') +
          '</div>' +
        '</div>' +
        (show.overview ? '<p class="overview">' + escapeHtml(show.overview) + '</p>' : '') +
        '<div class="creator">' +
          '<span>Created by</span>' +
          '<span class="creator-badge -loading" data-show-id="' + show.id + '">…</span>' +
        '</div>' +
      '</div>';

    return item;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var CREATOR_CACHE_PREFIX = 'tvbox:creator:';
  var CREATOR_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  var CREATOR_CONCURRENCY = 4;
  var creatorQueue = [];
  var creatorActive = 0;
  var creatorGen = 0;
  var creatorObserver = null;

  function readCreator(id) {
    try {
      var raw = localStorage.getItem(CREATOR_CACHE_PREFIX + id);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || typeof p.t !== 'string' || (Date.now() - p.ts) > CREATOR_TTL_MS) return null;
      return p.t;
    } catch (e) { return null; }
  }

  function writeCreator(id, text) {
    try { localStorage.setItem(CREATOR_CACHE_PREFIX + id, JSON.stringify({ t: text, ts: Date.now() })); } catch (e) {}
  }

  function setBadge(showId, text) {
    var badge = resultsContainer.querySelector('.creator-badge[data-show-id="' + showId + '"]');
    if (!badge) return;
    badge.classList.remove('-loading');
    badge.textContent = text;
  }

  function pumpCreators() {
    while (creatorActive < CREATOR_CONCURRENCY && creatorQueue.length) {
      var job = creatorQueue.shift();
      if (job.gen !== creatorGen) continue;
      creatorActive++;
      loadCreator(job.id).then(function () {
        creatorActive--;
        pumpCreators();
      });
    }
  }

  function loadCreator(showId) {
    return fetch(TMDB_BASE + '/tv/' + showId + '?api_key=' + TMDB_API_KEY)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (details) {
        if (!details) { setBadge(showId, 'Unknown'); return; }
        var names = (details.created_by || []).map(function (c) { return c.name; });
        var text = names.length ? names.join(', ') : 'Unknown';
        writeCreator(showId, text);
        setBadge(showId, text);
      })
      .catch(function () { setBadge(showId, 'Unknown'); });
  }

  function fetchCreators(shows) {
    creatorGen++;
    creatorQueue = [];
    if (creatorObserver) { creatorObserver.disconnect(); creatorObserver = null; }

    var pending = [];
    shows.forEach(function (show) {
      var cached = readCreator(show.id);
      if (cached !== null) setBadge(show.id, cached);
      else pending.push(show);
    });
    if (!pending.length) return;

    function enqueue(showId) {
      creatorQueue.push({ id: showId, gen: creatorGen });
      pumpCreators();
    }

    if (!('IntersectionObserver' in window)) {
      pending.forEach(function (show) { enqueue(show.id); });
      return;
    }

    creatorObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        enqueue(entry.target.getAttribute('data-show-id'));
      });
    }, { rootMargin: '300px 0px' });

    pending.forEach(function (show) {
      var badge = resultsContainer.querySelector('.creator-badge[data-show-id="' + show.id + '"]');
      if (badge) creatorObserver.observe(badge);
    });
  }

  function runSearch(query) {
    var requestId = ++currentRequestId;

document.title = query.trim()
  ? query.trim() + ' | tvbox'
  : 'Search TV Shows ǀ tvbox';

    if (!query.trim()) {
      clearResults();
      setStatus('');
      return;
    }

    setStatus(LOADING_HTML);

    if (activeController) activeController.abort();
    var controller = new AbortController();
    activeController = controller;

    var url = TMDB_BASE + '/search/tv?api_key=' + TMDB_API_KEY +
      '&query=' + encodeURIComponent(query) +
      '&include_adult=false&page=1';

    var cacheKey = query.trim().toLowerCase();
    var request = searchCache[cacheKey]
      ? Promise.resolve(searchCache[cacheKey])
      : fetch(url, { signal: controller.signal }).then(function (res) {
          if (!res.ok) throw new Error('TMDB request failed (' + res.status + ')');
          return res.json();
        });

    request
      .then(function (data) {
        searchCache[cacheKey] = data;
        if (requestId !== currentRequestId) return;

        var shows = (data.results || []).filter(function (r) { return r.name; });

        clearResults();

        if (!shows.length) {
          setStatus('');
          resultsContainer.innerHTML = '<p class="no-results">No shows found for “' + escapeHtml(query) + '”.</p>';
          return;
        }

        setStatus('');
        var fragment = document.createDocumentFragment();
        shows.forEach(function (show) {
          fragment.appendChild(buildCard(show));
        });
        resultsContainer.appendChild(fragment);

        fetchCreators(shows);
      })
      .catch(function (err) {
        if (err.name === 'AbortError') return;
        if (requestId !== currentRequestId) return;
        clearResults();
        setStatus('Something went wrong: ' + err.message, true);
      });
  }

  input.addEventListener('input', function () {
    var query = input.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      runSearch(query);
    }, 350);
  });

  var params = new URLSearchParams(window.location.search);
  var initialQuery = params.get('q');
  if (initialQuery) {
    input.value = initialQuery;
    runSearch(initialQuery);
  }

  window.addEventListener('pagehide', function () {
    if (activeController) activeController.abort();
    clearTimeout(debounceTimer);
  });

  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    var stillSpinning = !statusEl.hidden && statusEl.innerHTML.indexOf('spinner') !== -1;
    var hasResults = resultsContainer.children.length > 0;
    if (stillSpinning && !hasResults) {
      var restoredParams = new URLSearchParams(window.location.search);
      var restoredQuery = restoredParams.get('q') || '';
      input.value = restoredQuery;
      runSearch(restoredQuery);
    }
  });
})();
