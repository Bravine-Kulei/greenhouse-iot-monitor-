# Greenhouse IoT Backend

Python FastAPI backend for the smart greenhouse monitor. Receives sensor data from an ESP8266 + DHT11 via MQTT, stores readings in SQLite, triggers threshold alerts, and serves a REST API to the React frontend.

---

## Architecture

```
ESP8266 (DHT11)
     │  MQTT publish
     │  topic: greenhouse/sensor
     │  payload: {"temp": 24.5, "hum": 61.2, "sensor_id": "zone-a"}
     ▼
[ Mosquitto MQTT Broker ]   localhost:1883
     │  aiomqtt subscribe
     ▼
[ FastAPI Backend ]         localhost:8000
  ├── MQTT listener (async background task)
  │     └── on message → save reading → check thresholds → save alert if triggered
  └── REST API (HTTP, CORS enabled)
        ├── GET /api/sensors/latest
        ├── GET /api/sensors/history
        └── GET /api/alerts
              └── SQLite (greenhouse.db)
                    ├── readings table
                    └── alerts table
```

One async Python process handles both MQTT and HTTP — no threads, no extra workers.

---

## Project Structure

```
backend/
├── main.py              # FastAPI app entry point, CORS, lifespan (init DB + start MQTT task)
├── database.py          # Async SQLAlchemy engine, session factory, get_db dependency
├── models.py            # Reading and Alert ORM models
├── schemas.py           # Pydantic response models (LatestReading, HistoryPoint, AlertOut)
├── thresholds.py        # Alert threshold constants + check_thresholds() pure function
├── mqtt_listener.py     # MQTT subscribe loop, handle_message(), _should_alert() dedup
├── routers/
│   ├── sensors.py       # GET /api/sensors/latest  and  GET /api/sensors/history
│   └── alerts.py        # GET /api/alerts
├── tests/
│   ├── conftest.py      # Shared fixtures: in-memory DB engine, db_session, HTTP client
│   ├── test_thresholds.py
│   ├── test_sensors_router.py
│   ├── test_alerts_router.py
│   └── test_mqtt_listener.py
├── conftest.py          # Adds backend/ to sys.path so imports work from any CWD
├── requirements.txt
└── pytest.ini
```

---

## Setup

### 1. Install the MQTT broker

```bash
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable --now mosquitto
```

### 2. Install Python dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Start the server

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

The server will:
- Create `greenhouse.db` (SQLite) on first run
- Connect to the MQTT broker and subscribe to `greenhouse/sensor`
- Serve the REST API at `http://localhost:8000`
- Show auto-generated API docs at `http://localhost:8000/docs`

---

## Configuration

All settings can be overridden via environment variables:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./greenhouse.db` | SQLAlchemy async DB URL |
| `MQTT_BROKER_HOST` | `localhost` | MQTT broker hostname or IP |
| `MQTT_BROKER_PORT` | `1883` | MQTT broker port |
| `MQTT_TOPIC` | `greenhouse/sensor` | MQTT topic to subscribe to |

Example — broker on a different machine:
```bash
MQTT_BROKER_HOST=192.168.1.50 uvicorn main:app --port 8000
```

---

## API Reference

### `GET /api/sensors/latest`

Returns the most recent sensor reading.

**Response `200 OK`:**
```json
{
  "sensor_id": "zone-a",
  "temperature": 24.5,
  "humidity": 61.2,
  "recorded_at": "2026-05-06T10:23:01Z"
}
```

**Response `404`:** No readings in the database yet.

---

### `GET /api/sensors/history?limit=20`

Returns the last N readings, **oldest first** (ready for chart rendering).

| Query param | Default | Range | Description |
|---|---|---|---|
| `limit` | `20` | 1–100 | Number of readings to return |

**Response `200 OK`:**
```json
[
  { "time": "10:22:57", "temp": 23.1, "hum": 59.8 },
  { "time": "10:23:01", "temp": 24.5, "hum": 61.2 }
]
```

---

### `GET /api/alerts?limit=50`

Returns recent alerts, **newest first**.

| Query param | Default | Range | Description |
|---|---|---|---|
| `limit` | `50` | 1–200 | Number of alerts to return |

**Response `200 OK`:**
```json
[
  {
    "id": 1,
    "sensor_id": "zone-a",
    "metric": "temperature",
    "value": 32.1,
    "threshold": "high",
    "message": "Temp too high: 32.1°C",
    "triggered_at": "2026-05-06T10:20:00Z"
  }
]
```

---

## Alert Thresholds

Alerts are generated when readings fall outside the optimal greenhouse range:

| Metric | Optimal Range | Alert (low) | Alert (high) |
|---|---|---|---|
| Temperature | 18°C – 28°C | `< 18°C` | `> 28°C` |
| Humidity | 40% – 70% | `< 40%` | `> 70%` |

**Deduplication:** Once an alert is fired for a given sensor + metric + direction (`high`/`low`), no new alert is saved for that combination for the next **5 minutes**. This prevents log flooding during sustained out-of-range conditions.

---

## MQTT Protocol

**Topic:** `greenhouse/sensor`  
**QoS:** 1 (at least once)  
**Payload:** JSON

```json
{ "temp": 24.5, "hum": 61.2, "sensor_id": "zone-a" }
```

- `temp` — temperature in °C (float, required)
- `hum` — relative humidity in % (float, required)
- `sensor_id` — sensor identifier (string, optional, defaults to `"zone-a"`)

The backend reconnects automatically if the broker goes down (retries every 5 seconds).

**Test publish from terminal:**
```bash
mosquitto_pub -h localhost -t greenhouse/sensor \
  -m '{"temp": 24.5, "hum": 61.2, "sensor_id": "zone-a"}'
```

---

## Database Schema

### `readings`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | Primary key, autoincrement |
| `sensor_id` | TEXT | e.g. `"zone-a"` |
| `temperature` | REAL | °C |
| `humidity` | REAL | % RH |
| `recorded_at` | DATETIME | UTC, set at insert time |

### `alerts`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | Primary key, autoincrement |
| `sensor_id` | TEXT | |
| `metric` | TEXT | `"temperature"` or `"humidity"` |
| `value` | REAL | Reading that triggered the alert |
| `threshold` | TEXT | `"high"` or `"low"` |
| `message` | TEXT | Human-readable, e.g. `"Temp too high: 32.1°C"` |
| `triggered_at` | DATETIME | UTC, set at insert time |

---

## Running Tests

```bash
cd backend
source venv/bin/activate
pytest -v
```

**22 tests across 4 files — all use an in-memory SQLite DB (no real broker needed):**

| File | Tests | What it covers |
|---|---|---|
| `test_thresholds.py` | 7 | Threshold logic: normal values, high/low per metric, both out of range, boundary values |
| `test_sensors_router.py` | 5 | `/api/sensors/latest` (404, correct record), `/api/sensors/history` (ordering, limit, empty) |
| `test_alerts_router.py` | 4 | `/api/alerts` (empty, newest-first ordering, fields, limit) |
| `test_mqtt_listener.py` | 6 | `handle_message`: saves reading, sensor_id override, alert on high temp, no alert on normal, dedup within cooldown, alert allowed after cooldown |

Expected output:
```
======================== 22 passed in ~2s =========================
```

---

## ESP8266 Arduino Sketch (Reference)

Add this to your Arduino loop to publish sensor data:

```cpp
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

#define DHTPIN D4
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

void loop() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();

  if (!isnan(temp) && !isnan(hum)) {
    StaticJsonDocument<64> doc;
    doc["temp"]      = temp;
    doc["hum"]       = hum;
    doc["sensor_id"] = "zone-a";

    char buf[64];
    serializeJson(doc, buf);
    mqttClient.publish("greenhouse/sensor", buf);
  }

  delay(4000);  // publish every 4 seconds
}
```

**Required Arduino libraries:** `PubSubClient`, `ArduinoJson`, `DHT sensor library by Adafruit`

---

## Frontend Integration

The React frontend (`src/pages/Dashboard.tsx`) currently uses simulated data. To connect it to this backend, replace the `setInterval` simulation with:

```ts
// Poll latest reading every 4 seconds
const fetchLatest = async () => {
  const res = await fetch('http://localhost:8000/api/sensors/latest');
  if (res.ok) {
    const data = await res.json();
    setZoneA({ temp: data.temperature, hum: data.humidity });
  }
};

// Poll history for chart
const fetchHistory = async () => {
  const res = await fetch('http://localhost:8000/api/sensors/history?limit=20');
  if (res.ok) setHistory(await res.json());
};

// Poll alerts
const fetchAlerts = async () => {
  const res = await fetch('http://localhost:8000/api/alerts?limit=50');
  if (res.ok) setAlerts(await res.json());
};
```
