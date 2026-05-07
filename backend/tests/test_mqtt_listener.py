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
