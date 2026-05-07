import asyncio
import json
import logging
import os
from datetime import datetime, timezone, timedelta

from aiomqtt import Client, MqttError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from models import Reading, Alert
from thresholds import check_thresholds, ALERT_COOLDOWN_SECONDS

logger = logging.getLogger(__name__)

BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "localhost")
BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
TOPIC = os.getenv("MQTT_TOPIC", "greenhouse/sensor")
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
