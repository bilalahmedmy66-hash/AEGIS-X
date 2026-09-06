from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.database import get_connection, initialize_database
from backend.app.detection import analyze_events
from backend.app.events import SecurityEvent
from backend.app.risk import calculate_risk
from backend.app.alerts import get_alerts


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

    for alert in detection_result["alerts"]:
        severity_value = severity_map.get(alert["severity"], 1)

        source_ip = alert.get("source_ip")

        event_count = sum(
            1
            for event in events
            if event.get("source_ip") == source_ip
        )

        alert["risk"] = calculate_risk(
            severity=severity_value,
            alert_type=alert.get("type"),
            event_count=event_count,
        )

    return detection_result


@app.get("/api/v1/alerts")
def list_alerts():
    alerts = get_alerts()

    return {
        "total": len(alerts),
        "alerts": alerts,
    }