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
