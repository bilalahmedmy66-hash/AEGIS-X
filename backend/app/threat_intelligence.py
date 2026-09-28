from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class IOCType(str, Enum):
    IP = "IP"
    DOMAIN = "DOMAIN"
    URL = "URL"
    HASH = "HASH"
    EMAIL = "EMAIL"


class ThreatIntelRecord(BaseModel):
    indicator: str = Field(min_length=1)
    indicator_type: IOCType
    threat_type: str = Field(min_length=1)
    confidence: int = Field(default=50, ge=0, le=100)
    severity: str = "MEDIUM"
    source: str = "AEGIS_LOCAL"
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    first_seen: str = ""
    last_seen: str = ""
    active: bool = True


def normalize_indicator(value: str) -> str:
    return value.strip().lower()


def build_threat_intel_record(
    indicator: str,
    indicator_type: IOCType,
    threat_type: str,
    confidence: int = 50,
    severity: str = "MEDIUM",
    source: str = "AEGIS_LOCAL",
    description: str = "",
    tags: list[str] | None = None,
) -> ThreatIntelRecord:
    now = datetime.now(timezone.utc).isoformat()

    return ThreatIntelRecord(
        indicator=normalize_indicator(indicator),
        indicator_type=indicator_type,
        threat_type=threat_type,
        confidence=confidence,
        severity=severity,
        source=source,
        description=description,
        tags=tags or [],
        first_seen=now,
        last_seen=now,
    )
