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
├── diagrams/                  — SVG architecture and workflow diagrams
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

## Running the Prototype

1. Open `prototype/index.html` in Chrome or Edge.
2. Use the **Edge AI Simulator** panel on the right to adjust battery SoC, temperature, weather, traffic density, and MSEDCL tariff slot.
3. Watch the dashboard, route planner, and safety alerts react in real time — simulating what the on-vehicle edge engine would compute.

No build step, no server. It's pure HTML + JS.

---

## Documentation Index

- [System Architecture](file:///d:/ChargeWise_EdgeAI/docs/architecture.md) — how the four layers connect
- [Database Design](file:///d:/ChargeWise_EdgeAI/docs/database_design.md) — schema and SQL DDL
- [API Design](file:///d:/ChargeWise_EdgeAI/docs/api_design.md) — REST endpoints with full request/response examples
- [ML & Model Design](file:///d:/ChargeWise_EdgeAI/docs/model_design.md) — feature vectors, model comparison, TFLite quantization
- [Market Research](file:///d:/ChargeWise_EdgeAI/docs/market_research.md) — benchmarking against existing Indian EV platforms
- [Project Timeline](file:///d:/ChargeWise_EdgeAI/docs/project_management.md) — 12-week build plan and risk assessment
