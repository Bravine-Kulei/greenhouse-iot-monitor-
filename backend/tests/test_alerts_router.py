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
