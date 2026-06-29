# API Design

The ChargeWise system has two communication paths: the companion app talking to the on-vehicle edge processor over BLE/local Wi-Fi, and the edge processor syncing with the cloud when connectivity is available. Both paths use the same REST API contract — the edge device runs a lightweight FastAPI server that responds identically to the cloud backend, so the app code doesn't need to care which endpoint it's hitting.

All responses use JSON. All protected routes require a JWT Bearer token. Standard HTTP status codes throughout — no custom status wrapping.

**Cloud base URL:** `https://api.chargewise-edge.tata.com/v1`  
**Local edge base URL:** `http://192.168.4.1:8000/api/v1` (the RPi broadcasts a hotspot when in range)

---

## Endpoint Reference

| Method | Path | What it does | Who calls it |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/token` | Driver login, returns JWT | Mobile app |
| `POST` | `/battery/logs` | Batch-upload offline telemetry | Edge engine |
| `GET` | `/battery/state` | Get current SOH and battery stats | Mobile app |
| `POST` | `/predictions/tariff` | Request localized tariff forecast | Edge or app |
| `POST` | `/recommendations/route` | Generate a full trip charging plan | Edge or app |
| `POST` | `/recommendations/feedback` | Record driver accept/reject | Mobile app |
| `GET` | `/stations/nearby` | Find stations within a bounding box | Mobile app |
| `GET` | `/user/profile` | Retrieve linked EV specs | Mobile app |

---

## Request & Response Examples

### POST /auth/token

```json
// Request
{
  "email": "rahul.verma@example.com",
  "password": "securepassword123"
}

// Response 200
{
  "status": "success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "token_type": "Bearer",
    "user": {
      "id": "usr_9f82d1c9-7e9b-4654-8e12-367cf8b9821a",
      "name": "Rahul Verma",
      "email": "rahul.verma@example.com"
    }
  }
}
```

---

### POST /battery/logs

The edge engine queues telemetry records locally in SQLite while offline, then pushes them in batches when connectivity is restored. Batches of up to 500 records are accepted per call.

```json
// Request
{
  "vehicle_id": "veh_b5e82f71-294b-4b11-92b6-cc893aef4e1a",
  "batch_timestamp": "2026-07-03T05:10:00Z",
  "logs": [
    {
      "timestamp": "2026-07-03T05:08:00Z",
      "soc": 45.20,
      "soh": 94.85,
      "voltage": 365.40,
      "current": -15.40,
      "cell_temp_min": 32.5,
      "cell_temp_max": 34.2,
      "ambient_temp": 28.0,
      "internal_resistance": 0.042510
    },
    {
      "timestamp": "2026-07-03T05:09:00Z",
      "soc": 44.90,
      "soh": 94.84,
      "voltage": 364.80,
      "current": -16.20,
      "cell_temp_min": 32.7,
      "cell_temp_max": 34.4,
      "ambient_temp": 28.0,
      "internal_resistance": 0.042515
    }
  ]
}

// Response 201
{
  "status": "success",
  "message": "Synced 2 telemetry records.",
  "data": {
    "synced_count": 2,
    "last_synced_timestamp": "2026-07-03T05:09:00Z"
  }
}
```

---

### POST /recommendations/route

The main planning endpoint. Takes current position, destination, and vehicle state — returns a ranked list of charging stops with full cost and health breakdowns. `optimization_priority` accepts `MIN_COST`, `MIN_TIME`, `MAX_HEALTH`, or `BALANCED`.

```json
// Request
{
  "vehicle_id": "veh_b5e82f71-294b-4b11-92b6-cc893aef4e1a",
  "origin": {
    "latitude": 18.520430,
    "longitude": 73.856743,
    "name": "Pune, Maharashtra"
  },
  "destination": {
    "latitude": 19.076090,
    "longitude": 72.877793,
    "name": "Mumbai, Maharashtra"
  },
  "current_soc": 25.00,
  "optimization_priority": "BALANCED"
}

// Response 200
{
  "status": "success",
  "data": {
    "route_summary": {
      "total_distance_km": 148.5,
      "estimated_travel_time_mins": 195,
      "total_energy_kwh_consumed": 22.4,
      "net_cost_currency": "INR",
      "total_wait_time_mins": 25
    },
    "charging_stops": [
      {
        "sequence": 1,
        "station_id": "stn_c82fa7b1-219e-4a6f-9988-51829e1fa2bd",
        "station_name": "Jio-bp Pulse — Lonavala Expressway",
        "coordinates": {
          "latitude": 18.755700,
          "longitude": 73.409100
        },
        "connector_type": "CCS-2",
        "arrival_soc": 12.00,
        "target_soc": 80.00,
        "estimated_charge_duration_mins": 25,
        "expected_tariff_per_kwh": 18.50,
        "charging_power_kw": 60.0,
        "estimated_wait_time_mins": 12,
        "health_wear_factor": 0.002,
        "safety_guardrail": "THERMAL_LIMIT_AC_ON"
      }
    ]
  }
}
```

---

### POST /recommendations/feedback

Driver responses are logged and eventually fed back into the personalization training pipeline. Even IGNORED responses are useful — they tell us the recommendation surfaced at the wrong moment.

```json
// Request
{
  "recommendation_id": "rec_d91b72e0-f1c9-4a00-b6a6-cc92314ef82b",
  "action": "ACCEPTED",
  "rejection_reason": null,
  "feedback_timestamp": "2026-07-03T05:10:30Z"
}

// Response 200
{
  "status": "success",
  "message": "Feedback recorded."
}
```

---

## Error Responses

```json
// 400 — Bad request (validation failure)
{
  "status": "error",
  "error_code": "INVALID_PARAMETER_VALUE",
  "message": "current_soc must be between 0.0 and 100.0. Got: 105.00"
}

// 401 — Expired or missing token
{
  "status": "error",
  "error_code": "TOKEN_EXPIRED",
  "message": "Bearer token has expired. Re-authenticate."
}

// 504 — Edge device offline (cloud-to-edge proxy timeout)
{
  "status": "error",
  "error_code": "EDGE_OFFLINE_TIMEOUT",
  "message": "Local edge module did not respond within 5000ms. Falling back to last-known offline recommendations."
}
```
