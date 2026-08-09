(function () {
  'use strict';

  const API = window.APP_CONFIG.API_BASE;
  let DEMO_MODE = false; // flips true if the backend can't be reached

  // ---------------------------------------------------------------
  // Nav / view switching
  // ---------------------------------------------------------------
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.view).classList.add('active');
      if (btn.dataset.view === 'map' && map) setTimeout(() => map.invalidateSize(), 50);
    });
  });

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  async function apiGet(path) {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error('API error ' + res.status);
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // Deterministic pseudo-random demo values so the map looks alive
  // even with no backend running / no submissions yet today.
  function demoValueFor(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return Math.round(((hash % 1400) / 10) * 10) / 10; // 0.0 - 140.0 mm
  }

  // ---------------------------------------------------------------
  // Legend
  // ---------------------------------------------------------------
  function renderLegend() {
    const list = document.getElementById('legendList');
    list.innerHTML = window.RAINFALL_LEVELS.map(
      (l) => `<li><span class="swatch" style="background:${l.color}"></span>${l.label}</li>`
    ).join('');
  }

  // ---------------------------------------------------------------
  // Map setup
  // ---------------------------------------------------------------
  let map, geoLayer, districtLayer;
  let mapDataByLocation = {}; // locationId -> { avgRainfallMm, level, color, reportCount, ... }
  let readingsCache = {}; // locationId -> array of readings (demo or fetched)

  function initMap() {
    map = L.map('map', { zoomControl: true, minZoom: 8, maxZoom: 15 }).setView([11.87, 75.45], 10);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
  }

  function styleFor(feature) {
    const id = feature.properties.id;
    const data = mapDataByLocation[id];
    const color = data ? data.color : '#3a4756';
    return {
      fillColor: color,
      fillOpacity: 0.65,
      color: '#efe9dc',
      weight: 0.8,
      opacity: 0.35
    };
  }

  function onEachFeature(feature, layer) {
    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 2.4, opacity: 0.9, fillOpacity: 0.82 });
      },
      mouseout: (e) => geoLayer.resetStyle(e.target),
      click: () => showDetail(feature)
    });
    const data = mapDataByLocation[feature.properties.id];
    const mm = data ? data.avgRainfallMm : demoValueFor(feature.properties.id);
    layer.bindTooltip(`${feature.properties.name} — ${mm} mm`, { sticky: true });
  }

  function renderGeoLayer(geojson) {
    if (geoLayer) map.removeLayer(geoLayer);
    geoLayer = L.geoJSON(geojson, { style: styleFor, onEachFeature }).addTo(map);
  }

  function renderDistrictOutline(geojson) {
    districtLayer = L.geoJSON(geojson, {
      style: { fill: false, color: '#e0ac47', weight: 2, opacity: 0.55, dashArray: '4 5' }
    }).addTo(map);
  }

  // ---------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------
  function showDetail(feature) {
    const p = feature.properties;
    const data = mapDataByLocation[p.id];
    const mm = data ? data.avgRainfallMm : demoValueFor(p.id);
    const level = data ? { label: data.levelLabel, color: data.color } : window.classifyRainfall(mm);

    document.getElementById('breadcrumb').textContent = `Kannur District › ${p.blockGroup}`;
    document.getElementById('detailName').textContent = p.name;

    const body = document.getElementById('detailBody');
    const reports = data ? data.reportCount : 0;
    const demoTag = DEMO_MODE ? '<p class="muted">Showing simulated demo data — connect the backend for live student reports.</p>' : '';

    body.innerHTML = `
      <span class="alert-chip" style="background:${level.color}"><span class="dot"></span>${level.label}</span>
      <div class="stat-row"><span class="stat-label">24hr average</span><span class="stat-value">${mm} mm</span></div>
      <div class="stat-row"><span class="stat-label">Reports today</span><span class="stat-value">${reports}</span></div>
      <div class="stat-row"><span class="stat-label">Type</span><span class="stat-value" style="font-size:13px;text-transform:capitalize">${p.localAuthType.replace(/_/g, ' ')}</span></div>
      ${demoTag}
    `;

    document.getElementById('detailPanel').classList.add('open');
  }

  document.getElementById('closeDetail').addEventListener('click', () => {
    document.getElementById('detailPanel').classList.remove('open');
  });

  // ---------------------------------------------------------------
  // Load map data (readings aggregated per location) for a given date
  // ---------------------------------------------------------------
  async function loadMapData(dateStr) {
    document.getElementById('dateLabel').textContent = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });

    try {
      const res = await apiGet(`/readings/map?date=${dateStr}&includeUnverified=true`);
      mapDataByLocation = {};
      res.locations.forEach((l) => { mapDataByLocation[l.locationId] = l; });
      DEMO_MODE = false;
      document.getElementById('statusNote').textContent = `Live data · Kannur district · ${res.locations.length} locations reporting`;
    } catch (err) {
      // Backend not reachable -> demo mode using deterministic fake values
      DEMO_MODE = true;
      mapDataByLocation = {};
      window.KANNUR_GEOJSON.features.forEach((f) => {
        const id = f.properties.LSGI_Code;
        const mm = demoValueFor(id);
        const level = window.classifyRainfall(mm);
        mapDataByLocation[id] = {
          locationId: id,
          locationName: f.properties.name,
          blockGroup: f.properties.block_group,
          avgRainfallMm: mm,
          reportCount: 1 + (mm % 4 | 0),
          level: level.key,
          levelLabel: level.label,
          color: level.color
        };
      });
      document.getElementById('statusNote').textContent = 'Demo mode — backend not reachable, showing simulated values';
    }

    if (geoLayer) geoLayer.setStyle(styleFor);
  }

  // ---------------------------------------------------------------
  // Boot: load boundaries (API first, embedded fallback second)
  // ---------------------------------------------------------------
  async function loadBoundaries() {
    try {
      const geojson = await apiGet('/locations/geojson');
      return geojson;
    } catch (err) {
      DEMO_MODE = true;
      // Normalize embedded static file to the same shape the API would return
      const gj = window.KANNUR_GEOJSON;
      const normalized = {
        type: 'FeatureCollection',
        features: gj.features.map((f) => ({
          type: 'Feature',
          properties: {
            id: f.properties.LSGI_Code,
            name: f.properties.name,
            localAuthType: f.properties.local_auth,
            blockGroup: f.properties.block_group,
            district: f.properties.District
          },
          geometry: f.geometry
        }))
      };
      return normalized;
    }
  }

  async function boot() {
    initMap();
    renderLegend();

    const dateInput = document.getElementById('dateInput');
    dateInput.value = todayStr();
    dateInput.max = todayStr();
    dateInput.addEventListener('change', () => loadMapData(dateInput.value));

    const geojson = await loadBoundaries();
    renderGeoLayer(geojson);
    if (geoLayer.getBounds().isValid()) map.fitBounds(geoLayer.getBounds(), { padding: [40, 40] });

    await loadMapData(todayStr());
    if (geoLayer) geoLayer.setStyle(styleFor);
    // re-bind tooltips with fresh data
    geoLayer.eachLayer((layer) => {
      const p = layer.feature.properties;
      const data = mapDataByLocation[p.id];
      const mm = data ? data.avgRainfallMm : demoValueFor(p.id);
      layer.unbindTooltip();
      layer.bindTooltip(`${p.name} — ${mm} mm`, { sticky: true });
    });

    populateReportForm(geojson);
  }

  // ---------------------------------------------------------------
  // Report form
  // ---------------------------------------------------------------
  function populateReportForm(geojson) {
    const blockSelect = document.getElementById('blockSelect');
    const locationSelect = document.getElementById('locationSelect');

    const byBlock = {};
    geojson.features.forEach((f) => {
      const b = f.properties.blockGroup;
      byBlock[b] = byBlock[b] || [];
      byBlock[b].push(f.properties);
    });

    Object.keys(byBlock).sort().forEach((block) => {
      const opt = document.createElement('option');
      opt.value = block;
      opt.textContent = block;
      blockSelect.appendChild(opt);
    });

    blockSelect.addEventListener('change', () => {
      locationSelect.innerHTML = '';
      const list = byBlock[blockSelect.value] || [];
      if (!list.length) {
        locationSelect.disabled = true;
        locationSelect.innerHTML = '<option value="">Choose a block first…</option>';
        return;
      }
      locationSelect.disabled = false;
      locationSelect.innerHTML = '<option value="">Choose…</option>' +
        list.sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => `<option value="${p.id}">${p.name} (${p.localAuthType.replace(/_/g, ' ')})</option>`).join('');
    });

    const obsDate = document.getElementById('obsDate');
    obsDate.value = todayStr();
    obsDate.max = todayStr();
  }

  document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('formStatus');
    const submitBtn = e.target.querySelector('.btn-submit');

    const payload = {
      locationId: document.getElementById('locationSelect').value,
      observationDate: document.getElementById('obsDate').value,
      rainfallMm: document.getElementById('rainfallInput').value,
      locality: document.getElementById('localityInput').value,
      reporterName: document.getElementById('reporterName').value,
      reporterSchool: document.getElementById('reporterSchool').value,
      notes: document.getElementById('notesInput').value
    };

    if (!payload.locationId) {
      statusEl.textContent = 'Please choose a block and panchayat/municipality.';
      statusEl.className = 'form-status err';
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = 'Submitting…';
    statusEl.className = 'form-status';

    if (DEMO_MODE) {
      // No backend available in this preview — explain instead of failing silently.
      setTimeout(() => {
        statusEl.textContent = 'Demo mode: this would be saved once the backend is running. Set up MongoDB + `npm start` in /backend to go live.';
        statusEl.className = 'form-status err';
        submitBtn.disabled = false;
      }, 500);
      return;
    }

    try {
      await apiPost('/readings', payload);
      
      e.target.reset();
      document.getElementById('locationSelect').innerHTML = '<option value="">Choose a block first…</option>';
      document.getElementById('locationSelect').disabled = true;
      document.getElementById('obsDate').value = todayStr();
      
      statusEl.textContent = '';
      statusEl.className = 'form-status';

      // Show toast
      const toast = document.getElementById('toast');
      toast.textContent = 'Thank you for your submission!';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 4000);

      // Switch to map view
      document.querySelector('.nav-btn[data-view="map"]').click();

      // Reload map data to reflect the potential changes if verified immediately
      // or just to refresh the state
      loadMapData(document.getElementById('dateInput').value);

    } catch (err) {
      statusEl.textContent = 'Could not submit: ' + err.message;
      statusEl.className = 'form-status err';
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ---------------------------------------------------------------
  // Admin panel
  // ---------------------------------------------------------------
  document.getElementById('adminLoadBtn').addEventListener('click', async () => {
    const key = document.getElementById('adminKeyInput').value;
    const listEl = document.getElementById('adminList');
    listEl.innerHTML = '<p class="muted">Loading…</p>';
    try {
      const res = await fetch(API + '/admin/readings/pending', { headers: { 'x-admin-key': key } });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const readings = await res.json();
      renderAdminList(readings, key);
    } catch (err) {
      listEl.innerHTML = `<p class="muted">Could not load: ${err.message}${DEMO_MODE ? ' (backend not reachable — this panel needs the live API)' : ''}</p>`;
    }
  });

  function renderAdminList(readings, key) {
    const listEl = document.getElementById('adminList');
    if (!readings.length) {
      listEl.innerHTML = '<p class="muted">No pending readings. Nice and caught up.</p>';
      return;
    }
    listEl.innerHTML = readings.map((r) => `
      <div class="admin-card" data-id="${r._id}">
        <div class="ac-top">
          <span class="ac-title">${r.locationName}</span>
          <span class="ac-mm">${r.rainfallMm} mm</span>
        </div>
        <div class="ac-meta">${r.blockGroup} · reported by ${r.reporterName}${r.reporterSchool ? ' · ' + r.reporterSchool : ''} · ${new Date(r.observationDate).toLocaleDateString('en-IN')}</div>
        ${r.notes ? `<div class="ac-meta">"${r.notes}"</div>` : ''}
        <div class="ac-actions">
          <button class="ac-btn verify">Verify</button>
          <button class="ac-btn reject">Reject</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.admin-card').forEach((card) => {
      const id = card.dataset.id;
      card.querySelector('.verify').addEventListener('click', () => moderate(id, 'verified', key, card));
      card.querySelector('.reject').addEventListener('click', () => moderate(id, 'rejected', key, card));
    });
  }

  async function moderate(id, status, key, card) {
    try {
      const res = await fetch(API + '/admin/readings/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      card.remove();
    } catch (err) {
      alert('Could not update: ' + err.message);
    }
  }

  boot();
})();
