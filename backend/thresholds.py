"""
Threshold constants and alert-check logic for greenhouse sensor readings.

Optimal ranges (from system spec):
  Temperature: 18°C – 28°C
  Humidity:    40%  – 70%

Alerts fire when a reading falls outside these ranges.
Deduplication is handled separately in mqtt_listener via ALERT_COOLDOWN_SECONDS.
"""

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
