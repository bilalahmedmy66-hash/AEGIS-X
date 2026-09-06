from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.database import get_connection, initialize_database
from backend.app.detection import analyze_events
from backend.app.events import SecurityEvent
from backend.app.risk import calculate_risk
from backend.app.alerts import (
    create_alert,
    find_active_alert,
    get_alerts,
)
from backend.app.incidents import (
    create_incident,
    find_open_incident,
    get_incidents,
    update_incident_status,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="AEGIS X",
    description="Universal Security Intelligence & Defense Platform",
    version="0.3.0",
    lifespan=lifespan,
)


@app.get("/")
def root():
    return {
        "name": "AEGIS X",
        "version": "0.3.0",
        "status": "operational",
        "message": "AEGIS X security platform is running.",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


@app.post("/api/v1/events")
def ingest_event(event: SecurityEvent):
    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO security_events (
            event_type,
            source,
            user,
            source_ip,
            description,
            severity,
            timestamp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event.event_type.value,
            event.source,
            event.user,
            event.source_ip,
            event.description,
            event.severity,
            event.timestamp.isoformat(),
        ),
    )

    connection.commit()

    event_id = cursor.lastrowid

    connection.close()

    return {
        "status": "accepted",
        "event_id": event_id,
        "event_type": event.event_type,
    }


@app.get("/api/v1/events")
def get_events():
    connection = get_connection()

    rows = connection.execute(
        """
        SELECT
            id,
            event_type,
            source,
            user,
            source_ip,
            description,
            severity,
            timestamp
        FROM security_events
        ORDER BY id DESC
        """
    ).fetchall()

    connection.close()

    return {
        "total": len(rows),
        "events": [dict(row) for row in rows],
    }


@app.get("/api/v1/detections")
def get_detections():
    connection = get_connection()

    rows = connection.execute(
        """
        SELECT
            id,
            event_type,
            source,
            user,
            source_ip,
            description,
            severity,
            timestamp
        FROM security_events
        ORDER BY id DESC
        """
    ).fetchall()

    connection.close()

    events = [dict(row) for row in rows]

    detection_result = analyze_events(events)

    severity_map = {
        "LOW": 1,
        "MEDIUM": 3,
        "HIGH": 5,
        "CRITICAL": 10,
    }

    created_alerts = []
    existing_alerts = []

    created_incidents = []
    existing_incidents = []

    for alert in detection_result["alerts"]:
        severity_name = alert.get("severity", "LOW")

        severity_value = severity_map.get(
            severity_name,
            1,
        )

        source_ip = alert.get("source_ip")

        event_count = sum(
            1
            for event in events
            if event.get("source_ip") == source_ip
        )

        risk = calculate_risk(
            severity=severity_value,
            alert_type=alert.get("type"),
            event_count=event_count,
        )

        alert["risk"] = risk

        alert_type = alert.get(
            "type",
            "UNKNOWN",
        )

        message = alert.get(
            "message",
            "",
        )

        # -------------------------------------------------
        # ALERT MANAGEMENT
        # -------------------------------------------------

        existing_alert = find_active_alert(
            alert_type=alert_type,
            source_ip=source_ip,
        )

        if existing_alert:
            existing_alerts.append(
                {
                    "alert_id": existing_alert["id"],
                    "type": existing_alert["alert_type"],
                    "status": existing_alert["status"],
                    "risk": {
                        "score": existing_alert["risk_score"],
                        "level": existing_alert["risk_level"],
                    },
                }
            )

        else:
            alert_id = create_alert(alert)

            created_alerts.append(
                {
                    "alert_id": alert_id,
                    "type": alert_type,
                    "severity": severity_name,
                    "risk": risk,
                }
            )

        # -------------------------------------------------
        # INCIDENT MANAGEMENT
        # -------------------------------------------------

        existing_incident = find_open_incident(
            incident_type=alert_type,
            source_ip=source_ip,
        )

        if existing_incident:
            existing_incidents.append(
                {
                    "incident_id": existing_incident["id"],
                    "type": existing_incident["incident_type"],
                    "status": existing_incident["status"],
                    "risk": {
                        "score": existing_incident["risk_score"],
                        "level": existing_incident["risk_level"],
                    },
                }
            )

        else:
            incident_id = create_incident(
                incident_type=alert_type,
                severity=severity_name,
                risk_score=risk["score"],
                risk_level=risk["level"],
                source_ip=source_ip,
                description=message,
            )

            created_incidents.append(
                {
                    "incident_id": incident_id,
                    "type": alert_type,
                    "severity": severity_name,
                    "risk": risk,
                }
            )

    return {
        "total_events_analyzed": detection_result[
            "total_events_analyzed"
        ],
        "alerts_generated": detection_result[
            "alerts_generated"
        ],
        "alerts": detection_result["alerts"],
        "database_alerts_created": created_alerts,
        "existing_active_alerts": existing_alerts,
        "database_incidents_created": created_incidents,
        "existing_open_incidents": existing_incidents,
    }


@app.get("/api/v1/alerts")
def list_alerts():
    alerts = get_alerts()

    return {
        "total": len(alerts),
        "alerts": alerts,
    }


@app.get("/api/v1/incidents")
def list_incidents():
    incidents = get_incidents()

    return {
        "total": len(incidents),
        "incidents": incidents,
    }


@app.patch("/api/v1/incidents/{incident_id}/status")
def change_incident_status(
    incident_id: int,
    status: str,
):
    updated = update_incident_status(
        incident_id=incident_id,
        status=status,
    )

    return {
        "updated": updated,
        "incident_id": incident_id,
        "status": status,
    }