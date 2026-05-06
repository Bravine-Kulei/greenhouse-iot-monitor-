# Greenhouse IoT Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python FastAPI backend that receives ESP8266 DHT11 sensor data via MQTT, stores it in SQLite, checks thresholds, and exposes a REST API for the React frontend.

**Architecture:** A single async Python process runs both the MQTT subscriber (aiomqtt) and the HTTP server (FastAPI/uvicorn). On each MQTT message, a reading is saved to SQLite and threshold checks trigger alerts with a 5-minute cooldown. Three GET endpoints serve the frontend.

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, aiomqtt, SQLAlchemy (async), aiosqlite, pydantic, pytest, pytest-asyncio, httpx

---

## File Map

| File | Responsibility |
|------|---------------|
| `backend/requirements.txt` | Python dependencies |
| `backend/pytest.ini` | pytest + asyncio config |
| `backend/database.py` | Async SQLAlchemy engine, session factory, `get_db` dependency, `init_db()` |
| `backend/models.py` | `Reading` and `Alert` ORM models |
| `backend/thresholds.py` | Threshold constants + `check_thresholds()` pure function |
| `backend/schemas.py` | Pydantic response models |
| `backend/routers/sensors.py` | `GET /api/sensors/latest` and `GET /api/sensors/history` |
| `backend/routers/alerts.py` | `GET /api/alerts` |
| `backend/mqtt_listener.py` | MQTT subscribe loop, `handle_message()`, alert dedup |
| `backend/main.py` | FastAPI app, CORS, lifespan (init DB + start MQTT task) |
| `backend/tests/conftest.py` | Shared fixtures: in-memory DB, test HTTP client |
| `backend/tests/test_thresholds.py` | Unit tests for threshold logic |
| `backend/tests/test_sensors_router.py` | Tests for `/api/sensors/*` endpoints |
| `backend/tests/test_alerts_router.py` | Tests for `/api/alerts` endpoint |
| `backend/tests/test_mqtt_listener.py` | Integration test for `handle_message()` |

---

## Task 1: Project Setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py`
- Create: `backend/routers/__init__.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
aiomqtt==1.2.1
sqlalchemy[asyncio]==2.0.29
aiosqlite==0.20.0
pydantic==2.7.1
pytest==8.2.0
pytest-asyncio==0.23.6
httpx==0.27.0
```

- [ ] **Step 2: Create pytest.ini**

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 3: Create empty init files**

`backend/tests/__init__.py` — empty file  
`backend/routers/__init__.py` — empty file

- [ ] **Step 4: Install dependencies**

```bash
cd "/home/idx-hub/Documents/projects/iot/smart greenhouse/greenhouse-iot-monitor-/backend"
pip install -r requirements.txt
```

Expected: all packages install without errors.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "chore: scaffold backend project structure"
```

---

## Task 2: Database Layer

**Files:**
- Create: `backend/database.py`
- Create: `backend/models.py`

- [ ] **Step 1: Create database.py**

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "sqlite+aiosqlite:///./greenhouse.db"

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session


async def init_db():
    from models import Reading, Alert  # noqa: F401 — ensures models are registered
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

- [ ] **Step 2: Create models.py**

```python
from datetime import datetime, timezone
from sqlalchemy import Integer, Float, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Reading(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(Text, nullable=False)
    temperature: Mapped[float] = mapped_column(Float, nullable=False)
    humidity: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(Text, nullable=False)
    metric: Mapped[str] = mapped_column(Text, nullable=False)       # "temperature" | "humidity"
    value: Mapped[float] = mapped_column(Float, nullable=False)
    threshold: Mapped[str] = mapped_column(Text, nullable=False)    # "high" | "low"
    message: Mapped[str] = mapped_column(Text, nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
```

- [ ] **Step 3: Verify models import cleanly**

```bash
cd backend && python -c "from models import Reading, Alert; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/database.py backend/models.py
git commit -m "feat: add SQLAlchemy async database layer and ORM models"
```

---

## Task 3: Threshold Logic (TDD)

**Files:**
- Create: `backend/thresholds.py`
- Create: `backend/tests/test_thresholds.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_thresholds.py`:
```python
from thresholds import check_thresholds


def test_normal_values_produce_no_alerts():
    assert check_thresholds(24.0, 60.0) == []


def test_temp_above_max_produces_high_alert():
    alerts = check_thresholds(30.0, 60.0)
    assert len(alerts) == 1
    assert alerts[0].metric == "temperature"
    assert alerts[0].threshold == "high"
    assert "30.0" in alerts[0].message


def test_temp_below_min_produces_low_alert():
    alerts = check_thresholds(15.0, 60.0)
    assert len(alerts) == 1
    assert alerts[0].metric == "temperature"
    assert alerts[0].threshold == "low"
    assert "15.0" in alerts[0].message


def test_humidity_above_max_produces_high_alert():
    alerts = check_thresholds(24.0, 75.0)
    assert len(alerts) == 1
    assert alerts[0].metric == "humidity"
    assert alerts[0].threshold == "high"


def test_humidity_below_min_produces_low_alert():
    alerts = check_thresholds(24.0, 35.0)
    assert len(alerts) == 1
    assert alerts[0].metric == "humidity"
    assert alerts[0].threshold == "low"


def test_both_out_of_range_produces_two_alerts():
    alerts = check_thresholds(32.0, 80.0)
    assert len(alerts) == 2
    metrics = {a.metric for a in alerts}
    assert metrics == {"temperature", "humidity"}


def test_boundary_values_are_in_range():
    # 18°C, 28°C, 40%, 70% are all within range
    assert check_thresholds(18.0, 40.0) == []
    assert check_thresholds(28.0, 70.0) == []
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && pytest tests/test_thresholds.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` — `thresholds` does not exist yet.

- [ ] **Step 3: Implement thresholds.py**

```python
from dataclasses import dataclass

TEMP_MIN = 18.0
TEMP_MAX = 28.0
HUM_MIN = 40.0
HUM_MAX = 70.0
ALERT_COOLDOWN_SECONDS = 300  # 5 minutes — dedup window


@dataclass
class AlertCandidate:
    metric: str
    value: float
    threshold: str
    message: str


def check_thresholds(temp: float, hum: float) -> list[AlertCandidate]:
    alerts: list[AlertCandidate] = []

    if temp > TEMP_MAX:
        alerts.append(AlertCandidate("temperature", temp, "high", f"Temp too high: {temp}°C"))
    elif temp < TEMP_MIN:
        alerts.append(AlertCandidate("temperature", temp, "low", f"Temp too low: {temp}°C"))

    if hum > HUM_MAX:
        alerts.append(AlertCandidate("humidity", hum, "high", f"Humidity too high: {hum}%"))
    elif hum < HUM_MIN:
        alerts.append(AlertCandidate("humidity", hum, "low", f"Humidity too low: {hum}%"))

    return alerts
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd backend && pytest tests/test_thresholds.py -v
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/thresholds.py backend/tests/test_thresholds.py
git commit -m "feat: add threshold check logic with tests"
```

---

## Task 4: Pydantic Schemas

**Files:**
- Create: `backend/schemas.py`

- [ ] **Step 1: Create schemas.py**

```python
from datetime import datetime
from pydantic import BaseModel


class LatestReading(BaseModel):
    sensor_id: str
    temperature: float
    humidity: float
    recorded_at: datetime

    model_config = {"from_attributes": True}


class HistoryPoint(BaseModel):
    time: str   # "HH:MM:SS"
    temp: float
    hum: float


class AlertOut(BaseModel):
    id: int
    sensor_id: str
    metric: str
    value: float
    threshold: str
    message: str
    triggered_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Verify schemas import cleanly**

```bash
cd backend && python -c "from schemas import LatestReading, HistoryPoint, AlertOut; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: add pydantic response schemas"
```

---

## Task 5: Test Fixtures (conftest)

**Files:**
- Create: `backend/tests/conftest.py`

This must exist before writing router tests because both test modules share these fixtures.

- [ ] **Step 1: Create tests/conftest.py**

```python
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(TEST_DB_URL)
    from database import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    from main import app
    from database import get_db

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    # Patch mqtt_listener so the lifespan doesn't try to connect to a real broker
    with patch("main.mqtt_listener", new_callable=AsyncMock):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac

    app.dependency_overrides.clear()
```

- [ ] **Step 2: Commit**

```bash
git add backend/tests/conftest.py
git commit -m "test: add shared fixtures for router tests"
```

---

## Task 6: Sensors Router (TDD)

**Files:**
- Create: `backend/tests/test_sensors_router.py`
- Create: `backend/routers/sensors.py`
- Create: `backend/main.py` (minimal — just enough for tests to import)

- [ ] **Step 1: Write minimal main.py so tests can import**

`backend/main.py`:
```python
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from mqtt_listener import mqtt_listener
from routers import sensors, alerts

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    task = asyncio.create_task(mqtt_listener())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Greenhouse IoT API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(sensors.router)
app.include_router(alerts.router)
```

- [ ] **Step 2: Write failing sensor router tests**

`backend/tests/test_sensors_router.py`:
```python
import pytest
from datetime import datetime, timezone, timedelta
from models import Reading


async def test_latest_returns_404_when_no_readings(client):
    response = await client.get("/api/sensors/latest")
    assert response.status_code == 404


async def test_latest_returns_most_recent_reading(client, db_session):
    old = Reading(
        sensor_id="zone-a", temperature=20.0, humidity=55.0,
        recorded_at=datetime.now(timezone.utc) - timedelta(seconds=10),
    )
    new = Reading(
        sensor_id="zone-a", temperature=25.0, humidity=65.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add_all([old, new])
    await db_session.commit()

    response = await client.get("/api/sensors/latest")
    assert response.status_code == 200
    data = response.json()
    assert data["temperature"] == 25.0
    assert data["humidity"] == 65.0
    assert data["sensor_id"] == "zone-a"
    assert "recorded_at" in data


async def test_history_returns_oldest_first(client, db_session):
    r1 = Reading(
        sensor_id="zone-a", temperature=20.0, humidity=55.0,
        recorded_at=datetime.now(timezone.utc) - timedelta(seconds=10),
    )
    r2 = Reading(
        sensor_id="zone-a", temperature=25.0, humidity=65.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add_all([r1, r2])
    await db_session.commit()

    response = await client.get("/api/sensors/history?limit=20")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["temp"] == 20.0   # oldest first
    assert data[1]["temp"] == 25.0
    assert "time" in data[0]
    assert "hum" in data[0]


async def test_history_respects_limit(client, db_session):
    for i in range(5):
        db_session.add(Reading(
            sensor_id="zone-a", temperature=20.0 + i, humidity=55.0,
            recorded_at=datetime.now(timezone.utc) - timedelta(seconds=5 - i),
        ))
    await db_session.commit()

    response = await client.get("/api/sensors/history?limit=3")
    assert response.status_code == 200
    assert len(response.json()) == 3


async def test_history_empty_returns_empty_list(client):
    response = await client.get("/api/sensors/history")
    assert response.status_code == 200
    assert response.json() == []
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
cd backend && pytest tests/test_sensors_router.py -v
```

Expected: `ImportError` — `routers.sensors` does not exist yet.

- [ ] **Step 4: Create routers/sensors.py**

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from database import get_db
from models import Reading
from schemas import LatestReading, HistoryPoint

router = APIRouter(prefix="/api/sensors", tags=["sensors"])


@router.get("/latest", response_model=LatestReading)
async def get_latest(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Reading).order_by(desc(Reading.recorded_at)).limit(1)
    )
    reading = result.scalar_one_or_none()
    if reading is None:
        raise HTTPException(status_code=404, detail="No readings yet")
    return reading


@router.get("/history", response_model=list[HistoryPoint])
async def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Reading).order_by(desc(Reading.recorded_at)).limit(limit)
    )
    readings = list(reversed(result.scalars().all()))  # oldest first for chart
    return [
        HistoryPoint(
            time=r.recorded_at.strftime("%H:%M:%S"),
            temp=r.temperature,
            hum=r.humidity,
        )
        for r in readings
    ]
```

- [ ] **Step 5: Create stub routers/alerts.py so main.py imports cleanly**

`backend/routers/alerts.py` (temporary stub — full implementation in Task 7):
```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/alerts", tags=["alerts"])
```

- [ ] **Step 6: Create stub mqtt_listener.py so main.py imports cleanly**

`backend/mqtt_listener.py` (temporary stub — full implementation in Task 8):
```python
async def mqtt_listener():
    pass
```

- [ ] **Step 7: Run sensor tests — verify they pass**

```bash
cd backend && pytest tests/test_sensors_router.py -v
```

Expected: all 5 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/routers/sensors.py backend/routers/alerts.py backend/mqtt_listener.py backend/main.py backend/tests/test_sensors_router.py
git commit -m "feat: add sensors router with latest and history endpoints"
```

---

## Task 7: Alerts Router (TDD)

**Files:**
- Create: `backend/tests/test_alerts_router.py`
- Modify: `backend/routers/alerts.py`

- [ ] **Step 1: Write failing alerts router tests**

`backend/tests/test_alerts_router.py`:
```python
from datetime import datetime, timezone, timedelta
from models import Alert


async def test_alerts_returns_empty_list_initially(client):
    response = await client.get("/api/alerts")
    assert response.status_code == 200
    assert response.json() == []


async def test_alerts_returns_newest_first(client, db_session):
    a1 = Alert(
        sensor_id="zone-a", metric="temperature", value=30.0,
        threshold="high", message="Temp too high: 30.0°C",
        triggered_at=datetime.now(timezone.utc) - timedelta(seconds=10),
    )
    a2 = Alert(
        sensor_id="zone-a", metric="humidity", value=75.0,
        threshold="high", message="Humidity too high: 75.0%",
        triggered_at=datetime.now(timezone.utc),
    )
    db_session.add_all([a1, a2])
    await db_session.commit()

    response = await client.get("/api/alerts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["metric"] == "humidity"   # newest first
    assert data[1]["metric"] == "temperature"


async def test_alerts_returns_expected_fields(client, db_session):
    db_session.add(Alert(
        sensor_id="zone-a", metric="temperature", value=30.0,
        threshold="high", message="Temp too high: 30.0°C",
        triggered_at=datetime.now(timezone.utc),
    ))
    await db_session.commit()

    data = (await client.get("/api/alerts")).json()
    alert = data[0]
    assert set(alert.keys()) >= {"id", "sensor_id", "metric", "value", "threshold", "message", "triggered_at"}


async def test_alerts_respects_limit(client, db_session):
    for i in range(10):
        db_session.add(Alert(
            sensor_id="zone-a", metric="temperature", value=30.0 + i,
            threshold="high", message=f"Temp too high: {30.0 + i}°C",
            triggered_at=datetime.now(timezone.utc) - timedelta(seconds=10 - i),
        ))
    await db_session.commit()

    response = await client.get("/api/alerts?limit=5")
    assert response.status_code == 200
    assert len(response.json()) == 5
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && pytest tests/test_alerts_router.py -v
```

Expected: tests fail because `routers/alerts.py` is a stub with no endpoints.

- [ ] **Step 3: Implement routers/alerts.py**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from database import get_db
from models import Alert
from schemas import AlertOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
async def get_alerts(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert).order_by(desc(Alert.triggered_at)).limit(limit)
    )
    return result.scalars().all()
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd backend && pytest tests/test_alerts_router.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/routers/alerts.py backend/tests/test_alerts_router.py
git commit -m "feat: add alerts router endpoint"
```

---

## Task 8: MQTT Listener (TDD)

**Files:**
- Create: `backend/tests/test_mqtt_listener.py`
- Modify: `backend/mqtt_listener.py`

- [ ] **Step 1: Write failing MQTT listener tests**

`backend/tests/test_mqtt_listener.py`:
```python
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from database import Base
from models import Reading, Alert

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def session_factory():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


async def test_handle_message_saves_reading(session_factory):
    from mqtt_listener import handle_message

    await handle_message({"temp": 24.5, "hum": 61.0}, session_factory)

    async with session_factory() as s:
        result = await s.execute(select(Reading))
        readings = result.scalars().all()

    assert len(readings) == 1
    assert readings[0].temperature == 24.5
    assert readings[0].humidity == 61.0
    assert readings[0].sensor_id == "zone-a"


async def test_handle_message_uses_sensor_id_from_payload(session_factory):
    from mqtt_listener import handle_message

    await handle_message({"temp": 24.5, "hum": 61.0, "sensor_id": "zone-b"}, session_factory)

    async with session_factory() as s:
        result = await s.execute(select(Reading))
        reading = result.scalars().first()

    assert reading.sensor_id == "zone-b"


async def test_handle_message_saves_alert_when_temp_high(session_factory):
    from mqtt_listener import handle_message

    await handle_message({"temp": 32.0, "hum": 60.0}, session_factory)

    async with session_factory() as s:
        result = await s.execute(select(Alert))
        alerts = result.scalars().all()

    assert len(alerts) == 1
    assert alerts[0].metric == "temperature"
    assert alerts[0].threshold == "high"
    assert alerts[0].value == 32.0


async def test_handle_message_no_alert_for_normal_reading(session_factory):
    from mqtt_listener import handle_message

    await handle_message({"temp": 24.0, "hum": 60.0}, session_factory)

    async with session_factory() as s:
        result = await s.execute(select(Alert))
        alerts = result.scalars().all()

    assert len(alerts) == 0


async def test_handle_message_deduplicates_alerts_within_cooldown(session_factory):
    from mqtt_listener import handle_message

    # First high-temp reading → should save alert
    await handle_message({"temp": 32.0, "hum": 60.0}, session_factory)
    # Second high-temp reading within cooldown → should NOT save another alert
    await handle_message({"temp": 33.0, "hum": 60.0}, session_factory)

    async with session_factory() as s:
        result = await s.execute(select(Alert))
        alerts = result.scalars().all()

    assert len(alerts) == 1  # deduped


async def test_handle_message_allows_alert_after_cooldown(session_factory):
    from mqtt_listener import handle_message
    from models import Alert as AlertModel
    from datetime import timedelta

    # Manually insert an old alert (outside cooldown window)
    old_triggered = datetime.now(timezone.utc) - timedelta(seconds=400)
    async with session_factory() as s:
        async with s.begin():
            s.add(AlertModel(
                sensor_id="zone-a", metric="temperature", value=32.0,
                threshold="high", message="Temp too high: 32.0°C",
                triggered_at=old_triggered,
            ))

    await handle_message({"temp": 32.0, "hum": 60.0}, session_factory)

    async with session_factory() as s:
        result = await s.execute(select(AlertModel))
        alerts = result.scalars().all()

    assert len(alerts) == 2  # old + new
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && pytest tests/test_mqtt_listener.py -v
```

Expected: tests fail because `handle_message` in the stub doesn't accept `session_factory` and does nothing.

- [ ] **Step 3: Implement mqtt_listener.py**

```python
import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta

from aiomqtt import Client, MqttError
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import async_sessionmaker

from models import Reading, Alert
from thresholds import check_thresholds, ALERT_COOLDOWN_SECONDS

logger = logging.getLogger(__name__)

BROKER_HOST = "localhost"
BROKER_PORT = 1883
TOPIC = "greenhouse/sensor"
DEFAULT_SENSOR_ID = "zone-a"


async def _should_alert(session, sensor_id: str, metric: str, threshold_dir: str) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=ALERT_COOLDOWN_SECONDS)
    result = await session.execute(
        select(Alert)
        .where(Alert.sensor_id == sensor_id)
        .where(Alert.metric == metric)
        .where(Alert.threshold == threshold_dir)
        .where(Alert.triggered_at >= cutoff)
        .limit(1)
    )
    return result.scalar_one_or_none() is None


async def handle_message(payload: dict, session_factory: async_sessionmaker = None):
    if session_factory is None:
        from database import SessionLocal
        session_factory = SessionLocal

    sensor_id = payload.get("sensor_id", DEFAULT_SENSOR_ID)
    temp = float(payload["temp"])
    hum = float(payload["hum"])

    async with session_factory() as session:
        async with session.begin():
            session.add(Reading(sensor_id=sensor_id, temperature=temp, humidity=hum))

            for candidate in check_thresholds(temp, hum):
                if await _should_alert(session, sensor_id, candidate.metric, candidate.threshold):
                    session.add(Alert(
                        sensor_id=sensor_id,
                        metric=candidate.metric,
                        value=candidate.value,
                        threshold=candidate.threshold,
                        message=candidate.message,
                    ))
                    logger.warning("Alert triggered: %s", candidate.message)


async def mqtt_listener():
    while True:
        try:
            async with Client(BROKER_HOST, port=BROKER_PORT) as client:
                await client.subscribe(TOPIC)
                logger.info("MQTT connected — subscribed to %s", TOPIC)
                async for message in client.messages:
                    try:
                        payload = json.loads(message.payload)
                        await handle_message(payload)
                    except (json.JSONDecodeError, KeyError, ValueError) as exc:
                        logger.error("Bad MQTT payload: %s — %s", message.payload, exc)
        except MqttError as exc:
            logger.error("MQTT connection error: %s — retrying in 5s", exc)
            await asyncio.sleep(5)
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd backend && pytest tests/test_mqtt_listener.py -v
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
cd backend && pytest -v
```

Expected: all tests PASS (thresholds + sensors router + alerts router + mqtt listener).

- [ ] **Step 6: Commit**

```bash
git add backend/mqtt_listener.py backend/tests/test_mqtt_listener.py
git commit -m "feat: implement MQTT listener with reading storage and alert deduplication"
```

---

## Task 9: Smoke Test (Manual)

Verify the full system runs end-to-end before connecting real hardware.

- [ ] **Step 1: Install Mosquitto**

```bash
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl start mosquitto
```

Expected: `mosquitto` service running on port 1883.

- [ ] **Step 2: Start the backend**

```bash
cd "/home/idx-hub/Documents/projects/iot/smart greenhouse/greenhouse-iot-monitor-/backend"
uvicorn main:app --reload --port 8000
```

Expected: server starts, logs show `MQTT connected — subscribed to greenhouse/sensor`.

- [ ] **Step 3: Publish a test MQTT message**

In a second terminal:
```bash
mosquitto_pub -h localhost -t greenhouse/sensor -m '{"temp": 24.5, "hum": 61.0, "sensor_id": "zone-a"}'
```

Expected: backend logs show the reading was received.

- [ ] **Step 4: Verify readings API**

```bash
curl http://localhost:8000/api/sensors/latest | python3 -m json.tool
```

Expected:
```json
{
  "sensor_id": "zone-a",
  "temperature": 24.5,
  "humidity": 61.0,
  "recorded_at": "..."
}
```

- [ ] **Step 5: Publish an out-of-range reading and verify alert**

```bash
mosquitto_pub -h localhost -t greenhouse/sensor -m '{"temp": 32.0, "hum": 60.0, "sensor_id": "zone-a"}'
curl http://localhost:8000/api/alerts | python3 -m json.tool
```

Expected: one alert with `metric: "temperature"`, `threshold: "high"`.

- [ ] **Step 6: Check history endpoint**

```bash
curl "http://localhost:8000/api/sensors/history?limit=20" | python3 -m json.tool
```

Expected: array of `{time, temp, hum}` objects, oldest first.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: smoke test passed — backend fully operational"
```

---

## ESP8266 Arduino Sketch (Reference)

The backend is ready. For the hardware side, the ESP8266 should publish this JSON to `greenhouse/sensor`:

```cpp
// In your Arduino loop():
StaticJsonDocument<64> doc;
doc["temp"] = dht.readTemperature();
doc["hum"]  = dht.readHumidity();
doc["sensor_id"] = "zone-a";

char buf[64];
serializeJson(doc, buf);
client.publish("greenhouse/sensor", buf);
```

Libraries needed: `PubSubClient`, `ArduinoJson`, `DHT sensor library`.
