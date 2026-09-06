from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from backend.app.database import (
    get_connection,
    initialize_database,
)
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
from backend.app.response import (
    determine_response,
    execute_response,
    get_response_actions,
)


# -------------------------------------------------
# APPLICATION LIFECYCLE
# -------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


# -------------------------------------------------
# FASTAPI APPLICATION
# -------------------------------------------------

app = FastAPI(
    title="AEGIS X",
    description="Universal Security Intelligence & Defense Platform",
    version="0.3.0",
    lifespan=lifespan,
)


# -------------------------------------------------
# ROOT
# -------------------------------------------------

@app.get("/")
def root():
    return {
        "name": "AEGIS X",
        "version": "0.3.0",
        "status": "operational",
        "message": "AEGIS X security platform is running.",
    }


# -------------------------------------------------
# HEALTH
# -------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


# -------------------------------------------------
# EVENT INGESTION
# -------------------------------------------------

@app.post("/api/v1/events")
def ingest_event(event: SecurityEvent):
    connection = get_connection()

    try:
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

    finally:
        connection.close()

    return {
        "status": "accepted",
        "event_id": event_id,
        "event_type": event.event_type,
    }


# -------------------------------------------------
# EVENT LIST
# -------------------------------------------------

@app.get("/api/v1/events")
def get_events():
    connection = get_connection()

    try:
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

    finally:
        connection.close()

    return {
        "total": len(rows),
        "events": [
            dict(row)
            for row in rows
        ],
    }


# -------------------------------------------------
# DETECTION + RISK + ALERT + INCIDENT PIPELINE
# -------------------------------------------------

@app.get("/api/v1/detections")
def get_detections():
    connection = get_connection()

    try:
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

    finally:
        connection.close()

    events = [
        dict(row)
        for row in rows
    ]

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

        # ---------------------------------------------
        # SEVERITY
        # ---------------------------------------------

        severity_name = alert.get(
            "severity",
            "LOW",
        )

        severity_value = severity_map.get(
            severity_name,
            1,
        )

        # ---------------------------------------------
        # SOURCE IP
        # ---------------------------------------------

        source_ip = alert.get(
            "source_ip"
        )

        # ---------------------------------------------
        # EVENT COUNT
        # ---------------------------------------------

        event_count = sum(
            1
            for event in events
            if event.get("source_ip") == source_ip
        )

        # ---------------------------------------------
        # RISK CALCULATION
        # ---------------------------------------------

        risk = calculate_risk(
            severity=severity_value,
            alert_type=alert.get("type"),
            event_count=event_count,
        )

        alert["risk"] = risk

        # ---------------------------------------------
        # RESPONSE DECISION
        # ---------------------------------------------

        alert_type = alert.get(
            "type",
            "UNKNOWN",
        )

        response = determine_response(
            risk_score=risk["score"],
            risk_level=risk["level"],
            incident_type=alert_type,
        )

        alert["response"] = response

        # ---------------------------------------------
        # ALERT DETAILS
        # ---------------------------------------------

        message = alert.get(
            "message",
            "",
        )

        # ---------------------------------------------
        # ALERT MANAGEMENT
        # ---------------------------------------------

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

        # ---------------------------------------------
        # INCIDENT MANAGEMENT
        # ---------------------------------------------

        existing_incident = find_open_incident(
            incident_type=alert_type,
            source_ip=source_ip,
        )

        if existing_incident:

            existing_incidents.append(
                {
                    "incident_id": existing_incident["id"],
                    "type": existing_incident[
                        "incident_type"
                    ],
                    "status": existing_incident[
                        "status"
                    ],
                    "risk": {
                        "score": existing_incident[
                            "risk_score"
                        ],
                        "level": existing_incident[
                            "risk_level"
                        ],
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
        "alerts": detection_result[
            "alerts"
        ],
        "database_alerts_created": created_alerts,
        "existing_active_alerts": existing_alerts,
        "database_incidents_created": created_incidents,
        "existing_open_incidents": existing_incidents,
    }


# -------------------------------------------------
# ALERTS
# -------------------------------------------------

@app.get("/api/v1/alerts")
def list_alerts():
    alerts = get_alerts()

    return {
        "total": len(alerts),
        "alerts": alerts,
    }


# -------------------------------------------------
# INCIDENTS
# -------------------------------------------------

@app.get("/api/v1/incidents")
def list_incidents():
    incidents = get_incidents()

    return {
        "total": len(incidents),
        "incidents": incidents,
    }


# -------------------------------------------------
# INCIDENT STATUS
# -------------------------------------------------

@app.patch("/api/v1/incidents/{incident_id}/status")
def change_incident_status(
    incident_id: int,
    status: str,
):
    try:
        updated = update_incident_status(
            incident_id=incident_id,
            status=status,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Incident not found",
        )

    return {
        "updated": True,
        "incident_id": incident_id,
        "status": status,
    }


# -------------------------------------------------
# EXECUTE INCIDENT RESPONSE
# -------------------------------------------------

@app.post("/api/v1/incidents/{incident_id}/response")
def run_incident_response(
    incident_id: int,
):
    connection = get_connection()

    try:
        row = connection.execute(
            """
            SELECT
                id,
                incident_type,
                severity,
                risk_score,
                risk_level,
                source_ip,
                description,
                status,
                first_seen,
                last_seen
            FROM security_incidents
            WHERE id = ?
            """,
            (incident_id,),
        ).fetchone()

    finally:
        connection.close()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Incident not found",
        )

    incident = dict(row)

    # ---------------------------------------------
    # RESOLVED INCIDENT PROTECTION
    # ---------------------------------------------

    if incident["status"] == "RESOLVED":
        raise HTTPException(
            status_code=400,
            detail="Incident is already resolved",
        )

    # ---------------------------------------------
    # DETERMINE RESPONSE
    # ---------------------------------------------

    response = determine_response(
        risk_score=incident["risk_score"],
        risk_level=incident["risk_level"],
        incident_type=incident["incident_type"],
    )

    # ---------------------------------------------
    # EXECUTE RESPONSE
    # ---------------------------------------------

    execution = execute_response(
        incident_id=incident_id,
        action=response["action"],
        source_ip=incident["source_ip"],
    )

    return {
        "incident": incident,
        "response": response,
        "execution": execution,
    }


# -------------------------------------------------
# RESPONSE HISTORY
# -------------------------------------------------

@app.get("/api/v1/responses")
def list_response_actions():
    responses = get_response_actions()

    return {
        "total": len(responses),
        "responses": responses,
    }