// app.js

let state = {
  soc: 25.0,
  range: 105,
  soh: 94.8,
  temp: 32,
  weather: 'normal',
  traffic: 'clear',
  activeTab: 'dashboard',
  currentRoute: 'pune-mumbai',
  sohHistory: [96.2, 95.9, 95.7, 95.4, 95.1, 94.8],
  voltages: [4.12, 4.11, 4.13, 3.85, 4.12, 4.12, 4.11, 4.12],
  map: null,
  markers: []
};

const chargingStations = [
  { id: 1, name: "Tata Power EZ Charge — Talegaon Plaza", network: "Tata Power", lat: 18.7214, lng: 73.6742, power: 50, tariff: 16.5, wait: 5, connector: "CCS-2" },
  { id: 2, name: "Jio-bp Pulse — Lonavala Expressway", network: "Jio-bp", lat: 18.7557, lng: 73.4091, power: 60, tariff: 18.5, wait: 12, connector: "CCS-2 / Type-2" },
  { id: 3, name: "Zeon Fast Charger — Khalapur Court", network: "Zeon", lat: 18.8252, lng: 73.3089, power: 50, tariff: 17.0, wait: 8, connector: "CCS-2" },
  { id: 4, name: "Magenta ChargeGrid — Navi Mumbai Hub", network: "Magenta", lat: 19.0150, lng: 73.0850, power: 150, tariff: 21.0, wait: 2, connector: "CCS-2 / Bharat AC-001" }
];

document.addEventListener("DOMContentLoaded", () => {
  initUI();
  switchTab('dashboard');
  initSimulatorControls();
  runEdgeInferenceLoop();
});

function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.dock-item').forEach(el => {
    el.classList.remove('active');
    if (el.dataset.tab === tabId) el.classList.add('active');
  });

  document.getElementById("app-screen-content").innerHTML = getTabHTML(tabId);

  if (tabId === 'dashboard') {
    updateDashboardUI();
  } else if (tabId === 'chargers') {
    initLeafletMap();
    renderChargerList();
  } else if (tabId === 'health') {
    drawSohChart('soh-canvas', state.sohHistory);
    drawVoltageBalanceChart('voltage-canvas', state.voltages);
    updateHealthUI();
  } else if (tabId === 'planner') {
    calculatePlan();
  }
}

function initUI() {
  document.getElementById("app-container").innerHTML = `
    <div class="phone-container">
      <div class="status-bar">
        <div class="status-time">10:42 IST</div>
        <div class="status-icons">
          <span>📶</span>
          <span>⚡</span>
          <span>94%</span>
        </div>
      </div>

      <div class="app-screen" id="app-screen-content"></div>

      <div class="dock-bar">
        <div class="dock-item" data-tab="dashboard" onclick="switchTab('dashboard')">
          <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>Dash</span>
        </div>
        <div class="dock-item" data-tab="chargers" onclick="switchTab('chargers')">
          <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          <span>Map</span>
        </div>
        <div class="dock-item" data-tab="health" onclick="switchTab('health')">
          <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
          <span>Health</span>
        </div>
        <div class="dock-item" data-tab="planner" onclick="switchTab('planner')">
          <svg viewBox="0 0 24 24"><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>
          <span>Plan</span>
        </div>
      </div>
    </div>

    <div class="simulator-panel">
      <div class="sim-title">Edge AI Simulator</div>

      <div class="slider-group">
        <div class="slider-header">
          <span>Battery SoC</span>
          <span class="slider-val" id="val-soc">25%</span>
        </div>
        <input type="range" class="sim-slider" id="slider-soc" min="5" max="100" value="25"
          oninput="adjustSim('soc', this.value)">
      </div>

      <div class="slider-group">
        <div class="slider-header">
          <span>Battery Temp</span>
          <span class="slider-val" id="val-temp">32°C</span>
        </div>
        <input type="range" class="sim-slider" id="slider-temp" min="15" max="55" value="32"
          oninput="adjustSim('temp', this.value)">
      </div>

      <div class="slider-group">
        <div class="slider-header"><span>Ambient Weather</span></div>
        <select class="select-field" id="select-weather" onchange="adjustSim('weather', this.value)">
          <option value="normal">Normal (28°C — Pune/Mumbai)</option>
          <option value="hot">Extreme Heat (43°C — Summer)</option>
          <option value="freezing">Cold Morning (12°C — Winter)</option>
        </select>
      </div>

      <div class="slider-group">
        <div class="slider-header"><span>Traffic Density (NH-48)</span></div>
        <select class="select-field" id="select-traffic" onchange="adjustSim('traffic', this.value)">
          <option value="clear">Clear Flow</option>
          <option value="moderate">Moderate Congestion</option>
          <option value="heavy">Weekend Gridlock</option>
        </select>
      </div>

      <div class="slider-group">
        <div class="slider-header"><span>MSEDCL Tariff Slot</span></div>
        <select class="select-field" id="select-tariff" onchange="adjustSim('tariff', this.value)">
          <option value="offpeak">Off-Peak (22:00–06:00) — ₹14.5/kWh</option>
          <option value="normal">Normal (06:00–18:00) — ₹18.5/kWh</option>
          <option value="peak">Peak (18:00–22:00) — ₹22.0/kWh</option>
        </select>
      </div>

      <div style="font-size: 11px; color: var(--text-secondary); border-top: 1px solid var(--card-border); padding-top: 10px; margin-top: 4px; line-height: 1.7;">
        <span style="font-weight: 700; color: var(--accent-green);">Edge Diagnostics</span><br>
        Inference Latency: <span id="diag-latency">18 ms</span><br>
        Model Version: 2.1.8-quant (INT8)<br>
        Standards: ARAI AIS 156 Phase 2<br>
        SQLite Queue: 0 pending
      </div>
    </div>
  `;
}

function getTabHTML(tabId) {
  switch (tabId) {

    case 'dashboard':
      return `
        <div class="app-header">
          <div class="brand-title">ChargeWise</div>
          <div class="edge-badge">Edge Active</div>
        </div>

        <div class="safety-alert" id="safety-alarm-banner">
          <div class="safety-alert-icon">⚠️</div>
          <div>
            <div class="safety-alert-title" id="safety-alarm-title">THERMAL WARNING</div>
            <div class="safety-alert-desc" id="safety-alarm-desc">High battery temperature detected. AIS 156 thermal limits enforced.</div>
          </div>
        </div>

        <div class="card hero-stats">
          <div class="soc-display">
            <span class="soc-percentage" id="dash-soc">${Math.round(state.soc)}%</span>
            <span class="soc-label">🔋 State of Charge</span>
          </div>
          <div class="range-display">
            <span class="range-val" id="dash-range">${state.range} km</span>
            <div class="range-label">Est. Range Remaining</div>
          </div>
        </div>

        <div class="card" style="padding: 14px 18px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Active Route</div>
            <div style="font-size: 15px; font-weight: 700; font-family: var(--font-display); margin-top: 2px;">Pune → Mumbai</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">148 km via NH-48 Expressway</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 20px; font-weight: 800; color: var(--accent-amber); font-family: var(--font-display);" id="dash-eta">2h 15m</div>
            <div style="font-size: 10px; color: var(--text-secondary);">Est. Arrival</div>
          </div>
        </div>

        <div class="card reco-card" id="active-recommendation-card">
          <div class="reco-header">
            <span>Charging Recommendation</span>
            <span style="color: var(--accent-green);">Edge Computed</span>
          </div>
          <div class="reco-title" id="reco-title">Stop at Jio-bp Lonavala in 45 km</div>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;" id="reco-desc">
            MSEDCL Normal tariff window active. Charging to 80% SoC here saves roughly ₹120 on total trip cost.
          </p>
          <div class="reco-meta">
            <div class="reco-stat">Recommended Stop<span id="reco-station">Jio-bp Pulse — Lonavala</span></div>
            <div class="reco-stat">MSEDCL Tariff<span id="reco-cost">₹18.5/kWh</span></div>
            <div class="reco-stat">Est. Charging Cost<span id="reco-total">₹ 240</span></div>
            <div class="reco-stat">Wait Time<span id="reco-wait">5 mins</span></div>
          </div>
          <button class="btn btn-primary" onclick="acceptRecommendation()">Accept Charge Route</button>
        </div>
      `;

    case 'chargers':
      return `
        <div class="app-header">
          <div class="brand-title">Nearby Chargers</div>
          <div class="edge-badge">NH-48 Corridor</div>
        </div>

        <div class="map-container">
          <div id="map"></div>
        </div>

        <div class="card" style="padding: 16px;">
          <h3 style="font-size: 14px; margin-bottom: 12px; font-family: var(--font-display);">
            Stations Along Pune → Mumbai (NH-48)
          </h3>
          <div id="station-list-container"></div>
        </div>
      `;

    case 'health':
      return `
        <div class="app-header">
          <div class="brand-title">Battery Health</div>
          <div class="edge-badge">AIS 156</div>
        </div>

        <div class="card" style="text-align: center;">
          <div style="display: flex; gap: 20px; justify-content: space-around; align-items: center;">
            <div class="circular-progress">
              <svg width="140" height="140">
                <circle class="bg-circle" cx="70" cy="70" r="60"/>
                <circle class="fg-circle" id="health-progress-circle" cx="70" cy="70" r="60"/>
              </svg>
              <div class="circular-val" id="health-soh-val">${state.soh}%</div>
            </div>
            <div style="text-align: left;">
              <h3 style="font-family: var(--font-display); font-size: 18px;">Battery SOH</h3>
              <p style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5;">
                Calculated on-device by the TFLite model. Compliant with ARAI AIS 156 Phase 2.
              </p>
              <div style="margin-top: 10px; font-size: 12px; font-weight: 700; color: var(--accent-green);" id="soh-status-text">Excellent Condition</div>
            </div>
          </div>
        </div>

        <div class="card" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 16px;">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">Cell Temp Max</div>
            <div style="font-size: 22px; font-weight: 800; font-family: var(--font-display); color: var(--accent-amber); margin-top: 4px;">${state.temp}°C</div>
            <div style="font-size: 9px; color: var(--text-secondary);">AIS 156 Limit: 50°C</div>
          </div>
          <div style="text-align: center; border-left: 1px solid var(--card-border); border-right: 1px solid var(--card-border);">
            <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">Int. Resistance</div>
            <div style="font-size: 22px; font-weight: 800; font-family: var(--font-display); color: var(--accent-blue); margin-top: 4px;">42 mΩ</div>
            <div style="font-size: 9px; color: var(--text-secondary);">Normal Range</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px;">Current C-Rate</div>
            <div style="font-size: 22px; font-weight: 800; font-family: var(--font-display); color: var(--accent-green); margin-top: 4px;">0.3C</div>
            <div style="font-size: 9px; color: var(--text-secondary);">Optimal Range</div>
          </div>
        </div>

        <div class="card">
          <h3 style="font-size: 13px; font-family: var(--font-display); margin-bottom: 8px;">SOH Degradation Trend (Last 6 Cycles)</h3>
          <canvas id="soh-canvas" width="330" height="120" style="width: 100%; height: 120px;"></canvas>
        </div>

        <div class="card">
          <h3 style="font-size: 13px; font-family: var(--font-display); margin-bottom: 8px;">Cell Voltage Balance (8 Clusters)</h3>
          <canvas id="voltage-canvas" width="330" height="100" style="width: 100%; height: 100px;"></canvas>
          <p style="font-size: 10px; color: var(--text-secondary); margin-top: 8px;">⚠️ Cluster 4 showing slight undervoltage — keep an eye on it next charge cycle.</p>
        </div>
      `;

    case 'planner':
      return `
        <div class="app-header">
          <div class="brand-title">Charge Planner</div>
          <div class="edge-badge">MSEDCL Aware</div>
        </div>

        <div class="card">
          <div class="input-group">
            <label class="input-label">Origin</label>
            <input type="text" class="input-field" value="Pune, Maharashtra" disabled>
          </div>
          <div class="input-group">
            <label class="input-label">Destination</label>
            <input type="text" class="input-field" value="Mumbai, Maharashtra" disabled>
          </div>
          <div class="input-group">
            <label class="input-label">Optimization Priority</label>
            <select class="select-field" style="background: rgba(15,23,42,0.8);" id="opt-priority" onchange="calculatePlan()">
              <option value="balanced">Balanced — Min Cost + Min Time</option>
              <option value="cost">Minimize Charging Cost (₹)</option>
              <option value="health">Maximize Battery Health (SOH)</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="calculatePlan()">Compute Optimal Schedule</button>
        </div>

        <div class="card" id="plan-results-card">
          <div class="reco-header">Optimized Route Itinerary</div>
          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 14px;" id="plan-itinerary"></div>
        </div>
      `;
  }
}

function adjustSim(key, val) {
  if (key === 'soc') {
    state.soc = parseFloat(val);
    document.getElementById("val-soc").innerText = val + "%";
  } else if (key === 'temp') {
    state.temp = parseInt(val);
    document.getElementById("val-temp").innerText = val + "°C";
  } else if (key === 'weather') {
    state.weather = val;
  } else if (key === 'traffic') {
    state.traffic = val;
  }
  runEdgeInferenceLoop();
}

function runEdgeInferenceLoop() {
  // ~4.2 km per 1% SoC on a 40.5 kWh pack (Nexon EV baseline)
  let rangeFactor = 4.2;

  if (state.weather === 'freezing') rangeFactor *= 0.78;
  else if (state.weather === 'hot') rangeFactor *= 0.93;

  if (state.traffic === 'heavy') rangeFactor *= 0.84;
  else if (state.traffic === 'moderate') rangeFactor *= 0.93;

  state.range = Math.round(state.soc * rangeFactor);

  if (state.temp > 45) {
    state.sohHistory = [96.2, 95.8, 95.5, 95.0, 94.4, 93.6];
    state.soh = 93.6;
    state.voltages = [4.12, 4.08, 4.14, 3.75, 4.11, 4.09, 4.02, 4.10];
  } else {
    state.sohHistory = [96.2, 95.9, 95.7, 95.4, 95.1, 94.8];
    state.soh = 94.8;
    state.voltages = [4.12, 4.11, 4.13, 3.85, 4.12, 4.12, 4.11, 4.12];
  }

  if (state.activeTab === 'dashboard') {
    updateDashboardUI();
  } else if (state.activeTab === 'health') {
    updateHealthUI();
    drawSohChart('soh-canvas', state.sohHistory);
    drawVoltageBalanceChart('voltage-canvas', state.voltages);
  } else if (state.activeTab === 'planner') {
    calculatePlan();
  }
}

function updateDashboardUI() {
  const socEl = document.getElementById("dash-soc");
  const rangeEl = document.getElementById("dash-range");
  if (socEl) socEl.innerText = `${Math.round(state.soc)}%`;
  if (rangeEl) rangeEl.innerText = `${state.range} km`;

  const alarmBanner = document.getElementById("safety-alarm-banner");
  const recoCard = document.getElementById("active-recommendation-card");
  const recoTitle = document.getElementById("reco-title");
  const recoDesc = document.getElementById("reco-desc");
  const recoStation = document.getElementById("reco-station");
  const recoCost = document.getElementById("reco-cost");
  const recoTotal = document.getElementById("reco-total");
  const recoWait = document.getElementById("reco-wait");
  const diagLatency = document.getElementById("diag-latency");

  if (alarmBanner) alarmBanner.style.display = 'none';
  if (recoCard) recoCard.classList.remove("warning");

  if (state.temp > 46) {
    if (alarmBanner) {
      alarmBanner.style.display = 'flex';
      document.getElementById("safety-alarm-title").innerText = "AIS 156 THERMAL ALERT";
      document.getElementById("safety-alarm-desc").innerText = `Cell temp ${state.temp}°C exceeds safe threshold. C-rate throttled to 0.5C.`;
    }
    if (recoCard) recoCard.classList.add("warning");
    if (recoTitle) recoTitle.innerText = "EMERGENCY STOP — Khalapur Zeon";
    if (recoDesc) recoDesc.innerText = "Thermal safety override active. Pull over and let the pack cool before resuming charge.";
    if (recoStation) recoStation.innerText = "Zeon Fast Charger — Khalapur";
    if (recoCost) recoCost.innerText = "₹17.0/kWh (Forced Stop)";
    if (recoTotal) recoTotal.innerText = "Safety Override";
    if (recoWait) recoWait.innerText = "0 mins (Priority)";
    if (diagLatency) diagLatency.innerText = "8 ms (Safety Bypass)";
  } else if (state.soc > 55) {
    if (recoTitle) recoTitle.innerText = "No stop needed — Continue to Mumbai";
    if (recoDesc) recoDesc.innerText = "Current charge is enough to reach Mumbai under these conditions. No charging stop needed.";
    if (recoStation) recoStation.innerText = "—";
    if (recoCost) recoCost.innerText = "—";
    if (recoTotal) recoTotal.innerText = "₹ 0";
    if (recoWait) recoWait.innerText = "0 mins";
    if (diagLatency) diagLatency.innerText = "18 ms";
  } else {
    if (recoTitle) recoTitle.innerText = "Stop at Jio-bp Lonavala in ~45 km";
    if (recoDesc) recoDesc.innerText = "MSEDCL Normal tariff window is active. Topping up to 80% here keeps trip cost low and cell health in good shape.";
    if (recoStation) recoStation.innerText = "Jio-bp Pulse — Lonavala";
    if (recoCost) recoCost.innerText = "₹18.5/kWh";
    const energyNeeded = ((80 - state.soc) / 100 * 40.5).toFixed(1);
    const estCost = (energyNeeded * 18.5).toFixed(0);
    if (recoTotal) recoTotal.innerText = `₹ ${estCost}`;
    if (recoWait) recoWait.innerText = "12 mins";
    if (diagLatency) diagLatency.innerText = "18 ms";
  }
}

function updateHealthUI() {
  const circle = document.getElementById("health-progress-circle");
  const valText = document.getElementById("health-soh-val");
  const statusText = document.getElementById("soh-status-text");
  const circum = 377;

  if (circle) {
    const offset = circum - (state.soh / 100) * circum;
    circle.style.strokeDasharray = circum;
    circle.style.strokeDashoffset = offset;

    if (state.soh < 94) {
      circle.style.stroke = "#EF4444";
      if (statusText) { statusText.innerText = "Moderate Degradation"; statusText.style.color = "#EF4444"; }
    } else if (state.soh < 96) {
      circle.style.stroke = "#F59E0B";
      if (statusText) { statusText.innerText = "Good Condition"; statusText.style.color = "#F59E0B"; }
    } else {
      circle.style.stroke = "#10B981";
      if (statusText) { statusText.innerText = "Excellent Condition"; statusText.style.color = "#10B981"; }
    }
  }
  if (valText) valText.innerText = `${state.soh}%`;
}

function calculatePlan() {
  const itinerary = document.getElementById("plan-itinerary");
  if (!itinerary) return;

  const priority = document.getElementById("opt-priority") ? document.getElementById("opt-priority").value : 'balanced';

  let stopName = "Jio-bp Pulse — Lonavala Expressway";
  let stopTariff = 18.5;
  let stopPower = 60;
  let targetSoC = 80;
  let chargeDuration = 25;
  let arrivalSoC = Math.max(8, Math.round(state.soc - 22));

  if (priority === 'cost') {
    stopName = "Tata Power EZ Charge — Talegaon Plaza";
    stopTariff = 16.5;
    stopPower = 50;
    chargeDuration = 30;
  } else if (priority === 'health') {
    targetSoC = 75; // cap lower to reduce high-voltage stress
    chargeDuration = 20;
    stopTariff = 18.5;
  }

  const energyDelivered = ((targetSoC - state.soc) / 100 * 40.5).toFixed(1);
  const estimatedCost = (energyDelivered * stopTariff).toFixed(0);

  let html = `
    <div class="history-item">
      <div class="history-marker">
        <div class="marker-dot" style="background-color: var(--accent-blue);"></div>
        <div class="marker-line"></div>
      </div>
      <div class="history-content" style="background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.3);">
        <div class="date">Departure</div>
        <h4>Pune, Maharashtra</h4>
        <p style="font-size:11px; color: var(--text-secondary); margin-top:4px;">
          Current SoC: ${Math.round(state.soc)}% &nbsp;|&nbsp; Range: ${state.range} km
        </p>
      </div>
    </div>
  `;

  if (state.soc < 55 || state.temp > 46) {
    html += `
      <div class="history-item">
        <div class="history-marker">
          <div class="marker-dot" style="background-color: var(--accent-amber);"></div>
          <div class="marker-line"></div>
        </div>
        <div class="history-content" style="border-color: rgba(245,158,11,0.3);">
          <div class="date">Charging Stop</div>
          <h4 style="color: var(--accent-amber);">${stopName}</h4>
          <div class="history-stats-grid" style="margin-top: 8px; padding-top: 8px;">
            <div>Charge To<span>${targetSoC}% SoC</span></div>
            <div>Duration<span>${chargeDuration} mins</span></div>
            <div>Power<span>${stopPower} kW</span></div>
            <div>Tariff<span>₹${stopTariff}/kWh</span></div>
            <div>Energy<span>${energyDelivered} kWh</span></div>
            <div>Total Cost<span>₹ ${estimatedCost}</span></div>
          </div>
        </div>
      </div>
    `;
  }

  html += `
    <div class="history-item">
      <div class="history-marker">
        <div class="marker-dot" style="background-color: var(--accent-green);"></div>
      </div>
      <div class="history-content" style="background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.3);">
        <div class="date">Arrival</div>
        <h4 style="color: var(--accent-green);">Mumbai, Maharashtra</h4>
        <p style="font-size:11px; color: var(--text-secondary); margin-top:4px;">
          Est. Arrival SoC: ${arrivalSoC}% &nbsp;|&nbsp; Total Cost: ₹ ${estimatedCost}
        </p>
      </div>
    </div>
  `;

  itinerary.innerHTML = html;
}

function initLeafletMap() {
  if (state.map) return;

  state.map = L.map('map', { zoomControl: false, attributionControl: false })
    .setView([18.7557, 73.4091], 10);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 })
    .addTo(state.map);

  var routePoints = [
    [18.5204, 73.8567],
    [18.7214, 73.6742],
    [18.7557, 73.4091],
    [18.8252, 73.3089],
    [19.0150, 73.0850],
    [19.0760, 72.8777]
  ];

  L.polyline(routePoints, { color: '#3B82F6', weight: 4, opacity: 0.85 }).addTo(state.map);

  L.circleMarker([18.5204, 73.8567], { radius: 7, color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 1 })
    .addTo(state.map).bindPopup('<b>Pune</b>');

  L.circleMarker([19.0760, 72.8777], { radius: 7, color: '#10B981', fillColor: '#10B981', fillOpacity: 1 })
    .addTo(state.map).bindPopup('<b>Mumbai</b>');

  chargingStations.forEach(stn => {
    var m = L.marker([stn.lat, stn.lng]).addTo(state.map);
    m.bindPopup(`<b>${stn.name}</b><br>` +
      `${stn.network} · ${stn.power} kW<br>` +
      `₹${stn.tariff}/kWh · ${stn.connector}`);
    state.markers.push(m);
  });
}

function renderChargerList() {
  const container = document.getElementById("station-list-container");
  if (!container) return;

  let html = "";
  chargingStations.forEach(stn => {
    html += `
      <div class="charger-item">
        <div class="charger-info">
          <h4>${stn.name}</h4>
          <p>
            <span class="charger-badge">${stn.power} kW</span>
            <span class="charger-badge" style="background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); color: var(--accent-green);">${stn.connector}</span>
          </p>
          <p style="margin-top: 3px; font-size: 10px; color: var(--text-secondary);">${stn.network}</p>
        </div>
        <div class="charger-metrics">
          <div class="tariff">₹${stn.tariff}/kWh</div>
          <div class="wait-time">${stn.wait} min wait</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function initSimulatorControls() {
  var socSlider = document.getElementById("slider-soc");
  var tempSlider = document.getElementById("slider-temp");
  if (socSlider) socSlider.value = state.soc;
  if (tempSlider) tempSlider.value = state.temp;
}

function acceptRecommendation() {
  alert("Route updated — stopping at Jio-bp Pulse, Lonavala in 45 km.");
  state.soc = 80;
  runEdgeInferenceLoop();
}
