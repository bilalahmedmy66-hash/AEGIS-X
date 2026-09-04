from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field


class EventType(str, Enum):
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    SUSPICIOUS_IP = "SUSPICIOUS_IP"
    FILE_MODIFIED = "FILE_MODIFIED"
    PRIVILEGE_CHANGE = "PRIVILEGE_CHANGE"
    MALWARE_DETECTED = "MALWARE_DETECTED"
    UNUSUAL_ACCESS = "UNUSUAL_ACCESS"


class SecurityEvent(BaseModel):
    event_type: EventType
    source: str = Field(min_length=1, max_length=100)
    user: str | None = Field(default=None, max_length=100)
    source_ip: str | None = Field(default=None, max_length=45)
    description: str = Field(min_length=1, max_length=1000)
    severity: int = Field(default=1, ge=1, le=10)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )