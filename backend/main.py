"""
Greenhouse IoT API — FastAPI application entry point.

Lifespan:
  - Initialises the SQLite database on startup
  - Starts the MQTT listener as an async background task
  - Cancels the listener cleanly on shutdown

CORS is open to all origins (GET only) so the React dev server can connect.
"""

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
