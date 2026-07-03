#!/usr/bin/env python3
"""
ChargeWise Edge Engine Simulator
--------------------------------
Simulates the local on-vehicle edge processing loop running on a Raspberry Pi 5.
Includes SQLite circular log buffer, mock TFLite SOH/Tariff inferences, and
AIS 156 Phase 2 thermal safety guardrail overrides.
"""

import sqlite3
import time
import uuid
import math
import random
from datetime import datetime

# Database file name
DB_FILE = "chargewise_edge.db"

# Seed Data Configurations
USER_ID = "usr_9f82d1c9-7e9b-4654-8e12-367cf8b9821a"
VEHICLE_ID = "veh_b5e82f71-294b-4b11-92b6-cc893aef4e1a"

def init_database():
    """Initializes the local SQLite database using DDL schemas from database_design.md."""
    print("[SQLite] Initializing local database tables...")
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id          VARCHAR(36) PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(100) UNIQUE NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Vehicles Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vehicles (
        id                   VARCHAR(36) PRIMARY KEY,
        user_id              VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        make                 VARCHAR(50) NOT NULL,
        model                VARCHAR(50) NOT NULL,
        year                 INTEGER NOT NULL CHECK (year > 2000),
        battery_capacity_kwh DECIMAL(5,2) NOT NULL CHECK (battery_capacity_kwh > 0.0),
        current_odometer     DECIMAL(10,2) NOT NULL,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Charging Stations Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS charging_stations (
        id                  VARCHAR(36) PRIMARY KEY,
        name                VARCHAR(150) NOT NULL,
        latitude            DECIMAL(9,6) NOT NULL CHECK (latitude BETWEEN -90.0 AND 90.0),
        longitude           DECIMAL(9,6) NOT NULL CHECK (longitude BETWEEN -180.0 AND 180.0),
        connector_types     VARCHAR(100) NOT NULL,
        max_power_kw        DECIMAL(5,2) NOT NULL CHECK (max_power_kw > 0.0),
        base_tariff_per_kwh DECIMAL(6,2) NOT NULL,
        is_active           BOOLEAN DEFAULT 1
    );
    """)

    # 4. Battery Logs (Circular buffer)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS battery_logs (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id          VARCHAR(36) NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        timestamp           TIMESTAMP NOT NULL,
        soc                 DECIMAL(5,2) NOT NULL CHECK (soc BETWEEN 0.0 AND 100.0),
        soh                 DECIMAL(5,2) NOT NULL CHECK (soh BETWEEN 0.0 AND 100.0),
        voltage             DECIMAL(6,2) NOT NULL,
        current             DECIMAL(6,2) NOT NULL,
        cell_temp_min       DECIMAL(4,1) NOT NULL,
        cell_temp_max       DECIMAL(4,1) NOT NULL,
        ambient_temp        DECIMAL(4,1),
        internal_resistance DECIMAL(8,6)
    );
    """)

    # 5. Predictions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS predictions (
        id               VARCHAR(36) PRIMARY KEY,
        vehicle_id       VARCHAR(36) NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        prediction_type  VARCHAR(30) NOT NULL CHECK (prediction_type IN ('TARIFF', 'SOH', 'ANOMALY')),
        timestamp        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        input_features   TEXT NOT NULL,
        predicted_value  DECIMAL(10,4) NOT NULL,
        actual_value     DECIMAL(10,4),
        prediction_error DECIMAL(10,4)
    );
    """)

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_battery_logs_timestamp ON battery_logs(vehicle_id, timestamp DESC);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stations_coords ON charging_stations(latitude, longitude) WHERE is_active = 1;")

    # Seed User & Vehicle
    cursor.execute("INSERT OR IGNORE INTO users (id, name, email) VALUES (?, 'Rahul Verma', 'rahul.verma@example.com');", (USER_ID, ))
    cursor.execute("""
    INSERT OR IGNORE INTO vehicles (id, user_id, make, model, year, battery_capacity_kwh, current_odometer)
    VALUES (?, ?, 'Tata', 'Nexon EV Max', 2023, 40.5, 12450.0);
    """, (VEHICLE_ID, USER_ID))

    # Seed Stations
    stations = [
        ("stn_1", "Tata Power EZ Charge — Talegaon Plaza", 18.7214, 73.6742, "CCS-2", 50.0, 16.50),
        ("stn_2", "Jio-bp Pulse — Lonavala Expressway", 18.7557, 73.4091, "CCS-2 / Type-2", 60.0, 18.50),
        ("stn_3", "Zeon Fast Charger — Khalapur Court", 18.8252, 73.3089, "CCS-2", 50.0, 17.00),
        ("stn_4", "Magenta ChargeGrid — Navi Mumbai Hub", 19.0150, 73.0850, "CCS-2 / Bharat AC-001", 150.0, 21.00)
    ]
    for s_id, s_name, lat, lng, conn_t, pwr, trf in stations:
        cursor.execute("""
        INSERT OR IGNORE INTO charging_stations (id, name, latitude, longitude, connector_types, max_power_kw, base_tariff_per_kwh, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1);
        """, (s_id, s_name, lat, lng, conn_t, pwr, trf))

    conn.commit()
    conn.close()
    print("[SQLite] Database initialized and seeded successfully.")


class SafetyEngine:
    """Evaluates battery safety against AIS 156 parameters."""
    
    def __init__(self):
        self.temp_history = []  # stores (timestamp, max_temp)

    def evaluate(self, current_temp, timestamp):
        """
        Runs AIS 156 guardrails.
        Returns (is_alarm_triggered, message, throttled_c_rate)
        """
        # Append to temp history
        self.temp_history.append((timestamp, current_temp))
        
        # Keep only the last 60 seconds of history
        self.temp_history = [item for item in self.temp_history if (timestamp - item[0]).total_seconds() <= 60]

        # Guardrail 1: Temperature Gradient Check (rise rate)
        if len(self.temp_history) >= 2:
            time_delta = (self.temp_history[-1][0] - self.temp_history[0][0]).total_seconds()
            if time_delta >= 10:  # need at least a 10s gap to prevent small fluctuations noise
                temp_delta = self.temp_history[-1][1] - self.temp_history[0][1]
                rate_per_min = (temp_delta / time_delta) * 60
                if rate_per_min >= 2.0:
                    return (True, f"AIS 156 Alert: Thermal rise rate too high (+{rate_per_min:.2f}°C/min).", 0.2)

        # Guardrail 2: Hard Temperature Limit
        if current_temp > 45.0:
            return (True, f"AIS 156 Critical Alert: Max temperature ({current_temp}°C) exceeds 45°C limit.", 0.1)
        elif current_temp > 42.0:
            return (False, f"Warning: Temperature high ({current_temp}°C). Throttling C-rate.", 0.6)

        return (False, "Battery thermal state normal.", 1.0)


def predict_tariff(dt):
    """
    Simulates XGBoost Time-of-Day tariff calculator.
    Uses sin/cos cyclical time encoding to parse slabs.
    """
    hour = dt.hour
    
    # Cyclical hour encoding
    sin_h = math.sin(2 * math.pi * hour / 24)
    cos_h = math.cos(2 * math.pi * hour / 24)
    
    # Tariff calculation based on standard slots
    if 22 <= hour or hour < 6:
        # Off-peak
        tariff = 14.5
        slot = "Off-Peak"
    elif 18 <= hour < 22:
        # Peak
        tariff = 22.0
        slot = "Peak"
    else:
        # Normal
        tariff = 18.5
        slot = "Normal"

    # Add a slight load variance representing grid load index features
    grid_load_index = 0.95 if hour < 8 else (1.15 if 18 <= hour < 21 else 1.0)
    adjusted_tariff = round(tariff * grid_load_index, 2)
    return adjusted_tariff, slot, (sin_h, cos_h)


def run_edge_inference(conn, step, soc, temp, soh_base):
    """Simulates edge inference, database logging, and safety evaluation."""
    cursor = conn.cursor()
    now = datetime.now()

    # 1. SOH Time-Series Calculation
    # Cell voltage imbalance (simulated slightly lower cluster 4 voltage)
    voltages = [4.12, 4.11, 4.13, 3.85 if temp > 45.0 else 4.09, 4.12, 4.12, 4.11, 4.12]
    voltage_imbalance = max(voltages) - min(voltages)
    
    # SOH estimation (degrades based on temperature, SoC, and imbalance)
    temp_wear = max(0, (temp - 30) * 0.005)
    imbalance_wear = max(0, (voltage_imbalance - 0.05) * 0.2)
    current_soh = round(soh_base - (step * 0.002) - temp_wear - imbalance_wear, 2)

    # 2. Local SQLite Logging
    # Random resistance values around 42 mOhms
    internal_resistance = round(0.042000 + random.uniform(-0.001, 0.001), 6)
    pack_voltage = round(sum(voltages) * 11.2, 1) # scaled pack voltage
    pack_current = -15.4 # charging current

    cursor.execute("""
    INSERT INTO battery_logs (vehicle_id, timestamp, soc, soh, voltage, current, cell_temp_min, cell_temp_max, ambient_temp, internal_resistance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (VEHICLE_ID, now.isoformat(), soc, current_soh, pack_voltage, pack_current, temp - 2.0, temp, 28.0, internal_resistance))

    # 3. Model Predictions Logging
    # XGBoost Tariff Model Run
    predicted_tariff_val, slot, cyclical_feat = predict_tariff(now)
    cursor.execute("""
    INSERT INTO predictions (id, vehicle_id, prediction_type, timestamp, input_features, predicted_value)
    VALUES (?, ?, 'TARIFF', ?, ?, ?);
    """, (str(uuid.uuid4()), VEHICLE_ID, now.isoformat(), f"sin_t={cyclical_feat[0]:.4f},cos_t={cyclical_feat[1]:.4f},load_idx=1.0", predicted_tariff_val))

    # 4. Circular Buffer Pruning (maintain buffer size)
    # We prune logs if they exceed a size (simulating the 100k row limit)
    # For simulation, we limit it to 20 rows so we can witness pruning live
    cursor.execute("SELECT COUNT(*) FROM battery_logs;")
    row_count = cursor.fetchone()[0]
    pruned_count = 0
    if row_count > 15:
        # Delete oldest logs
        cursor.execute("""
        DELETE FROM battery_logs 
        WHERE id IN (
            SELECT id FROM battery_logs 
            ORDER BY timestamp ASC 
            LIMIT ?
        );
        """, (row_count - 15, ))
        pruned_count = row_count - 15

    conn.commit()
    return current_soh, predicted_tariff_val, slot, pruned_count


def simulate_sync(conn, online=True):
    """Simulates background sync of database logs to the cloud (Firebase)."""
    cursor = conn.cursor()
    
    # Query unsynced rows
    # In a real system, we'd keep track of synced flag or last_synced_id.
    # Here, we fetch all logs and simulate sending them.
    cursor.execute("SELECT id, timestamp, soc, soh, cell_temp_max FROM battery_logs ORDER BY id ASC;")
    logs = cursor.fetchall()
    
    if not online:
        print(f"[Sync Manager] Offline: {len(logs)} telemetry records queued in SQLite.")
        return 0

    if len(logs) == 0:
        return 0

    print(f"[Sync Manager] Online: Uploading batch of {len(logs)} records to Firebase...")
    time.sleep(0.3)  # simulate API latency
    print(f"[Sync Manager] Sync completed. Cloud database updated. SQLite buffer active.")
    return len(logs)


def run_simulation():
    """Main simulation orchestrator."""
    init_database()
    safety_engine = SafetyEngine()
    
    print("\n" + "="*60)
    print("      STARTING CHARGEWISE EDGE ENGINE SIMULATION")
    print("="*60)
    
    conn = sqlite3.connect(DB_FILE)
    
    soc = 25.0
    soh_base = 94.8
    connectivity = True

    # We run 12 simulation ticks
    for tick in range(1, 13):
        print(f"\n--- TICK #{tick} [{datetime.now().strftime('%H:%M:%S')}] ---")
        
        # Simulate CAN variables changing
        soc += 0.5  # battery is charging
        
        # At tick 6, simulate temperature spike (e.g. fast charger cooling failure)
        if tick >= 6:
            temp = 32.0 + (tick - 5) * 3.5  # temp rises fast!
        else:
            temp = 32.0 + (tick * 0.4)

        # Run Edge Inference & DB Logging
        current_soh, predicted_tariff, slot, pruned = run_edge_inference(conn, tick, soc, temp, soh_base)
        print(f"[Edge Inference] LSTM SOH: {current_soh}% | XGB Tariff: Rs.{predicted_tariff}/kWh ({slot})")
        
        if pruned > 0:
            print(f"[SQLite Circular Buffer] Pruned {pruned} oldest rows to preserve SD card memory.")

        # Evaluate safety
        alarm, msg, c_rate = safety_engine.evaluate(temp, datetime.now())
        if alarm:
            print(f"\033[91m[SAFETY ENGINE] {msg} OVERRIDE INITIATED. Throttling C-rate to {c_rate}C!\033[0m")
        elif c_rate < 1.0:
            print(f"\033[93m[SAFETY ENGINE] {msg} C-rate restricted to {c_rate}C.\033[0m")
        else:
            print(f"\033[92m[SAFETY ENGINE] {msg} C-rate: {c_rate}C (Optimal).\033[0m")

        # Simulate network dropouts
        if tick in [4, 5, 6, 7]:
            connectivity = False
        else:
            connectivity = True

        # Run Cloud Sync Manager
        simulate_sync(conn, online=connectivity)
        
        time.sleep(0.5)  # Accelerated tick rate for demo

    conn.close()
    print("\n" + "="*60)
    print("      SIMULATION COMPLETED SUCCESSFULLY")
    print("="*60)


if __name__ == "__main__":
    run_simulation()
