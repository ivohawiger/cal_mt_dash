// JavaScript pro mapu pojistných událostí

const TIA_TEST_MODE = true;
const selectedIds = new Set();
const markers = {};
let aktivniFiltr = null;
let lastDrawnLayer = null;


function showAlert(message, success = true) {
  const bar = document.getElementById('alertbar');
  bar.className = success ? 'alert-success' : 'alert-error';
  bar.innerText = message;
  bar.style.display = 'block';
  setTimeout(() => { bar.style.display = 'none'; }, 3000);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' && selectedIds.size > 0) {
    e.preventDefault();
    zrusitPrirazeni();
  }
});

function toggleRegion(id) {
  const el = document.getElementById('group-' + id);
  if (el) {
    el.classList.toggle('hidden');
    const arrow = document.querySelector(`#region-label-${id} .arrow`);
    if (arrow) arrow.textContent = el.classList.contains('hidden') ? '▲' : '▼';
  }
}

function toggleAllRegions(show) {
  document.querySelectorAll('.region-body').forEach(el => {
    el.classList.toggle('hidden', !show);
    const region = el.id.replace('group-', '');
    const arrow = document.querySelector(`#region-label-${region} .arrow`);
    if (arrow) arrow.textContent = show ? '▼' : '▲';
  });
}

function resetFilter() {
  aktivniFiltr = null;
  for (const marker of Object.values(markers)) marker.addTo(map);
  document.querySelectorAll('.active-technician').forEach(el => el.classList.remove('active-technician'));
}

function handleTechnicianClick(name) {
  if (selectedIds.size > 0) priraditTechnika(name);
  else filterByTechnik(name);
}

function filterByTechnik(name) {
  aktivniFiltr = name;
  for (const [id, marker] of Object.entries(markers)) {
    const popupText = marker.getPopup().getContent();
    const assigned = popupText.includes(`Přiřazeno:</strong> ${name}`);
    if (assigned) marker.addTo(map);
    else map.removeLayer(marker);
  }
  document.querySelectorAll('.active-technician').forEach(el => el.classList.remove('active-technician'));
  const el = document.getElementById('technician-' + name.replace(/ /g, '_'));
  if (el) el.classList.add('active-technician');
}

function aktualizujSidebar(prirazeniMap) {
  const counts = {};
  for (const id in prirazeniMap) {
    const t = prirazeniMap[id];
    counts[t] = (counts[t] || 0) + 1;
  }
  const regionTotals = {};
  document.querySelectorAll('[id^="technician-"]').forEach(el => {
    const name = el.querySelector('.tech-name').innerText;
    const regionId = el.dataset.region;
    const count = counts[name] || 0;
    el.querySelector('.tech-count').innerText = count;
    regionTotals[regionId] = (regionTotals[regionId] || 0) + count;
  });
  for (const region in regionTotals) {
    const regionLabel = document.getElementById('region-label-' + region);
    if (regionLabel) regionLabel.nextSibling.textContent = ` (${regionTotals[region]}) ▼`;
  }
}

function priraditTechnika(technik) {
  const ids = Array.from(selectedIds);
  fetch('/priradit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ udalost_id: ids, technik: technik })
  })
  .then(res => res.json())
  .then(data => {
    if (TIA_TEST_MODE) {
      ids.forEach(id => {
        const marker = markers[id];
        marker.setPopupContent(`<strong>Udalost ${id}</strong><br><strong>Přiřazeno:</strong> ${technik}`);
        marker.setIcon(getIcon(true));
        marker.getElement().classList.remove('selected-marker');
      });
      selectedIds.clear();
      aktualizujSidebar(data.prirazeni);
      filterByTechnik(technik);
      showAlert('Přiřazení bylo úspěšné. (Testovací režim)', true);
    }
  })
  .catch(() => {
    showAlert('Chyba při ukládání přiřazení na server.', false);
  });
}

function zrusitVyber() {
  selectedIds.forEach(id => {
    const marker = markers[id];
    if (marker && marker.getElement()) {
      marker.getElement().classList.remove('highlighted-marker');
    }
  });
  selectedIds.clear();
  document.getElementById('btn-zrusit-vyber').disabled = true;
}


function zrusitPrirazeni() {
  const ids = Array.from(selectedIds);
  if (ids.length === 0) {
    showAlert('Nejsou vybrány žádné události ke zrušení.', false);
    return;
  }
  if (!confirm(`Opravdu chcete zrušit přiřazení u ${ids.length} událostí?`)) return;

  fetch('/priradit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ udalost_id: ids, technik: null })
  })
  .then(res => res.json())
  .then(data => {
    ids.forEach(id => {
      const marker = markers[id];
      marker.setPopupContent(`<strong>Udalost ${id}</strong><br><em>Nepřiřazeno</em>`);
      marker.setIcon(getIcon(false));
      marker.getElement().classList.remove('selected-marker');
    });
    selectedIds.clear();
    aktualizujSidebar(data.prirazeni);
    showAlert('Přiřazení bylo zrušeno.', true);
  })
  .catch(() => {
    showAlert('Chyba při hromadném rušení přiřazení.', false);
  });
}

const map = L.map('map').setView([49.8, 15.5], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

function getIcon(assigned) {
  const url = assigned
    ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
    : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
  return L.icon({
    iconUrl: url,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

window.toggleRegion = toggleRegion;
window.toggleAllRegions = toggleAllRegions;
window.toggleRegionToggle = toggleRegionToggle;

function startPolygonSelection() {
  const drawControl = new L.Draw.Polygon(map, {
    shapeOptions: { color: 'blue', weight: 2, fillOpacity: 0.1 }
  });
  drawControl.enable();

  map.once(L.Draw.Event.CREATED, function (e) {
    const layer = e.layer;
    const polygon = layer.toGeoJSON();
    const inside = [];

    Object.entries(markers).forEach(([id, marker]) => {
      const point = turf.point([marker.getLatLng().lng, marker.getLatLng().lat]);
      if (turf.booleanPointInPolygon(point, polygon)) {
        selectedIds.add(Number(id));
        const el = marker.getElement();
        if (el) {
  el.classList.add('highlighted-marker');
  document.getElementById('btn-zrusit-vyber').disabled = false;
}
        inside.push(id);
      }
    });

    if (inside.length === 0) {
      showAlert('V oblasti nebyly nalezeny žádné události.', false);
    } else {
      showAlert(`Vybráno ${inside.length} událostí.`);
    }
  });
}

window.startPolygonSelection = startPolygonSelection;

let udalosti = window.udalosti;
if (!udalosti) {
  try {
    const raw = document.getElementById('data-holder')?.dataset.udalosti;
    if (raw) udalosti = JSON.parse(raw);
  } catch (e) {
    console.error('Chyba při načítání dat pojistných událostí:', e);
    showAlert('⚠️ Chyba při načítání dat.', false);
    udalosti = [];
  }
}
udalosti.forEach(u => {
  const icon = getIcon(!!u.technik);
  const marker = L.marker([u.lat, u.lon], { icon }).addTo(map);
  const popup = `<strong>${u.popis}</strong><br>ID: ${u.id}` + (u.technik ? `<br><strong>Přiřazeno:</strong> ${u.technik}` : '');
  marker.bindPopup(popup);

  marker.on('click', (e) => {
    if (e.originalEvent.shiftKey) {
      const el = marker.getElement();
      if (selectedIds.has(u.id)) {
        selectedIds.delete(u.id);
        el.classList.remove('highlighted-marker');
      } else {
        selectedIds.add(u.id);
        el.classList.add('selected-marker');
      }
    } else {
      marker.openPopup();
    }
  });

  marker.on('contextmenu', (e) => {
    e.originalEvent.preventDefault();
    if (confirm(`Opravdu chcete zrušit přiřazení události ${u.id}?`)) {
      fetch('/priradit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ udalost_id: [u.id], technik: null })
      })
      .then(res => res.json())
      .then(data => {
        marker.setPopupContent(`<strong>Udalost ${u.id}</strong><br><em>Nepřiřazeno</em>`);
        marker.setIcon(getIcon(false));
        aktualizujSidebar(data.prirazeni);
        showAlert('Přiřazení bylo zrušeno.', true);
      })
      .catch(() => {
        showAlert('Chyba při rušení přiřazení.', false);
      });
    }
  });

  markers[u.id] = marker;
});

function startRectangleSelection() {
  const drawControl = new L.Draw.Rectangle(map);
  drawControl.enable();
}

function startCircleSelection() {
  const drawControl = new L.Draw.Circle(map);
  drawControl.enable();
}

map.on(L.Draw.Event.CREATED, function (e) {
  const layer = e.layer;
  const type = e.layerType;

  if (lastDrawnLayer) {
    map.removeLayer(lastDrawnLayer);
  }
  lastDrawnLayer = e.layer;
  map.addLayer(lastDrawnLayer);

  if (type === 'rectangle') {
    const bounds = layer.getBounds();
    window.udalosti.forEach(u => {
      const marker = markers[u.id];
      if (marker && bounds.contains(marker.getLatLng())) {
        const el = marker.getElement();
        el.classList.add('highlighted-marker');
        selectedIds.add(u.id);
      }
    });
  }

  if (type === 'circle') {
    const center = layer.getLatLng();
    const radius = layer.getRadius();
    window.udalosti.forEach(u => {
      const marker = markers[u.id];
      if (marker && center.distanceTo(marker.getLatLng()) <= radius) {
        const el = marker.getElement();
        el.classList.add('highlighted-marker');
        selectedIds.add(u.id);
      }
    });
  }

  if (type === 'polygon') {
    const polygon = layer.toGeoJSON();
    window.udalosti.forEach(u => {
      const point = turf.point([u.lon, u.lat]);
      if (turf.booleanPointInPolygon(point, polygon)) {
        const marker = markers[u.id];
        const el = marker.getElement();
        el.classList.add('highlighted-marker');
        selectedIds.add(u.id);
      }
    });
  }

  document.getElementById('btn-zrusit-vyber').disabled = selectedIds.size === 0;
});

function removeSelectionShape() {
  if (lastDrawnLayer) {
    map.removeLayer(lastDrawnLayer);
    lastDrawnLayer = null;
  }
}


