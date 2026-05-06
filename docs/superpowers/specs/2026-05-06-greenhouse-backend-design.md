# Greenhouse IoT Backend — Design Spec

**Date:** 2026-05-06  
**Stack:** Python + FastAPI + SQLite + Mosquitto MQTT  
**Scope:** Backend only. Frontend (React) already built; this backend replaces its simulated data.

---

## 1. Architecture

```
ESP8266 (DHT11)
     │  MQTT publish
     │  topic: greenhouse/sensor
     │  payload: {"temp": 24.5, "hum": 61.2, "sensor_id": "zone-a"}
     ▼
[ Mosquitto MQTT Broker ]   (localhost:1883)
     │  aiomqtt subscribe
     ▼
[ FastAPI Backend ]         (localhost:8000)
  ├── MQTT listener — async background task
  │     └── on message: parse → save reading → check thresholds → save alert
  ├── REST API (HTTP, CORS enabled)
  │     ├── GET /api/sensors/latest
  │     ├── GET /api/sensors/history?limit=20
  │     └── GET /api/alerts?limit=50
  └── SQLite (greenhouse.db via SQLAlchemy async)
        ├── readings
        └── alerts
```

One async Python process handles both MQTT and HTTP. Mosquitto is a separate lightweight install.

---

## 2. Database Schema

### `readings`
| column      | type     | notes                        |
|-------------|----------|------------------------------|
| id          | INTEGER  | primary key, autoincrement   |
| sensor_id   | TEXT     | e.g. `"zone-a"`              |
| temperature | REAL     | °C                           |
| humidity    | REAL     | % RH                         |
| recorded_at | DATETIME | UTC, default now             |

### `alerts`
| column      | type     | notes                                          |
|-------------|----------|------------------------------------------------|
| id          | INTEGER  | primary key, autoincrement                     |
| sensor_id   | TEXT     |                                                |
| metric      | TEXT     | `"temperature"` or `"humidity"`               |
| value       | REAL     | the reading that triggered the alert           |
| threshold   | TEXT     | `"high"` or `"low"`                           |
| message     | TEXT     | human-readable, e.g. "Temp too high: 32.1°C" |
| triggered_at| DATETIME | UTC, default now                               |

---

## 3. Alert Thresholds

Derived from the frontend's System Info panel:
- Temperature: optimal 18°C – 28°C → alert if < 18 or > 28
- Humidity: optimal 40% – 70% → alert if < 40 or > 70

Alert deduplication: only log a new alert for a metric if the previous alert for that metric+threshold was > 5 minutes ago (prevents alert flood on sustained out-of-range readings).

---

## 4. API Contracts

### `GET /api/sensors/latest`
Returns the most recent reading.

```json
{
  "sensor_id": "zone-a",
  "temperature": 24.5,
  "humidity": 61.2,
  "recorded_at": "2026-05-06T10:23:01Z"
}
```

### `GET /api/sensors/history?limit=20`
Returns the last N readings, oldest first (for chart rendering).

```json
[
  { "time": "10:23:01", "temp": 24.5, "hum": 61.2 },
  ...
]
```

### `GET /api/alerts?limit=50`
Returns recent alerts, newest first.

```json
[
  {
    "id": 12,
    "sensor_id": "zone-a",
    "metric": "temperature",
    "value": 30.1,
    "threshold": "high",
    "message": "Temp too high: 30.1°C",
    "triggered_at": "2026-05-06T10:20:00Z"
  },
  ...
]
```

---

## 5. Project Structure

```
backend/
├── main.py              # FastAPI app entry point, starts MQTT listener
├── database.py          # SQLAlchemy async engine + session factory
├── models.py            # Reading + Alert ORM models
├── mqtt_listener.py     # aiomqtt subscriber loop + alert logic
├── routers/
│   ├── sensors.py       # /api/sensors/* endpoints
│   └── alerts.py        # /api/alerts endpoint
├── schemas.py           # Pydantic response models
├── thresholds.py        # Alert threshold constants + check logic
└── requirements.txt
```

---

## 6. MQTT Topic Convention

- **Topic:** `greenhouse/sensor`
- **QoS:** 1 (at least once)
- **Payload:** JSON `{"temp": float, "hum": float, "sensor_id": string}`
- `sensor_id` defaults to `"zone-a"` if not present in payload

---

## 7. Frontend Integration

The frontend Dashboard needs two changes:
1. Remove the `setInterval` simulation block
2. Replace it with `fetch("/api/sensors/latest")` and `fetch("/api/sensors/history")` every 4 seconds
3. Replace the hardcoded alert logic in `AlertsPanel` with `fetch("/api/alerts")`

These frontend changes are out of scope for this backend spec but are noted for handoff.

---

## 8. Running the System

```bash
# 1. Install broker
sudo apt install mosquitto mosquitto-clients

# 2. Install Python deps
cd backend && pip install -r requirements.txt

# 3. Start backend
uvicorn main:app --reload --port 8000
```

ESP8266 publishes to `mqtt://localhost:1883` topic `greenhouse/sensor`.
