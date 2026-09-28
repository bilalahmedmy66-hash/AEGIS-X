from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from backend.app.events import EventType, SecurityEvent


class TelemetryRecord(BaseModel):
    source_type: str = Field(min_length=1, max_length=50)
    source_name: str = Field(min_length=1, max_length=100)
    event_type: EventType
    user: str | None = Field(default=None, max_length=100)
    source_ip: str | None = Field(default=None, max_length=45)
    description: str = Field(min_length=1, max_length=1000)
    severity: int = Field(default=1, ge=1, le=10)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = Field(default_factory=dict)


def normalize_telemetry(record: TelemetryRecord) -> SecurityEvent:
    timestamp = record.timestamp
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    return SecurityEvent(
        event_type=record.event_type,
        source=record.source_name,
        user=record.user,
        source_ip=record.source_ip,
        description=record.description,
        severity=record.severity,
        timestamp=timestamp,
    )