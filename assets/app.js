/* ===== Bauprojekt Intelligence - app.js ===== */
/* Vanilla JS SPA - kein Framework */

(function () {
  'use strict';

  // ===== State =====
  const state = {
    projects: [],
    meta: null,
    runs: [],
    filtered: [],
    page: 1,
    perPage: 25,
    search: '',
    region: '',
    gewerk: '',
    source: '',
    sort: 'date',
    view: 'projects',
    runsLoaded: false,
  };

  // ===== DOM Refs =====
  const $ = id => document.getElementById(id);
  const loader = document.getElementById('initial-loader');
  const appEl = $('app');

  // ===== Init =====
  async function init() {
    // Parse hash state
    parseHash();

    try {
      const [meta, projects] = await Promise.all([
        fetchJSON('data/meta.json'),
        fetchJSON('data/projects.json'),
      ]);
      state.meta = meta;
      state.projects = projects || [];

      buildFilterUI();
      applyFilters();
      hideLoader();
      bindEvents();
      renderCurrentView();
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      loader.querySelector('.loader-text').textContent = 'Fehler beim Laden der Daten.';
    }
  }

  function hideLoader() {
    loader.classList.add('hidden');
    setTimeout(() => { loader.style.display = 'none'; }, 350);
    appEl.style.display = '';
  }

  async function fetchJSON(url) {
    const res = await fetch(url + '?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.json();
  }

  // ===== Hash State =====
  function parseHash() {
    const hash = location.hash.replace('#', '');
    if (!hash) return;
    const params = new URLSearchParams(hash);
    if (params.get('view')) state.view = params.get('view');
    if (params.get('page')) state.page = parseInt(params.get('page')) || 1;
    if (params.get('region') !== null) state.region = params.get('region');
    if (params.get('gewerk') !== null) state.gewerk = params.get('gewerk');
    if (params.get('source') !== null) state.source = params.get('source');
    if (params.get('search') !== null) state.search = params.get('search');
    if (params.get('sort')) state.sort = params.get('sort');
  }

  function updateHash() {
    const params = new URLSearchParams();
    if (state.view !== 'projects') params.set('view', state.view);
    if (state.page > 1) params.set('page', state.page);
    if (state.region) params.set('region', state.region);
    if (state.gewerk) params.set('gewerk', state.gewerk);
    if (state.source) params.set('source', state.source);
    if (state.search) params.set('search', state.search);
    if (state.sort !== 'date') params.set('sort', state.sort);
    const str = params.toString();
    history.replaceState(null, '', str ? '#' + str : location.pathname);
  }

  // ===== Filter UI =====
  function buildFilterUI() {
    if (!state.meta) return;

    // Regions
    const regionSel = $('filter-region');
    state.meta.regions.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      if (r === state.region) opt.selected = true;
      regionSel.appendChild(opt);
    });
    if (state.region) regionSel.value = state.region;

    // Sources
    const sourceSel = $('filter-source');
    (state.meta.quellen || []).forEach(q => {
      const opt = document.createElement('option');
      opt.value = q.key;
      opt.textContent = q.label;
      if (q.key === state.source) opt.selected = true;
      sourceSel.appendChild(opt);
    });
    if (state.source) sourceSel.value = state.source;

    // Sort
    $('filter-sort').value = state.sort;

    // Search
    const searchEl = $('search-input');
    if (state.search) searchEl.value = state.search;

    // Gewerk Pills
    const pillsEl = $('gewerk-pills');
    (state.meta.gewerke || []).forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'gewerk-pill' + (g.key === state.gewerk ? ' active' : '');
      btn.textContent = g.label;
      btn.dataset.key = g.key;
      btn.addEventListener('click', () => {
        state.gewerk = state.gewerk === g.key ? '' : g.key;
        state.page = 1;
        document.querySelectorAll('.gewerk-pill').forEach(p => {
          p.classList.toggle('active', p.dataset.key === state.gewerk);
        });
        applyFilters();
        renderProjects();
        updateHash();
      });
      pillsEl.appendChild(btn);
    });

    // Header meta
    const lastUpdated = state.meta.last_updated
      ? new Date(state.meta.last_updated).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    $('header-meta').textContent = lastUpdated ? `Stand: ${lastUpdated}` : '';
  }

  // ===== Events =====
  let searchTimer = null;

  function bindEvents() {
    // Nav Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        switchView(view);
      });
    });

    // Search (debounced)
    $('search-input').addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = e.target.value.trim();
        state.page = 1;
        applyFilters();
        renderProjects();
        updateHash();
      }, 300);
    });

    // Filters
    $('filter-region').addEventListener('change', e => {
      state.region = e.target.value;
      state.page = 1;
      applyFilters();
      renderProjects();
      updateHash();
    });

    $('filter-source').addEventListener('change', e => {
      state.source = e.target.value;
      state.page = 1;
      applyFilters();
      renderProjects();
      updateHash();
    });

    $('filter-sort').addEventListener('change', e => {
      state.sort = e.target.value;
      applyFilters();
      renderProjects();
      updateHash();
    });

    // Reset
    $('reset-filters').addEventListener('click', () => {
      state.search = '';
      state.region = '';
      state.gewerk = '';
      state.source = '';
      state.sort = 'date';
      state.page = 1;
      $('search-input').value = '';
      $('filter-region').value = '';
      $('filter-source').value = '';
      $('filter-sort').value = 'date';
      document.querySelectorAll('.gewerk-pill').forEach(p => p.classList.remove('active'));
      applyFilters();
      renderProjects();
      updateHash();
    });

    // Hash change
    window.addEventListener('hashchange', () => {
      parseHash();
      applyFilters();
      renderCurrentView();
    });
  }

  // ===== View Switching =====
  function switchView(view) {
    state.view = view;
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('hidden', v.id !== `view-${view}`);
    });
    if (view === 'runs' && !state.runsLoaded) {
      loadRuns();
    }
    updateHash();
  }

  function renderCurrentView() {
    switchView(state.view);
    if (state.view === 'projects') {
      renderProjects();
    }
  }

  // ===== Filter & Sort =====
  function applyFilters() {
    let data = state.projects.slice();

    // Search
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(p => (p.t || '').toLowerCase().indexOf(q) !== -1);
    }

    // Region
    if (state.region) {
      data = data.filter(p => p.r === state.region);
    }

    // Gewerk
    if (state.gewerk) {
      data = data.filter(p => p.g === state.gewerk);
    }

    // Source
    if (state.source) {
      data = data.filter(p => p.sk === state.source);
    }

    // Sort
    if (state.sort === 'score') {
      data.sort((a, b) => (b.sc || 0) - (a.sc || 0));
    } else {
      data.sort((a, b) => {
        if (!a.d && !b.d) return 0;
        if (!a.d) return 1;
        if (!b.d) return -1;
        return b.d.localeCompare(a.d);
      });
    }

    state.filtered = data;
  }

  // ===== Render Projects =====
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  function renderProjects() {
    const grid = $('project-grid');
    const totalItems = state.filtered.length;
    const totalPages = Math.ceil(totalItems / state.perPage);

    // Clamp page
    if (state.page > totalPages && totalPages > 0) state.page = totalPages;
    if (state.page < 1) state.page = 1;

    const start = (state.page - 1) * state.perPage;
    const end = start + state.perPage;
    const pageItems = state.filtered.slice(start, end);

    // Results count
    $('results-count').textContent = `${totalItems.toLocaleString('de-DE')} Projekte`;

    // Empty state
    if (pageItems.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>Keine Projekte gefunden.</p>
        </div>`;
      $('pagination').innerHTML = '';
      return;
    }

    // Render cards
    grid.innerHTML = pageItems.map(renderCard).join('');

    // Pagination
    renderPagination(totalPages);
  }

  function renderCard(p) {
    const isNew = p.d && p.d >= yesterdayStr;
    const score = p.sc !== null && p.sc !== undefined ? p.sc : null;
    let scoreClass = '';
    if (score !== null) {
      if (score >= 8) scoreClass = 'very-high';
      else if (score >= 5) scoreClass = 'high';
    }

    const titleHtml = p.u
      ? `<a href="${escHtml(p.u)}" target="_blank" rel="noopener">${escHtml(p.t || '(kein Titel)')}</a>`
      : escHtml(p.t || '(kein Titel)');

    const tags = [
      p.s ? `<span class="tag tag-source">${escHtml(p.s)}</span>` : '',
      p.r ? `<span class="tag tag-region">${escHtml(p.r)}</span>` : '',
      p.gl ? `<span class="tag tag-gewerk">${escHtml(p.gl)}</span>` : '',
    ].filter(Boolean).join('');

    const scoreBadge = score !== null
      ? `<span class="score-badge ${scoreClass}" title="Relevanz-Score">${score}</span>`
      : '';

    const newBadge = isNew ? `<span class="new-badge">NEU</span>` : '';

    const dateStr = p.d ? new Date(p.d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

    return `
      <div class="project-card">
        <div class="card-tags">
          ${tags}
          ${scoreBadge}
          ${newBadge}
        </div>
        <div class="card-title">${titleHtml}</div>
        ${dateStr ? `<div class="card-date">📅 ${dateStr}</div>` : ''}
      </div>`;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ===== Pagination =====
  function renderPagination(totalPages) {
    const pag = $('pagination');
    if (totalPages <= 1) { pag.innerHTML = ''; return; }

    const cur = state.page;
    let html = '';

    // Prev
    html += `<button class="page-btn" ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}">‹</button>`;

    // Pages
    const pages = buildPageRange(cur, totalPages);
    pages.forEach(p => {
      if (p === '...') {
        html += `<span class="page-ellipsis">…</span>`;
      } else {
        html += `<button class="page-btn ${p === cur ? 'active' : ''}" data-page="${p}">${p}</button>`;
      }
    });

    // Next
    html += `<button class="page-btn" ${cur === totalPages ? 'disabled' : ''} data-page="${cur + 1}">›</button>`;

    pag.innerHTML = html;
    pag.querySelectorAll('.page-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.page = parseInt(btn.dataset.page);
        renderProjects();
        updateHash();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function buildPageRange(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (cur > 3) pages.push('...');
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) {
      pages.push(p);
    }
    if (cur < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  // ===== Run-Report =====
  async function loadRuns() {
    const grid = $('runs-grid');
    grid.innerHTML = '<p style="color:var(--text-muted);padding:2rem">Lade Runs…</p>';
    try {
      const runs = await fetchJSON('data/runs.json');
      state.runs = runs || [];
      state.runsLoaded = true;
      renderRuns();
    } catch (err) {
      grid.innerHTML = '<p style="color:var(--danger);padding:2rem">Fehler beim Laden der Runs.</p>';
    }
  }

  function renderRuns() {
    const grid = $('runs-grid');
    const runs = state.runs.slice().reverse().slice(0, 30);

    if (!runs.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);padding:2rem">Keine Runs vorhanden.</p>';
      return;
    }

    grid.innerHTML = runs.map(renderRunCard).join('');
  }

  function renderRunCard(run) {
    const date = run.timestamp || run.date || run.started_at || '';
    const dateStr = date ? new Date(date).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }) : '—';

    const duration = run.duration_seconds || run.duration || null;
    const durationStr = duration ? formatDuration(duration) : '—';

    const newEntries = run.new_entries || run.new || 0;

    // Collector stats
    const collectors = run.collectors || run.sources || {};
    const collectorRows = Object.entries(collectors).map(([name, stats]) => {
      const total = stats.total || stats.checked || 0;
      const found = stats.found || stats.new || 0;
      const pct = total > 0 ? Math.min(100, Math.round((found / total) * 100)) : 0;
      const label = stats.label || name;
      return `
        <tr>
          <td>${escHtml(label)}</td>
          <td>
            <div class="progress-wrap">
              <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
              <span class="progress-label">${found}/${total}</span>
            </div>
          </td>
        </tr>`;
    }).join('');

    const tableHtml = collectorRows ? `
      <table class="collector-table">
        <thead><tr><th>Quelle</th><th>Treffer</th></tr></thead>
        <tbody>${collectorRows}</tbody>
      </table>` : '';

    return `
      <div class="run-card">
        <div class="run-header">
          <span class="run-date">📅 ${dateStr}</span>
          <span class="run-stat">⏱ <strong>${durationStr}</strong></span>
          ${newEntries > 0 ? `<span class="run-new-badge">+${newEntries} neu</span>` : ''}
        </div>
        ${tableHtml}
      </div>`;
  }

  function formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  // ===== Boot =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
