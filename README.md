# ChargeWise EdgeAI

**Tata Technologies InnoVent-27** — AI at the Edge Solutions for Automotive

---

ChargeWise EdgeAI is an intelligent EV charging and battery optimization platform built for the Indian market. Instead of being just another charger locator app, ChargeWise reads live vehicle telemetry from the CAN-bus, runs ML models locally on edge hardware (Raspberry Pi 5 or Jetson Nano), and gives the driver a precise, context-aware charging plan — accounting for battery state of health, MSEDCL electricity tariff windows, route elevation, and traffic density on NH-48.

The key insight driving this build: most EV software today either ignores battery health entirely or depends on cloud connectivity that drops out the moment you're in the Western Ghats. We run everything that matters locally, on the vehicle.

---

## Project Layout

```
ChargeWise_EdgeAI/
├── README.md
├── docs/
│   ├── architecture.md        — System design, data flow, edge-cloud split
│   ├── database_design.md     — Full schema, DDL, and indexing rationale
│   ├── api_design.md          — REST API contract (OpenAPI-compatible)
│   ├── model_design.md        — Feature engineering, LSTM vs XGBoost evaluation, TFLite deployment
│   ├── project_management.md  — 12-week Gantt, milestone targets, risk matrix
│   └── market_research.md     — Competitive analysis vs Tata ZConnect, Ather, Jio-bp Pulse
├── architecture/              — SVG architecture and workflow diagrams
│   ├── system_architecture.svg
│   ├── system_workflow.svg
│   ├── ai_pipeline.svg
│   ├── user_journey.svg
│   ├── database_erd.svg
│   └── deployment_pipeline.svg
├── assets/
│   ├── icons/                 — SVG icon set used in the prototype UI
│   └── mockups/               — High-res UI screenshots
└── prototype/                 — Interactive web prototype (open index.html in browser)
    ├── index.html
    ├── css/style.css
    └── js/
        ├── app.js             — Core simulation and state machine
        └── charts.js          — Canvas-based SOH and cell voltage charts
```

---

## What makes this different

**Everything critical runs on the vehicle itself.** The LSTM model for battery State of Health and the XGBoost tariff forecaster both run as quantized TFLite models directly on a Raspberry Pi 5 — no cloud required. When the vehicle regains connectivity, it syncs session data to Firebase in the background.

**It actually cares about battery life.** The routing engine doesn't just minimize charging time. It computes a health-wear factor for each potential charging stop, and under high ambient temperatures or elevated cell voltage imbalance, it actively throttles its own recommendations — telling the driver to charge slower or stop at a lower-power charger to protect long-term battery capacity.

**Designed specifically for Indian infrastructure.** Tariff predictions are trained on MSEDCL Time-of-Day (ToD) slab data. The charging network registry covers Tata Power EZ Charge, Jio-bp Pulse, Zeon, and Magenta ChargeGrid stations along the NH-48 corridor. Safety thresholds follow ARAI AIS 156 Phase 2 standards.

---

## Running the Prototype & Simulator

The ChargeWise EdgeAI prototype consists of two components: an interactive HTML/JS dashboard mockup and a Python-based edge processing loop simulator.

### 1. Web-Based Interactive Dashboard Mockup
Open `prototype/index.html` in Chrome, Edge, or Safari to run the mockup. The prototype dashboard features:
- **Simulation Scenario Preset**: A dropdown to immediately load standard vehicle conditions:
  - **NH-48 Standard Cruise (Normal)**: Baseline driving conditions (65% SoC, 32°C battery, clear traffic).
  - **Summer Heat Abuse (AIS 156 Guardrail Alert)**: Heavy congestion under extreme weather triggering safety overrides (25% SoC, 48°C battery, hot weather).
  - **Low SoC Charge Stop (Lonavala Stop)**: Running low on charge in moderate traffic (12% SoC, 36°C battery).
  - **Winter Morning Start (Cold Ambient)**: High SoC start under freezing conditions (80% SoC, 16°C battery).
- **Connectivity Toggle (Simulate cellular dropouts in the Ghats)**: Toggle between ONLINE and OFFLINE mode.
  - While **OFFLINE**, incoming CAN telemetry logs are queued locally in the SQLite database circular buffer.
  - Switching back to **ONLINE** triggers background synchronization, uploading pending records to the cloud database in batches of 3 records every 600ms until the queue is clear.
- **Live Edge Log Console**: A real-time terminal display presenting:
  - Local SQLite database writes and buffer maintenance.
  - TFLite quantized models' inferences (LSTM state-of-health estimation and XGBoost electricity tariff forecast).
  - Thermal safety warning alerts and AIS 156 Phase 2 control overrides (such as throttling C-rate or emergency cooling stops).

No server or build process is required for the web prototype; it runs entirely local as a client-side HTML + CSS + JS package.

### 2. Python Edge Simulator Script
The repository contains a Python script that simulates the CAN-bus data processing loop running locally on an on-vehicle edge hardware target (e.g. Raspberry Pi 5 or Jetson Nano).

To execute the Python edge simulator, run:
```powershell
python scripts/edge_simulator.py
```
This script will initialize local SQLite tables, insert seed users, vehicles, and charging stations, and then run a 12-tick telemetry logging loop simulating temperature rises and cellular dropouts.

To run the unit tests verifying the AIS 156 compliance safety engine, run:
```powershell
python -m unittest tests/test_safety_engine.py
```

---

## Documentation Index

- [System Architecture](file:///d:/ChargeWise_EdgeAI/docs/architecture.md) — how the four layers connect
- [Database Design](file:///d:/ChargeWise_EdgeAI/docs/database_design.md) — schema and SQL DDL
- [API Design](file:///d:/ChargeWise_EdgeAI/docs/api_design.md) — REST endpoints with full request/response examples
- [ML & Model Design](file:///d:/ChargeWise_EdgeAI/docs/model_design.md) — feature vectors, model comparison, TFLite quantization
- [Market Research](file:///d:/ChargeWise_EdgeAI/docs/market_research.md) — benchmarking against existing Indian EV platforms
- [Project Timeline](file:///d:/ChargeWise_EdgeAI/docs/project_management.md) — 12-week build plan and risk assessment
