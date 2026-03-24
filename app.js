// --- DEFAULTS ---
const DEFAULT_VIEW = { lat: 51.1079, lng: 17.0385, zoom: 8 };
const DEFAULT_LANG = "en";

// --- URL PARAMS ---
function getParams() {
  const p = new URLSearchParams(location.search);
  return {
    year: parseInt(p.get("year")) || 1850,
    type: p.get("type") || "Births",
    regions: p.get("regions") ? p.get("regions").split(",") : [],
    lat: parseFloat(p.get("lat")) || DEFAULT_VIEW.lat,
    lng: parseFloat(p.get("lng")) || DEFAULT_VIEW.lng,
    zoom: parseInt(p.get("zoom")) || DEFAULT_VIEW.zoom,
    lang: p.get("lang") || DEFAULT_LANG
  };
}

function updateURL() {
  const params = new URLSearchParams();
  params.set("year", state.year);
  params.set("type", state.type);
  params.set("regions", state.regions.join(","));
  params.set("lat", map.getCenter().lat.toFixed(4));
  params.set("lng", map.getCenter().lng.toFixed(4));
  params.set("zoom", map.getZoom());
  params.set("lang", state.lang);
  history.replaceState(null, "", "?" + params.toString());
}

// --- STATE ---
const params = getParams();

let state = {
  year: params.year,
  type: params.type,
  regions: params.regions,
  lang: params.lang
};

let translations = {};
let layers = {};

// --- MAP ---
const map = L.map('map').setView([params.lat, params.lng], params.zoom);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

// --- I18N ---
async function loadTranslations(lang) {
  const res = await fetch(`./i18n/${lang}.json`);
  translations = await res.json();
}

function t(key) {
  return translations[key] || key;
}

function applyTranslations() {
  document.getElementById("title").textContent = t("filters");
  document.getElementById("yearLabel").textContent = t("year");
  document.getElementById("typeLabel").textContent = t("recordType");
  document.getElementById("regionsLabel").textContent = t("regions");

  // record types
  const recordType = document.getElementById("recordType");
  recordType.innerHTML = "";
  ["Births","Marriages","Deaths"].forEach(type => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = t(type);
    recordType.appendChild(opt);
  });
  recordType.value = state.type;

  // legend
  document.getElementById("legend").innerHTML = `
    <span><span class="dot green"></span>${t("available")}</span>
    <span><span class="dot red"></span>${t("missing")}</span>
    <span><span class="dot gray"></span>${t("none")}</span>
  `;

  // regions
  const regionList = document.getElementById("regionList");
  regionList.innerHTML = "";

  const regions = [
    { id: "poland/dolnoslaskie", name: t("dolnoslaskie") },
    { id: "poland/mazowieckie", name: t("mazowieckie") },
    { id: "belarus", name: t("belarus") },
    { id: "adama", name: t("adama") }
  ];

  regions.forEach(r => {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = r.id;
    cb.checked = state.regions.includes(r.id);

    cb.addEventListener("change", () => {
      if (cb.checked) {
        loadRegion(r.id);
        state.regions.push(r.id);
      } else {
        unloadRegion(r.id);
        state.regions = state.regions.filter(x => x !== r.id);
      }
      updateURL();
    });

    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + r.name));
    regionList.appendChild(label);
  });
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

function createIcon(color) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;"></div>`
  });
}

function updateMap() {
  Object.values(layers).forEach(layerGroup => {
    layerGroup.eachLayer(layer => {
      const color = getColor(layer.feature.properties.records, state.type, state.year);
      layer.setIcon(createIcon(color));
    });
  });
}

// --- REGIONS ---
function loadRegion(path) {
  if (layers[path]) return;

  fetch(`./data/${path}/data.geojson`)
    .then(r => r.json())
    .then(data => {
      const layer = L.geoJSON(data, {
        pointToLayer: (f, latlng) => L.marker(latlng, { icon: createIcon("gray") }),
        onEachFeature: (f, l) => l.bindPopup(f.properties.name)
      }).addTo(map);

      layers[path] = layer;
      updateMap();
    });
}

function unloadRegion(path) {
  if (!layers[path]) return;
  map.removeLayer(layers[path]);
  delete layers[path];
}

// --- CONTROLS ---
const slider = document.getElementById("yearSlider");
const yearValue = document.getElementById("yearValue");
const recordType = document.getElementById("recordType");

slider.value = state.year;
yearValue.textContent = state.year;

slider.addEventListener("input", () => {
  state.year = parseInt(slider.value);
  yearValue.textContent = state.year;
  updateMap();
  updateURL();
});

recordType.addEventListener("change", () => {
  state.type = recordType.value;
  updateMap();
  updateURL();
});

// --- MAP SYNC ---
map.on("moveend", updateURL);

// --- LANGUAGE TOGGLE ---
document.getElementById("langToggle").addEventListener("click", async () => {
  state.lang = state.lang === "en" ? "pl" : "en";
  await loadTranslations(state.lang);
  applyTranslations();
  updateURL();
});

// --- controls toggle ---

const controls = document.getElementById("controls");
const header = document.getElementById("controls-header");
const toggleBtn = document.getElementById("toggleControls");

function toggleControls() {
  controls.classList.toggle("collapsed");

  toggleBtn.textContent =
    controls.classList.contains("collapsed") ? "▲" : "▼";
}

// Click on button
toggleBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // prevent double trigger
  toggleControls();
});

// Click on header (better UX)
header.addEventListener("click", () => {
  toggleControls();
});

// --- INIT ---
(async function init() {
  await loadTranslations(state.lang);
  applyTranslations();

  state.regions.forEach(loadRegion);
})();
