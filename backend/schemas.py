"""Pydantic response schemas for the Greenhouse IoT API."""

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
