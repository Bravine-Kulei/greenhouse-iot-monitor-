"""Sensor data endpoints: latest reading and history."""

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
