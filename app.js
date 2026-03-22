// Map init
const map = L.map('map').setView([51.1079, 17.0385], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let geoLayer;

// --- DATA LOGIC (UPDATED FOR MULTIPLE TIMESPANS) ---

function hasType(records, type) {
  return records.some(r => r.type === type);
}

function hasTypeInYear(records, type, year) {
  return records.some(r =>
    r.type === type &&
    r.periods.some(p => year >= p.from && year <= p.to)
  );
}

// --- COLOR LOGIC ---

function getColor(records, type, year) {
  if (!hasType(records, type)) return "gray";
  if (hasTypeInYear(records, type, year)) return "green";
  return "red";
}

// --- ICON FACTORY ---

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
  html += `<b>${properties.name}</b><br>`;
  html += `<hr>`;

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

// --- LOAD DATA ---

let layers = {};

function loadRegion(regionPath) {
  // Skip if already loaded
  if (layers[regionPath]) return;

  fetch(`./data/${regionPath}/data.geojson`)
    .then(res => res.json())
    .then(data => {

      const layer = L.geoJSON(data, {
        pointToLayer: function (feature, latlng) {
          return L.marker(latlng, {
            icon: createIcon("gray")
          });
        },
        onEachFeature: function (feature, layer) {
          layer.bindPopup(formatPopup(feature.properties));
        }
      }).addTo(map);

      layers[regionPath] = layer;

      updateMap(
        parseInt(slider.value),
        recordType.value
      );
    })
    .catch(err => console.error("Error loading region:", err));
}

function unloadRegion(regionPath) {
  if (!layers[regionPath]) return;

  map.removeLayer(layers[regionPath]);
  delete layers[regionPath];
}

const regionCheckboxes = document.querySelectorAll("#regionList input");

regionCheckboxes.forEach(cb => {
  cb.addEventListener("change", () => {
    const region = cb.value;

    if (cb.checked) {
      loadRegion(region);
    } else {
      unloadRegion(region);
    }
  });
});

// --- CONTROLS ---

const slider = document.getElementById("yearSlider");
const yearValue = document.getElementById("yearValue");
const recordType = document.getElementById("recordType");

slider.addEventListener("input", () => {
  const year = parseInt(slider.value);
  yearValue.textContent = year;
  updateMap(year, recordType.value);
});

recordType.addEventListener("change", () => {
  updateMap(parseInt(slider.value), recordType.value);
});

// --- select Region ---

const regionSelect = document.getElementById("regionSelect");

regionSelect.addEventListener("change", () => {
  loadRegion(regionSelect.value);
});

document.querySelectorAll("#regionList input:checked")
  .forEach(cb => loadRegion(cb.value));

// --- COLLAPSIBLE PANEL ---

const controls = document.getElementById("controls");
const toggleBtn = document.getElementById("toggleControls");

toggleBtn.addEventListener("click", () => {
  controls.classList.toggle("collapsed");
  toggleBtn.textContent = controls.classList.contains("collapsed") ? "▲" : "▼";
});
