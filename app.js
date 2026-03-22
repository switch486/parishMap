// --- MAP INIT ---
const map = L.map('map').setView([51.1079, 17.0385], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// --- STATE ---
let layers = {};

// --- URL PARAMS ---

function getParams() {
  const params = new URLSearchParams(window.location.search);

  return {
    year: parseInt(params.get("year")) || 1850,
    type: params.get("type") || "Births",
    regions: params.get("regions") ? params.get("regions").split(",") : []
  };
}

function updateURL(year, type, regions) {
  const params = new URLSearchParams();

  params.set("year", year);
  params.set("type", type);

  if (regions.length > 0) {
    params.set("regions", regions.join(","));
  }

  history.replaceState(null, "", "?" + params.toString());
}

// --- DATA LOGIC ---

function hasType(records, type) {
  return records.some(r => r.type === type);
}

function hasTypeInYear(records, type, year) {
  return records.some(r =>
    r.type === type &&
    r.periods.some(p => year >= p.from && year <= p.to)
  );
}

function getColor(records, type, year) {
  if (!hasType(records, type)) return "gray";
  if (hasTypeInYear(records, type, year)) return "green";
  return "red";
}

// --- ICON ---

function createIcon(color) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background:${color};
      width:14px;
      height:14px;
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 0 4px rgba(0,0,0,0.5);
    "></div>`
  });
}

// --- POPUP ---

function formatPopup(properties) {
  let html = `<div class="popup-content">`;
  html += `<b>${properties.name}</b><br><hr>`;

  properties.records.forEach(r => {
    html += `<div class="record"><b>${r.type}</b><br>`;
    r.periods.forEach(p => {
      html += `${p.from}–${p.to} <a href="${p.url}" target="_blank">🔗</a><br>`;
    });
    html += `</div>`;
  });

  html += `</div>`;
  return html;
}

// --- UPDATE MAP ---

function updateMap(year, type) {
  Object.values(layers).forEach(layerGroup => {
    layerGroup.eachLayer(layer => {
      const props = layer.feature.properties;
      const color = getColor(props.records, type, year);
      layer.setIcon(createIcon(color));
    });
  });
}

// --- REGION LOADING ---

function loadRegion(regionPath) {
  if (layers[regionPath]) return;

  fetch(`./data/${regionPath}/data.geojson`)
    .then(res => res.json())
    .then(data => {

      const layer = L.geoJSON(data, {
        pointToLayer: (feature, latlng) =>
          L.marker(latlng, { icon: createIcon("gray") }),
        onEachFeature: (feature, layer) =>
          layer.bindPopup(formatPopup(feature.properties))
      }).addTo(map);

      layers[regionPath] = layer;

      updateMap(currentYear, currentType);
    });
}

function unloadRegion(regionPath) {
  if (!layers[regionPath]) return;

  map.removeLayer(layers[regionPath]);
  delete layers[regionPath];
}

// --- CONTROLS INIT FROM URL ---

const params = getParams();

let currentYear = params.year;
let currentType = params.type;

// DOM refs
const slider = document.getElementById("yearSlider");
const yearValue = document.getElementById("yearValue");
const recordType = document.getElementById("recordType");
const regionCheckboxes = document.querySelectorAll("#regionList input");

// Apply initial state
slider.value = currentYear;
yearValue.textContent = currentYear;
recordType.value = currentType;

// Apply region selection
regionCheckboxes.forEach(cb => {
  if (params.regions.includes(cb.value)) {
    cb.checked = true;
  }
});

// --- LOAD INITIAL REGIONS ---

document.querySelectorAll("#regionList input:checked")
  .forEach(cb => loadRegion(cb.value));

// --- CONTROLS EVENTS ---

slider.addEventListener("input", () => {
  currentYear = parseInt(slider.value);
  yearValue.textContent = currentYear;

  updateMap(currentYear, currentType);
  syncURL();
});

recordType.addEventListener("change", () => {
  currentType = recordType.value;

  updateMap(currentYear, currentType);
  syncURL();
});

// region changes
regionCheckboxes.forEach(cb => {
  cb.addEventListener("change", () => {
    if (cb.checked) {
      loadRegion(cb.value);
    } else {
      unloadRegion(cb.value);
    }
    syncURL();
  });
});

// --- URL SYNC ---

function getSelectedRegions() {
  return Array.from(regionCheckboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

function syncURL() {
  updateURL(currentYear, currentType, getSelectedRegions());
}

// --- COLLAPSIBLE PANEL ---

const controls = document.getElementById("controls");
const toggleBtn = document.getElementById("toggleControls");

toggleBtn.addEventListener("click", () => {
  controls.classList.toggle("collapsed");
  toggleBtn.textContent =
    controls.classList.contains("collapsed") ? "▲" : "▼";
});
