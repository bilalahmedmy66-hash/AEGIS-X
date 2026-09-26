from fastapi import APIRouter
from datetime import datetime, timezone
import sqlite3
from pathlib import Path

soc_router = APIRouter(
    prefix="/api/v1/soc",
    tags=["AEGIS Real-Time SOC"],
)

DB_PATH = Path(__file__).resolve().parents[1] / "data" / "aegis.db"


def _rows(connection, query, params=()):
    connection.row_factory = sqlite3.Row
    return [dict(row) for row in connection.execute(query, params).fetchall()]


@soc_router.get("/state")
def soc_state():
    connection = sqlite3.connect(DB_PATH)

    try:
        events = _rows(
            connection,
            """
            SELECT *
            FROM security_events
            ORDER BY id DESC
            LIMIT 20
            """
        )

        alerts = _rows(
            connection,
            """
            SELECT *
            FROM security_alerts
            ORDER BY id DESC
            LIMIT 20
            """
        )

        incidents = _rows(
            connection,
            """
            SELECT *
            FROM security_incidents
            ORDER BY id DESC
            LIMIT 20
            """
        )

        responses = _rows(
            connection,
            """
            SELECT *
            FROM response_actions
            ORDER BY id DESC
            LIMIT 20
            """
        )

        active_incidents = [
            item for item in incidents
            if str(item.get("status", "")).upper()
            not in {"RESOLVED", "CLOSED"}
        ]

        critical = sum(
            1 for item in active_incidents
            if str(item.get("risk_level", "")).upper() == "CRITICAL"
        )

        high = sum(
            1 for item in active_incidents
            if str(item.get("risk_level", "")).upper() == "HIGH"
        )

        medium = sum(
            1 for item in active_incidents
            if str(item.get("risk_level", "")).upper() == "MEDIUM"
        )

        low = sum(
            1 for item in active_incidents
            if str(item.get("risk_level", "")).upper() == "LOW"
        )

        activity = []

        for item in events[:10]:
            activity.append({
                "kind": "EVENT",
                "id": item.get("id"),
                "timestamp": item.get("timestamp") or item.get("created_at"),
                "type": item.get("event_type"),
                "source_ip": item.get("source_ip"),
                "severity": item.get("severity"),
            })

        for item in alerts[:10]:
            activity.append({
                "kind": "ALERT",
                "id": item.get("id"),
                "timestamp": item.get("timestamp") or item.get("created_at"),
                "type": item.get("alert_type"),
                "source_ip": item.get("source_ip"),
                "severity": item.get("severity"),
            })

        activity.sort(
            key=lambda item: str(item.get("timestamp") or ""),
            reverse=True,
        )

        latest_incident = active_incidents[0] if active_incidents else None

        return {
            "soc": "AEGIS REAL-TIME SOC",
            "version": "1.0",
            "status": "ACTIVE",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "system": {
                "state": "MONITORING",
                "telemetry": "ACTIVE",
                "detection": "ACTIVE",
                "correlation": "ACTIVE",
                "security_brain": "ACTIVE",
            },
            "threat": {
                "active_incidents": len(active_incidents),
                "critical": critical,
                "high": high,
                "medium": medium,
                "low": low,
                "latest_risk": (
                    latest_incident.get("risk_score")
                    if latest_incident else 0
                ),
                "latest_level": (
                    latest_incident.get("risk_level")
                    if latest_incident else "LOW"
                ),
            },
            "telemetry": {
                "events_observed": len(events),
                "alerts_observed": len(alerts),
                "responses_observed": len(responses),
            },
            "latest_incident": latest_incident,
            "activity": activity[:20],
        }

    finally:
        connection.close()
